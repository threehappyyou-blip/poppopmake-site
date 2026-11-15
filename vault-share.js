/* PopPopMake Vault — pictures and short videos to share: a decorated diary page as a 9:16 image (stories, Shorts, Reels),
 * the same page "being decorated" as a few-second video, and a month / year of moods as a poster.
 * Everything is drawn on this device into a canvas; nothing is sent anywhere. Text is drawn with fillText (never as HTML).
 */
(function (root) {
  'use strict';
  var W = 1080, H = 1920;

  // ---------- small helpers ----------
  function loadImg(src) {
    return new Promise(function (res) { var im = new root.Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; });
  }
  function svgImg(el, size) {
    if (!el) return Promise.resolve(null);
    var c = el.cloneNode(true);
    if (c.nodeName.toLowerCase() !== 'svg') return Promise.resolve(null);
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', size); c.setAttribute('height', size);
    if (c.getAttribute('class') === 'st-tape') c.setAttribute('height', size / 4);
    var xml = new root.XMLSerializer().serializeToString(c);
    return loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml));
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function split(s) {                 // split a CSS list at top-level commas
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) { var ch = s[i]; if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) out.push(cur.trim()); return out;
  }
  function px(v, full) { v = String(v).trim(); if (/%$/.test(v)) return parseFloat(v) / 100 * full; return parseFloat(v) || 0; }
  function mix(hex, amt) {             // lighten (amt>0) or darken a CSS colour for the backdrop gradient
    var m = String(hex).match(/rgba?\(([^)]+)\)/), r, g, b;
    if (m) { var p = m[1].split(',').map(parseFloat); r = p[0]; g = p[1]; b = p[2]; } else return hex;
    function f(c) { return Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt)); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  // ---------- paper: the page's own CSS background, painted into the canvas ----------
  // Reads the computed background of an element with the page's classes and repeats each layer as a pattern, scaled by k.
  function paperLayers(className) {
    var el = root.document.createElement('div'); el.className = className; el.style.cssText = 'position:absolute;left:-9999px;top:0;width:360px;height:200px';
    root.document.body.appendChild(el);
    var cs = root.getComputedStyle(el), out = { color: cs.backgroundColor, images: split(cs.backgroundImage === 'none' ? '' : cs.backgroundImage), sizes: split(cs.backgroundSize) };
    el.remove(); return out;
  }
  function gradientTile(layer, w, h) {
    var c = root.document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    var g = c.getContext('2d'), m = layer.match(/^(repeating-)?(linear|radial)-gradient\((.*)\)$/);
    if (!m) return null;
    var parts = split(m[3]), grad, len;
    if (m[2] === 'linear') {
      var ang = 180;
      if (/deg$/.test(parts[0])) { ang = parseFloat(parts.shift()); } else if (/^to /.test(parts[0])) { var tt = parts.shift(); ang = /right/.test(tt) ? 90 : /left/.test(tt) ? 270 : /top/.test(tt) ? 0 : 180; }
      var horiz = Math.round(ang) % 180 === 90; len = horiz ? c.width : c.height;
      grad = horiz ? g.createLinearGradient(0, 0, c.width, 0) : g.createLinearGradient(0, 0, 0, c.height);
    } else {
      var shape = parts[0], cx = c.width / 2, cy = c.height / 2;
      if (/circle|at /.test(shape)) { parts.shift(); var at = shape.match(/at\s+([\d.]+%?)\s+([\d.]+%?)/); if (at) { cx = px(at[1], c.width); cy = px(at[2], c.height); } }
      len = Math.max(c.width, c.height);
      grad = g.createRadialGradient(cx, cy, 0, cx, cy, len);
    }
    parts.forEach(function (st, i) {
      var mm = st.match(/^(rgba?\([^)]*\)|transparent|#[0-9a-f]+|[a-z]+)\s*(.*)$/i); if (!mm) return;
      var col = mm[1] === 'transparent' ? 'rgba(0,0,0,0)' : mm[1];
      var stops = mm[2] ? mm[2].split(/\s+/) : [String(i / Math.max(1, parts.length - 1) * 100) + '%'];
      stops.forEach(function (sp) { var o = Math.min(1, Math.max(0, px(sp, len) / len)); try { grad.addColorStop(o, col); } catch (e) { /* skip */ } });
    });
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function paintPaper(ctx, className, x, y, w, h, k) {
    var L = paperLayers(className);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = L.color && L.color !== 'rgba(0, 0, 0, 0)' ? L.color : '#fff'; ctx.fillRect(0, 0, w, h);
    var jobs = [];
    for (var i = L.images.length - 1; i >= 0; i--) (function (img, size) {
      var sz = (size || 'auto').split(/\s+/), tw = sz[0] === 'auto' ? 60 : px(sz[0], 360), th = sz[1] ? (sz[1] === 'auto' ? tw : px(sz[1], 200)) : tw;
      tw *= k; th *= k;
      var u = img.match(/^url\(["']?(.*?)["']?\)$/);
      if (u) jobs.push(loadImg(u[1]).then(function (im) {
        if (!im) return null;
        var c = root.document.createElement('canvas'); c.width = Math.max(1, Math.round(tw)); c.height = Math.max(1, Math.round(th));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c;
      }));
      else jobs.push(Promise.resolve(gradientTile(img, tw, th)));
    })(L.images[i], L.sizes[i] || L.sizes[0]);
    return Promise.all(jobs).then(function (tiles) {
      tiles.forEach(function (c) { if (!c) return; var p = ctx.createPattern(c, 'repeat'); ctx.fillStyle = p; ctx.fillRect(0, 0, w, h); });
      ctx.restore();
      return L.color;
    });
  }
  function fontOf(className) {
    var el = root.document.createElement('span'); el.className = className; el.style.cssText = 'position:absolute;left:-9999px';
    root.document.body.appendChild(el); var f = root.getComputedStyle(el).fontFamily; el.remove(); return f;
  }
  function wrap(ctx, text, maxW) {     // break lines by width (Korean and Japanese can break anywhere)
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var line = '';
      Array.from(para).forEach(function (ch) {
        if (ctx.measureText(line + ch).width > maxW && line) {
          var sp = line.lastIndexOf(' ');
          if (sp > line.length * 0.6 && /[A-Za-z0-9]/.test(ch)) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; } else { out.push(line); line = ch; }
        } else line += ch;
      });
      out.push(line);
    });
    return out;
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function pop(t) { if (t <= 0) return 0; if (t >= 1) return 1; var s = 1.70158; t = t - 1; return t * t * ((s + 1) * t + s) + 1; }

  // ---------- the diary page as a picture ----------
  // d: { date label, weekday, mood (1-5), text, lines (filled pages), deco, photos: [url], brand, title }
  function prepareEntry(d, env) {
    var deco = d.deco || { paper: 'plain', tint: 'none', font: 'base', stickers: [] };
    var cls = 'page paper-' + deco.paper + ' tint-' + deco.tint + ' font-' + deco.font;
    var family = fontOf('font-' + deco.font);
    var fontReady = root.document.fonts && root.document.fonts.load ? root.document.fonts.load('40px ' + family, (d.text || '') + '가나다').catch(function () {}) : Promise.resolve();
    var stickers = Promise.all((deco.stickers || []).map(function (st) {
      if (st.k.charAt(0) === 'e') return Promise.resolve({ st: st, emoji: st.k.slice(2) });
      return svgImg(env.ST.element(st.k), 512).then(function (im) { return { st: st, img: im }; });
    }));
    var mood = d.mood && env.ST.mood ? svgImg(env.ST.mood(d.mood), 256) : Promise.resolve(null);
    var photos = Promise.all((d.photos || []).slice(0, 3).map(loadImg));
    return Promise.all([fontReady, stickers, mood, photos]).then(function (r) {
      return { d: d, deco: deco, cls: cls, family: family, stickers: r[1], mood: r[2], photos: r[3].filter(Boolean) };
    });
  }
  var CARD = { x: 60, y: 330, w: 960, h: 1400 };
  // t: 0..1 for the video (everything shown at 1). paperCanvas: the painted page, made once.
  function drawEntry(ctx, P, paper, t) {
    var d = P.d, k = CARD.w / 360;
    t = t == null ? 1 : t;
    // backdrop: a soft wash of the page colour
    var base = paper.color && paper.color !== 'rgba(0, 0, 0, 0)' ? paper.color : 'rgb(255,255,255)';
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix(base, 0.55)); g.addColorStop(1, mix(base, -0.06));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // header: date and the mood face
    var a = easeOut(Math.min(1, t / 0.12));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#2B2730'; ctx.textBaseline = 'alphabetic';
    ctx.font = '800 76px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Hiragino Sans", sans-serif';
    ctx.fillText(d.dateLabel || '', CARD.x + 8, 200 - (1 - a) * 30);
    ctx.font = '500 40px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Hiragino Sans", sans-serif'; ctx.fillStyle = 'rgba(43,39,48,.6)';
    ctx.fillText(d.subLabel || '', CARD.x + 10, 262 - (1 - a) * 30);
    ctx.globalAlpha = 1;
    if (P.mood) { var ms = 170 * pop(Math.min(1, Math.max(0, (t - 0.08) / 0.12))); if (ms > 0) ctx.drawImage(P.mood, CARD.x + CARD.w - 85 - ms / 2, 170 - ms / 2, ms, ms); }
    // the page card
    var ca = easeOut(Math.min(1, t / 0.15));
    ctx.save(); ctx.globalAlpha = ca;
    ctx.shadowColor = 'rgba(40,30,40,.16)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    rr(ctx, CARD.x, CARD.y + (1 - ca) * 40, CARD.w, CARD.h, 46); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    rr(ctx, CARD.x, CARD.y + (1 - ca) * 40, CARD.w, CARD.h, 46); ctx.clip();
    ctx.drawImage(paper.canvas, CARD.x, CARD.y + (1 - ca) * 40);
    ctx.restore();
    // writing, typed in for the video
    ctx.save(); rr(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 46); ctx.clip();
    var pad = 70, x = CARD.x + pad, y = CARD.y + pad + 40, maxW = CARD.w - pad * 2;
    var tp = Math.min(1, Math.max(0, (t - 0.18) / 0.42));
    var fs = 50; ctx.font = fs + 'px ' + P.family; ctx.fillStyle = '#2B2730';
    var lines = wrap(ctx, (d.text || '').trim(), maxW), photoH = P.photos.length ? 300 : 0;
    var limit = CARD.y + CARD.h - pad - photoH - (d.lines && d.lines.length ? 60 : 0);
    var total = lines.join('').length, shown = Math.round(total * tp), used = 0;
    for (var i = 0; i < lines.length && y < limit; i++) {
      var ln = lines[i], left = shown - used; if (left <= 0) break;
      ctx.fillText(left < ln.length ? ln.slice(0, left) : ln, x, y); used += ln.length; y += fs * 1.62;
    }
    // a filled ready-made page, as tidy lines under the writing
    if (d.lines && d.lines.length && tp >= 1) {
      y += 10; ctx.font = '36px ' + P.family; ctx.fillStyle = 'rgba(43,39,48,.82)';
      for (var j = 0; j < d.lines.length && y < limit + 40; j++) {
        wrap(ctx, '· ' + d.lines[j], maxW).forEach(function (l) { if (y < limit + 40) { ctx.fillText(l, x, y); y += 52; } });
      }
    }
    // photos along the bottom of the card
    if (P.photos.length) {
      var pa = easeOut(Math.min(1, Math.max(0, (t - 0.55) / 0.12))), n = P.photos.length, gap = 24, pw = (CARD.w - pad * 2 - gap * (n - 1)) / n, ph = 260, py = CARD.y + CARD.h - pad - ph;
      ctx.globalAlpha = pa;
      P.photos.forEach(function (im, q) {
        var px0 = x + q * (pw + gap), s = Math.max(pw / im.width, ph / im.height), sw = pw / s, sh = ph / s;
        ctx.save(); rr(ctx, px0, py, pw, ph, 24); ctx.clip(); ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, px0, py, pw, ph); ctx.restore();
      });
      ctx.globalAlpha = 1;
    }
    // stickers and tape: the same places as on the phone (positions are in page widths), popping on one by one
    var n2 = P.stickers.length;
    P.stickers.forEach(function (o, idx) {
      var st = o.st, start = 0.6 + (n2 > 1 ? idx * (0.25 / n2) : 0), sc = pop(Math.min(1, Math.max(0, (t - start) / 0.08)));
      if (sc <= 0) return;
      var tape = st.k.charAt(0) === 't', size = st.s * CARD.w, cx = CARD.x + st.x * CARD.w, cy = CARD.y + st.y * CARD.w;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(st.r * Math.PI / 180); ctx.scale(sc, sc);
      ctx.shadowColor = 'rgba(60,40,50,.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      if (o.img) ctx.drawImage(o.img, -size / 2, tape ? -size / 8 : -size / 2, size, tape ? size / 4 : size);
      else if (o.emoji) { ctx.font = Math.round(size * 0.82) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.emoji, 0, 0); }
      ctx.restore();
    });
    ctx.restore();
    // a quiet mark at the bottom
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(43,39,48,.38)';
    ctx.font = '600 30px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.fillText(d.brand || 'PopPopMake', W / 2, H - 90); ctx.textAlign = 'left';
  }
  function paperCanvas(P) {
    var c = root.document.createElement('canvas'); c.width = CARD.w; c.height = CARD.h;
    return paintPaper(c.getContext('2d'), P.cls, 0, 0, CARD.w, CARD.h, CARD.w / 360).then(function (color) { return { canvas: c, color: color }; });
  }
  function canvas() { var c = root.document.createElement('canvas'); c.width = W; c.height = H; return c; }
  function toBlob(c, type, q) { return new Promise(function (res, rej) { c.toBlob(function (b) { if (b) res(b); else rej(new Error('image')); }, type || 'image/png', q); }); }

  function entryImage(d, env) {
    return prepareEntry(d, env).then(function (P) {
      return paperCanvas(P).then(function (paper) { var c = canvas(); drawEntry(c.getContext('2d'), P, paper, 1); return toBlob(c); });
    });
  }

  // ---------- the same page "being decorated", recorded as a short video ----------
  function videoType() {
    var R = root.MediaRecorder; if (!R || !R.isTypeSupported) return null;
    var list = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < list.length; i++) if (R.isTypeSupported(list[i])) return list[i];
    return null;
  }
  function entryVideo(d, env, opts) {
    opts = opts || {};
    var type = videoType(), c = canvas();
    if (!type || !c.captureStream) return Promise.reject({ code: 'novideo' });
    var dur = opts.seconds ? opts.seconds * 1000 : 7000;
    return prepareEntry(d, env).then(function (P) {
      return paperCanvas(P).then(function (paper) {
        return new Promise(function (res, rej) {
          var ctx = c.getContext('2d'), stream = c.captureStream(30), rec = new root.MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6000000 }), chunks = [];
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = function () { stream.getTracks().forEach(function (tr) { tr.stop(); }); res({ blob: new Blob(chunks, { type: type.split(';')[0] }), ext: /mp4/.test(type) ? 'mp4' : 'webm' }); };
          rec.onerror = function () { rej({ code: 'novideo' }); };
          var t0 = null;
          drawEntry(ctx, P, paper, 0);
          rec.start(250);
          function frame(now) {
            if (t0 === null) t0 = now;
            var tt = Math.min(1, (now - t0) / dur);
            drawEntry(ctx, P, paper, Math.min(1, tt / 0.86));          // the last moment holds the finished page
            if (opts.progress) opts.progress(tt);
            if (tt < 1) root.requestAnimationFrame(frame); else setTimeout(function () { rec.stop(); }, 120);
          }
          root.requestAnimationFrame(frame);
        });
      });
    });
  }

  // ---------- a month or a year of moods ----------
  var MOOD_COL = ['#7DB0EE', '#B79BF4', '#5ED1A5', '#FFCB3D', '#FF8AAB'];
  function poster(bg) {
    var c = canvas(), ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return { c: c, ctx: ctx };
  }
  var SANS = '-apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Hiragino Sans", sans-serif';
  // o: { title, sub, weekdays[7], first (0=Mon..6), days, moods: {day: 1..5}, stats: [[label, value]], counts[5], moodNames[5], brand, today }
  function monthPoster(o, env) {
    var faces = Promise.all([1, 2, 3, 4, 5].map(function (m) { return svgImg(env.ST.mood(m), 160); }));
    return faces.then(function (F) {
      var p = poster(['#FFF9F5', '#F3EEF8']), ctx = p.ctx;
      ctx.fillStyle = '#2B2730'; ctx.font = '800 88px ' + SANS; ctx.fillText(o.title, 90, 210);
      ctx.fillStyle = 'rgba(43,39,48,.55)'; ctx.font = '500 40px ' + SANS; ctx.fillText(o.sub || '', 94, 272);
      var rows = Math.ceil((o.first + o.days) / 7), gx = 70, gy = 350, cw = (W - gx * 2) / 7, ch = 128;
      rr(ctx, 50, gy - 40, W - 100, rows * ch + 110, 48); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.shadowColor = 'rgba(40,30,40,.08)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.textAlign = 'center'; ctx.font = '700 30px ' + SANS;
      o.weekdays.forEach(function (w, i) { ctx.fillStyle = i >= 5 ? 'rgba(220,90,120,.75)' : 'rgba(43,39,48,.45)'; ctx.fillText(w, gx + cw * i + cw / 2, gy + 20); });
      for (var dday = 1; dday <= o.days; dday++) {
        var idx = o.first + dday - 1, col = idx % 7, row = Math.floor(idx / 7), cx = gx + cw * col + cw / 2, cy = gy + 56 + row * ch + ch / 2;
        var m = o.moods[dday];
        if (m && F[m - 1]) ctx.drawImage(F[m - 1], cx - 46, cy - 56, 92, 92);
        else { ctx.beginPath(); ctx.arc(cx, cy - 10, 36, 0, Math.PI * 2); ctx.fillStyle = dday === o.today ? 'rgba(43,39,48,.10)' : 'rgba(43,39,48,.05)'; ctx.fill(); }
        ctx.fillStyle = 'rgba(43,39,48,.55)'; ctx.font = '600 24px ' + SANS; ctx.fillText(String(dday), cx, cy + 56);
      }
      // the month in moods: a bar per face
      var by = gy + rows * ch + 130, tot = o.counts.reduce(function (a, b) { return a + b; }, 0) || 1;
      ctx.textAlign = 'left';
      o.counts.forEach(function (n, i) {
        var y = by + i * 64;
        if (F[i]) ctx.drawImage(F[i], 90, y - 4, 56, 56);
        rr(ctx, 170, y + 12, 640, 30, 15); ctx.fillStyle = 'rgba(43,39,48,.07)'; ctx.fill();
        if (n) { rr(ctx, 170, y + 12, Math.max(30, 640 * n / tot), 30, 15); ctx.fillStyle = MOOD_COL[i]; ctx.fill(); }
        ctx.fillStyle = '#2B2730'; ctx.font = '700 32px ' + SANS; ctx.fillText(String(n), 840, y + 39);
        ctx.fillStyle = 'rgba(43,39,48,.5)'; ctx.font = '500 26px ' + SANS; ctx.fillText(o.moodNames[i] || '', 900, y + 38);
      });
      var sy = by + 5 * 64 + 50;
      (o.stats || []).forEach(function (s, i) {
        var x = 90 + i * 310;
        ctx.fillStyle = 'rgba(43,39,48,.5)'; ctx.font = '600 28px ' + SANS; ctx.fillText(s[0], x, sy);
        ctx.fillStyle = '#2B2730'; ctx.font = '800 54px ' + SANS; ctx.fillText(s[1], x, sy + 62);
      });
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(43,39,48,.35)'; ctx.font = '600 30px ' + SANS; ctx.fillText(o.brand || 'PopPopMake', W / 2, H - 80);
      return toBlob(p.c);
    });
  }
  // o: { title, sub, months[12] (short names), year, moods: {'MM-DD': 1..5}, legend[5], brand }
  function yearPoster(o) {
    var p = poster(['#FBF8FF', '#FFF6F2']), ctx = p.ctx;
    ctx.fillStyle = '#2B2730'; ctx.font = '800 88px ' + SANS; ctx.fillText(o.title, 90, 200);
    ctx.fillStyle = 'rgba(43,39,48,.55)'; ctx.font = '500 40px ' + SANS; ctx.fillText(o.sub || '', 94, 262);
    var gx = 150, gy = 360, cell = 24, gap = 4;
    ctx.textAlign = 'center'; ctx.font = '600 22px ' + SANS; ctx.fillStyle = 'rgba(43,39,48,.4)';
    for (var dd = 1; dd <= 31; dd += 5) ctx.fillText(String(dd), gx + (dd - 1) * (cell + gap) + cell / 2, gy - 18);
    ctx.textAlign = 'right';
    for (var mo = 0; mo < 12; mo++) {
      var y = gy + mo * 92;
      ctx.fillStyle = 'rgba(43,39,48,.55)'; ctx.font = '700 28px ' + SANS; ctx.fillText(o.months[mo], gx - 22, y + 50);
      var days = new Date(Date.UTC(o.year, mo + 1, 0)).getUTCDate();
      for (var d2 = 1; d2 <= 31; d2++) {
        if (d2 > days) continue;
        var key = (mo + 1 < 10 ? '0' : '') + (mo + 1) + '-' + (d2 < 10 ? '0' : '') + d2, m = o.moods[key];
        rr(ctx, gx + (d2 - 1) * (cell + gap), y + 22, cell, 40, 9);
        ctx.fillStyle = m ? MOOD_COL[m - 1] : 'rgba(43,39,48,.07)'; ctx.fill();
      }
    }
    ctx.textAlign = 'left';
    var ly = gy + 12 * 92 + 70;
    o.legend.forEach(function (name, i) {
      var x = 110 + (i % 3) * 300, y = ly + Math.floor(i / 3) * 70;
      rr(ctx, x, y, 40, 40, 10); ctx.fillStyle = MOOD_COL[i]; ctx.fill();
      ctx.fillStyle = '#2B2730'; ctx.font = '600 30px ' + SANS; ctx.fillText(name, x + 56, y + 31);
    });
    (o.stats || []).forEach(function (s, i) {
      var x = 110 + i * 310, y = ly + 200;
      ctx.fillStyle = 'rgba(43,39,48,.5)'; ctx.font = '600 28px ' + SANS; ctx.fillText(s[0], x, y);
      ctx.fillStyle = '#2B2730'; ctx.font = '800 54px ' + SANS; ctx.fillText(s[1], x, y + 62);
    });
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(43,39,48,.35)'; ctx.font = '600 30px ' + SANS; ctx.fillText(o.brand || 'PopPopMake', W / 2, H - 80);
    return toBlob(p.c);
  }

  root.VaultShare = { entryImage: entryImage, entryVideo: entryVideo, videoType: videoType, monthPoster: monthPoster, yearPoster: yearPoster, MOOD_COL: MOOD_COL, size: { w: W, h: H } };
})(typeof window !== 'undefined' ? window : globalThis);
