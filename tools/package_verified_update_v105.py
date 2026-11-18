"""Build a deterministic T9-only update from a fully verified exact candidate.

No live instance, world, player data, QA mod or network operation is involved.
An existing deliverable is reused only when its bytes are already identical.
"""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
PREVIOUS_NAME = 'F-Craft_7차_1장3보스_수호자무구'
EXPECTED_NAME = 'F-Craft_8차_보스추격_패링HUD_v10_5'
ALLOWED_ROOTS = ('kubejs/', 'config/', 'defaultconfigs/', 'mods/', 'resourcepacks/')
PRODUCT_MODS = {
    'bossintros-forge-mc1.20.1-0.1.4.jar',
    'bossbars-forge-mc1.20.1-0.1.4.jar',
    'fcraft-raid-bridge-1.0.0-forge-1.20.1.jar',
}
STAMP = (2026, 11, 17, 0, 0, 0)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def sha(file):
    return sha_bytes(Path(file).read_bytes())


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode('utf-8')


def linked(path):
    return path.is_symlink() or (path.exists() and getattr(path, 'is_junction', lambda: False)())


def assert_no_links(path, boundary):
    path, boundary = Path(path).absolute(), Path(boundary).absolute()
    require(path == boundary or path.is_relative_to(boundary), 'Path is outside its intended boundary: ' + str(path))
    for item in [path] + list(path.parents):
        require(not linked(item), 'Linked paths are not package inputs or destinations: ' + str(item))
        if item == boundary:
            break


def assert_t9_root(root=ROOT):
    root = Path(root).absolute()
    require(root.name == EXPECTED_NAME, 'Unexpected update project directory')
    require(root.drive.upper() == 'E:', 'All package inputs and outputs must remain on T9 (E:)')
    require(root.parent == Path('E:/F-Craft/마크'), 'Unexpected T9 workspace root')
    assert_no_links(root, Path('E:/'))
    require(root.resolve() == root, 'Resolved project path differs from the intended T9 target')
    return root


def safe_product_path(rel):
    require(isinstance(rel, str) and rel and '\\' not in rel, 'Invalid candidate path')
    path = PurePosixPath(rel)
    require(not path.is_absolute() and '..' not in path.parts and '.' not in path.parts and ':' not in rel,
            'Unsafe candidate path: ' + rel)
    require(rel.startswith(ALLOWED_ROOTS) or rel == 'modpack_manifest_1.20.1_forge.json',
            'Candidate path is outside product roots: ' + rel)
    parts = tuple(part.lower() for part in path.parts)
    require(not any(part.startswith('.') or part in {'tests', 'test', 'logs', 'saves', 'playerdata',
            'native', 'native_inputs', 'crash-reports', 'backups', '__pycache__'} for part in parts),
            'Development/world content cannot be packaged: ' + rel)
    name = path.name.lower()
    require(name not in {'server.properties', 'ops.json', 'whitelist.json', 'usercache.json',
            'usernamecache.json', 'banned-players.json', 'banned-ips.json'}
            and not re.search(r'(?:credential|secret|password|access[_-]?token|private[_-]?key)', name)
            and not name.endswith(('.pem', '.key', '.pfx', '.p12')),
            'Private configuration cannot be packaged: ' + rel)
    if rel.startswith('mods/'):
        require(len(path.parts) == 2 and path.name in PRODUCT_MODS, 'Only the three product mods may be packaged: ' + rel)
    if path.suffix == '.js':
        require(not re.match(r'^(?:79|80|89|90|91|92|93|94|95|96|97|98|99)_', name),
                'QA helper cannot be packaged: ' + rel)
    return rel


def inventory(directory, product=False):
    directory = Path(directory).absolute()
    require(directory.is_dir(), 'Missing package input directory: ' + str(directory))
    assert_no_links(directory, ROOT.parent)
    result = {}
    for base, dirs, names in os.walk(directory, followlinks=False):
        base = Path(base)
        for name in dirs + names:
            require(not linked(base / name), 'Linked candidate content is forbidden: ' + str(base / name))
        for name in sorted(names):
            file = base / name
            require(file.is_file(), 'Non-file candidate input: ' + str(file))
            rel = file.relative_to(directory).as_posix()
            if product:
                safe_product_path(rel)
            result[rel] = sha(file)
    require(bool(result), 'Empty package candidate')
    return dict(sorted(result.items()))


