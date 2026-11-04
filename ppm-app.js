// PopPopMake as an app: the "Install app" button, saving every tool for offline use once installed,
// "Pick up where you left off" on the home page, the offline notice, and the one ad space per page
// (a sponsor banner from /ads.json first, an AdSense unit once one is set up, otherwise nothing).
// Loaded on every regular page by /cookie-consent.js. Nothing here sends anything anywhere.
(function () {
  'use strict';
  if (window.__ppmApp) return;
  window.__ppmApp = true;

  var path = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  var isHome = path === '/' || path === '/index';
  function mq(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  var standalone = mq('(display-mode: standalone)') || mq('(display-mode: window-controls-overlay)') || mq('(display-mode: minimal-ui)') || navigator.standalone === true;
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  }

  var css = '' +
    '.ppm-install{display:inline-flex;align-items:center;gap:6px;margin-left:10px;padding:6px 12px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;line-height:1.2;white-space:nowrap;flex-shrink:0}' +
    '.ppm-install:hover{background:rgba(127,127,127,.18)}' +
    '.ppm-install[hidden]{display:none}' +
    '.ppm-pop{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;max-width:min(440px,calc(100vw - 32px));background:#1C2321;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:.9rem;line-height:1.45}' +
    '.ppm-pop[hidden]{display:none}' +
    '.ppm-pop button{margin-top:10px;background:#fff;color:#1C2321;border:0;border-radius:999px;padding:6px 14px;font:inherit;font-weight:600;cursor:pointer}' +
    '.ppm-offline{position:fixed;top:0;left:0;right:0;z-index:2147482999;background:#F4B740;color:#1C2321;text-align:center;font-size:.84rem;padding:6px 12px}' +
    '.ppm-offline[hidden]{display:none}' +
    '.ppm-recent{max-width:1100px;margin:18px auto 0;padding:0 20px}' +
    '.ppm-recent h2{font-size:1rem;margin:0 0 8px}' +
    '.ppm-recent ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}' +
    '.ppm-recent a{display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid rgba(28,35,33,.18);background:#fff;color:#1C2321;text-decoration:none;font-size:.88rem}' +
    '.ppm-recent a:hover{border-color:#1C2321}' +
    '.ppm-ad{max-width:760px;margin:28px auto;padding:0 16px;text-align:center}' +
    '.ppm-ad[hidden]{display:none}' +
    '.ppm-ad-label{margin:0 0 4px;font-size:.72rem;letter-spacing:.02em;color:#6B736F;text-align:left}' +
    '.ppm-ad-label a{color:inherit}' +
    '.ppm-ad-link{display:block;line-height:0}' +
    '.ppm-ad-img{display:block;width:100%;height:auto;max-width:728px;margin:0 auto;border-radius:6px;background:#F3F4F2}' +
    '@media (prefers-color-scheme: dark){.ppm-recent a{background:#1f2624;color:#eef1ef;border-color:rgba(255,255,255,.2)}.ppm-ad-label{color:#9aa39e}}';
  document.head.appendChild(el('style', { id: 'ppm-app-css' }, css));

  // ------------------------------------------------------------------------------------------- small notices
  var pop = null, popTimer = null;
  function notice(text, ms) {
    if (!pop) {
      pop = el('div', { class: 'ppm-pop', id: 'ppm-pop', role: 'status', 'aria-live': 'polite', hidden: '' });
      document.body.appendChild(pop);
    }
    pop.textContent = '';
    pop.appendChild(el('div', { id: 'ppm-pop-text' }, text));
    var ok = el('button', { type: 'button', id: 'ppm-pop-ok' }, 'OK');
    ok.addEventListener('click', function () { pop.hidden = true; });
    pop.appendChild(ok);
    pop.hidden = false;
    clearTimeout(popTimer);
    if (ms) popTimer = setTimeout(function () { pop.hidden = true; }, ms);
  }

  // ------------------------------------------------------------------------------------------- offline
  // Once the site runs as an installed app, every tool is saved on this device so it opens without a connection.
  // It is done again only when the site's saved set changes (the service worker keeps track).
  function saveOffline(announce) {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.ready.then(function (reg) {
      return new Promise(function (resolve) {
        var w = reg.active || navigator.serviceWorker.controller;
        if (!w) { resolve(null); return; }
        var ch = new MessageChannel();
        var t = setTimeout(function () { resolve(null); }, 180000);
        ch.port1.onmessage = function (e) {
          var d = e.data || {};
          if (d.type !== 'ppm-offline-done') return;
          clearTimeout(t);
          set('ppm-offline', JSON.stringify({ version: d.version, count: d.count, at: Date.now() }));
          if (announce && !d.already && d.count) notice('All ' + d.count + ' tools are saved on this device, so they open even without the internet.', 9000);
          resolve(d);
        };
        w.postMessage({ type: 'ppm-save-offline' }, [ch.port2]);
      });
    }).catch(function () { return null; });
  }
  window.PPMApp = { saveOffline: saveOffline };

  var bar = null;
  function showOffline() {
    if (!bar) { bar = el('div', { class: 'ppm-offline', id: 'ppm-offline', role: 'status' }, 'You are offline. Saved tools keep working; ads and online features come back with the connection.'); document.body.appendChild(bar); }
    bar.hidden = navigator.onLine !== false;
  }
  window.addEventListener('offline', showOffline);
  window.addEventListener('online', showOffline);

  // ------------------------------------------------------------------------------------------- install button
  var deferred = null, btn = null;
  var pageHasOwnInstall = !!document.getElementById('installBar');   // the per-tool install bar on a few tool pages
  function makeButton() {
    if (btn || standalone || pageHasOwnInstall) return btn;
    var nav = document.querySelector('header nav') || document.querySelector('header .inner') || document.querySelector('header');
    if (!nav) return null;
    btn = el('button', { type: 'button', class: 'ppm-install', id: 'ppm-install', hidden: '', title: 'Opens PopPopMake in its own window from your desktop or home screen, even offline' }, 'Install app');
    btn.addEventListener('click', onInstallClick);
    nav.appendChild(btn);
    var ref = document.querySelector('header .logo') || nav.querySelector('a');   // same colour as the logo (light on dark headers)
    try { if (ref) btn.style.color = getComputedStyle(ref).color; } catch (e) { /* keep inherited */ }
    return btn;
  }
  function onInstallClick() {
    if (deferred) {
      var d = deferred; deferred = null;
      d.prompt();
      (d.userChoice || Promise.resolve({})).then(function (c) { if (c && c.outcome === 'accepted' && btn) btn.hidden = true; }).catch(function () {});
      return;
    }
    if (isIOSSafari) notice('To install: tap the Share button at the bottom of Safari, then “Add to Home Screen”. PopPopMake then opens from its own icon, even offline.');
  }
  if (!standalone && !pageHasOwnInstall) {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      var b = makeButton(); if (b) b.hidden = false;
    });
    if (isIOSSafari) { var b0 = makeButton(); if (b0) b0.hidden = false; }
  }
  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (btn) btn.hidden = true;
    notice('Installed. Open PopPopMake from its icon on your desktop, Start menu or home screen. All tools are being saved so they work offline.', 10000);
    saveOffline(false);
  });

  // ------------------------------------------------------------------------------------------- recently used
  var NOT_TOOLS = /^\/(index|about|privacy|terms|accessibility|corrections|feedback|changelog|advertise|all-tools|guides|help-me|how-it-works|how-we-verify|embed|manual|ja|ko)(\b|$)|-(explained|guide|mechanics|example|by-province|tools)$|^\/(tax-brackets|state-tax-comparison|paycheck-states)/;
  function readRecent() { try { var r = JSON.parse(get('ppm-recent') || '[]'); return Array.isArray(r) ? r : []; } catch (e) { return []; } }
  function cleanTitle() {
    var h1 = document.querySelector('main h1, h1');
    var t = (h1 && h1.textContent) || document.title || '';
    t = t.replace(/\s+/g, ' ').trim().split(/\s[—–|]\s|\s-\s/)[0];
    return t.slice(0, 60);
  }
  if (!isHome && !NOT_TOOLS.test(path) && path !== '/') {
    var r = readRecent().filter(function (x) { return x && x.p !== path; });
    r.unshift({ p: path + (location.hash && /^#[a-z0-9-]{1,40}$/i.test(location.hash) ? location.hash : ''), t: cleanTitle(), at: Date.now() });
    set('ppm-recent', JSON.stringify(r.slice(0, 8)));
  }
  function showRecent() {
    var list = readRecent().filter(function (x) { return x && typeof x.p === 'string' && /^\/[A-Za-z0-9\/#._-]*$/.test(x.p) && x.t; }).slice(0, 6);
    if (!list.length) return;
    var main = document.querySelector('main') || document.body;
    var sec = el('section', { class: 'ppm-recent', id: 'ppm-recent', 'aria-labelledby': 'ppm-recent-h' });
    sec.appendChild(el('h2', { id: 'ppm-recent-h' }, 'Pick up where you left off'));
    var ul = el('ul');
    list.forEach(function (x) { var li = el('li'); li.appendChild(el('a', { href: x.p }, x.t)); ul.appendChild(li); });
    sec.appendChild(ul);
    var hero = main.querySelector('.hero');
    if (hero && hero.parentNode === main) main.insertBefore(sec, hero.nextSibling); else main.insertBefore(sec, main.firstChild);
  }

  // ------------------------------------------------------------------------------------------- the ad space
  function noAds(cfg) {
    if (document.body.hasAttribute('data-no-ads')) return true;
    var list = (cfg && Array.isArray(cfg.noAdsOn)) ? cfg.noAdsOn : [];
    for (var i = 0; i < list.length; i++) {
      var r = String(list[i]);
      if (r.slice(-1) === '*' ? path.indexOf(r.slice(0, -1)) === 0 : (r.replace(/\/+$/, '') || '/') === path) return true;
    }
    return false;
  }
  function adSpace() {
    if (window.top !== window.self) return;              // inside someone's frame (embeds): no ads
    fetch('/ads.json', { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (cfg) {
      if (!cfg || noAds(cfg)) return;
      var box = el('aside', { class: 'ppm-ad', id: 'ppm-ad', 'aria-label': 'Advertisement', hidden: '' });
      var foot = document.querySelector('body > footer') || document.querySelector('footer');
      if (foot && foot.parentNode) foot.parentNode.insertBefore(box, foot); else document.body.appendChild(box);
      var b = window.PPMBanner && window.PPMBanner.pick(cfg, path, new Date(), undefined, 'site');
      if (b) { window.PPMBanner.render(box, b, { where: 'site', advertiseHref: '/advertise' }); return; }
      var a = cfg.adsense || {};
      var hasTag = !!document.querySelector('script[src*="adsbygoogle.js"]');
      if (hasTag && navigator.onLine !== false && /^ca-pub-\d{10,20}$/.test(a.client || '') && /^\d{6,14}$/.test(String(a.slot || ''))) {
        box.appendChild(el('p', { class: 'ppm-ad-label' }, 'Advertisement'));
        box.appendChild(el('ins', { class: 'adsbygoogle', style: 'display:block', 'data-ad-client': a.client, 'data-ad-slot': String(a.slot), 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' }));
        box.hidden = false;
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* blocked by the viewer: leave the space empty */ }
      } else box.remove();
    });
  }

  // ------------------------------------------------------------------------------------------- footer link
  function footLinks() {
    var f = document.querySelector('footer .flinks');
    if (f) return f;
    var spans = document.querySelectorAll('footer .wrap > span, footer .inner > span, footer > span, footer > div > span');
    for (var i = spans.length - 1; i >= 0; i--) if (spans[i].querySelector('a')) return spans[i];
    return null;
  }
  function footLink(f, a) {                            // a new footer link styled like the ones already there
    var prev = f.querySelector('a:last-of-type');
    if (prev && prev.getAttribute('style')) a.setAttribute('style', prev.getAttribute('style'));
    f.appendChild(a);
  }
  function footerLinks() {
    var f = footLinks();
    if (f && !f.querySelector('a[href="/advertise"]')) footLink(f, el('a', { href: '/advertise', id: 'ppm-advertise-link' }, 'Advertise'));
  }

  function start() {
    makeButton();
    if (isHome) showRecent();
    footerLinks();
    showOffline();
    adSpace();
    if (standalone) saveOffline(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
