import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  maakGroepUitnodiging,
  haalGroepUitnodigingen,
  trekUitnodigingIn,
  verwijderUitnodiging,
  uitnodigingUrl
} from '../../lib/groepen/uitnodigingen.js';
import { Toast } from '../ui/Toast.jsx';

const VERLOOPTIJDEN = [24, 48, 72];

// navigator.share() geeft de gebruiker de systeem-deelkeuze (WhatsApp,
// Messenger, Signal, Mail, ...) i.p.v. losse, per-app deeplinks te
// hardcoden — werkt op alle apps die de gebruiker al geïnstalleerd heeft,
// zonder per app onderhoud. Niet overal beschikbaar (vrijwel altijd op
// mobiel, niet op desktop-Firefox/de meeste desktopbrowsers) — daarom
// blijft "Kopieer tekst" altijd als universele fallback bestaan.
const kanNatiefDelen = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

function bouwDeelTekst(groepNaam, token) {
  const url = uitnodigingUrl(token);
  return { url, tekst: `Je bent uitgenodigd voor de Constatum: Geografisch Logboek groep ${groepNaam}, klik hier om deel te nemen: ${url}` };
}

function urenResterend(verloopOp) {
  return Math.round((new Date(verloopOp) - new Date()) / (60 * 60 * 1000));
}

function isActief(u) {
  return !u.ingetrokken && urenResterend(u.verloopt_op) > 0 && u.gebruikt_aantal < u.max_gebruikers;
}

function statusLabel(u) {
  if (u.ingetrokken) return 'Ingetrokken';
  if (urenResterend(u.verloopt_op) <= 0) return 'Verlopen';
  if (u.gebruikt_aantal >= u.max_gebruikers) return 'Vol';
  return `Nog ${urenResterend(u.verloopt_op)} uur · ${u.max_gebruikers - u.gebruikt_aantal} plek(ken) over`;
}

