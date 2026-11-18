"""Integrity/regression checks for applied v11 icon resources; no Minecraft claim."""
import hashlib
import argparse
from copy import deepcopy
from decimal import Decimal
import io
import json
from pathlib import Path
import re
import sys
import zipfile

from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
OWN = PROJECT / "개별작업/assets_v110"
PRODUCT = PROJECT / "수정파일"
sys.path.insert(0, str(OWN))
import apply_assets_v110 as binding


def sha(raw): return hashlib.sha256(raw).hexdigest()


MARGIN_LAYOUTS = {
    '03_serdin_and_three_bosses': {
        'receipt': 'v11_0_chapter03_minimum_margin_fix.json',
        'before': 'ce8f9af55e27b884d327f2c04a605cc5b10e98768fd17aaafcb88abfe9253e67',
        'after': '4285938090a1b69f70df85df3c263ba110ee15169d3f73579adff7d299556456',
        'count': 13,
    },
    '05_mainland_five_regions': {
        'receipt': 'v11_0_chapter05_minimum_margin_fix.json',
        'before': '879b58a1f87a934f28183445cb597b1f193f0628061e02e7446a8528330f04a1',
        'after': '0dd5772921f7931756bae5dba36398c74826216cbc07b165883851d2733ea5e6',
        'count': 12,
    },
}


