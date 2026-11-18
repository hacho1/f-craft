"""Export measured native test-world locations, with provenance and no LIVE claim."""
from pathlib import Path
import argparse, hashlib, json

ROOT=Path(__file__).resolve().parents[1]

def require(ok,message):
    if not ok:raise RuntimeError(message)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--native-result',required=True);args=parser.parse_args()
    p=Path(args.native_result).resolve();require(p.is_relative_to(ROOT.resolve())and p.is_file(),'Use an existing project result')
    r=json.loads(p.read_text(encoding='utf-8-sig'))
    require(r.get('passed')is True and r.get('actualMinecraft')is True,'Native game execution must pass first')
    probe=r['probe'];require('mainland110'in probe['completedSuites'],'The actual mainland suite is required')
    world=probe['mainlandWaystonesV110'];stations=world['stations'];require(len(stations)==9 and all(s.get('built')and s.get('uuid')for s in stations),'All nine native stations required')
    stable=[c for c in probe['checks']if c['name']=='mainland110 actual royal stable CustomNPC exists at preserved east market']
    require(len(stable)==1 and stable[0]['passed']is True,'The actual stable location is required')
    keeper=stable[0].get('detail',stable[0].get('details'))
    require(isinstance(keeper,dict)and keeper.get('uuid'),'Actual stable coordinate details missing')
    themes=world['themeAccents'];require(len(themes)==5 and all(row.get('built')for row in themes.values()),'All five measured themes required')
    result={'passed':True,'actualMinecraft':True,'scope':'Measured isolated native QA world. Production initialization uses the same survey rules; user-edited LIVE geometry may yield another safe nearby site. No claim that LIVE saves were replaced.',
        'sourceReport':str(p),'sourceReportSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),
        'worldSource':r['worldSource'],'worldSourceInventorySHA256':r['worldSourceInventorySHA256'],
        'stations':stations,'royalStableKeeper':keeper,'mainlandThemeAccents':themes,
        'existingFerry':{'npc':'marco','dimension':'minecraft:overworld','x':-103,'y':110,'z':-710,'basis':'Incumbent production NPC target; intentionally preserved, separate from nominal south Waystone anchor.'},
        'nominalVsActual':'Station records retain surveyed real coordinates. Existing mainland fort locations take priority over nominal MD coordinates; new writes avoid original fort footprints and all arena-plan cells.',
        'humanPlay':False,'liveSaveReplacement':False}
    out=ROOT/'검증/v11_0_world_coordinates.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':True,'stations':len(stations),'themes':len(themes),'stable':keeper},ensure_ascii=False))

if __name__=='__main__':main()
