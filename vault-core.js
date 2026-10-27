/* PopPopMake Vault — the shared, private foundation under Budget & Notes.
 *
 * Everything is stored ONLY on this device (IndexedDB, database "ppm-vault").
 * Nothing in this file ever talks to a server.
 *
 * How the protection works (described exactly, no marketing):
 *  - A random 256-bit data key encrypts every saved document with AES-GCM
 *    (a fresh random 96-bit nonce per save). AES-GCM also detects any change
 *    to the stored bytes, so a damaged or swapped record is refused, never
 *    silently read.
 *  - That data key is itself stored only in encrypted ("wrapped") form, twice:
 *      1. under a key stretched from the passcode with PBKDF2-SHA-256,
 *         600,000 rounds and a random salt;
 *      2. under a key stretched from a random 140-bit recovery code that is
 *         shown to the user once.
 *  - The passcode and the recovery code are never stored anywhere. Forget
 *    both and the data cannot be opened by anyone, including PopPopMake.
 *  - A backup file contains exactly what is stored on the device: encrypted
 *    documents plus the wrapped keys. It is unreadable without the passcode
 *    (as it was when the backup was made) or the recovery code.
 */
(function (root) {
  'use strict';

  var DB_NAME = 'ppm-vault';
  var DB_VERSION = 1;
  var FORMAT = 1;
  var PASS_ITER = 600000;
  var REC_ITER = 100000;        // the recovery code already carries 140 random bits
  var MIN_PASS = 6;
  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford base32: no I, L, O, U
  var REC_LEN = 28;                               // 28 symbols x 5 bits = 140 bits
  var MODULE_RE = /^[a-z]{1,20}$/;

  var subtle = root.crypto && root.crypto.subtle;
  var te = new TextEncoder();
  var td = new TextDecoder();

  // ---------- small helpers ----------
  function fail(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function rand(n) { return root.crypto.getRandomValues(new Uint8Array(n)); }
  function b64(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function charLen(s) { return Array.from(s).length; }

  function makeRecoveryCode() {
    var r = rand(REC_LEN), s = '';
    for (var i = 0; i < REC_LEN; i++) s += B32[r[i] & 31];          // 256 is a multiple of 32: uniform
    return s.match(/.{4}/g).join('-');
  }
  // Accepts lower case, spaces, dashes, and the usual look-alikes (O->0, I/L->1).
  function normalizeCode(code) {
    var s = String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    if (s.length !== REC_LEN) return null;
    for (var i = 0; i < s.length; i++) if (B32.indexOf(s[i]) < 0) return null;
    return s;
  }
  function checkPass(pass) {
    if (typeof pass !== 'string' || charLen(pass) < MIN_PASS || !pass.trim()) throw fail('too-short', 'Passcode must be at least ' + MIN_PASS + ' characters.');
    return pass.normalize('NFC');
  }

  // ---------- crypto ----------
  function stretch(secret, salt, iter) {
    return subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function seal(key, bytes, aad) {
    var iv = rand(12);
    return subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: te.encode(aad) }, key, bytes)
      .then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function open(key, box, aad) {
    return Promise.resolve().then(function () {
      return subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: te.encode(aad) }, key, unb64(box.ct));
    }).then(function (b) { return new Uint8Array(b); });
  }
  function importDataKey(raw) { return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
  function aadFor(meta, what) { return 'ppm-vault|' + meta.id + '|' + what; }

  function wrapWithPass(meta, raw, pass) {
    var salt = rand(16);
    return stretch(pass, salt, PASS_ITER).then(function (k) { return seal(k, raw, aadFor(meta, 'pass')); })
      .then(function (box) { meta.kdf = { name: 'PBKDF2', hash: 'SHA-256', iter: PASS_ITER, salt: b64(salt) }; meta.pass = box; });
  }
  function wrapWithCode(meta, raw, code) {
    var salt = rand(16);
    return stretch(code, salt, REC_ITER).then(function (k) { return seal(k, raw, aadFor(meta, 'rec')); })
      .then(function (box) { meta.rec = { iter: REC_ITER, salt: b64(salt), iv: box.iv, ct: box.ct }; });
  }
  function rawFromPass(meta, pass) {
    return stretch(pass, unb64(meta.kdf.salt), meta.kdf.iter)
      .then(function (k) { return open(k, meta.pass, aadFor(meta, 'pass')); })
      .catch(function () { throw fail('bad-passcode', 'That passcode is not right.'); });
  }
  function rawFromCode(meta, code) {
    var c = normalizeCode(code);
    if (!c) return Promise.reject(fail('bad-code', 'That recovery code is not right.'));
    return stretch(c, unb64(meta.rec.salt), meta.rec.iter)
      .then(function (k) { return open(k, { iv: meta.rec.iv, ct: meta.rec.ct }, aadFor(meta, 'rec')); })
      .catch(function () { throw fail('bad-code', 'That recovery code is not right.'); });
  }

  // ---------- storage (IndexedDB) ----------
  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(fail('no-storage', 'This browser cannot store data.'));
      var req = root.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs');
      };
      req.onsuccess = function () {
        var d = req.result;
        d.onversionchange = function () { d.close(); dbPromise = null; };   // another tab is wiping: let it
        resolve(d);
      };
      req.onerror = function () { dbPromise = null; reject(fail('no-storage', String(req.error))); };
      req.onblocked = function () { /* wait */ };
    });
    return dbPromise;
  }
  function tx(stores, mode, work) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(stores, mode), result;
        Promise.resolve(work(t)).then(function (r) { result = r; }, function (e) { try { t.abort(); } catch (x) {} reject(e); });
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(fail('no-storage', String(t.error))); };
        t.onabort = function () { reject(fail('no-storage', String(t.error || 'aborted'))); };
      });
    });
  }
  function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  // Looking for a vault must not create an empty database on a device that has none (or just wiped it).
  function exists() {
    if (dbPromise || !root.indexedDB || !root.indexedDB.databases) return Promise.resolve(true);
    return root.indexedDB.databases().then(function (list) {
      return list.some(function (d) { return d.name === DB_NAME; });
    }, function () { return true; });
  }
  function readMeta() {
    return exists().then(function (yes) {
      if (!yes) return undefined;
      return tx(['meta'], 'readonly', function (t) { return req(t.objectStore('meta').get('main')); });
    });
  }
  function writeMeta(meta) { return tx(['meta'], 'readwrite', function (t) { return req(t.objectStore('meta').put(meta, 'main')); }); }

  // ---------- session (in memory only) ----------
  var session = null;        // { key: CryptoKey (not extractable), meta }
  var listeners = [];
  var channel = null;
  try { channel = new BroadcastChannel('ppm-vault'); channel.onmessage = function (e) { emit(e.data, true); }; } catch (e) {}
  function emit(msg, remote) {
    listeners.slice().forEach(function (fn) { try { fn(msg, !!remote); } catch (e) {} });
    if (!remote && channel) { try { channel.postMessage(msg); } catch (e) {} }
  }
  function needOpen() { if (!session) throw fail('locked', 'The vault is locked.'); }

  // ---------- public API ----------
  var Vault = {
    MIN_PASS: MIN_PASS,

    status: function () {
      if (session) return Promise.resolve('unlocked');
      return readMeta().then(function (m) { return m ? 'locked' : 'empty'; });
    },

    create: function (pass) {
      return Promise.resolve().then(function () {
        pass = checkPass(pass);
        return readMeta();
      }).then(function (existing) {
        if (existing) throw fail('exists', 'A vault already exists on this device.');
        var meta = { app: 'poppopmake-vault', format: FORMAT, id: b64(rand(16)), created: new Date().toISOString() };
        var raw = rand(32), code = makeRecoveryCode();
        return wrapWithPass(meta, raw, pass)
          .then(function () { return wrapWithCode(meta, raw, normalizeCode(code)); })
          .then(function () { return writeMeta(meta); })
          .then(function () { return importDataKey(raw); })
          .then(function (key) {
            raw.fill(0);
            session = { key: key, meta: meta };
            emit({ type: 'created' });
            return { recoveryCode: code };
          });
      });
    },

    unlock: function (pass) {
      return readMeta().then(function (meta) {
        if (!meta) throw fail('empty', 'There is no vault on this device yet.');
        return rawFromPass(meta, String(pass || '').normalize('NFC')).then(function (raw) {
          return importDataKey(raw).then(function (key) { raw.fill(0); session = { key: key, meta: meta }; });
        });
      });
    },

    // Forgotten passcode: the recovery code opens the vault and a new passcode is set.
    recover: function (code, newPass) {
      return Promise.resolve().then(function () {
        newPass = checkPass(newPass);
        return readMeta();
      }).then(function (meta) {
        if (!meta) throw fail('empty', 'There is no vault on this device yet.');
        return rawFromCode(meta, code).then(function (raw) {
          var next = JSON.parse(JSON.stringify(meta));
          return wrapWithPass(next, raw, newPass)
            .then(function () { return writeMeta(next); })
            .then(function () { return importDataKey(raw); })
            .then(function (key) { raw.fill(0); session = { key: key, meta: next }; });
        });
      });
    },

    changePasscode: function (oldPass, newPass) {
      return Promise.resolve().then(function () {
        newPass = checkPass(newPass);
        return readMeta();
      }).then(function (meta) {
        return rawFromPass(meta, String(oldPass || '').normalize('NFC')).then(function (raw) {
          var next = JSON.parse(JSON.stringify(meta));
          return wrapWithPass(next, raw, newPass).then(function () { raw.fill(0); return writeMeta(next); })
            .then(function () { if (session) session.meta = next; });
        });
      });
    },

    // Replaces the recovery code (the old one stops working). Needs the passcode.
    newRecoveryCode: function (pass) {
      return readMeta().then(function (meta) {
        return rawFromPass(meta, String(pass || '').normalize('NFC')).then(function (raw) {
          var next = JSON.parse(JSON.stringify(meta)), code = makeRecoveryCode();
          return wrapWithCode(next, raw, normalizeCode(code)).then(function () { raw.fill(0); return writeMeta(next); })
            .then(function () { if (session) session.meta = next; return code; });
        });
      });
    },

    checkPasscode: function (pass) {
      return readMeta().then(function (meta) {
        return rawFromPass(meta, String(pass || '').normalize('NFC')).then(function (raw) { raw.fill(0); return true; });
      });
    },

    lock: function () { session = null; emit({ type: 'locked' }); return Promise.resolve(); },

    load: function (module) {
      return Promise.resolve().then(function () {
        needOpen();
        if (!MODULE_RE.test(module)) throw fail('bad-module');
        var s = session;
        return tx(['docs'], 'readonly', function (t) { return req(t.objectStore('docs').get(module)); }).then(function (rec) {
          if (!rec) return null;
          return open(s.key, rec, aadFor(s.meta, 'doc|' + module))
            .catch(function () { throw fail('corrupt', 'This record is damaged or was changed outside the app.'); })
            .then(function (bytes) { return JSON.parse(td.decode(bytes)); });
        });
      });
    },

    save: function (module, data) {
      return Promise.resolve().then(function () {
        needOpen();
        if (!MODULE_RE.test(module)) throw fail('bad-module');
        var s = session;
        return seal(s.key, te.encode(JSON.stringify(data)), aadFor(s.meta, 'doc|' + module)).then(function (box) {
          box.updated = Date.now();
          return tx(['docs'], 'readwrite', function (t) { return req(t.objectStore('docs').put(box, module)); });
        }).then(function () { emit({ type: 'saved', module: module }); });
      });
    },

    // The backup file: exactly what is stored, which is already encrypted.
    exportBackup: function () {
      return Promise.resolve().then(function () {
        needOpen();
        return tx(['meta', 'docs'], 'readonly', function (t) {
          var docs = {}, st = t.objectStore('docs');
          return req(t.objectStore('meta').get('main')).then(function (meta) {
            return req(st.getAllKeys()).then(function (keys) {
              return Promise.all(keys.map(function (k) { return req(st.get(k)).then(function (v) { docs[k] = { iv: v.iv, ct: v.ct, updated: v.updated }; }); }))
                .then(function () { return { meta: meta, docs: docs }; });
            });
          });
        });
      }).then(function (all) {
        return JSON.stringify({ app: 'poppopmake-vault', format: FORMAT, exported: new Date().toISOString(), meta: all.meta, docs: all.docs });
      });
    },

    // Restore a backup file, replacing whatever is on this device. `secret` may be
    // the passcode used when the backup was made, or the recovery code.
    // Nothing on the device changes unless the secret is right and every record opens.
    importBackup: function (text, secret) {
      var file, meta;
      return Promise.resolve().then(function () {
        try { file = JSON.parse(text); } catch (e) { throw fail('bad-file', 'This is not a PopPopMake backup file.'); }
        meta = file && file.meta;
        var ok = file && file.app === 'poppopmake-vault' && file.format === FORMAT && meta && meta.format === FORMAT &&
          typeof meta.id === 'string' && meta.kdf && typeof meta.kdf.salt === 'string' && meta.kdf.iter > 0 &&
          meta.pass && typeof meta.pass.iv === 'string' && meta.rec && typeof meta.rec.ct === 'string' &&
          file.docs && typeof file.docs === 'object';
        if (ok) Object.keys(file.docs).forEach(function (k) {
          var d = file.docs[k];
          if (!MODULE_RE.test(k) || !d || typeof d.iv !== 'string' || typeof d.ct !== 'string') ok = false;
        });
        if (!ok) throw fail('bad-file', 'This is not a PopPopMake backup file.');
        var s = String(secret || '').normalize('NFC');
        return rawFromPass(meta, s).catch(function () {
          if (!normalizeCode(s)) throw fail('bad-passcode', 'That passcode or recovery code is not right.');
          return rawFromCode(meta, s).catch(function () { throw fail('bad-passcode', 'That passcode or recovery code is not right.'); });
        });
      }).then(function (raw) {
        return importDataKey(raw).then(function (key) {
          raw.fill(0);
          var names = Object.keys(file.docs);
          return Promise.all(names.map(function (k) { return open(key, file.docs[k], aadFor(meta, 'doc|' + k)); }))
            .catch(function () { throw fail('bad-file', 'This backup file is damaged.'); })
            .then(function () {
              return tx(['meta', 'docs'], 'readwrite', function (t) {
                var st = t.objectStore('docs');
                return req(st.clear()).then(function () {
                  return Promise.all(names.map(function (k) {
                    var d = file.docs[k];
                    return req(st.put({ iv: d.iv, ct: d.ct, updated: d.updated || Date.now() }, k));
                  }));
                }).then(function () { return req(t.objectStore('meta').put(meta, 'main')); });
              });
            })
            .then(function () { session = { key: key, meta: meta }; emit({ type: 'restored' }); });
        });
      });
    },

    // Deletes everything this app stored on this device.
    wipe: function () {
      session = null;
      var closing = dbPromise ? dbPromise.then(function (d) { d.close(); }, function () {}) : Promise.resolve();
      dbPromise = null;
      return closing.then(function () {
        return new Promise(function (resolve, reject) {
          var r = root.indexedDB.deleteDatabase(DB_NAME);
          r.onsuccess = function () { resolve(); };
          r.onerror = function () { reject(fail('no-storage', String(r.error))); };
          r.onblocked = function () { /* other tabs close on versionchange; success follows */ };
        });
      }).then(function () { emit({ type: 'wiped' }); });
    },

    // Ask the browser not to clear this site's storage under storage pressure.
    persist: function () {
      try {
        if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(function () { return false; });
      } catch (e) {}
      return Promise.resolve(false);
    },
    persisted: function () {
      try {
        if (navigator.storage && navigator.storage.persisted) return navigator.storage.persisted().catch(function () { return false; });
      } catch (e) {}
      return Promise.resolve(false);
    },

    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    normalizeCode: normalizeCode,
    _meta: function () { return readMeta(); }
  };

  root.VaultCore = Vault;
})(typeof window !== 'undefined' ? window : self);
