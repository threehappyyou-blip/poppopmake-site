// PopPopMake helper for the tool pages: a "Show me how" button on each tool that walks through it on the real buttons,
// and, if someone seems stuck (nothing added after a while), a one-time offer to show them. Search-in-your-own-words is
// the Ctrl+K search, which this does not duplicate. The pointer engine is shared with Budget, Notes & Diary
// (vault-helper.js, loaded only when needed). Nothing is sent anywhere; the few things remembered stay in this browser.
(function () {
  'use strict';
  if (window.__ppmSiteHelper || window.top !== window.self) return;
  window.__ppmSiteHelper = true;

  var path = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  var DONE_FILE = 'Done. The result was saved to your device; nothing was uploaded.';
  // A step: load (wait for a file to be added here), click, input (type something), change (move a slider),
  // pick (tap one of several: `hit`). Texts use the buttons' real names.
  var G = {
    merge: { name: 'Merge PDFs', steps: [
      { load: '#merge-drop', text: 'Drag your PDFs onto this box, or tap it to choose them. Pick two or more.' },
      { click: '#merge-btn', text: 'Drag the files in the list to put them in order, then tap “Merge PDFs”.' }], done: DONE_FILE },
    split: { name: 'Split PDF', steps: [
      { load: '#split-drop', text: 'Drag a PDF onto this box, or tap it to choose one.' },
      { input: '#split-range', text: 'Type the pages you want, for example 1-3, 5.' },
      { click: '#split-btn', text: 'Tap “Extract Pages”.' }], done: DONE_FILE },
    images: { name: 'Images to PDF', steps: [
      { load: '#images-drop', text: 'Drag your photos onto this box, or tap it to choose them.' },
      { click: '#images-btn', text: 'Change the page size or margins if you like, then tap “Convert to PDF”.' }], done: DONE_FILE },
    convert: { name: 'Convert Files', steps: [
      { load: '.ppmc-drop', text: 'Drag photos or a PDF onto this box, or tap “Choose files”. iPhone HEIC photos work too.' },
      { pick: '.ppmc-chips', hit: '.ppmc-chip', text: 'Tap the format you want.' },
      { click: '.ppmc-dl', text: 'Tap “Download” next to the file.' }], done: DONE_FILE },
    bgremove: { name: 'Remove Background', steps: [
      { load: '#bgremove-drop', text: 'Drag a photo onto this box, or tap it to choose one.' },
      { click: '#bgremove-btn', text: 'Tap “Remove Background”. The first time it downloads a small model, then it stays on your device.' },
      { click: '#bgremove-download-btn', text: 'Tap “Download PNG”.' }], done: DONE_FILE },
    metadata: { name: 'Clean PDF Metadata', steps: [
      { load: '#metadata-drop', text: 'Drag a PDF onto this box, or tap it to choose one. You’ll see the hidden details it carries.' },
      { click: '#metadata-clean-btn', text: 'Type a new title or author if you want one, then tap “Clean and Download”.' }], done: DONE_FILE },
    compress: { name: 'Compress & Convert Image', steps: [
      { load: '#compress-drop', text: 'Drag a photo onto this box, or tap it to choose one.' },
      { change: '#compress-quality', text: 'Move the quality slider: lower makes a smaller file. The new size shows on the right.' },
      { click: '#compress-download-btn', text: 'Tap “Download”.' }], done: DONE_FILE },
    redact: { name: 'Redact PDF', steps: [
      { load: '#redact-drop', text: 'Drag a PDF onto this box, or tap it to choose one.' },
      { click: '#redact-download-btn', text: 'Drag boxes over anything you want hidden (or let “Find & mark on all pages” do it), then tap “Redact All Pages & Download”.' }], done: DONE_FILE },
    ocr: { name: 'Extract Text (OCR)', steps: [
      { load: '#ocr-drop', text: 'Drag a photo or a PDF onto this box, or tap it to choose one.' },
      { click: '#ocr-run-btn', text: 'Check that the language matches the text, then tap “Extract Text”.' },
      { click: '#ocr-copy-btn', hit: '#ocr-copy-btn, #ocr-download-btn', text: 'When the text appears, tap “Copy text” (or “Download .txt”).' }], done: 'Done. The text is yours to paste anywhere; the file never left your device.' },
    facemosaic: { name: 'Face Mosaic', steps: [
      { load: '#facemosaic-drop', text: 'Drag a photo onto this box, or tap it to choose one. Faces are found and covered automatically.' },
      { click: '#facemosaic-download-btn', text: 'Drag over anything else to cover it (tap a box to switch it off), then tap “Download”.' }], done: DONE_FILE },
    upscale: { name: 'Enhance Quality', steps: [
      { load: '#upscale-drop', text: 'Drag a photo onto this box, or tap it to choose one.' },
      { click: '#upscale-run-btn', text: '“Fast” suits most photos. Pick 2× or 4×, then tap “Enhance”.' },
      { click: '#upscale-download-btn', text: 'Tap “Download”.' }], done: DONE_FILE },
    eraser: { name: 'AI Eraser', steps: [
      { load: '#eraser-drop', text: 'Drag a photo onto this box, or tap it to choose one.' },
      { click: '#eraser-run-btn', text: 'Paint over what you want gone, a little past its edges, then tap “Erase”.' },
      { click: '#eraser-download-btn', text: 'Tap “Download”.' }], done: DONE_FILE },
    markup: { name: 'Screenshot Markup', steps: [
      { load: '#markup-drop', text: 'Paste a screenshot (Ctrl+V), capture one with the buttons above, or drag an image onto this box.' },
      { click: '#markup-download-btn', text: 'Draw arrows, boxes or text with the tools above the picture, then tap “Download”.' }], done: DONE_FILE },
    builder: { name: 'Resume Builder', steps: [
      { input: '#rb-name', text: 'Type your name. Email, phone and the rest go just below.' },
      { click: '#rb-add-exp', text: 'Tap “+ Add work experience” for each job.' },
      { click: '#rb-download-btn', text: 'Check the preview, then tap “Download Resume PDF”.' }], done: DONE_FILE },
    cover: { name: 'Cover Letter', steps: [
      { input: '#cl-name', text: 'Type your name.' },
      { input: '#cl-company', text: 'Type the company you’re writing to.' },
      { click: '#cl-download-btn', text: 'Fill in the rest you want, then tap “Download Cover Letter PDF”.' }], done: DONE_FILE },
    ats: { name: 'ATS Match Check', steps: [
      { input: '#ats-resume', text: 'Paste the text of your résumé.' },
      { input: '#ats-jd', text: 'Paste the job posting.' },
      { click: '#ats-check-btn', text: 'Tap “Check Match”. Missing keywords are listed below.' }], done: 'Done. Add the missing words where they’re true for you.' },
    invoice: { name: 'Invoice Generator', steps: [
      { input: '#inv-from-name', text: 'Type your name or business.' },
      { input: '#inv-to-name', text: 'Type who you’re billing.' },
      { click: '#inv-add-item', text: 'Tap “+ Add line item” for each thing you’re charging for.' },
      { click: '#inv-download-btn', text: 'Check the totals, then tap “Download Invoice PDF”.' }], done: DONE_FILE },
    photoprep: { name: 'Blog Photo Prep', steps: [
      { load: '#pb-drop', text: 'Drag the photos for your post onto this box, paste them, or tap “Choose photos”. iPhone photos work too.' },
      { click: '#pb-go', text: 'Check the width and type a keyword for the file names if you like, then tap “Prepare photos”.' },
      { click: '#pb-zip', text: 'Tap “Download all (ZIP)” (or “Download” next to any one photo).' }], done: DONE_FILE },
    qr: { name: 'QR Code Generator', steps: [
      { input: '#qr-text', text: 'Paste a link or type any text.' },
      { click: '#qr-download-btn', text: 'Change the colors or size if you like, then tap “Download PNG”.' }], done: DONE_FILE }
  };
  var PAGE = { '/document-tools': 'tabs', '/career-tools': 'tabs', '/business-tools': 'tabs', '/screenshot-markup': 'markup', '/blog-photo-prep': 'photoprep' }[path];
  if (!PAGE) return;

  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window */ } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; }

  // the tool on screen now
  function current() {
    if (PAGE !== 'tabs') return { id: PAGE, panel: document.querySelector('main') || document.body };
    var p = document.querySelector('.panel.active'); if (!p) return null;
    var id = p.id.replace(/^panel-/, '');
    return G[id] ? { id: id, panel: p } : null;
  }
  function visible(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }
  function ready(sel) { var e = document.querySelector(sel); return visible(e) && !e.disabled; }

  // "a file was added here": a chosen file, a drop or a paste while this tool is on screen
  var loaded = {};
  function markLoaded(e) { var c = current(); if (!c) return; if (e.type === 'paste' || (e.target && c.panel.contains(e.target))) { if (!loaded[c.id]) loaded[c.id] = Date.now(); used(c.id); } }
  document.addEventListener('change', function (e) { if (e.target && e.target.type === 'file' && e.target.files && e.target.files.length) markLoaded(e); }, true);
  document.addEventListener('drop', markLoaded, true);
  document.addEventListener('paste', function (e) { var c = current(); if (c && (c.id === 'markup' || c.id === 'ocr')) markLoaded(e); }, true);
  function used(id) { var u = get('ppm-guide-used') || {}; u[id] = Math.min(9, (u[id] || 0) + 1); set('ppm-guide-used', u); }

  // ------------------------------------------------------------------------- the pointer engine (loaded when needed)
  var GUIDE = null, loading = null;
  var WORDS = { 'hp.g.quit': 'Stop', 'btn.ok': 'OK' };
  function t(k, v) { var s = WORDS[k] || k; if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n] !== undefined ? v[n] : m; }); return s; }
  function engine() {
    if (GUIDE) return Promise.resolve(GUIDE);
    if (!loading) loading = new Promise(function (res, rej) {
      if (window.VaultHelper) return res();
      var s = document.createElement('script'); s.src = '/vault-helper.js'; s.onload = res; s.onerror = function () { loading = null; rej(new Error('load')); };
      document.head.appendChild(s);
    }).then(function () { injectCss(); GUIDE = new window.VaultHelper.Guide({ t: t, onEnd: function (flow, fin) { if (fin) { var d = get('ppm-guide-done') || {}; d[flow] = 1; set('ppm-guide-done', d); } } }); return GUIDE; });
    return loading;
  }
  function stepsFor(id) {
    var def = G[id], out = [];
    def.steps.forEach(function (s, i) {
      var next = def.steps[i + 1], o = { key: s.text };
      // done once the file is in and the next button is ready; if that button never comes (an AI model that can't
      // download while offline), move on after 20 s so the walk-through ends quietly instead of waiting forever
      if (s.load) { o.sel = s.load; o.until = function () { return !!loaded[id] && (!next || ready(next.load || next.click || next.input || next.change || next.pick) || Date.now() - loaded[id] > 20000); }; }
      else if (s.click) { o.sel = s.click; o.hit = s.hit; o.until = 'click'; }
      else if (s.input) { o.sel = s.input; o.until = 'input'; }
      else if (s.pick) { o.sel = s.pick; o.hit = s.hit; o.until = 'click'; }
      else if (s.change) {
        var start = null; o.sel = s.change;
        o.before = function () { var e = document.querySelector(s.change); start = e ? e.value : null; };
        o.until = function () { var e = document.querySelector(s.change); return !!e && start !== null && e.value !== start; };
      }
      out.push(o);
    });
    // a step whose file is already in (the page was used before the walk-through started) is skipped
    if (loaded[id] && def.steps[0].load) out.shift();
    return out;
  }
  function start(id) {
    engine().then(function (g) {
      var old = document.getElementById('hp-say'); if (old) old.remove();
      g.start(id, stepsFor(id), G[id].done);
    }).catch(function () {});
  }

  // ------------------------------------------------------------------------- "Show me how" on each tool
  function buttons() {
    var spots = PAGE !== 'tabs' ? [{ id: PAGE, after: document.querySelector(PAGE === 'photoprep' ? '#pb-app h2' : 'main h1') }]
      : Array.prototype.map.call(document.querySelectorAll('.panel[id^="panel-"]'), function (p) {
        var id = p.id.replace(/^panel-/, ''); return G[id] ? { id: id, after: p.querySelector('h2') } : null;
      }).filter(Boolean);
    spots.forEach(function (x) {
      if (!x.after || document.getElementById('howto-' + x.id)) return;
      var b = el('button', { type: 'button', class: 'ppm-howto', id: 'howto-' + x.id, 'aria-label': 'Show me how to use ' + G[x.id].name + ', step by step on this page' }, '▶ Show me how');
      b.addEventListener('click', function () { start(x.id); });
      x.after.parentNode.insertBefore(b, x.after.nextSibling);
    });
  }

  // ------------------------------------------------------------------------- an offer when someone seems stuck
  // On a tool with nothing added for 25 seconds and no key press or tap: offer the walk-through, once a day per tool,
  // never after the tool has been used twice or the walk-through was finished, and never again after "Don't offer again".
  var WAIT = 25000, quietSince = Date.now(), offeredHere = {};
  ['keydown', 'pointerdown', 'input', 'drop', 'paste', 'wheel'].forEach(function (ev) { document.addEventListener(ev, function () { quietSince = Date.now(); }, true); });
  var lastTool = null;
  setInterval(function () {
    var c = current(); if (!c) return;
    if (c.id !== lastTool) { lastTool = c.id; quietSince = Date.now(); return; }
    if (loaded[c.id] || offeredHere[c.id] || Date.now() - quietSince < WAIT) return;
    if (get('ppm-guide-off') || (GUIDE && GUIDE.running()) || document.getElementById('hp-say')) return;
    var first = G[c.id].steps[0];
    if (first.input) { var f = document.querySelector(first.input); if (!f || String(f.value || '').trim()) return; }
    if (((get('ppm-guide-used') || {})[c.id] || 0) >= 2 || (get('ppm-guide-done') || {})[c.id]) return;
    var off = get('ppm-guide-offered') || {};
    if (off[c.id] === today()) return;
    offeredHere[c.id] = true; off[c.id] = today(); set('ppm-guide-offered', off);
    engine().then(function (g) {
      g.say('Need a hand with ' + G[c.id].name + '? A 20-second walk-through points at each button.', [
        { id: 'howto-offer-yes', label: 'Show me', primary: true, fn: function () { start(c.id); } },
        { id: 'howto-offer-no', label: 'No thanks' },
        { id: 'howto-offer-never', label: 'Don’t offer again', fn: function () { set('ppm-guide-off', 1); } }], 20000);
    }).catch(function () {});
  }, 1000);

  function injectCss() {
    if (document.getElementById('ppm-guide-css')) return;
    var css = '.hp-guide{position:fixed;inset:0;pointer-events:none;z-index:2147483000}' +
      '.hp-ring{position:fixed;display:none;border:3px solid #C14324;border-radius:14px;box-shadow:0 0 0 6px rgba(193,67,36,.22);transition:all .18s ease}' +
      '@media (prefers-reduced-motion:no-preference){.hp-ring{animation:hp-pulse 1.6s ease-in-out infinite}}@keyframes hp-pulse{50%{box-shadow:0 0 0 11px rgba(193,67,36,.12)}}' +
      '.hp-tip{position:fixed;pointer-events:none;background:#1C2321;color:#fff;border-radius:14px;padding:12px 14px 10px;box-shadow:0 12px 32px rgba(0,0,0,.3);font:15px/1.45 Inter,system-ui,sans-serif}' +
      '.hp-tip-text{margin:0 0 8px}.hp-tip-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}.hp-tip-count{font-size:.8rem;opacity:.75}' +
      '.hp-tip-quit{pointer-events:auto;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:6px 14px;min-height:36px;font:inherit;font-size:.85rem;cursor:pointer}' +
      '.hp-say{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483001;width:min(460px,calc(100vw - 24px));background:#1C2321;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 12px 32px rgba(0,0,0,.3);font:15px/1.45 Inter,system-ui,sans-serif}' +
      '.hp-say p{margin:0 0 10px}.hp-say-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}' +
      '.hp-say-btn{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:999px;padding:8px 16px;min-height:40px;font:inherit;font-weight:600;cursor:pointer}' +
      '.hp-say-btn.primary{background:#fff;color:#1C2321;border-color:#fff}';
    document.head.appendChild(el('style', { id: 'ppm-guide-css' }, css));
  }
  var pillCss = '.ppm-howto{display:inline-flex;align-items:center;gap:6px;margin:0 0 14px;padding:7px 14px;border-radius:999px;border:1px solid #0D7A7C;background:rgba(13,122,124,.08);color:#0D7A7C;font:600 .86rem/1.2 Inter,system-ui,sans-serif;cursor:pointer}' +
    '.ppm-howto:hover{background:rgba(13,122,124,.16)}@media (prefers-color-scheme:dark){.ppm-howto{color:#4FC3C5;border-color:#4FC3C5}}';
  document.head.appendChild(el('style', { id: 'ppm-howto-css' }, pillCss));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buttons); else buttons();
  window.PPMSiteHelper = { start: start, guides: G };
})();
