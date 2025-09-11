const CACHE_NAME = 'time-2025-09-11-v2';
const PRECACHE = [
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
  // NOTA: non pre-cachiamo più HTML/JS, così non rimangono vecchi
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
  );
  self.clients.claim();
});

// Network-first per navigazioni (HTML), SWR per il resto
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Pagine HTML / navigate
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || Response.error();
      }
    })());
    return;
  }

  // Altri asset: stale-while-revalidate
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchPromise = fetch(req).then(async (res) => {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
