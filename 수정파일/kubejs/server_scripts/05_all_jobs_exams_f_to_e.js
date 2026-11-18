// 《F급의 나날》 KubeJS 6 Server Script - Remaining 5 Core Jobs F -> E Promotion Exams
// 파일 경로: kubejs/server_scripts/05_all_jobs_exams_f_to_e.js
// 구현 대상: 검사(swordsman), 연금술사(alchemist), 대장장이(blacksmith), 힐러(healer), 유물 연구자(relic_researcher)
// (농부 farmer F->E 시험은 기존 02_farmer_exam_f_to_e.js를 그대로 보존하며 통합 API로도 호출 가능하게 연결)
// 핵심 원칙:
// 1. 모든 직업은 3단계 구조(응시 자격 확인 -> 필기 3문항[2/3 합격, 오답 해설] + 실제 인게임 행동/아이템 실기 -> E급 자격증 발급)를 따름
// 2. 시험 응시료·재응시료 0 에메랄드, 재응시 대기시간 30초, 미달 항목 구체 안내
// 3. NPC 본인의 등급과 공인 시험 감독 권한 분리 원칙 준수 (브리온 지부는 위임받은 F->E 견습 검수만 진행)

global.FRankDays = global.FRankDays || {};

global.FRankDays.JOB_EXAMS_F_TO_E = {
  swordsman: {
    exam_id: 'swordsman_f_to_e',
    label: '검사',
    serial_prefix: 'ARB-SWRD-E-',
    license_item: 'f_rank_days:swordsman_license_e',
    training_guide: '통합 길드 기초 안전·검술 브리핑 이수 (/frank training swordsman)',
    questions: [
      {
        qid: 'q1_spacing',
        prompt: '[검사 필기 1] 근접 전투에서 검을 한 번 휘두른 직후 가장 올바른 기본 전술 행동은 무엇입니까?',
        choices: {
          '1': '공격 속도가 차오르기 전에 눈을 감고 무작정 연타한다',
          '2': '무기 공격 회복 간격(쿨타임)과 상대의 사거리를 보며 반걸음 거리를 조절한다',
          '3': '검을 버리고 맨손으로 적에게 뛰어든다'
        },
        answer: '2',
        explanation: '검 공격 직후에는 재정비 간격이 존재하므로 무작정 연타하기보다 적과의 간격을 조절해야 유효타와 생존율을 높일 수 있습니다.'
      },
      {
        qid: 'q2_defense',
        prompt: '[검사 필기 2] 화살이나 마물의 돌진을 마주했을 때 방패(Shield) 운용법으로 올바른 것은 무엇입니까?',
        choices: {
          '1': '적의 공격이 닿기 직전 방패를 들어 정면 충격을 막아 내고 빈틈을 노린다',
          '2': '등을 돌린 채 달리기만 하면 방패가 뒤통수를 자동으로 막아 준다',
          '3': '방패는 장식품이므로 인벤토리 깊숙한 곳에만 넣어 둔다'
        },
        answer: '1',
        explanation: '방패는 시선 정면 방향의 물리·투사체 공격을 막아 주므로 공격 타이밍에 맞춰 정면 방어 자세를 취해야 합니다.'
      },
      {
        qid: 'q3_safety_retreat',
        prompt: '[검사 필기 3] 초보(F~E급) 검사가 외곽 순찰 중 지정 등급을 초과한 중급 마물 군락을 발견했을 때 지켜야 할 길드 수칙은?',
        choices: {
          '1': '자존심을 걸고 혼자 돌격해 끝까지 싸운다',
          '2': '표지판을 부수고 아무에게도 알리지 않는다',
          '3': '즉시 안전 거리로 퇴각한 뒤 출몰 위치와 개체 수를 통합 길드에 보고한다'
        },
        answer: '3',
        explanation: '무리한 교전으로 목숨을 잃지 않고 퇴각하여 위험 구역을 길드에 공유하는 것이 공인 검사의 제1 안전 수칙입니다.'
      }
    ],
    practical_desc: '적대적 마물 5마리 직접 토벌 + 검(목검·돌검·철검 등 아무 검 1자루) 소지 확인 (소모 없음)',
    rewards: [
      'minecraft:iron_sword',
      'minecraft:shield',
      '4x minecraft:cooked_beef'
    ]
  },

  alchemist: {
    exam_id: 'alchemist_f_to_e',
    label: '연금술사',
    serial_prefix: 'ARB-ALCH-E-',
    license_item: 'f_rank_days:alchemist_license_e',
    training_guide: '로만의 약초 채집 의뢰 완수 또는 기초 연금 안전 교육 이수 (/frank training alchemist)',
    questions: [
      {
        qid: 'q1_base_reagent',
        prompt: '[연금술사 필기 1] 양조기에서 대부분의 기능성 물약을 조제하기 위해 물병에 가장 먼저 우려내는 기초 매개 재료는?',
        choices: {
          '1': '네더 사마귀(Nether Wart)를 우려낸 기묘한 물약(Awkward Potion)',
          '2': '흙 블록을 그대로 넣은 흙탕물',
          '3': '조약돌 가루'
        },
        answer: '1',
        explanation: '일반 물병에 네더 사마귀를 증류해 기묘한 물약 베이스를 만드는 것이 표준 포션 연금의 기본 공정입니다.'
      },
      {
        qid: 'q2_herb_prep',
        prompt: '[연금술사 필기 2] 세르딘 숲에서 채집한 야생 약초를 추출기에 넣기 전 반드시 거쳐야 하는 전처리 과정은?',
        choices: {
          '1': '뿌리에 묻은 진흙과 벌레 알을 그대로 함께 끓인다',
          '2': '용암에 던져 재로 만든다',
          '3': '뿌리 손상을 최소화해 이물질과 흙을 털어 내고 시든 잎을 골라낸다'
        },
        answer: '3',
        explanation: '흙과 이물질이 섞이면 불순물 침전으로 약효가 변질되므로 세척·선별 전처리가 필수입니다.'
      },
      {
        qid: 'q3_storage',
        prompt: '[연금술사 필기 3] 완성된 회복·보조 물약을 변질 없이 보관하는 올바른 방법은 무엇입니까?',
        choices: {
          '1': '화로 바로 위 뜨거운 열기 속에 열어 둔다',
          '2': '마개를 밀봉하여 직사광선과 급격한 열원을 피한 서늘한 약재함에 보관한다',
          '3': '빗물이 들어오도록 뚜껑을 빼고 마당에 둔다'
        },
        answer: '2',
        explanation: '열과 직사광선은 연금 시약의 결합을 무너뜨리므로 밀봉·차광 보관이 기본입니다.'
      }
    ],
    practical_desc: '야생 약초·꽃 4송이 직접 채집 + 물약(minecraft:potion) 1병 및 유리병(minecraft:glass_bottle) 2개 제출',
    rewards: [
      'minecraft:brewing_stand',
      '4x minecraft:glass_bottle',
      '2x minecraft:emerald'
    ]
  },

  blacksmith: {
    exam_id: 'blacksmith_f_to_e',
    label: '대장장이',
    serial_prefix: 'ARB-BLKS-E-',
    license_item: 'f_rank_days:blacksmith_license_e',
    training_guide: '나우의 대장간 장비 수리 실습 또는 단조 안전 교육 이수 (/frank training blacksmith)',
    questions: [
      {
        qid: 'q1_smelting',
        prompt: '[대장장이 필기 1] 채광한 철 원석(Raw Iron)을 단조용 철 주괴로 제련할 때 알맞은 설비는 무엇입니까?',
        choices: {
          '1': '나무 상자 안에 넣고 기다린다',
          '2': '화로(Furnace) 또는 용광로(Blast Furnace)에서 연료를 때워 일정한 고열로 제련한다',
          '3': '우물물에 하루 동안 담가 둔다'
        },
        answer: '2',
        explanation: '원석은 화로나 용광로의 고열 제련을 거쳐야 불순물이 제거된 단조용 금속 주괴가 됩니다.'
      },
      {
        qid: 'q2_anvil_care',
        prompt: '[대장장이 필기 2] 모루(Anvil)에서 도구를 수리할 때 주의해야 할 점으로 옳은 것은?',
        choices: {
          '1': '모루는 영원히 금이 가지 않으므로 아무 돌이나 내려친다',
          '2': '부러진 도구 자루를 맨손으로 때린다',
          '3': '모루 자체의 균열 상태와 장비의 누적 수리 피로도를 함께 점검하며 적절한 보수 재료를 쓴다'
        },
        answer: '3',
        explanation: '모루와 장비 모두 반복 가공에 따른 피로도가 쌓이므로 재료 호환성과 모루 균열 상태를 항상 확인해야 합니다.'
      },
      {
        qid: 'q3_forge_safety',
        prompt: '[대장장이 필기 3] 대장간 화덕과 담금질 수조 주변에서 반드시 지켜야 할 기본 안전 수칙은?',
        choices: {
          '1': '불티와 뜨거운 증기에 화상을 입지 않도록 보호 장구를 갖추고 작업 반경을 확보한다',
          '2': '달궈진 쇠를 마른 짚더미 위에 올려둔다',
          '3': '환기를 완전히 막고 연기를 마신다'
        },
        answer: '1',
        explanation: '단조 불티와 담금질 수증기는 큰 화상을 유발하므로 작업 거리 확보와 화재 예방이 필수입니다.'
      }
    ],
    practical_desc: '광석·암석 6회 직접 채광 + 철 주괴(minecraft:iron_ingot) 4개 납품 및 철제 도구·무기 1종 소지 확인(도구는 소모 안 됨)',
    rewards: [
      '4x minecraft:iron_ingot',
      '8x minecraft:coal',
      '2x minecraft:emerald'
    ]
  },

  healer: {
    exam_id: 'healer_f_to_e',
    label: '힐러',
    serial_prefix: 'ARB-HEAL-E-',
    license_item: 'f_rank_days:healer_license_e',
    training_guide: '휘연 의료소 응급 처치 견학 또는 기초 의료 윤리 교육 이수 (/frank training healer)',
    questions: [
      {
        qid: 'q1_triage',
        prompt: '[힐러 필기 1] 다수의 부상자가 동시에 의료소에 이송되었을 때 가장 먼저 수행해야 하는 절차는?',
        choices: {
          '1': '호흡·출혈 등 생명 위급도에 따라 환자를 분류(트리아지)하여 중증 응급 환자와 외상 처치 대상을 나눈다',
          '2': '목소리가 가장 큰 경미한 찰과상 환자부터 전력을 다해 고위 마법을 쓴다',
          '3': '아무 기록 없이 무작위로 약초를 먹인다'
        },
        answer: '1',
        explanation: '제한된 시간과 마력 안에서 생명을 구하려면 위급도 분류(트리아지)가 모든 치유 활동의 출발점입니다.'
      },
      {
        qid: 'q2_caster_limit',
        prompt: '[힐러 필기 2] 치유사가 자신의 마력 한계를 넘어 무리하게 고위 치유를 반복할 때 발생하는 위험에 대한 올바른 대처는?',
        choices: {
          '1': '치유사는 쓰러져도 상관없으므로 무조건 혼자 모든 마력을 소진한다',
          '2': '마력 과부하 후유증을 예방하기 위해 경증은 붕대·연금 회복약과 병행하고 치유사의 안정 상태를 유지한다',
          '3': '환자에게 치유 마법 대신 독약을 쓴다'
        },
        answer: '2',
        explanation: '치유사가 과부하로 쓰러지면 남은 환자까지 위험해지므로 외과 붕대·물약 분업과 컨디션 관리가 필수입니다.'
      },
      {
        qid: 'q3_first_aid',
        prompt: '[힐러 필기 3] 숲에서 외상을 입은 환자를 이송하기 전 현장에서 우선해야 할 기초 처치는?',
        choices: {
          '1': '상처에 흙을 문지른다',
          '2': '골절 부위를 억지로 흔들어 본다',
          '3': '깨끗한 붕대(양털 거즈)로 압박 지혈하고 체온과 수분을 안정시킨다'
        },
        answer: '3',
        explanation: '깨끗한 거즈·붕대를 이용한 지혈과 체온 유지가 이송 중 2차 악화를 막는 핵심 응급 처치입니다.'
      }
    ],
    practical_desc: '응급 처치 실습 3회 수행(/frank practice_heal) + 깨끗한 붕대용 흰색 양털(minecraft:white_wool) 3개 및 회복식 사과(minecraft:apple) 2개 제출',
    rewards: [
      'minecraft:golden_apple',
      '4x minecraft:bread'
    ]
  },

  relic_researcher: {
    exam_id: 'relic_researcher_f_to_e',
    label: '유물 연구자',
    serial_prefix: 'ARB-RELC-E-',
    license_item: 'f_rank_days:relic_researcher_license_e',
    training_guide: '세르딘 숲 입구 답사 또는 유적 보존 기초 교육 이수 (/frank training relic_researcher)',
    questions: [
      {
        qid: 'q1_preservation',
        prompt: '[유물 연구자 필기 1] 숲속 고대 비석이나 유적 벽화의 문양을 조사할 때 지켜야 할 제1 보존 원칙은?',
        choices: {
          '1': '곡괭이로 비석을 부숴 조각만 주머니에 챙긴다',
          '2': '페인트로 비석 위에 자기 이름을 크게 적는다',
          '3': '원형을 훼손하지 않는 비파괴 방식(붓질 정리·종이 탁본·스케치)으로 기록을 채록한다'
        },
        answer: '3',
        explanation: '유적과 비석은 한 번 파손되면 역사적 맥락이 영구 소실되므로 비파괴 채록·탁본이 기본 원칙입니다.'
      },
      {
        qid: 'q2_provenance',
        prompt: '[유물 연구자 필기 2] 유물 파편을 수습해 학술 기관에 보고할 때 유물 자체만큼 중요하게 함께 남겨야 하는 정보는?',
        choices: {
          '1': '발견된 정확한 위치 좌표, 주변 지층 상태, 함께 발견된 흔적(출토 맥락)',
          '2': '암시장 예상 경매 가격',
          '3': '아무 근거 없는 소문'
        },
        answer: '1',
        explanation: '출토 위치와 층위 맥락이 빠진 유물은 연대와 문화권 대조 가치를 크게 잃게 됩니다.'
      },
      {
        qid: 'q3_ethics',
        prompt: '[유물 연구자 필기 3] 후속 발굴 사료를 통해 기존 감정 기록의 오류를 발견했을 때 연구자가 취해야 할 태도는?',
        choices: {
          '1': '체면을 지키기 위해 새 사료를 숨기거나 폐기한다',
          '2': '근거 사료를 투명하게 공개하고 정식 재감정·정정 보고서를 제출한다',
          '3': '다른 연구자의 이름을 도용한다'
        },
        answer: '2',
        explanation: '오류를 사료에 기반해 투명하게 바로잡는 정직성이 학술 길드 공인 연구자의 핵심 윤리입니다.'
      }
    ],
    practical_desc: '세르딘 숲 고대 비석(조각된 석재 벽돌)에 종이(minecraft:paper)를 들고 우클릭하여 탁본지 3장 채록 + 고대 비석 탁본지 3장 길드 제출',
    rewards: [
      'minecraft:spyglass',
      'minecraft:brush',
      'minecraft:writable_book'
    ]
  }
};

