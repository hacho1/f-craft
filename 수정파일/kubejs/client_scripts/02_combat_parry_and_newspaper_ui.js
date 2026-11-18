// 《F-Craft》 KubeJS 6 Client Script - v8.2 Server-Synced Combat/Enhance VFX HUD & Kenney Parchment 《브리온 일보》 Newspaper Modal
// 파일 경로: kubejs/client_scripts/02_combat_parry_and_newspaper_ui.js
// 핵심 설계 (Phase 4 & Phase 6):
// 1. 서버 판정 이후에만 수신되는 f_rank_days:vfx_event 패킷을 기반으로 패링 성공(반격 창)·패링 실패·구르기 쿨타임·강화 성공/실패·+99 초월 달성 배너를 표시합니다.
// 2. 《브리온 일보》 열람 시 단순 텍스트 출력 대신 Kenney 양피지 신문 레이아웃(newspaper_parchment.png)과 닫기 버튼이 갖춰진 전용 신문 창을 표시합니다.

var frankCombatHudClient = {
  wasParryKeyDown: false,
  wasLeftDown: false,
  telegraphLabel: '',
  telegraphExpireTick: 0,
  vfxBannerText: '',
  vfxBannerColor: '#FFE89E',
  vfxBannerExpireTick: 0,
  counterExpireTick: 0,
  rollCooldownExpireTick: 0,
  fxIntensity: 'full',
  tick: 0
};

var frankNewspaperUi = {
  open: false,
  title: '',
  publicArticles: [],
  personalNotices: [],
  autoCloseTick: 0
};

NetworkEvents.dataReceived('f_rank_days:attack_telegraph', function (event) {
  var d = event.data || {};
  frankCombatHudClient.telegraphLabel = d.attacker_label ? String(d.attacker_label) : '적 강공격';
  frankCombatHudClient.telegraphExpireTick = frankCombatHudClient.tick + 12;
});

// 서버 권위 판정 직후 수신되는 VFX/HUD 피드백 패킷 (클라이언트 임의 예측 판정 0%)
NetworkEvents.dataReceived('f_rank_days:vfx_event', function (event) {
  var d = event.data || {};
  var vtype = String(d.vfx_type || '');
  if (d.intensity) frankCombatHudClient.fxIntensity = String(d.intensity);

  if (vtype === 'PARRY_SUCCESS') {
    frankCombatHudClient.vfxBannerText = '⚡ [패링 성공!] 피해 0 · 1.4초간 반격 피해 +35%!';
    frankCombatHudClient.vfxBannerColor = '#7DD3FC';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 28;
    frankCombatHudClient.counterExpireTick = frankCombatHudClient.tick + 28;
  } else if (vtype === 'PARRY_FAIL') {
    frankCombatHudClient.vfxBannerText = '✖ [패링 타이밍 빗나감] 방어 자세가 흔들렸습니다!';
    frankCombatHudClient.vfxBannerColor = '#FCA5A5';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 22;
  } else if (vtype === 'DODGE_ROLL') {
    frankCombatHudClient.rollCooldownExpireTick = frankCombatHudClient.tick + 30;
    frankCombatHudClient.vfxBannerText = '💨 [회피 구르기] 재사용 대기 1.5초';
    frankCombatHudClient.vfxBannerColor = '#E2E8F0';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 18;
  } else if (vtype === 'ENHANCE_MYTHIC_99') {
    frankCombatHudClient.vfxBannerText = '★ [+99 초월 단조 달성!!] 전설을 넘어선 무기가 탄생했습니다! ★';
    frankCombatHudClient.vfxBannerColor = '#F0ABFC';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 90;
  } else if (vtype === 'ENHANCE_SUCCESS') {
    frankCombatHudClient.vfxBannerText = '✦ [강화 성공!] +' + d.previous_level + ' ➔ +' + d.new_level + ' 단련 완료!';
    frankCombatHudClient.vfxBannerColor = '#FDE047';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 40;
  } else if (vtype === 'ENHANCE_FAILURE') {
    frankCombatHudClient.vfxBannerText = '▾ [강화 실패] +' + d.previous_level + ' ➔ +' + d.new_level + ' (무기 비파괴 보존)';
    frankCombatHudClient.vfxBannerColor = '#CBD5E1';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 40;
  } else if (vtype === 'BOSS_ALTAR_SUMMON') {
    frankCombatHudClient.vfxBannerText = '⚔ [시련 제단 각성] 고대 룬이 점화되며 강철 수호자가 강림합니다!';
    frankCombatHudClient.vfxBannerColor = '#FDBA74';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 70;
  } else if (vtype === 'BOSS_ALTAR_BLOCKED') {
    frankCombatHudClient.vfxBannerText = String(d.banner_text || '[시련 제단] 현재 소환할 수 없는 상태입니다.');
    frankCombatHudClient.vfxBannerColor = '#FDA4AF';
    frankCombatHudClient.vfxBannerExpireTick = frankCombatHudClient.tick + 45;
  }
});

