/* PopPopMake — shared cookie consent banner.
   Include on every page with: <script src="/cookie-consent.js"></script>
   Reads the site's own CSS variables (--paper, --ink, --orange, --teal) so it
   matches whichever page it's loaded on without needing its own palette. */
(function () {
  var CONSENT_KEY = 'ppm_cookie_consent';

  function getConsent() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function setConsent(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (e) { /* ignore */ }
  }

  function injectStyles() {
    var css = [
      '#ppm-cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
      'background:var(--card,#fff);border-top:1px solid var(--line,rgba(28,35,33,.12));',
      'box-shadow:0 -8px 24px -12px rgba(28,35,33,.25);}',
      '#ppm-cookie-banner .ppm-inner{max-width:1120px;margin:0 auto;padding:16px 24px;',
      'display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;',
      'font-family:Inter,system-ui,sans-serif;color:var(--ink,#1C2321);}',
      '#ppm-cookie-banner p{margin:0;font-size:.92rem;max-width:60ch;}',
      '#ppm-cookie-banner a{color:var(--teal,#0F8B8D);font-weight:600;text-decoration:underline;}',
      '#ppm-cookie-banner .ppm-actions{display:flex;gap:10px;flex-shrink:0;}',
      '#ppm-cookie-banner button{font-family:Inter,system-ui,sans-serif;font-size:.88rem;',
      'font-weight:600;padding:9px 18px;border-radius:999px;cursor:pointer;border:1px solid transparent;}',
      '#ppm-cookie-banner #ppm-cookie-decline{background:transparent;border-color:var(--line,rgba(28,35,33,.25));color:var(--ink,#1C2321);}',
      '#ppm-cookie-banner #ppm-cookie-accept{background:var(--orange,#F2542D);color:#fff;}',
      '#ppm-cookie-banner button:focus-visible{outline:3px solid var(--teal,#0F8B8D);outline-offset:2px;}',
      '@media (max-width:560px){#ppm-cookie-banner .ppm-inner{flex-direction:column;align-items:stretch;}',
      '#ppm-cookie-banner .ppm-actions{justify-content:flex-end;}}'
    ].join('');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();
    var banner = document.createElement('div');
    banner.id = 'ppm-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie notice');
    banner.innerHTML =
      '<div class="ppm-inner">' +
        '<p>We use cookies for basic analytics and to show ads that keep these tools free. ' +
        '<a href="/privacy.html">Learn more</a></p>' +
        '<div class="ppm-actions">' +
          '<button type="button" id="ppm-cookie-decline">Decline</button>' +
          '<button type="button" id="ppm-cookie-accept">Accept</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('ppm-cookie-accept').addEventListener('click', function () {
      setConsent('accepted');
      banner.remove();
      // When Google Analytics / AdSense are added later (roadmap step 7-8),
      // initialize them here (or call gtag('consent','update',{...})) so they
      // only run after the visitor has actually said yes.
      document.dispatchEvent(new CustomEvent('ppm-consent-accepted'));
    });
    document.getElementById('ppm-cookie-decline').addEventListener('click', function () {
      setConsent('declined');
      banner.remove();
    });
  }

  function init() {
    var consent = getConsent();
    if (consent === 'accepted') {
      document.dispatchEvent(new CustomEvent('ppm-consent-accepted'));
    } else if (!consent) {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
