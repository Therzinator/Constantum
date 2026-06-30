import { useEffect, useRef, useState } from 'react';
import { APP_VERSION_CLIENT } from '../../lib/version.js';
import { RADIUS_OPTIES, laadBereikMeter, slaBereikMeterOp } from '../../lib/notificaties/buurtMelding.js';
import { melderCode } from '../../utils/format.js';
import instellingenIcon from '../../assets/ui-icons/icon_instellingen.png';
import './AccountMenu.css';

// Vervangt het kale versienummer in de headerbalk (AppHeader.jsx) door een
// knop die een account-menu opent — gegevens aanpassen gebeurt al via de
// bestaande Instellingen-pagina (GegevensPrivacyInstelling.jsx e.a.), dit
// menu is dus vooral een snelle ingang daarnaartoe + directe toggles voor
// de buurt-gerelateerde voorkeuren (voorheen losse kaarten op de
// Instellingen-pagina, zie DeelVoorkeurInstelling.jsx — hier compact
// ingebed, niet meer apart op die pagina). Geen notificatie-toggle meer
// (verwijderd om de identiteit van melders te beschermen, zie
// docs/DECISIONS.md) — alleen het bereik waarbinnen andermans gedeelde
// meldingen op Dashboard/Tijdlijn zichtbaar zijn, blijft instelbaar.
export function AccountMenu({ user, onNavigeerInstellingen, syncNu, syncBezig, laadVanCloud, onUitloggen }) {
  const [open, setOpen] = useState(false);
  const [lokaalBezig, setLokaalBezig] = useState(false);
  const [laatsteSyncResultaat, setLaatsteSyncResultaat] = useState(null); // 'ok' | 'fout' | null
  const [bereikMeter, setBereikMeter] = useState(() => laadBereikMeter());
  const menuRef = useRef(null);

  // Sluiten bij een klik buiten het menu of bij Escape — zelfde patroon
  // als JuridischModal.jsx (Escape), aangevuld met outside-click omdat dit
  // een los dropdown-paneel is, geen modal met eigen overlay.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    const handleEscape = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  // Verbergt de markering weer na 2.5s.
  useEffect(() => {
    if (!laatsteSyncResultaat) return;
    const timer = setTimeout(() => setLaatsteSyncResultaat(null), 2500);
    return () => clearTimeout(timer);
  }, [laatsteSyncResultaat]);

  // Direct gekoppeld aan het resultaat van de syncNu()-aanroep zelf i.p.v.
  // het volgen van syncBezig/syncStatus-props: als er niets te
  // synchroniseren is, voltooit syncNu() zo snel (geen await raakt een
  // echte netwerkwachttijd) dat React de bezig:true->false-overgang in
  // ÉÉN render batcht — een effect dat op die props-overgang luisterde
  // zag de tussenstap dan nooit en toonde dus nooit feedback ("de sync
  // doet niks"). Door zelf op de promise te wachten is dit onafhankelijk
  // van hoe/of de bovenliggende hook tussentijds rendert.
  //
  // Doet twee dingen: syncNu() (lokale offline-queue omhoog naar Supabase)
  // én laadVanCloud(true) (alle eigen/gedeelde meldingen van Supabase
  // terughalen, force=true zodat ook al-bestaande lokale meldingen
  // overschreven worden met de cloud-versie) — "Synchroniseer nu" moet
  // niet alleen lokale wijzigingen wegschrijven, maar ook meldingen van
  // vroeger die (bv. na een herinstallatie/nieuw toestel) nog niet lokaal
  // staan weer terughalen.
  const handleSync = async () => {
    if (lokaalBezig) return;
    setLokaalBezig(true);
    setLaatsteSyncResultaat(null);
    let mislukt = false;
    try {
      const pushResultaat = syncNu ? await syncNu() : null;
      if (pushResultaat?.mislukt > 0) mislukt = true;
      if (laadVanCloud) {
        await laadVanCloud(true).catch(() => { mislukt = true; });
      }
      setLaatsteSyncResultaat(mislukt ? 'fout' : 'ok');
    } finally {
      setLokaalBezig(false);
    }
  };

  const handleInstellingen = () => {
    setOpen(false);
    onNavigeerInstellingen?.();
  };

  const handleBereikChange = (e) => {
    const meter = parseInt(e.target.value, 10);
    setBereikMeter(meter);
    slaBereikMeterOp(meter);
  };

  const handleUitloggen = () => {
    setOpen(false);
    onUitloggen?.();
  };

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu-knop"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Instellingen"
      >
        <span
          className="account-menu-knop-icoon account-menu-knop-icoon-img"
          style={{ WebkitMaskImage: `url(${instellingenIcon})`, maskImage: `url(${instellingenIcon})` }}
        />
        <span className="account-menu-knop-label">Instellingen</span>
      </button>

      {open && (
        <div className="account-menu-paneel" role="menu">
          <div className="account-menu-gebruiker">
            {user?.email ? user.email : 'Niet ingelogd'}
          </div>
          {user?.email && (
            <button
              type="button"
              className="account-menu-gebruiker-id"
              title="Klik om melder-code te kopiëren"
              onClick={() => navigator.clipboard.writeText(melderCode(user.email)).catch(() => {})}
            >
              {melderCode(user.email)}
            </button>
          )}

          <button
            type="button"
            className={`account-menu-item account-menu-sync ${laatsteSyncResultaat ? `account-menu-sync-${laatsteSyncResultaat}` : ''}`}
            onClick={handleSync}
            disabled={!user || lokaalBezig || syncBezig}
            title={!user ? 'Log in om te synchroniseren met de cloud' : undefined}
          >
            {!user
              ? '🔄 Synchroniseer nu (log in)'
              : lokaalBezig || syncBezig
                ? '⏳ Synchroniseren...'
                : laatsteSyncResultaat === 'ok'
                  ? '✓ Synchronisatie gelukt'
                  : laatsteSyncResultaat === 'fout'
                    ? '✗ Synchronisatie deels mislukt'
                    : '🔄 Synchroniseer nu'}
          </button>

          <div className="account-menu-toggle-groep">
            <label className="account-menu-toggle-rij">
              <span>📍 Bereik buurtmeldingen</span>
              <select value={bereikMeter} onChange={handleBereikChange}>
                {RADIUS_OPTIES.map((m) => (
                  <option key={m} value={m}>{m >= 1000 ? `${m / 1000} km` : `${m} m`}</option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" className="account-menu-item" onClick={handleInstellingen}>
            ⚙️ Mijn gegevens &amp; instellingen
          </button>

          {user && (
            <button type="button" className="account-menu-item account-menu-uitloggen" onClick={handleUitloggen}>
              🚪 Uitloggen
            </button>
          )}

          <div className="account-menu-versie">v{APP_VERSION_CLIENT}</div>
        </div>
      )}
    </div>
  );
}