function paintCombatAndNewsV82(objects) {
  if (typeof Client === 'undefined' || !Client || !Client.player || typeof Client.player.paint !== 'function') return;
  var painter = Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE;
  var payload = {};
  var count = 0;
  for (var paintId in objects) {
    var object = objects[paintId];
    // build.26 creates missing ids even for remove:true or visible:false updates.
    if ((object.remove || !object.type) && painter.getObject(paintId) == null) continue;
    if (object.type === 'text' && object.text && typeof object.text === 'object') {
      object.text = JSON.stringify(object.text);
    }
    payload[paintId] = object;
    count++;
  }
  if (count > 0) Client.player.paint(payload);
}

function clearNewspaperPaintV82() {
  if (typeof F96UI !== 'undefined') F96UI.clear('news96');
  if (typeof Client === 'undefined' || !Client || !Client.player || typeof Client.player.paint !== 'function') return;
  var clean = {
    fnews_bg: { remove: true },
    fnews_paper: { remove: true },
    fnews_masthead: { remove: true },
    fnews_sub: { remove: true },
    fnews_personal_hdr: { remove: true },
    fnews_close_btn: { remove: true },
    fnews_close_txt: { remove: true }
  };
  for (var i = 0; i < 6; i++) clean['fnews_art_' + i] = { remove: true };
  for (var j = 0; j < 2; j++) clean['fnews_per_' + j] = { remove: true };
  paintCombatAndNewsV82(clean);
}

function closeNewspaperModalV82() {
  frankNewspaperUi.open = false;
  clearNewspaperPaintV82();
  if (typeof FRankModalHostV82 !== 'undefined') {
    FRankModalHostV82.closeNonChatModal('NEWSPAPER');
  }
}

function renderNewspaperModalV82() {
  if (frankNewspaperUi.open && typeof F96UI !== 'undefined') renderNewspaperV96(frankNewspaperUi);
}

NetworkEvents.dataReceived('f_rank_days:open_newspaper_ui', function (event) {
  var d = event.data || {};
  if(global.FCraftFoldoutV98){global.FCraftFoldoutV98.receiveNewspaper(d);return;}
  frankNewspaperUi.open = true;
  frankNewspaperUi.title = d.title ? String(d.title) : '《브리온 일보》';
  frankNewspaperUi.publicArticles = d.public_articles || [];
  frankNewspaperUi.personalNotices = d.personal_notices || [];
  frankNewspaperUi.autoCloseTick = 0;
  frankNewspaperUi.page = 0;
  if (typeof FRankModalHostV82 !== 'undefined') {
    FRankModalHostV82.openNonChatModal('NEWSPAPER');
  }
  renderNewspaperModalV82();
});

function isAnyClientGuiBlockingCombat() {
  if (typeof Client !== 'undefined' && Client && Client.screen) return true;
  if (typeof frankClientUiState !== 'undefined' && frankClientUiState.open) return true;
  if (typeof frankNpcDialogClient !== 'undefined' && frankNpcDialogClient.open) return true;
  if (typeof frankSafeInheritGui !== 'undefined' && frankSafeInheritGui.open) return true;
  if (frankNewspaperUi.open) return true;
  return false;
}

