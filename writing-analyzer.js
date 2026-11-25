/*!
 * PopPopMake writing analyzer — style profile and quality checks for English text, entirely in the browser.
 * Nothing is sent anywhere. Pure functions (no page code), shared by /writing-style-analyzer and /writing-quality-checker.
 * analyze(text) → { counts, sentences[], readability, style, issues[], score }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PPMWriting = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var STOP = ('a an the and or but if then so of to in on at by for with from as is are was were be been being it its this that these those ' +
    'i me my we our you your he him his she her they them their there here what which who whom whose when where why how not no do does did ' +
    'have has had will would can could should may might must shall about into over under after before than too also just very more most some any ' +
    'all each other such only own same up down out off again further once both few nor am s t don doesn didn isn wasn aren weren').split(' ');
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  var NOT_ADVERB = ('only family early daily likely lonely friendly lovely holy ugly silly belly jelly rally reply supply apply fly ally ' +
    'italy july bully curly hilly chilly costly deadly elderly fly folly gully jolly lily oily rely sly smelly wily woolly weekly monthly yearly ' +
    'hourly nightly quarterly assembly anomaly melancholy monopoly multiply comply imply butterfly firefly dragonfly').split(' ');
  var NOTADV = {}; NOT_ADVERB.forEach(function (w) { NOTADV[w] = 1; });
  var IRREG = ('been born beaten become begun bent bet bitten blown broken brought built burnt bought caught chosen come cost cut dealt done ' +
    'drawn dreamt drunk driven eaten fallen fed felt fought found flown forbidden forgotten forgiven frozen gotten given gone grown hung heard ' +
    'hidden hit held hurt kept known laid led left lent let lain lit lost made meant met paid put quit read ridden rung risen run said seen ' +
    'sought sold sent set shaken shot shown shut sung sunk sat slept slid spoken spent spun spread stood stolen stuck stung struck sworn swept ' +
    'swum swung taken taught torn told thought thrown understood woken worn won withdrawn written').split(' ');
  var IRR = {}; IRREG.forEach(function (w) { IRR[w] = 1; });
  var FILLERS = ['very', 'really', 'just', 'actually', 'basically', 'literally', 'quite', 'rather', 'somewhat', 'totally', 'definitely',
    'simply', 'kind of', 'sort of', 'a bit', 'a little', 'in order to', 'due to the fact that', 'at this point in time', 'it is important to note that',
    'needless to say', 'for all intents and purposes', 'the fact that', 'in terms of'];
  var HEDGES = ['maybe', 'perhaps', 'possibly', 'probably', 'seems', 'seem', 'appears to', 'might', 'i think', 'i believe', 'i feel', 'somewhat', 'arguably'];
  var CLICHES = ['at the end of the day', 'think outside the box', 'low-hanging fruit', 'game changer', 'game-changer', 'move the needle', 'circle back',
    'in today\'s fast-paced world', 'in this day and age', 'last but not least', 'each and every', 'first and foremost', 'when all is said and done',
    'the bottom line', 'a perfect storm', 'push the envelope', 'it goes without saying', 'only time will tell', 'take it to the next level',
    'tip of the iceberg', 'raise the bar', 'best of both worlds', 'a level playing field', 'paradigm shift', 'win-win'];
  var WORDY = { 'in order to': 'to', 'due to the fact that': 'because', 'at this point in time': 'now', 'in the event that': 'if', 'a large number of': 'many',
    'has the ability to': 'can', 'is able to': 'can', 'in spite of the fact that': 'although', 'for the purpose of': 'to / for', 'with regard to': 'about',
    'in the near future': 'soon', 'on a daily basis': 'daily', 'make a decision': 'decide', 'give consideration to': 'consider', 'take into consideration': 'consider',
    'it is important to note that': '(cut it)', 'the fact that': '(often cut)', 'in terms of': 'in / for / about', 'prior to': 'before', 'subsequent to': 'after' };

  function words(s) { return (s.toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)?/g) || []); }
  function syllables(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    var m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1);
  }
  // sentences with their positions in the text (abbreviations like "e.g." and "Mr." do not end a sentence)
  function splitSentences(text) {
    var out = [], re = /[^.!?\n]+(?:[.!?]+["'”’)\]]*|\n|$)/g, m, buf = '', start = 0;
    var ABBR = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e|inc|ltd|co|no|fig|approx|u\.s)\.$/i;
    while ((m = re.exec(text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (!buf) start = m.index;
      buf += m[0];
      if (ABBR.test(buf.trim()) || /\d\.$/.test(buf.trim()) && /^\d/.test(text.slice(re.lastIndex))) continue;
      var t = buf.trim(); if (words(t).length) out.push({ text: t, start: start + buf.indexOf(t), end: start + buf.indexOf(t) + t.length });
      buf = '';
    }
    if (buf.trim() && words(buf).length) out.push({ text: buf.trim(), start: start, end: start + buf.length });
    return out;
  }
  function findAll(text, re, kind, extra) {
    var out = [], m; re.lastIndex = 0;
    while ((m = re.exec(text))) { out.push(Object.assign({ kind: kind, start: m.index, end: m.index + m[0].length, text: m[0] }, extra ? extra(m) : {})); if (!m[0]) re.lastIndex++; }
    return out;
  }
  function phraseRe(list) { return new RegExp('\\b(' + list.map(function (p) { return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'); }).join('|') + ')\\b', 'gi'); }
  var FILLER_RE = phraseRe(FILLERS), HEDGE_RE = phraseRe(HEDGES), CLICHE_RE = phraseRe(CLICHES), WORDY_RE = phraseRe(Object.keys(WORDY));
  var PASSIVE_RE = /\b(am|is|are|was|were|be|been|being|get|gets|got|gotten)\s+(?:(?:not|never|also|often|always|usually|being)\s+)?([a-z]+ed|[a-z]+en|[a-z]+[^aeiou]t)\b/gi;

  function stats(arr) { var n = arr.length; if (!n) return { mean: 0, sd: 0 }; var mean = arr.reduce(function (a, b) { return a + b; }, 0) / n; var v = arr.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / n; return { mean: mean, sd: Math.sqrt(v) }; }

  function analyze(text) {
    text = String(text || '').replace(/\r/g, '');
    var ws = words(text), nw = ws.length;
    var sents = splitSentences(text).map(function (s) { var w = words(s.text); return { text: s.text, start: s.start, end: s.end, words: w.length, first: w[0] || '' }; });
    var paras = text.split(/\n\s*\n/).filter(function (p) { return words(p).length; }).length;
    var syl = ws.reduce(function (a, w) { return a + syllables(w); }, 0), ns = Math.max(1, sents.length);
    var fre = nw ? 206.835 - 1.015 * (nw / ns) - 84.6 * (syl / nw) : 0, fk = nw ? 0.39 * (nw / ns) + 11.8 * (syl / nw) - 15.59 : 0;
    var complex = ws.filter(function (w) { return syllables(w) >= 3; }).length, fog = nw ? 0.4 * ((nw / ns) + 100 * complex / nw) : 0;
    var lens = sents.map(function (s) { return s.words; }), st = stats(lens);
    var issues = [];
    // long sentences
    sents.forEach(function (s) { if (s.words > 35) issues.push({ kind: 'verylong', start: s.start, end: s.end, text: s.text, n: s.words }); else if (s.words > 25) issues.push({ kind: 'long', start: s.start, end: s.end, text: s.text, n: s.words }); });
    // passive voice
    findAll(text, PASSIVE_RE, 'passive').forEach(function (x) {
      var part = x.text.split(/\s+/).pop().toLowerCase();
      if (/ed$/.test(part) || IRR[part]) { if (!/^(get|gets|got|gotten)$/i.test(x.text.split(/\s+/)[0]) || /ed$/.test(part)) issues.push(x); }
    });
    // adverbs
    var FH = {}; FILLERS.concat(HEDGES).forEach(function (w) { FH[w] = 1; });
    findAll(text, /\b[a-z]+ly\b/gi, 'adverb').forEach(function (x) { var w = x.text.toLowerCase(); if (!NOTADV[w] && !FH[w] && w.length > 4) issues.push(x); });   // fillers like "really" are counted once, as fillers
    findAll(text, FILLER_RE, 'filler').forEach(function (x) { if (!WORDY[x.text.toLowerCase().replace(/\s+/g, ' ')]) issues.push(x); });
    findAll(text, HEDGE_RE, 'hedge').forEach(function (x) { issues.push(x); });
    findAll(text, CLICHE_RE, 'cliche').forEach(function (x) { issues.push(x); });
    findAll(text, WORDY_RE, 'wordy', function (m) { return { fix: WORDY[m[0].toLowerCase().replace(/\s+/g, ' ')] }; }).forEach(function (x) { issues.push(x); });
    // repeated words close together (the same content word twice within 12 words)
    var tokRe = /[A-Za-z][A-Za-z'’]*/g, tm, toks = [];
    while ((tm = tokRe.exec(text))) toks.push({ w: tm[0].toLowerCase(), start: tm.index, end: tm.index + tm[0].length });
    var lastSeen = {};
    toks.forEach(function (tk, i) {
      var w = tk.w; if (STOPSET[w] || w.length < 4) return;
      var stem = w.replace(/(ing|ed|es|s)$/, '');
      if (lastSeen[stem] !== undefined && i - lastSeen[stem] <= 12) issues.push({ kind: 'echo', start: tk.start, end: tk.end, text: text.slice(tk.start, tk.end) });
      lastSeen[stem] = i;
    });
    // three sentences in a row starting with the same word
    for (var i = 2; i < sents.length; i++) if (sents[i].first && sents[i].first === sents[i - 1].first && sents[i].first === sents[i - 2].first) issues.push({ kind: 'starts', start: sents[i].start, end: sents[i].start + sents[i].first.length, text: sents[i].first });
    // double spaces, repeated words ("the the")
    findAll(text, / {2,}(?=\S)/g, 'space').forEach(function (x) { issues.push(x); });
    findAll(text, /\b(\w+)\s+\1\b/gi, 'double').forEach(function (x) { if (!/^(that|had|is)$/i.test(x.text.split(/\s+/)[0])) issues.push(x); });
    issues.sort(function (a, b) { return a.start - b.start || b.end - a.end; });

    var count = function (k) { return issues.filter(function (x) { return x.kind === k; }).length; };
    var freq = {}; ws.forEach(function (w) { if (!STOPSET[w] && w.length > 3) freq[w] = (freq[w] || 0) + 1; });
    var top = Object.keys(freq).map(function (k) { return [k, freq[k]]; }).filter(function (x) { return x[1] >= 3; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    // vocabulary variety: moving type-token ratio over 50-word windows (fairer than plain TTR for long texts)
    var mattr = 0;
    if (nw >= 50) { var win = 50, sum = 0, k2 = 0; for (var j = 0; j + win <= nw; j += 10) { var set = {}; ws.slice(j, j + win).forEach(function (w) { set[w] = 1; }); sum += Object.keys(set).length / win; k2++; } mattr = sum / k2; }
    else if (nw) { var s2 = {}; ws.forEach(function (w) { s2[w] = 1; }); mattr = Object.keys(s2).length / nw; }
    var you = ws.filter(function (w) { return /^(you|your|yours|you're|you’re)$/.test(w); }).length, me = ws.filter(function (w) { return /^(i|me|my|mine|i'm|i’m|we|our|us)$/.test(w); }).length;
    var questions = (text.match(/\?/g) || []).length, exclaims = (text.match(/!/g) || []).length;
    var nominal = ws.filter(function (w) { return w.length > 6 && /(tion|sion|ment|ness|ity|ance|ence|ization)s?$/.test(w); }).length;
    var per100 = function (n) { return nw ? Math.round(n / nw * 1000) / 10 : 0; };
    var style = {
      avgSentence: Math.round(st.mean * 10) / 10, sentenceSd: Math.round(st.sd * 10) / 10,
      variety: st.mean ? Math.round(st.sd / st.mean * 100) / 100 : 0,
      shortest: lens.length ? Math.min.apply(null, lens) : 0, longest: lens.length ? Math.max.apply(null, lens) : 0,
      passivePct: Math.round(count('passive') / ns * 100), adverbsPer100: per100(count('adverb')), fillersPer100: per100(count('filler')),
      hedgesPer100: per100(count('hedge')), nominalPer100: per100(nominal), vocabulary: Math.round(mattr * 100) / 100,
      avgWordLength: nw ? Math.round(ws.reduce(function (a, w) { return a + w.length; }, 0) / nw * 10) / 10 : 0,
      voice: you > me * 1.5 && you >= 2 ? 'you' : me > you * 1.5 && me >= 2 ? 'me' : you + me >= 2 ? 'mixed' : 'neutral',
      questions: questions, exclaims: exclaims, top: top
    };
    // quality score: 100 minus weighted problems per 100 words, with readability and rhythm adjustments
    var pen = 0;
    pen += Math.min(18, count('verylong') * 6 + count('long') * 2.5);
    pen += Math.min(14, Math.max(0, style.passivePct - 10) * 0.6);
    pen += Math.min(10, Math.max(0, style.adverbsPer100 - 2) * 2.5);
    pen += Math.min(10, (style.fillersPer100 + style.hedgesPer100) * 2);
    pen += Math.min(10, count('cliche') * 4 + count('wordy') * 2);
    pen += Math.min(8, per100(count('echo')) * 2);
    pen += Math.min(6, count('starts') * 2 + count('double') * 3 + count('space') * 0.5);
    if (nw >= 60 && sents.length >= 4 && style.variety < 0.3) pen += 6;
    if (fk > 14) pen += Math.min(8, (fk - 14) * 2);
    var score = nw < 20 ? null : Math.max(0, Math.min(100, Math.round(100 - pen)));
    return {
      counts: { words: nw, sentences: sents.length, paragraphs: paras, characters: text.length, syllables: syl, readingMinutes: Math.max(1, Math.round(nw / 238)) },
      sentences: sents, readability: { fre: Math.round(fre * 10) / 10, fk: Math.round(fk * 10) / 10, fog: Math.round(fog * 10) / 10 },
      style: style, issues: issues, score: score,
      tally: { long: count('long'), verylong: count('verylong'), passive: count('passive'), adverb: count('adverb'), filler: count('filler'), hedge: count('hedge'),
        cliche: count('cliche'), wordy: count('wordy'), echo: count('echo'), starts: count('starts'), double: count('double'), space: count('space') }
    };
  }
  function freLabel(fre) { return fre >= 80 ? 'Very easy' : fre >= 70 ? 'Easy' : fre >= 60 ? 'Plain English' : fre >= 50 ? 'Fairly difficult' : fre >= 30 ? 'Difficult' : 'Very difficult'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // text with marks for the chosen kinds (no overlaps: the first, longest mark wins)
  function highlight(text, issues, kinds, titles) {
    var out = '', pos = 0;
    issues.filter(function (x) { return kinds.indexOf(x.kind) >= 0; }).forEach(function (x) {
      if (x.start < pos) return;
      out += esc(text.slice(pos, x.start)) + '<mark class="w-' + x.kind + '" title="' + esc(titles[x.kind] || x.kind) + (x.fix ? ' → ' + esc(x.fix) : '') + '">' + esc(text.slice(x.start, x.end)) + '</mark>';
      pos = x.end;
    });
    return out + esc(text.slice(pos));
  }
  return { analyze: analyze, syllables: syllables, splitSentences: splitSentences, freLabel: freLabel, highlight: highlight, esc: esc };
}));
