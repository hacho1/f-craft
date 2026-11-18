// 《F급의 나날》 KubeJS 6 Server Script - Implemented F-Rank Abilities (4/15) & Multi-Job System
// 파일 경로: kubejs/server_scripts/01_ability_and_jobs.js
// 핵심 원칙:
// 1. 플레이어가 F급 특수 능력과 최초 직업을 모두 선택하면, 아직 등록증이 발급되지 않은 경우에만
//    길드 등록 과정의 마지막 단계로서 화면에 “길드 등록증” UI를 자동으로 표시합니다.
// 2. 이미 길드 등록을 마친 플레이어가 추가 직업을 등록하거나 재접속할 때는 등록증 절차가 절대 중복 실행되지 않습니다.

global.FRankDays = global.FRankDays || {};

global.FRankDays.STARTER_ABILITIES = {
  seed_sense: {
    id: 'seed_sense',
    name: '흙내음 감각',
    grade: 'F',
    implemented: true,
    desc: '웅크린 채 작물·밭흙 우클릭 시 성장도·수분 확인, 완숙 작물 수확 시 15% 확률로 씨앗 1개 추가 회수'
  },
  steady_breath: {
    id: 'steady_breath',
    name: '고른 숨결',
    grade: 'F',
    implemented: true,
    desc: '호흡 가다듬기(/frank breathe) 사용 시 60초 쿨타임으로 짧은 재생 I(4초) 회복'
  },
  keen_appraisal: {
    id: 'keen_appraisal',
    name: '잔금 읽기',
    grade: 'F',
    implemented: true,
    desc: '광석·자갈·돌 채굴 시 8% 확률로 철 조각이나 부싯돌을 1개 추가로 발견'
  },
  warm_palm: {
    id: 'warm_palm',
    name: '미온의 손바닥',
    grade: 'F',
    implemented: true,
    desc: '온기 갈무리(/frank warm_hands 또는 따뜻한 식사) 시 90초 쿨타임으로 흡수 I(30초) 보호 부여'
  }
};

global.FRankDays.UNIMPLEMENTED_PLANNED_ABILITIES = {
  animal_affinity: { id: 'animal_affinity', name: '작은 말벗', implemented: false },
  faint_night_eye: { id: 'faint_night_eye', name: '어스름 눈', implemented: false },
  herb_scent: { id: 'herb_scent', name: '풀잎 코끝', implemented: false },
  light_footstep: { id: 'light_footstep', name: '가벼운 발걸음', implemented: false },
  weather_intuition: { id: 'weather_intuition', name: '비구름 예감', implemented: false },
  steady_hand: { id: 'steady_hand', name: '흔들림 없는 손끝', implemented: false },
  bargain_sense: { id: 'bargain_sense', name: '장터 눈치', implemented: false },
  campfire_cook: { id: 'campfire_cook', name: '모닥불 손맛', implemented: false },
  pack_organizer: { id: 'pack_organizer', name: '단단한 배낭 매듭', implemented: false },
  well_dowsing: { id: 'well_dowsing', name: '물맥 더듬기', implemented: false },
  mend_stitch: { id: 'mend_stitch', name: '꼼꼼한 바느질', implemented: false }
};

global.FRankDays.getSelectableAbilities = function () {
  var list = [];
  var keys = Object.keys(global.FRankDays.STARTER_ABILITIES);
  for (var i = 0; i < keys.length; i++) {
    var ab = global.FRankDays.STARTER_ABILITIES[keys[i]];
    if (ab && ab.implemented === true) {
      list.push(ab);
    }
  }
  return list;
};

global.FRankDays.JOB_LABELS = {
  farmer: '농부',
  swordsman: '검사',
  alchemist: '연금술사',
  blacksmith: '대장장이',
  healer: '힐러',
  relic_researcher: '유물 연구자'
};