if (typeof ClientEvents !== 'undefined' && ClientEvents.tick) {
  ClientEvents.tick(function (event) {
    frankCombatHudClient.tick += 1;

    if (frankNewspaperUi.open && frankNewspaperUi.autoCloseTick > 0 && frankCombatHudClient.tick >= frankNewspaperUi.autoCloseTick) {
      closeNewspaperModalV82();
    }

    if (typeof Client === 'undefined' || !Client || !Client.player) return;

    try {
      var $GLFW = Java.loadClass('org.lwjgl.glfw.GLFW');
      var winHandle = Client.window ? Client.window.window : 0;
      if (winHandle) {
        if (frankNewspaperUi.open) {
          if (typeof $GLFW.glfwGetKey === 'function' && $GLFW.glfwGetKey(winHandle, 256) === 1) {
            closeNewspaperModalV82();
            return;
          }
          var leftDown = typeof $GLFW.glfwGetMouseButton === 'function' && $GLFW.glfwGetMouseButton(winHandle, 0) === 1;
          if (leftDown && !frankCombatHudClient.wasLeftDown && Client.mouseHandler && !F96UI.pointerBlocked()) {
            var guiW = Number(Client.window.guiScaledWidth || 480);
            var guiH = Number(Client.window.guiScaledHeight || 270);
            var ph = Math.min(212, Math.max(170, guiH - 18));
            var relMx = (Number(Client.mouseHandler.xpos()) * guiW) / Number(Client.window.width || 1) - guiW / 2;
            var relMy = (Number(Client.mouseHandler.ypos()) * guiH) / Number(Client.window.height || 1) - guiH / 2;
            handleNewspaperClickV96(relMx + guiW / 2, relMy + guiH / 2);
          }
          frankCombatHudClient.wasLeftDown = leftDown;
        }

        // 패링 키(R = 82) 엣지 트리거 (모든 커스텀·바닐라 GUI 열림 상태에서는 발동 차단!)
        var rDown = typeof $GLFW.glfwGetKey === 'function' && $GLFW.glfwGetKey(winHandle, 82) === 1;
        if (rDown && !frankCombatHudClient.wasParryKeyDown) {
          if (!isAnyClientGuiBlockingCombat() && typeof Client.player.sendData === 'function') {
            Client.player.sendData('f_rank_days:parry_input', {
              client_sent_ms: Date.now(),
              gui_open: false
            });
          }
        }
        frankCombatHudClient.wasParryKeyDown = rDown;
      }
    } catch (e) {}

    if (typeof Client.player.paint === 'function') {
      var hudPaint = {};
      if (frankCombatHudClient.tick < frankCombatHudClient.telegraphExpireTick) {
        hudPaint.frank_parry_warn = {
          type: 'text',
          text: '⚡ [!] ' + frankCombatHudClient.telegraphLabel + ' 공격 예고 — [R] 패링!',
          x: 0, y: -64, alignX: 'center', alignY: 'center', centered: true,
          color: '#FFD94A', shadow: true, visible: true
        };
      } else {
        hudPaint.frank_parry_warn = { visible: false };
      }

      if (frankCombatHudClient.tick < frankCombatHudClient.vfxBannerExpireTick) {
        hudPaint.frank_vfx_banner = {
          type: 'text',
          text: frankCombatHudClient.vfxBannerText,
          x: 0, y: -48, alignX: 'center', alignY: 'center', centered: true, scale: 0.88,
          color: frankCombatHudClient.vfxBannerColor, shadow: true, visible: true
        };
      } else {
        hudPaint.frank_vfx_banner = { visible: false };
      }

      if (frankCombatHudClient.tick < frankCombatHudClient.counterExpireTick) {
        var remTicks = frankCombatHudClient.counterExpireTick - frankCombatHudClient.tick;
        hudPaint.frank_counter_bar = {
          type: 'rectangle',
          x: 0, y: 24, w: Math.max(4, Math.floor((remTicks / 28) * 72)), h: 3,
          alignX: 'center', alignY: 'center', color: '#38BDF8', visible: true
        };
      } else {
        hudPaint.frank_counter_bar = { visible: false };
      }

      paintCombatAndNewsV82(hudPaint);
    }
  });
}

if (typeof global !== 'undefined') {
  global.FRankCombatAndNewsClientV82 = {
    hud: frankCombatHudClient,
    newspaper: frankNewspaperUi,
    closeNewspaper: closeNewspaperModalV82
  };
}
