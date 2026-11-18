"""Inspect installed Waystones bytecode; no JVM and no Minecraft behavior claim."""
from pathlib import Path
import hashlib,json,runpy,struct,zipfile
ROOT=Path(__file__).resolve().parents[1]
parser=runpy.run_path(str(ROOT/'개별작업/mainland_v110/inspect_waystone_bytecode_v110.py'))
jar_path=ROOT/'개별작업/dependencies_v110/waystones-forge-1.20.1-14.1.21.jar'
jar=zipfile.ZipFile(jar_path)
name='net/blay09/mods/waystones/core/PlayerWaystoneManager'
methods={m[1]:m for m in parser['methods'](jar.read(name+'.class'))}
def ops(method):
    _,_,_,b,ref=methods[method];out=[];i=0
    while i<len(b):
        op=b[i];size=parser['LENGTH'].get(op,1);row={'offset':i,'opcode':op}
        if 0xb2<=op<0xba:row['reference']=ref(int.from_bytes(b[i+1:i+3],'big'))
        if op==0xaa:
            p=i+1
            while p%4:p+=1
            default,lo,hi=struct.unpack('>iii',b[p:p+12]);targets=struct.unpack('>'+'i'*(hi-lo+1),b[p+12:p+12+4*(hi-lo+1)])
            row['cases']={str(k):i+v for k,v in zip(range(lo,hi+1),targets)};size=p+12+4*(hi-lo+1)-i
        elif op==0xab:
            p=i+1
            while p%4:p+=1
            size=p+8+8*int.from_bytes(b[p+4:p+8],'big')-i
        elif op==0xc4:size=6 if b[i+1]==0x84 else 4
        out.append(row);i+=size
    return out
checks=[]
def check(label,value):
    checks.append({'name':label,'passed':bool(value)})
    assert value,label
warp=ops('canUseWarpMode');switch=next(x for x in warp if 'cases'in x);start=switch['cases']['6'];end=min(v for v in switch['cases'].values() if v>start)
branch=[x for x in warp if start<=x['offset']<end];refs=[x['reference'] for x in branch if 'reference'in x]
check('installed source mode branch is config plus valid ordinary from-Waystone',start==215 and end==263 and refs==[
 'net/blay09/mods/waystones/config/WaystonesConfig.getActive()Lnet/blay09/mods/waystones/config/WaystonesConfigData;',
 'net/blay09/mods/waystones/config/WaystonesConfigData.restrictionsLnet/blay09/mods/waystones/config/WaystonesConfigData$Restrictions;',
 'net/blay09/mods/waystones/config/WaystonesConfigData$Restrictions.allowWaystoneToWaystoneTeleportZ',
 'net/blay09/mods/waystones/api/IWaystone.isValid()Z',
 'net/blay09/mods/waystones/api/IWaystone.getWaystoneType()Lnet/minecraft/resources/ResourceLocation;',
 'net/blay09/mods/waystones/core/WaystoneTypes.WAYSTONELnet/minecraft/resources/ResourceLocation;',
 'net/minecraft/resources/ResourceLocation.equals(Ljava/lang/Object;)Z'])
check('installed source mode branch has no player position, distance, menu or riding inspection',not any(k in r.lower() for r in refs for k in ['position','distance','menu','riding']))
teleport=ops('tryTeleport');calls={x['offset']:x.get('reference','') for x in teleport}
check('actual Pre event runs before source-mode check',calls[13].endswith('BalmEvents.fireEvent(Ljava/lang/Object;)V') and 'canUseWarpMode' in calls[73])
check('target predicate is a separate possible WarpModeRejected path after source check','getAllowTeleportPredicate' in calls[92] and 'BiPredicate.test' in calls[97])
native=(ROOT/'tests/native/98_personal_mount_v110.js').read_text(encoding='utf8')
check('QA requires actual stationProbe success and reacquires native pair before same mode API',"F.OFFICIAL_WAYSTONES_V110.stationProbe(server,from,true)"in native and "var freshFrom=API.getWaystoneAt("in native and "freshTo.get(),Mode.WAYSTONE_TO_WAYSTONE,freshFrom.get()"in native)
check('QA records actual validity UUID type and activation without custom-mode bypass',all(x in native for x in ['stone.getWaystoneUid()','stone.isValid()','stone.getWaystoneType()','stone.getName()','API.isWaystoneActivated','targetModePredicate']) and 'Mode.CUSTOM'not in native)
report={'passed':True,'actualMinecraft':False,'javaProcessesStarted':0,'scope':'Exact installed Waystones14.1.21 bytecode audit; QA-only readiness change, no product54/56 change','checks':checks,'jarSHA256':hashlib.sha256(jar_path.read_bytes()).hexdigest(),'classSHA256':hashlib.sha256(jar.read(name+'.class')).hexdigest(),'sourceModeCase':branch,'teleportOrder':[x for x in teleport if x['offset']<=115 and 'reference'in x],'native98SHA256':hashlib.sha256(native.encode()).hexdigest()}
(ROOT/'검증/v11_0_mount_waystone_mode_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'PASS {len(checks)} installed-bytecode/QA checks; Java processes started 0')
