/* PopPopMake — Convert Files
   Drop one file or many, pick the format you want, download. It all runs in the visitor's own browser; nothing is uploaded.

   What it converts
     image  (HEIC, JPG, PNG, WebP, GIF, BMP, AVIF, ICO; TIFF where the browser can open it)
            -> JPG, PNG, WebP, PDF, BMP, TIFF, ICO
     PDF    -> JPG, PNG, WebP (one picture per page), plain text, Word (text only)
   How
     pictures    the browser's own decoder + canvas (no library); HEIC uses libheif (/libheif-bundle.js, loaded only when needed,
                 run in a Web Worker so the page stays responsive)
     PDF pages   PDF.js (already loaded by the tool pages)       PDF out   pdf-lib (same)
     BMP / TIFF / ICO / ZIP / DOCX are written by the small encoders in this file.

   Page usage:   <div data-ppmc></div> + <script src="/file-converter.js" defer></script>   (mounts itself)
   Also exposes  window.PPMConvert = { mount, sniff, targetsFor, makeZip, buildDocx, ... } so the engine can be tested and reused. */
(function (root) {
  'use strict';
  if (root.PPMConvert) return;
  var document = root.document;

  var CFG = Object.assign({
    pdfLibUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    pdfJsUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfAssetsBase: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/',
    heicLibPath: '/libheif-bundle.js',
    maxPixels: 150e6,          // a picture bigger than this is refused up front (it would not fit in memory anyway)
    maxPagePixels: 36e6,       // a PDF page that would render larger than this is scaled down to fit
    thumbSize: 96
  }, root.PPM_CONVERT_CONFIG || {});

  /* ------------------------------------------------------------------ formats */
  var FORMATS = {
    jpg:  { label: 'JPG',          ext: 'jpg',  mime: 'image/jpeg' },
    png:  { label: 'PNG',          ext: 'png',  mime: 'image/png' },
    webp: { label: 'WebP',         ext: 'webp', mime: 'image/webp' },
    pdf:  { label: 'PDF',          ext: 'pdf',  mime: 'application/pdf' },
    bmp:  { label: 'BMP',          ext: 'bmp',  mime: 'image/bmp' },
    tiff: { label: 'TIFF',         ext: 'tiff', mime: 'image/tiff' },
    ico:  { label: 'ICO',          ext: 'ico',  mime: 'image/x-icon' },
    txt:  { label: 'Text (.txt)',  ext: 'txt',  mime: 'text/plain' },
    docx: { label: 'Word (.docx)', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  };
  var SOURCE_LABEL = { jpg: 'JPG', png: 'PNG', webp: 'WebP', gif: 'GIF', bmp: 'BMP', avif: 'AVIF', ico: 'ICO', heic: 'HEIC', tiff: 'TIFF', pdf: 'PDF' };
  var IMAGE_TARGETS = ['jpg', 'png', 'webp', 'pdf', 'bmp', 'tiff', 'ico'];
  var PDF_TARGETS = ['jpg', 'png', 'webp', 'txt', 'docx'];
  var RASTER_TARGETS = { jpg: 1, png: 1, webp: 1, bmp: 1, tiff: 1, ico: 1 };
  var LOSSLESS_SOURCES = { png: 1, gif: 1, bmp: 1, ico: 1 };   // for PDF output these stay lossless (PNG); photos become JPEG
  var ACCEPT = 'image/*,.heic,.heif,.avif,.jfif,application/pdf,.pdf';

  // File types we recognise but cannot convert, named so the message can say what it is.
  var UNSUPPORTED_LABEL = {
    docx: 'Word document', doc: 'Word document', odt: 'document', rtf: 'document', hwp: 'HWP document', pages: 'Pages document',
    xlsx: 'Excel spreadsheet', xls: 'Excel spreadsheet', csv: 'CSV file', ods: 'spreadsheet', numbers: 'Numbers spreadsheet',
    pptx: 'PowerPoint presentation', ppt: 'PowerPoint presentation', odp: 'presentation', key: 'Keynote presentation',
    txt: 'text file', md: 'text file', json: 'JSON file', html: 'web page', htm: 'web page', epub: 'ebook',
    svg: 'SVG image', psd: 'Photoshop file', ai: 'Illustrator file', eps: 'EPS file',
    cr2: 'camera RAW photo', nef: 'camera RAW photo', arw: 'camera RAW photo', dng: 'camera RAW photo',
    zip: 'ZIP archive', rar: 'archive', '7z': 'archive',
    mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video', m4v: 'video',
    mp3: 'audio file', wav: 'audio file', m4a: 'audio file', flac: 'audio file', ogg: 'audio file', aac: 'audio file'
  };

  /* ------------------------------------------------------------------ small helpers */
  function friendly(message) { var e = new Error(message); e.friendly = true; return e; }
  var CANCELLED = new Error('cancelled'); CANCELLED.cancelled = true;

  function Ctl() { this.cancelled = false; this.hooks = []; }
  Ctl.prototype.cancel = function () {
    this.cancelled = true;
    var hs = this.hooks.splice(0);
    for (var i = 0; i < hs.length; i++) { try { hs[i](); } catch (e) { /* ignore */ } }
  };
  Ctl.prototype.check = function () { if (this.cancelled) throw CANCELLED; };
  Ctl.prototype.onCancel = function (fn) { this.hooks.push(fn); };

  function readBuffer(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var r = new root.FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error || new Error('Could not read the file')); };
      r.readAsArrayBuffer(blob);
    });
  }
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  function splitName(name) {
    name = String(name || '').replace(/^.*[\\/]/, '');
    var i = name.lastIndexOf('.'), base = name, ext = '';
    if (i > 0 && i < name.length - 1) { base = name.slice(0, i); ext = name.slice(i + 1).toLowerCase(); }
    base = base.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 100);
    return { base: base || 'file', ext: ext };
  }
  function zeroPad(n, width) { var s = String(n); while (s.length < width) s = '0' + s; return s; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function newCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function release(c) { if (c) { c.width = 0; c.height = 0; } }
  function toBlobP(canvas, type, quality) {
    return new Promise(function (resolve) {
      try { canvas.toBlob(function (b) { resolve(b); }, type, quality); } catch (e) { resolve(null); }
    });
  }
  function sizeLabel(w, h) { return w + '×' + h + ' px'; }

  var scriptLoads = {};
  function loadScript(src) {
    if (scriptLoads[src]) return scriptLoads[src];
    scriptLoads[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { delete scriptLoads[src]; reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
    return scriptLoads[src];
  }
  async function needPdfLib() {
    if (!root.PDFLib) {
      try { await loadScript(CFG.pdfLibUrl); } catch (e) { throw friendly('The PDF library could not be loaded. Check your internet connection and reload the page.'); }
    }
    if (!root.PDFLib) throw friendly('The PDF library could not be loaded. Check your internet connection and reload the page.');
    return root.PDFLib;
  }
  async function needPdfJs() {
    if (!root.pdfjsLib) {
      try { await loadScript(CFG.pdfJsUrl); } catch (e) { throw friendly('The PDF reader could not be loaded. Check your internet connection and reload the page.'); }
    }
    var lib = root.pdfjsLib;
    if (!lib) throw friendly('The PDF reader could not be loaded. Check your internet connection and reload the page.');
    if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = CFG.pdfAssetsBase + 'pdf.worker.min.js';
    return lib;
  }

  /* ------------------------------------------------------------------ recognising a file */
  // Looks at the first bytes, not just the name, so a photo called "scan.pdf" or a PNG saved as ".jpg" is treated as what it is.
  async function sniff(file) {
    var head = new Uint8Array(await readBuffer(file.slice(0, 96)));
    var parts = splitName(file.name), ext = parts.ext, mime = String(file.type || '').toLowerCase();
    function str(a, b) { var s = ''; for (var i = a; i < b && i < head.length; i++) s += String.fromCharCode(head[i]); return s; }
    function image(fmt) { return { kind: 'image', fmt: fmt, label: SOURCE_LABEL[fmt] }; }

    if (str(0, 5) === '%PDF-') return { kind: 'pdf', fmt: 'pdf', label: 'PDF' };
    if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) return image('jpg');
    if (head[0] === 0x89 && str(1, 4) === 'PNG') return image('png');
    if (str(0, 4) === 'GIF8') return image('gif');
    if (str(0, 4) === 'RIFF' && str(8, 12) === 'WEBP') return image('webp');
    if ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2A && head[3] === 0) ||
        (head[0] === 0x4D && head[1] === 0x4D && head[2] === 0 && head[3] === 0x2A)) return image('tiff');
    if (str(4, 8) === 'ftyp') {
      var major = str(8, 12), brands = [major];
      for (var p = 16; p + 4 <= head.length; p += 4) brands.push(str(p, p + 4));
      var HEIC = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'heif'];
      var hasHeic = brands.some(function (b) { return HEIC.indexOf(b) >= 0; });
      var hasAvif = brands.some(function (b) { return b === 'avif' || b === 'avis'; });
      if (major === 'avif' || major === 'avis') return image('avif');
      if (hasHeic) return image('heic');
      if (hasAvif) return image('avif');
      if (major === 'mif1' || major === 'msf1') return image('heic');      // a plain HEIF container
      return { kind: 'unsupported', fmt: ext, label: UNSUPPORTED_LABEL[ext] || 'video or audio file' };
    }
    if (head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0 && (ext === 'ico' || /icon/.test(mime))) return image('ico');
    if (head[0] === 0x42 && head[1] === 0x4D) {
      var dib = head.length >= 18 ? (head[14] | (head[15] << 8) | (head[16] << 16) | (head[17] << 24)) >>> 0 : 0;
      if (ext === 'bmp' || ext === 'dib' || mime === 'image/bmp' || [12, 40, 52, 56, 64, 108, 124].indexOf(dib) >= 0) return image('bmp');
    }
    // Not a picture or PDF we can read. A ZIP-based Office file is named by its extension.
    if (UNSUPPORTED_LABEL[ext]) return { kind: 'unsupported', fmt: ext, label: UNSUPPORTED_LABEL[ext] };
    if (head[0] === 0x50 && head[1] === 0x4B) return { kind: 'unsupported', fmt: ext, label: 'ZIP-based file' };
    if (/^image\//.test(mime) && ext === 'svg') return { kind: 'unsupported', fmt: 'svg', label: 'SVG image' };
    // Name says PDF or picture but the content does not match: let the real decoder judge (it may still open it).
    if (ext === 'pdf' || mime === 'application/pdf') return { kind: 'pdf', fmt: 'pdf', label: 'PDF' };
    var byExt = { jpg: 'jpg', jpeg: 'jpg', jfif: 'jpg', png: 'png', webp: 'webp', gif: 'gif', bmp: 'bmp', avif: 'avif', ico: 'ico', heic: 'heic', heif: 'heic', tif: 'tiff', tiff: 'tiff' };
    if (byExt[ext]) return image(byExt[ext]);
    return { kind: 'unsupported', fmt: ext, label: ext ? ext.toUpperCase() + ' file' : 'file' };
  }

  function targetsFor(info) {
    if (!info) return [];
    if (info.kind === 'pdf') return PDF_TARGETS.slice();
    if (info.kind === 'image') return IMAGE_TARGETS.filter(function (t) { return t !== info.fmt; });
    return [];
  }
  function canConvert(info, target) { return targetsFor(info).indexOf(target) >= 0; }

  /* ------------------------------------------------------------------ reading pictures */
  function decodeFail(info) {
    var label = info && info.label ? info.label : 'image';
    if (info && info.fmt === 'tiff') return friendly('This browser can’t open TIFF files, so this one couldn’t be converted.');
    if (info && info.fmt === 'avif') return friendly('This browser can’t open AVIF images. Update your browser, or try Chrome, Firefox or Safari 16 or newer.');
    return friendly('This file couldn’t be opened as ' + (/^[AEIOU]/.test(label) ? 'an ' : 'a ') + label + ' image. It may be damaged, or not really ' + (/^[AEIOU]/.test(label) ? 'an ' : 'a ') + label + '.');
  }
  function loadImageEl(blob) {
    return new Promise(function (resolve, reject) {
      var url = root.URL.createObjectURL(blob), img = new root.Image();
      img.onload = function () { resolve(img); setTimeout(function () { root.URL.revokeObjectURL(url); }, 0); };
      img.onerror = function () { root.URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function drawToCanvas(src, w, h) {
    if (w * h > CFG.maxPixels) throw friendly('This picture is too large (' + Math.round(w * h / 1e6) + ' megapixels) to convert in a browser.');
    var c = newCanvas(w, h), ctx = c.getContext('2d');
    if (!ctx) { release(c); throw friendly('Your browser ran out of memory for a picture this large. Try a smaller one.'); }
    ctx.drawImage(src, 0, 0, w, h);
    return { canvas: c, width: w, height: h };
  }
  async function decodeNative(file, info) {
    var img;
    try { img = await loadImageEl(file); } catch (e) { throw decodeFail(info); }
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw decodeFail(info);
    return drawToCanvas(img, w, h);
  }

  // HEIC: Safari opens it itself; elsewhere libheif (WebAssembly) does the work, inside a Web Worker.
  var HEIC_WORKER_SRC = [
    'var lib = null;',
    'self.onmessage = function (e) {',
    '  var d = e.data;',
    '  try {',
    '    if (!lib) { importScripts(d.libUrl); lib = self.libheif(); }',
    '    var imgs = new lib.HeifDecoder().decode(new Uint8Array(d.buffer));',
    '    if (!imgs || !imgs.length) { self.postMessage({ id: d.id, error: "nothing" }); return; }',
    '    var im = imgs[0], w = im.get_width(), h = im.get_height();',
    '    var data = new Uint8ClampedArray(w * h * 4);',
    '    im.display({ data: data, width: w, height: h }, function (out) {',
    '      if (!out) { self.postMessage({ id: d.id, error: "display" }); return; }',
    '      self.postMessage({ id: d.id, width: w, height: h, buffer: data.buffer }, [data.buffer]);',
    '    });',
    '  } catch (err) { self.postMessage({ id: d.id, error: String((err && err.message) || err) }); }',
    '};'
  ].join('\n');
  var heicWorker = null, heicSeq = 0;
  function killHeicWorker() { if (heicWorker) { try { heicWorker.terminate(); } catch (e) { /* ignore */ } heicWorker = null; } }
  function getHeicWorker() {
    if (!heicWorker) heicWorker = new root.Worker(root.URL.createObjectURL(new root.Blob([HEIC_WORKER_SRC], { type: 'application/javascript' })));
    return heicWorker;
  }
  async function decodeHeic(file, ctl, report) {
    try { return await decodeNative(file, { fmt: 'heic', label: 'HEIC' }); } catch (e) { /* this browser cannot: use libheif */ }
    ctl.check();
    if (report) report('Decoding HEIC… (the first time this loads a small decoder)');
    var buffer = await readBuffer(file);
    ctl.check();
    var worker;
    try { worker = getHeicWorker(); } catch (e) { throw friendly('Your browser blocked the HEIC decoder, so this file couldn’t be opened.'); }
    var libUrl = new root.URL(CFG.heicLibPath, root.location.href).href, id = ++heicSeq;
    var reply = await new Promise(function (resolve, reject) {
      function done() { worker.removeEventListener('message', onMsg); worker.removeEventListener('error', onErr); }
      function onMsg(ev) { if (ev.data && ev.data.id === id) { done(); resolve(ev.data); } }
      function onErr() { done(); killHeicWorker(); reject(friendly('The HEIC decoder could not be loaded. Check your internet connection and try again.')); }
      worker.addEventListener('message', onMsg);
      worker.addEventListener('error', onErr);
      ctl.onCancel(function () { done(); killHeicWorker(); reject(CANCELLED); });
      worker.postMessage({ id: id, buffer: buffer, libUrl: libUrl }, [buffer]);
    });
    ctl.check();
    if (reply.error) throw friendly('This HEIC photo couldn’t be read. It may be damaged, or saved in a variant this converter can’t decode.');
    if (reply.width * reply.height > CFG.maxPixels) throw friendly('This photo is too large (' + Math.round(reply.width * reply.height / 1e6) + ' megapixels) to convert in a browser.');
    var c = newCanvas(reply.width, reply.height), ctx = c.getContext('2d');
    if (!ctx) { release(c); throw friendly('Your browser ran out of memory for a photo this large. Try a smaller one.'); }
    ctx.putImageData(new root.ImageData(new Uint8ClampedArray(reply.buffer), reply.width, reply.height), 0, 0);
    return { canvas: c, width: reply.width, height: reply.height };
  }
  function decodeImage(file, info, ctl, report) {
    if (info.fmt === 'heic') return decodeHeic(file, ctl, report);
    return decodeNative(file, info);
  }

  function makeThumb(canvas) {
    try {
      var k = CFG.thumbSize / Math.max(canvas.width, canvas.height);
      var c = newCanvas(Math.max(1, Math.round(canvas.width * k)), Math.max(1, Math.round(canvas.height * k)));
      var x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.imageSmoothingQuality = 'high';
      x.drawImage(canvas, 0, 0, c.width, c.height);
      var url = c.toDataURL('image/jpeg', 0.7);
      release(c);
      return url;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ writing pictures */
  function whiteBehind(canvas) {          // transparent areas become white (JPG and BMP cannot be see-through)
    var x = canvas.getContext('2d');
    x.save(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#fff'; x.fillRect(0, 0, canvas.width, canvas.height); x.restore();
  }
  function pixels(canvas) {
    try { return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; }
    catch (e) { throw friendly('Your browser ran out of memory for a picture this large. Try a smaller one.'); }
  }

  function encodeBmp(canvas) {            // 24-bit, bottom-up, see-through areas flattened onto white
    var w = canvas.width, h = canvas.height, rgba = pixels(canvas);
    var rowSize = Math.floor((24 * w + 31) / 32) * 4, imgSize = rowSize * h, total = 54 + imgSize;
    if (total > 0x7FFFFFFF) throw friendly('This picture is too large to save as BMP.');
    var buf = new Uint8Array(total), dv = new DataView(buf.buffer);
    buf[0] = 0x42; buf[1] = 0x4D;
    dv.setUint32(2, total, true); dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, imgSize, true);
    dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true);
    for (var y = 0; y < h; y++) {
      var s = (h - 1 - y) * w * 4, d = 54 + y * rowSize;
      for (var x = 0; x < w; x++, s += 4, d += 3) {
        var a = rgba[s + 3];
        if (a === 255) { buf[d] = rgba[s + 2]; buf[d + 1] = rgba[s + 1]; buf[d + 2] = rgba[s]; }
        else {
          var inv = 255 - a;
          buf[d] = (rgba[s + 2] * a + 255 * inv + 127) / 255 | 0;
          buf[d + 1] = (rgba[s + 1] * a + 255 * inv + 127) / 255 | 0;
          buf[d + 2] = (rgba[s] * a + 255 * inv + 127) / 255 | 0;
        }
      }
    }
    return new root.Blob([buf], { type: 'image/bmp' });
  }

  function encodeTiff(canvas) {           // baseline, uncompressed, 8-bit RGB (RGBA when the picture really has see-through pixels)
    var w = canvas.width, h = canvas.height, rgba = pixels(canvas), hasAlpha = false, i, n = w * h;
    for (i = 3; i < rgba.length; i += 4) { if (rgba[i] !== 255) { hasAlpha = true; break; } }
    var spp = hasAlpha ? 4 : 3, rowBytes = w * spp, rps = Math.max(1, Math.min(h, Math.floor(1048576 / rowBytes)));
    var strips = Math.ceil(h / rps), dataBytes = rowBytes * h;
    var entries = hasAlpha ? 13 : 12;
    var ifdSize = 2 + entries * 12 + 4, extra = 0;
    var bpsOff = 8 + ifdSize; extra += spp * 2;
    var offsOff = bpsOff + extra; if (strips > 1) extra += strips * 4;
    var cntOff = bpsOff + extra; if (strips > 1) extra += strips * 4;
    var resOff = bpsOff + extra; extra += 16;
    var dataOff = bpsOff + extra, total = dataOff + dataBytes;
    if (total > 0xFFFFFFFF) throw friendly('This picture is too large to save as TIFF.');
    var buf = new Uint8Array(total), dv = new DataView(buf.buffer);
    buf[0] = 0x49; buf[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, 8, true);
    var p = 8; dv.setUint16(p, entries, true); p += 2;
    function entry(tag, type, count, value) { dv.setUint16(p, tag, true); dv.setUint16(p + 2, type, true); dv.setUint32(p + 4, count, true); if (type === 3 && count === 1) dv.setUint16(p + 8, value, true); else dv.setUint32(p + 8, value, true); p += 12; }
    entry(256, 4, 1, w); entry(257, 4, 1, h);
    entry(258, 3, spp, bpsOff);
    entry(259, 3, 1, 1); entry(262, 3, 1, 2);
    entry(273, 4, strips, strips > 1 ? offsOff : dataOff);
    entry(277, 3, 1, spp); entry(278, 4, 1, rps);
    entry(279, 4, strips, strips > 1 ? cntOff : dataBytes);
    entry(282, 5, 1, resOff); entry(283, 5, 1, resOff + 8); entry(296, 3, 1, 2);
    if (hasAlpha) entry(338, 3, 1, 2);
    dv.setUint32(p, 0, true);
    for (i = 0; i < spp; i++) dv.setUint16(bpsOff + i * 2, 8, true);
    for (i = 0; i < strips; i++) {
      var rows = Math.min(rps, h - i * rps);
      if (strips > 1) { dv.setUint32(offsOff + i * 4, dataOff + i * rps * rowBytes, true); dv.setUint32(cntOff + i * 4, rows * rowBytes, true); }
    }
    dv.setUint32(resOff, 72, true); dv.setUint32(resOff + 4, 1, true); dv.setUint32(resOff + 8, 72, true); dv.setUint32(resOff + 12, 1, true);
    var d = dataOff, s = 0;
    if (hasAlpha) { buf.set(rgba, dataOff); }
    else { for (i = 0; i < n; i++, s += 4, d += 3) { buf[d] = rgba[s]; buf[d + 1] = rgba[s + 1]; buf[d + 2] = rgba[s + 2]; } }
    return new root.Blob([buf], { type: 'image/tiff' });
  }

  async function encodeIco(canvas) {      // several sizes in one file, each stored as PNG (what every current system reads)
    var longest = Math.max(canvas.width, canvas.height);
    var sizes = [16, 32, 48, 64, 128, 256].filter(function (s) { return s <= longest; });
    if (!sizes.length) sizes = [16];
    var pngs = [];
    for (var i = 0; i < sizes.length; i++) {
      var sz = sizes[i], c = newCanvas(sz, sz), x = c.getContext('2d');
      var k = Math.min(sz / canvas.width, sz / canvas.height), dw = Math.max(1, Math.round(canvas.width * k)), dh = Math.max(1, Math.round(canvas.height * k));
      x.imageSmoothingQuality = 'high';
      x.drawImage(canvas, Math.round((sz - dw) / 2), Math.round((sz - dh) / 2), dw, dh);
      var b = await toBlobP(c, 'image/png');
      release(c);
      if (!b) throw friendly('Your browser could not create this file.');
      pngs.push(new Uint8Array(await readBuffer(b)));
    }
    var head = new Uint8Array(6 + 16 * pngs.length), dv = new DataView(head.buffer), off = head.length;
    dv.setUint16(2, 1, true); dv.setUint16(4, pngs.length, true);
    for (var j = 0; j < pngs.length; j++) {
      var e = 6 + j * 16, s = sizes[j];
      head[e] = s >= 256 ? 0 : s; head[e + 1] = s >= 256 ? 0 : s;
      dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
      dv.setUint32(e + 8, pngs[j].length, true); dv.setUint32(e + 12, off, true);
      off += pngs[j].length;
    }
    return new root.Blob([head].concat(pngs), { type: 'image/x-icon' });
  }

  // Makes the file for one picture. The canvas may be changed (see-through areas filled) - it is not reused afterwards.
  async function encodeRaster(canvas, target, opts) {
    var q = opts && opts.quality != null ? opts.quality : 0.92, blob;
    if (target === 'jpg') {
      whiteBehind(canvas);
      blob = await toBlobP(canvas, 'image/jpeg', q);
    } else if (target === 'png') {
      blob = await toBlobP(canvas, 'image/png');
    } else if (target === 'webp') {
      blob = await toBlobP(canvas, 'image/webp', q);
      if (blob && blob.type !== 'image/webp') throw friendly('This browser can’t save WebP files. Choose JPG or PNG instead (they work everywhere).');
    } else if (target === 'bmp') {
      return encodeBmp(canvas);
    } else if (target === 'tiff') {
      return encodeTiff(canvas);
    } else if (target === 'ico') {
      return encodeIco(canvas);
    } else {
      throw new Error('Unknown format ' + target);
    }
    if (!blob) throw friendly('Your browser could not create this file. If the picture is very large, try a smaller one.');
    return blob;
  }

  /* ------------------------------------------------------------------ pictures -> PDF */
  var PAGE_PT = { a4: [595.28, 841.89], letter: [612, 792] };
  async function newPdfBuilder(opts) {
    var PDFLib = await needPdfLib();
    var pdf = await PDFLib.PDFDocument.create();
    pdf.setProducer('PopPopMake'); pdf.setCreator('PopPopMake');
    var sizeKey = (opts && opts.pageSize) || 'a4', count = 0;
    return {
      count: function () { return count; },
      add: async function (canvas, info) {
        var w = canvas.width, h = canvas.height, lossless = !!(info && LOSSLESS_SOURCES[info.fmt]) && w * h <= 12e6, img;
        if (lossless) {
          var pngBlob = await toBlobP(canvas, 'image/png');
          if (!pngBlob) throw friendly('Your browser could not create this file. If the picture is very large, try a smaller one.');
          img = await pdf.embedPng(new Uint8Array(await readBuffer(pngBlob)));
        } else {
          whiteBehind(canvas);
          var jpgBlob = await toBlobP(canvas, 'image/jpeg', 0.92);
          if (!jpgBlob) throw friendly('Your browser could not create this file. If the picture is very large, try a smaller one.');
          img = await pdf.embedJpg(new Uint8Array(await readBuffer(jpgBlob)));
        }
        var pw, ph, dw, dh;
        if (sizeKey === 'fit' || !PAGE_PT[sizeKey]) { pw = dw = w * 0.75; ph = dh = h * 0.75; }       // 96 pixels = 1 inch
        else {
          var paper = PAGE_PT[sizeKey], landscape = w > h;
          pw = landscape ? paper[1] : paper[0]; ph = landscape ? paper[0] : paper[1];
          var fit = Math.min(pw / w, ph / h); dw = w * fit; dh = h * fit;
        }
        var page = pdf.addPage([pw, ph]);
        page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
        count++;
      },
      save: async function () { return new root.Blob([await pdf.save()], { type: 'application/pdf' }); }
    };
  }

  /* ------------------------------------------------------------------ reading PDFs */
  // '1-3, 5' -> [[1,3],[5,5]]; '7-' -> [[7,Infinity]]; '' -> null (meaning every page). Only checks the wording.
  function parseRanges(text) {
    text = String(text || '').trim().replace(/\s*[-–—]\s*/g, '-');
    if (!text) return null;
    var out = [], toks = text.split(/[\s,;]+/);
    for (var t = 0; t < toks.length; t++) {
      var tok = toks[t]; if (!tok) continue;
      var m = tok.match(/^(\d+)(?:-(\d*))?$/);
      if (!m) throw friendly('“' + tok + '” isn’t a page number. Use numbers like 1-3, 5 or leave the box empty for all pages.');
      var a = parseInt(m[1], 10), b = m[2] === undefined ? a : (m[2] === '' ? Infinity : parseInt(m[2], 10));
      if (a < 1 || b < a) throw friendly('“' + tok + '” isn’t a valid page range.');
      out.push([a, b]);
    }
    return out.length ? out : null;
  }
  function parsePages(text, max) {
    var ranges = parseRanges(text), seen = {}, out = [], i, n;
    if (!ranges) { for (i = 1; i <= max; i++) out.push(i); return out; }
    for (i = 0; i < ranges.length; i++) {
      var a = ranges[i][0], b = Math.min(ranges[i][1], max);
      if (a > max) throw friendly('This PDF has only ' + max + ' page' + (max === 1 ? '' : 's') + ', so page ' + a + ' doesn’t exist.');
      for (n = a; n <= b; n++) { if (!seen[n]) { seen[n] = 1; out.push(n); } }
    }
    out.sort(function (x, y) { return x - y; });
    return out;
  }
  async function openPdf(file) {
    var lib = await needPdfJs();
    var bytes = new Uint8Array(await readBuffer(file));
    try {
      return await lib.getDocument({
        data: bytes,
        standardFontDataUrl: CFG.pdfAssetsBase + 'standard_fonts/',
        cMapUrl: CFG.pdfAssetsBase + 'cmaps/',
        cMapPacked: true,
        isEvalSupported: false,
        isOffscreenCanvasSupported: false
      }).promise;
    } catch (err) {
      if (err && err.name === 'PasswordException') throw friendly('This PDF is password-protected. Open it in a PDF viewer, use Print → Save as PDF to make an unprotected copy, then convert that copy.');
      if (err && err.name === 'InvalidPDFException') throw friendly('This file isn’t a valid PDF (it may be damaged).');
      if (err && err.name === 'MissingPDFException') throw friendly('This PDF couldn’t be read.');
      throw err;
    }
  }
  async function renderPdfPage(pdf, n, dpi) {
    var page = await pdf.getPage(n);
    try {
      var scale = dpi / 72, vp = page.getViewport({ scale: scale });
      var k = Math.min(1, Math.sqrt(CFG.maxPagePixels / (vp.width * vp.height)));
      if (k < 1) vp = page.getViewport({ scale: scale * k });
      var c = newCanvas(Math.max(1, Math.round(vp.width)), Math.max(1, Math.round(vp.height)));
      var x = c.getContext('2d');
      if (!x) { release(c); throw friendly('Your browser ran out of memory rendering this page. Try a lower resolution.'); }
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: x, viewport: vp }).promise;
      return c;
    } finally { try { page.cleanup(); } catch (e) { /* ignore */ } }
  }

  // Word and PDF writers draw list bullets with a symbol font; the text then carries a private-use character that shows as an empty box elsewhere.
  var SYMBOL_FONT = { '': '•', '': '▪', '': '➢', '': '✓', '': '→', '': '❖', '': '■' };
  // Text of one page as lines, in the order the PDF stores them. Positions are taken in the page as it is shown (y grows downward),
  // so pages stored sideways (/Rotate) still read left to right.
  function pageLines(items, vp) {
    var Util = root.pdfjsLib.Util, lines = [], cur = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (typeof it.str !== 'string') continue;
      var t = Util.transform(vp.transform, it.transform);
      var x = t[4], y = t[5], size = Math.hypot(t[2], t[3]) || it.height || 10, w = it.width || 0;
      if (cur && Math.abs(y - cur.y) <= Math.max(2, 0.5 * Math.min(size, cur.size))) {
        if (it.str && cur.text && x - cur.endX > 0.2 * size && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) cur.text += ' ';
        cur.text += it.str; cur.endX = Math.max(cur.endX, x + w); cur.x0 = Math.min(cur.x0, x); cur.size = Math.max(cur.size, size);
      } else {
        cur = { text: it.str, y: y, x0: x, endX: x + w, size: size };
        lines.push(cur);
      }
      if (it.hasEOL) cur = null;
    }
    lines.forEach(function (l) {
      l.text = l.text.replace(/[-]/g, function (c) { return SYMBOL_FONT[c] || ''; })       // list bullets drawn with a symbol font
        .replace(/ /g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+$/, '');
    });
    return lines.filter(function (l) { return l.text.trim() !== ''; });
  }
  function lineGaps(lines) {        // the usual distance between two lines (median), so a bigger gap can be told from normal spacing
    var gaps = [];
    for (var i = 1; i < lines.length; i++) { var g = lines[i].y - lines[i - 1].y; if (g > 0) gaps.push(g); }
    gaps.sort(function (a, b) { return a - b; });
    return gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  }
  var CJK_NO_SPACE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;
  // Word paragraphs: a line is glued to the next one only when it ran (nearly) to the right margin, i.e. it was wrapped,
  // and the next line follows closely. Short lines (headings, list items, addresses, table rows) stay on their own.
  function toParagraphs(lines, pageW) {
    if (!lines.length) return [];
    var minX = Infinity, i;
    for (i = 0; i < lines.length; i++) minX = Math.min(minX, lines[i].x0);
    var textW = Math.max(1, pageW - 2 * minX), med = lineGaps(lines), paras = [], cur = null;
    for (i = 0; i < lines.length; i++) {
      var ln = lines[i], prev = lines[i - 1], text = ln.text.trim(), joins = false;
      if (prev && cur !== null) {
        var gap = ln.y - prev.y;
        joins = (prev.endX - minX) >= 0.78 * textW && gap > 0 && (!med || gap <= med * 1.5) && Math.abs(ln.x0 - prev.x0) <= 4 * Math.max(prev.size, 8);
      }
      if (!joins) { cur = text; paras.push(cur); }
      else {
        var sep = (/-$/.test(cur) || (CJK_NO_SPACE.test(cur.slice(-1)) && CJK_NO_SPACE.test(text.charAt(0)))) ? '' : ' ';
        cur += sep + text; paras[paras.length - 1] = cur;
      }
    }
    return paras;
  }
  function linesToText(lines) {     // the text as it was laid out: one line per line, an empty line where the PDF has a bigger gap
    var med = lineGaps(lines), out = [];
    for (var i = 0; i < lines.length; i++) {
      var gap = i ? lines[i].y - lines[i - 1].y : 0;
      if (i && (gap <= 0 || (med && gap > med * 1.5))) out.push('');
      out.push(lines[i].text);
    }
    return out.join('\n');
  }
  async function extractPdfText(pdf, pageNums, ctl, report) {
    var pages = [], chars = 0;
    for (var i = 0; i < pageNums.length; i++) {
      ctl.check();
      if (report) report('Reading the text on page ' + (i + 1) + ' of ' + pageNums.length + '…', i / pageNums.length);
      var page = await pdf.getPage(pageNums[i]), tc, vp = page.getViewport({ scale: 1 });
      try { tc = await page.getTextContent(); } finally { try { page.cleanup(); } catch (e) { /* ignore */ } }
      var lines = pageLines(tc.items, vp);
      lines.forEach(function (l) { chars += l.text.replace(/\s/g, '').length; });
      pages.push({ n: pageNums[i], lines: lines, w: vp.width, h: vp.height });
    }
    return { pages: pages, chars: chars };
  }

  /* ------------------------------------------------------------------ Word (.docx), text only */
  function xmlText(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // pages: [ [paragraph, ...], ... ]   size: page width/height in points (from the PDF), so the Word file is A4 or Letter like the original
  async function buildDocx(pages, size) {
    var W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    var body = '';
    pages.forEach(function (paras, pi) {
      var first = true;
      if (!paras.length) { body += '<w:p>' + (pi ? '<w:pPr><w:pageBreakBefore/></w:pPr>' : '') + '</w:p>'; return; }
      paras.forEach(function (t) {
        body += '<w:p>' + (first && pi ? '<w:pPr><w:pageBreakBefore/></w:pPr>' : '') + '<w:r><w:t xml:space="preserve">' + xmlText(t) + '</w:t></w:r></w:p>';
        first = false;
      });
    });
    var pw = Math.round(((size && size.w) || 595.28) * 20), ph = Math.round(((size && size.h) || 841.89) * 20);
    var decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    var files = {
      '[Content_Types].xml': decl + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      '_rels/.rels': decl + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels': decl + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'word/styles.xml': decl + '<w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>',
      'word/document.xml': decl + '<w:document ' + W + '><w:body>' + body + '<w:sectPr><w:pgSz w:w="' + pw + '" w:h="' + ph + '"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>'
    };
    var enc = new root.TextEncoder(), entries = [];
    ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml'].forEach(function (n) { entries.push({ name: n, bytes: enc.encode(files[n]) }); });
    var zip = await makeZip(entries);
    return new root.Blob([zip], { type: FORMATS.docx.mime });
  }

  /* ------------------------------------------------------------------ ZIP (stored, no compression: pictures are already compressed) */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // entries: [{ name, blob }] or [{ name, bytes }]  ->  Blob (application/zip)
  async function makeZip(entries) {
    if (entries.length > 0xFFFF) throw friendly('Too many files for one ZIP.');
    var enc = new root.TextEncoder(), now = new Date(), parts = [], central = [], offset = 0, cdSize = 0;
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var data = e.bytes || new Uint8Array(await readBuffer(e.blob));
      var name = enc.encode(String(e.name).replace(/^\/+/, ''));
      var crc = crc32(data), size = data.length;
      if (size > 0xFFFFFFFF || offset > 0xFFFFFFFF) throw friendly('These files are too large for one ZIP.');
      var lh = new Uint8Array(30 + name.length), ldv = new DataView(lh.buffer);
      ldv.setUint32(0, 0x04034b50, true); ldv.setUint16(4, 20, true); ldv.setUint16(6, 0x0800, true); ldv.setUint16(8, 0, true);
      ldv.setUint16(10, dosTime, true); ldv.setUint16(12, dosDate, true); ldv.setUint32(14, crc, true);
      ldv.setUint32(18, size, true); ldv.setUint32(22, size, true); ldv.setUint16(26, name.length, true); ldv.setUint16(28, 0, true);
      lh.set(name, 30);
      var ch = new Uint8Array(46 + name.length), cdv = new DataView(ch.buffer);
      cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true); cdv.setUint16(8, 0x0800, true); cdv.setUint16(10, 0, true);
      cdv.setUint16(12, dosTime, true); cdv.setUint16(14, dosDate, true); cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true); cdv.setUint32(24, size, true); cdv.setUint16(28, name.length, true);
      cdv.setUint32(42, offset, true);
      ch.set(name, 46);
      parts.push(lh, e.blob || data);
      central.push(ch); cdSize += ch.length;
      offset += lh.length + size;
    }
    var end = new Uint8Array(22), edv = new DataView(end.buffer);
    edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, entries.length, true); edv.setUint16(10, entries.length, true);
    edv.setUint32(12, cdSize, true); edv.setUint32(16, offset, true);
    return new root.Blob(parts.concat(central, [end]), { type: 'application/zip' });
  }

  /* ------------------------------------------------------------------ converting one file */
  // opts: { quality 0..1, dpi, pages ('1-3, 5' or ''), pageSize ('a4'|'letter'|'fit'), pdfBuilder (when several pictures go into one PDF) }
  // returns { outputs: [{ name, blob }], thumb, width, height, pages, note }
  async function convertFile(file, info, target, opts, ctl, report) {
    opts = opts || {}; ctl = ctl || new Ctl(); report = report || function () {};
    var nm = splitName(file.name), base = nm.base, fmt = FORMATS[target];
    if (!canConvert(info, target)) throw friendly('A ' + (info.label || 'this file') + ' can’t be converted to ' + (fmt ? fmt.label : target) + '.');

    if (info.kind === 'image') {
      report('Opening ' + file.name + '…', 0);
      var dec = await decodeImage(file, info, ctl, function (m) { report(m, 0); });
      try {
        ctl.check();
        var thumb = makeThumb(dec.canvas), outputs;
        report('Saving as ' + fmt.label + '…', 0.6);
        if (target === 'pdf') {
          var b = opts.pdfBuilder || await newPdfBuilder(opts);
          await b.add(dec.canvas, info);
          outputs = opts.pdfBuilder ? [] : [{ name: base + '.pdf', blob: await b.save() }];
        } else {
          outputs = [{ name: base + '.' + fmt.ext, blob: await encodeRaster(dec.canvas, target, opts) }];
        }
        ctl.check();
        return { outputs: outputs, thumb: thumb, width: dec.width, height: dec.height };
      } finally { release(dec.canvas); }
    }

    // PDF
    report('Opening ' + file.name + '…', 0);
    var pdf = await openPdf(file);
    try {
      var pages = parsePages(opts.pages, pdf.numPages);
      if (!pages.length) throw friendly('No pages to convert.');
      if (RASTER_TARGETS[target]) {
        var dpi = opts.dpi || 150, outs = [], pthumb = null, w = 0, h = 0, digits = String(pdf.numPages).length, onePage = pdf.numPages === 1;
        for (var i = 0; i < pages.length; i++) {
          ctl.check();
          report('Page ' + (i + 1) + ' of ' + pages.length + '…', i / pages.length);
          var c = await renderPdfPage(pdf, pages[i], dpi);
          try {
            if (!pthumb) { pthumb = makeThumb(c); w = c.width; h = c.height; }
            outs.push({ name: onePage ? base + '.' + fmt.ext : base + '-page-' + zeroPad(pages[i], digits) + '.' + fmt.ext, blob: await encodeRaster(c, target, opts) });
          } finally { release(c); }
        }
        return { outputs: outs, thumb: pthumb, width: w, height: h, pages: pages.length };
      }
      // text
      var got = await extractPdfText(pdf, pages, ctl, report);
      if (got.chars === 0) throw friendly('No text was found in this PDF — it is probably a scan (a picture of a page). Use the “Extract Text (OCR)” tab instead.');
      var note = got.chars < 20 * pages.length ? 'Very little text was found — this PDF may be a scan. For the full text, use the “Extract Text (OCR)” tab.' : '';
      if (target === 'txt') {
        var multi = got.pages.length > 1, parts = got.pages.map(function (p) { var t = linesToText(p.lines); return multi ? '--- Page ' + p.n + ' ---\n' + t : t; });
        return { outputs: [{ name: base + '.txt', blob: new root.Blob([new root.TextEncoder().encode(parts.join('\n\n') + '\n')], { type: 'text/plain' }) }], pages: pages.length, note: note };
      }
      var docx = await buildDocx(got.pages.map(function (p) { return toParagraphs(p.lines, p.w); }), { w: got.pages[0].w, h: got.pages[0].h });
      return { outputs: [{ name: base + '.docx', blob: docx }], pages: pages.length, note: note };
    } finally { try { pdf.destroy(); } catch (e) { /* ignore */ } }
  }

  /* ------------------------------------------------------------------ the page */
  var CSS = [
    '.ppmc{color:var(--ink,#1C2321);font-family:inherit}',
    '.ppmc [hidden]{display:none!important}',
    '.ppmc-drop{border:2px dashed var(--line,rgba(28,35,33,.2));border-radius:14px;background:var(--paper,#EEF1EF);padding:30px 20px;text-align:center;transition:border-color .15s,background .15s}',
    '.ppmc-drop.is-over{border-color:var(--teal,#0D7A7C);background:rgba(13,122,124,.08)}',
    '.ppmc-art{display:block;margin:0 auto 8px;color:var(--teal,#0D7A7C)}',
    '.ppmc-drop-title{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:1.1rem;margin:0 0 10px}',
    '.ppmc-hint{font-size:.8rem;color:var(--ink-soft,#4B534F);margin-top:10px;font-family:"IBM Plex Mono",monospace}',
    '.ppmc[data-has-files] .ppmc-drop{padding:12px 16px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}',
    '.ppmc[data-has-files] .ppmc-art,.ppmc[data-has-files] .ppmc-hint{display:none}',
    '.ppmc[data-has-files] .ppmc-drop-title{margin:0;font-size:.95rem}',
    '.ppmc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:10px 22px;border:0;border-radius:999px;background:var(--ink,#1C2321);color:#fff;font:600 .95rem Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer}',
    '.ppmc-btn:hover{opacity:.92}',
    '.ppmc-btn--accent{background:var(--orange,#C14324)}',
    '.ppmc-btn--ghost{background:#fff;color:var(--ink-soft,#4B534F);border:1px solid var(--line,rgba(28,35,33,.2))}',
    '.ppmc-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.ppmc-files,.ppmc-results{list-style:none;margin:14px 0 0;padding:0}',
    '.ppmc-row{display:flex;align-items:center;gap:12px;padding:9px 12px;border:1px solid var(--line,rgba(28,35,33,.14));border-radius:10px;margin-bottom:8px;background:#fff}',
    '.ppmc-row.is-error{border-color:rgba(193,67,36,.45);background:rgba(193,67,36,.05)}',
    '.ppmc-row.is-skipped{background:var(--paper,#EEF1EF)}',
    '.ppmc-badge{flex:0 0 auto;min-width:46px;text-align:center;padding:4px 6px;border-radius:6px;background:var(--paper-2,#E4E9E6);color:var(--ink-soft,#4B534F);font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.04em}',
    '.ppmc-thumb{flex:0 0 auto;width:48px;height:48px;border-radius:6px;object-fit:cover;background:var(--paper-2,#E4E9E6)}',
    '.ppmc-info{flex:1 1 auto;min-width:0}',
    '.ppmc-name{font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ppmc-meta{font:.76rem "IBM Plex Mono",monospace;color:var(--ink-soft,#4B534F)}',
    '.ppmc-warn{font-size:.82rem;color:var(--orange,#C14324);margin-top:2px}',
    '.ppmc-warn a{color:inherit;font-weight:600}',
    '.ppmc-x{flex:0 0 auto;width:36px;height:36px;border:1px solid var(--line,rgba(28,35,33,.2));border-radius:8px;background:#fff;color:var(--ink-soft,#4B534F);font-size:1.1rem;line-height:1;cursor:pointer}',
    '.ppmc-x:hover:not(:disabled){border-color:var(--teal,#0D7A7C);color:var(--ink,#1C2321)}',
    '.ppmc-step{margin-top:20px}',
    '.ppmc-step h3{font:700 .98rem "Space Grotesk",sans-serif;margin:0 0 10px}',
    '.ppmc-chips{display:flex;flex-wrap:wrap;gap:8px}',
    '.ppmc-chip{min-height:44px;padding:10px 20px;border:1.5px solid var(--ink,#1C2321);border-radius:999px;background:#fff;color:var(--ink,#1C2321);font:700 .95rem Inter,system-ui,sans-serif;cursor:pointer}',
    '.ppmc-chip:hover:not(:disabled){background:var(--ink,#1C2321);color:#fff}',
    '.ppmc-chip.is-last{background:var(--teal,#0D7A7C);border-color:var(--teal,#0D7A7C);color:#fff}',
    '.ppmc-chip:disabled{opacity:.45;cursor:not-allowed}',
    '.ppmc-note{font-size:.84rem;color:var(--ink-soft,#4B534F);margin:10px 0 0}',
    '.ppmc-settings{margin-top:12px;font-size:.88rem}',
    '.ppmc-settings summary{cursor:pointer;font-weight:600;color:var(--ink-soft,#4B534F)}',
    '.ppmc-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:10px}',
    '.ppmc-field label{display:block;font-size:.8rem;font-weight:600;margin-bottom:4px}',
    '.ppmc-field select,.ppmc-field input[type=text]{width:100%;min-height:40px;padding:8px 10px;border:1px solid var(--line,rgba(28,35,33,.25));border-radius:8px;font:.9rem Inter,system-ui,sans-serif;background:#fff;color:var(--ink,#1C2321)}',
    '.ppmc-field--check label{display:flex;align-items:center;gap:8px;font-weight:500;min-height:40px}',
    '.ppmc-busy{display:flex;align-items:center;gap:12px;margin-top:16px}',
    '.ppmc-busy-main{flex:1 1 auto;min-width:0}',
    '.ppmc-progress-text{font:.8rem "IBM Plex Mono",monospace;color:var(--ink-soft,#4B534F);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ppmc-t-tap{display:none}',
    '@media (pointer:coarse){.ppmc-t-drop{display:none}.ppmc-t-tap{display:inline}}',
    '.ppmc-bar{height:8px;background:var(--paper-2,#E4E9E6);border-radius:999px;overflow:hidden}',
    '.ppmc-bar>div{height:100%;width:0;background:var(--teal,#0D7A7C);transition:width .2s ease}',
    '.ppmc-status{margin-top:14px;font-size:.92rem;padding:11px 14px;border-radius:8px;background:rgba(13,122,124,.08);color:var(--ink,#1C2321)}',
    '.ppmc-status.is-error{background:rgba(193,67,36,.08);color:var(--orange,#C14324)}',
    '.ppmc-status:empty{display:none}',
    '.ppmc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}',
    '@media (prefers-reduced-motion:reduce){.ppmc-bar>div,.ppmc-drop{transition:none}}',
    '@media (max-width:520px){.ppmc-drop{padding:22px 14px}.ppmc-row{gap:8px;padding:8px}.ppmc-btn{padding:10px 16px}}'
  ].join('\n');

  var ART = '<svg class="ppmc-art" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
  var seq = 0;

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); }
    if (kids !== undefined && kids !== null) {
      (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c !== null && c !== undefined) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    }
    return e;
  }
  function injectCss() {
    if (document.getElementById('ppmc-css')) return;
    var st = document.createElement('style'); st.id = 'ppmc-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  var MAX_FILES = 100;
  function article(label) { return (/^[AEIOU]/.test(label) ? 'an ' : 'a ') + label; }

  function mount(rootEl, options) {
    options = options || {};
    injectCss();
    var uid = 'ppmc' + (++seq);
    var S = { items: [], nextId: 1, busy: false, ctl: null, urls: [], results: [], lastTarget: null };

    rootEl.classList.add('ppmc');
    rootEl.textContent = '';

    // --- markup
    var input = h('input', { type: 'file', multiple: '', accept: ACCEPT, hidden: '', class: 'ppmc-input', 'aria-label': 'Choose files to convert' });
    var chooseBtn = h('button', { type: 'button', class: 'ppmc-btn ppmc-choose' }, 'Choose files');
    var artWrap = h('div'); artWrap.innerHTML = ART;
    var drop = h('div', { class: 'ppmc-drop', role: 'group', 'aria-label': 'Add files to convert' }, [
      artWrap.firstChild,
      h('div', { class: 'ppmc-drop-title' }, [h('span', { class: 'ppmc-t-drop' }, 'Drop files here'), h('span', { class: 'ppmc-t-tap' }, 'Add photos or PDFs')]),
      chooseBtn,
      h('div', { class: 'ppmc-hint' }, 'HEIC · JPG · PNG · WebP · GIF · BMP · AVIF · PDF'),
      input
    ]);
    var fileList = h('ul', { class: 'ppmc-files', 'aria-label': 'Files to convert' });

    var chips = h('div', { class: 'ppmc-chips', role: 'group', 'aria-labelledby': uid + '-to' });
    var noteEl = h('p', { class: 'ppmc-note' });
    var fQuality = h('select', { class: 'ppmc-quality', id: uid + '-q' }, [
      h('option', { value: '0.92', selected: '' }, 'High (best looking)'), h('option', { value: '0.8' }, 'Medium'), h('option', { value: '0.6' }, 'Small file')]);
    var fDpi = h('select', { class: 'ppmc-dpi', id: uid + '-dpi' }, [
      h('option', { value: '72' }, 'Small (72 DPI)'), h('option', { value: '150', selected: '' }, 'Standard (150 DPI)'), h('option', { value: '300' }, 'High (300 DPI)')]);
    var fPages = h('input', { type: 'text', class: 'ppmc-pages', id: uid + '-pg', placeholder: 'All pages, or e.g. 1-3, 5', autocomplete: 'off', spellcheck: 'false' });
    var fSize = h('select', { class: 'ppmc-pagesize', id: uid + '-ps' }, [
      h('option', { value: 'a4', selected: '' }, 'A4'), h('option', { value: 'letter' }, 'US Letter'), h('option', { value: 'fit' }, 'Same size as the picture')]);
    var fCombine = h('input', { type: 'checkbox', class: 'ppmc-combine', id: uid + '-cb', checked: '' });
    var fieldQ = h('div', { class: 'ppmc-field' }, [h('label', { for: uid + '-q' }, 'Quality for JPG and WebP'), fQuality]);
    var fieldDpi = h('div', { class: 'ppmc-field' }, [h('label', { for: uid + '-dpi' }, 'PDF pages as pictures: resolution'), fDpi]);
    var fieldPages = h('div', { class: 'ppmc-field' }, [h('label', { for: uid + '-pg' }, 'PDF pages to convert'), fPages]);
    var fieldSize = h('div', { class: 'ppmc-field' }, [h('label', { for: uid + '-ps' }, 'Pictures to PDF: page size'), fSize]);
    var fieldCombine = h('div', { class: 'ppmc-field ppmc-field--check' }, [h('label', { for: uid + '-cb' }, [fCombine, 'Put all pictures into one PDF'])]);
    var settings = h('details', { class: 'ppmc-settings' }, [
      h('summary', null, 'Settings (optional)'),
      h('div', { class: 'ppmc-fields' }, [fieldQ, fieldDpi, fieldPages, fieldSize, fieldCombine])
    ]);
    var step = h('div', { class: 'ppmc-step', hidden: '' }, [
      h('h3', { id: uid + '-to' }, 'Convert to'), chips, noteEl, settings
    ]);

    var bar = h('div', { class: 'ppmc-bar', role: 'progressbar', 'aria-label': 'Conversion progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('div'));
    var progressText = h('div', { class: 'ppmc-progress-text' });
    var stopBtn = h('button', { type: 'button', class: 'ppmc-btn ppmc-btn--ghost ppmc-stop' }, 'Stop');
    var busyRow = h('div', { class: 'ppmc-busy', hidden: '' }, [h('div', { class: 'ppmc-busy-main' }, [progressText, bar]), stopBtn]);
    var status = h('div', { class: 'ppmc-status', role: 'status', 'aria-live': 'polite' });
    var results = h('ul', { class: 'ppmc-results', 'aria-label': 'Converted files' });
    var allBtn = h('a', { class: 'ppmc-btn ppmc-btn--accent ppmc-all', hidden: '', role: 'button' }, 'Download all (.zip)');
    var resetBtn = h('button', { type: 'button', class: 'ppmc-btn ppmc-btn--ghost ppmc-reset', hidden: '' }, 'Start over');
    var actions = h('div', { class: 'ppmc-actions' }, [allBtn, resetBtn]);
    [drop, fileList, step, busyRow, status, results, actions].forEach(function (n) { rootEl.appendChild(n); });

    // --- small UI helpers
    function say(msg, isError) { status.textContent = msg || ''; status.classList.toggle('is-error', !!isError); }
    function setBar(frac) { var p = Math.max(0, Math.min(100, Math.round(frac * 100))); bar.firstChild.style.width = p + '%'; bar.setAttribute('aria-valuenow', String(p)); }
    function revokeAll() { S.urls.forEach(function (u) { try { root.URL.revokeObjectURL(u); } catch (e) { /* ignore */ } }); S.urls = []; }
    function clearResults() {
      revokeAll(); S.results = []; results.textContent = '';
      allBtn.hidden = true; allBtn.removeAttribute('href'); resetBtn.hidden = !S.items.length;
      [].forEach.call(chips.children, function (c) { c.classList.remove('is-last'); });
    }
    function blobUrl(blob) { var u = root.URL.createObjectURL(blob); S.urls.push(u); return u; }
    function setBusy(on) {
      S.busy = on; busyRow.hidden = !on;
      [].forEach.call(chips.children, function (c) { c.disabled = on; });
      chooseBtn.disabled = on; resetBtn.disabled = on;
      [].forEach.call(fileList.querySelectorAll('.ppmc-x'), function (b) { b.disabled = on; });
    }

    // --- the list of files
    function kindsPresent() {
      var k = { images: 0, pdf: false, heic: false, gif: false };
      S.items.forEach(function (it) {
        if (it.info.kind === 'image') { k.images++; if (it.info.fmt === 'heic') k.heic = true; if (it.info.fmt === 'gif') k.gif = true; }
        else if (it.info.kind === 'pdf') k.pdf = true;
      });
      return k;
    }
    function renderFiles() {
      fileList.textContent = '';
      S.items.forEach(function (it) {
        var ok = it.info.kind !== 'unsupported', warn = null;
        if (!ok) {
          if (it.info.problem) warn = h('div', { class: 'ppmc-warn' }, it.info.problem);
          else warn = h('div', { class: 'ppmc-warn' }, ['This ' + it.info.label + ' can’t be converted here yet. ',
            h('a', { href: '/help-me#q=' + encodeURIComponent('Convert a ' + it.info.label + ' to another format') }, 'Ask us to build it')]);
        }
        var row = h('li', { class: 'ppmc-row' + (ok ? '' : ' is-error') }, [
          h('span', { class: 'ppmc-badge' }, ok ? it.info.label : ((it.info.fmt || '?').toUpperCase().slice(0, 5) || '?')),
          h('div', { class: 'ppmc-info' }, [
            h('div', { class: 'ppmc-name', title: it.name }, it.name),
            h('div', { class: 'ppmc-meta' }, fmtSize(it.size)),
            warn
          ]),
          h('button', { type: 'button', class: 'ppmc-x', 'aria-label': 'Remove ' + it.name, title: 'Remove' }, '×')
        ]);
        row.querySelector('.ppmc-x').addEventListener('click', function () { removeItem(it.id); });
        fileList.appendChild(row);
      });
      if (S.busy) [].forEach.call(fileList.querySelectorAll('.ppmc-x'), function (b) { b.disabled = true; });
      rootEl.toggleAttribute('data-has-files', S.items.length > 0);

      // the formats on offer: everything at least one of the files can become
      var k = kindsPresent(), seen = {}, list = [];
      S.items.forEach(function (it) { targetsFor(it.info).forEach(function (t) { if (!seen[t]) { seen[t] = 1; list.push(t); } }); });
      var order = ['jpg', 'png', 'webp', 'pdf', 'txt', 'docx', 'bmp', 'tiff', 'ico'];
      list.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      chips.textContent = '';
      list.forEach(function (t) {
        var c = h('button', { type: 'button', class: 'ppmc-chip', 'data-target': t, 'aria-label': 'Convert to ' + FORMATS[t].label }, FORMATS[t].label);
        c.addEventListener('click', function () { run(t); });
        c.disabled = S.busy;
        if (S.lastTarget === t && S.results.length) c.classList.add('is-last');
        chips.appendChild(c);
      });
      step.hidden = !list.length;
      var notes = [];
      if (k.pdf) notes.push('A PDF becomes one picture per page (several pages arrive as a ZIP). Word keeps the text only: no layout, tables or pictures.');
      if (k.heic) notes.push('HEIC photos from an iPhone are opened with a small decoder that loads the first time.');
      if (k.gif) notes.push('Animated GIFs keep only their first frame.');
      noteEl.textContent = notes.join(' ');
      noteEl.hidden = !notes.length;
      fieldQ.hidden = !k.images && !k.pdf; fieldDpi.hidden = !k.pdf; fieldPages.hidden = !k.pdf;
      fieldSize.hidden = !k.images; fieldCombine.hidden = k.images < 2;
      resetBtn.hidden = !S.items.length;
    }
    function removeItem(id) {
      if (S.busy) return;
      S.items = S.items.filter(function (it) { return it.id !== id; });
      if (!S.items.length) fPages.value = '';
      clearResults(); say(''); renderFiles();
    }
    async function addFiles(fileArr) {
      fileArr = Array.prototype.slice.call(fileArr || []);      // copy now: a dropped FileList is emptied after the event
      if (!fileArr.length) return;
      if (S.busy) { say('Finish or stop the current conversion before adding more files.', true); return; }
      clearResults(); say('');
      var room = MAX_FILES - S.items.length, over = 0;
      if (fileArr.length > room) { over = fileArr.length - Math.max(0, room); fileArr = fileArr.slice(0, Math.max(0, room)); }
      for (var i = 0; i < fileArr.length; i++) {
        var f = fileArr[i], info;
        if (!f.size) info = { kind: 'unsupported', fmt: '', label: 'file', problem: 'This file is empty (0 bytes) or is a folder. Add the files themselves.' };
        else {
          try { info = await sniff(f); } catch (e) { info = { kind: 'unsupported', fmt: '', label: 'file', problem: 'This file couldn’t be read. Try adding it again.' }; }
        }
        S.items.push({ id: S.nextId++, file: f, name: f.name || 'file', size: f.size, info: info });
      }
      renderFiles();
      if (over > 0) say('Only ' + MAX_FILES + ' files fit in one batch, so ' + over + ' ' + (over === 1 ? 'file was' : 'files were') + ' left out. Convert this batch first, then add the rest.', true);
    }

    // --- the results
    function addResultRow(res) {
      var li;
      if (res.error || res.skipped) {
        li = h('li', { class: 'ppmc-row ppmc-result ' + (res.error ? 'is-error' : 'is-skipped') }, [
          h('span', { class: 'ppmc-badge' }, res.error ? '!' : '–'),
          h('div', { class: 'ppmc-info' }, [h('div', { class: 'ppmc-name', title: res.source }, res.source), h('div', { class: res.error ? 'ppmc-warn' : 'ppmc-meta' }, res.error || res.skipped)])
        ]);
      } else {
        var meta = [], blob = res.downloadBlob, shownName = res.downloadName;
        var dl = h('a', { class: 'ppmc-btn ppmc-btn--accent ppmc-dl', role: 'button', 'aria-label': 'Download ' + shownName }, 'Download');
        dl.setAttribute('href', blobUrl(blob)); dl.setAttribute('download', shownName);
        if (res.outputs.length > 1) meta.push(res.outputs.length + ' files in a ZIP');
        else if (res.width) meta.push(sizeLabel(res.width, res.height));
        if (res.detail) meta.push(res.detail);
        meta.push(fmtSize(blob.size));
        var lead = res.thumb ? h('img', { class: 'ppmc-thumb', src: res.thumb, alt: '', width: '48', height: '48' }) : h('span', { class: 'ppmc-badge' }, res.badge || '');
        li = h('li', { class: 'ppmc-row ppmc-result' }, [
          lead,
          h('div', { class: 'ppmc-info' }, [h('div', { class: 'ppmc-name', title: shownName }, shownName), h('div', { class: 'ppmc-meta' }, meta.join(' · ')),
            res.note ? h('div', { class: 'ppmc-warn' }, res.note) : null]),
          dl
        ]);
      }
      results.appendChild(li);
    }
    async function offerZip(done) {
      var flat = [], used = {};
      done.forEach(function (r) {
        var many = r.outputs.length > 1, folder = many ? splitName(r.source).base + '/' : '';
        r.outputs.forEach(function (o) {
          var nm = folder + o.name, n = 2;
          while (used[nm.toLowerCase()]) { var p = splitName(o.name); nm = folder + p.base + ' (' + (n++) + ')' + (p.ext ? '.' + p.ext : ''); }
          used[nm.toLowerCase()] = 1; flat.push({ name: nm, blob: o.blob });
        });
      });
      if (done.length < 2 || flat.length < 2) return;           // one source file already has its own download (a ZIP when it made several pictures)
      var zip = await makeZip(flat);
      allBtn.setAttribute('href', blobUrl(zip)); allBtn.setAttribute('download', 'poppopmake-converted.zip');
      allBtn.hidden = false;
    }

    // --- running a conversion
    function readOpts() {
      return { quality: parseFloat(fQuality.value) || 0.92, dpi: parseInt(fDpi.value, 10) || 150, pages: fPages.value, pageSize: fSize.value, combine: fCombine.checked };
    }
    async function run(target) {
      if (S.busy || !S.items.length || !FORMATS[target]) return;
      var opts = readOpts(), fmt = FORMATS[target];
      clearResults(); say('');
      var jobs = [], skipped = [];
      S.items.forEach(function (it) {
        if (it.info.kind === 'unsupported') return;                 // already explained in the list above
        if (it.info.fmt === target) skipped.push({ source: it.name, skipped: 'Already ' + article(it.info.label) + ' file.' });
        else if (canConvert(it.info, target)) jobs.push(it);
        else skipped.push({ source: it.name, skipped: 'A ' + it.info.label + ' can’t be converted to ' + fmt.label + '.' });
      });
      if (!jobs.length) {
        skipped.forEach(addResultRow);
        say('None of these files can be converted to ' + fmt.label + '. Pick another format.', true);
        return;
      }
      if (jobs.some(function (j) { return j.info.kind === 'pdf'; })) {      // a bad page range is reported before any work starts
        try { parseRanges(opts.pages); } catch (e) { say(e.message, true); return; }
      }
      S.lastTarget = target;
      var ctl = S.ctl = new Ctl(), total = jobs.length;
      setBusy(true); setBar(0); progressText.textContent = '';
      say('Converting ' + total + ' file' + (total === 1 ? '' : 's') + ' to ' + fmt.label + '…');
      function reporter(idx) {
        return function (msg, frac) { progressText.textContent = (total > 1 ? (idx + 1) + ' of ' + total + ' — ' : '') + msg; setBar((idx + (frac || 0)) / total); };
      }
      var imageJobs = jobs.filter(function (j) { return j.info.kind === 'image'; }).length;
      var builder = null, combinedThumb = null, combinedCount = 0, okCount = 0, failed = 0, finished = [];
      try {
        if (target === 'pdf' && opts.combine && imageJobs > 1) builder = await newPdfBuilder(opts);
        for (var i = 0; i < jobs.length; i++) {
          ctl.check();
          var it = jobs[i], res = { source: it.name }, report = reporter(i);
          report('Opening ' + it.name + '…', 0);
          await sleep(16);                                          // let the screen update between files
          try {
            var o = Object.assign({}, opts, { pdfBuilder: builder && it.info.kind === 'image' ? builder : null });
            var out = await convertFile(it.file, it.info, target, o, ctl, report);
            if (!out.outputs.length && builder) {                   // this picture went into the combined PDF
              combinedThumb = combinedThumb || out.thumb; combinedCount++; okCount++;
              continue;
            }
            res.outputs = out.outputs; res.thumb = out.thumb; res.width = out.width; res.height = out.height; res.note = out.note;
            if (it.info.kind === 'pdf' && String(opts.pages).trim()) res.detail = 'pages ' + String(opts.pages).trim().replace(/\s+/g, ' ');
            if (out.outputs.length === 1) { res.downloadBlob = out.outputs[0].blob; res.downloadName = out.outputs[0].name; }
            else { res.downloadBlob = await makeZip(out.outputs); res.downloadName = splitName(it.name).base + '-' + fmt.ext + '.zip'; }
            res.badge = fmt.ext.toUpperCase();
            finished.push(res); addResultRow(res); okCount++;
          } catch (err) {
            if (err === CANCELLED || (err && err.cancelled)) throw CANCELLED;
            failed++;
            res.error = err && err.friendly ? err.message : 'Could not convert this file: ' + ((err && err.message) || err) + '.';
            addResultRow(res);
          }
        }
        if (builder && builder.count() > 0) {
          ctl.check();
          progressText.textContent = 'Putting ' + builder.count() + ' pictures into one PDF…'; setBar(0.97);
          var pdfBlob = await builder.save();
          var cres = { source: 'combined.pdf', outputs: [{ name: 'combined.pdf', blob: pdfBlob }], downloadBlob: pdfBlob, downloadName: 'combined.pdf', badge: 'PDF', thumb: combinedThumb, detail: builder.count() + ' pictures, one per page' };
          finished.push(cres); addResultRow(cres);
        }
        skipped.forEach(addResultRow);
        setBar(1);
        if (okCount === 0) say('Nothing could be converted. See the details below.', true);
        else if (failed) say('Converted ' + okCount + ' of ' + (okCount + failed) + ' files to ' + fmt.label + '. ' + failed + ' could not be converted — see below.', true);
        else say('Done — ' + okCount + ' file' + (okCount === 1 ? '' : 's') + ' converted to ' + fmt.label + '.');
        if (okCount > 0) await offerZip(finished);
        S.results = finished;
        if (okCount > 0 && root.ppmMaybeShowThanks) root.ppmMaybeShowThanks();
      } catch (err) {
        if (err === CANCELLED || (err && err.cancelled)) {
          S.results = finished;
          say('Stopped. ' + (finished.length ? finished.length + ' finished before you stopped:' : 'Nothing was converted.'));
          try { await offerZip(finished); } catch (e) { /* the individual downloads still work */ }
        } else {
          say(err && err.friendly ? err.message : 'Something went wrong: ' + ((err && err.message) || err), true);
          S.results = finished;
        }
      } finally {
        S.ctl = null; setBusy(false); progressText.textContent = ''; setBar(0);
        renderFiles();
      }
    }

    // --- wiring
    chooseBtn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { var fs = Array.prototype.slice.call(input.files || []); input.value = ''; addFiles(fs); });
    stopBtn.addEventListener('click', function () { if (S.ctl) S.ctl.cancel(); });
    function startOver() { if (S.busy) return; S.items = []; S.lastTarget = null; fPages.value = ''; clearResults(); say(''); renderFiles(); }
    resetBtn.addEventListener('click', startOver);

    var overTarget = options.dropTarget || rootEl.closest('.panel') || rootEl, depth = 0;
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; if (!t) return false; for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true; return false; }
    overTarget.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; drop.classList.add('is-over'); });
    overTarget.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    overTarget.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('is-over'); });
    overTarget.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; drop.classList.remove('is-over');
      addFiles(e.dataTransfer.files);
    });

    renderFiles();
    return { addFiles: addFiles, run: run, reset: startOver, state: S };
  }

  function autoMount() {
    var nodes = document.querySelectorAll('[data-ppmc]');
    for (var i = 0; i < nodes.length; i++) { if (!nodes[i].__ppmc) nodes[i].__ppmc = mount(nodes[i]); }
  }

  root.PPMConvert = {
    version: '1.0.0', mount: mount, autoMount: autoMount,
    sniff: sniff, targetsFor: targetsFor, canConvert: canConvert, convertFile: convertFile, parsePages: parsePages,
    makeZip: makeZip, buildDocx: buildDocx, crc32: crc32, formats: FORMATS, Ctl: Ctl
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})(window);
