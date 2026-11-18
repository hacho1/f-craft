"""Private-use patch: verified product, instructions, licenses and final evidence only."""
from pathlib import Path
import argparse,hashlib,json,zipfile

ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def require(v,msg):
 if not v:raise RuntimeError(msg)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--install-label',required=True);a=ap.parse_args();require(a.install_label.replace('_','').isalnum(),'Unsafe install label')
 proof_path=ROOT/'검증/v11_0_integrated_verification.json';proof=read(proof_path)
 receipt_path=ROOT/'검증/install_v110'/a.install_label/'receipt.json';receipt=read(receipt_path)
 require(proof['passed']is True and proof['actualMinecraft']is True and receipt['installed']is True and receipt['allSavesPreserved']is True,'Exact native verification and actual installation are required')
 require(proof['candidateHashes']==receipt['candidateHashes'],'Installed artifact differs')
 files={}
 def add(p):
  p=Path(p).resolve();require(p.is_relative_to(ROOT.resolve())and p.is_file(),'Invalid package input '+str(p));files[p.relative_to(ROOT).as_posix()]=p
 for rel,digest in proof['candidateHashes'].items():
  p=ROOT/'수정파일'/rel;require(p.is_file()and sha(p)==digest,'Product changed '+rel);add(p)
 for p in [proof_path,receipt_path,ROOT/'설치_검증_가이드_v11_0.md',ROOT/'LICENSE_RAID_ICONS.txt',ROOT/'검증/live_pre_v110_backup.json']:
  add(p)
 for p in (ROOT/'원본지시').glob('*'):
  if p.is_file():add(p)
 for key in ['server','client']:
  data=proof[key];p=Path(data['path']);require(sha(p)==data['sha256'],'Execution evidence changed');add(p)
  if key=='server':
   for row in data['sourceReports']:
    p=Path(row['path']);require(sha(p)==row['sha256'],'Source execution changed');add(p)
 for row in proof['unitReports']+proof['actualClientScreenshots']:
  p=Path(row['path']);require(sha(p)==row['sha256'],'Evidence changed '+str(p));add(p)
 for rel in ['개별작업/assets_v110/generated_book_provenance_v110.json','개별작업/assets_v110/README_아이콘_원화대조.md','개별작업/assets_v110/FINAL_33_리소스_콘택트시트_v110.png','검증/v11_0_world_coordinates.json']:
  add(ROOT/rel)
 out=ROOT/'배포/F-Craft_v11_0_개인적용패치.zip';require(not out.exists(),'Preserve prior package');out.parent.mkdir(exist_ok=True)
 hashes={k:sha(p)for k,p in files.items()}
 with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for rel,p in sorted(files.items()):z.write(p,'F-Craft_v11_0/'+rel)
 with zipfile.ZipFile(out)as z:
  require(z.testzip()is None,'Archive CRC failure');require(len(z.infolist())==len(files),'Archive count mismatch')
  for rel,p in files.items():require(hashlib.sha256(z.read('F-Craft_v11_0/'+rel)).hexdigest()==hashes[rel]==sha(p),'Archive byte mismatch '+rel)
 result={'passed':True,'actualMinecraft':False,'kind':'Private-use package after exact actual server/client verification and installation','path':str(out),'sha256':sha(out),'bytes':out.stat().st_size,'files':len(files),'crcVerified':True,'entryHashesVerified':True,'wholeWorldIncluded':False,'playerSavesIncluded':False,'fullBackupIncluded':False,'publicRedistributionPermissionImplied':False,'verification':str(proof_path),'installation':str(receipt_path)}
 (ROOT/'검증/package_v110.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
