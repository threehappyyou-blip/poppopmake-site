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
  var PHOTO_RE = /^[a-z0-9]{1,40}$/;
  var RATE_RE = /^[gw]$/;
  function ymOf(date) { return date.slice(0, 7); }
  function addDays(date, n) { var d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function weekday(date) { return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay(); }
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
      else if (lastDot >= 0) { if (s.split('.').length === 2 && s.length - lastDot - 1 !== 3) dec = lastDot; }   // "1.234" is a thousand
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

  // ---------- calculator in the amount box: "12000+3500", "4500x3", "30000/4" ----------
  function calcAmount(input, cur) {
    var s = String(input === null || input === undefined ? '' : input)
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48); })
      .replace(/＋/g, '+').replace(/[−－–]/g, '-').replace(/[×xX＊]/g, '*').replace(/[÷／]/g, '/').replace(/\s+/g, '');
    if (!/[+\-*\/]/.test(s.replace(/^[+\-]/, ''))) { var v = parseAmount(s, cur); return { value: v && v > 0 ? v : null, expr: false }; }
    var parts = s.split(/([+\-*\/])/).filter(function (x) { return x !== ''; });
    if (parts.length < 3 || /[+\-*\/]/.test(parts[0]) || /[+\-*\/]/.test(parts[parts.length - 1])) return { value: null, expr: true };
    // numbers are amounts (in minor units) after + and −, plain counts after × and ÷
    var terms = [], cur0 = parseAmount(parts[0], cur);
    if (cur0 === null) return { value: null, expr: true };
    var acc = cur0, sign = 1;
    for (var i = 1; i < parts.length; i += 2) {
      var op = parts[i], txt = parts[i + 1];
      if (!txt || /[+\-*\/]/.test(txt)) return { value: null, expr: true };
      if (op === '*' || op === '/') {
        var n = Number(txt.replace(/,/g, ''));
        if (!isFinite(n) || n <= 0) return { value: null, expr: true };
        acc = op === '*' ? acc * n : acc / n;
      } else {
        terms.push(sign * acc);
        var a = parseAmount(txt, cur); if (a === null) return { value: null, expr: true };
        acc = a; sign = op === '+' ? 1 : -1;
      }
    }
    terms.push(sign * acc);
    var total = Math.round(terms.reduce(function (x, y) { return x + y; }, 0));
    return { value: total > 0 ? total : null, expr: true };
  }

  // ---------- how much can be spent today: what is left of the monthly budget, spread over the days left ----------
  function dailyAllowance(doc, today) {
    var tb = doc.budgets && doc.budgets.total; if (!(tb > 0)) return null;
    var ym = ymOf(today), spent = 0, todaySpent = 0;
    doc.tx.forEach(function (t) {
      if (t.type !== 'expense' || ymOf(t.date) !== ym || t.cur !== doc.currency) return;
      spent += t.amt; if (t.date === today) todaySpent += t.amt;
    });
    var reserved = upcomingFixed(doc, today).total;       // rent, subscriptions … still to be added this month
    var daysLeft = daysInMonth(ym) - (+today.slice(8, 10)) + 1, leftBefore = tb - (spent - todaySpent) - reserved;
    if (spent > tb) return { daysLeft: daysLeft, perDay: 0, todaySpent: todaySpent, todayLeft: 0, over: spent - tb, reserved: reserved, short: 0 };
    if (leftBefore <= 0) return { daysLeft: daysLeft, perDay: 0, todaySpent: todaySpent, todayLeft: -todaySpent, over: 0, reserved: reserved, short: -leftBefore };
    var perDay = Math.floor(leftBefore / daysLeft);
    return { daysLeft: daysLeft, perDay: perDay, todaySpent: todaySpent, todayLeft: perDay - todaySpent, over: 0, reserved: reserved, short: 0 };
  }

  // Repeating expenses that will still be added later this month (not yet added, active, already started).
  function upcomingFixed(doc, today) {
    var ym = ymOf(today), day = +today.slice(8, 10), dim = daysInMonth(ym), items = [], total = 0;
    (doc.recurring || []).forEach(function (r) {
      if (r.freq === 'week') {                       // the weekly ones still to come this month
        if (!r.active || r.type !== 'expense' || (r.cur || doc.currency) !== doc.currency) return;
        var dt = r.lastDate ? addDays(r.lastDate, 7) : r.startDate, g = 0;
        while (dt <= today && g++ < 3000) dt = addDays(dt, 7);
        for (; dt.slice(0, 7) === ym && g++ < 3000; dt = addDays(dt, 7)) { items.push({ id: r.id, note: r.note, cat: r.cat, amt: r.amt, day: +dt.slice(8, 10) }); total += r.amt; }
        return;
      }
      if (!r.active || r.type !== 'expense' || (r.cur || doc.currency) !== doc.currency || r.start > ym || (r.last && r.last >= ym)) return;
      var due = Math.min(r.day, dim);
      if (due <= day) return;          // due today or earlier: applyRecurring adds it, so it is already in "spent"
      items.push({ id: r.id, note: r.note, cat: r.cat, amt: r.amt, day: due }); total += r.amt;
    });
    items.sort(function (a, b) { return a.day - b.day; });
    return { total: total, items: items };
  }

  // ---------- what is coming: payment days ahead (dates and how many — nothing else) ----------
  // Used for reminders outside the app (Android notifications), which must not carry names or amounts.
  function nextDue(r, from) {          // first due date strictly after `from`
    if (r.freq === 'week') { var dt = r.lastDate ? addDays(r.lastDate, 7) : r.startDate, g = 0; while (dt <= from && g++ < 3000) dt = addDays(dt, 7); return dt; }
    for (var m = ymOf(from), k = 0; k < 600; k++, m = addMonths(m, 1)) {
      if (m < r.start || (r.last && m <= r.last)) continue;
      var due = m + '-' + pad(Math.min(r.day, daysInMonth(m)));
      if (due > from) return due;
    }
    return null;
  }
  function dueSchedule(doc, today, days) {
    var end = addDays(today, days || 35), count = {};
    (doc.recurring || []).forEach(function (r) {
      if (!r.active || r.type !== 'expense') return;
      var d = nextDue(r, addDays(today, -1)), g = 0;
      while (d && d <= end && g++ < 400) {
        if (d >= today) count[d] = (count[d] || 0) + 1;
        d = r.freq === 'week' ? addDays(d, 7) : nextDue(Object.assign({}, r, { last: ymOf(d) }), d);
      }
    });
    return Object.keys(count).sort().map(function (d) { return { d: d, n: count[d] }; });
  }
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, ' '); }
  // Every repeating payment as a calendar event that repeats by itself, with a reminder the evening/morning before.
  function recurringIcs(doc, o) {
    var BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PopPopMake//Budget//EN', 'CALSCALE:GREGORIAN'];
    var stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    (doc.recurring || []).forEach(function (r) {
      if (!r.active || r.type !== 'expense') return;
      var first = nextDue(r, addDays(o.today, -1)); if (!first) return;
      var title = o.hideAmounts ? o.label : o.title(r) + ' ' + o.money(r.amt, r.cur);
      var next = addDays(first, 1);
      out.push('BEGIN:VEVENT', 'UID:ppm-rec-' + r.id + '@poppopmake.com', 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + first.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + next.replace(/-/g, ''),
        r.freq === 'week' ? 'RRULE:FREQ=WEEKLY;BYDAY=' + BYDAY[r.wd] : 'RRULE:FREQ=MONTHLY;BYMONTHDAY=' + r.day,
        'SUMMARY:' + icsText(title),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(title), 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return out.join('\r\n') + '\r\n';
  }

  // ---------- a year at a glance ----------
  function yearSummary(doc, year, today) {
    var months = [], byCat = {}, income = 0, expense = 0;
    for (var m = 1; m <= 12; m++) months.push({ ym: year + '-' + pad(m), income: 0, expense: 0 });
    doc.tx.forEach(function (t) {
      if (t.date.slice(0, 4) !== year || t.cur !== doc.currency) return;
      var mo = months[+t.date.slice(5, 7) - 1];
      if (t.type === 'income') { mo.income += t.amt; income += t.amt; }
      else { mo.expense += t.amt; expense += t.amt; byCat[t.cat] = (byCat[t.cat] || 0) + t.amt; }
    });
    var thisYear = today && today.slice(0, 4) === year, monthsSoFar = thisYear ? +today.slice(5, 7) : 12;
    var cats = Object.keys(byCat).map(function (k) { return { cat: k, amt: byCat[k] }; }).sort(function (a, b) { return b.amt - a.amt; });
    var top = months.reduce(function (best, mo) { return mo.expense > (best ? best.expense : 0) ? mo : best; }, null);
    return { year: year, months: months, byCat: cats, income: income, expense: expense, net: income - expense,
      avgExpense: Math.round(expense / monthsSoFar), topMonth: top ? top.ym : null };
  }
  function yearsWithData(doc) {
    var ys = {}; doc.tx.forEach(function (t) { ys[t.date.slice(0, 4)] = true; });
    return Object.keys(ys).sort().reverse();
  }

  // ---------- payment methods (optional: cash, cards, accounts) ----------
  var METHOD_KINDS = ['cash', 'card', 'bank', 'other'];
  function cleanMethod(m) {
    if (!m || typeof m.id !== 'string' || !/^[a-z0-9]{1,40}$/.test(m.id) || typeof m.name !== 'string' || !m.name.trim()) return null;
    return { id: m.id, name: m.name.trim().slice(0, 30), emoji: typeof m.emoji === 'string' ? Array.from(m.emoji).slice(0, 4).join('') : '',
      kind: METHOD_KINDS.indexOf(m.kind) >= 0 ? m.kind : 'other' };
  }
  function addMethod(doc, m) {
    if (!doc.methods) doc.methods = [];
    if (doc.methods.length >= 30) return null;
    var x = cleanMethod({ id: uid(), name: m.name, emoji: m.emoji, kind: m.kind });
    if (x) doc.methods.push(x);
    return x;
  }
  function updateMethod(doc, id, patch) {
    var m = (doc.methods || []).find(function (x) { return x.id === id; });
    if (!m) return false;
    var x = cleanMethod({ id: id, name: patch.name !== undefined ? patch.name : m.name, emoji: patch.emoji !== undefined ? patch.emoji : m.emoji, kind: patch.kind !== undefined ? patch.kind : m.kind });
    if (!x) return false;
    m.name = x.name; m.emoji = x.emoji; m.kind = x.kind;
    return true;
  }
  function removeMethod(doc, id) {
    doc.methods = (doc.methods || []).filter(function (m) { return m.id !== id; });
    doc.tx.forEach(function (t) { if (t.pm === id) delete t.pm; });
    (doc.recurring || []).forEach(function (r) { if (r.pm === id) delete r.pm; });
  }
  // Spending this month per method, in the order of the methods; entries without a method last (id null).
  function methodTotals(doc, ym) {
    var by = {}, none = 0;
    doc.tx.forEach(function (t) {
      if (t.type !== 'expense' || ymOf(t.date) !== ym || t.cur !== doc.currency) return;
      if (t.pm && (doc.methods || []).some(function (m) { return m.id === t.pm; })) by[t.pm] = (by[t.pm] || 0) + t.amt; else none += t.amt;
    });
    var out = (doc.methods || []).filter(function (m) { return by[m.id]; }).map(function (m) { return { id: m.id, amt: by[m.id] }; });
    if (none) out.push({ id: null, amt: none });
    return out;
  }
  function photosOf(doc) { return doc.tx.filter(function (t) { return t.photo; }).map(function (t) { return t.photo; }); }

  // ---------- savings goals: kept apart from spending ----------
  function goalSaved(g) { return g.moves.reduce(function (s, m) { return s + m.amt; }, 0); }
  function pctOf(saved, target) { return Math.max(0, Math.min(100, Math.floor(saved * 100 / target))); }
  function addGoal(doc, o) {
    doc.goals = doc.goals || [];
    if (doc.goals.length >= 50) return null;
    var g = { id: uid(), name: String(o.name || '').slice(0, 40), emoji: String(o.emoji || '').slice(0, 8), target: Math.round(o.target),
      due: validDate(o.due) ? o.due : null, created: Date.now(), done: null, moves: [] };
    if (!(g.target > 0)) return null;
    doc.goals.push(g);
    return g;
  }
  function updateGoal(doc, id, p) {
    var g = (doc.goals || []).find(function (x) { return x.id === id; }); if (!g) return false;
    if (p.name !== undefined) g.name = String(p.name).slice(0, 40);
    if (p.emoji !== undefined) g.emoji = String(p.emoji).slice(0, 8);
    if (p.target !== undefined && Math.round(p.target) > 0) g.target = Math.round(p.target);
    if (p.due !== undefined) g.due = validDate(p.due) ? p.due : null;
    var saved = goalSaved(g);
    if (saved >= g.target && !g.done) g.done = Date.now(); else if (saved < g.target) g.done = null;
    return true;
  }
  function deleteGoal(doc, id) {
    var i = (doc.goals || []).findIndex(function (x) { return x.id === id; });
    return i < 0 ? null : doc.goals.splice(i, 1)[0];
  }
  // Put money in (amt > 0) or take it out (amt < 0). Says which milestone (25/50/75) was just passed and whether the goal was just reached.
  function goalMove(doc, id, amt, date, note) {
    var g = (doc.goals || []).find(function (x) { return x.id === id; });
    amt = Math.round(amt);
    if (!g || !amt || !validDate(date) || g.moves.length >= 2000) return null;
    var before = goalSaved(g);
    if (before + amt < 0) return null;
    g.moves.push({ id: uid(), date: date, amt: amt, note: String(note || '').slice(0, 80) });
    var after = before + amt, pb = pctOf(before, g.target), pa = pctOf(after, g.target), ms = null;
    [25, 50, 75].forEach(function (m) { if (pb < m && pa >= m && pa < 100) ms = m; });
    var reached = false;
    if (after >= g.target && !g.done) { g.done = Date.now(); reached = true; }
    else if (after < g.target) g.done = null;
    return { goal: g, before: pb, after: pa, milestone: ms, reached: reached };
  }
  function goalProgress(g, today) {
    var saved = goalSaved(g), left = Math.max(0, g.target - saved), out = { saved: saved, pct: pctOf(saved, g.target), left: left, monthsLeft: null, perMonth: null };
    if (g.due && left > 0) {
      var m = (+g.due.slice(0, 4) - +today.slice(0, 4)) * 12 + (+g.due.slice(5, 7) - +today.slice(5, 7)) + 1;
      out.monthsLeft = Math.max(1, m); out.perMonth = Math.ceil(left / out.monthsLeft);
    }
    return out;
  }
  function goalsSavedIn(doc, ym) {
    var s = 0; (doc.goals || []).forEach(function (g) { g.moves.forEach(function (m) { if (ymOf(m.date) === ym) s += m.amt; }); }); return s;
  }
  function cleanGoal(g) {
    if (!g || typeof g !== 'object' || typeof g.id !== 'string' || !(Number.isInteger(g.target) && g.target > 0)) return null;
    var moves = (Array.isArray(g.moves) ? g.moves : []).filter(function (m) { return m && Number.isInteger(m.amt) && m.amt !== 0 && validDate(m.date); })
      .slice(0, 2000).map(function (m) { return { id: typeof m.id === 'string' ? m.id : uid(), date: m.date, amt: m.amt, note: String(m.note || '').slice(0, 80) }; });
    return { id: g.id, name: String(g.name || '').slice(0, 40), emoji: String(g.emoji || '').slice(0, 8), target: g.target, due: validDate(g.due) ? g.due : null,
      created: +g.created || Date.now(), done: +g.done > 0 ? +g.done : null, moves: moves };
  }

  function newDoc(lang, currency) {
    return { v: 1, currency: currency || 'USD', cats: defaultCats(), tx: [], budgets: { total: null, cats: {} }, recurring: [], goals: [], methods: [] };
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
    if (t.pm && typeof t.pm === 'string') tx.pm = t.pm;
    if (t.photo && PHOTO_RE.test(t.photo)) tx.photo = t.photo;
    if (Number.isInteger(t.at) && t.at >= 0 && t.at < 1440) tx.at = t.at;      // minute of the day it was written (only when written that day)
    if (RATE_RE.test(t.rate)) tx.rate = t.rate;                                 // the person's own verdict: 'g' worth it, 'w' a waste
    doc.tx.push(tx);
    return tx;
  }
  function updateTx(doc, id, patch) {
    var t = doc.tx.find(function (x) { return x.id === id; });
    if (!t) return false;
    ['type', 'amt', 'cur', 'cat', 'date', 'note'].forEach(function (k) { if (patch[k] !== undefined) t[k] = patch[k]; });
    if (patch.note !== undefined) t.note = String(patch.note).slice(0, 300);
    ['pm', 'photo'].forEach(function (k) {                       // null removes it
      if (patch[k] === null || patch[k] === '') delete t[k];
      else if (typeof patch[k] === 'string' && (k !== 'photo' || PHOTO_RE.test(patch[k]))) t[k] = patch[k];
    });
    if (patch.rate === null || patch.rate === '') delete t.rate;
    else if (RATE_RE.test(patch.rate)) t.rate = patch.rate;
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
    if (best) return best.cat;
    // a bank file writes "스타벅스 강남점", "스타벅스 역삼점": the shop's name (first word) is enough
    var w = k.split(/\s+/)[0];
    if (w.length < 2 || /^\d+$/.test(w)) return null;
    doc.tx.forEach(function (t) { if (t.note.trim().toLowerCase().split(/\s+/)[0] === w && (!best || t.date >= best.date)) best = t; });
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

  // ---------- one line: "점심 9000", "택시 1만2천", "월급 +300만", "어제 커피 4500" ----------
  // Korean money words: 억 (100,000,000), 만 (10,000), 천 (1,000), 백 (100) — "1억2천만", "3.5만", "2천5백".
  function koWords(s) {
    function small(x) {
      var v = 0, m;
      if ((m = x.match(/^([\d.]*)천(.*)$/))) { v += (m[1] ? parseFloat(m[1]) : 1) * 1000; x = m[2]; }
      if ((m = x.match(/^([\d.]*)백(.*)$/))) { v += (m[1] ? parseFloat(m[1]) : 1) * 100; x = m[2]; }
      if (x) { if (!/^\d+(\.\d+)?$/.test(x)) return NaN; v += parseFloat(x); }
      return v;
    }
    var v = 0, m;
    if ((m = s.match(/^(.*?)억(.*)$/))) { v += (m[1] ? small(m[1]) : 1) * 1e8; s = m[2]; }
    if ((m = s.match(/^(.*?)만(.*)$/))) { v += (m[1] ? small(m[1]) : 1) * 1e4; s = m[2]; }
    v += s ? small(s) : 0;
    return isFinite(v) ? v : NaN;
  }
  var QUICK_AMT = /^([+＋]?)((?:\d[\d,.]*|[\d.]*(?=[억만천백]))(?:[억만천백][\d,.]*)*)(원|₩|\$|円|엔|won|krw|usd)?$/i;
  var YESTERDAY = /^(어제|yesterday|昨日|きのう)$/i;
  function quickParse(text, cur) {
    var line = String(text || '').trim().replace(/([^\d\s+,.억만천백])([+]?\d[\d,.]*(?:[억만천백][\d,.]*)*(?:원|円|엔)?)$/, '$1 $2');   // "점심9000" → "점심 9000"
    var words = line.split(/\s+/).filter(Boolean), amt = null, plus = false, day = 0, keep = [];
    for (var i = words.length - 1; i >= 0; i--) {             // the last money-looking word is the amount
      var m = amt === null && words[i].match(QUICK_AMT);
      if (m && /\d/.test(m[2])) {
        var raw = m[2].replace(/,/g, ''), minor;
        if (/[억만천백]/.test(raw)) { var v = koWords(raw); minor = isFinite(v) && v > 0 ? Math.round(v * Math.pow(10, digits(cur))) : null; }
        else minor = parseAmount(m[2], cur);
        if (minor && minor > 0) { amt = minor; plus = !!m[1]; continue; }
      }
      keep.unshift(words[i]);
    }
    keep = keep.filter(function (w) { if (YESTERDAY.test(w)) { day = -1; return false; } return true; });
    var note = keep.join(' ').slice(0, 300);
    var type = plus || INCOME_WORDS.test(note) ? 'income' : 'expense';
    return { amt: amt, note: note, type: type, day: day };
  }
  // Everyday words → category, for the first time a word is used (after that, what the person chose wins).
  var INCOME_WORDS = /월급|급여|상여|보너스|용돈받|부업|알바비|이자|환불|salary|paycheck|bonus|refund|interest|給料|給与|ボーナス|返金/i;
  var WORDS = [
    ['salary', /월급|급여|salary|paycheck|給料|給与/i], ['bonus', /보너스|상여|bonus|ボーナス/i], ['side', /부업|알바|프리랜스|freelance|side|副業/i],
    ['interest', /이자|interest|利息/i], ['refund', /환불|refund|返金/i],
    ['subscriptions', /넷플릭스|유튜브|멜론|구독|스포티파이|디즈니|티빙|쿠팡플레이|netflix|youtube|spotify|subscription|サブスク/i],
    ['cafe', /커피|카페|아아|라떼|아메리카노|스타벅스|스벅|이디야|메가커피|빽다방|디저트|케이크|coffee|cafe|café|latte|starbucks|コーヒー|カフェ|スタバ/i],
    ['groceries', /마트|장보기|이마트|홈플러스|롯데마트|코스트코|쿠팡|마켓컬리|컬리|편의점|gs25|cu\b|세븐일레븐|이마트24|grocer|supermarket|costco|walmart|スーパー|コンビニ/i],
    ['food', /점심|저녁|아침|식사|밥|배달|한식|중식|양식|일식|치킨|피자|국밥|라면|분식|김밥|떡볶이|햄버거|회식|야식|배민|요기요|restaurant|lunch|dinner|breakfast|meal|pizza|burger|ランチ|昼|夕食|朝食|ご飯|外食/i],
    ['transport', /택시|버스|지하철|교통|주유|기름|톨게이트|하이패스|주차|기차|ktx|srt|카카오T|taxi|bus|subway|metro|uber|lyft|gas|fuel|parking|train|タクシー|電車|バス|ガソリン|駐車/i],
    ['housing', /월세|관리비|전세|rent|家賃/i], ['utilities', /전기|가스비|수도|공과금|난방|electric|water bill|utility|utilities|光熱|電気代|水道/i],
    ['phone', /통신|핸드폰|휴대폰|폰요금|인터넷|phone|mobile|internet|携帯|スマホ代/i],
    ['health', /병원|약국|약값|의원|치과|한의원|안과|hospital|pharmacy|clinic|doctor|dentist|病院|薬/i],
    ['education', /학원|강의|교재|책|수강|교육|tuition|course|class|book|塾|本|授業/i],
    ['travel', /여행|호텔|숙소|비행기|항공|에어비앤비|travel|hotel|flight|airbnb|旅行|ホテル|航空/i],
    ['gifts', /선물|축의금|조의금|부조|gift|present|プレゼント|ご祝儀/i], ['pets', /사료|동물병원|간식\s*펫|펫|pet|vet|ペット/i],
    ['fun', /영화|게임|노래방|공연|전시|취미|술자리|술집|호프|movie|cinema|game|concert|映画|ゲーム|カラオケ/i],
    ['shopping', /쇼핑|옷|신발|다이소|올리브영|무신사|화장품|shopping|clothes|shoes|amazon|買い物|服|靴/i]
  ];
  function guessQuick(doc, note, type) {
    var usable = function (id) { var c = (doc.cats || []).find(function (x) { return x.id === id; }); return c && !c.hidden && c.type === type ? id : null; };
    var past = guessCategory(doc, note);
    if (past && usable(past)) return past;
    for (var i = 0; i < WORDS.length; i++) if (WORDS[i][1].test(note) && usable(WORDS[i][0])) return WORDS[i][0];
    return null;
  }
  // Short amounts for small spaces (the calendar): 9천, 3.5만, 1.2억 · 3.5万 · 9.5k
  function shortAmount(minor, cur) {
    var v = Math.abs(minor) / Math.pow(10, digits(cur)), one = function (x) { return String(Math.round(x * 10) / 10); };
    if (cur === 'KRW') return v >= 1e8 ? one(v / 1e8) + '억' : v >= 1e4 ? one(v / 1e4) + '만' : v >= 1e3 ? one(v / 1e3) + '천' : String(Math.round(v));
    if (cur === 'JPY' || cur === 'CNY') return v >= 1e8 ? one(v / 1e8) + '億' : v >= 1e4 ? one(v / 1e4) + '万' : String(Math.round(v));
    return v >= 1e6 ? one(v / 1e6) + 'M' : v >= 1e3 ? one(v / 1e3) + 'k' : one(v);
  }

  // ---------- tap-to-log buttons: an emoji, then the amount ----------
  // Each button is a category plus a label written as the note ("중식" under Food), so charts stay tidy and the
  // label still says what it was. Their order follows use; the amounts offered are the ones used with that button.
  var TILES = {
    ko: [['coffee', '☕', '커피', 'cafe'], ['korean', '🍚', '한식', 'food'], ['chinese', '🥟', '중식', 'food'], ['western', '🍝', '양식', 'food'],
      ['japanese', '🍣', '일식', 'food'], ['snack', '🍢', '분식', 'food'], ['delivery', '🛵', '배달', 'food'], ['cvs', '🏪', '편의점', 'groceries'],
      ['grocery', '🛒', '장보기', 'groceries'], ['taxi', '🚕', '택시', 'transport'], ['transit', '🚌', '교통', 'transport'], ['drinks', '🍺', '술자리', 'fun']],
    en: [['coffee', '☕', 'Coffee', 'cafe'], ['lunch', '🥪', 'Lunch', 'food'], ['dinner', '🍽️', 'Dinner out', 'food'], ['fastfood', '🍔', 'Fast food', 'food'],
      ['pizza', '🍕', 'Pizza', 'food'], ['noodles', '🍜', 'Noodles', 'food'], ['delivery', '🛵', 'Delivery', 'food'], ['cvs', '🏪', 'Convenience store', 'groceries'],
      ['grocery', '🛒', 'Groceries', 'groceries'], ['taxi', '🚕', 'Taxi', 'transport'], ['transit', '🚌', 'Transit', 'transport'], ['drinks', '🍺', 'Drinks', 'fun']],
    ja: [['coffee', '☕', 'コーヒー', 'cafe'], ['bento', '🍱', '弁当', 'food'], ['ramen', '🍜', 'ラーメン', 'food'], ['sushi', '🍣', '寿司', 'food'],
      ['curry', '🍛', 'カレー', 'food'], ['dineout', '🍽️', '外食', 'food'], ['delivery', '🛵', 'デリバリー', 'food'], ['cvs', '🏪', 'コンビニ', 'groceries'],
      ['grocery', '🛒', 'スーパー', 'groceries'], ['taxi', '🚕', 'タクシー', 'transport'], ['train', '🚃', '電車', 'transport'], ['drinks', '🍺', '飲み会', 'fun']]
  };
  function tileMatches(t, tile) { var n = t.note.trim().toLowerCase(), l = tile.label.toLowerCase(); return t.type === 'expense' && t.cat === tile.cat && (n === l || n.indexOf(l + ' ') === 0); }
  function tiles(doc, lang, today) {
    var ok = function (id) { var c = (doc.cats || []).find(function (x) { return x.id === id; }); return c && !c.hidden; };
    var list = (TILES[lang] || TILES.en).map(function (x, i) { return { key: x[0], emoji: x[1], label: x[2], cat: ok(x[3]) ? x[3] : 'other', i: i, n: 0 }; });
    var from = today ? addDays(today, -90) : '';
    doc.tx.forEach(function (t) { if (t.date < from) return; list.forEach(function (tl) { if (tileMatches(t, tl)) tl.n++; }); });
    return list.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
  }
  function tileAmounts(doc, tile, today, n) {
    var from = today ? addDays(today, -180) : '', count = {}, last = {};
    doc.tx.forEach(function (t) { if (t.date < from || t.cur !== doc.currency || !tileMatches(t, tile)) return; count[t.amt] = (count[t.amt] || 0) + 1; if (!last[t.amt] || t.date > last[t.amt]) last[t.amt] = t.date; });
    return Object.keys(count).map(Number).sort(function (a, b) { return count[b] - count[a] || (last[a] < last[b] ? 1 : -1); }).slice(0, n || 4);
  }

  // ---------- repeating entries ----------
  function addRecurring(doc, r) {
    var rec = { id: uid(), type: r.type === 'income' ? 'income' : 'expense', amt: Math.round(r.amt), cur: r.cur || doc.currency, cat: r.cat,
      note: String(r.note || '').slice(0, 300), day: Math.min(31, Math.max(1, r.day | 0)), start: r.start, last: null, active: true };
    if (r.freq === 'week' && validDate(r.startDate)) {           // every week on the start date's weekday
      rec.freq = 'week'; rec.startDate = r.startDate; rec.wd = weekday(r.startDate); rec.lastDate = null;
      rec.start = r.startDate.slice(0, 7); rec.day = +r.startDate.slice(8, 10);
    }
    if (r.pm && typeof r.pm === 'string') rec.pm = r.pm;
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
      if (r.freq === 'week') {
        var dt = r.lastDate ? addDays(r.lastDate, 7) : r.startDate, g = 0;
        while (dt <= today && g++ < 3000) {
          addTx(doc, { type: r.type, amt: r.amt, cur: r.cur, cat: r.cat, date: dt, note: r.note, rid: r.id, pm: r.pm });
          r.lastDate = dt; r.last = dt.slice(0, 7); added++;
          dt = addDays(dt, 7);
        }
        return;
      }
      var m = r.last ? addMonths(r.last, 1) : r.start;
      var guard = 0;
      while (m <= nowYm && guard++ < 600) {
        var day = Math.min(r.day, daysInMonth(m));
        if (m === nowYm && day > nowDay) break;
        addTx(doc, { type: r.type, amt: r.amt, cur: r.cur, cat: r.cat, date: m + '-' + pad(day), note: r.note, rid: r.id, pm: r.pm });
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
    var rows = [['date', 'type', 'category', 'amount', 'currency', 'note', 'payment']];
    var mname = {}; (doc.methods || []).forEach(function (m) { mname[m.id] = m.name; });
    doc.tx.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (t) {
      rows.push([t.date, t.type, catName ? catName(t.cat) : t.cat, majorString(t.amt, t.cur), t.cur, t.note, t.pm ? mname[t.pm] || '' : '']);
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
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function year4(y) { return y < 100 ? 2000 + y : y; }
  // order: 'dmy' or 'mdy' for dates like 03/04/2026 where either reading is possible (decided once per file).
  function parseDate(s, order) {
    s = String(s || '').trim();
    var m, y, mo, d;
    if ((m = s.match(/^(\d{4})\s*[-\/.년年]\s*(\d{1,2})\s*[-\/.월月]\s*(\d{1,2})/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(?!\d)/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/))) {
      var a = +m[1], b = +m[2]; y = year4(+m[3]);
      if (a > 12 || (b <= 12 && order === 'dmy')) { d = a; mo = b; } else { mo = a; d = b; }
    }
    else if ((m = s.match(/^(\d{1,2})[\s\-.\/]*([A-Za-z]{3})[A-Za-z]*\.?[\s\-.\/,]*(\d{4}|\d{2})(?!\d)/)) && MONTHS[m[2].toLowerCase()]) { d = +m[1]; mo = MONTHS[m[2].toLowerCase()]; y = year4(+m[3]); }
    else if ((m = s.match(/^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MONTHS[m[1].toLowerCase()]) { mo = MONTHS[m[1].toLowerCase()]; d = +m[2]; y = +m[3]; }
    else return null;
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
    res.order = dateOrder(rows.slice(res.header ? 1 : 0), res.date);
    return res;
  }
  // 03/04/2026: a later row such as 13/04 or 04/13 settles which number is the day for the whole file.
  // With no such row: the order usual for the file's currency is used when the import runs (US dollars month-first).
  function dateOrder(rows, col) {
    if (col === null || col === undefined) return null;
    var dmy = 0, mdy = 0;
    rows.forEach(function (r) {
      var m = String(r[col] || '').trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/);
      if (!m) return;
      if (+m[1] > 12 && +m[2] <= 12) dmy++; else if (+m[2] > 12 && +m[1] <= 12) mdy++;
    });
    return dmy > mdy ? 'dmy' : mdy > dmy ? 'mdy' : null;
  }
  // map: {header, date, desc, amount|null, out|null, in|null, flip}
  function importRows(doc, rows, map, cur) {
    cur = cur || doc.currency;
    // Already-imported check by counting: if the app already has two identical bus fares on a day, the first two such
    // rows in a file are skipped and a third is added. Two identical purchases in one file are both kept.
    var have = {}, inFile = {}, added = 0, skipped = 0, bad = 0;
    var order = map.order || (cur === 'USD' ? 'mdy' : 'dmy');
    doc.tx.forEach(function (t) { var k = [t.date, t.type, t.amt, t.cur, t.note.trim().toLowerCase()].join('|'); have[k] = (have[k] || 0) + 1; });
    rows.slice(map.header ? 1 : 0).forEach(function (r) {
      var date = map.date !== null && map.date !== undefined ? parseDate(r[map.date], order) : null;
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
      inFile[key] = (inFile[key] || 0) + 1;
      if (inFile[key] <= (have[key] || 0)) { skipped++; return; }
      var cat = guessQuick(doc, note, type) || (type === 'income' ? 'other_income' : 'other');
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
    }).map(function (t) { t.cur = typeof t.cur === 'string' ? t.cur : d.currency; t.note = String(t.note || ''); if (t.photo !== undefined && !PHOTO_RE.test(String(t.photo))) delete t.photo; if (t.at !== undefined && !(Number.isInteger(t.at) && t.at >= 0 && t.at < 1440)) delete t.at; if (t.rate !== undefined && !RATE_RE.test(t.rate)) delete t.rate; return t; });
    if (Array.isArray(raw.methods)) d.methods = raw.methods.map(cleanMethod).filter(Boolean).slice(0, 30);
    var mids = {}; d.methods.forEach(function (m) { mids[m.id] = true; });
    d.tx.forEach(function (t) { if (t.pm !== undefined && !mids[t.pm]) delete t.pm; });
    if (raw.budgets && typeof raw.budgets === 'object') {
      d.budgets.total = raw.budgets.total > 0 ? raw.budgets.total : null;
      var bc = raw.budgets.cats || {};
      Object.keys(bc).forEach(function (k) { if (bc[k] > 0) d.budgets.cats[k] = bc[k]; });
    }
    if (Array.isArray(raw.recurring)) d.recurring = raw.recurring.filter(function (r) {
      return r && typeof r.id === 'string' && Number.isInteger(r.amt) && r.amt > 0 && /^\d{4}-\d{2}$/.test(r.start) && typeof r.cat === 'string' &&
        (r.freq !== 'week' || (validDate(r.startDate) && r.wd >= 0 && r.wd <= 6 && (r.lastDate === null || r.lastDate === undefined || validDate(r.lastDate))));
    });
    if (Array.isArray(raw.goals)) d.goals = raw.goals.map(cleanGoal).filter(Boolean).slice(0, 50);
    d.recurring.forEach(function (r) { if (r.pm !== undefined && !mids[r.pm]) delete r.pm; });
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
    addMonths: addMonths, daysInMonth: daysInMonth, validDate: validDate, uid: uid,
    calcAmount: calcAmount, dueSchedule: dueSchedule, recurringIcs: recurringIcs, quickParse: quickParse, guessQuick: guessQuick, tiles: tiles, tileAmounts: tileAmounts, shortAmount: shortAmount, addDays: addDays, weekday: weekday, dailyAllowance: dailyAllowance, upcomingFixed: upcomingFixed, yearSummary: yearSummary, yearsWithData: yearsWithData,
    addMethod: addMethod, updateMethod: updateMethod, removeMethod: removeMethod, methodTotals: methodTotals, photosOf: photosOf,
    addGoal: addGoal, updateGoal: updateGoal, deleteGoal: deleteGoal, goalMove: goalMove, goalProgress: goalProgress, goalSaved: goalSaved, goalsSavedIn: goalsSavedIn
  };
  root.VaultBudget = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
