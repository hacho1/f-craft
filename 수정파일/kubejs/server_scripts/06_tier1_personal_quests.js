// 《F급의 나날》 KubeJS 6 Server Script - Tier 1 NPC Personal Quests (Hess, Darim, Roman)
// 파일 경로: kubejs/server_scripts/06_tier1_personal_quests.js
// 핵심 서사 원칙:
// 1. 신뢰 단계(호감도 60 이상)에서 시작되며, 플레이어는 해결사(대리 수행자)가 아니라 조력자이자 계기 제공자로 참여합니다.
// 2. 최종 결단과 성장은 NPC 본인이 직접 수행합니다 (예: 로만의 시험 물약을 플레이어가 대신 제조해 주지 않음).
// 3. 다림의 진로 등 복수 결말은 모두 동등하게 가치 있는 성장으로 존중하며, 특정 진로를 '유일한 정답'으로 강요하지 않습니다.
// 4. 사건 해결 후 호감도 80 이상(5단계 relationship_choice)에 도달하더라도 자동 연애로 전환되지 않습니다.
// 5. 헤스에게는 마왕 관련 루머를 일절 적용하지 않으며, 휘연의 연계 자문은 말투 미확정 상태를 지켜 중립 서술문으로만 표현합니다.

global.FRankDays = global.FRankDays || {};

