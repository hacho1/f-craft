package fcraft.promotion.mixin;
import dev.ftb.mods.ftbquests.quest.*;
import fcraft.promotion.client.PersonalPromotionState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
@Mixin(value=Quest.class, remap=false)
public abstract class PersonalQuestVisibilityMixin {
 @Inject(method="isVisible",at=@At("HEAD"),cancellable=true,remap=false)
 private void personalVisibility(TeamData data,CallbackInfoReturnable<Boolean> cir){if(data.getFile().isServerSide())return;Quest q=(Quest)(Object)this;if(q.hasTag("fcraft_v106_hidden")){cir.setReturnValue(false);return;}Boolean v=PersonalPromotionState.visible(q.getCodeString());if(v!=null)cir.setReturnValue(v);}
}
