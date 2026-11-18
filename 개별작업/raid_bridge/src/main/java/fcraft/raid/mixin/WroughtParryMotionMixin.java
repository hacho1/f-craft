package fcraft.raid.mixin;

import com.bobmowzie.mowziesmobs.server.entity.MowzieEntity;
import com.bobmowzie.mowziesmobs.server.entity.wroughtnaut.EntityWroughtnaut;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Vanilla entity events reach only clients tracking this boss. The private
 * event is emitted exclusively by the server's owned-raid animation adapter. */
@Mixin(value=MowzieEntity.class,remap=false)
public abstract class WroughtParryMotionMixin {
 @Inject(method="m_7822_(B)V",at=@At("HEAD"),cancellable=true,require=1,remap=false)
 private void fcraft$timedOverhead(byte event,CallbackInfo ci){
  if(event==(byte)-105&&(Object)this instanceof EntityWroughtnaut wrought){
   wrought.setAnimation(EntityWroughtnaut.VERTICAL_ATTACK_ANIMATION);
   wrought.setAnimationTick(10);
   ci.cancel();
  }
 }
}
