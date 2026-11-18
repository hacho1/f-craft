// 《F급의 나날》 KubeJS 6 Server Script - v8.2 Non-Chat Dedicated Guild Registration Card Backend, Strict Validation & Quest Sync
// 파일 경로: kubejs/server_scripts/07_guild_card_and_quest_sync.js
// 핵심 변경 사항 (v8.2 Phase 1 반영):
// 1. 기존 채팅창(PlayerEvents.chat) 기반 성명 입력 방식을 완전히 폐지했습니다(채팅 입력으로는 등록증이 절대 발급되지 않음).
// 2. 전용 비채팅 길드 등록증 GUI(00_guild_card_ui.js) 패킷(f_rank_days:submit_guild_card_name)으로만 성명을 수신하며,
//    빈 문자열·공백 전용 입력 거부, 2~16자 길이 제한, 제어 문자(\r\n\t\0 등) 및 마인크래프트 서식 코드(§) 차단 검증을 수행합니다.
// 3. 플레이어 계정 UUID(player_uuid)와 길드 역할 이름(registered_display_name)을 엄격히 분리 저장하며, 중복 발급 및 보상 복제를 100% 차단합니다.

global.FRankDays = global.FRankDays || {};

global.FRankDays.GUILD_ISSUER_NAME = '아르베른 통합 길드 브리온 지부';
global.FRankDays.GUILD_EMPIRE_HEADER = '아르베른 제국 통합 길드';
global.FRankDays.GUILD_NAME_MIN_LEN = 2;
global.FRankDays.GUILD_NAME_MAX_LEN = 16;

// v8.2 엄격한 성명 유효성 검증기 (클라이언트·서버 동일 기준)
global.FRankDays.validateGuildCardDisplayNameV82 = function (rawName) {
  if (rawName === null || rawName === undefined) {
    return {
      valid: false,
      reason: 'empty_or_whitespace',
      cleaned: '',
      message: '성명을 입력해 주세요 (공백 제외 2~16자).'
    };
  }
  var rawStr = String(rawName);

  // 1) 제어 문자(ASCII 0~31, 127) 및 마인크래프트 서식 코드(§) 포함 여부 즉시 차단
  if (/[\x00-\x1F\x7F§]/.test(rawStr) || /&[0-9a-fk-orA-FK-OR]/.test(rawStr)) {
    return {
      valid: false,
      reason: 'forbidden_control_or_format_char',
      cleaned: '',
      message: '제어 문자나 색상·서식 코드(§)는 길드 등록증 성명에 사용할 수 없습니다.'
    };
  }

  // 2) 앞뒤 공백 제거 및 연속 공백 1칸 정규화
  var normalized = rawStr.replace(/\s+/g, ' ').trim();
  var nonSpaceLen = normalized.replace(/\s+/g, '').length;
  if (normalized.length === 0 || nonSpaceLen === 0) {
    return {
      valid: false,
      reason: 'empty_or_whitespace',
      cleaned: '',
      message: '공백만으로는 성명을 등록할 수 없습니다. 2~16자 이내로 입력해 주세요.'
    };
  }

  // 3) 허용 문자 검사: 한글(완성형 가-힣), 영문, 숫자, 공백, 가운뎃점(·), 하이픈(-), 밑줄(_)만 허용 (단독 자모 남용이나 특수기호 깨짐 방지)
  if (!/^[가-힣a-zA-Z0-9 _·\-]+$/.test(normalized)) {
    return {
      valid: false,
      reason: 'invalid_characters',
      cleaned: normalized,
      message: '성명에는 완성된 한글, 영문, 숫자, 공백, 하이픈(-), 가운뎃점(·)만 사용할 수 있습니다.'
    };
  }

  // 4) 글자 수 제한 (2~16자)
  if (normalized.length < global.FRankDays.GUILD_NAME_MIN_LEN || normalized.length > global.FRankDays.GUILD_NAME_MAX_LEN) {
    return {
      valid: false,
      reason: 'length_out_of_bounds',
      cleaned: normalized.slice(0, global.FRankDays.GUILD_NAME_MAX_LEN),
      message: '성명은 최소 2자 이상, 최대 16자 이하로 입력해 주세요. (현재 ' + normalized.length + '자)'
    };
  }

  return {
    valid: true,
    reason: 'ok',
    cleaned: normalized,
    char_count: normalized.length,
    message: '사용 가능한 성명입니다 (' + normalized.length + '/16자).'
  };
};

global.FRankDays.sanitizeCardDisplayName = function (rawName) {
  var res = global.FRankDays.validateGuildCardDisplayNameV82(rawName);
  return res.valid ? res.cleaned : '';
};

