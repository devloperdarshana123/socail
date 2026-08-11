// Neutral mutation DSL → backend-native write payload (Phase 7B, M-3).
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────
// M-1 removed Prisma's FILTER vocabulary from the application. The same leak
// existed on the write side: helpers author `{ commentsCount: { increment: 1 } }`
// and hand it to `repository.update(id, data)`. Prisma understands that as
// an atomic counter bump; Mongoose understands it as "set this field to the
// literal object `{ increment: 1 }`" — silently replacing an integer counter
// with a document. Every follower/like/save/view/comment counter in the app
// would be corrupted on a provider switch, with no error.
//
// Same design as filtering.js: a CLOSED, validated vocabulary. Operators
// whose spelling is already backend-neutral keep it; genuinely Prisma-only
// spellings are renamed; anything outside the whitelist THROWS at the
// repository boundary rather than reaching a driver that would misread it.
//
//     increment  →  inc         (Mongo: $inc)
//     decrement  →  dec         (Mongo: $inc with a negated value)
//     push       →  append      (Mongo: $push)
//     set        →  replace     (Mongo: $set — `set` alone is ambiguous:
//                                Prisma uses it for BOTH scalar-list
//                                replacement and explicit scalar assignment)
//     connect    →  link        (Mongo: assign the foreign key directly)
//
// ── POSTGRESQL BEHAVIOUR IS UNCHANGED ────────────────────────────────────
// Every mapping is a pure rename. `inc`/`dec` still emit Prisma's atomic
// `increment`/`decrement`, so the counter update remains a single atomic
// SQL operation, NOT a read-modify-write — that distinction is the whole
// reason these operators exist and it is preserved exactly.

/** Field-level mutation operators. A value object may only use these keys. */
const MUTATION_OPERATORS = {
  inc:     "increment",
  dec:     "decrement",
  append:  "push",
  replace: "set",
};

/** Relation-write operators, which take a different shape. */
const RELATION_OPERATORS = { link: "connect" };

export const NEUTRAL_MUTATIONS = [
  ...Object.keys(MUTATION_OPERATORS),
  ...Object.keys(RELATION_OPERATORS),
];

// Prisma spellings the DSL deliberately refuses, each with its replacement.
const PRISMA_HINTS = {
  increment:  "Use { inc: n }.",
  decrement:  "Use { dec: n }.",
  push:       "Use { append: value }.",
  set:        "Use { replace: array } for scalar lists; assign bare values directly.",
  connect:    "Use { link: id }.",
  disconnect: "Not supported by the neutral mutation DSL.",
  multiply:   "Not supported by the neutral mutation DSL.",
  divide:     "Not supported by the neutral mutation DSL.",
  unset:      "Not supported by the neutral mutation DSL.",
  connectOrCreate: "Not supported by the neutral mutation DSL.",
};

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

function reject(path, key) {
  throw new Error(
    `Unknown mutation operator "${key}" at "${path}". ` +
      `The neutral mutation DSL accepts: ${NEUTRAL_MUTATIONS.join(", ")}.` +
      (PRISMA_HINTS[key] ? ` ${PRISMA_HINTS[key]}` : "")
  );
}

/**
 * Neutral write payload → Prisma `data`.
 *
 * Throws on any operator outside the neutral vocabulary (M-3's core
 * guarantee): an un-translatable mutation fails loudly at the repository
 * boundary instead of silently corrupting a counter on another backend.
 */
export function toPrismaData(data = {}) {
  const out = {};

  for (const [field, value] of Object.entries(data ?? {})) {
    // Bare scalars, nulls, Dates and arrays are plain field assignments and
    // pass through untouched — the overwhelmingly common case.
    if (!isPlainObject(value)) {
      out[field] = value;
      continue;
    }

    const keys = Object.keys(value);

    // A JSON-column payload is an ordinary object whose keys are not
    // operators (e.g. `activeSuspension: { suspendedAt, reason, … }`).
    // Those must pass through as data, not be read as instructions.
    const isOperatorBag = keys.some(
      (k) => k in MUTATION_OPERATORS || k in RELATION_OPERATORS
    );
    if (!isOperatorBag) {
      // Guard: a REJECTED Prisma operator here means a stale call-site, not
      // a JSON payload — fail rather than write `{ increment: 1 }` as data.
      for (const k of keys) if (k in PRISMA_HINTS) reject(`${field}.${k}`, k);
      out[field] = value;
      continue;
    }

    const translated = {};
    for (const key of keys) {
      if (key in MUTATION_OPERATORS) {
        translated[MUTATION_OPERATORS[key]] = value[key];
      } else if (key in RELATION_OPERATORS) {
        // `{ link: id }` → `{ connect: { id } }`. An object is passed
        // through as the connect target so composite keys still work.
        translated[RELATION_OPERATORS[key]] =
          isPlainObject(value[key]) ? value[key] : { id: value[key] };
      } else {
        reject(field, key);
      }
    }
    out[field] = translated;
  }

  return out;
}

