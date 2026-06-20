// Voortgangsindicatie meldingformulier (Baymard: laat zien hoe volledig een
// lang formulier is, ook voor optionele secties — niet alleen de verplichte
// velden). Geeft een percentage en de afzonderlijke stappen terug.
export function berekenVoortgang(veld) {
  // "Drift & overlast" telt hier bewust niet mee: dat veld start op 'nvt'
  // maar de bijbehorende spuitrichtlijn-beoordeling wordt al automatisch
  // afgeleid uit de meteodata zodra de pin staat — meewegen zou de indruk
  // geven dat hier nog actieve invoer nodig is terwijl een groot deel al
  // automatisch is ingevuld.
  // Volgorde komt overeen met de volgorde van de secties in het formulier
  // zelf (MeldingForm.jsx) — Teler & gewas staat daar vóór Foto's/video's.
  const stappen = [
    { key: 'locatie', label: 'Locatie op perceel', klaar: Boolean(veld.perceelnummer) },
    { key: 'type', label: 'Type waarneming', klaar: veld.types.length > 0 },
    { key: 'omschrijving', label: 'Omschrijving', klaar: Boolean(veld.description.trim()) },
    { key: 'teler', label: 'Teler & gewas', klaar: Boolean(veld.bedrijfsnaam.trim() || veld.gewas) },
    { key: 'fotos', label: "Foto's/video's", klaar: veld.bestanden.length > 0 }
  ];
  const aantalKlaar = stappen.filter((s) => s.klaar).length;
  return {
    stappen,
    percentage: Math.round((aantalKlaar / stappen.length) * 100)
  };
}
