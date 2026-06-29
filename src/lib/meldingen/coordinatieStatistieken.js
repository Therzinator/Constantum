// Coordinatie & Admin systeem, Fase 4 — pure aggregatiefuncties voor het
// admin-dashboard. Werken op de ruwe rijen uit lib/supabase/admin.js
// zodat ze, net als perceelStatistieken() in statistieken.js, los van
// React en los van Supabase getest kunnen worden.

// Trust-scores in buckets van 20 (0-19, 20-39, ..., 80-100) — voor een
// eenvoudige verdelingsweergave zonder grafiekbibliotheek erbij te halen.
export function trustScoreVerdeling(profielen) {
  const buckets = [
    { label: '0-19', min: 0, max: 19, aantal: 0 },
    { label: '20-39', min: 20, max: 39, aantal: 0 },
    { label: '40-59', min: 40, max: 59, aantal: 0 },
    { label: '60-79', min: 60, max: 79, aantal: 0 },
    { label: '80-100', min: 80, max: 100, aantal: 0 }
  ];
  profielen.forEach((p) => {
    const score = p.trust_score ?? 75;
    const bucket = buckets.find((b) => score >= b.min && score <= b.max);
    if (bucket) bucket.aantal++;
  });
  return buckets;
}

// Meldingen gegroepeerd per melder (user_id), met trust_score erbij —
// voor het melder-overzicht op Melder#XXXXXX-code.
export function meldersOverzicht(entries, profielen) {
  const profielMap = new Map(profielen.map((p) => [p.id, p]));
  const perMelder = {};

  entries.forEach((e) => {
    if (!e.user_id) return;
    if (!perMelder[e.user_id]) {
      perMelder[e.user_id] = {
        userId: e.user_id,
        melderEmail: e.melder_email,
        aantalMeldingen: 0,
        aantalUnderReview: 0,
        aantalShadow: 0,
        trustScore: profielMap.get(e.user_id)?.trust_score ?? null
      };
    }
    perMelder[e.user_id].aantalMeldingen++;
    if (e.visibility === 'under_review') perMelder[e.user_id].aantalUnderReview++;
    if (e.visibility === 'shadow') perMelder[e.user_id].aantalShadow++;
  });

  return Object.values(perMelder).sort((a, b) => b.aantalMeldingen - a.aantalMeldingen);
}

// Meldingen die momenteel onder review of shadow staan (Fase 2/5-triggers
// of handmatige moderatie) — input voor de misbruikdetectie-weergave.
export function meldingenOnderReview(entries) {
  return entries.filter((e) => e.visibility === 'under_review' || e.visibility === 'shadow');
}

// Provincie/gemeente-filter (Coördinatiepagina) — gemeente/provincie komen
// uit migratie 0013, alleen gevuld voor meldingen die na die migratie
// aangemaakt of via de admin-backfill aangevuld zijn; oudere meldingen
// zonder deze velden vallen buiten elk provincie/gemeente-filter (komen
// wel nog gewoon mee als er niet gefilterd wordt).
export function provincies(entries) {
  return [...new Set(entries.map((e) => e.provincie).filter(Boolean))].sort();
}

export function gemeentenInProvincie(entries, provincie) {
  if (!provincie) return [];
  return [...new Set(
    entries.filter((e) => e.provincie === provincie).map((e) => e.gemeente).filter(Boolean)
  )].sort();
}

export function filterOpRegio(entries, provincie, gemeente) {
  if (!provincie) return entries;
  return entries.filter((e) => {
    if (e.provincie !== provincie) return false;
    if (gemeente && e.gemeente !== gemeente) return false;
    return true;
  });
}
