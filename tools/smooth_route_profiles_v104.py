"""Propose half-block walking profiles for the union of three surveyed roads.

Only configuration proposals are written. No world data is edited here.
"""
from pathlib import Path
import argparse, collections, copy, heapq, json

def envelope(values, edges, mode):
    heights=dict(values)
    queue=[(mode*v,k) for k,v in heights.items()]
    heapq.heapify(queue)
    while queue:
        value,key=heapq.heappop(queue);value*=mode
        if value!=heights[key]:continue
        for other in edges[key]:
            target=value+mode
            if (mode==-1 and heights[other]<target) or (mode==1 and heights[other]>target):
                heights[other]=target;heapq.heappush(queue,(mode*target,other))
    return heights

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--config',type=Path,required=True);ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--headroom-cap',action='append',default=[],help='Surveyed x,z,maximumFeetY; preserve the overhead original tree')
    a=ap.parse_args()
    assert a.config.resolve()!=a.output.resolve(),'Keep proposal separate for verification'
    cfg=json.loads(a.config.read_text(encoding='utf-8-sig'));proposal=copy.deepcopy(cfg)
    original={};edges=collections.defaultdict(set);fixed={}
    for route in proposal['routes']['paths']:
        for index,point in enumerate(route['points']):
            key=point['x'],point['z'];base=point.get('sourceBaseY',point['baseY'])
            half='_slab[' in point['sourceState'] and 'type=bottom' in point['sourceState']
            original[key]=2*base+(1 if half else 2)
            if index:
                prior=route['points'][index-1];other=prior['x'],prior['z']
                edges[key].add(other);edges[other].add(key)
        for point in [route['points'][0],route['points'][-1]]:
            key=point['x'],point['z'];fixed[key]=original[key]
    upper=envelope(original,edges,-1);lower=envelope(original,edges,1)
    middle={key:(upper[key]+lower[key])//2 for key in original};middle.update(fixed)
    heights=envelope(middle,edges,-1)
    caps=[]
    for entry in a.headroom_cap:
        x,z,y=map(float,entry.split(','));key=int(x),int(z)
        assert key in heights and y*2==int(y*2)
        heights[key]=min(heights[key],int(y*2));caps.append({'x':key[0],'z':key[1],'maximumFeetY':y})
    if caps:heights=envelope(heights,edges,1)
    assert all(heights[k]==v for k,v in fixed.items()),'An entrance needs separate resurvey'
    assert all(abs(heights[k]-heights[o])<=1 for k in edges for o in edges[k])
    shifts=[(heights[k]-original[k])/2 for k in original]
    assert max(shifts)<=1.5 and min(shifts)>=-2,'Proposal exceeds limited terrain adjustment: '+str((min(shifts),max(shifts)))
    soil={'minecraft:grass_block','minecraft:dirt','minecraft:podzol','minecraft:moss_block','minecraft:rooted_dirt','minecraft:coarse_dirt'}
    for route in proposal['routes']['paths']:
        for point in route['points']:
            key=point['x'],point['z'];foot=heights[key];source=point['sourceState'];base=point.get('sourceBaseY',point['baseY'])
            floor=foot//2 if foot%2 else foot//2-1
            if foot==original[key] and '_stairs[' not in source:
                block='minecraft:coarse_dirt' if source.split('[')[0] in soil else source
            elif foot%2:block='minecraft:stone_brick_slab[type=bottom,waterlogged=false]'
            else:block='minecraft:stone_bricks'
            point.update(y=floor,baseY=min(base,floor),sourceBaseY=base,state=block,surveyedFeetY=original[key]/2,plannedFeetY=foot/2)
    proposal['routes']['profile']={'method':'global half-step midpoint of raising/lowering envelopes',
        'sourceNodes':len(original),'adjustedNodes':sum(v!=0 for v in shifts),
        'maximumRaise':max(shifts),'maximumCut':-min(shifts),'maximumAdjacentFeetStep':.5,
        'fixedEntranceFeet':[{'x':k[0],'z':k[1],'y':v/2}for k,v in fixed.items()], 'headroomCaps':caps}
    proposal['enabled']=False;proposal['approvedNaturalBaseline']=False
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(proposal,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(proposal['routes']['profile'],ensure_ascii=False))

if __name__=='__main__':main()
