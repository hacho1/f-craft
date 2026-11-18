"""Three-way attribution; retains the original failed literal Anvil report.

Only matching, independently executed no-builder control evidence can attribute
an original difference. Existing nonempty inventory/loot/seed/owner content is a
separate strict gate. No world, original report or ignored-field rule is edited.
"""
from pathlib import Path
import argparse, collections, copy, gzip, hashlib, json, sys, zlib
sys.dont_write_bytecode = True
from anvil_readonly import NBT, plain, World
from verify_arena_anvil_v103 import NativeStates, load_native_defaults, digest, json_native

ROOT = Path(__file__).resolve().parents[1]
OMITTED = {'kubejs/server_scripts/48_serdin_three_boss_arenas_builder_v10_3.js',
           'kubejs/server_scripts/50_guardian_sanctum_builder_v10_4.js'}


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def exact_diff(a, b, path=()):
    out = []
    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(a.keys() | b.keys()):
            if key not in b:
                out.append({'path': list(path+(key,)), 'kind': 'removed', 'before': a[key]})
            elif key not in a:
                out.append({'path': list(path+(key,)), 'kind': 'added', 'after': b[key]})
            else:
                out.extend(exact_diff(a[key], b[key], path+(key,)))
    elif isinstance(a, list) and isinstance(b, list):
        for i in range(max(len(a), len(b))):
            if i >= len(b):
                out.append({'path': list(path+(i,)), 'kind': 'removed', 'before': a[i]})
            elif i >= len(a):
                out.append({'path': list(path+(i,)), 'kind': 'added', 'after': b[i]})
            else:
                out.extend(exact_diff(a[i], b[i], path+(i,)))
    elif a != b or type(a) is not type(b):
        out.append({'path': list(path), 'kind': 'changed', 'before': a, 'after': b})
    return out


def value_kind(value):
    if isinstance(value, (list, dict, str, bytes)) and not value:
        return 'empty_'+type(value).__name__
    if isinstance(value, (int, float)) and value == 0:
        return 'numeric_zero'
    return 'nonempty_or_nonzero'


def critical_fields(row):
    result = {}
    def walk(value, path=()):
        if isinstance(value, dict):
            for key, child in value.items():
                low = key.lower()
                category = ('inventory' if low in ('items', 'inventory', 'item', 'recorditem', 'book') else
                            'seed' if 'seed' in low else
                            'lootTable' if 'loottable' in low else
                            'owner' if 'owner' in low or 'player' in low or low in ('lock', 'lootropeners', 'openers') else None)
                if category:
                    result[path+(key,)] = (category, child)
                walk(child, path+(key,))
        elif isinstance(value, list):
            for i, child in enumerate(value):
                walk(child, path+(i,))
    walk(row)
    return result


def preserve_critical(original, constructed):
    before, after = critical_fields(original), critical_fields(constructed)
    facts, failures = [], []
    for path, (category, value) in before.items():
        nonempty = value_kind(value) == 'nonempty_or_nonzero'
        exact = path in after and value == after[path][1]
        row = {'path': list(path), 'category': category, 'before': value,
               'afterPresent': path in after, 'after': after.get(path, (None, None))[1],
               'literalExact': exact, 'originalNonemptyOrNonzero': nonempty}
        facts.append(row)
        if nonempty and not exact:
            failures.append(row)
    return {'passed': not failures, 'fields': facts, 'failures': failures,
            'emptyZeroAbsencePolicy': 'Reported literally; no assertion that omitted zero/empty fields are native defaults.'}


def valid_uuid_ints(value):
    return isinstance(value, list) and len(value) == 4 and all(type(v) is int and -(1 << 31) <= v < (1 << 31) for v in value)


def without_hive_ticks(row):
    result = copy.deepcopy(row)
    for bee in result.get('Bees', []):
        bee.pop('TicksInHive', None)
    return result


