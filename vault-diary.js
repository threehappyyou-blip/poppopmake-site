/* PopPopMake Vault — diary logic (no screen code, no storage, no network).
 * An entry: { id, date 'YYYY-MM-DD', time 'HH:MM' or '', text, mood 1-5 or null, tags [], photos [ids], created, updated }.
 */
(function (root) {
  'use strict';
  var MAX_PHOTOS = 4, PROMPTS = 16;

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

  function newDoc() { return { v: 1, entries: [] }; }
  function addEntry(doc, e) {
    var now = Date.now();
    var en = { id: uid(), date: e.date, time: /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : '', text: String(e.text || '').slice(0, 20000),
      mood: cleanMood(e.mood), tags: [], photos: (e.photos || []).slice(0, MAX_PHOTOS), created: now, updated: now };
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
    doc.entries.forEach(function (e) { if (e.text.trim() || e.photos.length) days[e.date] = true; });
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
    return doc.entries.filter(function (e) { return e.text.toLowerCase().indexOf(q) >= 0; }).sort(order);
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
      return head + '\n\n' + e.text.trim() + (e.photos.length && fmt.photos ? '\n\n' + fmt.photos(e.photos.length) : '') + '\n';
    }).join('\n');
  }
  function validate(raw) {
    var d = newDoc();
    if (!raw || !Array.isArray(raw.entries)) return d;
    d.entries = raw.entries.filter(function (e) { return e && typeof e.id === 'string' && validDate(e.date) && typeof e.text === 'string'; }).map(function (e) {
      return { id: e.id, date: e.date, time: /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : '', text: e.text, mood: cleanMood(e.mood),
        tags: tagsOf(e.text), photos: Array.isArray(e.photos) ? e.photos.filter(function (p) { return typeof p === 'string' && /^[a-z0-9]{1,40}$/.test(p); }).slice(0, MAX_PHOTOS) : [],
        created: +e.created || Date.now(), updated: +e.updated || Date.now() };
    });
    return d;
  }

  var api = { MAX_PHOTOS: MAX_PHOTOS, PROMPTS: PROMPTS, newDoc: newDoc, validate: validate, addEntry: addEntry, updateEntry: updateEntry, deleteEntry: deleteEntry,
    byMonth: byMonth, byDate: byDate, onThisDay: onThisDay, streak: streak, search: search, moodByDay: moodByDay, monthStats: monthStats,
    allTags: allTags, tagsOf: tagsOf, promptIndex: promptIndex, toText: toText, addDays: addDays, uid: uid };
  root.VaultDiary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
