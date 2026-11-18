// 《F급의 나날》 KubeJS 6 Server Script - v8.2 Nau Unified Forge GUI, Server-Authoritative VFX/SFX (+99 Mythic / Intensity Toggle) & Upgraded Boss Trial Altar
// 파일 경로: kubejs/server_scripts/17_v8_2_vfx_altar_and_forge_gui.js
// 핵심 구현 사항 (Phase 4 · Phase 5 · Phase 6 비파괴 확장):
// 1. 서버 판정 이후에만 발생하는 전투·강화 이펙트 엔진 (emitServerVerifiedVfxV82):
//    - 패링 성공(금속 충돌음 + 청백 스파크 + 보스/몬스터 경직 피드백), 패링 실패(방어 흔들림 저음),
//      회피 구르기(Combat Roll 기본 모션·무적 유지 + 발밑 흙먼지/잔상),
//      강화 성공(금빛 파티클 + 단조 타격음), 강화 실패(회색 연기 + 둔탁한 금속음, 무기 비파괴),
//      +99 최고 단계 달성 전용 연출(초월 축포 사운드 + 자수정·황금 기둥 파티클 + 전용 배너)
//    - 플레이어별 파티클 강도 설정(/frank fx <full|reduced|off>, client_visual_settings.json 연동)
// 2. 나우 통합 단조·안전계승 GUI 백엔드 (openNauForgeAndInheritGuiV82 / f_rank_days:execute_enhance_gui):
//    - 보유 무기 전수 스캔, 기본 확률(95/90/80/70/65/60%) vs 나우 숙련(+5%p) 확률, 재료 보유/필요 수량, 3단 화폐 수수료를 GUI로 동기화
// 3. 보스 시련 제단(X:168, Y:68, Z:168) 구조물 및 소환 연출 고도화:
//    - 실제 .mca 지형 실측(북서 Y=70 잔디 ~ 남동 Y=64 호숫가 모래)에 맞춰 Y=63~67 심층암 석축 기단을 시공하여 공중 부양을 원천 제거
//    - 고대 마력 룬 문양 바닥(조각된 심층암·길디드 흑암·마그마 코어) + 4기 고대 기둥 + 중앙 제단 단상 구성 및 접근 상태 안내·단계별 소환 이펙트 적용

global.FRankDays = global.FRankDays || {};

global.FRankDays.VFX_EVENT_LOG_V82 = [];
global.FRankDays._altarHintCooldownByUuid = {};

global.FRankDays.getVisualSettingsConfigV82 = function () {
  if (global.FRankDays._cachedVisCfgV82) return global.FRankDays._cachedVisCfgV82;
  if (typeof JsonIO !== 'undefined' && JsonIO && typeof JsonIO.read === 'function') {
    try {
      var loaded = JsonIO.read('config/f_rank_days/client_visual_settings.json');
      if (loaded && loaded.available_modes) {
        global.FRankDays._cachedVisCfgV82 = loaded;
        return loaded;
      }
    } catch (e) {}
  }
  global.FRankDays._cachedVisCfgV82 = {
    default_particle_intensity: 'full',
    available_modes: {
      full: { particle_multiplier: 1.0, hud_banner: true, sound_enabled: true },
      reduced: { particle_multiplier: 0.35, hud_banner: true, sound_enabled: true },
      off: { particle_multiplier: 0.0, hud_banner: true, sound_enabled: true }
    }
  };
  return global.FRankDays._cachedVisCfgV82;
};

global.FRankDays.getPlayerFxIntensityV82 = function (player) {
  var cfg = global.FRankDays.getVisualSettingsConfigV82();
  var defMode = String(cfg.default_particle_intensity || 'full');
  if (!player || typeof global.FRankDays.loadPlayerState !== 'function') return defMode;
  var st = global.FRankDays.loadPlayerState(player);
  var mode = st && st.v82_fx_intensity ? String(st.v82_fx_intensity).toLowerCase() : defMode;
  return cfg.available_modes[mode] ? mode : 'full';
};

global.FRankDays.setPlayerFxIntensityV82 = function (player, modeRaw) {
  var mode = String(modeRaw || '').toLowerCase();
  var cfg = global.FRankDays.getVisualSettingsConfigV82();
  if (!cfg.available_modes[mode]) {
    return { ok: false, reason: 'invalid_fx_mode', message: '[이펙트 설정] 사용 가능한 모드는 full, reduced, off 입니다.' };
  }
  var st = global.FRankDays.loadPlayerState(player);
  st.v82_fx_intensity = mode;
  global.FRankDays.savePlayerState(player, st);
  var labels = { full: '기본(100%)', reduced: '절제·저사양(35%)', off: '파티클 끄기(0%)' };
  var msg = '[시각 효과 설정] 전투·강화 파티클 강도가 [' + labels[mode] + '] 모드로 저장되었습니다.';
  if (player && player.tell) player.tell(msg);
  return { ok: true, mode: mode, multiplier: cfg.available_modes[mode].particle_multiplier, message: msg };
};

