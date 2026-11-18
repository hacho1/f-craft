StartupEvents.registry('block',function(e){
 var names={trophy_serdin_banner:'세르딘 전초 제압 군기',trophy_elven_tablet:'고대 엘프 비문 석판',trophy_compendium_plaque:'브리온 박물학 동판',trophy_wrought_helm:'강철 수호자의 격파 투구'};
 for(var id in names)e.create('f_rank_days:'+id).displayName(names[id]).defaultCutout().box(3,0,3,13,15,13).hardness(1.0);
});
StartupEvents.registry('item',function(e){
 e.create('f_rank_days:brion_cottage_key').displayName('브리온 정착민 거처 열쇠').maxStackSize(1).texture('minecraft:block/tripwire_hook');
 e.create('f_rank_days:chapter1_priority_sailing_permit').displayName('아르베른 본토 우선 출항권').maxStackSize(1).texture('minecraft:item/paper');
});
