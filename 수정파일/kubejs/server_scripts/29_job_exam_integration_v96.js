// Phase4: retain first activities and traits; all promotion issuing routes delegate to38.
global.FRankDays=global.FRankDays||{};
(function(F){
 F.NEW_JOB_EXAM_SPECS_V96={};
 F.openJobExamMenuV96=function(p,n,j){return F.openPracticalPromotionMenuPhase4(p,n,j);};
 F.handleJobExamActionV96=function(p,n,a,j){return F.handlePracticalPromotionActionPhase4(p,n,a,j);};
 F.claimNewJobExamV96=function(){return {ok:false,reason:'ftb_reward_context_required',message:'개인 실기 퀘스트의 봉랍 보상에서 수령하세요.'};};
 var oldSync=F.syncFtbQuestStagesForPlayer;
 F.syncFtbQuestStagesForPlayer=function(p){var r=oldSync(p),s=F.loadPlayerState(p);for(var i=0;i<F.JOB_CATALOG_V96.length;i++){var job=F.JOB_CATALOG_V96[i].id,idx=F.GRADE_ORDER.indexOf(s.job_licenses[job].grade);for(var g=2;g<=Math.min(7,idx);g++)F.grantPlayerStageOnce(p,'frank_v96_'+job+'_'+F.GRADE_ORDER[g].toLowerCase());}return r;};
 F.recordJobActivityV96=function(p,key,amount){if(!(amount>0))return;var s=F.loadPlayerState(p);s.job_activity_v96=s.job_activity_v96||{};s.job_activity_v96[key]=Number(s.job_activity_v96[key]||0)+amount;
   var statJobs={herbs:['herbalist','herbs_gathered'],ores:['prospector','ores_mined'],ranged_kills:['ranger','mob_kills'],cooked:['chef','cooked'],fished:['angler','fished'],discoveries:['pathfinder','discoveries'],care_actions:['healer','care_actions']},target=statJobs[key];if(target){var stats=s.job_licenses[target[0]].stats;stats[target[1]]=Number(stats[target[1]]||0)+amount;}if(key==='care_actions'){var care=s.active_exams.healer_f_to_e;if(care&&care.status==='IN_PROGRESS'&&care.phase==='PRACTICAL')care.practical.care_actions=Number(care.practical.care_actions||0)+amount;}
   F.savePlayerState(p,s);
   var stages={harvest:'first_harvest',herbs:'first_herb',fished:'first_fish',cooked:'first_cook',smelted:'first_smelt'};if(stages[key])F.grantPlayerStageOnce(p,'frank_v96_'+stages[key]);
 };
 var oldDiscovery=F.onTraitDiscoveryV96;
 F.onTraitDiscoveryV96=function(p,key){var s=F.loadPlayerState(p),existed=s.trait_discoveries_v96&&s.trait_discoveries_v96[String(key)],r=oldDiscovery(p,key);if(!existed)F.recordJobActivityV96(p,'discoveries',1);return r;};
 BlockEvents.broken(function(e){var p=e.player;if(!p)return;var block=e.block,world=e.level,where={dimension:String(e.level.dimension),x:Number(block.x),y:Number(block.y),z:Number(block.z)};if(F.isManagedRegenNodeV96&&F.isManagedRegenNodeV96(p,where))return;var bid=String(block.id),before=String(block.blockState),age=Number(F.getBlockProp(block,'age')),mature={'minecraft:wheat':7,'minecraft:carrots':7,'minecraft:potatoes':7,'minecraft:beetroots':3,'farmersdelight:cabbages':7,'farmersdelight:tomatoes':7},key=bid.indexOf('_ore')>=0?'ores':['minecraft:dandelion','minecraft:poppy','minecraft:allium','minecraft:blue_orchid','minecraft:red_mushroom','minecraft:brown_mushroom'].indexOf(bid)>=0||bid.indexOf('farmersdelight:wild_')===0?'herbs':mature[bid]!==undefined&&age>=mature[bid]?'harvest':null;if(key)p.server.scheduleInTicks(1,function(){if(String(world.getBlock(where.x,where.y,where.z).blockState)!==before)F.recordJobActivityV96(p,key,1);});});
 EntityEvents.death(function(e){var src=e.source,p=src&&src.actual;if(!p||!p.isPlayer||!p.isPlayer())return;if(String(e.entity.getEntityType().getCategory()).toLowerCase()!=='monster')return;var immediate=src.immediate;if(immediate&&['minecraft:arrow','minecraft:spectral_arrow','minecraft:firework_rocket'].indexOf(String(immediate.type))>=0)F.recordJobActivityV96(p,'ranged_kills',1);});
 function cooked(e){if(!e.player||!e.item||!e.item.getFoodProperties(e.player))return;var id=String(e.item.id);if(id.indexOf('farmersdelight:')===0||id.indexOf('f_rank_days:')===0||id.indexOf('minecraft:cooked_')===0||id==='minecraft:bread'||id==='minecraft:baked_potato')F.recordJobActivityV96(e.player,'cooked',Number(e.item.count||1));}
 ItemEvents.crafted(cooked);ItemEvents.smelted(function(e){cooked(e);if(e.player&&e.item)F.recordJobActivityV96(e.player,'smelted',Number(e.item.count||1));});
 var oldCounter=F.computeOutgoingPlayerAttackDamageV8;
 F.computeOutgoingPlayerAttackDamageV8=function(p,damage,projectile){var r=oldCounter(p,damage,projectile);if(r.counter_triggered&&F.loadPlayerState(p).special_ability.ability_id==='jumpy_instinct')r.final_damage=Number(damage)+(r.final_damage-Number(damage))*1.5;return r;};
 var oldRubbing=F.collectDesignatedRubbingV94;
 F.collectDesignatedRubbingV94=function(p,where,held){var r=oldRubbing(p,where,held);if(r&&r.ok)F.tryHoarderRewardV96(p);return r;};

 F.retryNewJobSkillPointsV96=function(p){if(typeof F.reconcileJobPointsPhase4!=='function')return;var s=F.loadPlayerState(p);for(var i=0;i<F.JOB_CATALOG_V96.length;i++){var j=F.JOB_CATALOG_V96[i].id;if(s.job_licenses[j].grade!=='UNREGISTERED')F.reconcileJobPointsPhase4(p,j);}};
 PlayerEvents.loggedIn(function(e){F.retryNewJobSkillPointsV96(e.player);});
})(global.FRankDays);
