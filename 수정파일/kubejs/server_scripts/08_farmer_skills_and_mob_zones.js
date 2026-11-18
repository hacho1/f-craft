// 《F급의 나날》 KubeJS 6 Server Script - Farmer Skill Tree, 4-Zone Animal Ecology (Alex's Mobs 1.22.9), Feeding/Care & Safe Zone (v7.1)
// 파일 경로: kubejs/server_scripts/08_farmer_skills_and_mob_zones.js
// 핵심 설계:
// 1. 실제 Alex's Mobs 1.22.9에 존재하는 검증된 엔티티만 사용하여 4권역 생태계(마을 주변·숲·강과 호수·먼 지역) 구성
// 2. 동물 관찰 + 먹이 주기·돌봄 + 생활 퀘스트 마일스톤 보상(미구현 동물 F급 능력은 임의 활성화하지 않음!)
// 3. 브리온 시작 마을 경계 내 공격적 야생동물·위험 몬스터 자연 스폰 원천 차단

global.FRankDays = global.FRankDays || {};

global.FRankDays.BRION_BLOCKED_DANGER_MOBS = [
  'mowziesmobs:ferrous_wroughtnaut',
  'mowziesmobs:frostmaw',
  'mowziesmobs:umvuthi',
  'mowziesmobs:foliaath',
  'mowziesmobs:naga',
  'mowziesmobs:bluff',
  'alexsmobs:grizzly_bear',
  'alexsmobs:tiger',
  'alexsmobs:crocodile',
  'alexsmobs:anaconda',
  'alexsmobs:komodo_dragon',
  'alexsmobs:crimson_mosquito',
  'alexsmobs:murmur',
  'alexsmobs:dropbear',
  'alexsmobs:bone_serpent'
];

global.FRankDays.VANILLA_HOSTILE_MOBS = [
  'minecraft:zombie',
  'minecraft:zombie_villager',
  'minecraft:husk',
  'minecraft:skeleton',
  'minecraft:stray',
  'minecraft:creeper',
  'minecraft:spider',
  'minecraft:cave_spider',
  'minecraft:witch',
  'minecraft:enderman',
  'minecraft:phantom',
  'minecraft:pillager',
  'minecraft:vindicator'
];

// [v7.1 4권역 생태계] 실제 바닐라 + Alex's Mobs 1.22.9 공식 레지스트리 엔티티만 등록!
global.FRankDays.ECOLOGY_ZONES = {
  village: [
    'minecraft:cow',
    'minecraft:sheep',
    'minecraft:chicken',
    'minecraft:pig',
    'minecraft:rabbit',
    'minecraft:horse',
    'minecraft:bee',
    'alexsmobs:crow',
    'alexsmobs:blue_jay',
    'alexsmobs:hummingbird',
    'alexsmobs:raccoon',
    'alexsmobs:flutter'
  ],
  forest: [
    'alexsmobs:moose',
    'alexsmobs:sugar_glider',
    'alexsmobs:bald_eagle',
    'alexsmobs:tasmanian_devil',
    'alexsmobs:capuchin_monkey'
  ],
  river_lake: [
    'alexsmobs:catfish',
    'alexsmobs:terrapin',
    'alexsmobs:mudskipper',
    'alexsmobs:lobster',
    'alexsmobs:platypus',
    'alexsmobs:seagull'
  ],
  distant: [
    'alexsmobs:bison',
    'alexsmobs:gazelle',
    'alexsmobs:grizzly_bear',
    'alexsmobs:tiger',
    'alexsmobs:crocodile',
    'alexsmobs:anaconda',
    'alexsmobs:komodo_dragon'
  ]
};

// 관찰·돌봄 인정 전체 평화/야생 생물 리스트 병합
global.FRankDays.PEACEFUL_OBSERVABLE_ANIMALS = []
  .concat(global.FRankDays.ECOLOGY_ZONES.village)
  .concat(global.FRankDays.ECOLOGY_ZONES.forest)
  .concat(global.FRankDays.ECOLOGY_ZONES.river_lake)
  .concat(['alexsmobs:bison', 'alexsmobs:gazelle']);

global.FRankDays.ANIMAL_FEED_ITEMS = [
  'minecraft:wheat',
  'minecraft:wheat_seeds',
  'minecraft:carrot',
  'minecraft:apple',
  'minecraft:sweet_berries',
  'minecraft:cod',
  'minecraft:salmon',
  'minecraft:dandelion',
  'minecraft:honeycomb'
];

