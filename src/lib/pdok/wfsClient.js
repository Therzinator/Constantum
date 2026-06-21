// Gedeelde basis voor alle PDOK-WFS-aanroepen (kadastrale percelen,
// Natura2000) — perceel.js/perceelLaag.js en natura2000.js/natura2000Laag.js
// deden voorheen elk hun eigen fetch + bbox-opbouw + "is dit eigenlijk
// geldige JSON"-check tegen dezelfde soort endpoints.
//
// Bewust GEEN OpenLayers-import hier: perceel.js/natura2000.js (de
// single-lookup-varianten) worden ook gebruikt tijdens het invullen van een
// melding (useNieuweMeldingForm.js), op een pad dat niet lazy-geladen wordt
// (zie MeldingForm.jsx) — een OL-afhankelijkheid hier zou de hoofdbundel
// weer onnodig vergroten. De *Laag.js-varianten parsen zelf met
// ol/format/GeoJSON.js (nodig voor de RD New-reprojectie) en gebruiken
// hier alleen haalWfsText()/bouwBboxParamVanExtent().

export function bouwBboxParam(lat, lng, delta, crs = 'EPSG:4326') {
  return `${lat - delta},${lng - delta},${lat + delta},${lng + delta},${crs}`;
}

export function bouwBboxParamVanExtent([minLng, minLat, maxLng, maxLat], crs = 'EPSG:4326') {
  return `${minLat},${minLng},${maxLat},${maxLng},${crs}`;
}

// Haalt een WFS GetFeature-response op en geeft de geparste JSON terug, of
// null bij een netwerkfout/lege/ongeldige response. PDOK geeft soms een 200
// met een lege/XML-respons terug i.p.v. een echte 4xx/5xx, vandaar de
// expliciete "begint dit met een { "-check vóór het parsen.
export async function haalWfsJson(url) {
  const text = await haalWfsText(url);
  return text ? JSON.parse(text) : null;
}

// Tekstuele response (i.p.v. al geparste JSON) — voor de *Laag.js-varianten
// die zelf met ol/format/GeoJSON.js parsen (incl. reprojectie).
export async function haalWfsText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  return text.trim().startsWith('{') ? text : null;
}
