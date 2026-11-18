// Stage3 candidate. Kept outside product until ROOT authorizes activation.
var FCraftOfficialWaystonesV110=(function(){
 var OW='minecraft:overworld',MAIN='f_rank_days:mainland_wilds',SAN='f_rank_days:guardian_sanctum';
 var rows=[
  {id:'brion_plaza',name:'브리온 중앙 광장',dimension:OW,dx:4,dz:-6,style:'DEFAULT'},
  {id:'brion_south',name:'브리온 남항 선착장',dimension:OW,dx:3,dz:92,style:'DEFAULT'},
  {id:'brion_north',name:'브리온 북문 선착장',dimension:OW,dx:8,dz:-82,style:'MOSSY'},
  {id:'serdin_junction',name:'세르딘 초입 삼거리',dimension:OW,dx:6,dz:-208,style:'MOSSY'},
  {id:'mainland_port',name:'[제1지역] 아르베른 전초 항구령',dimension:MAIN,x:0,z:0,style:'DEFAULT',legacySite:'arvern_port_keep'},
  {id:'mainland_north',name:'[제2지역] 칼레온 만년설 성채령',dimension:MAIN,x:0,z:-1200,style:'DEEPSLATE',legacySite:'caleon_citadel'},
  {id:'mainland_east',name:'[제3지역] 황금들판 대교역 초소령',dimension:MAIN,x:1100,z:250,style:'SANDY',legacySite:'goldenvale_outpost'},
  {id:'mainland_west',name:'[제4지역] 잿빛 성좌의 고원 마탑령',dimension:MAIN,x:-1100,z:-300,style:'DEEPSLATE',legacySite:'ashen_mage_spire'},
  {id:'mainland_south',name:'[제5지역] 가라앉은 고대 아성 심연령',dimension:MAIN,x:0,z:1350,style:'MOSSY',legacySite:'sunken_ancient_keep'}
 ];
 function copy(v){return JSON.parse(JSON.stringify(v));}
 function distance2(a,b){var x=Number(a.x)-Number(b.x),y=Number(a.y)-Number(b.y),z=Number(a.z)-Number(b.z);return x*x+y*y+z*z;}
 function plan(anchor){var out=copy(rows);for(var i=0;i<out.length;i++){var r=out[i];if(r.dimension===OW){r.x=Number(anchor.x)+r.dx;r.z=Number(anchor.z)+r.dz;}r.nominalX=r.x;r.nominalZ=r.z;}return out;}
 function offsets(){var out=[];for(var x=-12;x<=12;x++)for(var z=-12;z<=12;z++)if(x*x+z*z<=144)out.push({x:x,z:z,d:x*x+z*z});out.sort(function(a,b){return a.d-b.d||Math.abs(a.z)-Math.abs(b.z)||a.x-b.x||a.z-b.z;});return out;}
 function stateUnlocked(s){return !!s&&s.mainland_sailing_unlocked===true;}
 function constructionGate(arena,sanctum,server){var apis=[arena,sanctum],names=['arena','sanctum'],plans=[];for(var i=0;i<apis.length;i++){var api=apis[i];if(!api||typeof api.isComplete!=='function'||typeof api.plan!=='function')return{ok:false,reason:names[i]+'_builder_readiness_api_missing'};try{if(api.isComplete(server)!==true)return{ok:false,reason:names[i]+'_construction_incomplete'};var p=api.plan();if(!p||!Array.isArray(p.ops)||!p.ops.length||typeof p.signature!=='string'||!p.signature.length)return{ok:false,reason:names[i]+'_approved_plan_missing'};plans.push(p);}catch(e){return{ok:false,reason:names[i]+'_readiness_error'};}}return{ok:true,arena:plans[0],sanctum:plans[1]};}
 function reservedIndex(gate){if(!gate||gate.ok!==true)throw new Error('authoritative_construction_not_ready');var out={},ps=[gate.arena,gate.sanctum],ds=[OW,SAN];for(var i=0;i<ps.length;i++)for(var j=0;j<ps[i].ops.length;j++){var p=ps[i].ops[j];if(!p||!isFinite(p.x)||!isFinite(p.y)||!isFinite(p.z)||p.x%1||p.y%1||p.z%1||typeof p.state!=='string')throw new Error('invalid_authoritative_reserved_cell');out[ds[i]+'|'+p.x+','+p.y+','+p.z]=copy(p);}return out;}
 function reservedAt(index,dimension,x,y,z){return !!index[dimension+'|'+x+','+y+','+z];}
 function surveyBase(spec,measured){var use=spec.dimension===MAIN&&measured&&measured.built&&isFinite(Number(measured.x))&&isFinite(Number(measured.z));return{x:use?Number(measured.x):Number(spec.nominalX),z:use?Number(measured.z):Number(spec.nominalZ),reason:use?'preserve_existing_measured_fort':'design_nominal',siteId:use?String(measured.id):null,documentNominal:{x:Number(spec.nominalX),z:Number(spec.nominalZ)}};}
 function fortFootprint(s){var r=s.kind==='citadel'?23:s.kind==='tower'?12:18;return{minX:s.x-r-5,maxX:s.x+r+5,minZ:s.z-r-5,maxZ:s.z+r+(s.kind==='port'?23:10)};}
 function outsideFort(s,p){var b=fortFootprint(s);return p.x<b.minX||p.x>b.maxX||p.z<b.minZ||p.z>b.maxZ;}
 function accentPlan(s,o){var out=[],id=s.id;function put(x,y,z,b){out.push({x:o.x+x,y:o.y+y,z:o.z+z,id:b});}
  var radius=id==='ashen_mage_spire'||id==='sunken_ancient_keep'?1:2;
  for(var x=-radius;x<=radius;x++)for(var z=-radius;z<=radius;z++){var floor=id==='caleon_citadel'?((x+z)%2?'minecraft:polished_deepslate':'minecraft:deepslate_bricks'):id==='goldenvale_outpost'?(Math.abs(x)===2||Math.abs(z)===2?'minecraft:acacia_planks':x===0&&z===0?'minecraft:water':'minecraft:farmland[moisture=7]'):id==='ashen_mage_spire'?'minecraft:polished_basalt[axis=y]':((x+z)%2?'minecraft:mossy_stone_bricks':'minecraft:prismarine_bricks');put(x,0,z,floor);if(id==='goldenvale_outpost'&&Math.abs(x)<2&&Math.abs(z)<2&&(x!==0||z!==0))put(x,1,z,'minecraft:wheat[age=7]');}
  for(var dx of [-radius,radius])for(var dz of [-radius,radius]){if(id==='caleon_citadel'){put(dx,1,dz,'minecraft:packed_ice');put(dx,2,dz,'minecraft:snow_block');}else if(id==='goldenvale_outpost'){put(dx,1,dz,'minecraft:acacia_fence');put(dx,2,dz,'minecraft:lantern');}else if(id==='ashen_mage_spire'){put(dx,1,dz,'minecraft:basalt[axis=y]');put(dx,2,dz,'minecraft:amethyst_block');}else{put(dx,1,dz,'minecraft:prismarine_bricks');put(dx,2,dz,'minecraft:sea_lantern');}}
  if(id==='ashen_mage_spire')put(0,1,0,'minecraft:amethyst_cluster[facing=up,waterlogged=false]');return out;
 }
 return{OW:OW,MAIN:MAIN,SAN:SAN,definitions:copy(rows),plan:plan,offsets:offsets,distance2:distance2,stateUnlocked:stateUnlocked,surveyBase:surveyBase,fortFootprint:fortFootprint,outsideFort:outsideFort,accentPlan:accentPlan,constructionGate:constructionGate,reservedIndex:reservedIndex,reservedAt:reservedAt};
})();
if(typeof module!=='undefined')module.exports=FCraftOfficialWaystonesV110;
if(typeof global!=='undefined'&&global.FRankDays&&typeof ServerEvents!=='undefined')(function(){
 var F=global.FRankDays,C=FCraftOfficialWaystonesV110,KEY='f_rank_official_waystones_v110',scheduled=false,stableScheduled=false,themesScheduled=false,constructionRetryPending=false,reservedCache=null,reservedSignature='',backoffs={},tick=0,stableLease=null,stableLeaseSequence=0,stableInitializationPending=true,stableLoadAttempts=0;
 var BlockPos=Java.loadClass('net.minecraft.core.BlockPos'),AABB=Java.loadClass('net.minecraft.world.phys.AABB'),Direction=Java.loadClass('net.minecraft.core.Direction'),Height=Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types'),RL=Java.loadClass('net.minecraft.resources.ResourceLocation'),UUID=Java.loadClass('java.util.UUID'),Living=Java.loadClass('net.minecraft.world.entity.LivingEntity');
 var API=null,Styles=null,Manager=null,Players=null;
 if(Platform.isLoaded('waystones')){API=Java.loadClass('net.blay09.mods.waystones.api.WaystonesAPI');Styles=Java.loadClass('net.blay09.mods.waystones.api.WaystoneStyles');Manager=Java.loadClass('net.blay09.mods.waystones.core.WaystoneManager');Players=Java.loadClass('net.blay09.mods.waystones.core.PlayerWaystoneManager');}
 function copy(v){return JSON.parse(JSON.stringify(v));}
 function raw(e){return e&&(e.minecraftEntity||e.minecraftPlayer||e);}
 function each(xs,fn){if(!xs)return;var length=null;try{if(typeof xs.length==='number')length=Number(xs.length);}catch(ignoredLength){}if(length!==null){for(var i=0;i<length;i++)fn(xs[i]);return;}var n=Number(xs.size());for(var j=0;j<n;j++)fn(xs.get(j));}
 function dim(e){return String(e.level.dimension);}
 function enabled(server){var l=F.getSerdinV94Layout&&F.getSerdinV94Layout(server);return !!(l&&l.expansionVersion==='9.6');}
 function level(server,id){return F.getChapter1RaidLevelV104?F.getChapter1RaidLevelV104(server,id):server.getLevel(id);}
 function anchor(server){var l=F.getSerdinV94Layout&&F.getSerdinV94Layout(server);if(l&&l.anchor)return l.anchor;var c=JsonIO.read('kubejs/config/fcraft_regions.json');if(!c||!c.anchor)throw new Error('Actual Brion anchor missing');return c.anchor;}
 function read(server){var s=String(server.persistentData.getString(KEY));return s?JSON.parse(s):{version:110,stations:{}};}
 function save(server,data){server.persistentData.putString(KEY,JSON.stringify(data));}
 function constructionReady(server){var g=C.constructionGate(F.ARENA_BUILDER_V103,F.GUARDIAN_SANCTUM_V104,server);if(!g.ok)return g;var signature=g.arena.signature+'|'+g.sanctum.signature;if(signature!==reservedSignature||!reservedCache){try{reservedCache=C.reservedIndex(g);reservedSignature=signature;}catch(e){reservedCache=null;reservedSignature='';return{ok:false,reason:'authoritative_reserved_plan_invalid'};}}return{ok:true,arenaSignature:g.arena.signature,sanctumSignature:g.sanctum.signature};}
 function reserved(server,dimension,x,y,z){var g=constructionReady(server);return !g.ok||C.reservedAt(reservedCache,dimension,x,y,z);}
 function retryConstruction(server){if(constructionRetryPending)return;constructionRetryPending=true;server.scheduleInTicks(20,function(){constructionRetryPending=false;ensure(server);});}
 function blockId(w,x,y,z){return String(w.getBlock(x,y,z).id);}
 function travelBlock(id){return ['waystones:waystone','waystones:mossy_waystone','waystones:sandy_waystone','waystones:deepslate_waystone','waystones:blackstone_waystone','waystones:end_stone_waystone'].indexOf(String(id))>=0;}
 function at(w,p){return API.getWaystoneAt(w,new BlockPos(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z)));}
 function persistedStoneUUID(w,x,y,z){var data=w.getBlock(x,y,z).entityData;if(!data)throw new Error('physical_block_entity_nbt_missing');return String(data.getUUID('UUID'));}
 function stationProbe(server,row,repair){
  var w=level(server,row.dimension);if(!w)return{ok:false,reason:'dimension_unavailable'};w.getChunk(row.x>>4,row.z>>4);
  var lower=blockId(w,row.x,row.y,row.z),upper=blockId(w,row.x,row.y+1,row.z),known=at(w,row),canonical=API.getWaystone(server,UUID.fromString(row.uuid)),d={lower:lower,upper:upper,apiPresent:known.isPresent(),databasePresent:canonical.isPresent(),reserved:reserved(server,row.dimension,row.x,row.y,row.z)||reserved(server,row.dimension,row.x,row.y+1,row.z)};
  try{d.persistedLowerUUID=persistedStoneUUID(w,row.x,row.y,row.z);}catch(lowerError){d.persistedLowerError=String(lowerError);}
  try{d.persistedUpperUUID=persistedStoneUUID(w,row.x,row.y+1,row.z);}catch(upperError){d.persistedUpperError=String(upperError);}
  if(known.isPresent()){d.apiUUID=String(known.get().getWaystoneUid());d.apiName=String(known.get().getName());d.apiGlobal=known.get().isGlobal();}
  if(canonical.isPresent()){var c=canonical.get(),p=c.getPos();d.databaseUUID=String(c.getWaystoneUid());d.databaseName=String(c.getName());d.databaseGlobal=c.isGlobal();d.databaseDimension=String(c.getDimension().location());d.databasePosition={x:Number(p.x),y:Number(p.y),z:Number(p.z)};}
  var ls=stateAt(w,row),hs=stateAt(w,{x:row.x,y:row.y+1,z:row.z});d.physicalHalvesMatch=travelBlock(lower)&&lower===upper&&ls.indexOf('half=lower')>=0&&hs.indexOf('half=upper')>=0;
  d.persistedIdentityMatches=d.persistedLowerUUID===row.uuid&&d.persistedUpperUUID===row.uuid;
  d.canonicalMatches=canonical.isPresent()&&d.databaseUUID===row.uuid&&d.databaseName===row.name&&!d.databaseGlobal&&d.databaseDimension===row.dimension&&d.databasePosition.x===row.x&&d.databasePosition.z===row.z&&(d.databasePosition.y===row.y||d.databasePosition.y===row.y+1);
  // InvalidWaystone.INSTANCE owns an unrelated random UUID. Only both full
  // physical BE NBT UUIDs plus the exact canonical record authorize hydration.
  if(repair&&d.apiName==='invalid'&&!d.reserved&&known.isPresent()&&d.persistedIdentityMatches&&d.canonicalMatches&&d.physicalHalvesMatch){
   var lo=w.getBlockEntity(new BlockPos(row.x,row.y,row.z)),hi=w.getBlockEntity(new BlockPos(row.x,row.y+1,row.z));
   if(lo&&hi&&typeof lo.initializeFromExisting==='function'&&typeof hi.initializeFromBase==='function'){
    lo.initializeFromExisting(w,canonical.get(),Item.of('minecraft:air'));hi.initializeFromBase(lo);
    var after=stationProbe(server,row,false);after.nativeCacheRepair={method:'initializeFromExisting(existing canonical Waystone) + upper.initializeFromBase(lower)',identityEvidence:'both physical saveWithFullMetadata UUID tags and exact canonical database',before:d,uuidPreserved:after.apiUUID===row.uuid&&after.persistedIdentityMatches,strictLiveRecheckPassed:after.ok,physicalBlocksReplaced:0};
    var data=read(server);data.nativeCacheRepairs=data.nativeCacheRepairs||{};data.nativeCacheRepairs[row.id]=after.nativeCacheRepair;save(server,data);return after;
   }
  }
  d.ok=!d.reserved&&known.isPresent()&&d.apiUUID===row.uuid&&d.apiName===row.name&&!d.apiGlobal&&d.persistedIdentityMatches&&d.canonicalMatches&&d.physicalHalvesMatch;return d;
 }
 function stationValid(server,row){return stationProbe(server,row,true).ok;}
 function namedRows(server){var data=read(server),planned=C.plan(anchor(server)),out=[];for(var i=0;i<planned.length;i++){var spec=planned[i],row=data.stations[spec.id];if(row&&row.built){row=copy(row);var w=level(server,row.dimension);if(w&&w.hasChunk(row.x>>4,row.z>>4)&&!stationValid(server,row)){row.built=false;row.error='saved_station_no_longer_valid';}out.push(row);}else{spec.y=null;spec.uuid=null;spec.built=false;if(row&&row.error)spec.error=row.error;out.push(spec);}}return out;}
 function site(server,id){var sites=F.getMainlandLandmarksV96?F.getMainlandLandmarksV96(server):[];for(var i=0;i<sites.length;i++)if(sites[i].id===id)return sites[i];return null;}
 function hazardous(id){return /minecraft:(water|lava|fire|soul_fire|magma_block|cactus|powder_snow|sweet_berry_bush)$/.test(id);}
 function air(w,x,y,z){var b=w.getBlock(x,y,z);return (String(b.id)==='minecraft:air'||String(b.id)==='minecraft:cave_air')&&w.getFluidState(new BlockPos(x,y,z)).isEmpty();}
 function groundProof(w,x,y,z,mode,server,spec){
  var layers=[],natural=false,solid=[];for(var depth=0;depth<3;depth++){var p=new BlockPos(x,y-1-depth,z),id=blockId(w,x,y-1-depth,z);layers.push({x:x,y:y-1-depth,z:z,id:id});solid.push(w.getBlockState(p).isFaceSturdy(w,p,Direction.UP)&&w.getBlockEntity(p)===null);if(naturalFoundation(id))natural=true;}
  var allSolid=solid[0]&&solid[1]&&solid[2],proof={ok:allSolid&&(mode!=='natural'||natural),mode:mode,layers:layers,naturalGroundMember:natural};
  if(!allSolid)proof.reason='hollow_or_unsafe_support';
  if(!proof.ok&&server&&spec&&spec.id==='serdin_junction'&&spec.dimension===C.OW&&solid[0]&&solid[1]&&layers[1].id==='minecraft:stone_bricks'&&air(w,x,y-3,z)&&constructionReady(server).ok&&!reserved(server,C.OW,x,y,z)&&!reserved(server,C.OW,x,y+1,z)){
   var op=reservedCache[C.OW+'|'+x+','+(y-1)+','+z],builder=F.ARENA_BUILDER_V103;
   if(op&&String(op.site).indexOf('route_')===0&&op.kind==='route_floor'&&builder.core&&typeof builder.core.matches==='function'){
    var actual=stateAt(w,{x:x,y:y-1,z:z}),access=null,dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(var i=0;i<dirs.length;i++){var nx=x+dirs[i][0],nz=z+dirs[i][1],neighbor=reservedCache[C.OW+'|'+nx+','+(y-1)+','+nz];if(neighbor&&neighbor.site===op.site&&neighbor.kind==='route_floor'&&builder.core.matches(stateAt(w,{x:nx,y:y-1,z:nz}),neighbor.state)&&w.getBlockState(new BlockPos(nx,y-1,nz)).isFaceSturdy(w,new BlockPos(nx,y-1,nz),Direction.UP)&&air(w,nx,y,nz)&&air(w,nx,y+1,nz)){access={x:nx,y:y,z:nz,expectedFloor:neighbor.state};break;}}
    if(access&&builder.core.matches(actual,op.state)){proof.ok=true;delete proof.reason;proof.authorizedConstructionFoundation={signature:reservedSignature.split('|')[0],site:op.site,kind:op.kind,x:x,y:y-1,z:z,expectedState:op.state,actualState:actual,postimageMatches:true,foundationPolicy:'completed_authoritative_two_layer_route_bridge',supportState:stateAt(w,{x:x,y:y-2,z:z}),belowState:stateAt(w,{x:x,y:y-3,z:z}),adjacentRoadAccess:access,physicalFoundationChanges:0};}
   }
  }
  return proof;
 }
 function usable(w,x,y,z,groundMode,server,spec){
  if(y<=Number(w.getMinBuildHeight())+1||y+2>=Number(w.getMaxBuildHeight())-1)return false;
  if(!air(w,x,y,z)||!air(w,x,y+1,z))return false;
  var floor=new BlockPos(x,y-1,z),id=blockId(w,x,y-1,z);
  if(hazardous(id)||/_(leaves|log|wood)$/.test(id))return false;
  if(!w.getBlockState(floor).isFaceSturdy(w,floor,Direction.UP))return false;
  if(groundMode&&!groundProof(w,x,y,z,groundMode,server,spec).ok)return false;
  return w.getBlockEntity(new BlockPos(x,y,z))===null&&w.getBlockEntity(new BlockPos(x,y+1,z))===null;
 }
 function survey(server,spec){
  var w=level(server,spec.dimension);if(!w)return{ok:false,reason:'dimension_unavailable'};
  var candidates=C.offsets(),old=spec.legacySite?site(server,spec.legacySite):null,base=C.surveyBase(spec,old);
  for(var i=0;i<candidates.length;i++){
   var d=candidates[i],x=base.x+d.x,z=base.z+d.z;w.getChunk(x>>4,z>>4);
   var ys=[];
   if(old&&old.built&&Math.abs(x-old.x)<=28&&Math.abs(z-old.z)<=28)ys.push(Number(old.y)+1);
   var height=Number(w.getHeight(Height.MOTION_BLOCKING_NO_LEAVES,x,z));
   for(var down=0;down<=3;down++)ys.push(height-down);
   for(var j=0;j<ys.length;j++){var y=ys[j],mode=spec.dimension===C.OW?'natural':'solid';if((spec.dimension!==C.OW&&spec.dimension!==C.SAN||!reserved(server,spec.dimension,x,y,z)&&!reserved(server,spec.dimension,x,y+1,z))&&usable(w,x,y,z,mode,server,spec))return{ok:true,x:x,y:y,z:z,groundProof:groundProof(w,x,y,z,mode,server,spec),surveyBase:base,correction:{dx:d.x,dz:d.z,distance:Math.sqrt(d.d),reason:d.d?'survey_base_obstructed_or_reserved_or_unsafe':base.reason==='preserve_existing_measured_fort'?'existing_measured_fort_safe':'nominal_safe'},legacySite:old?{id:old.id,x:old.x,y:old.y,z:old.z,distanceFromNominal:Math.sqrt((old.x-spec.nominalX)*(old.x-spec.nominalX)+(old.z-spec.nominalZ)*(old.z-spec.nominalZ))}:null};}
  }
  return{ok:false,reason:'no_non_destructive_position_within12',surveyBase:base};
 }
 function createOne(server,spec){
  var gate=constructionReady(server);if(!gate.ok){retryConstruction(server);return{ok:false,reason:gate.reason};}
  var data=read(server),existing=data.stations[spec.id];
  if(existing&&existing.built){var probe=stationProbe(server,existing,true);if(probe.ok)return{ok:true,already:true,station:existing};existing.error='official_station_native_verification_failed';existing.verificationDiagnostic=probe;save(server,data);return{ok:false,reason:existing.error,diagnostic:probe};}
  var found=survey(server,spec);
  if(!found.ok){data.stations[spec.id]={id:spec.id,name:spec.name,dimension:spec.dimension,x:spec.nominalX,z:spec.nominalZ,y:null,uuid:null,built:false,error:found.reason,surveyBase:found.surveyBase};save(server,data);return found;}
  var w=level(server,spec.dimension),pos=new BlockPos(found.x,found.y,found.z),result=API.placeWaystone(w,pos,Styles[spec.style]);
  if(!result.isPresent())return{ok:false,reason:'native_place_waystone_rejected'};
  var stone=result.get();stone.setName(spec.name);stone.setGlobal(false);Manager.get(server).updateWaystone(stone);
  var row={id:spec.id,name:spec.name,dimension:spec.dimension,x:found.x,y:found.y,z:found.z,uuid:String(stone.getWaystoneUid()),built:true,style:spec.style,nominalX:spec.nominalX,nominalZ:spec.nominalZ,surveyBase:found.surveyBase,groundProof:found.groundProof,correction:found.correction,legacySite:found.legacySite,authoritativeConstruction:gate,placedAtTick:Number(server.overworld().getTime()),before:{lower:'minecraft:air',upper:'minecraft:air'}};
  if(!stationValid(server,row))throw new Error('Native officialWaystone readback mismatch: '+spec.id);
  data=read(server);data.stations[spec.id]=row;save(server,data);return{ok:true,station:row};
 }
 function ensure(server){
  if(!API||!enabled(server))return{ok:false,reason:'dependencies_or_designated_world_unavailable'};
  var gate=constructionReady(server);if(!gate.ok){retryConstruction(server);return{ok:false,pending:true,reason:gate.reason};}
  var current=namedRows(server),ready=0;for(var j=0;j<current.length;j++)if(current[j].built)ready++;
  if(ready===9){ensureStable(server);ensureThemes(server);return{ok:true,ready:9};}
  if(scheduled)return{ok:true,pending:true,ready:ready};
  scheduled=true;var specs=C.plan(anchor(server)),index=0;
  function step(){
   if(index>=specs.length){scheduled=false;ensureStable(server);ensureThemes(server);return;}
   var spec=specs[index++];
   try{var r=createOne(server,spec);if(!r.ok)console.warn('[F-Craft officialWaystone] '+spec.id+': '+r.reason);}catch(error){console.error('[F-Craft officialWaystone] '+spec.id+': '+String(error));}
   server.scheduleInTicks(3,step);
  }
  server.scheduleInTicks(1,step);return{ok:true,pending:true,ready:ready};
 }
 function stateAt(w,p){return String(w.getBlockState(new BlockPos(p.x,p.y,p.z)));}
 function setAccentState(w,p){var b=w.getBlock(p.x,p.y,p.z),start=p.id.indexOf('[');if(start<0){b.set(p.id);return;}var props={},parts=p.id.substring(start+1,p.id.length-1).split(',');for(var i=0;i<parts.length;i++){var pair=parts[i].split('=');props[pair[0]]=pair[1];}b.set(p.id.substring(0,start),props);}
 function fortSamples(w,s){var r=s.kind==='citadel'?23:s.kind==='tower'?12:18,out=[],seen={};function add(x,y,z){var p={x:Math.floor(s.x+x),y:Math.floor(s.y+y),z:Math.floor(s.z+z)},key=p.x+','+p.y+','+p.z;if(seen[key])return;seen[key]=true;p.state=stateAt(w,p);p.id=blockId(w,p.x,p.y,p.z);out.push(p);}for(var x of [-r,0,r])for(var z of [-r,0,r])add(x,0,z);for(var d of [-r,r]){add(d,1,0);add(d,5,0);add(0,1,d);add(0,5,d);}add(0,0,r+3);add(0,0,r+8);if(s.kind==='port'){add(-2,0,r+15);add(2,0,r+20);}return out;}
 function naturalFoundation(id){return /minecraft:(grass_block|dirt|coarse_dirt|rooted_dirt|podzol|mycelium|stone|deepslate|granite|andesite|diorite|gravel|sand|red_sand|sandstone|red_sandstone|clay|tuff|calcite|snow_block|packed_ice|ice|moss_block|terracotta)$/.test(id);}
 function accentSurvey(server,s){
  var w=level(server,C.MAIN),limit=Number(s.radius)-6,start=s.kind==='citadel'?34:s.kind==='tower'?24:30,foot=s.id==='ashen_mage_spire'||s.id==='sunken_ancient_keep'?1:2,skips={unsafeFoundation:0,notEmpty:0,oldFootprint:0,outsideProtection:0},attempts=0;
  for(var radius=start;radius<=limit;radius+=4)for(var angle=0;angle<32;angle++){
   attempts++;var a=angle*6.283185307179586/32,ox=Math.floor(s.x+Math.cos(a)*radius),oz=Math.floor(s.z+Math.sin(a)*radius),columns=[],lo=Infinity,hi=-Infinity,valid=true;
   for(var dx=-foot;dx<=foot&&valid;dx++)for(var dz=-foot;dz<=foot;dz++){
    var x=ox+dx,z=oz+dz,p={x:x,z:z};if(!C.outsideFort(s,p)){skips.oldFootprint++;valid=false;break;}if((x-s.x)*(x-s.x)+(z-s.z)*(z-s.z)>(s.radius-1)*(s.radius-1)){skips.outsideProtection++;valid=false;break;}w.getChunk(x>>4,z>>4);var y=Number(w.getHeight(Height.MOTION_BLOCKING_NO_LEAVES,x,z))-1;
    if(!isFinite(y)||Math.abs(y-Number(s.y))>16){skips.unsafeFoundation++;valid=false;break;}
    for(var depth=0;depth<3;depth++){var bp=new BlockPos(x,y-depth,z);if(!naturalFoundation(blockId(w,x,y-depth,z))||w.getBlockEntity(bp)!==null||!w.getBlockState(bp).isFaceSturdy(w,bp,Direction.UP)){valid=false;break;}}
    if(!valid){skips.unsafeFoundation++;break;}columns.push({x:x,z:z,groundY:y});lo=Math.min(lo,y);hi=Math.max(hi,y);
   }
   if(!valid||hi-lo>1){if(valid)skips.unsafeFoundation++;continue;}
   var origin={x:ox,y:hi+1,z:oz},cells=C.accentPlan(s,origin),supports=[];
   for(var ci=0;ci<columns.length;ci++){var c=columns[ci];for(var sy=c.groundY+1;sy<origin.y;sy++)supports.push({x:c.x,y:sy,z:c.z,id:s.id==='goldenvale_outpost'?'minecraft:acacia_planks':s.id==='ashen_mage_spire'?'minecraft:polished_basalt[axis=y]':s.id==='caleon_citadel'?'minecraft:deepslate_bricks':'minecraft:prismarine_bricks'});}
   cells=supports.concat(cells);
   // Reserve the entire small volume, not merely the decorative target cells.
   // No plants, existing blocks, fluids, inventories, or portal frames are erased.
   for(var vi=0;vi<columns.length&&valid;vi++){var vc=columns[vi];for(var cy=vc.groundY+1;cy<=origin.y+3;cy++)if(!air(w,vc.x,cy,vc.z)||w.getBlockEntity(new BlockPos(vc.x,cy,vc.z))!==null){valid=false;break;}}
   if(!valid){skips.notEmpty++;continue;}
   return{ok:true,origin:origin,cells:cells,attempts:attempts,skips:skips,foundation:columns,originalFortFootprint:C.fortFootprint(s)};
  }
  return{ok:false,reason:'no_empty_natural_theme_corner_inside_existing_protection',attempts:attempts,skips:skips};
 }
 function buildAccent(server,s){
  var data=read(server);data.themes=data.themes||{};if(data.themes[s.id]&&data.themes[s.id].built)return{ok:true,already:true,record:data.themes[s.id]};
  if(!s.built)return{ok:false,reason:'original_fort_not_built'};var w=level(server,C.MAIN),samples=fortSamples(w,s);
  if(s.id==='arvern_port_keep'){var nonempty=0;for(var si=0;si<samples.length;si++)if(!/minecraft:(air|cave_air|void_air)$/.test(samples[si].id))nonempty++;var existing={id:s.id,built:nonempty>=8,kind:'preserved_existing_pier_and_guild_keep',placed:[],actualCounts:{existingNonemptySamples:nonempty},originalFortFootprint:C.fortFootprint(s),originalFortSamples:samples,originalFortSamplesUnchanged:true,source:'Existing author-built original architecture; no new central block placement'};data.themes[s.id]=existing;save(server,data);return{ok:existing.built,record:existing};}
  var survey=accentSurvey(server,s);if(!survey.ok){data.themes[s.id]={id:s.id,built:false,reason:survey.reason,attempts:survey.attempts,skips:survey.skips,placed:[]};save(server,data);return survey;}
  var written=[],counts={};try{
   // Preflight all cells before the first write, then recheck each immediate
   // preimage. Existing castle and player blocks never become write targets.
   for(var i=0;i<survey.cells.length;i++){var p=survey.cells[i];if(!C.outsideFort(s,p)||!air(w,p.x,p.y,p.z)||w.getBlockEntity(new BlockPos(p.x,p.y,p.z))!==null)throw new Error('accent_preimage_changed');}
   for(var j=0;j<survey.cells.length;j++){var c=survey.cells[j];if(!air(w,c.x,c.y,c.z)||w.getBlockEntity(new BlockPos(c.x,c.y,c.z))!==null)throw new Error('accent_immediate_preimage_changed');var before=stateAt(w,c);setAccentState(w,c);var wanted=c.id.split('[')[0],actual=blockId(w,c.x,c.y,c.z);written.push({x:c.x,y:c.y,z:c.z,id:actual,state:stateAt(w,c),before:before,beforeId:'minecraft:air'});if(actual!==wanted)throw new Error('accent_native_readback_mismatch');counts[actual]=(counts[actual]||0)+1;}
   for(var k=0;k<samples.length;k++)if(stateAt(w,samples[k])!==samples[k].state)throw new Error('original_fort_sample_changed');
  }catch(error){var rollbackSkipped=[];for(var ri=written.length-1;ri>=0;ri--){var r=written[ri];if(stateAt(w,r)===r.state)w.getBlock(r.x,r.y,r.z).set('minecraft:air');else rollbackSkipped.push({x:r.x,y:r.y,z:r.z});}data=read(server);data.themes=data.themes||{};data.themes[s.id]={id:s.id,built:false,reason:String(error),placed:[],rollbackOwnedAirWrites:true,rollbackUnconfirmedCellsPreserved:rollbackSkipped,attempts:survey.attempts,skips:survey.skips};save(server,data);throw error;}
  var record={id:s.id,built:true,kind:s.id==='caleon_citadel'?'snow_ice_court':s.id==='goldenvale_outpost'?'acacia_wheat_plot':s.id==='ashen_mage_spire'?'basalt_amethyst_observatory':'prismarine_moss_forecourt',origin:survey.origin,placed:written,actualCounts:counts,attempts:survey.attempts,skips:survey.skips,foundation:survey.foundation,originalFortFootprint:survey.originalFortFootprint,originalFortSamples:samples,originalFortSamplesUnchanged:true,noExistingBlockReplaced:true};
  data=read(server);data.themes=data.themes||{};data.themes[s.id]=record;save(server,data);return{ok:true,record:record};
 }
 function ensureThemes(server){if(!enabled(server)||themesScheduled)return{ok:false,reason:'not_designated_world_or_pending'};var sites=F.getMainlandLandmarksV96?F.getMainlandLandmarksV96(server):[],i=0;if(!sites.length)return{ok:false,reason:'no_existing_sites'};themesScheduled=true;function step(){if(i>=sites.length){themesScheduled=false;return;}var s=sites[i++];try{var r=buildAccent(server,s);if(!r.ok)console.warn('[F-Craft theme accent] '+s.id+': '+r.reason);}catch(e){console.error('[F-Craft theme accent] '+s.id+': '+String(e));}server.scheduleInTicks(3,step);}server.scheduleInTicks(1,step);return{ok:true,pending:true};}
 function keeperRecord(server){return read(server).stableKeeper||null;}
 function releaseStableLease(server,reason){
  var data=read(server),lease=stableLease||data.stableChunkLease;if(!lease)return;
  if(lease.owned===true)server.runCommandSilent('execute in '+C.MAIN+' run forceload remove '+lease.x+' '+lease.z);
  data=read(server);data.stableChunkLease=null;data.stableChunkLoadDiagnostic=data.stableChunkLoadDiagnostic||{};data.stableChunkLoadDiagnostic.releasedBecause=reason;data.stableChunkLoadDiagnostic.removedOwnTicket=lease.owned===true;save(server,data);stableLease=null;
 }
 function loadStableChunk(server,r){
  var w=level(server,C.MAIN);if(!w||!isFinite(r.x)||!isFinite(r.z))return null;var x=Math.floor(r.x),z=Math.floor(r.z);
  if(!stableLease){var added=Number(server.runCommandSilent('execute in '+C.MAIN+' run forceload add '+x+' '+z))>0;stableLease={x:x,z:z,owned:added,sequence:++stableLeaseSequence};var data=read(server);data.stableChunkLease=copy(stableLease);save(server,data);var sequence=stableLease.sequence;server.scheduleInTicks(120,function(){if(stableLease&&stableLease.sequence===sequence)releaseStableLease(server,'bounded_load_timeout');});}
  w.getChunk(x>>4,z>>4);return w;
 }
 function getKeeper(server,loadSaved){
  var r=keeperRecord(server);if(!r||!r.uuid)return null;var w=loadSaved===false?level(server,C.MAIN):loadStableChunk(server,r);if(!w)return null;var e=w.getEntity(UUID.fromString(r.uuid)),valid=!!e&&e.isAlive()&&F.hasEntityTag(e,'f_rank_stable_master_v110');
  var data=read(server);data.stableChunkLoadDiagnostic={recordedUUID:r.uuid,chunkX:Math.floor(r.x)>>4,chunkZ:Math.floor(r.z)>>4,entityLoaded:!!e,exactUUID:!!e&&String(e.uuid)===r.uuid,alive:!!e&&e.isAlive(),tagged:valid,addedOwnTicket:!!stableLease&&stableLease.owned};save(server,data);
  if(!valid||String(e.uuid)!==r.uuid)return null;
  if(stableLease&&!stableLease.releaseScheduled){stableLease.releaseScheduled=true;var sequence=stableLease.sequence;server.scheduleInTicks(2,function(){if(stableLease&&stableLease.sequence===sequence)releaseStableLease(server,'saved_entity_loaded');});}
  return{id:'stable_master_v110',tag:'f_rank_stable_master_v110',entity:e,uuid:r.uuid,dimension:C.MAIN,x:Number(e.x),y:Number(e.y),z:Number(e.z),built:true,corner:copy(r.corner||[])};
 }
 function stableCorner(server,market){
  var w=level(server,C.MAIN),orig=keeperRecord(server);if(orig&&orig.corner&&orig.corner.length)return{ok:true,x:orig.x,y:orig.y,z:orig.z,blocks:orig.corner,already:true};
  // Add six decorative blocks on the existing market floor; never clear blocks.
  var choices=[[8,13],[-10,13],[13,8],[-13,8]],y=Number(market.y)+1;
  for(var c=0;c<choices.length;c++){
   var ox=Number(market.x)+choices[c][0],oz=Number(market.z)+choices[c][1],blocks=[{x:ox,y:y,z:oz,id:'minecraft:acacia_fence'},{x:ox+1,y:y,z:oz,id:'minecraft:acacia_fence'},{x:ox+2,y:y,z:oz,id:'minecraft:acacia_fence'},{x:ox,y:y,z:oz-1,id:'minecraft:hay_block'},{x:ox+2,y:y+1,z:oz,id:'minecraft:lantern'},{x:ox+2,y:y,z:oz-1,id:'minecraft:hay_block'}],good=true;
   for(var i=0;i<blocks.length;i++){var b=blocks[i];if(Math.abs(b.x-market.x)>17||Math.abs(b.z-market.z)>17||!air(w,b.x,b.y,b.z))good=false;if(b.y===y&&!w.getBlockState(new BlockPos(b.x,b.y-1,b.z)).isFaceSturdy(w,new BlockPos(b.x,b.y-1,b.z),Direction.UP))good=false;}
   if(!good||!usable(w,ox+1,y,oz-2))continue;
   for(var j=0;j<blocks.length;j++){var v=blocks[j];w.getBlock(v.x,v.y,v.z).set(v.id);v.before='minecraft:air';}
   return{ok:true,x:ox+1.5,y:y,z:oz-1.5,blocks:blocks};
  }
  return{ok:false,reason:'no_empty_stable_corner_inside_existing_market_footprint'};
 }
 function ensureStable(server,loadSaved){
  if(stableScheduled||!Platform.isLoaded('customnpcs'))return{ok:false,reason:'stable_pending_or_customnpcs_unavailable'};
  var allowLoad=loadSaved===true||stableInitializationPending,present=getKeeper(server,allowLoad);if(present){stableInitializationPending=false;stableLoadAttempts=0;return{ok:true,already:true,keeper:present};}var savedRecord=keeperRecord(server);if(savedRecord&&savedRecord.uuid&&!allowLoad)return{ok:true,unloaded:true,preservedUUID:savedRecord.uuid};
  var market=site(server,'goldenvale_outpost');if(!market||!market.built)return{ok:false,reason:'actual_market_not_built'};
  var previous=keeperRecord(server),w=level(server,C.MAIN);if(!w)return{ok:false,reason:'mainland_unavailable'};
  var px=previous?previous.x:market.x+9,pz=previous?previous.z:market.z+11;
  for(var dx=-1;dx<=1;dx++)for(var dz=-1;dz<=1;dz++)w.getChunk((Math.floor(px)>>4)+dx,(Math.floor(pz)>>4)+dz);
  stableScheduled=true;
  server.scheduleInTicks(10,function(){
   try{
    var api=Java.loadClass('noppes.npcs.api.NpcAPI').Instance(),wrappedWorld=api.getIWorld(C.MAIN),matches=[];
    each(wrappedWorld.getAllEntities(2),function(n){if(n.hasTag('f_rank_stable_master_v110'))matches.push(n);});
    if(matches.length>1)throw new Error('Multiple owned stableNPCs found; refusing blind delete/spawn');
    var npc=matches.length?matches[0]:null,record=keeperRecord(server);
    if(npc&&record&&record.uuid&&String(npc.getMCEntity().uuid)!==record.uuid)throw new Error('Loaded stableNPC UUID differs from saved keeper; preserving both without reassignment');
    if(!npc&&record&&record.uuid){loadStableChunk(server,record);if(++stableLoadAttempts<24)server.scheduleInTicks(5,function(){ensureStable(server,true);});else{stableInitializationPending=false;console.warn('[F-Craft stable] Bounded saved entity load timed out; preservingUUID '+record.uuid+' without spawning');}return;}
    var corner=stableCorner(server,market);if(!corner.ok){console.warn('[F-Craft stable] '+corner.reason);return;}
    var fresh=!npc;
    if(fresh){npc=api.createNPC(wrappedWorld.getMCLevel());npc.setPosition(corner.x,corner.y,corner.z);npc.setHome(Math.floor(corner.x),Math.floor(corner.y),Math.floor(corner.z));}
    npc.addTag('f_rank_npc');npc.addTag('f_rank_stable_master_v110');npc.getDisplay().setName('왕립 마구간 관리인');npc.getDisplay().setSkinTexture('customnpcs:textures/entity/humanmale/townsmansteve.png');npc.getDisplay().setSize(5);npc.getDisplay().setShowingLayers(true);npc.getAi().setMovingType(0);npc.getAi().setStandingType(1);npc.getAi().setRetaliateType(3);npc.getAi().setStopOnInteract(true);npc.setRotation(180);
    var nbt=npc.getEntityNbt();nbt.setBoolean('NoAI',true);nbt.setBoolean('Invulnerable',true);nbt.setBoolean('PersistenceRequired',true);npc.setEntityNbt(nbt);
    if(fresh){npc.setHealth(npc.getMaxHealth());npc.spawn();}
    npc.getMCEntity().setYHeadRot(180);npc.getMCEntity().setYBodyRot(180);npc.updateClient();
    stableInitializationPending=false;stableLoadAttempts=0;var entity=npc.getMCEntity(),data=read(server);data.stableKeeper={id:'stable_master_v110',uuid:String(entity.uuid),dimension:C.MAIN,x:corner.x,y:corner.y,z:corner.z,corner:corner.blocks,skinResource:'customnpcs:textures/entity/humanmale/townsmansteve.png',skinProvenance:'Reference installed CustomNPCs bundled skin; no image copied or newly claimed'};save(server,data);
   }catch(error){console.error('[F-Craft stable] '+String(error));}finally{stableScheduled=false;}
  });
  return{ok:true,pending:true};
 }
 F.isMainlandUnlockedV110=function(p){return !!p&&C.stateUnlocked(F.loadPlayerState(p));};
 F.isTravelOrMountBlockedV110=function(p){
  if(!p)return true;if(dim(p)===C.SAN)return true;
  var engine=F.CHAPTER1_RAID_V101,scenes=engine&&engine.scenes?engine.scenes():{};
  for(var id in scenes){var s=scenes[id];if(!s||['IDLE','RESETTING','SETTLING'].indexOf(s.status)>=0||!s.center||s.center.dimension!==dim(p))continue;var point=s.center;if(s.uuid){var e=level(p.server,dim(p)).getEntity(UUID.fromString(String(s.uuid)));if(e&&e.isAlive())point={x:Number(e.x),y:Number(e.y),z:Number(e.z)};}if(C.distance2(p,point)<=1024)return true;}
  var found=false;
  each(p.level.getEntitiesWithin(new AABB(Number(p.x)-32,Number(p.y)-32,Number(p.z)-32,Number(p.x)+32,Number(p.y)+32,Number(p.z)+32)),function(e){
   if(found||!e.isAlive()||C.distance2(p,e)>1024||!F.isTrackedBossV99||!F.isTrackedBossV99(String(e.type)))return;
   var n=raw(e),target=typeof n.getTarget==='function'?n.getTarget():null;if(target&&target.isAlive())found=true;
  });
  return found;
 };
 F.getOfficialWaystonesV110=namedRows;
 F.MAINLAND_REGIONS_V110=JsonIO.read('kubejs/config/fcraft_mainland_regions_v110.json');
 F.getMainlandBossRosterV110=function(){var out=[],defs=F.MAINLAND_REGIONS_V110&&F.MAINLAND_REGIONS_V110.regions||[];for(var i=0;i<defs.length;i++)for(var j=0;j<defs[i].bosses.length;j++)out.push({id:defs[i].bosses[j],region:defs[i].id,dimension:defs[i].bossDimensions?defs[i].bossDimensions[j]:C.MAIN});return copy(out);};
 F.getOfficialWaystoneV110=function(server,id){var rows=namedRows(server);for(var i=0;i<rows.length;i++)if(rows[i].id===String(id))return rows[i];return null;};
 F.ensureOfficialWaystonesV110=ensure;
 F.getRoyalStableKeeperV110=getKeeper;
 F.ensureRoyalStableKeeperV110=function(server){stableLoadAttempts=0;return ensureStable(server,true);};
 F.getWaystoneConstructionReadinessV110=constructionReady;
 F.isWaystoneAuthoritativeCellReservedV110=reserved;
 F.getOfficialWaystoneNativeCacheRepairsV110=function(server){return copy(read(server).nativeCacheRepairs||{});};
 F.getRoyalStableChunkLoadDiagnosticV110=function(server){return copy(read(server).stableChunkLoadDiagnostic||{});};
 F.ensureMainlandThemeAccentsV110=ensureThemes;
 F.getMainlandThemeAccentsV110=function(server){return copy(read(server).themes||{});};
 F.isOfficialTravelBlockV110=travelBlock;
 F.isOfficialWaystonePositionV110=function(server,dimension,x,y,z,padding){var rows=namedRows(server),p=Number(padding||0);for(var i=0;i<rows.length;i++){var r=rows[i];if(r.built&&r.dimension===dimension&&x>=r.x-p&&x<=r.x+p&&z>=r.z-p&&z<=r.z+p&&y>=r.y-p&&y<=r.y+1+p)return true;}return false;};
 if(typeof F.onOfficialWaystoneActivatedV110!=='function')F.onOfficialWaystoneActivatedV110=function(p,id){return{ok:true,id:id};};
 F.guardWaystoneTeleportV110=function(event){
  event.setXpCost(0);if(event.isCanceled())return;var context=event.getContext(),p=context.getEntity();if(!p||!p.isPlayer())return;
  var target=String(event.getDestination().getLevel().dimension);
  if(F.isTravelOrMountBlockedV110(p)){event.setCanceled(true);p.tell('§c[전이 제한] §f성소와 진행 중인 보스 전투에서는 전이 비석을 사용할 수 없습니다.');return;}
  if(target===C.MAIN&&!F.isMainlandUnlockedV110(p)){event.setCanceled(true);p.tell('§c[출항 통제] §f먼저 최종 시련이나 D급 개척 공납으로 본토 도항 자격을 발급받으세요.');return;}
  if(F.recallPersonalMountV110)F.recallPersonalMountV110(p,'waystone_travel');
 };
 F.onWaystoneActivatedNativeV110=function(event){
  var p=event.getPlayer(),stone=event.getWaystone(),rows=namedRows(p.server),key=String(stone.getWaystoneUid());
  for(var i=0;i<rows.length;i++){var r=rows[i];if(!r.built||r.uuid!==key)continue;
   if(r.dimension===C.MAIN&&!F.isMainlandUnlockedV110(p)){Players.deactivateWaystone(p,stone);return;}
   if(dim(p)!==r.dimension||C.distance2(p,{x:r.x+.5,y:r.y,z:r.z+.5})>64)return;
   var s=F.loadPlayerState(p);s.official_waystones_v110=s.official_waystones_v110||{activated:{}};s.official_waystones_v110.activated[r.id]=true;F.savePlayerState(p,s);F.onOfficialWaystoneActivatedV110(p,r.id);return;
  }
 };
 function safeReturn(p){
  var n=F.getMainlandSailingNpcV96?F.getMainlandSailingNpcV96(p.server,'marco'):null;if(!n)return{ok:false,reason:'measured_ferry_return_unavailable'};var w=level(p.server,C.OW),ds=[{x:2,z:0},{x:-2,z:0},{x:0,z:2},{x:0,z:-2},{x:0,z:0}];
  for(var i=0;i<ds.length;i++)for(var dy=-2;dy<=3;dy++){var x=Math.floor(n.x)+ds[i].x,y=Math.floor(n.y)+dy,z=Math.floor(n.z)+ds[i].z;w.getChunk(x>>4,z>>4);if(usable(w,x,y,z)&&w.noCollision(raw(p),new AABB(x+.2,y,z+.2,x+.8,y+1.9,z+.8))){p.teleportTo(new RL(C.OW),x+.5,y,z+.5,0,0);p.fallDistance=0;p.setMotionX(0);p.setMotionY(0);p.setMotionZ(0);return{ok:dim(p)===C.OW,dimension:C.OW,x:x+.5,y:y,z:z+.5};}}
  return{ok:false,reason:'no_safe_measured_ferry_return'};
 }
 F.returnUnauthorizedMainlandPlayerV110=safeReturn;
 var previousRejectBoss=F.shouldRejectBossSpawnV99;
 F.shouldRejectBossSpawnV99=function(e){var type=String(e.type);if(dim(e)===C.MAIN&&(type==='bosses_of_mass_destruction:void_blossom'||type==='mowziesmobs:ferrous_wroughtnaut'))return true;return previousRejectBoss?previousRejectBoss(e):false;};
 // A real committed first-chapter Blossom clear remains a canonical boss clear
 // for the unchanged B/A/S catalog. No money, drops or synthetic old clear is added.
 var previousRaidDeath=F.handleChapter1RaidDeathV101;
 if(typeof previousRaidDeath==='function'){
  F.handleChapter1RaidDeathV101=function(e,killer){
   var proof=null,engine=F.CHAPTER1_RAID_V101,scenes=engine&&engine.scenes?engine.scenes():{},s=scenes.blossom;
   if(e&&raw(e) instanceof Living&&!e.isAlive()&&String(e.type)==='bosses_of_mass_destruction:void_blossom'&&s&&s.uuid===String(e.uuid)&&s.center.dimension===dim(e)&&['IDLE','RESETTING','SETTLING'].indexOf(s.status)<0){
    var native=F.getChapter1RaidNativeDataV102&&F.getChapter1RaidNativeDataV102(e),registered=level(e.server,dim(e)).getEntity(UUID.fromString(String(e.uuid)));
    if(native&&native.getBoolean('fcraft_raid_v101')&&String(native.getString('fcraft_raid_id'))==='blossom'&&registered&&raw(registered).equals(raw(e)))proof={scene:s,bossUUID:String(e.uuid),generation:Number(s.generation)};
   }
   var result=previousRaidDeath(e,killer);
   if(!proof||!result||!result.ok||proof.scene.status!=='IDLE'||proof.scene.closedReason!=='boss_defeated')return result;
   var eligible=proof.scene.rewardEligible||[],receipts=proof.scene.receipts||{},domain='canonical_blossom_v110',receipt=proof.bossUUID+':'+proof.generation;
   each(e.server.players,function(p){
    var id=String(p.uuid);if(eligible.indexOf(id)<0||receipts[id]!=='COMMITTED')return;
    var checkpoint=null,settled=F.runAtomicPlayerV96(p,function(){
     if(F.hasChapter1ReceiptV103(p,domain,receipt))return{ok:true,already:true};
     var state=F.loadPlayerState(p),key='bosses_of_mass_destruction:void_blossom';state.v96_boss_clears=state.v96_boss_clears||{};
     var old=state.v96_boss_clears[key],n=Number(old&&typeof old==='object'?(old.count||old.clear_count||0):(old||0));
     if(!isFinite(n)||n<0)throw new Error('Invalid old canonicalBlossom count; original record preserved');
     if(old&&typeof old==='object'){if(old.clear_count!==undefined&&old.count===undefined)old.clear_count=n+1;else old.count=n+1;}else state.v96_boss_clears[key]=n+1;
     F.savePlayerState(p,state);var committed=F.commitChapter1ReceiptV103(p,domain,receipt);checkpoint=committed.checkpoint||null;return{ok:true,count:n+1};
    });
    if(!settled||!settled.ok){F.rollbackChapter1ReceiptV103(p,checkpoint);console.error('[F-Craft Blossom compatibility] '+id+': canonical progress not committed');}
   });
   return result;
  };
  F.CHAPTER1_RAID_V101.handleDeath=F.handleChapter1RaidDeathV101;
 }
 PlayerEvents.tick(function(e){var p=e.player;if(!p.isAlive()||Number(p.age)%20!==0||!enabled(p.server)||dim(p)!==C.MAIN||F.isMainlandUnlockedV110(p))return;var id=String(p.uuid),now=Number(p.age),last=backoffs[id];if(last!==undefined&&now>=last&&now-last<20)return;backoffs[id]=now;var r=safeReturn(p);if(r.ok)p.tell('§c[출항 통제] §f1챕터 최종 시련 또는 D급 개척 물자 공납으로 본토 도항 허가를 먼저 받아 주세요.');else console.warn('[F-Craft mainland entry] '+id+': '+r.reason);});
 PlayerEvents.loggedOut(function(e){delete backoffs[String(e.player.uuid)];});
 ItemEvents.rightClicked(function(e){if(!e.player||String(e.item.id).indexOf('waystones:')!==0)return;if(F.isTravelOrMountBlockedV110(e.player)&&/waystones:(warp_stone|warp_scroll|return_scroll|bound_scroll)$/.test(String(e.item.id))){e.cancel();e.player.tell('§c[전이 제한] §f보스 결계 안에서는 전이 도구를 사용할 수 없습니다.');}});
 BlockEvents.broken(function(e){if(!e.player)return;if(dim(e.player)===C.SAN||F.isOfficialWaystonePositionV110(e.server,dim(e.player),e.block.x,e.block.y,e.block.z,0)){e.cancel();e.player.tell('§e[길드 보호] §f공식 전이 비석과 성소는 파괴할 수 없습니다.');}});
 BlockEvents.placed(function(e){if(e.player&&dim(e.player)===C.SAN)e.cancel();});
 var oldProtect=F.shouldProtectWorldBlockV96;
 F.shouldProtectWorldBlockV96=function(w,x,y,z,pad){return String(w.dimension)===C.SAN||F.isOfficialWaystonePositionV110(w.server,String(w.dimension),x,y,z,pad)||!!(oldProtect&&oldProtect(w,x,y,z,pad));};
 ServerEvents.loaded(function(e){releaseStableLease(e.server,'server_load_or_script_reload');stableLeaseSequence++;stableInitializationPending=true;stableLoadAttempts=0;scheduled=false;stableScheduled=false;themesScheduled=false;constructionRetryPending=false;reservedCache=null;reservedSignature='';backoffs={};e.server.scheduleInTicks(20,function(){ensure(e.server);});});
 ServerEvents.unloaded(function(e){releaseStableLease(e.server,'server_unloaded');});
 ServerEvents.tick(function(e){if(++tick%1200===0)ensure(e.server);});
 F.OFFICIAL_WAYSTONES_V110={core:C,survey:survey,createOne:createOne,stationValid:stationValid,stationProbe:stationProbe,safeReturn:safeReturn,buildAccent:buildAccent,accentSurvey:accentSurvey,eachNative:each};
})();
