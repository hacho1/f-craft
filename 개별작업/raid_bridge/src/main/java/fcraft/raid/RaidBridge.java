package fcraft.raid;

import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.common.MinecraftForge;
import fcraft.raid.mixin.MowzieBossBarAccess;
import fcraft.raid.mixin.BomdBossBarAccess;
import net.combatroll.api.event.ServerSideRollEvents;
import java.util.UUID;
import java.util.Collections;
import java.util.Set;
import java.util.WeakHashMap;
import net.minecraft.ChatFormatting;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.animal.IronGolem;
import net.minecraft.world.entity.projectile.EvokerFangs;
import net.minecraft.world.entity.LightningBolt;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.attributes.AttributeInstance;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.scores.PlayerTeam;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.world.phys.Vec3;
import com.bobmowzie.mowziesmobs.server.entity.wroughtnaut.EntityWroughtnaut;
import com.ilexiconn.llibrary.server.animation.Animation;
import com.ilexiconn.llibrary.server.animation.AnimationHandler;
import com.ilexiconn.llibrary.server.animation.IAnimatedEntity;
import fcraft.raid.mixin.MobGoalAccess;
import fcraft.raid.mixin.MobEffectParticleAccess;

/** Narrow bridge: no existing registration, save key, job or growth hook is replaced. */
@Mod(RaidBridge.ID)
public final class RaidBridge {
 public static final String ID="fcraft_raid_bridge";
 private static final UUID FREEZE_MODIFIER=UUID.fromString("a4781954-0509-4aa7-bdbd-133c6a0fe105");
 private static final ThreadLocal<LivingEntity> SCRIPTED_ATTACKER=new ThreadLocal<>();
 private static final Set<LivingEntity> PREPARED=Collections.newSetFromMap(new WeakHashMap<>());
 public RaidBridge(){MinecraftForge.EVENT_BUS.register(RaidGuards.class);ServerSideRollEvents.PLAYER_START_ROLLING.register((p,vector)->p.getPersistentData().m_128356_("fcraft_raid_roll_until_tick",p.m_9236_().m_46467_()+4));}
 public static boolean nativeCapabilities(){return true;}
 public static boolean isCombatRollIframe(LivingEntity p){return p!=null&&p.getPersistentData().m_128454_("fcraft_raid_roll_until_tick")>p.m_9236_().m_46467_();}
 public static boolean guardian(ItemStack stack){String id=BuiltInRegistries.f_257033_.m_7981_(stack.m_41720_()).toString();return id.equals("f_rank_days:guardian_wrought_helm")||id.startsWith("f_rank_days:wrought_")&&!id.equals("f_rank_days:wrought_iron_heart")&&!id.equals("f_rank_days:wrought_challenge_sigil")&&!id.equals("f_rank_days:wrought_trial_altar");}
 public static boolean broken(ItemStack stack){return guardian(stack)&&stack.m_41783_()!=null&&stack.m_41783_().m_128471_("fcraft_guardian_broken");}
 public static ServerBossEvent getOriginalBossBar(LivingEntity e){if(e instanceof MowzieBossBarAccess a)return a.fcraft$getBossInfo();if(e instanceof BomdBossBarAccess a)return a.fcraft$getBossBar();return null;}
 public static void setRaidBarVisible(ServerBossEvent bar,boolean visible){if(bar!=null)bar.m_8321_(visible);}
 public static boolean isRaidBarVisible(ServerBossEvent bar){return bar!=null&&bar.m_8323_();}
 public static boolean makeRaidLightningVisual(Object entity){if(!(entity instanceof LightningBolt bolt))return false;bolt.m_20874_(true);return true;}

