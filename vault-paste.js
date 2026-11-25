/* PopPopMake Vault — reading pasted or shared payment messages (card / bank / pay-app texts) into budget entries.
 * Korean, Japanese and English formats. Pure functions: no screen code, so it can be tested on its own.
 * parse(text, opts) → [{ amt (minor units), cur, type: 'expense'|'income', note, date: 'YYYY-MM-DD', time, cancel, src }]
 */
(function (root) {
  'use strict';
  var DIGITS = { KRW: 0, JPY: 0, USD: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, CNY: 2, TWD: 0 };
  var KO_CARD = /(신한|KB\s?국민|국민|삼성|현대|롯데|하나|우리|BC|비씨|NH\s?농협|농협|씨티|카카오뱅크|카카오페이|카카오|토스뱅크|토스페이|토스|케이뱅크|IBK\s?기업|기업|SC제일|수협|우체국|새마을|신협|부산|대구|광주|전북|경남|제주|네이버페이|페이코|삼성페이)(\s?(카드|체크|은행|뱅크|페이))?/;
  var KO_CARD_NAMED = new RegExp(KO_CARD.source.slice(0, -1).replace(/\?$/, '') + '');
  var SKIP_BEFORE = /(누적|잔액|잔고|한도|남은|이용가능|가능금액|포인트|캐시백|残高|利用可能|ポイント|balance|available|limit|points|cashback)\s*[:：]?\s*$/i;
  var INCOME = /입금|급여|월급|환불|이자\s*입금|received|deposit|refund|credited|入金|返金|振込入金|給与/i;
  var CANCEL = /취소|승인\s*취소|cancel+ed|reversed|void|取消|キャンセル/i;
  var PAYWORD = /승인|결제|출금|사용|이용|지출|체크|일시불|할부|spent|charged|purchase|transaction|payment|paid|debit|approved|利用|決済|支払|引落/i;
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function minor(numStr, cur) {
    var v = parseFloat(String(numStr).replace(/[,\s]/g, ''));
    if (!isFinite(v) || v <= 0) return null;
    return Math.round(v * Math.pow(10, DIGITS[cur] == null ? 2 : DIGITS[cur]));
  }
  // every money mention with its currency; the ones right after "누적 / 잔액 / balance…" are not the payment
  function amounts(s) {
    var out = [], re = /(?:(\$|US\$|USD|€|EUR|£|GBP|¥|JPY|￥|₩|KRW)\s?([\d,]+(?:\.\d{1,2})?))|(?:([\d,]+(?:\.\d{1,2})?)\s?(원|円|엔|USD|EUR|KRW|JPY|dollars?))/gi, m;
    while ((m = re.exec(s))) {
      var before = s.slice(Math.max(0, m.index - 14), m.index), sym = (m[1] || m[4] || '').toUpperCase(), num = m[2] || m[3];
      var cur = /\$|USD|DOLLAR/.test(sym) ? 'USD' : /€|EUR/.test(sym) ? 'EUR' : /£|GBP/.test(sym) ? 'GBP' : /¥|￥|JPY|円|엔/.test(sym) ? 'JPY' : 'KRW';
      if (!/\d/.test(num) || /^[\d,]{1,2}$/.test(num) && cur !== 'USD' && cur !== 'EUR' && cur !== 'GBP') continue;
      out.push({ i: m.index, end: m.index + m[0].length, num: num, cur: cur, skip: SKIP_BEFORE.test(before) });
    }
    return out;
  }
  function findDate(s, today) {
    var y = +today.slice(0, 4), m, mo, d, hh = null, mi = null;
    var tries = [
      [/(20\d\d)[.\/\-년]\s?(\d{1,2})[.\/\-월]\s?(\d{1,2})/g, function (x) { return [+x[1], +x[2], +x[3]]; }],
      [/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(20\d\d))?/gi, function (x) { return [x[3] ? +x[3] : y, MON[x[1].toLowerCase()], +x[2]]; }],
      [/(\d{1,2})月(\d{1,2})日/g, function (x) { return [y, +x[1], +x[2]]; }],
      [/(?:^|[^\d\/.$€£¥,])(\d{1,2})[\/.월](\d{1,2})일?(?!\d|[\/.]\d)/g, function (x) { return [y, +x[1], +x[2]]; }]
    ];
    for (var k = 0; k < tries.length && !mo; k++) {
      tries[k][0].lastIndex = 0;
      while ((m = tries[k][0].exec(s))) { var v = tries[k][1](m); if (v[1] >= 1 && v[1] <= 12 && v[2] >= 1 && v[2] <= 31) { y = v[0]; mo = v[1]; d = v[2]; break; } }
    }
    var t = s.match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\s?([ap])\.?m\.?)?/i);
    if (t) { hh = +t[1]; mi = +t[2]; if (t[3] && /p/i.test(t[3]) && hh < 12) hh += 12; if (t[3] && /a/i.test(t[3]) && hh === 12) hh = 0; }
    var date = today;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      date = y + '-' + pad(mo) + '-' + pad(d);
      if (date > today && !(s.match(/20\d\d/))) date = (y - 1) + '-' + pad(mo) + '-' + pad(d);   // "12/31" read in January = last year
    }
    return { date: date, time: hh === null ? '' : pad(hh) + ':' + pad(mi), timeTok: t };
  }
  function clean(x) {
    return String(x || '').replace(/[\[\]【】()（）]/g, ' ').replace(/\s+/g, ' ').replace(/^[\s:：\-·,.]+|[\s:：\-·,.]+$/g, '').trim();
  }
  function merchant(s, amt, dt) {
    var m;
    if ((m = s.match(/(?:ご利用先|利用先|ご利用店名|利用店舗|加盟店)\s*[:：]?\s*([^\n]+)/))) return clean(m[1]);
    if ((m = s.match(/(?:가맹점|사용처|결제처|상호)\s*[:：]?\s*([^\n]+)/))) return clean(m[1].split(/누적|잔액/)[0]);
    if ((m = s.match(/\b(?:at|with|to|from)\s+([A-Za-z0-9*][\w&'.*#\-\/ ]{1,40}?)(?=\s+(?:on|was|for|using|has|is|via|credited|charged|approved|posted|ending)\b|[.,;!]|\s*$|\n)/))) return clean(m[1]);
    // Korean card texts: the shop comes after the time ("… 11/25 13:24 스타벅스강남 누적…") or on the next line
    var rest = s;
    if (dt.timeTok) rest = s.slice(s.indexOf(dt.timeTok[0]) + dt.timeTok[0].length);
    else if (amt) rest = s.slice(amt.end);
    var lines = rest.split(/\n/).map(function (l) {
      l = l.split(/누적|잔액|잔고|残高|한도|balance/i)[0].replace(/[\d,]+(?:\.\d{1,2})?\s?(원|円|엔)/g, ' ').replace(/(^|\s)(출금|입금|승인|결제|사용|일시불|체크)(?=\s|$)/g, ' ');
      return clean(l);
    }).filter(function (l) {
      return l && !/^[\d,.\s:\/\-원円$*]+$/.test(l) && !/^(일시불|할부|\d+개월|승인|사용|결제|출금|입금|체크)$/.test(l) && !/^[가-힣]\*[가-힣]?님?$/.test(l);
    });
    var cand = (lines[0] || '').replace(/^(일시불|\d+개월|할부)\s*/, '').replace(/\d{1,2}[\/.]\d{1,2}\s*/, '').replace(/^\d{1,2}:\d{2}\s*/, '');
    cand = clean(cand.replace(KO_CARD_NAMED, ''));   // a card or bank name ("신한카드", "우리은행"), not a shop like "카카오T"
    if (cand.length > 40) cand = cand.slice(0, 40);
    return cand;
  }
  function cardName(s) { var m = s.match(KO_CARD); return m ? m[0].replace(/\s/g, '') : ''; }

  // split a paste into separate messages: "[Web발신]" markers, blank lines, or one message per line when every line pays
  function split(text) {
    var t = String(text || '').replace(/\r/g, '');
    var chunks = t.split(/\[(?:Web발신|국외발신|국제발신)\]|\n\s*\n/).map(function (c) { return c.trim(); }).filter(Boolean);
    var out = [];
    chunks.forEach(function (c) {
      var lines = c.split('\n').filter(function (l) { return l.trim(); });
      var paying = lines.filter(function (l) { return amounts(l).some(function (a) { return !a.skip; }) && (PAYWORD.test(l) || INCOME.test(l)) && l.length > 12; });
      if (lines.length > 1 && paying.length === lines.length) lines.forEach(function (l) { out.push(l.trim()); });
      else out.push(c);
    });
    return out;
  }
  function parseOne(s, opts) {
    var list = amounts(s).filter(function (a) { return !a.skip; });
    if (!list.length) return null;
    var amt = list[0];
    if (!PAYWORD.test(s) && !INCOME.test(s) && !CANCEL.test(s)) return null;   // plain text with a price in it, not a payment message
    var cur = amt.cur;
    if (cur === 'KRW' && opts.currency && opts.currency !== 'KRW' && /원/.test(s) === false) cur = opts.currency;
    var value = minor(amt.num, cur);
    if (!value) return null;
    var dt = findDate(s, opts.today);
    var cancel = CANCEL.test(s), income = cancel || INCOME.test(s) && !/출금|승인(?!\s*취소)/.test(s.replace(/승인\s*취소/g, ''));
    var note = merchant(s, amt, dt) || cardName(s);
    if (cancel && note.indexOf('취소') < 0 && opts.lang === 'ko') note = (note ? note + ' ' : '') + '(취소)';
    return { amt: value, cur: cur, type: income ? 'income' : 'expense', note: note.slice(0, 120), date: dt.date, time: dt.time, cancel: cancel, src: s.slice(0, 300) };
  }
  function parse(text, opts) {
    opts = opts || {};
    opts.today = opts.today || new Date().toISOString().slice(0, 10);
    var seen = {}, out = [];
    split(text).slice(0, 60).forEach(function (s) {
      var r = parseOne(s, opts); if (!r) return;
      var key = [r.date, r.time, r.amt, r.type, r.note].join('|');
      if (seen[key]) return; seen[key] = 1; out.push(r);
    });
    return out;
  }
  // does this text look like at least one payment message? (used before offering "record it")
  function looksLikePayment(text) { return parse(text, { today: '2099-12-31' }).length > 0; }

  root.VaultPaste = { parse: parse, looksLikePayment: looksLikePayment, _split: split };
})(typeof window !== 'undefined' ? window : globalThis);
