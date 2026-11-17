/* PopPopMake calendar wallpapers: one of the original cover scenes + a month calendar, drawn on this device into a
 * picture sized for a phone, tablet or computer. Used by the free wallpaper page and inside the Diary app (which can
 * add each day's mood face). Nothing is uploaded. Text is drawn with fillText, never as HTML.
 */
(function (root) {
  'use strict';
  var SIZES = {
    iphone: { w: 1179, h: 2556, label: 'iPhone' }, iphonemax: { w: 1290, h: 2796, label: 'iPhone Pro Max / Plus' },
    galaxy: { w: 1080, h: 2340, label: 'Galaxy S / Android' }, galaxyultra: { w: 1440, h: 3120, label: 'Galaxy Ultra' },
    ipad: { w: 2048, h: 2732, label: 'iPad' }, desktop: { w: 2560, h: 1440, label: 'Desktop / Laptop' }
  };
  var L = {
    en: { months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], title: function (y, m) { return this.months[m]; }, sub: function (y) { return String(y); } },
    ko: { months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], wd: ['일', '월', '화', '수', '목', '금', '토'], title: function (y, m) { return String(m + 1); }, sub: function (y, m) { return y + '년 ' + (m + 1) + '월'; } },
    ja: { months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'], wd: ['日', '月', '火', '水', '木', '金', '土'], title: function (y, m) { return String(m + 1); }, sub: function (y, m) { return y + '年 ' + (m + 1) + '月'; } }
  };
  var SANS = '-apple-system, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Hiragino Sans", "Noto Sans JP", Roboto, sans-serif';
  var SCRIPT = '"PPM Script", "Allura", Georgia, serif';
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function svgToImage(svg) {
    var s = new root.XMLSerializer().serializeToString(svg);
    if (s.indexOf('xmlns=') < 0) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    var url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
    return new Promise(function (res) { var im = new root.Image(); im.onload = function () { res(im); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); }; im.onerror = function () { res(null); URL.revokeObjectURL(url); }; im.src = url; });
  }
  // the scene, scaled to cover the picture; fx (0..1) picks which part of a wide scene shows on a tall phone
  function drawScene(c, art, W, H, fx, tone) {
    var CV = root.VaultCovers; if (!CV) return Promise.resolve();
    var el = CV.element(art); el.setAttribute('width', '400'); el.setAttribute('height', '240'); el.setAttribute('preserveAspectRatio', 'none');
    return svgToImage(el).then(function (im) {
      if (!im) return;
      var scale = Math.max(W / 400, H / 240), dw = 400 * scale, dh = 240 * scale;
      var dx = -(dw - W) * (fx == null ? 0.5 : fx), dy = -(dh - H) / 2;
      // the vector scene is drawn straight at its final size, so it stays sharp at any resolution
      if (CV.TONES && tone && CV.TONES[tone]) { try { c.filter = CV.TONES[tone]; } catch (e) {} }
      c.drawImage(im, dx, dy, dw, dh);
      try { c.filter = 'none'; } catch (e) {}
    });
  }
  function luminanceDark(ink) { return /^#(?:[0-5]|6[0-9A-F])/i.test(ink || '#FFF'); }
  // o: { art, tone, fx, year, month (0-11), lang, size, layout: 'top'|'middle'|'bottom', card: 'glass'|'clear', weekStart: 0|1,
  //      line (an optional short line), moods: {day: 1..5}, faces: function (mood) → svg element, today (day number or 0), mark }
  function render(o) {
    var S = SIZES[o.size] || SIZES.iphone, W = S.w, H = S.h, desk = W > H, lang = L[o.lang] ? o.lang : 'en', T = L[lang];
    var cv = root.document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d');
    var CV = root.VaultCovers, ink = CV ? CV.ink(o.art) : '#FFFFFF', darkInk = luminanceDark(ink);
    var fontReady = root.document.fonts && root.document.fonts.load ? Promise.all([root.document.fonts.load('80px "PPM Script"'), root.document.fonts.load('40px ' + SANS.split(',')[0])]).catch(function () {}) : Promise.resolve();
    var faces = {};
    var faceJobs = o.moods && o.faces ? [1, 2, 3, 4, 5].map(function (m) { var el = o.faces(m); if (!el) return null; el.setAttribute('width', 128); el.setAttribute('height', 128); return svgToImage(el).then(function (im) { faces[m] = im; }); }) : [];
    return Promise.all([fontReady, drawScene(c, o.art, W, H, o.fx, o.tone)].concat(faceJobs)).then(function () {
      var u = Math.min(W, H) / 1179;                       // one unit ≈ a pixel on an iPhone picture
      var first = new Date(o.year, o.month, 1).getDay(), days = new Date(o.year, o.month + 1, 0).getDate();
      var ws = o.weekStart === 1 ? 1 : 0, offset = (first - ws + 7) % 7, rows = Math.ceil((offset + days) / 7);
      var cw = desk ? Math.round(W * 0.3) : Math.round(W * 0.84), cellW = (cw - 64 * u) / 7, cellH = cellW * (o.moods ? 1.08 : 0.82);
      var headH = (lang === 'en' ? 170 : 150) * u, wdH = 64 * u, ch = headH + wdH + rows * cellH + 44 * u + (o.line ? 70 * u : 0);
      var cx = desk ? W - cw - Math.round(W * 0.06) : (W - cw) / 2;
      var cy = desk ? (H - ch) / 2 : o.layout === 'top' ? H * 0.12 : o.layout === 'bottom' ? H - ch - H * 0.13 : H * 0.42 - ch * 0.15;
      if (!desk && o.layout === 'middle') cy = Math.max(H * 0.34, Math.min(cy, H - ch - H * 0.12));
      var glass = o.card !== 'clear';
      if (!glass) {                                     // no card: read how bright the scene is behind the calendar and pick dark or light words
        try {
          var sx = Math.max(0, Math.round(cx)), sy = Math.max(0, Math.round(cy)), sw = Math.min(W - sx, Math.round(cw)), sh = Math.min(H - sy, Math.round(ch));
          var px = c.getImageData(sx, sy, sw, sh).data, sum = 0, cnt = 0;
          for (var q = 0; q < px.length; q += 4 * 97) { sum += 0.299 * px[q] + 0.587 * px[q + 1] + 0.114 * px[q + 2]; cnt++; }
          darkInk = sum / cnt > 165;
        } catch (e) {}
      }
      var fg = glass ? '#2B2730' : (darkInk ? '#2B2730' : '#FFFFFF'), soft = glass ? 'rgba(43,39,48,.55)' : (darkInk ? 'rgba(43,39,48,.66)' : 'rgba(255,255,255,.85)');
      if (glass) {
        c.save(); c.shadowColor = 'rgba(30,20,40,.18)'; c.shadowBlur = 60 * u; c.shadowOffsetY = 16 * u;
        c.fillStyle = 'rgba(255,255,255,.72)'; rr(c, cx, cy, cw, ch, 56 * u); c.fill(); c.restore();
        c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3 * u; rr(c, cx, cy, cw, ch, 56 * u); c.stroke();
      } else { c.shadowColor = darkInk ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.28)'; c.shadowBlur = 18 * u; }
      // the month: a script word in English, a big light number in Korean and Japanese
      c.textBaseline = 'alphabetic'; c.fillStyle = fg;
      if (lang === 'en') { c.textAlign = 'left'; c.font = Math.round(120 * u) + 'px ' + SCRIPT; c.fillText(T.title(o.year, o.month), cx + 44 * u, cy + 128 * u); c.textAlign = 'right'; c.fillStyle = soft; c.font = '300 ' + Math.round(40 * u) + 'px ' + SANS; c.fillText(T.sub(o.year, o.month), cx + cw - 44 * u, cy + 118 * u); }
      else { c.textAlign = 'left'; c.font = '200 ' + Math.round(118 * u) + 'px ' + SANS; c.fillText(T.title(o.year, o.month), cx + 44 * u, cy + 124 * u); var tw = c.measureText(T.title(o.year, o.month)).width; c.fillStyle = soft; c.font = '400 ' + Math.round(38 * u) + 'px ' + SANS; c.fillText(T.sub(o.year, o.month), cx + 60 * u + tw, cy + 118 * u); }
      // weekday letters
      var gx = cx + 32 * u, gy = cy + headH;
      c.textAlign = 'center'; c.font = '600 ' + Math.round(30 * u) + 'px ' + SANS;
      for (var i = 0; i < 7; i++) { var d = (i + ws) % 7; c.fillStyle = d === 0 ? '#E8607E' : d === 6 ? '#5C86D6' : soft; c.fillText(T.wd[d], gx + cellW * (i + 0.5), gy + 40 * u); }
      // days
      for (var n = 1; n <= days; n++) {
        var k = offset + n - 1, col = k % 7, row = Math.floor(k / 7), x = gx + cellW * (col + 0.5), y = gy + wdH + cellH * row, wd = (col + ws) % 7;
        if (o.today === n) { c.save(); c.shadowColor = 'transparent'; c.fillStyle = glass ? '#2B2730' : (darkInk ? 'rgba(43,39,48,.85)' : 'rgba(255,255,255,.92)'); c.beginPath(); c.arc(x, y + 34 * u, 30 * u, 0, Math.PI * 2); c.fill(); c.restore(); }
        c.fillStyle = o.today === n ? (glass || darkInk ? '#FFFFFF' : '#2B2730') : wd === 0 ? '#E8607E' : wd === 6 ? '#5C86D6' : fg;
        c.font = (o.today === n ? '700 ' : '500 ') + Math.round(36 * u) + 'px ' + SANS; c.fillText(String(n), x, y + 47 * u);
        var mood = o.moods && o.moods[n]; if (mood && faces[mood]) { var fs = Math.min(cellW * 0.52, 58 * u); c.drawImage(faces[mood], x - fs / 2, y + 70 * u, fs, fs); }
      }
      c.shadowColor = 'transparent'; c.shadowBlur = 0;
      if (o.line) { c.fillStyle = soft; c.font = 'italic 400 ' + Math.round(34 * u) + 'px ' + SANS; c.textAlign = 'center'; c.fillText(String(o.line).slice(0, 40), cx + cw / 2, cy + ch - 40 * u); }
      if (o.mark !== false) {                           // a faint address so a shared wallpaper says where it came from
        c.textAlign = 'center'; c.font = '600 ' + Math.round(24 * u) + 'px ' + SANS; c.fillStyle = darkInk ? 'rgba(43,39,48,.32)' : 'rgba(255,255,255,.55)';
        c.fillText('poppopmake.com', desk ? W - 160 * u : W / 2, desk ? H - 40 * u : H - 150 * u);
      }
      return cv;
    });
  }
  function toBlob(cv) { return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('png')); }, 'image/png'); }); }
  root.PPMCalWall = { SIZES: SIZES, LANG: L, render: render, toBlob: toBlob };
})(typeof window !== 'undefined' ? window : globalThis);
