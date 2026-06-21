import GeoJSON from 'ol/format/GeoJSON.js';
import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import { registreerRDNew } from '../ol/projecties.js';

const PERCEEL_STIJL = new Style({
  stroke: new Stroke({ color: '#00d4aa', width: 1.5, lineDash: [6, 4] }),
  fill: new Fill({ color: 'rgba(0,212,170,0.05)' })
});

// Komt overeen met zoekPerceelPDOK() in perceel.js, maar haalt hier alle
// percelen binnen de bbox als vectorlaag op (perceelgrenzen), i.p.v. één
// enkel perceel-ID. PDOK levert dit WFS-endpoint in EPSG:28992 (RD New) —
// we reprojecteren clientside naar de kaartprojectie (EPSG:3857).
export async function haalPerceelgrenzen(lat, lng, deltaGraden = 0.001) {
  registreerRDNew();
  const delta = deltaGraden;
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta},EPSG:4326`;
  const url = `https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=kadastralekaart:Perceel&outputFormat=application/json&srsName=EPSG:28992&BBOX=${bbox}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith('{')) return null;

  const format = new GeoJSON();
  const features = format.readFeatures(text, {
    dataProjection: 'EPSG:28992',
    featureProjection: 'EPSG:3857'
  });
  if (!features.length) return null;

  return features;
}

// Vectorlaag met perceelgrenzen — leeg totdat vulPerceelgrenzenLaag() de
// features ophaalt en erin zet. Zo kan de laag al bij kaart-init worden
// toegevoegd en later (bij elke locatiewijziging) hervuld worden.
export function maakPerceelgrenzenLaag() {
  return new VectorLayer({ source: new VectorSource(), style: PERCEEL_STIJL, zIndex: 5 });
}

export async function vulPerceelgrenzenLaag(laag, lat, lng) {
  const source = laag.getSource();
  source.clear();
  const features = await haalPerceelgrenzen(lat, lng).catch((err) => {
    console.warn('[perceelLaag] WFS-perceelgrenzen niet beschikbaar:', err.message);
    return null;
  });
  if (features) source.addFeatures(features);
}
