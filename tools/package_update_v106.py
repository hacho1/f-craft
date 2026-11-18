"""Package the installed private-use overlay and its verification evidence."""
from pathlib import Path
import argparse, hashlib, json, zipfile

ROOT=Path(__file__).resolve().parents[1]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def require(value,message):
    if not value: raise RuntimeError(message)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--install-label',required=True)
    args=parser.parse_args()
    require(args.install_label.replace('_','').isalnum(),'Unsafe install label')
    proof_path=ROOT/'검증/v10_6_integrated_verification.json';proof=read(proof_path)
    receipt_path=ROOT/'검증/install_v106'/args.install_label/'receipt.json';receipt=read(receipt_path)
    require(proof['passed'] is True and receipt['installed'] is True and receipt['allSavesPreserved'] is True,'Actual verification and install are required')
    require(receipt['candidateHashes']==proof['candidateHashes'],'Different installed product')
    files={}
    for rel,digest in proof['candidateHashes'].items():
        path=ROOT/'수정파일'/rel
        require(sha(path)==digest,'Product changed '+rel)
        files['수정파일/'+rel]=path
    required=[ROOT/'설치_검증_가이드_v10_6.md',ROOT/'LICENSE_RAID_ICONS.txt',proof_path,receipt_path,ROOT/'검증/live_pre_v106_backup.json']
    required += list((ROOT/'원본지시').glob('*.md'))
    required += [Path(item['path']) for item in proof['unitReports']]
    for kind in ['server','client']:
        item=proof[kind];path=Path(item['path'])
        require(sha(path)==item['sha256'],'Execution evidence changed '+kind)
        required.append(path)
    for source in proof['server']['sourceReports']:
        path=Path(source['path']);require(sha(path)==source['sha256'],'Source execution changed');required.append(path)
    required += list((ROOT/'검증/native_client/client_v106_12').glob('*.png'))
    for path in required:
        require(path.resolve().is_relative_to(ROOT.resolve()) and path.is_file(),'Out-of-scope package input')
        files[path.relative_to(ROOT).as_posix()]=path
    files['LICENSE_RAID_BRIDGE.txt']=ROOT/'개별작업/raid_bridge/LICENSE'
    out=ROOT/'배포/F-Craft_v10_6_개인적용패치.zip';out.parent.mkdir(parents=True,exist_ok=True)
    require(not out.exists(),'Preserve previous package')
    before={name:sha(path) for name,path in files.items()}
    with zipfile.ZipFile(out,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for name,path in sorted(files.items()): archive.write(path,'F-Craft_v10_6/'+name)
    with zipfile.ZipFile(out) as archive:
        require(archive.testzip() is None,'Package CRC failure')
        require(len(archive.infolist())==len(files),'Package member count differs')
        for name,path in files.items():
            require(hashlib.sha256(archive.read('F-Craft_v10_6/'+name)).hexdigest()==before[name]==sha(path),'Package entry changed '+name)
    report={'passed':True,'actualMinecraft':False,'kind':'Private-use patch packaging after actual verification and install','path':str(out),'sha256':sha(out),'bytes':out.stat().st_size,'files':len(files),'crcVerified':True,'entryHashesVerified':True,'wholeWorldIncluded':False,'publicRedistributionPermissionImplied':False,'verification':str(proof_path),'installation':str(receipt_path)}
    (ROOT/'검증/package_v106.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__': main()
