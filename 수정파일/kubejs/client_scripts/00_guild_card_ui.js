// 《F-Craft》 KubeJS 6 Client Script - v8.2 Dedicated Non-Chat Guild Registration Card GUI (Screen + Korean Input + Clipboard + Live Preview)
// 파일 경로: kubejs/client_scripts/00_guild_card_ui.js
// 핵심 설계 (Phase 1 필수 요구사항 100% 충족):
// 1. 채팅 화면(바닐라 채팅 입력창)을 일절 열거나 참조하지 않습니다.
// 2. FancyMenu 커스텀 모달 호스트(f_rank_modal_host) 또는 비채팅 Screen 어댑터(net.minecraft.client.gui.screens.Screen)를 열어
//    하단 채팅창 겹침 현상을 원천 제거하고 마우스 포인터 및 전용 텍스트 입력 포커스를 제공합니다.
// 3. 전용 [성명 입력칸] 지원 기능:
//    - 최초 열림 시 플레이어 현재 닉네임을 안전한 기본값으로 자동 채움 ([기본 닉네임] 버튼으로 언제든 재적용 가능)
//    - OS 한글 IME 완성형 유니코드(GLFWCharCallback) 직접 수신 + 클립보드 한글 붙여넣기(Ctrl+V / [붙여넣기] 버튼) + 2벌식 한글 자모 조합 보조기 내장
//    - 빈 문자열·공백 전용 입력 차단, 2~16자 제한, 제어문자 및 § 서식코드 실시간 차단
//    - 양피지 길드 등록증(제목·등록번호·성명·F급 능력·최초 직업·등급·발급일·길드 인장 문양) 실시간 손글씨 미리보기 및 [확인 발급] / [취소] 버튼 제공

// 모든 커스텀 GUI가 공유하는 비채팅 모달 호스트 컨트롤러
var FRankModalHostV82 = {
  activeModalId: null,
  openNonChatModal: function (modalId) {
    this.activeModalId = modalId;
    if (typeof Client === 'undefined' || !Client) return false;

    // 1순위: FancyMenu v3 Custom GUI (f_rank_modal_host) 호출 — 채팅창 없는 순수 빈 Screen
    try {
      var $FMRegistry = Java.loadClass('de.keksuccino.fancymenu.customization.customgui.CustomGuiRegistry');
      if ($FMRegistry && typeof $FMRegistry.getCustomGui === 'function') {
        var cgui = $FMRegistry.getCustomGui('f_rank_modal_host');
        if (cgui && typeof cgui.buildScreen === 'function') {
          var fmScr = cgui.buildScreen();
          if (typeof Client.setCurrentScreen === 'function') Client.setCurrentScreen(fmScr);
          else if (typeof Client.setScreen === 'function') Client.setScreen(fmScr);
          return true;
        }
      }
    } catch (e1) {}

    // 2순위: 순수 Minecraft Screen (비채팅 기본 Screen — 채팅화면 절대 미사용!)
    try {
      var $Screen = Java.loadClass('net.minecraft.client.gui.screens.Screen');
      var titleComp = (typeof Text !== 'undefined' && Text && Text.of) ? Text.of('길드 전용 창') : '길드 전용 창';
      var scrInstance = null;
      if (typeof JavaAdapter !== 'undefined') {
        scrInstance = new JavaAdapter($Screen, {
          isPauseScreen: function () { return false; },
          m_7043_: function () { return false; }
        }, titleComp);
      } else {
        scrInstance = new $Screen(titleComp);
      }
      if (scrInstance) {
        if (typeof Client.setCurrentScreen === 'function') Client.setCurrentScreen(scrInstance);
        else if (typeof Client.setScreen === 'function') Client.setScreen(scrInstance);
        return true;
      }
    } catch (e2) {}

    // 3순위: LWJGL GLFW 마우스 커서 직접 해제 폴백 (채팅창 열지 않음)
    try {
      if (Client.mouseHandler && typeof Client.mouseHandler.releaseMouse === 'function') {
        Client.mouseHandler.releaseMouse();
      } else if (Client.window && Client.window.window) {
        var $GLFW = Java.loadClass('org.lwjgl.glfw.GLFW');
        $GLFW.glfwSetInputMode(Client.window.window, 208897, 212993);
      }
    } catch (e3) {}
    return true;
  },
  closeNonChatModal: function (modalId) {
    if (modalId && this.activeModalId && this.activeModalId !== modalId) return;
    this.activeModalId = null;
    if (typeof Client !== 'undefined' && Client) {
      try {
        if (typeof Client.setCurrentScreen === 'function') Client.setCurrentScreen(null);
        else if (typeof Client.setScreen === 'function') Client.setScreen(null);
      } catch (e) {}
    }
  }
};

