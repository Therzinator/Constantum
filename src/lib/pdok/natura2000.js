import { polygonCentroid } from '../geo/polygonCentroid.js';
import { bouwBboxParam, haalWfsJson } from './wfsClient.js';

// Komt overeen met het Natura2000-deel van detecteerAfstandEnNatura2000()
// uit docs/index.html — checkt op Natura 2000-gebieden binnen 500m.
export async function zoekNatura2000InDeBuurt(lat, lng) {
  const bbox = bouwBboxParam(lat, lng, 0.005);
  const url = `https://service.pdok.nl/rvo/natura2000/wfs/v1_0?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=natura2000:natura2000&outputFormat=application/json&srsName=EPSG:4326&BBOX=${bbox}&count=1`;

  const data = await haalWfsJson(url);
  if (!data?.features?.length) return null;

  const feat = data.features[0];
  const naam = feat.properties?.naam || feat.properties?.NAAM || 'Natura 2000-gebied';

  let n2000Lat = null;
  let n2000Lng = null;
  if (feat.geometry?.type === 'Polygon') {
    const c = polygonCentroid(feat.geometry.coordinates);
    n2000Lat = c.lat;
    n2000Lng = c.lng;
  } else if (feat.geometry?.type === 'MultiPolygon') {
    const c = polygonCentroid(feat.geometry.coordinates[0]);
    n2000Lat = c.lat;
    n2000Lng = c.lng;
  } else if (feat.geometry?.type === 'Point') {
    n2000Lng = feat.geometry.coordinates[0];
    n2000Lat = feat.geometry.coordinates[1];
  }

  return { naam, lat: n2000Lat, lng: n2000Lng };
}
