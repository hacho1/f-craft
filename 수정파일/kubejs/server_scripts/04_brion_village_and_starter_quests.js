// 《F급의 나날》 KubeJS 6 Server Script - Auto-New-World Hook, Zone-Aware NPC Lifecycle, Chapter 1 Fix & Command Router (v7.1)
// 파일 경로: kubejs/server_scripts/04_brion_village_and_starter_quests.js

global.FRankDays = global.FRankDays || {};

global.FRankDays.BRION_STRUCTURES = global.FRankDays.BRION_V6_LEGACY_STRUCTURES || [];

global.FRankDays.SERDIN_STRUCTURES = [
  { id: 'f_rank_days:serdin_ancient_ruin', dx: 207, dy: 1, dz: -461, w: 17, l: 11 },
  { id: 'f_rank_days:serdin_herb_glade', dx: 28, dy: 2, dz: -565, w: 15, l: 15 },
  { id: 'f_rank_days:serdin_ranger_camp', dx: -7, dy: 2, dz: -555, w: 13, l: 13 }
];

global.FRankDays.BRION_NPCS = [
  { id: 'hess', tag: 'npc_hess', label: '헤스 [통합 길드 접수원]', dx: 0.5, dy: 1, dz: -25.5, yaw: 0, profession: 'minecraft:librarian', skin: 'customnpcs:textures/entity/custom/placeholder_guild_receptionist.png' },
  { id: 'darim', tag: 'npc_darim', label: '다림 [C급 농부]', dx: -18.5, dy: 1, dz: 18.5, yaw: 90, profession: 'minecraft:farmer', skin: 'customnpcs:textures/entity/custom/placeholder_fox_farmer.png' },
  { id: 'roman', tag: 'npc_roman', label: '로만 [B급 연금술사]', dx: -24.5, dy: 1, dz: -1.5, yaw: -90, profession: 'minecraft:cleric', skin: 'customnpcs:textures/entity/custom/roman_skin_64x64.png' },
  { id: 'nau', tag: 'npc_nau', label: '나우 [B급 대장장이]', dx: 20.5, dy: 1, dz: 21.5, yaw: 90, profession: 'minecraft:weaponsmith', skin: 'customnpcs:textures/entity/custom/placeholder_blacksmith.png' },
  { id: 'gori', tag: 'npc_gori', label: '고리 [브리온 여관 주인]', dx: 25.5, dy: 1, dz: -2.5, yaw: 90, profession: 'minecraft:butcher', skin: 'customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png' },
  { id: 'hwiyeon', tag: 'npc_hwiyeon', label: '휘연 [A급 힐러]', dx: -17.5, dy: 1, dz: -21.5, yaw: 0, profession: 'minecraft:cleric', skin: 'customnpcs:textures/entity/custom/placeholder_healer.png' }
];

global.FRankDays.buildBrionVillage = function (server, anchorX, anchorY, anchorZ, forceRebuild, overworldOpt) {
  if (typeof global.FRankDays.buildBrionVillageV7 === 'function') {
    return global.FRankDays.buildBrionVillageV7(server, anchorX, anchorY, anchorZ, forceRebuild, overworldOpt);
  }
  return { ok: false, reason: 'v7_builder_missing' };
};

global.FRankDays.buildSerdinForest = function (server) {
  if (typeof global.FRankDays.isFcraftSourceProtected === 'function' && global.FRankDays.isFcraftSourceProtected(server)) return { ok: false, reason: 'fcraft_v9_original_terrain_protected' };
  var anchor = global.FRankDays.getVillageAnchor(server);
  var ax = anchor.x;
  var ay = anchor.zone_elevations && anchor.zone_elevations.NORTH !== undefined ? anchor.zone_elevations.NORTH : anchor.y;
  var az = anchor.z;

  if (server && server.runCommandSilent) {
    // Fixed sea-strip chunk loading retired; prepared worlds return above.
    var placedSerdinSites=[];

    for (var i = 0; i < global.FRankDays.SERDIN_STRUCTURES.length; i++) {
      var st = global.FRankDays.SERDIN_STRUCTURES[i];
      var sx = ax + st.dx;
      var sz = az + st.dz;
      var site = global.FRankDays.resolveNearestDryLand ? global.FRankDays.resolveNearestDryLand(server.overworld(), sx, sz, 24) : null;
      if (!site || site.valid !== true || site.isWater === true || site.isLiquid === true) continue;
      sx = site.x; sz = site.z;
      var sy = site.y + 1;
      placedSerdinSites.push(st.id);
      server.runCommandSilent(
        'fill ' +
          sx +
          ' ' +
          (sy - 6) +
          ' ' +
          sz +
          ' ' +
          (sx + st.w - 1) +
          ' ' +
          (sy - 1) +
          ' ' +
          (sz + st.l - 1) +
          ' minecraft:dirt replace #minecraft:replaceable'
      );
      var shortSerdinId = String(st.id).replace('f_rank_days:', '');
      if (
        typeof global.FRankDays.placeStructureNatively === 'function' &&
        global.FRankDays.COMPILED_VILLAGE_BUNDLE &&
        global.FRankDays.COMPILED_VILLAGE_BUNDLE.structures &&
        global.FRankDays.COMPILED_VILLAGE_BUNDLE.structures[shortSerdinId]
      ) {
        global.FRankDays.placeStructureNatively(server, shortSerdinId, sx, sy, sz);
      } else {
        server.runCommandSilent('place template ' + st.id + ' ' + sx + ' ' + sy + ' ' + sz);
      }
    }

    // No unscanned straight sea fill. New-world trails are prebuilt in MCA.
    if (!placedSerdinSites.length) return { ok:false, reason:'no_loaded_dry_legacy_structure_site' };
  }

  global.FRankDays.setSerdinForestBuilt(server, true);
  return {
    ok: true,
    anchor: anchor,
    placed_structures: [
      'f_rank_days:serdin_herb_glade',
      'f_rank_days:serdin_ranger_camp',
      'f_rank_days:serdin_ancient_ruin'
    ]
  };
};

// [v7.1 서버 관리형 NPC 배치]
// - 플레이어 접속 이벤트가 아니라 오직 마을 생성·서버 월드 로드·관리자 복구 시에만 서버 단위로 검증!
// - 구역별 보정 고도(anchor.zone_elevations)에 맞춰 각 건물 바닥에 정확히 소환하며 태그 검사로 중복 스폰 원천 차단!
global.FRankDays.getBrionNpcDefinitions = function (anchor) {
  if (anchor && anchor.fcraft_world_id && typeof global.FRankDays.getFcraftNpcDefinitions === 'function') {
    return global.FRankDays.getFcraftNpcDefinitions(anchor);
  }
  var list;
  var layoutVersion = Number(anchor.layout_version || 6);
  var version = Number(anchor.content_version || layoutVersion);
  if (layoutVersion === 6) list = global.FRankDays.BRION_NPCS;
  else if (version < 7.2) list = global.FRankDays.BRION_V71_NPCS || global.FRankDays.BRION_V7_NPCS;
  else if (version < 7.3) list = global.FRankDays.BRION_V72_NPCS || global.FRankDays.BRION_V7_NPCS;
  else if (version < 8.3) list = global.FRankDays.BRION_V73_NPCS || global.FRankDays.BRION_V7_NPCS;
  else list = global.FRankDays.BRION_V7_NPCS || global.FRankDays.BRION_NPCS;
  return anchor.guild_only_test_world ? list.filter(function (npc) { return npc.id === 'hess'; }) : list;
};

