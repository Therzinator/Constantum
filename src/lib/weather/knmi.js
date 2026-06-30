// Historische weerdata: gecertificeerde KNMI Open Data EDR (primair) met
// Open-Meteo ERA5 (fallback). Primaire bron vereist een door de gebruiker
// zelf aangevraagde API-sleutel (dataplatform.knmi.nl). Zonder sleutel of
// bij falen: transparante terugval op ERA5-reanalyse.
//
// KNMI EDR collectie: 10-minute-in-situ-meteorological-observations (v.a. 2025-09-29,
// vervangt de gedeprecieerde "observations"-collectie).
// Authorization: kale API-sleutel, GEEN Bearer-prefix.

const KNMI_BASE = 'https://api.dataplatform.knmi.nl/edr/v1/collections/10-minute-in-situ-meteorological-observations';
const KNMI_KEY_LS = 'knmi_api_key';

export function laadKNMIKey() {
  try { return localStorage.getItem(KNMI_KEY_LS) || ''; } catch { return ''; }
}

export function slaKNMIKeyOp(key) {
  try {
    const schoon = (key || '').trim();
    if (schoon) localStorage.setItem(KNMI_KEY_LS, schoon);
    else localStorage.removeItem(KNMI_KEY_LS);
  } catch { /* private browsing */ }
}

