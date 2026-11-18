'use strict';
// Coverage follows what each process actually loads. This is the sole allowed
// cross-snapshot exception; it is never a blanket exemption for client files.
const CLIENT_ONLY_PATH='kubejs/client_scripts/08_boss_cinematic_hud_bridge.js';
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function hashMap(value){return object(value)&&Object.keys(value).length>0&&Object.entries(value).every(([name,digest])=>typeof name==='string'&&name.length>0&&typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest));}
function empty(value){return Array.isArray(value)&&value.length===0;}
function allPassed(value){return Array.isArray(value)&&value.length>0&&value.every(row=>object(row)&&row.passed===true);}
function nativeProof(report){
 const failures=[];function ck(name,passed){if(!passed)failures.push(name);}
 ck('actual successful dedicated Forge process',object(report)&&report.passed===true&&report.actualMinecraft===true&&report.serverReady===true&&report.physicalInputUsed===false&&report.exitCode===0&&report.timedOut===false&&!report.controllerError);
 ck('successful native probe and every native assertion',object(report)&&object(report.probe)&&report.probe.passed===true&&allPassed(report.probe.checks)&&empty(report.probe.errors));
 ck('zero native script errors',object(report)&&empty(report.scriptErrors));
 ck('executed immutable candidate and helper mirrors retained',object(report)&&report.executedMirrorUnchangedAfterRun===true&&report.helperMirrorUnchangedAfterRun===true);
 ck('native candidate hash map present',object(report)&&hashMap(report.codeHashes));
 return{passed:failures.length===0,failures};
}
function clientProof(report){
 const failures=[];function ck(name,passed){if(!passed)failures.push(name);}
 ck('actual successful connected client process',object(report)&&report.passed===true&&report.actualMinecraft===true&&report.actualClient===true&&report.connectedClient===true&&report.physicalInputUsed===false&&report.exitCode===0&&report.timedOut===false&&!report.runnerError&&!report.controllerError);
 ck('every connected-client assertion passed',object(report)&&allPassed(report.checks));
 ck('successful client probe and every probe assertion without errors',object(report)&&object(report.probe)&&report.probe.passed===true&&allPassed(report.probe.checks)&&empty(report.probe.errors));
 ck('zero client script or project resource errors',object(report)&&empty(report.scriptErrors)&&empty(report.projectResourceErrors));
 ck('executed source, live profile and candidate mirrors retained',object(report)&&report.sourceAndLiveAndCandidatesUnchanged===true&&report.factoryAuditPassed===true);
 ck('client candidate hash map present',object(report)&&hashMap(report.candidateHashes));
 return{passed:failures.length===0,failures};
}
function equalKeys(a,b){if(!hashMap(a)||!hashMap(b))return false;const left=Object.keys(a).sort(),right=Object.keys(b).sort();return left.length===right.length&&left.every((name,i)=>name===right[i]);}
function exact(a,b){return equalKeys(a,b)&&Object.keys(a).every(name=>a[name]===b[name]);}
function evaluatePlaneCoverage(current,native,client){
 const nativeExecution=nativeProof(native),clientExecution=clientProof(client),currentValid=hashMap(current),nativeHashes=object(native)&&native.codeHashes,clientHashes=object(client)&&client.candidateHashes;
 const nativeKeysEqual=equalKeys(current,nativeHashes),clientKeysEqual=equalKeys(current,clientHashes),clientExact=exact(current,clientHashes);
 const differences=nativeKeysEqual?Object.keys(current).sort().filter(name=>current[name]!==nativeHashes[name]).map(name=>({path:name,nativeSHA256:nativeHashes[name],currentSHA256:current[name]})):[];
 const unsupportedDifferences=differences.filter(row=>row.path!==CLIENT_ONLY_PATH);
 const connectedClientCurrent=currentValid&&clientExecution.passed&&clientKeysEqual&&clientExact;
 const clientOnlyReuse=differences.filter(row=>row.path===CLIENT_ONLY_PATH).map(row=>({...row,coveredByFinalClient:connectedClientCurrent,reason:'Dedicated Forge never loads this client script; the final successful connected client must cover the exact complete current candidate.'}));
 const dedicatedServerCurrent=currentValid&&nativeExecution.passed&&nativeKeysEqual&&unsupportedDifferences.length===0&&(differences.length===0||connectedClientCurrent);
 const failures=[];
 if(!currentValid)failures.push('current candidate hash map is invalid');
 if(!nativeExecution.passed)failures.push(...nativeExecution.failures);
 if(!clientExecution.passed)failures.push(...clientExecution.failures);
 if(!nativeKeysEqual)failures.push('native/current candidate key set differs; extra or missing files cannot be reused');
 if(!clientKeysEqual)failures.push('client/current candidate key set differs');
 if(clientKeysEqual&&!clientExact)failures.push('final connected client is stale for the current candidate');
 if(unsupportedDifferences.length)failures.push('native snapshot differs outside the sole permitted client08 path');
 if(clientOnlyReuse.length&&!connectedClientCurrent)failures.push('client08 reuse requires successful exact-current connected-client proof');
 return{passed:dedicatedServerCurrent&&connectedClientCurrent,dedicatedServerCurrent,connectedClientCurrent,
  nativeExecution,clientExecution,currentFileCount:currentValid?Object.keys(current).length:0,nativeCandidateKeysEqual:nativeKeysEqual,clientCandidateKeysEqual:clientKeysEqual,
  nativeFullCandidateExact:exact(current,nativeHashes),clientFullCandidateExact:clientExact,
  allowedClientOnlyPath:CLIENT_ONLY_PATH,usedClientOnlyCoverage:clientOnlyReuse.length>0&&dedicatedServerCurrent,
  clientOnlyReuse,unsupportedDifferences,failures};
}
module.exports={CLIENT_ONLY_PATH,evaluatePlaneCoverage};

