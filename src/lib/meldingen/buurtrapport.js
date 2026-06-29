import { degToCompass } from '../drift/oordeel.js';

// Coordinatie & Admin systeem, Fase 6/7 — pure aggregatiefuncties voor het
// buurtrapport. `gemeente` is de gemeentenaam (case-insensitief prefix-match).
export function filterVoorBuurtrapport(entries, gemeente, vanaf, tot) {
  const vanafD = vanaf ? new Date(vanaf) : null;
  const totD = tot ? new Date(tot) : null;
  const gLower = gemeente.toLowerCase();
  return entries.filter((e) => {
    if (!e.gemeente?.toLowerCase().startsWith(gLower)) return false;
    if (!e.opt_in_buurt) return false;
    const t = new Date(e.timestamp_local);
    if (vanafD && t < vanafD) return false;
    if (totD && t > totD) return false;
    return true;
  });
}

// Windroos per perceel: aantal meldingen per kompasrichting (16 richtingen)
// — alleen meldingen met bekende windrichting tellen mee.
export function windroosPerPerceel(entries) {
  const perPerceel = {};
  entries.forEach((e) => {
    if (!e.perceelnummer || e.weather?.wind_dir == null) return;
    const richting = degToCompass(e.weather.wind_dir);
    if (!perPerceel[e.perceelnummer]) perPerceel[e.perceelnummer] = {};
    perPerceel[e.perceelnummer][richting] = (perPerceel[e.perceelnummer][richting] || 0) + 1;
  });
  return perPerceel;
}

// Seizoenspatroon: aantal meldingen per kalendermaand, opgeteld over alle
// jaren in de gefilterde periode (dus "maart" = alle meldingen die ooit in
// maart zijn gedaan, niet per jaar uitgesplitst).
export function seizoenspatroon(entries) {
  const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const perMaand = MAANDEN.map((label) => ({ label, aantal: 0 }));
  entries.forEach((e) => {
    const maand = new Date(e.timestamp_local).getMonth();
    perMaand[maand].aantal++;
  });
  return perMaand;
}

// Bewijswaardescore — een transparante, niet-juridisch-bindende heuristiek
// (0-100) die vier factoren middelt: aantal onafhankelijke melders, hoeveel
// meldingen een RFC 3161-tijdstempel hebben, KNMI-dekking (best-effort live
// check, zie CoordinatiePage — wordt niet historisch opgeslagen) en de
// gemiddelde trust score van de bijdragende melders. Bedoeld als indicatie
// voor de kwaliteit van een collectief dossier, niet als keurmerk.
export function bewijswaardescore({ aantalMelders, rfc3161Percentage, knmiPercentage, gemiddeldeTrustScore }) {
  const meldersScore = Math.min(100, aantalMelders * 10);
  const rfc3161Score = rfc3161Percentage ?? 0;
  const knmiScore = knmiPercentage ?? 0;
  const trustScore = gemiddeldeTrustScore ?? 75;
  return Math.round((meldersScore + rfc3161Score + knmiScore + trustScore) / 4);
}
