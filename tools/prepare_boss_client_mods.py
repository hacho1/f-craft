"""Audit pinned official Forge client artifacts, without starting a JVM."""
from pathlib import Path
import sys,json,zipfile,hashlib,tomllib,shutil
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'수정파일';LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __')
sys.path.insert(0,str(ROOT.parent/'F-Craft_6차_1장성장마감/개별작업/ui'))
from inspect_client_classes import Class
def sha(b):return hashlib.sha256(b).hexdigest()
rows=[('Boss Intros','vitral_bossintros','bossintros-forge-mc1.20.1-0.1.4.jar',1715262,9520539,'boss-intros-cinematic-boss-titles-entrances','d4683fc9de75f8799fe124d542dc7ea838f33e3581f66323597adb74665d9fc3'),('Boss Bars','vitral_bossbars','bossbars-forge-mc1.20.1-0.1.4.jar',1751567,9486187,'boss-bars-animated-health-bars-for-every-boss','1bfd0fbbbe4ac04f4d6fb9a22b25bb503c40c0992da68739d194c091d05785d2')]
records=[];api={}
for name,modid,file,project,fid,slug,expected in rows:
 raw=(P/'mods'/file).read_bytes();assert sha(raw)==expected;z=zipfile.ZipFile(P/'mods'/file);assert z.testzip() is None
 metadata=tomllib.loads(z.read('META-INF/mods.toml').decode());assert metadata['mods'][0]['modId']==modid and metadata['mods'][0]['version']=='0.1.4' and metadata['license']=='MIT'
 deps=metadata['dependencies'][modid];assert {r['modId'] for r in deps}=={'minecraft','forge'} and all(r['side']=='CLIENT' for r in deps)
 lic=z.read('LICENSE_'+modid).decode();assert 'MIT License' in lic and 'Vitral' in lic
 assert all(int.from_bytes(z.read(n)[6:8],'big')<=61 for n in z.namelist() if n.endswith('.class'))
 records.append({'name':name,'mod_id':modid,'version':'0.1.4','file':file,'bytes':len(raw),'sha256':sha(raw),'project_id':project,'file_id':fid,'official_file_page':f'https://www.curseforge.com/minecraft/mc-mods/{slug}/files/{fid}','official_download_url':f'https://mediafilez.forgecdn.net/files/{str(fid)[:-3]}/{str(fid)[-3:]}/{file}','license':'MIT','licenseMember':'LICENSE_'+modid,'licenseSHA256':sha(lic.encode()),'side':'CLIENT','minecraft':'[1.20.1,1.20.2)','forge':'[47,)','extraDependencies':[],'crcAllMembersValid':True,'classMajorMaximum':61,'approval':'Official Forge 1.20.1 artifact, compatible version/dependencies and MIT redistribution confirmed; runtime validation remains ROOT-owned.'})
 if modid=='vitral_bossintros':
  for n in ['dev/vitral/bossintros/BossIntros.class','dev/vitral/bossintros/BossIntros$Card.class']:
   c=Class(z.read(n));api[n]={'fields':[{k:v for k,v in f.items() if k!='attributes'} for f in c.fields],'methods':[{k:v for k,v in m.items() if k!='attributes'} for m in c.methods]}
  c=Class(z.read('dev/vitral/bossintros/BossIntros.class'));assert any(m['name']=='reported' and m['descriptor']=='(Ljava/util/UUID;F)V' and m['flags']==9 for m in c.methods)
 else:
  c=Class(z.read('dev/vitral/bossbars/Settings.class'));strings=[c.ref(i) for i,v in enumerate(c.cp) if v and v[0]==8];assert 'vitral_bossbars.properties' in strings and 'modded_bosses' in strings
  api['BossBarsSettings']={'path':'config/vitral_bossbars.properties','key':'modded_bosses','selected':'own_animated','actualLoadAndSaveMethods':True,'classSHA256':sha(z.read('dev/vitral/bossbars/Settings.class'))}
config=P/'config/vitral_bossbars.properties';config.parent.mkdir(parents=True,exist_ok=True);config.write_text('# Real Boss Bars 0.1.4 option: keep each boss mod art, add native animations.\nmodded_bosses=own_animated\n',encoding='utf8')
manifest=json.loads((LIVE/'modpack_manifest_1.20.1_forge.json').read_text(encoding='utf8'));manifest['manifest_version']='10.2.0-phase7-private';manifest['project']='《F-Craft》 1장 3단계 보스 · 수호자 무구'
for row in records:
 assert not any(x.get('mod_id')==row['mod_id'] for x in manifest['pinned_required_mods'])
 manifest['pinned_required_mods'].append({'category':'CLIENT_BOSS_PRESENTATION','name':row['name'],'mod_id':row['mod_id'],'pinned_file':row['file'],'observed_version':row['version'],'url':row['official_file_page'],'sha256':row['sha256'],'side':'CLIENT','required_dependencies':[]})
manifest['phase7']={'clientBossMods':records,'actualMinecraft':False,'notes':['Wrong NeoForge1.21.1/Fabric26.3 file links in source spec replaced by official Forge1.20.1 artifacts.','Native mod ID aliases include vitral_bossintros to suppress KubeJS duplicate intro and victory.','No server dependency on these cosmetic client mods.','Existing mods retained; user portraits/UI backgrounds untouched.']}
(P/'modpack_manifest_1.20.1_forge.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
report={'actualMinecraft':False,'javaExecuted':False,'graphToolAvailable':False,'graphCoverage':0,'structuralEvidence':'Exact installed/local downloaded JAR classfile and source reads; graph service unavailable, no graph coverage claimed.','mods':records,'apiEvidence':api,'nativeRisks':{'introNativeMilliseconds':4200,'victoryNativeMilliseconds':3800,'leaveAtFivePercentMayTriggerNativeVictory':True,'nameUpdateTriggersIntroAgain':False,'mitigations':'Client bridge bounds only raid UUID-associated native letterbox card to2500ms and reset-before-remove primes public reported(UUID,1F); ROOT runtime tests required.'}}
(ROOT/'검증/client_mods_v132.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'passed':True,'mods':len(records),'javaExecuted':False,'actualMinecraft':False}))
