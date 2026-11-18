// 《F급의 나날》 KubeJS 6 Server Script - NPC Relationship State Machine
// 파일 경로: kubejs/server_scripts/03_npc_relationships_and_commands.js

global.FRankDays = global.FRankDays || {};

global.FRankDays.NPC_METADATA = {
  harin: { name: '하린', job: 'A급 레인저', race: '엘프', personality: 'INTJ', speech_style: '짧고 무심한 말투', theme: '세르딘 숲의 수호와 남겨진 고향', demon_king_rumor_applied: false },
  roman: { name: '로만', job: 'B급 연금술사', race: '고양이 수인', theme: '독립과 신뢰', demon_king_rumor_applied: false },
  darim: { name: '다림', job: 'C급 농부', race: '여우 수인', theme: '꿈과 상실', demon_king_rumor_applied: false },
  hess: { name: '헤스', job: '길드 접수원 (등급 없음)', race: '인간', theme: '책임과 제도 개선', demon_king_rumor_applied: false },
  ski: { name: '스키', job: 'A급 검술 교관', race: '여우 수인', theme: '타인의 기대와 자기 선택', demon_king_rumor_applied: false },
  hyeophap: { name: '협합', job: 'B급 유물 연구자', race: '고양이 수인', theme: '자존심과 자기표현', demon_king_rumor_applied: false },
  nau: { name: '나우', job: 'B급 대장장이', race: '인간', theme: '소통과 교육', demon_king_rumor_applied: false },
  bambam: { name: '밤밤', job: 'C급 떠돌이 상인', race: '소악마', theme: '차별과 소속', demon_king_rumor_applied: false },
  gori: { name: '고리', job: '여관 주인 (별도 등급 없음)', race: '페럿 수인', theme: '독립과 관계의 경계', demon_king_rumor_applied: false },
  hwiyeon: { name: '휘연', job: 'A급 힐러', race: '인간', speech_style: 'undetermined', theme: '치유와 한계', demon_king_rumor_applied: false }
};

global.FRankDays.recalculateRelationshipStage = function (rel) {
  if (rel.flags.relationship_branch_selected) {
    rel.stage = 6;
    rel.stage_id = 'bond_aftermath';
    return rel;
  }
  if (rel.flags.incident_resolved && rel.affinity >= 80) {
    rel.stage = 5;
    rel.stage_id = 'relationship_choice';
    return rel;
  }
  if (rel.flags.incident_triggered && rel.affinity >= 60) {
    rel.stage = 4;
    rel.stage_id = 'personal_incident';
    return rel;
  }
  if (rel.affinity >= 45) {
    rel.stage = 3;
    rel.stage_id = 'trust';
    return rel;
  }
  if (rel.affinity >= 20) {
    rel.stage = 2;
    rel.stage_id = 'rapport';
    return rel;
  }
  rel.stage = 1;
  rel.stage_id = 'acquaintance';
  return rel;
};

global.FRankDays.addNpcAffinity = function (player, npcId, delta) {
  if (global.FRankDays.UNDETERMINED_NPCS.indexOf(npcId) !== -1) {
    return {
      ok: false,
      reason: 'npc_undetermined',
      message: '해당 NPC(' + npcId + ')는 아직 상세 설정이 미정 상태이므로 상호작용 데이터가 잠겨 있습니다.'
    };
  }
  if (!global.FRankDays.NPC_METADATA[npcId]) {
    return { ok: false, reason: 'unknown_npc', message: '알 수 없는 NPC 식별자: ' + npcId };
  }

  var state = global.FRankDays.loadPlayerState(player);
  var rel = state.relationships[npcId];
  rel.flags.first_met = true;
  if (rel.relation_type === 'none') {
    rel.relation_type = 'acquaintance';
  }
  rel.affinity = Math.max(0, Math.min(100, rel.affinity + Number(delta || 0)));
  global.FRankDays.recalculateRelationshipStage(rel);
  global.FRankDays.savePlayerState(player, state);

  if (typeof global.FRankDays.syncFtbQuestStagesForPlayer === 'function') {
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
  }

  return {
    ok: true,
    npc_id: npcId,
    affinity: rel.affinity,
    stage: rel.stage,
    stage_id: rel.stage_id,
    relation_type: rel.relation_type
  };
};

