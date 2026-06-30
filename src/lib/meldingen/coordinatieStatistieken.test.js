import { describe, it, expect } from 'vitest';
import {
  trustScoreVerdeling,
  meldersOverzicht,
  meldingenOnderReview,
  provincies,
  gemeentenInProvincie,
  filterOpRegio
} from './coordinatieStatistieken.js';

// ── trustScoreVerdeling ──────────────────────────────────────────────────────

// Buckets volgen 4 DB-tiers: 0-19 / 20-39 / 40-79 / 80-100 (migraties 0022-0024)
describe('trustScoreVerdeling', () => {
  it('telt scores in de juiste buckets', () => {
    const profielen = [
      { trust_score: 10 },
      { trust_score: 25 },
      { trust_score: 55 },
      { trust_score: 75 },
      { trust_score: 90 }
    ];
    const result = trustScoreVerdeling(profielen);
    expect(result.find((b) => b.label === '0-19').aantal).toBe(1);
    expect(result.find((b) => b.label === '20-39').aantal).toBe(1);
    expect(result.find((b) => b.label === '40-79').aantal).toBe(2);
    expect(result.find((b) => b.label === '80-100').aantal).toBe(1);
  });

  it('grenscases: 0, 19, 20, 39, 40, 79, 80, 100 landen correct', () => {
    const profielen = [
      { trust_score: 0 },
      { trust_score: 19 },
      { trust_score: 20 },
      { trust_score: 39 },
      { trust_score: 40 },
      { trust_score: 79 },
      { trust_score: 80 },
      { trust_score: 100 }
    ];
    const result = trustScoreVerdeling(profielen);
    expect(result.find((b) => b.label === '0-19').aantal).toBe(2);
    expect(result.find((b) => b.label === '20-39').aantal).toBe(2);
    expect(result.find((b) => b.label === '40-79').aantal).toBe(2);
    expect(result.find((b) => b.label === '80-100').aantal).toBe(2);
  });

  it('null trust_score valt in 40-79 bucket (default 75 = DB default)', () => {
    const result = trustScoreVerdeling([{ trust_score: null }]);
    expect(result.find((b) => b.label === '40-79').aantal).toBe(1);
  });

  it('lege lijst geeft alle buckets op 0', () => {
    const result = trustScoreVerdeling([]);
    expect(result.every((b) => b.aantal === 0)).toBe(true);
  });

  it('geeft altijd 4 buckets terug', () => {
    expect(trustScoreVerdeling([]).length).toBe(4);
    expect(trustScoreVerdeling([{ trust_score: 50 }]).length).toBe(4);
  });
});

// ── meldersOverzicht ─────────────────────────────────────────────────────────

describe('meldersOverzicht', () => {
  const entries = [
    { user_id: 'u1', melder_email: 'a@x.nl', visibility: 'normal' },
    { user_id: 'u1', melder_email: 'a@x.nl', visibility: 'under_review' },
    { user_id: 'u2', melder_email: 'b@x.nl', visibility: 'shadow' },
    { user_id: 'u2', melder_email: 'b@x.nl', visibility: 'normal' },
    { user_id: 'u2', melder_email: 'b@x.nl', visibility: 'normal' }
  ];
  const profielen = [
    { id: 'u1', trust_score: 60 },
    { id: 'u2', trust_score: 15 }
  ];

  it('groepeert entries per melder en telt correct', () => {
    const result = meldersOverzicht(entries, profielen);
    const u1 = result.find((r) => r.userId === 'u1');
    const u2 = result.find((r) => r.userId === 'u2');
    expect(u1.aantalMeldingen).toBe(2);
    expect(u1.aantalUnderReview).toBe(1);
    expect(u1.aantalShadow).toBe(0);
    expect(u2.aantalMeldingen).toBe(3);
    expect(u2.aantalShadow).toBe(1);
    expect(u2.aantalUnderReview).toBe(0);
  });

  it('koppelt trust score vanuit profielMap', () => {
    const result = meldersOverzicht(entries, profielen);
    expect(result.find((r) => r.userId === 'u1').trustScore).toBe(60);
    expect(result.find((r) => r.userId === 'u2').trustScore).toBe(15);
  });

  it('sorteert melder met meeste meldingen eerst', () => {
    const result = meldersOverzicht(entries, profielen);
    expect(result[0].userId).toBe('u2');
    expect(result[1].userId).toBe('u1');
  });

  it('slaat entries zonder user_id over', () => {
    const result = meldersOverzicht([{ user_id: null, visibility: 'normal' }], []);
    expect(result.length).toBe(0);
  });

  it('trustScore null als profiel ontbreekt', () => {
    const result = meldersOverzicht([{ user_id: 'onbekend', melder_email: '', visibility: 'normal' }], []);
    expect(result[0].trustScore).toBeNull();
  });
});

