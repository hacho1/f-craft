// Verified v9.7 geometry only. Lootr owns contents; this file never resets, fills or replaces a container.
global.FRankDays=global.FRankDays||{};
(function(F){
  var seenLayout=null,index=null,clock=0,resonance={},warned={};
  function warn(k,e){if(!warned[k]){warned[k]=true;console.warn('[F-Craft treasure v97] '+k+': '+String(e));}}
  function dim(level){return String(level&&level.dimension||'');}
  function integer(n){return typeof n==='number'&&isFinite(n)&&n===Math.floor(n);}
  function finite(n){return typeof n==='number'&&isFinite(n);}
  function at(c){return c.dimension+'|'+c.x+'|'+c.y+'|'+c.z;}
  function validate(cfg){
    if(!cfg||String(cfg.serdinLayoutVersion)!=='9.7'||!Array.isArray(cfg.treasurePois)||cfg.treasurePois.length!==14)return null;
    var out={pois:cfg.treasurePois,containers:[],byPosition:{},byId:{},scope:String(cfg.worldValidationId||cfg.id||'serdin-v97')},pids={},types={structure:0,secret:0};
    for(var i=0;i<out.pois.length;i++){
      var p=out.pois[i],reps=0;
      if(!p||!p.id||pids[p.id]||!types.hasOwnProperty(p.track)||p.dimension!=='minecraft:overworld'||!finite(p.x)||!finite(p.y)||!finite(p.z)||!Array.isArray(p.containers)||p.protectionRadius!==(p.track==='secret'?3:5))return null;
      pids[p.id]=true;types[p.track]++;
      if(p.track==='secret'&&p.containers.length!==1)return null;
      for(var j=0;j<p.containers.length;j++){
        var c=p.containers[j];
        if(!c||!c.id||out.byId[c.id]||!integer(c.x)||!integer(c.y)||!integer(c.z)||['lootr:lootr_chest','lootr:lootr_barrel'].indexOf(c.blockId)<0||!/^f_rank_days:chests\/serdin_(struct_(entry|deep)|secret_0[1-6])$/.test(String(c.lootTable)))return null;
        var record={id:String(c.id),poi:p,dimension:p.dimension,x:c.x,y:c.y,z:c.z,blockId:c.blockId,lootTable:c.lootTable,representative:c.representative===true,tileUuid:c.tileUuid?String(c.tileUuid):null,legacyCacheId:c.legacyCacheId?String(c.legacyCacheId):null};
        if(out.byPosition[at(record)])return null;
        if(record.representative)reps++;
        out.containers.push(record);out.byId[record.id]=record;out.byPosition[at(record)]=record;
      }
      if(reps!==1)return null;
    }
    return types.structure===8&&types.secret===6&&out.containers.length===24?out:null;
  }
  function layout(server){
    if(typeof F.getSerdinV97Layout!=='function')return null;
    var cfg=F.getSerdinV97Layout(server);if(!cfg)return null;
    if(cfg!==seenLayout){seenLayout=cfg;index=validate(cfg);if(!index)warn('invalid_layout','14 POIs / 24 unique containers required; all original data preserved');}
    return index;
  }
  function book(s,scope){
    var b=s.serdin_treasure_v97;
    if(b&&b.scope!==scope)return null; // Preserve another world's ledger; never import it.
    if(!b)b=s.serdin_treasure_v97={version:1,scope:scope,opened:{},pois:{},bonuses:{}};
    b.opened=b.opened||{};b.pois=b.pois||{};b.bonuses=b.bonuses||{};return b;
  }
  function counts(b,l){var opened=0,pois=0;for(var k in b.opened)if(l.byId[k])opened++;for(var i=0;i<l.pois.length;i++)if(b.pois[l.pois[i].id])pois++;return{chests:Math.min(24,opened),pois:Math.min(14,pois)};}
  function snapshot(p,l){var s=F.loadPlayerState(p),b=s.serdin_treasure_v97;return b&&b.scope===l.scope?counts(b,l):{chests:0,pois:0};}
  function sync(p,l){
    var c=snapshot(p,l);p.persistentData.putInt('f_craft_serdin_pois_found',c.pois);p.persistentData.putInt('f_craft_serdin_chests_opened',c.chests);
    // Existing v9.6 quest IDs/stages and earned progress survive. New counter requires actual opened menus.
    var s=F.loadPlayerState(p),old=Math.max(Number(s.serdin_caches_found||0),c.chests);
    if(old!==Number(s.serdin_caches_found||0)){s.serdin_caches_found=old;F.savePlayerState(p,s);}
    for(var i=0;i<3;i++){var n=[5,12,24][i];if(old>=n)F.grantPlayerStageOnce(p,'frank_v96_caches_'+n);}
    if(c.pois>=14)F.grantPlayerStageOnce(p,'frank_v97_serdin_pois_14');
    if(c.chests>=24)F.grantPlayerStageOnce(p,'frank_v97_serdin_chests_24');
    return c;
  }
  function commit(p,c,tile){
    var l=layout(p.server);if(!l||!c||l.byId[c.id]!==c)return{ok:false,reason:'unverified_layout'};
    var r=F.runAtomicPlayerV96(p,function(){
      var s=F.loadPlayerState(p),b=book(s,l.scope);if(!b)return{ok:false,reason:'different_world_ledger_preserved'};
      if(b.opened[c.id])return{ok:true,already:true};
      var legacy=Boolean(c.legacyCacheId&&s.serdin_cache_ids_v96&&s.serdin_cache_ids_v96[c.legacyCacheId]);
      b.opened[c.id]={tileUuid:tile,poi:c.poi.id};if(c.representative)b.pois[c.poi.id]=true;
      // Legacy click rewards might have paid the old25% roll; do not pay the same mapped chest twice.
      var bonus=!legacy&&s.special_ability.ability_id==='hoarder_greed'&&Number(p.random.nextFloat())<0.25?2+Number(p.random.nextInt(4)):0;
      b.bonuses[c.id]=bonus;F.savePlayerState(p,s);
      if(bonus){var granted=F.grantPlayerCurrencyV8(p,bonus,false);if(!granted||!granted.ok)throw new Error('treasure wallet credit failed');}
      // Do NOT call onTraitDiscoveryV96: it rolls the old hoarder reward a second time.
      if(!legacy&&F.recordJobActivityV96)F.recordJobActivityV96(p,'discoveries',1);
      return{ok:true,bonus:bonus,newPoi:c.representative};
    });
    if(r&&r.ok){var n=sync(p,l);if(!r.already)p.tell('세르딘 탐험 · 거점 '+n.pois+'/14 · 상자 '+n.chests+'/24'+(r.bonus?' · 동화 +'+r.bonus:''));}
    return r;
  }
  F.isSerdinTreasureV97World=function(server){return Boolean(layout(server));};
  F.getSerdinTreasureIndexV97=layout;
  F.validateSerdinTreasureLayoutV97=validate;
  F.getSerdinTreasureCountsV97=function(p){var l=layout(p.server);return l?snapshot(p,l):null;};
  F.isProtectedSerdinTreasurePositionV97=function(server,where,padding){
    var l=layout(server);if(!l||!where||where.dimension!=='minecraft:overworld')return false;
    padding=Math.max(0,Number(padding||0));
    for(var i=0;i<l.pois.length;i++){var p=l.pois[i],r=p.protectionRadius+padding,dx=where.x-p.x,dz=where.z-p.z;if(Math.abs(where.y-p.y)<=12+padding&&dx*dx+dz*dz<=r*r)return true;}
    return false;
  };
  // The event is posted AFTER ServerPlayer opened a ChestMenu, not on a canceled right-click.
  F.onSerdinTreasureMenuOpenedV97=function(e){
    var p=e.player,l=layout(p.server);if(!l||dim(p.level)!=='minecraft:overworld')return{ok:false,reason:'outside_scope'};
    var inv=e.inventory,Special=Java.loadClass('noobanidus.mods.lootr.data.SpecialChestInventory');
    if(!(inv instanceof Special))return{ok:false,reason:'not_lootr_personal_menu'};
    var pos=inv.getPos();if(!pos)return{ok:false,reason:'not_a_block_container'};
    var c=l.byPosition[at({dimension:dim(p.level),x:Number(pos.x),y:Number(pos.y),z:Number(pos.z)})];
    if(!c)return{ok:false,reason:'unmanaged_container'};
    var dx=Number(p.x)-c.x,dy=Number(p.y)-c.y,dz=Number(p.z)-c.z;if(dx*dx+dy*dy+dz*dz>100)return{ok:false,reason:'too_far'};
    var block=p.level.getBlock(c.x,c.y,c.z),be=block.getEntity(),tile=String(inv.getTileId());
    if(String(block.id)!==c.blockId||!be||typeof be.getTileId!=='function'||tile!==String(be.getTileId())||(c.tileUuid&&tile!==c.tileUuid)||String(be.getTable())!==c.lootTable)return{ok:false,reason:'container_identity_mismatch'};
    var data=Java.loadClass('noobanidus.mods.lootr.data.DataStorage').getContainerData(p.level,pos,inv.getTileId());
    var own=data&&data.getInventory(Java.loadClass('java.util.UUID').fromString(String(p.uuid)));
    if(!own||!own.equals(inv))return{ok:false,reason:'not_this_players_inventory'};
    return commit(p,c,tile);
  };
  PlayerEvents.chestOpened(function(e){try{F.onSerdinTreasureMenuOpenedV97(e);}catch(err){warn('menu',err);}});
  function protect(e){var p=e.player;if(!p||p.hasPermissions(2))return;var b=e.block;if(F.isProtectedSerdinTreasurePositionV97(e.server,{dimension:dim(e.level),x:Number(b.x),y:Number(b.y),z:Number(b.z)},0))e.cancel();}
  BlockEvents.broken(protect);BlockEvents.placed(protect);
  function eligible(s){var jobs=s.job_licenses||{},grades=['F','E','D','C','B','A','S'];return Boolean(jobs.relic_researcher&&grades.indexOf(jobs.relic_researcher.grade)>=0||jobs.pathfinder&&grades.indexOf(jobs.pathfinder.grade)>=0);}
  F.isSerdinTreasureResonanceEligibleV97=eligible;
  ServerEvents.tick(function(e){
    clock++;if(clock%40!==0)return;var l=layout(e.server);if(!l)return;var ps=e.server.players;
    for(var i=0;i<ps.size();i++){
      var p=ps.get(i);if(dim(p.level)!=='minecraft:overworld')continue;var s=F.loadPlayerState(p);if(!eligible(s))continue;
      var b=s.serdin_treasure_v97,nearest=null,dist=324;
      for(var j=0;j<l.containers.length;j++){var c=l.containers[j];if(b&&b.scope===l.scope&&b.opened[c.id])continue;var dx=Number(p.x)-c.x,dy=Number(p.y)-c.y,dz=Number(p.z)-c.z,d=dx*dx+dy*dy+dz*dz;if(d<=dist){nearest=c;dist=d;}}
      var key=String(p.uuid),prev=resonance[key];if(!nearest||prev&&clock-prev.tick<200)continue;
      if(!/^[A-Za-z0-9_]{1,16}$/.test(String(p.username)))continue;
      p.server.runCommandSilent('playsound minecraft:block.amethyst_block.chime master '+p.username+' '+Number(p.x)+' '+Number(p.y)+' '+Number(p.z)+' 0.35 1.4');resonance[key]={tick:clock,id:nearest.id};
    }
  });
  PlayerEvents.loggedIn(function(e){var l=layout(e.server);if(l)sync(e.player,l);});
  PlayerEvents.loggedOut(function(e){delete resonance[String(e.player.uuid)];});
})(global.FRankDays);
