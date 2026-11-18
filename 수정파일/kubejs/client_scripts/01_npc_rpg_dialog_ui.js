// 《F-Craft》 KubeJS 6 Client Script - v8.2 Center-Popup RPG NPC Dialogue UI (Non-Chat Modal + Kenney Ancient Parchment Theme)
// 파일 경로: kubejs/client_scripts/01_npc_rpg_dialog_ui.js
// 핵심 개선 사항 (v8.2 Phase 6):
// 1. 기존 채팅화면 호출을 제거하고 FRankModalHostV82 비채팅 모달 Screen을 사용하여 NPC 대화 시에도 하단 채팅창이 겹치지 않습니다.
// 2. Kenney Pixel UI (Ancient Tan & Brown 9-Slice) 양피지/금장 테두리 패널과 버튼 디자인으로 시각 통일성을 완성했습니다.

var frankNpcDialogClient = {
  open: false,
  payload: null,
  layout: null,
  hoveredBtnIndex: -1,
  wasLeftMouseDown: false,
  wasEscDown: false,
  fadeStep: 0,
  wasQuestScreenOpen: false,
  openedScreenTick: 0,
  tickCount: 0,
  hostScreen: null,
  speechPage: 0,
  speechPageCount: 1,
  hoveredPage: '',
  payloadRevision: 0,
  pageChangeSequence: 0,
  lastPageResetReason: '',
  lastPageChange: null
};

function computeResponsiveDialogLayout(screenW, screenH, buttonCount, shopTabCount, priceWidth, roleMenu) {
  buttonCount=Math.max(1,Math.min(6,Number(buttonCount)||6));
  var sw = Math.max(220, Number(screenW || 480));
  var sh = Math.max(150, Number(screenH || 270));
  var panelW = Math.min(352, sw - 24);
  var threeColumnContent=(panelW-Math.floor(panelW*.34)-24-10)/3-24;
  var narrowButtons = buttonCount > 4 && (sw < 400 || Number(priceWidth||0)>threeColumnContent);
  var panelH = Math.min(narrowButtons?212:200, sh - (narrowButtons?30:50));
  var compact = panelW < 320 || panelH < 180;
  var leftColW = Math.floor(panelW * 0.34);
  var left = Math.floor((sw - panelW) / 2);
  var top = Math.max(narrowButtons?10:34, Math.floor((sh - panelH) / 2) - (narrowButtons?4:6));
  var rightStart = left + leftColW + 12;
  var rightWidth = panelW - leftColW - 24;
  // Measured 352x200 panel artwork: the pale left column spans texture
  // edges x=10..124. Its center is x=67, not half of the right-column offset.
  var leftPaperLeft = left + panelW * 10 / 352;
  var leftPaperRight = left + panelW * 124 / 352;
  var leftCenter = (leftPaperLeft + leftPaperRight) / 2;
  var portraitW = Math.min(96, leftColW - 20);
  var portraitH = Math.min(126, panelH - 72);
  var portraitTop = top + 10;
  var metadataY = top + panelH - 48;
  var btnCols = buttonCount<=2?1:buttonCount<=4||narrowButtons?2:3;
  var btnRows = Math.ceil(buttonCount / btnCols);
  var btnGapX = 5, btnGapY = 3;
  var btnH = panelH < 120 ? 14 : panelH < 148 ? 18 : 27;
  var btnW = Math.floor((rightWidth - btnGapX * (btnCols - 1)) / btnCols);
  var firstButtonY = top + panelH - 8 - btnRows * btnH - (btnRows - 1) * btnGapY;
  var tabsTop=top+(panelH<120?32:panelH<170?39:45),tabHeight=shopTabCount?(panelH<120?12:panelH<148?14:20):0;
  var speechTop = tabsTop+tabHeight;
  var speechH = firstButtonY - speechTop - (panelH<120?4:6);
  var lineHeight = 12;
  var boxes = [];
  for (var i = 0; i < buttonCount; i++) {
    var bx = rightStart + (i % btnCols) * (btnW + btnGapX);
    var by = firstButtonY + Math.floor(i / btnCols) * (btnH + btnGapY);
    boxes.push({ x: bx, y: by, w: btnW, h: btnH,
      relX: bx + btnW / 2 - sw / 2,
      relY: by + btnH / 2 - sh / 2 + 6,
      leftFromCenter: bx - sw / 2, topFromCenter: by - sh / 2 + 6 });
  }
  var result = { screenW: sw, screenH: sh, panelW: panelW, panelH: panelH,
    panelLeft: left, panelTop: top, compact: compact, leftColW: leftColW,
    textScale: 1, titleScale: compact ? 0.94 : 1.02,
    leftCenter: leftCenter, leftCenterX: leftCenter - sw / 2,
    leftPaperLeft: leftPaperLeft, leftPaperRight: leftPaperRight,
    portraitW: portraitW, portraitH: portraitH, portraitTop: portraitTop,
    portraitY: portraitTop + portraitH / 2 - sh / 2 + 6,
    metadataY: metadataY, rightStart: rightStart,
    rightStartX: rightStart - sw / 2, rightWidth: rightWidth,
    rightCenterX: rightStart + rightWidth / 2 - sw / 2,
    headerY: top + 12, subtitleY: top + 26,
    shopTabsTop:tabsTop,shopTabHeight:tabHeight,
    speechTop: speechTop, speechH: speechH,
    speechTextY: speechTop + (speechH<22?2:speechH<32?3:7), speechTextWidth: rightWidth - 16,
    speechLineHeight: lineHeight,
    // Reserve a footer for paging so long replies remain readable in full.
    maxSpeechLines: Math.max(1, Math.min(8, Math.floor((speechH - 26) / lineHeight))),
    pagePrevBox: { x: rightStart + 5, y: speechTop + speechH - 15, w: 31, h: 12 },
    pageNextBox: { x: rightStart + rightWidth - 36, y: speechTop + speechH - 15, w: 31, h: 12 },
    pageIndicatorY: speechTop + speechH - 14,
    buttonCols: btnCols, buttonsBoxes: boxes,
    hintY: Math.min(sh - 12, top + panelH + 5) };
  // The five principal roles remain together above the conversation. Submenus
  // retain the existing price-safe grid and speech pagination unchanged.
  if (roleMenu && buttonCount === 5) {
    var roleGap = 4, roleWidth = (panelW - 16 - roleGap * 4) / 5;
    result.buttonsBoxes = [];
    for (var role = 0; role < 5; role++) result.buttonsBoxes.push({x:left+8+role*(roleWidth+roleGap),y:top+8,w:roleWidth,h:28});
    result.roleMenu = true;
    result.buttonCols = 5;
    result.portraitTop = top + 44;
    result.portraitH = Math.max(28, Math.min(96, panelH - 104));
    result.headerY = top + 44;
    result.subtitleY = top + 58;
    result.speechTop = top + 77;
    result.speechH = panelH - 85;
    result.speechTextY = result.speechTop + 7;
    result.maxSpeechLines = Math.max(1, Math.min(8, Math.floor((result.speechH - 26) / 12)));
    result.pagePrevBox.y = result.pageNextBox.y = result.speechTop + result.speechH - 15;
    result.pageIndicatorY = result.speechTop + result.speechH - 14;
  }
  return result;
}

