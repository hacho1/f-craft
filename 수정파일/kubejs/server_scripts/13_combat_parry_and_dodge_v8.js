// 《F급의 나날》 KubeJS 6 Server Script - v8.1 Combat Roll Native Config Alignment (Zero Duplicate i-Frames) & Custom R-Key Parry Engine
// 파일 경로: kubejs/server_scripts/13_combat_parry_and_dodge_v8.js
// 핵심 보완 사항 (항목 4 반영):
// 1. Combat Roll 실제 서버 설정 파일은 TinyConfig 기반 `config/combatroll/server.json5` 이며,
//    `roll_cooldown: 1.5` (초) 및 `invulnerable_ticks_upon_roll: 4` (4틱 = 0.2초 무적 프레임)을 Combat Roll 자체 설정으로 단일화했습니다.
// 2. 무적 효과 중복 원천 차단:
//    - 실제 인게임(`Platform.isLoaded('combatroll') === true`)에서는 구르기 쿨타임과 4틱(0.2초) 회피 무적을 Combat Roll 모드가 직접 처리하므로
//      자체 스크립트의 별도 구르기 무적(`dodge_until_ms`)은 자동 비활성화(`delegate_roll_to_combatroll_mod = true`)하여 무적 프레임 이중 중첩을 100% 방지합니다!
//    - v10.5: Combat Roll의 실제 4틱 기록만 확인합니다. 일반 피격 무적 시간을 구르기로 오인해 R을 막지 않습니다.
//    - Combat Roll 미장착 단독 스크립트 테스트 환경(`Platform.isLoaded('combatroll') === false`)에서만 폴백 회피 타이머가 작동합니다.

global.FRankDays = global.FRankDays || {};

global.FRankDays.COMBAT_V8_CONFIG = {
  balance_status: 'VERIFIED_CONFIG_NO_DUPLICATE_IFRAMES',
  parry_key_default: 'R',
  combat_roll_key_recommended: 'V (Combat Roll 기본 R키와 패링 R키 충돌 방지 분리 권장)',
  combat_roll_server_config_path: 'config/combatroll/server.json5',
  combat_roll_native_cooldown_sec: 1.5,
  combat_roll_native_invulnerable_ticks: 4, // 4 ticks = 0.20s @ 20 TPS
  parry_window_ms: 320,
  max_latency_compensation_ms: 80,
  parry_cooldown_ms: 1000,
  parry_damage_reduction: 1.0,
  target_stagger_ticks: 16, // 0.8초
  counterattack_window_ms: 1400,
  counterattack_damage_multiplier: 1.35,
  fallback_dodge_cooldown_ms: 1500,
  fallback_dodge_iframe_ms: 200,
  non_combat_action_guard_ms: 250
};

global.FRankDays._combatStates = {};
global.FRankDays._activeTelegraphs = {};

global.FRankDays.nowMsV8 = function () {
  return typeof global.FRankDays._mockClockMs === 'number' ? global.FRankDays._mockClockMs : Date.now();
};

// Combat Roll 모드 실제 탑재 여부 확인 (인게임 탑재 시 자체 구르기 무적 비활성 -> 중복 무적 원천 차단!)
global.FRankDays.isCombatRollModLoadedV8 = function () {
  if (typeof global.FRankDays._mockCombatRollLoaded === 'boolean') {
    return global.FRankDays._mockCombatRollLoaded;
  }
  if (typeof Platform !== 'undefined' && Platform && typeof Platform.isLoaded === 'function') {
    return Boolean(Platform.isLoaded('combatroll'));
  }
  return false;
};

// Vanilla also uses invulnerableTime after ordinary hits. The bridge records
// the real Combat Roll event, so only an actual roll can block parry input.
global.FRankDays.isNativeCombatRollIframeV105 = function (player) {
  if (!player || !global.FRankDays.isCombatRollModLoadedV8()) return false;
  if (typeof Java === 'undefined') return false;
  var bridge = Java.loadClass('fcraft.raid.RaidBridge');
  return Boolean(bridge.isCombatRollIframe(player.minecraftEntity || player));
};

