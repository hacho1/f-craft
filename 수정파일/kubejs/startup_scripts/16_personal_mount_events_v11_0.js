// STAGED ONLY. Installed KubeJS ForgeEvents.onEvent registers at NORMAL.
// Installed Corpse1.0.23 takes its first snapshot at LOWEST LivingDeathEvent.
(function(){
 function call(name,e){var F=global.FRankDays,p=e.getEntity&&e.getEntity();if(F&&F[name]&&(!p||!p.level.isClientSide()))F[name](e);}
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingAttackEvent',function(e){call('onPersonalMountDamageV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent',function(e){call('onPersonalMountDamageV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDeathEvent',function(e){call('onPersonalMountDeathV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDropsEvent',function(e){call('onPersonalMountDropsV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.item.ItemTossEvent',function(e){call('onPersonalMountTossV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$EntityInteract',function(e){call('onPersonalMountInteractV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$EntityInteractSpecific',function(e){call('onPersonalMountInteractV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityMountEvent',function(e){call('onPersonalMountRideV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerContainerEvent$Open',function(e){call('onPersonalMountInventoryV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityJoinLevelEvent',function(e){call('onPersonalMountJoinV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityTravelToDimensionEvent',function(e){call('onPersonalMountTravelV110',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent',function(e){call('onPersonalMountTravelV110',e);});
})();