function getClientScaledWindowSize() {
  if (typeof Client !== 'undefined' && Client && Client.window) {
    var w = Number(Client.window.guiScaledWidth || 480);
    var h = Number(Client.window.guiScaledHeight || 270);
    if (w > 0 && h > 0) return { w: w, h: h };
  }
  return { w: 480, h: 270 };
}

// Painter centers a box using its own measured width. Text anchors must therefore
// use absolute left/top coordinates; centered:true is only for a real center point.
function dialogTextGlyphs(raw) {
  var s = String(raw || ''), out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length && s.charCodeAt(i + 1) >= 0xDC00 && s.charCodeAt(i + 1) <= 0xDFFF) out.push(s.charAt(i) + s.charAt(++i));
    else out.push(s.charAt(i));
  }
  return out;
}

function measureDialogText(raw, bold) {
  if(typeof F96UI!=='undefined')return F96UI.measure(raw,'f_rank_days:print',bold);
  var value = String(raw || ''), glyphs = dialogTextGlyphs(value), floor = 0;
  // Some external font providers return an advance smaller than their visible
  // Korean glyph. Keep a conservative floor as well as the rendered sequence.
  for (var i = 0; i < glyphs.length; i++) {
    var glyph = glyphs[i], code = glyph.charCodeAt(0);
    // Actual client capture: Korean unifont reaches 9px before scaling. Leave
    // one further pixel for glyph bearings and mixed resource-pack providers.
    floor += code === 32 ? 4 : code > 255 ? 10 : 7;
    if (bold && code !== 32) floor += 1;
  }
  try {
    if (typeof Client !== 'undefined' && Client.font && typeof Text !== 'undefined') {
      var component = Text.of({ text: value, font: 'f_rank_days:print', bold: bold === true });
      // Match Painter TextObject's FormattedCharSequence measurement exactly.
      var sequence;
      try { sequence = component.getVisualOrderText(); } catch (e1) { sequence = component.m_7532_(); }
      var measured;
      try { measured = Client.font.m_92724_(sequence); } catch (e2) { measured = Client.font.width(sequence); }
      var width = Number(measured);
      if (isFinite(width) && width >= 0) return Math.max(width, floor);
    }
  } catch (ignored) {}
  return floor;
}

function fitDialogLabel(raw, maxWidth, preferredScale, minScale, bold) {
  var value = String(raw || ''), scale = preferredScale;
  var width = measureDialogText(value, bold);
  if (width * scale > maxWidth && width > 0) scale = Math.max(minScale, maxWidth / width);
  if (width * scale > maxWidth) {
    var glyphs = dialogTextGlyphs(value);
    while (glyphs.length && measureDialogText(glyphs.join('') + '…', bold) * scale > maxWidth) glyphs.pop();
    value = glyphs.join('');
    value += '…';
  }
  return { text: value, scale: scale };
}

function wrapKoreanLines(rawStr, maxWidth, scale, maxLines) {
  var paragraphs = String(rawStr || '').replace(/\\r\\n|\\n/g, '\n').replace(/\r/g, '').replace(/\t/g, '    ').split('\n');
  var out = [];
  for (var p = 0; p < paragraphs.length; p++) {
    var text = paragraphs[p], current = '', glyphs = dialogTextGlyphs(text);
    if (!text.length) { out.push(''); continue; }
    for (var i = 0; i < glyphs.length; i++) {
      var candidate = current + glyphs[i];
      if (current && measureDialogText(candidate, false) * scale > maxWidth) {
        // Keep words together when that does not create an empty/oversized line.
        var breakAt = current.lastIndexOf(' ');
        if (breakAt > 0 && breakAt > current.length / 2) {
          out.push(current.slice(0, breakAt));
          current = current.slice(breakAt + 1) + glyphs[i];
        } else { out.push(current); current = glyphs[i]; }
      } else current = candidate;
      if (current === ' ') current = '';
    }
    if (current) out.push(current);
  }
  var limit = maxLines === 0 ? 0 : maxLines || 8;
  if (limit && out.length > limit) {
    out = out.slice(0, limit);
    var last = out[limit - 1];
    var lastGlyphs = dialogTextGlyphs(last);
    while (lastGlyphs.length && measureDialogText(lastGlyphs.join('') + '…', false) * scale > maxWidth) lastGlyphs.pop();
    out[limit - 1] = lastGlyphs.join('') + '…';
  }
  return out;
}

