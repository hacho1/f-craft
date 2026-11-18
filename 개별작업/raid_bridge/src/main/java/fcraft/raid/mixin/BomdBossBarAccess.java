package fcraft.raid.mixin;
import com.cerbon.bosses_of_mass_destruction.entity.util.BaseEntity;
import net.minecraft.server.level.ServerBossEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;
@Mixin(value=BaseEntity.class,remap=false)
public interface BomdBossBarAccess {@Accessor(value="bossBar",remap=false) ServerBossEvent fcraft$getBossBar();}
