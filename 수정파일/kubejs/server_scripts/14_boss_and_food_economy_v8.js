// 《F급의 나날》 KubeJS 6 Server Script - v8.1 Designated Boss Altar Only Summoning, Grief/Dup Protection & 3-Tier Currency Economy Hooks
// 파일 경로: kubejs/server_scripts/14_boss_and_food_economy_v8.js
// 핵심 보완 사항 (항목 5 · 항목 6):
// 1. 지정 보스 제단(`f_rank_days:wrought_trial_altar`) 전용 재소환:
//    - 기존의 단순 96m 야외 허공 우클릭 소환을 폐지하고, 지정된 제단 좌표(마을 중심 기준 +168, Y=68, +168)의
//      `f_rank_days:wrought_trial_altar` 블록에 직접 공명패를 우클릭할 때만 소환되도록 엄격 제한!
// 2. 동시 소환 · 반복 보상 · 타 플레이어 건축물 피해 3중 방지:
//    - 동시 소환 방지: 제단 활성 보스 UUID 잠금 + 반경 48m 내 생존 강철 수호자 스캔으로 2기 동시 소환 100% 차단(공명패 미소모)
//    - 반복 보상 남용 방지: 플레이어당 재소환 쿨타임(180초) + 최초 길드 보상 평생 1회 잠금 + 일일 반복 토벌 수당 상한(하루 최대 2회, 회당 20실버)
//    - 타 플레이어 건축물 피해 방지: 제단 반경 28블록 내 비관리자 블록 설치/파괴 금지 보호 구역 + 보스 반경 26블록 이탈 시 제단 중앙 강제 귀환(유인 테러 방지)
// 3. 모든 보스 보상 · NPC 요리 납품 보상 · 상점 구매 비용을 3단 화폐(1골드=100실버=1,000동화) 체계와 직결!

global.FRankDays = global.FRankDays || {};

global.FRankDays.BOSS_ALTAR_CONFIG_V8 = {
  altar_block_id: 'f_rank_days:wrought_trial_altar',
  offset_from_village_anchor: { dx: 168, dy: 0, dz: 168 },
  arena_platform_radius: 12,
  boss_tether_max_radius: 26,
  sanctuary_no_build_radius: 28,
  player_interact_max_dist: 6.5,
  player_rematch_cooldown_ms: 180000 // 3분 재소환 대기시간
};

global.FRankDays.BOSS_SPECS_V8 = {
  ferrous_wroughtnaut: {
    boss_key: 'ferrous_wroughtnaut',
    entity_id: 'mowziesmobs:ferrous_wroughtnaut',
    ko_name: '강철 수호자 (Ferrous Wroughtnaut)',
    danger_grade: 'D~C급 경계 마물',
    spawn_region_desc: '자연 생성 지하 고대 철기실(최초 토벌) · 이후 남동쪽 지정 [강철 수호자의 시련 제단 (X:168, Y:68, Z:168)]에서만 재소환 가능',
    recommended_prep: '+15 이상 강화한 둔기·창·검, 황금밀 보양 스튜, 공격 예고 반짝임 직후 패링[R] 및 회피[V] 활용',
    objective_desc: '강철 수호자 1기 토벌 및 통합 길드 접수원 헤스에게 생존 귀환 보고',
    repeatable_drops: [
      { id: 'f_rank_days:high_tempering_core', count: 2, note: '고순도 마력 단련핵 (반복 드롭)' },
      { id: 'f_rank_days:wrought_relic_shard', count: 1, note: '고대 철기 수호자 파편 (반복 드롭)' }
    ],
    first_clear_quest_reward: {
      reputation: 30,
      reward_copper: 1500, // 1골드 50실버 (1,500동화)
      title: '강철을 꺾은 자',
      exam_credit_job: 'swordsman',
      bonus_items: [
        { id: 'f_rank_days:wrought_challenge_sigil', count: 1 },
        { id: 'f_rank_days:high_tempering_core', count: 2 }
      ],
      unlocked_recipe_note: '경화광 전투망치(f_rank_days:hardened_warhammer) 단조 비전 해금'
    },
    repeat_bounty_copper: 200, // 20실버 (200동화)
    max_daily_repeat_bounties: 2
  }
};

global.FRankDays._processedBossDeathUuids = {};
global.FRankDays._foodBuffCooldowns = {};

global.FRankDays.getBossAltarCoordsV8 = function (server) {
  if (typeof global.FRankDays.getFcraftExistingBossAltar === 'function') {
    var relocated = global.FRankDays.getFcraftExistingBossAltar(server);
    if (relocated) return relocated;
  }
  var anchor = global.FRankDays.getVillageAnchor ? global.FRankDays.getVillageAnchor(server) : { x: 0, y: 68, z: 0 };
  var off = global.FRankDays.BOSS_ALTAR_CONFIG_V8.offset_from_village_anchor;
  return {
    x: Math.floor(Number(anchor.x || 0) + off.dx),
    y: Math.floor(Number(anchor.y || 68) + off.dy),
    z: Math.floor(Number(anchor.z || 0) + off.dz)
  };
};

global.FRankDays.loadBossAltarStateV8 = function (server) {
  if (!server || !server.persistentData) {
    global.FRankDays._memAltarState = global.FRankDays._memAltarState || {
      built: false,
      active_boss_uuid: null,
      summoned_at_ms: 0,
      summoner_uuid: null
    };
    return global.FRankDays._memAltarState;
  }
  if (server.persistentData.f_rank_boss_altar_v8) {
    try {
      return JSON.parse(String(server.persistentData.f_rank_boss_altar_v8));
    } catch (e) {}
  }
  return {
    built: false,
    active_boss_uuid: null,
    summoned_at_ms: 0,
    summoner_uuid: null
  };
};

global.FRankDays.saveBossAltarStateV8 = function (server, st) {
  if (!server || !server.persistentData) {
    global.FRankDays._memAltarState = st;
    return;
  }
  server.persistentData.f_rank_boss_altar_v8 = JSON.stringify(st);
};