global.FRankDays.resolvePrimaryRegisteredJob = function (state) {
  var firstId =
    state.guild_card && state.guild_card.initial_job_id
      ? state.guild_card.initial_job_id
      : state.starter_onboarding &&
          state.starter_onboarding.quests &&
          state.starter_onboarding.quests.q03_first_job.first_job_id
        ? state.starter_onboarding.quests.q03_first_job.first_job_id
        : null;

  if (firstId && state.job_licenses[firstId] && state.job_licenses[firstId].grade !== 'UNREGISTERED') {
    return {
      job_id: firstId,
      job_label: global.FRankDays.JOB_LABELS[firstId],
      grade: state.job_licenses[firstId].grade
    };
  }

  for (var i = 0; i < global.FRankDays.ALL_JOBS.length; i++) {
    var jid = global.FRankDays.ALL_JOBS[i];
    if (state.job_licenses[jid] && state.job_licenses[jid].grade !== 'UNREGISTERED') {
      return {
        job_id: jid,
        job_label: global.FRankDays.JOB_LABELS[jid],
        grade: state.job_licenses[jid].grade
      };
    }
  }
  return null;
};

global.FRankDays.formatRegisteredJobsSummary = function (state) {
  var list = [];
  for (var i = 0; i < global.FRankDays.ALL_JOBS.length; i++) {
    var jid = global.FRankDays.ALL_JOBS[i];
    var g = state.job_licenses[jid] ? state.job_licenses[jid].grade : 'UNREGISTERED';
    if (g !== 'UNREGISTERED') {
      list.push(global.FRankDays.JOB_LABELS[jid] + ' [' + g + '급]');
    }
  }
  return list.length > 0 ? list.join(', ') : '미등록';
};

global.FRankDays.getOrGenerateCardSerial = function (state) {
  if (state.guild_card.serial_number) {
    return state.guild_card.serial_number;
  }
  if (state.guild_card.pending_serial) {
    return state.guild_card.pending_serial;
  }
  var cleanUuid = String(state.player_uuid || '00000000').replace(/-/g, '').toUpperCase();
  var suffix = cleanUuid.slice(0, 8);
  while (suffix.length < 8) suffix += '0';
  return 'ARB-412-' + suffix;
};

