// Normalizes a generic `{ field, direction }` (or `"-field"` shorthand)
// sort spec into each backend's native shape.
export function normalizeSort(sort = { field: "createdAt", direction: "desc" }) {
  if (typeof sort === "string") {
    const desc = sort.startsWith("-");
    return { field: desc ? sort.slice(1) : sort, direction: desc ? "desc" : "asc" };
  }
  return { field: sort.field ?? "createdAt", direction: sort.direction === "asc" ? "asc" : "desc" };
}

export function toPrismaOrderBy(sort) {
  const { field, direction } = normalizeSort(sort);
  return { [field]: direction };
}

// `id` → `_id` for the same reason toMongoFilter does it: the neutral DSL
// names the primary key `id`, MongoDB names it `_id`, and mongoose drops sort
// keys it cannot resolve.
const sortPath = (field) => (field === "id" ? "_id" : field);

export function toMongoSort(sort) {
  // COMPOUND SORTS. Callers also pass Prisma's array form —
  // `[{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }]` — which
  // Prisma applies in order. normalizeSort() reads an array as a plain object,
  // finds no `.field`, and fell back to `{ createdAt: -1 }`: the pin ordering
  // and the id tiebreaker were both dropped, silently. A comment list would
  // come back with pinned comments unpinned and, because the tiebreaker went
  // with them, a page window that shifts between requests.
  if (Array.isArray(sort)) {
    const out = {};
    for (const clause of sort) {
      if (!clause) continue;
      for (const [field, direction] of Object.entries(clause)) {
        out[sortPath(field)] = direction === "asc" ? 1 : -1;
      }
    }
    return Object.keys(out).length ? out : { createdAt: -1 };
  }

  // Prisma's single-object form, `{ createdAt: "desc" }`, is not the neutral
  // `{ field, direction }` shape either — normalizeSort would read it as
  // having no `.field` and default the same way. One key, one direction.
  if (sort && typeof sort === "object" && !("field" in sort) && !("direction" in sort)) {
    const entries = Object.entries(sort);
    if (entries.length) {
      const out = {};
      for (const [field, direction] of entries) out[sortPath(field)] = direction === "asc" ? 1 : -1;
      return out;
    }
  }

  const { field, direction } = normalizeSort(sort);
  return { [sortPath(field)]: direction === "asc" ? 1 : -1 };
}