// 지정 보스 시련 제단 석조 결계장 및 코어 블록 설치기 (1회 안전 설치, 플레이어 건축물 비침범 구역)
global.FRankDays.ensureWroughtBossAltarBuiltV8 = function (server, forceRebuild) {
  if (!server) return { ok: false, reason: 'no_server' };
  if ((typeof global.FRankDays.isFcraftV9World === 'function' && global.FRankDays.isFcraftV9World(server)) ||
      (typeof global.FRankDays.isFcraftV9CandidateWorld === 'function' && global.FRankDays.isFcraftV9CandidateWorld(server))) {
    if (!(typeof global.FRankDays.getFcraftExistingBossAltar === 'function' && global.FRankDays.getFcraftExistingBossAltar(server))) {
    return { ok: false, reason: 'fcraft_v9_original_terrain_protected_altar_unmapped' };
    }
  }
  var st = global.FRankDays.loadBossAltarStateV8(server);
  var c = global.FRankDays.getBossAltarCoordsV8(server);
  if (st.built && !forceRebuild) {
    return { ok: true, already_built: true, coords: c };
  }

  if (typeof server.runCommandSilent === 'function') {
    var r = global.FRankDays.BOSS_ALTAR_CONFIG_V8.arena_platform_radius;
    var x1 = c.x - r, x2 = c.x + r, z1 = c.z - r, z2 = c.z + r;
    // 결계 바닥(심층암 타일·석재 벽돌) 및 상부 공간 정리, 네 귀퉁이 흑요석 봉인 기둥과 중앙 제단 코어 배치
    server.runCommandSilent('fill ' + x1 + ' ' + (c.y - 1) + ' ' + z1 + ' ' + x2 + ' ' + (c.y - 1) + ' ' + z2 + ' minecraft:deepslate_tiles');
    server.runCommandSilent('fill ' + (c.x - 3) + ' ' + (c.y - 1) + ' ' + (c.z - 3) + ' ' + (c.x + 3) + ' ' + (c.y - 1) + ' ' + (c.z + 3) + ' minecraft:polished_basalt');
    server.runCommandSilent('fill ' + x1 + ' ' + c.y + ' ' + z1 + ' ' + x2 + ' ' + (c.y + 6) + ' ' + z2 + ' minecraft:air');
    var pillars = [[-r, -r], [-r, r], [r, -r], [r, r]];
    for (var i = 0; i < pillars.length; i++) {
      var px = c.x + pillars[i][0];
      var pz = c.z + pillars[i][1];
      server.runCommandSilent('fill ' + px + ' ' + c.y + ' ' + pz + ' ' + px + ' ' + (c.y + 3) + ' ' + pz + ' minecraft:crying_obsidian');
      server.runCommandSilent('setblock ' + px + ' ' + (c.y + 4) + ' ' + pz + ' minecraft:soul_lantern');
    }
    server.runCommandSilent('setblock ' + c.x + ' ' + c.y + ' ' + c.z + ' ' + global.FRankDays.BOSS_ALTAR_CONFIG_V8.altar_block_id);
  }

  st.built = true;
  st.coords = c;
  global.FRankDays.saveBossAltarStateV8(server, st);
  return { ok: true, built_now: true, coords: c };
};

// 제단 구역 내 현재 살아있는 보스 존재 여부 확인 (동시 소환 100% 방지!)
global.FRankDays.isBossCurrentlyActiveAtAltarV8 = function (server) {
  var st = global.FRankDays.loadBossAltarStateV8(server);
  var c = global.FRankDays.getBossAltarCoordsV8(server);
  var now = global.FRankDays.nowMsV8 ? global.FRankDays.nowMsV8() : Date.now();

  // 실제 월드 엔티티 목록 조회가 가능한 경우 반경 48m 내 생존 보스 직접 검사
  var ow = server && typeof server.overworld === 'function' ? server.overworld() : null;
  if (ow && typeof ow.getEntities === 'function') {
    var ents = ow.getEntities() || [];
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e && String(e.type) === 'mowziesmobs:ferrous_wroughtnaut' && e.alive !== false && Number(e.health === undefined ? 40 : e.health) > 0) {
        var dx = Number(e.x || 0) - c.x;
        var dz = Number(e.z || 0) - c.z;
        if (Math.sqrt(dx * dx + dz * dz) <= 48) {
          return { active: true, uuid: e.uuid || st.active_boss_uuid };
        }
      }
    }
    // 엔티티 목록을 직접 조회했는데 생존 개체가 없다면 오래된 잠금 자동 해제
    if (st.active_boss_uuid && now - Number(st.summoned_at_ms || 0) > 5000) {
      st.active_boss_uuid = null;
      global.FRankDays.saveBossAltarStateV8(server, st);
      return { active: false };
    }
  }

  if (st.active_boss_uuid) {
    // 비정상 디스폰 대비 15분 타임아웃 안전장치
    if (now - Number(st.summoned_at_ms || 0) > 15 * 60 * 1000) {
      st.active_boss_uuid = null;
      global.FRankDays.saveBossAltarStateV8(server, st);
      return { active: false };
    }
    return { active: true, uuid: st.active_boss_uuid };
  }
  return { active: false };
};

// 보스 제단 건축 보호 구역 검사기 (반경 28블록 내 타 플레이어 건축/파괴 차단 -> 보스전 건축물 피해 원천 방지)
global.FRankDays.isInsideBossAltarSanctuaryV8 = function (server, x, z, dimensionOpt) {
  if(dimensionOpt&&String(dimensionOpt)!=='minecraft:overworld')return false;
  if ((typeof global.FRankDays.isFcraftV9World === 'function' && global.FRankDays.isFcraftV9World(server)) ||
      (typeof global.FRankDays.isFcraftV9CandidateWorld === 'function' && global.FRankDays.isFcraftV9CandidateWorld(server))) {
    if (!(typeof global.FRankDays.getFcraftExistingBossAltar === 'function' && global.FRankDays.getFcraftExistingBossAltar(server))) return false;
  }
  var c = global.FRankDays.getBossAltarCoordsV8(server);
  var dx = Number(x || 0) - c.x;
  var dz = Number(z || 0) - c.z;
  var r = global.FRankDays.BOSS_ALTAR_CONFIG_V8.sanctuary_no_build_radius;
  return Math.sqrt(dx * dx + dz * dz) <= r;
};

global.FRankDays.ensurePlayerBossStateV8 = function (state) {
  state.v8_boss = state.v8_boss || {
    quests: {
      ferrous_wroughtnaut: {
        accepted: false,
        first_cleared: false,
        first_reward_claimed: false,
        clear_count: 0,
        claimed_repeat_bounties: 0,
        daily_bounty_day: -1,
        daily_bounty_count: 0,
        last_altar_summon_ms: -999999,
        first_clear_day: null,
        codex_unlocked: false,
        free_rematch_unlocked: false
      }
    },
    titles: [],
    guild_reputation: 0,
    unlocked_special_recipes: []
  };
  var q = state.v8_boss.quests.ferrous_wroughtnaut;
  if (q.daily_bounty_day === undefined) q.daily_bounty_day = -1;
  if (q.daily_bounty_count === undefined) q.daily_bounty_count = 0;
  if (q.last_altar_summon_ms === undefined) q.last_altar_summon_ms = -999999;
  return state.v8_boss;
};

