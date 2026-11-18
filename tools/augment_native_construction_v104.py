"""Join native construction and controlled attribution, retaining raw failures.

The outer verdict concerns unexplained construction changes. Legacy literal
preservation fields and the original probe retain their actual false/null values.
Construction-only dependency reuse remains a separate, explicit gate decision.
"""
from pathlib import Path
import argparse, copy, hashlib, json

def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

SCOPE='zero_unplanned_construction_changes_after_matched_control'

def bound_input(attribution, path):
    expected=attribution.get('inputs',{})
    return any(Path(name).resolve()==path.resolve() and value==sha(path) for name,value in expected.items())

def joined(native_path, anvil_path, approval_path, attribution_path):
    native,anvil,approval,attribution=[read(p) for p in (native_path,anvil_path,approval_path,attribution_path)]
    proof=copy.deepcopy(native.get('probe',{}).get('construction',{}))
    preimages=anvil.get('sourcePreimages',{})
    checks=[]
    def check(name,ok,detail=None):checks.append({'name':name,'passed':bool(ok),'detail':detail})
    cells=approval.get('cells')
    counts=[cells,anvil.get('plannedCells'),preimages.get('expectedCells'),preimages.get('actualCells'),proof.get('verifiedCells')]
    check('all original preimages targets and native readback cover the same nonempty plan',type(cells) is int and cells>0 and all(v==cells for v in counts),counts)
    check('actual native construction and probe passed',native.get('passed') is True and native.get('actualMinecraft') is True and native.get('probe',{}).get('passed') is True and proof.get('actualMinecraft') is True and proof.get('nativePassed') is True)
    check('native source preflight completed before writes',proof.get('sourcePreimagesVerified') is True and number(proof.get('preimagePages'))>0 and number(proof.get('written'))+number(proof.get('skipped'))==cells)
    original=bool(approval.get('passed') is True and approval.get('originalSourceMatches') is True and approval.get('blockEntitiesTouched')==0 and preimages.get('passed') is True and preimages.get('preflightComplete') is True and preimages.get('sourceMismatchCount')==0 and preimages.get('status')=='DONE')
    check('authorized original source and every saved native preimage match',original)
    check('all final target cells match independent saved Anvil readback',anvil.get('unexpectedTargetCount')==0 and not anvil.get('unexpectedTargets'))
    signatures=[proof.get('signature'),approval.get('planSignature'),anvil.get('signature'),preimages.get('signature')]
    check('native approval plan and saved preflight signatures agree',bool(signatures[0]) and len(set(signatures))==1,signatures)
    plan_path=Path(anvil.get('planFile',''))
    check('authoritative plan file still matches saved proof',plan_path.is_file() and sha(plan_path)==anvil.get('planSHA256'))
    check('attribution binds these exact raw native and Anvil files',bound_input(attribution,native_path) and bound_input(attribution,anvil_path))
    attribution_inputs=attribution.get('inputs',{})
    check('all recorded control and classification inputs remain unchanged',bool(attribution_inputs) and all(Path(p).is_file() and sha(Path(p))==value for p,value in attribution_inputs.items()))
    check('actual matched no-builder attribution passed all checks',attribution.get('passed') is True and attribution.get('actualMinecraft') is True and bool(attribution.get('checks')) and all(x.get('passed') is True for x in attribution.get('checks',[])))
    block_zero=bool(attribution.get('unplannedBlockChangeCount')==0 and not attribution.get('outsideResidual') and attribution.get('outsideControlExactMatches')==anvil.get('outsideChangeCount'))
    be_zero=bool(attribution.get('unexplainedBlockEntityChangeCount')==0 and len(attribution.get('blockEntities',[]))==anvil.get('originalBlockEntityChangeCount') and all(x.get('attribution',{}).get('explained') is True for x in attribution.get('blockEntities',[])))
    critical=bool(attribution.get('originalNonemptyCriticalContentPreserved') is True and all(x.get('originalCriticalContent',{}).get('passed') is True for x in attribution.get('blockEntities',[])))
    check('no outside construction block or BE change remains unexplained',block_zero and be_zero)
    check('original nonempty inventory loot seed and owner content remains strict',critical)
    check('hive departures have actual living saved bee evidence',attribution.get('beeReleaseEvidence',{}).get('passed') is True)
    check('original literal comparison verdict was not relabeled',attribution.get('rawAnvilPassed') is anvil.get('passed') and attribution.get('rawFailedVerdictOverwritten') is False)
    passed=all(c['passed'] for c in checks)
    proof.update(originalSourceMatches=original,
        zeroOutsideWrites=anvil.get('zeroOutsideWrites') is True,
        blockEntitiesPreserved=anvil.get('blockEntitiesPreserved') is True,
        passed=passed,preservationScope=SCOPE,
        zeroUnplannedConstructionChanges=block_zero and be_zero,
        criticalOriginalBlockEntityContentPreserved=critical)
    proof['strictOriginalPreservation']={
        'passed':anvil.get('passed') is True,'finalCertification':anvil.get('finalCertification') is True,
        'zeroOutsideWrites':anvil.get('zeroOutsideWrites') is True,
        'blockEntitiesPreserved':anvil.get('blockEntitiesPreserved') is True,
        'file':str(anvil_path.resolve()),'sha256':sha(anvil_path),'scope':anvil.get('scope')}
    control_file=next((Path(p) for p in attribution_inputs if p.replace('\\','/').endswith('/earthworks_control02/result.json')),None)
    proof['controlledAttribution']={
        'file':str(attribution_path.resolve()),'sha256':sha(attribution_path),
        'scope':attribution.get('scope'),'passed':attribution.get('passed') is True,
        'unplannedBlockChangeCount':attribution.get('unplannedBlockChangeCount'),
        'unexplainedBlockEntityChangeCount':attribution.get('unexplainedBlockEntityChangeCount'),
        'originalNonemptyCriticalContentPreserved':attribution.get('originalNonemptyCriticalContentPreserved') is True,
        'controlResultFile':str(control_file.resolve()) if control_file else None,
        'controlResultSHA256':sha(control_file) if control_file else None}
    proof['dependencies']={
        'codeHashes':copy.deepcopy(native.get('codeHashes',{})),
        'modHashes':copy.deepcopy(native.get('modHashes',{})),
        'worldSourceInventorySHA256':native.get('worldSourceInventorySHA256'),
        'savedWorldInventorySHA256':native.get('savedWorldInventorySHA256'),
        'immutableCandidateSource':native.get('immutableCandidateSource'),
        'nativeResultFile':str(native_path.resolve()),'nativeResultSHA256':sha(native_path),
        'planFile':str(plan_path.resolve()),'planSHA256':anvil.get('planSHA256'),
        'approvalFile':str(approval_path.resolve()),'approvalSHA256':sha(approval_path),
        'note':'Complete recorded dependency maps; the final gate must explicitly audit any reused construction-only subset. This is not a claim of final full-candidate equality.'}
    proof['independentSavedWorldProof']={
        'file':str(anvil_path.resolve()),'sha256':sha(anvil_path),
        'scope':anvil.get('scope'),
        'originalFullChunksCompared':anvil.get('originalFullChunksCompared'),
        'originalProtoChunksExcluded':anvil.get('originalProtoChunksExcluded'),
        'changedOriginalBlocks':anvil.get('changedOriginalBlocks')}
    result=copy.deepcopy(native)
    result.update(passed=passed,construction=proof,
        evidenceJoin={'schemaVersion':2,'preservationScope':SCOPE,'checks':checks,
        'rawNativeFile':str(native_path.resolve()),'rawNativeSHA256':sha(native_path),
        'rawAnvilFile':str(anvil_path.resolve()),'rawAnvilSHA256':sha(anvil_path),
        'sourceApprovalFile':str(approval_path.resolve()),'sourceApprovalSHA256':sha(approval_path),
        'controlledAttributionFile':str(attribution_path.resolve()),'controlledAttributionSHA256':sha(attribution_path),
        'note':'Raw native probe is unchanged. Strict Anvil flags retain their actual verdict. Only the outer construction field judges unexplained construction changes using the matched no-builder control.'})
    return result