def classify_be(original, control, constructed, elapsed_control, elapsed_construction):
    if control == constructed:
        return {'category': 'exact_negative_control_match', 'explained': True}
    # A UUID already present in the source never qualifies for this exception.
    c, m = copy.deepcopy(control or {}), copy.deepcopy(constructed or {})
    if (original is not None and 'tileId' not in original and c.get('id') == m.get('id') and
            str(c.get('id', '')).startswith('lootr:') and valid_uuid_ints(c.get('tileId')) and valid_uuid_ints(m.get('tileId'))):
        cu, mu = c.pop('tileId'), m.pop('tileId')
        if c == m:
            return {'category': 'new_lootr_storage_uuid_created_in_both_runs', 'explained': True,
                    'sourceHadTileId': False, 'controlUUID': cu, 'constructionUUID': mu,
                    'allOtherControlConstructionFieldsExact': True}
    if (original is not None and control is not None and constructed is not None and
            original.get('id') == control.get('id') == constructed.get('id') == 'minecraft:beehive' and
            without_hive_ticks(original) == without_hive_ticks(control) == without_hive_ticks(constructed)):
        timers = []
        for index, (old, con, made) in enumerate(zip(original.get('Bees', []), control.get('Bees', []), constructed.get('Bees', []))):
            values = [row.get('TicksInHive') for row in (old, con, made)]
            if not all(type(v) is int for v in values):
                return {'category': 'unexplained', 'explained': False}
            a, b, d = values
            if not (0 <= b-a <= elapsed_control and 0 <= d-a <= elapsed_construction):
                return {'category': 'unexplained', 'explained': False}
            timers.append({'bee': index, 'source': a, 'control': b, 'construction': d,
                           'controlElapsedOccupation': b-a, 'constructionElapsedOccupation': d-a,
                           'constructionMinusControl': d-b})
        if timers and len({x['constructionMinusControl'] for x in timers}) == 1:
            return {'category': 'bounded_native_hive_occupation_timers', 'explained': True, 'timers': timers,
                    'allOtherSourceControlConstructionFieldsExact': True,
                    'note': 'Occupation counts depend on loaded block-entity ticks; the observed +15 is not attributed to the one global saved-tick difference.'}
    return {'category': 'unexplained', 'explained': False}


def nbt_file(path):
    raw = path.read_bytes()
    if raw.startswith(b'\x1f\x8b'):
        raw = gzip.decompress(raw)
    return plain(NBT(raw).root()[1])


def inventory_sha(world):
    entries = {p.relative_to(world).as_posix(): {'sha256': digest(p), 'bytes': p.stat().st_size}
               for p in sorted(world.rglob('*')) if p.is_file()}
    encoded = (json.dumps(dict(sorted(entries.items())), ensure_ascii=False, indent=2)+'\n').encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def saved_bees(world):
    bees, hashes = [], {}
    for path in sorted((world/'entities').glob('r.*.*.mca')):
        hashes[path.name] = digest(path)
        raw = path.read_bytes()
        for slot in range(1024):
            pos = slot*4
            sector = int.from_bytes(raw[pos:pos+3], 'big')
            if not sector:
                continue
            off = sector*4096
            size = int.from_bytes(raw[off:off+4], 'big')
            if sector < 2 or size < 1 or size+4 > raw[pos+3]*4096 or off+size+4 > len(raw):
                raise ValueError('Invalid entity Anvil record: '+str(path))
            kind, data = raw[off+4], raw[off+5:off+4+size]
            data = zlib.decompress(data) if kind == 2 else gzip.decompress(data) if kind == 1 else data
            if kind not in (1, 2, 3):
                raise ValueError('Unsupported entity record compression')
            chunk = plain(NBT(data).root()[1])
            for entity in chunk.get('Entities', []):
                if entity.get('id') == 'minecraft:bee':
                    bees.append({'file': path.name, 'data': entity})
    return bees, hashes


def contains(original, actual):
    if isinstance(original, dict) and isinstance(actual, dict):
        return all(k in actual and contains(v, actual[k]) for k, v in original.items())
    return original == actual


