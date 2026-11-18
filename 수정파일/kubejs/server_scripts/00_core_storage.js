// 《F급의 나날》 KubeJS 6 Server Script - Core Storage, Forge 1.20.1 Adapters & Save Migration (v7.1)
// 파일 경로: kubejs/server_scripts/00_core_storage.js

var FRANK_STORAGE_KEY = 'f_rank_days_state_v1';
var FRANK_SERVER_MIRROR_PREFIX = 'f_rank_days_mirror_v1_';
var FRANK_WORLD_ANCHOR_KEY = 'f_rank_days_brion_anchor_v1';
var FRANK_SERDIN_BUILT_KEY = 'f_rank_days_serdin_built_v1';
var FRANK_V7_PLACED_KEY = 'f_rank_days_brion_v7_placed_v1';

global.FRankDays = global.FRankDays || {};

global.FRankDays.ALL_JOBS = [
  'farmer',
  'swordsman',
  'alchemist',
  'blacksmith',
  'healer',
  'relic_researcher'
];

global.FRankDays.GRADE_ORDER = ['UNREGISTERED', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];

global.FRankDays.ACTIVE_NPCS = [
  'roman',
  'darim',
  'hess',
  'ski',
  'hyeophap',
  'nau',
  'bambam',
  'gori',
  'hwiyeon',
  'harin'
];

global.FRankDays.UNDETERMINED_NPCS = ['sia', 'omeu', 'jokjebi'];

global.FRankDays.getBlockProp = function (block, propName) {
  if (!block || !block.properties) return undefined;
  var props = block.properties;
  if (typeof props.get === 'function') {
    var val = props.get(propName);
    if (val !== null && val !== undefined) return String(val);
  }
  if (props[propName] !== undefined && props[propName] !== null) {
    return String(props[propName]);
  }
  return undefined;
};

global.FRankDays.countPlayerItem = function (player, itemId) {
  if (!player || !player.inventory) return 0;
  var inv = player.inventory;
  if (typeof inv.getContainerSize === 'function' && typeof inv.getItem === 'function') {
    var total = 0;
    var size = inv.getContainerSize();
    for (var i = 0; i < size; i++) {
      var stack = inv.getItem(i);
      if (stack && !stack.empty && String(stack.id) === itemId) {
        total += Number(stack.count || 0);
      }
    }
    return total;
  }
  if (inv.allItems && inv.allItems.length !== undefined) {
    var sum = 0;
    for (var j = 0; j < inv.allItems.length; j++) {
      var st = inv.allItems[j];
      if (st && String(st.id) === itemId) {
        sum += Number(st.count || 0);
      }
    }
    return sum;
  }
  if (typeof inv.count === 'function') {
    return Number(inv.count(itemId) || 0);
  }
  return 0;
};

global.FRankDays.hasAnyPlayerItem = function (player, itemIds) {
  for (var i = 0; i < itemIds.length; i++) {
    if (global.FRankDays.countPlayerItem(player, itemIds[i]) > 0) {
      return true;
    }
  }
  if (player && player.mainHandItem && player.mainHandItem.id) {
    if (itemIds.indexOf(String(player.mainHandItem.id)) !== -1) {
      return true;
    }
  }
  return false;
};

global.FRankDays.hasEntityTag = function (entity, tagName) {
  if (!entity || !entity.tags) return false;
  if (typeof entity.tags.contains === 'function') {
    return Boolean(entity.tags.contains(tagName));
  }
  if (entity.tags.indexOf) {
    return entity.tags.indexOf(tagName) !== -1;
  }
  return false;
};

global.FRankDays.notifyFtbQuestsStageCheck = function (player) {
  if (!player) return false;
  if (typeof Java !== 'undefined' && Java && typeof Java.loadClass === 'function') {
    try {
      var $StageTask = Java.loadClass('dev.ftb.mods.ftbquests.quest.task.StageTask');
      var rawPlayer = player.minecraftPlayer || player;
      if ($StageTask && typeof $StageTask.checkStages === 'function' && rawPlayer) {
        $StageTask.checkStages(rawPlayer);
        return true;
      }
    } catch (e) {}
  }
  return false;
};

global.FRankDays.grantPlayerStageOnce = function (player, stageName) {
  if (!player || !stageName) return false;
  var newlyAdded = false;
  if (player.stages) {
    var alreadyHas = typeof player.stages.has === 'function' && player.stages.has(stageName);
    if (!alreadyHas && typeof player.stages.add === 'function') {
      player.stages.add(stageName);
      newlyAdded = true;
    }
  }
  global.FRankDays.notifyFtbQuestsStageCheck(player);
  return newlyAdded;
};

