/*
 * PopPopMake Budget, Notes & Diary: moving everything to another device with a stream of QR codes.
 *
 * What moves is the backup file (vault-core exportBackup): it is already encrypted, so a QR code that someone
 * photographs over your shoulder holds only ciphertext. Nothing goes through a server: one screen shows the codes,
 * the other device's camera reads them. The receiving device opens the data with the sending device's passcode
 * (or recovery code), through the same importBackup the backup file uses.
 *
 * Frame format (plain ASCII so every QR reader returns it unchanged):
 *   PPMQ1|<id>|<index>|<count>|<g|r><hash>|<base64 piece>
 * id    6 characters, new for every send, so pieces of two different sends never mix
 * g/r   the whole payload is gzip-compressed (g) or not (r)
 * hash  first 12 hex characters of SHA-256 of the whole (compressed) payload, checked before anything is used
 * The pieces repeat in a loop; the receiver keeps whatever it has and waits for the ones it missed.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VaultQR = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PREFIX = 'PPMQ1';
  var MAX_FRAMES = 4000;          // about 3 MB; beyond that a backup file is the better way

  function b64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha12(bytes) { return crypto.subtle.digest('SHA-256', bytes).then(function (d) { return hex(d).slice(0, 12); }); }
  function streamBytes(bytes, Stream, kind) {
    var s = new Blob([bytes]).stream().pipeThrough(new Stream(kind));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function canGzip() { return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'; }
  function newId() {
    var a = new Uint8Array(6), abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    crypto.getRandomValues(a);
    for (var i = 0; i < 6; i++) s += abc[a[i] % abc.length];
    return s;
  }

  // text -> the list of frame strings. piece = base64 characters per frame.
  function encode(text, piece, opts) {
    piece = Math.max(100, Math.min(2000, piece || 800));
    opts = opts || {};
    var raw = new TextEncoder().encode(text);
    var useGz = opts.gzip !== false && canGzip();
    return (useGz ? streamBytes(raw, CompressionStream, 'gzip') : Promise.resolve(raw)).then(function (body) {
      return sha12(body).then(function (h) {
        var all = b64(body), n = Math.max(1, Math.ceil(all.length / piece));
        if (n > MAX_FRAMES) { var e = new Error('too-big'); e.code = 'too-big'; e.frames = n; throw e; }
        var id = opts.id || newId(), frames = [];
        for (var i = 0; i < n; i++) frames.push([PREFIX, id, i, n, (useGz ? 'g' : 'r') + h, all.slice(i * piece, (i + 1) * piece)].join('|'));
        return { id: id, frames: frames, count: n, bytes: body.length, textBytes: raw.length, gzip: useGz };
      });
    });
  }

  function parse(s) {
    if (typeof s !== 'string' || s.length > 4000) return null;
    var p = s.split('|');
    if (p.length !== 6 || p[0] !== PREFIX || !/^[A-Z2-9]{6}$/.test(p[1]) || !/^\d{1,5}$/.test(p[2]) || !/^\d{1,5}$/.test(p[3]) ||
      !/^[gr][0-9a-f]{12}$/.test(p[4]) || !/^[A-Za-z0-9+/=]*$/.test(p[5])) return null;
    var i = +p[2], n = +p[3];
    if (n < 1 || n > MAX_FRAMES || i >= n) return null;
    return { id: p[1], i: i, n: n, gzip: p[4][0] === 'g', hash: p[4].slice(1), data: p[5] };
  }

  // Collects frames. add(str) -> { state: 'ignored' | 'new' | 'dup' | 'other' , have, count }.
  // The first valid frame decides which send we follow; frames of another send come back as 'other'.
  function Receiver() { this.id = null; this.parts = null; this.have = 0; this.count = 0; this.meta = null; }
  Receiver.prototype.add = function (s) {
    var f = parse(s);
    if (!f) return { state: 'ignored', have: this.have, count: this.count };
    if (this.id === null) { this.id = f.id; this.count = f.n; this.parts = new Array(f.n); this.meta = { gzip: f.gzip, hash: f.hash }; }
    if (f.id !== this.id || f.n !== this.count || f.hash !== this.meta.hash || f.gzip !== this.meta.gzip) return { state: 'other', have: this.have, count: this.count };
    if (this.parts[f.i] !== undefined) return { state: 'dup', have: this.have, count: this.count };
    this.parts[f.i] = f.data; this.have++;
    return { state: 'new', have: this.have, count: this.count };
  };
  Receiver.prototype.done = function () { return this.count > 0 && this.have === this.count; };
  Receiver.prototype.missing = function () {
    var m = [];
    if (this.parts) for (var i = 0; i < this.count; i++) if (this.parts[i] === undefined) m.push(i);
    return m;
  };
  // -> Promise<text>; rejects with code 'damaged' if the pieces don't add up, 'no-gzip' if this browser can't unpack.
  Receiver.prototype.text = function () {
    var self = this;
    return Promise.resolve().then(function () {
      if (!self.done()) { var e0 = new Error('incomplete'); e0.code = 'incomplete'; throw e0; }
      var body;
      try { body = unb64(self.parts.join('')); } catch (e) { var e1 = new Error('damaged'); e1.code = 'damaged'; throw e1; }
      return sha12(body).then(function (h) {
        if (h !== self.meta.hash) { var e2 = new Error('damaged'); e2.code = 'damaged'; throw e2; }
        if (!self.meta.gzip) return body;
        if (!canGzip()) { var e3 = new Error('no-gzip'); e3.code = 'no-gzip'; throw e3; }
        return streamBytes(body, DecompressionStream, 'gzip');
      }).then(function (bytes) { return new TextDecoder().decode(bytes); });
    });
  };

  return { encode: encode, parse: parse, Receiver: Receiver, canGzip: canGzip, PREFIX: PREFIX, MAX_FRAMES: MAX_FRAMES };
}));
