// Validates the `coordinates` tuple of a GeoJSON Point: [lng, lat].
// `type: "Point"` itself is enforced natively via a Mongoose `enum` on
// that field (see geoLocation.schema.js) — this validator only checks the
// coordinate pair, which is the part MongoDB's 2dsphere index will
// silently ignore rather than reject if malformed. That silent-ignore
// behavior is exactly what a straight copy of Postgres's freeform location
// JSON would have missed (see the Phase 2 audit, Section E).
export function isValidGeoJSONCoordinates(value) {
  if (!Array.isArray(value) || value.length !== 2) return false;

  const [lng, lat] = value;
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (lng < -180 || lng > 180) return false;
  if (lat < -90 || lat > 90) return false;

  return true;
}

export const geoPointValidator = {
  validator: isValidGeoJSONCoordinates,
  message: (props) =>
    `${props.path} must be a [lng, lat] pair with lng in [-180,180] and lat in [-90,90]`,
};