// 1) 헤스에게 첫 보스 토벌 의뢰 수주
global.FRankDays.acceptFirstBossQuestV8 = function (player) {
  var state = global.FRankDays.loadPlayerState(player);
  var bState = global.FRankDays.ensurePlayerBossStateV8(state);
  var spec = global.FRankDays.getBossSpecForWorldV97 ? global.FRankDays.getBossSpecForWorldV97(player.server) : global.FRankDays.BOSS_SPECS_V8.ferrous_wroughtnaut;
  var q = bState.quests.ferrous_wroughtnaut;

  q.accepted = true;
  global.FRankDays.savePlayerState(player, state);
  if (player && player.server) {
    global.FRankDays.ensureWroughtBossAltarBuiltV8(player.server, false);
  }

  var altarC = global.FRankDays.getBossAltarCoordsV8(player ? player.server : null);
  var briefing =
    '========================================\n' +
    '[통합 길드 특별 토벌 의뢰: ' + spec.ko_name + ']\n' +
    '· 위험 등급: ' + spec.danger_grade + '\n' +
    '· 출현 및 재소환 제단: 지하 고대 철기실(최초 1회) / 지정 시련 제단 [X:' + altarC.x + ', Y:' + altarC.y + ', Z:' + altarC.z + ']\n' +
    '· 권장 준비: ' + spec.recommended_prep + '\n' +
    '· 최초 토벌 길드 보상: ' + global.FRankDays.formatCurrencyV8(spec.first_clear_quest_reward.reward_copper) + ', 명성 +30, 칭호 [강철을 꺾은 자], 재도전 공명패\n' +
    '========================================';
  if (player.tell) player.tell(briefing);

  return {
    ok: true,
    boss_key: 'ferrous_wroughtnaut',
    quest_accepted: true,
    altar_coords: altarC,
    spec: spec,
    message: briefing
  };
};

// 2) 보스 처치 처리 (UUID 중복 차단 + 제단 활성 잠금 해제 + 최초/반복 분리)
global.FRankDays.handleBossDefeatedV8 = function (killerPlayer, bossEntityId, bossEntityUuid, gameDayOpt) {
  if (!killerPlayer) return { ok: false, reason: 'no_killer_player' };
  var entId = String(bossEntityId || '');
  if (entId !== 'mowziesmobs:ferrous_wroughtnaut') {
    return { ok: false, reason: 'untracked_entity' };
  }

  var dedupKey = String(bossEntityUuid || ('anon_boss_' + Date.now() + '_' + Math.random()));
  if (global.FRankDays._processedBossDeathUuids[dedupKey]) {
    return { ok: false, reason: 'duplicate_death_event_ignored' };
  }
  global.FRankDays._processedBossDeathUuids[dedupKey] = true;

  // 보스 처치 시 제단 활성 보스 잠금 즉시 해제
  if (killerPlayer.server) {
    var altSt = global.FRankDays.loadBossAltarStateV8(killerPlayer.server);
    if (altSt.active_boss_uuid && (!global.FRankDays.isArenaWorldV97 || !global.FRankDays.isArenaWorldV97(killerPlayer.server) || String(altSt.active_boss_uuid) === String(bossEntityUuid))) {
      altSt.active_boss_uuid = null;
      altSt.arena_phase_v97 = 'IDLE';
      altSt.presence_v97 = {emptySince:null,warned:false};
      global.FRankDays.saveBossAltarStateV8(killerPlayer.server, altSt);
    }
  }

  var spec = global.FRankDays.getBossSpecForWorldV97 ? global.FRankDays.getBossSpecForWorldV97(killerPlayer.server,killerPlayer) : global.FRankDays.BOSS_SPECS_V8.ferrous_wroughtnaut;
  var state = global.FRankDays.loadPlayerState(killerPlayer);
  var bState = global.FRankDays.ensurePlayerBossStateV8(state);
  var q = bState.quests.ferrous_wroughtnaut;

  var isFirstClear = !q.first_cleared;
  var curDay = gameDayOpt !== undefined ? Number(gameDayOpt) : (global.FRankDays.getCurrentGameDayV8 ? global.FRankDays.getCurrentGameDayV8(killerPlayer.server) : 0);

  q.clear_count = Number(q.clear_count || 0) + 1;
  if (isFirstClear) {
    q.first_cleared = true;
    q.first_clear_day = curDay;
    q.codex_unlocked = true;
    q.free_rematch_unlocked = true;
  }
  global.FRankDays.savePlayerState(killerPlayer, state);

  var droppedItems = [];
  for (var i = 0; i < spec.repeatable_drops.length; i++) {
    var d = spec.repeatable_drops[i];
    if (killerPlayer.give) {
      killerPlayer.give(d.count + 'x ' + d.id);
    }
    droppedItems.push({ id: d.id, count: d.count });
  }

  if (isFirstClear && typeof global.FRankDays.recordNewspaperEventV8 === 'function') {
    var dispName = (state.guild_card && state.guild_card.issued && state.guild_card.registered_display_name)
      ? state.guild_card.registered_display_name
      : String(killerPlayer.username || '이름 없는 모험가');
    global.FRankDays.recordNewspaperEventV8(killerPlayer.server, {
      type: 'BOSS_FIRST_CLEAR',
      actor_uuid: String(killerPlayer.uuid || killerPlayer.username),
      display_name: dispName,
      boss_name: spec.ko_name,
      day: curDay,
      region: '고대 철기실'
    });
  }

  var notice = isFirstClear
    ? '🏆 [최초 토벌 달성!] ' + spec.ko_name + '을(를) 물리쳤습니다! 통합 길드의 [헤스]에게 귀환 보고하여 최초 토벌 보상(' + global.FRankDays.formatCurrencyV8(spec.first_clear_quest_reward.reward_copper) + ' 및 공명패)을 수령하세요!'
    : '⚔ [반복 토벌 성공] ' + spec.ko_name + ' 재토벌 완료! (누적 ' + q.clear_count + '회 · 전리품 획득)';
  if (killerPlayer.tell) killerPlayer.tell(notice);

  return {
    ok: true,
    first_clear: isFirstClear,
    clear_count: q.clear_count,
    codex_unlocked: q.codex_unlocked,
    free_rematch_unlocked: q.free_rematch_unlocked,
    boss_drops_awarded: droppedItems,
    quest_reward_given_here: false
  };
};

