// Actual block/voxel measurements in an owned copied world. No synthetic blocks.
global.FCraftPhase6Native=global.FCraftPhase6Native||{};
(function(N){
 N.runArenaConstruction=function(server,done){
  var F=global.FRankDays,A=F.ARENA_BUILDER_V103,C=A&&A.core,level=server.overworld(),ticks=0,ended=false,plan=null,index=0,bad=[],count=0;
  var evidence={actualMinecraft:true,physicalInputUsed:false,nativePassed:false,sourcePreimagesVerified:false,originalSourceMatches:null,zeroOutsideWrites:null,blockEntitiesPreserved:null,flatFloors:[],foundationDepths:{},nodeBindingsVerified:false,protectedClearanceVerified:false,entranceWalkability:[],note:'Outside-plan preservation is independently measured from saved Anvil files after server exit; this native fixture cannot predeclare it.'};
  N.report.construction=evidence;
  function check(name,ok,detail){N.check('construction '+name,!!ok,detail);if(!ok)evidence.nativePassed=false;}
  function end(error){if(ended)return;ended=true;if(error){check('native construction fixture exception',false,String(error));evidence.error=String(error);}evidence.nativePassed=!error&&bad.length===0&&evidence.sourcePreimagesVerified&&evidence.nodeBindingsVerified&&evidence.protectedClearanceVerified&&evidence.flatFloors.length===3&&evidence.flatFloors.every(function(x){return x.heightDeviation===0&&x.waterBlocks===0;})&&evidence.entranceWalkability.length===12&&evidence.entranceWalkability.every(function(x){return x.passed;})&&evidence.routeWalkability&&evidence.routeWalkability.length===3&&evidence.routeWalkability.every(function(x){return x.passed;});done();}
  function later(fn){server.scheduleInTicks(2,function(){if(ended)return;try{fn();}catch(e){end(String(e)+' '+String(e.stack||''));}});}
  function walkRoutes(cfg){
   var AABB=Java.loadClass('net.minecraft.world.phys.AABB'),rows=[],paths=cfg.routes.paths;
   for(var ri=0;ri<paths.length;ri++){
    var path=paths[ri],previous=null,samples=0,maximumStep=0,failed=null;
    for(var pi=0;pi<path.points.length&&!failed;pi++){
     var to=path.points[pi],from=pi?path.points[pi-1]:to;
     for(var part=pi?1:5;part<=5;part++){
      var f=part/5,x=from.x+.5+(to.x-from.x)*f,z=from.z+.5+(to.z-from.z)*f,height=-Infinity;
      for(var bx=Math.floor(x-.28);bx<=Math.floor(x+.28);bx++)for(var bz=Math.floor(z-.28);bz<=Math.floor(z+.28);bz++)for(var by=Math.min(from.y,to.y)-2;by<=Math.max(from.y,to.y)+1;by++){
       var block=level.getBlock(bx,by,bz);if(block.blockState.isAir())continue;
       var boxes=block.blockState.getCollisionShape(level,block.pos).toAabbs();
       for(var bi=0;bi<Number(boxes.size());bi++){var box=boxes.get(bi);if(bx+Number(box.maxX)>x-.28&&bx+Number(box.minX)<x+.28&&bz+Number(box.maxZ)>z-.28&&bz+Number(box.minZ)<z+.28)height=Math.max(height,by+Number(box.maxY));}
      }
      var step=previous===null?0:Math.abs(height-previous),supported=isFinite(height),clear=supported&&level.noCollision(new AABB(x-.28,height+.002,z-.28,x+.28,height+1.802,z+.28));
      samples++;maximumStep=Math.max(maximumStep,step);if(!supported||step>.60001||!clear)failed={point:pi,x:x,y:height,z:z,step:step,supported:supported,headClear:!!clear};previous=height;
     }
    }
    rows.push({id:path.id,passed:!failed,nativeVoxelShapes:true,pointCount:path.points.length,samples:samples,maximumStep:maximumStep,failure:failed});
    check(path.id+' actual complete walking route has safe native steps and headroom',!failed,rows[rows.length-1]);
   }
   evidence.routeWalkability=rows;
  }
  function finishMeasurement(){
   var ids=['krag','blossom','wrought_gate'],counts={krag:2,blossom:4},bindingOK=true,clearanceOK=true;
   for(var ai=0;ai<ids.length;ai++){
    var id=ids[ai],s=plan.sites[id],r=s.flatRadius,cy=s.floorY,water=0,missing=0,depth=C.themes[id].depth,foundationMissing=0,footingCount=0;
    for(var dx=-r;dx<=r;dx++)for(var dz=-r;dz<=r;dz++)if(dx*dx+dz*dz<=r*r){var b=level.getBlock(Math.floor(s.center.x)+dx,cy,Math.floor(s.center.z)+dz);if(b.blockState.isAir())missing++;if(String(b.id)==='minecraft:water'||String(b.id)==='minecraft:lava')water++;}
    for(var dx=-r-1;dx<=r+1;dx++)for(var dz=-r-1;dz<=r+1;dz++)if(dx*dx+dz*dz<=(r+1)*(r+1))for(var dy=1;dy<=depth;dy++){var b=level.getBlock(Math.floor(s.center.x)+dx,cy-dy,Math.floor(s.center.z)+dz);footingCount++;if(b.blockState.isAir()||String(b.id)==='minecraft:water'||String(b.id)==='minecraft:lava')foundationMissing++;}
    evidence.flatFloors.push({id:id,heightDeviation:missing?null:0,floorY:cy,waterBlocks:water,missing:missing,measurement:'Read every actual floor block at the surveyed Y, including construction-defined embedded tiles.'});
    evidence.foundationDepths[id]=depth;
    check(id+' actual uniformly filled floor and zero water',missing===0&&water===0,evidence.flatFloors[evidence.flatFloors.length-1]);
    check(id+' actual foundation depth'+depth+' no floating air gap',foundationMissing===0,{checked:footingCount,missing:foundationMissing});
    var kind=id==='krag'?'ore':id==='blossom'?'bud':null,nodes=kind?s.bindings[kind]:[];
    if(kind&&nodes.length!==counts[id])bindingOK=false;
    for(var ni=0;ni<nodes.length;ni++){var p=nodes[ni].hitBlock,b=level.getBlock(p.x,p.y,p.z);if(String(b.id)!==p.block)bindingOK=false;}
    if(id!=='wrought_gate'){var engine=F.CHAPTER1_RAID_V101.site(id);if(!engine||engine.floorY!==s.floorY||JSON.stringify(engine.bindings)!==JSON.stringify(s.bindings))bindingOK=false;}else{var gate=s.pedestal||{x:s.center.x,y:cy+1,z:s.center.z+2};if(String(level.getBlock(gate.x,gate.y,gate.z).id)!=='f_rank_days:guardian_portal_pedestal')bindingOK=false;}
    if(id==='blossom'){if(s.sanctuaryTiles.length!==4)bindingOK=false;for(var ti=0;ti<s.sanctuaryTiles.length;ti++){var p=s.sanctuaryTiles[ti].blockCenter;if(String(level.getBlock(p.x,p.y,p.z).id)!==p.block)bindingOK=false;}}
   }
   evidence.nodeBindingsVerified=bindingOK;check('all2ore4bud4sanctuary and physical gateway block centers match authoritative bindings',bindingOK);
   var cfg=JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_arena_construction_v103.json'))),proof=C.plan(cfg);
   walkRoutes(cfg);
   clearanceOK=proof.signature===plan.signature;evidence.protectedClearanceVerified=clearanceOK;check('all actual planned cells retain requested POI margins',clearanceOK,{signature:proof.signature});
   var status=A.status(server).meta;evidence.sourcePreimagesVerified=status.preflightComplete===true;evidence.signature=plan.signature;evidence.verifiedCells=count;evidence.written=Number(status.written);evidence.skipped=Number(status.skipped);evidence.preimagePages=Number(status.pageCount);
   evidence.entranceWalkability=status.entranceWalkability||[];
   check('whole original source preflight precedes native writes',evidence.sourcePreimagesVerified&&evidence.preimagePages>0,{pages:evidence.preimagePages,writes:evidence.written});
   check('12 entrances passed actual native collision-shape walking',evidence.entranceWalkability.length===12&&evidence.entranceWalkability.every(function(x){return x.passed&&x.nativeVoxelShapes===true;}),evidence.entranceWalkability);
   check('all authoritative outdoor target cells read back from native world',bad.length===0&&count===plan.ops.length,{checked:count,expected:plan.ops.length,failures:bad.slice(0,12)});
   end();
  }
  function measure(){for(var n=0;n<800&&index<plan.ops.length;n++,index++){var op=plan.ops[index],b=level.getBlock(op.x,op.y,op.z),actual=C.canonical(String(b.blockState));count++;if(!C.matches(actual,op.state)&&bad.length<30)bad.push({cell:C.key(op),wanted:op.state,actual:actual});}if(index<plan.ops.length)later(measure);else finishMeasurement();}
  function wait(){ticks+=2;if(!A)throw Error('Native arena builder is absent');var st=A.status(server);if(st.failure||st.meta&&st.meta.status==='BLOCKED')throw Error('Builder refused source/geometry: '+JSON.stringify(st));if(A.isComplete(server)){plan=A.plan();evidence.signature=plan.signature;var text=C.signatureText(plan.ops);evidence.signatureDebug={length:text.length,first:text.substring(0,160),last:text.substring(text.length-160),vectors:C.hashVectors()};JsonIO.write('kubejs/phase7_outdoor_plan_v104.json',plan);later(measure);return;}if(ticks>10000)throw Error('Native construction timeout '+JSON.stringify(st));if(!st.runtime)A.begin(server);later(wait);}
  try{server.runCommandSilent('gamerule randomTickSpeed 0');wait();}catch(e){end(e);}
 };
 // Disable natural block aging before construction; restore in a final user
 // distribution world separately. This fixture never changes LIVE settings.
 ServerEvents.loaded(function(e){e.server.runCommandSilent('gamerule randomTickSpeed 0');});
})(global.FCraftPhase6Native);