/**
 * Neutral write payload → Mongo update document.
 *
 * NOT wired anywhere yet — the Mongo implementations are still deferred.
 * Provided so the mapping lives beside its Prisma counterpart rather than
 * being reinvented later, and so NEUTRAL_MUTATIONS has one obvious place to
 * be satisfied. `dec` becomes `$inc` with a negated value, which is how
 * MongoDB expresses a decrement.
 */
export function toMongoUpdate(data = {}) {
  const $set = {};
  const $inc = {};
  const $push = {};

  for (const [field, value] of Object.entries(data ?? {})) {
    if (!isPlainObject(value)) { $set[field] = value; continue; }

    const keys = Object.keys(value);
    const isOperatorBag = keys.some(
      (k) => k in MUTATION_OPERATORS || k in RELATION_OPERATORS
    );
    if (!isOperatorBag) {
      // A JSON-column payload passes through as data — but Prisma's own
      // write vocabulary must NOT. Without this guard `{ inc: 1 }` spelled
      // `{ increment: 1 }` would be $set as a literal object, replacing an
      // integer counter with a document: precisely the M-3 defect, silently
      // reintroduced on the Mongo side. Caught by the translator-parity
      // suite, which requires both translators to reject the same spellings.
      for (const k of keys) if (k in PRISMA_HINTS) reject(`${field}.${k}`, k);
      $set[field] = value;
      continue;
    }

    for (const key of keys) {
      switch (key) {
        case "inc":     $inc[field]  = value[key];  break;
        case "dec":     $inc[field]  = -value[key]; break;
        case "append":  $push[field] = value[key];  break;
        case "replace": $set[field]  = value[key];  break;
        case "link":
          $set[field] = isPlainObject(value[key]) ? value[key].id : value[key];
          break;
        default: reject(field, key);
      }
    }
  }

  return {
    ...(Object.keys($set).length  ? { $set }  : {}),
    ...(Object.keys($inc).length  ? { $inc }  : {}),
    ...(Object.keys($push).length ? { $push } : {}),
  };
}

/**
 * Neutral write payload → a plain Mongo document for INSERT.
 *
 * `create` is not `update`: MongoDB has no operators on insert, so a
 * document is what is required — wrapping it in `$set` (as toMongoUpdate
 * does) would make `Model.create()` write a literal `{ $set: … }` field.
 *
 * Counter operators are therefore REJECTED here rather than silently
 * ignored: `{ likesCount: { inc: 1 } }` on a create is a caller mistake, and
 * on the Prisma side it is equally invalid. `link` IS accepted and collapses
 * to the foreign key, matching how the Mongo schemas store relations.
 */
export function toMongoDocument(data = {}) {
  const out = {};
  for (const [field, value] of Object.entries(data ?? {})) {
    if (!isPlainObject(value)) { out[field] = value; continue; }

    const keys = Object.keys(value);
    const isOperatorBag = keys.some(
      (k) => k in MUTATION_OPERATORS || k in RELATION_OPERATORS
    );
    if (!isOperatorBag) {
      for (const k of keys) if (k in PRISMA_HINTS) reject(`${field}.${k}`, k);
      out[field] = value;          // JSON-column payload
      continue;
    }

    for (const key of keys) {
      if (key === "link") {
        out[field] = isPlainObject(value[key]) ? value[key].id : value[key];
      } else if (key in MUTATION_OPERATORS) {
        throw new Error(
          `Mutation operator "${key}" at "${field}" is not valid on a create — ` +
            "insert takes plain values. Use it in an update instead."
        );
      } else {
        reject(field, key);
      }
    }
  }
  return out;
}
