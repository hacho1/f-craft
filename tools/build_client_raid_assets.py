"""Deterministic licensed sprite cropping and append-only resource-pack assembly.
No Java VM, Minecraft, foreground input, or live installation is used.
"""
from pathlib import Path
import sys,io,json,zipfile,hashlib,re,shutil,copy
sys.dont_write_bytecode=True
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]; P=ROOT/'수정파일'
LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __')
OLD=ROOT.parent/'F-Craft_6차_1장성장마감'
SRC496=ROOT.parent/'F-Craft_v9_3_통합업데이트/개별작업/ui/research/496_RPG_icons.zip'
SRCSHI=ROOT.parent/'F-Craft_5차_모험가도감/사전검토/원본_내부보관_배포금지/shikashi_official_free.zip'
def sha(raw):return hashlib.sha256(raw).hexdigest()
assert sha(SRC496.read_bytes())=='82167b463d20fdc2c0cb641e061503bb77816558087270e50eb66ad34cf75658'
assert sha(SRCSHI.read_bytes())=='eb3725a63ec7afa04c8942057717758cc0a9388ceb1d4348a7e8487dfbc0492e'
z496=zipfile.ZipFile(SRC496); zshi=zipfile.ZipFile(SRCSHI)
sheetName="Shikashi's Fantasy Icons Pack v2/#1 - Transparent Icons.png"
sheet=Image.open(io.BytesIO(zshi.read(sheetName))).convert('RGBA')
# All choices are existing professional icon art, not new drawings/recolours.
rows=[
 ('guardian_moss_altar','이끼 수호자의 제단','496','S_Earth03.png',None,'block'),
 ('corrupted_blossom_altar','침식된 꽃의 제단','496','I_Leaf.png',None,'block'),
 ('ancient_heartwood_core','고대 수목의 심장석','496','I_Jade.png',None,'item'),
 ('purifying_dew_vial','정화의 이슬병','496','P_Green02.png',None,'item'),
 ('wrought_iron_heart','수호자의 강철 심장','shikashi',sheetName,(0,1),'item'),
 ('wrought_challenge_sigil','수호자 도전 공명패','496','Ac_Medal02.png',None,'item'),
 ('guardian_wrought_helm','수호자의 결전 투구','496','C_Elm03.png',None,'item'),
 ('wrought_greatsword','수호자의 결전 대검','496','W_Sword014.png',None,'item'),
 ('wrought_colossus_axe','수호자의 천금 대도끼','496','W_Axe014.png',None,'item'),
 ('wrought_siege_bow','수호자의 강철 대궁','496','W_Bow07.png',None,'item'),
 ('wrought_sanctuary_mace','수호자의 성소 철퇴','496','W_Mace004.png',None,'item'),
 ('wrought_reaper_scythe','수호자의 강철 수확낫','496','W_Staff04.png',None,'item'),
 ('wrought_alchemic_blade','수호자의 정밀 절단기','496','W_Dagger012.png',None,'item'),
 ('wrought_harpoon_lance','수호자의 심해 작살창','496','W_Spear009.png',None,'item'),
 ('wrought_iron_skillet','수호자의 무쇠 전골팬','shikashi',sheetName,(9,19),'item'),
 ('wrought_forge_warhammer','수호자의 단조 대형망치','496','W_Mace003.png',None,'item'),
 ('wrought_relic_staff','수호자의 고대 공명장','496','W_Staff06.png',None,'item'),
 ('wrought_corebreaker_pick','수호자의 심장파쇄 곡괭이','shikashi',sheetName,(2,10),'item'),
 ('wrought_shadow_twins','수호자의 그림자 쌍인','shikashi',sheetName,(9,5),'item'),
]
added={}; records=[]
def emit(rel,raw):
 target=P/'kubejs'/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
 if rel.startswith('assets/'):added[rel]=raw
