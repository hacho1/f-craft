// Life/exploration effects use completed native actions and existing world protection.
global.FRankDays=global.FRankDays||{};
(function(F){
 var tickState={},useState={},farmBusy={},scanUntil={},fishingXp={};
 var CROPS={'minecraft:wheat':{max:7,seed:'minecraft:wheat_seeds',drop:'minecraft:wheat'},'minecraft:carrots':{max:7,seed:'minecraft:carrot',drop:'minecraft:carrot'},'minecraft:potatoes':{max:7,seed:'minecraft:potato',drop:'minecraft:potato'},'minecraft:beetroots':{max:3,seed:'minecraft:beetroot_seeds',drop:'minecraft:beetroot'}};
 function key(p){return String(p.uuid);}
 function now(p){return Number(p.server.overworld().getTime());}
 function has(p,j,n){return F.hasPassivePhase4(p,j,n);}
 function roll(p,chance){return Number(p.random.nextFloat())<chance;}
 function effect(p,id,ticks,amp){p.potionEffects.add('minecraft:'+id,ticks,amp||0,false,false);}
 function age(b){return Number(F.getBlockProp(b,'age')||0);}
 function where(p,b){return{dimension:String(p.level.dimension),x:Number(b.x),y:Number(b.y),z:Number(b.z)};}
 function give(p,id,count){if(Item.exists(id))p.give(Item.of(id,count||1));}
 function herb(id){return /minecraft:(dandelion|poppy|allium|blue_orchid|red_mushroom|brown_mushroom|sweet_berry_bush|glow_lichen)$|farmersdelight:wild_/.test(id);}
 function specialOre(id){return /mana|hardened/.test(id);}
 function same(a,b){return String(a.id)===String(b.id)&&Number(a.count)===Number(b.count)&&String(a.nbt)===String(b.nbt);}
 function useOn(p,stack,x,y,z){
  var Vec=Java.loadClass('net.minecraft.world.phys.Vec3'),Hit=Java.loadClass('net.minecraft.world.phys.BlockHitResult'),Pos=Java.loadClass('net.minecraft.core.BlockPos'),Dir=Java.loadClass('net.minecraft.core.Direction'),Hand=Java.loadClass('net.minecraft.world.InteractionHand');
  return p.gameMode.useItemOn(p,p.level,stack,Hand.MAIN_HAND,new Hit(new Vec(x+.5,y+1,z+.5),Dir.UP,new Pos(x,y,z),false));
 }
 function nativeReplant(p,b,c){
  // Real destroy/useItemOn posts all Forge/KubeJS/claim checks. A rejected placement returns its seed.
  if(F.countPlayerItem(p,c.seed)<1)return false;
  var original=p.mainHandItem,oldId=String(b.id),Hand=Java.loadClass('net.minecraft.world.InteractionHand');
  if(!F.consumePlayerItemExact(p,c.seed,1))return false;
  if(!p.gameMode.destroyBlock(b.pos)){give(p,c.seed,1);return false;}
  var seed=Item.of(c.seed),left=1;
  try{p.setItemInHand(Hand.MAIN_HAND,seed);useOn(p,seed,Number(b.x),Number(b.y)-1,Number(b.z));left=Number(seed.count);}
  finally{p.setItemInHand(Hand.MAIN_HAND,original);if(left>0)give(p,c.seed,left);}
  return String(p.level.getBlock(b.x,b.y,b.z).id)===oldId&&age(p.level.getBlock(b.x,b.y,b.z))===0;
 }
 F.handleFarmerRightClickPhase4=function(e){
  var p=e.player,b=e.block;if(!p||!b||farmBusy[key(p)]||!/_hoe$|scythe/.test(String(e.item.id)))return;
  var id=String(b.id),c=CROPS[id],shift=p.isShiftKeyDown();
  if(shift&&has(p,'farmer',2)){var moisture=F.getBlockProp(b,'moisture'),growth=F.getBlockProp(b,'age');if(moisture!==undefined||growth!==undefined){p.tell('[토양 진단] '+(moisture!==undefined?'수분 '+moisture+'/7':'성장 '+growth+'/'+(c?c.max:'?')));e.cancel();return;}}
  if(!shift&&c&&age(b)>=c.max&&has(p,'farmer',4)){
   var s=F.loadPlayerState(p);if(F.GRADE_ORDER.indexOf(s.job_licenses.farmer.grade)<F.GRADE_ORDER.indexOf('E'))return;
   var radius=has(p,'farmer',7)?1:0;farmBusy[key(p)]=true;
   try{for(var dx=-radius;dx<=radius;dx++)for(var dz=-radius;dz<=radius;dz++){var target=p.level.getBlock(b.x+dx,b.y,b.z+dz),crop=CROPS[String(target.id)];if(crop&&age(target)>=crop.max)nativeReplant(p,target,crop);}}
   finally{delete farmBusy[key(p)];}e.cancel();return;
  }
  if(!shift&&has(p,'farmer',5)&&/minecraft:(iron|golden|diamond|netherite)_hoe/.test(String(e.item.id))&&/minecraft:(dirt|grass_block|dirt_path)$/.test(id)){
   farmBusy[key(p)]=true;try{for(var x=-1;x<=1;x++)for(var z=-1;z<=1;z++){var ground=p.level.getBlock(b.x+x,b.y,b.z+z);if(/minecraft:(dirt|grass_block|dirt_path)$/.test(String(ground.id)))useOn(p,p.mainHandItem,ground.x,ground.y,ground.z);}}finally{delete farmBusy[key(p)];}e.cancel();
  }
 };
 function successfulHarvest(p,id,drop,natural,kind,identity,used){
  if(kind==='crop'){
   var chance=has(p,'farmer',6)? .35:has(p,'farmer',3)? .15:0;if(roll(p,chance))give(p,drop,1);
   if(has(p,'farmer',6)){var s=F.loadPlayerState(p),r=s.phase4_growth||(s.phase4_growth={version:1,categories:{},cooldowns:{},discovery:{}});r.farmerHarvests=Number(r.farmerHarvests||0)+1;if(r.farmerHarvests%20===0)give(p,'minecraft:golden_carrot',1);F.savePlayerState(p,s);}
  }
  if(kind==='herb'){
   if(has(p,'herbalist',1)&&roll(p,.2))give(p,drop,1);
   if(has(p,'herbalist',2)&&/mushroom|berr/.test(id)&&roll(p,.25))give(p,drop,1);
   if(has(p,'herbalist',4)&&roll(p,.15))give(p,/mushroom/.test(id)?'minecraft:brown_mushroom':'minecraft:wheat_seeds',1);
   if(has(p,'herbalist',6)&&roll(p,F.chapter1RareChanceV10?F.chapter1RareChanceV10(.08,used&&used.source):.08))give(p,'f_rank_days:mana_stone_powder',1);
  }
  if(used&&F.onChapter1CompletedHarvestV10&&(kind==='crop'||natural))F.onChapter1CompletedHarvestV10(p,used.source,used.actionId,drop,kind==='crop'||natural);
  if(kind==='ore'&&natural){var chance=has(p,'prospector',7)? .4:has(p,'prospector',5)&&specialOre(id)? .25:has(p,'prospector',2)&&!specialOre(id)? .15:0;if(roll(p,chance))give(p,drop,1);}
 }
 F.handleFarmerBrokenPhase4=function(e){
  var p=e.player,b=e.block,c=b&&CROPS[String(b.id)];if(!p||!c||age(b)<c.max)return;
  var pos=where(p,b),before=String(b.blockState),id=String(b.id),used=F.captureGrowthHarvestV10?F.captureGrowthHarvestV10(p,p.mainHandItem,'crop'):{};p.server.scheduleInTicks(1,function(){if(String(p.level.dimension)!==pos.dimension)return;if(String(p.level.getBlock(pos.x,pos.y,pos.z).blockState)===before)return;successfulHarvest(p,id,c.drop,true,'crop',pos.dimension+'|'+pos.x+','+pos.y+','+pos.z,used);});
 };
 var regen=F.onRegenResourceHarvestV96;
 F.onRegenResourceHarvestV96=function(p,info){var result=regen?regen(p,info):false;if(result&&info)successfulHarvest(p,String(info.id),String(info.drop),true,info.kind==='herb'?'herb':info.kind==='ore'?'ore':'tree',info.id,{source:info.source,actionId:info.actionId});return result;};
 BlockEvents.broken(function(e){
  var p=e.player,b=e.block;if(!p||!b||CROPS[String(b.id)])return;
  var id=String(b.id),kind=/_ore/.test(id)?'ore':herb(id)?'herb':null;if(!kind)return;var pos=where(p,b);if(F.isManagedRegenNodeV96&&F.isManagedRegenNodeV96(p,pos))return;
  var used=F.captureGrowthHarvestV10?F.captureGrowthHarvestV10(p,p.mainHandItem,'natural:'+kind):{},natural=F.isNaturalTraitHarvestV98(p.server,pos),before=String(b.blockState),drops=b.getDrops(p,p.mainHandItem),drop=null;
  for(var i=0;i<drops.size();i++)if(!drops.get(i).empty){drop=String(drops.get(i).id);break;}if(!drop)return;
  p.server.scheduleInTicks(1,function(){if(String(p.level.dimension)!==pos.dimension)return;if(String(p.level.getBlock(pos.x,pos.y,pos.z).blockState)===before)return;successfulHarvest(p,id,drop,natural,kind,pos.dimension+'|'+pos.x+','+pos.y+','+pos.z,used);});
 });
 F.onPassiveBreakSpeedPhase4=function(e){var p=e.getEntity();if(p&&has(p,'prospector',1)&&/_pickaxe$/.test(String(p.mainHandItem.id)))e.setNewSpeed(Number(e.getNewSpeed())*1.1);};
 F.onPassiveUseStartPhase4=function(e){
  var p=e.getEntity();if(!p||!p.isPlayer())return;delete useState[key(p)];var item=e.getItem(),id=String(item.id);if(!/potion|crossbow/.test(id))return;
  var ammo=/crossbow/.test(id)?p.getProjectile(item):null;useState[key(p)]={item:id,ammo:ammo,ammoCount:ammo?Number(ammo.count):0,effects:effectSnapshot(p)};
 };
 function effectSnapshot(p){var map={},list=new (Java.loadClass('java.util.ArrayList'))(p.getActiveEffects());for(var i=0;i<list.size();i++){var effect=list.get(i);map[String(effect.getEffect().getDescriptionId())]=Number(effect.getDuration());}return map;}
 function extendNewEffects(p,before){
  if(!has(p,'herbalist',5))return;
  var Effect=Java.loadClass('net.minecraft.world.effect.MobEffectInstance'),list=new (Java.loadClass('java.util.ArrayList'))(p.getActiveEffects());
  for(var i=0;i<list.size();i++){var e=list.get(i),duration=Number(e.getDuration());if(!e.getEffect().isBeneficial()||duration<=Number(before[String(e.getEffect().getDescriptionId())]||0))continue;p.addEffect(new Effect(e.getEffect(),Math.floor(duration*1.4),e.getAmplifier(),e.isAmbient(),e.isVisible(),e.showIcon()));}
 }
 F.onPassiveUseFinishPhase4=function(e){var p=e.getEntity();if(!p||!p.isPlayer())return;var saved=useState[key(p)];delete useState[key(p)];if(!saved)return;if(/potion/.test(saved.item))p.server.scheduleInTicks(1,function(){extendNewEffects(p,saved.effects);});if(/crossbow/.test(saved.item))refundArrow(p,saved.ammo,saved.ammoCount);};
 function refundArrow(p,ammo,before){if(!ammo||p.isCreative()||!has(p,'ranger',3))return;var ammoId=String(ammo.id),chance=has(p,'ranger',6)? .5:.25;p.server.scheduleInTicks(1,function(){if(Number(ammo.count)!==before-1)return;if(roll(p,chance))give(p,ammoId,1);});}
 F.onPassiveArrowLoosePhase4=function(e){if(e.isCanceled()||Number(e.getCharge())<3)return;var p=e.getEntity();if(!p||p.isCreative())return;var ammo=p.getProjectile(e.getBow());refundArrow(p,ammo,Number(ammo.count));};
 F.queueFishingXpPhase4=function(p,hook){fishingXp[key(p)]={player:p,hook:String(hook.uuid),tick:now(p),paid:false};};
 F.onPassiveEntityJoinPhase4=function(e){
  var orb=e.getEntity(),Orb=Java.loadClass('net.minecraft.world.entity.ExperienceOrb');if(!(orb instanceof Orb)||Number(orb.getValue())<=0)return;
  // An ore, mob or command orb never qualifies. Native FishingHook.retrieve must be on this call stack.
  var pending=false;for(var owner in fishingXp){var request=fishingXp[owner];if(!request.paid&&now(request.player)===request.tick){pending=true;break;}}if(!pending)return;
  var frames=new (Java.loadClass('java.util.NoSuchElementException'))().getStackTrace(),fromFishing=false;
  for(var i=0;i<frames.length;i++)if(String(frames[i].getClassName())==='net.minecraft.world.entity.projectile.FishingHook'){fromFishing=true;break;}if(!fromFishing)return;
  var candidate=null;
  for(var id in fishingXp){var q=fishingXp[id],p=q.player;if(q.paid||now(p)!==q.tick||!p.level.equals(e.getLevel()))continue;var dx=Number(p.x)-Number(orb.x),dy=Number(p.y)+.5-Number(orb.y),dz=Number(p.z)+.5-Number(orb.z);if(dx*dx+dy*dy+dz*dz>2)continue;if(candidate)return;candidate=q;}
  if(!candidate)return;candidate.paid=true;var p=candidate.player,s=F.loadPlayerState(p),r=s.phase4_growth||(s.phase4_growth={version:1,categories:{},cooldowns:{},discovery:{}}),exact=Number(orb.getValue())*.5+Number(r.fishingXpFraction||0),bonus=Math.floor(exact);r.fishingXpFraction=exact-bonus;F.savePlayerState(p,s);if(bonus>0)p.giveExperiencePoints(bonus);
 };
 var SPECIAL_FOOD=['f_rank_days:golden_wheat_stew','f_rank_days:harvest_berry_tart','f_rank_days:serdin_herb_ration'];
 ItemEvents.foodEaten(function(e){
  var p=e.player||e.entity;if(!p||!p.isPlayer())return;var item=e.item,id=String(item.id),food=item.getFoodProperties(p);if(!food)return;
  var cooked=id.indexOf('farmersdelight:')===0||/bread|stew|soup|ration|tart|cooked|baked/.test(id),special=SPECIAL_FOOD.indexOf(id)>=0;
  if(cooked&&has(p,'chef',1))p.saturation=Math.min(Number(p.foodLevel),Number(p.saturation)+Number(food.getNutrition())*Number(food.getSaturationModifier())*2*.15);
  if(cooked&&has(p,'chef',5)){effect(p,'strength',200,0);effect(p,'speed',200,0);}
  if(special&&has(p,'chef',7)&&F.getManaAlliesV98){var friends=F.getManaAlliesV98(p,7);for(var i=0;i<friends.length;i++){effect(friends[i],'strength',200,0);effect(friends[i],'speed',200,0);friends[i].saturation=Math.min(Number(friends[i].foodLevel),Number(friends[i].saturation)+2);}}
  if(id==='f_rank_days:alchemist_clear_tea'&&has(p,'herbalist',5)){var s=F.loadPlayerState(p);if(s.mana_v98&&s.mana_v98.tea_until){s.mana_v98.tea_until=now(p)+560;F.savePlayerState(p,s);}}
 });
 ItemEvents.crafted(function(e){
  var p=e.player,id=String(e.item.id);if(!p)return;
  if(has(p,'herbalist',7)&&id==='f_rank_days:ancient_reawakening_incense'&&roll(p,.35))give(p,id,1);
  if(has(p,'chef',4)&&SPECIAL_FOOD.indexOf(id)>=0&&roll(p,.2))give(p,id,1);
  if(has(p,'chef',3)&&/beef|porkchop|chicken|mutton|rabbit|knife/.test(id)&&roll(p,.2))give(p,'minecraft:bone_meal',1);
 });
 ItemEvents.smelted(function(e){if(e.player&&has(e.player,'blacksmith',3)&&/_ingot$/.test(String(e.item.id))&&roll(e.player,.2))give(e.player,String(e.item.id),1);});
 function onceDiscovery(p,id,kind){
  var s=F.loadPlayerState(p),r=s.phase4_growth||(s.phase4_growth={version:1,categories:{},cooldowns:{},discovery:{}});r.discovery=r.discovery||{};var token=kind+'|'+id;if(r.discovery[token])return;r.discovery[token]=true;F.savePlayerState(p,s);
  if(has(p,'relic_researcher',4)&&roll(p,.25))give(p,'f_rank_days:ancient_fragment',1);
  if(kind==='cache'&&has(p,'relic_researcher',7)&&roll(p,.25))give(p,'f_rank_days:tempering_stone',1);
 }
 var rubbing=F.collectDesignatedRubbingV94;
 if(rubbing)F.collectDesignatedRubbingV94=function(p,pos,held){var before=F.countPlayerItem(p,'minecraft:paper'),r=rubbing(p,pos,held);if(r&&r.ok){if(has(p,'relic_researcher',2)&&F.countPlayerItem(p,'minecraft:paper')<before&&roll(p,.25))give(p,'minecraft:paper',1);onceDiscovery(p,pos.dimension+'|'+pos.x+','+pos.y+','+pos.z,'stela');}return r;};
 var opened=F.onSerdinTreasureMenuOpenedV97;
 if(opened)F.onSerdinTreasureMenuOpenedV97=function(e){var r=opened(e);if(r&&r.ok&&!r.already){var inv=e.inventory;onceDiscovery(e.player,String(inv.getTileId()),'cache');}return r;};
 F.isInsideDungeonPhase4=function(p){
  if(String(p.level.dimension)==='minecraft:the_nether'||String(p.level.dimension)==='minecraft:the_end')return true;
  var cfg=F.getSerdinV97Layout&&F.getSerdinV97Layout(p.server);if(!cfg)return false;
  var pois=cfg.treasurePois||[];for(var i=0;i<pois.length;i++){var q=pois[i],dx=Number(p.x)-q.x,dz=Number(p.z)-q.z;if(q.track==='structure'&&Math.abs(Number(p.y)-q.y)<=24&&dx*dx+dz*dz<=256)return true;}return false;
 };
 F.craftEfficientNectarPhase4=function(p){
  if(!has(p,'blacksmith',7))return{ok:false,reason:'requires_master_blacksmith',message:'대장장이 7단 특전이 필요합니다.'};
  return F.runAtomicPlayerV96(p,function(){
   var ingredients=[['f_rank_days:golden_wheat_stew',1],['f_rank_days:refined_mana_stone',1],['f_rank_days:hardened_ingot',1],['minecraft:blaze_powder',1]];
   for(var i=0;i<ingredients.length;i++)if(F.countPlayerItem(p,ingredients[i][0])<ingredients[i][1])return{ok:false,reason:'missing_nectar_materials',message:'황금 밀 스튜 1 · 정제 마력석 1 · 경화광 주괴 1 · 블레이즈 가루 1이 필요합니다.'};
   for(var j=0;j<ingredients.length;j++)if(!F.consumePlayerItemExact(p,ingredients[j][0],ingredients[j][1]))throw new Error('Verified synchronous nectar withdrawal failed');
   give(p,'bosses_of_mass_destruction:brimstone_nectar',1);return{ok:true,message:'[명장 효율 조합] 마력석 1개를 절약해 유황 넥타르를 만들었습니다.'};
  });
 };
 function scan(p,item){
  if(!(/_pickaxe$/.test(item)&&p.isShiftKeyDown()&&has(p,'prospector',4))&&!(item==='minecraft:compass'&&has(p,'pathfinder',4)))return;
  var t=now(p),id=key(p);if(Number(scanUntil[id]||0)>t)return;scanUntil[id]=t+100;
  var radius=has(p,'prospector',7)?16:10;
  if(/_pickaxe$/.test(item)&&p.isShiftKeyDown()&&has(p,'prospector',4)){
   var found=[],cx=Math.floor(p.x),cy=Math.floor(p.y),cz=Math.floor(p.z);
   for(var x=-radius;x<=radius;x++)for(var y=-radius;y<=radius;y++)for(var z=-radius;z<=radius;z++){if(x*x+y*y+z*z>radius*radius||!p.level.hasChunk((cx+x)>>4,(cz+z)>>4))continue;var b=p.level.getBlock(cx+x,cy+y,cz+z);if(/_ore/.test(String(b.id)))found.push({id:String(b.id),x:b.x,y:b.y,z:b.z,d:x*x+y*y+z*z});}
   found.sort(function(a,b){return a.d-b.d;});if(found.length)p.tell('[광맥 공명] '+radius+'m 안 '+found.length+'블록 · 최근접 '+found[0].id+' ('+found[0].x+', '+found[0].y+', '+found[0].z+')');else p.tell('[광맥 공명] '+radius+'m 안에 확인된 광석이 없습니다.');
  }
  if(item==='minecraft:compass'&&has(p,'pathfinder',4)){
   var idx=F.getSerdinTreasureIndexV97&&F.getSerdinTreasureIndexV97(p.server),s=F.loadPlayerState(p),seen=s.serdin_treasure_v97&&s.serdin_treasure_v97.opened||{},near=[];
   if(idx)for(var i=0;i<idx.containers.length;i++){var c=idx.containers[i],dx=p.x-c.x,dy=p.y-c.y,dz=p.z-c.z;if(!seen[c.id]&&dx*dx+dy*dy+dz*dz<=256)near.push(c);}
   p.tell('[숨은 길] '+(near.length?'16m 안에 아직 열지 않은 은닉처 '+near.length+'개가 감지됩니다.':'16m 안에 확인된 미개봉 은닉처가 없습니다.'));
  }
 }
 ItemEvents.rightClicked(function(e){if(e.player)scan(e.player,String(e.item.id));});
 PlayerEvents.tick(function(e){
  var p=e.player,id=key(p),t=now(p),s=tickState[id]||(tickState[id]={});
  var held=p.mainHandItem;if(!held.empty&&held.isDamageableItem()){
   var signature=String(held.id)+'|'+String(held.nbt&&held.nbt.f_rank_enhance_lv||0),damage=Number(held.damageValue);
   if(!F.GROWTH_NATIVE_BRIDGE_V10&&s.stack&&held.equals(s.stack)&&s.item===signature&&damage>s.damage&&damage-s.damage<=4&&roll(p,F.getPassiveDurabilityProtectionPhase4(p,held))){held.setDamageValue(Math.max(0,damage-(damage-s.damage)));damage=Number(held.damageValue);}
   s.stack=held;s.item=signature;s.damage=damage;
  }else{s.stack=null;s.item=null;s.damage=0;}
  if(has(p,'pathfinder',5)&&p.isSprinting()){
   var exhaustion=Number(p.getFoodData().getExhaustionLevel());if(s.exhaustion!==undefined&&exhaustion>s.exhaustion&&exhaustion-s.exhaustion<=.3)p.getFoodData().setExhaustion(exhaustion-(exhaustion-s.exhaustion)*.25);s.exhaustion=Number(p.getFoodData().getExhaustionLevel());
  }
  var sleeping=p.isSleeping();if(s.sleeping&&!sleeping&&has(p,'pathfinder',6)){effect(p,'speed',1200,0);effect(p,'regeneration',300,0);}s.sleeping=sleeping;
 });
 PlayerEvents.loggedOut(function(e){delete tickState[key(e.player)];delete useState[key(e.player)];delete scanUntil[key(e.player)];delete fishingXp[key(e.player)];});
 ServerEvents.loaded(function(){tickState={};useState={};farmBusy={};scanUntil={};fishingXp={};});
})(global.FRankDays);
