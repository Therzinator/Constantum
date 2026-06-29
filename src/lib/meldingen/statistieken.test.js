import { describe, it, expect } from 'vitest';
import { perceelStatistieken, windrichtingPerPerceel, maandelijkseAantallen, dashboardStatistieken } from './statistieken.js';

// ── perceelStatistieken ───────────────────────────────────────────────────────

describe('perceelStatistieken', () => {
  const nu = new Date();
  const dijaarStr = nu.toISOString();
  const oudeStr = new Date(nu.getFullYear() - 2, 0, 1).toISOString();

  const meldingen = [
    { perceelnummer: 'A01', timestamp_local: dijaarStr, weather: { wind_speed: 20 }, gewas: 'aardappel', gemeente: 'Westland' },
    { perceelnummer: 'A01', timestamp_local: dijaarStr, weather: { wind_speed: 10 }, gewas: 'aardappel', gemeente: 'Westland' },
    { perceelnummer: 'A01', timestamp_local: oudeStr, weather: { wind_speed: 25 }, gewas: 'tomaat', gemeente: 'Delft' },
    { perceelnummer: 'B02', timestamp_local: dijaarStr, weather: { wind_speed: 5 }, gewas: null, gemeente: null },
    { perceelnummer: null, timestamp_local: dijaarStr, weather: null, gewas: null, gemeente: null }
  ];

  it('telt totaal per perceel', () => {
    const stats = perceelStatistieken(meldingen);
    expect(stats['A01'].totaal).toBe(3);
    expect(stats['B02'].totaal).toBe(1);
  });

  it('telt alleen meldingen van dit jaar in ditJaar', () => {
    const stats = perceelStatistieken(meldingen);
    expect(stats['A01'].ditJaar).toBe(2);
  });

  it('telt meldingen boven windnorm (>18 km/h)', () => {
    const stats = perceelStatistieken(meldingen);
    // A01: wind_speed 20 (>18), 10 (<= 18), 25 (>18) → 2
    expect(stats['A01'].bovenWindNorm).toBe(2);
    expect(stats['B02'].bovenWindNorm).toBe(0);
  });

  it('verzamelt unieke gewassen en gemeenten als Set', () => {
    const stats = perceelStatistieken(meldingen);
    expect([...stats['A01'].gewassen]).toContain('aardappel');
    expect([...stats['A01'].gewassen]).toContain('tomaat');
    expect(stats['A01'].gewassen.size).toBe(2);
    expect([...stats['A01'].gemeenten]).toContain('Westland');
    expect([...stats['A01'].gemeenten]).toContain('Delft');
  });

  it('slaat meldingen zonder perceelnummer over', () => {
    const stats = perceelStatistieken(meldingen);
    expect(stats[null]).toBeUndefined();
    expect(stats['undefined']).toBeUndefined();
  });

  it('lege lijst geeft leeg object', () => {
    expect(perceelStatistieken([])).toEqual({});
  });
});

// ── windrichtingPerPerceel ────────────────────────────────────────────────────

describe('windrichtingPerPerceel', () => {
  const meldingen = [
    { perceelnummer: 'X01', weather: { wind_dir: 180 } }, // Z
    { perceelnummer: 'X01', weather: { wind_dir: 180 } }, // Z
    { perceelnummer: 'X01', weather: { wind_dir: 180 } }, // Z → 3 = minimum
    { perceelnummer: 'X01', weather: { wind_dir: 0 } },   // N
    { perceelnummer: 'Y02', weather: { wind_dir: 90 } },  // slechts 1 → onder minimum
    { perceelnummer: 'Z03', weather: null }                // geen wind_dir
  ];

  it('berekent dominante richting correct', () => {
    const result = windrichtingPerPerceel(meldingen);
    expect(result['X01'].dominanteRichting).toBe('Z');
    expect(result['X01'].dominantPct).toBe(75);
    expect(result['X01'].totaal).toBe(4);
  });

  it('percelen met te weinig meldingen worden weggelaten', () => {
    const result = windrichtingPerPerceel(meldingen);
    expect(result['Y02']).toBeUndefined();
  });

  it('meldingen zonder wind_dir worden overgeslagen', () => {
    const result = windrichtingPerPerceel(meldingen);
    expect(result['Z03']).toBeUndefined();
  });

  it('verdeling bevat alle richtingen', () => {
    const result = windrichtingPerPerceel(meldingen);
    const richtingen = result['X01'].verdeling.map((v) => v.richting);
    expect(richtingen).toContain('Z');
    expect(richtingen).toContain('N');
  });
});

// ── maandelijkseAantallen ─────────────────────────────────────────────────────

describe('maandelijkseAantallen', () => {
  it('groepeert meldingen per maand', () => {
    const meldingen = [
      { timestamp_local: '2025-01-10T10:00:00' },
      { timestamp_local: '2025-01-20T10:00:00' },
      { timestamp_local: '2025-03-05T10:00:00' }
    ];
    const { labels, aantallen } = maandelijkseAantallen(meldingen);
    const jan = aantallen[labels.indexOf(labels.find((l) => l.startsWith('jan')))];
    expect(jan).toBe(2);
  });

  it('geeft maximaal 12 maanden terug', () => {
    const meldingen = Array.from({ length: 20 }, (_, i) => ({
      timestamp_local: new Date(2020 + i, 0, 1).toISOString()
    }));
    const { labels } = maandelijkseAantallen(meldingen);
    expect(labels.length).toBeLessThanOrEqual(12);
  });

  it('lege lijst geeft lege arrays', () => {
    const { labels, aantallen } = maandelijkseAantallen([]);
    expect(labels).toEqual([]);
    expect(aantallen).toEqual([]);
  });
});

// ── dashboardStatistieken ─────────────────────────────────────────────────────

describe('dashboardStatistieken', () => {
  it('telt totaal correct', () => {
    const meldingen = [
      { timestamp_local: '2020-01-01T00:00:00', weather: {} },
      { timestamp_local: '2020-02-01T00:00:00', weather: {} }
    ];
    expect(dashboardStatistieken(meldingen).totaal).toBe(2);
  });

  it('geeft topWind terug als er winddata is', () => {
    const meldingen = [
      { timestamp_local: '2025-06-01T00:00:00', weather: { wind_dir: 180 } },
      { timestamp_local: '2025-06-01T00:00:00', weather: { wind_dir: 180 } },
      { timestamp_local: '2025-06-01T00:00:00', weather: { wind_dir: 90 } }
    ];
    const { topWind } = dashboardStatistieken(meldingen);
    expect(topWind).toBe('Z');
  });

  it('topWind is "—" als er geen winddata is', () => {
    const meldingen = [{ timestamp_local: '2025-06-01T00:00:00', weather: {} }];
    expect(dashboardStatistieken(meldingen).topWind).toBe('—');
  });

  it('lege lijst geeft totaal 0 en topWind "—"', () => {
    const { totaal, topWind } = dashboardStatistieken([]);
    expect(totaal).toBe(0);
    expect(topWind).toBe('—');
  });
});
