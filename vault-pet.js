/* PopPopMake Vault — a little plant friend that grows when you look after yourself (write, check a mood, log money,
 * keep a no-spend day, tick a saving week). Drawn for PopPopMake. It never wilts or scolds: a missed day just waits.
 */
(function (root) {
  'use strict';
  var STAGES = [0, 8, 24, 50, 90, 150, 240, 360, 520];          // sunshine needed for each stage
  var POTS = { cream: ['#FFF6E8', '#EAD7BC'], pink: ['#FFD9E4', '#F2A7BE'], mint: ['#D6F3E6', '#93D2B6'], sky: ['#DCEBFF', '#9DC0F0'], lilac: ['#ECE2FF', '#BBA3EE'], terracotta: ['#F6C3A4', '#D98A63'] };
  var FLOWER = { cream: '#FFB4C8', pink: '#FF8FB1', mint: '#FFD45C', sky: '#FFFFFF', lilac: '#FFB8E0', terracotta: '#FFE07A' };
  function levelOf(sun) { var l = 0; for (var i = 0; i < STAGES.length; i++) if (sun >= STAGES[i]) l = i; return l; }
  function nextAt(sun) { var l = levelOf(sun); return l + 1 < STAGES.length ? STAGES[l + 1] : null; }
  function leaf(x, y, s, a, c) { return '<path d="M0 0C' + (s * .5) + ' ' + (-s * .35) + ' ' + (s * .95) + ' ' + (-s * .2) + ' ' + s + ' 0C' + (s * .95) + ' ' + (s * .2) + ' ' + (s * .5) + ' ' + (s * .35) + ' 0 0z" fill="' + c + '" transform="translate(' + x + ' ' + y + ') rotate(' + a + ')"/>'; }
  function flower(x, y, r, c) {
    var p = ''; for (var i = 0; i < 5; i++) p += '<ellipse cx="0" cy="' + (-r * .55) + '" rx="' + (r * .42) + '" ry="' + (r * .6) + '" fill="' + c + '" transform="rotate(' + (i * 72) + ')"/>';
    return '<g transform="translate(' + x + ' ' + y + ')">' + p + '<circle r="' + (r * .3) + '" fill="#FFC93D"/></g>';
  }
  function star(x, y, r, c) { return '<path d="M' + x + ' ' + (y - r) + 'Q' + (x + r * .22) + ' ' + (y - r * .22) + ' ' + (x + r) + ' ' + y + 'Q' + (x + r * .22) + ' ' + (y + r * .22) + ' ' + x + ' ' + (y + r) + 'Q' + (x - r * .22) + ' ' + (y + r * .22) + ' ' + (x - r) + ' ' + y + 'Q' + (x - r * .22) + ' ' + (y - r * .22) + ' ' + x + ' ' + (y - r) + 'z" fill="' + c + '"/>'; }
  // the plant at a stage, in a pot of a colour, with a face on the pot (happy, sleepy or cheering)
  function svg(stage, pot, face) {
    var P = POTS[pot] || POTS.cream, fc = FLOWER[pot] || '#FF8FB1', g = '#7CC36A', gd = '#5E9B4E', out = '';
    out += '<defs><linearGradient id="GIDp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P[0] + '"/><stop offset="1" stop-color="' + P[1] + '"/></linearGradient>' +
      '<radialGradient id="GIDs" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF4C4" stop-opacity=".9"/><stop offset="1" stop-color="#FFF4C4" stop-opacity="0"/></radialGradient></defs>';
    if (stage >= 7) out += '<circle cx="60" cy="44" r="44" fill="url(#GIDs)"/>';
    out += '<ellipse cx="60" cy="112" rx="30" ry="4" fill="#5A3A4A" opacity=".12"/>';
    // the plant
    if (stage === 0) out += '<ellipse cx="60" cy="66" rx="7" ry="5.4" fill="#C8955F"/><path d="M56 64q4-4 8 0" stroke="#EBCB9F" stroke-width="1.4" fill="none"/><path d="M60 61q1-5 4-6" stroke="' + g + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    if (stage >= 1) {
      var h = [0, 14, 22, 30, 38, 46, 52, 56, 58][stage];
      out += '<path d="M60 72Q' + (58 + (stage % 2 ? 2 : -2)) + ' ' + (72 - h / 2) + ' 60 ' + (72 - h) + '" stroke="' + gd + '" stroke-width="' + (stage >= 6 ? 4 : 2.6) + '" fill="none" stroke-linecap="round"/>';
      out += leaf(60, 72 - h + 4, 12 + stage, -30, g) + leaf(60, 72 - h + 4, 12 + stage, -150, g);
      if (stage >= 2) out += leaf(60, 72 - h * .55, 14 + stage, -10, '#8FD17A') + leaf(60, 72 - h * .55, 14 + stage, -170, '#8FD17A');
      if (stage >= 3) out += leaf(60, 72 - h * .3, 12 + stage, 15, g) + leaf(60, 72 - h * .3, 12 + stage, 165, g);
      var top = 72 - h;
      if (stage === 4) out += '<ellipse cx="60" cy="' + (top - 4) + '" rx="5" ry="7" fill="' + fc + '"/><path d="M56 ' + (top + 1) + 'q4-4 8 0" fill="' + g + '"/>';
      if (stage >= 5) out += flower(60, top - 6, stage >= 6 ? 13 : 11, fc);
      if (stage >= 6) out += flower(42, top + 12, 8, fc) + flower(78, top + 10, 8, fc);
      if (stage >= 7) out += star(30, top - 2, 5, '#FFD45C') + star(92, top - 8, 6, '#FFD45C') + star(70, top - 26, 4, '#FFE58A');
      if (stage >= 8) out += star(20, top + 22, 4, '#FFE58A') + star(100, top + 18, 4.5, '#FFD45C') + '<circle cx="48" cy="' + (top - 18) + '" r="2" fill="#fff"/><circle cx="84" cy="' + (top + 30) + '" r="1.6" fill="#fff"/>';
    }
    // the pot with a face
    out += '<path d="M36 74h48l-6 36q-1 4-5 4H47q-4 0-5-4z" fill="url(#GIDp)"/><rect x="33" y="70" width="54" height="9" rx="4.5" fill="' + P[1] + '"/><ellipse cx="44" cy="90" rx="3" ry="8" fill="#fff" opacity=".45"/>';
    var ink = '#5A4450';
    if (face === 'sleep') out += '<path d="M50 93q3 2 6 0M64 93q3 2 6 0" stroke="' + ink + '" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M58 99h4" stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round"/>';
    else if (face === 'cheer') out += '<path d="M50 93q3-3 6 0M64 93q3-3 6 0" stroke="' + ink + '" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M55 98q5 6 10 0z" fill="' + ink + '"/>';
    else out += '<circle cx="53" cy="93" r="2" fill="' + ink + '"/><circle cx="67" cy="93" r="2" fill="' + ink + '"/><path d="M57 98q3 2.5 6 0" stroke="' + ink + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    out += '<ellipse cx="48" cy="98" rx="3.4" ry="2" fill="#FF8FB1" opacity=".5"/><ellipse cx="72" cy="98" rx="3.4" ry="2" fill="#FF8FB1" opacity=".5"/>';
    return out;
  }
  var seq = 0;
  function element(stage, pot, face) {
    var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' + svg(stage, pot, face).replace(/GID/g, 'pt' + (++seq)) + '</svg>', 'image/svg+xml');
    var el = document.importNode(doc.documentElement, true); el.setAttribute('aria-hidden', 'true'); el.setAttribute('class', 'pet-art'); return el;
  }
  // the ways to earn sunshine, once a day each (challenge weeks count every new tick)
  var WAYS = [['write', 3], ['mood', 1], ['money', 1], ['note', 1], ['nospend', 2], ['save', 2]];
  function clean(raw) {
    var r = raw && typeof raw === 'object' ? raw : {}, out = { on: r.on !== false, name: typeof r.name === 'string' ? r.name.replace(/[\u0000-\u001f]/g, '').slice(0, 16) : '', pot: POTS[r.pot] ? r.pot : 'cream',
      sun: Math.max(0, Math.min(100000, Math.round(+r.sun || 0))), ticks: Math.max(0, Math.round(+r.ticks || 0)), log: {}, seen: Math.max(0, Math.round(+r.seen || 0)) };
    if (r.log && typeof r.log === 'object') Object.keys(r.log).sort().slice(-40).forEach(function (d) { if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Array.isArray(r.log[d])) out.log[d] = r.log[d].filter(function (k) { return WAYS.some(function (w) { return w[0] === k; }); }).slice(0, 6); });
    return out;
  }
  root.VaultPet = { STAGES: STAGES, POTS: Object.keys(POTS), WAYS: WAYS, levelOf: levelOf, nextAt: nextAt, element: element, clean: clean, svg: svg };
})(typeof window !== 'undefined' ? window : globalThis);
