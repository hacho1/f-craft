// Exact installed KubeJS2001.6.5 builders. The existing wrought_trial_altar stays intact.
StartupEvents.registry('block',function(e){
 ['guardian_moss_altar','corrupted_blossom_altar','guardian_portal_pedestal','sanctum_escape_crystal'].forEach(function(id){e.create('f_rank_days:'+id).defaultCutout().soundType('Lodestone').hardness(-1).resistance(3600000).lightLevel(.65);});
});
StartupEvents.registry('item',function(e){
 // wrought_challenge_sigil already belongs to original startup01; reuse its registry identity.
 ['ancient_heartwood_core','purifying_dew_vial','wrought_iron_heart'].forEach(function(id){e.create('f_rank_days:'+id).maxStackSize(id==='wrought_iron_heart'?1:16).rarity('epic').texture('f_rank_days:item/'+id);});
 e.create('f_rank_days:guardian_wrought_helm','helmet').tier('iron').modifyTier(function(t){t.setName('minecraft:iron');t.setSlotProtections([0,0,0,3]);t.setToughness(1.5);t.setKnockbackResistance(.15);}).maxDamage(480).rarity('epic').modifyAttribute('minecraft:generic.max_health','fcraft_guardian_helm_health',2,'addition').texture('f_rank_days:item/guardian_wrought_helm');
 var rows=[['wrought_greatsword','sword',7.5,-2.8],['wrought_colossus_axe','axe',10,-3.2],['wrought_sanctuary_mace','sword',7,-2.7],['wrought_reaper_scythe','hoe',7,-2.6],['wrought_alchemic_blade','sword',6,-1.9],['wrought_harpoon_lance','sword',8,-2.8],['wrought_iron_skillet','sword',7.5,-2.6],['wrought_forge_warhammer','sword',8.5,-3],['wrought_relic_staff','sword',6,-2.6],['wrought_corebreaker_pick','pickaxe',7,-2.8],['wrought_shadow_twins','sword',6,-1.8]];
 rows.forEach(function(r){if(r[0]==='wrought_harpoon_lance')return;e.create('f_rank_days:'+r[0],r[1]).tier('diamond').attackDamageBaseline(r[2]).speedBaseline(r[3]).maxDamage(550).rarity('epic').texture('f_rank_days:item/'+r[0]);});
 // Native BowItem preserves real arrows/ammunition, full charge, Infinity and enchantments.
 var Bow=Java.loadClass('net.minecraft.world.item.BowItem'),Props=Java.loadClass('net.minecraft.world.item.Item$Properties'),Rarity=Java.loadClass('net.minecraft.world.item.Rarity');
 e.createCustom('f_rank_days:wrought_siege_bow',function(){return new Bow(new Props().durability(550).rarity(Rarity.EPIC));});
 var Rod=Java.loadClass('net.minecraft.world.item.FishingRodItem');e.createCustom('f_rank_days:wrought_harpoon_lance',function(){return new Rod(new Props().durability(550).rarity(Rarity.EPIC));});
});
(function(){function call(name,e){var f=global.FRankDays;if(f&&typeof f[name]==='function')f[name](e);}
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.ArrowLooseEvent',function(e){call('onGuardianArrowLooseV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityJoinLevelEvent',function(e){call('onGuardianProjectileV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$RightClickBlock',function(e){call('onGuardianUseGuardV102',e);if(!e.isCanceled())call('onGuardianCropUseV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerInteractEvent$RightClickItem',function(e){call('onGuardianUseGuardV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.PlayerEvent$BreakSpeed',function(e){call('onGuardianBreakSpeedV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.level.BlockEvent$BreakEvent',function(e){call('onGuardianBlockBreakV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Finish',function(e){call('onGuardianFoodFinishV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingEntityUseItemEvent$Start',function(e){call('onGuardianFoodStartV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDamageEvent',function(e){call('onGuardianFinalDamageV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.ItemAttributeModifierEvent',function(e){call('onGuardianAttributesV102',e);});
 ForgeEvents.onEvent('net.minecraftforge.event.entity.player.ItemFishedEvent',function(e){call('onGuardianFishedV102',e);});
})();
