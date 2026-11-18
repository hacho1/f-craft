"""Read-only proof for ONE bridge JAR transition: add only pack.mcmeta.

Every pre-existing ZIP entry must retain exactly the same decompressed bytes.
This is a construction-evidence reuse proof, never a substitute for fresh final
native/client execution against the complete current candidate hashes.
"""
from pathlib import Path
import argparse, copy, hashlib, json, sys, zipfile
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
NAME = 'fcraft-raid-bridge-1.0.0-forge-1.20.1.jar'
RELATIVE_PATH = 'mods/'+NAME
CLASSES = {
    'fcraft/raid/RaidBridge.class', 'fcraft/raid/RaidGuards.class',
    'fcraft/raid/mixin/BomdBossBarAccess.class', 'fcraft/raid/mixin/GuardianWearMixin.class',
    'fcraft/raid/mixin/MowzieBossBarAccess.class', 'fcraft/raid/mixin/WroughtWeaknessMixin.class',
    'dev/fcraft/raid/client/NativeBossPresentation.class'}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: '+key)
        result[key] = value
    return result


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'), object_pairs_hook=no_duplicates)


def jar_entries(path):
    with zipfile.ZipFile(path) as jar:
        names = jar.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ZIP entry names')
        if jar.testzip() is not None:
            raise ValueError('Invalid ZIP CRC')
        if any(info.flag_bits & 1 for info in jar.infolist()):
            raise ValueError('Encrypted ZIP entries are not permitted')
        return {name: jar.read(name) for name in names}


def verify(old_path, new_path):
    """Pure filesystem read; return the exact ZIP-content comparison as a dict."""
    old_path, new_path = Path(old_path).resolve(), Path(new_path).resolve()
    checks = []
    def check(name, value, detail=None):
        checks.append({'name': name, 'passed': bool(value), 'detail': detail})
    result = {'passed': False, 'actualMinecraft': False, 'readOnly': True,
              'scope': 'Construction dependency reuse only: original bridge entry bytes unchanged; sole addition is pack.mcmeta.',
              'bridgePath': RELATIVE_PATH, 'checks': checks}
    try:
        result['oldJar'] = {'file': str(old_path), 'sha256': sha(old_path), 'bytes': old_path.stat().st_size}
        result['newJar'] = {'file': str(new_path), 'sha256': sha(new_path), 'bytes': new_path.stat().st_size}
        check('exact bridge basename only', old_path.name == new_path.name == NAME)
        old, new = jar_entries(old_path), jar_entries(new_path)
        added, removed = sorted(new.keys()-old.keys()), sorted(old.keys()-new.keys())
        changed = sorted(name for name in old.keys() & new.keys() if old[name] != new[name])
        identical = not removed and not changed
        result.update(addedEntries=added, removedEntries=removed, changedExistingEntries=changed,
                      oldEntryCount=len(old), newEntryCount=len(new),
                      allOriginalEntryBytesIdentical=identical,
                      entries={label: {name: {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
                                       for name, data in sorted(values.items())}
                               for label, values in [('old', old), ('new', new)]})
        check('all seven original bridge class entries present', CLASSES <= old.keys())
        check('old construction JAR has no pack metadata', 'pack.mcmeta' not in old)
        check('every original entry retains identical bytes', identical, {'removed': removed, 'changed': changed})
        check('only one entry added and it is pack.mcmeta', added == ['pack.mcmeta'] and len(new) == len(old)+1, added)
        metadata = json.loads(new.get('pack.mcmeta', b'').decode('utf-8'), object_pairs_hook=no_duplicates)
        pack = metadata.get('pack', {})
        check('metadata contains only pack format and description', set(metadata) == {'pack'} and isinstance(pack, dict) and set(pack) == {'pack_format', 'description'})
        check('Minecraft 1.20.1 resource pack format is15', type(pack.get('pack_format')) is int and pack['pack_format'] == 15)
        check('description is a nonempty string', isinstance(pack.get('description'), str) and bool(pack['description'].strip()))
        result['packMeta'] = pack
        result['originalClassByteIdenticalCount'] = sum(name in new and old[name] == new[name] for name in CLASSES)
        result['passed'] = all(c['passed'] for c in checks)
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, UnicodeError) as error:
        result['error'] = str(error)
        check('valid readable JARs and strict metadata JSON', False, str(error))
    return result


def bind_construction(report, native_path):
    """Tie the old bytes to the immutable, actually executed construction input."""
    report = copy.deepcopy(report)
    native_path = Path(native_path).resolve()
    native = read_json(native_path)
    old_path = Path(report['oldJar']['file'])
    expected = Path(native['immutableCandidateSource']).resolve()/RELATIVE_PATH
    old_sha = report['oldJar']['sha256']
    checks = [
        {'name': 'source construction genuinely passed Minecraft', 'passed': native.get('passed') is True and native.get('actualMinecraft') is True and native.get('probe', {}).get('passed') is True},
        {'name': 'old JAR is the exact archived construction input', 'passed': old_path == expected.resolve()},
        {'name': 'old JAR matches construction candidate and runtime mod hashes', 'passed': native.get('codeHashes', {}).get(RELATIVE_PATH) == old_sha == native.get('modHashes', {}).get(NAME)}]
    report['checks'].extend(checks)
    report['constructionNative'] = {'file': str(native_path), 'sha256': sha(native_path),
                                    'bridgeCodeHash': native.get('codeHashes', {}).get(RELATIVE_PATH),
                                    'bridgeModHash': native.get('modHashes', {}).get(NAME)}
    report['tool'] = {'file': str(Path(__file__).resolve()), 'sha256': sha(__file__)}
    report['passed'] = report['passed'] and all(c['passed'] for c in checks)
    return report


