// Buckets an already-loaded page of items into display groups by date.
// Mirrors frontend/client/src/utils/dateBuckets.js — keep the two in sync.
// This is a display grouping over whatever page is currently loaded — it does
// not replace server-side date filtering (see the `dateRange` query param /
// backend/src/utils/dateRange.js for a true "only load this month" filter).
export function bucketByDate(items, dateField = "createdAt") {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const buckets = { today: [], thisWeek: [], thisMonth: [], older: [] };

  for (const item of items) {
    const d = new Date(item[dateField]);
    if (d >= startOfToday) buckets.today.push(item);
    else if (d >= startOfWeek) buckets.thisWeek.push(item);
    else if (d >= startOfMonth) buckets.thisMonth.push(item);
    else buckets.older.push(item);
  }
  return buckets;
}

export const DATE_BUCKET_LABELS = {
  today: "Today",
  thisWeek: "This Week",
  thisMonth: "This Month",
  older: "Older",
};

// Iteration order for rendering section headers — reversed when the list is
// sorted oldest-first so headers still read top-to-bottom with the data.
export function dateBucketOrder(sortOrder = "desc") {
  const order = ["today", "thisWeek", "thisMonth", "older"];
  return sortOrder === "asc" ? [...order].reverse() : order;
}
