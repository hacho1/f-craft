package fcraft.promotion.mixin;
import dev.ftb.mods.ftbquests.quest.*;
import dev.ftb.mods.ftbquests.quest.task.Task;
import fcraft.promotion.client.PersonalPromotionState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.*;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
/** Loaded only on physical client, never changes the server's team progress ledger. */
@Mixin(value=TeamData.class,remap=false)
public abstract class PersonalTeamProgressMixin {
 @Inject(method="isCompleted",at=@At("HEAD"),cancellable=true,remap=false)
 private void personalCompletion(QuestObject object,CallbackInfoReturnable<Boolean> cir){if(((TeamData)(Object)this).getFile().isServerSide())return;if(object==null)return;Boolean b=PersonalPromotionState.completion(object.getCodeString());if(b!=null)cir.setReturnValue(b);}
 @Inject(method="getProgress(J)J",at=@At("HEAD"),cancellable=true,remap=false)
 private void personalProgressId(long id,CallbackInfoReturnable<Long> cir){if(((TeamData)(Object)this).getFile().isServerSide())return;Boolean b=PersonalPromotionState.completion(PersonalPromotionState.hex(id));if(b!=null)cir.setReturnValue(b?1L:0L);}
 @Inject(method="getProgress(Ldev/ftb/mods/ftbquests/quest/task/Task;)J",at=@At("HEAD"),cancellable=true,remap=false)
 private void personalProgressTask(Task task,CallbackInfoReturnable<Long> cir){if(((TeamData)(Object)this).getFile().isServerSide())return;if(task==null)return;Boolean b=PersonalPromotionState.completion(task.getCodeString());if(b!=null)cir.setReturnValue(b?1L:0L);}
 @Inject(method="getRelativeProgress",at=@At("HEAD"),cancellable=true,remap=false)
 private void personalRelative(QuestObject object,CallbackInfoReturnable<Integer> cir){if(((TeamData)(Object)this).getFile().isServerSide())return;if(object==null)return;Boolean b=PersonalPromotionState.completion(object.getCodeString());if(b!=null)cir.setReturnValue(b?100:0);}
}
