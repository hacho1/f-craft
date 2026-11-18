// 《F-Craft》 KubeJS 6 Client Script - v8.2 Nau's Unified Enhancement (+5%p) & Safe Slot-Separated Inheritance Tabbed GUI
// 파일 경로: kubejs/client_scripts/03_safe_inheritance_gui_client.js
// 핵심 설계 (Phase 4 반영):
// 1. 하나의 통일된 Kenney 단조창(nau_forge_panel.png) 안에서 [탭 1: 무기 단련·강화]와 [탭 2: 안전 강화 계승]을 전환할 수 있습니다.
// 2. [탭 1: 무기 단련·강화]:
//    - 대상 무기, 현재 +수치 ➔ 다음 +수치, 강화 수단별 확정 성공률(모루·강화망치 95/90/80/70/65/60% vs 나우 숙련 +5%p 100/95/85/75/70/65%),
//      실패 시 결과(-1 감소, 무기 파괴 0%), 필요 재료(보유/필요), 3단 화폐 수수료(골드·실버·동화), [⚒ 강화 실행] 버튼을 명확히 표시합니다.
// 3. [탭 2: 안전 강화 계승]:
//    - 좌측 붉은 슬롯(소멸될 +3 이상 원본 무기, 경고 표시)과 우측 푸른 슬롯(동일 계열 +0 대상 무기, 인챈트·내구도 보존),
//      서버 정본 80% 계승 수치 미리보기, [1단계: 원본 소멸 동의] 체크 + [2단계: 안전 계승 확정] 2중 안전장치를 제공합니다.
// 4. 비채팅 모달 호스트(FRankModalHostV82)를 사용하여 채팅창이 절대 겹치지 않습니다.

var frankSafeInheritGui = {
  open: false,
  activeTab: 'INHERIT', // 'ENHANCE' | 'INHERIT'
  enhanceMethod: 'NAU',
  sessionToken: '',
  walletText: '0동화',
  totalCopper: 0,
  enhanceCandidates: [],
  selectedEnhIdx: 0,
  enhancePage: 0,
  pending: false,
  sources: [],
  targets: [],
  selectedSrcIdx: 0,
  selectedDstIdx: -1,
  consentChecked: false,
  statusMsg: '',
  statusColor: '#FDE68A',
  wasLeftDown: false,
  openedTick: 0,
  tick: 0,
  hitboxes: []
};

// Painter rejects remove-only entries for IDs that do not exist yet. Track
// queued creates only to finish a close after their native object is installed.
var forgePaintLifecycleV10 = { owner: '', queued: {}, pending: {} };
function forgePaintOwnerV10() {
  var owner = Client.player ? String(Client.player.uuid || '') : '';
  if (forgePaintLifecycleV10.owner !== owner) forgePaintLifecycleV10 = { owner: owner, queued: {}, pending: {} };
  return owner;
}
function paintForgeObjectsV10(objects) {
  if (!Client.player || typeof Client.player.paint !== 'function') return;
  forgePaintOwnerV10();
  var painter = Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE, output = {};
  for (var id in objects) {
    var object = objects[id];
    if (object && object.remove === true) {
      if (painter.getObject(id) != null) {
        output[id] = object; delete forgePaintLifecycleV10.queued[id]; delete forgePaintLifecycleV10.pending[id];
      } else if (forgePaintLifecycleV10.queued[id]) forgePaintLifecycleV10.pending[id] = true;
    } else {
      output[id] = object; forgePaintLifecycleV10.queued[id] = true; delete forgePaintLifecycleV10.pending[id];
    }
  }
  if (Object.keys(output).length) Client.player.paint(output);
}
function flushForgePaintRemovalsV10() {
  if (!forgePaintOwnerV10() || !Object.keys(forgePaintLifecycleV10.pending).length) return;
  var painter = Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE, removals = {};
  for (var id in forgePaintLifecycleV10.pending) if (painter.getObject(id) != null) removals[id] = { remove: true };
  if (Object.keys(removals).length) paintForgeObjectsV10(removals);
}

function forgePacketListV91(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  var count = typeof value.length === 'number' ? Number(value.length) : (typeof value.size === 'function' ? Number(value.size()) : 0);
  var result = [];
  for (var i = 0; i < count; i++) result.push(typeof value.get === 'function' ? value.get(i) : value[i]);
  return result;
}

function forgeFlagV91(value) { return value === true || String(value) === 'true' || String(value) === '1' || String(value) === '1b'; }

function forgeTextWidthV91(text) {
  try { if (Client.font && typeof Client.font.width === 'function') return Number(Client.font.width(String(text))); } catch (e) {}
  var size = 0, chars = String(text).split('');
  for (var i = 0; i < chars.length; i++) size += chars[i].charCodeAt(0) > 255 ? 9 : 6;
  return size;
}

function forgeClipV91(text, maxWidth, scale) {
  var value = String(text || '');
  if (forgeTextWidthV91(value) * scale <= maxWidth) return value;
  while (value.length && forgeTextWidthV91(value + '…') * scale > maxWidth) value = value.slice(0, -1);
  return value + '…';
}

function forgeWeaponNameV91(item) {
  if (!item) return '';
  try { var name = Item.of(String(item.item_id)).displayName; if (name && typeof name.getString === 'function') return String(name.getString()); } catch (e) {}
  return String(item.short_name || item.item_id || '무기');
}

