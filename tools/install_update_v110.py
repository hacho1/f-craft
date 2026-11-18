"""Install current, actually tested v11.0 files into the authorized Forge profile.

The full preimage ZIP must be CRC/hash verified, Minecraft must be stopped, and
both native process reports must attest the exact frozen candidate. Old quest
definitions are retired only from the explicitly listed chapters scope.
"""
from pathlib import Path
import argparse, datetime, hashlib, importlib.util, json, os, re, shutil, zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('_v106_backup_core', ROOT/'tools/install_verified_update_v105.py')
CORE = importlib.util.module_from_spec(spec);spec.loader.exec_module(CORE)
LIVE = CORE.LIVE
VERIFIED_DEPENDENCIES={
    'mods/waystones-forge-1.20.1-14.1.21.jar':'fd6fe3c645328ea7be5bc6723d02c881e34650e0cbd4527ba59e42fa4cbe3c80',
    'mods/balm-forge-1.20.1-7.3.44.jar':'ad11d968770bb1ce73377626b6f1dcd4ae6f8be1ef6f37cee9b872b8176aebd3',
}
UNCHANGED_PRESENTATION_MODS={
    'mods/bossintros-forge-mc1.20.1-0.1.4.jar':'d4683fc9de75f8799fe124d542dc7ea838f33e3581f66323597adb74665d9fc3',
    'mods/bossbars-forge-mc1.20.1-0.1.4.jar':'1bfd0fbbbe4ac04f4d6fb9a22b25bb503c40c0992da68739d194c091d05785d2',
}

def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def sha(p):return CORE.sha(p)
def write(p,v):CORE.write(p,v)
def require(ok,message):CORE.require(ok,message)
def canonical_json(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)

def product():
    rows={}
    base=ROOT/'수정파일'
    for directory, dirs, files in os.walk(base,followlinks=False):
        for name in dirs+files:require(not CORE.delivery.linked(Path(directory)/name),'Linked product path')
        for name in files:
            p=Path(directory)/name;rel=p.relative_to(base).as_posix()
            require(rel.startswith(('kubejs/','config/','resourcepacks/','mods/'))or rel in {'modpack_manifest_1.20.1_forge.json','docs/CREDITS_QUEST_ICONS_V110.txt'},'Unexpected product scope '+rel)
            if rel.startswith('mods/'):
                first_party=rel in {'mods/fcraft-raid-bridge-1.0.0-forge-1.20.1.jar','mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'}
                require(first_party or rel in UNCHANGED_PRESENTATION_MODS and sha(p)==UNCHANGED_PRESENTATION_MODS[rel] or rel in VERIFIED_DEPENDENCIES and sha(p)==VERIFIED_DEPENDENCIES[rel],'Unreviewed or changed presentation mod '+rel)
            require(rel!='kubejs/fcraft_client_preferences_v96.json','Do not distribute personal UI preferences')
            rows[rel]=sha(p)
    return dict(sorted(rows.items()))

def target(rel):
    require(not Path(rel).is_absolute() and '..' not in Path(rel).parts,'Unsafe relative path')
    p=LIVE/rel;CORE.no_links(p,LIVE)
    return p

def reconcile_launcher_metadata(expected,current,previous_bytes):
    changed=sorted(key for key in set(expected)|set(current) if expected.get(key)!=current.get(key))
    if not changed:return None
    require(changed==['minecraftinstance.json'],'Unexpected change outside install scope: '+str(changed))
    require(previous_bytes is not None and 'minecraftinstance.json' in expected and 'minecraftinstance.json' in current,'Launcher metadata cannot be added or removed')
    require(hashlib.sha256(previous_bytes).hexdigest()==expected['minecraftinstance.json']['sha256'],'Launcher metadata preimage differs')
    path=target('minecraftinstance.json');now=path.read_bytes()
    require(hashlib.sha256(now).hexdigest()==current['minecraftinstance.json']['sha256'],'Launcher metadata changed during comparison')
    old=json.loads(previous_bytes.decode('utf-8-sig'));new=json.loads(now.decode('utf-8-sig'))
    require(isinstance(old,dict) and isinstance(new,dict),'Unexpected launcher metadata schema')
    keys=sorted(key for key in set(old)|set(new) if key not in old or key not in new or canonical_json(old[key])!=canonical_json(new[key]))
    require(bool(keys) and set(keys)<={'installedAddons','lastPreviousMatchUpdate'},'Unreviewed launcher setting changed: '+str(keys))
    require(isinstance(old.get('installedAddons'),list) and isinstance(new.get('installedAddons'),list),'Invalid launcher addon registry')
    require(all(isinstance(entry,dict) for entry in new['installedAddons']),'Invalid launcher addon entry')
    return {'path':'minecraftinstance.json','changedKeys':keys,'before':expected['minecraftinstance.json'],'after':current['minecraftinstance.json'],'preservedExternalLauncherUpdate':True,'writtenByInstaller':False}

