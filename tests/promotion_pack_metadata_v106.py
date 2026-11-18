"""Metadata-only E artifact repair using the existing builder's packaging block.

No javac/game process, LIVE write, class rewrite or Mixin change is performed.
"""
from pathlib import Path
from types import SimpleNamespace
import argparse,ast,hashlib,json,shutil,zipfile

ROOT=Path(__file__).resolve().parents[1]
HERE=ROOT/'개별작업/promotion_bridge'
JAR=ROOT/'수정파일/mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'
LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __/mods')/JAR.name
REPORT=ROOT/'검증/promotion_bridge_build.json'
OUT=ROOT/'검증/promotion_pack_metadata_v106'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def content(p):
 with zipfile.ZipFile(p)as z:
  assert z.testzip()is None
  return {n:z.read(n)for n in z.namelist()}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--repair',action='store_true');args=parser.parse_args()
 builder=HERE/'build_bridge.py';metadata=HERE/'src/main/resources/pack.mcmeta';pack=json.loads(metadata.read_text('utf-8'))
 assert pack['pack']['pack_format']==15 and isinstance(pack['pack']['description'],str) and pack['pack']['description']
 live_before=sha(LIVE)
 if args.repair:
  assert not OUT.exists(),'Preserve existing packaging evidence'
  OUT.mkdir(parents=True);shutil.copy2(JAR,OUT/'before.jar');shutil.copy2(REPORT,OUT/'before_build.json')
  old=content(JAR);classes=HERE/'build/classes'
  compiled={p.relative_to(classes).as_posix():p.read_bytes()for p in classes.rglob('*.class')}
  assert compiled=={p:b for p,b in old.items()if p.endswith('.class')},'Compiled classes must equal the already verified JAR'
  for p in (HERE/'src/main/resources').rglob('*'):
   if p.is_file()and p.name!='pack.mcmeta':assert old[p.relative_to(HERE/'src/main/resources').as_posix()]==p.read_bytes()
  # Execute the actual existing builder's entries/resource/ZIP packaging block,
  # avoiding compilation while the user's Minecraft is running.
  tree=ast.parse(builder.read_text('utf-8'));body=next(n.body for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='main')
  def assigns(node,name):return isinstance(node,ast.Assign)and any(isinstance(t,ast.Name)and t.id==name for t in node.targets)
  start=next(i for i,n in enumerate(body)if assigns(n,'entries'));end=next(i for i,n in enumerate(body)if assigns(n,'report'))
  env={'HERE':HERE,'ROOT':ROOT,'classes':classes,'args':SimpleNamespace(common_only=False),'zipfile':zipfile}
  exec(compile(ast.fix_missing_locations(ast.Module(body=body[start:end],type_ignores=[])),str(builder),'exec'),env)
  new=content(JAR);assert all(new[p]==b for p,b in old.items())and set(new)-set(old)=={'pack.mcmeta'}
  report=json.loads(REPORT.read_text('utf-8'));report.update(sha256=sha(JAR),bytes=JAR.stat().st_size,entries={p:hashlib.sha256(b).hexdigest()for p,b in sorted(new.items())},metadataOnly=True,metadataPackagingBuilderSHA256=sha(builder),resources={p.relative_to(HERE).as_posix():sha(p)for p in(HERE/'src/main/resources').rglob('*')if p.is_file()})
  REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 old=content(OUT/'before.jar');new=content(JAR);build=json.loads(REPORT.read_text('utf-8'));rows=[]
 def check(name,value):rows.append({'name':name,'passed':bool(value)});assert value,name
 check('valid Minecraft1.20.1 pack metadata format15',json.loads(new['pack.mcmeta'])==pack)
 check('exactly one new root pack.mcmeta entry',set(new)-set(old)=={'pack.mcmeta'}and not(set(old)-set(new)))
 check('all previous JAR contents byte-identical',all(new.get(p)==b for p,b in old.items()))
 check('all prior classes and Mixin config byte-identical',all(new[p]==b for p,b in old.items()if p.endswith('.class')or p=='fcraft_promotion_bridge.mixins.json'))
 check('actual builder resource packaging copied exact metadata',new['pack.mcmeta']==metadata.read_bytes())
 check('updated build report binds every exact artifact entry',build['sha256']==sha(JAR)and build['entries']=={p:hashlib.sha256(b).hexdigest()for p,b in sorted(new.items())})
 check('running LIVE artifact remains unchanged',sha(LIVE)==live_before)
 result={'passed':True,'actualMinecraft':False,'metadataOnly':True,'actualBuilderPackagingBlock':True,'javaCompilationPerformed':False,'liveWritten':False,'checks':rows,'beforeSHA256':sha(OUT/'before.jar'),'jarSHA256':sha(JAR),'bytes':JAR.stat().st_size,'liveSHA256':live_before,'metadataSHA256':sha(metadata),'testSHA256':sha(Path(__file__))}
 (ROOT/'검증/v10_6_promotion_pack_metadata_regression.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
