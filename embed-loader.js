// PopPopMake embed loader
// Usage on any site:
//   <div data-poppopmake-widget="paycheck-calculator"></div>
//   <script src="https://poppopmake.com/embed-loader.js" async></script>
(function () {
  var ORIGIN = 'https://poppopmake.com';
  var counter = 0;

  function createWidget(el) {
    if (el.getAttribute('data-ppm-loaded')) return;
    el.setAttribute('data-ppm-loaded', 'true');

    var widgetName = el.getAttribute('data-poppopmake-widget');
    if (!widgetName) return;

    counter++;
    var instanceId = 'ppm-' + widgetName + '-' + counter + '-' + Date.now();

    var iframe = document.createElement('iframe');
    iframe.src = ORIGIN + '/embed/' + widgetName + '.html?instance=' + encodeURIComponent(instanceId);
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    iframe.style.minHeight = '380px';
    iframe.setAttribute('data-ppm-instance', instanceId);
    iframe.setAttribute('title', 'PopPopMake: ' + widgetName);
    iframe.setAttribute('loading', 'lazy');
    el.appendChild(iframe);
  }

  function init() {
    var els = document.querySelectorAll('[data-poppopmake-widget]');
    for (var i = 0; i < els.length; i++) createWidget(els[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== ORIGIN) return;
    if (!e.data || e.data.type !== 'poppopmake-embed-resize') return;
    var iframe = document.querySelector('iframe[data-ppm-instance="' + e.data.instance + '"]');
    if (iframe && e.data.height) iframe.style.height = e.data.height + 'px';
  });
})();
