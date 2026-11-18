"""Package only the exact installed and independently verified private update."""
from pathlib import Path
import argparse,datetime,hashlib,json,re,sys,zipfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text('utf-8'))
def files(root):return {p.relative_to(root).as_posix():sha(p)for p in root.rglob('*')if p.is_file()}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--native-label',required=True);ap.add_argument('--client-label',required=True);a=ap.parse_args()
 assert all(re.fullmatch('[A-Za-z0-9_]+',x)for x in[a.native_label,a.client_label])
 candidate=ROOT/'검증/native_inputs'/a.native_label/'수정파일';inventory=files(candidate)
 native=read(ROOT/'검증/native'/a.native_label/'result.json');client=read(ROOT/'검증/native_client'/a.client_label/'result.json');visual=read(ROOT/'검증/native_client'/a.client_label/'visual_review.json')
 aggregate=read(ROOT/'검증/v10_4_portal_sanctum_and_boss_raid_verification.json');installed=read(ROOT/'검증/local_apply_phase7.json')
 world=read(ROOT/'검증/start_world_package_v104.json');world_apply=read(ROOT/'검증/new_start_world_apply_v104.json');preservation=read(ROOT/'검증/native/arena_v104_06/controlled_construction_attribution.json')
 assert native['passed']and native['actualMinecraft']and client['passed']and client['actualMinecraft']and client['connectedClient']and not client['physicalInputUsed']and not client.get('projectResourceErrors')and visual['passed']
 assert aggregate['passed']and installed['passed']and installed['installed']and world['passed']and preservation['passed']and world_apply['passed']and world_apply['installed']and not world_apply['overwroteExistingWorld']
 assert files(ROOT/'수정파일')==inventory==native['codeHashes']==client['candidateHashes']==installed['files']
 assert sha(Path(world['archive']))==world['archiveSHA256']
 for rel in inventory:
  assert '..'not in Path(rel).parts and not Path(rel).is_absolute()and not rel.startswith(('saves/','logs/'))
  assert not Path(rel).name.startswith(('90_','91_','92_','93_','94_','95_ui','98_ui','99_ui'))
 summary={'version':'F-Craft v10.4','createdAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'actualMinecraftServer':True,'actualHiddenClient':True,'humanPlay':False,'physicalInputUsed':False,'nativeLabel':a.native_label,'clientLabel':a.client_label,'nativeChecks':len(native['probe']['checks']),'clientChecks':len(client['checks']),'candidateFiles':len(inventory),'existingSavesPreserved':True,'constructionPreservationScope':'No unexplained construction changes; original-byte comparison includes natural runtime differences and is not a literal byte-equality PASS.','privateUseOnly':True,'sourceMapPublicRedistributionPermission':'unconfirmed','starterWorldArchiveSHA256':world['archiveSHA256'],'files':inventory}
 safe_summary=ROOT/'배포/F-Craft_v10.4_적용_검증_결과.json';safe_summary.parent.mkdir(exist_ok=True)
 summary.update(newStartWorldInstalled=world_apply['newWorldName'],oldSavesUnchanged=True)
 safe_summary.write_text(json.dumps(summary,ensure_ascii=False,indent=2),'utf-8')
 archive=ROOT/'배포/F-Craft_v10.4_개인용_업데이트.zip';assert not archive.exists(),'Preserve previous package'
 entries={'수정파일/'+r:candidate/r for r in inventory}
 entries.update({'설치_검증_가이드.md':ROOT/'설치_검증_가이드.md','F-Craft_v10.4_적용_검증_결과.json':safe_summary,'원본지시/f_craft_3_31.md':ROOT/'원본지시/f_craft_3_31.md'})
 expected={r:sha(p)for r,p in entries.items()}
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for rel,p in sorted(entries.items()):z.write(p,rel)
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None and set(z.namelist())==set(expected)
  assert all(hashlib.sha256(z.read(r)).hexdigest()==h for r,h in expected.items())
 report={'passed':True,'archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive),'entries':len(entries),'candidateFiles':len(inventory),'files':expected,'privateUseOnly':True,'nativeLabel':a.native_label,'clientLabel':a.client_label}
 (ROOT/'검증/update_package_v104.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
 evidence_archive=ROOT/'배포/F-Craft_v10.4_개발_검증자료.zip';assert not evidence_archive.exists()
 evidence_paths=['설치_검증_가이드.md','원본지시/f_craft_3_31.md','검증/v10_2_chapter1_boss_and_gear_verification.json','검증/v10_4_portal_sanctum_and_boss_raid_verification.json','검증/clean_constructed_world_v104.json','검증/start_world_package_v104.json','검증/local_apply_phase7.json','검증/bridge_packmeta_only_v104.json','검증/raid_bridge_build.json','검증/native/arena_v104_06/result.json','검증/native/arena_v104_06/anvil_comparison.json','검증/native/arena_v104_06/controlled_construction_attribution.json','검증/native/arena_v104_06/construction_augmented_v104_controlled.json','검증/native/'+a.native_label+'/result.json','검증/native_client/'+a.client_label+'/result.json']
 evidence={r:ROOT/r for r in evidence_paths};evidence['검증/new_start_world_apply_v104.json']=ROOT/'검증/new_start_world_apply_v104.json';evidence['검증/native_client/'+a.client_label+'/visual_review.json']=ROOT/'검증/native_client'/a.client_label/'visual_review.json';evidence['적용_검증_결과.json']=safe_summary
 for rel in ['run_native_phase7.py','개별작업/ui_qa/run_hidden_ui_phase7.py','개별작업/ui_qa/95_ui_server_phase7.js','개별작업/ui_qa/98_ui_tick_phase7.js','개별작업/ui_qa/99_ui_client_phase7.js']:
  evidence[rel]=ROOT/rel
 for base in[ROOT/'개별작업/raid_bridge/src',ROOT/'tests',ROOT/'tools']:
  for p in base.rglob('*'):
   if p.is_file()and p.suffix in['.java','.js','.cjs','.py','.json','.toml','.mcmeta']:evidence[p.relative_to(ROOT).as_posix()]=p
 for p in (ROOT/'검증/native_client'/a.client_label).glob('*.png'):evidence[p.relative_to(ROOT).as_posix()]=p
 evidence['개별작업/raid_bridge/LICENSE']=ROOT/'개별작업/raid_bridge/LICENSE'
 assert all(p.is_file()for p in evidence.values())
 evidence_hashes={r:sha(p)for r,p in evidence.items()}
 with zipfile.ZipFile(evidence_archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for rel,p in sorted(evidence.items()):z.write(p,rel)
 with zipfile.ZipFile(evidence_archive)as z:
  assert z.testzip()is None and set(z.namelist())==set(evidence_hashes)
  assert all(hashlib.sha256(z.read(r)).hexdigest()==h for r,h in evidence_hashes.items())
 (ROOT/'검증/evidence_package_v104.json').write_text(json.dumps({'passed':True,'archive':str(evidence_archive),'bytes':evidence_archive.stat().st_size,'sha256':sha(evidence_archive),'entries':len(evidence),'files':evidence_hashes,'privateUseOnly':True,'containsRawPlayerSaves':False,'containsRawFullBackup':False},ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps({k:v for k,v in report.items()if k!='files'},ensure_ascii=False))
if __name__=='__main__':main()
