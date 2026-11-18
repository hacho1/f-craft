// Native vanilla/Forge dimension changes also restore the existing UUID modifiers.
// Dynamic server callback keeps this bridge independent of script reload order.
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent',function(event){
 var p=event.getEntity(),F=global.FRankDays;
 if(!p||!p.isPlayer()||p.level.isClientSide()||!F||typeof F.onCompendiumDimensionChangedV99!=='function')return;
 F.onCompendiumDimensionChangedV99(p);
});
