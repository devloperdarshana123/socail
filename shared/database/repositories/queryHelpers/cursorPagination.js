// Cursor pagination — for high-volume, append-mostly collections (messages,
// notifications, audit logs) where offset pagination degrades at depth.
// Cursor is the string form of the last-seen document's sort field (id or
// createdAt); backends interpret it differently, so this only normalizes
// the *inputs*, not the query itself.
export function normalizeCursor({ cursor = null, limit = 20, maxLimit = 100 } = {}) {
  return { cursor, limit: Math.max(1, Math.min(Number(limit) || 20, maxLimit)) };
}

export function toPrismaCursorArgs({ cursor, limit }, { cursorField = "id" } = {}) {
  const args = { take: limit };
  if (cursor) {
    args.cursor = { [cursorField]: cursor };
    args.skip = 1; // skip the cursor doc itself
  }
  return args;
}

export function toMongoCursorFilter({ cursor, limit }, { cursorField = "_id", direction = "desc" } = {}) {
  const op = direction === "desc" ? "$lt" : "$gt";
  const filter = cursor ? { [cursorField]: { [op]: cursor } } : {};
  return { filter, limit };
}

export function buildCursorResult({ docs, limit, cursorField = "id" }) {
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(page[page.length - 1][cursorField]) : null;
  return { docs: page, nextCursor, hasMore };
}
