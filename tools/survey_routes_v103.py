"""Read-only MCA survey and native-build inputs. Never edits a source world."""
from pathlib import Path
import sys,json,math,heapq,itertools,re
sys.dont_write_bytecode=True
from anvil_readonly import World,ignored
ROOT=Path(__file__).resolve().parents[1]
LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __')
CFG=ROOT/'수정파일/kubejs/config/fcraft_arena_construction_v103.json'
def canonical(state):return state['Name']+('['+','.join(k+'='+v for k,v in sorted(state.get('Properties',{}).items()))+']'if state.get('Properties')else'')
def main():
 cfg=json.loads(CFG.read_text('utf-8'));w=World(LIVE/'saves/F-Craft - 새로운 시작 (v9.7)')
 selected=[('krag',73,160,-1319,12,{'north':(0,161),'south':(0,160),'east':(0,161),'west':(0,160)}),('blossom',-121,137,-1529,15,{'north':(4,137),'south':(6,139),'east':(0,138),'west':(0,136)}),('wrought',-297,132,-1347,16,{'north':(3,134),'south':(3,135),'east':(1,135),'west':(-1,129)})]
 cfg['arenas']=[]
 for ident,x,y,z,r,entrances in selected:
  cfg['arenas'].append({'id':ident,'verified':True,'floor':{'x':x,'y':y,'z':z},'scanTopY':319,'magneticNodeHeight':2,'entrances':{name:{'offset':off,'groundY':ground,'measurementDistance':r+3}for name,(off,ground)in entrances.items()}})
 cfg['sourceSpec']='원본지시/f_craft_3_3.md';cfg['worldGate']['markerValue']='fcraft_v9_medieval_town_verified_01'
 # Arena guards use the full45m margin. Walking paths preserve physical POIs.
 def protected(x,z):
  for p in cfg['protected']:
   if 'bounds'in p:
    b=p['bounds'];d=math.hypot(max(b['minX']-x,0,x-b['maxX']),max(b['minZ']-z,0,z-b['maxZ']))
   else:d=math.hypot(x-p['x'],z-p['z'])-p.get('radius',0)
   if d<2:return True
  for _,ax,_,az,r,_ in selected:
   if math.hypot(x-ax,z-az)<r+2:return True
  return False
 road={'minecraft:stone_bricks','minecraft:mossy_stone_bricks','minecraft:cracked_stone_bricks','minecraft:cobblestone','minecraft:mossy_cobblestone','minecraft:dirt_path','minecraft:coarse_dirt','minecraft:deepslate_bricks'}
 natural={'minecraft:grass_block','minecraft:dirt','minecraft:podzol','minecraft:moss_block','minecraft:rooted_dirt','minecraft:stone','minecraft:gravel','minecraft:andesite','minecraft:granite','minecraft:tuff'}
 cache={}
 def cell(x,z):
  if (x,z)in cache:return cache[x,z]
  if not(-340<=x<=130 and -1570<=z<=-1148)or protected(x,z):cache[x,z]=None;return None
  p=w.column(x,z)
  if p.get('missing'):cache[x,z]=None;return None
  def oldroad(name):return name in road or bool(re.match(r'minecraft:(stone|stone_brick|mossy_stone_brick|cobblestone|mossy_cobblestone|deepslate_brick)_(slab|stairs)$',name))
  if p['ground']not in natural and not oldroad(p['ground']):
   # Existing south-gate roof is above the walkable original road. Never route
   # onto or overwrite that roof merely because WORLD_SURFACE sees it first.
   p=None
   for y in range(w.top(x,z),106,-1):
    name=w.block(x,y,z)['Name']
    if name not in natural and not oldroad(name):continue
    above=[w.block(x,yy,z)['Name']for yy in range(y+1,y+4)]
    if any(not ignored(n)and not n.endswith('_leaves')for n in above):continue
    p={'groundY':y,'ground':name,'liquid':False,'blocked':any(n.endswith('_leaves')for n in above),'above':above};break
   if p is None:cache[x,z]=None;return None
  if p['liquid']or p['groundY']<=106 or any(n.endswith(('_log','_wood'))for n in p.get('above',[])):cache[x,z]=None;return None
  if any(not ignored(w.block(x,yy,z)['Name'])for yy in range(int(p['groundY'])+1,int(p['groundY'])+4)):cache[x,z]=None;return None
  n=p['ground'];isroad=oldroad(n)
  if n not in natural and not isroad:cache[x,z]=None;return None
  result={'x':x,'y':int(p['groundY']),'z':z,'sourceState':canonical(w.block(x,p['groundY'],z)),'road':isroad,'blockedFoliage':bool(p['blocked'])};cache[x,z]=result;return result
 def path(start,goal):
  counter=itertools.count();q=[];heapq.heappush(q,(0,next(counter),start));cost={start:0};parents={};visits=0
  while q:
   _,_,here=heapq.heappop(q);visits+=1
   if here==goal:
    points=[]
    while True:
     points.append(dict(cell(*here)))
     if here==start:break
     here=parents[here]
    return list(reversed(points)),visits
   c=cell(*here)
   if c is None:continue
   for dx,dz in [(1,0),(-1,0),(0,1),(0,-1)]:
    nxt=(here[0]+dx,here[1]+dz);n=cell(*nxt)
    if n is None or abs(n['y']-c['y'])>3:continue
    value=cost[here]+(0.65 if n['road'] else 1)+abs(n['y']-c['y'])*0.7+(0.2 if n['blockedFoliage'] else 0)+max(0,abs(n['y']-c['y'])-1)*8
    if value>=cost.get(nxt,float('inf')):continue
    parents[nxt]=here;cost[nxt]=value
    heuristic=(abs(goal[0]-nxt[0])+abs(goal[1]-nxt[1]))*.65
    heapq.heappush(q,(value+heuristic,next(counter),nxt))
  bounds={'minX':min(p[0]for p in cost),'maxX':max(p[0]for p in cost),'minZ':min(p[1]for p in cost),'maxZ':max(p[1]for p in cost)}
  raise RuntimeError('No safe dry read-only surveyed route '+str(goal)+' reachable='+str(len(cost))+' bounds='+str(bounds))
 start=(-99,-1155);assert cell(*start)
 targets=[('east_krag',(58,-1319)),('north_blossom',(-127,-1511)),('west_wrought',(-278,-1346))]
 routes=[];evidence=[]
 for ident,goal in targets:
  assert cell(*goal),goal
  points,visits=path(start,goal)
  heights=[p['y']for p in points]
  for _ in range(len(heights)):
   changed=False
   for i in range(1,len(heights)):
    if heights[i]>heights[i-1]+1:heights[i-1]=heights[i]-1;changed=True
    elif heights[i-1]>heights[i]+1:heights[i]=heights[i-1]-1;changed=True
   if not changed:break
  output=[]
  for i,p in enumerate(points):
   h=heights[i];higher=None
   for j in [i+1,i-1]:
    if 0<=j<len(points)and heights[j]>h:higher=points[j];break
   if higher:
    dx,dz=higher['x']-p['x'],higher['z']-p['z'];facing='east'if dx>0 else'west'if dx<0 else'south'if dz>0 else'north';state='minecraft:stone_brick_stairs[facing='+facing+',half=bottom,shape=straight,waterlogged=false]';h+=1
   else:state=p['sourceState']if p['road']and h==p['y']else'minecraft:coarse_dirt'
   output.append({'x':p['x'],'y':h,'z':p['z'],'baseY':p['y'],'state':state,'sourceState':p['sourceState']})
  route={'id':ident,'width':1,'points':output}
  routes.append(route);evidence.append({'id':ident,'pointCount':len(points),'visited':visits,'start':points[0],'end':points[-1],'maxGroundStep':max(abs(a['y']-b['y'])for a,b in zip(points,points[1:])),'dry':True,'centerlineHeadLogsAndLeavesAvoided':True})
 cfg['routes']['paths']=routes;cfg['enabled']=False;cfg['approvedNaturalBaseline']=False
 CFG.write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 report={'passed':True,'actualMinecraft':False,'readOnly':True,'worldWrites':0,'routes':evidence,'surveyedColumns':len(cache),'note':'Shared original bridge approach retained;3 branches continue into requested east/north/west arenas. Native physical construction and walkability still require verification.'}
 (ROOT/'검증/v103_routes_survey.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
