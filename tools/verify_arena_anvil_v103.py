"""Independent, read-only Anvil comparison for the outdoor arena plan.

Preservation is certified only in originally FULL chunks. Proto completion and
new saved chunks are observations, never attributed to construction. Final
verification requires actual native registry defaults and saved native preflight
pages covering every planned cell, checked against the original Anvil data.
"""
from pathlib import Path
import argparse, collections, copy, gzip, hashlib, json, re, sys, zlib
sys.dont_write_bytecode = True
from anvil_readonly import NBT, plain

ROOT = Path(__file__).resolve().parents[1]
BUILDER_KEY = 'fcraft_arena_construction_v103'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_native(value):
    if isinstance(value, bytes):
        return {'NBTByteArrayHex': value.hex()}
    raise TypeError(type(value).__name__)


def parts(value):
    """Read actual BlockState.toString(), saved palette rows, or plan states."""
    if isinstance(value, dict):
        return str(value['Name']), {str(k): str(v) for k, v in value.get('Properties', {}).items()}
    value = str(value).strip()
    if value.startswith('Block{'):
        end = value.index('}')
        name, rest = value[6:end], value[end+1:]
    else:
        name, sep, rest = value.partition('[')
        rest = '['+rest if sep else ''
    if not re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+', name):
        raise ValueError('Invalid block-state ID: '+name)
    props = {}
    if rest:
        if not (rest.startswith('[') and rest.endswith(']')):
            raise ValueError('Invalid block-state properties: '+value)
        for entry in rest[1:-1].split(','):
            key, sep, val = entry.partition('=')
            if not sep or not key or not val or key in props:
                raise ValueError('Invalid/duplicate block-state property: '+value)
            props[key] = val
    return name, props


def canonical(row):
    name, props = parts(row)
    return name+('['+','.join(k+'='+v for k, v in sorted(props.items()))+']' if props else '')


class NativeStates:
    def __init__(self, defaults):
        self.defaults, self.cache, self.missing = defaults, {}, set()
        self.expanded = collections.Counter()

    def __call__(self, value):
        name, explicit = parts(value)
        key = (name, tuple(sorted(explicit.items())))
        if key not in self.cache:
            if name not in self.defaults:
                self.missing.add(name)
            merged = dict(self.defaults.get(name, {}))
            merged.update(explicit)  # Every explicitly saved value wins.
            if merged != explicit:
                self.expanded[name] += 1
            self.cache[key] = canonical({'Name': name, 'Properties': merged})
        return self.cache[key]


def load_native_defaults(path):
    report = json.loads(path.read_text(encoding='utf-8-sig'))
    raw = report.get('probe', report).get('nativeBlockDefaultStates')
    if report.get('actualMinecraft') is not True or not isinstance(raw, dict) or not raw:
        raise ValueError('--native-result needs an actual Minecraft probe.nativeBlockDefaultStates dump')
    defaults = {}
    for key, value in raw.items():
        name, props = parts(value)
        if key != name:
            raise ValueError('Native default registry key/state mismatch: '+str(key))
        defaults[name] = props
    if 'minecraft:air' not in defaults:
        raise ValueError('Native registry defaults missing minecraft:air')
    return defaults


def matches(actual, wanted):
    # Requested explicit target properties must match. Runtime connections may
    # add properties; ORIGINAL preservation instead uses strict native equality.
    a, ap = parts(actual)
    w, wp = parts(wanted)
    return a == w and all(ap.get(k) == v for k, v in wp.items())


def chunks(path):
    raw = path.read_bytes()
    if len(raw) < 8192:
        raise ValueError('Truncated Anvil header: '+str(path))
    for slot in range(1024):
        pos = slot*4
        sector = int.from_bytes(raw[pos:pos+3], 'big')
        if not sector:
            continue
        offset = sector*4096
        size = int.from_bytes(raw[offset:offset+4], 'big')
        allocation = raw[pos+3]*4096
        if sector < 2 or size < 1 or size+4 > allocation or offset+size+4 > len(raw):
            raise ValueError('Invalid Anvil allocation: '+str(path))
        kind, data = raw[offset+4], raw[offset+5:offset+4+size]
        if kind == 2:
            data = zlib.decompress(data)
        elif kind == 1:
            data = gzip.decompress(data)
        elif kind != 3:
            raise ValueError('Unsupported compression in '+str(path))
        row = plain(NBT(data).root()[1])
        yield (int(row['xPos']), int(row['zPos'])), row


