// Personal v11 evidence and projection. No client packet supplies objective progress.
global.FRankDays=global.FRankDays||{};
(function(F){
 var LAST={},TICKS={},SEQ=0,Animal=null,WaterAnimal=null,AABB=null;
 var JOBS=['swordsman','berserker','ranger','healer','farmer','herbalist','angler','chef','blacksmith','relic_researcher','prospector','pathfinder'],GRADES=['F','E','D','C','B','A','S'];
 function uid(p){return String(p.uuid);}function clock(p){return Number(p.server.overworld().getTime());}
 function state(p){var s=F.loadPlayerState(p);s.promotion_tracker_v110=s.promotion_tracker_v110||{revision:0,ready:{},announced:{}};var q=s.promotion_tracker_v110;q.ready=q.ready||{};q.announced=q.announced||{};return s;}
 function save(p,s){F.savePlayerState(p,s);}function own(s,j){return !!(s.job_licenses&&s.job_licenses[j]&&GRADES.indexOf(s.job_licenses[j].grade)>=0);}
 function next(p,s,j){if(!own(s,j))return null;var i=GRADES.indexOf(s.job_licenses[j].grade),sp=i<6?F.getPracticalSpecPhase4(j,GRADES[i+1]):null;if(sp&&['B','A','S'].indexOf(sp.grade)>=0&&!s.mainland_sailing_unlocked)return null;return sp;}
 function rec(s,sp){return sp&&s.practical_promotions_phase4&&s.practical_promotions_phase4.receipts&&s.practical_promotions_phase4.receipts[sp.job+'_'+sp.grade];}
 function legacyTag(q){try{return q.persistentData||null;}catch(e){return null;}}
 function nativeTag(q){try{var raw=q.minecraftEntity||q;if(raw.getForgePersistentData)return raw.getForgePersistentData();}catch(e){}return legacyTag(q);}
 function health(q){try{var n=Number(q.health);if(isFinite(n))return n;if(q.getHealth)return Number(q.getHealth());}catch(e){}return NaN;}
 function yaw(p){try{var n=Number(p.getYaw());if(isFinite(n))return n;}catch(e){}var n=Number(p.yaw===undefined?p.yRot:p.yaw);return isFinite(n)?n:0;}
 function owned(q){var t=nativeTag(q),legacy=legacyTag(q);if(t&&t.contains('f_rank_mount_owner')||legacy&&legacy.contains('f_rank_mount_owner'))return true;try{if(q.getOwnerUUID&&q.getOwnerUUID()!==null)return true;}catch(e){}try{var n=q.nbt;if(n&&((n.contains&&n.contains('Owner'))||n.Owner!==undefined))return true;}catch(e){}return false;}
 F.getPromotionRaidIdV110=function(q){var tags=[nativeTag(q),legacyTag(q)];for(var i=0;i<tags.length;i++){var t=tags[i],k=t&&String(t.getString('fcraft_raid_id')||'');if(['krag','blossom','wrought'].indexOf(k)>=0&&t.getBoolean('fcraft_raid_v101'))return k;}return '';};
 F.isPromotionBossV110=function(q){if(F.getPromotionRaidIdV110(q))return true;var t=String(q.type);return t==='minecraft:wither'||t==='minecraft:ender_dragon'||!!(F.isTrackedBossV99&&F.isTrackedBossV99(t));};
 F.isValidPromoHuntTarget=function(p,q){
  if(!p||!p.server||!q||!q.uuid||!isFinite(health(q))||q.level&&q.level.isClientSide&&q.level.isClientSide())return false;
  var t=String(q.type);if(q.isPlayer&&q.isPlayer()||t==='minecraft:armor_stand'||t==='minecraft:villager'||t==='minecraft:wandering_trader'||t.indexOf('customnpcs:')===0||owned(q))return false;
  if(F.isManagedTrainingTargetV10&&F.isManagedTrainingTargetV10(q)||F.isNpcProtectedFromMagicV96&&F.isNpcProtectedFromMagicV96(q))return false;
  if(F.isPromotionBossV110(q))return true;
  if(String(q.getEntityType().getCategory()).toLowerCase()==='monster')return true;
  if(!Animal){Animal=Java.loadClass('net.minecraft.world.entity.animal.Animal');WaterAnimal=Java.loadClass('net.minecraft.world.entity.animal.WaterAnimal');}
  return q instanceof Animal||q instanceof WaterAnimal;
 };
 F.isPromotionTargetDeadV110=function(q){return !!q&&health(q)<=0;};
 F.getPromotionHuntWeightV110=function(p,q){return F.isValidPromoHuntTarget(p,q)?(F.isPromotionBossV110(q)?5:1):0;};
 F.isPromotionHitTargetV110=function(p,q){return F.isValidPromoHuntTarget(p,q)||!!(F.isPlayerTrainingAreaV10&&F.isPlayerTrainingAreaV10(p)&&F.isManagedTrainingTargetV10&&F.isManagedTrainingTargetV10(q));};
 function backstab(p,q){try{var v=q.getViewVector(1),dx=Number(p.x)-Number(q.x),dz=Number(p.z)-Number(q.z),len=Math.sqrt(dx*dx+dz*dz);return len>.001&&(Number(v.x())*dx+Number(v.z())*dz)/len<=-.5;}catch(e){return false;}}
 F.recordPromotionAppliedHitV110=function(p,q,amount,c){if(!(Number(amount)>0)||!F.isPromotionHitTargetV110(p,q))return false;return F.recordPracticalActionPhase4(p,{type:'promo_hit',actorUuid:uid(p),actionId:'p110:hit:'+uid(p)+':'+String(q.uuid)+':'+clock(p),targetUuid:String(q.uuid),target:q,damage:Number(amount),ranged:!!c.ranged,weaponId:String(c.weaponId||''),critical:!!c.critical,backstab:backstab(p,q),job:String(c.job||'')});};
 F.recordPromotionHuntKillV110=function(p,q,c){if(!F.isValidPromoHuntTarget(p,q)||!F.isPromotionTargetDeadV110(q))return false;return F.recordPracticalActionPhase4(p,{type:'promo_hunt_kill',actorUuid:uid(p),actionId:'p110:death:'+String(q.uuid),targetUuid:String(q.uuid),target:q,ranged:!!c.ranged,weaponId:String(c.weaponId||''),job:String(c.job||'')});};
 F.onPromotionRecoveryFinishV110=function(e){var p=e.getEntity(),st=e.getItem();if(!p||!p.isPlayer()||!st||st.empty)return;var t=String(st.id),kind='';if(st.getFoodProperties(p))kind='food_recovery';else if(t==='minecraft:potion'){var n=st.nbt,pt=n&&String(n.Potion||'');if(['minecraft:healing','minecraft:strong_healing','minecraft:regeneration','minecraft:long_regeneration','minecraft:strong_regeneration'].indexOf(pt)>=0)kind='healing_potion_use';}if(kind)F.recordPracticalActionPhase4(p,{type:kind,actorUuid:uid(p),actionId:'p110:use:'+uid(p)+':'+clock(p)+':'+t,itemId:t});};
 function select(p,j){var s=state(p);if(!next(p,s,j))return false;s.promotion_tracker_v110.selectedJob=j;save(p,s);return true;}
 F.isPromotionTrackerPinnedV110=function(p,j){return state(p).promotion_tracker_v110.selectedJob===j;};
 F.pinPromotionTrackerV110=function(p,j){if(!select(p,j))return{ok:false,reason:'no_active_personal_exam'};F.sendPromotionTrackerV110(p,'pin',true);return{ok:true,message:'우측 화면에 이 승급 시험을 고정했습니다.'};};
 F.getPromotionTrackerV110=function(p){
  var s=state(p),q=s.promotion_tracker_v110,j=q.selectedJob,sp=next(p,s,j);
  if(!sp||!rec(s,sp)){j='';var newest=-1;for(var i=0;i<JOBS.length;i++){var candidate=next(p,s,JOBS[i]),r=rec(s,candidate);if(r&&r.status==='ACCEPTED'&&Number(r.acceptedAt)>newest){newest=Number(r.acceptedAt);sp=candidate;j=JOBS[i];}}}
  if(!j||!sp||!rec(s,sp))return{visible:false,tracker_id:'',tasks:[],all_completed:false};
  var receipt=rec(s,sp),objectives=F.getPracticalObjectivesV106(p,j,sp.grade),tasks=[];for(var z=0;z<objectives.length;z++){var o=objectives[z];tasks.push({label:o.label,current:Number(o.current),goal:Number(o.target),done:!!o.done});}
  var ready=F.evaluatePracticalPromotionPhase4(p,j,sp.grade).ok,target=F.getQuestNpcTargetV106(p,receipt.proctor||sp.proctor),same=target&&String(p.level.dimension)===target.dimension,compass=same?F.computeQuestNpcCompassV106(p.x,p.z,yaw(p),target.x,target.z):null;
  return{visible:true,job_id:j,job_label:sp.label,target_grade:sp.grade,title:sp.label+' '+sp.grade+'급 승급 시험',all_completed:!!ready,tasks:tasks,mentor_name:target?target.name:sp.proctor,mentor_place:target?target.building:'담당 스승',compass_arrow:compass?compass.arrow:'↑',distance_m:compass?Math.ceil(compass.distance):-1,same_dimension:!!same,tracker_id:String(receipt.receiptId),quest_id:sp.quest,activity_hint:({swordsman:'사냥: 외곽 들판·초입 동물/몹',berserker:'사냥: 외곽 들판·초입 동물/몹',ranger:'사냥: 외곽 들판·초입 동물/몹',pathfinder:'탐사: 세르딘 삼거리·상자 거점',healer:'수행: 약초 채집·회복',farmer:'수행: 경작지·밭',herbalist:'수행: 야생 약초·물약상',angler:'수행: 해안 낚시터',chef:'수행: 여관 화덕·조리',blacksmith:'수행: 채광·화로 제련',relic_researcher:'탐사: 세르딘 비석·상자',prospector:'수행: 세르딘 광맥'})[j]||'담당 스승의 실기 안내'};
 };
 F.sendPromotionTrackerV110=function(p,reason,force){
  var out=F.getPromotionTrackerV110(p),k=uid(p),signature=JSON.stringify(out);if(!force&&LAST[k]===signature)return out;
  var s=state(p),q=s.promotion_tracker_v110,rid=out.tracker_id,previous=!!q.ready[rid],announce=reason==='progress'&&!!rid&&out.all_completed&&!previous&&!q.announced[rid];
  if(rid){q.ready[rid]=!!out.all_completed;if(announce)q.announced[rid]=true;}q.revision=Number(q.revision||0)+1;save(p,s);
  LAST[k]=signature;out.revision=q.revision;out.sync_reason=String(reason||'direction');out.announce_completion=!!announce;out.completion_event_id=out.all_completed?rid+':complete':'';
  p.sendData('f_rank_days:sync_promo_tracker',{tracker_json:JSON.stringify(out)});return out;
 };
 function relevant(r,change){if(r.requirements){for(var i=0;i<r.requirements.length;i++)if(relevant(r.requirements[i],change))return true;}if(r.kind==='counter')return change.keys.indexOf(r.key)>=0;if(r.kind==='counter_sum'){for(var k=0;k<r.keys.length;k++)if(change.keys.indexOf(r.keys[k])>=0)return true;}return r.kind==='enhance'&&change.type==='enhance'||r.kind==='delivery'&&(change.type==='craft'||change.type==='smelt');}
 F.onPromotionPracticalChangedV110=function(p,change){var s=state(p),found=[],selected=s.promotion_tracker_v110.selectedJob;for(var i=0;i<JOBS.length;i++){var j=JOBS[i],sp=next(p,s,j);if(!rec(s,sp))continue;for(var z=0;z<sp.requirements.length;z++)if(relevant(sp.requirements[z],change)){found.push(j);break;}}var j=found.indexOf(change.job)>=0?change.job:found.indexOf(selected)>=0?selected:found[0];if(j)select(p,j);F.sendPromotionTrackerV110(p,'progress',true);};
 var oldAccept=F.acceptPracticalPromotionPhase4;F.acceptPracticalPromotionPhase4=function(p,j,g,n){var r=oldAccept(p,j,g,n);if(r&&r.ok){select(p,j);F.sendPromotionTrackerV110(p,'accept',true);}return r;};
 var oldEnsure=F.ensureNextPracticalPromotionV106;F.ensureNextPracticalPromotionV106=function(p,j){var r=oldEnsure(p,j);if(r&&r.ok&&!r.already){select(p,j);F.sendPromotionTrackerV110(p,'accept',true);}return r;};
 var oldClaim=F.claimPromotionFromMentorV106;F.claimPromotionFromMentorV106=function(p,n,j){var r=oldClaim(p,n,j);if(r&&r.ok){select(p,j);F.sendPromotionTrackerV110(p,'claim',true);}return r;};
 // Raid rewards commit their personal receipts before this public service returns.
 function refreshAfterBoss(q,result){if(!result||!result.ok||result.already||!q||!q.server)return;var ps=q.server.players;for(var i=0;i<ps.size();i++)F.sendPromotionTrackerV110(ps.get(i),'progress',false);}
 var oldRaidDeath=F.handleChapter1RaidDeathV101;if(oldRaidDeath)F.handleChapter1RaidDeathV101=function(q,k){var r=oldRaidDeath(q,k);refreshAfterBoss(q,r);return r;};
 var oldBossDeath=F.handleBossDeathV99;if(oldBossDeath)F.handleBossDeathV99=function(q,k){var r=oldBossDeath(q,k);refreshAfterBoss(q,r);return r;};
 // A single server loop, never one replenishment loop per online player.
 var ZONES=[{minX:68,maxX:115,minZ:35,maxZ:85},{minX:-95,maxX:-55,minZ:45,maxZ:90},{minX:-45,maxX:55,minZ:-195,maxZ:-145}],SPECIES=['minecraft:pig','minecraft:sheep','minecraft:cow','minecraft:chicken'];
 function nearPlayer(server,x,y,z,r){var ps=server.players;for(var i=0;i<ps.size();i++){var p=ps.get(i);if(String(p.level.dimension)!=='minecraft:overworld'||p.isSpectator())continue;var dx=Number(p.x)-x,dy=Number(p.y)-y,dz=Number(p.z)-z;if(dx*dx+dy*dy+dz*dz<=r*r)return true;}return false;}
 function protectedStarterSite(server,a,x,y,z){var dx=x-Number(a.x),dz=z-Number(a.z);if(dx*dx+dz*dz<1024)return true;var structures=F.BRION_V7_STRUCTURES||[];for(var i=0;i<structures.length;i++){var r=structures[i];if(dx>=Number(r.dx)-3&&dx<=Number(r.dx)+Number(r.w)+2&&dz>=Number(r.dz)-3&&dz<=Number(r.dz)+Number(r.l)+2)return true;}if(F.isNaturalTraitHarvestV98&&!F.isNaturalTraitHarvestV98(server,{dimension:'minecraft:overworld',x:x,y:y-1,z:z}))return true;return !!(F.shouldProtectTrainingBlockV10&&F.shouldProtectTrainingBlockV10(server,'minecraft:overworld',x,y,z));}
 function box(x0,y0,z0,x1,y1,z1){if(!AABB)AABB=Java.loadClass('net.minecraft.world.phys.AABB');return new AABB(x0,y0,z0,x1,y1,z1);}
 function each(list,fn){for(var i=0;i<list.size();i++)fn(list.get(i));}
 F.ensureStarterHuntingAnimals=function(server){
  var anchor=F.getVillageAnchor(server),world=server.overworld(),summary={spawned:0,zones:[]};if(!anchor||!anchor.built)return summary;
  for(var zi=0;zi<ZONES.length;zi++){var z=ZONES[zi],x0=Number(anchor.x)+z.minX,x1=Number(anchor.x)+z.maxX,z0=Number(anchor.z)+z.minZ,z1=Number(anchor.z)+z.maxZ,cx=(x0+x1)/2,cz=(z0+z1)/2;
   if(!nearPlayer(server,cx,Number(anchor.y),cz,96))continue;var loaded=true;for(var chx=Math.floor(x0/16);chx<=Math.floor(x1/16);chx++)for(var chz=Math.floor(z0/16);chz<=Math.floor(z1/16);chz++)if(!world.hasChunk(chx,chz))loaded=false;if(!loaded)continue;
   var count=0;each(world.getEntitiesWithin(box(x0,Number(anchor.y)-24,z0,x1,Number(anchor.y)+32,z1)),function(q){if(SPECIES.indexOf(String(q.type))>=0&&!owned(q)&&q.isAlive())count++;});var need=count<8?Math.min(8-count,4+Math.floor(Math.random()*3)):0,spawned=0;
   for(var attempt=0;attempt<32&&spawned<need;attempt++){var x=Math.floor(x0+Math.random()*(x1-x0+1)),zz=Math.floor(z0+Math.random()*(z1-z0+1));if(!world.hasChunk(x>>4,zz>>4))continue;var y=Number(world.getHeight(Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types').MOTION_BLOCKING_NO_LEAVES,x,zz));if(!isFinite(y)||Math.abs(y-Number(anchor.y))>20||protectedStarterSite(server,anchor,x,y,zz)||!nearPlayer(server,x,y,zz,80))continue;
    var ground=String(world.getBlock(x,y-1,zz).id);if(ground!=='minecraft:grass_block'||String(world.getBlock(x,y,zz).id)!=='minecraft:air'||String(world.getBlock(x,y+1,zz).id)!=='minecraft:air')continue;
    var occupied=false;each(world.getEntitiesWithin(box(x-8,y-4,zz-8,x+9,y+5,zz+9)),function(q){if(q.isPlayer&&q.isPlayer()||String(q.type).indexOf('customnpcs:')===0||F.isNpcProtectedFromMagicV96&&F.isNpcProtectedFromMagicV96(q))occupied=true;});if(occupied)continue;
    var q=world.createEntity(SPECIES[(zi+spawned)%SPECIES.length]);q.setPosition(x+.5,y,zz+.5);if(world.noCollision&&!world.noCollision(q,q.getBoundingBox()))continue;q.spawn();spawned++;
   }summary.spawned+=spawned;summary.zones.push({zone:zi,before:count,spawned:spawned});
  }return summary;
 };
 PlayerEvents.loggedIn(function(e){F.sendPromotionTrackerV110(e.player,'login',true);});
 PlayerEvents.loggedOut(function(e){delete LAST[uid(e.player)];delete TICKS[uid(e.player)];});
 PlayerEvents.tick(function(e){var p=e.player,k=uid(p),t=clock(p);if(TICKS[k]!==undefined&&t>=TICKS[k]&&t-TICKS[k]<20)return;TICKS[k]=t;var a=F.getVillageAnchor(p.server);if(a&&a.built&&String(p.level.dimension)==='minecraft:overworld'){var dx=Number(p.x)-Number(a.x)-6,dz=Number(p.z)-Number(a.z)+208;if(dx*dx+dz*dz<=144){var s=F.loadPlayerState(p),ps=s.practical_promotions_phase4;if(ps){ps.visits=ps.visits||{};if(!ps.visits.serdin_trijunction){ps.visits.serdin_trijunction=true;save(p,s);F.sendPromotionTrackerV110(p,'progress',true);}}}}F.sendPromotionTrackerV110(p,'direction',false);});
 ServerEvents.tick(function(e){var t=Number(e.server.overworld().getTime());if(t%1200===0)F.ensureStarterHuntingAnimals(e.server);});
})(global.FRankDays);
