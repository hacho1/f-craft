"""Compare exact plans in Node and the installed Rhino interpreter, without Minecraft."""
from pathlib import Path
import argparse, hashlib, json, subprocess, time

ROOT=Path(__file__).resolve().parents[1]
JDK=Path('C:/Users/wooheewon/AppData/Local/Programs/Eclipse Adoptium/jdk-17.0.20.101-hotspot/bin')
RHINO=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __/mods/rhino-forge-2001.2.3-build.10.jar')
OUTDOOR=ROOT/'수정파일/kubejs/server_scripts/48_serdin_three_boss_arenas_builder_v10_3.js'
SANCTUM=ROOT/'수정파일/kubejs/server_scripts/50_guardian_sanctum_builder_v10_4.js'
CONFIG=ROOT/'수정파일/kubejs/config/fcraft_arena_construction_v103.json'

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args): subprocess.run([str(x)for x in args],check=True,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--label',required=True);a=ap.parse_args()
    assert a.label.replace('_','').isalnum()
    evidence=ROOT/'검증/rhino'/a.label
    assert not evidence.exists(),'Preserve earlier interpreter evidence'
    evidence.mkdir(parents=True)
    before={str(p.relative_to(ROOT)):sha(p)for p in [OUTDOOR,SANCTUM,CONFIG]}
    lab=ROOT/'tools/rhino_lab';classes=lab/'classes';classes.mkdir(exist_ok=True)
    run([JDK/'javac.exe','-encoding','UTF-8','-cp',RHINO,'-d',classes,lab/'RhinoPlanProbe.java'])
    cp=[classes,RHINO]+[p for pattern in ['**/gson-*.jar','**/log4j-api-*.jar','**/guava-*.jar']for p in(ROOT/'테스트프로필/server/libraries').glob(pattern)]
    cfg=CONFIG.read_text(encoding='utf-8');(evidence/'config.json').write_text(cfg,encoding='utf-8')
    source=OUTDOOR.read_text(encoding='utf-8')+'\n'+SANCTUM.read_text(encoding='utf-8')
    source+='\nvar input=JSON.parse('+json.dumps(cfg,ensure_ascii=False)+');JSON.stringify({outdoor:FCraftArenaBuilderCoreV103.plan(input),sanctum:FCraftSanctumBuilderCoreV104.plan(),vectors:FCraftArenaBuilderCoreV103.hashVectors(),math:{pi:String(Math.PI),charCodeAt:String("a".charCodeAt(0)),codePointAt:"a".codePointAt(0)}});'
    (evidence/'plans.js').write_text(source,encoding='utf-8')
    start=time.monotonic()
    run([JDK/'java.exe','-cp',';'.join(str(x)for x in cp),'RhinoPlanProbe',evidence/'plans.js',evidence/'rhino_plans.json'])
    run(['node',ROOT/'tests/arena_builder_export.cjs','--config',evidence/'config.json','--output',evidence/'node_outdoor.json'])
    run(['node','-e',"const fs=require('fs');fs.writeFileSync(process.argv[2],JSON.stringify(require(process.argv[1]).plan()));",SANCTUM,evidence/'node_sanctum.json'])
    native=json.loads((evidence/'rhino_plans.json').read_text(encoding='utf-8'))
    results={};passed=True
    for name in ['outdoor','sanctum']:
        node=json.loads((evidence/('node_'+name+'.json')).read_text(encoding='utf-8'));other=native[name]
        checks={key:node[key]==other[key]for key in ['signature','ops','sites','features','bounds']}
        passed=passed and all(checks.values())
        results[name]={'signatureNode':node['signature'],'signatureRhino':other['signature'],'cells':len(node['ops']),'checks':checks}
    after={str(p.relative_to(ROOT)):sha(p)for p in [OUTDOOR,SANCTUM,CONFIG]}
    passed=passed and before==after
    report={'passed':passed,'actualMinecraft':False,'installedRhinoInterpreter':True,'rhinoJARSHA256':sha(RHINO),
        'sourceFiles':before,'sourceUnchanged':before==after,'plans':results,'vectors':native['vectors'],
        'nativeInterpreterMath':native['math'],'wallSeconds':round(time.monotonic()-start,2),
        'note':'Interpreter equivalence is supplemental evidence. Actual Minecraft construction, collisions and gameplay remain mandatory.'}
    (evidence/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
    if not passed:raise SystemExit(1)

if __name__=='__main__':main()
