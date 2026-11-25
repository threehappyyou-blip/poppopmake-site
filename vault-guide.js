/* PopPopMake Vault — the built-in guide: what each app is good at, routines that work, and every feature with a
 * "Try it" button. Pure data + checks on the person's own (already unlocked) data; nothing is sent anywhere.
 * Feature row: [id, app, emoji, group]. used(id, ctx) says whether the person has already used it (null = can't tell).
 */
(function (root) {
  'use strict';
  var F = [
    ['b-add', 'budget', '➕', 'rec'], ['b-quick', 'budget', '⚡', 'rec'], ['b-tiles', 'budget', '☕', 'rec'], ['b-receipt', 'budget', '🧾', 'rec'],
    ['b-recurring', 'budget', '🔁', 'rec'], ['b-import', 'budget', '📥', 'rec'], ['b-paste', 'budget', '📋', 'rec'], ['b-today', 'budget', '🌤', 'rec'], ['b-report', 'budget', '🗓', 'plan'], ['b-methods', 'budget', '💳', 'rec'],
    ['b-plan', 'budget', '🐷', 'plan'], ['b-budget', 'budget', '🎯', 'plan'], ['b-catbudget', 'budget', '🏷️', 'plan'], ['b-goal', 'budget', '💰', 'plan'],
    ['b-nobuy', 'budget', '🚫', 'plan'], ['b-challenge', 'budget', '✉️', 'plan'],
    ['b-checkin', 'budget', '✅', 'care'], ['b-worth', 'budget', '💸', 'care'], ['b-notify', 'budget', '🔔', 'care'], ['b-seals', 'budget', '🏅', 'care'],
    ['b-calendar', 'budget', '📅', 'see'], ['b-charts', 'budget', '📊', 'see'], ['b-year', 'budget', '🗓️', 'see'], ['b-search', 'budget', '🔍', 'see'],
    ['n-quick', 'notes', '✍️', 'write'], ['n-check', 'notes', '☑️', 'write'], ['n-tpl', 'notes', '🛒', 'write'], ['n-tobudget', 'notes', '🧮', 'write'],
    ['n-remind', 'notes', '⏰', 'write'], ['n-pin', 'notes', '📌', 'write'], ['n-photo', 'notes', '📷', 'write'],
    ['n-deco', 'notes', '🎀', 'deco'], ['n-lock', 'notes', '🔐', 'deco'], ['n-desk', 'notes', '🖥️', 'deco'],
    ['d-write', 'diary', '📝', 'write'], ['d-mood', 'diary', '😊', 'write'], ['d-feel', 'diary', '🌡️', 'write'], ['d-tpl', 'diary', '📄', 'write'],
    ['d-letter', 'diary', '💌', 'write'], ['d-search', 'diary', '#️⃣', 'write'],
    ['d-deco', 'diary', '🌷', 'deco'], ['d-auto', 'diary', '✨', 'deco'], ['d-photo', 'diary', '🖼️', 'deco'], ['d-draw', 'diary', '🖍️', 'deco'], ['d-cover', 'diary', '📔', 'deco'], ['d-books', 'diary', '📚', 'deco'],
    ['d-weekly', 'diary', '🌿', 'look'], ['d-five', 'diary', '🖐️', 'look'], ['d-wrapped', 'diary', '🎁', 'look'], ['d-wall', 'diary', '📱', 'look'],
    ['d-share', 'diary', '📸', 'look'], ['d-pdf', 'diary', '📖', 'look'], ['d-pet', 'diary', '🌱', 'look'],
    ['c-backup', 'common', '💾', 'safe'], ['c-lock', 'common', '👆', 'safe'], ['c-transfer', 'common', '📲', 'safe'],
    ['c-helper', 'common', '💁', 'comfort'], ['c-theme', 'common', '🎨', 'comfort'], ['c-install', 'common', '🏠', 'comfort'], ['c-reminder', 'common', '⏱️', 'comfort'], ['c-lang', 'common', '🌏', 'comfort']
  ];
  function any(a, f) { return (a || []).some(f); }
  function tplOf(x) { return x && x.deco && x.deco.tpl && x.deco.tpl.on; }
  // what the data already shows; null when there is no trace to look at
  function used(id, c) {
    var b = c.budget || {}, n = ((c.notes && c.notes.notes) || []), e = ((c.diary && c.diary.entries) || []), s = c.settings || {};
    var tx = b.tx || [];
    switch (id) {
      case 'b-add': return tx.length > 0;
      case 'b-report': return !!(s.starterHide && Object.keys(s.starterHide).some(function (k) { return /^mr/.test(k); }));
      case 'b-receipt': return any(tx, function (x) { return !!x.photo; });
      case 'b-recurring': return (b.recurring || []).length > 0;
      case 'b-methods': return (b.methods || []).length > 0;
      case 'b-plan': return !!b.plan;
      case 'b-budget': return !!(b.budgets && b.budgets.total);
      case 'b-catbudget': return !!(b.budgets && b.budgets.cats && Object.keys(b.budgets.cats).length);
      case 'b-goal': return (b.goals || []).length > 0;
      case 'b-nobuy': return !!(s.nobuy && (s.nobuy.start || (s.nobuy.past || []).length));
      case 'b-challenge': return any(n, function (x) { return /^(saving24|saving52|envelope100)$/.test(tplOf(x) || ''); });
      case 'b-checkin': return !!(s.helper && s.helper.checkin && (s.helper.checkin.days || []).length);
      case 'b-worth': return any(tx, function (x) { return !!x.rate; });
      case 'n-quick': return n.length > 0;
      case 'n-check': return any(n, function (x) { return x.list || /^\s*-\s*\[[ x]\]/m.test(x.text || ''); });
      case 'n-tpl': return any(n, function (x) { return !!tplOf(x); });
      case 'n-remind': return any(n, function (x) { return !!x.remind; });
      case 'n-pin': return any(n, function (x) { return x.pinned; });
      case 'n-photo': return any(n, function (x) { return (x.photos || []).length > 0; });
      case 'n-deco': return any(n, function (x) { return !!(x.deco && x.deco.stickers && x.deco.stickers.length); });
      case 'n-lock': return any(n, function (x) { return x.locked; });
      case 'd-write': return e.length > 0;
      case 'd-mood': return any(e, function (x) { return !!x.mood; });
      case 'd-feel': return any(e, function (x) { return tplOf(x) === 'feeling'; });
      case 'd-tpl': return any(e, function (x) { return !!tplOf(x); });
      case 'd-letter': return any(e, function (x) { return tplOf(x) === 'letter'; });
      case 'd-search': return any(e, function (x) { return (x.tags || []).length > 0; });
      case 'd-deco': return any(e, function (x) { return !!(x.deco && x.deco.stickers && x.deco.stickers.length); });
      case 'd-auto': return any(e, function (x) { return !!(x.deco && x.deco.stickers && x.deco.stickers.some(function (k) { return /^a:lb/.test(k.k); })); });
      case 'd-photo': return any(e, function (x) { return (x.photos || []).length > 0; });
      case 'd-draw': return any(e, function (x) { return !!(x.deco && x.deco.drawing); });
      case 'd-cover': return !!(s.covers && s.covers.diary);          // only saved once someone changes it
      case 'd-books': return ((c.diary && c.diary.books) || []).length > 0;
      case 'd-pet': return !!(s.pet && s.pet.sun > 0);
      case 'c-backup': return !!s.lastBackup;
      case 'c-theme': return (s.sheet && s.sheet !== 'none') || (s.wall && s.wall !== 'none');
      default: return null;
    }
  }

  var KO = {
    ui: {
      title: '사용 설명서', search: '무엇을 하고 싶으세요? (예: 영수증, 월세, 일기 잠금)', pros: '이 앱의 좋은 점', routines: '이렇게 쓰면 좋아요', all: '모든 기능',
      progress: '기능 {all}개 중 {n}개 써봤어요', unusedOnly: '아직 안 써본 것만', showAll: '전부 보기', try: '해보기', used: '✓ 써봤어요', notYet: '아직',
      none: '찾는 기능이 없어요. 다른 말로 적어 보세요.', who: '이런 분께', tour: '처음 안내 다시 보기', web: '웹 설명서 (그림·자세히)',
      tipT: '이런 것도 돼요: {f}', tipDo: '해보기', tipMore: '설명서', link: '📖 할 수 있는 것 {all}가지 · 사용 설명서', setRow: '📖 사용 설명서 · 장점과 쓰는 법',
      tabs: { budget: '가계부', notes: '메모', diary: '다이어리', common: '공통' },
      groups: { rec: '기록하기', plan: '계획·모으기', care: '앱이 먼저 챙겨요', see: '돌아보기', write: '쓰기', deco: '꾸미기·지키기', look: '모아 보기·나누기', safe: '안전하게', comfort: '편하게' }
    },
    pros: {
      budget: [['🔒', '계정도, 은행 연결도 없어요', '기록은 이 기기 안에서 암호화돼요. 비밀번호 없이는 아무도 못 봐요.'],
        ['⚡', '3초 기록, 나머지는 자동', '"점심 9000" 한 줄이면 끝. 월세·구독·월급은 그날 알아서 적혀요.'],
        ['🙋', '앱이 먼저 물어봐요', '저녁 체크인, 결제일 전 알림, 저축날, 지난주 요약까지 — 잊어도 괜찮아요.'],
        ['🐷', '쓰는 가계부가 아니라 모으는 가계부', '선저축 예산표, 저축 목표, 무지출·100봉투 챌린지로 돈이 남게 도와요.']],
      notes: [['✍️', '한 줄 쓰면 바로 메모', '위 칸에 쓰고 Enter. 맨 앞에 [] 를 붙이면 체크리스트가 돼요.'],
        ['🧮', '메모에서 가계부로', '"커피 4500"처럼 금액이 적힌 줄을 골라 가계부에 한 번에 넣어요.'],
        ['🛒', '장보기·레시피·가격 수첩 속지', '다이어리 속지와 스티커로 메모도 예쁘게 꾸며요.'],
        ['🔐', '메모 하나만 따로 잠그기', '남에게 보이면 안 되는 메모는 열 때마다 비밀번호를 물어요.']],
      diary: [['🌙', '처음부터 예쁘게', '그림 표지 40가지(파스텔·고급·미니멀·자연·패턴·도시), 속지 27가지, 스티커·마스킹테이프로 바로 다꾸.'],
        ['🔐', '진짜 비밀 일기', '이 기기 안에서만 암호화돼요. 서버도 AI도 일기를 읽지 않아요.'],
        ['💌', '쌓일수록 재밌어요', '미래의 나에게 편지, 5년 일기, 주간 돌아보기, 연말 결산이 기다려요.'],
        ['📸', '보여주고 싶을 땐', '페이지를 9:16 이미지·영상으로 저장해 스토리·쇼츠에 올려요.']],
      common: [['🆓', '설치 없이 바로', '웹에서 열고 홈 화면에 추가하면 앱처럼 써요. 인터넷이 없어도 열려요.'],
        ['💾', '백업 파일 한 개', '가계부·메모·다이어리가 암호화된 파일 하나에 담겨요. 새 폰엔 QR로 옮겨요.'],
        ['💁', '모르면 물어보세요', '도우미에게 "영수증 어떻게 해?"처럼 적으면 그 버튼으로 데려다줘요.']]
    },
    routines: {
      budget: [{ t: '하루 1분 루틴', who: '바쁜 직장인·부업러', s: [['쓸 때마다 위 칸에 "점심 9000"처럼 한 줄', 'b-quick'], ['자주 사는 건 그림 버튼 한 번', 'b-tiles'], ['저녁에 체크인 카드가 뜨면 확인만', 'b-checkin']] },
        { t: '월급날 10분 루틴', who: '돈이 안 모이는 분', s: [['선저축 예산표로 저축부터 떼기', 'b-plan'], ['월세·통신비는 반복 지출로', 'b-recurring'], ['이번 주 남은 돈 하나만 보기', 'b-plan']] },
        { t: '한 달에 한 번 점검', who: '어디서 새는지 궁금한 분', s: [['차트에서 많이 쓴 분류 확인', 'b-charts'], ['그 분류에 예산 정하기', 'b-catbudget'], ['다음 주는 무지출 챌린지 7일', 'b-nobuy']] }],
      notes: [{ t: '장보기 한 번에', who: '장 볼 때 자꾸 빠뜨리는 분', s: [['장보기 속지로 목록 만들기', 'n-tpl'], ['마트에서 하나씩 체크', 'n-check'], ['금액 적힌 줄은 가계부로 보내기', 'n-tobudget']] },
        { t: '할 일 잊지 않기', who: '깜빡하는 일이 많은 분', s: [['[] 로 시작하면 체크리스트', 'n-check'], ['날짜·시간 알림 걸기', 'n-remind'], ['중요한 건 맨 위에 고정', 'n-pin']] }],
      diary: [{ t: '30초 일기', who: '일기를 꾸준히 못 쓰던 분', s: [['기분 얼굴 하나 고르기', 'd-mood'], ['한 줄만 쓰기 — 그걸로 충분해요', 'd-write'], ['식물 친구가 쑥 자라요', 'd-pet']] },
        { t: '주말 다꾸 30분', who: '꾸미는 걸 좋아하는 분', s: [['속지 고르기 (감정 온도·4컷·필사…)', 'd-tpl'], ['스티커·마스킹테이프 붙이기', 'd-deco'], ['이미지로 저장해 공유', 'd-share']] },
        { t: '1년 뒤의 나에게', who: '기록을 오래 남기고 싶은 분', s: [['미래의 나에게 편지 봉인', 'd-letter'], ['같은 날 5년을 한 화면에', 'd-five'], ['12월엔 연말 결산 카드', 'd-wrapped']] }],
      common: [{ t: '처음 깔았다면 꼭', who: '모든 분', s: [['백업 파일 한 번 저장', 'c-backup'], ['지문·얼굴로 열기', 'c-lock'], ['홈 화면에 앱 추가', 'c-install']] }]
    },
    f: {
      'b-add': ['3번 눌러 기록', '+ → 금액 → 분류를 누르면 바로 저장돼요. 수입은 "수입"을 먼저.', '지출 쓴돈 기록 수입'],
      'b-quick': ['한 줄로 기록', '"점심 9000", "택시 1만2천"처럼 쓰고 Enter. 분류는 앱이 맞혀요.', '한줄 빠르게'],
      'b-tiles': ['그림 버튼', '커피·편의점·배달… 누르고 금액만 넣어요. 자주 쓰는 건 맨 위에 와요.', '버튼 커피'],
      'b-receipt': ['영수증 사진', '기록할 때 "영수증 사진"을 눌러 찍어 두면 암호화돼 함께 저장돼요.', '영수증 사진'],
      'b-recurring': ['반복 지출·수입', '월세, 구독, 월급처럼 매달·매주 같은 날 나가는 돈은 한 번만 등록.', '월세 구독 고정지출 자동'],
      'b-paste': ['결제 문자로 기록', '카드·은행 문자를 붙여 넣으면 금액·가게·날짜를 읽어 한 번에 넣어요.', '문자 붙여넣기 카드 승인 알림'],
      'b-today': ['오늘의 한 장', '오늘 쓸 수 있는 돈, 내일 나갈 돈, 어제 쓴 돈을 아침에 한눈에.', '오늘 요약 하루'],
      'b-report': ['월간 리포트 카드', '지난달 지출·많이 쓴 곳·일기·기분을 9:16 카드로 보고 저장해요.', '리포트 한달 결산 월말'],
      'b-import': ['카드·은행 내역 불러오기', '은행·카드 앱에서 받은 CSV 파일을 한 번에 넣어요.', '엑셀 csv 카드내역'],
      'b-methods': ['결제수단', '현금·카드·계좌이체를 나눠 적고, 수단별 합계를 봐요.', '카드 현금'],
      'b-plan': ['선저축 후지출 예산표', '월급날 저축부터 떼고, 남은 돈을 주 단위 한도로. 저축날·새 주엔 앱이 먼저 알려요.', '저축 월급 예산표 주 한도'],
      'b-budget': ['월 예산', '한 달 예산을 정하면 오늘 쓸 수 있는 돈을 매일 알려줘요.', '예산 한도'],
      'b-catbudget': ['분류별 예산', '식비·카페처럼 새기 쉬운 분류에만 한도를 걸어요.', '식비 예산'],
      'b-goal': ['저축 목표', '여행·비상금처럼 목표를 만들고 넣을 때마다 기록. 날짜를 정하면 한 달에 얼마인지 알려줘요.', '목표 모으기 적금'],
      'b-nobuy': ['무지출 챌린지', '7·14·30일. 매일 체크할 필요 없이 가계부 기록으로 알아서 셉니다.', '무지출 절약'],
      'b-challenge': ['24·52주·100봉투 챌린지', '속지 챌린지로 조금씩 모아요. 진행률은 "모으기"에서 보여요.', '52주 100봉투'],
      'b-checkin': ['저녁 체크인', '저녁에 오늘 쓴 돈을 한 번에 확인하고 빠진 걸 채워요.', '하루 정리'],
      'b-worth': ['잘 썼어요 / 아까워요', '지출에 표시해 두면 아까운 돈이 한 달·1년에 얼마인지 알려줘요.', '아까운 돈'],
      'b-notify': ['결제일 알림', '반복 지출이 나가기 전에 휴대폰 알림을 받아요 (지원 기기만).', '알림 결제일'],
      'b-seals': ['씰 모으기', '첫 기록, 연속 체크인, 예산 지킨 달… 해낼 때마다 씰이 생겨요.', '배지 보상'],
      'b-calendar': ['달력 보기', '날마다 얼마 나갔는지 한눈에. 날짜를 누르면 그날 내역이에요.', '달력 날짜별'],
      'b-charts': ['차트·분류 상세', '지난달과 비교, 분류별 막대. 분류를 누르면 9개월 흐름과 내역.', '그래프 통계'],
      'b-year': ['연간 보기', '1년 수입·지출·월별 흐름을 한 화면에.', '1년 올해'],
      'b-search': ['검색', '"언제 샀더라?" 메모·금액으로 찾아요.', '찾기'],
      'n-quick': ['한 줄 메모', '위 칸에 쓰고 Enter — 메모가 생기고 다음 줄 준비 끝.', '메모 포스트잇'],
      'n-check': ['체크리스트', '[] 로 시작하거나 메모에서 "체크리스트". 끝난 건 톡 체크.', '할일 체크'],
      'n-tpl': ['장보기·레시피·가격 수첩 속지', '메모의 "속지"에서 장보기, 레시피, 가격 수첩, 저금 챌린지를 골라요.', '장보기 레시피'],
      'n-tobudget': ['금액 줄 → 가계부', '메모 속 "커피 4500" 같은 줄을 골라 가계부에 한 번에 넣어요.', '가계부로'],
      'n-remind': ['메모 알림', '날짜·시간을 정하면 캘린더에 넣을 수 있어요.', '알림 알람'],
      'n-pin': ['맨 위 고정', '중요한 메모는 항상 첫 번째에.', '고정 핀'],
      'n-photo': ['사진 메모', '화이트보드, 주차 위치처럼 사진을 6장까지.', '사진'],
      'n-deco': ['메모 꾸미기', '다이어리와 같은 종이·스티커·테이프로 꾸며요.', '스티커 꾸미기'],
      'n-lock': ['메모 잠그기', '이 메모만 열 때마다 비밀번호를 물어요. 검색에도 안 나와요.', '잠금 비밀'],
      'n-desk': ['컴퓨터 바탕화면 메모', '컴퓨터에서 메모를 작은 창으로 띄워 항상 위에 둬요.', '바탕화면 위젯'],
      'd-write': ['일기 쓰기', '+ 를 누르고 쓰면 자동 저장. 한 줄이어도 충분해요.', '일기 쓰기'],
      'd-mood': ['오늘의 기분', '얼굴 5개 중 하나. 달력과 포스터에 색으로 쌓여요.', '기분 감정'],
      'd-feel': ['감정 사전·온도계', '설레요·뿌듯해요·서운해요… 감정 이름을 골라 마음을 정확히.', '감정 사전 온도'],
      'd-tpl': ['속지 27가지', '하루 회고, 감사 세 줄, 독서·운동·식단, 4컷 그림일기, 필사 등.', '속지 템플릿'],
      'd-letter': ['미래의 나에게 편지', '열 날짜를 정해 봉인하면 그날 맨 위에 도착해요.', '편지 봉인'],
      'd-search': ['#태그·검색', '#여행처럼 쓰면 태그로 모아 보고 검색해요.', '태그 검색'],
      'd-auto': ['한 번에 꾸미기', '스티커 창 맨 위 ✨ 버튼 한 번이면 테이프·라벨·스티커가 어울리게 붙어요. 또 누르면 다른 조합. 라벨·낙서·메모지·돈 스티커도 있어요.', '자동 꾸미기 라벨 낙서'],
      'd-deco': ['스티커·마스킹테이프·종이', '시즌·감성·음식 스티커와 테이프를 끌어다 붙여요.', '다꾸 스티커'],
      'd-photo': ['사진·사진 스티커', '사진 4장, 또는 내 사진을 동그라미·하트 스티커로.', '사진'],
      'd-draw': ['그리기', '손가락으로 그리고 지우개·되돌리기.', '그림'],
      'd-cover': ['표지 꾸미기', '그림 40가지(스타일별로 골라요), 제목, 색 필터, 스티커로 나만의 표지.', '표지 커버'],
      'd-books': ['노트북 여러 권', '독서·운동·감사·여행 노트를 따로, 표지도 따로.', '노트 분리'],
      'd-weekly': ['주간 돌아보기', '일·월요일에 지난주 기분·기록·지출을 정리해 보여줘요.', '일주일 회고'],
      'd-five': ['5년 일기', '같은 날짜의 5년을 한 화면에.', '5년'],
      'd-wrapped': ['연말 결산', '12·1월에 한 해를 넘겨 보는 카드로 정리해요.', '연말 결산'],
      'd-wall': ['달력 배경화면', '이번 달 달력 + 기분 얼굴로 폰 배경화면을 만들어요.', '배경화면 달력'],
      'd-share': ['이미지·영상으로 공유', '일기 아래 "이미지로 저장"·촬영 모드로 스토리·쇼츠용 9:16.', '공유 인스타'],
      'd-pdf': ['PDF·책으로', '한 달·1년을 PDF로 저장하거나 인쇄해요.', 'pdf 인쇄 책'],
      'd-pet': ['식물 친구', '기록할 때마다 햇살을 받아 씨앗이 별나무까지 자라요. 시들지 않아요.', '식물 키우기'],
      'c-backup': ['백업 파일', '모든 기록이 암호화된 파일 하나로. 한 달에 한 번이면 충분해요.', '백업 저장'],
      'c-lock': ['지문·얼굴로 열기', '비밀번호 대신 지문·얼굴로 (지원 기기만).', '지문 얼굴'],
      'c-transfer': ['새 폰으로 옮기기', 'QR 코드로 다른 기기에 그대로 옮겨요.', '옮기기 qr'],
      'c-helper': ['도우미에게 묻기', '💁 를 누르고 하고 싶은 걸 적으면 그 기능으로 데려가요.', '도우미 질문'],
      'c-theme': ['속지 테마·앱 배경', '앱 전체를 체크·도트·꽃 종이나 그림 배경으로.', '테마 배경'],
      'c-install': ['홈 화면에 설치', '앱처럼 아이콘으로 바로 열어요.', '설치 아이콘'],
      'c-reminder': ['매일 기록 알림', '정한 시간에 "오늘 기록했나요?" 알려줘요.', '매일 알림'],
      'c-lang': ['한국어·영어·일본어', '설정에서 언제든 바꿔요.', '언어']
    }
  };

  var EN = {
    ui: {
      title: 'User guide', search: 'What do you want to do? (e.g. receipt, rent, lock a note)', pros: 'What it is good at', routines: 'Ways to use it', all: 'Every feature',
      progress: 'You have tried {n} of {all}', unusedOnly: 'Not tried yet', showAll: 'Show all', try: 'Try it', used: '✓ Tried', notYet: 'Not yet',
      none: 'Nothing found. Try other words.', who: 'Good for', tour: 'Replay the intro', web: 'Web manual (with more detail)',
      tipT: 'You can also: {f}', tipDo: 'Try it', tipMore: 'Guide', link: '📖 {all} things you can do · User guide', setRow: '📖 User guide · strengths and how to use it',
      tabs: { budget: 'Budget', notes: 'Notes', diary: 'Diary', common: 'All apps' },
      groups: { rec: 'Recording', plan: 'Planning & saving', care: 'The app checks in', see: 'Looking back', write: 'Writing', deco: 'Decorate & protect', look: 'Look back & share', safe: 'Stay safe', comfort: 'Make it easy' }
    },
    pros: {
      budget: [['🔒', 'No account, no bank link', 'Everything is encrypted on this device. Nobody can read it without your passcode.'],
        ['⚡', 'Three seconds to log, the rest is automatic', 'Type "lunch 12" and you are done. Rent, subscriptions and pay add themselves on their day.'],
        ['🙋', 'The app asks first', 'Evening check-in, reminders before payments, saving day and last week\'s summary — forgetting is fine.'],
        ['🐷', 'A budget that saves, not just tracks', 'Pay-yourself-first plan, goals, no-spend and envelope challenges help money stay.']],
      notes: [['✍️', 'One line is a note', 'Type at the top and press Enter. Start with [] for a checklist.'],
        ['🧮', 'From note to budget', 'Pick lines with an amount, like "coffee 4.50", and add them to the budget at once.'],
        ['🛒', 'Grocery, recipe and price-book pages', 'Diary papers and stickers make notes pretty too.'],
        ['🔐', 'Lock a single note', 'A private note asks for your passcode every time it opens.']],
      diary: [['🌙', 'Pretty from the start', '40 illustrated covers in six styles, 27 ready-made pages, stickers and washi tape.'],
        ['🔐', 'A truly private diary', 'Encrypted on this device only. No server and no AI reads it.'],
        ['💌', 'Better the more you write', 'Letters to your future self, five years in one view, weekly look-back, year in review.'],
        ['📸', 'When you want to share', 'Save a page as a 9:16 picture or video for Stories and Shorts.']],
      common: [['🆓', 'No install needed', 'Open it on the web and add it to your home screen. It opens offline too.'],
        ['💾', 'One backup file', 'Budget, notes and diary in one encrypted file. Move to a new phone by QR.'],
        ['💁', 'Just ask', 'Type "how do I add a receipt?" to the helper and it takes you to the button.']]
    },
    routines: {
      budget: [{ t: 'One minute a day', who: 'Busy people with a job or side hustle', s: [['Type one line like "lunch 12" whenever you spend', 'b-quick'], ['Tap a picture button for the usual things', 'b-tiles'], ['When the evening check-in appears, just confirm', 'b-checkin']] },
        { t: 'Ten minutes on payday', who: 'People whose money never stays', s: [['Take saving off first with the plan', 'b-plan'], ['Make rent and phone repeating entries', 'b-recurring'], ['Watch just one number: left this week', 'b-plan']] },
        { t: 'Once a month', who: 'Anyone wondering where it goes', s: [['See the top categories in Charts', 'b-charts'], ['Give that category a budget', 'b-catbudget'], ['Try a 7-day no-spend challenge', 'b-nobuy']] }],
      notes: [{ t: 'Shopping in one go', who: 'People who forget things at the store', s: [['Make a list with the grocery page', 'n-tpl'], ['Tick items off in the store', 'n-check'], ['Send lines with prices to the budget', 'n-tobudget']] },
        { t: 'Never miss a to-do', who: 'Forgetful days', s: [['Start with [] for a checklist', 'n-check'], ['Set a date and time reminder', 'n-remind'], ['Pin what matters', 'n-pin']] }],
      diary: [{ t: 'A 30-second diary', who: 'People who never kept one going', s: [['Pick a mood face', 'd-mood'], ['Write one line — that is enough', 'd-write'], ['Your plant friend grows', 'd-pet']] },
        { t: '30 minutes of weekend decorating', who: 'People who love to decorate', s: [['Choose a page (feelings, 4 panels, copy a sentence…)', 'd-tpl'], ['Add stickers and washi tape', 'd-deco'], ['Save it as a picture to share', 'd-share']] },
        { t: 'For you, a year from now', who: 'People who want to keep it for years', s: [['Seal a letter to your future self', 'd-letter'], ['See one date across five years', 'd-five'], ['Year-in-review cards in December', 'd-wrapped']] }],
      common: [{ t: 'Right after you start', who: 'Everyone', s: [['Save a backup file once', 'c-backup'], ['Open with fingerprint or face', 'c-lock'], ['Add it to your home screen', 'c-install']] }]
    },
    f: {
      'b-add': ['Log in three taps', '+ → amount → category and it is saved. Tap "Income" first for money in.', 'spend expense income add'],
      'b-quick': ['Log in one line', 'Type "lunch 12.50" or "taxi 20" and press Enter; the category is guessed.', 'quick line fast'],
      'b-tiles': ['Picture buttons', 'Coffee, convenience store, delivery… tap and give the amount. Frequent ones come first.', 'button coffee'],
      'b-receipt': ['Receipt photo', 'Tap "Receipt photo" while adding; it is encrypted and kept with the entry.', 'receipt photo'],
      'b-recurring': ['Repeating entries', 'Rent, subscriptions, pay — register once and they add themselves every month or week.', 'rent subscription recurring'],
      'b-paste': ['Record from payment texts', 'Paste card or bank texts: amount, shop and date are read and saved in one go.', 'sms text paste card alert'],
      'b-today': ["Today's card", 'What you can spend today, what goes out tomorrow and yesterday at a glance.', 'today summary daily'],
      'b-report': ['Monthly report cards', "Last month's spending, where it went, diary and moods as 9:16 cards.", 'report month review recap'],
      'b-import': ['Import bank or card history', 'Bring in a CSV file from your bank or card app.', 'csv excel import bank'],
      'b-methods': ['Payment methods', 'Mark cash, card or transfer and see totals for each.', 'card cash'],
      'b-plan': ['Pay-yourself-first plan', 'Saving comes off on payday, the rest becomes a weekly limit. The app speaks up on saving day and each new week.', 'saving payday weekly plan'],
      'b-budget': ['Monthly budget', 'Set one and the app shows what you can spend today.', 'budget limit'],
      'b-catbudget': ['Category budgets', 'Limit only the leaky ones, like eating out or cafés.', 'category budget'],
      'b-goal': ['Saving goals', 'A trip or an emergency fund: record each deposit; with a date it tells you how much a month.', 'goal save'],
      'b-nobuy': ['No-spend challenge', '7, 14 or 30 days, counted from your entries — nothing to tick.', 'no spend'],
      'b-challenge': ['24/52-week and 100-envelope challenges', 'Save a little at a time; progress shows under Goals.', 'challenge envelope 52'],
      'b-checkin': ['Evening check-in', 'In the evening, confirm today\'s spending and fill in what is missing.', 'check in day'],
      'b-worth': ['Worth it / A waste', 'Mark entries and the app adds up the wasted money per month and year.', 'waste regret'],
      'b-notify': ['Payment reminders', 'Phone notifications before repeating payments (supported devices).', 'notification due'],
      'b-seals': ['Collect seals', 'First entry, check-in streaks, a month within budget… each earns a seal.', 'badge reward'],
      'b-calendar': ['Calendar', 'What went out each day; tap a day for its entries.', 'calendar day'],
      'b-charts': ['Charts & category detail', 'Against last month, a bar per category; tap one for nine months.', 'chart graph stats'],
      'b-year': ['Year view', 'A year of money in and out, month by month.', 'year annual'],
      'b-search': ['Search', '"When did I buy that?" Find by note or amount.', 'find search'],
      'n-quick': ['One-line notes', 'Type at the top and press Enter — the note is made, ready for the next.', 'note memo'],
      'n-check': ['Checklists', 'Start with [] or tap "Checklist" in a note.', 'todo check'],
      'n-tpl': ['Grocery, recipe and price-book pages', '"Page" in a note: grocery list, recipe card, price book, saving challenges.', 'grocery recipe'],
      'n-tobudget': ['Amount lines → budget', 'Pick lines such as "coffee 4.50" and add them to the budget at once.', 'to budget'],
      'n-remind': ['Note reminders', 'Pick a date and time and add it to your calendar.', 'remind alarm'],
      'n-pin': ['Pin to top', 'Important notes stay first.', 'pin'],
      'n-photo': ['Photo notes', 'Up to six pictures — a whiteboard, a parking spot.', 'photo'],
      'n-deco': ['Decorate notes', 'The same papers, stickers and tape as the diary.', 'sticker decorate'],
      'n-lock': ['Lock a note', 'Asks for your passcode each time; search skips it.', 'lock private'],
      'n-desk': ['Desktop sticky notes', 'On a computer, float a note in its own small window, on top.', 'desktop widget'],
      'd-write': ['Write an entry', 'Tap + and write; it saves as you type. One line is enough.', 'diary write'],
      'd-mood': ['Today\'s mood', 'One of five faces, building up on the calendar and posters.', 'mood feeling'],
      'd-feel': ['Feelings dictionary & thermometer', 'Excited, proud, hurt… name the feeling exactly.', 'feelings dictionary'],
      'd-tpl': ['27 ready-made pages', 'Day review, three good things, reading, workout, meals, 4-panel comic, copy a sentence…', 'page template'],
      'd-letter': ['Letter to your future self', 'Seal it with an opening date; it arrives at the top that day.', 'letter seal'],
      'd-search': ['#tags & search', 'Write #travel to group entries and find them.', 'tag search'],
      'd-auto': ['Decorate in one tap', 'The ✨ button at the top of Stickers puts a matching tape, label and stickers on the page; tap again for another set. There are word labels, doodles, memo paper and money stickers too.', 'auto decorate label doodle'],
      'd-deco': ['Stickers, washi tape, paper', 'Season, mood and food stickers and tapes — drag them anywhere.', 'sticker tape'],
      'd-photo': ['Photos & photo stickers', 'Four photos, or your photo cut into a circle or heart sticker.', 'photo'],
      'd-draw': ['Draw', 'Draw with your finger; eraser and undo.', 'draw'],
      'd-cover': ['Decorate the cover', '40 pictures in six styles, a title, colour filters and stickers.', 'cover'],
      'd-books': ['Several notebooks', 'Reading, workout, gratitude, travel — each with its own cover.', 'notebook'],
      'd-weekly': ['Weekly look-back', 'On Sundays and Mondays: last week\'s moods, pages and spending.', 'weekly review'],
      'd-five': ['Five years, one day', 'The same date across five years on one screen.', 'five years'],
      'd-wrapped': ['Year in review', 'Swipeable cards about your year, in December and January.', 'year review wrapped'],
      'd-wall': ['Calendar wallpaper', 'This month\'s calendar with your mood faces as a phone wallpaper.', 'wallpaper'],
      'd-share': ['Share as picture or video', '"Save as picture" and filming mode make 9:16 pages for Stories and Shorts.', 'share instagram'],
      'd-pdf': ['PDF or a book', 'Save a month or a year as a PDF, or print it.', 'pdf print'],
      'd-pet': ['Plant friend', 'Sunshine each time you look after yourself; it grows from a seed to a star tree and never wilts.', 'plant'],
      'c-backup': ['Backup file', 'Everything in one encrypted file. Once a month is plenty.', 'backup'],
      'c-lock': ['Fingerprint or face', 'Open without typing the passcode (supported devices).', 'fingerprint face'],
      'c-transfer': ['Move to a new phone', 'Carry everything across with a QR code.', 'move qr'],
      'c-helper': ['Ask the helper', 'Tap 💁 and say what you want; it takes you there.', 'helper ask'],
      'c-theme': ['Paper theme & wallpaper', 'Put the whole app on check, dots or flowers, or a picture.', 'theme background'],
      'c-install': ['Install on the home screen', 'Open it from an icon like any app.', 'install icon'],
      'c-reminder': ['Daily reminder', 'A nudge at the time you choose.', 'daily reminder'],
      'c-lang': ['English, Korean, Japanese', 'Switch any time in Settings.', 'language']
    }
  };

  var JA = {
    ui: {
      title: '使い方ガイド', search: '何をしたいですか?(例:レシート、家賃、メモをロック)', pros: 'このアプリのいいところ', routines: 'こんな使い方がおすすめ', all: 'すべての機能',
      progress: '{all}個のうち{n}個使いました', unusedOnly: 'まだ使っていないものだけ', showAll: 'すべて表示', try: '試す', used: '✓ 使用済み', notYet: 'まだ',
      none: '見つかりません。別の言葉で試してください。', who: 'こんな方に', tour: '最初の案内をもう一度', web: 'Web版マニュアル(詳しく)',
      tipT: 'こんなこともできます:{f}', tipDo: '試す', tipMore: 'ガイド', link: '📖 できること{all}個 · 使い方ガイド', setRow: '📖 使い方ガイド · いいところと使い方',
      tabs: { budget: '家計簿', notes: 'メモ', diary: '日記', common: '共通' },
      groups: { rec: '記録する', plan: '計画・貯める', care: 'アプリから声かけ', see: '振り返る', write: '書く', deco: '飾る・守る', look: '見返す・シェア', safe: '安全に', comfort: '便利に' }
    },
    pros: {
      budget: [['🔒', 'アカウントも銀行連携もなし', '記録はこの端末の中で暗号化。パスコードなしでは誰も見られません。'],
        ['⚡', '3秒で記録、あとは自動', '「ランチ 1000」の1行で完了。家賃・サブスク・給料はその日に自動で記録。'],
        ['🙋', 'アプリから聞いてくれる', '夜のチェックイン、支払日前のお知らせ、貯金日、先週のまとめ。忘れても大丈夫。'],
        ['🐷', 'つける家計簿から、貯まる家計簿へ', '先取り貯金の予算表、目標、ノースペンド・封筒チャレンジでお金が残ります。']],
      notes: [['✍️', '1行書けばすぐメモ', '上の欄に書いてEnter。先頭に [] を付けるとチェックリスト。'],
        ['🧮', 'メモから家計簿へ', '「コーヒー 450」のような金額入りの行を選んでまとめて家計簿へ。'],
        ['🛒', '買い物・レシピ・価格メモ帳', '日記の紙やシールでメモもかわいく。'],
        ['🔐', 'メモを1つだけロック', '見られたくないメモは開くたびにパスコードを確認します。']],
      diary: [['🌙', '最初からかわいい', 'イラスト表紙40種(6スタイル)、ページ27種、シールとマスキングテープ。'],
        ['🔐', '本当にひみつの日記', 'この端末の中だけで暗号化。サーバーもAIも読みません。'],
        ['💌', '続けるほど楽しい', '未来の自分への手紙、5年日記、週の振り返り、年末のまとめ。'],
        ['📸', 'シェアしたいときは', 'ページを9:16の画像・動画で保存してストーリーやショートに。']],
      common: [['🆓', 'インストール不要', 'Webで開いてホーム画面に追加すればアプリのように。オフラインでも開けます。'],
        ['💾', 'バックアップは1ファイル', '家計簿・メモ・日記を暗号化した1つのファイルに。新しいスマホへはQRで。'],
        ['💁', 'わからなければ聞いて', 'ヘルパーに「レシートどうするの?」と書けばそのボタンへ案内します。']]
    },
    routines: {
      budget: [{ t: '1日1分ルーティン', who: '忙しい会社員・副業の方', s: [['使うたびに「ランチ 1000」と1行', 'b-quick'], ['いつもの買い物は絵のボタンで', 'b-tiles'], ['夜のチェックインで確認するだけ', 'b-checkin']] },
        { t: '給料日の10分', who: 'お金が貯まらない方', s: [['予算表でまず貯金', 'b-plan'], ['家賃・通信費は繰り返しに', 'b-recurring'], ['今週の残りだけ見る', 'b-plan']] },
        { t: '月に1回の見直し', who: 'どこで使いすぎか知りたい方', s: [['グラフで多い分類を確認', 'b-charts'], ['その分類に予算', 'b-catbudget'], ['来週は7日間ノースペンド', 'b-nobuy']] }],
      notes: [{ t: '買い物を一度で', who: '買い忘れが多い方', s: [['買い物リストのページで作る', 'n-tpl'], ['お店で1つずつチェック', 'n-check'], ['金額のある行は家計簿へ', 'n-tobudget']] },
        { t: 'やることを忘れない', who: 'うっかりが多い方', s: [['[] で始めるとチェックリスト', 'n-check'], ['日時のリマインダー', 'n-remind'], ['大事なものは上に固定', 'n-pin']] }],
      diary: [{ t: '30秒日記', who: '日記が続かなかった方', s: [['気分の顔を1つ選ぶ', 'd-mood'], ['1行だけ書く — それで十分', 'd-write'], ['植物の友だちが育ちます', 'd-pet']] },
        { t: '週末の30分デコ', who: '飾るのが好きな方', s: [['ページを選ぶ(気持ちの温度・4コマ・書き写し…)', 'd-tpl'], ['シールとテープを貼る', 'd-deco'], ['画像で保存してシェア', 'd-share']] },
        { t: '1年後の自分へ', who: '長く残したい方', s: [['未来の自分へ手紙を封印', 'd-letter'], ['同じ日の5年を1画面で', 'd-five'], ['12月は年末のまとめカード', 'd-wrapped']] }],
      common: [{ t: '使い始めたら必ず', who: 'すべての方', s: [['バックアップを1回保存', 'c-backup'], ['指紋・顔で開く', 'c-lock'], ['ホーム画面に追加', 'c-install']] }]
    },
    f: {
      'b-add': ['3タップで記録', '+ → 金額 → 分類ですぐ保存。収入は先に「収入」。', '支出 記録 収入'],
      'b-quick': ['1行で記録', '「ランチ 1000」と書いてEnter。分類はアプリが推測。', '1行 すばやく'],
      'b-tiles': ['絵のボタン', 'コーヒー・コンビニ・デリバリー… 押して金額だけ。', 'ボタン コーヒー'],
      'b-receipt': ['レシート写真', '記録するときに「レシート写真」。暗号化して一緒に保存。', 'レシート 写真'],
      'b-recurring': ['繰り返しの支出・収入', '家賃・サブスク・給料は1回登録すれば毎月・毎週自動。', '家賃 サブスク 固定費'],
      'b-paste': ['利用通知から記録', 'カード・銀行の通知を貼ると金額・お店・日付を読み取ってまとめて記録。', '通知 貼り付け SMS'],
      'b-today': ['今日の一枚', '今日使えるお金・明日の引き落とし・昨日の支出をひと目で。', '今日 まとめ'],
      'b-report': ['月間レポートカード', '先月の支出・使いみち・日記・気分を9:16カードで。', 'レポート 月 ふりかえり'],
      'b-import': ['カード・銀行明細の取り込み', '銀行・カードアプリのCSVをまとめて取り込み。', 'csv 明細'],
      'b-methods': ['支払い方法', '現金・カード・振込に分けて合計を見る。', 'カード 現金'],
      'b-plan': ['先取り貯金の予算表', '給料日にまず貯金、残りを週の上限に。貯金日と新しい週はアプリからお知らせ。', '貯金 給料 予算表 週'],
      'b-budget': ['月の予算', '決めると今日使えるお金を毎日表示。', '予算'],
      'b-catbudget': ['分類ごとの予算', '外食やカフェなど漏れやすい分類だけに上限。', '分類 予算'],
      'b-goal': ['貯金目標', '旅行・非常用など。日付を決めると月にいくらか分かります。', '目標 貯金'],
      'b-nobuy': ['ノースペンドチャレンジ', '7・14・30日。家計簿の記録から自動でカウント。', '節約'],
      'b-challenge': ['24・52週・100封筒チャレンジ', '少しずつ貯めるページ。進み具合は「貯金」に。', '52週 封筒'],
      'b-checkin': ['夜のチェックイン', '夜に今日の支出をまとめて確認、抜けを補う。', 'チェックイン'],
      'b-worth': ['よかった / もったいない', '印を付けると、もったいないお金を月・年で合計。', 'もったいない'],
      'b-notify': ['支払日のお知らせ', '繰り返しの支払いの前に通知(対応端末のみ)。', '通知'],
      'b-seals': ['シール集め', '初記録、連続チェックイン、予算内の月… 達成でシール。', 'ご褒美'],
      'b-calendar': ['カレンダー', '日ごとの支出がひと目で。日付を押すとその日の明細。', 'カレンダー'],
      'b-charts': ['グラフ・分類の詳細', '先月との比較、分類ごとの棒。押すと9か月の流れ。', 'グラフ'],
      'b-year': ['年間表示', '1年の収支を月ごとに1画面で。', '年間'],
      'b-search': ['検索', '「いつ買ったっけ?」メモや金額で探す。', '検索'],
      'n-quick': ['1行メモ', '上に書いてEnter。次の行もすぐ書けます。', 'メモ 付箋'],
      'n-check': ['チェックリスト', '[] で始めるか「チェックリスト」。', 'やること'],
      'n-tpl': ['買い物・レシピ・価格メモ帳のページ', 'メモの「ページ」から選びます。', '買い物 レシピ'],
      'n-tobudget': ['金額の行 → 家計簿', '「コーヒー 450」などの行をまとめて家計簿へ。', '家計簿へ'],
      'n-remind': ['メモのリマインダー', '日時を決めてカレンダーに追加。', 'リマインダー'],
      'n-pin': ['上に固定', '大事なメモはいつも一番上に。', '固定'],
      'n-photo': ['写真メモ', 'ホワイトボードや駐車位置など6枚まで。', '写真'],
      'n-deco': ['メモを飾る', '日記と同じ紙・シール・テープで。', 'シール'],
      'n-lock': ['メモをロック', '開くたびにパスコード。検索にも出ません。', 'ロック'],
      'n-desk': ['デスクトップ付箋', 'パソコンで小さな窓に浮かべていつも前面に。', 'デスクトップ'],
      'd-write': ['日記を書く', '+ を押して書くと自動保存。1行で十分。', '日記'],
      'd-mood': ['今日の気分', '5つの顔から1つ。カレンダーやポスターに色で残ります。', '気分'],
      'd-feel': ['気持ち辞典・温度計', 'わくわく・誇らしい・さみしい… 気持ちに名前を。', '気持ち'],
      'd-tpl': ['ページ27種', '1日の振り返り、感謝の3行、読書・運動・食事、4コマ、書き写しなど。', 'テンプレート'],
      'd-letter': ['未来の自分への手紙', '開く日を決めて封印。その日に一番上へ届きます。', '手紙'],
      'd-search': ['#タグ・検索', '#旅行 のように書くとタグでまとめて探せます。', 'タグ'],
      'd-auto': ['ワンタップでデコ', 'シール画面の一番上の ✨ を押すと、テープ・ラベル・シールが合う組み合わせで貼られます。もう一度で別の組み合わせ。ラベル・落書き・メモ紙・お金のシールも。', '自動 デコ ラベル'],
      'd-deco': ['シール・マスキングテープ・紙', '季節・気分・食べ物のシールとテープをドラッグ。', 'デコ'],
      'd-photo': ['写真・写真シール', '写真4枚、または自分の写真を丸・ハートのシールに。', '写真'],
      'd-draw': ['お絵かき', '指で描いて、消しゴムと元に戻す。', '絵'],
      'd-cover': ['表紙を飾る', 'イラスト40種(6スタイル)、タイトル、色フィルター、シール。', '表紙'],
      'd-books': ['ノートを複数', '読書・運動・感謝・旅行を別々に、表紙も別々に。', 'ノート'],
      'd-weekly': ['週の振り返り', '日・月曜に先週の気分・記録・支出をまとめて表示。', '振り返り'],
      'd-five': ['5年日記', '同じ日付の5年を1画面で。', '5年'],
      'd-wrapped': ['年末のまとめ', '12・1月に1年をめくるカードで。', 'まとめ'],
      'd-wall': ['カレンダー壁紙', '今月のカレンダー+気分の顔でスマホの壁紙に。', '壁紙'],
      'd-share': ['画像・動画でシェア', '「画像で保存」と撮影モードで9:16に。', 'シェア'],
      'd-pdf': ['PDF・本に', '1か月・1年をPDFで保存、または印刷。', 'pdf 印刷'],
      'd-pet': ['植物の友だち', '記録するたびに日差しをもらって種から星の木まで。枯れません。', '植物'],
      'c-backup': ['バックアップ', 'すべてを暗号化した1ファイルに。月1回で十分。', 'バックアップ'],
      'c-lock': ['指紋・顔で開く', 'パスコードの代わりに(対応端末のみ)。', '指紋'],
      'c-transfer': ['新しいスマホへ移す', 'QRコードでそのまま移します。', '移行 qr'],
      'c-helper': ['ヘルパーに聞く', '💁 を押してしたいことを書けば案内します。', 'ヘルパー'],
      'c-theme': ['紙のテーマ・背景', 'アプリ全体をチェック・ドット・花の紙や絵の背景に。', 'テーマ'],
      'c-install': ['ホーム画面に追加', 'アイコンからアプリのように開きます。', 'インストール'],
      'c-reminder': ['毎日のお知らせ', '決めた時間に「今日記録した?」とお知らせ。', 'お知らせ'],
      'c-lang': ['日本語・英語・韓国語', '設定でいつでも変更。', '言語']
    }
  };
  var TEXT = { ko: KO, en: EN, ja: JA };
  function text(lang) { return TEXT[lang] || EN; }
  root.VaultGuide = { F: F, APPS: ['budget', 'notes', 'diary', 'common'], used: used, text: text };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VaultGuide;
})(typeof window !== 'undefined' ? window : globalThis);
