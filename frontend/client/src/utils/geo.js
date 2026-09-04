// Same lat/lng <-> 3D convention ThreeGlobe uses internally (getCoords / toGeoCoords).

export function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (90 - lng) * (Math.PI / 180);
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function vector3ToLatLng({ x, y, z }) {
  const radius = Math.sqrt(x * x + y * y + z * z);
  const phi = Math.acos(y / radius);
  const theta = Math.atan2(z, x);
  return {
    lat: 90 - phi * (180 / Math.PI),
    lng: 90 - theta * (180 / Math.PI),
  };
}

// Ray-casting point-in-polygon test. `ring` is an array of [lng, lat] pairs
// (GeoJSON coordinate order). Counts edge crossings of a rightward ray from
// the point; odd crossing count = inside.
function isPointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// A GeoJSON Polygon's coordinates are [ring, ring, ...] — ring 0 is the
// outer boundary, any further rings are holes to subtract.
function isPointInPolygonGeometry(lat, lng, geometry) {
  if (geometry.type === "Polygon") {
    const [outer, ...holes] = geometry.coordinates;
    if (!isPointInRing(lng, lat, outer)) return false;
    return !holes.some((hole) => isPointInRing(lng, lat, hole));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some(([outer, ...holes]) => {
      if (!isPointInRing(lng, lat, outer)) return false;
      return !holes.some((hole) => isPointInRing(lng, lat, hole));
    });
  }
  return false;
}

// Returns the first GeoJSON Feature whose geometry contains (lat, lng), or null.
export function findFeatureAtLatLng(lat, lng, features) {
  return features.find((f) => isPointInPolygonGeometry(lat, lng, f.geometry)) || null;
}
