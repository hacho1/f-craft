// F-Craft 9.4 outposts. Pure state engine; native/world operations are injected by script 21.
var FCraftOutpostCoreV94=(function(){
  function clone(o){return JSON.parse(JSON.stringify(o));}
  function finite(n){return typeof n==='number'&&isFinite(n);}
  function xyz(p){return p&&finite(p.x)&&finite(p.y)&&finite(p.z);}
  function fail(reason){return{ok:false,reason:reason};}
  function each(o,f){var keys=Object.keys(o||{});for(var i=0;i<keys.length;i++)f(o[keys[i]],keys[i]);}
  function size(o){return Object.keys(o||{}).length;}
  var LEGACY_POLICY={unlockMs:180000,cooldownMs:300000,battleTimeoutMs:300000,missingGraceMs:10000,leashRadius:24,protectionRadius:18,reach:6.5};
  var LEGACY_SPECS={
    serdin_west_bandit_camp:{name:'세르딘 서부 약탈자 목책 진영',rank:'D',lootTable:'minecraft:chests/pillager_outpost',copper:120,items:[{id:'f_rank_days:tempering_stone',count:2},{id:'f_rank_days:brion_barley_bread',count:2}],waves:[
      [{type:'minecraft:pillager',count:3,nbt:'HandItems:[{id:"minecraft:crossbow",Count:1b},{}]'},{type:'minecraft:zombie',count:2,nbt:'ArmorItems:[{},{},{id:"minecraft:leather_chestplate",Count:1b},{id:"minecraft:leather_helmet",Count:1b}]'}],
      [{type:'minecraft:vindicator',count:2,nbt:'HandItems:[{id:"minecraft:iron_axe",Count:1b},{}]'},{type:'minecraft:vindicator',count:1,nbt:'CustomName:\'{"text":"산적 수비대장 가르그","color":"gold","bold":true}\',CustomNameVisible:1b,Attributes:[{Name:"generic.max_health",Base:48.0d},{Name:"generic.knockback_resistance",Base:0.35d}],Health:48.0f,HandItems:[{id:"minecraft:iron_axe",Count:1b},{id:"minecraft:shield",Count:1b}]'}]
    ]},
    serdin_east_undead_outpost:{name:'세르딘 동부 망자의 폐허 초소',rank:'C',lootTable:'minecraft:chests/simple_dungeon',copper:180,items:[{id:'f_rank_days:high_tempering_core',count:1},{id:'f_rank_days:refined_mana_stone',count:2}],waves:[
      [{type:'minecraft:skeleton',count:3,nbt:'HandItems:[{id:"minecraft:bow",Count:1b},{}],ArmorItems:[{},{},{},{id:"minecraft:chainmail_helmet",Count:1b}]'},{type:'minecraft:zombie',count:3,nbt:'HandItems:[{id:"minecraft:stone_sword",Count:1b},{}],ArmorItems:[{},{},{id:"minecraft:chainmail_chestplate",Count:1b},{id:"minecraft:iron_helmet",Count:1b}]'}],
      [{type:'minecraft:cave_spider',count:2,nbt:''},{type:'minecraft:skeleton',count:1,nbt:'CustomName:\'{"text":"심층 망자 지휘관","color":"aqua","bold":true}\',CustomNameVisible:1b,Attributes:[{Name:"generic.max_health",Base:56.0d},{Name:"generic.knockback_resistance",Base:0.4d}],Health:56.0f,HandItems:[{id:"minecraft:diamond_sword",Count:1b},{id:"minecraft:shield",Count:1b}],ArmorItems:[{id:"minecraft:iron_boots",Count:1b},{id:"minecraft:iron_leggings",Count:1b},{id:"minecraft:iron_chestplate",Count:1b},{id:"minecraft:iron_helmet",Count:1b}]'}]
    ]}
  };
  var A=typeof FCraftArenaCoreV97!=='undefined'?FCraftArenaCoreV97:(typeof global!=='undefined'&&global.FRankDays?global.FRankDays.ARENA_CORE_V97:null);
  if(!A&&typeof require==='function')A=require('./13_9_fcraft_arena_v97.js');
  var POLICY=clone(LEGACY_POLICY);POLICY.cooldownMs=600000;POLICY.leashRadius=19.2;
  var SPECS={"serdin_west_bandit_camp":{"name":"세르딘 서부 약탈자 목책 진영","rank":"E~초급 D","lootTable":"f_rank_days:chests/serdin_outpost_west_repeat","copper":130,"items":[{"id":"f_rank_days:tempering_stone","count":2},{"id":"f_rank_days:brion_barley_bread","count":2}],"firstClearReward":{"copper":130,"items":[{"id":"f_rank_days:tempering_stone","count":2},{"id":"f_rank_days:brion_barley_bread","count":2}]},"repeatClearReward":{"copper":30,"items":[{"id":"f_rank_days:serdin_herb_ration","count":1}]},"waves":[[{"type":"minecraft:pillager","count":2,"nbt":"HandItems:[{id:\"minecraft:crossbow\",Count:1b},{}]"},{"type":"minecraft:zombie","count":2,"nbt":"ArmorItems:[{},{},{id:\"minecraft:leather_chestplate\",Count:1b},{id:\"minecraft:leather_helmet\",Count:1b}]"}],[{"type":"minecraft:vindicator","count":1,"nbt":"CustomName:'{\"text\":\"산적 행동대원\",\"color\":\"gray\"}',HandItems:[{id:\"minecraft:wooden_axe\",Count:1b,tag:{AttributeModifiers:[]} },{}],Attributes:[{Name:\"generic.max_health\",Base:22.0d},{Name:\"generic.attack_damage\",Base:3.5d}],Health:22.0f"},{"type":"minecraft:vindicator","count":1,"nbt":"CustomName:'{\"text\":\"산적 수비대장 가르그\",\"color\":\"gold\",\"bold\":true}',CustomNameVisible:1b,HandItems:[{id:\"minecraft:stone_axe\",Count:1b,tag:{AttributeModifiers:[]}},{id:\"minecraft:shield\",Count:1b}],ArmorItems:[{id:\"minecraft:leather_boots\",Count:1b},{id:\"minecraft:chainmail_leggings\",Count:1b},{id:\"minecraft:chainmail_chestplate\",Count:1b},{}],Attributes:[{Name:\"generic.max_health\",Base:32.0d},{Name:\"generic.attack_damage\",Base:4.5d},{Name:\"generic.knockback_resistance\",Base:0.25d}],Health:32.0f"}]]},"serdin_east_undead_outpost":{"name":"세르딘 동부 망자의 폐허 초소","rank":"D","lootTable":"f_rank_days:chests/serdin_outpost_east_repeat","copper":170,"items":[{"id":"f_rank_days:tempering_stone","count":2},{"id":"f_rank_days:refined_mana_stone","count":1}],"firstClearReward":{"copper":170,"items":[{"id":"f_rank_days:tempering_stone","count":2},{"id":"f_rank_days:refined_mana_stone","count":1}]},"repeatClearReward":{"copper":35,"items":[{"id":"f_rank_days:hearth_potato_soup","count":1}]},"waves":[[{"type":"minecraft:skeleton","count":2,"nbt":"HandItems:[{id:\"minecraft:bow\",Count:1b},{}],ArmorItems:[{},{},{},{id:\"minecraft:chainmail_helmet\",Count:1b}]"},{"type":"minecraft:zombie","count":2,"nbt":"HandItems:[{id:\"minecraft:stone_sword\",Count:1b},{}],ArmorItems:[{},{},{id:\"minecraft:chainmail_chestplate\",Count:1b},{id:\"minecraft:leather_helmet\",Count:1b}]"}],[{"type":"minecraft:spider","count":1,"nbt":""},{"type":"minecraft:skeleton","count":1,"nbt":"CustomName:'{\"text\":\"심층 망자 지휘관\",\"color\":\"aqua\",\"bold\":true}',CustomNameVisible:1b,HandItems:[{id:\"minecraft:iron_sword\",Count:1b,tag:{AttributeModifiers:[]}},{id:\"minecraft:shield\",Count:1b}],ArmorItems:[{id:\"minecraft:chainmail_boots\",Count:1b},{id:\"minecraft:chainmail_leggings\",Count:1b},{id:\"minecraft:iron_chestplate\",Count:1b},{id:\"minecraft:iron_helmet\",Count:1b}],Attributes:[{Name:\"generic.max_health\",Base:38.0d},{Name:\"generic.attack_damage\",Base:5.0d},{Name:\"generic.movement_speed\",Base:0.26d},{Name:\"generic.knockback_resistance\",Base:0.30d}],Health:38.0f"}]]}};
  function modern(layout){return String(layout&&layout.serdinLayoutVersion||'')==='9.7';}
  function validate(layout){
    var errors=[],ids={};
    if(!layout||!String(layout.id||layout.worldValidationId||''))return['layout identity required'];
    if(layout.layoutVersion===undefined)return['layoutVersion required'];
    var sites=layout.outposts||[];
    for(var i=0;i<sites.length;i++){
      var s=sites[i];
      if(!s||!SPECS[s.id]||ids[s.id]){errors.push('unknown/duplicate outpost');continue;}ids[s.id]=true;
      if(s.dimension!=='minecraft:overworld')errors.push(s.id+': unsupported dimension');
      if(!xyz(s)||!xyz(s.chest))errors.push(s.id+': finite center and chest coordinates required');
      if(s.containerPrepared!==true)errors.push(s.id+': dedicated prepared container required');
      if(!s.chest||['lootr:lootr_chest','lootr:lootr_barrel','minecraft:chest','minecraft:barrel'].indexOf(s.chest.blockId)<0)errors.push(s.id+': unsupported chest block');
      if(!s.spawnPoints||s.spawnPoints.length<8)errors.push(s.id+': eight surveyed spawn points required');
      else for(var j=0;j<s.spawnPoints.length;j++)if(!xyz(s.spawnPoints[j])||Math.abs(s.spawnPoints[j].y-s.y)>16||Math.pow(s.spawnPoints[j].x-s.x,2)+Math.pow(s.spawnPoints[j].z-s.z,2)>225)errors.push(s.id+': invalid spawn footprint');
    }
    return errors;
  }
  function signature(s){return JSON.stringify({id:s.id,dimension:s.dimension,x:s.x,y:s.y,z:s.z,chest:s.chest,spawnPoints:s.spawnPoints,bindingVersion:s.bindingVersion||1});}
  function protectedAt(site,pos,padding){
    if(!site||!pos||site.dimension!==pos.dimension||!xyz(pos)||!xyz(site))return false;
    var r=Number(site.protectionRadius||POLICY.protectionRadius)+Number(padding||0),minY=site.minY===undefined?site.y-8:site.minY,maxY=site.maxY===undefined?site.y+32:site.maxY;
    return pos.y>=minY-Number(padding||0)&&pos.y<=maxY+Number(padding||0)&&Math.pow(pos.x-site.x,2)+Math.pow(pos.z-site.z,2)<=r*r;
  }
  function freshSite(s){return{id:s.id,binding:clone(s),bindingSignature:signature(s),phase:'SEALED',generation:0,wave:0,spawnPending:false,members:{},phaseSince:0,battleSince:0,container:null,lootCycles:{},lootPending:{},rewardKinds:{},presence:{emptySince:null,warned:false},claimed:{},lastError:''};}
  function Engine(layout,ports){
    var errors=validate(layout);if(errors.length)throw new Error(errors.join('; '));
    this.layout=clone(layout);this.scope=String(layout.id||layout.worldValidationId);this.ports=ports;this.sites={};
    for(var i=0;i<layout.outposts.length;i++)this.sites[layout.outposts[i].id]=clone(layout.outposts[i]);
    this.modern=modern(layout);this.specs=clone(this.modern?SPECS:LEGACY_SPECS);
    this.policy=clone(this.modern?POLICY:LEGACY_POLICY);var p=layout.outpostPolicy||{};
    for(var k in this.policy)if(finite(p[k])&&p[k]>=0)this.policy[k]=p[k];
    if(this.modern){this.policy.cooldownMs=Math.max(600000,this.policy.cooldownMs);this.policy.leashRadius=19.2;}
  }
  Engine.prototype.now=function(){return Number(this.ports.now());};
  Engine.prototype.load=function(){
    var d=this.ports.read();
    if(!d)d={schemaVersion:1,scope:this.scope,sites:{}};
    if(d.schemaVersion!==1||d.scope!==this.scope)throw new Error('Outpost save identity mismatch; previous data preserved');
    return clone(d);
  };
  Engine.prototype.save=function(d){this.ports.write(clone(d));};
  Engine.prototype.entry=function(d,id){
    var s=this.sites[id];if(!s)return null;
    if(!d.sites[id])d.sites[id]=freshSite(s);
    var st=d.sites[id];st.rewardKinds=st.rewardKinds||{};st.presence=st.presence||{emptySince:null,warned:false};
    if(st.bindingSignature!==signature(s)&&st.phase!=='RESETTING'){st.phase='RECOVERY';st.lastError='layout_binding_changed';}
    return st;
  };
  Engine.prototype.status=function(id){var d=this.load(),st=this.entry(d,id);if(!st)return fail('unknown_site');this.save(d);return clone(st);};
  Engine.prototype.quarantine=function(id,reason){var d=this.load(),st=this.entry(d,id);if(st){st.phase='RECOVERY';st.lastError=String(reason);this.save(d);}return fail(reason);};
  Engine.prototype.checkContainer=function(id){
    var d=this.load(),st=this.entry(d,id);if(!st)return fail('unknown_site');
    if(st.phase==='RECOVERY'||st.phase==='RESETTING')return fail(st.lastError||'recovery');
    var actual=this.ports.inspectContainer(st.binding,st.container);
    if(!actual||!actual.ok){if(actual&&actual.reason==='chunks_unavailable')return actual;return this.quarantine(id,actual&&actual.reason||'container_unavailable');}
    if(st.container&&JSON.stringify(st.container)!==JSON.stringify(actual.binding))return this.quarantine(id,'container_identity_changed');
    if(!st.container){st.container=actual.binding;this.save(d);}return actual;
  };
  // Use the same authoritative online-player snapshot and arena eligibility as
  // the presence timer. An ineligible initiator must not create a wave/cooldown.
  Engine.prototype.checkChallenger=function(binding,player){
    if(!this.modern)return{ok:true};
    if(!player||!player.uuid||!this.ports.players||!A||!A.presence)return fail('challenger_unavailable');
    var actors;
    try{actors=this.ports.players();}catch(error){return fail('challenger_unavailable');}
    if(!Array.isArray(actors))return fail('challenger_unavailable');
    var actor=null;
    for(var i=0;i<actors.length;i++)if(actors[i]&&String(actors[i].uuid)===String(player.uuid)){actor=actors[i];break;}
    if(!actor)return fail('challenger_offline');
    var rules=A.policy('outpost');
    if(A.presence(null,[actor],binding,rules,0).count===1)return{ok:true};
    if(actor.alive!==true)return fail('challenger_dead');
    if(actor.spectator)return fail('challenger_spectator');
    if(actor.creative)return fail('challenger_creative');
    if(actor.dimension!==binding.dimension)return fail('wrong_dimension');
    return fail('challenger_outside_arena');
  };
  Engine.prototype.begin=function(id,player){
    var d=this.load(),st=this.entry(d,id);if(!st)return fail('unknown_site');
    if(st.phase!=='SEALED')return fail('not_sealed');
    var challenger=this.checkChallenger(st.binding,player);if(!challenger.ok)return challenger;
    var ready=this.ports.ready(st.binding);if(!ready||!ready.ok)return ready||fail('chunks_unavailable');
    var bound=this.checkContainer(id);if(!bound.ok)return bound;
    d=this.load();st=this.entry(d,id);st.generation++;st.battleSince=this.now();st.claimed={};st.lootCycles={};st.lootPending={};st.rewardKinds={};st.presence={emptySince:null,warned:false};this.save(d);
    return this.spawnWave(id,0);
  };
  Engine.prototype.spawnWave=function(id,wave){
    var d=this.load(),st=this.entry(d,id),spec=this.specs[id];if(!st||!spec||!spec.waves[wave])return fail('invalid_wave');
    var ready=this.ports.ready(st.binding);if(!ready||!ready.ok)return ready||fail('chunks_unavailable');
    st.phase=wave===0?'WAVE_1':'WAVE_2';st.wave=wave;st.spawnPending=true;st.phaseSince=this.now();st.members={};
    var requests=[],groups=spec.waves[wave],sequence=0;
    for(var g=0;g<groups.length;g++)for(var n=0;n<groups[g].count;n++){
      var uid=String(this.ports.uuid()),point=clone(st.binding.spawnPoints[sequence%st.binding.spawnPoints.length]);
      var mobNbt=groups[g].nbt||'';
      // Vindicator vanilla death loot includes emeralds. Budgeted supply comes only from the personal reward transaction.
      if(this.modern)mobNbt+=(mobNbt?',':'')+'DeathLootTable:"minecraft:empty",CanPickUpLoot:0b,HandDropChances:[0.0f,0.0f],ArmorDropChances:[0.0f,0.0f,0.0f,0.0f]';
      var request={uuid:uid,site:id,generation:st.generation,wave:wave,sequence:sequence++,point:point,type:groups[g].type,nbt:mobNbt};
      st.members[uid]={uuid:uid,generation:st.generation,wave:wave,point:point,lastPosition:point,status:'PENDING',confirmed:false,missingSince:null};requests.push(request);
    }
    this.save(d);var failed=false;
    for(var i=0;i<requests.length;i++){
      var result;
      try{result=this.ports.spawn(st.binding,requests[i]);}catch(error){result=fail(String(error));}
      d=this.load();st=this.entry(d,id);var m=st.members[requests[i].uuid];
      if(!m||st.phase==='RESETTING'||st.phase==='RECOVERY'){failed=true;break;}
      if(result&&result.ok){m.confirmed=true;if(m.status!=='DEAD')m.status='ALIVE';}
      else if(m.status==='DEAD'&&m.confirmed){} // A real death event can occur immediately after a successful spawn.
      else{m.status='SPAWN_FAILED';st.lastError=result&&result.reason||'spawn_failed';failed=true;}
      this.save(d);if(failed)break;
    }
    d=this.load();st=this.entry(d,id);st.spawnPending=false;
    if(failed){st.phase='RESETTING';st.resetReason=st.lastError||'spawn_failed';st.resetCooldown=this.policy.cooldownMs;this.save(d);return fail('spawn_failed_no_victory');}
    this.save(d);this.ports.notify(st.binding,'wave',st.wave+1,size(st.members));
    this.advanceIfDead(id);return{ok:true,phase:st.phase,generation:st.generation,spawned:size(st.members)};
  };
  Engine.prototype.advanceIfDead=function(id){
    var d=this.load(),st=this.entry(d,id);if(!st||st.spawnPending||['WAVE_1','WAVE_2'].indexOf(st.phase)<0||!size(st.members))return false;
    var all=true;each(st.members,function(m){if(!m.confirmed||m.status!=='DEAD')all=false;});if(!all)return false;
    st.phaseSince=this.now();
    if(st.wave===0)st.phase='BETWEEN_WAVES';
    else{st.phase='UNLOCKED';st.members={};st.lootCycles={};st.lootPending={};st.rewardKinds={};}
    this.save(d);this.ports.notify(st.binding,st.phase==='UNLOCKED'?'unlocked':'next_wave',st.generation);return true;
  };
  Engine.prototype.death=function(id,uuid,generation,wave){
    var d=this.load(),st=this.entry(d,id);if(!st||['WAVE_1','WAVE_2'].indexOf(st.phase)<0)return fail('inactive_generation');
    var m=st.members[String(uuid)];
    if(!m||m.generation!==generation||m.wave!==wave||st.generation!==generation||st.wave!==wave)return fail('foreign_or_stale_member');
    if(m.status==='DEAD')return fail('duplicate_death');
    m.status='DEAD';m.confirmed=true;this.save(d);this.advanceIfDead(id);return{ok:true};
  };
  Engine.prototype.reset=function(id,ackLayout,cooldown){
    var d=this.load(),st=this.entry(d,id);if(!st)return fail('unknown_site');
    // Mark RESETTING before removing any entity, so nested death callbacks cannot advance a wave.
    st.phase='RESETTING';st.spawnPending=false;st.resetReason='operator_reset';st.resetCooldown=cooldown===undefined?this.policy.cooldownMs:cooldown;
    if(ackLayout)st.nextBinding=clone(this.sites[id]);this.save(d);this.ports.closeMenus(st.binding);return{ok:true,phase:'RESETTING'};
  };
  Engine.prototype.tick=function(){
    var ids=Object.keys(this.sites);
    for(var i=0;i<ids.length;i++)this.tickSite(ids[i]);
  };
  Engine.prototype.tickSite=function(id){
    var d=this.load(),st=this.entry(d,id),now=this.now(),self=this;if(!st)return;
    if(st.phase==='RECOVERY'){this.save(d);return;}
    if(st.phase==='RESETTING'){
      var clean=true;each(st.members,function(m){if(m.status==='REMOVED'||m.status==='DEAD')return;var r=self.ports.cleanup(st.binding,m);if(r&&r.ok)m.status='REMOVED';else clean=false;});
      if(clean){
        st.members={};st.spawnPending=false;st.phase='COOLDOWN';st.phaseSince=now;st.cooldownUntil=now+Number(st.resetCooldown||0);
        if(st.nextBinding){st.binding=st.nextBinding;delete st.nextBinding;st.bindingSignature=signature(st.binding);st.container=null;}
      }
      this.save(d);return;
    }
    if(st.phase==='UNLOCKED'&&now-st.phaseSince>=this.policy.unlockMs){st.phase='COOLDOWN';st.phaseSince=now;st.cooldownUntil=now+this.policy.cooldownMs;this.save(d);this.ports.closeMenus(st.binding);return;}
    if(st.phase==='COOLDOWN'&&now>=Number(st.cooldownUntil||st.phaseSince+this.policy.cooldownMs)){st.phase='SEALED';st.phaseSince=now;st.members={};this.save(d);return;}
    if(this.modern&&['WAVE_1','WAVE_2','BETWEEN_WAVES'].indexOf(st.phase)>=0){
      var center={dimension:st.binding.dimension,x:st.binding.x,y:st.binding.y,z:st.binding.z},actors=this.ports.players?this.ports.players():[];
      st.presence=A.presence(st.presence,actors,center,A.policy('outpost'),now);
      if(st.presence.warning)this.ports.notify(st.binding,'empty_warning',5);
      if(st.presence.reset){st.phase='RESETTING';st.spawnPending=false;st.resetReason='empty_arena_no_surviving_players';st.resetCooldown=this.policy.cooldownMs;this.save(d);this.ports.closeMenus(st.binding);return;}
      this.save(d);
    }
    if(st.phase==='BETWEEN_WAVES'){this.save(d);var r=this.ports.ready(st.binding);if(r.ok)this.spawnWave(id,1);else if(r.reason!=='chunks_unavailable')this.quarantine(id,r.reason||'unsafe_spawn');return;}
    if(['WAVE_1','WAVE_2'].indexOf(st.phase)<0){this.save(d);return;}
    if(st.spawnPending){st.phase='RESETTING';st.resetReason='interrupted_spawn';st.resetCooldown=this.policy.cooldownMs;this.save(d);return;}
    if(now-st.battleSince>=this.policy.battleTimeoutMs){st.phase='RESETTING';st.resetReason='battle_timeout';st.resetCooldown=this.policy.cooldownMs;this.save(d);this.ports.closeMenus(st.binding);return;}
    var mustReset=false;
    each(st.members,function(m){
      if(m.status==='DEAD')return;
      var obs=self.ports.observe(st.binding,m);
      if(!obs||obs.status==='UNLOADED'){m.missingSince=null;return;}
      if(obs.status==='DEAD'){m.status='DEAD';m.confirmed=true;return;}
      if(obs.status==='ALIVE'){
        m.missingSince=null;m.status='ALIVE';if(xyz(obs.position))m.lastPosition=clone(obs.position);
        var p=m.lastPosition;if(Math.pow(p.x-st.binding.x,2)+Math.pow(p.z-st.binding.z,2)>self.policy.leashRadius*self.policy.leashRadius||Math.abs(p.y-st.binding.y)>32)self.ports.leash(st.binding,m,{action:'hard_snapback',point:clone(m.point)});
      }else{
        if(m.missingSince===null||m.missingSince===undefined||now<m.missingSince)m.missingSince=now;
        if(now-m.missingSince>=self.policy.missingGraceMs)mustReset=true;
      }
    });
    if(mustReset){st.phase='RESETTING';st.resetReason='missing_member_no_victory';st.resetCooldown=this.policy.cooldownMs;}
    this.save(d);if(!mustReset)this.advanceIfDead(id);
  };
  Engine.prototype.open=function(id,player){
    var d=this.load(),st=this.entry(d,id);if(!st)return fail('unknown_site');
    if(!player||player.dimension!==st.binding.dimension||!xyz(player))return fail('wrong_dimension');
    var firstChest=st.binding.chest;if(Math.pow(player.x-firstChest.x-.5,2)+Math.pow(player.y-firstChest.y,2)+Math.pow(player.z-firstChest.z-.5,2)>this.policy.reach*this.policy.reach)return fail('too_far');
    if(this.modern&&(st.phase==='SEALED'||st.phase==='COOLDOWN')){
      var challenger=this.checkChallenger(st.binding,player);if(!challenger.ok)return challenger;
    }
    this.tickSite(id);d=this.load();st=this.entry(d,id);if(!st)return fail('unknown_site');
    if(!player||player.dimension!==st.binding.dimension||!xyz(player))return fail('wrong_dimension');
    var c=st.binding.chest;if(Math.pow(player.x-c.x-.5,2)+Math.pow(player.y-c.y,2)+Math.pow(player.z-c.z-.5,2)>this.policy.reach*this.policy.reach)return fail('too_far');
    if(st.phase==='SEALED'){var start=this.begin(id,player);return{ok:false,reason:start.ok?'wave_started':start.reason,phase:start.phase||st.phase};}
    if(st.phase!=='UNLOCKED')return{ok:false,reason:'sealed_'+st.phase.toLowerCase(),phase:st.phase};
    var inspected=this.checkContainer(id);if(!inspected.ok)return inspected;
    d=this.load();st=this.entry(d,id);var uuid=String(player.uuid);
    if(!st.rewardKinds[uuid]||st.rewardKinds[uuid].generation!==st.generation){
      var plan=this.ports.rewardPlan?this.ports.rewardPlan(st.binding,this.specs[id],player,st.generation):{ok:true,kind:'LEGACY'};
      if(!plan||!plan.ok)return plan||fail('reward_plan_unavailable');
      st.rewardKinds[uuid]={generation:st.generation,kind:plan.kind};this.save(d);
    }
    var rewardKind=st.rewardKinds[uuid].kind;
    if(st.lootCycles[uuid]!==st.generation){
      st.lootPending[uuid]={generation:st.generation,startedAt:this.now()};this.save(d);
      var prepared;try{prepared=this.ports.prepareLoot(st.binding,st.container,player,st.generation,rewardKind);}catch(e){prepared=fail(String(e));}
      if(!prepared||!prepared.ok)return prepared||fail('loot_prepare_failed');
      d=this.load();st=this.entry(d,id);st.lootCycles[uuid]=st.generation;delete st.lootPending[uuid];this.save(d);
    }
    var claim=this.ports.reward(st.binding,this.specs[id],player,st.generation,rewardKind);
    if(!claim||!claim.ok)return claim||fail('reward_transaction_failed');
    d=this.load();st=this.entry(d,id);st.claimed[uuid]=st.generation;this.save(d);
    var allow=st.container.mode==='LOOTR'&&rewardKind!=='FIRST';if(allow)this.ports.watchMenu(st.binding,player,st.generation);
    return{ok:true,allowOpen:allow,bonusGranted:claim.granted===true,generation:st.generation,mode:st.container.mode,rewardKind:rewardKind};
  };
  Engine.prototype.arenaTick=function(tick){
    if(!this.modern||tick%5!==0)return;
    var d=this.load(),self=this;
    each(this.sites,function(site,id){var st=self.entry(d,id);if(['WAVE_1','WAVE_2'].indexOf(st.phase)<0)return;
      var center={dimension:st.binding.dimension,x:st.binding.x,y:st.binding.y,z:st.binding.z};
      if(tick%10===0&&self.ports.ring)self.ports.ring(st.binding,center,18);
      each(st.members,function(m){if(!m.confirmed||m.status==='DEAD')return;var obs=self.ports.observe(st.binding,m);if(!obs||obs.status!=='ALIVE'||!xyz(obs.position))return;
        var p=clone(obs.position);p.dimension=p.dimension||st.binding.dimension;var action=A.leash(p,center,A.policy('outpost'),m.point);if(action.action==='soft_pushback'||action.action==='hard_snapback')self.ports.leash(st.binding,m,action);
      });
    });
  };
  return{Engine:Engine,validate:validate,protectedAt:protectedAt,signature:signature,specs:SPECS,policy:POLICY,legacyPolicy:LEGACY_POLICY,legacySpecs:LEGACY_SPECS,isModern:modern,specForLayout:function(l,id){return(modern(l)?SPECS:LEGACY_SPECS)[id];},clone:clone};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FCraftOutpostCoreV94;
if(typeof global!=='undefined'&&global.FRankDays)global.FRankDays.OUTPOST_CORE_V94=FCraftOutpostCoreV94;