global.FRankDays.createDefaultGuildCard = function () {
  return {
    issued: false,
    awaiting_name_input: false,
    ui_open: false,
    ui_auto_hide_at: 0,
    pending_serial: null,
    registered_display_name: null,
    serial_number: null,
    grade: 'F',
    issued_date: null,
    issued_agency: '아르베른 통합 길드 브리온 지부',
    initial_ability_id: null,
    initial_job_id: null
  };
};

global.FRankDays.createDefaultNpcDialogSession = function () {
  return {
    open: false,
    active_npc_id: null,
    page: 0,
    opened_at: 0,
    gift_cooldowns: {}
  };
};

global.FRankDays.createDefaultEcologyLog = function () {
  return {
    observed_animals: [],
    monster_codex: [],
    fed_animals_count: 0,
    discovered_by_zone: {
      village: [],
      forest: [],
      river_lake: [],
      distant: []
    }
  };
};

global.FRankDays.createDefaultPersonalQuests = function () {
  return {
    hess: {
      phase: 'NOT_STARTED',
      inspected_ranger_camp: false,
      consulted_clinic_stats: false,
      chosen_ending: null
    },
    darim: {
      phase: 'NOT_STARTED',
      found_rusty_sword: false,
      talked_about_past: false,
      chosen_ending: null
    },
    roman: {
      phase: 'NOT_STARTED',
      darim_note_collected: false,
      hwiyeon_note_collected: false,
      notes_delivered: false,
      chosen_ending: null
    }
  };
};

global.FRankDays.createDefaultOnboarding = function () {
  return {
    spawned_in_brion: false,
    initial_plaza_spawn_done: false,
    starter_kit_given: false,
    guild_registration_unlocked: false,
    ability_Cooldowns: {
      steady_breath_until: 0,
      warm_palm_until: 0
    },
    quests: {
      q01_first_day: {
        status: 'ACTIVE',
        left_house: false,
        reached_square: false,
        found_guild: false,
        talked_hess: false
      },
      q02_first_registration: {
        status: 'LOCKED',
        explained_system: false,
        selected_ability: false
      },
      q03_first_job: {
        status: 'LOCKED',
        registered_any_job: false,
        first_job_id: null
      },
      q04_first_steps: {
        status: 'LOCKED',
        learned_farming_darim: false,
        accepted_herb_quest_roman: false,
        completed_herb_quest_roman: false,
        visited_serdin_entrance: false,
        greeted_villagers: []
      }
    }
  };
};

global.FRankDays.createDefaultState = function (playerUuid, playerName) {
  var jobs = {};
  for (var i = 0; i < global.FRankDays.ALL_JOBS.length; i++) {
    var jid = global.FRankDays.ALL_JOBS[i];
    jobs[jid] = {
      grade: 'UNREGISTERED',
      registered_at: null,
      promoted_at: null,
      certificate_serial: null,
      stats: {
        tilled: 0,
        planted: 0,
        mature_harvested: 0,
        mob_kills: 0,
        herbs_gathered: 0,
        ores_mined: 0,
        care_actions: 0,
        rubbings_taken: 0
      }
    };
  }

  var relationships = {};
  for (var n = 0; n < global.FRankDays.ACTIVE_NPCS.length; n++) {
    var npcId = global.FRankDays.ACTIVE_NPCS[n];
    relationships[npcId] = {
      affinity: 0,
      stage: 1,
      stage_id: 'acquaintance',
      relation_type: 'none',
      romance_eligible: 'undetermined',
      flags: {
        first_met: false,
        incident_triggered: false,
        incident_resolved: false,
        relationship_branch_selected: false
      },
      ending_id: null
    };
  }

  return {
    schema_version: 4,
    player_uuid: String(playerUuid || 'unknown'),
    player_name: String(playerName || 'Player'),
    special_ability: {
      ability_id: null,
      grade: 'F',
      selected_at: null
    },
    guild_card: global.FRankDays.createDefaultGuildCard(),
    npc_dialog: global.FRankDays.createDefaultNpcDialogSession(),
    reward_ledger: {},
    ecology_log: global.FRankDays.createDefaultEcologyLog(),
    job_licenses: jobs,
    active_exams: {},
    exam_history: [],
    flags: {
      darim_farming_orientation_done: false,
      job_training_done: {
        farmer: false,
        swordsman: false,
        alchemist: false,
        blacksmith: false,
        healer: false,
        relic_researcher: false
      }
    },
    starter_onboarding: global.FRankDays.createDefaultOnboarding(),
    relationships: relationships,
    personal_quests: global.FRankDays.createDefaultPersonalQuests(),
    undetermined_npcs_reserved: {
      harin: { status: 'FIRST_MEETING_AVAILABLE' },
      sia: { status: 'undetermined' },
      omeu: { status: 'undetermined' },
      jokjebi: { status: 'undetermined' }
    },
    legacy_import_log: []
  };
};

