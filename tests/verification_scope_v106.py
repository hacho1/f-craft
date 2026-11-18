"""Exercise the client-only delta boundary against the real server receipt."""
from pathlib import Path
import importlib.util, json

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('scope_v106',ROOT/'tools/verify_update_v106.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
current=module.INSTALL.product();checks=[]
suites=['promotions','active','portal','gear']
selected,proof=module.server_source('integrated_v106_06',suites,current)
assert len(selected)==529 and len(proof['clientOnlyCopiedSourceDelta'])==1
checks.append({'name':'accept exact529 server checks with one unloaded client renderer change','passed':True})
cases={
 'server modification':dict(current,**{'kubejs/server_scripts/38_unified_practical_promotions_phase4.js':'0'*64}),
 'other client modification':dict(current,**{'kubejs/client_scripts/01_npc_rpg_dialog_ui.js':'0'*64}),
 'new path':dict(current,**{'kubejs/server_scripts/unreviewed.js':'0'*64}),
 'missing path':{key:value for key,value in current.items() if key!='modpack_manifest_1.20.1_forge.json'},
}
for name,candidate in cases.items():
    try:module.server_source('integrated_v106_06',suites,candidate)
    except RuntimeError:checks.append({'name':'reject '+name,'passed':True})
    else:raise AssertionError('Scope widened: '+name)
report={'passed':True,'actualMinecraft':False,'kind':'Verification boundary regression; reads existing real receipt without launching a game','checks':checks}
(ROOT/'검증/v10_6_verification_scope_regression.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'checks':len(checks),'actualMinecraft':False}))
