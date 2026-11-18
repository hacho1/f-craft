// Geometry is materialized in the supplied new saves, never built on login.
var FCraftGeometryV97=(function(){
 function inside(b,x,z){return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;}
 function compile(points){var grid={},size=8;for(var i=0;i<points.length;i++){var p=points[i],r=Number(p.halfWidth||6);for(var x=Math.floor((p.x-r)/size);x<=Math.floor((p.x+r)/size);x++)for(var z=Math.floor((p.z-r)/size);z<=Math.floor((p.z+r)/size);z++){var k=x+','+z;(grid[k]||(grid[k]=[])).push(p);}}return{size:size,cells:grid};}
 function near(grid,x,z){if(!grid)return false;var list=grid.cells[Math.floor(x/grid.size)+','+Math.floor(z/grid.size)]||[];for(var i=0;i<list.length;i++){var p=list[i],dx=x-p.x,dz=z-p.z,r=Number(p.halfWidth||6);if(dx*dx+dz*dz<=r*r)return true;}return false;}
 function validate(data){if(!data||data.schemaVersion!==1||data.layoutVersion!=='9.7'||data.serdinLayoutVersion!=='9.7'||data.geometryReady!==true||data.worldValidationId!=='fcraft_v9_medieval_town_verified_01'||!data.geometryFingerprint||data.geometryFingerprint.length<3||!Array.isArray(data.trailPoints)||data.trailPoints.length<100||!data.spawn||!Array.isArray(data.treasurePois)||data.treasurePois.length!==14)return false;var count=0;for(var i=0;i<data.treasurePois.length;i++)count+=(data.treasurePois[i].containers||[]).length;return count===24;}
 return{inside:inside,compileTrailIndex:compile,isNearTrail:near,validate:validate};
})();
if(typeof module!=='undefined')module.exports=FCraftGeometryV97;
if(typeof global!=='undefined'&&global.FRankDays)(function(){
 var F=global.FRankDays,cache={server:null,source:null,data:null,grid:null},warned=false;
 F.getSerdinV97Layout=function(server){
  var base=F.getSerdinV94Layout&&F.getSerdinV94Layout(server);
  if(!base||base.serdinLayoutVersion!=='9.7')return null;
  if(cache.data&&F.sameFcraftServer(cache.server,server)&&cache.source===base.serdinV97)return cache.data;
  if(!FCraftGeometryV97.validate(base.serdinV97))return null;
  var data=base.serdinV97,world=server.overworld();
  for(var i=0;i<data.geometryFingerprint.length;i++){var p=data.geometryFingerprint[i];if(String(world.getBlock(p.x,p.y,p.z).id)!==p.block){if(!warned){console.warn('[F-Craft v9.7] Geometry fingerprint does not match; no new Serdin rules are enabled.');warned=true;}return null;}}
  cache={server:server,source:data,data:data,grid:FCraftGeometryV97.compileTrailIndex(data.trailPoints)};
  F.SERDIN_TRAIL_POINTS_V86=data.trailPoints;F.SERDIN_CONFIG_V97=data;return data;
 };
 F.isSerdinV97World=function(server){return !!F.getSerdinV97Layout(server);};
 F.isNearSerdinSafeTrail=function(serverOrWorld,x,z){var s=serverOrWorld;if(!s||typeof s.overworld!=='function')s=serverOrWorld&&serverOrWorld.server;if(!s||!F.getSerdinV97Layout(s))return false;return FCraftGeometryV97.isNearTrail(cache.grid,Number(x),Number(z));};
 F.buildSerdinTrailNetwork=function(server){var data=F.getSerdinV97Layout(server);return data?{ok:true,alreadyMaterialized:true,pointCount:data.trailPoints.length}:{ok:false,reason:'verified_materialized_v97_geometry_required'};};
 var oldAltar=F.getFcraftExistingBossAltar;
 F.getFcraftExistingBossAltar=function(server){var current=oldAltar?oldAltar(server):null,data=F.getSerdinV97Layout(server);if(!data)return current;try{var custom=JSON.parse(String(server.persistentData.getString('fcraft_altar_custom_v94')));if(custom&&custom.verified===true&&custom.dimension==='minecraft:overworld'&&current&&current.x===Math.floor(Number(custom.x))&&current.y===Math.floor(Number(custom.y))&&current.z===Math.floor(Number(custom.z)))return current;}catch(ignored){}var p=data.bossAltar;return p?{x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)}:current;};
 var relocateHooked=false;
 function attachRelocateHook(){if(relocateHooked||!F.relocateAltarV94)return;var oldRelocate=F.relocateAltarV94;F.relocateAltarV94=function(player){var result=oldRelocate(player);if(result&&result.ok&&F.refreshSerdinSpawnGeometryV97)F.refreshSerdinSpawnGeometryV97(player.server);return result;};relocateHooked=true;}
 if(typeof ServerEvents!=='undefined')ServerEvents.loaded(function(){attachRelocateHook();});
})();