function removeAllNpcDialogPaint() {
  if (typeof Client === 'undefined' || !Client || !Client.player || typeof Client.player.paint !== 'function') return;
  var cleanup = {
    frank_dlg_menu_prev: { remove: true },
    frank_dlg_menu_next: { remove: true },
    frank_dlg_backdrop: { remove: true },
    frank_dlg_panel: { remove: true },
    frank_dlg_theme_strip: { remove: true },
    frank_dlg_pframe: { remove: true },
    frank_dlg_portrait: { remove: true },
    frank_dlg_ph_tag: { remove: true },
    frank_dlg_left_job_icon: { remove: true },
    frank_dlg_left_name_grade: { remove: true },
    frank_dlg_affil: { remove: true },
    frank_dlg_aff_bg: { remove: true },
    frank_dlg_aff_fill: { remove: true },
    frank_dlg_aff_heart: { remove: true },
    frank_dlg_aff_txt: { remove: true },
    frank_dlg_name: { remove: true },
    frank_dlg_subtitle: { remove: true },
    frank_dlg_speech_bg: { remove: true },
    frank_dlg_speech_l0: { remove: true },
    frank_dlg_speech_l1: { remove: true },
    frank_dlg_speech_l2: { remove: true },
    frank_dlg_speech_l3: { remove: true },
    frank_dlg_speech_l4: { remove: true },
    frank_dlg_speech_l5: { remove: true },
    frank_dlg_speech_l6: { remove: true },
    frank_dlg_speech_l7: { remove: true },
    frank_dlg_hint: { remove: true }
  };
  for (var pageId of ['prev_bg', 'next_bg', 'prev_text', 'next_text', 'count']) cleanup['frank_dlg_page_' + pageId] = { remove: true };
  for (var i = 0; i < 6; i++) {
    cleanup['frank_dlg_btn_bg_' + i] = { remove: true };
    cleanup['frank_dlg_btn_ico_' + i] = { remove: true };
    cleanup['frank_dlg_btn_lbl_' + i] = { remove: true };
    cleanup['frank_dlg_btn_lbl2_' + i] = { remove: true };
    cleanup['frank_dlg_btn_gold_' + i] = { remove: true };
    cleanup['frank_dlg_btn_badge_' + i] = { remove: true };
    cleanup['frank_dlg_btn_badge_text_' + i] = { remove: true };
  }
  // KubeJS build.26 tries to create absent ids before checking remove:true.
  for(var tabIndex=0;tabIndex<2;tabIndex++){cleanup['frank_dlg_shop_tab_bg_'+tabIndex]={remove:true};cleanup['frank_dlg_shop_tab_txt_'+tabIndex]={remove:true};}
  var painter = Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE;
  var existingCleanup = {};
  var hasCleanup = false;
  for (var paintId in cleanup) {
    if (painter.getObject(paintId) != null) {
      existingCleanup[paintId] = cleanup[paintId];
      hasCleanup = true;
    }
  }
  if (hasCleanup) Client.player.paint(existingCleanup);
}