global.FRankDays.HIGH_TIER_BOSS_WEAPONS = [
  'mowziesmobs:wrought_axe',
  'mowziesmobs:ice_crystal',
  'mowziesmobs:sol_visage',
  'mowziesmobs:earthrend_gauntlet'
];

if (typeof ServerEvents !== 'undefined' && ServerEvents.recipes) {
  ServerEvents.recipes(function (event) {
    event.shapeless('3x minecraft:bone_meal', [
      'minecraft:wheat',
      'minecraft:wheat',
      'minecraft:wheat_seeds',
      'minecraft:wheat_seeds'
    ]).id('f_rank_days:straw_compost_bonemeal');

    event.shapeless('2x minecraft:podzol', [
      'minecraft:dirt',
      'minecraft:dirt',
      'minecraft:bone_meal',
      'minecraft:brown_mushroom'
    ]).id('f_rank_days:rich_garden_podzol');

    event.shapeless('2x minecraft:golden_carrot', [
      'minecraft:bread',
      'minecraft:carrot',
      'minecraft:baked_potato'
    ]).id('f_rank_days:farmer_field_lunch');
  });
}

global.FRankDays.isFarmerCertifiedEOrHigher = function (state) {
  var g = state.job_licenses.farmer ? state.job_licenses.farmer.grade : 'UNREGISTERED';
  return global.FRankDays.GRADE_ORDER.indexOf(g) >= global.FRankDays.GRADE_ORDER.indexOf('E');
};

global.FRankDays.classifyAnimalZone = function (entityId) {
  var eid = String(entityId || '');
  var keys = ['village', 'forest', 'river_lake', 'distant'];
  for (var i = 0; i < keys.length; i++) {
    var zk = keys[i];
    if (global.FRankDays.ECOLOGY_ZONES[zk].indexOf(eid) !== -1) {
      return zk;
    }
  }
  return null;
};

BlockEvents.rightClicked(function (event) {
  if(global.FRankDays.handleFarmerRightClickPhase4){global.FRankDays.handleFarmerRightClickPhase4(event);return;}
  var player = event.player;
  if (!player || !event.block) return;

  var heldItem = event.item && event.item.id ? event.item : player.mainHandItem;
  var heldId = heldItem && heldItem.id ? String(heldItem.id) : '';
  if (heldId.indexOf('_hoe') === -1) return;

  var blockId = String(event.block.id || '');
  var state = global.FRankDays.loadPlayerState(player);

  if (
    (blockId === 'minecraft:dirt' || blockId === 'minecraft:grass_block' || blockId === 'minecraft:dirt_path') &&
    global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_1_basic')
  ) {
    if (Math.random() < 0.25 && player.mainHandItem && typeof player.mainHandItem.setDamageValue === 'function') {
      var curDmg = Number(player.mainHandItem.damageValue || 0);
      if (curDmg > 0) {
        player.mainHandItem.setDamageValue(curDmg - 1);
      }
    }
  }

  if (
    (player.crouching || player.shiftKeyDown) &&
    global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_2_soil')
  ) {
    var prefix = state.special_ability.ability_id === 'seed_sense' ? '[토양 관리 + 흙내음]' : '[농부 스킬: 토양 관리]';
    if (blockId === 'minecraft:farmland') {
      var moist = global.FRankDays.getBlockProp(event.block, 'moisture') || '0';
      if (player.tell) {
        player.tell(prefix + ' 경작지 수분 ' + moist + '/7 단계 (적정 파종 상태: ' + (parseInt(moist, 10) >= 4 ? '양호' : '물길 보강 권장') + ')');
      }
      return;
    }
    var inspectAge = global.FRankDays.getBlockProp(event.block, 'age');
    if (inspectAge !== undefined) {
      var maxAge = blockId === 'minecraft:beetroots' ? 3 : 7;
      if (player.tell) {
        player.tell(
          prefix +
            ' 작물 생육 ' +
            inspectAge +
            '/' +
            maxAge +
            ' 단계 (' +
            (parseInt(inspectAge, 10) >= maxAge ? '수확 적기!' : '생장 중') +
            ')'
        );
      }
      return;
    }
  }

  var cropMap = {
    'minecraft:wheat': { maxAge: 7, drop: '2x minecraft:wheat', seed: 'minecraft:wheat_seeds' },
    'minecraft:carrots': { maxAge: 7, drop: '2x minecraft:carrot', seed: null },
    'minecraft:potatoes': { maxAge: 7, drop: '2x minecraft:potato', seed: null },
    'minecraft:beetroots': { maxAge: 3, drop: '2x minecraft:beetroot', seed: 'minecraft:beetroot_seeds' }
  };

  if (
    !player.crouching &&
    !player.shiftKeyDown &&
    cropMap[blockId] &&
    global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_4_advanced')
  ) {
    var cInfo = cropMap[blockId];
    var curAge = parseInt(global.FRankDays.getBlockProp(event.block, 'age') || '0', 10);
    if (curAge < cInfo.maxAge) return;

    if (!global.FRankDays.isFarmerCertifiedEOrHigher(state)) {
      if (player.tell) {
        player.tell(
          '[고급 재배 안내] 밭흙 보존 자동 재파종 기술은 길드 공인 [농부 E급] 이상 자격 취득 시 활성화됩니다! (일반 수확은 언제든 자유롭게 가능합니다.)'
        );
      }
      return;
    }

    // Only reward a harvest after the mature block was actually replanted in this dimension.
    if (!player.server || !player.server.runCommandSilent || event.block.x === undefined) return;
    var harvestDimension = String(player.level.dimension);
    var replanted = player.server.runCommandSilent(
      'execute in ' + harvestDimension + ' run setblock ' +
      Math.floor(event.block.x) + ' ' + Math.floor(event.block.y) + ' ' + Math.floor(event.block.z) + ' ' + blockId + '[age=0]'
    );
    if (Number(replanted) <= 0) return;
    if (typeof event.cancel === 'function') event.cancel();

    state.job_licenses.farmer.stats.mature_harvested += 1;
    var earnedHarvestBonus = global.FRankDays.markFarmerHarvestMilestone(player, state);
    global.FRankDays.savePlayerState(player, state);

    if (player.give) {
      player.give(cInfo.drop);
      if (cInfo.seed) player.give(cInfo.seed);
      if (earnedHarvestBonus) player.give('minecraft:golden_carrot');
    }
    if (player.tell) {
      player.tell('[고급 재배] 경작지를 상하게 하지 않고 작물을 거둔 뒤 새 종자를 가지런히 재파종했습니다!');
    }
  }
});

