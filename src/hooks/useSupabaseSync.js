import { useState, useCallback, useRef, useEffect } from 'react';
import { sbClient, SUPABASE_ENABLED } from '../lib/supabase/client.js';
import { sbSyncMelding, laadVanSupabase as laadVanSupabaseData } from '../lib/supabase/entries.js';
import { sbSyncBijlagen } from '../lib/supabase/bijlagen.js';
import { sbAuditLog } from '../lib/supabase/auditLog.js';
import { getMeldingen, saveMeldingen } from '../lib/storage/localStorage.js';

// Komt overeen met syncNu/laadVanSupabase/startRealtime/stopRealtime uit
// docs/index.html. UI-feedback (toonSyncBalk/toast/updateSyncHeaderDot) is
// hier niet overgenomen — de component leest syncBezig/syncStatus en het
// resultaat van syncNu()/laadVanCloud() om dat zelf te tonen.
//
// meldingenApi: het object dat hooks/useMeldingen.js teruggeeft
// (offlineQueue, deleteQueue, voegToeAanQueue, voegToeAanDeleteQueue,
// verwijderUitQueue, herlaadMeldingen).
export function useSupabaseSync(user, meldingenApi) {
  const [syncBezig, setSyncBezig] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | bezig | ok | fout | offline
  const realtimeChannelRef = useRef(null);

  const {
    offlineQueue,
    deleteQueue,
    voegToeAanQueue,
    verwijderUitQueue,
    herlaadMeldingen
  } = meldingenApi;

  // Hoofd sync functie: verwerk offline queue
  const syncNu = useCallback(async () => {
    if (!SUPABASE_ENABLED || !user || syncBezig) return null;
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return null;
    }

    setSyncBezig(true);
    setSyncStatus('bezig');

    const sb = sbClient();

    // ── Verwerk delete queue eerst ────────────────────────────
    const teVerwijderenAantal = deleteQueue.length;
    if (sb && deleteQueue.length > 0) {
      const teVerwijderen = [...deleteQueue];
      for (const delId of teVerwijderen) {
        const { error } = await sb.from('entries')
          .update({ deleted: true }, { count: 'exact' })
          .eq('id', delId)
          .eq('user_id', user.id);

        if (!error) {
          // count === 0: entry bestond niet in Supabase (nooit gesynchroniseerd) — lokaal verwijderen volstaat
          // count > 0: update geslaagd, bevestigd via count
          verwijderUitQueue(delId);
        } else {
          console.warn('[Supabase] Delete queue mislukt voor:', delId, error.message);
        }
      }
    }

    const meldingen = getMeldingen();
    const teSync = meldingen.filter(m =>
      m.sync_status === 'lokaal' ||
      m.sync_status === 'sync_mislukt' ||
      offlineQueue.includes(m.id)
    );

    let geslaagd = 0;
    let mislukt  = 0;

    for (const melding of teSync) {
      try {
        const ok = await sbSyncMelding(melding, user);
        if (ok) {
          await sbSyncBijlagen(melding.id, melding.bestanden, user);
          await sbAuditLog(melding.id, 'synced', {
            hash:     melding.hash,
            rfc3161:  melding.rfc3161?.timestamp || null,
            bijlagen: melding.bestanden?.length  || 0,
            device:   navigator.platform
          }, user);

          // Update lokale sync_status
          const alle = getMeldingen();
          const idx  = alle.findIndex(m => m.id === melding.id);
          if (idx >= 0) {
            alle[idx].sync_status = 'synced';
            alle[idx].sync_at     = new Date().toISOString();
            saveMeldingen(alle);
          }
          verwijderUitQueue(melding.id);
          geslaagd++;
        } else {
          // Markeer als mislukt
          const alle = getMeldingen();
          const idx  = alle.findIndex(m => m.id === melding.id);
          if (idx >= 0) { alle[idx].sync_status = 'sync_mislukt'; saveMeldingen(alle); }
          voegToeAanQueue(melding.id);
          mislukt++;
        }
      } catch (e) {
        console.error('[Supabase] Sync fout voor', melding.id, ':', e.message);
        voegToeAanQueue(melding.id);
        mislukt++;
      }
    }

    setSyncBezig(false);
    setSyncStatus(mislukt > 0 ? 'fout' : 'ok');
    herlaadMeldingen();

    return { geslaagd, mislukt, verwijderingen: teVerwijderenAantal };
  }, [user, syncBezig, offlineQueue, deleteQueue, voegToeAanQueue, verwijderUitQueue, herlaadMeldingen]);

  // Laad meldingen van Supabase (andere apparaten)
  const laadVanCloud = useCallback(async (force = false) => {
    if (!user) throw new Error('Niet ingelogd');
    if (!navigator.onLine) throw new Error('Offline');
    const resultaat = await laadVanSupabaseData(user, force);
    herlaadMeldingen();
    return resultaat;
  }, [user, herlaadMeldingen]);

  const startRealtime = useCallback(() => {
    const sb = sbClient();
    if (!sb || !user || !SUPABASE_ENABLED) return;
    if (realtimeChannelRef.current) return; // al actief

    realtimeChannelRef.current = sb
      .channel('entries-live')
      .on('postgres_changes', {
        event: '*',           // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'entries',
      }, payload => {
        console.log('[Realtime] Wijziging ontvangen:', payload.eventType, payload.new?.id);
        // Kleine vertraging zodat Supabase REST ook bijgewerkt is
        setTimeout(() => { laadVanCloud(); }, 500);
      })
      .subscribe(status => {
        console.log('[Realtime] Status:', status);
      });
  }, [user, laadVanCloud]);

  const stopRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }
  }, []);

  // Realtime start/stop volgt automatisch de inlogstatus
  useEffect(() => {
    if (user) startRealtime();
    else stopRealtime();
    return () => stopRealtime();
  }, [user, startRealtime, stopRealtime]);

  return {
    syncBezig,
    syncStatus,
    syncNu,
    laadVanCloud,
    startRealtime,
    stopRealtime
  };
}
