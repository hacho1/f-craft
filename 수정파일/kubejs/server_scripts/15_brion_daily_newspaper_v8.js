// 《F급의 나날》 KubeJS 6 Server Script - v8.1 Hidden Death Messages & 《브리온 일보》 Monotonic Single-Publish Newspaper Engine
// 파일 경로: kubejs/server_scripts/15_brion_daily_newspaper_v8.js
// 핵심 보완 사항 (항목 8):
// 1. 침대 수면(Bed Sleep), 시간 명령어(`/time set day`, `/time set 0`, `/time add`), 플레이어 재접속(Reconnect), 서버 재시작(Server Restart) 등
//    어떤 상황에서도 동일 날짜 호가 절대 중복 발행되지 않고 플레이어당 호별 실물 신문도 딱 1회만 배달되도록 단조 증가 달력(`monotonic_calendar_day`)과
//    영구 저장 원장(`editions_by_day` + `delivered_player_uuids`)을 이중 결합했습니다!

global.FRankDays = global.FRankDays || {};

// A permanent special edition has its own ID and delivery state; daily editions stay immutable.
global.FRankDays.publishChapter1FinaleExtraV10=function(player,serial){
 var F=global.FRankDays,s=F.loadPlayerState(player),r=s.chapter1_v10&&s.chapter1_v10.finale;
 if(!r||r.status!=='GRANTED'||r.serial!==String(serial)||!F.getCottageWorldIdV10||r.world!==F.getCottageWorldIdV10(player.server))return{ok:false,reason:'committed_finale_required'};
 var arch=F.loadNewspaperArchiveV8(player.server);arch.chapter1_special_editions_v10=arch.chapter1_special_editions_v10||{};
 if(arch.chapter1_special_editions_v10[serial])return{ok:true,already:true,edition:arch.chapter1_special_editions_v10[serial]};
 var edition={id:String(serial),owner_uuid:String(player.uuid),world_id:r.world,title:'《브리온 일보》 1챕터 완결 특별호',day:F.getCurrentGameDayV8(player.server),public_articles:[{category:'1면 · 개척 호외',headline:String(player.username)+' 모험가, 브리온의 첫 여정을 완수하다!',source_event:{type:'CHAPTER1_FINALE_V10',route:r.route,actor_uuid:String(player.uuid)}}],personal_notices:['아르베른 본토 우선 출항권이 발급되었습니다. 이후에도 브리온에서 자유롭게 성장할 수 있습니다.'],published_at_ms:Date.now()};
 arch.chapter1_special_editions_v10[serial]=edition;F.saveNewspaperArchiveV8(player.server,arch);return{ok:true,published:true,edition:edition};
};
global.FRankDays.readChapter1FinaleExtraV10=function(player,serial){
 var F=global.FRankDays,s=F.loadPlayerState(player),r=s.chapter1_v10&&s.chapter1_v10.finale;if(!r||r.status!=='GRANTED'||r.serial!==String(serial))return{ok:false,reason:'personal_edition_required'};
 var arch=F.loadNewspaperArchiveV8(player.server),ed=arch.chapter1_special_editions_v10&&arch.chapter1_special_editions_v10[serial];if(!ed||ed.owner_uuid!==String(player.uuid)||ed.world_id!==F.getCottageWorldIdV10(player.server))return{ok:false,reason:'edition_unavailable'};
 player.sendData('f_rank_days:open_newspaper_ui',{title:ed.title,public_articles:ed.public_articles.map(function(a){return'['+a.category+'] '+a.headline;}),personal_notices:ed.personal_notices});return{ok:true,edition:ed,reward_granted_on_read:false};
};