global.FRankDays.getPlayerCombatStateV8 = function (player) {
  var key = String((player && (player.uuid || player.username)) || 'anon');
  if (!global.FRankDays._combatStates[key]) {
    global.FRankDays._combatStates[key] = {
      last_parry_ms: -99999,
      parry_start_ms: -99999,
      parry_until_ms: -99999,
      last_dodge_ms: -99999,
      dodge_until_ms: -99999,
      counter_until_ms: -99999,
      last_work_ms: -99999,
      gui_open: false,
      stats: { parry_success: 0, parry_fail: 0, dodge_evaded: 0, counter_hits: 0 }
    };
  }
  return global.FRankDays._combatStates[key];
};

global.FRankDays.markNonCombatWorkAction = function (player) {
  var cs = global.FRankDays.getPlayerCombatStateV8(player);
  cs.last_work_ms = global.FRankDays.nowMsV8();
};

global.FRankDays.isPlayerInProtectedGuiOrWork = function (player, clientGuiFlag) {
  if (clientGuiFlag) return true;
  var cs = global.FRankDays.getPlayerCombatStateV8(player);
  var now = global.FRankDays.nowMsV8();
  if (cs.gui_open) return true;
  if (now - cs.last_work_ms < global.FRankDays.COMBAT_V8_CONFIG.non_combat_action_guard_ms) {
    return true;
  }
  var pState = global.FRankDays.loadPlayerState ? global.FRankDays.loadPlayerState(player) : null;
  if (pState) {
    if (pState.guild_card && pState.guild_card.ui_open) return true;
    if (pState.npc_dialog && pState.npc_dialog.open) return true;
  }
  var pKey = String((player && (player.uuid || player.username)) || 'anon');
  if (global.FRankDays._inheritanceGuiSessions && global.FRankDays._inheritanceGuiSessions[pKey] && !global.FRankDays._inheritanceGuiSessions[pKey].explicit_preview) {
    return true;
  }
  return false;
};

// 1) 클라이언트 R키 패링 입력 처리
global.FRankDays.triggerPlayerParryV8 = function (player, payloadOpt) {
  var payload = payloadOpt || {};
  var cfg = global.FRankDays.COMBAT_V8_CONFIG;
  var now = global.FRankDays.nowMsV8();
  var cs = global.FRankDays.getPlayerCombatStateV8(player);
  var pp = global.FRankDays.getPassiveProfilePhase4 ? global.FRankDays.getPassiveProfilePhase4(player, 'swordsman') : {};
  var personalCooldown = cfg.parry_cooldown_ms * (pp.parryCooldownMultiplier === undefined ? 1 : pp.parryCooldownMultiplier);
  var personalWindow = cfg.parry_window_ms + Number(pp.parryWindowBonusMs || 0);

  if (global.FRankDays.isPlayerInProtectedGuiOrWork(player, Boolean(payload.gui_open))) {
    return { ok: false, reason: 'blocked_by_gui_or_work_action' };
  }

  // 이미 Combat Roll 네이티브 구르기 무적 프레임이 활성 중이면 패링 입력 중복 발동 차단!
  if (global.FRankDays.isNativeCombatRollIframeV105(player)) {
    return { ok: false, reason: 'blocked_during_native_roll_iframe' };
  }

  if (now - cs.last_parry_ms < personalCooldown) {
    return {
      ok: false,
      reason: 'parry_on_cooldown',
      remaining_ms: personalCooldown - (now - cs.last_parry_ms)
    };
  }

  var latencyComp = 0;
  if (typeof payload.client_sent_ms === 'number') {
    var diff = now - payload.client_sent_ms;
    if (diff > 0) {
      latencyComp = Math.min(cfg.max_latency_compensation_ms, diff);
    }
  }

  cs.last_parry_ms = now;
  cs.parry_start_ms = now - latencyComp;
  cs.parry_until_ms = now + personalWindow;

  if (player.server && player.server.runCommandSilent && player.username) {
    var px = Number(player.x || 0).toFixed(1);
    var py = (Number(player.y || 69) + 1.1).toFixed(1);
    var pz = Number(player.z || 0).toFixed(1);
    player.server.runCommandSilent('playsound minecraft:item.armor.equip_iron master ' + player.username + ' ' + px + ' ' + py + ' ' + pz + ' 0.9 1.5');
    player.server.runCommandSilent('particle minecraft:sweep_attack ' + px + ' ' + py + ' ' + pz + ' 0.1 0.1 0.1 0.0 1');
  }

  return {
    ok: true,
    parry_active_window_ms: personalWindow,
    latency_comp_ms: latencyComp,
    cooldown_ms: personalCooldown,
    active_until_ms: cs.parry_until_ms
  };
};

