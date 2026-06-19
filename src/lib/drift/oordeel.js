// Bereken de hoek van perceel → woning (0° = Noord, 90° = Oost etc.)
export function berekenHoekNaarWoning(percLat, percLng, woningLat, woningLng) {
  const dLat = woningLat - percLat;
  const dLng = woningLng - percLng;
  const hoek = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
  return Math.round(hoek);
}

// Bepaal of wind op dit moment naar de woning waait (±60° marge)
export function windWaaitNaarWoning(windDeg, percLat, percLng, woningLat, woningLng) {
  if (windDeg == null) return null;
  const hoekNaarWoning = berekenHoekNaarWoning(percLat, percLng, woningLat, woningLng);
  // Wind waait in de richting windDeg — dus drift gaat die kant op
  let verschil = Math.abs(windDeg - hoekNaarWoning);
  if (verschil > 180) verschil = 360 - verschil;
  return { waait: verschil <= 60, verschil: Math.round(verschil), hoekNaarWoning };
}

export function degToCompass(deg) {
  const dirs = ['N','NNO','NO','ONO','O','OZO','ZO','ZZO','Z','ZZW','ZW','WZW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Beaufort schaal op basis van km/h (10m hoogte)
export function kmhToBft(kmh) {
  const grenzen = [1,6,12,20,29,39,50,62,75,89,103,118];
  let bft = 0;
  for (const g of grenzen) { if (kmh >= g) bft++; else break; }
  return bft;
}

// Toets windsnelheid aan Nederlandse wet (Activiteitenbesluit art. 3.79):
// Maximum windsnelheid voor spuiten van pesticiden = 5 m/s = 18 km/h
export function spuitWindOordeel(windKmh, gustsKmh, driftWaarneming) {
  const bft      = kmhToBft(windKmh);
  const MAX_MS   = 5;
  const MAX_KMH  = 18;
  const WARN_KMH = 14;

  const windMs  = (windKmh / 3.6).toFixed(1);
  const gustsMs = ((gustsKmh || 0) / 3.6).toFixed(1);

  const drift = driftWaarneming || [];
  const driftOpPersoon  = drift.includes('druppels_voelbaar') || drift.includes('ogen_keel');
  const driftZichtbaar  = drift.includes('nevel_zichtbaar') || drift.includes('drift_ver');
  const geurDirect      = drift.includes('geur_direct');

  // Wettelijke grens overschreden op basis van gemiddelde wind
  if (windKmh > MAX_KMH) {
    return { kleur: '#ef4444', icoon: '🚫', tekst: `Te veel wind voor spuiten: ${windMs} m/s gemiddeld (max ${MAX_MS} m/s wettelijk, Bft ${bft})` };
  }

  // Wind binnen norm maar drift op persoon waargenomen → juridisch zwaarwegend
  if (driftOpPersoon) {
    return { kleur: '#ef4444', icoon: '🚫', tekst: `Drift op persoon waargenomen — ongeacht windmeting (${windMs} m/s). Juridisch relevant.` };
  }

  // Wind nadert grens of drift zichtbaar/geur
  if (windKmh >= WARN_KMH || driftZichtbaar || geurDirect) {
    const extra = [];
    if (driftZichtbaar) extra.push('drift zichtbaar');
    if (geurDirect)     extra.push('geur direct');
    if ((gustsKmh || 0) > MAX_KMH) extra.push(`stoten ${gustsMs} m/s`);
    return { kleur: '#f59e0b', icoon: '⚠️', tekst: `Wind nadert grens: ${windMs} m/s${extra.length ? ' — ' + extra.join(', ') : ''} (max ${MAX_MS} m/s, Bft ${bft})` };
  }

  // Alles binnen norm
  const gustsWaarschuwing = (gustsKmh || 0) > MAX_KMH ? ` — let op stoten: ${gustsMs} m/s` : '';
  return { kleur: '#00d4aa', icoon: '✓', tekst: `Wind binnen wettelijke norm: ${windMs} m/s (max ${MAX_MS} m/s, Bft ${bft})${gustsWaarschuwing}` };
}