global.FRankDays.loadNewspaperArchiveV8 = function (server) {
  var fallback = {
    schema_version: '8.1.0',
    death_messages_hidden: false,
    monotonic_calendar_day: 0,
    last_observed_raw_day: null,
    day_offset_from_time_set: 0,
    last_checked_day: 0,
    pending_events: [],
    editions_by_day: {},
    edition_days_order: []
  };

  if (!server || !server.persistentData) {
    global.FRankDays._memNewspaperArchive = global.FRankDays._memNewspaperArchive || fallback;
    return global.FRankDays._memNewspaperArchive;
  }

  if (server.persistentData.f_rank_newspaper_v8) {
    try {
      var parsed = JSON.parse(String(server.persistentData.f_rank_newspaper_v8));
      if (parsed && parsed.editions_by_day) {
        if (typeof parsed.monotonic_calendar_day !== 'number') parsed.monotonic_calendar_day = Number(parsed.last_checked_day || 0);
        if (typeof parsed.day_offset_from_time_set !== 'number') parsed.day_offset_from_time_set = 0;
        if (parsed.last_observed_raw_day === undefined) parsed.last_observed_raw_day = null;
        if (!Array.isArray(parsed.pending_events)) parsed.pending_events = [];
        if (!Array.isArray(parsed.edition_days_order)) parsed.edition_days_order = Object.keys(parsed.editions_by_day).map(Number);
        return parsed;
      }
    } catch (e) {}
  }
  return fallback;
};

global.FRankDays.saveNewspaperArchiveV8 = function (server, archive) {
  if (!server || !server.persistentData) {
    global.FRankDays._memNewspaperArchive = archive;
    return;
  }
  server.persistentData.f_rank_newspaper_v8 = JSON.stringify(archive);
};

// `/time set day` 등 역방향 시간 변경에도 달력 날짜가 되감기거나 중복 발행되지 않는 단조 증가(Monotonic) 게임 날짜 계산기!
global.FRankDays.getCurrentGameDayV8 = function (server) {
  var rawDay = 0;
  if (typeof global.FRankDays._mockGameDay === 'number') {
    rawDay = Math.max(0, Math.floor(global.FRankDays._mockGameDay));
  } else if (server) {
    try {
      var ow = typeof server.overworld === 'function' ? server.overworld() : null;
      if (ow && typeof ow.getDayTime === 'function') {
        rawDay = Math.max(0, Math.floor(Number(ow.getDayTime()) / 24000));
      } else if (ow && ow.dayTime !== undefined) {
        rawDay = Math.max(0, Math.floor(Number(ow.dayTime) / 24000));
      }
    } catch (e) {}
  }

  if (!server) return rawDay;

  var arch = global.FRankDays.loadNewspaperArchiveV8(server);
  if (arch.last_observed_raw_day === null || arch.last_observed_raw_day === undefined) {
    arch.last_observed_raw_day = rawDay;
    arch.monotonic_calendar_day = Math.max(Number(arch.monotonic_calendar_day || 0), rawDay + Number(arch.day_offset_from_time_set || 0));
    global.FRankDays.saveNewspaperArchiveV8(server, arch);
    return arch.monotonic_calendar_day;
  }

  // 케이스 1: 관리자가 `/time set day` 또는 `/time set 0`을 실행해 rawDay가 과거로 줄어든 경우 -> 오프셋을 보정하여 현재 달력 날짜를 그대로 유지!
  if (rawDay < arch.last_observed_raw_day) {
    arch.day_offset_from_time_set = arch.monotonic_calendar_day - rawDay;
    arch.last_observed_raw_day = rawDay;
    global.FRankDays.saveNewspaperArchiveV8(server, arch);
    return arch.monotonic_calendar_day;
  }

  // 케이스 2: 침대 수면, 자연 일출, `/time add 24000` 등으로 날짜가 정상 전진한 경우
  if (rawDay > arch.last_observed_raw_day) {
    var delta = rawDay - arch.last_observed_raw_day;
    arch.last_observed_raw_day = rawDay;
    // 비정상적인 수백 일 점프(`/time set 2400000`) 시에도 달력은 정합하게 증가하되 과거 발행분과 절대 충돌하지 않음
    arch.monotonic_calendar_day += delta;
    global.FRankDays.saveNewspaperArchiveV8(server, arch);
  }

  return arch.monotonic_calendar_day;
};

