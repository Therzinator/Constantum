import { idbGetBijlagen } from '../storage/indexedDB.js';
import { APP_VERSION_CLIENT } from '../version.js';

// Komt overeen met exportJSON() uit docs/index.html — verrijkt elke melding
// met de volledige dataUrl uit IndexedDB (localStorage bevat die nooit, zie
// lib/storage/localStorage.js::stripDataUrls) en geeft het backup-object
// terug (geen DOM/download).
export async function meldingenNaarJSONBackup(meldingen, locatieLabel) {
  const verrijkt = await Promise.all(meldingen.map(async (m) => {
    const idbBijlagen = await idbGetBijlagen(m.id);
    const bestanden = (m.bestanden || []).map((f) => {
      const idb = idbBijlagen.find((b) => b.hash === f.hash || b.name === f.name);
      return { ...f, dataUrl: idb ? idb.dataUrl : null };
    });
    return { ...m, bestanden };
  }));

  return {
    export_timestamp: new Date().toISOString(),
    version: APP_VERSION_CLIENT,
    source: 'SpuitLogger PWA',
    location: locatieLabel || null,
    total_meldingen: verrijkt.length,
    meldingen: verrijkt
  };
}
