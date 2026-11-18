// New namespaced resources; existing item registry IDs remain unchanged.
StartupEvents.registry('item',function(e){
 e.create('f_rank_days:mana_stone_powder').displayName('마력석 가루').texture('minecraft:item/glowstone_dust');
 e.create('f_rank_days:ancient_fragment').displayName('고대 파편').texture('minecraft:item/prismarine_shard');
});
