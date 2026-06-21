import { bouwBboxParam, haalWfsJson } from './wfsClient.js';

// Komt overeen met detecteerPerceel() uit docs/index.html — PDOK Kadastrale
// Kaart WFS, kleine bbox rond het punt, eerste perceel binnen die bbox.
export async function zoekPerceelPDOK(lat, lng) {
  const bbox = bouwBboxParam(lat, lng, 0.0002);
  const url = `https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=kadastralekaart:Perceel&outputFormat=application/json&srsName=EPSG:4326&BBOX=${bbox}&count=1`;

  const data = await haalWfsJson(url);
  if (!data?.features?.length) return null;

  const props = data.features[0].properties;
  const gemeente = props.AKRKadastraleGemeenteCode || props.kadastralegemeentecode || '';
  const sectie = props.sectie || '';
  const nummer = props.perceelnummer || '';
  const perceelId = `${gemeente}${sectie}-${nummer}`.toUpperCase().replace(/^-|-$/g, '');
  return perceelId || null;
}
