package dev.fcraft.raid.client;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.UUID;

/** Optional, client-invoked adapter for the audited MIT Boss Intros 0.1.4.
 * No static references to Minecraft client or the optional presentation mod.
 * It neither creates a boss bar nor renders a second cinematic.
 */
public final class NativeBossPresentation {
    private static Class<?> intros;
    private static Class<?> cardType;
    private static Field cardField;
    private static Field seenField;
    private static Constructor<?> cardConstructor;
    private static Method reported;
    private static Method getString;
    private static Method literal;
    private static boolean attempted;
    private static boolean available;
    private static UUID pendingBar;
    private static String pendingTitle = "";
    private static String pendingSubtitle = "";
    private static int pendingTicks;
    private static long pendingDurationMs = 2500L;
    private static Object ownedCard;

    private NativeBossPresentation() {}

    private static boolean ready() {
        if (attempted) return available;
        attempted = true;
        try {
            // Exact names and constructor verified from the pinned classfiles.
            intros = Class.forName("dev.vitral.bossintros.BossIntros");
            cardType = Class.forName("dev.vitral.bossintros.BossIntros$Card");
            Class<?> component = Class.forName("net.minecraft.network.chat.Component");
            cardField = intros.getDeclaredField("card");
            seenField = intros.getDeclaredField("seen");
            cardField.setAccessible(true);
            seenField.setAccessible(true);
            cardConstructor = cardType.getDeclaredConstructor(component, component, component,
                    int.class, long.class, long.class, boolean.class);
            cardConstructor.setAccessible(true);
            reported = intros.getMethod("reported", UUID.class, float.class);
            getString = component.getMethod("getString");
            literal = component.getMethod("m_237113_", String.class);
            available = true;
        } catch (ReflectiveOperationException | LinkageError | SecurityException ignored) {
            available = false;
        }
        return available;
    }

    private static Object value(Object card, String name) throws ReflectiveOperationException {
        Method method = cardType.getDeclaredMethod(name);
        method.setAccessible(true);
        return method.invoke(card);
    }

    private static UUID uuid(String raw) {
        try { return UUID.fromString(raw == null ? "" : raw); }
        catch (IllegalArgumentException ignored) { return null; }
    }

    /** Called only for a server-authorized chapter-one raid intro cue. */
    public static boolean beginIntro(String bossId, String barId, String title, String subtitle) {
        return beginIntro(bossId, barId, title, subtitle, 50);
    }

    public static boolean beginIntro(String bossId, String barId, String title, String subtitle, int durationTicks) {
        if (!ready()) return false;
        // Fixed registry whitelist: other mod bosses cannot be altered.
        if (!ours(bossId)) return false;
        UUID parsed = uuid(barId);
        if (parsed == null || title == null || title.isBlank()) return false;
        pendingBar = parsed;
        pendingTitle = title.replaceAll("§[0-9a-fk-orA-FK-OR]", "");
        pendingSubtitle = subtitle == null ? "" : subtitle;
        pendingTicks = 100;
        pendingDurationMs = Math.max(1, Math.min(70, durationTicks)) * 50L;
        ownedCard = null;
        return true;
    }

    /** Bounds only the matching native intro record to the server's50 ticks.
     * Its existing550ms slide-out remains intact. Native victory is untouched.
     */
    public static void tick() {
        if (!ready() || pendingBar == null || pendingTicks-- <= 0) return;
        try {
            Object current = cardField.get(null);
            if (current == null || current == ownedCard || !Boolean.TRUE.equals(value(current, "letterbox"))) return;
            Map<?, ?> seen = (Map<?, ?>) seenField.get(null);
            if (!seen.containsKey(pendingBar)) return;
            String title = (String) getString.invoke(value(current, "title"));
            if (!title.replaceAll("§[0-9a-fk-orA-FK-OR]", "").contains(pendingTitle)) return;
            Object replacement = cardConstructor.newInstance(value(current, "kicker"),
                    literal.invoke(null, pendingTitle), literal.invoke(null, pendingSubtitle),
                    ((Number)value(current, "color")).intValue(),
                    ((Number)value(current, "start")).longValue(), pendingDurationMs, false);
            cardField.set(null, replacement);
            ownedCard = replacement;
            pendingTicks = 0;
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            pendingTicks = 0;
        }
    }

    /** Must precede that player's REMOVE packet, never a genuine victory. */
    private static boolean ours(String bossId) {
        return "krag".equals(bossId) || "blossom".equals(bossId) || "wrought".equals(bossId);
    }

    public static boolean resetBar(String bossId, String barId) {
        UUID parsed = uuid(barId);
        if (!ours(bossId) || !ready() || parsed == null) return false;
        try {
            // Public API carries the latest progress used by the native REMOVE
            // heuristic.1.0 prevents the<=5% distance/reset false victory.
            reported.invoke(null, parsed, 1.0f);
            if (parsed.equals(pendingBar)) clear();
            return true;
        } catch (ReflectiveOperationException | RuntimeException ignored) { return false; }
    }

    public static void clear() {
        if (available && ownedCard != null) {
            try { if (cardField.get(null) == ownedCard) cardField.set(null, null); }
            catch (ReflectiveOperationException | RuntimeException ignored) {}
        }
        pendingBar = null;
        pendingTitle = "";
        pendingSubtitle = "";
        pendingTicks = 0;
        pendingDurationMs = 2500L;
        ownedCard = null;
    }
}