// 서버 백업용 페인터 (VIEW / STAMPED 열람 및 모의 검증 호환용 — INPUT 시에는 클라이언트 전용 GUI가 전체 입력칸·버튼을 직접 렌더링!)
global.FRankDays.renderGuildCardPainter = function (player, state, mode) {
  var jobInfo = global.FRankDays.resolvePrimaryRegisteredJob(state);
  var abId = state.special_ability.ability_id || '';
  var abObj = global.FRankDays.STARTER_ABILITIES[abId];
  var abilityText = abObj ? abObj.name + ' (F급)' : abId;
  var jobText = jobInfo ? jobInfo.job_label : '미등록';
  var gradeText = jobInfo ? jobInfo.grade + '급' : 'F급';
  var serialText = global.FRankDays.getOrGenerateCardSerial(state);
  var issuerText = state.guild_card.issued_agency || global.FRankDays.GUILD_ISSUER_NAME;
  var issuedDateText = state.guild_card.issued_date || '아르베른력 412년 정착기록';

  var isInput = mode === 'INPUT';
  if (isInput) {
    // INPUT 모드는 클라이언트 전용 GUI(00_guild_card_ui.js)가 텍스트 입력칸·미리보기·버튼을 직접 그리므로 서버 오버레이 충돌을 비움
    return { delegated_to_client_dedicated_gui: true, serial: serialText };
  }

  var nameDisplayObj = {
    text: '◆ ' + String(state.guild_card.registered_display_name || state.player_name),
    font: 'f_rank_days:handwriting',
    italic: true,
    color: '#3B1E08'
  };

  var paintPayload = {
    frank_gc_backdrop: {
      type: 'rectangle', x: 0, y: 0, z: 50, w: '$screenW', h: '$screenH',
      color: '#770B0907', draw: 'always', visible: true
    },
    frank_gc_card: {
      type: 'rectangle', x: 0, y: -8, z: 51, w: 312, h: 204, alignX: 'center', alignY: 'center',
      texture: 'f_rank_days:textures/gui/v8_2/guild_registration_card_v82.png', draw: 'always', visible: true
    },
    frank_gc_header: {
      type: 'text', x: 0, y: -93, z: 52, alignX: 'center', alignY: 'center', centered: true, shadow: true, scale: 0.98,
      text: { text: '【 아르베른 제국 통합 길드 · 공인 등록증 】', font: 'f_rank_days:print', bold: true, color: '#F6E7C1' },
      draw: 'always', visible: true
    },
    frank_gc_label_name: {
      type: 'text', x: -132, y: -64, z: 52, alignX: 'center', alignY: 'center', shadow: false,
      text: { text: '성    명 :', font: 'f_rank_days:print', bold: true, color: '#4A3219' },
      draw: 'always', visible: true
    },
    frank_gc_val_name: {
      type: 'text', x: -68, y: -65, z: 53, alignX: 'center', alignY: 'center', shadow: false, scale: 1.12,
      text: nameDisplayObj, draw: 'always', visible: true
    },
    frank_gc_row_serial: {
      type: 'text', x: -132, y: -42, z: 52, alignX: 'center', alignY: 'center', shadow: false, scale: 0.88,
      text: { text: '등록번호 :  ' + serialText, font: 'f_rank_days:print', color: '#231F20' },
      draw: 'always', visible: true
    },
    frank_gc_row_ability: {
      type: 'text', x: -132, y: -23, z: 52, alignX: 'center', alignY: 'center', shadow: false, scale: 0.88,
      text: { text: '고유능력 :  ' + abilityText, font: 'f_rank_days:print', color: '#231F20' },
      draw: 'always', visible: true
    },
    frank_gc_row_job: {
      type: 'text', x: -132, y: -4, z: 52, alignX: 'center', alignY: 'center', shadow: false, scale: 0.88,
      text: { text: '최초직업 :  ' + jobText + '   |   직업등급 : ' + gradeText, font: 'f_rank_days:print', color: '#231F20' },
      draw: 'always', visible: true
    },
    frank_gc_row_grade: {
      type: 'text', x: -132, y: 15, z: 52, alignX: 'center', alignY: 'center', shadow: false, scale: 0.85,
      text: { text: '발 급 일 :  ' + issuedDateText, font: 'f_rank_days:print', color: '#3A281A' },
      draw: 'always', visible: true
    },
    frank_gc_row_issuer: {
      type: 'text', x: -132, y: 34, z: 52, alignX: 'center', alignY: 'center', shadow: false, scale: 0.85,
      text: { text: '발 급 처 :  ' + issuerText, font: 'f_rank_days:print', color: '#3A281A' },
      draw: 'always', visible: true
    },
    frank_gc_seal: {
      type: 'rectangle', x: 106, y: 18, z: 54, w: 48, h: 48, alignX: 'center', alignY: 'center',
      texture: 'f_rank_days:textures/gui/guild_wax_seal.png', draw: 'always', visible: true
    },
    frank_gc_footer: {
      type: 'text', x: 0, y: 68, z: 52, alignX: 'center', alignY: 'center', centered: true, shadow: false, scale: 0.82,
      text: { text: '제국 통합 길드 공인 인장 날인 완료 · [ESC] 또는 /frank close_ui 로 닫기', font: 'f_rank_days:print', color: '#5C3A21' },
      draw: 'always', visible: true
    }
  };

  // Preserve font/style through Painter's NBT transport as JSON StringTags.
  for (var paintId in paintPayload) {
    var object = paintPayload[paintId];
    if (object.type === 'text' && object.text && typeof object.text === 'object') {
      object.text = JSON.stringify(object.text);
    }
  }
  if (typeof player.paint === 'function') {
    player.paint(paintPayload);
  }
  return paintPayload;
};

global.FRankDays.closeGuildCardUi = function (player) {
  var state = global.FRankDays.loadPlayerState(player);
  state.guild_card.ui_open = false;
  state.guild_card.awaiting_name_input = false;
  state.guild_card.ui_auto_hide_at = 0;
  global.FRankDays.savePlayerState(player, state);

  // The client filters both native and fallback widget ids against its Painter.
  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:close_guild_card_ui', {});
  }
  return { ok: true };
};