global.FRankDays.TIER1_PERSONAL_QUEST_ENDINGS = {
  hess: {
    formal_audit_petition: {
      title: '정식 규정 개정 엔딩 — 현장 위험도 이중 검수제 도입',
      resolution_dialogue:
        '[헤스] "보내주신 세르딘 야영지 실측 기록지와 의료소 부상 통계를 첨부해, 제 이름으로 중앙 감찰부에 정식 규정 개정 청원서를 발송했습니다. 혼자 야근으로 경고 쪽지만 붙이던 방식은 제가 쓰러지면 끝이라는 말씀이 맞았습니다. 다음 달부터 변방 지부 이중 검수제가 시행되고 보조 서기도 배치됩니다... 덕분에 저도 처음으로 주간 정기 휴무를 신청했습니다."',
      aftermath_greeting:
        '[헤스] "안녕하십니까. 새로 도입된 현장 위험도 이중 검수표는 오늘도 이상 없습니다. 오늘은 정시 퇴근 예정이니 창구 마감 전에 편히 말씀해 주십시오."'
    },
    local_transparent_notice: {
      title: '지부 자치 수칙 관철 엔딩 — 실측 위험도 투명 병기',
      resolution_dialogue:
        '[헤스] "일부 상단 의뢰인들의 반발은 있었지만, 확보해 주신 객관적 현장 실측 기록을 근거로 브리온 지부 게시판에 \'의뢰인 신고 등급\'과 \'길드 실측 위험도\'를 나란히 공개 게시하는 자치 수칙을 직접 공포했습니다. 초보 모험가들이 표지 누락으로 다치는 일은 이제 제가 막겠습니다."',
      aftermath_greeting:
        '[헤스] "브리온 지부 게시판의 실측 위험도 표시는 매일 직접 갱신하고 있습니다. 객관적인 자료를 함께 모아 주신 덕분입니다."'
    }
  },

  darim: {
    dedicated_farmer: {
      title: '대지의 파수꾼(농부 전념) 엔딩',
      resolution_dialogue:
        '[다림] "오랫동안 도망친 건 아닐까 자책했는데, 당신 말대로 이 밀밭이 브리온 사람들의 하루를 살리고 있었네요. 녹슨 검은 친구의 추모비 곁에 정중히 묻어 주고 왔어요. 이제 악몽 대신 내일 심을 씨앗을 생각하며 자랑스럽게 C급 농부로서 이 땅을 지킬게요!"',
      aftermath_greeting:
        '[다림] "요즘은 밤에 푹 자요! 새로 개량 중인 겨울 밀 이삭이 아주 튼튼하게 올라왔답니다. 언제든 구경 오세요."'
    },
    dual_wheat_and_sword: {
      title: '두 손의 계절(농사·외곽 안전 길잡이 병행) 엔딩',
      resolution_dialogue:
        '[다림] "농부로서의 삶도, 옛 친구와 함께 배웠던 검술도 어느 한쪽을 버릴 필요가 없었어요. 낮에는 지금처럼 밀밭을 가꾸고, 해 질 녘에는 세르딘 숲 초입에서 길 잃은 초보 정착민들이 다치지 않게 지키는 안전 길잡이로 검을 들기로 했어요!"',
      aftermath_greeting:
        '[다림] "오전에는 배수로 정비를 마쳤고, 저녁에는 숲 어귀 순찰을 돌 예정이에요. 두 손으로 지키는 계절이 참 든든하네요."'
    },
    cautious_swordsman_return: {
      title: '다시 묶는 검집(신중한 검사 재등록) 엔딩',
      resolution_dialogue:
        '[다림] "과거의 무모함과 지금의 신중함은 다르다는 걸 이제 알아요. 무리한 의뢰에 휩쓸리지 않는 제 원칙을 세우고, 오늘 헤스 씨 창구에서 정식으로 검사 재등록 서류를 다시 제출했어요. 밭일 틈틈이 기초 자세부터 천천히 다시 걸어 보려 해요."',
      aftermath_greeting:
        '[다림] "아침 이슬이 마르기 전에 목검 기본 베기 백 번을 채우고 밭에 나왔어요. 서두르지 않고 제 보폭대로 나아가 볼게요."'
    }
  },

  roman: {
    confident_entry: {
      title: '자립형 협력 엔딩 — 공동 자문 수용 및 A급 본선 출원',
      resolution_dialogue:
        '[로만] "...가져다준 다림의 토양 수분 기록이랑 의료소 임상 안정화 수치를 대조해서, 밤새 내 손으로 결정화 온도 곡선을 처음부터 다시 짰어. 결과는... 성공이야. 남한테 자문을 구한다고 내 실력이 사라지는 게 아니더군. 이번 회차 A급 연금술사 본선 심사, 내 이름으로 정식 출원했다. ...고맙다."',
      aftermath_greeting:
        '[로만] "왔어? 작업대 옆 보조 의자 비워 뒀으니까 잠깐 앉아. 새로 우린 약차 한 잔 내려놨어. ...계산서 안 끊으니까 그냥 마셔."'
    },
    thorough_verification: {
      title: '신중한 유보 엔딩 — 교차 검증 완성 후 차기 출원',
      resolution_dialogue:
        '[로만] "...네가 구해 온 토양 생육 기록과 임상 자료 덕분에 내가 놓쳤던 결정 붕괴 변수를 드디어 잡았어. 내 손으로 재설계한 시제품은 안정화됐지만, 성급하게 이번 시험에 내기보다 다림·의료소와 한 계절 더 교차 데이터를 검증해서 완벽한 내 논문으로 출원할 생각이야. 곁에서 묵묵히 기다려 줘서... 도움이 됐어."',
      aftermath_greeting:
        '[로만] "계절별 약초 수분 편차 표를 정리 중이야. 네가 도와준 방식대로 공동 검증 기록도 정식 각주로 남기고 있어. 차 식기 전에 마셔."'
    }
  }
};

