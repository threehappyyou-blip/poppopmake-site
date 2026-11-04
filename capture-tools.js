/* PopPopMake: paste and screen capture for Screenshot Markup.
 *
 * One script serves all three copies of the editor (the tab in Document & Image Tools, the standalone page and the embed).
 * It adds a small toolbar under the drop zone and gives every picture to the editor exactly the way a chosen file arrives:
 * through the page's own file input. Nothing here is uploaded; pictures live in this browser tab and are gone when it closes.
 *
 *   Paste     Ctrl+V anywhere on the page (only while the Markup tab is open on the hub), plus a Paste button.
 *   Capture   Screen / window / browser tab through the browser's own screen-share picker. A window or tab is taken at once;
 *             a whole screen waits 3, 5 or 10 seconds first, because the picture would otherwise show this page.
 *   Shortcut  A key combination (Ctrl+Q unless changed) starts a capture while this page is the active window. A web page
 *             never sees keys pressed in other programs, so the tip points to the system's own screenshot keys for that.
 *   Save      "Save picture" / "Copy" for the picture just taken, an option to save every capture as a file at once, and
 *             Ctrl+S (⌘S) to download the marked-up picture from the editor.
 */
(function () {
  'use strict';
  if (window.__ppmCaptureLoaded) return;
  window.__ppmCaptureLoaded = true;

  var MAX_RECENT = 5;
  var READY_MS = 1500;          // how long to wait for the first video frame before reading the stream directly
  var BLACK_TRIES = 3;

  var md = navigator.mediaDevices;
  var hasCapture = !!(md && typeof md.getDisplayMedia === 'function');
  var policyBlocked = false;
  try {
    var pp = document.permissionsPolicy || document.featurePolicy;
    if (pp && typeof pp.allowsFeature === 'function' && pp.allowsFeature('display-capture') === false) policyBlocked = true;
  } catch (e) { /* older browsers: treat as allowed */ }

  // The paste key a person has to press: Command on a Mac (and iPad), Ctrl everywhere else.
  var isMac = false;
  try { isMac = /Mac|iPhone|iPad|iPod/i.test(String((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '')); } catch (e) { /* keep Ctrl */ }
  var KEY = isMac ? '\u2318V' : 'Ctrl+V';

  var TEXT = {
    choose: 'Choose what to share in the window your browser just opened.',
    cancelled: 'Capture cancelled. Nothing was shared.',
    stopped: 'Sharing was stopped before the picture was taken.',
    osDenied: 'Your computer did not let the browser record the screen. On a Mac, open System Settings → Privacy & Security → Screen Recording, allow your browser, then try again.',
    blocked: 'Screen capture is blocked here: the page this tool sits in has not allowed it. You can still paste a picture (Ctrl+V, or \u2318V on a Mac) or choose a file.',
    wouldNotStart: 'Your computer would not start the capture. Close other programs that record the screen, or try capturing a window or a browser tab instead.',
    nothing: 'There is nothing to capture: the browser found no screen or window to share.',
    interrupted: 'The capture was interrupted. Please try again.',
    unreadable: 'That picture could not be read. Copy it again, or save it as a file and choose it with “Choose an image”.',
    noPicture: 'There is no picture on the clipboard. Take a screenshot first (Windows: Win+Shift+S, Mac: ⌘+Ctrl+Shift+4), then press Paste.',
    useCtrlV: 'Your browser did not let this page read the clipboard. Click on the page and press Ctrl+V (⌘+V on a Mac) instead.',
    noHandoff: 'This browser cannot hand the picture to the editor. Save it as a file and choose it with “Choose an image”.',
    editorFailed: 'The editor could not open that picture.',
    noteNoCapture: 'Screen capture needs a computer browser (Chrome, Edge, Firefox or Safari on a desktop or laptop). On a phone or tablet, take a screenshot, then press Paste or choose the image.',
    noteBlocked: 'Screen capture is turned off for this embedded copy, because the page around it has not allowed it. You can still paste a picture (Ctrl+V, or \u2318V on a Mac) or choose a file.'
  };

  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); }
  function clock(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

  // ---------------------------------------------------------------------------------------------- toolbar
  var els = {};
  var recent = [];
  var busy = false;
  var cancelNow = null;           // set while the countdown runs: Cancel button and Escape call it
  var active = null;              // set while a capture runs: stops the shared stream

  var nextId = 0;
  var latest = null;              // the picture taken or pasted last (for Save / Copy)

  // ---------------------------------------------------------------------------------------------- shortcuts
  // Each action can have any key the browser lets a page see. Combinations a browser or computer never hands to a page
  // are refused with the reason; ones that only replace a browser function on this page are allowed with a note.
  var KEYS_STORE = 'ppm-shot-keys', AUTO_STORE = 'ppm-shot-autosave';
  var MOD = isMac ? 'Meta' : 'Ctrl';
  var ACTIONS = [
    { id: 'screen', label: 'Capture the whole screen', def: 'Ctrl+Q' },
    { id: 'window', label: 'Capture a window', def: '' },
    { id: 'tab', label: 'Capture a browser tab', def: '' },
    { id: 'save', label: 'Save the picture', def: MOD + '+S' },
    { id: 'copy', label: 'Copy the picture', def: MOD + '+Shift+C' }
  ];
  var NEVER = { // never reach a web page (the browser or the computer acts first)
    'Ctrl+W': 'closes the tab', 'Ctrl+Shift+W': 'closes the window', 'Ctrl+T': 'opens a new tab', 'Ctrl+Shift+T': 'reopens a closed tab',
    'Ctrl+N': 'opens a new window', 'Ctrl+Shift+N': 'opens a private window', 'Ctrl+Tab': 'switches tabs', 'Ctrl+Shift+Tab': 'switches tabs',
    'Ctrl+PageUp': 'switches tabs', 'Ctrl+PageDown': 'switches tabs', 'Ctrl+Shift+Q': 'quits the browser', 'Alt+F4': 'closes the window',
    'Alt+Tab': 'switches programs', 'Ctrl+Alt+Delete': 'belongs to Windows', 'Ctrl+Shift+Escape': 'opens Task Manager', 'F11': 'switches to full screen',
    'Meta+Q': 'quits the app', 'Meta+W': 'closes the tab', 'Meta+T': 'opens a new tab', 'Meta+N': 'opens a new window', 'Meta+H': 'hides the app',
    'Meta+M': 'minimises the window', 'Meta+Tab': 'switches apps', 'Meta+Space': 'opens Spotlight', 'Meta+Shift+3': 'is the Mac’s own screenshot key',
    'Meta+Shift+4': 'is the Mac’s own screenshot key', 'Meta+Shift+5': 'is the Mac’s own screenshot key', 'Meta+Backquote': 'switches windows',
    'Ctrl+V': 'pastes a picture into this tool', 'Meta+V': 'pastes a picture into this tool', 'Ctrl+K': 'opens this site’s search', 'Meta+K': 'opens this site’s search'
  };
  var OVERRIDES = { // a browser function that this page will replace while it is open
    'S': 'saves the web page', 'P': 'prints', 'F': 'finds on the page', 'D': 'bookmarks the page', 'L': 'goes to the address bar', 'R': 'reloads the page',
    'H': 'shows history', 'J': 'shows downloads', 'O': 'opens a file', 'U': 'shows the page source', 'G': 'finds the next match', 'E': 'searches the web',
    'A': 'selects everything', 'C': 'copies', 'X': 'cuts', 'Z': 'undoes', 'Y': 'redoes', '1': 'switches to a tab', '2': 'switches to a tab', '3': 'switches to a tab',
    '4': 'switches to a tab', '5': 'switches to a tab', '6': 'switches to a tab', '7': 'switches to a tab', '8': 'switches to a tab', '9': 'switches to a tab', '0': 'resets the zoom',
    '=': 'zooms in', '-': 'zooms out'
  };
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private window: keep for this visit only */ } }
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var memo = {};
  function getPref(k, dflt) { var v = memo[k] !== undefined ? memo[k] : stored(k); return v === null || v === undefined ? dflt : v; }
  function setPref(k, v) { memo[k] = v; store(k, v); }
  var keymap = null;
  function defaults() { var m = {}; ACTIONS.forEach(function (a) { m[a.id] = a.def; }); return m; }
  function loadKeys() {
    var m = defaults(), raw = null;
    try { raw = JSON.parse(getPref(KEYS_STORE, 'null')); } catch (e) { raw = null; }
    if (raw && typeof raw === 'object') ACTIONS.forEach(function (a) { if (typeof raw[a.id] === 'string') m[a.id] = raw[a.id]; });
    else {                                             // the single shortcut of the first version
      var old = stored('ppm-shot-key'), kind = stored('ppm-shot-kind');
      if (old) { var id = kind === 'window' ? 'window' : kind === 'browser' ? 'tab' : 'screen'; m.screen = id === 'screen' ? old : (m.screen === old ? '' : m.screen); m[id] = old; }
    }
    return m;
  }
  function saveKeys() { setPref(KEYS_STORE, JSON.stringify(keymap)); }
  var KEYNAMES = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',',
    Period: '.', Slash: '/', Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Insert: 'Insert', Delete: 'Delete', Home: 'Home',
    End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Pause: 'Pause', ScrollLock: 'ScrollLock', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab',
    PrintScreen: 'PrintScreen', ContextMenu: 'Menu', NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadDecimal: 'Num.', NumpadEnter: 'NumEnter' };
  // The key by its position (e.code), so a Korean or Japanese keyboard layout gives the same combination.
  function keyName(e) {
    var c = e.code || '';
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit\d$/.test(c)) return c.slice(5);
    if (/^Numpad\d$/.test(c)) return 'Num' + c.slice(6);
    if (/^F([1-9]|1\d|2[0-4])$/.test(c)) return c;
    if (c === 'Escape' && (e.ctrlKey || e.altKey || e.metaKey)) return 'Escape';
    return KEYNAMES[c] || null;
  }
  function comboOf(e) {
    var k = keyName(e);
    if (!k) return null;
    return (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.metaKey ? 'Meta+' : '') + k;
  }
  // '' = fine; {no: reason} = can't be used; {note: text} = allowed, with something to know
  function judge(c) {
    if (!c) return { no: 'That key can’t be used. Try a letter, a number or an F key, alone or with Ctrl, Alt or Shift.' };
    if (NEVER[c]) return { no: comboLabel(c) + ' can’t be used: your ' + (/^Meta\+(Q|H|M|Tab|Space|Shift\+[345])$|^Alt\+Tab|^Ctrl\+Alt|Escape$/.test(c) ? 'computer' : 'browser') + ' ' + NEVER[c] + ' before a page ever sees it.' };
    if (/PrintScreen$/.test(c)) return { no: 'Print Screen goes to your computer first (on Windows it opens the screenshot tool), so a page never sees it. That works well too: press it, then ' + KEY + ' here.' };
    if (!isMac && /Meta\+/.test(c)) return { no: 'Windows-key shortcuts belong to Windows; a page never sees them. Use Ctrl, Alt, Shift or an F key.' };
    if (/^(Shift\+)?(Tab|Enter|Space|Backspace)$/.test(c)) return { no: comboLabel(c) + ' is needed to move around and type. Add Ctrl or Alt to it.' };
    var m = c.match(/^(Ctrl|Meta)\+(Shift\+)?([^+]+)$/);
    if (m && OVERRIDES[m[3]] && !m[2]) return { note: 'On this page ' + comboLabel(c) + ' will do this instead of what it usually does (' + OVERRIDES[m[3]] + '). Some browsers may still do their own thing; if so, pick another.' };
    if (/^F5$|^(Ctrl\+)?R$/.test(c)) return { note: 'On this page ' + comboLabel(c) + ' will do this instead of reloading the page.' };
    if (/^(Shift\+)?[^+]$/.test(c) || /^Num/.test(c)) return { note: 'Pressing just ' + comboLabel(c) + ' anywhere on this page (outside a text box) will do this. If that happens by accident, add Ctrl or Alt.' };
    return '';
  }
  function comboLabel(c) { return isMac ? c.replace(/Meta\+/g, '⌘').replace(/Ctrl\+/g, '⌃').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧') : c; }

  var CSS = '' +
    '.ppmcap{margin-top:12px;color:var(--ink,#1C2321);font-size:.9rem}' +
    '.ppmcap *{box-sizing:border-box}' +
    '.ppmcap-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.ppmcap-btn{font:inherit;font-size:.86rem;font-weight:600;line-height:1.2;min-height:40px;padding:9px 16px;border-radius:999px;border:1px solid var(--line,rgba(28,35,33,.12));background:#fff;color:var(--ink,#1C2321);cursor:pointer}' +
    '.ppmcap-btn:hover{border-color:var(--teal,#0D7A7C)}' +
    '.ppmcap-btn.ppmcap-primary{background:var(--ink,#1C2321);border-color:var(--ink,#1C2321);color:#fff}' +
    '.ppmcap-btn[aria-disabled="true"]{background:var(--paper-2,#E4E9E6);color:var(--ink-soft,#4B534F);cursor:not-allowed}' +
    '.ppmcap-btn:focus-visible,.ppmcap-select:focus-visible{outline:3px solid var(--teal,#0D7A7C);outline-offset:2px}' +
    '.ppmcap-key{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.76rem;font-weight:500;margin-left:6px}' +
    '.ppmcap-delay{display:inline-flex;align-items:center;gap:6px;font-size:.84rem;color:var(--ink-soft,#4B534F)}' +
    '.ppmcap-select{font:inherit;font-size:.85rem;min-height:40px;padding:6px 10px;border-radius:8px;border:1px solid var(--line,rgba(28,35,33,.12));background:#fff;color:var(--ink,#1C2321)}' +
    '.ppmcap-count{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:10px;padding:10px 14px;border-radius:8px;border:1px solid var(--teal,#0D7A7C);background:#fff;color:var(--ink,#1C2321);font-weight:600}' +
    '.ppmcap-count[hidden],.ppmcap-note[hidden],.ppmcap-recent[hidden],.ppmcap-btn[hidden],.ppmcap-delay[hidden]{display:none}' +
    '.ppmcap-count strong{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:1.3rem}' +
    '.ppmcap-msg{margin-top:10px;font-size:.88rem;border-radius:8px;padding:10px 12px}' +
    '.ppmcap-msg:empty{display:block;margin:0;padding:0}' +
    '.ppmcap-msg.ppmcap-info,.ppmcap-msg.ppmcap-ok{background:rgba(15,139,141,.08);color:var(--ink,#1C2321)}' +
    '.ppmcap-msg.ppmcap-error{background:rgba(242,84,45,.08);color:var(--orange,#C14324)}' +
    '.ppmcap-msg.ppmcap-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}' +
    '.ppmcap-note{margin:10px 0 0;font-size:.84rem;color:var(--ink-soft,#4B534F)}' +
    '.ppmcap-recent{margin-top:12px}' +
    '.ppmcap-recent-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:.82rem;color:var(--ink-soft,#4B534F)}' +
    '.ppmcap-list{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}' +
    '.ppmcap-thumb{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border-radius:8px;border:1px solid var(--line,rgba(28,35,33,.12));background:#fff;color:var(--ink-soft,#4B534F);font:inherit;font-size:.74rem;cursor:pointer}' +
    '.ppmcap-thumb:hover{border-color:var(--teal,#0D7A7C)}' +
    '.ppmcap-thumb:focus-visible{outline:3px solid var(--teal,#0D7A7C);outline-offset:2px}' +
    '.ppmcap-thumb img{display:block;max-width:96px;max-height:54px;border-radius:4px}' +
    '.ppmcap-tip{margin:10px 0 0;font-size:.8rem;color:var(--ink-soft,#4B534F)}.ppmcap-tip[hidden]{display:none}' +
    '.ppmcap-prefs{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-top:10px;font-size:.84rem;color:var(--ink-soft,#4B534F)}' +
    '.ppmcap-prefs label{display:inline-flex;align-items:center;gap:6px}' +
    '.ppmcap-prefs[hidden],.ppmcap-actions[hidden]{display:none}' +
    '.ppmcap-kbd{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.82rem;font-weight:600;color:var(--ink,#1C2321);padding:3px 8px;border:1px solid var(--line,rgba(28,35,33,.2));border-bottom-width:2px;border-radius:6px;background:#fff}' +
    '.ppmcap-kbd.ppmcap-rec{border-color:var(--teal,#0D7A7C);color:var(--teal,#0D7A7C)}' +
    '.ppmcap-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}' +
    '.ppmcap-keypanel{margin-top:10px;padding:12px 14px;border:1px solid var(--line,rgba(28,35,33,.12));border-radius:10px;background:#fff}' +
    '.ppmcap-keypanel[hidden]{display:none}' +
    '.ppmcap-kp-head{margin:0 0 8px;font-size:.84rem;color:var(--ink-soft,#4B534F)}' +
    '.ppmcap-kp-list{list-style:none;margin:0 0 10px;padding:0}' +
    '.ppmcap-kp-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line,rgba(28,35,33,.08))}' +
    '.ppmcap-kp-name{flex:1 1 180px;font-weight:600}' +
    '.ppmcap-kp-row .ppmcap-kbd{min-width:112px;text-align:center}' +
    '@media (max-width:480px){.ppmcap-kp-name{flex-basis:100%}.ppmcap-kp-row .ppmcap-kbd{min-width:0}.ppmcap-kp-row .ppmcap-btn{padding:6px 10px}.ppmcap-kp-row .ppmcap-btn[aria-hidden=true]{display:none}}' +
    '.ppmcap-anywhere{margin-top:10px;font-size:.84rem;color:var(--ink-soft,#4B534F)}' +
    '.ppmcap-anywhere summary{cursor:pointer;font-weight:600;color:var(--ink,#1C2321)}' +
    '.ppmcap-anywhere ol{margin:6px 0 0;padding-left:20px}' +
    '@media (pointer:coarse){.ppmcap-btn,.ppmcap-select{min-height:44px}.ppmcap-key,.ppmcap-tip,.ppmcap-hot{display:none}}';

  function mount() {
    var drop = $('markup-drop'), input = $('markup-input');
    if (!drop || !input || $('ppmcap')) return;
    var style = document.createElement('style');
    style.id = 'ppmcap-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.id = 'ppmcap';
    box.className = 'ppmcap';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Paste or capture a picture');
    box.innerHTML =
      '<div class="ppmcap-row">' +
        '<button type="button" class="ppmcap-btn ppmcap-primary" id="ppmcap-paste">Paste picture <span class="ppmcap-key">' + KEY + '</span></button>' +
        '<button type="button" class="ppmcap-btn" id="ppmcap-screen">Capture screen</button>' +
        '<button type="button" class="ppmcap-btn" id="ppmcap-window">Capture window</button>' +
        '<button type="button" class="ppmcap-btn" id="ppmcap-tab">Capture browser tab</button>' +
        '<span class="ppmcap-delay" id="ppmcap-delay-wrap"><label for="ppmcap-delay">Screen capture waits</label>' +
          '<select class="ppmcap-select" id="ppmcap-delay"><option value="3">3 seconds</option><option value="5" selected>5 seconds</option><option value="10">10 seconds</option></select></span>' +
      '</div>' +
      '<div class="ppmcap-prefs" id="ppmcap-prefs">' +
        '<span class="ppmcap-hot" id="ppmcap-hot"><span id="ppmcap-summary"></span> <button type="button" class="ppmcap-btn" id="ppmcap-keys" aria-expanded="false" aria-controls="ppmcap-keypanel">Set shortcuts</button></span>' +
        '<label><input type="checkbox" id="ppmcap-auto"> Save each capture as a file right away</label>' +
      '</div>' +
      '<div class="ppmcap-keypanel" id="ppmcap-keypanel" hidden>' +
        '<p class="ppmcap-kp-head">Choose any keys you like for each action. Click <b>Change</b>, then press the keys.</p>' +
        '<ul class="ppmcap-kp-list" id="ppmcap-kp-list"></ul>' +
        '<div class="ppmcap-row"><button type="button" class="ppmcap-btn" id="ppmcap-kp-reset">Back to the original keys</button><button type="button" class="ppmcap-btn" id="ppmcap-kp-close">Done</button></div>' +
        '<details class="ppmcap-anywhere" id="ppmcap-anywhere"><summary>Open this tool from any program with your own key</summary>' +
          '<ol><li>Install this page as an app: the install icon at the right end of Chrome’s or Edge’s address bar.</li>' +
          '<li>Windows: in the Start menu, right-click the app → More → Open file location; right-click the shortcut → Properties → click “Shortcut key” and press a letter (for example S makes Ctrl+Alt+S) → OK. Mac: in the Shortcuts app, make a shortcut that opens the app and add a keyboard shortcut to it.</li>' +
          '<li>Now that key brings this tool up from anywhere; then press your capture shortcut, or ' + KEY + ' to paste a picture taken with the Print Screen key or Win+Shift+S.</li></ol></details>' +
      '</div>' +
      '<p class="ppmcap-tip" id="ppmcap-hot-tip">Shortcuts work while this page is the window you are using. In another program, press your computer’s own screenshot key (Print Screen or Win+Shift+S on Windows, ⌘+Ctrl+Shift+4 on a Mac), then ' + KEY + ' here — or give this tool its own key to open it from anywhere (Set shortcuts).</p>' +
      '<p class="ppmcap-tip" id="ppmcap-tip">Tip: press Win+Shift+S (Windows) or ⌘+Ctrl+Shift+4 (Mac) to pick any area of your screen, then press ' + KEY + ' here. Nothing is uploaded; pictures stay on your device.</p>' +
      '<div class="ppmcap-count" id="ppmcap-count" hidden>' +
        '<span aria-hidden="true">Capturing the screen in <strong id="ppmcap-count-num">5</strong> … switch to what you want in the picture.</span>' +
        '<button type="button" class="ppmcap-btn" id="ppmcap-cancel">Cancel</button>' +
      '</div>' +
      '<div class="ppmcap-msg" id="ppmcap-msg" role="status" aria-live="polite"></div>' +
      '<div class="ppmcap-actions" id="ppmcap-actions" hidden>' +
        '<button type="button" class="ppmcap-btn ppmcap-primary" id="ppmcap-save">Save picture</button>' +
        '<button type="button" class="ppmcap-btn" id="ppmcap-copy">Copy</button>' +
      '</div>' +
      '<p class="ppmcap-note" id="ppmcap-note" hidden></p>' +
      '<div class="ppmcap-recent" id="ppmcap-recent" hidden>' +
        '<div class="ppmcap-recent-head"><span>Recent pictures (kept only while this page stays open)</span><button type="button" class="ppmcap-btn" id="ppmcap-clear">Clear</button></div>' +
        '<ul class="ppmcap-list" id="ppmcap-list"></ul>' +
      '</div>';
    drop.parentNode.insertBefore(box, drop.nextSibling);

    ['paste', 'screen', 'window', 'tab', 'delay', 'delay-wrap', 'count', 'count-num', 'cancel', 'msg', 'note', 'recent', 'list', 'clear',
      'prefs', 'hot', 'summary', 'keys', 'keypanel', 'kp-list', 'kp-reset', 'kp-close', 'auto', 'hot-tip', 'actions', 'save', 'copy'].forEach(function (k) { els[k] = $('ppmcap-' + k); });
    els.delay.setAttribute('aria-label', 'Seconds to wait before a whole-screen capture');

    if (!hasCapture || policyBlocked) {
      ['screen', 'window', 'tab'].forEach(function (k) { els[k].hidden = true; });
      els['delay-wrap'].hidden = true;
      els.note.hidden = false;
      els.note.textContent = policyBlocked && hasCapture ? TEXT.noteBlocked : TEXT.noteNoCapture;
      els['hot-tip'].hidden = true; els.auto.parentNode.hidden = true;
    }
    else $('ppmcap-tip').hidden = true;             // the shortcut tip below says the same and more
    keymap = loadKeys();
    showKeys();
    els.auto.checked = getPref(AUTO_STORE, '') === 'on';

    els.paste.addEventListener('click', pasteFromButton);
    els.screen.addEventListener('click', function () { startCapture('monitor'); });
    els.window.addEventListener('click', function () { startCapture('window'); });
    els.tab.addEventListener('click', function () { startCapture('browser'); });
    els.cancel.addEventListener('click', function () { if (cancelNow) cancelNow('cancelled'); });
    els.clear.addEventListener('click', clearRecent);
    els.list.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-id]') : null;
      if (!b) return;
      for (var i = 0; i < recent.length; i++) if (String(recent[i].id) === b.getAttribute('data-id')) { reopen(recent[i]); break; }
    });
    document.addEventListener('paste', onPaste);
    els.auto.addEventListener('change', function () { setPref(AUTO_STORE, els.auto.checked ? 'on' : null); });
    els.keys.addEventListener('click', function () { togglePanel(els.keypanel.hidden); });
    els['kp-close'].addEventListener('click', function () { togglePanel(false); });
    els['kp-reset'].addEventListener('click', function () { stopRecording(); keymap = defaults(); saveKeys(); showKeys(); say('ok', 'Shortcuts are back to the original keys.'); });
    els['kp-list'].addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act]') : null;
      if (!b) return;
      var id = b.getAttribute('data-for');
      if (b.getAttribute('data-act') === 'change') startRecording(id);
      else { stopRecording(); keymap[id] = ''; saveKeys(); showKeys(); say('info', actionLabel(id) + ': no shortcut.'); }
    });
    els.save.addEventListener('click', saveCurrent);
    els.copy.addEventListener('click', copyLatest);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('pagehide', function () { if (active) active(); });
  }

  function say(kind, text) { els.msg.className = 'ppmcap-msg ppmcap-' + kind; els.msg.textContent = text; }
  function setBusy(on) {
    busy = on;
    ['screen', 'window', 'tab'].forEach(function (k) { if (els[k]) els[k].setAttribute('aria-disabled', on ? 'true' : 'false'); });
  }

  // ---------------------------------------------------------------------------------------------- hand over to the editor
  // The editor listens to its file input. Giving it the picture through that input keeps this script out of the editor's code.
  function deliver(file) {
    var input = $('markup-input');
    if (!input) return false;
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    } catch (e) { return false; }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // The editor shows "Loading image..." while it works and clears it when done; a failure leaves an error there.
  function editorSettled(w, h) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function tick() {
        var st = $('markup-status'), ws = $('markup-workspace'), c = $('markup-base-canvas');
        var showing = st && st.classList.contains('show');
        if (showing && st.classList.contains('error')) return resolve(false);
        var loading = showing && st.classList.contains('info');
        var open = ws && ws.style.display !== 'none' && c && c.width === w && c.height === h;
        if (!loading && open) return resolve(true);
        if (Date.now() - t0 > 8000) return resolve(false);
        setTimeout(tick, 40);
      })();
    });
  }

  function decode(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
      img.src = url;
    });
  }
  function thumbOf(img, w, h) {
    var s = Math.min(96 / w, 54 / h, 1), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }
  var EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp' };

  // A picture arrives (pasted or captured): check it, remember it, open it in the editor, say what happened.
  async function takeIn(blob, source, extra) {
    extra = extra || {};
    var img, w, h, thumb;
    try {
      img = await decode(blob);
      w = img.width; h = img.height;
      thumb = thumbOf(img, w, h);
      if (img.close) img.close();
    } catch (e) {
      say('error', TEXT.unreadable);
      return false;
    }
    var now = new Date();
    var type = blob.type && /^image\//.test(blob.type) ? blob.type : 'image/png';
    var file = new File([blob], (source === 'capture' ? 'capture-' : 'pasted-') + stamp(now) + '.' + (EXT[type] || 'png'), { type: type });
    var entry = { id: ++nextId, file: file, w: w, h: h, thumb: thumb, time: now };
    remember(entry);
    latest = entry;
    els.actions.hidden = false;                       // Save / Copy are offered as soon as the picture exists
    var ok = await openInEditor(file, w, h, source === 'capture' ? 'Captured' : 'Pasted', extra);
    if (source === 'capture' && els.auto.checked) {
      saveFile(file);
      say('ok', 'Captured ' + w + ' × ' + h + ' px and saved it as ' + file.name + '. It is open below to mark up; press Download for the marked-up copy.');
    }
    return ok;
  }

  async function openInEditor(file, w, h, verb, extra) {
    extra = extra || {};
    if (!deliver(file)) { say('error', TEXT.noHandoff); return false; }
    var ok = await editorSettled(w, h);
    if (!ok) { say('error', TEXT.editorFailed); return false; }
    var ws = $('markup-workspace');
    if (ws && ws.scrollIntoView) { try { ws.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
    if (extra.black) say('error', verb + ' ' + w + ' × ' + h + ' px, but the picture is completely black. Some windows (video players, protected content) cannot be captured this way. Try capturing the whole screen instead.');
    else say('ok', verb + ' ' + w + ' × ' + h + ' px. Save it now with “Save picture”, or mark it up below and press Download.');
    return true;
  }

  function reopen(entry) { latest = entry; els.actions.hidden = false; openInEditor(entry.file, entry.w, entry.h, 'Opened', null); }

  // ---------------------------------------------------------------------------------------------- recent pictures
  function remember(entry) {
    recent.unshift(entry);
    while (recent.length > MAX_RECENT) recent.pop();
    renderRecent();
  }
  function renderRecent() {
    els.list.innerHTML = '';
    recent.forEach(function (e) {
      var li = document.createElement('li'), b = document.createElement('button'), im = document.createElement('img'), sp = document.createElement('span');
      b.type = 'button'; b.className = 'ppmcap-thumb'; b.setAttribute('data-id', String(e.id));
      b.setAttribute('aria-label', 'Open the picture from ' + clock(e.time) + ', ' + e.w + ' by ' + e.h + ' pixels');
      im.src = e.thumb; im.alt = ''; sp.textContent = clock(e.time);
      b.appendChild(im); b.appendChild(sp); li.appendChild(b); els.list.appendChild(li);
    });
    els.recent.hidden = recent.length === 0;
  }
  function clearRecent() { recent = []; latest = null; els.actions.hidden = true; renderRecent(); }

  // ---------------------------------------------------------------------------------------------- save, copy, shortcut
  function saveFile(file) {
    var url = URL.createObjectURL(file), a = document.createElement('a');
    a.href = url; a.download = file.name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    say('ok', 'Saved ' + file.name + ' to your downloads.');
  }
  async function copyLatest() {
    var pic = await currentPicture();
    if (!pic) { say('info', 'There is no picture yet. Capture or paste one first.'); return; }
    try {
      if (!navigator.clipboard || typeof window.ClipboardItem !== 'function') throw new Error('no');
      var png = pic.type === 'image/png' ? pic : await toPng(await toCanvas(pic));
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': png })]);
      say('ok', 'Copied. Paste it into a chat, an email or a document.');
    } catch (e) { say('error', 'This browser did not let the page copy the picture. Use “Save picture” instead.'); }
  }
  async function toCanvas(blob) {
    var img = await decode(blob), c = document.createElement('canvas');
    c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
    if (img.close) img.close();
    return c;
  }
  function actionLabel(id) { for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i].id === id) return ACTIONS[i].label; return id; }
  function usable(a) { return (a.id !== 'screen' && a.id !== 'window' && a.id !== 'tab') || (hasCapture && !policyBlocked); }
  function showKeys() {
    var parts = [];
    ACTIONS.forEach(function (a) { if (keymap[a.id] && usable(a)) parts.push(comboLabel(keymap[a.id]) + ' ' + a.label.replace(/^Capture (the |a )?/, '').replace(/^(Save|Copy) the picture$/, function (x, v) { return v.toLowerCase(); })); });
    els.summary.textContent = parts.length ? 'Shortcuts: ' + parts.join(' · ') : 'No shortcuts set';
    els['kp-list'].innerHTML = '';
    ACTIONS.forEach(function (a) {
      if (!usable(a)) return;
      var li = document.createElement('li'); li.className = 'ppmcap-kp-row';
      var name = document.createElement('span'); name.className = 'ppmcap-kp-name'; name.textContent = a.label;
      var k = document.createElement('kbd'); k.className = 'ppmcap-kbd' + (recording === a.id ? ' ppmcap-rec' : ''); k.id = 'ppmcap-key-' + a.id;
      k.textContent = recording === a.id ? 'press keys…' : keymap[a.id] ? comboLabel(keymap[a.id]) : 'not set';
      var ch = document.createElement('button'); ch.type = 'button'; ch.className = 'ppmcap-btn'; ch.setAttribute('data-act', 'change'); ch.setAttribute('data-for', a.id);
      ch.id = 'ppmcap-change-' + a.id; ch.textContent = recording === a.id ? 'Press keys (Esc: cancel)' : 'Change';
      ch.setAttribute('aria-label', 'Change the shortcut for: ' + a.label);
      var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'ppmcap-btn'; rm.setAttribute('data-act', 'clear'); rm.setAttribute('data-for', a.id);
      rm.id = 'ppmcap-clear-' + a.id; rm.textContent = 'Remove'; if (!keymap[a.id]) { rm.style.visibility = 'hidden'; rm.tabIndex = -1; rm.setAttribute('aria-hidden', 'true'); } rm.setAttribute('aria-label', 'Remove the shortcut for: ' + a.label);
      li.appendChild(name); li.appendChild(k); li.appendChild(ch); li.appendChild(rm); els['kp-list'].appendChild(li);
    });
  }
  function togglePanel(open) {
    if (!open) stopRecording();
    els.keypanel.hidden = !open; els.keys.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  var recording = null;
  function onRec(e) {
    if (!recording) return;
    if (/^(Control|Alt|Shift|Meta|OS|AltGraph|Process|Unidentified)$/.test(e.key) || e.isComposing) return;    // wait for the actual key
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey) { var was = recording; stopRecording(); say('info', actionLabel(was) + ': shortcut unchanged.'); return; }
    var c = comboOf(e), v = judge(c);
    if (v && v.no) { say('error', v.no); return; }
    var id = recording, moved = null;
    ACTIONS.forEach(function (a) { if (a.id !== id && keymap[a.id] === c) { keymap[a.id] = ''; moved = a.label; } });
    keymap[id] = c; saveKeys(); stopRecording();
    say(v && v.note ? 'info' : 'ok', actionLabel(id) + ': ' + comboLabel(c) + '.' + (moved ? ' (Taken from “' + moved + '”, which now has no shortcut.)' : '') + (v && v.note ? ' ' + v.note : ''));
  }
  function startRecording(id) {
    if (recording === id) { stopRecording(); return; }
    recording = id; showKeys();
    document.addEventListener('keydown', onRec, true);
    say('info', 'Press the keys for “' + actionLabel(id) + '”: a letter, number or F key, alone or with Ctrl, Alt or Shift. Esc cancels.');
    var b = $('ppmcap-change-' + id); if (b) b.focus();
  }
  function stopRecording() {
    if (!recording) return;
    recording = null; document.removeEventListener('keydown', onRec, true); showKeys();
  }
  function editorOpen() { var ws = $('markup-workspace'); return !!ws && ws.style.display !== 'none' && ws.offsetParent !== null; }
  // The picture as it is now: with the marks drawn in the editor, or the one taken last.
  function currentPicture() {
    var c = $('markup-base-canvas');
    if (editorOpen() && c && c.width) return toPng(c).then(function (b) { return new File([b], 'screenshot-' + stamp(new Date()) + '.png', { type: 'image/png' }); });
    return Promise.resolve(latest ? latest.file : null);
  }
  function saveCurrent() { currentPicture().then(function (f) { if (f) saveFile(f); else say('info', 'There is no picture yet. Capture or paste one first.'); }); }
  function onKeyDown(e) {
    if (recording || e.defaultPrevented || !markupIsOpen() || e.repeat) return;
    if (isEditable(e.target)) return;                  // typing in a box never triggers a shortcut
    var c = comboOf(e);
    if (!c) return;
    var act = null;
    ACTIONS.forEach(function (a) { if (!act && keymap[a.id] === c && usable(a)) act = a.id; });
    if (!act) return;
    e.preventDefault();
    if (act === 'save') return saveCurrent();
    if (act === 'copy') return copyLatest();
    if (busy) { say('info', 'A capture is already running.'); return; }
    startCapture(act === 'screen' ? 'monitor' : act === 'window' ? 'window' : 'browser');   // a key press counts as the click the browser asks for
  }

  // ---------------------------------------------------------------------------------------------- paste
  function firstImage(cd) {
    var i, f;
    if (cd.files) for (i = 0; i < cd.files.length; i++) if (/^image\//.test(cd.files[i].type)) return cd.files[i];
    if (cd.items) for (i = 0; i < cd.items.length; i++) {
      if (cd.items[i].kind === 'file' && /^image\//.test(cd.items[i].type)) { f = cd.items[i].getAsFile(); if (f) return f; }
    }
    return null;
  }
  function hasText(cd) { return !!cd.types && Array.prototype.indexOf.call(cd.types, 'text/plain') >= 0; }
  function isEditable(t) { return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
  function markupIsOpen() { var p = $('panel-markup'); return !p || p.classList.contains('active'); }

  function onPaste(e) {
    if (!markupIsOpen()) return;
    var cd = e.clipboardData;
    if (!cd) return;
    var file = firstImage(cd);
    if (!file) return;                                     // text, or something that is not a picture: leave it alone
    var t = e.target;
    if (isEditable(t)) {
      if (hasText(cd)) return;                             // the person is pasting text into a field
      var wrap = $('markup-canvas-wrap');
      if (wrap && wrap.contains(t)) return;                // never swap the picture while a label is being typed on it
    }
    e.preventDefault();
    takeIn(file, 'paste');
  }

  async function pasteFromButton() {
    var cb = navigator.clipboard;
    if (!cb || typeof cb.read !== 'function') { say('info', TEXT.useCtrlV); return; }
    var items;
    try { items = await cb.read(); } catch (e) { say('info', TEXT.useCtrlV); return; }
    for (var i = 0; i < items.length; i++) {
      var types = items[i].types || [];
      for (var j = 0; j < types.length; j++) {
        if (/^image\//.test(types[j])) {
          var blob;
          try { blob = await items[i].getType(types[j]); } catch (e) { say('info', TEXT.useCtrlV); return; }
          takeIn(blob, 'paste');
          return;
        }
      }
    }
    say('info', TEXT.noPicture);
  }

  // ---------------------------------------------------------------------------------------------- capture
  function CancelError(why) { this.name = 'CancelError'; this.why = why; }

  function withTimeout(p, ms, what) {
    return new Promise(function (resolve, reject) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; reject(new Error(what + ' timed out')); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } }, function (e) { if (!done) { done = true; clearTimeout(t); reject(e); } });
    });
  }

  // A hidden <video> that plays the stream; it is the usual way to read a frame. `ready` resolves once a frame has been decoded
  // (or after READY_MS, when the stream is read directly instead).
  function startFeed(stream) {
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute('aria-hidden', 'true');
    v.style.cssText = 'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    v.srcObject = stream;
    document.body.appendChild(v);
    try { var pl = v.play(); if (pl && pl.catch) pl.catch(function () { /* autoplay still starts it, or the stream is read directly */ }); } catch (e) { /* same */ }
    var ready = new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        if ((v.readyState >= 2 && v.videoWidth > 0) || Date.now() - t0 > READY_MS) return resolve();
        setTimeout(poll, 30);
      })();
    });
    return {
      video: v, ready: ready,
      dispose: function () { try { v.pause(); } catch (e) { /* ignore */ } v.srcObject = null; if (v.parentNode) v.parentNode.removeChild(v); }
    };
  }

  function fromVideo(feed) {
    var v = feed.video;
    if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) throw new Error('video has no frame');
    var c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c;
  }
  async function fromTrack(track) {
    if (typeof window.ImageCapture !== 'function') throw new Error('no ImageCapture');
    var bmp = await withTimeout(new window.ImageCapture(track).grabFrame(), 3000, 'grabFrame');
    var c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    if (bmp.close) bmp.close();
    return c;
  }
  // Two ways to read the latest frame: the hidden <video>, or the track itself (ImageCapture). Browsers stop painting a <video>
  // in a background tab, so then the track goes first. A black frame is not trusted: the other way is tried, then the
  // whole thing again a moment later; only when everything stays black is the black picture handed over (with a warning).
  async function grabPicture(feed, track) {
    var order = document.visibilityState === 'hidden' ? ['track', 'video'] : ['video', 'track'];
    var firstBlack = null, lastError = null;
    for (var round = 0; round < BLACK_TRIES; round++) {
      for (var k = 0; k < order.length; k++) {
        var canvas = null;
        try {
          if (order[k] === 'video') { await feed.ready; canvas = fromVideo(feed); }
          else canvas = await fromTrack(track);
        } catch (e) { lastError = e; continue; }
        if (!looksBlack(canvas)) return { canvas: canvas, black: false };
        if (!firstBlack) firstBlack = canvas;
      }
      if (round < BLACK_TRIES - 1) await sleep(250);
    }
    if (firstBlack) return { canvas: firstBlack, black: true };
    throw lastError || new Error('The browser delivered no picture.');
  }
  function looksBlack(canvas) {
    var s = document.createElement('canvas');
    s.width = 64; s.height = 36;
    var g = s.getContext('2d', { willReadFrequently: true });
    g.drawImage(canvas, 0, 0, 64, 36);
    var d = g.getImageData(0, 0, 64, 36).data;
    for (var i = 0; i < d.length; i += 4) if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) return false;
    return true;
  }
  function toPng(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { if (b) resolve(b); else reject(new Error('This picture is too large for the browser to save.')); }, 'image/png');
    });
  }

  function countdown(seconds, onEndedHook) {
    return new Promise(function (resolve, reject) {
      var end = Date.now() + seconds * 1000, timer = null, title = document.title;
      els.count.hidden = false;
      say('sr', 'Capturing the whole screen in ' + seconds + ' seconds. Switch to what you want in the picture, or press Cancel.');
      function cleanup() {
        clearTimeout(timer);
        document.removeEventListener('keydown', onKey);
        els.count.hidden = true;
        document.title = title;
        cancelNow = null; onEndedHook.fn = null;
      }
      function onKey(e) { if (e.key === 'Escape') { cleanup(); reject(new CancelError('cancelled')); } }
      document.addEventListener('keydown', onKey);
      cancelNow = function (why) { cleanup(); reject(new CancelError(why)); };
      onEndedHook.fn = function () { cleanup(); reject(new CancelError('stopped')); };
      (function tick() {
        var left = end - Date.now();
        if (left <= 0) { cleanup(); resolve(); return; }
        var n = Math.ceil(left / 1000);
        els['count-num'].textContent = String(n);
        document.title = '(' + n + ') ' + title;
        timer = setTimeout(tick, Math.min(250, left));
      })();
    });
  }

  function messageFor(e) {
    var name = e && e.name, text = (e && e.message) || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      if (/policy|disallowed/i.test(text)) return TEXT.blocked;
      if (/system/i.test(text)) return TEXT.osDenied;
      return TEXT.cancelled;
    }
    if (name === 'NotReadableError') return TEXT.wouldNotStart;
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return TEXT.nothing;
    if (name === 'AbortError') return TEXT.interrupted;
    return 'Could not capture: ' + (text || name || 'unknown error');
  }

  async function startCapture(kind) {
    if (busy) return;
    if (!hasCapture) return;
    setBusy(true);
    say('info', TEXT.choose);
    var stream = null, feed = null, endedHook = { fn: null };
    try {
      var opts = { video: { displaySurface: kind }, audio: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'exclude' };
      var controller = null;
      if (typeof window.CaptureController === 'function') { try { controller = new window.CaptureController(); opts.controller = controller; } catch (e) { controller = null; } }
      stream = await md.getDisplayMedia(opts);           // called straight from the click: browsers insist on that
      if (controller && typeof controller.setFocusBehavior === 'function') { try { controller.setFocusBehavior('no-focus-change'); } catch (e) { /* not for whole screens */ } }
      var track = stream.getVideoTracks()[0];
      if (!track) throw new Error('The browser shared no picture.');
      var surface = kind;
      try { surface = (track.getSettings() || {}).displaySurface || kind; } catch (e) { /* keep the button's kind */ }
      track.addEventListener('ended', function () { if (endedHook.fn) endedHook.fn(); });
      active = function () { stopAll(stream, feed); };
      feed = startFeed(stream);
      // What was really shared decides: in some browsers a whole screen can be picked after pressing "window".
      if (surface === 'monitor') await countdown(parseInt(els.delay.value, 10) || 5, endedHook);
      if (track.readyState === 'ended') throw new CancelError('stopped');
      say('info', 'Taking the picture…');
      var shot = await grabPicture(feed, track);
      var blob = await toPng(shot.canvas);
      stopAll(stream, feed); stream = null; feed = null; active = null;
      await takeIn(blob, 'capture', { black: shot.black });
    } catch (e) {
      if (e instanceof CancelError) say('info', e.why === 'stopped' ? TEXT.stopped : TEXT.cancelled);
      else say('error', messageFor(e));
    } finally {
      stopAll(stream, feed);
      active = null;
      setBusy(false);
    }
  }

  function stopAll(stream, feed) {
    if (feed) feed.dispose();
    if (stream) stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* ignore */ } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