global.FRankDays.openGuildRegistrationUi = function (player, modeOverride, nowEpochMs) {
  var state = global.FRankDays.loadPlayerState(player);
  var mode = modeOverride || 'INPUT';
  var now = nowEpochMs || Date.now();

  if (mode === 'INPUT' && state.guild_card.issued) {
    return {
      ok: false,
      reason: 'already_registered',
      message:
        '[통합 길드] 이미 길드 등록을 마친 주민입니다(등록번호: ' +
        state.guild_card.serial_number +
        '). 등록 절차는 중복 실행되지 않습니다. (등록증 우클릭 또는 /frank card 로 열람)'
    };
  }

  if (mode === 'VIEW' && !state.guild_card.issued) {
    return {
      ok: false,
      reason: 'not_registered_yet',
      message: '아직 발급된 길드 등록증이 없습니다. 먼저 F급 능력과 첫 직업을 선택한 뒤 등록을 완료해 주세요.'
    };
  }

  if (!state.special_ability.ability_id) {
    return {
      ok: false,
      reason: 'missing_ability',
      message: '길드 등록증을 작성하려면 먼저 F급 특수 능력을 선택해야 합니다 (/frank ability <ID>).'
    };
  }

  var jobInfo = global.FRankDays.resolvePrimaryRegisteredJob(state);
  if (!jobInfo) {
    return {
      ok: false,
      reason: 'missing_first_job',
      message: '길드 등록증을 작성하려면 먼저 최초 직업을 선택해야 합니다 (/frank register_job <직업ID>).'
    };
  }

  if (state.npc_dialog && state.npc_dialog.open && typeof global.FRankDays.closeNpcRpgDialog === 'function') {
    global.FRankDays.closeNpcRpgDialog(player, true);
    state = global.FRankDays.loadPlayerState(player);
  }

  var serial = global.FRankDays.getOrGenerateCardSerial(state);
  state.guild_card.pending_serial = serial;
  state.guild_card.ui_open = true;
  state.guild_card.awaiting_name_input = mode === 'INPUT';
  state.guild_card.ui_auto_hide_at = mode === 'VIEW' ? now + 7000 : 0;
  global.FRankDays.savePlayerState(player, state);

  var painted = global.FRankDays.renderGuildCardPainter(player, state, mode);

  var abObj = global.FRankDays.STARTER_ABILITIES[state.special_ability.ability_id];
  var defaultNick = String(player.username || state.player_name || '').slice(0, 16);
  var packetData = {
    mode: mode,
    empire_header: global.FRankDays.GUILD_EMPIRE_HEADER,
    serial: serial,
    grade: jobInfo.grade,
    ability: abObj ? abObj.name : state.special_ability.ability_id,
    job: jobInfo.job_label,
    issued_date: state.guild_card.issued_date || '아르베른력 412년 정착기록',
    issuer: global.FRankDays.GUILD_ISSUER_NAME,
    default_nickname: defaultNick,
    name: state.guild_card.registered_display_name || defaultNick
  };

  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:open_guild_card_ui', packetData);
  }

  if (mode === 'INPUT' && player.tell) {
    player.tell(
      '[길드 등록증 전용 작성 창] 화면에 열린 《길드 등록증 작성 GUI》의 전용 성명 입력칸에 표시할 이름을 입력하고 [확인 발급] 버튼을 클릭해 주세요. (채팅창은 사용되지 않습니다)'
    );
  }

  return {
    ok: true,
    mode: mode,
    chat_input_used: false,
    auto_filled: packetData,
    painted_elements: Object.keys(painted)
  };
};

global.FRankDays.buildParchmentCertificatePages = function (state) {
  var gc = state.guild_card;
  var abObj = global.FRankDays.STARTER_ABILITIES[state.special_ability.ability_id];
  var abName = abObj ? abObj.name + ' (F급)' : String(state.special_ability.ability_id || '미등록');
  var jobInfo = global.FRankDays.resolvePrimaryRegisteredJob(state);
  var jobLabel = jobInfo ? jobInfo.job_label : '미등록';
  var gradeLabel = (jobInfo ? jobInfo.grade : gc.grade || 'F') + '급';

  var page1Components = [
    { text: '【아르베른 제국 통합 길드 등록증】\n\n', font: 'f_rank_days:print', bold: true, color: 'dark_red' },
    { text: '성    명 : ', font: 'f_rank_days:print', color: 'dark_gray' },
    {
      text: '◆ ' + String(gc.registered_display_name) + '\n\n',
      font: 'f_rank_days:handwriting',
      italic: true,
      color: '#3B1E08'
    },
    { text: '등록번호 : ' + String(gc.serial_number) + '\n', font: 'f_rank_days:print', italic: false, color: 'black' },
    { text: '등    급 : ' + gradeLabel + '\n', font: 'f_rank_days:print', italic: false, color: 'black' },
    { text: '특수능력 : ' + abName + '\n', font: 'f_rank_days:print', italic: false, color: 'black' },
    { text: '최초직업 : ' + jobLabel + '\n', font: 'f_rank_days:print', italic: false, color: 'dark_green' },
    { text: '발 급 일 : ' + String(gc.issued_date || '아르베른력 412년 정착기록') + '\n', font: 'f_rank_days:print', italic: false, color: 'black' },
    { text: '발 급 처 : ' + String(gc.issued_agency), font: 'f_rank_days:print', italic: false, color: 'black' }
  ];

  return [JSON.stringify(page1Components)];
};

