import { lazy, Suspense, useEffect, useState } from 'react';
import { melderCode } from '../../utils/format.js';
import {
  haalAlleEntriesAdmin,
  haalAlleProfielenAdmin,
  zetTrustScoreAdmin,
  zetVisibilityAdmin,
  haalEntriesZonderPostcode,
  zetPostcodeAdmin,
  haalEntriesZonderGemeente,
  zetGemeenteProvincieAdmin
} from '../../lib/supabase/admin.js';
import { zoekPostcodePDOK, zoekGemeenteProvinciePDOK } from '../../lib/pdok/postcode.js';
import { perceelStatistieken, windrichtingPerPerceel } from '../../lib/meldingen/statistieken.js';
import { BuurtrapportGenerator } from './BuurtrapportGenerator.jsx';
import {
  meldersPerPostcode,
  trustScoreVerdeling,
  meldersOverzicht,
  meldingenOnderReview,
  provincies,
  gemeentenInProvincie,
  filterOpRegio
} from '../../lib/meldingen/coordinatieStatistieken.js';
import './CoordinatiePage.css';

// Lazy — trekt OpenLayers mee, alleen nodig zolang dit specifieke onderdeel
// van CoördinatiePage in beeld is.
const BuurtgebiedTekenaar = lazy(() => import('./BuurtgebiedTekenaar.jsx').then((m) => ({ default: m.BuurtgebiedTekenaar })));