def number(value):
    return float(value) if type(value) in (int,float) else -1

def self_test():
    import tempfile
    checks=[]
    with tempfile.TemporaryDirectory(prefix='fcraft-evidence-join-') as directory:
        root=Path(directory);plan=root/'plan.json';plan.write_text('{}','utf-8')
        paths=[root/name for name in ('native.json','anvil.json','approval.json','attribution.json')]
        def run(mutate=None,after_binding=None):
            count=27194
            construction={'actualMinecraft':True,'nativePassed':True,'sourcePreimagesVerified':True,'preimagePages':213,'verifiedCells':count,'written':12000,'skipped':15194,'signature':'test','zeroOutsideWrites':None,'blockEntitiesPreserved':None}
            native={'passed':True,'actualMinecraft':True,'probe':{'passed':True,'construction':copy.deepcopy(construction)},'codeHashes':{'builder':'hash'},'modHashes':{'mod':'hash'},'worldSourceInventorySHA256':'worldhash'}
            anvil={'passed':False,'finalCertification':False,'zeroOutsideWrites':False,'blockEntitiesPreserved':False,'plannedCells':count,'unexpectedTargetCount':0,'unexpectedTargets':[],'signature':'test','planFile':str(plan),'planSHA256':sha(plan),'outsideChangeCount':2,'originalBlockEntityChangeCount':1,'sourcePreimages':{'passed':True,'preflightComplete':True,'sourceMismatchCount':0,'status':'DONE','signature':'test','expectedCells':count,'actualCells':count}}
            approval={'passed':True,'originalSourceMatches':True,'blockEntitiesTouched':0,'cells':count,'planSignature':'test'}
            attr={'passed':True,'actualMinecraft':True,'checks':[{'passed':True}],'unplannedBlockChangeCount':0,'outsideResidual':[],'outsideControlExactMatches':2,'unexplainedBlockEntityChangeCount':0,'blockEntities':[{'attribution':{'explained':True},'originalCriticalContent':{'passed':True}}],'originalNonemptyCriticalContentPreserved':True,'beeReleaseEvidence':{'passed':True},'rawAnvilPassed':False,'rawFailedVerdictOverwritten':False}
            if mutate:mutate(native,anvil,approval,attr)
            for p,value in zip(paths[:3],[native,anvil,approval]):p.write_text(json.dumps(value),'utf-8')
            attr['inputs']={str(p.resolve()):sha(p) for p in paths[:2]}
            if after_binding:after_binding(attr)
            paths[3].write_text(json.dumps(attr),'utf-8')
            before={p:p.read_bytes() for p in paths}
            result=joined(*paths)
            assert all(p.read_bytes()==value for p,value in before.items()),'Input mutation'
            assert result['probe']==native['probe'],'Raw probe mutation'
            return result
        def test(name,condition):
            checks.append({'name':name,'passed':bool(condition)})
            assert condition,name
        result=run()
        test('scoped PASS retains strict raw FAIL and unchanged native probe',result['passed'] and not result['construction']['strictOriginalPreservation']['passed'] and not result['construction']['zeroOutsideWrites'] and not result['construction']['blockEntitiesPreserved'])
        test('missing source preimage fails',not run(lambda n,a,p,t:a['sourcePreimages'].update(actualCells=27193))['passed'])
        test('unwritten target fails',not run(lambda n,a,p,t:a.update(unexpectedTargetCount=1))['passed'])
        test('incomplete native readback fails',not run(lambda n,a,p,t:n['probe']['construction'].update(verifiedCells=27193))['passed'])
        test('unexplained outside construction change fails',not run(lambda n,a,p,t:t.update(unplannedBlockChangeCount=1))['passed'])
        test('original critical-content loss fails',not run(lambda n,a,p,t:t.update(originalNonemptyCriticalContentPreserved=False))['passed'])
        test('failed no-builder control check fails',not run(lambda n,a,p,t:t.update(checks=[{'passed':False}]))['passed'])
        test('approval count mismatch fails',not run(lambda n,a,p,t:p.update(cells=27193))['passed'])
        test('failed actual native execution fails',not run(lambda n,a,p,t:n.update(passed=False))['passed'])
        test('stale raw-native evidence binding fails',not run(after_binding=lambda t:t['inputs'].update({str(paths[0].resolve()):'0'*64}))['passed'])
    return {'passed':True,'actualMinecraft':False,'tests':len(checks),'checks':checks}

def main():
    parser=argparse.ArgumentParser()
    for name in ('native','anvil','approval','attribution','output'):parser.add_argument('--'+name,type=Path)
    parser.add_argument('--self-test',action='store_true')
    args=parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(),ensure_ascii=False));return
    for name in ('native','anvil','approval','attribution','output'):
        if getattr(args,name) is None:parser.error('--'+name+' is required unless --self-test is used')
    assert args.output.resolve() not in {p.resolve() for p in (args.native,args.anvil,args.approval,args.attribution)}, 'Preserve raw source evidence'
    assert not args.output.exists(), 'Preserve previous joined evidence'
    result=joined(args.native,args.anvil,args.approval,args.attribution)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    proof=result['construction']
    print(json.dumps({'passed':result['passed'],'preservationScope':proof['preservationScope'],'strictOriginalPassed':proof['strictOriginalPreservation']['passed'],'zeroUnplannedConstructionChanges':proof['zeroUnplannedConstructionChanges'],'criticalOriginalBlockEntityContentPreserved':proof['criticalOriginalBlockEntityContentPreserved'],'output':str(args.output)},ensure_ascii=False))
    if not result['passed']:raise SystemExit(1)

if __name__=='__main__': main()
