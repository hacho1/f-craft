package dev.fcraft.raid.client;

import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.ViewportEvent;
import net.minecraftforge.client.event.ClientPlayerNetworkEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

/** Render-camera offsets only: never changes a player's aim, input or mouse. */
@Mod.EventBusSubscriber(modid="fcraft_raid_bridge", value=Dist.CLIENT)
public final class RaidCameraShake {
    private static long started;
    private static long duration;
    private static double amplitude;
    private static String encounter = "";
    private static long renderEvents;
    private static double peakAppliedDegrees;

    private RaidCameraShake() {}

    public static boolean begin(String id, double durationMs, double degrees) {
        if(id == null || id.isBlank() || id.length() > 128 || !Double.isFinite(durationMs)
                || !Double.isFinite(degrees) || durationMs <= 0 || degrees <= 0) return false;
        // Duplicate delivery of one physical landing cannot restart its shake.
        if(id.equals(encounter)) return false;
        encounter=id;
        started=System.nanoTime();
        duration=(long)(Math.min(1500.0,durationMs)*1000000.0);
        amplitude=Math.min(3.0,degrees);
        renderEvents=0;
        peakAppliedDegrees=0;
        return true;
    }

    @SubscribeEvent public static void camera(ViewportEvent.ComputeCameraAngles event) {
        if(duration<=0) return;
        long elapsed=System.nanoTime()-started;
        if(elapsed<0 || elapsed>=duration){duration=0;return;}
        double age=(double)elapsed/duration, fade=(1.0-age)*(1.0-age);
        double yaw=Math.sin(age*31.41592653589793)*amplitude*fade,pitch=Math.sin(age*43.9822971502571)*amplitude*fade;
        event.setYaw(event.getYaw()+(float)yaw);
        event.setPitch(event.getPitch()+(float)pitch);
        event.setRoll(event.getRoll()+(float)(Math.sin(age*25.132741228718345)*amplitude*.35*fade));
        renderEvents++;
        peakAppliedDegrees=Math.max(peakAppliedDegrees,Math.max(Math.abs(yaw),Math.abs(pitch)));
    }

    @SubscribeEvent public static void logout(ClientPlayerNetworkEvent.LoggingOut event){clear();}
    /** Read-only evidence from real Forge render callbacks, never a synthetic event. */
    public static java.util.Map<String,Object> evidence(){return java.util.Map.of("encounter",encounter,"renderEvents",renderEvents,"peakAppliedDegrees",peakAppliedDegrees,"active",duration>0&&System.nanoTime()-started<duration);}
    public static void clear(){started=0;duration=0;amplitude=0;encounter="";}
}
