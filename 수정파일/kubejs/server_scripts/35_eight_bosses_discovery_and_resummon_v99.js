// F-Craft: one authoritative death receipt, native shrines and persistent offerings.
global.FRankDays = global.FRankDays || {};
(function (F) {
  var MAIN='f_rank_days:mainland_wilds', OW='minecraft:overworld';
  var DATA = [
    {key:'ferrous_wroughtnaut',id:'mowziesmobs:ferrous_wroughtnaut',name:'강철 수호자',grade:'E~D',dimension:OW,structure:'mowziesmobs:wrought_chamber',clue:'세르딘 서쪽 내해의 지정 시련 제단',coins:0,items:[['f_rank_days:high_tempering_core',2]]},
    // The specification's ordinary core uses the existing functional basic
    // tempering_stone; only high_tempering_core is a separate registered core.
    {key:'frostmaw',id:'mowziesmobs:frostmaw',name:'서리송곳니',grade:'C',dimension:MAIN,structure:'mowziesmobs:frostmaw_spawn',clue:'설원과 빙하 산맥의 잠든 성소',coins:400,items:[['mowziesmobs:ice_crystal',1],['f_rank_days:tempering_stone',2]]},
    {key:'umvuthi',id:'mowziesmobs:umvuthi',name:'태양조 움부티',grade:'C',dimension:MAIN,structure:'mowziesmobs:umvuthana_grove',clue:'사바나 태양 부락의 왕좌',coins:400,items:[['f_rank_days:solar_blessing_token',1],['f_rank_days:tempering_stone',2]]},
    {key:'sculptor',id:'mowziesmobs:sculptor',name:'조각가 통비',grade:'B',dimension:MAIN,structure:'mowziesmobs:monastery',clue:'높이110 이상 고산의 수도원',coins:650,bonusPoints:1,items:[['f_rank_days:earth_trial_token',1]]},
    {key:'void_blossom',id:'bosses_of_mass_destruction:void_blossom',name:'공허의 꽃',grade:'B',dimension:MAIN,structure:'bosses_of_mass_destruction:void_blossom',clue:'공허 백합이 가리키는 심층 대공동',coins:0,items:[['bosses_of_mass_destruction:void_thorn',1],['f_rank_days:high_tempering_core',3]]},
    {key:'lich',id:'bosses_of_mass_destruction:lich',name:'밤의 리치',grade:'B~A',dimension:MAIN,structure:'bosses_of_mass_destruction:lich_tower',clue:'한랭지 리치 탑과 영혼의 별 네 제단',coins:0,items:[['bosses_of_mass_destruction:ancient_anima',1],['f_rank_days:high_tempering_core',4]]},
    {key:'gauntlet',id:'bosses_of_mass_destruction:gauntlet',name:'네더 건틀릿',grade:'A',dimension:'minecraft:the_nether',structure:'bosses_of_mass_destruction:gauntlet_arena',clue:'네더 지하 투기장의 봉인',coins:1200,items:[['bosses_of_mass_destruction:blazing_eye',1]]},
    {key:'obsidilith',id:'bosses_of_mass_destruction:obsidilith',name:'옵시딜리스',grade:'S',dimension:'minecraft:the_end',structure:'bosses_of_mass_destruction:obsidilith_arena',clue:'드래곤 너머 엔드 외곽 섬의 흑요석 요새',coins:2000,title:'차원의 지배자',items:[['bosses_of_mass_destruction:obsidian_heart',1]]}
  ];
  var DRAGON={key:'ender_dragon',id:'minecraft:ender_dragon',name:'엔더 드래곤',clue:'본토 엔드 유적 너머 중앙 섬의 드래곤',dimension:'minecraft:the_end',extra:true,coins:0,items:[]};
  var byId={}, byKey={}, wild={frostmaw:true,umvuthi:true,sculptor:true}, activeDeath=null;
  var cacheServer=null,cache=null,scanTick=0,warned={},nativeConfirmationGrace={};
  for(var d=0;d<DATA.length;d++){byId[DATA[d].id]=DATA[d];byKey[DATA[d].key]=DATA[d];}
  byId[DRAGON.id]=DRAGON;byKey[DRAGON.key]=DRAGON;
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function dim(e){return String(e&&e.level&&e.level.dimension||e&&e.dimension||'');}
  function id(e){return String(e&&e.uuid||'');}
  function type(e){return String(e&&e.type||'');}
  function count(v){return Math.max(0,Number(v&&typeof v==='object'?(v.count||v.clear_count||0):v||0));}
  function fail(reason,message){return{ok:false,reason:reason,message:message||reason};}
  function warn(key,error){if(!warned[key]){warned[key]=true;console.warn('[F-Craft bosses v99] '+key+': '+String(error));}}
  function now(server){return Number(server.overworld().getTime());}
  function each(list,fn){if(!list)return;var n=typeof list.size==='function'?list.size():list.length;for(var i=0;i<n;i++)fn(typeof list.get==='function'?list.get(i):list[i]);}
  function alive(e){return !!e&&e.isAlive()&&!e.isRemoved();}
  function sq(a,b){var x=Number(a.x)-Number(b.x),y=Number(a.y)-Number(b.y),z=Number(a.z)-Number(b.z);return x*x+y*y+z*z;}
  function eligible(p,c){return !!p&&dim(p)===c.dimension&&alive(p)&&!p.isSpectator()&&sq(p,c)<=1296;}
  function known(key){return byId[String(key)]||byKey[String(key)];}
  function ownedWrought(e){
    if(type(e)!==DATA[0].id||dim(e)!==OW||!F.hasEntityTag(e,'f_rank_altar_boss'))return false;
    var c=F.getBossAltarCoordsV8(e.server);if(sq(e,c)>2304)return false;
    var a=F.loadBossAltarStateV8(e.server),uuid=String(a.active_boss_uuid||'');
    return !uuid||uuid===id(e)||uuid.indexOf('altar_wrought_')===0;
  }
  function readJSON(pd,key,defaultValue){var s=String(pd.getString(key)||'');return s?JSON.parse(s):copy(defaultValue);}
  function load(server){
    if(cacheServer===server&&cache)return cache;
    var pd=server.persistentData,pages=Math.max(1,Number(pd.getInt('f_rank_mowzie_shrines_v99_pages')||1)),all=[];
    for(var p=0;p<pages;p++){var rows=readJSON(pd,'f_rank_mowzie_shrines_v96'+(p?'_'+p:''),[]);if(!Array.isArray(rows))throw new Error('Invalid persisted shrine page');all=all.concat(rows);}
    cache=[];for(var i=0;i<all.length;i++){var v=all[i],spec=known(v.bossId);if(!spec||!wild[spec.key])continue;
      if(!isFinite(Number(v.x))||!isFinite(Number(v.y))||!isFinite(Number(v.z)))continue;
      if(v.dimension&&v.dimension!==MAIN)continue;v.dimension=MAIN;v.bossId=spec.id;
      v.shrineId=v.shrineId||spec.key+'|'+Math.floor(v.x)+'|'+Math.floor(v.y)+'|'+Math.floor(v.z);
      if(v.lastSummonTick===undefined)v.lastSummonTick=-3600;v.seenUUIDs=v.seenUUIDs||[];cache.push(v);
    }cacheServer=server;return cache;
  }
  function save(server,rows){
    var pages=[],page=[];for(var i=0;i<rows.length;i++){var next=page.concat([rows[i]]);if(JSON.stringify(next).length>48000&&page.length){pages.push(page);page=[rows[i]];}else page=next;}
    if(page.length||!pages.length)pages.push(page);
    var pd=server.persistentData,old=Math.max(1,Number(pd.getInt('f_rank_mowzie_shrines_v99_pages')||1));
    for(var j=0;j<pages.length;j++)pd.putString('f_rank_mowzie_shrines_v96'+(j?'_'+j:''),JSON.stringify(pages[j]));
    for(var k=pages.length;k<old;k++)pd.remove('f_rank_mowzie_shrines_v96_'+k);
    pd.putInt('f_rank_mowzie_shrines_v99_pages',pages.length);cacheServer=server;cache=rows;
  }
  function entities(level,center,radius){var Box=Java.loadClass('net.minecraft.world.phys.AABB');return level.getEntitiesWithin(new Box(center.x-radius,center.y-radius,center.z-radius,center.x+radius,center.y+radius,center.z+radius));}
  function sameBossNear(level,s){var found=null;each(entities(level,s,48),function(e){if(!found&&type(e)===s.bossId&&alive(e)&&sq(e,s)<=2304)found=e;});return found;}
  function entityByUUID(level,uuid){return level.getEntity(Java.loadClass('java.util.UUID').fromString(String(uuid)));}
  function loaded(level,s){return level.hasChunk(Math.floor(Number(s.x)/16),Math.floor(Number(s.z)/16));}
  function uuidNBT(uuid){var hex=String(uuid).replace(/-/g,''),values=[];if(!/^[0-9a-fA-F]{32}$/.test(hex))throw new Error('Invalid reserved UUID');for(var i=0;i<4;i++){var n=parseInt(hex.substr(i*8,8),16);values.push(n>=2147483648?n-4294967296:n);}return'[I;'+values.join(',')+']';}
  function receiptHistory(p){var pd=p.server.persistentData,key='f_rank_boss_receipts_v99_'+id(p),pages=Math.max(1,Number(pd.getInt(key+'_pages')||1)),all=[];for(var i=0;i<pages;i++)all=all.concat(readJSON(pd,key+'_'+i,[]));return all;}
  function saveReceiptHistory(p,all){var pd=p.server.persistentData,key='f_rank_boss_receipts_v99_'+id(p),pages=Math.max(1,Math.ceil(all.length/800));for(var i=0;i<pages;i++)pd.putString(key+'_'+i,JSON.stringify(all.slice(i*800,(i+1)*800)));pd.putInt(key+'_pages',pages);}
  function stage(p,name){if(F.grantPlayerStageOnce)F.grantPlayerStageOnce(p,name);}
  function markDiscovered(p,spec,where,source){
    var s=F.loadPlayerState(p);s.boss_discoveries_v99=s.boss_discoveries_v99||{};if(s.boss_discoveries_v99[spec.id])return false;
    s.boss_discoveries_v99[spec.id]={dimension:where.dimension,x:Math.floor(where.x),y:Math.floor(where.y),z:Math.floor(where.z),at:now(p.server),source:source};F.savePlayerState(p,s);
    stage(p,'frank_v99_boss_'+spec.key+'_discovered');if(p.tell)p.tell('§6[성소 발견] §f'+spec.name+' · '+spec.clue);return true;
  }
  function registerShrine(e){
    var spec=byId[type(e)];if(!spec||!wild[spec.key]||dim(e)!==MAIN)return null;
    var rows=load(e.server),key=id(e),found=null;
    for(var i=0;i<rows.length;i++)if(rows[i].bossId===spec.id&&(rows[i].seenUUIDs.indexOf(key)>=0||rows[i].pending&&rows[i].pending.uuid===key||sq(rows[i],e)<=2304)){found=rows[i];break;}
    if(!found){found={shrineId:spec.key+'|'+Math.floor(e.x)+'|'+Math.floor(e.y)+'|'+Math.floor(e.z),bossId:spec.id,dimension:MAIN,x:Number(e.x),y:Number(e.y),z:Number(e.z),lastSummonTick:-3600,seenUUIDs:[]};rows.push(found);}
    if(found.seenUUIDs.indexOf(key)<0){found.seenUUIDs.push(key);found.seenUUIDs=found.seenUUIDs.slice(-32);save(e.server,rows);}return found;
  }
  function legacyFirst(s){var q=F.ensurePlayerBossStateV8(s).quests.ferrous_wroughtnaut;return !!(q.first_cleared||q.first_reward_claimed||Number(q.clear_count||0)>0||s.reward_ledger&&s.reward_ledger.v8_first_clear_ferrous_wroughtnaut);}
  function sculptorPoints(p){
    var s=F.loadPlayerState(p),entry=s.boss_bonus_points_v99&&s.boss_bonus_points_v99.sculptor;if(!entry||entry.applied||!Platform.isLoaded('puffish_skills'))return false;
    var job=entry.job||s.guild_card&&s.guild_card.initial_job_id;if(F.JOB_ALIASES_V96&&F.JOB_ALIASES_V96[job])job=F.JOB_ALIASES_V96[job];
    if(!F.JOB_BY_ID_V96[job]||!s.job_licenses[job]||s.job_licenses[job].grade==='UNREGISTERED')return false;
    var RL=Java.loadClass('net.minecraft.resources.ResourceLocation'),API=Java.loadClass('net.puffish.skillsmod.api.SkillsAPI'),cat=API.getCategory(new RL('f_rank_days:'+job));if(!cat.isPresent())return false;
    var raw=p.minecraftPlayer||p,source=new RL('f_rank_days:boss_sculptor_v99');if(Number(cat.get().getPoints(raw,source))<1)cat.get().setPoints(raw,source,1);
    if(Number(cat.get().getPoints(raw,source))<1)return false;s=F.loadPlayerState(p);s.boss_bonus_points_v99.sculptor.job=job;s.boss_bonus_points_v99.sculptor.applied=true;F.savePlayerState(p,s);return true;
  }
  F.BOSS_DATA_V99=copy(DATA);
  F.isTrackedBossV99=function(entityId){return !!byId[String(entityId)];};
  F.shouldRejectBossSpawnV99=function(e){var spec=byId[type(e)];return !!spec&&!spec.extra&&dim(e)===OW&&(type(e)!==DATA[0].id||!ownedWrought(e));};
  F.getBossShrinesV99=function(server){return copy(load(server));};
  F.getBossProgressV99=function(p,bossId){var spec=known(bossId),s=F.loadPlayerState(p);if(!spec)return{count:0,firstRewardClaimed:false,shrineDiscovered:false};var n=count((s.v96_boss_clears||{})[spec.id]);if(spec.key==='ferrous_wroughtnaut')n=Math.max(n,Number(F.ensurePlayerBossStateV8(s).quests.ferrous_wroughtnaut.clear_count||0));return{count:n,firstRewardClaimed:!!(s.reward_ledger||{})['v99_boss_first_'+spec.key],shrineDiscovered:!!(s.boss_discoveries_v99||{})[spec.id]};};
  F.getBossDiscoveryV99=function(p){var s=F.loadPlayerState(p),found=[];for(var i=0;i<DATA.length;i++)if((s.boss_discoveries_v99||{})[DATA[i].id])found.push(DATA[i].id);return{count:found.length,bosses:found};};
  F.isActiveBossDeathContextV99=function(p,c){return !!c&&activeDeath===c&&eligible(p,c);};
  F.recordBossClearV99=function(p,c){
    if(!c||activeDeath!==c||!eligible(p,c))return fail('verified_death_required');
    var history=receiptHistory(p);if(history.indexOf(c.uuid)>=0)return{ok:true,already:true};
    var spec=known(c.bossId),result=F.runAtomicPlayerV96(p,function(){
      var s=F.loadPlayerState(p);s.boss_receipts_v99=s.boss_receipts_v99||{};s.v96_boss_clears=s.v96_boss_clears||{};s.reward_ledger=s.reward_ledger||{};
      if(s.boss_receipts_v99[c.uuid])return{ok:true,already:true};
      var key='v99_boss_first_'+spec.key,prior=!!s.reward_ledger[key],legacy=spec.key==='ferrous_wroughtnaut'&&legacyFirst(s),n=count(s.v96_boss_clears[spec.id]);
      if(spec.key==='ferrous_wroughtnaut')n=Math.max(n,Number(F.ensurePlayerBossStateV8(s).quests.ferrous_wroughtnaut.clear_count||0));
      var first=!prior&&!legacy;
      if(first)for(var j=0;j<spec.items.length;j++)if(!Item.exists(spec.items[j][0]))return fail('missing_reward_item',spec.items[j][0]);
      var old=s.v96_boss_clears[spec.id];if(old&&typeof old==='object'){old.count=n+1;s.v96_boss_clears[spec.id]=old;}else s.v96_boss_clears[spec.id]=n+1;
      var previousReceipts=Object.keys(s.boss_receipts_v99);for(var h=0;h<previousReceipts.length;h++)if(history.indexOf(previousReceipts[h])<0)history.push(previousReceipts[h]);
      s.boss_receipts_v99[c.uuid]={bossId:spec.id,at:now(p.server)};s.reward_ledger[key]=true;
      // Complete UUID history lives in paged world NBT. Keep only recent details
      // inside the JSON player state, avoiding the NBT UTF string size limit.
      var recent=Object.keys(s.boss_receipts_v99);while(recent.length>64)delete s.boss_receipts_v99[recent.shift()];
      if(spec.key==='ferrous_wroughtnaut'){
        var q=F.ensurePlayerBossStateV8(s).quests.ferrous_wroughtnaut;q.clear_count=n+1;
        if(!q.first_cleared){q.first_cleared=true;q.first_clear_day=F.getCurrentGameDayV8(p.server);q.codex_unlocked=true;q.free_rematch_unlocked=true;}
      }
      if(first&&spec.title){s.legendary_titles_v99=s.legendary_titles_v99||[];if(s.legendary_titles_v99.indexOf(spec.title)<0)s.legendary_titles_v99.push(spec.title);var b=F.ensurePlayerBossStateV8(s);if(b.titles.indexOf(spec.title)<0)b.titles.push(spec.title);}
      if(first&&spec.bonusPoints){s.boss_bonus_points_v99=s.boss_bonus_points_v99||{};s.boss_bonus_points_v99.sculptor={amount:1,job:null,applied:false};}
      F.savePlayerState(p,s);
      if(first){for(var i=0;i<spec.items.length;i++)p.give(spec.items[i][1]+'x '+spec.items[i][0]);if(spec.coins){var money=F.grantPlayerCurrencyV8(p,spec.coins,false);if(!money||!money.ok)return fail('reward_currency_failed');}}
      // Native boss loot remains native. Retain the old killer-only relic repeat;
      // its v97 high-core filter and the separate Hess report are unchanged.
      if(spec.key==='ferrous_wroughtnaut'&&c.killerUUID===id(p)){var drops=F.getBossSpecForWorldV97?F.getBossSpecForWorldV97(p.server,p).repeatable_drops:[];for(var k=0;k<drops.length;k++)if(drops[k].id!=='f_rank_days:high_tempering_core')p.give(drops[k].count+'x '+drops[k].id);}
      return{ok:true,first:first,legacyFirstPreserved:!!legacy,count:n+1};
    });
    if(result&&result.ok){
      if(!result.already&&history.indexOf(c.uuid)<0){history.push(c.uuid);saveReceiptHistory(p,history);}
      if(!result.already&&typeof F.onCompendiumBossReceiptV99==='function')F.onCompendiumBossReceiptV99(p,c);
      if(!result.already&&spec.key==='ferrous_wroughtnaut'&&typeof F.onChapter1BossReceiptCommittedV10==='function')F.onChapter1BossReceiptCommittedV10(p,c);
      if(spec.key==='ferrous_wroughtnaut')F.unlockMainlandSailingV96(p,'boss');
      stage(p,'frank_v99_boss_'+spec.key+'_cleared');markDiscovered(p,spec,c,'native_death');
      if(result.first&&F.recordNewspaperEventV8)F.recordNewspaperEventV8(p.server,{type:'BOSS_FIRST_CLEAR',actor_uuid:id(p),display_name:String(p.username),boss_name:spec.name,day:F.getCurrentGameDayV8(p.server),region:c.dimension});
      if(F.syncFtbQuestStagesForPlayer)F.syncFtbQuestStagesForPlayer(p);if(F.syncHudV96)F.syncHudV96(p);if(!result.already&&p.tell)p.tell('§6[파티 토벌] §f'+spec.name+' · 개인 누적 '+result.count+'회'+(result.first?' · 최초 보상 지급':''));
      if(spec.key==='sculptor')sculptorPoints(p);
    }return result;
  };
  F.handleBossDeathV99=function(e,killer){
    var spec=byId[type(e)];if(!spec||!e.server||e.isAlive())return fail('actual_tracked_death_required');
    if(dim(e)===OW&&!ownedWrought(e))return fail('unowned_island_boss');
    if([OW,MAIN,'minecraft:the_nether','minecraft:the_end'].indexOf(dim(e))<0)return fail('not_a_boss_dimension');
    var c={bossId:spec.id,uuid:id(e),dimension:dim(e),x:Number(e.x),y:Number(e.y),z:Number(e.z),killerUUID:id(killer)},server=e.server,awarded=[];
    if(!c.uuid)return fail('boss_uuid_required');if(wild[spec.key])registerShrine(e);
    if(spec.key==='ferrous_wroughtnaut'){var altar=F.loadBossAltarStateV8(server);if(String(altar.active_boss_uuid)===c.uuid){altar.active_boss_uuid=null;altar.arena_phase_v97='IDLE';altar.presence_v97={emptySince:null,warned:false};F.saveBossAltarStateV8(server,altar);}}
    activeDeath=c;try{each(server.players,function(p){if(!eligible(p,c))return;var r=F.recordBossClearV99(p,c);if(r&&r.ok&&!r.already)awarded.push(id(p));});}finally{activeDeath=null;}
    return{ok:true,shared_party_uuids:awarded,bossId:c.bossId,uuid:c.uuid};
  };
  F.handleLegacyBossDeathV99=function(p,bossId,uuid){var spec=known(bossId);if(!spec||!p)return fail('actual_death_required');var e=p.level.getEntity(Java.loadClass('java.util.UUID').fromString(String(uuid)));return e&&!e.isAlive()?F.handleBossDeathV99(e,p):fail('actual_death_required');};
  F.onBossSpawnV99=function(e){var spec=byId[type(e)];if(!spec)return;if(wild[spec.key])registerShrine(e);if(spec.key==='ferrous_wroughtnaut'&&ownedWrought(e))e.server.scheduleInTicks(1,function(){if(alive(e))F.applyGatekeeperScaleV96(e);});};
  F.useBossIncenseV99=function(p,stack){
    if(dim(p)!==MAIN||!stack||String(stack.id)!=='f_rank_days:ancient_reawakening_incense'||Number(stack.count)<1)return fail('incense_requires_mainland_shrine','본토에서 발견한 빈 성소 안에서 사용하세요.');
    var rows=load(p.server),s=null;for(var i=0;i<rows.length;i++)if(sq(p,rows[i])<=784&&(!s||sq(p,rows[i])<sq(p,s)))s=rows[i];if(!s)return fail('no_recorded_shrine','성소 중심에서28블록 안으로 다가가세요.');
    var t=now(p.server);if(s.pending)return fail('shrine_reserved','이미 공명이 시작되었습니다.');if(t-Number(s.lastSummonTick)<3600)return fail('shrine_cooldown','성소의 공명은3분 뒤 다시 사용할 수 있습니다.');
    if(!loaded(p.level,s))return fail('shrine_not_loaded');if(sameBossNear(p.level,s))return fail('boss_still_alive','근처에 같은 수호수가 살아 있습니다.');
    var reservation={uuid:String(Java.loadClass('java.util.UUID').randomUUID()),owner:id(p),due:t+40,requestedAt:t,status:'pending'};s.pending=reservation;save(p.server,rows);
    var consumed=F.runAtomicPlayerV96(p,function(){if(!F.consumePlayerItemExact(p,'f_rank_days:ancient_reawakening_incense',1))return fail('incense_consumption_failed');var state=F.loadPlayerState(p);state.boss_incense_offerings_v99=state.boss_incense_offerings_v99||{};state.boss_incense_offerings_v99[reservation.uuid]={shrineId:s.shrineId,at:t};F.savePlayerState(p,state);return{ok:true};});
    if(!consumed||!consumed.ok){delete s.pending;save(p.server,rows);return fail('incense_consumption_failed');}
    s.pending.consumed=true;s.lastSummonTick=t;save(p.server,rows);
    try{p.server.runCommandSilent('execute in '+MAIN+' run particle minecraft:soul_fire_flame '+s.x+' '+(s.y+1)+' '+s.z+' 1 1 1 0.02 36 force');p.server.runCommandSilent('execute in '+MAIN+' run playsound minecraft:item.goat_horn.sound.0 master @a[distance=..48] '+s.x+' '+s.y+' '+s.z+' 1 1');}catch(error){warn('offering_visual',error);}
    return{ok:true,consumed:1,uuid:reservation.uuid,due:reservation.due,shrineId:s.shrineId};
  };
  F.tickBossResummonsV99=function(server){
    var rows=load(server),level=server.getLevel(MAIN),changed=false,t=now(server);if(!level)return;
    for(var i=0;i<rows.length;i++){var s=rows[i],r=s.pending;if(!r||(r.status!=='pending'&&r.status!=='awaiting_native')||t<r.due)continue;
      if(!loaded(level,s)){delete nativeConfirmationGrace[r.uuid];continue;}
      if(!r.consumed){var requester=null;each(server.players,function(p){if(id(p)===r.owner)requester=p;});if(!requester)continue;var offered=F.loadPlayerState(requester).boss_incense_offerings_v99||{};if(!offered[r.uuid]){delete s.pending;s.lastSummonTick=-3600;changed=true;continue;}r.consumed=true;changed=true;}
      var present=entityByUUID(level,r.uuid);
      if(present){if(type(present)!==s.bossId)throw new Error('Reserved boss UUID belongs to a foreign entity');s.lastResult={uuid:r.uuid,status:'spawned',at:t};delete nativeConfirmationGrace[r.uuid];delete s.pending;changed=true;continue;}
      if(r.status==='awaiting_native'){
        // A successful summon can enter the native entity manager next tick.
        // Never reissue a command already attempted, including after restart.
        // A newly loaded chunk/server also gets one finite20tick confirmation
        // window; an unloaded entity chunk is not evidence of failed creation.
        if(nativeConfirmationGrace[r.uuid]===undefined)nativeConfirmationGrace[r.uuid]=t;
        if(t<Math.max(Number(r.confirmBy||r.spawnAttemptedAt+20),nativeConfirmationGrace[r.uuid]+20))continue;
        r.status='refund_due';r.failure='native_entity_unconfirmed';delete nativeConfirmationGrace[r.uuid];changed=true;continue;
      }
      var aliveBoss=sameBossNear(level,s);if(aliveBoss){r.status='refund_due';r.failure='another_boss_arrived';changed=true;continue;}
      // Do not erase terrain for a summon. An obstructed shrine waits for repair.
      var preview=level.createEntity(s.bossId);preview.setPosition(s.x,s.y,s.z);
      if(!level.noCollision(preview,preview.getBoundingBox())){if(t-r.due>=1200){r.status='refund_due';r.failure='shrine_obstructed';changed=true;}continue;}
      r.spawnAttemptedAt=t;r.confirmBy=t+20;r.status='awaiting_native';nativeConfirmationGrace[r.uuid]=t;save(server,rows);
      var summoned=server.runCommandSilent('execute in '+MAIN+' run summon '+s.bossId+' '+s.x+' '+s.y+' '+s.z+' {UUID:'+uuidNBT(r.uuid)+',PersistenceRequired:1b,Tags:["fcraft_v99_resummoned"]}');
      var actual=entityByUUID(level,r.uuid);
      r.commandAccepted=Number(summoned)===1;
      if(r.commandAccepted&&actual&&type(actual)===s.bossId){s.lastResult={uuid:r.uuid,status:'spawned',at:t};delete nativeConfirmationGrace[r.uuid];delete s.pending;}else if(!r.commandAccepted){r.status='refund_due';r.failure='native_spawn_failed';delete nativeConfirmationGrace[r.uuid];}changed=true;
    }if(changed)save(server,rows);
    // A failed reservation owes exactly one offering, including across logout/restart.
    for(var j=0;j<rows.length;j++){var shrine=rows[j],pending=shrine.pending;if(!pending||pending.status!=='refund_due'||!pending.consumed)continue;
      var owner=null;each(server.players,function(p){if(id(p)===pending.owner)owner=p;});if(!owner)continue;
      var result=F.runAtomicPlayerV96(owner,function(){var state=F.loadPlayerState(owner);state.boss_incense_refunds_v99=state.boss_incense_refunds_v99||{};if(!state.boss_incense_refunds_v99[pending.uuid]){state.boss_incense_refunds_v99[pending.uuid]=true;F.savePlayerState(owner,state);owner.give('f_rank_days:ancient_reawakening_incense');}return{ok:true};});
      if(result&&result.ok){shrine.lastResult={uuid:pending.uuid,status:'refunded',reason:pending.failure,at:t};shrine.lastSummonTick=-3600;delete shrine.pending;save(server,rows);}
    }
  };
  F.scanBossDiscoveryV99=function(p){
    if(!alive(p)||p.isSpectator())return;var where={dimension:dim(p),x:Number(p.x),y:Number(p.y),z:Number(p.z)};
    var state=F.loadPlayerState(p),current={},rows=load(p.server),dirty=false;for(var n=0;n<rows.length;n++)if(rows[n].pending&&rows[n].pending.owner===id(p))current[rows[n].pending.uuid]=true;
    for(var bookIndex=0;bookIndex<2;bookIndex++){var book=state[bookIndex?'boss_incense_refunds_v99':'boss_incense_offerings_v99'];if(book)for(var receipt in book)if(!current[receipt]){delete book[receipt];dirty=true;}}if(dirty)F.savePlayerState(p,state);
    each(entities(p.level,p,48),function(e){var spec=byId[type(e)];if(spec&&alive(e)&&sq(e,p)<=2304)markDiscovered(p,spec,{dimension:dim(e),x:Number(e.x),y:Number(e.y),z:Number(e.z)},'native_boss');});
    if(where.dimension===MAIN){var rows=load(p.server);for(var i=0;i<rows.length;i++)if(sq(p,rows[i])<=784)markDiscovered(p,known(rows[i].bossId),rows[i],'recorded_shrine');}
    var Registry=Java.loadClass('net.minecraft.core.registries.Registries'),RL=Java.loadClass('net.minecraft.resources.ResourceLocation'),registry=p.server.registryAccess().registryOrThrow(Registry.STRUCTURE);
    for(var j=0;j<DATA.length;j++){var spec=DATA[j];if(spec.dimension!==where.dimension)continue;var structure=registry.get(new RL(spec.structure));if(!structure)continue;var start=p.level.structureManager().getStructureAt(p.blockPosition(),structure);if(start&&start.isValid())markDiscovered(p,spec,where,'native_structure');}
    sculptorPoints(p);
  };
  global.FCraftBossesV99={data:copy(DATA),eligible:eligible,distanceSquared:sq,uuidNBT:uuidNBT,known:function(k){return copy(known(k)||null);}};
  if(typeof EntityEvents!=='undefined'&&EntityEvents.spawned)EntityEvents.spawned(function(e){if(F.shouldRejectBossSpawnV99(e.entity))e.cancel();else try{F.onBossSpawnV99(e.entity);}catch(error){warn('spawn',error);}});
  if(typeof ItemEvents!=='undefined'&&ItemEvents.rightClicked)ItemEvents.rightClicked(function(e){if(String(e.item.id)!=='f_rank_days:ancient_reawakening_incense')return;var result=F.useBossIncenseV99(e.player,e.item);if(!result.ok&&e.player.tell)e.player.tell('§e[공명향] §f'+result.message);});
  if(typeof ServerEvents!=='undefined'){
    if(ServerEvents.loaded)ServerEvents.loaded(function(){cache=null;cacheServer=null;scanTick=0;nativeConfirmationGrace={};});
    if(ServerEvents.tick)ServerEvents.tick(function(e){try{F.tickBossResummonsV99(e.server);if(++scanTick%20===0)each(e.server.players,function(p){try{F.scanBossDiscoveryV99(p);}catch(error){warn('discovery',error);}});}catch(error){warn('reservation',error);}});
    if(ServerEvents.recipes)ServerEvents.recipes(function(e){
      e.remove({output:'bosses_of_mass_destruction:brimstone_nectar'});
      var base=['f_rank_days:golden_wheat_stew','f_rank_days:refined_mana_stone','f_rank_days:refined_mana_stone','f_rank_days:hardened_ingot'];
      e.shapeless('bosses_of_mass_destruction:brimstone_nectar',base.concat(['minecraft:blaze_powder'])).id('f_rank_days:brimstone_nectar_blaze_v99');
      e.shapeless('bosses_of_mass_destruction:brimstone_nectar',base.concat(['minecraft:glowstone_dust'])).id('f_rank_days:brimstone_nectar_glowstone_v99');
      e.shapeless('bosses_of_mass_destruction:brimstone_nectar',base.concat(['minecraft:amethyst_shard','minecraft:amethyst_shard'])).id('f_rank_days:brimstone_nectar_amethyst_v99');
      e.shapeless('f_rank_days:ancient_reawakening_incense',['f_rank_days:alchemist_clear_tea','f_rank_days:harvest_berry_tart','f_rank_days:refined_mana_stone','f_rank_days:refined_mana_stone','minecraft:gold_ingot']).id('f_rank_days:ancient_reawakening_incense_v99');
    });
  }
})(global.FRankDays);
