"""Guarded local application: final native/client proofs and original backups required."""
from pathlib import Path
import argparse,datetime,hashlib,json,os,re,shutil,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[1]
LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __').resolve()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text('utf-8'))
def inventory(root):return {p.relative_to(root).as_posix():sha(p)for p in root.rglob('*')if p.is_file()}
def safe(rel):
 assert '\\'not in rel and '..'not in Path(rel).parts and not Path(rel).is_absolute()
 assert rel.startswith(('kubejs/','config/','defaultconfigs/','mods/','resourcepacks/'))or rel=='modpack_manifest_1.20.1_forge.json'
 target=LIVE/rel;assert target.resolve().is_relative_to(LIVE)
 for p in [target]+list(target.parents):
  if p==LIVE:break
  assert not p.is_symlink()and not(p.exists()and getattr(p,'is_junction',lambda:False)())
 return target
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--apply',action='store_true');ap.add_argument('--native-label',required=True);ap.add_argument('--client-label',required=True);a=ap.parse_args()
 assert all(re.fullmatch(r'[A-Za-z0-9_-]+',label)for label in[a.native_label,a.client_label]),'Invalid verification label'
 snapshot=ROOT/'검증/native_inputs'/a.native_label/'수정파일';candidate=inventory(snapshot)
 assert candidate and inventory(ROOT/'수정파일')==candidate,'Final frozen candidate differs from current product'
 native=read(ROOT/'검증/native'/a.native_label/'result.json');client=read(ROOT/'검증/native_client'/a.client_label/'result.json')
 aggregate=read(ROOT/'검증/v10_2_chapter1_boss_and_gear_verification.json')
 arenas=read(ROOT/'검증/v10_4_portal_sanctum_and_boss_raid_verification.json')
 assert native['passed']and native['actualMinecraft']and native['serverReady']and native['probe']['passed']
 assert client['passed']and client['actualMinecraft']and client['connectedClient']and not client['physicalInputUsed']
 assert native['codeHashes']==candidate==client['candidateHashes'],'Native and client did not run the exact final candidate'
 assert aggregate['passed'],'Mandatory aggregate verification must actually exit successfully before application'
 assert arenas['passed']and arenas['actualMinecraft'],'Native arena construction and saved-world comparison must pass before application'
 check=subprocess.run(['powershell','-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' OR Name='java.exe'\" | Select-Object ProcessId,Name | ConvertTo-Json -Compress"],capture_output=True,text=True,check=True)
 assert not check.stdout.strip(),'Minecraft/Java must be fully closed before replacing the profile'
 backup=read(ROOT/'검증/backup_phase7.json');archive=ROOT/backup['archive'];assert backup['passed']and sha(archive)==backup['sha256']
 original=backup['files'];changed=[]
 for rel,row in original.items():
  p=LIVE/rel
  if not p.is_file()or p.stat().st_size!=row['bytes']or sha(p)!=row['sha256']:changed.append(rel)
 assert not changed,'Original profile changed since the verified backup: '+str(changed[:8])
 for rel in candidate:
  target=safe(rel)
  assert rel in original or not target.exists(),'An unbacked-up file now occupies '+rel
  assert '/tests/'not in rel and not Path(rel).name.startswith(('79_','80_','89_','90_','91_','92_','95_ui','98_ui','99_ui'))
 report={'passed':True,'installed':False,'dryRun':not a.apply,'createdAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nativeLabel':a.native_label,'clientLabel':a.client_label,'files':candidate,'verifiedFullBackupSHA256':backup['sha256'],'nativeChecks':len(native['probe']['checks']),'clientChecks':len(client['checks']),'preservedSaves':True,'replacedFiles':len(set(candidate)&set(original)),'newFiles':len(set(candidate)-set(original))}
 if not a.apply:
  (ROOT/'검증/install_preflight_phase7.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');print(json.dumps({k:v for k,v in report.items()if k!='files'},ensure_ascii=False));return
 receipt=ROOT/'검증/local_apply_phase7.json';preimage=ROOT/'백업/최종적용직전_교체파일.zip'
 assert not receipt.exists()and not preimage.exists(),'Preserve previous application receipts'
 with zipfile.ZipFile(preimage,'w',zipfile.ZIP_DEFLATED)as z:
  for rel in sorted(set(candidate)&set(original)):z.write(safe(rel),rel)
 with zipfile.ZipFile(preimage)as z:
  assert z.testzip()is None
  for rel in z.namelist():assert hashlib.sha256(z.read(rel)).hexdigest()==original[rel]['sha256']
 applied=[]
 try:
  for rel,h in sorted(candidate.items()):
   p=safe(rel);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.fcraft_phase7_tmp');assert not tmp.exists()
   shutil.copy2(snapshot/rel,tmp);assert sha(tmp)==h;os.replace(tmp,p);applied.append(rel)
  assert all(sha(safe(r))==h for r,h in candidate.items())
  unaffected={r:row for r,row in original.items()if r not in candidate}
  assert all((LIVE/r).is_file()and sha(LIVE/r)==row['sha256']for r,row in unaffected.items())
  report.update(installed=True,dryRun=False,unaffectedFilesVerified=len(unaffected),preimageArchiveSHA256=sha(preimage))
 except BaseException as error:
  report.update(passed=False,error=repr(error),rolledBack=[])
  with zipfile.ZipFile(preimage)as z:
   for rel in reversed(applied):
    p=safe(rel)
    if not p.is_file()or sha(p)!=candidate[rel]:continue
    if rel in original:p.write_bytes(z.read(rel))
    else:p.unlink()
    report['rolledBack'].append(rel)
  receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');raise
 receipt.write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');print(json.dumps({k:v for k,v in report.items()if k!='files'},ensure_ascii=False))
if __name__=='__main__':main()
