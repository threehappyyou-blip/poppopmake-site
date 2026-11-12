/* PopPopMake Vault — diary logic (no screen code, no storage, no network).
 * An entry: { id, date 'YYYY-MM-DD', time 'HH:MM' or '', text, mood 1-5 or null, tags [], photos [ids], deco (or null), created, updated }.
 * deco: { paper, tint, font, tpl: { on, time: {'06'..'24': text}, week: { days[7], habits[{name, done[7]}] }, todo: [{text, done}] },
 *         stickers: [{ k: 'a:<art>' | 't:<tape>' | 'e:<emoji>', x 0-1 of the width, y in widths from the top, s size (share of width), r turn }],
 *         drawing: { id, ar (height / width) } or null }
 */
(function (root) {
  'use strict';
  var MAX_PHOTOS = 4, PROMPTS = 16, MAX_STICKERS = 60;
  var PAPERS = ['plain', 'lines', 'grid', 'dots', 'gingham', 'hearts', 'flowers', 'stars', 'clouds', 'manuscript', 'loveblue', 'chrome', 'ballet', 'strawberry', 'cherry', 'daisy', 'polka', 'stripe', 'pastelgrid', 'rainbow', 'lemon', 'clover', 'bear', 'starnight', 'waves'], TINTS = ['none', 'cream', 'pink', 'mint', 'sky', 'lavender', 'kraft', 'peach', 'lemon', 'coral', 'sage', 'ice'], FONTS = ['base', 'hand', 'pen', 'gamja', 'poor', 'single', 'yeon', 'dongle', 'dodum', 'batang', 'jua', 'dohyeon', 'cute', 'kirang', 'dokdo'];
  var TPLS = ['time', 'week', 'todo', 'thanks', 'money', 'reading', 'movie', 'workout', 'meal', 'sleep', 'travel', 'bucket', 'wish', 'review', 'praise', 'selfcare', 'goals'], HOURS = [];
  // Ready-made pages filled in by tapping and typing: each field is [name, kind, extra]. Kinds: line, area (several lines),
  // stars (0–5), num, time (hh:mm), cups (0–8 glasses), checks (named tick boxes), list (up to n lines with a tick each).
  var FORMS = {"reading": [["title", "line"], ["author", "line"], ["stars", "stars"], ["quote", "area"], ["thoughts", "area"]], "movie": [["title", "line"], ["where", "line"], ["stars", "stars"], ["review", "area"]], "workout": [["what", "line"], ["minutes", "num"], ["effort", "stars"], ["note", "area"]], "meal": [["breakfast", "line"], ["lunch", "line"], ["dinner", "line"], ["snack", "line"], ["water", "cups"]], "sleep": [["bed", "time"], ["wake", "time"], ["quality", "stars"], ["condition", "stars"], ["note", "line"]], "travel": [["where", "line"], ["with", "line"], ["best", "area"], ["food", "area"], ["again", "stars"]], "bucket": [["items", "list", 10]], "wish": [["items", "list", 8]], "review": [["keep", "area"], ["problem", "area"], ["try", "area"]], "praise": [["p1", "line"], ["p2", "line"], ["p3", "line"]], "selfcare": [["care", "checks", ["water", "walk", "stretch", "sleep", "fun", "tidy"]], ["word", "line"]], "goals": [["items", "list", 6], ["promise", "area"]]};
  var FORM_ICON = {"reading": "📚", "movie": "🎬", "workout": "🏃", "meal": "🍱", "sleep": "🌙", "travel": "✈️", "bucket": "🌠", "wish": "🎁", "review": "🔁", "praise": "👏", "selfcare": "🫧", "goals": "🎯"};
  for (var hh = 6; hh <= 24; hh++) HOURS.push((hh < 10 ? '0' : '') + hh);

  function uid() {
    var a = new Uint8Array(10);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, function (b) { return (b % 36).toString(36); }).join('');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
    return d.getUTCMonth() === +s.slice(5, 7) - 1 && d.getUTCDate() === +s.slice(8, 10);
  }
  function addDays(date, n) {
    var d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + n * 864e5);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function cleanMood(m) { m = Number(m); return m >= 1 && m <= 5 && Math.round(m) === m ? m : null; }
  function tagsOf(text) {
    var out = [], re = /#([\p{L}\p{N}_]{1,30})/gu, m;
    while ((m = re.exec(String(text || '')))) { var t = m[1].toLowerCase(); if (out.indexOf(t) < 0) out.push(t); }
    return out;
  }
  function order(a, b) {           // newest first: date, then time, then creation
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if ((a.time || '') !== (b.time || '')) return (a.time || '') < (b.time || '') ? 1 : -1;
    return b.created - a.created;
  }

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function num(v, lo, hi, dflt) { v = Number(v); if (!isFinite(v)) return dflt; return Math.min(hi, Math.max(lo, v)); }
  var EMOJI_RE = /\p{Extended_Pictographic}/u, ASCII_WORD_RE = /[A-Za-z0-9<>&"']/;
  function cleanSticker(x) {
    if (!x || typeof x !== 'object' || typeof x.k !== 'string') return null;
    var k = x.k;
    if (/^[at]:[a-z0-9]{1,16}$/.test(k)) {}                                               // drawn sticker or tape, by name
    else if (/^s:[a-z0-9-]{1,16}$/.test(k)) {}                                            // a reward seal the person earned
    else if (/^e:/.test(k) && k.length <= 18 && EMOJI_RE.test(k.slice(2)) && !ASCII_WORD_RE.test(k.slice(2))) {}   // one emoji
    else return null;
    return { k: k, x: num(x.x, 0, 1, 0.5), y: num(x.y, 0, 40, 0), s: num(x.s, 0.05, 0.8, 0.16), r: Math.round(num(x.r, -180, 180, 0)) };
  }
  function cleanTpl(t) {
    t = t && typeof t === 'object' ? t : {};
    var out = { on: TPLS.indexOf(t.on) >= 0 ? t.on : null, time: {}, week: { days: [], habits: [] }, todo: [], thanks: ['', '', ''], money: str(t.money, 500), forms: cleanForms(t.forms) };
    for (var k = 0; k < 3; k++) out.thanks[k] = str(Array.isArray(t.thanks) ? t.thanks[k] : '', 200);
    var tm = t.time && typeof t.time === 'object' ? t.time : {};
    HOURS.forEach(function (h) { var v = str(tm[h], 300); if (v) out.time[h] = v; });
    var wk = t.week && typeof t.week === 'object' ? t.week : {};
    for (var i = 0; i < 7; i++) out.week.days.push(str(Array.isArray(wk.days) ? wk.days[i] : '', 500));
    (Array.isArray(wk.habits) ? wk.habits : []).forEach(function (hb) {
      if (out.week.habits.length >= 6 || !hb || typeof hb !== 'object') return;
      var done = []; for (var d = 0; d < 7; d++) done.push(Array.isArray(hb.done) && hb.done[d] === true);
      out.week.habits.push({ name: str(hb.name, 40), done: done });
    });
    (Array.isArray(t.todo) ? t.todo : []).forEach(function (it) {
      if (out.todo.length >= 30 || !it || typeof it !== 'object') return;
      out.todo.push({ text: str(it.text, 200), done: it.done === true });
    });
    return out;
  }
  function cleanField(kind, extra, v) {
    if (kind === 'line') return str(v, 200);
    if (kind === 'area') return str(v, 1000);
    if (kind === 'stars') return Math.round(num(v, 0, 5, 0));
    if (kind === 'cups') return Math.round(num(v, 0, 8, 0));
    if (kind === 'num') return v === '' || v == null ? '' : Math.round(num(v, 0, 100000, 0));
    if (kind === 'time') return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : '';
    if (kind === 'checks') return extra.map(function (x, i) { return Array.isArray(v) && v[i] === true; });
    if (kind === 'list') { var out = []; for (var i = 0; i < extra; i++) { var it = Array.isArray(v) ? v[i] : null; out.push({ text: str(it && it.text, 200), done: !!(it && it.done === true) }); } return out; }
    return '';
  }
  function cleanForms(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(FORMS).forEach(function (k) {
      var r = raw[k]; if (!r || typeof r !== 'object') return;
      var f = {};
      FORMS[k].forEach(function (fd) { f[fd[0]] = cleanField(fd[1], fd[2], r[fd[0]]); });
      if (formHas(k, f)) out[k] = f;
    });
    return out;
  }
  function formHas(k, f) {
    return FORMS[k].some(function (fd) {
      var v = f[fd[0]];
      if (fd[1] === 'checks') return v.some(Boolean);
      if (fd[1] === 'list') return v.some(function (it) { return it.text.trim() || it.done; });
      return typeof v === 'number' ? v > 0 : !!String(v || '').trim();
    });
  }
  function formText(k, f, label) {           // a filled-in page as plain lines (for the list, search and the text file)
    var out = [];
    FORMS[k].forEach(function (fd) {
      var v = f[fd[0]], name = label ? label(k, fd[0]) : fd[0];
      if (fd[1] === 'checks') { var on = fd[2].filter(function (x, i) { return v[i]; }); if (on.length) out.push(name + ': ' + on.map(function (x) { return label ? label(k, 'o.' + x) : x; }).join(', ')); }
      else if (fd[1] === 'list') v.forEach(function (it) { if (it.text.trim()) out.push((it.done ? '[x] ' : '[ ] ') + it.text); });
      else if (fd[1] === 'stars') { if (v) out.push(name + ': ' + '★★★★★'.slice(0, v) + '☆☆☆☆☆'.slice(0, 5 - v)); }
      else if (fd[1] === 'cups') { if (v) out.push(name + ': ' + v); }
      else if (v !== '' && v != null && String(v).trim()) out.push(name + ': ' + v);
    });
    return out;
  }
  function tplHasContent(tp) {
    if (!tp) return false;
    if (tp.forms && Object.keys(tp.forms).length) return true;
    return Object.keys(tp.time).length > 0 || tp.week.days.some(function (d) { return d.trim(); }) ||
      tp.week.habits.some(function (hb) { return hb.name.trim() || hb.done.some(Boolean); }) || tp.todo.some(function (it) { return it.text.trim(); }) ||
      (tp.thanks || []).some(function (x) { return x.trim(); }) || !!(tp.money || '').trim();
  }
  function cleanDeco(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var d = { paper: PAPERS.indexOf(raw.paper) >= 0 ? raw.paper : 'plain', tint: TINTS.indexOf(raw.tint) >= 0 ? raw.tint : 'none',
      font: FONTS.indexOf(raw.font) >= 0 ? raw.font : 'base', tpl: cleanTpl(raw.tpl), stickers: [], drawing: null };
    (Array.isArray(raw.stickers) ? raw.stickers : []).forEach(function (x) { var c = cleanSticker(x); if (c && d.stickers.length < MAX_STICKERS) d.stickers.push(c); });
    if (raw.drawing && typeof raw.drawing === 'object' && typeof raw.drawing.id === 'string' && /^d[a-z0-9]{1,39}$/.test(raw.drawing.id))
      d.drawing = { id: raw.drawing.id, ar: num(raw.drawing.ar, 0.1, 40, 1) };
    var plain = d.paper === 'plain' && d.tint === 'none' && d.font === 'base' && !d.stickers.length && !d.drawing && !d.tpl.on && !tplHasContent(d.tpl);
    return plain ? null : d;
  }
  function tplText(e, sep) {        // the words written in the entry's pages (hourly, week, to-do)
    var tp = e.deco && e.deco.tpl; if (!tp) return '';
    var out = [];
    HOURS.forEach(function (h) { if (tp.time[h]) out.push(h + ':00 ' + tp.time[h]); });
    tp.week.days.forEach(function (d) { if (d.trim()) out.push(d); });
    tp.week.habits.forEach(function (hb) { if (hb.name.trim()) out.push(hb.name); });
    tp.todo.forEach(function (it) { if (it.text.trim()) out.push((it.done ? '[x] ' : '[ ] ') + it.text); });
    (tp.thanks || []).forEach(function (x) { if (x.trim()) out.push('♥ ' + x); });
    if ((tp.money || '').trim()) out.push(tp.money);
    Object.keys(tp.forms || {}).forEach(function (k) { out = out.concat(formText(k, tp.forms[k], api.formLabel)); });
    return out.join(sep || '\n');
  }
  function hasContent(e) {
    if (!e) return false;
    if ((e.text || '').trim() || (e.photos && e.photos.length) || e.mood) return true;
    var d = e.deco; if (!d) return false;
    return d.stickers.length > 0 || !!d.drawing || tplHasContent(d.tpl);
  }
  function blobsOf(e) { var out = (e.photos || []).slice(); if (e.deco && e.deco.drawing) out.push(e.deco.drawing.id); return out; }

  function newDoc() { return { v: 1, entries: [] }; }
  function addEntry(doc, e) {
    var now = Date.now();
    var en = { id: uid(), date: e.date, time: /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : '', text: String(e.text || '').slice(0, 20000),
      mood: cleanMood(e.mood), tags: [], photos: (e.photos || []).slice(0, MAX_PHOTOS), deco: cleanDeco(e.deco), created: now, updated: now };
    en.tags = tagsOf(en.text);
    doc.entries.push(en);
    return en;
  }
  function updateEntry(doc, id, patch) {
    var e = doc.entries.find(function (x) { return x.id === id; });
    if (!e) return false;
    if (patch.text !== undefined) { e.text = String(patch.text).slice(0, 20000); e.tags = tagsOf(e.text); }
    if (patch.mood !== undefined) e.mood = cleanMood(patch.mood);
    if (patch.date !== undefined && validDate(patch.date)) e.date = patch.date;
    if (patch.time !== undefined) e.time = /^\d{2}:\d{2}$/.test(patch.time) ? patch.time : '';
    if (patch.photos !== undefined) e.photos = patch.photos.slice(0, MAX_PHOTOS);
    if (patch.deco !== undefined) e.deco = cleanDeco(patch.deco);
    e.updated = Date.now();
    return true;
  }
  function deleteEntry(doc, id) {
    var i = doc.entries.findIndex(function (x) { return x.id === id; });
    return i < 0 ? null : doc.entries.splice(i, 1)[0];
  }
  function byMonth(doc, ym) { return doc.entries.filter(function (e) { return e.date.slice(0, 7) === ym; }).sort(order); }
  function byDate(doc, date) { return doc.entries.filter(function (e) { return e.date === date; }).sort(order); }
  // Same month and day in earlier years. On Feb 28 of a non-leap year, Feb 29 entries are included too.
  function onThisDay(doc, today) {
    var md = today.slice(5), y = today.slice(0, 4);
    var leapCatch = md === '02-28' && !validDate(y + '-02-29');
    return doc.entries.filter(function (e) {
      return e.date.slice(0, 4) < y && (e.date.slice(5) === md || (leapCatch && e.date.slice(5) === '02-29'));
    }).sort(order);
  }
  // Days in a row with at least one entry, ending today (or yesterday, if today has nothing yet).
  function streak(doc, today) {
    var days = {};
    doc.entries.forEach(function (e) { if (e.text.trim() || e.photos.length || (e.deco && hasContent({ text: '', photos: [], deco: e.deco }))) days[e.date] = true; });
    var d = days[today] ? today : addDays(today, -1), n = 0;
    while (days[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function search(doc, q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    if (q.charAt(0) === '#' && q.length > 1) {
      var tag = q.slice(1);
      return doc.entries.filter(function (e) { return e.tags.some(function (t) { return t.indexOf(tag) === 0; }); }).sort(order);
    }
    return doc.entries.filter(function (e) { return e.text.toLowerCase().indexOf(q) >= 0 || tplText(e, ' ').toLowerCase().indexOf(q) >= 0; }).sort(order);
  }
  function moodByDay(doc, ym) {
    var sum = {}, cnt = {};
    doc.entries.forEach(function (e) {
      if (e.date.slice(0, 7) !== ym || e.mood === null) return;
      sum[e.date] = (sum[e.date] || 0) + e.mood; cnt[e.date] = (cnt[e.date] || 0) + 1;
    });
    var out = {};
    Object.keys(sum).forEach(function (d) { out[d] = sum[d] / cnt[d]; });
    return out;
  }
  function monthStats(doc, ym) {
    var list = byMonth(doc, ym), days = {}, ms = 0, mc = 0;
    list.forEach(function (e) { days[e.date] = true; if (e.mood !== null) { ms += e.mood; mc++; } });
    return { count: list.length, days: Object.keys(days).length, avgMood: mc ? ms / mc : null };
  }
  function allTags(doc) {
    var c = {};
    doc.entries.forEach(function (e) { e.tags.forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return Object.keys(c).map(function (t) { return { tag: t, count: c[t] }; }).sort(function (a, b) { return b.count - a.count || (a.tag < b.tag ? -1 : 1); });
  }
  function promptIndex(date) {
    var n = Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 864e5);
    return ((n * 7) % PROMPTS + PROMPTS) % PROMPTS + 1;
  }
  // Plain-text copy of the whole diary, oldest first (not encrypted: the screen warns about that).
  function toText(doc, fmt) {
    fmt = fmt || {};
    return doc.entries.slice().sort(function (a, b) { return -order(a, b); }).map(function (e) {
      var head = '## ' + e.date + (e.time ? ' ' + e.time : '') + (e.mood && fmt.mood ? ' ' + fmt.mood(e.mood) : '');
      var extra = tplText(e);
      return head + '\n\n' + e.text.trim() + (extra ? '\n\n' + extra : '') + (e.photos.length && fmt.photos ? '\n\n' + fmt.photos(e.photos.length) : '') + '\n';
    }).join('\n');
  }
  function validate(raw) {
    var d = newDoc();
    if (!raw || !Array.isArray(raw.entries)) return d;
    d.entries = raw.entries.filter(function (e) { return e && typeof e.id === 'string' && validDate(e.date) && typeof e.text === 'string'; }).map(function (e) {
      return { id: e.id, date: e.date, time: /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : '', text: e.text, mood: cleanMood(e.mood),
        tags: tagsOf(e.text), photos: Array.isArray(e.photos) ? e.photos.filter(function (p) { return typeof p === 'string' && /^[a-z0-9]{1,40}$/.test(p); }).slice(0, MAX_PHOTOS) : [],
        deco: cleanDeco(e.deco), created: +e.created || Date.now(), updated: +e.updated || Date.now() };
    });
    return d;
  }

  var api = { FORMS: FORMS, FORM_ICON: FORM_ICON, cleanField: cleanField, formLabel: null, MAX_PHOTOS: MAX_PHOTOS, PROMPTS: PROMPTS, MAX_STICKERS: MAX_STICKERS, PAPERS: PAPERS, TINTS: TINTS, FONTS: FONTS, TPLS: TPLS, HOURS: HOURS,
    cleanDeco: cleanDeco, hasContent: hasContent, blobsOf: blobsOf, tplText: tplText, newDoc: newDoc, validate: validate, addEntry: addEntry, updateEntry: updateEntry, deleteEntry: deleteEntry,
    byMonth: byMonth, byDate: byDate, onThisDay: onThisDay, streak: streak, search: search, moodByDay: moodByDay, monthStats: monthStats,
    allTags: allTags, tagsOf: tagsOf, promptIndex: promptIndex, toText: toText, addDays: addDays, uid: uid };
  root.VaultDiary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
