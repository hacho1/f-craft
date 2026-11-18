"""Preserve the private-use ZIP and prepare a separate metadata hotfix ZIP.

Default: dry check only, with a new receipt and no archive creation.
After root GO, --build also requires --final-inputs JSON:
 {"ready":true,"guide":"설치_검증_가이드_v10_6.md",
  "actualStartupSmoke":"검증/.../result.json",
  "installationReceipt":"검증/install_v106/.../receipt.json",
  "evidence":["검증/v10_6_promotion_pack_metadata_regression.json",...]}
Final startup/installation/evidence files are added below a new hotfix evidence
directory inside the ZIP. Existing native529/1083 evidence stays byte-identical.
"""
from pathlib import Path,PurePosixPath
import argparse,copy,hashlib,io,json,re,zipfile,zlib

ROOT=Path(__file__).resolve().parents[1]
PREFIX='F-Craft_v10_6/'
ORIGINAL=ROOT/'배포/F-Craft_v10_6_개인적용패치.zip'
OUTPUT=ROOT/'배포/F-Craft_v10_6_ResourcePackInfo_수정판.zip'
PROMOTION='fcraft-promotion-bridge-1.0.0-forge-1.20.1.jar'
HOTFIX=PREFIX+'검증/resourcepackinfo_hotfix_v106/'

def require(value,message):
 if not value:raise RuntimeError(message)
def sha_bytes(raw):return hashlib.sha256(raw).hexdigest()
def sha_file(path):
 h=hashlib.sha256()
 with path.open('rb')as f:
  while raw:=f.read(1024*1024):h.update(raw)
 return h.hexdigest()