// Coordinatie & Admin systeem, Fase 4 — admin-panel. Bereikbaar via de
// "Coördinatie"-tab, zichtbaar voor role='admin' én role='coordinator'
// (een moderator-achtige rol, zie BottomNav.jsx/App.jsx/lib/rollen.js) —
// de echte afscherming gebeurt via de admin/coordinator-RLS-bypass uit
// migraties 0004/0011, niet hier. Alle acties hieronder (modereren,
// trust-score, postcode-backfill, buurtrapport) zijn voor coordinators
// toegestaan; alleen account-verwijdering (migratie 0008), de Prullenbak
// (InstellingenPage) én — sinds 2026-06-22, zie DECISIONS.md — de
// buurtgebied-CSV/Dossier-PDF-export (BuurtgebiedTekenaar.jsx) blijven
// admin-only: die exporteert individuele meldingen incl. PII van andere
// melders, en de gebruiker wil die actie liever zelf blijven uitvoeren
// i.p.v. een coordinator-sleutel daarvoor uit te delen.
export function CoordinatiePage({ user, thuislocatie, gebruikerRol }) {
  const [entries, setEntries] = useState(null);
  const [profielen, setProfielen] = useState(null);
  const [fout, setFout] = useState(null);
  const [bezigId, setBezigId] = useState(null);
  const [backfillBezig, setBackfillBezig] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState(null);
  const [gemeenteBackfillBezig, setGemeenteBackfillBezig] = useState(false);
  const [gemeenteBackfillStatus, setGemeenteBackfillStatus] = useState(null);
  const [filterProvincie, setFilterProvincie] = useState('');
  const [filterGemeente, setFilterGemeente] = useState('');

  const laad = async () => {
    try {
      const [e, p] = await Promise.all([haalAlleEntriesAdmin(), haalAlleProfielenAdmin()]);
      setEntries(e);
      setProfielen(p);
    } catch (err) {
      setFout(err.message);
    }
  };

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const [e, p] = await Promise.all([haalAlleEntriesAdmin(), haalAlleProfielenAdmin()]);
        if (actief) { setEntries(e); setProfielen(p); }
      } catch (err) {
        if (actief) setFout(err.message);
      }
    })();
    return () => { actief = false; };
  }, []);

  if (fout) return <div className="p-4"><div className="card p-4" style={{ color: 'var(--danger)' }}>Laden mislukt: {fout}</div></div>;
  if (!entries || !profielen) return <div className="p-4">Laden...</div>;

  const perPostcode = meldersPerPostcode(entries);
  const verdeling = trustScoreVerdeling(profielen);
  const provincieOpties = provincies(entries);
  const gemeenteOpties = gemeentenInProvincie(entries, filterProvincie);
  const entriesGefilterd = filterOpRegio(entries, filterProvincie, filterGemeente);
  const perceelStats = perceelStatistieken(entriesGefilterd);
  const windroosPerPerceel = windrichtingPerPerceel(entriesGefilterd);
  const melders = meldersOverzicht(entriesGefilterd, profielen);
  const onderReview = meldingenOnderReview(entriesGefilterd);

  // Gemiddelde GPS van de gefilterde meldingen — centreert Buurtgebied
  // tekenen op de geselecteerde regio i.p.v. altijd op thuislocatie, zodat
  // het filter ook daar effect heeft (die tool toont zelf geen meldingen,
  // alleen een losse teken-kaart). Geen useMemo: deze component heeft al
  // vroege returns vóór dit punt (laden/foutstatus), dus een hook hier zou
  // afhankelijk van renderpad een wisselend aantal hooks opleveren.
  let filterCentrum = null;
  if (filterProvincie) {
    const metGps = entriesGefilterd.filter((e) => e.gps_lat != null && e.gps_lng != null);
    if (metGps.length) {
      filterCentrum = {
        lat: metGps.reduce((s, e) => s + e.gps_lat, 0) / metGps.length,
        lng: metGps.reduce((s, e) => s + e.gps_lng, 0) / metGps.length
      };
    }
  }

  // Meest voorkomende 4-cijferige postcode-prefix binnen het filter — vult
  // het postcodegebied-veld van BuurtrapportGenerator voor (die werkt zelf
  // op postcode, niet op gemeente/provincie, zie BuurtrapportGenerator.jsx).
  let voorgeselecteerdPostcodegebied = '';
  if (filterProvincie) {
    const tellingen = {};
    entriesGefilterd.forEach((e) => {
      const prefix = e.postcode?.slice(0, 4);
      if (prefix) tellingen[prefix] = (tellingen[prefix] || 0) + 1;
    });
    const gesorteerd = Object.entries(tellingen).sort((a, b) => b[1] - a[1]);
    voorgeselecteerdPostcodegebied = gesorteerd[0]?.[0] || '';
  }

  const handleTrustScore = async (userId, waarde) => {
    setBezigId(userId);
    try {
      await zetTrustScoreAdmin(userId, waarde);
      await laad();
    } finally {
      setBezigId(null);
    }
  };

  const handleGoedkeuren = async (entryId) => {
    setBezigId(entryId);
    try {
      await zetVisibilityAdmin(entryId, 'normal');
      await laad();
    } finally {
      setBezigId(null);
    }
  };

  // Tegenhanger van Goedkeuren — een handmatige shadow door een mens-
  // beoordeling geeft sinds migratie 0014 een zwaardere trust-score-straf
  // (-30) dan automatische misbruikdetectie (-20/-15, migratie 0005). De
  // straf zit in de AFTER UPDATE-trigger op entries.visibility, niet hier
  // in de UI — deze knop levert alleen de (voorheen ontbrekende) actie om
  // die trigger te kunnen raken.
  const handleVerbergen = async (entryId) => {
    if (!confirm('Deze melding verbergen (shadow)? Dit verlaagt de trust-score van de melder met 30 punten.')) return;
    setBezigId(entryId);
    try {
      await zetVisibilityAdmin(entryId, 'shadow');
      await laad();
    } finally {
      setBezigId(null);
    }
  };

  // Backfill (Fase 1-4) — historische meldingen van vóór migratie 0004
  // missen postcode (geen DEFAULT, dus niet automatisch ingevuld zoals
  // opt_in_buurt/visibility). Loopt sequentieel om de PDOK Locatieserver
  // niet te overbelasten.
  const handleBackfillPostcode = async () => {
    setBackfillBezig(true);
    try {
      const teBackfillen = await haalEntriesZonderPostcode();
      let gelukt = 0;
      for (let i = 0; i < teBackfillen.length; i++) {
        const e = teBackfillen[i];
        setBackfillStatus(`${i + 1} / ${teBackfillen.length}`);
        const postcode = await zoekPostcodePDOK(e.gps_lat, e.gps_lng).catch(() => null);
        if (postcode) {
          await zetPostcodeAdmin(e.id, postcode);
          gelukt++;
        }
      }
      setBackfillStatus(`Klaar — ${gelukt} / ${teBackfillen.length} meldingen aangevuld`);
      await laad();
    } catch (err) {
      setBackfillStatus(`Mislukt: ${err.message}`);
    } finally {
      setBackfillBezig(false);
    }
  };

  // Backfill voor het provincie/gemeente-filter (migratie 0013) — zelfde
  // aanpak als de postcode-backfill hierboven, eigen los traject omdat
  // gemeente/provincie een eigen kolom/PDOK-call zijn.
  const handleBackfillGemeente = async () => {
    setGemeenteBackfillBezig(true);
    try {
      const teBackfillen = await haalEntriesZonderGemeente();
      let gelukt = 0;
      for (let i = 0; i < teBackfillen.length; i++) {
        const e = teBackfillen[i];
        setGemeenteBackfillStatus(`${i + 1} / ${teBackfillen.length}`);
        const r = await zoekGemeenteProvinciePDOK(e.gps_lat, e.gps_lng).catch(() => null);
        if (r?.gemeente) {
          await zetGemeenteProvincieAdmin(e.id, r.gemeente, r.provincie);
          gelukt++;
        }
      }
      setGemeenteBackfillStatus(`Klaar — ${gelukt} / ${teBackfillen.length} meldingen aangevuld`);
      await laad();
    } catch (err) {
      setGemeenteBackfillStatus(`Mislukt: ${err.message}`);
    } finally {
      setGemeenteBackfillBezig(false);
    }
  };

  return (
    <div className="p-4 coordinatie-page">
      <div className="export-titel">Coördinatie</div>
      <div className="export-subtitel">Admin/coordinator-overzicht — niet zichtbaar voor gewone gebruikers</div>

      <div className="card p-4">
        <div className="section-label mb-3">🗺️ Filter op provincie/gemeente</div>
        <div className="export-card-beschrijving mb-3">
          Filtert perceel-analyse, windroos, melder-overzicht en onder
          review/shadow hieronder, centreert Buurtgebied tekenen op de
          regio en vult het postcodegebied van Buurtrapport genereren voor.
          Meldingen zonder provincie/gemeente (van vóór migratie 0013)
          vallen buiten elk filter — eenmalig aanvullen via PDOK.
        </div>
        <label className="export-info-rij">
          <span>Provincie</span>
          <select
            value={filterProvincie}
            onChange={(e) => { setFilterProvincie(e.target.value); setFilterGemeente(''); }}
          >
            <option value="">Alle provincies</option>
            {provincieOpties.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {filterProvincie && (
          <label className="export-info-rij">
            <span>Gemeente</span>
            <select value={filterGemeente} onChange={(e) => setFilterGemeente(e.target.value)}>
              <option value="">Alle gemeenten in {filterProvincie}</option>
              {gemeenteOpties.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
        {provincieOpties.length === 0 && (
          <div className="export-card-beschrijving mt-2">Nog geen meldingen met provincie/gemeente gevonden.</div>
        )}
        <button type="button" className="btn-outline px-3 py-1 mt-2" disabled={gemeenteBackfillBezig} onClick={handleBackfillGemeente}>
          {gemeenteBackfillBezig ? `⏳ Bezig... ${gemeenteBackfillStatus || ''}` : '🗺️ Provincie/gemeente backfillen'}
        </button>
        {!gemeenteBackfillBezig && gemeenteBackfillStatus && <div className="export-card-beschrijving mt-2">{gemeenteBackfillStatus}</div>}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">📮 Opt-in-melders per postcode</div>
        {perPostcode.length === 0 && <div className="export-card-beschrijving">Geen opt-in-meldingen met postcode gevonden.</div>}
        {perPostcode.map((r) => (
          <div key={r.postcode} className="export-info-rij">
            <span>{r.postcode}</span>
            <span>{r.aantalMelders} melder{r.aantalMelders === 1 ? '' : 's'}</span>
          </div>
        ))}
        <div className="export-card-beschrijving mt-2">
          Historische meldingen (vóór de postcode-koppeling) missen dit
          veld nog — eenmalig aanvullen via PDOK.
        </div>
        <button type="button" className="btn-outline px-3 py-1 mt-2" disabled={backfillBezig} onClick={handleBackfillPostcode}>
          {backfillBezig ? `⏳ Bezig... ${backfillStatus || ''}` : '📮 Postcode backfillen'}
        </button>
        {!backfillBezig && backfillStatus && <div className="export-card-beschrijving mt-2">{backfillStatus}</div>}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">🛡️ Trust-score-verdeling</div>
        {verdeling.map((b) => (
          <div key={b.label} className="export-info-rij">
            <span>{b.label}</span>
            <span>{b.aantal} gebruiker{b.aantal === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">🌾 Perceel-analyse</div>
        {Object.keys(perceelStats).length === 0 && <div className="export-card-beschrijving">Geen percelen gevonden.</div>}
        {Object.entries(perceelStats).map(([perceel, stats]) => (
          <div key={perceel} className="export-info-rij">
            <span>{perceel}</span>
            <span>{stats.totaal}x · {stats.ditJaar}x dit jaar{stats.bovenWindNorm ? ` · ${stats.bovenWindNorm}x boven windnorm` : ''}</span>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">🧭 Windroos per perceel</div>
        {Object.keys(windroosPerPerceel).length === 0 && (
          <div className="export-card-beschrijving">Nog geen perceel met genoeg meldingen + winddata voor een windroos (minimaal 3).</div>
        )}
        {Object.entries(windroosPerPerceel).map(([perceel, w]) => (
          <div key={perceel} className="export-info-rij">
            <span>{perceel}</span>
            <span>
              {w.dominantPct}% uit het {w.dominanteRichting} ({w.totaal} meldingen met windrichting)
            </span>
          </div>
        ))}
        <div className="export-card-beschrijving mt-2">
          Een hoog percentage uit één richting is sterker bewijs van een
          patroon dan losse, onafhankelijke waarnemingen — toevallige
          spreiding zou rond een paar windrichtingen schommelen, niet
          structureel naar één kant overhellen.
        </div>
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">👥 Melder-overzicht</div>
        {melders.map((m) => (
          <div key={m.userId} className="coordinatie-melder-rij">
            <div className="export-info-rij">
              <span>{melderCode(m.melderEmail) || m.userId.slice(0, 8)}</span>
              <span>{m.aantalMeldingen} melding{m.aantalMeldingen === 1 ? '' : 'en'}{m.aantalUnderReview ? ` · ${m.aantalUnderReview} under review` : ''}{m.aantalShadow ? ` · ${m.aantalShadow} shadow` : ''}</span>
            </div>
            <div className="export-info-rij">
              <span>Trust score</span>
              <input
                type="number"
                min="0"
                max="100"
                defaultValue={m.trustScore ?? 75}
                disabled={bezigId === m.userId}
                className="coordinatie-trust-input"
                onBlur={(e) => {
                  const waarde = parseInt(e.target.value, 10);
                  if (!Number.isNaN(waarde) && waarde !== m.trustScore) handleTrustScore(m.userId, waarde);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <Suspense fallback={<div className="card p-4">Kaart laden...</div>}>
        <BuurtgebiedTekenaar thuislocatie={filterCentrum || thuislocatie} meldingen={entriesGefilterd} user={user} gebruikerRol={gebruikerRol} />
      </Suspense>

      <BuurtrapportGenerator user={user} voorgeselecteerdPostcodegebied={voorgeselecteerdPostcodegebied} />

      <div className="card p-4">
        <div className="section-label mb-3" style={{ color: 'var(--danger)' }}>🚩 Onder review / shadow</div>
        {onderReview.length === 0 && <div className="export-card-beschrijving">Geen meldingen onder review of shadow.</div>}
        {onderReview.map((e) => (
          <div key={e.id} className="export-info-rij">
            <span>{melderCode(e.melder_email) || '—'} · {e.type} · {e.visibility} · {new Date(e.timestamp_local).toLocaleDateString('nl-NL')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-outline px-2 py-1"
                disabled={bezigId === e.id}
                onClick={() => handleGoedkeuren(e.id)}
              >
                ✓ Goedkeuren
              </button>
              {e.visibility !== 'shadow' && (
                <button
                  type="button"
                  className="btn-outline px-2 py-1"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  disabled={bezigId === e.id}
                  onClick={() => handleVerbergen(e.id)}
                >
                  🚫 Verbergen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