// 3) 헤스 보스 토벌 보고 (3단 화폐 지급 + 최초 보상 1회 잠금 + 반복 보상 일일 한도 적용)
global.FRankDays.claimBossQuestRewardFromHessV8 = function (player) {
  var state = global.FRankDays.loadPlayerState(player);
  var bState = global.FRankDays.ensurePlayerBossStateV8(state);
  var spec = global.FRankDays.getBossSpecForWorldV97 ? global.FRankDays.getBossSpecForWorldV97(player.server) : global.FRankDays.BOSS_SPECS_V8.ferrous_wroughtnaut;
  var q = bState.quests.ferrous_wroughtnaut;

  if (!q.first_cleared || q.clear_count < 1) {
    return {
      ok: false,
      reason: 'boss_not_cleared_yet',
      message: '[헤스] "아직 강철 수호자 토벌 기록이 확인되지 않았습니다."'
    };
  }

  state.reward_ledger = state.reward_ledger || {};
  if (!q.first_reward_claimed && !state.reward_ledger.v8_first_clear_ferrous_wroughtnaut) {
    q.first_reward_claimed = true;
    q.claimed_repeat_bounties = 1;
    state.reward_ledger.v8_first_clear_ferrous_wroughtnaut = true;

    var fc = spec.first_clear_quest_reward;
    bState.guild_reputation = Number(bState.guild_reputation || 0) + fc.reputation;
    if (bState.titles.indexOf(fc.title) === -1) bState.titles.push(fc.title);
    if (bState.unlocked_special_recipes.indexOf('f_rank_days:hardened_warhammer') === -1) {
      bState.unlocked_special_recipes.push('f_rank_days:hardened_warhammer');
    }
    if (state.flags && state.flags.job_training_done) {
      state.flags.job_training_done.swordsman = true;
    }
    global.FRankDays.savePlayerState(player, state);

    // 3단 화폐 보상 지급 (1골드 50실버 = 1,500동화)
    global.FRankDays.grantPlayerCurrencyV8(player, fc.reward_copper, false);

    if (player.give) {
      for (var i = 0; i < fc.bonus_items.length; i++) {
        player.give(fc.bonus_items[i].count + 'x ' + fc.bonus_items[i].id);
      }
    }

    var msgFirst =
      '[헤스] "강철 수호자 최초 토벌을 공식 인증합니다! 길드 명성 +' + fc.reputation +
      ', 보상금 ' + global.FRankDays.formatCurrencyV8(fc.reward_copper) +
      ', 칭호 [' + fc.title + '], 그리고 지정 시련 제단 전용 공명패를 지급해 드렸습니다."';
    if (player.tell) player.tell(msgFirst);

    return {
      ok: true,
      reward_type: 'FIRST_CLEAR_UNIQUE_REWARD',
      reputation_gained: fc.reputation,
      copper_gained: fc.reward_copper,
      formatted_reward: global.FRankDays.formatCurrencyV8(fc.reward_copper),
      title_unlocked: fc.title,
      message: msgFirst
    };
  }

  // 반복 토벌 현상금 정산 (일일 최대 2회 제한으로 무한 화폐 파밍 방지!)
  var unsettledRepeats = Math.max(0, Number(q.clear_count || 0) - Number(q.claimed_repeat_bounties || 1));
  if (unsettledRepeats > 0) {
    var curDay = global.FRankDays.getCurrentGameDayV8 ? global.FRankDays.getCurrentGameDayV8(player.server) : 0;
    if (q.daily_bounty_day !== curDay) {
      q.daily_bounty_day = curDay;
      q.daily_bounty_count = 0;
    }
    var remainingDailyQuota = Math.max(0, spec.max_daily_repeat_bounties - Number(q.daily_bounty_count || 0));
    if (remainingDailyQuota <= 0) {
      q.claimed_repeat_bounties = Number(q.clear_count);
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: false,
        reason: 'daily_repeat_bounty_cap_reached',
        first_clear_reward_duplicated: false,
        message: '[헤스] "금일 반복 토벌 수당 지급 한도(하루 최대 ' + spec.max_daily_repeat_bounties + '회)를 모두 소진하셨습니다. 내일 다시 정산받으실 수 있습니다."'
      };
    }

    var payableKills = Math.min(unsettledRepeats, remainingDailyQuota);
    var bountyCopper = payableKills * spec.repeat_bounty_copper;
    q.claimed_repeat_bounties = Number(q.clear_count);
    q.daily_bounty_count += payableKills;
    bState.guild_reputation = Number(bState.guild_reputation || 0) + payableKills * 5;
    global.FRankDays.savePlayerState(player, state);

    global.FRankDays.grantPlayerCurrencyV8(player, bountyCopper, false);

    var msgRep = '[헤스] "추가 토벌 ' + payableKills + '건에 대한 반복 토벌 수당(' + global.FRankDays.formatCurrencyV8(bountyCopper) + ')을 지갑에 정산해 드렸습니다."';
    if (player.tell) player.tell(msgRep);
    return {
      ok: true,
      reward_type: 'REPEAT_SUBJUGATION_BOUNTY',
      settled_kills: payableKills,
      copper_gained: bountyCopper,
      first_clear_reward_duplicated: false,
      message: msgRep
    };
  }

  return {
    ok: false,
    reason: 'already_claimed_all_clears',
    first_clear_reward_duplicated: false,
    message: '[헤스] "최초 토벌 보상은 이미 수령하셨으며, 미정산된 추가 토벌 기록이 없습니다."'
  };
};

// 4) 지정된 보스 제단(`f_rank_days:wrought_trial_altar`) 전용 소환기 (야외 임의 소환 완전 차단!)
global.FRankDays.summonWroughtBossAtAltarV8 = function (player, interactContextOpt) {
  var ctx = interactContextOpt || {};
  var srv = player ? player.server : null;
  var state = global.FRankDays.loadPlayerState(player);
  var bState = global.FRankDays.ensurePlayerBossStateV8(state);
  var q = bState.quests.ferrous_wroughtnaut;

  if (!q.free_rematch_unlocked) {
    return {
      ok: false,
      reason: 'rematch_locked_until_first_clear',
      sigil_consumed: false,
      message: '[제단 봉인] 자연 생성된 고대 철기실에서 강철 수호자를 최초 1회 토벌해야 시련 제단 재소환이 해금됩니다.'
    };
  }

  var altarC = global.FRankDays.getBossAltarCoordsV8(srv);
  var cfg = global.FRankDays.BOSS_ALTAR_CONFIG_V8;

  // 검증 A: 반드시 지정된 제단 블록(`f_rank_days:wrought_trial_altar`)과 직접 상호작용해야 함!
  var clickedBlockId = String(ctx.clicked_block_id || '');
  var bx = ctx.block_x !== undefined ? Number(ctx.block_x) : -999999;
  var by = ctx.block_y !== undefined ? Number(ctx.block_y) : -999999;
  var bz = ctx.block_z !== undefined ? Number(ctx.block_z) : -999999;

  var isExactAltarBlock =
    clickedBlockId === cfg.altar_block_id &&
    Math.abs(bx - altarC.x) <= 1 &&
    Math.abs(by - altarC.y) <= 2 &&
    Math.abs(bz - altarC.z) <= 1;

  if (!isExactAltarBlock) {
    var msgAltar =
      '[소환 거부] 보스 재소환은 임의의 야외에서 사용할 수 없습니다! 지정된 [강철 수호자의 시련 제단 (X:' +
      altarC.x + ', Y:' + altarC.y + ', Z:' + altarC.z + ')] 코어 블록에 직접 우클릭하세요.';
    if (player.tell) player.tell(msgAltar);
    return {
      ok: false,
      reason: 'not_at_designated_boss_altar',
      sigil_consumed: false,
      altar_coords: altarC,
      message: msgAltar
    };
  }

  // 검증 B: 플레이어가 실제 제단 반경(6.5m) 이내에 위치해야 함
  var pdx = Number(player.x || 0) - altarC.x;
  var pdz = Number(player.z || 0) - altarC.z;
  if (Math.sqrt(pdx * pdx + pdz * pdz) > cfg.player_interact_max_dist) {
    return {
      ok: false,
      reason: 'player_too_far_from_altar',
      sigil_consumed: false,
      message: '[시련 제단] 제단 코어에 더 가까이 다가서서 공명패를 사용하세요.'
    };
  }

  // 검증 C: 동시 소환 원천 차단 (이미 제단에 보스가 소환되어 교전 중이면 거부!)
  var activeCheck = global.FRankDays.isBossCurrentlyActiveAtAltarV8(srv);
  if (activeCheck.active) {
    var msgBusy = '[동시 소환 차단] 이미 시련 제단에 강철 수호자가 소환되어 있습니다! 기존 토벌이 끝날 때까지 추가 소환할 수 없습니다.';
    if (player.tell) player.tell(msgBusy);
    return {
      ok: false,
      reason: 'boss_already_active_at_altar',
      sigil_consumed: false,
      active_boss_uuid: activeCheck.uuid,
      message: msgBusy
    };
  }

  // 검증 D: 플레이어별 재소환 대기시간(3분) 적용 (반복 보상 어뷰징 방지)
  var now = global.FRankDays.nowMsV8 ? global.FRankDays.nowMsV8() : Date.now();
  if (now - Number(q.last_altar_summon_ms || -999999) < cfg.player_rematch_cooldown_ms) {
    var remSec = Math.ceil((cfg.player_rematch_cooldown_ms - (now - Number(q.last_altar_summon_ms))) / 1000);
    return {
      ok: false,
      reason: 'altar_rematch_on_cooldown',
      sigil_consumed: false,
      remaining_seconds: remSec,
      message: '[제단 냉각 중] 시련 제단 마력이 안정될 때까지 ' + remSec + '초 후에 다시 소환할 수 있습니다.'
    };
  }

  // 공명패 1개 차감
  if (!global.FRankDays.consumePlayerItemExact(player, 'f_rank_days:wrought_challenge_sigil', 1)) {
    return { ok: false, reason: 'missing_sigil_item', sigil_consumed: false };
  }

  q.last_altar_summon_ms = now;
  global.FRankDays.savePlayerState(player, state);

  var spawnedBossUuid = 'altar_wrought_' + now + '_' + Math.floor(Math.random() * 10000);
  var altSt = global.FRankDays.loadBossAltarStateV8(srv);
  altSt.built = true;
  altSt.active_boss_uuid = spawnedBossUuid;
  altSt.summoned_at_ms = now;
  altSt.summoner_uuid = String(player.uuid || player.username);
  global.FRankDays.saveBossAltarStateV8(srv, altSt);

  var sx = (altarC.x + 4.0).toFixed(1);
  var sy = (altarC.y + 0.1).toFixed(1);
  var sz = altarC.z.toFixed(1);
  if (srv && srv.runCommandSilent) {
    srv.runCommandSilent('summon mowziesmobs:ferrous_wroughtnaut ' + sx + ' ' + sy + ' ' + sz + ' {PersistenceRequired:1b,Tags:["f_rank_altar_boss"]}');
    if (player.username) {
      srv.runCommandSilent('playsound minecraft:block.respawn_anchor.charge master ' + player.username + ' ' + sx + ' ' + sy + ' ' + sz + ' 1.0 0.8');
    }
  }
  if (player.tell) {
    player.tell('⚔ [시련 제단 개방] 제단의 봉인이 열리며 강철 수호자가 현현했습니다! (결계 반경 ' + cfg.boss_tether_max_radius + 'm 이탈 시 중앙 귀환)');
  }

  return {
    ok: true,
    sigil_consumed: true,
    summoned: 'mowziesmobs:ferrous_wroughtnaut',
    active_boss_uuid: spawnedBossUuid,
    coords: [Number(sx), Number(sy), Number(sz)]
  };
};

