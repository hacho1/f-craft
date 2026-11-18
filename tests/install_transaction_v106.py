"""Synthetic, real-filesystem transaction tests. Never opens the actual LIVE tree.

Only ROOT/LIVE and desktop identity/idle checks are substituted in memory.
SHA, ZIP, no_links, full_inventory, staging, replace, retirement and rollback run
the shipping installer. Explicit faults raise at its real transaction boundary.
"""
from pathlib import Path
import contextlib
import hashlib
import importlib.util
import io
import json
import shutil
import sys
import tempfile
import time
import uuid
import zipfile
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / '검증'
TOOL = ROOT / 'tools/install_update_v106.py'
OUTPUT = AUDIT / 'v10_6_installer_transaction_regression.json'
RETIRED = [
    '01_prologue_first_id.snbt', '02_combat_jobs_track.snbt',
    '03_life_jobs_track.snbt', '04_exploration_jobs_track.snbt',
    '05_villager_bonds_and_stories.snbt', '06_mainland_frontier_chapter2.snbt',
    '98_legacy_promotion_archive_phase4.snbt', 'zz_legacy_mainland_records_v99.snbt',
]
NEW = ['01_ch1_arrival_and_guild.snbt', '02_my_job_promotions.snbt',
       '03_serdin_and_three_bosses.snbt', '04_village_life_and_requests.snbt']
