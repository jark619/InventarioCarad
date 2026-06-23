const CACHE = 'sgi-v2'; const ASSETS = ['/', '/inventory', '/pos'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('/'))); return; } e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match('/')))); });
