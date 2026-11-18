"""Apply only the metadata-only promotion JAR fix and its manifest checksum."""
from pathlib import Path
import argparse, datetime, hashlib, importlib.util, io, json, os, re, shutil, zipfile

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('verified_install_core',ROOT/'tools/install_update_v106.py')
I=importlib.util.module_from_spec(spec);spec.loader.exec_module(I)
LIVE=I.LIVE
JAR='mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'
MANIFEST='modpack_manifest_1.20.1_forge.json'
OLD='005e9292c51625bbd96d853067e39fe3dda0ac33f59ab62a0cd921a35e521c3d'
NEW='492b635acd184c356b448c1a178e89e057cf70a2383ebe979358ddb6c99ce91d'

def main():
    p=argparse.ArgumentParser();p.add_argument('--smoke',type=Path,required=True);p.add_argument('--apply',action='store_true');p.add_argument('--label',required=True)
    a=p.parse_args();I.require(re.fullmatch('[A-Za-z0-9_]{1,80}',a.label),'Unsafe label')
    I.CORE.identity();I.CORE.require_idle();I.CORE.no_links(a.smoke,ROOT)
    smoke=I.read(a.smoke)
    I.require(smoke.get('passed') is True and smoke.get('actualMinecraft') is True and smoke.get('actualClient') is True,'Actual client startup must pass')
    I.require(smoke.get('reachedTitleScreen') is True and smoke.get('warnings')==[] and smoke.get('errors')==[],'Startup warning or error remains')
    I.require(smoke.get('sourceJarSHA256')==NEW,'Startup tested another JAR')
    source=ROOT/'수정파일'
    for rel in [JAR,MANIFEST]:I.CORE.no_links(source/rel,source)
    fixed={rel:(source/rel).read_bytes() for rel in [JAR,MANIFEST]}
    fixed_hashes={rel:hashlib.sha256(data).hexdigest() for rel,data in fixed.items()}
    I.require(fixed_hashes[JAR]==NEW and I.sha(LIVE/JAR)==OLD,'Unexpected source or installed bridge')
    with zipfile.ZipFile(LIVE/JAR) as before_jar,zipfile.ZipFile(io.BytesIO(fixed[JAR])) as after_jar:
        old=set(before_jar.namelist());new=set(after_jar.namelist())
        I.require(new-old=={'pack.mcmeta'} and not old-new,'Unexpected JAR entry change')
        I.require(all(before_jar.read(name)==after_jar.read(name) for name in old),'Executable or existing resource changed')
        meta=json.loads(after_jar.read('pack.mcmeta'))
        I.require(meta['pack']['pack_format']==15 and bool(meta['pack']['description']),'Invalid Java1.20.1 pack metadata')
        I.require(after_jar.testzip() is None,'Invalid fixed JAR')
    live_manifest=(LIVE/MANIFEST).read_bytes();live_manifest_sha=hashlib.sha256(live_manifest).hexdigest()
    previous=json.loads(live_manifest.decode('utf-8-sig'));current=json.loads(fixed[MANIFEST].decode('utf-8-sig'))
    expected=json.loads(json.dumps(previous));expected['phase9']['promotionBridge']['sha256']=NEW;expected['phase9']['promotionBridge']['bytes']=len(fixed[JAR])
    I.require(I.canonical_json(current)==I.canonical_json(expected),'Manifest contains an unrelated change')
    candidate=I.product();baseline=I.read(ROOT/'검증/v10_6_integrated_verification.json')
    I.require(all(candidate[rel]==fixed_hashes[rel] for rel in fixed),'Source changed during capture')
    I.require(baseline.get('passed') is True and baseline.get('actualMinecraft') is True,'Previous behavior verification must pass')
    tested=baseline['candidateHashes']
    I.require(sorted(key for key in set(tested)|set(candidate) if tested.get(key)!=candidate.get(key))==sorted([JAR,MANIFEST]),'Unreviewed product delta from the tested build')
    I.require(tested[JAR]==OLD,'Previous behavior verification used another bridge')
    directory=ROOT/'검증/promotion_pack_metadata_install'/a.label
    I.require(not directory.exists(),'Preserve previous hotfix receipt');directory.mkdir(parents=True)
    before=I.CORE.full_inventory(LIVE);metadata=(LIVE/'minecraftinstance.json').read_bytes()
    I.require(before[JAR]['sha256']==OLD and before[MANIFEST]['sha256']==live_manifest_sha,'Installed inputs changed during validation')
    I.require(hashlib.sha256(metadata).hexdigest()==before['minecraftinstance.json']['sha256'],'Launcher metadata moved during capture')
    (directory/'minecraftinstance_preimage.json').write_bytes(metadata)
    rows=[]
    for rel in [JAR,MANIFEST]:
        target=I.target(rel);saved=directory/'before'/rel;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,saved)
        I.require(I.sha(saved)==before[rel]['sha256'],'Backup differs')
        rows.append({'path':rel,'before':before[rel],'after':{'sha256':fixed_hashes[rel],'bytes':len(fixed[rel])}})
    report={'passed':False,'installed':False,'target':str(LIVE),'metadataOnly':True,'allExistingJarEntriesUnchanged':True,'addedJarEntries':['pack.mcmeta'],'sourceJarSHA256':NEW,'rows':rows,'smoke':{'path':str(a.smoke.absolute()),'sha256':I.sha(a.smoke)},'previousBehaviorEvidence':{'path':str(ROOT/'검증/v10_6_integrated_verification.json'),'sha256':I.sha(ROOT/'검증/v10_6_integrated_verification.json'),'onlyProductDeltas':[JAR,MANIFEST]},'physicalInputUsed':False}
    I.write(directory/'plan.json',report)
    if not a.apply:print(json.dumps({'preflightPassed':True,'changes':len(rows)}));return
    I.CORE.require_idle();I.reconcile_launcher_metadata(before,I.CORE.full_inventory(LIVE),metadata)
    applied=[];temps=[]
    try:
        for row in rows:
            I.CORE.require_idle();target=I.target(row['path']);I.require(I.sha(target)==row['before']['sha256'],'Destination changed')
            temp=target.with_name(target.name+'.'+a.label+'.tmp');I.require(not temp.exists(),'Existing temporary file');temps.append(temp)
            with temp.open('xb') as output:output.write(fixed[row['path']])
            I.require(I.sha(temp)==row['after']['sha256'],'Staged bytes differ')
            I.require(I.sha(target)==row['before']['sha256'],'Destination changed during staging')
            os.replace(temp,target);applied.append(row)
        after=I.CORE.full_inventory(LIVE);wanted=dict(before)
        for row in rows:wanted[row['path']]=row['after']
        report['preservedLauncherUpdate']=I.reconcile_launcher_metadata(wanted,after,metadata)
        saves={key:value for key,value in before.items() if key.startswith('saves/')}
        I.require(saves=={key:value for key,value in after.items() if key.startswith('saves/')},'Save changed')
        I.require(I.product()==candidate,'Product changed during installation')
        report.update(passed=True,installed=True,saveFilesVerified=len(saves),allSavesPreserved=True,candidateHashes=candidate,completedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat())
        I.write(directory/'receipt.json',report);print(json.dumps({key:value for key,value in report.items() if key not in ['candidateHashes','rows']},ensure_ascii=False))
    except BaseException:
        for row in reversed(applied):
            target=I.target(row['path']);I.require(I.sha(target)==row['after']['sha256'],'Concurrent edit prevents rollback')
            restored=(directory/'before'/row['path']).read_bytes()
            I.require(hashlib.sha256(restored).hexdigest()==row['before']['sha256'],'Rollback preimage differs')
            temp=target.with_name(target.name+'.'+a.label+'.rollback.tmp');I.require(not temp.exists(),'Existing rollback temporary file');temps.append(temp)
            with temp.open('xb') as output:output.write(restored)
            I.require(I.sha(temp)==row['before']['sha256'],'Rollback staging differs')
            I.require(I.sha(target)==row['after']['sha256'],'Concurrent edit prevents rollback')
            os.replace(temp,target);I.require(I.sha(target)==row['before']['sha256'],'Rollback verification failed')
        for temp in temps:
            if temp.is_file():temp.unlink()
        preservation=I.reconcile_launcher_metadata(before,I.CORE.full_inventory(LIVE),metadata)
        I.write(directory/'rollback.json',{'ownedFilesRestored':True,'preservedLauncherUpdate':preservation})
        raise

if __name__=='__main__':main()
