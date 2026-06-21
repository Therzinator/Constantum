// Voorkeur voor de live GPS-pin op de dashboardkaart — staat los van de
// GPS-positie van de melder op de formulier-kaart (LocatieKaart.jsx), die
// altijd actief is. Hier kan de gebruiker zelf kiezen of de eigen locatie
// ook op het dashboard-overzicht getoond wordt.
const SLEUTEL = 'spuitlog_dashboard_gps_aan';

export function laadGpsVoorkeur() {
  try {
    return localStorage.getItem(SLEUTEL) === 'true';
  } catch {
    return false;
  }
}

export function slaGpsVoorkeurOp(aan) {
  try {
    localStorage.setItem(SLEUTEL, String(aan));
  } catch { /* localStorage niet beschikbaar */ }
}
