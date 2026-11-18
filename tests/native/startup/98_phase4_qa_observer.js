// QA ONLY: read-only observation of self-owned LAB arrow impacts and XP joins.
// ForgeEventWrapper.onEvent has only (eventClass,consumer), NORMAL/false;
// use its public eventBus accessor with the native four-argument API.
(function(){
 var Priority=Java.loadClass('net.minecraftforge.eventbus.api.EventPriority');
 var Impact=Java.loadClass('net.minecraftforge.event.entity.ProjectileImpactEvent');
 var Consumer=Java.loadClass('java.util.function.Consumer');
 ForgeEvents.eventBus().addListener(Priority.HIGHEST,true,Impact,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onProjectileImpactEvidence==='function')N.onProjectileImpactEvidence(e);
 }}));
 var Join=Java.loadClass('net.minecraftforge.event.entity.EntityJoinLevelEvent');
 ForgeEvents.eventBus().addListener(Priority.HIGHEST,true,Join,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onOutpostJoinEvidence==='function')try{N.onOutpostJoinEvidence('highest',e);}catch(error){if(N.outpostProbe)N.outpostProbe.data.observerErrors.push(String(error));}
 }}));
 // LOWEST runs after NORMAL product handlers. This observer never cancels,
 // changes value/position, spawns, removes or rewards any entity/player.
 ForgeEvents.eventBus().addListener(Priority.LOWEST,true,Join,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onFishingXpJoinEvidence==='function')N.onFishingXpJoinEvidence(e);
  if(N&&typeof N.onOutpostJoinEvidence==='function')try{N.onOutpostJoinEvidence('lowest',e);}catch(error){if(N.outpostProbe)N.outpostProbe.data.observerErrors.push(String(error));}
 }}));
 // QA-only transparent completion consumer for this suite's tagged summon commands.
 // The original consumer is called unchanged; command text/arguments/permissions stay intact.
 var Command=Java.loadClass('net.minecraftforge.event.CommandEvent');
 ForgeEvents.eventBus().addListener(Priority.LOWEST,true,Command,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onOutpostCommandEvidence==='function')try{N.onOutpostCommandEvidence(e);}catch(error){if(N.outpostProbe)N.outpostProbe.data.observerErrors.push(String(error));}
 }}));
 var Attack=Java.loadClass('net.minecraftforge.event.entity.living.LivingAttackEvent');
 ForgeEvents.eventBus().addListener(Priority.HIGHEST,true,Attack,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onCombatDamageStageEvidence==='function')N.onCombatDamageStageEvidence('attack_highest',e);
 }}));
 ForgeEvents.eventBus().addListener(Priority.LOWEST,true,Attack,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onCombatAttackEvidence==='function')N.onCombatAttackEvidence(e);
  if(N&&typeof N.onCombatDamageStageEvidence==='function')N.onCombatDamageStageEvidence('attack_lowest',e);
 }}));
 var Heal=Java.loadClass('net.minecraftforge.event.entity.living.LivingHealEvent');
 ForgeEvents.eventBus().addListener(Priority.LOWEST,true,Heal,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onCombatHealEvidence==='function')N.onCombatHealEvidence(e);
 }}));
 var Hurt=Java.loadClass('net.minecraftforge.event.entity.living.LivingHurtEvent');
 ForgeEvents.eventBus().addListener(Priority.HIGHEST,true,Hurt,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onCombatDamageStageEvidence==='function')N.onCombatDamageStageEvidence('hurt_highest',e);
 }}));
 ForgeEvents.eventBus().addListener(Priority.LOWEST,true,Hurt,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onCombatDamageStageEvidence==='function')N.onCombatDamageStageEvidence('hurt_lowest',e);
 }}));
 var Damage=Java.loadClass('net.minecraftforge.event.entity.living.LivingDamageEvent');
 ForgeEvents.eventBus().addListener(Priority.LOWEST,true,Damage,new Consumer({accept:function(e){
  var N=global.FCraftPhase6Native;
  if(N&&typeof N.onCombatDamageStageEvidence==='function')N.onCombatDamageStageEvidence('damage_lowest',e);
 }}));
})();
