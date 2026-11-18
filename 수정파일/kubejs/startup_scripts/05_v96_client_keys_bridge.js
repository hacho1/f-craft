// Rebindable controls; K stays owned by Pufferfish Skills.
// Forge saveString() is the base key only; modifiers use getKeyModifier().
global.FCraftMigrateOwnDefaultKeysV98=function(wallet,newspaper,input){var changed=false;if(String(wallet.saveString())==='key.keyboard.h'&&String(wallet.getKeyModifier())==='NONE'){wallet.setKey(input.getKey('key.keyboard.g'));changed=true;}if(String(newspaper.saveString())==='key.keyboard.j'&&String(newspaper.getKeyModifier())==='NONE'){newspaper.setKey(input.getKey('key.keyboard.n'));changed=true;}return changed;};
// Resolve only this pack's known persisted N collision, once per client profile.
global.FCraftResolveWaypointConflictV98=function(mappings,newspaper,input,saved){
 if(saved.newspaperWaypointConflictMigrationV98)return saved.newspaperWaypointConflictMigrationV98;
 var record={version:98,reviewed:true,status:'no_conflict',key_name:'gui.xaero_new_waypoint',before:null,after:null,before_modifier:null,after_modifier:null},target=null,occupied={};
 for(var i=0;i<mappings.length;i++){var mapping=mappings[i],binding=String(mapping.saveString());occupied[binding.split(':')[0]]=true;if(String(mapping.getName())===record.key_name)target=mapping;}
 if(target){record.before_modifier=String(target.getKeyModifier());record.after_modifier=record.before_modifier;record.before=String(target.saveString())+(record.before_modifier==='NONE'?'':':'+record.before_modifier);record.after=record.before;}
 if(target&&record.before==='key.keyboard.n'&&String(target.getKeyModifier())==='NONE'&&String(newspaper.saveString())==='key.keyboard.n'&&String(newspaper.getKeyModifier())==='NONE'){
  var choices=['key.keyboard.j','key.keyboard.h','key.keyboard.f10'],chosen='';for(var k=0;k<choices.length;k++)if(!occupied[choices[k]]){chosen=choices[k];break;}
  if(chosen){target.setKey(input.getKey(chosen));record.after=chosen;record.status='migrated';}else record.status='all_candidates_occupied';
 }else if(target)record.status='preserved_custom_or_nonconflicting';
 saved.newspaperWaypointConflictMigrationV98=record;return record;
};
// Only untouched Iris defaults are released; never rewrite a user's remap.
global.FCraftResolveIrisDefaultsV4=function(mappings,input,saved){
 if(saved.irisCombatDefaultConflictMigrationV4)return saved.irisCombatDefaultConflictMigrationV4;
 var specs={'iris.keybind.toggleShaders':'key.keyboard.k','iris.keybind.reload':'key.keyboard.r'},rows=[];
 for(var i=0;i<mappings.length;i++){var mapping=mappings[i],name=String(mapping.getName());if(!specs[name])continue;var modifier=String(mapping.getKeyModifier()),before=String(mapping.saveString()),row={key_name:name,before:before,before_modifier:modifier,after:before,status:'preserved_custom_or_modified'};
  if(before===specs[name]&&modifier==='NONE'&&mapping.isDefault()){mapping.setKey(input.UNKNOWN);row.after=String(mapping.saveString());row.status='released_exact_default';}rows.push(row);
 }
 var receipt={version:4,reviewed:true,scope:'Iris exact unmodified defaults K/R only; F-Craft parry and Pufferfish controls retained',rows:rows};saved.irisCombatDefaultConflictMigrationV4=receipt;return receipt;
};
if (Platform.isClientEnvironment()&&typeof ClientEvents !== 'undefined') ClientEvents.init(function () {
 var Mapping=Java.loadClass('net.minecraft.client.KeyMapping'),Registry=Java.loadClass('dev.architectury.registry.client.keymappings.KeyMappingRegistry');
 var wallet=new Mapping('F-Craft · 지갑 열기',71,'F-Craft'),newspaper=new Mapping('F-Craft · 신문 읽기',78,'F-Craft'),skillX=new Mapping('F-Craft · 직업 마나 기술 X',88,'F-Craft 마나 스킬'),skillC=new Mapping('F-Craft · 직업 마나 기술 C',67,'F-Craft 마나 스킬');
 Registry.register(wallet);Registry.register(newspaper);Registry.register(skillX);Registry.register(skillC);global.FCraftKeysV96={wallet:wallet,newspaper:newspaper,skillX:skillX,skillC:skillC};
 global.FRANK_KEY_SKILL_1=skillX;global.FRANK_KEY_SKILL_2=skillC;
 try{
  if(Client.options){global.FCraftTrackerRegisteredBeforeOptionsLoadV110=!!global.FCraftTrackerKeyV110;global.FCraftMountRegisteredBeforeOptionsLoadV110=!!global.FCraftMountKeyV110;Client.options.load();}
  var path='kubejs/fcraft_client_preferences_v96.json',saved={};try{saved=JSON.parse(String(JsonIO.readString(path)))||{};}catch(missing){}
  // Migrate only our previous H/J defaults. Other user remaps remain intact.
  if(!saved.foldoutDefaultKeysMigratedV98){var Input=Java.loadClass('com.mojang.blaze3d.platform.InputConstants');global.FCraftMigrateOwnDefaultKeysV98(wallet,newspaper,Input);Mapping.resetMapping();Client.options.save();saved.foldoutDefaultKeysMigratedV98=true;JsonIO.write(path,saved);}
  var previous=saved.newspaperWaypointConflictMigrationV98,compat=global.FCraftResolveWaypointConflictV98(Client.options.keyMappings,newspaper,Java.loadClass('com.mojang.blaze3d.platform.InputConstants'),saved);global.FCraftKeysV96.waypointCompatibility=compat;
  if(!previous){if(compat.status==='migrated'){Mapping.resetMapping();Client.options.save();console.info('[F-Craft] Newspaper N compatibility: Xaero waypoint '+compat.before+' -> '+compat.after);}else if(compat.status==='all_candidates_occupied')console.warn('[F-Craft] N shortcut conflict preserved: J, H and F10 are occupied. Choose separate controls in Options.');JsonIO.write(path,saved);}
  var irisPrevious=saved.irisCombatDefaultConflictMigrationV4,iris=global.FCraftResolveIrisDefaultsV4(Client.options.keyMappings,Java.loadClass('com.mojang.blaze3d.platform.InputConstants'),saved);global.FCraftKeysV96.irisCompatibility=iris;if(!irisPrevious){if(iris.rows.some(function(row){return row.status==='released_exact_default';})){Mapping.resetMapping();Client.options.save();console.info('[F-Craft] Iris untouched K/R defaults released for skills/parry; assign a shader shortcut in Controls if needed.');}JsonIO.write(path,saved);}
  if(global.FCraftEnsureTrackerKeyV110)global.FCraftEnsureTrackerKeyV110();
 }catch(e){console.warn('[F-Craft] control migration: '+e);}
});
