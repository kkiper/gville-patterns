// Fetch = open-water distance from a point in a given direction.
import { destination, pointInPolygon } from './geo.js';

// polygons: [outer, ...holes][] in GeoJSON [lng,lat] order. Water = inside some
// polygon's outer ring and none of that polygon's holes (overlaps stay water).
export function isWater(pt, polygons) {
  return polygons.some(([outer, ...holes]) => pointInPolygon(pt, outer) && !holes.some((h) => pointInPolygon(pt, h)));
}

export function fetchMiles(center, bearingDeg, polygons, stepMi = 0.05, maxMi = 8) {
  if (!isWater(center, polygons)) return 0;
  let d = 0;
  while (d + stepMi <= maxMi + 1e-9) {
    if (!isWater(destination(center, bearingDeg, d + stepMi), polygons)) return d;
    d += stepMi;
  }
  return maxMi;
}

// GeoJSON Polygon/MultiPolygon/Feature/FeatureCollection -> polygons [outer, ...holes][].
export function polygonsFromGeoJSON(gj) {
  if (!gj) return [];
  if (gj.type === 'FeatureCollection') return gj.features.flatMap((f) => polygonsFromGeoJSON(f.geometry));
  if (gj.type === 'Feature') return polygonsFromGeoJSON(gj.geometry);
  if (gj.type === 'Polygon') return [gj.coordinates];
  if (gj.type === 'MultiPolygon') return gj.coordinates;
  return [];
}
