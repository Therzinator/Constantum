import { describe, it, expect } from 'vitest';

// Pure JS replica van de guard-logica uit fn_trust_score_actie_bonus —
// getest zonder DB. De SQL-functie bevat exact dezelfde checks.

const ACTIES = {
  melding_volledig:      2,
  opt_in_buurt:         3,
  drempel_5_meldingen:  3,
  drempel_10_meldingen: 5,
  drempel_25_meldingen: 5,
  drempel_50_meldingen: 5,
  telefoon_geverifieerd: 8
};

// Simuleer de guards als pure functies
function magBonusKrijgen({
  accountDagen,
  normaleMeldingen,
  alGerewardVoorEntry,
  alGerewardPerUser,
  dagelijkseSomEntryBonussen,
  entryVisibility,
  perceelMeldingenIn24h,
  actie,
  entryId
}) {
  // Guard 1: accountleeftijd
  if (accountDagen < 30) return { mag: false, reden: 'account te jong' };

  // Guard 2: minimaal 5 normale meldingen
  if (normaleMeldingen < 5) return { mag: false, reden: 'te weinig normale meldingen' };

  // Guard 3: deduplicatie
  if (entryId !== null && alGerewardVoorEntry) return { mag: false, reden: 'al beloond voor deze entry' };
  if (entryId === null && alGerewardPerUser) return { mag: false, reden: 'al beloond voor deze user' };

  // Guard 4: dagelijkse cap (alleen per-entry)
  if (entryId !== null && dagelijkseSomEntryBonussen >= 5) return { mag: false, reden: 'dagelijkse cap bereikt' };

  // Guard 5: entry-specifieke checks
  if (entryId !== null) {
    if (entryVisibility === 'shadow' || entryVisibility === 'under_review') {
      return { mag: false, reden: 'entry niet normal' };
    }
    if (perceelMeldingenIn24h >= 5) return { mag: false, reden: 'perceel-spam gedetecteerd' };
  }

  const delta = ACTIES[actie] ?? 0;
  if (delta === 0) return { mag: false, reden: 'onbekende actie' };

  // Cap afkappen voor per-entry
  const effectief = entryId !== null
    ? Math.min(delta, 5 - dagelijkseSomEntryBonussen)
    : delta;

  return { mag: effectief > 0, delta: effectief };
}

const DEFAULTS = {
  accountDagen: 60,
  normaleMeldingen: 5,
  alGerewardVoorEntry: false,
  alGerewardPerUser: false,
  dagelijkseSomEntryBonussen: 0,
  entryVisibility: 'normal',
  perceelMeldingenIn24h: 1,
  actie: 'melding_volledig',
  entryId: 42
};

function check(overrides = {}) {
  return magBonusKrijgen({ ...DEFAULTS, ...overrides });
}

// ── Guard 1: accountleeftijd ────────────────────────────────────────────────

describe('Guard 1 — accountleeftijd', () => {
  it('blokkeert account jonger dan 30 dagen', () => {
    expect(check({ accountDagen: 0 }).mag).toBe(false);
    expect(check({ accountDagen: 29 }).mag).toBe(false);
  });

  it('staat toe bij exact 30 dagen', () => {
    expect(check({ accountDagen: 30 }).mag).toBe(true);
  });
});

// ── Guard 2: minimaal normale meldingen ────────────────────────────────────

describe('Guard 2 — minimaal 5 normale meldingen', () => {
  it('blokkeert bij 0-4 normale meldingen', () => {
    for (let n = 0; n < 5; n++) {
      expect(check({ normaleMeldingen: n }).mag).toBe(false);
    }
  });

  it('staat toe bij exact 5 normale meldingen', () => {
    expect(check({ normaleMeldingen: 5 }).mag).toBe(true);
  });
});

// ── Guard 3: deduplicatie ───────────────────────────────────────────────────

describe('Guard 3 — deduplicatie', () => {
  it('blokkeert per-entry als al beloond voor deze entry', () => {
    expect(check({ alGerewardVoorEntry: true }).mag).toBe(false);
  });

  it('blokkeert per-user (mijlpaal) als al beloond', () => {
    expect(check({
      actie: 'drempel_10_meldingen',
      entryId: null,
      alGerewardPerUser: true
    }).mag).toBe(false);
  });

  it('staat mijlpaal toe als nog niet beloond', () => {
    expect(check({
      actie: 'drempel_10_meldingen',
      entryId: null,
      alGerewardPerUser: false
    }).mag).toBe(true);
  });
});

// ── Guard 4: dagelijkse cap ─────────────────────────────────────────────────

