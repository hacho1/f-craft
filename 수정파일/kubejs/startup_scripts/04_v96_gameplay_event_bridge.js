// Single native mutable bridge. Gameplay lives in server scripts, never duplicate listeners.
(function(){
 function invoke(name,e){var F=global.FRankDays;if(!F||typeof F[name]!=='function')return;var q=e&&e.getEntity?e.getEntity():null;if(q&&q.level&&q.level.isClientSide())return;F[name](e);}
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent',function(e){invoke('composeCombatDamagePhase4',e);invoke('onTraitHurtV96',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDamageEvent',function(e){invoke('onCombatDamageAppliedPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingAttackEvent',function(e){invoke('guardControlledAttackPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingKnockBackEvent',function(e){invoke('guardCombatKnockbackPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingFallEvent',function(e){invoke('guardCombatFallPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.MobEffectEvent$Applicable',function(e){invoke('onPassiveEffectApplicablePhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDeathEvent',function(e){invoke('onPassiveLivingDeathPhase4',e);if(!e.isCanceled())invoke('onCombatDeathPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.AttackEntityEvent',function(e){invoke('guardCottageEntityV10',e);if(!e.isCanceled())invoke('captureCombatAttackPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.CriticalHitEvent',function(e){invoke('captureCombatCriticalPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.ArrowLooseEvent',function(e){invoke('captureArrowLoosePhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityJoinLevelEvent',function(e){invoke('onTrainingEntityJoinV10',e);invoke('captureProjectilePhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.ProjectileImpactEvent',function(e){invoke('guardCottageProjectileV10',e);if(!e.isCanceled())invoke('onSkillArrowImpactPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$RightClickBlock',function(e){invoke('guardCottageInteractV10',e);invoke('guardSkilletPlacePhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$EntityInteract',function(e){invoke('guardCottageEntityV10',e);invoke('guardTrainingEntityV10',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$EntityInteractSpecific',function(e){invoke('guardCottageEntityV10',e);invoke('guardTrainingEntityV10',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDropsEvent',function(e){invoke('guardTrainingDropsV10',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingExperienceDropEvent',function(e){invoke('guardTrainingDropsV10',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$RightClickItem',function(e){invoke('captureEquipmentUseV10',e);invoke('captureFishingPullPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.ItemFishedEvent',function(e){invoke('onTraitFishedV96',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEvent$LivingTickEvent',function(e){invoke('maintainManaControlPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEvent$LivingJumpEvent',function(e){invoke('onTraitJumpV96',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$BreakSpeed',function(e){invoke('onPassiveBreakSpeedPhase4',e);invoke('onChapter1BreakSpeedV10',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.ItemAttributeModifierEvent',function(e){invoke('onChapter1ItemAttributesV10',e);});
 ForgeEvents.onEvent('fcraft.growth.event.ItemWearEvent',function(e){invoke('onItemWearV10',e);});
 ForgeEvents.onEvent('fcraft.growth.event.FishingWaitEvent',function(e){invoke('onFishingWaitV10',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Start',function(e){invoke('onPassiveUseStartPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Finish',function(e){invoke('onPassiveUseFinishPhase4',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.brewing.PlayerBrewedPotionEvent',function(e){invoke('onPracticalBrewedPhase4',e);});
 if(Platform.isLoaded('combatroll')){
  var Listener=Java.loadClass('net.combatroll.api.event.ServerSideRollEvents$PlayerStartRolling');
  Java.loadClass('net.combatroll.api.event.ServerSideRollEvents').PLAYER_START_ROLLING.register(new Listener({onPlayerStartedRolling:function(p,v){invoke('onNativeCombatRollV96',p);invoke('onCombatRollPhase4',p);}}));
 }
})();