global.FRankDays.NPC_EXAM_AUTHORITY = {
  hess: {
    npc_grade: null,
    can_register_f: true,
    guide_all_jobs: true,
    proctor_scopes: ['farmer:F_TO_E_admin']
  },
  darim: {
    npc_grade: 'C',
    can_register_f: false,
    training_scopes: ['farmer:basic_orientation'],
    proctor_scopes: ['farmer:F_TO_E_practical_witness']
  },
  ski: {
    npc_grade: 'A',
    can_register_f: false,
    training_scopes: ['swordsman:basic_to_mid'],
    proctor_scopes: ['swordsman:F_TO_E', 'swordsman:E_TO_D']
  },
  roman: {
    npc_grade: 'B',
    can_register_f: false,
    training_scopes: ['alchemist:intro_practical'],
    proctor_scopes: []
  },
  nau: {
    npc_grade: 'B',
    can_register_f: false,
    training_scopes: ['blacksmith:apprentice_forge'],
    proctor_scopes: []
  },
  hwiyeon: {
    npc_grade: 'A',
    can_register_f: false,
    training_scopes: ['healer:basic_triage'],
    proctor_scopes: ['healer:F_TO_E']
  }
};

global.FRankDays.selectStarterAbility = function (player, abilityId, nowEpochMs) {
  var state = global.FRankDays.loadPlayerState(player);
  if (state.special_ability.ability_id) {
    return {
      ok: false,
      reason: 'already_selected',
      message:
        '이미 시작 F급 능력 [' +
        state.special_ability.ability_id +
        ']을 보유하고 있습니다. (재접속이나 추가 등록 시에도 기존 능력이 유지됩니다.)'
    };
  }
  if (global.FRankDays.UNIMPLEMENTED_PLANNED_ABILITIES[abilityId]) {
    return {
      ok: false,
      reason: 'unimplemented_ability',
      message: '아직 인게임 효과가 구현되지 않은 기획 단계 능력은 선택할 수 없습니다.'
    };
  }
  var ability = global.FRankDays.STARTER_ABILITIES[abilityId];
  if (!ability || ability.implemented !== true) {
    return {
      ok: false,
      reason: 'invalid_ability',
      message: '선택 가능한 구현 완료 F급 능력 ID: seed_sense, steady_breath, keen_appraisal, warm_palm'
    };
  }

  var now = nowEpochMs || Date.now();
  state.special_ability.ability_id = ability.id;
  state.special_ability.grade = 'F';
  state.special_ability.selected_at = now;

  var ob = state.starter_onboarding;
  var hasAnyJobAlready = false;
  for (var j = 0; j < global.FRankDays.ALL_JOBS.length; j++) {
    if (state.job_licenses[global.FRankDays.ALL_JOBS[j]].grade !== 'UNREGISTERED') {
      hasAnyJobAlready = true;
      break;
    }
  }

  if (ob && ob.quests) {
    ob.guild_registration_unlocked = true;
    ob.quests.q02_first_registration.explained_system = true;
    ob.quests.q02_first_registration.selected_ability = true;
    ob.quests.q02_first_registration.status = 'COMPLETED';
    if (ob.quests.q03_first_job.status === 'LOCKED') {
      ob.quests.q03_first_job.status = 'ACTIVE';
    }
  }

  var giveTokenNow = false;
  if (!state.reward_ledger.ability_token_given) {
    state.reward_ledger.ability_token_given = true;
    giveTokenNow = true;
  }

  global.FRankDays.savePlayerState(player, state);

  if (giveTokenNow && player.give) {
    player.give('f_rank_days:f_ability_token');
  }
  if (typeof global.FRankDays.syncFtbQuestStagesForPlayer === 'function') {
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
  }

  // 만약 이미 직업을 먼저 등록한 상태에서 능력을 골랐고 아직 등록증이 미발급이면 즉시 길드 등록증 UI 표시
  var autoOpenedUi = false;
  if (hasAnyJobAlready && !state.guild_card.issued && typeof global.FRankDays.openGuildRegistrationUi === 'function') {
    var uiRes = global.FRankDays.openGuildRegistrationUi(player, 'INPUT', now);
    autoOpenedUi = Boolean(uiRes && uiRes.ok);
  }

  return {
    ok: true,
    ability: ability,
    opened_guild_card_ui: autoOpenedUi,
    message:
      '[통합 길드] 시작 F급 능력 「' +
      ability.name +
      '」 선택 완료! ' +
      (autoOpenedUi
        ? '화면에 표시된 《길드 등록증》 UI의 성명란에 이름을 직접 입력해 등록을 완료하세요.'
        : '이어서 최초 직업을 선택해 주세요 (/frank register_job <직업ID>).')
  };
};

