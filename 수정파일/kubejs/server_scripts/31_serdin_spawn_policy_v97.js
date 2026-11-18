// F-Craft 9.7: bounded, surveyed first-island spawn rules. No spawn replacement.
var FCraftSerdinSpawn97=(function(){
 function inside(p,bs){for(var i=0;i<(bs||[]).length;i++){var b=bs[i];if(p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ)return true;}return false;}
 function compile(g){
  var result={spawn:g.spawn||{},grid:{}};
  for(var i=0;i<(g.trailPoints||[]).length;i++){
   var p=g.trailPoints[i],r=Number(p.halfWidth||6);
   for(var x=Math.floor((p.x-r)/8);x<=Math.floor((p.x+r)/8);x++)for(var z=Math.floor((p.z-r)/8);z<=Math.floor((p.z+r)/8);z++){
    var k=x+','+z;if(!result.grid[k])result.grid[k]=[];result.grid[k].push({x:p.x,z:p.z,r:r});
   }
  }return result;
 }
 function trail(g,p){var rows=g.grid[Math.floor(p.x/8)+','+Math.floor(p.z/8)]||[];for(var i=0;i<rows.length;i++){var q=rows[i],dx=p.x-q.x,dz=p.z-q.z;if(dx*dx+dz*dz<=q.r*q.r)return true;}return false;}
 function zone(g,p){
  var s=g.spawn;
  if(g.dynamicBoss){var dx=p.x-g.dynamicBoss.x,dz=p.z-g.dynamicBoss.z;if(dx*dx+dz*dz<=676)return'boss';}
  if(inside(p,s.bossBounds))return'boss';if(inside(p,s.sealedBounds))return'sealed';
  if(inside(p,s.sanctuaryBounds))return'town';
  if(!inside(p,s.forestBounds))return'outside';
  if(inside(p,s.eastSafeBounds)||trail(g,p))return'trail';
  if(inside(p,s.deepBounds))return'deep';if(inside(p,s.southBounds))return'south';return'forest';
 }
 function decide(c,g,roll,admission){
  var allow={cancel:false,scale:1,zone:'outside',reason:'outside'};
  if(!c.verified||c.dimension!=='minecraft:overworld'||!c.mob)return allow;
  var why=String(c.spawnReason||'').toUpperCase();
  if(!why||['COMMAND','SPAWN_EGG','DISPENSER','BREEDING','CONVERSION','BUCKET'].indexOf(why)>=0||c.scripted||c.npc){allow.reason='explicit_or_saved';return allow;}
  var z=zone(g,c);allow.zone=z;
  function deny(reason){return{cancel:true,scale:1,zone:z,reason:reason};}
  if(z==='outside')return allow;
  if(z==='boss'||z==='sealed')return deny('arena_or_sealed_no_natural_mobs');
  if(z==='town'||z==='trail')return c.hostile||c.dangerous?deny('safe_no_hostiles'):allow;
  if(c.id==='minecraft:creeper')return deny('forest_no_creepers');
  if(c.dangerous||String(c.id).indexOf('mowziesmobs:')===0)return deny('forest_no_dangerous_or_wild_bosses');
  if(z==='south'){
   if(!c.hostile)return allow;
   var day=((Number(c.dayTime)%24000)+24000)%24000;
   if(day<12500)return deny('south_day_peaceful');
   if(['minecraft:zombie','minecraft:skeleton','minecraft:spider'].indexOf(c.id)<0)return deny('south_night_basic_only');
   if(admission&&roll>=0.35)return deny('south_night_sparse');
   allow.scale=0.8;allow.reason='south_night_beginner';return allow;
  }
  if(z==='deep'){
   if(c.hostile&&['minecraft:zombie','minecraft:skeleton','minecraft:spider','minecraft:cave_spider'].indexOf(c.id)<0)return deny('deep_standard_monsters_only');
   if(!c.hostile&&admission&&roll>=0.45)return deny('deep_sparse_wildlife');
  }
  return allow;
 }
 return{compile:compile,inside:inside,zone:zone,trail:trail,decide:decide};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FCraftSerdinSpawn97;
if(typeof global!=='undefined'&&global.FRankDays&&typeof ServerEvents!=='undefined')(function(){
 var F=global.FRankDays,cached=null,cachedServer=null,compiled=null,lastAltarTick=-Infinity;
 F.SERDIN_SPAWN_POLICY_V97=FCraftSerdinSpawn97;
 var Registry97=Java.loadClass('net.minecraft.core.registries.BuiltInRegistries');
 var Monster97=Java.loadClass('net.minecraft.world.entity.monster.Monster');
 var Attributes97=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes');
 var Modifier97=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),Operation97=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation'),UUID97=Java.loadClass('java.util.UUID');
 var healthScaleId97=UUID97.fromString('f9c29700-0000-4000-8000-00000000a001'),attackScaleId97=UUID97.fromString('f9c29700-0000-4000-8000-00000000a002');
 function geometry(server){
  var g=F.getSerdinV97Layout?F.getSerdinV97Layout(server):null;if(!g)return null;
  if(cached!==g||!F.sameFcraftServer(cachedServer,server)){compiled=FCraftSerdinSpawn97.compile(g);cached=g;cachedServer=server;lastAltarTick=-Infinity;}
  var tick=Number(server.overworld().getTime());
  if(tick<lastAltarTick||tick-lastAltarTick>=20){
   lastAltarTick=tick;var altar=F.getFcraftExistingBossAltar?F.getFcraftExistingBossAltar(server):null;
   compiled.dynamicBoss=altar&&isFinite(Number(altar.x))&&isFinite(Number(altar.z))?{x:Number(altar.x),z:Number(altar.z)}:null;
  }return compiled;
 }
 F.refreshSerdinSpawnGeometryV97=function(){cached=null;cachedServer=null;compiled=null;lastAltarTick=-Infinity;};
 function levelOf(e){var l=e.getLevel();return l.getLevel?l.getLevel():l;}
 function managed(level){return !!(level&&String(level.dimension)==='minecraft:overworld'&&level.server&&geometry(level.server));}
 function context(entity,level,reason){
  var id=String(Registry97.ENTITY_TYPE.getKey(entity.getEntityType())),category=String(entity.getEntityType().getCategory()).toLowerCase();
  var tags=entity.getTags(),scripted=tags.contains('f_rank_npc'),iterator=tags.iterator();
  while(iterator.hasNext()){var tag=String(iterator.next());if(tag==='f_rank_altar_boss'||tag.indexOf('f_rank_outpost_')===0||tag.indexOf('fcraft_outpost_')===0||tag.indexOf('f_rank_wrought')===0||tag.indexOf('f_rank_boss')===0||tag.indexOf('frank_boss')===0)scripted=true;}
  return{verified:true,dimension:String(level.dimension),mob:!!entity.isLiving(),npc:id==='customnpcs:customnpc',scripted:scripted,id:id,x:Number(entity.x),z:Number(entity.z),dayTime:Number(level.getDayTime()),spawnReason:String(reason),hostile:category==='monster'||entity instanceof Monster97,dangerous:F.BRION_BLOCKED_DANGER_MOBS.indexOf(id)>=0||id.indexOf('born_in_chaos_v1:')===0};
 }
 function runtime(server){var r=global.FCraftSerdinSpawnRuntime97;if(!r||!(r.server===server||r.server&&r.server.equals&&r.server.equals(server))){r={server:server,pending:{}};global.FCraftSerdinSpawnRuntime97=r;}return r;}
 function decision(e,admission){
  var level=levelOf(e);if(!managed(level))return null;var c=context(e.getEntity(),level,e.getSpawnType()),g=geometry(level.server),base=FCraftSerdinSpawn97.decide(c,g,0,false);
  var needsRoll=admission&&!base.cancel&&(base.zone==='south'&&base.scale===0.8||base.zone==='deep'&&!c.hostile);
  return{context:c,level:level,result:needsRoll?FCraftSerdinSpawn97.decide(c,g,Number(level.random.nextDouble()),true):base};
 }
 F.shouldHandleSerdinSpawnV97=function(server){return !!geometry(server);};
 F.onSerdinSpawnPositionV97=function(e){var d=decision(e,false);if(d&&d.result.cancel)e.setResult(Java.loadClass('net.minecraftforge.eventbus.api.Event$Result').DENY);};
 F.onSerdinSpawnFinalizeV97=function(e){
  var d=decision(e,true);if(!d)return;
  if(d.result.cancel){e.setSpawnCancelled(true);return;}
  var entity=e.getEntity(),r=runtime(d.level.server),tick=Number(d.level.getTime()),key=String(entity.uuid);
  for(var k in r.pending)if(r.pending[k].until<tick)delete r.pending[k];
  r.pending[key]={result:d.result,reason:d.context.spawnReason,until:tick+2};
 };
 F.onSerdinSpawnedV97=function(event){
  var entity=event.entity,level=event.level;if(!entity||!managed(level))return null;
  var r=runtime(level.server),key=String(entity.uuid),row=r.pending[key];if(!row)return null;delete r.pending[key];
  if(row.until<Number(level.getTime()))return null;
  var c=context(entity,level,row.reason),d=FCraftSerdinSpawn97.decide(c,geometry(level.server),0,false);
  if(d.cancel)return d;
  if(row.result.scale===0.8&&!entity.persistentData.getBoolean('fcraft_serdin_beginner_scaled_v97')){
   var hp=entity.getAttribute(Attributes97.MAX_HEALTH),attack=entity.getAttribute(Attributes97.ATTACK_DAMAGE);
   // MULTIPLY_TOTAL also scales equipment/additive bonuses applied after spawn.
   // Base-only changes would leave an armed zombie stronger than the intended0.8.
   if(hp&&!hp.getModifier(healthScaleId97)){hp.addPermanentModifier(new Modifier97(healthScaleId97,'fcraft.serdin.beginner.health',-0.2,Operation97.MULTIPLY_TOTAL));entity.setHealth(Math.min(Number(entity.health)*0.8,Number(entity.maxHealth)));}
   if(attack&&!attack.getModifier(attackScaleId97))attack.addPermanentModifier(new Modifier97(attackScaleId97,'fcraft.serdin.beginner.attack',-0.2,Operation97.MULTIPLY_TOTAL));
   entity.persistentData.putBoolean('fcraft_serdin_beginner_scaled_v97',true);
  }return d;
 };
 // Only newly finalized entities exist in the transient pending table. Saved mobs
 // receive no new admission roll, cancellation or repeated attribute scaling.
 EntityEvents.spawned(function(event){var result=F.onSerdinSpawnedV97(event);if(result&&result.cancel)event.cancel();});
 F.shouldGuardSerdinExplosionV97=managed;
 F.shouldCancelOverworldMobSpawnV86=function(server,entityId,x,z,spawnType,extra){
  var g=geometry(server);if(!g)return false;var c=extra||{};c.verified=true;c.dimension='minecraft:overworld';c.mob=true;c.id=String(entityId);c.x=Number(x);c.z=Number(z);c.spawnReason=spawnType;c.dayTime=c.dayTime===undefined?Number(server.overworld().getDayTime()):c.dayTime;
  if(c.hostile===undefined)c.hostile=F.VANILLA_HOSTILE_MOBS.indexOf(c.id)>=0;if(c.dangerous===undefined)c.dangerous=F.BRION_BLOCKED_DANGER_MOBS.indexOf(c.id)>=0;
  return FCraftSerdinSpawn97.decide(c,g,0,false).cancel;
 };
})();
