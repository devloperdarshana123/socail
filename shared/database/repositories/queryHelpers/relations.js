// Relation reads on MongoDB — the ONE implementation of the author/user
// block that 18 call-sites across seven helpers ask for.
//
// ── THE PROBLEM ──────────────────────────────────────────────────────────
// Postgres answers a relation filter and a relation projection in the same
// join:
//
//   where:  { author: { accountStatus: { not: "deactivated" } } }
//   select: { caption: true, author: { select: { username: true, … } } }
//
// Mongo's find() has neither. `populate()` covers the projection half but
// NOT the filter half: `populate({ match })` nulls the child on a
// non-matching row, it does not remove the PARENT row, so a filtered feed
// would still return the post with `author: null`. Getting both requires an
// aggregation — $lookup, $unwind, then $match on the joined fields.
//
// ── WHY IT LIVES HERE ────────────────────────────────────────────────────
// Written once, in the query-helper layer, rather than 18 times in the
// repositories. Each repository supplies only what is specific to it — which
// collection to join, on which local field, under which name — and this
// module owns the pipeline shape, the dotted-path rewriting and the
// projection translation. A second relation (a report's `reporter`, a
// message's `sender`) is a call with different arguments, not a new
// implementation.
//
// ── WHY NOT DENORMALISE THE AUTHOR ONTO THE POST ─────────────────────────
// An embedded author snapshot would remove the join entirely, but it makes
// every username, avatar or verification-badge change a fan-out write across
// that user's whole post history — and those fields DO change. The join is
// paid on read, against an indexed _id, and only on the endpoints that ask
// for an author.
import { toMongoFilter } from "./filtering.js";

/**
 * Split a neutral filter into its own-collection part and its relation parts.
 *
 *   splitRelationFilter({ isDeleted: false, author: { role: … } }, ["author"])
 *     → { own: { isDeleted: false }, relations: { author: { role: … } } }
 *
 * Relation keys are named explicitly by the caller rather than guessed: the
 * translator's own header records that `{ author: { role: "x" } }` and a
 * typo'd operator are structurally identical, and only the repository knows
 * which of its filter keys are relations.
 */
export function splitRelationFilter(filter = {}, relationKeys = []) {
  const own = {};
  const relations = {};
  for (const [k, v] of Object.entries(filter ?? {})) {
    if (relationKeys.includes(k)) relations[k] = v;
    else own[k] = v;
  }
  return { own, relations };
}

/** Rewrite a translated filter's keys onto a joined path: a → "author.a". */
function underPath(prefix, translated) {
  const out = {};
  for (const [k, v] of Object.entries(translated)) {
    // $or/$and keep their operator name and have their branches rewritten.
    if (k === "$or" || k === "$and") {
      out[k] = v.map((branch) => underPath(prefix, branch));
      continue;
    }
    out[`${prefix}.${k}`] = v;
  }
  return out;
}

/**
 * Translate a neutral `select` into an aggregation $project.
 *
 * Differs from toMongoProjection (which produces a mongoose field string)
 * because an aggregation has to MAP `id` onto `$_id` rather than just include
 * a field — aggregate() output does not run the jsonTransform plugin that
 * gives documents their `id`, and every caller reads `.id`.
 *
 * A nested `{ relation: { select: {…} } }` becomes a sub-object built from
 * the joined path.
 */
export function toAggregateProjection(select, relationKeys = []) {
  if (!select) return null;
  const project = {};
  for (const [key, value] of Object.entries(select)) {
    if (relationKeys.includes(key)) {
      const sub = {};
      for (const [f, on] of Object.entries(value?.select ?? {})) {
        if (on === true) sub[f] = f === "id" ? `$${key}._id` : `$${key}.${f}`;
      }
      if (Object.keys(sub).length) project[key] = sub;
      continue;
    }
    if (value === true) project[key] = key === "id" ? "$_id" : 1;
  }
  return Object.keys(project).length ? project : null;
}

/**
 * Build the $lookup/$unwind/$match stages for one relation.
 *
 * `required: false` keeps rows whose relation is missing (a LEFT JOIN), which
 * is what Prisma does for an optional relation. When the relation is being
 * FILTERED on, a missing relation cannot satisfy the predicate anyway, so the
 * unwind drops it either way.
 */
export function relationStages({ as, from, localField, foreignField = "_id", filter, required = false }) {
  const stages = [
    { $lookup: { from, localField, foreignField, as } },
    { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: !required && !filter } },
  ];
  if (filter) stages.push({ $match: underPath(as, toMongoFilter(filter)) });
  return stages;
}

/**
 * The whole read: own filter → sort → join(s) → relation filter → page →
 * project.
 *
 * Stage ORDER is the point of this function. $sort must precede $limit or the
 * page is arbitrary; $limit must FOLLOW the relation $match or a filtered-out
 * row consumes a slot and the page comes back short. Getting that wrong is
 * silent — you get plausible-looking pages that are subtly incomplete — so it
 * is decided here once rather than at each call site.
 */
export function relationPipeline({ match, sort, relations = [], skip, limit, project }) {
  const pipeline = [];
  if (match && Object.keys(match).length) pipeline.push({ $match: match });
  if (sort) pipeline.push({ $sort: sort });
  for (const r of relations) pipeline.push(...relationStages(r));
  if (skip) pipeline.push({ $skip: skip });
  if (limit !== undefined && limit !== null) pipeline.push({ $limit: limit });
  if (project) pipeline.push({ $project: project });
  return pipeline;
}
