'use strict';
// Uses the production state machine through its explicit Node runtime ports.
// The test fixture integrates nominal falling velocity; real collisions are native95's job.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./raid_engine_runtime.cjs');
const checks=[];
function test(name,fn){fn();checks.push({name,passed:true});}
function start(id){const h=harness(),api=h.F.CHAPTER1_RAID_V101,r=api.site(id),p=h.player('entry-'+id,r),sp=api.specs[id];if(sp.firstKey)p.items[sp.firstKey[0]]=sp.firstKey[1];const result=h.summon(p,id);assert(result.ok);return{h,api,p,s:api.scenes()[id],result};}
for(const [id,duration,titleAt]of [['krag',40,21],['blossom',44,23],['wrought',70,46]]){
 test(id+' has authored duration and one Korean bar revealed at the title stage',()=>{
  const {h,api,p,s,result}=start(id);assert.equal(result.introTicks,duration);assert.equal(s.introUntil-s.started,duration);
  assert.equal(h.calls.filter(c=>c[0]==='addBar').length,0);
  if(id==='wrought'){assert.equal(h.entities.has(s.uuid),false);h.advance(24);assert.equal(h.entities.has(s.uuid),false);assert(h.F.shouldCancelChapter1RaidDamageV101({entity:p,source:{},damage:4}));h.advance(1);assert.equal(h.entities.get(s.uuid).y,118);assert.equal(s.actualSpawnTick-s.started,25);}
  else h.advance(1);
  h.advance(s.started+titleAt-1-h.tick);assert.equal(h.calls.filter(c=>c[0]==='addBar').length,0);
  h.advance(1);const adds=h.calls.filter(c=>c[0]==='addBar'&&c[1]===p.uuid);assert.equal(adds.length,1);assert(adds[0][3].includes(api.specs[id].name));
  const cue=h.calls.find(c=>c[0]==='packet'&&c[1].endsWith('boss_cinematic_cue')&&c[2].action==='intro');assert(cue);assert.equal(cue[2].duration_ticks,duration);assert.equal(cue[2].title_delay_ticks,titleAt);assert.equal(cue[2].native_title_duration_ticks,duration-titleAt);
  h.advance(s.introUntil-h.tick);assert.equal(s.status,'ACTIVE');assert.equal(h.entities.get(s.uuid).frozen,false);assert.equal(h.entities.get(s.uuid).noAi,false);
  assert.equal(h.calls.filter(c=>c[0]==='packet'&&c[1].endsWith('boss_cinematic_cue')&&c[2].action==='intro_end').length,1);
 });
}
test('Wrought physically descends, emits one visual-only impact and one camera packet per player',()=>{
 const {h,s,p}=start('wrought');h.advance(26);const boss=h.entities.get(s.uuid);assert(boss.y>110);assert.equal(boss.noAi,false);assert(h.F.shouldCancelChapter1RaidDamageV101({entity:boss,source:{actual:p},damage:100}));
 h.advance(42);assert.equal(boss.y,81);assert.equal(s.introImpactCount,1);assert(s.introImpactTick>25&&s.introImpactTick<70);assert.equal(boss.health,s.maxHP);
 const shakes=h.calls.filter(c=>c[0]==='packet'&&c[1]==='f_rank_days:boss_camera_shake');assert.equal(shakes.length,1);assert.equal(shakes[0][2].duration_ms,550);assert.equal(shakes[0][2].amplitude_deg,2.8);
 const bolts=Array.from(h.entities.values()).filter(e=>e.type==='minecraft:lightning_bolt');assert.equal(bolts.length,1);assert.equal(bolts[0].visualOnly,true);h.advance(8);assert.equal(s.introImpactCount,1);
});
test('reset before a deferred spawn never creates an orphan or issues a landing',()=>{
 const {h,api,s}=start('wrought');h.advance(10);api.reset(h.server,s,'prelude_cancel');h.advance(80);assert.equal(s.status,'IDLE');assert.equal(h.entities.has(s.uuid),false);assert.equal(h.calls.filter(c=>c[0]==='packet'&&c[1].endsWith('boss_camera_shake')).length,0);
});
test('Blossom begins underground, rises to its surveyed floor, and emits four cosmetic entrance fangs',()=>{
 const {h,s}=start('blossom'),e=h.entities.get(s.uuid);assert.equal(e.y,s.spawn.y-2);h.advance(23);assert(e.y<s.spawn.y);h.advance(22);assert.equal(e.y,s.spawn.y);assert.equal(h.calls.filter(c=>c[0]==='fangs').length,4);assert.equal(e.noAi,false);
});
const report={passed:true,actualMinecraft:false,checks};fs.writeFileSync(path.join(__dirname,'../검증/boss_entrances_v106.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,actualMinecraft:false}));
