// Blog Photo Prep: drop a batch of photos, get them back ready to post — resized, lighter, renamed by keyword,
// location and camera details removed, sideways phone photos turned upright, optional watermark and covered faces —
// in one ZIP. Everything happens in the browser; nothing is uploaded. Settings are remembered on this device.
// Pure helpers first (testable without a page), then the screen.
(function (root) {
  'use strict';

  // ------------------------------------------------------------------------------------------- pure helpers
  // "Seoul café trip" → "Seoul-café-trip"; characters files can't have are dropped; Korean and other letters stay.
  function slug(s) {
    return String(s || '').normalize ? String(s || '').normalize('NFC').replace(/[\\/:*?"<>|#%&{}$!'`@+=~^\[\]]+/g, ' ').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60)
      : String(s || '').trim().replace(/\s+/g, '-');
  }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  // the new file name: keyword-01.jpg … or the original name with the new extension
  function newName(i, total, keyword, original, ext) {
    var k = slug(keyword);
    if (k) return k + '-' + pad(i + 1, Math.max(2, String(total).length)) + '.' + ext;
    var base = String(original || 'photo').replace(/\.[^.]+$/, '');
    return slug(base) + '.' + ext;
  }
  // fit inside maxW (never larger than the original)
  function fit(w, h, maxW) {
    if (!maxW || w <= maxW) return { w: w, h: h };
    return { w: maxW, h: Math.max(1, Math.round(h * maxW / w)) };
  }
  // names must not repeat inside one ZIP: "a.jpg", "a-2.jpg", "a-3.jpg"
  function unique(names) {
    var seen = {};
    return names.map(function (n) {
      var key = n.toLowerCase();
      if (!seen[key]) { seen[key] = 1; return n; }
      var base = n.replace(/\.[^.]+$/, ''), ext = n.slice(base.length), k = ++seen[key], out;
      do { out = base + '-' + k + ext; k++; } while (seen[out.toLowerCase()]);
      seen[out.toLowerCase()] = 1; return out;
    });
  }
  // What a JPEG says about itself: when it was taken, whether it carries a GPS location, how it is turned.
  function exif(buf) {
    var out = { taken: null, gps: false, orientation: 1 };
    var v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return out;
    var p = 2;
    while (p + 4 <= v.byteLength) {
      if (v.getUint8(p) !== 0xFF) break;
      var marker = v.getUint8(p + 1), len = v.getUint16(p + 2);
      if (marker === 0xE1 && p + 10 <= v.byteLength && v.getUint32(p + 4) === 0x45786966) {      // "Exif"
        var t = p + 10, le = v.getUint16(t) === 0x4949;
        var u16 = function (o) { return v.getUint16(t + o, le); }, u32 = function (o) { return v.getUint32(t + o, le); };
        var str = function (o, n) { var s = ''; for (var i = 0; i < n && t + o + i < v.byteLength; i++) { var c = v.getUint8(t + o + i); if (!c) break; s += String.fromCharCode(c); } return s; };
        var ifd = function (o, fn) { if (t + o + 2 > v.byteLength) return; var n = u16(o); for (var i = 0; i < n; i++) { var e = o + 2 + i * 12; if (t + e + 12 > v.byteLength) return; fn(u16(e), e); } };
        try {
          var exifAt = 0;
          ifd(u32(4), function (tag, e) {
            if (tag === 0x0112) out.orientation = u16(e + 8);
            else if (tag === 0x8769) exifAt = u32(e + 8);
            else if (tag === 0x8825) out.gps = u32(e + 8) > 0;
          });
          if (exifAt) ifd(exifAt, function (tag, e) {
            if (tag === 0x9003 || (tag === 0x0132 && !out.taken)) {
              var s = str(u32(e + 8), 19), m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
              if (m) out.taken = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6];
            }
          });
        } catch (err) { /* a broken header just means we know less */ }
        return out;
      }
      if (marker === 0xDA) break;                        // image data starts: no more headers
      p += 2 + len;
    }
    return out;
  }
  // order: 'added' (as dropped) or 'taken' (by the time in the photo, then by name)
  function order(items, how) {
    var list = items.slice();
    if (how === 'taken') list.sort(function (a, b) {
      var ta = a.taken || '', tb = b.taken || '';
      if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
      if (ta && !tb) return -1; if (!ta && tb) return 1;
      return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
    });
    return list;
  }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  var api = { slug: slug, newName: newName, fit: fit, unique: unique, exif: exif, order: order, size: size };
  root.PPMPhotoBatch = api;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------------------------------------- the screen
  var $ = function (id) { return document.getElementById(id); };
  var app = $('pb-app'); if (!app) return;
  var PREF = 'ppm-photo-batch';
  var DEF = { width: 1200, format: 'jpeg', quality: 82, keyword: '', order: 'taken', mark: '', markPos: 'br', faces: false, cap: false, capKB: 500 };
  function loadPrefs() { try { var p = JSON.parse(localStorage.getItem(PREF) || '{}'); var o = {}; for (var k in DEF) o[k] = p[k] !== undefined ? p[k] : DEF[k]; return o; } catch (e) { return JSON.parse(JSON.stringify(DEF)); } }
  function savePrefs() { try { var p = {}; for (var k in prefs) if (k !== 'keyword') p[k] = prefs[k]; localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* private window */ } }
  var prefs = loadPrefs();
  var items = [], results = [], busy = false, stopNow = false;

  var el = {
    drop: $('pb-drop'), input: $('pb-input'), list: $('pb-list'), status: $('pb-status'), go: $('pb-go'), zip: $('pb-zip'), share: $('pb-share'), stop: $('pb-stop'),
    width: $('pb-width'), format: $('pb-format'), quality: $('pb-quality'), qv: $('pb-quality-val'), keyword: $('pb-keyword'), order: $('pb-order'),
    mark: $('pb-mark'), markPos: $('pb-mark-pos'), faces: $('pb-faces'), cap: $('pb-cap'), capKB: $('pb-cap-kb'), clear: $('pb-clear'), sum: $('pb-summary'), preview: $('pb-name-preview')
  };
  // "Save to phone": the phone's own share sheet (Save N images to Photos, or straight into the Naver Blog / Instagram app).
  // Only shown where the browser can share photos; most computers can't, and there the ZIP is the way.
  var canShareFiles = (function () {
    try { return !!(root.navigator && navigator.canShare && navigator.share && root.File && navigator.canShare({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] })); } catch (e) { return false; }
  })();
  function outReady(on) {
    el.zip.disabled = !on;
    if (el.share) { el.share.hidden = !(on && canShareFiles); el.share.disabled = !on; }
  }
  function say(kind, text) { el.status.className = 'status show ' + kind; el.status.textContent = text; }
  function quiet() { el.status.className = 'status'; el.status.textContent = ''; }

  // settings ⇄ screen
  function showPrefs() {
    Array.prototype.forEach.call(el.width.querySelectorAll('button'), function (b) { b.classList.toggle('active', String(prefs.width) === b.getAttribute('data-w')); b.setAttribute('aria-pressed', String(prefs.width) === b.getAttribute('data-w') ? 'true' : 'false'); });
    el.format.value = prefs.format; el.quality.value = prefs.quality; el.qv.textContent = prefs.quality + '%';
    el.quality.disabled = prefs.format === 'png';
    el.order.value = prefs.order; el.mark.value = prefs.mark; el.markPos.value = prefs.markPos;
    el.faces.checked = !!prefs.faces; el.cap.checked = !!prefs.cap; el.capKB.value = prefs.capKB; el.capKB.disabled = !prefs.cap;
    namePreview();
  }
  function namePreview() {
    var ext = prefs.format === 'jpeg' ? 'jpg' : prefs.format;
    var n = Math.max(items.length, 3);
    el.preview.textContent = el.keyword.value.trim()
      ? 'Files will be named ' + newName(0, n, el.keyword.value, '', ext) + ', ' + newName(1, n, el.keyword.value, '', ext) + ', …'
      : 'Files keep their names (as .' + ext + '). Type a keyword to number them, e.g. seoul-cafe-01.' + ext;
  }
  el.width.addEventListener('click', function (e) { var b = e.target.closest('button[data-w]'); if (!b) return; prefs.width = +b.getAttribute('data-w'); savePrefs(); showPrefs(); stale(); });
  el.format.addEventListener('change', function () { prefs.format = el.format.value; savePrefs(); showPrefs(); stale(); });
  el.quality.addEventListener('input', function () { prefs.quality = +el.quality.value; el.qv.textContent = prefs.quality + '%'; savePrefs(); stale(); });
  el.keyword.addEventListener('input', function () { prefs.keyword = el.keyword.value; namePreview(); stale(); });
  el.order.addEventListener('change', function () { prefs.order = el.order.value; savePrefs(); drawList(); stale(); });
  el.mark.addEventListener('input', function () { prefs.mark = el.mark.value.slice(0, 40); savePrefs(); stale(); });
  el.markPos.addEventListener('change', function () { prefs.markPos = el.markPos.value; savePrefs(); stale(); });
  el.faces.addEventListener('change', function () { prefs.faces = el.faces.checked; savePrefs(); stale(); if (prefs.faces) detector().catch(function () {}); });
  el.cap.addEventListener('change', function () { prefs.cap = el.cap.checked; savePrefs(); showPrefs(); stale(); });
  el.capKB.addEventListener('input', function () { var v = Math.round(+el.capKB.value); if (v >= 50 && v <= 20000) { prefs.capKB = v; savePrefs(); stale(); } });

  // a change after processing: the results no longer match the settings
  function stale() { if (results.length && !busy) { outReady(false); say('info', 'Settings changed. Press “Prepare photos” again to apply them.'); } }

  // adding photos
  var ACCEPT = /^image\/|\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i;
  function add(files) {
    var list = Array.prototype.filter.call(files || [], function (f) { return ACCEPT.test(f.type) || ACCEPT.test(f.name); });
    var skipped = (files ? files.length : 0) - list.length;
    if (items.length + list.length > 300) { list = list.slice(0, Math.max(0, 300 - items.length)); say('error', 'Up to 300 photos at a time. The first ' + (items.length + list.length) + ' were added.'); }
    if (!list.length) { if (skipped) say('error', 'Those files aren’t photos. Add JPG, PNG, WebP or iPhone (HEIC) photos.'); return; }
    Promise.all(list.map(function (f) {
      return f.slice(0, 256 * 1024).arrayBuffer().then(function (b) { var x = exif(b); return { file: f, name: f.name, size: f.size, taken: x.taken, gps: x.gps, id: Math.random().toString(36).slice(2) }; })
        .catch(function () { return { file: f, name: f.name, size: f.size, taken: null, gps: false, id: Math.random().toString(36).slice(2) }; });
    })).then(function (got) {
      items = items.concat(got); results = [];
      el.go.disabled = false; outReady(false); el.clear.hidden = false;
      drawList(); namePreview();
      say('info', items.length + ' photo' + (items.length > 1 ? 's' : '') + ' ready' + (skipped ? ' (' + skipped + ' file' + (skipped > 1 ? 's' : '') + ' skipped: not photos)' : '') + '. Check the settings, then press “Prepare photos”.');
    });
  }
  el.input.addEventListener('change', function () { add(el.input.files); el.input.value = ''; });
  el.drop.addEventListener('dragover', function (e) { e.preventDefault(); el.drop.classList.add('dragover'); });
  el.drop.addEventListener('dragleave', function () { el.drop.classList.remove('dragover'); });
  el.drop.addEventListener('drop', function (e) { e.preventDefault(); el.drop.classList.remove('dragover'); add(e.dataTransfer && e.dataTransfer.files); });
  el.drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.input.click(); } });
  document.addEventListener('paste', function (e) { var f = e.clipboardData && e.clipboardData.files; if (f && f.length && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) add(f); });
  el.clear.addEventListener('click', function () { if (busy) return; items = []; results = []; drawList(); el.go.disabled = true; outReady(false); el.clear.hidden = true; el.sum.hidden = true; quiet(); });

  function drawList() {
    el.list.textContent = '';
    var shown = order(items, prefs.order);
    shown.forEach(function (it, i) {
      var r = results.find && results.find(function (x) { return x.id === it.id; });
      var li = document.createElement('li'); li.className = 'pb-item' + (r && r.error ? ' bad' : r ? ' ok' : ''); li.setAttribute('data-id', it.id);
      var name = document.createElement('span'); name.className = 'pb-name'; name.textContent = r && r.name ? r.name : it.name;
      var info = document.createElement('span'); info.className = 'pb-info';
      info.textContent = r && r.error ? r.error : r ? size(it.size) + ' → ' + size(r.blob.size) + ' · ' + r.w + '×' + r.h + (it.gps ? ' · location removed' : '') + (r.faces ? ' · ' + r.faces + ' face' + (r.faces > 1 ? 's' : '') + ' covered' : '')
        : size(it.size) + (it.gps ? ' · has a location' : '') + (it.taken ? ' · ' + it.taken.slice(0, 10) : '');
      li.appendChild(name); li.appendChild(info);
      if (r && r.blob) {
        var a = document.createElement('a'); a.className = 'pb-dl'; a.textContent = 'Download'; a.download = r.name; a.href = r.url; li.appendChild(a);
      } else if (!busy) {
        var x = document.createElement('button'); x.type = 'button'; x.className = 'pb-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove ' + it.name);
        x.addEventListener('click', function () { items = items.filter(function (y) { return y.id !== it.id; }); drawList(); namePreview(); if (!items.length) { el.go.disabled = true; el.clear.hidden = true; quiet(); } });
        li.appendChild(x);
      }
      el.list.appendChild(li);
    });
  }

  // decoding: the browser itself (turning sideways phone photos upright); iPhone HEIC through the converter's decoder
  function decode(it) {
    var f = it.file;
    var heic = /\.(heic|heif)$/i.test(f.name) || /hei[cf]/i.test(f.type);
    var viaBrowser = function (blob) { return root.createImageBitmap(blob, { imageOrientation: 'from-image' }); };
    if (!heic) return viaBrowser(f);
    return viaBrowser(f).catch(function () {
      var C = root.PPMConvert; if (!C) throw new Error('This browser can’t open iPhone (HEIC) photos.');
      return C.sniff(f).then(function (info) { return C.convertFile(f, info, 'png', {}); }).then(function (r) { return viaBrowser(r.outputs[0].blob); });
    });
  }
  // faces (optional): the same detector as Face Mosaic, downloaded once and kept by the browser
  var FM_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/';
  var FM_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
  var detP = null;
  function detector() {
    if (!detP) detP = import(FM_LIB + 'vision_bundle.mjs').then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(FM_LIB + 'wasm').then(function (vision) {
        return mp.FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: FM_MODEL }, runningMode: 'IMAGE' });
      });
    }).catch(function (e) { detP = null; throw e; });
    return detP;
  }
  function pixelate(ctx, x, y, w, h) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y)); w = Math.min(ctx.canvas.width - x, Math.round(w)); h = Math.min(ctx.canvas.height - y, Math.round(h));
    if (w < 2 || h < 2) return;
    var block = Math.max(6, Math.round(Math.max(w, h) / 10)), img = ctx.getImageData(x, y, w, h), d = img.data;
    for (var by = 0; by < h; by += block) for (var bx = 0; bx < w; bx += block) {
      var r = 0, g = 0, b = 0, n = 0, bw = Math.min(block, w - bx), bh = Math.min(block, h - by);
      for (var yy = 0; yy < bh; yy++) for (var xx = 0; xx < bw; xx++) { var o = ((by + yy) * w + bx + xx) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; n++; }
      r /= n; g /= n; b /= n;
      for (yy = 0; yy < bh; yy++) for (xx = 0; xx < bw; xx++) { o = ((by + yy) * w + bx + xx) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; }
    }
    ctx.putImageData(img, x, y);
  }
  function watermark(ctx, text, pos) {
    if (!text) return;
    var W = ctx.canvas.width, H = ctx.canvas.height, fs = Math.max(12, Math.round(Math.min(W, H) * 0.035)), m = Math.round(fs * 0.8);
    ctx.save(); ctx.font = '600 ' + fs + 'px Inter, system-ui, sans-serif'; ctx.textBaseline = 'bottom';
    var tw = ctx.measureText(text).width, x = pos === 'bl' ? m : pos === 'c' ? (W - tw) / 2 : W - tw - m, y = pos === 'c' ? (H + fs) / 2 : H - m;
    ctx.globalAlpha = 0.75; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = Math.max(2, fs / 5); ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y); ctx.restore();
  }
  function encode(canvas, type, q) { return new Promise(function (res, rej) { canvas.toBlob(function (b) { b ? res(b) : rej(new Error('This photo is too large for the browser to save.')); }, type, q); }); }

  async function one(it, i, total, faceDet) {
    var bmp = await decode(it), dims = fit(bmp.width, bmp.height, prefs.width || 0);
    var c = document.createElement('canvas'); c.width = dims.w; c.height = dims.h;
    var ctx = c.getContext('2d');
    if (prefs.format === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }   // see-through PNG corners turn white, not black
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, dims.w, dims.h);
    if (bmp.close) bmp.close();
    var faces = 0;
    if (faceDet) {
      try {
        var found = faceDet.detect(c).detections || [];
        found.forEach(function (f) { var b = f.boundingBox; pixelate(ctx, b.originX - b.width * 0.15, b.originY - b.height * 0.25, b.width * 1.3, b.height * 1.45); });
        faces = found.length;
      } catch (e) { /* no faces covered on this one */ }
    }
    watermark(ctx, prefs.mark, prefs.markPos);
    var type = prefs.format === 'png' ? 'image/png' : prefs.format === 'webp' ? 'image/webp' : 'image/jpeg';
    var q = prefs.quality / 100, blob = await encode(c, type, q);
    // "keep each under N KB": lower the quality step by step, then the size, until it fits
    if (prefs.cap && type !== 'image/png') {
      var cap = prefs.capKB * 1024, tries = 0;
      while (blob.size > cap && tries < 12) {
        tries++;
        if (q > 0.45) q = Math.max(0.45, q - 0.08);
        else { var nw = Math.round(c.width * 0.85), nh = Math.round(c.height * 0.85), c2 = document.createElement('canvas'); c2.width = nw; c2.height = nh; var x2 = c2.getContext('2d'); x2.imageSmoothingQuality = 'high'; x2.drawImage(c, 0, 0, nw, nh); c = c2; }
        blob = await encode(c, type, q);
      }
    }
    var ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    return { id: it.id, blob: blob, w: c.width, h: c.height, faces: faces, ext: ext, url: URL.createObjectURL(blob) };
  }

  el.go.addEventListener('click', async function () {
    if (busy || !items.length) return;
    busy = true; stopNow = false; results.forEach(function (r) { if (r.url) URL.revokeObjectURL(r.url); }); results = [];
    el.go.disabled = true; outReady(false); el.stop.hidden = false; el.clear.hidden = true; el.sum.hidden = true;
    var list = order(items, prefs.order), faceDet = null;
    if (prefs.faces) {
      say('info', 'Getting face detection ready (downloaded once, then kept on this device)…');
      try { faceDet = await detector(); } catch (e) { say('error', 'Face detection couldn’t load (it needs the internet the first time). The photos are prepared without covering faces.'); await new Promise(function (r) { setTimeout(r, 1200); }); }
    }
    var kw = el.keyword.value, made = [];
    for (var i = 0; i < list.length && !stopNow; i++) {
      say('info', 'Preparing ' + (i + 1) + ' of ' + list.length + '…');
      try { made.push(await one(list[i], i, list.length, faceDet)); }
      catch (e) { made.push({ id: list[i].id, error: (e && e.message && e.message.length < 120 ? e.message : 'This file couldn’t be opened.') }); }
    }
    var good = made.filter(function (r) { return r.blob; });
    var names = unique(good.map(function (r, k) { var it = items.find(function (x) { return x.id === r.id; }); return newName(k, good.length, kw, it.name, r.ext); }));
    good.forEach(function (r, k) { r.name = names[k]; });
    results = made; busy = false; el.stop.hidden = true; el.go.disabled = false; el.clear.hidden = false;
    el.go.textContent = 'Prepare again';
    drawList();
    var before = good.reduce(function (a, r) { return a + items.find(function (x) { return x.id === r.id; }).size; }, 0), after = good.reduce(function (a, r) { return a + r.blob.size; }, 0);
    var bad = made.length - good.length, left = list.length - made.length;
    if (!good.length) { say('error', 'None of the photos could be prepared. Try JPG or PNG files.'); return; }
    outReady(true);
    el.sum.hidden = false;
    el.sum.textContent = good.length + ' photo' + (good.length > 1 ? 's' : '') + ': ' + size(before) + ' → ' + size(after) + (before > after ? ' (' + Math.round((1 - after / before) * 100) + '% lighter)' : '') + '.';
    say('success', (stopNow && left ? 'Stopped. ' : '') + 'Ready. Download them one by one, or all at once as a ZIP.' + (bad ? ' ' + bad + ' file' + (bad > 1 ? 's' : '') + ' couldn’t be opened (marked in red).' : ''));
  });
  el.stop.addEventListener('click', function () { stopNow = true; });
  el.zip.addEventListener('click', async function () {
    var good = results.filter(function (r) { return r.blob; }); if (!good.length || !root.PPMConvert) return;
    var zip = await root.PPMConvert.makeZip(good.map(function (r) { return { name: r.name, blob: r.blob }; }));
    var a = document.createElement('a'), k = slug(el.keyword.value);
    a.href = URL.createObjectURL(zip); a.download = (k || 'blog-photos') + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
  });
  if (el.share) el.share.addEventListener('click', function () {
    var good = results.filter(function (r) { return r.blob; }); if (!good.length) return;
    var files = good.map(function (r) { return new File([r.blob], r.name, { type: r.blob.type }); });
    var tooMany = 'The phone couldn’t take all ' + files.length + ' photos at once. Use “Download all (ZIP)”, or “Download” next to each photo.';
    try { if (!navigator.canShare({ files: files })) { say('error', tooMany); return; } } catch (e) { say('error', tooMany); return; }
    navigator.share({ files: files }).catch(function (e) { if (e && e.name === 'AbortError') return; say('error', tooMany); });
  });
  showPrefs();
})(typeof window !== 'undefined' ? window : this);