def emitjson(rel,d):emit(rel,(json.dumps(d,ensure_ascii=False,indent=2)+'\n').encode())
for item,label,source,member,cell,kind in rows:
 if source=='496':
  raw=z496.read(member);origin=Image.open(io.BytesIO(raw)).convert('RGBA');bbox=origin.getbbox();ox=max(0,min(origin.width-32,bbox[0]));oy=max(0,min(origin.height-32,bbox[1]));box=(ox,oy,ox+32,oy+32)
  if bbox[2]>box[2] or bbox[3]>box[3]:box=(0,0,origin.width,origin.height)
  image=origin.crop(box)
 else:
  raw=zshi.read(member);box=(cell[0]*32,cell[1]*32,cell[0]*32+32,cell[1]*32+32);origin=sheet.crop(box);image=origin; bbox=origin.getbbox()
 assert image.width in (32,34) and image.height in (32,34) and sum(px[3]>0 for px in image.getdata())==sum(px[3]>0 for px in origin.getdata())
 out=io.BytesIO();image.save(out,format='PNG');png=out.getvalue();emit('assets/f_rank_days/textures/'+kind+'/'+item+'.png',png)
 model={'parent':'minecraft:item/generated' if item in ('guardian_wrought_helm','ancient_heartwood_core','purifying_dew_vial','wrought_iron_heart','wrought_challenge_sigil') else 'minecraft:item/handheld','textures':{'layer0':'f_rank_days:'+kind+'/'+item}}
 if kind=='block':
  model={'parent':'f_rank_days:block/'+item}
  tex='f_rank_days:block/'+item
  faces={face:{'uv':[0,0,16,16],'texture':'#base'} for face in ['north','south','east','west','up','down']}
  elements=[{'from':[2,0,2],'to':[14,4,14],'faces':faces},{'from':[2,4,8],'to':[14,16,8],'faces':{'north':{'uv':[0,0,16,16],'texture':'#icon'},'south':{'uv':[0,0,16,16],'texture':'#icon'}}},{'from':[8,4,2],'to':[8,16,14],'faces':{'east':{'uv':[0,0,16,16],'texture':'#icon'},'west':{'uv':[0,0,16,16],'texture':'#icon'}}}]
  emitjson('assets/f_rank_days/models/block/'+item+'.json',{'render_type':'minecraft:cutout','ambientocclusion':False,'textures':{'base':'minecraft:block/mossy_stone_bricks','icon':tex,'particle':'minecraft:block/mossy_stone_bricks'},'elements':elements})
  emitjson('assets/f_rank_days/blockstates/'+item+'.json',{'variants':{'':{'model':'f_rank_days:block/'+item}}})
 emitjson('assets/f_rank_days/models/item/'+item+'.json',model)
 records.append({'id':'f_rank_days:'+item,'label':label,'kind':kind,'sourcePack':source,'sourceMember':member,'sourceSHA256':sha(raw),'crop':list(box),'sourceAlphaBounds':list(bbox),'nontransparentPixels':sum(px[3]>0 for px in image.getdata()),'textureSHA256':sha(png),'sourceURL':'https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg' if source=='496' else 'https://shikashipx.itch.io/shikashis-fantasy-icons-pack','license':'CC0-1.0' if source=='496' else 'CC-BY-4.0 + included legacy CC-BY-3.0 attribution'})
# Separate resource namespace contributes translation keys without altering any
# previous language member. Registry namespace f_rank_days remains unchanged.
lang={('block.' if kind=='block' else 'item.')+'f_rank_days.'+item:label for item,label,source,member,cell,kind in rows}
lang.update({'kicker.vitral_bossintros.intro':'보스 출현','kicker.vitral_bossintros.defeat':'VICTORY','title.vitral_bossintros.defeat':'%s 토벌 완료'})
emitjson('assets/fcraft_raid/lang/ko_kr.json',lang)
parents={'wrought_greatsword':'simplyswords:iron_claymore','wrought_colossus_axe':'simplyswords:iron_greataxe','wrought_siege_bow':'bettercombat:bow_two_handed_heavy','wrought_sanctuary_mace':'bettercombat:mace','wrought_reaper_scythe':'bettercombat:scythe','wrought_alchemic_blade':'bettercombat:dagger','wrought_harpoon_lance':'simplyswords:iron_spear','wrought_iron_skillet':'bettercombat:mace','wrought_forge_warhammer':'simplyswords:iron_greathammer','wrought_relic_staff':'bettercombat:staff','wrought_corebreaker_pick':'bettercombat:pickaxe','wrought_shadow_twins':'bettercombat:dagger'}
mods={}
for n in ['simplyswords-forge-1.56.0-1.20.1.jar','bettercombat-forge-1.9.0+1.20.1.jar']:
 z=zipfile.ZipFile(LIVE/'mods'/n)
 for key in z.namelist():
  if key.endswith('.json') and '/weapon_attributes/' in key:
   prefix,tail=key[5:].split('/weapon_attributes/');mods[prefix+':'+tail[:-5]]=json.loads(z.read(key))