// 서버 판정 완료 직후에만 실행되는 통합 VFX/SFX 송출기
global.FRankDays.emitServerVerifiedVfxV82 = function (player, vfxType, metaOpt) {
  if (!player) return { emitted: false };
  var meta = metaOpt || {};
  var cfg = global.FRankDays.getVisualSettingsConfigV82();
  var mode = global.FRankDays.getPlayerFxIntensityV82(player);
  var mSpec = cfg.available_modes[mode] || cfg.available_modes.full;
  var mult = Number(mSpec.particle_multiplier !== undefined ? mSpec.particle_multiplier : 1.0);

  function scaleCount(baseCnt) {
    if (mult <= 0) return 0;
    return Math.max(1, Math.round(baseCnt * mult));
  }

  var srv = player.server;
  var uname = player.username;
  var px = Number(meta.x !== undefined ? meta.x : (player.x || 0)).toFixed(1);
  var py = Number(meta.y !== undefined ? meta.y : (Number(player.y || 69) + 1.1)).toFixed(1);
  var pz = Number(meta.z !== undefined ? meta.z : (player.z || 0)).toFixed(1);
  var spawnedParticles = 0;

  if (srv && typeof srv.runCommandSilent === 'function' && uname) {
    if (vfxType === 'PARRY_SUCCESS') {
      srv.runCommandSilent('playsound minecraft:block.amethyst_block.chime master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 1.1 1.65');
      var c1 = scaleCount(12);
      var c2 = scaleCount(6);
      if (c1 > 0) { srv.runCommandSilent('particle minecraft:electric_spark ' + px + ' ' + py + ' ' + pz + ' 0.25 0.25 0.25 0.12 ' + c1); spawnedParticles += c1; }
      if (c2 > 0) { srv.runCommandSilent('particle minecraft:end_rod ' + px + ' ' + py + ' ' + pz + ' 0.18 0.18 0.18 0.04 ' + c2); spawnedParticles += c2; }
    } else if (vfxType === 'PARRY_FAIL') {
      srv.runCommandSilent('playsound minecraft:item.shield.break master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 0.55 0.75');
      var cf = scaleCount(6);
      if (cf > 0) { srv.runCommandSilent('particle minecraft:smoke ' + px + ' ' + py + ' ' + pz + ' 0.2 0.2 0.2 0.02 ' + cf); spawnedParticles += cf; }
    } else if (vfxType === 'DODGE_ROLL') {
      var footY = Number(player.y || 69).toFixed(1);
      srv.runCommandSilent('playsound minecraft:entity.player.attack.sweep master ' + uname + ' ' + px + ' ' + footY + ' ' + pz + ' 0.45 1.35');
      var cd = scaleCount(8);
      if (cd > 0) { srv.runCommandSilent('particle minecraft:cloud ' + px + ' ' + footY + ' ' + pz + ' 0.25 0.05 0.25 0.02 ' + cd); spawnedParticles += cd; }
    } else if (vfxType === 'ENHANCE_MYTHIC_99') {
      srv.runCommandSilent('playsound minecraft:ui.toast.challenge_complete master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 1.0 1.0');
      srv.runCommandSilent('playsound minecraft:block.beacon.power_select master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 1.0 1.3');
      var cm1 = scaleCount(28);
      var cm2 = scaleCount(18);
      if (cm1 > 0) { srv.runCommandSilent('particle minecraft:end_rod ' + px + ' ' + py + ' ' + pz + ' 0.45 0.8 0.45 0.08 ' + cm1); spawnedParticles += cm1; }
      if (cm2 > 0) { srv.runCommandSilent('particle minecraft:totem_of_undying ' + px + ' ' + py + ' ' + pz + ' 0.4 0.6 0.4 0.12 ' + cm2); spawnedParticles += cm2; }
    } else if (vfxType === 'ENHANCE_BREAKTHROUGH_V10') {
      srv.runCommandSilent('playsound minecraft:item.totem.use master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 0.65 1.2');
      srv.runCommandSilent('playsound minecraft:block.anvil.use master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 0.85 1.45');
      var cbv10 = scaleCount(30);
      if (cbv10 > 0) { srv.runCommandSilent('particle minecraft:totem_of_undying ' + px + ' ' + (py + 1) + ' ' + pz + ' 0.45 0.65 0.45 0.06 ' + cbv10); spawnedParticles += cbv10; }
    } else if (vfxType === 'ENHANCE_SUCCESS') {
      srv.runCommandSilent('playsound minecraft:entity.experience_orb.pickup master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 0.85 1.35');
      var cs = scaleCount(14);
      if (cs > 0) { srv.runCommandSilent('particle minecraft:wax_on ' + px + ' ' + py + ' ' + pz + ' 0.28 0.35 0.28 0.06 ' + cs); spawnedParticles += cs; }
    } else if (vfxType === 'ENHANCE_FAILURE') {
      srv.runCommandSilent('playsound minecraft:block.fire.extinguish master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 0.45 0.8');
      var cfl = scaleCount(10);
      if (cfl > 0) { srv.runCommandSilent('particle minecraft:ash ' + px + ' ' + py + ' ' + pz + ' 0.28 0.28 0.28 0.02 ' + cfl); spawnedParticles += cfl; }
    } else if (vfxType === 'BOSS_ALTAR_SUMMON') {
      srv.runCommandSilent('playsound minecraft:block.end_portal_frame.fill master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 1.2 0.75');
      var cb1 = scaleCount(24);
      var cb2 = scaleCount(16);
      if (cb1 > 0) { srv.runCommandSilent('particle minecraft:flame ' + px + ' ' + py + ' ' + pz + ' 1.4 0.3 1.4 0.04 ' + cb1); spawnedParticles += cb1; }
      if (cb2 > 0) { srv.runCommandSilent('particle minecraft:soul_fire_flame ' + px + ' ' + py + ' ' + pz + ' 0.8 0.9 0.8 0.05 ' + cb2); spawnedParticles += cb2; }
    } else if (vfxType === 'BOSS_ALTAR_BLOCKED') {
      srv.runCommandSilent('playsound minecraft:block.beacon.deactivate master ' + uname + ' ' + px + ' ' + py + ' ' + pz + ' 0.7 1.2');
    }
  }

  var pkt = {
    vfx_type: vfxType,
    intensity: mode,
    particle_multiplier: mult,
    spawned_particles: spawnedParticles,
    server_verified: true,
    previous_level: meta.previous_level,
    new_level: meta.new_level,
    banner_text: meta.banner_text || ''
  };
  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:vfx_event', pkt);
  }

  global.FRankDays.VFX_EVENT_LOG_V82.push({
    player_uuid: String(player.uuid || player.username || ''),
    vfx_type: vfxType,
    intensity: mode,
    spawned_particles: spawnedParticles,
    meta: meta
  });
  if (global.FRankDays.VFX_EVENT_LOG_V82.length > 100) {
    global.FRankDays.VFX_EVENT_LOG_V82.shift();
  }

  return pkt;
};

