"""Keep the existing FTB IDs/layout while publishing production E/D/C objectives."""
from pathlib import Path
import copy, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
CHAPTER = 'config/ftbquests/quests/chapters/02_my_job_promotions.snbt'
def main():
 src=ROOT/'수정파일'/CHAPTER
 before=json.loads(src.read_text(encoding='utf-8-sig'));after=copy.deepcopy(before)
 script=(ROOT/'수정파일/kubejs/server_scripts/38_unified_practical_promotions_phase4.js').read_text(encoding='utf-8-sig')
 specs=json.loads(script.split('var SPECS=',1)[1].split(';',1)[0]);by={q['id']:q for q in after['quests']}
 changed=[]
 for sp in specs:
  if sp['grade'] not in ['E','D','C']:continue
  q=by[sp['quest']];description=q['description'];start=description.index('')+1
  reward=next(i for i in range(start,len(description)) if '공인 봉랍 자격증' in description[i])
  assert isinstance(sp['instructions'],list) and sp['instructions']
  q['description']=description[:start]+sp['instructions']+description[reward:]
  if sp['proctor']=='sia':
   q['description'][:2]=['&e[📍 찾아갈 인물]&r 낚시꾼 시아 (부재 시 고리)', '&e[🏛 건물 및 위치]&r 중앙 분수대 기준 &a북문 해안 선착장&r (X:+14.5, Z:-78.5)']
   q['description'][-1]=q['description'][-1].replace('/fcraft_nav gori','/fcraft_nav sia')
   q['subtitle']='📍 담당: 낚시꾼 시아 · 북문 해안 선착장 (부재 시 고리)'
  changed.append(q['id'])
 assert len(changed)==36
 # Except for objective prose and the changed angler mentor, every contract is identical.
 clean=copy.deepcopy(after)
 for q in clean['quests']:
  old=next(x for x in before['quests'] if x['id']==q['id'])
  for k in ['description','subtitle']:
   if k in old:q[k]=old[k]
 assert clean==before
 src.write_text(json.dumps(after,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 result={'passed':True,'actualMinecraft':False,'updatedEDC':len(changed),'questCount':len(after['quests']), 'allIdsTasksRewardsDependenciesCoordinatesPreserved':True,'BASUnchanged':True,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()}
 (ROOT/'검증/v11_0_quest_objective_text.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':main()