global.FRankDays.enforceHiddenDeathMessagesV8 = function (server) {
  if (!server) return { ok: false };
  if (typeof server.runCommandSilent === 'function') {
    server.runCommandSilent('gamerule showDeathMessages false');
  }
  var arch = global.FRankDays.loadNewspaperArchiveV8(server);
  arch.death_messages_hidden = true;
  global.FRankDays.saveNewspaperArchiveV8(server, arch);
  return { ok: true, showDeathMessages: false };
};

global.FRankDays.resolveWorldRegionNameV8 = function (server, x, y, z) {
  var anchor = global.FRankDays.getVillageAnchor ? global.FRankDays.getVillageAnchor(server) : { x: 0, y: 68, z: 0 };
  var dx = Number(x || 0) - Number(anchor.x || 0);
  var dz = Number(z || 0) - Number(anchor.z || 0);
  var dist = Math.sqrt(dx * dx + dz * dz);
  if (Number(y || 68) < 35) return '브리온 심층 지하 갱도';
  if (dist < 75) return '브리온 마을 경계 내';
  if (Math.abs(dx - 168) <= 32 && Math.abs(dz - 168) <= 32) return '강철 수호자의 시련 제단';
  if (dz < -75) return '북부 구릉지 초입';
  return '세르딘 숲 초입';
};

global.FRankDays.formatRevivalAwareDeathHeadlineV8 = function (displayName, rawCause, regionName, dayNum) {
  var causeMap = {
    mob: '야생 마물의 기습을 받아',
    fall: '가파른 절벽에서 실족하여',
    lava: '지열 용암 지대에 휩쓸려',
    drown: '급류에 휩쓸려 호흡 곤란으로',
    starve: '장기 탐색 중 기력 고갈로'
  };
  var phrase = causeMap[String(rawCause || '').toLowerCase()] || '예기치 못한 위험에 휘말려';
  return (
    '[제' + dayNum + '일 사건·구조] 정착민 ' + displayName +
    ' 씨가 ' + regionName + ' 일대에서 ' + phrase +
    ' 의식을 잃고 쓰러졌으나, 경비 순찰대에 의해 긴급 구조·치료 후 무사히 복귀했다.'
  );
};

global.FRankDays.recordNewspaperEventV8 = function (server, evt) {
  if (!server || !evt || !evt.type) return { ok: false, reason: 'invalid_event' };
  var arch = global.FRankDays.loadNewspaperArchiveV8(server);
  var day = evt.day !== undefined ? Number(evt.day) : global.FRankDays.getCurrentGameDayV8(server);
  var dedupId = String(evt.type) + ':' + String(evt.actor_uuid || 'world') + ':' + String(day) + ':' + String(evt.sub_key || 'main');

  for (var i = 0; i < arch.pending_events.length; i++) {
    if (arch.pending_events[i].dedup_id === dedupId) {
      return { ok: false, reason: 'duplicate_event_ignored', dedup_id: dedupId };
    }
  }

  var record = {
    dedup_id: dedupId,
    type: String(evt.type),
    scope: String(evt.scope || 'PUBLIC'),
    actor_uuid: evt.actor_uuid ? String(evt.actor_uuid) : null,
    display_name: String(evt.display_name || '익명 정착민'),
    day: day,
    cause: evt.cause ? String(evt.cause) : null,
    region: evt.region ? String(evt.region) : '브리온 일대',
    boss_name: evt.boss_name ? String(evt.boss_name) : null,
    job_label: evt.job_label ? String(evt.job_label) : null,
    new_grade: evt.new_grade ? String(evt.new_grade) : null,
    custom_headline: evt.custom_headline ? String(evt.custom_headline) : null,
    published_in_day: null
  };

  arch.pending_events.push(record);
  global.FRankDays.saveNewspaperArchiveV8(server, arch);
  return { ok: true, recorded: record };
};

