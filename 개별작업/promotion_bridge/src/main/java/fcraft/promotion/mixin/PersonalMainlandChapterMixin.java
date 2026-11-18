package fcraft.promotion.mixin;
import dev.ftb.mods.ftbquests.quest.*;
import fcraft.promotion.client.PersonalPromotionState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
/** Shared TeamData cannot reveal the mainland tab to an unlicensed player. */
@Mixin(value=Chapter.class,remap=false)
public abstract class PersonalMainlandChapterMixin {
 @Inject(method="isVisible",at=@At("HEAD"),cancellable=true,remap=false)
 private void personalMainland(TeamData data,CallbackInfoReturnable<Boolean> cir){
  if(data.getFile().isServerSide())return;
  Chapter chapter=(Chapter)(Object)this;
  if("5A10000000000000".equals(chapter.getCodeString()))cir.setReturnValue(PersonalPromotionState.isMainlandUnlockedV110());
 }
}
