// Presentation only. Script18 owns geometry, first visits and reentry cooldowns.
// Keep the v9.3 packet and Painter IDs so existing worlds remain compatible.
var FCraftLandmarkHudV94={tick:0,name:'',subtitle:'',first:true,accent:'#D699783D',start:0,end:0,lastWorldPlayer:'',lastLayout:null};
var FCraftLandmarkIdsV94=['fcraft_landmark_border','fcraft_landmark_paper','fcraft_landmark_text','fcraft_landmark_subtitle'];
function landmarkGlyphsV94(value){
  var text=String(value||''),out=[];
  for(var i=0;i<text.length;i++){var code=text.charCodeAt(i);if(code>=0xD800&&code<=0xDBFF&&i+1<text.length&&text.charCodeAt(i+1)>=0xDC00&&text.charCodeAt(i+1)<=0xDFFF)out.push(text.charAt(i)+text.charAt(++i));else out.push(text.charAt(i));}
  return out;
}
function landmarkTextV94(value,limit){return landmarkGlyphsV94(String(value||'').replace(/[\r\n\t\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,limit).join('');}
function landmarkNumberV94(value,fallback,low,high){var n=Number(value);return isFinite(n)?Math.max(low,Math.min(high,n)):fallback;}
function measureLandmarkV94(value){
  var glyphs=landmarkGlyphsV94(value),floor=0;
  for(var i=0;i<glyphs.length;i++){var code=glyphs[i].charCodeAt(0);floor+=code===32?4:code>255?10:7;}
  try{
    if(typeof Client!=='undefined'&&Client.font&&typeof Text!=='undefined'){
      var component=Text.of({text:String(value),font:'f_rank_days:print'}),sequence;
      try{sequence=component.getVisualOrderText();}catch(e1){sequence=component.m_7532_();}
      var measured;try{measured=Client.font.m_92724_(sequence);}catch(e2){measured=Client.font.width(sequence);}
      var width=Number(measured);if(isFinite(width)&&width>=0)return Math.max(width,floor);
    }
  }catch(ignoredMeasurement){}
  return floor;
}
function fitLandmarkV94(value,width,preferred,minimum){
  var text=String(value||''),measured=measureLandmarkV94(text),scale=preferred;
  if(measured*scale>width&&measured>0)scale=Math.max(minimum,width/measured);
  if(measured*scale>width){
    var glyphs=landmarkGlyphsV94(text);
    while(glyphs.length&&measureLandmarkV94(glyphs.join('')+'…')*scale>width)glyphs.pop();
    text=glyphs.join('')+'…';if(measureLandmarkV94(text)*scale>width)text='';
  }
  return {text:text,scale:scale,width:measureLandmarkV94(text)*scale};
}
function layoutLandmarkV94(h,scaledWidth){
  var sw=landmarkNumberV94(scaledWidth,480,1,32768),first=h.first!==false;
  var w=Math.max(1,Math.min(first?300:236,sw-12)),x=(sw-w)/2,y=first?8:14,height=first?32:24;
  var inset=w>32?10:w/4,available=w-inset*2,hasSubtitle=!!h.subtitle;
  return {x:x,y:y,w:w,h:height,center:sw/2,
    title:fitLandmarkV94('〈 '+h.name+' 〉',available,first?0.88:0.72,first?0.55:0.5),
    subtitle:fitLandmarkV94(h.subtitle,available,first?0.64:0.52,first?0.5:0.45),
    titleY:hasSubtitle?y+(first?6:4):y+(first?12:8),subtitleY:y+(first?19:14),accent:h.accent||'#D699783D'};
}
function painterLandmarkV94(){return Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE;}
function removeLandmarkV94(){
  try{
    var painter=painterLandmarkV94(),payload={},count=0;
    for(var i=0;i<FCraftLandmarkIdsV94.length;i++){var id=FCraftLandmarkIdsV94[i];if(painter.getObject(id)!=null){payload[id]={remove:true};count++;}}
    if(!count)return;
    if(typeof Client!=='undefined'&&Client.player){Client.player.paint(payload);return;}
    // loggedOut has no player. Painter.paint(CompoundTag) is the installed
    // public API and invalidates its screen-object cache after removal.
    var Compound=Java.loadClass('net.minecraft.nbt.CompoundTag'),tag=new Compound();
    for(var id in payload){var entry=new Compound();entry.putBoolean('remove',true);tag.put(id,entry);}
    painter.paint(tag);
  }catch(ignoredCleanup){}
}
function clearLandmarkV94(){removeLandmarkV94();var h=FCraftLandmarkHudV94;h.name='';h.subtitle='';h.start=0;h.end=0;h.lastWorldPlayer='';h.lastLayout=null;}
function receiveLandmarkV94(data){
  var d=data||{},h=FCraftLandmarkHudV94,first=d.first===undefined?true:(d.first===true||String(d.first)==='true'||Number(d.first)===1);
  h.name=landmarkTextV94(d.name,64);h.subtitle=landmarkTextV94(d.subtitle,160);h.first=first;
  var accent=String(d.accent||'');h.accent=/^#[0-9a-fA-F]{6}$/.test(accent)?'#D6'+accent.substring(1):/^#[0-9a-fA-F]{8}$/.test(accent)?accent:'#D699783D';
  h.start=h.tick+landmarkNumberV94(d.delay_ticks,0,0,100);
  h.end=h.start+landmarkNumberV94(d.duration_ticks,first?60:40,20,100);
  h.lastWorldPlayer=typeof Client!=='undefined'&&Client.player?String(Client.player.uuid||''):'';
}
if(typeof NetworkEvents!=='undefined')NetworkEvents.dataReceived('f_rank_days:landmark_title_v93',function(event){receiveLandmarkV94(event.data);});
if(typeof ClientEvents!=='undefined'){
  ClientEvents.tick(function(){
    var h=FCraftLandmarkHudV94;h.tick++;
    if(typeof Client==='undefined'||!Client.player||!Client.level){clearLandmarkV94();return;}
    if(h.lastWorldPlayer&&h.lastWorldPlayer!==String(Client.player.uuid||'')){clearLandmarkV94();return;}
    var blocked=typeof isAnyClientGuiBlockingCombat==='function'?isAnyClientGuiBlockingCombat():Boolean(Client.screen);
    var bossBlocked=typeof global!=='undefined'&&global.FCraftBossUiBlockedV105?global.FCraftBossUiBlockedV105():!!(typeof global!=='undefined'&&global.fcraftBossRaidHudV101&&global.fcraftBossRaidHudV101.active&&global.fcraftBossRaidHudV101.tick<global.fcraftBossRaidHudV101.expires&&global.fcraftBossRaidHudV101.player===String(Client.player.uuid||''));
    if(blocked||bossBlocked||!h.name||h.tick<h.start||h.tick>=h.end){removeLandmarkV94();if(h.tick>=h.end){h.name='';h.subtitle='';h.lastLayout=null;}return;}
    var width=Client.window&&Client.window.guiScaledWidth,layout=layoutLandmarkV94(h,width),backgrounds={},foregrounds={};h.lastLayout=layout;
    backgrounds.fcraft_landmark_border={type:'rectangle',x:layout.x,y:layout.y,z:29,w:layout.w,h:layout.h,alignX:'left',alignY:'top',color:layout.accent,draw:'always'};
    backgrounds.fcraft_landmark_paper={type:'rectangle',x:layout.x+2,y:layout.y+2,z:30,w:Math.max(1,layout.w-4),h:layout.h-4,alignX:'left',alignY:'top',texture:'f_rank_days:textures/gui/npc_dialog/speech_panel.png',draw:'always'};
    foregrounds.fcraft_landmark_text={type:'text',x:layout.center,y:layout.titleY,z:31,alignX:'left',alignY:'top',centered:true,scale:layout.title.scale,shadow:false,text:JSON.stringify({text:layout.title.text,font:'f_rank_days:print',color:'#312416'}),draw:'always'};
    if(h.subtitle)foregrounds.fcraft_landmark_subtitle={type:'text',x:layout.center,y:layout.subtitleY,z:31,alignX:'left',alignY:'top',centered:true,scale:layout.subtitle.scale,shadow:false,text:JSON.stringify({text:layout.subtitle.text,font:'f_rank_days:print',color:'#5B4025'}),draw:'always'};
    // Painter follows insertion order, not z. Recreate only our objects so
    // every rectangle precedes every label, including after subtitle changes.
    removeLandmarkV94();Client.player.paint(backgrounds);Client.player.paint(foregrounds);
  });
  if(ClientEvents.loggedOut)ClientEvents.loggedOut(clearLandmarkV94);
}
if(typeof module!=='undefined'&&module.exports)module.exports={glyphs:landmarkGlyphsV94,normalize:landmarkTextV94,measure:measureLandmarkV94,fit:fitLandmarkV94,layout:layoutLandmarkV94};