// 기초 직무 오리엔테이션 이수 헬퍼 (어느 직업이든 무료·즉시 기초 수칙 브리핑 가능)
global.FRankDays.completeJobBasicTraining = function (player, jobId) {
  if (jobId === 'farmer') {
    return global.FRankDays.completeDarimOrientation(player);
  }
  var spec = global.FRankDays.JOB_EXAMS_F_TO_E[jobId];
  if (!spec) {
    return { ok: false, reason: 'invalid_job', message: '유효하지 않은 직업 ID입니다: ' + jobId };
  }
  var state = global.FRankDays.loadPlayerState(player);
  state.flags.job_training_done[jobId] = true;
  global.FRankDays.savePlayerState(player, state);
  return {
    ok: true,
    job_id: jobId,
    message:
      '[기초 직무 교육 완료] ' +
      spec.label +
      ' 분야의 현장 안전·윤리 기초 브리핑을 이수했습니다! 이제 F급 상태에서 E급 승급시험(/frank exam_start ' +
      jobId +
      ')에 응시할 수 있습니다.'
  };
};

// 선행 조건 충족 여부 판정
global.FRankDays.hasJobExamPrerequisite = function (state, jobId) {
  if (state.flags && state.flags.job_training_done && state.flags.job_training_done[jobId]) {
    return true;
  }
  var q4 = state.starter_onboarding && state.starter_onboarding.quests
    ? state.starter_onboarding.quests.q04_first_steps
    : null;
  var stats = state.job_licenses[jobId] ? state.job_licenses[jobId].stats : {};

  if (jobId === 'swordsman') {
    return Number(stats.mob_kills || 0) >= 3;
  }
  if (jobId === 'alchemist') {
    return Boolean((q4 && q4.completed_herb_quest_roman) || Number(stats.herbs_gathered || 0) >= 3);
  }
  if (jobId === 'blacksmith') {
    return Number(stats.ores_mined || 0) >= 4;
  }
  if (jobId === 'healer') {
    return Number(stats.care_actions || 0) >= 2;
  }
  if (jobId === 'relic_researcher') {
    return Boolean((q4 && q4.visited_serdin_entrance) || Number(stats.rubbings_taken || 0) >= 1);
  }
  return false;
};