// 허공에서 공명패만 우클릭할 경우 즉시 거부하고 제단 위치를 안내!
global.FRankDays.useWroughtChallengeSigilV8 = function (player, interactContextOpt) {
  return global.FRankDays.summonWroughtBossAtAltarV8(player, interactContextOpt || {});
};

// v9.7 uses actual entity UUIDs and the shared dimension-aware arena policy. Unmarked worlds keep v8 behavior.
(function(F){
  var oldActive=F.isBossCurrentlyActiveAtAltarV8,oldSummon=F.summonWroughtBossAtAltarV8;
  function enabled(server){var l=server&&F.getSerdinV97Layout&&F.getSerdinV97Layout(server);return Boolean(l&&String(l.serdinLayoutVersion||l.layoutVersion)==='9.7');}
  function center(server){var c=F.getBossAltarCoordsV8(server);return{x:Number(c.x),y:Number(c.y),z:Number(c.z),dimension:'minecraft:overworld'};}
  function now(server){return F._arenaClockV97?Number(F._arenaClockV97(server)):Date.now();}
  function ow(server){return server.overworld();}
  function entity(server,id){try{return ow(server).getEntity(Java.loadClass('java.util.UUID').fromString(String(id)));}catch(e){return null;}}
  function owned(e){return Boolean(e&&String(e.type)==='mowziesmobs:ferrous_wroughtnaut'&&F.hasEntityTag&&F.hasEntityTag(e,'f_rank_altar_boss'));}
  function alive(e){return Boolean(e&&e.isAlive&&e.isAlive()&&Number(e.health)>0);}
  function loaded(server,p){return Boolean(ow(server).hasChunkAt(new (Java.loadClass('net.minecraft.core.BlockPos'))(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z))));}
  function uuidNbt(id){var h=String(id).replace(/-/g,''),out=[];for(var i=0;i<4;i++){var v=parseInt(h.substr(i*8,8),16);out.push(v>=2147483648?v-4294967296:v);}return'[I;'+out.join(',')+']';}
  F.isArenaWorldV97=enabled;
  F.getBossSpecForWorldV97=function(server,actor){var spec=F.BOSS_SPECS_V8.ferrous_wroughtnaut;if(!enabled(server)||(actor&&String(actor.level.dimension)!=='minecraft:overworld'))return spec;
    spec=JSON.parse(JSON.stringify(spec));spec.repeatable_drops=spec.repeatable_drops.filter(function(item){return item.id!=='f_rank_days:high_tempering_core';});
    spec.first_clear_quest_reward.bonus_items=spec.first_clear_quest_reward.bonus_items.filter(function(item){return item.id!=='f_rank_days:high_tempering_core';});return spec;
  };
  F.getBossArenaTargetV97=function(server,target){
    if(!target){target=server;server=target&&(target.server||(target.level&&target.level.server));}if(!enabled(server)||!owned(target))return null;
    var st=F.loadBossAltarStateV8(server);if(st.arena_phase_v97==='RESETTING'||String(st.active_boss_uuid)!==String(target.uuid))return null;
    return{kind:'boss',center:center(server)};
  };
  F.resetBossArenaV97=function(server,reason){
    if(!enabled(server))return{ok:false,reason:'world_not_enabled'};
    var st=F.loadBossAltarStateV8(server),c=center(server),e=entity(server,st.active_boss_uuid);
    st.arena_phase_v97='RESETTING';st.reset_reason_v97=String(reason||'operator_reset');F.saveBossAltarStateV8(server,st);
    if(e){if(!owned(e))return{ok:false,reason:'foreign_entity_preserved'};e.discard();if(entity(server,st.active_boss_uuid))return{ok:false,reason:'cleanup_pending'};}
    else if(st.active_boss_uuid&&!loaded(server,st.last_position_v97||c))return{ok:false,reason:'unloaded_cleanup_pending'};
    st.active_boss_uuid=null;st.arena_phase_v97='IDLE';st.presence_v97={emptySince:null,warned:false};st.missing_since_v97=null;F.saveBossAltarStateV8(server,st);return{ok:true};
  };
  F.isBossCurrentlyActiveAtAltarV8=function(server){
    if(!enabled(server))return oldActive(server);
    var st=F.loadBossAltarStateV8(server),c=center(server),e=entity(server,st.active_boss_uuid);
    if(owned(e)&&alive(e))return{active:true,uuid:String(e.uuid)};
    // Repair legacy synthetic UUIDs only from a real, specifically tagged altar boss; never adopt a natural boss.
    var found=F.listArenaEntitiesV97(server,c,48);for(var i=0;i<found.length;i++)if(owned(found[i])&&alive(found[i])){
      st.active_boss_uuid=String(found[i].uuid);st.arena_phase_v97='ACTIVE';st.last_position_v97={x:Number(found[i].x),y:Number(found[i].y),z:Number(found[i].z)};F.saveBossAltarStateV8(server,st);return{active:true,uuid:st.active_boss_uuid};
    }
    if(st.active_boss_uuid)return{active:true,uuid:st.active_boss_uuid,reason:'awaiting_safe_cleanup'};
    return{active:false};
  };
  F.summonWroughtBossAtAltarV8=function(player,context){
    var server=player&&player.server;if(!enabled(server))return oldSummon(player,context);
    var ctx=context||{},c=center(server),cfg=F.BOSS_ALTAR_CONFIG_V8,state=F.loadPlayerState(player),q=F.ensurePlayerBossStateV8(state).quests.ferrous_wroughtnaut;
    if(!q.free_rematch_unlocked)return{ok:false,reason:'rematch_locked_until_first_clear',sigil_consumed:false};
    if(String(player.level.dimension)!==c.dimension)return{ok:false,reason:'wrong_dimension',sigil_consumed:false};
    if(String(ctx.clicked_block_id)!==cfg.altar_block_id||Number(ctx.block_x)!==c.x||Number(ctx.block_y)!==c.y||Number(ctx.block_z)!==c.z)return{ok:false,reason:'not_at_designated_boss_altar',sigil_consumed:false};
    var dx=Number(player.x)-c.x,dy=Number(player.y)-c.y,dz=Number(player.z)-c.z;if(dx*dx+dy*dy+dz*dz>cfg.player_interact_max_dist*cfg.player_interact_max_dist)return{ok:false,reason:'player_too_far_from_altar',sigil_consumed:false};
    if(!loaded(server,c)||String(ow(server).getBlock(c.x,c.y,c.z).id)!==cfg.altar_block_id)return{ok:false,reason:'altar_not_ready',sigil_consumed:false};
    var active=F.isBossCurrentlyActiveAtAltarV8(server);if(active.active)return{ok:false,reason:'boss_already_active_at_altar',sigil_consumed:false};
    var time=now(server);if(time-Number(q.last_altar_summon_ms||-999999)<cfg.player_rematch_cooldown_ms)return{ok:false,reason:'altar_rematch_on_cooldown',sigil_consumed:false};
    if(!F.consumePlayerItemExact(player,'f_rank_days:wrought_challenge_sigil',1))return{ok:false,reason:'missing_sigil_item',sigil_consumed:false};
    var id=String(Java.loadClass('java.util.UUID').randomUUID()),st=F.loadBossAltarStateV8(server),spawn={x:c.x+4,y:c.y+.1,z:c.z};
    st.built=true;st.active_boss_uuid=id;st.arena_phase_v97='SUMMONING';st.summoned_at_ms=time;st.summoner_uuid=String(player.uuid);st.presence_v97={emptySince:null,warned:false};st.last_position_v97=spawn;F.saveBossAltarStateV8(server,st);
    var result=server.runCommandSilent('execute in '+c.dimension+' run summon mowziesmobs:ferrous_wroughtnaut '+Number(spawn.x).toFixed(4)+' '+Number(spawn.y).toFixed(4)+' '+Number(spawn.z).toFixed(4)+' {UUID:'+uuidNbt(id)+',PersistenceRequired:1b,Tags:["f_rank_altar_boss"]}');
    var actual=entity(server,id);if(Number(result)<=0||!owned(actual)||!alive(actual)){st.arena_phase_v97='RECOVERY';st.summon_review_pending_v97=true;F.saveBossAltarStateV8(server,st);return{ok:false,reason:'summon_unconfirmed_review_required',sigil_consumed:true};}
    st.arena_phase_v97='ACTIVE';F.saveBossAltarStateV8(server,st);q.last_altar_summon_ms=time;F.savePlayerState(player,state);
    if(player.tell)player.tell('⚔ [시련 제단 개방] 강철 수호자가 현현했습니다. 24m 결계 안에서 도전하세요.');
    return{ok:true,sigil_consumed:true,summoned:'mowziesmobs:ferrous_wroughtnaut',active_boss_uuid:id,coords:[spawn.x,spawn.y,spawn.z]};
  };
  F.tickBossArenaV97=function(server,tick){
    if(!enabled(server)||tick%5!==0)return;
    var st=F.loadBossAltarStateV8(server);if(!st.active_boss_uuid)return;
    if(st.arena_phase_v97==='RESETTING'){F.resetBossArenaV97(server,st.reset_reason_v97);return;}
    if(st.arena_phase_v97==='RECOVERY')return;
    var c=center(server),e=entity(server,st.active_boss_uuid),time=now(server);
    if(!owned(e)||!alive(e)){
      if(!loaded(server,st.last_position_v97||c))return;
      if(st.missing_since_v97===undefined||st.missing_since_v97===null||time<st.missing_since_v97)st.missing_since_v97=time;
      F.saveBossAltarStateV8(server,st);if(time-st.missing_since_v97>=15000)F.resetBossArenaV97(server,'missing_boss_no_victory');return;
    }
    st.missing_since_v97=null;st.arena_phase_v97='ACTIVE';st.last_position_v97={x:Number(e.x),y:Number(e.y),z:Number(e.z)};
    st.presence_v97=F.ARENA_CORE_V97.presence(st.presence_v97,F.getArenaPlayersV97(server),c,F.getArenaPolicyV97('boss'),time);F.saveBossAltarStateV8(server,st);
    if(st.presence_v97.warning){var list=F.getArenaPlayersV97(server);for(var i=0;i<list.length;i++)if(list[i].dimension===c.dimension&&list[i].raw&&list[i].raw.tell)list[i].raw.tell('[시련 제단] 도전자가 없습니다. 10초 뒤 제단이 다시 봉인됩니다.');}
    if(st.presence_v97.reset){F.resetBossArenaV97(server,'empty_arena_no_surviving_players');return;}
    F.applyArenaSoftLeashToEntityV86(server,e,c,21.8,25.5,{x:c.x+4,y:c.y+.1,z:c.z});
    if(tick%10===0)F.renderArenaBoundaryRingV86(server,c,24,'SOUL_FIRE_FLAME');
  };
})(global.FRankDays);

