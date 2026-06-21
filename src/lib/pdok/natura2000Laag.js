import GeoJSON from 'ol/format/GeoJSON.js';
import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';

const NATURA2000_STIJL = new Style({
  stroke: new Stroke({ color: '#22c55e', width: 1.5 }),
  fill: new Fill({ color: 'rgba(34,197,94,0.12)' })
});

// Zelfde WFS-endpoint als zoekNatura2000InDeBuurt() in natura2000.js, maar
// haalt hier alle gebieden binnen de huidige kaart-bbox op als polygonen
// i.p.v. één centroid. PDOK levert dit endpoint direct in EPSG:4326, dus
// (anders dan de kadastrale kaart) is geen RD New-reprojectie nodig.
export async function haalNatura2000Gebieden(extentLonLat) {
  const [minLng, minLat, maxLng, maxLat] = extentLonLat;
  const bbox = `${minLat},${minLng},${maxLat},${maxLng},EPSG:4326`;
  const url = `https://service.pdok.nl/rvo/natura2000/wfs/v1_0?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=natura2000:natura2000&outputFormat=application/json&srsName=EPSG:4326&BBOX=${bbox}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith('{')) return null;

  const format = new GeoJSON();
  return format.readFeatures(text, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
}

export function maakNatura2000Laag() {
  return new VectorLayer({ source: new VectorSource(), style: NATURA2000_STIJL, visible: false, zIndex: 4 });
}

// Vult de laag op basis van het huidige kaartbeeld (extent in lon/lat) —
// bedoeld om bij 'moveend' van de dashboardkaart opnieuw aangeroepen te worden.
export async function vulNatura2000Laag(laag, extentLonLat) {
  const source = laag.getSource();
  const features = await haalNatura2000Gebieden(extentLonLat).catch((err) => {
    console.warn('[natura2000Laag] WFS niet beschikbaar:', err.message);
    return null;
  });
  source.clear();
  if (features) source.addFeatures(features);
}
