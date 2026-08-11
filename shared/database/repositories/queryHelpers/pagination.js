// Offset pagination — shared math, backend-specific application.
export function normalizePagination({ page = 1, limit = 20, maxLimit = 100 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, maxLimit));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

export function toPrismaPagination(pagination) {
  const { page, limit, skip } = normalizePagination(pagination);
  return { skip, take: limit, page, limit };
}

export function toMongoPagination(pagination) {
  const { page, limit, skip } = normalizePagination(pagination);
  return { skip, limit, page };
}

export function buildPaginatedResult({ docs, total, page, limit }) {
  return { docs, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
