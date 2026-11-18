package fcraft.raid.mixin;
import com.bobmowzie.mowziesmobs.server.entity.MowzieEntity;
import com.bobmowzie.mowziesmobs.server.bossinfo.MMBossInfoServer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
@Mixin(value=MowzieEntity.class,remap=false)
public interface MowzieBossBarAccess {@Accessor(value="bossInfo",remap=false) MMBossInfoServer fcraft$getBossInfo();}
