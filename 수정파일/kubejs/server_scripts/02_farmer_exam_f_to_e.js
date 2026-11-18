// 《F급의 나날》 KubeJS 6 Server Script - Farmer F -> E License Exam (Connected to Brion Farm)
// 파일 경로: kubejs/server_scripts/02_farmer_exam_f_to_e.js
// 개선 사항:
// 1. 실제 Minecraft 1.20.1 Forge의 BlockContainerJS.properties(Java Map) 호환 getBlockProp 적용
// 2. 다림의 농장·실습장(기본 남서쪽 [-22, 69, 22]) 안내 및 시작 퀘스트 04(다림에게 농사 배우기) 연동
// 3. 실기 작업 시 실시간 진행도 피드백 출력

global.FRankDays = global.FRankDays || {};

var FARMER_F_TO_E_QUESTIONS = [
  {
    qid: 'q1_hydration',
    prompt: '[문항 1] 평지 기준 물 1칸이 주변 경작지(밭흙)를 촉촉하게 유지하는 최대 수평 거리는?',
    choices: { '1': '2블록 이내', '2': '4블록 이내', '3': '8블록 이내' },
    answer: '2',
    feedback: '문항 1 보충: 물 블록으로부터 수평(대각선 포함) 4블록 이내의 경작지가 수분을 공급받습니다.'
  },
  {
    qid: 'q2_soil_care',
    prompt: '[문항 2] 파종된 경작지가 훼손되지 않도록 농부가 피해야 할 행동은?',
    choices: {
      '1': '경작지 위에서 점프하여 착지하기',
      '2': '밭 주변에 횃불 설치하기',
      '3': '성숙한 작물만 골라 수확하기'
    },
    answer: '1',
    feedback: '문항 2 보충: 경작지 위에서 점프해 착지하면 일반 흙으로 되돌아가며 심은 작물이 뽑힙니다.'
  },
  {
    qid: 'q3_harvest_timing',
    prompt: '[문항 3] 밀 알곡과 씨앗을 온전히 수확하기 위한 올바른 수확 단계는?',
    choices: {
      '1': '파종 직후 초록 새싹 단계(0~2단계)',
      '2': '줄기만 자란 중간 단계(3~5단계)',
      '3': '이삭이 황금빛으로 완전히 여문 최종 성숙 단계(7단계)'
    },
    answer: '3',
    feedback: '문항 3 보충: 밀은 최종 성장 단계(age=7)에 도달했을 때 수확해야 밀 알곡이 정상 산출됩니다.'
  }
];

var FARMER_PRACTICAL_TARGETS = {
  tilled: 6,
  planted: 6,
  mature_harvested: 6,
  wheat_submitted: 6
};

var RETRY_COOLDOWN_MS = 30 * 1000;

global.FRankDays.completeDarimOrientation = function (player) {
  var state = global.FRankDays.loadPlayerState(player);
  state.flags.darim_farming_orientation_done = true;
  if (state.starter_onboarding && state.starter_onboarding.quests) {
    state.starter_onboarding.quests.q04_first_steps.learned_farming_darim = true;
  }
  if (state.relationships.darim) {
    state.relationships.darim.flags.first_met = true;
    if (state.relationships.darim.relation_type === 'none') {
      state.relationships.darim.relation_type = 'acquaintance';
    }
    state.relationships.darim.affinity = Math.min(100, state.relationships.darim.affinity + 5);
    if (global.FRankDays.recalculateRelationshipStage) {
      global.FRankDays.recalculateRelationshipStage(state.relationships.darim);
    }
  }
  global.FRankDays.savePlayerState(player, state);
  return {
    ok: true,
    message:
      '[다림] "흙은 거짓말을 안 해요! 바로 옆 실습장 물길에서 네 칸 안쪽으로 괭이질을 하고, 이삭이 황금빛(7단계)으로 다 여물 때까지 기다리면 돼요. 이제 길드의 헤스 씨에게 E급 승급시험을 신청해 보세요!"'
  };
};

global.FRankDays.startFarmerExamFtoE = function(){return {ok:false,reason:'phase4_practical_required',message:'필기·구형 검수 발급은 종료되었습니다. 담당 스승에게 개인 실기를 접수하고 퀘스트북의 봉랍 보상으로 승급하세요.'};};

global.FRankDays.submitFarmerWrittenAnswers = function(){return {ok:false,reason:'phase4_practical_required',message:'필기·구형 검수 발급은 종료되었습니다. 담당 스승에게 개인 실기를 접수하고 퀘스트북의 봉랍 보상으로 승급하세요.'};};

