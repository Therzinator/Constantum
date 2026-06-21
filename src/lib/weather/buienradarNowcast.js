// Korte-termijn neerslagverwachting via Buienradar's publieke "raintext"
// endpoint (gratis, geen key, CORS open) — vult de leemte die ontstond toen
// RainViewer's gratis tier op 1 januari 2026 nowcast/voorspellingsdata
// schrapte (zie radarLaag.js). Levert 5-minuts-stappen voor de komende
// ~2 uur, exact de horizon die de Buienradar-app en -widgets zelf ook tonen
// ("buienradar") — een harde 3-uursvoorspelling bestaat niet gratis/zonder
// key; deze functie claimt dus bewust niet meer dan de data daadwerkelijk
// dekt.
const RAINTEXT_URL = 'https://gpsgadget.buienradar.nl/data/raintext';

// Buienradar codeert intensiteit logaritmisch 0-255: 0 = droog,
// 255 ≈ stortbui. Omrekening naar mm/u volgens Buienradar's eigen formule.
function naarMmPerUur(waarde) {
  if (waarde <= 0) return 0;
  return Math.round(10 ** ((waarde - 109) / 32) * 100) / 100;
}

function parseRegel(regel, nu) {
  const [waardeStr, tijdStr] = regel.split('|');
  const [uur, minuut] = tijdStr.split(':').map(Number);
  const tijd = new Date(nu);
  tijd.setHours(uur, minuut, 0, 0);
  // Buienradar geeft alleen HH:mm — als de eerste stap "in het verleden"
  // lijkt (bv. 23:55 terwijl nu 00:02 is) is het etmaal omgeslagen.
  if (tijd.getTime() < nu.getTime() - 10 * 60 * 1000) tijd.setDate(tijd.getDate() + 1);
  return { tijd, mmPerUur: naarMmPerUur(Number(waardeStr)) };
}

export async function haalBuienradarRegenverwachting(lat, lng) {
  const url = `${RAINTEXT_URL}?lat=${lat.toFixed(2)}&lon=${lng.toFixed(2)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const tekst = (await res.text()).trim();
  if (!tekst) return null;

  const nu = new Date();
  return tekst
    .split('\n')
    .map((regel) => regel.trim())
    .filter(Boolean)
    .map((regel) => parseRegel(regel, nu));
}

function formatTijd(datum) {
  return datum.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

// Vertaalt de reeks naar één leesbare regel, net als de samenvatting boven
// de Buienradar-buienradar-grafiek: nu droog/nat, en wanneer dat verandert
// + de hevigste bui in de resterende periode.
export function beschrijfRegenverwachting(reeks) {
  if (!reeks?.length) return null;

  const horizonMinuten = Math.round((reeks[reeks.length - 1].tijd - reeks[0].tijd) / 60000) + 5;
  const huidig = reeks[0];
  const piek = reeks.reduce((max, r) => (r.mmPerUur > max.mmPerUur ? r : max), reeks[0]);

  if (huidig.mmPerUur > 0) {
    const droogVanaf = reeks.find((r) => r.mmPerUur === 0);
    const piekTekst = piek.mmPerUur > huidig.mmPerUur ? `, hevigst rond ${formatTijd(piek.tijd)} (~${piek.mmPerUur} mm/u)` : '';
    return droogVanaf
      ? `🌧️ Nu ~${huidig.mmPerUur} mm/u — naar verwachting droog vanaf ${formatTijd(droogVanaf.tijd)}${piekTekst}.`
      : `🌧️ Nu ~${huidig.mmPerUur} mm/u, de komende ${horizonMinuten} minuten blijft het naar verwachting nat${piekTekst}.`;
  }

  const eersteRegen = reeks.find((r) => r.mmPerUur > 0);
  if (!eersteRegen) {
    return `☀️ Droog (0 mm/u) in de komende ${horizonMinuten} minuten.`;
  }
  return `🌧️ Nu droog — neerslag verwacht vanaf ${formatTijd(eersteRegen.tijd)}, hevigst rond ${formatTijd(piek.tijd)} (~${piek.mmPerUur} mm/u).`;
}
