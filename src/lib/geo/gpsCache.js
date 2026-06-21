// Cache van de laatst bekende GPS-positie van de gebruiker — laat de
// formulier- en dashboardkaart bij het openen meteen in de buurt van de
// gebruiker centreren, in plaats van pas na de eerste (soms trage)
// watchPosition-fix. Wordt bij elke nieuwe fix overschreven; geen TTL,
// want een verouderde positie is nog steeds een betere eerste gok dan het
// NL-centrum of de thuislocatie.
const SLEUTEL = 'spuitlog_laatste_gps';

export function laadGpsCache() {
  try {
    const ruw = localStorage.getItem(SLEUTEL);
    if (!ruw) return null;
    const data = JSON.parse(ruw);
    if (typeof data?.lat !== 'number' || typeof data?.lng !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function slaGpsCacheOp(lat, lng, accuracy) {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify({ lat, lng, accuracy: accuracy || null, tijd: Date.now() }));
  } catch { /* localStorage niet beschikbaar */ }
}
