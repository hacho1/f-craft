"""Add one dimension translation in two locales; retain every existing ZIP entry byte."""
from pathlib import Path
import hashlib,io,json,zipfile
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'수정파일'
KEY='travelerstitles.f_rank_days.guardian_sanctum'
def sha(raw):return hashlib.sha256(raw).hexdigest()
pack=P/'resourcepacks/F-Rank Days RPG Resources.zip';before=pack.read_bytes();old=zipfile.ZipFile(io.BytesIO(before));existing={n:old.read(n)for n in old.namelist()};additions={}
for locale,label in [('ko_kr','심연의 부유 결전 성소'),('en_us','Abyssal Guardian Sanctum')]:
 name='assets/fcraft_v104_locale/lang/'+locale+'.json';assert name not in existing,'Keep previous locale addition evidence; do not rewrite frozen resources'
 raw=(json.dumps({KEY:label},ensure_ascii=False,indent=2)+'\n').encode('utf-8');target=P/'kubejs'/name;target.parent.mkdir(parents=True,exist_ok=True);assert not target.exists();target.write_bytes(raw);additions[name]=raw
buffer=io.BytesIO()
with zipfile.ZipFile(buffer,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as out:
 for info in old.infolist():out.writestr(info,existing[info.filename])
 for name,raw in sorted(additions.items()):
  info=zipfile.ZipInfo(name,(2026,11,17,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;out.writestr(info,raw)
after=buffer.getvalue();check=zipfile.ZipFile(io.BytesIO(after));assert check.testzip()is None;assert all(check.read(n)==raw for n,raw in existing.items());assert set(check.namelist())-set(existing)==set(additions)
pack.write_bytes(after);mirror=P/'config/paxi/resourcepacks/F-Rank Days RPG Resources.zip';mirror.write_bytes(after);assert pack.read_bytes()==mirror.read_bytes()
reportfile=ROOT/'검증/raid_assets_v132.json';report=json.loads(reportfile.read_text('utf-8'));report.update(ownPackSHA256=sha(after),totalMembers=len(check.namelist()),addedMembers=len(check.namelist())-report['oldMembersPreserved']);report['additionalLocales']={n:{'sha256':sha(raw),'bytes':len(raw),'keys':[KEY]}for n,raw in additions.items()};reportfile.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
proof={'passed':True,'actualMinecraft':False,'priorPackSHA256':sha(before),'ownPackSHA256':sha(after),'priorMembers':len(existing),'totalMembers':len(check.namelist()),'allExistingEntryBytesIdentical':True,'onlyAddedEntries':sorted(additions),'oldEntrySHA256':{n:sha(raw)for n,raw in existing.items()},'locales':report['additionalLocales'],'normalAndPaxiByteIdentical':True,'imagesOrExistingLanguageMembersChanged':False}
output=ROOT/'검증/sanctum_locale_v104.json';assert not output.exists();output.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:proof[k]for k in ['passed','actualMinecraft','priorMembers','totalMembers','ownPackSHA256','allExistingEntryBytesIdentical']}))
