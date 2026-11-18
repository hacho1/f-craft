// One authoritative 84-node effect/point service. Save roots and old node IDs survive.
global.FRankDays=global.FRankDays||{};
(function(F){
 var JOBS=['swordsman','berserker','ranger','healer','farmer','herbalist','angler','chef','blacksmith','relic_researcher','prospector','pathfinder'];
 var GRADES=['F','E','D','C','B','A','S'],INC=[1,1,2,2,2,3,3],COST=INC,CAPTURE_JOBS=JOBS.concat(['alchemist','mage']);
 var IDS={},OLD_COST={},runtime={},snapshotServer=null,snapshot=null,snapshotError=null;
 for(var j=0;j<JOBS.length;j++){var job=JOBS[j];IDS[job]=[];for(var n=1;n<=7;n++)IDS[job].push(job+'_node_'+n);OLD_COST[job]={};OLD_COST[job][job+'_node_1']=1;}
 IDS.farmer=['farmer_node_1_basic','farmer_node_2_soil','farmer_node_3_research','farmer_node_4_advanced','farmer_node_5_expert','farmer_node_6','farmer_node_7'];
 OLD_COST.farmer={farmer_node_1_basic:1,farmer_node_2_soil:1,farmer_node_3_research:2,farmer_node_4_advanced:2,farmer_node_5_expert:3};
 OLD_COST.alchemist={alchemist_node_1:1};OLD_COST.mage={mage_node_1:1};
 function clone(x){return JSON.parse(JSON.stringify(x));}
 function uuid(p){return String(p.uuid);}
 function raw(p){return p.minecraftPlayer||p;}
 function now(p){return Number(p.server.overworld().getTime());}
 function player(e){return Boolean(e&&typeof e.isPlayer==='function'&&e.isPlayer());}
 function state(p){return F.loadPlayerState(p);}
 function growth(s){return s.phase4_growth||(s.phase4_growth={version:1,categories:{},cooldowns:{},discovery:{}});}
 function rt(p){var k=uuid(p);return runtime[k]||(runtime[k]={nodes:{},until:0,rollHitUntil:0,killHasteUntil:0});}
 function cat(job){if(!Platform.isLoaded('puffish_skills'))return null;var API=Java.loadClass('net.puffish.skillsmod.api.SkillsAPI'),RL=Java.loadClass('net.minecraft.resources.ResourceLocation'),opt=API.getCategory(new RL('f_rank_days:'+job));return opt.isPresent()?opt.get():null;}
 function rl(s){return new (Java.loadClass('net.minecraft.resources.ResourceLocation'))(s);}
 function readCompound(tag){var out={},it=tag.getAllKeys().iterator();while(it.hasNext()){var k=String(it.next());out[k]=Number(tag.getInt(k));}return out;}
 function existingFile(parent,name){var files=parent.listFiles();if(files===null)throw new Error('Unreadable world directory');for(var i=0;i<files.length;i++)if(String(files[i].getName())===name)return files[i];return null;}
 // Capture BEFORE showCategory overwrites starting_points. This journal belongs to this world.
 F.captureLegacySkillSnapshotPhase4=function(server){
  if(snapshotServer&&F.sameFcraftServer(snapshotServer,server))return snapshotError===null;
  snapshotServer=server;snapshot={};snapshotError=null;runtime={};
  try{
   var key='fcraft_phase4_puffish_snapshot_v1',pd=server.persistentData;
   if(pd.contains(key)){snapshot=JSON.parse(String(pd.getString(key)));return true;}
   var root=server.getWorldPath(Java.loadClass('net.minecraft.world.level.storage.LevelResource').ROOT).toFile(),dir=existingFile(root,'data'),file=dir&&existingFile(dir,'puffish_skills.dat');
   if(file){
    var tag=Java.loadClass('net.minecraft.nbt.NbtIo').readCompressed(file).getCompound('data').getCompound('players'),players=tag.getAllKeys().iterator();
    while(players.hasNext()){
     var id=String(players.next()),categories=tag.getCompound(id).getCompound('categories'),record={};
     for(var k=0;k<CAPTURE_JOBS.length;k++){
      var name=CAPTURE_JOBS[k],keyId='f_rank_days:'+name;if(!categories.contains(keyId))continue;
      var c=categories.getCompound(keyId),list=c.getList('unlocked_skills',8),nodes=[];for(var q=0;q<list.size();q++)nodes.push(String(list.getString(q)));
      var points=c.contains('points',10)?readCompound(c.getCompound('points')):{'puffish_skills:legacy':Number(c.getInt('points'))};
      record[name]={unlocked:Boolean(c.getBoolean('unlocked')),nodes:nodes,points:points,experience:Number(c.getInt('experience'))};
     }snapshot[id]=record;
    }
   }
   pd.putString(key,JSON.stringify(snapshot));return true;
  }catch(error){snapshotError=String(error);console.error('[F-Craft phase4] Point migration paused: '+snapshotError);return false;}
 };
 function categoryReceipt(s,job){var root=s.phase4_growth||(s.phase4_growth={version:1,categories:{},cooldowns:{},discovery:{}});root.categories=root.categories||{};return root.categories[job]||(root.categories[job]={grades:{}});}
 function sum(a){var x=0;for(var k in a)x+=Number(a[k]||0);return x;}
 function oldSpent(job,nodes){var x=0;for(var i=0;i<nodes.length;i++)x+=Number(OLD_COST[job][nodes[i]]||0);return x;}
 function setFixed(c,p,source,value){var id=rl('f_rank_days:'+source);if(Number(c.getPoints(raw(p),id))!==Number(value))c.setPoints(raw(p),id,Math.floor(value));return Number(c.getPoints(raw(p),id))===Math.floor(value);}
 F.reconcileJobPointsPhase4=function(p,onlyJob){
  if(!F.captureLegacySkillSnapshotPhase4(p.server))return false;
  var all=onlyJob?[onlyJob]:JOBS,ok=true;
  for(var ji=0;ji<all.length;ji++){
   var job=String(all[ji]);if(JOBS.indexOf(job)<0)continue;
   var c=cat(job);if(!c){ok=false;continue;}
   var s=state(p),rec=categoryReceipt(s,job),grade=s.job_licenses[job]&&s.job_licenses[job].grade,rank=GRADES.indexOf(String(grade)),playerBaseline=snapshot[uuid(p)]||{},baseline=playerBaseline[job],sourceCategory=job,compat=s.compatibility_v98||{};
   if(!baseline&&rank>=0&&job==='herbalist'&&playerBaseline.alchemist&&s.job_licenses.alchemist&&GRADES.indexOf(s.job_licenses.alchemist.grade)>=0){baseline=playerBaseline.alchemist;sourceCategory='alchemist';if(!s.migrations_v96||!s.migrations_v96.alchemist_skills){ok=false;continue;}}
   if(!baseline&&rank>=0&&job==='relic_researcher'&&playerBaseline.mage&&compat.jobs&&compat.jobs.mage){baseline=playerBaseline.mage;sourceCategory='mage';if(!compat.mage_skill_points_copied){ok=false;continue;}}
   if(!rec.migrated){
    var registered=rank>=0,old=baseline||{nodes:[],points:{},unlocked:false},spent=oldSpent(sourceCategory,old.nodes),current=0,mapped=[];
    for(var i=0;i<old.nodes.length;i++){var node=sourceCategory==='alchemist'?String(old.nodes[i]).replace(/^alchemist_/,'herbalist_'):old.nodes[i],index=IDS[job].indexOf(node);if(index>=0){current+=COST[index];mapped.push(node);}}
    // Mage retains its original spent nodes. Its available max-difference is copied by33,
    // so neither that historical spend nor its starting point is cloned here.
    var starting=registered&&sourceCategory!=='mage'?Number(old.points['puffish_skills:starting']||0):0,delta=sourceCategory==='mage'?0:current-spent;
    c.setPoints(raw(p),rl('puffish_skills:starting'),0);
    if(!setFixed(c,p,'phase4_starting_import',starting)||!setFixed(c,p,'phase4_cost_import',delta)){ok=false;continue;}
    rec.migration={sourceCategory:sourceCategory,oldNodes:old.nodes,mappedNodes:mapped,oldSources:old.points,oldSpent:spent,newSpent:current,oldAvailable:sum(old.points)-spent,costOffset:delta,startingImported:starting,registeredAtImport:registered};
    // All pre-existing legal sources remain. Only fill missing old rank entitlements once.
    if(registered&&baseline){
     var target=0;for(var g=0;g<=rank;g++)target+=INC[g];
     var oldTotal=sum(old.points),bonus=0;for(var source in old.points)if(/boss_sculptor_v99|mainland_pilgrimage_v96/.test(source))bonus+=Number(old.points[source]);
     // A Mage available-credit source is already earned progression, not a reason to
     // issue the same grades again. Retained Mage spend counts for entitlement only.
     var retainedMageSpend=job==='relic_researcher'&&sourceCategory!=='mage'&&compat.mage_skill_points_copied&&compat.mage_point_transfer?Math.max(0,Number(compat.mage_point_transfer.original_spent||0)):0;
     var missing=Math.max(0,target-Math.max(0,oldTotal-bonus+retainedMageSpend));rec.migration.retainedMageSpendForEntitlement=retainedMageSpend;
     if(!setFixed(c,p,'phase4_legacy_grade_completion',missing)){ok=false;continue;}
     rec.migration.missingOldEntitlement=missing;for(var g2=0;g2<=rank;g2++)rec.grades[GRADES[g2]]={imported:true};
    }
    rec.migrated=true;F.savePlayerState(p,s);
   }
   if(rank<0)continue;
   if(!c.isUnlocked(raw(p)))c.unlock(raw(p));
   // Unlock resets the managed starting source to zero; migration credit is separate.
   for(var r=0;r<=rank;r++){
    var gradeName=GRADES[r];if(rec.grades[gradeName]&&rec.grades[gradeName].imported)continue;
    if(!setFixed(c,p,'phase4_promotion_'+gradeName.toLowerCase(),INC[r])){ok=false;continue;}
    rec.grades[gradeName]={amount:INC[r],fixed:true};
   }
   F.savePlayerState(p,s);
  }return ok;
 };
 F.onPromotionPointsPhase4=function(p,job,grade,receipt){
  var s=state(p);if(!receipt||String(receipt.holderUuid||receipt.holderUUID)!==uuid(p)||!s.job_licenses[job]||s.job_licenses[job].grade!==grade)return false;
  return F.reconcileJobPointsPhase4(p,job);
 };
 F.refreshPassiveNodesPhase4=function(p,force){
  var r=rt(p),t=now(p);if(!force&&t<r.until)return r.nodes;r.until=t+20;
  var s=state(p);for(var j=0;j<JOBS.length;j++){
   var job=JOBS[j],c=cat(job),flags=[false,false,false,false,false,false,false],registered=s.job_licenses[job]&&GRADES.indexOf(s.job_licenses[job].grade)>=0;
   if(c&&registered){var it=c.streamUnlockedSkills(raw(p)).iterator();while(it.hasNext()){var id=String(it.next().getId()),index=IDS[job].indexOf(id);if(index>=0)flags[index]=true;}}
   r.nodes[job]=flags;
   for(var n=0;n<7;n++){var tag='frank_phase4_'+job+'_'+(n+1);if(flags[n])p.addTag(tag);else p.removeTag(tag);}
   if(job==='farmer'){var legacy=['frank_skill_farmer_1_basic','frank_skill_farmer_2_soil','frank_skill_farmer_3_research','frank_skill_farmer_4_advanced','frank_skill_farmer_5_expert'];for(var l=0;l<legacy.length;l++){if(flags[l])p.addTag(legacy[l]);else p.removeTag(legacy[l]);}}
  }return r.nodes;
 };
 F.hasPassivePhase4=function(p,job,node){var nodes=F.refreshPassiveNodesPhase4(p,false)[job];return Boolean(nodes&&nodes[node-1]);};
 function has(p,j,n){return F.hasPassivePhase4(p,j,n);}
 F.getPassiveProfilePhase4=function(p,job){
  var r=rt(p),profile={meleeMultiplier:1,axeMultiplier:1,rangedMultiplier:1,bossMultiplier:1,incomingMultiplier:1,manaCostMultiplier:1,parryWindowBonusMs:0,parryCooldownMultiplier:1,rollFirstHitMultiplier:1,armorPenetration:0,bandageBonusHp:0,selfHealMultiplier:1,whirlwindBonusTicks:0,markedTargetMultiplier:1,longRangeMultiplier:1,windBurst:false};
  if(job==='swordsman'){
   if(has(p,job,1))profile.meleeMultiplier=1.05;if(has(p,job,2))profile.parryWindowBonusMs=120;
   if(has(p,job,5)&&now(p)<r.rollHitUntil)profile.rollFirstHitMultiplier=1.25;
   if(has(p,job,7)){profile.parryCooldownMultiplier=.7;profile.manaCostMultiplier=.8;profile.bossMultiplier=1.15;}
  }
  if(job==='berserker'){if(has(p,job,1))profile.axeMultiplier=1.06;if(has(p,job,4)&&Number(p.health)<=Number(p.maxHealth)*.5){profile.axeMultiplier*=1.18;profile.incomingMultiplier=.9;}if(has(p,job,7))profile.whirlwindBonusTicks=20;}
  if(job==='ranger'){if(has(p,job,2))profile.rangedMultiplier=1.08;if(has(p,job,4))profile.markedTargetMultiplier=1.15;if(has(p,job,5))profile.armorPenetration=.25;if(has(p,job,7)){profile.longRangeMultiplier=1.3;profile.windBurst=true;}}
  if(job==='healer'){if(has(p,job,2))profile.bandageBonusHp=2;if(has(p,job,3))profile.selfHealMultiplier=1.2;}
  return profile;
 };
 function effect(p,id,ticks,amp){p.potionEffects.add('minecraft:'+id,ticks,amp||0,false,false);}
 function heal(p,amount){var before=Number(p.health);p.heal(amount);return Math.max(0,Number(p.health)-before);}
 function allies(p,radius){var list=p.server.players,out=[];for(var i=0;i<list.size();i++){var a=list.get(i);if(String(a.level.dimension)!==String(p.level.dimension)||!a.isAlive()||a.isSpectator())continue;var dx=Number(p.x)-Number(a.x),dy=Number(p.y)-Number(a.y),dz=Number(p.z)-Number(a.z);if(dx*dx+dy*dy+dz*dz>radius*radius)continue;if(a.equals(p)||(F.areManaAlliesV98&&F.areManaAlliesV98(p,a)))out.push(a);}return out;}
 F.onCombatActionPhase4=function(p,action){
  var job=String(action.job||''),r=rt(p),t=now(p);if(action.type==='roll'){r.rollHitUntil=t+60;return;}
  if(action.type==='hit'){
   if(job==='swordsman'&&has(p,job,5)&&r.rollHitUntil>t)r.rollHitUntil=0;
   if(job==='ranger'&&has(p,job,6))effect(p,'speed',40,0);
   if(job==='ranger'&&has(p,job,7)&&action.ranged&&action.target&&!action.passiveEcho&&F.passiveRangerWindPhase4)F.passiveRangerWindPhase4(p,action.target);
   if(job==='berserker'&&has(p,job,2)&&action.target&&action.charged&&action.target.isBlocking&&action.target.isBlocking()){action.target.stopUsingItem();if(player(action.target))action.target.getCooldowns().addCooldown(Java.loadClass('net.minecraft.world.item.Items').SHIELD,60);}
   if(job==='berserker'&&has(p,job,5)&&action.critical&&F.applyManaControlPhase4)F.applyManaControlPhase4(p,action.target,'fear',40);
  }
  if(action.type==='kill'){
   if(job==='swordsman'&&has(p,job,6)){heal(p,2);r.killHasteUntil=t+120;F.applyPassiveModifiersPhase4(p,true);}
   if(job==='berserker'&&has(p,job,6)){heal(p,3);if(F.restoreManaV98)F.restoreManaV98(p,10,'berserker_kill');}
  }
  if(action.type==='parry'&&has(p,'swordsman',4)&&F.passiveParryWavePhase4)F.passiveParryWavePhase4(p);
  if(action.type==='heal'&&action.target){if(has(p,'healer',5))F.cleansePassiveDebuffPhase4(action.target);if(has(p,'healer',6)){effect(action.target,'resistance',80,0);effect(action.target,'regeneration',100,0);}}
 };
 F.cleansePassiveDebuffPhase4=function(p){var list=Java.loadClass('java.util.ArrayList'),effects=new list(p.getActiveEffects());for(var i=0;i<effects.size();i++){var e=effects.get(i).getEffect();if(!e.isBeneficial()){p.removeEffect(e);return true;}}return false;};
 F.onPassiveEffectApplicablePhase4=function(e){var p=e.getEntity(),instance=e.getEffectInstance();if(player(p)&&instance&&instance.getEffect().equals(Java.loadClass('net.minecraft.world.effect.MobEffects').POISON)&&has(p,'herbalist',7))e.setResult(Java.loadClass('net.minecraftforge.eventbus.api.Event$Result').DENY);};
 F.onPassiveLivingDeathPhase4=function(e){
  var target=e.getEntity();if(!player(target))return;var t=now(target),s=state(target),rec=growth(s);rec.cooldowns=rec.cooldowns||{};
  if(has(target,'berserker',7)&&Number(rec.cooldowns.berserker||0)<=t){rec.cooldowns.berserker=t+3600;rt(target).immortalUntil=t+100;F.savePlayerState(target,s);e.setCanceled(true);target.health=1;effect(target,'strength',100,1);return;}
  var friends=allies(target,8);for(var i=0;i<friends.length;i++){var h=friends[i];if(!has(h,'healer',7))continue;var hs=state(h),hr=growth(hs);hr.cooldowns=hr.cooldowns||{};if(Number(hr.cooldowns.party_save||0)>t)continue;hr.cooldowns.party_save=t+3600;F.savePlayerState(h,hs);e.setCanceled(true);target.health=Math.min(6,Number(target.maxHealth));effect(target,'regeneration',100,1);return;}
 };
 F.applyPassiveIncomingPhase4=function(p,src,amount){
  var id=F.damageTypeIdPhase4(src),r=rt(p);if(r.immortalUntil>now(p))return Math.min(amount,Math.max(0,Number(p.health)-1));
  if(has(p,'berserker',4)&&Number(p.health)<=Number(p.maxHealth)*.5)amount*=.9;
  if(id==='fall'){if(has(p,'pathfinder',7))amount*=.5;else if(has(p,'pathfinder',2))amount*=.75;}
  if((id==='onFire'||id==='inFire'||id==='lava')&&has(p,'chef',2))amount*=.5;
  if((id.indexOf('explosion')>=0||id==='fallingBlock'||id==='fallingAnvil')&&has(p,'prospector',3))amount*=.6;
  if(id==='magic'&&p.hasEffect(Java.loadClass('net.minecraft.world.effect.MobEffects').POISON)&&has(p,'herbalist',3))amount*=.5;
  if(has(p,'relic_researcher',5)&&F.isInsideDungeonPhase4&&F.isInsideDungeonPhase4(p))amount*=.88;
  return amount;
 };
 function modifierId(i){return'4fc4a100-7ec4-4d00-9a84-'+('000000000000'+i).slice(-12);}
 var MODS=[['minecraft:generic.max_health','ADD'],['minecraft:generic.movement_speed','MULTIPLY_BASE'],['minecraft:generic.armor','ADD'],['minecraft:generic.armor_toughness','ADD'],['minecraft:generic.knockback_resistance','ADD'],['minecraft:generic.attack_speed','MULTIPLY_BASE'],['forge:swim_speed','MULTIPLY_BASE'],['forge:step_height_addition','ADD']];
 F.applyPassiveModifiersPhase4=function(p,force){
  var r=rt(p);F.refreshPassiveNodesPhase4(p,force);var n=r.nodes;
  var values=[(n.swordsman[2]?2:0)+(n.berserker[2]?4:0)+(n.healer[0]?2:0)+(n.relic_researcher[2]?2:0),Math.max(n.ranger[0]? .04:0,n.relic_researcher[0]? .03:0,n.pathfinder[6]? .12:n.pathfinder[0]? .06:0),n.blacksmith[1]?2:0,n.blacksmith[5]?2:0,n.berserker[1]? .15:0,r.killHasteUntil>now(p)? .15:0,n.angler[0]? .2:0,n.pathfinder[2]? .5:0];
  var signature=JSON.stringify(values)+'|'+String(p.level.dimension);if(!force&&signature===r.modifiers)return;r.modifiers=signature;
  var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),Forge=Java.loadClass('net.minecraftforge.common.ForgeMod'),UUID=Java.loadClass('java.util.UUID'),M=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),Op=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation');
  var types=[A.MAX_HEALTH,A.MOVEMENT_SPEED,A.ARMOR,A.ARMOR_TOUGHNESS,A.KNOCKBACK_RESISTANCE,A.ATTACK_SPEED,Forge.SWIM_SPEED.get(),Forge.STEP_HEIGHT_ADDITION.get()];
  for(var i=0;i<types.length;i++){var a=p.getAttribute(types[i]);if(!a)continue;var id=UUID.fromString(modifierId(i));a.removeModifier(id);if(values[i])a.addPermanentModifier(new M(id,'fcraft_phase4_'+i,values[i],MODS[i][1]==='ADD'?Op.ADDITION:Op.MULTIPLY_BASE));}
  if(Number(p.health)>Number(p.maxHealth))p.health=Number(p.maxHealth);
 };
 F.getProfessionSaleMultiplierPhase4=function(p,item,npc){
  var value=1;if(has(p,'farmer',7)&&/wheat|carrot|potato|beetroot|melon|pumpkin/.test(String(item)))value=1.2;
  if(has(p,'chef',6)&&npc==='gori'&&(/farmersdelight:|bread|soup|stew|ration|tart/.test(String(item))))value=Math.max(value,1.2);
  if(has(p,'relic_researcher',6)&&/relic|ancient|rubbing|tablet|fragment/.test(String(item)))value=Math.max(value,1.25);return value;
 };
 F.getBlacksmithEnhancementBonusPhase4=function(p){return has(p,'blacksmith',7)? .15:has(p,'blacksmith',5)? .08:0;};
 F.getBlacksmithRepairMultiplierPhase4=function(p){return has(p,'blacksmith',4)? .75:1;};
 F.getSurveySilverMultiplierPhase4=function(p){return has(p,'pathfinder',7)?2:1;};
 F.getPassiveDurabilityProtectionPhase4=function(p,item){var id=String(item.id||item);return(has(p,'blacksmith',1)||has(p,'swordsman',3)||has(p,'farmer',1)&&/_hoe$|scythe/.test(id)||has(p,'angler',3)&&/fishing_rod/.test(id))? .25:0;};
 F.onPassiveBandagePhase4=function(p,target,actualHealed){
  F.onCombatActionPhase4(p,{type:'heal',target:target,amount:actualHealed});if(!has(p,'healer',4)||actualHealed<=0)return;
  var friends=allies(target,5);for(var i=0;i<friends.length;i++)if(!friends[i].equals(target)){var healed=heal(friends[i],actualHealed*.5);if(healed>0)F.onCombatActionPhase4(p,{type:'heal',target:friends[i],amount:healed});}
 };
 F.onPassiveFishedPhase4=function(e){
  var p=e.getEntity();if(!player(p)||e.isCanceled()||!e.getDrops().size())return;var drops=e.getDrops(),growthSource=F.getFishingSourceV10?F.getFishingSourceV10(e.getHookEntity()):null;if(F.onChapter1FishCandidateV10)F.onChapter1FishCandidateV10(e);
  if(has(p,'angler',2)&&F.queueFishingXpPhase4)F.queueFishingXpPhase4(p,e.getHookEntity());
  var chance=has(p,'angler',7)? .45:has(p,'angler',4)? .25:0;if(Number(p.random.nextFloat())<chance){var extra=drops.get(0).copy();extra.count=1;drops.add(extra);}
  if(has(p,'angler',5))effect(p,'luck',600,0);
  if(has(p,'angler',6)&&Number(p.random.nextFloat())<(F.chapter1RareChanceV10?F.chapter1RareChanceV10(.08,growthSource):.08))drops.add(Item.of(Number(p.random.nextFloat())<.8?'f_rank_days:silver_coin':'minecraft:emerald'));
  if(has(p,'angler',7)&&p.level.isRaining()&&Number(p.random.nextFloat())<(F.chapter1RareChanceV10?F.chapter1RareChanceV10(.03,growthSource):.03))drops.add(Item.of('f_rank_days:tempering_stone'));
 };
 F.PASSIVE_JOB_IDS_PHASE4=JOBS;F.PASSIVE_NODE_IDS_PHASE4=IDS;F.PASSIVE_COSTS_PHASE4=COST;
 ServerEvents.loaded(function(e){F.captureLegacySkillSnapshotPhase4(e.server);});
 PlayerEvents.loggedIn(function(e){F.reconcileJobPointsPhase4(e.player);F.applyPassiveModifiersPhase4(e.player,true);});
 PlayerEvents.respawned(function(e){e.server.scheduleInTicks(1,function(){F.applyPassiveModifiersPhase4(e.player,true);});});
 PlayerEvents.loggedOut(function(e){delete runtime[uuid(e.player)];});
 PlayerEvents.tick(function(e){var p=e.player,t=now(p);if(t%20!==0)return;F.applyPassiveModifiersPhase4(p,false);
  if(t%100===0)F.reconcileJobPointsPhase4(p);
  if(has(p,'herbalist',7))p.removeEffect(Java.loadClass('net.minecraft.world.effect.MobEffects').POISON);
  if(has(p,'relic_researcher',1)&&Number(p.level.getBlock(Math.floor(p.x),Math.floor(p.y+1),Math.floor(p.z)).light)<=7)effect(p,'night_vision',240,0);
  if(has(p,'prospector',6)&&String(p.level.getBlock(Math.floor(p.x),Math.floor(p.y-1),Math.floor(p.z)).id).indexOf('deepslate')>=0){effect(p,'haste',60,0);effect(p,'night_vision',240,0);}
 });
})(global.FRankDays);