// Zet een Date naar "2026-06-29T14:00:00Z" (geen milliseconden, altijd UTC Z-suffix)
function toKNMIDatetime(dt) {
  return dt.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Haal KNMI EDR station-data op. Geeft null bij fout of geen data.
async function haalEDRData(lat, lng, isoDatetime, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // 1. Zoek dichtstbijzijnde station via bbox-query
    const delta = 0.8; // ~55 km — ruim genoeg voor dunne gebieden
    const bbox = `${(lng - delta).toFixed(4)},${(lat - delta).toFixed(4)},${(lng + delta).toFixed(4)},${(lat + delta).toFixed(4)}`;
    const locsRes = await fetch(`${KNMI_BASE}/locations?bbox=${bbox}`, {
      headers: { Authorization: apiKey },
      signal: controller.signal
    });
    if (!locsRes.ok) {
      const body = await locsRes.text().catch(() => '');
      console.warn('[KNMI EDR] /locations mislukt:', locsRes.status, body.slice(0, 120));
      return null;
    }
    const locs = await locsRes.json();
    const features = locs.features;
    if (!features?.length) return null;

    // Vind geografisch dichtstbijzijnde station (Euclidisch in graden, voldoende nauwkeurig)
    let dichtstbij = null, minD = Infinity;
    for (const f of features) {
      const [sLng, sLat] = f.geometry.coordinates;
      const d = Math.hypot(sLat - lat, sLng - lng);
      if (d < minD) { minD = d; dichtstbij = f; }
    }
    if (!dichtstbij) return null;

    // Haversine voor afstand in km
    const R = 6371;
    const [sLng, sLat] = dichtstbij.geometry.coordinates;
    const dLat = (sLat - lat) * Math.PI / 180;
    const dLng = (sLng - lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * Math.PI / 180) * Math.cos(sLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const afstandKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // 2. Vraag 10-minuten data op rondom het gevraagde tijdstip
    const dt = new Date(isoDatetime);
    const start = toKNMIDatetime(new Date(dt.getTime() - 5 * 60000));
    const eind  = toKNMIDatetime(new Date(dt.getTime() + 5 * 60000));

    // KNMI 10-minuten parametercodes: dd=windrichting, ff=windsnelheid,
    // ta=temperatuur, rh=relatieve vochtigheid, RH=neerslag (mm/10min)
    const params = 'dd,ff,ta,rh,RH';
    const dataRes = await fetch(
      `${KNMI_BASE}/locations/${dichtstbij.id}?datetime=${start}/${eind}&parameter-name=${params}`,
      { headers: { Authorization: apiKey }, signal: controller.signal }
    );
    if (!dataRes.ok) {
      const body = await dataRes.text().catch(() => '');
      console.warn('[KNMI EDR] Stationsdata mislukt:', dataRes.status, dichtstbij.id, body.slice(0, 120));
      return null;
    }
    const covjson = await dataRes.json();

    // CoverageJSON structuur: { coverages: [{ ranges: { dd: { values: [...] } } }] }
    const ranges = covjson.coverages?.[0]?.ranges ?? covjson.ranges ?? {};
    const getVal = (param) => {
      const vals = ranges[param]?.values;
      return Array.isArray(vals) ? (vals.find(v => v != null) ?? null) : null;
    };

    const naam = dichtstbij.properties?.name || dichtstbij.properties?.station_name || dichtstbij.id;
    return {
      station:          naam,
      stationId:        dichtstbij.id,
      afstand_km:       Math.round(afstandKm * 10) / 10,
      windrichting:     getVal('dd'),   // graden
      windsnelheid:     getVal('ff'),   // m/s
      temperatuur:      getVal('ta'),   // °C
      luchtvochtigheid: getVal('rh'),   // %
      neerslag:         getVal('RH'),   // mm/10min
      bron:             `KNMI Open Data EDR CC BY 4.0 © KNMI — station ${naam}`,
      tijdstip:         isoDatetime
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[KNMI EDR] Timeout na 10s');
    } else {
      console.warn('[KNMI EDR] Onverwachte fout:', e.message);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fallback: Open-Meteo ERA5 / archief. Uurresolutie, archief tot 1940, geen key.
async function haalERA5Data(lat, lng, isoDatetime) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const dt = new Date(isoDatetime);
    const daysAgo = (Date.now() - dt.getTime()) / (24 * 60 * 60 * 1000);
    const gemeenschappelijk = `latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}` +
      `&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,precipitation` +
      `&wind_speed_unit=ms&timezone=Europe%2FAmsterdam`;

    let url;
    if (daysAgo < 6) {
      const pastDays = Math.min(92, Math.ceil(daysAgo) + 2);
      url = `https://api.open-meteo.com/v1/forecast?${gemeenschappelijk}&past_days=${pastDays}&forecast_days=0`;
    } else {
      const datumStr = dt.toISOString().slice(0, 10);
      url = `https://archive-api.open-meteo.com/v1/archive?${gemeenschappelijk}&start_date=${datumStr}&end_date=${datumStr}`;
    }

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.warn('[Open-Meteo ERA5] Mislukt:', res.status);
      return null;
    }
    const data = await res.json();
    const times = data.hourly?.time || [];
    if (!times.length) return null;

    const dtMs = dt.getTime();
    let closestIdx = 0, minDiff = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - dtMs);
      if (diff < minDiff) { minDiff = diff; closestIdx = i; }
    });

    const h = data.hourly;
    return {
      station:          'Open-Meteo / ERA5',
      stationId:        'open-meteo',
      afstand_km:       null,
      windrichting:     h.wind_direction_10m?.[closestIdx]    ?? null,
      windsnelheid:     h.wind_speed_10m?.[closestIdx]        ?? null,
      temperatuur:      h.temperature_2m?.[closestIdx]        ?? null,
      luchtvochtigheid: h.relative_humidity_2m?.[closestIdx]  ?? null,
      neerslag:         h.precipitation?.[closestIdx]         ?? null,
      bron:             'Open-Meteo ERA5 (CC BY 4.0) — uurresolutie',
      tijdstip:         isoDatetime
    };
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('[Open-Meteo ERA5] Fout:', e.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Hoofdfunctie: KNMI EDR (als key aanwezig) → fallback ERA5
export async function haalKNMIWeerdata(lat, lng, isoDatetime) {
  const apiKey = laadKNMIKey();

  if (apiKey) {
    const knmi = await haalEDRData(lat, lng, isoDatetime, apiKey);
    if (knmi) return knmi;
    console.info('[Weerdata] KNMI EDR niet beschikbaar, terugval op Open-Meteo ERA5');
  }

  return haalERA5Data(lat, lng, isoDatetime);
}