global.FRankDays.ensureBrionNpcs = function (server, repositionExisting) {
  var anchor = global.FRankDays.getVillageAnchor(server);
  if (!anchor.built) return [];
  var hasCustomNpcs = false;
  if (typeof Platform !== 'undefined' && Platform && typeof Platform.isLoaded === 'function') {
    hasCustomNpcs = Boolean(Platform.isLoaded('customnpcs'));
  }

  // CustomNPCs 1.20.1은 이름·Texture·Size 등을 루트 NBT에 저장합니다.
  // 일부 필드만 /summon으로 넘기면 빠진 체력·크기 기본값이 0으로 읽히므로,
  // 실제 런타임에서는 API로 기본 NPC를 생성하고 전체 NBT를 보존해 갱신합니다.
  var api = null;
  var world = null;
  var existingNpcs = [];
  if (hasCustomNpcs && typeof Java !== 'undefined' && typeof Java.loadClass === 'function') {
    api = Java.loadClass('noppes.npcs.api.NpcAPI').Instance();
    world = api.getIWorld('minecraft:overworld');
    existingNpcs = world.getAllEntities(2);
  }

  // 저장된 v6 앵커는 기존 6인 배치로 유지하고, 명시적 v7 건설에서만 9인으로 전환합니다.
  var activeNpcList = global.FRankDays.getBrionNpcDefinitions(anchor);
  var placed = [];
  for (var i = 0; i < activeNpcList.length; i++) {
    var npc = activeNpcList[i];
    var baseY = anchor.layout_version !== 6 && anchor.zone_elevations && npc.zone &&
      anchor.zone_elevations[npc.zone] !== undefined ? anchor.zone_elevations[npc.zone] : anchor.y;
    var nx = anchor.x + npc.dx;
    var ny = baseY + npc.dy;
    var nz = anchor.z + npc.dz;

    if (api) {
      var wrappedNpc = null;
      for (var j = 0; j < existingNpcs.length; j++) {
        if (existingNpcs[j].hasTag(npc.tag)) {
          wrappedNpc = existingNpcs[j];
          break;
        }
      }
      var fresh = wrappedNpc === null;
      if (fresh) {
        wrappedNpc = api.createNPC(world.getMCLevel());
      }
      // 재접속/상태 동기화에서는 기존 위치를 건드리지 않습니다.
      // 건설 명령이 성공한 경우에만 기존 UUID를 유지한 채 새 건물로 이동합니다.
      if (fresh || repositionExisting) {
        wrappedNpc.setPosition(nx, ny, nz);
        wrappedNpc.setHome(Math.floor(nx), Math.floor(ny), Math.floor(nz));
      }
      wrappedNpc.addTag('f_rank_npc');
      wrappedNpc.addTag(npc.tag);
      wrappedNpc.getDisplay().setName(npc.label);
      wrappedNpc.getDisplay().setSkinTexture(npc.skin);
      wrappedNpc.getDisplay().setSize(5);
      wrappedNpc.getDisplay().setShowingLayers(true);
      wrappedNpc.getAi().setMovingType(0);
      wrappedNpc.getAi().setStandingType(1);
      wrappedNpc.getAi().setRetaliateType(3);
      wrappedNpc.getAi().setStopOnInteract(true);
      wrappedNpc.setRotation(npc.yaw);
      // getNbt()는 persistentData 전용입니다. getEntityNbt()로 UUID·기존 스크립트·상태를 유지합니다.
      var fullNbt = wrappedNpc.getEntityNbt();
      fullNbt.setBoolean('NoAI', true);
      fullNbt.setBoolean('Invulnerable', true);
      fullNbt.setBoolean('PersistenceRequired', true);
      wrappedNpc.setEntityNbt(fullNbt);
      if (fresh) {
        wrappedNpc.setHealth(wrappedNpc.getMaxHealth());
        wrappedNpc.spawn();
      }
      // NoAI NPC의 lookAi는 null일 수 있으므로 네이티브 머리·몸 회전을 직접 동기화합니다.
      wrappedNpc.getMCEntity().setYHeadRot(npc.yaw);
      wrappedNpc.getMCEntity().setYBodyRot(npc.yaw);
      wrappedNpc.updateClient();
    } else if (server && server.runCommandSilent) {
      // CustomNPCs가 없거나 Java 연동이 없는 모의 환경에서는 기존 주민 대체 경로를 유지합니다.
      if (repositionExisting) {
        server.runCommandSilent('tp @e[tag=' + npc.tag + ',limit=1] ' + nx + ' ' + ny + ' ' + nz + ' ' + npc.yaw + ' 0');
      }
      var nbtStr = '{NoAI:1b,Silent:1b,PersistenceRequired:1b,Invulnerable:1b,CustomNameVisible:1b,CustomName:\'{"text":"' +
          npc.label +
          '"}\',VillagerData:{level:2,profession:"' +
          npc.profession +
          '",type:"minecraft:plains"},Rotation:[' +
          npc.yaw +
          'f,0f],Tags:["f_rank_npc","' +
          npc.tag +
          '"]}';

      server.runCommandSilent(
        'execute unless entity @e[tag=' +
          npc.tag +
          ',limit=1] run summon ' +
          'minecraft:villager' +
          ' ' +
          nx +
          ' ' +
          ny +
          ' ' +
          nz +
          ' ' +
          nbtStr
      );
    }
    placed.push({ id: npc.id, tag: npc.tag, building_id: npc.building_id || null, coords: [nx, ny, nz] });
  }
  return placed;
};

global.FRankDays.prepareStarterDistributionWorld = function (server) {
  if (typeof global.FRankDays.isFcraftSourceProtected === 'function' && global.FRankDays.isFcraftSourceProtected(server)) return { ok: false, reason: 'fcraft_v9_original_terrain_protected' };
  var anchor = global.FRankDays.getVillageAnchor(server);
  if (!anchor.built) {
    global.FRankDays.buildBrionVillage(server, anchor.x, anchor.y, anchor.z, false);
    anchor = global.FRankDays.getVillageAnchor(server);
  } else {
    global.FRankDays.ensureBrionNpcs(server);
  }
  if (!global.FRankDays.isSerdinForestBuilt(server)) {
    global.FRankDays.buildSerdinForest(server);
  }

  if (server && server.persistentData && typeof server.persistentData.keys === 'function') {
    var keys = server.persistentData.keys();
    for (var i = 0; i < keys.length; i++) {
      var k = String(keys[i]);
      if (k.indexOf('f_rank_days_mirror_v1_') === 0) {
        server.persistentData.putString(k, '');
      }
    }
  }
  if (server && server.runCommandSilent) {
    server.runCommandSilent('time set 1000');
    server.runCommandSilent('weather clear');
    var pzOff = global.FRankDays.BRION_PLAZA_SPAWN_OFFSET || { dx: 0.5, dy: 1, dz: 9.5, yaw: 180 };
    server.runCommandSilent(
      'setworldspawn ' + Math.floor(anchor.x + pzOff.dx) + ' ' + Math.floor(anchor.y + pzOff.dy) + ' ' + Math.floor(anchor.z + pzOff.dz) + ' ' + (pzOff.yaw || 180)
    );
    server.runCommandSilent('gamerule spawnRadius 0');
  }
  return { ok: true, anchor: anchor, serdin_built: global.FRankDays.isSerdinForestBuilt(server) };
};

// [v8.3 핵심 변경] 신규 플레이어는 브리온 마을 중앙 분수대 광장(0.5, 69, 9.5, 북향 180도)에서 안전하게 최초 스폰됩니다!
// (기존 플레이어의 위치·등록증·직업·능력·호감도 상태는 절대 초기화하지 않고 100% 보존합니다.)
global.FRankDays.ensureNewPlayerInitialPlazaSpawn = function (player, serverOverride) {
  var srv = serverOverride || player.server;
  if ((typeof global.FRankDays.isFcraftV9World === 'function' && global.FRankDays.isFcraftV9World(srv)) ||
      (typeof global.FRankDays.isFcraftV9CandidateWorld === 'function' && global.FRankDays.isFcraftV9CandidateWorld(srv))) {
    return { teleported: false, reason: 'fcraft_v9_uses_verified_world_spawn' };
  }
  var state = global.FRankDays.loadPlayerState(player, srv);
  var ob = state.starter_onboarding;

  if (ob.initial_plaza_spawn_done || ob.spawned_in_brion || Boolean(state.special_ability.ability_id) || state.guild_card.issued) {
    if (!ob.initial_plaza_spawn_done) {
      ob.initial_plaza_spawn_done = true;
      global.FRankDays.savePlayerState(player, state, srv);
    }
    return { teleported: false, reason: 'existing_player_position_preserved' };
  }

  var anchor = global.FRankDays.getVillageAnchor(srv);
  var pzOff = global.FRankDays.BRION_PLAZA_SPAWN_OFFSET || { dx: 0.5, dy: 1, dz: 9.5, yaw: 180 };
  var centralY = (anchor.zone_elevations && anchor.zone_elevations.CENTRAL !== undefined) ? anchor.zone_elevations.CENTRAL : anchor.y;
  var spawnX = anchor.guild_only_test_world ? (anchor.x + 0.5) : (anchor.x + pzOff.dx);
  var spawnY = anchor.guild_only_test_world ? (anchor.y + 1) : (centralY + pzOff.dy);
  var spawnZ = anchor.guild_only_test_world ? 12.5 : (anchor.z + pzOff.dz);
  var spawnYaw = pzOff.yaw !== undefined ? pzOff.yaw : 180;

  if (anchor.built) {
    if (srv && srv.runCommandSilent && player.username) {
      srv.runCommandSilent(
        'tp ' + player.username + ' ' + spawnX + ' ' + spawnY + ' ' + spawnZ + ' ' + spawnYaw + ' 0'
      );
    }
    if (typeof player.teleportTo === 'function') {
      player.teleportTo(spawnX, spawnY, spawnZ);
    }
    ob.spawned_in_brion = true;
    ob.initial_plaza_spawn_done = true;
    if (ob.quests && ob.quests.q01_first_day) {
      ob.quests.q01_first_day.left_house = true;
      ob.quests.q01_first_day.reached_square = true;
    }
    global.FRankDays.savePlayerState(player, state, srv);
    if (typeof global.FRankDays.syncFtbQuestStagesForPlayer === 'function') {
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
    }
    return { teleported: true, spawned_in: 'brion_central_plaza', coords: [spawnX, spawnY, spawnZ], yaw: spawnYaw };
  }

  return { teleported: false, reason: 'village_not_built_yet' };
};
global.FRankDays.ensureNewPlayerInitialStarterHouseSpawn = global.FRankDays.ensureNewPlayerInitialPlazaSpawn;