describe('Guard 4 — dagelijkse cap +5 voor per-entry bonussen', () => {
  it('blokkeert als cap al bereikt', () => {
    expect(check({ dagelijkseSomEntryBonussen: 5 }).mag).toBe(false);
  });

  it('knipt delta af tot resterende cap', () => {
    const result = check({ dagelijkseSomEntryBonussen: 4, actie: 'opt_in_buurt' });
    expect(result.mag).toBe(true);
    expect(result.delta).toBe(1); // 3 gewenst, maar nog maar 1 ruimte
  });

  it('cap geldt NIET voor mijlpalen (per-user)', () => {
    expect(check({
      actie: 'drempel_10_meldingen',
      entryId: null,
      dagelijkseSomEntryBonussen: 5
    }).mag).toBe(true);
  });
});

// ── Guard 5: entry-checks ───────────────────────────────────────────────────

describe('Guard 5 — entry visibility en perceel-spam', () => {
  it('blokkeert bij under_review', () => {
    expect(check({ entryVisibility: 'under_review' }).mag).toBe(false);
  });

  it('blokkeert bij shadow', () => {
    expect(check({ entryVisibility: 'shadow' }).mag).toBe(false);
  });

  it('blokkeert bij >= 5 meldingen op zelfde perceel in 24h', () => {
    expect(check({ perceelMeldingenIn24h: 5 }).mag).toBe(false);
    expect(check({ perceelMeldingenIn24h: 10 }).mag).toBe(false);
  });

  it('staat toe bij 4 meldingen op zelfde perceel (net onder grens)', () => {
    expect(check({ perceelMeldingenIn24h: 4 }).mag).toBe(true);
  });
});

// ── Acties en deltas ────────────────────────────────────────────────────────

describe('Acties — correcte deltas', () => {
  it('melding_volledig geeft +2', () => {
    expect(check({ actie: 'melding_volledig' }).delta).toBe(2);
  });

  it('opt_in_buurt geeft +3', () => {
    expect(check({ actie: 'opt_in_buurt' }).delta).toBe(3);
  });

  it('telefoon_geverifieerd geeft +8 (eenmalig)', () => {
    expect(check({ actie: 'telefoon_geverifieerd', entryId: null }).delta).toBe(8);
  });

  it('mijlpalen geven correcte deltas', () => {
    expect(check({ actie: 'drempel_5_meldingen', entryId: null }).delta).toBe(3);
    expect(check({ actie: 'drempel_10_meldingen', entryId: null }).delta).toBe(5);
    expect(check({ actie: 'drempel_25_meldingen', entryId: null }).delta).toBe(5);
    expect(check({ actie: 'drempel_50_meldingen', entryId: null }).delta).toBe(5);
  });

  it('onbekende actie geeft geen bonus', () => {
    expect(check({ actie: 'onbekend' }).mag).toBe(false);
  });
});

// ── Gecombineerde scenario's ─────────────────────────────────────────────────

describe('Realistische scenario\'s', () => {
  it('nieuwe gebruiker (dag 1) krijgt nooit een bonus', () => {
    expect(check({ accountDagen: 1, normaleMeldingen: 0 }).mag).toBe(false);
  });

  it('gevestigde gebruiker met kwaliteitsmelding krijgt bonus', () => {
    const result = check({ accountDagen: 90, normaleMeldingen: 20 });
    expect(result.mag).toBe(true);
    expect(result.delta).toBe(2);
  });

  it('kwaadwillende die spaamt op één perceel krijgt geen bonus', () => {
    expect(check({ perceelMeldingenIn24h: 8, normaleMeldingen: 10 }).mag).toBe(false);
  });

  it('dag cap laat twee melding_volledig door maar niet drie', () => {
    // Eerste melding: +2 (dagBonus = 0 → rest = 5)
    const r1 = check({ dagelijkseSomEntryBonussen: 0, actie: 'melding_volledig' });
    expect(r1.delta).toBe(2); // dagBonus wordt 2

    // Tweede melding: +2 (dagBonus = 2 → rest = 3)
    const r2 = check({ dagelijkseSomEntryBonussen: 2, actie: 'melding_volledig' });
    expect(r2.delta).toBe(2); // dagBonus wordt 4

    // Derde melding: +1 (dagBonus = 4 → rest = 1)
    const r3 = check({ dagelijkseSomEntryBonussen: 4, actie: 'melding_volledig' });
    expect(r3.delta).toBe(1); // dagBonus wordt 5

    // Vierde melding: geblokkeerd (dagBonus = 5 → cap bereikt)
    const r4 = check({ dagelijkseSomEntryBonussen: 5, actie: 'melding_volledig' });
    expect(r4.mag).toBe(false);
  });
});