// =========================================================================
// 1. 기존 강화·전투 판정 함수 비파괴 후킹 (오직 서버 판정 완료 후에만 VFX 송출!)
// =========================================================================
if (typeof global.FRankDays.executeWeaponEnhancement === 'function' && !global.FRankDays._wrappedEnhanceVfxV82) {
  var _origExecEnhV8 = global.FRankDays.executeWeaponEnhancement;
  global.FRankDays._wrappedEnhanceVfxV82 = true;
  global.FRankDays.executeWeaponEnhancement = function (player, optionsOpt) {
    var res = _origExecEnhV8.apply(this, arguments);
    if (res && res.ok) {
      if (res.success && global.FRankDays.recordPracticalActionPhase4) {
        global.FRankDays.recordPracticalActionPhase4(player, {type:'enhance', actorUuid:String(player.uuid), actionId:'enhance:'+String(player.uuid)+':'+Date.now()+':'+res.new_level, level:Number(res.new_level), new_level:Number(res.new_level), itemId:String(res.item_id||''), weaponId:String(res.item_id||'')});
      }
      if (res.success && (res.new_level === 5 || res.new_level === 10 || res.new_level === 15)) {
        global.FRankDays.emitServerVerifiedVfxV82(player, 'ENHANCE_BREAKTHROUGH_V10', { previous_level: res.previous_level, new_level: res.new_level, item_id: res.item_id, banner_text: '★ +' + res.new_level + '강 돌파 특전 개방' });
      }
      if (res.success && res.new_level === 99) {
        global.FRankDays.emitServerVerifiedVfxV82(player, 'ENHANCE_MYTHIC_99', {
          previous_level: res.previous_level,
          new_level: 99,
          item_id: res.item_id
        });
      } else if (res.success) {
        global.FRankDays.emitServerVerifiedVfxV82(player, 'ENHANCE_SUCCESS', {
          previous_level: res.previous_level,
          new_level: res.new_level,
          item_id: res.item_id
        });
      } else {
        global.FRankDays.emitServerVerifiedVfxV82(player, 'ENHANCE_FAILURE', {
          previous_level: res.previous_level,
          new_level: res.new_level,
          weapon_destroyed: false
        });
      }
    }
    return res;
  };
}

if (typeof global.FRankDays.resolveIncomingAttackOnPlayerV8 === 'function' && !global.FRankDays._wrappedCombatVfxV82) {
  var _origResolveAtkV8 = global.FRankDays.resolveIncomingAttackOnPlayerV8;
  global.FRankDays._wrappedCombatVfxV82 = true;
  global.FRankDays.resolveIncomingAttackOnPlayerV8 = function (player, attackerEntity, incomingDamage) {
    var csBefore = global.FRankDays.getPlayerCombatStateV8(player);
    var prevFails = csBefore.stats.parry_fail;
    var res = _origResolveAtkV8.apply(this, arguments);
    if (res) {
      if (res.outcome === 'PARRIED') {
        global.FRankDays.emitServerVerifiedVfxV82(player, 'PARRY_SUCCESS', {
          stagger_applied: res.stagger_applied,
          counter_window_ms: res.counter_window_ms
        });
      } else if (res.outcome === 'HIT_TAKEN' && csBefore.stats.parry_fail > prevFails) {
        global.FRankDays.emitServerVerifiedVfxV82(player, 'PARRY_FAIL', {
          damage_taken: res.final_damage
        });
      }
    }
    return res;
  };
}

