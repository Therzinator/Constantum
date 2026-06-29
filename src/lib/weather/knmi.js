// Historische weerdata via Open-Meteo (gratis, geen API-key) als vervanging
// van de KNMI EDR API. Open-Meteo gebruikt ERA5-reanalyse + KNMI-stations
// voor Nederland. Uurresolutie (vs. 10-min KNMI). Archief tot 1940.
// Dezelfde interface als de oude KNMI-implementatie zodat bestaande aanroepen
// zonder wijziging blijven werken.

export async function haalKNMIWeerdata(lat, lng, isoDatetime) {
  try {
    const dt = new Date(isoDatetime);
    const daysAgo = (Date.now() - dt.getTime()) / (24 * 60 * 60 * 1000);

    const gemeenschappelijk = `latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}&hourly=windspeed_10m,winddirection_10m,temperature_2m,relativehumidity_2m,precipitation&wind_speed_unit=ms&timezone=Europe%2FAmsterdam`;

    let url;
    if (daysAgo < 6) {
      const pastDays = Math.min(92, Math.ceil(daysAgo) + 2);
      url = `https://api.open-meteo.com/v1/forecast?${gemeenschappelijk}&past_days=${pastDays}&forecast_days=0`;
    } else {
      const datumStr = dt.toISOString().slice(0, 10);
      url = `https://archive-api.open-meteo.com/v1/archive?${gemeenschappelijk}&start_date=${datumStr}&end_date=${datumStr}`;
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const times = data.hourly?.time || [];
    if (!times.length) return null;

    const dtMs = dt.getTime();
    let closestIdx = 0;
    let minDiff = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - dtMs);
      if (diff < minDiff) { minDiff = diff; closestIdx = i; }
    });

    const h = data.hourly;
    return {
      station: 'Open-Meteo / ERA5',
      stationId: 'open-meteo',
      afstand_km: null,
      windsnelheid: h.windspeed_10m?.[closestIdx] ?? null,
      windrichting: h.winddirection_10m?.[closestIdx] ?? null,
      temperatuur: h.temperature_2m?.[closestIdx] ?? null,
      luchtvochtigheid: h.relativehumidity_2m?.[closestIdx] ?? null,
      neerslag: h.precipitation?.[closestIdx] ?? null,
      bron: 'Open-Meteo ERA5 (CC BY 4.0)',
      tijdstip: isoDatetime
    };
  } catch (e) {
    console.warn('[Weerdata] Historische lookup mislukt:', e.message);
    return null;
  }
}

// No-ops voor achterwaartse compatibiliteit — API-key is niet meer nodig.
export function laadKNMIKey() { return 'open-meteo'; }
export function slaKNMIKeyOp() {}
