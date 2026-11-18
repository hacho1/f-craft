// LAB: real Arrow entities hit fixed cores; native geometry selects ENTITY/BLOCK.
// No production hook override, forged impact event, manual core damage or metadata.
global.FCraftPhase6Native=global.FCraftPhase6Native||{};
(function(N){
 N.verifyRaidProjectileCores=function(server,p,boss,scene,done){
  var F=global.FRankDays,api=F.CHAPTER1_RAID_V101;
  var Arrow=Java.loadClass('net.minecraft.world.entity.projectile.Arrow');
  var Pickup=Java.loadClass('net.minecraft.world.entity.projectile.AbstractArrow$Pickup');
  var UUID=Java.loadClass('java.util.UUID');
  var ended=false,arrows=[],nodes=[],index=0,attempt=0;
  var original={selected:Number(p.inventory.selected),stack:p.inventory.getItem(0).copy(),x:Number(p.x),y:Number(p.y),z:Number(p.z)};
  var oldState=F.loadPlayerState(p),oldLicense=oldState.job_licenses.ranger?JSON.parse(JSON.stringify(oldState.job_licenses.ranger)):null;
  var oldJob=oldState.mana_v98&&oldState.mana_v98.active_job;
  var beforeBoss=Number(boss.health),startingHP=Number(scene.maxHP);
  var evidence={actualMinecraft:true,syntheticPrerequisites:['existing disposable online raid actor','temporary E ranger license and native bow','public production fixed-core spawn'],projectileShots:[],phaseBefore:scene.phase};
  N.report.raidProjectileCoreEvidence=N.report.raidProjectileCoreEvidence||[];
  N.report.raidProjectileCoreEvidence.push(evidence);
  function tick(){return Number(server.overworld().getTime());}
  function check(name,ok,detail){N.check('raid projectile '+name,!!ok,detail);}
  function finish(error){
   if(ended)return;ended=true;
   if(error){evidence.error=String(error);check('native helper exception',false,String(error));}
   try{
    for(var a=0;a<arrows.length;a++)if(!arrows[a].isRemoved())arrows[a].discard();
    p.inventory.setItem(0,original.stack);p.inventory.selected=original.selected;
    p.setPosition(original.x,original.y,original.z);p.setMotionX(0);p.setMotionY(0);p.setMotionZ(0);
    var state=F.loadPlayerState(p);if(oldLicense)state.job_licenses.ranger=oldLicense;else delete state.job_licenses.ranger;
    if(state.mana_v98){if(oldJob===undefined)delete state.mana_v98.active_job;else state.mana_v98.active_job=oldJob;}
    F.savePlayerState(p,state);
   }catch(cleanup){check('fixture cleanup',false,String(cleanup));}
   finally{done();}
  }
  function later(n,fn){server.scheduleInTicks(n,function(){if(ended)return;try{fn();}catch(error){finish(String(error)+' '+String(error.stack||''));}});}
  function nativeData(entity){return F.getChapter1RaidNativeDataV102(entity);}
  function prepareRanger(){
   var state=F.loadPlayerState(p);state.job_licenses.ranger=state.job_licenses.ranger||{};state.job_licenses.ranger.grade='E';
   state.mana_v98.active_job='ranger';F.savePlayerState(p,state);
   p.inventory.selected=0;p.inventory.setItem(0,Item.of('minecraft:bow'));
  }
  function runShot(){
   if(index>=nodes.length){
    var loss=beforeBoss-Number(boss.health);
    check('two physical cores destroyed by four native arrows',scene.nodes.length===0&&evidence.projectileShots.length===4,{remaining:scene.nodes.length,shots:evidence.projectileShots.length});
    check('native core completion applies exactly12percent once',Math.abs(loss-startingHP*.12)<.02,{loss:loss,expected:startingHP*.12,maxHP:startingHP});
    evidence.remaining=scene.nodes.length;evidence.bossDamage=loss;finish();return;
   }
   var node=nodes[index],h=node.hitBlock;
   if(!h)throw Error('Physical fixed core block binding is missing');
   prepareRanger();
   // Preserve the actual built geometry and record whichever native impact
   // occurs. Do not move the node body or manufacture a block-hit event.
   p.setPosition(h.x+4.5,scene.center.y,h.z+.5);p.setMotionX(0);p.setMotionY(0);p.setMotionZ(0);
   var block=p.level.getBlock(h.x,h.y,h.z),nativeNode=p.level.getEntity(UUID.fromString(node.uuid));
   check('constructed cryingobsidian and actual node '+index,!!nativeNode&&!nativeNode.isRemoved()&&String(block.id)==='minecraft:crying_obsidian',{block:String(block.id),node:node.uuid});
   var before=Number(node.hits),arrow=new Arrow(p.level,N.raw(p));
   arrow.setOwner(N.raw(p));arrow.setPos(h.x+4.5,h.y+.5,h.z+.5);arrow.setNoGravity(true);arrow.setBaseDamage(0);arrow.pickup=Pickup.DISALLOWED;
   arrow.shoot(-1,0,0,1.5,0);
   if(!p.level.addFreshEntity(arrow))throw Error('Actual Arrow spawn failed');
   arrows.push(arrow);
   var launch=String(nativeData(arrow).getString('fcraft_raid_launch_v103')),captured=launch?JSON.parse(launch):null;
   check('spawn captured immutable ranger bow '+index+':'+attempt,captured&&captured.job==='ranger'&&captured.weaponId==='minecraft:bow'&&captured.ownerUuid===String(p.uuid)&&captured.dimension===scene.center.dimension,{launch:captured});
   p.inventory.setItem(0,Item.of('minecraft:stick'));
   var row={core:index,attempt:attempt,launchedAt:tick(),arrowUUID:String(arrow.uuid),launch:captured,heldAfterSpawn:String(p.mainHandItem.id),before:before};
   evidence.projectileShots.push(row);
   var polls=0;
   function awaitImpact(){
    var consumed=nativeData(arrow).getBoolean('fcraft_raid_node_consumed_v103');
    if(!consumed&&!arrow.isRemoved()&&polls++<16){later(1,awaitImpact);return;}
    row.after=Number(node.hits);row.impactAt=tick();row.removed=arrow.isRemoved();row.nativeImpactConsumed=consumed;row.actualImpactRoute=String(nativeData(arrow).getString('fcraft_raid_node_impact_v104'));row.heldAtImpact=String(p.mainHandItem.id);
    var valid=consumed&&arrow.isRemoved()&&['ENTITY','BLOCK'].indexOf(row.actualImpactRoute)>=0&&row.heldAtImpact==='minecraft:stick'&&before-row.after===2;
    check('real core impact uses launch weapon after heldstick '+index+':'+attempt,valid,row);
    if(!valid){finish();return;}
    if(attempt===0){attempt=1;later(6,runShot);}else{
     var remainingNode=p.level.getEntity(UUID.fromString(node.uuid));
     check('two ranged hits remove actual core entity '+index,node.hits<=0&&(!remainingNode||remainingNode.isRemoved()),{uuid:node.uuid,hits:Number(node.hits),present:!!remainingNode});
     attempt=0;index++;later(6,runShot);
    }
   }
   later(1,awaitImpact);
  }
  try{
   if(!api||!F.getChapter1RaidNativeDataV102)throw Error('Actual raid API/Forge metadata helper unavailable');
   if(scene.id!=='wrought'||scene.status!=='ACTIVE'||scene.nodes.length)throw Error('Expected active Wrought after previous cores are removed');
   api.spawnBossGimmickNodes(server,boss,scene,'magnetic',2);
   later(2,function(){nodes=scene.nodes.slice();check('production fixed magnetic pair spawned',nodes.length===2&&nodes.every(function(n){return n.kind==='magnetic'&&n.hits===4&&n.hitBlock;}),{nodes:nodes});if(nodes.length!==2){finish();return;}runShot();});
  }catch(error){finish(String(error)+' '+String(error.stack||''));}
 };
})(global.FCraftPhase6Native);