if (typeof global.FRankDays.triggerPlayerCombatRollV8 === 'function' && !global.FRankDays._wrappedRollVfxV82) {
  var _origRollV8 = global.FRankDays.triggerPlayerCombatRollV8;
  global.FRankDays._wrappedRollVfxV82 = true;
  global.FRankDays.triggerPlayerCombatRollV8 = function (player, payloadOpt) {
    var res = _origRollV8.apply(this, arguments);
    if (res && res.ok) {
      global.FRankDays.emitServerVerifiedVfxV82(player, 'DODGE_ROLL', {
        delegated_to_combatroll_mod: res.delegated_to_combatroll_mod
      });
    }
    return res;
  };
}

// =========================================================================
// 2. 나우 통합 단조·강화 + 안전 계승 2탭 GUI 데이터 빌더 및 패킷 연동
// =========================================================================
global.FRankDays.MAT_LABELS_KO_V82 = {
  'f_rank_days:tempering_stone': '무기 단련석',
  'f_rank_days:refined_mana_stone': '정제된 마력석',
  'f_rank_days:high_tempering_core': '고순도 단련핵'
};

global.FRankDays.forgeStackSnapshotV91 = function (stack) {
  if (!stack || stack.empty) return '';
  var nbt = stack.nbt, encoded = '';
  if (nbt) {
    encoded = typeof nbt.getAllKeys === 'function' ? String(nbt) : JSON.stringify(nbt);
  }
  return String(stack.id) + '|' + Number(stack.count || 1) + '|' + encoded;
};

global.FRankDays.validateNauGuiRequestV91 = function (player, request, kind) {
  var data = request || {}, key = String(player.uuid || player.username || 'anon');
  var session = global.FRankDays._inheritanceGuiSessions[key];
  var fail = function (reason, message) { return { ok: false, reason: reason, message: message }; };
  if (!session || !String(data.session_token || '') || String(session.session_token) !== String(data.session_token)) {
    return fail('invalid_gui_session', '단조창이 갱신되었습니다. 나우에게 다시 말을 걸어 열어 주세요.');
  }
  if (Date.now() - Number(session.opened_at) > 180000) return fail('expired_gui_session', '단조창을 연 지 오래되었습니다. 다시 열어 주세요.');
  var method = global.FRankDays.normalizeEnhanceMethodV8(data.method || 'NAU');
  if (kind === 'ENHANCE' && method !== String(session.method)) return fail('method_mismatch', '강화 방식이 바뀌었습니다. 단조창을 다시 열어 주세요.');
  if ((kind === 'INHERIT' || method === 'NAU') && !global.FRankDays.isPlayerNearNauSmithyV8(player)) {
    return fail('too_far_from_npc', '나우 가까이에서 단조창을 다시 열어 주세요.');
  }
  var refs = kind === 'ENHANCE' ? [data.slot] : [data.source_slot, data.target_slot];
  var lists = kind === 'ENHANCE' ? [session.enhance_candidates || []] : [session.sources || [], session.targets || []];
  for (var i = 0; i < refs.length; i++) {
    var found = null;
    for (var j = 0; j < lists[i].length; j++) if (String(lists[i][j].slot_ref) === String(refs[i])) { found = lists[i][j]; break; }
    if (!found) return fail('slot_not_offered', '선택한 무기를 현재 단조창에서 찾을 수 없습니다. 다시 열어 주세요.');
    var current = global.FRankDays.getPlayerSlotStack(player, refs[i]);
    if (!session.snapshots || String(session.snapshots[String(refs[i])]) !== global.FRankDays.forgeStackSnapshotV91(current)) {
      return fail('slot_item_changed_abort', '무기나 인벤토리가 바뀌었습니다. 재료는 소모되지 않았으니 단조창을 다시 열어 주세요.');
    }
  }
  return { ok: true, method: method };
};