// Currency is already formatted by the authoritative server. Only wrap whole tokens; never alter digits.
function npcPriceLinesV10(value,width){var words=String(value).split(' '),out=[],line='';for(var i=0;i<words.length;i++){var next=line?line+' '+words[i]:words[i];if(line&&measureDialogText(next,false)>width){out.push(line);line=words[i];}else line=next;}if(line)out.push(line);return out;}
function npcPriceWidthV10(label){var at=String(label).lastIndexOf(' · ');if(at<0)return 0;var value=String(label).slice(at+3),words=value.split(' '),best=measureDialogText(value,false);for(var i=1;i<words.length;i++)best=Math.min(best,Math.max(measureDialogText(words.slice(0,i).join(' '),false),measureDialogText(words.slice(i).join(' '),false)));return best;}
function renderNpcDialogOnClient() {
  if (!frankNpcDialogClient.open || !frankNpcDialogClient.payload) return;
  if (typeof Client === 'undefined' || !Client || !Client.player || typeof Client.player.paint !== 'function') return;
  var p = frankNpcDialogClient.payload;
  var allButtons=p.buttons||[];
  frankNpcDialogClient.buttonPages=Math.max(1,Math.ceil(allButtons.length/6));
  frankNpcDialogClient.buttonPage=Math.max(0,Math.min(frankNpcDialogClient.buttonPages-1,Number(frankNpcDialogClient.buttonPage||0)));
  var buttons=allButtons.slice(frankNpcDialogClient.buttonPage*6,frankNpcDialogClient.buttonPage*6+6);
  frankNpcDialogClient.visibleButtons=buttons;
  var priceWidth=0;for(var pi=0;pi<buttons.length;pi++)priceWidth=Math.max(priceWidth,npcPriceWidthV10(buttons[pi].label));
  var win = getClientScaledWindowSize(), L = computeResponsiveDialogLayout(win.w, win.h,buttons.length,(p.shop_tabs||[]).length,priceWidth,p.role_menu===true);
  frankNpcDialogClient.layout = L;
  var allLines = wrapKoreanLines(p.dialog_text, L.speechTextWidth, L.textScale, 0);
  frankNpcDialogClient.speechPageCount = Math.max(1, Math.ceil(allLines.length / L.maxSpeechLines));
  frankNpcDialogClient.speechPage = Math.max(0, Math.min(frankNpcDialogClient.speechPage, frankNpcDialogClient.speechPageCount - 1));
  var pageStart = frankNpcDialogClient.speechPage * L.maxSpeechLines;
  var wrapped = allLines.slice(pageStart, pageStart + L.maxSpeechLines);
  var affRatio = Math.max(0, Math.min(1, Number(p.affinity || 0) / 100));
  var frameW = L.portraitW + 6, frameH = L.portraitH + 6;
  var frameLeft = L.leftCenter - frameW / 2;
  var portraitW = L.portraitW, portraitH = L.portraitH;
  var portraitAspect = Number(p.portrait_aspect_ratio || 0);
  if (portraitAspect > 0 && isFinite(portraitAspect)) {
    portraitW = Math.min(portraitW, portraitH * portraitAspect);
    portraitH = portraitW / portraitAspect;
  }
  var title = fitDialogLabel(p.name + '  [' + p.job_grade_badge + ']', L.rightWidth - 4, L.titleScale, 0.78, true);
  var subtitle = fitDialogLabel(p.subtitle, L.rightWidth - 4, 1, 1, false);
  var nameBadge = fitDialogLabel(p.name + ' · ' + p.job_grade_badge, frameW - 17, 1, 1, true);
  var affiliation = fitDialogLabel(p.affiliation, frameW - 4, 1, 1, false);
  var affinity = fitDialogLabel('호감도 ' + p.affinity + ' · ' + p.relationship_stage_label, frameW - 4, 1, 1, false);
  var nameGroup = computeNpcNameIconGroup(L.leftCenter, measureDialogText(nameBadge.text, true) * nameBadge.scale, 11, 4);
  var paintObj = {};
  function rect(id, x, y, w, h, z, texture, color, visible) {
    paintObj[id] = { type: 'rectangle', x: x, y: y, w: w, h: h, z: z,
      alignX: 'left', alignY: 'top', draw: 'always', visible: visible !== false };
    if (texture) paintObj[id].texture = texture;
    if (color) paintObj[id].color = color;
  }
  function text(id, value, x, y, scale, color, bold, centered, shadow, visible) {
    paintObj[id] = { type: 'text', x: x, y: y, z: 65,
      alignX: 'left', alignY: 'top', centered: centered === true,
      scale: scale, shadow: shadow === true, draw: 'always', visible: visible !== false,
      text: JSON.stringify({ text: String(value || ''), font: 'f_rank_days:print', color: color, bold: bold === true }) };
  }
  var rootTex = 'f_rank_days:textures/gui/npc_dialog/';
  rect('frank_dlg_backdrop', 0, 0, win.w, win.h, 60, null, '#770D0906');
  rect('frank_dlg_panel', L.panelLeft, L.panelTop, L.panelW, L.panelH, 61, rootTex + 'dialog_main_panel.png');
  rect('frank_dlg_theme_strip', frameLeft, L.portraitTop - 2, frameW, 3, 62, null, p.theme && p.theme.accent ? p.theme.accent : '#D4AF55');
  rect('frank_dlg_pframe', frameLeft, L.portraitTop, frameW, frameH, 62, rootTex + 'portrait_frame.png');
  rect('frank_dlg_portrait', L.leftCenter - portraitW / 2, L.portraitTop + 3 + (L.portraitH - portraitH) / 2, portraitW, portraitH, 63, p.portrait);
  var badgeTop=L.portraitTop+3+(L.portraitH-portraitH)/2+portraitH*214/248,badgeBottom=L.portraitTop+3+(L.portraitH-portraitH)/2+portraitH*233/248;
  text('frank_dlg_ph_tag', '[임시 초상화]', L.leftCenter, (badgeTop+badgeBottom-9)/2, 1, '#E8D8B8', false, true, true, Boolean(p.portrait_is_placeholder));
  rect('frank_dlg_left_job_icon', nameGroup.iconX, L.metadataY, 11, 11, 64, p.job_icon || rootTex + 'job_guild.png');
  text('frank_dlg_left_name_grade', nameBadge.text, nameGroup.textX, L.metadataY + 1, nameBadge.scale, '#3A2416', true, false, false);
  text('frank_dlg_affil', affiliation.text, L.leftCenter, L.metadataY + 12, affiliation.scale, '#4A3219', false, true, false);
  rect('frank_dlg_aff_bg', frameLeft + 2, L.metadataY + 23, frameW - 4, 5, 63, null, '#AA3A2416');
  rect('frank_dlg_aff_fill', frameLeft + 3, L.metadataY + 24, Math.max(0, Math.floor((frameW - 6) * affRatio)), 3, 64, null, p.theme && p.theme.accent ? p.theme.accent : '#E06677', affRatio > 0);
  text('frank_dlg_aff_txt', affinity.text, L.leftCenter, L.metadataY + 33, affinity.scale, '#5C2626', false, true, false);
  text('frank_dlg_name', title.text, L.rightStart + 2, L.headerY, title.scale, '#F7E7C4', true, false, true);
  text('frank_dlg_subtitle', subtitle.text, L.rightStart + 2, L.subtitleY, subtitle.scale, '#EAD6B3', false, false, false);
  frankNpcDialogClient.shopTabBoxes=[];
  var shopTabs=p.shop_tabs||[];
  for(var ti=0;ti<shopTabs.length&&ti<2;ti++){var tx=L.rightStart+ti*(L.rightWidth+4)/2,tw=(L.rightWidth-4)/2,tb=shopTabs[ti];var th=Math.min(17,L.shopTabHeight-3);frankNpcDialogClient.shopTabBoxes.push({x:tx,y:L.shopTabsTop,w:tw,h:th,button:tb});rect('frank_dlg_shop_tab_bg_'+ti,tx,L.shopTabsTop,tw,th,63,rootTex+(ti===0?'btn_hover.png':'btn_normal.png'));var label=fitDialogLabel(tb.label,tw-6,1,1,false);text('frank_dlg_shop_tab_txt_'+ti,label.text,tx+3,L.shopTabsTop+(th-10)/2,label.scale,ti===0?'#2B1B0E':'#F6EAD2',false,false,false);}
  rect('frank_dlg_speech_bg', L.rightStart, L.speechTop, L.rightWidth, L.speechH, 62, rootTex + 'speech_panel.png');
  for (var li = 0; li < 8; li++) {
    text('frank_dlg_speech_l' + li, li < wrapped.length ? wrapped[li] : '', L.rightStart + 8, L.speechTextY + li * L.speechLineHeight,
      L.textScale, '#231F20', false, false, false, li < wrapped.length);
  }
  var hasPages = frankNpcDialogClient.speechPageCount > 1;
  var prev = L.pagePrevBox, next = L.pageNextBox;
  rect('frank_dlg_page_prev_bg', prev.x, prev.y, prev.w, prev.h, 63, rootTex + (frankNpcDialogClient.speechPage > 0 ? 'btn_normal.png' : 'btn_disabled.png'), null, hasPages);
  rect('frank_dlg_page_next_bg', next.x, next.y, next.w, next.h, 63, rootTex + (frankNpcDialogClient.speechPage + 1 < frankNpcDialogClient.speechPageCount ? 'btn_normal.png' : 'btn_disabled.png'), null, hasPages);
  text('frank_dlg_page_prev_text', '이전', prev.x + prev.w / 2, prev.y + 1, 1, '#F6EAD2', false, true, false, hasPages);
  text('frank_dlg_page_next_text', '다음', next.x + next.w / 2, next.y + 1, 1, '#F6EAD2', false, true, false, hasPages);
  text('frank_dlg_page_count', (frankNpcDialogClient.speechPage + 1) + ' / ' + frankNpcDialogClient.speechPageCount, L.rightStart + L.rightWidth / 2, L.pageIndicatorY, 1, '#5C3A20', false, true, false, hasPages);
  
  for (var bi = 0; bi < 6; bi++) {
    var box = L.buttonsBoxes[bi]||L.buttonsBoxes[0], btn = bi < buttons.length ? buttons[bi] : null;
    var hovered = btn && frankNpcDialogClient.hoveredBtnIndex === bi && btn.enabled !== false;
    var buttonTexture = btn && btn.enabled === false ? 'btn_disabled.png' : hovered ? 'btn_hover.png' : 'btn_normal.png';
    var gold = btn && btn.promotion_available === true;
    rect('frank_dlg_btn_gold_' + bi, box.x-1, box.y-1, box.w+2, box.h+2, 62, null, '#EAC45B', Boolean(gold));
    rect('frank_dlg_btn_bg_' + bi, box.x, box.y, box.w, box.h, 63, rootTex + buttonTexture, null, Boolean(btn));
    var roleIcons={talk:'talk',buy:'shop',sell:'special',quest:'quest',promotion_exam:'promotion'};
    var iconName=L.roleMenu&&btn?roleIcons[String(btn.id)]||String(btn.icon||'talk'):String(btn&&btn.icon||'talk');
    rect('frank_dlg_btn_ico_' + bi, box.x + 5, box.y + (box.h - 10) / 2, 10, 10, 64, rootTex + 'icon_' + iconName + '.png', null, Boolean(btn));
    var labelValue=btn?(bi+1)+'. '+btn.label:'',labelScale=1,maxRows=box.h>=24?2:1;
    var labelInset=19,labelWidth=box.w-24;
    var labelLines=F96UI.wrap(labelValue,labelWidth,1);
    if(L.roleMenu&&btn){var roleLabels={talk:['1. 대화','(선물)'],buy:['2. 구매'],sell:['3. 판매'],quest:['4. 일일','의뢰'],promotion_exam:['5. 승급','시험']};labelLines=roleLabels[String(btn.id)]||labelLines;}
    if(labelLines.length>maxRows){var priceAt=labelValue.lastIndexOf(' · ');if(maxRows===2&&priceAt>=0){var price=labelValue.slice(priceAt+3),priceLines=npcPriceLinesV10(price,box.w-24);labelLines=priceLines.length>1?priceLines:[fitDialogLabel(labelValue.slice(0,priceAt),box.w-24,1,1,false).text,price];}else{labelLines=labelLines.slice(0,maxRows);labelLines[maxRows-1]=fitDialogLabel(labelLines[maxRows-1]+'…',box.w-24,1,1,false).text;}}
    // Painter reserves 10 scaled pixels per text line. Center that actual
    // allocation inside the button, including a two-pixel content inset.
    var labelRows=Math.max(1,labelLines.length),labelGap=labelRows>1?1:0;
    labelScale=1;
    var labelHeight=10*labelScale,labelStep=labelHeight+labelGap;
    var labelTop=box.y+(box.h-labelRows*labelHeight-labelGap)/2;
    for(var labelRow=0;labelRow<2;labelRow++)text((labelRow?'frank_dlg_btn_lbl2_':'frank_dlg_btn_lbl_')+bi,labelLines[labelRow]||'',box.x+labelInset,labelTop+labelRow*labelStep,L.roleMenu?F96UI.fit(labelLines[labelRow]||'',labelWidth,1,.8):labelScale,btn&&btn.enabled===false?'#BEB6AA':hovered?'#2B1B0E':'#F6EAD2',false,false,btn&&btn.enabled!==false,Boolean(btn)&&labelRow<labelLines.length);
    var badge=btn&&btn.promotion_ready===true&&Math.floor(frankNpcDialogClient.tickCount/10)%2===0;
    rect('frank_dlg_btn_badge_'+bi,box.x+box.w-6,box.y-3,8,10,64,null,'#F5D66E',Boolean(badge));
    text('frank_dlg_btn_badge_text_'+bi,'!',box.x+box.w-2,box.y-3,1,'#513513',true,true,false,Boolean(badge));

  }
  var hoveredOffer=buttons[frankNpcDialogClient.hoveredBtnIndex],hintValue=hoveredOffer&&hoveredOffer.label?String(hoveredOffer.label):frankNpcDialogClient.buttonPages>1?'선택지 '+(frankNpcDialogClient.buttonPage+1)+' / '+frankNpcDialogClient.buttonPages+' · 닫기 [ESC]':(frankNpcDialogClient.disabledInfo||'마우스로 선택 · 닫기 [ESC]');text('frank_dlg_hint',fitDialogLabel(hintValue,win.w-12,1,1,false).text, win.w / 2, L.hintY, 1, '#E8D8B8', false, true, true);
  if(frankNpcDialogClient.buttonPages>1){
    text('frank_dlg_menu_prev','〈 이전',L.panelLeft+3,L.hintY,1,'#E8D8B8',false,false,true);
    text('frank_dlg_menu_next','다음 〉',L.panelLeft+L.panelW-42,L.hintY,1,'#E8D8B8',false,false,true);
  }
  // TextObject uses GuiGraphics' font buffer while RectangleObject submits
  // immediate geometry. Painter keeps insertion order and does not sort by z.
  // Recreate just our objects on each discrete repaint, with every background
  // inserted before every label. This avoids stale labels being covered when
  // a page or hover change updates existing Painter objects in place.
  var backgrounds = {}, foregrounds = {};
  for (var objectId in paintObj) {
    if (paintObj[objectId].type === 'text') foregrounds[objectId] = paintObj[objectId];
    else backgrounds[objectId] = paintObj[objectId];
  }
  removeAllNpcDialogPaint();
  Client.player.paint(backgrounds);
  Client.player.paint(foregrounds);
}