if(require.main===module){
 const assert=require('node:assert/strict'),checks=[];
 const h=letter=>letter.repeat(64),current={
  [CLIENT_ONLY_PATH]:h('a'),'kubejs/server_scripts/46_engine.js':h('b'),'mods/fcraft-raid-bridge-1.0.0-forge-1.20.1.jar':h('c'),
  'kubejs/startup_scripts/14_registry.js':h('d'),'config/fcraft.json':h('e'),'modpack_manifest_1.20.1_forge.json':h('f'),
  'kubejs/client_scripts/06_inventory.js':h('1')};
 function proofs(){return{native:{passed:true,actualMinecraft:true,serverReady:true,physicalInputUsed:false,exitCode:0,timedOut:false,controllerError:null,probe:{passed:true,checks:[{name:'native',passed:true}],errors:[]},scriptErrors:[],executedMirrorUnchangedAfterRun:true,helperMirrorUnchangedAfterRun:true,codeHashes:{...current}},client:{passed:true,actualMinecraft:true,actualClient:true,connectedClient:true,physicalInputUsed:false,exitCode:0,timedOut:false,runnerError:null,checks:[{name:'client',passed:true}],probe:{passed:true,checks:[{name:'client-probe',passed:true}],errors:[]},scriptErrors:[],projectResourceErrors:[],sourceAndLiveAndCandidatesUnchanged:true,factoryAuditPassed:true,candidateHashes:{...current}}};}
 function test(name,fn){fn();checks.push({name,passed:true});}
 function old08(){const p=proofs();p.native.codeHashes[CLIENT_ONLY_PATH]=h('2');return p;}
 function evaluate(p,map=current){return evaluatePlaneCoverage(map,p.native,p.client);}
 test('exact complete snapshots pass without a reuse exception',()=>{const r=evaluate(proofs());assert(r.passed);assert(r.nativeFullCandidateExact);assert(r.clientFullCandidateExact);assert.equal(r.usedClientOnlyCoverage,false);assert.equal(r.clientOnlyReuse.length,0);});
 test('only same-present client08 revision is covered by successful exact final client',()=>{const r=evaluate(old08());assert(r.passed);assert.equal(r.nativeFullCandidateExact,false);assert.equal(r.usedClientOnlyCoverage,true);assert.deepEqual(r.clientOnlyReuse.map(x=>[x.path,x.nativeSHA256,x.currentSHA256,x.coveredByFinalClient]),[[CLIENT_ONLY_PATH,h('2'),h('a'),true]]);});
 test('stale connected client never covers revised client08',()=>{const p=old08();p.client.candidateHashes[CLIENT_ONLY_PATH]=h('2');const r=evaluate(p);assert.equal(r.passed,false);assert.equal(r.dedicatedServerCurrent,false);assert.equal(r.connectedClientCurrent,false);});
 test('absent native proof is rejected',()=>{const p=proofs();delete p.native;assert.equal(evaluate(p).passed,false);});
 test('absent final connected client proof cannot authorize client08 reuse',()=>{const p=old08();delete p.client;assert.equal(evaluate(p).passed,false);assert.equal(evaluate(p).dedicatedServerCurrent,false);});
 test('client runtime errors reject reuse even if a top-level passed flag is wrong',()=>{const p=old08();p.client.scriptErrors=['Unknown Painter type'];assert.equal(evaluate(p).passed,false);assert.equal(evaluate(p).dedicatedServerCurrent,false);});
 test('changed bridge JAR is never a client-only exception',()=>{const p=old08();p.native.codeHashes['mods/fcraft-raid-bridge-1.0.0-forge-1.20.1.jar']=h('3');assert.equal(evaluate(p).dedicatedServerCurrent,false);});
 test('changed server script is never a client-only exception',()=>{const p=old08();p.native.codeHashes['kubejs/server_scripts/46_engine.js']=h('3');assert.equal(evaluate(p).dedicatedServerCurrent,false);});
 test('startup config and root metadata revisions each require a new native run',()=>{for(const name of ['kubejs/startup_scripts/14_registry.js','config/fcraft.json','modpack_manifest_1.20.1_forge.json']){const p=old08();p.native.codeHashes[name]=h('3');assert.equal(evaluate(p).dedicatedServerCurrent,false,name);}});
 test('any other client file remains outside the narrow exception',()=>{const p=old08();p.native.codeHashes['kubejs/client_scripts/06_inventory.js']=h('3');assert.equal(evaluate(p).dedicatedServerCurrent,false);});
 test('missing native08 path is key-set drift rather than an allowed change',()=>{const p=proofs();delete p.native.codeHashes[CLIENT_ONLY_PATH];const r=evaluate(p);assert.equal(r.passed,false);assert.equal(r.nativeCandidateKeysEqual,false);});
 test('extra current candidate file requires native and client evidence',()=>{const p=proofs(),map={...current,'kubejs/client_scripts/09_extra.js':h('4')};assert.equal(evaluate(p,map).passed,false);});
 test('extra native or missing client path rejects key-set drift',()=>{const p=proofs();p.native.codeHashes['config/extra.json']=h('4');assert.equal(evaluate(p).passed,false);const q=proofs();delete q.client.candidateHashes['config/fcraft.json'];assert.equal(evaluate(q).passed,false);});
 test('failed native process probe scripts or immutable mirrors each reject coverage',()=>{for(const mutate of [p=>p.native.passed=false,p=>p.native.probe.errors.push('error'),p=>p.native.scriptErrors.push('script'),p=>p.native.executedMirrorUnchangedAfterRun=false,p=>p.native.probe.checks[0].passed=false]){const p=proofs();mutate(p);assert.equal(evaluate(p).passed,false);}});
 test('failed client process resources probe or source mirrors each reject coverage',()=>{for(const mutate of [p=>p.client.passed=false,p=>p.client.projectResourceErrors.push('resource'),p=>p.client.probe.errors.push('error'),p=>p.client.probe.checks[0].passed=false,p=>p.client.sourceAndLiveAndCandidatesUnchanged=false,p=>p.client.checks[0].passed=false]){const p=old08();mutate(p);assert.equal(evaluate(p).passed,false);}});
 test('invalid or absent candidate digests cannot pass',()=>{const p=proofs();p.native.codeHashes[CLIENT_ONLY_PATH]='undefined';assert.equal(evaluate(p).passed,false);assert.equal(evaluatePlaneCoverage(null,p.native,p.client).passed,false);});
 test('coverage inspection leaves immutable execution reports untouched',()=>{const p=old08(),before=JSON.stringify(p);evaluate(p);assert.equal(JSON.stringify(p),before);});
 console.log(JSON.stringify({suite:'verification_planes_v105',passed:checks.length,checks,actualMinecraft:false}));
}