global.FRankDays.scanInventoryWeaponsForEnhanceGuiV82 = function (player, methodOpt) {
  var method = global.FRankDays.normalizeEnhanceMethodV8(methodOpt || 'NAU');
  var list = [];
  var seen = {};
  var bal = global.FRankDays.getPlayerBalanceSummaryV8(player);

  function checkSlot(slotRef, slotLabel) {
    if (seen[String(slotRef)]) return;
    var st = global.FRankDays.getPlayerSlotStack(player, slotRef);
    if (!st || st.empty || !st.id || String(st.id) === 'minecraft:air') return;
    var spec = global.FRankDays.getWeaponSpecV8(st.id);
    if (!spec) return;
    seen[String(slotRef)] = true;

    var curLv = global.FRankDays.getWeaponEnhanceLevel(st);
    var shortName = String(st.id).split(':')[1];
    if (curLv >= 99) {
      var b99 = global.FRankDays.computeEnhancementBonusStatsV8(99);
      list.push({
        slot_ref: slotRef,
        slot_label: slotLabel,
        item_id: String(st.id),
        short_name: shortName,
        family: spec.family,
        family_label: global.FRankDays.FAMILY_LABELS_KO[spec.family],
        current_level: 99,
        next_level: 99,
        fail_level: 99,
        bonus_damage: b99.bonus_damage,
        can_afford_all: false,
        materials_ok: true,
        rate_pct_label: '최고 단계(+99)',
        materials_summary: '-',
        fee_formatted: '-',
        next_visual_label: '+99 최종 초월 외형'
      });
      return;
    }

    var pv = global.FRankDays.previewWeaponEnhancement(player, slotRef, method);
    if (!pv || !pv.ok) return;

    var matsOk = true;
    var matParts = [];
    for (var m = 0; m < pv.materials.length; m++) {
      var req = pv.materials[m];
      var have = global.FRankDays.countPlayerItem(player, req.id);
      if (have < req.count) matsOk = false;
      var koMat = global.FRankDays.MAT_LABELS_KO_V82[req.id] || req.id.split(':')[1];
      matParts.push(koMat + ' ' + have + '/' + req.count);
    }
    var currencyOk = bal.total_copper >= pv.fee_copper;
    var effPct = Math.floor(pv.success_rate * 100 + 0.5);
    var basePct = Math.floor(pv.base_success_rate * 100 + 0.5);

    list.push({
      slot_ref: slotRef,
      slot_label: slotLabel,
      item_id: String(st.id),
      short_name: shortName,
      family: spec.family,
      family_label: pv.family_label,
      current_level: curLv,
      next_level: pv.success_target_level,
      fail_level: pv.failure_target_level,
      base_rate_pct: basePct,
      effective_rate_pct: effPct,
      rate_pct_label: method === 'NAU' ? (effPct + '% (기본 ' + basePct + '% + 나우 5%p)') : (effPct + '% (기본)'),
      materials_summary: matParts.join(', '),
      materials_ok: matsOk,
      currency_ok: currencyOk,
      can_afford_all: matsOk && currencyOk,
      fee_copper: pv.fee_copper,
      fee_formatted: pv.fee_formatted,
      next_visual_label: pv.next_visual_tier ? pv.next_visual_tier.label : '기본 외형'
    });
  }

  var hasNumericSlots = player && player.inventory && (typeof player.inventory.getItem === 'function' || Array.isArray(player.inventory.slots));
  if (hasNumericSlots) {
    var totalS = Array.isArray(player.inventory.slots) ? player.inventory.slots.length : 36;
    for (var i = 0; i < totalS; i++) {
      checkSlot(i, i < 9 ? '단축칸 ' + (i + 1) : '가방 ' + (i + 1));
    }
  } else checkSlot('mainhand', '주무기손');
  checkSlot('offhand', '보조손');
  return list;
};

global.FRankDays.openNauForgeAndInheritGuiV82 = function (player, initialTabOpt, methodOpt, statusMsgOpt, statusColorOpt) {
  var method = global.FRankDays.normalizeEnhanceMethodV8(methodOpt || 'NAU');
  var tab = initialTabOpt === 'INHERIT' ? 'INHERIT' : 'ENHANCE';
  // Complete legacy history/attribute migration before offering any equipment.
  // A held-change or periodic refresh must not add our own metadata after the
  // exact full-NBT session fingerprints have already been captured.
  if (global.FRankDays.refreshHeirloomInventoryV10) global.FRankDays.refreshHeirloomInventoryV10(player);
  var enhList = global.FRankDays.scanInventoryWeaponsForEnhanceGuiV82(player, method);
  var inhScanned = global.FRankDays.scanInventoryWeaponsForInheritanceGuiV8(player);
  var bal = global.FRankDays.getPlayerBalanceSummaryV8(player);
  var pKey = String((player && (player.uuid || player.username)) || 'anon');
  var sessionToken = 'nau_forge_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
  var snapshots = {}, offered = enhList.concat(inhScanned.sources, inhScanned.targets);
  for (var sidx = 0; sidx < offered.length; sidx++) {
    var slot = offered[sidx].slot_ref;
    snapshots[String(slot)] = global.FRankDays.forgeStackSnapshotV91(global.FRankDays.getPlayerSlotStack(player, slot));
  }

  global.FRankDays._inheritanceGuiSessions[pKey] = {
    session_token: sessionToken,
    opened_at: Date.now(),
    method: method,
    enhance_candidates: enhList,
    snapshots: snapshots,
    sources: inhScanned.sources,
    targets: inhScanned.targets
  };

  if (typeof global.FRankDays.closeNpcRpgDialog === 'function') {
    global.FRankDays.closeNpcRpgDialog(player, true);
  }

  var payload = {
    initial_tab: tab,
    method: method,
    session_token: sessionToken,
    wallet_formatted: bal.formatted_total,
    total_copper: bal.total_copper,
    enhance_candidates: enhList,
    sources: inhScanned.sources,
    targets: inhScanned.targets,
    status_message: statusMsgOpt || '',
    status_color: statusColorOpt || '#FDE68A'
  };

  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:open_nau_forge_gui', payload);
  }

  return { ok: true, initial_tab: tab, method: method, session_token: sessionToken, sources: inhScanned.sources, targets: inhScanned.targets, payload: payload };
};

// 기존 openSafeInheritanceGuiV8 호출 시에도 강화 후보 목록을 함께 담아 2탭 전환이 모두 작동하도록 보강!
if (typeof global.FRankDays.openSafeInheritanceGuiV8 === 'function' && !global.FRankDays._wrappedSafeInhOpenV82) {
  var _origOpenSafeInh = global.FRankDays.openSafeInheritanceGuiV8;
  global.FRankDays._wrappedSafeInhOpenV82 = true;
  global.FRankDays.openSafeInheritanceGuiV8 = function (player, callerMethodOpt) {
    if (global.FRankDays.normalizeEnhanceMethodV8(callerMethodOpt || 'NAU') !== 'NAU') return _origOpenSafeInh.apply(this, arguments);
    return global.FRankDays.openNauForgeAndInheritGuiV82(player, 'INHERIT', 'NAU');
  };
}

