import { lazy, Suspense, useEffect, useState } from 'react';
import { Collapsible } from '../ui/Collapsible.jsx';
import { melderCode } from '../../utils/format.js';
import {
  haalAlleEntriesAdmin,
  haalAlleProfielenAdmin,
  zetTrustScoreAdmin,
  zetVisibilityAdmin,
  haalEntriesZonderGemeente,
  zetGemeenteProvincieAdmin
} from '../../lib/supabase/admin.js';
import { zoekGemeenteProvinciePDOK } from '../../lib/pdok/postcode.js';
import { perceelStatistieken, windrichtingPerPerceel } from '../../lib/meldingen/statistieken.js';
import { BuurtrapportGenerator } from './BuurtrapportGenerator.jsx';
import {
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

  const voorgeselecteerdGemeente = filterGemeente || (filterProvincie ? gemeenteOpties[0] || '' : '');

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
      setGemeenteBackfillStatus(`Klaar: ${gelukt} / ${teBackfillen.length} meldingen aangevuld`);
      await laad();
    } catch (err) {
      setGemeenteBackfillStatus(`Mislukt: ${err.message}`);
    } finally {
      setGemeenteBackfillBezig(false);
    }
  };

  const maxVerdeling = Math.max(1, ...verdeling.map((b) => b.aantal));
  const maxPerceelTotaal = Math.max(1, ...Object.values(perceelStats).map((s) => s.totaal));
  const maxDominantPct = Math.max(1, ...Object.values(windroosPerPerceel).map((w) => w.dominantPct));

  return (
    <div className="coordinatie-page">
      <div className="export-titel">Coördinatie</div>
      <div className="export-subtitel">Admin/coordinator-overzicht, niet zichtbaar voor gewone gebruikers</div>

      <Collapsible icoon="🗺️" titel="Filter op provincie/gemeente" defaultOpen>
        <div className="export-card-beschrijving mb-3">
          Filtert perceel-analyse, windroos, melder-overzicht en onder
          review/shadow hieronder, centreert Buurtgebied tekenen op de
          regio en vult de gemeente van Buurtrapport genereren voor.
          Meldingen zonder provincie/gemeente (van vóór migratie 0013)
          vallen buiten elk filter, eenmalig aanvullen via PDOK.
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
        <button type="button" className="btn-outline coordinatie-knop mt-2" disabled={gemeenteBackfillBezig} onClick={handleBackfillGemeente}>
          {gemeenteBackfillBezig ? `⏳ Bezig... ${gemeenteBackfillStatus || ''}` : '🗺️ Provincie/gemeente backfillen'}
        </button>
        {!gemeenteBackfillBezig && gemeenteBackfillStatus && <div className="export-card-beschrijving mt-2">{gemeenteBackfillStatus}</div>}
      </Collapsible>

      <Collapsible icoon="🚩" titel="Onder review / shadow" kleur="var(--danger)" badge={onderReview.length || null} defaultOpen>
        {onderReview.length === 0 && <div className="export-card-beschrijving">Geen meldingen onder review of shadow.</div>}
        {onderReview.map((e) => (
          <div key={e.id} className="coordinatie-review-rij">
            <div className="coordinatie-review-top">
              <span className={`badge ${e.visibility === 'shadow' ? 'badge-danger' : 'badge-warning'}`}>{e.visibility}</span>
              <span className="coordinatie-review-meta">{melderCode(e.melder_email) || '—'} · {e.type} · {new Date(e.timestamp_local).toLocaleDateString('nl-NL')}</span>
            </div>
            <div className="coordinatie-review-acties">
              <button
                type="button"
                className="btn-outline coordinatie-knop"
                disabled={bezigId === e.id}
                onClick={() => handleGoedkeuren(e.id)}
              >
                ✓ Goedkeuren
              </button>
              {e.visibility !== 'shadow' && (
                <button
                  type="button"
                  className="btn-outline coordinatie-knop"
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
      </Collapsible>

      <Collapsible icoon="🛡️" titel="Trust-score-verdeling">
        {verdeling.map((b) => (
          <div key={b.label} className="coordinatie-stat-rij">
            <div className="coordinatie-stat-label">
              <span>{b.label}</span>
              <span>{b.aantal} gebruiker{b.aantal === 1 ? '' : 's'}</span>
            </div>
            <div className="coordinatie-stat-balk-track">
              <div className="coordinatie-stat-balk-fill" style={{ width: `${(b.aantal / maxVerdeling) * 100}%` }} />
            </div>
          </div>
        ))}
      </Collapsible>

      <Collapsible icoon="🌾" titel="Perceel-analyse" badge={Object.keys(perceelStats).length || null}>
        {Object.keys(perceelStats).length === 0 && <div className="export-card-beschrijving">Geen percelen gevonden.</div>}
        {Object.entries(perceelStats).map(([perceel, stats]) => (
          <div key={perceel} className="coordinatie-stat-rij">
            <div className="coordinatie-stat-label">
              <span>{perceel}</span>
              <span>{stats.totaal}x · {stats.ditJaar}x dit jaar{stats.bovenWindNorm ? ` · ${stats.bovenWindNorm}x boven windnorm` : ''}</span>
            </div>
            <div className="coordinatie-stat-balk-track">
              <div className="coordinatie-stat-balk-fill" style={{ width: `${(stats.totaal / maxPerceelTotaal) * 100}%` }} />
            </div>
          </div>
        ))}
      </Collapsible>

      <Collapsible icoon="🧭" titel="Windroos per perceel" badge={Object.keys(windroosPerPerceel).length || null}>
        {Object.keys(windroosPerPerceel).length === 0 && (
          <div className="export-card-beschrijving">Nog geen perceel met genoeg meldingen + winddata voor een windroos (minimaal 3).</div>
        )}
        {Object.entries(windroosPerPerceel).map(([perceel, w]) => (
          <div key={perceel} className="coordinatie-stat-rij">
            <div className="coordinatie-stat-label">
              <span>{perceel}</span>
              <span>{w.dominantPct}% uit het {w.dominanteRichting} ({w.totaal}x)</span>
            </div>
            <div className="coordinatie-stat-balk-track">
              <div className="coordinatie-stat-balk-fill" style={{ width: `${(w.dominantPct / maxDominantPct) * 100}%` }} />
            </div>
          </div>
        ))}
        {Object.keys(windroosPerPerceel).length > 0 && (
          <div className="export-card-beschrijving mt-2">
            Een hoog percentage uit één richting is sterker bewijs van een
            patroon dan losse, onafhankelijke waarnemingen. Toevallige
            spreiding zou rond een paar windrichtingen schommelen, niet
            structureel naar één kant overhellen.
          </div>
        )}
      </Collapsible>

      <Collapsible icoon="👥" titel="Melder-overzicht" badge={melders.length || null}>
        {melders.map((m) => (
          <div key={m.userId} className="coordinatie-melder-rij">
            <div className="export-info-rij">
              <span>{melderCode(m.melderEmail) || m.userId.slice(0, 8)}</span>
              <span>{m.aantalMeldingen} melding{m.aantalMeldingen === 1 ? '' : 'en'}</span>
            </div>
            {(m.aantalUnderReview > 0 || m.aantalShadow > 0) && (
              <div className="coordinatie-badges-rij">
                {m.aantalUnderReview > 0 && <span className="badge badge-warning">{m.aantalUnderReview} under review</span>}
                {m.aantalShadow > 0 && <span className="badge badge-danger">{m.aantalShadow} shadow</span>}
              </div>
            )}
            <div className="export-info-rij coordinatie-trust-rij">
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
      </Collapsible>

      <Collapsible icoon="🛠️" titel="Rapportages & tools">
        <div className="coordinatie-tools-stack">
          <Suspense fallback={<div className="card p-4">Kaart laden...</div>}>
            <BuurtgebiedTekenaar thuislocatie={filterCentrum || thuislocatie} meldingen={entriesGefilterd} user={user} gebruikerRol={gebruikerRol} />
          </Suspense>

          <BuurtrapportGenerator user={user} voorgeselecteerdGemeente={voorgeselecteerdGemeente} />
        </div>
      </Collapsible>
    </div>
  );
}
