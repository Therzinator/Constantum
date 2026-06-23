import { useEffect, useState } from 'react';
import {
  haalMijnGroepen,
  haalOpenbareGroepen,
  haalGroepStatistieken,
  maakGroep,
  wordLidVanOpenbareGroep
} from '../../lib/groepen/groepen.js';
import { zoekPostcodePDOK } from '../../lib/pdok/postcode.js';
import { Toast } from '../ui/Toast.jsx';
import './GroepenPage.css';

const ROL_LABEL = { lid: 'Lid', beheerder: 'Beheerder', hoofdbeheerder: 'Hoofdbeheerder' };

function relatieveTijd(iso) {
  if (!iso) return 'Geen activiteit';
  const ms = Date.now() - new Date(iso).getTime();
  const minuten = Math.floor(ms / 60000);
  if (minuten < 60) return `${minuten} min geleden`;
  const uren = Math.floor(minuten / 60);
  if (uren < 24) return `${uren} u geleden`;
  return `${Math.floor(uren / 24)}d geleden`;
}

// Groepenfunctie — hoofdpagina, vervangt de vroegere "Uitnodigen"-knop in
// de header (zie AppHeader.jsx/UitnodigenMenu.jsx, verwijderd). Drie
// secties zoals gevraagd: openbare groepen browsen, groep starten, mijn
// groepen. Bereikbaar via BottomNav-tab 'groepen'.
export function GroepenPage({ user, thuislocatie, onOpenGroep }) {
  const [mijnGroepen, setMijnGroepen] = useState([]);
  const [openbareGroepen, setOpenbareGroepen] = useState([]);
  const [statsPerGroep, setStatsPerGroep] = useState({});
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);
  const [melding, setMelding] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [naam, setNaam] = useState('');
  const [beschrijving, setBeschrijving] = useState('');
  const [openbaar, setOpenbaar] = useState(false);
  const [maxBeheerders, setMaxBeheerders] = useState(1);
  const [bezig, setBezig] = useState(false);
  const [lidWordenBezig, setLidWordenBezig] = useState(null);

  // eslint-disable-next-line react-hooks/purity -- toast-id, geen logica-kritisch gebruik van Date.now(), zelfde patroon als InstellingenPage.jsx/TrustIndicator.jsx
  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  const laad = async () => {
    if (!user) { setLaden(false); return; }
    try {
      const [mijn, openbaarLijst] = await Promise.all([haalMijnGroepen(user.id), haalOpenbareGroepen()]);
      setMijnGroepen(mijn);
      setOpenbareGroepen(openbaarLijst);

      const alleIds = [...new Set([...mijn.map((g) => g.id), ...openbaarLijst.map((g) => g.id)])];
      const statsEntries = await Promise.all(alleIds.map(async (id) => [id, await haalGroepStatistieken(id)]));
      setStatsPerGroep(Object.fromEntries(statsEntries));
    } catch (err) {
      setFout(err.message);
    } finally {
      setLaden(false);
    }
  };

  // Inline IIFE i.p.v. laad() rechtstreeks aan te roepen — zelfde patroon
  // als CoordinatiePage.jsx's initiële laad-effect (react-hooks/set-state-
  // in-effect accepteert dit, een directe functie-aanroep als hele
  // effect-body niet).
  useEffect(() => {
    let actief = true;
    (async () => {
      if (!user) { if (actief) setLaden(false); return; }
      try {
        const [mijn, openbaarLijst] = await Promise.all([haalMijnGroepen(user.id), haalOpenbareGroepen()]);
        const alleIds = [...new Set([...mijn.map((g) => g.id), ...openbaarLijst.map((g) => g.id)])];
        const statsEntries = await Promise.all(alleIds.map(async (id) => [id, await haalGroepStatistieken(id)]));
        if (!actief) return;
        setMijnGroepen(mijn);
        setOpenbareGroepen(openbaarLijst);
        setStatsPerGroep(Object.fromEntries(statsEntries));
      } catch (err) {
        if (actief) setFout(err.message);
      } finally {
        if (actief) setLaden(false);
      }
    })();
    return () => { actief = false; };
  }, [user]);

  // Standaardnaam "Groep {postcode}" (sectie 2) — postcode van de
  // thuislocatie van de hoofdbeheerder, direct aanpasbaar.
  const openFormulier = async () => {
    setFormOpen(true);
    if (naam || !thuislocatie?.lat || !thuislocatie?.lng) return;
    const postcode = await zoekPostcodePDOK(thuislocatie.lat, thuislocatie.lng).catch(() => null);
    if (postcode) setNaam(`Groep ${postcode.slice(0, 4)}`);
  };

  const handleAanmaken = async (e) => {
    e.preventDefault();
    if (!naam.trim()) return;
    setBezig(true);
    try {
      const nieuweId = await maakGroep({ naam: naam.trim(), beschrijving: beschrijving.trim(), openbaar, maxBeheerders });
      setFormOpen(false);
      setNaam('');
      setBeschrijving('');
      setOpenbaar(false);
      setMaxBeheerders(1);
      await laad();
      if (nieuweId) onOpenGroep(nieuweId);
    } catch (err) {
      toon(`Groep aanmaken mislukt: ${err.message}`, 'error');
    } finally {
      setBezig(false);
    }
  };

  const handleLidWorden = async (groepId) => {
    setLidWordenBezig(groepId);
    try {
      const gelukt = await wordLidVanOpenbareGroep(groepId);
      if (gelukt) {
        await laad();
        onOpenGroep(groepId);
      } else {
        toon('Lid worden is niet gelukt.', 'error');
      }
    } catch (err) {
      toon(`Lid worden mislukt: ${err.message}`, 'error');
    } finally {
      setLidWordenBezig(null);
    }
  };

  if (!user) {
    return (
      <div className="p-4 groepen-page">
        <div className="export-titel">Groepen</div>
        <div className="card p-4"><div className="export-card-beschrijving">Log in om groepen te bekijken of aan te maken.</div></div>
      </div>
    );
  }

  if (laden) return <div className="p-4">Laden...</div>;
  if (fout) return <div className="p-4"><div className="card p-4" style={{ color: 'var(--danger)' }}>Laden mislukt: {fout}</div></div>;

  const mijnGroepIds = new Set(mijnGroepen.map((g) => g.id));
  const teTonenOpenbaar = openbareGroepen.filter((g) => !mijnGroepIds.has(g.id));

  return (
    <div className="p-4 groepen-page">
      <div className="export-titel">Groepen</div>
      <div className="export-subtitel">Sociale samenwerking binnen SpuitLogger</div>

      <div className="card p-4">
        <div className="section-label mb-3">➕ Groep starten</div>
        {!formOpen && (
          <button type="button" className="btn-primary px-4 py-2" onClick={openFormulier}>Nieuwe groep aanmaken</button>
        )}
        {formOpen && (
          <form onSubmit={handleAanmaken} className="groepen-formulier">
            <label className="section-label" htmlFor="groep-naam">Groepsnaam</label>
            <input id="groep-naam" className="form-input" value={naam} onChange={(e) => setNaam(e.target.value)} required />

            <label className="section-label" htmlFor="groep-beschrijving">Beschrijving</label>
            <textarea id="groep-beschrijving" className="form-input" rows={2} value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} />

            <label className="groepen-checkbox-rij">
              <input type="checkbox" checked={openbaar} onChange={(e) => setOpenbaar(e.target.checked)} />
              <span>Openbaar — vindbaar bij "Openbare groepen browsen"</span>
            </label>

            <label className="section-label" htmlFor="groep-max-beheerders">Maximaal aantal beheerders</label>
            <select id="groep-max-beheerders" className="form-input" value={maxBeheerders} onChange={(e) => setMaxBeheerders(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>

            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn-primary px-4 py-2" disabled={bezig}>{bezig ? 'Aanmaken...' : 'Groep aanmaken'}</button>
              <button type="button" className="btn-outline px-4 py-2" onClick={() => setFormOpen(false)}>Annuleren</button>
            </div>
          </form>
        )}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">👥 Mijn groepen</div>
        {mijnGroepen.length === 0 && <div className="export-card-beschrijving">Je bent nog geen lid van een groep.</div>}
        {mijnGroepen.map((g) => {
          const stats = statsPerGroep[g.id] || {};
          return (
            <button key={g.id} type="button" className="groepen-kaart" onClick={() => onOpenGroep(g.id)}>
              <div className="groepen-kaart-titel">
                <span>{g.naam}</span>
                <span className={`badge ${g.openbaar ? 'badge-accent' : 'badge-muted'}`}>{g.openbaar ? 'Openbaar' : 'Privé'}</span>
              </div>
              <div className="export-info-rij"><span>Leden</span><span>{stats.aantalLeden ?? '—'}</span></div>
              <div className="export-info-rij"><span>Meldingen</span><span>{stats.aantalMeldingen ?? '—'}</span></div>
              <div className="export-info-rij"><span>Laatste activiteit</span><span>{relatieveTijd(stats.laatsteActiviteit)}</span></div>
              <div className="export-info-rij"><span>Jouw rol</span><span>{ROL_LABEL[g.eigenRol] || g.eigenRol}</span></div>
            </button>
          );
        })}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">🌐 Openbare groepen browsen</div>
        {teTonenOpenbaar.length === 0 && <div className="export-card-beschrijving">Geen (andere) openbare groepen gevonden.</div>}
        {teTonenOpenbaar.map((g) => {
          const stats = statsPerGroep[g.id] || {};
          return (
            <div key={g.id} className="groepen-kaart groepen-kaart-statisch">
              <div className="groepen-kaart-titel"><span>{g.naam}</span></div>
              {g.beschrijving && <div className="export-card-beschrijving">{g.beschrijving}</div>}
              <div className="export-info-rij"><span>Leden</span><span>{stats.aantalLeden ?? '—'}</span></div>
              <div className="export-info-rij"><span>Meldingen</span><span>{stats.aantalMeldingen ?? '—'}</span></div>
              <button type="button" className="btn-outline px-3 py-1 mt-2" disabled={lidWordenBezig === g.id} onClick={() => handleLidWorden(g.id)}>
                {lidWordenBezig === g.id ? 'Bezig...' : 'Lid worden'}
              </button>
            </div>
          );
        })}
      </div>

      <Toast melding={melding} />
    </div>
  );
}
