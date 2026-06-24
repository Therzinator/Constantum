import { useEffect, useState } from 'react';
import {
  haalEntriesVoorBuurtrapport,
  haalAlleProfielenAdmin,
  maakBuurtdossier,
  haalBuurtdossiers
} from '../../lib/supabase/admin.js';
import {
  filterVoorBuurtrapport,
  windroosPerPerceel,
  seizoenspatroon,
  bewijswaardescore
} from '../../lib/meldingen/buurtrapport.js';
import { genereerBuurtrapportHTML, openBuurtrapportPDF } from '../../lib/export/buurtrapportPdf.js';
import { laadKNMIKey, haalKNMIWeerdata } from '../../lib/weather/knmi.js';

// Coordinatie & Admin systeem, Fase 6/7 — buurtrapport-generator. Leeft in
// CoordinatiePage (admin-only). KNMI-dekking is een best-effort LIVE check
// (loopt door de gefilterde meldingen heen en checkt per stuk of er een
// KNMI-station beschikbaar is) — wordt niet historisch bijgehouden, dus
// elke generatie controleert opnieuw en kan een paar seconden duren.
export function BuurtrapportGenerator({ user, voorgeselecteerdPostcodegebied }) {
  const [postcodegebied, setPostcodegebied] = useState('');
  const [periodeVan, setPeriodeVan] = useState('');
  const [periodeTot, setPeriodeTot] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [dossiers, setDossiers] = useState([]);

  useEffect(() => { haalBuurtdossiers().then(setDossiers).catch(() => {}); }, []);

  // Vult het veld voor met het dominante postcodegebied uit het provincie/
  // gemeente-filter op CoordinatiePage (zelf werkt deze generator nog op
  // postcode, niet op gemeente — zie module-comment hierboven). Afgeleide
  // waarde i.p.v. een effect dat de state zelf overschrijft: zodra de
  // gebruiker zelf typt wint postcodegebied, anders de voorgestelde
  // waarde — geen risico op het overschrijven van actieve invoer.
  const weergegevenPostcodegebied = postcodegebied || voorgeselecteerdPostcodegebied || '';

  const handleGenereer = async () => {
    const postcodegebiedVoorAanvraag = weergegevenPostcodegebied;
    if (!/^\d{4}$/.test(postcodegebiedVoorAanvraag)) {
      setFout('Vul een geldig 4-cijferig postcodegebied in (bv. 1234)');
      return;
    }
    setFout(null);
    setBezig(true);
    try {
      const ruweEntries = await haalEntriesVoorBuurtrapport(postcodegebiedVoorAanvraag);
      const entries = filterVoorBuurtrapport(ruweEntries, postcodegebiedVoorAanvraag, periodeVan, periodeTot);

      if (!entries.length) {
        setFout('Geen opt-in-meldingen gevonden voor dit postcodegebied/periode');
        setBezig(false);
        return;
      }

      const aantalMelders = new Set(entries.map((e) => e.user_id)).size;
      const rfc3161Percentage = Math.round((entries.filter((e) => e.rfc3161).length / entries.length) * 100);

      const knmiKey = laadKNMIKey();
      let knmiPercentage = null;
      if (knmiKey) {
        let gevonden = 0;
        for (const e of entries) {
          if (e.gps_lat == null || e.gps_lng == null) continue;
          const data = await haalKNMIWeerdata(e.gps_lat, e.gps_lng, e.timestamp_local, knmiKey).catch(() => null);
          if (data) gevonden++;
        }
        knmiPercentage = Math.round((gevonden / entries.length) * 100);
      }

      const profielen = await haalAlleProfielenAdmin();
      const profielMap = new Map(profielen.map((p) => [p.id, p]));
      const betrokkenUserIds = [...new Set(entries.map((e) => e.user_id))];
      const profielTrustScores = betrokkenUserIds
        .map((id) => profielMap.get(id)?.trust_score)
        .filter((t) => t != null);

      const score = bewijswaardescore({
        aantalMelders,
        rfc3161Percentage,
        knmiPercentage,
        gemiddeldeTrustScore: profielTrustScores.length
          ? profielTrustScores.reduce((s, t) => s + t, 0) / profielTrustScores.length
          : null
      });

      const rapport = {
        postcodegebied: postcodegebiedVoorAanvraag,
        periodeVan: periodeVan || null,
        periodeTot: periodeTot || null,
        aantalMelders,
        aantalMeldingen: entries.length,
        rfc3161Percentage,
        knmiPercentage,
        seizoenspatroon: seizoenspatroon(entries),
        windroosPerPerceel: windroosPerPerceel(entries),
        bewijswaardescore: score
      };

      await maakBuurtdossier(rapport, user?.id || null);
      setDossiers(await haalBuurtdossiers());
      openBuurtrapportPDF(genereerBuurtrapportHTML(rapport));
    } catch (err) {
      setFout(err.message);
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="section-label mb-3">📋 Buurtrapport genereren</div>
      <div className="export-card-beschrijving mb-3">
        Geanonimiseerd collectief rapport over een postcodegebied. Alleen
        meldingen met opt_in_buurt=true tellen mee.
      </div>

      <label className="export-info-rij">
        <span>Postcodegebied (4 cijfers)</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={weergegevenPostcodegebied}
          onChange={(e) => setPostcodegebied(e.target.value)}
          placeholder="1234"
        />
      </label>
      <label className="export-info-rij">
        <span>Periode van</span>
        <input type="date" value={periodeVan} onChange={(e) => setPeriodeVan(e.target.value)} />
      </label>
      <label className="export-info-rij">
        <span>Periode tot</span>
        <input type="date" value={periodeTot} onChange={(e) => setPeriodeTot(e.target.value)} />
      </label>

      {fout && <div className="export-card-beschrijving mt-2" style={{ color: 'var(--danger)' }}>{fout}</div>}

      <button type="button" className="btn-outline px-4 py-2 mt-3" disabled={bezig} onClick={handleGenereer}>
        {bezig ? '⏳ Genereren...' : '📋 Genereer rapport'}
      </button>

      {dossiers.length > 0 && (
        <div className="mt-3">
          <div className="section-label mb-2">Eerder gegenereerd</div>
          {dossiers.map((d) => (
            <div key={d.id} className="export-info-rij">
              <span>{d.postcodegebied} · {d.aantal_meldingen} meldingen ({new Date(d.created_at).toLocaleDateString('nl-NL')})</span>
              <button type="button" className="btn-outline px-2 py-1" onClick={() => openBuurtrapportPDF(genereerBuurtrapportHTML(d.rapport_json))}>
                📄 Openen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