// v9.6: login never grants supplies. Successful first signature owns this reward.
global.FRankDays.giveStarterKitOnce = function () {
  return {ok:false,reason:'registration_only_supplies'};
};

global.FRankDays.checkPlayerQuestLocations = function (player, posX, posY, posZ, serverOverride) {
  var srv = serverOverride || player.server;
  if (typeof global.FRankDays.isFcraftV9World === 'function' && global.FRankDays.isFcraftV9World(srv)) {
    return global.FRankDays.tickFcraftRegions(player, Date.now());
  }
  if (typeof global.FRankDays.isFcraftV9CandidateWorld === 'function' && global.FRankDays.isFcraftV9CandidateWorld(srv)) {
    return { changed: false, reason: 'fcraft_v9_terrain_not_validated' };
  }
  if (player.level && player.level.dimension) {
    var dim = String(player.level.dimension);
    if (dim && dim !== 'minecraft:overworld') {
      return { changed: false, reason: 'not_overworld' };
    }
  }

  var state = global.FRankDays.loadPlayerState(player, srv);
  var ob = state.starter_onboarding;
  if (!ob || !ob.quests) return { changed: false };

  var anchor = global.FRankDays.getVillageAnchor(srv);
  var rx = posX - anchor.x;
  var ry = posY - anchor.y;
  var rz = posZ - anchor.z;
  var changed = false;
  var notices = [];

  var q1 = ob.quests.q01_first_day;
  var validHeight = ry >= -12 && ry <= 34;

  if (validHeight) {
    var shBbox = (global.FRankDays.BRION_V73_STARTER_HOUSE_SPAWN && global.FRankDays.BRION_V73_STARTER_HOUSE_SPAWN.house_bbox_rel) || [-28, 20, -6, 39];
    var outsideStarterHouse = rx < shBbox[0] - 0.5 || rx > shBbox[2] + 0.5 || rz < shBbox[1] - 0.5 || rz > shBbox[3] + 0.5;
    if (!q1.left_house && outsideStarterHouse) {
      q1.left_house = true;
      changed = true;
      notices.push('[제1장 진행: 시작 거처 출발] 작은 거처를 나섰습니다! 북쪽 돌길을 따라 [브리온 마을 중앙 광장]으로 이동하세요.');
    }

    if (!q1.reached_square && Math.abs(rx) <= 16.5 && Math.abs(rz) <= 16.5) {
      q1.left_house = true;
      q1.reached_square = true;
      changed = true;
      notices.push('[제1장 진행: 마을 광장 도착] 활기찬 브리온 중앙 광장에 도착했습니다! 광장 북편의 대형 건물 [통합 길드 지부]로 들어가 접수원 [헤스]를 찾으세요.');
    }

    var gMinX = -16.0, gMaxX = 16.0, gMinZ = -52.0, gMaxZ = -24.0;
    if (global.FRankDays.BRION_V7_STRUCTURES) {
      for (var gi = 0; gi < global.FRankDays.BRION_V7_STRUCTURES.length; gi++) {
        var gst = global.FRankDays.BRION_V7_STRUCTURES[gi];
        if (gst.short_id === 'brion_v7_guild_hall') {
          gMinX = gst.dx - 2.5;
          gMaxX = gst.dx + gst.w + 1.5;
          gMinZ = gst.dz - 2.5;
          gMaxZ = gst.dz + gst.l + 2.5;
          break;
        }
      }
    }
    var inV7Guild = rx >= gMinX && rx <= gMaxX && rz >= gMinZ && rz <= gMaxZ;
    var inV6GuildLegacy = Math.sqrt(rx * rx + (rz + 21) * (rz + 21)) <= 8.5;
    if (!q1.found_guild && (inV7Guild || inV6GuildLegacy)) {
      q1.left_house = true;
      q1.reached_square = true;
      q1.found_guild = true;
      changed = true;
      notices.push('[제1장 진행: 통합 길드 발견] 아르베른 통합 길드 브리온 지부에 도착했습니다! 1층 창구의 접수원 [헤스]를 우클릭해 면담하세요.');
    }

    var q4 = ob.quests.q04_first_steps;
    var inNorthForestGate = (rx >= 70.0 && rx <= 155.0 && rz >= -65.0 && rz <= 75.0) || (rx >= -28.0 && rx <= 28.0 && rz >= -170.0 && rz <= -74.0);
    var inWestForestLegacy = Math.sqrt((rx + 38) * (rx + 38) + rz * rz) <= 7.5;
    if (!q4.visited_serdin_entrance && (inNorthForestGate || inWestForestLegacy)) {
      q4.visited_serdin_entrance = true;
      state.flags.job_training_done.relic_researcher = true;
      changed = true;
      notices.push('[탐험 기록] 개울 나무다리를 건너 세르딘 숲 초입 및 약초 군락지에 도착했습니다!');
    }
  }

  if (changed) {
    global.FRankDays.savePlayerState(player, state, srv);
    if (typeof global.FRankDays.syncFtbQuestStagesForPlayer === 'function') {
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
    }
    if (player.tell) {
      for (var i = 0; i < notices.length; i++) {
        player.tell(notices[i]);
      }
    }
  }
  return { changed: changed, notices: notices };
};

