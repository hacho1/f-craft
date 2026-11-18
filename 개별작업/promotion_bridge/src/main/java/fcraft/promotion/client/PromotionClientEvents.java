package fcraft.promotion.client;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.client.event.ClientPlayerNetworkEvent;
@Mod.EventBusSubscriber(modid="fcraft_promotion_bridge", value=Dist.CLIENT)
public final class PromotionClientEvents {
 @SubscribeEvent public static void logout(ClientPlayerNetworkEvent.LoggingOut event){PersonalPromotionState.clear();}
}
