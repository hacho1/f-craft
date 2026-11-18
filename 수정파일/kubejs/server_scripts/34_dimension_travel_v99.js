// Portal travel belongs to this world. Personal progress never comes from a
// shared FTB team, a held permit, or a generic dimension teleport.
var FCraftTravelV99=(function(){
 var MAIN='f_rank_days:mainland_wilds',NETHER='minecraft:the_nether',END='minecraft:the_end',OVER='minecraft:overworld';
 function mode(from,to,contact){
  if(contact==='nether'&&from===OVER&&to===NETHER)return 'island_block';
  if(contact==='nether'&&from===MAIN&&to===NETHER)return 'main_nether';
  if(contact==='nether'&&from===NETHER&&to===OVER)return 'nether_return';
  if(contact==='end'&&from===MAIN&&to===END)return 'main_end';
  if(contact==='end'&&from===END&&to===OVER)return 'end_return';
  return null;
 }
 function returnPoint(last,source){return last&&last.dimension===MAIN&&isFinite(last.x)&&isFinite(last.y)&&isFinite(last.z)?{dimension:MAIN,x:Number(last.x),y:Number(last.y),z:Number(last.z),source:'saved_portal'}:{dimension:MAIN,x:Math.floor(source.x*8)+.5,y:Math.max(64,Math.min(240,Number(source.y))),z:Math.floor(source.z*8)+.5,source:'scaled_nether'};}
 function validEntry(pending,from,to,tick){return !!(pending&&pending.from===from&&pending.to===to&&Number(pending.expiresAt)>=tick);}
 function scalar(value,label){if((typeof value!=='number'&&typeof value!=='string')||value==='')throw new Error('Unsupported numeric binding: '+label);var n=Number(value);if(!isFinite(n))throw new Error('Nonfinite numeric binding: '+label);return n;}
 function angle(p,methods,fields,label){
  for(var i=0;i<methods.length;i++)if(typeof p[methods[i]]==='function')return scalar(p[methods[i]](),label+' '+methods[i]);
  for(var j=0;j<fields.length;j++){var v=p[fields[j]];if(typeof v==='number'||typeof v==='string')return scalar(v,label+' '+fields[j]);}
  throw new Error('Unsupported player rotation bindings: '+label);
 }
 function view(p){return {yaw:angle(p,['getYaw','getYRot'],['yaw','yRot'],'yaw'),pitch:angle(p,['getPitch','getXRot'],['pitch','xRot'],'pitch')};}
 function vector(v){var result={};for(var k of ['x','y','z'])result[k]=scalar(typeof v[k]==='function'?v[k]():v[k],'Vec3.'+k);return result;}
 return {MAIN:MAIN,NETHER:NETHER,END:END,OVER:OVER,MAX_BORDER:59999968,mode:mode,returnPoint:returnPoint,validEntry:validEntry,viewRotation:view,vectorPoint:vector};
})();
if(typeof module!=='undefined')module.exports=FCraftTravelV99;
if(typeof global!=='undefined'&&global.FRankDays&&typeof ServerEvents!=='undefined')(function(){
 var F=global.FRankDays,T=FCraftTravelV99,KEY='f_rank_dimension_travel_v99',LAST='f_rank_last_mainland_portal',pendingReturns={},pendingFires={},pendingFireCount=0;
 var BlockPos=Java.loadClass('net.minecraft.core.BlockPos'),AABB=Java.loadClass('net.minecraft.world.phys.AABB'),Direction=Java.loadClass('net.minecraft.core.Direction'),Player=Java.loadClass('net.minecraft.world.entity.player.Player'),Height=Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types'),ResourceLocation=Java.loadClass('net.minecraft.resources.ResourceLocation');
 function now(server){return F.getPersistentWorldTickV96?Number(F.getPersistentWorldTickV96(server)):Number(server.overworld().getGameTime());}
 function valid(server){var l=F.getSerdinV94Layout?F.getSerdinV94Layout(server):null;return !!(l&&l.expansionVersion==='9.6');}
 function dim(p){return String(p.level.dimension);}
 function records(server){var raw=String(server.persistentData.getString(KEY));return raw?JSON.parse(raw):{};}
 function save(server,data){server.persistentData.putString(KEY,JSON.stringify(data));}
 function record(p){var all=records(p.server);return all[String(p.uuid)]||{};}
 function update(p,change){var all=records(p.server),id=String(p.uuid),s=all[id]||{};change(s);all[id]=s;save(p.server,all);return s;}
 function restoreLast(p){var r=record(p);if(r.lastPortal)p.persistentData.putString(LAST,JSON.stringify(r.lastPortal));}
 function source(p){return {dimension:dim(p),x:Number(p.x),y:Number(p.y),z:Number(p.z)};}
 function contact(p){
  var x=Math.floor(p.x),y=Math.floor(p.y),z=Math.floor(p.z),found=null;
  // The native travel event occurs while touching the actual portal blocks.
  // Commands and camp/sailing teleports in ordinary air do not match this.
  for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++)for(var dz=-1;dz<=1;dz++){
   var b=String(p.level.getBlock(x+dx,y+dy,z+dz).id);
   if(b==='minecraft:end_portal')return 'end';if(b==='minecraft:nether_portal')found='nether';
  }
  return found;
 }
 function stage(p,key){if(F.grantPlayerStageOnce)F.grantPlayerStageOnce(p,key);else p.stages.add(key);}
 function mark(p,type){var s=F.loadPlayerState(p),field=type==='nether'?'mainland_nether_visited_v99':'mainland_end_visited_v99';if(!s[field]){s[field]=true;F.savePlayerState(p,s);}stage(p,type==='nether'?'frank_v99_mainland_nether_entered':'frank_v99_mainland_end_entered');}
 function blockId(level,x,y,z){return String(level.getBlock(x,y,z).id);}
 function dangerous(id){return /minecraft:(lava|water|fire|soul_fire|magma_block|cactus|sweet_berry_bush|powder_snow)$/.test(id);}
 function safe(level,p,x,y,z){
  var bx=Math.floor(x),by=Math.floor(y),bz=Math.floor(z),floor=new BlockPos(bx,by-1,bz),feet=new BlockPos(bx,by,bz),head=new BlockPos(bx,by+1,bz);
  if(by<=Number(level.getMinBuildHeight())||by+2>=Number(level.getMaxBuildHeight()))return false;
  level.getChunk(bx>>4,bz>>4);
  if(dangerous(blockId(level,bx,by-1,bz))||dangerous(blockId(level,bx,by,bz))||dangerous(blockId(level,bx,by+1,bz)))return false;
  if(!level.getFluidState(feet).isEmpty()||!level.getFluidState(head).isEmpty())return false;
  if(!level.getBlockState(floor).isFaceSturdy(level,floor,Direction.UP))return false;
  return level.noCollision(p,new AABB(x-.31,y,z-.31,x+.31,y+1.81,z+.31));
 }
 function nearest(level,p,target){
  var x=Math.floor(target.x)+.5,z=Math.floor(target.z)+.5,y=Math.floor(target.y),offsets=[0,1,-1,2,-2,3,-3,4,-4,6,-6,8,-8];
  for(var radius=0;radius<=6;radius++)for(var dx=-radius;dx<=radius;dx++)for(var dz=-radius;dz<=radius;dz++){
   if(radius&&Math.max(Math.abs(dx),Math.abs(dz))!==radius)continue;
   for(var i=0;i<offsets.length;i++)if(safe(level,p,x+dx,y+offsets[i],z+dz))return {dimension:T.MAIN,x:x+dx,y:y+offsets[i],z:z+dz,source:target.source||'nearby'};
  }
  // A scaled fallback can be underground or in an ocean. Inspect bounded real
  // surface columns before considering any new safety platform.
  for(var r=0;r<=16;r+=4)for(var a=-r;a<=r;a+=4)for(var b=-r;b<=r;b+=4){
   if(r&&Math.max(Math.abs(a),Math.abs(b))!==r)continue;
   var gx=Math.floor(x+a),gz=Math.floor(z+b);level.getChunk(gx>>4,gz>>4);var h=Number(level.getHeight(Height.MOTION_BLOCKING_NO_LEAVES,gx,gz));
   if(safe(level,p,gx+.5,h,gz+.5))return {dimension:T.MAIN,x:gx+.5,y:h,z:gz+.5,source:'measured_surface'};
  }
  return null;
 }
 function platform(level,p,target){
  var x=Math.floor(target.x),z=Math.floor(target.z);level.getChunk(x>>4,z>>4);
  var surface=Number(level.getHeight(Height.MOTION_BLOCKING_NO_LEAVES,x,z)),start=Math.max(65,Math.floor(target.y),surface+2),end=Math.min(Number(level.getMaxBuildHeight())-3,start+48);
  for(var y=start;y<=end;y++){
   if(!level.noCollision(p,new AABB(x+.19,y,z+.19,x+.81,y+1.81,z+.81))||dangerous(blockId(level,x,y,z))||dangerous(blockId(level,x,y+1,z)))continue;
   var writable=true;
   for(var dx=-1;dx<=1;dx++)for(var dz=-1;dz<=1;dz++){
    var bx=x+dx,bz=z+dz;level.getChunk(bx>>4,bz>>4);
    var pos=new BlockPos(bx,y-1,bz),state=level.getBlockState(pos);
    if(!state.isAir())writable=false;
    if(F.shouldProtectWorldBlockV96&&F.shouldProtectWorldBlockV96(level,bx,y-1,bz,0))writable=false;
   }
   if(!writable)continue;
   // Nine support blocks only. Never clear an occupied head/body block.
   for(var sx=-1;sx<=1;sx++)for(var sz=-1;sz<=1;sz++)level.getBlock(x+sx,y-1,z+sz).set('minecraft:obsidian');
   if(safe(level,p,x+.5,y,z+.5))return {dimension:T.MAIN,x:x+.5,y:y,z:z+.5,source:'nine_block_safety_platform'};
  }
  return null;
 }
 function landing(p,target){var level=p.server.getLevel(T.MAIN);if(!level)return null;return nearest(level,p,target)||platform(level,p,target);}
 function port(p){
  var sites=F.getMainlandLandmarksV96?F.getMainlandLandmarksV96(p.server):[];
  for(var i=0;i<sites.length;i++)if(sites[i].id==='arvern_port_keep'&&sites[i].built)return {dimension:T.MAIN,x:sites[i].x+.5,y:sites[i].y+1,z:sites[i].z+10.5,source:'actual_port'};
  return null;
 }
 function bed(p){
  if(String(p.getRespawnDimension().location())!==T.MAIN)return null;
  var pos=p.getRespawnPosition(),level=p.server.getLevel(T.MAIN);if(!pos||!level)return null;
  level.getChunk(pos.getX()>>4,pos.getZ()>>4);
  if(!/_bed$/.test(blockId(level,pos.getX(),pos.getY(),pos.getZ())))return null;
  var found=Player.findRespawnPositionAndUseSpawnBlock(level,pos,p.getRespawnAngle(),false,true);
  if(!found.isPresent())return null;var v=T.vectorPoint(found.get());return safe(level,p,v.x,v.y,v.z)?{dimension:T.MAIN,x:v.x,y:v.y,z:v.z,source:'valid_mainland_bed'}:null;
 }
 function endTarget(p){
  var personal=bed(p);if(personal)return personal;
  var target=port(p);if(!target&&F.ensureMainlandLandmarksV96){F.ensureMainlandLandmarksV96(p.server);target=port(p);}
  return target?landing(p,target):null;
 }
 function move(p,target,reason){
  if(!target)return {ok:false,reason:'no_safe_mainland_landing'};
  var level=p.server.getLevel(T.MAIN);if(!level)return {ok:false,reason:'mainland_not_loaded'};
  pendingReturns[String(p.uuid)]=true;
  try{
   // KubeJS exposes a same-arity ResourceLocation extension; select it with
   // an explicit type instead of an ambiguous ServerLevel first argument.
   var rotation=T.viewRotation(p);p.teleportTo(new ResourceLocation(T.MAIN),target.x,target.y,target.z,rotation.yaw,rotation.pitch);
   p.setPortalCooldown(300);p.fallDistance=0;p.setMotionX(0);p.setMotionY(0);p.setMotionZ(0);
   restoreLast(p);update(p,function(s){delete s.entry;delete s.endReturn;s.lastReturn={reason:reason,at:now(p.server),x:target.x,y:target.y,z:target.z,source:target.source};});
   return {ok:dim(p)===T.MAIN,dimension:dim(p),target:target};
  }finally{delete pendingReturns[String(p.uuid)];}
 }
 function queueReturn(p,kind,sourcePos){
  var id=String(p.uuid);if(pendingReturns[id])return;pendingReturns[id]=true;
  p.server.scheduleInTicks(1,function(){
   delete pendingReturns[id];
   try{
    if(!p.isAlive())return;
    var r=record(p),target=kind==='end'?endTarget(p):landing(p,T.returnPoint(r.lastPortal,sourcePos));
    var result=move(p,target,kind==='end'?'end_exit':'nether_portal');
    if(!result.ok)p.tell('§e[차원 항로] §f안전한 본토 도착 지점을 찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
   }catch(error){console.error('[F-Craft v99] Safe portal return failed: '+String(error));p.tell('§e[차원 항로] §f귀환 지점을 준비하지 못했습니다. 원래 지형과 건축물은 보존했습니다.');}
  });
 }
 // Vanilla1.20.1 BaseFireBlock only recognizes the built-in Overworld/Nether
 // dimension keys. A genuine fire placement in this custom overworld needs
 // the same native shape + Forge cancellation path, after placement settles.
 F.afterFrontierFireNotifyV99=function(level,pos){
  if(!level||level.isClientSide()||String(level.dimension)!==T.MAIN||!valid(level.server))return;
  var x=pos.getX(),y=pos.getY(),z=pos.getZ(),id=blockId(level,x,y,z);
  if(id!=='minecraft:fire'&&id!=='minecraft:soul_fire')return;
  var adjacent=false;for(var d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])if(blockId(level,x+d[0],y+d[1],z+d[2])==='minecraft:obsidian')adjacent=true;
  if(!adjacent)return;
  var key=x+','+y+','+z;if(pendingFires[key]||pendingFireCount>=64)return;pendingFires[key]=true;pendingFireCount++;
  level.server.scheduleInTicks(1,function(){
   delete pendingFires[key];pendingFireCount--;
   var current=blockId(level,x,y,z);if(current!=='minecraft:fire'&&current!=='minecraft:soul_fire')return;
   var Shape=Java.loadClass('net.minecraft.world.level.portal.PortalShape'),Axis=Java.loadClass('net.minecraft.core.Direction$Axis'),Factory=Java.loadClass('net.minecraftforge.event.ForgeEventFactory'),at=new BlockPos(x,y,z);
   var shape=Shape.findEmptyPortalShape(level,at,Axis.X);if(!shape.isPresent())shape=Shape.findEmptyPortalShape(level,at,Axis.Z);
   if(!shape.isPresent())return;
   // The actual PortalSpawnEvent remains authoritative for every Forge mod.
   var allowed=Factory.onTrySpawnPortal(level,at,shape);if(allowed.isPresent())allowed.get().createPortalBlocks();
  });
 };
 F.shouldBlockIslandNetherPortalV99=function(level){return !!(level&&!level.isClientSide()&&String(level.dimension)===T.OVER&&valid(level.server));};
 F.beforeDimensionTravelV99=function(p,to){
  if(!valid(p.server)||pendingReturns[String(p.uuid)])return false;
  var from=dim(p),kind=T.mode(from,to,contact(p));if(!kind)return false;
  if(kind==='island_block'){p.tell('§e[길드 안내] §f네더·엔드 차원문 개척은 본토 오버월드의 수몰 심연령 또는 자유 야생에서 진행할 수 있습니다.');return true;}
  var point=source(p);
  if(kind==='main_nether'||kind==='main_end'){
   update(p,function(s){if(kind==='main_nether'){s.lastPortal=point;p.persistentData.putString(LAST,JSON.stringify(point));}s.entry={from:from,to:to,expiresAt:now(p.server)+100,kind:kind};});return false;
  }
  if(kind==='nether_return'){queueReturn(p,'nether',point);return true;}
  // Keep vanilla End completion and credits. The trusted End-conquered
  // respawn event resolves the new player instance after the credits packet.
  update(p,function(s){s.endReturn={from:from,at:now(p.server)};});return false;
 };
 F.afterDimensionTravelV99=function(p,from,to){
  if(!valid(p.server)||pendingReturns[String(p.uuid)])return;
  var r=record(p);
  if(T.validEntry(r.entry,from,to,now(p.server))){if(from===T.MAIN&&to===T.NETHER)mark(p,'nether');if(from===T.MAIN&&to===T.END)mark(p,'end');update(p,function(s){delete s.entry;});}
  if(from===T.END&&to===T.OVER&&r.endReturn)queueReturn(p,'end',null);
 };
 F.afterDimensionRespawnV99=function(p,endConquered){if(!valid(p.server))return;restoreLast(p);if(endConquered)queueReturn(p,'end',null);};
 F.getMainlandPortalProgressV99=function(p){var s=F.loadPlayerState(p);return {nether:!!s.mainland_nether_visited_v99,end:!!s.mainland_end_visited_v99,netherVisited:!!s.mainland_nether_visited_v99,endVisited:!!s.mainland_end_visited_v99,lastPortal:record(p).lastPortal||null,lastReturn:record(p).lastReturn||null};};
 F.getMainlandTravelRecordV99=record;
 F.findSafeMainlandLandingV99=landing;
 F.findValidMainlandBedV99=bed;
 F.resolveMainlandEndReturnV99=endTarget;
 F.blockIslandPortalUseV99=function(p){return valid(p.server)&&dim(p)===T.OVER;};
 F.ensureFrontierBordersV99=function(server){
  if(!valid(server)||server.persistentData.getBoolean('f_rank_v99_borders_migrated'))return;
  var journal=[];
  for(var id of [T.MAIN,T.NETHER,T.END]){var level=server.getLevel(id);if(!level)throw new Error('Required frontier dimension unavailable: '+id);var b=level.getWorldBorder(),before={size:Number(b.getSize()),x:Number(b.getCenterX()),z:Number(b.getCenterZ())};b.setCenter(0,0);b.setSize(T.MAX_BORDER);journal.push({dimension:id,before:before,after:{size:Number(b.getSize()),x:Number(b.getCenterX()),z:Number(b.getCenterZ())}});}
  server.persistentData.putString('f_rank_v99_border_migration',JSON.stringify(journal));server.persistentData.putBoolean('f_rank_v99_borders_migrated',true);
 };
 BlockEvents.rightClicked(function(e){
  if(!e.player||!F.blockIslandPortalUseV99(e.player)||String(e.block.id)!=='minecraft:obsidian')return;
  var id=String(e.item.id);if(id!=='minecraft:flint_and_steel'&&id!=='minecraft:fire_charge')return;
  e.player.tell('§e[길드 안내] §f네더·엔드 차원문 개척은 본토 오버월드의 수몰 심연령 또는 자유 야생에서 진행할 수 있습니다.');e.cancel();
 });
 PlayerEvents.loggedIn(function(e){if(valid(e.server))restoreLast(e.player);});
 ServerEvents.loaded(function(e){F.ensureFrontierBordersV99(e.server);});
})();
