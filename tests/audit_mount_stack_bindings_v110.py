"""Inspect installed ItemStack remap annotations and native serialization ABI."""
from pathlib import Path
import gzip,hashlib,importlib.util,io,json,struct,zipfile
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('readonly_class_reader',ROOT/'개별작업/mainland_v110/inspect_dependency_api.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
MODS=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __/mods')
KUBE=MODS/'kubejs-forge-2001.6.5-build.26.jar';RHINO=MODS/'rhino-forge-2001.2.3-build.10.jar'
SERVER=Path('E:/F-Craft/마크/F-Craft_7차_1장3보스_수호자무구/테스트프로필/server/libraries/net/minecraft/server/1.20.1-20230612.114412/server-1.20.1-20230612.114412-srg.jar')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def annotated_methods(raw):
 s=io.BytesIO(raw)
 def u1():return s.read(1)[0]
 def u2():return int.from_bytes(s.read(2),'big')
 def u4():return int.from_bytes(s.read(4),'big')
 assert u4()==0xcafebabe;s.read(4);cp=[None]*u2();i=1
 while i<len(cp):
  t=u1()
  if t==1:cp[i]=s.read(u2()).decode('utf8','replace')
  elif t in (3,4):cp[i]=int.from_bytes(s.read(4),'big')
  elif t in (5,6):s.read(8);i+=1
  elif t in (7,8,16,19,20):cp[i]=(t,u2())
  elif t in (9,10,11,12,17,18):cp[i]=(t,u2(),u2())
  elif t==15:cp[i]=(t,u1(),u2())
  else:raise ValueError(t)
  i+=1
 def attrs():return[(cp[u2()],s.read(u4()))for _ in range(u2())]
 def annotations(raw):
  a=io.BytesIO(raw)
  def n():return int.from_bytes(a.read(2),'big')
  def value():
   t=a.read(1).decode()
   if t=='e':return{'enumType':cp[n()],'enumValue':cp[n()]}
   if t=='@':return ann()
   if t=='[':return[value()for _ in range(n())]
   return cp[n()]
  def ann():
   kind=cp[n()];pairs={}
   for _ in range(n()):key=cp[n()];pairs[key]=value()
   return{'type':kind,'values':pairs}
  return[ann()for _ in range(n())]
 s.read(6);s.read(2*u2())
 for _ in range(u2()):s.read(6);attrs()
 out=[]
 for _ in range(u2()):
  flags,name,desc=u2(),cp[u2()],cp[u2()];anns=[]
  for key,data in attrs():
   if key in ('RuntimeVisibleAnnotations','RuntimeInvisibleAnnotations'):anns+=annotations(data)
  out.append({'name':name,'descriptor':desc,'annotations':anns})
 return out
with zipfile.ZipFile(KUBE)as z:raw=z.read('dev/latvian/mods/kubejs/core/mixin/common/ItemStackMixin.class');mixin=annotated_methods(raw)
with zipfile.ZipFile(SERVER)as z:native=reader.inspect(z.read('net/minecraft/world/item/ItemStack.class'))
with zipfile.ZipFile(RHINO)as z:mappings=gzip.decompress(z.read('mm.jsmappings'))
checks=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
gettag=next(m for m in mixin if m['name']=='m_41783_')
check('installed getTag is explicitly renamed getNbt by KubeJS mixin',any(a['type'].endswith('/RemapForJS;')and a['values'].get('value')=='getNbt'for a in gettag['annotations']))
methods={m['name']:m for m in native['methods']}
for srg,name,desc,static in [('m_41784_','getOrCreateTag','()Lnet/minecraft/nbt/CompoundTag;',False),('m_41739_','save','(Lnet/minecraft/nbt/CompoundTag;)Lnet/minecraft/nbt/CompoundTag;',False),('m_41712_','of','(Lnet/minecraft/nbt/CompoundTag;)Lnet/minecraft/world/item/ItemStack;',True),('m_41777_','copy','()Lnet/minecraft/world/item/ItemStack;',False)]:
 m=methods[srg];check('exact vanilla '+name+' public ABI and static flag',m['descriptor']==desc and m['static']==static)
 check('installed Rhino maps '+srg+' to '+name,(srg.encode()+bytes([len(name)])+name.encode())in mappings)
 check('KubeJS mixin leaves '+name+' native name intact',not any(m['name']==srg for m in mixin))
product=ROOT/'수정파일/kubejs/server_scripts/54_personal_mount_v11_0.js';source=product.read_text('utf8');node=ROOT/'tests/personal_mount_v110.cjs';node_source=node.read_text('utf8')
check('product has no unsupported getTag call and menu inspection uses nonmutating nbt', '.getTag('not in source and 'stack&&!stack.empty&&stack.nbt'in source)
check('Node boundary no longer invents a getTag method','getTag(){'not in node_source and 'get nbt(){return this.tag;}'in node_source)
report={'passed':True,'actualMinecraft':False,'javaProcessesStarted':0,'nativeBindingSmokePending':True,'scope':'Exact installed KubeJS ItemStackMixin annotations, Rhino bundled mappings and native1.20.1 public SRG method descriptors; actual native roundtrip checked by next Forge smoke.','checks':checks,'kubejsJARSHA256':sha(KUBE),'rhinoJARSHA256':sha(RHINO),'serverSRGJARSHA256':sha(SERVER),'mixinSHA256':hashlib.sha256(raw).hexdigest(),'itemStackMixinMethods':mixin,'nativeItemStackClassSHA256':native['sha256'],'source54SHA256':sha(product),'nodeBoundarySHA256':sha(node)}
out=ROOT/'검증/v11_0_mount_stack_binding_audit.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print(json.dumps({'passed':True,'checks':len(checks),'getTagAnnotations':gettag['annotations'],'report':str(out)},ensure_ascii=False))