def states(section, normalize=canonical):
    palette = [normalize(x) for x in section.get('palette', [{'Name': 'minecraft:air'}])]
    if len(palette) == 1:
        return [palette[0]]*4096
    bits = max(4, (len(palette)-1).bit_length())
    per, data, mask = 64//bits, section['data'], (1 << bits)-1
    if len(data) < (4096+per-1)//per:
        raise ValueError('Truncated block-state bit storage')
    return [palette[(data[i//per] >> ((i%per)*bits)) & mask] for i in range(4096)]


def is_full(row):
    return row.get('Status') in ('full', 'minecraft:full')


def empty_capability(name, value):
    # Empty compound plus the actually observed native empty sign-ink default.
    # Arbitrary zero-valued custom data is not silently approved.
    return value == {} or (name == 'supplementaries:antique_ink' and value == {'ink': 0})


def be_preservation(before, after, path=()):
    differences, additions = [], []
    if isinstance(before, dict) and isinstance(after, dict):
        for key, value in before.items():
            if key not in after:
                differences.append({'path': list(path+(key,)), 'reason': 'original_key_removed', 'before': value})
            else:
                bad, accepted = be_preservation(value, after[key], path+(key,))
                differences.extend(bad)
                additions.extend(accepted)
        for key in after.keys()-before.keys():
            value = after[key]
            allowed = path == ('ForgeCaps',) and empty_capability(key, value)
            if path == () and key == 'ForgeCaps' and isinstance(value, dict):
                allowed = all(empty_capability(k, v) for k, v in value.items())
            record = {'path': list(path+(key,)), 'after': value}
            if allowed:
                additions.append(record)
            else:
                differences.append(dict(record, reason='unexpected_added_content'))
    elif before != after or type(before) is not type(after):
        differences.append({'path': list(path), 'reason': 'original_value_changed', 'before': before, 'after': after})
    return differences, additions


def block_entities(row):
    out = {}
    for be in row.get('block_entities', []):
        cell = (int(be['x']), int(be['y']), int(be['z']))
        if cell in out:
            raise ValueError('Duplicate block entity: '+str(cell))
        out[cell] = be
    return out


def allowed_new_sign(cell, be, operations):
    op = operations.get(cell)
    return bool(op and op.get('signLines') and
                parts(op['state'])[0].endswith(('_sign', '_hanging_sign')) and
                be.get('id') in ('minecraft:sign', 'minecraft:hanging_sign'))


def load_preflight(modified, signature, operations, source_states, normalize):
    path = modified/'kubejs_persistent_data.nbt'
    result = {'passed': False, 'file': str(path), 'expectedCells': len(operations),
              'actualCells': 0, 'failures': [], 'status': None}
    bad = result['failures']
    if not path.is_file():
        bad.append({'reason': 'saved_native_preflight_missing'})
        return result
    result['sha256'] = digest(path)
    raw = path.read_bytes()
    if raw.startswith(b'\x1f\x8b'):
        raw = gzip.decompress(raw)
    data = plain(NBT(raw).root()[1]).get(BUILDER_KEY, {})
    meta = json.loads(data.get('meta', '{}'))
    result.update(status=meta.get('status'), signature=meta.get('signature'),
                  preflightComplete=meta.get('preflightComplete') is True)
    if meta.get('signature') != signature:
        bad.append({'reason': 'native_preflight_plan_signature_mismatch'})
    if meta.get('preflightComplete') is not True:
        bad.append({'reason': 'native_preflight_not_complete'})
    if meta.get('status') != 'DONE' or int(meta.get('cursor', -1)) != len(operations):
        bad.append({'reason': 'native_construction_not_done'})
    if int(meta.get('written', -1))+int(meta.get('skipped', -1)) != len(operations):
        bad.append({'reason': 'native_write_skip_accounting_mismatch'})
    count = int(meta.get('pageCount', 0))
    expected_pages = {'preimage_'+str(i) for i in range(count)}
    actual_pages = {k for k in data if re.fullmatch(r'preimage_\d+', k)}
    if actual_pages != expected_pages:
        bad.append({'reason': 'native_preflight_page_set_mismatch',
                    'missing': sorted(expected_pages-actual_pages), 'extra': sorted(actual_pages-expected_pages)})
    rows = {}
    for key in sorted(expected_pages & actual_pages):
        for row in json.loads(data[key]):
            if not isinstance(row, list) or len(row) != 4:
                raise ValueError('Invalid saved native preflight row')
            cell = tuple(int(v) for v in row[:3])
            if cell in rows:
                bad.append({'reason': 'duplicate_native_preflight_cell', 'cell': cell})
            rows[cell] = normalize(row[3])
    result.update(actualCells=len(rows), pageCount=count)
    missing, extra = operations.keys()-rows.keys(), rows.keys()-operations.keys()
    if missing or extra:
        bad.append({'reason': 'native_preflight_cells_must_equal_plan', 'missingCount': len(missing),
                    'extraCount': len(extra), 'missing': sorted(missing)[:30], 'extra': sorted(extra)[:30]})
    mismatch_count = 0
    for cell in rows.keys() & operations.keys():
        original = source_states.get(cell)
        if original is None or original != rows[cell]:
            mismatch_count += 1
            if mismatch_count <= 30:
                bad.append({'reason': 'native_preimage_differs_from_original_anvil', 'cell': cell,
                            'original': original, 'nativePreflight': rows[cell]})
    result.update(sourceMismatchCount=mismatch_count, passed=not bad)
    return result


def compare(source, modified, plan_path, native_result=None, diagnostic=False):
    plan = json.loads(plan_path.read_text(encoding='utf-8-sig'))
    rows = plan.get('ops', plan.get('operations'))
    if not isinstance(rows, list) or not rows:
        raise ValueError('A nonempty authoritative plan is required')
    if 'ops' in plan and 'operations' in plan and plan['ops'] != plan['operations']:
        raise ValueError('Plan ops and operations disagree')
    operations, per_chunk = {}, collections.defaultdict(list)
    for op in rows:
        cell = (int(op['x']), int(op['y']), int(op['z']))
        if cell in operations:
            raise ValueError('Duplicate planned cell: '+str(cell))
        operations[cell] = op
        per_chunk[(cell[0]//16, cell[2]//16)].append(cell)
    if native_result is None and not diagnostic:
        raise ValueError('--native-result is required for final verification')
    defaults = load_native_defaults(native_result) if native_result else {}
    normalize = NativeStates(defaults)
    changed = inspected = section_count = normalization_only = be_count = 0
    outside_count = wrong_count = be_change_count = 0
    outside, wrong_target, missing, be_changes, new_be, additions = [], [], [], [], [], []
    source_hashes, modified_hashes, source_states, target_states = {}, {}, {}, {}
    source_statuses, proto_transitions = collections.Counter(), collections.Counter()
    new_chunks = full_chunks = proto_chunks = proto_completed = proto_dummy = 0
    status_regressions = []

    def collect_plan(key, chunk, cache, collected):
        sections = {int(s['Y']): s.get('block_states', {}) for s in chunk.get('sections', [])}
        for cell in per_chunk.get(key, []):
            x, y, z = cell
            sy = y//16
            if sy not in cache:
                cache[sy] = states(sections.get(sy, {}), normalize)
            collected[cell] = cache[sy][(y%16)*256+(z%16)*16+x%16]

    for src_path in sorted((source/'region').glob('r.*.*.mca')):
        dst_path = modified/'region'/src_path.name
        source_hashes[src_path.name] = digest(src_path)
        old_rows = dict(chunks(src_path))
        if dst_path.is_file():
            modified_hashes[dst_path.name] = digest(dst_path)
            new_rows = dict(chunks(dst_path))
        else:
            missing.append(src_path.name)
            new_rows = {}
        new_chunks += len(new_rows.keys()-old_rows.keys())
        for key, old in old_rows.items():
            source_statuses[str(old.get('Status', '<absent>'))] += 1
            aa_cache, bb_cache = {}, {}
            collect_plan(key, old, aa_cache, source_states)
            new = new_rows.get(key)
            if new is None:
                missing.append({'chunk': key, 'originalStatus': old.get('Status')})
                continue
            collect_plan(key, new, bb_cache, target_states)
            if not is_full(old):
                proto_chunks += 1
                proto_completed += int(is_full(new))
                proto_transitions[str(old.get('Status', '<absent>'))+' -> '+str(new.get('Status', '<absent>'))] += 1
                proto_dummy += sum(b.get('id') == 'DUMMY' for b in new.get('block_entities', []))
                continue
            full_chunks += 1
            if not is_full(new):
                status_regressions.append({'chunk': key, 'before': old.get('Status'), 'after': new.get('Status')})
            olds = {int(s['Y']): s.get('block_states', {}) for s in old.get('sections', [])}
            news = {int(s['Y']): s.get('block_states', {}) for s in new.get('sections', [])}
            for sy in sorted(olds.keys() | news.keys()):
                a, b = olds.get(sy, {}), news.get(sy, {})
                if a == b:
                    continue
                if sy not in aa_cache:
                    aa_cache[sy] = states(a, normalize)
                if sy not in bb_cache:
                    bb_cache[sy] = states(b, normalize)
                aa, bb = aa_cache[sy], bb_cache[sy]
                if aa == bb:
                    normalization_only += 1
                    continue
                section_count += 1
                for index, (before, after) in enumerate(zip(aa, bb)):
                    inspected += 1
                    if before == after:
                        continue
                    changed += 1
                    cell = (key[0]*16+index%16, sy*16+index//256, key[1]*16+(index//16)%16)
                    if cell not in operations:
                        outside_count += 1
                        if len(outside) < 80:
                            outside.append({'cell': cell, 'before': before, 'after': after})
            old_be, new_be_rows = block_entities(old), block_entities(new)
            be_count += len(old_be)
            for cell, be in old_be.items():
                differences, accepted = be_preservation(be, new_be_rows.get(cell))
                if differences:
                    be_change_count += 1
                    if len(be_changes) < 40:
                        be_changes.append({'cell': cell, 'id': be.get('id'), 'differences': differences[:15]})
                additions.extend(dict(a, cell=cell, id=be.get('id')) for a in accepted)
            for cell in new_be_rows.keys()-old_be.keys():
                new_be.append({'cell': cell, 'id': new_be_rows[cell].get('id'),
                               'authorizedNewSign': allowed_new_sign(cell, new_be_rows[cell], operations)})
    old_names = set(source_hashes)
    for path in sorted((modified/'region').glob('r.*.*.mca')):
        if path.name not in old_names:
            modified_hashes[path.name] = digest(path)
            new_chunks += sum(1 for _ in chunks(path))
    for cell, op in operations.items():
        actual = target_states.get(cell)
        if actual is None or not matches(actual, op['state']):
            wrong_count += 1
            if len(wrong_target) < 80:
                wrong_target.append({'cell': cell, 'wanted': op['state'], 'after': actual})
    preflight = load_preflight(modified, plan['signature'], operations, source_states, normalize)
    preservation = not (outside_count or missing or be_change_count or status_regressions) and all(b['authorizedNewSign'] for b in new_be)
    passed = bool(preservation and not wrong_count and preflight['passed'] and defaults and not normalize.missing)
    return {'passed': passed, 'actualMinecraftSavedWorld': True, 'readOnly': True,
        'diagnosticOnly': diagnostic, 'finalCertification': bool(passed and not diagnostic),
        'sourceWorld': str(source), 'modifiedWorld': str(modified), 'planFile': str(plan_path),
        'planSHA256': digest(plan_path), 'signature': plan['signature'], 'plannedCells': len(operations),
        'nativeResultFile': str(native_result) if native_result else None,
        'nativeResultSHA256': digest(native_result) if native_result else None,
        'nativeDefaultBlockCount': len(defaults), 'defaultPropertiesExpandedPaletteStates': dict(normalize.expanded),
        'missingNativeDefaultBlockIDs': sorted(normalize.missing),
        'sourceChunkStatuses': dict(source_statuses), 'originalChunksCompared': full_chunks,
        'originalFullChunksCompared': full_chunks, 'originalProtoChunksExcluded': proto_chunks,
        'observedProtoCompletions': proto_completed, 'protoStatusTransitions': dict(proto_transitions),
        'protoDummyBlockEntitiesExcluded': proto_dummy, 'newGeneratedChunks': new_chunks,
        'newSavedChunks': new_chunks, 'normalizationOnlySections': normalization_only,
        'changedOriginalSections': section_count, 'blocksDecodedInChangedSections': inspected,
        'changedOriginalBlocks': changed, 'originalBlockEntitiesCompared': be_count,
        'preservationPassed': preservation, 'zeroOutsideWrites': outside_count == 0,
        'zeroOutsideWritesInOriginallyFullChunks': outside_count == 0,
        'outsideChangeCount': outside_count, 'unexpectedTargetCount': wrong_count,
        'blockEntitiesPreserved': be_change_count == 0, 'originalBlockEntityChangeCount': be_change_count,
        'outsideChanges': outside, 'unexpectedTargets': wrong_target, 'missingChunks': missing,
        'fullChunkStatusRegressions': status_regressions, 'originalBlockEntityChanges': be_changes,
        'allowedAddedEmptyNativeCapabilities': additions, 'newBlockEntities': new_be,
        'sourcePreimages': preflight, 'sourceRegionSHA256': source_hashes, 'modifiedRegionSHA256': modified_hashes,
        'scope': 'Strict semantic states and block-entity preservation in every originally FULL overworld chunk. Every planned target and saved native preflight source cell also independently checked. Proto completion/new saved chunks are observations only, not certified builder writes or attributed generation.'}


def self_test():
    """Real small Anvil/NBT fixtures, with no JVM or Minecraft execution."""
    import tempfile
    from typed_nbt import Tag, encode_root

    def tag(value):
        if isinstance(value, dict):
            return Tag(10, {k: tag(v) for k, v in value.items()})
        if isinstance(value, list):
            values = [tag(v) for v in value]
            return Tag(9, (values[0].kind if values else 10, values))
        if isinstance(value, str):
            return Tag(8, value)
        if isinstance(value, bool):
            return Tag(1, int(value))
        if isinstance(value, int):
            return Tag(4 if abs(value) > 2147483647 else 3, value)
        raise TypeError(type(value))

    def write_region(path, rows):
        path.parent.mkdir(parents=True, exist_ok=True)
        header, body, sector = bytearray(8192), bytearray(), 2
        for row in rows:
            compressed = zlib.compress(encode_root('', tag(row)))
            entry = (len(compressed)+1).to_bytes(4, 'big')+b'\x02'+compressed
            count = (len(entry)+4095)//4096
            slot = (row['xPos']%32+32*(row['zPos']%32))*4
            header[slot:slot+4] = sector.to_bytes(3, 'big')+bytes([count])
            body.extend(entry+b'\0'*(count*4096-len(entry)))
            sector += count
        path.write_bytes(header+body)

    checks = []
    def check(name, ok):
        checks.append({'name': name, 'passed': bool(ok)})
        if not ok:
            raise AssertionError(name)

    with tempfile.TemporaryDirectory(prefix='fcraft-anvil-verify-') as temporary:
        base = Path(temporary)
        source, modified = base/'source', base/'modified'
        source.mkdir(); modified.mkdir()
        be = {'id': 'minecraft:chest', 'x': 0, 'y': 1, 'z': 0,
              'Items': [{'id': 'minecraft:diamond_sword', 'Count': 1, 'tag': {'exact_long': 9007199254740993}}]}
        data = [0]*256
        data[16] = 1  # Chest at (0,1,0); remaining cells are logs.
        original = {'xPos': 0, 'zPos': 0, 'Status': 'minecraft:full',
                    'sections': [{'Y': 0, 'block_states': {'palette': [
                        {'Name': 'minecraft:stripped_spruce_log'}, {'Name': 'minecraft:chest'}], 'data': data}}],
                    'block_entities': [be]}
        after = copy.deepcopy(original)
        after['sections'][0]['block_states']['palette'][0]['Properties'] = {'axis': 'y'}
        after['sections'][0]['block_states']['palette'][1]['Properties'] = {'facing': 'north', 'type': 'single', 'waterlogged': 'false'}
        after['block_entities'][0]['ForgeCaps'] = {'supplementaries:antique_ink': {'ink': 0}}
        proto = {'xPos': 1, 'zPos': 0, 'Status': 'minecraft:structure_starts',
                 'sections': [{'Y': 0, 'block_states': {'palette': [{'Name': 'minecraft:air'}]}}]}
        completed = {'xPos': 1, 'zPos': 0, 'Status': 'minecraft:full',
                     'sections': [{'Y': 0, 'block_states': {'palette': [{'Name': 'minecraft:stone'}]}}],
                     'block_entities': [{'id': 'DUMMY', 'x': 16, 'y': 0, 'z': 0}]}
        operation = {'x': 0, 'y': 0, 'z': 0, 'state': 'minecraft:stripped_spruce_log[axis=y]'}
        plan_path, native_path = base/'plan.json', base/'native.json'
        native_path.write_text(json.dumps({'actualMinecraft': True, 'probe': {'nativeBlockDefaultStates': {
            'minecraft:air': 'Block{minecraft:air}', 'minecraft:stone': 'Block{minecraft:stone}',
            'minecraft:stripped_spruce_log': 'Block{minecraft:stripped_spruce_log}[axis=y]',
            'minecraft:chest': 'Block{minecraft:chest}[facing=north,type=single,waterlogged=false]'}}}), 'utf-8')

        def run(old=original, new=after, op=operation, preimage=None, preflight_rows=None):
            write_region(source/'region/r.0.0.mca', [old, proto])
            write_region(modified/'region/r.0.0.mca', [new, completed])
            plan_path.write_text(json.dumps({'signature': 'fixture', 'ops': [op]}), 'utf-8')
            meta = {'signature': 'fixture', 'preflightComplete': True, 'status': 'DONE',
                    'cursor': 1, 'written': 0, 'skipped': 1, 'pageCount': 1}
            rows = preflight_rows if preflight_rows is not None else [
                [0, 0, 0, preimage or canonical(old['sections'][0]['block_states']['palette'][0])]]
            pd = {BUILDER_KEY: {'meta': json.dumps(meta), 'preimage_0': json.dumps(rows)}}
            (modified/'kubejs_persistent_data.nbt').write_bytes(gzip.compress(encode_root('', tag(pd))))
            return compare(source, modified, plan_path, native_path)

        report = run()
        check('native defaults normalize omitted properties without changes', report['passed'] and report['changedOriginalBlocks'] == 0)
        check('proto completion and DUMMY are separately counted', report['originalFullChunksCompared'] == 1 and report['observedProtoCompletions'] == 1 and report['protoDummyBlockEntitiesExcluded'] == 1)
        check('only added empty native capabilities are logged', len(report['allowedAddedEmptyNativeCapabilities']) == 1 and report['blockEntitiesPreserved'])
        changed = copy.deepcopy(after)
        changed['sections'][0]['block_states']['palette'][0]['Properties']['axis'] = 'x'
        report = run(new=changed)
        check('actual explicit state changes fail', not report['passed'] and report['outsideChangeCount'] == 4094 and report['unexpectedTargetCount'] == 1)
        explicit = copy.deepcopy(original)
        explicit['sections'][0]['block_states']['palette'][0]['Properties'] = {'axis': 'x'}
        report = run(old=explicit)
        check('original explicit properties override defaults', not report['passed'] and report['outsideChangeCount'] == 4094)
        changed = copy.deepcopy(after)
        changed['block_entities'][0]['Items'][0]['Count'] = 2
        report = run(new=changed)
        check('BE inventory mutation fails', not report['passed'] and not report['blockEntitiesPreserved'])
        changed = copy.deepcopy(after)
        changed['block_entities'][0]['Items'][0]['tag']['exact_long'] -= 1
        report = run(new=changed)
        check('64-bit BE item NBT is exact', not report['passed'] and not report['blockEntitiesPreserved'])
        changed = copy.deepcopy(after)
        changed['block_entities'][0]['ForgeCaps']['unknown:cap'] = {'zero': 0}
        check('arbitrary new zero-valued capability fails', not run(new=changed)['passed'])
        old_caps = copy.deepcopy(original)
        old_caps['block_entities'][0]['ForgeCaps'] = {'supplementaries:antique_ink': {'ink': 1}}
        check('existing capability mutation is never ignored', not run(old=old_caps)['blockEntitiesPreserved'])
        report = run(op=dict(operation, state='minecraft:air'))
        check('unwritten targets fail without any other change', not report['passed'] and report['unexpectedTargetCount'] == 1)
        check('every planned preimage is required', not run(preflight_rows=[])['sourcePreimages']['passed'])
        report = run(preimage='minecraft:stripped_spruce_log[axis=x]')
        check('native preimages independently match original Anvil', report['sourcePreimages']['sourceMismatchCount'] == 1 and not report['passed'])
        regressed = copy.deepcopy(after)
        regressed['Status'] = 'minecraft:structure_starts'
        report = run(new=regressed)
        check('original FULL regression cannot become excluded proto', not report['passed'] and len(report['fullChunkStatusRegressions']) == 1)
        dummy_full = copy.deepcopy(after)
        dummy_full['block_entities'].append({'id': 'DUMMY', 'x': 0, 'y': 2, 'z': 0})
        report = run(new=dummy_full)
        check('new DUMMY in an originally FULL chunk is not ignored', not report['passed'] and not report['newBlockEntities'][0]['authorizedNewSign'])
        try:
            compare(source, modified, plan_path)
            rejected = False
        except ValueError:
            rejected = True
        check('final verification requires actual native dump', rejected)
    return {'passed': True, 'actualMinecraft': False, 'tests': len(checks), 'checks': checks}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    parser.add_argument('--modified', type=Path)
    parser.add_argument('--plan', type=Path, default=ROOT/'검증/arena_plan_v104_preimage_input01.json')
    parser.add_argument('--native-result', type=Path, help='Actual result containing probe.nativeBlockDefaultStates; required for final')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--diagnostic', action='store_true', help='Inspect incomplete runs; never issue finalCertification')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False))
        sys.exit(0)
    for name in ('source', 'modified', 'output'):
        if getattr(args, name) is None:
            parser.error('--'+name+' is required unless --self-test is used')
    if args.native_result is None and not args.diagnostic:
        parser.error('--native-result is required for final verification')
    report = compare(args.source.resolve(), args.modified.resolve(), args.plan.resolve(),
                     args.native_result.resolve() if args.native_result else None, args.diagnostic)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=json_native), encoding='utf-8')
    print(json.dumps({k: report[k] for k in ['passed', 'finalCertification', 'originalFullChunksCompared',
        'originalProtoChunksExcluded', 'observedProtoCompletions', 'newSavedChunks', 'changedOriginalBlocks',
        'zeroOutsideWrites', 'blockEntitiesPreserved']}, ensure_ascii=False))
    sys.exit(0 if report['passed'] else 1)