global.FRankDays.triggerSteadyBreath = function (player, nowEpochMs) {
  var now = nowEpochMs || Date.now();
  var state = global.FRankDays.loadPlayerState(player);
  if (state.special_ability.ability_id !== 'steady_breath') {
    return { ok: false, reason: 'wrong_ability', message: '[고른 숨결] 특성 보유자만 사용할 수 있습니다.' };
  }
  var cds = state.starter_onboarding.ability_Cooldowns;
  if (now < cds.steady_breath_until) {
    var sec = Math.ceil((cds.steady_breath_until - now) / 1000);
    return { ok: false, reason: 'cooldown', message: '[고른 숨결] 호흡을 가다듬는 중입니다 (' + sec + '초 후 가능).' };
  }
  cds.steady_breath_until = now + 60000;
  global.FRankDays.savePlayerState(player, state);
  if (player.server && player.server.runCommandSilent) {
    player.server.runCommandSilent('effect give ' + player.username + ' minecraft:regeneration 4 0 true');
  }
  return { ok: true, effect: 'minecraft:regeneration', message: '[고른 숨결] 차분히 숨을 고르자 가벼운 생기가 돕니다. (재생 I 4초)' };
};

global.FRankDays.triggerWarmPalm = function (player, nowEpochMs) {
  var now = nowEpochMs || Date.now();
  var state = global.FRankDays.loadPlayerState(player);
  if (state.special_ability.ability_id !== 'warm_palm') {
    return { ok: false, reason: 'wrong_ability', message: '[미온의 손바닥] 특성 보유자만 사용할 수 있습니다.' };
  }
  var cds = state.starter_onboarding.ability_Cooldowns;
  if (now < cds.warm_palm_until) {
    var sec = Math.ceil((cds.warm_palm_until - now) / 1000);
    return { ok: false, reason: 'cooldown', message: '[미온의 손바닥] 아직 온기를 모으는 중입니다 (' + sec + '초 후 가능).' };
  }
  cds.warm_palm_until = now + 90000;
  global.FRankDays.savePlayerState(player, state);
  if (player.server && player.server.runCommandSilent) {
    player.server.runCommandSilent('effect give ' + player.username + ' minecraft:absorption 30 0 true');
  }
  return { ok: true, effect: 'minecraft:absorption', message: '[미온의 손바닥] 손끝의 은은한 온기가 몸을 감쌉니다. (흡수 I 30초)' };
};

