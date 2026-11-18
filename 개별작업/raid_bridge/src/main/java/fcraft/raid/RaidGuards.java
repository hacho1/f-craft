package fcraft.raid;

import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.network.chat.Component;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.eventbus.api.EventPriority;
import net.minecraftforge.event.ItemAttributeModifierEvent;
import net.minecraftforge.event.entity.living.LivingAttackEvent;
import net.minecraftforge.event.entity.living.LivingHurtEvent;
import net.minecraftforge.event.entity.player.ItemTooltipEvent;
import net.minecraftforge.event.level.BlockEvent;
import net.minecraftforge.event.entity.living.LivingDropsEvent;
import net.minecraftforge.event.entity.living.LivingDeathEvent;
import net.minecraft.core.registries.BuiltInRegistries;

public final class RaidGuards {
 private static boolean invulnerable(LivingEntity e){long tick=e.m_9236_().m_46467_();return e.getPersistentData().m_128454_("fcraft_raid_intro_until_tick")>tick||e.getPersistentData().m_128454_("fcraft_raid_phase_until_tick")>tick;}
 @SubscribeEvent(priority=EventPriority.HIGHEST) public static void attack(LivingAttackEvent e){
  if(invulnerable(e.getEntity())){e.setCanceled(true);return;}
  if(e.getSource().m_7640_()!=null&&e.getSource().m_7640_().getPersistentData().m_128471_("fcraft_raid_cosmetic_fangs_v105")){e.setCanceled(true);return;}
  if(e.getSource().m_7639_() instanceof LivingEntity a){if(invulnerable(a)||a instanceof Player&&RaidBridge.broken(a.m_21205_())||RaidBridge.ownedRaidBoss(a)&&!RaidBridge.scriptedAttackAuthorized(a))e.setCanceled(true);}
 }
 @SubscribeEvent(priority=EventPriority.LOWEST) public static void hurt(LivingHurtEvent e){LivingEntity q=e.getEntity();if(!q.getPersistentData().m_128471_("fcraft_raid_v101"))return;double m=q.getPersistentData().m_128459_("fcraft_raid_damage_multiplier");if(m>0&&m<=3)e.setAmount((float)(e.getAmount()*m));}
 @SubscribeEvent(priority=EventPriority.LOWEST) public static void attributes(ItemAttributeModifierEvent e){if(RaidBridge.broken(e.getItemStack()))e.clearModifiers();}
 @SubscribeEvent public static void tooltip(ItemTooltipEvent e){if(RaidBridge.broken(e.getItemStack()))e.getToolTip().add(Component.m_237113_("§c[손상됨 — 나우 대장간 수리 필요]"));}
 @SubscribeEvent(priority=EventPriority.HIGHEST) public static void breaking(BlockEvent.BreakEvent e){if(RaidBridge.broken(e.getPlayer().m_21205_()))e.setCanceled(true);}
 @SubscribeEvent(priority=EventPriority.LOWEST) public static void drops(LivingDropsEvent e){if(!BuiltInRegistries.f_256780_.m_7981_(e.getEntity().m_6095_()).toString().equals("mowziesmobs:ferrous_wroughtnaut"))return;e.getDrops().removeIf(drop->{String id=BuiltInRegistries.f_257033_.m_7981_(drop.m_32055_().m_41720_()).toString();return id.equals("mowziesmobs:wrought_axe")||id.equals("mowziesmobs:wrought_helmet");});}
 @SubscribeEvent(priority=EventPriority.LOWEST) public static void death(LivingDeathEvent e){if(RaidBridge.ownedRaidBoss(e.getEntity()))RaidBridge.setParryGlow(e.getEntity(),"");}
}
