// Per-player presentation of existing NPC actions. Never creates marker entities
// or treats shared FTB completion, ordinary conversation, gifts or shops as a quest.
global.FRankDays=global.FRankDays||{};
(function(F){
 var LAST={},BUDGET={},AABB=null,CHANNEL='f_rank_days:npc_quest_markers_v110';
 function id(p){return String(p.uuid);}function clock(p){return Number(p.server.overworld().getTime());}
 function rank(s,j){var r=s.job_licenses&&s.job_licenses[j];return r?F.GRADE_ORDER.indexOf(String(r.grade)):-1;}
 function contributionAvailable(s){return !!F.canSubmitMainlandContributionV110&&F.canSubmitMainlandContributionV110(s);}
 // Same quantities and wallet rule as 27.submitMainlandContributionV96.
 function contributionReady(p,s){var cash=F.getPlayerBalanceSummaryV8?Number(F.getPlayerBalanceSummaryV8(p).wallet_copper):Number(s.economy&&s.economy.wallet_copper||0);if(cash<300)return false;var food=F.countPlayerItem(p,'f_rank_days:hearth_potato_soup')>=16||F.countPlayerItem(p,'f_rank_days:brion_barley_bread')>=16,metal=F.countPlayerItem(p,'minecraft:iron_ingot')>=8||F.countPlayerItem(p,'f_rank_days:hardened_ingot')>=8,records=Number(s.serdin_caches_found||0)>=10&&F.countPlayerItem(p,'f_rank_days:refined_mana_stone')>=12;return food&&metal||records;}
 F.getNpcQuestMarkerKindV110=function(p,npc){
  var s=F.loadPlayerState(p),available=false,view=F.getPromotionExamViewV106&&F.getPromotionExamViewV106(p,npc,''),jobs=view&&view.ok&&view.registeredMentorJobs||[];
  for(var i=0;i<jobs.length;i++){var job=jobs[i].id,exam=F.getPromotionExamViewV106(p,npc,job);if(!exam||!exam.ok)continue;var receipts=s.practical_promotions_phase4&&s.practical_promotions_phase4.receipts||{},receipt=receipts[job+'_'+exam.nextGrade];if(receipt){if(String(receipt.proctor)!==npc)continue;}else{var spec=F.getPracticalSpecPhase4(job,exam.nextGrade),primary=spec&&F.getQuestNpcTargetV106(p,spec.proctor);if(!primary||primary.npcId!==npc)continue;}if(exam.status==='ready')return'turnin';if(exam.status==='available')available=true;}
  // 06.handleTier1PersonalQuest(status) and 27.questMenu use these same
  // personal phases and trust gate. Reading them never advances a story.
  var pq=s.personal_quests&&s.personal_quests[npc],rel=s.relationships&&s.relationships[npc];
  if(['hess','darim','roman'].indexOf(npc)>=0&&pq&&rel&&Number(rel.affinity)>=60){if(pq.phase==='READY_FOR_CHOICE')return'turnin';if(pq.phase==='NOT_STARTED')available=true;}
  if(npc==='hess'){
   var boss=s.v8_boss&&s.v8_boss.quests&&s.v8_boss.quests.ferrous_wroughtnaut;if(boss&&boss.first_cleared&&!boss.first_reward_claimed)return'turnin';
   if(!s.guild_card||!s.guild_card.issued)available=true;
   if(!s.mainland_sailing_unlocked&&contributionAvailable(s)){if(contributionReady(p,s))return'turnin';available=true;}
  }
  return available?'avail':'';
 };
 function npcId(q,known){if(!F.hasEntityTag(q,'f_rank_npc'))return'';var type=String(q.type);if(type!=='minecraft:villager'&&type.indexOf('customnpcs:')!==0)return'';for(var n in known)if(F.hasEntityTag(q,'npc_'+n))return n;return'';}
 F.getNpcQuestMarkersV110=function(p){
  var out={version:110,markers:[]};if(!p||!p.server||p.isSpectator&&p.isSpectator()||p.isAlive&&!p.isAlive())return out;
  var known={},defs=F.NPC_DIALOG_DEFS||{},mentors=F.MENTOR_SUPPORTED_JOBS||{};for(var n in defs)known[n]=true;for(var m in mentors)known[m]=true;known.hess=true;known.darim=true;known.roman=true;
  if(!AABB)AABB=Java.loadClass('net.minecraft.world.phys.AABB');var list=p.level.getEntitiesWithin(new AABB(Number(p.x)-40,Number(p.y)-40,Number(p.z)-40,Number(p.x)+40,Number(p.y)+40,Number(p.z)+40)),canonical={};
  for(var i=0;i<list.size();i++){var q=list.get(i);if(!q||!q.uuid||q.isRemoved&&q.isRemoved()||q.isAlive&&!q.isAlive()||String(q.level.dimension)!==String(p.level.dimension))continue;var dx=Number(q.x)-Number(p.x),dy=Number(q.y)-Number(p.y),dz=Number(q.z)-Number(p.z);if(dx*dx+dy*dy+dz*dz>1600)continue;var n=npcId(q,known);if(!n)continue;var pos=F.getExpectedNpcCoords&&F.getExpectedNpcCoords(p.server,n),distance=pos?Math.pow(Number(q.x)-Number(pos[0]),2)+Math.pow(Number(q.y)-Number(pos[1]),2)+Math.pow(Number(q.z)-Number(pos[2]),2):dx*dx+dy*dy+dz*dz,old=canonical[n];if(!old||distance<old.distance||distance===old.distance&&String(q.uuid)<old.uuid)canonical[n]={uuid:String(q.uuid),distance:distance};}
  var names=Object.keys(canonical).sort();for(var j=0;j<names.length;j++){var n=names[j],kind=F.getNpcQuestMarkerKindV110(p,n);if(kind)out.markers.push({uuid:canonical[n].uuid,npc_id:n,kind:kind});}
  return out;
 };
 F.sendNpcQuestMarkersV110=function(p,force){var out=F.getNpcQuestMarkersV110(p),json=JSON.stringify(out),k=id(p);if(force||LAST[k]!==json){p.sendData(CHANNEL,{markers_json:json});LAST[k]=json;}return out;};
 var changed=F.onPromotionPracticalChangedV110;if(changed)F.onPromotionPracticalChangedV110=function(p,c){var r=changed(p,c);F.sendNpcQuestMarkersV110(p,false);return r;};
 var examAction=F.handlePromotionExamActionV106;if(examAction)F.handlePromotionExamActionV106=function(p,n,a,j,g){var r=examAction(p,n,a,j,g);if(r&&r.ok)F.sendNpcQuestMarkersV110(p,false);return r;};
 var personal=F.handleTier1PersonalQuest;if(personal)F.handleTier1PersonalQuest=function(p,n,a,c){var r=personal(p,n,a,c);if(r&&r.ok&&a&&a!=='status')F.sendNpcQuestMarkersV110(p,false);return r;};
 var dialog=F.handleNpcDialogAction;if(dialog)F.handleNpcDialogAction=function(p,d,o){var r=dialog(p,d,o);if(r&&r.ok)F.sendNpcQuestMarkersV110(p,false);return r;};
 PlayerEvents.loggedIn(function(e){e.player.server.scheduleInTicks(2,function(){F.sendNpcQuestMarkersV110(e.player,true);});});
 PlayerEvents.loggedOut(function(e){var p=e.player;try{p.sendData(CHANNEL,{markers_json:JSON.stringify({version:110,markers:[]})});}catch(ignored){}delete LAST[id(p)];delete BUDGET[id(p)];});
 PlayerEvents.tick(function(e){var p=e.player,k=id(p),t=clock(p);if(BUDGET[k]!==undefined&&t>=BUDGET[k]&&t-BUDGET[k]<20)return;BUDGET[k]=t;F.sendNpcQuestMarkersV110(p,false);});
})(global.FRankDays);
