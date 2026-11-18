// 《F급의 나날》 KubeJS 6 Server Script - Data-Driven RPG NPC Dialogue System & Secure Action Router (v7)
// 파일 경로: kubejs/server_scripts/10_npc_rpg_dialog_server.js
// 핵심 설계:
// 1. 모든 확정 NPC(로만·다림·헤스·나우·고리·휘연·스키·협합·밤밤)가 하나의 공통 RPG 대화창 UI 구조를 데이터 기반으로 공유
// 2. 우클릭 -> NPC 식별 -> 서버 거리·차원·선행조건 검증 -> UI 오픈 패킷 전송 -> 버튼 클릭 -> 서버 재검증 -> 기능 실행
// 3. 클라이언트 전달 호감도·등급·보상 요청 불신 원칙: 오직 서버 저장소(f_rank_days_state_v1)와 실제 거리(<=8.5블록)만 신뢰
// 4. 헤스 길드 등록증 v6 UI와 100% 무충돌 연동 (대화창을 먼저 안전 종료한 뒤 등록증 양피지 UI 오픈)

global.FRankDays = global.FRankDays || {};

global.FRankDays.STAGE_KO_LABELS = {
  acquaintance: '안면',
  rapport: '호감',
  trust: '신뢰',
  personal_incident: '깊은 유대',
  relationship_choice: '특별한 기로',
  bond_aftermath: '소중한 인연'
};

