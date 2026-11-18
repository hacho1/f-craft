'use strict';
// Pure layout/content and server protocol tests. Native Screen rendering is
// deliberately certified only by the separate, real Minecraft QA97 fixture.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
function run(){
 const checks=[];
 function check(name,fn){fn();checks.push(name);}
 const clientSource=fs.readFileSync(path.join(root,'수정파일/kubejs/client_scripts/09_job_promotion_exam_screen.js'),'utf8');
 const noop=()=>{},context={global:{},NetworkEvents:{dataReceived:noop},ClientEvents:{tick:noop,loggedOut:noop},F96UI:{onResize:noop,FONT:'f_rank_days:print',wrap:(s,w,scale=1)=>{let lines=[''];for(const c of String(s)){if(lines.at(-1).length*10*scale+10*scale>w)lines.push('');lines[lines.length-1]+=c;}return lines;}},FRankModalHostV82:{}};
 vm.createContext(context);vm.runInContext(clientSource,context);const gui=context.global.JobPromotionExamScreen;
 const dialogSource=fs.readFileSync(path.join(root,'수정파일/kubejs/client_scripts/01_npc_rpg_dialog_ui.js'),'utf8');vm.runInContext(dialogSource.slice(dialogSource.indexOf('function computeResponsiveDialogLayout('),dialogSource.indexOf('function getClientScaledWindowSize(')),context);
 context.F96UI.parse=(v,fallback)=>{try{return v?JSON.parse(String(v)):fallback;}catch{return fallback;}};
 vm.runInContext(dialogSource.slice(dialogSource.indexOf('function normalizeNpcPayloadV96('),dialogSource.indexOf('function setNpcDialogButtonPageV96(')),context);
 check('network byte and boxed boolean role flags normalize from trusted actions without submenu false positives',()=>{const roles=[{id:'talk',action:'ACTION_MENU_TALK'},{id:'buy',action:'ACTION_OPEN_BUY_SHOP'},{id:'sell',action:'ACTION_OPEN_SELL_SHOP'},{id:'quest',action:'ACTION_CHECK_QUESTS'},{id:'promotion_exam',action:'OPEN_PROMOTION_EXAM'}];for(const raw of [true,1,{booleanValue:()=>true,toString:()=> 'true'},false,0,undefined])assert.equal(context.normalizeNpcPayloadV96({role_menu:raw,buttons_json:JSON.stringify(roles)}).role_menu,true);for(const submenu of [[...roles,{id:'sixth',action:'BACK_MAIN'}],...roles.map((_,index)=>roles.map((x,i)=>i===index?{id:'guardian',action:'GUARDIAN_SOURCE_V102'}:x)),roles.slice(0,4)])assert.equal(context.normalizeNpcPayloadV96({role_menu:true,buttons_json:JSON.stringify(submenu)}).role_menu,false);});
 check('five top roles retain separate header, portrait metadata and pageable speech bounds',()=>{for(const [w,h]of [[960,540],[640,360],[480,270],[320,240]]){const l=context.computeResponsiveDialogLayout(w,h,5,0,0,true);assert.equal(l.buttonsBoxes.length,5);for(let i=0;i<5;i++){let b=l.buttonsBoxes[i];assert(b.x>=l.panelLeft&&b.x+b.w<=l.panelLeft+l.panelW);assert(b.y+b.h<l.headerY);if(i)assert(l.buttonsBoxes[i-1].x+l.buttonsBoxes[i-1].w<b.x);}assert(l.portraitTop+l.portraitH+6<=l.metadataY);assert(l.speechTextY+(l.maxSpeechLines-1)*12+10<=l.pagePrevBox.y);}});
 check('320×204 panel and controls stay inside GUI scale 2/3/4 viewports',()=>{
  for(const [w,h]of [[960,540],[640,360],[480,270],[320,240]]){const l=gui.layout(w,h);assert(l.x>=0&&l.y>=0&&l.x+l.panelW<=w&&l.y+l.panelH<=h);assert.equal(l.panelH,204);if(w>=336)assert.equal(l.panelW,320);assert(l.listY+l.listH<=l.pagerY);assert(l.pagerY+13<=l.rewardY-3);assert(l.rewardY+l.rewardH<=l.actionY);assert(l.actionY+l.actionH<=l.y+l.panelH-8);}
 });
 check('long objective text is wrapped without losing progress or any characters',()=>{
  const objective={label:'아주 긴 실기 목표와 한글 안내를 전부 보존하는 항목'.repeat(4),current:6,target:10,done:false};const rows=gui.checklistRows({objectives:[objective]},150);assert(rows.length>4);assert.equal(rows.map(r=>r.text).join(''),'[진행] '+objective.label+'  6 / 10');
 });
 check('status maps to free start, navigation or authoritative claim only',()=>{for(const [status,id]of [['available','start'],['active','navigate'],['ready','claim']])assert.equal(gui.actionFor({status}).id,id);for(const status of ['unregistered','chapter_locked','complete'])assert.equal(gui.actionFor({status}).enabled,false);});
 const serverSource=fs.readFileSync(path.join(root,'수정파일/kubejs/server_scripts/10_npc_rpg_dialog_server.js'),'utf8');
 const marker=serverSource.indexOf('// v10.6: independent promotion Screen protocol.');assert(marker>=0);
 const packets=[],calls=[];let near=true,nextGrade='E';
 const jobs=[{id:'blacksmith',label:'대장장이',grade:'F'},{id:'berserker',label:'도끼전사',grade:'F'},{id:'prospector',label:'광부',grade:'F'}];
 const F={verifyPlayerNearNpc:()=>({ok:near,reason:near?'':'too_far'}),closeNpcRpgDialog:()=>{calls.push('close_dialog');},getPromotionExamViewV106:(p,n,j)=>({ok:true,npcId:n,registeredMentorJobs:jobs,selectedJob:jobs.some(x=>x.id===j)?j:'blacksmith',nextGrade:nextGrade,status:j==='prospector'?'ready':'active'}),handlePromotionExamActionV106:(p,n,a,j,g)=>{calls.push([n,a,j,g]);if(a==='claim')nextGrade='D';return{ok:true,message:'서버 검증 완료'};}};
 const server={global:{FRankDays:F}};vm.createContext(server);vm.runInContext(serverSource.slice(marker),server);
 const p={uuid:'test-player',sendData:(name,data)=>packets.push({name,data})};
 check('forged promotion packet requires an existing NPC screen session',()=>{assert.equal(F.handlePromotionExamPacketV106(p,{npc_id:'nau',action:'claim',job_id:'blacksmith'}).reason,'promotion_screen_not_active');assert.equal(calls.length,0);});
 check('opening closes the ordinary dialog before the dedicated screen packet',()=>{assert(F.openPromotionExamScreenV106(p,'nau').ok);assert.equal(calls[0],'close_dialog');assert.equal(packets.at(-1).name,'f_rank_days:open_promotion_exam_ui');});
 check('session rejects another NPC and an unregistered tab',()=>{assert.equal(F.handlePromotionExamPacketV106(p,{npc_id:'ski',action:'claim',job_id:'blacksmith'}).ok,false);assert.equal(F.handlePromotionExamPacketV106(p,{npc_id:'nau',action:'claim',job_id:'swordsman'}).reason,'job_not_offered');assert.equal(calls.length,1);});
 check('registered multi-job tab selection is read-only and server refreshed',()=>{assert(F.handlePromotionExamPacketV106(p,{npc_id:'nau',action:'select',job_id:'berserker'}).ok);assert.equal(calls.length,1);assert.equal(JSON.parse(packets.at(-1).data.view_json).selectedJob,'berserker');});
 check('claim passes only server NPC/action/job/expected grade and ignores minted rewards',()=>{F.handlePromotionExamPacketV106(p,{npc_id:'nau',action:'select',job_id:'blacksmith'});assert(F.handlePromotionExamPacketV106(p,{npc_id:'nau',action:'claim',job_id:'blacksmith',expected_grade:'E',grade:'S',reward:99999}).ok);assert.deepEqual(calls.at(-1),['nau','claim','blacksmith','E']);});
 check('duplicate old-grade claim cannot claim the following ready grade',()=>{const n=calls.length;assert.equal(F.handlePromotionExamPacketV106(p,{npc_id:'nau',action:'claim',job_id:'blacksmith',expected_grade:'E'}).reason,'stale_exam_grade');assert.equal(calls.length,n);});
 check('distance change closes the screen before any mutation',()=>{near=false;let n=calls.length;assert.equal(F.handlePromotionExamPacketV106(p,{npc_id:'nau',action:'start',job_id:'blacksmith'}).ok,false);assert.equal(calls.length,n);assert.equal(packets.at(-1).name,'f_rank_days:close_promotion_exam_ui');near=true;});
 check('fifth button highlights eligible mentor and opens the ready registered job',()=>{const b=F.getPromotionDialogButtonV106(p,'nau');assert(b.enabled&&b.promotion_available&&b.promotion_ready);assert.equal(b.sub_id,'prospector');});
 const economy=fs.readFileSync(path.join(root,'수정파일/kubejs/server_scripts/27_npc_four_button_economy_v96.js'),'utf8');
 check('daily request builder contains no promotion or archived exam action',()=>{const q=economy.slice(economy.indexOf('function questMenu('),economy.indexOf('F.handleNpcDialogAction=function'));assert(!/V96_JOB_EXAM|OPEN_PROMOTION_EXAM|legacy_records|V98_LEGACY_EXAM_RECORD/.test(q));});
 return{passed:true,scope:'Pure geometry/content + actual protocol function tests; native rendering excluded',checks};
}
module.exports={run};if(require.main===module)console.log(JSON.stringify(run(),null,2));
