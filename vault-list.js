/* PopPopMake Vault — checklist notes: each line "- [ ] text" or "- [x] text". Plain text in, plain text out. */
(function (root) {
  'use strict';
  var RE = /^\s*[-*]?\s*\[( |x|X)\]\s?(.*)$/;
  function parse(text) {
    return String(text || '').split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
      var m = l.match(RE);
      return m ? { done: m[1] !== ' ', text: m[2] } : { done: false, text: l.replace(/^\s*[-*•]\s+/, '') };
    });
  }
  function serialize(items) { return items.map(function (i) { return '- [' + (i.done ? 'x' : ' ') + '] ' + i.text; }).join('\n'); }
  function preview(text) { return parse(text).map(function (i) { return (i.done ? '☑ ' : '☐ ') + i.text; }).join('\n'); }
  function count(text) { var it = parse(text); return { done: it.filter(function (i) { return i.done; }).length, all: it.length }; }
  var api = { parse: parse, serialize: serialize, preview: preview, count: count };
  root.VaultList = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
