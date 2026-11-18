package fcraft.raid.mixin;

import net.minecraft.world.entity.LivingEntity;
import net.minecraft.network.syncher.EntityDataAccessor;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import fcraft.raid.RaidBridge;

/** Color zero prevents vanilla potion bubbles, without removing any effect. */
@Mixin(value=LivingEntity.class,remap=false)
public abstract class RaidPotionMaskMixin {
 @Shadow @Final private static EntityDataAccessor<Integer> f_20962_;
 @Shadow @Final private static EntityDataAccessor<Boolean> f_20963_;
 @Inject(method="m_21203_()V",at=@At("TAIL"),require=1,remap=false)
 private void fcraft$maskPotionBubbles(CallbackInfo ci){
  LivingEntity self=(LivingEntity)(Object)this;
  if(!RaidBridge.ownedRaidBoss(self))return;
  RaidBridge.hideRaidEffectParticles(self);
  self.m_20088_().m_135381_(f_20962_,0);
  self.m_20088_().m_135381_(f_20963_,false);
 }
}
