"""Combine exact final game executions; no source-only test can certify installation."""
from pathlib import Path
import argparse, hashlib, importlib.util, json, re

ROOT=Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location('_v110_install',ROOT/'tools/install_update_v110.py')
INSTALL=importlib.util.module_from_spec(sp);sp.loader.exec_module(INSTALL)
def require(v,msg):
 if not v:raise RuntimeError(msg)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def local(value):
 p=Path(value);p=(ROOT/p).resolve()if not p.is_absolute()else p.resolve()
 require(p.is_relative_to(ROOT.resolve())and p.is_file(),'Evidence must be an existing project file '+str(p));return p
def item(p):return {'path':str(p),'sha256':sha(p)}
def native(p,candidate,restart):
 r=read(p)
 for k in ['passed','actualMinecraft','serverReady','sourceWorldUnchangedDuringTest','sourceCandidatesUnchangedDuringTest','liveProfileUnchangedDuringTest','executedMirrorUnchangedAfterRun','helperMirrorUnchangedAfterRun']:
  require(r.get(k)is True,'Native report not verified: '+k+' '+str(p))
 require(r.get('codeHashes')==candidate,'Native executed different candidate '+str(p))
 require(r.get('exitCode')==0 and not r.get('timedOut') and not r.get('controllerError') and not r.get('scriptErrors') and not r.get('optionalGuidebookLoadErrors'),'Native errors '+str(p))
 require(bool(r.get('coldRestart'))==restart,'Wrong cold restart proof '+str(p))
 probe=r.get('probe',{});require(probe.get('passed')is True and not probe.get('errors'),'Native probe failed')
 expected={'mainland110_restart','mount110_restart','claims110_restart'}if restart else {'promotions','mainland110','mount110','claims110'}
 require(expected.issubset(set(probe.get('completedSuites',[]))),'Mandatory native suites were not all completed')
 require(all(x.get('passed')is True for x in probe.get('checks',[])),'Native check failure')
 console=p.parent/'console.log'
 if console.is_file():
  text=console.read_text(encoding='utf-8',errors='replace')
  require(not re.search(r'Attempted to load class .*invalid dist|authoritative_preimage_mismatch|Unreported exception|Exception in thread|NoSuchMethodError|Exception caught during firing event:.*(?:server_scripts|client_scripts|startup_scripts)',text),'Critical runtime diagnostic remains '+str(console))
 return r
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--server-full',required=True);ap.add_argument('--server-restart',required=True);ap.add_argument('--client',required=True);ap.add_argument('--unit-report',action='append',required=True);a=ap.parse_args()
 candidate=INSTALL.product();full=local(a.server_full);cold=local(a.server_restart);client=local(a.client)
 first=native(full,candidate,False);second=native(cold,candidate,True)
 c=read(client)
 for k in ['passed','actualMinecraft','actualClient','connectedClient','sourceAndLiveAndCandidatesUnchanged']:
  require(c.get(k)is True,'Final real client failed '+k)
 require(c.get('candidateHashes')==candidate,'Client executed different candidate')
 require(c.get('exitCode')==0 and not c.get('runnerError') and not c.get('timedOut') and not c.get('newScriptErrors'),'Client runtime error')
 require(c.get('physicalInputUsed')is False and c.get('windowShown')is False,'Client must preserve desktop focus and input')
 cp=c.get('probe',{});require(cp.get('done')is True and cp.get('passed')is True and not cp.get('errors'),'Client did not finish every scenario')
 require(int(cp.get('index',0))>=len(cp.get('tasks',[])),'Client scenarios incomplete')
 require(all(x.get('passed')is True for x in c.get('checks',[])),'Client check failed')
 units=[]
 for value in a.unit_report:
  p=local(value);r=read(p);require(r.get('passed')is True,'Supporting regression failed '+str(p));units.append(item(p))
 aggregate={'passed':True,'actualMinecraft':True,'humanPlay':False,'connectedClient':False,'physicalInputUsed':False,'kind':'Dedicated Forge full and cold restart using the exact same immutable product','codeHashes':candidate,'sourceReports':[item(full),item(cold)],'checks':sum(len(r['probe']['checks'])for r in [first,second])}
 server=ROOT/'검증/v11_0_server_aggregate.json';server.write_text(json.dumps(aggregate,ensure_ascii=False,indent=2),encoding='utf-8')
 shots=[item(p)for p in sorted(client.parent.glob('*.png'))];require(shots,'No actual client screenshots')
 proof={'passed':True,'actualMinecraft':True,'humanPlay':False,'physicalInputUsed':False,'candidateHashes':candidate,'server':{**item(server),'sourceReports':aggregate['sourceReports']},'client':item(client),'unitReports':units,'actualClientScreenshots':shots,'counts':{'candidateFiles':len(candidate),'serverChecks':aggregate['checks'],'clientChecks':len(c.get('checks',[])),'clientScenarios':len(cp.get('tasks',[])),'screenshots':len(shots)},'saveProtection':'Installation separately verifies all LIVE save files against the full preimage archive; QA runs only disposable worlds','limits':['No human manual playthrough','Per-player gameplay is verified with real ServerPlayer actors and one connected hidden Minecraft client; no claim of several human clients']}
 out=ROOT/'검증/v11_0_integrated_verification.json';out.write_text(json.dumps(proof,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'passed':True,**proof['counts']},ensure_ascii=False))
if __name__=='__main__':main()
