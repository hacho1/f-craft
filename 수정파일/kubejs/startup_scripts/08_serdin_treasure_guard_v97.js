// Lootr's own getCapability() returns LazyOptional.empty(): automation cannot access personal contents.
// Do not invent a Forge inventory-move event or periodically rewrite existing inventories.
(function(){
  ForgeEvents.onEvent('net.minecraftforge.event.level.PistonEvent$Pre',function(e){
    var level=e.getLevel(),F=global.FRankDays,server=level&&level.getServer?level.getServer():null;
    if(!server||!F||typeof F.isProtectedSerdinTreasurePositionV97!=='function')return;
    var p=e.getPos();
    // Maximum vanilla push chain12 + pistonhead1; never call DirectionWrapper.getStepX.
    if(F.isProtectedSerdinTreasurePositionV97(server,{dimension:String(level.dimension),x:Number(p.x),y:Number(p.y),z:Number(p.z)},13))e.setCanceled(true);
  });
})();
