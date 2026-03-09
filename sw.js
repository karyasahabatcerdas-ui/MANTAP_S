const CACHE_NAME = 'mantap-ksc-Sv1';
const urlsToCache = [
  '/MANTAP_S/',
  '/MANTAP_S/index.html',
  '/MANTAP_S/manifest.json',
  '/MANTAP_S/icon-192.png',
  '/MANTAP_/icon-512.png'
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