if (typeof global !== 'undefined') {
  global.FRankClientModalHostV82 = FRankModalHostV82;
}

// 클라이언트 측 성명 유효성 검증기 (서버 validateGuildCardDisplayNameV82 와 1:1 동일 규칙)
function validateGuildCardNameClientV82(rawText) {
  var rawStr = String(rawText === null || rawText === undefined ? '' : rawText);
  if (/[\x00-\x1F\x7F§]/.test(rawStr) || /&[0-9a-fk-orA-FK-OR]/.test(rawStr)) {
    return {
      valid: false,
      reason: 'forbidden_control_or_format_char',
      cleaned: '',
      message: '⚠ 제어 문자나 서식 코드(§)는 사용할 수 없습니다.'
    };
  }
  var normalized = rawStr.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0 || normalized.replace(/\s+/g, '').length === 0) {
    return {
      valid: false,
      reason: 'empty_or_whitespace',
      cleaned: '',
      message: '⚠ 공백만 입력할 수 없습니다 (2~16자 입력).'
    };
  }
  if (!/^[가-힣a-zA-Z0-9 _·\-]+$/.test(normalized)) {
    return {
      valid: false,
      reason: 'invalid_characters',
      cleaned: normalized,
      message: '⚠ 완성된 한글·영문·숫자·공백·하이픈(-)만 허용됩니다.'
    };
  }
  if (normalized.length < 2 || normalized.length > 16) {
    return {
      valid: false,
      reason: 'length_out_of_bounds',
      cleaned: normalized.slice(0, 16),
      message: '⚠ 성명은 2~16자 이내여야 합니다 (현재 ' + normalized.length + '자).'
    };
  }
  return {
    valid: true,
    reason: 'ok',
    cleaned: normalized,
    message: '✓ 사용 가능한 길드 등록 성명 (' + normalized.length + '/16자)'
  };
}

var frankClientUiState = {
  open: false,
  mode: null,
  inputFocused: true,
  inputText: '',
  defaultNickname: '',
  serverErrorMsg: '',
  hoveredBtn: '',
  wasLeftDown: false,
  wasBackspaceDown: false,
  wasEnterDown: false,
  wasEscDown: false,
  wasPasteShortcutDown: false,
  charHookInstalled: false,
  autoCloseTick: 0,
  openedTick: 0,
  tickCounter: 0,
  cardData: {
    empire_header: '아르베른 제국 통합 길드',
    serial: 'ARB-412-00000000',
    grade: 'F',
    ability: '미등록',
    job: '미등록',
    issued_date: '아르베른력 412년 정착기록',
    issuer: '아르베른 통합 길드 브리온 지부'
  },
  hitboxes: []
};