function computeNpcNameIconGroup(center, labelWidth, iconWidth, gap) {
  var start = center - (iconWidth + gap + labelWidth) / 2;
  return { iconX: start, textX: start + iconWidth + gap, width: iconWidth + gap + labelWidth };
}

function centerNpcNameIconOnPaint(event) {
  if (!frankNpcDialogClient.open || !frankNpcDialogClient.layout) return;
  try {
    var painter = Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE;
    var label = painter.getObject('frank_dlg_left_name_grade'), icon = painter.getObject('frank_dlg_left_job_icon');
    if (!label || !icon) return;
    label.preDraw(event);
    var group = computeNpcNameIconGroup(frankNpcDialogClient.layout.leftCenter, Number(label.w.getFloat(event)), Number(icon.w.getFloat(event)), 4);
    var Unit = Java.loadClass('dev.latvian.mods.unit.FixedNumberUnit');
    icon.x = Unit.of(group.iconX);
    label.x = Unit.of(group.textX);
    frankNpcDialogClient.nameIconGroup = group;
    frankNpcDialogClient.nativeGroupCenterError = null;
  } catch (error) { frankNpcDialogClient.nativeGroupCenterError = String(error); }
}

function closeNpcDialogOnClient(notifyServer, preserveScreen) {
  var currentScreen = Client.screen || Client.currentScreen || null;
  if (frankNpcDialogClient.hostScreen && !sameNpcDialogScreen(currentScreen, frankNpcDialogClient.hostScreen)) preserveScreen = true;
  frankNpcDialogClient.open = false;
  frankNpcDialogClient.payload = null;
  frankNpcDialogClient.hoveredBtnIndex = -1;
  frankNpcDialogClient.speechPage = 0;
  frankNpcDialogClient.lastPageResetReason = 'close';
  frankNpcDialogClient.hostScreen = null;
  removeAllNpcDialogPaint();
  if (typeof FRankModalHostV82 !== 'undefined' && FRankModalHostV82.activeModalId === 'NPC_DIALOG') {
    if (preserveScreen) FRankModalHostV82.activeModalId = null;
    else FRankModalHostV82.closeNonChatModal('NPC_DIALOG');
  }
  if (notifyServer && Client.player && Client.player.sendData) Client.player.sendData('f_rank_days:close_npc_dialog_ui', {});
}

