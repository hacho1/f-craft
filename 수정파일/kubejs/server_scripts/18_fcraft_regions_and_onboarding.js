// F-Craft v9. Region geometry is shared by discovery, titles and location quests.
// This file deliberately does nothing in legacy worlds or before terrain validation.
var FCraftRegions = (function () {
  function number(v) { return typeof v === 'number' && isFinite(v); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function validate(c) {
    var errors = [], roles = {}, ids = {}, seenPoints = {};
    if (!c || c.schemaVersion !== 1) return ['schemaVersion must be 1'];
    if (!c.worldValidationId || !c.worldMarkerKey) errors.push('world validation identity is required');
    if (!c.spawn || !number(c.spawn.x) || !number(c.spawn.y) || !number(c.spawn.z)) errors.push('verified spawn is required');
    if (!c.anchor || !number(c.anchor.x) || !number(c.anchor.y) || !number(c.anchor.z)) errors.push('verified village anchor is required');
    var points = c.worldFingerprint || [];
    for (var p = 0; p < points.length; p++) {
      var q = points[p], key = q.x + ',' + q.y + ',' + q.z;
      if (!number(q.x) || !number(q.y) || !number(q.z) || !q.block || seenPoints[key]) errors.push('invalid or repeated fingerprint');
      seenPoints[key] = true;
    }
    if (points.length < 3) errors.push('at least three verified fingerprint points are required');
    var regions = c.regions || [];
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i], b = r.bounds;
      if (!r.id || ids[r.id]) errors.push('duplicate or missing region id');
      ids[r.id] = true;
      if (!r.name || !r.dimension || !b || !number(b.minX) || !number(b.maxX) || !number(b.minY) || !number(b.maxY) || !number(b.minZ) || !number(b.maxZ) || b.minX > b.maxX || b.minY > b.maxY || b.minZ > b.maxZ) errors.push('invalid geometry: ' + r.id);
      if (r.questRole) roles[r.questRole] = true;
    }
    var required = ['starter_forest', 'town_entrance', 'central_square', 'guild_interior', 'serdin_outer'];
    for (var j = 0; j < required.length; j++) if (!roles[required[j]]) errors.push('missing quest role: ' + required[j]);
    return errors;
  }
  function contains(r, pos, padding) {
    var b = r.bounds, p = padding || 0;
    return pos.dimension === r.dimension && pos.x >= b.minX - p && pos.x <= b.maxX + p && pos.y >= b.minY - p && pos.y <= b.maxY + p && pos.z >= b.minZ - p && pos.z <= b.maxZ + p;
  }
  function find(c, id) {
    for (var i = 0; i < c.regions.length; i++) if (c.regions[i].id === id) return c.regions[i];
    return null;
  }
  function resolve(c, pos, previous) {
    var best = null;
    for (var i = 0; i < c.regions.length; i++) {
      var r = c.regions[i];
      if (contains(r, pos, 0) && (!best || Number(r.priority || 0) > Number(best.priority || 0) || (Number(r.priority || 0) === Number(best.priority || 0) && r.id < best.id))) best = r;
    }
    var old = find(c, previous);
    if (old && contains(old, pos, Number(c.exitHysteresisBlocks || 0)) && (!best || Number(best.priority || 0) <= Number(old.priority || 0))) return old;
    return best;
  }
  // Landmarks reuse this file's canonical contains/resolve geometry and the same saved player state.
  // They have an independent presentation channel so nested town landmarks never replay a region title.
  function landmarkStep(c, s, pos, now, landmarks) {
    s.landmarkShownAt = s.landmarkShownAt || {};
    s.discoveredLandmarks = s.discoveredLandmarks || {};
    var display = resolve({regions:landmarks,exitHysteresisBlocks:c.exitHysteresisBlocks},pos,s.currentLandmark || '');
    var id = display ? display.id : '', dwell = Number(c.landmarkEntryDwellMs || c.entryDwellMs || 0);
    if(id === (s.currentLandmark || '')) { s.landmarkCandidate=id; return null; }
    if(s.landmarkCandidate !== id || now < Number(s.landmarkCandidateSince || 0)) { s.landmarkCandidate=id;s.landmarkCandidateSince=now; }
    if(now - Number(s.landmarkCandidateSince || 0) < dwell) return null;
    s.currentLandmark=id;
    if(!display)return null;
    var last=s.landmarkShownAt[id];
    if(last !== undefined && now-last < Number(c.landmarkReentryCooldownMs || 45000))return null;
    var first=!s.discoveredLandmarks[id];s.discoveredLandmarks[id]=true;s.landmarkShownAt[id]=now;
    return {id:id,name:display.landmarkName || display.name,subtitle:display.subtitle || '',accent:display.accent || '#99783D',first:first};
  }
  function fresh() { return { version: 1, current: '', candidate: '', candidateSince: 0, currentDisplayGroup: '', displayRegion: '', displayCandidate: '', displayCandidateSince: 0, insideSince: {}, discovered: {}, titleShownAt: {}, visitedRoles: {}, onboardingComplete: false }; }
  function step(c, saved, pos, now) {
    var s = saved ? clone(saved) : fresh();
    s.discovered = s.discovered || {}; s.titleShownAt = s.titleShownAt || {}; s.visitedRoles = s.visitedRoles || {};
    s.insideSince = s.insideSince || {};
    var dwell = Number(c.entryDwellMs || 0), changed = false, displays = [], landmarks = [];
    var verifiedBrion = c.worldValidationId === 'fcraft_v9_medieval_town_verified_01';
    // Nested quest zones all count. A high-priority UI region cannot mask a role.
    for (var i = 0; i < c.regions.length; i++) {
      var r = c.regions[i], questRole = r.questRole;
      // Use the town title's existing geometry for every legitimate arrival route.
      // The old narrow north gate remains a location role for existing layouts.
      if (!questRole && verifiedBrion && r.id === 'brion' && String(r.displayRegionId || r.id) === 'brion') questRole = 'town_entrance';
      if (r.showTitle !== false) displays.push(r);
      if (r.landmarkTitle === true) landmarks.push(r);
      if (contains(r, pos, 0)) {
        if (s.insideSince[r.id] === undefined || now < s.insideSince[r.id]) s.insideSince[r.id] = now;
        if (questRole && !s.visitedRoles[questRole] && now - s.insideSince[r.id] >= dwell) {
          s.visitedRoles[questRole] = true; changed = true;
        }
      } else delete s.insideSince[r.id];
    }
    // A saved visit inside the town proves arrival even if an old gate was missed.
    // Only restore this prerequisite; a guild visit never invents a plaza visit.
    if (verifiedBrion && s.visitedRoles.town_entrance !== true && (s.visitedRoles.central_square === true || s.visitedRoles.guild_interior === true)) {
      s.visitedRoles.town_entrance = true; changed = true;
    }
    var landmark = landmarkStep(c,s,pos,now,landmarks);
    var next = resolve(c, pos, s.current), id = next ? next.id : '', old = find(c, s.current);
    if (s.current && old && old.dimension !== pos.dimension) { s.current = ''; changed = true; }
    if (id !== s.current) {
      if (s.candidate !== id || now < s.candidateSince) { s.candidate = id; s.candidateSince = now; }
      if (now - s.candidateSince >= dwell) { s.current = id; changed = true; }
    }
    var displayConfig = { regions: displays, exitHysteresisBlocks: c.exitHysteresisBlocks };
    var display = resolve(displayConfig, pos, s.displayRegion || '');
    var group = display ? String(display.displayRegionId || display.id) : '';
    var title = null;
    if (group === (s.currentDisplayGroup || '')) {
      s.displayRegion = display ? display.id : '';
      s.displayCandidate = group;
    } else {
      if (s.displayCandidate !== group || now < s.displayCandidateSince) { s.displayCandidate = group; s.displayCandidateSince = now; }
      if (now - s.displayCandidateSince < dwell) return { state: s, changed: changed, title: null, landmark: landmark, region: next };
      s.currentDisplayGroup = group; s.displayRegion = display ? display.id : ''; changed = true;
    }
    if (display && group && !s.discovered[group]) {
      var first = true;
      s.discovered[group] = true;
      var text = c.titleGroups && c.titleGroups[group] ? c.titleGroups[group] : display;
      title = { id: group, name: text.name, subtitle: text.subtitle || '', first: first };
      s.titleShownAt[group] = now;
    } else if (display && group && changed && s.displayCandidate === group && saved && saved.currentDisplayGroup !== group) {
      var last = s.titleShownAt[group];
      if (c.showTitleOnReentry === true && (last === undefined || now - last >= Number(c.reentryCooldownMs || 0))) {
        var reentryText = c.titleGroups && c.titleGroups[group] ? c.titleGroups[group] : display;
        title = { id: group, name: reentryText.name, subtitle: reentryText.subtitle || '', first: false };
        s.titleShownAt[group] = now;
      }
    }
    return { state: s, changed: changed, title: title, landmark: landmark, region: next };
  }
  return { validate: validate, contains: contains, resolve: resolve, step: step, fresh: fresh };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FCraftRegions;

if (typeof global !== 'undefined' && global.FRankDays) {
  global.FRankDays.FCRAFT_REGION_CORE = FCraftRegions;
  global.FRankDays.FCRAFT_CONFIG = { enabled: false, schemaVersion: 1, regions: [] };
  global.FRankDays.FCRAFT_CONFIG_ERROR = false;
  global.FRankDays._fcraftWorld = { server: null, valid: false };
  global.FRankDays.sameFcraftServer = function (a, b) {
    if (a === b) return true;
    try { return Boolean(a && b && typeof a.equals === 'function' && a.equals(b)); } catch (e) { return false; }
  };
  global.FRankDays._serdinLayoutV94 = { server: null, data: null };
  // The opt-in lives beside this world's level.dat, never in the global profile.
  // Switching between v9.3, v9.4 and ordinary worlds cannot reuse coordinates.
  global.FRankDays.readSerdinV94WorldFile = function (server) {
    if (!server) return null;
    var root = server.getWorldPath(Java.loadClass('net.minecraft.world.level.storage.LevelResource').ROOT);
    // KubeJS6 makes Path.resolve(String/Path) ambiguous and forbids directly
    // importing java.io.File. The existing world-directory File provides a
    // zero-argument listing and each existing child provides its native Path.
    var files = root.toFile().listFiles(), file = null;
    if (files === null) throw new Error('World directory is unreadable');
    for (var i = 0; i < files.length; i++) if (String(files[i].getName()) === 'fcraft_layout_v94.json') { file = files[i]; break; }
    if (!file) return null;
    if (!file.isFile()) throw new Error('World layout is not a regular file');
    var layout = JSON.parse(String(JsonIO.readString(file.toPath())));
    var ready = layout && (layout.buildStatus === 'complete' || (layout.developmentValidationMode === true && layout.buildStatus === 'offline_blocks_built_pending_native_game_validation'));
    if (!layout || layout.schemaVersion !== 1 || layout.layoutVersion !== '9.4' || layout.worldValidationId !== 'fcraft_v9_medieval_town_verified_01' || layout.containerPrepared !== true || !ready || !layout.fingerprint || layout.fingerprint.length < 3 || !layout.regionsConfig) throw new Error('Unverified v9.4 world layout');
    return layout;
  };
  global.FRankDays.getSerdinV94Layout = function (server) {
    var entry = global.FRankDays._serdinLayoutV94;
    return !global.FRankDays.FCRAFT_CONFIG_ERROR && global.FRankDays.FCRAFT_CONFIG.enabled === true && global.FRankDays.sameFcraftServer(entry.server, server) && global.FRankDays.isFcraftV9World(server) ? entry.data : null;
  };
  global.FRankDays.loadFcraftRegionConfig = function (server) {
    global.FRankDays._fcraftRegionConfigServer = server || null;
    global.FRankDays._fcraftWorld = { server: null, valid: false };
    global.FRankDays._serdinLayoutV94 = { server: server || null, data: null };
    try {
      // KubeJS6 JsonIO.read returns java.util.Map. JSON.stringify is lossy for
      // that wrapper; readString is the installed API's Gson-backed text path.
      var layout = global.FRankDays.readSerdinV94WorldFile(server);
      var cfg = layout ? layout.regionsConfig : JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_regions.json')));
      global.FRankDays._serdinLayoutV94 = { server: server || null, data: null };
      if (layout) {
        cfg = layout.regionsConfig;
        if (cfg.worldValidationId !== layout.worldValidationId) throw new Error('Layout/region identity mismatch');
        global.FRankDays._serdinLayoutV94 = { server: server, data: layout };
      }
      if (!cfg || cfg.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
      if (cfg.enabled === true) {
        var errors = FCraftRegions.validate(cfg);
        if (errors.length) throw new Error(errors.join('; '));
      }
      global.FRankDays.FCRAFT_CONFIG = cfg;
      global.FRankDays.FCRAFT_CONFIG_ERROR = false;
      global.FRankDays.FCRAFT_CONFIG_ERROR_MESSAGE = '';
    } catch (e) {
      global.FRankDays.FCRAFT_CONFIG = { enabled: false, schemaVersion: 1, regions: [] };
      global.FRankDays.FCRAFT_CONFIG_ERROR = true;
      global.FRankDays.FCRAFT_CONFIG_ERROR_MESSAGE = String(e);
      console.warn('[F-Craft] 지역 설정을 읽지 못했습니다. 기존 지형 생성·초기화 명령을 중지합니다: ' + e);
    }
    return global.FRankDays.FCRAFT_CONFIG;
  };
  global.FRankDays.isFcraftV9CandidateWorld = function (server) {
    if (global.FRankDays.FCRAFT_CONFIG_ERROR) return Boolean(server && server.persistentData);
    var c = global.FRankDays.FCRAFT_CONFIG;
    var cache = global.FRankDays._fcraftWorld;
    return Boolean((global.FRankDays.sameFcraftServer(cache.server, server) && cache.fingerprintMatches) || (server && server.persistentData && c.worldMarkerKey && String(server.persistentData.getString(c.worldMarkerKey)) === c.worldValidationId));
  };
  global.FRankDays.initializeFcraftV9World = function (server, overworld) {
    // Earlier legacy loaded callbacks may enter here before this file's own
    // loaded callback. Resolve this server's metadata before ANY construction.
    if (!global.FRankDays.sameFcraftServer(global.FRankDays._fcraftRegionConfigServer, server)) global.FRankDays.loadFcraftRegionConfig(server);
    var c = global.FRankDays.FCRAFT_CONFIG, cache = global.FRankDays._fcraftWorld;
    if (global.FRankDays.sameFcraftServer(cache.server, server) && cache.valid) return true;
    if (!server || !server.persistentData || !overworld || typeof overworld.getBlock !== 'function' || !c.worldFingerprint || c.worldFingerprint.length < 3) return false;
    if (!(global.FRankDays.sameFcraftServer(cache.server, server) && cache.fingerprintMatches)) {
      for (var i = 0; i < c.worldFingerprint.length; i++) {
        var p = c.worldFingerprint[i], b = overworld.getBlock(p.x, p.y, p.z);
        if (!b || String(b.id) !== p.block) return false;
      }
      // Even a disabled verified-source candidate is protected against legacy rebuilding.
      global.FRankDays._fcraftWorld = { server: server, valid: false, fingerprintMatches: true };
    }
    if (c.enabled !== true || FCraftRegions.validate(c).length) return false;
    var layout = global.FRankDays._serdinLayoutV94.data;
    if (layout && global.FRankDays.sameFcraftServer(global.FRankDays._serdinLayoutV94.server, server)) {
      var layoutPoints = layout.fingerprint, geometry = layout.serdinV97;
      // A played v9.6 save may legitimately have changed an old landmark block.
      // Only the explicit, materialized v9.7 opt-in can use its new protected
      // container sites as physical identity; the town proof above still applies.
      if (layout.schemaVersion === 1 && layout.layoutVersion === '9.4' && layout.serdinLayoutVersion === '9.7' && layout.worldValidationId === 'fcraft_v9_medieval_town_verified_01' && geometry && geometry.schemaVersion === 1 && geometry.layoutVersion === '9.7' && geometry.serdinLayoutVersion === '9.7' && geometry.geometryReady === true && geometry.worldValidationId === layout.worldValidationId && Array.isArray(geometry.geometryFingerprint) && geometry.geometryFingerprint.length >= 3) {
        var validGeometryPoints = true, seenGeometryPoints = {};
        for (var g = 0; g < geometry.geometryFingerprint.length; g++) {
          var gp = geometry.geometryFingerprint[g], key = gp && gp.x + ',' + gp.y + ',' + gp.z;
          if (!gp || typeof gp.x !== 'number' || !isFinite(gp.x) || gp.x !== Math.floor(gp.x) || typeof gp.y !== 'number' || !isFinite(gp.y) || gp.y !== Math.floor(gp.y) || typeof gp.z !== 'number' || !isFinite(gp.z) || gp.z !== Math.floor(gp.z) || typeof gp.block !== 'string' || !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(gp.block) || /^minecraft:(air|cave_air|void_air)$/.test(gp.block) || seenGeometryPoints[key]) { validGeometryPoints = false; break; }
          seenGeometryPoints[key] = true;
        }
        if (validGeometryPoints) layoutPoints = geometry.geometryFingerprint;
      }
      for (var f = 0; f < layoutPoints.length; f++) {
        var point = layoutPoints[f], block = overworld.getBlock(point.x, point.y, point.z);
        if (!block || String(block.id) !== point.block) return false;
      }
    }
    server.persistentData.putString(c.worldMarkerKey, c.worldValidationId);
    var a = global.FRankDays.setVillageAnchor(server, c.anchor.x, c.anchor.y, c.anchor.z, true, 9);
    a.content_version = 9; a.fcraft_world_id = c.worldValidationId;
    server.persistentData.putString('f_rank_days_brion_anchor_v1', JSON.stringify(a));
    server.persistentData.putString('f_rank_days_world_autogen_v73', 'fcraft_v9_verified_source');
    global.FRankDays.setSerdinForestBuilt(server, true);
    global.FRankDays._fcraftWorld = { server: server, valid: true, fingerprintMatches: true };
    if (server.runCommandSilent) {
      server.runCommandSilent('setworldspawn ' + Math.floor(c.spawn.x) + ' ' + Math.floor(c.spawn.y) + ' ' + Math.floor(c.spawn.z) + ' ' + Number(c.spawn.yaw || 0));
      server.runCommandSilent('gamerule spawnRadius 0');
    }
    global.FRankDays.ensureBrionNpcs(server, false);
    return true;
  };
  global.FRankDays.isFcraftV9World = function (server) {
    return global.FRankDays.sameFcraftServer(global.FRankDays._fcraftWorld.server, server) && global.FRankDays._fcraftWorld.valid === true;
  };
  global.FRankDays.getFcraftExistingBossAltar = function (server) {
    if (!global.FRankDays.isFcraftV9World(server)) return null;
    var cfg = global.FRankDays.FCRAFT_CONFIG, p = cfg.existingBossAltar;
    if (!p || p.enabled !== true || p.originalContent !== true || p.clearanceVerified !== true || typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.z !== 'number' || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) return null;
    var x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z), radius = 12;
    var protectedRoles = { starter_forest: true, town_entrance: true, central_square: true, guild_interior: true };
    for (var i = 0; i < cfg.regions.length; i++) {
      var r = cfg.regions[i], b = r.bounds;
      if ((r.protectTerrain || protectedRoles[r.questRole]) && x + radius >= b.minX && x - radius <= b.maxX && z + radius >= b.minZ && z - radius <= b.maxZ) return null;
    }
    for (var j = 0; j < (cfg.npcs || []).length; j++) {
      var npc = cfg.npcs[j];
      if (Math.abs(npc.x - x) <= radius + 16 && Math.abs(npc.z - z) <= radius + 16) return null;
    }
    return { x: x, y: y, z: z };
  };
  global.FRankDays.isFcraftSourceProtected = function (server) {
    return global.FRankDays.isFcraftV9World(server) || global.FRankDays.isFcraftV9CandidateWorld(server);
  };
  global.FRankDays.refuseFcraftLegacyWorldEdit = function (ctx) {
    if (!global.FRankDays.isFcraftSourceProtected(ctx.source.server)) return false;
    var message = '[F-Craft] 이 원본 지형 월드에서는 이전 버전 자동 건축·롤백·배포 초기화 명령을 사용할 수 없습니다.';
    if (ctx.source.player && ctx.source.player.tell) ctx.source.player.tell(message);
    else console.warn(message);
    return true;
  };
  global.FRankDays.isFcraftV9Cohort = function (player) {
    var c = global.FRankDays.FCRAFT_CONFIG;
    if (player && player.persistentData && String(player.persistentData.getString('fcraft_v9_cohort')) !== c.worldValidationId) {
      try {
        var mirror = JSON.parse(String(player.server.persistentData.getString('fcraft_v9_player_' + String(player.uuid))));
        if (mirror.cohort === c.worldValidationId) player.persistentData.putString('fcraft_v9_cohort', mirror.cohort);
      } catch (e) {}
    }
    return Boolean(player && player.persistentData && String(player.persistentData.getString('fcraft_v9_cohort')) === c.worldValidationId && global.FRankDays.isFcraftV9World(player.server));
  };
  global.FRankDays.prepareFcraftV9Player = function (player, server) {
    var ow = server && typeof server.overworld === 'function' ? server.overworld() : player.level;
    if (!global.FRankDays.initializeFcraftV9World(server, ow)) return false;
    if (global.FRankDays.isFcraftV9Cohort(player)) return true;
    var pd = player.persistentData;
    var hasPrior = pd && pd.contains('f_rank_days_state_v1');
    hasPrior = hasPrior || String(server.persistentData.getString('f_rank_days_mirror_v1_' + String(player.uuid))).length > 0;
    var played = -1;
    try {
      var playerStats = player.stats || (typeof player.getStats === 'function' ? player.getStats() : null);
      if (playerStats && typeof playerStats.getPlayTime === 'function') {
        played = Number(playerStats.getPlayTime());
      } else if (playerStats && playerStats.playTime !== undefined) {
        played = Number(playerStats.playTime);
      } else if (playerStats && typeof playerStats.getValue === 'function' && typeof Java !== 'undefined') {
        var stats = Java.loadClass('net.minecraft.stats.Stats');
        played = Number(playerStats.getValue(stats.CUSTOM.get(stats.PLAY_TIME)));
      }
    } catch (e) {}
    // Unknown playtime is not permission to reset an existing character.
    if (!pd || hasPrior || played !== 0) return false;
    pd.putString('fcraft_v9_cohort', global.FRankDays.FCRAFT_CONFIG.worldValidationId);
    global.FRankDays.saveFcraftRegionState(player, FCraftRegions.fresh());
    return true;
  };
  global.FRankDays.readFcraftRegionState = function (player) {
    try { var s = JSON.parse(String(player.persistentData.getString('fcraft_regions_v1'))); if (s && s.version === 1) return s; } catch (e) {}
    try {
      var mirror = JSON.parse(String(player.server.persistentData.getString('fcraft_v9_player_' + String(player.uuid))));
      if (mirror.regions && mirror.regions.version === 1) return mirror.regions;
    } catch (e) {}
    return FCraftRegions.fresh();
  };
  global.FRankDays.saveFcraftRegionState = function (player, state) {
    player.persistentData.putString('fcraft_regions_v1', JSON.stringify(state));
    var cohort = String(player.persistentData.getString('fcraft_v9_cohort') || '');
    if (!cohort) {
      try { cohort = JSON.parse(String(player.server.persistentData.getString('fcraft_v9_player_' + String(player.uuid)))).cohort || ''; } catch (e) {}
    }
    if (player.server && player.server.persistentData) player.server.persistentData.putString('fcraft_v9_player_' + String(player.uuid), JSON.stringify({ cohort: cohort, regions: state }));
  };
  global.FRankDays.getFcraftNpcDefinitions = function (anchor) {
    var c = global.FRankDays.FCRAFT_CONFIG, result = [], source = global.FRankDays.BRION_V7_NPCS || [];
    for (var i = 0; i < (c.npcs || []).length; i++) {
      var n = c.npcs[i], base = null;
      for (var j = 0; j < source.length; j++) if (source[j].id === n.id) base = source[j];
      if (!base && n.id === 'harin') base = { id: 'harin', tag: 'npc_harin', label: '하린 [A급 레인저]', yaw: 0, profession: 'minecraft:fletcher', skin: 'customnpcs:textures/entity/custom/placeholder_guild_receptionist.png' };
      if (!base) continue;
      var def = JSON.parse(JSON.stringify(base));
      def.dx = n.x - anchor.x; def.dy = n.y - anchor.y; def.dz = n.z - anchor.z;
      delete def.zone;
      def.world_coords = [n.x, n.y, n.z]; def.yaw = Number(n.yaw || 0);
      if (n.skin) def.skin = n.skin;
      result.push(def);
    }
    return result;
  };
  global.FRankDays.fcraftNpcChunkReadiness = function (server, definitions) {
    var world = server.overworld(), chunks = {}, pending = [];
    var $ChunkPos = Java.loadClass('net.minecraft.world.level.ChunkPos');
    var chunkCache = typeof world.getChunkSource === 'function' ? world.getChunkSource() : world.m_7726_();
    for (var i = 0; i < definitions.length; i++) {
      var cx = Math.floor(definitions[i].x / 16), cz = Math.floor(definitions[i].z / 16), key = cx + ',' + cz;
      if (chunks[key]) continue;
      chunks[key] = true;
      var packed = typeof $ChunkPos.asLong === 'function' ? $ChunkPos.asLong(cx, cz) : $ChunkPos.m_45589_(cx, cz);
      var entitiesReady = typeof world.areEntitiesLoaded === 'function' ? world.areEntitiesLoaded(packed) : world.m_143319_(packed);
      var blockReady = typeof chunkCache.hasChunk === 'function' ? chunkCache.hasChunk(cx, cz) : chunkCache.m_5563_(cx, cz);
      if (!entitiesReady || !blockReady) pending.push([cx, cz]);
    }
    return { ready: pending.length === 0, pending: pending };
  };
  // CustomNPCs' getAllEntities sees loaded chunks only. Both block chunks and
  // entity NBT must be ready before the legacy tag-based deduplication can run.
  // This also protects manual NPC repair calls after the town has unloaded.
  var fcraftLegacyEnsureNpcs = global.FRankDays.ensureBrionNpcs;
  if (typeof fcraftLegacyEnsureNpcs === 'function') global.FRankDays.ensureBrionNpcs = function (server, repositionExisting) {
    if (!global.FRankDays.isFcraftV9World(server)) {
      if (global.FRankDays.isFcraftV9CandidateWorld(server)) return [];
      return fcraftLegacyEnsureNpcs(server, repositionExisting);
    }
    if (!server || typeof server.scheduleInTicks !== 'function' || !server.runCommandSilent) return fcraftLegacyEnsureNpcs(server, repositionExisting);
    var cache = global.FRankDays._fcraftWorld;
    cache.npcRepositionRequested = cache.npcRepositionRequested || Boolean(repositionExisting);
    if (cache.npcSyncPending) return [];
    cache.npcSyncPending = true; cache.npcSyncReady = false; cache.npcSyncError = '';
    var requested = {}, owned = [], definitions = global.FRankDays.FCRAFT_CONFIG.npcs || [];
    for (var i = 0; i < definitions.length; i++) {
      var x = Math.floor(definitions[i].x), z = Math.floor(definitions[i].z), key = Math.floor(x / 16) + ',' + Math.floor(z / 16);
      if (requested[key]) continue;
      requested[key] = true;
      if (Number(server.runCommandSilent('forceload query ' + x + ' ' + z)) <= 0) {
        server.runCommandSilent('forceload add ' + x + ' ' + z);
        owned.push([x, z]);
      }
    }
    var attempts = 0;
    var finishNpcSync = function () {
      cache.npcSyncPending = false; cache.npcRepositionRequested = false;
      server.scheduleInTicks(120, function () {
        for (var j = 0; j < owned.length; j++) server.runCommandSilent('forceload remove ' + owned[j][0] + ' ' + owned[j][1]);
      });
    };
    var advanceNpcSync = function () {
      try {
        if (!global.FRankDays.isFcraftV9World(server)) { finishNpcSync(); return; }
        var readiness = global.FRankDays.fcraftNpcChunkReadiness(server, definitions);
        cache.npcSyncReadiness = readiness;
        if (!readiness.ready) {
          attempts++;
          if (attempts <= 120) { server.scheduleInTicks(10, advanceNpcSync); return; }
          throw new Error('NPC entity NBT did not finish loading: ' + JSON.stringify(readiness.pending));
        }
        fcraftLegacyEnsureNpcs(server, cache.npcRepositionRequested);
        cache.npcSyncReady = true;
        finishNpcSync();
      } catch (npcSyncError) {
        cache.npcSyncError = String(npcSyncError);
        console.warn('[F-Craft] NPC 동기화를 중지했습니다. 기존 엔티티를 중복 생성하지 않습니다: ' + npcSyncError);
        finishNpcSync();
      }
    };
    server.scheduleInTicks(10, advanceNpcSync);
    return [];
  };
  // Relocate the already implemented altar only to an explicitly verified
  // clearing; its blocks, boss type, rewards and combat rules stay the same.
  var fcraftExistingAltarBuilder = global.FRankDays.ensureWroughtBossAltarBuiltV8;
  if (typeof fcraftExistingAltarBuilder === 'function') global.FRankDays.ensureWroughtBossAltarBuiltV8 = function (server, forceRebuild) {
    var point = global.FRankDays.getFcraftExistingBossAltar(server);
    if (!point || !server || typeof server.scheduleInTicks !== 'function' || !server.runCommandSilent) return fcraftExistingAltarBuilder(server, forceRebuild);
    var cache = global.FRankDays._fcraftWorld;
    if (cache.altarSyncReady && !forceRebuild) return { ok: true, already_built: true, coords: point };
    if (cache.altarSyncPending) return { ok: true, pending: true, coords: point };
    cache.altarSyncPending = true; cache.altarSyncReady = false; cache.altarSyncError = '';
    var chunks = [], owned = [];
    for (var cx = Math.floor((point.x - 12) / 16); cx <= Math.floor((point.x + 12) / 16); cx++) {
      for (var cz = Math.floor((point.z - 12) / 16); cz <= Math.floor((point.z + 12) / 16); cz++) {
        var x = cx * 16 + 8, z = cz * 16 + 8;
        chunks.push({ x: x, z: z });
        if (Number(server.runCommandSilent('forceload query ' + x + ' ' + z)) <= 0) {
          server.runCommandSilent('forceload add ' + x + ' ' + z); owned.push([x, z]);
        }
      }
    }
    var attempts = 0;
    var finishAltarSync = function () {
      cache.altarSyncPending = false;
      server.scheduleInTicks(120, function () {
        for (var j = 0; j < owned.length; j++) server.runCommandSilent('forceload remove ' + owned[j][0] + ' ' + owned[j][1]);
      });
    };
    var advanceAltarSync = function () {
      try {
        var ready = global.FRankDays.fcraftNpcChunkReadiness(server, chunks);
        if (!ready.ready) {
          attempts++;
          if (attempts <= 120) { server.scheduleInTicks(10, advanceAltarSync); return; }
          throw new Error('Existing altar chunks did not finish loading');
        }
        var result = fcraftExistingAltarBuilder(server, forceRebuild);
        cache.altarSyncReady = Boolean(result && result.ok);
        if (!cache.altarSyncReady) cache.altarSyncError = result && result.reason || 'existing_altar_build_failed';
        finishAltarSync();
      } catch (altarError) {
        cache.altarSyncError = String(altarError);
        console.warn('[F-Craft] 기존 보스 제단 배치를 중지했습니다: ' + altarError); finishAltarSync();
      }
    };
    server.scheduleInTicks(10, advanceAltarSync);
    return { ok: true, pending: true, coords: point };
  };
  global.FRankDays.giveFcraftV9StarterKit = function (player) {
    if (!global.FRankDays.isFcraftV9Cohort(player)) return { ok: false, reason: 'existing_player_preserved' };
    var s = global.FRankDays.loadPlayerState(player), ob = s.starter_onboarding;
    if (ob.starter_kit_given) return { ok: false, reason: 'already_given' };
    ob.starter_kit_given = true;
    // Compatibility flag prevents any legacy spawn alias from moving this character.
    ob.initial_plaza_spawn_done = true;
    global.FRankDays.savePlayerState(player, s);
    if (player.give) {
      player.give('minecraft:wooden_hoe'); player.give('minecraft:wooden_axe');
      player.give('6x minecraft:bread'); player.give('8x minecraft:wheat_seeds'); player.give('8x minecraft:torch');
    }
    if (player.tell) player.tell('낯선 숲에서 눈을 떴다. 나무 사이의 오솔길을 따라가 보자.');
    return { ok: true, starter_kit_given: true, teleported: false };
  };
  global.FRankDays.getFcraftV9MapText = function (server) {
    var c = global.FRankDays.FCRAFT_CONFIG, lines = ['[F-Craft · 확인된 마을 시설]'];
    var definitions = global.FRankDays.getFcraftNpcDefinitions(global.FRankDays.getVillageAnchor(server));
    for (var i = 0; i < definitions.length; i++) lines.push(' · ' + definitions[i].label + ': (' + definitions[i].world_coords.join(', ') + ')');
    lines.push('지역 이정표와 숲길을 따라 이동하세요.');
    return lines.join('\n');
  };
  global.FRankDays.getFcraftV9QuestSummary = function (player) {
    var state = global.FRankDays.loadPlayerState(player), s = global.FRankDays.readFcraftRegionState(player), v = s.visitedRoles;
    var registration = v.town_entrance && v.central_square && v.guild_interior && state.starter_onboarding.quests.q01_first_day.talked_hess && Boolean(state.special_ability.ability_id) && state.starter_onboarding.quests.q03_first_job.registered_any_job;
    var done = [v.town_entrance, v.town_entrance && v.central_square, v.town_entrance && v.central_square && v.guild_interior, registration, registration && state.guild_card.issued, s.onboardingComplete];
    var names = ['여긴 무슨 마을이지?', '처음 보는 거리', '길드라는 곳', '평민의 첫 등록', '나의 첫 번째 신분증', '무엇부터 시작할까?'];
    var lines = ['[F-Craft · 나의 첫걸음]'];
    for (var i = 0; i < names.length; i++) lines.push((done[i] ? '✓ ' : '▶ ') + '[1-' + (i + 1) + '] ' + names[i]);
    return lines.join('\n');
  };
  global.FRankDays.syncFcraftV9Quests = function (player, state) {
    if (!global.FRankDays.isFcraftV9Cohort(player)) {
      global.FRankDays.grantPlayerStageOnce(player, 'fcraft_legacy_tutorial');
      return;
    }
    var s = global.FRankDays.readFcraftRegionState(player), v = s.visitedRoles;
    function mark(condition, id) { if (condition) global.FRankDays.grantPlayerStageOnce(player, id); }
    mark(true, 'fcraft_v9_tutorial');
    mark(v.town_entrance, 'fcraft_v9_ch1_entrance');
    mark(v.town_entrance && v.central_square, 'fcraft_v9_ch1_square');
    mark(v.town_entrance && v.central_square && v.guild_interior, 'fcraft_v9_ch1_guild');
    var registered = v.town_entrance && v.central_square && v.guild_interior && state.starter_onboarding.quests.q01_first_day.talked_hess && Boolean(state.special_ability.ability_id) && state.starter_onboarding.quests.q03_first_job.registered_any_job;
    mark(registered, 'fcraft_v9_ch1_registered');
    var signed = registered && state.guild_card.issued;
    mark(signed, 'fcraft_v9_ch1_signed_card');
    if (signed && !s.onboardingComplete) {
      if (player.tell) player.tell('이제 무엇부터 시작할까? 다림의 농사, 숲 탐험, 주민과의 인연, 다른 직업을 원하는 순서대로 시작할 수 있다.');
      s.onboardingComplete = true;
      global.FRankDays.saveFcraftRegionState(player, s);
    }
    mark(signed, 'fcraft_v9_ch1_freedom');
  };
  global.FRankDays.tickFcraftRegions = function (player, now) {
    if (!global.FRankDays.isFcraftV9World(player.server)) return { changed: false };
    // Restore the cohort before writing a replacement player's mirrored state.
    var cohort = global.FRankDays.isFcraftV9Cohort(player);
    var c = global.FRankDays.FCRAFT_CONFIG, old = global.FRankDays.readFcraftRegionState(player);
    var result = FCraftRegions.step(c, old, { x: Number(player.x), y: Number(player.y), z: Number(player.z), dimension: String(player.level.dimension) }, now);
    // Persist discoveries before issuing commands: reconnecting cannot replay a first visit.
    global.FRankDays.saveFcraftRegionState(player, result.state);
    if (result.title && player.server.runCommandSilent && player.username && /^[A-Za-z0-9_]{1,16}$/.test(String(player.username))) {
      var target = player.username, t = result.title;
      if (t.first) {
        player.server.runCommandSilent('title ' + target + ' times 10 40 10');
        player.server.runCommandSilent('title ' + target + ' subtitle ' + JSON.stringify({ text: t.subtitle, color: 'gray' }));
        player.server.runCommandSilent('title ' + target + ' title ' + JSON.stringify({ text: t.name, color: 'gold' }));
      } else {
        player.server.runCommandSilent('title ' + target + ' actionbar ' + JSON.stringify({ text: t.name, color: 'gray' }));
      }
    }
    if (result.landmark && typeof player.sendData === 'function') {
      player.sendData('f_rank_days:landmark_title_v93', {
        id:result.landmark.id,name:result.landmark.name,subtitle:result.landmark.subtitle,accent:result.landmark.accent,first:result.landmark.first,
        delay_ticks:result.title ? 65 : 0,duration_ticks:65
      });
    }
    if (result.changed && cohort) {
      var state = global.FRankDays.loadPlayerState(player), v = result.state.visitedRoles;
      // These are factual compatibility flags; the geometry above is their only source.
      if (v.central_square) state.starter_onboarding.quests.q01_first_day.reached_square = true;
      if (v.guild_interior) state.starter_onboarding.quests.q01_first_day.found_guild = true;
      if (v.serdin_outer) state.starter_onboarding.quests.q04_first_steps.visited_serdin_entrance = true;
      global.FRankDays.savePlayerState(player, state);
      global.FRankDays.syncFtbQuestStagesForPlayer(player);
    }
    return result;
  };
  // Load before any ServerEvents.loaded callback (legacy callbacks register first).
  global.FRankDays.loadFcraftRegionConfig();
  if (typeof ServerEvents !== 'undefined' && ServerEvents.loaded) ServerEvents.loaded(function (event) {
    var server = event.server;
    if (!global.FRankDays.sameFcraftServer(global.FRankDays._fcraftRegionConfigServer, server)) global.FRankDays.loadFcraftRegionConfig(server);
    global.FRankDays.initializeFcraftV9World(server, server && typeof server.overworld === 'function' ? server.overworld() : null);
  });
  if (typeof PlayerEvents !== 'undefined' && PlayerEvents.tick) PlayerEvents.tick(function (event) {
    var p = event.player;
    if (!p || !p.server || !p.persistentData) return;
    var now = Date.now(), last = Number(p.persistentData.getString('fcraft_region_poll_ms') || 0);
    if (now >= last && now - last < 250) return;
    p.persistentData.putString('fcraft_region_poll_ms', String(now));
    global.FRankDays.tickFcraftRegions(p, now);
  });
}
