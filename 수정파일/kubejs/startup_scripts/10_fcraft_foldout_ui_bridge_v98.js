// Installed KubeJS ForgeEventWrapper registers only during first startup load.
// Platform.isClientEnvironment prevents resolving client classes on a server.
if (Platform.isClientEnvironment()) {
 ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre',function(e){var h=global.FCraftFoldoutV98;if(h&&h.press(e))e.setCanceled(true);});
 ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseButtonReleased$Pre',function(e){var h=global.FCraftFoldoutV98;if(h&&h.release(e))e.setCanceled(true);});
 ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseScrolled$Pre',function(e){var h=global.FCraftFoldoutV98;if(h&&h.scroll(e))e.setCanceled(true);});
}
