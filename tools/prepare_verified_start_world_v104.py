"""Copy the real clean construction save; restore source gameplay rules without touching terrain."""
from pathlib import Path
import copy,gzip,hashlib,json,shutil,sys,zipfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'F-Craft_v9_9_본토보스확장/tools'))
from typed_nbt import Tag,load_nbt,encode_root

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def inventory(root):return {p.relative_to(root).as_posix():sha(p)for p in root.rglob('*')if p.is_file()}
def digest(rows):return hashlib.sha256(json.dumps(rows,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
def read(p):return json.loads(p.read_text('utf-8'))

def main():
 receipt=read(ROOT/'검증/clean_constructed_world_v104.json')
 native=read(ROOT/receipt['nativeSource'])
 attribution=read(ROOT/'검증/native/arena_v104_06/controlled_construction_attribution.json')
 assert receipt['passed']and native['passed']and native['actualMinecraft']and attribution['passed']
 clean=Path(receipt['world']).resolve();original=(ROOT/'개발용월드/F-Craft_7차_시작월드').resolve()
 assert clean.is_relative_to(ROOT/'개발용월드')and original.is_relative_to(ROOT/'개발용월드')
 before=inventory(clean);original_before=inventory(original)
 # Reuse the runner's exact inventory digest definition from the saved receipt.
 sys.path.insert(0,str(ROOT));import run_native_phase7 as runner
 assert runner.core.inventory_sha(runner.core.inventory(clean))==receipt['inventorySHA256'],'Clean verification source changed'
 destination=ROOT/'개발용월드/FCraft_Start_v10_4';archive=ROOT/'배포/F-Craft_v10.4_개인용_시작월드.zip'
 assert not destination.exists()and not archive.exists(),'Keep prior outputs; do not overwrite'
 assert not list(clean.glob('playerdata/*.dat'))and not list(clean.glob('playerdata/*.dat_old')),'LAB players must not enter the starter'
 clean_name,clean_tag=load_nbt(clean/'level.dat');source_name,source_tag=load_nbt(original/'level.dat')
 updated=copy.deepcopy(clean_tag);data=updated.value['Data'].value
 data['GameRules']=copy.deepcopy(source_tag.value['Data'].value['GameRules'])
 data['LevelName']=Tag(8,'F-Craft v10.4 · 브리온과 세르딘')
 shutil.copytree(clean,destination,ignore=shutil.ignore_patterns('session.lock'))
 (destination/'level.dat').write_bytes(gzip.compress(encode_root(clean_name,updated),mtime=0))
 _,roundtrip=load_nbt(destination/'level.dat');assert roundtrip==updated
 preserved=copy.deepcopy(updated);preserved.value['Data'].value['GameRules']=copy.deepcopy(clean_tag.value['Data'].value['GameRules']);preserved.value['Data'].value['LevelName']=copy.deepcopy(clean_tag.value['Data'].value['LevelName'])
 assert preserved==clean_tag,'Only LevelName and source GameRules may change'
 after=inventory(destination);changed=[r for r,h in before.items()if r!='session.lock'and after.get(r)!=h]
 assert changed==['level.dat']or set(changed)=={'level.dat'}
 assert set(after)==set(before)-{'session.lock'}
 assert inventory(clean)==before and inventory(original)==original_before
 archive.parent.mkdir(exist_ok=True)
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for rel in sorted(after):z.write(destination/rel,'FCraft_Start_v10_4/'+rel)
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None
  assert all(hashlib.sha256(z.read('FCraft_Start_v10_4/'+r)).hexdigest()==h for r,h in after.items())
 report={'passed':True,'actualMinecraftConstruction':True,'humanPlay':False,'world':str(destination),'archive':str(archive),'archiveBytes':archive.stat().st_size,'archiveSHA256':sha(archive),'files':len(after),'inventorySHA256':runner.core.inventory_sha(runner.core.inventory(destination)),'source':str(clean),'sourceInventorySHA256':receipt['inventorySHA256'],'sourceWorldUnchanged':True,'originalWorldUnchanged':True,'allTerrainAndEntityFilesByteIdenticalToVerifiedConstruction':True,'changedFiles':changed,'levelDatChangedKeys':['Data.GameRules','Data.LevelName'],'gameRulesRestoredFromOriginal':{k:v.value for k,v in data['GameRules'].value.items()},'playerFiles':0,'sourceNativeEvidence':receipt['nativeSource'],'constructionAttributionEvidence':'검증/native/arena_v104_06/controlled_construction_attribution.json','privateUseOnly':True}
 (ROOT/'검증/start_world_package_v104.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps({k:v for k,v in report.items()if k!='gameRulesRestoredFromOriginal'},ensure_ascii=False))

if __name__=='__main__':main()