// 1순위 NPC 3인 개인 퀘스트 통합 진행 함수
global.FRankDays.handleTier1PersonalQuest = function (player, npcId, action, choiceId) {
  if (npcId !== 'hess' && npcId !== 'darim' && npcId !== 'roman') {
    return {
      ok: false,
      reason: 'not_tier1_npc',
      message: '현재 인게임 개인 퀘스트가 구현된 1순위 NPC는 헤스(hess), 다림(darim), 로만(roman)입니다.'
    };
  }

  var state = global.FRankDays.loadPlayerState(player);
  var rel = state.relationships[npcId];
  var pq = state.personal_quests[npcId];

  // 1) 상태 조회
  if (!action || action === 'status') {
    return {
      ok: true,
      npc_id: npcId,
      phase: pq.phase,
      affinity: rel.affinity,
      stage: rel.stage,
      message:
        '[' +
        global.FRankDays.NPC_METADATA[npcId].name +
        ' 개인 서사 상태] 단계: ' +
        pq.phase +
        ' | 호감도: ' +
        rel.affinity +
        ' (' +
        rel.stage +
        '단계 ' +
        rel.stage_id +
        ')' +
        (pq.chosen_ending ? ' | 결말: ' + pq.chosen_ending : '')
    };
  }

  // 2) 사건 시작 (호감도 60 이상 신뢰 단계 필요)
  if (action === 'start') {
    if (pq.phase === 'RESOLVED') {
      var doneInfo = global.FRankDays.TIER1_PERSONAL_QUEST_ENDINGS[npcId][pq.chosen_ending];
      return {
        ok: true,
        already_resolved: true,
        message: doneInfo ? doneInfo.aftermath_greeting : '이미 해결된 개인 서사입니다.'
      };
    }
    if (rel.affinity < 60) {
      return {
        ok: false,
        reason: 'insufficient_trust',
        message:
          '[' +
          global.FRankDays.NPC_METADATA[npcId].name +
          '] 개인 서사를 시작하려면 먼저 일상 교류·의뢰를 통해 신뢰 단계(호감도 60 이상, 현재 ' +
          rel.affinity +
          ')에 도달해야 합니다.'
      };
    }

    rel.flags.incident_triggered = true;
    global.FRankDays.recalculateRelationshipStage(rel);
    pq.phase = 'CLUE_GATHERING';
    global.FRankDays.savePlayerState(player, state);

    if (npcId === 'hess') {
      return {
        ok: true,
        phase: 'CLUE_GATHERING',
        message:
          '[개인 서사 시작: 「접수창구 너머의 진실」]\n' +
          '야간까지 홀로 과거 의뢰 원부를 대조하던 헤스가 일부 상단 의뢰인의 위험 등급 축소 신고 관행을 털어놓습니다.\n' +
          '▶ 조력 목표 1: 세르딘 숲 폐야영지(serdin_ranger_camp)의 독서대를 조사해 현장 위험도 실측 기록지 확보 (독서대 우클릭 또는 /frank pquest hess camp_survey)\n' +
          '▶ 조력 목표 2: 휘연 의료소에서 초보 모험가 외상 통계 확인 (/frank pquest hess clinic_check)'
      };
    }
    if (npcId === 'darim') {
      return {
        ok: true,
        phase: 'CLUE_GATHERING',
        message:
          '[개인 서사 시작: 「녹슨 검과 밀밭」]\n' +
          '세르딘 숲 들짐승 소동 이후 다림이 유독 밤잠을 설치며 헛간 정리를 부탁합니다.\n' +
          '▶ 조력 목표 1: 다림 농장 헛간의 짚더미(hay_block)를 조사해 오래된 유품 확인 (짚더미 우클릭 또는 /frank pquest darim search_barn)\n' +
          '▶ 조력 목표 2: 다림에게 조심스럽게 과거 이야기를 듣고 마음 정리 돕기 (/frank pquest darim talk_sword)'
      };
    }
    if (npcId === 'roman') {
      return {
        ok: true,
        phase: 'CLUE_GATHERING',
        message:
          '[개인 서사 시작: 「혼자서는 완성할 수 없는 물약」]\n' +
          '물약가게 실험실에서 플라스크가 깨지는 소리가 납니다. 로만의 A급 시험 과제인 복합 재생약이 결정화 단계에서 계속 무너지고 있지만, 로만은 남에게 기대지 않겠다며 혼자 밤을 새웁니다.\n' +
          '▶ 조력 목표 1 (대리 제조 금지·참고 사료 수집): 다림에게 세르딘 약초 토양 생육 기록 자문 구하기 (/frank pquest roman ask_darim)\n' +
          '▶ 조력 목표 2: 휘연 의료소에서 마력 임상 안정화 문헌 확인하기 (/frank pquest roman ask_hwiyeon)\n' +
          '▶ 조력 목표 3: 두 참고 자료를 거래용 참고 문헌 명분으로 로만에게 건네기 (/frank pquest roman deliver_notes)'
      };
    }
  }

  // 3) NPC별 중간 단서·조력 단계 처리
  if (npcId === 'hess') {
    if (action === 'camp_survey') {
      if (pq.phase !== 'CLUE_GATHERING') {
        return { ok: false, reason: 'wrong_phase', message: '먼저 /frank pquest hess start 로 사건을 시작해 주세요.' };
      }
      pq.inspected_ranger_camp = true;
      if (player.give && global.FRankDays.countPlayerItem(player, 'f_rank_days:field_hazard_report') < 1) {
        player.give('f_rank_days:field_hazard_report');
      }
      if (pq.inspected_ranger_camp && pq.consulted_clinic_stats) {
        pq.phase = 'READY_FOR_CHOICE';
      }
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: true,
        phase: pq.phase,
        message:
          '[현장 답사 완료] 세르딘 숲 폐야영지의 훼손된 경고판과 마물 흔적을 채록해 《세르딘 숲 위험도 실측 기록지》를 작성했습니다!' +
          (pq.phase === 'READY_FOR_CHOICE'
            ? '\n▶ 이제 헤스의 제도 개선 방식을 함께 선택할 수 있습니다: /frank pquest hess choose formal_audit_petition 또는 /frank pquest hess choose local_transparent_notice'
            : '\n▶ 남은 조사: 휘연 의료소 외상 통계 교차 확인 (/frank pquest hess clinic_check)')
      };
    }

    if (action === 'clinic_check') {
      if (pq.phase !== 'CLUE_GATHERING') {
        return { ok: false, reason: 'wrong_phase', message: '먼저 /frank pquest hess start 로 사건을 시작해 주세요.' };
      }
      pq.consulted_clinic_stats = true;
      if (pq.inspected_ranger_camp && pq.consulted_clinic_stats) {
        pq.phase = 'READY_FOR_CHOICE';
      }
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: true,
        phase: pq.phase,
        message:
          '[의료소 교차 증빙 확인] (휘연이 개인정보를 가린 세르딘 숲 외곽 부상자 발생 구역 통계를 조용히 정리해 건네주었다.)' +
          (pq.phase === 'READY_FOR_CHOICE'
            ? '\n▶ 두 객관 증빙이 모두 모였습니다! 선택지:\n' +
              '  1) 중앙 감찰부 정식 규정 개정 청원: /frank pquest hess choose formal_audit_petition\n' +
              '  2) 브리온 지부 게시판 실측 위험도 병기 수칙: /frank pquest hess choose local_transparent_notice'
            : '\n▶ 남은 조사: 세르딘 숲 폐야영지 현장 기록 확보 (/frank pquest hess camp_survey)')
      };
    }
  }

  if (npcId === 'darim') {
    if (action === 'search_barn') {
      if (pq.phase !== 'CLUE_GATHERING') {
        return { ok: false, reason: 'wrong_phase', message: '먼저 /frank pquest darim start 로 사건을 시작해 주세요.' };
      }
      pq.found_rusty_sword = true;
      if (player.give && global.FRankDays.countPlayerItem(player, 'f_rank_days:rusty_companion_sword') < 1) {
        player.give('f_rank_days:rusty_companion_sword');
      }
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: true,
        phase: pq.phase,
        message:
          '[헛간 조사] 짚더미 아래에서 기름종이에 정성껏 싸인 《기름종이에 싸인 낡은 한손검》과 옛 동료의 인식표를 발견했습니다. 다림과 대화를 나눠 보세요 (/frank pquest darim talk_sword).'
      };
    }

    if (action === 'talk_sword') {
      if (!pq.found_rusty_sword) {
        return {
          ok: false,
          reason: 'sword_not_found',
          message: '먼저 다림 농장 헛간의 짚더미를 살펴 유품을 확인해 주세요 (/frank pquest darim search_barn).'
        };
      }
      pq.talked_about_past = true;
      pq.phase = 'READY_FOR_CHOICE';
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: true,
        phase: 'READY_FOR_CHOICE',
        message:
          '[다림] "사실은... 예전에 친한 친구와 검사가 되기로 약속했었어요. 무리한 토벌에서 친구를 잃고 이 눈가 흉터만 남은 뒤로 검을 봉인했는데, 내가 비겁하게 도망친 건 아닐까 계속 무서웠어요..."\n' +
          '▶ 다림이 스스로 자책에서 벗어나 자기 삶을 선택하도록 대화를 건네세요 (세 길 모두 동등한 성장 결말):\n' +
          '  1) 지금 일구는 밀밭의 가치를 긍정 (농부 전념): /frank pquest darim choose dedicated_farmer\n' +
          '  2) 농사와 숲 초입 안전 길잡이를 병행하는 시각 제안: /frank pquest darim choose dual_wheat_and_sword\n' +
          '  3) 안전 원칙 아래 천천히 검술을 다시 시작하도록 격려: /frank pquest darim choose cautious_swordsman_return'
      };
    }
  }

  if (npcId === 'roman') {
    if (action === 'ask_darim') {
      if (pq.phase !== 'CLUE_GATHERING') {
        return { ok: false, reason: 'wrong_phase', message: '먼저 /frank pquest roman start 로 사건을 시작해 주세요.' };
      }
      pq.darim_note_collected = true;
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: true,
        phase: pq.phase,
        message:
          '[다림의 토양 생육 자문] 다림이 세르딘 숲 야생 약초가 아침 안개 수분과 석회질 흙에서 자랄 때 수액 농도가 달라진다는 재배 관찰 노트를 기꺼이 적어 주었습니다!'
      };
    }

    if (action === 'ask_hwiyeon') {
      if (pq.phase !== 'CLUE_GATHERING') {
        return { ok: false, reason: 'wrong_phase', message: '먼저 /frank pquest roman start 로 사건을 시작해 주세요.' };
      }
      pq.hwiyeon_note_collected = true;
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: true,
        phase: pq.phase,
        message:
          '[의료소 임상 안정화 문헌] (휘연이 복합 회복약 투여 시 마력 역류를 줄이는 체온 대조표를 조용히 찾아 표시해 주었다.)'
      };
    }

    if (action === 'deliver_notes') {
      if (!pq.darim_note_collected || !pq.hwiyeon_note_collected) {
        return {
          ok: false,
          reason: 'missing_notes',
          message:
            '로만이 스스로 변수를 대조할 수 있도록 다림의 토양 기록(ask_darim)과 의료소 임상 문헌(ask_hwiyeon) 두 가지를 모두 모아 주세요.'
        };
      }
      pq.notes_delivered = true;
      pq.phase = 'READY_FOR_CHOICE';
      global.FRankDays.savePlayerState(player, state);
      return {
        ok: true,
        phase: 'READY_FOR_CHOICE',
        message:
          '[로만] "...거래용 참고 문헌이라고? 흥, 남의 동정은 안 받는다니까... 잠깐, 이 토양 수분 편차랑 체온 반응 곡선... 내가 여태 고정 상수로 놓고 계산했던 수치잖아?!"\n' +
          '로만이 직접 두 분야의 데이터를 바탕으로 조합식을 새로 설계하기 시작합니다! 옆에서 시약 온도 기록만 보조하며 조언을 건네세요:\n' +
          '  1) 정식 공동 자문 각주를 달고 이번 A급 본선에 당당히 출원 권유: /frank pquest roman choose confident_entry\n' +
          '  2) 한 계절 더 공동 교차 검증을 거쳐 완벽한 논문으로 출원 권유: /frank pquest roman choose thorough_verification'
      };
    }
  }

  // 4) 최종 결말 선택 및 NPC 주체적 해결 처리
  if (action === 'choose') {
    if (pq.phase !== 'READY_FOR_CHOICE') {
      return {
        ok: false,
        reason: 'not_ready_for_choice',
        message: '아직 결말을 선택할 단계가 아닙니다. 선행 단서 수집과 대화를 먼저 완료해 주세요.'
      };
    }
    var endingsMap = global.FRankDays.TIER1_PERSONAL_QUEST_ENDINGS[npcId];
    if (!choiceId || !endingsMap[choiceId]) {
      return {
        ok: false,
        reason: 'invalid_ending_choice',
        message:
          '유효한 결말 선택지가 아닙니다. 가능한 선택지: ' + Object.keys(endingsMap).join(', ')
      };
    }

    // 헤스·다림 유품/증빙 아이템 회수 정리 (선택적)
    if (npcId === 'hess' && global.FRankDays.countPlayerItem(player, 'f_rank_days:field_hazard_report') > 0) {
      if (player.server && player.server.runCommandSilent) {
        player.server.runCommandSilent('clear ' + player.username + ' f_rank_days:field_hazard_report 1');
      }
    }

    pq.phase = 'RESOLVED';
    pq.chosen_ending = choiceId;

    // 다림이 검사 재등록 엔딩을 택하더라도 플레이어의 직업과는 독립된 다림 본인의 성장으로 기록
    rel.flags.incident_resolved = true;
    rel.ending_id = choiceId;
    rel.affinity = Math.max(rel.affinity, 80); // 사건 해결 후 최소 80 보장 -> 5단계(관계 선택) 진입하되 자동 연애 전환 없음!
    rel.affinity = Math.min(100, rel.affinity + 10);
    global.FRankDays.recalculateRelationshipStage(rel);
    global.FRankDays.savePlayerState(player, state);

    // NPC별 진심 어린 답례품 지급
    if (player.give) {
      if (npcId === 'hess') {
        player.give('3x minecraft:emerald');
        player.give('2x minecraft:golden_carrot');
      } else if (npcId === 'darim') {
        player.give('4x minecraft:bread');
        player.give('2x minecraft:pumpkin_pie');
      } else if (npcId === 'roman') {
        if (typeof Item !== 'undefined' && Item.of) {
          player.give(Item.of('minecraft:potion', '{Potion:"minecraft:regeneration"}'));
        }
        player.give('2x minecraft:emerald');
      }
    }

    var chosenObj = endingsMap[choiceId];
    return {
      ok: true,
      resolved: true,
      npc_id: npcId,
      ending_id: choiceId,
      ending_title: chosenObj.title,
      stage: rel.stage,
      stage_id: rel.stage_id,
      relation_type: rel.relation_type,
      message:
        '=== [' +
        chosenObj.title +
        '] ===\n' +
        chosenObj.resolution_dialogue +
        '\n(관계 5단계 [관계 선택] 해금 — 자동 연애 전환 없음: 친구·동료 확정은 /frank relationship ' +
        npcId +
        ' friend)'
    };
  }

  return { ok: false, reason: 'unknown_action', message: '알 수 없는 개인 퀘스트 동작입니다: ' + action };
};

// 월드 내 블록 우클릭으로 개인 퀘스트 단서 자연스럽게 발견 (독서대 -> 헤스 실측 기록지 / 짚더미 -> 다림 녹슨 검)
BlockEvents.rightClicked(function (event) {
  var player = event.player;
  if (!player || !event.block) return;
  var blockId = String(event.block.id);

  if (blockId !== 'minecraft:lectern' && blockId !== 'minecraft:hay_block') return;

  var state = global.FRankDays.loadPlayerState(player);
  if (blockId === 'minecraft:lectern' && state.personal_quests.hess.phase === 'CLUE_GATHERING') {
    var resH = global.FRankDays.handleTier1PersonalQuest(player, 'hess', 'camp_survey');
    if (resH.ok && player.tell) player.tell(resH.message);
  } else if (blockId === 'minecraft:hay_block' && state.personal_quests.darim.phase === 'CLUE_GATHERING') {
    var resD = global.FRankDays.handleTier1PersonalQuest(player, 'darim', 'search_barn');
    if (resD.ok && player.tell) player.tell(resD.message);
  }
});
