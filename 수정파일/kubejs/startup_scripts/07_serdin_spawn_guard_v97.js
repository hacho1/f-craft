// Installed Forge 47.4.28: cancellation of FinalizeSpawn alone is insufficient.
// Server policy uses setSpawnCancelled(true) and a fresh-only KubeJS spawned guard.
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.MobSpawnEvent$PositionCheck',function(e){var f=global.FRankDays;if(f&&f.onSerdinSpawnPositionV97)f.onSerdinSpawnPositionV97(e);});
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.MobSpawnEvent$FinalizeSpawn',function(e){var f=global.FRankDays;if(f&&f.onSerdinSpawnFinalizeV97)f.onSerdinSpawnFinalizeV97(e);});
ForgeEvents.onEvent('net.minecraftforge.event.level.ExplosionEvent$Detonate',function(e){var f=global.FRankDays;if(f&&f.shouldGuardSerdinExplosionV97&&f.shouldGuardSerdinExplosionV97(e.getLevel()))e.getAffectedBlocks().clear();});
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityMobGriefingEvent',function(e){var f=global.FRankDays;if(f&&f.shouldGuardSerdinExplosionV97&&f.shouldGuardSerdinExplosionV97(e.getEntity().level))e.setResult(Java.loadClass('net.minecraftforge.eventbus.api.Event$Result').DENY);});
ForgeEvents.onEvent('net.minecraftforge.event.server.ServerStoppedEvent',function(e){global.FCraftSerdinSpawnRuntime97=null;});
