'use strict';
// Reuse the existing complete portal ports; execute the unmodified production
// tick and registered death/respawn callbacks, never a copy of the rescue branch.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const file=path.join(__dirname,'guardian_portal_runtime.cjs'),source=fs.readFileSync(file,'utf8');
const box={module:{exports:{}},require:createRequire(file),__dirname,console:{log(){}},structuredClone};
vm.runInNewContext(source+'\n;module.exports={harness};',box,{filename:file});
const harness=box.module.exports.harness,checks=[];
function test(name,fn){fn();checks.push({name,passed:true});}
function entered(){const h=harness(),p=h.player('fallen','a');assert(h.activate(p).ok);h.arch(p);assert(h.api.enter(p).ok);return{h,p};}
test('dead actor below void threshold remains dead and stationary while awaiting respawn',()=>{const{h,p}=entered();p.y=67;p.health=0;const sigils=p.sigils;h.events.death.forEach(fn=>fn({entity:p,server:h.server}));h.advance(1);assert.equal(p.health,0);assert.equal(p.y,67);assert.equal(p.level.dimension,'f_rank_days:guardian_sanctum');assert.equal(p.sigils,sigils);assert(h.api.records().deaths[p.uuid]);});
test('living actor at oneHP is rescued without death or item loss',()=>{const{h,p}=entered();p.y=67;p.health=1;const sigils=p.sigils;h.advance(1);assert.equal(p.health,1);assert.equal(p.y,81);assert.equal(p.sigils,sigils);assert.equal(h.api.records().deaths[p.uuid],undefined);});
test('actual registered respawn callback keeps the pending death then returns to the west gate',()=>{const{h,p}=entered();p.y=67;p.health=0;h.events.death.forEach(fn=>fn({entity:p,server:h.server}));h.advance(1);assert.equal(p.health,0);p.health=20;h.events.respawned.forEach(fn=>fn({player:p,server:h.server}));h.advance(5);assert.equal(p.level.dimension,'minecraft:overworld');assert.equal(p.x,-311.5);assert.equal(p.y,117);assert.equal(p.z,-1875.5);assert.equal(h.api.records().deaths[p.uuid],undefined);});
console.log(JSON.stringify({suite:'portal_v105_runtime',passed:checks.length,checks,actualMinecraft:false}));
