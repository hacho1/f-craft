// 《F급의 나날》 KubeJS 6 Server Script - v8.1 Unified /frank Command Tree & NPC RPG Dialog Bridge (Identical Function Dispatch)
// 파일 경로: kubejs/server_scripts/16_v8_commands_and_dialog_bridge.js
// 핵심 보완 사항 (항목 10):
// 1. 기존 01_npc_rpg_dialog_ui.js 의 실제 수신 채널명(`f_rank_days:update_npc_dialog_ui`)으로 정확히 전송하도록 수정!
// 2. `/frank` 단일 루트 명령어 아래에 `weapon`, `boss`, `news`, `cook`, `money`, `lost` 서브트리를 정식 병합 등록하고,
//    나우·헤스·다림·고리·로만 NPC 대화 버튼과 100% 동일한 백엔드 함수를 호출하도록 일원화했습니다(하위 호환용 `/frankv8` 별칭도 유지).

global.FRankDays = global.FRankDays || {};

// 나우/모루 현장 거리 검증 헬퍼 (실제 월드에서 원격 명령어 악용 방지, 테스트 모의 환경에서는 좌표 일치 시 통과)
global.FRankDays.isPlayerNearNauSmithyV8 = function (player) {
  if (!player) return false;
  if (player.level && String(player.level.dimension) !== 'minecraft:overworld') return false;
  if (player.server && typeof global.FRankDays.getExpectedNpcCoords === 'function') {
    var coords = global.FRankDays.getExpectedNpcCoords(player.server, 'nau');
    if (coords && coords.length >= 3) {
      var nx = Number(player.x || 0) - Number(coords[0]);
      var ny = Number(player.y || 0) - Number(coords[1]);
      var nz = Number(player.z || 0) - Number(coords[2]);
      return nx * nx + ny * ny + nz * nz <= 81;
    }
  }
  if (!player.server || typeof player.server.overworld !== 'function') return true;
  var anchor = global.FRankDays.getVillageAnchor ? global.FRankDays.getVillageAnchor(player.server) : { x: 0, y: 68, z: 0 };
  // 브리온 마을 내 나우의 대장간 구역 또는 나우 엔티티 반경 검사
  var dx = Number(player.x || 0) - Number(anchor.x || 0);
  var dz = Number(player.z || 0) - Number(anchor.z || 0);
  if (Math.sqrt(dx * dx + dz * dz) <= 85) return true;
  return false;
};

// Extension actions use the same server-issued menu and distance boundary as
// the base dialogue router. A forged packet cannot bypass it through a wrapper.
global.FRankDays.validateNauDialogActionV91 = function (player, data, options) {
  if (options && options.bypassDistanceCheck) return { ok: true };
  var state = global.FRankDays.loadPlayerState(player), dialog = state.npc_dialog || {};
  if (!dialog.open || String(dialog.active_npc_id || '') !== 'nau') return { ok: false, reason: 'dialog_not_active' };
  var buttons = dialog.active_buttons || [], requested = String(data.button_id || ''), action = String(data.action || '');
  var selected = null;
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    if (requested ? String(b.id) === requested : String(b.action) === action) { selected = b; break; }
  }
  if (!selected || selected.enabled === false || String(selected.action) !== action) return { ok: false, reason: 'button_not_offered' };
  if (!global.FRankDays.isPlayerNearNauSmithyV8(player)) return { ok: false, reason: 'too_far_from_npc' };
  return { ok: true };
};