global.FRankDays.markFarmerHarvestMilestone = function (player, state) {
  if (!global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_5_expert') ||
      !global.FRankDays.isFarmerCertifiedEOrHigher(state)) return false;
  var total = Number(state.job_licenses.farmer.stats.mature_harvested || 0);
  var key = 'expert_harvest_milestone_' + total;
  if (total <= 0 || total % 20 !== 0 || state.reward_ledger[key]) return false;
  state.reward_ledger[key] = true;
  return true;
};

BlockEvents.broken(function (event) {
  if(global.FRankDays.handleFarmerBrokenPhase4){global.FRankDays.handleFarmerBrokenPhase4(event);return;}
  var player = event.player;
  if (!player || !event.block) return;
  var blockId = String(event.block.id || '');

  var harvestDrops = {
    'minecraft:wheat': { maxAge: 7, bonusItem: 'minecraft:wheat' },
    'minecraft:carrots': { maxAge: 7, bonusItem: 'minecraft:carrot' },
    'minecraft:potatoes': { maxAge: 7, bonusItem: 'minecraft:potato' },
    'minecraft:beetroots': { maxAge: 3, bonusItem: 'minecraft:beetroot' }
  };
  var hSpec = harvestDrops[blockId];
  if (!hSpec) return;

  var age = parseInt(global.FRankDays.getBlockProp(event.block, 'age') || '0', 10);
  if (age < hSpec.maxAge) return;

  var state = global.FRankDays.loadPlayerState(player);

  if (global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_3_research')) {
    var chance = state.special_ability.ability_id === 'seed_sense' ? 0.20 : 0.15;
    var roll = typeof event.deterministicRoll === 'number' ? event.deterministicRoll : Math.random();
    if (roll < chance && player.give) {
      player.give(hSpec.bonusItem);
      if (player.tell) {
        player.tell('[작물 연구] 선별 재배법 덕분에 품질 좋은 수확물(' + hSpec.bonusItem + ') 1개를 더 거두었습니다!');
      }
    }
  }

  if (
    global.FRankDays.hasEntityTag(player, 'frank_skill_farmer_5_expert') &&
    global.FRankDays.isFarmerCertifiedEOrHigher(state)
  ) {
    // 02_farmer_exam already counts every mature crop once, before this handler.
    if (global.FRankDays.markFarmerHarvestMilestone(player, state)) {
      global.FRankDays.savePlayerState(player, state);
      if (player.give) {
        player.give('minecraft:golden_carrot');
      }
      if (player.tell) {
        player.tell('[농업 전문가] 20번째 완숙 수확 결실로 특등 품종 《황금 당근》 1개를 수확했습니다!');
      }
    }
  }
});

