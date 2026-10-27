/* PopPopMake Vault — where desktop note windows go: sticking to a neighbour or the screen edge when dropped close to it,
 * and a tidy column layout. Pure geometry (no screen code), so it can be tested on its own.
 * Rectangles are { x, y, w, h } in screen pixels (outer window size).
 */
(function (root) {
  'use strict';
  function overlaps(a1, a2, b1, b2, slack) { return a1 < b2 + slack && b1 < a2 + slack; }
  function nearest(cur, cands, dist) {
    var best = null;
    cands.forEach(function (c) { var d = Math.abs(c - cur); if (d <= dist && (best === null || d < Math.abs(best - cur))) best = c; });
    return best === null ? cur : best;
  }
  // me: the window that was just moved; others: the other note windows; area: the usable screen.
  function snap(me, others, area, dist) {
    dist = dist || 20;
    var xs = [area.x, area.x + area.w - me.w], ys = [area.y, area.y + area.h - me.h];
    others.forEach(function (o) {
      var vert = overlaps(me.y, me.y + me.h, o.y, o.y + o.h, dist), horiz = overlaps(me.x, me.x + me.w, o.x, o.x + o.w, dist);
      if (vert) { xs.push(o.x + o.w, o.x - me.w); }                 // side by side
      if (horiz) { ys.push(o.y + o.h, o.y - me.h); }                // one above the other
      if (vert && (Math.abs(me.x - (o.x + o.w)) <= dist || Math.abs(me.x + me.w - o.x) <= dist)) ys.push(o.y, o.y + o.h - me.h);   // line up tops / bottoms
      if (horiz && (Math.abs(me.y - (o.y + o.h)) <= dist || Math.abs(me.y + me.h - o.y) <= dist)) xs.push(o.x, o.x + o.w - me.w); // line up left / right edges
    });
    var x = nearest(me.x, xs, dist), y = nearest(me.y, ys, dist);
    x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.w - me.w));
    y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.h - me.h));
    return { x: Math.round(x), y: Math.round(y) };
  }
  // n windows of one size, in columns from the top-right corner; when they don't all fit, the rest cascade on screen.
  function arrange(n, area, size, gap) {
    gap = gap || 8;
    var rows = Math.max(1, Math.floor((area.h + gap) / (size.h + gap))), cols = Math.max(1, Math.floor((area.w + gap) / (size.w + gap)));
    var out = [];
    for (var i = 0; i < n; i++) {
      var c = Math.floor(i / rows), r = i % rows, x, y;
      if (c < cols) { x = area.x + area.w - size.w - c * (size.w + gap); y = area.y + r * (size.h + gap); }
      else { var k = i - rows * cols; x = area.x + area.w - size.w - (k * 24) % Math.max(24, area.w - size.w); y = area.y + 24 + (k * 24) % Math.max(24, area.h - size.h - 24); }
      x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.w - size.w));
      y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.h - size.h));
      out.push({ x: Math.round(x), y: Math.round(y) });
    }
    return out;
  }
  var api = { snap: snap, arrange: arrange };
  root.VaultSnap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
