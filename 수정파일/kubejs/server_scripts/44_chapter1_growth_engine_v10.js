// Authoritative completed-action feedback. No ambient spawn rule changes.
global.FRankDays=global.FRankDays||{};
(function(F){
 var seq=0,fishPending={},serverIdentity=null;
 function time(p){return Number(p.server.overworld().getTime());}
 function perks(stack){return F.getChapter1EnhancementPerksV10?F.getChapter1EnhancementPerksV10(stack):{};}
 function checkServer(p){if(serverIdentity!==p.server&&!(serverIdentity&&serverIdentity.equals&&serverIdentity.equals(p.server))){serverIdentity=p.server;fishPending={};seq=0;}}
 function castSource(hook){if(!hook||!hook.persistentData)return null;var raw=String(hook.persistentData.getString('fcraft_fishing_source_v10'));if(!raw||raw.length>8192)return null;try{return JSON.parse(raw);}catch(ignored){return null;}}
 F.newGrowthActionIdV10=function(p,kind){checkServer(p);return String(p.uuid)+':v10:'+String(kind)+':'+time(p)+':'+(++seq);};
 F.captureGrowthHarvestV10=function(p,stack,kind){var id=F.newGrowthActionIdV10(p,kind);return{actionId:id,source:F.captureHeirloomSourceV10?F.captureHeirloomSourceV10(p,stack,'main',id):null};};
 F.chapter1RareChanceV10=function(base,descriptor){var x=Number(descriptor&&descriptor.perks&&descriptor.perks.rare_find_multiplier||1);return Math.max(0,Math.min(1,Number(base)*x));};
 F.onChapter1CompletedHarvestV10=function(p,descriptor,actionId,drop,natural){
  if(!descriptor||descriptor.ownerUuid!==String(p.uuid))return false;
  var result=F.recordHeirloomHarvestV10?F.recordHeirloomHarvestV10(p,descriptor,actionId):false;
  // Only a committed first receipt may create the extra yield; aliases are resolved by the ledger.
  var accepted=result===true||result&&result.ok&&!result.duplicate;
  if(accepted&&natural&&descriptor.perks&&descriptor.perks.is_field_tool&&Number(p.random.nextFloat())<Number(descriptor.perks.extra_yield_chance||0)&&Item.exists(drop))p.give(Item.of(drop,1));
  return accepted;
 };
 F.onItemWearV10=function(e){
  var p=e.getPlayer(),stack=e.getItemStack();if(!p||p.level.isClientSide()||Number(e.getAmount())<=0)return;
  var own=Number(perks(stack).durability_protection_chance||0),old=F.getPassiveDurabilityProtectionPhase4?Number(F.getPassiveDurabilityProtectionPhase4(p,stack)||0):0,chance=Math.max(0,Math.min(1,Math.max(own,old)));
  if(chance>0&&Number(p.random.nextFloat())<chance)e.setAmount(0);
 };
 F.onFishingWaitV10=function(e){var p=e.getPlayer(),s=castSource(e.getHook());if(!p||!s||s.ownerUuid!==String(p.uuid))return;var factor=Number(s.perks&&s.perks.fishing_wait_multiplier||1);if(factor>0&&factor<1)e.setWaitTicks(Math.ceil(Number(e.getOriginalTicks())*factor));};
 F.onChapter1ItemAttributesV10=function(e){
  if(String(e.getSlotType())!=='MAINHAND')return;var pr=perks(e.getItemStack());if(!(Number(pr.attack_speed_multiplier)>1))return;
  var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),M=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),O=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation'),U=Java.loadClass('java.util.UUID');
  e.addModifier(A.ATTACK_SPEED,new M(U.fromString('4fc6a100-7ec6-4d00-9a86-000000000005'),'fcraft_breakthrough_speed_v10',Number(pr.attack_speed_multiplier)-1,O.MULTIPLY_TOTAL));
 };
 F.onChapter1BreakSpeedV10=function(e){var p=e.getEntity();if(!p||p.level.isClientSide())return;var pr=perks(p.mainHandItem);if(pr.is_field_tool)e.setNewSpeed(Number(e.getNewSpeed())*Number(pr.break_speed_multiplier||1));};
 F.onChapter1FishCandidateV10=function(e){
  if(e.isCanceled()||!e.getDrops().size())return;var p=e.getEntity(),h=e.getHookEntity(),source=castSource(h);if(!p||!source||source.ownerUuid!==String(p.uuid))return;
  checkServer(p);var key=String(h.uuid);if(fishPending[key])return;fishPending[key]=true;var first=e.getDrops().get(0).copy(),actionId='fish:'+key;
  // Native retrieve posts ItemFishedEvent before spawning its drops. Inspect final cancellation next tick.
  p.server.scheduleInTicks(1,function(){try{if(!e.isCanceled()&&Number(first.count)>0)F.onChapter1CompletedHarvestV10(p,source,actionId,String(first.id),true);}finally{delete fishPending[key];}});
 };
 F.getFishingSourceV10=castSource;
 F.captureFishingHookSourceV10=function(hook,p,launch){
  var source=launch&&/fishing_rod$/.test(String(launch.weaponId))?launch.weaponSource:null;
  // Entity construction is the actual use instant. A single rod hand is unambiguous
  // even for APIs that call Item.use without posting RightClickItem themselves.
  if(!source&&F.captureHeirloomSourceV10){var main=/fishing_rod$/.test(String(p.mainHandItem.id)),off=/fishing_rod$/.test(String(p.offHandItem.id));if(main!==off)source=F.captureHeirloomSourceV10(p,main?p.mainHandItem:p.offHandItem,main?'main':'off',F.newGrowthActionIdV10(p,'fish_cast'));}
  if(source)hook.persistentData.putString('fcraft_fishing_source_v10',JSON.stringify(source));return source;
 };
 F.GROWTH_NATIVE_BRIDGE_V10={version:1,preBreakWear:true,newWaitOnly:true,combinedWearRoll:'maximum',rareFindMultiplier:1.15};
})(global.FRankDays);