def reviewed_margin_layout(stem):
    """Recompute the approved transform from an immutable earlier input."""
    rule = MARGIN_LAYOUTS[stem]
    relative = 'config/ftbquests/quests/chapters/' + stem + '.snbt'
    cold_path = PROJECT / '검증/native/v110_integrated_cold_08/result.json'
    warm_path = PROJECT / '검증/native/v110_integrated_server_08/result.json'
    cold = json.loads(cold_path.read_text(encoding='utf8'))
    warm = json.loads(warm_path.read_text(encoding='utf8'))
    assert warm['passed'] and warm['sourceCandidatesUnchangedDuringTest']
    assert cold['sourceCandidatesUnchangedDuringTest']
    assert cold['codeHashes'][relative] == warm['codeHashes'][relative] == rule['before']
    source = Path(cold['immutableCandidateSource']) / relative
    assert PROJECT.resolve() in source.resolve().parents
    original_bytes = source.read_bytes()
    assert sha(original_bytes) == rule['before']
    baseline = json.loads(original_bytes.decode('utf-8-sig'))
    receipt_path = PROJECT / '검증' / rule['receipt']
    receipt = json.loads(receipt_path.read_text(encoding='utf8'))
    assert receipt['passed'] and receipt['actualMinecraft'] is False
    assert receipt['beforeSHA256'] == rule['before']
    current_path = PRODUCT / relative
    current_bytes = current_path.read_bytes()
    assert receipt['afterSHA256'] == rule['after'] == sha(current_bytes)
    visible = [q for q in baseline['quests'] if not binding.hidden(q)]
    row_by_id = {row['id']: row for row in receipt['rows']}
    assert len(visible) == len(receipt['rows']) == len(row_by_id) == rule['count']
    assert set(row_by_id) == {q['id'] for q in visible}
    expected = deepcopy(baseline)
    coordinates = {}
    for q in expected['quests']:
        if binding.hidden(q):
            continue
        row = row_by_id[q['id']]
        x, y = q['x'], q['y']
        if stem.startswith('03_'):
            assert receipt['onlyVisibleXCoordinatesChanged'] is True
            assert [row['beforeX'], row['y']] == [x, y]
            after_x = float(Decimal('0.94') * (Decimal(str(x)) - Decimal('4')) + Decimal('4'))
            after_y = y
            assert row['afterX'] == after_x
        else:
            assert receipt['onlyCoordinatesChanged'] is True
            assert row['before'] == [x, y]
            after_x = float(Decimal('0.82') * (Decimal(str(x)) - Decimal('4.5')) + Decimal('4.5'))
            after_y = float(Decimal('0.75') * (Decimal(str(y)) - Decimal('0.5')) + Decimal('0.5'))
            assert row['after'] == [after_x, after_y]
        q['x'], q['y'] = after_x, after_y
        coordinates[q['id']] = [after_x, after_y]
    # Full-object equality keeps hidden nodes, IDs, dependencies, task/reward
    # fields, shapes, icons and all other data outside the approved transform.
    assert json.loads(current_bytes.decode('utf-8-sig')) == expected
    return coordinates, {
        'baselineFile': str(source), 'baselineSHA256': rule['before'],
        'currentSHA256': rule['after'], 'receiptFile': str(receipt_path),
        'receiptSHA256': sha(receipt_path.read_bytes()),
        'warmSourceEvidence': {'file': str(warm_path), 'sha256': sha(warm_path.read_bytes()), 'passed': warm['passed']},
        'coldSourceEvidence': {'file': str(cold_path), 'sha256': sha(cold_path.read_bytes()), 'passed': cold['passed'], 'usedOnlyAsImmutableInput': True},
        'coordinatesIndependentlyRecomputed': coordinates,
        'allOtherJSONFieldsUnchanged': True,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage3', action='store_true', help='Validate reviewed chapter03 compaction and the new personal fifth chapter.')
    args = parser.parse_args()
    checks = []
    def check(name, condition, evidence=None):
        checks.append({"name": name, "passed": bool(condition), "evidence": evidence})
        if not condition: raise AssertionError(name)
    apply = json.loads((OWN / "asset_apply_v110_receipt.json").read_text(encoding="utf-8"))
    staged = json.loads((OWN / "staged_assets_v110_receipt.json").read_text(encoding="utf-8"))
    plan = json.loads((OWN / "asset_resource_plan_v110.json").read_text(encoding="utf-8"))
    backup = Path(apply["backup"])
    check("exact33 required resources plus6 pixel metadata generated", len(plan["nativeResources"]) == 33 and staged["pixelMetadataCount"] == 6)
    resources = {}
    image_count = 0
    for row in plan["nativeResources"]:
        name = row["path"]
        raw = (PRODUCT / "kubejs" / name).read_bytes()
        check_expected = staged["files"][name]["sha256"]
        if sha(raw) != check_expected: raise AssertionError("Loose staged mismatch: " + name)
        resources[name] = raw
        if name.endswith(".png"):
            im = Image.open(io.BytesIO(raw))
            if im.mode != "RGBA" or list(im.size) != row["size"]: raise AssertionError("PNG format: " + name)
            alpha = im.getchannel("A")
            if alpha.getbbox() is None or alpha.getextrema()[0] != 0: raise AssertionError("PNG alpha: " + name)
            image_count += 1
        if row["kind"].startswith("existing_"):
            im = Image.open(io.BytesIO(raw)).convert("RGBA")
            if sha(im.tobytes()) != row["coreRGBA_SHA256"]: raise AssertionError("Professional source pixel mismatch: " + name)
    check("all32 PNGs correct32 or64 RGBA and all loose resources exact stagedSHA", image_count == 32)
    check("professional sprite pixels equal audited source core or atlas cell", True)
    packs = [PRODUCT / "resourcepacks/F-Rank Days RPG Resources.zip", PRODUCT / "config/paxi/resourcepacks/F-Rank Days RPG Resources.zip"]
    check("RPG andPaxi ZIP bytes equal", packs[0].read_bytes() == packs[1].read_bytes())
    with zipfile.ZipFile(packs[0]) as current:
        check("resource ZIP CRC and unique paths valid", current.testzip() is None and len(current.namelist()) == len(set(current.namelist())))
        retained = 0
        for relative in ("resourcepacks/F-Rank Days RPG Resources.zip", "config/paxi/resourcepacks/F-Rank Days RPG Resources.zip"):
            with zipfile.ZipFile(backup / relative) as before:
                for name in before.namelist():
                    expected_override = staged["files"].get(name)
                    if expected_override and name != "pack.mcmeta":
                        expected = (OWN / "staged_pack" / name).read_bytes()
                    else:
                        expected = before.read(name); retained += 1
                    if current.read(name) != expected: raise AssertionError("Original resource lost: " + name)
        check("all original pack entries preserved outside exact declared overrides", True, {"retainedAcrossBoth": retained, "sourceEntryCounts": [x["originalEntries"] for x in apply["details"]["packs"].values()]})
        for name, row in staged["files"].items():
            if name == "pack.mcmeta": continue
            if sha(current.read(name)) != row["sha256"]: raise AssertionError("ZIP staged mismatch: " + name)
            if name.startswith("assets/") and (PRODUCT / "kubejs" / name).read_bytes() != current.read(name): raise AssertionError("ZIP/loose mismatch: " + name)
        check("ZIP Paxi andloose select identical33textures/theme/metas/credits", True)
    counters = {"visible": 0, "tasks": 0, "custom": 0, "licenceQuestsPreserved": 0, "hidden": 0}
    chapters = []
    compaction = None
    layout_proofs = {}
    approved_coords = {}
    if args.stage3:
        compaction = json.loads((PROJECT / '검증/v11_0_serdin_quest_layout_compaction.json').read_text(encoding='utf8'))
        for stem in MARGIN_LAYOUTS:
            approved_coords[stem], layout_proofs[stem] = reviewed_margin_layout(stem)
        baseline03 = json.loads(Path(layout_proofs['03_serdin_and_three_bosses']['baselineFile']).read_text(encoding='utf-8-sig'))
        baseline03_map = {q['id']: q for q in baseline03['quests']}
        check('reviewed chapter03 compaction receipt binds exact thirteen coordinates', compaction['passed'] and compaction['changedOnlyXY'] == 13 and len(compaction['coords']) == 13 and compaction['allIdsDependenciesIconsShapesProgressFieldsPreserved'] and compaction['afterSHA256'] == MARGIN_LAYOUTS['03_serdin_and_three_bosses']['before'] and all([baseline03_map[qid]['x'], baseline03_map[qid]['y']] == xy for qid, xy in compaction['coords'].items()), layout_proofs['03_serdin_and_three_bosses'])
        check('reviewed chapter03 and fifth minimum-screen margins follow exact approved transforms with all nonposition fields unchanged', all(p['allOtherJSONFieldsUnchanged'] for p in layout_proofs.values()), layout_proofs)
    for index, stem in enumerate(binding.CHAPTERS):
        relative = "config/ftbquests/quests/chapters/" + stem + ".snbt"
        old = json.loads((backup / relative).read_text(encoding="utf-8-sig"))
        new = json.loads((PRODUCT / relative).read_text(encoding="utf-8-sig"))
        chapters.append(new)
        if args.stage3 and stem == '03_serdin_and_three_bosses':
            old_q = {q['id']: q for q in old['quests']}
            for qid, xy in approved_coords[stem].items():
                if qid not in old_q: raise AssertionError('Compaction changed unknown old quest')
                old_q[qid]['x'], old_q[qid]['y'] = xy
        if binding.visual_only(old) != binding.visual_only(new): raise AssertionError("Quest nonvisual data changed")
        old_map = {q["id"]: q for q in old["quests"]}
        if new["icon"]["id"] != "ftbquests:custom_icon": raise AssertionError("Chapter custom icon item missing")
        for q in new["quests"]:
            if binding.hidden(q):
                if old_map[q["id"]] != q: raise AssertionError("Hidden legacy gate modified")
                counters["hidden"] += 1
                continue
            counters["visible"] += 1
            if index == 1:
                if q["icon"] != old_map[q["id"]]["icon"]: raise AssertionError("Licence art changed")
                counters["licenceQuestsPreserved"] += 1
            else:
                ic = q["icon"]
                if not isinstance(ic, dict) or ic.get("id") != "ftbquests:custom_icon" or ic.get("Count") != 1: raise AssertionError("Unsupported custom icon encoding")
                rl = ic["tag"]["Icon"]; namespace, path = rl.split(":", 1)
                if "assets/" + namespace + "/" + path not in resources: raise AssertionError("Missing mapped PNG")
            if q.get("shape") not in {"circle", "rsquare"}: raise AssertionError("Missing actual native shape")
            if q["shape"] == "rsquare" and q.get("size") != 1.35: raise AssertionError("Boss medallion size")
            for t in q.get("tasks", []):
                if t.get("icon") != q["icon"]: raise AssertionError("Task/toast icon fallback remains")
                counters["tasks"] += 1
                if t.get("type") == "custom": counters["custom"] += 1
    check("questIDs taskIDs dependencies progress hidden gates and unreviewed layout unchanged" if args.stage3 else "questIDs taskIDs dependencies layout progress andhidden gates unchanged", True, counters)
    check("visible nodes162 andtasks165 including157 custom have coherenticon", counters["visible"] == 162 and counters["tasks"] == 165 and counters["custom"] == 157)
    check("all72 twelvejob licence quest icons retain original item IDs", counters["licenceQuestsPreserved"] == 72)
    if args.stage3:
        first = [q for q in chapters[0]['quests'] if not binding.hidden(q)]
        check('original arrival six-node compact layout remains exact', [[q['x'], q['y']] for q in first] == [[0,0],[2,0],[4,0],[4,3],[2,3],[0,3]])
        fifth_path = PRODUCT / 'config/ftbquests/quests/chapters/05_mainland_five_regions.snbt'
        fifth = json.loads(fifth_path.read_text(encoding='utf-8-sig'))
        def hex_ids(obj):
            result = []
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k == 'id' and isinstance(v, str) and re.fullmatch(r'[0-9A-Fa-f]{16}', v): result.append(v.upper())
                    else: result += hex_ids(v)
            elif isinstance(obj, list):
                for v in obj: result += hex_ids(v)
            return result
        old_ids = {value for chapter in chapters for value in hex_ids(chapter)}
        new_ids = hex_ids(fifth)
        check('fifth chapter introduces distinct IDs without colliding with old four chapters', len(new_ids) == len(set(new_ids)) and not old_ids.intersection(new_ids), {'newObjectIds': len(new_ids)})
        check('fifth personal chapter contains twelve real quests and custom tasks', len(fifth['quests']) == 12 and sum(len(q.get('tasks', [])) for q in fifth['quests']) == 12 and all(t.get('type') == 'custom' for q in fifth['quests'] for t in q.get('tasks', [])))
        mapped = []
        with zipfile.ZipFile(packs[0]) as pack:
            def mapped_icon(icon):
                if not isinstance(icon, dict) or icon.get('id') != 'ftbquests:custom_icon' or icon.get('Count') != 1: raise AssertionError('Fifth chapter unsupported custom icon')
                namespace, name = icon['tag']['Icon'].split(':', 1)
                rel = 'assets/' + namespace + '/' + name
                raw = (PRODUCT / 'kubejs' / rel).read_bytes()
                if pack.read(rel) != raw: raise AssertionError('Fifth chapter loose/ZIP icon mismatch')
                im = Image.open(io.BytesIO(raw)); im.load()
                if im.size != (32, 32): raise AssertionError('Fifth chapter native icon is not32px: ' + rel)
                mapped.append(rel)
            mapped_icon(fifth['icon'])
            for i, q in enumerate(fifth['quests']):
                mapped_icon(q['icon'])
                expected = 'circle' if i < 6 else 'rsquare'
                if q.get('shape') != expected or (expected == 'rsquare' and q.get('size') != 1.35): raise AssertionError('Fifth chapter actual normal/boss medallion mismatch')
                for task in q['tasks']:
                    if task.get('icon') != q['icon']: raise AssertionError('Fifth chapter task/toast fallback icon')
        check('all fifth-chapter node tab and task icons resolve real32px art and proper normal boss shapes', True, {'resources': sorted(set(mapped)), 'quests': 12, 'tasks': 12})
        header = (PRODUCT / 'config/ftbquests/quests/data.snbt').read_text(encoding='utf-8-sig')
        check('global native FTB modpack book icon is the red-wax quill book item', re.search(r'(?m)^\s*icon:\s*"ftbquests:book"\s*$', header) is not None)
        alias = PRODUCT / 'kubejs/assets/f_rank_days/textures/item/mount_whistle.png'
        horn = PRODUCT / 'kubejs/assets/f_rank_days/textures/gui/quests/node_mount_whistle.png'
        with zipfile.ZipFile(packs[0]) as pack:
            check('mount item reuses exact licensed horn and ZIP Paxi loose aliases match', alias.read_bytes() == horn.read_bytes() == pack.read('assets/f_rank_days/textures/item/mount_whistle.png'))
    text = resources["assets/ftbquests/ftb_quests_theme.txt"].decode()
    expected_colors = {"quest_not_started_color": "#DCEFE4CE", "quest_started_color": "#DC4CE8D0", "quest_completed_color": "#DCE8B948"}
    check("supported native quest statecolors ivory teal gold", all(re.search(r"(?m)^" + key + r":\s*" + re.escape(value) + r"\s*$", text) for key, value in expected_colors.items()))
    for shape in ("circle", "rsquare"):
        im = Image.open(PRODUCT / f"kubejs/assets/ftbquests/textures/shapes/{shape}/shape.png").convert("RGBA")
        if im.getpixel((31, 31))[3] != 255 or im.getpixel((0, 0))[3] != 0: raise AssertionError("Click mask geometry")
        for layer in ("background", "outline", "shape"):
            p = PRODUCT / f"kubejs/assets/ftbquests/textures/shapes/{shape}/{layer}.png.mcmeta"
            if json.loads(p.read_text())["texture"]["blur"] is not False: raise AssertionError("Inherited texture blur")
    check("64pixel medallion nativeclickmask and6 blurfalsemetadata", True)
    generated = json.loads((OWN / "generated_book_provenance_v110.json").read_text(encoding="utf-8"))
    check("generatedbook sourceunchanged and4aliases exact32SHA withtransparentalpha", sha(Path(generated["source"]).read_bytes()) == generated["sourceSHA256"] and all(sha((PRODUCT / "kubejs" / p).read_bytes()) == generated["outputSHA256"] for p in generated["intendedPathsAfterStage2GO"]))
    result = {"passed": True, "actualMinecraft": False, "actualClient": False, "humanManualPlay": False, "stage3": args.stage3, "scope": "File, source-pixel, ZIP-retention, existing quest preservation with exact independently recomputed chapter03/05 margin transforms, and fifth-chapter resource binding; actual Minecraft execution is separate evidence" if args.stage3 else "File, source-pixel, ZIP-retention and quest visual-only regression; runtime task.getIcon/resource and UI proof still requires ROOT native client", "checks": checks, "checkCount": len(checks), "applyReceiptSHA256": sha((OWN / "asset_apply_v110_receipt.json").read_bytes()), "sourceHashes": {"test": sha(Path(__file__).read_bytes()), "bindingTool": sha(Path(binding.__file__).read_bytes())}}
    out = PROJECT / ("검증/quest_icon_bindings_stage3_v110.json" if args.stage3 else "검증/quest_icon_bindings_v110.json")
    if args.stage3:
        result['reviewedLayoutProofs'] = layout_proofs
        result['sourceHashes']['chapters'] = {stem: sha((PRODUCT / ('config/ftbquests/quests/chapters/' + stem + '.snbt')).read_bytes()) for stem in list(binding.CHAPTERS) + ['05_mainland_five_regions']}
        previous = PROJECT / '검증/quest_icon_bindings_v110.json'
        result['preservedStage2Receipt'] = {'file': str(previous), 'sha256': sha(previous.read_bytes()), 'passed': json.loads(previous.read_text(encoding='utf8'))['passed']}
        if out.is_file():
            previous_raw = out.read_bytes()
            previous_data = json.loads(previous_raw.decode('utf8'))
            if previous_data.get('sourceHashes', {}).get('test') == result['sourceHashes']['test'] and 'reviewedLayoutProofs' in previous_data:
                result['preservedStage3Receipt'] = previous_data.get('preservedStage3Receipt')
            else:
                archived = PROJECT / '검증/evidence_before_minimum_margin_v110' / ('quest_icon_bindings_stage3_v110_' + sha(previous_raw) + '.json')
                archived.parent.mkdir(parents=True, exist_ok=True)
                assert not archived.exists() or archived.read_bytes() == previous_raw
                archived.write_bytes(previous_raw)
                result['preservedStage3Receipt'] = {'file': str(archived), 'sha256': sha(previous_raw), 'passed': previous_data['passed']}
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": True, "checks": len(checks), "actualMinecraft": False, "report": str(out)}, ensure_ascii=False))


if __name__ == "__main__": main()