function setNpcDialogSpeechPage(index) {
  var before = frankNpcDialogClient.speechPage;
  var request = { sequence: ++frankNpcDialogClient.pageChangeSequence, input: String(index), inputType: typeof index, before: before,
    pagesBefore: frankNpcDialogClient.speechPageCount, payloadRevision: frankNpcDialogClient.payloadRevision };
  var next = Math.max(0, Math.min(frankNpcDialogClient.speechPageCount - 1, Math.floor(Number(index) || 0)));
  request.resolved = next;
  frankNpcDialogClient.speechPage = next;
  if (frankNpcDialogClient.open && frankNpcDialogClient.payload) renderNpcDialogOnClient();
  request.after = frankNpcDialogClient.speechPage;
  request.pagesAfter = frankNpcDialogClient.speechPageCount;
  frankNpcDialogClient.lastPageChange = request;
  return frankNpcDialogClient.speechPage;
}

function getNpcDialogPaginationInfo() {
  return { open: frankNpcDialogClient.open, page: frankNpcDialogClient.speechPage, pages: frankNpcDialogClient.speechPageCount,
    payloadRevision: frankNpcDialogClient.payloadRevision, resetReason: frankNpcDialogClient.lastPageResetReason,
    sequence: frankNpcDialogClient.pageChangeSequence, lastRequest: frankNpcDialogClient.lastPageChange };
}

function sameNpcDialogScreen(a, b) {
  if (a === b) return true;
  try { return Boolean(a && b && typeof a.equals === 'function' && a.equals(b)); } catch (ignored) { return false; }
}