def validate_verification(report, current):
    require(report.get('passed') is True and report.get('fullyVerified') is True,
            'Final v10.5 verification has not fully passed; no package is created')
    require(report.get('scope') == 'complete-native-server-and-client' and report.get('actualMinecraft') is True,
            'Unit-only results cannot authorize a final package')
    require(report.get('physicalInputUsed') is False, 'The final evidence must confirm no physical input')
    require(isinstance(report.get('candidateHashes'), dict) and report['candidateHashes'] == current,
            'Current candidate bytes differ from the fully verified candidate')
    categories = report.get('categories')
    require(isinstance(categories, list) and len(categories) == 6
            and {row.get('id') for row in categories} == set(range(1, 7))
            and all(row.get('passed') is True and row.get('status') == 'passed' for row in categories),
            'Each of the six final requirements must have actually passed')
    require(isinstance(report.get('errors'), list) and not report['errors'], 'Final verification has unresolved errors')
    checks = report.get('checks')
    require(isinstance(checks, list) and bool(checks) and all(row.get('passed') is True for row in checks),
            'Final verification contains missing or failed checks')


def change_list(current, previous):
    rows = []
    for rel, digest in sorted(current.items()):
        old = previous.get(rel)
        rows.append({'path': rel, 'status': 'added' if old is None else 'unchanged' if old == digest else 'modified',
                     'previousSHA256': old, 'sha256': digest})
    return rows


def same_bytes_or_write(path, content):
    if path.exists():
        require(path.is_file() and path.read_bytes() == content,
                'Preserve existing differing output; choose a new --label: ' + str(path))
        return False
    with path.open('xb') as handle:
        handle.write(content)
    return True


