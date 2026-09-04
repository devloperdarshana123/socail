// Free-text search across one or more fields — case-insensitive substring
// match on Prisma (no full-text index in the current Postgres schema),
// MongoDB `$text` search on Mongo (backed by the text indexes declared in
// Milestone 2's ../../mongodb/indexes/*.indexes.js).
export function toPrismaSearchWhere(term, fields = []) {
  if (!term || fields.length === 0) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: term, mode: "insensitive" } })) };
}

export function toMongoSearchFilter(term) {
  if (!term) return undefined;
  return { $text: { $search: term } };
}
