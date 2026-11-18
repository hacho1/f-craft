// Exercises production raid handlers through explicit runtime ports. Native
// movement/animation rendering is verified separately by the Forge/client runs.
const assert=require('node:assert/strict');
const {harness}=require('./raid_engine_runtime.cjs');
let passed=0;
function test(name,fn){fn();passed++;}
function encounter(id='krag'){
 const h=harness(),api=h.F.CHAPTER1_RAID_V101,r=api.site(id),p=h.player('v105',r),spec=api.specs[id];
 if(spec.firstKey)p.items[spec.firstKey[0]]=1;
 assert(h.summon(p,id).ok);if(id==='wrought')h.advance(26);const s=api.scenes()[id],e=h.entities.get(s.uuid);
 return{h,api,p,s,e};
}
for(const id of ['krag','blossom','wrought']){
 test(id+' never disables native AI and removes intro speed modifier',()=>{
  const {h,s,e}=encounter(id);assert.equal(e.noAi,false);assert.equal(e.frozen,true);
  h.advance(82);assert.equal(s.status,'ACTIVE');assert.equal(e.noAi,false);assert.equal(e.frozen,false);
  assert.equal(e.speed,id==='krag'?.31:id==='wrought'?.27:.24);
  assert(h.calls.some(c=>c[0]==='pursue'&&c[1]===e.uuid));
 });
 test(id+' melee dispatches actual animation and one server damage shape',()=>{
  const {h,api,p,s,e}=encounter(id);h.advance(82);s.telegraphs=[];s.motion=null;
  s.meleeSerial=0;h.calls.length=0;p.setPosition(e.x+2,e.y,e.z);assert(api.startMeleePatternV105(h.server,e,s,p,h.tick));
  assert(h.calls.some(c=>c[0]==='animation'&&c[1]===e.uuid));assert.equal(s.telegraphs.length,1);
  if(id==='blossom')assert.equal(h.calls.filter(c=>c[0]==='fangs').length,6);
 });
 test(id+' safe ranged burst has bounded destination and appropriate cooldown',()=>{
  const {h,api,p,s,e}=encounter(id);h.advance(82);s.motion=null;const r=api.site(id);r.floorY=s.center.y-1;r.flatRadius=api.specs[id].radius;h.server.getLevel(s.center.dimension).getBlock=(x,y,z)=>({id:y<r.center.y?'minecraft:stone':'minecraft:air',blockState:{isAir:()=>y>=r.center.y}});p.setPosition(s.center.x+10,s.center.y,s.center.z);
  assert(api.startPursuitBurstV105(h.server,e,s,p,h.tick));
  assert.equal(s.motion.kind,id==='krag'?'leap':id==='blossom'?'burrow':'charge');
  assert.equal(s.nextBurst-h.tick,id==='blossom'?120:110);
  assert(Math.hypot(s.motion.destX-s.center.x,s.motion.destZ-s.center.z)<=api.specs[id].radius-4);
 });
}
test('pursuit selects nearest living participant relative to moving boss',()=>{
 const {h,api,p,s,e}=encounter();h.advance(82);const q=h.player('near-boss',api.site('krag'));
 s.participants[q.uuid]=true;e.setPosition(s.center.x+8,s.center.y,s.center.z);
 p.setPosition(s.center.x,s.center.y,s.center.z);q.setPosition(e.x+1,e.y,e.z);
 s.motion=null;s.parryCue=null;s.nextBurst=1e9;s.nextMelee=1e9;s.lastPursuitTick=undefined;
 api.tickActiveBossPursuitAndMeleeV10_5(h.server,e,s,h.tick);assert.equal(e.target,q);
});
test('parry cue delivers 950ms/630ms contract with red then gold and expires',()=>{
 const {h,api,p,s,e}=encounter('wrought');h.advance(82);s.motion=null;s.combo=null;s.telegraphs=[];
 s.nextMelee=s.nextBurst=s.nextPrimary=s.nextParry=1e9;p.setPosition(e.x+2,e.y,e.z);
 api.startParryableBossStrike(h.server,e,s);const start=h.calls.find(c=>c[0]==='packet'&&c[1].endsWith('boss_parry_telegraph')&&c[2].action==='start');
 assert(start);assert.equal(start[2].windup_ms,950);assert.equal(start[2].sweet_start_ms,630);
 assert.equal(e.glow,'red');assert.equal(s.parryCue.due-s.parryCue.started,19);
 h.advance(13);assert.equal(e.glow,'gold');h.advance(7);assert.equal(s.parryCue,null);assert.equal(e.glow,'');
});
test('successful parry clears other attacks and exposes solo Wrought for 6 seconds',()=>{
 const {h,api,p,s,e}=encounter('wrought');h.advance(82);s.motion=null;s.combo=null;s.telegraphs=[];
 s.nextMelee=s.nextBurst=s.nextPrimary=s.nextParry=1e9;p.setPosition(e.x+2,e.y,e.z);
 api.startParryableBossStrike(h.server,e,s);p.cs={parry_start_ms:Date.now()-10,parry_until_ms:Date.now()+1000,stats:{parry_success:0}};
 h.advance(19);assert.equal(s.groggyUntil-h.tick,120);assert.equal(e.frozen,true);assert.equal(e.noAi,false);
 assert.equal(s.telegraphs.length,0);assert.equal(s.parryCue,null);assert.equal(h.F.loadPlayerState(p).mana_v98.mp,25);
 assert(h.calls.some(c=>c[0]==='packet'&&c[1].endsWith('boss_parry_telegraph')&&c[2].action==='success'));
 h.advance(120);assert.equal(e.frozen,false);
});
test('reset cleans glow, burrow invisibility, pending gauge and speed modifier',()=>{
 const {h,api,p,s,e}=encounter('blossom');h.advance(82);s.motion=null;s.combo=null;s.telegraphs=[];
 p.setPosition(e.x+2,e.y,e.z);api.startParryableBossStrike(h.server,e,s);
 e.setInvisible(true);s.motion={kind:'burrow'};api.reset(h.server,s,'cleanup-test');
 assert.equal(e.invisible,false);assert.equal(e.glow,'');assert.equal(e.frozen,false);assert.equal(s.motion,null);assert.equal(s.parryCue,null);
});
test('short bossbar name does not repeat cinematic epithet',()=>{
 const {h,e}=encounter('wrought');assert(e.name.includes('강철 수호자'));assert(!e.name.includes('각성한 고대 결전병기'));
});
for(const [serial,mode,contacts,duration] of [[1,'double',[27,49],73],[2,'triple',[27,49,84],119]]){
 test('Wrought '+mode+' preserves native segments and matching impact times',()=>{
  const {h,api,p,s,e}=encounter('wrought');h.advance(82);s.motion=null;s.combo=null;s.telegraphs=[];
  s.nextBurst=s.nextPrimary=s.nextParry=1e9;s.meleeSerial=serial;p.setPosition(e.x+2,e.y,e.z);h.calls.length=0;
  const start=h.tick;api.startMeleePatternV105(h.server,e,s,p,start);
  assert.equal(s.combo.mode,mode);assert.equal(s.nextMelee-start,duration);
  assert.deepEqual(Array.from(s.telegraphs,a=>a.due-start),contacts);
  h.advance(36);assert.equal(h.calls.filter(c=>c[0]==='animation'&&c[2]==='melee_twice').length,0);
  h.advance(1);assert.equal(h.calls.filter(c=>c[0]==='animation'&&c[2]==='melee_twice').length,1);
  if(mode==='triple'){h.advance(23);assert.equal(h.calls.filter(c=>c[0]==='animation'&&c[2]==='melee_thrice').length,1);}
  assert(s.combo&&s.combo.until===start+duration);
 });
}
test('installed Rhino without Math.PI keeps all melee/rotation coordinates finite',()=>{
 const h=harness({missingPi:true}),api=h.F.CHAPTER1_RAID_V101;
 for(const id of ['krag','blossom','wrought']){
  const r=api.site(id),p=h.player('rhino-'+id,r),sp=api.specs[id];if(sp.firstKey)p.items[sp.firstKey[0]]=1;
  assert(h.summon(p,id).ok);h.advance(82);const s=api.scenes()[id],e=h.entities.get(s.uuid);s.combo=null;s.motion=null;s.telegraphs=[];s.nextPrimary=s.nextParry=s.nextMelee=s.nextBurst=1e9;
  p.setPosition(e.x+2,e.y,e.z);api.startMeleePatternV105(h.server,e,s,p,h.tick);h.advance(12);
  for(const a of s.telegraphs)assert([a.x,a.y,a.z,a.radius,a.angle||0,a.arc||0].every(Number.isFinite));
  api.reset(h.server,s,'rhino-fixture-cleanup');p.x+=1000;
 }
});
test('burrow follows changed live player coordinates during its underground trail',()=>{
 const {h,api,p,s,e}=encounter('blossom');h.advance(82);s.motion=null;s.combo=null;s.telegraphs=[];s.nextPrimary=s.nextParry=s.nextMelee=s.nextBurst=1e9;
 const r=api.site('blossom');r.floorY=s.center.y-1;r.flatRadius=22;h.server.getLevel(s.center.dimension).getBlock=(x,y,z)=>({id:y<s.center.y?'minecraft:stone':'minecraft:air',blockState:{isAir:()=>y>=s.center.y}});
 p.setPosition(s.center.x+10,s.center.y,s.center.z);assert(api.startPursuitBurstV105(h.server,e,s,p,h.tick));h.advance(14);assert(s.motion.destX>s.center.x);
 p.setPosition(s.center.x-10,s.center.y,s.center.z);h.advance(8);assert(s.motion.destX<s.center.x);h.advance(5);assert.equal(s.motion,null);assert(e.x<s.center.x);
 assert(h.calls.some(c=>c[0]==='command'&&c[1].includes('particle minecraft:block minecraft:moss_block')));
});
test('opposite-edge charge allows enough travel and refuses out-of-reach melee',()=>{
 const {h,api,p,s,e}=encounter('wrought');h.advance(82);s.motion=null;s.combo=null;s.telegraphs=[];s.nextPrimary=s.nextParry=s.nextMelee=s.nextBurst=1e9;
 const r=api.site('wrought');r.floorY=s.center.y-1;r.flatRadius=22;h.server.getLevel(s.center.dimension).getBlock=(x,y,z)=>({id:y<s.center.y?'minecraft:stone':'minecraft:air',blockState:{isAir:()=>y>=s.center.y}});
 e.setPosition(s.center.x-16,s.center.y,s.center.z);p.setPosition(s.center.x+19,s.center.y,s.center.z);h.calls.length=0;
 assert(api.startPursuitBurstV105(h.server,e,s,p,h.tick));const duration=s.motion.until-h.tick;assert(duration>=32);assert(duration<=44);
 h.advance(duration);assert.equal(s.motion,null);assert(!h.calls.some(c=>c[0]==='animation'&&/^melee/.test(c[2])));
});
test('ordinary hurt invulnerability permits R while a real Combat Roll still blocks it',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const ctx={global:{FRankDays:{}},Java:{loadClass(name){assert.equal(name,'fcraft.raid.RaidBridge');return{isCombatRollIframe:p=>!!p.rolling}}},Platform:{isLoaded:name=>name==='combatroll'},Date,Math,JSON};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../수정파일/kubejs/server_scripts/13_combat_parry_and_dodge_v8.js'),'utf8'),ctx);
 const F=ctx.global.FRankDays,p={uuid:'normal-hurt',invulnerableTime:20,rolling:false};F._mockClockMs=10000;
 const pressed=F.triggerPlayerParryV8(p,{});assert.equal(pressed.ok,true);assert.equal(pressed.parry_active_window_ms,320);
 F._mockClockMs=12000;p.rolling=true;assert.equal(F.triggerPlayerParryV8(p,{}).reason,'blocked_during_native_roll_iframe');
});
test('v10.5 release metadata names the actual matching native bridge and script owners',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),base=path.join(__dirname,'../수정파일');
 const meta=JSON.parse(fs.readFileSync(path.join(base,'modpack_manifest_1.20.1_forge.json'),'utf8')).phase8;
 assert.equal(meta.packageVersion,'10.5');const jar=fs.readFileSync(path.join(base,'mods',meta.nativeBridge.file));
 assert.equal(meta.nativeBridge.sha256,crypto.createHash('sha256').update(jar).digest('hex'));assert.equal(meta.nativeBridge.bytes,jar.length);
 for(const file of meta.changedScriptOwners)assert(fs.existsSync(path.join(base,file)));
 assert.equal(meta.parry.windowMs,320);assert.equal(meta.verificationEvidence.selfCertifiesExecution,false);
});
console.log(JSON.stringify({suite:'active_boss_ai_v105',passed,actualMinecraft:false}));
