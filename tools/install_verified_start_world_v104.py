"""Add the verified clean starter as a new save; never replace an existing world."""
from pathlib import Path
import datetime,hashlib,json,os,shutil,subprocess,sys,zipfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __').resolve()
NAME='FCraft_Start_v10_4'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text('utf-8'))
def inventory(root):
 result={}
 for p in root.rglob('*'):
  assert not p.is_symlink()and not getattr(p,'is_junction',lambda:False)(),'Linked world content is not allowed'
  if p.is_file():result[p.relative_to(root).as_posix()]=sha(p)
 return result
def main():
 apply=read(ROOT/'검증/local_apply_phase7.json');assert apply['passed']and apply['installed']
 assert all((LIVE/r).is_file()and sha(LIVE/r)==h for r,h in apply['files'].items())
 processes=subprocess.run(['powershell','-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter \"Name='java.exe' OR Name='javaw.exe'\" | Select-Object ProcessId,Name | ConvertTo-Json -Compress"],capture_output=True,text=True,check=True)
 assert not processes.stdout.strip(),'Minecraft must be closed before adding the new world'
 proof=read(ROOT/'검증/start_world_package_v104.json');assert proof['passed']and proof['playerFiles']==0
 source=Path(proof['world']).resolve();archive=Path(proof['archive']).resolve()
 assert source.is_relative_to((ROOT/'개발용월드').resolve())and archive.is_relative_to((ROOT/'배포').resolve())
 assert sha(archive)==proof['archiveSHA256']
 expected=inventory(source)
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None
  assert set(z.namelist())=={NAME+'/'+r for r in expected}
  assert all(hashlib.sha256(z.read(NAME+'/'+r)).hexdigest()==h for r,h in expected.items())
 assert len(expected)==proof['files']and not any(r.startswith(('playerdata/','stats/','advancements/'))for r in expected)
 destination=(LIVE/'saves'/NAME).resolve();staging=(LIVE/'saves'/('.'+NAME+'.installing_phase7')).resolve()
 for target in[destination,staging]:
  assert target.is_relative_to(LIVE/'saves')and target.parent==LIVE/'saves'
  assert not target.exists()and not target.is_symlink(),'Preserve all existing saves and staging content'
  for p in target.parents:
   assert not p.is_symlink()and not getattr(p,'is_junction',lambda:False)()
   if p==LIVE:break
 backup=read(ROOT/'검증/backup_phase7.json');old_saves={r:v for r,v in backup['files'].items()if r.startswith('saves/')}
 assert all((LIVE/r).is_file()and sha(LIVE/r)==v['sha256']for r,v in old_saves.items())
 shutil.copytree(source,staging);assert inventory(staging)==expected
 os.replace(staging,destination)
 assert inventory(destination)==expected and inventory(source)==expected
 assert all((LIVE/r).is_file()and sha(LIVE/r)==v['sha256']for r,v in old_saves.items())
 report={'passed':True,'installed':True,'createdAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'newWorldName':NAME,'newWorldPath':str(destination),'files':len(expected),'sourceInventorySHA256':proof['inventorySHA256'],'allNewWorldFilesMatchVerifiedPackage':True,'oldSaveFilesPreserved':len(old_saves),'overwroteExistingWorld':False,'playerDataCopied':False,'filesSHA256':expected}
 receipt=ROOT/'검증/new_start_world_apply_v104.json';assert not receipt.exists()
 receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps({k:v for k,v in report.items()if k!='filesSHA256'},ensure_ascii=False))
if __name__=='__main__':main()
