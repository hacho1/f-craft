// 《F급의 나날》 KubeJS 6 Startup Script - v8.2 Blocks, Ores, Boss Altar, Weapons, Hammer(30 uses), 3-Tier Coins, Foods & Newspaper
// 파일 경로: kubejs/startup_scripts/01_register_v8_content.js
// 주의: 기존 00_register_items.js 의 자격증·길드 등록증·퀘스트 아이템 14종은 그대로 보존하며, 신규 블록·아이템만 비파괴 확장 등록합니다.

StartupEvents.registry('block', function (event) {
  // 1. 마력석 광석 (임시 명칭 — 일반/심층 암석층 Y=-48~56, 돌 곡괭이 이상 채굴)
  event
    .create('f_rank_days:mana_stone_ore')
    .defaultCutout()
    .displayName('마력석 광석')
    .soundType('stone')
    .hardness(3.0)
    .resistance(3.0)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBlock('minecraft:needs_stone_tool');

  // 2. 심층암 마력석 광석
  event
    .create('f_rank_days:deepslate_mana_stone_ore')
    .defaultCutout()
    .displayName('심층암 마력석 광석')
    .soundType('deepslate')
    .hardness(4.5)
    .resistance(3.5)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBlock('minecraft:needs_stone_tool');

  // 3. 경화광 광석 (임시 명칭 — 지하 암석층 Y=-60~40, 철 곡괭이 이상 채굴)
  event
    .create('f_rank_days:hardened_ore')
    .defaultCutout()
    .displayName('경화광 광석')
    .soundType('stone')
    .hardness(3.5)
    .resistance(4.0)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBlock('minecraft:needs_iron_tool');

  // 4. 심층암 경화광 광석
  event
    .create('f_rank_days:deepslate_hardened_ore')
    .defaultCutout()
    .displayName('심층암 경화광 광석')
    .soundType('deepslate')
    .hardness(5.0)
    .resistance(4.5)
    .requiresTool(true)
    .tagBlock('minecraft:mineable/pickaxe')
    .tagBlock('minecraft:needs_iron_tool');

  // 5. 지정 보스 재소환 전용 제단 코어 (파괴 불가 보호 블록 — 강철 수호자의 시련 제단)
  event
    .create('f_rank_days:wrought_trial_altar')
    .defaultCutout()
    .displayName('강철 수호자의 시련 제단')
    .soundType('Lodestone')
    .hardness(-1.0)
    .resistance(3600000.0)
    .lightLevel(0.8);
});

