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
    // the "what to install" chooser
    '.ppm-pick-bg{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '.ppm-pick-bg[hidden]{display:none}' +
    '.ppm-pick{width:min(460px,100%);max-height:88vh;overflow:auto;background:#fff;color:#1C2321;border-radius:18px 18px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom));font-size:.95rem;line-height:1.45;box-shadow:0 -10px 30px rgba(0,0,0,.2)}' +
    '@media (min-width:560px){.ppm-pick-bg{align-items:center}.ppm-pick{border-radius:18px}}' +
    '.ppm-pick h2{font-size:1.1rem;margin:0 0 4px}.ppm-pick .ppm-pick-sub{margin:0 0 12px;color:#56605B;font-size:.86rem}' +
    '.ppm-pick ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}' +
    '.ppm-pick li button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;min-height:60px;border:1px solid rgba(28,35,33,.16);border-radius:14px;background:#fff;color:inherit;font:inherit;cursor:pointer}' +
    '.ppm-pick li button:hover,.ppm-pick li button:focus-visible{border-color:#0F8B8D;outline:none}' +
    '.ppm-pick li button.here{border:2px solid #0F8B8D;background:#EEF7F6}' +
    '.ppm-pick img{width:40px;height:40px;border-radius:10px;flex-shrink:0}' +
    '.ppm-pick b{display:block;font-size:.95rem}.ppm-pick small{display:block;color:#56605B;font-size:.8rem}' +
    '.ppm-pick .ppm-pick-help{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:#FFF6E0;font-size:.86rem}' +
    '.ppm-pick .ppm-pick-help[hidden]{display:none}' +
    '.ppm-pick .ppm-pick-close{margin-top:12px;width:100%;min-height:44px;border:0;border-radius:999px;background:#EEF1EF;color:#1C2321;font:inherit;font-weight:600;cursor:pointer}' +
    '@media (prefers-color-scheme: dark){.ppm-pick{background:#1f2624;color:#eef1ef}.ppm-pick li button{background:#1f2624;border-color:rgba(255,255,255,.2)}.ppm-pick li button.here{background:#16302f}.ppm-pick .ppm-pick-sub,.ppm-pick small{color:#a9b3ae}.ppm-pick .ppm-pick-help{background:#3a3220}.ppm-pick .ppm-pick-close{background:#2c3532;color:#eef1ef}}' +
    '.ppm-pop{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;max-width:min(440px,calc(100vw - 32px));background:#1C2321;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:.9rem;line-height:1.45}' +
    '.ppm-pop[hidden]{display:none}' +
    '.ppm-pop button{margin:10px 8px 0 0;background:#fff;color:#1C2321;border:0;border-radius:999px;padding:6px 14px;font:inherit;font-weight:600;cursor:pointer}' +
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
    '@media (prefers-color-scheme: dark){.ppm-recent a{background:#1f2624;color:#eef1ef;border-color:rgba(255,255,255,.2)}.ppm-ad-label{color:#9aa39e}}' +
    // phones: buttons big enough for a thumb (about 40 px), without changing how anything looks on a computer
    '@media (pointer:coarse){.ppm-install{min-height:40px;padding:8px 14px}.ppm-pop button{min-height:40px;padding:8px 16px}' +
    '.install-dismiss,#installDismiss,#ppm-thanks-close{min-width:40px!important;min-height:40px!important;display:inline-flex!important;align-items:center;justify-content:center}' +
    '.copy-btn{min-height:36px!important;padding-top:8px!important;padding-bottom:8px!important}' +
    'header nav>a[href="/"],header nav>a[href="/manual"]{display:inline-flex;align-items:center;min-height:40px}' +
    'main details>summary{padding-top:8px;padding-bottom:8px}}';
  document.head.appendChild(el('style', { id: 'ppm-app-css' }, css));

  // iPhone/iPad zoom into any text box whose letters are smaller than 16 px, and the page stays zoomed after typing.
  // maximum-scale=1 stops that jump; iPhone and iPad still let you pinch to zoom, so nothing is taken away.
  // (Android does block pinch zoom with it, so Android is left alone.)
  (function () {
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var m = document.querySelector('meta[name=viewport]');
    if (!ios || !m) return;
    var c = m.getAttribute('content') || '';
    if (!/maximum-scale/.test(c)) m.setAttribute('content', c + (c ? ', ' : '') + 'maximum-scale=1');
  })();

  // ------------------------------------------------------------------------------------------- small notices
  var pop = null, popTimer = null;
  function notice(text, ms, buttons) {
    if (!pop) {
      pop = el('div', { class: 'ppm-pop', id: 'ppm-pop', role: 'status', 'aria-live': 'polite', hidden: '' });
      document.body.appendChild(pop);
    }
    pop.textContent = '';
    pop.appendChild(el('div', { id: 'ppm-pop-text' }, text));
    (buttons || [{ id: 'ppm-pop-ok', label: 'OK' }]).forEach(function (x) {
      var b = el('button', { type: 'button', id: x.id }, x.label);
      b.addEventListener('click', function () { pop.hidden = true; if (x.fn) x.fn(); });
      pop.appendChild(b);
    });
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
  // "Install app" first asks WHAT to install: all of PopPopMake, or one program (Diary, Notes, Budget, or the three
  // together) as its own app with its own icon. The browser can only install the app named by the page's own manifest,
  // so a choice that isn't this page's goes to that program's page, where its install button is waiting.
  var deferred = null, btn = null;
  var pageHasOwnInstall = !!document.getElementById('installBar');   // the per-tool install bar on a few tool pages
  var LANG = /^(ko|ja)/.test(document.documentElement.lang || '') ? document.documentElement.lang.slice(0, 2) : 'en';
  var TX = {
    en: { btn: 'Install app', title: 'What do you want to install?', sub: 'Each one gets its own icon on your home screen. Install as many as you like.',
      site: ['All of PopPopMake', 'All 47 tools in one app'], vault: ['Budget, Notes & Diary', 'The three together, locked with your passcode'],
      diary: ['Diary only', 'Opens straight on your diary'], notes: ['Notes only', 'Opens straight on your notes'], budget: ['Budget only', 'Opens straight on your budget'],
      here: 'This page', close: 'Close',
      ios: 'On iPhone: tap the Share button at the bottom of Safari, then “Add to Home Screen”.',
      none: 'Your browser didn’t offer to install it here. Open the browser menu (⋮) and tap “Install app” or “Add to Home screen”. If it only says “Open app”, it is already installed — or the full PopPopMake app is, and the phone treats it as the same app: remove the PopPopMake icon from your home screen, then try again (your entries stay on this phone; making a backup first is still wise).',
      done: 'Installed. Open PopPopMake from its icon on your desktop, Start menu or home screen. All tools are being saved so they work offline.' },
    ko: { btn: '앱 설치', title: '무엇을 설치할까요?', sub: '고른 것마다 홈 화면에 아이콘이 따로 생겨요. 여러 개 설치해도 돼요.',
      site: ['팝팝메이크 전체', '도구 47개를 한 앱으로'], vault: ['가계부·메모·일기', '세 가지를 한 앱에, 비밀번호로 잠가서'],
      diary: ['일기만', '누르면 바로 일기가 열려요'], notes: ['메모만', '누르면 바로 메모가 열려요'], budget: ['가계부만', '누르면 바로 가계부가 열려요'],
      here: '이 페이지', close: '닫기',
      ios: '아이폰: 사파리 아래쪽 공유 버튼 → ‘홈 화면에 추가’를 누르세요.',
      none: '이 브라우저가 여기서 설치 창을 띄우지 않았어요. 브라우저 메뉴(⋮) → ‘앱 설치’ 또는 ‘홈 화면에 추가’를 눌러 주세요. ‘앱 열기’만 보이면 이미 설치돼 있거나, 팝팝메이크 전체 앱이 깔려 있어서 폰이 같은 앱으로 보는 경우예요. 홈 화면의 PopPopMake 아이콘을 지운 뒤 다시 해 보세요. (기록은 폰에 그대로 남지만, 혹시 모르니 먼저 백업해 두면 안전해요.)',
      done: '설치됐어요. 홈 화면의 아이콘으로 여세요. 인터넷 없이도 열리도록 도구를 저장하고 있어요.' },
    ja: { btn: 'アプリを入れる', title: '何を入れますか？', sub: '選んだものごとにホーム画面にアイコンができます。いくつ入れてもOK。',
      site: ['PopPopMake全部', '47個のツールを1つのアプリに'], vault: ['家計簿・メモ・日記', '3つを1つに、パスコードでロック'],
      diary: ['日記だけ', 'すぐ日記が開きます'], notes: ['メモだけ', 'すぐメモが開きます'], budget: ['家計簿だけ', 'すぐ家計簿が開きます'],
      here: 'このページ', close: '閉じる',
      ios: 'iPhone：Safari下の共有ボタン →「ホーム画面に追加」。',
      none: 'このブラウザはここでインストール画面を出しませんでした。ブラウザのメニュー（⋮）→「アプリをインストール」か「ホーム画面に追加」を押してください。「アプリを開く」しか出ない場合は、すでに入っているか、PopPopMake全部のアプリが入っていて同じアプリと見なされています。ホーム画面のPopPopMakeアイコンを削除してからもう一度試してください（記録は端末に残りますが、念のため先にバックアップを）。',
      done: 'インストールしました。ホーム画面のアイコンから開いてください。オフラインでも使えるよう保存中です。' }
  }[LANG];
  var manLink = document.querySelector('link[rel="manifest"]');
  var pageApp = (function () {                       // which app this page's manifest installs
    var h = manLink ? manLink.getAttribute('href') || '' : '';
    var m = h.match(/manifest-(diary|notes|budget|vault)-/);
    return m ? m[1] : /\/manifest\.json$/.test(h) ? 'site' : null;
  })();
  var PICKS = [['site', 'icon-192.png', '/'], ['vault', 'tool-vault-192.png', '/vault'], ['diary', 'tool-diary-192.png', '/diary-app'], ['notes', 'tool-notes-192.png', '/notes-app'], ['budget', 'tool-budget-192.png', '/budget-app']];
  var picker = null;
  function promptNow(help) {
    if (deferred) {
      var d = deferred; deferred = null;
      d.prompt();
      (d.userChoice || Promise.resolve({})).then(function (c) { if (c && c.outcome === 'accepted' && picker) picker.hidden = true; }).catch(function () {});
      return true;
    }
    if (help) { help.textContent = isIOS ? TX.ios : TX.none; help.hidden = false; }
    return false;
  }
  function openPicker() {
    if (picker) picker.remove();
    picker = el('div', { class: 'ppm-pick-bg', id: 'ppm-pick' });
    var box = el('div', { class: 'ppm-pick', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ppm-pick-h' });
    box.appendChild(el('h2', { id: 'ppm-pick-h' }, TX.title));
    box.appendChild(el('p', { class: 'ppm-pick-sub' }, TX.sub));
    var ul = el('ul'), help = el('p', { class: 'ppm-pick-help', id: 'ppm-pick-help', role: 'status', hidden: '' });
    var order = PICKS.slice().sort(function (a, b) { return (b[0] === pageApp) - (a[0] === pageApp); });   // this page's own app first
    order.forEach(function (x) {
      var here = x[0] === pageApp;
      var b = el('button', { type: 'button', id: 'ppm-pick-' + x[0], class: here ? 'here' : null, 'data-app': x[0] });
      b.appendChild(el('img', { src: '/icons/' + x[1], alt: '' }));
      var t = el('span'); t.appendChild(el('b', null, TX[x[0]][0] + (here ? ' · ' + TX.here : ''))); t.appendChild(el('small', null, TX[x[0]][1])); b.appendChild(t);
      b.addEventListener('click', function () {
        if (here) { promptNow(help); return; }
        location.href = x[2] + '?install=1' + (LANG !== 'en' && x[0] !== 'site' ? '&lang=' + LANG : '');
      });
      var li = el('li'); li.appendChild(b); ul.appendChild(li);
    });
    box.appendChild(ul); box.appendChild(help);
    var close = el('button', { type: 'button', class: 'ppm-pick-close', id: 'ppm-pick-close' }, TX.close);
    close.addEventListener('click', function () { picker.hidden = true; });
    box.appendChild(close);
    picker.addEventListener('click', function (e) { if (e.target === picker) picker.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && picker) picker.hidden = true; });
    picker.appendChild(box); document.body.appendChild(picker);
    var first = ul.querySelector('button'); if (first) first.focus();
  }
  function makeButton() {
    if (btn || standalone || pageHasOwnInstall) return btn;
    var nav = document.querySelector('header nav') || document.querySelector('header .inner') || document.querySelector('header');
    if (!nav) return null;
    btn = el('button', { type: 'button', class: 'ppm-install', id: 'ppm-install', hidden: '', title: TX.sub }, TX.btn);
    btn.addEventListener('click', onInstallClick);
    nav.appendChild(btn);
    var ref = document.querySelector('header .logo') || nav.querySelector('a');   // same colour as the logo (light on dark headers)
    try { if (ref) btn.style.color = getComputedStyle(ref).color; } catch (e) { /* keep inherited */ }
    return btn;
  }
  function onInstallClick() { openPicker(); }
  if (!standalone && !pageHasOwnInstall) {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
    });
    // shown always (not only when the browser offers an install): the choice matters even when the full app is installed
    var b0 = makeButton(); if (b0) b0.hidden = false;
    if (/[?&]install=1\b/.test(location.search)) {        // came from a chooser on another page: ask again here, this page's app on top
      try { history.replaceState(history.state, '', location.pathname + location.search.replace(/([?&])install=1(&|$)/, '$1').replace(/[?&]$/, '') + location.hash); } catch (e) { /* keep it */ }
      setTimeout(openPicker, 400);
    }
  }
  window.addEventListener('appinstalled', function () {
    deferred = null;
    if (picker) picker.hidden = true;
    notice(TX.done, 10000);
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

  // Installed app left open while a new version comes out: offer to reload (compares the files' version tags
  // every few hours and when the app comes back to the front).
  var UP = { base: null, shown: false, last: 0 };
  function upTag(u) {
    return fetch(u, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return r.ok ? (r.headers.get('ETag') || r.headers.get('Last-Modified') || r.headers.get('Content-Length') || '') : null;
    }).catch(function () { return null; });
  }
  function upCheck() {
    UP.last = Date.now();
    Promise.all(['/ppm-app.js', '/site-helper.js', location.pathname].map(upTag)).then(function (tags) {
      if (tags.some(function (x) { return x === null; })) return;
      var k = tags.join('|');
      if (UP.base === null) { UP.base = k; return; }
      if (k !== UP.base && !UP.shown) {
        UP.shown = true;
        notice('A new version of PopPopMake is ready.', 0, [{ id: 'ppm-up-reload', label: 'Reload', fn: function () { location.reload(); } }, { id: 'ppm-up-later', label: 'Later' }]);
      }
    });
  }

  function start() {
    makeButton();
    if (standalone) {
      upCheck(); setInterval(upCheck, 3 * 3600e3);
      document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - UP.last > 30 * 60e3) upCheck(); });
    }
    if (isHome) showRecent();
    footerLinks();
    showOffline();
    adSpace();
    if (standalone) saveOffline(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