def bee_release_proof(rows, worlds):
    all_bees, hashes = {}, {}
    for label, path in worlds.items():
        all_bees[label], hashes[label] = saved_bees(path)
    proofs = []
    for row in rows:
        old, con, made = row['source'], row['control'], row['construction']
        if old.get('id') != 'minecraft:beehive' or not old.get('Bees'):
            continue
        if (con or {}).get('Bees') or (made or {}).get('Bees'):
            continue
        x, y, z = row['cell']; hive = {'X': x, 'Y': y, 'Z': z}
        actual = {label: [b for b in bees if b['data'].get('HivePos') == hive]
                  for label, bees in all_bees.items()}
        required = [b['EntityData'] for b in old['Bees']]
        good = not actual['source']
        for label in ('control', 'construction'):
            remaining = list(actual[label])
            good = good and len(remaining) == len(required)
            for original in required:
                choices = [b for b in remaining if contains(original, b['data']) and
                           valid_uuid_ints(b['data'].get('UUID')) and float(b['data'].get('Health', 0)) > 0]
                if not choices:
                    good = False
                else:
                    remaining.remove(choices[0])
            uuids = [tuple(b['data'].get('UUID', [])) for b in actual[label]]
            good = good and len(set(uuids)) == len(uuids)
        proofs.append({'cell': row['cell'], 'passed': bool(good), 'originalOccupants': old['Bees'],
                       'sourceUUIDPresent': any('UUID' in b for b in required), 'actualSavedBees': actual,
                       'basis': 'Actual living saved entity records match HivePos, released count and every original EntityData field. No UUID continuity is claimed when the source omitted a UUID.'})
    return {'passed': bool(proofs) and all(p['passed'] for p in proofs), 'hives': proofs,
            'totalActualSavedBees': {k: len(v) for k, v in all_bees.items()}, 'entityRegionSHA256': hashes}