global.FRankDays.issueOrUpdateGuildCard = function (player, rawInputName, dateStrOverride, nowEpochMs) {
  var state = global.FRankDays.loadPlayerState(player);
  var now = nowEpochMs || Date.now();

  if (state.guild_card.issued) {
    return {
      ok: false,
      reason: 'already_registered',
      serial_number: state.guild_card.serial_number,
      registered_display_name: state.guild_card.registered_display_name,
      message:
        '[통합 길드] 이미 등록이 완료된 주민입니다(성명: ' +
        state.guild_card.registered_display_name +
        ', 번호: ' +
        state.guild_card.serial_number +
        '). 등록 절차는 중복 실행되지 않습니다.'
    };
  }

  if (!state.special_ability.ability_id) {
    return {
      ok: false,
      reason: 'missing_ability',
      message: '먼저 F급 특수 능력을 선택해야 등록증을 발급받을 수 있습니다 (/frank ability <ID>).'
    };
  }

  var jobInfo = global.FRankDays.resolvePrimaryRegisteredJob(state);
  if (!jobInfo) {
    return {
      ok: false,
      reason: 'missing_first_job',
      message: '먼저 최초 직업을 선택해야 등록증을 발급받을 수 있습니다 (/frank register_job <직업ID>).'
    };
  }

  var candidateName = rawInputName;
  if (candidateName === 'from_hand' && player.mainHandItem && player.mainHandItem.hoverName) {
    candidateName = String(player.mainHandItem.hoverName.string || player.mainHandItem.hoverName);
  }

  var validation = global.FRankDays.validateGuildCardDisplayNameV82(candidateName);
  if (!validation.valid) {
    if (typeof player.sendData === 'function') {
      player.sendData('f_rank_days:guild_card_validation_error', {
        reason: validation.reason,
        message: validation.message
      });
    }
    return {
      ok: false,
      reason: validation.reason,
      validation_reason: validation.reason,
      message: validation.message
    };
  }
  var cleanName = validation.cleaned;

  var serial = global.FRankDays.getOrGenerateCardSerial(state);
  var dateStr = dateStrOverride || '아르베른력 412년 정착기록';
  var abId = state.special_ability.ability_id;
  var abObj = global.FRankDays.STARTER_ABILITIES[abId];
  var abLabel = abObj ? abObj.name : abId;

  // 계정 UUID(state.player_uuid)와 길드 역할 이름(registered_display_name)은 독립 필드에 분리 저장!
  state.guild_card.issued = true;
  state.guild_card.awaiting_name_input = false;
  state.guild_card.ui_open = true;
  state.guild_card.ui_auto_hide_at = now + 5000;
  state.guild_card.pending_serial = serial;
  state.guild_card.registered_display_name = cleanName;
  state.guild_card.serial_number = serial;
  state.guild_card.grade = jobInfo.grade;
  state.guild_card.issued_date = dateStr;
  state.guild_card.issued_agency = global.FRankDays.GUILD_ISSUER_NAME;
  state.guild_card.initial_ability_id = abId;
  state.guild_card.initial_job_id = jobInfo.job_id;

  var givePhysicalItems = false;
  if (!state.reward_ledger.guild_citizen_card_issued) {
    state.reward_ledger.guild_citizen_card_issued = true;
    givePhysicalItems = true;
  }

  global.FRankDays.savePlayerState(player, state);

  var cardNbt = {
    Name: cleanName,
    Ability: abId,
    AbilityName: abLabel,
    Job: jobInfo.job_id,
    JobName: jobInfo.job_label,
    SerialNumber: serial,
    Grade: jobInfo.grade,
    IssuedBy: global.FRankDays.GUILD_ISSUER_NAME,
    CardSerial: serial,
    OwnerUUID: state.player_uuid,
    AccountUsername: String(player.username || state.player_name || ''),
    RegisteredDisplayName: cleanName,
    AbilityId: abId,
    PrimaryJob: jobInfo.job_id,
    PrimaryGrade: jobInfo.grade,
    IssuedAgency: global.FRankDays.GUILD_ISSUER_NAME,
    IssuedDate: dateStr,
    display: {
      Name: JSON.stringify({
        text: '길드 등록증 [' + cleanName + ']',
        font: 'f_rank_days:print',
        italic: false,
        color: 'gold'
      }),
      Lore: [
        JSON.stringify([
          { text: '성명: ', font: 'f_rank_days:print', italic: false, color: 'gray' },
          { text: '◆ ' + cleanName, font: 'f_rank_days:handwriting', italic: true, color: 'yellow' }
        ]),
        JSON.stringify([
          { text: '등록번호: ' + serial, font: 'f_rank_days:print', italic: false, color: 'white' }
        ]),
        JSON.stringify([
          { text: '등급: ' + jobInfo.grade + '급  |  직업: ' + jobInfo.job_label, font: 'f_rank_days:print', italic: false, color: 'green' }
        ]),
        JSON.stringify([
          { text: '능력: ' + abLabel + ' (F급)', font: 'f_rank_days:print', italic: false, color: 'aqua' }
        ]),
        JSON.stringify([
          { text: '발급일: ' + dateStr + ' | ' + global.FRankDays.GUILD_ISSUER_NAME, font: 'f_rank_days:print', italic: false, color: 'gray' }
        ])
      ]
    }
  };

  if (givePhysicalItems && player.give) {
    if (typeof Item !== 'undefined' && Item.of) {
      player.give(Item.of('f_rank_days:guild_citizen_card', cardNbt));
      player.give(
        Item.of('minecraft:written_book', {
          title: '길드 등록증 사본 (' + cleanName + ')',
          author: global.FRankDays.GUILD_ISSUER_NAME,
          resolved: 1,
          pages: global.FRankDays.buildParchmentCertificatePages(state)
        })
      );
    } else {
      player.give('f_rank_days:guild_citizen_card');
    }
    // v9.6 first registration has one authoritative 150-copper reward.
  }

  global.FRankDays.renderGuildCardPainter(player, state, 'STAMPED');
  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:open_guild_card_ui', {
      mode: 'STAMPED',
      empire_header: global.FRankDays.GUILD_EMPIRE_HEADER,
      name: cleanName,
      serial: serial,
      grade: jobInfo.grade,
      ability: abLabel,
      job: jobInfo.job_label,
      issued_date: dateStr,
      issuer: global.FRankDays.GUILD_ISSUER_NAME
    });
  }

  global.FRankDays.syncFtbQuestStagesForPlayer(player);

  return {
    ok: true,
    first_time: true,
    serial_number: serial,
    account_uuid: state.player_uuid,
    registered_display_name: cleanName,
    card_nbt: cardNbt,
    message:
      '[헤스] "성명 서명이 확인되었습니다, 「' +
      cleanName +
      '」 님! 고유번호 [' +
      serial +
      ']로 공인 인장을 날인하여 《길드 등록증》을 발급해 드렸습니다."'
  };
};

