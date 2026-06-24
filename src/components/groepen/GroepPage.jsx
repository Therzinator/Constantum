import { useEffect, useState } from 'react';
import { haalGroep, haalGroepStatistieken, wijzigGroepInstellingen, wijzigDeelvoorkeur } from '../../lib/groepen/groepen.js';
import { haalGroepLeden, wijzigRol, verwijderLid, verlaatGroep, wijzigTrustScoreInGroep } from '../../lib/groepen/groepLeden.js';
import { isGroepBeheerder, isGroepHoofdbeheerder } from '../../lib/groepen/rollen.js';
import { haalGebruikersProfiel } from '../../lib/supabase/profiel.js';
import { TrustIndicator } from '../export/TrustIndicator.jsx';
import { GroepUitnodigingKaart } from './GroepUitnodigingKaart.jsx';
import { GroepMeldingenLijst } from './GroepMeldingenLijst.jsx';
import { Toast } from '../ui/Toast.jsx';
import './GroepenPage.css';

const ROL_LABEL = { lid: 'Lid', beheerder: 'Beheerder', hoofdbeheerder: 'Hoofdbeheerder' };

// Sectie 1/4 — groepsdetailpagina: naam/beschrijving, leden/meldingen-
// aantal, beheerderslijst, ledenbeheer, uitnodigingen, trust-score/
// lidmaatschapsinformatie en de meldingenlijst (trust-tier-gated, zie
// GroepMeldingenLijst.jsx). Bereikt via GroepenPage.jsx → onOpenGroep.
export function GroepPage({ groepId, user, onTerug }) {
  const [groep, setGroep] = useState(null);
  const [leden, setLeden] = useState([]);
  const [stats, setStats] = useState({});
  const [profiel, setProfiel] = useState(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);
  const [melding, setMelding] = useState(null);
  const [bewerkenOpen, setBewerkenOpen] = useState(false);
  const [naam, setNaam] = useState('');
  const [beschrijving, setBeschrijving] = useState('');
  const [openbaar, setOpenbaar] = useState(false);
  const [maxBeheerders, setMaxBeheerders] = useState(1);

  // eslint-disable-next-line react-hooks/purity -- toast-id, geen logica-kritisch gebruik van Date.now(), zelfde patroon als InstellingenPage.jsx/TrustIndicator.jsx
  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  const laad = async () => {
    try {
      const [g, l, s, p] = await Promise.all([
        haalGroep(groepId),
        haalGroepLeden(groepId),
        haalGroepStatistieken(groepId),
        haalGebruikersProfiel(user.id)
      ]);
      setGroep(g);
      setLeden(l);
      setStats(s);
      setProfiel(p);
      setNaam(g?.naam || '');
      setBeschrijving(g?.beschrijving || '');
      setOpenbaar(Boolean(g?.openbaar));
      setMaxBeheerders(g?.max_beheerders || 1);
    } catch (err) {
      setFout(err.message);
    } finally {
      setLaden(false);
    }
  };

  // Inline IIFE i.p.v. laad() rechtstreeks aan te roepen — zelfde patroon
  // als CoordinatiePage.jsx's initiële laad-effect.
  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const [g, l, s, p] = await Promise.all([
          haalGroep(groepId),
          haalGroepLeden(groepId),
          haalGroepStatistieken(groepId),
          haalGebruikersProfiel(user.id)
        ]);
        if (!actief) return;
        setGroep(g);
        setLeden(l);
        setStats(s);
        setProfiel(p);
        setNaam(g?.naam || '');
        setBeschrijving(g?.beschrijving || '');
        setOpenbaar(Boolean(g?.openbaar));
        setMaxBeheerders(g?.max_beheerders || 1);
      } catch (err) {
        if (actief) setFout(err.message);
      } finally {
        if (actief) setLaden(false);
      }
    })();
    return () => { actief = false; };
  }, [groepId]);

  if (laden) return <div className="p-4">Laden...</div>;
  if (fout) return <div className="p-4"><div className="card p-4" style={{ color: 'var(--danger)' }}>Laden mislukt: {fout}</div></div>;
  if (!groep) return <div className="p-4"><div className="card p-4">Groep niet gevonden.</div></div>;

  const eigenLid = leden.find((l) => l.user_id === user.id);
  const eigenRol = eigenLid?.rol;
  const magBeheren = isGroepBeheerder(eigenRol);
  const isHoofdbeheerder = isGroepHoofdbeheerder(eigenRol);

  const handleOpslaan = async (e) => {
    e.preventDefault();
    try {
      await wijzigGroepInstellingen(groepId, { naam, beschrijving, openbaar, maxBeheerders });
      setBewerkenOpen(false);
      await laad();
    } catch (err) {
      toon(`Opslaan mislukt: ${err.message}`, 'error');
    }
  };

  const handleRolWijzigen = async (targetUserId, nieuweRol) => {
    try {
      const gelukt = await wijzigRol(groepId, targetUserId, nieuweRol);
      if (!gelukt) toon('Rol wijzigen niet gelukt (limiet beheerders bereikt?).', 'error');
      await laad();
    } catch (err) {
      toon(`Rol wijzigen mislukt: ${err.message}`, 'error');
    }
  };

  const handleLidVerwijderen = async (targetUserId) => {
    if (!confirm('Dit lid uit de groep verwijderen?')) return;
    try {
      await verwijderLid(groepId, targetUserId);
      await laad();
    } catch (err) {
      toon(`Verwijderen mislukt: ${err.message}`, 'error');
    }
  };

  const handleGroepVerlaten = async () => {
    if (!confirm('Deze groep verlaten?')) return;
    try {
      await verlaatGroep(groepId, user.id);
      onTerug();
    } catch (err) {
      toon(`Groep verlaten mislukt: ${err.message}`, 'error');
    }
  };

  const handleTrustScore = async (targetUserId, waarde) => {
    try {
      const gelukt = await wijzigTrustScoreInGroep(groepId, targetUserId, waarde);
      if (!gelukt) toon('Trust score wijzigen niet gelukt.', 'error');
    } catch (err) {
      toon(`Trust score wijzigen mislukt: ${err.message}`, 'error');
    }
  };

  const handleDeelvoorkeurWijzigen = async (deelMeldingen) => {
    try {
      await wijzigDeelvoorkeur(groepId, deelMeldingen);
      await laad();
    } catch (err) {
      toon(`Deelvoorkeur wijzigen mislukt: ${err.message}`, 'error');
    }
  };

  return (
    <div className="p-4 groepen-page">
      <button type="button" className="btn-outline px-3 py-1" onClick={onTerug}>← Terug naar Groepen</button>

      <div className="card p-4">
        {!bewerkenOpen ? (
          <>
            <div className="groepen-kaart-titel">
              <span className="export-titel" style={{ marginBottom: 0 }}>{groep.naam}</span>
              <span className={`badge ${groep.openbaar ? 'badge-accent' : 'badge-muted'}`}>{groep.openbaar ? 'Openbaar' : 'Privé'}</span>
            </div>
            {groep.beschrijving && <div className="export-card-beschrijving mb-2">{groep.beschrijving}</div>}
            <div className="export-info-rij"><span>Leden</span><span>{stats.aantalLeden}</span></div>
            <div className="export-info-rij"><span>Meldingen</span><span>{stats.aantalMeldingen}</span></div>
            <div className="export-info-rij"><span>Jouw rol</span><span>{ROL_LABEL[eigenRol] || '—'}</span></div>
            {isHoofdbeheerder && (
              <button type="button" className="btn-outline px-3 py-1 mt-2" onClick={() => setBewerkenOpen(true)}>Instellingen wijzigen</button>
            )}
            {!isHoofdbeheerder && (
              <button type="button" className="btn-outline px-3 py-1 mt-2" onClick={handleGroepVerlaten}>Groep verlaten</button>
            )}
          </>
        ) : (
          <form onSubmit={handleOpslaan} className="groepen-formulier">
            <label className="section-label" htmlFor="bewerk-naam">Groepsnaam</label>
            <input id="bewerk-naam" className="form-input" value={naam} onChange={(e) => setNaam(e.target.value)} required />
            <label className="section-label" htmlFor="bewerk-beschrijving">Beschrijving</label>
            <textarea id="bewerk-beschrijving" className="form-input" rows={2} value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} />
            <label className="groepen-checkbox-rij">
              <input type="checkbox" checked={openbaar} onChange={(e) => setOpenbaar(e.target.checked)} />
              <span>Openbaar</span>
            </label>
            <label className="section-label" htmlFor="bewerk-max-beheerders">Maximaal aantal beheerders</label>
            <select id="bewerk-max-beheerders" className="form-input" value={maxBeheerders} onChange={(e) => setMaxBeheerders(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn-primary px-4 py-2">Opslaan</button>
              <button type="button" className="btn-outline px-4 py-2" onClick={() => setBewerkenOpen(false)}>Annuleren</button>
            </div>
          </form>
        )}
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">🛡️ Trust score & lidmaatschap</div>
        <TrustIndicator profiel={profiel} />
        <div className="export-info-rij mt-2"><span>Lid sinds</span><span>{eigenLid ? new Date(eigenLid.joined_at).toLocaleDateString('nl-NL') : '—'}</span></div>
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">👥 Leden{magBeheren ? ' (beheer)' : ''}</div>
        {leden.map((l) => (
          <div key={l.user_id} className="export-info-rij">
            <span>{l.user_id === user.id ? 'Jij' : l.user_id.slice(0, 8)} · {ROL_LABEL[l.rol]}</span>
            {magBeheren && l.user_id !== user.id && l.rol !== 'hoofdbeheerder' && (
              <div className="flex gap-2">
                {isHoofdbeheerder && (
                  <select
                    value={l.rol}
                    onChange={(e) => handleRolWijzigen(l.user_id, e.target.value)}
                  >
                    <option value="lid">Lid</option>
                    <option value="beheerder">Beheerder</option>
                  </select>
                )}
                <button type="button" className="btn-outline px-2 py-1" onClick={() => handleLidVerwijderen(l.user_id)}>Verwijderen</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {magBeheren && (
        <div className="card p-4">
          <div className="section-label mb-3">🛠️ Trust score van leden aanpassen</div>
          <div className="export-card-beschrijving mb-2">Beperkt tot leden van deze groep, geen globale admin-actie.</div>
          {leden.filter((l) => l.user_id !== user.id).map((l) => (
            <div key={l.user_id} className="export-info-rij">
              <span>{l.user_id.slice(0, 8)}</span>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="0-100"
                className="coordinatie-trust-input"
                onBlur={(e) => {
                  const waarde = parseInt(e.target.value, 10);
                  if (!Number.isNaN(waarde)) handleTrustScore(l.user_id, waarde);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {magBeheren && <GroepUitnodigingKaart groepId={groepId} userId={user.id} groepNaam={groep.naam} />}

      <div className="card p-4">
        <div className="section-label mb-3">📤 Meldingen delen met deze groep</div>
        <div className="export-card-beschrijving mb-2">
          Staat dit aan, dan worden nieuwe meldingen waarbij je zelf
          "Deel deze melding met je groepen" aanvinkt automatisch ook met
          deze groep gedeeld. Standaard uit, dit verandert niets aan al
          eerder gedeelde meldingen.
        </div>
        <label className="groepen-deel-toggle">
          <input
            type="checkbox"
            checked={Boolean(eigenLid?.deel_meldingen)}
            onChange={(e) => handleDeelvoorkeurWijzigen(e.target.checked)}
          />
          <span>Deel mijn meldingen met deze groep</span>
        </label>
      </div>

      <div className="card p-4">
        <div className="section-label mb-3">📋 Meldingen in deze groep</div>
        <GroepMeldingenLijst groepId={groepId} viewerTrustScore={profiel?.trust_score} viewerUserId={user.id} />
      </div>

      <Toast melding={melding} />
    </div>
  );
}
