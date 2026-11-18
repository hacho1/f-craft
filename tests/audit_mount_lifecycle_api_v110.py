"""Read native98 lifecycle ABIs and KubeJS remaps without starting Java."""
from pathlib import Path
import ast,gzip,hashlib,importlib.util,io,json,re,zipfile
ROOT=Path(__file__).resolve().parents[1];MODS=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __/mods')
SERVER=Path('E:/F-Craft/마크/F-Craft_7차_1장3보스_수호자무구/테스트프로필/server/libraries/net/minecraft/server/1.20.1-20230612.114412/server-1.20.1-20230612.114412-srg.jar')
KUBE=MODS/'kubejs-forge-2001.6.5-build.26.jar';RHINO=MODS/'rhino-forge-2001.2.3-build.10.jar';CORPSE=MODS/'corpse-forge-1.20.1-1.0.23.jar'
spec=importlib.util.spec_from_file_location('readonly_reader',ROOT/'개별작업/mainland_v110/inspect_dependency_api.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
tree=ast.parse((ROOT/'tests/audit_mount_stack_bindings_v110.py').read_text('utf8'));fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='annotated_methods');scope={'io':io};exec(compile(ast.Module(body=[fn],type_ignores=[]),'annotation_parser_only','exec'),scope)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
with zipfile.ZipFile(RHINO)as z:mappings=gzip.decompress(z.read('mm.jsmappings'))
remaps={};mixin_classes=[]
with zipfile.ZipFile(KUBE)as z:
 for c in ['EntityMixin','LivingEntityMixin','MinecraftServerMixin','PlayerMixin','ServerPlayerMixin']:
  name='dev/latvian/mods/kubejs/core/mixin/common/'+c+'.class'
  if name not in z.namelist():continue
  raw=z.read(name);mixin_classes.append({'name':name,'sha256':hashlib.sha256(raw).hexdigest()})
  for m in scope['annotated_methods'](raw):
   for a in m['annotations']:
    if a['type'].endswith('/RemapForJS;'):remaps[m['name']]=a['values']['value']
    if a['type'].endswith('/HideFromJS;'):remaps[m['name']]='<hidden>'
 player_methods=reader.inspect(z.read('dev/latvian/mods/kubejs/core/PlayerKJS.class'))['methods']
checks=[];methods=[]
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
tests={
 'net/minecraft/world/entity/Entity':{'startRiding':'(Lnet/minecraft/world/entity/Entity;Z)Z','getVehicle':'()Lnet/minecraft/world/entity/Entity;','ejectPassengers':'()V','discard':'()V','isRemoved':'()Z','setShiftKeyDown':'(Z)V'},
 'net/minecraft/world/entity/animal/horse/AbstractHorse':{'openCustomInventoryScreen':'(Lnet/minecraft/world/entity/player/Player;)V'},
 'net/minecraft/world/damagesource/DamageSources':{'fellOutOfWorld':'()Lnet/minecraft/world/damagesource/DamageSource;','playerAttack':'(Lnet/minecraft/world/entity/player/Player;)Lnet/minecraft/world/damagesource/DamageSource;'},
 'net/minecraft/server/MinecraftServer':{'getAllLevels':'()Ljava/lang/Iterable;'},
 'net/minecraft/server/players/PlayerList':{'respawn':'(Lnet/minecraft/server/level/ServerPlayer;Z)Lnet/minecraft/server/level/ServerPlayer;'},
 'net/minecraft/world/entity/player/Inventory':{'getContainerSize':'()I','getItem':'(I)Lnet/minecraft/world/item/ItemStack;','setItem':'(ILnet/minecraft/world/item/ItemStack;)V','getFreeSlot':'()I','add':'(Lnet/minecraft/world/item/ItemStack;)Z'},
 'net/minecraft/world/inventory/AbstractContainerMenu':{'quickMoveStack':'(Lnet/minecraft/world/entity/player/Player;I)Lnet/minecraft/world/item/ItemStack;'},
 'net/minecraft/world/inventory/Slot':{'getItem':'()Lnet/minecraft/world/item/ItemStack;'},
 'net/minecraft/server/level/ServerPlayer':{'closeMenu':'()V'},
}
with zipfile.ZipFile(SERVER)as z:
 for c,wanted in tests.items():
  info=reader.inspect(z.read(c+'.class'))
  for name,descriptor in wanted.items():
   ids={x.group(1).decode()for x in re.finditer(rb'(m_[0-9]+_)'+bytes([len(name)])+name.encode(),mappings)}|{method for method,alias in remaps.items()if alias==name}
   found=[m for m in info['methods']if m['name']in ids and m['descriptor']==descriptor]
   check('exact native public lifecycle ABI '+name,len(found)==1)
   m=found[0];check('KubeJS retains script name '+name,m['name']not in remaps or remaps[m['name']]==name)
   methods.append({'class':c,'scriptName':name,'nativeMethod':m['name'],'descriptor':descriptor})