global.FRankDays.isInsideBrionSafeBoundary = function (server, x, z) {
  var anchor = global.FRankDays.getVillageAnchor(server);
  if (!anchor || !anchor.built) return false;
  var dx = Number(x || 0) - anchor.x;
  var dz = Number(z || 0) - anchor.z;

  if (anchor.layout_version === 6) {
    return Math.sqrt(dx * dx + dz * dz) <= 64.0;
  }

  var inMainTownRect = dx >= -84 && dx <= 78 && dz >= -82 && dz <= 82;
  var inNorthGateAndBridgeZone = dx >= -18 && dx <= 18 && dz >= -108 && dz <= -82;
  var inSouthGateZone = dx >= -18 && dx <= 18 && dz >= 82 && dz <= 92;
  var inWestTerraceZone = dx >= -92 && dx <= -76 && dz >= -20 && dz <= 16;
  return inMainTownRect || inNorthGateAndBridgeZone || inSouthGateZone || inWestTerraceZone;
};

global.FRankDays.isInsideCentralPlazaSanctuary = function (server, x, z) {
  var anchor = global.FRankDays.getVillageAnchor(server);
  if (!anchor || !anchor.built) return false;
  var dx = Number(x || 0) - anchor.x;
  var dz = Number(z || 0) - anchor.z;
  return dx >= -18 && dx <= 18 && dz >= -18 && dz <= 18;
};

global.FRankDays.shouldBlockDangerSpawnInBrion = function (server, entityId, x, z, spawnType) {
  var reason = String(spawnType || '').toUpperCase();
  if (reason === 'COMMAND' || reason === 'SPAWN_EGG') return false;
  var eid = String(entityId || '');
  if (typeof global.FRankDays.isFcraftV9World === 'function' && global.FRankDays.isFcraftV9World(server)) {
    var cfg = global.FRankDays.FCRAFT_CONFIG, regions = cfg.regions || [];
    var hostile = global.FRankDays.VANILLA_HOSTILE_MOBS.indexOf(eid) !== -1 || global.FRankDays.BRION_BLOCKED_DANGER_MOBS.indexOf(eid) !== -1 || eid.indexOf('born_in_chaos_v1:') === 0;
    for (var ri = 0; hostile && ri < regions.length; ri++) {
      var safe = regions[ri], bounds = safe.bounds;
      if (safe.safeStart && safe.dimension === 'minecraft:overworld' && x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) return true;
    }
  }

  if (
    global.FRankDays.VANILLA_HOSTILE_MOBS.indexOf(eid) !== -1 &&
    global.FRankDays.isInsideCentralPlazaSanctuary(server, x, z)
  ) {
    return true;
  }

  var isDanger =
    global.FRankDays.BRION_BLOCKED_DANGER_MOBS.indexOf(eid) !== -1 ||
    eid.indexOf('born_in_chaos_v1:') === 0;
  if (!isDanger) return false;

  return global.FRankDays.isInsideBrionSafeBoundary(server, x, z);
};

if (typeof EntityEvents !== 'undefined' && EntityEvents.checkSpawn) {
  EntityEvents.checkSpawn(function (event) {
    var ent = event.entity;
    if (!ent) return;
    // spawned also fires for saved entities. Only inspect new overworld spawns.
    var level = event.level || ent.level;
    if (!level || String(level.dimension) !== 'minecraft:overworld') return;
    var eid = String(ent.type || ent.id || '');
    var srv = event.server || ent.server;
    // v9.7 verified islands use the shared Forge + fresh-entity policy.
    if (global.FRankDays.shouldHandleSerdinSpawnV97 && global.FRankDays.shouldHandleSerdinSpawnV97(srv)) return;
    if (global.FRankDays.shouldBlockDangerSpawnInBrion(srv, eid, event.x, event.z, event.type)) {
      if (typeof event.cancel === 'function') {
        event.cancel();
      }
    }
  });
}