function pollMouseAndScreenState() {
  if (typeof Client === 'undefined' || !Client) return;

  var curScr = Client.screen || Client.currentScreen || null;
  var scrClassName = curScr && curScr.getClass ? String(curScr.getClass().getName()) : '';
  var isQuestGui = scrClassName.indexOf('ftbquests') !== -1 || scrClassName.indexOf('QuestScreen') !== -1;
  if (isQuestGui && !frankNpcDialogClient.wasQuestScreenOpen) {
    frankNpcDialogClient.wasQuestScreenOpen = true;
    if (Client.player && Client.player.sendData) {
      Client.player.sendData('f_rank_days:sync_questbook_now', {});
    }
  } else if (!isQuestGui && frankNpcDialogClient.wasQuestScreenOpen) {
    frankNpcDialogClient.wasQuestScreenOpen = false;
    if (Client.player && Client.player.sendData) {
      Client.player.sendData('f_rank_days:sync_questbook_now', {});
    }
  }

  if (!frankNpcDialogClient.open || !frankNpcDialogClient.payload) return;

  if(frankNpcDialogClient.tickCount%10===0){var offers=frankNpcDialogClient.payload.buttons||[];for(var oi=0;oi<offers.length;oi++)if(offers[oi].promotion_ready===true){renderNpcDialogOnClient();break;}}

  var dialogWindow = getClientScaledWindowSize();
  if (!frankNpcDialogClient.layout || frankNpcDialogClient.layout.screenW !== dialogWindow.w || frankNpcDialogClient.layout.screenH !== dialogWindow.h) {
    renderNpcDialogOnClient();
  }

  if (frankNpcDialogClient.tickCount > frankNpcDialogClient.openedScreenTick + 2) {
    if (!curScr || isQuestGui || (frankNpcDialogClient.hostScreen && !sameNpcDialogScreen(curScr, frankNpcDialogClient.hostScreen))) {
      // Do not close the inventory, questbook or title screen replacing our host.
      closeNpcDialogOnClient(true, true);
      return;
    }
  }

  if (frankNpcDialogClient.fadeStep < 4) {
    frankNpcDialogClient.fadeStep += 1;
    renderNpcDialogOnClient();
  }

  try {
    if (typeof Java !== 'undefined' && Client.window) {
      var $GLFW = Java.loadClass('org.lwjgl.glfw.GLFW');
      var winHandle = Client.window.window;
      if (typeof $GLFW.glfwGetKey === 'function' && $GLFW.glfwGetKey(winHandle, 256) === 1) {
        closeNpcDialogOnClient(true, false);
        return;
      }

      var rawX = Client.mouseHandler ? Number(Client.mouseHandler.xpos()) : -1;
      var rawY = Client.mouseHandler ? Number(Client.mouseHandler.ypos()) : -1;
      var rawW = Number(Client.window.width || 1);
      var rawH = Number(Client.window.height || 1);
      var guiW = Number(Client.window.guiScaledWidth || 480);
      var guiH = Number(Client.window.guiScaledHeight || 270);

      if (rawX >= 0 && rawY >= 0 && frankNpcDialogClient.layout) {
        var mx = (rawX * guiW) / rawW;
        var my = (rawY * guiH) / rawH;
        var relMx = mx;
        var relMy = my;

        var newHover = -1;
        var boxes = frankNpcDialogClient.layout.buttonsBoxes;
        var btns = frankNpcDialogClient.visibleButtons || [];
        for (var i = 0; i < boxes.length && i < btns.length; i++) {
          var b = boxes[i];
          if (
            relMx >= b.x &&
            relMx <= b.x + b.w &&
            relMy >= b.y &&
            relMy <= b.y + b.h
          ) {
            newHover = i;
            break;
          }
        }

        if (newHover !== frankNpcDialogClient.hoveredBtnIndex) {
          frankNpcDialogClient.hoveredBtnIndex = newHover;
          renderNpcDialogOnClient();
        }

        var leftDown = $GLFW.glfwGetMouseButton(winHandle, 0) === 1;
        var pageChange = 0, L = frankNpcDialogClient.layout;
        function insidePage(box) { return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h; }
        if (frankNpcDialogClient.speechPageCount > 1) {
          if (insidePage(L.pagePrevBox)) pageChange = -1;
          else if (insidePage(L.pageNextBox)) pageChange = 1;
        }
        var clickedTab=-1,tbs=frankNpcDialogClient.shopTabBoxes||[];for(var ti=0;ti<tbs.length;ti++)if(insidePage(tbs[ti]))clickedTab=ti;
        if(leftDown&&!frankNpcDialogClient.wasLeftMouseDown&&!F96UI.pointerBlocked()&&clickedTab>=0){activateNpcShopTabV98(clickedTab);}
        else if(leftDown&&!frankNpcDialogClient.wasLeftMouseDown&&!F96UI.pointerBlocked()&&frankNpcDialogClient.buttonPages>1&&my>=L.hintY-2&&my<=L.hintY+10){
          if(mx<L.panelLeft+48)setNpcDialogButtonPageV96(frankNpcDialogClient.buttonPage-1);
          else if(mx>L.panelLeft+L.panelW-48)setNpcDialogButtonPageV96(frankNpcDialogClient.buttonPage+1);
        } else if (leftDown && !frankNpcDialogClient.wasLeftMouseDown && !F96UI.pointerBlocked() && pageChange) {
          setNpcDialogSpeechPage(frankNpcDialogClient.speechPage + pageChange);
        } else if (leftDown && !frankNpcDialogClient.wasLeftMouseDown && !F96UI.pointerBlocked() && newHover >= 0 && btns[newHover]) {
          activateNpcDialogButtonV96(newHover);

        }
        frankNpcDialogClient.wasLeftMouseDown = leftDown;
      }
    }
  } catch (err) {}
}

