// F-Craft v11.0: dedicated royal stable Screen and rebindable personal-mount control.
// All choices, ownership, range and grades are validated by the stable's server session.
var FCraftMountStyleScreenV110=(function(){
  var GROUP='mount_style110',MODAL='PERSONAL_MOUNT_STABLE',closedSessions=[];
  var state={open:false,view:null,page:0,pages:1,boxes:[],layout:null,hover:'',focused:'',focusIndex:-1,pending:false,ticks:0,lastRequest:0,hostScreen:null,wasDown:false,wasEsc:false,wasTab:false,wasEnter:false,error:''};
  var TYPES={horse:'일반 군마',skeleton_horse:'해골 군마',zombie_horse:'좀비 군마'};
  var ARMOR={'minecraft:leather_horse_armor':'가죽 마갑','minecraft:iron_horse_armor':'철 마갑','minecraft:golden_horse_armor':'금 마갑','minecraft:diamond_horse_armor':'다이아 마갑'};
  function flag(v){return v===true||v===1||String(v)==='true';}
  function text(v,max){return F96UI.glyphs(String(v==null?'':v).replace(/§[0-9a-fk-or]/gi,'').replace(/[\r\n\t\u0000-\u001f]/g,' ').trim()).slice(0,max||240).join('');}
  function currentScreen(){return Client.screen||Client.currentScreen||null;}
  function sameScreen(a,b){try{return a===b||!!(a&&b&&a.equals&&a.equals(b));}catch(ignored){return false;}}
  function uuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));}
  function layout(w,h){
    var pw=Math.min(320,w-16),ph=Math.min(216,h-16),x=Math.floor((w-pw)/2),y=Math.floor((h-ph)/2),rows=Math.max(1,Math.min(3,Math.floor((ph-152)/20)));
    return{x:x,y:y,panelW:pw,panelH:ph,innerX:x+12,innerW:pw-24,titleY:y+10,subtitleY:y+27,typesY:y+42,typesH:18,headingY:y+67,listY:y+80,rowH:17,rowStep:20,rows:rows,perPage:rows*2,pagerY:y+ph-69,noteY:y+ph-48,actionY:y+ph-28,actionH:20};
  }
  function normalise(raw){
    if(!raw||!flag(raw.ok)||!uuid(raw.session_id)||String(raw.npc_id)!=='stable_master_v110'||!uuid(raw.npc_uuid)||['F','E','D','C','B','A','S'].indexOf(String(raw.grade))<0)return null;
    var tier=Number(raw.tier);if(!isFinite(tier)||tier%1||tier<0||tier>4)return null;
    if(!Array.isArray(raw.entity_types)||!raw.entity_types.length||raw.entity_types.length>3||!Array.isArray(raw.coats)||!raw.coats.length||raw.coats.length>35)return null;
    var types=[],coats=[],seen={};
    for(var i=0;i<raw.entity_types.length;i++){var type=String(raw.entity_types[i]);if(!TYPES[type]||types.indexOf(type)>=0)return null;types.push(type);}
    for(var j=0;j<raw.coats.length;j++){var coat=raw.coats[j]||{},value=Number(coat.value),label=text(coat.label,80);if(!isFinite(value)||value%1||value<0||value>1030||(value&255)>6||seen[value]||!label)return null;seen[value]=true;coats.push({value:value,label:label});}
    var selected=Number(raw.selected_coat);if(types.indexOf(String(raw.selected_entity))<0||!seen[selected])return null;
    return{ok:true,session_id:String(raw.session_id),npc_id:'stable_master_v110',npc_uuid:String(raw.npc_uuid),title:text(raw.title||'왕립 마구간',100),grade:String(raw.grade),tier:tier,horse_title:text(raw.horse_title,80),selected_entity:String(raw.selected_entity),selected_coat:selected,entity_types:types,coats:coats,armor_id:text(raw.armor_id,100),has_whistle:flag(raw.has_whistle),note:text(raw.note,280),message:text(raw.message,280)};
  }
  function send(action,extra){
    if(!state.open||!state.view||!Client.player)return false;
    var packet={session_id:state.view.session_id,action:action};if(extra){packet.entity_type=String(extra.entity_type);packet.coat=Number(extra.coat);}
    Client.player.sendData('f_rank_days:mount_style_action_v110',packet);state.lastRequest=state.ticks;return true;
  }
  function close(notify,preserveScreen){
    if(notify&&state.open)send('close');var own=sameScreen(currentScreen(),state.hostScreen);
    if(state.view&&closedSessions.indexOf(state.view.session_id)<0){closedSessions.push(state.view.session_id);if(closedSessions.length>32)closedSessions.shift();}
    state.open=false;state.view=null;state.pending=false;state.boxes=[];state.hostScreen=null;F96UI.clear(GROUP);
    if(FRankModalHostV82.activeModalId===MODAL){if(preserveScreen||!own)FRankModalHostV82.activeModalId=null;else FRankModalHostV82.closeNonChatModal(MODAL);}
  }
  function receive(packet){
    var raw=F96UI.parse((packet||{}).view_json,null);if(!raw)return false;
    if(flag(raw.closed)){if(state.open&&state.view&&String(raw.session_id)===state.view.session_id)close(false,false);return true;}
    var view=normalise(raw);if(!view||closedSessions.indexOf(view.session_id)>=0)return false;
    var fresh=!state.open||!state.view||state.view.session_id!==view.session_id,changed=!state.view||state.view.selected_coat!==view.selected_coat;
    if(fresh&&state.open)close(false,true);
    state.view=view;state.pending=false;state.lastRequest=state.ticks;
    if(fresh){state.page=0;state.hover='';state.focused='';state.focusIndex=-1;state.wasDown=true;state.open=true;FRankModalHostV82.openNonChatModal(MODAL);state.hostScreen=currentScreen();if(!state.hostScreen){close(true,true);return false;}}
    if(changed){var L=layout(F96UI.viewport().w,F96UI.viewport().h);for(var i=0;i<view.coats.length;i++)if(view.coats[i].value===view.selected_coat)state.page=Math.floor(i/L.perPage);}
    render();return true;
  }
  function render(){
    var s=state,U=F96UI;if(!s.open||!s.view||!Client.player)return;
    var v=U.viewport(),L=layout(v.w,v.h),view=s.view,o={},gap=4,tw=(L.innerW-gap*(view.entity_types.length-1))/view.entity_types.length;
    s.layout=L;s.boxes=[];s.pages=Math.max(1,Math.ceil(view.coats.length/L.perPage));s.page=Math.max(0,Math.min(s.pages-1,s.page));
    o.f110_mount_backdrop=U.rect(0,0,v.w,v.h,'#A61F170F');o.f110_mount_frame=U.rect(L.x,L.y,L.panelW,L.panelH,'#775532');
    o.f110_mount_paper=U.rect(L.x+3,L.y+3,L.panelW-6,L.panelH-6,null,'f_rank_days:textures/gui/npc_dialog/speech_panel.png');
    o.f110_mount_whistle=U.rect(L.innerX,L.titleY-1,14,14,null,'f_rank_days:textures/gui/quests/node_mount_whistle.png');
    U.line(o,'f110_mount_title',view.title,L.innerX+18,L.titleY,L.innerW-42,1,'#3A2917',true);
    s.boxes.push(U.button(o,'stable_close','×',L.x+L.panelW-26,L.y+8,16,16,true,false,s.hover==='stable_close'||s.focused==='stable_close'));
    U.line(o,'f110_mount_rank','최고 '+view.grade+'급 · '+view.horse_title,L.innerX,L.subtitleY,L.innerW,.85,'#65481F',true);
    for(var i=0;i<view.entity_types.length;i++){var type=view.entity_types[i];s.boxes.push(U.button(o,'type_'+type,TYPES[type],L.innerX+i*(tw+gap),L.typesY,tw,L.typesH,!s.pending,view.selected_entity===type,s.hover==='type_'+type||s.focused==='type_'+type));}
    U.line(o,'f110_mount_heading','군마 모색',L.innerX,L.headingY,L.innerW/2,.85,'#4D351F',true);
    U.line(o,'f110_mount_armor',ARMOR[view.armor_id]||'고유 외형 · 마갑 없음',L.innerX+L.innerW/2,L.headingY,L.innerW/2,.8,'#65481F',false);
    if(view.selected_entity==='horse'){
      var cw=(L.innerW-gap)/2,start=s.page*L.perPage,end=Math.min(view.coats.length,start+L.perPage);
      for(var j=start;j<end;j++){var local=j-start,coat=view.coats[j],id='coat_'+coat.value;s.boxes.push(U.button(o,id,coat.label,L.innerX+(local%2)*(cw+gap),L.listY+Math.floor(local/2)*L.rowStep,cw,L.rowH,!s.pending,view.selected_coat===coat.value,s.hover===id||s.focused===id));}
      if(s.pages>1){s.boxes.push(U.button(o,'coat_prev','이전',L.innerX,L.pagerY,36,13,s.page>0,false,s.hover==='coat_prev'||s.focused==='coat_prev'));s.boxes.push(U.button(o,'coat_next','다음',L.innerX+L.innerW-36,L.pagerY,36,13,s.page+1<s.pages,false,s.hover==='coat_next'||s.focused==='coat_next'));U.centered(o,'f110_mount_page',(s.page+1)+' / '+s.pages,L.innerX+40,L.pagerY+2,L.innerW-80,.75,'#64492C');}
    }else U.paragraph(o,'f110_mount_unique','이 군마는 고유한 외형을 사용합니다. 일반 군마 탭에서 저장된 모색을 고를 수 있습니다.',L.innerX,L.listY,L.innerW,.85,'#4D351F',3);
    var note=U.wrap(s.pending?'마구간 기록을 확인하고 있습니다…':view.message||view.note,L.innerW,.78);
    for(var n=0;n<Math.min(2,note.length);n++)U.line(o,'f110_mount_note_'+n,note[n],L.innerX,L.noteY+n*10,L.innerW,.78,'#65481F',false);
    s.boxes.push(U.button(o,'reclaim',view.has_whistle?'개인 호각 확인 · 무료':'분실한 개인 호각 다시 받기 · 무료',L.innerX,L.actionY,L.innerW,L.actionH,!s.pending,false,s.hover==='reclaim'||s.focused==='reclaim'));
    U.paint(GROUP,o);
  }
  function action(id){
    var s=state;if(!s.open)return false;
    if(id==='stable_close'){close(true,false);return true;}
    if(id==='coat_prev'&&s.page>0){s.page--;render();return true;}if(id==='coat_next'&&s.page+1<s.pages){s.page++;render();return true;}
    if(s.pending)return false;
    if(id==='reclaim'){s.pending=true;send('reclaim');render();return true;}
    if(id.indexOf('type_')===0){var type=id.slice(5);if(s.view.entity_types.indexOf(type)<0)return false;s.pending=true;send('style',{entity_type:type,coat:s.view.selected_coat});render();return true;}
    if(id.indexOf('coat_')===0&&s.view.selected_entity==='horse'){var coat=Number(id.slice(5)),offered=s.view.coats.some(function(c){return c.value===coat;});if(!offered)return false;s.pending=true;send('style',{entity_type:s.view.selected_entity,coat:coat});render();return true;}
    return false;
  }
  function mountAllowed(){return!!Client.player&&!!Client.level&&!currentScreen()&&!F96UI.isOpen()&&!(global.FCraftBossUiBlockedV105&&global.FCraftBossUiBlockedV105());}
  function callMount(){if(!mountAllowed())return false;Client.player.sendData('f_rank_days:call_mount',{});return true;}
  function tick(){
    var s=state;s.ticks++;var mapping=global.FCraftMountKeyV110;if(mapping)while(mapping.consumeClick())callMount();
    if(!s.open)return;
    if(!Client.player||!sameScreen(currentScreen(),s.hostScreen)||FRankModalHostV82.activeModalId!==MODAL){close(!!Client.player,true);return;}
    if(!s.pending&&s.ticks-s.lastRequest>=20)send('refresh');
    if(s.pending&&s.ticks-s.lastRequest>=100){close(true,false);return;}
    try{
      var G=Java.loadClass('org.lwjgl.glfw.GLFW'),window=Client.window.window,esc=G.glfwGetKey(window,256)===1;
      if(esc&&!s.wasEsc){s.wasEsc=esc;close(true,false);return;}s.wasEsc=esc;
      var tab=G.glfwGetKey(window,258)===1,enter=G.glfwGetKey(window,257)===1;
      if(tab&&!s.wasTab){var enabled=s.boxes.filter(function(b){return b.enabled;});s.focusIndex=(s.focusIndex+1)%Math.max(1,enabled.length);s.focused=enabled.length?enabled[s.focusIndex].id:'';render();}
      if(enter&&!s.wasEnter&&s.focused)action(s.focused);s.wasTab=tab;s.wasEnter=enter;
      var pointer=F96UI.pointer(),hover='';for(var i=0;i<s.boxes.length;i++)if(F96UI.contains(s.boxes[i],pointer.x,pointer.y)){hover=s.boxes[i].id;break;}
      if(hover!==s.hover){s.hover=hover;render();}var down=G.glfwGetMouseButton(window,0)===1;
      if(down&&!s.wasDown&&!F96UI.pointerBlocked())for(var j=0;j<s.boxes.length;j++)if(s.boxes[j].enabled&&F96UI.contains(s.boxes[j],pointer.x,pointer.y)){action(s.boxes[j].id);break;}s.wasDown=down;
    }catch(error){s.error=String(error);}
  }
  NetworkEvents.dataReceived('f_rank_days:mount_style_v110',function(e){receive(e.data||{});});
  ClientEvents.tick(tick);ClientEvents.loggedOut(function(){if(state.open)close(false,true);});F96UI.onResize(function(){if(state.open)render();});
  var previous=FRankModalHostV82.prepareModalV5;
  FRankModalHostV82.prepareModalV5=function(id){if(id!==MODAL&&state.open)close(true,true);if(previous)previous.call(this,id);};
  return{getState:function(){return state;},isOpen:function(){return state.open;},layout:layout,normalise:normalise,receive:receive,render:render,action:action,close:close,callMount:callMount,mountAllowed:mountAllowed,modalId:MODAL};
})();
global.FCraftMountStyleScreenV110=FCraftMountStyleScreenV110;