// [v7.1 확장] 4권역 동물 발견 도감 기록 + 먹이 주기·돌봄 + 생활 퀘스트 마일스톤 보상 (1회 지급 보장!)
global.FRankDays.recordAnimalObservation = function (player, entityId, heldItemIdOpt, consumedFeed) {
  var eid = String(entityId || '');
  var zoneKey = global.FRankDays.classifyAnimalZone(eid);
  if (global.FRankDays.PEACEFUL_OBSERVABLE_ANIMALS.indexOf(eid) === -1) {
    return {
      ok: false,
      reason: 'not_peaceful_observable',
      message: '관찰·돌봄 기록 대상인 온순·야생 동물이 아닙니다: ' + eid
    };
  }

  var state = global.FRankDays.loadPlayerState(player);
  var isNew = false;
  if (state.ecology_log.observed_animals.indexOf(eid) === -1) {
    state.ecology_log.observed_animals.push(eid);
    isNew = true;
  }
  if (!state.ecology_log.discovered_by_zone) state.ecology_log.discovered_by_zone = {};
  if (zoneKey) {
    if (!state.ecology_log.discovered_by_zone[zoneKey]) state.ecology_log.discovered_by_zone[zoneKey] = [];
    if (state.ecology_log.discovered_by_zone[zoneKey].indexOf(eid) === -1) {
      state.ecology_log.discovered_by_zone[zoneKey].push(eid);
    }
  }

  var fedNow = false;
  var heldId = heldItemIdOpt ? String(heldItemIdOpt) : '';
  if (!state.ecology_log.feed_cooldowns) state.ecology_log.feed_cooldowns = {};
  var careNow = Date.now();
  var nextCareAt = Number(state.ecology_log.feed_cooldowns[eid] || 0);
  if (consumedFeed === true && heldId && global.FRankDays.ANIMAL_FEED_ITEMS.indexOf(heldId) !== -1 &&
      careNow >= nextCareAt) {
    state.ecology_log.fed_animals_count = Number(state.ecology_log.fed_animals_count || 0) + 1;
    state.ecology_log.feed_cooldowns[eid] = careNow + 60000;
    fedNow = true;
  }

  // 생활 생태 마일스톤 보상 (중복 수령 원천 방지)
  var totalSp = state.ecology_log.observed_animals.length;
  var fedCnt = Number(state.ecology_log.fed_animals_count || 0);
  var milestoneNotice = '';
  var rewards = [];

  if (totalSp >= 3 && !state.reward_ledger.eco_milestone_3_species) {
    state.reward_ledger.eco_milestone_3_species = true;
    rewards.push('minecraft:emerald');
    milestoneNotice = ' [생태 도감 3종 달성 보상: 에메랄드 1개!]';
  }
  if (totalSp >= 6 && !state.reward_ledger.eco_milestone_6_species) {
    state.reward_ledger.eco_milestone_6_species = true;
    rewards.push('2x minecraft:emerald');
    milestoneNotice += ' [생태 도감 6종 달성 보상: 에메랄드 2개!]';
  }
  if (fedCnt >= 5 && !state.reward_ledger.eco_milestone_5_feeds) {
    state.reward_ledger.eco_milestone_5_feeds = true;
    rewards.push('2x minecraft:golden_carrot');
    milestoneNotice += ' [동물 먹이 돌봄 5회 보상: 황금 당근 2개!]';
  }

  global.FRankDays.savePlayerState(player, state);
  for (var rewardIndex = 0; rewardIndex < rewards.length; rewardIndex++) {
    if (player.give) player.give(rewards[rewardIndex]);
  }
  global.FRankDays.syncFtbQuestStagesForPlayer(player);

  return {
    ok: true,
    is_new: isNew,
    fed_now: fedNow,
    zone: zoneKey,
    total_species: totalSp,
    fed_animals_count: fedCnt,
    message:
      (isNew
        ? '[생태 관찰 수첩 · ' + zoneKey + '] 새로운 생물(' + eid + ')을 발견해 도감에 기록했습니다! (누적 ' + totalSp + '종)'
        : fedNow
          ? '[동물 돌봄] ' + eid + '에게 먹이를 주며 정성껏 돌보았습니다! (누적 돌봄 ' + fedCnt + '회)'
          : '[생태 관찰 수첩] 이미 기록된 동물(' + eid + ')의 상태를 살폈습니다.') + milestoneNotice
  };
};

