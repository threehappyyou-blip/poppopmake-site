// PopPopMake service worker
// Strategy: network-first for page navigations (so people always get the newest
// tools when online), cache-first for static assets, opportunistic caching of
// Google Fonts, and a same-origin-only scope so third-party POSTs (like the
// Feedback form, which goes to Web3Forms) are never touched by this file.

var CACHE_VERSION = 'v1';
var CACHE_NAME = 'poppopmake-' + CACHE_VERSION;

var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/cookie-consent.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) { return key.indexOf('poppopmake-') === 0 && key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Never touch non-GET requests (e.g. the Feedback form's POST to Web3Forms).
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // Cross-origin: leave everything alone except Google Fonts, which we
  // opportunistically cache so custom fonts still render offline.
  if (url.origin !== self.location.origin) {
    if (url.hostname.indexOf('fonts.g') !== -1) {
      event.respondWith(
        caches.match(request).then(function (cached) {
          if (cached) return cached;
          return fetch(request).then(function (response) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
            return response;
          });
        })
      );
    }
    return;
  }

  // Same-origin page loads: network-first, so updates show up immediately
  // when online. Falls back to the cached copy of that page, then to the
  // cached homepage, if there's no connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Same-origin static assets (icons, manifest, cookie-consent.js, and any
  // tool page's own resources): cache-first, then cache whatever comes back.
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
