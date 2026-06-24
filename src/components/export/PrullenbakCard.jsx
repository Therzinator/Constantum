import { useState } from 'react';
import { isAdmin } from '../../lib/rollen.js';
import { melderCode } from '../../utils/format.js';
import { haalVerwijderdeMeldingen, herstelMeldingInCloud } from '../../lib/supabase/prullenbak.js';
import './PrullenbakCard.css';

const DAGEN_OPTIES = [1, 2, 3, 4, 5, 7, 10, 14];

// Komt overeen met de admin-sectie "Backup terugzetten" uit docs/index.html
// (laadVerwijderdeMeldingen/herstelMelding, bron regel 1519-1549, 4204-4283).
// Alleen zichtbaar voor admins.
export function PrullenbakCard({ gebruikerRol, user, laadVanCloud }) {
  const [dagen, setDagen] = useState(7);
  const [items, setItems] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  if (!isAdmin(gebruikerRol)) return null;

  const bekijk = async () => {
    setBezig(true);
    setFout(null);
    try {
      const data = await haalVerwijderdeMeldingen(dagen);
      setItems(data);
    } catch (e) {
      setFout(e.message || 'Opvragen mislukt');
    } finally {
      setBezig(false);
    }
  };

  const herstel = async (id) => {
    try {
      await herstelMeldingInCloud(id, user);
      await bekijk();
      laadVanCloud?.().catch(() => {});
    } catch (e) {
      setFout('Herstel mislukt: ' + e.message);
    }
  };

  return (
    <div className="card p-4 prullenbak-card">
      <div className="flex items-start gap-3">
        <div style={{ fontSize: '1.5rem' }}>👑</div>
        <div className="flex-1">
          <div className="prullenbak-titel">Beheer · Admin</div>
          <div className="prullenbak-label" style={{ marginTop: 12 }}>BACKUP TERUGZETTEN</div>
          <div className="export-card-beschrijving mb-2">Herstel verwijderde meldingen uit de cloud (max 14 dagen terug).</div>

          <div className="prullenbak-controls">
            <select className="prullenbak-select" value={dagen} onChange={(e) => setDagen(Number(e.target.value))}>
              {DAGEN_OPTIES.map((d) => <option key={d} value={d}>Afgelopen {d} dag{d > 1 ? 'en' : ''}</option>)}
            </select>
            <button type="button" className="btn-outline px-3 py-2" onClick={bekijk} disabled={bezig}>
              🔍 Bekijk
            </button>
          </div>

          {fout && <div style={{ color: 'var(--danger)', fontFamily: 'var(--mono)', fontSize: '0.7rem', marginBottom: 8 }}>{fout}</div>}

          {items != null && (
            items.length === 0 ? (
              <div className="prullenbak-leeg">Geen verwijderde meldingen gevonden</div>
            ) : (
              <>
                {items.map((item) => {
                  const d = new Date(item.timestamp_local);
                  return (
                    <div key={item.id} className="prullenbak-item">
                      <div className="prullenbak-item-body">
                        <div className="prullenbak-item-tijd">
                          {d.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })} {d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}
                        </div>
                        <div className="prullenbak-item-omschrijving">{item.description || '—'}</div>
                        <div className="prullenbak-item-melder">{melderCode(item.melder_email || item.user_id)}</div>
                      </div>
                      <button type="button" className="btn-outline px-3 py-1" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => herstel(item.id)}>
                        ↩ Herstel
                      </button>
                    </div>
                  );
                })}
                <div className="prullenbak-info">{items.length} verwijderde melding(en) gevonden in afgelopen {dagen} dag(en)</div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
