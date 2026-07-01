import { useEffect, useMemo, useState } from 'react';
import { haalMeldingenVoorGroep } from '../lib/groepen/groepen.js';
import { bepaalZichtbaarheidsniveau, velden } from '../lib/groepen/trustZichtbaarheid.js';

// Zet een ruwe entries_groepen-rij (haalMeldingenVoorGroep) om naar een
// veilige weergavevorm die zowel kaart-/kaartweergave-componenten
// (verwachten platte gps_lat/gps_lng + genest gps.lat/lng) als de
// meldingkaarten/detailmodal kan gebruiken — met redactie op basis van
// `toon` (lib/groepen/trustZichtbaarheid.js), zodat een lage-trust-kijker
// nooit exacte locatie/omschrijving/melderinfo binnenkrijgt.
function naarVeiligeWeergave(entry, toon) {
  const heeftLocatie = toon.exacteLocatie && entry.gps_lat != null && entry.gps_lng != null;
  return {
    ...entry,
    description: toon.metadata ? (entry.description || '') : '',
    gemeente: toon.grofweLocatie ? entry.gemeente : null,
    provincie: toon.grofweLocatie ? entry.provincie : null,
    melder_email: toon.melderInfo ? entry.melder_email : null,
    gps_lat: heeftLocatie ? entry.gps_lat : null,
    gps_lng: heeftLocatie ? entry.gps_lng : null,
    perceelnummer: heeftLocatie ? entry.perceelnummer : null,
    gps: heeftLocatie ? { lat: entry.gps_lat, lng: entry.gps_lng } : null
  };
}

// Gedeelde data-/trust-gate-logica voor alles wat groepsmeldingen toont
// (GroepMeldingenLijst.jsx, DashboardPage.jsx se groepsfilter) — één
// plek voor de fetch + de `toon`-redactie, zodat kaart/lijst/detailmodal
// altijd exact dezelfde geredigeerde data zien. Beheerders krijgen
// altijd volledige inzage, ongeacht hun eigen trust score (zelfde regel
// als voorheen losstaand in GroepMeldingenLijst.jsx).
export function useGroepMeldingen(groepId, { viewerTrustScore, isBeheerder } = {}) {
  const [ruw, setRuw] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (!groepId) { setRuw(null); setFout(null); return; }
    let actief = true;
    setRuw(null);
    setFout(null);
    haalMeldingenVoorGroep(groepId)
      .then((data) => { if (actief) setRuw(data); })
      .catch((err) => { if (actief) setFout(err.message); });
    return () => { actief = false; };
  }, [groepId]);

  const niveau = isBeheerder ? 'hoog' : bepaalZichtbaarheidsniveau(viewerTrustScore);
  const toon = velden(niveau);

  const meldingen = useMemo(
    () => (ruw || []).map((m) => naarVeiligeWeergave(m, toon)).sort((a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local)),
    [ruw, toon]
  );

  const verwijderLokaal = (meldingId) => {
    setRuw((prev) => (prev || []).filter((m) => m.id !== meldingId));
  };

  return {
    meldingen,
    toon,
    niveau,
    laden: Boolean(groepId) && ruw == null && !fout,
    fout,
    verwijderLokaal
  };
}
