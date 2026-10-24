/* PopPopMake — "Help me find a tool".
   1. A small matching engine that turns a plain-language sentence into the tool (or guide)
      that answers it. It runs entirely in the browser — nothing typed here leaves the page.
   2. The "ask us to build it" request form. That is the ONLY thing in this file that sends
      anything anywhere, and only when the visitor presses "Send request".
   3. The finder panel used on /help-me.
   Needs /help-index.js (the data) loaded first. */
(function (root) {
  'use strict';

  /* ---- Settings you may want to change later --------------------------------------- */
  var CONFIG = {
    endpoint: 'https://api.web3forms.com/submit',          // where "Send request" posts to
    accessKey: '82a3687d-a2bf-40b5-87bb-96e622f55f9b',     // same public Web3Forms key the Feedback page uses
    fromName: 'PopPopMake Help Me',
    subjectPrefix: 'PopPopMake tool request',               // filter on this in the inbox
    fallbackEmail: 'hello@poppopmake.com',
    maxMessage: 1000,
    minWords: 2,
    perSession: 3,                                          // at most this many requests per page visit
    perDay: 6,                                              // and this many per browser per 24 h
    cooldownMs: 15000                                       // wait between two sends
  };
  if (root.PPM_HELP_CONFIG) for (var ck in root.PPM_HELP_CONFIG) CONFIG[ck] = root.PPM_HELP_CONFIG[ck];

  var IDX = root.PPM_HELP_INDEX;
  if (!IDX && typeof require === 'function') { try { IDX = require('./help-index.js'); } catch (e) { /* tests set it themselves */ } }
  if (!IDX) { root.PPMHelp = { ready: false }; return; }

  /* ================================================================== ENGINE */
  var WEAK = 0.34, GOOD = 0.55, STRONG = 0.72;      // how much of the question a result must explain
  var MIN_INFO = 1.8;                               // ...and how much the matched words must tell us
  var SINGLE_WORD_INFO = 2.95;                      // a lone word must be this distinctive (bmi, json) to count as a clear answer
  var TIE = 0.85;                                   // two results this close = "which one?"
  var NOT_ASKED = 0.88;                             // guides and info pages, when the visitor did not ask a question
  var COORD = 1.5;                                  // how hard a result is marked down for each part of the question it does not explain
  var REL = 0.5, UNKNOWN_W = 1.6, UNKNOWN_KO_W = 0.6, MAX_RESULTS = 6;
  var TYPE_PRIOR = { tool: 0, state: 0, guide: -0.35, info: -0.45 };

  function clean(text) {
    var s = String(text == null ? '' : text);
    if (s.normalize) s = s.normalize('NFKC');
    s = s.toLowerCase();
    s = s.replace(/[À-ɏ]+/g, function (m) { return m.normalize ? m.normalize('NFD').replace(/[̀-ͯ]/g, '') : m; });
    s = s.replace(/[‘’ʼ`´]/g, "'");
    s = s.replace(/'/g, '');
    s = s.replace(/\bd\.\s?c\b\.?/g, 'dc').replace(/\bu\.\s?s\.?(?:\s?a\b\.?)?/g, 'us');
    s = s.replace(/\b(401|403|457)\s*\(?\s*([kb])(?![a-z])(?:\s*\))?/g, '$1$2');
    s = s.replace(/\bw\s?-?\s?([2349])\b/g, 'w$1');
    s = s.replace(/\bkm\s?\/\s?h\b/g, 'kph');
    s = s.replace(/\b(\d+(?:\.\d+)?)(mb|kb|gb|tb|px|dpi|kg|lbs?|oz|cm|mm|km|ml|ft)\b/g, '$1 $2');      // 8mb -> 8 mb
    s = s.replace(/%/g, ' percent ').replace(/&/g, ' and ');
    s = s.replace(/[^a-z0-9ㄱ-ㆎ가-힣]+/g, ' ');
    s = s.replace(/([a-z][a-z0-9]*)(?:으로|로)(?![가-힣])/g, 'to $1');                                       // pdf로 -> to pdf
    s = s.replace(/(글자|단어|문자)\s+수(?![가-힣])/g, '$1수');                                                 // 글자 수 -> 글자수 (one word in our list)
    s = s.replace(/(^|\s)(?:집|아파트)\s+(?:담보\s+)?대출/g, '$1주택대출');                                       // 집 대출 -> 주택대출
    return s.replace(/\s+/g, ' ').trim();
  }

  function stem(w) {
    var n = w.length;
    if (n < 4 || /\d/.test(w)) return w;
    if (n > 4 && w.slice(-3) === 'ies') w = w.slice(0, -3) + 'y';
    else if (n > 4 && w.slice(-3) === 'ied') w = w.slice(0, -3) + 'y';
    else if (n > 4 && w.slice(-2) === 'ie') w = w.slice(0, -2) + 'y';
    else if (w.slice(-4) === 'sses') w = w.slice(0, -2);
    else if (/(ss|us|is|ous)$/.test(w)) { /* keep: process, bonus, analysis */ }
    else if (w.slice(-1) === 's') w = w.slice(0, -1);
    var rules = [['ational', 'at'], ['ations', 'at'], ['ation', 'at'], ['ators', 'at'], ['ator', 'at'], ['ments', ''], ['ment', ''],
                 ['ingly', ''], ['ing', ''], ['edly', ''], ['ed', ''], ['ions', ''], ['ion', '']];
    for (var i = 0; i < rules.length; i++) {
      var suf = rules[i][0];
      if (w.length - suf.length >= 3 && w.slice(-suf.length) === suf && !(suf === 'ing' && w.length < 6) && !((suf === 'ator' || suf === 'ators') && w.length < 9)) {
        w = w.slice(0, -suf.length) + rules[i][1];
        if (!rules[i][1] && /([bgmnprt])\1$/.test(w)) w = w.slice(0, -1);
        break;
      }
    }
    if (w.length > 3 && w.slice(-1) === 'e') w = w.slice(0, -1);
    return w;
  }

  var STOP = {}, STOP_STEM = {}, SOFT = {}, SYNM = {}, NOSYN = {};
  IDX.stop.forEach(function (w) { if (w) { STOP[w] = 1; STOP_STEM[stem(w)] = 1; } });
  (IDX.soft || []).forEach(function (w) { SOFT[stem(w)] = 1; });
  Object.keys(IDX.syn).forEach(function (k) {
    SYNM[stem(k)] = IDX.syn[k].split(' ').map(stem);
  });
  (IDX.noSyn || []).forEach(function (w) { NOSYN[w] = 1; });             // words that only share a stem with a synonym ("unit" / "unite", "guide" / "guid") and must keep their own meaning
  var STATE_ABBR = IDX.stateAbbr || {};
  var PAY_CTX = /\b(paycheck|pay|salary|takehome|take home|income|wage|wages|net|gross|withholding|tax|taxes|payroll)\b/;
  var PHRASES = (IDX.phrases || []).map(function (p) { return [p[0], p[1]]; });

  function applyPhrases(cleaned) {
    PHRASES.forEach(function (p) { cleaned = cleaned.replace(p[0], ' ' + p[1] + ' '); });
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  /* One word -> its canonical form(s). applyStop=false keeps filler words (used for the "not built yet" rules). */
  function canonWord(w, applyStop) {
    if (w.length < 2) return [];
    if (/^\d+$/.test(w)) return (w === '1099' || w === '1040') ? [w] : [];
    if (/^\d+[kmbx]$/.test(w) && w !== '401k' && w !== '403b') return [];
    if (applyStop && STOP[w]) return [];
    var st = stem(w);
    var arr = (SYNM[st] && !NOSYN[w]) ? SYNM[st].slice() : [st];
    if (applyStop) arr = arr.filter(function (t) { return !STOP_STEM[t] && !STOP[t]; });
    return arr;
  }

  function isHangul(s) { return /[ㄱ-ㆎ가-힣]/.test(s); }
  function runs(cleaned) { return cleaned.match(/[a-z0-9]+|[ㄱ-ㆎ가-힣]+/g) || []; }

  /* Korean: find the known word pieces in a run, in the order they appear. "X로" after a piece means "to X". */
  var KO = IDX.ko.slice().sort(function (a, b) { return b[0].length - a[0].length; });
  var KO_STOP = IDX.koStop.slice().sort(function (a, b) { return b.length - a.length; });
  function koRun(run) {
    var used = [], found = [], i, j, k;
    for (i = 0; i < run.length; i++) used.push(false);
    KO.forEach(function (pair) {
      var piece = pair[0], at = run.indexOf(piece);
      while (at !== -1) {
        var free = true;
        for (k = at; k < at + piece.length; k++) if (used[k]) { free = false; break; }
        if (free) { for (k = at; k < at + piece.length; k++) used[k] = true; found.push({ pos: at, len: piece.length, en: pair[1] }); }
        at = run.indexOf(piece, at + 1);
      }
    });
    found.sort(function (a, b) { return a.pos - b.pos; });
    var parts = [];
    found.forEach(function (f) {
      var after = run.substr(f.pos + f.len, 2), to = false;
      if (after === '으로') { to = true; used[f.pos + f.len] = used[f.pos + f.len + 1] = true; }
      else if (after.charAt(0) === '로') { to = true; used[f.pos + f.len] = true; }
      parts.push((to ? 'to ' : '') + f.en);
    });
    var rest = '';
    for (j = 0; j < run.length; j++) rest += used[j] ? ' ' : run.charAt(j);
    KO_STOP.forEach(function (s) { if (rest.indexOf(s) !== -1) rest = rest.split(s).join(' '); });
    var unknown = rest.split(' ').filter(function (r) { return r.length >= 2; }).length;
    return { english: parts.join(' '), unknown: unknown };
  }

  /* Tokens of a piece of index text (stop words removed). */
  function tokens(text) {
    var out = [];
    runs(applyPhrases(clean(text))).forEach(function (r) { canonWord(r, true).forEach(function (t) { if (out.indexOf(t) === -1) out.push(t); }); });
    return out;
  }
  /* Words of a "not built yet" rule. Short words (mov, seo, pdf) only match the same word, never a longer word that
     happens to share its stem (moving -> mov); a leading "=" marks them. */
  function ruleTokens(text) {
    var out = [];
    runs(clean(text)).forEach(function (r) {
      if (r.length <= 3) out.push('=' + (canonWord(r, false)[0] || r));
      else canonWord(r, false).forEach(function (t) { out.push(t); });
    });
    return out;
  }

  /* A question or a listed sentence reduced to its stems, soft words dropped. Equal signatures = the same sentence. */
  function sigWords(text, fixes) {
    return runs(applyPhrases(clean(text))).map(function (r) {
      var c = fixes && fixes[r] ? [fixes[r]] : canonWord(r, false);
      return c.length ? c.join('+') : r;
    }).filter(function (t) { return !SOFT[t]; });
  }
  function sig(text, fixes) { return sigWords(text, fixes).join(' '); }
  function lcs(a, b) {
    var m = a.length, n = b.length, prev = [], cur, i, j;
    for (j = 0; j <= n; j++) prev.push(0);
    for (i = 1; i <= m; i++) {
      cur = [0];
      for (j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      prev = cur;
    }
    return prev[n];
  }
  /* How alike two sentences are, function words included (1 = the same sentence). */
  function likeness(a, b) { return (a.length && b.length) ? (2 * lcs(a, b)) / (a.length + b.length) : 0; }

  /* ---- compile the index ---- */
  var ENTRIES = [], DF = {}, VOCAB = {}, SURF = {}, IDF_CACHE = {}, BYID = {}, STATE_TOK = {}, SIGMAP = {};
  function setOf(arr) { var o = {}; arr.forEach(function (t) { o[t] = 1; }); return o; }
  function noteSurface(text) {
    runs(clean(text)).forEach(function (r) {
      if (r.length < 4) return;
      canonWord(r, true).forEach(function (t) {
        var l = SURF[t] || (SURF[t] = []);
        if (l.indexOf(r) === -1 && l.length < 5) l.push(r);
      });
    });
  }

  function compile() {
    IDX.tools.forEach(function (t) {
      var phrases = (t.does || []).concat((t.kw || []).filter(function (k) { return /\s/.test(k); })).map(tokens).filter(function (p) { return p.length; });
      var single = (t.kw || []).filter(function (k) { return !/\s/.test(k); });
      var keyT = {};
      phrases.forEach(function (p) { p.forEach(function (x) { keyT[x] = 1; }); });
      single.forEach(function (k) { tokens(k).forEach(function (x) { keyT[x] = 1; }); });
      var nameT = setOf(tokens(t.name));
      var descT = {};
      tokens(t.desc || '').forEach(function (x) { if (!keyT[x] && !nameT[x]) descT[x] = 1; });
      var e = {
        id: t.id, type: t.type, name: t.name, cat: t.cat, href: t.href, desc: t.desc,
        nameT: nameT, keyT: keyT, descT: descT, phr: phrases,
        sigs: [t.name].concat(t.does || []).concat((t.kw || []).filter(function (k) { return /\s/.test(k); })).map(sig),
        sigw: [t.name].concat(t.does || []).concat((t.kw || []).filter(function (k) { return /\s/.test(k); })).map(function (x) { return sigWords(x); }).filter(function (w) { return w.length; }),
        prior: (t.prior != null ? t.prior : 0) + (TYPE_PRIOR[t.type] || 0),
        req: t.req ? t.req.map(function (grp) { return grp.map(tokens); }) : null,
        notIf: t.notIf ? t.notIf.map(tokens) : null,
        warn: (t.warn || []).map(function (w) { return { any: w.any.map(function (a) { return (tokens(a)[0]) || a; }), text: w.text, nonlatin: w.any.indexOf('__nonlatin__') !== -1 }; })
      };
      ENTRIES.push(e);
      BYID[e.id] = e;
      e.sigs.forEach(function (g) { if (g) { var L = SIGMAP[g] || (SIGMAP[g] = []); if (L.indexOf(e) === -1) L.push(e); } });     // one page, however many of its sentences boil down to the same words
      var seen = {};
      Object.keys(nameT).concat(Object.keys(keyT)).forEach(function (x) {
        if (seen[x]) return;
        seen[x] = 1; VOCAB[x] = 1;
        if (t.type === 'state') STATE_TOK[x] = 1; else DF[x] = (DF[x] || 0) + 1;     // templated state pages count once, not 51 times
      });
      noteSurface(t.name); (t.does || []).forEach(noteSurface); (t.kw || []).forEach(noteSurface);
    });
    Object.keys(STATE_TOK).forEach(function (x) { if (!DF[x]) DF[x] = 1; });
    IDX.gaps.forEach(function (g) {
      g.allC = g.all ? g.all.map(function (grp) { return grp.map(ruleTokens).filter(function (a) { return a.length; }); }) : null;
      g.notC = g.not ? g.not.map(function (grp) { return grp.map(ruleTokens).filter(function (a) { return a.length; }); }) : null;
    });
  }
  compile();
  var N = ENTRIES.length;

  function idf(t) {
    if (IDF_CACHE[t] != null) return IDF_CACHE[t];
    var v = DF[t] ? Math.min(3.5, Math.max(0.5, Math.log(1 + N / DF[t]))) : UNKNOWN_W;
    IDF_CACHE[t] = v;
    return v;
  }

  /* Damerau-Levenshtein, capped. */
  function dist(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    var prev2 = null, prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i], best = i;
      for (j = 1; j <= b.length; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < best) best = v;
      }
      if (best > cap) return cap + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  var VOCAB_LIST = null;
  function vocabList() { return VOCAB_LIST || (VOCAB_LIST = Object.keys(VOCAB).filter(function (v) { return v.length >= 4; })); }

  /* A word we have never seen: is it a one-letter slip of a word we know? (two letters off only for long words) */
  function swapped(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i + 1 < a.length; i++) if (a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) && a.slice(0, i) + a.charAt(i + 1) + a.charAt(i) + a.slice(i + 2) === b) return true;
    return false;
  }
  function missingOne(a, b) { return b.length === a.length + 1 && dist(a, b, 1) === 1; }
  /* allowSub = false: in a long sentence a different-letter match (contract/contrast) is more likely a real word than a slip */
  var ABBR3 = ['pdf', 'ocr', 'bmi', 'png', 'jpg', 'url', 'rgb', 'hex', 'csv', 'xml', 'tip'].filter(function (a) { return VOCAB[a]; });
  function fuzzyAbbr(typed) {
    for (var i = 0; i < ABBR3.length; i++) {
      var a = ABBR3[i];
      if (typed.length === 3 && typed !== a && swapped(typed, a)) return a;                         // pfd -> pdf
      if (typed.length === 4 && dist(typed, a, 1) === 1 && typed.indexOf(a) === 0 && typed.charAt(3) === a.charAt(2)) return a;   // pdff -> pdf
    }
    return null;
  }
  function fuzzy(typed, tstem, allowSub) {
    if (typed.length === 3 || typed.length === 4) { var ab = fuzzyAbbr(typed); if (ab) return ab; }
    if (typed.length < 4) return null;
    var four = typed.length === 4, cap = typed.length >= 10 ? 2 : 1, best = null, bd = 99, bi = 0;
    var shortStem = tstem + 'e' === typed ? tstem : null;                             // mege -> meg: a dropped final e is the same slip as a missing letter
    vocabList().forEach(function (v) {
      var forms = SURF[v] || [], d = 99, i, c;
      if (four) {                                                                    // four letters: only one missing letter or one swap counts, never a different letter (calc != call)
        var cands = [v].concat(forms);
        for (i = 0; i < cands.length; i++) {
          c = cands[i];
          if (swapped(typed, c) || missingOne(typed, c) || (shortStem && missingOne(shortStem, c))) { d = 1; break; }
        }
      } else {
        var subOK = function (x, y) { return allowSub || x.length !== y.length || swapped(x, y); };
        d = 99;
        if (subOK(tstem, v)) d = Math.min(d, dist(tstem, v, cap));
        if (subOK(typed, v)) d = Math.min(d, dist(typed, v, cap));
        for (i = 0; i < forms.length && d > 0; i++) if (subOK(typed, forms[i])) d = Math.min(d, dist(typed, forms[i], cap));
      }
      if (d <= cap) {
        var iv = idf(v);
        if (d < bd || (d === bd && iv > bi)) { best = v; bd = d; bi = iv; }
      }
    });
    return best;
  }
  function completions(prefix) {
    if (prefix.length < 3) return [];
    var st = stem(prefix), out = [];
    vocabList().forEach(function (v) { if (v.length > st.length && (v.indexOf(prefix) === 0 || v.indexOf(st) === 0)) out.push(v); });
    return out.length && out.length <= 4 ? out : [];
  }

  /* ---- analyse a query ---- */
  function analyze(query) {
    var raw = String(query == null ? '' : query).slice(0, 600);
    var cleaned = applyPhrases(clean(raw));
    var rs = runs(cleaned);
    var qt = [], allSet = {}, exact = {}, rxParts = [], unknownKo = 0, content = false, sigParts = [], hasKo = false;
    var payCtx = PAY_CTX.test(cleaned);
    var paAfterNumber = /\d\s*k?\s*pa\b/.test(raw.toLowerCase());

    function addWord(w, surface) {
      canonWord(w, true).forEach(function (t) { qt.push({ t: t, surface: surface }); });
      canonWord(w, false).forEach(function (t) { allSet[t] = 1; if (stem(w) === w) exact[t] = 1; });
      exact[w] = 1;
    }
    rs.forEach(function (run) {
      if (isHangul(run)) {
        var k = koRun(run);
        unknownKo += k.unknown;
        rxParts.push(k.english);
        hasKo = true; sigParts.push(k.english || (run.length > 1 ? run : ''));                    // the sentence-likeness check below reads the English the Korean words stand for, so "pdf를 이미지로" is the sentence "pdf to image"
        if (k.english) { content = true; k.english.split(' ').forEach(function (w) { addWord(w, run); }); }
        else if (k.unknown) content = true;
      } else {
        rxParts.push(run); sigParts.push(run);
        if (!/^\d+$/.test(run) || run === '1099' || run === '1040') content = true;
        addWord(run, run);
        if (payCtx && STATE_ABBR[run] && !(run === 'pa' && paAfterNumber)) { STATE_ABBR[run].split(' ').forEach(function (w) { addWord(w, run); }); rxParts.push(STATE_ABBR[run]); }
      }
    });
    /* de-duplicate, keeping order and the first surface word */
    var seen = {}, tokensOut = [];
    qt.forEach(function (x) { if (!seen[x.t]) { seen[x.t] = 1; tokensOut.push(x); } });
    var sigSrc = hasKo ? sigParts.join(' ') : cleaned;
    return { raw: raw, cleaned: cleaned, sigSrc: sigSrc, sig: sig(sigSrc), sigw: sigWords(sigSrc), tokens: tokensOut, allSet: allSet, exact: exact, unknownKo: unknownKo, content: content,
             textForRx: rxParts.join(' ').replace(/\s+/g, ' ').trim(),
             lastRun: rs.length ? rs[rs.length - 1] : '', nonLatin: /[^\u0000-ɏ\s]/.test(raw) };
  }

  var PROTECT_SET = {};
  (IDX.protect || '').split(' ').forEach(function (w) { if (w) PROTECT_SET[w] = 1; });

  function resolveUnknown(A, opts) {
    var fixes = {};
    A.tokens.forEach(function (x) {
      if (DF[x.t] || SOFT[x.t]) return;
      if (PROTECT_SET[x.surface]) return;                                  // an ordinary English word, not a slip
      var fz = A.tokens.length <= 6 ? fuzzy(x.surface, x.t, true) : null;                       // a long, chatty sentence has plenty of ordinary words we have never listed: do not "fix" them
      if (fz && !A.tokens.some(function (o) { return o.t === fz; })) { x.orig = x.t; x.t = fz; x.fuzzy = true; fixes[x.surface] = fz; return; }
      if (opts.prefix === true && x.surface === A.lastRun) {
        var cs = completions(x.surface);
        if (cs.length) { x.orig = x.t; x.t = cs[0]; x.prefix = true; fixes[x.surface] = cs[0]; }
      }
    });
    A.sigw = sigWords(A.sigSrc, fixes);
    A.sig = A.sigw.join(' ');
  }

  /* Things that are plainly not a request for one of our pages: code, paths, links, or general-knowledge chat. */
  var CODELIKE = /\.\.|<\s*\/?[a-z!]|\{\{|\}\}|:\/\/|--|`|\$\(|\\|%00|etc\/passwd/i;
  var OFFTOPIC = /\b(capital of|president of|prime minister|population of|weather|forecast|who won|recipe|jokes?|songs?|lyrics|movies?|horoscope|meaning of life|how tall is|how far is)\b/;
  function isConceptual(cleaned) {
    return /\b(why|explain|explained|explains|meaning|difference between|stand for|stands for)\b|\bwhat (does|do|is the)\b.*\b(mean|means|stand for|stands for|difference)\b|\bhow (does|do|is|are)\b.*\b(work|works|calculated|taxed|determined|decided)\b/.test(cleaned);
  }
  function isQuestion(cleaned) {
    return /^(how|why|what|which|when|where|is|are|do|does|can|should|explain|guide)\b/.test(cleaned) || /\b(explained|explain|meaning|guide)\b/.test(cleaned);
  }

  /* ---- "not built yet" rules ---- */
  function has(A, tok) { return tok.charAt(0) === '=' ? !!A.exact[tok.slice(1)] : !!A.allSet[tok]; }
  function groupHit(grp, A) {
    for (var i = 0; i < grp.length; i++) {
      var alt = grp[i], ok = true;
      for (var j = 0; j < alt.length; j++) if (!has(A, alt[j])) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  function gapMatches(g, A) {
    if (g.notC && g.notC.some(function (grp) { return groupHit(grp, A); })) return false;
    if (g.allC && g.allC.length && g.allC.every(function (grp) { return groupHit(grp, A); })) return true;
    if (g.rx && g.rx.some(function (r) { return r.test(A.textForRx); })) return true;
    return false;
  }
  function adjacent(p, order) {
    for (var i = 0; i + p.length <= order.length; i++) {
      var ok = true;
      for (var j = 0; j < p.length; j++) if (order[i + j] !== p[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }

  function scoreEntry(e, Q, qset, order, question, softOn, A, unkScale, concept) {
    var sc = 0, matchedW = 0, totalW = 0, explained = 0, why = [], nameHit = false;
    Q.forEach(function (q) {
      var w = DF[q.t] ? idf(q.t) : idf(q.t) * unkScale, m = 0;
      if (e.nameT[q.t]) { m = 1; nameHit = true; }
      else if (e.keyT[q.t]) m = 0.92;
      else if (e.descT[q.t]) m = 0.3;
      if (softOn && SOFT[q.t]) { sc += 0.5 * w * m; return; }          // "free", "calculator"...: a small plus, never a minus
      totalW += w;
      sc += w * m;
      explained += w * m;
      if (m >= 0.9) { matchedW += w; if (why.indexOf(q.surface) === -1) why.push(q.surface); }
    });
    var bonus = 0, phraseHit = false, exactHit = false;
    var like = 0;
    if (A && A.sigw && A.sigw.length) e.sigw.forEach(function (w) { var l = likeness(A.sigw, w); if (l > like) like = l; });
    if (like >= 0.999) exactHit = true;
    e.phr.forEach(function (p) {
      if (p.length < 2) return;
      var hit = 0, wsum = 0, tot = 0;
      p.forEach(function (t) { var iw = idf(t); tot += iw; if (qset[t]) { hit++; wsum += iw; } });
      if (hit === p.length) {
        var b = 0.9 * tot;
        if (adjacent(p, order)) b *= 1.2;
        else if (!question && (e.type === 'guide' || e.type === 'info')) b *= 0.5;   // an explainer's sentence only counts in full when they asked in that form (or wrote it as one run)
        if (b > bonus) bonus = b;
        phraseHit = true;
      } else if (p.length >= 3 && hit / p.length >= 0.67) {
        var b2 = 0.3 * wsum;
        if (b2 > bonus) bonus = b2;
      }
    });
    if (like >= 0.75) bonus += 1.2 * explained * Math.min(1, (like - 0.75) / 0.25);        // they wrote (nearly) one of the sentences we list for this tool
    var cov = totalW ? matchedW / totalW : 0;
    var explainedFrac = totalW ? Math.min(1, explained / totalW) : 0;
    var prior = e.prior;
    if (question && (e.type === 'guide' || e.type === 'info') && (nameHit || phraseHit || exactHit)) prior += 0.5;
    var base = (sc + bonus) * Math.pow(explainedFrac, COORD);                              // an answer that leaves part of the question unexplained is worth less
    if (!question && (e.type === 'guide' || e.type === 'info')) base *= NOT_ASKED;           // an explainer is worth a bit less when nobody asked a question
    if (concept && (e.type === 'guide' || e.type === 'info') && (nameHit || phraseHit || exactHit)) base *= 1.2;   // "why / explain / what does X mean": the explainer is the answer
    return { sc: sc + bonus, base: base, total: base + prior, prior: prior, cov: cov, totalW: totalW, matchedW: matchedW, why: why, nameHit: nameHit, phraseHit: phraseHit, exact: exactHit };
  }

  function classify(r, nTok) {
    if (r.matchedW < MIN_INFO) return r.cov >= WEAK ? 'weak' : 'none';
    if (r.cov >= STRONG && (r.nameHit || r.phraseHit || nTok <= 2)) return 'strong';
    if (r.cov >= GOOD && (r.nameHit || r.phraseHit || r.exact || r.cov >= STRONG)) return 'good';
    if (r.cov >= WEAK) return 'weak';
    return 'none';
  }

  function warnsFor(e, A) {
    var out = [];
    e.warn.forEach(function (w) {
      var hit = w.nonlatin && A.nonLatin;
      if (!hit) for (var i = 0; i < w.any.length; i++) if (A.allSet[w.any[i]]) { hit = true; break; }
      if (hit) out.push(w.text);
    });
    return out;
  }

  function present(e, s, A) {
    return { id: e.id, type: e.type, name: e.name, cat: e.cat, href: e.href, desc: e.desc, score: Math.round(s.total * 100) / 100,
             cov: Math.round(s.cov * 100) / 100, conf: s.conf, why: (s.why || []).slice(0, 4), warn: warnsFor(e, A) };
  }
  function group(e) { return (e.type === 'guide' || e.type === 'info') ? 'g' : 't'; }

  /* Score every page against a list of question words; best first, near-ties and the long tail trimmed. */
  function rank(A, Q, question, concept) {
    var qset = {}, order = [];
    Q.forEach(function (q) { qset[q.t] = 1; order.push(q.t); });
    var softOn = Q.some(function (q) { return !SOFT[q.t]; });              // a question made only of soft words keeps them
    var coreN = Q.filter(function (q) { return !SOFT[q.t]; }).length;
    var unkScale = Math.min(1, 4 / Math.max(1, coreN));                    // in a long sentence, words we do not know are mostly filler

    var scored = [];
    if (!Q.length && SIGMAP[A.sig]) {                                      // nothing but filler words, yet it is a sentence we list
      SIGMAP[A.sig].forEach(function (e) { scored.push({ e: e, s: { total: 5 + e.prior, base: 5, prior: e.prior, cov: 1, totalW: 1, matchedW: 3, why: [], nameHit: false, phraseHit: true, exact: true, conf: 'strong' } }); });
    }
    ENTRIES.forEach(function (e) {
      if (e.req && !e.req.every(function (grp) { return grp.some(function (alt) { return alt.length && alt.every(function (t) { return qset[t]; }); }); })) {
        var sayIt = 0;                                                      // they may still have written one of this page's own sentences
        e.sigw.forEach(function (w) { var l = likeness(A.sigw, w); if (l > sayIt) sayIt = l; });
        if (sayIt < 0.75) return;
      }
      if (e.notIf && e.notIf.some(function (alt) { return alt.length && alt.every(function (t) { return qset[t]; }); })) return;
      var s = scoreEntry(e, Q, qset, order, question, softOn, A, unkScale, concept);
      if (s.sc <= 0) return;
      if (A.unknownKo) { s.cov = s.matchedW / (s.totalW + A.unknownKo * UNKNOWN_KO_W); }    // Korean words we could not read count against us a little
      s.conf = classify(s, Q.length);
      if (A.unknownKo && s.conf === 'strong' && s.cov < STRONG) s.conf = 'good';
      if (Q.some(function (q) { return q.fuzzy || q.prefix; }) && s.conf === 'strong') s.conf = 'good';
      if (s.conf === 'none') return;
      scored.push({ e: e, s: s });
    });
    scored.sort(function (a, b) { return b.s.total - a.s.total; });
    if (scored.length) {
      var top = scored[0].s.total;
      scored = scored.filter(function (x, i) { return i === 0 || x.s.total >= top * REL; }).slice(0, MAX_RESULTS);
    }
    return { scored: scored, softOn: softOn };
  }
  /* One of our file tools plainly does the job: it works on any kind of file, whatever the file is about. */
  function isFileJob(x) { return !!x && x.e.type === 'tool' && x.e.cat === 'Documents' && (x.s.conf === 'strong' || x.s.conf === 'good'); }
  /* The question words a "not built yet" rule fired on. */
  function gapTriggerTokens(g, A) {
    var hit = {};
    (g.rx || []).forEach(function (r) {
      var re = new RegExp(r.source, 'g'), m, guard = 0;
      while ((m = re.exec(A.textForRx)) && guard++ < 20) {
        tokens(m[0]).forEach(function (t) { hit[t] = 1; });
        if (m[0] === '') re.lastIndex++;
      }
    });
    (g.allC || []).forEach(function (grp) {
      grp.forEach(function (alt) {
        if (alt.length && alt.every(function (t) { return has(A, t); })) alt.forEach(function (t) { hit[t.charAt(0) === '=' ? t.slice(1) : t] = 1; });
      });
    });
    return Object.keys(hit);
  }

  function search(query, opts) {
    opts = opts || {};
    var A = analyze(query);
    var out = { query: String(query == null ? '' : query), empty: false, results: [], top: null, confident: false, ambiguous: false, gap: null,
                needsRequest: false, unknownWords: A.unknownKo, tokens: [], fuzzy: [], completed: [] };
    if (!A.content) { out.empty = true; return out; }
    resolveUnknown(A, opts);
    var Q = A.tokens.slice();
    var question = isQuestion(A.cleaned), concept = isConceptual(A.cleaned);
    var pass = rank(A, Q, question, concept), scored = pass.scored, softOn = pass.softOn;

    /* A topic word ("tax return", "lease", "receipt") can crowd out a plain file job ("redact my tax return"). If one of those
       topic rules matches and no file tool won, ask again without the topic's words: when a file tool (merge, split, redact,
       OCR, compress...) plainly fits what is left, that is the answer and the topic is only context. */
    var fileJob = isFileJob(scored[0]);
    if (!fileJob) {
      var trig = {}, anyTopic = false;
      IDX.gaps.forEach(function (g) { if (g.ctx && gapMatches(g, A)) { anyTopic = true; gapTriggerTokens(g, A).forEach(function (t) { trig[t] = 1; }); } });
      if (anyTopic) {
        var Q2 = Q.filter(function (q) { return !trig[q.t] && !(q.orig && trig[q.orig]); });
        if (Q2.length && Q2.length < Q.length && Q2.some(function (q) { return !SOFT[q.t]; })) {
          var pass2 = rank(A, Q2, question, concept), top2 = pass2.scored[0];
          var left = Q2.filter(function (q) { return !SOFT[q.t]; }).length;
          /* what is left must be a real job: the tool's own name word ("redact", "ocr") or at least two words, never one stray word ("form") */
          if (isFileJob(top2) && (top2.s.nameHit || left >= 2)) { Q = Q2; scored = pass2.scored; softOn = pass2.softOn; fileJob = true; }
        }
      }
    }
    out.results = scored.map(function (x) { return present(x.e, x.s, A); });
    if (CODELIKE.test(out.query) || OFFTOPIC.test(A.cleaned)) { out.results = []; scored = []; fileJob = false; }    // not something one of our pages can answer: show no "best match"
    out.top = out.results[0] || null;

    /* is there a clear winner? */
    var clear = !!out.top && (out.top.conf === 'strong' || out.top.conf === 'good');
    if (clear && !softOn) { clear = false; out.ambiguous = true; }
    var coreCount = Q.filter(function (q) { return !SOFT[q.t]; }).length;
    if (clear && coreCount === 1 && !scored[0].s.exact && scored[0].s.matchedW < SINGLE_WORD_INFO) { clear = false; out.ambiguous = true; }
    if (clear && !question && (scored[0].e.type === 'guide' || scored[0].e.type === 'info') && scored[0].s.conf !== 'strong') { clear = false; out.ambiguous = true; }   // an explainer is only a sure answer to a question
    if (clear) {
      var t0 = scored[0], rival = null;
      for (var i = 1; i < scored.length; i++) if (group(scored[i].e) === group(t0.e)) { rival = scored[i]; break; }
      if (rival && !(t0.s.exact && !rival.s.exact) && rival.s.base >= TIE * t0.s.base && (t0.s.prior - rival.s.prior) < 0.3) { clear = false; out.ambiguous = true; }
    }
    out.confident = clear;

    /* "not built yet" rules */
    var gap = null, softGap = null;
    for (var gi = 0; gi < IDX.gaps.length; gi++) {
      if (!gapMatches(IDX.gaps[gi], A)) continue;
      if (IDX.gaps[gi].ctx && fileJob) continue;   // a topic word ("lease", "receipt", "tax return") around a job a tool does: the topic is context, not the request
      if (!IDX.gaps[gi].soft) { gap = IDX.gaps[gi]; break; }       // "we do not have this at all" outranks "not exactly" ("video to gif" is a video request, not an image-format one)
      if (!softGap) softGap = IDX.gaps[gi];
    }
    if (!gap) gap = softGap;
    if (gap) {
      var near = [];
      gap.near.forEach(function (id) {
        var e = BYID[id];
        if (e) near.push(present(e, { total: 0, cov: 0, conf: 'near', why: [] }, A));
      });
      out.gap = { id: gap.id, label: gap.label, note: gap.note, soft: !!gap.soft, near: near };
      var tied = scored.length ? scored.filter(function (x) { return x.s.base >= TIE * scored[0].s.base; }).length : 0;
      var generic = tied >= 3 && !(scored[0] && scored[0].s.exact);                // three or more tools tie: the words are too common to point at any one of them
      var extra = generic ? [] : out.results.filter(function (r) { return r.conf === 'strong' && r.cov >= 0.9 && !near.some(function (n) { return n.id === r.id; }); });
      if (!gap.soft) out.results = near.concat(extra.slice(0, 2));
      else out.results = near.concat(extra).slice(0, MAX_RESULTS);
      out.confident = false; out.ambiguous = false;
      out.top = out.results[0] || null;
    }
    out.needsRequest = !out.confident;
    out.tokens = Q.map(function (q) { return q.t; });
    out.fuzzy = Q.filter(function (q) { return q.fuzzy; }).map(function (q) { return { from: q.surface, to: (SURF[q.t] && SURF[q.t][0]) || q.t }; });
    out.completed = Q.filter(function (q) { return q.prefix; }).map(function (q) { return { from: q.surface, to: (SURF[q.t] && SURF[q.t][0]) || q.t }; });     // half-typed last word that was finished for them
    return out;
  }

  function explain(query) {
    var A = analyze(query); resolveUnknown(A, {});
    var Q = A.tokens, qset = {}, order = [];
    Q.forEach(function (q) { qset[q.t] = 1; order.push(q.t); });
    var softOn = Q.some(function (q) { return !SOFT[q.t]; });
    var rows = ENTRIES.map(function (e) { var s = scoreEntry(e, Q, qset, order, false, softOn, A, 1); return { id: e.id, total: +s.total.toFixed(2), base: +s.base.toFixed(2), cov: +s.cov.toFixed(2), info: +s.matchedW.toFixed(2), name: s.nameHit, phrase: s.phraseHit }; })
      .filter(function (r) { return r.total > 0; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 8);
    return { tokens: Q.map(function (q) { return q.t + (q.fuzzy ? '~' : '') + (q.prefix ? '*' : ''); }), rows: rows, allSet: Object.keys(A.allSet), rx: A.textForRx };
  }

  var engine = { search: search, explain: explain, analyze: analyze, clean: clean, stem: stem, tokens: tokens, entries: ENTRIES, byId: BYID, config: CONFIG, soft: SOFT, vocab: function () { return Object.keys(VOCAB); } };

  /* ================================================================== BROWSER PART */
  var PPMHelp = { ready: true, search: search, engine: engine, examples: IDX.examples, config: CONFIG };
  root.PPMHelp = PPMHelp;
  if (typeof module !== 'undefined' && module.exports) module.exports = PPMHelp;
  if (typeof document === 'undefined') return;

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svgSearch() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', '18'); s.setAttribute('height', '18'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>';
    return s;
  }

  var STYLE_ID = 'ppmh-style';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.ppmh{--h-ink:var(--ink,#1C2321);--h-soft:var(--ink-soft,#4B534F);--h-line:var(--line,rgba(28,35,33,.14));--h-paper:var(--paper,#EEF1EF);--h-teal:var(--teal,#0D7A7C);--h-orange:var(--orange,#C14324);--h-yellow:var(--yellow,#F4B740);',
      'font-family:Inter,system-ui,sans-serif;color:var(--h-ink);line-height:1.5;}',
      '.ppmh *{box-sizing:border-box;}',
      '.ppmh-label{display:block;font-weight:600;font-size:.92rem;margin:0 0 8px;}',
      '.ppmh-field{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid var(--h-line);border-radius:12px;padding:6px 6px 6px 14px;}',
      '.ppmh-field:focus-within{border-color:var(--h-teal);box-shadow:0 0 0 3px rgba(13,122,124,.18);}',
      '.ppmh-field svg{flex-shrink:0;color:var(--h-soft);}',
      '.ppmh-field input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:1.05rem;color:var(--h-ink);padding:10px 4px;}',
      '.ppmh .ppmh-field input:focus-visible{outline:0;}',                       /* the whole box already shows the focus ring (see :focus-within above) */
      '.ppmh-go,.ppmh-btn{font:inherit;font-weight:600;font-size:.95rem;border:0;border-radius:999px;padding:11px 20px;min-height:44px;cursor:pointer;background:var(--h-orange);color:#fff;}',
      '.ppmh-go:hover,.ppmh-btn:hover{opacity:.92;}',
      '.ppmh-btn[disabled],.ppmh-go[disabled]{opacity:.55;cursor:not-allowed;}',
      '.ppmh-btn.ghost{background:transparent;color:var(--h-ink);border:1.5px solid var(--h-line);}',
      '.ppmh-btn.ghost:hover{border-color:var(--h-teal);}',
      '.ppmh-note{margin:10px 2px 0;font-size:.82rem;color:var(--h-soft);}',
      '.ppmh-chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none;}',
      '.ppmh-chip{font:inherit;font-size:.86rem;background:#fff;border:1px solid var(--h-line);border-radius:999px;padding:8px 14px;cursor:pointer;color:var(--h-ink);min-height:36px;}',
      '.ppmh-chip:hover{border-color:var(--h-teal);}',
      '.ppmh-out{margin-top:22px;}',
      '.ppmh-h{font-family:"IBM Plex Mono",monospace;font-size:.74rem;letter-spacing:.07em;text-transform:uppercase;color:var(--h-teal);margin:18px 0 8px;}',
      '.ppmh-card{display:block;background:#fff;border:1px solid var(--h-line);border-radius:12px;padding:14px 16px;margin:0 0 10px;text-decoration:none;color:inherit;}',
      'a.ppmh-card:hover,a.ppmh-card:focus-visible{border-color:var(--h-teal);box-shadow:0 4px 14px rgba(28,35,33,.08);}',
      '.ppmh-card.best{border-color:var(--h-teal);border-width:1.5px;}',
      '.ppmh-card-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
      '.ppmh-card-name{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:1.02rem;color:var(--h-ink);}',
      '.ppmh-card-cat{font-size:.76rem;color:var(--h-soft);}',
      '.ppmh-card-desc{margin:4px 0 0;font-size:.9rem;color:var(--h-soft);}',
      '.ppmh-why{margin:8px 0 0;font-size:.78rem;color:var(--h-soft);}',
      '.ppmh-why b{font-weight:600;color:var(--h-ink);}',
      '.ppmh-warn{margin:8px 0 0;font-size:.82rem;color:#7a3b00;background:#FFF4DD;border-radius:8px;padding:8px 10px;}',
      '.ppmh-open{margin-top:8px;font-size:.86rem;font-weight:600;color:var(--h-teal);}',
      '.ppmh-gap{background:#fff;border:1px solid var(--h-line);border-left:4px solid var(--h-orange);border-radius:10px;padding:14px 16px;margin:0 0 12px;}',
      '.ppmh-gap.soft{border-left-color:var(--h-yellow);}',
      '.ppmh-gap-t{font-weight:700;margin:0 0 4px;}',
      '.ppmh-gap p{margin:0;font-size:.9rem;color:var(--h-soft);}',
      '.ppmh-fixed{margin:0 0 6px;font-size:.84rem;color:var(--h-soft);}',
      '.ppmh-ask{margin-top:18px;padding:14px 16px;background:var(--h-paper);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
      '.ppmh-ask p{margin:0;font-size:.9rem;}',
      '.ppmh-form{background:#fff;border:1px solid var(--h-line);border-radius:14px;padding:18px;margin-top:14px;}',
      '.ppmh-form h2{font-family:"Space Grotesk",sans-serif;font-size:1.1rem;margin:0 0 4px;}',
      '.ppmh-form .sub{margin:0 0 14px;font-size:.88rem;color:var(--h-soft);}',
      '.ppmh-f{margin:0 0 14px;}',
      '.ppmh-f label{display:block;font-size:.84rem;font-weight:600;margin:0 0 5px;}',
      '.ppmh-f textarea,.ppmh-f input[type=email]{width:100%;font:inherit;font-size:.96rem;padding:10px 12px;border:1px solid var(--h-line);border-radius:8px;background:#fff;color:var(--h-ink);}',
      '.ppmh-f textarea{min-height:110px;resize:vertical;}',
      '.ppmh-f .hint{margin:5px 0 0;font-size:.78rem;color:var(--h-soft);}',
      '.ppmh-f .count{float:right;font-weight:400;color:var(--h-soft);}',
      '.ppmh-f [aria-invalid=true]{border-color:var(--h-orange);}',
      '.ppmh-err{color:var(--h-orange);font-size:.84rem;margin:6px 0 0;}',
      '.ppmh-status{margin-top:12px;font-size:.9rem;padding:10px 12px;border-radius:8px;display:none;}',
      '.ppmh-status.show{display:block;}',
      '.ppmh-status.ok{background:rgba(15,139,141,.1);}',
      '.ppmh-status.bad{background:rgba(242,84,45,.08);color:var(--h-orange);}',
      '.ppmh-sent{background:rgba(15,139,141,.08);border:1px solid rgba(15,139,141,.35);border-radius:12px;padding:16px;margin-top:14px;}',
      '.ppmh-sent h2{margin:0 0 6px;font-family:"Space Grotesk",sans-serif;font-size:1.1rem;}',
      '.ppmh-sent p{margin:0 0 8px;font-size:.92rem;}',
      '.ppmh-fine{font-size:.78rem;color:var(--h-soft);margin:12px 0 0;}',
      '.ppmh-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden;}',
      '.ppmh-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}',
      '.ppmh :focus-visible{outline:3px solid var(--h-teal);outline-offset:2px;}',
      '@media (max-width:560px){.ppmh-go{padding:11px 14px;}.ppmh-ask{flex-direction:column;align-items:stretch;}.ppmh-ask .ppmh-btn{width:100%;}}',
      '@media (prefers-reduced-motion:no-preference){.ppmh-card{transition:border-color .15s ease,box-shadow .15s ease;}}'
    ].join('');
    document.head.appendChild(h('style', { id: STYLE_ID, text: css }));
  }

  /* ---------------------------------------------------------------- request form */
  function randomId() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '', i;
    try {
      var a = new Uint8Array(6);
      (root.crypto || root.msCrypto).getRandomValues(a);
      for (i = 0; i < 6; i++) out += chars.charAt(a[i] % chars.length);
    } catch (e) { for (i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return out;
  }
  function safeStore(op, key, val) {
    try { var s = root.localStorage; return op === 'get' ? s.getItem(key) : s.setItem(key, val); } catch (e) { return null; }
  }
  var sessionSent = 0, lastSentAt = 0;
  function recentSends() {
    var raw = safeStore('get', 'ppmh_sent'), now = Date.now(), list = [];
    try { list = JSON.parse(raw || '[]').filter(function (t) { return now - t < 86400000; }); } catch (e) { list = []; }
    return list;
  }
  function rememberSend() {
    var l = recentSends(); l.push(Date.now()); safeStore('set', 'ppmh_sent', JSON.stringify(l));
  }

  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }
  function countWords(s) { return (s.trim().match(/\S+/g) || []).length; }
  function countLinks(s) { return (s.match(/https?:\/\/|www\./gi) || []).length; }

  /* opts: { text, matches:[names], gapId, onSent(id), onBack() } */
  function requestForm(container, opts) {
    opts = opts || {};
    injectStyles();
    container.innerHTML = '';
    var uid = 'ppmh' + Math.floor(Math.random() * 1e6);
    var ta = h('textarea', { id: uid + '-m', name: 'message', maxlength: String(CONFIG.maxMessage), required: true, 'aria-describedby': uid + '-mh', placeholder: 'What do you have, and what do you want out of it? For example: “I have a scanned 40-page PDF and need it under 5 MB to upload to a government site.”' });
    ta.value = (opts.text || '').slice(0, CONFIG.maxMessage);
    var count = h('span', { class: 'count', 'aria-hidden': 'true', text: ta.value.length + ' / ' + CONFIG.maxMessage });
    var mErr = h('p', { class: 'ppmh-err', id: uid + '-me', role: 'alert', hidden: true });
    var email = h('input', { type: 'email', id: uid + '-e', name: 'email', autocomplete: 'email', placeholder: 'you@example.com', 'aria-describedby': uid + '-eh' });
    var eErr = h('p', { class: 'ppmh-err', id: uid + '-ee', role: 'alert', hidden: true });
    var hp = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    var bot = h('input', { type: 'checkbox', name: 'botcheck', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    var btn = h('button', { type: 'submit', class: 'ppmh-btn', text: 'Send request' });
    var status = h('div', { class: 'ppmh-status', role: 'status', 'aria-live': 'polite' });
    var back = opts.onBack ? h('button', { type: 'button', class: 'ppmh-btn ghost', text: 'Back to results', onclick: opts.onBack }) : null;

    ta.addEventListener('input', function () { count.textContent = ta.value.length + ' / ' + CONFIG.maxMessage; if (ta.getAttribute('aria-invalid')) { ta.removeAttribute('aria-invalid'); mErr.hidden = true; } });
    email.addEventListener('input', function () { if (email.getAttribute('aria-invalid')) { email.removeAttribute('aria-invalid'); eErr.hidden = true; } });

    var form = h('form', { class: 'ppmh-form', novalidate: true }, [
      h('h2', { text: 'Ask us to build it' }),
      h('p', { class: 'sub', text: 'Tell us what you were trying to do. Requests like yours help us decide what to build next.' }),
      h('div', { class: 'ppmh-f' }, [h('label', { for: uid + '-m' }, ['What do you need?', count]), ta,
        h('p', { class: 'hint', id: uid + '-mh', text: 'A sentence or two is plenty. Please don’t paste passwords, ID numbers or private documents.' }), mErr]),
      h('div', { class: 'ppmh-f' }, [h('label', { for: uid + '-e', text: 'Your email (optional)' }), email,
        h('p', { class: 'hint', id: uid + '-eh', text: 'Only if you’d like a reply — for example when it’s ready. We use it for this request only.' }), eErr]),
      h('div', { class: 'ppmh-hp', 'aria-hidden': 'true' }, [hp, bot]),
      h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [btn, back]),
      status,
      h('p', { class: 'ppmh-fine' }, ['This message goes to our inbox through Web3Forms, a form service. It isn’t posted anywhere public. See the ', h('a', { href: '/privacy', text: 'Privacy Policy' }), '.'])
    ]);
    container.appendChild(form);

    function say(kind, msg) { status.className = 'ppmh-status show ' + kind; status.textContent = msg; }
    function fail(el, errEl, msg) { el.setAttribute('aria-invalid', 'true'); errEl.textContent = msg; errEl.hidden = false; el.focus(); }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = ta.value.replace(/\s+/g, ' ').trim(), mail = email.value.trim();
      status.className = 'ppmh-status';
      if (countWords(msg) < CONFIG.minWords || msg.length < 8) return fail(ta, mErr, 'Add a few words about what you need.');
      if (countLinks(msg) > 2) return fail(ta, mErr, 'Please describe it in words rather than links.');
      if (mail && !validEmail(mail)) return fail(email, eErr, 'That doesn’t look like an email address — fix it or leave it blank.');
      if (hp.value || bot.checked) { done(randomId()); return; }                       // a bot filled the hidden fields: pretend it worked
      if (sessionSent >= CONFIG.perSession || recentSends().length >= CONFIG.perDay) { say('bad', 'That’s a lot of requests from this browser today. Please try again tomorrow, or email ' + CONFIG.fallbackEmail + '.'); return; }
      if (Date.now() - lastSentAt < CONFIG.cooldownMs) { say('bad', 'Please wait a few seconds before sending another request.'); return; }

      var id = randomId();
      var payload = {
        access_key: CONFIG.accessKey, from_name: CONFIG.fromName,
        subject: CONFIG.subjectPrefix + ' [' + id + ']: ' + msg.slice(0, 60),
        message: msg, request_id: id, kind: 'tool-request', page: (root.location && root.location.pathname) || '',
        language: (root.navigator && root.navigator.language) || '', closest_matches: (opts.matches || []).slice(0, 3).join(' | '),
        not_built_rule: opts.gapId || '', sent_at: new Date().toISOString(), botcheck: ''
      };
      if (mail) payload.email = mail;
      btn.disabled = true; say('ok', 'Sending…');
      root.fetch(CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.status === 200 && res.body && res.body.success) { sessionSent++; lastSentAt = Date.now(); rememberSend(); done(id, !!mail); }
          else { btn.disabled = false; say('bad', 'Couldn’t send that. Try again, or email ' + CONFIG.fallbackEmail + ' directly.'); }
        })
        .catch(function () { btn.disabled = false; say('bad', 'Couldn’t send that — check your connection and try again, or email ' + CONFIG.fallbackEmail + '.'); });
    });

    function done(id, hadEmail) {
      container.innerHTML = '';
      var again = h('button', { type: 'button', class: 'ppmh-btn ghost', text: opts.onBack ? 'Back to results' : 'Send another', onclick: function () { if (opts.onBack) opts.onBack(); else requestForm(container, { matches: opts.matches }); } });
      var box = h('div', { class: 'ppmh-sent', role: 'status', tabindex: '-1' }, [
        h('h2', { text: 'Got it — thank you.' }),
        h('p', { text: 'Your request (#' + id + ') is in our inbox. ' + (hadEmail ? 'If we build it, we may write to the address you gave.' : 'You didn’t leave an email, so we can’t reply — check the site now and then.') }),
        h('p', { text: 'We can’t promise every request becomes a tool, but requests like yours decide what we build next.' }),
        again
      ]);
      container.appendChild(box);
      try { box.focus(); } catch (e) { /* ignore */ }
      if (opts.onSent) opts.onSent(id);
    }
    return { focus: function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } };
  }

  /* ---------------------------------------------------------------- finder panel (used on /help-me) */
  function cardFor(r, best) {
    var kids = [
      h('div', { class: 'ppmh-card-top' }, [h('span', { class: 'ppmh-card-name', text: r.name }), h('span', { class: 'ppmh-card-cat', text: r.cat })]),
      h('p', { class: 'ppmh-card-desc', text: r.desc })
    ];
    if (r.why && r.why.length) kids.push(h('p', { class: 'ppmh-why' }, ['Matched your words: ', h('b', { text: r.why.join(', ') })]));
    (r.warn || []).forEach(function (w) { kids.push(h('p', { class: 'ppmh-warn', text: w })); });
    kids.push(h('div', { class: 'ppmh-open', 'aria-hidden': 'true', text: 'Open →' }));
    return h('a', { class: 'ppmh-card' + (best ? ' best' : ''), href: r.href }, kids);
  }

  /* opts: { query, autofocus } */
  function mountFinder(rootEl, opts) {
    opts = opts || {};
    injectStyles();
    rootEl.classList.add('ppmh');
    rootEl.innerHTML = '';
    var uid = 'ppmhq';
    var input = h('input', { type: 'search', id: uid, name: 'q', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search', 'aria-describedby': uid + '-n', placeholder: 'e.g. “make a photo small enough to email” or “take-home pay in Texas”' });
    var go = h('button', { type: 'submit', class: 'ppmh-go', text: 'Find' });
    var form = h('form', { role: 'search', action: '#', onsubmit: function (e) { e.preventDefault(); run(true); } }, [
      h('label', { class: 'ppmh-label', for: uid, text: 'What are you trying to get done?' }),
      h('div', { class: 'ppmh-field' }, [svgSearch(), input, go]),
      h('p', { class: 'ppmh-note', id: uid + '-n', text: 'Matching happens in your browser — what you type here isn’t sent anywhere unless you press “Send request”. This is a keyword finder, not an AI chatbot.' })
    ]);
    var chips = h('ul', { class: 'ppmh-chips', 'aria-label': 'Examples' });
    (IDX.examples || []).forEach(function (ex) {
      chips.appendChild(h('li', {}, [h('button', { type: 'button', class: 'ppmh-chip', text: ex, onclick: function () { input.value = ex; run(true); input.focus(); } })]));
    });
    var live = h('div', { class: 'ppmh-sr', role: 'status', 'aria-live': 'polite' });
    var out = h('div', { class: 'ppmh-out' });
    rootEl.appendChild(form); rootEl.appendChild(chips); rootEl.appendChild(live); rootEl.appendChild(out);

    var lastResult = null, timer = null;

    function showRequest(text) {
      var holder = h('div');
      out.innerHTML = '';
      out.appendChild(holder);
      var rf = requestForm(holder, {
        text: text, matches: lastResult && lastResult.results ? lastResult.results.map(function (r) { return r.name; }) : [], gapId: lastResult && lastResult.gap ? lastResult.gap.id : '',
        onBack: function () { run(true); }
      });
      rf.focus();
      try { holder.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
    }

    function askBar(text, label, msg) {
      return h('div', { class: 'ppmh-ask' }, [h('p', { text: msg }), h('button', { type: 'button', class: 'ppmh-btn', text: label, onclick: function () { showRequest(text); } })]);
    }

    function run(announce) {
      var q = input.value;
      out.innerHTML = '';
      if (!q.trim()) { live.textContent = ''; lastResult = null; return; }
      var res = search(q, { prefix: !/\s$/.test(q) });    // a last word that is still half-written ("passw") is finished for them; a space after it means it was complete. Typing and pressing Find give the same answer.
      lastResult = res;
      if (res.empty) { out.appendChild(h('p', { class: 'ppmh-note', text: 'Tell me what you’re trying to get done — for example, “merge two PDFs”.' })); return; }
      var shown = 0, hardGap = res.gap && !res.gap.soft;
      var fixed = (res.fuzzy || []).concat(announce ? (res.completed || []) : []);      // spelling fixes always; a finished half-word only once they press Find (while typing it would just flicker)
      if (fixed.length) {
        out.appendChild(h('p', { class: 'ppmh-fixed', text: 'Showing results for ' + fixed.map(function (f) { return '“' + f.to + '”'; }).join(', ') + ' (you typed ' + fixed.map(function (f) { return '“' + f.from + '”'; }).join(', ') + ').' }));
      }
      if (res.gap) {
        out.appendChild(h('div', { class: 'ppmh-gap' + (res.gap.soft ? ' soft' : '') }, [
          h('p', { class: 'ppmh-gap-t', text: res.gap.soft ? 'Not exactly: ' + res.gap.label : 'We don’t have this yet: ' + res.gap.label }),
          h('p', { text: res.gap.note })
        ]));
      }
      if (res.results.length) {
        var heading = hardGap ? 'Closest things we do have' : (res.confident ? 'Best match' : (res.ambiguous && res.results.length > 1 ? 'A few tools match — which one fits?' : 'Closest we have — may not be what you need'));
        out.appendChild(h('div', { class: 'ppmh-h', text: heading }));
        res.results.forEach(function (r, i) { out.appendChild(cardFor(r, i === 0 && res.confident)); shown++; });
      }
      if (res.needsRequest) {
        if (!shown && !res.gap) out.appendChild(h('div', { class: 'ppmh-gap' }, [h('p', { class: 'ppmh-gap-t', text: 'We couldn’t find a tool for that.' }), h('p', { text: 'Try different words, or tell us what you need.' })]));
        out.appendChild(askBar(q, 'Ask us to build it', hardGap ? 'Want this one? Tell us — requests like yours decide what we build next.' : 'Not what you were after?'));
      } else {
        out.appendChild(askBar(q, 'Tell us what you need', 'Not quite right?'));
      }
      if (announce) live.textContent = res.results.length + (res.results.length === 1 ? ' match' : ' matches') + (hardGap ? ', and we don’t have this exact tool yet' : '') + '.';
    }

    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { run(false); }, 160); });
    if (opts.query) { input.value = opts.query; run(true); }
    if (opts.autofocus !== false) { try { input.focus(); } catch (e) { /* ignore */ } }
    return { run: run, input: input, setQuery: function (q) { input.value = q; run(true); } };
  }

  PPMHelp.requestForm = requestForm;
  PPMHelp.mountFinder = mountFinder;
  PPMHelp.injectStyles = injectStyles;

  /* /help-me mounts itself */
  function autoMount() {
    var el = document.getElementById('ppmh-root');
    if (!el || el.getAttribute('data-mounted')) return;
    el.setAttribute('data-mounted', '1');
    var q = '';
    try {
      var m = /[#&]q=([^&]*)/.exec(root.location.hash || '');
      if (m) { q = decodeURIComponent(m[1].replace(/\+/g, ' ')).slice(0, 300); root.history.replaceState(null, '', root.location.pathname); }
    } catch (e) { q = ''; }
    mountFinder(el, { query: q, autofocus: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount); else autoMount();
})(typeof window !== 'undefined' ? window : globalThis);
