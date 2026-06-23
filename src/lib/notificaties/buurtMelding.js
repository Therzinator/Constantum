// Hard gemaximeerd op 5 km: een teler die zijn eigen thuislocatie als
// melding-adres invult mag niet op grotere afstand kunnen meekijken naar
// binnenkomende meldingen van anderen. Dit cijfer staat ook als absolute
// bovengrens in de RLS-policy (supabase/migrations/0009_buurt_radius_cap.sql)
// — deze instelling kan dus alleen vérnauwen, nooit verruimen.
export const STANDAARD_RADIUS_METER = 2500;
export const RADIUS_OPTIES = [1000, 2500, 5000];

const SLEUTEL_RADIUS = 'spuitlog_notificatie_radius';

// Hoe ver andermans gedeelde meldingen zichtbaar zijn op Dashboard/Tijdlijn
// (geen notificatiefunctie meer — die is verwijderd om de identiteit van
// melders te beschermen, zie docs/DECISIONS.md).
export function laadBereikMeter() {
  let radiusMeter = STANDAARD_RADIUS_METER;
  try {
    const opgeslagen = parseInt(localStorage.getItem(SLEUTEL_RADIUS), 10);
    if (RADIUS_OPTIES.includes(opgeslagen)) radiusMeter = opgeslagen;
  } catch { /* localStorage niet beschikbaar */ }
  return radiusMeter;
}

export function slaBereikMeterOp(radiusMeter) {
  try {
    localStorage.setItem(SLEUTEL_RADIUS, String(radiusMeter));
  } catch { /* localStorage niet beschikbaar */ }
}
