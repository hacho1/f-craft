"""Read-only static route collision preflight: original Anvil + plan overlay.

This deliberately is NOT Minecraft/native voxel-shape proof. Known road block
shapes are modeled; unrecognized blocks use a conservative full cube and are
reported as unknown. The actual 93 native route measurement remains required.
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import sys
sys.dont_write_bytecode = True
from anvil_readonly import World

ROOT = Path(__file__).resolve().parents[1]
HALF_WIDTH = .28
BODY_HEIGHT = 1.8
STEP_LIMIT = .60001
UNIT = (0., 0., 0., 1., 1., 1.)
AIR = {'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'}
PASSABLE = AIR | {'minecraft:grass', 'minecraft:short_grass', 'minecraft:tall_grass',
    'minecraft:fern', 'minecraft:large_fern', 'minecraft:dead_bush', 'minecraft:vine',
    'minecraft:glow_lichen', 'minecraft:seagrass', 'minecraft:tall_seagrass',
    'minecraft:kelp', 'minecraft:kelp_plant', 'minecraft:cave_vines',
    'minecraft:cave_vines_plant', 'minecraft:spore_blossom', 'minecraft:nether_sprouts',
    'minecraft:crimson_roots', 'minecraft:warped_roots', 'minecraft:red_mushroom',
    'minecraft:brown_mushroom', 'minecraft:dandelion', 'minecraft:poppy',
    'minecraft:blue_orchid', 'minecraft:allium', 'minecraft:azure_bluet',
    'minecraft:oxeye_daisy', 'minecraft:cornflower', 'minecraft:lily_of_the_valley',
    'minecraft:wither_rose', 'minecraft:sunflower', 'minecraft:lilac',
    'minecraft:rose_bush', 'minecraft:peony', 'minecraft:torch', 'minecraft:wall_torch',
    'minecraft:soul_torch', 'minecraft:soul_wall_torch', 'minecraft:redstone_torch',
    'minecraft:redstone_wall_torch', 'minecraft:redstone_wire', 'minecraft:fire',
    'minecraft:soul_fire', 'minecraft:tripwire', 'minecraft:tripwire_hook'}
FULL = {'stone', 'granite', 'diorite', 'andesite', 'polished_granite',
    'polished_diorite', 'polished_andesite', 'deepslate', 'cobbled_deepslate',
    'polished_deepslate', 'chiseled_deepslate', 'deepslate_tiles', 'deepslate_bricks',
    'cracked_deepslate_tiles', 'cracked_deepslate_bricks', 'reinforced_deepslate',
    'blackstone', 'gilded_blackstone', 'polished_blackstone',
    'polished_blackstone_bricks', 'cracked_polished_blackstone_bricks',
    'chiseled_polished_blackstone', 'cobblestone', 'mossy_cobblestone',
    'stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks',
    'chiseled_stone_bricks', 'smooth_stone', 'bricks', 'nether_bricks',
    'red_nether_bricks', 'chiseled_nether_bricks', 'cracked_nether_bricks',
    'end_stone', 'end_stone_bricks', 'netherrack', 'basalt', 'polished_basalt',
    'smooth_basalt', 'calcite', 'tuff', 'dripstone_block', 'sandstone',
    'red_sandstone', 'chiseled_sandstone', 'chiseled_red_sandstone',
    'cut_sandstone', 'cut_red_sandstone', 'smooth_sandstone', 'smooth_red_sandstone',
    'dirt', 'coarse_dirt', 'rooted_dirt', 'grass_block', 'podzol', 'mycelium',
    'moss_block', 'sand', 'red_sand', 'gravel', 'clay', 'mud', 'packed_mud',
    'mud_bricks', 'terracotta', 'bedrock', 'obsidian', 'crying_obsidian',
    'quartz_block', 'quartz_bricks', 'quartz_pillar', 'smooth_quartz',
    'chiseled_quartz_block', 'glass', 'tinted_glass', 'ice', 'packed_ice',
    'blue_ice', 'snow_block', 'purpur_block', 'purpur_pillar', 'sea_lantern',
    'shroomlight', 'glowstone', 'hay_block', 'dried_kelp_block', 'bone_block',
    'amethyst_block', 'budding_amethyst', 'raw_iron_block', 'raw_copper_block',
    'raw_gold_block', 'iron_block', 'gold_block', 'diamond_block', 'emerald_block',
    'lapis_block', 'redstone_block', 'coal_block', 'netherite_block', 'slime_block',
    'melon', 'pumpkin', 'carved_pumpkin', 'jack_o_lantern', 'bookshelf',
    'crafting_table', 'furnace', 'blast_furnace', 'smoker', 'barrel'}


def state_parts(value):
    if isinstance(value, dict):
        return str(value['Name']), {str(k): str(v) for k, v in value.get('Properties', {}).items()}
    text = str(value)
    if text.startswith('Block{'):
        end = text.index('}')
        text = text[6:end] + text[end + 1:]
    name, sep, rest = text.partition('[')
    props = {}
    if sep:
        if not rest.endswith(']'):
            raise ValueError('Invalid state: ' + text)
        for entry in rest[:-1].split(','):
            key, _, val = entry.partition('=')
            props[key] = val
    return name, props


def canonical(value):
    name, props = state_parts(value)
    return name + ('[' + ','.join(k + '=' + v for k, v in sorted(props.items())) + ']' if props else '')


def shape(value):
    """Local boxes, exact-known flag, liquid hazard flag, explanatory model name."""
    name, props = state_parts(value)
    short = name.removeprefix('minecraft:')
    if name in PASSABLE or name.startswith('minecraft:') and short.endswith(('_sapling', '_tulip', '_sign', '_wall_sign', '_hanging_sign', '_wall_hanging_sign')):
        return (), True, False, 'no_collision'
    if name in {'minecraft:water', 'minecraft:lava'}:
        return (), True, True, 'fluid_no_collision_hazard'
    if name.startswith('minecraft:') and short.endswith('_slab'):
        kind = props.get('type', 'bottom')
        if kind == 'bottom': return ((0., 0., 0., 1., .5, 1.),), True, False, 'bottom_slab'
        if kind == 'top': return ((0., .5, 0., 1., 1., 1.),), True, False, 'top_slab'
        if kind == 'double': return (UNIT,), True, False, 'double_slab'
        return (UNIT,), False, False, 'unknown_slab_type'
    if name.startswith('minecraft:') and short.endswith('_stairs'):
        if props.get('half', 'bottom') != 'bottom' or props.get('shape', 'straight') != 'straight':
            return (UNIT,), False, False, 'unmodeled_stair_half_or_shape'
        facing = props.get('facing', 'north')
        upper = {'north': (0., .5, 0., 1., 1., .5), 'south': (0., .5, .5, 1., 1., 1.),
                 'west': (0., .5, 0., .5, 1., 1.), 'east': (.5, .5, 0., 1., 1., 1.)}.get(facing)
        if upper: return ((0., 0., 0., 1., .5, 1.), upper), True, False, 'straight_bottom_stair_' + facing
        return (UNIT,), False, False, 'unknown_stair_facing'
    if name == 'minecraft:mud':
        return ((0., 0., 0., 1., 14. / 16., 1.),), True, False, 'mud_14_sixteenths'
    if name in {'minecraft:dirt_path', 'minecraft:farmland'}:
        return ((0., 0., 0., 1., 15. / 16., 1.),), True, False, 'road_15_sixteenths'
    if name.startswith('minecraft:') and short.endswith('_carpet'):
        return ((0., 0., 0., 1., 1. / 16., 1.),), True, False, 'carpet'
    if name.startswith('minecraft:') and (short in FULL or short.endswith(('_log', '_wood', '_stem', '_hyphae', '_planks', '_leaves', '_terracotta', '_concrete', '_concrete_powder', '_wool', '_ore', '_stained_glass'))):
        return (UNIT,), True, False, 'full_cube'
    # Unknown source/decorative states cannot certify a clear route.
    return (UNIT,), False, False, 'conservative_unknown_full_cube'


def overlap(a, b):
    return a[3] > b[0] and a[0] < b[3] and a[4] > b[1] and a[1] < b[4] and a[5] > b[2] and a[2] < b[5]


def shifted(box, x, y, z):
    return (box[0] + x, box[1] + y, box[2] + z, box[3] + x, box[4] + y, box[5] + z)


class Overlay:
    def __init__(self, world, plan):
        self.world = world
        self.ops = {(int(o['x']), int(o['y']), int(o['z'])): o for o in plan.get('ops', plan.get('operations', []))}
        self.cache = {}
        self.reads = collections.Counter()
        self.models = collections.Counter()
        self.unknown = {}

    def at(self, x, y, z):
        key = (x, y, z)
        if key not in self.cache:
            op = self.ops.get(key)
            value = op['state'] if op else self.world.block(x, y, z)
            state = canonical(value)
            boxes, known, liquid, model = shape(value)
            row = {'state': state, 'boxes': tuple(shifted(b, x, y, z) for b in boxes), 'known': known,
                   'liquid': liquid, 'model': model, 'source': 'plan' if op else 'original_anvil',
                   'position': [x, y, z]}
            if op: row.update(site=op.get('site'), kind=op.get('kind'))
            self.cache[key] = row
            self.reads[row['source']] += 1
            self.models[model] += 1
            if not known:
                self.unknown[key] = {k: row[k] for k in ['position', 'state', 'source', 'model']}
        return self.cache[key]

    def blocks(self, bounds):
        for x in range(math.floor(bounds[0]), math.floor(bounds[3]) + 1):
            for z in range(math.floor(bounds[2]), math.floor(bounds[5]) + 1):
                for y in range(math.floor(bounds[1]), math.floor(bounds[4]) + 1):
                    yield self.at(x, y, z)


def walk_path(path, overlay, max_failures=2000):
    previous = None
    samples = 0
    maximum_step = 0.
    failures = []
    failure_count = 0
    unknown_samples = 0
    route_unknown = set()
    step_failures = 0
    collision_failures = 0
    unsupported = 0
    liquids = 0
    for pi, to in enumerate(path['points']):
        origin = path['points'][pi - 1] if pi else to
        for part in range(1 if pi else 5, 6):
            f = part / 5.
            x = origin['x'] + .5 + (to['x'] - origin['x']) * f
            z = origin['z'] + .5 + (to['z'] - origin['z']) * f
            foot = (x - HALF_WIDTH, min(origin['y'], to['y']) - 2, z - HALF_WIDTH,
                    x + HALF_WIDTH, max(origin['y'], to['y']) + 1, z + HALF_WIDTH)
            height = None
            support_rows = []
            unknown_here = []
            for row in overlay.blocks(foot):
                for box in row['boxes']:
                    # Mirror native93's horizontal overlap and inclusive Y scan.
                    if box[3] > foot[0] and box[0] < foot[3] and box[5] > foot[2] and box[2] < foot[5]:
                        top = box[4]
                        if height is None or top > height + 1e-9:
                            height = top
                            support_rows = [row]
                        elif abs(top - height) < 1e-9:
                            support_rows.append(row)
                        if not row['known']:
                            unknown_here.append(row)
            supported = height is not None
            step = 0. if previous is None or height is None else abs(height - previous)
            maximum_step = max(maximum_step, step)
            blockers = []
            hazards = []
            if supported:
                body = (x - HALF_WIDTH, height + .002, z - HALF_WIDTH,
                        x + HALF_WIDTH, height + BODY_HEIGHT + .002, z + HALF_WIDTH)
                for row in overlay.blocks(body):
                    if row['liquid'] and overlap(tuple(row['position']) + tuple(v + 1 for v in row['position']), body):
                        hazards.append(row)
                    if any(overlap(box, body) for box in row['boxes']):
                        blockers.append(row)
                        if not row['known']:
                            unknown_here.append(row)
            head_clear = supported and not blockers
            unknown_positions = {tuple(r['position']) for r in unknown_here}
            route_unknown.update(unknown_positions)
            if unknown_positions: unknown_samples += 1
            reasons = []
            if not supported: reasons.append('unsupported'); unsupported += 1
            if step > STEP_LIMIT: reasons.append('step_over_0_6'); step_failures += 1
            if not head_clear: reasons.append('body_or_head_collision'); collision_failures += 1
            if hazards: reasons.append('fluid_hazard'); liquids += 1
            if unknown_positions: reasons.append('unknown_geometry')
            samples += 1
            if reasons:
                failure_count += 1
                if max_failures == 0 or len(failures) < max_failures:
                    def brief(row):
                        return {k: row[k] for k in ['position', 'state', 'source', 'model']}
                    failures.append({'point': pi, 'part': part, 'x': round(x, 6), 'y': height,
                                     'z': round(z, 6), 'step': step, 'supported': supported,
                                     'headClear': head_clear, 'reasons': reasons,
                                     'certainty': 'conservative_unknown' if unknown_positions else 'modeled_known_shapes',
                                     'support': [brief(r) for r in support_rows[:4]],
                                     'blockers': [brief(r) for r in blockers[:4]],
                                     'unknown': [overlay.unknown[k] for k in sorted(unknown_positions)[:4]]})
            previous = height
    return {'id': path['id'], 'passedStaticModel': failure_count == 0, 'nativeVoxelShapes': False,
            'pointCount': len(path['points']), 'samples': samples, 'maximumStep': maximum_step,
            'failureCount': failure_count, 'failuresStored': len(failures),
            'failuresTruncated': len(failures) != failure_count, 'stepFailures': step_failures,
            'bodyOrHeadFailures': collision_failures, 'unsupportedSamples': unsupported,
            'fluidSamples': liquids, 'unknownSamples': unknown_samples,
            'unknownPositions': len(route_unknown), 'failures': failures}


def self_test():
    tested = 0
    for facing, low, high in [('north', (.5, .75), (.5, .25)), ('south', (.5, .25), (.5, .75)),
                              ('west', (.75, .5), (.25, .5)), ('east', (.25, .5), (.75, .5))]:
        boxes, known, _, _ = shape('minecraft:stone_brick_stairs[facing=' + facing + ',half=bottom,shape=straight]')
        def height(point):
            x, z = point
            return max(b[4] for b in boxes if b[0] < x < b[3] and b[2] < z < b[5])
        assert known and height(low) == .5 and height(high) == 1
        tested += 1
    for kind, low, high in [('bottom', 0, .5), ('top', .5, 1), ('double', 0, 1)]:
        boxes, known, _, _ = shape('minecraft:stone_brick_slab[type=' + kind + ']')
        assert known and boxes[0][1] == low and boxes[0][4] == high
        tested += 1
    assert shape('minecraft:dirt_path')[0][0][4] == .9375
    assert not shape('minecraft:stone_brick_stairs[shape=inner_left]')[1]
    assert not shape('some_mod:unmodeled_machine')[1]
    assert not overlap((0, 0, 0, 1, 1, 1), (0, 1.002, 0, 1, 2.802, 1))
    tested += 4
    return tested


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--world', type=Path, help='Read-only original overworld directory containing region/')
    parser.add_argument('--plan', type=Path, help='Exported builder plan JSON containing ops')
    parser.add_argument('--config', type=Path, default=ROOT / '수정파일/kubejs/config/fcraft_arena_construction_v103.json')
    parser.add_argument('--output', type=Path, default=ROOT / '검증/route_plan_walkability_v104.json')
    parser.add_argument('--max-failures', type=int, default=2000, help='Per-route stored samples; 0 stores all failures')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    tests = self_test()
    if args.self_test and not args.world and not args.plan:
        print(json.dumps({'selfTestsPassed': tests, 'actualMinecraft': False}))
        return 0
    if not args.world or not args.plan:
        parser.error('--world and --plan are required unless only --self-test is requested')
    plan = json.loads(args.plan.read_text(encoding='utf-8-sig'))
    config = json.loads(args.config.read_text(encoding='utf-8-sig'))
    overlay = Overlay(World(args.world), plan)
    routes = [walk_path(path, overlay, args.max_failures) for path in config['routes']['paths']]
    result = {'schema': 'fcraft_static_route_walkability_v104', 'actualMinecraft': False,
              'staticModelOnly': True, 'readOnly': True, 'worldWrites': 0,
              'passedStaticModel': all(r['passedStaticModel'] for r in routes),
              'note': 'Static collision model only. This never replaces actual Minecraft/native voxel collision proof.',
              'world': str(args.world.resolve()), 'plan': str(args.plan.resolve()),
              'planSHA256': digest(args.plan), 'planSignature': plan.get('signature'),
              'config': str(args.config.resolve()), 'configSHA256': digest(args.config),
              'model': {'halfWidth': HALF_WIDTH, 'bodyHeight': BODY_HEIGHT, 'stepLimit': STEP_LIMIT,
                        'samplesPerPointSegment': 5, 'native93Sampling': True,
                        'unknownPolicy': 'Conservative full cube; flagged, never certified clear',
                        'exactRoadShapes': ['full cubes', 'bottom/top/double slabs', 'straight bottom stairs N/S/W/E', '15/16 dirt path and farmland']},
              'selfTestsPassed': tests, 'blockReads': dict(overlay.reads),
              'collisionModels': dict(overlay.models), 'unknownCount': len(overlay.unknown),
              'unknownStates': dict(collections.Counter(v['state'] for v in overlay.unknown.values())),
              'unknownPositions': list(overlay.unknown.values()), 'routes': routes}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({'actualMinecraft': False, 'passedStaticModel': result['passedStaticModel'],
                      'planSignature': result['planSignature'], 'unknownCount': result['unknownCount'],
                      'routes': [{k: r[k] for k in ['id', 'samples', 'failureCount', 'stepFailures', 'bodyOrHeadFailures', 'unknownSamples', 'maximumStep']} for r in routes],
                      'firstFailures': {r['id']: r['failures'][:4] for r in routes},
                      'output': str(args.output.resolve())}, ensure_ascii=False, allow_nan=False))
    return 0 if result['passedStaticModel'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