// 직업 F급 등록 -> 최초 직업이고 F급 능력도 선택된 상태이며 미발급자라면 즉시 마지막 단계 "길드 등록증" UI 자동 표시!
global.FRankDays.registerJobF = function (player, jobId, nowEpochMs) {
  if (!global.FRankDays.JOB_LABELS[jobId]) {
    return { ok: false, reason: 'unknown_job', message: '등록할 수 없는 직업 식별자입니다: ' + jobId };
  }
  var state = global.FRankDays.loadPlayerState(player);
  var jobRecord = state.job_licenses[jobId];
  if (jobRecord.grade !== 'UNREGISTERED') {
    return {
      ok: false,
      reason: 'already_registered',
      message:
        global.FRankDays.JOB_LABELS[jobId] +
        ' 직업은 이미 [' +
        jobRecord.grade +
        '급]으로 등록되어 있습니다.'
    };
  }

  var now = nowEpochMs || Date.now();
  jobRecord.grade = 'F';
  jobRecord.registered_at = now;

  var ob = state.starter_onboarding;
  var unlockedFirstStepsNow = false;
  if (ob && ob.quests) {
    if (!ob.quests.q03_first_job.registered_any_job) {
      ob.quests.q03_first_job.registered_any_job = true;
      ob.quests.q03_first_job.first_job_id = jobId;
      ob.quests.q03_first_job.status = 'COMPLETED';
    }
    if (ob.quests.q04_first_steps.status === 'LOCKED') {
      ob.quests.q04_first_steps.status = 'ACTIVE';
      unlockedFirstStepsNow = true;
    }
  }

  var ledgerKey = 'job_card_f_' + jobId;
  var shouldGiveCard = false;
  if (!state.reward_ledger[ledgerKey]) {
    state.reward_ledger[ledgerKey] = true;
    shouldGiveCard = true;
  }

  global.FRankDays.savePlayerState(player, state);

  if (shouldGiveCard && player.give) {
    var certificateId = 'f_rank_days:' + jobId + '_license_f';
    if (typeof Item !== 'undefined' && Item.of) {
      player.give(Item.of(certificateId, {
        JobId: jobId, JobLabel: global.FRankDays.JOB_LABELS[jobId], Grade: 'F',
        HolderName: String(player.username || player.name || 'Player'), HolderUUID: String(player.uuid)
      }));
    } else player.give(certificateId);
  }

  if (
    typeof Platform !== 'undefined' &&
    Platform &&
    typeof Platform.isLoaded === 'function' &&
    Platform.isLoaded('puffish_skills') &&
    player.server &&
    player.server.runCommandSilent
  ) {
    player.server.runCommandSilent(
      'puffish_skills category unlock ' + player.username + ' f_rank_days:' + jobId
    );
  }

  if (typeof global.FRankDays.syncFtbQuestStagesForPlayer === 'function') {
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
  }

  // [핵심] F급 능력 + 최초 직업 선택 완료 시 마지막 단계 “길드 등록증” UI 자동 표시! (기등록자는 절대 중복 실행 안 됨)
  var autoOpenedUi = false;
  if (
    state.special_ability.ability_id &&
    !state.guild_card.issued &&
    typeof global.FRankDays.openGuildRegistrationUi === 'function'
  ) {
    var uiRes = global.FRankDays.openGuildRegistrationUi(player, 'INPUT', now);
    autoOpenedUi = Boolean(uiRes && uiRes.ok);
  }

  return {
    ok: true,
    job_id: jobId,
    grade: 'F',
    unlocked_q04: unlockedFirstStepsNow,
    opened_guild_card_ui: autoOpenedUi,
    message:
      '[통합 길드] 「' +
      global.FRankDays.JOB_LABELS[jobId] +
      '」 F급(초보·최초 등록) 선택 완료!' +
      (autoOpenedUi
        ? ' 화면 중앙에 표시된 《길드 등록증》 UI의 성명 항목에 자신의 이름을 직접 입력하고 Enter를 눌러 등록을 마쳐 주세요!'
        : ' (언제든 다른 직업도 자유롭게 병행 등록할 수 있습니다.)')
  };
};

