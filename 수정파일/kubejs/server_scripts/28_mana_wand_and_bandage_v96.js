// Lightweight server rays and timed first aid; no client-target authority or NPC damage.
global.FRankDays=global.FRankDays||{};
(function(F){
 function isPlayer(p){return p&&p.isPlayer&&p.isPlayer();}
 function alive(p){return p&&p.isAlive()&&!p.isRemoved();}
 function now(p){return Number(p.level.getTime());}
 function npc(e){if(!e)return true;var type=String(e.type);if(type.indexOf('customnpcs:')===0||type==='minecraft:villager'||type==='minecraft:wandering_trader')return true;var ids=F.ACTIVE_NPCS||[];for(var i=0;i<ids.length;i++)if(F.hasEntityTag(e,'npc_'+ids[i]))return true;return false;}
 function safe(p){if(String(p.level.dimension)!=='minecraft:overworld')return false;var cfg=F.FCRAFT_CONFIG,core=F.FCRAFT_REGION_CORE;if(!cfg||!core||!F.isFcraftV9World(p.server))return false;for(var i=0;i<(cfg.regions||[]).length;i++){var r=cfg.regions[i];if((r.safeStart||r.id==='brion')&&core.contains(r,{dimension:String(p.level.dimension),x:Number(p.x),y:Number(p.y),z:Number(p.z)},0))return true;}return false;}
 F.isNpcProtectedFromMagicV96=npc;F.isMagicSafePositionV96=safe;
 function state(p){var s=F.loadPlayerState(p);s.magic_v96=s.magic_v96||{wand_until:0,bandage_until:0,bandage_token:null};return s;}
 F.castManaWandV96=function(p){return F.castRuneStaffV98?F.castRuneStaffV98(p):{ok:false,reason:'mana_service_unavailable'};};
 F.useHerbBandageV96=function(p){if(!alive(p)||String(p.mainHandItem.id)!=='f_rank_days:herb_bandage')return{ok:false,reason:'wrong_held_item'};var s=state(p),t=now(p);if(t<Number(s.magic_v96.bandage_until)||s.magic_v96.bandage_token)return{ok:false,reason:'cooldown'};
   if(Number(p.health)>=Number(p.maxHealth))return{ok:false,reason:'already_full_health'};
   var token=String(Java.loadClass('java.util.UUID').randomUUID());s.magic_v96.bandage_until=t+160;s.magic_v96.bandage_token=token;F.savePlayerState(p,s);
   p.server.scheduleInTicks(24,function(){var q=state(p);if(q.magic_v96.bandage_token!==token)return;q.magic_v96.bandage_token=null;F.savePlayerState(p,q);if(!alive(p)||String(p.mainHandItem.id)!=='f_rank_days:herb_bandage')return;if(!F.consumePlayerItemExact(p,'f_rank_days:herb_bandage',1))return;var healer=q.job_licenses.healer,heal=4+(healer&&healer.grade!=='UNREGISTERED'?2:0);var pp=F.getPassiveProfilePhase4?F.getPassiveProfilePhase4(p,'healer'):{},before=Number(p.health);heal+=Number(pp.bandageBonusHp||0);p.heal(heal*(pp.selfHealMultiplier===undefined?1:pp.selfHealMultiplier));var actual=Math.max(0,Number(p.health)-before);p.potionEffects.add('minecraft:regeneration',100,0,false,false);if(F.recordJobActivityV96)F.recordJobActivityV96(p,'care_actions',1);if(F.recordPracticalActionPhase4){F.recordPracticalActionPhase4(p,{type:'bandage_use',actorUuid:String(p.uuid),actionId:token+':use',job:'healer',targetUuid:String(p.uuid),amount:1,healedAmount:actual,itemId:'f_rank_days:herb_bandage'});if(actual>0)F.recordPracticalActionPhase4(p,{type:'heal',actorUuid:String(p.uuid),actionId:token+':heal',job:'healer',targetUuid:String(p.uuid),amount:actual,itemId:'f_rank_days:herb_bandage'});}if(actual>0&&F.onPassiveBandagePhase4)F.onPassiveBandagePhase4(p,p,actual);});return{ok:true,cast_ticks:24,cooldown_ticks:160};
 };
 ItemEvents.rightClicked(function(e){if(!e.player)return;var id=String(e.item.id),r;if(id==='f_rank_days:apprentice_mana_wand'||id==='f_rank_days:ancient_rune_staff')r=F.castManaWandV96(e.player);else if(id==='f_rank_days:herb_bandage')r=F.useHerbBandageV96(e.player);if(r&&!r.ok&&r.message)e.player.tell(r.message);});
 PlayerEvents.loggedIn(function(e){var s=state(e.player);s.magic_v96.bandage_token=null;F.savePlayerState(e.player,s);});
})(global.FRankDays);
