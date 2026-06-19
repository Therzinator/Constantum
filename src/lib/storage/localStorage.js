import { byteSize } from '../../utils/format.js';

export function safeSetLocalStorage(key, value) {
  const json = JSON.stringify(value);
  const size = byteSize(json);
  if (size > 4_000_000) {
    throw new Error(`Opslagobject te groot voor localStorage: ${Math.round(size / 1024)} KB`);
  }
  localStorage.setItem(key, json);
}

export function getStorageSize() {
  let total = 0;
  try {
    for (const key of Object.keys(localStorage)) {
      total += (localStorage[key] || '').length + key.length;
    }
  } catch {}
  return (total / 1024).toFixed(1) + ' KB';
}

// ── localStorage: alleen metadata zonder dataUrls ─────────────
export function getMeldingen() {
  try {
    // Migratie van oude sleutel
    const old = localStorage.getItem('driftlog_meldingen');
    if (old && !localStorage.getItem('spuitlog_meldingen')) {
      // Migreer maar strip dataUrls direct
      try {
        const parsed = JSON.parse(old);
        const stripped = parsed.map(m => stripDataUrls(m));
        localStorage.setItem('spuitlog_meldingen', JSON.stringify(stripped));
      } catch {}
    }
    return JSON.parse(localStorage.getItem('spuitlog_meldingen') || '[]');
  } catch { return []; }
}

// Strip dataUrls uit een melding voor localStorage-opslag
export function stripDataUrls(melding) {
  return {
    ...melding,
    weather_raw: null,  // groot — niet opslaan in LS
    bestanden: (melding.bestanden || []).map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      lastModified: f.lastModified,
      hash: f.hash,
      thumbnail: f.thumbnail || null,  // klein gecomprimeerd thumbnail (< 200 KB)
      dataUrl: null                     // NOOIT opslaan in localStorage
    }))
  };
}

export function saveMeldingen(data) {
  // Altijd strippen voor opslaan
  const stripped = data.map(m => stripDataUrls(m));
  try {
    safeSetLocalStorage('spuitlog_meldingen', stripped);
  } catch (err) {
    console.error('[SpuitLogger] localStorage opslag mislukt:', err);
    // Noodplan: sla op zonder bijlagen-thumbnails
    const ultraLight = stripped.map(m => ({ ...m, bestanden: (m.bestanden || []).map(f => ({
      name: f.name, type: f.type, size: f.size, hash: f.hash, thumbnail: null, dataUrl: null
    })) }));
    try {
      safeSetLocalStorage('spuitlog_meldingen', ultraLight);
      console.warn('[SpuitLogger] Opgeslagen zonder thumbnails vanwege opslaglimiet');
    } catch (err2) {
      console.error('[SpuitLogger] Kon niet opslaan, ook niet zonder thumbnails:', err2);
      throw err2;
    }
  }
}
