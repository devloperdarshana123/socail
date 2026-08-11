// Merges an "exclude soft-deleted records" condition into a filter.
// Opt-in — callers decide per-query whether deleted records should be
// visible (e.g. admin moderation views intentionally include them),
// matching Milestone 2's softDeletePlugin design (no silent default).
export function withNotDeleted(filter = {}, { includeDeleted = false } = {}) {
  if (includeDeleted) return filter;
  return { ...filter, isDeleted: false };
}
