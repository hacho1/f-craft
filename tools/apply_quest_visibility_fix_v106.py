"""Apply client quest-map bounds and arrival layout fixes, preserving progress."""
from pathlib import Path
import argparse, datetime, hashlib, importlib.util, io, json, os, re

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('verified_install_core',ROOT/'tools/install_update_v106.py')
I=importlib.util.module_from_spec(spec);spec.loader.exec_module(I)
LIVE=I.LIVE
JAR='mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'
MANIFEST='modpack_manifest_1.20.1_forge.json'
CHAPTER='config/ftbquests/quests/chapters/01_ch1_arrival_and_guild.snbt'
OLD='492b635acd184c356b448c1a178e89e057cf70a2383ebe979358ddb6c99ce91d'
BASELINE=ROOT/'검증/promotion_pack_metadata_install/applied_packmeta_01/receipt.json'

def digest(data):return hashlib.sha256(data).hexdigest()

def main():
    import zipfile
    parser=argparse.ArgumentParser()
    parser.add_argument('--proof',type=Path,required=True)
    parser.add_argument('--unit',type=Path,required=True)
    parser.add_argument('--label',required=True)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    I.require(re.fullmatch('[A-Za-z0-9_]{1,80}',args.label),'Unsafe label')
    I.CORE.identity();I.CORE.require_idle()
    for path in [args.proof,args.unit]:I.CORE.no_links(path,ROOT)
    proof_raw=args.proof.read_bytes();unit_raw=args.unit.read_bytes()
    proof=json.loads(proof_raw.decode('utf-8-sig'));unit=json.loads(unit_raw.decode('utf-8-sig'))
    I.require(proof.get('passed') is True and proof.get('actualMinecraft') is True and proof.get('actualClient') is True,'Actual client verification must pass')
    I.require(proof.get('startupWarnings')==[] and proof.get('errors')==[] and proof.get('sourceAndLiveUnchanged') is True,'Client execution did not preserve its inputs')
    I.require(proof.get('scenarioChecks',{}).get('unregisteredChapter1Visible') is True and proof.get('scenarioChecks',{}).get('registeredChapter2Visible') is True,'Both natural chapter selections must be verified')
    I.require(proof.get('visibilityProofIncludesSidebarOcclusion') is True,'Sidebar occlusion must be tested')
    I.require(unit.get('passed') is True,'Bounds regression checks must pass')
    source=ROOT/'수정파일'
    for rel in [JAR,MANIFEST,CHAPTER]:I.CORE.no_links(source/rel,source)
    frozen={rel:(source/rel).read_bytes() for rel in [JAR,MANIFEST,CHAPTER]}
    hashes={rel:digest(raw) for rel,raw in frozen.items()}
    I.require(unit.get('jarSha256')==hashes[JAR] and unit.get('preimageSha256')==OLD,'Unit evidence covers another artifact')
    I.require(proof.get('sourceChapterSHA256')==hashes[CHAPTER] and unit.get('chapterFilesSha256',{}).get(Path(CHAPTER).name)==hashes[CHAPTER],'Chapter evidence covers another layout')
    I.require(proof.get('sourceJarSHA256')==hashes[JAR] and hashes[JAR]!=OLD,'Client tested another bridge')
    old_jar=(LIVE/JAR).read_bytes();old_manifest=(LIVE/MANIFEST).read_bytes();old_chapter=(LIVE/CHAPTER).read_bytes()
    I.require(digest(old_jar)==OLD,'Installed bridge differs from the authorized baseline')
    with zipfile.ZipFile(io.BytesIO(old_jar)) as old,zipfile.ZipFile(io.BytesIO(frozen[JAR])) as new:
        prior=set(old.namelist());latest=set(new.namelist())
        added=sorted(latest-prior);changed=sorted(name for name in prior&latest if old.read(name)!=new.read(name))
        I.require(not prior-latest and added==['fcraft/promotion/mixin/PersonalQuestPanelBoundsMixin.class'],'Unexpected new bridge entry')
        I.require(changed==['fcraft_promotion_bridge.mixins.json'],'Existing executable code changed')
        a=json.loads(old.read(changed[0]));b=json.loads(new.read(changed[0]))
        expected=json.loads(json.dumps(a));expected['client'].append('PersonalQuestPanelBoundsMixin')
        I.require(I.canonical_json(b)==I.canonical_json(expected),'Unreviewed Mixin configuration change')
        I.require(new.read('pack.mcmeta')==old.read('pack.mcmeta') and json.loads(new.read('pack.mcmeta'))['pack']['pack_format']==15,'Resource metadata must be preserved')
        I.require(new.testzip() is None,'Invalid bridge archive')
    previous=json.loads(old_manifest.decode('utf-8-sig'));expected=json.loads(json.dumps(previous))
    expected['phase9']['promotionBridge']['sha256']=hashes[JAR]
    expected['phase9']['promotionBridge']['bytes']=len(frozen[JAR])
    I.require(I.canonical_json(json.loads(frozen[MANIFEST].decode('utf-8-sig')))==I.canonical_json(expected),'Unrelated manifest change')
    expected=json.loads(old_chapter.decode('utf-8-sig'))
    layout={'7900000000000001':(0.0,0.0),'7900000000000002':(2.0,0.0),'7900000000000003':(4.0,0.0),'7900000000000004':(4.0,3.0),'7900000000000005':(2.0,3.0),'7900000000000006':(0.0,3.0)}
    for quest in expected['quests']:
        if quest['id'] in layout:quest['x'],quest['y']=layout[quest['id']]
    I.require(I.canonical_json(json.loads(frozen[CHAPTER].decode('utf-8-sig')))==I.canonical_json(expected),'Quest changes exceed the six coordinate pairs')
    baseline=I.read(BASELINE);candidate=I.product()
    I.require(baseline.get('passed') is True and baseline.get('installed') is True,'Previous verified install is absent')
    I.require(all(candidate[rel]==hashes[rel] for rel in frozen),'Source changed during validation')
    prior_candidate=baseline['candidateHashes']
    I.require(sorted(rel for rel in set(prior_candidate)|set(candidate) if prior_candidate.get(rel)!=candidate.get(rel))==sorted([JAR,MANIFEST,CHAPTER]),'Unreviewed product delta')
    directory=ROOT/'검증/quest_visibility_install'/args.label
    I.require(not directory.exists(),'Preserve previous receipt');directory.mkdir(parents=True)
    before=I.CORE.full_inventory(LIVE);launcher=(LIVE/'minecraftinstance.json').read_bytes()
    I.require(before[JAR]['sha256']==OLD and before[MANIFEST]['sha256']==digest(old_manifest) and before[CHAPTER]['sha256']==digest(old_chapter),'Installed preimages changed')
    I.require(before['minecraftinstance.json']['sha256']==digest(launcher),'Launcher changed during capture')
    (directory/'minecraftinstance_preimage.json').write_bytes(launcher)
    rows=[]
    for rel,raw in [(JAR,old_jar),(MANIFEST,old_manifest),(CHAPTER,old_chapter)]:
        saved=directory/'before'/rel;saved.parent.mkdir(parents=True,exist_ok=True);saved.write_bytes(raw)
        I.require(I.sha(saved)==before[rel]['sha256'],'Backup differs')
        rows.append({'path':rel,'before':before[rel],'after':{'sha256':hashes[rel],'bytes':len(frozen[rel])}})
    report={'passed':False,'installed':False,'target':str(LIVE),'sourceJarSHA256':hashes[JAR],'sourceChapterSHA256':hashes[CHAPTER],'changedFiles':3,'rows':rows,'addedJarEntries':added,'changedJarEntries':changed,'allExistingClassesUnchanged':True,'questIdsTasksRewardsAndDependenciesUnchanged':True,'arrivalCoordinateChanges':layout,'physicalInputUsed':False,'actualClientProof':{'path':str(args.proof.absolute()),'sha256':digest(proof_raw)},'unitProof':{'path':str(args.unit.absolute()),'sha256':digest(unit_raw)},'installerSHA256':I.sha(Path(__file__))}
    I.write(directory/'plan.json',report)
    if not args.apply:print(json.dumps({'preflightPassed':True,'changes':3}));return
    I.CORE.require_idle();I.reconcile_launcher_metadata(before,I.CORE.full_inventory(LIVE),launcher)
    applied=[];temporary=[]
    try:
        for row in rows:
            I.CORE.require_idle();target=I.target(row['path']);I.require(I.sha(target)==row['before']['sha256'],'Destination changed')
            temp=target.with_name(target.name+'.'+args.label+'.tmp');I.require(not temp.exists(),'Existing temporary file');temporary.append(temp)
            with temp.open('xb') as output:output.write(frozen[row['path']])
            I.require(I.sha(temp)==row['after']['sha256'] and I.sha(target)==row['before']['sha256'],'Staging changed')
            os.replace(temp,target);applied.append(row)
        after=I.CORE.full_inventory(LIVE);expected=dict(before)
        for row in rows:expected[row['path']]=row['after']
        report['preservedLauncherUpdate']=I.reconcile_launcher_metadata(expected,after,launcher)
        saves={rel:value for rel,value in before.items() if rel.startswith('saves/')}
        I.require(saves=={rel:value for rel,value in after.items() if rel.startswith('saves/')},'Save files changed')
        I.require(I.product()==candidate,'Product changed during installation')
        report.update(passed=True,installed=True,allSavesPreserved=True,saveFilesVerified=len(saves),candidateHashes=candidate,completedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat())
        I.write(directory/'receipt.json',report)
        print(json.dumps({key:value for key,value in report.items() if key not in ['rows','candidateHashes']},ensure_ascii=False))
    except BaseException:
        for row in reversed(applied):
            target=I.target(row['path']);I.require(I.sha(target)==row['after']['sha256'],'Concurrent edit prevents rollback')
            raw=(directory/'before'/row['path']).read_bytes();I.require(digest(raw)==row['before']['sha256'],'Rollback preimage differs')
            temp=target.with_name(target.name+'.'+args.label+'.rollback.tmp');I.require(not temp.exists(),'Existing rollback temporary file');temporary.append(temp)
            with temp.open('xb') as output:output.write(raw)
            I.require(I.sha(temp)==row['before']['sha256'] and I.sha(target)==row['after']['sha256'],'Rollback staging changed')
            os.replace(temp,target)
        for temp in temporary:
            if temp.is_file():temp.unlink()
        preserved=I.reconcile_launcher_metadata(before,I.CORE.full_inventory(LIVE),launcher)
        I.write(directory/'rollback.json',{'ownedFilesRestored':True,'preservedLauncherUpdate':preserved})
        raise

if __name__=='__main__':main()