// GUI Scale 2~4 및 소형 해상도(320x180 이상) 대응 반응형 레이아웃 계산기
function computeGuildCardLayoutV82(guiW, guiH) {
  var sw = Math.max(300, Number(guiW || 480));
  var sh = Math.max(180, Number(guiH || 270));
  var cardW = Math.min(420, sw - 20);
  var cardH = Math.min(300, sh - 16);
  var compact = cardW < 296 || cardH < 198;
  var halfW = Math.floor(cardW / 2);
  var halfH = Math.floor(cardH / 2);

  var inputW = cardW - 28;
  var inputH = compact ? 18 : 21;
  var inputTop = halfH - (compact ? 48 : 56);

  var btnY = halfH - (compact ? 22 : 25);
  var btnH = compact ? 16 : 19;
  var gap = 4;
  var wNick = Math.floor((inputW - gap * 3) * 0.24);
  var wPaste = Math.floor((inputW - gap * 3) * 0.20);
  var wConfirm = Math.floor((inputW - gap * 3) * 0.34);
  var wCancel = inputW - gap * 3 - wNick - wPaste - wConfirm;

  var startX = -halfW + 14;
  var xNick = startX;
  var xPaste = xNick + wNick + gap;
  var xConfirm = xPaste + wPaste + gap;
  var xCancel = xConfirm + wConfirm + gap;

  return {
    sw: sw,
    sh: sh,
    cardW: cardW,
    cardH: cardH,
    compact: compact,
    halfW: halfW,
    halfH: halfH,
    fontScale: compact ? 0.74 : 0.86,
    headerScale: compact ? 0.84 : 0.96,
    inputLeft: startX,
    inputTop: inputTop,
    inputW: inputW,
    inputH: inputH,
    statusY: inputTop - (compact ? 9 : 11),
    buttons: [
      { id: 'FILL_NICK', label: '기본닉네임', left: xNick, top: btnY, w: wNick, h: btnH },
      { id: 'PASTE_CLIP', label: '붙여넣기', left: xPaste, top: btnY, w: wPaste, h: btnH },
      { id: 'CONFIRM_ISSUE', label: '확인 발급', left: xConfirm, top: btnY, w: wConfirm, h: btnH },
      { id: 'CANCEL_CLOSE', label: '취소[ESC]', left: xCancel, top: btnY, w: wCancel, h: btnH }
    ]
  };
}

function clearGuildCardClientPaintV82(legacyOnly) {
  if (!legacyOnly && typeof F96UI !== 'undefined') F96UI.clear('card96');
  if (typeof Client === 'undefined' || !Client || !Client.player || typeof Client.player.paint !== 'function') return;
  var keys = [
    'fgc82_backdrop', 'fgc82_card', 'fgc82_header', 'fgc82_lbl_name', 'fgc82_val_name',
    'fgc82_row_serial', 'fgc82_row_ability', 'fgc82_row_job', 'fgc82_row_date', 'fgc82_row_issuer',
    'fgc82_seal', 'fgc82_status', 'fgc82_input_box', 'fgc82_input_text', 'fgc82_view_hint',
    'frank_gc_backdrop', 'frank_gc_card', 'frank_gc_header', 'frank_gc_label_name',
    'frank_gc_val_name', 'frank_gc_row_serial', 'frank_gc_row_ability', 'frank_gc_row_job',
    'frank_gc_row_grade', 'frank_gc_row_issuer', 'frank_gc_seal', 'frank_gc_footer'
  ];
  var clean = {};
  for (var i = 0; i < keys.length; i++) clean[keys[i]] = { remove: true };
  for (var b = 0; b < 4; b++) {
    clean['fgc82_btn_bg_' + b] = { remove: true };
    clean['fgc82_btn_txt_' + b] = { remove: true };
  }
  // build.26 creates missing ids before remove:true; clear only existing widgets.
  var painter = Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE;
  var existingCleanup = {};
  var hasCleanup = false;
  for (var paintId in clean) {
    if (painter.getObject(paintId) != null) {
      existingCleanup[paintId] = clean[paintId];
      hasCleanup = true;
    }
  }
  if (hasCleanup) Client.player.paint(existingCleanup);
}

if (typeof ClientEvents !== 'undefined' && ClientEvents.paintScreen) {
  ClientEvents.paintScreen(function () {
    if (frankClientUiState.open) clearGuildCardClientPaintV82(true);
  });
}

function renderGuildCardClientV82() {
  if (frankClientUiState.open && typeof F96UI !== 'undefined') renderGuildCardV96(frankClientUiState);
}

// 유니코드 문자 입력 처리 (OS 한글 IME 완성형 음절 및 일반 문자 수신, 제어문자/§ 자동 차단)
function appendTypedCodepointToGuildCardV82(codepoint) {
  if (!frankClientUiState.open || frankClientUiState.mode !== 'INPUT' || !frankClientUiState.inputFocused) return;
  if (codepoint < 32 || codepoint === 127 || codepoint === 167) return; // 제어문자 및 § 차단
  var ch = String.fromCodePoint ? String.fromCodePoint(codepoint) : String.fromCharCode(codepoint);
  if (frankClientUiState.inputText.length >= 16) return;
  frankClientUiState.inputText += ch;
  frankClientUiState.serverErrorMsg = '';
  renderGuildCardClientV82();
}