function getFilteredTargetsForSelectedSource() {
  if (!frankSafeInheritGui.sources.length || frankSafeInheritGui.selectedSrcIdx < 0) return [];
  var src = frankSafeInheritGui.sources[frankSafeInheritGui.selectedSrcIdx];
  if (!src) return [];
  var out = [];
  for (var i = 0; i < frankSafeInheritGui.targets.length; i++) {
    var t = frankSafeInheritGui.targets[i];
    var srcTier = Number(src.inheritance_tier), dstTier = Number(t.inheritance_tier);
    if (Number(src.level) >= 3 && Number(t.level) === 0 && isFinite(srcTier) && isFinite(dstTier) &&
        Math.floor(srcTier) === srcTier && Math.floor(dstTier) === dstTier && srcTier >= 0 && dstTier > srcTier &&
        String(t.family) === String(src.family) && String(t.slot_ref) !== String(src.slot_ref)) {
      out.push(t);
    }
  }
  return out;
}

function requestHeirloomNameForSelectedV10() {
  if (!frankSafeInheritGui.open || frankSafeInheritGui.activeTab !== 'ENHANCE' || frankSafeInheritGui.enhanceMethod !== 'NAU' || frankSafeInheritGui.pending) return false;
  var selected = frankSafeInheritGui.enhanceCandidates[frankSafeInheritGui.selectedEnhIdx];
  if (!selected || !frankSafeInheritGui.sessionToken || !Client.player || !Client.player.sendData) return false;
  Client.player.sendData('f_rank_days:heirloom_name_open_request_v10', { slot: String(selected.slot_ref), session_token: frankSafeInheritGui.sessionToken });
  return true;
}

function closeSafeInheritanceGuiClient() {
  if (frankSafeInheritGui.open && frankSafeInheritGui.sessionToken && typeof Client !== 'undefined' && Client.player && Client.player.sendData) {
    Client.player.sendData('f_rank_days:close_nau_forge_gui', { session_token: frankSafeInheritGui.sessionToken });
  }
  frankSafeInheritGui.open = false;
  frankSafeInheritGui.pending = false;
  frankSafeInheritGui.hitboxes = [];
  if (typeof FRankModalHostV82 !== 'undefined') {
    FRankModalHostV82.closeNonChatModal('NAU_FORGE_GUI');
  }
  if (typeof Client !== 'undefined' && Client && Client.player && typeof Client.player.paint === 'function') {
    var clean = {
      finh_bg: { remove: true },
      finh_panel: { remove: true },
      finh_title: { remove: true },
      finh_wallet: { remove: true },
      finh_tab_enh_bg: { remove: true },
      finh_tab_enh_txt: { remove: true },
      finh_tab_inh_bg: { remove: true },
      finh_tab_inh_txt: { remove: true },
      finh_left_hdr: { remove: true },
      finh_right_hdr: { remove: true },
      finh_preview_box: { remove: true },
      finh_preview_l1: { remove: true },
      finh_preview_l2: { remove: true },
      finh_enh_detail_box: { remove: true },
      finh_enh_d0: { remove: true },
      finh_enh_d1: { remove: true },
      finh_enh_d2: { remove: true },
      finh_enh_d3: { remove: true },
      finh_enh_d4: { remove: true },
      finh_enh_d5: { remove: true },
      finh_enh_d6: { remove: true },
      finh_page_prev: { remove: true }, finh_page_prev_text: { remove: true },
      finh_page_next: { remove: true }, finh_page_next_text: { remove: true },
      finh_page_label: { remove: true },
      finh_name_btn: { remove: true }, finh_name_text: { remove: true },
      finh_consent_btn: { remove: true },
      finh_consent_txt: { remove: true },
      finh_exec_btn: { remove: true },
      finh_exec_txt: { remove: true },
      finh_close_btn: { remove: true },
      finh_close_txt: { remove: true }
    };
    for (var i = 0; i < 4; i++) {
      clean['finh_src_box_' + i] = { remove: true };
      clean['finh_src_txt_' + i] = { remove: true };
      clean['finh_dst_box_' + i] = { remove: true };
      clean['finh_dst_txt_' + i] = { remove: true };
    }
    paintForgeObjectsV10(clean);
  }
}

