// Shared v9.7 arena geometry. No building, spawning or player-save writes.
var FCraftArenaCoreV97=(function(){
 function finite(n){return typeof n==='number'&&isFinite(n);}
 function xyz(p){return!!p&&finite(p.x)&&finite(p.y)&&finite(p.z);}
 function clone(o){return JSON.parse(JSON.stringify(o));}
 var policies={outpost:{radius:18,soft:16.2,hard:19.2,attack:19.5,presence:20,vertical:32,warnMs:5000,resetMs:15000,push:.46},boss:{radius:24,soft:21.8,hard:25.5,attack:25.5,presence:26,vertical:32,warnMs:5000,resetMs:15000,push:.46}};
 function policy(kind){return clone(policies[kind]||policies.outpost);}
 function sameDimension(a,b){return!!a&&!!b&&typeof a.dimension==='string'&&a.dimension===b.dimension;}
 function inside(p,c,r,vertical){return xyz(p)&&xyz(c)&&sameDimension(p,c)&&Math.abs(p.y-c.y)<=vertical&&Math.pow(p.x-c.x,2)+Math.pow(p.z-c.z,2)<=r*r;}
 function leash(p,c,rules,safe){
  if(!xyz(p)||!xyz(c)||!xyz(safe))return{action:'invalid'};
  if(!sameDimension(p,c))return{action:'wrong_dimension'};
  var dx=p.x-c.x,dz=p.z-c.z,d=Math.sqrt(dx*dx+dz*dz);
  if(d>rules.hard||Math.abs(p.y-c.y)>rules.vertical)return{action:'hard_snapback',distance:d,point:clone(safe)};
  if(d>=rules.soft&&d>.001)return{action:'soft_pushback',distance:d,vx:-dx/d*rules.push,vy:.08,vz:-dz/d*rules.push};
  return{action:'inside',distance:d};
 }
 function presence(previous,players,c,rules,now){
  var st={emptySince:previous&&previous.emptySince!==undefined?previous.emptySince:null,warned:!!(previous&&previous.warned),count:0,warning:false,reset:false};
  for(var i=0;i<(players||[]).length;i++){var p=players[i];if(p.alive===true&&!p.spectator&&!p.creative&&inside(p,c,rules.presence,rules.vertical))st.count++;}
  if(st.count){st.emptySince=null;st.warned=false;return st;}
  if(st.emptySince===null||!finite(st.emptySince)||now<st.emptySince){st.emptySince=now;st.warned=false;}
  var elapsed=now-st.emptySince;if(elapsed>=rules.resetMs)st.reset=true;
  else if(!st.warned&&elapsed>=rules.warnMs){st.warned=true;st.warning=true;}
  return st;
 }
 function outsideAttack(p,c,rules){return!inside(p,c,rules.attack,rules.vertical);}
 function ring(c,radius){
  if(!xyz(c)||!finite(radius)||radius<=0)return[];
  // Rhino's built-in Math is available in KubeJS; java.lang.Math is class-filtered.
  var out=[];
  for(var i=0;i<28;i++){var a=6.283185307179586*i/28;out.push({x:c.x+Math.cos(a)*radius,y:c.y+.25,z:c.z+Math.sin(a)*radius});}
  return out;
 }
 return{finite:finite,xyz:xyz,policy:policy,inside:inside,leash:leash,presence:presence,outsideAttack:outsideAttack,ring:ring};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=FCraftArenaCoreV97;
if(typeof global!=='undefined'&&global.FRankDays)(function(F,A){
 F.ARENA_CORE_V97=A;
 function level(server,c){if(!server||!c)return null;return c.dimension==='minecraft:overworld'?server.overworld():server.getLevel(String(c.dimension));}
 function dim(entity){return String(entity&&entity.level&&entity.level.dimension||'');}
 function each(list,fn){if(!list)return;var n=typeof list.size==='function'?Number(list.size()):Number(list.length||0);for(var i=0;i<n;i++)fn(typeof list.get==='function'?list.get(i):list[i]);}
 F.getArenaPlayersV97=function(server){var out=[];each(server&&server.players,function(p){out.push({uuid:String(p.uuid),x:Number(p.x),y:Number(p.y),z:Number(p.z),dimension:dim(p),alive:!!(p.isAlive&&p.isAlive())&&Number(p.health)>0,spectator:!!(p.isSpectator&&p.isSpectator()),creative:!!p.creative,raw:p});});return out;};
 F.getArenaPolicyV97=A.policy;
 F.listArenaEntitiesV97=function(server,c,radius){var ow=level(server,c);if(!ow)return[];var B=Java.loadClass('net.minecraft.world.phys.AABB'),out=[];each(ow.getEntitiesWithin(new B(c.x-radius,c.y-32,c.z-radius,c.x+radius,c.y+32,c.z+radius)),function(e){out.push(e);});return out;};
 F.applyArenaActionV97=function(server,entity,c,action){
  if(!entity||dim(entity)!==c.dimension)return{action:'wrong_dimension'};
  if(action.action==='hard_snapback'){
   var id=String(entity.uuid),p=action.point;if(!/^[a-fA-F0-9-]{36}$/.test(id)||!A.xyz(p))return{action:'invalid'};
   // Vec3 command arguments center integer X/Z literals by half a block.
   // Decimal literals keep the surveyed safe point exact on both axes.
   var success=server.runCommandSilent('execute in '+c.dimension+' run tp '+id+' '+Number(p.x).toFixed(4)+' '+Number(p.y).toFixed(4)+' '+Number(p.z).toFixed(4));
   if(Number(success)<=0)return{action:'snap_failed'};entity.fallDistance=0;entity.setMotionX(0);entity.setMotionY(0);entity.setMotionZ(0);
  }else if(action.action==='soft_pushback'){entity.setMotionX(action.vx);entity.setMotionY(action.vy);entity.setMotionZ(action.vz);}
  return action;
 };
 F.applyArenaSoftLeashToEntityV86=function(server,e,c,soft,hard,safe){var p=A.policy('outpost');p.soft=Number(soft);p.hard=Number(hard);safe=safe||{x:c.x+4,y:c.y+.1,z:c.z};return F.applyArenaActionV97(server,e,c,A.leash({x:Number(e.x),y:Number(e.y),z:Number(e.z),dimension:dim(e)},c,p,safe));};
 F.renderArenaBoundaryRingV86=function(server,c,radius,particle){
  var ow=level(server,c);if(!ow)return 0;var names={'minecraft:soul_fire_flame':'SOUL_FIRE_FLAME','minecraft:soul':'SOUL','minecraft:crit':'CRIT'},name=names[particle]||'SOUL_FIRE_FLAME',type=Java.loadClass('net.minecraft.core.particles.ParticleTypes')[name],points=A.ring(c,Number(radius));
  for(var i=0;i<points.length;i++){var p=points[i];ow.sendParticles(type,p.x,p.y,p.z,1,.025,.06,.025,0);}
  return points.length;
 };
 F.arenaAttackDecisionV97=function(target,source){
  if(!target||!source)return{blocked:false};var server=target.server||target.level&&target.level.server;if(!server)return{blocked:false};
  var arena=F.getOutpostArenaTargetV97?F.getOutpostArenaTargetV97(server,target):null;
  if(!arena&&F.getBossArenaTargetV97)arena=F.getBossArenaTargetV97(server,target);if(!arena)return{blocked:false};
  var attacker=source.actual||source.player||null;if(!attacker&&source.getEntity)attacker=source.getEntity();
  if(!attacker||!attacker.isPlayer||!attacker.isPlayer())return{blocked:false};
  var p={x:Number(attacker.x),y:Number(attacker.y),z:Number(attacker.z),dimension:dim(attacker)},blocked=A.outsideAttack(p,arena.center,A.policy(arena.kind));return{blocked:blocked,kind:arena.kind,site:arena.id||'boss'};
 };
 F.shouldBlockArenaNativeAttackV97=function(event){return F.arenaAttackDecisionV97(event.getEntity(),event.getSource()).blocked;};
})(global.FRankDays,FCraftArenaCoreV97);
