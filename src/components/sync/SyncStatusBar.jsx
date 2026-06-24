import { useEffect, useState } from 'react';
import './SyncStatusBar.css';

const TEKST = {
  bezig: 'Synchroniseren...',
  ok: '✓ Synchronisatie voltooid',
  fout: '✗ Synchronisatie deels mislukt',
  offline: 'Offline, synchronisatie wacht'
};

// React-versie van #sync-status-bar + toonSyncBalk/sluitSyncBalk/verbergSyncBalk
// uit docs/index.html. Verschijnt op basis van syncBezig/syncStatus uit
// hooks/useSupabaseSync.js.
export function SyncStatusBar({ syncBezig, syncStatus }) {
  const [phase, setPhase] = useState('idle'); // idle | bezig | ok | fout
  const [prevBezig, setPrevBezig] = useState(syncBezig);

  // Reageert op wijzigingen in de syncBezig-prop tijdens render (geen effect),
  // zoals aanbevolen door React voor het afleiden van state uit props.
  if (syncBezig !== prevBezig) {
    setPrevBezig(syncBezig);
    if (syncBezig) {
      setPhase('bezig');
    } else if (syncStatus === 'ok' || syncStatus === 'fout') {
      setPhase(syncStatus);
    } else {
      setPhase('idle');
    }
  }

  useEffect(() => {
    if (phase !== 'ok' && phase !== 'fout') return;
    const timer = setTimeout(() => setPhase('idle'), 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'idle') return null;

  const klasse = phase === 'ok' ? 'ok' : phase === 'fout' ? 'fout' : '';

  return (
    <div className={`sync-status-bar ${klasse}`}>
      {phase === 'bezig'
        ? <div className="sync-status-spinner" />
        : <span className={`sync-status-icon ${klasse}`}>{phase === 'fout' ? '✗' : '✓'}</span>}
      <span className="sync-status-text">{TEKST[phase]}</span>
      <button type="button" className="sync-status-close" title="Verbergen" onClick={() => setPhase('idle')}>
        ✕
      </button>
    </div>
  );
}
