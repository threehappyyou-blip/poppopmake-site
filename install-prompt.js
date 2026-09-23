// Shows a small "Install this tool" bar on the flagship tool pages that ship
// their own per-tool manifest (see manifest-<tool>.json). Only ever shows a
// control that actually works:
//   - Android/Chrome/desktop Chromium: real beforeinstallprompt -> real button.
//   - iOS Safari: no beforeinstallprompt exists, so we show a short
//     Share -> Add to Home Screen instruction instead of a dead button.
//   - Anything else (Firefox, in-app webviews, already-installed): nothing
//     shows at all.
(function () {
  var bar = document.getElementById('installBar');
  if (!bar) return;

  // Already running as the installed app? Never show anything.
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isStandalone) return;

  var toolName = bar.getAttribute('data-tool-name') || 'this tool';
  var textEl = document.getElementById('installText');
  var btn = document.getElementById('installBtn');
  var dismissBtn = document.getElementById('installDismiss');
  var STORAGE_KEY = 'ppm-install-dismissed-' + location.pathname;

  function hide() { bar.hidden = true; }
  function show() { bar.hidden = false; }

  var dismissedThisSession = false;
  try { dismissedThisSession = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}

  if (dismissBtn) {
    dismissBtn.addEventListener('click', function () {
      hide();
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    });
  }

  if (dismissedThisSession) return;

  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (textEl) textEl.textContent = 'Install ' + toolName + ' — opens like an app, no browser bar or address bar.';
    if (btn) btn.hidden = false;
    show();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hide();
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  });

  if (btn) {
    btn.addEventListener('click', function () {
      if (!deferredPrompt) { hide(); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        hide();
      }).catch(function () { hide(); });
    });
  }

  // iOS Safari has no beforeinstallprompt at all. Detect iOS Safari
  // specifically (not Chrome/Firefox/Edge on iOS, which just wrap Safari's
  // engine but aren't Safari itself) and show an instruction instead.
  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  if (isIOS && isSafari) {
    if (textEl) textEl.textContent = 'Add ' + toolName + ' to your Home Screen: tap the Share icon, then "Add to Home Screen".';
    if (btn) btn.hidden = true;
    show();
  }
})();
