from pathlib import Path
import sys, zlib, gzip, math
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'F-Craft_v9_9_본토보스확장/tools'))
from typed_nbt import NBT, plain
class World:
    def __init__(self,path):self.path=Path(path);self.regions={};self.chunks={};self.columns={}
    def chunk(self,cx,cz):
        key=(cx,cz)
        if key in self.chunks:return self.chunks[key]
        region=(cx//32,cz//32)
        if region not in self.regions:
            f=self.path/'region'/('r.%d.%d.mca'%region)
            self.regions[region]=f.read_bytes()if f.is_file()else None
        raw=self.regions[region]
        if raw is None:self.chunks[key]=None;return None
        loc=((cx%32)+(cz%32)*32)*4;sector=int.from_bytes(raw[loc:loc+3],'big');count=raw[loc+3]
        if not sector:self.chunks[key]=None;return None
        off=sector*4096;length=int.from_bytes(raw[off:off+4],'big');compression=raw[off+4]
        if off+length+4>len(raw)or length+4>count*4096:raise ValueError('Bad Anvil allocation')
        data=raw[off+5:off+4+length]
        if compression==2:data=zlib.decompress(data)
        elif compression==1:data=gzip.decompress(data)
        elif compression!=3:raise ValueError('Unsupported chunk compression')
        chunk=plain(NBT(data).root()[1]);assert(chunk['xPos'],chunk['zPos'])==key
        chunk['_sections']={s['Y']:s.get('block_states',{})for s in chunk.get('sections',[])}
        self.chunks[key]=chunk;return chunk
    def block(self,x,y,z):
        x,y,z=int(x),int(y),int(z);c=self.chunk(x//16,z//16)
        if c is None:return {'Name':'missing:chunk'}
        s=c['_sections'].get(y//16,{})
        palette=s.get('palette',[{'Name':'minecraft:air'}])
        if len(palette)==1:return palette[0]
        bits=max(4,(len(palette)-1).bit_length());per=64//bits;i=(y%16)*256+(z%16)*16+x%16
        v=(s['data'][i//per]>>((i%per)*bits))&((1<<bits)-1)
        return palette[v]
    def top(self,x,z):
        c=self.chunk(x//16,z//16)
        if c is None:return None
        h=c.get('Heightmaps',{}).get('WORLD_SURFACE')
        if h:
            i=(z%16)*16+x%16;return((h[i//7]>>((i%7)*9))&511)-65
        return max(c['_sections'],default=19)*16+15
    def column(self,x,z):
        key=(int(x),int(z))
        if key in self.columns:return self.columns[key]
        x,z=key;top=self.top(x,z)
        if top is None:return {'missing':True}
        for y in range(top,-65,-1):
            b=self.block(x,y,z);name=b['Name']
            if ignored(name)or name.endswith(('_log','_wood','_leaves')):continue
            props=b.get('Properties',{});height=.5 if name.endswith('_slab')and props.get('type')=='bottom'else .0625 if name.endswith('_carpet')else 1
            feet=y+height;obstructions=[]
            for yy in range(math.ceil(feet),math.ceil(feet+4)):
                n=self.block(x,yy,z)['Name']
                if not ignored(n):obstructions.append(n)
            out={'x':x,'z':z,'groundY':y,'feetY':feet,'ground':name,'liquid':name in ['minecraft:water','minecraft:lava'],'blocked':bool(obstructions),'above':list(dict.fromkeys(obstructions))}
            self.columns[key]=out;return out
        return {'missing':True}
    def arena(self,x,z,r,step=3):
        c=self.column(x,z);pts=[]
        for dx in range(-r,r+1,step):
            for dz in range(-r,r+1,step):
                if dx*dx+dz*dz<=r*r:pts.append(self.column(x+dx,z+dz))
        valid=[p for p in pts if not p.get('missing')];dry=[p for p in valid if not p['liquid']];clear=[p for p in dry if not p['blocked']]
        return {'x':x,'z':z,'radius':r,'center':c,'sampleCount':len(pts),'missing':len(pts)-len(valid),'water':sum(p['liquid']for p in valid),'blocked':sum(p['blocked']for p in valid),'dryClear':len(clear),'minFeet':min((p['feetY']for p in dry),default=None),'maxFeet':max((p['feetY']for p in dry),default=None)}
def ignored(name):
    return name in {'minecraft:air','minecraft:cave_air','minecraft:void_air','minecraft:grass','minecraft:tall_grass','minecraft:fern','minecraft:large_fern','minecraft:vine','minecraft:snow','minecraft:dead_bush','minecraft:seagrass','minecraft:tall_seagrass','minecraft:dandelion','minecraft:poppy','minecraft:blue_orchid','minecraft:allium','minecraft:azure_bluet','minecraft:cornflower','minecraft:lily_of_the_valley','minecraft:oxeye_daisy','minecraft:sweet_berry_bush','minecraft:torch','minecraft:soul_torch'}or name.endswith(('_sapling','_tulip','_flower'))
