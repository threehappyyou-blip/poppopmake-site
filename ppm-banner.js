// PopPopMake sponsor banners: picks the banner to show from /ads.json and draws it.
// Used by the site pages (ppm-app.js) and by the Budget, Notes & Diary app, so both follow the same rules.
// Banners are pictures stored on this site (/ads/...) with a plain link: no ad network, no cookies, no tracking script.
(function (root) {
  'use strict';
  var SIZES = { wide: [728, 90], mobile: [320, 100] };

  function day(d) {                                    // YYYY-MM-DD in the viewer's own time zone
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function okImage(s) { return typeof s === 'string' && /^\/ads\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif|svg)$/i.test(s); }
  function okLink(s) { try { var u = new URL(s); return u.protocol === 'https:'; } catch (e) { return false; } }
  function okDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  // pages: ["*"] = everywhere; otherwise a list of paths ("/mortgage-calculator") or prefixes ending in * ("/manual*")
  function onPage(pages, path, where) {
    var p = String(path || '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    if (where === 'vault') return Array.isArray(pages) && pages.indexOf('vault') >= 0;
    if (!Array.isArray(pages) || !pages.length) pages = ['*'];
    for (var i = 0; i < pages.length; i++) {
      var r = String(pages[i]);
      if (r === '*') return true;
      if (r.slice(-1) === '*' && p.indexOf(r.slice(0, -1)) === 0) return true;
      if ((r.replace(/\/+$/, '') || '/') === p) return true;
    }
    return false;
  }
  // The banners that may show on this page today. A banner without the needed fields is skipped (and reported).
  function eligible(cfg, path, now, where) {
    var out = [], bad = [], today = day(now || new Date());
    var list = cfg && Array.isArray(cfg.banners) ? cfg.banners : [];
    list.forEach(function (b, i) {
      if (!b || typeof b !== 'object' || b.off === true) return;
      var why = !okImage(b.image) ? 'image must be a file in /ads/' : !okLink(b.link) ? 'link must start with https://' :
        !b.alt ? 'alt text missing' : (b.imageMobile && !okImage(b.imageMobile)) ? 'imageMobile must be a file in /ads/' :
        (b.start && !okDate(b.start)) || (b.end && !okDate(b.end)) ? 'dates must look like 2026-11-30' : '';
      if (why) { bad.push((b.id || '#' + (i + 1)) + ': ' + why); return; }
      if (b.start && today < b.start) return;
      if (b.end && today > b.end) return;
      if (!onPage(b.pages, path, where)) return;
      out.push(b);
    });
    if (bad.length && root.console) root.console.warn('ads.json: skipped ' + bad.join('; '));
    return out;
  }
  function pick(cfg, path, now, rand, where) {
    var list = eligible(cfg, path, now, where);
    if (!list.length) return null;
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += Math.max(1, Number(list[i].weight) || 1);
    var x = (typeof rand === 'number' ? rand : Math.random()) * total;
    for (i = 0; i < list.length; i++) { x -= Math.max(1, Number(list[i].weight) || 1); if (x < 0) return list[i]; }
    return list[list.length - 1];
  }
  // The advertiser can see the visits in their own analytics; nothing is counted here.
  function linkFor(b, where) {
    var u = new URL(b.link);
    if (!u.searchParams.has('utm_source')) {
      u.searchParams.set('utm_source', 'poppopmake'); u.searchParams.set('utm_medium', 'banner');
      u.searchParams.set('utm_campaign', String(b.id || 'banner').slice(0, 60));
      if (where === 'vault') u.searchParams.set('utm_content', 'app');
    }
    return u.toString();
  }
  function el(tag, attrs) {
    var e = document.createElement(tag);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    return e;
  }
  // Draws the banner into box: [Sponsored · advertiser]  [picture as a link]
  function render(box, b, opts) {
    opts = opts || {};
    var a = el('a', { href: linkFor(b, opts.where), target: '_blank', rel: 'sponsored noopener noreferrer', class: 'ppm-ad-link', 'data-banner': b.id || '' });
    var pic = document.createElement('picture');
    if (b.imageMobile) pic.appendChild(el('source', { media: '(max-width: 600px)', srcset: b.imageMobile, width: SIZES.mobile[0], height: SIZES.mobile[1] }));
    pic.appendChild(el('img', { src: b.image, alt: String(b.alt).slice(0, 200), width: SIZES.wide[0], height: SIZES.wide[1], loading: 'lazy', decoding: 'async', class: 'ppm-ad-img' }));
    a.appendChild(pic);
    var label = el('p', { class: 'ppm-ad-label' });
    label.appendChild(document.createTextNode((opts.sponsored || 'Sponsored') + (b.advertiser ? ' · ' + String(b.advertiser).slice(0, 60) : '')));
    if (opts.advertiseHref) {
      label.appendChild(document.createTextNode(' · '));
      var adv = el('a', { href: opts.advertiseHref, class: 'ppm-ad-adv' }); adv.textContent = opts.advertiseText || 'Advertise here';
      if (opts.newTab) { adv.setAttribute('target', '_blank'); adv.setAttribute('rel', 'noopener'); }
      label.appendChild(adv);
    }
    box.textContent = '';
    box.appendChild(label); box.appendChild(a);
    box.hidden = false;
    return a;
  }
  root.PPMBanner = { pick: pick, eligible: eligible, render: render, linkFor: linkFor, day: day, SIZES: SIZES };
})(typeof window !== 'undefined' ? window : this);
