/* PocketSoccer: service worker. Network first, cache as the fallback: online you always get the newest build,
   offline the last one you loaded still plays. (The same approach as PocketFootball.) */
const CACHE = 'pocketsoccer-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const OURS = u => u.origin === self.location.origin || /^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url) || !OURS(new URL(req.url))) return;
  const own = new URL(req.url).origin === self.location.origin;
  e.respondWith(
    (own ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req)).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || Response.error()))
  );
});