function renderSafeInheritanceGuiClient() {
  if (!frankSafeInheritGui.open) return;
  if (typeof Client === 'undefined' || !Client || !Client.player || typeof Client.player.paint !== 'function') return;

  var guiW = Number((Client.window && Client.window.guiScaledWidth) || 480);
  var guiH = Number((Client.window && Client.window.guiScaledHeight) || 270);
  var pw = Math.max(280, Math.min(360, guiW - 12)), ph = 220;
  var fitScale = Math.min(1, (guiW - 16) / pw, (guiH - 16) / ph);
  var halfW = Math.floor(pw / 2);
  var halfH = Math.floor(ph / 2);

  frankSafeInheritGui.hitboxes = [];
  var isEnhTab = frankSafeInheritGui.activeTab === 'ENHANCE';

  var p = {
    finh_bg: { type: 'rectangle', x: 0, y: 0, z: 70, w: '$screenW', h: '$screenH', color: '#99080A10', draw: 'always', visible: true },
    finh_panel: {
      type: 'rectangle', x: 0, y: 0, z: 71, w: pw, h: ph, alignX: 'center', alignY: 'center',
      texture: 'f_rank_days:textures/gui/v8_2/nau_forge_panel.png', draw: 'always', visible: true
    },
    finh_title: {
      type: 'text', x: -halfW + 12, y: -halfH + 10, z: 72, alignX: 'center', alignY: 'center', shadow: true, scale: 0.86,
      text: '나우의 대장간', color: '#FFE49E', draw: 'always', visible: true
    },
    finh_wallet: {
      type: 'text', x: halfW - 102, y: -halfH + 10, z: 72, alignX: 'center', alignY: 'center', shadow: true, scale: 0.75,
      text: '화폐: ' + frankSafeInheritGui.walletText, color: '#A5F3FC', draw: 'always', visible: true
    }
  };

  // 상단 탭 버튼 2개 (무기 강화 vs 안전 강화 계승)
  var tabY = -halfH + 26;
  var tabW = 114;
  var tab1Left = -halfW + 12;
  var tab2Left = tab1Left + tabW + 6;

  p.finh_tab_enh_bg = {
    type: 'rectangle', x: tab1Left + Math.floor(tabW / 2), y: tabY, z: 72, w: tabW, h: 16, alignX: 'center', alignY: 'center',
    texture: isEnhTab ? 'f_rank_days:textures/gui/v8_2/btn_gold_hover.png' : 'f_rank_days:textures/gui/v8_2/btn_gold_normal.png',
    draw: 'always', visible: true
  };
  p.finh_tab_enh_txt = {
    type: 'text', x: tab1Left + Math.floor(tabW / 2), y: tabY - 3, z: 73, alignX: 'center', alignY: 'center', centered: true, scale: 0.72, shadow: !isEnhTab,
    text: '무기 강화', color: isEnhTab ? '#2B1B0E' : '#F6EAD2', draw: 'always', visible: true
  };
  frankSafeInheritGui.hitboxes.push({ type: 'SWITCH_TAB', tab: 'ENHANCE', left: tab1Left, top: tabY - 8, w: tabW, h: 16 });

  p.finh_tab_inh_bg = {
    type: 'rectangle', x: tab2Left + Math.floor(tabW / 2), y: tabY, z: 72, w: tabW, h: 16, alignX: 'center', alignY: 'center',
    texture: !isEnhTab ? 'f_rank_days:textures/gui/v8_2/btn_gold_hover.png' : 'f_rank_days:textures/gui/v8_2/btn_gold_normal.png',
    draw: 'always', visible: true
  };
  p.finh_tab_inh_txt = {
    type: 'text', x: tab2Left + Math.floor(tabW / 2), y: tabY - 3, z: 73, alignX: 'center', alignY: 'center', centered: true, scale: 0.72, shadow: isEnhTab,
    text: '안전 계승', color: !isEnhTab ? '#2B1B0E' : '#F6EAD2', draw: 'always', visible: true
  };
  frankSafeInheritGui.hitboxes.push({ type: 'SWITCH_TAB', tab: 'INHERIT', left: tab2Left, top: tabY - 8, w: tabW, h: 16 });

  var colW = Math.floor((pw - 30) / 2);
  var btnY = halfH - 18;

  if (isEnhTab) {
    // =========================================================================
    // [탭 1] 무기 단련·숙련 강화 화면
    // =========================================================================
    if (frankSafeInheritGui.selectedEnhIdx >= frankSafeInheritGui.enhanceCandidates.length) {
      frankSafeInheritGui.selectedEnhIdx = 0;
    }
    var selWpn = frankSafeInheritGui.enhanceCandidates[frankSafeInheritGui.selectedEnhIdx] || null;

    p.finh_left_hdr = {
      type: 'text', x: -halfW + 12, y: -halfH + 40, z: 72, alignX: 'center', alignY: 'center', shadow: true, scale: 0.74,
      text: '강화할 무기', color: '#FDE68A', draw: 'always', visible: true
    };
    p.finh_right_hdr = {
      type: 'text', x: 6, y: -halfH + 40, z: 72, alignX: 'center', alignY: 'center', shadow: true, scale: 0.74,
      text: '확률 · 재료 · 수수료', color: '#93C5FD', draw: 'always', visible: true
    };

    var pageCount = Math.max(1, Math.ceil(frankSafeInheritGui.enhanceCandidates.length / 4));
    frankSafeInheritGui.enhancePage = Math.max(0, Math.min(pageCount - 1, frankSafeInheritGui.enhancePage));
    var pageStart = frankSafeInheritGui.enhancePage * 4;
    for (var ei = 0; ei < 4; ei++) {
      var erowY = -halfH + 58 + ei * 20;
      var candidateIndex = pageStart + ei;
      var cand = frankSafeInheritGui.enhanceCandidates[candidateIndex] || null;
      var cActive = candidateIndex === frankSafeInheritGui.selectedEnhIdx && Boolean(cand);
      var cBoxX = -halfW + 12 + Math.floor(colW / 2);
      p['finh_src_box_' + ei] = {
        type: 'rectangle', x: cBoxX, y: erowY, z: 72, w: colW, h: 17, alignX: 'center', alignY: 'center',
        texture: cand ? (cActive ? 'f_rank_days:textures/gui/v8_2/btn_gold_hover.png' : 'f_rank_days:textures/gui/v8_2/slot_target_azure.png') : 'f_rank_days:textures/gui/v8_2/btn_gold_disabled.png',
        draw: 'always', visible: true
      };
      p['finh_src_txt_' + ei] = {
        type: 'text', x: -halfW + 16, y: erowY - 3, z: 73, alignX: 'center', alignY: 'center', scale: 0.70, shadow: !cActive,
        text: cand ? forgeClipV91('[+' + cand.current_level + '] ' + forgeWeaponNameV91(cand) + ' · ' + cand.slot_label, colW - 8, 0.70) : (ei === 0 ? '강화 가능한 무기 없음' : '-'),
        color: cand ? (cActive ? '#1F1610' : '#EFF6FF') : '#64748B', draw: 'always', visible: true
      };
      p['finh_dst_box_' + ei] = { type: 'rectangle', x: 0, y: 0, z: 72, w: 1, h: 1, visible: false, draw: 'always' };
      p['finh_dst_txt_' + ei] = { type: 'text', x: 0, y: 0, z: 73, text: '', visible: false, draw: 'always' };
      if (cand) {
        frankSafeInheritGui.hitboxes.push({ type: 'SELECT_ENH_WPN', index: candidateIndex, left: -halfW + 12, top: erowY - 8, w: colW, h: 17 });
      }
    }
    var pageY = -halfH + 139;
    for (var side = 0; side < 2; side++) {
      var name = side === 0 ? 'prev' : 'next', step = side === 0 ? -1 : 1;
      var pageLeft = side === 0 ? -halfW + 12 : -halfW + 12 + colW - 42;
      var pageEnabled = frankSafeInheritGui.enhancePage + step >= 0 && frankSafeInheritGui.enhancePage + step < pageCount;
      p['finh_page_' + name] = { type: 'rectangle', x: pageLeft + 21, y: pageY, w: 42, h: 14, z: 72, alignX: 'center', alignY: 'center',
        texture: pageEnabled ? 'f_rank_days:textures/gui/v8_2/btn_gold_normal.png' : 'f_rank_days:textures/gui/v8_2/btn_gold_disabled.png', draw: 'always', visible: true };
      p['finh_page_' + name + '_text'] = { type: 'text', x: pageLeft + 21, y: pageY - 3, z: 73, centered: true, scale: 0.68,
        alignX: 'center', alignY: 'center', text: side === 0 ? '이전' : '다음', color: '#F6EAD2', draw: 'always', visible: true };
      if (pageEnabled) frankSafeInheritGui.hitboxes.push({ type: 'ENH_PAGE', step: step, left: pageLeft, top: pageY - 7, w: 42, h: 14 });
    }
    p.finh_page_label = { type: 'text', x: -halfW + 12 + colW / 2, y: pageY - 3, z: 73, centered: true, scale: 0.65,
      alignX: 'center', alignY: 'center', text: (frankSafeInheritGui.enhancePage + 1) + ' / ' + pageCount, color: '#F6EAD2', draw: 'always', visible: true };

    var nameEnabled = Boolean(selWpn && frankSafeInheritGui.enhanceMethod === 'NAU' && !frankSafeInheritGui.pending);
    p.finh_name_btn = { type: 'rectangle', x: 6 + colW / 2, y: pageY, w: colW, h: 14, z: 72, alignX: 'center', alignY: 'center', texture: nameEnabled ? 'f_rank_days:textures/gui/v8_2/btn_gold_normal.png' : 'f_rank_days:textures/gui/v8_2/btn_gold_disabled.png', draw: 'always', visible: true };
    p.finh_name_text = { type: 'text', x: 6 + colW / 2, y: pageY - 3, z: 73, centered: true, scale: 0.68, alignX: 'center', alignY: 'center', text: '무기 별칭', color: '#F6EAD2', draw: 'always', visible: true };
    if (nameEnabled) frankSafeInheritGui.hitboxes.push({ type: 'OPEN_HEIRLOOM_NAME', left: 6, top: pageY - 7, w: colW, h: 14 });

    var detLeft = 6;
    p.finh_enh_detail_box = {
      type: 'rectangle', x: detLeft + Math.floor(colW / 2), y: -halfH + 88, z: 72, w: colW, h: 78,
      alignX: 'center', alignY: 'center', color: '#CC111827', draw: 'always', visible: true
    };

    var isMax99 = selWpn && selWpn.current_level >= 99;
    var canEnh = Boolean(selWpn && !isMax99 && forgeFlagV91(selWpn.can_afford_all) && !frankSafeInheritGui.pending);
    var dLines = selWpn
      ? (isMax99
        ? [
            '무기: ' + forgeWeaponNameV91(selWpn),
            '단계: ★ [+99 최종 초월 완료]',
            '상태: 더 이상 강화할 수 없습니다.',
            '보너스 공격력: +' + selWpn.bonus_damage,
            '외형: +99 최종 초월 외형 적용 중'
          ]
        : [
            '+' + selWpn.current_level + ' → 성공 +' + selWpn.next_level + ' / 실패 +' + selWpn.fail_level,
            '확률: ' + selWpn.rate_pct_label,
            '실패해도 무기는 파괴되지 않습니다.'
          ].concat(String(selWpn.materials_summary || '').split(', ').map(function (m) { return '재료: ' + m; }), ['수수료: ' + selWpn.fee_formatted]))
      : ['강화할 무기를 인벤토리에 지닌 뒤', '좌측 목록에서 선택해 주세요.', '', '', ''];

    for (var dl = 0; dl < 7; dl++) {
      p['finh_enh_d' + dl] = {
        type: 'text', x: detLeft + 6, y: -halfH + 55 + dl * 10, z: 73, alignX: 'center', alignY: 'center', scale: 0.68, shadow: true,
        text: forgeClipV91(dLines[dl] || '', colW - 12, 0.68), color: dl === 1 ? '#FDE047' : (dl >= 3 && selWpn && !forgeFlagV91(selWpn.materials_ok) ? '#FCA5A5' : '#E2E8F0'),
        draw: 'always', visible: true
      };
    }

    var prevY1 = halfH - 46;
    p.finh_preview_box = { type: 'rectangle', x: 0, y: prevY1, z: 72, w: pw - 24, h: 24, alignX: 'center', alignY: 'center', color: '#CC0F172A', draw: 'always', visible: true };
    p.finh_preview_l1 = {
      type: 'text', x: -halfW + 18, y: prevY1 - 4, z: 73, alignX: 'center', alignY: 'center', scale: 0.72, shadow: true,
      text: forgeClipV91(frankSafeInheritGui.statusMsg || (selWpn ? ('선택: ' + forgeWeaponNameV91(selWpn) + ' · ' + selWpn.next_visual_label) : '검·도끼 등 강화할 무기를 인벤토리에 넣어 주세요.'), pw - 36, 0.72),
      color: frankSafeInheritGui.statusColor || '#FDE68A', draw: 'always', visible: true
    };
    p.finh_preview_l2 = { type: 'text', x: 0, y: 0, z: 73, text: '', visible: false, draw: 'always' };
    p.finh_consent_btn = { type: 'rectangle', x: 0, y: 0, z: 72, w: 1, h: 1, visible: false, draw: 'always' };
    p.finh_consent_txt = { type: 'text', x: 0, y: 0, z: 73, text: '', visible: false, draw: 'always' };

    var enhBtnLeft = -halfW + 12;
    var enhBtnW = pw - 104;
    p.finh_exec_btn = {
      type: 'rectangle', x: enhBtnLeft + Math.floor(enhBtnW / 2), y: btnY, z: 72, w: enhBtnW, h: 20, alignX: 'center', alignY: 'center',
      texture: canEnh ? 'f_rank_days:textures/gui/v8_2/btn_confirm_green.png' : 'f_rank_days:textures/gui/v8_2/btn_gold_disabled.png',
      draw: 'always', visible: true
    };
    p.finh_exec_txt = {
      type: 'text', x: enhBtnLeft + Math.floor(enhBtnW / 2), y: btnY - 3, z: 73, alignX: 'center', alignY: 'center', centered: true, scale: 0.78, shadow: canEnh,
      text: frankSafeInheritGui.pending ? '처리 중…' : (canEnh ? (frankSafeInheritGui.enhanceMethod === 'NAU' ? '나우 숙련 강화 실행' : '기본 강화 실행') : (!selWpn ? '강화할 무기 없음' : (isMax99 ? '최고 단계(+99)' : '재료 또는 수수료 부족'))),
      color: canEnh ? '#FEF3C7' : '#9CA3AF', draw: 'always', visible: true
    };
    if (canEnh) {
      frankSafeInheritGui.hitboxes.push({ type: 'EXEC_ENHANCE', left: enhBtnLeft, top: btnY - 10, w: enhBtnW, h: 20 });
    }
  } else {
    // =========================================================================
    // [탭 2] 슬롯 분리형 안전 강화 계승 화면
    // =========================================================================
    p.finh_name_btn = { remove: true }; p.finh_name_text = { remove: true };
    p.finh_enh_detail_box = { type: 'rectangle', x: 0, y: 0, z: 72, w: 1, h: 1, visible: false, draw: 'always' };
    for (var hd = 0; hd < 7; hd++) {
      p['finh_enh_d' + hd] = { type: 'text', x: 0, y: 0, z: 73, text: '', visible: false, draw: 'always' };
    }
    var pageObjects = ['finh_page_prev', 'finh_page_prev_text', 'finh_page_next', 'finh_page_next_text', 'finh_page_label'];
    for (var po = 0; po < pageObjects.length; po++) p[pageObjects[po]] = { remove: true };

    var filteredTargets = getFilteredTargetsForSelectedSource();
    if (frankSafeInheritGui.selectedDstIdx >= filteredTargets.length) {
      frankSafeInheritGui.selectedDstIdx = filteredTargets.length > 0 ? 0 : -1;
    } else if (frankSafeInheritGui.selectedDstIdx < 0 && filteredTargets.length > 0) {
      frankSafeInheritGui.selectedDstIdx = 0;
    }

    var selSrc = frankSafeInheritGui.sources[frankSafeInheritGui.selectedSrcIdx] || null;
    var selDst = frankSafeInheritGui.selectedDstIdx >= 0 ? filteredTargets[frankSafeInheritGui.selectedDstIdx] : null;
    var inheritanceAffordable = selSrc && frankSafeInheritGui.totalCopper >= Number(selSrc.fee_copper || 0);
    var canExecute = Boolean(selSrc && selDst && frankSafeInheritGui.consentChecked && inheritanceAffordable && !frankSafeInheritGui.pending);

    p.finh_left_hdr = {
      type: 'text', x: -halfW + 12, y: -halfH + 40, z: 72, alignX: 'center', alignY: 'center', shadow: true, scale: 0.74,
      text: '① 소멸될 원본 무기 (+3 이상)', color: '#FCA5A5', draw: 'always', visible: true
    };
    p.finh_right_hdr = {
      type: 'text', x: 8, y: -halfH + 40, z: 72, alignX: 'center', alignY: 'center', shadow: true, scale: 0.74,
      text: '② 같은 계열 상위 +0 장비', color: '#93C5FD', draw: 'always', visible: true
    };

    for (var i = 0; i < 4; i++) {
      var rowY = -halfH + 58 + i * 19;
      var sItem = frankSafeInheritGui.sources[i] || null;
      var sActive = i === frankSafeInheritGui.selectedSrcIdx && Boolean(sItem);
      var sBoxX = -halfW + 12 + Math.floor(colW / 2);
      p['finh_src_box_' + i] = {
        type: 'rectangle', x: sBoxX, y: rowY, z: 72, w: colW, h: 17, alignX: 'center', alignY: 'center',
        texture: sItem ? (sActive ? 'f_rank_days:textures/gui/v8_2/btn_gold_hover.png' : 'f_rank_days:textures/gui/v8_2/slot_source_crimson.png') : 'f_rank_days:textures/gui/v8_2/btn_gold_disabled.png',
        draw: 'always', visible: true
      };
      p['finh_src_txt_' + i] = {
        type: 'text', x: -halfW + 16, y: rowY - 3, z: 73, alignX: 'center', alignY: 'center', scale: 0.70, shadow: !sActive,
        text: sItem ? forgeClipV91('[+' + sItem.level + '] ' + forgeWeaponNameV91(sItem) + ' · ' + sItem.slot_label, colW - 8, 0.70) : (i === 0 ? '보유한 +3 이상 무기 없음' : '-'),
        color: sItem ? (sActive ? '#2B1B0E' : '#FEE2E2') : '#64748B', draw: 'always', visible: true
      };
      if (sItem) {
        frankSafeInheritGui.hitboxes.push({ type: 'SELECT_SRC', index: i, left: -halfW + 12, top: rowY - 8, w: colW, h: 17 });
      }

      var tItem = filteredTargets[i] || null;
      var tActive = i === frankSafeInheritGui.selectedDstIdx && Boolean(tItem);
      var tLeft = 8;
      var tBoxX = tLeft + Math.floor(colW / 2);
      p['finh_dst_box_' + i] = {
        type: 'rectangle', x: tBoxX, y: rowY, z: 72, w: colW, h: 17, alignX: 'center', alignY: 'center',
        texture: tItem ? (tActive ? 'f_rank_days:textures/gui/v8_2/btn_gold_hover.png' : 'f_rank_days:textures/gui/v8_2/slot_target_azure.png') : 'f_rank_days:textures/gui/v8_2/btn_gold_disabled.png',
        draw: 'always', visible: true
      };
      p['finh_dst_txt_' + i] = {
        type: 'text', x: tLeft + 4, y: rowY - 3, z: 73, alignX: 'center', alignY: 'center', scale: 0.70, shadow: !tActive,
        text: tItem ? forgeClipV91('[+0] ' + forgeWeaponNameV91(tItem) + ' · ' + tItem.slot_label, colW - 8, 0.70) : (i === 0 ? '상위 계열 +0 장비 없음' : '-'),
        color: tItem ? (tActive ? '#2B1B0E' : '#DBEAFE') : '#64748B', draw: 'always', visible: true
      };
      if (tItem) {
        frankSafeInheritGui.hitboxes.push({ type: 'SELECT_DST', index: i, left: tLeft, top: rowY - 8, w: colW, h: 17 });
      }
    }

    var prevY = halfH - 50;
    p.finh_preview_box = { type: 'rectangle', x: 0, y: prevY, z: 72, w: pw - 24, h: 30, alignX: 'center', alignY: 'center', color: '#CC111827', draw: 'always', visible: true };
    var line1 = frankSafeInheritGui.statusMsg
      ? frankSafeInheritGui.statusMsg
      : (selSrc && selDst
        ? ('원본 +' + selSrc.level + ' ' + forgeWeaponNameV91(selSrc) + ' → +' + selSrc.inherited_level + ' ' + forgeWeaponNameV91(selDst))
        : '+3 이상 원본과 같은 계열의 상위 +0 장비를 선택하세요.');
    var line2 = selSrc && selDst
      ? ('수수료: ' + selSrc.fee_formatted + ' · 원본은 영구 소멸, 대상 인챈트·내구도 유지')
      : '강화 80%를 내림 전수합니다. 원본 소멸 · 가보 역사 보존';

    p.finh_preview_l1 = { type: 'text', x: -halfW + 18, y: prevY - 9, z: 73, alignX: 'center', alignY: 'center', scale: 0.71, shadow: true, text: forgeClipV91(line1, pw - 36, 0.71), color: '#FDE68A', draw: 'always', visible: true };
    p.finh_preview_l2 = { type: 'text', x: -halfW + 18, y: prevY + 3, z: 73, alignX: 'center', alignY: 'center', scale: 0.68, shadow: true, text: forgeClipV91(line2, pw - 36, 0.68), color: '#FCA5A5', draw: 'always', visible: true };

    var cLeft = -halfW + 12;
    var cW = 138;
    p.finh_consent_btn = {
      type: 'rectangle', x: cLeft + Math.floor(cW / 2), y: btnY, z: 72, w: cW, h: 20, alignX: 'center', alignY: 'center',
      texture: frankSafeInheritGui.consentChecked ? 'f_rank_days:textures/gui/v8_2/btn_confirm_green.png' : 'f_rank_days:textures/gui/v8_2/btn_gold_normal.png',
      draw: 'always', visible: true
    };
    p.finh_consent_txt = {
      type: 'text', x: cLeft + 6, y: btnY - 3, z: 73, alignX: 'center', alignY: 'center', scale: 0.71, shadow: true,
      text: (frankSafeInheritGui.consentChecked ? '[✓] ' : '[ ] ') + '1단계: 원본 소멸 동의', color: '#ECFDF5', draw: 'always', visible: true
    };
    frankSafeInheritGui.hitboxes.push({ type: 'TOGGLE_CONSENT', left: cLeft, top: btnY - 10, w: cW, h: 20 });

    var eLeft = cLeft + cW + 6;
    var eW = pw - 104 - cW - 6;
    p.finh_exec_btn = {
      type: 'rectangle', x: eLeft + Math.floor(eW / 2), y: btnY, z: 72, w: eW, h: 20, alignX: 'center', alignY: 'center',
      texture: canExecute ? 'f_rank_days:textures/gui/v8_2/btn_gold_hover.png' : 'f_rank_days:textures/gui/v8_2/btn_gold_disabled.png',
      draw: 'always', visible: true
    };
    p.finh_exec_txt = {
      type: 'text', x: eLeft + Math.floor(eW / 2), y: btnY - 3, z: 73, alignX: 'center', alignY: 'center', centered: true, scale: 0.72, shadow: !canExecute,
      text: frankSafeInheritGui.pending ? '처리 중…' : (!inheritanceAffordable && selSrc ? '수수료 부족' : '2단계: 계승 실행'), color: canExecute ? '#2B1B0E' : '#9CA3AF', draw: 'always', visible: true
    };
    if (canExecute) {
      frankSafeInheritGui.hitboxes.push({ type: 'EXEC_INHERIT', left: eLeft, top: btnY - 10, w: eW, h: 20 });
    }
  }

  var xW = 74;
  var xLeft = halfW - 12 - xW;
  p.finh_close_btn = {
    type: 'rectangle', x: xLeft + Math.floor(xW / 2), y: btnY, z: 72, w: xW, h: 20, alignX: 'center', alignY: 'center',
    texture: 'f_rank_days:textures/gui/v8_2/btn_gold_normal.png', draw: 'always', visible: true
  };
  p.finh_close_txt = {
    type: 'text', x: xLeft + Math.floor(xW / 2), y: btnY - 3, z: 73, alignX: 'center', alignY: 'center', centered: true, scale: 0.72, shadow: true,
    text: '닫기[ESC]', color: '#F3F4F6', draw: 'always', visible: true
  };
  frankSafeInheritGui.hitboxes.push({ type: 'CLOSE_GUI', left: xLeft, top: btnY - 10, w: xW, h: 20 });

  // Painter centers text's measured box for alignX:center. Text coordinates
  // here are intended left edges (or explicit glyph centers), so anchor them
  // to absolute screen coordinates instead of centering their boxes again.
  for (var paintId in p) {
    var object = p[paintId];
    if (object.remove) continue;
    if (object.type === 'text') {
      object.x = guiW / 2 + Number(object.x || 0) * fitScale;
      object.y = guiH / 2 + Number(object.y || 0) * fitScale;
      object.alignX = 'left'; object.alignY = 'top';
      object.scale = Number(object.scale || 1) * fitScale;
    } else if (object.alignX === 'center') {
      object.x *= fitScale; object.y *= fitScale;
      if (typeof object.w === 'number') object.w *= fitScale;
      if (typeof object.h === 'number') object.h *= fitScale;
    }
  }
  for (var hi = 0; hi < frankSafeInheritGui.hitboxes.length; hi++) {
    var hit = frankSafeInheritGui.hitboxes[hi];
    hit.left *= fitScale; hit.top *= fitScale; hit.w *= fitScale; hit.h *= fitScale;
  }
  paintForgeObjectsV10(p);
}