// 1) 기존 NPC RPG 대화창(handleNpcDialogAction) 비파괴 확장 래퍼
if (typeof global.FRankDays.handleNpcDialogAction === 'function' && !global.FRankDays._wrappedDialogV8) {
  var _baseDialogHandler = global.FRankDays.handleNpcDialogAction;
  global.FRankDays._wrappedDialogV8 = true;

  if (global.FRankDays.NPC_DIALOG_DEFS) {
    // 나우 메인 버튼 -> 강화·계승·단조 상점 메뉴
    if (global.FRankDays.NPC_DIALOG_DEFS.nau && global.FRankDays.NPC_DIALOG_DEFS.nau.buttons) {
      var nauBtns = global.FRankDays.NPC_DIALOG_DEFS.nau.buttons;
      for (var nb = 0; nb < nauBtns.length; nb++) {
        if (nauBtns[nb].id === 'special') {
          nauBtns[nb].label = '강화·계승';
          nauBtns[nb].action = 'V82_NAU_OPEN_ENH_GUI';
        }
      }
    }
    // 다림·고리·로만 요리 납품 의뢰 연결용 버튼 라벨 확장
    if (global.FRankDays.NPC_DIALOG_DEFS.darim && Array.isArray(global.FRankDays.NPC_DIALOG_DEFS.darim.buttons)) {
      for (var db = 0; db < global.FRankDays.NPC_DIALOG_DEFS.darim.buttons.length; db++) {
        if (global.FRankDays.NPC_DIALOG_DEFS.darim.buttons[db].id === 'shop') {
          global.FRankDays.NPC_DIALOG_DEFS.darim.buttons[db].label = '농산물·보리빵납품';
          global.FRankDays.NPC_DIALOG_DEFS.darim.buttons[db].action = 'V8_DARIM_CULINARY_MENU';
        }
      }
    }
    if (global.FRankDays.NPC_DIALOG_DEFS.gori && Array.isArray(global.FRankDays.NPC_DIALOG_DEFS.gori.buttons)) {
      for (var gb = 0; gb < global.FRankDays.NPC_DIALOG_DEFS.gori.buttons.length; gb++) {
        if (global.FRankDays.NPC_DIALOG_DEFS.gori.buttons[gb].id === 'shop') {
          global.FRankDays.NPC_DIALOG_DEFS.gori.buttons[gb].label = '여관식사·타르트납품';
          global.FRankDays.NPC_DIALOG_DEFS.gori.buttons[gb].action = 'V8_GORI_CULINARY_MENU';
        }
      }
    }
    if (global.FRankDays.NPC_DIALOG_DEFS.roman && Array.isArray(global.FRankDays.NPC_DIALOG_DEFS.roman.buttons)) {
      for (var rb = 0; rb < global.FRankDays.NPC_DIALOG_DEFS.roman.buttons.length; rb++) {
        if (global.FRankDays.NPC_DIALOG_DEFS.roman.buttons[rb].id === 'shop') {
          global.FRankDays.NPC_DIALOG_DEFS.roman.buttons[rb].label = '연금상점·약초차납품';
          global.FRankDays.NPC_DIALOG_DEFS.roman.buttons[rb].action = 'V8_ROMAN_CULINARY_MENU';
        }
      }
    }
  }

  global.FRankDays.handleNpcDialogAction = function (player, reqData, options) {
    var data = reqData || {};
    var state = global.FRankDays.loadPlayerState(player);
    var npcId = String(data.npc_id || (state.npc_dialog && state.npc_dialog.active_npc_id) || '');
    var action = String(data.action || '');

    // 중요: 01_npc_rpg_dialog_ui.js 의 실제 리스너 채널명인 'f_rank_days:update_npc_dialog_ui' 로 정확히 송신!
    function sendDialogUpdate(npcKey, text, buttons) {
      var stNow = global.FRankDays.loadPlayerState(player);
      var payload = global.FRankDays.buildNpcDialogPayload(player, stNow, npcKey, text, buttons, 0);
      if (typeof global.FRankDays.pushNpcDialogToClient === 'function') {
        global.FRankDays.pushNpcDialogToClient(player, payload, true);
      } else if (typeof player.sendData === 'function') {
        stNow.npc_dialog.active_buttons = payload.buttons || [];
        global.FRankDays.savePlayerState(player, stNow);
        player.sendData('f_rank_days:update_npc_dialog_ui', payload);
      }
      return { ok: true, npc_id: npcKey, action: action, text: text, payload: payload, packet_channel: 'f_rank_days:update_npc_dialog_ui' };
    }

    // A. 나우의 대장간: 숙련 강화(+5%p) · 슬롯 분리 안전 계승 GUI · 단련석/강화망치 구매 · 연장 수리
    if (npcId === 'nau') {
      if (action.indexOf('V8_NAU_') === 0) {
        var nauGate = global.FRankDays.validateNauDialogActionV91(player, data, options);
        if (!nauGate.ok) return nauGate;
      }
      var forgeButtons = [
        { id: 'v8_enh_info', label: '강화·계승 창', icon: 'special', action: 'V82_NAU_OPEN_ENH_GUI', enabled: true },
        { id: 'v8_buy_stone', label: '단련석(6실버)', icon: 'shop', action: 'V8_NAU_BUY_STONE', enabled: true },
        { id: 'v8_buy_hammer', label: '강화망치(35실버)', icon: 'shop', action: 'V8_NAU_BUY_HAMMER', enabled: true },
        { id: 'v8_repair', label: '연장 수리', icon: 'special', action: 'SPECIAL_NAU_REPAIR', enabled: true },
        { id: 'v8_equipment', label: '장비 구매', icon: 'shop', action: 'OPEN_SHOP', enabled: true },
        { id: 'back', label: '돌아가기', icon: 'close', action: 'BACK_MAIN', enabled: true }
      ];

      if (action === 'V8_NAU_FORGE_MENU') {
        var bal = global.FRankDays.getPlayerBalanceSummaryV8(player);
        return sendDialogUpdate(
          'nau',
          '무기 강화와 안전 계승은 전용창에서 확인해라.\n단련석과 강화망치 구매, 연장 수리도 여기서 맡기면 된다.\n보유 화폐: ' + bal.formatted_total,
          forgeButtons
        );
      }
      if (action === 'V8_NAU_ENH_PREVIEW') {
        var pv = global.FRankDays.previewWeaponEnhancement(player, 'mainhand', 'NAU');
        if (!pv.ok) return sendDialogUpdate('nau', pv.message, forgeButtons);
        var matDesc = pv.materials.map(function (m) { return m.id.split(':')[1] + ' x' + m.count; }).join(', ');
        var infoTxt =
          '[나우 숙련 강화 사전 확인: ' + pv.item_id + ']\n' +
          '· 계열: ' + pv.family_label + ' | 현재: +' + pv.current_level + ' → 성공 +' + pv.success_target_level + ' / 실패 +' + pv.failure_target_level + ' (파괴 0%)\n' +
          '· 성공률: ' + Math.floor(pv.success_rate * 100 + 0.5) + '% (기본 ' + Math.floor(pv.base_success_rate * 100 + 0.5) + '% + 나우 5%p) | 수수료: ' + pv.fee_formatted + ' + ' + matDesc;
        return sendDialogUpdate('nau', infoTxt, forgeButtons);
      }
      if (action === 'V8_NAU_ENH_EXEC') {
        var ex = global.FRankDays.executeWeaponEnhancement(player, { method: 'NAU', slot: 'mainhand' });
        return sendDialogUpdate('nau', ex.message, forgeButtons);
      }
      if (action === 'V8_NAU_OPEN_SAFE_INH_GUI') {
        var guiRes = global.FRankDays.openSafeInheritanceGuiV8(player, 'NAU');
        return { ok: guiRes.ok, npc_id: 'nau', action: action, opened_safe_inheritance_gui: true, gui_result: guiRes };
      }
      if (action === 'V8_NAU_BUY_STONE') {
        var bs = global.FRankDays.buyNpcCurrencyShopItemV8(player, 'tempering_stone');
        return sendDialogUpdate('nau', bs.message, forgeButtons);
      }
      if (action === 'V8_NAU_BUY_HAMMER') {
        var bh = global.FRankDays.buyNpcCurrencyShopItemV8(player, 'enhancement_hammer');
        return sendDialogUpdate('nau', bh.message, forgeButtons);
      }
    }

    // B. 헤스 길드 접수처: 보스 토벌 의뢰/보고 · 브리온 일보 · 에메랄드 환전 · 족제비 유실물 회수
    if (
      npcId === 'hess' &&
      (action === 'QUEST_ACTION' ||
        action === 'V8_HESS_BOSS_ACCEPT' ||
        action === 'V8_HESS_BOSS_CLAIM' ||
        action === 'V8_HESS_READ_NEWS' ||
        action === 'V8_HESS_EXCHANGE_EMERALD' ||
        action === 'V8_HESS_RECOVER_LOST')
    ) {
      var hessButtons = [
        { id: 'v8_boss_q', label: '강철수호자 의뢰', icon: 'quest', action: 'V8_HESS_BOSS_ACCEPT', enabled: true },
        { id: 'v8_boss_c', label: '토벌 완료 보고', icon: 'special', action: 'V8_HESS_BOSS_CLAIM', enabled: true },
        { id: 'v8_news', label: '브리온 일보 열람', icon: 'talk', action: 'V8_HESS_READ_NEWS', enabled: true },
        { id: 'v8_exch', label: '에메랄드→화폐환전', icon: 'shop', action: 'V8_HESS_EXCHANGE_EMERALD', enabled: true },
        { id: 'v8_lost', label: '족제비 유실물회수', icon: 'special', action: 'V8_HESS_RECOVER_LOST', enabled: true },
        { id: 'back', label: '돌아가기', icon: 'close', action: 'BACK_MAIN', enabled: true }
      ];
      if (action === 'V8_HESS_BOSS_ACCEPT') {
        var bq = global.FRankDays.acceptFirstBossQuestV8(player);
        return sendDialogUpdate('hess', bq.message, hessButtons);
      }
      if (action === 'V8_HESS_BOSS_CLAIM') {
        var bc = global.FRankDays.claimBossQuestRewardFromHessV8(player);
        return sendDialogUpdate('hess', bc.message, hessButtons);
      }
      if (action === 'V8_HESS_READ_NEWS') {
        var nw = global.FRankDays.readBrionNewspaperV8(player, null);
        return sendDialogUpdate('hess', nw.formatted_text || nw.message, hessButtons);
      }
      if (action === 'V8_HESS_EXCHANGE_EMERALD') {
        var exch = global.FRankDays.exchangeEmeraldsToCurrencyV8(player, null);
        return sendDialogUpdate('hess', exch.message, hessButtons);
      }
      if (action === 'V8_HESS_RECOVER_LOST') {
        var rec = global.FRankDays.recoverLostParcelV8(player, null);
        return sendDialogUpdate('hess', rec.message, hessButtons);
      }
      if (action === 'QUEST_ACTION' && state.relationships.hess.affinity < 60) {
        var summary = global.FRankDays.getQuestSummaryText ? global.FRankDays.getQuestSummaryText(player) : '길드 의뢰 요약';
        return sendDialogUpdate('hess', summary + '\n\n[통합 길드 창구] 보스 토벌 보고, 《브리온 일보》, 에메랄드 화폐 환전, 족제비 유실물 회수를 이용하실 수 있습니다.', hessButtons);
      }
    }

    // C. 다림·고리·로만 요리 의뢰 및 화폐 상점 서브메뉴
    if (npcId === 'darim' && (action === 'V8_DARIM_CULINARY_MENU' || action === 'V8_DARIM_ORDER_BREAD')) {
      var darimBtns = [
        { id: 'd_ord', label: '보리빵4 납품(8실버)', icon: 'quest', action: 'V8_DARIM_ORDER_BREAD', enabled: true },
        { id: 'd_orig', label: '기존 농장 상점', icon: 'shop', action: 'SHOP_MENU', enabled: true },
        { id: 'back', label: '돌아가기', icon: 'close', action: 'BACK_MAIN', enabled: true }
      ];
      if (action === 'V8_DARIM_ORDER_BREAD') {
        var dr = global.FRankDays.completeVillageCulinaryOrderV8(player, 'darim');
        return sendDialogUpdate('darim', dr.message, darimBtns);
      }
      return sendDialogUpdate('darim', '[다림의 농가 납품대]\n브리온 농가 보리빵 4개를 구워 오시면 8실버(80동화)와 무기 단련석 1개를 드려요!', darimBtns);
    }

    if (npcId === 'gori' && (action === 'V8_GORI_CULINARY_MENU' || action === 'V8_GORI_ORDER_TART' || action === 'V8_GORI_BUY_SOUP')) {
      var goriBtns = [
        { id: 'g_soup', label: '감자수프 구매(5실버)', icon: 'shop', action: 'V8_GORI_BUY_SOUP', enabled: true },
        { id: 'g_tart', label: '타르트2 납품(12실버)', icon: 'quest', action: 'V8_GORI_ORDER_TART', enabled: true },
        { id: 'g_orig', label: '기존 여관 상점', icon: 'shop', action: 'SHOP_MENU', enabled: true },
        { id: 'back', label: '돌아가기', icon: 'close', action: 'BACK_MAIN', enabled: true }
      ];
      if (action === 'V8_GORI_BUY_SOUP') {
        var gs = global.FRankDays.buyNpcCurrencyShopItemV8(player, 'hearth_potato_soup');
        return sendDialogUpdate('gori', gs.message, goriBtns);
      }
      if (action === 'V8_GORI_ORDER_TART') {
        var gt = global.FRankDays.completeVillageCulinaryOrderV8(player, 'gori');
        return sendDialogUpdate('gori', gt.message, goriBtns);
      }
      return sendDialogUpdate('gori', '[고리의 여관 식탁]\n따끈한 화톳불 감자 수프(5실버)를 사시거나, 수확제 산딸기 타르트 2개를 납품(12실버 보상)해 주세요!', goriBtns);
    }

    if (npcId === 'roman' && (action === 'V8_ROMAN_CULINARY_MENU' || action === 'V8_ROMAN_ORDER_TEA')) {
      var romanBtns = [
        { id: 'r_tea', label: '약초차2 납품(마력석2)', icon: 'quest', action: 'V8_ROMAN_ORDER_TEA', enabled: true },
        { id: 'r_orig', label: '기존 연금 상점', icon: 'shop', action: 'SHOP_MENU', enabled: true },
        { id: 'back', label: '돌아가기', icon: 'close', action: 'BACK_MAIN', enabled: true }
      ];
      if (action === 'V8_ROMAN_ORDER_TEA') {
        var rt = global.FRankDays.completeVillageCulinaryOrderV8(player, 'roman');
        return sendDialogUpdate('roman', rt.message, romanBtns);
      }
      return sendDialogUpdate('roman', '[로만의 연금 작업대]\n로만식 맑은 약초차 2병을 달여 오면 정제된 마력석 2개로 교환해 주지.', romanBtns);
    }

    return _baseDialogHandler.apply(this, arguments);
  };
}