global.FRankDays.grantSRankBySpecialAchievement = function (
  player,
  jobId,
  achievementId,
  reviewBoardApproved,
  nowEpochMs
) {
  var state = global.FRankDays.loadPlayerState(player);
  var jobRecord = state.job_licenses[jobId];
  if (!jobRecord || jobRecord.grade !== 'A') {
    return {
      ok: false,
      reason: 'requires_a_grade',
      message: 'S급 인정 심사는 A급 최상위 전문가만 대상이 됩니다.'
    };
  }
  if (!achievementId || !reviewBoardApproved) {
    return {
      ok: false,
      reason: 'requires_special_achievement_and_review',
      message: 'S급은 일반 반복 시험으로 승급할 수 없으며, 특별 업적 달성과 심사 기관 승인이 필요합니다.'
    };
  }
  if(global.FRankDays.acceptPracticalPromotionPhase4)return{ok:false,reason:'requires_personal_practical_reward',message:'S급 승급은 개인 실기 퀘스트 보상으로 정산하세요.'};
  jobRecord.grade = 'S';
  jobRecord.promoted_at = nowEpochMs || Date.now();
  global.FRankDays.savePlayerState(player, state);
  return {
    ok: true,
    grade: 'S',
    message: '[제국 중앙 심사원] 특별 업적(' + achievementId + ') 심사를 통해 전설급 S급 전문가로 공인되었습니다.'
  };
};

BlockEvents.rightClicked(function (event) {
  var player = event.player;
  if (!player || !event.block) return;
  if (!player.crouching && !player.shiftKeyDown) return;

  var heldId = event.item && event.item.id
    ? String(event.item.id)
    : player.mainHandItem && player.mainHandItem.id
      ? String(player.mainHandItem.id)
      : '';
  if (
    heldId.indexOf('_hoe') !== -1 &&
    global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_2_soil')
  ) {
    return;
  }

  var state = global.FRankDays.loadPlayerState(player);
  if (state.special_ability.ability_id !== 'seed_sense') return;

  var blockId = String(event.block.id || '');
  if (blockId === 'minecraft:farmland') {
    var moist = global.FRankDays.getBlockProp(event.block, 'moisture') || '0';
    player.tell('[흙내음 감각] 이 경작지의 수분도는 ' + moist + '/7 단계입니다.');
  } else {
    var ageStr = global.FRankDays.getBlockProp(event.block, 'age');
    if (ageStr !== undefined) {
      player.tell('[흙내음 감각] 현재 작물 성장 단계는 ' + ageStr + '단계입니다.');
    }
  }
});

BlockEvents.broken(function (event) {
  var player = event.player;
  if (!player || !event.block) return;
  var state = global.FRankDays.loadPlayerState(player);
  var abId = state.special_ability.ability_id;
  if (!abId) return;

  var blockId = String(event.block.id || '');
  if (abId === 'keen_appraisal') {
    var isOreOrGravel =
      blockId.indexOf('_ore') !== -1 ||
      blockId === 'minecraft:gravel' ||
      blockId === 'minecraft:stone';
    if (isOreOrGravel && Math.random() < 0.08 && player.give) {
      var bonus = blockId === 'minecraft:gravel' ? 'minecraft:flint' : 'minecraft:iron_nugget';
      player.give(bonus);
      player.tell('[잔금 읽기] 돌결 사이에서 쓸 만한 부산물(' + bonus + ')을 하나 더 찾아냈습니다!');
    }
  } else if (abId === 'seed_sense') {
    if (global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_3_research')) {
      return;
    }
    if (blockId === 'minecraft:wheat') {
      var ageVal = parseInt(global.FRankDays.getBlockProp(event.block, 'age') || '0', 10);
      if (ageVal >= 7 && Math.random() < 0.15 && player.give) {
        player.give('minecraft:wheat_seeds');
        player.tell('[흙내음 감각] 잘 여문 이삭에서 튼실한 밀 씨앗 1개를 추가로 골라냈습니다.');
      }
    }
  }
});

if (typeof ItemEvents !== 'undefined' && ItemEvents.foodEaten) {
  ItemEvents.foodEaten(function (event) {
    var player = event.player;
    if (!player) return;
    var state = global.FRankDays.loadPlayerState(player);
    if (state.special_ability.ability_id === 'warm_palm') {
      var res = global.FRankDays.triggerWarmPalm(player);
      if (res.ok && player.tell) {
        player.tell(res.message);
      }
    }
  });
}
