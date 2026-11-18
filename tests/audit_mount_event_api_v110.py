"""Inspect the exact installed Forge/KubeJS/Corpse classfiles without Java."""
from pathlib import Path
import hashlib, importlib.util, io, json, struct, zipfile

LOCAL=Path(__file__).resolve().parents[1]
IS_STAGED=(LOCAL/'kubejs/server_scripts/54_personal_mount_v11_0.js').exists()
ROOT=LOCAL.parents[2] if IS_STAGED else LOCAL
STAGING=LOCAL if IS_STAGED else ROOT/'수정파일'
LIB=Path('E:/F-Craft/마크/F-Craft_7차_1장3보스_수호자무구/테스트프로필/server/libraries/net/minecraftforge/forge/1.20.1-47.4.28')
MODS=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __/mods')
spec=importlib.util.spec_from_file_location('read_only_dependency_inspector',ROOT/'개별작업/mainland_v110/inspect_dependency_api.py')
reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)

def sha(raw):return hashlib.sha256(raw).hexdigest()
def class_code(raw):
 s=io.BytesIO(raw)
 def u1():return s.read(1)[0]
 def u2():return struct.unpack('>H',s.read(2))[0]
 def u4():return struct.unpack('>I',s.read(4))[0]
 assert u4()==0xcafebabe;s.read(4);cp=[None]*u2();i=1
 while i<len(cp):
  t=u1()
  if t==1:cp[i]=s.read(u2()).decode('utf8','replace')
  elif t in (3,4):s.read(4)
  elif t in (5,6):s.read(8);i+=1
  elif t in (7,8,16,19,20):cp[i]=(t,u2())
  elif t in (9,10,11,12,17,18):cp[i]=(t,u2(),u2())
  elif t==15:cp[i]=(t,u1(),u2())
  else:raise ValueError(t)
  i+=1
 def attrs():return [(cp[u2()],s.read(u4())) for _ in range(u2())]
 s.read(6);s.read(2*u2())
 for _ in range(u2()):s.read(6);attrs()
 methods=[]
 for _ in range(u2()):
  flags,name,desc=u2(),cp[u2()],cp[u2()]
  for key,data in attrs():
   if key=='Code':
    n=int.from_bytes(data[4:8],'big');methods.append((name,desc,data[8:8+n]))
 def ref(index):
  value=cp[index]
  if not isinstance(value,tuple)or value[0]not in (9,10,11):return None
  nt=cp[value[2]];return cp[cp[value[1]][1]]+'.'+cp[nt[1]]+cp[nt[2]]
 result=[]
 length={16:2,17:3,18:2,19:3,20:3,132:3,169:2,178:3,179:3,180:3,181:3,182:3,183:3,184:3,185:5,186:5,187:3,188:2,189:3,192:3,193:3,197:4,198:3,199:3,200:5,201:5}
 for op in list(range(21,26))+list(range(54,59)):length[op]=2
 for op in range(153,169):length[op]=3
 for name,desc,code in methods:
  calls=[];at=0
  while at<len(code):
   op=code[at]
   if op in (178,179,180,181,182,183,184,185):calls.append({'offset':at,'opcode':hex(op),'target':ref(int.from_bytes(code[at+1:at+3],'big'))})
   if op==170:
    p=at+1+((-at-1)%4);low,high=struct.unpack('>ii',code[p+4:p+12]);size=p-at+12+4*(high-low+1)
   elif op==171:
    p=at+1+((-at-1)%4);pairs=int.from_bytes(code[p+4:p+8],'big');size=p-at+8+8*pairs
   elif op==196:size=6 if code[at+1]==132 else 4
   else:size=length.get(op,1)
   at+=size
  assert at==len(code)
  result.append({'method':name,'descriptor':desc,'codeSHA256':sha(code),'calls':calls})
 return result

checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)