// ── meldingenOnderReview ─────────────────────────────────────────────────────

describe('meldingenOnderReview', () => {
  it('filtert only under_review en shadow', () => {
    const entries = [
      { id: 1, visibility: 'normal' },
      { id: 2, visibility: 'under_review' },
      { id: 3, visibility: 'shadow' },
      { id: 4, visibility: 'normal' }
    ];
    const result = meldingenOnderReview(entries);
    expect(result.map((e) => e.id)).toEqual([2, 3]);
  });

  it('lege lijst geeft lege lijst', () => {
    expect(meldingenOnderReview([])).toEqual([]);
  });
});

// ── provincies ───────────────────────────────────────────────────────────────

describe('provincies', () => {
  it('geeft unieke provincies gesorteerd terug', () => {
    const entries = [
      { provincie: 'Zuid-Holland' },
      { provincie: 'Noord-Holland' },
      { provincie: 'Zuid-Holland' },
      { provincie: null }
    ];
    expect(provincies(entries)).toEqual(['Noord-Holland', 'Zuid-Holland']);
  });
});

// ── gemeentenInProvincie ─────────────────────────────────────────────────────

describe('gemeentenInProvincie', () => {
  const entries = [
    { provincie: 'Zuid-Holland', gemeente: 'Westland' },
    { provincie: 'Zuid-Holland', gemeente: 'Delft' },
    { provincie: 'Zuid-Holland', gemeente: 'Westland' },
    { provincie: 'Noord-Holland', gemeente: 'Haarlem' }
  ];

  it('geeft unieke gemeenten in opgegeven provincie', () => {
    expect(gemeentenInProvincie(entries, 'Zuid-Holland')).toEqual(['Delft', 'Westland']);
  });

  it('geeft lege lijst bij lege provincie-parameter', () => {
    expect(gemeentenInProvincie(entries, '')).toEqual([]);
    expect(gemeentenInProvincie(entries, null)).toEqual([]);
  });

  it('geeft lege lijst als provincie niet bestaat', () => {
    expect(gemeentenInProvincie(entries, 'Zeeland')).toEqual([]);
  });
});

// ── filterOpRegio ─────────────────────────────────────────────────────────────

describe('filterOpRegio', () => {
  const entries = [
    { id: 1, provincie: 'Zuid-Holland', gemeente: 'Westland' },
    { id: 2, provincie: 'Zuid-Holland', gemeente: 'Delft' },
    { id: 3, provincie: 'Noord-Holland', gemeente: 'Haarlem' },
    { id: 4, provincie: null, gemeente: null }
  ];

  it('geen filter geeft alles terug', () => {
    expect(filterOpRegio(entries, null, null)).toHaveLength(4);
    expect(filterOpRegio(entries, '', '')).toHaveLength(4);
  });

  it('provincie-filter geeft alleen die provincie', () => {
    const result = filterOpRegio(entries, 'Zuid-Holland', null);
    expect(result.map((e) => e.id)).toEqual([1, 2]);
  });

  it('provincie + gemeente combineert correct', () => {
    const result = filterOpRegio(entries, 'Zuid-Holland', 'Westland');
    expect(result.map((e) => e.id)).toEqual([1]);
  });

  it('entry zonder provincie valt buiten elke provincie-filter', () => {
    const result = filterOpRegio(entries, 'Zuid-Holland', null);
    expect(result.every((e) => e.id !== 4)).toBe(true);
  });
});