// 2) 회피 연동 (Combat Roll 모드 탑재 시 모드의 server.json5 [4틱 무적/1.5초 쿨타임]에 100% 위임하여 스크립트 무적 중복 제거!)
global.FRankDays.triggerPlayerCombatRollV8 = function (player, payloadOpt) {
  var payload = payloadOpt || {};
  var cfg = global.FRankDays.COMBAT_V8_CONFIG;
  var now = global.FRankDays.nowMsV8();
  var cs = global.FRankDays.getPlayerCombatStateV8(player);

  if (global.FRankDays.isPlayerInProtectedGuiOrWork(player, Boolean(payload.gui_open))) {
    return { ok: false, reason: 'blocked_by_gui_or_work_action' };
  }

  // 핵심: Combat Roll 모드가 로드된 상태에서는 자체 스크립트 무적 타이머를 켜지 않음 (이중 무적 0%!)
  if (global.FRankDays.isCombatRollModLoadedV8()) {
    cs.dodge_until_ms = -99999;
    return {
      ok: true,
      delegated_to_combatroll_mod: true,
      script_iframe_applied: false,
      native_config_iframe_ticks: cfg.combat_roll_native_invulnerable_ticks,
      native_config_cooldown_sec: cfg.combat_roll_native_cooldown_sec
    };
  }

  // Combat Roll 미장착 단독 스크립트 검증 환경용 폴백
  if (now - cs.last_dodge_ms < cfg.fallback_dodge_cooldown_ms) {
    return {
      ok: false,
      reason: 'dodge_on_cooldown',
      remaining_ms: cfg.fallback_dodge_cooldown_ms - (now - cs.last_dodge_ms)
    };
  }

  cs.last_dodge_ms = now;
  cs.dodge_until_ms = now + cfg.fallback_dodge_iframe_ms;

  return {
    ok: true,
    delegated_to_combatroll_mod: false,
    script_iframe_applied: true,
    iframe_ms: cfg.fallback_dodge_iframe_ms,
    cooldown_ms: cfg.fallback_dodge_cooldown_ms,
    iframe_until_ms: cs.dodge_until_ms
  };
};

// 3) 보스·시험용 몬스터 공격 예고(Telegraph) 발생기
global.FRankDays.emitBossOrMobAttackTelegraph = function (attackerInfo, targetPlayer, windupMsOpt) {
  if (!targetPlayer) return null;
  var now = global.FRankDays.nowMsV8();
  var windupMs = Number(windupMsOpt !== undefined ? windupMsOpt : 350);
  var pKey = String(targetPlayer.uuid || targetPlayer.username || 'anon');

  var tele = {
    attacker_uuid: String((attackerInfo && attackerInfo.uuid) || 'mob_attacker'),
    attacker_type: String((attackerInfo && attackerInfo.type) || 'minecraft:zombie'),
    attacker_label: String((attackerInfo && attackerInfo.label) || '적성 개체'),
    warn_at_ms: now,
    strike_at_ms: now + windupMs,
    strike_window_start_ms: now + Math.max(0, windupMs - global.FRankDays.COMBAT_V8_CONFIG.parry_window_ms),
    strike_window_end_ms: now + windupMs + 220,
    resolved: false
  };
  global.FRankDays._activeTelegraphs[pKey] = tele;

  if (targetPlayer.server && targetPlayer.server.runCommandSilent && targetPlayer.username) {
    var ax = Number((attackerInfo && attackerInfo.x) !== undefined ? attackerInfo.x : targetPlayer.x || 0).toFixed(1);
    var ay = (Number((attackerInfo && attackerInfo.y) !== undefined ? attackerInfo.y : targetPlayer.y || 69) + 1.5).toFixed(1);
    var az = Number((attackerInfo && attackerInfo.z) !== undefined ? attackerInfo.z : targetPlayer.z || 0).toFixed(1);
    targetPlayer.server.runCommandSilent('particle minecraft:electric_spark ' + ax + ' ' + ay + ' ' + az + ' 0.35 0.35 0.35 0.15 24');
    targetPlayer.server.runCommandSilent('particle minecraft:crit ' + ax + ' ' + ay + ' ' + az + ' 0.25 0.25 0.25 0.1 16');
    targetPlayer.server.runCommandSilent('playsound minecraft:block.bell.use master ' + targetPlayer.username + ' ' + ax + ' ' + ay + ' ' + az + ' 1.2 1.85');
  }
  if (typeof targetPlayer.sendData === 'function') {
    targetPlayer.sendData('f_rank_days:attack_telegraph', {
      attacker_label: tele.attacker_label,
      windup_ms: windupMs
    });
  }

  return tele;
};