// [1단계] 통합 E급 시험 응시 시작 (6대 전 직업 지원)
global.FRankDays.startJobExamFtoE = function(){return {ok:false,reason:'phase4_practical_required',message:'필기·구형 검수 발급은 종료되었습니다. 담당 스승에게 개인 실기를 접수하고 퀘스트북의 봉랍 보상으로 승급하세요.'};};

// [2단계-A] 필기 답안 제출 및 오답 피드백
global.FRankDays.submitJobWrittenAnswers = function(){return {ok:false,reason:'phase4_practical_required',message:'필기·구형 검수 발급은 종료되었습니다. 담당 스승에게 개인 실기를 접수하고 퀘스트북의 봉랍 보상으로 승급하세요.'};};

// 힐러 응급 처치 실습 액션 (/frank practice_heal)
global.FRankDays.performHealerPracticeCare = function(){return {ok:false,reason:'actual_healing_required',message:'붕대로 실제 부상을 치유하거나 치유 스킬로 아군의 체력을 회복하세요. 명령어 연습은 승급 실적으로 집계하지 않습니다.'};};

// [2단계-B & 3단계] 실기 검수 및 E급 자격증·보상 발급
global.FRankDays.evaluateJobPracticalAndCertify = function(){return {ok:false,reason:'phase4_practical_required',message:'필기·구형 검수 발급은 종료되었습니다. 담당 스승에게 개인 실기를 접수하고 퀘스트북의 봉랍 보상으로 승급하세요.'};};

