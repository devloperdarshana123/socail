// Neutral filter DSL → backend-native query translation (Phase 7B, M-1).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────
// Before M-1, controllers and helpers authored Prisma `where` objects that
// travelled unchanged through the helper layer and the repository layer
// into `client.x.findMany({ where: filter })`. The Mongo implementations
// hand the SAME object to `models.X.find(filter)`, where Mongoose reads
// `{ contains: "q", mode: "insensitive" }` as a literal subdocument match
// and returns ZERO rows — silently, with no error. The Phase 7A audit
// recorded that as Blocker M-1, the highest-severity migration risk,
// precisely because it fails quietly rather than loudly.
//
// This module is the single translation point. Callers describe WHAT they
// want to match in a neutral vocabulary; each backend's translator decides
// HOW to express it.
//
// ── DESIGN: WHY MOST OPERATORS KEEP PRISMA'S SPELLING ────────────────────
// `gte`, `lte`, `gt`, `lt`, `in`, `notIn`, `not`, `startsWith`, `endsWith`
// are ordinary query vocabulary, not Prisma inventions — SQL, Mongo,
// Elasticsearch and every ORM in between use the same words. Renaming them
// would have churned ~66 call-sites for no semantic gain and made the
// diff harder to review.
//
// The guarantee here is NOT "the spelling differs from Prisma". It is that
// the operator set is CLOSED and VALIDATED: anything outside the whitelist
// throws at the repository boundary, so no un-translatable construct can
// reach a driver. Coincidental spelling is fine; undefined vocabulary is
// not. Only genuinely Prisma-specific spellings are renamed:
//
//     contains + mode:"insensitive"  →  like + caseInsensitive
//     OR / AND                       →  or / and
//     hasSome                        →  hasAny
//     equals                         →  eq
//
// ── POSTGRESQL BEHAVIOUR IS UNCHANGED ────────────────────────────────────
// Every mapping below is a pure rename or the identity. No operator changes
// collation, index usage, or null semantics. `caseInsensitive: true` still
// emits exactly `mode: "insensitive"`, so Postgres still takes its ILIKE
// path; omitting it still emits no `mode` key at all, so case-SENSITIVE
// matching stays case-sensitive. See tests/unit/filterTranslator.test.js,
// which pins each mapping against the literal `where` the app produced
// before this module existed.
//
// ── KNOWN LIMIT: relation filters vs. typos ──────────────────────────────
// `{ author: { role: "user" } }` (a nested relation filter) and
// `{ role: { nott: "x" } }` (a typo) are structurally identical: one object
// holding one non-operator key with a scalar value. Separating them needs
// schema knowledge this layer deliberately does not have, so a LONE
// unrecognised key is treated as a relation filter and passed through —
// where Prisma's own validation rejects it, exactly as before M-1.
//
// What IS guaranteed: every operator in Prisma's actual vocabulary is
// rejected by name (see PRISMA_HINTS) in any position, and an unknown key
// sitting ALONGSIDE a recognised operator throws. Those two rules cover the
// leak the audit found; schema-aware validation is a later phase.
//
// NOTE: toMongoFilter is deliberately NOT updated in this milestone —
// Phase 7B/M-1 is Prisma-only by instruction. It is left exactly as it was,
// and is still unused; wiring it belongs to the MongoDB implementation
// phase, which is also when the whitelist below becomes its checklist.

/** Field-level operators. A filter value object may only use these keys. */
const FIELD_OPERATORS = {
  eq:         "equals",
  not:        "not",
  gt:         "gt",
  gte:        "gte",
  lt:         "lt",
  lte:        "lte",
  in:         "in",
  notIn:      "notIn",
  like:       "contains",
  startsWith: "startsWith",
  endsWith:   "endsWith",
  hasAny:     "hasSome",
};

/** Modifier — not an operator itself; qualifies the string operators. */
const CASE_MODIFIER = "caseInsensitive";

