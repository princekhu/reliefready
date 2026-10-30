// ReliefReady offline cache: every page and asset is available with no network after the first visit.
const CACHE = 'reliefready-v2';
const FILES = ['./','index.html','sos.html','driver.html','admin.html','planner.html','manifest.webmanifest','icon.svg',
  'assets/common.css','assets/common.js','assets/config.js','assets/images/layers.png','assets/images/layers-2x.png','assets/leaflet.css','assets/leaflet.js','assets/qrcode.js','assets/jsQR.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname.includes('router.project-osrm.org')) return;              // live routing: network only
  if (u.pathname.startsWith('/api/')) return;                               // API calls: network only
  if (/tile\.openstreetmap\.org|arcgisonline\.com|opentopomap\.org/.test(u.hostname)) {                      // map tiles: cache what was seen
    e.respondWith(caches.open('rr-tiles').then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  e.respondWith(caches.match(e.request, {ignoreSearch:true}).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok && (u.origin === location.origin || u.hostname.includes('fonts.g'))) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); }
    return r;
  }).catch(() => caches.match('sos.html'))));
});