 /** The original mob AI flag remains enabled. Only the raid's own combat goals
  * are removed: animation ticks and PathNavigation continue to run normally. */
 public static boolean ownedRaidBoss(LivingEntity e){return e!=null&&e.getPersistentData().m_128471_("fcraft_raid_v101");}
 public static void prepareRaidBoss(LivingEntity e){
  if(!ownedRaidBoss(e)||!(e instanceof Mob mob))return;
  mob.m_21557_(false);
  CompoundTag data=e.getPersistentData();
  // NBT survives chunk/server reload but vanilla goals do not. Track actual
  // Java instances, so a reloaded boss has its reconstructed goals removed.
  if(PREPARED.add(e)){
   MobGoalAccess access=(MobGoalAccess)mob;
   access.fcraft$getGoals().m_262460_(goal->true);
   access.fcraft$getTargets().m_262460_(goal->true);
   data.m_128379_("fcraft_raid_prepared_v105",true);
  }
  if(e instanceof EntityWroughtnaut wrought){
   wrought.setActive(true);wrought.setAlwaysActive(true);
   // The removed AnimationAI goals normally clear server-side animation;
   // LLibrary's entity tick clears only the client. Complete that lifecycle
   // here without interrupting a combo segment or the native death sequence.
   Animation animation=wrought.getAnimation();
   if(!e.m_9236_().f_46443_&&animation!=null&&animation!=IAnimatedEntity.NO_ANIMATION
     &&animation!=EntityWroughtnaut.DIE_ANIMATION&&wrought.getAnimationTick()>=animation.getDuration()){
    AnimationHandler.INSTANCE.sendAnimationMessage(wrought,IAnimatedEntity.NO_ANIMATION);
    data.m_128356_("fcraft_raid_completed_animations_v105",data.m_128454_("fcraft_raid_completed_animations_v105")+1);
   }
  }
  if(e instanceof IronGolem golem)golem.m_28887_(false);
  hideRaidEffectParticles(e);
 }
 public static void setRaidSpeed(LivingEntity e,double speed){
  if(!ownedRaidBoss(e)||!Double.isFinite(speed)||speed<=0)return;
  AttributeInstance movement=e.m_21051_(Attributes.f_22279_);
  if(movement!=null)movement.m_22100_(Math.min(1.0,speed));
  AttributeInstance follow=e.m_21051_(Attributes.f_22277_);
  if(follow!=null)follow.m_22100_(40.0);
  e.getPersistentData().m_128347_("fcraft_raid_base_speed_v105",speed);
 }
 public static void setRaidFrozen(LivingEntity e,boolean frozen){
  if(!ownedRaidBoss(e))return;
  prepareRaidBoss(e);
  CompoundTag data=e.getPersistentData();
  boolean wasFrozen=data.m_128471_("fcraft_raid_frozen_v105");
  AttributeInstance movement=e.m_21051_(Attributes.f_22279_);
  if(movement!=null){
   if(frozen&&movement.m_22111_(FREEZE_MODIFIER)==null)
    movement.m_22118_(new AttributeModifier(FREEZE_MODIFIER,"F-Craft raid recovery",-.90,AttributeModifier.Operation.MULTIPLY_TOTAL));
   if(!frozen)movement.m_22120_(FREEZE_MODIFIER);
  }
  data.m_128379_("fcraft_raid_frozen_v105",frozen);
  if(frozen){
   if(e instanceof Mob mob)mob.m_21573_().m_26573_();
   Vec3 motion=e.m_20184_();e.m_20334_(motion.f_82479_*.1,motion.f_82480_*.1,motion.f_82481_*.1);
   if(!wasFrozen&&e instanceof EntityWroughtnaut wrought&&wrought.getAnimation()!=IAnimatedEntity.NO_ANIMATION)
    AnimationHandler.INSTANCE.sendAnimationMessage(wrought,EntityWroughtnaut.HURT_ANIMATION);
  }
 }
 public static boolean pursueBoss(LivingEntity e,LivingEntity target,double speed){
  if(!ownedRaidBoss(e)||!(e instanceof Mob mob)||target==null||!target.m_6084_()||target.m_9236_()!=e.m_9236_())return false;
  prepareRaidBoss(e);
  if(e.getPersistentData().m_128471_("fcraft_raid_frozen_v105"))return false;
  mob.m_6710_(target);
  mob.m_21563_().m_24960_(target,30.0f,30.0f);
  if(e instanceof IronGolem golem){golem.m_6925_(target.m_20148_());golem.m_7870_(400);}
  boolean navigated=mob.m_21573_().m_5624_(target,Math.max(.1,Math.min(2.0,speed)));
  // Native giant-mob pathfinding sometimes rejects short routes beside a
  // pedestal. A small physical velocity still collides normally with blocks.
  double dx=target.m_20185_()-e.m_20185_(),dz=target.m_20189_()-e.m_20189_(),distance=Math.sqrt(dx*dx+dz*dz);
  if(!navigated&&distance>3.8){double base=Math.min(.23,Math.max(.08,e.m_21172_(Attributes.f_22279_)*.65));e.m_20334_(dx/distance*base,e.m_20184_().f_82480_,dz/distance*base);}
  CompoundTag data=e.getPersistentData();
  data.m_128356_("fcraft_raid_pursuit_tick_v105",e.m_9236_().m_46467_());
  data.m_128359_("fcraft_raid_pursuit_target_v105",target.m_20148_().toString());
  data.m_128379_("fcraft_raid_navigation_v105",navigated);
  return mob.m_5448_()==target;
 }
 /** Each accepted call sends a real, tracked native model animation packet. */
 public static boolean playRaidAttack(LivingEntity e,String kind){
  if(!ownedRaidBoss(e)||kind==null)return false;
  prepareRaidBoss(e);
  // Every authored motion owns its movement until the script resumes pursuit.
  // A stale native path otherwise steers a charge back toward its old target
  // and slides the boss through a planted melee/combo animation.
  if(e instanceof Mob mob)mob.m_21573_().m_26573_();
  e.m_21011_(InteractionHand.MAIN_HAND,true);
  if(e instanceof EntityWroughtnaut wrought){
   Animation animation=switch(kind){
    case "parry","slam"->EntityWroughtnaut.VERTICAL_ATTACK_ANIMATION;
    case "melee_twice"->EntityWroughtnaut.ATTACK_TWICE_ANIMATION;
    case "melee_thrice"->EntityWroughtnaut.ATTACK_THRICE_ANIMATION;
    case "stomp"->EntityWroughtnaut.STOMP_ATTACK_ANIMATION;
    case "charge","leap"->EntityWroughtnaut.ATTACK_ANIMATION;
    default->EntityWroughtnaut.ATTACK_ANIMATION;
   };
   if("parry".equals(kind)){
    // Vertical-axe visual contact is native tick29. Start BOTH logical sides
    // at10 so the model's impact coincides with the19-tick raid windup.
    // LLibrary's standard animation packet does not carry a start offset.
    wrought.setAnimation(animation);wrought.setAnimationTick(10);
    e.m_9236_().m_7605_(e,(byte)-105);
   }else AnimationHandler.INSTANCE.sendAnimationMessage(wrought,animation);
  }else if(e instanceof IronGolem){
   e.m_9236_().m_7605_(e,(byte)4);
   e.m_7822_((byte)4); // server-side counter is visible to native QA, too.
  }else{
   // Blossom uses the owner's scripted rotation loop plus physical fang
   // entities; an IronGolem-specific event4 would have no blossom animation.
   e.m_21011_(InteractionHand.MAIN_HAND,true);
  }
  CompoundTag data=e.getPersistentData();
  data.m_128359_("fcraft_raid_motion_v105",kind);
  data.m_128356_("fcraft_raid_motion_tick_v105",e.m_9236_().m_46467_());
  data.m_128356_("fcraft_raid_motion_count_v105",data.m_128454_("fcraft_raid_motion_count_v105")+1);
  return true;
 }
 public static void rotateRaidBoss(LivingEntity e,float yaw){if(ownedRaidBoss(e)&&Float.isFinite(yaw)){e.m_146922_(yaw);e.f_20883_=yaw;e.f_20885_=yaw;}}
 /** Cosmetic fangs are real animated entities, with the raid boss as owner.
  * RaidGuards rejects their native damage; one telegraphed strike owns damage. */
 public static boolean spawnRaidFangs(LivingEntity boss,double x,double y,double z,int warmup){
  if(!ownedRaidBoss(boss)||boss.m_9236_().f_46443_||!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(z))return false;
  EvokerFangs fangs=new EvokerFangs(boss.m_9236_(),x,y,z,boss.m_146908_()*.017453292f,Math.max(0,Math.min(40,warmup)),boss);
  fangs.getPersistentData().m_128379_("fcraft_raid_cosmetic_fangs_v105",true);
  fangs.getPersistentData().m_128359_("fcraft_raid_parent_uuid",boss.m_20148_().toString());
  return boss.m_9236_().m_7967_(fangs);
 }
 public static boolean applyRaidDamage(LivingEntity boss,LivingEntity target,double amount){
  if(!ownedRaidBoss(boss)||target==null||!Double.isFinite(amount)||amount<=0)return false;
  LivingEntity previous=SCRIPTED_ATTACKER.get();SCRIPTED_ATTACKER.set(boss);
  try{return target.m_6469_(boss.m_269291_().m_269333_(boss),(float)Math.min(1000,amount));}
  finally{if(previous==null)SCRIPTED_ATTACKER.remove();else SCRIPTED_ATTACKER.set(previous);}
 }
 public static boolean scriptedAttackAuthorized(LivingEntity boss){return SCRIPTED_ATTACKER.get()==boss;}
 public static void hideRaidEffectParticles(LivingEntity e){
  if(ownedRaidBoss(e))for(var effect:e.m_21220_())((MobEffectParticleAccess)effect).fcraft$setParticles(false);
 }
 /** Team changes are reversible, including bosses that already had a team. */
 public static void setParryGlow(LivingEntity e,String color){
  if(!ownedRaidBoss(e)||e.m_9236_().f_46443_)return;
  CompoundTag data=e.getPersistentData();Scoreboard board=e.m_9236_().m_6188_();String entry=e.m_20149_();
  boolean visible="red".equals(color)||"gold".equals(color);
  if(visible){
   if(!data.m_128471_("fcraft_raid_glow_owned_v105")){PlayerTeam previous=board.m_83500_(entry);data.m_128359_("fcraft_raid_previous_team_v105",previous==null?"":previous.m_5758_());data.m_128379_("fcraft_raid_previous_glow_v105",e.m_146886_());data.m_128379_("fcraft_raid_glow_owned_v105",true);}
   String name="gold".equals(color)?"f_parry_gold":"f_parry_red";PlayerTeam team=board.m_83489_(name);if(team==null)team=board.m_83492_(name);team.m_83351_("gold".equals(color)?ChatFormatting.GOLD:ChatFormatting.DARK_RED);board.m_6546_(entry,team);e.m_146915_(true);
  }else if(data.m_128471_("fcraft_raid_glow_owned_v105")){
   board.m_83495_(entry);String previous=data.m_128461_("fcraft_raid_previous_team_v105");if(!previous.isEmpty()){PlayerTeam team=board.m_83489_(previous);if(team!=null)board.m_6546_(entry,team);}e.m_146915_(data.m_128471_("fcraft_raid_previous_glow_v105"));data.m_128379_("fcraft_raid_glow_owned_v105",false);
  }
  data.m_128359_("fcraft_raid_parry_color_v105",visible?color:"");
 }
}
