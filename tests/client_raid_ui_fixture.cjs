'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../개별작업/ui_qa/95_ui_server_phase7.js'),'utf8'),start=source.indexOf('function ui7ReplyAfterRegistration('),end=source.indexOf("NetworkEvents.dataReceived(",start);
assert(start>=0&&end>start,'extract actual bounded LAB registration wait');
function simulate(options={}){
 let tick=0,scheduled=0;const replies=[],queue=[],scene={status:'SUMMONING',introUntil:0},boss={uuid:'native-registered-uuid',isAlive:()=>options.dead!==true};
 const box={UI7Server:{raid:'wrought'},ui7Scene:()=>scene,ui7Boss:()=>tick>=(options.registerTick??0)?boss:null,ui7SendReply:(p,d,a,result,error)=>replies.push({action:a,result,error}),String,Number};
 const p={server:{overworld:()=>({getTime:()=>tick}),scheduleInTicks:(delay,fn)=>{assert.equal(delay,1);scheduled++;queue.push(fn);}}};
 function update(){if(tick>=(options.registerTick??0)&&options.neverIntro!==true){scene.status='INTRO';scene.introUntil=tick+50;}if(options.supersedeAt===tick)box.UI7Server.raid='krag';}
 update();vm.createContext(box);vm.runInContext(source.slice(start,end)+';globalThis.waitForRegistration=ui7ReplyAfterRegistration;',box);
 const result={ok:true};box.waitForRegistration(p,{boss_id:'wrought',serial:1},result);
 while(queue.length){tick++;update();queue.shift()();assert(tick<30,'LAB wait remains bounded');}
 return{tick,scheduled,replies,result};
}
const checks=[];function ck(name,test){assert(test,name);checks.push({name,passed:true});}
let r=simulate();ck('registered real INTRO replies immediately',r.scheduled===0&&r.replies.length===1&&r.replies[0].error===null&&r.result.registrationWait.nativeEntityPresent===true);
r=simulate({registerTick:5});ck('delayed native registration waits actual five ticks',r.tick===5&&r.scheduled===5&&r.replies.length===1&&r.replies[0].error===null&&r.result.registrationWait.waitedTicks===5);
r=simulate({registerTick:3,neverIntro:true});ck('entity presence without production INTRO cannot pass',r.tick===24&&r.replies.length===1&&/timeout/.test(r.replies[0].error)&&!r.result.registrationWait);
r=simulate({registerTick:30});ck('missing native entity times out at bounded24ticks',r.tick===24&&r.scheduled===24&&r.replies.length===1&&/timeout/.test(r.replies[0].error));
r=simulate({dead:true});ck('dead native entity cannot stand in for actual intro',r.tick===24&&/timeout/.test(r.replies[0].error));
r=simulate({registerTick:5,supersedeAt:2});ck('superseded request cannot report later raid intro',r.tick===2&&r.replies.length===1&&/superseded/.test(r.replies[0].error));
const client=fs.readFileSync(path.join(__dirname,'../개별작업/ui_qa/99_ui_client_phase7.js'),'utf8'),barStart=client.indexOf('function uq7Bars('),barEnd=client.indexOf('function uq7Painter(',barStart);
assert(barStart>=0&&barEnd>barStart,'extract actual native bossbar reader');
function readBars(bars){let calls=0,i=0;const overlay={getClass:()=>({name:'native-overlay'})},box={Client:{gui:{getBossOverlay:()=>{calls++;return overlay;}}},uq7Field:(type,name,value)=>{assert.equal(name,'f_93699_');assert.equal(value,overlay);return{values:()=>({iterator:()=>({hasNext:()=>i<bars.length,next:()=>bars[i++]})})};},String,Number};vm.createContext(box);vm.runInContext(client.slice(barStart,barEnd)+';globalThis.readActualBars=uq7Bars;',box);return{rows:JSON.parse(JSON.stringify(box.readActualBars())),calls};}
let bars=readBars([{getId:()=>'actual-uuid',getName:()=>({getString:()=>'크라그 · 2페이즈'}),getProgress:()=>.49}]);ck('native bar reader uses installed mapped aliases and exact reflected events map',bars.calls===1&&bars.rows.length===1&&bars.rows[0].uuid==='actual-uuid'&&bars.rows[0].title==='크라그 · 2페이즈'&&bars.rows[0].progress===.49);
bars=readBars([]);ck('empty actual bossbar map remains empty',bars.calls===1&&bars.rows.length===0);
const warmStart=client.indexOf('function uq7PrewarmReady('),warmEnd=client.indexOf('function uq7Painter(',warmStart);assert(warmStart>=0&&warmEnd>warmStart);
function prewarm(options={}){let now=0,loadedCalls=0,compiledCalls=0;const box={UIQ7:{},Client:{player:{x:75.5,z:-1318.5},level:{dimension:'minecraft:overworld',hasChunk:()=>{loadedCalls++;return options.missingChunk!==true;}},levelRenderer:{isChunkCompiled:()=>{compiledCalls++;return options.uncompiled!==true;}}},uq7Reply:()=>({result:{target:{dimension:'minecraft:overworld',x:75.5,z:-1318.5,floorY:160}}}),uq7Class:()=>'world',uq7Card:()=>options.oldCard?{letterbox:false}:null,uq7Bars:()=>[],uq7Toasts:()=>({empty:options.toastActive!==true}),Java:{loadClass:()=>function Pos(x,y,z){Object.assign(this,{x,y,z});}},Date:{now:()=>now},Math,Number,isFinite,String};vm.createContext(box);vm.runInContext(client.slice(warmStart,warmEnd)+';globalThis.warm=uq7PrewarmReady;',box);let ready=false;for(let i=0;i<16;i++){now=i*100;ready=box.warm();}return{ready,loadedCalls,compiledCalls,state:box.UIQ7.prewarm};}
let warm=prewarm();ck('terrain prewarm requires actual received chunks and compiled sections over stable frames',warm.ready&&warm.loadedCalls===16*9&&warm.compiledCalls===16*5&&warm.state.last.stableFrames===16);
ck('missing client chunk cannot pass terrain prewarm',!prewarm({missingChunk:true}).ready);
ck('received but uncompiled terrain cannot pass prewarm',!prewarm({uncompiled:true}).ready);
ck('previous native victory card must end naturally before next summon',!prewarm({oldCard:true}).ready);
ck('queued or visible native toast prevents next boss screenshot without clearing it',!prewarm({toastActive:true}).ready);
const slotStart=source.indexOf('function ui7EmptyMainSlots('),slotEnd=source.indexOf('function ui7SendReply(',slotStart);assert(slotStart>=0&&slotEnd>slotStart);
function sourceInsertion(full=false,race=false){const items=Array.from({length:36},(_,i)=>({id:i===8?'f_rank_days:wrought_iron_heart':'loot-'+i,empty:full||i<14?false:true,original:i})),before=items.slice(),writes=[];const p={inventory:{getItem:i=>items[i],setItem:(i,s)=>{writes.push(i);items[i]=s;}}},box={Item:{of:id=>({id,empty:false})},Error};vm.createContext(box);vm.runInContext(source.slice(slotStart,slotEnd)+';globalThis.insert=ui7InsertForgeSource;',box);const F={applyEnhancementDataToStack:(s,lv)=>{s.level=lv;if(race)items[14]={id:'newly-occupied',empty:false};return true;}};let slot,error;try{slot=box.insert(p,F);}catch(e){error=String(e);}return{items,before,writes,slot,error};}
let inserted=sourceInsertion();ck('LAB inheritance sword uses actual empty slot and preserves bound heart and all previous loot',inserted.slot===14&&inserted.items[8]===inserted.before[8]&&inserted.items[14].level===15&&inserted.items.every((s,i)=>i===14||s===inserted.before[i]));
inserted=sourceInsertion(true);ck('full inventory rejects LAB source without overwriting any loot',/no empty/.test(inserted.error)&&inserted.writes.length===0&&inserted.items.every((s,i)=>s===inserted.before[i]));
inserted=sourceInsertion(false,true);ck('source slot occupied during preparation fails without replacing the newly present item',/became occupied/.test(inserted.error)&&inserted.writes.length===0&&inserted.items[14].id==='newly-occupied');
console.log(JSON.stringify({passed:true,checks:checks.length,actualMinecraft:false,note:'Actual LAB helper tested in a Node VM; native entity and ticks are explicit test doubles.'}));