global.FRankDays.recordPlayerDeathIncidentV8 = function (player, causeStrOpt, serverOverride) {
  var srv = serverOverride || (player ? player.server : null);
  if (!player || !srv) return { ok: false, reason: 'no_player_or_server' };

  var state = global.FRankDays.loadPlayerState ? global.FRankDays.loadPlayerState(player, srv) : null;
  var dispName =
    state && state.guild_card && state.guild_card.issued && state.guild_card.registered_display_name
      ? state.guild_card.registered_display_name
      : String(player.username || '정착민');
  var day = global.FRankDays.getCurrentGameDayV8(srv);
  var region = global.FRankDays.resolveWorldRegionNameV8(srv, player.x, player.y, player.z);
  var cause = String(causeStrOpt || 'unknown_hazard');

  var now = global.FRankDays.nowMsV8 ? global.FRankDays.nowMsV8() : Date.now();
  // ServerPlayer is a Java object: arbitrary JavaScript fields are not writable.
  // One compact record per UUID belongs to this world and survives respawn/restart.
  var deathKey = 'fcraft_death_notice_v96_' + String(player.uuid);
  var deathRecord = {};
  if (srv.persistentData.contains(deathKey)) {
    try { deathRecord = JSON.parse(String(srv.persistentData.getString(deathKey))) || {}; } catch (ignored) {}
  }
  var lastAt = Number(deathRecord.lastAt || 0);
  if (lastAt > 0 && now >= lastAt && now - lastAt < 1500) {
    return { ok: false, reason: 'duplicate_death_packet_throttled' };
  }
  var seq = Number(deathRecord.day) === day ? Number(deathRecord.seq || 0) + 1 : 1;
  srv.persistentData.putString(deathKey, JSON.stringify({ lastAt: now, day: day, seq: seq }));

  return global.FRankDays.recordNewspaperEventV8(srv, {
    type: 'PLAYER_DEATH',
    scope: 'PUBLIC',
    actor_uuid: String(player.uuid || player.username),
    display_name: dispName,
    day: day,
    cause: cause,
    region: region,
    sub_key: cause + '#' + seq
  });
};

// 플레이어에게 특정 호 신문을 호당 평생 1회만 배달하는 안전 배달기 (재접속·버리기 후 재접속 중복 지급 방지!)
global.FRankDays.deliverNewspaperEditionOnceToPlayerV8 = function (server, player, editionObj) {
  if (!server || !player || !editionObj) return { delivered: false };
  var pUuid = String(player.uuid || player.username || '');
  if (!pUuid) return { delivered: false };

  editionObj.delivered_player_uuids = editionObj.delivered_player_uuids || {};
  if (editionObj.delivered_player_uuids[pUuid]) {
    return { delivered: false, reason: 'already_delivered_this_edition_to_player' };
  }

  editionObj.delivered_player_uuids[pUuid] = true;
  if (player.give && global.FRankDays.countPlayerItem && global.FRankDays.countPlayerItem(player, 'f_rank_days:brion_daily_newspaper') === 0) {
    player.give('1x f_rank_days:brion_daily_newspaper');
  }
  if (player.tell) {
    player.tell('📰 [조간 배달] ' + editionObj.title + '가 발행되었습니다! (/frank news read 또는 신문 아이템 우클릭)');
  }
  return { delivered: true };
};

