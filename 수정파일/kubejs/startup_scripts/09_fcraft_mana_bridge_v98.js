// Reapply the fixed-UUID trait and refresh MP after a native dimension transfer.
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$PlayerChangedDimensionEvent',function(e){
  var F=global.FRankDays,p=e.getEntity();
  if(!F||!p||p.level.isClientSide())return;
  if(typeof F.applyTraitModifiersV96==='function')F.applyTraitModifiersV96(p,true);
  if(typeof F.applyPassiveModifiersPhase4==='function')F.applyPassiveModifiersPhase4(p,true);
  if(typeof F.syncManaV98==='function')F.syncManaV98(p,true);
});