// 2) `/frank` 정식 통합 명령어 병합 등록 + 하위 호환 `/frankv8` 등록
if (typeof ServerEvents !== 'undefined' && ServerEvents.commandRegistry) {
  ServerEvents.commandRegistry(function (event) {
    var Commands = event.commands;
    var Arguments = event.arguments;
    if (!Commands || !Commands.literal) return;

    // 정식 /frank 서브트리 병합 (Mojang Brigadier root.addChild 병합 규격 준수)
    event.register(
      Commands.literal('frank')
        .requires(function (src) { return src.hasPermission(0); })
        // A. /frank weapon (info | enhance <anvil|hammer|nau> | inherit_gui)
        .then(
          Commands.literal('weapon')
            .then(Commands.literal('info').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var pvA = global.FRankDays.previewWeaponEnhancement(pl, 'mainhand', 'ANVIL');
              var pvN = global.FRankDays.previewWeaponEnhancement(pl, 'mainhand', 'NAU');
              if (!pvA.ok) { pl.tell(pvA.message); return 0; }
              pl.tell(
                '[무기 강화 정보] ' + pvA.item_id + ' (' + pvA.family_label + ', 현재 +' + pvA.current_level + ')\n' +
                ' · 모루/강화망치 확률: ' + Math.floor(pvA.success_rate * 100 + 0.5) + '% | 나우 숙련 확률(+5%p): ' + Math.floor(pvN.success_rate * 100 + 0.5) + '%\n' +
                ' · 수수료: ' + pvA.fee_formatted + ' | 비파괴 규칙(실패 시 -1, +0 하한)'
              );
              return 1;
            }))
            .then(
              Commands.literal('enhance')
                .executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  return global.FRankDays.executeWeaponEnhancement(pl, { method: 'ANVIL', slot: 'mainhand' }).ok ? 1 : 0;
                })
                .then(Commands.literal('anvil').executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  return global.FRankDays.executeWeaponEnhancement(pl, { method: 'ANVIL', slot: 'mainhand' }).ok ? 1 : 0;
                }))
                .then(Commands.literal('hammer').executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  return global.FRankDays.executeWeaponEnhancement(pl, { method: 'HAMMER', slot: 'mainhand' }).ok ? 1 : 0;
                }))
                .then(Commands.literal('nau').executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  if (!global.FRankDays.isPlayerNearNauSmithyV8(pl)) {
                    pl.tell('[나우의 대장간] 브리온 마을 나우의 대장간 근처에서만 숙련 강화(+5%p)를 받을 수 있습니다.');
                    return 0;
                  }
                  return global.FRankDays.executeWeaponEnhancement(pl, { method: 'NAU', slot: 'mainhand' }).ok ? 1 : 0;
                }))
            )
            .then(Commands.literal('inherit_gui').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              if (!global.FRankDays.isPlayerNearNauSmithyV8(pl)) {
                pl.tell('[나우의 대장간] 강화 계승은 브리온 마을 대장장이 나우에게서만 진행할 수 있습니다.');
                return 0;
              }
              return global.FRankDays.openSafeInheritanceGuiV8(pl, 'NAU').ok ? 1 : 0;
            }))
        )
        // B. /frank boss (accept | claim | altar | trainer)
        .then(
          Commands.literal('boss')
            .then(Commands.literal('accept').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.acceptFirstBossQuestV8(pl).ok ? 1 : 0;
            }))
            .then(Commands.literal('claim').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.claimBossQuestRewardFromHessV8(pl).ok ? 1 : 0;
            }))
            .then(Commands.literal('altar').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var ac = global.FRankDays.getBossAltarCoordsV8(pl.server);
              var busy = global.FRankDays.isBossCurrentlyActiveAtAltarV8(pl.server);
              pl.tell('[강철 수호자의 시련 제단] 지정 좌표: X=' + ac.x + ', Y=' + ac.y + ', Z=' + ac.z + ' | 현재 상태: ' + (busy.active ? '보스 교전 중(추가 소환 잠금)' : '소환 가능'));
              return 1;
            }))
            .then(Commands.literal('trainer').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.spawnParryTrainerMonster(pl).ok ? 1 : 0;
            }))
        )
        // C. /frank news read
        .then(
          Commands.literal('news')
            .executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.readBrionNewspaperV8(pl, null).ok ? 1 : 0;
            })
            .then(Commands.literal('read').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.readBrionNewspaperV8(pl, null).ok ? 1 : 0;
            }))
        )
        // D. /frank cook order <darim|gori|roman>
        .then(
          Commands.literal('cook')
            .then(
              Commands.literal('order')
                .then(Commands.literal('darim').executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  var r = global.FRankDays.completeVillageCulinaryOrderV8(pl, 'darim');
                  if (r.message) pl.tell(r.message);
                  return r.ok ? 1 : 0;
                }))
                .then(Commands.literal('gori').executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  var r = global.FRankDays.completeVillageCulinaryOrderV8(pl, 'gori');
                  if (r.message) pl.tell(r.message);
                  return r.ok ? 1 : 0;
                }))
                .then(Commands.literal('roman').executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  var r = global.FRankDays.completeVillageCulinaryOrderV8(pl, 'roman');
                  if (r.message) pl.tell(r.message);
                  return r.ok ? 1 : 0;
                }))
            )
        )
        // E. /frank money (balance | deposit | withdraw <copper> | migrate_emeralds)
        .then(
          Commands.literal('money')
            .executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var b = global.FRankDays.getPlayerBalanceSummaryV8(pl);
              pl.tell('[아르베른 화폐 지갑] 총 가용액: ' + b.formatted_total + ' (지갑: ' + b.formatted_wallet + ' / 인벤토리 주화: ' + global.FRankDays.formatCurrencyV8(b.inventory_coins_copper) + ')');
              return 1;
            })
            .then(Commands.literal('balance').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var b = global.FRankDays.getPlayerBalanceSummaryV8(pl);
              pl.tell('[아르베른 화폐 지갑] 총 가용액: ' + b.formatted_total + ' (지갑: ' + b.formatted_wallet + ')');
              return 1;
            }))
            .then(Commands.literal('deposit').executes(function (ctx) {
              var pl = ctx.source.player;
              return pl && global.FRankDays.depositAllCoinsToWalletV8(pl).ok ? 1 : 0;
            }))
            .then(Commands.literal('migrate_emeralds').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var r = global.FRankDays.exchangeEmeraldsToCurrencyV8(pl, null);
              if (!r.ok && r.message) pl.tell(r.message);
              return r.ok ? 1 : 0;
            }))
            .then(
              Commands.literal('withdraw').then(
                Commands.argument('copperAmount', Arguments.INTEGER.create(event)).executes(function (ctx) {
                  var pl = ctx.source.player;
                  if (!pl) return 0;
                  var amt = Arguments.INTEGER.getResult(ctx, 'copperAmount');
                  var r = global.FRankDays.withdrawCoinsFromWalletV8(pl, amt);
                  if (!r.ok && r.message) pl.tell(r.message);
                  return r.ok ? 1 : 0;
                })
              )
            )
        )
        // F. /frank lost (list | recover) — 족제비 유실물 회수 창구
        .then(
          Commands.literal('lost')
            .then(Commands.literal('list').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var list = global.FRankDays.listPendingLostParcelsV8(pl);
              if (list.length === 0) {
                pl.tell('[족제비 유실물 회수 대장] 현재 미회수 유실물이 없습니다.');
                return 1;
              }
              var lines = ['[족제비 유실물 보관 목록 (' + list.length + '건)]'];
              for (var i = 0; i < list.length; i++) {
                lines.push(' · ' + list[i].parcel_id + ' (' + list[i].region + ', ' + list[i].items.length + '묶음) — 회수 비용: ' + global.FRankDays.formatCurrencyV8(list[i].fee_copper));
              }
              pl.tell(lines.join('\n'));
              return 1;
            }))
            .then(Commands.literal('recover').executes(function (ctx) {
              var pl = ctx.source.player;
              if (!pl) return 0;
              var r = global.FRankDays.recoverLostParcelV8(pl, null);
              if (!r.ok && r.message) pl.tell(r.message);
              return r.ok ? 1 : 0;
            }))
        )
    );
  });
}
