package fcraft.raid.mixin;
import fcraft.raid.RaidBridge;
import net.minecraft.world.item.ItemStack;
import net.minecraft.util.RandomSource;
import net.minecraft.server.level.ServerPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** After native Unbreaking and damage calculation, before callers shrink a broken stack. */
@Mixin(value=ItemStack.class,remap=false)
public abstract class GuardianWearMixin {
 @Inject(method="m_220157_(ILnet/minecraft/util/RandomSource;Lnet/minecraft/server/level/ServerPlayer;)Z",at=@At("RETURN"),cancellable=true,require=1,remap=false)
 private void fcraft$noDestruction(int amount,RandomSource rng,ServerPlayer p,CallbackInfoReturnable<Boolean> ci){ItemStack stack=(ItemStack)(Object)this;if(!RaidBridge.guardian(stack))return;if(Boolean.TRUE.equals(ci.getReturnValue())||RaidBridge.broken(stack)){stack.m_41721_(Math.max(0,stack.m_41776_()-1));stack.m_41784_().m_128379_("fcraft_guardian_broken",true);ci.setReturnValue(false);}}
}