/** String operators that `caseInsensitive` is allowed to qualify. */
const STRING_OPERATORS = new Set(["like", "startsWith", "endsWith"]);

/** Condition-level logical operators. */
const LOGICAL_OPERATORS = { or: "OR", and: "AND" };

/**
 * The complete neutral vocabulary. Exported so the eventual Mongo
 * translator can be checked against the same list rather than drifting.
 */
export const NEUTRAL_OPERATORS = [
  ...Object.keys(FIELD_OPERATORS),
  CASE_MODIFIER,
  ...Object.keys(LOGICAL_OPERATORS),
];

/**
 * True only for a genuine plain object — `{}` or `Object.create(null)`.
 *
 * This must EXCLUDE class instances, because a driver value like a mongoose
 * ObjectId, a Buffer or a Decimal is `typeof "object"` yet is a SCALAR as far
 * as a filter is concerned. Treating one as a nested condition flattens its
 * internal fields into dotted paths and the query silently matches nothing —
 * found by the batch-1 parity suite, where every `{ userId: ObjectId }`
 * filter returned zero rows.
 */
const isPlainObject = (v) => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

function reject(path, key, hint) {
  throw new Error(
    `Unknown filter operator "${key}" at "${path}". ` +
      `The neutral filter DSL accepts: ${NEUTRAL_OPERATORS.join(", ")}.` +
      (hint ? ` ${hint}` : "")
  );
}

// Prisma spellings the DSL deliberately does not accept, with the neutral
// replacement — so a stale call-site gets a fix, not just a rejection.
const PRISMA_HINTS = {
  contains:  'Use { like: … } (add caseInsensitive: true for the old mode:"insensitive").',
  mode:      "Use caseInsensitive: true alongside like/startsWith/endsWith.",
  equals:    "Use { eq: … }.",
  hasSome:   "Use { hasAny: [...] }.",
  hasEvery:  "Not supported by the neutral DSL.",
  OR:        "Use lowercase { or: [...] }.",
  AND:       "Use lowercase { and: [...] }.",
  NOT:       "Use field-level { not: … }.",
  some:      "Relation quantifiers are not part of the neutral DSL.",
  every:     "Relation quantifiers are not part of the neutral DSL.",
  none:      "Relation quantifiers are not part of the neutral DSL.",
};

/**
 * Translate a neutral filter-value object (the right-hand side of a field)
 * into Prisma's operator object.
 */
function translateFieldValue(value, path) {
  const keys = Object.keys(value);

  // An object whose keys are none of the operators is a NESTED RELATION
  // filter (e.g. `author: { role: { not: … } }`) — recurse into it as a
  // condition rather than treating its keys as operators.
  const looksLikeOperators = keys.some(
    (k) => k in FIELD_OPERATORS || k === CASE_MODIFIER
  );
  if (!looksLikeOperators) {
    // Guard first: a relation object containing a REJECTED Prisma operator
    // (contains, some, …) must throw here rather than recurse and treat
    // that operator as a field name.
    for (const k of keys) {
      if (k in PRISMA_HINTS) reject(`${path}.${k}`, k, PRISMA_HINTS[k]);
    }
    return translateCondition(value, path);
  }

  const caseInsensitive = value[CASE_MODIFIER] === true;
  const out = {};

  for (const key of keys) {
    if (key === CASE_MODIFIER) continue;

    const prismaKey = FIELD_OPERATORS[key];
    if (!prismaKey) reject(path, key, PRISMA_HINTS[key]);

    if (value[key] === undefined) continue;
    out[prismaKey] = value[key];

    if (caseInsensitive && STRING_OPERATORS.has(key)) out.mode = "insensitive";
  }

  // `caseInsensitive` on its own would emit a bare `{ mode: "insensitive" }`,
  // which Prisma rejects at query time with a far less useful message.
  if (CASE_MODIFIER in value && !Object.keys(out).length) {
    reject(path, CASE_MODIFIER, "It qualifies like/startsWith/endsWith; it is not an operator on its own.");
  }

  return out;
}