forge=LIB/'forge-1.20.1-47.4.28-universal.jar'
names=['entity/living/LivingAttackEvent','entity/living/LivingHurtEvent','entity/living/LivingDeathEvent','entity/living/LivingDropsEvent','entity/item/ItemTossEvent','entity/player/PlayerInteractEvent$EntityInteract','entity/player/PlayerInteractEvent$EntityInteractSpecific','entity/EntityMountEvent','entity/player/PlayerContainerEvent','entity/player/PlayerContainerEvent$Open','entity/EntityJoinLevelEvent','entity/EntityTravelToDimensionEvent','entity/player/PlayerEvent$PlayerChangedDimensionEvent']
with zipfile.ZipFile(forge)as z:classes=[reader.inspect(z.read('net/minecraftforge/event/'+n+'.class')) for n in names]
check('all thirteen staged event targets exist in exact installed Forge binary',len(classes)==13)
by={c['name']:c for c in classes}
def methods(n):return {m['name']:m['descriptor'] for m in by['net/minecraftforge/event/'+n]['methods']}
check('native mount event exposes exact rider/mount/mounting getters',all(n in methods('entity/EntityMountEvent')for n in ['getEntityBeingMounted','getEntityMounting','isMounting']))
check('native menu Open inherits public getContainer from PlayerContainerEvent','getContainer'in methods('entity/player/PlayerContainerEvent'))
check('native damage/death/toss/travel events support cancellation',all(by['net/minecraftforge/event/'+n]['cancelAnnotationConstantPresent']for n in ['entity/living/LivingAttackEvent','entity/living/LivingHurtEvent','entity/living/LivingDeathEvent','entity/item/ItemTossEvent','entity/EntityTravelToDimensionEvent']))
kube=MODS/'kubejs-forge-2001.6.5-build.26.jar'
with zipfile.ZipFile(kube)as z:raw=z.read('dev/latvian/mods/kubejs/forge/ForgeEventWrapper.class')
kube_calls=class_code(raw);on=[m for m in kube_calls if m['method']=='onEvent'];check('exact installed ForgeEvents.onEvent method inspected',len(on)==1)
targets=[c['target'] for c in on[0]['calls']]
check('KubeJS event registration explicitly uses NORMAL priority',any(t and 'EventPriority.NORMAL' in t for t in targets))
check('the same method registers its Forge listener on the event bus',any(t and 'IEventBus.addListener' in t for t in targets))
corpse_audit=json.loads((ROOT/'개별작업/mainland_v110/corpse_death_event_order_v110.json').read_text('utf8'))
corpse=Path(corpse_audit['jar']);check('independently audited Corpse binary still exact',sha(corpse.read_bytes())==corpse_audit['jarSHA256'])
with zipfile.ZipFile(corpse)as z:
 for c in corpse_audit['classes']:check('Corpse '+c['class']+' class bytes match prior audit',sha(z.read(c['class']))==c['sha256'])
death=next(m for m in corpse_audit['classes'][0]['methods'] if m['descriptor']=='(Lnet/minecraftforge/event/entity/living/LivingDeathEvent;)V')
check('Corpse first actual player inventory snapshot occurs in LOWEST LivingDeath listener',death['annotations'][0]['values']['priority']['enumValue']=='LOWEST' and any(c['offset']==27 and 'Death.fromPlayer' in c['target']for c in death['calls']))
startup=(STAGING/'kubejs/startup_scripts/16_personal_mount_events_v11_0.js').read_text('utf8')
check('staged NORMAL death callback detaches before the installed LOWEST snapshot',"ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingDeathEvent',function(e){call('onPersonalMountDeathV110',e);});"in startup)
report={'actualMinecraft':False,'nativeBindingPending':True,'javaProcessesStarted':0,'scope':'Exact installed static class signatures and instruction operands; no Forge event lifecycle executed','checks':checks,'passed':all(c['passed']for c in checks),'forgeJarSHA256':sha(forge.read_bytes()),'kubejsJarSHA256':sha(kube.read_bytes()),'forgeClasses':classes,'kubejsEventRegistration':on,'corpseJarSHA256':corpse_audit['jarSHA256'],'stagedStartupSHA256':sha(startup.encode())}
out=STAGING/'reports/mount_event_api_v110.json' if IS_STAGED else ROOT/'검증/v11_0_mount_event_api.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({'passed':report['passed'],'checks':len(checks),'javaProcessesStarted':0,'report':str(out)},ensure_ascii=False))