// =========================================================================
// 3. Phase 5: 보스 시련 제단(X:168, Y:68, Z:168) 지형 밀착 기단 보강 · 고대 룬 구조물 · 단계별 소환 연출
// =========================================================================
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
  if (st.built && st.v82_upgraded && !forceRebuild) {
    return { ok: true, already_built: true, v82_upgraded: true, coords: c };
  }

  if (typeof server.runCommandSilent === 'function') {
    var r = global.FRankDays.BOSS_ALTAR_CONFIG_V8.arena_platform_radius; // 12 (25x25 결계장)
    var x1 = c.x - r, x2 = c.x + r, z1 = c.z - r, z2 = c.z + r;

    // 1) 남동쪽 호숫가 모래 경사(Y=64)에서도 제단 가장자리가 공중에 뜨지 않도록 Y=63~67 심층암 성채 기초 석축 시공!
    server.runCommandSilent('fill ' + x1 + ' ' + (c.y - 5) + ' ' + z1 + ' ' + x2 + ' ' + (c.y - 2) + ' ' + z2 + ' minecraft:deepslate_bricks');
    server.runCommandSilent('fill ' + x1 + ' ' + (c.y - 1) + ' ' + z1 + ' ' + x2 + ' ' + (c.y - 1) + ' ' + z2 + ' minecraft:deepslate_tiles');
    // 외곽 결계 테두리
    server.runCommandSilent('fill ' + x1 + ' ' + (c.y - 1) + ' ' + z1 + ' ' + x2 + ' ' + (c.y - 1) + ' ' + z1 + ' minecraft:chiseled_deepslate');
    server.runCommandSilent('fill ' + x1 + ' ' + (c.y - 1) + ' ' + z2 + ' ' + x2 + ' ' + (c.y - 1) + ' ' + z2 + ' minecraft:chiseled_deepslate');
    server.runCommandSilent('fill ' + x1 + ' ' + (c.y - 1) + ' ' + z1 + ' ' + x1 + ' ' + (c.y - 1) + ' ' + z2 + ' minecraft:chiseled_deepslate');
    server.runCommandSilent('fill ' + x2 + ' ' + (c.y - 1) + ' ' + z1 + ' ' + x2 + ' ' + (c.y - 1) + ' ' + z2 + ' minecraft:chiseled_deepslate');

    // 상부 전투 공간 정리 (북서쪽 Y=70 경사면 잔디 간섭 제거)
    server.runCommandSilent('fill ' + x1 + ' ' + c.y + ' ' + z1 + ' ' + x2 + ' ' + (c.y + 7) + ' ' + z2 + ' minecraft:air');

    // 2) 중앙 고대 룬 원형 문양 바닥 (반경 5 길디드 흑암 & 심층암 룬 링 + 4방향 마력 도관)
    server.runCommandSilent('fill ' + (c.x - 4) + ' ' + (c.y - 1) + ' ' + (c.z - 4) + ' ' + (c.x + 4) + ' ' + (c.y - 1) + ' ' + (c.z + 4) + ' minecraft:polished_blackstone_bricks');
    var runeNodes = [[-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [-3, 3], [3, -3], [3, 3]];
    for (var rn = 0; rn < runeNodes.length; rn++) {
      server.runCommandSilent('setblock ' + (c.x + runeNodes[rn][0]) + ' ' + (c.y - 1) + ' ' + (c.z + runeNodes[rn][1]) + ' minecraft:gilded_blackstone');
    }
    // 중앙 3x3 단상 계단식 기초 및 빛나는 룬 코어 배치
    server.runCommandSilent('fill ' + (c.x - 1) + ' ' + (c.y - 1) + ' ' + (c.z - 1) + ' ' + (c.x + 1) + ' ' + (c.y - 1) + ' ' + (c.z + 1) + ' minecraft:chiseled_polished_blackstone');

    // 3) 4방위 고대 봉인 룬 기둥(외곽 4기 + 내측 4기 화로 기둥)
    var outerPillars = [[-r, -r], [-r, r], [r, -r], [r, r]];
    for (var i = 0; i < outerPillars.length; i++) {
      var px = c.x + outerPillars[i][0];
      var pz = c.z + outerPillars[i][1];
      server.runCommandSilent('setblock ' + px + ' ' + c.y + ' ' + pz + ' minecraft:chiseled_deepslate');
      server.runCommandSilent('fill ' + px + ' ' + (c.y + 1) + ' ' + pz + ' ' + px + ' ' + (c.y + 3) + ' ' + pz + ' minecraft:polished_basalt');
      server.runCommandSilent('setblock ' + px + ' ' + (c.y + 4) + ' ' + pz + ' minecraft:crying_obsidian');
      server.runCommandSilent('setblock ' + px + ' ' + (c.y + 5) + ' ' + pz + ' minecraft:soul_lantern');
    }
    var innerBraziers = [[-6, -6], [-6, 6], [6, -6], [6, 6]];
    for (var ib = 0; ib < innerBraziers.length; ib++) {
      var bx = c.x + innerBraziers[ib][0];
      var bz = c.z + innerBraziers[ib][1];
      server.runCommandSilent('setblock ' + bx + ' ' + c.y + ' ' + bz + ' minecraft:chiseled_polished_blackstone');
      server.runCommandSilent('setblock ' + bx + ' ' + (c.y + 1) + ' ' + bz + ' minecraft:lantern');
    }

    // 4) 중앙 시련 제단 전용 코어 블록 배치
    server.runCommandSilent('setblock ' + c.x + ' ' + c.y + ' ' + c.z + ' ' + global.FRankDays.BOSS_ALTAR_CONFIG_V8.altar_block_id);
  }

  st.built = true;
  st.v82_upgraded = true;
  st.coords = c;
  global.FRankDays.saveBossAltarStateV8(server, st);
  return { ok: true, built_now: true, v82_upgraded: true, coords: c };
};

