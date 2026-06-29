import { useState, useCallback, useRef, useEffect } from 'react';
import { sbClient, SUPABASE_ENABLED } from '../lib/supabase/client.js';
import { sbSyncMeldingenBatch, laadVanSupabase as laadVanSupabaseData } from '../lib/supabase/entries.js';
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
  const reloadTimerRef = useRef(null);

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
          await sbAuditLog(delId, 'deleted', { door: user.id }, user);
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

    // Batch upsert alle entries in één DB-call i.p.v. N seriële calls
    let oks = teSync.map(() => false);
    try {
      oks = await sbSyncMeldingenBatch(teSync, user);
    } catch (e) {
      console.error('[Supabase] Batch sync fout:', e.message);
    }

    // Bijlagen parallel uploaden — bijlagen per melding hebben eigen meldingId,
    // dus geen conflict. De localStorage-update daarna is serieel (één write).
    const bijlagenResultaten = await Promise.all(teSync.map(async (melding, i) => {
      if (!oks[i]) return false;
      await sbSyncBijlagen(melding.id, melding.bestanden, user);
      sbAuditLog(melding.id, 'synced', {
        hash:     melding.hash,
        rfc3161:  melding.rfc3161?.timestamp || null,
        bijlagen: melding.bestanden?.length  || 0,
        device:   navigator.platform
      }, user);
      return true;
    }));

    // Eén lees + één schrijf naar localStorage, na afloop van alle parallelle taken
    const alle = getMeldingen();
    for (let i = 0; i < teSync.length; i++) {
      const melding = teSync[i];
      const idx = alle.findIndex(m => m.id === melding.id);
      if (bijlagenResultaten[i]) {
        if (idx >= 0) { alle[idx].sync_status = 'synced'; alle[idx].sync_at = new Date().toISOString(); }
        verwijderUitQueue(melding.id);
        geslaagd++;
      } else {
        if (idx >= 0) { alle[idx].sync_status = 'sync_mislukt'; }
        voegToeAanQueue(melding.id);
        mislukt++;
      }
    }
    saveMeldingen(alle);

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

    // TERUGGEDRAAID (2026-06-21): de eerdere versie hier gebruikte twee
    // postgres_changes-listeners MET een `filter`-optie (user_id/
    // opt_in_buurt) om minder Realtime-verkeer te krijgen. Dat is nooit
    // tegen een echte Supabase-backend getest (lokaal staat
    // SUPABASE_ENABLED altijd uit, zie lib/supabase/client.js) en bleek
    // bij de eerste echte login een oneindige reconnect-lus te
    // veroorzaken ("[Realtime] Status: CLOSED" continu herhaald, hele app
    // bevroren) — vermoedelijk een door de server afgewezen filter die de
    // client steeds opnieuw laat verbinden. Terug naar de eenvoudige,
    // ongefilterde listener; de schaal-optimalisatie (minder verkeer bij
    // veel gelijktijdige gebruikers) moet eerst apart, tegen een echte
    // Supabase-omgeving, opnieuw uitgewerkt worden.
    realtimeChannelRef.current = sb
      .channel('entries-live')
      .on('postgres_changes', {
        event: '*',           // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'entries',
      }, () => {
        // Gedebounced i.p.v. een setTimeout per event — bij een burst van
        // wijzigingen (bv. de admin-postcode-backfill die tientallen rijen
        // achter elkaar update) joeg elk event een eigen volledige reload
        // van alle meldingen (incl. N+1 bijlagen-queries) los, wat de app
        // tijdens/na zo'n actie onbruikbaar traag maakte.
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(() => { laadVanCloud(); }, 800);
      })
      .subscribe(status => {
        console.log('[Realtime] Status:', status);
      });
  }, [user, laadVanCloud]);

  const stopRealtime = useCallback(() => {
    clearTimeout(reloadTimerRef.current);
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

  // Synchroniseert automatisch zodra de verbinding terugkomt — zonder dit
  // bleef de offline-queue staan tot de gebruiker zelf terugkwam in de app
  // of handmatig syncNu() aanriep (zie SyncStatusBar.jsx), wat in een
  // buitengebied met wisselende dekking een melding "verloren" kan laten
  // voelen terwijl hij gewoon lokaal klaarstaat.
  useEffect(() => {
    if (!user) return;
    const handleOnline = () => { syncNu(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, syncNu]);

  return {
    syncBezig,
    syncStatus,
    syncNu,
    laadVanCloud,
    startRealtime,
    stopRealtime
  };
}
