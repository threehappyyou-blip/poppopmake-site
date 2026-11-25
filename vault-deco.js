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
    var INSERTS = { saving24: 1, saving52: 1, grocery: 1, recipe: 1, pricebook: 1, feeling: 1, comic4: 1, envelope100: 1, letter: 1, pilsa: 1 };
    var tplBox = h('div', { class: 'tpl', id: 'entry-tpl' });
    var drawImg = h('img', { class: 'draw-img', id: 'entry-drawing', alt: '', hidden: true });
    var layer = h('div', { class: 'st-layer', id: 'st-layer' });
    add(page, tplBox, drawImg, layer);
    function applyLook() {
      page.className = 'page paper-' + deco.paper + ' tint-' + deco.tint + ' font-' + deco.font + (ctx.lookClass ? ' ' + ctx.lookClass() : '') + (INSERTS[deco.tpl && deco.tpl.on] ? ' has-insert' : '');
    }
    function width() { return page.clientWidth || 320; }

    // ----- toolbar and panels -----
    var panel = h('div', { class: 'deco-panel', id: 'deco-panel', hidden: true });
    var current = null, btns = {};
    var bar = h('div', { class: 'deco-bar', role: 'toolbar', 'aria-label': t('deco.title') });
    [['page', 'dpage'], ['paper', 'dpaper'], ['font', 'dfont'], ['stickers', 'dsticker'], ['draw', 'ddraw']].filter(function (x) { return !ctx.parts || ctx.parts.indexOf(x[0]) >= 0; }).forEach(function (x) {
      btns[x[0]] = h('button', { type: 'button', class: 'deco-btn', id: 'deco-' + x[0], 'aria-expanded': 'false', 'aria-controls': 'deco-panel',
        on: { click: function () { toggle(x[0]); } } }, ctx.icon(x[1], 19), h('span', { text: t('deco.' + x[0]) }));
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
    function tileGrid() { var g = chips.apply(null, arguments); g.classList.add('paper-grid'); return g; }
    function panelPage() {
      add(panel, chips([null].concat(DY.TPLS), deco.tpl.on, t('deco.page'), function (v) { deco.tpl.on = v; drawTpl(); commit(true); toggle('page'); toggle('page'); },
        function (b, v) { b.textContent = t('tpl.' + (v || 'none')); b.setAttribute('data-v', v || 'none'); }));
    }
    function panelPaper() {
      add(panel, h('p', { class: 'field-label', text: t('deco.paper') }),
        tileGrid(DY.PAPERS, deco.paper, t('deco.paper'), function (v) { deco.paper = v; applyLook(); commit(true); toggle('paper'); toggle('paper'); },
          function (b, v) { b.classList.add('paper-chip', 'paper-tile', 'paper-' + v, 'tint-' + deco.tint); add(b, h('span', { class: 'paper-name', text: t('paper.' + v) })); }),
        ctx.noTint ? null : h('p', { class: 'field-label', text: t('draw.color') }),
        ctx.noTint ? null : chips(DY.TINTS, deco.tint, t('draw.color'), function (v) { deco.tint = v; applyLook(); commit(true); toggle('paper'); toggle('paper'); },
          function (b, v) { b.classList.add('tint-chip', 'tint-' + v); b.setAttribute('aria-label', t('tint.' + v)); b.title = t('tint.' + v); }));
    }
    function panelFont() {
      add(panel, chips(DY.FONTS, deco.font, t('deco.font'), function (v) { deco.font = v; applyLook(); commit(true); toggle('font'); toggle('font'); },
        function (b, v) { b.classList.add('font-chip', 'font-' + v); add(b, h('span', { class: 'font-name', text: t('font.' + v) }), h('span', { class: 'font-sample', text: t('font.sample') })); }));
    }
    var stTab = 'deco';
    function seasonKeys() {             // the pack for this time of year comes first
      var m = new Date().getMonth() + 1, order = (m === 12 || m <= 2) ? ['newyear', 'winter'] : ['winter', 'newyear'];
      if (m === 12 && new Date().getDate() <= 26) order = ['winter', 'newyear'];
      var out = []; order.forEach(function (sn) { (ST.SEASONS[sn] || []).forEach(function (k) { out.push('a:ss' + k); }); });
      return out.concat((ST.SEASON_TAPES || []).map(function (k) { return 't:' + k; }));
    }
    function photoSticker() {           // cut a sticker from one of your photos: a circle, a rounded square or a heart, with a white edge
      var inp = h('input', { type: 'file', accept: 'image/*', hidden: true });
      inp.addEventListener('change', function () {
        var file = inp.files && inp.files[0]; if (!file) return;
        var url = URL.createObjectURL(file), im = new root.Image();
        im.onload = function () {
          var shape = 'circle', box = h('div', { class: 'ps-maker', id: 'ps-maker' }), cv = h('canvas', { width: 512, height: 512, class: 'ps-canvas' });
          function draw() {
            var c = cv.getContext('2d'), S = 512, pad = 26; c.clearRect(0, 0, S, S);
            function path(inset) {
              var a = inset, b = S - inset; c.beginPath();
              if (shape === 'circle') c.arc(S / 2, S / 2, S / 2 - inset, 0, Math.PI * 2);
              else if (shape === 'round') { var r = 90; c.moveTo(a + r, a); c.arcTo(b, a, b, b, r); c.arcTo(b, b, a, b, r); c.arcTo(a, b, a, a, r); c.arcTo(a, a, b, a, r); }
              else { var w = b - a; c.moveTo(S / 2, a + w * .92); c.bezierCurveTo(a - w * .1, a + w * .5, a + w * .05, a - w * .05, S / 2, a + w * .26); c.bezierCurveTo(b - w * .05, a - w * .05, b + w * .1, a + w * .5, S / 2, a + w * .92); }
              c.closePath();
            }
            c.save(); c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 14; c.shadowOffsetY = 4; path(pad - 14); c.fillStyle = '#fff'; c.fill(); c.restore();
            c.save(); path(pad); c.clip(); var sc = Math.max((S - 2 * pad) / im.width, (S - 2 * pad) / im.height), w2 = im.width * sc, h2 = im.height * sc; c.drawImage(im, (S - w2) / 2, (S - h2) / 2, w2, h2); c.restore();
          }
          var shapes = h('div', { class: 'chips', id: 'ps-shapes' });
          [['circle', '●'], ['round', '▢'], ['heart', '♥']].forEach(function (x) { add(shapes, h('button', { type: 'button', class: 'chip' + (shape === x[0] ? ' on' : ''), 'data-shape': x[0], id: 'ps-' + x[0], text: x[1] + ' ' + t('ps.' + x[0]),
            on: { click: function () { shape = x[0]; shapes.querySelectorAll('button').forEach(function (b2) { b2.classList.toggle('on', b2.getAttribute('data-shape') === shape); }); draw(); } } })); });
          var go = h('button', { type: 'button', class: 'btn primary small', id: 'ps-add', text: t('ps.add'), on: { click: function () {
            go.disabled = true;
            cv.toBlob(function (blob) { blob.arrayBuffer().then(function (buf) { var id = 'ps' + ctx.uid(); return ctx.putBlob(id, new Uint8Array(buf), 'image/png').then(function () { box.remove(); addSticker('p:' + id); }); }).catch(function () { go.disabled = false; ctx.toast(t('ps.err')); }); }, 'image/png');
          } } });
          add(box, cv, shapes, h('div', { class: 'row' }, go, h('button', { type: 'button', class: 'btn small', text: t('btn.cancel'), on: { click: function () { box.remove(); } } })), h('p', { class: 'hint', text: t('ps.private') }));
          var old = panel.querySelector('#ps-maker'); if (old) old.remove(); panel.insertBefore(box, panel.firstChild); draw(); URL.revokeObjectURL(url);
        };
        im.onerror = function () { ctx.toast(t('ps.err')); URL.revokeObjectURL(url); };
        im.src = url;
      });
      document.body.appendChild(inp); inp.click(); setTimeout(function () { inp.remove(); }, 60000);
    }
    function stickerArt(k) {             // drawn stickers are SVG; photo stickers are a picture read from the encrypted store
      if (k.slice(0, 2) !== 'p:') return ST.element(k);
      var img = h('img', { class: 'st-photo', alt: '' }); if (ctx.blobUrl) ctx.blobUrl(k.slice(2)).then(function (u) { if (u) img.src = u; }).catch(function () {}); return img;
    }
    function panelStickers() {
      var tabs = h('div', { class: 'seg small', role: 'tablist' });
      var rec = recentKeys();
      (rec.length ? [['recent', 'st.tabRecent']] : []).concat([['season', 'st.tabSeason'], ['xmas', 'st.tabXmas'], ['friends', 'st.tabFriends'], ['daily', 'st.tabDaily'], ['fancy', 'st.tabFancy'], ['dates', 'st.tabDates'], ['deco', 'st.tabDeco'], ['aes', 'st.tabAes'], ['label', 'st.tabLabel'], ['doodle', 'st.tabDoodle'], ['paper', 'st.tabPaper'], ['feel', 'st.tabFeel'], ['food', 'st.tabFood'], ['money', 'st.tabMoney'], ['art', 'st.tabArt'], ['tape', 'st.tabTape'], ['emoji', 'st.tabEmoji'], ['seal', 'st.tabSeal']]).forEach(function (x) {
        add(tabs, h('button', { type: 'button', role: 'tab', id: 'st-tab-' + x[0], 'aria-selected': stTab === x[0] ? 'true' : 'false', class: stTab === x[0] ? 'on' : '', text: t(x[1]),
          on: { click: function () { stTab = x[0]; toggle('stickers'); toggle('stickers'); } } }));
      });
      var grid = h('div', { class: 'st-grid' + (stTab === 'tape' ? ' tapes' : ''), id: 'st-grid' });
      if (stTab === 'recent' && !rec.length) stTab = 'deco';
      var pre = { recent: rec, label: (ST.LABEL || []).map(function (k) { return 'a:lb' + k; }), doodle: (ST.DOODLE || []).map(function (k) { return 'a:dd' + k; }),
        paper: (ST.PAPER || []).map(function (k) { return 'a:pp' + k; }), friends: (ST.FRIENDS || []).map(function (k) { return 'a:ld' + k; }).concat((ST.FRIEND_TAPES || []).map(function (k) { return 't:' + k; })), daily: (ST.DAILY || []).map(function (k) { return 'a:dy' + k; }).concat((ST.DAILY_TAPES || []).map(function (k) { return 't:' + k; })), fancy: (ST.FANCY || []).map(function (k) { return 'a:dy' + k; }).concat((ST.FANCY_TAPES || []).map(function (k) { return 't:' + k; })), dates: (ST.DATES || []).map(function (k) { return 'a:dy' + k; }), xmas: (ST.XMAS || []).map(function (k) { return 'a:xm' + k; }).concat((ST.XMAS_TAPES || []).map(function (k) { return 't:' + k; })), money: (ST.MONEY || []).map(function (k) { return 'a:mn' + k; }) }[stTab];
      var keys = pre ? pre : stTab === 'food' ? (ST.FOOD || []).map(function (k) { return 'a:fd' + k; }) : stTab === 'feel' ? (ST.FEEL || []).map(function (k) { return 'a:em' + k; }) : stTab === 'season' ? seasonKeys() : stTab === 'aes' ? (ST.AES || []).map(function (k) { return 'a:ae' + k; }).concat((ST.AES_TAPES || []).map(function (k) { return 't:' + k; })) : stTab === 'deco' ? ST.DECO.map(function (k) { return 'a:' + k; }).concat(ST.DECO_TAPES.map(function (k) { return 't:' + k; })) : stTab === 'art' ? ST.ART.map(function (k) { return 'a:' + k; }) : stTab === 'tape' ? ST.TAPES.map(function (k) { return 't:' + k; }) :
        stTab === 'seal' ? (ctx.seals ? ctx.seals() : []).map(function (k) { return 's:' + k; }) : ST.EMOJI.map(function (k) { return 'e:' + k; });
      keys.forEach(function (k) {
        var el = ST.element(k); if (!el) return;
        add(grid, h('button', { type: 'button', class: 'st-pick', 'data-k': k, 'aria-label': nameOf(k), title: nameOf(k), on: { click: function () { addSticker(k); } } }, el));
      });
      var photoBtn = ctx.putBlob && ctx.uid ? h('button', { type: 'button', class: 'mini ps-open', id: 'ps-open', text: '📷 ' + t('ps.open'), on: { click: photoSticker } }) : null;
      var auto = h('div', { class: 'st-auto-row' }, h('button', { type: 'button', class: 'btn small primary st-auto', id: 'st-auto', text: '✨ ' + t(autoSet.length ? 'st.autoAgain' : 'st.auto'), on: { click: autoDecorate } }),
        autoSet.length ? h('button', { type: 'button', class: 'mini', id: 'st-auto-clear', text: t('st.autoClear'), on: { click: function () { clearAuto(); placeStickers(); commit(true); toggle('stickers'); toggle('stickers'); } } }) : null);
      add(panel, auto, tabs, h('p', { class: 'hint', text: stTab === 'recent' ? t('st.recentHint') : stTab === 'label' ? t('st.labelHint') : stTab === 'seal' ? (keys.length ? t('st.sealHint') : t('st.sealNone')) : stTab === 'season' ? t('st.seasonHint') : t('st.hint') }), photoBtn, grid,
        ctx.shopUrl ? h('a', { class: 'st-shop', id: 'st-shop', href: ctx.shopUrl, target: '_blank', rel: 'noopener', text: '🎀 ' + t('st.shop') }) : null);
    }
    function nameOf(k) {
      if (k.slice(0, 4) === 'a:em') return t('tf.feel.' + k.slice(4));
      if (k.slice(0, 4) === 'a:ss') return t('ss.' + k.slice(4));
      if (k.slice(0, 2) === 'p:') return t('ps.name');
      if (k.slice(0, 4) === 'a:ae') return t('aes.' + k.slice(4));
      if (k.slice(0, 4) === 'a:lb') return k.slice(4).toUpperCase();
      if (/^a:(dd|mn|pp)/.test(k)) return t('st2.' + k.slice(4));
      if (/^a:dydate\d/.test(k)) return t('st3.date') + ' ' + k.slice(8);
      if (/^a:(ld|dy|xm)/.test(k)) return t('st3.' + k.slice(4));
      if (k.slice(0, 2) === 'a:') return t('st.' + k.slice(2));
      if (k.slice(0, 2) === 't:') return t('tape.' + k.slice(2));
      if (k.slice(0, 2) === 's:') return t('seal.' + k.slice(2));
      return k.slice(2);
    }

    // ----- pages: hourly, week (+ habit tracker), to-do -----
    function grow(ta) { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
    function drawTpl() {
      tplBox.textContent = '';
      var tp = deco.tpl, on = tp.on;
      tplBox.hidden = !on; tplBox.className = 'tpl' + (on ? ' tpl-' + on : '');
      // a planner insert is the page itself: it sits above the writing, which shrinks to a memo line
      var anchor = page.firstChild === tplBox ? tplBox.nextSibling : page.firstChild;   // the writing (a textarea, or the note's wrapper)
      if (anchor && anchor !== drawImg) page.insertBefore(tplBox, INSERTS[on] ? anchor : anchor.nextSibling);
      page.classList.toggle('has-insert', !!INSERTS[on]);
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
      } else if (on === 'thanks') {
        add(tplBox, h('p', { class: 'tpl-title', text: t('thanks.title') }));
        tp.thanks = tp.thanks || ['', '', ''];
        [0, 1, 2].forEach(function (i) {
          var inp = h('input', { class: 'tpl-in thanks-in', 'data-i': i, value: tp.thanks[i] || '', placeholder: t('thanks.ph' + (i + 1)), maxlength: 200, 'aria-label': t('thanks.title') + ' ' + (i + 1) });
          inp.addEventListener('input', function () { tp.thanks[i] = inp.value; commit(); });
          add(tplBox, h('label', { class: 'tpl-row thanks-row' }, h('span', { class: 'thanks-n', 'aria-hidden': 'true', text: '♥ ' + (i + 1) }), inp));
        });
      } else if (DY.FORMS[on]) {
        drawForm(on);
      } else if (on === 'money') {
        var m = ctx.moneyDay ? ctx.moneyDay(e.date) : null;
        add(tplBox, h('p', { class: 'tpl-title', text: t('mday.title') }));
        if (m && m.items.length) {
          add(tplBox, h('ul', { class: 'mday-list', id: 'mday-list' }, m.items.map(function (x) {
            return h('li', { class: x.waste ? 'waste' : '' }, h('span', { 'aria-hidden': 'true', text: x.emoji + ' ' }), h('span', { class: 'mday-what', text: x.what }), h('span', { class: 'mday-amt', text: x.amt }));
          })), h('p', { class: 'mday-total', id: 'mday-total', text: t('mday.total', { amt: m.total }) + (m.waste ? ' · ' + t('mday.waste', { amt: m.waste }) : '') }));
        } else add(tplBox, h('p', { class: 'hint', id: 'mday-none', text: t('mday.none') }));
        var mt = h('textarea', { class: 'tpl-in mday-in', id: 'mday-note', rows: 2, value: tp.money || '', placeholder: t('mday.ph'), maxlength: 500, 'aria-label': t('mday.ph') });
        mt.addEventListener('input', function () { tp.money = mt.value; grow(mt); commit(); });
        add(tplBox, mt); setTimeout(function () { grow(mt); }, 0);
      }
      placeStickers();
    }
    // a ready-made page from DY.FORMS: every field saved as it is typed or tapped
    function drawForm(k) {
      var tp = deco.tpl;
      tp.forms = tp.forms || {};
      var f = tp.forms[k] || {};
      DY.FORMS[k].forEach(function (fd) { if (!(fd[0] in f)) f[fd[0]] = DY.cleanField(fd[1], fd[2], undefined); });
      tp.forms[k] = f;
      var L = function (x) { return t('tf.' + k + '.' + x); };
      var INSERT = INSERTS;
      if (INSERT[k]) {                     // planner inserts: a calm header — a big light word, a line in script, the page's name
        tplBox.classList.add('tf-insert');
        add(tplBox, h('div', { class: 'ins-head' }, h('p', { class: 'ins-kicker', text: L('kicker') }), h('p', { class: 'ins-title', text: L('big') }),
          h('p', { class: 'ins-script', text: L('script') }), h('p', { class: 'ins-name', text: t('tpl.' + k) })));
      } else add(tplBox, h('p', { class: 'tpl-title', text: (DY.FORM_ICON[k] || '') + ' ' + t('tpl.' + k) }));
      DY.FORMS[k].forEach(function (fd) {
        var name = fd[0], kind = fd[1], row = h('div', { class: 'tf-row tf-' + kind, 'data-f': name });
        var label = h('span', { class: 'tf-label', text: L(name) });
        if (kind === 'line' || kind === 'num' || kind === 'time') {
          var inp = h('input', { class: 'tpl-in tf-in', type: kind === 'num' ? 'number' : kind === 'time' ? 'time' : 'text', inputmode: kind === 'num' ? 'numeric' : null, value: f[name] === '' ? '' : String(f[name]), maxlength: 200, 'aria-label': L(name), placeholder: kind === 'line' ? L(name + 'Ph') : null });
          inp.addEventListener('input', function () { f[name] = DY.cleanField(kind, fd[2], kind === 'num' ? (inp.value === '' ? '' : inp.value) : inp.value); commit(); });
          add(row, label, inp);
        } else if (kind === 'area') {
          var ta = h('textarea', { class: 'tpl-in tf-in', rows: 2, value: f[name], maxlength: 1000, 'aria-label': L(name), placeholder: L(name + 'Ph') });
          ta.addEventListener('input', function () { f[name] = ta.value; grow(ta); commit(); });
          add(row, label, ta); setTimeout(function () { grow(ta); }, 0);
        } else if (kind === 'stars' || kind === 'cups') {
          var max = kind === 'stars' ? 5 : 8, box = h('div', { class: 'tf-taps', role: 'radiogroup', 'aria-label': L(name) });
          var paint = function () { box.querySelectorAll('button').forEach(function (b, i) { var on = i < f[name]; b.classList.toggle('on', on); b.setAttribute('aria-checked', i + 1 === f[name] ? 'true' : 'false'); }); };
          for (var i = 0; i < max; i++) (function (i) {
            add(box, h('button', { type: 'button', role: 'radio', class: 'tf-tap', 'aria-label': String(i + 1), text: kind === 'stars' ? '★' : '💧',
              on: { click: function () { f[name] = f[name] === i + 1 ? i : i + 1; paint(); commit(true); } } }));
          })(i);
          add(row, label, box); paint();
        } else if (kind === 'checks') {
          var cg = h('div', { class: 'tf-checks' });
          fd[2].forEach(function (opt, i) {
            var cb = h('input', { type: 'checkbox', checked: f[name][i] });
            cb.addEventListener('change', function () { f[name][i] = cb.checked; commit(true); });
            add(cg, h('label', { class: 'tf-check' }, cb, h('span', { text: L('o.' + opt) })));
          });
          add(row, label, cg);
        } else if (kind === 'challenge') {
          // a saving challenge: week n puts aside n × the base amount; tick a week when it is in the jar
          var base = ctx.challengeBase ? ctx.challengeBase() : 1, n = fd[2], total = base * n * (n + 1) / 2;
          var sumEl = h('p', { class: 'ch-sum', id: 'ch-sum' }), bar = h('span', { class: 'ch-bar-in' });
          var paintSum = function () {
            var saved = 0; f[name].forEach(function (on, i) { if (on) saved += base * (i + 1); });
            sumEl.textContent = t('tf.ch.saved', { saved: ctx.money(saved), total: ctx.money(total), n: f[name].filter(Boolean).length, all: n });
            bar.style.width = Math.round(saved / total * 100) + '%';
          };
          var grid = h('div', { class: 'ch-grid' + (n > 30 ? ' many' : '') });
          f[name].forEach(function (on, i) {
            var b = h('button', { type: 'button', class: 'ch-cell' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-w': i + 1,
              'aria-label': t('tf.ch.week', { n: i + 1 }) + ' ' + ctx.money(base * (i + 1)),
              on: { click: function () { f[name][i] = !f[name][i]; b.classList.toggle('on', f[name][i]); b.setAttribute('aria-pressed', f[name][i] ? 'true' : 'false'); paintSum(); commit(true); } } },
              h('span', { class: 'ch-w', text: t('tf.ch.week', { n: i + 1 }) }), h('span', { class: 'ch-dot', 'aria-hidden': 'true' }), h('span', { class: 'ch-amt', text: ctx.money(base * (i + 1)) }));
            add(grid, b);
          });
          add(row, h('div', { class: 'ch-top' }, h('span', { class: 'ch-num', text: String(n) }), h('span', { class: 'ch-unit', text: t('tf.ch.weeks') }),
            h('span', { class: 'ch-total', text: t('tf.ch.total', { total: ctx.money(total) }) })), h('div', { class: 'ch-bar' }, bar), sumEl, grid);
          paintSum();
        } else if (kind === 'groceries' || kind === 'ingredients') {
          // rows with a food drawing: tap "+ 재료" and pick; type a name or a price; tick when it is in the basket
          var priced = kind === 'groceries', box = h('div', { class: 'gr-list' + (priced ? '' : ' chips') }), tot = h('p', { class: 'gr-total', id: 'gr-total-' + name });
          var foodEl = function (fk, size) { var el = fk && ST.element('a:fd' + fk); if (el) { el.setAttribute('width', size); el.setAttribute('height', size); } return el || h('span', { class: 'gr-noimg', text: '·' }); };
          var paintTotal = function () {
            if (!priced) return;
            var sum = 0, left = 0; f[name].forEach(function (it) { var v = parseFloat(it.price) || 0; sum += v; if (!it.done) left += v; });
            tot.textContent = t('tf.gr.total', { sum: ctx.money(sum) }) + (k === 'grocery' && sum ? ' · ' + t('tf.gr.left', { left: ctx.money(left) }) : '');
          };
          var draw = function () {
            box.textContent = '';
            f[name].forEach(function (it, i) {
              var cb = h('input', { type: 'checkbox', class: 'gr-cb', checked: it.done, 'aria-label': (it.text || t('tf.food.' + it.f)) + ' ' + (i + 1) });
              cb.addEventListener('change', function () { it.done = cb.checked; rowEl.classList.toggle('done', it.done); paintTotal(); commit(true); });
              var nm = h('input', { class: 'tpl-in gr-name', value: it.text, placeholder: it.f ? t('tf.food.' + it.f) : L(name + 'Ph'), maxlength: 60, 'aria-label': L(name) + ' ' + (i + 1) });
              nm.addEventListener('input', function () { it.text = nm.value; commit(); });
              var pr = priced ? h('input', { class: 'tpl-in gr-price', inputmode: 'decimal', value: it.price || '', placeholder: '0', maxlength: 12, 'aria-label': L('price') + ' ' + (i + 1) }) : null;
              if (pr) pr.addEventListener('input', function () { var v = pr.value.replace(/[^\d.]/g, ''); it.price = /^\d{0,9}(\.\d{0,2})?$/.test(v) ? v : it.price; paintTotal(); commit(); });
              var del = h('button', { type: 'button', class: 'icon-btn xs gr-x', 'aria-label': t('todo.remove'), on: { click: function () { f[name].splice(i, 1); draw(); commit(true); } } }, ctx.icon('x', 14));
              var rowEl = h('div', { class: 'gr-row' + (it.done ? ' done' : ''), 'data-f': it.f || '' }, k === 'pricebook' ? null : cb, h('span', { class: 'gr-img', 'aria-hidden': 'true' }, foodEl(it.f, priced ? 34 : 30)), nm, pr, del);
              add(box, rowEl);
            });
            paintTotal();
          };
          var pick = h('div', { class: 'gr-pick', hidden: true, role: 'listbox', 'aria-label': L(name) });
          (ST.FOOD || []).forEach(function (fk) {
            add(pick, h('button', { type: 'button', class: 'gr-food', 'data-food': fk, title: t('tf.food.' + fk), 'aria-label': t('tf.food.' + fk), on: { click: function () {
              if (f[name].length >= fd[2]) { ctx.toast(t('st.limit', { n: fd[2] })); return; }
              var it = { f: fk, text: '', done: false }; if (priced) it.price = (k === 'grocery' && ctx.priceOf ? ctx.priceOf(fk) : '') || '';
              f[name].push(it); draw(); commit(true);
            } } }, foodEl(fk, 34), h('span', { text: t('tf.food.' + fk) })));
          });
          var addBtn = h('button', { type: 'button', class: 'mini gr-add', id: 'gr-add-' + name, text: '+ ' + L('add'), 'aria-expanded': 'false', on: { click: function () {
            pick.hidden = !pick.hidden; addBtn.setAttribute('aria-expanded', pick.hidden ? 'false' : 'true');
          } } });
          var plain = h('button', { type: 'button', class: 'mini gr-add-plain', text: '+ ' + L('addText'), on: { click: function () {
            if (f[name].length >= fd[2]) return; var it = { f: '', text: '', done: false }; if (priced) it.price = ''; f[name].push(it); draw(); commit(true);
            var ins = box.querySelectorAll('.gr-name'); if (ins.length) ins[ins.length - 1].focus();
          } } });
          add(row, label, box, h('div', { class: 'gr-actions' }, addBtn, plain), pick, priced ? tot : null);
          if (k === 'grocery' && ctx.toBudget) add(row, h('button', { type: 'button', class: 'btn block gr-budget', id: 'gr-budget', on: { click: function () {
            var sum = 0; f[name].forEach(function (it) { if (it.done) sum += parseFloat(it.price) || 0; });
            if (!sum) { ctx.toast(t('tf.gr.none')); return; }
            ctx.toBudget(sum, t('tpl.grocery'));
          } } }, '💸 ', t('tf.gr.toBudget')));
          draw();
        } else if (kind === 'quote') {
          // a sentence to copy out by hand: pick one from PopPopMake's own sentences or write your own
          var qN = 30, qta = h('textarea', { class: 'tpl-in tf-in px-quote', id: 'px-quote', rows: 2, maxlength: 400, value: f[name], 'aria-label': L(name), placeholder: L(name + 'Ph') });
          var setQ = function (v) { f[name] = v; qta.value = v; grow(qta); commit(true); };
          if (!f[name]) { var day = Math.floor(Date.now() / 86400000); f[name] = t('px.q.' + (day % qN)); qta.value = f[name]; setTimeout(function () { commit(true); }, 0); }
          qta.addEventListener('input', function () { f[name] = qta.value; grow(qta); commit(); });
          var qi = 0;
          add(row, label, qta, h('div', { class: 'gr-actions' },
            h('button', { type: 'button', class: 'mini', id: 'px-next', text: '↻ ' + L('another'), on: { click: function () { var cur = -1; for (var z = 0; z < qN; z++) if (t('px.q.' + z) === f[name]) cur = z; qi = (cur + 1 + Math.floor(Math.random() * (qN - 1))) % qN; setQ(t('px.q.' + qi)); } } }),
            h('button', { type: 'button', class: 'mini', id: 'px-own', text: '✎ ' + L('own'), on: { click: function () { setQ(''); qta.focus(); } } })));
          setTimeout(function () { grow(qta); }, 0);
        } else if (kind === 'date') {
          // when a letter opens: pick a date or a quick choice; until then the page stays sealed
          var dv = h('input', { type: 'date', class: 'input tf-in', id: 'tf-open', value: f[name], 'aria-label': L(name) });
          var tmr = new Date(); tmr.setDate(tmr.getDate() + 1); dv.min = tmr.toISOString().slice(0, 10);
          var setD = function (v) { f[name] = DY.cleanField('date', 0, v); dv.value = f[name]; paintQ(); commit(true); };
          dv.addEventListener('change', function () { setD(dv.value); });
          var qs = h('div', { class: 'chips wrap', id: 'tf-open-quick' });
          var plus = function (days, months) { var d = new Date(); d.setMonth(d.getMonth() + (months || 0)); d.setDate(d.getDate() + (days || 0)); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
          var ny = (new Date().getFullYear() + 1) + '-01-01', bd = null;
          var opts = [['m1', plus(0, 1)], ['d100', plus(100)], ['y1', plus(0, 12)], ['ny', ny]];
          var paintQ = function () { qs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-d') === f[name]); }); note.textContent = f[name] ? L('sealNote').replace('{d}', f[name]) : L('noSeal'); };
          opts.forEach(function (o2) { add(qs, h('button', { type: 'button', class: 'chip small', 'data-d': o2[1], id: 'tf-open-' + o2[0], text: L('q.' + o2[0]), on: { click: function () { setD(f[name] === o2[1] ? '' : o2[1]); } } })); });
          var note = h('p', { class: 'hint', id: 'tf-seal-note' });
          add(row, label, dv, qs, note); paintQ();
          if (ctx.letterCard) add(row, h('button', { type: 'button', class: 'mini', id: 'letter-card', text: '💌 ' + L('card'), on: { click: function () { ctx.letterCard(f); } } }));
        } else if (kind === 'envelopes') {
          // 100 envelopes: envelope n holds n × the base amount; fill them in any order — or let the app pick today's
          var eb = ctx.challengeBase ? ctx.challengeBase() : 1, en = fd[2], etot = eb * en * (en + 1) / 2;
          var esum = h('p', { class: 'ch-sum', id: 'env-sum' }), ebar = h('span', { class: 'ch-bar-in' }), egrid = h('div', { class: 'env-grid', id: 'env-grid' }), pickTxt = h('p', { class: 'env-pick-txt', id: 'env-pick-txt', 'aria-live': 'polite' });
          var paintE = function () {
            var sv = 0; f[name].forEach(function (on, i) { if (on) sv += eb * (i + 1); });
            esum.textContent = t('tf.env.saved', { saved: ctx.money(sv), total: ctx.money(etot), n: f[name].filter(Boolean).length, all: en }); ebar.style.width = Math.round(sv / etot * 100) + '%';
          };
          f[name].forEach(function (on, i) {
            var b = h('button', { type: 'button', class: 'env' + (on ? ' on' : ''), 'data-n': i + 1, 'aria-pressed': on ? 'true' : 'false', 'aria-label': (i + 1) + ' · ' + ctx.money(eb * (i + 1)),
              on: { click: function () { f[name][i] = !f[name][i]; b.classList.toggle('on', f[name][i]); b.classList.remove('pick'); b.setAttribute('aria-pressed', f[name][i] ? 'true' : 'false'); paintE(); commit(true); } } }, h('span', { text: String(i + 1) }));
            add(egrid, b);
          });
          var pickBtn = h('button', { type: 'button', class: 'btn small', id: 'env-pick', text: '✉️ ' + t('tf.env.pick'), on: { click: function () {
            var left = []; f[name].forEach(function (on, i) { if (!on) left.push(i); }); if (!left.length) { pickTxt.textContent = t('tf.env.all'); return; }
            var r = new Uint32Array(1); (root.crypto || window.crypto).getRandomValues(r); var i = left[r[0] % left.length];
            egrid.querySelectorAll('.env.pick').forEach(function (x) { x.classList.remove('pick'); }); var el = egrid.querySelector('[data-n="' + (i + 1) + '"]'); if (el) { el.classList.add('pick'); el.scrollIntoView({ block: 'nearest' }); }
            pickTxt.textContent = t('tf.env.today', { n: i + 1, amt: ctx.money(eb * (i + 1)) });
          } } });
          add(row, h('div', { class: 'ch-top' }, h('span', { class: 'ch-num', text: String(en) }), h('span', { class: 'ch-unit', text: t('tf.env.unit') }), h('span', { class: 'ch-total', text: t('tf.ch.total', { total: ctx.money(etot) }) })),
            h('div', { class: 'ch-bar' }, ebar), esum, h('div', { class: 'env-actions' }, pickBtn), pickTxt, egrid);
          paintE();
        } else if (kind === 'temp') {
          // the feeling thermometer: slide from 0° (frozen) to 100° (bursting); the face follows the temperature
          var tv = f[name], faceBox = h('span', { class: 'tm-face', 'aria-hidden': 'true' }), deg = h('strong', { class: 'tm-deg', id: 'tm-deg' });
          var range = h('input', { type: 'range', class: 'tm-range', id: 'tm-range', min: 0, max: 100, step: 1, value: tv === '' ? 50 : tv, 'aria-label': L(name), 'aria-valuetext': tv === '' ? L('tempNone') : tv + '°' });
          var paintT = function () {
            var v = f[name], band = v === '' ? 3 : Math.min(5, Math.floor(v / 20.01) + 1);
            faceBox.textContent = ''; var mf = ST.mood(band); if (mf) faceBox.appendChild(mf);
            deg.textContent = v === '' ? L('tempNone') : v + '°';
            range.classList.toggle('unset', v === ''); range.style.setProperty('--tm', (v === '' ? 50 : v) + '%');
            range.setAttribute('aria-valuetext', v === '' ? L('tempNone') : v + '°');
          };
          range.addEventListener('input', function () { f[name] = DY.cleanField('temp', 0, range.value); paintT(); commit(); });
          range.addEventListener('change', function () { commit(true); });
          add(row, label, h('div', { class: 'tm-box' }, faceBox, h('div', { class: 'tm-track' }, range, h('div', { class: 'tm-ticks', 'aria-hidden': 'true' }, h('span', { text: '0°' }), h('span', { text: '50°' }), h('span', { text: '100°' }))), deg));
          paintT();
        } else if (kind === 'feelings') {
          // today's feeling in words: up to three, picked from four groups; each with its own face; "what does it mean?" opens the dictionary
          var chosen = h('div', { class: 'fl-chosen', id: 'fl-chosen' }), pickF = h('div', { class: 'fl-pick', id: 'fl-pick', hidden: true });
          var faceOf = function (key, size) { var el = ST.element('a:em' + key); if (el) { el.setAttribute('width', size); el.setAttribute('height', size); } return el; };
          var drawChosen = function () {
            chosen.textContent = '';
            if (!f[name].length) add(chosen, h('span', { class: 'fl-none', text: L(name + 'Ph') }));
            f[name].forEach(function (key) {
              add(chosen, h('button', { type: 'button', class: 'fl-tag', 'data-feel': key, 'aria-label': t('tf.feel.' + key) + ' — ' + t('todo.remove'),
                on: { click: function () { f[name] = f[name].filter(function (x) { return x !== key; }); drawChosen(); drawPick(); commit(true); } } }, faceOf(key, 26), h('span', { text: t('tf.feel.' + key) })));
            });
          };
          var toggleFeel = function (key) {
            var i = f[name].indexOf(key);
            if (i >= 0) f[name].splice(i, 1); else if (f[name].length >= fd[2]) { ctx.toast(L('feelMax')); return; } else f[name].push(key);
            drawChosen(); drawPick(); commit(true);
          };
          var drawPick = function () {
            pickF.textContent = '';
            Object.keys(DY.FEELS).forEach(function (g) {
              var grid = h('div', { class: 'fl-grid' });
              DY.FEELS[g].forEach(function (key) {
                var on = f[name].indexOf(key) >= 0;
                add(grid, h('button', { type: 'button', class: 'fl-word' + (on ? ' on' : ''), 'data-feel': key, 'aria-pressed': on ? 'true' : 'false', on: { click: function () { toggleFeel(key); } } }, faceOf(key, 30), h('span', { text: t('tf.feel.' + key) })));
              });
              add(pickF, h('p', { class: 'fl-group fl-' + g, text: t('tf.feelg.' + g) }), grid);
            });
          };
          var openF = h('button', { type: 'button', class: 'mini', id: 'fl-open', 'aria-expanded': 'false', text: '+ ' + L('feelPick'), on: { click: function () {
            pickF.hidden = !pickF.hidden; openF.setAttribute('aria-expanded', pickF.hidden ? 'false' : 'true');
          } } });
          var dict = ctx.feelDict ? h('button', { type: 'button', class: 'mini', id: 'fl-dict', text: '📖 ' + L('feelDict'), on: { click: function () { ctx.feelDict(function (key) { if (f[name].indexOf(key) < 0) toggleFeel(key); }); } } }) : null;
          add(row, label, chosen, h('div', { class: 'gr-actions' }, openF, dict), pickF);
          drawChosen(); drawPick();
        } else if (kind === 'weather') {
          var wb = h('div', { class: 'wx-row', role: 'radiogroup', 'aria-label': L(name) });
          var paintW = function () { wb.querySelectorAll('button').forEach(function (b) { var on = b.getAttribute('data-wx') === f[name]; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }); };
          DY.WEATHER.forEach(function (w) {
            var el = ST.element('a:' + w); if (el) { el.setAttribute('width', 28); el.setAttribute('height', 28); }
            add(wb, h('button', { type: 'button', role: 'radio', class: 'wx', 'data-wx': w, 'aria-label': t('tf.weather.' + w), title: t('tf.weather.' + w), on: { click: function () { f[name] = f[name] === w ? '' : w; paintW(); commit(true); } } }, el));
          });
          add(row, label, wb); paintW();
        } else if (kind === 'panels') {
          // four boxes to draw in (with the pen) and a line under each
          var cg = h('div', { class: 'cx-grid' });
          f[name].forEach(function (cap, i) {
            var inp = h('input', { class: 'tpl-in cx-cap', value: cap, maxlength: 80, placeholder: L('capPh'), 'aria-label': L(name) + ' ' + (i + 1) });
            inp.addEventListener('input', function () { f[name][i] = inp.value; commit(); });
            add(cg, h('div', { class: 'cx-cell' }, h('div', { class: 'cx-box', 'aria-hidden': 'true' }, h('span', { class: 'cx-n', text: String(i + 1) })), inp));
          });
          add(row, cg, btns.draw ? h('button', { type: 'button', class: 'mini', id: 'cx-draw', text: '🖍️ ' + L('drawHere'), on: { click: function () { toggle('draw'); } } }) : null);
        } else if (kind === 'list') {
          var ul = h('ul', { class: 'todo tf-list' });
          f[name].forEach(function (it, i) {
            var cb = h('input', { type: 'checkbox', class: 'todo-cb', checked: it.done, 'aria-label': (it.text || L(name)) + ' ' + (i + 1) });
            var inp = h('input', { class: 'tpl-in todo-in' + (it.done ? ' done' : ''), value: it.text, placeholder: (i + 1) + '. ' + L(name + 'Ph'), maxlength: 200, 'aria-label': L(name) + ' ' + (i + 1) });
            cb.addEventListener('change', function () { it.done = cb.checked; inp.classList.toggle('done', it.done); commit(true); });
            inp.addEventListener('input', function () { it.text = inp.value; commit(); });
            add(ul, h('li', {}, cb, inp));
          });
          add(row, label, ul);
        }
        add(tplBox, row);
      });
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
    var selected = -1, tools = null, autoSet = [], autoTurn = -1;
    // the stickers used lately, newest first (kept on this device; names of drawn stickers only — never photos)
    var REC_KEY = 'ppm-st-recent';
    function recentKeys() { try { var a = JSON.parse(root.localStorage.getItem(REC_KEY) || '[]'); return Array.isArray(a) ? a.filter(function (k) { return typeof k === 'string' && /^[ate]:/.test(k) && ST.element(k); }).slice(0, 24) : []; } catch (er) { return []; } }
    function remember(k) { if (!/^[ate]:/.test(k)) return; try { var a = recentKeys().filter(function (x) { return x !== k; }); a.unshift(k); root.localStorage.setItem(REC_KEY, JSON.stringify(a.slice(0, 24))); } catch (er) {} }
    // one tap: a tape across the top, a word label, one big sticker and two little ones that go together; tap again for another set
    var AUTO = [
      ['t:cherry', 'a:lbtoday', 'a:aeglasscherry', 'a:heart', 'a:ddsparkles'], ['t:skycloud', 'a:lbgoodday', 'a:aerainbowcloud', 'a:ddclouddoodle', 'a:star'],
      ['t:daisy', 'a:lbhappy', 'a:aedaisyvase', 'a:daisy', 'a:ddflowerdoodle'], ['t:kraft', 'a:lbsaved', 'a:mnpiggy', 'a:mncoin', 'a:ddstardoodle'],
      ['t:navystar', 'a:lbmetime', 'a:moon', 'a:ddsparkles', 'a:aecandle'], ['t:ribbonpink', 'a:lblove', 'a:aeglassheart', 'a:ddheartdoodle', 'a:bowpink'],
      ['t:lemon', 'a:lbwow', 'a:fdlemon', 'a:ddsunrays', 'a:sun'], ['t:grid', 'a:lbstudy', 'a:ppstickyyellow', 'a:pencil', 'a:ddcheck'],
      ['t:ginghamblue', 'a:lbweekend', 'a:aepolaroid', 'a:camera', 'a:ddarrowcurve'], ['t:mint', 'a:lbthanks', 'a:aetulipwrap', 'a:clover', 'a:ddsparkles']
    ];
    function autoSets() {
      var m = new Date().getMonth() + 1, sets = AUTO.slice();
      if (m === 12 || m <= 1) sets.unshift(['t:xmasplaid', 'a:lbweekend', 'a:ssxtree', 'a:sssnowman', 'a:snow']);
      return sets.map(function (x) { return x.filter(function (k) { return ST.element(k); }); }).filter(function (x) { return x.length >= 3; });
    }
    function textEnd(pr, W) {             // where the writing ends (the box itself may be taller than what is written)
      var ta = ctx.ta; if (!ta || !ta.offsetParent) return 0.1;
      var r = ta.getBoundingClientRect(), cs = root.getComputedStyle(ta), fs = parseFloat(cs.fontSize) || 16, lh = parseFloat(cs.lineHeight) || fs * 1.6;
      var per = Math.max(8, Math.floor((ta.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)) / (fs * 0.62))), lines = 0;
      String(ta.value || '').split('\n').forEach(function (l) { var w = 0; for (var i = 0; i < l.length; i++) w += l.charCodeAt(i) > 0x2E80 ? 1.6 : 1; lines += Math.max(1, Math.ceil(w / per)); });
      var bottom = r.top + (parseFloat(cs.paddingTop) || 0) + Math.max(1, lines) * lh;
      return Math.max(0.1, (Math.min(r.bottom, bottom) - pr.top) / W);
    }
    function clearAuto() { deco.stickers = deco.stickers.filter(function (st) { return autoSet.indexOf(st) < 0; }); autoSet = []; selected = -1; }
    function autoDecorate() {
      clearAuto();
      var sets = autoSets(); if (!sets.length) return;
      autoTurn = autoTurn < 0 ? Math.floor(Math.random() * sets.length) : (autoTurn + 1) % sets.length;
      var set = sets[autoTurn], W = width(), pr = page.getBoundingClientRect(), H = Math.max(page.scrollHeight || 0, page.clientHeight || 0, W * 0.9) / W;
      // keep the writing readable: a tape on the top-right corner, everything else below where the text ends
      var tb = textEnd(pr, W);
      var spots = [{ x: 0.86, y: 0.035, s: 0.36, r: 38 }, { x: 0.25, y: tb + 0.17, s: 0.3, r: -6 }, { x: 0.78, y: Math.max(tb + 0.36, H - 0.17), s: 0.26, r: 6 },
        { x: 0.52, y: tb + 0.1, s: 0.1, r: 12 }, { x: 0.12, y: Math.max(tb + 0.44, H - 0.08), s: 0.12, r: -12 }];
      set.forEach(function (k, i) {
        if (deco.stickers.length >= DY.MAX_STICKERS) return;
        var sp = spots[i] || spots[spots.length - 1], st = { k: k, x: sp.x, y: sp.y, s: sp.s, r: sp.r };
        deco.stickers.push(st); autoSet.push(st);
      });
      selected = -1; placeStickers(); commit(true); toggle('stickers'); toggle('stickers');
    }
    function addSticker(k) {
      if (deco.stickers.length >= DY.MAX_STICKERS) { ctx.toast(t('st.limit', { n: DY.MAX_STICKERS })); return; }
      var W = width(), r = page.getBoundingClientRect(), vh = root.innerHeight || 800;
      var top = Math.max(r.top, 0), bottom = Math.min(r.bottom, vh), mid = (top < bottom ? (top + bottom) / 2 : r.top + Math.min(r.height, vh) / 2) - r.top;
      var n = deco.stickers.length % 6, xs = [0.78, 0.26, 0.6, 0.18, 0.7, 0.42];   // spread new stickers so they don't pile up
      deco.stickers.push({ k: k, x: k.charAt(0) === 't' ? 0.5 : xs[n], y: Math.max(0.12, mid / W + (n % 3) * 0.07), s: k.charAt(0) === 't' ? 0.42 : 0.18, r: k.charAt(0) === 't' ? -8 : 0 });
      selected = deco.stickers.length - 1;
      remember(k);
      placeStickers(); commit(true);
      var el = layer.querySelector('[data-i="' + selected + '"]'); if (el) el.focus();
    }
    function placeStickers() {
      layer.textContent = ''; tools = null;
      var W = width();
      deco.stickers.forEach(function (st, i) {
        var art = stickerArt(st.k); if (!art) return;
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
      bar: bar, panel: panel, look: applyLook,
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
  // Stickers that only sit there (a cover, an example page): sized and placed in widths of their box (container units).
  function still(stickers, h) {
    var layer = h('div', { class: 'st-layer still', 'aria-hidden': 'true' });
    (stickers || []).forEach(function (st) {
      var art = ST.element(st.k); if (!art) return;
      var tape = st.k.charAt(0) === 't', el = h('div', { class: 'sticker' + (tape ? ' tape' : ''), 'data-k': st.k }, art), s = st.s * 100;
      el.style.width = s + 'cqw'; el.style.height = (tape ? s / 4 : s) + 'cqw';
      el.style.left = 'calc(' + (st.x * 100) + 'cqw - ' + (s / 2) + 'cqw)'; el.style.top = 'calc(' + (st.y * 100) + 'cqw - ' + (tape ? s / 8 : s / 2) + 'cqw)';
      el.style.transform = 'rotate(' + st.r + 'deg)';
      if (st.k.charAt(0) === 'e') el.style.fontSize = (s * 0.82) + 'cqw';
      layer.appendChild(el);
    });
    return layer;
  }
  root.VaultDeco = { attach: attach, preview: preview, still: still };
})(typeof window !== 'undefined' ? window : globalThis);
