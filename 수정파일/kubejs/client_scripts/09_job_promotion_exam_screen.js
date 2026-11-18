// F-Craft v10.6 — dedicated 320×204 parchment promotion Screen.
// Uses the same installed non-chat Minecraft/FancyMenu Screen host and native
// Painter font metrics as the guild documents. No chat or inventory fallback.
var JobPromotionExamScreen = (function () {
  var state={open:false,npcId:'',view:null,message:'',page:0,rewardPage:0,pages:1,rewardPages:1,boxes:[],layout:null,hover:'',focused:'',focusIndex:-1,pending:false,hostScreen:null,ticks:0,lastRefresh:0,wasDown:false,wasEsc:false,wasTab:false,wasEnter:false};
  var GROUP='promotion106',MODAL='JOB_PROMOTION_EXAM';
  var statusLabels={unregistered:'직종 등록 필요',available:'무료 접수 가능',active:'실기 진행 중',ready:'승급 심사 가능!',chapter_locked:'제1장 심사 완료',complete:'모든 심사 완료'};
  function layout(w,h) {
    var pw=Math.min(320,w-16),ph=Math.min(204,h-16),x=Math.floor((w-pw)/2),y=Math.floor((h-ph)/2);
    return {w:w,h:h,x:x,y:y,panelW:pw,panelH:ph,innerX:x+12,innerW:pw-24,titleY:y+10,subtitleY:y+25,tabsY:y+40,tabsH:18,headingY:y+64,listY:y+78,listH:Math.max(12,ph-160),lineH:12,pagerY:y+ph-78,rewardY:y+ph-60,rewardH:24,actionY:y+ph-32,actionH:22};
  }
  function currentScreen() { return Client.screen||Client.currentScreen||null; }
  function sameScreen(a,b) { try{return a===b||!!(a&&b&&a.equals&&a.equals(b));}catch(e){return false;} }
  function send(action,jobId) {
    if(!state.open||!Client.player||!Client.player.sendData)return false;
    var packet={npc_id:state.npcId,action:action,job_id:String(jobId||state.view&&state.view.selectedJob||'')};
    if(action==='start'||action==='claim'||action==='pin')packet.expected_grade=String(state.view&&state.view.nextGrade||'');
    Client.player.sendData('f_rank_days:promotion_exam_action',packet);
    state.lastRefresh=state.ticks;
    return true;
  }
  function close(notify,preserveScreen) {
    if(notify&&state.open)send('close');
    var own=sameScreen(currentScreen(),state.hostScreen);
    state.open=false;state.pending=false;state.view=null;state.boxes=[];state.hostScreen=null;
    F96UI.clear(GROUP);
    if(FRankModalHostV82.activeModalId===MODAL){
      if(preserveScreen||!own)FRankModalHostV82.activeModalId=null;
      else FRankModalHostV82.closeNonChatModal(MODAL);
    }
  }
  function receive(data,initial) {
    var view=F96UI.parse(data.view_json,null);
    if(!view||!view.selectedJob)return;
    if(!initial&&(!state.open||String(data.npc_id)!==state.npcId))return;
    var previous=state.view&&state.view.selectedJob;
    state.npcId=String(data.npc_id||view.npcId||'');state.view=view;state.message=String(data.message||'');state.pending=false;
    if(initial||previous!==view.selectedJob){state.page=0;state.rewardPage=0;state.focused='';state.focusIndex=-1;}
    if(initial){
      if(typeof frankNpcDialogClient!=='undefined'&&frankNpcDialogClient.open)closeNpcDialogOnClient(false,true);
      state.open=true;state.hover='';state.wasDown=true;state.lastRefresh=state.ticks;
      FRankModalHostV82.openNonChatModal(MODAL);
      state.hostScreen=currentScreen();
      // A successful packet must own an actual Screen, not just painted HUD.
      if(!state.hostScreen){close(true,true);return;}
    }
    render();
  }
  function checklistRows(view,width) {
    var U=F96UI,rows=[],items=view.objectives||[];
    for(var i=0;i<items.length;i++){
      var objective=items[i],prefix=objective.done?'[완료] ':'[진행] ',count=Math.max(0,Number(objective.current)||0)+' / '+Math.max(0,Number(objective.target)||0);
      var lines=U.wrap(prefix+String(objective.label||'실기 과제')+'  '+count,width,.9,U.FONT,false);
      for(var j=0;j<lines.length;j++)rows.push({text:lines[j],done:!!objective.done});
    }
    if(!rows.length){var empty=U.wrap(view.message||'이번 단계의 실기 심사가 완료되었습니다.',width,.9);for(var e=0;e<empty.length;e++)rows.push({text:empty[e],done:true});}
    return rows;
  }
  function rewardLines(view,width) {
    var U=F96UI,r=view.rewards||{},parts=[];
    if(r.certificate)parts.push('공인 봉랍 자격증');
    if(Number(r.points)>0)parts.push('패시브 스킬 '+Number(r.points)+'점');
    if(Number(r.silver)>0)parts.push(Number(r.silver)+'실버');
    if(r.skill)parts.push(String(r.skill));
    return U.wrap(parts.length?'합격 보상 · '+parts.join(' · '):'현재 단계의 승급 심사를 모두 마쳤습니다.',width,.85);
  }
  function actionFor(view) {
    if(view.status==='available')return {id:'start',label:'무료 실기시험 즉시 시작하기',enabled:true};
    if(view.status==='ready')return {id:'claim',label:'승급 심사 완료 · 자격증과 스킬 보상 받기',enabled:true,gold:true};
    if(view.status==='active')return {id:'navigate',label:'수행 장소 길 안내 켜기',enabled:true};
    return {id:'finished',label:view.status==='unregistered'?'헤스에게 직종을 등록해 주세요':'제1장 승급 심사 완료',enabled:false};
  }
  function render() {
    var s=state,U=F96UI;if(!s.open||!s.view||!Client.player)return;
    var v=U.viewport(),L=layout(v.w,v.h),o={},view=s.view,jobs=view.registeredMentorJobs||[],status=statusLabels[view.status]||'심사 기록 확인',rows=checklistRows(view,L.innerW-12);
    if(s.message&&s.message!==view.message){var notice=U.wrap(s.message,L.innerW-12,.9);for(var ni=notice.length-1;ni>=0;ni--)rows.unshift({text:notice[ni],done:false});}
    var pageRows=Math.max(1,Math.floor(L.listH/L.lineH)),pages=U.pages(rows,pageRows);
    s.layout=L;s.boxes=[];s.page=Math.max(0,Math.min(pages.length-1,s.page));s.pages=pages.length;
    o.f106_exam_backdrop=U.rect(0,0,v.w,v.h,'#A61F170F');
    o.f106_exam_frame=U.rect(L.x,L.y,L.panelW,L.panelH,'#775532');
    o.f106_exam_paper=U.rect(L.x+3,L.y+3,L.panelW-6,L.panelH-6,null,'f_rank_days:textures/gui/npc_dialog/speech_panel.png');
    o.f110_exam_medal=U.rect(L.innerX,L.titleY-1,14,14,null,'f_rank_days:textures/gui/npc_dialog/icon_promotion.png');o.f110_exam_medal.centered=false;
    U.line(o,'f106_exam_title','직종 승급 심사',L.innerX+18,L.titleY,L.innerW-42,1,'#3A2917',true);
    s.boxes.push(U.button(o,'exam_close','×',L.x+L.panelW-26,L.y+8,16,16,true,false,s.hover==='exam_close'||s.focused==='exam_close'));
    var grade=String(view.currentGrade||'F')+'급 → '+String(view.nextGrade||view.currentGrade||'C')+'급';
    U.line(o,'f106_exam_status',String(view.jobLabel||'')+' · '+grade+' · '+status,L.innerX,L.subtitleY,L.innerW,.85,view.status==='ready'?'#7B4D12':'#5D4328',true);
    var gap=4,tw=(L.innerW-gap*Math.max(0,jobs.length-1))/Math.max(1,jobs.length);
    for(var i=0;i<jobs.length;i++)s.boxes.push(U.button(o,'job_'+jobs[i].id,String(jobs[i].label)+' '+String(jobs[i].grade)+'급',L.innerX+i*(tw+gap),L.tabsY,tw,L.tabsH,!s.pending,String(jobs[i].id)===String(view.selectedJob),s.hover==='job_'+jobs[i].id||s.focused==='job_'+jobs[i].id));
    var canPin=['available','active','ready'].indexOf(view.status)>=0,pinW=Math.min(118,L.innerW*.45),pinX=L.innerX+L.innerW-pinW;
    U.line(o,'f106_exam_heading','실기 과제 · 달성도',L.innerX,L.headingY,L.innerW-pinW-5,.85,'#4D351F',true);
    s.boxes.push(U.button(o,'tracker_pin',view.trackerPinned?'우측 화면에 고정됨':'우측 화면에 이 시험 고정',pinX,L.headingY-3,pinW,14,canPin&&!s.pending,view.trackerPinned===true,s.hover==='tracker_pin'||s.focused==='tracker_pin'));
    o.f106_exam_list=U.rect(L.innerX-2,L.listY-3,L.innerW+4,L.listH+4,'#C9B58C');
    var shown=pages[s.page];
    for(var row=0;row<shown.length;row++)U.line(o,'f106_exam_objective_'+row,shown[row].text,L.innerX+4,L.listY+row*L.lineH,L.innerW-8,.9,shown[row].done?'#24523A':'#3D2B1A',false);
    if(s.pages>1){s.boxes.push(U.button(o,'page_prev','이전',L.innerX,L.pagerY,36,13,s.page>0,false,s.hover==='page_prev'||s.focused==='page_prev'));s.boxes.push(U.button(o,'page_next','다음',L.innerX+L.innerW-36,L.pagerY,36,13,s.page+1<s.pages,false,s.hover==='page_next'||s.focused==='page_next'));U.centered(o,'f106_exam_page',(s.page+1)+' / '+s.pages,L.innerX+40,L.pagerY+2,L.innerW-80,.75,'#64492C');}
    else U.line(o,'f106_exam_note',s.pending?'서버 원부를 확인하고 있습니다…':'무료 접수 · 실기 달성 후 스승에게 심사',L.innerX,L.pagerY+2,L.innerW,.75,'#694C2C');
    var rewards=U.pages(rewardLines(view,L.innerW-30),2);s.rewardPages=rewards.length;s.rewardPage=Math.max(0,Math.min(rewards.length-1,s.rewardPage));
    o.f106_exam_reward_bg=U.rect(L.innerX-2,L.rewardY-3,L.innerW+4,L.rewardH+2,'#DBC798');
    for(var r=0;r<rewards[s.rewardPage].length;r++)U.line(o,'f106_exam_reward_'+r,rewards[s.rewardPage][r],L.innerX+3,L.rewardY+r*11,L.innerW-30,.85,'#65481F',r===0);
    if(rewards.length>1)s.boxes.push(U.button(o,'reward_next','›',L.innerX+L.innerW-18,L.rewardY,18,20,true,false,s.hover==='reward_next'||s.focused==='reward_next'));
    var main=actionFor(view);
    if(main.gold)o.f106_exam_claim_edge=U.rect(L.innerX-1,L.actionY-1,L.innerW+2,L.actionH+2,'#E3AF39');
    s.boxes.push(U.button(o,main.id,s.pending?'기록 확인 중…':main.label,L.innerX,L.actionY,L.innerW,L.actionH,main.enabled&&!s.pending,!!main.gold,s.hover===main.id||s.focused===main.id));
    U.paint(GROUP,o);
  }
  function action(id) {
    var s=state;if(!s.open)return false;
    if(id==='exam_close'){close(true,false);return true;}
    if(id==='page_prev'){s.page--;render();return true;}
    if(id==='page_next'){s.page++;render();return true;}
    if(id==='reward_next'){s.rewardPage=(s.rewardPage+1)%s.rewardPages;render();return true;}
    if(s.pending)return false;
    if(id==='tracker_pin'&&['available','active','ready'].indexOf(s.view.status)>=0){s.pending=true;send('pin');render();return true;}
    if(id.indexOf('job_')===0){s.pending=true;send('select',id.slice(4));render();return true;}
    var offered=actionFor(s.view);
    if(id!==offered.id||!offered.enabled)return false;
    s.pending=true;send(id);render();return true;
  }
  function tick() {
    var s=state;s.ticks++;if(!s.open)return;
    if(!Client.player||!sameScreen(currentScreen(),s.hostScreen)||FRankModalHostV82.activeModalId!==MODAL){close(!!Client.player,true);return;}
    // Live objectives/rewards are always recomputed by the server. The packet
    // handler rechecks mentor distance; walking away closes this Screen.
    if(!s.pending&&s.ticks-s.lastRefresh>=20)send('refresh');
    if(s.pending&&s.ticks-s.lastRefresh>=100){s.pending=false;send('refresh');render();}
    try{
      var g=Java.loadClass('org.lwjgl.glfw.GLFW'),win=Client.window.window,esc=g.glfwGetKey(win,256)===1;
      if(esc&&!s.wasEsc){s.wasEsc=esc;close(true,false);return;}s.wasEsc=esc;
      var tab=g.glfwGetKey(win,258)===1,enter=g.glfwGetKey(win,257)===1;
      if(tab&&!s.wasTab){var enabled=s.boxes.filter(function(b){return b.enabled;});s.focusIndex=(s.focusIndex+1)%Math.max(1,enabled.length);s.focused=enabled.length?enabled[s.focusIndex].id:'';render();}
      if(enter&&!s.wasEnter&&s.focused)action(s.focused);s.wasTab=tab;s.wasEnter=enter;
      var pointer=F96UI.pointer(),hover='';
      for(var i=0;i<s.boxes.length;i++)if(F96UI.contains(s.boxes[i],pointer.x,pointer.y)){hover=s.boxes[i].id;break;}
      if(hover!==s.hover){s.hover=hover;render();}
      var down=g.glfwGetMouseButton(win,0)===1;
      if(down&&!s.wasDown&&!F96UI.pointerBlocked())for(var j=0;j<s.boxes.length;j++)if(s.boxes[j].enabled&&F96UI.contains(s.boxes[j],pointer.x,pointer.y)){action(s.boxes[j].id);break;}
      s.wasDown=down;
    }catch(e){s.inputError=String(e);}
  }
  NetworkEvents.dataReceived('f_rank_days:open_promotion_exam_ui',function(e){receive(e.data||{},true);});
  NetworkEvents.dataReceived('f_rank_days:update_promotion_exam_ui',function(e){receive(e.data||{},false);});
  NetworkEvents.dataReceived('f_rank_days:close_promotion_exam_ui',function(){if(state.open)close(false,false);});
  ClientEvents.tick(tick);
  ClientEvents.loggedOut(function(){if(state.open)close(false,true);state.npcId='';state.message='';});
  F96UI.onResize(function(){if(state.open)render();});
  // Coordinate with the existing host, so opening a different native document
  // releases our session and removes every owned Painter object immediately.
  var previousPrepare=FRankModalHostV82.prepareModalV5;
  FRankModalHostV82.prepareModalV5=function(id){if(id!==MODAL&&state.open)close(true,true);if(previousPrepare)previousPrepare.call(this,id);};
  return {getState:function(){return state;},isOpen:function(){return state.open;},layout:layout,render:render,action:action,close:close,receive:receive,checklistRows:checklistRows,rewardLines:rewardLines,actionFor:actionFor,modalId:MODAL};
})();
global.JobPromotionExamScreen=JobPromotionExamScreen;
global.FCraftPromotionExamClientV106=JobPromotionExamScreen;
NetworkEvents.dataReceived('f_rank_days:promotion_filter_v106',function(event){
  Java.loadClass('fcraft.promotion.client.PersonalPromotionState').applyJson(String((event.data||{}).state_json||'{}'));
});