def read_json(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def source_path(raw):
 p=Path(raw);p=p if p.is_absolute()else ROOT/p;p=p.resolve()
 require(p.is_relative_to(ROOT.resolve())and p.is_file(),'Out-of-scope or missing final input '+str(p))
 return p
def valid_member(name):
 p=PurePosixPath(name)
 return name.startswith(PREFIX)and not p.is_absolute()and '..'not in p.parts and '\\'not in name and '\x00'not in name
def inspect_archive(path):
 rows={}
 with zipfile.ZipFile(path)as z:
  require(z.testzip()is None,'CRC failure '+str(path))
  for info in z.infolist():
   require(valid_member(info.filename),'Unsafe archive member '+info.filename)
   require(info.filename not in rows,'Duplicate archive member '+info.filename)
   raw=z.read(info)
   require(zlib.crc32(raw)&0xffffffff==info.CRC,'CRC mismatch '+info.filename)
   rows[info.filename]={'sha256':sha_bytes(raw),'bytes':len(raw),'crc32':info.CRC,'directory':info.is_dir()}
 return rows
def metadata_equivalence(old_raw,new_raw):
 with zipfile.ZipFile(io.BytesIO(old_raw))as a,zipfile.ZipFile(io.BytesIO(new_raw))as b:
  require(a.testzip()is None and b.testzip()is None,'Inner JAR CRC failure')
  old={n:a.read(n)for n in a.namelist()};new={n:b.read(n)for n in b.namelist()}
 require(set(new)-set(old)=={'pack.mcmeta'}and not(set(old)-set(new)),'Hotfix JAR is not one-entry metadata-only')
 require(all(new[n]==raw for n,raw in old.items()),'Existing JAR class/resource bytes changed')
 pack=json.loads(new['pack.mcmeta']);require(pack['pack']['pack_format']==15 and bool(pack['pack']['description']),'Invalid Minecraft1.20.1 pack metadata')
 return {'passed':True,'oldJarSHA256':sha_bytes(old_raw),'newJarSHA256':sha_bytes(new_raw),'allExistingEntriesByteIdentical':True,'addedEntries':['pack.mcmeta'],'existingEntries':len(old),'packFormat':15}
def manifest_jar_rows(value):
 if isinstance(value,dict):
  if value.get('file')==PROMOTION:yield value
  for v in value.values():yield from manifest_jar_rows(v)
 elif isinstance(value,list):
  for v in value:yield from manifest_jar_rows(v)

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--label',required=True);parser.add_argument('--build',action='store_true');parser.add_argument('--final-inputs',type=Path);args=parser.parse_args()
 require(re.fullmatch(r'[A-Za-z0-9_]+',args.label),'Unsafe receipt label')
 receipt_dir=ROOT/'검증/package_metadata_hotfix_v106'/args.label
 require(not receipt_dir.exists(),'Preserve earlier receipt; choose a new label')
 require(ORIGINAL.is_file(),'Original private-use package missing')
 require(not OUTPUT.exists(),'Preserve existing hotfix package')
 original_sha=sha_file(ORIGINAL);original=inspect_archive(ORIGINAL)
 def unique(suffix):
  matches=[n for n in original if n.endswith(suffix)];require(len(matches)==1,'Expected one exact archive member '+suffix);return matches[0]
 jar_member=unique('/수정파일/mods/'+PROMOTION);manifest_member=unique('/수정파일/modpack_manifest_1.20.1_forge.json');guide_member=unique('/설치_검증_가이드_v10_6.md')
 source_jar=ROOT/'수정파일/mods'/PROMOTION;source_manifest=ROOT/'수정파일/modpack_manifest_1.20.1_forge.json'
 require(source_jar.is_file()and source_manifest.is_file(),'Current replacement inputs missing')
 replacements={jar_member:source_jar,manifest_member:source_manifest};inputs={str(p):sha_file(p)for p in replacements.values()}
 with zipfile.ZipFile(ORIGINAL)as z:equivalence=metadata_equivalence(z.read(jar_member),source_jar.read_bytes())
 manifest=read_json(source_manifest);matches=list(manifest_jar_rows(manifest))
 require(len(matches)==1 and matches[0].get('sha256')==sha_file(source_jar),'Current manifest does not bind current hotfix JAR')
 require(manifest.get('release_channel')=='private-development','Preserve private-use release channel')
 final_sources={};final_evidence=None
 if args.final_inputs:
  spec_path=source_path(args.final_inputs);spec=read_json(spec_path);require(spec.get('ready')is True,'Final inputs are not declared ready')
  guide=source_path(spec['guide']);smoke=source_path(spec['actualStartupSmoke']);install=source_path(spec['installationReceipt'])
  smoke_json=read_json(smoke);install_json=read_json(install)
  require(smoke_json.get('passed')is True and smoke_json.get('actualMinecraft')is True,'Actual startup smoke must pass and identify actual Minecraft')
  require(install_json.get('installed')is True,'Actual metadata-hotfix installation receipt required')
  replacements[guide_member]=guide
  final_sources={HOTFIX+'actual_startup_smoke.json':smoke,HOTFIX+'installation_receipt.json':install}
  for raw in spec.get('evidence',[]):
   p=source_path(raw);name=HOTFIX+'evidence/'+p.name;require(name not in final_sources,'Duplicate final evidence basename '+p.name);final_sources[name]=p
  require(all(n not in original for n in final_sources),'New hotfix evidence must not overwrite archived proof')
  inputs.update({str(p):sha_file(p)for p in [spec_path,guide,*final_sources.values()]})
  final_evidence={'spec':str(spec_path),'startupSmoke':str(smoke),'installationReceipt':str(install),'evidenceMembers':sorted(final_sources)}
 if args.build:require(args.final_inputs is not None,'Build requires root-prepared final guide/startup/install inputs after GO')
 expected={n:dict(row)for n,row in original.items()}
 for n,p in {**replacements,**final_sources}.items():
  raw=p.read_bytes();expected[n]={'sha256':sha_bytes(raw),'bytes':len(raw),'crc32':zlib.crc32(raw)&0xffffffff,'directory':False}
 licenses=[n for n in original if '/LICENSE_'in n]
 require(bool(licenses),'Original license notices missing')
 if args.build:
  # Copy each original ZipInfo and uncompressed member bytes exactly. Replace
  # only explicit inputs; new proof lives separately from archived native proof.
  with zipfile.ZipFile(ORIGINAL)as old,zipfile.ZipFile(OUTPUT,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as new:
   new.comment=old.comment
   for info in old.infolist():new.writestr(copy.copy(info),replacements[info.filename].read_bytes()if info.filename in replacements else old.read(info))
   for n,p in sorted(final_sources.items()):
    info=zipfile.ZipInfo(n,(2026,11,17,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;new.writestr(info,p.read_bytes())
  actual=inspect_archive(OUTPUT);require(actual==expected,'Full member SHA/CRC/size verification failed')
 else:actual=None
 require(sha_file(ORIGINAL)==original_sha,'Original package changed')
 require(all(sha_file(Path(p))==h for p,h in inputs.items()),'Packaging inputs changed during check')
 changed=[n for n in original if expected[n]['sha256']!=original[n]['sha256']]
 require(set(changed).issubset(set(replacements)),'Unexpected original-member change')
 require(all(expected[n]==original[n]for n in licenses),'License notices changed')
 receipt={'passed':True,'actualMinecraft':False,'dryRun':not args.build,'archiveCreated':args.build,'original':str(ORIGINAL),'originalSHA256':original_sha,'originalPreserved':True,'output':str(OUTPUT),'outputSHA256':sha_file(OUTPUT)if args.build else None,'outputBytes':OUTPUT.stat().st_size if args.build else None,'originalMemberCount':len(original),'expectedMemberCount':len(expected),'originalCRCVerified':True,'outputCRCVerified':True if args.build else None,'everyOutputMemberSHAVerified':True if args.build else None,'archiveMembersDiscovered':{'promotionJar':jar_member,'manifest':manifest_member,'guide':guide_member},'changedOriginalMembers':changed,'addedEvidenceMembers':sorted(final_sources),'licenseMembersPreserved':licenses,'privateUseDesignationPreserved':True,'publicRedistributionPermissionImplied':False,'wholeWorldAdded':False,'metadataOnlyByteEquivalence':equivalence,'evidenceScope':{'archived529ServerAnd1083ClientChecks':'Preserved original proof for the original archive JAR; not relabeled as a new metadata-JAR gameplay run.','newMetadataArtifactProof':'Separate metadata-only byte equivalence plus separately supplied actual startup smoke and installation receipt.','finalEvidence':final_evidence},'inputHashes':inputs,'originalMemberHashes':original,'expectedMemberHashes':expected,'actualOutputMemberHashes':actual,'packagerSHA256':sha_file(Path(__file__))}
 receipt_dir.mkdir(parents=True);receipt_path=receipt_dir/'receipt.json';receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({k:receipt[k]for k in ['passed','dryRun','archiveCreated','originalPreserved','originalMemberCount','expectedMemberCount','changedOriginalMembers','output','outputSHA256']}|{'receipt':str(receipt_path)},ensure_ascii=False))
if __name__=='__main__':main()
