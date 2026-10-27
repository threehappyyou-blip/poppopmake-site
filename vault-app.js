/* PopPopMake Vault — the app screens: setup, lock, Budget, Notes, Settings.
 * All text on screen is set with textContent (never as HTML), so nothing a person types can ever run as code.
 */
(function () {
  'use strict';

  var C = window.VaultCore, B = window.VaultBudget, I = window.VaultI18n, t = I.t;
  var app = document.getElementById('app');
  var NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'purple', 'gray'];
  var TIPS = ['tip.quick', 'tip.notes', 'tip.frequent', 'tip.recurring', 'tip.charts', 'tip.search', 'tip.lock', 'tip.csv'];
  var FAIL_KEY = 'ppm-vault-fails', THEME_KEY = 'ppm-vault-theme';

  var S = {
    phase: 'loading', budget: null, notes: null, settings: null, tab: 'budget', ym: null, budgetView: 'list',
    searchOpen: false, query: '', notesQuery: '', tip: Math.floor(Math.random() * TIPS.length), tipHidden: false,
    installEvt: null, pendingCode: null, lastActive: Date.now(), hiddenAt: null
  };

  // ---------- tiny DOM helpers ----------
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'style') el.setAttribute('style', v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'disabled') el.disabled = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); continue; }
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }
  var ICONS = {
    lock: ['<rect x="5" y="11" width="14" height="10" rx="2"/>', 'M8 11V7a4 4 0 0 1 8 0v4'],
    search: ['<circle cx="11" cy="11" r="7"/>', 'M21 21l-4.3-4.3'],
    plus: ['M12 5v14M5 12h14'], left: ['M15 18l-6-6 6-6'], right: ['M9 18l6-6-6-6'], x: ['M18 6L6 18M6 6l12 12'],
    pin: ['M12 17v5', 'M8 3h8l-1 6 3 4H6l3-4z'], trash: ['M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14'],
    wallet: ['<rect x="3" y="6" width="18" height="14" rx="2"/>', 'M3 10h18', '<circle cx="16.5" cy="15" r="1.3"/>'],
    note: ['M5 3h14v12l-6 6H5z', 'M13 21v-6h6'],
    gear: ['<circle cx="12" cy="12" r="3"/>', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
    repeat: ['M17 2l4 4-4 4', 'M3 11V9a3 3 0 0 1 3-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 0 1-3 3H3'],
    chev: ['M9 18l6-6-6-6'], shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z']
  };
  function icon(name, size) {
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size || 22); svg.setAttribute('height', size || 22);
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
    (ICONS[name] || []).forEach(function (p) {
      var el;
      if (p.charAt(0) === '<') {
        var m = p.match(/^<(\w+)\s(.*)\/>$/); el = document.createElementNS(NS, m[1]);
        m[2].replace(/(\w+)="([^"]*)"/g, function (_, k, v) { el.setAttribute(k, v); });
      } else { el = document.createElementNS(NS, 'path'); el.setAttribute('d', p); }
      svg.appendChild(el);
    });
    return svg;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function thisMonth() { return today().slice(0, 7); }
  function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function isIOS() { var ua = navigator.userAgent; return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function download(text, name, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function errText(e) { return e && e.code === 'corrupt' ? t('err.corrupt') : t('err.generic', { msg: (e && (e.message || e.code)) || String(e) }); }

  // ---------- language, theme, manifest ----------
  function applyLang() {
    var l = I.get();
    document.documentElement.lang = l;
    document.title = t('app.name') + ' — PopPopMake';
    var man = document.getElementById('vault-manifest');
    if (man) man.setAttribute('href', '/manifest-vault-' + l + '.json');
    var apt = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apt) apt.setAttribute('content', t('app.name'));
  }
  function applyTheme() {
    var th = lsGet(THEME_KEY) || 'auto';
    if (th === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', th);
  }

  // ---------- data ----------
  function catOf(id) { return (S.budget && S.budget.cats.find(function (c) { return c.id === id; })) || null; }
  function catName(id) { var c = catOf(id); if (!c) return id; return c.name || t('cat.' + c.id); }
  function catEmoji(id) { var c = catOf(id); return c ? c.emoji : '•'; }
  function money(minor, cur, sign) { return I.money(minor, cur || S.budget.currency, { sign: sign }); }
  function validateNotes(raw) {
    var list = raw && Array.isArray(raw.notes) ? raw.notes : [];
    return { v: 1, notes: list.filter(function (n) { return n && typeof n.id === 'string' && typeof n.text === 'string'; }).map(function (n) {
      return { id: n.id, text: n.text, color: NOTE_COLORS.indexOf(n.color) >= 0 ? n.color : 'yellow', pinned: !!n.pinned,
        created: +n.created || Date.now(), updated: +n.updated || Date.now() };
    }) };
  }
  function validateSettings(raw) {
    var s = { autoLock: 5, lastBackup: null, lastChange: null, tourDone: false, codeSaved: true };
    if (raw && typeof raw === 'object') {
      if ([1, 5, 15, 60].indexOf(raw.autoLock) >= 0) s.autoLock = raw.autoLock;
      if (raw.lastBackup > 0) s.lastBackup = raw.lastBackup;
      if (raw.lastChange > 0) s.lastChange = raw.lastChange;
      s.tourDone = !!raw.tourDone;
      s.codeSaved = raw.codeSaved !== false;
    }
    return s;
  }
  function loadAll() {
    return Promise.all([C.load('budget'), C.load('notes'), C.load('settings')]).then(function (r) {
      S.budget = B.validate(r[0], I.get(), I.defaultCurrency());
      S.notes = validateNotes(r[1]);
      S.settings = validateSettings(r[2]);
      S.ym = thisMonth();
      var due = B.applyRecurring(S.budget, today());
      var first = !r[0];
      return (due || first ? saveBudget() : Promise.resolve()).then(function () { return due; });
    });
  }
  var saving = Promise.resolve();
  function queue(fn) { saving = saving.then(fn, fn); return saving; }
  function saveBudget() { return save('budget', function () { return S.budget; }); }
  function saveNotes() { return save('notes', function () { return S.notes; }); }
  function saveSettings() { return queue(function () { return S.settings ? C.save('settings', S.settings) : null; }).catch(onSaveError); }
  function save(mod, get) {
    if (S.settings) S.settings.lastChange = Date.now();
    return queue(function () {
      var data = get(); if (!data) return null;
      return C.save(mod, data).then(function () { return S.settings ? C.save('settings', S.settings) : null; });
    }).catch(onSaveError);
  }
  function onSaveError(e) { if (e && e.code === 'locked') return; toast(errText(e)); }

  // ---------- lock timing ----------
  function failState() { try { return JSON.parse(lsGet(FAIL_KEY)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } }
  function noteFail() {
    var f = failState(); f.n++;
    if (f.n >= 5) f.until = Date.now() + Math.min(900, 30 * Math.pow(2, f.n - 5)) * 1000;
    lsSet(FAIL_KEY, JSON.stringify(f));
    return f;
  }
  function clearFails() { lsSet(FAIL_KEY, null); }
  function waitSeconds() { var f = failState(); return Math.max(0, Math.ceil((f.until - Date.now()) / 1000)); }

  function lockNow(auto) {
    flushNote();
    return saving.then(function () {
      return C.lock();
    }).then(function () {
      S.budget = S.notes = S.settings = null;
      closeAllModals(); hideToast(); var tb = document.getElementById('toast'); if (tb) tb.textContent = '';
      S.searchOpen = false; S.query = ''; S.notesQuery = '';
      S.phase = 'locked';
      render();
      if (auto) toast(t('lockedAuto'));
    });
  }
  function touch() { S.lastActive = Date.now(); }
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, touch, { passive: true, capture: true }); });
  setInterval(function () {
    if (S.phase !== 'app' || !S.settings) return;
    if (document.visibilityState === 'visible' && Date.now() - S.lastActive > S.settings.autoLock * 60000) lockNow(true);
  }, 10000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { S.hiddenAt = Date.now(); flushNote(); return; }
    if (S.phase === 'app' && S.settings && S.hiddenAt && Date.now() - S.hiddenAt > S.settings.autoLock * 60000) lockNow(true);
    S.hiddenAt = null; touch();
  });

  // Changes made in another tab of this app.
  C.onChange(function (msg, remote) {
    if (!remote) return;
    if (msg.type === 'wiped') { S.phase = 'welcome'; S.budget = S.notes = S.settings = null; closeAllModals(); render(); return; }
    if (msg.type === 'saved' && S.phase === 'app' && !modalOpen()) {
      C.load(msg.module).then(function (d) {
        if (msg.module === 'budget') S.budget = B.validate(d, I.get(), S.budget.currency);
        else if (msg.module === 'notes') S.notes = validateNotes(d);
        else if (msg.module === 'settings') S.settings = validateSettings(d);
        render();
      }).catch(function () {});
    }
  });

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg, action) {
    var box = document.getElementById('toast');
    if (!box) { box = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    box.textContent = '';
    add(box, h('span', { text: msg }));
    if (action) add(box, h('button', { type: 'button', class: 'toast-btn', text: action.label, on: { click: function () { hideToast(); if (S.phase === 'app' && S.budget) action.fn(); } } }));
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 3500);
  }
  function hideToast() { var b = document.getElementById('toast'); if (b) b.classList.remove('show'); }

  // ---------- modals (bottom sheets) ----------
  var modals = [];
  function modalOpen() { return modals.length > 0; }
  function sheet(title, build, opts) {
    opts = opts || {};
    var opener = document.activeElement;
    var backdrop = h('div', { class: 'backdrop' });
    var titleId = 'sh-' + Math.random().toString(36).slice(2);
    var body = h('div', { class: 'sheet-body' });
    var box = h('div', { class: 'sheet' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('div', { class: 'sheet-head' },
        h('h2', { id: titleId, text: title }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('btn.close'), on: { click: function () { close(); } } }, icon('x'))),
      body);
    var m = { close: close, el: box, onClose: opts.onClose };
    function close() {
      if (m.closed) return; m.closed = true;
      if (m.onClose) { try { m.onClose(); } catch (e) {} }
      backdrop.remove();
      modals = modals.filter(function (x) { return x !== m; });
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    }
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    modals.push(m);
    build(body, close, m);
    setTimeout(function () {
      if (box.contains(document.activeElement)) return;      // the person is already typing somewhere in the sheet: never pull the cursor away
      var f = box.querySelector('[data-autofocus]') || box.querySelector('input,select,textarea,button:not(.icon-btn)');
      if (f) f.focus();
    }, 30);
    return m;
  }
  function closeAllModals() { modals.slice().reverse().forEach(function (m) { m.close(); }); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modals.length) { e.preventDefault(); modals[modals.length - 1].close(); }
    if (e.key === 'Tab' && modals.length) {                      // keep keyboard focus inside the open sheet
      var box = modals[modals.length - 1].el;
      var f = Array.from(box.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---------- form bits ----------
  function field(label, input, hint) {
    var id = input.id || ('f-' + Math.random().toString(36).slice(2));
    input.id = id;
    return h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint ? h('p', { class: 'hint', text: hint }) : null);
  }
  function passInput(auto, ac) {
    var inp = h('input', { type: 'password', autocomplete: ac || 'current-password', class: 'input', 'data-autofocus': auto ? '1' : null, spellcheck: 'false', autocapitalize: 'off' });
    var btn = h('button', { type: 'button', class: 'mini', text: t('pass.show') });
    btn.addEventListener('click', function () {
      var show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; btn.textContent = show ? t('pass.hide') : t('pass.show');
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
    btn.setAttribute('aria-pressed', 'false');
    return { input: inp, wrap: h('div', { class: 'pass-wrap' }, inp, btn) };
  }
  function passField(label, auto, ac, hint) {
    var p = passInput(auto, ac);
    p.input.id = 'f-' + Math.random().toString(36).slice(2);
    p.el = h('div', { class: 'field' }, h('label', { for: p.input.id, text: label }), p.wrap, hint ? h('p', { class: 'hint', text: hint }) : null);
    return p;
  }
  function strength(p) {
    var n = Array.from(p).length, kinds = 0;
    if (/[a-z]/.test(p)) kinds++; if (/[A-Z]/.test(p)) kinds++; if (/[0-9]/.test(p)) kinds++; if (/[^A-Za-z0-9]/.test(p)) kinds++;
    if (n < 6) return null;
    if (n >= 12 && kinds >= 2 || n >= 16) return 'strong';
    if (n >= 8 && kinds >= 2) return 'ok';
    return 'weak';
  }
  function msgEl() { return h('p', { class: 'msg', role: 'alert', 'aria-live': 'assertive' }); }
  function setMsg(el, text, ok) { el.textContent = text || ''; el.classList.toggle('ok', !!ok); }
  function langSelect(onchange) {
    var sel = h('select', { class: 'input' });
    I.LANGS.forEach(function (l) { add(sel, h('option', { value: l, text: I.LANG_NAMES[l] })); });
    sel.value = I.get();
    sel.addEventListener('change', function () { I.set(sel.value, true); applyLang(); onchange && onchange(); });
    return sel;
  }
  function currencySelect(value) {
    var sel = h('select', { class: 'input' });
    I.CURRENCIES.forEach(function (c) { add(sel, h('option', { value: c, text: c + ' — ' + I.currencyName(c) })); });
    sel.value = value;
    return sel;
  }

  // ---------- screens before unlocking ----------
  function screen(cls) { app.textContent = ''; var s = h('div', { class: 'screen ' + (cls || '') }); app.appendChild(s); return s; }
  function brand() { return h('div', { class: 'brand-row' }, h('img', { src: '/icons/tool-vault-192.png', alt: '', width: 40, height: 40, class: 'brand-icon' }), h('span', { class: 'brand-name', text: 'PopPopMake' })); }

  function renderUnsupported(key) {
    var s = screen('center');
    add(s, brand(), h('h1', { text: t('app.name') }), h('p', { class: 'msg', text: t(key) }));
  }

  function renderWelcome() {
    var s = screen('welcome');
    add(s,
      h('div', { class: 'lang-top' }, field(t('lang.label'), langSelect(render))),
      brand(),
      h('h1', { text: t('setup.title') }),
      h('p', { class: 'lede', text: t('setup.lede') }),
      h('ul', { class: 'points' },
        h('li', {}, h('span', { class: 'pt-ico', 'aria-hidden': 'true', text: '🔒' }), t('setup.p1')),
        h('li', {}, h('span', { class: 'pt-ico', 'aria-hidden': 'true', text: '📱' }), t('setup.p2')),
        h('li', {}, h('span', { class: 'pt-ico', 'aria-hidden': 'true', text: '💾' }), t('setup.p3'))),
      h('div', { class: 'feature-peek' },
        h('div', { class: 'peek' }, h('span', { 'aria-hidden': 'true', text: '💸' }), h('b', { text: t('tour.1t') })),
        h('div', { class: 'peek' }, h('span', { 'aria-hidden': 'true', text: '📝' }), h('b', { text: t('tour.3t') })),
        h('div', { class: 'peek' }, h('span', { 'aria-hidden': 'true', text: '📊' }), h('b', { text: t('tour.2t') }))),
      h('button', { type: 'button', class: 'btn primary block', id: 'start-btn', text: t('setup.start'), on: { click: function () { S.phase = 'create'; render(); } } }),
      h('button', { type: 'button', class: 'btn ghost block', text: t('setup.restore'), on: { click: function () { openRestore(); } } })
    );
  }

  function renderCreate() {
    var s = screen('create');
    var p1 = passField(t('pass.new'), true, 'new-password', t('pass.hint'));
    var p2 = passField(t('pass.repeat'), false, 'new-password');
    var meter = h('div', { class: 'meter', 'aria-live': 'polite' });
    var cur = currencySelect(I.defaultCurrency());
    var agree = h('input', { type: 'checkbox', id: 'agree' });
    var msg = msgEl();
    var go = h('button', { type: 'submit', class: 'btn primary block', text: t('btn.continue') });
    p1.input.addEventListener('input', function () {
      var st = strength(p1.input.value);
      meter.className = 'meter ' + (st || '');
      meter.textContent = st ? t('pass.' + st) : '';
    });
    var form = h('form', { class: 'stack', novalidate: true },
      p1.el, meter, p2.el,
      field(t('cur.label'), cur),
      h('div', { class: 'check' }, agree, h('label', { for: 'agree' }, t('setup.agree') + ' ',
        h('a', { href: '/terms', target: '_blank', rel: 'noopener', text: t('setup.terms') }), ' · ',
        h('a', { href: '/privacy', target: '_blank', rel: 'noopener', text: t('setup.privacy') }))),
      msg, go,
      h('button', { type: 'button', class: 'btn ghost block', text: t('btn.back'), on: { click: function () { S.phase = 'welcome'; render(); } } }));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = p1.input.value, b = p2.input.value;
      if (Array.from(a).length < C.MIN_PASS || !a.trim()) return setMsg(msg, t('pass.short'));
      if (a !== b) return setMsg(msg, t('pass.mismatch'));
      if (!agree.checked) return setMsg(msg, t('setup.needAgree'));
      go.disabled = true; go.textContent = t('setup.creating'); setMsg(msg, '');
      C.create(a).then(function (r) {
        S.budget = B.newDoc(I.get(), cur.value);
        S.notes = { v: 1, notes: [] };
        S.settings = validateSettings({ codeSaved: false });
        S.ym = thisMonth();
        S.pendingCode = r.recoveryCode;
        return Promise.all([saveBudget(), saveNotes(), saveSettings()]);
      }).then(function () {
        C.persist();
        S.phase = 'recovery'; render();
      }).catch(function (err) { go.disabled = false; go.textContent = t('btn.continue'); setMsg(msg, errText(err)); });
    });
    add(s, brand(), h('h1', { text: t('setup.passTitle') }), h('p', { class: 'lede', text: t('setup.passBody') }), form);
  }

  function recoveryBlock(code, after) {
    var box = h('div', { class: 'stack' });
    var codeEl = h('p', { class: 'code', id: 'recovery-code', text: code });
    var copy = h('button', { type: 'button', class: 'btn', text: t('rec.copy') });
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = t('rec.copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, function () {});
    });
    var file = h('button', { type: 'button', class: 'btn', text: t('rec.save'), on: { click: function () {
      download(t('rec.fileIntro') + '\r\n\r\n' + code + '\r\n\r\n' + t('rec.fileNote') + '\r\nhttps://poppopmake.com/vault\r\n', 'poppopmake-recovery-code.txt', 'text/plain;charset=utf-8');
    } } });
    var ok = h('input', { type: 'checkbox', id: 'code-ok' });
    var done = h('button', { type: 'button', class: 'btn primary block', text: t('btn.done'), disabled: true, on: { click: after } });
    ok.addEventListener('change', function () { done.disabled = !ok.checked; });
    add(box, h('p', { class: 'lede', text: t('rec.body') }), codeEl, h('div', { class: 'row' }, copy, file),
      h('div', { class: 'check' }, ok, h('label', { for: 'code-ok', text: t('rec.confirm') })), done);
    return box;
  }
  function renderRecovery() {
    var s = screen('recovery');
    add(s, brand(), h('h1', { text: t('rec.title') }), recoveryBlock(S.pendingCode, function () {
      S.pendingCode = null; S.settings.codeSaved = true; saveSettings();
      S.phase = 'app'; render(); openTour();
    }));
  }

  function renderLocked() {
    var s = screen('lock center');
    var p = passField(t('lock.pass'), true, 'current-password');
    var msg = msgEl();
    var go = h('button', { type: 'submit', class: 'btn primary block', id: 'unlock-btn', text: t('lock.unlock') });
    var timer = null;
    function tick() {
      var w = waitSeconds();
      if (w > 0) { go.disabled = true; setMsg(msg, t('lock.wait', { s: w })); timer = setTimeout(tick, 1000); }
      else { go.disabled = false; if (timer) setMsg(msg, ''); timer = null; }
    }
    var form = h('form', { class: 'stack', novalidate: true }, p.el, msg, go);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (waitSeconds() > 0) return;
      go.disabled = true; go.textContent = t('lock.unlocking'); setMsg(msg, '');
      C.unlock(p.input.value).then(function () {
        clearFails();
        return loadAll();
      }).then(function () {
        S.phase = 'app'; touch(); render();
      }).catch(function (err) {
        go.textContent = t('lock.unlock'); go.disabled = false;
        if (err && err.code === 'bad-passcode') { noteFail(); setMsg(msg, t('lock.wrong')); p.input.select(); tick(); }
        else if (err && err.code === 'corrupt') { S.phase = 'corrupt'; render(); }
        else setMsg(msg, errText(err));
      });
    });
    add(s, brand(),
      h('div', { class: 'lock-ico', 'aria-hidden': 'true' }, icon('lock', 40)),
      h('h1', { text: t('lock.title') }), h('p', { class: 'lede', text: t('lock.body') }), form,
      h('div', { class: 'links' },
        h('button', { type: 'button', class: 'link', text: t('lock.forgot'), on: { click: function () { S.phase = 'forgot'; render(); } } }),
        h('button', { type: 'button', class: 'link', text: t('lock.restore'), on: { click: function () { openRestore(); } } }),
        h('button', { type: 'button', class: 'link danger', text: t('lock.erase'), on: { click: function () { openErase(); } } })),
      h('div', { class: 'lang-bottom' }, field(t('lang.label'), langSelect(render))));
    tick();
  }

  function renderForgot() {
    var s = screen('forgot center');
    var code = h('input', { class: 'input code-input', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'data-autofocus': '1', placeholder: 'XXXX-XXXX-…' });
    var p1 = passField(t('pass.new'), false, 'new-password', t('pass.hint'));
    var p2 = passField(t('pass.repeat'), false, 'new-password');
    var msg = msgEl();
    var go = h('button', { type: 'submit', class: 'btn primary block', text: t('lock.unlock') });
    var form = h('form', { class: 'stack', novalidate: true }, field(t('forgot.code'), code), p1.el, p2.el, msg, go,
      h('button', { type: 'button', class: 'btn ghost block', text: t('btn.back'), on: { click: function () { S.phase = 'locked'; render(); } } }));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = p1.input.value;
      if (!C.normalizeCode(code.value)) return setMsg(msg, t('forgot.bad'));
      if (Array.from(a).length < C.MIN_PASS || !a.trim()) return setMsg(msg, t('pass.short'));
      if (a !== p2.input.value) return setMsg(msg, t('pass.mismatch'));
      go.disabled = true; go.textContent = t('lock.unlocking');
      C.recover(code.value, a).then(function () { clearFails(); return loadAll(); }).then(function () {
        S.phase = 'app'; touch(); render(); toast(t('pass.changed'));
      }).catch(function (err) {
        go.disabled = false; go.textContent = t('lock.unlock');
        setMsg(msg, err && err.code === 'bad-code' ? t('forgot.bad') : errText(err));
      });
    });
    add(s, brand(), h('h1', { text: t('forgot.title') }), h('p', { class: 'lede', text: t('forgot.body') }), form);
  }

  function renderCorrupt() {
    var s = screen('center');
    add(s, brand(), h('h1', { text: t('app.name') }), h('p', { class: 'msg', text: t('err.corrupt') }),
      h('button', { type: 'button', class: 'btn primary block', text: t('lock.restore'), on: { click: function () { openRestore(); } } }),
      h('button', { type: 'button', class: 'btn ghost block', text: t('top.lock'), on: { click: function () { lockNow(false); } } }));
  }

  // ---------- the app ----------
  function renderApp() {
    app.textContent = '';
    var shell = h('div', { class: 'shell tab-' + S.tab });
    var main = h('main', { class: 'main', id: 'main' });
    if (S.tab === 'budget') renderBudget(main);
    else if (S.tab === 'notes') renderNotes(main);
    else renderSettings(main);
    var tabs = h('nav', { class: 'tabbar', 'aria-label': t('app.name') });
    [['budget', 'wallet'], ['notes', 'note'], ['settings', 'gear']].forEach(function (x) {
      add(tabs, h('button', { type: 'button', class: 'tab' + (S.tab === x[0] ? ' on' : ''), 'aria-current': S.tab === x[0] ? 'page' : null, 'data-tab': x[0],
        on: { click: function () { if (S.tab !== x[0]) { flushNote(); hideToast(); S.tab = x[0]; S.searchOpen = false; render(); window.scrollTo(0, 0); } } } },
        icon(x[1]), h('span', { text: t('tab.' + x[0]) })));
    });
    add(shell, main, tabs);
    app.appendChild(shell);
  }

  function topBar(title, extra) {
    return h('header', { class: 'top' }, title,
      h('div', { class: 'top-actions' }, extra || null,
        h('button', { type: 'button', class: 'icon-btn', id: 'lock-btn', 'aria-label': t('top.lock'), title: t('top.lock'), on: { click: function () { lockNow(false); } } }, icon('lock'))));
  }

  // ----- Budget tab -----
  function renderBudget(main) {
    if (S.searchOpen) return renderSearch(main);
    var ym = S.ym, sum = B.summary(S.budget, ym);
    var nav = h('div', { class: 'month-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('month.prev'), id: 'prev-month', on: { click: function () { S.ym = B.addMonths(S.ym, -1); render(); } } }, icon('left')),
      h('h1', { class: 'month', id: 'month-label', text: I.monthLabel(ym) }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('month.next'), id: 'next-month', on: { click: function () { S.ym = B.addMonths(S.ym, 1); render(); } } }, icon('right')));
    add(main, topBar(nav, h('button', { type: 'button', class: 'icon-btn', id: 'search-btn', 'aria-label': t('top.search'), title: t('top.search'), on: { click: function () { S.searchOpen = true; render(); } } }, icon('search'))));
    if (ym !== thisMonth()) add(main, h('button', { type: 'button', class: 'link today-link', text: t('month.today'), on: { click: function () { S.ym = thisMonth(); render(); } } }));

    var card = h('section', { class: 'card summary', 'aria-label': I.monthLabel(ym) },
      h('div', { class: 'sum-main' }, h('span', { class: 'label', text: t('sum.spent') }), h('strong', { class: 'big', id: 'sum-spent', text: money(sum.expense) })),
      h('div', { class: 'sum-row' },
        h('div', {}, h('span', { class: 'label', text: t('sum.income') }), h('span', { class: 'pos', id: 'sum-income', text: money(sum.income) })),
        h('div', {}, h('span', { class: 'label', text: t('sum.net') }), h('span', { id: 'sum-net', class: sum.net < 0 ? 'neg' : '', text: money(sum.net) }))));
    if (sum.budget) {
      var pct = Math.min(100, Math.round(sum.budget.spent / sum.budget.total * 100));
      add(card, h('div', { class: 'budget-bar' + (sum.budget.left < 0 ? ' over' : pct >= 85 ? ' warn' : ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': t('set.monthly') },
        h('span', { style: 'width:' + pct + '%' })),
        h('p', { class: 'budget-text', id: 'budget-text', text: sum.budget.left >= 0 ? t('budget.left', { amt: money(sum.budget.left), total: money(sum.budget.total) }) : t('budget.over', { amt: money(-sum.budget.left) }) }));
    } else add(card, h('button', { type: 'button', class: 'link', text: t('budget.set'), on: { click: openMonthlyBudget } }));
    if (sum.otherCurrency) add(card, h('p', { class: 'hint', text: t('budget.other', { n: sum.otherCurrency }) }));
    add(main, card, notice());

    add(main, h('div', { class: 'seg', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': S.budgetView === 'list' ? 'true' : 'false', class: S.budgetView === 'list' ? 'on' : '', id: 'view-list', text: t('view.list'), on: { click: function () { S.budgetView = 'list'; render(); } } }),
      h('button', { type: 'button', role: 'tab', 'aria-selected': S.budgetView === 'charts' ? 'true' : 'false', class: S.budgetView === 'charts' ? 'on' : '', id: 'view-charts', text: t('view.charts'), on: { click: function () { S.budgetView = 'charts'; render(); } } })));

    if (S.budgetView === 'charts') add(main, charts(sum));
    else {
      var days = B.days(S.budget, ym);
      if (!days.length) add(main, empty('🧾', t('empty.month'), t('empty.monthHint')));
      else add(main, h('div', { class: 'days', id: 'tx-list' }, days.map(function (d) {
        return h('section', { class: 'day' },
          h('h3', { class: 'day-head' }, h('span', { text: I.dayLabel(d.date) }), d.expense ? h('span', { class: 'day-total', text: t('day.total', { amt: money(d.expense) }) }) : null),
          h('ul', { class: 'tx' }, d.items.slice().reverse().map(txRow)));
      })));
    }
    add(main, fab(t('add.title'), function () { openAdd(); }, 'add-btn'));
  }
  function txRow(tx) {
    var inc = tx.type === 'income';
    return h('li', {}, h('button', { type: 'button', class: 'tx-row', 'data-id': tx.id, on: { click: function () { openAdd(tx); } } },
      h('span', { class: 'emoji', 'aria-hidden': 'true', text: catEmoji(tx.cat) }),
      h('span', { class: 'tx-main' }, h('span', { class: 'tx-cat', text: catName(tx.cat) }), tx.note ? h('span', { class: 'tx-note', text: tx.note }) : null),
      tx.rid ? h('span', { class: 'tx-rep', title: t('set.recurring') }, icon('repeat', 14)) : null,
      h('span', { class: 'tx-amt' + (inc ? ' pos' : ''), text: (inc ? '+' : '−') + money(tx.amt, tx.cur).replace(/^[-−]/, '') })));
  }
  function empty(emoji, title, hint) {
    return h('div', { class: 'empty' }, h('div', { class: 'empty-ico', 'aria-hidden': 'true', text: emoji }), h('p', { class: 'empty-title', text: title }), h('p', { class: 'hint', text: hint }));
  }
  function fab(label, fn, id) {
    return h('button', { type: 'button', class: 'fab', id: id, 'aria-label': label, title: label, on: { click: fn } }, icon('plus', 28));
  }

  // One card at a time: a safety reminder first, otherwise a rotating tip about features people miss.
  function notice() {
    var st = S.settings, nowTs = Date.now();
    if (!st.codeSaved) return noticeCard('⚠️', t('rec.title'), t('code.newBody'), t('set.newCode'), openNewCode, 'notice-code');
    var hasData = S.budget.tx.length + S.notes.notes.length >= 5;
    var stale = st.lastBackup ? (nowTs - st.lastBackup > 30 * 864e5 && st.lastChange > st.lastBackup) : hasData;
    if (stale) return noticeCard('💾', t('set.backup'), st.lastBackup ? t('backup.remindOld', { d: Math.floor((nowTs - st.lastBackup) / 864e5) }) : t('backup.remindNever'), t('backup.now'), openBackup, 'notice-backup');
    if (S.tipHidden) return null;
    var key = !isStandalone() && S.tip % 3 === 0 ? 'tip.install' : TIPS[S.tip % TIPS.length];
    var card = noticeCard('💡', t('tip.label'), t(key), key === 'tip.install' ? t('install.title') : t('btn.next'), function () {
      if (key === 'tip.install') openInstall(); else { S.tip++; render(); }
    }, 'notice-tip');
    add(card.querySelector('.notice-actions'), h('button', { type: 'button', class: 'link', text: t('btn.close'), on: { click: function () { S.tipHidden = true; render(); } } }));
    return card;
  }
  function noticeCard(emoji, title, body, action, fn, id) {
    return h('aside', { class: 'card notice', id: id },
      h('span', { class: 'notice-ico', 'aria-hidden': 'true', text: emoji }),
      h('div', { class: 'notice-text' }, h('strong', { text: title }), h('p', { text: body }),
        h('div', { class: 'notice-actions' }, h('button', { type: 'button', class: 'btn small', text: action, on: { click: fn } }))));
  }

  function charts(sum) {
    var wrap = h('div', { class: 'charts', id: 'charts' });
    var box1 = h('section', { class: 'card' }, h('h2', { text: t('charts.byCat') }));
    if (!sum.byCat.length) add(box1, h('p', { class: 'hint', text: t('charts.none') }));
    else {
      var max = sum.byCat[0].amt;
      add(box1, h('ul', { class: 'bars' }, sum.byCat.map(function (c) {
        var pct = Math.round(c.amt / sum.expense * 100);
        return h('li', {}, h('span', { class: 'bar-label' }, h('span', { 'aria-hidden': 'true', text: catEmoji(c.cat) + ' ' }), catName(c.cat)),
          h('span', { class: 'bar' }, h('span', { style: 'width:' + Math.max(2, Math.round(c.amt / max * 100)) + '%' })),
          h('span', { class: 'bar-val', text: money(c.amt) + ' · ' + pct + '%' }));
      })));
    }
    add(wrap, box1);
    if (sum.catBudgets.length) {
      add(wrap, h('section', { class: 'card' }, h('h2', { text: t('charts.budgets') }), h('ul', { class: 'bars' }, sum.catBudgets.map(function (c) {
        var pct = Math.round(c.spent / c.budget * 100);
        return h('li', { class: c.left < 0 ? 'over' : pct >= 85 ? 'warn' : '' },
          h('span', { class: 'bar-label' }, h('span', { 'aria-hidden': 'true', text: catEmoji(c.cat) + ' ' }), catName(c.cat)),
          h('span', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.min(100, pct), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': catName(c.cat) }, h('span', { style: 'width:' + Math.min(100, pct) + '%' })),
          h('span', { class: 'bar-val', text: t('charts.spentOf', { spent: money(c.spent), budget: money(c.budget) }) }));
      }))));
    }
    var tr = B.trend(S.budget, S.ym, 6), top = Math.max.apply(null, tr.map(function (x) { return Math.max(x.expense, x.income); }).concat([1]));
    add(wrap, h('section', { class: 'card' }, h('h2', { text: t('charts.trend') }),
      h('div', { class: 'trend' }, tr.map(function (m) {
        return h('div', { class: 'trend-col', title: I.monthLabel(m.ym) + ': ' + t('sum.spent') + ' ' + money(m.expense) + ', ' + t('sum.income') + ' ' + money(m.income) },
          h('div', { class: 'trend-bars' },
            h('span', { class: 'tb exp', style: 'height:' + Math.round(m.expense / top * 100) + '%', 'aria-label': t('sum.spent') + ' ' + money(m.expense) }),
            h('span', { class: 'tb inc', style: 'height:' + Math.round(m.income / top * 100) + '%', 'aria-label': t('sum.income') + ' ' + money(m.income) })),
          h('span', { class: 'trend-label', text: I.shortMonth(m.ym) }));
      })),
      h('p', { class: 'legend' }, h('span', { class: 'key exp' }), t('sum.spent'), ' ', h('span', { class: 'key inc' }), t('sum.income'))));
    return wrap;
  }

  function renderSearch(main) {
    var input = h('input', { type: 'search', class: 'input', id: 'search-input', placeholder: t('search.ph'), value: S.query, 'aria-label': t('top.search'), 'data-autofocus': '1' });
    var results = h('div', { id: 'search-results' });
    function draw() {
      results.textContent = '';
      var list = B.search(S.budget, S.query, catName);
      if (!S.query.trim()) return;
      if (!list.length) return add(results, h('p', { class: 'hint center', text: t('search.none') }));
      add(results, h('p', { class: 'hint', text: t('search.count', { n: list.length }) }));
      add(results, h('ul', { class: 'tx' }, list.slice(0, 300).map(function (tx) {
        var row = txRow(tx);
        row.firstChild.insertBefore(h('span', { class: 'tx-date', text: I.fullDate(tx.date) }), row.firstChild.querySelector('.tx-amt'));
        return row;
      })));
    }
    input.addEventListener('input', function () { S.query = input.value; draw(); });
    add(main, topBar(h('div', { class: 'search-bar' }, input,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('btn.close'), id: 'search-close', on: { click: function () { S.searchOpen = false; S.query = ''; render(); } } }, icon('x')))), results);
    draw();
    setTimeout(function () { input.focus(); }, 0);
  }

  // ----- add / edit an entry -----
  function openAdd(existing) {
    var editing = !!existing;
    var st = { type: existing ? existing.type : 'expense', cat: existing ? existing.cat : null };
    var cur = existing ? existing.cur : S.budget.currency;
    var defDate = existing ? existing.date : (S.ym === thisMonth() ? today() : S.ym + '-' + pad(Math.min(new Date().getDate(), B.daysInMonth(S.ym))));
    sheet(editing ? t('edit.title') : t('add.title'), function (body, close) {
      var amount = h('input', { class: 'input amount', id: 'amount', inputmode: 'decimal', autocomplete: 'off', placeholder: '0', 'data-autofocus': '1',
        value: existing ? B.majorString(existing.amt, existing.cur) : '' });
      var preview = h('p', { class: 'amount-preview', 'aria-live': 'polite' });
      var note = h('input', { class: 'input', id: 'note', maxlength: 300, autocomplete: 'off', value: existing ? existing.note : '' });
      var date = h('input', { class: 'input', id: 'date', type: 'date', value: defDate });
      var repeat = h('input', { type: 'checkbox', id: 'repeat' });
      var msg = msgEl();
      var typeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('add.category') });
      var grid = h('div', { class: 'cat-grid', id: 'cat-grid' });
      var freq = h('div', { class: 'freq', id: 'frequent' });
      function updPreview() { var v = B.parseAmount(amount.value, cur); preview.textContent = v ? money(v, cur) : ''; }
      amount.addEventListener('input', function () { updPreview(); setMsg(msg, ''); });
      function drawType() {
        typeSeg.textContent = '';
        ['expense', 'income'].forEach(function (ty) {
          add(typeSeg, h('button', { type: 'button', role: 'radio', 'aria-checked': st.type === ty ? 'true' : 'false', class: (st.type === ty ? 'on ' : '') + ty, id: 'type-' + ty, text: t('type.' + ty),
            on: { click: function () { st.type = ty; if (catOf(st.cat) && catOf(st.cat).type !== ty) st.cat = null; drawType(); drawCats(); drawFreq(); } } }));
        });
      }
      function drawCats() {
        grid.textContent = '';
        S.budget.cats.filter(function (c) { return c.type === st.type && (!c.hidden || c.id === st.cat); }).forEach(function (c) {
          add(grid, h('button', { type: 'button', class: 'cat' + (st.cat === c.id ? ' on' : ''), 'data-cat': c.id, 'aria-pressed': st.cat === c.id ? 'true' : 'false',
            on: { click: function () { st.cat = c.id; if (editing) drawCats(); else commit(); } } },
            h('span', { class: 'cat-emoji', 'aria-hidden': 'true', text: c.emoji }), h('span', { class: 'cat-name', text: catName(c.id) })));
        });
      }
      function drawFreq() {
        freq.textContent = '';
        if (editing) return;
        var list = B.frequent(S.budget, today(), 6).filter(function (f) { return f.type === st.type; });
        if (!list.length) return;
        add(freq, h('p', { class: 'hint', text: t('add.frequent') }), h('div', { class: 'chips' }, list.map(function (f) {
          return h('button', { type: 'button', class: 'chip', on: { click: function () {
            var tx = B.addTx(S.budget, { type: f.type, amt: f.amt, cur: f.cur, cat: f.cat, date: today(), note: f.note });
            finish(tx);
          } } }, h('span', { 'aria-hidden': 'true', text: catEmoji(f.cat) + ' ' }), (f.note || catName(f.cat)) + ' ' + money(f.amt, f.cur));
        })));
      }
      function finish(tx) {
        saveBudget(); close();
        if (tx.date.slice(0, 7) !== S.ym) S.ym = tx.date.slice(0, 7);
        render();
        toast(t('add.saved', { what: catEmoji(tx.cat) + ' ' + catName(tx.cat) + ' ' + money(tx.amt, tx.cur) }), {
          label: t('btn.undo'), fn: function () {
            B.deleteTx(S.budget, tx.id);
            if (tx.rid && !editing) B.deleteRecurring(S.budget, tx.rid);
            saveBudget(); render();
          }
        });
      }
      function commit() {
        var amt = B.parseAmount(amount.value, cur);
        if (!amt) { setMsg(msg, t('add.needAmount')); amount.focus(); grid.classList.add('shake'); setTimeout(function () { grid.classList.remove('shake'); }, 400); return; }
        if (!st.cat) { setMsg(msg, t('add.pick')); return; }
        var d = B.validDate(date.value) ? date.value : today();
        if (editing) {
          B.updateTx(S.budget, existing.id, { type: st.type, amt: amt, cat: st.cat, date: d, note: note.value.trim() });
          saveBudget(); close(); render(); toast(t('add.saved', { what: catEmoji(st.cat) + ' ' + catName(st.cat) + ' ' + money(amt, cur) }));
          return;
        }
        var tx = B.addTx(S.budget, { type: st.type, amt: amt, cat: st.cat, date: d, note: note.value.trim() });
        if (repeat.checked) {
          var r = B.addRecurring(S.budget, { type: st.type, amt: amt, cat: st.cat, note: tx.note, day: +d.slice(8, 10), start: d.slice(0, 7) });
          r.last = d.slice(0, 7); tx.rid = r.id;
        }
        finish(tx);
      }
      drawType(); drawCats(); drawFreq(); updPreview();
      add(body, typeSeg,
        h('div', { class: 'field' }, h('label', { for: 'amount', text: t('add.amount') + ' (' + cur + ')' }), amount, preview),
        freq,
        h('div', { class: 'two' }, field(t('add.note'), note), field(t('add.date'), date)),
        editing ? null : h('div', { class: 'check' }, repeat, h('label', { for: 'repeat', text: t('add.repeat') })),
        h('p', { class: 'hint pick-hint', text: editing ? t('add.category') : t('add.pick') }),
        grid, msg);
      if (editing) {
        add(body, h('div', { class: 'row end' },
          h('button', { type: 'button', class: 'btn danger', id: 'delete-tx', text: t('btn.delete'), on: { click: function () {
            var removed = B.deleteTx(S.budget, existing.id); saveBudget(); close(); render();
            toast(t('add.deleted'), { label: t('btn.undo'), fn: function () { S.budget.tx.push(removed); saveBudget(); render(); } });
          } } }),
          h('button', { type: 'button', class: 'btn primary', id: 'save-tx', text: t('btn.save'), on: { click: commit } })));
      }
      amount.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (editing) commit(); else note.focus(); } });
    });
  }

  // ----- Notes tab -----
  var noteTimer = null, noteFlush = null;
  function flushNote() { if (noteFlush) { var f = noteFlush; noteFlush = null; clearTimeout(noteTimer); f(); } }
  function sortedNotes() {
    return S.notes.notes.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (b.updated - a.updated); });
  }
  function renderNotes(main) {
    add(main, topBar(h('h1', { class: 'title', text: t('notes.title') })));
    var list = sortedNotes();
    if (list.length) {
      var input = h('input', { type: 'search', class: 'input', id: 'notes-search', placeholder: t('notes.search'), value: S.notesQuery, 'aria-label': t('notes.search') });
      var grid = h('div', { class: 'notes', id: 'notes-grid' });
      var draw = function () {
        grid.textContent = '';
        var q = S.notesQuery.trim().toLowerCase();
        var shown = q ? list.filter(function (n) { return n.text.toLowerCase().indexOf(q) >= 0; }) : list;
        if (!shown.length) return add(grid, h('p', { class: 'hint center', text: t('notes.none') }));
        shown.forEach(function (n) {
          var first = n.text.trim().split('\n')[0] || t('notes.ph');
          add(grid, h('button', { type: 'button', class: 'note-card nc-' + n.color, 'data-id': n.id, 'aria-label': first.slice(0, 60), on: { click: function () { openNote(n.id); } } },
            n.pinned ? h('span', { class: 'pin-badge', title: t('notes.pinned') }, icon('pin', 14)) : null,
            h('span', { class: 'note-text', text: n.text || t('notes.ph') }),
            h('span', { class: 'note-time', text: I.ago(n.updated) })));
        });
      };
      input.addEventListener('input', function () { S.notesQuery = input.value; draw(); });
      add(main, h('div', { class: 'notes-search' }, input), grid);
      draw();
    } else add(main, empty('🗒️', t('notes.empty'), t('notes.emptyHint')));
    add(main, fab(t('notes.new'), function () {
      var n = { id: B.uid(), text: '', color: 'yellow', pinned: false, created: Date.now(), updated: Date.now() };
      S.notes.notes.push(n);
      openNote(n.id, true);
    }, 'new-note'));
  }
  function openNote(id, isNew) {
    var n = S.notes.notes.find(function (x) { return x.id === id; });
    if (!n) return;
    var deleted = false;
    sheet(isNew ? t('notes.new') : t('notes.title'), function (body, close, m) {
      var ta = h('textarea', { class: 'input note-edit nc-' + n.color, id: 'note-text', rows: 10, placeholder: t('notes.ph'), 'aria-label': t('notes.title'), 'data-autofocus': '1', value: n.text });
      function persist() {
        noteFlush = null;
        if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); }
        saveNotes();
      }
      ta.addEventListener('input', function () {
        clearTimeout(noteTimer);
        noteFlush = persist;
        noteTimer = setTimeout(flushNote, 500);
      });
      var colors = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': t('notes.color') });
      function drawColors() {
        colors.textContent = '';
        NOTE_COLORS.forEach(function (c) {
          add(colors, h('button', { type: 'button', role: 'radio', class: 'swatch nc-' + c, 'aria-checked': n.color === c ? 'true' : 'false', 'aria-label': t('color.' + c), title: t('color.' + c), 'data-color': c,
            on: { click: function () { n.color = c; n.updated = Date.now(); ta.className = 'input note-edit nc-' + c; drawColors(); saveNotes(); } } }));
        });
      }
      drawColors();
      var pin = h('button', { type: 'button', class: 'btn', id: 'note-pin', 'aria-pressed': n.pinned ? 'true' : 'false' }, icon('pin', 18), ' ', n.pinned ? t('notes.unpin') : t('notes.pin'));
      pin.addEventListener('click', function () {
        n.pinned = !n.pinned; saveNotes();
        pin.setAttribute('aria-pressed', n.pinned ? 'true' : 'false');
        pin.lastChild.textContent = n.pinned ? t('notes.unpin') : t('notes.pin');
      });
      var del = h('button', { type: 'button', class: 'btn danger', id: 'note-delete' }, icon('trash', 18), ' ', t('btn.delete'));
      del.addEventListener('click', function () {
        deleted = true; noteFlush = null; clearTimeout(noteTimer);
        var idx = S.notes.notes.indexOf(n); var copy = S.notes.notes.splice(idx, 1)[0];
        copy.text = ta.value;
        saveNotes(); close(); render();
        toast(t('notes.deleted'), { label: t('btn.undo'), fn: function () { S.notes.notes.push(copy); saveNotes(); render(); } });
      });
      add(body, ta, h('div', { class: 'note-tools' }, colors), h('div', { class: 'row' }, pin, del));
      m.onClose = function () {
        if (deleted) return;
        flushNote();
        if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); }
        if (!n.text.trim()) { S.notes.notes = S.notes.notes.filter(function (x) { return x !== n; }); }
        saveNotes(); render();
      };
    }, { wide: true });
  }

  // ----- Settings tab -----
  function row(label, value, fn, id, danger) {
    return h('li', {}, h('button', { type: 'button', class: 'set-row' + (danger ? ' danger' : ''), id: id, on: { click: fn } },
      h('span', { class: 'set-label', text: label }), value ? h('span', { class: 'set-value', text: value }) : null, icon('chev', 18)));
  }
  function ctrlRow(label, control, note) {
    control.id = control.id || ('c-' + Math.random().toString(36).slice(2));
    return h('li', { class: 'set-ctrl' }, h('label', { for: control.id, text: label }), control, note ? h('p', { class: 'hint', text: note }) : null);
  }
  function group(title, items) { return h('section', { class: 'set-group' }, h('h2', { text: title }), h('ul', { class: 'set-list card' }, items)); }
  function renderSettings(main) {
    add(main, topBar(h('h1', { class: 'title', text: t('set.title') })));
    var cur = currencySelect(S.budget.currency); cur.id = 'set-currency';
    cur.addEventListener('change', function () { S.budget.currency = cur.value; saveBudget(); render(); });
    var theme = h('select', { class: 'input', id: 'set-theme' });
    ['auto', 'light', 'dark'].forEach(function (x) { add(theme, h('option', { value: x, text: t('theme.' + x) })); });
    theme.value = lsGet(THEME_KEY) || 'auto';
    theme.addEventListener('change', function () { lsSet(THEME_KEY, theme.value === 'auto' ? null : theme.value); applyTheme(); });
    var lock = h('select', { class: 'input', id: 'set-autolock' });
    [1, 5, 15, 60].forEach(function (m) { add(lock, h('option', { value: m, text: t('min.' + m) })); });
    lock.value = String(S.settings.autoLock);
    lock.addEventListener('change', function () { S.settings.autoLock = +lock.value; saveSettings(); });
    var lang = langSelect(render); lang.id = 'set-lang';
    var storage = h('span', { class: 'set-value', id: 'storage-state', text: '…' });
    C.persisted().then(function (p) { storage.textContent = p ? t('set.storageOn') : t('set.storageOff'); });

    add(main,
      group(t('set.general'), [ctrlRow(t('lang.label'), lang), ctrlRow(t('cur.label'), cur, t('set.curNote')), ctrlRow(t('set.theme'), theme)]),
      group(t('set.budget'), [
        row(t('set.monthly'), S.budget.budgets.total ? money(S.budget.budgets.total) : t('set.monthlyNone'), openMonthlyBudget, 'set-monthly'),
        row(t('set.catBudgets'), null, openCatBudgets, 'set-catbudgets'),
        row(t('set.categories'), null, openCategories, 'set-categories'),
        row(t('set.recurring'), String(S.budget.recurring.length), openRecurring, 'set-recurring')]),
      group(t('set.security'), [
        ctrlRow(t('set.autolock'), lock),
        row(t('set.changePass'), null, openChangePass, 'set-pass'),
        row(t('set.newCode'), null, openNewCode, 'set-code'),
        h('li', { class: 'set-ctrl' }, h('button', { type: 'button', class: 'set-row', on: { click: function () { C.persist().then(function (p) { storage.textContent = p ? t('set.storageOn') : t('set.storageOff'); }); } } },
          h('span', { class: 'set-label', text: t('set.storage') }), storage))]),
      group(t('set.data'), [
        row(t('set.backup'), S.settings.lastBackup ? t('set.lastBackup', { when: I.ago(S.settings.lastBackup) }) : t('set.neverBackup'), openBackup, 'set-backup'),
        row(t('set.restore'), null, openRestore, 'set-restore'),
        row(t('set.export'), null, openExport, 'set-export'),
        row(t('set.import'), null, openImport, 'set-import'),
        row(t('set.erase'), null, openErase, 'set-erase', true)]),
      group(t('set.help'), [
        row(t('set.tour'), null, openTour, 'set-tour'),
        row(t('set.install'), isStandalone() ? t('install.done') : null, openInstall, 'set-install'),
        row(t('set.about'), null, openAbout, 'set-about'),
        h('li', {}, h('a', { class: 'set-row', href: '/manual-vault', target: '_blank', rel: 'noopener' }, h('span', { class: 'set-label', text: t('set.manual') }), icon('chev', 18)))]),
      h('p', { class: 'fine center' }, h('a', { href: '/privacy', target: '_blank', rel: 'noopener', text: t('setup.privacy') }), ' · ',
        h('a', { href: '/terms', target: '_blank', rel: 'noopener', text: t('setup.terms') }), ' · PopPopMake'));
  }

  function amountSheet(title, bodyText, current, onSave) {
    sheet(title, function (body, close) {
      var inp = h('input', { class: 'input amount', inputmode: 'decimal', id: 'amount-input', value: current ? B.majorString(current, S.budget.currency) : '', 'data-autofocus': '1', autocomplete: 'off', placeholder: '0' });
      var prev = h('p', { class: 'amount-preview' });
      inp.addEventListener('input', function () { var v = B.parseAmount(inp.value, S.budget.currency); prev.textContent = v ? money(v) : ''; });
      add(body, h('p', { class: 'hint', text: bodyText }), field(t('add.amount') + ' (' + S.budget.currency + ')', inp), prev,
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn primary', id: 'amount-save', text: t('btn.save'), on: { click: function () {
          onSave(B.parseAmount(inp.value, S.budget.currency) || null); saveBudget(); close(); render();
        } } })));
    });
  }
  function openMonthlyBudget() { amountSheet(t('monthly.title'), t('monthly.body'), S.budget.budgets.total, function (v) { S.budget.budgets.total = v; }); }
  function openCatBudgets() {
    sheet(t('catb.title'), function (body, close) {
      var inputs = {};
      add(body, h('p', { class: 'hint', text: t('catb.body') }), h('ul', { class: 'catb' }, S.budget.cats.filter(function (c) { return c.type === 'expense' && !c.hidden; }).map(function (c) {
        var v = S.budget.budgets.cats[c.id];
        var inp = h('input', { class: 'input', inputmode: 'decimal', 'data-cat': c.id, value: v ? B.majorString(v, S.budget.currency) : '', placeholder: '—', autocomplete: 'off' });
        inputs[c.id] = inp;
        return h('li', {}, field(c.emoji + ' ' + catName(c.id), inp));
      })), h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn primary', id: 'catb-save', text: t('btn.save'), on: { click: function () {
        var out = {};
        Object.keys(inputs).forEach(function (id) { var v = B.parseAmount(inputs[id].value, S.budget.currency); if (v) out[id] = v; });
        S.budget.budgets.cats = out; saveBudget(); close(); render();
      } } })));
    });
  }
  function openCategories() {
    sheet(t('cat.title'), function (body) {
      function draw() {
        body.textContent = '';
        ['expense', 'income'].forEach(function (ty) {
          add(body, h('h3', { text: t('cat.' + ty) }), h('ul', { class: 'cat-list' }, S.budget.cats.filter(function (c) { return c.type === ty; }).map(function (c) {
            var name = h('input', { class: 'input', value: catName(c.id), 'aria-label': t('cat.name'), maxlength: 40 });
            var emo = h('input', { class: 'input emoji-in', value: c.emoji, 'aria-label': t('cat.emoji'), maxlength: 8 });
            name.addEventListener('change', function () { B.updateCategory(S.budget, c.id, { name: name.value.trim() || null }); saveBudget(); });
            emo.addEventListener('change', function () { B.updateCategory(S.budget, c.id, { emoji: emo.value.trim() }); saveBudget(); });
            return h('li', { class: c.hidden ? 'hidden-cat' : '' }, emo, name, c.hidden
              ? h('button', { type: 'button', class: 'btn small', text: t('cat.restore'), on: { click: function () { B.updateCategory(S.budget, c.id, { hidden: false }); saveBudget(); draw(); } } })
              : (c.id === 'other' || c.id === 'other_income') ? null
              : h('button', { type: 'button', class: 'btn small danger', text: t('cat.remove'), on: { click: function () {
                  var r = B.removeCategory(S.budget, c.id); saveBudget(); draw(); toast(r === 'hidden' ? t('cat.hiddenMsg') : t('cat.removed'));
                } } }), c.hidden ? h('span', { class: 'hint', text: t('cat.hidden') }) : null);
          })));
        });
        var nm = h('input', { class: 'input', id: 'new-cat-name', placeholder: t('cat.name'), maxlength: 40 });
        var em = h('input', { class: 'input emoji-in', id: 'new-cat-emoji', placeholder: '🙂', maxlength: 8 });
        var ty = h('select', { class: 'input', id: 'new-cat-type' }, h('option', { value: 'expense', text: t('cat.expense') }), h('option', { value: 'income', text: t('cat.income') }));
        add(body, h('h3', { text: t('cat.add') }), h('div', { class: 'row' }, em, nm, ty,
          h('button', { type: 'button', class: 'btn primary', id: 'new-cat-add', text: t('btn.add'), on: { click: function () {
            if (!nm.value.trim()) { nm.focus(); return; }
            B.addCategory(S.budget, { type: ty.value, name: nm.value.trim(), emoji: em.value.trim() || '•' }); saveBudget(); draw();
          } } })));
      }
      draw();
    }, { onClose: render });
  }
  function openRecurring() {
    sheet(t('rec.listTitle'), function (body) {
      function draw() {
        body.textContent = '';
        add(body, h('p', { class: 'hint', text: t('rec.listBody') }));
        if (!S.budget.recurring.length) return add(body, h('p', { class: 'empty-title', text: t('rec.empty') }));
        add(body, h('ul', { class: 'rec-list' }, S.budget.recurring.map(function (r) {
          return h('li', { class: r.active ? '' : 'paused' },
            h('span', { class: 'emoji', 'aria-hidden': 'true', text: catEmoji(r.cat) }),
            h('span', { class: 'tx-main' }, h('span', { class: 'tx-cat', text: (r.note || catName(r.cat)) + ' · ' + (r.type === 'income' ? '+' : '−') + money(r.amt, r.cur) }),
              h('span', { class: 'tx-note', text: t('rec.day', { d: r.day }) + (r.active ? '' : ' · ' + t('rec.paused')) })),
            h('button', { type: 'button', class: 'btn small', text: r.active ? t('rec.pause') : t('rec.resume'), on: { click: function () {
              B.updateRecurring(S.budget, r.id, { active: !r.active });
              if (r.active) {                       // resuming: do not back-fill the months it was paused
                var prev = B.addMonths(thisMonth(), -1);
                if ((!r.last || r.last < prev) && r.start <= prev) r.last = prev;
                B.applyRecurring(S.budget, today());
              }
              saveBudget(); draw();
            } } }),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('btn.delete'), on: { click: function () { B.deleteRecurring(S.budget, r.id); saveBudget(); draw(); } } }, icon('trash', 18)));
        })));
      }
      draw();
    }, { onClose: render });
  }

  function openChangePass() {
    sheet(t('set.changePass'), function (body, close) {
      var p0 = passField(t('pass.current'), true, 'current-password'), p1 = passField(t('pass.new'), false, 'new-password', t('pass.hint')), p2 = passField(t('pass.repeat'), false, 'new-password');
      var msg = msgEl(), go = h('button', { type: 'submit', class: 'btn primary block', text: t('btn.save') });
      var form = h('form', { class: 'stack', novalidate: true }, p0.el, p1.el, p2.el, msg, go);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var a = p1.input.value;
        if (Array.from(a).length < C.MIN_PASS || !a.trim()) return setMsg(msg, t('pass.short'));
        if (a !== p2.input.value) return setMsg(msg, t('pass.mismatch'));
        go.disabled = true;
        C.changePasscode(p0.input.value, a).then(function () { close(); toast(t('pass.changed')); })
          .catch(function (err) { go.disabled = false; setMsg(msg, err && err.code === 'bad-passcode' ? t('lock.wrong') : errText(err)); });
      });
      add(body, form);
    });
  }
  function openNewCode() {
    sheet(t('set.newCode'), function (body, close) {
      var p = passField(t('lock.pass'), true, 'current-password'), msg = msgEl(), go = h('button', { type: 'submit', class: 'btn primary block', text: t('btn.continue') });
      var form = h('form', { class: 'stack', novalidate: true }, h('p', { class: 'hint', text: t('code.newBody') }), p.el, msg, go);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); go.disabled = true;
        C.newRecoveryCode(p.input.value).then(function (code) {
          S.settings.codeSaved = false; saveSettings();
          body.textContent = '';
          add(body, recoveryBlock(code, function () { S.settings.codeSaved = true; saveSettings(); close(); render(); }));
        }).catch(function (err) { go.disabled = false; setMsg(msg, err && err.code === 'bad-passcode' ? t('lock.wrong') : errText(err)); });
      });
      add(body, form);
    });
  }

  function backupName() { return 'poppopmake-vault-backup-' + today() + '.json'; }
  function openBackup() {
    sheet(t('backup.title'), function (body) {
      var msg = msgEl();
      function make() {
        return flushAll().then(function () { return C.exportBackup(); }).then(function (text) {
          S.settings.lastBackup = Date.now(); saveSettings(); setMsg(msg, t('backup.done'), true); return text;
        }).catch(function (e) { setMsg(msg, errText(e)); throw e; });
      }
      add(body, h('p', { class: 'hint', text: t('backup.body') }),
        h('button', { type: 'button', class: 'btn primary block', id: 'backup-download', text: t('backup.download'), on: { click: function () {
          make().then(function (text) { download(text, backupName(), 'application/json'); });
        } } }));
      var probe = null;
      try { probe = new File(['x'], 'x.json', { type: 'application/json' }); } catch (e) {}
      if (probe && navigator.canShare && navigator.share && navigator.canShare({ files: [probe] })) {
        add(body, h('button', { type: 'button', class: 'btn block', id: 'backup-share', text: t('backup.share'), on: { click: function () {
          make().then(function (text) { return navigator.share({ files: [new File([text], backupName(), { type: 'application/json' })] }); }).catch(function () {});
        } } }));
      }
      add(body, msg);
    }, { onClose: render });
  }
  function flushAll() { flushNote(); return saving; }

  // Works before unlocking (new phone) and after (replace current data).
  function openRestore() {
    sheet(t('restore.title'), function (body, close) {
      var file = h('input', { type: 'file', accept: '.json,application/json', id: 'restore-file', class: 'input' });
      var secret = passInput(false, 'off');
      secret.input.id = 'restore-secret';
      var msg = msgEl(), go = h('button', { type: 'submit', class: 'btn primary block', id: 'restore-go', text: t('restore.go') });
      var form = h('form', { class: 'stack', novalidate: true }, h('p', { class: 'hint', text: t('restore.body') }),
        field(t('restore.pick'), file), h('div', { class: 'field' }, h('label', { for: 'restore-secret', text: t('restore.secret') }), secret.wrap), msg, go);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = file.files && file.files[0];
        if (!f) return setMsg(msg, t('restore.pick'));
        go.disabled = true; go.textContent = t('restore.working'); setMsg(msg, '');
        f.text().then(function (text) { return C.importBackup(text, secret.input.value); }).then(function () {
          clearFails(); return loadAll();
        }).then(function () {
          close(); closeAllModals(); S.phase = 'app'; S.tab = 'budget'; touch(); render(); toast(t('restore.done'));
        }).catch(function (err) {
          go.disabled = false; go.textContent = t('restore.go');
          setMsg(msg, err && err.code === 'bad-file' ? t('restore.badFile') : err && err.code === 'bad-passcode' ? t('restore.badSecret') : errText(err));
        });
      });
      add(body, form);
    });
  }
  function openExport() {
    sheet(t('export.title'), function (body) {
      add(body, h('p', { class: 'msg', text: t('export.warn') }),
        h('button', { type: 'button', class: 'btn primary block', id: 'export-go', text: t('export.go'), on: { click: function () {
          download(B.toCSV(S.budget, catName), 'poppopmake-budget-' + today() + '.csv', 'text/csv;charset=utf-8');
        } } }));
    });
  }
  function openImport() {
    sheet(t('import.title'), function (body, close) {
      var file = h('input', { type: 'file', accept: '.csv,text/csv,text/plain', id: 'import-file', class: 'input' });
      var area = h('div', { class: 'stack' });
      var msg = msgEl();
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; if (!f) return;
        readText(f).then(function (text) {
          var rows = B.parseCSV(text);
          area.textContent = ''; setMsg(msg, '');
          if (rows.length < 1) return setMsg(msg, t('import.empty'));
          var map = B.guessColumns(rows);
          var head = map.header ? rows[0] : rows[0].map(function (_, i) { return '#' + (i + 1); });
          function colSelect(key, label) {
            var sel = h('select', { class: 'input', 'data-col': key }, h('option', { value: '', text: t('import.none') }));
            head.forEach(function (name, i) { add(sel, h('option', { value: i, text: name || ('#' + (i + 1)) })); });
            sel.value = map[key] === null || map[key] === undefined ? '' : String(map[key]);
            sel.addEventListener('change', function () { map[key] = sel.value === '' ? null : +sel.value; drawPreview(); });
            return field(label, sel);
          }
          var flip = h('input', { type: 'checkbox', id: 'import-flip' });
          flip.addEventListener('change', function () { map.flip = flip.checked; drawPreview(); });
          var prev = h('div', { class: 'preview' });
          function drawPreview() {
            prev.textContent = '';
            var trial = B.newDoc(I.get(), S.budget.currency); trial.tx = S.budget.tx.slice(0);
            var before = trial.tx.length;
            var sample = rows.slice(0, (map.header ? 1 : 0) + 5);
            B.importRows(trial, sample, map, S.budget.currency);
            add(prev, h('p', { class: 'hint', text: t('import.preview') }), h('ul', { class: 'tx' }, trial.tx.slice(before).map(function (tx) {
              return h('li', { class: 'tx-row static' }, h('span', { class: 'tx-date', text: tx.date }), h('span', { class: 'tx-main' }, h('span', { class: 'tx-note', text: tx.note })),
                h('span', { class: 'tx-amt' + (tx.type === 'income' ? ' pos' : ''), text: (tx.type === 'income' ? '+' : '−') + money(tx.amt) }));
            })));
          }
          add(area, h('p', { class: 'hint', text: t('import.cols') }),
            colSelect('date', t('import.date')), colSelect('desc', t('import.desc')), colSelect('amount', t('import.amount')),
            colSelect('out', t('import.out')), colSelect('in', t('import.in')),
            h('div', { class: 'check' }, flip, h('label', { for: 'import-flip', text: t('import.flip') })), prev,
            h('button', { type: 'button', class: 'btn primary block', id: 'import-go', text: t('import.go'), on: { click: function () {
              var r = B.importRows(S.budget, rows, map, S.budget.currency);
              saveBudget(); close(); render();
              toast(t('import.result', { added: r.added, skipped: r.skipped, bad: r.bad }));
            } } }));
          drawPreview();
        }).catch(function (e) { setMsg(msg, errText(e)); });
      });
      add(body, h('p', { class: 'hint', text: t('import.body') }), field(t('import.pick'), file), msg, area);
    }, { wide: true });
  }
  // Bank files in Korea and Japan are often EUC-KR / Shift_JIS rather than UTF-8.
  function readText(f) {
    return f.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) {}
      var enc = I.get() === 'ja' ? 'shift_jis' : I.get() === 'ko' ? 'euc-kr' : 'windows-1252';
      try { return new TextDecoder(enc).decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); }
    });
  }
  function openErase() {
    sheet(t('erase.title'), function (body, close) {
      var word = t('erase.word');
      var inp = h('input', { class: 'input', id: 'erase-word', autocomplete: 'off', 'data-autofocus': '1' });
      var go = h('button', { type: 'button', class: 'btn danger block', id: 'erase-go', text: t('erase.go'), disabled: true });
      inp.addEventListener('input', function () { go.disabled = inp.value.trim().toUpperCase() !== word.toUpperCase(); });
      go.addEventListener('click', function () {
        go.disabled = true;
        C.wipe().then(function () {
          clearFails(); closeAllModals(); S.budget = S.notes = S.settings = null; S.phase = 'welcome'; render(); toast(t('erase.done'));
        }).catch(function (e) { go.disabled = false; toast(errText(e)); });
      });
      add(body, h('p', { class: 'msg', text: t('erase.body') }), field(t('erase.type', { word: word }), inp), go);
    });
  }
  function openInstall() {
    sheet(t('install.title'), function (body) {
      add(body, h('p', { class: 'hint', text: t('install.why') }));
      if (isStandalone()) return add(body, h('p', { class: 'msg ok', text: t('install.done') }));
      if (S.installEvt) add(body, h('button', { type: 'button', class: 'btn primary block', id: 'install-go', text: t('install.button'), on: { click: function () {
        var ev = S.installEvt; S.installEvt = null; ev.prompt(); ev.userChoice.then(function () { render(); }, function () {});
      } } }));
      add(body, h('ul', { class: 'install-steps' },
        h('li', { class: isIOS() ? 'here' : '', text: t('install.ios') }),
        h('li', { class: !isIOS() && /Android/i.test(navigator.userAgent) ? 'here' : '', text: t('install.android') }),
        h('li', { text: t('install.desktop') })));
    });
  }
  function openAbout() {
    sheet(t('about.title'), function (body) {
      add(body, ['about.p1', 'about.p2', 'about.p3', 'about.p4', 'about.p5'].map(function (k) { return h('p', { text: t(k) }); }),
        h('p', { class: 'msg', text: t('about.legal') }),
        h('p', {}, h('a', { href: '/how-it-works', target: '_blank', rel: 'noopener', text: t('about.how') })));
    });
  }
  function openTour() {
    var i = 0, N = 5, EMO = ['💸', '📊', '📝', '🔒', '💾'];
    sheet(t('set.tour'), function (body, close) {
      function draw() {
        body.textContent = '';
        add(body, h('div', { class: 'tour', id: 'tour', 'data-step': i + 1 },
          h('div', { class: 'tour-ico', 'aria-hidden': 'true', text: EMO[i] }),
          h('h3', { class: 'tour-title', text: t('tour.' + (i + 1) + 't') }),
          h('p', { text: t('tour.' + (i + 1) + 'b') }),
          h('div', { class: 'dots', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4].map(function (k) { return h('span', { class: k === i ? 'on' : '' }); })),
          h('p', { class: 'sr', text: (i + 1) + ' / ' + N })),
          h('div', { class: 'row end' },
            i > 0 ? h('button', { type: 'button', class: 'btn', id: 'tour-back', text: t('btn.back'), on: { click: function () { i--; draw(); } } })
              : h('button', { type: 'button', class: 'btn ghost', id: 'tour-skip', text: t('btn.skip'), on: { click: close } }),
            i < N - 1 ? h('button', { type: 'button', class: 'btn primary', id: 'tour-next', text: t('btn.next'), 'data-autofocus': '1', on: { click: function () { i++; draw(); body.querySelector('#tour-next, #tour-start').focus(); } } })
              : h('button', { type: 'button', class: 'btn primary', id: 'tour-start', text: t('tour.start'), on: { click: close } })));
      }
      draw();
    }, { onClose: function () { if (S.settings && !S.settings.tourDone) { S.settings.tourDone = true; saveSettings(); } } });
  }

  // ---------- render ----------
  function render() {
    applyLang();
    var p = S.phase;
    if (p === 'loading') { app.textContent = ''; add(app, h('div', { class: 'screen center' }, h('p', { class: 'hint', text: '…' }))); }
    else if (p === 'nocrypto') renderUnsupported('err.crypto');
    else if (p === 'nostorage') renderUnsupported('err.storage');
    else if (p === 'welcome') renderWelcome();
    else if (p === 'create') renderCreate();
    else if (p === 'recovery') renderRecovery();
    else if (p === 'locked') renderLocked();
    else if (p === 'forgot') renderForgot();
    else if (p === 'corrupt') renderCorrupt();
    else renderApp();
  }

  // ---------- start ----------
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; });
  window.addEventListener('appinstalled', function () { S.installEvt = null; });
  window.addEventListener('pagehide', function () { flushNote(); });

  I.set(I.detect());
  applyTheme();
  if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) { S.phase = 'nocrypto'; render(); return; }
  if (!window.indexedDB) { S.phase = 'nostorage'; render(); return; }
  render();
  C.status().then(function (st) {
    S.phase = st === 'empty' ? 'welcome' : 'locked';
    if (/[?&#]start=notes\b/.test(location.search + location.hash)) S.tab = 'notes';
    render();
  }).catch(function () { S.phase = 'nostorage'; render(); });

  // Offline: once the service worker is in charge, fetch the app's own files once so they are cached.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function () { return navigator.serviceWorker.ready; }).then(function () {
      return new Promise(function (res) {
        if (navigator.serviceWorker.controller) return res();
        navigator.serviceWorker.addEventListener('controllerchange', function () { res(); });
        setTimeout(res, 8000);
      });
    }).then(function () {
      if (!navigator.serviceWorker.controller) return;
      ['/vault', '/vault-core.js', '/vault-budget.js', '/vault-i18n.js', '/vault-app.js', '/vault.css', '/manifest-vault-' + I.get() + '.json', '/icons/tool-vault-192.png']
        .forEach(function (u) { fetch(u, { credentials: 'same-origin' }).catch(function () {}); });
    }).catch(function () {});
  }

})();
