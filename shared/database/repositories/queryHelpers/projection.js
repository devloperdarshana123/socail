// Normalizes a generic `["field1", "field2"]` (include) or
// `{ exclude: ["field3"] }` projection spec into each backend's shape.
export function toPrismaSelect(fields) {
  if (!fields) return undefined;
  if (Array.isArray(fields)) {
    return Object.fromEntries(fields.map((f) => [f, true]));
  }
  return undefined; // Prisma has no native exclude-projection; select only
}

export function toMongoProjection(fields) {
  if (!fields) return undefined;
  if (Array.isArray(fields)) {
    return fields.join(" ");
  }
  if (fields.exclude) {
    return fields.exclude.map((f) => `-${f}`).join(" ");
  }
  // Prisma's object form, `{ id: true, username: true }`. This used to fall
  // through to `undefined`, which mongoose reads as "no projection" — so
  // every include/populate that passed an object select was quietly fetching
  // whole documents. Not a wrong ANSWER, but it made the two backends return
  // different shapes from the same call, and it hid over-fetching.
  //
  // Nested relation selects (a value that is itself an object) are skipped:
  // those are joins, and joins are each repository method's problem, not a
  // projection's. `id` maps to `_id` for the reason given in toMongoFilter.
  const scalar = Object.entries(fields)
    .filter(([, v]) => v === true)
    .map(([k]) => (k === "id" ? "_id" : k));
  return scalar.length ? scalar.join(" ") : undefined;
}
