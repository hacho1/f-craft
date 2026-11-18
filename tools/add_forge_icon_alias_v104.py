"""Reuse the existing exact anvil art for the Guardian forge button resource ID."""
from pathlib import Path
import hashlib,io,json,zipfile
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'수정파일';LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __')
SOURCE='assets/f_rank_days/textures/gui/npc_dialog/job_blacksmith.png';ALIAS='assets/f_rank_days/textures/gui/npc_dialog/icon_forge.png'
def sha(raw):return hashlib.sha256(raw).hexdigest()
pack=P/'resourcepacks/F-Rank Days RPG Resources.zip';before=pack.read_bytes();old=zipfile.ZipFile(io.BytesIO(before));entries={n:old.read(n)for n in old.namelist()};assert len(entries)==553 and ALIAS not in entries
raw=entries[SOURCE];assert raw==(LIVE/'kubejs'/SOURCE).read_bytes();target=P/'kubejs'/ALIAS;assert not target.exists();target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as out:
 for info in old.infolist():out.writestr(info,entries[info.filename])
 info=zipfile.ZipInfo(ALIAS,(2026,11,17,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;out.writestr(info,raw)
after=buf.getvalue();z=zipfile.ZipFile(io.BytesIO(after));assert z.testzip()is None and all(z.read(n)==value for n,value in entries.items());assert set(z.namelist())-set(entries)=={ALIAS}
pack.write_bytes(after);mirror=P/'config/paxi/resourcepacks/F-Rank Days RPG Resources.zip';mirror.write_bytes(after);assert z.read(ALIAS)==z.read(SOURCE)==target.read_bytes()
alias={'source':SOURCE,'alias':ALIAS,'sha256':sha(raw),'bytes':len(raw),'byteIdentical':True,'artGeneratedOrModified':False,'sourceIsExistingProjectAnvilIcon':True}
rf=ROOT/'검증/raid_assets_v132.json';report=json.loads(rf.read_text('utf-8'));report.update(ownPackSHA256=sha(after),totalMembers=len(z.namelist()),addedMembers=len(z.namelist())-report['oldMembersPreserved']);report['aliases']=[alias];rf.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
proof={'passed':True,'actualMinecraft':False,'priorPackSHA256':sha(before),'ownPackSHA256':sha(after),'priorMembers':len(entries),'totalMembers':len(z.namelist()),'allExistingEntryBytesIdentical':True,'onlyAddedEntries':[ALIAS],'oldEntrySHA256':{n:sha(value)for n,value in entries.items()},'alias':alias,'normalAndPaxiByteIdentical':pack.read_bytes()==mirror.read_bytes(),'producerCallSite':'47_guardian_boss_gear_forge_v10_2.js: Guardian forge button icon=forge','consumerCallSite':'01_npc_rpg_dialog_ui.js: icon_<button.icon>.png'}
out=ROOT/'검증/forge_icon_alias_v104.json';assert not out.exists();out.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:proof[k]for k in ['passed','actualMinecraft','priorMembers','totalMembers','ownPackSHA256','allExistingEntryBytesIdentical']}))