global.FRankDays.interactWithBrionNpc = function (player, npcId, subAction) {
  var state = global.FRankDays.loadPlayerState(player);
  var ob = state.starter_onboarding;
  var q1 = ob.quests.q01_first_day;
  var q2 = ob.quests.q02_first_registration;
  var q3 = ob.quests.q03_first_job;
  var q4 = ob.quests.q04_first_steps;

  if (state.relationships[npcId] && !state.relationships[npcId].flags.first_met) {
    state.relationships[npcId].flags.first_met = true;
    if (state.relationships[npcId].relation_type === 'none') {
      state.relationships[npcId].relation_type = 'acquaintance';
    }
  }

  if (npcId !== 'hess' && q4.status === 'ACTIVE') {
    if (q4.greeted_villagers.indexOf(npcId) === -1) {
      q4.greeted_villagers.push(npcId);
    }
  }

  if (npcId === 'hess') {
    if (subAction === 'help_paperwork') {
      global.FRankDays.savePlayerState(player, state);
      var affRes = global.FRankDays.addNpcAffinity(player, 'hess', 10);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      var hMsg =
        '[헤스] "마감 전표 분류를 거들어 주셔서 큰 도움이 되었습니다. 정말 감사합니다." (헤스 호감도: ' +
        affRes.affinity +
        ')';
      if (player.tell) player.tell(hMsg);
      return { ok: true, action: 'help_paperwork', affinity: affRes.affinity, message: hMsg };
    }

    var lines = [];
    if (q1.status === 'ACTIVE' || !q1.talked_hess) {
      q1.left_house = true;
      q1.reached_square = true;
      q1.found_guild = true;
      q1.talked_hess = true;
      q1.status = 'COMPLETED';
      ob.guild_registration_unlocked = true;
      if (q2.status === 'LOCKED') q2.status = 'ACTIVE';
      lines.push('[제1장 면담 완료] 접수원 헤스와의 첫 면담이 기록되었습니다!');
    }

    if (q2.status === 'ACTIVE' && !state.special_ability.ability_id) {
      q2.explained_system = true;
      lines.push(
        '[헤스] "안녕하십니까. 아르베른 통합 길드 브리온 지부 접수원 헤스입니다. 초기 주민 등록 절차를 안내해 드리겠습니다."'
      );
      var selectable = global.FRankDays.getSelectableAbilities();
      for (var i = 0; i < selectable.length; i++) {
        var ab = selectable[i];
        lines.push('  -> /frank ability ' + ab.id + '  (' + ab.name + ': ' + ab.desc + ')');
      }
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      if (player.tell) player.tell(lines.join('\n'));
      return { ok: true, npc: 'hess', phase: 'q02_select_ability', lines: lines };
    }

    if (q3.status === 'ACTIVE' && !q3.registered_any_job) {
      lines.push(
        '[헤스] "특성 기록이 확인되었습니다. 이제 최초 직업을 선택하시면 바로 《길드 등록증》 서명 화면을 띄워 드리겠습니다."'
      );
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      if (player.tell) player.tell(lines.join('\n'));
      return { ok: true, npc: 'hess', phase: 'q03_select_first_job', lines: lines };
    }

    if (!state.guild_card.issued) {
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      var uiOpen = global.FRankDays.openGuildRegistrationUi(player, 'INPUT');
      return {
        ok: true,
        npc: 'hess',
        phase: 'awaiting_card_name',
        opened_ui: uiOpen.ok,
        lines: ['[헤스] "양피지 《길드 등록증》을 앞에 펼쳐 드렸습니다. 성명 항목에 이름을 직접 입력해 주십시오."']
      };
    }

    var pqH = state.personal_quests.hess;
    if (pqH && pqH.phase === 'RESOLVED' && global.FRankDays.TIER1_PERSONAL_QUEST_ENDINGS.hess[pqH.chosen_ending]) {
      lines.push(global.FRankDays.TIER1_PERSONAL_QUEST_ENDINGS.hess[pqH.chosen_ending].aftermath_greeting);
    } else {
      lines.push(
        '[헤스] "어서 오십시오, ' +
          state.guild_card.registered_display_name +
          ' 님. 추가 직업 등록, 직무 브리핑, E급 승급시험을 도와드립니다."'
      );
    }
    global.FRankDays.savePlayerState(player, state);
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    if (player.tell) player.tell(lines.join('\n'));
    return { ok: true, npc: 'hess', phase: 'guild_desk', lines: lines };
  }

  if (npcId === 'darim') {
    if (subAction === 'sell_wheat') {
      var cnt = global.FRankDays.countPlayerItem(player, 'minecraft:wheat');
      if (cnt < 8) {
        var msgLow = '[다림] "밀 8다발을 모아 오시면 에메랄드 1개로 쳐 드릴게요! (현재 보유: ' + cnt + '개)"';
        if (player.tell) player.tell(msgLow);
        return { ok: false, reason: 'not_enough_wheat', message: msgLow };
      }
      if (player.server && player.server.runCommandSilent) {
        player.server.runCommandSilent('clear ' + player.username + ' minecraft:wheat 8');
      }
      if (player.give) player.give('minecraft:emerald');
      global.FRankDays.addNpcAffinity(player, 'darim', 6);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      var msgSold = '[다림] "정성껏 키운 밀이네요! 여기 에메랄드 1개예요."';
      if (player.tell) player.tell(msgSold);
      return { ok: true, action: 'sell_wheat', message: msgSold };
    }

    global.FRankDays.savePlayerState(player, state);
    var oriRes = global.FRankDays.completeDarimOrientation(player);
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    if (player.tell) player.tell(oriRes.message);
    return { ok: true, npc: 'darim', message: oriRes.message };
  }

  if (npcId === 'roman') {
    if (subAction === 'herb_quest') {
      if (!q4.accepted_herb_quest_roman) {
        q4.accepted_herb_quest_roman = true;
        global.FRankDays.savePlayerState(player, state);
        var qStartMsg =
          '[로만] "동쪽 장인 거리 끝 나무다리 너머 세르딘 숲 약초 군락지에 가면 민들레(dandelion)가 자라. 흙 털어서 싱싱한 걸로 3송이만 가져와. 보수는 정확히 챙겨 줄 테니까."';
        if (player.tell) player.tell(qStartMsg);
        return { ok: true, action: 'herb_quest_accepted', message: qStartMsg };
      }
      var dand = global.FRankDays.countPlayerItem(player, 'minecraft:dandelion');
      if (dand < 3) {
        var lackMsg = '[로만] "민들레 3송이랬지, 빈손으로 오란 말은 안 했는데. (보유: ' + dand + '/3)"';
        if (player.tell) player.tell(lackMsg);
        return { ok: false, reason: 'not_enough_herbs', message: lackMsg };
      }
      if (player.server && player.server.runCommandSilent) {
        player.server.runCommandSilent('clear ' + player.username + ' minecraft:dandelion 3');
      }
      q4.completed_herb_quest_roman = true;
      state.flags.job_training_done.alchemist = true;
      var firstHerbReward = !state.reward_ledger.roman_starter_herb_reward;
      state.reward_ledger.roman_starter_herb_reward = true;
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.addNpcAffinity(player, 'roman', 8);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      if (player.give) {
        player.give('minecraft:emerald');
        if (firstHerbReward && typeof Item !== 'undefined' && Item.of) {
          player.give(Item.of('minecraft:potion', '{Potion:"minecraft:healing"}'));
        }
      }
      var doneMsg = '[로만] "...뿌리 손상 없이 꽤 깔끔하게 캐 왔네. 약값 챙겨 가. 다음에도 이 정도 품질이면 거래하지."';
      if (player.tell) player.tell(doneMsg);
      return { ok: true, action: 'herb_quest_completed', message: doneMsg };
    }

    if (subAction === 'buy_potion') {
      var em = global.FRankDays.countPlayerItem(player, 'minecraft:emerald');
      if (em < 2) {
        var noEm = '[로만] "기초 회복 물약은 에메랄드 2개야. 외상은 안 받아."';
        if (player.tell) player.tell(noEm);
        return { ok: false, reason: 'not_enough_emerald', message: noEm };
      }
      if (player.server && player.server.runCommandSilent) {
        player.server.runCommandSilent('clear ' + player.username + ' minecraft:emerald 2');
      }
      if (player.give && typeof Item !== 'undefined' && Item.of) {
        player.give(Item.of('minecraft:potion', '{Potion:"minecraft:healing"}'));
      }
      var buyMsg = '[로만] "변질되지 않게 직사광선 피해 보관해. 영수증은 생략한다."';
      if (player.tell) player.tell(buyMsg);
      return { ok: true, action: 'buy_potion', message: buyMsg };
    }

    global.FRankDays.savePlayerState(player, state);
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    var romGreet = '[로만] "필요한 물약이 있으면 말해. 구경만 할 거면 방해하지 말고."';
    if (player.tell) player.tell(romGreet);
    return { ok: true, npc: 'roman', message: romGreet };
  }

  if (npcId === 'nau') {
    if (subAction === 'repair') {
      var repairStack=player.mainHandItem;
      if(!repairStack||repairStack.empty||!repairStack.isDamageableItem()||Number(repairStack.damageValue)<=0)return{ok:false,reason:'no_damaged_tool',message:'[나우] 오른손에 수리가 필요한 연장을 들어라.'};
      var repairMultiplier=global.FRankDays.getBlacksmithRepairMultiplierPhase4?global.FRankDays.getBlacksmithRepairMultiplierPhase4(player):1;
      var repairCarry=Number(state.phase4_repair_fraction||0),exactRepairCost=3*repairMultiplier+repairCarry,repairCost=Math.floor(exactRepairCost+0.000001);
      var nuggets = global.FRankDays.countPlayerItem(player, 'minecraft:iron_nugget');
      if (nuggets < repairCost) {
        var nauLack = '[나우] 철 조각 '+repairCost+'개가 필요하다. (보유: ' + nuggets + '/'+repairCost+')';
        if (player.tell) player.tell(nauLack);
        return { ok: false, reason: 'not_enough_iron_nugget', message: nauLack };
      }
      if(!global.FRankDays.consumePlayerItemExact(player,'minecraft:iron_nugget',repairCost))return{ok:false,reason:'repair_payment_failed',message:'수리 재료를 확인해라.'};
      state.phase4_repair_fraction=exactRepairCost-repairCost;
      if (player.mainHandItem && typeof player.mainHandItem.setDamageValue === 'function') {
        var curDmg = Number(player.mainHandItem.damageValue || 0);
        player.mainHandItem.setDamageValue(Math.max(0, curDmg - 60));
      }
      state.flags.job_training_done.blacksmith = true;
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.addNpcAffinity(player, 'nau', 4);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      var nauDone = '[나우] "자, 날 다시 세워 놨다. 무리해서 휘두르다가 손목 나간다, 조심해라."';
      if (player.tell) player.tell(nauDone);
      return { ok: true, action: 'repair', message: nauDone };
    }

    global.FRankDays.savePlayerState(player, state);
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    var nauGreet = '[나우] "불티 튀니까 모루 가까이 붙지 마라. 연장 수리할 끼가?"';
    if (player.tell) player.tell(nauGreet);
    return { ok: true, npc: 'nau', message: nauGreet };
  }

  if (npcId === 'gori') {
    if (subAction === 'meal') {
      var emG = global.FRankDays.countPlayerItem(player, 'minecraft:emerald');
      if (emG < 1) {
        var goriNo = '[고리] "따뜻한 여관 정식은 에메랄드 1개예요! 언제든 편히 쉬어 가세요."';
        if (player.tell) player.tell(goriNo);
        return { ok: false, reason: 'not_enough_emerald', message: goriNo };
      }
      if (player.server && player.server.runCommandSilent) {
        player.server.runCommandSilent('clear ' + player.username + ' minecraft:emerald 1');
      }
      if (player.give) {
        player.give('3x minecraft:baked_potato');
        player.give('2x minecraft:bread');
      }
      global.FRankDays.addNpcAffinity(player, 'gori', 4);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      var goriMeal = '[고리] "갓 구운 감자랑 빵이에요! 2층 객실 침대도 비어 있으니 밤에는 위험하게 돌아다니지 말고 쉬어 가세요."';
      if (player.tell) player.tell(goriMeal);
      return { ok: true, action: 'meal', message: goriMeal };
    }

    global.FRankDays.savePlayerState(player, state);
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    var goriGreet = '[고리] "어서 오세요! 브리온 화톳불 여관은 예의 바른 손님이라면 누구에게나 열려 있답니다."';
    if (player.tell) player.tell(goriGreet);
    return { ok: true, npc: 'gori', message: goriGreet };
  }

  if (npcId === 'hwiyeon') {
    if (subAction === 'heal') {
      if (player.server && player.server.runCommandSilent) {
        player.server.runCommandSilent('effect give ' + player.username + ' minecraft:instant_health 1 0 true');
      }
      state.flags.job_training_done.healer = true;
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.addNpcAffinity(player, 'hwiyeon', 3);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
      var hwiHeal = '[휘연] (차분히 상처 부위를 살피고 기초 치유 처치를 마쳤다. 무리하지 말라는 눈빛이다.)';
      if (player.tell) player.tell(hwiHeal);
      return { ok: true, action: 'heal', message: hwiHeal };
    }

    global.FRankDays.savePlayerState(player, state);
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
    var hwiGreet = '[휘연] (정돈된 약재 선반 사이로 휘연이 조용히 고개를 끄덕이며 상태를 묻는다.)';
    if (player.tell) player.tell(hwiGreet);
    return { ok: true, npc: 'hwiyeon', message: hwiGreet };
  }

  if (npcId === 'ski' || npcId === 'hyeophap' || npcId === 'bambam') {
    return global.FRankDays.openNpcRpgDialog(player, npcId, { bypassDistanceCheck: true });
  }

  return { ok: false, reason: 'unknown_npc' };
};