def main():
    p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--label',required=True)
    a=p.parse_args();require(re.fullmatch('[A-Za-z0-9_]{1,80}',a.label),'Unsafe label')
    CORE.identity();CORE.require_idle()
    candidate=product();proof=read(ROOT/'검증/v11_0_integrated_verification.json')
    require(proof.get('passed') is True and proof.get('actualMinecraft') is True,'Native verification has not passed')
    require(proof.get('candidateHashes')==candidate,'Product changed after verification')
    for field in ['server','client']:
        item=proof[field];path=Path(item['path']);CORE.no_links(path,ROOT)
        require(sha(path)==item['sha256'],'Execution receipt changed '+field)
        r=read(path);require(r.get('passed') is True and r.get('actualMinecraft') is True,'Execution failed '+field)
        actual=r.get('codeHashes') if field=='server' else r.get('candidateHashes')
        require(actual==candidate,'Exact executed candidate differs '+field)
        if field=='server':
            for source in r['sourceReports']:
                leaf=Path(source['path']);CORE.no_links(leaf,ROOT)
                require(sha(leaf)==source['sha256'],'Native source execution receipt changed')
    backup=read(ROOT/'검증/live_pre_v110_backup.json');archive=Path(backup['path'])
    CORE.no_links(archive,ROOT);require(sha(archive)==backup['sha256'],'Backup checksum differs')
    require(backup['crcVerified'] and backup['entryHashesVerified'],'Backup not verified')
    before=CORE.full_inventory(LIVE)
    with zipfile.ZipFile(archive) as preimage:
        original_metadata=preimage.read('minecraftinstance.json') if 'minecraftinstance.json' in backup['fullInventory'] else None
    metadata_before_install=reconcile_launcher_metadata(backup['fullInventory'],before,original_metadata)
    metadata_preimage=target('minecraftinstance.json').read_bytes() if 'minecraftinstance.json' in before else None
    if metadata_preimage is not None:require(hashlib.sha256(metadata_preimage).hexdigest()==before['minecraftinstance.json']['sha256'],'Launcher preimage changed during capture')
    for rel,digest in UNCHANGED_PRESENTATION_MODS.items():
        if rel in candidate:require(before.get(rel,{}).get('sha256')==digest,'Existing presentation mod differs or is missing '+rel)
    # This is the entire and only deletion scope: obsolete chapter files already
    # captured by the full preimage archive. IDs in surviving definitions persist.
    quest_dir=LIVE/'config/ftbquests/quests/chapters'
    expected_chapters={Path(r).name for r in candidate if r.startswith('config/ftbquests/quests/chapters/')and r.endswith('.snbt')}
    require(len(expected_chapters)==5,'The current five chapter definitions are required')
    migration=read(ROOT/'수정파일/config/f_rank_days/quest_chapter_migration_v106.json')
    known_retired=set(migration['retiredFiles'])
    require(known_retired=={'01_prologue_first_id.snbt','02_combat_jobs_track.snbt','03_life_jobs_track.snbt','04_exploration_jobs_track.snbt','05_villager_bonds_and_stories.snbt','06_mainland_frontier_chapter2.snbt','98_legacy_promotion_archive_phase4.snbt','zz_legacy_mainland_records_v99.snbt'},'Retirement differs from the reviewed eight old chapters')
    require(not known_retired & expected_chapters,'New chapters cannot be retired')
    require(all(Path(n).name==n and n.endswith('.snbt') for n in known_retired),'Unsafe chapter retirement manifest')
    require(expected_chapters==set(migration['newFiles']),'New chapter manifest differs')
    unknown=[q.name for q in quest_dir.glob('*.snbt')if q.name not in expected_chapters|known_retired]
    require(not unknown,'Unreviewed custom chapters must be preserved: '+str(unknown))
    retired=[q.relative_to(LIVE).as_posix() for q in quest_dir.glob('*.snbt') if q.name in known_retired]
    changes=[{'path':rel,'before':before.get(rel),'sha256':digest}for rel,digest in candidate.items() if before.get(rel,{}).get('sha256')!=digest]
    directory=ROOT/'검증/install_v110'/a.label
    require(not directory.exists(),'Preserve previous install receipt')
    directory.mkdir(parents=True)
    report={'installed':False,'target':str(LIVE),'candidateFiles':len(candidate),'changedFiles':len(changes),'retiredChapters':retired,'allSavesPreserved':False,'physicalInputUsed':False,'worldMigrationPerformed':False}
    report['launcherMetadataUpdatedBeforeInstall']=metadata_before_install
    if metadata_preimage is not None:
        (directory/'minecraftinstance_preimage.json').write_bytes(metadata_preimage)
        report['launcherMetadataPreimage']={'path':str(directory/'minecraftinstance_preimage.json'),'sha256':hashlib.sha256(metadata_preimage).hexdigest()}
    write(directory/'plan.json',report)
    if not a.apply:print(json.dumps(report,ensure_ascii=False));return
    stage=directory/'staged'
    for row in changes:
        q=stage/row['path'];q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/'수정파일'/row['path'],q)
        require(sha(q)==row['sha256'],'Staged checksum differs')
    CORE.require_idle();staged_inventory=CORE.full_inventory(LIVE)
    report['launcherMetadataUpdatedDuringStaging']=reconcile_launcher_metadata(before,staged_inventory,metadata_preimage)
    if before.get('minecraftinstance.json')!=staged_inventory.get('minecraftinstance.json'):
        before=staged_inventory;metadata_preimage=target('minecraftinstance.json').read_bytes()
        require(hashlib.sha256(metadata_preimage).hexdigest()==before['minecraftinstance.json']['sha256'],'Launcher preimage changed during staging')
        (directory/'minecraftinstance_preimage.json').write_bytes(metadata_preimage)
        report['launcherMetadataPreimage']['sha256']=hashlib.sha256(metadata_preimage).hexdigest()
    applied=[];removed=[];temporary=[]
    try:
        for row in changes:
            CORE.require_idle();q=target(row['path'])
            require((sha(q) if q.exists() else None)==(row['before']['sha256'] if row['before'] else None),'Destination changed '+row['path'])
            q.parent.mkdir(parents=True,exist_ok=True);tmp=q.with_name(q.name+'.v110_'+a.label+'.tmp')
            require(not tmp.exists(),'Preserve existing temporary file')
            temporary.append(tmp)
            shutil.copyfile(stage/row['path'],tmp);require(sha(tmp)==row['sha256'],'Same-volume copy differs')
            os.replace(tmp,q);applied.append(row)
        for rel in retired:
            CORE.require_idle();q=target(rel)
            require(q.parent==quest_dir and q.suffix=='.snbt' and sha(q)==before[rel]['sha256'],'Retired chapter changed')
            q.unlink();removed.append(rel)
        after=CORE.full_inventory(LIVE);expected=dict(before)
        for row in changes:expected[row['path']]={'sha256':row['sha256'],'bytes':(ROOT/'수정파일'/row['path']).stat().st_size}
        for rel in retired:expected.pop(rel)
        report['launcherMetadataUpdatedDuringInstall']=reconcile_launcher_metadata(dict(sorted(expected.items())),after,metadata_preimage)
        saves={k:v for k,v in before.items()if k.startswith('saves/')}
        require(saves=={k:v for k,v in after.items()if k.startswith('saves/')},'Save files changed')
        report.update(passed=True,installed=True,allSavesPreserved=True,saveFilesVerified=len(saves),backup=str(archive),completedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),candidateHashes=candidate)
        write(directory/'receipt.json',report);print(json.dumps({k:v for k,v in report.items()if k!='candidateHashes'},ensure_ascii=False),flush=True)
    except BaseException:
        with zipfile.ZipFile(archive)as z:
            for rel in reversed(removed):
                q=target(rel)
                if q.exists():
                    require(q.is_file() and sha(q)==before[rel]['sha256'],'Concurrent chapter change prevents safe rollback')
                else:q.write_bytes(z.read(rel))
            for row in reversed(applied):
                q=target(row['path']);require(q.is_file() and sha(q)==row['sha256'],'Concurrent change prevents rollback')
                if row['before']:q.write_bytes(z.read(row['path']))
                else:q.unlink()
        for tmp in temporary:
            CORE.no_links(tmp,LIVE)
            if tmp.is_file():tmp.unlink()
        rolled_back=CORE.full_inventory(LIVE)
        metadata_rollback=reconcile_launcher_metadata(before,rolled_back,metadata_preimage)
        write(directory/'rollback.json',{'ownedFilesRestored':True,'allSavesPreserved':{k:v for k,v in before.items()if k.startswith('saves/')}=={k:v for k,v in rolled_back.items()if k.startswith('saves/')},'preservedLauncherMetadataUpdate':metadata_rollback})
        raise

if __name__=='__main__':main()
