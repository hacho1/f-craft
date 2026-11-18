"""Install the verified v10.5 overlay only after a fresh full T9 backup.

No game launch, UI input, process termination, world migration or directory
replacement is performed. Auth-bearing process command lines never leave PS.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
LIVE = Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __')
FROZEN = ROOT / '검증/native_inputs/final_v105_06/수정파일'
VERIFY = ROOT / '검증/v10_5_active_boss_ai_and_parry_hud_verification.json'
PACKAGE = ROOT / '검증/package_v105.json'
spec = importlib.util.spec_from_file_location('_v105_delivery', ROOT / 'tools/package_verified_update_v105.py')
delivery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery)


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    with Path(path).open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def read(path):
    return json.loads(Path(path).read_text('utf-8-sig'))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf-8')


def no_links(path, boundary):
    path, boundary = Path(path).absolute(), Path(boundary).absolute()
    require(path == boundary or path.is_relative_to(boundary), 'Path escapes its allowed boundary')
    for current in [path] + list(path.parents):
        require(not delivery.linked(current), 'Linked install paths are forbidden: ' + str(current))
        if current == boundary:
            break
    require(path.resolve() == path, 'Resolved target differs from intended absolute target')


def target_file(root, rel):
    delivery.safe_product_path(rel)
    path = Path(root).absolute() / rel
    no_links(path, Path(root).absolute())
    require(not path.exists() or path.is_file(), 'A non-file occupies an overlay destination: ' + rel)
    return path


def full_inventory(root):
    root = Path(root).absolute()
    no_links(root, root)
    rows = {}
    for base, dirs, files in os.walk(root, followlinks=False):
        base = Path(base)
        for name in dirs + files:
            require(not delivery.linked(base / name), 'Linked profile contents require separate handling: ' + str(base / name))
        for name in files:
            p = base / name
            require(p.is_file(), 'Non-file profile input')
            rows[p.relative_to(root).as_posix()] = {'sha256': sha(p), 'bytes': p.stat().st_size}
    return dict(sorted(rows.items()))


def running_minecraft():
    # Win32_Process is queried locally, but only safe PID/classification fields
    # are serialized: launcher command lines include an access token.
    script = r'''$target='C:\Users\wooheewon\curseforge\minecraft\Instances\F__ __';
$rows=@(Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" | ForEach-Object {
 $line=[string]$_.CommandLine;
 $normalized=$line.Replace('/','\');
 $isTarget=$normalized.IndexOf($target,[System.StringComparison]::OrdinalIgnoreCase) -ge 0;
 $isMinecraft=$isTarget -or $line -match '(?i)(forgeclient|minecraft|bootstraplauncher|win_args\.txt)';
 if($isMinecraft){[PSCustomObject]@{pid=[int]$_.ProcessId;targetInstance=[bool]$isTarget}}
}); ConvertTo-Json -InputObject $rows -Compress'''
    result = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script],
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout.strip() or '[]')


def require_idle():
    active = running_minecraft()
    require(not active, 'Minecraft is still running; safe PIDs: ' + ','.join(str(row['pid']) for row in active))


def identity(target=LIVE):
    target = Path(target).absolute()
    require(target == LIVE, 'Only the explicitly authorized F-Craft instance may be installed')
    no_links(target, Path('C:/'))
    require(target.is_dir(), 'The authorized instance is absent')
    manifest = read(target / 'modpack_manifest_1.20.1_forge.json')
    require(manifest.get('internal_namespace') == 'f_rank_days'
            and manifest.get('minecraft_version') == '1.20.1'
            and manifest.get('pinned_forge_version') == '1.20.1-47.4.28',
            'Target Minecraft/Forge/F-Craft identity differs')
    require(all((target / folder).is_dir() for folder in ['mods', 'kubejs', 'config', 'saves']),
            'Authorized instance is incomplete')
    return target


def verify_product():
    delivery.assert_t9_root(ROOT)
    current = delivery.inventory(ROOT / '수정파일', product=True)
    require(delivery.inventory(FROZEN, product=True) == current, 'Final immutable snapshot differs from current patch')
    proof = read(VERIFY)
    delivery.validate_verification(proof, current)
    require(proof.get('coverage', {}).get('passed') is True, 'Per-plane execution coverage has not passed')
    for field in ['native', 'client']:
        path = Path(proof['coverage'][field + 'Result'])
        no_links(path, ROOT)
        require(sha(path) == proof['coverage'][field + 'ResultSHA256'], 'Immutable ' + field + ' evidence changed')
        require(read(path).get('passed') is True, 'Failed actual execution evidence')
    package = read(PACKAGE)
    require(package.get('passed') is True and package.get('fullyVerified') is True
            and package.get('candidateHashes') == current, 'Packaged candidate differs')
    require(package.get('verificationSHA256') == sha(VERIFY), 'Final verification changed after packaging')
    archive = Path(package['archive'])
    no_links(archive, ROOT)
    require(sha(archive) == package['sha256'], 'Delivery ZIP checksum differs')
    with zipfile.ZipFile(archive) as z:
        require(z.testzip() is None, 'Delivery ZIP CRC failure')
        for rel, digest in current.items():
            require(hashlib.sha256(z.read('수정파일/' + rel)).hexdigest() == digest, 'Packaged file differs: ' + rel)
    return current


def overlay_plan(target, candidate):
    rows = []
    for rel, digest in candidate.items():
        p = target_file(target, rel)
        previous = sha(p) if p.exists() else None
        rows.append({'path': rel, 'beforeSHA256': previous, 'afterSHA256': digest,
                     'action': 'unchanged' if previous == digest else 'replace' if previous else 'add'})
    return rows


def backup_profile(target, inventory, archive):
    archive = Path(archive)
    require(not archive.exists(), 'Preserve the earlier full backup; use a fresh label')
    archive.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=3) as z:
        for rel in inventory:
            z.write(target / rel, rel)
    with zipfile.ZipFile(archive) as z:
        require(z.testzip() is None, 'Fresh backup CRC failure')
        require(set(z.namelist()) == set(inventory), 'Fresh backup file set differs')
        for rel, row in inventory.items():
            with z.open(rel) as handle:
                require(hashlib.file_digest(handle, 'sha256').hexdigest() == row['sha256'], 'Backup preimage differs: ' + rel)
    require(full_inventory(target) == inventory, 'Profile changed while backing up; nothing was installed')
    return {'path': str(archive), 'sha256': sha(archive), 'bytes': archive.stat().st_size,
            'files': len(inventory), 'crcVerified': True, 'entryHashesVerified': True}


def apply_transaction(target, source, changes, before, archive, stage, label, idle_check, failure_hook=None):
    """Apply only staged changed files, with rollback of this transaction alone."""
    target, source, stage = Path(target).absolute(), Path(source).absolute(), Path(stage).absolute()
    require(not stage.exists(), 'Preserve the earlier staging directory')
    stage.mkdir(parents=True)
    for row in changes:
        p = stage / row['path']
        p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / row['path'], p)
        require(sha(p) == row['afterSHA256'], 'Staged file differs')
    idle_check()
    require(full_inventory(target) == before, 'Profile changed after backup; installation refused')
    applied, temporary = [], []
    try:
        for row in changes:
            idle_check()
            dest = target_file(target, row['path'])
            previous = sha(dest) if dest.exists() else None
            require(previous == row['beforeSHA256'], 'Destination changed before replacement: ' + row['path'])
            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp = dest.with_name(dest.name + '.fcraft_v105_' + label + '.tmp')
            require(not tmp.exists(), 'Preserve an existing install temporary file')
            temporary.append(tmp)
            shutil.copyfile(stage / row['path'], tmp)
            require(sha(tmp) == row['afterSHA256'], 'Same-volume staging checksum differs')
            os.replace(tmp, dest)
            applied.append(row)
            if failure_hook:
                failure_hook(len(applied))
        after = full_inventory(target)
        expected = dict(before)
        for row in changes:
            expected[row['path']] = {'sha256': row['afterSHA256'], 'bytes': (source / row['path']).stat().st_size}
        require(after == dict(sorted(expected.items())), 'Unexpected installed or untouched file change')
        return {'installedChanges': len(applied), 'unchangedFilesVerified': len(before) - sum(r['path'] in before for r in changes),
                'allSavesPreserved': {k: v for k, v in before.items() if k.startswith('saves/')} ==
                                     {k: v for k, v in after.items() if k.startswith('saves/')},
                'saveFilesVerified': sum(k.startswith('saves/') for k in before), 'after': after}
    except BaseException as error:
        restored = []
        with zipfile.ZipFile(archive) as z:
            for row in reversed(applied):
                dest = target_file(target, row['path'])
                require(dest.is_file() and sha(dest) == row['afterSHA256'], 'Concurrent change prevents safe rollback')
                if row['beforeSHA256'] is None:
                    dest.unlink()
                else:
                    dest.write_bytes(z.read(row['path']))
                    require(sha(dest) == row['beforeSHA256'], 'Rollback checksum differs')
                restored.append(row['path'])
        for tmp in temporary:
            no_links(tmp, target)
            if tmp.is_file():
                tmp.unlink()
        require(full_inventory(target) == before, 'Rollback did not restore the exact original inventory')
        raise RuntimeError('Installation rolled back safely after: ' + str(error)) from error
    finally:
        for tmp in temporary:
            no_links(tmp, target)
            if tmp.is_file():
                tmp.unlink()


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check-only', action='store_true')
    mode.add_argument('--apply', action='store_true')
    parser.add_argument('--label', default='local_v105_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    args = parser.parse_args()
    require(re.fullmatch(r'[A-Za-z0-9_]{1,80}', args.label), 'Unsafe install label')
    target, candidate = identity(), verify_product()
    rows = overlay_plan(target, candidate)
    changes = [r for r in rows if r['action'] != 'unchanged']
    active = running_minecraft()
    directory = ROOT / '검증/install_v105' / args.label
    no_links(directory, ROOT)
    require(not (directory / 'receipt.json').exists(), 'Preserve the completed install receipt')
    report = {'passed': True, 'installed': False, 'target': str(target), 'label': args.label,
              'createdAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'candidateFiles': len(candidate), 'replaceFiles': sum(r['action'] == 'replace' for r in rows),
              'newFiles': sum(r['action'] == 'add' for r in rows), 'identicalFiles': sum(r['action'] == 'unchanged' for r in rows),
              'runningMinecraft': active, 'readyToApply': not active, 'files': rows,
              'verificationSHA256': sha(VERIFY), 'packageReceiptSHA256': sha(PACKAGE),
              'physicalInputUsed': False, 'worldMigrationPerformed': False}
    directory.mkdir(parents=True, exist_ok=True)
    if args.check_only:
        write(directory / 'preflight.json', report)
        print(json.dumps({k: v for k, v in report.items() if k != 'files'}, ensure_ascii=False))
        return
    require_idle()
    before = full_inventory(target)
    write(directory / 'before_inventory.json', before)
    archive = ROOT / '백업' / args.label / 'full_profile_before.zip'
    report['backup'] = backup_profile(target, before, archive)
    require_idle()
    require(verify_product() == candidate, 'Verified source changed during backup')
    try:
        outcome = apply_transaction(target, FROZEN, changes, before, archive, directory / 'stage', args.label, require_idle)
        after = outcome.pop('after')
        report.update(outcome, installed=True, readyToApply=False, passed=True,
                      candidateHashes=candidate, completedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat())
        write(directory / 'after_inventory.json', after)
    except BaseException as error:
        report.update(passed=False, installed=False, error=str(error))
        write(directory / 'receipt.json', report)
        raise
    write(directory / 'receipt.json', report)
    print(json.dumps({k: v for k, v in report.items() if k not in {'files', 'candidateHashes'}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
