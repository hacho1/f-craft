global.FCraftPhase6Native = global.FCraftPhase6Native || {};
(function(N){
 N.runRaidBoot = function(server, done){
  var F=global.FRankDays,Bridge=Java.loadClass('fcraft.raid.RaidBridge');
  N.report.nativeMathAudit={pi:String(Math.PI),cos0:String(Math.cos(0)),sin0:String(Math.sin(0)),round20:String(Math.round(20)),literalPI:3.141592653589793};
  N.check('native raid bridge loaded with mixins',Bridge.nativeCapabilities());
  N.check('native raid production engine exported',!!F.CHAPTER1_RAID_V101);
  N.check('native guardian production gear exported',!!F.GUARDIAN_GEAR_V102);
  var registry=Java.loadClass('net.minecraft.core.registries.BuiltInRegistries'),RL=Java.loadClass('net.minecraft.resources.ResourceLocation');
  // Old saved palettes omit default properties. Record the installed native
  // registry defaults so the independent Anvil comparator can normalize them
  // exactly, rather than misreporting harmless save serialization as edits.
  var defaults={},blocks=registry.BLOCK.iterator();
  while(blocks.hasNext()){var block=blocks.next();defaults[String(registry.BLOCK.getKey(block))]=String(block.defaultBlockState());}
  N.report.nativeBlockDefaultStates=defaults;
  var ids=['guardian_moss_altar','corrupted_blossom_altar','ancient_heartwood_core','purifying_dew_vial','wrought_challenge_sigil','wrought_iron_heart','guardian_wrought_helm','guardian_portal_pedestal','sanctum_escape_crystal'];
  for(var i=0;i<ids.length;i++)N.check('native registration '+ids[i],registry.ITEM.containsKey(new RL('f_rank_days:'+ids[i])));
  done();
 };
})(global.FCraftPhase6Native);
