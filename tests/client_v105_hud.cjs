'use strict';
// Executes shipping scripts with explicit client/Painter test doubles. No game-render claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'수정파일/kubejs/client_scripts'),checks=[];
function check(name,fn){fn();checks.push({name,passed:true});}
function harness(withFoldouts=false,nativeIntros=false,missingRhinoPi=false,deferredPainter=false,sourceOverride=null){
 let now=1000,bars=false,effects=[];
 const objects=new Map(),paintings=[],sends=[],cleared=[],ticks=[],packets={},logout=[],keys={},queue=[],painterErrors=[],nativeRemovals=[];
 let invalidations=0;
 function enqueue(fn){if(deferredPainter)queue.push(fn);else fn();}
 const storage={remove(id){nativeRemovals.push(id);objects.delete(id);}};
 function applyPaint(payload){for(const [id,o]of Object.entries(payload)){const old=objects.get(id);if(old){if(o.remove)storage.remove(id);else Object.assign(old,o);}else if(!o.type)painterErrors.push('Unknown Painter type: ');else objects.set(id,{...o,parent:storage});}}
 const painter={getObject:id=>objects.get(id)||null,paint(tag){const data=JSON.parse(JSON.stringify(tag.values||{}));enqueue(()=>{invalidations++;applyPaint(data);});}};
 function Compound(){this.values={};this.put=(k,v)=>this.values[k]=v.values||v;this.putBoolean=(k,v)=>this.values[k]=v;}
 function Runnable(methods){return methods;}
 function key(){return{clicks:0,consumeClick(){if(!this.clicks)return false;this.clicks--;return true;}};}
 for(const name of ['wallet','newspaper','skillX','skillC','codex'])keys[name]=key();
 const overlay={events:{isEmpty:()=>!bars},getClass:()=>({getDeclaredField:n=>{assert.equal(n,'f_93699_');return{setAccessible(){},get:o=>o.events};}})};
 const client={execute:r=>enqueue(()=>r.run()),player:{uuid:'p1',health:20,sendData:(id,d)=>sends.push([id,d]),paint(p){const data=JSON.parse(JSON.stringify(p));paintings.push(data);enqueue(()=>applyPaint(data));},isSpectator:()=>false,isCreative:()=>false,getActiveEffects:()=>({iterator(){let i=0;return{hasNext:()=>i<effects.length,next:()=>effects[i++]};}})},level:{dimension:'minecraft:overworld'},gui:{getBossOverlay:()=>overlay},options:{hideGui:false},window:{guiScaledWidth:480,guiScaledHeight:270,window:1},screen:null};
 const F96UI={clear:id=>cleared.push(id),onResize(){},isOpen:()=>false,viewport:()=>({w:480,h:270}),pointer:()=>({x:0,y:0}),contains:()=>false,parse:(t,f)=>{try{return JSON.parse(t);}catch{return f;}},paint:(id,o)=>paintings.push({group:id,objects:o}),rect:(x,y,w,h,color)=>({type:'rectangle',x,y,w,h,color}),line(){},centered(){},measure:s=>String(s).length*7,pages:x=>[x],wrap:s=>[s],button:()=>({}),glyphs:s=>Array.from(s)};
 const box={global:{FCraftKeysV96:keys,FCraftCompendiumKeyV5:keys.codex},module:{exports:{}},Date:{now:()=>now},Client:client,F96UI,fcraftHudV96:{wallet_copper:0},fcraftProgressionV96:{open:false},frankClientUiState:{open:false},frankNpcDialogClient:{open:false},frankNewspaperUi:{open:false},FRankModalHostV82:{openNonChatModal(){}},closeNewspaperModalV82(){box.frankNewspaperUi.open=false;},clearNewspaperPaintV82(){},Platform:{isLoaded:id=>nativeIntros&&id==='vitral_bossintros'},NetworkEvents:{dataReceived(id,fn){(packets[id]??=[]).push(fn);}},ClientEvents:{tick:fn=>ticks.push(fn),loggedOut:fn=>logout.push(fn),paintScreen(){}},Java:{loadClass(n){if(n.endsWith('.Painter'))return{INSTANCE:painter};if(n==='java.lang.Runnable')return Runnable;if(n==='net.minecraft.nbt.CompoundTag')return Compound;if(n==='org.lwjgl.glfw.GLFW')return{glfwGetKey:()=>0,glfwGetMouseButton:()=>0};throw Error('Explicit absent optional Java class '+n);}}};
 if(missingRhinoPi){box.Math=Object.create(Math);Object.defineProperty(box.Math,'PI',{value:undefined});}
 vm.createContext(box);
 if(withFoldouts)for(const file of ['06_fcraft_inventory_hud_v96.js','07_adventurer_compendium_book_ui.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),box,{filename:file});
 vm.runInContext(sourceOverride||fs.readFileSync(path.join(base,'08_boss_cinematic_hud_bridge.js'),'utf8'),box);
 return{box,api:box.module.exports,client,keys,objects,paintings,sends,cleared,packets,painterErrors,nativeRemovals,invalidations:()=>invalidations,flush(){let count=0;while(queue.length){assert(++count<2000,'bounded native execution queue');queue.shift()();}},now:n=>now=n,bars:v=>bars=v,effects:v=>effects=v,tick(){now+=50;for(const fn of ticks)fn();},packet(id,data){for(const fn of packets[id]||[])fn({data});}};
}
check('950ms strike owns exact 104x10 crosshair geometry and 68/36 red-gold split',()=>{
 const h=harness();h.api.receiveParry({action:'start',encounter_id:'e'},h.client.player,1000);const cue=h.api.parry.cue,l=h.api.layoutParry(cue,1000,480,270);
 assert.deepEqual(JSON.parse(JSON.stringify({x:l.x,y:l.y,w:l.w,h:l.h,sweetX:l.sweetX})),{x:188,y:157,w:104,h:10,sweetX:68});
 assert.equal(h.api.layoutParry(cue,1629,480,270).sweet,false);assert.equal(h.api.layoutParry(cue,1630,480,270).sweet,true);assert.equal(h.api.layoutParry(cue,1949,480,270).sweet,true);assert.equal(h.api.layoutParry(cue,1950,480,270),null);
 for(const width of [64,80,320,480,1920]){const s=h.api.layoutParry(cue,1630,width,270);assert(s.x>=0&&s.x+s.w<=width);}
});
check('real packet handler paints gold prompt, narrowing brackets and white cursor',()=>{
 const h=harness();h.packet('f_rank_days:boss_parry_telegraph',{action:'start',encounter_id:'e',windup_ms:950,sweet_start_ms:630,sweet_end_ms:950});
 const first=h.objects.get('fcraft_parry_left').x;h.now(1630);h.api.renderParry(h.client,1630);assert(h.objects.get('fcraft_parry_left').x>first);assert.equal(h.objects.get('fcraft_parry_edge').color,'#FFFFF176');assert.equal(h.objects.get('fcraft_parry_cursor').color,'#FFFFFFFF');assert.equal(JSON.parse(h.objects.get('fcraft_parry_label').text).text,'지금 [R] 패링!');
 h.now(1950);h.api.renderParry(h.client,1950);assert.equal(h.objects.size,0);
});
check('server success popup, stale encounter clear rejection and bounded lifetime',()=>{
 const h=harness();h.api.receiveParry({action:'start',encounter_id:'e'},h.client.player,1000);h.api.receiveParry({action:'success',encounter_id:'wrong'},h.client.player,1500);assert.equal(h.api.parry.cue.action,'start');
 h.now(1700);h.api.receiveParry({action:'success',encounter_id:'e'},h.client.player,1700);assert.equal(JSON.parse(h.objects.get('fcraft_parry_success').text).text,'PARRY! 약점 개방! (+25 MP)');assert.equal(h.objects.has('fcraft_parry_track'),false);assert(h.objects.has('fcraft_parry_shard_7'));
 h.api.receiveParry({action:'clear',encounter_id:'wrong'},h.client.player,1750);assert(h.api.parry.cue);h.api.renderParry(h.client,2750);assert.equal(h.api.parry.cue,null);assert.equal(h.objects.size,0);
});
check('installed Rhino absent Math.PI still gives every success shard finite geometry',()=>{
 const h=harness(false,false,true);assert.equal(h.box.Math.PI,undefined);h.api.receiveParry({action:'start',encounter_id:'rhino'},h.client.player,1000);h.now(1700);h.api.receiveParry({action:'success',encounter_id:'rhino'},h.client.player,1700);
 for(const now of [1700,1850,2400]){h.api.renderParry(h.client,now);for(let i=0;i<8;i++){const shard=h.objects.get('fcraft_parry_shard_'+i);assert(shard);for(const key of ['x','y','w','h'])assert(Number.isFinite(shard[key]),key+' must stay finite without Math.PI');}}
});
check('deferred build26 fixture reproduces duplicate remove-only missing-type failure',()=>{
 const h=harness(false,false,false,true);h.client.player.paint({owned:{type:'rectangle',x:0,y:0,w:1,h:1}});h.flush();h.client.player.paint({owned:{remove:true}});h.client.player.paint({owned:{remove:true}});h.flush();assert.deepEqual(h.painterErrors,['Unknown Painter type: ']);
});
check('queued clear then success removes each old ID once and updates stable shapes in place',()=>{
 const h=harness(false,false,false,true);h.api.receiveParry({action:'start',encounter_id:'race'},h.client.player,1000);h.flush();const edge=h.objects.get('fcraft_parry_edge');assert.equal(h.objects.size,12);h.api.renderParry(h.client,1650);h.flush();assert.equal(h.objects.get('fcraft_parry_edge'),edge);
 h.api.receiveParry({action:'clear',encounter_id:'race'},h.client.player,1700);h.api.receiveParry({action:'success',encounter_id:'race'},h.client.player,1700);h.api.renderParry(h.client,1800);h.flush();assert.equal(h.objects.size,9);assert(h.objects.has('fcraft_parry_success'));assert(!h.objects.has('fcraft_parry_track'));assert.equal(h.nativeRemovals.length,12);assert.equal(h.invalidations(),1);assert.deepEqual(h.painterErrors,[]);
 h.api.receiveParry({action:'clear',encounter_id:'race'},h.client.player,1900);h.api.receiveParry({action:'clear',encounter_id:'race'},h.client.player,1900);h.api.clear();h.flush();assert.equal(h.objects.size,0);assert.equal(h.nativeRemovals.length,21);assert.deepEqual(h.painterErrors,[]);
});
check('queued initial render superseded before execution cannot leave stale gauge or foreign IDs',()=>{
 const h=harness(false,false,false,true);h.client.player.paint({foreign_hud:{type:'rectangle',x:1,y:1,w:1,h:1}});h.api.receiveParry({action:'start',encounter_id:'queued'},h.client.player,1000);h.api.receiveParry({action:'clear',encounter_id:'queued'},h.client.player,1100);h.api.receiveParry({action:'success',encounter_id:'queued'},h.client.player,1100);h.flush();assert.equal(h.objects.size,10);assert(h.objects.has('foreign_hud'));assert(!h.objects.has('fcraft_parry_track'));
 h.api.clear();h.api.clear();h.flush();assert.equal(h.objects.size,1);assert(h.objects.has('foreign_hud'));assert.deepEqual(h.painterErrors,[]);assert(h.paintings.every(p=>Object.values(p).every(o=>o.type&&!o.remove)));
});
check('cinematic fallback shares idempotent queue cleanup without cancelling the parry plane',()=>{
 const h=harness(false,false,false,true);h.api.receiveCue({action:'intro',encounter_id:'movie',title:'크래그'},h.client.player,false);h.api.tick(h.client);h.api.receiveParry({action:'start',encounter_id:'movie'},h.client.player,1000);h.flush();assert(h.objects.has('fcraft_boss_cinema_top'));assert(h.objects.has('fcraft_parry_track'));
 h.api.receiveParry({action:'clear',encounter_id:'movie'},h.client.player,1200);h.api.receiveParry({action:'clear',encounter_id:'movie'},h.client.player,1200);h.flush();assert(h.objects.has('fcraft_boss_cinema_top'));assert(!h.objects.has('fcraft_parry_track'));
 h.api.clear();h.api.clear();h.flush();assert.equal(h.objects.size,0);assert.deepEqual(h.painterErrors,[]);
});
check('queued cleanup preserves every reviewed05 rectangle and label property at all three GUI scales',()=>{
 const reviewed=fs.readFileSync(path.join(root,'../F-Craft_8차_보스추격_패링HUD_v10_5/검증/native_inputs/active_v105_05/수정파일/kubejs/client_scripts/08_boss_cinematic_hud_bridge.js'),'utf8');
 function pixels(h){return JSON.stringify(Array.from(h.objects.entries()).map(([id,o])=>[id,Object.fromEntries(Object.entries(o).filter(([k])=>k!=='parent').sort(([a],[b])=>a.localeCompare(b)))]).sort(([a],[b])=>a.localeCompare(b)));}
 for(const [w,height]of [[960,540],[640,360],[480,270]]){const current=harness(),old=harness(false,false,false,false,reviewed);for(const h of [current,old]){h.client.window.guiScaledWidth=w;h.client.window.guiScaledHeight=height;h.api.receiveParry({action:'start',encounter_id:'pixels'},h.client.player,1000);}
  for(const t of [1000,1500,1630,1949]){current.api.renderParry(current.client,t);old.api.renderParry(old.client,t);assert.equal(pixels(current),pixels(old));}
  for(const h of [current,old]){h.now(2000);h.api.receiveParry({action:'success',encounter_id:'pixels'},h.client.player,2000);}
  for(const t of [2000,2150,2700]){current.api.renderParry(current.client,t);old.api.renderParry(old.client,t);assert.equal(pixels(current),pixels(old));}
 }
});
check('native cinematic integration never suppresses parry; GUI hides it without restarting',()=>{
 const h=harness(false,true);h.api.receiveParry({action:'start',encounter_id:'e'},h.client.player,1000);h.client.screen={};h.api.renderParry(h.client,1200);assert.equal(h.objects.size,0);h.client.screen=null;h.api.renderParry(h.client,1630);assert.equal(h.api.parry.lastLayout.age,630);assert(h.objects.has('fcraft_parry_track'));
 h.client.player.uuid='p2';h.api.tick(h.client);assert.equal(h.objects.size,0);assert.equal(h.api.parry.cue,null);
});
check('three independent combat signals block UI and restore exactly when all end',()=>{
 const h=harness();assert.equal(h.api.bossUiBlocked(h.client),false);h.bars(true);assert.equal(h.api.bossUiBlocked(h.client),true);h.bars(false);h.client.level.dimension='f_rank_days:guardian_sanctum';assert.equal(h.api.bossUiBlocked(h.client),true);h.client.level.dimension='minecraft:overworld';
 h.api.receiveState({active:true,encounter_id:'e',expires_ticks:10},h.client.player);assert.equal(h.api.bossUiBlocked(h.client),true);for(let i=0;i<10;i++)h.api.tick(h.client);assert.equal(h.api.bossUiBlocked(h.client),false);h.bars(true);h.api.clear();assert.equal(h.api.bossUiBlocked(h.client),true);h.client.level=null;assert.equal(h.api.bossUiBlocked(h.client),false);
});
check('combat closes dropdowns, drains G N J, preserves X and rejects late UI replies',()=>{
 const h=harness(true);h.box.fcraftFoldoutV98.active='wallet';h.bars(true);h.keys.wallet.clicks=h.keys.newspaper.clicks=h.keys.codex.clicks=h.keys.skillX.clicks=1;h.tick();
 assert.equal(h.box.fcraftFoldoutV98.active,'');assert.equal(h.box.fcraftFoldoutV98.boxes.length,0);assert(h.cleared.includes('foldout98'));assert.equal(h.keys.wallet.clicks+h.keys.newspaper.clicks+h.keys.codex.clicks,0);assert(h.sends.some(([id,d])=>id==='f_rank_days:cast_mana_skill'&&d.slot==='X'));assert(!h.sends.some(([id])=>/request_open_wallet|request_open_newspaper/.test(id)));
 assert.equal(h.box.global.FCraftFoldoutV98.toggle('news'),false);assert.equal(h.box.global.FCraftCompendiumClient.toggle(),false);h.box.global.FCraftFoldoutV98.receiveWallet({balance_json:'{"wallet_copper":123}',history_json:'[]'});h.box.global.FCraftFoldoutV98.receiveNewspaper({title:'Late',public_articles:[],personal_notices:[]});assert.equal(h.box.fcraftFoldoutV98.active,'');assert.equal(h.box.fcraftFoldoutV98.balance.wallet_copper,123);
 h.bars(false);assert.equal(h.box.global.FCraftFoldoutV98.toggle('wallet'),true);assert.equal(h.box.fcraftFoldoutV98.active,'wallet');
});
check('potion rows move icons vertically to y34/58 while right edge stays fixed',()=>{
 const h=harness(true),layout=h.box.global.FCraftFoldoutV98.layout;
 const a=layout(480,270,0),b=layout(480,270,1),c=layout(480,270,2);assert.equal(a.coin.y,6);assert.equal(b.coin.y,34);assert.equal(c.coin.y,58);assert.equal(a.coin.x,b.coin.x);assert.equal(b.coin.x,c.coin.x);assert.equal(c.shift,0);
 function effect(good){return{showIcon:()=>true,getEffect:()=>({isBeneficial:()=>good})};}h.effects([effect(true),effect(true)]);assert.equal(h.box.foldoutPotionRowsV105(),1);h.effects([effect(true),effect(false)]);assert.equal(h.box.foldoutPotionRowsV105(),2);
});
check('region banner uses shared blocker and server window keeps 80ms compensation',()=>{
 const landmark=fs.readFileSync(path.join(base,'04_fcraft_landmark_titles.js'),'utf8'),combat=fs.readFileSync(path.join(root,'수정파일/kubejs/server_scripts/13_combat_parry_and_dodge_v8.js'),'utf8');
 assert(landmark.includes('global.FCraftBossUiBlockedV105?global.FCraftBossUiBlockedV105()'));assert(/parry_window_ms:\s*320/.test(combat));assert(/max_latency_compensation_ms:\s*80/.test(combat));assert(combat.includes('windupMs - global.FRankDays.COMBAT_V8_CONFIG.parry_window_ms'));
});
const result={passed:true,actualMinecraft:false,javaExecuted:false,checks};fs.mkdirSync(path.join(root,'검증'),{recursive:true});fs.writeFileSync(path.join(root,'검증/client_v105_hud_tests.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,actualMinecraft:false}));
