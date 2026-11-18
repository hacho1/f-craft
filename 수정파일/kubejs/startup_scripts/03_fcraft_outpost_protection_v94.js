// ForgeEvents exists in STARTUP scripts in installed KubeJS 2001.6.5.
// Call the current server-script functions dynamically, so /reload does not retain old world state.
(function(){
  function context(level){
    if(!level||typeof global.FRankDays==='undefined')return null;
    var F=global.FRankDays,server=level.getServer?level.getServer():null;
    if(!server||typeof F.isProtectedOutpostPositionV94!=='function'||typeof F.getSerdinV94Layout!=='function'||!F.getSerdinV94Layout(server))return null;
    return{F:F,server:server,dimension:String(level.dimension)};
  }
  function where(c,p){return{dimension:c.dimension,x:Number(p.x===undefined?p.getX():p.x),y:Number(p.y===undefined?p.getY():p.y),z:Number(p.z===undefined?p.getZ():p.z)};}
  ForgeEvents.onEvent('net.minecraftforge.event.level.ExplosionEvent$Detonate',function(event){
    var c=context(event.getLevel());if(!c)return;
    var it=event.getAffectedBlocks().iterator();
    while(it.hasNext()){var p=it.next();if(c.F.isProtectedOutpostPositionV94(c.server,where(c,p),0))it.remove();}
  });
  ForgeEvents.onEvent('net.minecraftforge.event.level.PistonEvent$Pre',function(event){
    var c=context(event.getLevel());if(!c)return;
    // Vanilla pistons can move12 blocks. A13-block 3D halo covers a push/retract
    // chain reaching the protected footprint without touching Direction wrappers
    // or unrelated-town block mechanics. Ordinary far-away pistons return here.
    if(c.F.isProtectedOutpostPositionV94(c.server,where(c,event.getPos()),13))event.setCanceled(true);
  });
})();