global.FRankDays.migrateAndEnsureFields = function (rawState, player, playerUuid, playerName) {
  var isExistingRecord = Boolean(rawState && typeof rawState === 'object');
  var defaults = global.FRankDays.createDefaultState(playerUuid, playerName);
  if (!isExistingRecord) {
    rawState = defaults;
  }

  rawState.schema_version = 4;
  rawState.player_uuid = String(playerUuid || rawState.player_uuid || 'unknown');
  rawState.player_name = String(playerName || rawState.player_name || 'Player');

  if (!rawState.special_ability) rawState.special_ability = defaults.special_ability;
  if (!rawState.guild_card) {
    rawState.guild_card = global.FRankDays.createDefaultGuildCard();
  } else {
    var defGc = global.FRankDays.createDefaultGuildCard();
    if (rawState.guild_card.issued === undefined) rawState.guild_card.issued = false;
    if (rawState.guild_card.awaiting_name_input === undefined) rawState.guild_card.awaiting_name_input = false;
    if (rawState.guild_card.ui_open === undefined) rawState.guild_card.ui_open = false;
    if (rawState.guild_card.ui_auto_hide_at === undefined) rawState.guild_card.ui_auto_hide_at = 0;
    if (!rawState.guild_card.issued_agency) rawState.guild_card.issued_agency = defGc.issued_agency;
    if (!rawState.guild_card.grade) rawState.guild_card.grade = 'F';
  }

  if (!rawState.npc_dialog) {
    rawState.npc_dialog = global.FRankDays.createDefaultNpcDialogSession();
  } else {
    if (rawState.npc_dialog.open === undefined) rawState.npc_dialog.open = false;
    if (rawState.npc_dialog.page === undefined) rawState.npc_dialog.page = 0;
    if (!rawState.npc_dialog.gift_cooldowns) rawState.npc_dialog.gift_cooldowns = {};
  }

  if (!rawState.reward_ledger) rawState.reward_ledger = {};
  if (!rawState.ecology_log) {
    rawState.ecology_log = global.FRankDays.createDefaultEcologyLog();
  } else {
    if (!rawState.ecology_log.observed_animals) rawState.ecology_log.observed_animals = [];
    if (!rawState.ecology_log.monster_codex) rawState.ecology_log.monster_codex = [];
    if (rawState.ecology_log.fed_animals_count === undefined) rawState.ecology_log.fed_animals_count = 0;
    if (!rawState.ecology_log.discovered_by_zone) {
      rawState.ecology_log.discovered_by_zone = {
        village: [],
        forest: [],
        river_lake: [],
        distant: []
      };
    }
  }

  if (!rawState.job_licenses) rawState.job_licenses = {};

  var anyRegisteredJob = null;
  for (var i = 0; i < global.FRankDays.ALL_JOBS.length; i++) {
    var jid = global.FRankDays.ALL_JOBS[i];
    if (!rawState.job_licenses[jid]) {
      rawState.job_licenses[jid] = defaults.job_licenses[jid];
    } else {
      var stObj = rawState.job_licenses[jid].stats;
      if (!stObj) {
        rawState.job_licenses[jid].stats = defaults.job_licenses[jid].stats;
      } else {
        if (stObj.tilled === undefined) stObj.tilled = 0;
        if (stObj.planted === undefined) stObj.planted = 0;
        if (stObj.mature_harvested === undefined) stObj.mature_harvested = 0;
        if (stObj.mob_kills === undefined) stObj.mob_kills = 0;
        if (stObj.herbs_gathered === undefined) stObj.herbs_gathered = 0;
        if (stObj.ores_mined === undefined) stObj.ores_mined = 0;
        if (stObj.care_actions === undefined) stObj.care_actions = 0;
        if (stObj.rubbings_taken === undefined) stObj.rubbings_taken = 0;
      }
      if (rawState.job_licenses[jid].grade !== 'UNREGISTERED' && !anyRegisteredJob) {
        anyRegisteredJob = jid;
      }
    }
  }

  if (!rawState.active_exams) rawState.active_exams = {};
  if (!rawState.exam_history) rawState.exam_history = [];
  if (!rawState.flags) rawState.flags = defaults.flags;
  if (!rawState.flags.job_training_done) {
    rawState.flags.job_training_done = defaults.flags.job_training_done;
  }
  if (rawState.flags.darim_farming_orientation_done) {
    rawState.flags.job_training_done.farmer = true;
  }

  if (!rawState.relationships) rawState.relationships = {};
  for (var n = 0; n < global.FRankDays.ACTIVE_NPCS.length; n++) {
    var npcId = global.FRankDays.ACTIVE_NPCS[n];
    if (!rawState.relationships[npcId]) {
      rawState.relationships[npcId] = defaults.relationships[npcId];
    } else {
      var rel = rawState.relationships[npcId];
      if (!rel.flags) rel.flags = defaults.relationships[npcId].flags;
      if (!rel.romance_eligible) rel.romance_eligible = 'undetermined';
    }
  }

  if (!rawState.personal_quests) {
    rawState.personal_quests = global.FRankDays.createDefaultPersonalQuests();
  } else {
    var defPq = global.FRankDays.createDefaultPersonalQuests();
    if (!rawState.personal_quests.hess) rawState.personal_quests.hess = defPq.hess;
    if (!rawState.personal_quests.darim) rawState.personal_quests.darim = defPq.darim;
    if (!rawState.personal_quests.roman) rawState.personal_quests.roman = defPq.roman;
  }

  if (!rawState.undetermined_npcs_reserved) {
    rawState.undetermined_npcs_reserved = defaults.undetermined_npcs_reserved;
  }
  if (!rawState.legacy_import_log) rawState.legacy_import_log = [];

  if (player && player.persistentData) {
    if (
      player.persistentData.contains('f_rank_ability') &&
      !rawState.special_ability.ability_id
    ) {
      var legacyAbility = String(player.persistentData.getString('f_rank_ability'));
      if (legacyAbility) {
        rawState.special_ability.ability_id = legacyAbility;
        rawState.legacy_import_log.push('Imported legacy key f_rank_ability without deleting source key');
      }
    }
  }

  var hadPriorProgress = Boolean(
    rawState.special_ability.ability_id ||
      anyRegisteredJob ||
      rawState.guild_card.issued
  );
  if (!rawState.starter_onboarding) {
    rawState.starter_onboarding = global.FRankDays.createDefaultOnboarding();
    if (isExistingRecord && hadPriorProgress) {
      var ob = rawState.starter_onboarding;
      ob.spawned_in_brion = true;
      ob.initial_plaza_spawn_done = true;
      ob.starter_kit_given = true;
      ob.guild_registration_unlocked = true;
      ob.quests.q01_first_day.status = 'COMPLETED';
      ob.quests.q01_first_day.left_house = true;
      ob.quests.q01_first_day.reached_square = true;
      ob.quests.q01_first_day.found_guild = true;
      ob.quests.q01_first_day.talked_hess = true;

      if (rawState.special_ability.ability_id) {
        ob.quests.q02_first_registration.status = 'COMPLETED';
        ob.quests.q02_first_registration.explained_system = true;
        ob.quests.q02_first_registration.selected_ability = true;
      } else {
        ob.quests.q02_first_registration.status = 'ACTIVE';
      }

      if (anyRegisteredJob) {
        ob.quests.q03_first_job.status = 'COMPLETED';
        ob.quests.q03_first_job.registered_any_job = true;
        ob.quests.q03_first_job.first_job_id = anyRegisteredJob;
        ob.quests.q04_first_steps.status = 'ACTIVE';
      } else if (rawState.special_ability.ability_id) {
        ob.quests.q03_first_job.status = 'ACTIVE';
      }
      rawState.legacy_import_log.push('Migrated registered player without duplicating starter kit/tutorial');
    }
  } else {
    var defOb = global.FRankDays.createDefaultOnboarding();
    if (!rawState.starter_onboarding.ability_Cooldowns) {
      rawState.starter_onboarding.ability_Cooldowns = defOb.ability_Cooldowns;
    }
    if (!rawState.starter_onboarding.quests) {
      rawState.starter_onboarding.quests = defOb.quests;
    }
    if (rawState.starter_onboarding.initial_plaza_spawn_done === undefined) {
      rawState.starter_onboarding.initial_plaza_spawn_done = Boolean(
        rawState.starter_onboarding.spawned_in_brion ||
          rawState.starter_onboarding.starter_kit_given ||
          hadPriorProgress
      );
    }
  }

  return rawState;
};