function applyForgeGuiPayload(d, defaultTab) {
  frankSafeInheritGui.open = true;
  frankSafeInheritGui.activeTab = d.initial_tab ? String(d.initial_tab) : defaultTab;
  frankSafeInheritGui.enhanceMethod = d.method ? String(d.method) : 'NAU';
  frankSafeInheritGui.sessionToken = String(d.session_token || '');
  frankSafeInheritGui.walletText = String(d.wallet_formatted || '0동화');
  frankSafeInheritGui.totalCopper = Number(d.total_copper || 0);
  frankSafeInheritGui.enhanceCandidates = forgePacketListV91(d.enhance_candidates);
  frankSafeInheritGui.sources = forgePacketListV91(d.sources);
  frankSafeInheritGui.targets = forgePacketListV91(d.targets);
  frankSafeInheritGui.pending = false;
  frankSafeInheritGui.enhancePage = Math.floor(frankSafeInheritGui.selectedEnhIdx / 4);
  frankSafeInheritGui.consentChecked = false;
  frankSafeInheritGui.statusMsg = d.status_message ? String(d.status_message) : '';
  frankSafeInheritGui.statusColor = d.status_color ? String(d.status_color) : '#FDE68A';
  frankSafeInheritGui.openedTick = frankSafeInheritGui.tick;
}

