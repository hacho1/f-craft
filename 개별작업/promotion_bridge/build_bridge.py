"""Reproducible Java17/SRG bridge for the exact audited Forge runtime."""
from pathlib import Path
import argparse, hashlib, json, os, subprocess, zipfile
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
SERVER=ROOT.parent/'F-Craft_7차_1장3보스_수호자무구/테스트프로필/server'
JDK=Path('C:/Users/wooheewon/AppData/Local/Programs/Eclipse Adoptium/jdk-17.0.20.101-hotspot/bin')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--common-only',action='store_true');parser.add_argument('--client-jar',type=Path);args=parser.parse_args()
 forge=SERVER/'libraries/net/minecraftforge/forge/1.20.1-47.4.28'
 lines=(forge/'win_args.txt').read_text().splitlines()
 legacy=next(x.split('=',1)[1] for x in lines if x.startswith('-DlegacyClassPath='))
 cp=[forge/'forge-1.20.1-47.4.28-server.jar',SERVER/'libraries/net/minecraft/server/1.20.1-20230612.114412/server-1.20.1-20230612.114412-srg.jar',forge/'forge-1.20.1-47.4.28-universal.jar',SERVER/'libraries/net/minecraftforge/javafmllanguage/1.20.1-47.4.28/javafmllanguage-1.20.1-47.4.28.jar',SERVER/'libraries/net/minecraftforge/fmlcore/1.20.1-47.4.28/fmlcore-1.20.1-47.4.28.jar']+[SERVER/x for x in legacy.split(';')]
 cp=list(dict.fromkeys(p.resolve() for p in cp));assert all(p.is_file() for p in cp)
 # Compilation inputs stay on the explicitly requested T9 drive.
 cp.extend((SERVER/'mods').glob('*.jar'))
 cp.extend((SERVER.parent.parent/'개별작업/ui_qa').glob('**/client-*-srg.jar'))
 cp.extend((ROOT.parent/'F-Craft_8차_보스추격_패링HUD_v10_5/개별작업/ui_qa/raid_ui_v105_06/libraries/net/minecraft/client').glob('**/*.jar'))
 if args.client_jar:
  client=args.client_jar.resolve();assert client.is_file() and client.drive.upper()=='E:';cp.append(client)
 sources=sorted((HERE/'src/main/java').rglob('*.java'))
 if args.common_only:sources=[p for p in sources if 'client'not in p.parts and 'mixin'not in p.parts]
 classes=HERE/('build/common_classes'if args.common_only else 'build/classes');classes.mkdir(parents=True,exist_ok=True)
 # Remove only prior compiler outputs under the verified exact build directory.
 assert classes.resolve().is_relative_to((HERE/'build').resolve())
 for p in classes.rglob('*.class'):p.unlink()
 subprocess.run([str(JDK/'javac.exe'),'--release','17','-encoding','UTF-8','-g:none','-proc:none','-classpath',os.pathsep.join(map(str,cp)),'-d',str(classes),*map(str,sources)],check=True)
 entries={'META-INF/MANIFEST.MF':b'Manifest-Version: 1.0\r\nMixinConfigs: fcraft_promotion_bridge.mixins.json\r\n\r\n','META-INF/LICENSE':b'MIT License - F-Craft 2026'}
 for base in [classes,HERE/'src/main/resources']:
  for p in sorted(base.rglob('*')):
   if p.is_file():entries[p.relative_to(base).as_posix()]=p.read_bytes()
 
 output=ROOT/('검증/promotion_bridge_common_only.jar'if args.common_only else '수정파일/mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar');output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED)as z:
  for rel,raw in sorted(entries.items()):
   info=zipfile.ZipInfo(rel,(2026,11,15,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,raw)
 with zipfile.ZipFile(output)as z:assert z.testzip()is None
 report={'passed':True,'actualMinecraft':False,'commonOnly':args.common_only,'jar':str(output),'sha256':sha(output),'bytes':output.stat().st_size,'sources':{p.relative_to(HERE).as_posix():sha(p)for p in sources},'classpath':{str(p):sha(p)for p in cp},'entries':{r:hashlib.sha256(raw).hexdigest()for r,raw in sorted(entries.items())},'release':17,'forge':'47.4.28','namespace':'SRG_remap_false'}
 target=ROOT/('검증/promotion_bridge_common_build.json'if args.common_only else '검증/promotion_bridge_build.json');target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({k:report[k]for k in ['passed','commonOnly','jar','sha256','bytes']},ensure_ascii=False))
if __name__=='__main__':main()
