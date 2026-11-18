// New-world metadata and bounded administrator actions only. Terrain/templates
// are already materialized in the supplied development/start world.
var SerdinSurfaceV94 = (function () {
  var ignored = { 'minecraft:air':1,'minecraft:cave_air':1,'minecraft:void_air':1,
    'minecraft:grass':1,'minecraft:tall_grass':1,'minecraft:fern':1,'minecraft:large_fern':1,
    'minecraft:snow':1,'minecraft:vine':1,'minecraft:dead_bush':1,'minecraft:dandelion':1,
    'minecraft:poppy':1,'minecraft:blue_orchid':1,'minecraft:allium':1,'minecraft:azure_bluet':1,
    'minecraft:oxeye_daisy':1,'minecraft:cornflower':1,'minecraft:lily_of_the_valley':1,
    'minecraft:sweet_berry_bush':1,'minecraft:moss_carpet':1,'minecraft:glow_lichen':1 };
  function vegetation(block,id) {
    try { if (block.hasTag && (block.hasTag('minecraft:leaves') || block.hasTag('minecraft:logs') || block.hasTag('minecraft:flowers') || block.hasTag('minecraft:replaceable'))) return true; } catch (ignoredTag) {}
    return !!ignored[id] || /_(leaves|log|wood)$/.test(id) || /mushroom_block$/.test(id) || /_tulip$/.test(id);
  }
  function scan(world,x,z) {
    x=Math.floor(x);z=Math.floor(z);
    if (!world || typeof world.getBlock!=='function') return {valid:false,reason:'no_world'};
    try { if (typeof world.hasChunk==='function' && !world.hasChunk(Math.floor(x/16),Math.floor(z/16))) return {valid:false,reason:'chunk_not_loaded'}; } catch (e) { return {valid:false,reason:'chunk_readiness_failed'}; }
    var low=typeof world.getMinBuildHeight==='function'?Number(world.getMinBuildHeight()):-64;
    var high=typeof world.getMaxBuildHeight==='function'?Number(world.getMaxBuildHeight())-1:319;
    for(var y=high;y>=low;y--) {
      var b=world.getBlock(x,y,z); if(!b||!b.id)return {valid:false,reason:'unreadable_block'};
      var id=String(b.id);
      if(id==='minecraft:water'||id==='minecraft:lava'||/minecraft:(kelp|kelp_plant|seagrass|tall_seagrass)$/.test(id))return {valid:true,y:y,isWater:true,isLiquid:true,blockId:id};
      if(vegetation(b,id))continue;
      try { if(b.blockState && !b.blockState.getFluidState().isEmpty())return {valid:true,y:y,isWater:true,isLiquid:true,blockId:id}; } catch(ignoredFluid){}
      return {valid:true,y:y,isWater:false,isLiquid:false,blockId:id};
    }
    return {valid:false,reason:'no_ground'};
  }
  function footprint(world,x,z,r,maxSlope,forbidden) {
    var min=Infinity,max=-Infinity;
    for(var dx=-r;dx<=r;dx++)for(var dz=-r;dz<=r;dz++) {
      if(dx*dx+dz*dz>r*r)continue;
      if(forbidden&&forbidden(x+dx,z+dz))return {valid:false,reason:'protected_footprint'};
      var p=scan(world,x+dx,z+dz);if(!p.valid||p.isLiquid)return {valid:false,reason:p.reason||'liquid_footprint'};
      min=Math.min(min,p.y);max=Math.max(max,p.y);
      if(max-min>maxSlope)return {valid:false,reason:'steep_footprint'};
    }
    return {valid:true,x:x,y:max+1,z:z,minY:min,maxY:max};
  }
  function nearest(world,x,z,r,footprintRadius,forbidden) {
    r=Math.max(0,Math.min(24,Math.floor(Number(r)||0)));
    for(var distance=0;distance<=r;distance+=4) {
      var count=distance?16:1;
      for(var i=0;i<count;i++) {
        var angle=i*6.283185307179586/count,trig=typeof JavaMath!=='undefined'?JavaMath:Math;
        var cx=Math.round(x+trig.cos(angle)*distance),cz=Math.round(z+trig.sin(angle)*distance);
        var p=footprint(world,cx,cz,footprintRadius||0,2,forbidden);
        if(p.valid){p.autoAdjusted=distance>0;return p;}
      }
    }
    return {valid:false,reason:'no_safe_site_within_24_blocks'};
  }
  return {scan:scan,footprint:footprint,nearest:nearest};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SerdinSurfaceV94;
if(typeof global!=='undefined'&&global.FRankDays) {
  var F94=global.FRankDays;
  F94.findGroundSurfaceY=function(world,x,z){return SerdinSurfaceV94.scan(world,x,z);};
  F94.resolveNearestDryLand=function(world,x,z,r){return SerdinSurfaceV94.nearest(world,x,z,r,0);};
  if(typeof F94.shouldBlockDangerSpawnInBrion==='function') {
    var previousSpawn94=F94.shouldBlockDangerSpawnInBrion;
    F94.shouldBlockDangerSpawnInBrion=function(server,id,x,z,spawnType) {
      var layout=F94.getSerdinV94Layout(server),reason=String(spawnType||'').toUpperCase();
      if(layout&&reason!=='COMMAND'&&reason!=='SPAWN_EGG') {
        id=String(id);
        var dangerous=id.indexOf('mowziesmobs:')===0||id.indexOf('born_in_chaos_v1:')===0||F94.BRION_BLOCKED_DANGER_MOBS.indexOf(id)>=0;
        var hostile=dangerous||F94.VANILLA_HOSTILE_MOBS.indexOf(id)>=0;
        var regions=F94.FCRAFT_CONFIG.regions;
        for(var i=0;i<regions.length;i++) {
          var r=regions[i],b=r.bounds;
          if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)continue;
          if(hostile&&(r.safeStart||r.spawnPolicy==='sealed'||r.spawnPolicy==='boss'))return true;
          if(r.spawnPolicy==='outer'&&(dangerous||(hostile&&id!=='minecraft:zombie'&&id!=='minecraft:skeleton')))return true;
          if(r.spawnPolicy==='deep'&&dangerous)return true;
        }
      }
      return previousSpawn94(server,id,x,z,spawnType);
    };
  }
  function protected94(server,x,z) {
    var cfg=F94.FCRAFT_CONFIG,regions=cfg.regions||[];
    for(var i=0;i<regions.length;i++)if(regions[i].protectTerrain){var b=regions[i].bounds;if(x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ)return true;}
    for(var j=0;j<(cfg.npcs||[]).length;j++){var n=cfg.npcs[j];if(Math.abs(n.x-x)<=28&&Math.abs(n.z-z)<=28)return true;}
    var layout=F94.getSerdinV94Layout(server);
    if(layout)for(var k=0;k<layout.outposts.length;k++){var o=layout.outposts[k];if(Math.abs(o.x-x)<=40&&Math.abs(o.z-z)<=40)return true;}
    return false;
  }
  var previousAltar94=F94.getFcraftExistingBossAltar;
  F94.getFcraftExistingBossAltar=function(server) {
    var layout=F94.getSerdinV94Layout(server);
    if(layout&&server&&server.persistentData)try{
      var custom=JSON.parse(String(server.persistentData.getString('fcraft_altar_custom_v94')));
      if(custom&&custom.verified===true&&custom.dimension==='minecraft:overworld'&&Number.isFinite(Number(custom.x))&&Number.isFinite(Number(custom.y))&&Number.isFinite(Number(custom.z))&&!protected94(server,Number(custom.x),Number(custom.z)))return {x:Math.floor(custom.x),y:Math.floor(custom.y),z:Math.floor(custom.z)};
    }catch(ignoredCustom){}
    return previousAltar94(server);
  };
  var previousTick94=F94.tickFcraftRegions;
  F94.tickFcraftRegions=function(player,now) {
    if(F94.getSerdinV94Layout(player.server)) {
      var c=F94.getFcraftExistingBossAltar(player.server),rs=F94.FCRAFT_CONFIG.regions;
      if(c)for(var i=0;i<rs.length;i++)if(rs[i].id==='wrought_trial_altar'||rs[i].id==='fcraft_boss_altar'||rs[i].id==='serdin_existing_trial_altar')rs[i].bounds={minX:c.x-28,maxX:c.x+28,minY:-64,maxY:319,minZ:c.z-28,maxZ:c.z+28};
    }
    return previousTick94(player,now);
  };
  function circle94(server,c) {
    var world=server.overworld(),core='f_rank_days:wrought_trial_altar';
    for(var dx=-11;dx<=11;dx++)for(var dz=-11;dz<=11;dz++)if(dx*dx+dz*dz<=121) {
      var material=Math.abs(dx)<=2&&Math.abs(dz)<=2?'minecraft:polished_basalt':(dx*dx+dz*dz>100?'minecraft:deepslate_bricks':'minecraft:deepslate_tiles');
      server.runCommandSilent('setblock '+(c.x+dx)+' '+(c.y-1)+' '+(c.z+dz)+' '+material);
    }
    for(var p of [[-11,0],[11,0],[0,-11],[0,11]]) {
      for(var h=0;h<3;h++)server.runCommandSilent('setblock '+(c.x+p[0])+' '+(c.y+h)+' '+(c.z+p[1])+' minecraft:crying_obsidian');
      server.runCommandSilent('setblock '+(c.x+p[0])+' '+(c.y+3)+' '+(c.z+p[1])+' minecraft:soul_lantern');
    }
    server.runCommandSilent('setblock '+c.x+' '+c.y+' '+c.z+' '+core);
    if(String(world.getBlock(c.x,c.y,c.z).id)!==core)throw new Error('Altar core placement failed');
    var st=F94.loadBossAltarStateV8(server);st.built=true;st.coords=c;F94.saveBossAltarStateV8(server,st);
    return {ok:true,coords:c,circular:true};
  }
  var previousBuilder94=F94.ensureWroughtBossAltarBuiltV8;
  F94.ensureWroughtBossAltarBuiltV8=function(server,force) {
    if(!F94.getSerdinV94Layout(server))return previousBuilder94(server,force);
    var c=F94.getFcraftExistingBossAltar(server);if(!c)return {ok:false,reason:'unmapped_v94_altar'};
    // Preserve the prebuilt round arena on every ordinary restart.
    if(String(server.overworld().getBlock(c.x,c.y,c.z).id)==='f_rank_days:wrought_trial_altar') {
      var st=F94.loadBossAltarStateV8(server);st.built=true;st.coords=c;F94.saveBossAltarStateV8(server,st);return {ok:true,already_built:true,coords:c};
    }
    return {ok:false,reason:'prebuilt_altar_missing_no_automatic_world_rebuild'};
  };
  F94.relocateAltarV94=function(player) {
    var server=player.server,layout=F94.getSerdinV94Layout(server);
    if(!layout||String(player.level.dimension)!=='minecraft:overworld')return {ok:false,reason:'verified_v94_overworld_required'};
    if(F94.isBossCurrentlyActiveAtAltarV8(server).active)return {ok:false,reason:'boss_active'};
    var x=Math.floor(player.x),z=Math.floor(player.z),world=server.overworld();
    var site=SerdinSurfaceV94.footprint(world,x,z,11,0,function(px,pz){return protected94(server,px,pz);});
    if(!site.valid)return {ok:false,reason:site.reason};
    if(site.y+3>=Number(world.getMaxBuildHeight())||site.y-1<Number(world.getMinBuildHeight()))return {ok:false,reason:'world_height_bounds'};
    var border=world.getWorldBorder();
    for(var corner of [[-12,-12],[-12,12],[12,-12],[12,12]])if(!border.isWithinBounds(x+corner[0],z+corner[1]))return {ok:false,reason:'world_border_footprint'};
    // A flat wooden roof can look like a hill to a surface scanner. Require a
    // solid natural foundation below every arena cell before the first edit.
    var natural=/^minecraft:(grass_block|dirt|coarse_dirt|rooted_dirt|moss_block|stone|deepslate|tuff|calcite|granite|diorite|andesite|sand|red_sand|gravel|clay|mud|packed_mud|podzol|mycelium|terracotta|sandstone|red_sandstone|snow_block)$/;
    for(var fx=-11;fx<=11;fx++)for(var fz=-11;fz<=11;fz++)if(fx*fx+fz*fz<=121)for(var depth=1;depth<=5;depth++)if(!natural.test(String(world.getBlock(x+fx,site.y-depth,z+fz).id)))return {ok:false,reason:'natural_solid_foundation_required'};
    // Relocation never clears trees, buildings, existing containers or players.
    for(var dx=-11;dx<=11;dx++)for(var dz=-11;dz<=11;dz++)if(dx*dx+dz*dz<=121)for(var h=0;h<5;h++) {
      var b=world.getBlock(x+dx,site.y+h,z+dz),id=String(b.id);
      if(!/minecraft:(air|cave_air|grass|tall_grass|fern|large_fern|dandelion|poppy)$/.test(id))return {ok:false,reason:'clear_headroom_required'};
    }
    var old=F94.getFcraftExistingBossAltar(server),c={x:x,y:site.y,z:z},result=circle94(server,c);
    if(!result.ok)return result;
    server.persistentData.putString('fcraft_altar_custom_v94',JSON.stringify({x:x,y:site.y,z:z,dimension:'minecraft:overworld',verified:true}));
    if(old&&String(world.getBlock(old.x,old.y,old.z).id)==='f_rank_days:wrought_trial_altar')server.runCommandSilent('setblock '+old.x+' '+old.y+' '+old.z+' minecraft:chiseled_deepslate');
    return result;
  };
  if(typeof ServerEvents!=='undefined')ServerEvents.commandRegistry(function(event){
    var C=event.commands;
    event.register(C.literal('frank').then(C.literal('altar').requires(function(source){return source.hasPermission(2);}).then(C.literal('relocate_here').executes(function(ctx){var p=ctx.source.player;if(!p)return 0;var r=F94.relocateAltarV94(p);p.tell(r.ok?'제단·보호 범위·지역 배너·안내 좌표를 갱신했습니다.':'제단을 옮기지 않았습니다: '+r.reason);return r.ok?1:0;}))));
  });
}
