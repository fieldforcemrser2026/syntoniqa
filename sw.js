// ============================================================
// Syntoniqa v2.0 — Service Worker
// Cache-first app shell, network-first API, IndexedDB offline queue
// ============================================================

const CACHE_NAME = 'syntoniqa-v2.1';
const API_CACHE = 'syntoniqa-api-v1';

// App shell — cache-first (aggiornato in background)
const APP_SHELL = [
  './',
  './index_v2.html',
  './admin_v1.html',
  './manifest.json',
  './white_label_config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
];

// URL patterns che NON devono MAI essere cachati
const NEVER_CACHE = [
  /api\.telegram/,
  /nominatim/,
  /resend\.com/,
  /cdnjs\.cloudflare\.com.*xlsx/,  // SheetJS caricato on-demand
];

// URL patterns per le API (network-first con fallback cache)
const API_PATTERNS = [
  /workers\.dev/,
  /supabase\.co/,
];

// ── IndexedDB per offline queue ────────────────────────────────
const DB_NAME = 'syntoniqa-offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'pending-actions';
const STORE_SNAPSHOT = 'data-snapshot';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) {
        db.createObjectStore(STORE_SNAPSHOT, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueAction(action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    tx.objectStore(STORE_QUEUE).add({
      ...action,
      timestamp: Date.now(),
      synced: false
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPendingActions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_QUEUE).getAll();
    req.onsuccess = () => resolve(req.result.filter(a => !a.synced));
    req.onerror = () => reject(req.error);
  });
}

async function markSynced(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function clearSyncedActions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.getAll();
    req.onsuccess = () => {
      for (const item of req.result) {
        if (item.synced) store.delete(item.id);
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function saveSnapshot(key, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOT, 'readwrite');
    tx.objectStore(STORE_SNAPSHOT).put({ key, data, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSnapshot(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOT, 'readonly');
    const req = tx.objectStore(STORE_SNAPSHOT).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

// ── Install: precache app shell ────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch handler ──────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip NEVER_CACHE patterns
  if (NEVER_CACHE.some(p => p.test(request.url))) return;

  // POST requests to API — intercept for offline queue
  if (request.method === 'POST' && API_PATTERNS.some(p => p.test(request.url))) {
    event.respondWith(handleAPIPost(request));
    return;
  }

  // Skip non-GET
  if (request.method !== 'GET') return;

  // API GET requests — network-first with cache fallback
  if (API_PATTERNS.some(p => p.test(request.url))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // App shell and static assets — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── Strategies ─────────────────────────────────────────────────

// Network-first: try network, fallback to cache, save snapshot for getAll
async function networkFirst(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      // Cache API responses
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
      // Save getAll data as snapshot for offline use
      if (url.searchParams.get('action') === 'getAll') {
        try {
          const data = await response.clone().json();
          if (data.success && data.data) {
            await saveSnapshot('getAll', data);
          }
        } catch(e) { /* ignore parse errors */ }
      }
    }
    return response;
  } catch (e) {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // For getAll, try IndexedDB snapshot
    if (url.searchParams.get('action') === 'getAll') {
      const snapshot = await getSnapshot('getAll').catch(() => null);
      if (snapshot && snapshot.data) {
        return new Response(JSON.stringify(snapshot.data), {
          headers: {
            'Content-Type': 'application/json',
            'X-Offline': 'true',
            'X-Snapshot-Age': String(Date.now() - snapshot.timestamp)
          }
        });
      }
    }
    // Return offline error response
    return new Response(JSON.stringify({
      success: false,
      error: 'Sei offline. I dati verranno sincronizzati quando torni online.',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle API POST — queue offline if network fails
async function handleAPIPost(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (e) {
    // Network failed — queue the action for later sync
    try {
      const body = await request.clone().json();
      const action = body.action || 'unknown';
      // Only queue certain safe actions (not login, not read-only)
      const QUEUEABLE = [
        'createUrgenza', 'updateUrgenza', 'startUrgenza', 'resolveUrgenza',
        'createPiano', 'updatePiano',
        'createOrdine', 'updateOrdine',
        'createTrasferta',
        'sendChatMessage',
        'updateProfile'
      ];
      if (QUEUEABLE.includes(action)) {
        await queueAction({
          url: request.url,
          method: 'POST',
          headers: Object.fromEntries(request.headers.entries()),
          body: body
        });
        // Notify all clients about queued action
        const allClients = await self.clients.matchAll();
        for (const client of allClients) {
          client.postMessage({
            type: 'ACTION_QUEUED',
            action: action,
            message: `Azione "${action}" salvata offline. Verrà inviata quando torni online.`
          });
        }
        return new Response(JSON.stringify({
          success: true,
          data: { queued: true, action },
          offline: true,
          message: 'Azione salvata offline'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch(e2) { /* ignore body parse errors */ }
    return new Response(JSON.stringify({
      success: false,
      error: 'Sei offline. Questa azione richiede connessione.',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale-while-revalidate: return cache immediately, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  // Fetch update in background
  const fetchPromise = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  // Return cached immediately, or wait for network
  if (cached) return cached;
  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;
  // Nothing in cache, nothing from network — offline fallback
  return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:DM Sans,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#050505;color:#fff;text-align:center;padding:24px}.card{max-width:360px}.icon{font-size:64px;margin-bottom:16px}h1{font-size:1.3rem;margin-bottom:8px}p{color:#999;font-size:.9rem;margin-bottom:24px}button{background:#C30A14;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:1rem;cursor:pointer}</style></head><body><div class="card"><div class="icon">📡</div><h1>Sei offline</h1><p>Controlla la connessione internet e riprova.</p><button onclick="location.reload()">🔄 Riprova</button></div></body></html>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ── Background Sync ────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-actions') {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  const pending = await getPendingActions();
  if (!pending.length) return;
  console.log(`[SW] Sincronizzando ${pending.length} azioni offline...`);
  let synced = 0, failed = 0;
  for (const action of pending) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: JSON.stringify(action.body)
      });
      if (response.ok) {
        await markSynced(action.id);
        synced++;
      } else {
        failed++;
        console.warn(`[SW] Sync fallita per azione ${action.body?.action}:`, response.status);
      }
    } catch (e) {
      failed++;
      console.warn(`[SW] Sync errore per azione ${action.body?.action}:`, e.message);
    }
  }
  // Clean up synced actions
  await clearSyncedActions();
  // Notify clients
  const allClients = await self.clients.matchAll();
  for (const client of allClients) {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      synced,
      failed,
      message: `Sincronizzate ${synced} azioni${failed ? `, ${failed} fallite` : ''}`
    });
  }
}

// ── Online/offline event from clients ──────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'ONLINE') {
    // User came back online — trigger sync
    syncPendingActions().catch(e => console.error('[SW] Manual sync error:', e));
  }
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_PENDING_COUNT') {
    getPendingActions().then(actions => {
      event.source.postMessage({
        type: 'PENDING_COUNT',
        count: actions.length
      });
    });
  }
});

// ── Push Notifications ─────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'Syntoniqa', body: event.data.text() }; }
  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    tag: data.tag || 'syntoniqa-' + Date.now(),
    data: { url: data.url || './' },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Syntoniqa', options)
  );
});

// ── Notification click ─────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './index_v2.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing tab
      for (const client of clientList) {
        if (client.url.includes('index_v2') && 'focus' in client) return client.focus();
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
