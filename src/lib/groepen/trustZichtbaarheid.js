// Trust-tier-gestuurde detailweergave van groepsmeldingen (opdracht
// sectie 5). Hergebruikt de bandbreedtes uit migratie 0014
// (fn_entries_set_visibility, supabase/migrations/0014_trust_score_op_afschaling.sql)
// zodat er maar één bron van trust-tier-grenzen in het project bestaat.
// Het trust_score van de KIJKER (niet de melder) bepaalt hoeveel detail
// die te zien krijgt van een melding die met de groep gedeeld is — de
// toegangs-gate zelf (is de melding wel met deze groep gedeeld, ben je
// wel lid) is database-/RLS-niveau, zie migratie 0015.
//
// Configureerbaar via dit array i.p.v. hardcoded if/else, zodat een
// toekomstig extra niveau (bv. een tussenliggende band) hier toegevoegd
// kan worden zonder de aanroepende code te wijzigen.
const NIVEAUS = [
  { niveau: 'laag', minScore: 0, maxScore: 39 },
  { niveau: 'gemiddeld', minScore: 40, maxScore: 79 },
  { niveau: 'hoog', minScore: 80, maxScore: 100 }
];

export function bepaalZichtbaarheidsniveau(trustScore) {
  const score = Number.isFinite(trustScore) ? trustScore : 75; // zelfde fallback als fn_entries_set_visibility
  const match = NIVEAUS.find((n) => score >= n.minScore && score <= n.maxScore);
  return match ? match.niveau : 'gemiddeld';
}

// Welke meldingvelden een niveau mag zien (sectie 5 van de opdracht:
// lage trust score → alleen algemene melding, geen exacte locatie/
// metadata/gebruikersinfo; gemiddeld → meer detail, grovere locatie;
// hoog → volledige informatie).
// `fotos` hergebruikt dezelfde "hoog"-drempel als exacteLocatie/melderInfo
// — een foto kan net als exacte GPS de melder herleidbaar maken, dus
// dezelfde voorzichtige grens i.p.v. al bij "gemiddeld" tonen.
const VELDEN_PER_NIVEAU = {
  laag: { exacteLocatie: false, metadata: false, melderInfo: false, grofweLocatie: false, fotos: false },
  gemiddeld: { exacteLocatie: false, metadata: true, melderInfo: false, grofweLocatie: true, fotos: false },
  hoog: { exacteLocatie: true, metadata: true, melderInfo: true, grofweLocatie: true, fotos: true }
};

export function velden(niveau) {
  return VELDEN_PER_NIVEAU[niveau] || VELDEN_PER_NIVEAU.gemiddeld;
}