global.FRankDays.getQuestSummaryText = function (player) {
  if (typeof global.FRankDays.isFcraftV9Cohort === 'function' && global.FRankDays.isFcraftV9Cohort(player)) return global.FRankDays.getFcraftV9QuestSummary(player);
  var st = global.FRankDays.loadPlayerState(player);
  var q = st.starter_onboarding.quests;
  var lines = ['=== [브리온 마을 & 제1장 정착 수첩 요약] ==='];

  lines.push(
    q.q01_first_day.found_guild
      ? '✓ [1-2] 통합 길드 지부 방문 완료'
      : '▶ [1-2] 중앙 광장 북쪽 통합 길드 지부 방문하기'
  );
  lines.push(
    q.q01_first_day.talked_hess
      ? '✓ [1-3] 접수원 헤스 면담 완료'
      : '▶ [1-3] 통합 길드 접수원 헤스와 대화하기'
  );
  lines.push(
    st.special_ability.ability_id
      ? '✓ [1-4] F급 고유 능력 선택 완료 (' + st.special_ability.ability_id + ')'
      : '▶ [1-4] F급 고유 능력 선택하기'
  );
  lines.push(
    q.q03_first_job.registered_any_job
      ? '✓ [1-5] 최초 직업 등록 완료 (' + q.q03_first_job.first_job_id + ')'
      : '▶ [1-5] 최초 직업 무료 등록하기'
  );
  lines.push(
    st.guild_card.issued
      ? '✓ [1-6] 길드 공인 등록증 발급 완료 (' + st.guild_card.registered_display_name + ' / ' + st.guild_card.serial_number + ')'
      : '▶ [1-6] 길드 등록증 성명 서명하기'
  );

  return lines.join('\n');
};

// [v7.2 핵심 수정] ServerEvents.loaded 시점에는 외곽 청크가 비동기 로딩 전이므로 /place template을 조기 호출하지 않음!
ServerEvents.loaded(function (event) {
  var srv = event.server;
  var owInit = srv && typeof srv.overworld === 'function' ? srv.overworld() : null;
  if (typeof global.FRankDays.initializeFcraftV9World === 'function' && global.FRankDays.initializeFcraftV9World(srv, owInit)) return;
  if (typeof global.FRankDays.isFcraftV9CandidateWorld === 'function' && global.FRankDays.isFcraftV9CandidateWorld(srv)) return;
  if (owInit && typeof global.FRankDays.isPrebuiltBrionWorldV72 === 'function' && global.FRankDays.isPrebuiltBrionWorldV72(owInit)) {
    var curAnc = global.FRankDays.getVillageAnchor(srv);
    if (!curAnc.built && typeof global.FRankDays.autoInitializeBrionOnNewWorld === 'function') {
      global.FRankDays.autoInitializeBrionOnNewWorld(srv, owInit, null);
    }
  }
  var anchor = global.FRankDays.getVillageAnchor(srv);
  if (anchor.built) {
    global.FRankDays.ensureBrionNpcs(srv);
    return;
  }
  // 플레이어 접속 전(ServerEvents.loaded) 시점에 기존 세이브 미러 기록 유무를 판별해 신규 월드 여부를 확정!
  if (srv && srv.persistentData && !srv.persistentData.contains('f_rank_days_world_freshness_checked')) {
    var hasPriorSave = false;
    if (typeof srv.persistentData.keys === 'function') {
      var ks = srv.persistentData.keys();
      for (var i = 0; i < ks.length; i++) {
        if (String(ks[i]).indexOf('f_rank_days_mirror_v1_') === 0 && srv.persistentData.getString(ks[i])) {
          hasPriorSave = true;
          break;
        }
      }
    }
    srv.persistentData.putString('f_rank_days_world_freshness_checked', hasPriorSave ? 'legacy_save' : 'fresh_new_world');
  }
});

PlayerEvents.loggedIn(function (event) {
  var player = event.player;
  var srv = event.server;
  // Capture prior data before loadPlayerState creates the legacy record.
  if (typeof global.FRankDays.prepareFcraftV9Player === 'function') global.FRankDays.prepareFcraftV9Player(player, srv);
  if (srv && srv.persistentData && !srv.persistentData.contains('f_rank_days_world_freshness_checked')) {
    var hasPrior = false;
    if (typeof srv.persistentData.keys === 'function') {
      var ks = srv.persistentData.keys();
      for (var i = 0; i < ks.length; i++) {
        if (String(ks[i]).indexOf('f_rank_days_mirror_v1_') === 0 && srv.persistentData.getString(ks[i])) {
          hasPrior = true;
          break;
        }
      }
    }
    srv.persistentData.putString('f_rank_days_world_freshness_checked', hasPrior ? 'legacy_save' : 'fresh_new_world');
  }
  var anchor = global.FRankDays.getVillageAnchor(srv);

  var owLogin = (srv && typeof srv.overworld === 'function' ? srv.overworld() : null) || (player && player.level && String(player.level.dimension || '') === 'minecraft:overworld' ? player.level : null);
  if (!anchor.built && owLogin && typeof global.FRankDays.isPrebuiltBrionWorldV72 === 'function' && global.FRankDays.isPrebuiltBrionWorldV72(owLogin)) {
    global.FRankDays.autoInitializeBrionOnNewWorld(srv, owLogin, player);
    anchor = global.FRankDays.getVillageAnchor(srv);
  } else if (!anchor.built && typeof global.FRankDays.requestNewWorldChunkPreload === 'function') {
    global.FRankDays.requestNewWorldChunkPreload(srv, owLogin, player);
  }

  var state = global.FRankDays.loadPlayerState(player, srv);
  if (state.guild_card.ui_open || state.guild_card.awaiting_name_input) {
    global.FRankDays.closeGuildCardUi(player);
  }
  if (state.npc_dialog && state.npc_dialog.open && typeof global.FRankDays.closeNpcRpgDialog === 'function') {
    global.FRankDays.closeNpcRpgDialog(player, true);
  }

  // Newcomers remain empty-handed until the server commits Hess's signature.
  if (state.starter_onboarding.starter_kit_given) {
    global.FRankDays.ensureNewPlayerInitialPlazaSpawn(player, srv);
  }

  if (typeof global.FRankDays.syncFtbQuestStagesForPlayer === 'function') {
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
  }
});

