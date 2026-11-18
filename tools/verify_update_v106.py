"""Bind successful real Forge executions to the exact product before install.

Earlier failed runs remain on disk. The final complete run must execute every
required suite against the fixed, byte-identical product without exceptions.
"""
from pathlib import Path
import hashlib, importlib.util, json, re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('_install_v106', ROOT/'tools/install_update_v106.py')
INSTALL = importlib.util.module_from_spec(spec)
spec.loader.exec_module(INSTALL)

def require(value, message):
    if not value: raise RuntimeError(message)

def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path, value):
    require(not path.exists(), 'Preserve existing verification '+str(path))
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

def server_source(label, suites, candidate):
    path = ROOT/'검증/native'/label/'result.json'
    report = read(path)
    require(report.get('actualMinecraft') is True and report.get('exitCode') == 0, 'Server did not run and stop cleanly '+label)
    require(report.get('serverReady') is True and not report.get('timedOut') and not report.get('controllerError'), 'Server controller failed '+label)
    for key in ['runtimeMirrorInitiallyExact','sourceWorldUnchangedDuringTest','sourceCandidatesUnchangedDuringTest','liveProfileUnchangedDuringTest','executedMirrorUnchangedAfterRun','helperMirrorUnchangedAfterRun','variantOmittedRuntimeAbsentAfterRun','variantWorldResourcesAbsentInitially','variantWorldResourcesAbsentAfterRun']:
        require(report.get(key) is True,'Server isolation check failed '+key+' '+label)
    require(not report.get('scriptErrors') and not report.get('optionalGuidebookLoadErrors') and not report.get('probeIsPartial'), 'Server errors / incomplete evidence '+label)
    original=report.get('codeHashes',{})
    require(original.keys()==candidate.keys(),'Added or missing execution input '+label)
    changed=[key for key in candidate if candidate[key]!=original[key]]
    require(not changed or changed==['kubejs/client_scripts/08_boss_cinematic_hud_bridge.js'],'Server/startup/mod/config input changed '+label)
    log_path=path.parent/'console.log';log=log_path.read_text('utf-8',errors='replace')
    loaded=[line.split('Loaded script ',1)[1].split()[0] for line in log.splitlines() if 'Loaded script ' in line]
    require(report.get('kind','').startswith('Dedicated Forge;') and bool(re.search(r'launchTarget.{0,40}forgeserver',log)),'Dedicated launch provenance missing '+label)
    require(any(item.startswith('server_scripts:') for item in loaded) and any(item.startswith('startup_scripts:') for item in loaded) and not any(item.startswith('client_scripts:') for item in loaded),'Unexpected script execution scope '+label)
    deltas=[]
    for key in changed:
        copied=Path(report['immutableCandidateSource'])/key
        require(sha(copied)==original[key] and report['executedMirrorHashes'].get(key)==original[key],'Old copied renderer evidence changed')
        deltas.append({'path':key,'copiedInDedicatedRuntimeSHA256':original[key],'currentClientSHA256':candidate[key],'dedicatedLoadedThisScript':False,'scope':'Client renderer only; complete current candidate must pass the actual client run'})
    require(report.get('variant') is None and not report.get('variantOmittedCandidatePaths') and not report.get('variantWorldTransforms'),'Omitted or transformed runtime '+label)
    probe=report['probe']; checks=probe['checks']
    require(not probe.get('errors'), 'Native fixture errors '+label)
    require(set(suites).issubset(set(probe['completedSuites'])), 'Missing suite '+label)
    selected=[c for c in checks if c['suite'] in suites or c['suite']=='startup']
    require(all(any(c['suite']==s for c in selected) for s in suites), 'Empty suite '+label)
    require(bool(selected) and all(c['passed'] is True for c in selected), 'Selected assertion failed '+label)
    failures=[c for c in checks if c.get('passed') is not True]
    require(report.get('passed') is True and not failures, 'Server did not pass '+label)
    return selected, {'path':str(path),'sha256':sha(path),'selectedSuites':suites,'originalPassed':report['passed'],'originalAssertionCount':len(checks),'originalFailures':failures,'log':{'path':str(log_path),'sha256':sha(log_path),'dedicatedLaunchVerified':True,'serverScriptsLoaded':sum(item.startswith('server_scripts:') for item in loaded),'startupScriptsLoaded':sum(item.startswith('startup_scripts:') for item in loaded),'clientScriptsLoaded':0},'clientOnlyCopiedSourceDelta':deltas,'allServerStartupModConfigAndOtherInputHashesMatch':True}