// =========================================================================
// 5) 확장 음식 의뢰 및 마을 상점 3단 화폐(동화·실버·골드) 연동
// =========================================================================
global.FRankDays.completeVillageCulinaryOrderV8 = function (player, npcId) {
  var ecoCfg = global.FRankDays.getEconomyConfigV8();
  var tr = ecoCfg.npc_commissions_and_trades || {};

  if (npcId === 'darim') {
    var rwD = Number(tr.darim_barley_bread_4_reward_copper || 80); // 8실버
    if (!global.FRankDays.consumePlayerItemExact(player, 'f_rank_days:brion_barley_bread', 4)) {
      return { ok: false, reason: 'insufficient_barley_bread', message: '[다림] "브리온 농가 보리빵 4개를 구워 오시면 ' + global.FRankDays.formatCurrencyV8(rwD) + '와 무기 단련석 1개로 보답할게요!"' };
    }
    global.FRankDays.grantPlayerCurrencyV8(player, rwD, false);
    if (player.give) player.give('1x f_rank_days:tempering_stone');
    if (global.FRankDays.addNpcAffinity) global.FRankDays.addNpcAffinity(player, 'darim', 6);
    return {
      ok: true,
      npc: 'darim',
      reward_copper: rwD,
      rewarded: [global.FRankDays.formatCurrencyV8(rwD), '1x f_rank_days:tempering_stone'],
      message: '[다림] "고마워요! 따끈한 보리빵 값으로 ' + global.FRankDays.formatCurrencyV8(rwD) + '와 단련석 1개를 챙겨 드렸어요!"'
    };
  }

  if (npcId === 'gori') {
    var rwG = Number(tr.gori_berry_tart_2_reward_copper || 120); // 12실버
    if (!global.FRankDays.consumePlayerItemExact(player, 'f_rank_days:harvest_berry_tart', 2)) {
      return { ok: false, reason: 'insufficient_berry_tart', message: '[고리] "손님들께 내놓을 수확제 산딸기 타르트 2개를 만들어 주시면 ' + global.FRankDays.formatCurrencyV8(rwG) + '를 드릴게요!"' };
    }
    global.FRankDays.grantPlayerCurrencyV8(player, rwG, false);
    if (player.give) player.give('1x f_rank_days:hearth_potato_soup');
    if (global.FRankDays.addNpcAffinity) global.FRankDays.addNpcAffinity(player, 'gori', 6);
    return {
      ok: true,
      npc: 'gori',
      reward_copper: rwG,
      rewarded: [global.FRankDays.formatCurrencyV8(rwG), '1x f_rank_days:hearth_potato_soup'],
      message: '[고리] "향기가 정말 좋네요! 약속한 ' + global.FRankDays.formatCurrencyV8(rwG) + '와 감자 수프 한 그릇이에요."'
    };
  }

  if (npcId === 'roman') {
    if (!global.FRankDays.consumePlayerItemExact(player, 'f_rank_days:alchemist_clear_tea', 2)) {
      return { ok: false, reason: 'insufficient_clear_tea', message: '[로만] "밤샘 조제 때 마실 로만식 맑은 약초차 2병을 달여 와. 보수로 정제된 마력석 2개를 주지."' };
    }
    if (player.give) player.give('2x f_rank_days:refined_mana_stone');
    if (global.FRankDays.addNpcAffinity) global.FRankDays.addNpcAffinity(player, 'roman', 8);
    return {
      ok: true,
      npc: 'roman',
      rewarded: ['2x f_rank_days:refined_mana_stone'],
      message: '[로만] "흠, 향이 깔끔하군. 약속대로 정제된 마력석 2개다."'
    };
  }

  return { ok: false, reason: 'unsupported_culinary_npc' };
};

