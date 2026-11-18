"""Disposable T9 transaction tests, never the live instance."""
from pathlib import Path
import importlib.util
import json
import sys
import uuid
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('_installer', ROOT / 'tools/install_verified_update_v105.py')
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
AREA = ROOT / '검증/install_guard_unit' / uuid.uuid4().hex
AREA.mkdir(parents=True)
checks = []


def check(name, fn):
    fn()
    checks.append({'name': name, 'passed': True})


def fixture(name):
    case = AREA / name
    target, source = case / 'target', case / 'source'
    for p, text in [(target / 'kubejs/server_scripts/13_test.js', 'old'),
                    (target / 'saves/player-world/region/r.0.0.mca', 'world-sentinel'),
                    (target / 'options.txt', 'user-custom-keys'),
                    (target / 'mods/untouched.jar', 'other-mod'),
                    (source / 'kubejs/server_scripts/13_test.js', 'verified-new'),
                    (source / 'kubejs/client_scripts/08_new.js', 'new-client')]:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, 'utf-8')
    candidate = {p.relative_to(source).as_posix(): M.sha(p) for p in source.rglob('*') if p.is_file()}
    before = M.full_inventory(target)
    changes = [r for r in M.overlay_plan(target, candidate) if r['action'] != 'unchanged']
    backup = case / 'backup.zip'
    M.backup_profile(target, before, backup)
    return case, target, source, candidate, before, changes, backup


def success():
    c, t, s, candidate, before, changes, backup = fixture('success')
    result = M.apply_transaction(t, s, changes, before, backup, c / 'stage', 'test', lambda: None)
    assert result['installedChanges'] == 2 and result['allSavesPreserved'] and result['saveFilesVerified'] == 1
    assert (t / 'options.txt').read_text() == 'user-custom-keys'
    assert all(M.sha(t / rel) == h for rel, h in candidate.items())
    assert all(row['action'] == 'unchanged' for row in M.overlay_plan(t, candidate))


def rollback():
    c, t, s, _, before, changes, backup = fixture('rollback')
    def fail(n):
        if n == 2:
            raise RuntimeError('injected after replace and add')
    try:
        M.apply_transaction(t, s, changes, before, backup, c / 'stage', 'test', lambda: None, fail)
    except RuntimeError as e:
        assert 'rolled back safely' in str(e)
    else:
        raise AssertionError('Failure injection did not run')
    assert M.full_inventory(t) == before


def busy():
    c, t, s, _, before, changes, backup = fixture('busy')
    def blocked():
        raise RuntimeError('target Minecraft running')
    try:
        M.apply_transaction(t, s, changes, before, backup, c / 'stage', 'test', blocked)
    except RuntimeError as e:
        assert 'Minecraft running' in str(e)
    else:
        raise AssertionError('Busy guard ignored')
    assert M.full_inventory(t) == before


def drift():
    c, t, s, _, before, changes, backup = fixture('drift')
    (t / 'options.txt').write_text('user-new-preferences')
    try:
        M.apply_transaction(t, s, changes, before, backup, c / 'stage', 'test', lambda: None)
    except RuntimeError as e:
        assert 'changed after backup' in str(e)
    else:
        raise AssertionError('Concurrent change not detected')
    assert (t / 'options.txt').read_text() == 'user-new-preferences'
    assert (t / 'kubejs/server_scripts/13_test.js').read_text() == 'old'


def paths():
    t = AREA / 'paths'
    t.mkdir()
    for bad in ['../options.txt', 'saves/world/level.dat', 'mods/unapproved.jar', 'kubejs/server_scripts/95_ui_debug.js']:
        try:
            M.target_file(t, bad)
        except RuntimeError:
            pass
        else:
            raise AssertionError('Unsafe overlay path accepted: ' + bad)


check('successful transaction preserves every save, option and unrelated mod', success)
check('partial replacement and new-file failure rolls back exact preimages', rollback)
check('running game guard refuses before any mutation', busy)
check('concurrent user edit after backup is preserved and stops installation', drift)
check('world traversal QA and unrelated-mod overlay paths are refused', paths)
report = {'passed': True, 'tests': len(checks), 'checks': checks, 'area': str(AREA),
          'actualMinecraft': False, 'liveInstanceTouched': False}
M.write(ROOT / '검증/install_guard_unit.json', report)
print(json.dumps(report, ensure_ascii=False))
