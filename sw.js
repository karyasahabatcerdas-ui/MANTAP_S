const CACHE_NAME = 'mantap-ksc-v1';
const urlsToCache = [
  '/MANTAP/',
  '/MANTAP/index.html',
  '/MANTAP/manifest.json',
  '/MANTAP/icon-192.png',
  '/MANTAP/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
