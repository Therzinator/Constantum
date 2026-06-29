// Coordinatie & Admin systeem — Buurtgebied tekenen → export/Dossier PDF.
// Zet een ruwe Supabase-`entries`-rij om naar dezelfde meldingvorm die
// genereerDossierHTML()/meldingenNaarCSV() verwachten (m.date/m.time/
// m.gps.lat/m.hash/...). Bewust een EIGEN, kleinere kopie van de mapping
// uit lib/supabase/entries.js (laadVanSupabase()) i.p.v. die functie te
// hergebruiken/refactoren — dit hier mist `bestanden` (worden apart per
// entry opgehaald, zie BuurtgebiedTekenaar.jsx) en hoeft niet met lokaal
// opgeslagen meldingen samengevoegd te worden zoals laadVanSupabase doet.
export function entryNaarExportMelding(entry) {
  const tsLocal = entry.timestamp_local || entry.created_at;
  return {
    id: entry.id,
    user_id: entry.user_id || null,
    timestamp_local: tsLocal,
    timestamp_utc: entry.timestamp_utc || tsLocal,
    date: new Date(tsLocal).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
    time: new Date(tsLocal).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
    timezone: 'Europe/Amsterdam',
    gps: { lat: entry.gps_lat ?? null, lng: entry.gps_lng ?? null, accuracy: null, status: 'van cloud' },
    type: entry.type || 'overig',
    types: entry.types?.length ? entry.types : [entry.type || 'overig'],
    description: entry.description || '',
    melder_email: entry.melder_email || null,
    geur_intensiteit: entry.geur_intensiteit ?? null,
    wind_subjectief: entry.wind_subjectief || null,
    richting_deg: entry.richting_deg ?? null,
    richting_compass: entry.richting_compass || null,
    bedrijfsnaam: entry.bedrijfsnaam || null,
    perceelnummer: entry.perceelnummer || null,
    gemeente: entry.gemeente || null,
    provincie: entry.provincie || null,
    gewas: entry.gewas || null,
    afstand_woning: entry.afstand_woning ?? null,
    afstand_woning_lat: entry.afstand_woning_lat ?? null,
    afstand_woning_lng: entry.afstand_woning_lng ?? null,
    gezondheidsklachten: entry.gezondheidsklachten || [],
    gezondheid_toestemming: entry.gezondheid_toestemming || false,
    opt_in_buurt: entry.opt_in_buurt || false,
    activiteiten: entry.activiteiten || [],
    drift_waarneming: entry.drift_waarneming || [],
    weather: entry.weather || null,
    warnings: entry.warnings || [],
    hash: entry.client_hash || null,
    rfc3161: entry.rfc3161 || null,
    bestanden: []
  };
}