/**
 * Translate a neutral condition object (a `where`, or one element of an
 * or/and array, or a nested relation filter).
 */
function translateCondition(filter, path = "") {
  const out = {};

  for (const [key, value] of Object.entries(filter ?? {})) {
    // Strip undefined so an unset filter never narrows a query — the same
    // guard the previous implementation had, and the reason a controller
    // can write `where.status = maybeUndefined` safely.
    if (value === undefined) continue;

    const here = path ? `${path}.${key}` : key;

    // Logical operators take an array of conditions.
    if (key in LOGICAL_OPERATORS) {
      if (!Array.isArray(value)) {
        throw new Error(`Filter operator "${key}" at "${here}" expects an array of conditions.`);
      }
      out[LOGICAL_OPERATORS[key]] = value.map((c, i) => translateCondition(c, `${here}[${i}]`));
      continue;
    }

    // Reject Prisma's own spellings by name, with a fix in the message.
    if (key in PRISMA_HINTS) reject(here, key, PRISMA_HINTS[key]);

    // A plain object on the right-hand side is either an operator bag or a
    // nested relation filter — translateFieldValue decides which.
    if (isPlainObject(value)) {
      out[key] = translateFieldValue(value, here);
      continue;
    }

    // Scalars, null, Dates and arrays pass through untouched. Arrays are
    // NOT auto-wrapped in `{ in: … }`: on a scalar-list column (Post.media,
    // Post.hashtags) that would silently turn an equality filter into a
    // membership test. Callers say `{ in: [...] }` when they mean it.
    out[key] = value;
  }

  return out;
}

/**
 * Neutral filter → Prisma `where`.
 *
 * Throws on any operator outside the neutral vocabulary (Blocker M-1's core
 * guarantee): an un-translatable filter fails loudly at the repository
 * boundary instead of reaching a driver that would misread it.
 */
export function toPrismaWhere(filter = {}) {
  return translateCondition(filter);
}

// ─────────────────────────────────────────────────────────────────────────
//  MONGO SIDE (Phase 7D / M-5)
//
//  The Mongo half of M-1. Until this phase `toMongoFilter` understood only
//  gte/lte/gt/lt/in and was unused; every Mongo repository method now depends
//  on it, so it implements the SAME neutral vocabulary `toPrismaWhere` does
//  and rejects anything outside it with the same message.
//
//  Mapping (neutral → Mongo):
//      eq          → $eq            in     → $in
//      not         → $ne            notIn  → $nin
//      gt/gte/lt/lte → $gt/$gte/$lt/$lte
//      like        → $regex (escaped, substring)   + $options:"i" when
//                    caseInsensitive is set — this is the ILIKE equivalent
//      startsWith  → ^prefix        endsWith → suffix$
//      hasAny      → $in over an array field (Mongo's array-contains-any)
//      or / and    → $or / $and
//      nested relation object → dotted path (author.role → "author.role")
//
//  RELATION FILTERS ARE THE ONE REAL ASYMMETRY. Postgres joins; Mongo does
//  not. `{ author: { role: { not: "x" } } }` is expressible as a dotted path
//  ONLY when the relation is embedded. Where it is a separate collection the
//  repository must resolve it with $lookup or a pre-query — that decision
//  belongs to each method, not to a generic translator, so this function
//  emits the dotted path and each caller is responsible for making it valid.
// ─────────────────────────────────────────────────────────────────────────

const MONGO_FIELD_OPERATORS = {
  eq: "$eq", not: "$ne", gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte",
  in: "$in", notIn: "$nin", hasAny: "$in",
};

