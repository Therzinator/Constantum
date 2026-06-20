import { haversineAfstand } from '../geo/haversine.js';
import { polygonCentroid } from '../geo/polygonCentroid.js';

// Komt overeen met het BAG-woning-deel van detecteerAfstandEnNatura2000()
// uit docs/index.html (zie lib/pdok/natura2000.js en
// lib/pdok/kwetsbareLocaties.js voor de overige delen van die functie).
// Zoekt panden met woonfunctie binnen 300m en geeft de dichtstbijzijnde terug.
export async function zoekDichtstbijzijndeWoning(lat, lng) {
  const delta = 0.003;
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta},EPSG:4326`;
  const url = `https://service.pdok.nl/lv/bag/wfs/v2_0?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=bag:pand&outputFormat=application/json&srsName=EPSG:4326&BBOX=${bbox}&count=50`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith('{')) return null;

  const data = JSON.parse(text);
  // PDOK's bag:pand-laag geeft `gebruiksdoel` als kommagescheiden lijst terug
  // (bv. "bijeenkomstfunctie,winkelfunctie,woonfunctie") omdat één pand
  // meerdere functies kan hebben — een pand telt al mee zodra woonfunctie
  // ergens in die lijst voorkomt, ook bij gemengd gebruik.
  const woningen = (data.features || []).filter((f) =>
    (f.properties?.gebruiksdoel || '').split(',').includes('woonfunctie')
  );
  if (!woningen.length) return null;

  let minAfstand = Infinity;
  let woningLat = null;
  let woningLng = null;

  for (const f of woningen) {
    const geom = f.geometry;
    if (!geom) continue;
    let pandLat;
    let pandLng;
    if (geom.type === 'Polygon') {
      const c = polygonCentroid(geom.coordinates);
      pandLat = c.lat;
      pandLng = c.lng;
    } else if (geom.type === 'Point') {
      pandLng = geom.coordinates[0];
      pandLat = geom.coordinates[1];
    } else {
      continue;
    }
    const d = haversineAfstand(lat, lng, pandLat, pandLng);
    if (d < minAfstand) {
      minAfstand = d;
      woningLat = pandLat;
      woningLng = pandLng;
    }
  }

  if (woningLat == null) return null;
  return { afstandM: Math.round(minAfstand), lat: woningLat, lng: woningLng };
}