def deterministic_zip(destination, entries):
    # All data is already captured. A candidate changing during capture is
    # detected by the caller before any deliverable is committed.
    fd, temporary = tempfile.mkstemp(prefix='.v105_', suffix='.zip.pending', dir=destination.parent)
    os.close(fd)
    temporary = Path(temporary)
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for rel, value in sorted(entries.items()):
                info = zipfile.ZipInfo(rel, STAMP)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                archive.writestr(info, value, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        with zipfile.ZipFile(temporary) as archive:
            require(archive.testzip() is None, 'ZIP CRC check failed')
            require(len(archive.namelist()) == len(entries) and set(archive.namelist()) == set(entries),
                    'ZIP member list differs from the approved entries')
            require(all(sha_bytes(archive.read(rel)) == sha_bytes(value) for rel, value in entries.items()),
                    'ZIP content hash check failed')
        digest = sha(temporary)
        if destination.exists():
            require(destination.is_file() and sha(destination) == digest,
                    'Preserve existing differing archive; choose a new --label: ' + str(destination))
            temporary.unlink()
            return digest, False
        # Copy with exclusive creation; an independently created destination can
        # never be silently replaced between an existence check and commit.
        with destination.open('xb') as output, temporary.open('rb') as source:
            while chunk := source.read(1024 * 1024):
                output.write(chunk)
        require(sha(destination) == digest, 'Final archive differs after exclusive commit')
        temporary.unlink()
        return digest, True
    except BaseException:
        # One exact owned pending file, with no recursive filesystem operation.
        if temporary.exists():
            temporary.unlink()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verification', help='Final v10.5 gate JSON inside this project/검증')
    parser.add_argument('--label', default='v10_5', help='Unique immutable delivery label; use a new label for changed bytes')
    parser.add_argument('--check-only', action='store_true', help='Validate all prerequisites without creating package files')
    args = parser.parse_args()
    root = assert_t9_root()
    require(re.fullmatch(r'[A-Za-z0-9_-]{1,48}', args.label) is not None, 'Unsafe delivery label')
    verification = Path(args.verification).absolute() if args.verification else root / '검증/v10_5_active_boss_ai_and_parry_hud_verification.json'
    require(verification.is_relative_to(root / '검증'), 'Verification must stay inside this T9 project/검증')
    assert_no_links(verification, root)
    require(verification.is_file(), 'Final verification JSON is absent; no package is created')
    report = json.loads(verification.read_text(encoding='utf-8-sig'))
    candidate = root / '수정파일'
    current = inventory(candidate, product=True)
    validate_verification(report, current)
    previous = inventory(root.parent / PREVIOUS_NAME / '수정파일')
    guides = {name: root / name for name in ['설치_검증_가이드.md', 'LICENSE_RAID_ICONS.txt']}
    for name, file in guides.items():
        assert_no_links(file, root)
        require(file.is_file(), 'Missing delivery document: ' + name)
    gate_hash = sha(verification)
    changes = change_list(current, previous)
    manifest = {
        'version': 'F-Craft v10.5', 'deliveryLabel': args.label, 'fullyVerified': True,
        'verificationSHA256': gate_hash, 'candidateFileCount': len(current), 'candidateHashes': current,
        'previousPatch': PREVIOUS_NAME, 'previousInventorySHA256': sha_bytes(json_bytes(previous)),
        'changes': changes, 'changedPaths': [row['path'] for row in changes if row['status'] != 'unchanged'],
        'previousPatchPathsNotIncluded': sorted(set(previous) - set(current)),
        'omittedPathsAreNotDeletionInstructions': True,
        'documentHashes': {name: sha(file) for name, file in guides.items()},
        'humanPlay': report.get('humanPlay') is True, 'physicalInputUsed': False,
        'containsWorldsOrPlayerData': False, 'containsQAHelpers': False, 'autoInstalled': False,
        'installation': 'Merge the contents of 수정파일 into the stopped Minecraft instance after backing it up. Do not delete existing folders or saves.',
    }
    if args.check_only:
        print(json.dumps({'passed': True, 'checkOnly': True, 'fullyVerified': True,
                          'candidateFiles': len(current), 'changedFiles': len(manifest['changedPaths'])}, ensure_ascii=False))
        return
    entries = {'수정파일/' + rel: (candidate / rel).read_bytes() for rel in current}
    require(all(sha_bytes(entries['수정파일/' + rel]) == digest for rel, digest in current.items()),
            'Candidate changed while package inputs were captured')
    entries.update({name: file.read_bytes() for name, file in guides.items()})
    require(all(sha_bytes(entries[name]) == manifest['documentHashes'][name] for name in guides),
            'Delivery documents changed while inputs were captured')
    entries['F-Craft_v10.5_배포_매니페스트.json'] = json_bytes(manifest)
    require(inventory(candidate, product=True) == current and sha(verification) == gate_hash,
            'Verified candidate or final gate changed before packaging')
    output_dir = root / '배포'
    assert_no_links(output_dir, root)
    output_dir.mkdir(exist_ok=True)
    destination = output_dir / ('F-Craft_' + args.label + '_보스추격_패링HUD_업데이트.zip')
    assert_no_links(destination, root)
    receipt = root / '검증' / ('package_v105.json' if args.label == 'v10_5' else 'package_v105_' + args.label + '.json')
    assert_no_links(receipt, root)
    if receipt.exists():
        old = json.loads(receipt.read_text('utf-8'))
        require(old.get('verificationSHA256') == gate_hash and old.get('candidateHashes') == current
                and old.get('deliveryLabel') == args.label,
                'Preserve existing differing package receipt; choose a new --label')
    archive_hash, created = deterministic_zip(destination, entries)
    receipt_data = {
        'passed': True, 'fullyVerified': True, 'deliveryLabel': args.label,
        'archive': str(destination), 'bytes': destination.stat().st_size, 'sha256': archive_hash,
        'entries': len(entries), 'candidateFiles': len(current), 'changedFiles': len(manifest['changedPaths']),
        'crcVerified': True, 'entryHashesVerified': True, 'candidateHashes': current,
        'entryHashes': {rel: sha_bytes(value) for rel, value in sorted(entries.items())},
        'verification': str(verification), 'verificationSHA256': gate_hash,
        'containsWorldsOrPlayerData': False, 'containsQAHelpers': False,
        'physicalInputUsed': False, 'autoInstalled': False, 'externalWrites': False,
    }
    same_bytes_or_write(receipt, json_bytes(receipt_data))
    print(json.dumps({key: value for key, value in receipt_data.items()
                      if key not in {'candidateHashes', 'entryHashes'}}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, zipfile.BadZipFile) as error:
        print(json.dumps({'passed': False, 'error': str(error), 'packagingRefused': True}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)