// [v7.3 핵심 보강] Mojmap 1.20.1에서 player.age 미존재 시에도 100% 작동하는 ServerEvents.tick + PlayerEvents.tick 이중 구동기!
if (typeof ServerEvents !== 'undefined' && ServerEvents.tick) {
  ServerEvents.tick(function (event) {
    var srv = event.server;
    if (!srv || !srv.persistentData) return;
    global.FRankDays._serverTickCounter = Number(global.FRankDays._serverTickCounter || 0) + 1;
    if (global.FRankDays._serverTickCounter % 10 === 0 && typeof global.FRankDays.advanceNewWorldAutoBuilder === 'function') {
      var firstPlayer = srv.players && srv.players.length > 0 ? srv.players[0] : null;
      var owSrv = typeof srv.overworld === 'function' ? srv.overworld() : (firstPlayer ? firstPlayer.level : null);
      global.FRankDays.advanceNewWorldAutoBuilder(srv, owSrv, firstPlayer, 10);
    }
  });
}

if (typeof PlayerEvents !== 'undefined' && PlayerEvents.tick) {
  PlayerEvents.tick(function (event) {
    var player = event.player;
    var srv = event.server || (player ? player.server : null);
    if (!player) return;

    // Mojmap 1.20.1 `tickCount` -> 구버전 `age` -> 내장 카운터 순 안전 해석!
    var pTick =
      player.tickCount !== undefined
        ? Number(player.tickCount)
        : player.age !== undefined
        ? Number(player.age)
        : (player._frankInternalTicks = Number(player._frankInternalTicks || 0) + 1);

    if (pTick >= 40 && pTick % 20 === 0 && srv && srv.persistentData) {
      var ow = player.level && String(player.level.dimension || '') === 'minecraft:overworld' ? player.level : null;
      if (typeof global.FRankDays.advanceNewWorldAutoBuilder === 'function') {
        global.FRankDays.advanceNewWorldAutoBuilder(srv, ow, player, 40);
      }
    }

    if (pTick % 20 !== 0) return;
    global.FRankDays.checkPlayerQuestLocations(player, player.x, player.y, player.z, srv);
  });
}

if (typeof ItemEvents !== 'undefined' && ItemEvents.entityInteracted) {
  ItemEvents.entityInteracted(function (event) {
    var target = event.target;
    var player = event.player;
    if (!target || !player || !target.tags) return;

    var tagMap = {
      npc_hess: 'hess',
      npc_darim: 'darim',
      npc_roman: 'roman',
      npc_nau: 'nau',
      npc_gori: 'gori',
      npc_hwiyeon: 'hwiyeon',
      npc_ski: 'ski',
      npc_hyeophap: 'hyeophap',
      npc_bambam: 'bambam',
      npc_harin: 'harin'
    };
    var keys = Object.keys(tagMap);
    for (var i = 0; i < keys.length; i++) {
      var t = keys[i];
      if (global.FRankDays.hasEntityTag(target, t)) {
        if (typeof global.FRankDays.openNpcRpgDialog === 'function') {
          global.FRankDays.openNpcRpgDialog(player, tagMap[t], { targetEntity: target });
        } else {
          global.FRankDays.interactWithBrionNpc(player, tagMap[t], null);
        }
        if (typeof event.cancel === 'function') {
          event.cancel();
        }
        return;
      }
    }
  });
}