global.FRankDays.progressPersonalIncident = function (player, npcId, action, endingChoiceId) {
  if (!global.FRankDays.NPC_METADATA[npcId]) {
    return { ok: false, reason: 'invalid_npc' };
  }
  var state = global.FRankDays.loadPlayerState(player);
  var rel = state.relationships[npcId];

  if (action === 'START') {
    if (rel.affinity < 60) {
      return {
        ok: false,
        reason: 'insufficient_trust',
        message: '개인 사건을 시작하려면 먼저 신뢰 단계(호감도 60 이상)에 도달해야 합니다.'
      };
    }
    rel.flags.incident_triggered = true;
  } else if (action === 'RESOLVE') {
    if (!rel.flags.incident_triggered) {
      return { ok: false, reason: 'incident_not_started' };
    }
    rel.flags.incident_resolved = true;
    rel.ending_id = endingChoiceId || 'standard_growth';
  }

  global.FRankDays.recalculateRelationshipStage(rel);
  global.FRankDays.savePlayerState(player, state);

  if (typeof global.FRankDays.syncFtbQuestStagesForPlayer === 'function') {
    global.FRankDays.syncFtbQuestStagesForPlayer(player);
  }

  return {
    ok: true,
    npc_id: npcId,
    stage: rel.stage,
    stage_id: rel.stage_id,
    ending_id: rel.ending_id
  };
};

global.FRankDays.selectRelationshipBranch = function (player, npcId, branchType) {
  if (!global.FRankDays.NPC_METADATA[npcId]) {
    return { ok: false, reason: 'invalid_npc' };
  }
  var state = global.FRankDays.loadPlayerState(player);
  var rel = state.relationships[npcId];

  if (rel.stage < 5 || !rel.flags.incident_resolved || rel.affinity < 80) {
    return {
      ok: false,
      reason: 'not_in_choice_stage',
      message: '관계 선택은 개인 사건 해결 및 호감도 80 이상(5단계)에서만 가능합니다.'
    };
  }

  if (branchType === 'friend') {
    rel.relation_type = 'friend';
    rel.flags.relationship_branch_selected = true;
    global.FRankDays.recalculateRelationshipStage(rel);
    global.FRankDays.savePlayerState(player, state);
    return {
      ok: true,
      npc_id: npcId,
      relation_type: 'friend',
      stage: rel.stage,
      message:
        global.FRankDays.NPC_METADATA[npcId].name +
        '와(과) 서로의 삶을 응원하는 깊고 단단한 친구·동료 관계를 이어 가기로 했습니다.'
    };
  }

  if (branchType === 'romance') {
    if (rel.romance_eligible !== true) {
      return {
        ok: false,
        reason: 'romance_eligibility_undetermined',
        message:
          global.FRankDays.NPC_METADATA[npcId].name +
          '의 연애 가능 여부는 아직 기획 미확정(undetermined) 상태입니다.'
      };
    }
    rel.relation_type = 'romantic_partner';
    rel.flags.relationship_branch_selected = true;
    global.FRankDays.recalculateRelationshipStage(rel);
    global.FRankDays.savePlayerState(player, state);
    return {
      ok: true,
      npc_id: npcId,
      relation_type: 'romantic_partner',
      stage: rel.stage,
      active_romances: global.FRankDays.getRomanticPartners(player),
      message: global.FRankDays.NPC_METADATA[npcId].name + '와(과) 연인 관계로 발전했습니다.'
    };
  }

  return { ok: false, reason: 'invalid_branch_type' };
};

global.FRankDays.setNpcRomanceEligibilityForConfig = function (player, npcId, isEligible) {
  if (!global.FRankDays.NPC_METADATA[npcId]) return { ok: false };
  var state = global.FRankDays.loadPlayerState(player);
  state.relationships[npcId].romance_eligible = isEligible;
  global.FRankDays.savePlayerState(player, state);
  return { ok: true, npc_id: npcId, romance_eligible: isEligible };
};

global.FRankDays.getRomanticPartners = function (player) {
  var state = global.FRankDays.loadPlayerState(player);
  var list = [];
  for (var i = 0; i < global.FRankDays.ACTIVE_NPCS.length; i++) {
    var id = global.FRankDays.ACTIVE_NPCS[i];
    if (state.relationships[id] && state.relationships[id].relation_type === 'romantic_partner') {
      list.push(id);
    }
  }
  return list;
};
