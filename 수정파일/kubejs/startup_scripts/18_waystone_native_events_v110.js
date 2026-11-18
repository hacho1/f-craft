// Native events can also fire during logical-client prediction.
// Only the authoritative server dispatches to the unchanged server policy.
(function(){
 if(!Platform.isLoaded('waystones'))return;
 function serverEntity(entity){return !!entity&&!!entity.level&&!entity.level.isClientSide()&&!!entity.server;}
 ForgeEvents.onEvent('net.blay09.mods.waystones.api.WaystoneTeleportEvent$Pre',function(e){var context=e.getContext();if(!serverEntity(context&&context.getEntity()))return;var F=global.FRankDays;if(F&&F.guardWaystoneTeleportV110)F.guardWaystoneTeleportV110(e);});
 ForgeEvents.onEvent('net.blay09.mods.waystones.api.WaystoneActivatedEvent',function(e){if(!serverEntity(e.getPlayer()))return;var F=global.FRankDays;if(F&&F.onWaystoneActivatedNativeV110)F.onWaystoneActivatedNativeV110(e);});
})();
