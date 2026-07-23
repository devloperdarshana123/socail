// Maps a `dateRange` query param onto a Prisma `createdAt` filter.
// Buckets mirror the admin UI (and client/src/utils/dateBuckets.js):
//   today  → since local midnight
//   week   → since Sunday of the current week
//   month  → since the 1st of the current month
//   older  → strictly before the 1st of the current month
// Returns null for missing/unknown values so callers can skip the filter.
export function dateRangeToCreatedAt(dateRange) {
  if (!dateRange) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (dateRange) {
    case "today": return { gte: startOfToday };
    case "week":  return { gte: startOfWeek };
    case "month": return { gte: startOfMonth };
    case "older": return { lt: startOfMonth };
    default:      return null;
  }
}