// 다음 날 《브리온 일보》 자동 발행기 (수면 · 시간 변경 · 재접속 · 서버 재시작 모두 중복 발행 0건!)
global.FRankDays.checkAndPublishDailyNewspaperV8 = function (server, forceDayOpt) {
  if (!server) return { published: false, reason: 'no_server' };
  var curDay = forceDayOpt !== undefined ? Number(forceDayOpt) : global.FRankDays.getCurrentGameDayV8(server);
  var arch = global.FRankDays.loadNewspaperArchiveV8(server);

  if (curDay <= 0) {
    arch.last_checked_day = 0;
    global.FRankDays.saveNewspaperArchiveV8(server, arch);
    return { published: false, reason: 'day_zero_initial' };
  }

  var dayKey = String(curDay);
  if (arch.editions_by_day[dayKey]) {
    // 이미 해당 날짜 신문이 발행되어 있다면 절대 중복 발행하지 않고, 아직 배달받지 못한 신규 접속자에게만 1회 배달 점검 후 종료!
    var existingEd = arch.editions_by_day[dayKey];
    if (Array.isArray(server.players)) {
      for (var ep = 0; ep < server.players.length; ep++) {
        global.FRankDays.deliverNewspaperEditionOnceToPlayerV8(server, server.players[ep], existingEd);
      }
    }
    arch.last_checked_day = Math.max(Number(arch.last_checked_day || 0), curDay);
    global.FRankDays.saveNewspaperArchiveV8(server, arch);
    return { published: false, reason: 'already_published_for_day', day: curDay, edition: existingEd };
  }

  var publicArticles = [];
  var personalNoticesByUuid = {};
  var remainingPending = [];

  for (var i = 0; i < arch.pending_events.length; i++) {
    var ev = arch.pending_events[i];
    if (ev.published_in_day !== null) continue;
    if (ev.day < curDay) {
      ev.published_in_day = curDay;
      if (ev.type === 'PLAYER_DEATH') {
        publicArticles.push({
          category: '사건·구조',
          headline: global.FRankDays.formatRevivalAwareDeathHeadlineV8(ev.display_name, ev.cause, ev.region, ev.day),
          source_event: ev
        });
        if (ev.actor_uuid) {
          personalNoticesByUuid[ev.actor_uuid] = personalNoticesByUuid[ev.actor_uuid] || [];
          personalNoticesByUuid[ev.actor_uuid].push('[개인 안전·유실물 안내] 어제(' + ev.region + ') 구조 기록이 접수되었습니다. 분실 장비가 있다면 길드 유실물 창구(/frank lost list)를 확인하세요.');
        }
      } else if (ev.type === 'JOB_PROMOTION') {
        publicArticles.push({
          category: '길드 인사·승급',
          headline: '[공인 승급] ' + ev.display_name + ' 모험가, 아르베른 통합 길드 [' + (ev.job_label || '전문직') + ' ' + (ev.new_grade || 'E') + '급] 자격시험 최종 합격!',
          source_event: ev
        });
      } else if (ev.type === 'BOSS_FIRST_CLEAR') {
        publicArticles.push({
          category: '특종 호외',
          headline: '★ [특종 호외] ' + ev.display_name + ' 모험가, 고대 위협 『' + (ev.boss_name || '강철 수호자') + '』 최초 토벌 쾌거!',
          source_event: ev
        });
      } else if (ev.type === 'COMPENDIUM_COMPLETE_V99') {
        publicArticles.push({
          category: '특종 호외',
          headline: ev.custom_headline || ('★ [도감 완성 호외] ' + ev.display_name + ' 모험가, 80종의 기록을 완성하다!'),
          source_event: ev
        });
      } else if (ev.custom_headline) {
        publicArticles.push({
          category: '마을 소식',
          headline: ev.custom_headline,
          source_event: ev
        });
      }
    } else {
      remainingPending.push(ev);
    }
  }

  // 사건이 없던 평온한 날에도 변방 생활 기사를 1건 수록하여 일간지 연속성 유지
  if (publicArticles.length === 0) {
    publicArticles.push({
      category: '마을 생활·상점',
      headline: '[브리온 일기] 다림의 농장 보리 수확 순조 · 나우의 대장간 숙련 단조(+5%p) 및 고리의 여관 화로 수프 성황'
    });
  }

  // Only the new completion article receives front-page precedence; older articles
  // retain their relative order, including existing boss and village news.
  var completionFront = [], previousArticles = [];
  for (var ci = 0; ci < publicArticles.length; ci++) {
    if (publicArticles[ci].source_event && publicArticles[ci].source_event.type === 'COMPENDIUM_COMPLETE_V99') completionFront.push(publicArticles[ci]);
    else previousArticles.push(publicArticles[ci]);
  }
  publicArticles = completionFront.concat(previousArticles);
  var edition = {
    edition_number: arch.edition_days_order.length + 1,
    day: curDay,
    title: '《브리온 일보》 제' + (arch.edition_days_order.length + 1) + '호 (제' + curDay + '일 조간)',
    published_at_ms: global.FRankDays.nowMsV8 ? global.FRankDays.nowMsV8() : Date.now(),
    public_articles: publicArticles,
    personal_notices_by_uuid: personalNoticesByUuid,
    delivered_player_uuids: {}
  };

  arch.pending_events = remainingPending;
  arch.editions_by_day[dayKey] = edition;
  arch.edition_days_order.push(curDay);
  arch.last_checked_day = curDay;

  if (Array.isArray(server.players)) {
    for (var p = 0; p < server.players.length; p++) {
      global.FRankDays.deliverNewspaperEditionOnceToPlayerV8(server, server.players[p], edition);
    }
  }

  global.FRankDays.saveNewspaperArchiveV8(server, arch);
  return { published: true, day: curDay, edition: edition };
};

