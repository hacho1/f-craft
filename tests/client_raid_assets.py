"""Independent exact-resource/hash/model assertions; does not launch a JVM."""
from pathlib import Path
import sys,json,zipfile,hashlib,io,tomllib
sys.dont_write_bytecode=True
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'수정파일';LIVE=Path('C:/Users/wooheewon/curseforge/minecraft/Instances/F__ __');checks=[]
def ck(name,ok):
 assert ok,name
 checks.append({'name':name,'passed':True})
def sha(b):return hashlib.sha256(b).hexdigest()
def data(rel):return json.loads((P/rel).read_text(encoding='utf8'))
report=json.loads((ROOT/'검증/raid_assets_v132.json').read_text(encoding='utf8'));mods=json.loads((ROOT/'검증/client_mods_v132.json').read_text(encoding='utf8'))
ck('exact21 registry resources and unique mapping',len(report['records'])==21 and len({r['id'] for r in report['records']})==21)
raw=(P/'resourcepacks/F-Rank Days RPG Resources.zip').read_bytes();z=zipfile.ZipFile(io.BytesIO(raw));old=zipfile.ZipFile(LIVE/'resourcepacks/F-Rank Days RPG Resources.zip')
ck('normal and Paxi identical bytes and matching receipt',raw==(P/'config/paxi/resourcepacks/F-Rank Days RPG Resources.zip').read_bytes() and sha(raw)==report['ownPackSHA256'])
ck('old499 members bytes, names and licenses unchanged',len(old.namelist())==499 and all(z.read(n)==old.read(n) for n in old.namelist()))
forgealias='assets/f_rank_days/textures/gui/npc_dialog/icon_forge.png'
ck('new55 entries only and sole authorized GUI addition is exact anvil alias',z.testzip() is None and len(z.namelist())==554 and len(set(z.namelist())-set(old.namelist()))==55 and all('/npc/' not in n and ('/gui/' not in n or n==forgealias) for n in set(z.namelist())-set(old.namelist())))
source496=zipfile.ZipFile(ROOT.parent/'F-Craft_v9_3_통합업데이트/개별작업/ui/research/496_RPG_icons.zip');sourceshi=zipfile.ZipFile(ROOT.parent/'F-Craft_5차_모험가도감/사전검토/원본_내부보관_배포금지/shikashi_official_free.zip')
for r in report['records']:
 item=r['id'].split(':')[1];rel='assets/f_rank_days/textures/'+r['kind']+'/'+item+'.png';source=source496 if r['sourcePack']=='496' else sourceshi;sourceRaw=source.read(r['sourceMember']);original=Image.open(io.BytesIO(sourceRaw)).convert('RGBA');cropped=original.crop(r['crop']);actual=Image.open(P/'kubejs'/rel).convert('RGBA')
 ck('exact licensed pixel crop and source hash '+item,actual.size==cropped.size and actual.tobytes()==cropped.tobytes() and sha(sourceRaw)==r['sourceSHA256'])
 originAlpha=original if r['sourcePack']=='496' else cropped
 ck('every alpha pixel retained '+item,sum(a>0 for a in actual.getchannel('A').getdata())==sum(a>0 for a in originAlpha.getchannel('A').getdata()))
 ck('texture and item model loose/pack equality '+item,(P/'kubejs'/rel).read_bytes()==z.read(rel) and (P/('kubejs/assets/f_rank_days/models/item/'+item+'.json')).read_bytes()==z.read('assets/f_rank_days/models/item/'+item+'.json'))
 m=data('kubejs/assets/f_rank_days/models/item/'+item+'.json')
 if r['kind']=='block':
  b=data('kubejs/assets/f_rank_days/models/block/'+item+'.json');bs=data('kubejs/assets/f_rank_days/blockstates/'+item+'.json');ck('cutout altar model and state '+item,b['render_type']=='minecraft:cutout' and len(b['elements'])==3 and m['parent']=='f_rank_days:block/'+item and bs['variants']['']['model']=='f_rank_days:block/'+item)
 else:ck('item model exact bound texture '+item,m['textures']['layer0']=='f_rank_days:item/'+item)