// Sectie 3 — uitnodigingssysteem binnen een groep: link + QR, instelbaar
// aantal unieke gebruikers (1-5) en verlooptijd (24/48/72u), plus
// statistieken (gebruikt/resterend/verlooptijd). Alleen zichtbaar voor
// beheerder/hoofdbeheerder (RLS regelt dit ook database-side, zie
// migratie 0015) — caller bepaalt zichtbaarheid in GroepPage.jsx.
export function GroepUitnodigingKaart({ groepId, userId, groepNaam }) {
  const [uitnodigingen, setUitnodigingen] = useState([]);
  const [maxGebruikers, setMaxGebruikers] = useState(1);
  const [verloopUren, setVerloopUren] = useState(24);
  const [bezig, setBezig] = useState(false);
  const [laatsteQr, setLaatsteQr] = useState(null);
  const [laatsteDeelTekst, setLaatsteDeelTekst] = useState(null);
  const [melding, setMelding] = useState(null);

  // eslint-disable-next-line react-hooks/purity -- toast-id, geen logica-kritisch gebruik van Date.now(), zelfde patroon als InstellingenPage.jsx/TrustIndicator.jsx
  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  const laad = async () => {
    try {
      setUitnodigingen(await haalGroepUitnodigingen(groepId));
    } catch (err) {
      toon(`Uitnodigingen laden mislukt: ${err.message}`, 'error');
    }
  };

  // Inline IIFE i.p.v. laad() rechtstreeks aan te roepen — zelfde patroon
  // als CoordinatiePage.jsx's initiële laad-effect.
  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const data = await haalGroepUitnodigingen(groepId);
        if (actief) setUitnodigingen(data);
      } catch (err) {
        if (actief) toon(`Uitnodigingen laden mislukt: ${err.message}`, 'error');
      }
    })();
    return () => { actief = false; };
  }, [groepId]);

  const handleGenereer = async () => {
    setBezig(true);
    try {
      const nieuw = await maakGroepUitnodiging(groepId, userId, { maxGebruikers, verloopUren });
      const { url, tekst } = bouwDeelTekst(groepNaam, nieuw.token);
      setLaatsteDeelTekst(tekst);
      setLaatsteQr(await QRCode.toDataURL(url, { width: 200, margin: 1 }));
      await navigator.clipboard.writeText(tekst).catch(() => {});
      toon('Uitnodiging aangemaakt en deeltekst gekopieerd.', 'success');
      await laad();
    } catch (err) {
      toon(`Uitnodiging maken mislukt: ${err.message}`, 'error');
    } finally {
      setBezig(false);
    }
  };

  const handleIntrekken = async (id) => {
    try {
      await trekUitnodigingIn(id);
      await laad();
    } catch (err) {
      toon(`Intrekken mislukt: ${err.message}`, 'error');
    }
  };

  // Definitief verwijderen — alleen aangeboden voor niet meer actieve
  // uitnodigingen (ingetrokken/verlopen/vol), zodat een nog werkende link
  // niet per ongeluk weggegooid wordt i.p.v. ingetrokken.
  const handleVerwijderen = async (id) => {
    if (!confirm('Deze uitnodiging definitief verwijderen?')) return;
    try {
      await verwijderUitnodiging(id);
      await laad();
    } catch (err) {
      toon(`Verwijderen mislukt: ${err.message}`, 'error');
    }
  };

  const handleDelen = async (token) => {
    const { tekst } = bouwDeelTekst(groepNaam, token);
    if (kanNatiefDelen) {
      try {
        await navigator.share({ text: tekst });
        return;
      } catch {
        // Gebruiker annuleerde de deel-keuze of geen app gekozen — geen
        // foutmelding nodig, dat is normaal gedrag van de share-sheet.
        return;
      }
    }
    await navigator.clipboard.writeText(tekst).catch(() => {});
    toon('Uitnodigingstekst gekopieerd.', 'success');
  };

  return (
    <div className="card p-4">
      <div className="section-label mb-3">🔗 Uitnodigingen</div>

      <label className="section-label" htmlFor="uitn-max-gebruikers">Aantal unieke gebruikers</label>
      <select id="uitn-max-gebruikers" className="form-input" value={maxGebruikers} onChange={(e) => setMaxGebruikers(Number(e.target.value))}>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} gebruiker{n === 1 ? '' : 's'}</option>)}
      </select>

      <label className="section-label mt-2" htmlFor="uitn-verloop">Verlooptijd</label>
      <select id="uitn-verloop" className="form-input" value={verloopUren} onChange={(e) => setVerloopUren(Number(e.target.value))}>
        {VERLOOPTIJDEN.map((u) => <option key={u} value={u}>{u} uur</option>)}
      </select>

      <button type="button" className="btn-primary groepen-knop mt-3" disabled={bezig} onClick={handleGenereer}>
        {bezig ? 'Genereren...' : '🔗 Uitnodiging genereren'}
      </button>

      {laatsteDeelTekst && (
        <div className="mt-3">
          <textarea readOnly rows={2} value={laatsteDeelTekst} onFocus={(e) => e.target.select()} style={{ width: '100%' }} className="form-input" />
          <div className="uitnodiging-acties mt-2">
            <button type="button" className="btn-outline uitnodiging-knop" onClick={() => handleDelen(uitnodigingen[0]?.token)} disabled={!uitnodigingen[0]}>
              📤 Delen
            </button>
          </div>
          {laatsteQr && <img src={laatsteQr} alt="QR-code voor groepsuitnodiging" width={160} height={160} className="mt-2" />}
        </div>
      )}

      {uitnodigingen.length > 0 && (
        <div className="mt-3">
          <div className="section-label mb-2">Eerder gegenereerd</div>
          {uitnodigingen.map((u) => (
            <div key={u.id} className="uitnodiging-rij">
              <div className="export-info-rij">
                <span>{u.gebruikt_aantal}/{u.max_gebruikers} gebruikt · {u.keer_geopend}x geopend</span>
                <span>{statusLabel(u)}</span>
              </div>
              <div className="uitnodiging-acties mt-1">
                {isActief(u) && (
                  <>
                    <button type="button" className="btn-outline uitnodiging-knop" onClick={() => handleDelen(u.token)}>
                      📤 Delen
                    </button>
                    <button type="button" className="btn-outline uitnodiging-knop" onClick={() => handleIntrekken(u.id)}>
                      Intrekken
                    </button>
                  </>
                )}
                {!isActief(u) && (
                  <button type="button" className="btn-outline uitnodiging-knop" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleVerwijderen(u.id)}>
                    🗑️ Verwijderen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Toast melding={melding} />
    </div>
  );
}