// 신문 열람 (반복 열람 시 보상 복제 0건 보장!)
global.FRankDays.readBrionNewspaperV8 = function (player, requestedDayOpt) {
  var srv = player ? player.server : null;
  if (!player || !srv) return { ok: false, reason: 'no_server' };

  var arch = global.FRankDays.loadNewspaperArchiveV8(srv);
  var targetDay = requestedDayOpt !== null && requestedDayOpt !== undefined
    ? Number(requestedDayOpt)
    : (arch.edition_days_order.length > 0 ? arch.edition_days_order[arch.edition_days_order.length - 1] : null);

  if (targetDay === null || !arch.editions_by_day[String(targetDay)]) {
    var emptyMsg = '[브리온 일보] 아직 발행된 조간 신문이 없습니다. 첫날의 사건들은 다음 날 아침 조간에 실립니다.';
    if (player.tell) player.tell(emptyMsg);
    return { ok: false, reason: 'no_published_edition_yet', reward_granted_on_read: false, message: emptyMsg };
  }

  var ed = arch.editions_by_day[String(targetDay)];
  var pUuid = String(player.uuid || player.username);
  var myPersonal = (ed.personal_notices_by_uuid && ed.personal_notices_by_uuid[pUuid]) ? ed.personal_notices_by_uuid[pUuid] : [];

  var lines = ['========================================', '📰 ' + ed.title, '----------------------------------------'];
  for (var i = 0; i < ed.public_articles.length; i++) {
    lines.push('• [' + ed.public_articles[i].category + '] ' + ed.public_articles[i].headline);
  }
  if (myPersonal.length > 0) {
    lines.push('----------------------------------------');
    for (var j = 0; j < myPersonal.length; j++) {
      lines.push('✉ ' + myPersonal[j]);
    }
  }
  lines.push('========================================');
  var fullText = lines.join('\n');

  if (player.tell) player.tell(fullText);
  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:open_newspaper_ui', {
      title: ed.title,
      public_articles: ed.public_articles.map(function (a) { return '[' + a.category + '] ' + a.headline; }),
      personal_notices: myPersonal
    });
  }

  return {
    ok: true,
    day: targetDay,
    edition: ed,
    personal_notices: myPersonal,
    reward_granted_on_read: false,
    formatted_text: fullText
  };
};

// Bound special-edition papers reopen their permanent edition; ordinary daily reads are unchanged.
(function(F){var daily=F.readBrionNewspaperV8;F.readBrionNewspaperV8=function(p,day){var stack=p&&p.mainHandItem,n=stack&&stack.nbt&&stack.nbt.FCraftChapter1ExtraV10;if(day===undefined&&n)return F.readChapter1FinaleExtraV10(p,String(n.edition_id));return daily(p,day);};})(global.FRankDays);

