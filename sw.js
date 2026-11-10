// PopPopMake service worker
// Strategy: network-first for page navigations and for scripts / styles / JSON
// (so people always get the newest tools and tax rates when online, and the
// cached copy only steps in when the network is down or slow), cache-first for
// images and other static assets, opportunistic caching of Google Fonts, and a
// same-origin-only scope so third-party POSTs (like the Feedback form, which
// goes to Web3Forms) are never touched by this file.

// Bump this whenever the set of cached files changes shape: activating the new
// version deletes every older cache. (v2: shared paycheck-engine.js; scripts
// became network-first so a fixed script no longer hides behind an old copy.
// v3: a start file that can't be fetched is skipped instead of stopping the install;
// every tool can be saved for offline use; pages fall back to the saved copy after a
// few seconds on a slow connection.)
var CACHE_VERSION = 'v3';
var CACHE_NAME = 'poppopmake-' + CACHE_VERSION;
var OFFLINE_MARK = '/__ppm-offline-' + CACHE_VERSION;

// Saved when the worker installs. A file that can't be fetched is skipped rather than
// failing the install, so one missing file never turns off offline use again.
var PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/cookie-consent.js',
  '/ppm-app.js',
  '/ppm-banner.js',
  '/site-helper.js',
  '/vault-helper.js',
  '/vault-icons.js',
  '/vault-coach.js',
  '/vault-seals.js',
  '/ads.json',
  '/command-palette.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];
// Libraries some tools load from these sites; their addresses include the version, so a saved copy never goes stale.
var CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];
var NAV_TIMEOUT_MS = 3500;

// A response that followed a redirect can't be handed to a page load later; store a plain copy instead.
function plain(response) {
  if (!response || !response.redirected) return Promise.resolve(response);
  return response.blob().then(function (body) {
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  });
}
function put(cache, key, response) {
  return plain(response).then(function (r) { return cache.put(key, r); }).catch(function () {});
}

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
        caches.open(CACHE_NAME).then(function (cache) { put(cache, request, copy); });
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
      .then(function (cache) {
        return Promise.all(PRECACHE_URLS.map(function (u) {
          return fetch(u, { cache: 'no-cache' }).then(function (r) { if (r && r.ok) return put(cache, u, r); }).catch(function () {});
        }));
      })
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

  // Budget, Notes & Diary: text shared to the installed app from another app (Android "Share"). It is kept on this
  // device for a moment in a separate cache and the app is opened; the app reads it, deletes it and saves it as a
  // note once unlocked. The shared text is never sent to the server.
  if (request.method === 'POST' && new URL(request.url).origin === self.location.origin && new URL(request.url).pathname === '/vault-share') {
    event.respondWith(request.formData().then(function (form) {
      var pick = function (k) { var v = form.get(k); return typeof v === 'string' ? v.slice(0, 20000) : ''; };
      var data = JSON.stringify({ title: pick('title'), text: pick('text'), url: pick('url'), at: Date.now() });
      return caches.open('ppm-share').then(function (c) { return c.put('/__ppm-share', new Response(data, { headers: { 'Content-Type': 'application/json' } })); });
    }).catch(function () {}).then(function () { return Response.redirect('/vault?start=share', 303); }));
    return;
  }

  // Never touch other non-GET requests (e.g. the Feedback form's POST to Web3Forms).
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // Cross-origin: leave everything alone except Google Fonts, which we
  // opportunistically cache so custom fonts still render offline.
  if (url.origin !== self.location.origin) {
    if (url.hostname.indexOf('fonts.g') !== -1 || (CDN_HOSTS.indexOf(url.hostname) >= 0 && !/@latest\//.test(url.pathname))) {
      event.respondWith(
        caches.match(request).then(function (cached) {
          if (cached) return cached;
          return fetch(request).then(function (response) {
            if (response && (response.ok || response.type === 'opaque')) {
              var copy = response.clone();
              caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy).catch(function () {}); });
            }
            return response;
          });
        })
      );
    }
    return;
  }

  // Same-origin page loads: network-first, so updates show up immediately when online. When the network is
  // slow the saved copy is shown after a few seconds (and the fresh page still replaces the saved one for next
  // time); with no connection: the saved page, then a short note that this page isn't saved yet.
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
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

