// F-Craft v9.3. Personal, server-authoritative E->D->C examinations.
// FTB Quests displays tasks. Possession/trading of a certificate never promotes a player.
global.FRankDays = global.FRankDays || {};
(function (F) {
  var cfg = JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_mid_tier_exams.json')));
  if (!cfg || cfg.schemaVersion !== 1 || !cfg.exams || cfg.exams.length !== 12) throw new Error('Invalid F-Craft mid-tier exam configuration');
  F.MID_TIER_EXAMS_V93 = cfg.exams;
  var byKey = {}, byReward = {}, byNpc = {};
  for (var i = 0; i < cfg.exams.length; i++) {
    var e = cfg.exams[i], key = e.job + '_' + e.grade;
    if (byKey[key] || byReward[e.reward] || F.ALL_JOBS.indexOf(e.job) < 0) throw new Error('Duplicate/invalid mid-tier exam: ' + key);
    byKey[key] = e; byReward[e.reward] = e; byNpc[e.npc] = e.job;
  }
  function personal(state) {
    if (!state.mid_tier_exams_v93) state.mid_tier_exams_v93 = {};
    return state.mid_tier_exams_v93;
  }
  function currentSpec(state, job) {
    var g = state.job_licenses[job] && state.job_licenses[job].grade;
    return byKey[job + '_' + (g === 'E' ? 'D' : g === 'D' ? 'C' : '')] || null;
  }
  function record(state, spec) { return personal(state)[spec.job + '_' + spec.grade] || null; }
  function actualPlayer(player) { return player.minecraftPlayer || player; }
  function playerUuid(player) { return Java.loadClass('java.util.UUID').fromString(String(player.uuid)); }
  function ftb(player, spec) {
    // Public API of the INSTALLED FTB Quests 2001.4.18, verified with javap.
    // Keep 64-bit IDs as strings across Rhino. Parsing to a JS number would round them.
    var api = Java.loadClass('dev.ftb.mods.ftbxmodcompat.ftbquests.kubejs.FTBQuestsKubeJSWrapper').INSTANCE;
    return { api:api, file:api.getFile(player.level), data:api.getData(actualPlayer(player)),
      quest:api.getObject(player.level,String(spec.quest)), reward:api.getObject(player.level,String(spec.reward)) };
  }
  F.getMidTierFtbContextV93 = ftb;
  F.getMidTierSpecV93 = function (job, grade) { return byKey[job + '_' + grade] || null; };
  function deliveryEligible(stack, delivery, player, spec) {
    if (!stack || stack.empty || String(stack.id) !== delivery.id) return false;
    if (typeof F.isMidTierDeliveryEligibleV94 === 'function' && !F.isMidTierDeliveryEligibleV94(player,spec,stack,delivery)) return false;
    if (!delivery.unmodifiedOnly) return true;
    var nbt=stack.nbt;
    if (typeof F.getWeaponEnhanceLevel === 'function' && F.getWeaponEnhanceLevel(stack)>0) return false;
    if (nbt && ((nbt.f_rank_enhance && Number(nbt.f_rank_enhance.level||0)>0) || Number(nbt.Damage||0)>0 || (nbt.display&&nbt.display.Name))) return false;
    return !nbt || ((!nbt.Enchantments || F.readWeaponNbtListV91(nbt.Enchantments).length===0) && (!nbt.StoredEnchantments || F.readWeaponNbtListV91(nbt.StoredEnchantments).length===0));
  }
  function deliveryCount(player, delivery, spec) {
    var total=0,inv=player.inventory;
    if(!inv||!inv.getContainerSize)return 0;
    for(var i=0;i<inv.getContainerSize();i++){var st=inv.getItem(i);if(deliveryEligible(st,delivery,player,spec))total+=Number(st.count||0);}
    return total;
  }
  F.countMidTierDeliveryV93=deliveryCount;
  function practicalMissing(state, spec) {
    var r = record(state, spec), missing = [];
    if (!r || r.status !== 'ACCEPTED') return ['스승의 개인 응시 접수'];
    for (var type in spec.kills) if (Number((r.kills || {})[type] || 0) < spec.kills[type]) missing.push((spec.killLabels&&spec.killLabels[type]||'마물') + ' ' + Number((r.kills || {})[type] || 0) + '/' + spec.kills[type]);
    if (Number(r.smelted || 0) < spec.smeltCount) missing.push('경화 강괴 직접 제련 ' + Number(r.smelted || 0) + '/' + spec.smeltCount);
    return missing;
  }
  F.midTierPersonalPracticalMissingV93 = practicalMissing;
  function markPractical(player, state, spec) {
    if (!practicalMissing(state, spec).length) F.grantPlayerStageOnce(player, spec.personalStage);
  }
  F.acceptMidTierExamV93 = function(player,npcId){return {ok:false,reason:'phase4_practical_required',message:'스승의 의뢰 메뉴에서 새 개인 실기를 접수하세요. 기존 중급 시험 기록은 보존됩니다.'};};
  function updateCards(player, state) {
    var primary = F.resolvePrimaryRegisteredJob(state);
    if (!state.guild_card.issued || !primary) return;
    state.guild_card.grade = primary.grade;
    state.guild_card.job_grades = {};
    for (var j = 0; j < F.ALL_JOBS.length; j++) state.guild_card.job_grades[F.ALL_JOBS[j]] = state.job_licenses[F.ALL_JOBS[j]].grade;
    F.savePlayerState(player, state);
    var inv = player.inventory;
    if (!inv || !inv.getContainerSize) return;
    for (var i = 0; i < inv.getContainerSize(); i++) {
      var stack = inv.getItem(i);
      if (!stack || String(stack.id) !== 'f_rank_days:guild_citizen_card' || !stack.nbt) continue;
      var nbt = stack.nbt.copy ? stack.nbt.copy() : stack.nbt;
      if (String(nbt.OwnerUUID || '') !== state.player_uuid || String(nbt.CardSerial || '') !== state.guild_card.serial_number) continue;
      nbt.Grade = primary.grade; nbt.PrimaryGrade = primary.grade; nbt.JobGrades = state.guild_card.job_grades;
      if (nbt.display && nbt.display.Lore) {
        var lore = F.readWeaponNbtListV91(nbt.display.Lore), lines = [];
        for (var l = 0; l < lore.length; l++) lines.push(lore[l] && typeof lore[l].getAsString === 'function' ? String(lore[l].getAsString()) : String(lore[l]));
        if (lines.length > 2) lines[2] = JSON.stringify([{text:'등급: ' + primary.grade + '급  |  직업: ' + primary.job_label,font:'f_rank_days:print',italic:false,color:'green'}]);
        nbt.display.Lore = lines;
      }
      stack.setNbt(nbt);
    }
  }
  F.refreshMidTierGuildCardV93 = updateCards;
  F.deliverMidTierSkillPointsV93 = function(player,spec){var job=spec.job==='alchemist'?'herbalist':spec.job;if(typeof F.reconcileJobPointsPhase4==='function')return F.reconcileJobPointsPhase4(player,job);var s=F.loadPlayerState(player);s.phase4_points_pending=s.phase4_points_pending||{};s.phase4_points_pending[job]=true;F.savePlayerState(player,s);return false;};
  F.claimMidTierRewardV93 = function(player,job,grade,reward){var old=byKey[job+'_'+grade];if(old&&reward){var c=ftb(player,old);if(c.data&&c.reward)c.data.resetReward(playerUuid(player),c.reward);}return {ok:false,reason:'legacy_reward_retired',message:'구형 보상은 기록용입니다. 새 개인 실기 퀘스트의 봉랍 보상으로 승급하세요.'};};
  F.handleMidTierDialogV93 = function (player,npcId,action,subId) {
    var job = byNpc[npcId];
    if (!job) return {ok:false,message:'이 주민은 해당 승급 시험의 담당자가 아닙니다.'};
    var state=F.loadPlayerState(player), spec=currentSpec(state,job), message='[의뢰·승급]\n기존 의뢰와 중급 승급을 원하는 순서대로 진행하세요.';
    if (action==='V93_MID_GATE') message=F.acceptMidTierExamV93(player,npcId).message;
    if (action==='V93_MID_BOOK') {
      F.closeNpcRpgDialog(player,true);
      // The installed command accepts a quest_object argument; open the relevant chapter/quest directly.
      player.server.runCommandSilent('execute as '+String(player.uuid)+' run ftbquests open_book '+(spec?spec.quest:'7A00000000000000'));
      return {ok:true,transitioned:true,message:'제7장 직종별 승급 퀘스트를 확인하세요.'};
    }
    if (action==='V93_MID_STATUS') {
      if (!spec) message='현재 '+F.JOB_LABELS[job]+' 원부는 '+state.job_licenses[job].grade+'급입니다. E/D급부터 중급 실기에 응시할 수 있습니다.';
      else {
        var m=practicalMissing(state,spec);if(typeof F.getMidTierExtraRequirementsV94==='function')m=m.concat(F.getMidTierExtraRequirementsV94(player,state,spec));message='['+spec.label+' '+spec.grade+'급 개인 진행]\n'+(m.length?m.join('\n'):'개인 활동 조건 완료. 퀘스트북에서 물품·토벌 목표와 봉랍 보상을 확인하세요.');
        for(var d=0;d<spec.deliveries.length;d++) message+='\n'+(spec.deliveries[d].label||'납품 물품')+(spec.deliveries[d].unmodifiedOnly?' (미강화·미사용)':'')+': '+deliveryCount(player,spec.deliveries[d],spec)+'/'+spec.deliveries[d].count;
      }
    }
    if (action==='V93_MID_CLAIM' && spec) {
      var ctx=ftb(player,spec);
      if(ctx.quest && ctx.data.isCompleted(ctx.quest) && !ctx.data.isRewardClaimed(playerUuid(player),ctx.reward)) ctx.data.claimReward(actualPlayer(player),ctx.reward,true);
      else message='퀘스트북 현장 실기를 완료한 후 보상을 수령하세요.';
      state=F.loadPlayerState(player);spec=currentSpec(state,job);
      if(!spec)message='중급 승급 시험이 모두 완료되었습니다.';
    }
    return {ok:true,message:message,buttons:[
      {id:'legacy_quest',label:'기존 의뢰',icon:'quest',action:'QUEST_ACTION',enabled:npcId!=='ski'&&npcId!=='hyeophap'},
      {id:'mid_gate',label:'승급 자격확인',icon:'special',action:'V93_MID_GATE',enabled:Boolean(spec)},
      {id:'mid_status',label:'개인 실기 기록',icon:'quest',action:'V93_MID_STATUS',enabled:true},
      {id:'mid_book',label:'제7장 퀘스트북',icon:'quest',action:'V93_MID_BOOK',enabled:true},
      {id:'mid_claim',label:'승급 보상수령',icon:'gift',action:'V93_MID_CLAIM',enabled:Boolean(spec)},
      {id:'back',label:'돌아가기',icon:'close',action:'BACK_MAIN',enabled:true}
    ]};
  };
  // Preserve the six-button layout and all implemented training/shop/gift actions.
  // Existing quest actions remain available under the new work submenu.
  for (var npc in byNpc) {
    var def=F.NPC_DIALOG_DEFS[npc];
    if (!def) throw new Error('Missing configured proctor NPC: '+npc);
    for(var b=0;b<def.buttons.length;b++) if(def.buttons[b].id==='quest') def.buttons[b]={id:'quest',label:'의뢰·승급',icon:'quest',action:'V93_JOB_WORK_MENU',enabled:true};
  }
  for(var j=0;j<F.ALL_JOBS.length;j++) for(var g=0;g<7;g++) F.NON_ENHANCEABLE_EXPLICIT_IDS['f_rank_days:'+F.ALL_JOBS[j]+'_license_'+['f','e','d','c','b','a','s'][g]]=true;

  if(typeof FTBQuestsEvents==='undefined'||!FTBQuestsEvents.customReward) throw new Error('FTB XMod Compat customReward integration is required');
  function registerReward(spec){
    FTBQuestsEvents.customReward(spec.reward,function(event){
      if(!event.player)return;
      var res=F.claimMidTierRewardV93(event.player,spec.job,spec.grade,event.reward);
      if(event.player.tell)event.player.tell(res.message);
    });
  }
  for(var ri=0;ri<cfg.exams.length;ri++)registerReward(cfg.exams[ri]);
  if(typeof EntityEvents!=='undefined'&&EntityEvents.death) EntityEvents.death(function(event){
    var src=event.source, p=src&&src.player?src.player:src&&src.actual&&src.actual.isPlayer&&src.actual.isPlayer()?src.actual:null;
    if(!p||!event.entity)return;
    var type=String(event.entity.type||event.entity.id||''), state=F.loadPlayerState(p), spec=currentSpec(state,'swordsman'), r=spec&&record(state,spec);
    if(!r||r.status!=='ACCEPTED'||!spec.kills[type])return;
    r.kills[type]=Math.min(spec.kills[type],Number(r.kills[type]||0)+1);F.savePlayerState(p,state);markPractical(p,state,spec);
  });
  ItemEvents.smelted(function(event){
    if(!event.player||!event.item||String(event.item.id)!=='f_rank_days:hardened_ingot')return;
    var p=event.player,state=F.loadPlayerState(p),spec=currentSpec(state,'blacksmith'),r=spec&&record(state,spec);
    if(!r||r.status!=='ACCEPTED'||!spec.smeltCount)return;
    r.smelted=Math.min(spec.smeltCount,Number(r.smelted||0)+Number(event.item.count||1));F.savePlayerState(p,state);markPractical(p,state,spec);
  });
  PlayerEvents.loggedIn(function(event){
    var p=event.player,state=F.loadPlayerState(p);
    for(var i=0;i<cfg.exams.length;i++)if(state.reward_ledger['mid_tier_reward_'+cfg.exams[i].job+'_'+cfg.exams[i].grade])F.deliverMidTierSkillPointsV93(p,cfg.exams[i]);
  });
  PlayerEvents.tick(function(event){
    var p=event.player;
    if(!p)return;
    F._midTierRetryV93=F._midTierRetryV93||{};
    var uuid=String(p.uuid),now=Date.now(),last=Number(F._midTierRetryV93[uuid]||0);
    if(now>=last&&now-last<5000)return;
    F._midTierRetryV93[uuid]=now;
    var state=F.loadPlayerState(p);
    for(var i=0;i<cfg.exams.length;i++){
      var spec=cfg.exams[i];
      if(state.reward_ledger['mid_tier_reward_'+spec.job+'_'+spec.grade]&&!state.reward_ledger['skill_points_mid_'+spec.job+'_'+spec.grade])F.deliverMidTierSkillPointsV93(p,spec);
    }
  });
})(global.FRankDays);
