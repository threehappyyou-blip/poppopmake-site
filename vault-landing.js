/* Feature cards on the Budget Tracker, Sticky Notes and Diary pages (English, 한국어, 日本語):
 * tap a card and a small phone shows how that feature works.
 * The demo is made of fixed pictures-in-HTML written here; nothing is stored and nothing is sent anywhere. */
(function () {
  'use strict';
  var root = document.querySelector('[data-demo-root]');
  if (!root) return;
  var stage = root.querySelector('.demo-phone'), cap = root.querySelector('.demo-caption'), live = root.querySelector('.demo-live');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lang = (document.documentElement.lang || 'en').slice(0, 2);

  var WORDS = {
    en: {
      tabs: ['Budget', 'Notes', 'Diary', 'Settings'], month: 'October 2026', nextMonth: 'November 2026', spent: 'Spent', add: 'Add an entry',
      cats: ['Food', 'Coffee', 'Groceries', 'Transport', 'Housing', 'Gifts', 'Subs', 'Other'],
      m: { total1: '$62.40', total2: '$66.90', coffee: '−$4.50', groceries: '−$40.00', amt: '4.50', latte: '☕ Latte $4.50', bus: '🚌 Bus $2.75', total3: '$71.40',
        big: '$842.10', left: '$357.90 left of $1,200.00', rent: '−$650.00', rentAmt: '650.00', subs: '−$15.99', total4: '$665.99' },
      market: 'Market', latteNote: 'Latte', rent: 'Rent', music: 'Music', subs: 'Subscriptions', housing: 'Housing',
      c: {
        quick: ['Tap +', 'Type the amount', 'Tap a category — it saves right away', 'Done: three taps'],
        frequent: ['Things you buy often appear as buttons', 'One tap and it is logged for today'],
        budget: ['Set a monthly budget and watch what is left', 'See where the money went', 'Six months at a glance'],
        repeat: ['Turn on “Repeat every month” once', 'Rent and subscriptions add themselves every month'],
        csv: ['Download a CSV statement from your bank, then choose it', 'Check which column is which', 'Entries already in your records are skipped'],
        lock: ['Only your passcode opens it', 'It locks itself when you leave', 'Saved data is encrypted — unreadable even to us'],
        backup: ['Back up to one encrypted file', 'New phone? Restore the file', 'Everything is back'],
        notes: ['Sticky notes in their own tab', 'Write, pick a color, pin the important ones', 'Search finds any note'],
        diary: ['Write your day with a mood and photos', 'A calendar of your moods', 'Look back: what you wrote on this day'],
        install: ['iPhone: Share → “Add to Home Screen”', 'Android or computer: tap Install', 'It opens like an app — even offline'],
        desk: ['On a computer: “Put on desktop”', 'Each note in its own small window, anywhere on the screen', 'One note can stay on top of every window'],
        deco: ['Decorate: paper, colour and handwriting', 'Stickers and washi tape — drag, turn, resize', 'Week page with a habit tracker, hourly page, to-do'],
        goals: ['Set a saving goal with an emoji and a date', 'Put money in — a cheer at every quarter', 'Goal reached: a celebration and a trophy shelf'],
        pk: ['Turn on fingerprint / face unlock once', 'Next time: one touch, no typing'],
        lang: ['한국어', '日本語', 'English — and 24 currencies']
      },
      saved: 'Saved', undo: 'Undo', freqHint: 'Your frequent entries — one tap adds them for today', where: 'Where the money went', six: 'Last 6 months',
      repeatOn: '☑ Repeat every month on this day', importT: 'Import a bank statement', localOnly: 'Read on this device only',
      map: ['Date → <b>Date</b>', 'Money out → <b>Debit</b>', 'Description → <b>Details</b>'], importB: 'Import', imported: 'Added 42. Skipped 3 already in your records.',
      locked: 'Locked', unlock: 'Unlock', autoLocked: 'Locked to keep your data private.', backupT: 'Back up to a file', backupB: 'Download backup file',
      restoreT: 'Restore from a backup file', secret: 'Passcode or recovery code', restoreB: 'Restore', restored: 'Restored. Everything from the backup is back.',
      notesT: 'Notes', notes: ['📌 Wi-Fi: cafe-5G<br>pw on fridge', 'Groceries<br>– milk<br>– eggs', 'Gift ideas<br>for Mom', 'Car service<br>Nov 14'],
      newNote: 'New note', noteText: 'Groceries<br>– milk<br>– eggs', pin: '📌 Pin to top', find: 'milk', found: 'Groceries<br>– <mark>milk</mark><br>– eggs',
      diaryT: 'Diary', newEntry: 'New entry', entry: 'Evening walk by the river. Cool breeze. #walk', streak: '🔥 12-day streak', otd: '📅 On this day', yearAgo: '1 year ago',
      otdText: 'First day in Kyoto #travel', share: '⬆️ Share', menu: ['Copy', '➕ Add to Home Screen', 'Print'], installT: 'Install as an app', installB: 'Install', appName: 'Budget, Notes &amp; Diary',
      deskB: '🖥 Put on desktop', deskTop: '📌 Keep on top', deskNotes: ['Call Jun<br>at 3pm', 'Wi-Fi<br>cafe-5G', 'Ideas<br>– logo'], deskApp: 'Report.docx',
      decoBar: ['📄 Page', '🎨 Paper', '✍️ Lettering', '⭐ Stickers', '🖍️ Draw'], decoText: 'Coffee with Mina.<br>Strawberry cake!', habit: 'Water 2L', weekD: ['Mon 26', 'Tue 27'], weekT: ['Dentist 3pm', 'Gym'],
      goalName: 'Trip to Jeju', goalNums: ['$380 of $1,000 · 38%', '$520 of $1,000 · 52%'], goalMonth: '$124 a month for 5 months', goalIn: '＋ Put in', halfway: '🎉 Halfway there!', reached: 'Goal reached!', shelf: '🏆 Goals reached', laptop: 'New laptop', yay: 'Yay!',
      pkBtn: '👆 Unlock with fingerprint or face', pkOr: 'or type your passcode', pkOn: 'Fingerprint / face unlock is on.', pkSet: 'Unlock with fingerprint or face',
      wd: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    },
    ko: {
      tabs: ['가계부', '메모', '일기', '설정'], month: '2026년 10월', nextMonth: '2026년 11월', spent: '지출', add: '기록하기',
      cats: ['식비', '카페', '장보기', '교통', '주거', '경조사', '구독', '기타'],
      m: { total1: '₩82,400', total2: '₩86,900', coffee: '−₩4,500', groceries: '−₩40,000', amt: '4,500', latte: '☕ 라떼 ₩4,500', bus: '🚌 버스 ₩1,500', total3: '₩91,400',
        big: '₩1,284,100', left: '예산 ₩1,800,000 중 ₩515,900 남음', rent: '−₩650,000', rentAmt: '650,000', subs: '−₩13,900', total4: '₩663,900' },
      market: '마트', latteNote: '라떼', rent: '월세', music: '음악 구독', subs: '구독', housing: '주거',
      c: {
        quick: ['+ 누르기', '금액 입력', '분류를 누르면 바로 저장', '끝: 세 번 터치'],
        frequent: ['자주 사는 것은 버튼으로 나타나요', '한 번 누르면 오늘 날짜로 기록'],
        budget: ['한 달 예산을 정하고 남은 금액 확인', '돈이 어디로 갔는지 한눈에', '6개월 추이'],
        repeat: ['“매달 이 날짜에 반복”을 한 번만 켜기', '월세·구독료가 매달 알아서 기록돼요'],
        csv: ['은행 거래내역 CSV를 내려받아 선택', '각 열이 무엇인지 확인', '이미 있는 기록은 건너뛰어요'],
        lock: ['비밀번호로만 열려요', '앱을 떠나면 자동으로 잠겨요', '저장된 내용은 암호화 — 저희도 못 읽어요'],
        backup: ['암호화된 백업 파일 하나로 보관', '새 휴대폰? 파일로 복원', '모든 내용이 돌아와요'],
        notes: ['메모 탭의 포스트잇', '쓰고, 색 고르고, 중요한 건 고정', '검색으로 어떤 메모든 찾기'],
        diary: ['기분·사진과 함께 하루를 기록', '기분 달력', '지난 해 오늘 쓴 일기 돌아보기'],
        install: ['아이폰: 공유 → “홈 화면에 추가”', '안드로이드·컴퓨터: 설치 누르기', '앱처럼 열리고 인터넷 없이도 돼요'],
        desk: ['컴퓨터에서 “바탕화면에 띄우기”', '메모마다 작은 창으로, 화면 어디에나', '메모 하나는 모든 창 위에 고정'],
        deco: ['꾸미기: 종이, 색, 손글씨', '스티커·마스킹테이프 — 끌고, 돌리고, 크기 조절', '위클리+습관 체크, 시간표, 할 일 속지'],
        goals: ['이모지와 날짜로 모으기 목표 만들기', '돈을 넣을 때마다 — 25%마다 응원', '목표 달성: 축하와 트로피 진열장'],
        pk: ['지문·얼굴로 열기를 한 번 켜두면', '다음부터는 손가락 한 번, 입력 없이'],
        lang: ['한국어', '日本語', 'English — 통화 24종']
      },
      saved: '저장했어요', undo: '되돌리기', freqHint: '자주 쓰는 항목 — 누르면 오늘 날짜로 바로 추가', where: '어디에 썼나', six: '최근 6개월',
      repeatOn: '☑ 매달 이 날짜에 반복', importT: '은행 거래내역 가져오기', localOnly: '이 기기 안에서만 읽어요',
      map: ['거래일시 → <b>날짜</b>', '출금액 → <b>출금(지출)</b>', '적요 → <b>내용</b>'], importB: '가져오기', imported: '42건 추가. 이미 있는 3건은 건너뛰었어요.',
      locked: '잠겨 있어요', unlock: '열기', autoLocked: '데이터 보호를 위해 잠갔어요.', backupT: '백업 파일 만들기', backupB: '백업 파일 내려받기',
      restoreT: '백업 파일로 복원', secret: '비밀번호 또는 복구 코드', restoreB: '복원하기', restored: '복원했어요. 백업의 모든 내용이 돌아왔어요.',
      notesT: '메모', notes: ['📌 와이파이: cafe-5G<br>비번은 냉장고에', '장보기<br>– 우유<br>– 계란', '엄마 생신<br>선물 아이디어', '자동차 점검<br>11월 14일'],
      newNote: '새 메모', noteText: '장보기<br>– 우유<br>– 계란', pin: '📌 맨 위에 고정', find: '우유', found: '장보기<br>– <mark>우유</mark><br>– 계란',
      diaryT: '일기', newEntry: '새 일기', entry: '퇴근길 한강 산책. 바람이 시원했다. #산책', streak: '🔥 12일 연속 작성', otd: '📅 지난 해 오늘', yearAgo: '1년 전',
      otdText: '교토 여행 첫날 #여행', share: '⬆️ 공유', menu: ['복사', '➕ 홈 화면에 추가', '프린트'], installT: '앱으로 설치하기', installB: '설치', appName: '가계부·메모·일기',
      deskB: '🖥 바탕화면에 띄우기', deskTop: '📌 항상 위에 고정', deskNotes: ['준에게 전화<br>3시', '와이파이<br>cafe-5G', '아이디어<br>– 로고'], deskApp: '보고서.docx',
      decoBar: ['📄 속지', '🎨 종이', '✍️ 글씨', '⭐ 스티커', '🖍️ 그리기'], decoText: '미나랑 카페.<br>딸기 케이크 최고!', habit: '물 2L', weekD: ['월 26', '화 27'], weekT: ['치과 3시', '운동'],
      goalName: '제주도 여행', goalNums: ['₩380,000 / ₩1,000,000 · 38%', '₩520,000 / ₩1,000,000 · 52%'], goalMonth: '5개월 동안 매달 ₩124,000', goalIn: '＋ 넣기', halfway: '🎉 절반 왔어요!', reached: '목표 달성!', shelf: '🏆 달성한 목표', laptop: '새 노트북', yay: '야호!',
      pkBtn: '👆 지문·얼굴로 열기', pkOr: '또는 비밀번호 입력', pkOn: '지문·얼굴로 열기를 켰어요.', pkSet: '지문·얼굴로 열기',
      wd: ['일', '월', '화', '수', '목', '금', '토']
    },
    ja: {
      tabs: ['家計簿', 'メモ', '日記', '設定'], month: '2026年10月', nextMonth: '2026年11月', spent: '支出', add: '記録する',
      cats: ['食費', 'カフェ', '日用品', '交通費', '住居費', '交際費', 'サブスク', 'その他'],
      m: { total1: '¥8,240', total2: '¥8,720', coffee: '−¥480', groceries: '−¥4,000', amt: '480', latte: '☕ ラテ ¥480', bus: '🚌 バス ¥220', total3: '¥9,200',
        big: '¥128,410', left: '予算 ¥180,000 のうち残り ¥51,590', rent: '−¥65,000', rentAmt: '65,000', subs: '−¥1,490', total4: '¥66,490' },
      market: 'スーパー', latteNote: 'ラテ', rent: '家賃', music: '音楽', subs: 'サブスク', housing: '住居費',
      c: {
        quick: ['＋ を押す', '金額を入力', '分類を押すとすぐ保存', '完了：3タップ'],
        frequent: ['よく買うものはボタンに', 'ワンタップで今日の日付で記録'],
        budget: ['月の予算を決めて残りを確認', 'お金の行き先がひと目で', '過去6か月の推移'],
        repeat: ['「毎月この日に繰り返す」を一度オン', '家賃やサブスクが毎月自動で記録'],
        csv: ['銀行の明細CSVをダウンロードして選ぶ', 'それぞれの列を確認', 'すでにある記録はスキップ'],
        lock: ['パスコードでしか開けません', 'アプリを離れると自動でロック', '保存内容は暗号化 — 私たちも読めません'],
        backup: ['暗号化したバックアップファイル1つで保管', '機種変更？ファイルで復元', 'すべての内容が戻ります'],
        notes: ['メモタブの付せん', '書いて、色を選んで、大事なものは固定', '検索でどのメモも見つかる'],
        diary: ['気分と写真と一緒に一日を記録', '気分カレンダー', '過去の今日に書いた日記を振り返る'],
        install: ['iPhone：共有 →「ホーム画面に追加」', 'Android・パソコン：インストールを押す', 'アプリのように開き、オフラインでも使えます'],
        desk: ['パソコンで「デスクトップに出す」', 'メモごとに小さなウィンドウで、画面のどこにでも', '1枚はすべてのウィンドウの手前に表示'],
        deco: ['デコる：紙・色・手書き文字', 'シールとマステ — ドラッグ・回転・サイズ変更', 'ウィークリー＋習慣トラッカー、時間割、やること'],
        goals: ['絵文字と期限で貯金目標をつくる', '入れるたびに — 25％ごとに応援', '目標達成：お祝いとトロフィー棚'],
        pk: ['指紋・顔で開くを一度オンにすれば', '次からはワンタッチ、入力なし'],
        lang: ['한국어', '日本語', 'English — 通貨24種類']
      },
      saved: '保存しました', undo: '元に戻す', freqHint: 'よく使う項目 — 押すと今日の日付ですぐ追加', where: '何に使ったか', six: '過去6か月',
      repeatOn: '☑ 毎月この日に繰り返す', importT: '銀行の明細を取り込む', localOnly: 'この端末の中だけで読み込みます',
      map: ['取引日 → <b>日付</b>', 'お引出し → <b>出金（支出）</b>', '摘要 → <b>内容</b>'], importB: '取り込む', imported: '42件追加しました。すでにある3件はスキップしました。',
      locked: 'ロック中', unlock: '開く', autoLocked: 'データを守るためにロックしました。', backupT: 'バックアップファイルを作成', backupB: 'バックアップファイルをダウンロード',
      restoreT: 'バックアップファイルから復元', secret: 'パスコードまたは復元コード', restoreB: '復元する', restored: '復元しました。バックアップの内容がすべて戻りました。',
      notesT: 'メモ', notes: ['📌 Wi-Fi：cafe-5G<br>パスは冷蔵庫に', '買い物<br>– 牛乳<br>– 卵', '母の誕生日<br>プレゼント案', '車の点検<br>11月14日'],
      newNote: '新しいメモ', noteText: '買い物<br>– 牛乳<br>– 卵', pin: '📌 一番上に固定', find: '牛乳', found: '買い物<br>– <mark>牛乳</mark><br>– 卵',
      diaryT: '日記', newEntry: '新しい日記', entry: '帰り道に川沿いを散歩。風が気持ちよかった。#散歩', streak: '🔥 12日連続', otd: '📅 過去の今日', yearAgo: '1年前',
      otdText: '京都旅行の初日 #旅行', share: '⬆️ 共有', menu: ['コピー', '➕ ホーム画面に追加', 'プリント'], installT: 'アプリとしてインストール', installB: 'インストール', appName: '家計簿・メモ・日記',
      deskB: '🖥 デスクトップに出す', deskTop: '📌 常に手前に表示', deskNotes: ['ジュンに電話<br>15時', 'Wi-Fi<br>cafe-5G', 'アイデア<br>– ロゴ'], deskApp: '報告書.docx',
      decoBar: ['📄 リフィル', '🎨 紙', '✍️ 文字', '⭐ シール', '🖍️ 描く'], decoText: 'ミナとカフェ。<br>いちごのケーキ！', habit: '水 2L', weekD: ['月 26', '火 27'], weekT: ['歯医者 15時', 'ジム'],
      goalName: '沖縄旅行', goalNums: ['¥38,000 / ¥100,000 · 38%', '¥52,000 / ¥100,000 · 52%'], goalMonth: '5か月、毎月¥12,400', goalIn: '＋ 入れる', halfway: '🎉 半分まで来ました！', reached: '目標達成！', shelf: '🏆 達成した目標', laptop: '新しいパソコン', yay: 'やった！',
      pkBtn: '👆 指紋・顔で開く', pkOr: 'またはパスコードを入力', pkOn: '指紋・顔で開くをオンにしました。', pkSet: '指紋・顔で開く',
      wd: ['日', '月', '火', '水', '木', '金', '土']
    }
  };
  var W = WORDS[lang] || WORDS.en, M = W.m;

  function bar(title) { return '<div class="dp-top"><span>' + title + '</span><span class="dp-lock">🔒</span></div>'; }
  function tabs(on) {
    return '<div class="dp-tabs">' + [['budget', '💳'], ['notes', '🗒️'], ['diary', '📔'], ['settings', '⚙️']].map(function (x, k) {
      return '<span class="' + (x[0] === on ? 'on' : '') + '">' + x[1] + '<small>' + W.tabs[k] + '</small></span>';
    }).join('') + '</div>';
  }
  function summary(spent, left) {
    return '<div class="dp-card"><small>' + W.spent + '</small><b class="dp-big">' + spent + '</b>' +
      (left ? '<div class="dp-bar"><i style="width:' + left[0] + '%"></i></div><small>' + left[1] + '</small>' : '') + '</div>';
  }
  function row(e, name, note, amt, cls) { return '<div class="dp-row ' + (cls || '') + '"><span class="dp-e">' + e + '</span><span class="dp-n">' + name + (note ? '<small>' + note + '</small>' : '') + '</span><b>' + amt + '</b></div>'; }
  function sheet(inner) { return '<div class="dp-dim"></div><div class="dp-sheet">' + inner + '</div>'; }
  var CE = ['🍚', '☕', '🛒', '🚌', '🏠', '🎁', '🔁', '📦'];
  function cats(hl) {
    return '<div class="dp-cats">' + CE.map(function (e, k) {
      return '<span class="' + (k === hl ? 'hl' : '') + '">' + e + '<small>' + W.cats[k] + '</small></span>';
    }).join('') + '</div>';
  }
  function fab(hl) { return '<span class="dp-fab' + (hl ? ' hl' : '') + '">+</span>'; }
  function toast(s) { return '<div class="dp-toast">' + s + '</div>'; }
  var BUDGET = bar(W.month), C = W.c;
  function cal() {
    var moods = { 3: '🙂', 4: '😄', 7: '😐', 9: '🙂', 12: '😕', 14: '🙂', 15: '😄', 18: '🙂', 21: '😄', 22: '🙂', 25: '😐', 26: '🙂', 27: '🙂' };
    var cells = W.wd.map(function (d) { return '<i class="wd">' + d + '</i>'; });
    for (var b = 0; b < 4; b++) cells.push('<i></i>');
    for (var d = 1; d <= 31; d++) cells.push('<i class="' + (moods[d] ? 'has' : '') + (d === 27 ? ' today' : '') + '">' + d + '<br>' + (moods[d] || '') + '</i>');
    return '<div class="dp-cal">' + cells.join('') + '</div>';
  }

  var DEMOS = {
    quick: [
      [C.quick[0], BUDGET + summary(M.total1) + row('🛒', W.cats[2], W.market, M.groceries) + fab(true) + tabs('budget')],
      [C.quick[1], BUDGET + summary(M.total1) + sheet('<b>' + W.add + '</b><div class="dp-amt">' + M.amt + '<i class="dp-caret"></i></div>' + cats(-1))],
      [C.quick[2], BUDGET + summary(M.total1) + sheet('<b>' + W.add + '</b><div class="dp-amt">' + M.amt + '</div>' + cats(1))],
      [C.quick[3], BUDGET + summary(M.total2) + row('☕', W.cats[1], '', M.coffee, 'new') + row('🛒', W.cats[2], W.market, M.groceries) + toast(W.saved + ': ☕ ' + W.cats[1] + ' <u>' + W.undo + '</u>') + tabs('budget')]
    ],
    frequent: [
      [C.frequent[0], BUDGET + sheet('<b>' + W.add + '</b><small class="dp-hint">' + W.freqHint + '</small><div class="dp-chips"><span class="hl">' + M.latte + '</span><span>' + M.bus + '</span></div>' + cats(-1))],
      [C.frequent[1], BUDGET + summary(M.total3) + row('☕', W.cats[1], W.latteNote, M.coffee, 'new') + toast(W.saved + ': ' + M.latte + ' <u>' + W.undo + '</u>') + tabs('budget')]
    ],
    budget: [
      [C.budget[0], BUDGET + summary(M.big, [70, M.left]) + row('🏠', W.housing, W.rent, M.rent) + tabs('budget')],
      [C.budget[1], BUDGET + '<div class="dp-card"><b>' + W.where + '</b>' +
        [['🏠 ' + W.housing, 77], ['🛒 ' + W.cats[2], 12], ['☕ ' + W.cats[1], 6], ['🚌 ' + W.cats[3], 5]].map(function (x) { return '<div class="dp-hb"><small>' + x[0] + ' · ' + x[1] + '%</small><div class="dp-bar"><i style="width:' + x[1] + '%"></i></div></div>'; }).join('') + '</div>' + tabs('budget')],
      [C.budget[2], BUDGET + '<div class="dp-card"><b>' + W.six + '</b><div class="dp-trend">' + [40, 55, 48, 70, 62, 58].map(function (v) { return '<i style="height:' + v + '%"></i>'; }).join('') + '</div></div>' + tabs('budget')]
    ],
    repeat: [
      [C.repeat[0], BUDGET + sheet('<b>' + W.add + '</b><div class="dp-amt">' + M.rentAmt + '</div><div class="dp-check on">' + W.repeatOn + '</div>' + cats(4))],
      [C.repeat[1], bar(W.nextMonth) + summary(M.total4) + row('🏠', W.housing + ' 🔁', W.rent, M.rent) + row('🔁', W.subs + ' 🔁', W.music, M.subs) + tabs('budget')]
    ],
    csv: [
      [C.csv[0], bar(W.tabs[3]) + sheet('<b>' + W.importT + '</b><div class="dp-file">📄 statement.csv</div><small class="dp-hint">' + W.localOnly + '</small>')],
      [C.csv[1], bar(W.tabs[3]) + sheet('<b>' + W.importT + '</b><div class="dp-map">' + W.map.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div><div class="dp-btn">' + W.importB + '</div>')],
      [C.csv[2], bar(W.tabs[3]) + toast(W.imported) + tabs('settings')]
    ],
    lock: [
      [C.lock[0], '<div class="dp-lockscreen"><div class="dp-lockic">🔒</div><b>' + W.locked + '</b><div class="dp-input">••••••••••</div><div class="dp-btn">' + W.unlock + '</div></div>'],
      [C.lock[1], '<div class="dp-lockscreen"><div class="dp-lockic">🔒</div><b>' + W.locked + '</b><small>' + W.autoLocked + '</small></div>'],
      [C.lock[2], '<div class="dp-cipher">x8Kd2…Qe9z<br>Lm0P…7Yh1<br>AES-256-GCM</div>']
    ],
    backup: [
      [C.backup[0], bar(W.tabs[3]) + sheet('<b>' + W.backupT + '</b><div class="dp-file">💾 poppopmake-vault-backup.json</div><div class="dp-btn">' + W.backupB + '</div>')],
      [C.backup[1], '<div class="dp-lockscreen"><b>' + W.restoreT + '</b><div class="dp-file">💾 backup.json</div><div class="dp-input">' + W.secret + '</div><div class="dp-btn">' + W.restoreB + '</div></div>'],
      [C.backup[2], BUDGET + summary(M.big) + toast(W.restored) + tabs('budget')]
    ],
    notes: [
      [C.notes[0], bar(W.notesT) + '<div class="dp-notes"><span class="y">' + W.notes[0] + '</span><span class="p">' + W.notes[1] + '</span><span class="g">' + W.notes[2] + '</span><span class="b">' + W.notes[3] + '</span></div>' + fab(false) + tabs('notes')],
      [C.notes[1], bar(W.notesT) + sheet('<b>' + W.newNote + '</b><div class="dp-noteedit">' + W.noteText + '<i class="dp-caret"></i></div><div class="dp-sw"><i class="y"></i><i class="p on"></i><i class="g"></i><i class="b"></i></div><div class="dp-btn ghost">' + W.pin + '</div>')],
      [C.notes[2], bar(W.notesT) + '<div class="dp-search">' + W.find + '</div><div class="dp-notes"><span class="p">' + W.found + '</span></div>' + tabs('notes')]
    ],
    diary: [
      [C.diary[0], bar(W.month) + sheet('<b>' + W.newEntry + '</b><div class="dp-moods"><i>😞</i><i>😕</i><i>😐</i><i class="on">🙂</i><i>😄</i></div><div class="dp-noteedit dp-diary">' + W.entry + '<i class="dp-caret"></i></div><div class="dp-photos"><i></i><i class="add">📷</i></div>')],
      [C.diary[1], bar(W.month) + '<div class="dp-card"><b>' + W.streak + '</b></div>' + cal() + tabs('diary')],
      [C.diary[2], bar(W.month) + '<div class="dp-card"><b>' + W.otd + '</b></div>' + row('😄', W.yearAgo, W.otdText, '') + row('🙂', '', W.entry, '') + fab(false) + tabs('diary')]
    ],
    desk: [
      [C.desk[0], bar(W.notesT) + sheet('<div class="dp-noteedit">' + W.deskNotes[0] + '</div><div class="dp-btn hl">' + W.deskB + '</div><div class="dp-btn ghost">' + W.deskTop + '</div>')],
      [C.desk[1], '<div class="dp-desk"><div class="dp-appwin">' + W.deskApp + '</div><div class="dp-win y" style="left:8%;top:10%">' + W.deskNotes[0] + '</div><div class="dp-win p" style="left:52%;top:16%">' + W.deskNotes[1] + '</div><div class="dp-win g" style="left:30%;top:56%">' + W.deskNotes[2] + '</div><div class="dp-taskbar"></div></div>'],
      [C.desk[2], '<div class="dp-desk"><div class="dp-appwin front">' + W.deskApp + '</div><div class="dp-win y top" style="left:46%;top:8%">📌 ' + W.deskNotes[0] + '</div><div class="dp-taskbar"></div></div>']
    ],
    deco: [
      [C.deco[0], bar(W.month) + sheet('<div class="dp-decobar">' + W.decoBar.map(function (x, k) { return '<span class="' + (k === 1 ? 'hl' : '') + '">' + x + '</span>'; }).join('') + '</div><div class="dp-page lines pink hand">' + W.decoText + '</div>')],
      [C.deco[1], bar(W.month) + sheet('<div class="dp-decobar">' + W.decoBar.map(function (x, k) { return '<span class="' + (k === 3 ? 'hl' : '') + '">' + x + '</span>'; }).join('') + '</div><div class="dp-page lines pink hand">' + W.decoText + '<i class="dp-st" style="right:10%;top:12%">🍓</i><i class="dp-st" style="right:30%;top:48%;transform:rotate(-12deg)">☕</i><i class="dp-st sm" style="left:12%;top:60%">✨</i><i class="dp-tape" style="left:22%;top:-4%"></i></div>')],
      [C.deco[2], bar(W.month) + sheet('<div class="dp-page dots cream"><div class="dp-week"><span><small>' + W.weekD[0] + '</small>' + W.weekT[0] + '</span><span><small>' + W.weekD[1] + '</small>' + W.weekT[1] + '</span></div><div class="dp-habit"><b>' + W.habit + '</b>' + ['on', 'on', 'on', '', 'on', '', ''].map(function (c) { return '<i class="' + c + '"></i>'; }).join('') + '</div></div>')]
    ],
    goals: [
      [C.goals[0], BUDGET + '<div class="dp-card dp-goal"><span class="dp-ge">✈️</span><div><b>' + W.goalName + '</b><div class="dp-bar g"><i style="width:38%"></i></div><small>' + W.goalNums[0] + '</small><small>' + W.goalMonth + '</small></div></div>' + tabs('budget')],
      [C.goals[1], BUDGET + sheet('<b>✈️ ' + W.goalName + '</b><div class="dp-amt">140</div><div class="dp-btn">' + W.goalIn + '</div><div class="dp-bar g"><i style="width:52%"></i></div><small>' + W.goalNums[1] + '</small>') + toast(W.halfway)],
      [C.goals[2], BUDGET + '<div class="dp-celebrate"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><i class="c5"></i><div class="dp-cc"><span>✈️</span><b>' + W.reached + '</b><small>' + W.goalName + '</small><div class="dp-btn">' + W.yay + '</div></div></div><div class="dp-card"><b>' + W.shelf + '</b><div class="dp-shelf"><span>✈️<small>' + W.goalName + '</small></span><span>💻<small>' + W.laptop + '</small></span></div></div>']
    ],
    pk: [
      [C.pk[0], bar(W.tabs[3]) + sheet('<b>' + W.pkSet + '</b><div class="dp-input">••••••••••</div><div class="dp-btn">' + '✓ ' + W.pkSet + '</div>') + toast(W.pkOn)],
      [C.pk[1], '<div class="dp-lockscreen"><div class="dp-lockic">🔒</div><b>' + W.locked + '</b><div class="dp-btn">' + W.pkBtn + '</div><small>' + W.pkOr + '</small><div class="dp-finger">👆</div></div>']
    ],
    install: [
      [C.install[0], '<div class="dp-lockscreen"><div class="dp-share">' + W.share + '</div><div class="dp-menu"><span>' + W.menu[0] + '</span><span class="hl">' + W.menu[1] + '</span><span>' + W.menu[2] + '</span></div></div>'],
      [C.install[1], '<div class="dp-lockscreen"><b>' + W.installT + '</b><div class="dp-btn">' + W.installB + '</div></div>'],
      [C.install[2], '<div class="dp-home"><span>📷</span><span>✉️</span><span class="hl"><img src="/icons/tool-vault-192.png" alt="" width="36" height="36"></span><span>🗺️</span></div><small class="dp-hint center">' + W.appName + '</small>']
    ],
    lang: [
      [C.lang[0], bar('2026년 10월') + '<div class="dp-card"><small>지출</small><b class="dp-big">₩842,100</b></div>' + row('☕', '카페·간식', '', '−₩4,500') + tabs('budget')],
      [C.lang[1], bar('2026年10月') + '<div class="dp-card"><small>支出</small><b class="dp-big">¥84,210</b></div>' + row('☕', 'カフェ・おやつ', '', '−¥480') + tabs('budget')],
      [C.lang[2], bar('October 2026') + '<div class="dp-card"><small>Spent</small><b class="dp-big">$842.10</b></div>' + row('☕', 'Coffee', '', '−$4.50') + tabs('budget')]
    ]
  };

  var timer = null, frames = null, i = 0;
  function show() {
    stage.innerHTML = '<div class="dp-screen">' + frames[i][1] + '</div>';
    cap.textContent = (i + 1) + ' / ' + frames.length + ' — ' + frames[i][0];
  }
  function play(key, btn) {
    clearInterval(timer);
    frames = DEMOS[key]; i = 0;
    root.querySelectorAll('[data-demo]').forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
    if (live) live.textContent = btn.querySelector('.fc-title').textContent + ': ' + frames.map(function (f) { return f[0]; }).join(' → ');
    show();
    if (!reduce) timer = setInterval(function () { i = (i + 1) % frames.length; show(); }, 2200);
  }
  root.querySelectorAll('[data-demo]').forEach(function (b) {
    b.addEventListener('click', function () {
      play(b.getAttribute('data-demo'), b);
      if (window.innerWidth < 820 && stage.scrollIntoView) stage.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    });
  });
  root.querySelector('.demo-next') && root.querySelector('.demo-next').addEventListener('click', function () {
    if (!frames) return; clearInterval(timer); i = (i + 1) % frames.length; show();
  });
  var first = root.querySelector('[data-demo]');
  if (first) play(first.getAttribute('data-demo'), first);
  window.__demoKeys = Object.keys(DEMOS);
})();
