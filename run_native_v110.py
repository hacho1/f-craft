"""Launch exact immutable phase6 candidate snapshots in an isolated headless Forge profile.

The default command runs a real game server. --prepare-only stages a disposable
profile without starting Java; its receipt explicitly is not game validation.
"""
from pathlib import Path
import argparse, contextlib, hashlib, importlib.util, json, msvcrt, os, queue
import datetime, gzip, re, shutil, struct, subprocess, sys, threading, time, zipfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('_fcraft98_native_core',ROOT.parent/'F-Craft_v9_4_세르딘개편/install_update.py')
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
BASELINE=ROOT.parent/'F-Craft_8차_보스추격_패링HUD_v10_5'
LIVE=(BASELINE/'테스트프로필/server').resolve()
TEST=ROOT/'테스트프로필/server'
JAVA=Path('C:/Users/wooheewon/curseforge/minecraft/Install/java/java-runtime-gamma/bin/java.exe')
SUITES=['claims110','claims110_restart','mainland110','mainland110_restart','mount110','mount110_restart','transport','passives','passives_restart','combat','combat_restart','life','life_restart','promotions','promotions_restart','compendium','compendium_restart','equipment','equipment_restart','cottage','cottage_restart','standalone','growth','hotfix','raid','gear','boot','construction','sanctum','portal','control','active']
PAXI='Paxi-1.20-Forge-4.0.jar'
QA_MOD='F-Craft-QA-Channel-1.0.jar'
QA_MOD_SHA='5746557322577bfda6d7ddf466956ef385bb3e4e5a7277113c64034594f4ec9b'
WORLD='FCraftPhase7_QA'
WORLD_MAINLAND_PROVIDER='datapacks/f_rank_days_v8_worldgen/data/f_rank_days/dimension/mainland_wilds.json'
NBT_DECODER=ROOT.parent/'v7.2_업데이트/verify-prebuilt.py'
CANDIDATE=None
VARIANT_OMISSIONS={
 'control_earthworks':['kubejs/server_scripts/48_serdin_three_boss_arenas_builder_v10_3.js','kubejs/server_scripts/50_guardian_sanctum_builder_v10_4.js'],
 'no_dummy':['mods/dummmmmmy-1.20-2.0.12-forge.jar'],
 'no_mainland':sorted(['kubejs/server_scripts/24_mainland_frontier_and_citadels_v9_6.js','kubejs/server_scripts/34_dimension_travel_v99.js','kubejs/server_scripts/36_mainland_quest_stages_v99.js','kubejs/data/f_rank_days/dimension/mainland_wilds.json'])
}

def variant_omissions(a):return VARIANT_OMISSIONS.get(a.variant,[])

def omit_runtime(rel,label):
 p=core.contained(TEST,rel)
 if p.exists():
  saved=p.with_name(p.name+'.disabled.'+label)
  if saved.exists():raise RuntimeError('Preserve prior variant omission '+str(saved))
  p.rename(saved)

def quarantine_mainland_world_resource(a,world,rel=WORLD_MAINLAND_PROVIDER):
 if rel!=WORLD_MAINLAND_PROVIDER:raise RuntimeError('Only the exact copied-world mainland provider may be quarantined')
 world=Path(world).resolve();expected=TEST.resolve()/WORLD
 if world!=expected or core.linked(expected):raise RuntimeError('World transformation must stay inside the exact owned active LAB world')
 if not re.fullmatch('[A-Za-z0-9_]+',a.label):raise RuntimeError('Unsafe world-quarantine evidence label')
 source=core.contained(world,rel);outdir=ROOT.resolve()/'검증/native'/a.label
 destination=core.contained(outdir,'world_omissions/'+rel)
 if not outdir.resolve().is_relative_to(ROOT.resolve()/'검증/native')or destination.is_relative_to(world):raise RuntimeError('World quarantine must stay outside the active world and inside its evidence directory')
 for p in [source]+list(source.parents):
  if p==world:break
  if p.exists()and core.linked(p):raise RuntimeError('Linked world resource cannot be quarantined')
 if destination.exists()or destination.is_symlink():raise RuntimeError('Preserve the existing quarantined world resource; choose a fresh label')
 if not source.is_file():raise RuntimeError('Expected exact copied-world mainland provider is absent')
 before=sha(source);size=source.stat().st_size
 destination.parent.mkdir(parents=True,exist_ok=True)
 # Both absolute targets have been checked; move one exact file, never a tree.
 source.rename(destination)
 if source.exists()or sha(destination)!=before or destination.stat().st_size!=size:raise RuntimeError('World resource quarantine did not preserve exact bytes')
 return {'kind':'quarantined_mainland_dimension_resource','path':rel,'beforeSHA256':before,'beforeBytes':size,'quarantinePath':destination.relative_to(ROOT.resolve()).as_posix(),'quarantineSHA256':sha(destination),'quarantineBytes':destination.stat().st_size,'runtimeAbsentInitially':True}

