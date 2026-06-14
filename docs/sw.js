// ============================================================
// SpuitLogger Service Worker v5
// Versie hier verhogen bij elke GitHub Pages deploy
// ============================================================
const APP_VERSION  = '5';
const CACHE_STATIC = `spuitlog-static-v${APP_VERSION}`;
const CACHE_TILES  = `spuitlog-tiles-v${APP_VERSION}`;
const CACHE_API    = `spuitlog-api-v${APP_VERSION}`;

// App-bestanden die altijd netwerk-first geladen worden
// zodat een nieuwe deploy direct zichtbaar is.
const NEVER_CACHE_PATTERNS = [
  /\/index\.html/,
  /\/manifest\.json/,
  /\/sw\.js/,
];

// Statische externe CDN-assets (stabiel, cache-first ok)
const STATIC_CDN = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log(`[SW] Install: ${CACHE_STATIC}`);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_CDN))
      .then(() => {
        // skipWaiting: nieuwe SW activeert meteen, wacht niet
        // op sluiten van alle tabbladen
        return self.skipWaiting();
      })
      .catch(err => {
        // CDN pre-cache mag mislukken (bijv. offline) — geen blokkade
        console.warn('[SW] Pre-cache deels mislukt (ok bij offline install):', err);
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log(`[SW] Activate: ${CACHE_STATIC}`);
  event.waitUntil(
    caches.keys()
      .then(keys => {
        const verwijder = keys.filter(k =>
          // Verwijder alle caches die niet van deze versie zijn
          (k.startsWith('spuitlog-') || k.startsWith('spuitlogger-') || k.startsWith('driftlog-')) &&
          k !== CACHE_STATIC && k !== CACHE_TILES && k !== CACHE_API
        );
        if (verwijder.length) {
          console.log('[SW] Verwijder oude caches:', verwijder);
        }
        return Promise.all(verwijder.map(k => caches.delete(k)));
      })
      .then(() => {
        // claim(): deze SW beheert meteen alle open tabbladen
        // zonder dat de gebruiker hoeft te herladen
        return self.clients.claim();
      })
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. App-kern (index.html, manifest.json, sw.js):
  //    Altijd netwerk-first + geen cache → garandeert verse HTML bij deploy
  if (NEVER_CACHE_PATTERNS.some(p => p.test(url.pathname)) ||
      url.origin === self.location.origin) {
    event.respondWith(networkFirstNoCache(event.request));
    return;
  }

  // 2. Weerdata API: netwerk-first, kort gecacht (max 10 min)
  if (url.hostname === 'api.open-meteo.com') {
    event.respondWith(networkFirstWithCache(event.request, CACHE_API, 600_000));
    return;
  }

  // 3. Kaart tiles: cache-first (tiles veranderen zelden)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(event.request, CACHE_TILES));
    return;
  }

  // 4. Overige externe CDN: cache-first
  event.respondWith(cacheFirst(event.request, CACHE_STATIC));
});

// ── FETCH STRATEGIE HELPERS ──────────────────────────────────

// Netwerk-first, sla NOOIT op in cache (voor index.html e.d.)
async function networkFirstNoCache(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) return response;
    throw new Error(`HTTP ${response.status}`);
  } catch {
    // Offline fallback: geef gecachte versie als die bestaat
    const cached = await caches.match(request);
    if (cached) return cached;
    // Absolute fallback: geef root terug (voor navigatie)
    const root = await caches.match('./');
    return root || new Response('Offline — herlaad wanneer verbinding hersteld is.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Netwerk-first met tijdelijk cache (voor API)
async function networkFirstWithCache(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Sla op met timestamp header voor TTL-check
      const headers  = new Headers(response.headers);
      headers.set('x-sw-cached-at', Date.now().toString());
      const body     = await response.arrayBuffer();
      const modified = new Response(body, { status: response.status, headers });
      cache.put(request, modified.clone());
      return new Response(body, { status: response.status, headers: response.headers });
    }
    throw new Error(`HTTP ${response.status}`);
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('x-sw-cached-at') || '0');
      if (Date.now() - cachedAt < maxAgeMs) return cached;
    }
    return cached || new Response('{}', { status: 503 });
  }
}

// Cache-first (voor tiles en CDN)
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── UPDATE BROADCAST ─────────────────────────────────────────
// Stuur bericht naar alle clients zodat de UI een update-banner kan tonen
self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: APP_VERSION,
          cache: CACHE_STATIC
        });
      });
    })
  );
});

// ── BERICHTEN VAN DE PAGINA ───────────────────────────────────
self.addEventListener('message', event => {
  // Pagina vraagt de SW om zichzelf direct te activeren
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting gevraagd door pagina');
    self.skipWaiting();
  }

  // Debug: pagina vraagt actieve cache naam
  if (event.data?.type === 'GET_CACHE_NAME') {
    event.ports[0]?.postMessage({ cache: CACHE_STATIC });
  }
});
