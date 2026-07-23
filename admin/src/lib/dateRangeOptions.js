// Shared date-range filter options for admin list pages.
// Values map to the `dateRange` query param handled by
// server/src/utils/dateRange.js — keep the two in sync.
export const DATE_RANGE_OPTIONS = [
  { value: "",      label: "All Time"   },
  { value: "today", label: "Today"      },
  { value: "week",  label: "This Week"  },
  { value: "month", label: "This Month" },
  { value: "older", label: "Older"      },
];