NetworkEvents.dataReceived('f_rank_days:open_safe_inheritance_ui', function (event) {
  var d = event.data || {};
  frankSafeInheritGui.selectedSrcIdx = 0;
  frankSafeInheritGui.selectedDstIdx = 0;
  applyForgeGuiPayload(d, 'INHERIT');
  if (typeof FRankModalHostV82 !== 'undefined') {
    FRankModalHostV82.openNonChatModal('NAU_FORGE_GUI');
  }
  renderSafeInheritanceGuiClient();
});

NetworkEvents.dataReceived('f_rank_days:open_nau_forge_gui', function (event) {
  var d = event.data || {};
  if (!frankSafeInheritGui.open) {
    frankSafeInheritGui.selectedEnhIdx = 0;
    frankSafeInheritGui.selectedSrcIdx = 0;
    frankSafeInheritGui.selectedDstIdx = 0;
    if (typeof FRankModalHostV82 !== 'undefined') {
      FRankModalHostV82.openNonChatModal('NAU_FORGE_GUI');
    }
  }
  applyForgeGuiPayload(d, 'ENHANCE');
  renderSafeInheritanceGuiClient();
});

NetworkEvents.dataReceived('f_rank_days:safe_inheritance_result', function (event) {
  var d = event.data || {};
  if (d.ok) {
    closeSafeInheritanceGuiClient();
  } else {
    frankSafeInheritGui.pending = false;
    frankSafeInheritGui.statusMsg = String(d.message || '계승 실행 실패');
    frankSafeInheritGui.statusColor = '#FCA5A5';
    frankSafeInheritGui.consentChecked = false;
    renderSafeInheritanceGuiClient();
  }
});

