// PDOK "Ruimtelijke Plannen" WMS — bestemmingsplan-bestemming (Agrarisch,
// Wonen, etc.) per coordinaat. Dit is GEEN WFS zoals de andere lib/pdok/-
// bestanden: PDOK biedt voor dit dataset alleen WMS aan (zie
// pdok.nl/ogc-webservices/-/article/ruimtelijke-plannen), dus de opzoeking
// gebeurt via GetFeatureInfo op een 1x1-conceptuele "kaart" rond het punt
// i.p.v. een GetFeature-bbox-query.
//
// CRS:84 i.p.v. EPSG:4326 — WMS 1.3.0 gebruikt voor EPSG:4326 BBOX-as-volgorde
// lat,lon (conform de OGC-spec), wat hier juist tot verwarring zou leiden;
// CRS:84 is hetzelfde datum maar met lon,lat-volgorde, zoals de WFS-bboxen
// elders in dit project.
const LAAG = 'enkelbestemming';

export async function haalBestemming(lat, lng) {
  const delta = 0.0005;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url = `https://service.pdok.nl/kadaster/ruimtelijke-plannen/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${LAAG}&QUERY_LAYERS=${LAAG}&STYLES=&CRS=CRS:84&BBOX=${bbox}&WIDTH=101&HEIGHT=101&I=50&J=50&INFO_FORMAT=application/json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    if (!props) return null;
    return { hoofdgroep: props.bestemmingshoofdgroep || null, naam: props.naam || null };
  } catch (err) {
    console.warn('[bestemming] PDOK ruimtelijke-plannen niet beschikbaar:', err.message);
    return null;
  }
}
