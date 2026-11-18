from pathlib import Path
import os, sys, json, hashlib, zipfile, datetime
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __').resolve()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    target=ROOT/'백업/작업전_월드_모드_설정_전체.zip'
    if target.exists():raise RuntimeError('Preserve existing backup')
    files={}
    def fail(error):raise error
    for scope in ['saves','mods','kubejs','config','defaultconfigs','resourcepacks']:
        base=LIVE/scope
        if not base.exists():continue
        for directory, dirs, names in os.walk(base,followlinks=False,onerror=fail):
            if any((Path(directory)/d).is_symlink() for d in dirs):raise RuntimeError('Linked source directory')
            for name in names:
                p=Path(directory)/name
                if p.is_symlink() or not p.resolve().is_relative_to(LIVE):raise RuntimeError('Linked source file')
                files[p.relative_to(LIVE).as_posix()]=p
    for name in ['options.txt','modpack_manifest_1.20.1_forge.json']:
        if (LIVE/name).is_file():files[name]=LIVE/name
    before={rel:{'bytes':p.stat().st_size,'sha256':sha(p)}for rel,p in sorted(files.items())}
    print(json.dumps({'stage':'inventoried','files':len(before),'bytes':sum(v['bytes']for v in before.values())}),flush=True)
    target.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(target,'x',zipfile.ZIP_DEFLATED)as z:
        for rel,p in sorted(files.items()):z.write(p,rel)
    with zipfile.ZipFile(target)as z:
        assert z.testzip()is None and set(z.namelist())==set(before)
        for rel,meta in before.items():
            data=z.read(rel)
            assert len(data)==meta['bytes']and hashlib.sha256(data).hexdigest()==meta['sha256']
            assert sha(files[rel])==meta['sha256'],rel
    receipt={'passed':True,'createdAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'archive':target.relative_to(ROOT).as_posix(),'bytes':target.stat().st_size,'sha256':sha(target),'fileCount':len(before),'worldCount':sum(1 for rel in before if rel.startswith('saves/')and rel.endswith('/level.dat')),'modCount':sum(1 for rel in before if rel.startswith('mods/')and rel.endswith('.jar')),'crcVerified':True,'eachEntrySHA256Verified':True,'sourceUnchanged':True,'files':before}
    (ROOT/'검증').mkdir(exist_ok=True)
    (ROOT/'검증/backup_phase7.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in receipt.items()if k!='files'}),flush=True)
if __name__=='__main__':main()
