// One personal authority for chapter6. FTB team progress never awards boss clears.
global.FCraftFrontierQuestsV99=(function(){
 var M={};
 M.flags=function(state,portal){
  state=state||{};portal=portal||{};var b=state.v96_boss_clears||{};
  function cleared(id){return Number(b[id]||0)>0;}
  return {
   frank_v99_c_bosses_complete:cleared('mowziesmobs:frostmaw')||cleared('mowziesmobs:umvuthi'),
   frank_v99_b_bosses_complete:cleared('bosses_of_mass_destruction:void_blossom')&&cleared('bosses_of_mass_destruction:lich')&&cleared('mowziesmobs:sculptor'),
   frank_v99_a_bosses_complete:!!(state.mainland_nether_visited_v99||portal.netherVisited)&&cleared('bosses_of_mass_destruction:gauntlet'),
   frank_v99_s_bosses_complete:!!(state.mainland_end_visited_v99||portal.endVisited)&&cleared('minecraft:ender_dragon')&&cleared('bosses_of_mass_destruction:obsidilith')
  };
 };
 return M;
})();
(function(){
 var F=global.FRankDays;
 F.refreshMainlandQuestStagesV99=function(p){
  var state=F.loadPlayerState(p),portal=F.getMainlandPortalProgressV99?F.getMainlandPortalProgressV99(p):{};
  var flags=global.FCraftFrontierQuestsV99.flags(state,portal);
  for(var key in flags)if(flags[key]){if(F.grantPlayerStageOnce)F.grantPlayerStageOnce(p,key);else p.stages.add(key);}
  return flags;
 };
 var oldSync=F.sync;
 F.sync=function(p){var result=oldSync.apply(F,arguments);F.refreshMainlandQuestStagesV99(p);return result;};
 PlayerEvents.tick(function(e){if(e.player.age%40===0)F.refreshMainlandQuestStagesV99(e.player);});
})();
