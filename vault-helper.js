// Budget, Notes & Diary — the helper (도우미 / ヘルパー).
//  1. suggest(): up to three suggestions for today, worked out from what is already on this device.
//  2. match():   finds what someone wants from their own words — typos, no spaces and Korean initials (ㅇㅅㅈ) are fine.
//  3. Guide:     step-by-step pointers on the real buttons, shown only when wanted (or when someone seems stuck).
// Pure logic first (no page needed, so it can be tested on its own), then the on-screen part. Nothing is sent anywhere.
(function (root) {
  'use strict';

  // ------------------------------------------------------------------------------------------- dates
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function addDays(d, n) { var x = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function ymOf(d) { return d.slice(0, 7); }
  function addMonths(ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); }
  function dim(ym) { return new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(); }
  function dayDiff(a, b) { return Math.round((new Date(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - new Date(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5); }

  // ------------------------------------------------------------------------------------------- 1. today's suggestions
  // data: { budget, notes, diary, today: 'YYYY-MM-DD', hour: 0-23, B (VaultBudget), state: { snooze: {id: date}, mute: {type: 1} } }
  // Returns [{ id, type, emoji, title: [key, vars], body: [key, vars], act, args, tab, pri }], best first, at most `max`.
  function suggest(data, max) {
    var doc = data.budget, today = data.today, ym = ymOf(today), B = data.B, out = [];
    var st = data.state || {}, snooze = st.snooze || {}, mute = st.mute || {};
    var txs = (doc && doc.tx) || [], cur = doc && doc.currency;
    var exp = txs.filter(function (t) { return t.type === 'expense' && t.cur === cur; });
    var notes = ((data.notes && data.notes.notes) || []).filter(function (n) { return !n.deleted; });
    var entries = (data.diary && data.diary.entries) || [];
    var used = {};                                       // days on which anything was written
    txs.forEach(function (t) { used[t.date] = 1; });
    entries.forEach(function (e) { if (e.date) used[e.date] = 1; });
    var usedDays = Object.keys(used).length;
    function push(s) { if (!mute[s.type] && snooze[s.id] !== today) out.push(s); }

    // nothing yet: offer the five-minute walk-through
    if (!txs.length && !notes.length && !entries.length) {
      push({ id: 'first', type: 'first', emoji: '👋', title: ['hp.s.firstT'], body: ['hp.s.firstB'], act: 'guide', args: { flow: 'add' }, tab: null, pri: 1 });
    }

    // repeating payments coming up in the next three days
    if (doc && B && B.upcomingFixed) {
      var soon = B.upcomingFixed(doc, today).items.filter(function (r) { var d = r.day - (+today.slice(8, 10)); return d >= 1 && d <= 3; });
      if (soon.length === 1) push({ id: 'fixed-' + soon[0].id + '-' + ym, type: 'fixed', emoji: '📅', title: ['hp.s.fixedT'],
        body: ['hp.s.fixedB1', { what: soon[0].note || '', cat: soon[0].cat, amt: soon[0].amt, n: soon[0].day - (+today.slice(8, 10)), date: ym + '-' + pad(soon[0].day) }], act: 'recurring', tab: 'budget', pri: 2 });
      else if (soon.length > 1) push({ id: 'fixed-many-' + today, type: 'fixed', emoji: '📅', title: ['hp.s.fixedT'],
        body: ['hp.s.fixedBn', { n: soon.length, amt: soon.reduce(function (a, r) { return a + r.amt; }, 0) }], act: 'recurring', tab: 'budget', pri: 2 });
    }

    // notes with a reminder for today
    var due = notes.filter(function (n) { return n.remind && n.remind.slice(0, 10) === today; });
    if (due.length) push({ id: 'note-due-' + today, type: 'note', emoji: '⏰', title: ['hp.s.noteT'],
      body: due.length === 1 ? ['hp.s.noteB1', { what: due[0].locked ? '' : String(due[0].text || '').trim().split('\n')[0].slice(0, 40), time: due[0].remind.slice(11, 16) }] : ['hp.s.noteBn', { n: due.length }],
      act: 'note', args: { id: due[0].id }, tab: 'notes', pri: 2 });

    // yesterday is empty although spending is usually written down
    var yest = addDays(today, -1), recent = exp.filter(function (t) { return t.date >= addDays(today, -14) && t.date < today; });
    var recentDays = {}; recent.forEach(function (t) { recentDays[t.date] = 1; });
    if (data.hour >= 5 && Object.keys(recentDays).length >= 3 && !exp.some(function (t) { return t.date === yest; }))
      push({ id: 'yesterday-' + yest, type: 'yesterday', emoji: '🧾', title: ['hp.s.yestT'], body: ['hp.s.yestB'], act: 'add', args: { date: yest }, alt: 'hp.noSpend', tab: 'budget', pri: 3 });

    // the month's budget is going faster than the month
    if (doc && doc.budgets && doc.budgets.total > 0) {
      var spent = exp.filter(function (t) { return ymOf(t.date) === ym; }).reduce(function (a, t) { return a + t.amt; }, 0);
      var share = spent / doc.budgets.total, passed = (+today.slice(8, 10)) / dim(ym);
      if (spent > doc.budgets.total) push({ id: 'over-' + ym, type: 'pace', emoji: '🚨', title: ['hp.s.overT'], body: ['hp.s.overB', { amt: spent - doc.budgets.total }], act: 'charts', tab: 'budget', pri: 3 });
      else if (share >= 0.5 && share - passed >= 0.1) {
        var al = B && B.dailyAllowance ? B.dailyAllowance(doc, today) : null;
        push({ id: 'pace-' + today, type: 'pace', emoji: '📉', title: ['hp.s.paceT'],
          body: ['hp.s.paceB', { pct: Math.round(share * 100), days: dim(ym) - (+today.slice(8, 10)) + 1, per: al ? al.perDay : 0 }], act: 'charts', tab: 'budget', pri: 3 });
      }
      var cb = doc.budgets.cats || {}, worst = null;
      Object.keys(cb).forEach(function (c) {
        if (!(cb[c] > 0)) return;
        var s = exp.filter(function (t) { return t.cat === c && ymOf(t.date) === ym; }).reduce(function (a, t) { return a + t.amt; }, 0);
        if (s / cb[c] >= 0.9 && (!worst || s / cb[c] > worst.r)) worst = { cat: c, r: s / cb[c], left: cb[c] - s };
      });
      if (worst) push({ id: 'cat-' + worst.cat + '-' + ym + (worst.left < 0 ? '-over' : ''), type: 'pace', emoji: '🍽️', title: ['hp.s.catT'],
        body: [worst.left < 0 ? 'hp.s.catOver' : 'hp.s.catNear', { cat: worst.cat, pct: Math.round(worst.r * 100), amt: Math.abs(worst.left) }], act: 'charts', tab: 'budget', pri: 4 });
    } else {
      var thisMonth = exp.filter(function (t) { return ymOf(t.date) === ym; });
      if (thisMonth.length >= 10) push({ id: 'budget-unset', type: 'budget', emoji: '🎯', title: ['hp.s.budgetT'],
        body: ['hp.s.budgetB', { amt: thisMonth.reduce(function (a, t) { return a + t.amt; }, 0) }], act: 'monthly-budget', args: { guide: true }, tab: 'budget', pri: 5 });
    }

    // the first days of a month: how last month went
    if (+today.slice(8, 10) <= 3) {
      var p1 = addMonths(ym, -1), p2 = addMonths(ym, -2);
      var sumOf = function (m) { return exp.filter(function (t) { return ymOf(t.date) === m; }).reduce(function (a, t) { return a + t.amt; }, 0); };
      var n1 = exp.filter(function (t) { return ymOf(t.date) === p1; }).length;
      if (n1 >= 5) {
        var a1 = sumOf(p1), a2 = sumOf(p2), diff = a2 > 0 ? Math.round((a1 - a2) / a2 * 100) : null;
        push({ id: 'recap-' + p1, type: 'recap', emoji: '📊', title: ['hp.s.recapT', { ym: p1 }],
          body: [diff === null ? 'hp.s.recapB0' : diff <= 0 ? 'hp.s.recapLess' : 'hp.s.recapMore', { amt: a1, pct: Math.abs(diff || 0) }], act: 'recap', args: { ym: p1 }, tab: 'budget', pri: 4 });
      }
    }

    // the same payment in each of the last two months, not set to repeat: one tap makes it repeat
    var rep = repeatCandidate(doc, today);
    if (rep) push({ id: 'repeat-' + rep.key, type: 'repeat', emoji: '🔁', title: ['hp.s.repeatT'],
      body: ['hp.s.repeatB', { what: rep.note, cat: rep.cat, amt: rep.amt, day: rep.day }], act: 'make-recurring', args: rep, tab: 'budget', pri: 5 });

    // diary: evening and nothing written today (only for people who use the diary)
    if (entries.length >= 2 && data.hour >= 19 && !entries.some(function (e) { return e.date === today; })) {
      var streak = 0, d = addDays(today, -1);
      while (entries.some(function (e) { return e.date === d; }) && streak < 400) { streak++; d = addDays(d, -1); }
      push({ id: 'diary-' + today, type: 'diary', emoji: '📔', title: ['hp.s.diaryT'], body: streak >= 2 ? ['hp.s.diaryStreak', { n: streak }] : ['hp.s.diaryB'], act: 'diary', tab: 'diary', pri: 5 });
    }

    // a feature people miss — at most one, a different one each day, once there are three days of use
    if (usedDays >= 3) {
      var hasPhoto = txs.some(function (t) { return t.photo; });
      var disc = [
        { k: 'receipt', ok: exp.length >= 10 && !hasPhoto, act: 'guide', args: { flow: 'receipt' }, tab: 'budget' },
        { k: 'methods', ok: exp.length >= 15 && !((doc && doc.methods) || []).length, act: 'methods', tab: 'budget' },
        { k: 'goals', ok: txs.length >= 30 && !((doc && doc.goals) || []).length, act: 'goals', tab: 'budget' },
        { k: 'remind', ok: notes.length >= 3 && !notes.some(function (n) { return n.remind; }), act: 'new-note', tab: 'notes' },
        { k: 'print', ok: entries.length >= 10, act: 'diary-print', tab: 'diary' },
        { k: 'search', ok: txs.length >= 50, act: 'search', tab: 'budget' },
        { k: 'import', ok: usedDays >= 7 && exp.length >= 20, act: 'guide', args: { flow: 'import' }, tab: 'budget' }
      ].filter(function (x) { return x.ok && !mute['tip-' + x.k]; });
      if (disc.length) {
        var pick = disc[Math.floor(dayDiff('2026-01-01', today)) % disc.length];
        push({ id: 'tip-' + pick.k + '-' + today, type: 'tip-' + pick.k, emoji: '💡', title: ['hp.s.tipT'], body: ['hp.tip.' + pick.k], act: pick.act, args: pick.args, tab: pick.tab, pri: 8 });
      }
    }

    out.sort(function (a, b) { return a.pri - b.pri; });
    return out.slice(0, max || 3);
  }
  // A payment with the same category and amount (and note, if any) in each of the two months before this one,
  // around the same day, that is not already a repeating entry.
  function repeatCandidate(doc, today) {
    if (!doc || !doc.tx) return null;
    var ym = ymOf(today), m1 = addMonths(ym, -1), m2 = addMonths(ym, -2), groups = {};
    doc.tx.forEach(function (t) {
      if (t.type !== 'expense' || t.rid || t.cur !== doc.currency) return;
      var m = ymOf(t.date); if (m !== m1 && m !== m2 && m !== ym) return;
      var key = t.cat + '|' + t.amt + '|' + String(t.note || '').trim().toLowerCase();
      (groups[key] = groups[key] || []).push(t);
    });
    var best = null;
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], inM1 = g.filter(function (t) { return ymOf(t.date) === m1; }), inM2 = g.filter(function (t) { return ymOf(t.date) === m2; });
      if (inM1.length !== 1 || inM2.length !== 1) return;
      var d1 = +inM1[0].date.slice(8, 10), d2 = +inM2[0].date.slice(8, 10);
      if (Math.abs(d1 - d2) > 3) return;
      var t0 = inM1[0];
      var already = (doc.recurring || []).some(function (r) { return r.cat === t0.cat && r.amt === t0.amt && r.type === 'expense'; });
      if (already) return;
      var thisMonth = g.filter(function (t) { return ymOf(t.date) === ym; }).length > 0;
      var c = { key: k.replace(/[^a-z0-9|]/gi, '').slice(0, 40) + '-' + t0.amt, cat: t0.cat, amt: t0.amt, note: String(t0.note || '').trim(), day: d1, pm: t0.pm || null, last: thisMonth ? ym : m1 };
      if (!best || c.amt > best.amt) best = c;
    });
    return best;
  }

  // ------------------------------------------------------------------------------------------- 2. finding what someone wants
  var CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  function cho(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); out += c >= 0xAC00 && c <= 0xD7A3 ? CHO[Math.floor((c - 0xAC00) / 588)] : s[i]; }
    return out;
  }
  function norm(s) {
    s = String(s || '');
    try { s = s.normalize('NFKC'); } catch (e) { /* old browser */ }
    // NFKC turns typed initials (ㅇ, U+3147) into the other jamo form (U+110B): turn them back so ㅇㅅㅈ still works
    s = s.replace(/[\u1100-\u1112]/g, function (c) { return CHO[c.charCodeAt(0) - 0x1100]; });
    return s.toLowerCase().replace(/[\s.,!?~'"“”‘’()\[\]{}:;·…\-_/\\|+*=#@&^%$`<>，。、！？「」『』（）]+/g, '');
  }
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, prev = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      var curr = [i];
      for (j = 1; j <= n; j++) curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = curr;
    }
    return prev[n];
  }
  // kw appears somewhere in q with at most one wrong, missing or extra letter (only for words of 3+ letters)
  function nearIn(q, kw) {
    if (kw.length < 3 || q.length < kw.length - 1) return false;
    for (var len = kw.length - 1; len <= kw.length + 1; len++)
      for (var i = 0; i + len <= q.length; i++) if (lev(q.substr(i, len), kw) <= 1) return true;
    return false;
  }
  // actions: [{ id, kw: ['word', ...] }] — words in every language together (people mix them)
  function match(query, actions, max) {
    var q = norm(query);
    if (!q) return [];
    var initials = /^[ㄱ-ㅎ]{2,}$/.test(q);
    var res = [];
    actions.forEach(function (a) {
      var s = 0, hits = 0, seen = {};
      (a.kw || []).forEach(function (w) {
        var k = norm(w); if (!k || seen[k]) return;
        seen[k] = 1;                                                                      // "자동 백업" and "자동백업" count once
        var got = 0;
        if (q === k) got = 30 + Math.min(k.length, 8) * 2;                               // exactly the word
        else if (q.indexOf(k) >= 0) got = 10 + Math.min(k.length, 8) * 2;               // the word is in the question
        else if (q.length >= 2 && k.indexOf(q) >= 0) got = 6 + q.length * 2;            // the question is part of a word ("영수")
        else if (/^[\uAC00-\uD7A3]$/.test(q) && k.indexOf(q) === 0) got = 9;          // one Korean syllable that starts a word ("백")
        else if (initials && cho(k).indexOf(q) >= 0) got = 8 + q.length * 2;            // ㅇㅅㅈ → 영수증
        else if (nearIn(q, k)) got = 6 + k.length;                                       // one typo
        if (got) { hits++; s += got; }
      });
      if (s) res.push({ id: a.id, score: s + (hits > 1 ? 4 : 0) + (a.boost || 0) });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.filter(function (r) { return r.score >= 9; }).slice(0, max || 4);
  }
  function wantsYesterday(query) { return /어제|yesterday|昨日|きのう/i.test(String(query || '')); }

  // ------------------------------------------------------------------------------------------- 3. step guides on the real screen
  // new Guide({ t, onEnd(flow, finished) }).start(flow, steps, doneKey)
  // step: { sel, key, until: 'click' | 'input' | function () → true when done, before: function () }
  function Guide(opts) { this.o = opts; this.active = null; }
  Guide.prototype.start = function (flow, steps, doneKey) {
    var self = this, o = this.o, t = o.t;
    this.stop(false);
    var box = document.createElement('div'); box.className = 'hp-guide'; box.id = 'hp-guide';
    var ring = document.createElement('div'); ring.className = 'hp-ring'; ring.setAttribute('aria-hidden', 'true');
    var tip = document.createElement('div'); tip.className = 'hp-tip'; tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite');
    var txt = document.createElement('p'); txt.className = 'hp-tip-text'; txt.id = 'hp-tip-text';
    var foot = document.createElement('div'); foot.className = 'hp-tip-foot';
    var count = document.createElement('span'); count.className = 'hp-tip-count'; count.id = 'hp-tip-count';
    var quit = document.createElement('button'); quit.type = 'button'; quit.className = 'hp-tip-quit'; quit.id = 'hp-tip-quit'; quit.textContent = t('hp.g.quit');
    foot.appendChild(count); foot.appendChild(quit);
    tip.appendChild(txt); tip.appendChild(foot);
    box.appendChild(ring); box.appendChild(tip);
    document.body.appendChild(box);
    var g = { flow: flow, steps: steps, i: -1, box: box, ring: ring, tip: tip, txt: txt, count: count, el: null, missing: 0, timer: null, inputT: null };
    this.active = g;
    quit.addEventListener('click', function () { self.stop(false); });
    g.onClick = function (e) {
      var s = g.steps[g.i]; if (!s || s.until !== 'click' || !g.el) return;
      var target = e.target && e.target.closest ? e.target.closest(s.hit || s.sel) : null;
      if (target) setTimeout(function () { next(); }, 60);
    };
    g.onInput = function (e) {
      var s = g.steps[g.i], tg = e.target; if (!s || s.until !== 'input' || !tg || !tg.matches || !tg.matches(s.sel)) return;
      clearTimeout(g.inputT); g.inputT = null;
      if (String(tg.value || '').trim()) g.inputT = setTimeout(function () { next(); }, 900);     // a pause after typing = done
    };
    document.addEventListener('click', g.onClick, true);
    document.addEventListener('input', g.onInput, true);
    function visible(el) { return el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
    // really on screen: not scrolled out of its sheet and not under a sticky header (the note itself lets taps through)
    function onScreen(el) {
      var r = el.getBoundingClientRect(); if (r.bottom <= 0 || r.top >= innerHeight) return false;
      var x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 40))), y = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 16)));
      var hit = document.elementFromPoint(x, y);
      return !!hit && (hit === el || el.contains(hit) || box.contains(hit));
    }
    function place() {
      if (self.active !== g) return;
      var s = g.steps[g.i]; if (!s) return;
      if (typeof s.until === 'function' && s.until()) { next(); return; }        // done (even when the button has gone with its sheet)
      var el = document.querySelector(s.sel);
      if (!visible(el)) {
        g.el = null; ring.style.display = 'none'; tip.style.visibility = 'hidden';
        if (++g.missing > 40) self.stop(false);         // about 8 seconds without the button: quietly give up
        return;
      }
      if (el !== g.el) { g.el = el; g.missing = 0; g.scrolls = 0; }
      if (g.scrolls < 2 && Date.now() - (g.lastScroll || 0) > 500 && !onScreen(el)) { el.scrollIntoView({ block: 'center' }); g.scrolls++; g.lastScroll = Date.now(); }
      if (s.until === 'input' && !g.inputT && String(el.value || '').trim()) g.inputT = setTimeout(function () { next(); }, 900);   // typed before the note moved here
      var r = el.getBoundingClientRect(), m = 6;
      ring.style.display = 'block';
      ring.style.left = (r.left - m) + 'px'; ring.style.top = (r.top - m) + 'px';
      ring.style.width = (r.width + m * 2) + 'px'; ring.style.height = (r.height + m * 2) + 'px';
      tip.style.visibility = 'visible';
      var W = Math.min(320, innerWidth - 24);
      tip.style.width = W + 'px';
      var th = tip.offsetHeight || 90;
      var left = Math.max(12, Math.min(innerWidth - W - 12, r.left + r.width / 2 - W / 2));
      // Where the note goes: next to the button if that covers nothing else people may need to tap, otherwise the
      // top or bottom of the screen — whichever covers the least. It never covers the button it points at.
      var scope = (el.closest && el.closest('.sheet')) || document;
      var busy = Array.prototype.slice.call(scope.querySelectorAll('button, a[href], input, select, textarea, label[for], [role="button"]'), 0, 200)
        .filter(function (x) { return x !== el && !el.contains(x) && !box.contains(x) && x.getClientRects().length; })
        .map(function (x) { return x.getBoundingClientRect(); })
        .filter(function (b) { return b.bottom > 0 && b.top < innerHeight && b.width && b.height; });
      function cover(top) {
        var a = { l: left, t: top, r: left + W, b: top + th }, area = 0;
        function ov(b) { var w = Math.min(a.r, b.right) - Math.max(a.l, b.left), hh = Math.min(a.b, b.bottom) - Math.max(a.t, b.top); return w > 0 && hh > 0 ? w * hh : 0; }
        if (ov({ left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m })) return Infinity;
        busy.forEach(function (b) { area += ov(b); });
        return area;
      }
      var spots = [['below', r.bottom + m + 12], ['above', r.top - m - 12 - th], ['float', 8], ['float', innerHeight - th - 8]]
        .filter(function (x) { return x[1] >= 8 && x[1] + th <= innerHeight - 8; });
      var best = null;
      spots.forEach(function (x) { var c = cover(x[1]); if (!best || c < best.c) best = { k: x[0], top: x[1], c: c }; });
      if (!best) best = { k: 'float', top: Math.max(8, innerHeight - th - 8) };
      tip.style.left = left + 'px'; tip.style.top = best.top + 'px';
      tip.className = 'hp-tip ' + best.k;
    }
    function next() {
      if (self.active !== g) return;
      clearTimeout(g.inputT); g.inputT = null;
      g.i++;
      if (g.i >= g.steps.length) { self.stop(true, doneKey); return; }
      var s = g.steps[g.i];
      if (s.before) { try { s.before(); } catch (e) { /* the step will wait for its button */ } }
      tip.style.visibility = 'hidden';                     // shown again once it sits next to the new button
      txt.textContent = t(s.key, s.vars);
      count.textContent = (g.i + 1) + ' / ' + g.steps.length;
      g.el = null; g.missing = 0;
      setTimeout(place, 30);
    }
    g.timer = setInterval(place, 200);
    g.onMove = function () { place(); };
    window.addEventListener('resize', g.onMove); window.addEventListener('scroll', g.onMove, true);
    next();
    return g;
  };
  Guide.prototype.stop = function (finished, doneKey) {
    var g = this.active; if (!g) return;
    this.active = null;
    clearInterval(g.timer); clearTimeout(g.inputT);
    document.removeEventListener('click', g.onClick, true);
    document.removeEventListener('input', g.onInput, true);
    window.removeEventListener('resize', g.onMove); window.removeEventListener('scroll', g.onMove, true);
    g.box.remove();
    if (finished && doneKey) this.say(this.o.t(doneKey));
    if (this.o.onEnd) this.o.onEnd(g.flow, !!finished);
  };
  Guide.prototype.running = function () { return this.active ? this.active.flow : null; };
  // A short note at the bottom of the screen; with buttons: [{ label, fn, primary }]
  Guide.prototype.say = function (text, buttons, ms) {
    var old = document.getElementById('hp-say'); if (old) old.remove();
    var b = document.createElement('div'); b.className = 'hp-say'; b.id = 'hp-say'; b.setAttribute('role', 'status');
    var p = document.createElement('p'); p.textContent = text; b.appendChild(p);
    var row = document.createElement('div'); row.className = 'hp-say-row';
    (buttons && buttons.length ? buttons : [{ label: this.o.t('btn.ok'), fn: null }]).forEach(function (x, i) {
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hp-say-btn' + (x.primary ? ' primary' : '');
      btn.id = x.id || 'hp-say-' + i; btn.textContent = x.label;
      btn.addEventListener('click', function () { b.remove(); if (x.fn) x.fn(); });
      row.appendChild(btn);
    });
    b.appendChild(row);
    document.body.appendChild(b);
    if (ms !== 0) setTimeout(function () { if (b.isConnected) b.remove(); }, ms || 7000);
    return b;
  };

  // Notices when someone seems stuck: an open sheet whose main box is still empty after `wait` ms without any key
  // press or tap. check() → { flow, el } for the sheet in front, or null. offer(flow) is called once per opening.
  function Stuck(opts) {
    var last = Date.now(), seen = null, offered = false, wait = opts.wait || 20000;
    function act() { last = Date.now(); }
    ['keydown', 'pointerdown', 'input', 'wheel'].forEach(function (ev) { document.addEventListener(ev, act, true); });
    var iv = setInterval(function () {
      var c = opts.check();
      if (!c) { seen = null; offered = false; return; }
      if (c.el !== seen) { seen = c.el; offered = false; last = Date.now(); return; }
      if (offered || Date.now() - last < wait) return;
      if (String(c.el.value || '').trim()) return;
      offered = true; opts.offer(c.flow);
    }, 1000);
    return { stop: function () { clearInterval(iv); }, poke: act };
  }

  root.VaultHelper = { suggest: suggest, repeatCandidate: repeatCandidate, match: match, norm: norm, cho: cho, lev: lev, nearIn: nearIn,
    wantsYesterday: wantsYesterday, Guide: Guide, Stuck: Stuck, addDays: addDays, addMonths: addMonths };
})(typeof window !== 'undefined' ? window : this);