function pasteClipboardToGuildCardV82() {
  if (typeof Client === 'undefined' || !Client || !Client.window) return;
  try {
    var $GLFW = Java.loadClass('org.lwjgl.glfw.GLFW');
    var clip = $GLFW.glfwGetClipboardString(Client.window.window);
    if (clip) {
      var cleanedClip = String(clip).replace(/[\x00-\x1F\x7F§]/g, '').trim().slice(0, 16);
      if (cleanedClip.length > 0) {
        frankClientUiState.inputText = cleanedClip;
        frankClientUiState.serverErrorMsg = '';
        renderGuildCardClientV82();
      }
    }
  } catch (e) {}
}

function submitGuildCardNameFromGuiV82() {
  if(frankClientUiState.pending)return {ok:false,reason:'pending'};
  var check = validateGuildCardNameClientV82(frankClientUiState.inputText);
  if (!check.valid) {
    frankClientUiState.serverErrorMsg = check.message.replace(/^⚠\s*/, '');
    renderGuildCardClientV82();
    return { ok: false, reason: check.reason };
  }
  if (typeof Client !== 'undefined' && Client && Client.player && typeof Client.player.sendData === 'function') {
    frankClientUiState.pending=true;
    renderGuildCardClientV82();
    Client.player.sendData('f_rank_days:submit_guild_card_name', { name: check.cleaned, session: frankClientUiState.session || '' });
  }
  return { ok: true, submitted: check.cleaned };
}

function cancelAndCloseGuildCardGuiV82(notifyServer) {
  frankClientUiState.open = false;
  frankClientUiState.mode = null;
  frankClientUiState.autoCloseTick = 0;
  frankClientUiState.hitboxes = [];
  clearGuildCardClientPaintV82();
  FRankModalHostV82.closeNonChatModal('GUILD_CARD');
  if (notifyServer && typeof Client !== 'undefined' && Client && Client.player && typeof Client.player.sendData === 'function') {
    Client.player.sendData('f_rank_days:close_guild_card_ui', {});
  }
}

function ensureGlfwCharListenerV82() {
  if (frankClientUiState.charHookInstalled) return;
  if (typeof Client === 'undefined' || !Client || !Client.window || !Client.window.window) return;
  try {
    var $GLFW = Java.loadClass('org.lwjgl.glfw.GLFW');
    var $GLFWCharCallbackI = Java.loadClass('org.lwjgl.glfw.GLFWCharCallbackI');
    if ($GLFW && $GLFWCharCallbackI && typeof $GLFW.glfwSetCharCallback === 'function' && typeof JavaAdapter !== 'undefined') {
      var prevCb = null;
      var adapter = new JavaAdapter($GLFWCharCallbackI, {
        invoke: function (win, codepoint) {
          if (frankClientUiState.open && frankClientUiState.mode === 'INPUT') {
            appendTypedCodepointToGuildCardV82(Number(codepoint));
          } else if (prevCb && typeof prevCb.invoke === 'function') {
            prevCb.invoke(win, codepoint);
          }
        }
      });
      prevCb = $GLFW.glfwSetCharCallback(Client.window.window, adapter);
      frankClientUiState.charHookInstalled = true;
    }
  } catch (e) {}
}