// 보스 제단 접근 상태 점검 함수 (근접 시 소환 가능 / 쿨타임 / 보스 생존 중 안내)
global.FRankDays.getBossAltarReadinessStatusV82 = function (player) {
  var srv = player ? player.server : null;
  var state = global.FRankDays.loadPlayerState(player);
  var bState = global.FRankDays.ensurePlayerBossStateV8(state);
  var q = bState.quests.ferrous_wroughtnaut;
  var altarC = global.FRankDays.getBossAltarCoordsV8(srv);
  var activeCheck = global.FRankDays.isBossCurrentlyActiveAtAltarV8(srv);

  if (activeCheck.active) {
    return { status: 'BOSS_ACTIVE', can_summon: false, label: '[시련 제단: 교전 진행 중] 강철 수호자가 현현해 있습니다 (추가 소환 잠금)', coords: altarC };
  }
  if (!q.free_rematch_unlocked) {
    return { status: 'SEALED_NEED_FIRST_CLEAR', can_summon: false, label: '[시련 제단: 고대 봉인] 자연 생성 철기실에서 최초 1회 토벌 후 재소환이 해금됩니다', coords: altarC };
  }
  var now = global.FRankDays.nowMsV8 ? global.FRankDays.nowMsV8() : Date.now();
  var cdMs = global.FRankDays.BOSS_ALTAR_CONFIG_V8.player_rematch_cooldown_ms;
  if (now - Number(q.last_altar_summon_ms || -999999) < cdMs) {
    var remS = Math.ceil((cdMs - (now - Number(q.last_altar_summon_ms))) / 1000);
    return { status: 'ON_COOLDOWN', can_summon: false, remaining_seconds: remS, label: '[시련 제단: 마력 냉각 중] ' + remS + '초 후 재소환 가능', coords: altarC };
  }
  var hasSigil = global.FRankDays.countPlayerItem(player, 'f_rank_days:wrought_challenge_sigil') > 0;
  return {
    status: hasSigil ? 'READY_WITH_SIGIL' : 'READY_NEED_SIGIL',
    can_summon: hasSigil,
    label: hasSigil
      ? '[시련 제단: 소환 준비 완료] 공명패를 제단 코어에 우클릭하여 강철 수호자를 소환하세요!'
      : '[시련 제단: 대기 중] 고대 철기 재도전 공명패를 들고 제단 코어를 우클릭하면 소환됩니다.',
    coords: altarC
  };
};

if (typeof global.FRankDays.summonWroughtBossAtAltarV8 === 'function' && !global.FRankDays._wrappedAltarSummonVfxV82) {
  var _origSummonAltarV8 = global.FRankDays.summonWroughtBossAtAltarV8;
  global.FRankDays._wrappedAltarSummonVfxV82 = true;
  global.FRankDays.summonWroughtBossAtAltarV8 = function (player, interactContextOpt) {
    var res = _origSummonAltarV8.apply(this, arguments);
    var ac = global.FRankDays.getBossAltarCoordsV8(player ? player.server : null);
    if (res && res.ok) {
      global.FRankDays.emitServerVerifiedVfxV82(player, 'BOSS_ALTAR_SUMMON', {
        x: ac.x + 0.5,
        y: ac.y + 1.2,
        z: ac.z + 0.5
      });
    } else if (res && (res.reason === 'boss_already_active_at_altar' || res.reason === 'altar_rematch_on_cooldown' || res.reason === 'rematch_locked_until_first_clear')) {
      global.FRankDays.emitServerVerifiedVfxV82(player, 'BOSS_ALTAR_BLOCKED', {
        x: ac.x + 0.5,
        y: ac.y + 1.0,
        z: ac.z + 0.5,
        banner_text: res.message || '[시련 제단] 현재 소환할 수 없습니다.'
      });
    }
    return res;
  };
}

