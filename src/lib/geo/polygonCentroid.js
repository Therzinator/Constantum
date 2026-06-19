export function polygonCentroid(coords) {
  const ring = coords[0];
  let lat = 0, lng = 0;
  ring.forEach(([x, y]) => { lng += x; lat += y; });
  return { lat: lat / ring.length, lng: lng / ring.length };
}