def verify_receipt(path):
    """Recompute a bound receipt without writing any output file."""
    receipt = read_json(path)
    report = verify(receipt['oldJar']['file'], receipt['newJar']['file'])
    report = bind_construction(report, receipt['constructionNative']['file'])
    tool_ok = receipt.get('tool') == report.get('tool')
    identical = receipt == report
    return {'passed': report['passed'] and tool_ok and identical, 'actualMinecraft': False, 'readOnly': True,
            'receiptFile': str(Path(path).resolve()), 'receiptSHA256': sha(path),
            'receiptExactlyReproduced': identical, 'verifierBytesUnchanged': tool_ok, 'verification': report}


def self_test():
    import tempfile, warnings
    checks = []
    with tempfile.TemporaryDirectory(prefix='fcraft-packmeta-proof-') as folder:
        root = Path(folder); (root/'old').mkdir(); (root/'new').mkdir()
        old, new = root/'old'/NAME, root/'new'/NAME
        baseline = {name: b'\xca\xfe\xba\xbe'+name.encode() for name in CLASSES}
        baseline.update({'META-INF/mods.toml': b'original mod registration', 'fcraft_raid.mixins.json': b'original mixin list'})
        metadata = json.dumps({'pack': {'pack_format': 15, 'description': 'F-Craft Raid Bridge resources'}}).encode()
        def write(path, entries):
            with zipfile.ZipFile(path, 'w') as jar:
                for name, data in entries.items():
                    jar.writestr(name, data)
        def case(name, old_entries, new_entries, expected):
            write(old, old_entries); write(new, new_entries)
            result = verify(old, new)
            ok = result['passed'] is expected
            checks.append({'name': name, 'passed': ok}); assert ok, name
        amended = dict(baseline, **{'pack.mcmeta': metadata})
        case('all original bytes and only simple metadata added passes', baseline, amended, True)
        changed = dict(amended); changed['fcraft/raid/RaidBridge.class'] += b'changed'
        case('changed class byte fails', baseline, changed, False)
        changed = dict(amended); changed['fcraft_raid.mixins.json'] += b'changed'
        case('changed original resource fails', baseline, changed, False)
        changed = dict(amended); changed['extra_resource.txt'] = b'extra'
        case('any second added entry fails', baseline, changed, False)
        changed = dict(amended); del changed['META-INF/mods.toml']
        case('removed original entry fails', baseline, changed, False)
        changed = dict(amended); changed['pack.mcmeta'] = b'{"pack":{"pack_format":14,"description":"wrong"}}'
        case('wrong resource pack format fails', baseline, changed, False)
        changed = dict(amended); changed['pack.mcmeta'] = b'{"pack":{"pack_format":15,"description":"ok"},"overlays":{}}'
        case('additional metadata features fail', baseline, changed, False)
        changed = dict(amended); changed['pack.mcmeta'] = b'{"pack":{"pack_format":15,"pack_format":14,"description":"duplicate"}}'
        case('duplicate metadata keys fail', baseline, changed, False)
        write(old, baseline); write(new, amended)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(new, 'a') as jar:
                jar.writestr('pack.mcmeta', metadata)
        checks.append({'name': 'duplicate ZIP entry names fail', 'passed': not verify(old, new)['passed']})
        assert checks[-1]['passed']
    return {'passed': True, 'actualMinecraft': False, 'tests': len(checks), 'checks': checks}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--old', type=Path)
    parser.add_argument('--new', type=Path)
    parser.add_argument('--construction-result', type=Path, default=ROOT/'검증/native/arena_v104_06/result.json')
    parser.add_argument('--output', type=Path, help='Optional new receipt; existing receipts are never overwritten')
    parser.add_argument('--check-receipt', type=Path, help='Recompute receipt read-only; stdout only')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        result = self_test()
    elif args.check_receipt:
        if args.output or args.old or args.new:
            parser.error('--check-receipt is read-only and accepts no --output/--old/--new')
        result = verify_receipt(args.check_receipt)
    else:
        if args.old is None or args.new is None:
            parser.error('--old and --new are required')
        result = bind_construction(verify(args.old, args.new), args.construction_result)
        if args.output:
            if args.output.exists():
                raise ValueError('Preserve existing metadata-only receipt')
            if args.output.resolve() in {args.old.resolve(), args.new.resolve(), args.construction_result.resolve(), Path(__file__).resolve()}:
                raise ValueError('Receipt may not replace any input')
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result['passed'] else 1)
