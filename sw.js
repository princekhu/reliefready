// ReliefReady offline support. Pages and scripts: network first (so updates show at once), cached copy when offline.
const CACHE = 'reliefready-v6';
const FILES = ['./','index.html','sos.html','driver.html','admin.html','planner.html','manifest.webmanifest','icon.svg',
  'assets/common.css','assets/common.js','assets/maptools.css','assets/maptools.js','js/model.js','assets/config.js','assets/images/layers.png','assets/images/layers-2x.png',
  'assets/leaflet.css','assets/leaflet.js','assets/qrcode.js','assets/jsQR.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'rr-tiles').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.pathname.includes('/api/') || u.hostname.includes('router.project-osrm.org')) return;   // live data: network only
  if (/tile\.openstreetmap\.org|arcgisonline\.com|opentopomap\.org|gibs\.earthdata/.test(u.hostname)) {   // map tiles: cache what was seen
    e.respondWith(caches.open('rr-tiles').then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); }
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch:true}).then(hit => hit || caches.match('sos.html'))));
});
