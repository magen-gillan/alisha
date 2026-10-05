/**
 * Alisha Service Worker.
 *
 * Strategy:
 *  - Precache the app shell (HTML, JS, CSS, icon) on install.
 *  - Network-first for navigation requests (so users get updates immediately
 *    when online, and the cached shell when offline).
 *  - Stale-while-revalidate for static assets (icons, backgrounds).
 *  - Network-only for /api/* (never cache API responses — they may contain
 *    dynamic content from the user's conversation).
 *
 * NOTE: this is intentionally minimal. We don't precache large assets
 * (Live2D, pixi.js) to keep install fast.
 */

const CACHE_VERSION = 'alisha-v1';
const PRECACHE_URLS = [
  '/',
  '/alisha-new-icon.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API routes.
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for navigation.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Stale-while-revalidate for same-origin static assets.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((resp) => {
            if (resp.ok) {
              const copy = resp.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
            }
            return resp;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
