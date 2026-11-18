// priority: 10
// KubeJS walks filesystem insertion order within a priority, so the numeric
// priority (not the filename) registers before startup05 loads saved options.
// Only the approved Iris plain-O binding moves; Ctrl+O and combat-roll V stay owned.
global.FCraftResolveTrackerKeyV110=function(mappings,tracker,input,saved){
  if(saved.promotionTrackerKeyMigrationV110)return saved.promotionTrackerKeyMigrationV110;
  var result={version:110,reviewed:true,key_name:'iris.keybind.shaderPackSelection',before:null,after:null,status:'absent',tracker:String(tracker.saveString())};
  for(var i=0;i<mappings.length;i++){
    var mapping=mappings[i];if(String(mapping.getName())!==result.key_name)continue;
    result.before=String(mapping.saveString());result.after=result.before;result.modifier=String(mapping.getKeyModifier());
    if(result.before==='key.keyboard.o'&&result.modifier==='NONE'){
      mapping.setKey(input.getKey('key.keyboard.f7'));result.after=String(mapping.saveString());result.status='migrated_approved_plain_o';
    }else result.status='preserved_custom_or_modified';
    break;
  }
  saved.promotionTrackerKeyMigrationV110=result;return result;
};
global.FCraftEnsureTrackerKeyV110=function(){
  if(global.FCraftTrackerKeyReadyV110)return true;
  if(!global.FCraftTrackerKeyV110||!Client.options)return false;
  try{
    var path='kubejs/fcraft_client_preferences_v96.json',saved={};
    try{saved=JSON.parse(String(JsonIO.readString(path)))||{};}catch(missing){}
    // Startup05 owns the single options.load() for all these registered controls.
    if(!saved.foldoutDefaultKeysMigratedV98)return false;
    var prior=saved.promotionTrackerKeyMigrationV110,Input=Java.loadClass('com.mojang.blaze3d.platform.InputConstants');
    var result=global.FCraftResolveTrackerKeyV110(Client.options.keyMappings,global.FCraftTrackerKeyV110,Input,saved);
    if(!prior){
      if(result.status==='migrated_approved_plain_o'){Java.loadClass('net.minecraft.client.KeyMapping').resetMapping();Client.options.save();}
      JsonIO.write(path,saved);
    }
    global.FCraftTrackerKeyCompatibilityV110=result;global.FCraftTrackerKeyReadyV110=true;return true;
  }catch(error){console.warn('[F-Craft] Promotion tracker control compatibility: '+error);return false;}
};
if(Platform.isClientEnvironment()&&typeof ClientEvents!=='undefined')ClientEvents.init(function(){
  var Mapping=Java.loadClass('net.minecraft.client.KeyMapping'),Registry=Java.loadClass('dev.architectury.registry.client.keymappings.KeyMappingRegistry');
  global.FCraftTrackerKeyV110=new Mapping('key.f_rank_days.toggle_quest_tracker',79,'F-Craft UI');
  Registry.register(global.FCraftTrackerKeyV110);global.FCraftTrackerKeyReadyV110=false;
  global.FCraftMountKeyV110=new Mapping('key.f_rank_days.call_mount',297,'F-Craft UI');
  Registry.register(global.FCraftMountKeyV110);
});
