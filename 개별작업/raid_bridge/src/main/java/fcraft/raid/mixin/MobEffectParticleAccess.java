package fcraft.raid.mixin;

import net.minecraft.world.effect.MobEffectInstance;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(value=MobEffectInstance.class,remap=false)
public interface MobEffectParticleAccess {
 @Accessor(value="f_19508_",remap=false) void fcraft$setParticles(boolean visible);
}
