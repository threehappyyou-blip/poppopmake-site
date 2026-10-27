/* PopPopMake Vault — decorating a diary entry: pages (hourly, week + habits, to-do), paper and colour, lettering,
 * stickers and tape you can drag, turn and resize, and drawing with a finger or mouse.
 * Everything a person types is set with .value / textContent, never as HTML.
 */
(function (root) {
  'use strict';
  var ST = root.VaultStickers;
  var PENS = ['#3a3530', '#E8445A', '#F4A93B', '#4E9A5B', '#3D7DD8', '#8E6CC9'], SIZES = [2, 5, 10];

  // ctx: { h, add, icon, t, I, DY, entry, body (sheet body), page, ta, commit(deco, now), blobUrl(id), putBlob(id, bytes, type), uid(), toast(msg) }
  function attach(ctx) {
    var h = ctx.h, add = ctx.add, t = ctx.t, DY = ctx.DY, e = ctx.entry, page = ctx.page;
    var deco = e.deco ? JSON.parse(JSON.stringify(e.deco)) : { paper: 'plain', tint: 'none', font: 'base', tpl: DY.cleanDeco({ tpl: { on: 'todo' } }).tpl, stickers: [], drawing: null };
    deco.tpl.on = e.deco ? e.deco.tpl.on : null;
    var timer = null;
    function commit(now) {
      clearTimeout(timer);
      if (now) ctx.commit(deco); else timer = setTimeout(function () { ctx.commit(deco); }, 400);
    }
    function flush() { if (timer) { clearTimeout(timer); timer = null; ctx.commit(deco); } }

    // ----- the page itself -----
    var tplBox = h('div', { class: 'tpl', id: 'entry-tpl' });
    var drawImg = h('img', { class: 'draw-img', id: 'entry-drawing', alt: '', hidden: true });
    var layer = h('div', { class: 'st-layer', id: 'st-layer' });
    add(page, tplBox, drawImg, layer);
    function applyLook() {
      page.className = 'page paper-' + deco.paper + ' tint-' + deco.tint + ' font-' + deco.font;
    }
    function width() { return page.clientWidth || 320; }

    // ----- toolbar and panels -----
    var panel = h('div', { class: 'deco-panel', id: 'deco-panel', hidden: true });
    var current = null, btns = {};
    var bar = h('div', { class: 'deco-bar', role: 'toolbar', 'aria-label': t('deco.title') });
    [['page', '📄'], ['paper', '🎨'], ['font', '✍️'], ['stickers', '⭐'], ['draw', '🖍️']].forEach(function (x) {
      btns[x[0]] = h('button', { type: 'button', class: 'deco-btn', id: 'deco-' + x[0], 'aria-expanded': 'false', 'aria-controls': 'deco-panel',
        on: { click: function () { toggle(x[0]); } } }, h('span', { 'aria-hidden': 'true', text: x[1] }), h('span', { text: t('deco.' + x[0]) }));
      add(bar, btns[x[0]]);
    });
    function toggle(name) {
      if (drawing) finishDraw();
      if (current === name) name = null;
      current = name;
      Object.keys(btns).forEach(function (k) { btns[k].setAttribute('aria-expanded', k === name ? 'true' : 'false'); btns[k].classList.toggle('on', k === name); });
      panel.textContent = ''; panel.hidden = !name;
      if (name === 'page') panelPage(); else if (name === 'paper') panelPaper(); else if (name === 'font') panelFont();
      else if (name === 'stickers') panelStickers(); else if (name === 'draw') startDraw();
    }
    function chips(list, cur, label, onPick, extra) {
      var g = h('div', { class: 'chips wrap', role: 'radiogroup', 'aria-label': label });
      list.forEach(function (v) {
        var b = h('button', { type: 'button', role: 'radio', class: 'chip' + (v === cur ? ' on' : ''), 'aria-checked': v === cur ? 'true' : 'false', 'data-v': v,
          on: { click: function () { onPick(v); } } });
        if (extra) extra(b, v); else b.textContent = t(label === t('deco.paper') ? 'paper.' + v : v);
        add(g, b);
      });
      return g;
    }
    function panelPage() {
      add(panel, chips([null].concat(DY.TPLS), deco.tpl.on, t('deco.page'), function (v) { deco.tpl.on = v; drawTpl(); commit(true); toggle('page'); toggle('page'); },
        function (b, v) { b.textContent = t('tpl.' + (v || 'none')); b.setAttribute('data-v', v || 'none'); }));
    }
    function panelPaper() {
      add(panel, h('p', { class: 'field-label', text: t('deco.paper') }),
        chips(DY.PAPERS, deco.paper, t('deco.paper'), function (v) { deco.paper = v; applyLook(); commit(true); toggle('paper'); toggle('paper'); },
          function (b, v) { b.textContent = t('paper.' + v); b.classList.add('paper-chip', 'paper-' + v); }),
        h('p', { class: 'field-label', text: t('draw.color') }),
        chips(DY.TINTS, deco.tint, t('draw.color'), function (v) { deco.tint = v; applyLook(); commit(true); toggle('paper'); toggle('paper'); },
          function (b, v) { b.classList.add('tint-chip', 'tint-' + v); b.setAttribute('aria-label', t('tint.' + v)); b.title = t('tint.' + v); }));
    }
    function panelFont() {
      add(panel, chips(DY.FONTS, deco.font, t('deco.font'), function (v) { deco.font = v; applyLook(); commit(true); toggle('font'); toggle('font'); },
        function (b, v) { b.classList.add('font-chip', 'font-' + v); add(b, h('span', { class: 'font-name', text: t('font.' + v) }), h('span', { class: 'font-sample', text: t('font.sample') })); }));
    }
    var stTab = 'art';
    function panelStickers() {
      var tabs = h('div', { class: 'seg small', role: 'tablist' });
      [['art', 'st.tabArt'], ['tape', 'st.tabTape'], ['emoji', 'st.tabEmoji']].forEach(function (x) {
        add(tabs, h('button', { type: 'button', role: 'tab', id: 'st-tab-' + x[0], 'aria-selected': stTab === x[0] ? 'true' : 'false', class: stTab === x[0] ? 'on' : '', text: t(x[1]),
          on: { click: function () { stTab = x[0]; toggle('stickers'); toggle('stickers'); } } }));
      });
      var grid = h('div', { class: 'st-grid' + (stTab === 'tape' ? ' tapes' : ''), id: 'st-grid' });
      var keys = stTab === 'art' ? ST.ART.map(function (k) { return 'a:' + k; }) : stTab === 'tape' ? ST.TAPES.map(function (k) { return 't:' + k; }) : ST.EMOJI.map(function (k) { return 'e:' + k; });
      keys.forEach(function (k) {
        var el = ST.element(k); if (!el) return;
        add(grid, h('button', { type: 'button', class: 'st-pick', 'data-k': k, 'aria-label': nameOf(k), title: nameOf(k), on: { click: function () { addSticker(k); } } }, el));
      });
      add(panel, tabs, h('p', { class: 'hint', text: t('st.hint') }), grid);
    }
    function nameOf(k) {
      if (k.slice(0, 2) === 'a:') return t('st.' + k.slice(2));
      if (k.slice(0, 2) === 't:') return t('tape.' + k.slice(2));
      return k.slice(2);
    }

    // ----- pages: hourly, week (+ habit tracker), to-do -----
    function grow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
    function drawTpl() {
      tplBox.textContent = '';
      var tp = deco.tpl, on = tp.on;
      tplBox.hidden = !on; tplBox.className = 'tpl' + (on ? ' tpl-' + on : '');
      if (on === 'time') {
        DY.HOURS.forEach(function (hh) {
          var inp = h('input', { class: 'tpl-in', 'data-h': hh, value: tp.time[hh] || '', 'aria-label': t('time.label', { h: +hh }), maxlength: 300 });
          inp.addEventListener('input', function () { if (inp.value) tp.time[hh] = inp.value; else delete tp.time[hh]; commit(); });
          add(tplBox, h('label', { class: 'tpl-row' }, h('span', { class: 'tpl-h', text: hh }), inp));
        });
      } else if (on === 'week') {
        var mon = monday(e.date), fmt = new Intl.DateTimeFormat(ctx.I.locale(), { weekday: 'short', timeZone: 'UTC' });
        var days = h('div', { class: 'week-days' });
        for (var i = 0; i < 7; i++) (function (i) {
          var date = DY.addDays(mon, i), dt = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)));
          var ta = h('textarea', { class: 'tpl-in week-in', rows: 2, 'data-day': i, value: tp.week.days[i] || '', maxlength: 500, 'aria-label': fmt.format(dt) + ' ' + (+date.slice(5, 7)) + '/' + (+date.slice(8, 10)) });
          ta.addEventListener('input', function () { tp.week.days[i] = ta.value; grow(ta); commit(); });
          add(days, h('div', { class: 'week-day' + (date === e.date ? ' today' : '') }, h('span', { class: 'week-head', text: fmt.format(dt) + ' ' + (+date.slice(5, 7)) + '/' + (+date.slice(8, 10)) }), ta));
          setTimeout(function () { grow(ta); }, 0);
        })(i);
        var narrow = new Intl.DateTimeFormat(ctx.I.locale(), { weekday: 'narrow', timeZone: 'UTC' });
        var table = h('table', { class: 'habits', id: 'habits' });
        var head = h('tr', {}, h('th', { scope: 'col', text: t('week.habits') }));
        for (var d = 0; d < 7; d++) add(head, h('th', { scope: 'col', text: narrow.format(new Date(Date.UTC(2026, 9, 26 + d))) }));   // Oct 26 2026 is a Monday
        add(head, h('th', { 'aria-hidden': 'true' }));
        add(table, h('thead', {}, head));
        var tb = h('tbody', {});
        tp.week.habits.forEach(function (hb, r) {
          var name = h('input', { class: 'tpl-in habit-name', value: hb.name, placeholder: t('week.habitPh'), maxlength: 40, 'aria-label': t('week.habitPh') + ' ' + (r + 1) });
          name.addEventListener('input', function () { hb.name = name.value; commit(); });
          var tr = h('tr', {}, h('td', {}, name));
          hb.done.forEach(function (v, c) {
            var cb = h('input', { type: 'checkbox', class: 'habit-cb', checked: v, 'aria-label': (hb.name || t('week.habitPh')) + ' · ' + narrow.format(new Date(Date.UTC(2026, 9, 26 + c))) });
            cb.addEventListener('change', function () { hb.done[c] = cb.checked; commit(true); });
            add(tr, h('td', {}, cb));
          });
          add(tr, h('td', {}, h('button', { type: 'button', class: 'icon-btn xs', 'aria-label': t('week.removeHabit'), on: { click: function () { tp.week.habits.splice(r, 1); drawTpl(); commit(true); } } }, ctx.icon('x', 14))));
          add(tb, tr);
        });
        add(table, tb);
        add(tplBox, days, h('div', { class: 'habits-wrap' }, table),
          tp.week.habits.length < 6 ? h('button', { type: 'button', class: 'mini', id: 'habit-add', text: '+ ' + t('week.addHabit'), on: { click: function () {
            tp.week.habits.push({ name: '', done: [false, false, false, false, false, false, false] }); drawTpl(); commit(true);
            var ins = tplBox.querySelectorAll('.habit-name'); if (ins.length) ins[ins.length - 1].focus();
          } } }) : null);
      } else if (on === 'todo') {
        var ul = h('ul', { class: 'todo', id: 'todo' });
        tp.todo.forEach(function (it, i) {
          var cb = h('input', { type: 'checkbox', class: 'todo-cb', checked: it.done, 'aria-label': it.text || t('todo.ph') });
          var inp = h('input', { class: 'tpl-in todo-in' + (it.done ? ' done' : ''), value: it.text, placeholder: t('todo.ph'), maxlength: 200, 'aria-label': t('todo.ph') + ' ' + (i + 1) });
          cb.addEventListener('change', function () { it.done = cb.checked; inp.classList.toggle('done', it.done); commit(true); });
          inp.addEventListener('input', function () { it.text = inp.value; commit(); });
          inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); addTodo(i + 1); } });
          add(ul, h('li', {}, cb, inp, h('button', { type: 'button', class: 'icon-btn xs', 'aria-label': t('todo.remove'), on: { click: function () { tp.todo.splice(i, 1); drawTpl(); commit(true); } } }, ctx.icon('x', 14))));
        });
        add(tplBox, ul, tp.todo.length < 30 ? h('button', { type: 'button', class: 'mini', id: 'todo-add', text: '+ ' + t('todo.add'), on: { click: function () { addTodo(tp.todo.length); } } }) : null);
      }
      placeStickers();
    }
    function addTodo(at) {
      if (deco.tpl.todo.length >= 30) return;
      deco.tpl.todo.splice(at, 0, { text: '', done: false }); drawTpl(); commit(true);
      var ins = tplBox.querySelectorAll('.todo-in'); if (ins[at]) ins[at].focus();
    }
    function monday(date) {
      var d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay();
      return DY.addDays(date, -((d + 6) % 7));
    }

    // ----- stickers -----
    var selected = -1, tools = null;
    function addSticker(k) {
      if (deco.stickers.length >= DY.MAX_STICKERS) { ctx.toast(t('st.limit', { n: DY.MAX_STICKERS })); return; }
      var W = width(), r = page.getBoundingClientRect(), vh = root.innerHeight || 800;
      var top = Math.max(r.top, 0), bottom = Math.min(r.bottom, vh), mid = (top < bottom ? (top + bottom) / 2 : r.top + Math.min(r.height, vh) / 2) - r.top;
      var n = deco.stickers.length % 6, xs = [0.78, 0.26, 0.6, 0.18, 0.7, 0.42];   // spread new stickers so they don't pile up
      deco.stickers.push({ k: k, x: k.charAt(0) === 't' ? 0.5 : xs[n], y: Math.max(0.12, mid / W + (n % 3) * 0.07), s: k.charAt(0) === 't' ? 0.42 : 0.18, r: k.charAt(0) === 't' ? -8 : 0 });
      selected = deco.stickers.length - 1;
      placeStickers(); commit(true);
      var el = layer.querySelector('[data-i="' + selected + '"]'); if (el) el.focus();
    }
    function placeStickers() {
      layer.textContent = ''; tools = null;
      var W = width();
      deco.stickers.forEach(function (st, i) {
        var art = ST.element(st.k); if (!art) return;
        var tape = st.k.charAt(0) === 't', size = st.s * W;
        var el = h('div', { class: 'sticker' + (tape ? ' tape' : '') + (i === selected ? ' sel' : ''), 'data-i': i, 'data-k': st.k, tabindex: 0, role: 'button', 'aria-label': t('st.label', { name: nameOf(st.k) }) }, art);
        el.style.width = size + 'px'; el.style.height = (tape ? size / 4 : size) + 'px';
        el.style.left = (st.x * W - size / 2) + 'px'; el.style.top = (st.y * W - (tape ? size / 8 : size / 2)) + 'px';
        el.style.transform = 'rotate(' + st.r + 'deg)';
        if (st.k.charAt(0) === 'e') el.style.fontSize = (size * 0.82) + 'px';
        drag(el, i);
        el.addEventListener('keydown', function (ev) { keys(ev, i); });
        add(layer, el);
      });
      // keep the page tall enough for stickers placed below the text
      var need = 0; deco.stickers.forEach(function (st) { need = Math.max(need, (st.y + st.s / 2) * W + 8); });
      page.style.minHeight = need ? need + 'px' : '';
      if (selected >= 0 && deco.stickers[selected]) showTools();
    }
    function select(i) { selected = i; layer.querySelectorAll('.sticker').forEach(function (el) { el.classList.toggle('sel', +el.getAttribute('data-i') === i); }); if (tools) { tools.remove(); tools = null; } if (i >= 0) showTools(); }
    function showTools() {
      var st = deco.stickers[selected], W = width();
      var tb = function (label, txt, fn, id) { return h('button', { type: 'button', class: 'st-tool', id: id, 'aria-label': label, title: label, text: txt, on: { click: function (ev) { ev.stopPropagation(); fn(); } } }); };
      tools = h('div', { class: 'st-tools', id: 'st-tools', role: 'toolbar', 'aria-label': nameOf(st.k) },
        tb(t('st.smaller'), '−', function () { resize(selected, 1 / 1.18); }, 'st-smaller'),
        tb(t('st.bigger'), '+', function () { resize(selected, 1.18); }, 'st-bigger'),
        tb(t('st.left'), '↺', function () { turn(selected, -15); }, 'st-left'),
        tb(t('st.right'), '↻', function () { turn(selected, 15); }, 'st-right'),
        tb(t('st.front'), '⤒', function () { front(selected); }, 'st-front'),
        tb(t('st.remove'), '🗑', function () { removeSticker(selected); }, 'st-remove'));
      var y = st.y * W - st.s * W / 2 - 46;
      tools.style.top = Math.max(0, y) + 'px';
      tools.style.left = Math.min(Math.max(0, st.x * W - 120), Math.max(0, W - 240)) + 'px';
      tools.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      add(layer, tools);
    }
    function resize(i, f) { var st = deco.stickers[i]; st.s = Math.min(0.8, Math.max(0.05, st.s * f)); placeStickers(); commit(); refocus(i); }
    function turn(i, d) { var st = deco.stickers[i]; st.r = ((st.r + d + 540) % 360) - 180; placeStickers(); commit(); refocus(i); }
    function front(i) { var st = deco.stickers.splice(i, 1)[0]; deco.stickers.push(st); selected = deco.stickers.length - 1; placeStickers(); commit(); refocus(selected); }
    function removeSticker(i) { deco.stickers.splice(i, 1); selected = -1; placeStickers(); commit(true); }
    function refocus(i) { var el = layer.querySelector('.sticker[data-i="' + i + '"]'); if (el) el.focus(); }
    function keys(ev, i) {
      var st = deco.stickers[i], step = ev.shiftKey ? 0.08 : 0.02, k = ev.key;
      if (k === 'ArrowLeft') st.x = Math.max(0, st.x - step); else if (k === 'ArrowRight') st.x = Math.min(1, st.x + step);
      else if (k === 'ArrowUp') st.y = Math.max(0, st.y - step); else if (k === 'ArrowDown') st.y = st.y + step;
      else if (k === '+' || k === '=') return (ev.preventDefault(), resize(i, 1.18));
      else if (k === '-') return (ev.preventDefault(), resize(i, 1 / 1.18));
      else if (k === 'Delete' || k === 'Backspace') return (ev.preventDefault(), removeSticker(i));
      else if (k === 'Enter' || k === ' ') { ev.preventDefault(); select(i); return; }
      else return;
      ev.preventDefault(); selected = i; placeStickers(); commit(); refocus(i);
    }
    function drag(el, i) {
      el.addEventListener('pointerdown', function (ev) {
        if (drawing) return;
        ev.preventDefault(); ev.stopPropagation();
        if (selected !== i) select(i);
        var st = deco.stickers[i], W = width(), sx = ev.clientX, sy = ev.clientY, ox = st.x, oy = st.y, moved = false;
        try { el.setPointerCapture(ev.pointerId); } catch (x) {}
        function mv(m) {
          var dx = (m.clientX - sx) / W, dy = (m.clientY - sy) / W;
          if (Math.abs(dx) + Math.abs(dy) > 0.004) moved = true;
          st.x = Math.min(1, Math.max(0, ox + dx)); st.y = Math.max(0, oy + dy);
          var size = st.s * W, tape = st.k.charAt(0) === 't';
          el.style.left = (st.x * W - size / 2) + 'px'; el.style.top = (st.y * W - (tape ? size / 8 : size / 2)) + 'px';
          if (tools) tools.hidden = true;
        }
        function up() {
          el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
          if (moved) { placeStickers(); commit(); refocus(i); } else if (tools) tools.hidden = false;
        }
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    }
    page.addEventListener('pointerdown', function (ev) { if (!drawing && selected >= 0 && !ev.target.closest('.sticker,.st-tools')) select(-1); });

    // ----- drawing -----
    var drawing = null;
    function startDraw() {
      select(-1);
      var W = width(), H = Math.max(page.scrollHeight, deco.drawing ? W * deco.drawing.ar : 0, 200);
      var ratio = Math.min(2, 1600 / W, root.devicePixelRatio || 1);
      var cv = h('canvas', { class: 'draw-canvas', id: 'draw-canvas', 'aria-label': t('deco.draw') });
      cv.width = Math.round(W * ratio); cv.height = Math.round(H * ratio); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      page.style.minHeight = H + 'px';
      var g = cv.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round';
      drawing = { cv: cv, g: g, ratio: ratio, strokes: [], base: null, cleared: false, color: PENS[0], size: 1, erase: false, changed: false };
      if (deco.drawing && !drawImg.hidden && drawImg.complete && drawImg.naturalWidth) drawing.base = drawImg;
      drawImg.hidden = true;
      redraw();
      var cur = null;
      cv.addEventListener('pointerdown', function (ev) {
        ev.preventDefault(); try { cv.setPointerCapture(ev.pointerId); } catch (x) {}
        var r = cv.getBoundingClientRect();
        cur = { c: drawing.color, w: SIZES[drawing.size], er: drawing.erase, pts: [[ev.clientX - r.left, ev.clientY - r.top]] };
        drawing.strokes.push(cur); drawing.changed = true; redraw();
      });
      cv.addEventListener('pointermove', function (ev) { if (!cur) return; var r = cv.getBoundingClientRect(); cur.pts.push([ev.clientX - r.left, ev.clientY - r.top]); redraw(); });
      ['pointerup', 'pointercancel'].forEach(function (n) { cv.addEventListener(n, function () { cur = null; }); });
      add(page, cv);
      drawPanel();
    }
    function redraw() {
      var d = drawing, g = d.g, r = d.ratio;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, d.cv.width, d.cv.height);
      if (d.base && !d.cleared) g.drawImage(d.base, 0, 0, d.cv.width, d.cv.width * deco.drawing.ar);
      g.setTransform(r, 0, 0, r, 0, 0);
      d.strokes.forEach(function (s) {
        g.globalCompositeOperation = s.er ? 'destination-out' : 'source-over';
        g.strokeStyle = s.c; g.lineWidth = s.er ? s.w * 3 : s.w; g.beginPath();
        s.pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
        if (s.pts.length === 1) g.lineTo(s.pts[0][0] + 0.1, s.pts[0][1] + 0.1);
        g.stroke();
      });
      g.globalCompositeOperation = 'source-over';
    }
    function drawPanel() {
      var d = drawing;
      var colors = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t('draw.color') });
      PENS.forEach(function (c, i) {
        var b = h('button', { type: 'button', role: 'radio', class: 'pen-chip' + (!d.erase && d.color === c ? ' on' : ''), 'aria-checked': !d.erase && d.color === c ? 'true' : 'false', 'data-pen': i, 'aria-label': t('draw.pen') + ' ' + (i + 1),
          on: { click: function () { d.color = c; d.erase = false; panel.textContent = ''; drawPanel(); } } });
        b.style.background = c; add(colors, b);
      });
      var sizes = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': t('draw.size') });
      ['draw.thin', 'draw.mid', 'draw.thick'].forEach(function (k, i) {
        add(sizes, h('button', { type: 'button', role: 'radio', class: 'chip' + (d.size === i ? ' on' : ''), 'aria-checked': d.size === i ? 'true' : 'false', 'data-size': i, text: t(k),
          on: { click: function () { d.size = i; panel.textContent = ''; drawPanel(); } } }));
      });
      add(panel, colors, sizes, h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn small' + (d.erase ? ' on' : ''), id: 'draw-eraser', 'aria-pressed': d.erase ? 'true' : 'false', text: t('draw.eraser'), on: { click: function () { d.erase = !d.erase; panel.textContent = ''; drawPanel(); } } }),
        h('button', { type: 'button', class: 'btn small', id: 'draw-undo', text: t('draw.undo'), on: { click: function () { d.strokes.pop(); d.changed = true; redraw(); } } }),
        h('button', { type: 'button', class: 'btn small', id: 'draw-clear', text: t('draw.clear'), on: { click: function () { d.strokes = []; d.cleared = true; d.changed = true; redraw(); } } }),
        h('button', { type: 'button', class: 'btn small primary', id: 'draw-done', text: t('draw.done'), on: { click: function () { toggle('draw'); } } })));
    }
    // Saves the drawing as an encrypted PNG (a new picture each time; the old one is removed at the next unlock).
    function finishDraw() {
      var d = drawing; drawing = null;
      d.cv.remove();
      if (!d.changed) { showDrawing(); return Promise.resolve(); }
      var empty = (d.cleared || !d.base) && !d.strokes.some(function (s) { return !s.er; });
      if (empty) { deco.drawing = null; showDrawing(); commit(true); return Promise.resolve(); }
      ctx.status(t('draw.saving'));
      return new Promise(function (res) { d.cv.toBlob(res, 'image/png'); }).then(function (b) { return b.arrayBuffer(); }).then(function (buf) {
        var id = 'd' + ctx.uid();
        return ctx.putBlob(id, new Uint8Array(buf), 'image/png').then(function () {
          deco.drawing = { id: id, ar: d.cv.height / d.cv.width }; commit(true); showDrawing(); ctx.status('');
        });
      }).catch(function () { ctx.status(t('draw.err'), true); showDrawing(); });
    }
    function showDrawing() {
      if (!deco.drawing) { drawImg.hidden = true; drawImg.removeAttribute('src'); return; }
      ctx.blobUrl(deco.drawing.id).then(function (u) { if (u) { drawImg.src = u; drawImg.hidden = false; } }).catch(function () {});
    }

    applyLook(); drawTpl(); showDrawing();
    if (root.ResizeObserver) { var lastW = 0; new root.ResizeObserver(function () { var w = width(); if (w !== lastW) { lastW = w; placeStickers(); } }).observe(page); }
    return {
      bar: bar, panel: panel,
      flush: function () { if (drawing) return finishDraw().then(flush); flush(); return Promise.resolve(); },
      deco: function () { return deco; }
    };
  }

  // A small preview for the diary list: first stickers of an entry.
  function preview(e, h, n) {
    if (!e.deco || !e.deco.stickers.length) return null;
    var box = h('span', { class: 'entry-stickers', 'aria-hidden': 'true' });
    e.deco.stickers.slice(0, n || 3).forEach(function (st) { var el = ST.element(st.k); if (el) box.appendChild(el); });
    return box;
  }
  root.VaultDeco = { attach: attach, preview: preview };
})(typeof window !== 'undefined' ? window : globalThis);
