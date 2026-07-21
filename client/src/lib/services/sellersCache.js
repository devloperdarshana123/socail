// Short-lived client cache for map-sellers results, keyed by the filter
// combination that produced them — avoids refetching on repeated
// category/search toggling within the TTL window.
const cache = new Map(); // key -> { data, expiresAt }
const TTL_MS = 60_000;
const MAX_ENTRIES = 50;

export function getCachedSellers(key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedSellers(key, data) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}
