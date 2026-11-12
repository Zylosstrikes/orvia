// Orvia service worker. Bump VERSION to force old clients to update.
const VERSION = 'orvia-v4';
const SHELL = ['/', '/app.css?v=4', '/app.js?v=4', '/icon.svg'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  // never touch: non-GET, cross-origin (external links, icons, images), API calls, the /go redirector, range requests
  if (req.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/go' || req.headers.has('range')) return;
  // page navigations (any SPA route, incl. /view?u=…): network first, offline -> cached app shell. Never cached per-URL.
  if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('/'))); return; }
  e.respondWith(fetch(req).then((r) => { if (r.ok && r.type === 'basic' && !u.search.includes('u=')) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); } return r; })
    .catch(() => caches.match(req).then((r) => r || Response.error())));
});
