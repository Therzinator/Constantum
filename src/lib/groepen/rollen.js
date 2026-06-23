// Per-groep rolcontroles — zelfde pure/stateless-conventie als
// src/lib/rollen.js (globale rollen), maar dan voor de rol die een
// gebruiker binnen één specifieke groep heeft (groep_leden.rol).

export function isGroepBeheerder(groepRol) {
  return groepRol === 'beheerder' || groepRol === 'hoofdbeheerder';
}

export function isGroepHoofdbeheerder(groepRol) {
  return groepRol === 'hoofdbeheerder';
}
