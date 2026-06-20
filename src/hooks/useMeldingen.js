import { useState, useCallback } from 'react';
import { getMeldingen, saveMeldingen, safeSetLocalStorage } from '../lib/storage/localStorage.js';
import { idbDeleteBijlagen, idbClearAll } from '../lib/storage/indexedDB.js';

// ── OFFLINE QUEUE ─────────────────────────────────────────────
// Voorheen module-level _offlineQueue/_deleteQueue globals — nu React state.
function laadOfflineQueue() {
  let offlineQueue;
  let deleteQueue;
  try {
    offlineQueue = JSON.parse(localStorage.getItem('spuitlog_sync_queue') || '[]');
  } catch { offlineQueue = []; }
  try {
    deleteQueue = JSON.parse(localStorage.getItem('spuitlog_delete_queue') || '[]');
  } catch { deleteQueue = []; }
  return { offlineQueue, deleteQueue };
}

function slaOfflineQueueOp(offlineQueue, deleteQueue) {
  try {
    safeSetLocalStorage('spuitlog_sync_queue', offlineQueue);
    safeSetLocalStorage('spuitlog_delete_queue', deleteQueue);
  } catch { /* queue te groot — negeer */ }
}

// Lokale CRUD + offline-queue voor meldingen.
// Cloud-sync (Supabase) en rechten-checks (isAdmin/magVerwijderen) horen
// bij hooks/useSupabaseSync.js en useAuth.js (fase 3) — die roepen de
// acties van deze hook aan, niet andersom.
export function useMeldingen() {
  const [meldingen, setMeldingenState] = useState(() => getMeldingen());
  const [queues, setQueues] = useState(() => laadOfflineQueue());

  const herlaadMeldingen = useCallback(() => {
    setMeldingenState(getMeldingen());
  }, []);

  const persistMeldingen = useCallback((data) => {
    saveMeldingen(data);
    setMeldingenState(data);
  }, []);

  const voegToeAanQueue = useCallback((meldingId) => {
    setQueues(prev => {
      if (prev.offlineQueue.includes(meldingId)) return prev;
      const next = { ...prev, offlineQueue: [...prev.offlineQueue, meldingId] };
      slaOfflineQueueOp(next.offlineQueue, next.deleteQueue);
      return next;
    });
  }, []);

  const voegToeAanDeleteQueue = useCallback((meldingId) => {
    setQueues(prev => {
      if (prev.deleteQueue.includes(meldingId)) return prev;
      const next = { ...prev, deleteQueue: [...prev.deleteQueue, meldingId] };
      slaOfflineQueueOp(next.offlineQueue, next.deleteQueue);
      return next;
    });
  }, []);

  const verwijderUitQueue = useCallback((meldingId) => {
    setQueues(prev => {
      const next = {
        offlineQueue: prev.offlineQueue.filter(id => id !== meldingId),
        deleteQueue: prev.deleteQueue.filter(id => id !== meldingId)
      };
      slaOfflineQueueOp(next.offlineQueue, next.deleteQueue);
      return next;
    });
  }, []);

  // Komt overeen met het opslaan-deel van submitMelding (fase 5 bouwt de rest van het formulier)
  const voegMeldingToe = useCallback((melding) => {
    const nieuw = [...getMeldingen(), melding];
    persistMeldingen(nieuw);
    voegToeAanQueue(melding.id);
  }, [persistMeldingen, voegToeAanQueue]);

  // Komt overeen met het lokale gedeelte van verwijderMelding (zonder rechtencheck/toast/Supabase soft-delete)
  const verwijderMeldingLokaal = useCallback((id) => {
    const nieuw = getMeldingen().filter(m => m.id !== id);
    persistMeldingen(nieuw);
    idbDeleteBijlagen(id);
    verwijderUitQueue(id);
    voegToeAanDeleteQueue(id);
  }, [persistMeldingen, verwijderUitQueue, voegToeAanDeleteQueue]);

  // Komt overeen met de merge-by-id-logica in importJSON() — bestaande
  // meldingen blijven behouden, alleen niet-bestaande ID's worden toegevoegd.
  // Geeft het aantal nieuw toegevoegde meldingen terug.
  const importeerMeldingen = useCallback((nieuweMeldingen) => {
    const bestaand = getMeldingen();
    const bestaandeIds = new Set(bestaand.map((m) => m.id));
    const nieuw = nieuweMeldingen.filter((m) => !bestaandeIds.has(m.id));
    if (nieuw.length) {
      const samen = [...nieuw, ...bestaand].sort(
        (a, b) => new Date(b.timestamp_local) - new Date(a.timestamp_local)
      );
      persistMeldingen(samen);
    }
    return nieuw.length;
  }, [persistMeldingen]);

  // Komt overeen met het lokale deel van clearAllData() — leegt localStorage
  // (incl. de oude driftlog_meldingen-sleutel) en IndexedDB.
  const verwijderAlleMeldingenLokaal = useCallback(async () => {
    localStorage.removeItem('spuitlog_meldingen');
    localStorage.removeItem('driftlog_meldingen');
    await idbClearAll();
    setMeldingenState([]);
  }, []);

  return {
    meldingen,
    offlineQueue: queues.offlineQueue,
    deleteQueue: queues.deleteQueue,
    herlaadMeldingen,
    persistMeldingen,
    voegMeldingToe,
    verwijderMeldingLokaal,
    importeerMeldingen,
    verwijderAlleMeldingenLokaal,
    voegToeAanQueue,
    voegToeAanDeleteQueue,
    verwijderUitQueue
  };
}