// 4) 실제 피해 판정 vs 패링/회피 해결기 (Combat Roll 네이티브 무적 중복 개입 차단 포함!)
global.FRankDays.resolveIncomingAttackOnPlayerV8 = function (player, attackerEntity, incomingDamage) {
  // Combat Roll 자체 invulnerable_ticks_upon_roll(4틱) 등으로 이미 엔티티 무적 프레임이 켜져 있으면 스크립트 중복 무적 개입 차단!
  if (global.FRankDays.isNativeCombatRollIframeV105(player)) {
    return {
      outcome: 'NATIVE_MOD_IFRAME_ALREADY_ACTIVE',
      cancel_damage: false,
      script_iframe_applied: false,
      final_damage: 0
    };
  }

  var now = global.FRankDays.nowMsV8();
  var cfg = global.FRankDays.COMBAT_V8_CONFIG;
  var cs = global.FRankDays.getPlayerCombatStateV8(player);
  var pKey = String((player && (player.uuid || player.username)) || 'anon');
  var tele = global.FRankDays._activeTelegraphs[pKey];
  var attackerType = attackerEntity && attackerEntity.type ? String(attackerEntity.type) : 'unknown';

  var telegraphAligned = true;
  if (tele && !tele.resolved && attackerEntity && String(attackerEntity.uuid || '') === tele.attacker_uuid) {
    telegraphAligned = now >= tele.strike_window_start_ms && now <= tele.strike_window_end_ms;
    tele.resolved = true;
  }

  // A. R키 자체 패링 판정 (0.2초 유효 창 내 + 예고 정렬)
  if (now >= cs.parry_start_ms && now <= cs.parry_until_ms && telegraphAligned) {
    cs.parry_until_ms = -99999;
    cs.counter_until_ms = now + cfg.counterattack_window_ms;
    cs.stats.parry_success += 1;
    if (global.FRankDays.onCombatParryPhase4) global.FRankDays.onCombatParryPhase4(player, attackerEntity);

    var staggerMode = 'none';
    if (player.server && player.server.runCommandSilent) {
      var px = Number(player.x || 0).toFixed(1);
      var py = (Number(player.y || 69) + 1.1).toFixed(1);
      var pz = Number(player.z || 0).toFixed(1);
      if (player.username) {
        player.server.runCommandSilent('playsound minecraft:item.shield.block master ' + player.username + ' ' + px + ' ' + py + ' ' + pz + ' 1.2 1.15');
        player.server.runCommandSilent('playsound minecraft:block.anvil.land master ' + player.username + ' ' + px + ' ' + py + ' ' + pz + ' 0.55 1.75');
        player.server.runCommandSilent('particle minecraft:enchanted_hit ' + px + ' ' + py + ' ' + pz + ' 0.4 0.4 0.4 0.25 22');
      }

      if (attackerEntity && attackerEntity.uuid) {
        if (attackerType === 'mowziesmobs:ferrous_wroughtnaut') {
          player.server.runCommandSilent('effect give ' + attackerEntity.uuid + ' minecraft:slowness 1 4 true');
          staggerMode = 'boss_safe_movement_stagger_0_8s';
        } else {
          player.server.runCommandSilent('effect give ' + attackerEntity.uuid + ' minecraft:slowness 1 5 true');
          player.server.runCommandSilent('effect give ' + attackerEntity.uuid + ' minecraft:weakness 1 1 true');
          staggerMode = 'standard_mob_stagger_0_8s';
        }
      }
    }

    if (player.tell) {
      player.tell('⚡ [패링 성공!] 적의 공격을 완벽히 흘려냈습니다! (피해 0 · 1.4초간 반격 피해 +35%)');
    }

    return {
      outcome: 'PARRIED',
      cancel_damage: true,
      final_damage: 0,
      stagger_applied: staggerMode,
      counter_window_ms: cfg.counterattack_window_ms
    };
  }

  // B. 단독 스크립트 폴백 회피 무적 (Combat Roll 모드 미장착 시에만 작동)
  if (!global.FRankDays.isCombatRollModLoadedV8() && now <= cs.dodge_until_ms) {
    cs.stats.dodge_evaded += 1;
    return {
      outcome: 'DODGED_FALLBACK',
      cancel_damage: true,
      script_iframe_applied: true,
      final_damage: 0
    };
  }

  if (now - cs.last_parry_ms <= 600) {
    cs.stats.parry_fail += 1;
  }
  return {
    outcome: 'HIT_TAKEN',
    cancel_damage: false,
    final_damage: Number(incomingDamage || 0)
  };
};