def main():
    candidate=INSTALL.product(); checks=[]; sources=[]
    for label,suites in [('integrated_v106_06',['promotions','active','portal','gear'])]:
        selected,source=server_source(label,suites,candidate);checks.extend(selected);sources.append(source)
    server={'passed':True,'actualMinecraft':True,'humanPlay':False,'connectedClient':False,'physicalInputUsed':False,'kind':'Complete dedicated Forge execution of unchanged server inputs; any explicitly recorded unloaded client renderer delta is certified by the full current client execution','codeHashes':candidate,'sourceReports':sources,'probe':{'passed':True,'completedSuites':['promotions','active','portal','gear'],'checks':checks,'errors':[]}}
    client_path=ROOT/'검증/native_client/client_v106_12/result.json';client=read(client_path)
    for key in ['passed','actualMinecraft','actualClient','connectedClient','sourceAndLiveAndCandidatesUnchanged','factoryAuditPassed']:
        require(client.get(key) is True,'Client verification failed '+key)
    require(client.get('candidateHashes')==candidate and client.get('exitCode')==0 and not client.get('scriptErrors') and not client.get('projectResourceErrors'),'Client product / runtime errors')
    require(client.get('humanPlay') is False and client.get('physicalInputUsed') is False and client.get('windowShown') is False,'Unexpected physical test mode')
    require(client.get('checks') and all(c.get('passed') is True for c in client['checks']),'Client assertions did not all pass')
    require(client.get('screenshots') and all(s.get('passed') is True for s in client['screenshots']),'Screenshot collection failed')
    server['clientRendererExecution']={'path':str(client_path),'sha256':sha(client_path),'fullCurrentCandidateHashesMatch':True}
    unit_reports=[]
    for name in ['promotion_bridge_build.json','raid_bridge_build.json','client_raid_hud_tests.json','v10_6_quest_filter_compass_exam_behavioral.json','v10_6_compass_rhino_regression.json','v10_6_arrival_visibility_regression.json','client_boss_entrance_v106.json','client_v105_hud_tests.json','boss_entrances_v106.json','v10_6_native_fixture_callback_regression.json','v10_6_promotion_bridge_visibility_regression.json','v10_6_puffish_texture_thread_regression.json','v10_6_verification_scope_regression.json','v10_6_installer_transaction_regression.json','rhino/promotion_profile_guard_v106_06/result.json','native_resource_checks_build_v106.json']:
        path=ROOT/'검증'/name;unit=read(path)
        require(unit.get('passed') is True and unit.get('actualMinecraft') is False,'Build/unit verification failed '+name)
        if name=='v10_6_installer_transaction_regression.json':
            require(unit.get('toolSHA256')==sha(ROOT/'tools/install_update_v106.py') and unit.get('toolUnchanged') is True,'Installer changed after transaction tests')
        unit_reports.append({'path':str(path),'sha256':sha(path),'actualMinecraft':False,'assertions':len(unit.get('checks',[]))})
    server_path=ROOT/'검증/native/v10_6_server_verified.json';write(server_path,server)
    proof={'passed':True,'actualMinecraft':True,'humanPlay':False,'physicalInputUsed':False,'candidateHashes':candidate,'server':{'path':str(server_path),'sha256':sha(server_path),'assertions':len(checks),'sourceReports':sources},'client':{'path':str(client_path),'sha256':sha(client_path),'assertions':len(client['checks']),'screenshots':len(client['screenshots'])},'unitReports':unit_reports,'limits':['Automated real Forge ServerPlayer and hidden Minecraft client verification; human playthrough not performed.','Guardian landing impact follows actual terrain collision, rather than forcing a teleport at tick45.'],'namespace':'f_rank_days','saveMigrationPerformed':False}
    write(ROOT/'검증/v10_6_integrated_verification.json',proof)
    print(json.dumps({'passed':True,'candidateFiles':len(candidate),'serverAssertions':len(checks),'clientAssertions':len(client['checks']),'screenshots':len(client['screenshots'])}))

if __name__=='__main__':main()
