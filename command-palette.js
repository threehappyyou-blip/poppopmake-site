/* PopPopMake — shared command palette (Cmd+K / Ctrl+K quick search).
   Include on any page with: <script src="/command-palette.js"></script>
   Injects a small search trigger into the header nav, and opens on
   Cmd+K (Mac) / Ctrl+K (Windows, Linux) from anywhere on the page. */
(function () {
  var COMMANDS = [
    { title: 'Home', desc: 'Back to the homepage', href: '/', kw: 'homepage main all tools' },
    { title: 'Document & Image Tools', desc: 'Merge, split PDFs · JPG/PNG to PDF · remove backgrounds', href: '/document-tools.html', kw: 'pdf merge split convert image jpg png background remove document' },
    { title: 'Paycheck Calculator (US)', desc: 'Federal tax, FICA, all 50 states', href: '/paycheck-calculator.html', kw: 'tax salary income take-home money usa america paycheck' },
    { title: 'Paycheck Calculator by State', desc: 'Dedicated page for each U.S. state, grouped by tax type', href: '/paycheck-states.html', kw: 'state texas california new york florida paycheck tax browse' },
    { title: 'Mortgage Calculator', desc: 'Monthly payment with tax, insurance, and PMI', href: '/mortgage-calculator.html', kw: 'mortgage home loan house payment pmi property tax insurance' },
    { title: '401(k) Retirement Calculator', desc: 'Projected balance from contributions, match, and growth', href: '/retirement-calculator.html', kw: 'retirement 401k pension savings employer match compound growth' },
    { title: 'Capital Gains Tax Calculator', desc: 'Stocks and crypto, short vs long-term, NIIT', href: '/capital-gains-calculator.html', kw: 'capital gains crypto stock tax cost basis niit short term long term' },
    { title: 'Compare Take-Home Pay', desc: 'Any US state, UK region, Australia, or Canadian province', href: '/compare-takehome.html', kw: 'compare relocate move states countries salary offer job international' },
    { title: 'UK Paycheck Calculator', desc: 'Income Tax and National Insurance, England/Wales/NI or Scotland', href: '/uk-paycheck-calculator.html', kw: 'tax salary income take-home money uk britain scotland paycheck' },
    { title: 'Australia Paycheck Calculator', desc: 'Income tax, LITO, and the Medicare levy', href: '/au-paycheck-calculator.html', kw: 'tax salary income take-home money australia medicare levy paycheck' },
    { title: 'Canada Paycheck Calculator', desc: 'Federal + provincial tax, CPP/CPP2, EI, all provinces', href: '/ca-paycheck-calculator.html', kw: 'tax salary income take-home money canada cpp ei ontario quebec alberta paycheck' },
    { title: 'Career Tools', desc: 'Resume builder · ATS score checker', href: '/career-tools.html', kw: 'resume cv job ats career keyword' },
    { title: 'Business Tools', desc: 'Invoice generator · QR code generator', href: '/business-tools.html', kw: 'invoice qr code business billing' },
    { title: 'Writing & AI Tools', desc: 'Flag AI-ish phrases, get plain-language swaps', href: '/writing-tools.html', kw: 'ai writing detector checker text cliche' },
    { title: 'Everyday Tools', desc: 'Age calculator, percentage calculator, tip splitter', href: '/everyday-tools.html', kw: 'age percentage tip split bill calculator birthday' },
    { title: 'Why We Don\u2019t Claim 99% Accuracy', desc: 'The evidence behind AI-detector false positives', href: '/ai-detector-honesty.html', kw: 'ai detector bias stanford false positive accuracy honest' },
    { title: 'Ontario Surtax & Quebec Rules Explained', desc: 'How the Canada calculator handles both, and a bug we caught', href: '/canada-tax-mechanics.html', kw: 'ontario surtax quebec abatement canada tax guide' },
    { title: 'Scotland vs Rest of UK Tax Explained', desc: 'Real numbers: who Scotland\u2019s tax system helps and costs', href: '/uk-scotland-tax-explained.html', kw: 'scotland england wales tax bands guide uk' },
    { title: 'Developer Tools', desc: 'JSON formatter, Base64, UUID generator, color converter', href: '/devtools.html', kw: 'json base64 uuid color hex rgb hsl developer formatter validator' },
    { title: 'Guides', desc: 'Plain-English explainers behind the calculators', href: '/guides.html', kw: 'articles help learn read' },
    { title: 'Embed Our Tools', desc: 'Put a live calculator on your own site, free', href: '/embed.html', kw: 'widget developer iframe embed code' },
    { title: 'Feedback', desc: 'Report a bug or request a tool', href: '/feedback.html', kw: 'bug report contact support request' },
    { title: 'Changelog', desc: 'What shipped, what got fixed, and why', href: '/changelog.html', kw: 'updates news history built in the open' },
    { title: 'Accessibility', desc: 'WCAG 2.1 AA target, what\u2019s checked, what isn\u2019t yet', href: '/accessibility.html', kw: 'a11y screen reader keyboard contrast wcag' },
    { title: 'How This Works', desc: 'Privacy, no limits, no dark patterns', href: '/how-it-works.html', kw: 'privacy trust verify data limits' },
    { title: 'Terms', desc: 'Terms of use', href: '/terms.html', kw: 'legal terms' },
    { title: 'Privacy Policy', desc: 'What data is and isn\u2019t collected', href: '/privacy.html', kw: 'legal data cookies' }
  ];

  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var overlay = null, input = null, list = null, results = [], activeIndex = 0, lastFocused = null;

  function injectStyles() {
    var css = [
      '.ppm-cmdk-trigger{display:inline-flex;align-items:center;gap:6px;background:var(--paper-2,#E4E9E6);',
      'border:1px solid var(--line,rgba(28,35,33,.12));border-radius:8px;padding:6px 10px;',
      'font-family:Inter,system-ui,sans-serif;font-size:0.82rem;color:var(--ink-soft,#4B534F);cursor:pointer;}',
      '.ppm-cmdk-trigger:hover{border-color:var(--teal,#0F8B8D);color:var(--ink,#1C2321);}',
      '.ppm-cmdk-trigger kbd{font-family:"IBM Plex Mono",monospace;font-size:0.72rem;background:var(--card,#fff);',
      'border:1px solid var(--line,rgba(28,35,33,.15));border-radius:4px;padding:1px 5px;}',
      '#ppm-cmdk-overlay{position:fixed;inset:0;z-index:10000;background:rgba(28,35,33,.45);',
      'display:flex;align-items:flex-start;justify-content:center;padding-top:14vh;}',
      '#ppm-cmdk-modal{width:min(560px,90vw);max-height:60vh;display:flex;flex-direction:column;',
      'background:var(--card,#fff);border-radius:14px;box-shadow:0 24px 64px -12px rgba(28,35,33,.4);overflow:hidden;}',
      '#ppm-cmdk-input{border:none;border-bottom:1px solid var(--line,rgba(28,35,33,.12));padding:16px 18px;',
      'font-family:Inter,system-ui,sans-serif;font-size:1.05rem;color:var(--ink,#1C2321);outline:none;width:100%;box-sizing:border-box;}',
      '#ppm-cmdk-list{overflow-y:auto;padding:8px;}',
      '.ppm-cmdk-item{display:block;padding:10px 12px;border-radius:8px;cursor:pointer;text-decoration:none;}',
      '.ppm-cmdk-item.active{background:var(--paper,#EEF1EF);}',
      '.ppm-cmdk-item-title{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:0.94rem;color:var(--ink,#1C2321);}',
      '.ppm-cmdk-item-desc{font-size:0.8rem;color:var(--ink-soft,#4B534F);margin-top:2px;}',
      '#ppm-cmdk-empty{padding:24px 18px;text-align:center;font-size:0.88rem;color:var(--ink-soft,#4B534F);}',
      '#ppm-cmdk-footer{border-top:1px solid var(--line,rgba(28,35,33,.12));padding:8px 16px;',
      'font-family:"IBM Plex Mono",monospace;font-size:0.7rem;color:var(--ink-soft,#4B534F);}',
      '@media (max-width:600px){#ppm-cmdk-overlay{padding-top:8vh;}}'
    ].join('');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function injectTrigger() {
    var nav = document.querySelector('header nav');
    if (!nav) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ppm-cmdk-trigger';
    btn.setAttribute('aria-label', 'Search tools');
    btn.innerHTML = '\uD83D\uDD0D Search <kbd>' + (isMac ? '\u2318' : 'Ctrl') + 'K</kbd>';
    btn.addEventListener('click', open);
    nav.appendChild(btn);
  }

  function render(query) {
    var q = query.trim().toLowerCase();
    results = COMMANDS.filter(function (c) {
      if (!q) return true;
      return (c.title + ' ' + c.desc + ' ' + c.kw).toLowerCase().indexOf(q) !== -1;
    });
    activeIndex = 0;
    list.innerHTML = '';
    if (!results.length) {
      var empty = document.createElement('div');
      empty.id = 'ppm-cmdk-empty';
      empty.textContent = 'Nothing matches "' + query + '".';
      list.appendChild(empty);
      return;
    }
    results.forEach(function (c, i) {
      var a = document.createElement('a');
      a.href = c.href;
      a.className = 'ppm-cmdk-item' + (i === 0 ? ' active' : '');
      a.innerHTML = '<div class="ppm-cmdk-item-title">' + c.title + '</div>' +
        (c.desc ? '<div class="ppm-cmdk-item-desc">' + c.desc + '</div>' : '');
      a.addEventListener('mouseenter', function () { setActive(i); });
      a.addEventListener('click', function () { close(); });
      list.appendChild(a);
    });
  }

  function setActive(i) {
    var items = list.querySelectorAll('.ppm-cmdk-item');
    if (!items.length) return;
    activeIndex = (i + items.length) % items.length;
    items.forEach(function (el, idx) { el.classList.toggle('active', idx === activeIndex); });
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    if (overlay) return;
    lastFocused = document.activeElement;
    injectStyles();

    overlay = document.createElement('div');
    overlay.id = 'ppm-cmdk-overlay';

    var modal = document.createElement('div');
    modal.id = 'ppm-cmdk-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Search tools');

    input = document.createElement('input');
    input.id = 'ppm-cmdk-input';
    input.type = 'text';
    input.placeholder = 'Search tools\u2026';
    input.autocomplete = 'off';

    list = document.createElement('div');
    list.id = 'ppm-cmdk-list';

    var footer = document.createElement('div');
    footer.id = 'ppm-cmdk-footer';
    footer.textContent = '\u2191\u2193 navigate \u00b7 \u21B5 open \u00b7 esc close';

    modal.appendChild(input);
    modal.appendChild(list);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    render('');
    input.focus();

    input.addEventListener('input', function () { render(input.value); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKeydown, true);
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener('keydown', onKeydown, true);
    overlay.remove();
    overlay = null;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKeydown(e) {
    if (!overlay) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      var items = list.querySelectorAll('.ppm-cmdk-item');
      if (items[activeIndex]) { window.location.href = items[activeIndex].getAttribute('href'); }
    }
  }

  function globalKeydown(e) {
    var isK = e.key === 'k' || e.key === 'K';
    if (isK && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      overlay ? close() : open();
    }
  }

  function init() {
    injectTrigger();
    document.addEventListener('keydown', globalKeydown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
