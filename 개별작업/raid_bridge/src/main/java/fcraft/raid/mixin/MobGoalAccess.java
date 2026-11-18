package fcraft.raid.mixin;

import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.goal.GoalSelector;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** Access only for our opt-in raid mobs; ordinary mob goals are untouched. */
@Mixin(value=Mob.class,remap=false)
public interface MobGoalAccess {
 @Accessor(value="f_21345_",remap=false) GoalSelector fcraft$getGoals();
 @Accessor(value="f_21346_",remap=false) GoalSelector fcraft$getTargets();
}
