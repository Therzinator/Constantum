import { useEffect, useState } from 'react';
import {
  haalEntriesVoorBuurtrapport,
  haalGroepEntriesVoorBuurtrapport,
  haalAlleProfielenAdmin,
  maakBuurtdossier,
  haalBuurtdossiers,
  telOptInEntriesZonderGemeente
} from '../../lib/supabase/admin.js';
import {
  filterVoorBuurtrapport,
  windroosPerPerceel,
  seizoenspatroon,
  bewijswaardescore
} from '../../lib/meldingen/buurtrapport.js';
import { genereerBuurtrapportHTML, openBuurtrapportPDF } from '../../lib/export/buurtrapportPdf.js';
import { haalKNMIWeerdata } from '../../lib/weather/knmi.js';

// Coordinatie & Admin systeem, Fase 6/7 — buurtrapport-generator. Leeft in
// CoordinatiePage (admin-only). KNMI-dekking is een best-effort LIVE check
// (loopt door de gefilterde meldingen heen en checkt per stuk of er een
// KNMI-station beschikbaar is) — wordt niet historisch bijgehouden, dus
// elke generatie controleert opnieuw en kan een paar seconden duren.
export function BuurtrapportGenerator({ user, voorgeselecteerdGemeente, gemeenteOpties = [] }) {
  const [gemeente, setGemeente] = useState('');
  const [periodeVan, setPeriodeVan] = useState('');
  const [periodeTot, setPeriodeTot] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [dossiers, setDossiers] = useState([]);
  const [aantalZonderGemeente, setAantalZonderGemeente] = useState(null);

  useEffect(() => {
    haalBuurtdossiers().then(setDossiers).catch(() => {});
    telOptInEntriesZonderGemeente().then(setAantalZonderGemeente).catch(() => {});
  }, []);

  const weergegevenGemeente = gemeente || voorgeselecteerdGemeente || '';

  const handleGenereer = async () => {
    const gemeenteVoorAanvraag = weergegevenGemeente.trim();
    if (!gemeenteVoorAanvraag) {
      setFout('Vul een gemeente in');
      return;
    }
    setFout(null);
    setBezig(true);
    try {
      const [ruweEntries, groepEntries] = await Promise.all([
        haalEntriesVoorBuurtrapport(gemeenteVoorAanvraag),
        haalGroepEntriesVoorBuurtrapport(gemeenteVoorAanvraag).catch(() => [])
      ]);
      const gedeeldeIds = new Set(ruweEntries.map((e) => e.id));
      const gecombineerd = [...ruweEntries, ...groepEntries.filter((e) => !gedeeldeIds.has(e.id))];
      const entries = filterVoorBuurtrapport(gecombineerd, gemeenteVoorAanvraag, periodeVan, periodeTot);

      if (!entries.length) {
        setFout('Geen meldingen gevonden voor deze gemeente/periode');
        setBezig(false);
        return;
      }

      const aantalMelders = new Set(entries.map((e) => e.user_id)).size;
      const rfc3161Percentage = Math.round((entries.filter((e) => e.rfc3161).length / entries.length) * 100);

      let knmiPercentage = null;
      let gevonden = 0;
      for (const e of entries) {
        if (e.gps_lat == null || e.gps_lng == null) continue;
        const data = await haalKNMIWeerdata(e.gps_lat, e.gps_lng, e.timestamp_local).catch(() => null);
        if (data) gevonden++;
      }
      knmiPercentage = entries.length ? Math.round((gevonden / entries.length) * 100) : null;

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
        gebied: gemeenteVoorAanvraag,
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
        Geanonimiseerd collectief rapport per gemeente. Meldingen met opt_in_buurt=true én
        meldingen gedeeld met groepen tellen mee. Weerverificatie via Open-Meteo (geen API-key nodig).
      </div>

      <label className="export-info-rij">
        <span>Gemeente</span>
        {gemeenteOpties.length > 0 ? (
          <select value={weergegevenGemeente} onChange={(e) => setGemeente(e.target.value)}>
            <option value="">— kies gemeente —</option>
            {gemeenteOpties.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        ) : (
          <input
            type="text"
            value={weergegevenGemeente}
            onChange={(e) => setGemeente(e.target.value)}
            placeholder="bijv. Westland"
          />
        )}
      </label>
      <label className="export-info-rij">
        <span>Periode van</span>
        <input type="date" value={periodeVan} onChange={(e) => setPeriodeVan(e.target.value)} />
      </label>
      <label className="export-info-rij">
        <span>Periode tot</span>
        <input type="date" value={periodeTot} onChange={(e) => setPeriodeTot(e.target.value)} />
      </label>

      {aantalZonderGemeente > 0 && (
        <div className="export-card-beschrijving mt-2" style={{ color: 'var(--text-secondary)' }}>
          ℹ️ {aantalZonderGemeente} opt-in melding{aantalZonderGemeente !== 1 ? 'en' : ''} {aantalZonderGemeente !== 1 ? 'hebben' : 'heeft'} geen gemeente-data en {aantalZonderGemeente !== 1 ? 'vallen' : 'valt'} buiten dit rapport. Gebruik de backfill-knop hierboven om {aantalZonderGemeente !== 1 ? 'deze' : 'deze'} aan te vullen.
        </div>
      )}

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