catalog={};arts=set()
for file in ['simplyswords-forge-1.56.0-1.20.1.jar','bettercombat-forge-1.9.0+1.20.1.jar']:
 mod=zipfile.ZipFile(LIVE/'mods'/file)
 for n in mod.namelist():
  if n.startswith('assets/') and n.endswith('.json'):arts.add(n)
  if n.startswith('data/') and '/weapon_attributes/' in n and n.endswith('.json'):
   prefix,tail=n[5:].split('/weapon_attributes/');catalog[prefix+':'+tail[:-5]]=json.loads(mod.read(n))
def follow(key,seen=None):
 seen=set() if seen is None else seen;assert key not in seen,'inheritance cycle';seen.add(key);d=catalog[key];out=follow(d['parent'],seen) if 'parent' in d else {};out.update(d.get('attributes',{}));return out
for item,parent in report['weaponParents'].items():
 d=data('kubejs/data/f_rank_days/weapon_attributes/'+item+'.json');ck('existing motion parent '+item,d['parent']==parent and parent in catalog);attrs=follow(parent)
 for a in attrs.get('attacks',[]):
  ns,pth=a['animation'].split(':');ck('referenced actual animation '+item+' '+a['animation'],'assets/'+ns+'/attack_animations/'+pth+'.json' in arts)
ck('all13 boss gear explicit gold borders',all('"f_rank_days:'+r['id'].split(':')[1]+'"' in (P/'config/itemborders-common.toml').read_text(encoding='utf8') for r in report['records'][6:19]))
native=data('modpack_manifest_1.20.1_forge.json');original=json.loads((LIVE/'modpack_manifest_1.20.1_forge.json').read_text(encoding='utf8'))
ck('all prior pinned mods preserved',native['pinned_required_mods'][:len(original['pinned_required_mods'])]==original['pinned_required_mods'])
for row in mods['mods']:
 jar=zipfile.ZipFile(P/'mods'/row['file']);meta=tomllib.loads(jar.read('META-INF/mods.toml').decode());ck('pinned official Forge artifact '+row['mod_id'],jar.testzip() is None and sha((P/'mods'/row['file']).read_bytes())==row['sha256'] and meta['mods'][0]['modId']==row['mod_id'] and meta['license']=='MIT')
ck('native modded bar exact actual setting',(P/'config/vitral_bossbars.properties').read_text(encoding='utf8').splitlines()[-1]=='modded_bosses=own_animated')
lang=data('kubejs/assets/fcraft_raid/lang/ko_kr.json');ck('all21 Korean registry translations additive',all(('block.' if r['kind']=='block' else 'item.')+'f_rank_days.'+r['id'].split(':')[1] in lang for r in report['records']))
ck('old two language members preserved',all(z.read(n)==old.read(n) for n in old.namelist() if '/lang/' in n))
localeproof=json.loads((ROOT/'검증/sanctum_locale_v104.json').read_text('utf-8'));ck('all551 previous entries unchanged by two dimension locale additions',localeproof['priorMembers']==551 and all(sha(z.read(n))==h for n,h in localeproof['oldEntrySHA256'].items()))
for locale in ['ko_kr','en_us']:
 rel='assets/fcraft_v104_locale/lang/'+locale+'.json';raw=(P/'kubejs'/rel).read_bytes();values=json.loads(raw);ck('one exact named sanctum translation additive '+locale,raw==z.read(rel) and list(values)==['travelerstitles.f_rank_days.guardian_sanctum'] and values['travelerstitles.f_rank_days.guardian_sanctum'] not in ['???',''])
aliasproof=json.loads((ROOT/'검증/forge_icon_alias_v104.json').read_text('utf-8'));ck('all553 previous entries unchanged by exact forge alias addition',aliasproof['priorMembers']==553 and all(sha(z.read(n))==h for n,h in aliasproof['oldEntrySHA256'].items()))
ck('forge button resource reuses exact existing professional anvil PNG bytes',z.read(forgealias)==z.read('assets/f_rank_days/textures/gui/npc_dialog/job_blacksmith.png')==(P/'kubejs'/forgealias).read_bytes() and sha(z.read(forgealias))==aliasproof['alias']['sha256'])
result={'passed':True,'actualMinecraft':False,'javaExecuted':False,'checks':checks};(ROOT/'검증/client_raid_asset_tests.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'passed':True,'checks':len(checks),'actualMinecraft':False}))