// kubejs/data/f_rank_days/npc_dialogs.json 과 동기화된 서버 런타임 데이터 테이블
global.FRankDays.NPC_DIALOG_DEFS = {
  harin: {
    npc_id: 'harin', name: '하린', job_grade_badge: 'A급 레인저',
    affiliation: '세르딘 숲의 수호자', subtitle: '숲에 남아 고향을 지키는 엘프 레인저',
    portrait: 'f_rank_days:textures/npc/hess_portrait.png', portrait_is_placeholder: true,
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_swordsman.png',
    theme: { primary: '#344A3A', accent: '#A3B88C', badge: '#26392B' },
    greetings: { default: '처음 보는 얼굴이군. 길에서 벗어나지 마.', rapport: '또 왔나. 숲의 표식은 기억했겠지.', trust: '안쪽은 아직 위험해. 준비가 되면 말해.' },
    talk_pages: [
      '하린은 나뭇가지 너머를 살피며 짧게 말했다.\n"마을로 돌아가려면 오던 길의 표식을 따라가. 바깥 채집 구역에서만 약초를 캐. 짙은 숲 안쪽은 아직 들어가지 마."',
      '"세르딘은 한때 엘프들의 고향이었다. 여러 세력이 맞붙은 전쟁이 숲을 바꿨지. 남은 이들은 떠났고, 나는 남았다."\n하린은 전쟁의 원인이나 책임에 대해서는 더 말하지 않았다.',
      '"길과 채집 구역을 먼저 익혀. 더 깊은 숲의 일은 그다음이다."'
    ],
    preferred_gifts: [], shop_items: [],
    buttons: [
      { id: 'talk', label: '숲길과 위험 구역 묻기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'quest', label: '숲의 의뢰', icon: 'quest', action: 'DISABLED_INFO', enabled: false, disabled_reason: '숲의 후속 의뢰는 아직 열리지 않았습니다.' },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  roman: {
    npc_id: 'roman',
    name: '로만',
    job_grade_badge: 'B급 연금술사',
    affiliation: '로만의 연금술 물약상',
    subtitle: '혼자 힘으로 물약상을 일군 고양이 수인 연금술사',
    portrait: 'f_rank_days:textures/npc/roman_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_alchemist.png',
    portrait_is_placeholder: false,
    theme: { primary: '#5B3B73', accent: '#B98CE0', badge: '#432859' },
    greetings: {
      default: '필요한 물약이 있으면 말해. 구경만 할 거면 방해하지 말고.',
      rapport: '또 왔네. 약병 깨뜨리지만 않으면 잠깐 구경하는 정도는 봐줄게.',
      trust: '...네가 가져오는 약초는 손질이 깔끔해서 쓸 만해. 오늘 용건은 뭐야?',
      resolved: '약재 배합이 막히면 네 의견도 들어 볼 생각은 있어. ...그냥 그렇다고.'
    },
    talk_pages: [
      '로만은 보라빛 시약병을 눈높이에 비춰 보며 침전물을 확인하고 있다.\n"연금술은 요행이 아니야. 온도 1도, 뿌리 손질 하나로 약이 되기도 하고 독이 되기도 해."',
      '"A급 승급 시험 준비는 순조롭냐고? ...쓸데없는 참견은 넣어 둬. 내 실력으로 끝낼 거니까."'
    ],
    preferred_gifts: ['minecraft:amethyst_shard', 'minecraft:glow_berries', 'minecraft:allium', 'minecraft:dandelion'],
    shop_items: [
      { id: 'buy_heal_potion', label: '회복 물약 (2 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 2, give_potion: 'minecraft:healing' },
      { id: 'buy_swift_potion', label: '신속 물약 (3 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 3, give_potion: 'minecraft:swiftness' },
      { id: 'buy_glass_bottles', label: '유리병 3개 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: '3x minecraft:glass_bottle' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '물약 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
      { id: 'quest', label: '연금술 의뢰', icon: 'quest', action: 'QUEST_ACTION', enabled: true },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'special', label: '연금술 입문', icon: 'special', action: 'SPECIAL_ALCHEMIST_INTRO', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  darim: {
    npc_id: 'darim',
    name: '다림',
    job_grade_badge: 'C급 농부',
    affiliation: '브리온 마을 농장 · 실습장',
    subtitle: '다정한 손길로 밀밭을 가꾸는 여우 수인 농부',
    portrait: 'f_rank_days:textures/npc/darim_portrait.png',
    portrait_aspect_ratio: 1248 / 1600,
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_farmer.png',
    portrait_is_placeholder: false,
    theme: { primary: '#4A6B34', accent: '#8FBF5A', badge: '#375225' },
    greetings: {
      default: '오늘 농장 일이 조금 많은데, 혹시 도와줄 수 있어?',
      rapport: '어서 와! 오늘 바람이 참 선선하지? 밭고랑 흙도 아주 촉촉해.',
      trust: '네가 자주 들러 주니까 농장이 훨씬 활기차졌어. 언제든 편하게 쉬어 가!',
      resolved: '밀밭도, 지난날의 기억도 이제 두렵지 않아. 함께 고민해 줘서 정말 고마워.'
    },
    talk_pages: [
      '다림은 흙 묻은 장갑을 털며 환하게 미소 지었다.\n"씨앗은 거짓말을 안 해. 물길을 터 주고 정성껏 돌보면 반드시 이삭으로 보답하거든."',
      '"농부 자격시험을 준비 중이라면 농장 남쪽 실습 밭을 자유롭게 써도 좋아!"'
    ],
    preferred_gifts: ['minecraft:wheat', 'minecraft:sweet_berries', 'minecraft:golden_carrot', 'minecraft:apple'],
    shop_items: [
      { id: 'sell_wheat_8', label: '밀 8개 납품 (+1 에메랄드)', sell_mode: true },
      { id: 'buy_seeds_12', label: '밀 씨앗 12개 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: '12x minecraft:wheat_seeds' },
      { id: 'buy_carrots_6', label: '신선한 당근 6개 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: '6x minecraft:carrot' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '농작물 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
      { id: 'quest', label: '농사 의뢰', icon: 'quest', action: 'QUEST_ACTION', enabled: true },
      { id: 'special', label: '농업 배우기', icon: 'special', action: 'SPECIAL_FARMING_LESSON', enabled: true },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  hess: {
    npc_id: 'hess',
    name: '헤스',
    job_grade_badge: '통합 길드 접수원',
    affiliation: '아르베른 통합 길드 브리온 지부',
    subtitle: '정중하고 빈틈없는 브리온 지부 행정 책임 접수원',
    portrait: 'f_rank_days:textures/npc/hess_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_guild.png',
    portrait_is_placeholder: true,
    theme: { primary: '#2E4566', accent: '#7CA4D9', badge: '#22344D' },
    greetings: {
      default: '안녕하십니까. 아르베른 통합 길드 브리온 지부 접수원 헤스입니다. 어떤 업무를 도와드릴까요?',
      rapport: '찾아주셨군요. 오늘도 서류가 산더미지만... 귀하의 용건부터 정확히 처리해 드리겠습니다.',
      trust: '창구 앞에 서 계신 걸 보니 한결 마음이 놓입니다. 필요한 행정 절차를 말씀해 주십시오.',
      resolved: '공식 절차로 위험 등급 재분류가 시작되었습니다. 함께 기록을 바로잡아 주셔서 깊이 감사드립니다.'
    },
    talk_pages: [
      '헤스는 피로한 기색을 감춘 채 반듯한 자세로 접수 장부를 정리하고 있다.\n"아르베른 제국에서는 모든 직업의 자격이 독립적으로 기록됩니다. 농사를 지으며 검술이나 연금술 자격을 함께 취득하실 수도 있습니다."',
      '"아직 주민 등록을 마치지 않으셨다면 [직업 등록]에서 F급 특성과 첫 직업을 고르신 뒤, [길드 업무]에서 《길드 등록증》에 성명을 서명해 주십시오."'
    ],
    preferred_gifts: ['minecraft:honey_bottle', 'minecraft:milk_bucket', 'minecraft:book', 'minecraft:cookie'],
    shop_items: [],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'guild_work', label: '길드 등록', icon: 'special', action: 'SPECIAL_GUILD_WORK', enabled: true },
      { id: 'job_reg', label: '직업 선택', icon: 'shop', action: 'OPEN_JOB_MENU', enabled: true },
      { id: 'exam', label: '자격시험', icon: 'special', action: 'OPEN_EXAM_MENU', enabled: true },
      { id: 'quest', label: '퀘스트', icon: 'quest', action: 'QUEST_ACTION', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  nau: {
    npc_id: 'nau',
    name: '나우',
    job_grade_badge: 'B급 대장장이',
    affiliation: '나우의 대장간',
    subtitle: '말투는 무뚝뚝해도 쇳물보다 속이 따뜻한 장인',
    portrait: 'f_rank_days:textures/npc/nau_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_blacksmith.png',
    portrait_is_placeholder: true,
    theme: { primary: '#7A3E26', accent: '#E08250', badge: '#592B19' },
    greetings: {
      default: '불티 튀니까 모루 가까이 붙지 마라. 연장 수리할 끼가, 아님 새로 맞출 끼가?',
      rapport: '왔나. 손에 물집 안 잡혔나 모르겠네. 연장 날 무뎌졌으믄 이리 내봐라.',
      trust: '니가 쓰는 연장은 내 이름 걸고 벼려 준다. 험한 데 갈 때는 장비부터 단디 챙기라.'
    },
    talk_pages: [
      '나우는 달궈진 쇠를 담금질하며 묵직한 한숨을 내쉬었다.\n"내가 말주변이 영 없어가 수습 애들이 무섭다 카고 나가뿌는데... 속으론 다 잘되라꼬 한 소린데 참 어렵데이."'
    ],
    preferred_gifts: ['minecraft:coal', 'minecraft:raw_iron', 'minecraft:iron_ingot', 'minecraft:baked_potato'],
    shop_items: [
      { id: 'buy_iron_pick', label: '철 곡괭이 (3 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 3, give_item: 'minecraft:iron_pickaxe' },
      { id: 'buy_iron_hoe', label: '철 괭이 (2 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 2, give_item: 'minecraft:iron_hoe' },
      { id: 'buy_stone_sword', label: '단련된 돌검 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: 'minecraft:stone_sword' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '장비·재료', icon: 'shop', action: 'V8_NAU_FORGE_MENU', enabled: true },
      { id: 'quest', label: '대장간 일거리', icon: 'quest', action: 'QUEST_ACTION', enabled: true },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'special', label: '강화·계승', icon: 'special', action: 'V82_NAU_OPEN_ENH_GUI', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  gori: {
    npc_id: 'gori',
    name: '고리',
    job_grade_badge: '브리온 여관 주인',
    affiliation: '브리온 화톳불 여관',
    subtitle: '따뜻하지만 분명한 선을 지키는 페럿 수인 여관주',
    portrait: 'f_rank_days:textures/npc/gori_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_innkeeper.png',
    portrait_is_placeholder: true,
    theme: { primary: '#8C5828', accent: '#E8A85A', badge: '#663E1B' },
    greetings: {
      default: '어서 오세요! 브리온 화톳불 여관은 예의 바른 손님이라면 누구에게나 열려 있답니다.',
      rapport: '오늘도 수고 많으셨죠? 막 구운 감자랑 따뜻한 수프가 준비되어 있어요!',
      trust: '당신이 여관에 들러 주실 때마다 홀 분위기가 참 편안해져요. 편히 쉬다 가세요.'
    },
    talk_pages: [
      '고리는 깨끗한 행주로 참나무 테이블을 닦으며 미소 지었다.\n"2층 객실 침대는 정착민분들도 언제든 쉬어 가실 수 있게 비워 두었어요. 밤길은 위험하니 무리하지 마세요."'
    ],
    preferred_gifts: ['minecraft:sweet_berries', 'minecraft:honey_bottle', 'minecraft:bread', 'minecraft:cornflower'],
    shop_items: [
      { id: 'buy_inn_meal', label: '따뜻한 여관 정식 (1 에메랄드)', meal_mode: true },
      { id: 'buy_mushroom_stew', label: '버섯 스튜 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: 'minecraft:mushroom_stew' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '식사 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
      { id: 'quest', label: '마을 소식', icon: 'quest', action: 'QUEST_ACTION', enabled: true },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'special', label: '객실 안내', icon: 'special', action: 'SPECIAL_GORI_ROOM', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  hwiyeon: {
    npc_id: 'hwiyeon',
    name: '휘연',
    job_grade_badge: 'A급 힐러',
    affiliation: '브리온 개인 의료소',
    subtitle: '차분히 상처를 돌보는 고위 치유사 (말투 미확정)',
    portrait: 'f_rank_days:textures/npc/hwiyeon_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_healer.png',
    portrait_is_placeholder: true,
    theme: { primary: '#2F6E62', accent: '#76C7B7', badge: '#204F46' },
    greetings: {
      default: '(정돈된 약재 선반 사이로 휘연이 조용히 고개를 끄덕이며 다친 곳이 없는지 살핀다.)',
      rapport: '(익숙한 발소리에 휘연이 차분한 눈빛으로 맞으며 따뜻한 약차를 권한다.)',
      trust: '(잠시 미세하게 떨리던 손끝을 갈무리한 휘연이 온화한 기색으로 진료석을 가리킨다.)'
    },
    talk_pages: [
      '(휘연의 고유 말투는 기획 미확정 상태이므로 중립 서술로 표시됩니다.)\n의료소 책상 위에는 지혈 붕대 감는 법과 응급 약초 분류표가 단정하게 정리되어 있다.'
    ],
    preferred_gifts: ['minecraft:oxeye_daisy', 'minecraft:apple', 'minecraft:glow_berries', 'minecraft:white_wool'],
    shop_items: [
      { id: 'buy_bandage_wool', label: '소독 양털 붕대 3개 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: '3x minecraft:white_wool' },
      { id: 'buy_clinic_apples', label: '병문안 사과 3개 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: '3x minecraft:apple' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '의료품 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
      { id: 'quest', label: '진료 보조', icon: 'quest', action: 'QUEST_ACTION', enabled: true },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'special', label: '응급 처치', icon: 'special', action: 'SPECIAL_HWIYEON_HEAL', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  ski: {
    npc_id: 'ski',
    name: '스키',
    job_grade_badge: 'A급 검술 교관',
    affiliation: '길드 검술·전술 훈련장',
    subtitle: '천부적인 재능을 자랑하는 여우 수인 A급 교관',
    portrait: 'f_rank_days:textures/npc/ski_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_swordsman.png',
    portrait_is_placeholder: true,
    theme: { primary: '#8A3333', accent: '#E67365', badge: '#632222' },
    greetings: {
      default: '오호, 이 천재 A급 교관 스키 님의 검술 지도를 받으러 왔다고? 눈썰미 하나는 훌륭하군!',
      rapport: '자세 봐라, 처음보단 제법 태가 나는데? 물론 이 몸의 완벽한 검선에는 아직 멀었지만!',
      trust: '...가끔은 검 말고 다른 걸 쥐어 보고 싶을 때도 있어. 아, 방금 말은 못 들은 걸로 해!'
    },
    talk_pages: [
      '스키는 목검을 가볍게 돌리며 여유만만한 표정을 지었다.\n"힘으로만 휘두르면 삼류야! 호흡과 발놀림이 먼저라고. 검사 자격시험을 치를 거면 내 기초 훈련부터 통과해!"'
    ],
    preferred_gifts: ['minecraft:apple', 'minecraft:cooked_beef', 'minecraft:feather'],
    shop_items: [
      { id: 'buy_wooden_sword', label: '수련용 목검 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: 'minecraft:wooden_sword' },
      { id: 'buy_shield', label: '훈련용 방패 (2 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 2, give_item: 'minecraft:shield' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '훈련구 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
      { id: 'quest', label: '개인 서사(준비중)', icon: 'quest', action: 'DISABLED_INFO', enabled: false, disabled_reason: '2순위 개인 서사 「천재 검사의 진짜 꿈」은 추후 업데이트 예정입니다.' },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'special', label: '검술 기초훈련', icon: 'special', action: 'SPECIAL_SKI_TRAINING', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  hyeophap: {
    npc_id: 'hyeophap',
    name: '협합',
    job_grade_badge: 'B급 유물 연구자',
    affiliation: '유물 감정 별관 · 비축 창고',
    subtitle: '자존심 높고 박식한 고양이 수인 유물 학자',
    portrait: 'f_rank_days:textures/npc/hyeophap_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_relic.png',
    portrait_is_placeholder: true,
    theme: { primary: '#4B3F72', accent: '#9E8FD9', badge: '#352C54' },
    greetings: {
      default: '흠! 이 위대한 유물 연구자 협합 님께 감정을 의뢰하러 왔나? 세르딘 비석 탁본이라면 제대로 찾아왔지!',
      rapport: '오, 또 왔군! 유적을 함부로 훼손하지 않고 탁본을 떠 오는 자세만큼은 칭찬해 주지.',
      trust: '크흠, 저기 구석 상자에 든 건 연구용 고대 파충류 모형이지 절대 귀여워서 모으는 인형이 아니다!'
    },
    talk_pages: [
      '협합은 돋보기를 고쳐 쓰며 고대 문양 지도를 짚었다.\n"세르딘 숲 깊은 곳의 조각된 석재 벽돌 비석에 종이를 대고 탁본을 떠 오면 유물 연구자 실기 심사에 큰 도움이 될 거다!"'
    ],
    preferred_gifts: ['minecraft:paper', 'minecraft:amethyst_shard', 'minecraft:bone'],
    shop_items: [
      { id: 'buy_rubbing_paper', label: '탁본용 종이 6장 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: '6x minecraft:paper' },
      { id: 'buy_brush', label: '발굴용 솔 (2 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 2, give_item: 'minecraft:brush' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '탐사품 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
      { id: 'quest', label: '개인 서사(준비중)', icon: 'quest', action: 'DISABLED_INFO', enabled: false, disabled_reason: '2순위 개인 서사 「박물관의 비밀 수집품」은 추후 업데이트 예정입니다.' },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'special', label: '유물학 브리핑', icon: 'special', action: 'SPECIAL_HYEOPHAP_TRAINING', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  },
  bambam: {
    npc_id: 'bambam',
    name: '밤밤',
    job_grade_badge: 'C급 떠돌이 상인',
    affiliation: '브리온 상설 시장 행상 좌판',
    subtitle: '여러 지역을 유랑하며 물품을 파는 소악마 행상인',
    portrait: 'f_rank_days:textures/npc/bambam_portrait.png',
    job_icon: 'f_rank_days:textures/gui/npc_dialog/job_merchant.png',
    portrait_is_placeholder: true,
    theme: { primary: '#6E3554', accent: '#D982B2', badge: '#4F243B' },
    greetings: {
      default: '자자, 먼 길 돌아 브리온 시장에 들른 밤밤 상점이에요! 편견 없이 구경만 하셔도 환영합니다!',
      rapport: '반가워요! 브리온 마을 분들은 시선이 한결 온화해서 좌판 펴기가 참 다행이에요.',
      trust: '어디로 떠나든 이렇게 반갑게 맞아 주는 분이 한 사람쯤 있다는 건... 꽤 든든한 일이네요.'
    },
    talk_pages: [
      '밤밤은 정갈하게 정돈된 보따리에서 각지의 잡화를 꺼내 보였다.\n"벨마르 교역로나 황도 쪽 소식도 종종 주워듣곤 해요. 여행에 필요한 물자가 있으면 언제든 말씀하세요!"'
    ],
    preferred_gifts: ['minecraft:emerald', 'minecraft:golden_apple', 'minecraft:glowstone_dust', 'minecraft:lilac'],
    shop_items: [
      { id: 'buy_lantern_pair', label: '모험가 랜턴 2개 (1 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 1, give_item: '2x minecraft:lantern' },
      { id: 'buy_leather_4', label: '가죽 4장 (2 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 2, give_item: '4x minecraft:leather' },
      { id: 'buy_amethyst_2', label: '자수정 조각 2개 (2 에메랄드)', cost_item: 'minecraft:emerald', cost_count: 2, give_item: '2x minecraft:amethyst_shard' }
    ],
    buttons: [
      { id: 'talk', label: '대화하기', icon: 'talk', action: 'TALK', enabled: true },
      { id: 'shop', label: '행상 물품 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
      { id: 'quest', label: '개인 서사(준비중)', icon: 'quest', action: 'DISABLED_INFO', enabled: false, disabled_reason: '2순위 개인 서사 「돌아갈 곳 없는 상인」은 추후 업데이트 예정입니다.' },
      { id: 'gift', label: '선물하기', icon: 'gift', action: 'GIVE_GIFT', enabled: true },
      { id: 'special', label: '제국 가도 소문', icon: 'special', action: 'SPECIAL_BAMBAM_RUMOR', enabled: true },
      { id: 'close', label: '닫기', icon: 'close', action: 'CLOSE', enabled: true }
    ]
  }
};

// NPC 실제 월드 좌표 조회기 (v7 기본 및 v6 롤백 모드 모두 대응)
global.FRankDays.getExpectedNpcCoords = function (server, npcId) {
  var anchor = global.FRankDays.getVillageAnchor(server);
  var list = global.FRankDays.getBrionNpcDefinitions(anchor);
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === npcId) {
      var by = (anchor.layout_version !== 6 && anchor.zone_elevations && list[i].zone && anchor.zone_elevations[list[i].zone] !== undefined)
        ? anchor.zone_elevations[list[i].zone]
        : anchor.y;
      return [anchor.x + list[i].dx, by + list[i].dy, anchor.z + list[i].dz];
    }
  }
  return null;
};

// 서버 권한 거리·차원 검증기 (클라이언트 위조 패킷으로 원거리 상점·보상 호출 방지!)
global.FRankDays.verifyPlayerNearNpc = function (player, npcId, targetEntityOpt, maxDistance) {
  var limit = maxDistance || 8.5;
  if (player.level && player.level.dimension) {
    var dimStr = String(player.level.dimension);
    if (dimStr && dimStr !== 'minecraft:overworld') {
      return { ok: false, reason: 'wrong_dimension' };
    }
  }
  if (targetEntityOpt && targetEntityOpt.x !== undefined) {
    var edx = Number(player.x || 0) - Number(targetEntityOpt.x || 0);
    var edy = Number(player.y || 0) - Number(targetEntityOpt.y || 0);
    var edz = Number(player.z || 0) - Number(targetEntityOpt.z || 0);
    var edist = Math.sqrt(edx * edx + edy * edy + edz * edz);
    return edist <= limit ? { ok: true, distance: edist } : { ok: false, reason: 'too_far_from_npc', distance: edist };
  }

  var coords = global.FRankDays.getExpectedNpcCoords(player.server, npcId);
  if (!coords) {
    return { ok: false, reason: 'npc_not_placed' };
  }
  var dx = Number(player.x || 0) - coords[0];
  var dy = Number(player.y || 0) - coords[1];
  var dz = Number(player.z || 0) - coords[2];
  var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist > limit) {
    return { ok: false, reason: 'too_far_from_npc', distance: dist };
  }
  return { ok: true, distance: dist };
};

global.FRankDays.selectNpcGreetingText = function (def, state, npcId) {
  var pq = state.personal_quests && state.personal_quests[npcId] ? state.personal_quests[npcId] : null;
  if (pq && pq.phase === 'RESOLVED' && def.greetings.resolved) {
    return def.greetings.resolved;
  }
  var rel = state.relationships[npcId];
  var aff = rel ? Number(rel.affinity || 0) : 0;
  if (aff >= 45 && def.greetings.trust) return def.greetings.trust;
  if (aff >= 20 && def.greetings.rapport) return def.greetings.rapport;
  return def.greetings.default;
};

global.FRankDays.buildNpcDialogPayload = function (player, state, npcId, overrideText, overrideButtons, pageIdx) {
  var def = global.FRankDays.NPC_DIALOG_DEFS[npcId];
  var rel = state.relationships[npcId] || { affinity: 0, stage_id: 'acquaintance' };
  var stageLabel = global.FRankDays.STAGE_KO_LABELS[rel.stage_id] || '안면';

  var bodyText = overrideText || global.FRankDays.selectNpcGreetingText(def, state, npcId);
  var buttons = [];
  var srcButtons = overrideButtons || def.buttons;
  for (var i = 0; i < srcButtons.length; i++) {
    var b = srcButtons[i];
    buttons.push({
      index: i + 1,
      id: b.id,
      label: b.label,
      icon: b.icon || 'talk',
      action: b.action,
      sub_id: b.sub_id || '',
      enabled: b.enabled !== false,
      disabled_reason: b.disabled_reason || '',
      promotion_available: Boolean(b.promotion_available),
      promotion_ready: Boolean(b.promotion_ready)
    });
  }

  return {
    npc_id: def.npc_id,
    name: def.name,
    job_grade_badge: def.job_grade_badge,
    affiliation: def.affiliation,
    subtitle: def.subtitle,
    portrait: def.portrait,
    portrait_aspect_ratio: Number(def.portrait_aspect_ratio || 0),
    job_icon: def.job_icon || 'f_rank_days:textures/gui/npc_dialog/job_guild.png',
    portrait_is_placeholder: Boolean(def.portrait_is_placeholder),
    theme: def.theme,
    affinity: Number(rel.affinity || 0),
    relationship_stage_label: stageLabel,
    dialog_text: bodyText,
    page: Number(pageIdx || 0),
    buttons: buttons
  };
};

// 서버 Painter 폴백 및 클라이언트 UI 패킷 동시 발행
global.FRankDays.pushNpcDialogToClient = function (player, payload, isUpdate) {
  var state = global.FRankDays.loadPlayerState(player);
  state.npc_dialog.active_buttons = payload.buttons || [];
  global.FRankDays.savePlayerState(player, state);
  if (typeof player.sendData === 'function') {
    player.sendData(
      isUpdate ? 'f_rank_days:update_npc_dialog_ui' : 'f_rank_days:open_npc_dialog_ui',
      payload
    );
  }
  return payload;
};

global.FRankDays.closeNpcRpgDialog = function (player, silent) {
  var state = global.FRankDays.loadPlayerState(player);
  state.npc_dialog.open = false;
  state.npc_dialog.active_npc_id = null;
  state.npc_dialog.page = 0;
  state.npc_dialog.active_buttons = [];
  global.FRankDays.savePlayerState(player, state);

  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:close_npc_dialog_ui', { silent: Boolean(silent) });
  }
  return { ok: true };
};

// [핵심] NPC 우클릭 시 호출되는 중앙 팝업형 RPG 대화창 오픈 함수
global.FRankDays.openNpcRpgDialog = function (player, npcId, options) {
  var opts = options || {};
  if (global.FRankDays.UNDETERMINED_NPCS.indexOf(npcId) !== -1) {
    return {
      ok: false,
      reason: 'npc_undetermined',
      message: '해당 NPC(' + npcId + ')는 기획 미확정 상태이므로 대화창 데이터가 잠겨 있습니다.'
    };
  }

  var def = global.FRankDays.NPC_DIALOG_DEFS[npcId];
  if (!def) {
    return { ok: false, reason: 'unknown_npc', message: '알 수 없는 NPC ID: ' + npcId };
  }

  if (!opts.bypassDistanceCheck) {
    var nearCheck = global.FRankDays.verifyPlayerNearNpc(player, npcId, opts.targetEntity, 8.5);
    if (!nearCheck.ok) {
      if (player.tell) {
        player.tell('[거리 안내] ' + def.name + '에게 조금 더 가까이 다가가 말을 걸어 주세요.');
      }
      return nearCheck;
    }
  }

  var state = global.FRankDays.loadPlayerState(player);

  if (state.guild_card.awaiting_name_input && !state.guild_card.issued) {
    return { ok: false, reason: 'guild_card_input_active', message: '길드 등록증 서명을 먼저 마치거나 입력을 취소해 주세요.' };
  }

  // 만약 v6 길드 등록증 이름 서명 대기 중이라면 충돌 방지를 위해 먼저 닫거나 안내
  if (state.guild_card.ui_open && !state.guild_card.awaiting_name_input) {
    global.FRankDays.closeGuildCardUi(player);
    state = global.FRankDays.loadPlayerState(player);
  }

  // 첫 대면 & 제4장 주민 인사 카운트 기록
  if (state.relationships[npcId] && !state.relationships[npcId].flags.first_met) {
    state.relationships[npcId].flags.first_met = true;
    if (state.relationships[npcId].relation_type === 'none') {
      state.relationships[npcId].relation_type = 'acquaintance';
    }
  }
  var q1 = state.starter_onboarding.quests.q01_first_day;
  var q2 = state.starter_onboarding.quests.q02_first_registration;
  var q4 = state.starter_onboarding.quests.q04_first_steps;

  if (npcId !== 'hess' && q4.status === 'ACTIVE') {
    if (q4.greeted_villagers.indexOf(npcId) === -1) {
      q4.greeted_villagers.push(npcId);
    }
  }

  // 헤스와 대화를 열면 길드 방문(found_guild) + 헤스 면담(talked_hess) 조건 갱신!
  if (npcId === 'hess') {
    q1.left_house = true;
    q1.reached_square = true;
    q1.found_guild = true;
    q1.talked_hess = true;
    q1.status = 'COMPLETED';
    state.starter_onboarding.guild_registration_unlocked = true;
    if (q2.status === 'LOCKED') {
      q2.status = 'ACTIVE';
      q2.explained_system = true;
    }
  }

  state.npc_dialog.open = true;
  state.npc_dialog.active_npc_id = npcId;
  state.npc_dialog.page = 0;
  state.npc_dialog.opened_at = Date.now();
  global.FRankDays.savePlayerState(player, state);

  global.FRankDays.syncFtbQuestStagesForPlayer(player);

  var payload = global.FRankDays.buildNpcDialogPayload(player, state, npcId, null, null, 0);
  global.FRankDays.pushNpcDialogToClient(player, payload, false);

  if (typeof global.FRankDays.onCompendiumNpcTalkCommittedV99 === 'function') global.FRankDays.onCompendiumNpcTalkCommittedV99(player, npcId);

  return {
    ok: true,
    npc_id: npcId,
    payload: payload
  };
};

// NPC 선물하기 처리기 (서버 아이템 검증 + 일일/쿨타임 어뷰징 방지)
global.FRankDays.processNpcGiftAction = function (player, npcId, nowEpochMs) {
  var def = global.FRankDays.NPC_DIALOG_DEFS[npcId];
  var state = global.FRankDays.loadPlayerState(player);
  var now = nowEpochMs || Date.now();
  var lastGiftAt = Number(state.npc_dialog.gift_cooldowns[npcId] || 0);

  if (now - lastGiftAt < 30000) {
    return {
      ok: false,
      reason: 'gift_cooldown',
      text: '[' + def.name + '] 방금 선물을 받았습니다. 잠시 후에 다시 마음을 전해 보세요!'
    };
  }

  var held = player.mainHandItem && player.mainHandItem.id ? String(player.mainHandItem.id) : '';
  var giftItem = null;
  var isPreferred = false;

  if (held && held !== 'minecraft:air' && held.indexOf('f_rank_days:') !== 0 && global.FRankDays.countPlayerItem(player, held) > 0) {
    giftItem = held;
    isPreferred = def.preferred_gifts.indexOf(held) !== -1;
  } else {
    for (var i = 0; i < def.preferred_gifts.length; i++) {
      var cand = def.preferred_gifts[i];
      if (global.FRankDays.countPlayerItem(player, cand) > 0) {
        giftItem = cand;
        isPreferred = true;
        break;
      }
    }
  }

  if (!giftItem) {
    return {
      ok: false,
      reason: 'no_gift_item',
      text:
        '선물할 물품을 오른손에 들거나 인벤토리에 준비해 주세요.\n· ' +
        def.name +
        ' 선호 선물: ' +
        def.preferred_gifts.join(', ')
    };
  }

  if (player.server && player.server.runCommandSilent) {
    player.server.runCommandSilent('clear ' + player.username + ' ' + giftItem + ' 1');
  }
  state.npc_dialog.gift_cooldowns[npcId] = now;
  global.FRankDays.savePlayerState(player, state);

  var gain = isPreferred ? 8 : 3;
  var affRes = global.FRankDays.addNpcAffinity(player, npcId, gain);
  return {
    ok: true,
    gifted_item: giftItem,
    affinity_gain: gain,
    affinity: affRes.affinity,
    text: isPreferred
      ? '[' + def.name + '] 선호하는 선물(' + giftItem + ')을 건넸습니다! 반가운 기색이 역력합니다. (호감도 +' + gain + ' → ' + affRes.affinity + ')'
      : '[' + def.name + '] 소박한 선물(' + giftItem + ')을 건넸습니다. 고맙게 받아 둡니다. (호감도 +' + gain + ' → ' + affRes.affinity + ')'
  };
};

// [핵심] 클라이언트 버튼 클릭 패킷 검증 및 액션 실행 라우터
global.FRankDays.handleNpcDialogAction = function (player, reqData, options) {
  var opts = options || {};
  var data = reqData || {};
  var state = global.FRankDays.loadPlayerState(player);
  var npcId = String(data.npc_id || state.npc_dialog.active_npc_id || '');
  var action = String(data.action || '');
  var subId = String(data.sub_id || '');

  if (action === 'CLOSE') {
    return global.FRankDays.closeNpcRpgDialog(player, false);
  }

  var def = global.FRankDays.NPC_DIALOG_DEFS[npcId];
  if (!def) {
    return { ok: false, reason: 'invalid_npc' };
  }

  // A client may only select a button from its current server-issued menu.
  // The explicit bypass is reserved for server-side tests/admin calls.
  if (!opts.bypassDistanceCheck) {
    if (!state.npc_dialog.open || state.npc_dialog.active_npc_id !== npcId) {
      return { ok: false, reason: 'dialog_not_active' };
    }
    var offeredButtons = state.npc_dialog.active_buttons || def.buttons;
    var selectedButton = null;
    var requestedId = String(data.button_id || '');
    for (var offeredIndex = 0; offeredIndex < offeredButtons.length; offeredIndex++) {
      var offered = offeredButtons[offeredIndex];
      if (requestedId ? String(offered.id) === requestedId : offered.action === action && String(offered.sub_id || '') === subId) {
        selectedButton = offered;
        break;
      }
    }
    if (!selectedButton) return { ok: false, reason: 'button_not_offered' };
    action = selectedButton.enabled === false ? 'DISABLED_INFO' : selectedButton.action;
    subId = String(selectedButton.sub_id || '');
  }

  // 서버 측 거리 재검증 (원격 패킷 변조 차단!)
  if (!opts.bypassDistanceCheck) {
    var near = global.FRankDays.verifyPlayerNearNpc(player, npcId, null, 9.0);
    if (!near.ok) {
      global.FRankDays.closeNpcRpgDialog(player, false);
      return near;
    }
  }

  var replyText = '';
  var customButtons = null;

  if (action === 'V93_JOB_WORK_MENU' || action === 'V93_MID_GATE' || action === 'V93_MID_STATUS' || action === 'V93_MID_BOOK' || action === 'V93_MID_CLAIM') {
    // Existing session, offered-button and distance validation above also protects new actions.
    var midReply = global.FRankDays.handleMidTierDialogV93(player, npcId, action, subId);
    replyText = midReply.message;
    customButtons = midReply.buttons || null;
    if (midReply.transitioned) return midReply;
  } else if (action === 'DISABLED_INFO') {
    replyText = '[안내] 아직 개방되지 않은 콘텐츠입니다. 현재 구현된 대화·상점·직무 훈련을 이용해 주세요.';
  } else if (action === 'BACK_MAIN') {
    state.npc_dialog.page = 0;
    global.FRankDays.savePlayerState(player, state);
    replyText = global.FRankDays.selectNpcGreetingText(def, state, npcId);
  } else if (action === 'TALK') {
    var pages = def.talk_pages || [global.FRankDays.selectNpcGreetingText(def, state, npcId)];
    var nextIdx = Number(state.npc_dialog.page || 0);
    replyText = pages[nextIdx % pages.length];
    state.npc_dialog.page = (nextIdx + 1) % pages.length;
    global.FRankDays.savePlayerState(player, state);
    // 첫 일상 대화 보너스(NPC별 1회만 +2 호감도, 무한 클릭 어뷰징 차단)
    var dailyTalkKey = 'first_dialog_talk_' + npcId;
    if (!state.reward_ledger[dailyTalkKey]) {
      state.reward_ledger[dailyTalkKey] = true;
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.addNpcAffinity(player, npcId, 2);
      state = global.FRankDays.loadPlayerState(player);
    }
  } else if (action === 'GIVE_GIFT') {
    var gRes = global.FRankDays.processNpcGiftAction(player, npcId, opts.nowEpochMs);
    state = global.FRankDays.loadPlayerState(player);
    replyText = gRes.text;
  } else if (action === 'OPEN_SHOP') {
    if (!def.shop_items || def.shop_items.length === 0) {
      replyText = '현재 판매 중인 물품이 없습니다.';
    } else {
      var emHave = global.FRankDays.countPlayerItem(player, 'minecraft:emerald');
      replyText = '[' + def.name + ' 상점 · 보유 에메랄드: ' + emHave + '개]\n원하는 거래 항목을 아래 버튼에서 선택하세요.';
      customButtons = [];
      for (var s = 0; s < def.shop_items.length && customButtons.length < 5; s++) {
        var si = def.shop_items[s];
        customButtons.push({
          id: si.id,
          label: si.label,
          icon: 'shop',
          action: 'BUY_SHOP_ITEM',
          sub_id: si.id,
          enabled: true
        });
      }
      customButtons.push({ id: 'back', label: '돌아가기', icon: 'close', action: 'BACK_MAIN', enabled: true });
    }
  } else if (action === 'BUY_SHOP_ITEM') {
    var foundItem = null;
    for (var k = 0; k < (def.shop_items || []).length; k++) {
      if (def.shop_items[k].id === subId) {
        foundItem = def.shop_items[k];
        break;
      }
    }
    if (!foundItem) {
      replyText = '유효하지 않은 상점 품목입니다.';
    } else if (foundItem.sell_mode && npcId === 'darim') {
      var sellRes = global.FRankDays.interactWithBrionNpc(player, 'darim', 'sell_wheat');
      state = global.FRankDays.loadPlayerState(player);
      replyText = sellRes.message;
    } else if (foundItem.meal_mode && npcId === 'gori') {
      var mealRes = global.FRankDays.interactWithBrionNpc(player, 'gori', 'meal');
      state = global.FRankDays.loadPlayerState(player);
      replyText = mealRes.message;
    } else {
      var haveCost = global.FRankDays.countPlayerItem(player, foundItem.cost_item);
      if (haveCost < foundItem.cost_count) {
        replyText = '[' + def.name + '] 거래에 필요한 에메랄드가 부족합니다! (필요: ' + foundItem.cost_count + '개 / 보유: ' + haveCost + '개)';
      } else {
        if (player.server && player.server.runCommandSilent) {
          player.server.runCommandSilent('clear ' + player.username + ' ' + foundItem.cost_item + ' ' + foundItem.cost_count);
        }
        if (player.give) {
          if (foundItem.give_potion && typeof Item !== 'undefined' && Item.of) {
            player.give(Item.of('minecraft:potion', '{Potion:"' + foundItem.give_potion + '"}'));
          } else if (foundItem.give_item) {
            player.give(foundItem.give_item);
          }
        }
        replyText = '[' + def.name + '] 「' + foundItem.label + '」 구매가 완료되었습니다!';
      }
    }
  } else if (action === 'QUEST_ACTION') {
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    if (npcId === 'roman') {
      var pqR = state.personal_quests.roman;
      if (state.relationships.roman.affinity >= 60 && pqR.phase === 'NOT_STARTED') {
        var rPq = global.FRankDays.handleTier1PersonalQuest(player, 'roman', 'start');
        replyText = rPq.message;
      } else {
        var herbRes = global.FRankDays.interactWithBrionNpc(player, 'roman', 'herb_quest');
        replyText = herbRes.message;
      }
    } else if (npcId === 'darim') {
      var pqD = state.personal_quests.darim;
      if (state.relationships.darim.affinity >= 60 && pqD.phase === 'NOT_STARTED') {
        var dPq = global.FRankDays.handleTier1PersonalQuest(player, 'darim', 'start');
        replyText = dPq.message;
      } else {
        replyText =
          '[다림의 농사 의뢰]\n· 다림의 밭에서 밀 8다발을 수확해 [농작물 구매 → 밀 8개 납품]을 선택하면 에메랄드 1개와 호감도를 얻을 수 있습니다!';
      }
    } else if (npcId === 'hess') {
      var pqH = state.personal_quests.hess;
      if (state.relationships.hess.affinity >= 60 && pqH.phase === 'NOT_STARTED') {
        var hPq = global.FRankDays.handleTier1PersonalQuest(player, 'hess', 'start');
        replyText = hPq.message;
      } else {
        replyText = global.FRankDays.getQuestSummaryText(player) + '\n(※ FTB Quests 진행 상태가 서버 원부와 재동기화되었습니다.)';
      }
    } else if (npcId === 'nau') {
      replyText = '[나우] "오늘은 급한 단조 주문이 없구먼. 연장 날이나 잘 갈아 두라고."';
    } else if (npcId === 'gori') {
      var greetedCnt = state.starter_onboarding.quests.q04_first_steps.greeted_villagers.length;
      replyText = '[고리] "브리온 마을 이웃들과 인사를 나누어 보셨나요? (현재 인사 나눈 주민: ' + greetedCnt + '명 / 3명 달성 시 제4장 퀘스트 완료!)"';
    } else if (npcId === 'hwiyeon') {
      var careRes = global.FRankDays.performHealerPracticeCare(player);
      replyText = careRes.message;
    }
    state = global.FRankDays.loadPlayerState(player);
  } else if (action === 'SPECIAL_GUILD_WORK' && npcId === 'hess') {
    // 헤스 [길드 업무]: 아직 길드 등록증 미발급 & 능력·첫 직업 완료 시 -> 대화창을 닫고 즉시 v6 길드 등록증 UI 오픈!
    if (!state.special_ability.ability_id || !global.FRankDays.resolvePrimaryRegisteredJob(state)) {
      replyText =
        '[헤스] "《길드 등록증》을 발급받으시려면 먼저 [직업 등록] 버튼에서 ① F급 특수 능력과 ② 최초 직업을 차례로 선택해 주십시오."';
    } else if (!state.guild_card.issued) {
      global.FRankDays.closeNpcRpgDialog(player, true);
      var openCardRes = global.FRankDays.openGuildRegistrationUi(player, 'INPUT');
      return { ok: openCardRes.ok, transitioned_to_guild_card_ui: true, card_ui: openCardRes };
    } else {
      var workRes = global.FRankDays.interactWithBrionNpc(player, 'hess', 'help_paperwork');
      state = global.FRankDays.loadPlayerState(player);
      replyText = workRes.message + '\n(발급된 길드 등록증 열람: 인벤토리의 등록증 우클릭 또는 /frank card)';
    }
  } else if (action === 'OPEN_JOB_MENU' && npcId === 'hess') {
    if (!state.special_ability.ability_id) {
      replyText = '[1단계: F급 고유 능력 선택]\n평생 함께할 소소한 F급 특성 하나를 선택해 주세요 (특정 직업이나 연애를 제한하지 않습니다):';
      customButtons = [
        { id: 'ab_seed', label: '흙내음 감각', icon: 'special', action: 'PICK_ABILITY', sub_id: 'seed_sense', enabled: true },
        { id: 'ab_breath', label: '고른 호흡', icon: 'special', action: 'PICK_ABILITY', sub_id: 'steady_breath', enabled: true },
        { id: 'ab_keen', label: '잔금 읽기', icon: 'special', action: 'PICK_ABILITY', sub_id: 'keen_appraisal', enabled: true },
        { id: 'ab_warm', label: '따뜻한 손바닥', icon: 'special', action: 'PICK_ABILITY', sub_id: 'warm_palm', enabled: true },
        { id: 'back', label: '돌아가기', icon: 'close', action: 'BACK_MAIN', enabled: true }
      ];
    } else {
      replyText = '[직업 F급 자격 등록]\n원하는 직업을 선택해 F급으로 등록하세요 (복수 직업 자유 등록 가능):';
      customButtons = [
        { id: 'jb_farm', label: '농부 (' + state.job_licenses.farmer.grade + ')', icon: 'shop', action: 'PICK_JOB', sub_id: 'farmer', enabled: state.job_licenses.farmer.grade === 'UNREGISTERED' },
        { id: 'jb_sword', label: '검사 (' + state.job_licenses.swordsman.grade + ')', icon: 'shop', action: 'PICK_JOB', sub_id: 'swordsman', enabled: state.job_licenses.swordsman.grade === 'UNREGISTERED' },
        { id: 'jb_alch', label: '연금술사 (' + state.job_licenses.alchemist.grade + ')', icon: 'shop', action: 'PICK_JOB', sub_id: 'alchemist', enabled: state.job_licenses.alchemist.grade === 'UNREGISTERED' },
        { id: 'jb_smith', label: '대장장이 (' + state.job_licenses.blacksmith.grade + ')', icon: 'shop', action: 'PICK_JOB', sub_id: 'blacksmith', enabled: state.job_licenses.blacksmith.grade === 'UNREGISTERED' },
        { id: 'jb_heal', label: '힐러 (' + state.job_licenses.healer.grade + ')', icon: 'shop', action: 'PICK_JOB', sub_id: 'healer', enabled: state.job_licenses.healer.grade === 'UNREGISTERED' },
        { id: 'jb_relic', label: '유물연구 (' + state.job_licenses.relic_researcher.grade + ')', icon: 'shop', action: 'PICK_JOB', sub_id: 'relic_researcher', enabled: state.job_licenses.relic_researcher.grade === 'UNREGISTERED' }
      ];
    }
  } else if (action === 'PICK_ABILITY' && npcId === 'hess') {
    var abRes = global.FRankDays.selectStarterAbility(player, subId);
    state = global.FRankDays.loadPlayerState(player);
    // 능력을 선택했는데 아직 첫 직업이 없다면 바로 첫 직업 선택 버튼으로 안내!
    if (abRes.ok && !global.FRankDays.resolvePrimaryRegisteredJob(state)) {
      replyText = abRes.message + '\n▶ 이어서 최초 직업을 아래에서 선택해 주세요!';
      customButtons = [
        { id: 'jb_farm', label: '농부 등록', icon: 'shop', action: 'PICK_JOB', sub_id: 'farmer', enabled: true },
        { id: 'jb_sword', label: '검사 등록', icon: 'shop', action: 'PICK_JOB', sub_id: 'swordsman', enabled: true },
        { id: 'jb_alch', label: '연금술사 등록', icon: 'shop', action: 'PICK_JOB', sub_id: 'alchemist', enabled: true },
        { id: 'jb_smith', label: '대장장이 등록', icon: 'shop', action: 'PICK_JOB', sub_id: 'blacksmith', enabled: true },
        { id: 'jb_heal', label: '힐러 등록', icon: 'shop', action: 'PICK_JOB', sub_id: 'healer', enabled: true },
        { id: 'jb_relic', label: '유물 연구자 등록', icon: 'shop', action: 'PICK_JOB', sub_id: 'relic_researcher', enabled: true }
      ];
    } else {
      replyText = abRes.message;
    }
  } else if (action === 'PICK_JOB' && npcId === 'hess') {
    var wasCardIssued = Boolean(state.guild_card.issued);
    // registerJobF 내부에서 미발급 상태면 openGuildRegistrationUi('INPUT')가 자동 호출되며,
    // openGuildRegistrationUi가 closeNpcRpgDialog를 먼저 실행해 두 UI가 절대 겹치지 않음!
    var jobRes = global.FRankDays.registerJobF(player, subId);
    state = global.FRankDays.loadPlayerState(player);
    if (!wasCardIssued && state.guild_card.ui_open) {
      return { ok: jobRes.ok, transitioned_to_guild_card_ui: true, job_result: jobRes };
    }
    replyText = jobRes.message;
  } else if (action === 'OPEN_EXAM_MENU' && npcId === 'hess') {
    replyText = '[승급 시험] 등록한 직종의 담당 스승을 찾아 상단 [5. 승급 시험]에서 무료 실기 심사를 받으세요.';
  } else if (action === 'RUN_JOB_TRAINING') {
    replyText = global.FRankDays.completeJobBasicTraining(player, subId).message;
  } else if (action === 'RUN_EXAM_START' || action === 'RUN_EXAM_EVAL') {
    return global.FRankDays.openPromotionExamScreenV106(player, npcId, subId);
  } else if (action === 'SPECIAL_FARMING_LESSON' && npcId === 'darim') {
    var ori = global.FRankDays.completeDarimOrientation(player);
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    state = global.FRankDays.loadPlayerState(player);
    replyText = ori.message;
  } else if (action === 'SPECIAL_ALCHEMIST_INTRO' && npcId === 'roman') {
    replyText = global.FRankDays.completeJobBasicTraining(player, 'alchemist').message;
    state = global.FRankDays.loadPlayerState(player);
  } else if (action === 'SPECIAL_NAU_REPAIR' && npcId === 'nau') {
    replyText = global.FRankDays.interactWithBrionNpc(player, 'nau', 'repair').message;
    state = global.FRankDays.loadPlayerState(player);
  } else if (action === 'SPECIAL_GORI_ROOM' && npcId === 'gori') {
    replyText = '[고리] "2층 객실 침대는 무료로 개방되어 있어요! 계단을 올라가 침대를 우클릭하시면 개인 리스폰 지점으로 지정하실 수 있답니다."';
  } else if (action === 'SPECIAL_HWIYEON_HEAL' && npcId === 'hwiyeon') {
    replyText = global.FRankDays.interactWithBrionNpc(player, 'hwiyeon', 'heal').message;
    state = global.FRankDays.loadPlayerState(player);
  } else if (action === 'SPECIAL_SKI_TRAINING' && npcId === 'ski') {
    replyText = global.FRankDays.completeJobBasicTraining(player, 'swordsman').message;
    state = global.FRankDays.loadPlayerState(player);
  } else if (action === 'SPECIAL_HYEOPHAP_TRAINING' && npcId === 'hyeophap') {
    replyText = global.FRankDays.completeJobBasicTraining(player, 'relic_researcher').message;
    state = global.FRankDays.loadPlayerState(player);
  } else if (action === 'SPECIAL_BAMBAM_RUMOR' && npcId === 'bambam') {
    replyText = '[밤밤] "동쪽 상업 도시 벨마르에서는 최근 세르딘 숲 약초와 정제 광석 시세가 오르고 있대요. 장인이나 상인을 꿈꾸신다면 좋은 기회일 거예요!"';
  } else {
    replyText = global.FRankDays.selectNpcGreetingText(def, state, npcId);
  }

  var updatedPayload = global.FRankDays.buildNpcDialogPayload(
    player,
    state,
    npcId,
    replyText,
    customButtons,
    state.npc_dialog.page
  );
  global.FRankDays.pushNpcDialogToClient(player, updatedPayload, true);

  return {
    ok: true,
    npc_id: npcId,
    action: action,
    payload: updatedPayload
  };
};

// 채팅창 숫자 1~6 입력 시 해당 버튼 실행 보조 단축키
global.FRankDays.handleNpcDialogChatShortcut = function (player, trimmedMsg) {
  var state = global.FRankDays.loadPlayerState(player);
  if (!state.npc_dialog || !state.npc_dialog.open || !state.npc_dialog.active_npc_id) return false;
  var npcId = state.npc_dialog.active_npc_id;
  var def = global.FRankDays.NPC_DIALOG_DEFS[npcId];
  if (!def) return false;

  if (trimmedMsg === '닫기' || trimmedMsg.toLowerCase() === 'close') {
    global.FRankDays.closeNpcRpgDialog(player, false);
    return true;
  }

  if (!/^[1-6]$/.test(trimmedMsg)) return false;
  var buttons = state.npc_dialog.active_buttons || def.buttons;
  var idx = parseInt(trimmedMsg, 10);
  if (idx >= 1 && idx <= buttons.length) {
    var btn = buttons[idx - 1];
    if (btn) {
      global.FRankDays.handleNpcDialogAction(player, {
        npc_id: npcId,
        button_id: btn.id,
        action: btn.enabled === false ? 'DISABLED_INFO' : btn.action,
        sub_id: btn.sub_id || ''
      });
      return true;
    }
  }
  return false;
};

// 클라이언트 패킷 수신 리스너 등록
if (typeof NetworkEvents !== 'undefined' && NetworkEvents.dataReceived) {
  NetworkEvents.dataReceived('f_rank_days:npc_dialog_action', function (event) {
    if (!event.player) return;
    global.FRankDays.handleNpcDialogAction(event.player, event.data || {});
  });

  NetworkEvents.dataReceived('f_rank_days:close_npc_dialog_ui', function (event) {
    if (!event.player) return;
    global.FRankDays.closeNpcRpgDialog(event.player, true);
  });
}

// v10.6: independent promotion Screen protocol. This is a server-owned session;
// a packet can select only a registered job taught by this nearby mentor.
(function (F) {
  var sessions = {};
  function key(player) { return String(player.uuid || player.username); }
  function failure(reason, message) { return {ok:false,reason:reason,message:message||'승급 심사 기록을 다시 확인해 주세요.'}; }
  function validView(player, npcId, jobId) {
    if (typeof F.getPromotionExamViewV106 !== 'function') return failure('exam_not_loaded');
    var near = F.verifyPlayerNearNpc(player,npcId,null,9);
    if (!near.ok) return near;
    return F.getPromotionExamViewV106(player,npcId,jobId||'');
  }
  function push(player, session, view, initial, message) {
    session.jobId = String(view.selectedJob||'');
    session.nextGrade = String(view.nextGrade||'');
    session.lastSeen = Date.now();
    var data = {npc_id:session.npcId,view_json:JSON.stringify(view),message:String(message||view.message||'')};
    if (player.sendData) player.sendData('f_rank_days:'+(initial?'open':'update')+'_promotion_exam_ui',data);
    return {ok:true,transitioned_to_promotion_exam_ui:true,view:view};
  }
  F.closePromotionExamScreenV106 = function (player, notify) {
    delete sessions[key(player)];
    if (notify && player.sendData) player.sendData('f_rank_days:close_promotion_exam_ui',{});
    return {ok:true};
  };
  F.openPromotionExamScreenV106 = function (player,npcId,jobId) {
    var view = validView(player,String(npcId||''),jobId);
    if (!view || view.ok===false) return view||failure('invalid_exam_view');
    if (!view.selectedJob) return failure('unregistered_mentor_job',view.message);
    // Close the ordinary dialog before issuing the distinct Screen packet.
    F.closeNpcRpgDialog(player,true);
    var session = {npcId:String(npcId),jobId:String(view.selectedJob||''),lastSeen:Date.now()};
    sessions[key(player)] = session;
    return push(player,session,view,true);
  };
  F.handlePromotionExamPacketV106 = function (player,data) {
    data=data||{};
    var session=sessions[key(player)],npcId=String(data.npc_id||''),action=String(data.action||''),jobId=String(data.job_id||'');
    if (!session || session.npcId!==npcId) return failure('promotion_screen_not_active');
    if (action==='close') return F.closePromotionExamScreenV106(player,false);
    var view=validView(player,npcId,jobId||session.jobId);
    if (!view || view.ok===false) { F.closePromotionExamScreenV106(player,true); return view||failure('invalid_exam_view'); }
    var registered=view.registeredMentorJobs||[],offered=false;
    for(var i=0;i<registered.length;i++) if(String(registered[i].id)===jobId) offered=true;
    if (!offered) return failure('job_not_offered');
    // Selection and refresh never start an exam or grant a reward.
    if (action==='select'||action==='refresh') return push(player,session,view,false);
    if (action!=='start'&&action!=='claim'&&action!=='navigate'&&action!=='pin') return failure('unknown_exam_action');
    if (jobId!==session.jobId) return failure('job_not_selected');
    var expectedGrade=String(data.expected_grade||'');
    if ((action==='start'||action==='claim'||action==='pin')&&(!expectedGrade||expectedGrade!==session.nextGrade||expectedGrade!==String(view.nextGrade||''))) {
      push(player,session,view,false,'단계가 갱신되었습니다. 현재 등급의 심사 버튼을 다시 확인해 주세요.');
      return failure('stale_exam_grade');
    }
    var result=F.handlePromotionExamActionV106(player,npcId,action,jobId,expectedGrade);
    var fresh=validView(player,npcId,jobId);
    if (fresh&&fresh.ok!==false) push(player,session,fresh,false,result&&result.message);
    else F.closePromotionExamScreenV106(player,true);
    return result;
  };
  F.getPromotionDialogButtonV106 = function (player,npcId) {
    var button={id:'promotion_exam',label:'승급 시험',icon:'special',action:'OPEN_PROMOTION_EXAM',sub_id:'',enabled:false,disabled_reason:'헤스에게 직종을 등록한 뒤 담당 스승을 찾아가세요.',promotion_available:false,promotion_ready:false};
    if(typeof F.getPromotionExamViewV106!=='function')return button;
    var view=F.getPromotionExamViewV106(player,npcId,''),jobs=view&&view.registeredMentorJobs||[];
    if(!jobs.length)return button;
    button.enabled=true;button.disabled_reason='';button.promotion_available=true;button.sub_id=String(jobs[0].id);
    for(var i=0;i<jobs.length;i++){var candidate=F.getPromotionExamViewV106(player,npcId,jobs[i].id);if(candidate&&candidate.status==='ready'){button.promotion_ready=true;button.sub_id=String(jobs[i].id);break;}}
    return button;
  };
  F.PROMOTION_SCREEN_PROTOCOL_V106={width:320,height:204,modalId:'JOB_PROMOTION_EXAM',channel:'f_rank_days:promotion_exam_action'};
  if(typeof NetworkEvents!=='undefined'&&NetworkEvents.dataReceived) NetworkEvents.dataReceived('f_rank_days:promotion_exam_action',function(event){if(event.player)F.handlePromotionExamPacketV106(event.player,event.data||{});});
  if(typeof PlayerEvents!=='undefined'&&PlayerEvents.loggedOut) PlayerEvents.loggedOut(function(event){if(event.player)F.closePromotionExamScreenV106(event.player,false);});
})(global.FRankDays);
