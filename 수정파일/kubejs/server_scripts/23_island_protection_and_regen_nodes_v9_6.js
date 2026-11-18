// Designated nodes only. Natural and authored logs are never inferred from ID.
var FCraftIslandV96=(function(){
 function key(p){return String(p.dimension||p.dim)+':'+p.x+','+p.y+','+p.z;}
 function inside(b,p){return p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ;}
 function protectedAt(c,p){return p.dimension==='minecraft:overworld'&&inside(c.protection,p);}
 function nodeAt(c,p){var k=key(p);for(var i=0;i<c.nodes.length;i++){var n=c.nodes[i],blocks=n.harvestBlocks||n.blocks;for(var j=0;j<blocks.length;j++)if(key({dimension:'minecraft:overworld',x:blocks[j].x,y:blocks[j].y,z:blocks[j].z})===k)return n;}return null;}
 function farm(c,p,id){if(p.dimension!=='minecraft:overworld'||!c.farmBlocks[key(p)])return false;return /^(minecraft:(wheat|carrots|potatoes|beetroots|farmland|dirt|grass_block)|farmersdelight:(onions|cabbages|tomatoes|rice|rice_panicles))$/.test(id);}
 function allowed(c,p,id,admin,action){if(admin||!protectedAt(c,p))return true;if(farm(c,p,id))return true;return action==='break'&&nodeAt(c,p)!==null;}
 function enqueue(queue,node,now){for(var i=0;i<queue.length;i++)if(queue[i].nodeId===node.id)return {added:false,queue:queue};var q=JSON.parse(JSON.stringify(queue));q.push({nodeId:node.id,dim:'minecraft:overworld',x:node.blocks[0].x,y:node.blocks[0].y,z:node.blocks[0].z,origBlockId:node.blocks[0].state,restoreAtTick:now+node.delay,blocks:node.blocks});return {added:true,queue:q};}
 function matches(current,expected){if(current===expected)return true;if(expected.indexOf('[')<0)return current.split('[')[0]===expected;if(expected.indexOf('_leaves[')>0&&expected.indexOf('persistent=true')>0)return current.split('[')[0]===expected.split('[')[0]&&current.indexOf('persistent=true')>0;return false;}
 function due(queue,now,ready,read,write,limit){var keep=[],restored=0,conflicts=[];for(var i=0;i<queue.length;i++){var n=queue[i];if(n.restoreAtTick>now||restored>=limit||!ready(n)){keep.push(n);continue;}var valid=true;for(var j=0;j<n.blocks.length;j++){var b=n.blocks[j],current=read(n.dim,b);if(!matches(current,b.temporary)&&!matches(current,b.state)){valid=false;break;}}if(!valid){conflicts.push(n.nodeId);continue;}for(var k=0;k<n.blocks.length;k++)write(n.dim,n.blocks[k],n.blocks[k].state);restored++;}return {queue:keep,restored:restored,conflicts:conflicts};}
 return {key:key,inside:inside,protectedAt:protectedAt,nodeAt:nodeAt,farm:farm,allowed:allowed,enqueue:enqueue,due:due};
})();
if(typeof module!=='undefined')module.exports=FCraftIslandV96;
if(typeof global!=='undefined'&&global.FRankDays&&typeof ServerEvents!=='undefined')(function(){
 var F96I=global.FRankDays, islandConfig96=JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_island_v96.json')));
 function clock96(server){return Number(server.persistentData.getLong('f_rank_persistent_tick_v96'));}
 function validIsland96(server){var layout=F96I.getSerdinV94Layout(server);return !!(islandConfig96&&layout&&layout.expansionVersion==='9.6');}
 function point96(event){return {dimension:String(event.level.dimension),x:event.block.x,y:event.block.y,z:event.block.z};}
 function admin96(p){return p.isCreative()||(p.hasPermissions(2)&&p.persistentData.getBoolean('f_rank_admin_build'));}
 function notice96(p){var now=clock96(p.server),last=Number(p.persistentData.getLong('f_rank_island_notice_v96'));if(now-last<40&&now>=last)return;p.persistentData.putLong('f_rank_island_notice_v96',now);p.setStatusMessage('§e[길드 보호 구역] §f브리온·세르딘 제도의 자연 지형은 보호됩니다. 자유 건축은 본토 개척 대륙을 이용해 주세요.');}
 function queue96(server){var raw=server.persistentData.getString('f_rank_regen_queue_v96'),rows=raw?JSON.parse(String(raw)):[];for(var i=0;i<rows.length;i++){var row=rows[i],definition=null;for(var j=0;j<islandConfig96.nodes.length;j++)if(islandConfig96.nodes[j].id===row.nodeId)definition=islandConfig96.nodes[j];if(definition&&(!row.definitionSHA256||row.definitionSHA256===definition.definitionSHA256))row.blocks=definition.blocks;else row.blocks=null;}return rows;}
 function saveQueue96(server,q){var compact=[];for(var i=0;i<q.length;i++){var row=q[i],digest=row.definitionSHA256;if(!digest)for(var j=0;j<islandConfig96.nodes.length;j++)if(islandConfig96.nodes[j].id===row.nodeId)digest=islandConfig96.nodes[j].definitionSHA256;compact.push({nodeId:row.nodeId,dim:row.dim,x:row.x,y:row.y,z:row.z,origBlockId:row.origBlockId,restoreAtTick:row.restoreAtTick,definitionSHA256:digest});}var encoded=JSON.stringify(compact);if(encoded.length>60000)throw new Error('Regen queue exceeds bounded NBT string budget');server.persistentData.putString('f_rank_regen_queue_v96',encoded);}
 function blockState96(block){return String(block.blockState.toString()).replace(/^Block\{([^}]+)\}(.*)$/,'$1$2');}
 function setState96(block,spec){var begin=spec.indexOf('[');if(begin<0){block.set(spec);return;}var props={},pairs=spec.substring(begin+1,spec.length-1).split(',');for(var i=0;i<pairs.length;i++){var pair=pairs[i].split('=');props[pair[0]]=pair[1];}block.set(spec.substring(0,begin),props);}
 function harvest96(event,node){
  var server=event.server,world=event.level,q=queue96(server),check=FCraftIslandV96.enqueue(q,node,clock96(server));
  if(!check.added)return false;
  var used=F96I.captureGrowthHarvestV10?F96I.captureGrowthHarvestV10(event.player,event.player.mainHandItem,'node:'+node.id):{};
  for(var i=0;i<node.blocks.length;i++){var b=node.blocks[i];if(blockState96(world.getBlock(b.x,b.y,b.z))!==b.state)return false;}
  if(node.kind==='ore'){
   var mineable=false;try{mineable=event.block.blockState.canHarvestBlock(world,event.block.pos,event.player);}catch(noHarvestAPI){return false;}
   if(!mineable)return false;
  }
  // Persist before mutation so an interrupted harvest remains recoverable.
  saveQueue96(server,check.queue);
  for(var j=0;j<node.blocks.length;j++){var v=node.blocks[j];setState96(world.getBlock(v.x,v.y,v.z),v.temporary);}
  event.player.give(Item.of(node.drop, node.kind==='tree'?1+Math.floor(Math.random()*2):1));
  if(node.kind==='tree'||node.kind==='ore'){var tool=event.player.mainHandItem;if(tool&&!tool.empty&&tool.isDamageableItem())tool.hurtAndBreak(1,event.player,function(actor){});}
  if(F96I.onRegenResourceHarvestV96)try{F96I.onRegenResourceHarvestV96(event.player,{kind:node.kind,drop:node.drop,id:node.id,source:used.source,actionId:used.actionId});}catch(hookError){console.error('[F-Craft v96] Regen progression hook failed after one successful harvest: '+String(hookError));}
  return true;
 }
 BlockEvents.broken(function(event){
  if(event.player){var cp=point96(event);if(F96I.shouldProtectTrainingBlockV10&&F96I.shouldProtectTrainingBlockV10(event.server,cp.dimension,cp.x,cp.y,cp.z)&&!admin96(event.player)){event.cancel();return;}if(F96I.shouldProtectCottageBlockV10&&F96I.shouldProtectCottageBlockV10(event.server,cp.dimension,cp.x,cp.y,cp.z)){if(!F96I.canEditCottageBlockV10(event.player,cp.dimension,cp.x,cp.y,cp.z))event.cancel();return;}}
  if(!event.player||!validIsland96(event.server))return;
  var pos=point96(event),id=String(event.block.id),admin=admin96(event.player),node=admin?null:FCraftIslandV96.nodeAt(islandConfig96,pos);
  if(node){try{harvest96(event,node);}catch(harvestError){console.error('[F-Craft v96] Harvest interrupted; persistent queue retained for recovery: '+String(harvestError));}event.cancel();return;}
  if(!FCraftIslandV96.allowed(islandConfig96,pos,id,admin,'break')){event.cancel();notice96(event.player);}
 });
 BlockEvents.placed(function(event){
  if(event.player){var cp=point96(event);if(F96I.shouldProtectCottageBlockV10&&F96I.shouldProtectCottageBlockV10(event.server,cp.dimension,cp.x,cp.y,cp.z)){if(!F96I.canEditCottageBlockV10(event.player,cp.dimension,cp.x,cp.y,cp.z))event.cancel();return;}}
  if(!event.player||!validIsland96(event.server))return;
  if(!FCraftIslandV96.allowed(islandConfig96,point96(event),String(event.block.id),admin96(event.player),'place')){event.cancel();notice96(event.player);}
 });
 BlockEvents.rightClicked(function(event){
  if(event.player){var cp=point96(event);if(F96I.shouldProtectCottageBlockV10&&F96I.shouldProtectCottageBlockV10(event.server,cp.dimension,cp.x,cp.y,cp.z)){if(!F96I.canInteractCottageBlockV10(event.player,cp.dimension,cp.x,cp.y,cp.z))event.cancel();return;}}
  if(!event.player||!validIsland96(event.server)||admin96(event.player))return;
  var p=point96(event),id=String(event.item.id||'');
  var allowedBlock=String(event.block.id);
  if((F96I.isOfficialTravelBlockV110&&F96I.isOfficialTravelBlockV110(allowedBlock))||allowedBlock.indexOf('lootr:')===0)return;
  var blockId=String(event.block.id),container=/(_chest|barrel|_door|_trapdoor|_button|_fence_gate|crafting_table|furnace|smoker)$/.test(blockId)&&!event.player.isCrouching();
  var modifying=/_axe$/.test(id)&&/_(log|wood)$/.test(blockId)||/_hoe$/.test(id)&&/minecraft:(dirt|grass_block|coarse_dirt|rooted_dirt|dirt_path)$/.test(blockId)||!container&&(/_bucket$/.test(id)||id==='minecraft:flint_and_steel'||id==='minecraft:fire_charge');
  if(FCraftIslandV96.protectedAt(islandConfig96,p)&&!FCraftIslandV96.farm(islandConfig96,p,blockId)&&modifying){event.cancel();notice96(event.player);}
 });
 function restore96(server){
  if(!validIsland96(server))return;
  var world=server.overworld(),q=queue96(server),result=FCraftIslandV96.due(q,clock96(server),function(n){if(!n.blocks)return false;for(var i=0;i<n.blocks.length;i++)if(!world.hasChunk(n.blocks[i].x>>4,n.blocks[i].z>>4))return false;return true;},function(dim,b){return blockState96(world.getBlock(b.x,b.y,b.z));},function(dim,b,state){setState96(world.getBlock(b.x,b.y,b.z),state);},16);
  saveQueue96(server,result.queue);if(result.conflicts.length)console.warn('[F-Craft v96] Preserved administrator-changed regen nodes: '+result.conflicts.join(','));
 }
 ServerEvents.loaded(function(e){restore96(e.server);});
 ServerEvents.tick(function(e){if(!validIsland96(e.server))return;var now=clock96(e.server)+1;e.server.persistentData.putLong('f_rank_persistent_tick_v96',now);if(now%20===0)restore96(e.server);});
 ServerEvents.commandRegistry(function(e){var C=e.commands; e.register(C.literal('frank').then(C.literal('buildmode').requires(function(s){return s.hasPermission(2);}).then(C.literal('on').executes(function(c){c.source.player.persistentData.putBoolean('f_rank_admin_build',true);return 1;})).then(C.literal('off').executes(function(c){c.source.player.persistentData.putBoolean('f_rank_admin_build',false);return 1;}))));});
 F96I.ISLAND_CONFIG_V96=islandConfig96;
 F96I.isManagedRegenNodeV96=function(player,position){return !!(validIsland96(player.server)&&!admin96(player)&&FCraftIslandV96.nodeAt(islandConfig96,position));};
 F96I.restoreRegenNodesV96=restore96;F96I.getPersistentWorldTickV96=clock96;
})();
