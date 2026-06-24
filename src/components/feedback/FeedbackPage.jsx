import { useEffect, useState } from 'react';
import { maakFeedback, haalFeedback, wijzigFeedbackStatus, verwijderFeedback } from '../../lib/feedback/feedback.js';
import { isAdmin } from '../../lib/rollen.js';
import { Toast } from '../ui/Toast.jsx';
import './FeedbackPage.css';

const STATUS_LABEL = { onbehandeld: 'Onbehandeld', in_behandeling: 'In behandeling', afgehandeld: 'Afgehandeld' };
const STATUS_KLEUR = { onbehandeld: 'var(--danger)', in_behandeling: 'var(--warning)', afgehandeld: '#22c55e' };
const TYPE_LABEL = { technisch: '🐛 Technisch probleem', vraag: '💬 Vraag/opmerking/compliment' };

// Feedback-paneel — bereikbaar via Instellingen (zie InstellingenPage.jsx).
// Dashboard-overzicht (alle 'technisch'-meldingen + eigen 'vraag'-
// meldingen, RLS regelt de scheiding zelf, zie migratie 0017) +
// laagdrempelig meldformulier (titel + omschrijving, geen verplichte
// extra velden — bewoners mogen geen ingewikkeld proces voor de neus
// krijgen). Alleen 'admin' (niet coordinator) krijgt inline
// statuswijzigings-/reactiebesturing per item, expliciet zo gevraagd.
export function FeedbackPage({ user, gebruikerRol, onTerug }) {
  const [items, setItems] = useState(null);
  const [fout, setFout] = useState(null);
  const [melding, setMelding] = useState(null);
  const [nieuwType, setNieuwType] = useState(null); // 'technisch' | 'vraag' | null
  const [titel, setTitel] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [bezig, setBezig] = useState(false);

  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  const laad = async () => {
    try {
      setItems(await haalFeedback());
    } catch (err) {
      setFout(err.message);
    }
  };

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const data = await haalFeedback();
        if (actief) setItems(data);
      } catch (err) {
        if (actief) setFout(err.message);
      }
    })();
    return () => { actief = false; };
  }, []);

  const handleVerzenden = async (e) => {
    e.preventDefault();
    if (!titel.trim() || !omschrijving.trim()) return;
    setBezig(true);
    try {
      await maakFeedback({ type: nieuwType, titel, omschrijving }, user.id);
      setNieuwType(null);
      setTitel('');
      setOmschrijving('');
      toon('✓ Bedankt, je feedback is verstuurd.', 'success');
      await laad();
    } catch (err) {
      toon(`Versturen mislukt: ${err.message}`, 'error');
    } finally {
      setBezig(false);
    }
  };

  const handleStatusWijzigen = async (id, status, reactie) => {
    try {
      await wijzigFeedbackStatus(id, status, reactie);
      await laad();
    } catch (err) {
      toon(`Status wijzigen mislukt: ${err.message}`, 'error');
    }
  };

  const handleVerwijderen = async (id) => {
    if (!confirm('Deze feedback verwijderen?')) return;
    try {
      await verwijderFeedback(id);
      await laad();
    } catch (err) {
      toon(`Verwijderen mislukt: ${err.message}`, 'error');
    }
  };

  if (!user) {
    return (
      <div className="feedback-page">
        <div className="export-titel">Feedback</div>
        <div className="card p-4"><div className="export-card-beschrijving">Log in om feedback te bekijken of te versturen.</div></div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <button type="button" className="btn-outline feedback-knop feedback-terug-knop" onClick={onTerug}>← Terug naar Instellingen</button>
      <div className="export-titel">Feedback</div>
      <div className="export-subtitel">Bugs melden, vragen stellen of een opmerking/compliment delen</div>

      {!nieuwType && (
        <div className="card p-4">
          <div className="section-label mb-3">Nieuwe melding</div>
          <div className="feedback-keuzerij">
            <button type="button" className="btn-primary feedback-knop" onClick={() => setNieuwType('technisch')}>
              🐛 Technisch probleem
            </button>
            <button type="button" className="btn-outline feedback-knop" onClick={() => setNieuwType('vraag')}>
              💬 Vraag/opmerking/compliment
            </button>
          </div>
        </div>
      )}

      {nieuwType && (
        <div className="card p-4">
          <div className="section-label mb-3">{TYPE_LABEL[nieuwType]}</div>
          {nieuwType === 'technisch' && (
            <div className="export-card-beschrijving mb-2">Zichtbaar voor alle gebruikers, handig om te zien of een probleem al gemeld is.</div>
          )}
          {nieuwType === 'vraag' && (
            <div className="export-card-beschrijving mb-2">Alleen jij en de beheerder zien dit, niet publiek zichtbaar.</div>
          )}
          <form onSubmit={handleVerzenden} className="groepen-formulier">
            <label className="section-label" htmlFor="feedback-titel">Onderwerp</label>
            <input
              id="feedback-titel"
              className="form-input"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder={nieuwType === 'technisch' ? 'Bijv. "Kaart laadt niet op Tijdlijn"' : 'Bijv. "Vraag over trust score"'}
              required
            />
            <label className="section-label" htmlFor="feedback-omschrijving">Omschrijving</label>
            <textarea
              id="feedback-omschrijving"
              className="form-input"
              rows={4}
              value={omschrijving}
              onChange={(e) => setOmschrijving(e.target.value)}
              placeholder="Wat gebeurde er, wat verwachtte je?"
              required
            />
            <div className="feedback-keuzerij mt-2">
              <button type="submit" className="btn-primary feedback-knop" disabled={bezig}>{bezig ? 'Versturen...' : 'Versturen'}</button>
              <button type="button" className="btn-outline feedback-knop" onClick={() => setNieuwType(null)}>Annuleren</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-4">
        <div className="section-label mb-3">📋 Overzicht</div>
        {fout && <div className="export-card-beschrijving" style={{ color: 'var(--danger)' }}>Laden mislukt: {fout}</div>}
        {!fout && !items && <div className="export-card-beschrijving">Laden...</div>}
        {items?.length === 0 && <div className="export-card-beschrijving">Nog geen feedback.</div>}
        {items?.map((item) => (
          <FeedbackItem
            key={item.id}
            item={item}
            isEigen={item.user_id === user.id}
            magBeheren={isAdmin(gebruikerRol)}
            onStatusWijzigen={handleStatusWijzigen}
            onVerwijderen={handleVerwijderen}
          />
        ))}
      </div>

      <Toast melding={melding} />
    </div>
  );
}

function FeedbackItem({ item, isEigen, magBeheren, onStatusWijzigen, onVerwijderen }) {
  const [reactie, setReactie] = useState(item.admin_reactie || '');

  return (
    <div className="feedback-item">
      <div className="feedback-item-top">
        <span className="feedback-item-titel">{TYPE_LABEL[item.type]} · {item.titel}</span>
        <span className="badge" style={{ color: STATUS_KLEUR[item.status], borderColor: STATUS_KLEUR[item.status] }}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      <div className="export-card-beschrijving">{item.omschrijving}</div>
      <div className="export-info-rij mt-1">
        <span>{isEigen ? 'Door jou' : 'Door een andere gebruiker'} · {new Date(item.created_at).toLocaleDateString('nl-NL')}</span>
        {(isEigen || magBeheren) && (
          <button type="button" className="feedback-item-verwijderen" onClick={() => onVerwijderen(item.id)} aria-label="Verwijderen" title="Verwijderen">
            🗑️
          </button>
        )}
      </div>
      {item.admin_reactie && !magBeheren && (
        <div className="feedback-item-reactie">💬 Reactie van de beheerder: {item.admin_reactie}</div>
      )}

      {magBeheren && (
        <div className="feedback-item-beheer">
          <select value={item.status} onChange={(e) => onStatusWijzigen(item.id, e.target.value, reactie)}>
            <option value="onbehandeld">Onbehandeld</option>
            <option value="in_behandeling">In behandeling</option>
            <option value="afgehandeld">Afgehandeld</option>
          </select>
          <textarea
            className="form-input mt-1"
            rows={2}
            placeholder="Reactie naar de melder (optioneel)"
            value={reactie}
            onChange={(e) => setReactie(e.target.value)}
          />
          <button type="button" className="btn-outline feedback-knop mt-1" onClick={() => onStatusWijzigen(item.id, item.status, reactie)}>
            Opslaan
          </button>
        </div>
      )}
    </div>
  );
}
