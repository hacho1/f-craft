// Low-level environment guards call the current server policy dynamically.
function fcraftProtectedBlock96(level,p,pad){var f=global.FRankDays;return !!(f&&f.shouldProtectWorldBlockV96&&f.shouldProtectWorldBlockV96(level,p.getX(),p.getY(),p.getZ(),pad||0));}
ForgeEvents.onEvent('net.minecraftforge.event.level.ExplosionEvent$Detonate',function(e){
 var blocks=e.getAffectedBlocks(),level=e.getLevel();
 blocks.removeIf(function(p){return fcraftProtectedBlock96(level,p,0);});
});
ForgeEvents.onEvent('net.minecraftforge.event.level.PistonEvent$Pre',function(e){if(fcraftProtectedBlock96(e.getLevel(),e.getPos(),13))e.setCanceled(true);});
ForgeEvents.onEvent('net.minecraftforge.event.level.BlockEvent$FluidPlaceBlockEvent',function(e){if(fcraftProtectedBlock96(e.getLevel(),e.getPos(),0))e.setCanceled(true);});
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityMobGriefingEvent',function(e){var entity=e.getEntity();if(fcraftProtectedBlock96(entity.level,entity.blockPosition(),0))e.setResult(Java.loadClass('net.minecraftforge.eventbus.api.Event$Result').DENY);});
// These startup listeners resolve current server functions at event time, so
// /reload never installs duplicate native listeners or retains old policy.
ForgeEvents.onEvent('net.minecraftforge.event.level.BlockEvent$PortalSpawnEvent',function(e){
 var F=global.FRankDays;if(F&&F.shouldBlockIslandNetherPortalV99&&F.shouldBlockIslandNetherPortalV99(e.getLevel()))e.setCanceled(true);
});
ForgeEvents.onEvent('net.minecraftforge.event.level.BlockEvent$NeighborNotifyEvent',function(e){
 var F=global.FRankDays;if(F&&F.afterFrontierFireNotifyV99)F.afterFrontierFireNotifyV99(e.getLevel(),e.getPos());
});
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityTravelToDimensionEvent',function(e){
 var F=global.FRankDays,p=e.getEntity();if(!F||!p||!p.isPlayer()||p.level.isClientSide())return;
 // Cancellation deliberately occurs outside any try/catch (Forge/Rhino).
 if(F.beforeDimensionTravelV99&&F.beforeDimensionTravelV99(p,String(e.getDimension().location())))e.setCanceled(true);
});
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent',function(e){
 var F=global.FRankDays,p=e.getEntity();if(F&&F.afterDimensionTravelV99&&p&&!p.level.isClientSide())F.afterDimensionTravelV99(p,String(e.getFrom().location()),String(e.getTo().location()));
});
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerRespawnEvent',function(e){
 var F=global.FRankDays,p=e.getEntity();if(F&&F.afterDimensionRespawnV99&&p&&!p.level.isClientSide())F.afterDimensionRespawnV99(p,e.isEndConquered());
});
