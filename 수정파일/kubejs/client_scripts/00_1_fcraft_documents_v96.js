// Small Korean labels keep whole-size glyphs; width pressure uses ellipsis, never downscaling.
function documentLabelV10(o,id,value,x,y,width,scale,color,bold,font,centered){var U=F96UI;if(scale!==1){if(centered)U.centered(o,id,value,x,y,width,scale,color,bold);else U.line(o,id,value,x,y,width,scale,color,bold,font);return;}var text=String(value==null?'':value),glyphs=U.glyphs(text);if(U.measure(text,font,bold)>width){while(glyphs.length&&U.measure(glyphs.join('')+'…',font,bold)>width)glyphs.pop();text=glyphs.join('')+'…';}o[id]=U.text(text,centered?x+(width-U.measure(text,font,bold))/2:x,y,1,color,bold,font);}
function documentLineV10(o,id,value,x,y,width,scale,color,bold,font){documentLabelV10(o,id,value,x,y,width,scale,color,bold,font,false);}
function documentCenteredV10(o,id,value,x,y,width,scale,color,bold){documentLabelV10(o,id,value,x,y,width,scale,color,bold,null,true);}
// Guild card and newspaper: every paragraph is width-measured and paginated.
function renderGuildCardV96(s) {
  var U=F96UI,v=U.viewport(),L=computeGuildCardLayoutV82(v.w,v.h),x=(v.w-L.cardW)/2,y=(v.h-L.cardH)/2,w=L.cardW,h=L.cardH,input=s.mode==='INPUT',o={},d=s.cardData;
  o.f96_card_scrim=U.rect(0,0,v.w,v.h,'#B50A0806');
  o.f96_card_paper=U.rect(x,y,w,h,null,'f_rank_days:textures/gui/v8_2/guild_registration_card_v82.png');
  // Clear baked ruled lines inside the original frame; text rows may grow freely.
  o.f96_card_inner=U.rect(x+15,y+Math.max(36,h*0.17),w-30,h-Math.max(36,h*0.17)-20,'#CDB98A');
  var blueTop=y+h*12/220,blueBottom=y+h*36/220;
  documentCenteredV10(o,'f96_card_header',input?'STEP 3 / 3 · 길드 등록증 서명':'아르베른 제국 · 길드 등록증',x+22,(blueTop+blueBottom)/2-5,w-44,0.94,'#FFF0D0',true);
  var name=input?(s.inputText||'성명 미입력'):(d.name||s.inputText||'성명 미입력');
  var nameY=Math.max(y+58,blueBottom+10);
  documentLineV10(o,'f96_card_name_label','성명',x+20,nameY,w-40,1,'#684627',true);
  documentLineV10(o,'f96_card_name',name,x+53,nameY-1,w-74,1.04,'#3B1E08',true,'f_rank_days:handwriting');
  var bodyTop=nameY+19,bodyBottom=input?y+L.inputTop+v.h/2-y-27:y+h-108;
  // inputTop is center-relative, matching the preserved dedicated input handler.
  if(input)bodyBottom=v.h/2+L.statusY-20;
  var scale=1,lineH=13,lines=[];
  var rows=['등록번호  '+d.serial,'고유 능력  '+d.ability+' (F급)','직업  '+d.job+' · '+d.grade+'급','발급일  '+d.issued_date,'발급처  '+d.issuer];
  for(var r=0;r<rows.length;r++){var row=U.wrap(rows[r],w-42,scale);for(var j=0;j<row.length;j++)lines.push(row[j]);}
  var pp=U.pages(lines,Math.max(1,Math.floor((bodyBottom-bodyTop)/lineH)));
  s.page=Math.max(0,Math.min(pp.length-1,Number(s.page||0)));s.pageCount=pp.length;
  for(var i=0;i<pp[s.page].length;i++)o['f96_card_body_'+i]=U.text(pp[s.page][i],x+21,bodyTop+i*lineH,scale,'#352314');
  s.hitboxes=[];
  var pageY=input?bodyBottom+2:y+h-35;
  if(pp.length>1){
    var prev=U.button(o,'f96_card_prev','이전',x+20,pageY,40,14,s.page>0,false,false),next=U.button(o,'f96_card_next','다음',x+w-60,pageY,40,14,s.page+1<pp.length,false,false);
    documentCenteredV10(o,'f96_card_prev_label','이전',x+24,pageY+2,32,1,prev.enabled?'#FFF0CF':'#B9AC91');documentCenteredV10(o,'f96_card_next_label','다음',x+w-56,pageY+2,32,1,next.enabled?'#FFF0CF':'#B9AC91');prev.id='CARD_PREV';next.id='CARD_NEXT';
    for(var q=0;q<2;q++){var b=q?next:prev;s.hitboxes.push({id:b.id,left:b.x-v.w/2,top:b.y-v.h/2,w:b.w,h:b.h,enabled:b.enabled});}
    documentCenteredV10(o,'f96_card_pagenum',(s.page+1)+' / '+pp.length,x+65,pageY+3,w-130,1,'#684627');
  }
  if(input){
    var valid=validateGuildCardNameClientV82(s.inputText),ix=v.w/2+L.inputLeft,iy=v.h/2+L.inputTop;
    var status=s.serverErrorMsg||valid.message;
    documentLineV10(o,'f96_card_status',status,ix+2,v.h/2+L.statusY,L.inputW-4,1,s.serverErrorMsg||!valid.valid?'#8C2C25':'#2A6749');
    o.f96_card_field=U.rect(ix,iy,L.inputW,L.inputH,null,'f_rank_days:textures/gui/v8_2/input_field_'+(valid.valid?'focused':'invalid')+'.png');
    var cursor=s.inputFocused&&Math.floor(s.tickCounter/10)%2===0?'|':'';
    documentLineV10(o,'f96_card_value',(s.inputText||'한글 성명 2~16자 · 붙여넣기 가능')+cursor,ix+7,iy+6,L.inputW-14,1,s.inputText?'#2A1B12':'#7A6953');
    s.hitboxes.push({id:'FOCUS_INPUT',left:L.inputLeft,top:L.inputTop,w:L.inputW,h:L.inputH,enabled:true});
    for(var k=0;k<L.buttons.length;k++){var b=L.buttons[k],enabled=b.id!=='CONFIRM_ISSUE'||(valid.valid&&!s.pending);U.button(o,'f96_card_b'+k,s.pending&&b.id==='CONFIRM_ISSUE'?'발급 중…':b.label,v.w/2+b.left,v.h/2+b.top,b.w,b.h,enabled,b.id==='CONFIRM_ISSUE',s.hoveredBtn===b.id);documentCenteredV10(o,'f96_card_b'+k+'_label',s.pending&&b.id==='CONFIRM_ISSUE'?'발급 중…':b.label,v.w/2+b.left+4,v.h/2+b.top+(b.h-10)/2,b.w-8,1,enabled?'#FFF0CF':'#B9AC91');s.hitboxes.push({id:b.id,left:b.left,top:b.top,w:b.w,h:b.h,enabled:enabled});}
  }else {o.f96_card_seal=U.rect(x+w-76,y+h-100,44,44,null,'f_rank_days:textures/gui/guild_wax_seal.png');documentCenteredV10(o,'f96_card_hint','제국 통합 길드 공인 · 닫기 [ESC]',x+20,y+h-18,w-40,1,'#6B4B2D');}
  s.documentLayout={x:x,y:y,w:w,h:h,headerTop:blueTop,headerBottom:blueBottom,nameTop:nameY,bodyTop:bodyTop,bodyBottom:bodyBottom,bodyWidth:w-42,scale:scale,lineH:lineH,page:s.page,pages:pp.length};
  U.paint('card96',o);
}
function setGuildCardPageV96(page){var s=frankClientUiState;s.page=Math.max(0,Math.min((s.pageCount||1)-1,Number(page)||0));renderGuildCardClientV82();return s.page;}
function renderNewspaperV96(s){
  var U=F96UI,v=U.viewport(),w=Math.min(540,v.w-24),h=Math.min(380,v.h-24),x=(v.w-w)/2,y=(v.h-h)/2,o={};
  o.f96_news_scrim=U.rect(0,0,v.w,v.h,'#B50A0806');o.f96_news_paper=U.rect(x,y,w,h,null,'f_rank_days:textures/gui/npc_dialog/speech_panel.png');
  documentCenteredV10(o,'f96_news_title',s.title,x+20,y+15,w-40,1.12,'#352314',true);
  documentCenteredV10(o,'f96_news_sub','아르베른 제국 · 브리온 지부 공식 소식지',x+20,y+32,w-40,1,'#775938');
  o.f96_news_rule=U.rect(x+20,y+46,w-40,1,'#A18451');
  var scale=1,lineH=13,all=[],sections=[{title:'브리온 소식',values:s.publicArticles||[]},{title:'나의 전달 통지',values:s.personalNotices||[]}];
  for(var a=0;a<sections.length;a++){all.push({text:sections[a].title,heading:true});var arr=sections[a].values;if(!arr.length)arr=[a===0?'오늘 등록된 소식이 없습니다.':'새로운 개인 통지가 없습니다.'];for(var j=0;j<arr.length;j++){var value=String(arr[j]||''),wrapped=U.wrap(value,w-44,scale);for(var q=0;q<wrapped.length;q++)all.push({text:wrapped[q],heading:false});all.push({text:'',heading:false});}}
  var pp=U.pages(all,Math.floor((h-93)/lineH));s.page=Math.max(0,Math.min(pp.length-1,Number(s.page||0)));s.pageCount=pp.length;
  for(var i=0;i<pp[s.page].length;i++){var line=pp[s.page][i];o['f96_news_line_'+i]=U.text(line.text,x+22,y+56+i*lineH,scale,line.heading?'#78451F':'#302014',line.heading);}
  s.hitboxes=[U.button(o,'f96_news_prev','이전',x+20,y+h-27,54,17,s.page>0,false,false),U.button(o,'f96_news_next','다음',x+w-74,y+h-27,54,17,s.page+1<pp.length,false,false),U.button(o,'f96_news_close','접기 [ESC]',x+w/2-45,y+h-27,90,17,true,false,false)];
  for(var bi=0;bi<s.hitboxes.length;bi++){var nb=s.hitboxes[bi],nl=bi===0?'이전':bi===1?'다음':'접기 [ESC]';documentCenteredV10(o,nb.id+'_label',nl,nb.x+4,nb.y+(nb.h-10)/2,nb.w-8,1,nb.enabled?'#FFF0CF':'#B9AC91');}
  documentCenteredV10(o,'f96_news_pagenum',(s.page+1)+' / '+pp.length,x+80,y+h-40,w-160,1,'#775938');
  s.documentLayout={x:x,y:y,w:w,h:h,bodyTop:y+56,bodyBottom:y+h-37,bodyWidth:w-44,scale:scale,lineH:lineH,page:s.page,pages:pp.length};
  U.paint('news96',o);
}
function setNewspaperPageV96(page){var s=frankNewspaperUi;s.page=Math.max(0,Math.min((s.pageCount||1)-1,Number(page)||0));renderNewspaperModalV82();return s.page;}
function handleNewspaperClickV96(x,y){var boxes=frankNewspaperUi.hitboxes||[];for(var i=0;i<boxes.length;i++){var b=boxes[i];if(!b.enabled||!F96UI.contains(b,x,y))continue;if(b.id==='f96_news_prev')setNewspaperPageV96(frankNewspaperUi.page-1);else if(b.id==='f96_news_next')setNewspaperPageV96(frankNewspaperUi.page+1);else closeNewspaperModalV82();return;}}
F96UI.onResize(function(){if(typeof frankClientUiState!=='undefined'&&frankClientUiState.open)renderGuildCardClientV82();if(typeof frankNewspaperUi!=='undefined'&&frankNewspaperUi.open)renderNewspaperModalV82();});
ClientEvents.tick(function(){
  if(typeof frankClientUiState==='undefined'||!frankClientUiState.open||frankClientUiState.mode==='INPUT')return;
  try{var g=Java.loadClass('org.lwjgl.glfw.GLFW'),down=g.glfwGetMouseButton(Client.window.window,0)===1;if(down&&!frankClientUiState.wasLeftDown&&!F96UI.pointerBlocked()){var m=F96UI.pointer(),v=F96UI.viewport();for(var i=0;i<frankClientUiState.hitboxes.length;i++){var b=frankClientUiState.hitboxes[i];if(b.enabled&&m.x-v.w/2>=b.left&&m.x-v.w/2<=b.left+b.w&&m.y-v.h/2>=b.top&&m.y-v.h/2<=b.top+b.h)setGuildCardPageV96(frankClientUiState.page+(b.id==='CARD_NEXT'?1:-1));}}frankClientUiState.wasLeftDown=down;}catch(e){}
});
global.FCraftDocumentsV96={cardPage:setGuildCardPageV96,newspaperPage:setNewspaperPageV96,renderCard:renderGuildCardV96,renderNewspaper:renderNewspaperV96};
