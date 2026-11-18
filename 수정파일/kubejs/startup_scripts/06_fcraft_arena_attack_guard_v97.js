// Mutable native attack hook; existing trait, parry and other damage listeners remain separate.
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingAttackEvent',function(event){
 var F=global.FRankDays;if(F&&F.shouldBlockArenaNativeAttackV97&&F.shouldBlockArenaNativeAttackV97(event))event.setCanceled(true);
});