// 기존 E급 자격시험 합격 비파괴 후킹
global.FRankDays._emitPromotionToNewsV8 = function (player, jobId, res) {
  if (res && res.ok && (res.certified || res.promoted) && player && player.server) {
    var st = global.FRankDays.loadPlayerState ? global.FRankDays.loadPlayerState(player) : null;
    var dName = (st && st.guild_card && st.guild_card.registered_display_name) || String(player.username || '정착민');
    var jLabel = (global.FRankDays.JOB_LABELS && global.FRankDays.JOB_LABELS[jobId]) || jobId;
    global.FRankDays.recordNewspaperEventV8(player.server, {
      type: 'JOB_PROMOTION',
      scope: 'PUBLIC',
      actor_uuid: String(player.uuid || player.username),
      display_name: dName,
      job_id: jobId,
      job_label: jLabel,
      new_grade: res.new_grade || 'E',
      sub_key: jobId + '_' + (res.new_grade || 'E')
    });
  }
};

if (typeof global.FRankDays.evaluateFarmerPracticalAndCertify === 'function' && !global.FRankDays._wrappedFarmerCertForNewsV8) {
  var _origFarmerCert = global.FRankDays.evaluateFarmerPracticalAndCertify;
  global.FRankDays._wrappedFarmerCertForNewsV8 = true;
  global.FRankDays.evaluateFarmerPracticalAndCertify = function (player) {
    var res = _origFarmerCert.apply(this, arguments);
    global.FRankDays._emitPromotionToNewsV8(player, 'farmer', res);
    return res;
  };
}

if (typeof global.FRankDays.evaluateJobPracticalAndCertify === 'function' && !global.FRankDays._wrappedExamCertForNewsV8) {
  var _origEvalCert = global.FRankDays.evaluateJobPracticalAndCertify;
  global.FRankDays._wrappedExamCertForNewsV8 = true;
  global.FRankDays.evaluateJobPracticalAndCertify = function (player, jobId) {
    var res = _origEvalCert.apply(this, arguments);
    global.FRankDays._emitPromotionToNewsV8(player, jobId, res);
    return res;
  };
}

if (typeof ServerEvents !== 'undefined') {
  if (ServerEvents.loaded) {
    ServerEvents.loaded(function (event) {
      if (event && event.server) {
        global.FRankDays.enforceHiddenDeathMessagesV8(event.server);
      }
    });
  }
  if (ServerEvents.tick) {
    ServerEvents.tick(function (event) {
      var srv = event.server;
      if (!srv) return;
      global.FRankDays._newsTickCounter = Number(global.FRankDays._newsTickCounter || 0) + 1;
      if (global.FRankDays._newsTickCounter % 100 !== 0) return;
      global.FRankDays.checkAndPublishDailyNewspaperV8(srv);
    });
  }
}

// 플레이어 재접속 시 당일 이미 발행된 호가 있으면 중복 발행 없이 미수령 여부만 1회 점검!
if (typeof PlayerEvents !== 'undefined' && PlayerEvents.loggedIn) {
  PlayerEvents.loggedIn(function (event) {
    if (!event || !event.player || !event.server) return;
    var arch = global.FRankDays.loadNewspaperArchiveV8(event.server);
    if (arch.edition_days_order.length > 0) {
      var latestDay = arch.edition_days_order[arch.edition_days_order.length - 1];
      var latestEd = arch.editions_by_day[String(latestDay)];
      if (latestEd) {
        global.FRankDays.deliverNewspaperEditionOnceToPlayerV8(event.server, event.player, latestEd);
        global.FRankDays.saveNewspaperArchiveV8(event.server, arch);
      }
    }
  });
}

if (typeof EntityEvents !== 'undefined' && EntityEvents.death) {
  EntityEvents.death(function (event) {
    var ent = event.entity;
    if (!ent) return;
    if (typeof ent.isPlayer === 'function' ? ent.isPlayer() : Boolean(ent.username)) {
      var srcType = event.source && event.source.getType ? String(event.source.getType()) : 'mob';
      global.FRankDays.recordPlayerDeathIncidentV8(ent, srcType, ent.server);
    }
  });
}

if (typeof ItemEvents !== 'undefined' && ItemEvents.rightClicked) {
  ItemEvents.rightClicked(function (event) {
    if (!event || !event.item || !event.player) return;
    if (String(event.item.id) === 'f_rank_days:brion_daily_newspaper') {
      global.FRankDays.readBrionNewspaperV8(event.player, null);
    }
  });
}
