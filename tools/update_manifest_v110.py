"""Publish exact inspected dependency and first-party bridge inputs for both sides."""
from pathlib import Path
import hashlib,json,zipfile

ROOT=Path(__file__).resolve().parents[1]
def main():
 p=ROOT/'수정파일/modpack_manifest_1.20.1_forge.json';d=json.loads(p.read_text(encoding='utf-8-sig'))
 downloads=json.loads((ROOT/'개별작업/dependencies_v110/download_receipt.json').read_text(encoding='utf-8'))['files']
 added=[]
 for row,mid,version,project,fid in zip(downloads,['waystones','balm'],['14.1.21','7.3.44'],[245755,531761],[8849482,8969708]):
  artifact=ROOT/'수정파일/mods'/row['name'];assert artifact.is_file() and hashlib.sha256(artifact.read_bytes()).hexdigest()==row['sha256']
  with zipfile.ZipFile(artifact)as archive:assert archive.testzip()is None
  entry={'category':'TRAVEL_NETWORK','name':'Waystones' if mid=='waystones' else 'Balm','mod_id':mid,'pinned_file':row['name'],'observed_version':version,'url':f'https://www.curseforge.com/minecraft/mc-mods/{mid}/files/{fid}','project_id':project,'file_id':fid,'sha256':row['sha256'],'bytes':row['bytes'],'installation_side':'both'}
  d['pinned_required_mods']=[x for x in d['pinned_required_mods']if x.get('mod_id')!=mid]+[entry]
  if row['name']not in d['dedicated_server_jar_allowlist']:d['dedicated_server_jar_allowlist'].append(row['name'])
  added.append(entry)
 bridge=ROOT/'수정파일/mods/fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'
 claimFile=ROOT/'수정파일/kubejs/server_scripts/57_member_claim_limits_v110.js'
 assert claimFile.is_file(),'Activate reviewed per-member claim policy before publishing manifest'
 d['manifest_version']='11.0.0-private';d['project']='《F-Craft》 승급 HUD · 메달리온 아이콘 · 본토 이동망 · 개인 군마'
 d['phase10']={'packageVersion':'11.0','orderedInputs':['f_craft_4_npccc.md','f_craft_4_npcicon.md','f_craft_2_overwolrd.md'],'workingDrive':'E:', 'namespacesAndSavedIdsPreserved':True,'ambientSpawnRatioChangesDeferred':True,'EDCRelaxedContracts':36,'BASPreservedContracts':36,'questTabs':{'beforeMainland':4,'personalMainlandUnlocked':5},'officialWaystones':9,'claimPolicy':{'file':claimFile.relative_to(ROOT/'수정파일').as_posix(),'sha256':hashlib.sha256(claimFile.read_bytes()).hexdigest(),'defaultPerMember':25,'partyAggregation':'SUM','hardTeamCap':0,'runtimeConfigOnly':True,'existingClaimRecordsPreserved':True},'keys':{'promotionTracker':'O','mount':'F8','shaderSelection':'F7','dodgePreserved':'V','JEIPreserved':'Ctrl+O'},'requiredResourcePaths':33,'dependenciesBothSides':added,'promotionBridge':{'file':bridge.name,'sha256':hashlib.sha256(bridge.read_bytes()).hexdigest(),'bytes':bridge.stat().st_size},'verificationEvidence':'검증/v11_0_integrated_verification.json','verificationStatus':'Exact final server/client execution must match this candidate before installation','publicRedistributionPermissionImplied':False}
 arenaFile=ROOT/'수정파일/kubejs/server_scripts/48_serdin_three_boss_arenas_builder_v10_3.js'
 d['phase10']['arenaGroundMaintenance']={'file':arenaFile.relative_to(ROOT/'수정파일').as_posix(),'sha256':hashlib.sha256(arenaFile.read_bytes()).hexdigest(),'rule':'reviewed_own_bottom_slab_grass_decay_v110','originalPreimagesAndPlanPreserved':True,'normalSafetyAndFullVerificationRequired':True}
 d['dedicated_server_jar_allowlist']=sorted(set(d['dedicated_server_jar_allowlist']))
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('Updated v11.0 manifest with pinned artifacts; not an execution claim.')
if __name__=='__main__':main()