def run(comparison_path, classification_path, construction_result, control_result, summary_path):
    raw, prior, made_native, ctrl_native, summary = [read(p) for p in
        (comparison_path, classification_path, construction_result, control_result, summary_path)]
    source, constructed, control = Path(raw['sourceWorld']), Path(raw['modifiedWorld']), Path(summary['world'])
    checks = []
    def check(name, value, detail=None):
        checks.append({'name': name, 'passed': bool(value), 'detail': detail})
    check('original raw failed verdict is retained', raw['passed'] is False and prior['originalVerdictChanged'] is False)
    check('classification bound to original comparison', prior['comparisonSHA256'] == digest(comparison_path))
    check('both actual native executions passed', all(r.get('actualMinecraft') is True and r.get('passed') is True and r.get('probe', {}).get('passed') is True for r in (made_native, ctrl_native)))
    check('same original boot inventory', made_native['bootWorldInventorySHA256'] == ctrl_native['bootWorldInventorySHA256'] == made_native['worldSourceInventorySHA256'] == ctrl_native['worldSourceInventorySHA256'])
    check('same full candidate and installed mod hashes', made_native['codeHashes'] == ctrl_native['codeHashes'] and made_native['modHashes'] == ctrl_native['modHashes'])
    a, b = made_native['executedMirrorHashes'], ctrl_native['executedMirrorHashes']
    delta = {k for k in a.keys() | b.keys() if a.get(k) != b.get(k)}
    check('runtime difference is exactly two omitted builders', delta == OMITTED and set(ctrl_native['variantOmittedCandidatePaths']) == OMITTED and all(k not in b for k in OMITTED), sorted(delta))
    proof = ctrl_native.get('probe', {}).get('control', {})
    check('negative control actually read authoritative cells without builders', proof.get('negativeControl') is True and proof.get('manualBlockWrites') == 0 and proof.get('buildersOmitted') is True and proof.get('outdoorSignature') == raw['signature'] and proof.get('outdoorCellsRead') == raw['plannedCells'])
    check('control safe copy matches native saved inventory', inventory_sha(control) == summary['inventorySHA256'] == ctrl_native['savedWorldInventorySHA256'])
    check('construction safe copy matches native saved inventory', inventory_sha(constructed) == made_native['savedWorldInventorySHA256'])
    for label, world in [('sourceRegionSHA256', source), ('modifiedRegionSHA256', constructed)]:
        check(label+' unchanged since literal comparison', all(digest(world/'region'/name) == expected for name, expected in raw[label].items()))
    source_time = int(nbt_file(source/'level.dat')['Data']['Time'])
    ct = int(nbt_file(control/'level.dat')['Data']['Time'])
    mt = int(nbt_file(constructed/'level.dat')['Data']['Time'])
    check('negative-control clock is within one saved global tick', abs(mt-ct) <= 1 and proof.get('sourceTime') == source_time, {'source': source_time, 'control': ct, 'construction': mt})
    normalize = NativeStates(load_native_defaults(construction_result))
    cw = World(control)
    block_matches, block_residual = [], []
    for row in prior['outsideChanges']:
        actual = normalize(cw.block(*row['cell']))
        result = {'cell': row['cell'], 'source': row['before'], 'control': actual, 'construction': row['after']}
        (block_matches if actual == row['after'] else block_residual).append(result)
    check('every original outside block difference is included', len(block_matches)+len(block_residual) == raw['outsideChangeCount'])
    rows = []
    for row in prior['blockEntities']:
        x, y, z = row['cell']
        actual = next((be for be in cw.chunk(x//16, z//16).get('block_entities', [])
                       if (be['x'], be['y'], be['z']) == (x, y, z)), None)
        old, after = row['before'], row['after']
        source_diffs = exact_diff(old, after)
        empty = [dict(d, literalValueKind=value_kind(d.get('before') if d['kind'] == 'removed' else d.get('after')),
                      nativeDefaultProven=False) for d in source_diffs if d['kind'] in ('removed', 'added') and
                 value_kind(d.get('before') if d['kind'] == 'removed' else d.get('after')) != 'nonempty_or_nonzero']
        result = {'cell': row['cell'], 'source': old, 'control': actual, 'construction': after,
                  'sourceToConstructionExactDiff': source_diffs, 'controlToConstructionExactDiff': exact_diff(actual, after),
                  'attribution': classify_be(old, actual, after, ct-source_time, mt-source_time),
                  'originalCriticalContent': preserve_critical(old, after or {}), 'literalEmptyOrZeroAdditionsOmissions': empty}
        if 'signMessageSemantics' in row:
            result['sourceSignJSONSemantics'] = row['signMessageSemantics']
        rows.append(result)
    check('all changed original BEs included with exact evidence', len(rows) == raw['originalBlockEntityChangeCount'] == len(raw['originalBlockEntityChanges']))
    bees = bee_release_proof(rows, {'source': source, 'control': control, 'construction': constructed})
    check('removed hive occupants exist as actual living saved bees', bees['passed'], bees['totalActualSavedBees'])
    unexplained = [r for r in rows if not r['attribution']['explained']]
    critical_failed = [r for r in rows if not r['originalCriticalContent']['passed']]
    check('original nonempty inventories loot seeds owners remain exact', not critical_failed)
    check('all block differences have exact no-builder control counterparts', not block_residual)
    check('all BE differences have bounded explicit attribution', not unexplained)
    check('all requested construction target and preflight cells verified', raw['unexpectedTargetCount'] == 0 and raw['sourcePreimages']['passed'] is True)
    result = {'passed': all(c['passed'] for c in checks), 'actualMinecraft': True,
        'validationKind': 'Read-only three-way saved-world attribution using two independently completed native Minecraft executions',
        'scope': '0 unplanned construction changes in originally FULL overworld chunks after matched no-builder control attribution; not byte-identical preservation of natural ticking.',
        'rawAnvilPassed': False, 'rawFailedVerdictOverwritten': False, 'readOnly': True,
        'checks': checks, 'unplannedBlockChangeCount': len(block_residual), 'unexplainedBlockEntityChangeCount': len(unexplained),
        'outsideControlExactMatches': len(block_matches), 'outsideResidual': block_residual,
        'blockEntityControlExactMatches': sum(r['control'] == r['construction'] for r in rows),
        'blockEntityAttributionCounts': dict(collections.Counter(r['attribution']['category'] for r in rows)),
        'originalNonemptyCriticalContentPreserved': not critical_failed,
        'criticalScope': {'changedOriginalBEsReadDirectly': len(rows), 'remainingOriginalBEsCoveredByBoundStrictRawComparison': raw['originalBlockEntitiesCompared']-len(rows),
                          'explanation': 'For other original BEs the bound raw comparator found no original-value change; its only accepted additions were separately logged empty ForgeCaps. No original inventory, loot, nonzero seed or owner field was ignored.'},
        'savedGlobalTimes': {'source': source_time, 'control': ct, 'construction': mt},
        'beeReleaseEvidence': bees, 'blockEntities': rows, 'outsideExactMatchEvidence': block_matches,
        'originalFullChunksCompared': raw['originalFullChunksCompared'], 'originalProtoChunksExcluded': raw['originalProtoChunksExcluded'],
        'limitations': ['Protochunk completion and newly generated chunks are not certified original FULL-chunk preservation.',
                       'Global entity motion and random new UUIDs are not byte-identical between independent executions.',
                       'Empty/zero field omissions are reported literally; no blanket field-ignore rule was added.'],
        'inputs': {str(p): digest(p) for p in (comparison_path, classification_path, construction_result, control_result, summary_path)},
        'controlRegionSHA256': {p.name: digest(p) for p in sorted((control/'region').glob('r.*.*.mca'))}}
    return result


def self_test():
    checks = []
    def test(name, value):
        checks.append({'name': name, 'passed': bool(value)})
        assert value, name
    old = {'id': 'minecraft:chest', 'LootTable': 'minecraft:chests/simple_dungeon', 'LootTableSeed': 123}
    c = dict(old, id='lootr:lootr_chest', tileId=[1, 2, 3, 4])
    m = dict(c, tileId=[5, 6, 7, 8])
    test('new UUID qualifies only when absent in source and all other fields exact', classify_be(old, c, m, 10, 11)['explained'])
    test('existing source UUID is never ignored', not classify_be(dict(old, tileId=[0, 0, 0, 1]), c, m, 10, 11)['explained'])
    test('UUID classification cannot hide changed loot', not classify_be(old, c, dict(m, LootTable='bad:loot'), 10, 11)['explained'])
    test('original nonzero loot seed remains strict', not preserve_critical(old, dict(m, LootTableSeed=124))['passed'])
    inventory = {'Items': [{'id': 'minecraft:diamond', 'Count': 3}], 'Owner': 'owner'}
    test('inventory deletion is a failure even when both runs do it', not preserve_critical(inventory, {'Items': [], 'Owner': 'owner'})['passed'])
    test('original owner mutation remains strict', not preserve_critical(inventory, dict(inventory, Owner='other'))['passed'])
    hive = {'id': 'minecraft:beehive', 'Bees': [{'TicksInHive': 1, 'MinOccupationTicks': 600, 'EntityData': {'id': 'minecraft:bee'}}]}
    c = copy.deepcopy(hive); m = copy.deepcopy(hive); c['Bees'][0]['TicksInHive'] = 6; m['Bees'][0]['TicksInHive'] = 8
    test('bounded occupancy-only changes qualify', classify_be(hive, c, m, 10, 11)['explained'])
    m['Bees'][0]['EntityData']['CustomName'] = 'changed'
    test('occupancy classification cannot hide occupant changes', not classify_be(hive, c, m, 10, 11)['explained'])
    test('non-identical arbitrary BE fields remain unexplained', not classify_be({'id': 'test:be'}, {'id': 'test:be'}, {'id': 'test:be', 'extra': 0}, 10, 11)['explained'])
    return {'passed': True, 'actualMinecraft': False, 'tests': len(checks), 'checks': checks}


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--comparison', type=Path, default=ROOT/'검증/native/arena_v104_06/anvil_comparison.json')
    ap.add_argument('--classification', type=Path, default=ROOT/'검증/native/arena_v104_06/anvil_difference_classification.json')
    ap.add_argument('--construction-result', type=Path, default=ROOT/'검증/native/arena_v104_06/result.json')
    ap.add_argument('--control-result', type=Path, default=ROOT/'검증/native/earthworks_control02/result.json')
    ap.add_argument('--control-summary', type=Path, default=ROOT/'검증/control_world_v104.json')
    ap.add_argument('--output', type=Path, default=ROOT/'검증/native/arena_v104_06/controlled_construction_attribution.json')
    ap.add_argument('--self-test', action='store_true')
    args = ap.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False)); sys.exit(0)
    inputs = [args.comparison.resolve(), args.classification.resolve(), args.construction_result.resolve(), args.control_result.resolve(), args.control_summary.resolve()]
    if args.output.resolve() in inputs:
        raise ValueError('Output may not replace an input evidence file')
    report = run(*inputs)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=json_native)+'\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['passed', 'rawAnvilPassed', 'outsideControlExactMatches', 'unplannedBlockChangeCount', 'blockEntityControlExactMatches', 'blockEntityAttributionCounts', 'unexplainedBlockEntityChangeCount', 'originalNonemptyCriticalContentPreserved']}, ensure_ascii=False))
    sys.exit(0 if report['passed'] else 1)