// NPC 3단 화폐 상점 구매 헬퍼 (고리 감자 수프 · 나우 단련석 · 나우 강화망치)
global.FRankDays.buyNpcCurrencyShopItemV8 = function (player, itemKey) {
  var ecoCfg = global.FRankDays.getEconomyConfigV8();
  var tr = ecoCfg.npc_commissions_and_trades || {};
  var catalog = {
    hearth_potato_soup: { id: 'f_rank_days:hearth_potato_soup', count: 1, price: Number(tr.gori_potato_soup_price_copper || 50), label: '화톳불 감자 수프' },
    tempering_stone: { id: 'f_rank_days:tempering_stone', count: 1, price: Number(tr.nau_tempering_stone_price_copper || 60), label: '무기 단련석' },
    enhancement_hammer: { id: 'f_rank_days:enhancement_hammer', count: 1, price: Number(tr.nau_enhancement_hammer_price_copper || 350), label: '휴대용 단련 강화망치(30회)' }
  };
  var spec = catalog[itemKey];
  if (!spec) return { ok: false, reason: 'unknown_shop_item' };

  var pay = global.FRankDays.chargePlayerCurrencyV8(player, spec.price);
  if (!pay.ok) return pay;

  if (player.give) {
    player.give(spec.count + 'x ' + spec.id);
  }
  var msg = '[상점 구매] ' + spec.label + ' 구매 완료! (-' + global.FRankDays.formatCurrencyV8(spec.price) + ')';
  if (player.tell) player.tell(msg);
  return { ok: true, item_id: spec.id, paid_copper: spec.price, message: msg };
};

// 기존 NPC 선호 선물 확장
(function extendExistingNpcPreferredGiftsV8() {
  var defs = global.FRankDays.NPC_DIALOG_DEFS;
  if (!defs) return;
  if (defs.darim && Array.isArray(defs.darim.preferred_gifts) && defs.darim.preferred_gifts.indexOf('f_rank_days:brion_barley_bread') === -1) {
    defs.darim.preferred_gifts.push('f_rank_days:brion_barley_bread');
  }
  if (defs.gori && Array.isArray(defs.gori.preferred_gifts) && defs.gori.preferred_gifts.indexOf('f_rank_days:harvest_berry_tart') === -1) {
    defs.gori.preferred_gifts.push('f_rank_days:harvest_berry_tart');
  }
  if (defs.roman && Array.isArray(defs.roman.preferred_gifts) && defs.roman.preferred_gifts.indexOf('f_rank_days:alchemist_clear_tea') === -1) {
    defs.roman.preferred_gifts.push('f_rank_days:alchemist_clear_tea');
  }
})();

