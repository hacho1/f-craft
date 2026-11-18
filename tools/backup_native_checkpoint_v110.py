"""Preserve an owned, stopped QA world after a complete passing native run."""
from pathlib import Path
import argparse,hashlib,importlib.util,json,re,shutil,subprocess

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('_v110_native_checkpoint',ROOT/'run_native_v110.py')
native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)

def require(ok,message):
    if not ok:raise RuntimeError(message)

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--label',required=True);a=parser.parse_args()
    require(re.fullmatch('[A-Za-z0-9_]{1,80}',a.label),'Unsafe label')
    p=ROOT/'검증/native'/a.label/'result.json';r=json.loads(p.read_text(encoding='utf-8'))
    require(r.get('passed')is True and r.get('actualMinecraft')is True and r.get('exitCode')==0 and not r.get('coldRestart'),'Use the completed full passing native run')
    require({'promotions','mainland110','mount110','claims110'}.issubset(set(r['probe']['completedSuites'])),'The full integration checkpoint is required')
    ps=subprocess.run(['powershell','-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter \"Name='javaw.exe' OR Name='java.exe'\" | Select-Object ProcessId,Name | ConvertTo-Json -Compress"],capture_output=True,text=True,check=True)
    require(not ps.stdout.strip(),'Preserve a checkpoint only while all game JVMs are stopped')
    source=(native.TEST/native.WORLD).resolve();owned=(ROOT/'테스트프로필/server').resolve()
    require(source==owned/native.WORLD and source.is_relative_to(owned),'Only the exact disposable native world is allowed')
    require(not source.is_symlink() and not source.is_junction(),'Linked world rejected')
    require(all(not q.is_symlink() and not q.is_junction()for q in source.rglob('*')),'Linked QA data rejected')
    inv=native.core.inventory(source);digest=native.core.inventory_sha(inv)
    require(digest==r['savedWorldInventorySHA256'],'World changed after the completed native result')
    folder=ROOT/'검증/native_checkpoints'/a.label;require(not folder.exists(),'Preserve existing checkpoint')
    folder.mkdir(parents=True);target=folder/'world';shutil.copytree(source,target)
    require(native.core.inventory(source)==inv==native.core.inventory(target),'Checkpoint byte comparison failed')
    provenance=native.TEST/'.native_world_source.json';shutil.copy2(provenance,folder/provenance.name)
    report={'passed':True,'actualMinecraft':False,'qaOnly':True,'kind':'Exact immutable saved runtime checkpoint after actual passing native integration; no LIVE file writes','nativeResult':str(p),'nativeResultSHA256':sha(p),'source':str(source),'snapshot':str(target),'inventorySHA256':digest,'files':len(inv),'bytes':sum(v['bytes']for v in inv.values()),'runtimeWorldUnchangedDuringBackup':True,'provenanceSHA256':sha(provenance)}
    (folder/'receipt.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