ServerEvents.commandRegistry(function (event) {
  var Commands = event.commands;
  var Arguments = event.arguments;

  event.register(
    Commands.literal('frank')
      .requires(function (src) {
        return src.hasPermission(0);
      })
      .then(
        Commands.literal('status').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var st = global.FRankDays.loadPlayerState(player);
          var abilityStr = st.special_ability.ability_id || '미선택';
          var jobParts = [];
          for (var i = 0; i < global.FRankDays.ALL_JOBS.length; i++) {
            var j = global.FRankDays.ALL_JOBS[i];
            jobParts.push(global.FRankDays.JOB_LABELS[j] + ':' + st.job_licenses[j].grade);
          }
          player.tell('[F-Craft 상태] 능력: ' + abilityStr + ' | 자격: ' + jobParts.join(', '));
          return 1;
        })
      )
      .then(
        Commands.literal('quest').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          player.tell(global.FRankDays.getQuestSummaryText(player));
          return 1;
        })
      )
      .then(
        Commands.literal('registration_ui').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.openGuildRegistrationUi(player, 'INPUT');
          if (!res.ok) player.tell(res.message);
          return res.ok ? 1 : 0;
        })
      )
      .then(
        Commands.literal('card').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.openGuildRegistrationUi(player, 'VIEW');
          if (!res.ok) player.tell(res.message);
          return res.ok ? 1 : 0;
        })
      )
      .then(
        Commands.literal('close_ui').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          global.FRankDays.closeGuildCardUi(player);
          if (typeof global.FRankDays.closeNpcRpgDialog === 'function') {
            global.FRankDays.closeNpcRpgDialog(player, false);
          }
          return 1;
        })
      )
      .then(
        Commands.literal('register_name').then(
          Commands.argument('displayName', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var displayName = Arguments.STRING.getResult(ctx, 'displayName');
            var res = global.FRankDays.issueOrUpdateGuildCard(player, displayName);
            player.tell(res.message);
            return res.ok ? 1 : 0;
          })
        )
      )
      .then(
        Commands.literal('verify_card').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.verifyGuildCardAuthenticity(player, player.mainHandItem);
          player.tell(res.message);
          return res.valid ? 1 : 0;
        })
      )
      .then(
        Commands.literal('observe_animal').then(
          Commands.argument('entityId', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var entityId = Arguments.STRING.getResult(ctx, 'entityId');
            var res = global.FRankDays.recordAnimalObservation(player, entityId, null);
            player.tell(res.message);
            return res.ok ? 1 : 0;
          })
        )
      )
      .then(
        Commands.literal('codex').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var st = global.FRankDays.loadPlayerState(player);
          var z = st.ecology_log.discovered_by_zone;
          var mobs = st.ecology_log.monster_codex;
          player.tell(
            '=== [브리온 4권역 생태·마물 도감] ===\n' +
              ' · 마을 주변(' + z.village.length + '종): ' + (z.village.join(', ') || '없음') + '\n' +
              ' · 숲 지역(' + z.forest.length + '종): ' + (z.forest.join(', ') || '없음') + '\n' +
              ' · 강·호수(' + z.river_lake.length + '종): ' + (z.river_lake.join(', ') || '없음') + '\n' +
              ' · 먼 지역(' + z.distant.length + '종): ' + (z.distant.join(', ') || '없음') + '\n' +
              ' · 동물 먹이 돌봄 횟수: ' + st.ecology_log.fed_animals_count + '회\n' +
              ' · 토벌 기록 마물(' + mobs.length + '종): ' + (mobs.join(', ') || '없음')
          );
          return 1;
        })
      )
      .then(
        Commands.literal('sync_quests').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var r = global.FRankDays.syncFtbQuestStagesForPlayer(player);
          player.tell('[퀘스트북 동기화 완료] 반영된 개인 스테이지 수: ' + r.synced.length);
          return 1;
        })
      )
      .then(
        Commands.literal('map').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          if (typeof global.FRankDays.isFcraftV9World === 'function' && global.FRankDays.isFcraftV9World(player.server)) {
            player.tell(global.FRankDays.getFcraftV9MapText(player.server));
            return 1;
          }
          var a = global.FRankDays.getVillageAnchor(player.server);
          player.tell(
            '[브리온 마을 v8.3 주요 시설 및 NPC 좌표 안내]\n' +
              ' · 중앙 분수대 광장(최초 스폰): (' + (a.x + 0.5) + ', ' + (a.y + 1) + ', ' + (a.z + 9.5) + ')\n' +
              ' · 통합 길드 3층 종루 본관(헤스): (' + (a.x + 1.5) + ', ' + (a.y + 1) + ', ' + (a.z - 33.5) + ')\n' +
              ' · 북문 검술 수련장(스키): (' + (a.x + 22.5) + ', ' + (a.y + 1) + ', ' + (a.z - 38.5) + ')\n' +
              ' · 북쪽 세르딘 성문 & 아치 돌다리: (' + a.x + ', ' + (a.y + 3) + ', ' + (a.z - 67) + ') / (' + a.x + ', ' + (a.y - 1) + ', ' + (a.z - 90) + ')\n' +
              ' · 로만의 물약가게 & 연금 첨탑: (' + (a.x + 29.5) + ', ' + (a.y + 1) + ', ' + (a.z - 10.5) + ')\n' +
              ' · 나우의 대장간(+99 단련·안전계승): (' + (a.x + 46.5) + ', ' + (a.y + 1) + ', ' + (a.z - 7.5) + ')\n' +
              ' · 밤밤의 잡화점 / 협합의 보급창고: (' + (a.x + 30.5) + ', ' + (a.y + 1) + ', ' + (a.z + 14.5) + ') / (' + (a.x + 51.5) + ', ' + (a.y + 2) + ', ' + (a.z + 13.5) + ')\n' +
              ' · 고리의 중세 여관 / 휘연의 의료소: (' + (a.x - 30.5) + ', ' + (a.y + 1) + ', ' + (a.z - 5.5) + ') / (' + (a.x + (-31.5)) + ', ' + (a.y + (1)) + ', ' + (a.z + (-28.5)) + ')\n' +
              ' · 다림의 농가 & 관개 실습장: (' + (a.x + (-19.5)) + ', ' + (a.y + (1)) + ', ' + (a.z + (44.5)) + ')\n' +
              ' · 남부 대형 풍차 & 외양간 & 남문: (' + (a.x + 27) + ', ' + (a.y - 2) + ', ' + (a.z + 45) + ') / (' + a.x + ', ' + (a.y - 2) + ', ' + (a.z + 67) + ')\n' +
              ' · 남동쪽 호숫가 보스 시련 제단: (168, 68, 168)'
          );
          return 1;
        })
      )
      .then(
        Commands.literal('ability').then(
          Commands.argument('abilityId', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var abilityId = Arguments.STRING.getResult(ctx, 'abilityId');
            var res = global.FRankDays.selectStarterAbility(player, abilityId);
            player.tell(res.message);
            return res.ok ? 1 : 0;
          })
        )
      )
      .then(
        Commands.literal('breathe').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.triggerSteadyBreath(player);
          player.tell(res.message);
          return res.ok ? 1 : 0;
        })
      )
      .then(
        Commands.literal('warm_hands').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.triggerWarmPalm(player);
          player.tell(res.message);
          return res.ok ? 1 : 0;
        })
      )
      .then(
        Commands.literal('register_job').then(
          Commands.argument('jobId', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var jobId = Arguments.STRING.getResult(ctx, 'jobId');
            var res = global.FRankDays.registerJobF(player, jobId);
            player.tell(res.message);
            return res.ok ? 1 : 0;
          })
        )
      )
      .then(
        Commands.literal('training').then(
          Commands.argument('jobId', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var jobId = Arguments.STRING.getResult(ctx, 'jobId');
            var res = global.FRankDays.completeJobBasicTraining(player, jobId);
            player.tell(res.message);
            return res.ok ? 1 : 0;
          })
        )
      )
      .then(
        Commands.literal('exam_start').then(
          Commands.argument('jobId', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var jobId = Arguments.STRING.getResult(ctx, 'jobId');
            var res = global.FRankDays.startJobExamFtoE(player, jobId);
            player.tell(res.message);
            if (res.ok && res.questions) {
              for (var i = 0; i < res.questions.length; i++) {
                var q = res.questions[i];
                player.tell(
                  q.prompt + ' [1] ' + q.choices['1'] + ' / [2] ' + q.choices['2'] + ' / [3] ' + q.choices['3']
                );
              }
              player.tell('답안 제출: /frank exam_written ' + jobId + ' <1번답> <2번답> <3번답>');
            }
            return res.ok ? 1 : 0;
          })
        )
      )
      .then(
        Commands.literal('exam_written').then(
          Commands.argument('jobId', Arguments.STRING.create(event)).then(
            Commands.argument('a1', Arguments.STRING.create(event)).then(
              Commands.argument('a2', Arguments.STRING.create(event)).then(
                Commands.argument('a3', Arguments.STRING.create(event)).executes(function (ctx) {
                  var player = ctx.source.player;
                  if (!player) return 0;
                  var jobId = Arguments.STRING.getResult(ctx, 'jobId');
                  var a1 = Arguments.STRING.getResult(ctx, 'a1');
                  var a2 = Arguments.STRING.getResult(ctx, 'a2');
                  var a3 = Arguments.STRING.getResult(ctx, 'a3');
                  var res = global.FRankDays.submitJobWrittenAnswers(player, jobId, a1, a2, a3);
                  player.tell(res.message);
                  if (res.feedback && res.feedback.length > 0) {
                    for (var i = 0; i < res.feedback.length; i++) {
                      player.tell(' - ' + res.feedback[i]);
                    }
                  }
                  return res.ok ? 1 : 0;
                })
              )
            )
          )
        )
      )
      .then(
        Commands.literal('exam_submit').then(
          Commands.argument('jobId', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var jobId = Arguments.STRING.getResult(ctx, 'jobId');
            var res = global.FRankDays.evaluateJobPracticalAndCertify(player, jobId);
            global.FRankDays.syncFtbQuestStagesForPlayer(player);
            player.tell(res.message);
            return res.ok ? 1 : 0;
          })
        )
      )
      .then(
        Commands.literal('practice_heal').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.performHealerPracticeCare(player);
          player.tell(res.message);
          return res.ok ? 1 : 0;
        })
      )
      .then(
        Commands.literal('pquest').then(
          Commands.argument('npcId', Arguments.STRING.create(event)).then(
            Commands.argument('actionId', Arguments.STRING.create(event))
              .executes(function (ctx) {
                var player = ctx.source.player;
                if (!player) return 0;
                var npcId = Arguments.STRING.getResult(ctx, 'npcId');
                var actionId = Arguments.STRING.getResult(ctx, 'actionId');
                var res = global.FRankDays.handleTier1PersonalQuest(player, npcId, actionId, null);
                global.FRankDays.syncFtbQuestStagesForPlayer(player);
                player.tell(res.message);
                return res.ok ? 1 : 0;
              })
              .then(
                Commands.argument('choiceId', Arguments.STRING.create(event)).executes(function (ctx) {
                  var player = ctx.source.player;
                  if (!player) return 0;
                  var npcId = Arguments.STRING.getResult(ctx, 'npcId');
                  var actionId = Arguments.STRING.getResult(ctx, 'actionId');
                  var choiceId = Arguments.STRING.getResult(ctx, 'choiceId');
                  var res = global.FRankDays.handleTier1PersonalQuest(player, npcId, actionId, choiceId);
                  global.FRankDays.syncFtbQuestStagesForPlayer(player);
                  player.tell(res.message);
                  return res.ok ? 1 : 0;
                })
              )
          )
        )
      )
      .then(
        Commands.literal('relationship').then(
          Commands.argument('npcId', Arguments.STRING.create(event)).then(
            Commands.argument('branchType', Arguments.STRING.create(event)).executes(function (ctx) {
              var player = ctx.source.player;
              if (!player) return 0;
              var npcId = Arguments.STRING.getResult(ctx, 'npcId');
              var branchType = Arguments.STRING.getResult(ctx, 'branchType');
              var res = global.FRankDays.selectRelationshipBranch(player, npcId, branchType);
              player.tell(res.message);
              return res.ok ? 1 : 0;
            })
          )
        )
      )
      .then(
        Commands.literal('talk').then(
          Commands.argument('npcId', Arguments.STRING.create(event)).executes(function (ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var npcId = Arguments.STRING.getResult(ctx, 'npcId');
            var res = global.FRankDays.openNpcRpgDialog(player, npcId, { bypassDistanceCheck: false });
            if (!res.ok) {
              var fallback = global.FRankDays.interactWithBrionNpc(player, npcId, null);
              return fallback.ok ? 1 : 0;
            }
            return 1;
          })
        )
      )
      .then(
        Commands.literal('npc').then(
          Commands.argument('npcId', Arguments.STRING.create(event)).then(
            Commands.argument('actionId', Arguments.STRING.create(event)).executes(function (ctx) {
              var player = ctx.source.player;
              if (!player) return 0;
              var npcId = Arguments.STRING.getResult(ctx, 'npcId');
              var actionId = Arguments.STRING.getResult(ctx, 'actionId');
              var res = global.FRankDays.interactWithBrionNpc(player, npcId, actionId);
              return res.ok ? 1 : 0;
            })
          )
        )
      )
      .then(
        Commands.literal('darim_orientation').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.completeDarimOrientation(player);
          global.FRankDays.syncFtbQuestStagesForPlayer(player);
          player.tell(res.message);
          return 1;
        })
      )
      .then(
        Commands.literal('farmer_exam_start').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.startFarmerExamFtoE(player);
          player.tell(res.message);
          if (res.ok && res.questions) {
            for (var i = 0; i < res.questions.length; i++) {
              var q = res.questions[i];
              player.tell(q.prompt + ' [1] ' + q.choices['1'] + ' / [2] ' + q.choices['2'] + ' / [3] ' + q.choices['3']);
            }
            player.tell('답안 제출: /frank farmer_exam_written <1번답> <2번답> <3번답>');
          }
          return res.ok ? 1 : 0;
        })
      )
      .then(
        Commands.literal('farmer_exam_written').then(
          Commands.argument('a1', Arguments.STRING.create(event)).then(
            Commands.argument('a2', Arguments.STRING.create(event)).then(
              Commands.argument('a3', Arguments.STRING.create(event)).executes(function (ctx) {
                var player = ctx.source.player;
                if (!player) return 0;
                var a1 = Arguments.STRING.getResult(ctx, 'a1');
                var a2 = Arguments.STRING.getResult(ctx, 'a2');
                var a3 = Arguments.STRING.getResult(ctx, 'a3');
                var res = global.FRankDays.submitFarmerWrittenAnswers(player, a1, a2, a3);
                player.tell(res.message);
                if (res.feedback && res.feedback.length > 0) {
                  for (var i = 0; i < res.feedback.length; i++) {
                    player.tell(' - ' + res.feedback[i]);
                  }
                }
                return res.ok ? 1 : 0;
              })
            )
          )
        )
      )
      .then(
        Commands.literal('farmer_exam_submit').executes(function (ctx) {
          var player = ctx.source.player;
          if (!player) return 0;
          var res = global.FRankDays.evaluateJobPracticalAndCertify(player, 'farmer');
          global.FRankDays.syncFtbQuestStagesForPlayer(player);
          return res.ok ? 1 : 0;
        })
      )
      .then(
        Commands.literal('admin')
          .requires(function (src) {
            return src.hasPermission(2);
          })
          .then(
            Commands.literal('build_brion_village').executes(function (ctx) {
              if (typeof global.FRankDays.refuseFcraftLegacyWorldEdit === 'function' && global.FRankDays.refuseFcraftLegacyWorldEdit(ctx)) return 0;
              var srv = ctx.source.server;
              var res = global.FRankDays.buildBrionVillage(srv, 0, 68, 0, false);
              if (ctx.source.player) {
                ctx.source.player.tell(
                  '[관리자] 브리온 마을 v7.1 (신규 배치 ' +
                    res.placed_structures.length +
                    '개 / 중복 생략 ' +
                    res.skipped_existing_structures.length +
                    '개) 및 확정 NPC 9인 배치가 완료되었습니다!'
                );
              }
              return res.ok ? 1 : 0;
            })
          )
          .then(
            Commands.literal('build_brion_village_here').executes(function (ctx) {
              if (typeof global.FRankDays.refuseFcraftLegacyWorldEdit === 'function' && global.FRankDays.refuseFcraftLegacyWorldEdit(ctx)) return 0;
              var p = ctx.source.player;
              if (!p) return 0;
              var res = global.FRankDays.buildBrionVillage(
                ctx.source.server,
                Math.floor(p.x),
                Math.floor(p.y) - 1,
                Math.floor(p.z),
                false
              );
              p.tell(
                '[관리자] 현재 위치(' +
                  res.anchor.x +
                  ', ' +
                  res.anchor.y +
                  ', ' +
                  res.anchor.z +
                  ')를 중앙 광장 기준으로 브리온 마을 v7.1 배치가 완료되었습니다!'
              );
              return 1;
            })
          )
          .then(
            Commands.literal('force_upgrade_village_v72').executes(function (ctx) {
              if (typeof global.FRankDays.refuseFcraftLegacyWorldEdit === 'function' && global.FRankDays.refuseFcraftLegacyWorldEdit(ctx)) return 0;
              var srv = ctx.source.server;
              var a = global.FRankDays.getVillageAnchor(srv);
              var res = global.FRankDays.buildBrionVillage(srv, a.x, a.y, a.z, true);
              global.FRankDays.buildSerdinForest(srv);
              if (ctx.source.player) {
                ctx.source.player.tell('[관리자] 기존 마을을 신규 v7.2 고밀도 중세 건축물 16동(3층 쌍탑 길드·마녀첨탑 물약상 등) 및 9인 NPC 위치로 강제 교체했습니다!');
              }
              return res.ok ? 1 : 0;
            })
          )
          .then(
            Commands.literal('rollback_v6_village').executes(function (ctx) {
              if (typeof global.FRankDays.refuseFcraftLegacyWorldEdit === 'function' && global.FRankDays.refuseFcraftLegacyWorldEdit(ctx)) return 0;
              var res = global.FRankDays.rollbackBrionVillageToV6(ctx.source.server);
              if (ctx.source.player) {
                ctx.source.player.tell('[관리자] 백업된 구 v6 브리온 마을 레이아웃으로 롤백했습니다.');
              }
              return res.ok ? 1 : 0;
            })
          )
          .then(
            Commands.literal('build_serdin_forest').executes(function (ctx) {
              if (typeof global.FRankDays.refuseFcraftLegacyWorldEdit === 'function' && global.FRankDays.refuseFcraftLegacyWorldEdit(ctx)) return 0;
              var res = global.FRankDays.buildSerdinForest(ctx.source.server);
              if (ctx.source.player) {
                ctx.source.player.tell('[관리자] 세르딘 숲 거점 3종 배치가 완료되었습니다!');
              }
              return res.ok ? 1 : 0;
            })
          )
          .then(
            Commands.literal('build_all').executes(function (ctx) {
              if (typeof global.FRankDays.refuseFcraftLegacyWorldEdit === 'function' && global.FRankDays.refuseFcraftLegacyWorldEdit(ctx)) return 0;
              var srv = ctx.source.server;
              var p = ctx.source.player;
              var ax = p ? Math.floor(p.x) : 0;
              var ay = p ? Math.floor(p.y) - 1 : 68;
              var az = p ? Math.floor(p.z) : 0;
              global.FRankDays.buildBrionVillage(srv, ax, ay, az, false);
              global.FRankDays.buildSerdinForest(srv);
              if (p) {
                p.tell('[관리자] 브리온 마을 v7.1 (16개 건축물 + 9인 NPC) + 세르딘 숲 일괄 배치가 완료되었습니다!');
              }
              return 1;
            })
          )
          .then(
            Commands.literal('sync_npcs').executes(function (ctx) {
              var placed = global.FRankDays.ensureBrionNpcs(ctx.source.server);
              if (ctx.source.player) {
                ctx.source.player.tell('[관리자] 브리온 핵심 NPC ' + placed.length + '명 상태를 복구했습니다.');
              }
              return 1;
            })
          )
          .then(
            Commands.literal('prepare_starter_world').executes(function (ctx) {
              if (typeof global.FRankDays.refuseFcraftLegacyWorldEdit === 'function' && global.FRankDays.refuseFcraftLegacyWorldEdit(ctx)) return 0;
              var res = global.FRankDays.prepareStarterDistributionWorld(ctx.source.server);
              if (ctx.source.player) {
                ctx.source.player.tell(
                  '[관리자] 배포용 시작 월드 초기화 완료! 중앙 광장 스폰: (' +
                    res.anchor.x +
                    ', ' +
                    (res.anchor.y + 1) +
                    ', ' +
                    (res.anchor.z + 10) +
                    ')'
                );
              }
              return 1;
            })
          )
      )
  );
});
