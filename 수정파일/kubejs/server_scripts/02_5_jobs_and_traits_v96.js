// Public catalog; existing registry names and canonical job_licenses records are retained.
global.FRankDays=global.FRankDays||{};
(function(F){
 var N='f_rank_days:';
 function kit(a){var r=[];for(var i=0;i<a.length;i++)r.push({id:a[i][0],count:a[i][1],nbt:a[i][2]||null});return r;}
 var jobs=[
 ['swordsman','검사','combat',['ski'],'근접 패링과 수련, 전초기지 토벌로 성장합니다.',[['minecraft:stone_sword',1],['minecraft:shield',1],['minecraft:bread',4]]],
 ['ranger','레인저','combat',['harin'],'활과 쇠뇌로 숲을 정찰하고 마물을 견제합니다.',[['minecraft:bow',1],['minecraft:arrow',32],['minecraft:leather_boots',1],['minecraft:bread',4]]],
 ['berserker','도끼전사','combat',['nau','ski'],'전투 도끼로 적의 방어를 무너뜨리고 주변 마물을 제압합니다.',[['minecraft:stone_axe',1],['minecraft:leather_chestplate',1],['minecraft:bread',4]]],
 ['healer','치유사','combat',['hwiyeon'],'응급 처치와 정화로 자신과 동료의 생존을 돕습니다.',[[N+'herb_bandage',2],['minecraft:potion',2,{Potion:'minecraft:healing'}],[N+'hearth_potato_soup',2]]],
 ['farmer','농부','life',['darim'],'경작과 수확, 작물 판매와 농업 시험으로 성장합니다.',[['minecraft:stone_hoe',1],['minecraft:wheat_seeds',12],['minecraft:bone_meal',6],['minecraft:bread',4]]],
 ['herbalist','약초채집가','life',['roman'],'야생 약초와 버섯을 채집하고 물약을 조제합니다.',[['minecraft:shears',1],['minecraft:glass_bottle',6],['minecraft:dandelion',3],['minecraft:bread',4]]],
 ['angler','낚시꾼','life',['gori','bambam'],'해안과 수로에서 어획하고 수산물을 납품합니다.',[['minecraft:fishing_rod',1],['minecraft:sweet_berries',8],['minecraft:barrel',1],['minecraft:bread',4]]],
 ['chef','요리사','life',['gori'],'음식을 조리하고 여관에 특선을 납품합니다.',[['farmersdelight:flint_knife',1],['farmersdelight:skillet',1],['minecraft:potato',4],['minecraft:bread',2]]],
 ['blacksmith','대장장이','life',['nau'],'광석을 제련하고 장비를 단련·수리합니다.',[['minecraft:stone_pickaxe',1],[N+'tempering_stone',2],['minecraft:coal',8],['minecraft:bread',4]]],
 ['relic_researcher','유적연구원','exploration',['hyeophap'],'고대 비석을 탁본하고 폐허의 기록을 조사합니다.',[['minecraft:paper',12],['minecraft:brush',1],[N+'ancient_rune_staff',1],['minecraft:bread',4]]],
 ['prospector','광부','exploration',['nau','hyeophap'],'지하 광맥과 마력석·경화광을 탐사합니다.',[['minecraft:iron_pickaxe',1],['minecraft:torch',24],['minecraft:bread',4]]],
 ['pathfinder','정찰가','exploration',['harin','bambam'],'비경과 은닉처를 찾고 교역로를 기록합니다.',[['comforts:sleeping_bag_white',1],['minecraft:compass',1],['minecraft:bread',6]]]
 ];
 F.JOB_CATALOG_V96=[];F.JOB_BY_ID_V96={};F.ALL_JOBS=[];
 var mentors={ski:'스키 · 검술 훈련장',harin:'하린 · 세르딘 숲 거점',roman:'로만 · 물약상',hwiyeon:'휘연 · 의료소',darim:'다림 · 농장과 농업 실습장',gori:'고리 · 화톳불 여관',nau:'나우 · 대장간',hyeophap:'협합 · 유물 창고',bambam:'밤밤 · 행상 거점'};
 for(var i=0;i<jobs.length;i++){var a=jobs[i],o={id:a[0],label:a[1],category:a[2],npcs:a[3],mentor_labels:[],description:a[4],kit:kit(a[5])};for(var m=0;m<o.npcs.length;m++)o.mentor_labels.push(mentors[o.npcs[m]]);F.JOB_CATALOG_V96.push(o);F.JOB_BY_ID_V96[o.id]=o;F.JOB_LABELS[o.id]=o.label;F.ALL_JOBS.push(o.id);}
 F.ALL_JOBS.push('alchemist');F.ALL_JOBS.push('mage');F.JOB_ALIASES_V96={alchemist:'herbalist',mage:'relic_researcher'};

 var roles={swordsman:['한손검·장검','패링과 검기로 전선을 지키는 근접 딜러','연속 베기','일섬 검기파'],berserker:['전투 도끼·배틀액스','방어를 무너뜨리는 중전사','대지 분쇄','휠윈드'],ranger:['활·쇠뇌','거리를 유지하는 원거리 기동 딜러','백스텝 연사','관통 화살비'],healer:['메이스·약초 붕대','자신과 동료를 지키는 치유 지원가','치유의 물결','수호의 성역'],farmer:['대낫·개량 괭이','광역 수확 베기와 덩굴로 적을 묶는 홀더','만월 수확 베기','가시 덩굴 속박'],herbalist:['단검·투척 약병','약초와 영약을 활용하는 독·가속 버퍼','맹독 포자 안개','전장의 영약 분사'],angler:['낚싯대·삼지창','적을 끌어오고 밀어내는 제어 딜러','심해의 작살 끌기','해일 후려치기'],chef:['무쇠 프라이팬·식칼','타격과 야전 식사로 돕는 서포터','플람베 기절 강타','야전 만찬'],blacksmith:['전투망치','담금질과 망치로 버티는 중장갑 전사','용암 모루 찍기','적열 담금질'],relic_researcher:['고대 룬 지팡이','각인과 룬 탄환을 사용하는 유물 연구가','고대 중력 각인','고대 마력포'],prospector:['전투 곡괭이','광물의 힘과 경화 외피를 사용하는 브루저','마력석 지진파','경화광 외피'],pathfinder:['쌍단검','기습과 연막을 활용하는 정찰가','그림자 밟기','연막 섬광탄']};
 for(var ri=0;ri<F.JOB_CATALOG_V96.length;ri++){var entry=F.JOB_CATALOG_V96[ri],role=roles[entry.id];entry.weapon_label=role[0];entry.combat_role=role[1];entry.mana_skills=[{slot:'X',label:role[2]},{slot:'C',label:role[3]}];entry.combat_skill_concepts=role[2]+' · '+role[3];entry.skills_preview='X '+role[2]+' / C '+role[3];entry.skill_preview=entry.skills_preview;}
 F.JOB_CATALOG_V98=F.JOB_CATALOG_V96;
 var ts=[
 ['overheated_sprint','과열 각력','이동 속도 +18%','질주 피로도 소모 1.6배','음식과 휴식으로 허기를 관리하세요.'],
 ['reckless_might','유리몸 괴력','근접 공격 +15%, 채굴 성급함','도구 내구도 소모 2배, 받는 피해 +10%','수리와 패링을 함께 익히세요.'],
 ['frail_artisan','약골 장인','성숙 작물·약초·광석·낚시 수확 20% 추가 1개','최대 체력 -4 HP','황금밀 보양 스튜로 몸을 보완하세요.'],
 ['nocturnal_eyes','야행성 동공','밤·밝기7 이하 야간시야와 공격 +12%','맑은 낮 직사광선, 맨머리일 때 이속·공속 -10%','하린의 모자나 투구를 착용하세요.'],
 ['leaky_mana','마력 누수 체질','전 직종 마나 스킬 피해·회복 +25%, 재사용 시간 -20%','마나 소모 +25%, 발동마다 허기 피로도 2.0','맑은 약초차로 마나를 보충하세요.'],
 ['jumpy_instinct','겁쟁이의 육감','구르기 직후 신속II 2초, 패링 반격 보너스 +50%','8m 이내 적대4마리 이상이면 받는 피해 +15%','적을 나눠 상대하고 탈출로를 확보하세요.'],
 ['heavy_bones','납덩이 골격','최대 체력 +4 HP, 넉백 저항 +40%','이동 -8%, 수중 이동 추가 둔화','육상에서 방패와 함께 싸우세요.'],
 ['tunnel_vision','터널 시야','5m 이상 원거리 명중 피해 +22%','3m 이내 적에게 받는 피해 +20%','적과의 거리를 유지하세요.'],
 ['picky_gourmet','편식하는 미식가','조리 특식 포만감 +35%, 재생I 30초','날음식·야생 열매 회복량 반감, 허기I 8초','고리의 조리 음식을 준비하세요.'],
 ['hoarder_greed','욕심쟁이 수집가','처치·조사·낚시 25% 확률 2~5동화','기본36칸 빈칸6 이하이면 이동 -12%','지갑에 입금하고 전문 상점에 판매하세요.']
 ];
 F.TRAIT_CATALOG_V96=[];F.F_RANK_TRAITS_V95={};
 for(var j=0;j<ts.length;j++){var t=ts[j],tr={id:t[0],label:t[1],name:t[1],buff:t[2],debuff:t[3],tip:t[4],grade:'F',implemented:true};F.F_RANK_TRAITS_V95[tr.id]=tr;F.TRAIT_CATALOG_V96.push(tr);F.STARTER_ABILITIES[tr.id]=tr;}
 F.LEGACY_TRAITS_V96={seed_sense:'frail_artisan',steady_breath:'jumpy_instinct',keen_appraisal:'hoarder_greed',warm_palm:'picky_gourmet'};
 F.getSelectableAbilities=function(){return F.TRAIT_CATALOG_V96.slice();};
})(global.FRankDays);