// === 5대 직업 실기 추적용 KubeJS 월드 이벤트 훅 ===

var HERB_BLOCKS = [
  'minecraft:dandelion',
  'minecraft:poppy',
  'minecraft:lily_of_the_valley',
  'minecraft:cornflower',
  'minecraft:azure_bluet',
  'minecraft:allium',
  'minecraft:blue_orchid',
  'minecraft:oxeye_daisy'
];

var ORE_AND_STONE_BLOCKS = [
  'minecraft:coal_ore',
  'minecraft:deepslate_coal_ore',
  'minecraft:iron_ore',
  'minecraft:deepslate_iron_ore',
  'minecraft:copper_ore',
  'minecraft:deepslate_copper_ore',
  'minecraft:gold_ore',
  'minecraft:deepslate_gold_ore',
  'minecraft:stone',
  'minecraft:cobblestone',
  'minecraft:andesite'
];

var HOSTILE_ENTITIES = [
  'minecraft:zombie',
  'minecraft:skeleton',
  'minecraft:spider',
  'minecraft:cave_spider',
  'minecraft:creeper',
  'minecraft:slime',
  'minecraft:enderman',
  'minecraft:witch',
  'minecraft:drowned',
  'minecraft:husk',
  'minecraft:stray',
  'minecraft:pillager',
  'minecraft:vindicator'
];