global.FRankDays.verifyGuildCardAuthenticity = function (player, cardItem) {
  var state = global.FRankDays.loadPlayerState(player);
  if (!state.guild_card || !state.guild_card.issued) {
    return {
      valid: false,
      reason: 'unregistered_on_server',
      message: '[위조 경고] 서버 길드 원부에 정식 등록 기록이 없는 플레이어입니다. 복제된 등록증은 효력이 없습니다.'
    };
  }

  if (!cardItem || String(cardItem.id) !== 'f_rank_days:guild_citizen_card') {
    return {
      valid: false,
      reason: 'not_a_guild_card',
      message: '손에 《길드 등록증》을 들고 확인해 주세요.'
    };
  }

  var nbt = cardItem.nbt || {};
  var itemOwner = nbt.OwnerUUID ? String(nbt.OwnerUUID) : '';
  var itemSerial = String(nbt.SerialNumber || nbt.CardSerial || '');
  var itemJob = String(nbt.Job || nbt.PrimaryJob || '');
  var itemGrade = String(nbt.Grade || nbt.PrimaryGrade || '');

  if (itemOwner !== state.player_uuid || itemSerial !== state.guild_card.serial_number) {
    return {
      valid: false,
      reason: 'owner_or_serial_mismatch',
      message:
        '[위조·타인 증서 감지] 증서의 소유자 또는 등록번호(' +
        itemSerial +
        ')가 서버 공식 원부(' +
        state.guild_card.serial_number +
        ')와 일치하지 않습니다!'
    };
  }

  var serverActualGrade =
    itemJob && state.job_licenses[itemJob] ? state.job_licenses[itemJob].grade : 'UNREGISTERED';
  var serverIdx = global.FRankDays.GRADE_ORDER.indexOf(serverActualGrade);
  var claimedIdx = global.FRankDays.GRADE_ORDER.indexOf(itemGrade);

  if (claimedIdx > serverIdx) {
    return {
      valid: false,
      reason: 'forged_grade_nbt',
      actual_grade: serverActualGrade,
      message:
        '[위조 감지] 증서 표기 등급(' +
        itemGrade +
        '급)이 길드 원부의 실제 공인 등급(' +
        serverActualGrade +
        '급)과 다릅니다!'
    };
  }

  return {
    valid: true,
    serial_number: state.guild_card.serial_number,
    registered_display_name: state.guild_card.registered_display_name,
    jobs_summary: global.FRankDays.formatRegisteredJobsSummary(state),
    message:
      '=== [길드 원부 진위 확인: 정상 공인] ===\n' +
      ' · 성명: ◆ ' + state.guild_card.registered_display_name + '\n' +
      ' · 등록번호: ' + state.guild_card.serial_number + '\n' +
      ' · 특수능력: ' + state.special_ability.ability_id + ' (F급)\n' +
      ' · 현재 공인 자격: ' + global.FRankDays.formatRegisteredJobsSummary(state) + '\n' +
      ' · 발급일/발급처: ' + (state.guild_card.issued_date || '아르베른력 412년') + ' / ' + state.guild_card.issued_agency
  };
};

