'use strict';
// Exercise the final-delivery guards without creating any update ZIP.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),script=path.join(root,'tools/package_verified_update_v105.py');
const probe=String.raw`
import importlib.util, json, pathlib, sys, tempfile
sys.dont_write_bytecode=True
file=pathlib.Path(sys.argv[1]);spec=importlib.util.spec_from_file_location('v105_package_under_test',file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
checks=[]
def ck(name,fn):
 fn();checks.append({'name':name,'passed':True})
def rejects(fn):
 try:fn()
 except RuntimeError:return
 raise AssertionError('guard unexpectedly accepted input')
current={'mods/fcraft-raid-bridge-1.0.0-forge-1.20.1.jar':'a'*64}
def valid():return {'passed':True,'fullyVerified':True,'scope':'complete-native-server-and-client','actualMinecraft':True,'physicalInputUsed':False,'candidateHashes':dict(current),'categories':[{'id':i,'passed':True,'status':'passed'}for i in range(1,7)],'checks':[{'passed':True}],'errors':[]}
ck('six-category exact fully verified evidence is accepted by pure guard',lambda:m.validate_verification(valid(),current))
def reject_unit():
 r=valid();r.update(scope='unit-and-file-checks',fullyVerified=False);rejects(lambda:m.validate_verification(r,current))
ck('unit-only results cannot authorize a package',reject_unit)
def reject_stale():
 r=valid();r['candidateHashes'][next(iter(current))]='b'*64;rejects(lambda:m.validate_verification(r,current))
ck('current candidate hash drift refuses packaging',reject_stale)
def reject_category():
 r=valid();r['categories'][2]['passed']=False;rejects(lambda:m.validate_verification(r,current))
ck('one failed or missing category refuses packaging',reject_category)
def reject_physical():
 r=valid();r['physicalInputUsed']=True;rejects(lambda:m.validate_verification(r,current))
ck('physical-input evidence refuses this delivery path',reject_physical)
def reject_checks():
 for k,v in [('checks',[]),('checks',[{'passed':False}]),('errors',['unresolved'])]:
  r=valid();r[k]=v;rejects(lambda:m.validate_verification(r,current))
ck('missing failed or unresolved detailed checks refuse packaging',reject_checks)
def paths():
 for p in ['../saves/level.dat','C:/user/secret','kubejs/../secret','saves/playerdata.dat','mods/F-Craft-QA-Channel-1.0.jar','kubejs/server_scripts/95_ui_fixture.js','config/passwords.toml','config/private_key.pem','config/.env']:
  rejects(lambda p=p:m.safe_product_path(p))
 for p in ['kubejs/server_scripts/46_chapter1_three_boss_raid_engine_v10_1.js','config/fcraft.json','mods/fcraft-raid-bridge-1.0.0-forge-1.20.1.jar','modpack_manifest_1.20.1_forge.json']:m.safe_product_path(p)
ck('world QA private and traversal paths rejected while product accepted',paths)
def changes():
 r=m.change_list({'a':'new','b':'same','c':'added'},{'a':'old','b':'same','omitted':'old'})
 assert [(x['path'],x['status'])for x in r]==[('a','modified'),('b','unchanged'),('c','added')]
ck('change manifest separates actual modifications additions and unchanged files',changes)
ck('C-drive root cannot be used for delivery',lambda:rejects(lambda:m.assert_t9_root(pathlib.Path('C:/F-Craft/마크')/m.EXPECTED_NAME)))
def immutable():
 base=m.ROOT/'검증/package_guard_unit';base.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='case_',dir=base)as d:
  target=pathlib.Path(d).resolve();assert target.is_relative_to(base.resolve()) and target.drive.upper()=='E:'
  p=target/'receipt.json';assert m.same_bytes_or_write(p,b'one') is True;assert m.same_bytes_or_write(p,b'one') is False
  rejects(lambda:m.same_bytes_or_write(p,b'two'));assert p.read_bytes()==b'one'
ck('existing differing output is preserved byte-for-byte',immutable)
print(json.dumps({'suite':'package_v105','passed':len(checks),'checks':checks,'actualMinecraft':False,'updateZipCreated':False}))
`;
const run=cp.spawnSync(process.env.PYTHON||'python',['-B','-c',probe,script],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONIOENCODING:'utf-8'},timeout:30000});
assert.equal(run.status,0,String(run.stderr||run.stdout));
const summary=JSON.parse(String(run.stdout).trim().split(/\r?\n/).at(-1));assert(summary.passed>=10);assert.equal(summary.updateZipCreated,false);
const out=path.join(root,'검증/package_guard_unit.json');fs.writeFileSync(out,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