global.FRankDays.loadPlayerState = function (player, serverOverride) {
  var uuid = String(player.uuid);
  var name = String(player.username || player.name || 'Player');
  var srv = serverOverride || player.server;
  var jsonStr = '';

  if (player.persistentData && player.persistentData.contains(FRANK_STORAGE_KEY)) {
    jsonStr = String(player.persistentData.getString(FRANK_STORAGE_KEY));
  } else if (
    srv &&
    srv.persistentData &&
    srv.persistentData.contains(FRANK_SERVER_MIRROR_PREFIX + uuid)
  ) {
    jsonStr = String(srv.persistentData.getString(FRANK_SERVER_MIRROR_PREFIX + uuid));
  }

  var parsed = null;
  if (jsonStr && jsonStr.length > 2) {
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      parsed = null;
    }
  }

  var state = global.FRankDays.migrateAndEnsureFields(parsed, player, uuid, name);
  global.FRankDays.savePlayerState(player, state, srv);
  return state;
};

global.FRankDays.savePlayerState = function (player, state, serverOverride) {
  var uuid = String(player.uuid);
  var srv = serverOverride || player.server;
  var serialized = JSON.stringify(state);

  if (player.persistentData) {
    player.persistentData.putString(FRANK_STORAGE_KEY, serialized);
  }
  if (srv && srv.persistentData) {
    srv.persistentData.putString(FRANK_SERVER_MIRROR_PREFIX + uuid, serialized);
  }
  return serialized;
};