StartupEvents.registry('item', function (event) {
  // =========================================================================
  // A. 광물 원석 · 정제 재료 · 무기 강화 재료 · 휴대용 강화망치(30회)
  // =========================================================================
  event
    .create('f_rank_days:raw_mana_crystal')
    .texture('f_rank_days:item/raw_mana_crystal')
    .displayName('거친 마력석 원석')
    .tooltip('마력석 광석에서 채굴한 미정제 결정입니다. 화로나 용광로에서 정제할 수 있습니다.');

  event
    .create('f_rank_days:refined_mana_stone')
    .texture('f_rank_days:item/refined_mana_stone')
    .displayName('정제된 마력석')
    .tooltip('불순물을 제거한 마력 결정입니다. 중급 이상 무기 강화 및 연금·마력 장비 제작에 쓰입니다.')
    .rarity('uncommon');

  event
    .create('f_rank_days:raw_hardened_ore')
    .texture('f_rank_days:item/raw_hardened_ore')
    .displayName('거친 경화광 원석')
    .tooltip('단단한 금속 결을 품은 원석입니다. 제련하면 경화 강괴를 얻습니다.');

  event
    .create('f_rank_days:hardened_ingot')
    .texture('f_rank_days:item/hardened_ingot')
    .displayName('경화 강괴')
    .tooltip('나우의 대장간에서 단련석, 강화망치, 중장비를 벼리는 핵심 금속 재료입니다.');

  event
    .create('f_rank_days:tempering_stone')
    .texture('f_rank_days:item/tempering_stone')
    .displayName('무기 단련석')
    .tooltip('+0 ~ +39 구간 무기를 강화할 때 사용하는 기본 강화 재료입니다.');

  event
    .create('f_rank_days:high_tempering_core')
    .texture('f_rank_days:item/high_tempering_core')
    .displayName('고순도 마력 단련핵')
    .tooltip('경화 강괴와 정제된 마력석을 응축한 고급 강화 재료(+40 ~ +99 구간)입니다.')
    .rarity('rare')
    .glow(true);

  event
    .create('f_rank_days:enhancement_hammer')
    .texture('f_rank_days:item/enhancement_hammer')
    .displayName('휴대용 단련 강화망치')
    .maxStackSize(1)
    .maxDamage(30)
    .rarity('uncommon')
    .tooltip('휴대용 기본 강화 도구(총 30회 사용) · 왼손(보조손)에 이 망치를 들고 오른손에 강화할 무기를 든 채 사용(/frank weapon enhance hammer 또는 망치 우클릭)합니다. 성공·실패 모두 내구도가 1 감소합니다.');

  // =========================================================================
  // A-2. 아르베른 3단 화폐 아이템 (1골드 = 100실버 = 1,000동화 / 1실버 = 10동화)
  // =========================================================================
  event
    .create('f_rank_days:copper_coin')
    .texture('f_rank_days:item/copper_coin')
    .displayName('아르베른 동화')
    .maxStackSize(64)
    .tooltip('기본 화폐 (10동화 = 1실버 · 1,000동화 = 1골드). 우클릭하면 플레이어 화폐 지갑에 즉시 입금됩니다.');

  event
    .create('f_rank_days:silver_coin')
    .texture('f_rank_days:item/silver_coin')
    .displayName('아르베른 실버 은화')
    .maxStackSize(64)
    .rarity('uncommon')
    .tooltip('중간 화폐 (1실버 = 10동화 · 100실버 = 1골드). 우클릭하면 플레이어 화폐 지갑에 즉시 입금됩니다.');

  event
    .create('f_rank_days:gold_coin')
    .texture('f_rank_days:item/gold_coin')
    .displayName('아르베른 골드 금화')
    .maxStackSize(64)
    .rarity('rare')
    .glow(true)
    .tooltip('고액 화폐 (1골드 = 100실버 = 1,000동화). 우클릭하면 플레이어 화폐 지갑에 즉시 입금됩니다.');

  // =========================================================================
  // B. 전용 무기화 나뭇가지 & 6대 무기 계열 확장 무기 (12종)
  // =========================================================================
  event
    .create('f_rank_days:battle_twig', 'sword')
    .tier('wood')
    .attackDamageBaseline(2.0)
    .speedBaseline(-2.2)
    .maxDamage(120)
    .texture('f_rank_days:item/battle_twig')
    .displayName('단련용 나뭇가지')
    .tooltip('둔기 계열(blunt) · 일반 제작 재료로 소모되지 않도록 분리된 전투·강화 전용 나뭇가지입니다. 최대 +99 강화 및 둔기 계승 가능.');

  event
    .create('f_rank_days:oak_club', 'sword')
    .tier('wood')
    .attackDamageBaseline(3.5)
    .speedBaseline(-2.6)
    .maxDamage(180)
    .texture('f_rank_days:item/oak_club')
    .displayName('참나무 몽둥이')
    .tooltip('둔기 계열(blunt) · 묵직한 참나무 통나무를 깎아 만든 초반 둔기입니다.');

  event
    .create('f_rank_days:iron_mace', 'sword')
    .tier('iron')
    .attackDamageBaseline(5.5)
    .speedBaseline(-2.7)
    .maxDamage(320)
    .texture('f_rank_days:item/iron_mace')
    .displayName('강철 철퇴')
    .tooltip('둔기 계열(blunt) · 갑주 마물을 상대하기 좋은 강철 철퇴입니다. 강화된 나뭇가지의 수치를 계승받을 수 있습니다.');

  event
    .create('f_rank_days:hardened_warhammer', 'sword')
    .tier('diamond')
    .attackDamageBaseline(7.0)
    .speedBaseline(-2.9)
    .maxDamage(580)
    .texture('f_rank_days:item/hardened_warhammer')
    .displayName('경화광 전투망치')
    .tooltip('둔기 계열(blunt) · 경화 강괴와 고대 철기 파편으로 단조한 중전투 망치입니다.')
    .rarity('uncommon');

  event
    .create('f_rank_days:wooden_spear', 'sword')
    .tier('wood')
    .attackDamageBaseline(3.0)
    .speedBaseline(-2.5)
    .maxDamage(150)
    .texture('f_rank_days:item/wooden_spear')
    .displayName('훈련용 나무 창')
    .tooltip('창 계열(spear) · 긴 사거리를 연습하기 좋은 목제 장창입니다.');

  event
    .create('f_rank_days:stone_spear', 'sword')
    .tier('stone')
    .attackDamageBaseline(4.0)
    .speedBaseline(-2.5)
    .maxDamage(220)
    .texture('f_rank_days:item/stone_spear')
    .displayName('석제 장창')
    .tooltip('창 계열(spear) · 뾰족한 석재 창날을 결합한 실전 장창입니다.');

  event
    .create('f_rank_days:iron_spear', 'sword')
    .tier('iron')
    .attackDamageBaseline(5.0)
    .speedBaseline(-2.4)
    .maxDamage(360)
    .texture('f_rank_days:item/iron_spear')
    .displayName('강철 장창')
    .tooltip('창 계열(spear) · 마물과의 거리를 유지하며 찌르기 좋은 표준 장창입니다.');

  event
    .create('f_rank_days:diamond_spear', 'sword')
    .tier('diamond')
    .attackDamageBaseline(6.5)
    .speedBaseline(-2.4)
    .maxDamage(1561)
    .texture('f_rank_days:item/diamond_spear')
    .displayName('다이아몬드 장창')
    .tooltip('창 계열(spear) · 뛰어난 관통력과 내구도를 지닌 상급 장창입니다.');

  event
    .create('f_rank_days:flint_dagger', 'sword')
    .tier('stone')
    .attackDamageBaseline(2.5)
    .speedBaseline(-1.8)
    .maxDamage(160)
    .texture('f_rank_days:item/flint_dagger')
    .displayName('부싯돌 단검')
    .tooltip('단검 계열(dagger) · 빠르고 가벼운 근접 연타용 단검입니다.');

  event
    .create('f_rank_days:iron_dagger', 'sword')
    .tier('iron')
    .attackDamageBaseline(3.5)
    .speedBaseline(-1.8)
    .maxDamage(280)
    .texture('f_rank_days:item/iron_dagger')
    .displayName('강철 단검')
    .tooltip('단검 계열(dagger) · 패링 후 빠른 반격에 유리한 균형 잡힌 단검입니다.');

  event
    .create('f_rank_days:mana_dagger', 'sword')
    .tier('diamond')
    .attackDamageBaseline(4.5)
    .speedBaseline(-1.7)
    .maxDamage(480)
    .texture('f_rank_days:item/mana_dagger')
    .displayName('마력석 단검')
    .tooltip('단검 계열(dagger) · 정제된 마력석을 새겨 넣은 민첩한 마력 단검입니다.')
    .rarity('uncommon');

  event
    .create('f_rank_days:composite_longbow', 'bow')
    .maxDamage(460)
    .texture('f_rank_days:item/composite_longbow')
    .displayName('브리온 합성 장궁')
    .tooltip('활 계열(bow) · 경화 강괴 림으로 장력을 보강한 원거리 사냥용 장궁입니다.');

  // =========================================================================
  // C. 음식·요리 확장 (6종 — Farmer's Delight / 마을 경제·선물 연동, 과도한 버프 제한)
  // =========================================================================
  event
    .create('f_rank_days:brion_barley_bread')
    .texture('f_rank_days:item/brion_barley_bread')
    .displayName('브리온 농가 보리빵')
    .tooltip('일반 농부 음식 · 다림의 농장 밀로 담백하게 구운 든든한 주식입니다.')
    .food(function (food) {
      food.hunger(6).saturation(0.6);
    });

  event
    .create('f_rank_days:hearth_potato_soup')
    .texture('f_rank_days:item/hearth_potato_soup')
    .displayName('화톳불 감자 수프')
    .tooltip('여관 식사 · 고리의 여관에서 내어 주는 따뜻한 감자 버섯 수프입니다. (짧은 재생 I 5초)')
    .maxStackSize(16)
    .food(function (food) {
      food.hunger(8).saturation(0.7).effect('minecraft:regeneration', 100, 0, 1.0);
    });

  event
    .create('f_rank_days:serdin_herb_ration')
    .texture('f_rank_days:item/serdin_herb_ration')
    .displayName('세르딘 약초 휴대식')
    .tooltip('모험용 휴대식 · 숲 탐색 중 빠르게 먹기 좋은 약초 건빵입니다. (이동속도 I 12초)')
    .food(function (food) {
      food.hunger(7).saturation(0.75).fastToEat().effect('minecraft:speed', 240, 0, 1.0);
    });

  event
    .create('f_rank_days:golden_wheat_stew')
    .texture('f_rank_days:item/golden_wheat_stew')
    .displayName('황금밀 보양 스튜')
    .tooltip('희귀 식재료 요리 · 보스전 직전에 먹기 좋은 특제 보양식입니다. (흡수 I 20초, 연속 중첩 제한)')
    .maxStackSize(8)
    .rarity('uncommon')
    .food(function (food) {
      food.hunger(10).saturation(0.8).effect('minecraft:absorption', 400, 0, 1.0);
    });

  event
    .create('f_rank_days:harvest_berry_tart')
    .texture('f_rank_days:item/harvest_berry_tart')
    .displayName('수확제 산딸기 타르트')
    .tooltip('축제 음식 · 달콤한 산딸기를 듬뿍 올린 브리온 마을 축제 디저트입니다. 주민 선물용으로 인기가 높습니다.')
    .food(function (food) {
      food.hunger(7).saturation(0.65);
    });

  event
    .create('f_rank_days:alchemist_clear_tea')
    .texture('f_rank_days:item/alchemist_clear_tea')
    .displayName('로만식 맑은 약초차')
    .tooltip('연금 허브 음료 · 머리를 맑게 해 주는 은방울꽃·민들레 블렌드 차입니다.')
    .maxStackSize(16)
    .useAnimation('drink')
    .food(function (food) {
      food.hunger(3).saturation(0.5).alwaysEdible();
    });

  // =========================================================================
  // D. 보스 토벌 전리품·지정 제단 공명패 및 《브리온 일보》 신문 아이템
  // =========================================================================
  event
    .create('f_rank_days:wrought_relic_shard')
    .texture('f_rank_days:item/wrought_relic_shard')
    .displayName('고대 철기 수호자 파편')
    .tooltip('강철 수호자(Ferrous Wroughtnaut) 토벌 시 획득하는 육중한 고대 합금 파편입니다.')
    .rarity('uncommon');

  event
    .create('f_rank_days:wrought_challenge_sigil')
    .texture('f_rank_days:item/wrought_challenge_sigil')
    .displayName('고대 철기 재도전 공명패')
    .tooltip('최초 토벌 완료 후 지정된 [강철 수호자의 시련 제단 (X:168, Y:68, Z:168)] 코어 블록에 직접 우클릭해야만 보스를 재소환할 수 있습니다.')
    .maxStackSize(16)
    .rarity('rare')
    .glow(true);

  event
    .create('f_rank_days:brion_daily_newspaper')
    .texture('f_rank_days:item/brion_daily_newspaper')
    .displayName('《브리온 일보》')
    .tooltip('전날의 사건·사망 구조 기록·신규 승급자·보스 토벌 호외·마을 소식을 담은 일간 신문입니다. 우클릭하여 열람합니다.')
    .maxStackSize(1)
    .rarity('uncommon');
});
