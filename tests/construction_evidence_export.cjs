'use strict';
// Construction evidence has a narrower claim than the final combat/client run.
// The latter must still match every current candidate byte in the v10.2 gate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const SCOPE='zero_unplanned_construction_changes_after_matched_control';
const RAID_CONFIG='kubejs/config/fcraft_chapter1_raids_v101.json';
const BRIDGE='mods/fcraft-raid-bridge-1.0.0-forge-1.20.1.jar',BRIDGE_NAME=path.posix.basename(BRIDGE);
const REQUIRED=[
 'kubejs/server_scripts/48_serdin_three_boss_arenas_builder_v10_3.js',
 'kubejs/server_scripts/50_guardian_sanctum_builder_v10_4.js',
 'kubejs/config/fcraft_arena_construction_v103.json',
 'kubejs/config/fcraft_guardian_sanctum_v104.json',
 'kubejs/config/fcraft_guardian_portal_v104.json',
 'kubejs/startup_scripts/14_register_chapter1_boss_altars_and_gear.js',
 'kubejs/data/f_rank_days/dimension/guardian_sanctum.json',
 'kubejs/data/f_rank_days/dimension_type/guardian_sanctum.json',
 'mods/fcraft-raid-bridge-1.0.0-forge-1.20.1.jar'
];
function stable(v){if(Array.isArray(v))return'['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function inventory(dir){const out={};function walk(base,rel){for(const e of fs.readdirSync(base,{withFileTypes:true})){const key=rel?rel+'/'+e.name:e.name,full=path.join(base,e.name);if(e.isDirectory())walk(full,key);else if(e.isFile())out[key]=hash(full);}}walk(dir,'');return out;}
function dependencyPaths(hashes,config){return[...new Set(REQUIRED.concat(config&&config.preimage&&config.preimage.file||[],Object.keys(hashes||{}).filter(k=>k.startsWith('mods/')||k.startsWith('kubejs/startup_scripts/')||/^kubejs\/data\/[^/]+\/(?:dimension|dimension_type)\//.test(k))))].sort();}
function raidConstructionProjection(input){const value=JSON.parse(JSON.stringify(input));for(const row of value.arenas||[]){if(row.spawn)for(const key of ['x','y','z','yaw','pitch'])delete row.spawn[key];if(typeof row.spawnVerification==='string')delete row.spawnVerification;}return value;}
let astParser=null;
function localAstParser(){
 if(astParser)return astParser;
 try{astParser=require('acorn');}catch(unavailableExternalPackage){
  // Reuse the parser shipped with this installed Node; never download/evaluate
  // workspace-supplied parser text. Missing bundled parser fails closed.
  const key='internal/deps/acorn/acorn/dist/acorn',source=process.binding('natives')[key];if(typeof source!=='string')throw Error('Local Node-bundled Acorn parser unavailable');
  const exports={},module={exports};vm.runInNewContext(source,{exports,module},{filename:'installed-node-bundled-acorn.js',timeout:3000});astParser=module.exports;
 }
 if(!astParser||typeof astParser.parse!=='function')throw Error('Local AST parser has no parse API');return astParser;
}
function functionSlice(source,name){
 const parser=localAstParser(),ast=parser.parse(source,{ecmaVersion:'latest',sourceType:'script'}),matches=[];
 function visit(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id&&node.id.name===name)matches.push(node);for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)visit(child);}else if(value&&typeof value==='object')visit(value);}
 visit(ast);if(matches.length!==1)throw Error('Expected exactly one audited native raid declaration '+name+', found '+matches.length);const node=matches[0];return source.slice(node.start,node.end).trim();
}
function bridgeMetadataTransition(proof,construction,final,current){return !!(proof&&proof.validatedByReadOnlyVerifier===true&&proof.passed===true&&proof.readOnly===true&&proof.actualMinecraft===false&&proof.allOriginalEntryBytesIdentical===true&&stable(proof.addedEntries)===stable(['pack.mcmeta'])&&stable(proof.removedEntries)===stable([])&&stable(proof.changedExistingEntries)===stable([])&&proof.oldJar&&proof.newJar&&proof.oldJar.sha256===construction[BRIDGE]&&proof.newJar.sha256===final[BRIDGE]&&proof.newJar.sha256===current[BRIDGE]&&proof.oldJar.sha256!==proof.newJar.sha256);}
function verifyBridgeMetadataReceipt(file,deps,candidateRoot){
 const checks=[];function ck(name,value,detail){checks.push({name,passed:!!value,detail});}let proof=null,receiptSHA256=null;
 try{
  receiptSHA256=hash(file);proof=read(file);const tool=path.resolve(candidateRoot,'../tools/verify_bridge_packmeta_only_v104.py'),old=path.join(deps.immutableCandidateSource,BRIDGE),current=path.join(candidateRoot,BRIDGE);
  ck('bridge metadata receipt names exact original and current bridge JAR paths',proof.oldJar&&proof.newJar&&fs.realpathSync(proof.oldJar.file)===fs.realpathSync(old)&&fs.realpathSync(proof.newJar.file)===fs.realpathSync(current));
  ck('bridge metadata old and new SHA256 match actual JAR files and original construction',proof.oldJar&&proof.newJar&&hash(old)===proof.oldJar.sha256&&hash(current)===proof.newJar.sha256&&proof.oldJar.sha256===deps.codeHashes[BRIDGE]&&proof.oldJar.sha256===deps.modHashes[BRIDGE_NAME]);
  const native=proof.constructionNative;
  ck('bridge metadata proof bound to unchanged original native result',native&&path.resolve(native.file)===path.resolve(deps.nativeResultFile)&&native.sha256===deps.nativeResultSHA256&&hash(native.file)===native.sha256&&native.bridgeCodeHash===deps.codeHashes[BRIDGE]&&native.bridgeModHash===deps.modHashes[BRIDGE_NAME]);
  const toolSHA=hash(tool);ck('read-only bridge verifier matches receipt tool bytes',proof.tool&&path.resolve(proof.tool.file)===tool&&proof.tool.sha256===toolSHA);
  const rerun=cp.spawnSync('python',[tool,'--check-receipt',path.resolve(file)],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024});let value=null;try{value=JSON.parse(String(rerun.stdout||'').trim());}catch(ignored){}
  ck('bridge pack metadata-only receipt independently reverified from both ZIPs',rerun.status===0&&value&&value.passed===true,{exitCode:rerun.status,result:value,stderr:String(rerun.stderr||'').slice(-1200)});
  ck('bridge receipt and read-only verifier remain unchanged during verification',hash(file)===receiptSHA256&&hash(tool)===toolSHA);
 }catch(e){ck('bridge metadata-only evidence readable and revalidated',false,String(e));}
 return{passed:checks.length>0&&checks.every(r=>r.passed),checks,file:path.resolve(file),sha256:receiptSHA256,proof:proof&&{...proof,validatedByReadOnlyVerifier:checks.length>0&&checks.every(r=>r.passed)}};
}
function dependencyVerdict(input){
 const checks=[];function ck(name,value,detail){checks.push({name,passed:!!value,detail});}
 const a=input.constructionHashes||{},b=input.finalHashes||{},c=input.currentHashes||{},paths=dependencyPaths(c,input.config);
 const bridgeOnly=bridgeMetadataTransition(input.bridgeMetadataProof,a,b,c),oldMods=input.constructionModHashes||{},newMods=input.finalModHashes||{},comparedMods={...oldMods};
 if(bridgeOnly&&oldMods[BRIDGE_NAME]===a[BRIDGE]&&newMods[BRIDGE_NAME]===b[BRIDGE])comparedMods[BRIDGE_NAME]=newMods[BRIDGE_NAME];
 for(const rel of paths)ck('construction dependency bytes '+rel,typeof a[rel]==='string'&&(a[rel]===b[rel]&&a[rel]===c[rel]||rel===BRIDGE&&bridgeOnly),{construction:a[rel]||null,final:b[rel]||null,current:c[rel]||null,metadataOnlyTransition:rel===BRIDGE&&bridgeOnly});
 ck('all installed native runtime and QA mod hashes match construction run except independently verified single bridge pack metadata addition',Object.keys(oldMods).length>0&&stable(comparedMods)===stable(newMods));
 ck('unchanged installed baseline outside candidate matches construction run',typeof input.constructionBaseProfile==='string'&&input.constructionBaseProfile===input.finalBaseProfile);
 ck('final native boot used exact independently verified constructed save',!!input.constructionSavedWorld&&input.constructionSavedWorld===input.finalWorldSource&&input.constructionSavedWorld===input.finalBootWorld,{constructionSaved:input.constructionSavedWorld,finalSource:input.finalWorldSource,finalBoot:input.finalBootWorld});
 ck('raid config construction fields unchanged; only spawn position facing or diagnostic annotation may differ',stable(raidConstructionProjection(input.previousRaidConfig))===stable(raidConstructionProjection(input.currentRaidConfig)));
 for(const name of ['site','constructionReady','ensureAltar']){let same=false,detail;try{const archived=functionSlice(input.previousRaidSource,name),current=functionSlice(input.currentRaidSource,name),digest=value=>crypto.createHash('sha256').update(value).digest('hex');same=archived===current;detail={boundary:'Exact AST FunctionDeclaration start/end',parser:'Acorn '+localAstParser().version,archivedBodySHA256:digest(archived),currentBodySHA256:digest(current)};}catch(e){detail={error:String(e)};}ck('raid construction binding and sole-writer guard '+name,same,detail);}
 const changed=[...new Set(Object.keys(a).concat(Object.keys(c)))].filter(k=>a[k]!==c[k]);
 return{passed:checks.every(r=>r.passed),checks,dependencyPaths:paths,changedCandidatePaths:changed,nonConstructionChanges:changed.filter(k=>!paths.includes(k)),bridgeMetadataOnlyTransition:bridgeOnly?{path:BRIDGE,oldSHA256:a[BRIDGE],newSHA256:c[BRIDGE],addedEntry:'pack.mcmeta',classAndOriginalEntryBytesUnchanged:true}:null,scope:'Only construction geometry, native registry/collision environment, original preimages and exact saved-world handoff are reused. A separately revalidated bridge pack.mcmeta-only addition preserves every original JAR entry byte. Combat, rewards, portal behavior, visual resources and all final candidate bytes require the separate fresh full native/client gates.'};
}
function verifyConstructionReuse(report,finalNative,options){
 const checks=[];function ck(name,value,detail){checks.push({name,passed:!!value,detail});}
 function fileRecord(file,expected,label){try{const actual=hash(file);ck(label+' file SHA256 matches',typeof expected==='string'&&actual===expected,{file,expected,actual});return read(file);}catch(e){ck(label+' is readable',false,{file,error:String(e)});return null;}}
 const proof=report&&report.construction,deps=proof&&proof.dependencies,join=report&&report.evidenceJoin;
 ck('independent construction outer report is actual and passed',report&&report.passed===true&&report.actualMinecraft===true&&proof&&proof.passed===true&&proof.nativePassed===true);
 ck('scoped construction preservation is explicitly declared',proof&&proof.preservationScope===SCOPE&&proof.zeroUnplannedConstructionChanges===true&&proof.criticalOriginalBlockEntityContentPreserved===true);
 ck('evidence join retains every required actual check',join&&join.schemaVersion===2&&Array.isArray(join.checks)&&join.checks.length>=14&&join.checks.every(r=>r.passed===true));
 if(!proof||!deps||!join)return{passed:false,checks,dependencyPaths:[],nonConstructionChanges:[]};
 const raw=fileRecord(deps.nativeResultFile,deps.nativeResultSHA256,'raw construction native result'),strict=proof.strictOriginalPreservation,at=proof.controlledAttribution;
 const literal=strict&&fileRecord(strict.file,strict.sha256,'original strict Anvil comparison'),attribution=at&&fileRecord(at.file,at.sha256,'matched no-builder attribution'),control=at&&fileRecord(at.controlResultFile,at.controlResultSHA256,'actual no-builder native result');
 const plan=fileRecord(deps.planFile,deps.planSHA256,'authoritative construction plan'),approval=fileRecord(deps.approvalFile,deps.approvalSHA256,'original source approval');
 ck('original failed literal preservation verdict remains unchanged',literal&&literal.passed===false&&literal.zeroOutsideWrites===false&&literal.blockEntitiesPreserved===false&&strict.passed===false&&proof.zeroOutsideWrites===false&&proof.blockEntitiesPreserved===false);
 ck('matched control supports only zero unexplained construction changes',attribution&&attribution.actualMinecraft===true&&attribution.passed===true&&attribution.rawAnvilPassed===false&&attribution.rawFailedVerdictOverwritten===false&&attribution.readOnly===true&&attribution.unplannedBlockChangeCount===0&&attribution.unexplainedBlockEntityChangeCount===0&&attribution.originalNonemptyCriticalContentPreserved===true&&Array.isArray(attribution.checks)&&attribution.checks.every(r=>r.passed===true));
 if(attribution&&attribution.inputs)for(const [file,sha]of Object.entries(attribution.inputs))fileRecord(file,sha,'bound attribution input');
 ck('both source construction and no-builder native runs genuinely passed',raw&&control&&[raw,control].every(r=>r.passed===true&&r.actualMinecraft===true&&r.serverReady===true&&r.probe&&r.probe.passed===true));
 ck('raw native probe preserved without alteration',raw&&stable(report.probe)===stable(raw.probe));
 ck('construction dependency receipt reflects the actual original run',raw&&stable(deps.codeHashes)===stable(raw.codeHashes)&&stable(deps.modHashes)===stable(raw.modHashes)&&deps.savedWorldInventorySHA256===raw.savedWorldInventorySHA256&&deps.worldSourceInventorySHA256===raw.worldSourceInventorySHA256);
 ck('raw source plan and approval cover same exact target cells',plan&&approval&&plan.signature===proof.signature&&Number(plan.ops&&plan.ops.length||plan.operations&&plan.operations.length)===proof.verifiedCells&&approval.passed===true);
 let result=null,bridgeReceipt=null;try{
  const candidateRoot=options.candidateRoot,currentHashes=options.currentHashes||inventory(candidateRoot),previousRoot=deps.immutableCandidateSource,previousRaidFile=path.join(previousRoot,RAID_CONFIG),previousSourceFile=path.join(previousRoot,'kubejs/server_scripts/46_chapter1_three_boss_raid_engine_v10_1.js');
  if(deps.codeHashes[BRIDGE]!==currentHashes[BRIDGE]){bridgeReceipt=verifyBridgeMetadataReceipt(options.bridgeMetadataProofPath||path.resolve(candidateRoot,'../검증/bridge_packmeta_only_v104.json'),deps,candidateRoot);checks.push(...bridgeReceipt.checks);}
  ck('archived raid config bytes match original construction snapshot',hash(previousRaidFile)===deps.codeHashes[RAID_CONFIG]);
  ck('archived raid binding source bytes match original construction snapshot',hash(previousSourceFile)===deps.codeHashes['kubejs/server_scripts/46_chapter1_three_boss_raid_engine_v10_1.js']);
  result=dependencyVerdict({constructionHashes:deps.codeHashes,finalHashes:finalNative&&finalNative.codeHashes,currentHashes,bridgeMetadataProof:bridgeReceipt&&bridgeReceipt.passed&&bridgeReceipt.proof,config:read(path.join(candidateRoot,'kubejs/config/fcraft_arena_construction_v103.json')),constructionModHashes:deps.modHashes,finalModHashes:finalNative&&finalNative.modHashes,constructionBaseProfile:raw&&raw.liveProfileBeforeInventorySHA256,finalBaseProfile:finalNative&&finalNative.liveProfileBeforeInventorySHA256,constructionSavedWorld:deps.savedWorldInventorySHA256,finalWorldSource:finalNative&&finalNative.worldSourceInventorySHA256,finalBootWorld:finalNative&&finalNative.bootWorldInventorySHA256,previousRaidConfig:read(previousRaidFile),currentRaidConfig:read(path.join(candidateRoot,RAID_CONFIG)),previousRaidSource:fs.readFileSync(previousSourceFile,'utf8'),currentRaidSource:fs.readFileSync(path.join(candidateRoot,'kubejs/server_scripts/46_chapter1_three_boss_raid_engine_v10_1.js'),'utf8')});checks.push(...result.checks);
 }catch(e){ck('audited construction dependencies readable',false,String(e));}
 return{passed:checks.every(r=>r.passed),checks,dependencyPaths:result&&result.dependencyPaths||[],nonConstructionChanges:result&&result.nonConstructionChanges||[],changedCandidatePaths:result&&result.changedCandidatePaths||[],bridgeMetadataOnlyTransition:result&&result.bridgeMetadataOnlyTransition||null,bridgeMetadataReceipt:bridgeReceipt&&{file:bridgeReceipt.file,sha256:bridgeReceipt.sha256,passed:bridgeReceipt.passed},scope:SCOPE,reuseClaim:result&&result.scope,sourceNativeResult:deps.nativeResultFile,sourceSavedWorldInventorySHA256:deps.savedWorldInventorySHA256,strictOriginalPreservation:strict,controlledAttribution:at};
}
module.exports={SCOPE,RAID_CONFIG,BRIDGE,BRIDGE_NAME,REQUIRED,stable,inventory,dependencyPaths,raidConstructionProjection,functionSlice,bridgeMetadataTransition,verifyBridgeMetadataReceipt,dependencyVerdict,verifyConstructionReuse};