CHAPTERS = 'config/ftbquests/quests/chapters/'


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def put(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def json_put(path, value):
    put(path, (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode())


spec = importlib.util.spec_from_file_location('_installer_transaction_under_test', TOOL)
INSTALL = importlib.util.module_from_spec(spec)
spec.loader.exec_module(INSTALL)
CORE = INSTALL.CORE
REAL_LIVE = INSTALL.LIVE
ORIGINAL_TOOL_SHA = digest(TOOL)


class Fixture:
    def __init__(self, custom_chapter=False, presentation_mods=False, live_presentation='exact'):
        self.directory = Path(tempfile.mkdtemp(prefix='installer_v106_fixture_', dir=AUDIT)).resolve()
        self.marker = str(uuid.uuid4())
        put(self.directory / '.owned_installer_fixture', self.marker.encode())
        self.root = self.directory / 'project'
        self.live = self.directory / 'synthetic_forge_profile'
        self.label = 'transaction_case'
        self.identity_calls = 0
        self.idle_calls = 0
        self.root.mkdir()
        self.live.mkdir()
        assert self.live != REAL_LIVE and self.live.is_relative_to(AUDIT.resolve())
        for index, name in enumerate(RETIRED):
            put(self.live / CHAPTERS / name, ('OLD chapter %d %s\n' % (index, name)).encode())
        put(self.live / 'kubejs/server_scripts/update.js', b'old script\n')
        put(self.live / 'config/personal_settings.cfg', b'untouched personal configuration\x00\xff')
        put(self.live / 'config/keep.user.tmp', b'preexisting unrelated temp is preserved')
        json_put(self.live / 'minecraftinstance.json', {
            'name': 'synthetic profile', 'gameVersion': '1.20.1',
            'installedAddons': [{'addonID': 100, 'fileID': 200}],
            'lastPreviousMatchUpdate': '2026-11-17T00:00:00Z',
            'userSettings': {'memoryMB': 6144, 'personal': 'preserve exactly', 'enabled': True, 'flags': [True, False]},
            'launchEnabled': True,
            'nullableUserSetting': None,
        })
        put(self.live / 'saves/ExistingWorld/level.dat', b'NBT original world sentinel\x00\x01\xff')
        put(self.live / 'saves/ExistingWorld/region/r.0.0.mca', bytes(range(256)) * 32)
        put(self.live / 'saves/ExistingWorld/playerdata/owner.dat', b'original personal progress\x00')
        if custom_chapter:
            put(self.live / CHAPTERS / 'custom_user_story.snbt', b'USER CREATED - KEEP EXACT\n')
        for index, name in enumerate(NEW):
            put(self.root / '수정파일' / CHAPTERS / name,
                ('{title:"synthetic chapter %d",quests:[]}\n' % index).encode())
        json_put(self.root / '수정파일/config/f_rank_days/quest_chapter_migration_v106.json',
                 {'synthetic': True, 'retiredFiles': RETIRED, 'newFiles': NEW})
        put(self.root / '수정파일/kubejs/server_scripts/update.js', b'new verified synthetic payload\n')
        put(self.root / '수정파일/kubejs/client_scripts/new_feature.js', b'new synthetic client payload\n')
        self.presentation_before = {}
        if presentation_mods:
            assert live_presentation in {'exact', 'missing', 'tampered'}
            for index, (rel, checksum) in enumerate(INSTALL.UNCHANGED_PRESENTATION_MODS.items()):
                # Read only the reviewed E: product files, never the real LIVE profile.
                source = ROOT / '수정파일' / rel
                assert digest(source) == checksum, 'Reviewed E: presentation source differs'
                content = source.read_bytes()
                put(self.root / '수정파일' / rel, content)
                if index == 0 and live_presentation == 'missing':
                    continue
                put(self.live / rel, content + (b' altered fixture' if index == 0 and live_presentation == 'tampered' else b''))
                self.presentation_before[rel] = (digest(self.live / rel), (self.live / rel).stat().st_mtime_ns)
        with patch.object(INSTALL, 'ROOT', self.root):
            self.candidate = INSTALL.product()
        self.leaf = self.root / '검증/native/synthetic_source/result.json'
        # These inputs exercise receipt validation only. They are NOT game proof.
        json_put(self.leaf, {'synthetic': True, 'notRealMinecraftExecution': True,
                             'passed': False, 'reason': 'retained source failure fixture'})
        server = self.root / '검증/native/synthetic_aggregate.json'
        client = self.root / '검증/native_client/synthetic/result.json'
        json_put(server, {'synthetic': True, 'notRealMinecraftExecution': True,
                         'passed': True, 'actualMinecraft': True,
                         'codeHashes': self.candidate,
                         'sourceReports': [{'path': str(self.leaf), 'sha256': digest(self.leaf)}]})
        json_put(client, {'synthetic': True, 'notRealMinecraftExecution': True,
                         'passed': True, 'actualMinecraft': True, 'candidateHashes': self.candidate})
        self.proof = self.root / '검증/v10_6_integrated_verification.json'
        json_put(self.proof, {'synthetic': True, 'notRealMinecraftExecution': True,
                            'passed': True, 'actualMinecraft': True, 'candidateHashes': self.candidate,
                            'server': {'path': str(server), 'sha256': digest(server)},
                            'client': {'path': str(client), 'sha256': digest(client)}})
        self.server = server
        self.before = CORE.full_inventory(self.live)
        self.save_before = {k: v for k, v in self.before.items() if k.startswith('saves/')}
        self.archive = self.root / '백업/full_preimage.zip'
        self.archive.parent.mkdir()
        with zipfile.ZipFile(self.archive, 'w', zipfile.ZIP_DEFLATED) as archive:
            for rel in self.before:
                archive.write(self.live / rel, rel)
        with zipfile.ZipFile(self.archive) as archive:
            assert archive.testzip() is None
            for rel, row in self.before.items():
                assert hashlib.sha256(archive.read(rel)).hexdigest() == row['sha256']
        json_put(self.root / '검증/live_pre_v106_backup.json', {
            'synthetic': True, 'path': str(self.archive), 'sha256': digest(self.archive),
            'crcVerified': True, 'entryHashesVerified': True, 'fullInventory': self.before,
        })

    def identity(self):
        assert INSTALL.ROOT == self.root and INSTALL.LIVE == self.live
        assert self.live != REAL_LIVE
        CORE.no_links(self.root, self.directory)
        CORE.no_links(self.live, self.directory)
        self.identity_calls += 1

    def idle(self):
        # Unit fixture has no desktop process query or real game process.
        self.idle_calls += 1

    def run(self, fault_context=None):
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(INSTALL, 'ROOT', self.root))
            stack.enter_context(patch.object(INSTALL, 'LIVE', self.live))
            stack.enter_context(patch.object(CORE, 'identity', self.identity))
            stack.enter_context(patch.object(CORE, 'require_idle', self.idle))
            stack.enter_context(patch.object(sys, 'argv', ['unit_installer', '--apply', '--label', self.label]))
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            if fault_context:
                stack.enter_context(fault_context)
            INSTALL.main()

    def unchanged(self):
        assert CORE.full_inventory(self.live) == self.before
        assert not list(self.live.rglob('*.v106_' + self.label + '.tmp'))
        assert {k: v for k, v in CORE.full_inventory(self.live).items()
                if k.startswith('saves/')} == self.save_before

    def close(self):
        final = self.directory.resolve()
        assert final.parent == AUDIT.resolve() and final.name.startswith('installer_v106_fixture_')
        assert (final / '.owned_installer_fixture').read_text() == self.marker
        shutil.rmtree(final)


@contextlib.contextmanager
def fixture(**kwargs):
    value = Fixture(**kwargs)
    try:
        yield value
    finally:
        value.close()


def rejects(value, message, context=None):
    try:
        value.run(context)
    except (RuntimeError, OSError) as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError('Installer accepted a deliberately invalid fixture')
    value.unchanged()


def successful_install():
    with fixture() as value:
        value.run()
        after = CORE.full_inventory(value.live)
        expected = dict(value.before)
        for rel, checksum in value.candidate.items():
            expected[rel] = {'sha256': checksum, 'bytes': (value.root / '수정파일' / rel).stat().st_size}
        for name in RETIRED:
            expected.pop(CHAPTERS + name)
        assert after == dict(sorted(expected.items()))
        assert {k: v for k, v in after.items() if k.startswith('saves/')} == value.save_before
        assert len(list((value.live / CHAPTERS).glob('*.snbt'))) == 4
        assert not list(value.live.rglob('*.v106_' + value.label + '.tmp'))
        receipt = INSTALL.read(value.root / '검증/install_v106' / value.label / 'receipt.json')
        assert receipt['installed'] and receipt['allSavesPreserved'] and not receipt['worldMigrationPerformed']
        assert len(receipt['retiredChapters']) == 8
        assert value.identity_calls == 1 and value.idle_calls > 2


def unknown_custom_chapter():
    with fixture(custom_chapter=True) as value:
        rejects(value, 'Unreviewed custom chapters must be preserved')
        assert not (value.root / '검증/install_v106').exists()


def exact_baseline_presentation_mods():
    with fixture(presentation_mods=True) as value:
        assert set(value.presentation_before) == set(INSTALL.UNCHANGED_PRESENTATION_MODS)
        value.run()
        for rel, checksum in INSTALL.UNCHANGED_PRESENTATION_MODS.items():
            assert value.candidate[rel] == checksum
            assert value.before[rel]['sha256'] == checksum
            # Existing exact payloads are verified, not rewritten.
            assert (digest(value.live / rel), (value.live / rel).stat().st_mtime_ns) == value.presentation_before[rel]
        after = CORE.full_inventory(value.live)
        assert {k: v for k, v in after.items() if k.startswith('saves/')} == value.save_before
        receipt = INSTALL.read(value.root / '검증/install_v106' / value.label / 'receipt.json')
        assert receipt['passed'] and receipt['allSavesPreserved']
        assert not list(value.live.rglob('*.v106_' + value.label + '.tmp'))


def tampered_baseline_presentation_mods():
    with fixture(presentation_mods=True) as value:
        rel = next(iter(INSTALL.UNCHANGED_PRESENTATION_MODS))
        payload = value.root / '수정파일' / rel
        put(payload, payload.read_bytes() + b' altered candidate fixture')
        rejects(value, 'Unreviewed or changed presentation mod ' + rel)
        assert not (value.root / '검증/install_v106').exists()
    # A matching full backup cannot authorize an already altered existing mod.
    with fixture(presentation_mods=True, live_presentation='tampered') as value:
        rel = next(iter(INSTALL.UNCHANGED_PRESENTATION_MODS))
        rejects(value, 'Existing presentation mod differs or is missing ' + rel)
        assert not (value.root / '검증/install_v106').exists()


def unknown_mod_payload():
    with fixture() as value:
        rel = 'mods/unreviewed_custom_presentation.jar'
        put(value.root / '수정파일' / rel, b'synthetic unreviewed jar payload')
        rejects(value, 'Unreviewed or changed presentation mod ' + rel)
        assert not (value.root / '검증/install_v106').exists()


def missing_existing_presentation_mod():
    with fixture(presentation_mods=True, live_presentation='missing') as value:
        rel = next(iter(INSTALL.UNCHANGED_PRESENTATION_MODS))
        assert rel not in value.before
        rejects(value, 'Existing presentation mod differs or is missing ' + rel)
        assert not (value.root / '검증/install_v106').exists()


def changed_candidate():
    with fixture() as value:
        put(value.root / '수정파일/kubejs/server_scripts/update.js', b'changed after proof')
        rejects(value, 'Product changed after verification')


def changed_execution_receipt():
    with fixture() as value:
        put(value.server, value.server.read_bytes() + b' ')
        rejects(value, 'Execution receipt changed server')


def changed_leaf_receipt():
    with fixture() as value:
        put(value.leaf, value.leaf.read_bytes() + b' ')
        rejects(value, 'Native source execution receipt changed')


def changed_backup():
    with fixture() as value:
        put(value.archive, value.archive.read_bytes() + b'changed')
        rejects(value, 'Backup checksum differs')


def complete_rollback_after_retirement():
    with fixture() as value:
        original_reconcile = INSTALL.reconcile_launcher_metadata
        injected = []
        def boundary(expected, current, previous):
            if all(not (value.live / CHAPTERS / name).exists() for name in RETIRED) and not injected:
                assert all((value.live / rel).is_file() and digest(value.live / rel) == checksum
                           for rel, checksum in value.candidate.items())
                injected.append(True)
                raise RuntimeError('injected after all writes and eight retirements')
            return original_reconcile(expected, current, previous)
        rejects(value, 'injected after all writes and eight retirements',
                patch.object(INSTALL, 'reconcile_launcher_metadata', boundary))
        assert injected == [True]
        assert not (value.root / '검증/install_v106' / value.label / 'receipt.json').exists()


def partial_same_volume_copy_rollback():
    with fixture() as value:
        original_copy = INSTALL.shutil.copyfile
        injected = []
        def copy(source, destination, *args, **kwargs):
            destination = Path(destination)
            if destination.name.endswith('.v106_' + value.label + '.tmp') and not injected:
                assert destination.resolve().is_relative_to(value.live.resolve())
                put(destination, b'partial interrupted same-volume temporary payload')
                injected.append(True)
                raise OSError('injected partial temp copy failure')
            return original_copy(source, destination, *args, **kwargs)
        rejects(value, 'injected partial temp copy failure',
                patch.object(INSTALL.shutil, 'copyfile', copy))
        assert injected == [True]


def containment_rejects_escape():
    with fixture() as value, patch.object(INSTALL, 'ROOT', value.root), patch.object(INSTALL, 'LIVE', value.live):
        for rel in ['../escape.txt', 'C:/outside.txt']:
            try:
                INSTALL.target(rel)
            except RuntimeError:
                pass
            else:
                raise AssertionError('Traversal escaped fixture boundary')
        value.unchanged()


def update_launcher(value, change):
    path = value.live / 'minecraftinstance.json'
    document = json.loads(path.read_bytes())
    change(document)
    json_put(path, document)
    return path.read_bytes()


def permitted_launcher_update(document):
    document['installedAddons'].append({'addonID': 101, 'fileID': 201})
    document['lastPreviousMatchUpdate'] = '2026-11-17T12:34:56Z'


def assert_only_external_changes(value, external):
    expected = dict(value.before)
    for rel, content in external.items():
        if content is None:
            expected.pop(rel)
        else:
            expected[rel] = {'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}
    after = CORE.full_inventory(value.live)
    assert after == dict(sorted(expected.items()))
    assert {k: v for k, v in after.items() if k.startswith('saves/')} == value.save_before
    assert not list(value.live.rglob('*.v106_' + value.label + '.tmp'))
    assert (value.live / 'config/keep.user.tmp').read_bytes() == b'preexisting unrelated temp is preserved'


def expect_rejection(value, message, fault=None):
    try:
        value.run(fault)
    except (RuntimeError, OSError, ValueError) as error:
        if message:
            assert message in str(error), str(error)
    else:
        raise AssertionError('Unexpected external state was accepted')
    assert not (value.root / '검증/install_v106' / value.label / 'receipt.json').exists()


@contextlib.contextmanager
def inventory_race(value, call_number, mutate, state):
    original = CORE.full_inventory
    def inventory(path):
        if Path(path) == value.live:
            state['calls'] = state.get('calls', 0) + 1
            if state['calls'] == call_number:
                if call_number == 3:
                    assert all(not (value.live / CHAPTERS / name).exists() for name in RETIRED)
                    assert all(digest(value.live / rel) == checksum for rel, checksum in value.candidate.items())
                mutate()
                state['triggered'] = True
        return original(path)
    with patch.object(CORE, 'full_inventory', inventory):
        yield


def launcher_update_before_install():
    with fixture() as value:
        changed = update_launcher(value, permitted_launcher_update)
        value.run()
        receipt = INSTALL.read(value.root / '검증/install_v106' / value.label / 'receipt.json')
        record = receipt['launcherMetadataUpdatedBeforeInstall']
        assert set(record['changedKeys']) == {'installedAddons', 'lastPreviousMatchUpdate'}
        assert record['preservedExternalLauncherUpdate'] and not record['writtenByInstaller']
        assert (value.live / 'minecraftinstance.json').read_bytes() == changed
        assert Path(receipt['launcherMetadataPreimage']['path']).read_bytes() == changed
        assert receipt['allSavesPreserved']


def launcher_update_during_staging_or_install():
    for call_number, field in [(2, 'launcherMetadataUpdatedDuringStaging'), (3, 'launcherMetadataUpdatedDuringInstall')]:
        with fixture() as value:
            state = {}
            external = {}
            def mutate():
                external['minecraftinstance.json'] = update_launcher(value, permitted_launcher_update)
            value.run(inventory_race(value, call_number, mutate, state))
            assert state['triggered']
            receipt = INSTALL.read(value.root / '검증/install_v106' / value.label / 'receipt.json')
            assert set(receipt[field]['changedKeys']) == {'installedAddons', 'lastPreviousMatchUpdate'}
            assert receipt['allSavesPreserved']
            assert (value.live / 'minecraftinstance.json').read_bytes() == external['minecraftinstance.json']


def unreviewed_launcher_settings():
    def change_setting(document):
        permitted_launcher_update(document)
        document['userSettings']['memoryMB'] = 8192
    for call_number in [None, 3]:
        with fixture() as value:
            external = {}
            def mutate():
                external['minecraftinstance.json'] = update_launcher(value, change_setting)
            state = {}
            if call_number is None:
                mutate()
                expect_rejection(value, 'Unreviewed launcher setting changed')
            else:
                expect_rejection(value, 'Unreviewed launcher setting changed', inventory_race(value, call_number, mutate, state))
                assert state['triggered']
            assert_only_external_changes(value, external)


def launcher_null_key_presence():
    for remove_existing in [False, True]:
        with fixture() as value:
            def change(document):
                permitted_launcher_update(document)
                if remove_existing:
                    del document['nullableUserSetting']
                else:
                    document['newUnreviewedSetting'] = None
            changed = update_launcher(value, change)
            expect_rejection(value, 'Unreviewed launcher setting changed')
            assert_only_external_changes(value, {'minecraftinstance.json': changed})


def launcher_typed_setting_changes():
    for nesting in ['root', 'nested_dictionary', 'nested_list']:
        for call_number in [None, 3]:
            with fixture() as value:
                external = {}
                def change(document):
                    permitted_launcher_update(document)
                    if nesting == 'root':
                        document['launchEnabled'] = 1
                    elif nesting == 'nested_dictionary':
                        document['userSettings']['enabled'] = 1
                    else:
                        document['userSettings']['flags'][0] = 1
                def mutate():
                    external['minecraftinstance.json'] = update_launcher(value, change)
                state = {}
                if call_number is None:
                    mutate()
                    expect_rejection(value, 'Unreviewed launcher setting changed')
                else:
                    expect_rejection(value, 'Unreviewed launcher setting changed', inventory_race(value, call_number, mutate, state))
                    assert state['triggered']
                assert_only_external_changes(value, external)


def launcher_key_order_is_semantically_unchanged():
    with fixture() as value:
        path = value.live / 'minecraftinstance.json'
        old = json.loads(path.read_bytes())
        new = dict(reversed(list(old.items())))
        new['userSettings'] = dict(reversed(list(old['userSettings'].items())))
        new['lastPreviousMatchUpdate'] = '2026-11-17T12:34:56Z'
        json_put(path, new)
        exact_external = path.read_bytes()
        value.run()
        receipt = INSTALL.read(value.root / '검증/install_v106' / value.label / 'receipt.json')
        assert receipt['launcherMetadataUpdatedBeforeInstall']['changedKeys'] == ['lastPreviousMatchUpdate']
        assert path.read_bytes() == exact_external
        assert receipt['allSavesPreserved']


def unrelated_file_changes_or_removal():
    for call_number in [None, 3]:
        for remove_existing in [False, True]:
            with fixture() as value:
                external = {}
                rel = 'config/personal_settings.cfg'
                def mutate():
                    if remove_existing:
                        (value.live / rel).unlink()
                        external[rel] = None
                    else:
                        external[rel] = b'externally changed user file'
                        put(value.live / rel, external[rel])
                state = {}
                if call_number is None:
                    mutate()
                    expect_rejection(value, 'Unexpected change outside install scope')
                else:
                    expect_rejection(value, 'Unexpected change outside install scope', inventory_race(value, call_number, mutate, state))
                    assert state['triggered']
                assert_only_external_changes(value, external)


def invalid_launcher_json_or_removal():
    for call_number in [None, 3]:
        for content in [b'{invalid JSON', None, b'[]', b'{"installedAddons":[],"lastPreviousMatchUpdate":null}']:
            with fixture() as value:
                def mutate():
                    path = value.live / 'minecraftinstance.json'
                    if content is None:
                        path.unlink()
                    else:
                        put(path, content)
                state = {}
                if call_number is None:
                    mutate()
                    expect_rejection(value, None)
                else:
                    expect_rejection(value, None, inventory_race(value, call_number, mutate, state))
                    assert state['triggered']
                assert_only_external_changes(value, {'minecraftinstance.json': content})


def launcher_metadata_preserved_during_rollback():
    with fixture() as value:
        state = {}
        external = {}
        original = INSTALL.reconcile_launcher_metadata
        def mutate():
            external['minecraftinstance.json'] = update_launcher(value, permitted_launcher_update)
        def fail_after_write_validation(expected, current, previous):
            result = original(expected, current, previous)
            if state.get('triggered') and not state.get('failed'):
                assert all(not (value.live / CHAPTERS / name).exists() for name in RETIRED)
                assert all(digest(value.live / rel) == checksum for rel, checksum in value.candidate.items())
                state['failed'] = True
                raise RuntimeError('injected after accepting external launcher update')
            return result
        @contextlib.contextmanager
        def fault():
            with inventory_race(value, 3, mutate, state), patch.object(INSTALL, 'reconcile_launcher_metadata', fail_after_write_validation):
                yield
        expect_rejection(value, 'injected after accepting external launcher update', fault())
        assert state['triggered'] and state['failed']
        assert_only_external_changes(value, external)
        rollback = INSTALL.read(value.root / '검증/install_v106' / value.label / 'rollback.json')
        assert rollback['ownedFilesRestored'] and rollback['allSavesPreserved']
        assert rollback['preservedLauncherMetadataUpdate']['preservedExternalLauncherUpdate']


def main():
    checks = []
    for name, function in [
        ('success installs four chapters and retires exactly eight while retaining all save bytes', successful_install),
        ('unknown custom chapter aborts before any target writes', unknown_custom_chapter),
        ('changed candidate is rejected before target writes', changed_candidate),
        ('changed aggregate execution receipt is rejected', changed_execution_receipt),
        ('changed source execution leaf is rejected', changed_leaf_receipt),
        ('unverified backup bytes are rejected', changed_backup),
        ('failure after every write and retirement fully restores original inventory and saves', complete_rollback_after_retirement),
        ('partial same-volume temp failure removes only owned temp and restores inventory', partial_same_volume_copy_rollback),
        ('relative traversal and outside absolute targets are rejected', containment_rejects_escape),
        ('both exact reviewed presentation mods are accepted and never rewritten', exact_baseline_presentation_mods),
        ('tampered presentation candidate or backed-up existing mod is rejected before writes', tampered_baseline_presentation_mods),
        ('unknown JAR payload is rejected before writes', unknown_mod_payload),
        ('missing existing presentation mod is rejected before writes', missing_existing_presentation_mod),
        ('only the two reviewed launcher keys may differ from the full backup before install', launcher_update_before_install),
        ('reviewed launcher updates during staging and after all writes are preserved', launcher_update_during_staging_or_install),
        ('unreviewed launcher user settings reject and restore owned files and saves', unreviewed_launcher_settings),
        ('adding or removing an unreviewed null-valued launcher key is rejected', launcher_null_key_presence),
        ('root and nested boolean to integer user setting changes reject before and after writes', launcher_typed_setting_changes),
        ('JSON key order alone remains unchanged alongside an approved timestamp update', launcher_key_order_is_semantically_unchanged),
        ('unrelated file content changes or removals reject before and after owned writes', unrelated_file_changes_or_removal),
        ('invalid launcher JSON schema or removal rejects before and after owned writes', invalid_launcher_json_or_removal),
        ('rollback restores every owned file while retaining the external launcher update', launcher_metadata_preserved_during_rollback),
    ]:
        started = time.monotonic()
        try:
            function()
            checks.append({'name': name, 'passed': True, 'elapsedSeconds': round(time.monotonic()-started, 3)})
        except Exception as error:
            checks.append({'name': name, 'passed': False, 'error': repr(error)})
    unchanged_tool = digest(TOOL) == ORIGINAL_TOOL_SHA
    report = {'passed': unchanged_tool and all(row['passed'] for row in checks),
              'actualMinecraft': False, 'synthetic': True, 'realInstallPerformed': False,
              'liveProfileReadOrWritten': False, 'tool': str(TOOL), 'toolSHA256': ORIGINAL_TOOL_SHA,
              'reviewedPresentationMods': dict(INSTALL.UNCHANGED_PRESENTATION_MODS),
              'toolUnchanged': unchanged_tool, 'checks': checks,
              'scope': 'Temporary marker-owned fixtures only; real SHA/ZIP/filesystem/installer transactions.',
              'limits': 'Synthetic receipt inputs validate transaction gates; they attest no Minecraft execution.'}
    previous = ROOT / '검증/evidence_before_launcher_metadata_fix/검증/v10_6_installer_transaction_regression.json'
    if previous.is_file():
        report['previousEvidence'] = {'path': str(previous), 'sha256': digest(previous)}
    json_put(OUTPUT, report)
    print(json.dumps({'passed': report['passed'], 'checks': len(checks), 'actualMinecraft': False,
                      'synthetic': True, 'failures': [row for row in checks if not row['passed']]}))
    if not report['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