with zipfile.ZipFile(CORPSE)as z:
 for c,name,descriptor in [('de/maxhenkel/corpse/entities/CorpseEntity','getDeath','()Lde/maxhenkel/corpse/corelib/death/Death;'),('de/maxhenkel/corpse/corelib/death/Death','getPlayerUUID','()Ljava/util/UUID;'),('de/maxhenkel/corpse/corelib/death/Death','getAllItems','()Lnet/minecraft/core/NonNullList;'),('de/maxhenkel/corpse/gui/Guis','openCorpseGUI','(Lnet/minecraft/server/level/ServerPlayer;Lde/maxhenkel/corpse/entities/CorpseEntity;)V')]:
  info=reader.inspect(z.read(c+'.class'));check('exact installed Corpse public ABI '+name,any(m['name']==name and m['descriptor']==descriptor for m in info['methods']));methods.append({'class':c,'scriptName':name,'descriptor':descriptor})
with zipfile.ZipFile(SERVER)as z:
 nn=reader.inspect(z.read('net/minecraft/core/NonNullList.class'));check('Corpse getAllItems returns native list with public size/get, not a Java array',nn['parent']=='java/util/AbstractList'and all(any(m['name']in {x.group(1).decode()for x in re.finditer(rb'(m_[0-9]+_)'+bytes([len(n)])+n.encode(),mappings)}or m['name']==n for m in nn['methods'])for n in ['size','get']))
check('KubeJS public prefix XP helpers match fixture usage',all(any(m['name']==name for m in player_methods)for name in ['kjs$addXPLevels','kjs$getXp','kjs$getXpLevel']))
native_path=ROOT/'tests/native/98_personal_mount_v110.js';prod=ROOT/'수정파일/kubejs/server_scripts/54_personal_mount_v11_0.js';old=json.loads((ROOT/'검증/native/v110_integrated_server_03/result.json').read_text('utf8'));smoke=old['probe']['mountStackBindingSmokeV110']
check('observed real Native03 proved actual fullstack typed64-bit roundtrip',old['actualMinecraft']and smoke['ok']and smoke['longTag']=='9007199254740993L'and smoke['getTagType']=='undefined'and smoke['exact'])
permission=ROOT/'검증/v11_0_mount_native_permission_seed.json';p=json.loads(permission.read_text('utf8'));check('actual QA permission-step regression binds current98',p['passed']and p['native98SHA256']==sha(native_path))
report={'passed':True,'actualMinecraft':False,'javaProcessesStarted':0,'actualLifecyclePending':True,'scope':'Read-only installed ABIs/remap annotations plus separately cited actual03 ItemStack smoke. No native mount/Corpse lifecycle pass is inferred.','checks':checks,'methods':methods,'kubejsMixins':mixin_classes,'jars':{str(p):sha(p)for p in [SERVER,KUBE,RHINO,CORPSE]},'native98SHA256':sha(native_path),'source54SHA256':sha(prod),'native03Evidence':{'path':'검증/native/v110_integrated_server_03/result.json','sha256':sha(ROOT/'검증/native/v110_integrated_server_03/result.json'),'smoke':smoke},'permissionRegression':{'path':str(permission.relative_to(ROOT)),'sha256':sha(permission)}}
out=ROOT/'검증/v11_0_mount_lifecycle_api_audit.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8');print(json.dumps({'passed':True,'checks':len(checks),'native98SHA256':sha(native_path),'report':str(out)},ensure_ascii=False))
