package fcraft.promotion.mixin;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.AbstractTexture;
import net.minecraft.client.renderer.texture.TextureManager;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Pseudo;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/** Puffish0.16.8 decodes category backgrounds before enqueueing its handler. */
@Pseudo
@Mixin(targets="net.puffish.skillsmod.client.config.ClientBackgroundConfig",remap=false)
public abstract class ClientBackgroundTextureThreadMixin {
 @Redirect(
  method="create(Lnet/minecraft/resources/ResourceLocation;IILnet/puffish/skillsmod/common/BackgroundPosition;)Lnet/puffish/skillsmod/client/config/ClientBackgroundConfig;",
  at=@At(value="INVOKE",target="Lnet/minecraft/client/renderer/texture/TextureManager;m_118495_(Lnet/minecraft/resources/ResourceLocation;Lnet/minecraft/client/renderer/texture/AbstractTexture;)V",remap=false),
  require=1,remap=false)
 private static void fcraft$registerOnClient(TextureManager manager,ResourceLocation id,AbstractTexture texture) {
  // Minecraft.execute runs immediately on its own thread, otherwise queues.
  // This is called during decode, before Puffish queues the category handler.
  Minecraft.m_91087_().execute(() -> manager.m_118495_(id,texture));
 }
}