// =========================================================================
// 4. 나우 대화창 통합 단조창 연결 · 제단 근접 안내 · GUI 강화 패킷 · /frank 확장 명령어
// =========================================================================
if (typeof global.FRankDays.handleNpcDialogAction === 'function' && !global.FRankDays._wrappedDialogV82) {
  var _prevDialogHandlerV81 = global.FRankDays.handleNpcDialogAction;
  global.FRankDays._wrappedDialogV82 = true;

  global.FRankDays.handleNpcDialogAction = function (player, reqData, options) {
    var data = reqData || {};
    var state = global.FRankDays.loadPlayerState(player);
    var npcId = String(data.npc_id || (state.npc_dialog && state.npc_dialog.active_npc_id) || '');
    var action = String(data.action || '');

    if (npcId === 'nau' && action === 'V82_NAU_OPEN_ENH_GUI') {
      var dialogGate = global.FRankDays.validateNauDialogActionV91(player, data, options);
      if (!dialogGate.ok) return dialogGate;
      var gRes = global.FRankDays.openNauForgeAndInheritGuiV82(player, 'ENHANCE', 'NAU');
      return { ok: gRes.ok, npc_id: 'nau', action: action, opened_nau_forge_gui: true, gui_result: gRes };
    }
    return _prevDialogHandlerV81.apply(this, arguments);
  };
}

global.FRankDays.executeEnhanceGuiV91 = function (player, request) {
  var data = request || {};
  var gate = global.FRankDays.validateNauGuiRequestV91(player, data, 'ENHANCE');
  if (!gate.ok) {
    if (player.sendData) player.sendData('f_rank_days:forge_gui_error', gate);
    return gate;
  }
  var method = global.FRankDays.normalizeEnhanceMethodV8(data.method || 'NAU');
  delete global.FRankDays._inheritanceGuiSessions[String(player.uuid || player.username || 'anon')];
  var result = global.FRankDays.executeWeaponEnhancement(player, {
    method: method, slot: data.slot !== undefined ? data.slot : 'mainhand', expected_item_id: data.expected_item_id
  });
  var color = result.ok ? (result.success ? '#86EFAC' : '#FCA5A5') : '#FCA5A5';
  global.FRankDays.openNauForgeAndInheritGuiV82(player, 'ENHANCE', method, result.message || ('오류: ' + result.reason), color);
  return result;
};

if (typeof NetworkEvents !== 'undefined' && NetworkEvents.dataReceived) {
  NetworkEvents.dataReceived('f_rank_days:close_nau_forge_gui', function (event) {
    if (!event || !event.player) return;
    var key = String(event.player.uuid || event.player.username || 'anon');
    var session = global.FRankDays._inheritanceGuiSessions[key];
    if (session && String(session.session_token) === String((event.data || {}).session_token || '')) delete global.FRankDays._inheritanceGuiSessions[key];
  });
  NetworkEvents.dataReceived('f_rank_days:execute_enhance_gui', function (event) {
    if (!event || !event.player) return;
    global.FRankDays.executeEnhanceGuiV91(event.player, event.data || {});
  });
}

if (typeof ServerEvents !== 'undefined' && ServerEvents.tick) {
  ServerEvents.tick(function (event) {
    var srv = event.server;
    if (!srv || !Array.isArray(srv.players) || srv.players.length === 0) return;
    global.FRankDays._v82AltarProxTick = Number(global.FRankDays._v82AltarProxTick || 0) + 1;
    if (global.FRankDays._v82AltarProxTick % 60 !== 0) return;

    var ac = global.FRankDays.getBossAltarCoordsV8(srv);
    var now = Date.now();
    for (var i = 0; i < srv.players.length; i++) {
      var pl = srv.players[i];
      var dx = Number(pl.x || 0) - ac.x;
      var dz = Number(pl.z || 0) - ac.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var pk = String(pl.uuid || pl.username || i);
      if (dist <= 15) {
        var lastAt = Number(global.FRankDays._altarHintCooldownByUuid[pk] || 0);
        if (now - lastAt >= 25000) {
          global.FRankDays._altarHintCooldownByUuid[pk] = now;
          var stInfo = global.FRankDays.getBossAltarReadinessStatusV82(pl);
          if (srv.runCommandSilent && pl.username) {
            srv.runCommandSilent('title ' + pl.username + ' actionbar ' + JSON.stringify({ text: stInfo.label, color: stInfo.can_summon ? 'gold' : 'gray' }));
          }
        }
      }
    }
  });
}

if (typeof ServerEvents !== 'undefined' && ServerEvents.commandRegistry) {
  ServerEvents.commandRegistry(function (event) {
    var Commands = event.commands;
    if (!Commands || !Commands.literal) return;
    event.register(
      Commands.literal('frank')
        .requires(function (src) { return src.hasPermission(0); })
        .then(
          Commands.literal('weapon')
            .then(Commands.literal('gui').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var nearNau = global.FRankDays.isPlayerNearNauSmithyV8(pl);
              return global.FRankDays.openNauForgeAndInheritGuiV82(pl, 'ENHANCE', nearNau ? 'NAU' : 'ANVIL').ok ? 1 : 0;
            }))
        )
        .then(
          Commands.literal('fx')
            .then(Commands.literal('full').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.setPlayerFxIntensityV82(pl, 'full').ok ? 1 : 0;
            }))
            .then(Commands.literal('reduced').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.setPlayerFxIntensityV82(pl, 'reduced').ok ? 1 : 0;
            }))
            .then(Commands.literal('off').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.setPlayerFxIntensityV82(pl, 'off').ok ? 1 : 0;
            }))
        )
    );
  });
}
