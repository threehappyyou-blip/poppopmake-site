/* PopPopMake Vault — the money coach (no screen code, no storage, no network).
 * Reads the budget (and the diary's moods) and says, before the money goes, what is about to happen:
 * the month running over, a category jumping, the evening that usually costs most, money spent on bad days,
 * money the person called a waste. Every line compares the person with their own recent past, carries its
 * numbers (why), and stays quiet until there is enough to go on. Wording lives in vault-i18n (keys 'coach.*').
 * An advice: { id, key, prio, msg, vars, why: [{ msg, vars }], act? }. Money vars: amt, per, sug, yr, w.
 */
(function (root) {
  'use strict';
  var B = root.VaultBudget;
  var MIN_DAYS = 14;                       // comparisons need two weeks of entries first
  var MAX_SHOWN = 2;                       // more than two a day is nagging
  var SLOTS = [['morning', 360, 660], ['lunch', 660, 840], ['afternoon', 840, 1020], ['evening', 1020, 1320]];

  // one "unit" ≈ the price of a coffee-shop tip: 1,000 won, 100 yen, 1 dollar/euro/pound
  function unit(cur) { return cur === 'KRW' ? 1000 : cur === 'JPY' ? 100 : Math.pow(10, B.digits(cur)); }
  function ymOf(d) { return d.slice(0, 7); }
  function dayOf(d) { return +d.slice(8, 10); }
  function round1(x) { return Math.round(x * 10) / 10; }
  function mondayOf(d) { return B.addDays(d, -((B.weekday(d) + 6) % 7)); }
  function expenses(doc) { return doc.tx.filter(function (t) { return t.type === 'expense' && t.cur === doc.currency; }); }
  function firstDate(list) { var f = null; list.forEach(function (t) { if (!f || t.date < f) f = t.date; }); return f; }
  function between(list, from, to) { return list.filter(function (t) { return t.date >= from && t.date <= to; }); }
  function sum(list) { return list.reduce(function (s, t) { return s + t.amt; }, 0); }
  function daysSpan(from, to) { return Math.round((Date.parse(to) - Date.parse(from)) / 864e5); }
  function slotOf(min) { for (var i = 0; i < SLOTS.length; i++) if (min >= SLOTS[i][1] && min < SLOTS[i][2]) return SLOTS[i]; return null; }
  function wasted(list, ym) { return list.filter(function (t) { return t.rate === 'w' && ymOf(t.date) === ym; }); }

  // ---- 1. the month running over the budget
  function pace(doc, ex, today) {
    var tb = doc.budgets && doc.budgets.total; if (!(tb > 0)) return null;
    var ym = ymOf(today), d = dayOf(today), dim = B.daysInMonth(ym), spent = sum(ex.filter(function (t) { return ymOf(t.date) === ym && t.date <= today; }));
    var why = [{ msg: 'coach.w.budget', vars: { amt: tb } }, { msg: 'coach.w.spent', vars: { amt: spent, d: d } }];
    if (spent > tb) return { id: 'over', key: 'over|' + ym, prio: 90, msg: 'coach.over', vars: { amt: spent - tb }, why: why };
    if (d < 5 || d >= dim || spent / tb - d / dim < 0.15) return null;
    var proj = Math.round(spent / d * dim), left = dim - d;
    why.push({ msg: 'coach.w.proj', vars: { amt: proj } });
    return { id: 'pace', key: 'pace|' + ym, prio: 80, msg: 'coach.pace', vars: { amt: proj - tb, n: left, per: Math.floor((tb - spent) / left) }, why: why };
  }

  // ---- 2. one category jumping this week against the four weeks before
  function spike(doc, ex, today, first) {
    var mon = mondayOf(today), from = B.addDays(mon, -28), u = unit(doc.currency);
    if (first > from) return null;
    var now = {}, before = {};
    between(ex, mon, today).forEach(function (t) { var g = now[t.cat] || (now[t.cat] = { amt: 0, n: 0 }); g.amt += t.amt; g.n++; });
    between(ex, from, B.addDays(mon, -1)).forEach(function (t) { before[t.cat] = (before[t.cat] || 0) + t.amt; });
    var best = null;
    Object.keys(now).forEach(function (cat) {
      var avg = (before[cat] || 0) / 4, g = now[cat];
      if (!(avg > 0) || g.amt < avg * 1.8 || g.amt - avg < 20 * u) return;
      if (!best || g.amt - avg > best.ex) best = { cat: cat, ex: g.amt - avg, avg: avg, g: g };
    });
    if (!best) return null;
    return { id: 'spike', key: 'spike|' + best.cat + '|' + mon, prio: 70, msg: 'coach.spike',
      vars: { cat: best.cat, n: best.g.n, amt: best.g.amt, x: round1(best.g.amt / best.avg) },
      why: [{ msg: 'coach.w.week', vars: { from: mon, to: today, cat: best.cat, n: best.g.n, amt: best.g.amt } }, { msg: 'coach.w.avg4', vars: { amt: Math.round(best.avg) } }] };
  }

  // ---- 3. this time of this weekday usually costs money: say so before it starts
  function pattern(doc, ex, today, first, now) {
    if (!(now >= 0)) return null;
    var u = unit(doc.currency), wd = B.weekday(today), seen = {};
    var targets = [slotOf(now), slotOf(now + 90)].filter(function (s) { if (!s || seen[s[0]]) return false; seen[s[0]] = 1; return true; });
    for (var i = 0; i < targets.length; i++) {
      var s = targets[i], days = [], k = 0, total = 0;
      for (var w = 1; w <= 8; w++) { var d = B.addDays(today, -7 * w); if (d >= first) days.push(d); }
      if (days.length < 4) return null;
      days.forEach(function (d) {
        var v = sum(ex.filter(function (t) { return t.date === d && t.at >= s[1] && t.at < s[2]; }));
        if (v > 0) k++; total += v;
      });
      var avg = Math.round(total / days.length);
      if (k < 3 || k / days.length < 0.5 || avg < 10 * u) continue;
      var already = sum(ex.filter(function (t) { return t.date === today && t.at >= s[1] && t.at < s[2]; }));
      if (already >= avg) continue;
      var a = B.dailyAllowance(doc, today), vars = { wd: wd, slot: s[0], amt: avg };
      if (a && a.todayLeft > 0) vars.per = a.todayLeft;
      return { id: 'pattern', key: 'pat|' + today + '|' + s[0], prio: 60, msg: vars.per ? 'coach.patLeft' : 'coach.pat', vars: vars,
        why: [{ msg: 'coach.w.pat', vars: { wd: wd, slot: s[0], n: days.length, k: k } }] };
    }
    return null;
  }

  // ---- 4. money and mood: how much more goes out on bad days (from the diary's mood taps)
  function moodLink(doc, diary, today) {
    var ex = expenses(doc), from = B.addDays(today, -90), m = {}, c = {};
    ((diary && diary.entries) || []).forEach(function (e) {
      if (!e.mood || e.date < from || e.date > today) return;
      m[e.date] = (m[e.date] || 0) + e.mood; c[e.date] = (c[e.date] || 0) + 1;
    });
    var byDay = {}, byDayCat = {};
    ex.forEach(function (t) { byDay[t.date] = (byDay[t.date] || 0) + t.amt; var k = t.date + '|' + t.cat; byDayCat[k] = (byDayCat[k] || 0) + t.amt; });
    var low = [], ok = [];
    Object.keys(m).forEach(function (d) { if (d === today) return; (m[d] / c[d] <= 2 ? low : ok).push(d); });
    if (low.length < 3 || ok.length < 5) return null;
    var avg = function (ds) { return ds.reduce(function (s, d) { return s + (byDay[d] || 0); }, 0) / ds.length; };
    var la = avg(low), oa = avg(ok);
    if (!(oa > 0) || la < oa * 1.5) return null;
    var cats = {};
    Object.keys(byDayCat).forEach(function (k) {
      var d = k.slice(0, 10), cat = k.slice(11);
      if (low.indexOf(d) >= 0) cats[cat] = (cats[cat] || 0) + byDayCat[k] / low.length;
      else if (ok.indexOf(d) >= 0) cats[cat] = (cats[cat] || 0) - byDayCat[k] / ok.length;
    });
    var top = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
    return { x: round1(la / oa), cat: top, lowN: low.length, okN: ok.length, low: Math.round(la), ok: Math.round(oa) };
  }
  function mood(doc, diary, today) {
    var todays = ((diary && diary.entries) || []).filter(function (e) { return e.date === today && e.mood; });
    if (!todays.length || todays[todays.length - 1].mood > 2) return null;
    var r = moodLink(doc, diary, today); if (!r) return null;
    return { id: 'mood', key: 'mood|' + today, prio: 75, msg: 'coach.mood', vars: { x: r.x, cat: r.cat },
      why: [{ msg: 'coach.w.moodLow', vars: { n: r.lowN, amt: r.low } }, { msg: 'coach.w.moodOk', vars: { n: r.okN, amt: r.ok } }] };
  }

  // ---- 5. money the person themselves called a waste (one tap each)
  function waste(doc, ex, today) {
    var ym = ymOf(today), d = dayOf(today), dim = B.daysInMonth(ym), items = wasted(ex, ym);
    var top = function (list) { return list.slice().sort(function (a, b) { return b.amt - a.amt; }).slice(0, 3).map(function (t) { return { msg: 'coach.w.item', vars: { date: t.date, cat: t.cat, note: t.note, amt: t.amt } }; }); };
    if (d <= 3) {
      var pm = B.addMonths(ym, -1), prev = wasted(ex, pm), pw = sum(prev);
      if (pw > 0) return { id: 'wastePrev', key: 'wprev|' + pm, prio: 50, msg: 'coach.wastePrev', vars: { amt: pw, yr: pw * 12, n: prev.length }, why: top(prev) };
    }
    if (!items.length || (items.length < 5 && d < dim - 2)) return null;
    var w = sum(items);
    return { id: 'waste', key: 'waste|' + ym + '|' + (items.length >= 5 ? 5 : 1), prio: 50, msg: 'coach.waste', vars: { amt: w, yr: Math.round(w * 365 / d), n: items.length }, why: top(items) };
  }

  // ---- 6. a repeating payment called a waste three months running
  function fixed(doc, ex, today) {
    var out = null;
    (doc.recurring || []).forEach(function (r) {
      if (out || !r.active || r.type !== 'expense') return;
      var months = {};
      ex.forEach(function (t) { if (t.rid !== r.id || t.date > today) return; var m = ymOf(t.date); months[m] = months[m] || {}; months[m][t.rate || 'none'] = 1; });
      var last3 = Object.keys(months).sort().slice(-3);
      if (last3.length < 3 || !last3.every(function (m) { return months[m].w && !months[m].g; })) return;
      var yearly = r.amt * (r.freq === 'week' ? 52 : 12);
      out = { id: 'fixed', key: 'fixed|' + r.id + '|' + last3[2], prio: 55, msg: 'coach.fixed', vars: { note: r.note, cat: r.cat, amt: yearly },
        why: last3.map(function (m) { return { msg: 'coach.w.fixedMonth', vars: { ym: m } }; }) };
    });
    return out;
  }

  // ---- 7. what this week's usual buy would do for a savings goal
  function goal(doc, ex, today, lang) {
    var g = (doc.goals || []).find(function (x) { return B.goalProgress(x, today).left > 0; });
    if (!g || !B.tiles) return null;
    var mon = mondayOf(today), week = between(ex, mon, today), best = null;
    B.tiles(doc, lang || 'en', today).forEach(function (tl) {
      var list = week.filter(function (t) { var n = t.note.trim().toLowerCase(), l = tl.label.toLowerCase(); return t.cat === tl.cat && (n === l || n.indexOf(l + ' ') === 0); });
      var a = sum(list); if (list.length >= 2 && (!best || a > best.amt)) best = { label: tl.label, amt: a, n: list.length };
    });
    if (!best || best.amt < 5 * unit(doc.currency)) return null;
    var left = B.goalProgress(g, today).left, pct = Math.floor(best.amt * 100 / left);
    if (pct < 1) return null;
    return { id: 'goal', key: 'goal|' + g.id + '|' + mon, prio: 40, msg: 'coach.goal', vars: { label: best.label, n: best.n, amt: best.amt, goal: g.name, pct: Math.min(100, pct) },
      why: [{ msg: 'coach.w.goalLeft', vars: { goal: g.name, amt: left } }] };
  }

  // ---- 8. days with nothing spent, against the same days last month
  function nospend(doc, today, ns) {
    var ym = ymOf(today), d = dayOf(today), pm = B.addMonths(ym, -1);
    var cur = (ns || []).filter(function (x) { return ymOf(x) === ym && x <= today; }).length;
    var prev = (ns || []).filter(function (x) { return ymOf(x) === pm && dayOf(x) <= d; }).length;
    if (cur < 2 || cur <= prev) return null;
    return { id: 'nospend', key: 'ns|' + ym + '|' + cur, prio: 45, msg: prev ? 'coach.ns' : 'coach.nsFirst', vars: { n: cur, d: cur - prev },
      why: [{ msg: 'coach.w.ns', vars: { n: cur, p: prev } }] };
  }

  // ---- 9. early in the month: a budget from the last months, minus what was called a waste (one tap to use it)
  function budgetTip(doc, ex, today) {
    if (dayOf(today) > 7) return null;
    var ym = ymOf(today), u = unit(doc.currency), months = [];
    for (var i = 1; i <= 3; i++) {
      var m = B.addMonths(ym, -i), list = ex.filter(function (t) { return ymOf(t.date) === m; });
      if (list.length) months.push({ ym: m, amt: sum(list), w: sum(wasted(list, m)) });
    }
    if (months.length < 2) return null;
    var avg = Math.round(months.reduce(function (s, x) { return s + x.amt; }, 0) / months.length);
    var wa = Math.round(months.reduce(function (s, x) { return s + x.w; }, 0) / months.length);
    var step = 10 * u, sug = Math.floor((wa > 0 ? avg - wa : avg * 0.95) / step) * step;
    var tb = doc.budgets && doc.budgets.total;
    if (!(sug > 0) || (tb > 0 && Math.abs(tb - sug) / sug < 0.03)) return null;
    return { id: 'budget', key: 'bud|' + ym, prio: 85, msg: wa > 0 ? 'coach.budget' : 'coach.budgetNoW', vars: { n: months.length, amt: avg, sug: sug, w: wa },
      why: months.map(function (x) { return { msg: 'coach.w.month', vars: { ym: x.ym, amt: x.amt, w: x.w } }; }), act: { kind: 'budget', amt: sug } };
  }

  // Everything worth saying today, most important first. o: { now: minute of the day, ns: no-spend days, lang }.
  function all(doc, diary, today, o) {
    o = o || {};
    var ex = expenses(doc).filter(function (t) { return t.date <= today; }), first = firstDate(ex);
    var enough = first && daysSpan(first, today) >= MIN_DAYS;
    var list = [pace(doc, ex, today), waste(doc, ex, today), nospend(doc, today, o.ns), budgetTip(doc, ex, today)];
    if (enough) list.push(spike(doc, ex, today, first), pattern(doc, ex, today, first, o.now), mood(doc, diary, today), fixed(doc, ex, today), goal(doc, ex, today, o.lang));
    return list.filter(Boolean).sort(function (a, b) { return b.prio - a.prio; });
  }
  // What to show: at most two, skipping the ones put away.
  function pick(list, isAway, n) { return list.filter(function (a) { return !isAway(a.key); }).slice(0, n || MAX_SHOWN); }

  var api = { all: all, pick: pick, moodLink: moodLink, unit: unit, MONEY: ['amt', 'per', 'sug', 'yr', 'w'], MIN_DAYS: MIN_DAYS };
  root.VaultCoach = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
