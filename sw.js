// ============================================================
// Syntoniqa v1.0 — Service Worker
// Field Service Management PWA
// v1.0 — 2026
// ============================================================

const CACHE_NAME = 'syntoniqa-v1.0';
const CACHE_VERSION = 100;

const PRECACHE_URLS = [
  './',
  './index_v1.html',
  './admin_v1.html',
  './manifest.json',
  './white_label_config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
];

const NEVER_CACHE = [
  /workers\.dev/,       // Cloudflare Workers API
  /supabase\.co/,       // Supabase API
  /googleapis\.com/,    // Gemini AI
  /api\.telegram/,      // Telegram Bot
  /nominatim/,          // Geocoding
  /resend\.com/,        // Email API
];

// ── Install: precache assets ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for assets, network-first for API ─────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and NEVER_CACHE patterns
  if (request.method !== 'GET') return;
  if (NEVER_CACHE.some(pattern => pattern.test(request.url))) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    tag: data.tag || 'syntoniqa-notification',
    data: { url: data.url || './' },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Syntoniqa', options)
  );
});

// ── Notification click ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Background sync ──────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-interventi') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Placeholder: sync queued offline operations when back online
  console.log('[SW] Background sync triggered');
}
