// Bump this on any deploy that changes cached assets — the browser diffs
// this file byte-for-byte to notice an update, and activate() below
// clears out whatever cache name doesn't match.
var CACHE_NAME = 'triwald-v5';

var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fonts/JuliusSansOne-Regular.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(
          names.filter(function (name) { return name !== CACHE_NAME; })
               .map(function (name) { return caches.delete(name); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Cache-first: once installed, this app must work with zero signal, so
// serving from cache is the default rather than a fallback. A cache miss
// (a resource that wasn't pre-cached) still tries the network and stores
// what it gets for next time.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
