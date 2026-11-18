'use strict';
// Unit ports never certify a rendered Minecraft client or a running Forge server.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {evaluatePlaneCoverage}=require('./verification_planes_v105.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.dirname(root),args=process.argv.slice(2),unitOnly=args.includes('--unit-only');
function option(flag,fallback){const at=args.indexOf(flag);return at<0?fallback:path.resolve(args[at+1]||'');}
const output=option('--output',path.join(root,'검증',unitOnly?'v10_5_unit_verification.json':'v10_5_active_boss_ai_and_parry_hud_verification.json'));
const nativePath=option('--native-result',path.join(root,'검증/native/active_v105_final/result.json'));
const clientPath=option('--client-result',path.join(root,'검증/native_client/active_v105_final/result.json'));
const checks=[],errors=[],runs=[];
function ck(name,passed,detail){checks.push({name,passed:!!passed,detail});if(!passed)errors.push(name);return!!passed;}
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function read(file,label){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch(error){ck(label+' is present and readable',false,{path:file,error:String(error)});return null;}}
function inventory(base){const rows={};function visit(dir,rel){for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const r=rel?rel+'/'+item.name:item.name,p=path.join(dir,item.name);if(item.isDirectory())visit(p,r);else if(item.isFile())rows[r]=hash(p);}}visit(base,'');return rows;}
function rows(report){return report&&report.probe&&Array.isArray(report.probe.checks)?report.probe.checks:report&&Array.isArray(report.checks)?report.checks:[];}
const required=['active_boss_ai_v105.cjs','portal_v105_runtime.cjs','package_v105.cjs','verification_planes_v105.cjs','guardian_portal_runtime.cjs','guardian_gear_v102.test.cjs','raid_engine_core.cjs','arena_builder_core.cjs','arena_builder_runtime.cjs','sanctum_builder_core.cjs','sanctum_builder_runtime.cjs'];
const hud=fs.readdirSync(__dirname).filter(n=>/^client_v105.*\.cjs$/.test(n)).sort();
ck('dedicated v10_5 HUD behavioral suite exists',hud.length>0,hud);
for(const name of required.concat(hud)){
 const file=path.join(__dirname,name);if(!ck('required behavioral suite '+name,fs.existsSync(file)))continue;
 const run=cp.spawnSync(process.execPath,[file],{cwd:workspace,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:2*1024*1024});
 const lines=String(run.stdout||'').trim().split(/\r?\n/);let result=null;for(let i=lines.length-1;i>=0;i--)try{result=JSON.parse(lines[i]);break;}catch(ignored){}
 const record={name,exitCode:run.status,sourceSHA256:hash(file),result,stdoutTail:lines.slice(-5).join('\n'),stderrTail:String(run.stderr||'').slice(-2400)};runs.push(record);
 ck('behavioral execution '+name,run.status===0&&(!result||result.passed!==false),record);
}
const production=inventory(path.join(root,'수정파일'));
for(const rel of Object.keys(production).filter(p=>/^kubejs\/(?:server|client|startup)_scripts\/.*\.js$/.test(p))){
 const parsed=cp.spawnSync(process.execPath,['--check',path.join(root,'수정파일',rel)],{encoding:'utf8',windowsHide:true});
 ck('production script parses '+rel,parsed.status===0,{sha256:production[rel],error:String(parsed.stderr||'').slice(-1600)});
}
const specA=path.join(root,'원본지시/f_craft_3_32.md'),specB=path.join(root,'원본지시/f_craft_3_321.md');
ck('the two supplied documents are identical preserved inputs',fs.existsSync(specA)&&fs.existsSync(specB)&&hash(specA)===hash(specB),{specA,specB});
const portal=JSON.parse(fs.readFileSync(path.join(root,'수정파일/kubejs/config/fcraft_guardian_portal_v104.json'),'utf8'));
ck('surveyed west island coordinates remain intact',portal.overworld.pedestal.x===-312&&portal.overworld.pedestal.y===117&&portal.overworld.pedestal.z===-1878&&portal.overworld.returnPosition.x===-311.5&&portal.overworld.returnPosition.z===-1875.5,portal.overworld);
let native=null,client=null,nr=[],cr=[],nativeCurrent=false,clientCurrent=false,coverage=null;
if(!unitOnly){
 native=read(nativePath,'actual Forge server evidence');client=read(clientPath,'actual connected client evidence');nr=rows(native);cr=rows(client);
 coverage=evaluatePlaneCoverage(production,native,client);
 coverage.nativeResult=nativePath;coverage.clientResult=clientPath;
 coverage.nativeResultSHA256=fs.existsSync(nativePath)?hash(nativePath):null;
 coverage.clientResultSHA256=fs.existsSync(clientPath)?hash(clientPath):null;
 nativeCurrent=coverage.dedicatedServerCurrent;clientCurrent=coverage.connectedClientCurrent;
 ck('dedicated-server current byte coverage',nativeCurrent,{candidateKeysEqual:coverage.nativeCandidateKeysEqual,fullCandidateExact:coverage.nativeFullCandidateExact,reusedClientOnlyPaths:coverage.clientOnlyReuse,unsupportedDifferences:coverage.unsupportedDifferences,failures:coverage.failures});
 ck('actual Forge server and probe completed without failure',coverage.nativeExecution.passed,coverage.nativeExecution);
 ck('connected client tested every current candidate byte',clientCurrent,{candidateKeysEqual:coverage.clientCandidateKeysEqual,fullCandidateExact:coverage.clientFullCandidateExact,execution:coverage.clientExecution});
 ck('actual client connected and completed without physical input or script errors',coverage.clientExecution.passed,coverage.clientExecution);
}
function requirement(name,pattern,minimum,list){const matched=list.filter(r=>r.passed===true&&pattern.test(String(r.name||''))),distinct=new Set(matched.map(r=>String(r.name)));return{name,passed:distinct.size>=minimum,minimumDistinctChecks:minimum,matched:matched.map(r=>({suite:r.suite,name:r.name}))};}
function boss(name,suffix){return requirement(name,new RegExp('^active (?:krag|blossom|wrought) '+suffix+'$'),3,nr);}
const definitions=[
 {id:1,name:'세 보스의 NoAI 해제와 상시 추격',evidence:()=>[boss('intro retains working native AI','NoAI remainsfalse duringintro'),boss('positive native movement after intro','release haspositive native speed'),boss('actual pursuit displaces native entity','pursuit movesactualentity')]},
 {id:2,name:'근접 접근 시 실제 3D 공격',evidence:()=>[boss('native melee dispatch','actual3D melee dispatch'),requirement('actual blossom fang entities',/^active blossom actual3D fangs spawned$/,1,nr)]},
 {id:3,name:'도약·잠복·증기 돌진 원거리 추격',evidence:()=>[boss('actual long-range burst displacement','longrange burst movesactualentity')]},
 {id:4,name:'950ms 발광·320ms 패링 HUD·전투 중 보조 HUD 숨김',evidence:()=>[boss('19-tick authoritative parry cue','parry19tick windup andgoldstart'),boss('R parry grants intended benefits','goldenR opensgroggy manaandrefund'),boss('freeze preserves AI and positive speed','groggy NoAI remainsfalse andspeedpositive'),boss('thaw removes movement modifier','thaw restoresbaseSpeed'),requirement('rendered timing HUD at real client sizes',/^v105 client parry timing HUD rendered (?:small|normal|large)$/,3,cr),requirement('native overlay/dimension/heartbeat each hides and locks foldouts',/^v105 client foldouts hiddenandlocked (?:nativebar|sanctum|heartbeat)$/,3,cr),requirement('UI restores outside combat',/^v105 client foldouts restored aftercombat$/,1,cr)]},
 {id:5,name:'아레나·포탈·추락·사망·시체 안전망',evidence:()=>[
  requirement('actual Y68 nonlethal rescue',/^portal nativevoidrescue y68 nonlethal4HP noitemloss$/,1,nr),requirement('one-HP rescue stays alive',/^portal nativevoidrescue oneHP staysalive$/,1,nr),requirement('dead fallen player is not resurrected by rescue',/^active deadfallenplayer rescue neverrevives$/,1,nr),requirement('actual Corpse relocation',/^portal actualdeath createsonecorpse safelyrelocatedOW$/,1,nr),requirement('exact native item NBT retained',/^portal corpse sameowner actualnative64bitNBTanditems preserved$/,1,nr),requirement('actual respawn west gate',/^portal actualrespawn returnsOWgate withsameplayerUUID$/,1,nr),requirement('party dimension transfer',/^portal firstarch transfersnearactualteam excludesunrelatedandfar$/,1,nr),requirement('victory portal return',/^portal actualgoldenportal contact returnsOW$/,1,nr)]},
 {id:6,name:'무한내구도 원본 드롭 차단·12직종 80% 가보 계승',evidence:()=>[
  requirement('native forbidden drops blocked',/^(?:raid (?:krag|blossom|wrought) no forbidden infinitegear grounddrops|active wrought native forbidden drops removed)$/,1,nr),requirement('all 12 actual forge paths',/^guardian all12 actualforge [a-z_]+$/,12,nr),requirement('actual80percent enhancement transfer',/^guardian nativeforge80percent \+15to12 exactcost andrealblocks$/,1,nr),requirement('exact64bit lineage preserved',/^guardian unknownnative64bit\/tag\/enchant\/historylineage retained$/,1,nr)]}
];
const categories=definitions.map(def=>{const evidence=unitOnly?[]:def.evidence(),passed=!unitOnly&&nativeCurrent&&(def.id!==4||clientCurrent)&&evidence.length>0&&evidence.every(r=>r.passed);if(!unitOnly)ck('required in-game category '+def.id,passed,evidence);return{id:def.id,name:def.name,status:unitOnly?'not_run':passed?'passed':'failed',passed,evidence};});
const passed=errors.length===0,result={passed,scope:unitOnly?'unit-and-file-checks':'complete-native-server-and-client',fullyVerified:!unitOnly&&passed,actualMinecraft:!unitOnly&&!!native&&!!client&&native.actualMinecraft===true&&client.actualMinecraft===true,humanPlay:false,physicalInputUsed:client?client.physicalInputUsed:false,nativeResult:unitOnly?null:nativePath,clientResult:unitOnly?null:clientPath,candidateHashes:production,coverage,unitRuns:runs,categories,checks,errors,note:unitOnly?'PASS applies only to explicitly executed unit and file checks. All six in-game categories remain not_run.':'All six requirements require successful actual process evidence without script errors. Dedicated Forge coverage may reuse only a same-present revision of client08, which the dedicated server never loads; the final successful connected client must match every current candidate byte. Every other file change or key-set difference requires fresh native coverage. Original execution reports are retained unchanged.'};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed,scope:result.scope,fullyVerified:result.fullyVerified,checks:checks.length,unitSuites:runs.length,categoriesPassed:categories.filter(c=>c.passed).length,errors,output}));process.exitCode=passed?0:1;