def audit_variant_world_resources(world,transforms,after_run=False):
 valid=True;world=Path(world).resolve()
 for row in transforms:
  if row.get('kind')!='quarantined_mainland_dimension_resource':continue
  if row.get('path')!=WORLD_MAINLAND_PROVIDER:raise RuntimeError('Unknown quarantined world resource')
  resource=core.contained(world,row['path']);quarantine=core.contained(ROOT,row['quarantinePath'])
  absent=not resource.exists();preserved=quarantine.is_file()and sha(quarantine)==row['beforeSHA256']==row['quarantineSHA256']and quarantine.stat().st_size==row['beforeBytes']==row['quarantineBytes']
  if after_run:row.update(runtimeAbsentAfterRun=absent,quarantineUnchangedAfterRun=preserved)
  valid=valid and absent and preserved
 return valid

def prepare_variant_world(a,world):
 if a.variant!='no_mainland':return []
 # An existing starter serializes its dynamic dimensions in level.dat. Remove
 # only this dimension in the disposable LAB copy as well as omitting its pack.
 world=Path(world).resolve()
 if world!=TEST.resolve()/WORLD:raise RuntimeError('Saved dimension transform must target the exact owned LAB world')
 sp=importlib.util.spec_from_file_location('_phase6_variant_nbt',NBT_DECODER);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
 changed=[quarantine_mainland_world_resource(a,world)]
 for name in ['level.dat','level.dat_old']:
  p=world/name
  if not p.exists():continue
  root_name,root=m.load_nbt(p);dims=root.value['Data'].value['WorldGenSettings'].value['dimensions'].value
  if 'f_rank_days:mainland_wilds'in dims:
   before=sha(p);del dims['f_rank_days:mainland_wilds'];p.write_bytes(gzip.compress(m.encode_root(root_name,root),mtime=0));changed.append({'kind':'saved_registry_dimension_removal','path':name,'beforeSHA256':before,'afterSHA256':sha(p),'operation':'remove saved mainland_wilds dimension only in LAB copy'})
 if not audit_variant_world_resources(world,changed):raise RuntimeError('Copied-world mainland provider remains active or quarantine differs')
 return changed

def baseline_inventory():
 # This baseline is a read-only QA runtime, with unrelated historical worlds.
 # Protect every runtime input we copy; the selected source world has its own
 # complete before/after inventory in stage/main.
 out={}
 for folder in ['mods','config','defaultconfigs','kubejs','resourcepacks']:
  for rel,meta in core.inventory(LIVE/folder).items():out[folder+'/'+rel]=meta
 return out

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def candidates():return {p.relative_to(CANDIDATE).as_posix():sha(p)for p in(CANDIDATE).rglob('*')if p.is_file()}