function savedPage(request) {
  return caches.match(request).then(function (hit) {
    return hit || caches.match(request, { ignoreSearch: true });
  });
}
function offlinePage() {
  var html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline · PopPopMake</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;color:#1C2321;background:#EEF1EF">' +
    '<h1 style="font-size:1.4rem">You are offline</h1><p>This page hasn’t been saved on this device yet. Pages you have opened before, and every tool once PopPopMake is installed as an app, work without the internet.</p>' +
    '<p><a href="/" style="color:#0F8B8D">Go to the home page</a></p></body></html>';
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
function navigate(request) {
  return new Promise(function (resolve) {
    var settled = false;
    function done(r) { if (!settled && r) { settled = true; resolve(r); } }
    var timer = setTimeout(function () { savedPage(request).then(done); }, NAV_TIMEOUT_MS);
    fetch(request).then(function (response) {
      clearTimeout(timer);
      if (response && response.ok && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { put(cache, request, copy); });
      }
      done(response);
    }).catch(function () {
      clearTimeout(timer);
      savedPage(request).then(function (hit) { done(hit || offlinePage()); });
    });
  });
}

// ---------------------------------------------------------------------------------------- save every tool
// Asked for by the installed app (ppm-app.js): saves each page linked from All Tools, with the scripts, styles,
// pictures and libraries it loads, so the tools open without a connection. Done once per cache version; a run
// that couldn't save everything is tried again the next time the app opens.
var SUB = /(?:src|href)=["'](\/(?!\/)[^"'#?]+\.(?:js|css|png|jpe?g|svg|webp|ico|woff2?|json))(?:\?[^"']*)?["']|url\(\s*["']?(\/(?!\/)[^)"'?]+\.(?:woff2?|png|svg|webp|jpe?g))["']?\s*\)|src=["'](https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\/[^"']+)["']/gi;
function links(html) {
  var out = [], seen = {}, m, re = /href=["'](\/[a-z0-9][a-z0-9\/-]*)(?:#[^"']*)?["']/gi;
  while ((m = re.exec(html))) { var p = m[1].replace(/\/+$/, ''); if (!seen[p] && !/^\/(?:embed|ja|ko)(?:\/|$)/.test(p)) { seen[p] = 1; out.push(p); } }
  return out;
}
function parts(html) {
  var out = [], m; SUB.lastIndex = 0;
  while ((m = SUB.exec(html))) out.push(m[1] || m[2] || m[3]);
  return out;
}
function pool(items, n, fn) {
  var i = 0, results = new Array(items.length);
  function next() { if (i >= items.length) return Promise.resolve(); var k = i++; return fn(items[k]).then(function (r) { results[k] = r; }, function () { results[k] = false; }).then(next); }
  var runners = []; for (var j = 0; j < Math.min(n, items.length); j++) runners.push(next());
  return Promise.all(runners).then(function () { return results; });
}
function saveAll() {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(OFFLINE_MARK).then(function (mark) {
      return (mark ? mark.json() : Promise.resolve(null)).catch(function () { return null; }).then(function (j) {
      // Saved within the last week: nothing to do. Older: save again, which also picks up new and changed tools.
      if (j && Date.now() - (j.at || 0) < 7 * 864e5) return { already: true, count: j.count || 0 };
      return fetch('/all-tools', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('all-tools ' + r.status);
        return r.text();
      }).then(function (html) {
        var pages = links(html).filter(function (p) { return p !== '/all-tools'; });
        var assets = {};
        parts(html).forEach(function (a) { assets[a] = 1; });
        return put(cache, '/all-tools', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })).then(function () {
          return pool(pages, 4, function (p) {
            return fetch(p, { cache: 'no-cache' }).then(function (r) {
              if (!r.ok || (r.headers.get('Content-Type') || '').indexOf('text/html') < 0) return r.ok ? 'skip' : false;
              return r.text().then(function (page) {
                parts(page).forEach(function (a) { assets[a] = 1; });
                return put(cache, p, new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })).then(function () { return true; });
              });
            });
          });
        }).then(function (pageResults) {
          var list = Object.keys(assets);
          return pool(list, 4, function (u) {
            var cross = /^https:/.test(u);
            return cache.match(u).then(function (hit) {
              if (hit) return true;
              return fetch(u, cross ? { mode: 'cors', credentials: 'omit' } : { cache: 'no-cache' })
                .catch(function () { return cross ? fetch(u, { mode: 'no-cors' }) : Promise.reject(); })
                .then(function (r) { if (r && (r.ok || r.type === 'opaque')) return put(cache, u, r).then(function () { return true; }); return false; });
            });
          }).then(function (assetResults) {
            var saved = pageResults.filter(function (x) { return x === true; }).length;
            var failed = pageResults.filter(function (x) { return x === false; }).length + assetResults.filter(function (x) { return !x; }).length;
            var res = { count: saved, failed: failed, already: false };
            if (failed) return res;
            return cache.put(OFFLINE_MARK, new Response(JSON.stringify({ count: saved, at: Date.now() }), { headers: { 'Content-Type': 'application/json' } })).then(function () { return res; });
          });
        });
      });
      });
    });
  });
}
// Payment reminders (Android, installed app): the app leaves only due dates and counts in this cache.
var DUE_CACHE = 'ppm-due', DUE_URL = '/__ppm-due';
function localDay(offset) { var d = new Date(); d.setDate(d.getDate() + (offset || 0)); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function dueCheck() {
  return caches.open(DUE_CACHE).then(function (c) {
    return c.match(DUE_URL).then(function (r) { return r ? r.json() : null; }).then(function (data) {
      if (!data || !data.on || !Array.isArray(data.sched)) return null;
      var today = localDay(0), tomorrow = localDay(1);
      if (data.shown === today) return null;                       // at most one reminder a day
      var a = 0, b = 0;
      data.sched.forEach(function (x) { if (x.d === today) a += x.n | 0; else if (x.d === tomorrow) b += x.n | 0; });
      var tx0 = data.text || {};
      if (!a && !b) {                                               // nothing due: in the evening, a nudge to check in
        if (!data.ci || data.ci.last === today || new Date().getHours() < (typeof data.ci.hour === 'number' ? data.ci.hour : 19)) return null;
        data.shown = today;
        return c.put(DUE_URL, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })).then(function () {
          return self.registration.showNotification(tx0.title || 'PopPopMake', { body: tx0.ci || '', tag: 'ppm-due', icon: '/icons/tool-vault-192.png', badge: '/icons/tool-vault-192.png', data: { url: '/vault?start=checkin' } });
        });
      }
      var tx = data.text || {}, body = a && b ? String(tx.both || '').replace('{a}', a).replace('{b}', b) : a ? String(tx.today || '').replace('{n}', a) : String(tx.tomorrow || '').replace('{n}', b);
      data.shown = today;
      return c.put(DUE_URL, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })).then(function () {
        return self.registration.showNotification(tx.title || 'PopPopMake', { body: body, tag: 'ppm-due', icon: '/icons/tool-vault-192.png', badge: '/icons/tool-vault-192.png', data: { url: '/vault' } });
      });
    });
  }).catch(function () {});
}
self.addEventListener('periodicsync', function (event) { if (event.tag === 'ppm-due') event.waitUntil(dueCheck()); });
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/vault';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (new URL(list[i].url).pathname === new URL(url, self.location.origin).pathname && 'focus' in list[i]) { if (url.indexOf('start=') > 0 && list[i].navigate) return list[i].navigate(url).then(function (w) { return w && w.focus(); }); return list[i].focus(); } }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});

self.addEventListener('message', function (event) {
  var d = event.data || {}, port = event.ports && event.ports[0];
  if (d.type === 'ppm-due-check') { event.waitUntil(dueCheck()); return; }
  if (d.type !== 'ppm-save-offline' || !port) return;
  event.waitUntil(saveAll().then(function (r) {
    port.postMessage({ type: 'ppm-offline-done', version: CACHE_VERSION, count: r.count, failed: r.failed || 0, already: !!r.already });
  }).catch(function () {
    port.postMessage({ type: 'ppm-offline-done', version: CACHE_VERSION, count: 0, failed: 1, already: false });
  }));
});
