// Buckets an already-loaded page of items into display groups by date.
// This is a display grouping over whatever page is currently loaded — it does
// not replace server-side date filtering (use createdAfter/createdBefore
// query params against the API for a true "jump to this month" filter).
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
