// Orvia service worker. Bump VERSION to force old clients to update.
const VERSION = 'orvia-v3';
const SHELL = ['/', '/app.css?v=3', '/app.js?v=3', '/icon.svg'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  // never touch: non-GET, cross-origin (external links, icons, images), API calls, range requests
  if (req.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || req.headers.has('range')) return;
  e.respondWith(fetch(req).then((r) => { if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); } return r; })
    .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
