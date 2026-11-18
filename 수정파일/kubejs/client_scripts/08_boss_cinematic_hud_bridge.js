// Presentation only: ServerBossEvent remains the single HP-bar authority.
// Actual Forge 1.20.1 IDs are vitral_bossintros / vitral_bossbars.
var FCraftBossHudV101={tick:0,active:false,expires:0,encounter:'',player:'',cue:null,lastPaint:'',nativeIntros:null};
var FCraftBossHudIdsV101=['fcraft_boss_cinema_top','fcraft_boss_cinema_bottom','fcraft_boss_cinema_title','fcraft_boss_cinema_subtitle','fcraft_boss_cinema_victory'];
var FCraftNativeBossHelperV101=null;
var FCraftTravelTitlesClassV104=null;
// A server-owned strike has one short-lived presentation, independent of native intros.
var FCraftParryHudV105={player:'',encounter:'',cue:null,lastLayout:null};
var FCraftParryIdsV105=['edge','track','charge','sweet','cursor','left','left_top','left_bottom','right','right_top','right_bottom','label','success'];
for(var FCraftParryIdIndexV105=0;FCraftParryIdIndexV105<8;FCraftParryIdIndexV105++)FCraftParryIdsV105.push('shard_'+FCraftParryIdIndexV105);
var FCraftBossEventsFieldV105=null;
var FCraftOwnedPaintSerialV105={parry:0,cinema:0};
function submitOwnedBossPaintV105(group,ids,paper,labels){
  var serial=++FCraftOwnedPaintSerialV105[group],owner=typeof Client!=='undefined'&&Client.player?bossHudSessionV101(Client.player):'';
  function apply(){
    // Painter.paint is queued by Minecraft.execute. Inspect native storage only
    // when this operation executes, after all older paints, never when enqueuing.
    if(serial!==FCraftOwnedPaintSerialV105[group])return;
    var painter=Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE,keep={},removed=false,canPaint=!!owner&&typeof Client!=='undefined'&&Client.player&&owner===bossHudSessionV101(Client.player);
    if(canPaint){if(paper)for(var key in paper)keep[key]=true;if(labels)for(var key in labels)keep[key]=true;}
    for(var i=0;i<ids.length;i++){var id=ids[i],object=painter.getObject(id);if(object!=null&&!keep[id]){object.parent.remove(id);removed=true;}}
    // Public Storage.remove is idempotent. A public empty paint invalidates the
    // screen-object cache without sending a remove-only creation instruction.
    if(removed){var Compound=Java.loadClass('net.minecraft.nbt.CompoundTag');painter.paint(new Compound());}
    // Stable IDs update in place; rectangles retain their order before labels.
    if(canPaint){if(paper)Client.player.paint(paper);if(labels)Client.player.paint(labels);}
  }
  if(typeof Client!=='undefined'&&typeof Client.execute==='function'){
    var Runnable=Java.loadClass('java.lang.Runnable');Client.execute(new Runnable({run:apply}));
  }else apply();
}
function parryPainterIdsV105(){var ids=[];for(var i=0;i<FCraftParryIdsV105.length;i++)ids.push('fcraft_parry_'+FCraftParryIdsV105[i]);return ids;}
function nativeBossBarsActiveV105(client){
  try{
    var overlay=client&&client.gui&&client.gui.getBossOverlay();if(!overlay)return false;
    // The installed Forge 1.20.1 BossHealthOverlay keeps its events in this map.
    // Read the real collection; a cached raid flag cannot cover other mods' bosses.
    var events=null;
    try{events=overlay.getEvents();}catch(ignoredNoEventsGetter){}
    if(!events){if(!FCraftBossEventsFieldV105){FCraftBossEventsFieldV105=overlay.getClass().getDeclaredField('f_93699_');FCraftBossEventsFieldV105.setAccessible(true);}events=FCraftBossEventsFieldV105.get(overlay);}
    return !!events&&!events.isEmpty();
  }catch(ignoredOptionalBossOverlay){return false;}
}
function bossUiBlockedV105(client){
  if(!client||!client.player||!client.level)return false;
  if(String(client.level.dimension)==='f_rank_days:guardian_sanctum')return true;
  var s=FCraftBossHudV101;
  return !!(s.active&&s.tick<s.expires&&s.player===bossHudSessionV101(client.player))||nativeBossBarsActiveV105(client);
}
function removeParryHudV105(){
  submitOwnedBossPaintV105('parry',parryPainterIdsV105(),null,null);
}
function clearParryHudV105(){removeParryHudV105();FCraftParryHudV105.player='';FCraftParryHudV105.encounter='';FCraftParryHudV105.cue=null;FCraftParryHudV105.lastLayout=null;}
function receiveParryHudV105(data,player,now){
  var d=data||{},s=FCraftParryHudV105,id=bossHudSessionV101(player),encounter=bossHudTextV101(d.encounter_id,96),action=String(d.action||'start');
  if(!id)return;
  if(s.player&&s.player!==id)clearParryHudV105();
  if(action==='clear'){if(!encounter||!s.encounter||encounter===s.encounter)clearParryHudV105();return;}
  if(action!=='start'&&action!=='success')return;
  if(action==='success'&&s.encounter&&encounter&&s.encounter!==encounter)return;
  var received=now===undefined?Date.now():now,windup=bossHudNumberV101(d.windup_ms,950,100,3000),sweetStart=bossHudNumberV101(d.sweet_start_ms,630,0,windup),sweetEnd=bossHudNumberV101(d.sweet_end_ms,950,sweetStart,windup);
  // remaining_ms lets a server resend without restarting an already-running strike.
  var elapsed=d.remaining_ms===undefined?0:Math.max(0,windup-bossHudNumberV101(d.remaining_ms,windup,0,windup));
  s.player=id;s.encounter=encounter;s.cue={action:action,start:received-elapsed,windup:windup,sweetStart:sweetStart,sweetEnd:sweetEnd,duration:action==='success'?1050:windup};
  renderParryHudV105(typeof Client!=='undefined'?Client:null,received);
}
function layoutParryHudV105(cue,now,width,height){
  if(!cue)return null;var age=Math.max(0,now-cue.start);if(age>=cue.duration)return null;
  var sw=bossHudNumberV101(width,480,64,32768),sh=bossHudNumberV101(height,270,64,32768),cx=sw/2,cy=sh/2,w=Math.min(104,sw-12),progress=Math.max(0,Math.min(1,age/cue.windup)),sweet=age>=cue.sweetStart&&age<=cue.sweetEnd;
  return{x:cx-w/2,y:cy+22,w:w,h:10,cx:cx,cy:cy,age:age,progress:progress,sweet:sweet,sweetX:Math.floor(w*cue.sweetStart/cue.windup),bracket:14+24*(1-progress),success:cue.action==='success',alpha:cue.action==='success'?Math.max(0,Math.min(1,(cue.duration-age)/300)):1};
}
function renderParryHudV105(client,now){
  var s=FCraftParryHudV105;if(!s.cue)return;
  if(!client||!client.player||!client.level||s.player!==bossHudSessionV101(client.player)){clearParryHudV105();return;}
  var l=layoutParryHudV105(s.cue,now===undefined?Date.now():now,client.window&&client.window.guiScaledWidth,client.window&&client.window.guiScaledHeight);s.lastLayout=l;
  var blocked=typeof isAnyClientGuiBlockingCombat==='function'?isAnyClientGuiBlockingCombat():Boolean(client.screen);
  if(!l){clearParryHudV105();return;}if(blocked||client.options&&client.options.hideGui){removeParryHudV105();return;}
  var o={},labels={};function rect(id,x,y,w,h,color){o['fcraft_parry_'+id]={type:'rectangle',x:x,y:y,w:w,h:h,z:410,color:color,draw:'always',alignX:'left',alignY:'top'};}
  function label(id,text,y,color,scale){labels['fcraft_parry_'+id]={type:'text',x:l.cx,y:y,z:411,centered:true,scale:scale,shadow:true,color:color,text:JSON.stringify({text:text,font:'f_rank_days:print'}),draw:'always',alignX:'left',alignY:'top'};}
  if(l.success){
    var a=Math.round(l.alpha*255).toString(16);if(a.length<2)a='0'+a;
    label('success','PARRY! 약점 개방! (+25 MP)',l.cy+35-l.age/150,'#'+a+'FFE391',.72);
    for(var i=0;i<8;i++){var angle=i*3.141592653589793/4,r=8+Math.min(22,l.age/22);rect('shard_'+i,l.cx+Math.cos(angle)*r,l.cy+25+Math.sin(angle)*r*.35,2,2,'#'+a+'FFD54F');}
  }else{
    rect('edge',l.x-1,l.y-1,l.w+2,l.h+2,l.sweet?'#FFFFF176':'#FF8A2020');rect('track',l.x,l.y,l.w,l.h,'#CC141418');
    rect('charge',l.x+1,l.y+1,Math.max(0,l.sweetX-1),l.h-2,'#FF792C32');rect('sweet',l.x+l.sweetX,l.y+1,l.w-l.sweetX-1,l.h-2,'#FFFFD54F');
    rect('cursor',l.x+Math.min(l.w-2,Math.floor(l.progress*l.w)),l.y-2,2,l.h+4,'#FFFFFFFF');
    var color=l.sweet?'#FFFFF176':'#FFECA5A5',left=l.cx-l.bracket,right=l.cx+l.bracket;
    rect('left',left,l.cy-4,1,9,color);rect('left_top',left,l.cy-4,4,1,color);rect('left_bottom',left,l.cy+4,4,1,color);
    rect('right',right,l.cy-4,1,9,color);rect('right_top',right-3,l.cy-4,4,1,color);rect('right_bottom',right-3,l.cy+4,4,1,color);
    label('label',l.sweet?'지금 [R] 패링!':'[R] 패링 준비',l.y-11,l.sweet?'#FFFFF176':'#FFFFD6D6',.66);
  }
  submitOwnedBossPaintV105('parry',parryPainterIdsV105(),o,labels);
}
function yieldTravelTitlesV104(client){
  var s=FCraftBossHudV101;if(!client||!client.player||!client.level||!s.active||s.tick>=s.expires||s.player!==bossHudSessionV101(client.player))return false;
  try{
    if(FCraftTravelTitlesClassV104===false)return false;
    if(!FCraftTravelTitlesClassV104)FCraftTravelTitlesClassV104=Java.loadClass('com.yungnickyoung.minecraft.travelerstitles.TravelersTitlesCommon');
    var manager=FCraftTravelTitlesClassV104.titleManager;if(!manager)return false;
    // Public native API; only this client's active managed raid yields titles.
    // Config flags, recent-visit caches and all unrelated displays are preserved.
    manager.dimensionTitleRenderer.clearTimer();manager.biomeTitleRenderer.clearTimer();return true;
  }catch(ignoredOptionalTravelTitles){FCraftTravelTitlesClassV104=false;return false;}
}
function bossNativeHelperV101(){
  if(FCraftNativeBossHelperV101===false)return null;
  if(FCraftNativeBossHelperV101)return FCraftNativeBossHelperV101;
  try{FCraftNativeBossHelperV101=Java.loadClass('dev.fcraft.raid.client.NativeBossPresentation');return FCraftNativeBossHelperV101;}catch(ignoredOptionalBridge){FCraftNativeBossHelperV101=false;return null;}
}
function bossHudNumberV101(v,f,min,max){var n=Number(v);return isFinite(n)?Math.max(min,Math.min(max,n)):f;}
function bossHudTextV101(v,max){
  var s=String(v||'').replace(/§[0-9a-fk-or]/gi,'').replace(/[\r\n\t\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim(),out='';
  for(var i=0,count=0;i<s.length&&count<max;count++){var n=s.codePointAt(i),units=n>0xFFFF?2:1;out+=s.substring(i,i+units);i+=units;}return out;
}
function bossNativeIntrosV101(platform){
  var p=platform||(typeof Platform!=='undefined'?Platform:null);if(!p||typeof p.isLoaded!=='function')return false;
  var names=['vitral_bossintros','boss_intros','bossintros'];
  for(var i=0;i<names.length;i++)try{if(p.isLoaded(names[i]))return true;}catch(ignoredPlatform){}return false;
}
function publishBossHudV101(){if(typeof global!=='undefined')global.fcraftBossRaidHudV101={active:FCraftBossHudV101.active,expires:FCraftBossHudV101.expires,tick:FCraftBossHudV101.tick,player:FCraftBossHudV101.player};}
function removeBossHudV101(){
  submitOwnedBossPaintV105('cinema',FCraftBossHudIdsV101,null,null);
  FCraftBossHudV101.lastPaint='';
}
function clearBossHudV101(){clearRaidCameraV106();var s=FCraftBossHudV101;removeBossHudV101();clearParryHudV105();s.active=false;s.expires=0;s.encounter='';s.player='';s.cue=null;var helper=bossNativeHelperV101();if(helper)try{helper.clear();}catch(ignoredNativeClear){}publishBossHudV101();}
function bossHudSessionV101(player){return String(player&&player.uuid||'');}
function receiveBossStateV101(d,player){
  d=d||{};var s=FCraftBossHudV101,id=bossHudSessionV101(player);if(!id){clearBossHudV101();return;}
  if(s.player&&s.player!==id)clearBossHudV101();
  var encounter=bossHudTextV101(d.encounter_id,96),enabled=d.active===true||String(d.active)==='true'||Number(d.active)===1;
  if(!enabled){if(!encounter||!s.encounter||encounter===s.encounter){s.active=false;s.expires=0;s.encounter='';clearParryHudV105();}publishBossHudV101();return;}
  s.active=true;s.encounter=encounter;s.player=id;s.expires=s.tick+bossHudNumberV101(d.expires_ticks,40,10,100);yieldTravelTitlesV104(typeof Client!=='undefined'?Client:null);publishBossHudV101();
}
function receiveBossCueV101(d,player,nativeOverride){
  d=d||{};var s=FCraftBossHudV101,id=bossHudSessionV101(player);if(!id)return;
  var action=String(d.action||''),encounter=bossHudTextV101(d.encounter_id,96);
  if(action==='intro_end'){if(!encounter||!s.cue||encounter===s.cue.encounter){s.cue=null;removeBossHudV101();var endedHelper=bossNativeHelperV101();if(endedHelper)try{endedHelper.clear();}catch(ignoredIntroEnd){}}return;}
  if(action==='phase2'){if(s.cue&&s.cue.nativeOnly&&s.cue.action==='intro'&&(!encounter||encounter===s.cue.encounter)){s.cue=null;removeBossHudV101();var phaseHelper=bossNativeHelperV101();if(phaseHelper)try{phaseHelper.clear();}catch(ignoredPhaseIntroEnd){}}return;}
  if(action==='reset'){
    var resetHelper=bossNativeHelperV101();if(resetHelper)try{resetHelper.resetBar(String(d.boss_id||''),String(d.boss_bar_id||''));}catch(ignoredNativeReset){}
    if(!encounter||!s.encounter||encounter===s.encounter)clearBossHudV101();return;
  }
  if(action!=='intro'&&action!=='victory')return;
  if(s.player&&s.player!==id)clearBossHudV101();s.player=id;
  // The native mod already draws both entrance and victory. Never mirror it.
  var nativeLoaded=nativeOverride===undefined?bossNativeIntrosV101():nativeOverride;
  s.nativeIntros=nativeLoaded;var token=encounter+'|'+action;if(s.cue&&s.cue.token===token)return;
  var duration=action==='intro'?bossHudNumberV101(d.duration_ticks,50,1,100):60,elapsed=action==='intro'?bossHudNumberV101(d.elapsed_ticks,0,0,duration):0;
  if(nativeLoaded&&action==='intro'){var nativeHelper=bossNativeHelperV101();if(nativeHelper)try{nativeHelper.beginIntro(String(d.boss_id||''),String(d.boss_bar_id||''),bossHudTextV101(d.title,96),bossHudTextV101(d.subtitle,128),bossHudNumberV101(d.native_title_duration_ticks,duration,1,70));}catch(ignoredNativeBegin){}}
  if(nativeLoaded&&action==='victory'){s.cue=null;removeBossHudV101();return;}
  s.cue={action:action,encounter:encounter,token:token,title:bossHudTextV101(d.title,96),subtitle:bossHudTextV101(d.subtitle,128),start:s.tick-elapsed,duration:duration,nativeOnly:!!nativeLoaded,titleDelay:bossHudNumberV101(d.title_delay_ticks,0,0,duration),receivedTick:s.tick,receivedMs:Date.now()};
}
function bossHudMeasureV101(text){var w=0;for(var i=0;i<text.length;){var c=text.codePointAt(i);i+=c>0xFFFF?2:1;w+=c===32?4:c>255?10:7;}return w;}
function fitBossHudV101(text,width,preferred){
  var out=String(text),scale=Math.max(0.45,Math.min(preferred,width/Math.max(1,bossHudMeasureV101(out))));
  while(out.length&&bossHudMeasureV101(out)*scale>width)out=out.substring(0,out.length-1);
  // Avoid a lone UTF-16 surrogate after width clipping.
  if(out.length&&out.codePointAt(out.length-1)>=0xD800&&out.codePointAt(out.length-1)<=0xDBFF)out=out.substring(0,out.length-1);
  return {text:out,scale:scale};
}
function nativeIntroExpiredV106(cue,tick,now){
  if(!cue||cue.action!=='intro'||!cue.nativeOnly)return false;
  var receivedTick=cue.receivedTick===undefined?cue.start:Number(cue.receivedTick),receivedMs=Number(cue.receivedMs);
  return tick-receivedTick>=400||isFinite(receivedMs)&&now-receivedMs>=20000;
}
function layoutBossHudV101(cue,tick,width,height,nativeBarVisible){
  var sw=bossHudNumberV101(width,480,1,32768),sh=bossHudNumberV101(height,270,1,32768),age=tick-cue.start;
  var serverOwnedIntro=cue.action==='intro'&&cue.nativeOnly;
  if(age<0||serverOwnedIntro&&nativeIntroExpiredV106(cue,tick,Date.now())||!serverOwnedIntro&&age>=cue.duration)return null;
  // Native title/bar packets follow server ticks, which can lag client ticks.
  // Hold their letterbox until the server ends the intro, with a bounded failsafe.
  var strength=Math.max(0,Math.min(1,age/8,serverOwnedIntro?1:(cue.duration-age)/10)),bar=Math.min(24,sh/6)*strength,w=Math.max(0,sw-20),cy=sh/2;
  var fade=cue.action==='victory'?Math.min(1,age/10,(cue.duration-age)/20):strength,alpha=Math.round(255*Math.max(0,fade)).toString(16);if(alpha.length<2)alpha='0'+alpha;
  // Preserve the entrance timeline while giving the revealed native HP/name room.
  var topBar=cue.action==='intro'&&cue.nativeOnly&&nativeBarVisible&&age>=Number(cue.titleDelay||0)?Math.min(6,bar):bar;
  return {width:sw,height:sh,bar:bar,topBar:topBar,center:sw/2,cy:cy,alpha:alpha,title:fitBossHudV101(cue.action==='victory'?'VICTORY':cue.title,w,cue.action==='victory'?1.35:1.15),subtitle:fitBossHudV101(cue.action==='victory'?cue.title:cue.subtitle,w,0.72),showTitles:!cue.nativeOnly&&age>=Number(cue.titleDelay||0)};
}
function tickBossHudV101(client){
  var s=FCraftBossHudV101;s.tick++;
  if(!client||!client.player||!client.level){clearBossHudV101();return;}
  if(s.player&&s.player!==bossHudSessionV101(client.player)){clearBossHudV101();return;}
  renderParryHudV105(client);
  var helper=bossNativeHelperV101();if(helper)try{helper.tick();}catch(ignoredNativeTick){}
  if(nativeIntroExpiredV106(s.cue,s.tick,Date.now())){s.cue=null;removeBossHudV101();if(helper)try{helper.clear();}catch(ignoredNativeIntroFailsafe){}}
  if(s.active&&s.tick>=s.expires){s.active=false;s.encounter='';s.expires=0;}yieldTravelTitlesV104(client);publishBossHudV101();
  var blocked=typeof isAnyClientGuiBlockingCombat==='function'?isAnyClientGuiBlockingCombat():Boolean(client.screen);
  if(!s.cue||blocked){removeBossHudV101();return;}
  var window=client.window||{},nativeBarVisible=s.cue.nativeOnly&&s.cue.action==='intro'&&s.tick-s.cue.start>=Number(s.cue.titleDelay||0)&&nativeBossBarsActiveV105(client),l=layoutBossHudV101(s.cue,s.tick,window.guiScaledWidth,window.guiScaledHeight,nativeBarVisible);
  if(!l){s.cue=null;removeBossHudV101();if(helper)try{helper.clear();}catch(ignoredIntroExpiry){}return;}
  var paper={},labels={};
  if(s.cue.action==='intro'){
    paper.fcraft_boss_cinema_top={type:'rectangle',x:0,y:0,z:38,w:l.width,h:l.topBar,color:'#FF000000',draw:'always',alignX:'left',alignY:'top'};
    paper.fcraft_boss_cinema_bottom={type:'rectangle',x:0,y:l.height-l.bar,z:38,w:l.width,h:l.bar,color:'#FF000000',draw:'always',alignX:'left',alignY:'top'};
  }
  if(l.showTitles){labels[s.cue.action==='victory'?'fcraft_boss_cinema_victory':'fcraft_boss_cinema_title']={type:'text',x:l.center,y:l.cy-14,z:39,centered:true,scale:l.title.scale,shadow:true,color:'#'+l.alpha+'E8D39A',text:JSON.stringify({text:l.title.text,font:'f_rank_days:print'}),draw:'always',alignX:'left',alignY:'top'};
  labels.fcraft_boss_cinema_subtitle={type:'text',x:l.center,y:l.cy+9,z:39,centered:true,scale:l.subtitle.scale,shadow:true,color:'#'+l.alpha+'F3EAD1',text:JSON.stringify({text:l.subtitle.text,font:'f_rank_days:print'}),draw:'always',alignX:'left',alignY:'top'};
  }submitOwnedBossPaintV105('cinema',FCraftBossHudIdsV101,paper,labels);
}
var FCraftRaidCameraV106=null;
function raidCameraV106(){if(FCraftRaidCameraV106===false)return null;if(!FCraftRaidCameraV106)try{FCraftRaidCameraV106=Java.loadClass('dev.fcraft.raid.client.RaidCameraShake');}catch(ignoredCameraBridge){FCraftRaidCameraV106=false;}return FCraftRaidCameraV106||null;}
function clearRaidCameraV106(){var helper=raidCameraV106();if(helper)try{helper.clear();}catch(ignoredCameraClear){}}
function receiveRaidCameraV106(d,player){d=d||{};var s=FCraftBossHudV101;if(!player||bossHudSessionV101(player)!==s.player||!s.active||String(d.encounter_id||'')!==s.encounter)return false;var helper=raidCameraV106();return !!(helper&&helper.begin(String(d.encounter_id),bossHudNumberV101(d.duration_ms,550,1,1500),bossHudNumberV101(d.amplitude_deg,2.8,0,3)));}
if(typeof NetworkEvents!=='undefined'){
  NetworkEvents.dataReceived('f_rank_days:boss_camera_shake',function(e){receiveRaidCameraV106(e.data,typeof Client!=='undefined'?Client.player:null);});
  NetworkEvents.dataReceived('f_rank_days:boss_parry_telegraph',function(e){receiveParryHudV105(e.data,typeof Client!=='undefined'?Client.player:null);});
  NetworkEvents.dataReceived('f_rank_days:boss_cinematic_cue',function(e){receiveBossCueV101(e.data,typeof Client!=='undefined'?Client.player:null);});
  NetworkEvents.dataReceived('f_rank_days:boss_raid_state_v101',function(e){receiveBossStateV101(e.data,typeof Client!=='undefined'?Client.player:null);});
}
if(typeof ClientEvents!=='undefined'){
  ClientEvents.tick(function(){tickBossHudV101(typeof Client!=='undefined'?Client:null);});
  if(ClientEvents.loggedOut)ClientEvents.loggedOut(clearBossHudV101);
}
publishBossHudV101();
if(typeof global!=='undefined'){global.FCraftBossUiBlockedV105=function(){return bossUiBlockedV105(typeof Client!=='undefined'?Client:null);};global.FCraftParryHudV105={state:FCraftParryHudV105,receive:receiveParryHudV105,layout:layoutParryHudV105,render:renderParryHudV105,clear:clearParryHudV105};}
if(typeof module!=='undefined'&&module.exports)module.exports={state:FCraftBossHudV101,nativeIntros:bossNativeIntrosV101,receiveState:receiveBossStateV101,receiveCue:receiveBossCueV101,clear:clearBossHudV101,tick:tickBossHudV101,layout:layoutBossHudV101,fit:fitBossHudV101,measure:bossHudMeasureV101,parry:FCraftParryHudV105,receiveParry:receiveParryHudV105,layoutParry:layoutParryHudV105,renderParry:renderParryHudV105,bossUiBlocked:bossUiBlockedV105,nativeBarsActive:nativeBossBarsActiveV105,receiveCamera:receiveRaidCameraV106};