for item,parent in parents.items():
 assert parent in mods,parent
 emitjson('data/f_rank_days/weapon_attributes/'+item+'.json',{'parent':parent})
credits='F-Craft chapter 1 raid equipment icon additions\n\n496 Pixel Art Icons for Medieval/Fantasy RPG — Henrique Lazarini (7Soul1)\nhttps://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg\nCC0-1.0 https://creativecommons.org/publicdomain/zero/1.0/\nChanges: transparent borders cropped losslessly to32x32; no recolour.\n\nShikashi Fantasy Icons — Matt Firth (shikashipx) and game-icons.net\nhttps://shikashipx.itch.io/shikashis-fantasy-icons-pack\nhttps://game-icons.net/\nCC BY4.0 https://creativecommons.org/licenses/by/4.0/\nLegacy included notice CC BY3.0 https://creativecommons.org/licenses/by/3.0/\nChanges: transparent32px cells extracted exactly, no redraw/recolour.\nOriginal sheets not distributed.\n\nAll older license notices and resource bytes retained.\nUser portraits and UI backgrounds have not been modified.\n'
added['LICENSE_FCRAFT_RAID_ICONS.txt']=credits.encode();(ROOT/'LICENSE_RAID_ICONS.txt').write_text(credits,encoding='utf8')
pack=LIVE/'resourcepacks/F-Rank Days RPG Resources.zip';old=zipfile.ZipFile(pack);oldnames=old.namelist();assert len(oldnames)==499 and not set(oldnames)&set(added)
buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as dest:
 for info in old.infolist():dest.writestr(copy.copy(info),old.read(info.filename))
 for name,raw in sorted(added.items()):
  info=zipfile.ZipInfo(name,date_time=(2026,11,16,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;dest.writestr(info,raw)
packraw=buf.getvalue();result=zipfile.ZipFile(io.BytesIO(packraw));assert result.testzip() is None
assert all(result.read(n)==old.read(n) for n in oldnames)
for rel in ['resourcepacks/F-Rank Days RPG Resources.zip','config/paxi/resourcepacks/F-Rank Days RPG Resources.zip']:
 target=P/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(packraw)
manifest=json.loads((LIVE/'config/paxi/fcraft_pack_manifest_v98.json').read_text(encoding='utf8'))
for row in manifest['copies']:
 if row.get('kind')=='own':row['sha256']=sha(packraw);row['bytes']=len(packraw)
manifest['phase7Raid']={'ownPackSHA256':sha(packraw),'old499EntriesByteIdentical':True,'resourceItems':19,'newRegistrations':18,'existingRegistryReused':'f_rank_days:wrought_challenge_sigil','extraNamespace':'fcraft_raid translations only; registry remains f_rank_days'}
target=P/'config/paxi/fcraft_pack_manifest_v98.json';target.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
text=(LIVE/'config/itemborders-common.toml').read_text(encoding='utf8');gear=[r[0] for r in rows][6:]
assert len(gear)==13
text+='\n\t\t\t"#FFFFD166" = '+json.dumps(['f_rank_days:'+item for item in gear],ensure_ascii=False)+'\n';(P/'config/itemborders-common.toml').write_text(text,encoding='utf8')
report={'actualMinecraft':False,'javaExecuted':False,'sourceArchives':{'496':sha(SRC496.read_bytes()),'shikashi':sha(SRCSHI.read_bytes())},'oldPackSHA256':sha(pack.read_bytes()),'oldMembersPreserved':499,'addedMembers':len(added),'totalMembers':len(result.namelist()),'ownPackSHA256':sha(packraw),'records':records,'weaponParents':parents,'notes':['All alpha pixels retained; no generated graphics.','Existing old language assets unchanged; new namespace supplies matching item translation keys.','Reaper uses the existing crescent staff icon; skillet uses the existing iron cauldron icon, without drawing replacement art.']}
(ROOT/'검증/raid_assets_v132.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'items':len(rows),'oldPreserved':499,'added':len(added),'total':len(result.namelist()),'ownPackSHA256':sha(packraw)}))
