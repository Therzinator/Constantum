import { useEffect, useRef, useState } from 'react';
import './InstallBanner.css';

const STORAGE_KEY = 'constatum_pwa_banner_dismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

// Toont een installatie-suggestie wanneer de app via een browser wordt gebruikt
// in plaats van als geïnstalleerde PWA. Afwijsbaar via ✕ (wordt opgeslagen).
export function InstallBanner() {
  const [zichtbaar, setZichtbaar] = useState(false);
  const [heeftInstallPrompt, setHeeftInstallPrompt] = useState(false);
  const installEventRef = useRef(null);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(STORAGE_KEY)) return;

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      installEventRef.current = e;
      setHeeftInstallPrompt(true);
      setZichtbaar(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Fallback voor browsers zonder beforeinstallprompt (bijv. iOS Safari)
    const timer = setTimeout(() => {
      if (!installEventRef.current && !isStandalone() && !localStorage.getItem(STORAGE_KEY)) {
        setZichtbaar(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEventRef.current) return;
    installEventRef.current.prompt();
    const { outcome } = await installEventRef.current.userChoice;
    if (outcome === 'accepted') sluiten();
  };

  const sluiten = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setZichtbaar(false);
  };

  if (!zichtbaar) return null;

  return (
    <div className="install-banner" role="alert">
      <span className="install-banner-tekst">
        📲 Installeer Constatum als app voor de beste ervaring — ook offline beschikbaar.
      </span>
      {heeftInstallPrompt && (
        <button type="button" className="btn-primary install-banner-knop" onClick={handleInstall}>
          Installeren
        </button>
      )}
      <button
        type="button"
        className="install-banner-sluiten"
        onClick={sluiten}
        aria-label="Sluiten"
      >
        ✕
      </button>
    </div>
  );
}
