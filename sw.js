// PopPopMake service worker
// Strategy: network-first for page navigations and for scripts / styles / JSON
// (so people always get the newest tools and tax rates when online, and the
// cached copy only steps in when the network is down or slow), cache-first for
// images and other static assets, opportunistic caching of Google Fonts, and a
// same-origin-only scope so third-party POSTs (like the Feedback form, which
// goes to Web3Forms) are never touched by this file.

// Bump this whenever the set of cached files changes shape: activating the new
// version deletes every older cache. (v2: shared paycheck-engine.js; scripts
// became network-first so a fixed script no longer hides behind an old copy.)
var CACHE_VERSION = 'v2';
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

// Scripts, styles and JSON files (paycheck-engine.js, command-palette.js, the
// manifests ...) are fetched network-first; after this many ms of waiting the
// cached copy, if there is one, is used instead.
var FRESH_FIRST = /\.(?:js|css|json)$/i;
var NETWORK_TIMEOUT_MS = 4000;

function networkFirst(request) {
  return new Promise(function (resolve) {
    var done = false;
    function finish(response) {
      if (!done && response) { done = true; resolve(response); }
    }
    var timer = setTimeout(function () {
      caches.match(request).then(finish);
    }, NETWORK_TIMEOUT_MS);
    fetch(request).then(function (response) {
      clearTimeout(timer);
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      finish(response);
    }).catch(function () {
      clearTimeout(timer);
      caches.match(request).then(function (cached) {
        if (cached) { finish(cached); }
        else if (!done) { done = true; resolve(Response.error()); }
      });
    });
  });
}

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
          // An installed app opens its start page with a ?source=... address, so also accept
          // the cached copy of the same page without the query before falling back to home.
          return caches.match(request).then(function (cached) {
            return cached || caches.match(request, { ignoreSearch: true });
          }).then(function (cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Same-origin scripts, styles and JSON: network-first (see networkFirst above).
  if (FRESH_FIRST.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Other same-origin static assets (icons, images): cache-first, then cache
  // whatever comes back.
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
