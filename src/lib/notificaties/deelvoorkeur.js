// Coordinatie & Admin systeem, Fase 3 — standaard opt-in-voorkeur voor het
// delen van nieuwe meldingen met de buurt (opt_in_buurt). Los van
// buurtMelding.js, dat over het bereik van het ONTVANGEN van andermans
// gedeelde meldingen gaat — dit gaat over het zelf delen van eigen
// meldingen. De checkbox per melding (MeldingForm.jsx) blijft altijd
// aanpasbaar; dit is alleen de vooringevulde standaardwaarde bij een
// nieuw formulier.
const SLEUTEL = 'spuitlog_deelvoorkeur_opt_in_buurt';
const SLEUTEL_GROEPEN = 'spuitlog_deelvoorkeur_opt_in_groepen';

export function laadDeelVoorkeur() {
  try {
    return localStorage.getItem(SLEUTEL) === 'true';
  } catch {
    return false;
  }
}

export function slaDeelVoorkeurOp(optIn) {
  try {
    localStorage.setItem(SLEUTEL, String(optIn));
  } catch { /* localStorage niet beschikbaar */ }
}

// Zelfde onthoud-patroon, voor de "deel met je groepen"-checkbox
// (MeldingForm.jsx) — de melder zet 'm aan/uit per melding, en die laatste
// keuze wordt de vooringevulde standaard voor de volgende melding.
export function laadDeelVoorkeurGroepen() {
  try {
    return localStorage.getItem(SLEUTEL_GROEPEN) === 'true';
  } catch {
    return false;
  }
}

export function slaDeelVoorkeurGroepenOp(optIn) {
  try {
    localStorage.setItem(SLEUTEL_GROEPEN, String(optIn));
  } catch { /* localStorage niet beschikbaar */ }
}
