// Permanent UUID modifiers, real native damage/roll/fishing paths and bounded player sampling.
global.FRankDays=global.FRankDays||{};
(function(F){
 var runtime={},lastServer=null,slots=[
 ['sprint','minecraft:generic.movement_speed',0.18,'multiply_base'],
 ['might','minecraft:generic.attack_damage',0.15,'multiply_base'],
 ['frail','minecraft:generic.max_health',-4,'add'],
 ['night','minecraft:generic.attack_damage',0.12,'multiply_base'],
 ['glare_move','minecraft:generic.movement_speed',-0.10,'multiply_base'],
 ['glare_attack','minecraft:generic.attack_speed',-0.10,'multiply_base'],
 ['heavy_health','minecraft:generic.max_health',4,'add'],
 ['heavy_knockback','minecraft:generic.knockback_resistance',0.40,'add'],
 ['heavy_move','minecraft:generic.movement_speed',-0.08,'multiply_base'],
 ['heavy_swim','forge:swim_speed',-0.20,'multiply_base'],
 ['overload','minecraft:generic.movement_speed',-0.12,'multiply_base']];
 function isPlayer(p){return p&&typeof p.isPlayer==='function'&&p.isPlayer();}
 function id(p){return String(p.uuid);}
 function trait(p){return F.loadPlayerState(p).special_ability.ability_id;}
 function tick(p){return Number(p.level.getTime());}
 function effect(p,key,ticks,amp){p.potionEffects.add(key,ticks,amp,false,false);}
 function fixed(i){return'9f96a100-3eb4-4eed-8ad6-'+('000000000000'+(i+1)).slice(-12);}
 F.TRAIT_MODIFIER_SLOTS_V96=slots;F.traitModifierUuidV96=fixed;
 function attribute(p,key){var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),map={'minecraft:generic.movement_speed':A.MOVEMENT_SPEED,'minecraft:generic.attack_damage':A.ATTACK_DAMAGE,'minecraft:generic.max_health':A.MAX_HEALTH,'minecraft:generic.attack_speed':A.ATTACK_SPEED,'minecraft:generic.knockback_resistance':A.KNOCKBACK_RESISTANCE};var type=key==='forge:swim_speed'?Java.loadClass('net.minecraftforge.common.ForgeMod').SWIM_SPEED.get():map[key];return p.getAttribute(type);}
 F.getTraitRuntimeV96=function(p){if(lastServer!==p.server&&!(lastServer&&lastServer.equals&&lastServer.equals(p.server))){lastServer=p.server;runtime={};}var k=id(p);return runtime[k]||(runtime[k]={key:null,casts:[],overloaded:false,lastPos:null});};
 F.applyTraitModifiersV96=function(p,force){
   var t=trait(p),rt=F.getTraitRuntimeV96(p),tm=((Number(p.level.getDayTime())%24000)+24000)%24000;rt.trait=t;
   var b=p.level.getBlock(Math.floor(p.x),Math.floor(p.y+1),Math.floor(p.z));
   var dark=tm>=13000||Number(b.light)<=7;
   var clear=!p.level.isRaining(),glare=tm>=0&&tm<=12000&&clear&&!!b.canSeeSky&&p.headArmorItem.empty;
   var empty=0;for(var i=0;i<36;i++)if(p.inventory.getItem(i).empty)empty++;
   rt.overloaded=t==='hoarder_greed'&&empty<=6;
   var key=[t,dark,glare,rt.overloaded,p.isInWater(),String(p.level.dimension)].join('|');if(!force&&rt.key===key)return;rt.key=key;
   var active={sprint:t==='overheated_sprint',might:t==='reckless_might',frail:t==='frail_artisan',night:t==='nocturnal_eyes'&&dark,glare_move:t==='nocturnal_eyes'&&glare,glare_attack:t==='nocturnal_eyes'&&glare,heavy_health:t==='heavy_bones',heavy_knockback:t==='heavy_bones',heavy_move:t==='heavy_bones',heavy_swim:t==='heavy_bones'&&p.isInWater(),overload:rt.overloaded};
   var UUID=Java.loadClass('java.util.UUID'),Modifier=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),Operation=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation');
   for(var j=0;j<slots.length;j++){var s=slots[j],inst=attribute(p,s[1]),key=UUID.fromString(fixed(j));if(!inst)throw new Error('Missing trait attribute '+s[1]);inst.removeModifier(key);if(active[s[0]]){inst.addPermanentModifier(new Modifier(key,'fcraft_v96_'+s[0],s[2],s[3]==='add'?Operation.ADDITION:Operation.MULTIPLY_BASE));if(!inst.getModifier(key))throw new Error('Trait attribute not applied: '+s[1]);}}
   if(Number(p.health)>Number(p.maxHealth))p.health=Number(p.maxHealth);
   if(t==='nocturnal_eyes'&&dark)effect(p,'minecraft:night_vision',320,0);
   if(t==='reckless_might')effect(p,'minecraft:haste',80,0);
   if(F.syncHudV96)F.syncHudV96(p);
 };
 F.traitMagicProfileV96=function(p,baseDamage,baseCooldown){var t=trait(p);return{damage:baseDamage*(t==='leaky_mana'?1.25:1),cooldown:Math.floor(baseCooldown*(t==='leaky_mana'?0.8:1))};};
 F.onTraitSkillCastV96=function(p){if(trait(p)==='leaky_mana')p.addExhaustion(2.0);};
 function wear(p){var s=p.mainHandItem;if(s&&!s.empty&&s.isDamageableItem())s.hurtAndBreak(1,p,function(entity){});}
 function distance(a,b){var x=Number(a.x)-Number(b.x),y=Number(a.y)-Number(b.y),z=Number(a.z)-Number(b.z);return Math.sqrt(x*x+y*y+z*z);}
 function hostile(e){return Boolean(e&&e.getEntityType&&String(e.getEntityType().getCategory()).toLowerCase()==='monster');}
 F.traitIncomingMultiplierV96=function(t,dist,hostileCount){return(t==='reckless_might'?1.10:1)*(t==='jumpy_instinct'&&hostileCount>=4?1.15:1)*(t==='tunnel_vision'&&dist<=3?1.20:1);};
 F.onTraitHurtV96=function(e){var target=e.getEntity(),src=e.getSource(),a=src.actual,direct=src.immediate,amount=Number(e.getAmount());if(!(amount>0))return;
   if(isPlayer(target)){
     var t=trait(target),count=0;if(t==='jumpy_instinct'){var box=target.getBoundingBox().inflate(8),list=target.level.getEntitiesWithin(box);for(var i=0;i<list.size();i++){var m=list.get(i);if(m.isAlive()&&hostile(m)&&distance(m,target)<=8)count++;}}
     amount*=F.traitIncomingMultiplierV96(t,a?distance(a,target):999,count);
   }
   if(isPlayer(a)){
     var at=trait(a),mana=F.getTraitRuntimeV96(a).activeManaDamage,projectile=!!(mana&&mana.ranged)||direct&&!direct.equals(a);
     if(at==='tunnel_vision'&&projectile&&distance(a,target)>=5)amount*=1.22;
     if(at==='reckless_might'&&!projectile&&!(mana&&mana.noToolWear))wear(a);
   }e.setAmount(amount);
 };
 F.onNativeCombatRollV96=function(p){if(isPlayer(p)&&trait(p)==='jumpy_instinct')effect(p,'minecraft:speed',40,1);};
 F.onTraitJumpV96=function(e){var p=e.getEntity();if(isPlayer(p)&&trait(p)==='overheated_sprint'&&p.isSprinting())p.addExhaustion(0.12);};
 F.traitCounterBonusV96=function(p,baseMultiplier){return trait(p)==='jumpy_instinct'?1+(baseMultiplier-1)*1.5:baseMultiplier;};
 F.onTraitDiscoveryV96=function(p,key){var s=F.loadPlayerState(p);s.trait_discoveries_v96=s.trait_discoveries_v96||{};if(s.trait_discoveries_v96[String(key)])return false;s.trait_discoveries_v96[String(key)]=true;F.savePlayerState(p,s);return F.tryHoarderRewardV96(p);};
 F.tryHoarderRewardV96=function(p){if(trait(p)!=='hoarder_greed'||Number(p.random.nextFloat())>=0.25)return false;F.grantPlayerCurrencyV8(p,2+Number(p.random.nextInt(4)),false);return true;};
 F.onTraitFishedV96=function(e){var p=e.getEntity();if(!isPlayer(p)||e.isCanceled())return;var drops=e.getDrops();if(drops.size()<1)return;
   if(trait(p)==='frail_artisan'&&Number(p.random.nextFloat())<0.20){var extra=drops.get(0).copy();extra.count=1;drops.add(extra);}
   F.tryHoarderRewardV96(p);if(F.recordJobActivityV96)F.recordJobActivityV96(p,'fished',1);if(F.onPassiveFishedPhase4)F.onPassiveFishedPhase4(e);
 };
 var placedOreKey='f_rank_days_placed_ores_v98';
 function ore(id){return String(id).indexOf('_ore')>=0;}
 function placedKey(where){return where.dimension+'|'+where.x+','+where.y+','+where.z;}
 function placedTag(server,create){var data=server.persistentData;if(!data.contains(placedOreKey)){if(!create)return null;var Tag=Java.loadClass('net.minecraft.nbt.CompoundTag');data.put(placedOreKey,new Tag());}return data.getCompound(placedOreKey);}
 F.isNaturalTraitHarvestV98=function(server,where){var tag=placedTag(server,false);return !tag||!tag.getBoolean(placedKey(where));};
 function eligibleHarvest(b){var bid=String(b.id),age=F.getBlockProp(b,'age');var mature={wheat:7,carrots:7,potatoes:7,beetroots:3,nether_wart:3,sweet_berry_bush:3};for(var c in mature)if(bid==='minecraft:'+c)return Number(age)>=mature[c];return ore(bid)||['minecraft:dandelion','minecraft:poppy','minecraft:allium','minecraft:blue_orchid','minecraft:red_mushroom','minecraft:brown_mushroom'].indexOf(bid)>=0||bid.indexOf('farmersdelight:wild_')===0;}
 BlockEvents.placed(function(e){if(!e.player||!ore(String(e.block.id)))return;var where={dimension:String(e.level.dimension),x:Number(e.block.x),y:Number(e.block.y),z:Number(e.block.z)},bid=String(e.block.id),world=e.level,server=e.player.server;server.scheduleInTicks(1,function(){if(String(world.getBlock(where.x,where.y,where.z).id)===bid)placedTag(server,true).putBoolean(placedKey(where),true);});});
 BlockEvents.broken(function(e){var p=e.player;if(!p)return;var t=trait(p),block=e.block,world=e.level,where={dimension:String(e.level.dimension),x:Number(block.x),y:Number(block.y),z:Number(block.z)},snapshot=String(block.blockState),drops=[];
   if(F.isManagedRegenNodeV96&&F.isManagedRegenNodeV96(p,where))return;
   if(t==='frail_artisan'&&eligibleHarvest(block)&&(!ore(String(block.id))||F.isNaturalTraitHarvestV98(p.server,where))&&Number(p.random.nextFloat())<0.20){var ds=block.getDrops(p,p.mainHandItem);for(var d=0;d<ds.size();d++)if(!ds.get(d).empty){drops.push(ds.get(d).copy());break;}}
   var placed=placedTag(p.server,false),cleanup=placed&&placed.getBoolean(placedKey(where));if(t!=='reckless_might'&&!drops.length&&!cleanup)return;
   p.server.scheduleInTicks(1,function(){if(String(world.getBlock(where.x,where.y,where.z).blockState)===snapshot)return;if(cleanup)placedTag(p.server,false).remove(placedKey(where));if(t==='reckless_might')wear(p);if(drops.length){drops[0].count=1;block.popItem(drops[0]);}});
 });
 F.onRegenResourceHarvestV96=function(p,info){
   if(!info||['herb','ore','tree'].indexOf(String(info.kind))<0||!Item.exists(String(info.drop)))return false;
   var kind=String(info.kind);if(kind==='herb'||kind==='ore'){F.recordSuccessfulLegacyHarvestV96(p,kind);if(F.recordJobActivityV96)F.recordJobActivityV96(p,kind==='herb'?'herbs':'ores',1);}
   var t=trait(p);if(t==='frail_artisan'&&(kind==='herb'||kind==='ore')&&Number(p.random.nextFloat())<0.20)p.give(Item.of(String(info.drop),1));
   if(t==='reckless_might'&&(kind==='tree'||kind==='ore'))wear(p);return true;
 };
 EntityEvents.death(function(e){var a=e.source&&e.source.actual;if(isPlayer(a)&&hostile(e.entity))F.tryHoarderRewardV96(a);});
 var COOKED=['f_rank_days:brion_barley_bread','f_rank_days:hearth_potato_soup','f_rank_days:serdin_herb_ration','f_rank_days:golden_wheat_stew','f_rank_days:harvest_berry_tart','f_rank_days:alchemist_clear_tea'];
 var RAW=['minecraft:beef','minecraft:porkchop','minecraft:chicken','minecraft:mutton','minecraft:rabbit','minecraft:cod','minecraft:salmon','minecraft:sweet_berries','minecraft:glow_berries','minecraft:potato'];
 ItemEvents.foodEaten(function(e){var p=e.entity;if(!isPlayer(p)||trait(p)!=='picky_gourmet')return;var stack=e.item,bid=String(stack.id),food=stack.getFoodProperties(p);if(!food)return;
   if(COOKED.indexOf(bid)>=0||bid.indexOf('farmersdelight:')===0&&food.getNutrition()>=4){p.saturation=Math.min(Number(p.foodLevel),Number(p.saturation)+Number(food.getNutrition())*Number(food.getSaturationModifier())*2*0.35);effect(p,'minecraft:regeneration',600,0);}
   else if(RAW.indexOf(bid)>=0){p.foodLevel=Math.max(0,Number(p.foodLevel)-Math.ceil(Number(food.getNutrition())*0.5));p.saturation=Math.max(0,Number(p.saturation)-Number(food.getNutrition())*Number(food.getSaturationModifier()));effect(p,'minecraft:hunger',160,0);}
 });
 ServerEvents.tick(function(e){var n=Number(e.server.overworld().getTime()),players=e.server.players;for(var i=0;i<players.size();i++){var p=players.get(i),rt=F.getTraitRuntimeV96(p);if(rt.trait===undefined)F.applyTraitModifiersV96(p);var t=rt.trait,prev=rt.lastPos;rt.lastPos={x:Number(p.x),y:Number(p.y),z:Number(p.z)};
     if(t==='overheated_sprint'&&p.isSprinting()&&!p.isCreative()&&prev){var dx=Number(p.x)-prev.x,dz=Number(p.z)-prev.z,dist=Math.sqrt(dx*dx+dz*dz);if(dist>0&&dist<=1)p.addExhaustion(0.06*Math.round(dist*100)/100);}
     if(n%40===0){F.applyTraitModifiersV96(p);if(t==='nocturnal_eyes'){var tm=Number(p.level.getDayTime())%24000,b=p.level.getBlock(Math.floor(p.x),Math.floor(p.y+1),Math.floor(p.z));if(tm>=13000||Number(b.light)<=7)effect(p,'minecraft:night_vision',320,0);}if(t==='reckless_might')effect(p,'minecraft:haste',80,0);}
   }});
 PlayerEvents.loggedIn(function(e){F.applyTraitModifiersV96(e.player,true);});
 PlayerEvents.respawned(function(e){e.server.scheduleInTicks(1,function(){F.applyTraitModifiersV96(e.player,true);});});
 PlayerEvents.loggedOut(function(e){delete runtime[id(e.player)];});
})(global.FRankDays);