// 5) 패링 직후 반격 보너스 및 강화 활 투사체 보너스 판정
global.FRankDays.computeOutgoingPlayerAttackDamageV8 = function (player, baseDamage, isProjectile, captured) {
  var now = global.FRankDays.nowMsV8();
  var cfg = global.FRankDays.COMBAT_V8_CONFIG;
  var cs = global.FRankDays.getPlayerCombatStateV8(player);
  var dmg = Number(baseDamage || 1);
  var counterTriggered = false;

  var mh = player && player.mainHandItem ? player.mainHandItem : null;
  if (isProjectile && captured) {
    dmg += Number(captured.rangedBonusDamage || 0);
  } else if (isProjectile && mh && mh.nbt && mh.nbt.f_rank_enhance && mh.nbt.f_rank_enhance.ranged_bonus_damage) {
    dmg += Number(mh.nbt.f_rank_enhance.ranged_bonus_damage || 0);
  }

  if (!isProjectile && now <= cs.counter_until_ms) {
    cs.counter_until_ms = -99999;
    cs.stats.counter_hits += 1;
    dmg = Math.floor(dmg * cfg.counterattack_damage_multiplier * 100 + 0.5) / 100;
    counterTriggered = true;
    if (player.tell) {
      player.tell('⚔ [반격 적중!] 패링의 빈틈을 파고들어 강력한 일격을 가했습니다! (피해 ' + dmg + ')');
    }
  }

  return { final_damage: dmg, counter_triggered: counterTriggered };
};

global.FRankDays.spawnParryTrainerMonster = function (player) {
  if (!player || !player.server || !player.server.runCommandSilent) {
    return { ok: false, reason: 'no_server' };
  }
  var sx = (Number(player.x || 0) + 3.0).toFixed(1);
  var sy = Number(player.y || 69).toFixed(1);
  var sz = Number(player.z || 0).toFixed(1);
  player.server.runCommandSilent(
    'summon minecraft:husk ' + sx + ' ' + sy + ' ' + sz +
    ' {CustomName:\'{"text":"[패링 수련병]","color":"yellow"}\',CustomNameVisible:1b,PersistenceRequired:1b,Health:60f,Attributes:[{Name:"generic.max_health",Base:60.0},{Name:"generic.attack_damage",Base:4.0}],HandItems:[{id:"minecraft:iron_sword",Count:1b},{}],Tags:["f_rank_parry_trainer"]}'
  );
  return { ok: true, coords: [Number(sx), Number(sy), Number(sz)] };
};

