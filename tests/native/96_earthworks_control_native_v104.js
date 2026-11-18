// Negative control: exact same mods/source world, both construction scripts omitted.
// This fixture only reads blocks and loads chunks. It never sets a block or BE.
global.FCraftPhase6Native=global.FCraftPhase6Native||{};
(function(N){
 var server=null,started=false,state=null,completed=false,waitDone=null,clock=0,plan=null,sanctum=null,target=null;
 function pure(source,name){return new Function('ServerEvents','global',String(source)+'\nreturn '+name+';')(undefined,{});}
 function readCell(level,op){var block=level.getBlock(op.x,op.y,op.z);String(block.blockState);return !!block.entity;}
 function tick(){
  if(!state||completed)return;
  var ow=server.overworld(),sl=server.getLevel('f_rank_days:guardian_sanctum'),budget=96;
  if(state.phase==='PREFLIGHT'){for(var i=0;i<budget*4&&state.index<plan.ops.length;i++,state.index++)readCell(ow,plan.ops[state.index]);if(state.index===plan.ops.length){state.phase='READ_BUILD_ORDER';state.index=0;}}
  else if(state.phase==='READ_BUILD_ORDER'){for(var i=0;i<budget&&state.index<plan.ops.length;i++,state.index++)readCell(ow,plan.ops[state.index]);if(state.index===plan.ops.length){state.phase='READ_VERIFY_ORDER';state.index=0;}}
  else if(state.phase==='READ_VERIFY_ORDER'){for(var i=0;i<budget*4&&state.index<plan.ops.length;i++,state.index++)readCell(ow,plan.ops[state.index]);if(state.index===plan.ops.length){state.phase='WAIT_FOR_REFERENCE_CLOCK';state.index=0;}}
  if(sl&&state.sanIndex<sanctum.ops.length){for(var i=0;i<512&&state.sanIndex<sanctum.ops.length;i++,state.sanIndex++)readCell(sl,sanctum.ops[state.sanIndex]);}
  if(waitDone&&state.phase==='WAIT_FOR_REFERENCE_CLOCK'&&Number(ow.getTime())>=target.targetTime-6){
   completed=true;N.report.control={actualMinecraft:true,negativeControl:true,manualBlockWrites:0,sourceTime:target.sourceTime,targetSavedTime:target.targetTime,stoppedAtTime:Number(ow.getTime()),outdoorSignature:plan.signature,outdoorCellsRead:plan.ops.length,sanctumSignature:sanctum.signature,sanctumCellsRead:state.sanIndex,buildersOmitted:true};
   N.check('control production builders omitted and no block writing fixture',!global.FRankDays.ARENA_BUILDER_V103&&!global.FRankDays.GUARDIAN_SANCTUM_V104);
   N.check('control same authoritative outdoor cell read order completed',state.phase==='WAIT_FOR_REFERENCE_CLOCK'&&state.sanIndex===sanctum.ops.length,N.report.control);
   waitDone();
  }
 }
 N.runEarthworksControl=function(s,done){server=s;waitDone=done;if(!started)throw Error('Control chunk loading did not start');};
 ServerEvents.loaded(function(e){
  server=e.server;var input=JSON.parse(String(JsonIO.readString('kubejs/phase6_native_input.json')));
  if(input.variant!=='control_earthworks')throw Error('Negative control requires explicit builder omissions');
  var sources=JSON.parse(String(JsonIO.readString('kubejs/phase7_control_cores_v104.json'))),C=pure(sources.outdoorSource,'FCraftArenaBuilderCoreV103'),S=pure(sources.sanctumSource,'FCraftSanctumBuilderCoreV104');
  plan=C.plan(JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_arena_construction_v103.json'))));sanctum=S.plan();target=JSON.parse(String(JsonIO.readString('kubejs/phase7_control_target_v104.json')));
  server.runCommandSilent('gamerule randomTickSpeed 0');server.runCommandSilent('gamerule doMobSpawning false');
  server.scheduleInTicks(40,function(){started=true;state={phase:'PREFLIGHT',index:0,sanIndex:0};server.runCommandSilent('execute in f_rank_days:guardian_sanctum run forceload add -32 -32 47 47');});
 });
 ServerEvents.tick(function(e){clock++;try{tick();}catch(error){console.error('CONTROL_FIXTURE '+String(error));}});
})(global.FCraftPhase6Native);
