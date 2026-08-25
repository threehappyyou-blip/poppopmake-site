/* PopPopMake — shared "thanks" card.
   Include on any tool page with: <script src="/thanks-card.js"></script>
   Call window.ppmMaybeShowThanks() once, right after a tool action finishes
   successfully (not on page load, not on every keystroke). Shows at most once
   per browser session — it will not nag on a second or third success. */
(function () {
  var SHOWN_KEY = 'ppm_thanks_shown';
  var KOFI_USERNAME = 'YOUR_KOFI_USERNAME'; // <-- replace with your real ko-fi.com username

  function alreadyShown() {
    try { return sessionStorage.getItem(SHOWN_KEY) === '1'; } catch (e) { return false; }
  }
  function markShown() {
    try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch (e) { /* ignore */ }
  }

  function injectStyles() {
    var css = [
      '#ppm-thanks-card{position:fixed;right:20px;bottom:20px;z-index:9998;max-width:280px;',
      'background:var(--card,#fff);border:1px solid var(--line,rgba(28,35,33,.12));',
      'border-radius:14px;padding:18px 20px;box-shadow:0 12px 32px -8px rgba(28,35,33,.25);',
      'font-family:Inter,system-ui,sans-serif;color:var(--ink,#1C2321);',
      'opacity:0;transform:translateY(12px);transition:opacity .25s ease,transform .25s ease;}',
      '#ppm-thanks-card.ppm-thanks-in{opacity:1;transform:translateY(0);}',
      '#ppm-thanks-close{position:absolute;top:8px;right:8px;background:none;border:none;',
      'font-size:1.3rem;line-height:1;cursor:pointer;color:var(--ink-soft,#4B534F);',
      'padding:6px 9px;border-radius:8px;}',
      '#ppm-thanks-close:hover{color:var(--ink,#1C2321);background:var(--paper,#EEF1EF);}',
      '.ppm-thanks-title{margin:0 0 4px;font-weight:700;font-family:"Space Grotesk",sans-serif;font-size:0.98rem;}',
      '.ppm-thanks-sub{margin:0 0 12px;font-size:0.85rem;color:var(--ink-soft,#4B534F);}',
      '#ppm-thanks-kofi{display:inline-flex;align-items:center;gap:6px;background:var(--orange,#F2542D);',
      'color:#fff;text-decoration:none;font-weight:600;font-size:0.88rem;padding:9px 16px;border-radius:999px;}',
      '#ppm-thanks-kofi:hover{opacity:0.92;}',
      '@media (prefers-reduced-motion: reduce){#ppm-thanks-card{transition:none;}}',
      '@media (max-width:480px){#ppm-thanks-card{left:16px;right:16px;bottom:16px;max-width:none;}}'
    ].join('');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showCard() {
    if (alreadyShown()) return;
    markShown();
    injectStyles();

    var card = document.createElement('div');
    card.id = 'ppm-thanks-card';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Support PopPopMake');
    card.innerHTML =
      '<button type="button" id="ppm-thanks-close" aria-label="Close">&times;</button>' +
      '<p class="ppm-thanks-title">Glad this helped.</p>' +
      '<p class="ppm-thanks-sub">If you\u2019d like to say thanks:</p>' +
      '<a href="https://ko-fi.com/' + KOFI_USERNAME + '" target="_blank" rel="noopener" id="ppm-thanks-kofi">' +
      '\u2615 Buy me a coffee</a>';
    document.body.appendChild(card);

    requestAnimationFrame(function () { card.classList.add('ppm-thanks-in'); });

    document.getElementById('ppm-thanks-close').addEventListener('click', function () {
      card.remove();
    });
  }

  window.ppmMaybeShowThanks = showCard;
})();