global.FRankDays.syncFtbQuestStagesForPlayer = function (player) {
  if (!player) return { synced: [] };
  var state = global.FRankDays.loadPlayerState(player);
  var ob = state.starter_onboarding;
  var synced = [];

  function mark(cond, stageId) {
    if (cond) {
      global.FRankDays.grantPlayerStageOnce(player, stageId);
      synced.push(stageId);
    }
  }

  var fcraftV9 = typeof global.FRankDays.isFcraftV9Cohort === 'function' && global.FRankDays.isFcraftV9Cohort(player);
  if (!fcraftV9) {
    mark(Boolean(ob.quests.q01_first_day.reached_square || ob.quests.q01_first_day.found_guild), 'frank_ch1_reached_square');
    mark(Boolean(ob.quests.q01_first_day.found_guild), 'frank_ch1_found_guild');
    mark(Boolean(ob.quests.q01_first_day.talked_hess), 'frank_ch1_talked_hess');
    mark(Boolean(ob.quests.q03_first_job.registered_any_job), 'frank_ch1_first_job');
  }
  if (typeof global.FRankDays.syncFcraftV9Quests === 'function') global.FRankDays.syncFcraftV9Quests(player, state);
  mark(Boolean(state.flags.darim_farming_orientation_done), 'frank_ch2_darim_intro');
  mark(state.ecology_log.observed_animals.length >= 2, 'frank_ch2_animal_care');
  mark(Boolean(ob.quests.q04_first_steps.visited_serdin_entrance), 'frank_ch3_serdin_visited');
  mark(
    state.ecology_log.monster_codex.length >= 1 || state.personal_quests.hess.inspected_ranger_camp,
    'frank_ch3_monster_survey'
  );
  mark(ob.quests.q04_first_steps.greeted_villagers.length >= 3, 'frank_ch4_greeted_three');

  var hasRapport = false;
  var hasResolvedPq = false;
  for (var i = 0; i < global.FRankDays.ACTIVE_NPCS.length; i++) {
    var nid = global.FRankDays.ACTIVE_NPCS[i];
    if (state.relationships[nid] && state.relationships[nid].affinity >= 20) {
      hasRapport = true;
    }
  }
  if (
    state.personal_quests.hess.phase === 'RESOLVED' ||
    state.personal_quests.darim.phase === 'RESOLVED' ||
    state.personal_quests.roman.phase === 'RESOLVED'
  ) {
    hasResolvedPq = true;
  }
  mark(hasRapport, 'frank_ch4_rapport_any');
  mark(hasResolvedPq, 'frank_ch4_personal_resolved');

  var hasOtherELicense = false;
  var stateModified = false;
  var hasPuffish =
    typeof Platform !== 'undefined' &&
    Platform &&
    typeof Platform.isLoaded === 'function' &&
    Platform.isLoaded('puffish_skills');

  for (var j = 0; j < global.FRankDays.ALL_JOBS.length; j++) {
    var jobId = global.FRankDays.ALL_JOBS[j];
    var g = state.job_licenses[jobId].grade;
    var gIdx = global.FRankDays.GRADE_ORDER.indexOf(g);
    if (gIdx >= global.FRankDays.GRADE_ORDER.indexOf('E')) {
      if (jobId !== 'farmer') {
        hasOtherELicense = true;
      }
      var bonusJobId = global.FRankDays.JOB_ALIASES_V96 && global.FRankDays.JOB_ALIASES_V96[jobId] || jobId;
      var bonusKey = 'skill_points_e_' + bonusJobId;
      if (!state.reward_ledger['v96_native_' + bonusKey] && hasPuffish && typeof global.FRankDays.deliverMidTierSkillPointsV93 === 'function') {
        // Source entitlement is set to2, never add2 on a retry. Preserve old sources.
        var nativeDelivered = global.FRankDays.deliverMidTierSkillPointsV93(player, {job:bonusJobId,grade:'E'});
        state = global.FRankDays.loadPlayerState(player);
        if (nativeDelivered) {
          state.reward_ledger[bonusKey] = true;
          state.reward_ledger['v96_native_' + bonusKey] = true;
          stateModified = true;
        }
      }
    }
  }
  mark(hasOtherELicense, 'frank_ch5_other_e_license');

  if (stateModified) {
    global.FRankDays.savePlayerState(player, state);
  }

  global.FRankDays.notifyFtbQuestsStageCheck(player);

  return { synced: synced };
};

