// Compact weerbericht voor de dashboardkaart — wind, neerslag, luchtdruk en
// zonneschijn voor nu + de komende uren. Open-Meteo (gratis, geen key,
// CORS open) i.p.v. KNMI: de KNMI-koppeling in lib/weather/knmi.js vereist
// een eigen API-key en is bedoeld voor gecertificeerde station-historie bij
// een specifieke melding (zie KNMIInstellingen.jsx), niet voor een
// vrijblijvend live overzicht op het dashboard.
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_UREN = 3;

export async function haalWeerbericht(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: 'wind_speed_10m,wind_direction_10m,precipitation,pressure_msl',
    hourly: 'precipitation,sunshine_duration',
    forecast_hours: String(FORECAST_UREN),
    timezone: 'Europe/Amsterdam'
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.current) return null;

  return {
    windKmu: data.current.wind_speed_10m,
    windRichtingGraden: data.current.wind_direction_10m,
    luchtdrukHpa: data.current.pressure_msl,
    neerslagNuMm: data.current.precipitation,
    neerslagKomendeUrenMm: (data.hourly?.precipitation || []).reduce((s, v) => s + v, 0),
    zonneschijnKomendeUrenMin: Math.round((data.hourly?.sunshine_duration || []).reduce((s, v) => s + v, 0) / 60)
  };
}

const WINDRICHTINGEN = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
function windRichtingTekst(graden) {
  if (graden == null) return '';
  return WINDRICHTINGEN[Math.round(graden / 45) % 8];
}

// Eén leesbare regel voor de radar-popup op het dashboard.
export function beschrijfWeerbericht(weer) {
  if (!weer) return null;
  const delen = [];

  if (weer.windKmu != null) {
    delen.push(`💨 Wind ${Math.round(weer.windKmu)} km/u ${windRichtingTekst(weer.windRichtingGraden)}`);
  }
  if (weer.neerslagNuMm != null) {
    delen.push(`🌧️ Nu ${weer.neerslagNuMm.toFixed(1)} mm/u op je locatie`);
  }
  if (weer.neerslagKomendeUrenMm != null) {
    delen.push(`📊 ${weer.neerslagKomendeUrenMm.toFixed(1)} mm verwacht komende ${FORECAST_UREN} uur`);
  }
  if (weer.luchtdrukHpa != null) delen.push(`🔽 ${Math.round(weer.luchtdrukHpa)} hPa`);
  if (weer.zonneschijnKomendeUrenMin != null) delen.push(`🌤️ ${weer.zonneschijnKomendeUrenMin} min zon komende ${FORECAST_UREN} uur`);

  return delen.join(' · ');
}
