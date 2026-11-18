'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),code=fs.readFileSync(path.join(root,'수정파일/kubejs/client_scripts/08_boss_cinematic_hud_bridge.js'),'utf8');
const checks=[];function check(name,fn){fn();checks.push({name,passed:true});}
function harness(native=false,rhinoCharacterCode=false,travelTitles=false){
 const paintings=[],objects=new Map(),calls=[],handlers={},storage={remove:id=>objects.delete(id)},client={execute:r=>r.run(),player:{uuid:'p1',paint(p){paintings.push(p);for(const [id,v]of Object.entries(p)){if(v.remove)objects.delete(id);else objects.set(id,{...v,parent:storage});}}},level:{dimension:'minecraft:overworld'},screen:null,window:{guiScaledWidth:480,guiScaledHeight:270}};
 function Compound(){}function Runnable(methods){return methods;}
 const helper={beginIntro(...a){calls.push(['begin',...a]);return true;},resetBar(...a){calls.push(['reset',...a]);},tick(){calls.push(['tick']);},clear(){calls.push(['clear']);}};
 const manager={dimensionTitleRenderer:{titleTimer:100,clearTimer(){this.titleTimer=0;calls.push(['dimension-yield']);}},biomeTitleRenderer:{titleTimer:100,clearTimer(){this.titleTimer=0;calls.push(['biome-yield']);}}};
 const box={module:{exports:{}},global:{},Client:client,Platform:{isLoaded:id=>native&&id==='vitral_bossintros'},NetworkEvents:{dataReceived(id,fn){handlers[id]=fn;}},ClientEvents:{tick(fn){handlers.tick=fn;},loggedOut(fn){handlers.logout=fn;}},Java:{loadClass(n){if(n.includes('NativeBossPresentation'))return helper;if(n.endsWith('.RaidCameraShake'))return{begin(...a){calls.push(['camera',...a]);return true;},clear(){calls.push(['camera-clear']);}};if(n.endsWith('.Painter'))return {INSTANCE:{getObject:id=>objects.get(id)||null,paint(){}}};if(n==='java.lang.Runnable')return Runnable;if(n==='net.minecraft.nbt.CompoundTag')return Compound;if(n.endsWith('.TravelersTitlesCommon')&&travelTitles)return{titleManager:manager};throw Error('unexpected native class '+n);}}};
 vm.createContext(box);if(rhinoCharacterCode)vm.runInContext('String.prototype.charCodeAt=function(i){return this.charAt(i);};',box);vm.runInContext(code,box);return {box,api:box.module.exports,client,paintings,objects,calls,handlers,manager};
}
check('native intros own title and victory while one early letterbox spans the entrance',()=>{
 const h=harness();for(const id of ['vitral_bossintros','boss_intros','bossintros'])assert.equal(h.api.nativeIntros({isLoaded:n=>n===id}),true);assert.equal(h.api.nativeIntros({isLoaded:()=>false}),false);
 for(const action of ['intro','victory']){const n=harness(true);n.handlers['f_rank_days:boss_cinematic_cue']({data:{action,boss_id:'krag',encounter_id:'one',boss_bar_id:'uuid',title:'크래그'}});n.handlers.tick();assert.equal(n.api.state.cue===null,action==='victory');if(action==='intro'){assert.equal(n.api.state.cue.nativeOnly,true);assert(!n.objects.has('fcraft_boss_cinema_title'));}else assert.equal(n.objects.size,0);assert.equal(n.calls.some(r=>r[0]==='begin'),action==='intro');}
});
check('fallback slides to24px, ends exactly at50 ticks, does not create an HP bar',()=>{
 const h=harness();h.api.receiveCue({action:'intro',encounter_id:'a',title:'크래그',subtitle:'고대 이끼 수호자'},h.client.player,false);
 assert.equal(h.api.layout(h.api.state.cue,8,480,270).bar,24);for(let i=0;i<49;i++)h.handlers.tick();assert(h.objects.size>0);h.handlers.tick();assert.equal(h.api.state.cue,null);assert.equal(h.objects.size,0);
 assert(!/bossbar\s|ServerBossEvent|boss_.*hp.*\s*=/.test(code.replace(/^\/\/.*$/mg,'')));
});
check('heartbeat yields regional header per player and expires safely without reset',()=>{
 const h=harness();h.api.receiveState({active:true,encounter_id:'a',expires_ticks:40},h.client.player);assert.equal(h.box.global.fcraftBossRaidHudV101.active,true);assert.equal(h.box.global.fcraftBossRaidHudV101.player,'p1');for(let i=0;i<39;i++)h.handlers.tick();assert.equal(h.api.state.active,true);h.handlers.tick();assert.equal(h.api.state.active,false);
 h.api.receiveState({active:true,encounter_id:'a',expires_ticks:5000},h.client.player);assert.equal(h.api.state.expires-h.api.state.tick,100);h.api.receiveState({active:false,encounter_id:'unrelated'},h.client.player);assert.equal(h.api.state.active,true);h.api.receiveState({active:false,encounter_id:'a'},h.client.player);assert.equal(h.api.state.active,false);
});
check('logout, player replacement, world unload and main menu clear state and own painter IDs',()=>{
 const h=harness();h.api.receiveCue({action:'intro',title:'크래그',encounter_id:'a'},h.client.player,false);h.api.receiveState({active:true,encounter_id:'a'},h.client.player);h.handlers.tick();assert(h.objects.size>0);h.client.level=null;h.handlers.tick();assert.equal(h.objects.size,0);assert.equal(h.api.state.active,false);h.client.level={};h.api.receiveState({active:true},h.client.player);h.client.player={uuid:'p2',paint(){}};h.handlers.tick();assert.equal(h.api.state.active,false);h.handlers.logout();assert.equal(h.api.state.cue,null);
 const none=harness();none.client.player=null;none.client.level=null;for(let i=0;i<200;i++)none.handlers.tick();assert.equal(none.paintings.length,0);assert(!/keyPressed|keyReleased|mouseClicked|InputEvents/.test(code));
});
check('open card/NPC/newspaper GUI remains clear and cinematic resumes within remaining time',()=>{
 const h=harness();h.api.receiveCue({action:'intro',title:'크래그'},h.client.player,false);h.client.screen={name:'npc'};for(let i=0;i<10;i++)h.handlers.tick();assert.equal(h.objects.size,0);h.client.screen=null;h.handlers.tick();assert(h.objects.size>0);
});
check('phase2 packet cannot restart intro; a duplicate intro cue cannot restart its timer',()=>{
 const h=harness();h.api.receiveCue({action:'intro',title:'크래그',encounter_id:'a'},h.client.player,false);const cue=h.api.state.cue;h.handlers.tick();h.api.receiveCue({action:'phase2',title:'각성',encounter_id:'a'},h.client.player,false);assert.equal(h.api.state.cue,cue);h.api.receiveCue({action:'intro',title:'크래그',encounter_id:'a'},h.client.player,false);assert.equal(h.api.state.cue,cue);
});
check('victory has one banner, fades for20 final ticks, then removes every own object',()=>{
 const h=harness();h.api.receiveCue({action:'victory',title:'강철 수호자',encounter_id:'a'},h.client.player,false);const cue=h.api.state.cue;assert.equal(h.api.layout(cue,20,480,270).alpha,'ff');assert.equal(h.api.layout(cue,50,480,270).alpha,'80');h.handlers.tick();assert.equal(h.objects.has('fcraft_boss_cinema_victory'),true);assert.equal(h.objects.has('fcraft_boss_cinema_top'),false);for(let i=1;i<60;i++)h.handlers.tick();assert.equal(h.objects.size,0);
});
check('narrow windows and long Korean text stay within measured bounds',()=>{
 const h=harness(),title='고대 결전병기 강철 수호자🛡 '.repeat(20);for(const sw of [32,80,120,240,480,1920]){const l=h.api.layout({action:'intro',title,subtitle:title,start:0,duration:50},20,sw,270);assert(h.api.measure(l.title.text)*l.title.scale<=sw-20+.001);assert(h.api.measure(l.subtitle.text)*l.subtitle.scale<=sw-20+.001);assert(l.bar>=0&&l.bar<=24);assert.equal(l.center,sw/2);}assert(!h.api.fit(title,40,1).text.endsWith('\uD83D'));
});
check('reset cue primes native progress before clearing the pending cinematic',()=>{
 const h=harness(true);h.api.receiveState({active:true,encounter_id:'a'},h.client.player);h.api.receiveCue({action:'reset',encounter_id:'a',boss_id:'wrought',boss_bar_id:'bar-a'},h.client.player,true);const names=h.calls.map(c=>c[0]);assert.equal(names[0],'reset');assert(names.includes('clear'));assert.equal(h.api.state.active,false);
});
check('regional header changes only its boss blocker against the exact v10.4 source',()=>{
 const old=fs.readFileSync(path.join(root,'../F-Craft_7차_1장3보스_수호자무구/수정파일/kubejs/client_scripts/04_fcraft_landmark_titles.js'),'utf8').replace(/\r\n/g,'\n'),now=fs.readFileSync(path.join(root,'수정파일/kubejs/client_scripts/04_fcraft_landmark_titles.js'),'utf8').replace(/\r\n/g,'\n');
 const from=old.split('\n').find(l=>l.includes('var bossBlocked=')),to=now.split('\n').find(l=>l.includes('var bossBlocked='));
 assert(from&&to&&to.includes('global.FCraftBossUiBlockedV105?global.FCraftBossUiBlockedV105()'));assert.equal(now.replace(to,from),old);
});
check('native Rhino character-valued charCodeAt cannot break Korean width or surrogate clipping',()=>{const h=harness(false,true);assert.equal(h.api.measure('브리온'),30);h.api.receiveCue({action:'intro',encounter_id:'rhino',title:'🛡'.repeat(100),subtitle:'세르딘 숲'},h.client.player,false);assert.equal(Array.from(h.api.state.cue.title).length,96);assert(!h.api.state.cue.title.endsWith('\uD83D'));const fit=h.api.fit('강철 수호자'.repeat(30),80,1.15);assert(h.api.measure(fit.text)*fit.scale<=80);});
check('Travelers Titles yield only during this player active raid and remain functional outside',()=>{const h=harness(true,false,true),m=h.manager;h.handlers.tick();assert.equal(m.dimensionTitleRenderer.titleTimer,100);assert.equal(m.biomeTitleRenderer.titleTimer,100);h.api.receiveState({active:true,encounter_id:'own',expires_ticks:10},h.client.player);assert.equal(m.dimensionTitleRenderer.titleTimer,0);assert.equal(m.biomeTitleRenderer.titleTimer,0);m.dimensionTitleRenderer.titleTimer=m.biomeTitleRenderer.titleTimer=70;h.client.player={uuid:'another',paint(){}};h.handlers.tick();assert.equal(h.api.state.active,false);assert.equal(m.dimensionTitleRenderer.titleTimer,70);assert.equal(m.biomeTitleRenderer.titleTimer,70);h.client.player={uuid:'p1',paint(){}};h.api.receiveState({active:true,encounter_id:'own',expires_ticks:10},h.client.player);for(let i=0;i<10;i++)h.handlers.tick();m.dimensionTitleRenderer.titleTimer=m.biomeTitleRenderer.titleTimer=60;h.handlers.tick();assert.equal(m.dimensionTitleRenderer.titleTimer,60);assert.equal(m.biomeTitleRenderer.titleTimer,60);assert(!/\.enabled\s*=|\.recentEntries\s*=/.test(code));});
const result={passed:true,actualMinecraft:false,javaExecuted:false,checks};fs.writeFileSync(path.join(root,'검증/client_raid_hud_tests.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,actualMinecraft:false}));

module.exports={harness};
