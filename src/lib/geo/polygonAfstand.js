// Kortste afstand (in meters) van een punt tot de RAND van een GeoJSON-
// polygon (niet tot het centroïde) — voor panden geeft dit de afstand tot
// de dichtstbijzijnde muur in plaats van tot het midden van het gebouw, wat
// bij langwerpige of grote panden een fors verschil kan maken.
//
// Projecteert lokaal naar meters rond het referentiepunt (equirectangular
// benadering — nauwkeurig genoeg op de schaal van enkele honderden meters)
// en berekent per polygon-randsegment de loodrechte afstand.
function naarLokaalXY(lat, lng, lat0, lng0) {
  const x = (lng - lng0) * 111320 * Math.cos((lat0 * Math.PI) / 180);
  const y = (lat - lat0) * 110540;
  return [x, y];
}

function afstandPuntTotSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengteKwadraat = dx * dx + dy * dy;
  if (lengteKwadraat === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lengteKwadraat;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// `coordinates` is GeoJSON Polygon.coordinates: een array van ringen, elke
// ring een array van [lng, lat]-paren. Alleen de buitenring (index 0) telt —
// gaten (binnenplaatsen) zijn niet relevant voor "hoe dicht staat dit punt
// bij dit gebouw" omdat het meldpunt zelf buiten het pand ligt.
export function afstandTotPolygonRand(lat, lng, coordinates) {
  const buitenring = coordinates?.[0];
  if (!buitenring || buitenring.length < 2) return null;

  let minAfstand = Infinity;
  for (let i = 0; i < buitenring.length - 1; i++) {
    const [aLng, aLat] = buitenring[i];
    const [bLng, bLat] = buitenring[i + 1];
    const [ax, ay] = naarLokaalXY(aLat, aLng, lat, lng);
    const [bx, by] = naarLokaalXY(bLat, bLng, lat, lng);
    const d = afstandPuntTotSegment(0, 0, ax, ay, bx, by);
    if (d < minAfstand) minAfstand = d;
  }
  return minAfstand;
}
