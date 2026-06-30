// Gedeelde trust-score hulpfuncties.
// Tiers volgen migraties 0022/0023/0024 — niet wijzigen zonder bevestiging.

const TIERS = [
  { label: '0–19', min: 0, max: 19, kleur: 'var(--danger)', naam: 'shadow' },
  { label: '20–39', min: 20, max: 39, kleur: 'var(--warning)', naam: 'under_review' },
  { label: '40–79', min: 40, max: 79, kleur: '#eab308', naam: 'standaard' },
  { label: '80–100', min: 80, max: 100, kleur: '#22c55e', naam: 'vertrouwd' },
];

export function trustScoreTier(score) {
  const s = score ?? 75;
  return TIERS.find((t) => s >= t.min && s <= t.max) ?? TIERS[2];
}
