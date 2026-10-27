/* PopPopMake Vault — budget logic (no screen code, no storage, no network).
 * Amounts are whole numbers in the currency's smallest unit (cents for USD,
 * won for KRW, yen for JPY), so sums never drift the way decimals do.
 * Dates are plain 'YYYY-MM-DD' strings in the user's own calendar.
 */
(function (root) {
  'use strict';

  var MAX_MINOR = 1e15;

  function uid() {
    var a = new Uint8Array(9);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, function (b) { return (b % 36).toString(36); }).join('');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymOf(date) { return date.slice(0, 7); }
  function daysInMonth(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function addMonths(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function validDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var m = +s.slice(5, 7), d = +s.slice(8, 10);
    return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(s.slice(0, 7));
  }

  // ---------- money ----------
  var digitCache = {};
  function digits(cur) {
    if (digitCache[cur] !== undefined) return digitCache[cur];
    var d = 2;
    try { d = new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits; } catch (e) {}
    return (digitCache[cur] = d);
  }
  function toMajor(minor, cur) { return minor / Math.pow(10, digits(cur)); }
  function majorString(minor, cur) {
    var d = digits(cur), neg = minor < 0, s = String(Math.abs(minor));
    if (d === 0) return (neg ? '-' : '') + s;
    while (s.length <= d) s = '0' + s;
    return (neg ? '-' : '') + s.slice(0, s.length - d) + '.' + s.slice(s.length - d);
  }
  // Reads what a person typed: "1,234.50", "₩4,500", "１２３４", "12,50". Returns the amount in minor units
  // (always positive: whether it is spent or received is chosen separately), or null.
  function parseAmount(input, cur) {
    if (input === null || input === undefined) return null;
    var s = String(input).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48); })
      .replace(/，/g, ',').replace(/．/g, '.').replace(/[^0-9.,]/g, '');
    if (!/[0-9]/.test(s)) return null;
    var d = digits(cur), intPart, frac = '';
    if (d === 0) { intPart = s.replace(/[.,]/g, ''); }
    else {
      var lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
      var dec = -1;
      if (lastDot >= 0 && lastComma >= 0) dec = Math.max(lastDot, lastComma);
      else if (lastComma >= 0) { var after = s.length - lastComma - 1; if (s.split(',').length === 2 && after >= 1 && after <= 2) dec = lastComma; }
      else if (lastDot >= 0) { if (s.split('.').length === 2) dec = lastDot; }
      if (dec >= 0) { intPart = s.slice(0, dec).replace(/[.,]/g, ''); frac = s.slice(dec + 1).replace(/[.,]/g, ''); }
      else intPart = s.replace(/[.,]/g, '');
    }
    intPart = intPart.replace(/^0+(?=\d)/, '') || '0';
    if (intPart.length > 15) return null;
    var minor = Number(intPart) * Math.pow(10, d);
    if (d > 0 && frac) {
      var f = (frac + '000000').slice(0, d), extra = frac.slice(d);
      minor += Number(f);
      if (extra && Number(extra[0]) >= 5) minor += 1;
    }
    if (!isFinite(minor) || minor > MAX_MINOR) return null;
    return Math.round(minor);
  }

  // ---------- categories ----------
  var DEFAULT_CATS = [
    ['food', 'expense', '🍚'], ['cafe', 'expense', '☕'], ['groceries', 'expense', '🛒'], ['transport', 'expense', '🚌'],
    ['housing', 'expense', '🏠'], ['utilities', 'expense', '💡'], ['phone', 'expense', '📱'], ['shopping', 'expense', '🛍️'],
    ['health', 'expense', '💊'], ['education', 'expense', '📚'], ['fun', 'expense', '🎬'], ['travel', 'expense', '✈️'],
    ['gifts', 'expense', '🎁'], ['subscriptions', 'expense', '🔁'], ['pets', 'expense', '🐾'], ['other', 'expense', '📦'],
    ['salary', 'income', '💼'], ['bonus', 'income', '🎉'], ['side', 'income', '🧰'], ['interest', 'income', '🏦'],
    ['refund', 'income', '↩️'], ['other_income', 'income', '➕']
  ];
  function defaultCats() { return DEFAULT_CATS.map(function (c) { return { id: c[0], type: c[1], emoji: c[2], name: null, hidden: false }; }); }

  function newDoc(lang, currency) {
    return { v: 1, currency: currency || 'USD', cats: defaultCats(), tx: [], budgets: { total: null, cats: {} }, recurring: [] };
  }

  function addCategory(doc, c) {
    var id = 'c_' + uid();
    doc.cats.push({ id: id, type: c.type === 'income' ? 'income' : 'expense', emoji: c.emoji || '•', name: String(c.name || '').slice(0, 40), hidden: false });
    return id;
  }
  function updateCategory(doc, id, patch) {
    var c = doc.cats.find(function (x) { return x.id === id; });
    if (!c) return false;
    if (patch.name !== undefined) c.name = patch.name === null ? null : String(patch.name).slice(0, 40);
    if (patch.emoji !== undefined) c.emoji = String(patch.emoji).slice(0, 8) || '•';
    if (patch.hidden !== undefined) c.hidden = !!patch.hidden;
    return true;
  }
  // A category that is in use is hidden (old entries keep their label); an unused one is deleted.
  function removeCategory(doc, id) {
    var used = doc.tx.some(function (t) { return t.cat === id; }) || doc.recurring.some(function (r) { return r.cat === id; });
    if (used) { updateCategory(doc, id, { hidden: true }); return 'hidden'; }
    doc.cats = doc.cats.filter(function (c) { return c.id !== id; });
    delete doc.budgets.cats[id];
    return 'deleted';
  }

  // ---------- entries ----------
  function addTx(doc, t) {
    var tx = { id: uid(), type: t.type === 'income' ? 'income' : 'expense', amt: Math.round(t.amt), cur: t.cur || doc.currency,
      cat: t.cat, date: t.date, note: String(t.note || '').slice(0, 300) };
    if (t.rid) tx.rid = t.rid;
    doc.tx.push(tx);
    return tx;
  }
  function updateTx(doc, id, patch) {
    var t = doc.tx.find(function (x) { return x.id === id; });
    if (!t) return false;
    ['type', 'amt', 'cur', 'cat', 'date', 'note'].forEach(function (k) { if (patch[k] !== undefined) t[k] = patch[k]; });
    if (patch.note !== undefined) t.note = String(patch.note).slice(0, 300);
    return true;
  }
  function deleteTx(doc, id) {
    var i = doc.tx.findIndex(function (x) { return x.id === id; });
    if (i < 0) return null;
    return doc.tx.splice(i, 1)[0];
  }

  // ---------- views ----------
  function summary(doc, ym) {
    var income = 0, expense = 0, other = 0, byCat = {};
    doc.tx.forEach(function (t) {
      if (ymOf(t.date) !== ym) return;
      if (t.cur !== doc.currency) { other++; return; }
      if (t.type === 'income') income += t.amt;
      else { expense += t.amt; byCat[t.cat] = (byCat[t.cat] || 0) + t.amt; }
    });
    var list = Object.keys(byCat).map(function (k) { return { cat: k, amt: byCat[k] }; }).sort(function (a, b) { return b.amt - a.amt; });
    var out = { ym: ym, income: income, expense: expense, net: income - expense, byCat: list, otherCurrency: other, budget: null, catBudgets: [] };
    var tb = doc.budgets && doc.budgets.total;
    if (tb > 0) out.budget = { total: tb, spent: expense, left: tb - expense };
    var cb = (doc.budgets && doc.budgets.cats) || {};
    Object.keys(cb).forEach(function (id) {
      if (!(cb[id] > 0)) return;
      var spent = byCat[id] || 0;
      out.catBudgets.push({ cat: id, budget: cb[id], spent: spent, left: cb[id] - spent });
    });
    out.catBudgets.sort(function (a, b) { return (b.spent / b.budget) - (a.spent / a.budget); });
    return out;
  }
  function days(doc, ym) {
    var map = {};
    doc.tx.forEach(function (t) {
      if (ymOf(t.date) !== ym) return;
      var d = map[t.date] || (map[t.date] = { date: t.date, items: [], income: 0, expense: 0 });
      d.items.push(t);
      if (t.cur === doc.currency) { if (t.type === 'income') d.income += t.amt; else d.expense += t.amt; }
    });
    return Object.keys(map).sort().reverse().map(function (k) { return map[k]; });
  }
  function trend(doc, ym, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var m = addMonths(ym, -i), s = summary(doc, m);
      out.push({ ym: m, income: s.income, expense: s.expense });
    }
    return out;
  }
  function search(doc, q, catName) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    return doc.tx.filter(function (t) {
      return t.note.toLowerCase().indexOf(q) >= 0 || (catName && String(catName(t.cat) || '').toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function guessCategory(doc, text) {
    var k = String(text || '').trim().toLowerCase();
    if (!k) return null;
    var best = null;
    doc.tx.forEach(function (t) { if (t.note.trim().toLowerCase() === k && (!best || t.date >= best.date)) best = t; });
    return best ? best.cat : null;
  }
  // The entries a person keeps repeating (same category, amount and note) in the last 90 days, most used first.
  function frequent(doc, today, n) {
    var from = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) - 90 * 864e5).toISOString().slice(0, 10);
    var groups = {};
    doc.tx.forEach(function (t) {
      if (t.date < from || t.date > today || t.rid) return;
      var key = [t.type, t.cat, t.amt, t.cur, t.note.trim().toLowerCase()].join('|');
      var g = groups[key] || (groups[key] = { type: t.type, cat: t.cat, amt: t.amt, cur: t.cur, note: t.note.trim(), count: 0, last: '' });
      g.count++;
      if (t.date >= g.last) { g.last = t.date; g.note = t.note.trim(); }
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .filter(function (g) { return g.count >= 2; })
      .sort(function (a, b) { return b.count - a.count || (a.last < b.last ? 1 : -1); })
      .slice(0, n || 6);
  }

  // ---------- repeating entries ----------
  function addRecurring(doc, r) {
    var rec = { id: uid(), type: r.type === 'income' ? 'income' : 'expense', amt: Math.round(r.amt), cur: r.cur || doc.currency, cat: r.cat,
      note: String(r.note || '').slice(0, 300), day: Math.min(31, Math.max(1, r.day | 0)), start: r.start, last: null, active: true };
    doc.recurring.push(rec);
    return rec;
  }
  function updateRecurring(doc, id, patch) {
    var r = doc.recurring.find(function (x) { return x.id === id; });
    if (!r) return false;
    ['type', 'amt', 'cur', 'cat', 'note', 'day', 'active'].forEach(function (k) { if (patch[k] !== undefined) r[k] = patch[k]; });
    return true;
  }
  function deleteRecurring(doc, id) { doc.recurring = doc.recurring.filter(function (r) { return r.id !== id; }); }
  // Adds every repeating entry that has come due up to and including `today`. Safe to call any number of times.
  function applyRecurring(doc, today) {
    var added = 0, nowYm = today.slice(0, 7), nowDay = +today.slice(8, 10);
    doc.recurring.forEach(function (r) {
      if (!r.active) return;
      var m = r.last ? addMonths(r.last, 1) : r.start;
      var guard = 0;
      while (m <= nowYm && guard++ < 600) {
        var day = Math.min(r.day, daysInMonth(m));
        if (m === nowYm && day > nowDay) break;
        addTx(doc, { type: r.type, amt: r.amt, cur: r.cur, cat: r.cat, date: m + '-' + pad(day), note: r.note, rid: r.id });
        r.last = m; added++;
        m = addMonths(m, 1);
      }
    });
    return added;
  }

  // ---------- CSV ----------
  function cell(v) {
    var s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;            // a spreadsheet must never run text as a formula
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(doc, catName) {
    var rows = [['date', 'type', 'category', 'amount', 'currency', 'note']];
    doc.tx.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (t) {
      rows.push([t.date, t.type, catName ? catName(t.cat) : t.cat, majorString(t.amt, t.cur), t.cur, t.note]);
    });
    return '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n') + '\r\n';
  }
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '', counts = { ',': 0, ';': 0, '\t': 0 }, q = false;
    for (var i = 0; i < first.length; i++) { var ch = first[i]; if (ch === '"') q = !q; else if (!q && counts[ch] !== undefined) counts[ch]++; }
    var sep = ',';
    if (counts[';'] > counts[sep]) sep = ';';
    if (counts['\t'] > counts[sep]) sep = '\t';
    var rows = [], row = [], field = '', inQ = false;
    for (var j = 0; j < text.length; j++) {
      var c = text[j];
      if (inQ) {
        if (c === '"') { if (text[j + 1] === '"') { field += '"'; j++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === sep) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[j + 1] === '\n') j++;
        row.push(field); field = '';
        if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
    return rows;
  }
  function parseDate(s) {
    s = String(s || '').trim();
    var m, y, mo, d;
    if ((m = s.match(/^(\d{4})\s*[-\/.년年]\s*(\d{1,2})\s*[-\/.월月]\s*(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(?!\d)/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/))) {
      var a = +m[1], b = +m[2]; y = +m[3];
      if (a > 12) { d = a; mo = b; } else { mo = a; d = b; }
    } else return null;
    var out = y + '-' + pad(mo) + '-' + pad(d);
    return validDate(out) ? out : null;
  }
  function isNumberCell(v) { return /^\s*[-+(]?\s*[^\d\s]{0,3}\s*[\d.,]+\s*\)?\s*$/.test(String(v || '')) && /\d/.test(v); }
  var H = {
    date: /date|일자|일시|날짜|거래일|日付|取引日|年月日|datum|fecha/i,
    desc: /desc|memo|payee|merchant|details|narrative|name|적요|내용|가맹점|거래처|摘要|内容|取引先|ご利用先|利用店|店名/i,
    out: /debit|withdraw|money out|paid out|\bout\b|출금|지출|支出|出金|引出|お支払|支払金額/i,
    in: /credit|deposit|money in|paid in|\bin\b|입금|수입|入金|預入|預り/i,
    amount: /amount|금액|金額|value|sum|betrag|importe/i
  };
  function guessColumns(rows) {
    var head = rows[0] || [], res = { header: false, date: null, desc: null, amount: null, out: null, in: null, flip: false };
    var headerLike = head.some(function (c) { return /[A-Za-z぀-ヿ一-鿿가-힣]/.test(c); }) && !head.some(function (c) { return parseDate(c); });
    if (headerLike) {
      res.header = true;
      var used = {};
      ['date', 'out', 'in', 'amount', 'desc'].forEach(function (k) {
        for (var i = 0; i < head.length; i++) if (!used[i] && H[k].test(head[i])) { res[k] = i; used[i] = true; break; }
      });
      if (res.out !== null && res.in === null && res.amount === null) { res.amount = res.out; res.out = null; }
      if (res.in !== null && res.out === null && res.amount === null) { res.amount = res.in; res.in = null; }
    }
    var sample = rows.slice(res.header ? 1 : 0, (res.header ? 1 : 0) + 20);
    function score(i, fn) { var n = 0; sample.forEach(function (r) { if (fn(r[i])) n++; }); return sample.length ? n / sample.length : 0; }
    var width = Math.max.apply(null, rows.map(function (r) { return r.length; }).concat([0]));
    if (res.date === null) for (var i = 0; i < width; i++) if (score(i, parseDate) > 0.6) { res.date = i; break; }
    if (res.amount === null && res.out === null) {
      for (var k = width - 1; k >= 0; k--) if (k !== res.date && score(k, isNumberCell) > 0.6) { res.amount = k; break; }
    }
    if (res.desc === null) {
      var best = -1, bestLen = 0;
      for (var c = 0; c < width; c++) {
        if (c === res.date || c === res.amount || c === res.out || c === res.in) continue;
        var len = 0; sample.forEach(function (r) { len += String(r[c] || '').length; });
        if (len > bestLen) { bestLen = len; best = c; }
      }
      if (best >= 0) res.desc = best;
    }
    return res;
  }
  // map: {header, date, desc, amount|null, out|null, in|null, flip}
  function importRows(doc, rows, map, cur) {
    cur = cur || doc.currency;
    var seen = {}, added = 0, skipped = 0, bad = 0;
    doc.tx.forEach(function (t) { seen[[t.date, t.type, t.amt, t.cur, t.note.trim().toLowerCase()].join('|')] = true; });
    rows.slice(map.header ? 1 : 0).forEach(function (r) {
      var date = map.date !== null && map.date !== undefined ? parseDate(r[map.date]) : null;
      var type = null, amt = null;
      if (map.out !== null && map.out !== undefined || map.in !== null && map.in !== undefined) {
        var o = map.out !== null && map.out !== undefined ? parseAmount(r[map.out], cur) : null;
        var i = map.in !== null && map.in !== undefined ? parseAmount(r[map.in], cur) : null;
        if (o > 0) { type = 'expense'; amt = o; } else if (i > 0) { type = 'income'; amt = i; }
      } else if (map.amount !== null && map.amount !== undefined) {
        var raw = String(r[map.amount] || '');
        amt = parseAmount(raw, cur);
        var negative = /^\s*-|-\s*$|\(.*\)/.test(raw);
        if (map.flip) negative = !negative;
        type = negative ? 'expense' : 'income';
      }
      if (!date || !(amt > 0)) { bad++; return; }
      var note = map.desc !== null && map.desc !== undefined ? String(r[map.desc] || '').trim().slice(0, 300) : '';
      var key = [date, type, amt, cur, note.toLowerCase()].join('|');
      if (seen[key]) { skipped++; return; }
      seen[key] = true;
      var cat = guessCategory(doc, note);
      if (!cat || !doc.cats.some(function (c) { return c.id === cat && c.type === type; })) cat = type === 'income' ? 'other_income' : 'other';
      addTx(doc, { type: type, amt: amt, cur: cur, cat: cat, date: date, note: note });
      added++;
    });
    return { added: added, skipped: skipped, bad: bad };
  }

  // ---------- loading ----------
  // Makes any stored document safe to use: missing parts are filled in, broken entries are dropped.
  function validate(raw, lang, currency) {
    var d = newDoc(lang, currency);
    if (!raw || typeof raw !== 'object') return d;
    if (typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency)) d.currency = raw.currency;
    if (Array.isArray(raw.cats) && raw.cats.length) {
      var cats = raw.cats.filter(function (c) { return c && typeof c.id === 'string' && (c.type === 'expense' || c.type === 'income'); });
      ['other', 'other_income'].forEach(function (id) {
        if (!cats.some(function (c) { return c.id === id; })) cats.push(defaultCats().find(function (c) { return c.id === id; }));
      });
      d.cats = cats;
    }
    if (Array.isArray(raw.tx)) d.tx = raw.tx.filter(function (t) {
      return t && typeof t.id === 'string' && (t.type === 'expense' || t.type === 'income') && Number.isInteger(t.amt) && t.amt > 0 &&
        typeof t.cat === 'string' && validDate(t.date);
    }).map(function (t) { t.cur = typeof t.cur === 'string' ? t.cur : d.currency; t.note = String(t.note || ''); return t; });
    if (raw.budgets && typeof raw.budgets === 'object') {
      d.budgets.total = raw.budgets.total > 0 ? raw.budgets.total : null;
      var bc = raw.budgets.cats || {};
      Object.keys(bc).forEach(function (k) { if (bc[k] > 0) d.budgets.cats[k] = bc[k]; });
    }
    if (Array.isArray(raw.recurring)) d.recurring = raw.recurring.filter(function (r) {
      return r && typeof r.id === 'string' && Number.isInteger(r.amt) && r.amt > 0 && /^\d{4}-\d{2}$/.test(r.start) && typeof r.cat === 'string';
    });
    return d;
  }

  var api = {
    digits: digits, toMajor: toMajor, majorString: majorString, parseAmount: parseAmount,
    newDoc: newDoc, validate: validate, defaultCats: defaultCats,
    addCategory: addCategory, updateCategory: updateCategory, removeCategory: removeCategory,
    addTx: addTx, updateTx: updateTx, deleteTx: deleteTx,
    summary: summary, days: days, trend: trend, search: search, guessCategory: guessCategory, frequent: frequent,
    addRecurring: addRecurring, updateRecurring: updateRecurring, deleteRecurring: deleteRecurring, applyRecurring: applyRecurring,
    toCSV: toCSV, parseCSV: parseCSV, parseDate: parseDate, guessColumns: guessColumns, importRows: importRows,
    addMonths: addMonths, daysInMonth: daysInMonth, validDate: validDate, uid: uid
  };
  root.VaultBudget = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
