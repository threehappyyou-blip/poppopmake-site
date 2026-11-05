/* PopPopMake Vault — the app screens: setup, lock, Budget, Notes, Settings.
 * All text on screen is set with textContent (never as HTML), so nothing a person types can ever run as code.
 */
(function () {
  'use strict';

  var HP = window.VaultHelper, C = window.VaultCore, B = window.VaultBudget, I = window.VaultI18n, DY = window.VaultDiary, DC = window.VaultDeco, SN = window.VaultSnap, LS = window.VaultList, ST = window.VaultStickers, t = I.t;
  var NOTE_FONTS = ['base', 'hand', 'pen'], NOTE_SIZES = ['s', 'm', 'l'];
  var app = document.getElementById('app');
  var NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'purple', 'gray'];
  var TIPS = ['tip.quick', 'tip.notes', 'tip.diary', 'tip.deco', 'tip.frequent', 'tip.recurring', 'tip.charts', 'tip.search', 'tip.lock', 'tip.csv', 'tip.desk', 'tip.goals', 'tip.calc', 'tip.list'];
  var FAIL_KEY = 'ppm-vault-fails', THEME_KEY = 'ppm-vault-theme', DESK_KEY = 'ppm-vault-desk';
  var PM_KEY = 'ppm-vault-last-pm';         // id of the payment method used last (a random id, no content)
  var TAB_KEY = 'ppm-vault-tab', INSTALL_KEY = 'ppm-vault-install-later', PK_AUTO_KEY = 'ppm-vault-pk-auto';   // only the tab name and two on/off choices, never content
  // A desktop note window (/vault?w=note&id=…) shows one note on its own; everything else is the full app.
  var DESK = (location.search.match(/[?&]w=note&id=([A-Za-z0-9_-]{4,40})(?:&|$)/) || [])[1] || null;

  var S = {
    phase: 'loading', budget: null, notes: null, settings: null, tab: 'budget', ym: null, budgetView: 'list',
    searchOpen: false, query: '', notesQuery: '', diary: null, diaryYm: null, diaryView: 'list', diarySearch: false, diaryQuery: '', tip: Math.floor(Math.random() * TIPS.length), tipHidden: false,
    installEvt: null, pendingCode: null, lastActive: Date.now(), hiddenAt: null,
    pkArm: true, pkBtn: null, shared: null
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
    book: ['M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z', 'M20 4h-6a3 3 0 0 0-3 3'],
    gear: ['<circle cx="12" cy="12" r="3"/>', 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
    repeat: ['M17 2l4 4-4 4', 'M3 11V9a3 3 0 0 1 3-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 0 1-3 3H3'],
    chev: ['M9 18l6-6-6-6'], shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
    desk: ['<rect x="3" y="4" width="18" height="12" rx="2"/>', 'M8 20h8M12 16v4'], list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01']
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
  function errText(e) {
    if (e && e.code === 'corrupt') return t('err.corrupt');
    var name = e && (e.name || (e.inner && e.inner.name)), m = String((e && e.message) || '');
    if (name === 'QuotaExceededError' || /quota/i.test(m)) return t('err.quota');      // the device is full: say so in plain words
    return t('err.generic', { msg: (e && (e.message || e.code)) || String(e) });
  }

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
        font: NOTE_FONTS.indexOf(n.font) >= 0 ? n.font : 'base', size: NOTE_SIZES.indexOf(n.size) >= 0 ? n.size : 'm', locked: n.locked === true, list: n.list === true,
        photos: Array.isArray(n.photos) ? n.photos.filter(function (p) { return typeof p === 'string' && /^[a-z0-9]{1,40}$/.test(p); }).slice(0, NOTE_MAX_PHOTOS) : [],
        remind: typeof n.remind === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(n.remind) ? n.remind : null,
        created: +n.created || Date.now(), updated: +n.updated || Date.now() };
    }) };
  }
  var NOTE_MAX_PHOTOS = 6;
  function noteEmpty(n) { return !n.text.trim() && !(n.photos && n.photos.length); }      // nothing written and no photo
  function noteLook(n) { return 'nc-' + n.color + ' font-' + n.font + ' nsz-' + n.size; }
  var noteShown = {};               // locked notes opened with the passcode in this window (forgotten on lock)
  // A locked note shows its text only after the passcode is typed again (same slow-down after wrong tries as the lock screen).
  function notePassForm(onOk) {
    var p = passField(t('lock.pass'), true, 'current-password'), msg = msgEl();
    var go = h('button', { type: 'submit', class: 'btn primary block', id: 'note-show', text: t('notes.show') });
    var form = h('form', { class: 'stack note-pass', novalidate: true }, h('p', { class: 'hint', text: t('notes.lockedAsk') }), p.el, msg, go);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var w = waitSeconds(); if (w > 0) return setMsg(msg, t('lock.wait', { s: w }));
      go.disabled = true;
      C.checkPasscode(p.input.value).then(function () { clearFails(); onOk(); }).catch(function () {
        go.disabled = false; noteFail(); setMsg(msg, t('lock.wrong')); p.input.select();
      });
    });
    setTimeout(function () { p.input.focus(); }, 30);
    return form;
  }
  function validateSettings(raw) {
    var s = { autoLock: 5, lastBackup: null, lastChange: null, tourDone: false, codeSaved: true, helper: { off: false, guides: true, snooze: {}, mute: {}, done: {} } };
    if (raw && raw.helper && typeof raw.helper === 'object') {      // the helper: what was put off today, turned off, and learned
      var hp = raw.helper, week = HP ? HP.addDays(today(), -7) : '';
      s.helper.off = hp.off === true; s.helper.guides = hp.guides !== false;
      ['snooze', 'mute', 'done'].forEach(function (k) {
        var src = hp[k]; if (!src || typeof src !== 'object') return;
        Object.keys(src).slice(0, 120).forEach(function (id) {
          if (!/^[A-Za-z0-9|_-]{1,80}$/.test(id)) return;
          var v = src[id];
          if (k === 'snooze' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= week) s.helper.snooze[id] = v;
          else if (k === 'mute' && v) s.helper.mute[id] = 1;
          else if (k === 'done' && v > 0) s.helper.done[id] = Math.min(99, v | 0);
        });
      });
    }
    if (raw && typeof raw === 'object') {
      if ([0, 1, 5, 15, 60].indexOf(raw.autoLock) >= 0) s.autoLock = raw.autoLock;      // 0 = never (lock it yourself)
      if (raw.lastBackup > 0) s.lastBackup = raw.lastBackup;
      if (raw.lastChange > 0) s.lastChange = raw.lastChange;
      s.tourDone = !!raw.tourDone;
      s.codeSaved = raw.codeSaved !== false;
    }
    return s;
  }
  function loadAll() {
    if (DESK) return Promise.all([C.load('notes'), C.load('settings')]).then(function (r) {
      S.notes = validateNotes(r[0]); S.settings = validateSettings(r[1]); noteDirty = {}; noteGone = {}; noteLocal = {};
    });
    return Promise.all([C.load('budget'), C.load('notes'), C.load('settings'), C.load('diary')]).then(function (r) {
      S.budget = B.validate(r[0], I.get(), I.defaultCurrency());
      S.notes = validateNotes(r[1]); noteDirty = {}; noteGone = {}; noteLocal = {};
      S.settings = validateSettings(r[2]);
      S.diary = DY.validate(r[3]);
      S.ym = thisMonth(); S.diaryYm = thisMonth();
      cleanupPhotos();
      var due = B.applyRecurring(S.budget, today());
      var first = !r[0];
      return (due || first ? saveBudget() : Promise.resolve()).then(function () { return due; });
    });
  }
  var saving = Promise.resolve();
  function queue(fn) { saving = saving.then(fn, fn); return saving; }
  function saveBudget() { return save('budget', function () { return S.budget; }); }
  // Notes are saved by merging: only the notes changed in this window are written over what is stored, inside a lock
  // shared by all windows of the app — so a note window and the app can edit different notes at the same moment.
  var noteDirty = {}, noteGone = {}, noteLocal = {};     // ids changed / deleted here and not saved yet; ids created here, never stored
  var noteSaving = {}, goneSaving = {};                  // ids whose save is on its way — a reload must not undo them meanwhile
  function markNote(n) { noteDirty[n.id] = 1; delete noteGone[n.id]; }
  function goneNote(n) { noteGone[n.id] = 1; delete noteDirty[n.id]; delete noteLocal[n.id]; }
  function mergeNotes(raw, dirty, gone) {
    var db = validateNotes(raw).notes, local = {}, out = [], seen = {};
    S.notes.notes.forEach(function (n) { local[n.id] = n; });
    db.forEach(function (d) {
      if (gone[d.id]) return;
      var l = local[d.id]; seen[d.id] = 1;
      if (l) { if (!dirty[d.id]) Object.assign(l, d); out.push(l); }     // keep the same object so an open editor stays attached
      else out.push(d);
    });
    S.notes.notes.forEach(function (n) { if (!seen[n.id] && !gone[n.id] && (dirty[n.id] || noteLocal[n.id])) out.push(n); });
    return out;
  }
  function saveNotes() {
    if (S.settings) S.settings.lastChange = Date.now();
    return queue(function () {
      if (!S.notes) return null;
      var dirty = noteDirty, gone = noteGone; noteDirty = {}; noteGone = {};
      Object.assign(noteSaving, dirty); Object.assign(goneSaving, gone);
      var done = function () { Object.keys(dirty).forEach(function (k) { delete noteSaving[k]; }); Object.keys(gone).forEach(function (k) { delete goneSaving[k]; }); };
      var now = Date.now();
      return Promise.all([C.update('notes', function (raw) {
        if (!S.notes) throw { code: 'locked' };
        S.notes.notes = mergeNotes(raw, dirty, gone);
        var keep = S.notes.notes.filter(function (n) { return !(noteLocal[n.id] && noteEmpty(n)); });
        keep.forEach(function (n) { delete noteLocal[n.id]; });
        return { v: 1, notes: keep };
      }), C.update('settings', function (raw) { var st = validateSettings(raw); st.lastChange = now; return st; })]).then(function () {
        done();
      }).catch(function (e) {
        done();
        Object.keys(dirty).forEach(function (k) { if (!noteGone[k]) noteDirty[k] = 1; });
        Object.keys(gone).forEach(function (k) { if (!noteDirty[k]) noteGone[k] = 1; });
        throw e;
      });
    }).catch(onSaveError);
  }
  function reloadNotes() {
    return C.load('notes').then(function (raw) {
      if (!S.notes || S.phase !== 'app') return;
      S.notes.notes = mergeNotes(raw, Object.assign({}, noteSaving, noteDirty), Object.assign({}, goneSaving, noteGone));
      if (DESK) deskRefresh();
      else { pipRefresh(); if (!modalOpen()) render(); }
    }).catch(function () {});
  }
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

  function lockNow(auto, remote) {
    if (!auto && !remote) C.notify({ type: 'lock-all' });     // "Lock now" in any window locks every window of the app
    pipClose();
    var pending = openDeco ? openDeco.flush() : null;      // a drawing or sticker move still being saved
    flushNote(); flushEntry(); deskFlush();
    // Prompt again only if it locked itself while you were away from the app. Not after "Lock now", and not after an
    // idle lock while the screen stayed in view (the prompt would pop up on an unattended computer).
    S.pkArm = !!auto && S.hiddenAt !== null;
    return Promise.resolve(pending).catch(function () {}).then(function () { return saving; }).then(function () {
      return Promise.race([abRun(false), new Promise(function (r) { setTimeout(r, 4000); })]).catch(function () {});
    }).then(function () {
      return C.lock();
    }).then(function () {
      S.budget = S.notes = S.settings = S.diary = null; dropPhotoUrls(); noteShown = {};
      closeAllModals(); hideToast(); var tb = document.getElementById('toast'); if (tb) tb.textContent = '';
      S.searchOpen = false; S.query = ''; S.notesQuery = ''; S.diarySearch = false; S.diaryQuery = '';
      S.phase = 'locked';
      render();
      if (auto) toast(t('lockedAuto'));
    });
  }
  function touch() { S.lastActive = Date.now(); }
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) { document.addEventListener(ev, touch, { passive: true, capture: true }); });
  setInterval(function () {
    if (S.phase !== 'app' || !S.settings) return;
    if (!S.settings.autoLock) return;
    if (document.visibilityState === 'visible' && Date.now() - S.lastActive > S.settings.autoLock * 60000) lockNow(true);
  }, 10000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { S.hiddenAt = Date.now(); flushNote(); flushEntry(); if (openDeco) openDeco.flush(); return; }
    if (S.phase === 'app' && S.settings && S.settings.autoLock && S.hiddenAt && Date.now() - S.hiddenAt > S.settings.autoLock * 60000) lockNow(true);
    S.hiddenAt = null; touch();
  });

  // Changes made in another tab of this app.
  C.onChange(function (msg, remote) {
    if (!remote) return;
    if (msg.type === 'wiped') { S.phase = 'welcome'; S.budget = S.notes = S.settings = S.diary = null; dropPhotoUrls(); closeAllModals(); render(); return; }
    if (msg.type === 'lock-all' && S.phase === 'app') { lockNow(false, true); return; }
    if (msg.type === 'desk-ping' && DESK && S.notes) { C.notify({ type: 'desk-here', id: DESK }); return; }
    if (msg.type === 'desk-here') { deskHere[msg.id] = 1; return; }
    if (msg.type === 'desk-arrange') { deskArrange(); return; }
    if (msg.type === 'saved' && S.phase === 'app' && msg.module === 'notes') { reloadNotes(); return; }
    if (msg.type === 'saved' && S.phase === 'app' && DESK) {
      if (msg.module === 'settings') C.load('settings').then(function (d) { S.settings = validateSettings(d); }).catch(function () {});
      return;
    }
    if (msg.type === 'saved' && S.phase === 'app' && modalOpen()) { pendingReload[msg.module] = 1; return; }
    if (msg.type === 'saved' && S.phase === 'app' && !modalOpen()) {
      C.load(msg.module).then(function (d) {
        if (msg.module === 'budget') S.budget = B.validate(d, I.get(), S.budget.currency);
        else if (msg.module === 'notes') S.notes = validateNotes(d);
        else if (msg.module === 'diary') S.diary = DY.validate(d);
        else if (msg.module === 'settings') S.settings = validateSettings(d);
        render();
      }).catch(function () {});
    }
  });

  // Changes from another window that arrived while a sheet was open: load them once the last sheet closes.
  var pendingReload = {};
  function applyPending() {
    var mods = Object.keys(pendingReload); pendingReload = {};
    mods.forEach(function (mod) {
      if (mod === 'notes' || S.phase !== 'app') return;
      C.load(mod).then(function (d) {
        if (S.phase !== 'app') return;
        if (mod === 'budget') S.budget = B.validate(d, I.get(), S.budget.currency);
        else if (mod === 'diary') S.diary = DY.validate(d);
        else if (mod === 'settings') S.settings = validateSettings(d);
        if (!modalOpen()) render();
      }).catch(function () {});
    });
  }

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
      if (!modals.length) setTimeout(applyPending, 0);
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
        h('div', { class: 'peek' }, h('span', { 'aria-hidden': 'true', text: '📔' }), h('b', { text: t('tour.4t') }))),
      h('button', { type: 'button', class: 'btn primary block', id: 'start-btn', text: t('setup.start'), on: { click: function () { S.phase = 'create'; render(); } } }),
      h('button', { type: 'button', class: 'btn ghost block', text: t('setup.restore'), on: { click: function () { openRestore(); } } }),
      h('button', { type: 'button', class: 'btn ghost block', id: 'welcome-qr', text: '📷 ' + t('qr.receiveFrom'), on: { click: function () { openReceive(); } } })
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
        S.diary = DY.newDoc(); S.diaryYm = thisMonth();
        S.settings = validateSettings({ codeSaved: false });
        S.ym = thisMonth();
        S.pendingCode = r.recoveryCode;
        return Promise.all([saveBudget(), saveNotes(), saveDiary(), saveSettings()]);
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
      S.phase = 'app'; render(); if (S.shared) saveShared(); openTour();
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
        S.phase = 'app'; touch(); render(); afterUnlock();
      }).catch(function (err) {
        go.textContent = t('lock.unlock'); go.disabled = false;
        if (err && err.code === 'bad-passcode') { noteFail(); setMsg(msg, t('lock.wrong')); p.input.select(); tick(); }
        else if (err && err.code === 'corrupt') { S.phase = 'corrupt'; render(); }
        else setMsg(msg, errText(err));
      });
    });
    if (DESK) {
      add(s, h('div', { class: 'lock-ico', 'aria-hidden': 'true' }, icon('lock', 28)), h('p', { class: 'lede', text: t('desk.lockedBody') }), form,
        h('p', {}, h('a', { href: '/vault?start=notes', target: '_blank', rel: 'noopener', text: t('desk.openApp') })));
      deskHello(); tick(); return;
    }
    var pkSlot = h('div', { class: 'pk-slot' });
    Promise.all([C.passkeyEnrolled(), pkCheck()]).then(function (r) {
      if (!r[0] || !r[1] || S.phase !== 'locked' || !document.contains(pkSlot)) return;
      var b = h('button', { type: 'button', class: 'btn primary block pk-btn', id: 'pk-unlock' }, h('span', { 'aria-hidden': 'true', text: '👆 ' }), t('pk.unlock'));
      b.addEventListener('click', function () {
        b.disabled = true; setMsg(msg, '');
        C.passkeyUnlock().then(function () { clearFails(); return loadAll(); }).then(function () { S.phase = 'app'; touch(); render(); afterUnlock(); })
          .catch(function (e) { b.disabled = false; setMsg(msg, pkText(e)); });
      });
      add(pkSlot, b, h('p', { class: 'hint center', text: t('pk.or') }));
      pkAutoTry(b, msg);
    });
    add(s, brand(),
      h('div', { class: 'lock-ico', 'aria-hidden': 'true' }, icon('lock', 40)),
      h('h1', { text: t('lock.title') }), h('p', { class: 'lede', text: t('lock.body') }), pkSlot, form, installCard(true),
      h('div', { class: 'links' },
        h('button', { type: 'button', class: 'link', text: t('lock.forgot'), on: { click: function () { S.phase = 'forgot'; render(); } } }),
        h('button', { type: 'button', class: 'link', text: t('lock.restore'), on: { click: function () { openRestore(); } } }),
        h('button', { type: 'button', class: 'link', id: 'lock-qr', text: t('qr.receiveFrom'), on: { click: function () { openReceive(); } } }),
        h('button', { type: 'button', class: 'link danger', text: t('lock.erase'), on: { click: function () { openErase(); } } })),
      h('div', { class: 'lang-bottom' }, field(t('lang.label'), langSelect(render))));
    tick();
  }

  // Opening the app, or coming back to it while it is locked, shows the fingerprint / face prompt straight away.
  // Not right after "Lock now" (you just locked it on purpose) and not while the screen is out of sight.
  // If the browser wants a tap first, or the person cancels, nothing is said: the button is right there.
  function pkAutoTry(btn, msg) {
    S.pkBtn = [btn, msg];
    if (!S.pkArm || lsGet(PK_AUTO_KEY) === 'off' || waitSeconds() > 0 || document.visibilityState !== 'visible') return;
    S.pkArm = false;
    btn.disabled = true;
    C.passkeyUnlock().then(function () { clearFails(); return loadAll(); }).then(function () { S.phase = 'app'; touch(); render(); afterUnlock(); })
      .catch(function () { btn.disabled = false; if (msg) setMsg(msg, ''); });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { if (S.phase === 'locked') S.pkArm = true; return; }
    if (S.phase === 'locked' && S.pkBtn && document.contains(S.pkBtn[0]) && !modals.length) pkAutoTry(S.pkBtn[0], S.pkBtn[1]);
  });

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
        S.phase = 'app'; touch(); render(); afterUnlock(); toast(t('pass.changed'));
      }).catch(function (err) {
        go.disabled = false; go.textContent = t('lock.unlock');
        setMsg(msg, err && err.code === 'bad-code' ? t('forgot.bad') : errText(err));
      });
    });
    add(s, brand(), h('h1', { text: t('forgot.title') }), h('p', { class: 'lede', text: t('forgot.body') }), form,
      h('div', { class: 'links' }, h('button', { type: 'button', class: 'link', id: 'forgot-lost', text: t('forgot.lost'), on: { click: function () { openRecHelp(true); } } })));
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
    else if (S.tab === 'diary') renderDiary(main);
    else renderSettings(main);
    var tabs = h('nav', { class: 'tabbar', 'aria-label': t('app.name') });
    [['budget', 'wallet'], ['notes', 'note'], ['diary', 'book'], ['settings', 'gear']].forEach(function (x) {
      add(tabs, h('button', { type: 'button', class: 'tab' + (S.tab === x[0] ? ' on' : ''), 'aria-current': S.tab === x[0] ? 'page' : null, 'data-tab': x[0],
        on: { click: function () { if (S.tab !== x[0]) { flushNote(); flushEntry(); hideToast(); S.tab = x[0]; lsSet(TAB_KEY, x[0]); S.searchOpen = false; render(); window.scrollTo(0, 0); } } } },
        icon(x[1]), h('span', { text: t('tab.' + x[0]) })));
    });
    add(shell, main, tabs);
    app.appendChild(shell);
  }

  function topBar(title, extra) {
    return h('header', { class: 'top' }, title,
      h('div', { class: 'top-actions' }, extra || null,
        HP && !DESK ? h('button', { type: 'button', class: 'icon-btn helper-btn', id: 'helper-btn', 'aria-label': t('hp.ask'), title: t('hp.ask'), on: { click: function () { openAsk(); } } }, h('span', { 'aria-hidden': 'true', text: '💁' })) : null,
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
      h('div', { class: 'sum-main' }, h('span', { class: 'label', text: t('sum.spent') }), h('strong', { class: 'big' + longCls(money(sum.expense), 11), id: 'sum-spent', text: money(sum.expense) })),
      h('div', { class: 'sum-row' },
        h('div', {}, h('span', { class: 'label', text: t('sum.income') }), h('span', { class: 'pos amt' + longCls(money(sum.income), 12), id: 'sum-income', text: money(sum.income) })),
        h('div', {}, h('span', { class: 'label', text: t('sum.net') }), h('span', { id: 'sum-net', class: 'amt' + (sum.net < 0 ? ' neg' : '') + longCls(money(sum.net), 12), text: money(sum.net) }))));
    if (sum.budget) {
      var pct = Math.min(100, Math.round(sum.budget.spent / sum.budget.total * 100));
      add(card, h('div', { class: 'budget-bar' + (sum.budget.left < 0 ? ' over' : pct >= 85 ? ' warn' : ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': t('set.monthly') },
        h('span', { style: 'width:' + pct + '%' })),
        h('p', { class: 'budget-text', id: 'budget-text', text: sum.budget.left >= 0 ? t('budget.left', { amt: money(sum.budget.left), total: money(sum.budget.total) }) : t('budget.over', { amt: money(-sum.budget.left) }) }));
    } else add(card, h('button', { type: 'button', class: 'link', text: t('budget.set'), on: { click: openMonthlyBudget } }));
    if (ym === thisMonth()) add(card, allowanceLine());
    add(card, goalsChip());
    if (sum.otherCurrency) add(card, h('p', { class: 'hint', text: t('budget.other', { n: sum.otherCurrency }) }));
    add(main, card, notice(), helperCards('budget'));

    add(main, h('div', { class: 'seg', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': S.budgetView === 'list' ? 'true' : 'false', class: S.budgetView === 'list' ? 'on' : '', id: 'view-list', text: t('view.list'), on: { click: function () { S.budgetView = 'list'; render(); } } }),
      h('button', { type: 'button', role: 'tab', 'aria-selected': S.budgetView === 'charts' ? 'true' : 'false', class: S.budgetView === 'charts' ? 'on' : '', id: 'view-charts', text: t('view.charts'), on: { click: function () { S.budgetView = 'charts'; render(); } } }),
      h('button', { type: 'button', role: 'tab', 'aria-selected': S.budgetView === 'goals' ? 'true' : 'false', class: S.budgetView === 'goals' ? 'on' : '', id: 'view-goals', text: t('view.goals'), on: { click: function () { S.budgetView = 'goals'; render(); } } })));

    if (S.budgetView === 'charts') add(main, charts(sum));
    else if (S.budgetView === 'year') { main.textContent = ''; renderYear(main); }
    else if (S.budgetView === 'goals') renderGoals(main);
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
      tx.photo ? h('span', { class: 'tx-rep tx-photo', title: t('rc.has'), 'aria-label': t('rc.has'), text: '🧾' }) : null,
      methodOf(tx.pm) ? h('span', { class: 'tx-pm', title: methodOf(tx.pm).name, text: methodOf(tx.pm).emoji || '💳' }) : null,
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
    var hasData = S.budget.tx.length + S.notes.notes.length + S.diary.entries.length >= 5;
    var stale = st.lastBackup ? (nowTs - st.lastBackup > 30 * 864e5 && st.lastChange > st.lastBackup) : hasData;
    if (stale) return noticeCard('💾', t('set.backup'), st.lastBackup ? t('backup.remindOld', { d: Math.floor((nowTs - st.lastBackup) / 864e5) }) : t('backup.remindNever'), t('backup.now'), openBackup, 'notice-backup');
    if (AB.need || AB.failed) {
      var abCard = noticeCard('💾', t('ab.title'), AB.failed ? t('ab.failed') : t('ab.again'), AB.failed ? t('ab.change') : t('ab.allow'), function () {
        if (AB.failed) abPick(); else abAllow();
      }, 'notice-autobackup');
      return abCard;
    }
    var ic = installCard(false);
    if (ic) return ic;
    if (S.tipHidden || (HP && S.settings.helper && !S.settings.helper.off)) return null;
    var key = TIPS[S.tip % TIPS.length];
    var card = noticeCard('💡', t('tip.label'), t(key), t('btn.next'), function () { S.tip++; render(); }, 'notice-tip');
    add(card.querySelector('.notice-actions'), h('button', { type: 'button', class: 'link', text: t('btn.close'), on: { click: function () { S.tipHidden = true; render(); } } }));
    return card;
  }
  // "Install as an app" stays in view (lock screen and the top of the app) until it is installed or put off.
  function installCard(onLock) {
    if (DESK || isStandalone() || lsGet(INSTALL_KEY)) return null;
    var card = noticeCard('📲', t('install.cardTitle'), t('install.cardBody'), t('install.title'), openInstall, onLock ? 'install-card-lock' : 'notice-install');
    card.classList.add('install-card');
    add(card.querySelector('.notice-actions'), h('button', { type: 'button', class: 'link', id: onLock ? 'install-later-lock' : 'install-later', text: t('install.later'), on: { click: function () {
      lsSet(INSTALL_KEY, String(Date.now())); card.remove(); toast(t('install.laterToast'));
    } } }));
    return card;
  }
  function longCls(text, n) { return String(text).length > n ? ' long' : ''; }      // very large amounts get smaller type so they never wrap or spill
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
      h('p', { class: 'legend' }, h('span', { class: 'key exp' }), t('sum.spent'), ' ', h('span', { class: 'key inc' }), t('sum.income')),
      h('button', { type: 'button', class: 'btn block', id: 'open-year', on: { click: function () { S.year = S.ym.slice(0, 4); S.budgetView = 'year'; render(); window.scrollTo(0, 0); } } }, '📅 ', t('year.open'))));
    var mt = (S.budget.methods || []).length ? B.methodTotals(S.budget, S.ym) : [];
    if (mt.length) {
      var mmax = Math.max.apply(null, mt.map(function (x) { return x.amt; }));
      add(wrap, h('section', { class: 'card', id: 'by-method' }, h('h2', { text: t('pm.byMethod') }), h('ul', { class: 'bars' }, mt.map(function (x) {
        var m = methodOf(x.id);
        return h('li', {}, h('span', { class: 'bar-label' }, h('span', { 'aria-hidden': 'true', text: (m ? m.emoji || '💳' : '❔') + ' ' }), m ? m.name : t('pm.none')),
          h('span', { class: 'bar' }, h('span', { style: 'width:' + Math.max(2, Math.round(x.amt / mmax * 100)) + '%' })),
          h('span', { class: 'bar-val', text: money(x.amt) }));
      }))));
    }
    return wrap;
  }
  function methodOf(id) { return id ? (S.budget.methods || []).find(function (m) { return m.id === id; }) || null : null; }

  // ----- payment methods (optional) -----
  var PM_EMOJI = ['💳', '💵', '🏦', '📱', '🪙', '💴', '🧾', '🎫'];
  function openMethods() {
    sheet(t('pm.title'), function (body, close) {
      var list = h('ul', { class: 'set-list card', id: 'pm-list' }), msg = msgEl();
      function draw() {
        list.textContent = '';
        (S.budget.methods || []).forEach(function (m) {
          var name = h('input', { class: 'input', value: m.name, maxlength: 30, 'aria-label': t('pm.name'), 'data-pm-name': m.id });
          name.addEventListener('change', function () { if (B.updateMethod(S.budget, m.id, { name: name.value })) saveBudget(); else name.value = m.name; });
          var emo = h('select', { class: 'input pm-emoji', 'aria-label': t('pm.icon') });
          PM_EMOJI.concat(PM_EMOJI.indexOf(m.emoji) < 0 && m.emoji ? [m.emoji] : []).forEach(function (e) { add(emo, h('option', { value: e, text: e })); });
          emo.value = m.emoji || '💳';
          emo.addEventListener('change', function () { B.updateMethod(S.budget, m.id, { emoji: emo.value }); saveBudget(); });
          add(list, h('li', { class: 'pm-item' }, emo, name, h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('btn.delete'), 'data-pm-del': m.id, on: { click: function () {
            B.removeMethod(S.budget, m.id); saveBudget(); draw();
          } } }, icon('trash', 18))));
        });
        if (!(S.budget.methods || []).length) add(list, h('li', { class: 'hint pm-empty', text: t('pm.empty') }));
      }
      var nm = h('input', { class: 'input', id: 'pm-new-name', maxlength: 30, placeholder: t('pm.ph') });
      var ne = h('select', { class: 'input pm-emoji', id: 'pm-new-emoji', 'aria-label': t('pm.icon') });
      PM_EMOJI.forEach(function (e) { add(ne, h('option', { value: e, text: e })); });
      var addBtn = h('button', { type: 'submit', class: 'btn primary', id: 'pm-add', text: t('pm.add') });
      var form = h('form', { class: 'pm-new', novalidate: true }, ne, nm, addBtn);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!nm.value.trim()) return setMsg(msg, t('pm.needName'));
        var kind = ne.value === '💵' || ne.value === '🪙' ? 'cash' : ne.value === '🏦' ? 'bank' : ne.value === '💳' ? 'card' : 'other';
        if (!B.addMethod(S.budget, { name: nm.value, emoji: ne.value, kind: kind })) return setMsg(msg, t('pm.tooMany'));
        nm.value = ''; setMsg(msg, ''); saveBudget(); draw();
      });
      var quick = h('div', { class: 'chips', id: 'pm-quick' }, [['💵', 'pm.cash', 'cash'], ['💳', 'pm.card', 'card'], ['🏦', 'pm.bank', 'bank']].map(function (q) {
        return h('button', { type: 'button', class: 'chip', on: { click: function () {
          if ((S.budget.methods || []).some(function (m) { return m.name === t(q[1]); })) return;
          B.addMethod(S.budget, { name: t(q[1]), emoji: q[0], kind: q[2] }); saveBudget(); draw();
        } } }, q[0] + ' ' + t(q[1]));
      }));
      draw();
      add(body, h('p', { text: t('pm.body') }), list, h('p', { class: 'hint', text: t('pm.quick') }), quick, form, msg, h('p', { class: 'hint', text: t('pm.removeHint') }));
    }, { onClose: render });
  }

  // ----- the whole year -----
  function renderYear(main) {
    var years = B.yearsWithData(S.budget), y = S.year || thisMonth().slice(0, 4);
    if (years.indexOf(y) < 0) years = years.concat([y]).sort().reverse();
    var ys = B.yearSummary(S.budget, y, today()), i = years.indexOf(y);
    var nav = h('div', { class: 'month-nav' },
      h('button', { type: 'button', class: 'icon-btn', id: 'year-prev', 'aria-label': t('year.prev'), disabled: i >= years.length - 1, on: { click: function () { S.year = years[i + 1]; render(); } } }, icon('left')),
      h('h1', { class: 'title', id: 'year-title', text: t('year.title', { y: y }) }),
      h('button', { type: 'button', class: 'icon-btn', id: 'year-next', 'aria-label': t('year.next'), disabled: i <= 0, on: { click: function () { S.year = years[i - 1]; render(); } } }, icon('right')));
    var top = Math.max.apply(null, ys.months.map(function (m) { return Math.max(m.expense, m.income); }).concat([1]));
    add(main, nav,
      h('button', { type: 'button', class: 'link', id: 'year-back', text: '← ' + t('year.back'), on: { click: function () { S.budgetView = 'charts'; render(); } } }),
      h('section', { class: 'card summary', id: 'year-sum' },
        h('div', { class: 'sum-main' }, h('span', { class: 'label', text: t('year.spent') }), h('strong', { class: 'big' + longCls(money(ys.expense), 11), id: 'year-spent', text: money(ys.expense) })),
        h('div', { class: 'sum-row' },
          h('div', {}, h('span', { class: 'label', text: t('sum.income') }), h('span', { class: 'pos amt' + longCls(money(ys.income), 12), id: 'year-income', text: money(ys.income) })),
          h('div', {}, h('span', { class: 'label', text: t('sum.net') }), h('span', { class: 'amt' + (ys.net < 0 ? ' neg' : '') + longCls(money(ys.net), 12), id: 'year-net', text: money(ys.net) }))),
        h('p', { class: 'budget-text', id: 'year-avg', text: t('year.avg', { amt: money(ys.avgExpense) }) + (ys.topMonth ? ' · ' + t('year.top', { m: I.monthLabel(ys.topMonth) }) : '') })),
      h('section', { class: 'card' }, h('h2', { text: t('year.months') }),
        h('div', { class: 'trend trend-12', id: 'year-trend' }, ys.months.map(function (m) {
          return h('button', { type: 'button', class: 'trend-col', title: I.monthLabel(m.ym) + ': ' + t('sum.spent') + ' ' + money(m.expense) + ', ' + t('sum.income') + ' ' + money(m.income),
            on: { click: function () { S.ym = m.ym; S.budgetView = 'list'; render(); window.scrollTo(0, 0); } } },
            h('div', { class: 'trend-bars' },
              h('span', { class: 'tb exp', style: 'height:' + Math.round(m.expense / top * 100) + '%', 'aria-label': t('sum.spent') + ' ' + money(m.expense) }),
              h('span', { class: 'tb inc', style: 'height:' + Math.round(m.income / top * 100) + '%', 'aria-label': t('sum.income') + ' ' + money(m.income) })),
            h('span', { class: 'trend-label', text: I.shortMonth(m.ym) }));
        })),
        h('p', { class: 'legend' }, h('span', { class: 'key exp' }), t('sum.spent'), ' ', h('span', { class: 'key inc' }), t('sum.income'), ' · ', t('year.tapMonth'))));
    var box = h('section', { class: 'card', id: 'year-cats' }, h('h2', { text: t('year.cats') }));
    if (!ys.byCat.length) add(box, h('p', { class: 'hint', text: t('charts.none') }));
    else {
      var max = ys.byCat[0].amt;
      add(box, h('ul', { class: 'bars' }, ys.byCat.map(function (c) {
        return h('li', {}, h('span', { class: 'bar-label' }, h('span', { 'aria-hidden': 'true', text: catEmoji(c.cat) + ' ' }), catName(c.cat)),
          h('span', { class: 'bar' }, h('span', { style: 'width:' + Math.max(2, Math.round(c.amt / max * 100)) + '%' })),
          h('span', { class: 'bar-val', text: money(c.amt) + ' · ' + Math.round(c.amt / ys.expense * 100) + '%' }));
      })));
    }
    add(main, box);
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
  function openAdd(existing, preset) {
    var editing = !!existing;
    var lastPm = lsGet(PM_KEY), hasPm = function (id) { return !!methodOf(id); };
    var st = { type: existing ? existing.type : preset && preset.type === 'income' ? 'income' : 'expense', cat: existing ? existing.cat : null,
      pm: existing ? existing.pm || null : (hasPm(lastPm) ? lastPm : null), photo: existing ? existing.photo || null : null };
    var cur = existing ? existing.cur : S.budget.currency;
    var defDate = existing ? existing.date : preset && preset.date && B.validDate(preset.date) ? preset.date : (S.ym === thisMonth() ? today() : S.ym + '-' + pad(Math.min(new Date().getDate(), B.daysInMonth(S.ym))));
    var slips = 0;
    sheet(editing ? t('edit.title') : t('add.title'), function (body, close) {
      var abox = amountBox(cur, existing ? B.majorString(existing.amt, existing.cur) : '', 'amount', t('add.amount'));
      var amount = abox.input, preview = abox.preview; amount.setAttribute('data-autofocus', '1');
      var note = h('input', { class: 'input', id: 'note', maxlength: 300, autocomplete: 'off', value: existing ? existing.note : '' });
      var date = h('input', { class: 'input', id: 'date', type: 'date', value: defDate });
      var repeat = h('input', { type: 'checkbox', id: 'repeat' });
      var msg = msgEl();
      var typeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('add.category') });
      var grid = h('div', { class: 'cat-grid', id: 'cat-grid' });
      var freq = h('div', { class: 'freq', id: 'frequent' });
      var pmRow = h('div', { class: 'chips pm-row', id: 'pm-row', role: 'radiogroup', 'aria-label': t('pm.title') });
      function drawPm() {
        pmRow.textContent = '';
        if (!(S.budget.methods || []).length) return;
        S.budget.methods.forEach(function (m) {
          add(pmRow, h('button', { type: 'button', role: 'radio', class: 'chip' + (st.pm === m.id ? ' on' : ''), 'data-pm': m.id, 'aria-checked': st.pm === m.id ? 'true' : 'false',
            on: { click: function () { st.pm = st.pm === m.id ? null : m.id; drawPm(); } } }, h('span', { 'aria-hidden': 'true', text: (m.emoji || '💳') + ' ' }), m.name));
        });
      }
      var rcBox = h('div', { class: 'receipt', id: 'receipt' }), rcMsg = msg;        // one message line for the whole sheet
      var rcFile = h('input', { type: 'file', accept: 'image/*', id: 'receipt-input', class: 'sr', 'aria-label': t('rc.add') });
      function drawRc() {
        rcBox.textContent = '';
        if (st.photo) {
          var img = h('img', { alt: t('rc.has'), class: 'photo-thumb' });
          photoUrl(st.photo).then(function (u) { if (u) img.src = u; }).catch(function () {});
          var pid = st.photo;
          add(rcBox, h('div', { class: 'photo' },
            h('button', { type: 'button', class: 'photo-open', id: 'receipt-open', 'aria-label': t('rc.has'), on: { click: function () { viewPhoto(pid); } } }, img),
            h('button', { type: 'button', class: 'photo-x', id: 'receipt-remove', 'aria-label': t('rc.remove'), on: { click: function () { st.photo = null; drawRc(); } } }, icon('x', 16))));
        } else add(rcBox, h('label', { for: 'receipt-input', class: 'photo-add receipt-add', id: 'receipt-add' }, h('span', { 'aria-hidden': 'true', text: '🧾' }), h('span', { text: t('rc.add') })));
      }
      rcFile.addEventListener('change', function () {
        var f = rcFile.files && rcFile.files[0]; rcFile.value = '';
        if (!f) return;
        setMsg(rcMsg, t('diary.processing'), true);
        shrinkPhoto(f).then(function (bytes) { var pid = 'p' + DY.uid(); return C.putBlob(pid, bytes, 'image/jpeg').then(function () { st.photo = pid; drawRc(); setMsg(rcMsg, ''); }); })
          .catch(function (e) { setMsg(rcMsg, e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) ? t('err.quota') : t('diary.photoErr')); });
      });
      function updPreview() { abox.upd(); }
      amount.addEventListener('input', function () { setMsg(msg, ''); });
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
            var tx = B.addTx(S.budget, { type: f.type, amt: f.amt, cur: f.cur, cat: f.cat, date: today(), note: f.note, pm: st.pm, photo: st.photo });
            finish(tx);
          } } }, h('span', { 'aria-hidden': 'true', text: catEmoji(f.cat) + ' ' }), (f.note || catName(f.cat)) + ' ' + money(f.amt, f.cur));
        })));
      }
      function finish(tx) {
        helperDone('add', tx.id); if (tx.photo) helperDone('receipt', tx.id);
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
        var amt = abox.value();
        if (!amt) { setMsg(msg, t('add.needAmount')); amount.focus(); grid.classList.add('shake'); setTimeout(function () { grid.classList.remove('shake'); }, 400); if (++slips === 2 && !editing) helperOffer('add'); return; }
        if (!st.cat) { setMsg(msg, t('add.pick')); if (++slips === 2 && !editing) helperOffer('add'); return; }
        var d = B.validDate(date.value) ? date.value : today();
        if (editing) {
          B.updateTx(S.budget, existing.id, { type: st.type, amt: amt, cat: st.cat, date: d, note: note.value.trim(), pm: st.pm || null, photo: st.photo || null });
          saveBudget(); close(); render(); toast(t('add.saved', { what: catEmoji(st.cat) + ' ' + catName(st.cat) + ' ' + money(amt, cur) }));
          return;
        }
        var tx = B.addTx(S.budget, { type: st.type, amt: amt, cat: st.cat, date: d, note: note.value.trim(), pm: st.pm, photo: st.photo });
        lsSet(PM_KEY, st.pm || null);
        if (repeat.checked) {
          var r = B.addRecurring(S.budget, { type: st.type, amt: amt, cat: st.cat, note: tx.note, day: +d.slice(8, 10), start: d.slice(0, 7), pm: st.pm });
          r.last = d.slice(0, 7); tx.rid = r.id;
        }
        finish(tx);
      }
      drawType(); drawCats(); drawFreq(); drawPm(); drawRc(); updPreview();
      add(body, typeSeg,
        h('div', { class: 'field' }, h('label', { for: 'amount', text: t('add.amount') + ' (' + cur + ')' }), amount, abox.ops, preview),
        freq,
        h('div', { class: 'two' }, field(t('add.note'), note), field(t('add.date'), date)),
        editing ? null : h('div', { class: 'check' }, repeat, h('label', { for: 'repeat', text: t('add.repeat') })),
        pmRow, rcBox, rcFile,
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

  // ----- amount box with a small calculator: "12000+3500", "4500×3" -----
  function amountBox(cur, value, id, label) {
    var input = h('input', { class: 'input amount', id: id, inputmode: 'decimal', autocomplete: 'off', placeholder: '0', value: value || '', 'aria-label': label });
    var preview = h('p', { class: 'amount-preview', 'aria-live': 'polite' });
    function upd() { var r = B.calcAmount(input.value, cur); preview.textContent = r.value ? (r.expr ? '= ' : '') + money(r.value, cur) : (r.expr && input.value.trim() ? t('calc.bad') : ''); }
    input.addEventListener('input', upd);
    var ops = h('div', { class: 'calc-ops', role: 'group', 'aria-label': t('calc.label') });
    [['+', '+'], ['−', '-'], ['×', '×'], ['÷', '÷']].forEach(function (o) {
      add(ops, h('button', { type: 'button', class: 'calc-op', tabindex: -1, 'aria-label': t('calc.' + { '+': 'plus', '-': 'minus', '×': 'times', '÷': 'divide' }[o[1]]), text: o[0],
        on: { pointerdown: function (e) { e.preventDefault(); }, click: function () {
          var a = input.selectionStart === null ? input.value.length : input.selectionStart, b = input.selectionEnd === null ? a : input.selectionEnd;
          input.value = input.value.slice(0, a) + o[1] + input.value.slice(b); input.focus();
          try { input.setSelectionRange(a + 1, a + 1); } catch (e) {}
          upd(); input.dispatchEvent(new Event('input'));
        } } }));
    });
    upd();
    return { input: input, preview: preview, ops: ops, upd: upd, value: function () { return B.calcAmount(input.value, cur).value; } };
  }

  // ----- emoji picker (categories, goals) -----
  var EMOJI_GROUPS = [
    ['food', '🍚🍜🍣🍔🍕🍗🥗🍞🥐🍰🍩🍦☕🧋🍺🍷🥤🍎🍓🛒'],
    ['life', '🏠🛋️💡💧🔥📱💻🧺🧴🪥💊🏥💇👕👟👜🧸🐶🐱🌱'],
    ['move', '🚌🚇🚕🚗⛽🅿️🚲🛵✈️🚄🚢🧳🗺️🏨'],
    ['fun', '🎬🎮🎵🎤📚🎨⚽🏋️🧘🏕️🎢🎁🎂🎉💐🎟️'],
    ['money', '💰💵💳🏦📈📉🪙🧾💸🐷🎯🏆⭐💎'],
    ['people', '👶🧒👨‍👩‍👧💑👪🎓💼👔🙏❤️🤝'],
    ['other', '📌✅❗📝📦🔧🛠️🧹🚿🌸🌈☀️🌙✨🍀']
  ];
  function emojiList(str) { return Array.from(new Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str) : str).map(function (x) { return x.segment || x; }); }
  function pickEmoji(current, onPick) {
    sheet(t('emo.title'), function (body, close) {
      EMOJI_GROUPS.forEach(function (g) {
        add(body, h('p', { class: 'field-label', text: t('emo.' + g[0]) }), h('div', { class: 'emo-grid' }, emojiList(g[1]).map(function (e) {
          return h('button', { type: 'button', class: 'emo' + (e === current ? ' on' : ''), 'data-emoji': e, 'aria-label': e, text: e, on: { click: function () { close(); onPick(e); } } });
        })));
      });
      var own = h('input', { class: 'input emoji-in', id: 'emo-own', maxlength: 8, placeholder: '🙂', 'aria-label': t('emo.own') });
      add(body, h('p', { class: 'field-label', text: t('emo.own') }), h('div', { class: 'row' }, own,
        h('button', { type: 'button', class: 'btn', id: 'emo-own-ok', text: t('btn.ok'), on: { click: function () { var v = own.value.trim(); if (v) { close(); onPick(v); } } } })));
    });
  }
  function emojiButton(value, id, onPick) {
    var b = h('button', { type: 'button', class: 'emo-btn', id: id, 'aria-label': t('emo.title') + ': ' + value, text: value });
    b.addEventListener('click', function () { pickEmoji(b.textContent, function (e) { b.textContent = e; b.setAttribute('aria-label', t('emo.title') + ': ' + e); onPick(e); }); });
    return b;
  }

  // ----- money for today (on the budget card, this month only) -----
  function allowanceLine() {
    var a = B.dailyAllowance(S.budget, today());
    if (!a) return null;
    if (a.over) return h('p', { class: 'allow over', id: 'allowance', text: t('allow.over', { amt: money(a.over) }) });
    if (a.short) return h('p', { class: 'allow over', id: 'allowance' }, h('span', { class: 'allow-main', text: t('allow.short', { amt: money(a.short) }) }),
      h('span', { class: 'allow-sub', id: 'allow-fixed', text: t('allow.fixed', { amt: money(a.reserved) }) }));
    return h('p', { class: 'allow' + (a.todayLeft < 0 ? ' over' : ''), id: 'allowance' },
      h('span', { class: 'allow-main', text: a.todayLeft >= 0 ? t('allow.today', { amt: money(a.todayLeft) }) : t('allow.todayOver', { amt: money(-a.todayLeft) }) }),
      h('span', { class: 'allow-sub', text: t('allow.sub', { amt: money(a.perDay), n: a.daysLeft }) }),
      a.reserved ? h('span', { class: 'allow-sub', id: 'allow-fixed', text: t('allow.fixed', { amt: money(a.reserved) }) }) : null);
  }

  // ----- savings goals ("모으기"): kept apart from spending -----
  function goalsChip() {
    var gs = S.budget.goals || [], saved = B.goalsSavedIn(S.budget, S.ym);
    var label = gs.length ? t('goal.chip', { n: gs.filter(function (g) { return !g.done; }).length }) + (saved ? ' · ' + t('goal.thisMonth', { amt: money(saved) }) : '') : t('goal.start');
    return h('button', { type: 'button', class: 'goal-chip', id: 'goals-chip', on: { click: function () { S.budgetView = 'goals'; render(); } } }, h('span', { 'aria-hidden': 'true', text: '🎯 ' }), label);
  }
  function goalBar(p, done) {
    return h('div', { class: 'goal-bar' + (done ? ' done' : ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.pct }, h('span', { style: 'width:' + p.pct + '%' }));
  }
  function renderGoals(main) {
    var gs = (S.budget.goals || []), active = gs.filter(function (g) { return !g.done; }), done = gs.filter(function (g) { return g.done; });
    var box = h('div', { id: 'goals' });
    if (!active.length && !done.length) add(box, empty('🎯', t('goal.empty'), t('goal.emptyHint')));
    active.forEach(function (g) {
      var p = B.goalProgress(g, today());
      add(box, h('button', { type: 'button', class: 'card goal-card', 'data-id': g.id, on: { click: function () { openGoal(g.id); } } },
        h('span', { class: 'goal-emoji', 'aria-hidden': 'true', text: g.emoji || '🎯' }),
        h('span', { class: 'goal-main' },
          h('span', { class: 'goal-name', text: g.name }),
          goalBar(p),
          h('span', { class: 'goal-nums', text: t('goal.nums', { saved: money(p.saved), target: money(g.target), pct: p.pct }) }),
          p.perMonth ? h('span', { class: 'hint goal-plan', text: t('goal.perMonth', { amt: money(p.perMonth), n: p.monthsLeft }) }) : null)));
    });
    add(box, h('button', { type: 'button', class: 'btn primary block', id: 'goal-new', on: { click: function () { editGoal(null); } } }, '+ ', t('goal.new')));
    if (done.length) add(box, h('h3', { class: 'shelf-head', text: '🏆 ' + t('goal.shelf') }), h('div', { class: 'shelf', id: 'goal-shelf' }, done.map(function (g) {
      return h('button', { type: 'button', class: 'badge', 'data-id': g.id, on: { click: function () { openGoal(g.id); } } },
        h('span', { class: 'badge-emoji', 'aria-hidden': 'true', text: g.emoji || '🏆' }), h('span', { class: 'badge-name', text: g.name }),
        h('span', { class: 'badge-date', text: I.fullDate(new Date(g.done).toISOString().slice(0, 10)) }));
    })));
    add(main, box);
  }
  function editGoal(id) {
    var g = id ? S.budget.goals.find(function (x) { return x.id === id; }) : null;
    var emo = g ? g.emoji || '🎯' : '🎯';
    sheet(g ? t('goal.edit') : t('goal.new'), function (body, close) {
      var eb = emojiButton(emo, 'goal-emoji', function (e) { emo = e; });
      var name = h('input', { class: 'input', id: 'goal-name', maxlength: 40, placeholder: t('goal.namePh'), value: g ? g.name : '', 'data-autofocus': '1' });
      var amt = amountBox(S.budget.currency, g ? B.majorString(g.target, S.budget.currency) : '', 'goal-target', t('goal.target'));
      var due = h('input', { class: 'input', id: 'goal-due', type: 'date', value: g && g.due ? g.due : '' });
      var msg = msgEl();
      add(body, h('div', { class: 'row' }, eb, h('div', { class: 'grow' }, field(t('goal.name'), name))),
        h('div', { class: 'field' }, h('label', { for: 'goal-target', text: t('goal.target') + ' (' + S.budget.currency + ')' }), amt.input, amt.ops, amt.preview),
        field(t('goal.due'), due, t('goal.dueHint')), msg,
        h('div', { class: 'row end' },
          g ? h('button', { type: 'button', class: 'btn danger', id: 'goal-delete', text: t('btn.delete'), on: { click: function () {
            var removed = B.deleteGoal(S.budget, g.id); saveBudget(); closeAllModals(); render();
            toast(t('goal.deleted'), { label: t('btn.undo'), fn: function () { S.budget.goals.push(removed); saveBudget(); render(); } });
          } } }) : null,
          h('button', { type: 'button', class: 'btn primary', id: 'goal-save', text: t('btn.save'), on: { click: function () {
            var v = amt.value();
            if (!name.value.trim()) { setMsg(msg, t('goal.needName')); name.focus(); return; }
            if (!v) { setMsg(msg, t('goal.needTarget')); amt.input.focus(); return; }
            if (g) B.updateGoal(S.budget, g.id, { name: name.value.trim(), emoji: emo, target: v, due: due.value || null });
            else if (!B.addGoal(S.budget, { name: name.value.trim(), emoji: emo, target: v, due: due.value || null })) { setMsg(msg, t('goal.tooMany')); return; }
            saveBudget(); close(); S.budgetView = 'goals'; render();
          } } })));
    });
  }
  function openGoal(id) {
    var g = S.budget.goals.find(function (x) { return x.id === id; }); if (!g) return;
    sheet((g.emoji ? g.emoji + ' ' : '') + g.name, function (body, close) {
      function draw() {
        body.textContent = '';
        var p = B.goalProgress(g, today());
        var amt = amountBox(S.budget.currency, '', 'goal-amount', t('goal.amount'));
        var note = h('input', { class: 'input', id: 'goal-note', maxlength: 80, placeholder: t('goal.notePh') });
        var msg = msgEl();
        function move(sign) {
          var v = amt.value(); if (!v) { setMsg(msg, t('add.needAmount')); amt.input.focus(); return; }
          var r = B.goalMove(S.budget, g.id, sign * v, today(), note.value.trim());
          if (!r) { setMsg(msg, t('goal.tooMuchOut')); return; }
          saveBudget();
          if (r.reached) { close(); render(); celebrate(g); return; }
          draw();
          if (r.milestone) toast(t({ 25: 'goal.milestone25', 50: 'goal.milestone50', 75: 'goal.milestone75' }[r.milestone]));
          else toast(sign > 0 ? t('goal.added', { amt: money(v) }) : t('goal.taken', { amt: money(v) }));
        }
        add(body,
          h('div', { class: 'goal-head' + (g.done ? ' done' : '') },
            h('div', { class: 'goal-ring', 'aria-hidden': 'true' }, h('span', { text: g.done ? '🏆' : p.pct + '%' })),
            h('div', {}, h('p', { class: 'goal-big', id: 'goal-saved', text: money(p.saved) }), h('p', { class: 'hint', text: t('goal.of', { target: money(g.target) }) }),
              g.done ? h('p', { class: 'goal-done-text', text: t('goal.doneOn', { d: I.fullDate(new Date(g.done).toISOString().slice(0, 10)) }) })
                : h('p', { class: 'hint', text: t('goal.left', { amt: money(p.left) }) + (p.perMonth ? ' · ' + t('goal.perMonth', { amt: money(p.perMonth), n: p.monthsLeft }) : '') }))),
          goalBar(p, !!g.done),
          h('div', { class: 'field' }, h('label', { for: 'goal-amount', text: t('goal.amount') + ' (' + S.budget.currency + ')' }), amt.input, amt.ops, amt.preview),
          note, msg,
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn primary grow', id: 'goal-in', on: { click: function () { move(1); } } }, '＋ ', t('goal.in')),
            h('button', { type: 'button', class: 'btn grow', id: 'goal-out', on: { click: function () { move(-1); } } }, '− ', t('goal.out'))),
          g.moves.length ? h('h3', { class: 'shelf-head', text: t('goal.history') }) : null,
          h('ul', { class: 'tx goal-moves' }, g.moves.slice(-30).reverse().map(function (mv) {
            return h('li', { class: 'tx-row static' }, h('span', { class: 'tx-date', text: I.fullDate(mv.date) }), h('span', { class: 'tx-main', text: mv.note || '' }),
              h('b', { class: mv.amt > 0 ? 'pos' : 'neg', text: (mv.amt > 0 ? '+' : '−') + money(Math.abs(mv.amt)) }));
          })),
          h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', id: 'goal-edit', text: t('btn.edit'), on: { click: function () { editGoal(g.id); } } })));
      }
      draw();
    }, { onClose: function () { if (S.budgetView === 'goals') render(); } });
  }
  // The goal is reached: a short celebration (no motion when the phone asks for less motion), then the trophy shelf.
  function celebrate(g) {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var layer = h('div', { class: 'celebrate', id: 'celebrate', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'celebrate-title' });
    if (!reduce) {
      var colors = ['#FF8FA3', '#FFD45C', '#8FD694', '#8FC7FF', '#B39DDB', '#FFB347'];
      for (var i = 0; i < 70; i++) {
        var c = h('i', { class: 'confetti' });
        c.style.left = (Math.random() * 100) + '%'; c.style.background = colors[i % colors.length];
        c.style.animationDelay = (Math.random() * 0.8) + 's'; c.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
        c.style.transform = 'rotate(' + Math.round(Math.random() * 360) + 'deg)';
        add(layer, c);
      }
    }
    var ok = h('button', { type: 'button', class: 'btn primary', id: 'celebrate-ok', text: t('goal.yay') });
    add(layer, h('div', { class: 'celebrate-card' + (reduce ? '' : ' pop') },
      h('div', { class: 'celebrate-emoji', 'aria-hidden': 'true', text: g.emoji || '🏆' }),
      h('h2', { id: 'celebrate-title', text: t('goal.reached') }),
      h('p', { class: 'celebrate-name', text: g.name }),
      h('p', { class: 'celebrate-amt', text: money(B.goalSaved(g)) }),
      h('p', { class: 'hint', text: t('goal.reachedSub') }), ok));
    function done() { layer.remove(); S.tab = 'budget'; S.budgetView = 'goals'; render(); }
    ok.addEventListener('click', done);
    layer.addEventListener('keydown', function (e) { if (e.key === 'Escape') done(); });
    document.body.appendChild(layer);
    setTimeout(function () { ok.focus(); }, 30);
  }

  // ----- fingerprint / face unlock -----
  var pkAvail = null;
  function pkCheck() { if (pkAvail === null) pkAvail = C.passkeyAvailable(); return pkAvail; }
  function pkText(err) { return err && err.code === 'pk-cancel' ? t('pk.cancel') : err && err.code === 'no-prf' ? t('pk.noPrf') : t('pk.failed'); }
  function openPasskey() {
    C.passkeyEnrolled().then(function (on) {
      sheet(t('pk.title'), function (body, close) {
        if (on) {
          add(body, h('p', { text: t('pk.onBody') }), h('p', { class: 'hint', text: t('pk.removeHint') }),
            h('button', { type: 'button', class: 'btn danger block', id: 'pk-remove', text: t('pk.off'), on: { click: function () {
              C.passkeyRemove().then(function () { close(); render(); toast(t('pk.offDone')); });
            } } }));
          return;
        }
        var p = passField(t('lock.pass'), true, 'current-password'), msg = msgEl();
        var go = h('button', { type: 'button', class: 'btn primary block', id: 'pk-enroll', text: t('pk.on') });
        go.addEventListener('click', function () {
          go.disabled = true; setMsg(msg, t('pk.wait'), true);
          C.passkeyEnroll(p.input.value, t('app.name')).then(function () { close(); render(); toast(t('pk.onDone')); })
            .catch(function (e) { go.disabled = false; setMsg(msg, e && e.code === 'bad-passcode' ? t('lock.wrong') : pkText(e)); });
        });
        add(body, h('p', { text: t('pk.body') }), h('p', { class: 'hint', text: t('pk.how') }), p.el, msg, go);
      });
    });
  }

  // ----- checklist notes: "- [ ] milk" lines shown as tick boxes -----
  function checklistEditor(n, onChange) {
    var box = h('div', { class: 'checklist', role: 'list' });
    var timer = null;
    function save(now) {
      clearTimeout(timer);
      var go = function () { var v = LS.serialize(items); if (v !== n.text) { n.text = v; n.updated = Date.now(); markNote(n); saveNotes(); if (onChange) onChange(); } };
      if (now) go(); else timer = setTimeout(go, 400);
    }
    var items = LS.parse(n.text);
    function draw(focusAt) {
      box.textContent = '';
      if (!items.length) items.push({ done: false, text: '' });
      items.forEach(function (it, i) {
        var cb = h('input', { type: 'checkbox', class: 'cl-cb', checked: it.done, 'aria-label': it.text || t('cl.item') });
        var inp = h('input', { class: 'cl-in' + (it.done ? ' done' : ''), value: it.text, placeholder: t('cl.item'), 'aria-label': t('cl.item') + ' ' + (i + 1), maxlength: 300 });
        cb.addEventListener('change', function () { it.done = cb.checked; inp.classList.toggle('done', it.done); save(true); });
        inp.addEventListener('input', function () { it.text = inp.value; save(); });
        inp.addEventListener('keydown', function (e) {
          if (e.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); items.splice(i + 1, 0, { done: false, text: '' }); save(true); draw(i + 1); }
          else if (e.key === 'Backspace' && !inp.value && items.length > 1) { e.preventDefault(); items.splice(i, 1); save(true); draw(Math.max(0, i - 1)); }
        });
        add(box, h('div', { class: 'cl-row', role: 'listitem' }, cb, inp));
      });
      add(box, h('button', { type: 'button', class: 'mini', id: 'cl-add', text: '+ ' + t('cl.add'), on: { click: function () { items.push({ done: false, text: '' }); save(true); draw(items.length - 1); } } }));
      if (focusAt !== undefined) { var ins = box.querySelectorAll('.cl-in'); if (ins[focusAt]) ins[focusAt].focus(); }
    }
    draw();
    box.refresh = function () { if (document.activeElement && box.contains(document.activeElement)) return; items = LS.parse(n.text); draw(); };
    box.flush = function () { if (timer) save(true); };
    return box;
  }

  // ----- Notes tab -----
  var noteTimer = null, noteFlush = null;
  function flushNote() { if (noteFlush) { var f = noteFlush; noteFlush = null; clearTimeout(noteTimer); f(); } }
  function sortedNotes() {
    return S.notes.notes.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (b.updated - a.updated); });
  }
  function renderNotes(main) {
    add(main, topBar(h('h1', { class: 'title', text: t('notes.title') })), helperCards('notes'));
    var list = sortedNotes();
    if (list.length) {
      var input = h('input', { type: 'search', class: 'input', id: 'notes-search', placeholder: t('notes.search'), value: S.notesQuery, 'aria-label': t('notes.search') });
      var grid = h('div', { class: 'notes', id: 'notes-grid' });
      var draw = function () {
        grid.textContent = '';
        var q = S.notesQuery.trim().toLowerCase();
        var shown = q ? list.filter(function (n) { return !n.locked && n.text.toLowerCase().indexOf(q) >= 0; }) : list;
        if (!shown.length) return add(grid, h('p', { class: 'hint center', text: t('notes.none') }));
        shown.forEach(function (n) {
          var first = n.locked ? t('notes.lockedCard') : (n.text.trim().split('\n')[0] || t('notes.ph'));
          add(grid, h('button', { type: 'button', class: 'note-card ' + noteLook(n) + (n.locked ? ' locked' : ''), 'data-id': n.id, 'aria-label': first.slice(0, 60), on: { click: function () { openNote(n.id); } } },
            n.pinned ? h('span', { class: 'pin-badge', title: t('notes.pinned') }, icon('pin', 14)) : null,
            deskHas(n.id) ? h('span', { class: 'desk-badge', title: t('desk.on') }, icon('desk', 14)) : null,
            n.locked ? h('span', { class: 'note-text note-locked' }, icon('lock', 18), ' ', t('notes.lockedCard')) : h('span', { class: 'note-text', text: (n.list ? LS.preview(n.text) : n.text) || t('notes.ph') }),
            n.list && !n.locked && LS.count(n.text).all ? h('span', { class: 'note-count', text: LS.count(n.text).done + '/' + LS.count(n.text).all }) : null,
            !n.locked && n.photos && n.photos.length ? noteThumb(n) : null,
            !n.locked && n.remind && n.remind >= nowLocal() ? h('span', { class: 'note-remind', title: t('nr.set', { when: whenText(n.remind) }), text: '⏰ ' + whenText(n.remind) }) : null,
            h('span', { class: 'note-time', text: I.ago(n.updated) })));
        });
      };
      input.addEventListener('input', function () { S.notesQuery = input.value; draw(); });
      var onDesk = deskIds();
      if (deskCapable() && onDesk.length) add(main, h('div', { class: 'desk-bar-main card' },
        h('span', { class: 'hint', text: t('desk.howto') }),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', id: 'desk-open-all', on: { click: function () { deskReopen(true); } } }, icon('desk', 18), ' ', t('desk.openAll', { n: onDesk.length })),
          h('button', { type: 'button', class: 'btn', id: 'desk-tidy', on: { click: function () { C.notify({ type: 'desk-arrange' }); toast(t('desk.tidied')); } } }, '🧲 ', t('desk.tidy'))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'desk-snap', checked: snapOn(), on: { change: function (e) { lsSet(SNAP_KEY, e.target.checked ? null : 'off'); } } }), h('span', { text: t('desk.snap') }))));
      add(main, h('div', { class: 'notes-search' }, input), grid);
      draw();
    } else add(main, empty('🗒️', t('notes.empty'), t('notes.emptyHint')));
    add(main, fab(t('notes.new'), function () {
      var n = { id: B.uid(), text: '', color: 'yellow', pinned: false, created: Date.now(), updated: Date.now() };
      S.notes.notes.push(n); noteLocal[n.id] = 1;
      openNote(n.id, true);
    }, 'new-note'));
  }
  function openNote(id, isNew) {
    var n = S.notes.notes.find(function (x) { return x.id === id; });
    if (!n) return;
    if (n.locked && !noteShown[n.id]) {
      sheet(t('notes.lockedCard'), function (body, close) {
        add(body, notePassForm(function () { noteShown[n.id] = 1; close(); openNote(id); }));
      });
      return;
    }
    var deleted = false;
    sheet(isNew ? t('notes.new') : t('notes.title'), function (body, close, m) {
      var ta = h('textarea', { class: 'input note-edit ' + noteLook(n), id: 'note-text', rows: 10, placeholder: t('notes.ph'), 'aria-label': t('notes.title'), 'data-autofocus': '1', value: n.text });
      ta.addEventListener('input', function () { if (ta.value.trim()) helperDone('note', n.id); });
      function persist() {
        noteFlush = null;
        if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); markNote(n); }
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
            on: { click: function () { n.color = c; n.updated = Date.now(); markNote(n); ta.className = 'input note-edit ' + noteLook(n); if (cl) cl.className = 'checklist ' + noteLook(n); drawColors(); saveNotes(); } } }));
        });
      }
      drawColors();
      var pin = h('button', { type: 'button', class: 'btn', id: 'note-pin', 'aria-pressed': n.pinned ? 'true' : 'false' }, icon('pin', 18), ' ', n.pinned ? t('notes.unpin') : t('notes.pin'));
      pin.addEventListener('click', function () {
        n.pinned = !n.pinned; markNote(n); saveNotes();
        pin.setAttribute('aria-pressed', n.pinned ? 'true' : 'false');
        pin.lastChild.textContent = n.pinned ? t('notes.unpin') : t('notes.pin');
      });
      var del = h('button', { type: 'button', class: 'btn danger', id: 'note-delete' }, icon('trash', 18), ' ', t('btn.delete'));
      del.addEventListener('click', function () {
        deleted = true; noteFlush = null; clearTimeout(noteTimer);
        var idx = S.notes.notes.indexOf(n); var copy = S.notes.notes.splice(idx, 1)[0];
        copy.text = ta.value; goneNote(copy); deskForget(copy.id);
        saveNotes(); close(); render();
        toast(t('notes.deleted'), { label: t('btn.undo'), fn: function () { S.notes.notes.push(copy); markNote(copy); saveNotes(); render(); } });
      });
      function pickRow(label, list, cur, labelOf, onPick, idp) {
        var g = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': label });
        list.forEach(function (v) {
          add(g, h('button', { type: 'button', role: 'radio', class: 'chip small' + (idp === 'font' ? ' font-' + v : ''), id: idp + '-' + v, 'aria-checked': cur() === v ? 'true' : 'false', text: labelOf(v),
            on: { click: function () { onPick(v); g.querySelectorAll('[role=radio]').forEach(function (b) { b.setAttribute('aria-checked', b.id === idp + '-' + v ? 'true' : 'false'); }); ta.className = 'input note-edit ' + noteLook(n); if (cl) cl.className = 'checklist ' + noteLook(n); markNote(n); saveNotes(); } } }));
        });
        return h('div', { class: 'note-pick' }, h('span', { class: 'field-label', text: label }), g);
      }
      // checklist: the same text, shown as tick boxes ("- [ ] milk")
      var wrap = h('div', { class: 'note-wrap' }), cl = null;
      function drawEditor() {
        wrap.textContent = '';
        if (n.list) { cl = checklistEditor(n, function () { ta.value = n.text; }); cl.className = 'checklist ' + noteLook(n); cl.id = 'note-list'; add(wrap, cl); }
        else { cl = null; add(wrap, ta); }
      }
      var listBtn = h('button', { type: 'button', class: 'btn', id: 'note-listmode', 'aria-pressed': n.list ? 'true' : 'false' }, '☑ ', n.list ? t('cl.off') : t('cl.on'));
      listBtn.addEventListener('click', function () {
        flushNote(); if (cl) cl.flush();
        if (n.text !== ta.value && !n.list) { n.text = ta.value; }
        n.list = !n.list;
        if (n.list) n.text = LS.serialize(LS.parse(n.text));
        ta.value = n.text; n.updated = Date.now(); markNote(n); saveNotes(); drawEditor();
        listBtn.setAttribute('aria-pressed', n.list ? 'true' : 'false'); listBtn.lastChild.textContent = n.list ? t('cl.off') : t('cl.on');
      });
      var lockBtn = h('button', { type: 'button', class: 'btn', id: 'note-lock', 'aria-pressed': n.locked ? 'true' : 'false' }, icon('lock', 18), ' ', n.locked ? t('notes.unlockNote') : t('notes.lock'));
      lockBtn.addEventListener('click', function () {
        n.locked = !n.locked; if (n.locked) noteShown[n.id] = 1; markNote(n); saveNotes();
        lockBtn.setAttribute('aria-pressed', n.locked ? 'true' : 'false'); lockBtn.lastChild.textContent = n.locked ? t('notes.unlockNote') : t('notes.lock');
        toast(n.locked ? t('notes.lockedNow') : t('notes.unlockedNow'));
      });
      drawEditor();
      var nphotos = h('div', { class: 'photos note-photos', id: 'note-photos' }), npmsg = msgEl();
      var nfile = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'note-photo-input', class: 'sr', 'aria-label': t('nr.addPhoto') });
      function drawNotePhotos() {
        nphotos.textContent = '';
        (n.photos || []).forEach(function (pid) {
          var img = h('img', { alt: t('nr.photoAlt'), class: 'photo-thumb' });
          photoUrl(pid).then(function (u) { if (u) img.src = u; }).catch(function () {});
          add(nphotos, h('div', { class: 'photo' },
            h('button', { type: 'button', class: 'photo-open', 'aria-label': t('nr.photoAlt'), on: { click: function () { viewPhoto(pid); } } }, img),
            h('button', { type: 'button', class: 'photo-x', 'aria-label': t('diary.removePhoto'), on: { click: function () {
              n.photos = n.photos.filter(function (x) { return x !== pid; }); n.updated = Date.now(); markNote(n); saveNotes(); drawNotePhotos();
            } } }, icon('x', 16))));
        });
        if ((n.photos || []).length < NOTE_MAX_PHOTOS) add(nphotos, h('label', { for: 'note-photo-input', class: 'photo-add', id: 'note-photo-add' }, h('span', { 'aria-hidden': 'true', text: '📷' }), h('span', { text: t('nr.addPhoto') })));
      }
      nfile.addEventListener('change', function () {
        var files = Array.from(nfile.files || []).slice(0, NOTE_MAX_PHOTOS - (n.photos || []).length); nfile.value = '';
        setMsg(npmsg, t('diary.processing'), true);
        files.reduce(function (p, f) {
          return p.then(function () {
            return shrinkPhoto(f).then(function (bytes) {
              var pid = 'p' + DY.uid();
              return C.putBlob(pid, bytes, 'image/jpeg').then(function () {
                n.photos = (n.photos || []).concat([pid]); n.updated = Date.now(); markNote(n); drawNotePhotos(); return saveNotes();
              });
            });
          });
        }, Promise.resolve()).then(function () { setMsg(npmsg, ''); }, function (e) { setMsg(npmsg, e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) ? t('err.quota') : t('diary.photoErr')); });
      });
      drawNotePhotos();
      var remindBtn = h('button', { type: 'button', class: 'btn', id: 'note-remind', on: { click: function () {
        flushNote(); if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); markNote(n); saveNotes(); }
        openNoteReminder(n, function () { remindBtn.lastChild.textContent = n.remind ? whenText(n.remind) : t('nr.btn'); });
      } } }, h('span', { 'aria-hidden': 'true', text: '⏰ ' }), n.remind && n.remind >= nowLocal() ? whenText(n.remind) : t('nr.btn'));
      add(body, wrap, nphotos, nfile, npmsg, h('div', { class: 'note-tools' }, colors),
        pickRow(t('deco.font'), NOTE_FONTS, function () { return n.font; }, function (v) { return t('font.' + v); }, function (v) { n.font = v; }, 'font'),
        pickRow(t('notes.size'), NOTE_SIZES, function () { return n.size; }, function (v) { return t('size.' + v); }, function (v) { n.size = v; }, 'size'),
        h('div', { class: 'row' }, pin, listBtn, lockBtn, remindBtn, del),
        deskCapable() ? h('div', { class: 'row desk-actions' },
          h('button', { type: 'button', class: 'btn', id: 'note-desk', on: { click: function () {
            flushNote(); if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); markNote(n); }
            if (!n.text.trim()) { ta.focus(); return; }
            saveNotes().then(function () { if (deskOpen(n.id)) close(); });
          } } }, icon('desk', 18), ' ', t('desk.open')),
          pipCapable() ? h('button', { type: 'button', class: 'btn', id: 'note-pip', on: { click: function () {
            flushNote(); if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); markNote(n); saveNotes(); }
            pinOnTop(n.id); close();
          } } }, icon('pin', 18), ' ', t('desk.pin')) : null) : null);
      m.onClose = function () {
        if (n.locked) delete noteShown[n.id];             // a locked note asks again next time
        if (deleted) return;
        if (cl) cl.flush();
        flushNote();
        if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); markNote(n); }
        if (noteEmpty(n) && !deskHas(n.id)) { S.notes.notes = S.notes.notes.filter(function (x) { return x !== n; }); goneNote(n); }
        saveNotes(); render();
      };
    }, { wide: true });
  }

  // ----- Desktop notes: each note in its own small window, and one note kept on top of other windows -----
  // Only on a computer (mouse + keyboard). The open session never goes over the broadcast channel: it is handed by
  // postMessage only to windows this page opened itself, or back to the app window that opened this one.
  function deskCapable() {
    try { return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; }
  }
  function pipCapable() { return deskCapable() && 'documentPictureInPicture' in window; }
  function deskMap() { try { var m = JSON.parse(lsGet(DESK_KEY)); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; } catch (e) { return {}; } }
  function deskSet(m) { lsSet(DESK_KEY, Object.keys(m).length ? JSON.stringify(m) : null); }
  function deskIds() {           // notes placed on the desktop that still exist
    var m = deskMap();
    return Object.keys(m).filter(function (id) { return S.notes && S.notes.notes.some(function (n) { return n.id === id; }); });
  }
  function deskHas(id) { return Object.prototype.hasOwnProperty.call(deskMap(), id); }
  function deskForget(id) { var m = deskMap(); if (m[id]) { delete m[id]; deskSet(m); } }

  var kids = [];                 // windows this page opened (desktop notes)
  var deskHere = {};             // note ids whose window answered "I'm open"
  function liveKids() { kids = kids.filter(function (w) { try { return w && !w.closed; } catch (e) { return false; } }); return kids; }
  var showGrant = {};            // locked notes just opened with the passcode here and put on the desktop: their new window may show them once
  function sendKey(w) {
    var s = C.shareSession(); if (!s || !w) return;
    var id = null; try { id = (w.name || '').replace(/^ppm-note-/, ''); } catch (e) {}
    var shown = id && showGrant[id] ? [id] : []; if (id) delete showGrant[id];
    try { w.postMessage({ type: 'ppm-key', key: s.key, metaId: s.metaId, shown: shown }, location.origin); } catch (e) {}
  }
  function openerIsApp() {       // only ever hand the session back to this app's own page
    try { return !!(window.opener && !window.opener.closed && window.opener.location.origin === location.origin && /^\/vault(\.html)?$/.test(window.opener.location.pathname)); } catch (e) { return false; }
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
    var d = e.data, fromKid = kids.indexOf(e.source) >= 0, fromOpener = !!e.source && e.source === window.opener && openerIsApp();
    if (d.type === 'ppm-hello') { if (fromKid && S.phase === 'app') sendKey(e.source); return; }
    if (d.type === 'ppm-key' && (fromKid || fromOpener) && (S.phase === 'locked' || S.phase === 'forgot')) {
      C.adoptSession(d.key, d.metaId).then(function () { clearFails(); if (DESK && Array.isArray(d.shown) && d.shown.indexOf(DESK) >= 0) noteShown[DESK] = 1; return loadAll(); })
        .then(function () { S.phase = 'app'; touch(); render(); afterUnlock(true); }).catch(function () {});
    }
  });
  function afterUnlock(adopted) {
    S.pkArm = false;
    if (!DESK) helperWatch();
    if (!DESK) abInit();
    liveKids().forEach(sendKey);
    if (DESK) { if (!adopted && openerIsApp()) sendKey(window.opener); return; }
    if (S.startAdd) { S.startAdd = false; S.tab = 'budget'; render(); openAdd(); }      // the "Add spending" home-screen shortcut
    if (S.shared) saveShared();
    if (!adopted && deskCapable() && deskIds().length) setTimeout(function () { deskReopen(false); }, 0);
  }
  // Android "Share" -> this app: the service worker keeps the shared text for a moment (it never goes to the server),
  // the app picks it up and deletes it at once, and saves it as a new note when unlocked.
  var SHARE_CACHE = 'ppm-share', SHARE_URL = '/__ppm-share';
  function takeShared() {
    S.tab = 'notes';
    if (history.replaceState) { try { history.replaceState(null, '', location.pathname); } catch (e) {} }
    if (!window.caches) return;
    caches.open(SHARE_CACHE).then(function (c) {
      return c.match(SHARE_URL).then(function (r) { return r ? r.json() : null; }).then(function (d) {
        return c.delete(SHARE_URL).then(function () { return d; });
      });
    }).then(function (d) {
      if (!d || Date.now() - (d.at || 0) > 10 * 60000) return;
      var parts = [];
      [d.title, d.text, d.url].forEach(function (x) {
        x = String(x || '').trim();
        if (x && parts.every(function (p) { return p.indexOf(x) < 0; })) parts.push(x);
      });
      if (!parts.length) return;
      S.shared = parts.join('\n').slice(0, 20000);
      if (S.phase === 'app') saveShared(); else if (S.phase === 'locked') toast(t('share.locked'));
    }).catch(function () {});
  }
  function saveShared() {
    var text = S.shared; S.shared = null;
    if (!text || !S.notes) return;
    var n = { id: B.uid(), text: text, color: 'yellow', pinned: false, created: Date.now(), updated: Date.now() };
    S.notes.notes.push(n); noteLocal[n.id] = 1; markNote(n); saveNotes();
    S.tab = 'notes'; render(); toast(t('share.done'));
  }

  function deskHello() {         // a locked note window asks the app window that opened it for the open session
    if (!DESK || !openerIsApp()) return;
    try { window.opener.postMessage({ type: 'ppm-hello' }, location.origin); } catch (e) {}
  }

  function deskFeatures(g) {
    return 'popup=yes,width=' + Math.round(g[2]) + ',height=' + Math.round(g[3]) + ',left=' + Math.round(g[0]) + ',top=' + Math.round(g[1]);
  }
  function deskDefaultGeo() {
    var n = Object.keys(deskMap()).length % 8, sw = (screen.availWidth || 1280), sl = (screen.availLeft || 0), st = (screen.availTop || 0);
    return [sl + sw - 340 - n * 28, st + 60 + n * 28, 300, 300];
  }
  // Opens one note window. Returns false when the browser blocked the window.
  function deskOpen(id, geo) {
    var m = deskMap(); var g = geo || m[id] || deskDefaultGeo();
    var w = null;
    try { w = window.open('/vault?w=note&id=' + encodeURIComponent(id), 'ppm-note-' + id, deskFeatures(g)); } catch (e) { w = null; }
    if (!w) { toast(t('desk.blocked', { btn: t('desk.openAll', { n: deskIds().length || 1 }) })); return false; }
    if (kids.indexOf(w) < 0) kids.push(w);
    var nn = S.notes && S.notes.notes.find(function (x) { return x.id === id; });
    if (nn && nn.locked && noteShown[id]) showGrant[id] = 1;
    if (!m[id]) { m[id] = g; deskSet(m); }
    if (S.tab === 'notes' && !modalOpen()) render();
    if (S.settings && S.settings.autoLock) toast(t('desk.never'));
    return true;
  }
  // Opens every desktop note that isn't open yet. Windows already open (from an earlier visit) answer the ping and are left alone.
  function deskReopen(byHand) {
    deskHere = {};
    C.notify({ type: 'desk-ping' });
    setTimeout(function () {
      var ids = deskIds().filter(function (id) { return !deskHere[id]; });
      for (var i = 0; i < ids.length; i++) if (!deskOpen(ids[i])) break;
      if (byHand && !ids.length) toast(t('desk.howto'));
    }, 250);
  }

  // ----- inside a note window -----
  var deskTa = null, deskTimer = null, deskPending = null, deskGeo = null, pipWin = null, pipId = null, pipTa = null;
  function deskNote() { return S.notes && S.notes.notes.find(function (x) { return x.id === DESK; }); }
  function deskFlush() {
    if (deskTa && deskTa.flush) deskTa.flush(); if (pipTa && pipTa.flush) pipTa.flush();
    if (deskPending) { var f = deskPending; deskPending = null; clearTimeout(deskTimer); f(); }
  }
  // Saved per note window: [x, y, inner width, inner height, outer width, outer height, last seen]. No note text.
  function deskSaveGeo() {
    if (!DESK || S.phase !== 'app' || deskShrunk) return;
    var g = [window.screenX, window.screenY, window.innerWidth, window.innerHeight, window.outerWidth, window.outerHeight];
    var m = deskMap(); if (!m[DESK]) return;            // taken off the desktop (here or in another window): don't put it back
    m[DESK] = g.concat([Date.now()]); deskSet(m); deskGeo = g;
  }
  if (DESK) setInterval(deskSaveGeo, 2000);
  var SNAP_KEY = 'ppm-vault-desk-snap';
  function snapOn() { return lsGet(SNAP_KEY) !== 'off'; }
  function screenArea() { return { x: screen.availLeft || 0, y: screen.availTop || 0, w: screen.availWidth || 1280, h: screen.availHeight || 800 }; }
  function otherWindows() {              // the other desktop notes that are open right now (seen in the last few seconds)
    var m = deskMap(), now = Date.now();
    return Object.keys(m).filter(function (id) { return id !== DESK && Array.isArray(m[id]) && m[id].length >= 7 && now - m[id][6] < 6000; })
      .map(function (id) { var g = m[id]; return { x: g[0], y: g[1], w: g[4], h: g[5] }; });
  }
  // When a note window is dropped near another one or near a screen edge, it sticks to it.
  var lastPos = null, stillSince = 0, movedOnce = false;
  function snapCheck() {
    if (!DESK || S.phase !== 'app' || deskShrunk || !SN) return;
    var pos = [window.screenX, window.screenY].join();
    if (pos !== lastPos) { if (lastPos !== null) movedOnce = true; lastPos = pos; stillSince = Date.now(); return; }
    if (!movedOnce || Date.now() - stillSince < 450) return;
    movedOnce = false;
    if (!snapOn()) return;
    var me = { x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight };
    var to = SN.snap(me, otherWindows(), screenArea(), 20);
    if (to.x !== me.x || to.y !== me.y) { try { window.moveTo(to.x, to.y); } catch (e) {} lastPos = [to.x, to.y].join(); }
    deskSaveGeo();
  }
  if (DESK) setInterval(snapCheck, 150);
  // "Tidy desktop notes": every open note window moves itself to its place in a neat column on the right.
  function deskArrange() {
    if (!DESK || S.phase !== 'app' || deskShrunk || !SN) return;
    var m = deskMap(), now = Date.now();
    var open = Object.keys(m).filter(function (id) { return id === DESK || (Array.isArray(m[id]) && m[id].length >= 7 && now - m[id][6] < 6000); });
    var i = open.indexOf(DESK); if (i < 0) return;
    var slot = SN.arrange(open.length, screenArea(), { w: 300, h: 300 }, 8)[i];
    try { window.resizeTo(300, 300); window.moveTo(slot.x, slot.y); } catch (e) {}
    lastPos = [slot.x, slot.y].join(); movedOnce = false;
    setTimeout(deskSaveGeo, 200);
  }
  var deskShrunk = null;                 // while one note is kept on top, its own window shrinks to a small bar
  function noteEditor(n, ta, onChange) {   // typing → saved half a second later (shared by note windows and the on-top window)
    ta.addEventListener('input', function () {
      clearTimeout(deskTimer);
      deskPending = function () { if (n.text !== ta.value) { n.text = ta.value; n.updated = Date.now(); markNote(n); saveNotes(); } if (onChange) onChange(); };
      deskTimer = setTimeout(deskFlush, 500);
    });
  }
  var deskSig = '';
  function noteSig(n) { return [n.color, n.font, n.size, n.locked, n.list].join('|'); }
  function renderDesk() {
    app.textContent = '';
    var n = deskNote();
    document.documentElement.className = 'desk-mode';
    if (!n) {
      document.title = t('desk.gone');
      add(app, h('div', { class: 'desk-gone' }, h('p', { text: t('desk.gone') }),
        h('button', { type: 'button', class: 'btn', on: { click: function () { deskForget(DESK); window.close(); } } }, t('btn.close'))));
      return;
    }
    document.documentElement.classList.add('nc-' + n.color);
    deskSig = noteSig(n);
    if (lastPos === null) lastPos = [window.screenX, window.screenY].join();   // where the window starts; snapping waits for a real move
    function setTitle() { document.title = n.locked && !noteShown[n.id] ? '🔒 ' + t('notes.lockedCard') : (n.text.trim().split('\n')[0] || t('notes.ph')).slice(0, 60); }
    setTitle();
    if (pipId === n.id && pipWin) {
      add(app, h('div', { class: 'desk-pinned' }, h('span', { text: '📌 ' + t('desk.pinnedBar') }),
        h('button', { type: 'button', class: 'btn small', id: 'desk-unpin', on: { click: function () { pipClose(); render(); } } }, t('desk.unpin'))));
      return;
    }
    if (n.locked && !noteShown[n.id]) {
      deskTa = null;
      add(app, h('div', { class: 'desk' }, h('div', { class: 'desk-bar' }, h('span', { class: 'desk-sp' }),
        h('button', { type: 'button', class: 'icon-btn sm', id: 'desk-lock', title: t('desk.lock'), 'aria-label': t('desk.lock'), on: { click: function () { lockNow(false); } } }, icon('lock', 18))),
        h('div', { class: 'desk-gate' }, notePassForm(function () { noteShown[n.id] = 1; render(); }))));
      return;
    }
    if (n.list) { deskTa = checklistEditor(n, setTitle); deskTa.id = 'desk-text'; deskTa.className = 'checklist desk-list font-' + n.font + ' nsz-' + n.size; }
    else { deskTa = h('textarea', { class: 'desk-text font-' + n.font + ' nsz-' + n.size, id: 'desk-text', placeholder: t('notes.ph'), 'aria-label': t('notes.title'), value: n.text }); noteEditor(n, deskTa, setTitle); }
    var dots = h('div', { class: 'desk-dots', role: 'radiogroup', 'aria-label': t('notes.color') });
    NOTE_COLORS.forEach(function (c) {
      add(dots, h('button', { type: 'button', role: 'radio', class: 'desk-dot nc-' + c, 'aria-checked': n.color === c ? 'true' : 'false', 'aria-label': t('color.' + c), title: t('color.' + c), 'data-color': c,
        on: { click: function () { deskFlush(); n.color = c; n.updated = Date.now(); markNote(n); saveNotes(); render(); } } }));
    });
    var bar = h('div', { class: 'desk-bar' }, dots,
      h('span', { class: 'desk-sp' }),
      h('button', { type: 'button', class: 'icon-btn sm', id: 'desk-new', title: t('desk.new'), 'aria-label': t('desk.new'), on: { click: function () {
        var nn = { id: B.uid(), text: '', color: n.color, pinned: false, created: Date.now(), updated: Date.now() };
        S.notes.notes.push(nn); markNote(nn);
        saveNotes().then(function () { deskOpen(nn.id, [window.screenX + 30, window.screenY + 30, window.innerWidth, window.innerHeight]); });
      } } }, icon('plus', 18)),
      pipCapable() ? h('button', { type: 'button', class: 'icon-btn sm', id: 'desk-pip', title: t('desk.pin'), 'aria-label': t('desk.pin'), on: { click: function () { deskFlush(); pinOnTop(n.id); } } }, icon('pin', 18)) : null,
      h('button', { type: 'button', class: 'icon-btn sm', id: 'desk-back', title: t('desk.back'), 'aria-label': t('desk.back'), on: { click: function () {
        deskFlush(); deskForget(n.id);
        if (!n.text.trim()) { S.notes.notes = S.notes.notes.filter(function (x) { return x !== n; }); goneNote(n); }
        saveNotes().then(function () { window.close(); });
      } } }, icon('list', 18)),
      n.locked ? h('button', { type: 'button', class: 'icon-btn sm', id: 'desk-hide', title: t('notes.hide'), 'aria-label': t('notes.hide'), on: { click: function () { deskFlush(); delete noteShown[n.id]; render(); } } }, '🙈') : null,
      h('button', { type: 'button', class: 'icon-btn sm', id: 'desk-lock', title: t('desk.lock'), 'aria-label': t('desk.lock'), on: { click: function () { lockNow(false); } } }, icon('lock', 18)));
    add(app, h('div', { class: 'desk' }, bar, deskTa));
    if (!n.text) deskTa.focus();
  }
  function deskRefresh() {         // another window changed the notes
    if (!DESK || S.phase !== 'app') return;
    var n = deskNote();
    if (!n || noteSig(n) !== deskSig || !deskTa || !document.contains(deskTa)) { deskFlush(); render(); return; }
    if (deskTa.refresh) deskTa.refresh(); else if (!deskPending && deskTa.value !== n.text) deskTa.value = n.text;
    pipRefresh();
  }

  // ----- keep one note on top of every other window (Document Picture-in-Picture: Chrome and Edge on a computer) -----
  function pinOnTop(id) {
    var n = S.notes && S.notes.notes.find(function (x) { return x.id === id; });
    if (!n || !pipCapable()) return;
    pipClose();
    window.documentPictureInPicture.requestWindow({ width: 300, height: 280 }).then(function (pw) {
      pipWin = pw; pipId = id;
      var d = pw.document;
      var css = d.createElement('link'); css.rel = 'stylesheet'; css.href = location.origin + '/vault.css'; d.head.appendChild(css);
      d.documentElement.lang = I.get();
      var th = document.documentElement.getAttribute('data-theme'); if (th) d.documentElement.setAttribute('data-theme', th);
      d.documentElement.className = 'desk-mode nc-' + n.color;
      d.title = (n.text.trim().split('\n')[0] || t('notes.ph')).slice(0, 60);
      if (n.list) { pipTa = checklistEditor(n); pipTa.id = 'pip-text'; pipTa.className = 'checklist desk-list font-' + n.font + ' nsz-' + n.size; }
      else { pipTa = h('textarea', { class: 'desk-text font-' + n.font + ' nsz-' + n.size, id: 'pip-text', placeholder: t('notes.ph'), 'aria-label': t('notes.title'), value: n.text }); noteEditor(n, pipTa); }
      d.body.appendChild(h('div', { class: 'desk' },
        h('div', { class: 'desk-bar pip-bar' }, h('span', { class: 'desk-sp' }),
          h('button', { type: 'button', class: 'icon-btn sm', id: 'pip-unpin', title: t('desk.unpin'), 'aria-label': t('desk.unpin'), on: { click: function () { pipClose(); if (DESK && S.phase === 'app') render(); } } }, '📌')),
        pipTa));
      pw.addEventListener('pagehide', function () { deskFlush(); if (pipWin === pw) { pipWin = null; pipId = null; pipTa = null; deskRestore(); if (DESK && S.phase === 'app') render(); } });
      if (DESK) {
        deskSaveGeo();
        deskShrunk = [window.outerWidth, window.outerHeight];
        try { window.resizeTo(Math.min(window.outerWidth, 300), 96); } catch (e) {}
        render();
      } else toast(t('desk.pinned'));
    }).catch(function () {});
  }
  function pipRefresh() {
    if (!pipWin || !pipTa) return;
    var n = S.notes && S.notes.notes.find(function (x) { return x.id === pipId; });
    if (!n) { pipClose(); return; }
    if (pipTa.refresh) pipTa.refresh(); else if (!deskPending && pipTa.value !== n.text) pipTa.value = n.text;
    pipWin.document.documentElement.className = 'desk-mode nc-' + n.color;
  }
  function pipClose() { if (pipWin) { deskFlush(); try { pipWin.close(); } catch (e) {} pipWin = null; pipId = null; pipTa = null; deskRestore(); } }
  function deskRestore() { if (deskShrunk) { var s = deskShrunk; deskShrunk = null; try { window.resizeTo(s[0], s[1]); } catch (e) {} } }

  // ----- Diary tab -----
  var MOODS = ['😞', '😕', '😐', '🙂', '😄'];
  var photoUrls = {};                        // photo id -> temporary address of the decrypted picture (dropped on lock)
  function moodEmoji(m) { return m ? MOODS[Math.round(m) - 1] : ''; }
  function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dropPhotoUrls() { Object.keys(photoUrls).forEach(function (k) { try { URL.revokeObjectURL(photoUrls[k]); } catch (e) {} }); photoUrls = {}; }
  function photoUrl(id) {
    if (photoUrls[id]) return Promise.resolve(photoUrls[id]);
    return C.getBlob(id).then(function (b) {
      if (!b) return null;
      photoUrls[id] = URL.createObjectURL(new Blob([b.bytes], { type: b.type }));
      return photoUrls[id];
    });
  }
  // Phone photos are large: shrink to at most 1600 px and re-save as JPEG before encrypting.
  function shrinkPhoto(file) {
    function draw(src, w, h) {
      var scale = Math.min(1, 1600 / Math.max(w, h)), cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.drawImage(src, 0, 0, cw, ch);
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('encode')); }, 'image/jpeg', 0.82); });
    }
    var p = window.createImageBitmap
      ? createImageBitmap(file).then(function (bm) { return draw(bm, bm.width, bm.height).then(function (b) { if (bm.close) bm.close(); return b; }); })
      : new Promise(function (res, rej) {
          var url = URL.createObjectURL(file), img = new Image();
          img.onload = function () { URL.revokeObjectURL(url); draw(img, img.naturalWidth, img.naturalHeight).then(res, rej); };
          img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('decode')); };
          img.src = url;
        });
    return p.then(function (b) { return b.arrayBuffer(); }).then(function (buf) { return new Uint8Array(buf); });
  }
  function cleanupPhotos() {                 // pictures no entry points at any more (deleted entries, removed photos)
    var used = {};
    S.diary.entries.forEach(function (e) { DY.blobsOf(e).forEach(function (p) { used[p] = true; }); });
    S.notes.notes.forEach(function (n) { (n.photos || []).forEach(function (p) { used[p] = true; }); });
    B.photosOf(S.budget).forEach(function (p) { used[p] = true; });
    return C.blobIds().then(function (ids) { return Promise.all(ids.filter(function (id) { return !used[id]; }).map(function (id) { return C.deleteBlob(id); })); }).catch(function () {});
  }
  function saveDiary() { return save('diary', function () { return S.diary; }); }

  function renderDiary(main) {
    if (S.diarySearch) return renderDiarySearch(main);
    var ym = S.diaryYm, todayS = today();
    var nav = h('div', { class: 'month-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('month.prev'), id: 'diary-prev', on: { click: function () { S.diaryYm = B.addMonths(S.diaryYm, -1); render(); } } }, icon('left')),
      h('h1', { class: 'month', id: 'diary-month', text: I.monthLabel(ym) }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('month.next'), id: 'diary-next', on: { click: function () { S.diaryYm = B.addMonths(S.diaryYm, 1); render(); } } }, icon('right')));
    add(main, topBar(nav, h('button', { type: 'button', class: 'icon-btn', id: 'diary-search-btn', 'aria-label': t('top.search'), title: t('top.search'), on: { click: function () { S.diarySearch = true; render(); } } }, icon('search'))));
    if (ym !== thisMonth()) add(main, h('button', { type: 'button', class: 'link today-link', text: t('month.today'), on: { click: function () { S.diaryYm = thisMonth(); render(); } } }));

    var streak = DY.streak(S.diary, todayS), st = DY.monthStats(S.diary, ym);
    add(main, h('section', { class: 'card diary-sum' },
      h('div', { class: 'streak', id: 'diary-streak' }, h('span', { class: 'streak-ico', 'aria-hidden': 'true', text: streak ? '🔥' : '✏️' }),
        h('strong', { text: streak ? t('diary.streak', { n: streak }) : t('diary.streak0') })),
      h('p', { class: 'hint', id: 'diary-stats', text: t('diary.stats', { n: st.count }) + (st.avgMood ? ' · ' + t('diary.avgMood') + ' ' + moodEmoji(st.avgMood) : '') })),
      helperCards('diary'));

    var otd = DY.onThisDay(S.diary, todayS);
    if (otd.length && ym === thisMonth()) {
      add(main, h('section', { class: 'card otd', id: 'on-this-day' }, h('h2', { text: '📅 ' + t('diary.onThisDay') }),
        h('ul', { class: 'tx' }, otd.slice(0, 3).map(function (e) {
          var yrs = +todayS.slice(0, 4) - +e.date.slice(0, 4);
          return h('li', {}, h('button', { type: 'button', class: 'tx-row', on: { click: function () { openEntry(e.id); } } },
            h('span', { class: 'emoji', 'aria-hidden': 'true', text: moodEmoji(e.mood) || '📔' }),
            h('span', { class: 'tx-main' }, h('span', { class: 'tx-cat', text: t('diary.yearsAgo', { n: yrs }) }), h('span', { class: 'tx-note', text: firstLine(e) }))));
        }))));
    }
    if (!DY.byDate(S.diary, todayS).length && ym === thisMonth()) {
      var q = t('diary.prompt.' + DY.promptIndex(todayS));
      add(main, h('aside', { class: 'card notice', id: 'diary-prompt' }, h('span', { class: 'notice-ico', 'aria-hidden': 'true', text: '💭' }),
        h('div', { class: 'notice-text' }, h('strong', { text: t('diary.prompt') }), h('p', { text: q }),
          h('div', { class: 'notice-actions' }, h('button', { type: 'button', class: 'btn small', id: 'diary-prompt-write', text: t('diary.write'), on: { click: function () { newEntry(todayS, q); } } })))));
    }
    add(main, h('div', { class: 'seg', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', 'aria-selected': S.diaryView === 'list' ? 'true' : 'false', class: S.diaryView === 'list' ? 'on' : '', id: 'diary-view-list', text: t('view.list'), on: { click: function () { S.diaryView = 'list'; render(); } } }),
      h('button', { type: 'button', role: 'tab', 'aria-selected': S.diaryView === 'calendar' ? 'true' : 'false', class: S.diaryView === 'calendar' ? 'on' : '', id: 'diary-view-cal', text: t('view.calendar'), on: { click: function () { S.diaryView = 'calendar'; render(); } } })));
    if (S.diaryView === 'calendar') add(main, calendar(ym));
    else {
      var list = DY.byMonth(S.diary, ym);
      if (!list.length) add(main, empty('📔', t('diary.empty'), t('diary.emptyHint')));
      else {
        var days = []; list.forEach(function (e) { var d = days[days.length - 1]; if (!d || d.date !== e.date) days.push(d = { date: e.date, items: [] }); d.items.push(e); });
        add(main, h('div', { class: 'days', id: 'diary-list' }, days.map(function (d) {
          return h('section', { class: 'day' }, h('h3', { class: 'day-head' }, h('span', { text: I.dayLabel(d.date) })), h('ul', { class: 'tx' }, d.items.map(entryRow)));
        })));
      }
    }
    if (S.diary.entries.some(function (e) { return e.date.slice(0, 7) === ym && DY.hasContent(e); })) add(main, h('button', { type: 'button', class: 'link center-link', id: 'diary-print-link', text: '🖨️ ' + t('pr.thisMonth'), on: { click: function () { openDiaryPrint(ym); } } }));
    add(main, fab(t('diary.new'), function () { newEntry(ym === thisMonth() ? todayS : ym + '-01'); }, 'new-entry'));
  }
  function firstLine(e) { var s = e.text.trim().split('\n')[0]; return s || (e.photos.length ? '📷' : ''); }
  function entryRow(e) {
    return h('li', {}, h('button', { type: 'button', class: 'tx-row entry-row' + (e.deco && e.deco.tint !== 'none' ? ' tint-' + e.deco.tint : ''), 'data-id': e.id, on: { click: function () { openEntry(e.id); } } },
      h('span', { class: 'emoji', 'aria-hidden': 'true', text: moodEmoji(e.mood) || '📔' }),
      h('span', { class: 'tx-main' },
        h('span', { class: 'entry-text', text: e.text.trim().slice(0, 140) || DY.tplText(e, ' · ').slice(0, 140) || (e.photos.length ? '📷' : '') }),
        e.tags.length ? h('span', { class: 'entry-tags', text: e.tags.map(function (x) { return '#' + x; }).join(' ') }) : null),
      h('span', { class: 'entry-meta' }, DC.preview(e, h), e.time ? h('span', { text: e.time }) : null, e.photos.length ? h('span', { text: '📷 ' + e.photos.length }) : null)));
  }
  function calendar(ym) {
    var first = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1)).getUTCDay(), n = B.daysInMonth(ym), moods = DY.moodByDay(S.diary, ym);
    var counts = {}; DY.byMonth(S.diary, ym).forEach(function (e) { counts[e.date] = (counts[e.date] || 0) + 1; });
    var fmt = new Intl.DateTimeFormat(I.locale(), { weekday: 'narrow', timeZone: 'UTC' });
    var grid = h('div', { class: 'cal', id: 'diary-cal', role: 'grid', 'aria-label': I.monthLabel(ym) });
    for (var w = 0; w < 7; w++) add(grid, h('span', { class: 'cal-wd', 'aria-hidden': 'true', text: fmt.format(new Date(Date.UTC(2026, 10, 1 + w))) }));   // Nov 1 2026 is a Sunday
    for (var b = 0; b < first; b++) add(grid, h('span', { class: 'cal-empty' }));
    for (var d = 1; d <= n; d++) (function (d) {
      var date = ym + '-' + pad(d), c = counts[date] || 0;
      add(grid, h('button', { type: 'button', class: 'cal-day' + (c ? ' has' : '') + (date === today() ? ' today' : ''), 'data-date': date,
        'aria-label': I.fullDate(date) + (c ? ', ' + t('diary.dayEntries', { n: c }) : ''),
        on: { click: function () { var list = DY.byDate(S.diary, date); if (list.length === 1) openEntry(list[0].id); else if (list.length) openDay(date); else newEntry(date); } } },
        h('span', { class: 'cal-num', text: String(d) }), h('span', { class: 'cal-mood', 'aria-hidden': 'true', text: moods[date] ? moodEmoji(moods[date]) : (c ? '•' : '') })));
    })(d);
    return h('section', { class: 'card' }, grid);
  }
  function openDay(date) {
    sheet(I.fullDate(date), function (body, close) {
      add(body, h('ul', { class: 'tx' }, DY.byDate(S.diary, date).map(function (e) { var r = entryRow(e); r.firstChild.addEventListener('click', close); return r; })),
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn primary', text: t('diary.new'), on: { click: function () { close(); newEntry(date); } } })));
    });
  }
  function renderDiarySearch(main) {
    var input = h('input', { type: 'search', class: 'input', id: 'diary-search-input', placeholder: t('diary.searchPh'), value: S.diaryQuery, 'aria-label': t('top.search') });
    var results = h('div', { id: 'diary-search-results' });
    function draw() {
      results.textContent = '';
      if (!S.diaryQuery.trim()) {
        var tags = DY.allTags(S.diary).slice(0, 20);
        if (tags.length) add(results, h('p', { class: 'hint', text: t('diary.tagsHint') }), h('div', { class: 'chips wrap' }, tags.map(function (x) {
          return h('button', { type: 'button', class: 'chip', on: { click: function () { input.value = S.diaryQuery = '#' + x.tag; draw(); } } }, '#' + x.tag + ' · ' + x.count);
        })));
        return;
      }
      var list = DY.search(S.diary, S.diaryQuery);
      if (!list.length) return add(results, h('p', { class: 'hint center', text: t('search.none') }));
      add(results, h('p', { class: 'hint', text: t('search.count', { n: list.length }) }), h('ul', { class: 'tx' }, list.slice(0, 300).map(function (e) {
        var r = entryRow(e); r.firstChild.insertBefore(h('span', { class: 'tx-date', text: I.fullDate(e.date) }), r.firstChild.querySelector('.entry-meta')); return r;
      })));
    }
    input.addEventListener('input', function () { S.diaryQuery = input.value; draw(); });
    add(main, topBar(h('div', { class: 'search-bar' }, input,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('btn.close'), id: 'diary-search-close', on: { click: function () { S.diarySearch = false; S.diaryQuery = ''; render(); } } }, icon('x')))), results);
    draw();
    setTimeout(function () { input.focus(); }, 0);
  }
  function newEntry(date, prompt) {
    var e = DY.addEntry(S.diary, { date: date, time: date === today() ? nowTime() : '', text: '' });
    openEntry(e.id, { isNew: true, prompt: prompt });
  }
  var entryTimer = null, entryFlush = null, openDeco = null;
  function flushEntry() { if (entryFlush) { var f = entryFlush; entryFlush = null; clearTimeout(entryTimer); f(); } }
  function openEntry(id, opts) {
    opts = opts || {};
    var e = S.diary.entries.find(function (x) { return x.id === id; });
    if (!e) return;
    var deleted = false;
    sheet(opts.isNew ? t('diary.new') : I.fullDate(e.date), function (body, close, m) {
      var date = h('input', { type: 'date', class: 'input', id: 'entry-date', value: e.date });
      var time = h('input', { type: 'time', class: 'input', id: 'entry-time', value: e.time });
      date.addEventListener('change', function () { if (B.validDate(date.value)) { DY.updateEntry(S.diary, e.id, { date: date.value }); saveDiary(); } });
      time.addEventListener('change', function () { DY.updateEntry(S.diary, e.id, { time: time.value }); saveDiary(); });
      var moods = h('div', { class: 'moods', role: 'radiogroup', 'aria-label': t('diary.mood') });
      function drawMoods() {
        moods.textContent = '';
        MOODS.forEach(function (em, i) {
          var v = i + 1;
          add(moods, h('button', { type: 'button', role: 'radio', class: 'mood' + (e.mood === v ? ' on' : ''), 'aria-checked': e.mood === v ? 'true' : 'false', 'aria-label': t('mood.' + v), title: t('mood.' + v), 'data-mood': v,
            on: { click: function () { DY.updateEntry(S.diary, e.id, { mood: e.mood === v ? null : v }); drawMoods(); saveDiary(); } } }, em));
        });
      }
      drawMoods();
      var ta = h('textarea', { class: 'entry-edit', id: 'entry-text', rows: 6, placeholder: opts.prompt || t('diary.ph'), 'aria-label': t('diary.title'), 'data-autofocus': '1', value: e.text });
      ta.addEventListener('input', function () { if (ta.value.trim()) helperDone('diary', e.id); });
      var page = h('div', { class: 'page', id: 'entry-page' }, ta);
      function growText() { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight + 2, 168) + 'px'; }
      ta.addEventListener('input', growText); setTimeout(growText, 0);
      var dmsg = msgEl();
      var deco = DC.attach({ h: h, add: add, icon: icon, t: t, I: I, DY: DY, entry: e, page: page, ta: ta,
        commit: function (d) { if (!S.diary) return; DY.updateEntry(S.diary, e.id, { deco: d }); saveDiary(); },
        blobUrl: photoUrl, putBlob: C.putBlob, uid: DY.uid, toast: toast, status: function (msg, err) { setMsg(dmsg, msg, !err); } });
      openDeco = deco;
      var tagLine = h('p', { class: 'hint entry-tagline', id: 'entry-tags' });
      function drawTags() { var tg = DY.tagsOf(ta.value); tagLine.textContent = tg.length ? tg.map(function (x) { return '#' + x; }).join(' ') : t('diary.tagsTip'); }
      function persist() { entryFlush = null; if (e.text !== ta.value) DY.updateEntry(S.diary, e.id, { text: ta.value }); saveDiary(); }
      ta.addEventListener('input', function () { drawTags(); clearTimeout(entryTimer); entryFlush = persist; entryTimer = setTimeout(flushEntry, 600); });
      drawTags();
      var photos = h('div', { class: 'photos', id: 'entry-photos' });
      var pmsg = msgEl();
      var file = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'entry-photo-input', class: 'sr', 'aria-label': t('diary.addPhoto') });
      function drawPhotos() {
        photos.textContent = '';
        e.photos.forEach(function (pid) {
          var img = h('img', { alt: t('diary.photoAlt'), class: 'photo-thumb' });
          photoUrl(pid).then(function (u) { if (u) img.src = u; }).catch(function () { img.alt = t('err.corrupt'); });
          add(photos, h('div', { class: 'photo' },
            h('button', { type: 'button', class: 'photo-open', 'aria-label': t('diary.photoAlt'), on: { click: function () { viewPhoto(pid); } } }, img),
            h('button', { type: 'button', class: 'photo-x', 'aria-label': t('diary.removePhoto'), on: { click: function () {
              DY.updateEntry(S.diary, e.id, { photos: e.photos.filter(function (x) { return x !== pid; }) }); saveDiary(); drawPhotos();
            } } }, icon('x', 16))));
        });
        if (e.photos.length < DY.MAX_PHOTOS) add(photos, h('label', { for: 'entry-photo-input', class: 'photo-add', id: 'entry-photo-add' }, h('span', { 'aria-hidden': 'true', text: '📷' }), h('span', { text: t('diary.addPhoto') })));
      }
      file.addEventListener('change', function () {
        var files = Array.from(file.files || []).slice(0, DY.MAX_PHOTOS - e.photos.length);
        if ((file.files || []).length > files.length) setMsg(pmsg, t('diary.photoLimit', { n: DY.MAX_PHOTOS }));
        else setMsg(pmsg, t('diary.processing'), true);
        files.reduce(function (p, f) {
          return p.then(function () {
            return shrinkPhoto(f).then(function (bytes) {
              var pid = 'p' + DY.uid();
              return C.putBlob(pid, bytes, 'image/jpeg').then(function () { DY.updateEntry(S.diary, e.id, { photos: e.photos.concat([pid]) }); drawPhotos(); return saveDiary(); });
            });
          });
        }, Promise.resolve()).then(function () { if (pmsg.classList.contains('ok')) setMsg(pmsg, ''); }, function () { setMsg(pmsg, t('diary.photoErr')); });
        file.value = '';
      });
      drawPhotos();
      var del = h('button', { type: 'button', class: 'btn danger', id: 'entry-delete' }, icon('trash', 18), ' ', t('btn.delete'));
      del.addEventListener('click', function () {
        deleted = true; entryFlush = null; clearTimeout(entryTimer);
        if (e.text !== ta.value) DY.updateEntry(S.diary, e.id, { text: ta.value });
        var removed = DY.deleteEntry(S.diary, e.id); saveDiary(); close(); render();
        toast(t('diary.deleted'), { label: t('btn.undo'), fn: function () { S.diary.entries.push(removed); saveDiary(); render(); } });
      });
      add(body, h('div', { class: 'two' }, field(t('add.date'), date), field(t('diary.time'), time)),
        h('p', { class: 'field-label', text: t('diary.mood') }), moods, deco.bar, deco.panel, dmsg, page, tagLine, photos, file, pmsg, h('div', { class: 'row end' }, del));
      m.onClose = function () {
        if (openDeco === deco) openDeco = null;
        if (deleted) return;
        flushEntry();
        if (S.diary && e.text !== ta.value) DY.updateEntry(S.diary, e.id, { text: ta.value });
        deco.flush().then(function () {
          if (!S.diary) return;
          if (!DY.hasContent(e)) S.diary.entries = S.diary.entries.filter(function (x) { return x !== e; });
          saveDiary(); if (!modalOpen()) render();
        });
      };
    }, { wide: true });
  }
  function viewPhoto(pid) {
    sheet(t('diary.photoAlt'), function (body) {
      var img = h('img', { alt: t('diary.photoAlt'), class: 'photo-full', id: 'photo-full' });
      photoUrl(pid).then(function (u) { if (u) img.src = u; });
      add(body, img);
    }, { wide: true });
  }
  // ----- the diary as a printable book (the browser's print dialog also saves it as a PDF) -----
  var PRINT_W = 640;                        // page width in CSS pixels; stickers are placed relative to it, as in the app
  function entriesFor(range, ym) {
    var list = S.diary.entries.filter(function (e) {
      return range === 'all' || (range === 'year' ? e.date.slice(0, 4) === ym.slice(0, 4) : e.date.slice(0, 7) === ym);
    }).filter(function (e) { return DY.hasContent(e); });
    return list.sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; });
  }
  function buildPrint(list, photos) {
    var old = document.getElementById('print-root'); if (old) old.remove();
    var root = h('div', { id: 'print-root', class: 'print-root', 'aria-hidden': 'true' }), waits = [];
    var wd = new Intl.DateTimeFormat(I.locale ? I.locale() : I.get(), { weekday: 'long', timeZone: 'UTC' });
    var lastYm = '';
    list.forEach(function (e) {
      if (e.date.slice(0, 7) !== lastYm) { lastYm = e.date.slice(0, 7); add(root, h('h1', { class: 'pr-month', text: I.monthLabel(lastYm) })); }
      var dt = new Date(Date.UTC(+e.date.slice(0, 4), +e.date.slice(5, 7) - 1, +e.date.slice(8, 10)));
      var art = h('article', { class: 'pr-entry' },
        h('h2', { class: 'pr-date' }, e.date + ' · ' + wd.format(dt) + (e.time ? ' · ' + e.time : '') + (e.mood ? ' ' : ''), e.mood ? h('span', { class: 'pr-mood', text: moodEmoji(e.mood) }) : null));
      var dc = e.deco || null;
      var page = h('div', { class: 'page pr-page ' + (dc ? 'paper-' + dc.paper + ' tint-' + dc.tint + ' font-' + dc.font : 'paper-plain tint-none font-base') });
      page.style.width = PRINT_W + 'px';
      if (dc && dc.drawing) {
        var di = h('img', { class: 'draw-img', alt: '' }); add(page, di);
        page.style.minHeight = Math.round(dc.drawing.ar * PRINT_W) + 'px';          // the page is as tall as the drawing, as in the app
        waits.push(photoUrl(dc.drawing.id).then(function (u) { return u && loadImg(di, u); }).catch(function () {}));
      }
      add(page, h('div', { class: 'pr-text', text: e.text }));
      var tp = DY.tplText(e, '\n'); if (tp) add(page, h('div', { class: 'pr-tpl', text: tp }));
      if (dc && dc.stickers.length) {
        var layer = h('div', { class: 'st-layer' }), need = 0;
        dc.stickers.forEach(function (st) {
          var el = ST.element(st.k); if (!el) return;
          var tape = st.k.charAt(0) === 't', size = st.s * PRINT_W;
          var box = h('div', { class: 'sticker' + (tape ? ' tape' : '') }, el);
          box.style.width = size + 'px'; box.style.height = (tape ? size / 4 : size) + 'px';
          box.style.left = (st.x * PRINT_W - size / 2) + 'px'; box.style.top = (st.y * PRINT_W - (tape ? size / 8 : size / 2)) + 'px';
          box.style.transform = 'rotate(' + st.r + 'deg)';
          if (st.k.charAt(0) === 'e') box.style.fontSize = (size * 0.82) + 'px';
          add(layer, box); need = Math.max(need, (st.y + st.s / 2) * PRINT_W + 8);
        });
        add(page, layer); if (need > (parseInt(page.style.minHeight, 10) || 0)) page.style.minHeight = need + 'px';
      }
      add(art, page);
      if (photos && e.photos.length) {
        var grid = h('div', { class: 'pr-photos' });
        e.photos.forEach(function (pid) {
          var img = h('img', { alt: '' }); add(grid, img);
          waits.push(photoUrl(pid).then(function (u) { return u && loadImg(img, u); }).catch(function () {}));
        });
        add(art, grid);
      }
      add(root, art);
    });
    document.body.appendChild(root);
    return Promise.all(waits).then(function () { return root; });
  }
  function loadImg(img, url) { return new Promise(function (res) { img.onload = img.onerror = function () { res(); }; img.src = url; }); }
  function openDiaryPrint(ymStart) {
    sheet(t('pr.title'), function (body, close) {
      var range = h('select', { class: 'input', id: 'pr-range' },
        h('option', { value: 'month', text: t('pr.month') }), h('option', { value: 'year', text: t('pr.year') }), h('option', { value: 'all', text: t('pr.all') }));
      var month = h('input', { type: 'month', class: 'input', id: 'pr-ym', value: ymStart || S.diaryYm || thisMonth() });
      var photos = h('input', { type: 'checkbox', id: 'pr-photos', checked: true });
      var count = h('p', { class: 'hint', id: 'pr-count' }), msg = msgEl();
      function ym() { return /^\d{4}-\d{2}$/.test(month.value) ? month.value : thisMonth(); }
      function upd() { month.parentNode.hidden = range.value === 'all'; count.textContent = t('pr.count', { n: entriesFor(range.value, ym()).length }); }
      var go = h('button', { type: 'button', class: 'btn primary block', id: 'pr-go', text: t('pr.go'), on: { click: function () {
        var list = entriesFor(range.value, ym());
        if (!list.length) return setMsg(msg, t('pr.none'));
        go.disabled = true; setMsg(msg, t('pr.preparing'), true);
        buildPrint(list, photos.checked).then(function () {
          go.disabled = false; setMsg(msg, ''); close();
          var done = function () { window.removeEventListener('afterprint', done); var r = document.getElementById('print-root'); if (r && !window.__keepPrint) r.remove(); };
          window.addEventListener('afterprint', done);
          setTimeout(function () { window.print(); }, 50);
        });
      } } });
      range.addEventListener('change', upd); month.addEventListener('change', upd);
      var mf = field(t('pr.which'), month);
      add(body, h('p', { text: t('pr.body') }), field(t('pr.range'), range), mf,
        h('div', { class: 'check' }, photos, h('label', { for: 'pr-photos', text: t('pr.photos') })), count, go, msg, h('p', { class: 'hint', text: t('pr.hint') }));
      upd();
    });
  }

  function openDiaryExport() {
    sheet(t('diary.exportTitle'), function (body) {
      add(body, h('p', { class: 'msg', text: t('diary.exportWarn') }),
        h('button', { type: 'button', class: 'btn primary block', id: 'diary-export-go', text: t('diary.exportGo'), on: { click: function () {
          download('﻿' + DY.toText(S.diary, { mood: function (m) { return moodEmoji(m) + ' ' + t('mood.' + m); }, photos: function (n) { return t('diary.photoCount', { n: n }); } }),
            'poppopmake-diary-' + today() + '.txt', 'text/plain;charset=utf-8');
        } } }));
    });
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
    var pkRow = h('li', { id: 'pk-row-wrap', hidden: true });
    Promise.all([pkCheck(), C.passkeyEnrolled()]).then(function (r) {
      if (!r[0] || !document.contains(pkRow)) return;
      pkRow.hidden = false;
      add(pkRow, h('button', { type: 'button', class: 'set-row', id: 'set-passkey', on: { click: openPasskey } },
        h('span', { class: 'set-label', text: t('pk.title') }), h('span', { class: 'set-value', text: r[1] ? t('pk.stateOn') : t('pk.stateOff') }), icon('chev', 18)));
      if (r[1]) add(pkRow, h('label', { class: 'check set-sub' }, h('input', { type: 'checkbox', id: 'set-pk-auto', checked: lsGet(PK_AUTO_KEY) !== 'off',
        on: { change: function (e) { lsSet(PK_AUTO_KEY, e.target.checked ? null : 'off'); } } }), h('span', { text: t('pk.auto') })));
    });
    add(main, topBar(h('h1', { class: 'title', text: t('set.title') })));
    var cur = currencySelect(S.budget.currency); cur.id = 'set-currency';
    cur.addEventListener('change', function () { S.budget.currency = cur.value; saveBudget(); render(); });
    var theme = h('select', { class: 'input', id: 'set-theme' });
    ['auto', 'light', 'dark'].forEach(function (x) { add(theme, h('option', { value: x, text: t('theme.' + x) })); });
    theme.value = lsGet(THEME_KEY) || 'auto';
    theme.addEventListener('change', function () { lsSet(THEME_KEY, theme.value === 'auto' ? null : theme.value); applyTheme(); });
    var lock = h('select', { class: 'input', id: 'set-autolock' });
    [1, 5, 15, 60, 0].forEach(function (m) { add(lock, h('option', { value: m, text: t('min.' + m) })); });
    lock.value = String(S.settings.autoLock);
    var lockWarn = h('p', { class: 'msg', id: 'lock-never-warn', text: t('set.lockNeverWarn'), hidden: !!S.settings.autoLock });
    lock.addEventListener('change', function () { S.settings.autoLock = +lock.value; lockWarn.hidden = !!S.settings.autoLock; saveSettings(); });
    var lang = langSelect(render); lang.id = 'set-lang';
    var storage = h('span', { class: 'set-value', id: 'storage-state', text: '…' });
    C.persisted().then(function (p) { storage.textContent = p ? t('set.storageOn') : t('set.storageOff'); });

    add(main,
      group(t('set.general'), [ctrlRow(t('lang.label'), lang), ctrlRow(t('cur.label'), cur, t('set.curNote')), ctrlRow(t('set.theme'), theme)]),
      group(t('set.budget'), [
        row(t('set.monthly'), S.budget.budgets.total ? money(S.budget.budgets.total) : t('set.monthlyNone'), openMonthlyBudget, 'set-monthly'),
        row(t('set.catBudgets'), null, openCatBudgets, 'set-catbudgets'),
        row(t('set.categories'), null, openCategories, 'set-categories'),
        row(t('set.recurring'), String(S.budget.recurring.length), openRecurring, 'set-recurring'),
        row(t('pm.title'), (S.budget.methods || []).length ? String(S.budget.methods.length) : t('pm.off'), openMethods, 'set-methods')]),
      group(t('set.security'), [
        h('li', { class: 'set-ctrl' }, h('label', { for: 'set-autolock', text: t('set.autolock') }), lock, lockWarn),
        row(t('set.changePass'), null, openChangePass, 'set-pass'),
        row(t('set.newCode'), null, openNewCode, 'set-code'),
        row(t('set.recHelp'), null, function () { openRecHelp(false); }, 'set-rechelp'),
        pkRow,
        h('li', { class: 'set-ctrl' }, h('button', { type: 'button', class: 'set-row', on: { click: function () { C.persist().then(function (p) { storage.textContent = p ? t('set.storageOn') : t('set.storageOff'); }); } } },
          h('span', { class: 'set-label', text: t('set.storage') }), storage))]),
      group(t('set.diary'), [row(t('pr.title'), null, function () { openDiaryPrint(); }, 'set-diary-print'), row(t('diary.exportTitle'), String(S.diary.entries.length), openDiaryExport, 'set-diary-export')]),
      group(t('set.data'), [
        row(t('set.backup'), S.settings.lastBackup ? t('set.lastBackup', { when: I.ago(S.settings.lastBackup) }) : t('set.neverBackup'), openBackup, 'set-backup'),
        row(t('set.restore'), null, openRestore, 'set-restore'),
        row(t('qr.title'), null, function () { openTransfer(true); }, 'set-qr'),
        abCapable() ? row(t('ab.title'), AB.handle ? t('ab.stateOn') : t('ab.stateOff'), openAutoBackup, 'set-autobackup') : null,
        row(t('set.export'), null, openExport, 'set-export'),
        row(t('set.import'), null, openImport, 'set-import'),
        row(t('set.erase'), null, openErase, 'set-erase', true)]),
      group(t('set.help'), [
        HP ? row(t('hp.set'), S.settings.helper.off ? t('pm.off') : null, openHelperSettings, 'set-helper') : null,
        row(t('set.tour'), null, openTour, 'set-tour'),
        row(t('set.install'), isStandalone() ? t('install.done') : null, openInstall, 'set-install'),
        isPhone() ? null : row(t('set.autostart'), null, openAutoStart, 'set-autostart'),
        row(t('rm.title'), null, openReminder, 'set-reminder'),
        isPhone() ? null : row(t('kb.title'), null, openShortcuts, 'set-shortcuts'),
        row(t('set.about'), null, openAbout, 'set-about'),
        h('li', {}, h('a', { class: 'set-row', href: '/manual-vault', target: '_blank', rel: 'noopener' }, h('span', { class: 'set-label', text: t('set.manual') }), icon('chev', 18)))]),
      h('p', { class: 'fine center' }, h('a', { href: '/privacy', target: '_blank', rel: 'noopener', text: t('setup.privacy') }), ' · ',
        h('a', { href: '/terms', target: '_blank', rel: 'noopener', text: t('setup.terms') }), ' · PopPopMake'),
      sponsorBox());
  }
  // A sponsor's banner at the bottom of Settings, when one is booked for this app in /ads.json: a picture stored on
  // this site and a plain link (no ad network, nothing counted). Read once per visit.
  var adsCfg = null;
  function sponsorBox() {
    var box = h('aside', { class: 'vault-ad', id: 'vault-ad', 'aria-label': t('ad.label'), hidden: true });
    if (!window.PPMBanner || !window.fetch) return box;
    (adsCfg || (adsCfg = fetch('/ads.json', { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })))
      .then(function (cfg) {
        var b = cfg && window.PPMBanner.pick(cfg, '/vault', new Date(), undefined, 'vault');
        if (b && box.isConnected) window.PPMBanner.render(box, b, { where: 'vault', sponsored: t('ad.sponsored'), advertiseHref: '/advertise', advertiseText: t('ad.advertise'), newTab: true });
      });
    return box;
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
  function openMonthlyBudget() { amountSheet(t('monthly.title'), t('monthly.body'), S.budget.budgets.total, function (v) { S.budget.budgets.total = v; if (v) helperDone('budget', 'm'); }); }
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
            var emo = emojiButton(c.emoji, 'cat-emoji-' + c.id, function (e) { B.updateCategory(S.budget, c.id, { emoji: e }); saveBudget(); });
            name.addEventListener('change', function () { B.updateCategory(S.budget, c.id, { name: name.value.trim() || null }); saveBudget(); });
            return h('li', { class: c.hidden ? 'hidden-cat' : '' }, emo, name, c.hidden
              ? h('button', { type: 'button', class: 'btn small', text: t('cat.restore'), on: { click: function () { B.updateCategory(S.budget, c.id, { hidden: false }); saveBudget(); draw(); } } })
              : (c.id === 'other' || c.id === 'other_income') ? null
              : h('button', { type: 'button', class: 'btn small danger', text: t('cat.remove'), on: { click: function () {
                  var r = B.removeCategory(S.budget, c.id); saveBudget(); draw(); toast(r === 'hidden' ? t('cat.hiddenMsg') : t('cat.removed'));
                } } }), c.hidden ? h('span', { class: 'hint', text: t('cat.hidden') }) : null);
          })));
        });
        var nm = h('input', { class: 'input', id: 'new-cat-name', placeholder: t('cat.name'), maxlength: 40 });
        var newEmo = '🙂', em = emojiButton(newEmo, 'new-cat-emoji', function (e) { newEmo = e; });
        var ty = h('select', { class: 'input', id: 'new-cat-type' }, h('option', { value: 'expense', text: t('cat.expense') }), h('option', { value: 'income', text: t('cat.income') }));
        add(body, h('h3', { text: t('cat.add') }), h('div', { class: 'row' }, em, nm, ty,
          h('button', { type: 'button', class: 'btn primary', id: 'new-cat-add', text: t('btn.add'), on: { click: function () {
            if (!nm.value.trim()) { nm.focus(); return; }
            B.addCategory(S.budget, { type: ty.value, name: nm.value.trim(), emoji: newEmo || '•' }); saveBudget(); draw();
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
          S.settings.lastBackup = Date.now(); helperDone('backup', String(S.settings.lastBackup)); saveSettings(); setMsg(msg, t('backup.done'), true); return text;
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

  // ---------- automatic backup to a folder (Chrome / Edge on a computer) ----------
  // The folder handle is kept in its own small database (it holds only the folder's name and the browser's permission,
  // never content). The file written is the same encrypted backup as "Back up to a file".
  var AB = { handle: null, need: false, failed: false, busy: false, last: +(lsGet('ppm-vault-ab-last') || 0) };
  var AB_FILE = 'poppopmake-vault-backup-latest.json', AB_DAY = /^poppopmake-vault-backup-(\d{4}-\d{2}-\d{2})\.json$/;
  function abCapable() { return !DESK && !isPhone() && typeof window.showDirectoryPicker === 'function'; }
  function abDb(mode, fn) {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('ppm-vault-autobackup', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onerror = function () { rej(r.error); };
      r.onsuccess = function () {
        var db = r.result, tx = db.transaction('kv', mode), st = tx.objectStore('kv'), out = fn(st);
        tx.oncomplete = function () { db.close(); res(out && out.result !== undefined ? out.result : undefined); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      };
    });
  }
  function abInit() {
    if (!abCapable()) return Promise.resolve();
    return abDb('readonly', function (st) { return st.get('dir'); }).then(function (h) {
      if (!h) { AB.handle = null; return; }
      AB.handle = h;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        AB.need = p !== 'granted';
        if (AB.need) render(); else abRun(false);
      });
    }).catch(function () {});
  }
  function abAllow() {
    if (!AB.handle) return;
    AB.handle.requestPermission({ mode: 'readwrite' }).then(function (p) {
      AB.need = p !== 'granted'; render();
      if (!AB.need) abRun(true);
    }).catch(function () {});
  }
  function abPick() {
    return window.showDirectoryPicker({ id: 'ppm-vault-backup', mode: 'readwrite', startIn: 'documents' }).then(function (h) {
      return abDb('readwrite', function (st) { st.put(h, 'dir'); }).then(function () {
        AB.handle = h; AB.need = false; AB.failed = false; return abRun(true);
      }).then(function (ok) { render(); if (ok) toast(t('ab.done', { name: h.name })); return ok; });
    }).catch(function () { return false; });       // the person closed the folder picker
  }
  function abOff() {
    return abDb('readwrite', function (st) { st.delete('dir'); }).then(function () {
      AB.handle = null; AB.need = false; AB.failed = false; render(); toast(t('ab.offDone'));
    });
  }
  function abWrite(dir, name, text) {
    return dir.getFileHandle(name, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) {
      return w.write(text).then(function () { return w.close(); });
    });
  }
  // Saves when something changed since the last automatic backup (or always, when forced). Resolves true when saved.
  function abRun(force) {
    if (!AB.handle || AB.need || AB.busy || S.phase !== 'app' || !C.shareSession()) return Promise.resolve(false);
    AB.busy = true;
    var dir = AB.handle;
    return C.load('settings').then(function (st) {
      var changed = (st && st.lastChange) || 0;
      if (!force && AB.last && changed <= AB.last) return false;
      return C.exportBackup().then(function (text) {
        var now = Date.now();
        return abWrite(dir, AB_FILE, text).then(function () { return abWrite(dir, 'poppopmake-vault-backup-' + today() + '.json', text); }).then(function () {
          AB.last = now; AB.failed = false; lsSet('ppm-vault-ab-last', String(now));
          if (S.settings) { S.settings.lastBackup = now; saveSettings(); }
          return abPrune(dir).then(function () { return true; });
        });
      });
    }).catch(function () { AB.failed = true; if (S.phase === 'app' && !modalOpen()) render(); return false; })
      .then(function (ok) { AB.busy = false; return ok; });
  }
  function abPrune(dir) {
    if (!dir.entries) return Promise.resolve();
    var cut = new Date(Date.now() - 30 * 864e5), cutS = cut.getFullYear() + '-' + pad(cut.getMonth() + 1) + '-' + pad(cut.getDate()), old = [];
    var it = dir.entries();
    function next() {
      return it.next().then(function (r) {
        if (r.done) return;
        var m = r.value[0].match(AB_DAY);
        if (m && m[1] < cutS && r.value[1].kind === 'file') old.push(r.value[0]);
        return next();
      });
    }
    return next().then(function () { return Promise.all(old.map(function (n) { return dir.removeEntry(n).catch(function () {}); })); }).catch(function () {});
  }
  setInterval(function () { if (AB.handle && S.phase === 'app') abRun(false); }, 30000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && AB.handle && S.phase === 'app') abRun(false); });
  function openAutoBackup() {
    sheet(t('ab.title'), function (body, close) {
      add(body, h('p', { text: t('ab.body') }));
      if (AB.handle) {
        add(body, h('p', { class: 'msg ok', id: 'ab-folder', text: t('ab.folder', { name: AB.handle.name }) }),
          h('p', { class: 'hint', id: 'ab-last', text: AB.last ? t('ab.last', { when: I.ago(AB.last) }) : t('ab.never') }),
          AB.need ? h('button', { type: 'button', class: 'btn primary block', id: 'ab-allow', text: t('ab.allow'), on: { click: function () { close(); abAllow(); } } }) : null,
          h('button', { type: 'button', class: 'btn primary block', id: 'ab-now', text: t('ab.now'), on: { click: function () {
            abRun(true).then(function (ok) { close(); toast(ok ? t('ab.done', { name: AB.handle.name }) : t('ab.failed')); });
          } } }),
          h('button', { type: 'button', class: 'btn block', id: 'ab-change', text: t('ab.change'), on: { click: function () { close(); abPick(); } } }),
          h('button', { type: 'button', class: 'btn ghost block', id: 'ab-off', text: t('ab.off'), on: { click: function () { close(); abOff(); } } }));
      } else add(body, h('button', { type: 'button', class: 'btn primary block', id: 'ab-pick', text: t('ab.pick'), on: { click: function () { close(); abPick(); } } }));
      add(body, h('p', { class: 'hint', text: t('ab.keep') }));
    });
  }

  // ---------- a daily reminder in the calendar the person already uses (no server, no notifications permission) ----------
  function icsText(s0) { return String(s0).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function reminderParts(time, what) {
    var url = location.origin + '/vault' + (what === 'diary' ? '?start=diary' : what === 'budget' ? '?start=add' : '');
    var title = t(what === 'diary' ? 'rm.evDiary' : what === 'budget' ? 'rm.evBudget' : 'rm.evBoth');
    var hm = /^(\d{2}):(\d{2})$/.exec(time) || [0, '21', '00'];
    var d = new Date(); d.setHours(+hm[1], +hm[2], 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);       // first reminder: today if the time is still ahead, else tomorrow
    var stamp = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; };
    var end = new Date(d.getTime() + 5 * 60000);
    return { url: url, title: title, start: stamp(d), end: stamp(end), desc: t('rm.evDesc') + ' ' + url };
  }
  function reminderIcs(p) {
    var u = new Uint8Array(8); crypto.getRandomValues(u);
    var uid = Array.prototype.map.call(u, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('') + '@poppopmake.com';
    var now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PopPopMake//Budget Notes Diary//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + now, 'DTSTART:' + p.start, 'DTEND:' + p.end].concat(p.rrule === false ? [] : ['RRULE:FREQ=DAILY']).concat([
      'SUMMARY:' + icsText(p.title), 'DESCRIPTION:' + icsText(p.desc), 'URL:' + p.url,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(p.title), 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR', '']).join('\r\n');
  }
  function nowLocal() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function whenText(v) {
    var d = v.slice(0, 10), tm = v.slice(11, 16), md = d.slice(5).replace('-', '/');
    try { md = new Intl.DateTimeFormat(I.get(), { month: 'short', day: 'numeric' }).format(new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))); } catch (e) {}
    return (d === today() ? t('nr.today') : md) + ' ' + tm;
  }
  function noteThumb(n) {
    var img = h('img', { alt: '', class: 'note-thumb' });
    photoUrl(n.photos[0]).then(function (u) { if (u) img.src = u; }).catch(function () {});
    return h('span', { class: 'note-thumbs' }, img, n.photos.length > 1 ? h('span', { class: 'note-more', text: '+' + (n.photos.length - 1) }) : null);
  }
  // One reminder for one note, in the person's own calendar. A locked note never puts its text in the calendar.
  function openNoteReminder(n, done) {
    sheet(t('nr.title'), function (body, close) {
      var tm = new Date(Date.now() + 864e5), defD = tm.getFullYear() + '-' + pad(tm.getMonth() + 1) + '-' + pad(tm.getDate());
      var date = h('input', { type: 'date', class: 'input', id: 'nr-date', value: n.remind ? n.remind.slice(0, 10) : defD });
      var time = h('input', { type: 'time', class: 'input', id: 'nr-time', value: n.remind ? n.remind.slice(11, 16) : '09:00' });
      var hide = h('input', { type: 'checkbox', id: 'nr-hide', checked: !!n.locked, disabled: !!n.locked });
      var msg = msgEl(); msg.id = 'nr-msg';
      var g = h('a', { class: 'btn block', id: 'nr-google', target: '_blank', rel: 'noopener noreferrer', href: '#' }, t('rm.google'));
      function parts() {
        var d = B.validDate(date.value) ? date.value : defD, hm = /^\d{2}:\d{2}$/.test(time.value) ? time.value : '09:00';
        var start = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +hm.slice(0, 2), +hm.slice(3, 5));
        var stamp = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; };
        var url = location.origin + '/vault?start=notes', secret = hide.checked || n.locked;
        var first = (n.list ? LS.preview(n.text) : n.text).trim().split('\n')[0].slice(0, 80);
        return { when: d + 'T' + hm, url: url, start: stamp(start), end: stamp(new Date(start.getTime() + 15 * 60000)), rrule: false,
          title: secret || !first ? t('nr.generic') : '📝 ' + first,
          desc: (secret ? '' : (n.list ? LS.preview(n.text) : n.text).slice(0, 1500) + '\n\n') + t('rm.evDesc') + ' ' + url };
      }
      function link() {
        var p = parts(), tz = '';
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
        g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(p.title) + '&details=' + encodeURIComponent(p.desc) + '&dates=' + p.start + '/' + p.end + (tz ? '&ctz=' + encodeURIComponent(tz) : '');
      }
      function remember() { var p = parts(); n.remind = p.when; n.updated = Date.now(); markNote(n); saveNotes(); if (done) done(); }
      g.addEventListener('click', function () { remember(); });
      [date, time, hide].forEach(function (el) { el.addEventListener('input', link); el.addEventListener('change', link); }); link();
      add(body, h('p', { text: t('nr.body') }), h('div', { class: 'two' }, field(t('add.date'), date), field(t('rm.time'), time)),
        h('div', { class: 'check' }, hide, h('label', { for: 'nr-hide', text: n.locked ? t('nr.hideLocked') : t('nr.hide') })),
        h('button', { type: 'button', class: 'btn primary block', id: 'nr-file', text: t('rm.file'), on: { click: function () {
          var p = parts();
          if (p.when < nowLocal()) return setMsg(msg, t('nr.past'));
          download(reminderIcs(p), 'poppopmake-note-reminder.ics', 'text/calendar;charset=utf-8'); remember(); setMsg(msg, t('nr.saved'), true);
        } } }),
        h('p', { class: 'hint', text: t('rm.fileHint') }), g, h('p', { class: 'hint', text: t('nr.googleHint') }), msg,
        n.remind ? h('button', { type: 'button', class: 'btn ghost block', id: 'nr-clear', text: t('nr.clear'), on: { click: function () {
          n.remind = null; n.updated = Date.now(); markNote(n); saveNotes(); if (done) done(); close();
        } } }) : null);
    });
  }
  function openReminder() {
    sheet(t('rm.title'), function (body) {
      var time = h('input', { type: 'time', class: 'input', id: 'rm-time', value: '21:00' });
      var what = h('select', { class: 'input', id: 'rm-what' });
      [['diary', 'rm.diary'], ['budget', 'rm.budget'], ['both', 'rm.both']].forEach(function (x) { add(what, h('option', { value: x[0], text: t(x[1]) })); });
      var g = h('a', { class: 'btn block', id: 'rm-google', target: '_blank', rel: 'noopener noreferrer', href: '#' }, t('rm.google'));
      function link() {
        var p = reminderParts(time.value, what.value), tz = '';
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
        g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(p.title) + '&details=' + encodeURIComponent(p.desc) +
          '&dates=' + p.start + '/' + p.end + '&recur=' + encodeURIComponent('RRULE:FREQ=DAILY') + (tz ? '&ctz=' + encodeURIComponent(tz) : '');
      }
      time.addEventListener('input', link); what.addEventListener('change', link); link();
      add(body, h('p', { text: t('rm.body') }),
        field(t('rm.time'), time), field(t('rm.what'), what),
        h('button', { type: 'button', class: 'btn primary block', id: 'rm-file', text: t('rm.file'), on: { click: function () {
          download(reminderIcs(reminderParts(time.value, what.value)), 'poppopmake-daily-reminder.ics', 'text/calendar;charset=utf-8');
        } } }),
        h('p', { class: 'hint', text: t('rm.fileHint') }), g, h('p', { class: 'hint', text: t('rm.googleHint') }));
    });
  }

  // ---------- keyboard shortcuts on a computer (by key position, so Korean / Japanese input mode doesn't matter) ----------
  var KB = [['N', 'kb.n'], ['A', 'kb.a'], ['D', 'kb.d'], ['/', 'kb.search'], ['1 2 3 4', 'kb.tabs'], ['L', 'kb.lock'], ['?', 'kb.help']];
  function openShortcuts() {
    sheet(t('kb.title'), function (body) {
      add(body, h('ul', { class: 'kb-list', id: 'kb-list' }, KB.map(function (k) {
        return h('li', {}, h('span', { class: 'kb-keys' }, k[0].split(' ').map(function (x) { return h('kbd', { text: x }); })), h('span', { text: t(k[1]) }));
      })), h('p', { class: 'hint', text: t('kb.hint') }));
    });
  }
  function goTab(tab) { if (S.tab !== tab) { flushNote(); flushEntry(); hideToast(); S.tab = tab; if (tab !== 'settings') lsSet(TAB_KEY, tab); S.searchOpen = false; render(); window.scrollTo(0, 0); } }
  document.addEventListener('keydown', function (e) {
    if (S.phase !== 'app' || DESK || modalOpen() || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    var el = e.target, tag = el && el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    var c = e.code, act = null;
    if (c === 'KeyN') act = function () { goTab('notes'); var b = document.getElementById('new-note'); if (b) b.click(); };
    else if (c === 'KeyA') act = function () { goTab('budget'); openAdd(); };
    else if (c === 'KeyD') act = function () { goTab('diary'); newEntry(today()); };
    else if (c === 'Slash' && e.shiftKey) act = openShortcuts;
    else if (c === 'Slash') act = function () {
      if (S.tab === 'budget') { S.searchOpen = true; render(); }
      else if (S.tab === 'diary') { S.diarySearch = true; render(); }
      else { goTab('notes'); var i = document.getElementById('notes-search'); if (i) i.focus(); }
    };
    else if (/^Digit[1-4]$/.test(c)) act = function () { goTab(['budget', 'notes', 'diary', 'settings'][+c.slice(5) - 1]); };
    else if (c === 'KeyL') act = function () { lockNow(false); };
    if (!act) return;
    e.preventDefault(); act();
  });

  // ---------- moving everything to another device with QR codes (vault-qr.js) ----------
  var loaded = {};
  function loadScript(src) {
    if (!loaded[src]) loaded[src] = new Promise(function (res, rej) {
      var el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = function () { delete loaded[src]; rej(new Error('load')); };
      document.head.appendChild(el);
    });
    return loaded[src];
  }
  function openTransfer(unlocked) {
    sheet(t('qr.title'), function (body, close) {
      add(body, h('p', { text: t('qr.body') }),
        unlocked ? h('button', { type: 'button', class: 'btn primary block', id: 'qr-send', text: '📤 ' + t('qr.send'), on: { click: function () { close(); openSend(); } } }) : null,
        h('button', { type: 'button', class: 'btn block', id: 'qr-receive', text: '📷 ' + t('qr.receive'), on: { click: function () { close(); openReceive(); } } }),
        h('p', { class: 'hint', text: t('qr.tip') }));
    });
  }
  // One QR size (version) for every code of a send, so the reader never meets a different geometry halfway through;
  // versions 23 and 26 are skipped because the fallback reader (jsQR) often can't read them.
  function qrVersion(text) {
    var q = window.qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
    var v = (q.getModuleCount() - 17) / 4;
    return v === 23 || v === 26 ? v + 1 : v;
  }
  function drawQR(canvas, text, ver) {
    var q = window.qrcode(ver || 0, 'L'); q.addData(text, 'Byte'); q.make();
    var n = q.getModuleCount(), quiet = 4, size = canvas.width, cell = Math.floor(size / (n + quiet * 2)), off = Math.floor((size - cell * (n + quiet * 2)) / 2);
    var g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(off + (c + quiet) * cell, off + (r + quiet) * cell, cell, cell);
  }
  function openSend() {
    var timer = null, wake = null;
    sheet(t('qr.send'), function (body) {
      var msg = msgEl(), info = h('p', { class: 'hint center', id: 'qr-info' }), count = h('p', { class: 'center qr-count', id: 'qr-count', 'aria-live': 'off' });
      var px = Math.min(720, Math.max(260, Math.floor(Math.min(window.innerWidth, window.innerHeight) - 80)));
      var big = px >= 640;                          // a computer screen: denser codes, a phone camera reads them easily
      var canvas = h('canvas', { class: 'qr-canvas', id: 'qr-canvas', width: px, height: px, role: 'img', 'aria-label': t('qr.title') });
      var fps = big ? 6 : 5, frames = [], i = 0, ver = 0;
      function tick() { if (!frames.length) return; drawQR(canvas, frames[i], ver); count.textContent = t('qr.frame', { i: i + 1, n: frames.length }); i = (i + 1) % frames.length; touch(); }
      function start() { clearInterval(timer); timer = setInterval(tick, Math.round(1000 / fps)); }
      add(body, h('p', { text: t('qr.sendBody') }), h('p', { class: 'msg', id: 'qr-secret-note', text: t('qr.secretNote') }), info, canvas, count,
        h('div', { class: 'row center' },
          h('button', { type: 'button', class: 'btn small', id: 'qr-slower', text: t('qr.slower'), on: { click: function () { fps = Math.max(2, fps - 1); start(); } } }),
          h('button', { type: 'button', class: 'btn small', id: 'qr-faster', text: t('qr.faster'), on: { click: function () { fps = Math.min(10, fps + 1); start(); } } })), msg);
      Promise.all([loadScript('/qrcode-generator.min.js'), flushAll()]).then(function () { return C.exportBackup(); }).then(function (text) {
        return window.VaultQR.encode(text, big ? 1150 : px < 400 ? 450 : 800);
      }).then(function (r) {
        frames = r.frames; ver = qrVersion(frames[0]);
        var secs = Math.ceil(r.count / fps * 1.3);
        info.textContent = (secs < 120 ? t('qr.size', { n: r.count, s: secs }) : t('qr.sizeLong', { n: r.count, m: Math.ceil(secs / 60) })) + (big ? ' · ' + t('qr.fast') : '');
        tick(); start();
        try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }, function () {}); } catch (e) {}
      }).catch(function (e) { setMsg(msg, e && e.code === 'too-big' ? t('qr.tooBig') : errText(e)); });
    }, { onClose: function () { clearInterval(timer); try { if (wake) wake.release(); } catch (e) {} } });
  }
  function openReceive() {
    var stream = null, loop = null, stopped = false;
    function stop() { stopped = true; clearTimeout(loop); if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); }); stream = null; }
    sheet(t('qr.receive'), function (body, close) {
      var msg = msgEl(); msg.id = 'qr-msg';
      var status = h('p', { class: 'center', id: 'qr-status', 'aria-live': 'polite', text: t('qr.loading') });
      var bar = h('progress', { class: 'qr-progress', id: 'qr-progress', max: 1, value: 0 });
      var video = h('video', { class: 'qr-video', id: 'qr-video', playsinline: '', muted: '', autoplay: '' });
      var grab = document.createElement('canvas'), gctx = grab.getContext('2d', { willReadFrequently: true });
      var small = document.createElement('canvas'), sctx = small.getContext('2d', { willReadFrequently: true });
      var rx = new window.VaultQR.Receiver(), detector = null, warnedOther = false;
      var warn = h('p', { class: 'msg', id: 'qr-replace', hidden: true, text: t('qr.replaceWarn') });
      C.status().then(function (st) { if (st !== 'empty') warn.hidden = false; }).catch(function () {});
      add(body, h('p', { text: t('qr.recvBody') }), warn, video, bar, status, msg);
      function seen(text) {
        var r = rx.add(text);
        if (r.state === 'other' && !warnedOther) { warnedOther = true; setMsg(msg, t('qr.other')); }
        if (r.count) { bar.max = r.count; bar.value = r.have; status.textContent = t('qr.got', { have: r.have, n: r.count }); }
        if (r.state === 'new') touch();              // a long transfer must not trip the automatic lock
        return rx.done();
      }
      function scan() {
        if (stopped) return;
        var w = video.videoWidth, hh = video.videoHeight;
        var p = Promise.resolve([]);
        if (w && hh) {
          var k = Math.min(1, 1100 / Math.max(w, hh)); grab.width = Math.round(w * k); grab.height = Math.round(hh * k);
          gctx.drawImage(video, 0, 0, grab.width, grab.height);
          p = detector ? detector.detect(grab).then(function (codes) { return codes.map(function (c) { return c.rawValue; }); })
            : Promise.resolve().then(function () {
              var c = window.jsQR(gctx.getImageData(0, 0, grab.width, grab.height).data, grab.width, grab.height, { inversionAttempts: 'dontInvert' });
              for (var a = 0; !c && a < 2; a++) {                // the same picture a little smaller often reads when full size doesn't
                var f = a ? 0.65 : 0.8, ww = Math.round(grab.width * f), hh2 = Math.round(grab.height * f);
                small.width = ww; small.height = hh2; sctx.drawImage(grab, 0, 0, ww, hh2);
                c = window.jsQR(sctx.getImageData(0, 0, ww, hh2).data, ww, hh2, { inversionAttempts: 'dontInvert' });
              }
              return c ? [c.data] : [];
            });
        }
        p.then(function (texts) {
          var done = texts.some(seen);
          if (done) { stop(); finish(); } else loop = setTimeout(scan, 60);
        }).catch(function () { loop = setTimeout(scan, 200); });
      }
      function finish() {
        video.remove(); bar.value = bar.max;
        rx.text().then(function (text) {
          status.textContent = t('qr.allIn');
          var secret = passInput(false, 'off'); secret.input.id = 'qr-secret';
          var go = h('button', { type: 'submit', class: 'btn primary block', id: 'qr-go', text: t('qr.go') });
          var form = h('form', { class: 'stack', novalidate: true }, h('div', { class: 'field' }, h('label', { for: 'qr-secret', text: t('restore.secret') }), secret.wrap), go);
          form.addEventListener('submit', function (e) {
            e.preventDefault(); go.disabled = true; go.textContent = t('restore.working'); setMsg(msg, '');
            C.importBackup(text, secret.input.value).then(function () { clearFails(); return loadAll(); }).then(function () {
              close(); closeAllModals(); S.phase = 'app'; touch(); render(); toast(t('qr.done'));
            }).catch(function (err) {
              go.disabled = false; go.textContent = t('qr.go');
              setMsg(msg, err && err.code === 'bad-passcode' ? t('qr.badSecret') : err && err.code === 'bad-file' ? t('qr.damaged') : errText(err));
            });
          });
          add(body, form); secret.input.focus();
        }).catch(function (e) { setMsg(msg, e && e.code === 'no-gzip' ? t('qr.noGzip') : t('qr.damaged')); });
      }
      var want = ('BarcodeDetector' in window) ? window.BarcodeDetector.getSupportedFormats().then(function (f) {
        if (f.indexOf('qr_code') >= 0) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); else return loadScript('/jsqr.min.js');
      }).catch(function () { return loadScript('/jsqr.min.js'); }) : loadScript('/jsqr.min.js');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status.textContent = ''; return setMsg(msg, t('qr.noCamera')); }
      Promise.all([want, navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })]).then(function (r) {
        stream = r[1];
        if (stopped) return stop();
        video.srcObject = stream; video.muted = true;
        return video.play().catch(function () {}).then(function () { status.textContent = t('qr.waiting'); scan(); });
      }).catch(function () { status.textContent = ''; setMsg(msg, t('qr.noCamera')); });
    }, { onClose: stop });
  }

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
          // Dates like 03/04/2026: which number is the day. Asked only when the file has such dates.
          if (!map.order) map.order = S.budget.currency === 'USD' ? 'mdy' : 'dmy';
          var ambiguous = map.date !== null && rows.some(function (r) { return /^\s*\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.test(String(r[map.date] || '')); });
          var order = h('select', { class: 'input', id: 'import-order' }, h('option', { value: 'dmy', text: t('import.dmy') }), h('option', { value: 'mdy', text: t('import.mdy') }));
          order.value = map.order;
          order.addEventListener('change', function () { map.order = order.value; drawPreview(); });
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
            ambiguous ? field(t('import.order'), order) : null,
            h('div', { class: 'check' }, flip, h('label', { for: 'import-flip', text: t('import.flip') })), prev,
            h('button', { type: 'button', class: 'btn primary block', id: 'import-go', text: t('import.go'), on: { click: function () {
              var r = B.importRows(S.budget, rows, map, S.budget.currency);
              if (r.added) helperDone('import', String(Date.now()));
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
          clearFails(); lsSet(DESK_KEY, null); closeAllModals(); S.budget = S.notes = S.settings = S.diary = null; dropPhotoUrls(); S.phase = 'welcome'; render(); toast(t('erase.done'));
        }).catch(function (e) { go.disabled = false; toast(errText(e)); });
      });
      add(body, h('p', { class: 'msg', text: t('erase.body') }), field(t('erase.type', { word: word }), inp), go);
    });
  }
  function isPhone() { return isIOS() || /Android/i.test(navigator.userAgent); }
  function autoStartSteps() {
    var mac = /Macintosh/.test(navigator.userAgent) && !isIOS();
    return h('div', { class: 'autostart', id: 'autostart' },
      h('h3', { text: t('hk.title') }),
      h('ol', { class: 'install-steps hk-steps', id: 'hk-steps' }, (mac ? ['hk.mac1', 'hk.mac2', 'hk.mac3'] : ['hk.win1', 'hk.win2', 'hk.win3']).map(function (k) { return h('li', { text: t(k) }); })),
      h('p', { class: 'hint', text: t(mac ? 'hk.macNote' : 'hk.winNote') }),
      h('h3', { text: t('install.auto') }),
      h('ul', { class: 'install-steps' },
        h('li', { text: t('install.autoChrome') }), h('li', { text: t('install.autoEdge') }),
        h('li', { class: mac ? '' : 'here', text: t('install.autoWin') }), h('li', { class: mac ? 'here' : '', text: t('install.autoMac') })),
      h('p', { class: 'hint', text: t('install.autoNote') }));
  }
  function openAutoStart() { sheet(t('set.autostart'), function (body) { add(body, autoStartSteps()); }); }
  function openInstall() {
    sheet(t('install.title'), function (body) {
      add(body, h('p', { class: 'hint', text: t('install.why') }));
      if (isStandalone()) { add(body, h('p', { class: 'msg ok', text: t('install.done') })); if (!isPhone()) add(body, autoStartSteps()); return; }
      if (S.installEvt) add(body, h('button', { type: 'button', class: 'btn primary block', id: 'install-go', text: t('install.button'), on: { click: function () {
        var ev = S.installEvt; S.installEvt = null; ev.prompt(); ev.userChoice.then(function () { render(); }, function () {});
      } } }));
      add(body, h('ul', { class: 'install-steps' },
        h('li', { class: isIOS() ? 'here' : '', text: t('install.ios') }),
        h('li', { class: !isIOS() && /Android/i.test(navigator.userAgent) ? 'here' : '', text: t('install.android') }),
        h('li', { class: !isPhone() ? 'here' : '', text: t('install.desktop') })));
      if (!isPhone()) add(body, autoStartSteps());
    });
  }
  function openAbout() {
    sheet(t('about.title'), function (body) {
      add(body, ['about.p1', 'about.p2', 'about.p3', 'about.p4', 'about.p5', 'deco.legal'].map(function (k) { return h('p', { text: t(k) }); }),
        h('p', { class: 'msg', text: t('about.legal') }),
        h('p', {}, h('a', { href: '/how-it-works', target: '_blank', rel: 'noopener', text: t('about.how') })));
    });
  }
  // How recovery works — reachable while locked (from "Forgot your passcode?") and from Settings.
  function openRecHelp(locked) {
    var names = { forgot: t('lock.forgot'), unlock: t('lock.unlock'), erase: t('lock.erase') };
    sheet(t('help.title'), function (body, close) {
      add(body, h('div', { id: 'rec-help' },
        h('h3', { text: t('help.h1') }),
        ['help.s1', 'help.s2', 'help.s3'].map(function (k) { return h('p', { text: t(k, names) }); }),
        h('h3', { text: t('help.h2') }),
        ['help.b1', 'help.b2', 'help.b3'].map(function (k) { return h('p', { text: t(k, names) }); }),
        h('h3', { text: t('help.h3') }),
        h('p', { class: 'msg', id: 'rec-help-resp', text: t('help.r') }),
        h('p', { class: 'fine', text: t('help.tip') }),
        h('p', {}, h('a', { href: '/terms#budget-notes', target: '_blank', rel: 'noopener', text: t('setup.terms') }), ' · ',
          h('a', { href: '/manual-vault#recovery', target: '_blank', rel: 'noopener', text: t('set.manual') }))),
        locked ? h('div', { class: 'row end' },
          h('button', { type: 'button', class: 'btn', id: 'rec-help-restore', text: t('lock.restore'), on: { click: function () { close(); openRestore(); } } }),
          h('button', { type: 'button', class: 'btn danger', id: 'rec-help-erase', text: t('lock.erase'), on: { click: function () { close(); openErase(); } } }))
          : h('div', { class: 'row end' },
            h('button', { type: 'button', class: 'btn', text: t('set.newCode'), on: { click: function () { close(); openNewCode(); } } }),
            h('button', { type: 'button', class: 'btn primary', text: t('set.backup'), on: { click: function () { close(); openBackup(); } } })));
    });
  }
  function openTour() {
    var i = 0, N = 6, EMO = ['💸', '📊', '📝', '📔', '🔒', '💾'];
    sheet(t('set.tour'), function (body, close) {
      function draw() {
        body.textContent = '';
        add(body, h('div', { class: 'tour', id: 'tour', 'data-step': i + 1 },
          h('div', { class: 'tour-ico', 'aria-hidden': 'true', text: EMO[i] }),
          h('h3', { class: 'tour-title', text: t('tour.' + (i + 1) + 't') }),
          h('p', { text: t('tour.' + (i + 1) + 'b') }),
          h('div', { class: 'dots', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5].map(function (k) { return h('span', { class: k === i ? 'on' : '' }); })),
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
  // ---------- the helper (vault-helper.js): today's suggestions, "ask in your own words", step-by-step pointers ----------
  var GUIDE = HP ? new HP.Guide({ t: t }) : null, hpSeen = {}, hpWatch = null;
  var ACT_LABEL = { add: 'hp.do.add', recurring: 'hp.do.recurring', note: 'hp.do.note', charts: 'hp.do.charts', 'monthly-budget': 'hp.do.budget',
    recap: 'hp.do.recap', 'make-recurring': 'hp.do.makeRec', diary: 'hp.do.diary', guide: 'hp.do.guide' };
  function hpText(x) {
    var v = {}, src = x[1] || {};
    Object.keys(src).forEach(function (k) { v[k] = src[k]; });
    if (v.amt !== undefined) v.amt = money(v.amt);
    if (v.per !== undefined) v.per = money(v.per);
    if (v.cat !== undefined) { v.what = v.what || catName(v.cat); v.cat = catName(v.cat); }
    if (v.date) v.date = I.dayLabel(v.date);
    if (v.ym) v.ym = I.monthLabel(v.ym);
    return t(x[0], v);
  }
  // Up to three cards on Budget (two on Notes and Diary, only about that tab). Safety notices keep their own card above.
  function helperCards(tab) {
    if (!HP || DESK || !S.settings) return null;
    helperWatch();                                       // (also right after first setup, which has no unlock)
    if (S.settings.helper.off) return null;
    var all = HP.suggest({ budget: S.budget, notes: S.notes, diary: S.diary, today: today(), hour: new Date().getHours(), B: B, state: S.settings.helper }, 8);
    var list = tab === 'budget' ? all : all.filter(function (x) { return (x.tab === tab || !x.tab) && !(tab === 'diary' && x.type === 'diary'); });
    list = list.slice(0, tab === 'budget' ? 3 : 2);
    if (!list.length) return null;
    var hs = S.settings.helper;
    var wrap = h('section', { class: 'helper', id: 'helper-' + tab, 'aria-label': t('hp.today') },
      h('div', { class: 'helper-head' }, h('h2', { class: 'helper-title', text: '💁 ' + t('hp.today') }),
        h('button', { type: 'button', class: 'link small', id: 'helper-hide', text: t('hp.hideToday'), on: { click: function () {
          list.forEach(function (x) { hs.snooze[x.id] = today(); }); saveSettings(); render();
        } } })));
    list.forEach(function (x) {
      add(wrap, h('article', { class: 'helper-card', 'data-sid': x.id, 'data-type': x.type },
        h('span', { class: 'helper-ico', 'aria-hidden': 'true', text: x.emoji }),
        h('div', { class: 'helper-text' }, h('strong', { text: hpText(x.title) }), h('p', { text: hpText(x.body) }),
          h('div', { class: 'helper-actions' },
            h('button', { type: 'button', class: 'btn small primary', 'data-act': x.act, text: t(ACT_LABEL[x.act] || 'hp.do.open'), on: { click: function () { runAct(x.act, x.args || {}); } } }),
            h('button', { type: 'button', class: 'link', 'data-later': x.id, text: t(x.alt || 'hp.later'), on: { click: function () { hs.snooze[x.id] = today(); saveSettings(); render(); } } }),
            x.type === 'first' ? null : h('button', { type: 'button', class: 'link quiet', 'data-mute': x.type, text: t('hp.mute'), on: { click: function () {
              hs.mute[x.type] = 1; saveSettings(); render();
              toast(t('hp.muted'), { label: t('btn.undo'), fn: function () { delete hs.mute[x.type]; saveSettings(); render(); } });
            } } })))));
    });
    return wrap;
  }
  function runAct(act, a) {
    a = a || {};
    if (act === 'add') { goTab('budget'); openAdd(null, a.date ? { date: a.date } : null); }
    else if (act === 'recurring') openRecurring();
    else if (act === 'note') { goTab('notes'); openNote(a.id); }
    else if (act === 'charts' || act === 'recap') { goTab('budget'); S.ym = a.ym || thisMonth(); S.budgetView = 'charts'; render(); }
    else if (act === 'monthly-budget') openMonthlyBudget();
    else if (act === 'make-recurring') {
      var r = B.addRecurring(S.budget, { type: 'expense', amt: a.amt, cat: a.cat, note: a.note, day: a.day, start: thisMonth(), pm: a.pm });
      r.last = a.last; B.applyRecurring(S.budget, today()); saveBudget(); render();
      toast(t('hp.recMade', { what: a.note || catName(a.cat) }), { label: t('btn.undo'), fn: function () {
        S.budget.tx.filter(function (x) { return x.rid === r.id; }).map(function (x) { return x.id; }).forEach(function (id) { B.deleteTx(S.budget, id); });
        B.deleteRecurring(S.budget, r.id); saveBudget(); render();
      } });
    }
    else if (act === 'diary') { goTab('diary'); newEntry(today()); }
    else if (act === 'guide') startGuide(a.flow);
    else if (act === 'methods') openMethods();
    else if (act === 'goals') { goTab('budget'); S.budgetView = 'goals'; render(); }
    else if (act === 'new-note') startGuide('remind');
    else if (act === 'diary-print') openDiaryPrint();
    else if (act === 'search') { goTab('budget'); S.searchOpen = true; render(); }
  }
  // Counts what someone has done on their own; after two times the stuck-help for it stops.
  function helperDone(flow, uid) {
    if (!HP || !S.settings) return;
    var k = flow + ':' + (uid || ''); if (hpSeen[k]) return; hpSeen[k] = 1;
    var d = S.settings.helper.done; d[flow] = Math.min(99, (d[flow] || 0) + 1); saveSettings();
  }
  function helperOffer(flow) {
    var hs = S.settings && S.settings.helper;
    if (!GUIDE || !hs || hs.off || !hs.guides || GUIDE.running() || (hs.done[flow] || 0) >= 2) return;
    GUIDE.say(t('hp.stuck.' + flow), [{ id: 'hp-stuck-show', label: t('hp.stuck.show'), primary: true, fn: function () { startGuide(flow, true); } }, { id: 'hp-stuck-no', label: t('hp.stuck.no') }], 15000);
  }
  function helperWatch() {
    if (hpWatch || !HP) return;
    hpWatch = HP.Stuck({ wait: 20000, offer: helperOffer, check: function () {
      var hs = S.settings && S.settings.helper;
      if (S.phase !== 'app' || !hs || hs.off || !hs.guides || (GUIDE && GUIDE.running())) return null;
      var m = modals[modals.length - 1]; if (!m || !m.el) return null;
      var box = m.el, head = box.querySelector('.sheet-head h2'), el, flow;
      if ((el = box.querySelector('#amount')) && !box.querySelector('#delete-tx')) flow = 'add';
      else if ((el = box.querySelector('#amount-input')) && head && head.textContent === t('monthly.title')) flow = 'budget';
      else if ((el = box.querySelector('#note-text'))) flow = 'note';
      else if ((el = box.querySelector('#entry-text'))) flow = 'diary';
      else return null;
      return (hs.done[flow] || 0) >= 2 ? null : { flow: flow, el: el };
    } });
  }
  // Step-by-step pointers. "opener" steps open the screen; they are skipped when the screen is already open.
  var FLOWS = {
    add: function () { return [
      { sel: '#add-btn', key: 'hp.g.add1', until: 'click', opener: true, before: function () { goTab('budget'); } },
      { sel: '#amount', key: 'hp.g.add2', until: 'input' },
      { sel: '#cat-grid', key: 'hp.g.add3', until: function () { return !document.getElementById('amount'); } }]; },
    receipt: function () { return [
      { sel: '#add-btn', key: 'hp.g.add1', until: 'click', opener: true, before: function () { goTab('budget'); } },
      { sel: '#amount', key: 'hp.g.add2', until: 'input' },
      { sel: '#receipt-add', key: 'hp.g.rc1', vars: { label: t('rc.add') }, until: function () { return !!document.getElementById('receipt-remove') || !document.getElementById('amount'); } },
      { sel: '#cat-grid', key: 'hp.g.add3', until: function () { return !document.getElementById('amount'); } }]; },
    note: function () { return [
      { sel: '#new-note', key: 'hp.g.note1', until: 'click', opener: true, before: function () { goTab('notes'); } },
      { sel: '#note-text', key: 'hp.g.note2', until: 'input' }]; },
    diary: function () { return [
      { sel: '#new-entry', key: 'hp.g.diary1', until: 'click', opener: true, before: function () { goTab('diary'); } },
      { sel: '#entry-text', key: 'hp.g.diary2', until: 'input' }]; },
    budget: function () { return [
      { sel: '#set-monthly', key: 'hp.g.budget1', vars: { label: t('set.monthly') }, until: 'click', opener: true, before: function () { goTab('settings'); } },
      { sel: '#amount-input', key: 'hp.g.budget2', until: 'input' },
      { sel: '#amount-save', key: 'hp.g.budget3', vars: { label: t('btn.save') }, until: function () { return !document.getElementById('amount-input'); } }]; },
    backup: function () { return [
      { sel: '#set-backup', key: 'hp.g.backup1', vars: { label: t('set.backup') }, until: 'click', opener: true, before: function () { goTab('settings'); } },
      { sel: '#backup-download', key: 'hp.g.backup2', vars: { label: t('backup.download') }, until: 'click' }]; },
    'import': function () { return [
      { sel: '#set-import', key: 'hp.g.import1', vars: { label: t('set.import') }, until: 'click', opener: true, before: function () { goTab('settings'); } },
      { sel: '#import-file', key: 'hp.g.import2', until: function () { return !!document.getElementById('import-go'); } },
      { sel: '#import-go', key: 'hp.g.import3', vars: { label: t('import.go') }, until: function () { return !document.getElementById('import-file'); } }]; },
    remind: function () { return [
      { sel: '.note-card', key: 'hp.g.remind1', until: 'click', opener: true, before: function () { goTab('notes'); } },
      { sel: '#note-remind', key: 'hp.g.remind2', vars: { label: t('nr.btn') }, until: 'click' },
      { sel: '#nr-date', key: 'hp.g.remind3', until: function () {           // done once the note shows its reminder time
        var b = document.getElementById('note-remind'); return !!b && b.textContent.indexOf(t('nr.btn')) < 0; } }]; }
  };
  function startGuide(flow, inSheet) {
    if (!GUIDE || !FLOWS[flow]) return;
    var steps = FLOWS[flow]();
    if (inSheet) steps = steps.filter(function (x) { return !x.opener; });
    else closeAllModals();
    GUIDE.start(flow, steps, 'hp.g.' + flow + 'Done');
  }
  // What people may ask for, in any of the three languages (people mix them). run(question) does it.
  function askList() {
    function go(fn) { return function () { fn(); }; }
    function setTab(tab, sel) { return function () { goTab(tab); var el = sel && document.querySelector(sel); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }; }
    var L = [
      { id: 'add', flow: 'add', boost: 1, kw: ['지출', '쓴돈', '썼', '돈 쓴', '기록', '적기', '가계부', '결제', '샀', '구매', '쓴 돈', 'spend', 'spent', 'expense', 'add', 'paid', 'bought', 'log', '支出', '使った', '記録', '買った', '出費', '家計簿'],
        run: function (q) { runAct('add', HP.wantsYesterday(q) ? { date: HP.addDays(today(), -1) } : {}); } },
      { id: 'income', kw: ['수입', '월급', '들어온', '입금', '용돈', '부수입', 'income', 'salary', 'earned', 'got paid', '収入', '給料', '入金'], run: function () { goTab('budget'); openAdd(null, { type: 'income' }); } },
      { id: 'receipt', flow: 'receipt', kw: ['영수증', '사진', '찍', 'receipt', 'photo', 'picture', 'レシート', '領収書', '写真'], run: function () { goTab('budget'); openAdd(); } },
      { id: 'import', flow: 'import', kw: ['엑셀', 'csv', '카드내역', '카드 내역', '은행', '가져오기', '불러오기', '명세서', 'import', 'bank', 'statement', 'excel', 'spreadsheet', '取り込み', '明細', 'エクセル', '銀行'], run: go(openImport) },
      { id: 'export', kw: ['내보내기', '다운로드', '엑셀로', 'export', 'download', '書き出し', 'エクスポート'], run: go(openExport) },
      { id: 'budget', flow: 'budget', kw: ['예산', '한달', '한 달', '한도', '얼마까지', 'budget', 'limit', '予算'], run: go(openMonthlyBudget) },
      { id: 'catbudgets', kw: ['분류별 예산', '카테고리 예산', '식비 예산', 'category budget', 'カテゴリ予算'], run: go(openCatBudgets) },
      { id: 'recurring', kw: ['반복', '고정지출', '고정 지출', '매달', '정기', '구독', '월세', '자동이체', 'recurring', 'repeat', 'monthly', 'subscription', 'rent', 'fixed', '固定費', '毎月', '定期', 'サブスク', '家賃'], run: go(openRecurring) },
      { id: 'methods', kw: ['결제수단', '결제 수단', '카드', '현금', '계좌', 'payment method', 'card', 'cash', '支払い方法', 'カード', '現金'], run: go(openMethods) },
      { id: 'categories', kw: ['분류', '카테고리', '항목', 'category', 'categories', 'カテゴリ', '分類'], run: go(openCategories) },
      { id: 'goals', kw: ['저축', '목표', '모으기', '모으', '적금', 'goal', 'saving', 'save up', '目標', '貯金', '貯め'], run: function () { runAct('goals'); } },
      { id: 'charts', kw: ['그래프', '차트', '통계', '분석', '어디에 많이', '어디에 썼', 'chart', 'graph', 'stats', 'where did', 'グラフ', '分析'], run: function () { runAct('charts'); } },
      { id: 'year', kw: ['연간', '1년', '일년', '올해', '작년', 'year', 'annual', '年間', '今年'], run: function () { goTab('budget'); S.budgetView = 'year'; render(); } },
      { id: 'search', kw: ['검색', '찾기', '찾아', '언제 샀', 'search', 'find', '検索', '探'], run: function () { runAct('search'); } },
      { id: 'note', flow: 'note', kw: ['메모', '포스트잇', '적어두', '할일', '할 일', '장보기', 'note', 'memo', 'sticky', 'todo', 'to-do', 'メモ', '付箋', 'やること'],
        run: function () { goTab('notes'); setTimeout(function () { var b = document.getElementById('new-note'); if (b) b.click(); }, 0); } },
      { id: 'remind', flow: 'remind', kw: ['알림', '알람', '잊지', '리마인더', 'remind', 'reminder', 'alarm', 'リマインダー', '通知', 'アラーム'], run: function () { startGuide('remind'); } },
      { id: 'diary', flow: 'diary', kw: ['일기', '다이어리', '하루 기록', '오늘 있었던', 'diary', 'journal', '日記'], run: function () { runAct('diary'); } },
      { id: 'diarysearch', kw: ['일기 검색', '일기 찾', 'search diary', '日記 検索'], run: function () { goTab('diary'); S.diarySearch = true; render(); } },
      { id: 'diaryprint', kw: ['pdf', '인쇄', '책으로', '출력', 'print', 'book', '印刷'], run: function () { openDiaryPrint(); } },
      { id: 'backup', flow: 'backup', kw: ['백업', '저장해', '날아가', '안전하게', 'backup', 'back up', 'save a copy', 'バックアップ'], run: go(openBackup) },
      { id: 'restore', kw: ['복원', '되돌리', '백업 불러', 'restore', '復元'], run: go(openRestore) },
      { id: 'autobackup', kw: ['자동 백업', '자동백업', '폴더', 'auto backup', 'folder', '自動バックアップ', 'フォルダ'], run: go(openAutoBackup), hide: function () { return !abCapable(); } },
      { id: 'transfer', kw: ['옮기', '새 폰', '새폰', '다른 기기', '폰 바꿨', '휴대폰 바꾸', '기기 변경', 'qr', 'move', 'new phone', 'transfer', 'another device', '移行', '機種変更', '新しいスマホ'], run: function () { openTransfer(true); } },
      { id: 'passcode', kw: ['비밀번호', '암호', '패스워드', '비번', 'password', 'passcode', 'パスワード', '暗証'], run: go(openChangePass) },
      { id: 'recovery', kw: ['복구 코드', '복구코드', '잊어버', '까먹', 'recovery code', 'forgot', '復旧コード', '忘れ'], run: go(openNewCode) },
      { id: 'passkey', kw: ['지문', '얼굴인식', '얼굴 인식', '패스키', '생체', 'fingerprint', 'face id', 'passkey', '指紋', '顔認証', 'パスキー'], run: go(openPasskey) },
      { id: 'autolock', kw: ['자동 잠금', '자동잠금', '잠금 시간', 'auto lock', 'auto-lock', '自動ロック'], run: setTab('settings', '#set-autolock') },
      { id: 'lock', kw: ['잠그', '잠금', 'lock', 'ロック'], run: function () { lockNow(false); } },
      { id: 'language', kw: ['언어', '영어로', '한국어로', '일본어', 'language', 'english', '言語', '英語'], run: setTab('settings', '#set-lang') },
      { id: 'currency', kw: ['통화', '달러', '원화', '엔화', '화폐', 'currency', 'dollar', '通貨', '円'], run: setTab('settings', '#set-currency') },
      { id: 'install', kw: ['설치', '앱으로', '홈화면', '홈 화면', '아이콘', 'install', 'app', 'home screen', 'icon', 'インストール', 'ホーム画面', 'アイコン'], run: go(openInstall) },
      { id: 'autostart', kw: ['단축키', '빨리 열', '시작할 때', '자동 실행', '켤 때', 'shortcut key', 'start up', 'startup', 'open faster', 'ショートカットキー', '自動起動'], run: go(openAutoStart), hide: isPhone },
      { id: 'reminder', kw: ['매일 알림', '기록 알림', '잊어버려', '매일', 'daily reminder', 'every day', '毎日'], run: go(openReminder) },
      { id: 'shortcuts', kw: ['키보드', 'keyboard', 'キーボード'], run: go(openShortcuts), hide: isPhone },
      { id: 'tour', kw: ['사용법', '처음', '어떻게 써', '도움말', '설명', 'how to use', 'help', 'tutorial', 'intro', '使い方', 'ヘルプ'], run: go(openTour) },
      { id: 'manual', kw: ['설명서', '매뉴얼', 'manual', 'guide', 'マニュアル', '説明書'], run: function () { window.open('/manual-vault', '_blank', 'noopener'); } },
      { id: 'erase', kw: ['전부 삭제', '모두 삭제', '초기화', '다 지우', 'erase', 'reset', 'delete everything', '全部削除', '初期化'], run: go(openErase) }
    ];
    return L.filter(function (a) { return !a.hide || !a.hide(); });
  }
  function openAsk() {
    if (!HP) return;
    var LIST = askList(), byId = {};
    LIST.forEach(function (a) { byId[a.id] = a; });
    sheet(t('hp.askTitle'), function (body, close) {
      var q = h('input', { class: 'input', id: 'hp-q', type: 'search', placeholder: t('hp.askPh'), autocomplete: 'off', 'data-autofocus': '1', 'aria-label': t('hp.askTitle'), enterkeyhint: 'go' });
      var res = h('ul', { class: 'hp-results', id: 'hp-results', 'aria-live': 'polite' });
      var none = h('p', { class: 'hint', id: 'hp-none', hidden: true, text: t('hp.none') });
      function go(a) { close(); setTimeout(function () { a.run(q.value); }, 0); }
      function how(a) { close(); setTimeout(function () { startGuide(a.flow); }, 0); }
      var chips = h('div', { class: 'hp-chips', id: 'hp-chips' }, h('span', { class: 'hint', text: t('hp.examples') }),
        ['add', 'receipt', 'budget', 'backup', 'transfer', 'diaryprint'].filter(function (id) { return byId[id]; }).map(function (id) {
          return h('button', { type: 'button', class: 'chip', 'data-ask': id, text: t('hp.a.' + id), on: { click: function () { go(byId[id]); } } });
        }));
      function draw() {
        res.textContent = '';
        if (!q.value.trim()) { none.hidden = true; chips.hidden = false; return; }
        chips.hidden = true;
        var found = HP.match(q.value, LIST, 4);
        none.hidden = found.length > 0;
        found.forEach(function (r, i) {
          var a = byId[r.id];
          var label = a.id === 'add' && HP.wantsYesterday(q.value) ? t('hp.a.addYesterday') : t('hp.a.' + a.id);
          add(res, h('li', { class: 'hp-result' + (i === 0 ? ' best' : ''), 'data-id': a.id },
            h('span', { class: 'hp-result-label', text: label }),
            h('span', { class: 'hp-result-btns' },
              a.flow ? h('button', { type: 'button', class: 'btn small', id: 'hp-how-' + a.id, text: t('hp.show'), on: { click: function () { how(a); } } }) : null,
              h('button', { type: 'button', class: 'btn small primary', id: 'hp-go-' + a.id, text: t('hp.go'), on: { click: function () { go(a); } } }))));
        });
      }
      q.addEventListener('input', draw);
      q.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        var m = HP.match(q.value, LIST, 1); if (m.length) go(byId[m[0].id]);
      });
      add(body, h('p', { class: 'hint', text: t('hp.askHint') }), q, chips, res, none, h('p', { class: 'fine', text: t('hp.setNote') }));
    });
  }
  function openHelperSettings() {
    sheet(t('hp.set'), function (body, close) {
      var hs = S.settings.helper;
      var on = h('input', { type: 'checkbox', id: 'hp-on', checked: !hs.off });
      var gd = h('input', { type: 'checkbox', id: 'hp-guides', checked: hs.guides });
      on.addEventListener('change', function () { hs.off = !on.checked; saveSettings(); render(); });
      gd.addEventListener('change', function () { hs.guides = gd.checked; saveSettings(); });
      var n = Object.keys(hs.mute).length;
      var un = h('button', { type: 'button', class: 'btn', id: 'hp-unmute', disabled: !n, text: t('hp.unmute', { n: n }), on: { click: function () {
        hs.mute = {}; hs.snooze = {}; saveSettings(); close(); render(); toast(t('hp.unmuted'));
      } } });
      add(body,
        h('div', { class: 'check' }, on, h('label', { for: 'hp-on', text: t('hp.setOn') })),
        h('div', { class: 'check' }, gd, h('label', { for: 'hp-guides', text: t('hp.setGuides') })),
        un,
        h('h3', { class: 'hp-sub', text: t('hp.guidesTitle') }),
        h('ul', { class: 'set-list card', id: 'hp-flows' }, Object.keys(FLOWS).map(function (f) {
          return h('li', {}, h('button', { type: 'button', class: 'set-row', id: 'hp-flow-' + f, on: { click: function () { close(); setTimeout(function () { startGuide(f); }, 0); } } },
            h('span', { class: 'set-label', text: t('hp.f.' + f) }), icon('chev', 18)));
        })),
        h('p', { class: 'fine', text: t('hp.setNote') }));
    });
  }

  function render() {
    applyLang();
    var p = S.phase;
    if (p === 'loading') { app.textContent = ''; add(app, h('div', { class: 'screen center' }, h('p', { class: 'hint', text: '…' }))); }
    else if (p === 'nocrypto') renderUnsupported('err.crypto');
    else if (p === 'nostorage') renderUnsupported('err.storage');
    else if (p === 'welcome' && DESK) { var w = screen('center desk-lock'); add(w, h('p', {}, h('a', { href: '/vault', target: '_blank', rel: 'noopener', text: t('desk.openApp') }))); }
    else if (p === 'welcome') renderWelcome();
    else if (p === 'create') renderCreate();
    else if (p === 'recovery') renderRecovery();
    else if (p === 'locked') renderLocked();
    else if (p === 'forgot') renderForgot();
    else if (p === 'corrupt') renderCorrupt();
    else if (DESK) renderDesk();
    else renderApp();
  }

  // ---------- start ----------
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; });
  window.addEventListener('appinstalled', function () { S.installEvt = null; });
  window.addEventListener('pagehide', function () { flushNote(); flushEntry(); deskFlush(); deskSaveGeo(); });

  var qlang = (location.search.match(/[?&]lang=(ko|ja|en)\b/) || [])[1];   // the Korean / Japanese introduction pages open the app in their language
  I.set(qlang ? I.set(qlang, true) : I.detect());
  if (qlang && history.replaceState) {                // apply once, then drop it from the address so a later choice in Settings sticks
    try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])lang=(ko|ja|en)(&|$)/, function (m, a, l, b) { return b ? a : ''; }) + location.hash); } catch (e) {}
  }
  applyTheme();
  if (DESK) document.documentElement.classList.add('desk-mode');
  if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) { S.phase = 'nocrypto'; render(); return; }
  if (!window.indexedDB) { S.phase = 'nostorage'; render(); return; }
  render();
  C.status().then(function (st) {
    S.phase = st === 'empty' ? 'welcome' : 'locked';
    var sm = (location.search + location.hash).match(/[?&#]start=(notes|diary|add|share)\b/);
    var lastTab = lsGet(TAB_KEY);
    if (!sm && /^(budget|notes|diary)$/.test(lastTab || '')) S.tab = lastTab;        // reopen where you left off
    if (sm && sm[1] === 'add') { S.tab = 'budget'; S.startAdd = true; } else if (sm && sm[1] === 'share') takeShared(); else if (sm) S.tab = sm[1];
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
      ['/vault', '/vault-core.js', '/vault-budget.js', '/vault-diary.js', '/vault-i18n.js', '/vault-stickers.js', '/vault-deco.js', '/vault-snap.js', '/vault-list.js', '/vault-qr.js', '/vault-app.js', '/qrcode-generator.min.js', '/jsqr.min.js', '/vault.css', '/manifest-vault-' + I.get() + '.json', '/icons/tool-vault-192.png']
        .forEach(function (u) { fetch(u, { credentials: 'same-origin' }).catch(function () {}); });
    }).catch(function () {});
  }

})();