global.FRankDays.recordFarmingAction = function (player, actionType, meta) {
  var state = global.FRankDays.loadPlayerState(player);
  var farmerStats = state.job_licenses.farmer.stats;
  var exam = state.active_exams.farmer_f_to_e;
  var inPractical = Boolean(exam && exam.status === 'IN_PROGRESS' && exam.phase === 'PRACTICAL');
  var progressed = false;

  if (actionType === 'TILL') {
    farmerStats.tilled += 1;
    if (inPractical && exam.practical.tilled < FARMER_PRACTICAL_TARGETS.tilled) {
      exam.practical.tilled += 1;
      progressed = true;
    }
  } else if (actionType === 'PLANT') {
    farmerStats.planted += 1;
    if (inPractical && exam.practical.planted < FARMER_PRACTICAL_TARGETS.planted) {
      exam.practical.planted += 1;
      progressed = true;
    }
  } else if (actionType === 'HARVEST') {
    var isMature = Boolean(meta && meta.age >= meta.max_age);
    if (isMature) {
      farmerStats.mature_harvested += 1;
      if (
        inPractical &&
        exam.practical.mature_harvested < FARMER_PRACTICAL_TARGETS.mature_harvested
      ) {
        exam.practical.mature_harvested += 1;
        progressed = true;
      }
    } else if (inPractical) {
      exam.practical.immature_warnings += 1;
      if (player.tell) {
        player.tell(
          '[실기 안내] 아직 덜 여문 작물(성장 단계 ' +
            (meta ? meta.age : '?') +
            '/' +
            (meta ? meta.max_age : 7) +
            ')은 수확 실적으로 인정되지 않습니다.'
        );
      }
    }
  }

  global.FRankDays.savePlayerState(player, state);

  if (inPractical && progressed && player.tell) {
    var pr = exam.practical;
    if (
      pr.tilled >= 6 &&
      pr.planted >= 6 &&
      pr.mature_harvested >= 6
    ) {
      player.tell(
        '[농부 E급 실기] 현장 과제 완료! (경작 6/6, 파종 6/6, 완숙 수확 6/6) 이제 밀 6개를 가지고 길드의 헤스에게 검수를 받으세요.'
      );
    }
  }

  return {
    stats: farmerStats,
    practical: inPractical ? exam.practical : null
  };
};

global.FRankDays.evaluateFarmerPracticalAndCertify = function(){return {ok:false,reason:'phase4_practical_required',message:'필기·구형 검수 발급은 종료되었습니다. 담당 스승에게 개인 실기를 접수하고 퀘스트북의 봉랍 보상으로 승급하세요.'};};

var TILLABLE_BLOCKS = {
  'minecraft:dirt': true,
  'minecraft:grass_block': true,
  'minecraft:dirt_path': true,
  'minecraft:coarse_dirt': true
};

BlockEvents.rightClicked(function (event) {
  var player = event.player;
  if (!player || !event.item || !event.block) return;
  var itemId = String(event.item.id || '');
  var blockId = String(event.block.id || '');
  var isHoe =
    itemId.indexOf('_hoe') !== -1 ||
    (event.item.hasTag && event.item.hasTag('minecraft:hoes'));
  if (isHoe && TILLABLE_BLOCKS[blockId]) {
    global.FRankDays.recordFarmingAction(player, 'TILL', { block: blockId });
  }
});

var CROP_BLOCKS = {
  'minecraft:wheat': 7,
  'minecraft:carrots': 7,
  'minecraft:potatoes': 7,
  'minecraft:beetroots': 3,
  'farmersdelight:onions': 7,
  'farmersdelight:cabbages': 7,
  'farmersdelight:tomatoes': 3
};

BlockEvents.placed(function (event) {
  var player = event.player;
  if (!player || !event.block) return;
  var blockId = String(event.block.id || '');
  if (CROP_BLOCKS[blockId] !== undefined) {
    global.FRankDays.recordFarmingAction(player, 'PLANT', { block: blockId });
  }
});

BlockEvents.broken(function (event) {
  var player = event.player;
  if (!player || !event.block) return;
  var blockId = String(event.block.id || '');
  if (CROP_BLOCKS[blockId] !== undefined) {
    var maxAge = CROP_BLOCKS[blockId];
    var rawAge = global.FRankDays.getBlockProp(event.block, 'age');
    var ageVal = rawAge !== undefined ? parseInt(rawAge, 10) : 0;
    global.FRankDays.recordFarmingAction(player, 'HARVEST', {
      block: blockId,
      age: isNaN(ageVal) ? 0 : ageVal,
      max_age: maxAge
    });
  }
});
