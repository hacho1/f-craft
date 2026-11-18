"""Repackage the preserved ResourcePackInfo ZIP with the quest visibility fix.

Default is a dry check; no ZIP is created. After root GO, --build requires:
 {"ready":true,"guide":"설치_검증_가이드_v10_6.md",
  "actualClientResult":"검증/.../result.json",
  "installationReceipt":"검증/.../receipt.json","evidence":["검증/...",...]}
The client result must identify the exact current JAR through sourceJarSHA256,
promotionJarSHA256, or candidateHashes['mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'].
Every supplied JAR hash must agree.
The client result must also bind sourceChapterSHA256 or the chapter candidateHash.
Historical gameplay/startup proof is copied unchanged, with fresh proof stored
under a separate quest_visibility_hotfix_v106 evidence directory.
"""
from pathlib import Path, PurePosixPath
import argparse
import copy
import hashlib
import io
import json
import re
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'F-Craft_v10_6/'
ORIGINAL = ROOT / '배포/F-Craft_v10_6_ResourcePackInfo_수정판.zip'
OUTPUT = ROOT / '배포/F-Craft_v10_6_퀘스트표시_수정판.zip'
PROMOTION = 'fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'
HOTFIX = PREFIX + '검증/quest_visibility_hotfix_v106/'
MIXINS = 'fcraft_promotion_bridge.mixins.json'
BOUNDS_MIXIN = 'PersonalQuestPanelBoundsMixin'
BOUNDS_CLASS = 'fcraft/promotion/mixin/' + BOUNDS_MIXIN + '.class'
CHAPTER = 'config/ftbquests/quests/chapters/01_ch1_arrival_and_guild.snbt'
ARRIVAL_COORDS = [(0.0, 0.0), (2.0, 0.0), (4.0, 0.0),
                  (4.0, 3.0), (2.0, 3.0), (0.0, 3.0)]


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def sha_file(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        while raw := stream.read(1024 * 1024):
            h.update(raw)
    return h.hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def source_path(raw):
    path = Path(raw)
    path = (path if path.is_absolute() else ROOT / path).resolve()
    require(path.is_relative_to(ROOT.resolve()) and path.is_file(),
            'Out-of-scope or missing input ' + str(path))
    return path


def safe_relative(name):
    path = PurePosixPath(name)
    return bool(name) and not path.is_absolute() and '..' not in path.parts and '\\' not in name and '\x00' not in name


def member_row(raw, directory=False):
    return {'sha256': sha_bytes(raw), 'bytes': len(raw),
            'crc32': zlib.crc32(raw) & 0xffffffff, 'directory': directory}


def inspect_archive(path):
    rows = {}
    with zipfile.ZipFile(path) as archive:
        require(archive.testzip() is None, 'CRC failure ' + str(path))
        for info in archive.infolist():
            name = info.filename
            require(safe_relative(name) and name.startswith(PREFIX), 'Unsafe archive member ' + name)
            require(name not in rows, 'Duplicate archive member ' + name)
            raw = archive.read(info)
            require(zlib.crc32(raw) & 0xffffffff == info.CRC, 'CRC mismatch ' + name)
            rows[name] = member_row(raw, info.is_dir())
    return rows


def jar_entries(raw):
    entries = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as jar:
        require(jar.testzip() is None, 'Inner JAR CRC failure')
        for info in jar.infolist():
            require(safe_relative(info.filename), 'Unsafe inner JAR member ' + info.filename)
            require(info.filename not in entries, 'Duplicate inner JAR member ' + info.filename)
            entries[info.filename] = jar.read(info)
    return entries


def bounds_delta(old_raw, new_raw):
    """This fix adds executable code; never call it metadata-only equivalence."""
    old, new = jar_entries(old_raw), jar_entries(new_raw)
    require(set(new) - set(old) == {BOUNDS_CLASS} and not (set(old) - set(new)),
            'Expected only the single bounds mixin class addition')
    changed = sorted(name for name in old if old[name] != new[name])
    require(changed == [MIXINS], 'Existing JAR bytes changed outside mixins JSON')
    before, after = json.loads(old[MIXINS]), json.loads(new[MIXINS])
    old_clients, new_clients = before.pop('client'), after.pop('client')
    require(canonical_json(before) == canonical_json(after) and new_clients == old_clients + [BOUNDS_MIXIN],
            'Mixin configuration must only append the new client bounds mixin')
    require(new[BOUNDS_CLASS].startswith(b'\xca\xfe\xba\xbe'), 'Bounds mixin is not a Java class')
    require('pack.mcmeta' in old and old['pack.mcmeta'] == new['pack.mcmeta'],
            'Existing pack.mcmeta bytes must be preserved')
    pack = json.loads(new['pack.mcmeta'])
    require(pack['pack']['pack_format'] == 15 and bool(pack['pack']['description']),
            'Invalid Minecraft 1.20.1 pack metadata')
    classes = sorted(name for name in old if name.endswith('.class'))
    return {'passed': True, 'metadataOnly': False,
            'oldJarSHA256': sha_bytes(old_raw), 'newJarSHA256': sha_bytes(new_raw),
            'addedJarEntries': [BOUNDS_CLASS], 'changedExistingJarEntries': changed,
            'preservedClassEntries': classes, 'allExistingClassBytesIdentical': True,
            'allOtherResourceBytesIdentical': True, 'packMetadataBytesIdentical': True,
            'packFormat': 15, 'oldClientMixins': old_clients, 'newClientMixins': new_clients}


def arrival_layout_delta(old_raw, new_raw):
    before, after = json.loads(old_raw), json.loads(new_raw)
    expected = copy.deepcopy(before)
    ids = ['790000000000000' + str(i) for i in range(1, 7)]
    expected_quests = expected['quests']
    require(len({quest['id'] for quest in expected_quests}) == len(expected_quests),
            'Original chapter has duplicate quest IDs')
    rows = []
    for quest_id, (x, y) in zip(ids, ARRIVAL_COORDS):
        matches = [quest for quest in expected_quests if quest['id'] == quest_id]
        require(len(matches) == 1, 'Missing exact arrival quest ' + quest_id)
        quest = matches[0]
        rows.append({'id': quest_id, 'before': {'x': quest.get('x'), 'y': quest.get('y')},
                     'after': {'x': x, 'y': y}})
        quest['x'], quest['y'] = x, y
    require(canonical_json(after) == canonical_json(expected),
            'Chapter changed outside the six approved arrival x/y coordinates')
    return {'passed': True, 'oldChapterSHA256': sha_bytes(old_raw),
            'newChapterSHA256': sha_bytes(new_raw), 'approvedCoordinates': rows,
            'allOtherQuestAndChapterFieldsUnchanged': True,
            'questIdsTasksRewardsDependenciesAndProgressionUnchanged': True}


def manifest_jar_rows(value):
    if isinstance(value, dict):
        if value.get('file') == PROMOTION:
            yield value
        for nested in value.values():
            yield from manifest_jar_rows(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from manifest_jar_rows(nested)


def client_jar_sha_matches(result, expected):
    values = [result.get('sourceJarSHA256'), result.get('promotionJarSHA256'),
              result.get('candidateHashes', {}).get('mods/' + PROMOTION)]
    values = [value for value in values if value is not None]
    return bool(values) and all(value == expected for value in values)


def client_chapter_sha_matches(result, expected):
    values = [result.get('sourceChapterSHA256'), result.get('candidateHashes', {}).get(CHAPTER)]
    values = [value for value in values if value is not None]
    return bool(values) and all(value == expected for value in values)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--label', required=True)
    parser.add_argument('--build', action='store_true')
    parser.add_argument('--final-inputs', type=Path)
    args = parser.parse_args()
    require(re.fullmatch(r'[A-Za-z0-9_]+', args.label), 'Unsafe receipt label')
    receipt_dir = ROOT / '검증/package_quest_visibility_hotfix_v106' / args.label
    require(not receipt_dir.exists(), 'Preserve earlier receipt; choose a new label')
    require(ORIGINAL.is_file(), 'Original ResourcePackInfo package missing')
    require(not OUTPUT.exists(), 'Preserve existing quest visibility package')
    require(not args.build or args.final_inputs is not None, 'Build requires root-prepared final inputs after GO')
    original_sha, original = sha_file(ORIGINAL), inspect_archive(ORIGINAL)

    def unique(suffix):
        matches = [name for name in original if name.endswith(suffix)]
        require(len(matches) == 1, 'Expected one exact archive member ' + suffix)
        return matches[0]

    jar_member = unique('/수정파일/mods/' + PROMOTION)
    manifest_member = unique('/수정파일/modpack_manifest_1.20.1_forge.json')
    guide_member = unique('/설치_검증_가이드_v10_6.md')
    chapter_member = unique('/수정파일/' + CHAPTER)
    source_jar = source_path('수정파일/mods/' + PROMOTION)
    source_manifest = source_path('수정파일/modpack_manifest_1.20.1_forge.json')
    source_chapter = source_path('수정파일/' + CHAPTER)
    build_path = source_path('검증/promotion_bridge_build.json')
    regression_path = source_path('검증/v10_6_quest_panel_bounds_regression.json')
    # Snapshot all input bytes once; detect changes before/after archive creation.
    sources = {}

    def snapshot(path):
        if path not in sources:
            sources[path] = path.read_bytes()
        return sources[path]

    jar_raw, manifest_raw = snapshot(source_jar), snapshot(source_manifest)
    chapter_raw = snapshot(source_chapter)
    jar_sha = sha_bytes(jar_raw)
    with zipfile.ZipFile(ORIGINAL) as archive:
        delta = bounds_delta(archive.read(jar_member), jar_raw)
        layout_delta = arrival_layout_delta(archive.read(chapter_member), chapter_raw)
    manifest = json.loads(manifest_raw)
    matches = list(manifest_jar_rows(manifest))
    require(len(matches) == 1 and matches[0].get('sha256') == jar_sha,
            'Current manifest does not bind current bounds-fix JAR')
    require(manifest.get('release_channel') == 'private-development', 'Preserve private-use release channel')
    build, regression = json.loads(snapshot(build_path)), json.loads(snapshot(regression_path))
    require(build.get('passed') is True and build.get('sha256') == jar_sha,
            'Build report must pass for the current bounds-fix JAR')
    require(regression.get('passed') is True and regression.get('jarSha256') == jar_sha,
            'Bounds regression must pass for the current JAR')
    require(regression.get('preimageSha256') == delta['oldJarSHA256'],
            'Bounds regression preimage must match the original archive JAR')
    require(regression.get('chapterFilesSha256', {}).get(Path(CHAPTER).name) == sha_bytes(chapter_raw),
            'Bounds regression must bind the final arrival chapter layout')
    replacements = {jar_member: source_jar, manifest_member: source_manifest, chapter_member: source_chapter}
    final_sources, final_evidence = {}, None
    if args.final_inputs:
        spec_path = source_path(args.final_inputs)
        spec = json.loads(snapshot(spec_path))
        require(spec.get('ready') is True, 'Final inputs are not declared ready')
        guide = source_path(spec['guide'])
        client_path = source_path(spec['actualClientResult'])
        install_path = source_path(spec['installationReceipt'])
        client, install = json.loads(snapshot(client_path)), json.loads(snapshot(install_path))
        require(client.get('passed') is True and client.get('actualMinecraft') is True
                and client.get('actualClient') is True, 'Fresh actual client validation must pass')
        require(client_jar_sha_matches(client, jar_sha),
                'Actual client validation must identify the current JAR with no conflicting hashes')
        require(client_chapter_sha_matches(client, sha_bytes(chapter_raw)),
                'Actual client validation must identify the final chapter layout with no conflicting hashes')
        require(install.get('installed') is True, 'Actual quest visibility installation receipt required')
        replacements[guide_member] = guide
        final_sources = {HOTFIX + 'actual_client_result.json': client_path,
                         HOTFIX + 'installation_receipt.json': install_path,
                         HOTFIX + 'final_inputs.json': spec_path}
        for raw in [build_path, regression_path, *spec.get('evidence', [])]:
            path = source_path(raw)
            name = HOTFIX + 'evidence/' + path.name
            require(name not in final_sources or final_sources[name] == path,
                    'Duplicate final evidence basename ' + path.name)
            final_sources[name] = path
        require(all(name not in original for name in final_sources),
                'New evidence must not overwrite archived historical proof')
        final_evidence = {'spec': str(spec_path), 'actualClientResult': str(client_path),
                          'installationReceipt': str(install_path),
                          'evidenceMembers': sorted(final_sources)}
    for path in [*replacements.values(), *final_sources.values()]:
        snapshot(path)
    input_hashes = {str(path): sha_bytes(raw) for path, raw in sources.items()}
    expected = copy.deepcopy(original)
    for name, path in {**replacements, **final_sources}.items():
        expected[name] = member_row(sources[path])
    licenses = [name for name in original if '/LICENSE_' in name]
    require(bool(licenses), 'Original license notices missing')
    changed = sorted(name for name in original if expected[name] != original[name])
    require(set(changed).issubset(replacements), 'Unexpected original-member change')
    require(all(expected[name] == original[name] for name in licenses), 'License notices changed')
    require(sha_file(ORIGINAL) == original_sha, 'Original package changed before build')
    require(all(sha_file(path) == input_hashes[str(path)] for path in sources),
            'Packaging inputs changed before build')
    actual = None
    if args.build:
        with zipfile.ZipFile(ORIGINAL) as old, zipfile.ZipFile(OUTPUT, 'x') as new:
            new.comment = old.comment
            for info in old.infolist():
                raw = sources[replacements[info.filename]] if info.filename in replacements else old.read(info)
                new.writestr(copy.copy(info), raw)
            for name, path in sorted(final_sources.items()):
                info = zipfile.ZipInfo(name, (2026, 11, 17, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                new.writestr(info, sources[path])
        actual = inspect_archive(OUTPUT)
        require(actual == expected, 'Full output member count/SHA/CRC/size verification failed')
    require(sha_file(ORIGINAL) == original_sha, 'Original package changed')
    require(all(sha_file(path) == input_hashes[str(path)] for path in sources),
            'Packaging inputs changed during check')
    receipt = {'passed': True, 'actualMinecraft': False, 'dryRun': not args.build,
               'archiveCreated': args.build, 'original': str(ORIGINAL),
               'originalSHA256': original_sha, 'originalPreserved': True,
               'output': str(OUTPUT), 'outputSHA256': sha_file(OUTPUT) if args.build else None,
               'outputBytes': OUTPUT.stat().st_size if args.build else None,
               'originalMemberCount': len(original), 'expectedMemberCount': len(expected),
               'actualMemberCount': len(actual) if actual is not None else None,
               'originalCRCVerified': True, 'outputCRCVerified': True if args.build else None,
               'everyOutputMemberSHAVerified': True if args.build else None,
               'archiveMembersDiscovered': {'promotionJar': jar_member, 'manifest': manifest_member,
                                            'guide': guide_member, 'arrivalChapter': chapter_member},
               'changedOriginalMembers': changed, 'addedEvidenceMembers': sorted(final_sources),
               'licenseMembersPreserved': licenses, 'privateUseDesignationPreserved': True,
               'publicRedistributionPermissionImplied': False, 'wholeWorldAdded': False,
               'jarCodeDelta': delta,
               'arrivalLayoutDelta': layout_delta,
               'evidenceScope': {
                   'historicalEvidence': 'All existing 529-server/1083-client and earlier startup proof members remain byte-identical historical records for their original artifacts.',
                   'freshEvidence': 'This executable bounds-mixin change is supported by its separate build, regression, actual client, and installation records; historical checks are not relabeled.',
                   'finalEvidence': final_evidence},
               'inputHashes': input_hashes, 'originalMemberHashes': original,
               'expectedMemberHashes': expected, 'actualOutputMemberHashes': actual,
               'packagerSHA256': sha_file(Path(__file__))}
    receipt_dir.mkdir(parents=True)
    receipt_path = receipt_dir / 'receipt.json'
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: receipt[key] for key in ['passed', 'dryRun', 'archiveCreated',
          'originalPreserved', 'originalMemberCount', 'expectedMemberCount',
          'changedOriginalMembers', 'output', 'outputSHA256']} | {'receipt': str(receipt_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
