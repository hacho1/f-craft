// Native, rebindable fifth-module control. Never rewrites an unrelated user key.
global.FCraftResolveCompendiumWaypointV5=function(mappings,codex,input,saved){
 if(saved.compendiumWaypointCompatibilityV5)return saved.compendiumWaypointCompatibilityV5;
 var prior=saved.newspaperWaypointConflictMigrationV98,record={version:5,reviewed:true,status:'preserved',key_name:'gui.xaero_new_waypoint',before:null,after:null},target=null,occupied={};
 for(var i=0;i<mappings.length;i++){var m=mappings[i],key=String(m.saveString());occupied[key.split(':')[0]]=true;if(String(m.getName())===record.key_name)target=m;}
 if(target){record.before=String(target.saveString());record.after=record.before;record.modifier=String(target.getKeyModifier());}
 var exact=target&&prior&&prior.status==='migrated'&&prior.key_name===record.key_name&&prior.before==='key.keyboard.n'&&prior.after==='key.keyboard.j'&&(!prior.after_modifier||prior.after_modifier==='NONE')&&record.before==='key.keyboard.j'&&record.modifier==='NONE'&&String(codex.saveString())==='key.keyboard.j'&&String(codex.getKeyModifier())==='NONE';
 if(exact){var choices=['key.keyboard.h','key.keyboard.f10'],chosen='';for(var j=0;j<choices.length;j++)if(!occupied[choices[j]]){chosen=choices[j];break;}if(chosen){target.setKey(input.getKey(chosen));record.after=chosen;record.status='migrated_prior_pack_assignment';}else record.status='all_candidates_occupied';}
 else if(target)record.status='preserved_custom_or_no_owned_receipt';
 saved.compendiumWaypointCompatibilityV5=record;return record;
};
global.FCraftEnsureCompendiumKeyV5=function(){
 if(!global.FCraftCompendiumKeyV5||!global.FCraftKeysV96||!Client.options)return false;
 if(global.FCraftCompendiumKeyReadyV5)return true;
 try{var path='kubejs/fcraft_client_preferences_v96.json',saved={};try{saved=JSON.parse(String(JsonIO.readString(path)))||{};}catch(missing){}
  // Startup05 owns its earlier H/J and N migrations. Run after its init callback.
  if(!saved.foldoutDefaultKeysMigratedV98)return false;
  var before=saved.compendiumWaypointCompatibilityV5,Input=Java.loadClass('com.mojang.blaze3d.platform.InputConstants'),result=global.FCraftResolveCompendiumWaypointV5(Client.options.keyMappings,global.FCraftCompendiumKeyV5,Input,saved);
  if(!before){if(result.status==='migrated_prior_pack_assignment'){Java.loadClass('net.minecraft.client.KeyMapping').resetMapping();Client.options.save();}JsonIO.write(path,saved);}
  global.FCraftCompendiumKeyCompatibilityV5=result;global.FCraftCompendiumKeyReadyV5=true;
  if(result.status==='all_candidates_occupied')console.warn('[F-Craft] Compendium J/Xaero conflict preserved: both H and F10 are occupied. Review Controls.');return true;
 }catch(error){console.warn('[F-Craft] Compendium control compatibility: '+error);return false;}
};
if(Platform.isClientEnvironment()&&typeof ClientEvents!=='undefined')ClientEvents.init(function(){
 var Mapping=Java.loadClass('net.minecraft.client.KeyMapping'),Registry=Java.loadClass('dev.architectury.registry.client.keymappings.KeyMappingRegistry');
 global.FCraftCompendiumKeyV5=new Mapping('모험가 도감 펼치기/덮기',74,'F-Craft UI');Registry.register(global.FCraftCompendiumKeyV5);
 // Startup05 subsequently loads all registered mappings together, preserving saved remaps.
 global.FCraftCompendiumKeyReadyV5=false;
});