/** Escape a user-supplied string so it is a literal inside a regex. */
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function translateMongoFieldValue(value, path) {
  const keys = Object.keys(value);
  const looksLikeOperators = keys.some(
    (k) => k in MONGO_FIELD_OPERATORS || k in STRING_OPERATORS_SET || k === CASE_MODIFIER
  );

  if (!looksLikeOperators) {
    for (const k of keys) if (k in PRISMA_HINTS) reject(`${path}.${k}`, k, PRISMA_HINTS[k]);
    // Nested relation/embedded object → dotted paths.
    const nested = translateMongoCondition(value, path);
    return { __dotted: nested };
  }

  const caseInsensitive = value[CASE_MODIFIER] === true;
  const out = {};

  for (const key of keys) {
    if (key === CASE_MODIFIER) continue;
    if (value[key] === undefined) continue;

    if (key in MONGO_FIELD_OPERATORS) { out[MONGO_FIELD_OPERATORS[key]] = value[key]; continue; }

    if (key === "like")       { out.$regex = escapeRegex(value[key]); }
    else if (key === "startsWith") { out.$regex = "^" + escapeRegex(value[key]); }
    else if (key === "endsWith")   { out.$regex = escapeRegex(value[key]) + "$"; }
    else reject(path, key, PRISMA_HINTS[key]);

    if (caseInsensitive) out.$options = "i";
  }

  if (CASE_MODIFIER in value && !Object.keys(out).length) {
    reject(path, CASE_MODIFIER, "It qualifies like/startsWith/endsWith; it is not an operator on its own.");
  }
  return out;
}

/**
 * Neutral primary-key name → Mongo's.
 *
 * The neutral DSL calls the primary key `id`, because that is what Prisma
 * and the application layer call it. MongoDB calls it `_id`, universally,
 * in every collection and every embedded subdocument — this is a property
 * of MongoDB itself, not of our schema, so translating it here does not
 * give this module the schema knowledge it deliberately lacks.
 *
 * This is NOT cosmetic. Mongoose STRIPS query paths that the schema does
 * not declare, and `id` is a virtual rather than a stored field. So
 * `deleteMany({ id: { $in: [a, b] } })` does not delete a and b, and does
 * not error: the filter collapses to `{}` and the call deletes THE ENTIRE
 * COLLECTION. Proven empirically — 2 ids in, 5 of 5 documents deleted.
 * `userHelpers.generateRefreshToken` and `commentHelpers.deleteComment`
 * both take that path.
 */
const toMongoKey = (key) => (key === "id" ? "_id" : key);

function translateMongoCondition(filter, path = "") {
  const out = {};
  for (const [key, value] of Object.entries(filter ?? {})) {
    if (value === undefined) continue;
    const here = path ? `${path}.${key}` : key;

    if (key in LOGICAL_OPERATORS) {
      if (!Array.isArray(value)) {
        throw new Error(`Filter operator "${key}" at "${here}" expects an array of conditions.`);
      }
      out[key === "or" ? "$or" : "$and"] = value.map((c, i) => translateMongoCondition(c, `${here}[${i}]`));
      continue;
    }

    if (key in PRISMA_HINTS) reject(here, key, PRISMA_HINTS[key]);

    if (isPlainObject(value)) {
      const t = translateMongoFieldValue(value, here);
      if (t.__dotted) {
        // Flatten a nested object into dotted paths: { author: { role: X } }
        // becomes { "author.role": X }.
        for (const [k2, v2] of Object.entries(t.__dotted)) out[`${toMongoKey(key)}.${k2}`] = v2;
      } else {
        out[toMongoKey(key)] = t;
      }
      continue;
    }

    out[toMongoKey(key)] = value;
  }
  return out;
}

/** String operators, shared with the Prisma translator's whitelist. */
const STRING_OPERATORS_SET = { like: 1, startsWith: 1, endsWith: 1 };

/**
 * Neutral filter → MongoDB query document.
 *
 * Same closed vocabulary and same loud failure as `toPrismaWhere`, so a
 * filter that works on one backend cannot silently mean something else on
 * the other.
 */
export function toMongoFilter(filter = {}) {
  return translateMongoCondition(filter);
}
