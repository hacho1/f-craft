global.FRankDays=global.FRankDays||{};
(function(F){
 var oldBoss=F.handleBossDefeatedV8,oldSummon=F.summonWroughtBossAtAltarV8,oldSync=F.syncFtbQuestStagesForPlayer;
 F.BOSS_ALTAR_CONFIG_V8.chapter1_gatekeeper_scale={max_health_multiplier:0.85,attack_damage_multiplier:0.85};
 F.applyGatekeeperScaleV96=function(e){
   if(!e||String(e.type)!=='mowziesmobs:ferrous_wroughtnaut'||!F.hasEntityTag(e,'f_rank_altar_boss'))return false;
   var cfg=F.BOSS_ALTAR_CONFIG_V8.chapter1_gatekeeper_scale,ids=['6f960000-0000-4000-8000-000000000001','6f960000-0000-4000-8000-000000000002'],attrs=['minecraft:generic.max_health','minecraft:generic.attack_damage'],amounts=[Number(cfg.max_health_multiplier)-1,Number(cfg.attack_damage_multiplier)-1];
   if(!isFinite(amounts[0])||!isFinite(amounts[1])||amounts[0]<=-1||amounts[1]<=-1)return false;
   var data=e.persistentData;if(data.getInt('fcraft_gate_scale_version_v99')===1)return true;
   var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),M=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),Op=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation'),UUID=Java.loadClass('java.util.UUID');
   var ratio=Math.max(0,Math.min(1,Number(e.health)/Number(e.maxHealth))),nativeAttrs=[e.getAttribute(A.MAX_HEALTH),e.getAttribute(A.ATTACK_DAMAGE)];
   for(var j=0;j<2;j++)if(!nativeAttrs[j])throw new Error('Gatekeeper native attribute missing');
   for(var i=0;i<2;i++){var key=UUID.fromString(ids[i]);nativeAttrs[i].removeModifier(key);nativeAttrs[i].addPermanentModifier(new M(key,'fcraft_v99_gatekeeper',amounts[i],Op.MULTIPLY_TOTAL));}
   e.health=Number(e.maxHealth)*ratio;data.putBoolean('fcraft_gate_scale_v96',true);data.putInt('fcraft_gate_scale_version_v99',1);return true;
 };
 F.summonWroughtBossAtAltarV8=function(p,context){var r=oldSummon(p,context);if(r&&r.ok)p.server.scheduleInTicks(1,function(){var c=F.getBossAltarCoordsV8(p.server),AABB=Java.loadClass('net.minecraft.world.phys.AABB'),list=p.server.overworld().getEntitiesWithin(new AABB(c.x-20,c.y-10,c.z-20,c.x+20,c.y+20,c.z+20));for(var i=0;i<list.size();i++)F.applyGatekeeperScaleV96(list.get(i));});return r;};
 F.distributeBossPartyClearV96=function(killer,bossUuid,gameDay,candidates){
   var server=killer.server,c=F.getBossAltarCoordsV8(server),shared=[];
   var boss=server.overworld().getEntity(Java.loadClass('java.util.UUID').fromString(String(bossUuid)));
   if(!boss||String(boss.type)!=='mowziesmobs:ferrous_wroughtnaut'||!F.hasEntityTag(boss,'f_rank_altar_boss'))return shared;
   var bx=Number(boss.x)-c.x,by=Number(boss.y)-c.y,bz=Number(boss.z)-c.z;if(bx*bx+by*by+bz*bz>1296)return shared;
   for(var i=0;i<candidates.size();i++){var p=candidates.get(i),dx=Number(p.x)-c.x,dy=Number(p.y)-c.y,dz=Number(p.z)-c.z;if(String(p.level.dimension)!=='minecraft:overworld'||!p.isAlive()||p.isSpectator()||dx*dx+dy*dy+dz*dz>1296)continue;
     var awarded=F.runAtomicPlayerV96(p,function(){var s=F.loadPlayerState(p);s.boss_party_receipts_v96=s.boss_party_receipts_v96||{};if(s.boss_party_receipts_v96[String(bossUuid)])return{ok:true,already:true};var q=F.ensurePlayerBossStateV8(s).quests.ferrous_wroughtnaut;
       if(String(p.uuid)!==String(killer.uuid)){q.clear_count=Number(q.clear_count||0)+1;if(!q.first_cleared){q.first_cleared=true;q.first_clear_day=gameDay===undefined?F.getCurrentGameDayV8(server):Number(gameDay);q.codex_unlocked=true;q.free_rematch_unlocked=true;}}
       s.boss_party_receipts_v96[String(bossUuid)]=true;F.savePlayerState(p,s);var unlocked=F.unlockMainlandSailingV96(p,'boss');if(!unlocked.ok)return unlocked;F.syncFtbQuestStagesForPlayer(p);return{ok:true};
     });if(awarded.ok)shared.push(String(p.uuid));
   }return shared;
 };
 F.handleBossDefeatedV8=function(killer,type,uuid,gameDay){
   if(F.handleLegacyBossDeathV99)return F.handleLegacyBossDeathV99(killer,type,uuid);
   if(!killer||String(type)!=='mowziesmobs:ferrous_wroughtnaut')return oldBoss(killer,type,uuid,gameDay);
   var server=killer.server,key=String(uuid||'');if(!key)return{ok:false,reason:'boss_uuid_required'};
   var text=String(server.persistentData.getString('fcraft_boss_death_receipts_v96')||'[]'),receipts=JSON.parse(text);if(receipts.indexOf(key)>=0)return{ok:false,reason:'duplicate_boss_death'};
   var result=oldBoss(killer,type,uuid,gameDay);if(!result||!result.ok)return result;
   receipts.push(key);server.persistentData.putString('fcraft_boss_death_receipts_v96',JSON.stringify(receipts.slice(-512)));
   result.shared_party_uuids=F.distributeBossPartyClearV96(killer,key,gameDay,server.players);return result;
 };
 F.syncFtbQuestStagesForPlayer=function(p){var r=oldSync(p),s=F.loadPlayerState(p),npcs=F.ACTIVE_NPCS;for(var i=0;i<npcs.length;i++){var id=npcs[i],rel=s.relationships[id];if(!rel)continue;var prefix='frank_v96_bond_'+id+'_';if(rel.flags.first_met)F.grantPlayerStageOnce(p,prefix+'met');if(rel.affinity>=20)F.grantPlayerStageOnce(p,prefix+'20');if(rel.affinity>=45)F.grantPlayerStageOnce(p,prefix+'45');if(rel.flags.incident_resolved)F.grantPlayerStageOnce(p,prefix+'story');if(rel.flags.relationship_branch_selected&&(rel.relation_type==='friend'||rel.relation_type==='romantic_partner'))F.grantPlayerStageOnce(p,prefix+'choice');}return r;};
 var aff=F.addNpcAffinity,branch=F.selectRelationshipBranch;
 F.addNpcAffinity=function(p,n,delta){var r=aff(p,n,delta);if(r&&r.ok)F.syncFtbQuestStagesForPlayer(p);return r;};
 F.selectRelationshipBranch=function(p,n,t){var r=branch(p,n,t);if(r&&r.ok)F.syncFtbQuestStagesForPlayer(p);return r;};
})(global.FRankDays);
