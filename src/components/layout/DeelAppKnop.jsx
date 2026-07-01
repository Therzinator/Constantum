import { useState } from 'react';
import { Toast } from '../ui/Toast.jsx';
import { IconDelenGevuld } from '../ui/GevuldeIconen.jsx';
import './DeelAppKnop.css';

// Altijd de www-variant delen, niet window.location.href — het kale
// constatum.nl redirect (308) naar deze URL en toont zelf geen enkele
// og:image/og:url-meta-tag (zie NEXT_STEPS.md, WhatsApp-linkpreview-
// onderzoek 2026-07-01). Deze knop omzeilt dat door altijd de al
// bevestigd-werkende URL te kopiëren, ongeacht welk domein de
// gebruiker zelf net bezocht.
const APP_URL = 'https://www.constatum.nl/';

// Zelfde navigator.share()-met-kopieer-fallback-patroon als
// GroepUitnodigingKaart.jsx — geeft op mobiel de systeem-deelkeuze
// (WhatsApp, Signal, Mail, ...), valt op desktop/onbeschikbare
// browsers terug op een klembord-kopie van de kale link.
const kanNatiefDelen = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export function DeelAppKnop() {
  const [melding, setMelding] = useState(null);
  // eslint-disable-next-line react-hooks/purity -- toast-id, geen logica-kritisch gebruik van Date.now(), zelfde patroon als GroepUitnodigingKaart.jsx
  const toon = (tekst, type = '') => setMelding({ id: Date.now(), tekst, type });

  const handleDelen = async () => {
    if (kanNatiefDelen) {
      try {
        await navigator.share({ title: 'Constatum', text: 'Constatum — Geografisch Logboek', url: APP_URL });
        return;
      } catch {
        // Gebruiker annuleerde de deel-keuze — geen foutmelding nodig,
        // dat is normaal gedrag van de share-sheet.
        return;
      }
    }
    await navigator.clipboard.writeText(APP_URL).catch(() => {});
    toon('Link gekopieerd naar klembord', 'success');
  };

  return (
    <>
      <button type="button" className="deel-app-knop" onClick={handleDelen} title="Deel Constatum">
        <IconDelenGevuld className="deel-app-knop-icoon" />
        <span className="deel-app-knop-label">Delen</span>
      </button>
      <Toast melding={melding} />
    </>
  );
}