NetworkEvents.dataReceived('f_rank_days:open_npc_dialog_ui', function (event) {
  frankNpcDialogClient.open = true;
  frankNpcDialogClient.payload = normalizeNpcPayloadV96(event.data || {});
  frankNpcDialogClient.buttonPage=0;
  frankNpcDialogClient.disabledInfo='';
  frankNpcDialogClient.hoveredBtnIndex = -1;
  frankNpcDialogClient.fadeStep = 0;
  frankNpcDialogClient.speechPage = 0;
  frankNpcDialogClient.payloadRevision += 1;
  frankNpcDialogClient.lastPageResetReason = 'open_packet';
  frankNpcDialogClient.openedScreenTick = frankNpcDialogClient.tickCount;

  if (typeof FRankModalHostV82 !== 'undefined') {
    FRankModalHostV82.openNonChatModal('NPC_DIALOG');
  }
  frankNpcDialogClient.hostScreen = Client.screen || Client.currentScreen || null;
  renderNpcDialogOnClient();
});

NetworkEvents.dataReceived('f_rank_days:update_npc_dialog_ui', function (event) {
  if (!frankNpcDialogClient.open) return; // Ignore a delayed response after closing.
  frankNpcDialogClient.payload = normalizeNpcPayloadV96(event.data || {});
  frankNpcDialogClient.buttonPage=0;
  frankNpcDialogClient.disabledInfo='';
  frankNpcDialogClient.speechPage = 0;
  frankNpcDialogClient.payloadRevision += 1;
  frankNpcDialogClient.lastPageResetReason = 'update_packet';
  frankNpcDialogClient.fadeStep = 1;
  renderNpcDialogOnClient();
});

NetworkEvents.dataReceived('f_rank_days:close_npc_dialog_ui', function (event) {
  var d = event.data || {};
  closeNpcDialogOnClient(false, Boolean(d.silent));
});

if (typeof ClientEvents !== 'undefined' && ClientEvents.tick) {
  ClientEvents.tick(function (event) {
    frankNpcDialogClient.tickCount += 1;
    pollMouseAndScreenState();
  });
}
if (typeof ClientEvents !== 'undefined' && ClientEvents.paintScreen) ClientEvents.paintScreen(centerNpcNameIconOnPaint);

if (typeof global !== 'undefined') {
  global.FRankNpcDialogClient = {
    state: frankNpcDialogClient,
    computeResponsiveDialogLayout: computeResponsiveDialogLayout,
    measureDialogText: measureDialogText,
    wrapKoreanLines: wrapKoreanLines,
    renderNpcDialogOnClient: renderNpcDialogOnClient,
    close: closeNpcDialogOnClient,
    glyphs: dialogTextGlyphs,
    setSpeechPage: setNpcDialogSpeechPage,
    nextSpeechPage: function () { return setNpcDialogSpeechPage(frankNpcDialogClient.speechPage + 1); },
    previousSpeechPage: function () { return setNpcDialogSpeechPage(frankNpcDialogClient.speechPage - 1); },
    getPaginationInfo: getNpcDialogPaginationInfo,
    getState: function () { return frankNpcDialogClient; },
    computeNameIconGroup: computeNpcNameIconGroup
  };
}

function normalizeNpcPayloadV96(d){
 var p={},keys=['npc_id','name','job_grade_badge','subtitle','affiliation','affinity','relationship_stage_label','portrait','portrait_aspect_ratio','portrait_is_placeholder','job_icon','dialog_text','theme','view','role_menu'];
 for(var i=0;i<keys.length;i++)p[keys[i]]=d[keys[i]];
 var buttons=F96UI.parse(d.buttons_json,null)||d.buttons||[];p.buttons=[];var length=buttons.length;if(length===undefined&&buttons.size)length=Number(buttons.size());for(var j=0;j<Number(length||0);j++)p.buttons.push(buttons[j]);
 // NBT booleans can arrive as bytes/boxed values. The trusted parsed role
 // actions determine the layout, yielding a primitive JS boolean every time.
 p.role_menu=p.buttons.length===5&&p.buttons[0].action==='ACTION_MENU_TALK'&&p.buttons[1].action==='ACTION_OPEN_BUY_SHOP'&&p.buttons[2].action==='ACTION_OPEN_SELL_SHOP'&&p.buttons[3].action==='ACTION_CHECK_QUESTS'&&p.buttons[4].action==='OPEN_PROMOTION_EXAM';
 p.shop_tabs=F96UI.parse(d.shop_tabs_json,[]);
 return p;
}
function setNpcDialogButtonPageV96(index){frankNpcDialogClient.buttonPage=Math.max(0,Math.min((frankNpcDialogClient.buttonPages||1)-1,Number(index)||0));frankNpcDialogClient.hoveredBtnIndex=-1;renderNpcDialogOnClient();return frankNpcDialogClient.buttonPage;}
global.FRankNpcDialogClient.setButtonPage=setNpcDialogButtonPageV96;
F96UI.onResize(function(){if(frankNpcDialogClient.open)renderNpcDialogOnClient();});

function activateNpcDialogButtonV96(index){
 var s=frankNpcDialogClient,btn=(s.visibleButtons||[])[Number(index)];
 if(!s.open||!btn)return false;
 if(btn.enabled===false){s.disabledInfo=fitDialogLabel(btn.disabled_reason||btn.error_hint||'지금은 선택할 수 없습니다.',s.layout.panelW-12,.66,.55,false).text;renderNpcDialogOnClient();return false;}
 if(Client.player&&Client.player.sendData){Client.player.sendData('f_rank_days:npc_dialog_action',{npc_id:s.payload.npc_id,button_id:btn.id,action:btn.action,sub_id:btn.sub_id||''});return true;}
 return false;
}
global.FRankNpcDialogClient.clickButton=activateNpcDialogButtonV96;

function activateNpcShopTabV98(index){var s=frankNpcDialogClient,b=(s.payload&&s.payload.shop_tabs||[])[Number(index)];if(!s.open||!b||b.enabled===false)return false;Client.player.sendData('f_rank_days:npc_dialog_action',{npc_id:s.payload.npc_id,button_id:b.id,action:b.action,sub_id:b.sub_id||''});return true;}
global.FRankNpcDialogClient.clickShopTab=activateNpcShopTabV98;
