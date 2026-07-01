// Onthoudt of de gebruiker al eerder akkoord ging met de Algemene
// Voorwaarden/Privacyverklaring op het inlogscherm (AuthOverlay.jsx),
// zodat het vinkje niet bij elk bezoek opnieuw aangezet hoeft te worden.
// Zelfde opt-in/opt-out-patroon als handleidingStatus.js/deelvoorkeur.js.
const SLEUTEL = 'spuitlogger_av_privacy_akkoord';

export function laadAkkoordVoorkeur() {
  try {
    return localStorage.getItem(SLEUTEL) === 'true';
  } catch {
    return false;
  }
}

export function slaAkkoordVoorkeurOp(akkoord) {
  try {
    localStorage.setItem(SLEUTEL, String(akkoord));
  } catch { /* localStorage niet beschikbaar */ }
}
