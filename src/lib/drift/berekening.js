// ============================================================
// DRIFTZONE VISUALISATIE — FOCUS STEP model (grondspuit)
// Bron: FOCUS Surface Water Scenarios (EU standaard)
// ============================================================

// FOCUS STEP drift % op afstand voor grondspuit zonder driftreductie
// [afstand_m, drift_%]
export const FOCUS_DRIFT_TABEL = [
  [1,  6.8], [3,  3.3], [5,  2.0], [7,  1.4],
  [10, 0.9], [15, 0.6], [20, 0.4], [30, 0.25],
  [50, 0.08],[75, 0.03],[100,0.01]
];

// Interpoleer driftpercentage op willekeurige afstand
export function focusDriftPct(afstandM) {
  const t = FOCUS_DRIFT_TABEL;
  if (afstandM <= t[0][0]) return t[0][1];
  if (afstandM >= t[t.length-1][0]) return t[t.length-1][1];
  for (let i = 0; i < t.length - 1; i++) {
    if (afstandM >= t[i][0] && afstandM <= t[i+1][0]) {
      const pct = (afstandM - t[i][0]) / (t[i+1][0] - t[i][0]);
      return t[i][1] + pct * (t[i+1][1] - t[i][1]);
    }
  }
  return 0;
}

// Windsnelheid vermenigvuldiger (ref: 5 km/h = factor 1.0)
// Gebaseerd op empirische data: verdubbeling windsnelheid ≈ 700% meer drift
export function windFactor(kmh) {
  if (!kmh || kmh <= 0) return 1.0;
  const ref = 5;
  return Math.pow(kmh / ref, 1.8); // empirische exponent
}

// Bereken driftzone bereik in meters voor gegeven windsnelheid + drempelpercentage
// drempel: 0.1% = grens waaronder drift verwaarloosbaar
export function berekenDriftReikwijdte(windKmh, drempelPct = 0.05) {
  const factor = windFactor(windKmh);
  // Zoek de afstand waarop drift*factor < drempel
  for (let afstand = 1; afstand <= 200; afstand++) {
    if (focusDriftPct(afstand) * factor < drempelPct) {
      return Math.min(afstand, 200);
    }
  }
  return 200;
}

// Zones met kleurcodering
// Rood: >2% drift, Oranje: 0.5-2%, Geel: 0.1-0.5%
export function driftZones(windKmh) {
  const f = windFactor(windKmh);
  const zones = [];
  const grenzen = [
    { naam: 'kritiek',  kleur: '#ef4444', alpha: 0.35, minPct: 2.0  },
    { naam: 'hoog',     kleur: '#f97316', alpha: 0.28, minPct: 0.5  },
    { naam: 'matig',    kleur: '#eab308', alpha: 0.20, minPct: 0.1  },
    { naam: 'laag',     kleur: '#22c55e', alpha: 0.12, minPct: 0.02 },
  ];
  for (const zone of grenzen) {
    // Zoek de maximale afstand voor deze zone
    let maxAfstand = 0;
    for (let d = 1; d <= 200; d++) {
      if (focusDriftPct(d) * f >= zone.minPct) maxAfstand = d;
    }
    if (maxAfstand > 0) zones.push({ ...zone, reikwijdteM: maxAfstand });
  }
  return zones;
}

// Genereer een kegelvorm polygon (windrichting = richting WIT drift heen gaat)
// windDir: graden (0=N, 90=E, 180=S, 270=W) — dit is de richting VANWAAR de wind komt
// Driftzone gaat dus TEGENOVERGESTELD aan windrichting (= richting wind naartoe gaat)
export function driftKegel(lat, lng, windDirVanaf, reikwijdteM, openingshoek = 60) {
  // Wind komt uit windDir, gaat naar windDir + 180
  const driftRichting = (windDirVanaf + 180) % 360;
  const punten = [];
  const startHoek = driftRichting - openingshoek / 2;
  const stappen = 20;

  punten.push([lat, lng]); // Startpunt = perceel

  for (let i = 0; i <= stappen; i++) {
    const hoek = startHoek + (i / stappen) * openingshoek;
    const hoekRad = (hoek * Math.PI) / 180;
    // Haversine inverse: bereken punt op afstand en richting
    const R = 6371000;
    const dLat = (reikwijdteM / R) * Math.cos(hoekRad);
    const dLng = (reikwijdteM / R) * Math.sin(hoekRad) / Math.cos((lat * Math.PI) / 180);
    punten.push([lat + (dLat * 180) / Math.PI, lng + (dLng * 180) / Math.PI]);
  }

  punten.push([lat, lng]); // Sluit kegel
  return punten;
}