global.FRankDays.recordMonsterCodexEntry = function (player, entityId) {
  var eid = String(entityId || '');
  if (!eid) return { ok: false };
  var state = global.FRankDays.loadPlayerState(player);
  var isNew = false;
  if (state.ecology_log.monster_codex.indexOf(eid) === -1) {
    state.ecology_log.monster_codex.push(eid);
    isNew = true;
    global.FRankDays.savePlayerState(player, state);
  }
  global.FRankDays.syncFtbQuestStagesForPlayer(player);
  return {
    ok: true,
    is_new: isNew,
    total_monsters: state.ecology_log.monster_codex.length
  };
};

if (typeof ItemEvents !== 'undefined' && ItemEvents.entityInteracted) {
  ItemEvents.entityInteracted(function (event) {
    var player = event.player;
    var target = event.target;
    if (!player || !target) return;
    if (event.hand && String(event.hand) !== 'MAIN_HAND') return;
    var targetType = String(target.type || target.id || '');
    if (global.FRankDays.PEACEFUL_OBSERVABLE_ANIMALS.indexOf(targetType) === -1) return;

    var stack = event.item || player.mainHandItem;
    var held = event.item && event.item.id
      ? String(event.item.id)
      : player.mainHandItem && player.mainHandItem.id
        ? String(player.mainHandItem.id)
        : '';
    var res = global.FRankDays.recordAnimalObservation(player, targetType, null, false);
    if (res.ok && res.is_new && player.tell) {
      player.tell(res.message);
    }
    var countBefore = stack ? Number(stack.count || 0) : 0;
    var server = event.server || player.server;
    if (!held || countBefore <= 0 || global.FRankDays.ANIMAL_FEED_ITEMS.indexOf(held) === -1 ||
        !server || typeof server.scheduleInTicks !== 'function') return;
    if (typeof target.isFood === 'function' && !target.isFood(stack)) return;
    // This event precedes vanilla interaction; count care only after food was consumed.
    server.scheduleInTicks(1, function () {
      if (Number(stack.count || 0) >= countBefore) return;
      var fed = global.FRankDays.recordAnimalObservation(player, targetType, held, true);
      if (fed.ok && fed.fed_now && player.tell) player.tell(fed.message);
    });
  });
}

if (typeof EntityEvents !== 'undefined' && EntityEvents.death) {
  EntityEvents.death(function (event) {
    var src = event.source;
    var killer = src && src.player ? src.player : null;
    if (!killer || !event.entity) return;
    var vType = String(event.entity.type || event.entity.id || '');
    if (
      Boolean(event.entity.monster) ||
      vType.indexOf('mowziesmobs:') === 0 ||
      global.FRankDays.ECOLOGY_ZONES.distant.indexOf(vType) !== -1 ||
      vType.indexOf('minecraft:zombie') === 0 ||
      vType.indexOf('minecraft:skeleton') === 0 ||
      vType.indexOf('minecraft:spider') === 0
    ) {
      var rec = global.FRankDays.recordMonsterCodexEntry(killer, vType);
      if (rec.is_new && killer.tell) {
        killer.tell('[모험가 마물·야생 도감] 「' + vType + '」 정보가 도감에 등록되었습니다! (/frank codex)');
      }
    }
  });
}

global.FRankDays.checkBossWeaponBalanceGuard = function (player, weaponId) {
  var wid = String(weaponId || '');
  if (global.FRankDays.HIGH_TIER_BOSS_WEAPONS.indexOf(wid) === -1) {
    return { restricted: false };
  }
  var state = global.FRankDays.loadPlayerState(player);
  var swGrade = state.job_licenses.swordsman ? state.job_licenses.swordsman.grade : 'UNREGISTERED';
  var isQualified = global.FRankDays.GRADE_ORDER.indexOf(swGrade) >= global.FRankDays.GRADE_ORDER.indexOf('E');
  if (isQualified) {
    return { restricted: false };
  }

  if (player.server && player.server.runCommandSilent) {
    player.server.runCommandSilent(
      'effect give ' + player.username + ' minecraft:mining_fatigue 4 0 true'
    );
  }
  if (player.tell) {
    player.tell(
      '[F급 체력 반동 주의] 상급 유물 무구(' +
        wid +
        ')의 반동이 미숙한 손목에 무리를 줍니다. 온전히 다루려면 최소 [검사 E급] 이상 자격을 취득하세요!'
    );
  }
  return { restricted: true, required_grade: 'E' };
};

if (typeof ItemEvents !== 'undefined' && ItemEvents.rightClicked) {
  ItemEvents.rightClicked(function (event) {
    if (!event.player || !event.item) return;
    global.FRankDays.checkBossWeaponBalanceGuard(event.player, event.item.id);
  });
}