NetworkEvents.dataReceived('f_rank_days:forge_gui_error', function (event) {
  frankSafeInheritGui.pending = false;
  frankSafeInheritGui.statusMsg = String((event.data || {}).message || '단조창을 다시 열어 주세요.');
  frankSafeInheritGui.statusColor = '#FCA5A5';
  renderSafeInheritanceGuiClient();
});

if (typeof ClientEvents !== 'undefined' && ClientEvents.tick) {
  ClientEvents.tick(function () {
    flushForgePaintRemovalsV10();
    frankSafeInheritGui.tick += 1;
    if (!frankSafeInheritGui.open) return;
    if (typeof Client === 'undefined' || !Client || !Client.window) return;

    var curScr = Client.screen || Client.currentScreen || null;
    if (frankSafeInheritGui.tick > frankSafeInheritGui.openedTick + 3 && !curScr) {
      closeSafeInheritanceGuiClient();
      return;
    }

    try {
      var $GLFW = Java.loadClass('org.lwjgl.glfw.GLFW');
      var winHandle = Client.window.window;
      if (typeof $GLFW.glfwGetKey === 'function' && $GLFW.glfwGetKey(winHandle, 256) === 1) {
        closeSafeInheritanceGuiClient();
        return;
      }

      var rawX = Client.mouseHandler ? Number(Client.mouseHandler.xpos()) : -1;
      var rawY = Client.mouseHandler ? Number(Client.mouseHandler.ypos()) : -1;
      var rawW = Number(Client.window.width || 1);
      var rawH = Number(Client.window.height || 1);
      var guiW = Number(Client.window.guiScaledWidth || 480);
      var guiH = Number(Client.window.guiScaledHeight || 270);
      var relMx = (rawX * guiW) / rawW - guiW / 2;
      var relMy = (rawY * guiH) / rawH - guiH / 2;

      var leftDown = typeof $GLFW.glfwGetMouseButton === 'function' && $GLFW.glfwGetMouseButton(winHandle, 0) === 1;
      if (leftDown && !frankSafeInheritGui.wasLeftDown && !F96UI.pointerBlocked()) {
        for (var i = 0; i < frankSafeInheritGui.hitboxes.length; i++) {
          var hb = frankSafeInheritGui.hitboxes[i];
          if (relMx >= hb.left && relMx <= hb.left + hb.w && relMy >= hb.top && relMy <= hb.top + hb.h) {
            if (frankSafeInheritGui.pending && hb.type !== 'CLOSE_GUI') break;
            if (hb.type === 'SWITCH_TAB') {
              frankSafeInheritGui.activeTab = hb.tab;
              frankSafeInheritGui.statusMsg = '';
              renderSafeInheritanceGuiClient();
            } else if (hb.type === 'SELECT_ENH_WPN') {
              frankSafeInheritGui.selectedEnhIdx = hb.index;
              frankSafeInheritGui.statusMsg = '';
              renderSafeInheritanceGuiClient();
            } else if (hb.type === 'ENH_PAGE') {
              frankSafeInheritGui.enhancePage += hb.step;
              frankSafeInheritGui.selectedEnhIdx = frankSafeInheritGui.enhancePage * 4;
              frankSafeInheritGui.statusMsg = '';
              renderSafeInheritanceGuiClient();
            } else if (hb.type === 'OPEN_HEIRLOOM_NAME') {
              requestHeirloomNameForSelectedV10();
            } else if (hb.type === 'EXEC_ENHANCE') {
              var selW = frankSafeInheritGui.enhanceCandidates[frankSafeInheritGui.selectedEnhIdx];
              if (selW && Client.player && Client.player.sendData) {
                frankSafeInheritGui.pending = true;
                Client.player.sendData('f_rank_days:execute_enhance_gui', {
                  session_token: frankSafeInheritGui.sessionToken,
                  method: frankSafeInheritGui.enhanceMethod,
                  slot: selW.slot_ref,
                  expected_item_id: selW.item_id
                });
                renderSafeInheritanceGuiClient();
              }
            } else if (hb.type === 'SELECT_SRC') {
              frankSafeInheritGui.selectedSrcIdx = hb.index;
              frankSafeInheritGui.selectedDstIdx = 0;
              frankSafeInheritGui.consentChecked = false;
              renderSafeInheritanceGuiClient();
            } else if (hb.type === 'SELECT_DST') {
              frankSafeInheritGui.selectedDstIdx = hb.index;
              frankSafeInheritGui.consentChecked = false;
              renderSafeInheritanceGuiClient();
            } else if (hb.type === 'TOGGLE_CONSENT') {
              frankSafeInheritGui.consentChecked = !frankSafeInheritGui.consentChecked;
              renderSafeInheritanceGuiClient();
            } else if (hb.type === 'CLOSE_GUI') {
              closeSafeInheritanceGuiClient();
            } else if (hb.type === 'EXEC_INHERIT') {
              var selSrc = frankSafeInheritGui.sources[frankSafeInheritGui.selectedSrcIdx];
              var fTargets = getFilteredTargetsForSelectedSource();
              var selDst = fTargets[frankSafeInheritGui.selectedDstIdx];
              if (selSrc && selDst && frankSafeInheritGui.consentChecked && Client.player && Client.player.sendData) {
                frankSafeInheritGui.pending = true;
                Client.player.sendData('f_rank_days:execute_safe_inheritance_gui', {
                  session_token: frankSafeInheritGui.sessionToken,
                  source_slot: selSrc.slot_ref,
                  target_slot: selDst.slot_ref,
                  expected_source_id: selSrc.item_id,
                  expected_target_id: selDst.item_id,
                  expected_source_uid: selSrc.uid,
                  consent_confirmed: true
                });
                renderSafeInheritanceGuiClient();
              }
            }
            break;
          }
        }
      }
      frankSafeInheritGui.wasLeftDown = leftDown;
    } catch (e) {}
  });
}

if (typeof global !== 'undefined') {
  global.FRankNauForgeGuiClientV82 = {
    state: frankSafeInheritGui,
    render: renderSafeInheritanceGuiClient,
    requestHeirloomName: requestHeirloomNameForSelectedV10,
    close: closeSafeInheritanceGuiClient
  };
}
