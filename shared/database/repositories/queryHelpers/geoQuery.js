// Geospatial "near"/"within radius" queries. PostgreSQL/Prisma has no
// native geo support in the current schema (locations were freeform JSON —
// see the Phase 1/2 audits), so this is intentionally MongoDB-only; the
// Prisma side of any repository using this throws NotFoundError-adjacent
// guidance instead of silently returning an empty/wrong result — see each
// repository's `findNear()`.
export function toMongoNearFilter({ lng, lat, maxDistanceMeters = 50000 }, field = "coordinates") {
  return {
    [field]: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: maxDistanceMeters,
      },
    },
  };
}

export function toMongoGeoWithinFilter(polygonCoordinates, field = "coordinates") {
  return {
    [field]: { $geoWithin: { $geometry: { type: "Polygon", coordinates: polygonCoordinates } } },
  };
}
