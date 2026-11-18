// F-Craft v11.0: personal, server-owned promotion objectives beside the world view.
// Coordinates and native-font widths use the same absolute Painter space as F96UI.
var FCraftPromotionTrackerV110=(function(){
  var state={view:null,owner:'',revision:-1,collapsed:false,paintReady:false,painted:false,paintSerial:0,renderKey:'',ownedIds:[],layout:null,presentation:null,seenCompletions:{},completionOrder:[],sounds:[],error:''};
  var COLORS={paper:'#B8111622',edge:'#78C89B3C',active:'#38BDF8',ready:'#FACC15',title:'#FDE68A',done:'#86EFAC',text:'#F8FAFC',count:'#FDE047',muted:'#CBD5E1',track:'#55334155',progress:'#F59E0B',emerald:'#34D399'};
  var MEDAL='f_rank_days:textures/gui/npc_dialog/icon_promotion.png';
  var markerClass=null;
  function markers(){if(!markerClass)markerClass=Java.loadClass('fcraft.promotion.client.PersonalNpcQuestMarkers');return markerClass;}
  function updateMarkerVisibility(){markers().setUiBlocked(!Client.player||!Client.level||!!Client.screen||!!(Client.options&&Client.options.hideGui)||F96UI.isOpen()||!!(global.FCraftBossUiBlockedV105&&global.FCraftBossUiBlockedV105()));}
  function text(value,max){return F96UI.glyphs(String(value==null?'':value).replace(/§[0-9a-fk-or]/gi,'').replace(/[\r\n\t\u0000-\u001f]/g,' ').trim()).slice(0,max||240).join('');}
  function flag(value){return value===true||value===1||String(value)==='true';}
  function number(value,fallback,max){var n=Number(value);return isFinite(n)?Math.max(0,Math.min(max===undefined?1000000000:max,n)):fallback;}
  function playerId(){return Client.player?String(Client.player.uuid):'';}
  function normalise(data){
    if(!data||typeof data!=='object')return null;
    var tasks=data.tasks;if(flag(data.visible)&&(!Array.isArray(tasks)||tasks.length<1||tasks.length>3))return null;
    var out={visible:flag(data.visible),job_id:text(data.job_id,48),job_label:text(data.job_label,48),target_grade:text(data.target_grade,4),title:text(data.title,160),all_completed:flag(data.all_completed),tasks:[],mentor_name:text(data.mentor_name,64),mentor_place:text(data.mentor_place,96),activity_hint:text(data.activity_hint,160),compass_arrow:text(data.compass_arrow,4),distance_m:Math.round(number(data.distance_m,0,30000000)),tracker_id:text(data.tracker_id,160),revision:number(data.revision,0,9007199254740991),sync_reason:text(data.sync_reason,24),completion_event_id:text(data.completion_event_id,180),announce_completion:flag(data.announce_completion)};
    if(out.visible&&(!out.job_id||!out.target_grade||!out.tracker_id))return null;
    if(Array.isArray(tasks))for(var i=0;i<Math.min(3,tasks.length);i++){
      var task=tasks[i]||{},goal=Math.floor(number(task.goal,0));
      if(out.visible&&goal<=0)return null;
      out.tasks.push({label:text(task.label||'실기 과제',240),current:Math.floor(number(task.current,0)),goal:Math.floor(goal),done:flag(task.done)});
    }
    return out;
  }
  function keyLabel(){try{var key=global.FCraftTrackerKeyV110;return key?text(key.getTranslatedKeyMessage().getString(),24):'O';}catch(ignored){return 'O';}}
  function hideReason(){
    if(!Client.player||!Client.level)return 'disconnected';
    if(state.owner&&state.owner!==playerId())return 'foreign_session';
    if(!state.view||!state.view.visible)return 'no_exam';
    if(Client.options&&Client.options.hideGui)return 'hide_gui';
    if(Client.screen)return 'screen';
    if(F96UI.isOpen())return 'modal';
    if(global.FCraftBossUiBlockedV105&&global.FCraftBossUiBlockedV105())return 'boss';
    return '';
  }
  function iconBottom(v){
    if(typeof foldoutLayoutV98==='function'&&typeof foldoutPotionRowsV105==='function'){
      var layout=foldoutLayoutV98(v.w,v.h,foldoutPotionRowsV105());
      return Math.max(layout.coin.y+layout.coin.h,layout.news.y+layout.news.h,layout.codex.y+layout.codex.h);
    }
    return 28;
  }
  function layout(w,h,count,collapsed,topBottom){
    w=Math.max(24,Number(w)||320);h=Math.max(24,Number(h)||240);count=Math.max(1,Math.min(3,Math.floor(count)||1));
    var pw=Math.min(154,w-12),fullH=44+count*18,y=Math.max(54,Number(topBottom||28)+6),autoCollapsed=!collapsed&&h-y-6<fullH;
    var folded=!!collapsed||autoCollapsed,ph=folded?22:fullH;
    y=Math.max(1,Math.min(y,h-ph-6));
    return {viewportW:w,viewportH:h,x:w-pw-6,y:y,w:pw,h:ph,fullH:fullH,collapsed:folded,autoCollapsed:autoCollapsed,contentX:w-pw+2,contentW:Math.max(1,pw-16),headerY:y+6,tasksY:y+26,footerY:y+fullH-14,rowH:18,topIconBottom:Number(topBottom||28)};
  }
  function ellipsis(value,width,scale,bold){
    var U=F96UI,chars=U.glyphs(value),suffix='…';
    while(chars.length&&U.measure(chars.join('')+suffix,U.FONT,bold)*scale>width)chars.pop();
    return chars.join('')+suffix;
  }
  function lines(value,width,scale,count,bold){
    var result=F96UI.wrap(value,width,scale,F96UI.FONT,bold);
    if(result.length>count){result=result.slice(0,count);result[count-1]=ellipsis(result[count-1],width,scale,bold);}
    return result;
  }
  function taskLines(value,firstW,fullW,scale){
    var U=F96UI,chars=U.glyphs(value),first='',index=0;
    while(index<chars.length&&U.measure(first+chars[index],U.FONT,false)*scale<=firstW)first+=chars[index++];
    var rest=chars.slice(index).join('').trim(),second='';
    if(rest)second=U.measure(rest,U.FONT,false)*scale<=fullW?rest:ellipsis(rest,fullW,scale,false);
    return second?[first,second]:[first];
  }
  function presentation(view,L,key){
    var U=F96UI,bodyScale=.82,rows=[],header=view.all_completed?'심사 달성! 스승에게 보고':(view.title||view.job_label+' '+view.target_grade+'급 승급 시험');
    for(var i=0;i<view.tasks.length;i++){
      var task=view.tasks[i],count=String(Math.min(task.current,task.goal))+'/'+String(task.goal),nativeWidth=U.measure(count,U.FONT,false),countScale=Math.min(bodyScale,Math.max(1,L.contentW/2)/Math.max(1,nativeWidth)),countW=nativeWidth*countScale;
      var labelW=Math.max(8,L.contentW-countW-16);
      rows.push({label:task.label,lines:taskLines(task.label,labelW,labelW,bodyScale),labelW:labelW,count:count,countScale:countScale,countW:countW,done:task.done,current:task.current,goal:task.goal,barW:Math.round(L.contentW*Math.max(0,Math.min(1,task.current/task.goal)))});
    }
    var mentor=view.mentor_name||'담당 스승',hunting=view.tasks.some(function(t){return !t.done&&/사냥|동물|일반몹/.test(t.label);});
    var footer=view.activity_hint||(hunting?'사냥: 외곽 들판·초입 동물/몹':'수행: '+(view.mentor_place||'승급 심사 창에서 목표 확인'));
    var right=view.all_completed?'('+view.compass_arrow+' '+view.distance_m+'m)':'',rightScale=.78,rightW=U.measure(right,U.FONT,false)*rightScale;
    if(view.all_completed)footer=mentor+'에게 보고';
    return {header:lines(header,Math.max(1,L.contentW-19),.85,2,true),rows:rows,footer:lines(footer,Math.max(1,L.contentW-rightW-(right?4:0)),.78,1,false)[0],footerRight:right,footerRightW:rightW,footerRightScale:rightScale,badge:'승급 시험 ['+key+']',allCompleted:view.all_completed,keyLabel:key};
  }
  function rect(o,id,x,y,w,h,color){o[id]={type:'rectangle',x:x,y:y,w:Math.max(0,w),h:Math.max(0,h),color:color,alignX:'left',alignY:'top',centered:false,draw:'always',visible:true,z:150};}
  function label(o,id,value,x,y,scale,color,bold){var item=F96UI.text(value,x,y,scale,color,bold);item.alignX='left';item.alignY='top';item.centered=false;item.z=151;o[id]=item;}
  function objects(view,L,P){
    var o={},accent=view.all_completed?COLORS.ready:COLORS.active;
    rect(o,'f110_tracker_paper',L.x,L.y,L.w,L.h,COLORS.paper);
    rect(o,'f110_tracker_accent',L.x,L.y,3,L.h,accent);
    rect(o,'f110_tracker_edge_top',L.x+3,L.y,L.w-3,1,COLORS.edge);
    rect(o,'f110_tracker_edge_bottom',L.x+3,L.y+L.h-1,L.w-3,1,COLORS.edge);
    rect(o,'f110_tracker_medal',L.contentX,L.y+(L.collapsed?4:6),14,14,COLORS.title);delete o.f110_tracker_medal.color;o.f110_tracker_medal.texture=MEDAL;
    if(L.collapsed){label(o,'f110_tracker_badge',P.badge,L.contentX+19,L.y+7,Math.min(.85,(L.contentW-19)/Math.max(1,F96UI.measure(P.badge,F96UI.FONT,true))),COLORS.title,true);return o;}
    for(var h=0;h<P.header.length;h++)label(o,'f110_tracker_title_'+h,P.header[h],L.contentX+19,L.headerY+h*9,.85,view.all_completed?COLORS.done:COLORS.title,true);
    for(var i=0;i<P.rows.length;i++){
      var row=P.rows[i],y=L.tasksY+i*L.rowH,color=row.done?COLORS.done:COLORS.text;
      // Native 2px marks remain readable without relying on unsupported emoji glyphs.
      if(row.done){rect(o,'f110_tracker_mark_a_'+i,L.contentX,y+3,2,3,COLORS.done);rect(o,'f110_tracker_mark_b_'+i,L.contentX+2,y+1,2,5,COLORS.done);}
      else rect(o,'f110_tracker_mark_a_'+i,L.contentX,y+2,3,3,COLORS.count);
      for(var j=0;j<row.lines.length;j++)label(o,'f110_tracker_task_'+i+'_'+j,row.lines[j],L.contentX+8,y+j*8,.82,color,false);
      label(o,'f110_tracker_count_'+i,row.count,L.contentX+L.contentW-row.countW,y,row.countScale,row.done?COLORS.done:COLORS.count,false);
      rect(o,'f110_tracker_track_'+i,L.contentX,y+16,L.contentW,2,COLORS.track);
      rect(o,'f110_tracker_progress_'+i,L.contentX,y+16,row.barW,2,row.done?COLORS.emerald:COLORS.progress);
    }
    label(o,'f110_tracker_footer',P.footer,L.contentX,L.footerY,.78,view.all_completed?COLORS.count:COLORS.muted,false);
    if(P.footerRight)label(o,'f110_tracker_footer_direction',P.footerRight,L.contentX+L.contentW-P.footerRightW,L.footerY,P.footerRightScale,COLORS.count,false);
    return o;
  }
  function submit(paper){
    var serial=++state.paintSerial,owner=state.owner,known=state.ownedIds.slice(),next=Object.keys(paper||{});
    for(var k=0;k<next.length;k++)if(state.ownedIds.indexOf(next[k])<0)state.ownedIds.push(next[k]);
    function apply(){
      if(serial!==state.paintSerial)return;
      var painter=Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE,keep={},removed=false;
      var allowed=!!owner&&owner===playerId()&&!hideReason();
      if(allowed)for(var id in paper)keep[id]=true;
      var ids=known.concat(next);
      for(var i=0;i<ids.length;i++)if(!keep[ids[i]]){var item=painter.getObject(ids[i]);if(item!=null){item.parent.remove(ids[i]);removed=true;}}
      if(removed)painter.paint(new (Java.loadClass('net.minecraft.nbt.CompoundTag'))());
      if(allowed&&next.length){var shapes={},labels={};for(var id in paper)(paper[id].type==='text'?labels:shapes)[id]=paper[id];Client.player.paint(shapes);Client.player.paint(labels);}
    }
    if(typeof Client.execute==='function')Client.execute(new (Java.loadClass('java.lang.Runnable'))({run:apply}));else apply();
  }
  function clear(){
    if(state.painted){state.painted=false;submit({});}
    state.renderKey='';
  }
  function render(force){
    var hidden=hideReason();if(hidden){state.hiddenReason=hidden;clear();return;}
    state.hiddenReason='';if(!state.paintReady)return;
    var v=F96UI.viewport(),L=layout(v.w,v.h,state.view.tasks.length,state.collapsed,iconBottom(v)),key=keyLabel();
    var stamp=JSON.stringify([state.view,L,key]);if(!force&&state.renderKey===stamp)return;
    var P=presentation(state.view,L,key);state.layout=L;state.presentation=P;state.renderKey=stamp;state.painted=true;submit(objects(state.view,L,P));
  }
  function completion(view){
    var id=view.completion_event_id,quiet=['login','pin','direction','clear'];
    if(!view.all_completed||!view.announce_completion||!id||quiet.indexOf(view.sync_reason)>=0||state.seenCompletions[id])return;
    state.seenCompletions[id]=true;state.completionOrder.push(id);
    if(state.completionOrder.length>64)delete state.seenCompletions[state.completionOrder.shift()];
    try{var Events=Java.loadClass('net.minecraft.sounds.SoundEvents'),Simple=Java.loadClass('net.minecraft.client.resources.sounds.SimpleSoundInstance');Client.getSoundManager().play(Simple.forUI(Events.PLAYER_LEVELUP,1));state.sounds.push({id:id,tracker:view.tracker_id});if(state.sounds.length>32)state.sounds.shift();}catch(error){state.error='completion sound: '+String(error);}
  }
  function receive(packet){
    if(!Client.player||!Client.level)return false;
    var view=normalise(F96UI.parse((packet||{}).tracker_json,null));if(!view)return false;
    var owner=playerId();if(state.owner&&state.owner!==owner)reset();
    if(view.revision<state.revision)return false;
    state.owner=owner;state.revision=view.revision;state.view=view;completion(view);render();return true;
  }
  function toggle(){state.collapsed=!state.collapsed;render(true);return state.collapsed;}
  function reset(){
    state.view=null;clear();state.owner='';state.revision=-1;state.collapsed=false;state.paintReady=false;state.layout=null;state.presentation=null;state.seenCompletions={};state.completionOrder=[];state.sounds=[];state.error='';
  }
  NetworkEvents.dataReceived('f_rank_days:sync_promo_tracker',function(event){receive(event.data||{});});
  NetworkEvents.dataReceived('f_rank_days:npc_quest_markers_v110',function(event){markers().applyJson(String((event.data||{}).markers_json||'{}'));updateMarkerVisibility();});
  ClientEvents.tick(function(){
    updateMarkerVisibility();
    if(global.FCraftEnsureTrackerKeyV110)global.FCraftEnsureTrackerKeyV110();
    var mapping=global.FCraftTrackerKeyV110;if(mapping)while(mapping.consumeClick())if(Client.player&&Client.level&&!Client.screen&&!F96UI.isOpen())toggle();
    render();
  });
  ClientEvents.paintScreen(function(){state.paintReady=true;updateMarkerVisibility();render();});
  ClientEvents.loggedOut(function(){reset();markers().clear();});
  F96UI.onResize(function(){render(true);});
  return {getState:function(){return state;},receive:receive,render:render,toggle:toggle,reset:reset,layout:layout,presentation:presentation,normalise:normalise,hideReason:hideReason,objects:objects};
})();
global.FCraftPromotionTrackerV110=FCraftPromotionTrackerV110;
