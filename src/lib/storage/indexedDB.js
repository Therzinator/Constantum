// ── IndexedDB: bijlagen (dataUrls) ───────────────────────────
const IDB_NAME    = 'spuitlog_idb';
const IDB_VERSION = 3;             // v3: meldingId index toegevoegd
const IDB_STORE   = 'bijlagen';
let _idb = null;

export async function openIDB() {
  if (_idb) return _idb;
  return new Promise((resolve, reject) => {
    // Sluit bestaande verbinding als die er is
    if (_idb) { _idb.close(); _idb = null; }

    const req = indexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = e => {
      const db        = e.target.result;
      const oldVersion = e.oldVersion;
      console.log(`[IDB] Upgrade van v${oldVersion} naar v${IDB_VERSION}`);

      // Verwijder oude store als die bestaat maar verkeerd geconfigureerd is
      if (db.objectStoreNames.contains(IDB_STORE)) {
        db.deleteObjectStore(IDB_STORE);
        console.log('[IDB] Oude store verwijderd');
      }
      // Maak store opnieuw aan met meldingId index voor snelle lookups
      const store = db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      store.createIndex('meldingId', 'meldingId', { unique: false });
      console.log('[IDB] Store bijlagen aangemaakt (v3, met meldingId index)');
    };

    req.onsuccess = e => {
      _idb = e.target.result;
      // Vang onverwachte sluitingen op (bijv. door andere tab die versie verhoogt)
      _idb.onversionchange = () => { _idb.close(); _idb = null; };
      resolve(_idb);
    };

    req.onerror   = e => {
      console.error('[IDB] Open mislukt:', e.target.error);
      reject(e.target.error);
    };

    req.onblocked = () => {
      console.warn('[IDB] Geblokkeerd — sluit andere tabbladen en herlaad');
    };
  });
}

// Sla bijlage op in IndexedDB: { id: 'MELDINGID_bestandnaam', dataUrl, type, name, meldingId }
export async function idbSaveBijlage(record) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror    = e => reject(e.target.error);
    });
  } catch (err) {
    console.warn('[SpuitLogger] IndexedDB opslaan mislukt:', err);
    return false;
  }
}

export async function idbGetBijlagen(meldingId) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      // Gebruik meldingId index als die bestaat (IDB v3+), anders fallback op cursor
      if (store.indexNames.contains('meldingId')) {
        const idx = store.index('meldingId');
        const req = idx.getAll(meldingId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = e => reject(e.target.error);
      } else {
        // Fallback voor bestaande IDB v2 instanties (tot upgrade klaar is)
        const results = [];
        store.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.meldingId === meldingId) results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        tx.onerror = e => reject(e.target.error);
      }
    });
  } catch (err) {
    console.warn('[SpuitLogger] IndexedDB ophalen mislukt:', err);
    return [];
  }
}

// Verwijder bijlagen van een melding uit IndexedDB
export async function idbDeleteBijlagen(meldingId) {
  try {
    const db    = await openIDB();
    const bestaand = await idbGetBijlagen(meldingId);
    const tx    = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    bestaand.forEach(b => store.delete(b.id));
  } catch (err) {
    console.warn('[SpuitLogger] IndexedDB verwijderen mislukt:', err);
  }
}

// Tel alle bijlagen in IndexedDB
export async function idbCountBijlagen() {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(0);
    });
  } catch { return 0; }
}

// Verwijder ALLE bijlagen uit IndexedDB (opschonen)
export async function idbClearAll() {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => resolve(false);
    });
  } catch { return false; }
}