// 1) 약초 채집(연금술사) 및 광석 채광(대장장이) 블록 파괴 이벤트
global.FRankDays.recordSuccessfulLegacyHarvestV96 = function (player, kind) {
  var isHerb = kind === 'herb';
  var isOre = kind === 'ore';
  if (!isHerb && !isOre) return;

  var state = global.FRankDays.loadPlayerState(player);
  var changed = false;

  if (isHerb) {
    state.job_licenses.alchemist.stats.herbs_gathered += 1;
    changed = true;
    var alchExam = state.active_exams.alchemist_f_to_e;
    if (alchExam && alchExam.status === 'IN_PROGRESS' && alchExam.phase === 'PRACTICAL') {
      alchExam.practical.herbs_gathered += 1;
      if (player.tell && alchExam.practical.herbs_gathered <= 4) {
        player.tell('[연금술사 실기] 야생 약초 채집 (' + alchExam.practical.herbs_gathered + '/4)');
      }
    }
  }

  if (isOre) {
    state.job_licenses.blacksmith.stats.ores_mined += 1;
    changed = true;
    var blkExam = state.active_exams.blacksmith_f_to_e;
    if (blkExam && blkExam.status === 'IN_PROGRESS' && blkExam.phase === 'PRACTICAL') {
      blkExam.practical.ores_mined += 1;
      if (player.tell && blkExam.practical.ores_mined <= 6) {
        player.tell('[대장장이 실기] 단조용 광석·암석 채광 (' + blkExam.practical.ores_mined + '/6)');
      }
    }
  }

  if (changed) {
    global.FRankDays.savePlayerState(player, state);
  }
};
BlockEvents.broken(function(event){
  var p=event.player,b=event.block;if(!p||!b)return;
  var where={dimension:String(event.level.dimension),x:Number(b.x),y:Number(b.y),z:Number(b.z)};
  if(global.FRankDays.isManagedRegenNodeV96&&global.FRankDays.isManagedRegenNodeV96(p,where))return;
  var kind=HERB_BLOCKS.indexOf(String(b.id))>=0?'herb':ORE_AND_STONE_BLOCKS.indexOf(String(b.id))>=0?'ore':null;if(!kind)return;
  var world=event.level,before=String(b.blockState);
  p.server.scheduleInTicks(1,function(){if(String(world.getBlock(where.x,where.y,where.z).blockState)!==before)global.FRankDays.recordSuccessfulLegacyHarvestV96(p,kind);});
});

