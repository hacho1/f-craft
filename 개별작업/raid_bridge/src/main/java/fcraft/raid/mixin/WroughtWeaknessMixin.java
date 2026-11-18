package fcraft.raid.mixin;
import com.bobmowzie.mowziesmobs.server.entity.MowzieLLibraryEntity;
import com.bobmowzie.mowziesmobs.server.entity.wroughtnaut.EntityWroughtnaut;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.level.Level;
import net.minecraft.world.damagesource.DamageSource;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value=EntityWroughtnaut.class,remap=false)
public abstract class WroughtWeaknessMixin extends MowzieLLibraryEntity {
 protected WroughtWeaknessMixin(EntityType<? extends MowzieLLibraryEntity> type,Level level){super(type,level);}
 @Inject(method="m_6469_(Lnet/minecraft/world/damagesource/DamageSource;F)Z",at=@At("HEAD"),cancellable=true,require=1,remap=false)
 private void fcraft$exposedFront(DamageSource src,float amount,CallbackInfoReturnable<Boolean> ci){long tick=m_9236_().m_46467_();if(getPersistentData().m_128471_("fcraft_raid_v101")&&getPersistentData().m_128454_("fcraft_raid_groggy_until_tick")>tick){ci.setReturnValue(super.m_6469_(src,amount));}}
}