def freeze_candidate_snapshot(label,source=None):
 if not re.fullmatch('[A-Za-z0-9_]+',label):raise ValueError('Invalid snapshot label')
 source=Path(source).resolve()if source else ROOT/'수정파일';target=ROOT/'검증/native_inputs'/label/'수정파일'
 if source!=(ROOT/'수정파일').resolve()and not source.is_relative_to((ROOT/'검증/native_inputs').resolve()):raise RuntimeError('Freeze only current product or an owned immutable candidate')
 if target.exists():raise RuntimeError('Preserve previous immutable candidate snapshot')
 before=core.inventory(source);target.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(source,target)
 after=core.inventory(source);copied=core.inventory(target)
 result={'passed':before==after==copied,'actualMinecraft':False,'source':str(source),'snapshot':str(target),'fileCount':len(copied),'inventorySHA256':core.inventory_sha(copied),'files':copied}
 (target.parent/'snapshot.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 if not result['passed']:raise RuntimeError('Source changed while copying; partial snapshot preserved, choose a fresh label')
 return result

def seed_legacy_puffish_lab(world,outdir):
 # Explicit LAB input in the disposable copied world; production NbtIo reads it.
 fixture=json.loads((ROOT/'tests/native/phase4_legacy_seed.json').read_text(encoding='utf-8'));target=world/'data/puffish_skills.dat'
 if target.exists():raise RuntimeError('Refuse to overwrite an incumbent source Puffish file in the copied world')
 def utf(s):raw=s.encode('utf-8');return struct.pack('>H',len(raw))+raw
 def payload(kind,value):
  if kind==1:return struct.pack('>b',value)
  if kind==3:return struct.pack('>i',value)
  if kind==8:return utf(value)
  if kind==9:sub,items=value;return bytes([sub])+struct.pack('>i',len(items))+b''.join(payload(sub,x)for x in items)
  if kind==10:return b''.join(bytes([t])+utf(k)+payload(t,v)for k,(t,v)in value.items())+b'\0'
  raise ValueError(kind)
 players={}
 for actor in fixture['actors']:
  categories={}
  for job,data in actor['categories'].items():categories['f_rank_days:'+job]=(10,{'unlocked':(1,int(data['unlocked'])),'experience':(3,0),'unlocked_skills':(9,(8,data['nodes'])),'points':(10,{key:(3,value)for key,value in data['points'].items()})})
  players[actor['uuid']]=(10,{'categories':(10,categories)})
 raw=bytes([10])+utf('')+payload(10,{'DataVersion':(3,3465),'data':(10,{'players':(10,players)})});target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(gzip.compress(raw,mtime=0))
 report={'labOnly':True,'claimsUserSaveMigration':False,'sourceWorldModified':False,'file':str(target),'sha256':sha(target),'actors':fixture['actors'],'scope':'Native Puffish loader and production NbtIo snapshot migration read this explicit historical fixture'}
 (outdir/'legacy_puffish_lab_seed.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');return report
def overlay(src,dst):
 if not src.exists():return
 for p in src.rglob('*'):
  if p.is_file():
   q=dst/p.relative_to(src)
   if q.is_file()and q.stat().st_size==p.stat().st_size and sha(q)==sha(p):continue
   q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
def permitted_source(source):
 source=Path(source).resolve()
 return (source.is_relative_to(ROOT.resolve())and not source.is_relative_to(TEST.resolve()))or source==(BASELINE/'개발용월드/FCraft_Start_v10_4').resolve()
def mirrored(rel,names):
 return rel.startswith(('kubejs/','config/','defaultconfigs/','resourcepacks/'))or(rel.startswith('mods/')and Path(rel).name in names)

def helper_runtime_path(name):
 return TEST/'kubejs'/('startup_scripts'if name.startswith('startup/')else'server_scripts')/Path(name).name

@contextlib.contextmanager
def exclusive_profile_runner():
 # The controller owns this byte until all result collection is complete.
 TEST.mkdir(parents=True,exist_ok=True)
 with(TEST/'.native_runner.lock').open('a+b')as handle:
  if handle.seek(0,2)==0:handle.write(b'0');handle.flush()
  handle.seek(0)
  try:msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
  except OSError as error:raise RuntimeError('Another QA controller owns this profile; wait for its final result and exit.')from error
  try:yield
  finally:handle.seek(0);msvcrt.locking(handle.fileno(),msvcrt.LK_UNLCK,1)

def stage(a):
 assert re.fullmatch('[A-Za-z0-9_]+',a.label),'Use a simple unique evidence label'
 source=Path(a.world_source).resolve()
 if not permitted_source(source)or not(source/'level.dat').is_file():raise RuntimeError('Source must be an owned phase6 world or the exact read-only LIVE starter template')
 source_inventory=core.inventory(source);outdir=ROOT/'검증/native'/a.label
 if outdir.exists():raise RuntimeError('Preserve previous evidence; choose another label')
 helper_dir=ROOT/'tests/native'
 if not(helper_dir/'99_run_phase4.js').is_file():raise RuntimeError('Root native driver99 is not ready; no server was launched')
 outdir.mkdir(parents=True);TEST.mkdir(parents=True,exist_ok=True)
 libs=ROOT.parent/'F-Craft_v9_개편/실행검증/server/libraries'
 if not(TEST/'libraries').exists():shutil.copytree(libs,TEST/'libraries')
 (TEST/'mods').mkdir(exist_ok=True)
 allow=json.loads((ROOT.parent/'F-Craft_v9_3_통합업데이트/개별작업/mods_resources/server_allowlist.json').read_text('utf-8'))
 names={r['filename']for r in allow['records']}|{'ftb-chunks-forge-2001.3.8.jar',PAXI,'BOMD-Forge-1.20.1-1.1.2.jar','CerbonsAPI-Forge-1.20.1-1.1.0.jar','NaturesCompass-1.20.1-1.12.0-forge.jar'}
 if len(names)!=48:raise RuntimeError('Unexpected dedicated baseline roster')
 names|={'fcraft-growth-bridge-1.0.0-forge-1.20.1.jar','fcraft-raid-bridge-1.0.0-forge-1.20.1.jar'}
 for extra,digest in {
  'waystones-forge-1.20.1-14.1.21.jar':'fd6fe3c645328ea7be5bc6723d02c881e34650e0cbd4527ba59e42fa4cbe3c80',
  'balm-forge-1.20.1-7.3.44.jar':'ad11d968770bb1ce73377626b6f1dcd4ae6f8be1ef6f37cee9b872b8176aebd3'
 }.items():
  artifact=CANDIDATE/'mods'/extra
  if artifact.is_file():
   if sha(artifact)!=digest:raise RuntimeError('Unexpected pinned dependency bytes '+extra)
   names.add(extra)
 if a.variant!='no_dummy':names.add('dummmmmmy-1.20-2.0.12-forge.jar')
 if(CANDIDATE/'mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar').is_file():names.add('fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar')
 qa_jar=ROOT/'tests/native/bootstrap'/QA_MOD
 if sha(qa_jar)!=QA_MOD_SHA:raise RuntimeError('QA-only channel resource helper changed')
 with zipfile.ZipFile(qa_jar)as z:
  if z.testzip()is not None or z.read('kubejs.classfilter.txt').decode('utf-8').splitlines()!=['+io.netty.channel.embedded.EmbeddedChannel','+io.netty.util.AttributeKey','+io.netty.util.ReferenceCountUtil']:raise RuntimeError('Unexpected QA class-filter permissions')
 for name in sorted(names|{QA_MOD}):
  proposed=ROOT/'수정파일/mods'/name;src=qa_jar if name==QA_MOD else proposed if proposed.is_file()else LIVE/'mods'/name
  shutil.copy2(src,TEST/'mods'/name)
 for rel in variant_omissions(a):
  if rel.startswith('mods/'):omit_runtime(rel,a.label)
 if {p.name for p in(TEST/'mods').glob('*.jar')}!=names|{QA_MOD}:raise RuntimeError('Unexpected jar in disposable server; preserve and inspect it')
 for folder in ['kubejs','config','defaultconfigs','resourcepacks']:
  overlay(LIVE/folder,TEST/folder);overlay(CANDIDATE/folder,TEST/folder)
 # Four-tab v10.6 quest definitions replace this exact owned LAB scope.
 quest_scope=TEST/'config/ftbquests/quests/chapters'
 candidate_quests=CANDIDATE/'config/ftbquests/quests/chapters'
 if candidate_quests.is_dir():
  expected_quests={p.name for p in candidate_quests.glob('*.snbt')}
  for old_quest in quest_scope.glob('*.snbt'):
   if old_quest.name not in expected_quests:
    assert old_quest.resolve().is_relative_to(quest_scope.resolve())
    saved=old_quest.with_name(old_quest.name+'.retired.'+a.label)
    if saved.exists():raise RuntimeError('Preserve prior LAB quest retirement')
    old_quest.rename(saved)
 for rel in variant_omissions(a):
  if not rel.startswith('mods/'):omit_runtime(rel,a.label)
 # Disable only disposable verification scripts. Existing production08 etc.
 # have leading zeros and are preserved. Old numbered native80/99 helpers may
 # not execute together with their replacement.
 for p in(TEST/'kubejs/server_scripts').glob('*.js'):
  if re.match(r'^[89]\d',p.name):
   dest=p.with_suffix('.js.disabled.'+a.label)
   if dest.exists():raise RuntimeError('Preserve previous disabled helper '+str(dest))
   p.rename(dest)
 active_prefixes=None
 if a.suites:
  active_prefixes={'79','80','99'}|{{'passives':'81','promotions':'82','combat':'83','life':'84','transport':'79','compendium':'85','equipment':'86','cottage':'87','standalone':'87','growth':'88','hotfix':'89','raid':'90','gear':'91','boot':'92','construction':'93','sanctum':'93','portal':'94','control':'96','mainland110':'97','claims110':'97','mount110':'98','active':'95'}[s.split('_')[0]]for s in a.suites}
  if any(s.split('_')[0]in {'equipment','cottage','growth'}for s in a.suites):active_prefixes.add('88')
 helper_files=[p for p in helper_dir.glob('*.js')if active_prefixes is None or p.name[:2]in active_prefixes]
 for p in helper_files:shutil.copy2(p,TEST/'kubejs/server_scripts'/p.name)
 startup_helpers=sorted((helper_dir/'startup').glob('*.js'))
 for p in startup_helpers:
  destination=TEST/'kubejs/startup_scripts'/p.name
  if destination.exists():
   previous=destination.with_suffix('.js.disabled.'+a.label)
   if previous.exists():raise RuntimeError('Preserve previous QA startup helper')
   destination.rename(previous)
  shutil.copy2(p,destination)
 for p in helper_dir.glob('*.json'):shutil.copy2(p,TEST/'kubejs'/p.name)
 world=TEST/WORLD;source_digest=core.inventory_sha(source_inventory);provenance=TEST/'.native_world_source.json'
 if not a.restart:
  if world.exists():
   dest=TEST/(WORLD+'_previous_'+a.label)
   if dest.exists():raise RuntimeError('Preserve previous disposable world')
   assert world.resolve().is_relative_to(TEST.resolve())and dest.resolve().is_relative_to(TEST.resolve());world.rename(dest)
  shutil.copytree(source,world)
  assert core.inventory(world)==source_inventory
  if not a.suites or 'passives'in a.suites:seed_legacy_puffish_lab(world,outdir)
  provenance.write_text(json.dumps({'source':str(source),'inventorySHA256':source_digest,'label':a.label,'candidateInventorySHA256':core.inventory_sha(core.inventory(CANDIDATE))},ensure_ascii=False,indent=2),'utf-8')
 else:
  prior=json.loads(provenance.read_text('utf-8'))
  if Path(prior['source']).resolve()!=source or prior['inventorySHA256']!=source_digest:raise RuntimeError('Restart world belongs to a different source snapshot')
  if prior.get('candidateInventorySHA256')!=core.inventory_sha(core.inventory(CANDIDATE)):raise RuntimeError('Cold restart requires the exact candidate bytes used by the preceding full world')
 assert(world/'level.dat').is_file()
 variant_world_transforms=prepare_variant_world(a,world)
 boot_digest=core.inventory_sha(core.inventory(world))
 (TEST/'eula.txt').write_text('eula=true\n')
 (TEST/'server.properties').write_text('server-ip=127.0.0.1\nserver-port=25595\nonline-mode=false\nmax-players=4\nview-distance=2\nsimulation-distance=2\nmax-tick-time=300000\nlevel-name='+WORLD+'\nspawn-protection=0\nallow-flight=true\ndifficulty=normal\n')
 output=TEST/'kubejs/phase6_native_result.json'
 if output.exists():output.rename(TEST/'kubejs'/('phase4_native_result_previous_'+a.label+'.json'))
 partial=TEST/'kubejs/phase6_native_partial.json'
 if partial.exists():partial.rename(TEST/'kubejs'/('phase7_native_partial_previous_'+a.label+'.json'))
 for name in ['phase7_outdoor_plan_v104.json','phase7_sanctum_plan_v104.json']:
  prior_plan=TEST/'kubejs'/name
  if prior_plan.exists():prior_plan.rename(prior_plan.with_name(name+'.previous_'+a.label))
 (TEST/'kubejs/phase6_native_input.json').write_text(json.dumps({'label':a.label,'restart':a.restart,'suites':a.suites,'variant':a.variant}),encoding='utf-8')
 (TEST/'kubejs/phase7_qa_stop.json').write_text('{"requested":false}',encoding='utf-8')
 code=candidates();execute={r:h for r,h in code.items()if mirrored(r,names)and r not in variant_omissions(a)}
 mismatches=[r for r,h in execute.items()if not(TEST/r).is_file()or sha(TEST/r)!=h]
 if mismatches:raise RuntimeError('Disposable executed candidates differ: '+str(mismatches))
 if core.inventory(source)!=source_inventory:raise RuntimeError('Source changed during staging')
 helpers={p.name:sha(p)for p in helper_files};helpers.update({'startup/'+p.name:sha(p)for p in startup_helpers});fixtures={p.name:sha(p)for p in helper_dir.glob('*.json')}
 hashes={'candidates':code,'executedMirror':execute,'nonServerCandidatePaths':[r for r in code if r not in execute],'helpers':helpers,'fixtures':fixtures,'mods':{n:sha(TEST/'mods'/n)for n in names|{QA_MOD}},'runtimeCommonModCount':len(names),'qaOnlyMods':{QA_MOD:QA_MOD_SHA},'worldSource':str(source),'worldSourceInventorySHA256':source_digest,'bootWorldInventorySHA256':boot_digest,'runtimeMirrorInitiallyExact':True}
 if any(not helper_runtime_path(name).is_file()or sha(helper_runtime_path(name))!=digest for name,digest in helpers.items()):raise RuntimeError('QA helper mirror differs after staging')
 hashes['helperMirrorInitiallyExact']=True
 hashes.update(variant=a.variant,variantOmittedCandidatePaths=variant_omissions(a),variantOmittedRuntimeAbsentInitially=all(not(TEST/r).exists()for r in variant_omissions(a)),variantWorldTransforms=variant_world_transforms,variantWorldResourcesAbsentInitially=audit_variant_world_resources(world,variant_world_transforms))
 assert hashes['variantOmittedRuntimeAbsentInitially']
 assert hashes['variantWorldResourcesAbsentInitially']
 (outdir/'inputs.json').write_text(json.dumps(hashes,ensure_ascii=False,indent=2),'utf-8');(outdir/'executed_helpers').mkdir()
 for name in helpers:
  destination=outdir/'executed_helpers'/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(helper_dir/name,destination)
 for name in fixtures:shutil.copy2(helper_dir/name,outdir/'executed_helpers'/name)
 return source,source_inventory,outdir,output,hashes

def stop_owned(proc):
 if proc.poll()is None:
  try:os.write(proc.stdin.fileno(),b'stop\n')
  except(OSError,BrokenPipeError):pass
 try:return proc.wait(45)
 except subprocess.TimeoutExpired:
  proc.terminate()
  try:return proc.wait(25)
  except subprocess.TimeoutExpired:proc.kill();return proc.wait(10)

def main():
 global CANDIDATE
 ap=argparse.ArgumentParser();ap.add_argument('--candidate-source',type=Path,required=True);ap.add_argument('--parent-go',action='store_true');ap.add_argument('--world-source',required=True);ap.add_argument('--label',required=True);ap.add_argument('--restart',action='store_true');ap.add_argument('--variant',choices=sorted(VARIANT_OMISSIONS));ap.add_argument('--suites',nargs='+',choices=SUITES);ap.add_argument('--prepare-only',action='store_true');a=ap.parse_args()
 if a.variant and a.restart:raise RuntimeError('Fallback variants require a fresh independent LAB world')
 CANDIDATE=a.candidate_source.resolve();expected=(ROOT/'검증/native_inputs'/a.label/'수정파일').resolve()
 if CANDIDATE!=expected or not CANDIDATE.is_dir():raise RuntimeError('Candidate source must be exact immutable 검증/native_inputs/<label>/수정파일 snapshot')
 if not a.prepare_only and not a.parent_go:raise RuntimeError('Actual Minecraft requires explicit parent GO')
 if not a.prepare_only:
  ps=subprocess.run(['powershell','-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' OR Name='java.exe'\" | Select-Object ProcessId,Name | ConvertTo-Json -Compress"],capture_output=True,text=True,check=True)
  if ps.stdout.strip():raise RuntimeError('Another Java process exists; single Minecraft slot must be released before this run')
 live_before=baseline_inventory()
 source,source_inventory,outdir,output,inputs=stage(a)
 if a.prepare_only:
  report={'passed':True,'preparedOnly':True,'actualMinecraft':False,'serverLaunched':False,'sourceWorldUnchangedDuringPreparation':core.inventory(source)==source_inventory,'sourceCandidatesUnchangedDuringPreparation':candidates()==inputs['candidates'],'liveProfileUnchangedDuringPreparation':baseline_inventory()==live_before,'commonMods':inputs['runtimeCommonModCount'],'runtimeMirrorInitiallyExact':True,'inputs':inputs}
  report['passed']=all(report[k] for k in ['sourceWorldUnchangedDuringPreparation','sourceCandidatesUnchangedDuringPreparation','liveProfileUnchangedDuringPreparation']);assert report['passed']
  (outdir/'preparation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');print(json.dumps({'preparedOnly':True,'actualMinecraft':False,'serverLaunched':False,'commonMods':inputs['runtimeCommonModCount'],'candidateFiles':len(inputs['candidates'])}),flush=True);return
 args=[str(JAVA),'-Xms1G','-Xmx2G','-Dfile.encoding=UTF-8','-Dfml.disableVersionCheck=true','@libraries/net/minecraftforge/forge/1.20.1-47.4.28/win_args.txt','nogui']
 started_at=datetime.datetime.now(datetime.timezone.utc).isoformat();start=time.monotonic();proc=subprocess.Popen(args,cwd=TEST,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',creationflags=subprocess.CREATE_NO_WINDOW)
 print(json.dumps({'isolatedServerPID':proc.pid,'label':a.label,'commonMods':inputs['runtimeCommonModCount'],'qaOnlyMods':1,'totalTestMods':len(inputs['mods']),'candidateFiles':len(inputs['candidates'])}),flush=True)
 q=queue.Queue()
 def reader():
  for line in proc.stdout:q.put(line)
  q.put(None)
 threading.Thread(target=reader,daemon=True).start();ready=False;timed_out=False;controller_error=None
 try:
  with(outdir/'console.log').open('w',encoding='utf-8')as log:
   while time.monotonic()-start<1500:
    control=outdir/'stop_request.json'
    if control.exists():
     controller_error='Owned QA stop requested: '+control.read_text('utf-8',errors='replace')[:500];break
    try:line=q.get(timeout=1)
    except queue.Empty:
     if proc.poll()is not None:break
     continue
    if line is None:break
    log.write(line);log.flush()
    if 'ScheduledEvents$ScheduledEvent' in line and re.search(r'(?:Exception|Error):',line):
     controller_error='Uncaught scheduled callback exception; stopping the owned test server';break
    if 'KubeJS' in line and ('/ERROR]' in line or 'Error in' in line or '[ERR]' in line):
     controller_error='Native KubeJS error; stop this owned server and preserve the failing candidate: '+line.strip()[:1200];break
    if 'Done ('in line:ready=True
    if any(s in line for s in ['FCRAFT_PHASE6_SUITE','FCRAFT_PHASE6_COMPLETE','FCRAFT_PHASE6_ERROR','Error in','Exception in thread','Done (','Failed to start the minecraft server']):print(line.strip()[:1200],flush=True)
    if 'Failed to start the minecraft server'in line:break
   timed_out=proc.poll()is None and time.monotonic()-start>=1500
 except BaseException as error:controller_error=repr(error)
 finally:
  code=stop_owned(proc)
  for stream in[proc.stdin,proc.stdout]:
   try:stream.close()
   except(OSError,ValueError):pass
 same_source=core.inventory(source)==source_inventory;same_candidates=candidates()==inputs['candidates']
 if(TEST/'logs/latest.log').is_file():shutil.copy2(TEST/'logs/latest.log',outdir/'latest.log')
 same_mirror=all((TEST/r).is_file()and sha(TEST/r)==h for r,h in inputs['executedMirror'].items())
 same_helpers=all(helper_runtime_path(r).is_file()and sha(helper_runtime_path(r))==h for r,h in inputs['helpers'].items())and all(sha(TEST/'mods'/r)==h for r,h in inputs['mods'].items())
 log=(outdir/'console.log').read_text('utf-8',errors='replace')
 if(outdir/'latest.log').is_file():log+='\n'+(outdir/'latest.log').read_text('utf-8',errors='replace')
 script_errors=[s for s in log.splitlines()if('KubeJS'in s and('/ERROR]'in s or'Error in'in s or'[ERR]'in s))or'Error loading KubeJS'in s]
 report={'actualMinecraft':True,'kind':'Dedicated Forge; native real ServerPlayer actors with inert in-process Netty channels; no network clients','humanPlay':False,'connectedClient':False,'physicalInputUsed':False,'runtimeCommonModCount':inputs['runtimeCommonModCount'],'qaOnlyMods':inputs['qaOnlyMods'],'totalTestModCount':len(inputs['mods']),'label':a.label,'exitCode':code,'serverReady':ready,'timedOut':timed_out,'controllerError':controller_error,'wallSeconds':round(time.monotonic()-start,1),'codeHashes':inputs['candidates'],'helperHashes':inputs['helpers'],'fixtureHashes':inputs['fixtures'],'modHashes':inputs['mods'],'runtimeMirrorInitiallyExact':True,'executedMirrorHashes':inputs['executedMirror'],'nonServerCandidatePaths':inputs['nonServerCandidatePaths'],'worldSource':str(source),'worldSourceInventorySHA256':inputs['worldSourceInventorySHA256'],'sourceWorldUnchangedDuringTest':same_source,'sourceCandidatesUnchangedDuringTest':same_candidates,'immutableCandidateSource':str(CANDIDATE),'liveProfileUnchangedDuringTest':baseline_inventory()==live_before,'liveProfileBeforeInventorySHA256':core.inventory_sha(live_before),'baselineProtectedPaths':['mods','config','defaultconfigs','kubejs','resourcepacks'],'baselineIsReadOnlyQARuntime':True,'scriptErrors':script_errors}
 if output.exists():
  try:report['probe']=json.loads(output.read_text('utf-8'))
  except Exception as error:report['resultReadError']=str(error)
 elif (TEST/'kubejs/phase6_native_partial.json').is_file():
  try:
   report['probe']=json.loads((TEST/'kubejs/phase6_native_partial.json').read_text('utf-8'))
   report['probeIsPartial']=True
  except Exception as error:report['partialReadError']=str(error)
 report['executedMirrorUnchangedAfterRun']=same_mirror;report['helperMirrorUnchangedAfterRun']=same_helpers
 report['nativePlanFiles']={}
 for name in ['phase7_outdoor_plan_v104.json','phase7_sanctum_plan_v104.json']:
  plan_file=TEST/'kubejs'/name
  if plan_file.is_file():
   shutil.copy2(plan_file,outdir/name)
   report['nativePlanFiles'][name]={'sha256':sha(plan_file),'bytes':plan_file.stat().st_size}
 report.update(variant=a.variant,variantOmittedCandidatePaths=inputs['variantOmittedCandidatePaths'],variantOmittedRuntimeAbsentInitially=inputs['variantOmittedRuntimeAbsentInitially'],variantOmittedRuntimeAbsentAfterRun=all(not(TEST/r).exists()for r in inputs['variantOmittedCandidatePaths']),variantWorldTransforms=inputs['variantWorldTransforms'])
 report.update(variantWorldResourcesAbsentInitially=inputs['variantWorldResourcesAbsentInitially'],variantWorldResourcesAbsentAfterRun=audit_variant_world_resources(TEST/WORLD,report['variantWorldTransforms'],True))
 report.update(coldRestart=bool(a.restart),isolatedServerPID=proc.pid,startedAtUTC=started_at,bootWorldInventorySHA256=inputs['bootWorldInventorySHA256'],savedWorldInventorySHA256=core.inventory_sha(core.inventory(TEST/WORLD)))
 report['optionalGuidebookLoadErrors']=[line for line in log.splitlines()if "Couldn't parse element loot_tables:simplyswords:grant_book_on_first_join"in line]
 report['passed']=output.is_file()and not report.get('probeIsPartial',False)and code==0 and ready and not timed_out and controller_error is None and same_source and same_candidates and report['liveProfileUnchangedDuringTest'] and same_mirror and same_helpers and report['variantOmittedRuntimeAbsentAfterRun'] and report['variantWorldResourcesAbsentInitially'] and report['variantWorldResourcesAbsentAfterRun'] and not script_errors and not report['optionalGuidebookLoadErrors'] and report.get('probe',{}).get('passed')is True
 (outdir/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps({'passed':report['passed'],'exitCode':code,'checks':len(report.get('probe',{}).get('checks',[])),'errors':report.get('probe',{}).get('errors',[])},ensure_ascii=False),flush=True)
 if not report['passed']:raise RuntimeError('Native phase6 verification failed; preserved result: '+str(outdir/'result.json'))

if __name__=='__main__':
 with exclusive_profile_runner():main()