NetworkEvents.dataReceived('f_rank_days:open_guild_card_ui', function (event) {
  var data = event.data || {};
  var mode = data.mode ? String(data.mode) : 'VIEW';
  frankClientUiState.open = true;
  frankClientUiState.page = 0;
  frankClientUiState.session = String(data.session || '');
  frankClientUiState.pending = false;
  frankClientUiState.mode = mode;
  frankClientUiState.openedTick = frankClientUiState.tickCounter;
  frankClientUiState.serverErrorMsg = '';
  frankClientUiState.defaultNickname = String(data.default_nickname || (typeof Client !== 'undefined' && Client && Client.player && Client.player.username) || '').slice(0, 16);
  frankClientUiState.cardData = {
    empire_header: String(data.empire_header || '아르베른 제국 통합 길드'),
    name: String(data.name || ''),
    serial: String(data.serial || 'ARB-412-00000000'),
    grade: String(data.grade || 'F'),
    ability: String(data.ability || '미등록'),
    job: String(data.job || '미등록'),
    issued_date: String(data.issued_date || '아르베른력 412년 정착기록'),
    issuer: String(data.issuer || '아르베른 통합 길드 브리온 지부')
  };

  if (mode === 'INPUT') {
    frankClientUiState.inputFocused = true;
    frankClientUiState.inputText = frankClientUiState.defaultNickname;
    frankClientUiState.autoCloseTick = 0;
    FRankModalHostV82.openNonChatModal('GUILD_CARD');
    ensureGlfwCharListenerV82();
  } else {
    frankClientUiState.inputFocused = false;
    frankClientUiState.inputText = String(data.name || frankClientUiState.inputText || '');
    frankClientUiState.autoCloseTick = mode==='STAMPED'?frankClientUiState.tickCounter + 120:0;
    if(mode!=='STAMPED')FRankModalHostV82.openNonChatModal('GUILD_CARD');
    if (mode === 'STAMPED') {
      FRankModalHostV82.closeNonChatModal('GUILD_CARD');
    }
  }
  clearGuildCardClientPaintV82();
  renderGuildCardClientV82();
});

NetworkEvents.dataReceived('f_rank_days:guild_card_validation_error', function (event) {
  var d = event.data || {};
  if (frankClientUiState.open) {
    frankClientUiState.pending = false;
    frankClientUiState.serverErrorMsg = String(d.message || '성명 입력값을 확인해 주세요.');
    renderGuildCardClientV82();
  }
});

NetworkEvents.dataReceived('f_rank_days:close_guild_card_ui', function (event) {
  cancelAndCloseGuildCardGuiV82(false);
});

