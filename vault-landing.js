/* Feature cards on the Budget Tracker and Sticky Notes pages: tap a card and a small phone shows how that feature works.
 * The demo is made of fixed pictures-in-HTML written here; nothing is stored and nothing is sent anywhere. */
(function () {
  'use strict';
  var root = document.querySelector('[data-demo-root]');
  if (!root) return;
  var stage = root.querySelector('.demo-phone'), cap = root.querySelector('.demo-caption'), live = root.querySelector('.demo-live');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function bar(title) { return '<div class="dp-top"><span>' + title + '</span><span class="dp-lock">🔒</span></div>'; }
  function tabs(on) {
    return '<div class="dp-tabs">' + [['budget', '💳', 'Budget'], ['notes', '🗒️', 'Notes'], ['settings', '⚙️', 'Settings']].map(function (x) {
      return '<span class="' + (x[0] === on ? 'on' : '') + '">' + x[1] + '<small>' + x[2] + '</small></span>';
    }).join('') + '</div>';
  }
  function summary(spent, left) {
    return '<div class="dp-card"><small>Spent</small><b class="dp-big">' + spent + '</b>' +
      (left ? '<div class="dp-bar"><i style="width:' + left[0] + '%"></i></div><small>' + left[1] + '</small>' : '') + '</div>';
  }
  function row(e, name, note, amt, cls) { return '<div class="dp-row ' + (cls || '') + '"><span class="dp-e">' + e + '</span><span class="dp-n">' + name + (note ? '<small>' + note + '</small>' : '') + '</span><b>' + amt + '</b></div>'; }
  function sheet(inner) { return '<div class="dp-dim"></div><div class="dp-sheet">' + inner + '</div>'; }
  function cats(hl) {
    return '<div class="dp-cats">' + [['🍚', 'Food'], ['☕', 'Coffee'], ['🛒', 'Groceries'], ['🚌', 'Transport'], ['🏠', 'Housing'], ['🎁', 'Gifts'], ['🔁', 'Subs'], ['📦', 'Other']].map(function (c) {
      return '<span class="' + (c[1] === hl ? 'hl' : '') + '">' + c[0] + '<small>' + c[1] + '</small></span>';
    }).join('') + '</div>';
  }
  function fab(hl) { return '<span class="dp-fab' + (hl ? ' hl' : '') + '">+</span>'; }
  var BUDGET = bar('October 2026');

  var DEMOS = {
    quick: [
      ['Tap +', BUDGET + summary('$62.40') + row('🛒', 'Groceries', 'Market', '−$40.00') + fab(true) + tabs('budget')],
      ['Type the amount', BUDGET + summary('$62.40') + sheet('<b>Add an entry</b><div class="dp-amt">4.50<i class="dp-caret"></i></div>' + cats(''))],
      ['Tap a category — it saves right away', BUDGET + summary('$62.40') + sheet('<b>Add an entry</b><div class="dp-amt">4.50</div>' + cats('Coffee'))],
      ['Done: three taps', BUDGET + summary('$66.90') + row('☕', 'Coffee', '', '−$4.50', 'new') + row('🛒', 'Groceries', 'Market', '−$40.00') + '<div class="dp-toast">Saved: ☕ Coffee $4.50 <u>Undo</u></div>' + tabs('budget')]
    ],
    frequent: [
      ['Things you buy often appear as buttons', BUDGET + sheet('<b>Add an entry</b><small class="dp-hint">Your frequent entries — one tap adds them for today</small><div class="dp-chips"><span class="hl">☕ Latte $4.50</span><span>🚌 Bus $2.75</span></div>' + cats(''))],
      ['One tap and it is logged for today', BUDGET + summary('$71.40') + row('☕', 'Coffee', 'Latte', '−$4.50', 'new') + '<div class="dp-toast">Saved: ☕ Latte $4.50 <u>Undo</u></div>' + tabs('budget')]
    ],
    budget: [
      ['Set a monthly budget and watch what is left', BUDGET + summary('$842.10', [70, '$357.90 left of $1,200.00']) + row('🏠', 'Housing', 'Rent', '−$650.00') + tabs('budget')],
      ['See where the money went', BUDGET + '<div class="dp-card"><b>Where the money went</b>' +
        [['🏠 Housing', 77], ['🛒 Groceries', 12], ['☕ Coffee', 6], ['🚌 Transport', 5]].map(function (x) { return '<div class="dp-hb"><small>' + x[0] + ' · ' + x[1] + '%</small><div class="dp-bar"><i style="width:' + x[1] + '%"></i></div></div>'; }).join('') + '</div>' + tabs('budget')],
      ['Six months at a glance', BUDGET + '<div class="dp-card"><b>Last 6 months</b><div class="dp-trend">' + [40, 55, 48, 70, 62, 58].map(function (v) { return '<i style="height:' + v + '%"></i>'; }).join('') + '</div></div>' + tabs('budget')]
    ],
    repeat: [
      ['Turn on “Repeat every month” once', BUDGET + sheet('<b>Add an entry</b><div class="dp-amt">650.00</div><div class="dp-check on">☑ Repeat every month on this day</div>' + cats('Housing'))],
      ['Rent and subscriptions add themselves every month', bar('November 2026') + summary('$665.99') + row('🏠', 'Housing 🔁', 'Rent', '−$650.00') + row('🔁', 'Subscriptions 🔁', 'Music', '−$15.99') + tabs('budget')]
    ],
    csv: [
      ['Download a CSV statement from your bank, then choose it', bar('Settings') + sheet('<b>Import a bank statement</b><div class="dp-file">📄 statement.csv</div><small class="dp-hint">Read on this device only</small>')],
      ['Check which column is which', bar('Settings') + sheet('<b>Import a bank statement</b><div class="dp-map"><span>Date → <b>Date</b></span><span>Money out → <b>Debit</b></span><span>Description → <b>Details</b></span></div><div class="dp-btn">Import</div>')],
      ['Entries already in your records are skipped', bar('Settings') + '<div class="dp-toast">Added 42. Skipped 3 already in your records.</div>' + tabs('settings')]
    ],
    lock: [
      ['Only your passcode opens it', '<div class="dp-lockscreen"><div class="dp-lockic">🔒</div><b>Locked</b><div class="dp-input">••••••••••</div><div class="dp-btn">Unlock</div></div>'],
      ['It locks itself when you leave', '<div class="dp-lockscreen"><div class="dp-lockic">🔒</div><b>Locked</b><small>Locked to keep your data private.</small></div>'],
      ['Saved data is encrypted — unreadable even to us', '<div class="dp-cipher">x8Kd2…Qe9z<br>Lm0P…7Yh1<br>AES-256-GCM</div>']
    ],
    backup: [
      ['Back up to one encrypted file', bar('Settings') + sheet('<b>Back up to a file</b><div class="dp-file">💾 poppopmake-vault-backup.json</div><div class="dp-btn">Download backup file</div>')],
      ['New phone? Restore the file', '<div class="dp-lockscreen"><b>Restore from a backup file</b><div class="dp-file">💾 backup.json</div><div class="dp-input">Passcode or recovery code</div><div class="dp-btn">Restore</div></div>'],
      ['Everything is back', BUDGET + summary('$842.10') + '<div class="dp-toast">Restored. Everything from the backup is back.</div>' + tabs('budget')]
    ],
    notes: [
      ['Sticky notes in their own tab', bar('Notes') + '<div class="dp-notes"><span class="y">📌 Wi-Fi: cafe-5G<br>pw on fridge</span><span class="p">Groceries<br>– milk<br>– eggs</span><span class="g">Gift ideas<br>for Mom</span><span class="b">Car service<br>Nov 14</span></div>' + fab(false) + tabs('notes')],
      ['Write, pick a color, pin the important ones', bar('Notes') + sheet('<b>New note</b><div class="dp-noteedit">Groceries<br>– milk<br>– eggs<i class="dp-caret"></i></div><div class="dp-sw"><i class="y"></i><i class="p on"></i><i class="g"></i><i class="b"></i></div><div class="dp-btn ghost">📌 Pin to top</div>')],
      ['Search finds any note', bar('Notes') + '<div class="dp-search">milk</div><div class="dp-notes"><span class="p">Groceries<br>– <mark>milk</mark><br>– eggs</span></div>' + tabs('notes')]
    ],
    install: [
      ['iPhone: Share → “Add to Home Screen”', '<div class="dp-lockscreen"><div class="dp-share">⬆️ Share</div><div class="dp-menu"><span>Copy</span><span class="hl">➕ Add to Home Screen</span><span>Print</span></div></div>'],
      ['Android or computer: tap Install', '<div class="dp-lockscreen"><b>Install as an app</b><div class="dp-btn">Install</div></div>'],
      ['It opens like an app — even offline', '<div class="dp-home"><span>📷</span><span>✉️</span><span class="hl"><img src="/icons/tool-vault-192.png" alt="" width="36" height="36"></span><span>🗺️</span></div><small class="dp-hint center">Budget &amp; Notes</small>']
    ],
    lang: [
      ['한국어', bar('2026년 10월') + '<div class="dp-card"><small>지출</small><b class="dp-big">₩842,100</b></div>' + row('☕', '카페·간식', '', '−₩4,500') + tabs('budget')],
      ['日本語', bar('2026年10月') + '<div class="dp-card"><small>支出</small><b class="dp-big">¥84,210</b></div>' + row('☕', 'カフェ・おやつ', '', '−¥480') + tabs('budget')],
      ['English — and 24 currencies', BUDGET + '<div class="dp-card"><small>Spent</small><b class="dp-big">$842.10</b></div>' + row('☕', 'Coffee', '', '−$4.50') + tabs('budget')]
    ]
  };

  var timer = null, frames = null, i = 0;
  function show() {
    stage.innerHTML = '<div class="dp-screen">' + frames[i][1] + '</div>';
    cap.textContent = (i + 1) + ' / ' + frames.length + ' — ' + frames[i][0];
  }
  function play(key, btn) {
    clearInterval(timer);
    frames = DEMOS[key]; i = 0;
    root.querySelectorAll('[data-demo]').forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
    if (live) live.textContent = btn.querySelector('.fc-title').textContent + ': ' + frames.map(function (f) { return f[0]; }).join(' → ');
    show();
    if (!reduce) timer = setInterval(function () { i = (i + 1) % frames.length; show(); }, 2200);
  }
  root.querySelectorAll('[data-demo]').forEach(function (b) {
    b.addEventListener('click', function () {
      play(b.getAttribute('data-demo'), b);
      if (window.innerWidth < 820 && stage.scrollIntoView) stage.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    });
  });
  root.querySelector('.demo-next') && root.querySelector('.demo-next').addEventListener('click', function () {
    if (!frames) return; clearInterval(timer); i = (i + 1) % frames.length; show();
  });
  var first = root.querySelector('[data-demo]');
  if (first) play(first.getAttribute('data-demo'), first);
})();
