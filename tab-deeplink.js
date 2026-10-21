/* PopPopMake — open the right tab when a tool page is reached by a link like /document-tools#split.
   The tool pages (Documents, Everyday, Career, Business, Writing, Developer) keep several tools behind tabs.
   Without this file the link would land on the first tab; with it, the tab named after the "#" opens.
   It only clicks the tab button, so each page keeps using its own tab code. */
(function () {
  'use strict';

  function tabFor(hash) {
    var id = String(hash || '').replace(/^#/, '');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;           // only plain tab names; never build a selector from anything else
    var buttons = document.querySelectorAll('.tab-btn[data-tab]');
    for (var i = 0; i < buttons.length; i++) if (buttons[i].getAttribute('data-tab') === id) return buttons[i];
    return null;
  }

  function openFromHash() {
    var btn = tabFor(window.location.hash);
    if (!btn) return;
    if (!btn.classList.contains('active')) btn.click();
    var bar = btn.parentNode;
    if (bar && bar.scrollIntoView) {
      var rect = bar.getBoundingClientRect();
      if (rect.top < 0 || rect.top > (window.innerHeight || 800) * 0.35) {          // on a phone the tool is below the fold otherwise
        var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        try { bar.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }); } catch (e) { bar.scrollIntoView(); }
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openFromHash);
  else openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();