if (typeof FTBQuestsEvents !== 'undefined' && FTBQuestsEvents && typeof FTBQuestsEvents.completed === 'function') {
  FTBQuestsEvents.completed(function (event) {
    if (event && event.player) {
      global.FRankDays.syncFtbQuestStagesForPlayer(event.player);
    }
  });
}

// [v8.2 중요 변경] 채팅창 성명 입력 기능 완전 폐지!
// PlayerEvents.chat 에서는 길드 등록증 성명을 절대 가로채거나 처리하지 않습니다. (NPC 대화 단축 번호만 유지)
if (typeof PlayerEvents !== 'undefined' && PlayerEvents.chat) {
  PlayerEvents.chat(function (event) {
    var player = event.player;
    if (!player) return;
    var state = global.FRankDays.loadPlayerState(player);

    if (
      state.npc_dialog &&
      state.npc_dialog.open &&
      typeof global.FRankDays.handleNpcDialogChatShortcut === 'function'
    ) {
      var handled = global.FRankDays.handleNpcDialogChatShortcut(player, String(event.message || '').trim());
      if (handled && typeof event.cancel === 'function') {
        event.cancel();
      }
    }
  });
}

// 전용 길드 등록증 GUI 패킷 수신 (이름 확인 제출 / 취소 닫기 / 퀘스트북 동기화)
if (typeof NetworkEvents !== 'undefined' && NetworkEvents.dataReceived) {
  NetworkEvents.dataReceived('f_rank_days:submit_guild_card_name', function (event) {
    var player = event.player;
    if (!player) return;
    var submittedName = event.data && event.data.name !== undefined ? String(event.data.name) : '';
    var res = global.FRankDays.issueOrUpdateGuildCard(player, submittedName);
    if (player.tell) player.tell(res.message);
  });

  NetworkEvents.dataReceived('f_rank_days:close_guild_card_ui', function (event) {
    if (event.player) {
      global.FRankDays.closeGuildCardUi(event.player);
    }
  });

  NetworkEvents.dataReceived('f_rank_days:sync_questbook_now', function (event) {
    if (event.player) {
      global.FRankDays.syncFtbQuestStagesForPlayer(event.player);
    }
  });
}

if (typeof PlayerEvents !== 'undefined' && PlayerEvents.tick) {
  PlayerEvents.tick(function (event) {
    var player = event.player;
    if (!player) return;
    var ageVal = player.age !== undefined ? Number(player.age) : Number(player.tickCount || 0);
    if (ageVal % 20 === 0) {
      var state = global.FRankDays.loadPlayerState(player);
      if (
        state.guild_card.ui_open &&
        !state.guild_card.awaiting_name_input &&
        state.guild_card.ui_auto_hide_at > 0 &&
        Date.now() >= state.guild_card.ui_auto_hide_at
      ) {
        global.FRankDays.closeGuildCardUi(player);
      }
    }
    if (ageVal % 60 === 0) {
      global.FRankDays.notifyFtbQuestsStageCheck(player);
    }
  });
}

if (typeof ItemEvents !== 'undefined' && ItemEvents.rightClicked) {
  ItemEvents.rightClicked(function (event) {
    var player = event.player;
    var item = event.item;
    if (!player || !item || String(item.id) !== 'f_rank_days:guild_citizen_card') return;
    var check = global.FRankDays.verifyGuildCardAuthenticity(player, item);
    if (check.valid) {
      global.FRankDays.openGuildRegistrationUi(player, 'VIEW');
    }
    if (player.tell) {
      player.tell(check.message);
    }
  });
}