if (typeof ClientEvents !== 'undefined' && ClientEvents.tick) {
  ClientEvents.tick(function (event) {
    frankClientUiState.tickCounter += 1;
    if (!frankClientUiState.open) return;

    if (
      frankClientUiState.autoCloseTick > 0 &&
      frankClientUiState.tickCounter >= frankClientUiState.autoCloseTick
    ) {
      cancelAndCloseGuildCardGuiV82(true);
      return;
    }

    if (frankClientUiState.mode === 'INPUT' && frankClientUiState.tickCounter % 10 === 0) {
      renderGuildCardClientV82();
    }

    if (typeof Client === 'undefined' || !Client || !Client.window) return;

    try {
      var $GLFW = Java.loadClass('org.lwjgl.glfw.GLFW');
      var winHandle = Client.window.window;
      if (!winHandle) return;

      // ESC(256) 취소 처리
      var escDown = typeof $GLFW.glfwGetKey === 'function' && $GLFW.glfwGetKey(winHandle, 256) === 1;
      if (escDown && !frankClientUiState.wasEscDown) {
        frankClientUiState.wasEscDown = true;
        cancelAndCloseGuildCardGuiV82(true);
        return;
      }
      frankClientUiState.wasEscDown = escDown;

      if (frankClientUiState.mode === 'INPUT') {
        // Backspace(259) 지우기 처리
        var bsDown = typeof $GLFW.glfwGetKey === 'function' && $GLFW.glfwGetKey(winHandle, 259) === 1;
        if (bsDown && !frankClientUiState.wasBackspaceDown && frankClientUiState.inputFocused) {
          frankClientUiState.inputText = frankClientUiState.inputText.slice(0, -1);
          frankClientUiState.serverErrorMsg = '';
          renderGuildCardClientV82();
        }
        frankClientUiState.wasBackspaceDown = bsDown;

        // Enter(257 / KP_ENTER 335) 확인 발급 처리
        var entDown = typeof $GLFW.glfwGetKey === 'function' && ($GLFW.glfwGetKey(winHandle, 257) === 1 || $GLFW.glfwGetKey(winHandle, 335) === 1);
        if (entDown && !frankClientUiState.wasEnterDown && frankClientUiState.inputFocused) {
          submitGuildCardNameFromGuiV82();
        }
        frankClientUiState.wasEnterDown = entDown;

        // Ctrl+V (341/345 + 86) 클립보드 한글 붙여넣기 단축키
        var ctrlDown = typeof $GLFW.glfwGetKey === 'function' && ($GLFW.glfwGetKey(winHandle, 341) === 1 || $GLFW.glfwGetKey(winHandle, 345) === 1);
        var vDown = typeof $GLFW.glfwGetKey === 'function' && $GLFW.glfwGetKey(winHandle, 86) === 1;
        var pasteCombo = ctrlDown && vDown;
        if (pasteCombo && !frankClientUiState.wasPasteShortcutDown) {
          pasteClipboardToGuildCardV82();
        }
        frankClientUiState.wasPasteShortcutDown = pasteCombo;

        // 마우스 호버 및 전용 버튼 클릭 감지
        var rawX = Client.mouseHandler ? Number(Client.mouseHandler.xpos()) : -1;
        var rawY = Client.mouseHandler ? Number(Client.mouseHandler.ypos()) : -1;
        var rawW = Number(Client.window.width || 1);
        var rawH = Number(Client.window.height || 1);
        var guiW = Number(Client.window.guiScaledWidth || 480);
        var guiH = Number(Client.window.guiScaledHeight || 270);
        var relMx = (rawX * guiW) / rawW - guiW / 2;
        var relMy = (rawY * guiH) / rawH - guiH / 2;

        var newHover = '';
        for (var i = 0; i < frankClientUiState.hitboxes.length; i++) {
          var hb = frankClientUiState.hitboxes[i];
          if (relMx >= hb.left && relMx <= hb.left + hb.w && relMy >= hb.top && relMy <= hb.top + hb.h) {
            newHover = hb.id;
            break;
          }
        }
        if (newHover !== frankClientUiState.hoveredBtn) {
          frankClientUiState.hoveredBtn = newHover;
          renderGuildCardClientV82();
        }

        var leftDown = typeof $GLFW.glfwGetMouseButton === 'function' && $GLFW.glfwGetMouseButton(winHandle, 0) === 1;
        if (leftDown && !frankClientUiState.wasLeftDown && !F96UI.pointerBlocked()) {
          if (newHover === 'FOCUS_INPUT') {
            frankClientUiState.inputFocused = true;
            renderGuildCardClientV82();
          } else if (newHover === 'FILL_NICK') {
            frankClientUiState.inputText = frankClientUiState.defaultNickname;
            frankClientUiState.serverErrorMsg = '';
            renderGuildCardClientV82();
          } else if (newHover === 'PASTE_CLIP') {
            pasteClipboardToGuildCardV82();
          } else if (newHover === 'CONFIRM_ISSUE') {
            submitGuildCardNameFromGuiV82();
          } else if (newHover === 'CARD_PREV' || newHover === 'CARD_NEXT') {
            setGuildCardPageV96(frankClientUiState.page + (newHover === 'CARD_NEXT' ? 1 : -1));
          } else if (newHover === 'CANCEL_CLOSE') {
            cancelAndCloseGuildCardGuiV82(true);
          }
        }
        frankClientUiState.wasLeftDown = leftDown;
      }
    } catch (err) {}
  });
}

if (typeof global !== 'undefined') {
  global.FRankGuildCardClientV82 = {
    state: frankClientUiState,
    validateName: validateGuildCardNameClientV82,
    computeLayout: computeGuildCardLayoutV82,
    typeTextForTest: function (str) {
      var s = String(str || '');
      for (var i = 0; i < s.length; i++) {
        appendTypedCodepointToGuildCardV82(s.codePointAt(i));
      }
    },
    setInputText: function (str) {
      frankClientUiState.inputText = String(str === null || str === undefined ? '' : str);
      frankClientUiState.serverErrorMsg = '';
      renderGuildCardClientV82();
    },
    clickConfirm: submitGuildCardNameFromGuiV82,
    clickCancel: function () { cancelAndCloseGuildCardGuiV82(true); }
  };
}
