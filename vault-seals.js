/* PopPopMake Vault — reward seals ("씰"): a round collectible sticker given when the person reaches something
 * (a run of check-ins, a savings goal, a month inside the budget ...). Original drawings made for PopPopMake.
 * Earned seals go into the seal book and onto the diary's sticker sheet. Static markup only (DOMParser, SVG).
 * earned(state) is pure: state = { budget, diary, notes, ci: { days, ns }, lastBackup, today } → [ids reached].
 */
(function (root) {
  'use strict';
  var INK = '#3a3530';
  var O = 'stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  function face(x, y, s) {
    s = s || 1;
    return '<circle cx="' + (x - 4.2 * s) + '" cy="' + y + '" r="' + 1.8 * s + '" fill="' + INK + '"/><circle cx="' + (x + 4.2 * s) + '" cy="' + y + '" r="' + 1.8 * s + '" fill="' + INK + '"/>' +
      '<ellipse cx="' + (x - 7 * s) + '" cy="' + (y + 3.2 * s) + '" rx="2.4" ry="1.5" fill="#FF8FA3" opacity=".85"/><ellipse cx="' + (x + 7 * s) + '" cy="' + (y + 3.2 * s) + '" rx="2.4" ry="1.5" fill="#FF8FA3" opacity=".85"/>' +
      '<path d="M' + (x - 2.4 * s) + ' ' + (y + 2.6 * s) + 'q' + 2.4 * s + ' ' + 2.4 * s + ' ' + 4.8 * s + ' 0" fill="none" ' + O + ' stroke-width="1.8"/>';
  }
  // the scalloped edge of a peel-off seal, a white ring and the drawing in the middle
  function badge(edge, fill, motif) {
    var s = '';
    for (var i = 0; i < 18; i++) { var a = i * Math.PI / 9; s += '<circle cx="' + (32 + 27 * Math.cos(a)).toFixed(1) + '" cy="' + (32 + 27 * Math.sin(a)).toFixed(1) + '" r="4.6" fill="' + edge + '"/>'; }
    return s + '<circle cx="32" cy="32" r="27" fill="' + edge + '"/><circle cx="32" cy="32" r="23.5" fill="' + fill + '" stroke="#fff" stroke-width="2" stroke-dasharray="3 2.4"/>' + motif +
      '<path d="M16 20a19 19 0 0 1 9-8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>';
  }
  function star(cx, cy, R, r) {
    var p = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; p.push((cx + d * Math.cos(a)).toFixed(1) + ',' + (cy + d * Math.sin(a)).toFixed(1)); }
    return p.join(' ');
  }
  var ART = {
    // a sprout: the first entry
    sprout: badge('#7CC489', '#EAF7E6', '<path d="M32 46V32" ' + O + ' fill="none"/><path d="M32 34c-9 0-13-6-13-12 7 0 13 4 13 12zM32 31c0-8 5-13 13-13 0 7-5 13-13 13z" ' + O + ' fill="#8FD19C"/><path d="M22 46h20" ' + O + '/>' + face(32, 50, .55)),
    // a stack of coins with a face: 30 entries
    coins: badge('#F4B740', '#FFF6DA', '<ellipse cx="32" cy="42" rx="12" ry="4.5" ' + O + ' fill="#F7C548"/><path d="M20 42v-6M44 42v-6" ' + O + '/><ellipse cx="32" cy="36" rx="12" ry="4.5" ' + O + ' fill="#F7C548"/><path d="M20 36v-6M44 36v-6" ' + O + '/><ellipse cx="32" cy="30" rx="12" ry="4.5" ' + O + ' fill="#FFD966"/>' + face(32, 29, .6)),
    // a little flame: check-in runs (3, 7 and 30 days get different colours)
    flame3: badge('#FFA26B', '#FFF0E6', '<path d="M32 49c-9 0-14-6-14-13 0-8 7-11 8-19 4 3 5 7 5 10 2-2 3-4 3-7 5 4 12 9 12 16 0 7-5 13-14 13z" ' + O + ' fill="#FF8A5B"/>' + face(32, 38, .75)),
    flame7: badge('#F0644D', '#FFE8E3', '<path d="M32 49c-9 0-14-6-14-13 0-8 7-11 8-19 4 3 5 7 5 10 2-2 3-4 3-7 5 4 12 9 12 16 0 7-5 13-14 13z" ' + O + ' fill="#F0644D"/><path d="M32 47c-4 0-6-3-6-6 0-4 4-5 5-9 3 3 7 5 7 9 0 3-2 6-6 6z" fill="#FFD27A"/>' + face(32, 38, .75)),
    flame30: badge('#8E6CC9', '#F0EAFB', '<path d="M32 49c-9 0-14-6-14-13 0-8 7-11 8-19 4 3 5 7 5 10 2-2 3-4 3-7 5 4 12 9 12 16 0 7-5 13-14 13z" ' + O + ' fill="#A98BE0"/><polygon points="' + star(32, 14, 5, 2.2) + '" fill="#FFD966" ' + O + ' stroke-width="1.5"/>' + face(32, 38, .75)),
    // a piggy bank with a sealed mouth: no-spend days
    piggy: badge('#FF9DB0', '#FFEAF0', '<ellipse cx="32" cy="36" rx="14" ry="11" ' + O + ' fill="#FFB8C8"/><path d="M22 28l-3-6 7 3M42 28l3-6-7 3" ' + O + ' fill="#FFB8C8"/><ellipse cx="32" cy="39" rx="4.5" ry="3" ' + O + ' fill="#FF9DB0"/><path d="M28 26h8" ' + O + ' stroke-width="2.6"/><circle cx="26.5" cy="33" r="1.7" fill="' + INK + '"/><circle cx="37.5" cy="33" r="1.7" fill="' + INK + '"/>'),
    // a shield with a check: the month kept inside the budget
    shield: badge('#4FB0A6', '#E3F5F2', '<path d="M32 14l13 5v10c0 9-6 15-13 18-7-3-13-9-13-18V19z" ' + O + ' fill="#7FD0C6"/><path d="M25.5 31l4.5 4.5 8.5-9" ' + O + ' fill="none" stroke-width="2.8"/>'),
    // a jar half full / a full jar with a crown: savings goal 50% and 100%
    jarHalf: badge('#5B9BD5', '#E6F0FA', '<path d="M24 20h16v4c3 2 4 5 4 8v10c0 3-2 5-5 5H25c-3 0-5-2-5-5V32c0-3 1-6 4-8z" ' + O + ' fill="#fff"/><path d="M21 36h22v6c0 3-2 5-5 5H26c-3 0-5-2-5-5z" fill="#9CC5EE"/><path d="M23 16h18v4H23z" ' + O + ' fill="#5B9BD5"/>' + face(32, 30, .6)),
    jarFull: badge('#F4B740', '#FFF6DA', '<path d="M24 22h16v4c3 2 4 5 4 8v9c0 3-2 5-5 5H25c-3 0-5-2-5-5v-9c0-3 1-6 4-8z" ' + O + ' fill="#FFD966"/><path d="M23 18h18v4H23z" ' + O + ' fill="#F4B740"/><path d="M25 16l2-6 5 4 5-4 2 6z" ' + O + ' fill="#FFD966" stroke-width="1.8"/>' + face(32, 35, .65)),
    // a magnifier over a coin: ten spends rated (worth it / a waste)
    lens: badge('#9AD06B', '#F0F8E6', '<circle cx="29" cy="29" r="10" ' + O + ' fill="#fff"/><circle cx="29" cy="29" r="5.5" ' + O + ' fill="#F7C548" stroke-width="1.6"/><path d="M36.5 36.5l8 8" ' + O + ' stroke-width="4"/>'),
    // a receipt with a face: five receipt photos
    receipt: badge('#B9875B', '#F7EEE4', '<path d="M22 14h20v34l-3.3-2.4-3.4 2.4-3.3-2.4-3.3 2.4-3.4-2.4L22 48z" ' + O + ' fill="#fff"/><path d="M26 22h12M26 27h8" ' + O + ' stroke-width="1.8"/>' + face(32, 36, .6)),
    // an open diary: the first entry, ten entries (a ribbon), a decorated page (a sticker)
    diary: badge('#E8704F', '#FDECE6', '<path d="M14 22c6-3 12-3 18 1v24c-6-4-12-4-18-1z" ' + O + ' fill="#fff"/><path d="M50 22c-6-3-12-3-18 1v24c6-4 12-4 18-1z" ' + O + ' fill="#fff"/><path d="M18 28c4-1 7-1 10 1M36 29c3-2 6-2 10-1" ' + O + ' stroke-width="1.6" fill="none"/>'),
    diary10: badge('#D4699A', '#FBE8F1', '<path d="M14 22c6-3 12-3 18 1v24c-6-4-12-4-18-1z" ' + O + ' fill="#fff"/><path d="M50 22c-6-3-12-3-18 1v24c6-4 12-4 18-1z" ' + O + ' fill="#fff"/><path d="M40 21v14l3-2.5 3 2.5V20" ' + O + ' fill="#D4699A" stroke-width="1.6"/>'),
    deco: badge('#FFB547', '#FFF4E0', '<rect x="16" y="16" width="32" height="32" rx="5" ' + O + ' fill="#fff"/><polygon points="' + star(29, 33, 9, 4) + '" ' + O + ' fill="#FFD966" stroke-width="1.8"/><path d="M36 14l12 6" stroke="#FF9DB0" stroke-width="6" stroke-linecap="round" opacity=".9"/>'),
    // a sticky note / a ticked list / a cloud keeping a backup
    note: badge('#E9C400', '#FFFBE0', '<path d="M18 16h28v22l-10 10H18z" ' + O + ' fill="#FFF3A8"/><path d="M36 48V38h10" ' + O + ' fill="#FFE36E"/>' + face(31, 29, .65)),
    listDone: badge('#7CC489', '#EAF7E6', '<rect x="17" y="15" width="30" height="34" rx="5" ' + O + ' fill="#fff"/><path d="M22 24l3 3 5-5M22 33l3 3 5-5M22 42l3 3 5-5" ' + O + ' fill="none" stroke="#3E9A4B"/><path d="M34 25h8M34 34h8M34 43h8" ' + O + ' stroke-width="1.6"/>'),
    cloud: badge('#7FB3E0', '#EAF3FB', '<path d="M22 42c-5 0-8-3-8-7s3-7 8-7c1-6 6-10 11-10 6 0 11 5 11 11 4 0 7 3 7 6.5S48 42 44 42z" ' + O + ' fill="#fff"/>' + face(32, 33, .7))
  };
  // what each seal is for, in the order the book shows them
  var LIST = [
    ['first-log', 'sprout'], ['log-30', 'coins'], ['ci-3', 'flame3'], ['ci-7', 'flame7'], ['ci-30', 'flame30'], ['ns-3', 'piggy'],
    ['kept', 'shield'], ['goal-50', 'jarHalf'], ['goal-100', 'jarFull'], ['rate-10', 'lens'], ['receipt-5', 'receipt'],
    ['diary-1', 'diary'], ['diary-10', 'diary10'], ['deco', 'deco'], ['note-1', 'note'], ['list-done', 'listDone'], ['backup', 'cloud']
  ];
  var IDS = LIST.map(function (x) { return x[0]; });
  function artOf(id) { var x = LIST.find(function (y) { return y[0] === id; }); return x ? x[1] : null; }

  function addDays(d, n) { var x = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)); return x.toISOString().slice(0, 10); }
  function run(days, upTo) { var set = {}, n = 0, d = upTo; (days || []).forEach(function (x) { set[x] = 1; }); if (!set[d]) d = addDays(d, -1); while (set[d] && n < 400) { n++; d = addDays(d, -1); } return n; }
  function bestRun(days) { var best = 0; (days || []).forEach(function (d) { best = Math.max(best, run(days, d)); }); return best; }
  function prevYm(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; if (!m) { y--; m = 12; } return y + '-' + (m < 10 ? '0' : '') + m; }
  function listDone(text) {
    var all = 0, done = 0; String(text || '').split('\n').forEach(function (l) { var m = /^\s*[-*] \[( |x|X)\] \S/.exec(l); if (m) { all++; if (m[1] !== ' ') done++; } });
    return all >= 3 && done === all;
  }
  // every seal whose condition is met now
  function earned(s) {
    var b = s.budget || { tx: [], goals: [], budgets: {} }, tx = b.tx || [], out = [], today = s.today, ym = today.slice(0, 7);
    var dEntries = (s.diary && s.diary.entries) || [], notes = (s.notes && s.notes.notes) || [], ci = s.ci || { days: [], ns: [] };
    var exp = tx.filter(function (t) { return t.type === 'expense'; });
    function has(id, ok) { if (ok) out.push(id); }
    has('first-log', tx.length >= 1);
    has('log-30', tx.length >= 30);
    var br = bestRun(ci.days);
    has('ci-3', br >= 3); has('ci-7', br >= 7); has('ci-30', br >= 30);
    var nsBy = {}; (ci.ns || []).forEach(function (d) { nsBy[d.slice(0, 7)] = (nsBy[d.slice(0, 7)] || 0) + 1; });
    has('ns-3', Object.keys(nsBy).some(function (k) { return nsBy[k] >= 3; }));          // three no-spend days in one month
    // last month finished inside the monthly budget (with at least ten spends written that month)
    var pm = prevYm(ym), pmList = exp.filter(function (t) { return t.date.slice(0, 7) === pm && t.cur === b.currency; });
    var tb = b.budgets && b.budgets.total;
    has('kept', tb > 0 && pmList.length >= 10 && pmList.reduce(function (a, t) { return a + t.amt; }, 0) <= tb);
    var pct = (b.goals || []).map(function (g) { var saved = (g.moves || []).reduce(function (a, m) { return a + m.amt; }, 0); return g.target > 0 ? saved / g.target : 0; });
    has('goal-50', pct.some(function (p) { return p >= 0.5; })); has('goal-100', pct.some(function (p) { return p >= 1; }));
    has('rate-10', exp.filter(function (t) { return t.rate; }).length >= 10);
    has('receipt-5', tx.filter(function (t) { return t.photo; }).length >= 5);
    has('diary-1', dEntries.length >= 1); has('diary-10', dEntries.length >= 10);
    has('deco', dEntries.some(function (e) { return e.deco && e.deco.stickers && e.deco.stickers.length; }));
    has('note-1', notes.some(function (n) { return String(n.text || '').trim(); }));
    has('list-done', notes.some(function (n) { return n.list && listDone(n.text); }));
    has('backup', !!s.lastBackup);
    return out;
  }
  var parser = null, n = 0;
  // strict XML refuses a repeated attribute (the shared outline style is often given a thinner stroke): keep the last one
  function dedupe(m) {
    return m.replace(/<([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"]*")*)\s*(\/?)>/g, function (all, tag, attrs, close) {
      var seen = {}, order = [];
      attrs.replace(/([a-zA-Z:-]+)="([^"]*)"/g, function (x, k, v) { if (!(k in seen)) order.push(k); seen[k] = v; return x; });
      return '<' + tag + order.map(function (k) { return ' ' + k + '="' + seen[k] + '"'; }).join('') + (close ? '/' : '') + '>';
    });
  }
  function element(id, size) {
    var art = ART[artOf(id) || id]; if (!art || !root.document) return null;
    parser = parser || new root.DOMParser();
    var doc = parser.parseFromString('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + dedupe(art) + '</svg>', 'image/svg+xml');
    var svg = doc.documentElement; if (svg.nodeName !== 'svg') return null;
    svg = root.document.importNode(svg, true);
    if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'seal-svg'); n++;
    return svg;
  }
  function markup(id) { var a = ART[artOf(id)]; return a || null; }
  var api = { LIST: LIST, IDS: IDS, earned: earned, element: element, markup: markup, artOf: artOf, bestRun: bestRun, listDone: listDone };
  root.VaultSeals = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