// =========================================================================
// KubeJS 실시간 이벤트 바인딩:
// 1. 서버 로드 시 시련 제단 자동 조성
// 2. 제단 코어 블록에 공명패 우클릭 시 소환 / 일반 허공 우클릭 시 안내
// 3. 제단 반경 28m 타 플레이어 건축·파괴 보호 + 보스 반경 26m 이탈 시 제단 귀환
// ※ event.cancel()은 절대 try/catch 안에 두지 않음!
// =========================================================================
if (typeof ServerEvents !== 'undefined') {
  if (ServerEvents.loaded) {
    ServerEvents.loaded(function (event) {
      if (event && event.server) {
        global.FRankDays.ensureWroughtBossAltarBuiltV8(event.server, false);
      }
    });
  }
  if (ServerEvents.tick) {
    ServerEvents.tick(function (event) {
      var srv = event.server;
      if (!srv) return;
      global.FRankDays._altarTickCount = Number(global.FRankDays._altarTickCount || 0) + 1;
      if(global.FRankDays.isArenaWorldV97 && global.FRankDays.isArenaWorldV97(srv)){global.FRankDays.tickBossArenaV97(srv,global.FRankDays._altarTickCount);return;}
      if (global.FRankDays._altarTickCount % 40 !== 0) return; // 2초마다 제단 보스 이탈 여부 감시

      var ow = typeof srv.overworld === 'function' ? srv.overworld() : null;
      if (!ow || typeof ow.getEntities !== 'function') return;
      var altarC = global.FRankDays.getBossAltarCoordsV8(srv);
      var maxR = global.FRankDays.BOSS_ALTAR_CONFIG_V8.boss_tether_max_radius;

      try {
        var ents = ow.getEntities() || [];
        for (var i = 0; i < ents.length; i++) {
          var e = ents[i];
          if (e && String(e.type) === 'mowziesmobs:ferrous_wroughtnaut' && global.FRankDays.hasEntityTag && global.FRankDays.hasEntityTag(e, 'f_rank_altar_boss')) {
            var dx = Number(e.x || 0) - altarC.x;
            var dz = Number(e.z || 0) - altarC.z;
            if (Math.sqrt(dx * dx + dz * dz) > maxR && srv.runCommandSilent && e.uuid) {
              // 타 플레이어 건축물 쪽으로 보스를 유인하는 행위 원천 차단!
              srv.runCommandSilent('tp ' + e.uuid + ' ' + (altarC.x + 2) + ' ' + (altarC.y + 0.2) + ' ' + altarC.z);
            }
          }
        }
      } catch (err) {}
    });
  }
}

if (typeof BlockEvents !== 'undefined') {
  if (BlockEvents.rightClicked) {
    BlockEvents.rightClicked(function (event) {
      if (!event || !event.block || !event.player) return;
      var bid = String(event.block.id || '');
      if (bid !== global.FRankDays.BOSS_ALTAR_CONFIG_V8.altar_block_id) return;

      var mh = event.player.mainHandItem;
      if (mh && !mh.empty && String(mh.id) === 'f_rank_days:wrought_challenge_sigil') {
        global.FRankDays.summonWroughtBossAtAltarV8(event.player, {
          clicked_block_id: bid,
          block_x: event.block.x,
          block_y: event.block.y,
          block_z: event.block.z
        });
        if (typeof event.cancel === 'function') {
          event.cancel();
        }
      } else if (event.player.tell) {
        event.player.tell('[강철 수호자의 시련 제단] 오른손에 [고대 철기 재도전 공명패]를 들고 이 제단 코어를 우클릭하면 보스를 재소환합니다.');
      }
    });
  }

  if (BlockEvents.placed) {
    BlockEvents.placed(function (event) {
      if (!event || !event.block || !event.player) return;
      if (event.player.creative) return;
      if (global.FRankDays.isInsideBossAltarSanctuaryV8(event.server, event.block.x, event.block.z, String(event.player.level.dimension))) {
        if (event.player.tell) {
          event.player.tell('[결계 보호 구역] 보스 시련 제단 반경 28블록 내에는 건축물을 설치할 수 없습니다.');
        }
        if (typeof event.cancel === 'function') {
          event.cancel();
        }
      }
    });
  }

  if (BlockEvents.broken) {
    BlockEvents.broken(function (event) {
      if (!event || !event.block || !event.player) return;
      if (event.player.creative) return;
      if (global.FRankDays.isInsideBossAltarSanctuaryV8(event.server, event.block.x, event.block.z, String(event.player.level.dimension))) {
        if (event.player.tell) {
          event.player.tell('[결계 보호 구역] 보스 시련 제단 결계 구조물은 파괴할 수 없습니다.');
        }
        if (typeof event.cancel === 'function') {
          event.cancel();
        }
      }
    });
  }
}

if (typeof EntityEvents !== 'undefined' && EntityEvents.death) {
  EntityEvents.death(function (event) {
    var ent = event.entity;
    if (!ent || !ent.type) return;
    // One death-time snapshot handles all eight bosses (and the vanilla dragon).
    // Do not run the legacy killer-only reward path after a shared v99 receipt.
    if (global.FRankDays.isTrackedBossV99 && global.FRankDays.isTrackedBossV99(String(ent.type))) {
      var actual = event.source && event.source.actual ? event.source.actual : null;
      global.FRankDays.handleBossDeathV99(ent, actual);
      return;
    }
    if (String(ent.type) === 'mowziesmobs:ferrous_wroughtnaut') {
      var killer = event.source && event.source.actual ? event.source.actual : null;
      if (killer && (killer.username || (typeof killer.isPlayer === 'function' && killer.isPlayer()))) {
        global.FRankDays.handleBossDefeatedV8(killer, String(ent.type), ent.uuid);
      } else if (event.server) {
        // 플레이어 외 원인으로 사망해도 제단 잠금 해제
        var altSt = global.FRankDays.loadBossAltarStateV8(event.server);
        if(!global.FRankDays.isArenaWorldV97||!global.FRankDays.isArenaWorldV97(event.server)||String(altSt.active_boss_uuid)===String(ent.uuid)){
          altSt.active_boss_uuid = null;altSt.arena_phase_v97='IDLE';altSt.presence_v97={emptySince:null,warned:false};
          global.FRankDays.saveBossAltarStateV8(event.server, altSt);
        }
      }
    }
  });
}

if (typeof ItemEvents !== 'undefined') {
  if (ItemEvents.rightClicked) {
    ItemEvents.rightClicked(function (event) {
      if (!event || !event.item || !event.player) return;
      if (String(event.item.id) === 'f_rank_days:wrought_challenge_sigil') {
        // 블록 우클릭이 아닌 허공 우클릭 시 제단 좌표 안내만 출력하고 아이템 소비 없음!
        global.FRankDays.summonWroughtBossAtAltarV8(event.player, { clicked_block_id: 'minecraft:air' });
      }
    });
  }
  if (ItemEvents.foodEaten) {
    ItemEvents.foodEaten(function (event) {
      if (!event || !event.item || !event.player) return;
      var fid = String(event.item.id);
      if (fid === 'f_rank_days:alchemist_clear_tea' && event.player.server && event.player.server.runCommandSilent) {
        event.player.server.runCommandSilent('effect clear ' + event.player.username + ' minecraft:weakness');
        event.player.server.runCommandSilent('effect clear ' + event.player.username + ' minecraft:mining_fatigue');
      }
      if (fid === 'f_rank_days:golden_wheat_stew') {
        var pk = String(event.player.uuid || event.player.username);
        var now = global.FRankDays.nowMsV8();
        var prev = Number(global.FRankDays._foodBuffCooldowns[pk] || 0);
        if (now - prev < 30000 && event.player.server && event.player.server.runCommandSilent) {
          event.player.server.runCommandSilent('effect clear ' + event.player.username + ' minecraft:absorption');
        } else {
          global.FRankDays._foodBuffCooldowns[pk] = now;
        }
      }
    });
  }
}
