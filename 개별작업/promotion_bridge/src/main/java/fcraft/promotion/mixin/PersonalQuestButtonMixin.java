package fcraft.promotion.mixin;
import dev.ftb.mods.ftbquests.client.gui.quests.QuestButton;
import dev.ftb.mods.ftbquests.quest.Quest;
import fcraft.promotion.client.PersonalPromotionState;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
/** Editor mode bypasses Quest.isVisible in FTB2001.4.18; filter before that branch. */
@Mixin(value=QuestButton.class,remap=false)
public abstract class PersonalQuestButtonMixin {
 @Shadow @Final private Quest quest;
 @Inject(method="shouldDraw",at=@At("HEAD"),cancellable=true,remap=false)
 private void personalDraw(CallbackInfoReturnable<Boolean> cir){
  if(quest.hasTag("fcraft_v106_hidden")){cir.setReturnValue(false);return;}
  Boolean visible=PersonalPromotionState.visible(quest.getCodeString());
  if(visible!=null)cir.setReturnValue(visible);
 }
}
