/* The free calendar-wallpaper page: pick a scene, month, phone and layout; the picture is drawn on this device. */
(function () {
  'use strict';
  var CV = window.VaultCovers, CW = window.PPMCalWall;
  var I = JSON.parse(document.getElementById('cw-i18n').textContent), lang = document.documentElement.lang || 'en';
  var now = new Date(), st = { art: 'moonsea', tone: 'none', fx: 0.5, year: now.getFullYear(), month: now.getMonth(), size: 'iphone', layout: 'middle', card: 'glass', weekStart: lang === 'ja' ? 1 : 0, line: '', today: true };
  try { var saved = JSON.parse(localStorage.getItem('ppm-calwall') || 'null'); if (saved && typeof saved === 'object') ['art', 'tone', 'size', 'layout', 'card', 'weekStart'].forEach(function (k) { if (saved[k] != null) st[k] = saved[k]; }); } catch (e) {}
  if (CV.IDS.indexOf(st.art) < 0) st.art = 'moonsea';
  var $ = function (id) { return document.getElementById(id); };
  var preview = $('cw-preview'), busy = false, again = false, timer = null;
  function el(tag, attrs, kids) { var e = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'on') e.addEventListener('click', attrs[k]); else e.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (k) { if (k) e.appendChild(k); }); return e; }
  function remember() { try { localStorage.setItem('ppm-calwall', JSON.stringify({ art: st.art, tone: st.tone, size: st.size, layout: st.layout, card: st.card, weekStart: st.weekStart })); } catch (e) {} }
  function chips(box, list, key, label) {
    box.textContent = '';
    list.forEach(function (v) {
      var on = st[key] === v[0];
      box.appendChild(el('button', { type: 'button', class: 'cw-chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-v': String(v[0]), text: v[1], on: function () { st[key] = v[0]; remember(); drawControls(); schedule(); } }));
    });
    box.setAttribute('aria-label', label);
  }
  function drawScenes() {
    var box = $('cw-scenes'); box.textContent = '';
    CV.IDS.forEach(function (id) {
      var on = st.art === id, mini = el('span', { class: 'cw-mini' }); mini.appendChild(CV.element(id));
      box.appendChild(el('button', { type: 'button', class: 'cw-scene' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-art': id, title: I.scenes[id] || id,
        on: function () { st.art = id; st.fx = 0.5; $('cw-fx').value = 50; remember(); drawScenes(); schedule(); } }, [mini, el('span', { class: 'cw-sname', text: I.scenes[id] || id })]));
    });
  }
  function drawControls() {
    $('cw-month-label').textContent = lang === 'en' ? CW.LANG.en.months[st.month] + ' ' + st.year : CW.LANG[lang].sub(st.year, st.month);
    chips($('cw-sizes'), Object.keys(CW.SIZES).map(function (k) { return [k, I.sizes[k] || CW.SIZES[k].label]; }), 'size', I.size);
    chips($('cw-layouts'), [['top', I.top], ['middle', I.middle], ['bottom', I.bottom]], 'layout', I.layout);
    chips($('cw-cards'), [['glass', I.glass], ['clear', I.clear]], 'card', I.card);
    chips($('cw-weeks'), [[0, I.sun], [1, I.mon]], 'weekStart', I.week);
    chips($('cw-tones'), CV.TONE_IDS.map(function (k) { return [k, I.tones[k] || k]; }), 'tone', I.tone);
    $('cw-layout-row').hidden = st.size === 'desktop';
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(draw, 120); }
  function opts() {
    var thisMonth = st.year === now.getFullYear() && st.month === now.getMonth();
    return { art: st.art, tone: st.tone, fx: st.fx, year: st.year, month: st.month, lang: lang, size: st.size, layout: st.layout, card: st.card, weekStart: st.weekStart, line: st.line, today: st.today && thisMonth ? now.getDate() : 0 };
  }
  function draw() {
    if (busy) { again = true; return; }
    busy = true; preview.classList.add('busy');
    CW.render(opts()).then(function (cv) {
      preview.textContent = ''; cv.className = 'cw-canvas'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', I.previewLabel);
      preview.classList.toggle('desk', st.size === 'desktop'); preview.appendChild(cv);
    }).catch(function () {}).then(function () { busy = false; preview.classList.remove('busy'); if (again) { again = false; draw(); } });
  }
  function download() {
    var btn = $('cw-download'); btn.disabled = true; btn.textContent = I.making;
    CW.render(opts()).then(CW.toBlob).then(function (blob) {
      var a = el('a', { href: URL.createObjectURL(blob), download: 'poppopmake-calendar-' + st.year + '-' + String(st.month + 1).padStart(2, '0') + '-' + st.size + '.png' });
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      $('cw-done').hidden = false;
    }).catch(function () { alert(I.fail); }).then(function () { btn.disabled = false; btn.textContent = I.download; });
  }
  $('cw-prev').addEventListener('click', function () { st.month--; if (st.month < 0) { st.month = 11; st.year--; } drawControls(); schedule(); });
  $('cw-next').addEventListener('click', function () { st.month++; if (st.month > 11) { st.month = 0; st.year++; } drawControls(); schedule(); });
  $('cw-fx').addEventListener('input', function () { st.fx = +this.value / 100; schedule(); });
  $('cw-line').addEventListener('input', function () { st.line = this.value.slice(0, 40); schedule(); });
  $('cw-today').addEventListener('change', function () { st.today = this.checked; schedule(); });
  $('cw-download').addEventListener('click', download);
  var start = new URLSearchParams(location.search);
  if (start.get('m') === 'next') { st.month++; if (st.month > 11) { st.month = 0; st.year++; } }
  if (CV.IDS.indexOf(start.get('scene')) >= 0) st.art = start.get('scene');
  drawScenes(); drawControls(); draw();
})();
