/* PopPopMake Vault — diary stickers and washi tapes. Original drawings made for PopPopMake (simple shapes, 64×64).
 * Static markup only: nothing a person types ever goes into it. Rendered with DOMParser as SVG, never as HTML.
 */
(function (root) {
  'use strict';
  var O = 'stroke="#3a3530" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  var EYES = function (x1, x2, y) { return '<circle cx="' + x1 + '" cy="' + y + '" r="2.2" fill="#3a3530"/><circle cx="' + x2 + '" cy="' + y + '" r="2.2" fill="#3a3530"/>'; };
  var SMILE = function (x, y, w) { return '<path d="M' + (x - w) + ' ' + y + ' q' + w + ' ' + (w * 0.9) + ' ' + (w * 2) + ' 0" fill="none" ' + O + ' stroke-width="2"/>'; };
  var BLUSH = function (x1, x2, y) { return '<ellipse cx="' + x1 + '" cy="' + y + '" rx="3.2" ry="2" fill="#FF9DB0" opacity=".8"/><ellipse cx="' + x2 + '" cy="' + y + '" rx="3.2" ry="2" fill="#FF9DB0" opacity=".8"/>'; };
  function star(cx, cy, R, r) {
    var p = [];
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; p.push((cx + d * Math.cos(a)).toFixed(1) + ',' + (cy + d * Math.sin(a)).toFixed(1)); }
    return p.join(' ');
  }
  function petals(cx, cy, d, r, n, fill) {
    var s = '';
    for (var i = 0; i < n; i++) { var a = i * 2 * Math.PI / n - Math.PI / 2; s += '<circle cx="' + (cx + d * Math.cos(a)).toFixed(1) + '" cy="' + (cy + d * Math.sin(a)).toFixed(1) + '" r="' + r + '" fill="' + fill + '" ' + O + '/>'; }
    return s;
  }
  var HEART = 'M32 54C14 42 6 32 6 22 6 13 13 7 21 7c5 0 9 3 11 7 2-4 6-7 11-7 8 0 15 6 15 15 0 10-8 20-26 32z';

  var ART = {
    heart: '<path d="' + HEART + '" fill="#FF8FA3" ' + O + '/><ellipse cx="18" cy="18" rx="4.5" ry="2.6" fill="#fff" opacity=".75" transform="rotate(-35 18 18)"/>',
    hearts: '<g transform="translate(2 12) scale(.62)"><path d="' + HEART + '" fill="#FFB3C7" ' + O + ' stroke-width="4"/></g><g transform="translate(22 4) scale(.66)"><path d="' + HEART + '" fill="#FF6F8E" ' + O + ' stroke-width="3.8"/></g>',
    star: '<polygon points="' + star(32, 34, 27, 12) + '" fill="#FFD45C" ' + O + '/>' + EYES(27, 37, 34) + SMILE(32, 39, 3) + BLUSH(23, 41, 39),
    sparkle: '<path d="M30 6c2 16 9 23 24 25-15 2-22 9-24 25-2-16-9-23-24-25 15-2 22-9 24-25z" fill="#FFE680" ' + O + '/><path d="M52 6c.7 5 3 7.5 8 8-5 .7-7.3 3-8 8-.7-5-3-7.3-8-8 5-.5 7.3-3 8-8z" fill="#FFF3B0" ' + O + ' stroke-width="2"/>',
    flower: petals(32, 32, 13, 10, 5, '#FFB3C7') + '<circle cx="32" cy="32" r="8" fill="#FFD45C" ' + O + '/>',
    tulip: '<path d="M32 36v22" ' + O + ' stroke="#4E9A5B" fill="none"/><path d="M32 52c-8-2-13-8-14-15 8 1 12 6 14 15z" fill="#8FD694" ' + O + '/><path d="M18 14l7 7 7-11 7 11 7-7v12c0 8-6 14-14 14s-14-6-14-14z" fill="#FF8A80" ' + O + '/>',
    clover: '<path d="M33 34q8 12 20 22" fill="none" ' + O + ' stroke="#4E9A5B" stroke-width="3"/><g transform="translate(32 32) rotate(45)">' + [0, 90, 180, 270].map(function (a) { return '<g transform="rotate(' + a + ') translate(-11.5 -25) scale(.36)"><path d="' + HEART + '" fill="#8FD694" ' + O + ' stroke-width="6.5"/></g>'; }).join('') + '</g>',
    leaf: '<path d="M10 54C8 30 22 10 54 8c2 30-16 46-44 46z" fill="#9BD38A" ' + O + '/><path d="M12 52C24 40 34 28 46 16" fill="none" ' + O + ' stroke-width="2"/>',
    sun: [0, 45, 90, 135, 180, 225, 270, 315].map(function (a) { return '<path d="M32 4v8" ' + O + ' transform="rotate(' + a + ' 32 32)" stroke="#F4A93B"/>'; }).join('') + '<circle cx="32" cy="32" r="15" fill="#FFC94D" ' + O + '/>' + EYES(27, 37, 30) + SMILE(32, 35, 3.5) + BLUSH(23, 41, 35),
    cloud: '<path d="M16 46a10 10 0 0 1 0-20 13 13 0 0 1 24-6 11 11 0 0 1 10 21v5z" fill="#fff" ' + O + '/>' + EYES(27, 37, 36) + SMILE(32, 40, 2.5),
    rain: '<path d="M14 36a9 9 0 0 1 0-18 12 12 0 0 1 22-5 10 10 0 0 1 10 18v5z" fill="#DCEBFA" ' + O + '/>' + [[18, 44], [30, 48], [42, 44]].map(function (p) { return '<path d="M' + p[0] + ' ' + p[1] + 'q-4 6 0 8 4-2 0-8z" fill="#6FB1F2" ' + O + ' stroke-width="2"/>'; }).join(''),
    snow: [0, 60, 120].map(function (a) { return '<g transform="rotate(' + a + ' 32 32)"><path d="M32 6v52M26 12l6 6 6-6M26 52l6-6 6 6" fill="none" ' + O + ' stroke="#6FA8DC"/></g>'; }).join('') + '<circle cx="32" cy="32" r="4" fill="#CFE4FA" ' + O + ' stroke-width="2"/>',
    rainbow: '<path d="M6 46a26 26 0 0 1 52 0" fill="none" stroke="#FF8A80" stroke-width="7"/><path d="M13 46a19 19 0 0 1 38 0" fill="none" stroke="#FFD45C" stroke-width="7"/><path d="M20 46a12 12 0 0 1 24 0" fill="none" stroke="#8FC7FF" stroke-width="7"/><path d="M4 48a6 6 0 0 1 8-6 6 6 0 0 1 10 4v4H4zM42 50v-4a6 6 0 0 1 10-4 6 6 0 0 1 8 6v2z" fill="#fff" ' + O + '/>',
    moon: '<path d="M40 6a24 24 0 1 0 18 34A20 20 0 0 1 40 6z" fill="#FFE38A" ' + O + '/><path d="M22 34q3 3 6 0M32 40q3 3 6 0" fill="none" ' + O + ' stroke-width="2"/>' + BLUSH(22, 40, 44),
    coffee: '<path d="M24 6q-4 5 0 9t0 9M34 6q-4 5 0 9t0 9" fill="none" ' + O + ' stroke="#B0A49A" stroke-width="2"/><path d="M12 26h34v16a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12z" fill="#F5E6D3" ' + O + '/><path d="M46 30h4a6 6 0 0 1 0 12h-5" fill="none" ' + O + '/><ellipse cx="29" cy="26" rx="17" ry="3" fill="#8B5E3C" ' + O + ' stroke-width="2"/>' + EYES(24, 34, 38) + SMILE(29, 42, 2.5),
    cake: '<path d="M10 34h44v20H10z" fill="#FFD9E2" ' + O + '/><path d="M10 34q5 7 11 0 5 7 11 0 5 7 11 0 5 7 11 0" fill="#fff" ' + O + '/><path d="M30 20h4v14h-4z" fill="#8FC7FF" ' + O + ' stroke-width="2"/><path d="M32 8q5 6 0 10-5-4 0-10z" fill="#FFB347" ' + O + ' stroke-width="2"/><circle cx="20" cy="46" r="2.5" fill="#FF6F7D"/><circle cx="32" cy="48" r="2.5" fill="#FF6F7D"/><circle cx="44" cy="46" r="2.5" fill="#FF6F7D"/>',
    icecream: '<path d="M18 30h28L32 60z" fill="#F2C27B" ' + O + '/><path d="M22 36l14 14M28 32l12 12M42 36L28 50" fill="none" ' + O + ' stroke-width="1.6" opacity=".6"/><path d="M14 30a18 16 0 0 1 36 0q-4 4-9 0-4 4-9 0-5 4-9 0-5 4-9 0z" fill="#FFB3C7" ' + O + '/><circle cx="34" cy="12" r="4" fill="#FF6F7D" ' + O + ' stroke-width="2"/>',
    strawberry: '<path d="M12 22c0-6 10-8 20-8s20 2 20 8c0 16-10 32-20 36C22 54 12 38 12 22z" fill="#FF6F7D" ' + O + '/><path d="M18 16l6-8 4 6 4-8 4 8 4-6 6 8q-14 6-28 0z" fill="#7CC77F" ' + O + '/>' + [[22, 26], [32, 24], [42, 26], [26, 36], [38, 36], [32, 46]].map(function (p) { return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="1.4" ry="2.2" fill="#FFF2A8"/>'; }).join(''),
    cherry: '<path d="M22 42q4-20 18-34M42 44q0-20-2-36" fill="none" ' + O + ' stroke="#4E9A5B"/><path d="M40 8q10-2 14 6-10 2-14-6z" fill="#8FD694" ' + O + ' stroke-width="2"/><circle cx="20" cy="46" r="11" fill="#E8445A" ' + O + '/><circle cx="43" cy="47" r="11" fill="#E8445A" ' + O + '/><circle cx="16" cy="42" r="2.4" fill="#fff" opacity=".8"/><circle cx="39" cy="43" r="2.4" fill="#fff" opacity=".8"/>',
    riceball: '<path d="M32 8c6 0 26 34 26 42 0 6-6 8-26 8S6 56 6 50C6 42 26 8 32 8z" fill="#fff" ' + O + '/><rect x="21" y="40" width="22" height="18" rx="2" fill="#3a3530"/>' + EYES(26, 38, 30) + SMILE(32, 34, 2.5) + BLUSH(21, 43, 35),
    cat: '<path d="M10 28L12 8l14 10h12l14-10 2 20c0 16-10 26-22 26S10 44 10 28z" fill="#D9D4CF" ' + O + '/><path d="M15 14l2 8M49 14l-2 8" ' + O + ' stroke="#FF9DB0"/>' + EYES(24, 40, 32) + '<path d="M30 38l2 2 2-2" fill="#FF9DB0" ' + O + ' stroke-width="1.6"/><path d="M8 36l10 1M8 42l10-2M56 36l-10 1M56 42l-10-2" ' + O + ' stroke-width="1.4"/>' + BLUSH(19, 45, 40),
    dog: '<path d="M14 26c0-12 8-18 18-18s18 6 18 18v10c0 12-8 18-18 18S14 48 14 36z" fill="#F2D3A2" ' + O + '/><path d="M16 14C8 14 4 24 6 36c4 2 8 0 10-6zM48 14c8 0 12 10 10 22-4 2-8 0-10-6z" fill="#C99A6B" ' + O + '/>' + EYES(25, 39, 30) + '<ellipse cx="32" cy="38" rx="4" ry="3" fill="#3a3530"/><path d="M32 41v3M28 45q4 3 8 0" fill="none" ' + O + ' stroke-width="1.8"/>' + BLUSH(20, 44, 40),
    bear: '<circle cx="14" cy="16" r="8" fill="#C99A6B" ' + O + '/><circle cx="50" cy="16" r="8" fill="#C99A6B" ' + O + '/><circle cx="32" cy="34" r="22" fill="#C99A6B" ' + O + '/><ellipse cx="32" cy="42" rx="10" ry="8" fill="#F2D3A2" ' + O + ' stroke-width="2"/>' + EYES(24, 40, 30) + '<ellipse cx="32" cy="39" rx="3" ry="2.2" fill="#3a3530"/><path d="M29 44q3 2 6 0" fill="none" ' + O + ' stroke-width="1.6"/>',
    bunny: '<path d="M22 28C16 18 16 4 22 4s8 14 6 24zM42 28c6-10 6-24 0-24s-8 14-6 24z" fill="#fff" ' + O + '/><path d="M22 10c-2 6-1 12 2 16M42 10c2 6 1 12-2 16" fill="none" stroke="#FF9DB0" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="42" rx="20" ry="17" fill="#fff" ' + O + '/>' + EYES(25, 39, 40) + '<path d="M30 45l2 2 2-2" fill="#FF9DB0" ' + O + ' stroke-width="1.6"/>' + BLUSH(20, 44, 47),
    chick: '<ellipse cx="32" cy="38" rx="22" ry="20" fill="#FFE066" ' + O + '/><path d="M28 18q2-8 6-4 2-6 4 2" fill="none" ' + O + ' stroke-width="2"/><path d="M10 40q-4-8 4-10M54 40q4-8-4-10" fill="#FFD43B" ' + O + ' stroke-width="2"/>' + EYES(25, 39, 34) + '<path d="M28 40l4 4 4-4z" fill="#FF9F43" ' + O + ' stroke-width="1.8"/>' + BLUSH(20, 44, 42),
    plane: '<path d="M6 30L58 10 44 54 32 38z" fill="#fff" ' + O + '/><path d="M58 10L32 38l-2 14 8-10" fill="#CFE4FA" ' + O + '/><path d="M4 50q8-2 12 2M2 42q6-2 10 0" fill="none" ' + O + ' stroke="#8FC7FF" stroke-width="2"/>',
    gift: '<rect x="10" y="26" width="44" height="30" rx="3" fill="#FF8FA3" ' + O + '/><rect x="6" y="18" width="52" height="10" rx="3" fill="#FFB3C7" ' + O + '/><path d="M28 18h8v38h-8z" fill="#FFD45C" ' + O + ' stroke-width="2"/><path d="M32 18c-6-10-18-10-14-2 2 3 8 2 14 2zM32 18c6-10 18-10 14-2-2 3-8 2-14 2z" fill="#FFD45C" ' + O + ' stroke-width="2"/>',
    balloon: '<path d="M32 46q-3 6 2 10t-2 8" fill="none" ' + O + ' stroke-width="1.6"/><ellipse cx="32" cy="24" rx="17" ry="20" fill="#8FC7FF" ' + O + '/><path d="M29 44h6l-3 4z" fill="#8FC7FF" ' + O + ' stroke-width="2"/><ellipse cx="25" cy="16" rx="3.5" ry="6" fill="#fff" opacity=".7" transform="rotate(20 25 16)"/>',
    music: '<path d="M22 46V14l28-6v32" fill="none" ' + O + ' stroke-width="3"/><path d="M22 14l28-6v8l-28 6z" fill="#B39DDB" ' + O + ' stroke-width="2"/><ellipse cx="16" cy="46" rx="7" ry="5.5" fill="#B39DDB" ' + O + '/><ellipse cx="44" cy="40" rx="7" ry="5.5" fill="#B39DDB" ' + O + '/>',
    camera: '<rect x="6" y="18" width="52" height="36" rx="7" fill="#BFD7EA" ' + O + '/><path d="M22 18l4-7h12l4 7" fill="#9FC1DE" ' + O + '/><circle cx="32" cy="36" r="11" fill="#fff" ' + O + '/><circle cx="32" cy="36" r="5.5" fill="#3a3530"/><circle cx="34" cy="34" r="1.6" fill="#fff"/><circle cx="49" cy="26" r="2.5" fill="#FF8A80"/>',
    pencil: '<g transform="rotate(45 32 32)"><rect x="25" y="2" width="14" height="44" fill="#FFD45C" ' + O + '/><path d="M25 46h14l-7 14z" fill="#F5D7B5" ' + O + '/><path d="M30 56l2 4 2-4z" fill="#3a3530"/><rect x="25" y="2" width="14" height="7" fill="#FF9DB0" ' + O + '/></g>',
    check: '<circle cx="32" cy="32" r="25" fill="#8FD694" ' + O + '/><path d="M20 33l8 8 16-17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    bubble: '<path d="M10 12h44a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H28l-12 10 2-10h-8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="#fff" ' + O + '/><circle cx="22" cy="28" r="3" fill="#3a3530"/><circle cx="32" cy="28" r="3" fill="#3a3530"/><circle cx="42" cy="28" r="3" fill="#3a3530"/>',
    ribbon: '<path d="M32 30L8 16v28zM32 30l24-14v28z" fill="#FF8FA3" ' + O + '/><path d="M28 34l-8 22 7-3 4 6 3-25zM36 34l8 22-7-3-4 6-3-25z" fill="#FF6F8E" ' + O + ' stroke-width="2"/><rect x="26" y="24" width="12" height="12" rx="4" fill="#FFB3C7" ' + O + '/>',
    house: '<path d="M14 30v24h36V30" fill="#FFE0B2" ' + O + '/><path d="M6 32L32 8l26 24" fill="#FF8A65" ' + O + '/><rect x="27" y="40" width="10" height="14" rx="2" fill="#C99A6B" ' + O + ' stroke-width="2"/><rect x="40" y="36" width="7" height="7" fill="#8FC7FF" ' + O + ' stroke-width="2"/>',
    book: '<path d="M32 16C24 10 14 10 6 12v38c8-2 18-2 26 4 8-6 18-6 26-4V12c-8-2-18-2-26 4z" fill="#fff" ' + O + '/><path d="M32 16v38" ' + O + '/><path d="M12 22q8-2 14 1M12 30q8-2 14 1M38 23q6-3 14-1M38 31q6-3 14-1" fill="none" ' + O + ' stroke-width="1.6" opacity=".55"/>',
    note: '<rect x="10" y="10" width="44" height="44" rx="3" fill="#FFF0A6" ' + O + '/><path d="M42 54l12-12h-9a3 3 0 0 0-3 3z" fill="#F5D76E" ' + O + ' stroke-width="2"/><path d="M18 22h28M18 30h28M18 38h18" ' + O + ' stroke-width="2" opacity=".6"/><rect x="24" y="5" width="16" height="9" rx="1" fill="#8FC7FF" opacity=".8"/>',
    smile: '<circle cx="32" cy="32" r="25" fill="#FFE066" ' + O + '/>' + EYES(24, 40, 28) + '<path d="M20 36q12 14 24 0" fill="#fff" ' + O + '/>' + BLUSH(17, 47, 36),
    fire: '<path d="M32 58c-12 0-20-8-20-18 0-12 10-16 10-28 6 4 10 10 10 16 2-4 2-8 0-12 10 6 20 14 20 26 0 10-8 16-20 16z" fill="#FF8A65" ' + O + '/><path d="M32 56c-6 0-10-4-10-9 0-6 6-8 8-14 4 4 12 8 12 15 0 5-4 8-10 8z" fill="#FFD45C" ' + O + ' stroke-width="2"/>',
    medal: '<path d="M22 4h8l4 18h-8zM34 4h8l-4 18h-8z" fill="#8FC7FF" ' + O + ' stroke-width="2"/><circle cx="32" cy="40" r="17" fill="#FFD45C" ' + O + '/><polygon points="' + star(32, 41, 9, 4) + '" fill="#fff" ' + O + ' stroke-width="1.6"/>'
  };
  // Shapes above often add their own stroke colour or width after the shared outline: keep the last value of each attribute.
  function tidy(markup) {
    return markup.replace(/<(\w+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g, function (m, tag, attrs, close) {
      var seen = {}, order = [];
      attrs.replace(/([\w:-]+)="([^"]*)"/g, function (x, k, v) { if (!(k in seen)) order.push(k); seen[k] = v; return x; });
      return '<' + tag + order.map(function (k) { return ' ' + k + '="' + seen[k] + '"'; }).join('') + (close ? '/>' : '>');
    });
  }
  Object.keys(ART).forEach(function (k) { ART[k] = tidy(ART[k]); });
  var TAPE_EDGE = 'M4 4h152l-4 6 5 6-5 6 5 6-5 6 4 6H4l4-6-5-6 5-6-5-6 5-6z';
  var TAPES = {
    stripe: { fill: '#FFD9E2', pat: '<pattern id="ID" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="12" fill="#FF9DB0"/></pattern>' },
    dots: { fill: '#D6F2D0', pat: '<pattern id="ID" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2.4" fill="#fff"/></pattern>' },
    grid: { fill: '#D5E7FF', pat: '<pattern id="ID" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0v10" fill="none" stroke="#fff" stroke-width="1.6"/></pattern>' },
    check: { fill: '#FFF0A6', pat: '<pattern id="ID" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#FFD45C" opacity=".55"/><rect x="8" y="8" width="8" height="8" fill="#FFD45C" opacity=".55"/></pattern>' },
    heart: { fill: '#E7DDFF', pat: '<pattern id="ID" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M10 15C6 12 4 10 4 8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 2-2 4-6 7z" fill="#fff"/></pattern>' },
    mint: { fill: '#BFEBDD', pat: '' },
    kraft: { fill: '#E2CBA6', pat: '<pattern id="ID" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".8" fill="#B8956A"/><circle cx="6" cy="6" r=".6" fill="#B8956A"/></pattern>' }
  };
  var EMOJI = ['😀', '😊', '🥰', '😎', '🤔', '😴', '😭', '🥳', '❤️', '💛', '💚', '💙', '💜', '⭐', '✨', '🌈', '☀️', '🌙', '☁️', '🌧️', '❄️', '🌸', '🌷', '🍀',
    '🍁', '☕', '🍰', '🍓', '🍙', '🍜', '🍕', '🍺', '🐶', '🐱', '🐰', '🐻', '🐥', '✈️', '🎁', '🎂', '🎵', '📚', '✏️', '🏃', '💪', '💤', '💯', '👍'];

  var parser = null, n = 0;
  // A sticker as an element: drawn art and tapes become SVG, emoji a text span. Unknown names give null.
  function element(k) {
    var doc = root.document; if (!doc) return null;
    var kind = k.slice(0, 2), name = k.slice(2), markup = null, vb = '0 0 64 64';
    if (kind === 'a:' && Object.prototype.hasOwnProperty.call(ART, name)) markup = ART[name];
    else if (kind === 't:' && Object.prototype.hasOwnProperty.call(TAPES, name)) {
      var tp = TAPES[name], id = 'tp' + (++n) + Math.random().toString(36).slice(2, 6);
      markup = (tp.pat ? '<defs>' + tp.pat.replace('ID', id) + '</defs>' : '') + '<path d="' + TAPE_EDGE + '" fill="' + tp.fill + '"/>' + (tp.pat ? '<path d="' + TAPE_EDGE + '" fill="url(#' + id + ')"/>' : '');
      vb = '0 0 160 40';
    } else if (kind === 'e:') {
      var sp = doc.createElement('span'); sp.className = 'st-emoji'; sp.textContent = name; return sp;
    }
    if (markup === null) return null;
    parser = parser || new root.DOMParser();
    var svg = parser.parseFromString('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '">' + markup + '</svg>', 'image/svg+xml').documentElement;
    if (svg.nodeName !== 'svg') return null;
    var el = doc.importNode(svg, true); el.setAttribute('aria-hidden', 'true'); el.setAttribute('class', kind === 't:' ? 'st-tape' : 'st-art');
    return el;
  }
  var api = { ART: Object.keys(ART), TAPES: Object.keys(TAPES), EMOJI: EMOJI, element: element };
  root.VaultStickers = api;
})(typeof window !== 'undefined' ? window : globalThis);
