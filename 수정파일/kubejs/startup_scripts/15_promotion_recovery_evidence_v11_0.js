// The item is the actual completed use stack, never a client claim or pickup.
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Finish',function(e){var F=global.FRankDays,p=e.getEntity();if(F&&F.onPromotionRecoveryFinishV110&&p&&!p.level.isClientSide())F.onPromotionRecoveryFinishV110(e);});