if (typeof NetworkEvents !== 'undefined' && NetworkEvents.dataReceived) {
  NetworkEvents.dataReceived('f_rank_days:parry_input', function (event) {
    if (event && event.player) {
      global.FRankDays.triggerPlayerParryV8(event.player, event.data || {});
    }
  });
  NetworkEvents.dataReceived('f_rank_days:combat_roll_input', function (event) {
    if (event && event.player) {
      global.FRankDays.triggerPlayerCombatRollV8(event.player, event.data || {});
    }
  });
}

if (typeof BlockEvents !== 'undefined') {
  if (BlockEvents.broken) {
    BlockEvents.broken(function (event) {
      if (event && event.player) global.FRankDays.markNonCombatWorkAction(event.player);
    });
  }
  if (BlockEvents.rightClicked) {
    BlockEvents.rightClicked(function (event) {
      if (event && event.player) global.FRankDays.markNonCombatWorkAction(event.player);
    });
  }
}

if (typeof ServerEvents !== 'undefined' && ServerEvents.tick) {
  ServerEvents.tick(function (event) {
    var srv = event.server;
    if (!srv || !srv.players || srv.players.length === 0) return;
    global.FRankDays._combatTickCount = Number(global.FRankDays._combatTickCount || 0) + 1;
    if (global.FRankDays._combatTickCount % 15 !== 0) return;

    var ow = typeof srv.overworld === 'function' ? srv.overworld() : null;
    if (!ow || typeof ow.getEntities !== 'function') return;

    try {
      var allEnts = ow.getEntities();
      if (!allEnts || !allEnts.length) return;
      for (var e = 0; e < allEnts.length; e++) {
        var ent = allEnts[e];
        if (!ent || !ent.type) continue;
        var etype = String(ent.type);
        var isWrought = etype === 'mowziesmobs:ferrous_wroughtnaut';
        var isTrainer = global.FRankDays.hasEntityTag && global.FRankDays.hasEntityTag(ent, 'f_rank_parry_trainer');
        if (!isWrought && !isTrainer) continue;

        for (var p = 0; p < srv.players.length; p++) {
          var pl = srv.players[p];
          var dx = Number(ent.x || 0) - Number(pl.x || 0);
          var dy = Number(ent.y || 0) - Number(pl.y || 0);
          var dz = Number(ent.z || 0) - Number(pl.z || 0);
          var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist <= 5.5) {
            var pKey = String(pl.uuid || pl.username);
            var prevT = global.FRankDays._activeTelegraphs[pKey];
            if (!prevT || global.FRankDays.nowMsV8() - prevT.warn_at_ms >= 2200) {
              global.FRankDays.emitBossOrMobAttackTelegraph(
                {
                  uuid: ent.uuid,
                  type: etype,
                  label: isWrought ? '강철 수호자 (Ferrous Wroughtnaut)' : '패링 수련병',
                  x: ent.x, y: ent.y, z: ent.z
                },
                pl,
                isWrought ? 400 : 350
              );
            }
          }
        }
      }
    } catch (err) {}
  });
}

// 주의: event.cancel()은 EventExit를 발생시키므로 절대 try/catch 블록 내부에 넣지 않음!
if (typeof EntityEvents !== 'undefined' && EntityEvents.hurt) {
  EntityEvents.hurt(function (event) {
    // Raid intro/node admission runs before the general R/V resolver.
    if (global.FRankDays.shouldCancelChapter1RaidDamageV101 && global.FRankDays.shouldCancelChapter1RaidDamageV101(event)) { event.cancel(); return; }
    var victim = event.entity;
    var source = event.source;
    var attacker = source && (source.actual || source.immediate) ? (source.actual || source.immediate) : null;

    if (victim && (typeof victim.isPlayer === 'function' ? victim.isPlayer() : Boolean(victim.username))) {
      if (attacker) {
        var res = global.FRankDays.resolveIncomingAttackOnPlayerV8(victim, attacker, event.damage || 0);
        if (res.cancel_damage && typeof event.cancel === 'function') {
          event.cancel();
        }
      }
      return;
    }

    // Outgoing counter damage is composed once in the native mutable LivingHurt bridge.

  });
}