// 2) 세르딘 고대 비석(chiseled_stone_bricks) 종이 우클릭 탁본 채록(유물 연구자)
BlockEvents.rightClicked(function (event) {
  var player = event.player;
  if (!player || !event.block) return;
  // Verified v9.4 worlds use the single designated-stela handler in script 22.
  if (typeof global.FRankDays.usesDesignatedStelaeV94 === 'function' && global.FRankDays.usesDesignatedStelaeV94(player.server)) return;
  var blockId = String(event.block.id);
  if (blockId !== 'minecraft:chiseled_stone_bricks') return;

  var heldId = event.item && event.item.id
    ? String(event.item.id)
    : player.mainHandItem && player.mainHandItem.id
      ? String(player.mainHandItem.id)
      : '';
  if (heldId !== 'minecraft:paper') return;

  var paperCnt = global.FRankDays.countPlayerItem(player, 'minecraft:paper');
  if (paperCnt < 1 && heldId !== 'minecraft:paper') return;

  if (player.server && player.server.runCommandSilent) {
    player.server.runCommandSilent('clear ' + player.username + ' minecraft:paper 1');
  }
  if (typeof player.setItemCount === 'function' && paperCnt > 0) {
    player.setItemCount('minecraft:paper', paperCnt - 1);
  }
  if (player.give) {
    player.give('f_rank_days:ancient_rubbing_sheet');
  }

  var state = global.FRankDays.loadPlayerState(player);
  state.job_licenses.relic_researcher.stats.rubbings_taken += 1;
  var relExam = state.active_exams.relic_researcher_f_to_e;
  if (relExam && relExam.status === 'IN_PROGRESS' && relExam.phase === 'PRACTICAL') {
    relExam.practical.rubbings_taken += 1;
  }
  global.FRankDays.savePlayerState(player, state);

  if (player.tell) {
    player.tell(
      '[유물 연구 채록] 고대 비석 표면을 훼손하지 않고 비문 탁본지 1장을 정밀하게 떠냈습니다!' +
        (relExam && relExam.status === 'IN_PROGRESS' && relExam.phase === 'PRACTICAL'
          ? ' (실기 탁본: ' + relExam.practical.rubbings_taken + '/3)'
          : '')
    );
  }
});

// 3) 적대적 마물 토벌 추적(검사)
if (typeof EntityEvents !== 'undefined' && EntityEvents.death) {
  EntityEvents.death(function (event) {
    var src = event.source;
    var killer = src && src.player ? src.player : src && src.actual && src.actual.isPlayer && src.actual.isPlayer() ? src.actual : null;
    if (!killer) return;

    var victim = event.entity;
    if (!victim) return;
    var vType = String(victim.type || victim.id || '');
    var isHostile = Boolean(victim.monster) || HOSTILE_ENTITIES.indexOf(vType) !== -1;
    if (!isHostile) return;

    var state = global.FRankDays.loadPlayerState(killer);
    state.job_licenses.swordsman.stats.mob_kills += 1;
    var swExam = state.active_exams.swordsman_f_to_e;
    if (swExam && swExam.status === 'IN_PROGRESS' && swExam.phase === 'PRACTICAL') {
      swExam.practical.mob_kills += 1;
      if (killer.tell && swExam.practical.mob_kills <= 5) {
        killer.tell('[검사 실기] 외곽 위협 마물 토벌 확인 (' + swExam.practical.mob_kills + '/5)');
      }
    }
    global.FRankDays.savePlayerState(killer, state);
  });
}