global.FRankDays.getVillageAnchor = function (server) {
  if (server && server.persistentData && server.persistentData.contains(FRANK_WORLD_ANCHOR_KEY)) {
    try {
      var parsed = JSON.parse(String(server.persistentData.getString(FRANK_WORLD_ANCHOR_KEY)));
      if (!parsed.layout_version) parsed.layout_version = 6;
      return parsed;
    } catch (e) {}
  }
  return { x: 0, y: 68, z: 0, built: false, layout_version: 7 };
};

global.FRankDays.setVillageAnchor = function (server, x, y, z, built, layoutVersion) {
  var data = {
    x: Math.floor(x),
    y: Math.floor(y),
    z: Math.floor(z),
    built: Boolean(built),
    layout_version: layoutVersion || 7
  };
  if (server && server.persistentData) {
    server.persistentData.putString(FRANK_WORLD_ANCHOR_KEY, JSON.stringify(data));
  }
  return data;
};

global.FRankDays.getPlacedVillageStructures = function (server) {
  if (server && server.persistentData && server.persistentData.contains(FRANK_V7_PLACED_KEY)) {
    try {
      return JSON.parse(String(server.persistentData.getString(FRANK_V7_PLACED_KEY))) || {};
    } catch (e) {}
  }
  return {};
};

global.FRankDays.setPlacedVillageStructures = function (server, mapObj) {
  if (server && server.persistentData) {
    server.persistentData.putString(FRANK_V7_PLACED_KEY, JSON.stringify(mapObj || {}));
  }
};

global.FRankDays.isSerdinForestBuilt = function (server) {
  if (server && server.persistentData && server.persistentData.contains(FRANK_SERDIN_BUILT_KEY)) {
    return String(server.persistentData.getString(FRANK_SERDIN_BUILT_KEY)) === 'true';
  }
  return false;
};

global.FRankDays.setSerdinForestBuilt = function (server, built) {
  if (server && server.persistentData) {
    server.persistentData.putString(FRANK_SERDIN_BUILT_KEY, built ? 'true' : '');
  }
};

PlayerEvents.respawned(function (event) {
  var player = event.player;
  var srv = event.server || player.server;
  var uuid = String(player.uuid);
  if (
    srv &&
    srv.persistentData &&
    srv.persistentData.contains(FRANK_SERVER_MIRROR_PREFIX + uuid)
  ) {
    var mirrorJson = String(srv.persistentData.getString(FRANK_SERVER_MIRROR_PREFIX + uuid));
    if (player.persistentData) {
      player.persistentData.putString(FRANK_STORAGE_KEY, mirrorJson);
    }
  }
  global.FRankDays.loadPlayerState(player, srv);
});

PlayerEvents.loggedOut(function (event) {
  var player = event.player;
  var state = global.FRankDays.loadPlayerState(player, event.server);
  state.guild_card.awaiting_name_input = false;
  state.guild_card.ui_open = false;
  state.npc_dialog.open = false;
  state.npc_dialog.active_npc_id = null;
  global.FRankDays.savePlayerState(player, state, event.server);
});
