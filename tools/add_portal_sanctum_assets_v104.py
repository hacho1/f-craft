"""Add two exact CC0 source crops; preserve all existing world/UI portraits."""
from pathlib import Path
import hashlib,io,json,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]; P=ROOT/'수정파일'
def sha(b):return hashlib.sha256(b).hexdigest()
def write(rel,value):
 p=P/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8');return p.read_bytes()
source=zipfile.ZipFile(ROOT.parent/'F-Craft_v9_3_통합업데이트/개별작업/ui/research/496_RPG_icons.zip')
report=json.loads((ROOT/'검증/raid_assets_v132.json').read_text(encoding='utf8')); additions={}
for item,label,member in [('guardian_portal_pedestal','봉인 차원문 기동석','S_Magic09.png'),('sanctum_escape_crystal','비상 귀환 수정석','I_Crystal03.png')]:
 raw=source.read(member);original=Image.open(io.BytesIO(raw)).convert('RGBA');bounds=original.getbbox();left,top,right,bottom=bounds
 crop=[left,top,right,bottom];pic=original.crop(crop);out=io.BytesIO();pic.save(out,format='PNG');png=out.getvalue();rel='assets/f_rank_days/textures/block/'+item+'.png';target=P/'kubejs'/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(png);additions[rel]=png
 model=json.loads((P/'kubejs/assets/f_rank_days/models/block/guardian_moss_altar.json').read_text(encoding='utf8'));model['textures'].update(base='minecraft:block/polished_blackstone_bricks',particle='minecraft:block/polished_blackstone_bricks',icon='f_rank_days:block/'+item)
 for rel,data in [('assets/f_rank_days/models/block/'+item+'.json',model),('assets/f_rank_days/models/item/'+item+'.json',{'parent':'f_rank_days:block/'+item}),('assets/f_rank_days/blockstates/'+item+'.json',{'variants':{'':{'model':'f_rank_days:block/'+item}}})]:additions[rel]=write('kubejs/'+rel,data)
 record={'id':'f_rank_days:'+item,'label':label,'kind':'block','sourcePack':'496','sourceMember':member,'sourceSHA256':sha(raw),'crop':crop,'sourceAlphaBounds':list(bounds),'nontransparentPixels':sum(a>0 for a in pic.getchannel('A').getdata()),'textureSHA256':sha(png),'sourceURL':'https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg','license':'CC0-1.0'}
 report['records']=[r for r in report['records'] if r['id']!=record['id']]+[record]
langpath='kubejs/assets/fcraft_raid/lang/ko_kr.json';lang=json.loads((P/langpath).read_text(encoding='utf8'));lang.update({'block.f_rank_days.guardian_portal_pedestal':'봉인 차원문 기동석','block.f_rank_days.sanctum_escape_crystal':'비상 귀환 수정석'});additions[langpath[len('kubejs/'):]]=write(langpath,lang)
pack=P/'resourcepacks/F-Rank Days RPG Resources.zip';old=zipfile.ZipFile(io.BytesIO(pack.read_bytes()));buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as out:
 for info in old.infolist():out.writestr(info,additions.pop(info.filename,old.read(info.filename)))
 for name,data in sorted(additions.items()):info=zipfile.ZipInfo(name,(2026,11,16,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;out.writestr(info,data)
raw=buf.getvalue();pack.write_bytes(raw);(P/'config/paxi/resourcepacks/F-Rank Days RPG Resources.zip').write_bytes(raw)
z=zipfile.ZipFile(io.BytesIO(raw));report.update(ownPackSHA256=sha(raw),totalMembers=len(z.namelist()),addedMembers=len(z.namelist())-report['oldMembersPreserved'],resourceRegistryIDs=len(report['records']))
(ROOT/'검증/raid_assets_v132.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'passed':z.testzip() is None,'ids':len(report['records']),'members':len(z.namelist()),'sha256':sha(raw),'actualMinecraft':False}))
