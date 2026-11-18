// F-Craft 9.4 native adapter. No building, replacement, global loot resets or unverified world fallback.
global.FRankDays=global.FRankDays||{};
(function(F){
  var C=F.OUTPOST_CORE_V94;if(!C)throw new Error('F-Craft outpost state engine must load before script 21');
  var SAVE='fcraft_outposts_v94',BINDINGS='fcraft_outpost_bindings_v94',transient={server:null,menus:{},lastTick:0},reported={};
  function warn(key,error){if(reported[key])return;reported[key]=true;console.warn('[F-Craft 전초기지] '+key+': '+String(error));}
  function baseLayout(server){
    if(!server||typeof F.getSerdinV94Layout!=='function')return null;
    try{var base=F.getSerdinV94Layout(server)||null;if(!base)return null;
      var newer=typeof F.getSerdinV97Layout==='function'?F.getSerdinV97Layout(server):null;
      if(newer&&String(newer.serdinLayoutVersion||newer.layoutVersion)==='9.7'){
        // Do not clone the continent's trail/treasure metadata four times per second for an arena tick.
        base={id:base.id,worldValidationId:base.worldValidationId,layoutVersion:base.layoutVersion,serdinLayoutVersion:'9.7',outpostPolicy:C.clone(base.outpostPolicy||{}),outposts:C.clone(newer.outposts||[])};
        for(var i=0;i<base.outposts.length;i++){var s=base.outposts[i];if(s.center){s.x=Number(s.center.x);s.y=Number(s.center.y);s.z=Number(s.center.z);}s.dimension=s.dimension||'minecraft:overworld';s.bindingVersion=97;}
      }return base;
    }catch(e){warn('layout',e);return null;}
  }
  function bindingData(server,base){
    var text=String(server.persistentData.getString(BINDINGS)||'');
    if(!text)return{schemaVersion:1,scope:String(base.id||base.worldValidationId),layoutVersion:String(base.layoutVersion),sites:{}};
    var d=JSON.parse(text);
    if(d.schemaVersion!==1||d.scope!==String(base.id||base.worldValidationId)||d.layoutVersion!==String(base.layoutVersion)||!d.sites)throw new Error('Outpost binding identity mismatch; preserved');
    return d;
  }
  function validBinding(site,chest){
    return Boolean(chest&&['lootr:lootr_chest','lootr:lootr_barrel','minecraft:chest','minecraft:barrel'].indexOf(chest.blockId)>=0&&
      isFinite(chest.x)&&isFinite(chest.y)&&isFinite(chest.z)&&Math.floor(chest.x)===chest.x&&Math.floor(chest.y)===chest.y&&Math.floor(chest.z)===chest.z&&
      Math.abs(chest.y-site.y)<=18&&Math.pow(chest.x-site.x,2)+Math.pow(chest.z-site.z,2)<=324);
  }
  function layout(server){
    var base=baseLayout(server);if(!base)return null;
    try{var d=bindingData(server,base),l=C.clone(base);for(var i=0;i<l.outposts.length;i++){var s=l.outposts[i],b=d.sites[s.id];if(!b||(C.isModern(l)&&Number(b.version)<97))continue;if(!validBinding(s,b.chest))throw new Error('Invalid saved chest binding');s.chest=C.clone(b.chest);s.bindingVersion=Number(b.version);s.containerPrepared=true;}return l;}
    catch(e){warn('saved bindings',e);return base;}
  }
  function sameServer(a,b){return a===b||Boolean(a&&b&&typeof a.equals==='function'&&a.equals(b));}
  function session(server){if(!sameServer(transient.server,server))transient={server:server,menus:{},lastTick:0};return transient;}
  function collection(list,fn){if(!list)return;var n=typeof list.size==='function'?Number(list.size()):Number(list.length||0);for(var i=0;i<n;i++)fn(typeof list.get==='function'?list.get(i):list[i],i);}
  function uuid(text){return Java.loadClass('java.util.UUID').fromString(String(text));}
  function pos(x,y,z){return new (Java.loadClass('net.minecraft.core.BlockPos'))(Math.floor(x),Math.floor(y),Math.floor(z));}
  function dimension(level){return String(level&&level.dimension||'');}
  function overworld(server,site){return site.dimension==='minecraft:overworld'&&server.overworld?server.overworld():null;}
  function chunkReady(level,p){try{return Boolean(level&&level.hasChunkAt(pos(p.x,p.y,p.z)));}catch(e){return false;}}
  function idAt(level,p){return String(level.getBlock(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z)).id);}
  function rawPlayer(p){return p.minecraftPlayer||p;}
  function dataPlayer(p){return{uuid:String(p.uuid),x:Number(p.x),y:Number(p.y),z:Number(p.z),dimension:dimension(p.level),raw:p};}
  function entity(level,id){try{return level.getEntity(uuid(id));}catch(e){return null;}}
  function siteTag(id){return'fc94_site_'+id;}
  function generationTag(generation){return'fc94_gen_'+generation;}
  function waveTag(wave){return'fc94_wave_'+wave;}
  function tagHas(e,t){return F.hasEntityTag?F.hasEntityTag(e,t):Boolean(e&&e.tags&&e.tags.contains&&e.tags.contains(t));}
  function owned(e,site,m){return Boolean(e&&tagHas(e,'fcraft_outpost_v94')&&tagHas(e,siteTag(site.id))&&tagHas(e,generationTag(m.generation))&&tagHas(e,waveTag(m.wave)));}
  function uuidNbt(id){var h=String(id).replace(/-/g,''),ints=[];for(var i=0;i<4;i++){var n=parseInt(h.substr(i*8,8),16);ints.push(n>=2147483648?n-4294967296:n);}return'[I;'+ints.join(',')+']';}
  function isEmpty(be){if(!be||typeof be.getContainerSize!=='function'||typeof be.getItem!=='function')return false;for(var i=0;i<be.getContainerSize();i++){var item=be.getItem(i);if(item&&!item.empty&&Number(item.count)>0)return false;}return true;}
  function getBlock(level,site){return level.getBlock(site.chest.x,site.chest.y,site.chest.z);}
  function getBe(block){return block.getEntity?block.getEntity():block.entity;}
  function readState(server){var s=String(server.persistentData.getString(SAVE)||'');return s?JSON.parse(s):null;}
  function writeState(server,state){server.persistentData.putString(SAVE,JSON.stringify(state));}
  function tell(p,text){if(p&&p.tell)p.tell(text);}
  function nearby(server,site,message){collection(server.players,function(p){if(dimension(p.level)!==site.dimension)return;var dx=Number(p.x)-site.x,dz=Number(p.z)-site.z;if(dx*dx+dz*dz<=1024)tell(p,message);});}
  function prepareContainer(server,site,bound){
    var level=overworld(server,site);if(!chunkReady(level,site.chest))return{ok:false,reason:'chunks_unavailable'};
    var block=getBlock(level,site);if(String(block.id)!==site.chest.blockId)return{ok:false,reason:'container_block_changed'};
    var be=getBe(block);if(!be)return{ok:false,reason:'missing_container_entity'};
    var lootr=String(block.id).indexOf('lootr:')===0,nbt=lootr?null:block.getEntityData();
    // A vanilla getItem can unpack and remove a pre-existing LootTable. Inspect NBT first.
    if(nbt&&nbt.contains&&nbt.contains('LootTable'))return{ok:false,reason:'vanilla_loot_table_preserved'};
    // Never consume pre-existing items or replace an existing block.
    if(!isEmpty(be))return{ok:false,reason:'nonempty_container_preserved'};
    if(lootr){
      if(!Platform.isLoaded('lootr')||!be.getTileId||!be.getTable||!be.getOpeners)return{ok:false,reason:'lootr_api_unavailable'};
      var table=String(be.getTable()||''),expected=site.chest.lootTable||site.lootTable||C.specs[site.id].lootTable;
      if(table!==expected)return{ok:false,reason:'lootr_table_mismatch'};
      var tile=String(be.getTileId());
      if(bound&&bound.tileUuid!==tile)return{ok:false,reason:'lootr_tile_identity_changed'};
      if(be.setChanged)be.setChanged();
      return{ok:true,binding:{mode:'LOOTR',tileUuid:tile,table:table}};
    }
    var lock=nbt&&nbt.getString?String(nbt.getString('Lock')||''):'';
    if(bound&&lock!==bound.lock)return{ok:false,reason:'vanilla_container_identity_changed'};
    if(!bound){
      if(lock)return{ok:false,reason:'foreign_container_lock_preserved'};
      lock='fcraft94:'+site.id+':'+String(Java.loadClass('java.util.UUID').randomUUID());
      block.mergeEntityData(NBT.compoundTag({Lock:lock}));
      if(String(block.getEntityData().getString('Lock'))!==lock)return{ok:false,reason:'container_lock_not_persisted'};
    }
    return{ok:true,binding:{mode:'VANILLA_DIRECT',lock:lock,table:site.chest.lootTable||site.lootTable||C.specs[site.id].lootTable}};
  }
  var FLOOR={'minecraft:grass_block':true,'minecraft:dirt':true,'minecraft:coarse_dirt':true,'minecraft:rooted_dirt':true,'minecraft:podzol':true,'minecraft:stone':true,'minecraft:andesite':true,'minecraft:diorite':true,'minecraft:granite':true,'minecraft:cobblestone':true,'minecraft:mossy_cobblestone':true,'minecraft:stone_bricks':true,'minecraft:mossy_stone_bricks':true,'minecraft:cracked_stone_bricks':true,'minecraft:chiseled_stone_bricks':true,'minecraft:deepslate':true,'minecraft:cobbled_deepslate':true,'minecraft:deepslate_bricks':true,'minecraft:deepslate_tiles':true,'minecraft:gravel':true,'minecraft:sand':true,'minecraft:packed_mud':true,'minecraft:mud_bricks':true};
  var HEAD={'minecraft:air':true,'minecraft:cave_air':true,'minecraft:void_air':true,'minecraft:grass':true,'minecraft:tall_grass':true,'minecraft:fern':true,'minecraft:large_fern':true,'minecraft:dandelion':true,'minecraft:poppy':true};
  function ready(server,site){
    var level=overworld(server,site);if(!level||!chunkReady(level,site.chest))return{ok:false,reason:'chunks_unavailable'};
    for(var i=0;i<site.spawnPoints.length;i++){
      var p=site.spawnPoints[i];if(!chunkReady(level,p))return{ok:false,reason:'chunks_unavailable'};
      if(!FLOOR[idAt(level,{x:p.x,y:p.y-1,z:p.z})]||!HEAD[idAt(level,p)]||!HEAD[idAt(level,{x:p.x,y:p.y+1,z:p.z})])return{ok:false,reason:'surveyed_spawn_obstructed'};
    }
    return{ok:true};
  }
  function closeMenus(server,site){
    var menus=session(server).menus,keyPrefix=site.id+'|';
    eachMenu(menus,function(record,key){if(key.indexOf(keyPrefix)!==0)return;var p=server.getPlayer?server.getPlayer(record.player):null;
      if(p&&p.containerMenu===record.menu&&typeof p.closeContainer==='function')p.closeContainer();delete menus[key];});
  }
  function eachMenu(o,fn){for(var k in o)fn(o[k],k);}
  function rewardPlan(server,site,spec,actor,generation){
    var l=layout(server);if(!C.isModern(l))return{ok:true,kind:'LEGACY'};
    var state=F.loadPlayerState(actor.raw),key=String(l.id||l.worldValidationId)+'|'+site.id;
    var receipt=state.outpost_receipts_v94&&state.outpost_receipts_v94[key];
    if(receipt&&receipt.status==='ISSUING')return{ok:false,reason:'reward_review_pending'};
    var first=state.outpost_first_clears_v97&&state.outpost_first_clears_v97[key],old=readState(server),legacy=old&&old.legacyFirstClearsV97&&old.legacyFirstClearsV97[site.id];
    var old87=String(server.persistentData.getString('f_craft_outpost_first_clears_v87')||'');
    if(old87){var map=JSON.parse(old87);if(map[site.id]&&map[site.id][String(actor.uuid)])first=true;}
    var prior=old&&old.sites&&old.sites[site.id],claimed=prior&&prior.claimed&&Number(prior.claimed[String(actor.uuid)]||0)>0;
    return{ok:true,kind:first||(receipt&&receipt.status==='DONE')||(legacy&&legacy[String(actor.uuid)])||claimed?'REPEAT':'FIRST'};
  }
  function reward(server,site,spec,actor,generation,rewardKind){
    var p=actor.raw,state=F.loadPlayerState(p),scope=String(layout(server).id||layout(server).worldValidationId);
    state.outpost_receipts_v94=state.outpost_receipts_v94||{};
    var key=scope+'|'+site.id,receipt=state.outpost_receipts_v94[key];
    if(receipt&&receipt.status==='ISSUING')return{ok:false,reason:'reward_review_pending'};
    if(receipt&&receipt.generation>=generation)return{ok:true,granted:false};
    var selected=rewardKind==='FIRST'?spec.firstClearReward:rewardKind==='REPEAT'?spec.repeatClearReward:spec;
    if(!selected)return{ok:false,reason:'reward_kind_invalid'};
    // The engine already verified the bound identity; this transaction never rebinds the container.
    var mode=site.chest.blockId.indexOf('lootr:')===0?'LOOTR':'VANILLA_DIRECT';
    var eco=F.ensurePlayerEconomyStateV8(state);
    receipt={generation:generation,status:'ISSUING',startedAt:Date.now(),copper:selected.copper,items:C.clone(selected.items),rewardKind:rewardKind||'LEGACY',lootMode:mode,lootTable:site.chest.lootTable||site.lootTable||spec.lootTable};
    state.outpost_receipts_v94[key]=receipt;eco.wallet_copper+=selected.copper;
    if(rewardKind==='FIRST'){state.outpost_first_clears_v97=state.outpost_first_clears_v97||{};state.outpost_first_clears_v97[key]={generation:generation,at:Date.now()};}
    // Wallet and issuance receipt share the existing canonical player-state save.
    F.savePlayerState(p,state);
    try{
      for(var i=0;i<selected.items.length;i++)p.give(Item.of(selected.items[i].id,selected.items[i].count));
      if(mode==='VANILLA_DIRECT'&&rewardKind!=='FIRST'){
        var count=server.runCommandSilent('execute as '+String(p.uuid)+' at @s run loot give @s loot '+receipt.lootTable);
        if(Number(count)<=0)throw new Error('Direct loot command produced no confirmed items');
      }
      state=F.loadPlayerState(p);state.outpost_receipts_v94[key].status='DONE';state.outpost_receipts_v94[key].completedAt=Date.now();F.savePlayerState(p,state);
      tell(p,'[전초기지 '+(rewardKind==='FIRST'?'첫 토벌':'토벌')+' 보상] '+F.formatCurrencyV8(selected.copper)+'와 보급품을 받았습니다.'+(rewardKind==='FIRST'?' 첫 토벌 보급은 직접 지급됩니다. 다음 토벌부터 상자 전리품을 받을 수 있습니다.':mode==='VANILLA_DIRECT'?' 전리품도 소지품으로 지급했습니다.':''));
      return{ok:true,granted:true};
    }catch(error){warn('reward '+site.id,error);return{ok:false,reason:'reward_review_pending'};}
  }
  function ports(server){return{
    now:function(){return F._outpostClockV94?Number(F._outpostClockV94(server)):Date.now();},
    read:function(){return readState(server);},write:function(d){writeState(server,d);},
    uuid:function(){return String(Java.loadClass('java.util.UUID').randomUUID());},
    ready:function(s){return ready(server,s);},inspectContainer:function(s,b){return prepareContainer(server,s,b);},
    players:function(){return F.getArenaPlayersV97(server);},
    ring:function(site,center,radius){F.renderArenaBoundaryRingV86(server,center,radius,'SOUL_FIRE_FLAME');},
    rewardPlan:function(site,spec,actor,generation){return rewardPlan(server,site,spec,actor,generation);},
    spawn:function(site,r){
      var level=overworld(server,site);if(!chunkReady(level,r.point))return{ok:false,reason:'chunks_unavailable'};
      var tags=['fcraft_outpost_v94',siteTag(site.id),generationTag(r.generation),waveTag(r.wave)];
      var nbt='{'+(r.nbt?r.nbt+',':'')+'UUID:'+uuidNbt(r.uuid)+',PersistenceRequired:1b,Tags:'+JSON.stringify(tags)+'}';
      var result=server.runCommandSilent('execute in '+site.dimension+' run summon '+r.type+' '+r.point.x+' '+r.point.y+' '+r.point.z+' '+nbt);
      var e=entity(level,r.uuid);return{ok:Number(result)>0&&owned(e,site,r),reason:'summon_unconfirmed'};
    },
    observe:function(site,m){
      var level=overworld(server,site),e=entity(level,m.uuid);
      if(e){if(!owned(e,site,m))return{status:'FOREIGN'};if(e.isAlive&&!e.isAlive()&&e.getHealth&&Number(e.getHealth())<=0)return{status:'DEAD'};return{status:'ALIVE',position:{x:Number(e.x),y:Number(e.y),z:Number(e.z)}};}
      return{status:chunkReady(level,m.lastPosition||m.point)?'MISSING':'UNLOADED'};
    },
    cleanup:function(site,m){
      var level=overworld(server,site),e=entity(level,m.uuid);
      if(!e)return{ok:chunkReady(level,m.lastPosition||m.point),reason:'unloaded_cleanup'};
      if(!owned(e,site,m))return{ok:false,reason:'foreign_entity_preserved'};
      try{e.discard();return{ok:!entity(level,m.uuid)};}catch(error){warn('cleanup',error);return{ok:false,reason:'cleanup_failed'};}
    },
    leash:function(site,m,action){var target=entity(overworld(server,site),m.uuid);if(!target||!owned(target,site,m))return;F.applyArenaActionV97(server,target,{dimension:site.dimension,x:site.x,y:site.y,z:site.z},action||{action:'hard_snapback',point:m.point});},
    prepareLoot:function(site,binding,actor,generation){
      if(binding.mode==='VANILLA_DIRECT')return{ok:true};
      var level=overworld(server,site),block=getBlock(level,site),be=getBe(block);
      if(!be||String(be.getTileId())!==binding.tileUuid)return{ok:false,reason:'lootr_tile_identity_changed'};
      var storage=Java.loadClass('noobanidus.mods.lootr.data.DataStorage');
      var data=storage.getContainerData(level,block.getPos(),uuid(binding.tileUuid)),playerId=uuid(actor.uuid);
      // This clears one player in ONE container. Never call clearInventories(UUID)/clearPlayerLoot.
      data.clearInventory(playerId);
      if(data.getInventory(playerId)!==null)return{ok:false,reason:'lootr_per_container_reset_failed'};
      be.getOpeners().remove(playerId);be.setChanged();be.updatePacketViaState();return{ok:true};
    },
    reward:function(site,spec,actor,generation,kind){return reward(server,site,spec,actor,generation,kind);},
    watchMenu:function(site,actor,generation){
      server.scheduleInTicks(1,function(){var p=actor.raw;if(!p||!p.containerMenu||p.containerMenu===p.inventoryMenu)return;session(server).menus[site.id+'|'+actor.uuid]={player:actor.uuid,menu:p.containerMenu,generation:generation};});
    },
    closeMenus:function(site){closeMenus(server,site);},
    notify:function(site,kind,a,b){var text=kind==='wave'?'제'+a+'웨이브 · 수비대 '+b+'기':kind==='unlocked'?'봉인이 풀렸습니다. 3분 안에 전리품을 확인하세요.':kind==='empty_warning'?'전투 가능한 도전자가 없습니다. 10초 뒤 수비대가 재정비됩니다.':'다음 수비대가 접근합니다.';nearby(server,site,'['+C.specs[site.id].name+'] '+text);}
  };}
  function engine(server){var l=layout(server);if(!l||!l.outposts||!l.outposts.length)return null;session(server);try{return new C.Engine(l,ports(server));}catch(error){warn('configuration',error);return null;}}
  function rawSites(server){var l=layout(server);return l&&l.outposts||[];}
  function sameChest(c,where){return Boolean(c&&c.x===where.x&&c.y===where.y&&c.z===where.z);}
  function match(server,where){
    var sites=rawSites(server);for(var i=0;i<sites.length;i++)if(sites[i].dimension===where.dimension&&sameChest(sites[i].chest,where))return sites[i];
    // Rebinding never leaves a former owned Lootr container open as an unsealed loot bypass.
    try{var base=baseLayout(server);if(base){var bd=bindingData(server,base);for(var id in bd.sites){var list=bd.sites[id].retiredChests||[];for(var j=0;j<list.length;j++)if(where.dimension==='minecraft:overworld'&&sameChest(list[j],where))return{id:id,retired:true};}}}catch(e){}
    try{var saved=readState(server);if(saved)for(var key in saved.sites){var b=saved.sites[key].binding;if(b&&b.dimension===where.dimension&&sameChest(b.chest,where))return{id:key,retired:true};}}catch(error){}
    return null;
  }
  F.isOutpostAdminV94=function(p){try{if(p.hasPermissions)return Boolean(p.hasPermissions(2));if(p.createCommandSourceStack)return Boolean(p.createCommandSourceStack().hasPermission(2));}catch(e){}return false;};
  F.isProtectedOutpostPositionV94=function(server,where,padding){
    var sites=rawSites(server);for(var i=0;i<sites.length;i++)if(C.protectedAt(sites[i],where,padding))return true;
    try{var saved=readState(server);if(saved)for(var id in saved.sites){var st=saved.sites[id];if((st.phase==='RESETTING'||st.phase==='RECOVERY')&&C.protectedAt(st.binding,where,padding))return true;}}catch(e){}
    return false;
  };
  F.getOutpostEngineV94=engine;
  F.planOutpostRewardV97=rewardPlan;
  F.issueOutpostRewardV97=reward;
  F.getOutpostArenaTargetV97=function(server,target){
    if(!target){target=server;server=target&&(target.server||(target.level&&target.level.server));}
    if(!target||!tagHas(target,'fcraft_outpost_v94'))return null;
    var e=engine(server);if(!e||!e.modern)return null;
    var saved=e.load(),id=String(target.uuid);
    for(var key in e.sites){var st=e.entry(saved,key),member=st.members&&st.members[id];
      if(['WAVE_1','WAVE_2'].indexOf(st.phase)>=0&&member&&member.confirmed&&member.status!=='DEAD'&&owned(target,st.binding,member))return{kind:'outpost',site:key,center:{dimension:st.binding.dimension,x:st.binding.x,y:st.binding.y,z:st.binding.z}};
    }return null;
  };
  F.migrateOutpostLayoutV97=function(server){
    var base=baseLayout(server);if(!base||!C.isModern(base))return{ok:false,reason:'verified_v97_layout_required'};
    var errors=C.validate(base);if(errors.length)return{ok:false,reason:'new_layout_invalid_original_preserved',errors:errors};
    var saved=readState(server),scope=String(base.id||base.worldValidationId);
    if(saved&&(saved.schemaVersion!==1||saved.scope!==scope))return{ok:false,reason:'save_identity_mismatch_preserved'};
    if(saved&&saved.migrationV97&&saved.migrationV97.status==='DONE')return{ok:true,already:true};
    var bd=bindingData(server,base);
    // Original records are journaled before any phase or binding change. No player or private Lootr data is touched.
    var journal={schemaVersion:1,scope:scope,at:Date.now(),previousState:saved?C.clone(saved):null,previousBindings:C.clone(bd)};
    var journalKey='fcraft_outposts_v97_migration_backup';
    if(!String(server.persistentData.getString(journalKey)||''))server.persistentData.putString(journalKey,JSON.stringify(journal));
    if(!saved)saved={schemaVersion:1,scope:scope,sites:{}};
    saved.legacyFirstClearsV97=saved.legacyFirstClearsV97||{};
    var delays={},ids=[];
    for(var i=0;i<base.outposts.length;i++){
      var site=base.outposts[i],prior=saved.sites[site.id];ids.push(site.id);
      delays[site.id]=!prior||(prior.phase==='SEALED'&&Number(prior.generation||0)===0)?0:600000;
      var first=saved.legacyFirstClearsV97[site.id]||{};if(prior)for(var actor in prior.claimed||{})if(Number(prior.claimed[actor])>0)first[actor]=true;saved.legacyFirstClearsV97[site.id]=first;
      var previous=bd.sites[site.id],retired=previous&&previous.retiredChests?C.clone(previous.retiredChests):[];
      if(previous&&previous.chest&&!sameChest(previous.chest,site.chest)&&!retired.some(function(c){return sameChest(c,previous.chest);}))retired.push(C.clone(previous.chest));
      if(prior&&prior.binding&&prior.binding.chest&&!sameChest(prior.binding.chest,site.chest)&&!retired.some(function(c){return sameChest(c,prior.binding.chest);}))retired.push(C.clone(prior.binding.chest));
      // Old overrides remain archived/protected, but do not silently override the newly surveyed v97 binding.
      if(!previous&&retired.length)previous=bd.sites[site.id]={version:1,chest:C.clone(prior.binding.chest)};
      if(previous&&Number(previous.version)<97){previous.retiredChests=retired;previous.supersededByV97=true;}
    }
    server.persistentData.putString(BINDINGS,JSON.stringify(bd));
    saved.migrationV97={status:'RESET_SCHEDULED',at:Date.now(),scope:scope};writeState(server,saved);
    var e=engine(server);if(!e)return{ok:false,reason:'new_layout_invalid_original_journal_preserved'};
    for(var j=0;j<ids.length;j++)e.reset(ids[j],true,delays[ids[j]]);
    saved=readState(server);saved.migrationV97={status:'DONE',at:Date.now(),scope:scope};writeState(server,saved);
    return{ok:true,sites:ids,delays:delays,reason:'owned_cleanup_scheduled_existing_receipts_preserved'};
  };
  F.tickOutpostsV94=function(server){var e=engine(server);if(e)e.tick();};
  F.handleOutpostInteractV94=function(p,where){var site=match(p.server,where);if(!site)return{matched:false};if(site.retired)return{matched:true,ok:false,reason:'retired_container_sealed'};var e=engine(p.server);if(!e)return{matched:true,ok:false,reason:'configuration_unavailable'};var result=e.open(site.id,dataPlayer(p));result.matched=true;return result;};
  F.getOutpostStatusV94=function(server,id){var e=engine(server);return e?e.status(id):{ok:false,reason:'world_not_enabled'};};
  F.bindOutpostChestHereV94=function(p,id){
    if(!F.isOutpostAdminV94(p))return{ok:false,reason:'operator_permission_required'};
    var base=baseLayout(p.server);if(!base||dimension(p.level)!=='minecraft:overworld')return{ok:false,reason:'verified_overworld_required'};
    var sites=rawSites(p.server),site=null;for(var i=0;i<sites.length;i++)if(sites[i].id===id)site=sites[i];
    if(!site)return{ok:false,reason:'unknown_site'};
    var e=engine(p.server),st=e.status(id);if(['SEALED','COOLDOWN'].indexOf(st.phase)<0)return{ok:false,reason:'site_must_be_sealed_or_cooldown'};
    // Installed EntityKJS rayTrace returns the looked-at block, never the block below the player.
    var hit=p.rayTrace(6.5,false);if(!hit||String(hit.type)!=='BLOCK'||!hit.block||Number(hit.distance)>6.5)return{ok:false,reason:'look_at_container_within_reach'};
    var b=hit.block,chest={x:Number(b.x),y:Number(b.y),z:Number(b.z),blockId:String(b.id)};
    if(!validBinding(site,chest))return{ok:false,reason:'container_outside_surveyed_site_or_unsupported'};
    var candidate=C.clone(site);candidate.chest=chest;var be=getBe(b);
    if(chest.blockId.indexOf('lootr:')===0){
      if(!be||!be.getTable)return{ok:false,reason:'missing_lootr_container'};
      chest.lootTable=String(be.getTable()||'');
      if(C.isModern(base)&&chest.lootTable!==C.specs[id].lootTable)return{ok:false,reason:'v97_dedicated_repeat_table_required_preserved'};
      var keys=p.server.getLootData().getKeys(Java.loadClass('net.minecraft.world.level.storage.loot.LootDataType').TABLE);
      if(!chest.lootTable||!keys.contains(new (Java.loadClass('net.minecraft.resources.ResourceLocation'))(chest.lootTable)))return{ok:false,reason:'unknown_loot_table_preserved'};
    }
    var oldBound=sameChest(site.chest,chest)&&st.container&&st.container.mode==='VANILLA_DIRECT'?st.container:null;
    var inspected=prepareContainer(p.server,candidate,oldBound);if(!inspected.ok)return inspected;
    var d=bindingData(p.server,base),old=d.sites[id],retired=old&&old.retiredChests?C.clone(old.retiredChests):[];
    if(!sameChest(site.chest,chest)&&!retired.some(function(c){return sameChest(c,site.chest);}))retired.push(C.clone(site.chest));
    d.sites[id]={version:Math.max(C.isModern(base)?97:0,Number(old&&old.version||1)+1),chest:chest,retiredChests:retired,boundBy:String(p.uuid),boundAt:Date.now(),containerIdentity:C.clone(inspected.binding)};
    p.server.persistentData.putString(BINDINGS,JSON.stringify(d));
    var current=engine(p.server);current.reset(id,true,0);
    return{ok:true,id:id,chest:C.clone(chest),version:d.sites[id].version,reason:'binding_saved_reset_pending'};
  };
  function creditCaveSpider(p,site){
    if(!p||!F.getMidTierSpecV93)return;
    var state=F.loadPlayerState(p),grade=state.job_licenses.swordsman.grade,target=grade==='E'?'D':grade==='D'?'C':'',spec=F.getMidTierSpecV93('swordsman',target);
    var rec=spec&&state.mid_tier_exams_v93&&state.mid_tier_exams_v93['swordsman_'+target];
    if(!rec||rec.status!=='ACCEPTED')return;
    rec.kills['minecraft:spider']=Math.min(spec.kills['minecraft:spider'],Number(rec.kills['minecraft:spider']||0)+1);F.savePlayerState(p,state);
    if(F.midTierPersonalPracticalMissingV93(state,spec).length===0)F.grantPlayerStageOnce(p,spec.personalStage);
    var ctx=F.getMidTierFtbContextV93(p,spec),tasks=ctx.quest.getTasks().iterator();
    while(tasks.hasNext()){var task=tasks.next(),data=NBT.compoundTag({});task.writeData(data);if(String(data.getString('entity'))==='minecraft:spider')ctx.data.addProgress(task,1);}
  }
  EntityEvents.death(function(event){
    var ent=event.entity,server=event.server||(ent&&ent.server);if(!ent||!server||!tagHas(ent,'fcraft_outpost_v94'))return;
    var e=engine(server);if(!e)return;
    var sites=rawSites(server),id=String(ent.uuid);
    for(var i=0;i<sites.length;i++){
      var st=e.status(sites[i].id),m=st.members&&st.members[id];if(!m||!owned(ent,sites[i],m))continue;
      var result=e.death(sites[i].id,id,m.generation,m.wave),src=event.source,p=src&&src.player?src.player:null;
      if(result.ok&&String(ent.type)==='minecraft:cave_spider')creditCaveSpider(p,sites[i]);break;
    }
  });
  ServerEvents.tick(function(event){var s=event.server,t=session(s),now=Date.now();t.ticks=Number(t.ticks||0)+1;
    try{if(t.ticks%5===0){if(!t.migrationAttempted&&C.isModern(baseLayout(s))){var migration=F.migrateOutpostLayoutV97(s);t.migrationAttempted=migration.ok;if(!migration.ok)warn('v97 migration',migration.reason);}var e=engine(s);if(e)e.arenaTick(t.ticks);}if(now>=t.lastTick&&now-t.lastTick<500)return;t.lastTick=now;F.tickOutpostsV94(s);}catch(error){warn('tick',error);}});
  ServerEvents.loaded(function(event){session(event.server);event.server.scheduleInTicks(1,function(){if(C.isModern(baseLayout(event.server))){var r=F.migrateOutpostLayoutV97(event.server);session(event.server).migrationAttempted=r.ok;if(!r.ok)warn('v97 migration',r.reason);}});});
  BlockEvents.rightClicked(function(event){
    var p=event.player,b=event.block;if(!p||!b)return;
    var where={dimension:dimension(p.level),x:Number(b.x),y:Number(b.y),z:Number(b.z)};
    if(event.item&&String(event.item.id)==='minecraft:hopper_minecart'&&!F.isOutpostAdminV94(p)&&F.isProtectedOutpostPositionV94(p.server,where,0)){tell(p,'[전초기지 보호] 이곳에는 호퍼 광산 수레를 놓을 수 없습니다.');event.cancel();}
    if(!match(p.server,where))return;
    var result=null,allow=false;
    try{result=F.handleOutpostInteractV94(p,where);allow=Boolean(result&&result.ok&&result.allowOpen);}catch(error){warn('interaction',error);}
    if(!allow){
      var reason=result&&result.reason||'';
      if(result&&result.ok){if(result.rewardKind==='FIRST'&&!result.bonusGranted)tell(p,'[전초기지] 이번 첫 토벌 보급은 이미 받았습니다. 다음 토벌부터 상자 전리품을 받을 수 있습니다.');}else if(reason==='wave_started'){}else if(reason==='reward_review_pending')tell(p,'[전초기지] 보상 준비 기록이 남아 있습니다. 관리자에게 확인을 요청해 주세요.');
      else if(reason==='challenger_creative')tell(p,'[전초기지] 크리에이티브 모드에서는 토벌을 시작할 수 없습니다. 생존 또는 모험 모드에서 다시 도전하세요.');
      else if(reason==='challenger_spectator')tell(p,'[전초기지] 관전자 모드에서는 토벌을 시작할 수 없습니다. 생존 또는 모험 모드에서 다시 도전하세요.');
      else if(reason==='challenger_dead')tell(p,'[전초기지] 쓰러진 상태에서는 토벌을 시작할 수 없습니다. 부활 후 다시 도전하세요.');
      else if(reason==='challenger_outside_arena')tell(p,'[전초기지] 전초기지 결계 안으로 들어온 뒤 다시 도전하세요.');
      else if(reason==='challenger_offline'||reason==='challenger_unavailable')tell(p,'[전초기지] 참가자 상태를 확인하지 못했습니다. 잠시 뒤 다시 도전하세요.');
      else if(reason.indexOf('sealed_wave')===0)tell(p,'[봉인 상자] 남은 수비대를 먼저 처치하세요.');
      else if(reason.indexOf('sealed_cooldown')===0)tell(p,'[전초기지] 수비대가 재정비 중입니다. 잠시 후 다시 도전하세요.');
      else if(reason&&reason!=='wave_started')tell(p,'[전초기지] 거점 상태를 확인 중입니다. 상자는 안전하게 봉인되어 있습니다.');
      // EventExit must remain outside the try/catch above; failures stay locked.
      event.cancel();
    }
  });
  function protect(event){var p=event.player,b=event.block;if(!p||!b||F.isOutpostAdminV94(p))return;if(F.isProtectedOutpostPositionV94(p.server,{dimension:dimension(p.level),x:Number(b.x),y:Number(b.y),z:Number(b.z)},0)){tell(p,'[전초기지 보호] 전투 거점의 구조물을 변경할 수 없습니다.');event.cancel();}}
  BlockEvents.broken(protect);BlockEvents.placed(protect);
  ServerEvents.commandRegistry(function(event){
    var cmd=event.commands;
    function tree(name){var root=cmd.literal(name).requires(function(src){return src.hasPermission(2);});
      root.then(cmd.literal('status').executes(function(ctx){var e=engine(ctx.source.server);if(!e){ctx.source.sendSuccess('이 월드에는 검증된 전초기지 설정이 없습니다.',false);return 0;}var ids=Object.keys(e.sites);for(var i=0;i<ids.length;i++){var st=e.status(ids[i]);ctx.source.sendSuccess(ids[i]+' · '+st.phase+' · 회차 '+st.generation+' · '+(st.lastError||'정상'),false);}return 1;}));
      var reset=cmd.literal('reset');var ids=Object.keys(C.specs);
      for(var i=0;i<ids.length;i++)(function(id){reset.then(cmd.literal(id).executes(function(ctx){var e=engine(ctx.source.server);if(!e)return 0;var r=e.reset(id,true,0);ctx.source.sendSuccess('전초기지 초기화를 예약했습니다. 소유 몹 정리 뒤 다시 봉인됩니다.',true);return r.ok?1:0;}));})(ids[i]);
      root.then(reset);
      var bind=cmd.literal('bind_chest_here');
      for(var b=0;b<ids.length;b++)(function(id){bind.then(cmd.literal(id).executes(function(ctx){var p=ctx.source.player;if(!p)return 0;var result=F.bindOutpostChestHereV94(p,id);ctx.source.sendSuccess(result.ok?'바라본 기존 상자를 보존하여 연결했습니다. 정리 후 다시 봉인됩니다.':'상자를 변경하지 않았습니다: '+result.reason,false);return result.ok?1:0;}));})(ids[b]);
      return root.then(bind);
    }
    event.register(cmd.literal('frank').then(tree('outpost')));event.register(tree('frank_outpost'));
  });
})(global.FRankDays);
