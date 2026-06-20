import { haversineAfstand } from '../geo/haversine.js';
import { polygonCentroid } from '../geo/polygonCentroid.js';

const BAG_TYPE_MAP = {
  onderwijsfunctie: '🏫 School/onderwijsinstelling',
  gezondheidszorgfunctie: '🏥 Zorginstelling',
  sportfunctie: '⚽ Sportaccommodatie'
};

const OSM_TYPE_MAP = {
  playground: '🛝 Speeltuin',
  recreation_ground: '🌳 Recreatiegebied',
  park: '🌳 Park',
  school: '🏫 School',
  kindergarten: '🏫 Kinderdagverblijf',
  hospital: '🏥 Ziekenhuis',
  clinic: '🏥 Kliniek/huisartspraktijk',
  nursing_home: '🏥 Verpleeghuis'
};

async function zoekBagKwetsbareGebouwen(lat, lng) {
  const delta = 0.003;
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta},EPSG:4326`;
  const url = `https://service.pdok.nl/lv/bag/wfs/v2_0?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=bag:pand&outputFormat=application/json&srsName=EPSG:4326&BBOX=${bbox}&count=100`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const text = await res.text();
  if (!text.trim().startsWith('{')) return [];

  const data = JSON.parse(text);
  const gevonden = [];
  const gezienTypes = new Set();

  (data.features || []).forEach((f) => {
    const doel = f.properties?.gebruiksdoel;
    if (!doel || !BAG_TYPE_MAP[doel] || gezienTypes.has(doel)) return;
    const geom = f.geometry;
    const centroid = geom?.type === 'Polygon'
      ? polygonCentroid(geom.coordinates)
      : { lat: geom?.coordinates?.[1], lng: geom?.coordinates?.[0] };
    if (!centroid?.lat) return;
    const afst = Math.round(haversineAfstand(lat, lng, centroid.lat, centroid.lng));
    const coord = `${centroid.lat.toFixed(5)}°N · ${centroid.lng.toFixed(5)}°E`;
    gevonden.push(`${BAG_TYPE_MAP[doel]} — ${afst}m · 📍 ${coord}`);
    gezienTypes.add(doel);
  });

  return gevonden;
}

async function zoekOsmKwetsbareLocaties(lat, lng) {
  const query = `[out:json][timeout:8];(
    node["amenity"="playground"](around:300,${lat},${lng});
    way["amenity"="playground"](around:300,${lat},${lng});
    node["leisure"="playground"](around:300,${lat},${lng});
    way["leisure"="playground"](around:300,${lat},${lng});
    way["leisure"="recreation_ground"](around:300,${lat},${lng});
    way["leisure"="park"](around:200,${lat},${lng});
    node["amenity"="school"](around:300,${lat},${lng});
    node["amenity"="kindergarten"](around:300,${lat},${lng});
    node["amenity"="hospital"](around:300,${lat},${lng});
    node["amenity"="clinic"](around:300,${lat},${lng});
    node["amenity"="nursing_home"](around:300,${lat},${lng});
  );out center;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
  if (!res.ok) return [];
  const data = await res.json();

  const gevonden = [];
  const gezienTypes = new Set();
  (data.elements || []).forEach((el) => {
    const tags = el.tags || {};
    const type = tags.amenity || tags.leisure;
    if (!type || !OSM_TYPE_MAP[type] || gezienTypes.has(OSM_TYPE_MAP[type])) return;
    const naam = tags.name ? ` — ${tags.name}` : '';
    const elLat = el.lat || el.center?.lat;
    const elLng = el.lon || el.center?.lon;
    const afst = elLat && elLng ? ` — ${Math.round(haversineAfstand(lat, lng, elLat, elLng))}m` : '';
    const coord = elLat && elLng ? ` · 📍 ${elLat.toFixed(5)}°N · ${elLng.toFixed(5)}°E` : '';
    gevonden.push(`${OSM_TYPE_MAP[type]}${naam}${afst}${coord}`);
    gezienTypes.add(OSM_TYPE_MAP[type]);
  });

  return gevonden;
}

// Komt overeen met het kwetsbare-locaties-deel van detecteerAfstandEnNatura2000()
// uit docs/index.html — BAG-gebouwen (onderwijs/zorg/sport, 300m) + OSM
// Overpass (speeltuinen/parken/scholen/zorg, 300m). Faalt een van de twee
// bronnen, dan wordt alleen de andere meegenomen (zelfde gedrag als bron).
export async function zoekKwetsbareLocaties(lat, lng) {
  const [bag, osm] = await Promise.all([
    zoekBagKwetsbareGebouwen(lat, lng).catch(() => []),
    zoekOsmKwetsbareLocaties(lat, lng).catch(() => [])
  ]);
  return [...bag, ...osm];
}
