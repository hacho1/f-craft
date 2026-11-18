"""Approve exact original blocks for one fixed plan after two independent MCA reads."""
from pathlib import Path
import argparse,collections,hashlib,json,re,sys
sys.dont_write_bytecode=True
from anvil_readonly import World
from survey_routes_v103 import canonical
ROOT=Path(__file__).resolve().parents[1]
LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--plan',type=Path,required=True);a=ap.parse_args()
 plan=json.loads(a.plan.read_text('utf-8'));ops=plan['operations'];cfgpath=ROOT/'수정파일/kubejs/config/fcraft_arena_construction_v103.json';cfg=json.loads(cfgpath.read_text('utf-8'))
 w=World(LIVE/'saves/F-Craft - 새로운 시작 (v9.7)');template=World(LIVE/'fcraft-v96-template')
 code=(ROOT/'수정파일/kubejs/server_scripts/48_serdin_three_boss_arenas_builder_v10_3.js').read_text('utf-8');pattern=re.search(r'function natural\(id\)\{return /(.*)/\.test\(id\);\}',code).group(1);natural=re.compile(pattern)
 allowedRoad={'minecraft:stone_bricks','minecraft:mossy_stone_bricks','minecraft:cracked_stone_bricks','minecraft:mossy_cobblestone','minecraft:cobblestone','minecraft:stone_brick_slab','minecraft:mossy_stone_brick_slab','minecraft:cobblestone_slab','minecraft:stone_brick_stairs','minecraft:mossy_stone_brick_stairs','minecraft:cobblestone_stairs','minecraft:stone_stairs','minecraft:dirt_path','minecraft:deepslate_bricks','minecraft:deepslate_tiles','minecraft:polished_basalt','minecraft:polished_blackstone_bricks'}
 # Two existing F-Craft forest path lights fall inside the newly authorized
 # elven arena. Replace these four exact cells with its new floor/lighting;
 # this is not permission to clear any other fence, lantern or structure.
 oldPathLightCells={'-122,138,-1537':'minecraft:spruce_fence','-122,139,-1537':'minecraft:lantern','-124,138,-1523':'minecraft:lantern','-124,137,-1523':'minecraft:spruce_fence'}
 rows=[];bad=[];allowed={};counts=collections.Counter();beCache={};cutColumns={}
 for route in cfg.get('routes',{}).get('paths',[]):
  for point in route['points']:
   originalY=point.get('sourceBaseY',point['baseY'])
   if originalY>point['y']:
    assert originalY-point['y']<=2,'Only measured shallow road grading is approved'
    cutColumns[(point['x'],point['z'])]=(point['y'],originalY)
 cutMaterials={'minecraft:grass_block','minecraft:dirt','minecraft:coarse_dirt','minecraft:rooted_dirt','minecraft:podzol','minecraft:moss_block','minecraft:stone','minecraft:andesite','minecraft:diorite','minecraft:granite','minecraft:tuff','minecraft:gravel','minecraft:sand'}
 for op in ops:
  x,y,z=op['x'],op['y'],op['z'];b=w.block(x,y,z);state=canonical(b);baseline=canonical(template.block(x,y,z));k=f'{x},{y},{z}'
  if state!=baseline:bad.append({'reason':'existing_player_or_source_change','cell':k,'current':state,'starter':baseline,'operation':op})
  ck=(x//16,z//16)
  if ck not in beCache:beCache[ck]={(p['x'],p['y'],p['z'])for p in w.chunk(*ck).get('block_entities',[])}
  if(x,y,z)in beCache[ck]:bad.append({'reason':'original_block_entity','cell':k,'state':state,'operation':op})
  if b['Name']in ['minecraft:water','minecraft:lava']or b.get('Properties',{}).get('waterlogged')=='true':
   if not(op['kind']=='junction_pier'and b['Name']=='minecraft:water'):bad.append({'reason':'fluid_outside_approved_bridge_pier','cell':k,'state':state,'operation':op})
  changed=state!=op['state']
  cut=cutColumns.get((x,z))
  if changed and op['kind']=='route_clear' and cut and cut[0]<y<=cut[1] and b['Name'] in cutMaterials:
   allowed[k]=state;counts['approved_exact_surveyed_shallow_road_cut_cells']+=1
  if changed and not natural.fullmatch(b['Name'])and b['Name']not in ['minecraft:water']:
   if b['Name']in allowedRoad:allowed[k]=state;counts['approved_original_road_cells']+=1
   elif k=='-312,117,-1880' and b['Name']=='f_rank_days:wrought_trial_altar':allowed[k]=state;counts['approved_exact_repurposed_old_trial_altar']+=1
   elif oldPathLightCells.get(k)==b['Name']:allowed[k]=state;counts['approved_exact_old_path_light_cells']+=1
   else:bad.append({'reason':'unknown_original_structure','cell':k,'state':state,'operation':op})
  if op['kind']=='route_clear'and changed and b['Name'].endswith(('_log','_wood','_leaves')):bad.append({'reason':'route_original_tree','cell':k,'state':state,'operation':op})
  counts['source_'+b['Name']]+=1;rows.append((x,y,z,state))
 rows.sort(key=lambda p:(p[0],p[1],p[2]));runs=[]
 for x,y,z,state in rows:
  if runs and runs[-1][0]==x and runs[-1][1]==y and runs[-1][2]+runs[-1][3]==z and runs[-1][4]==state:runs[-1][3]+=1
  else:runs.append([x,y,z,1,state])
 sourceHashes={}
 for label,world in [('current',w),('starter',template)]:
  sourceHashes[label]={f'r.{rx}.{rz}.mca':sha(world.path/'region'/f'r.{rx}.{rz}.mca')for rx,rz in sorted(world.regions)}
 raw=json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode();inventorySHA=hashlib.sha256(raw).hexdigest()
 report={'passed':not bad,'actualMinecraft':False,'readOnly':True,'worldWrites':0,'planSignature':plan['signature'],'cells':len(rows),'rleRuns':len(runs),'originalSourceMatches':not any(b['reason']=='existing_player_or_source_change'for b in bad),'blockEntitiesTouched':sum(b['reason']=='original_block_entity'for b in bad),'inventorySHA256':inventorySHA,'sourceFiles':sourceHashes,'counts':dict(counts),'failures':bad}
 target=ROOT/'검증/arena_preimage_approval_v104.json';target.write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps({k:v for k,v in report.items()if k not in ['sourceFiles','counts','failures']}|{'failureCount':len(bad),'firstFailures':bad[:8]},ensure_ascii=False),flush=True)
 if bad:raise RuntimeError('Original-state approval failed; source worlds untouched, builder remains disabled')
 data={'encoding':'rle_xyz_runs_v1','inventorySHA256':inventorySHA,'planSignature':plan['signature'],'sourceFiles':sourceHashes,'runs':runs}
 out=ROOT/'수정파일/kubejs/config/fcraft_arena_preimages_v104.json';out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n','utf-8')
 cfg['preimage']={'file':'kubejs/config/fcraft_arena_preimages_v104.json','inventorySHA256':inventorySHA,'planSignature':plan['signature'],'cells':len(rows),'sha256':sha(out)}
 cfg['allowOriginalInfrastructure']=True;cfg['allowedOriginalStates']=allowed;cfg['approvedNaturalBaseline']=True;cfg['enabled']=True
 cfgpath.write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n','utf-8')
if __name__=='__main__':main()
