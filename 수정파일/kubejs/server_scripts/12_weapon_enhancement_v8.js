// 《F급의 나날》 KubeJS 6 Server Script - v8.1 Weapon Classification, +99 3-Method Enhancement (Anvil / Nau +5%p / Hammer 30-use) & Safe GUI Inheritance
// 파일 경로: kubejs/server_scripts/12_weapon_enhancement_v8.js
// 핵심 반영 사항:
// 1. 강화 성공률 확정값 적용: 모루(ANVIL)·강화망치(HAMMER) = 95 / 90 / 80 / 70 / 65 / 60%, 나우(NAU) = 전 구간 +5%p (100 / 95 / 85 / 75 / 70 / 65%)
//    - config/f_rank_days/weapon_enhancement_config.json 과 서버 기본 상수를 1:1 일치화 및 자동 대조 검증기 포함
// 2. 강화 수단 3원화:
//    - 모루(ANVIL): 기본 강화 전용 (웅크리기+모루 우클릭 또는 모루 근처 /frank weapon enhance anvil, 계승 불가)
//    - 나우(NAU): 숙련 강화(+5%p) 및 안전 강화 계승 전용 (나우 대화창 버튼 / 나우 근처 명령어)
//    - 강화망치(HAMMER): 휴대용 기본 강화 도구(총 30회 내구도, 성공 시와 실패 시 모두 내구도 1 감소, 사전 검증 실패 시 미차감, 30회 소진 시 파손)
// 3. 안전한 슬롯 분리형 강화 계승 GUI(openSafeInheritanceGuiV8 / executeSafeInheritanceFromGuiV8):
//    - 왼손·오른손 맞바꾸기(F키) 실수로 인한 오소멸 위험을 제거하기 위해 원본(빨간 소멸 슬롯, +3 이상)과 대상(파란 보존 슬롯, 동일 계열 +0)을
//      명확히 분리 선택하고 2단계 동의 잠금을 거치는 전용 GUI 우선 구조로 개편 (동일 계열만 80% 보존 계승, 원본 소비, 인챈트·내구도 보존)
// 4. 수수료는 3단 화폐(1골드 = 100실버 = 1,000동화) 결제 엔진(chargePlayerCurrencyV8)과 직결!

global.FRankDays = global.FRankDays || {};

global.FRankDays.DEFAULT_ENHANCE_CONFIG_V8 = {
  schema_version: '8.1.0',
  balance_status: 'CONFIRMED_RATES_APPLIED (모루·강화망치 95/90/80/70/65/60% 확정값 + 나우 전 구간 +5%p 적용)',
  hard_rules: {
    min_level: 0,
    max_level: 99,
    on_success_delta: 1,
    on_failure_delta: -1,
    destroy_on_failure: false,
    inheritance_divisor: 3, // retained legacy metadata; the ratio below is authoritative
    inheritance_ratio: 0.80,
    inheritance_higher_tier_only: true,
    inheritance_rounding: 'floor',
    inheritance_same_family_only: true,
    inheritance_target_must_be_plus_zero: true,
    inheritance_consumes_source_weapon: true,
    inheritance_requires_nau_gui: true
  },
  enhancement_methods: {
    ANVIL: {
      label: '모루 기본 강화',
      allows_enhancement: true,
      allows_inheritance: false,
      bonus_rate_pp: 0.0,
      consumes_hammer_durability: false
    },
    NAU: {
      label: '대장장이 나우 숙련 강화·계승',
      allows_enhancement: true,
      allows_inheritance: true,
      bonus_rate_pp: 0.05,
      consumes_hammer_durability: false
    },
    HAMMER: {
      label: '휴대용 단련 강화망치 (30회)',
      item_id: 'f_rank_days:enhancement_hammer',
      allows_enhancement: true,
      allows_inheritance: false,
      bonus_rate_pp: 0.0,
      max_uses: 30,
      consume_durability_on_success: true,
      consume_durability_on_failure: true,
      consume_durability_on_invalid_attempt: false
    }
  },
  probability_and_cost_brackets: [
    { min_lv: 0, max_lv: 9, base_success_rate: 0.95, nau_success_rate: 1.00, fee_copper: 20, fee_display: '2실버 (20동화)', materials: [{ id: 'f_rank_days:tempering_stone', count: 1 }], dmg_per_lv: 0.35, spd_per_lv: 0.002 },
    { min_lv: 10, max_lv: 19, base_success_rate: 0.90, nau_success_rate: 0.95, fee_copper: 50, fee_display: '5실버 (50동화)', materials: [{ id: 'f_rank_days:tempering_stone', count: 2 }], dmg_per_lv: 0.30, spd_per_lv: 0.002 },
    { min_lv: 20, max_lv: 39, base_success_rate: 0.80, nau_success_rate: 0.85, fee_copper: 120, fee_display: '12실버 (120동화)', materials: [{ id: 'f_rank_days:tempering_stone', count: 2 }, { id: 'f_rank_days:refined_mana_stone', count: 1 }], dmg_per_lv: 0.15, spd_per_lv: 0.0015 },
    { min_lv: 40, max_lv: 59, base_success_rate: 0.70, nau_success_rate: 0.75, fee_copper: 300, fee_display: '30실버 (300동화)', materials: [{ id: 'f_rank_days:high_tempering_core', count: 1 }], dmg_per_lv: 0.12, spd_per_lv: 0.001 },
    { min_lv: 60, max_lv: 79, base_success_rate: 0.65, nau_success_rate: 0.70, fee_copper: 600, fee_display: '60실버 (600동화)', materials: [{ id: 'f_rank_days:high_tempering_core', count: 2 }], dmg_per_lv: 0.10, spd_per_lv: 0.001 },
    { min_lv: 80, max_lv: 98, base_success_rate: 0.60, nau_success_rate: 0.65, fee_copper: 1000, fee_display: '1골드 (1,000동화)', materials: [{ id: 'f_rank_days:high_tempering_core', count: 3 }], dmg_per_lv: 0.08, spd_per_lv: 0.001 }
  ],
  inheritance_fee_formula: {
    base_fee_copper: 100,
    per_inherited_level_copper: 15,
    max_fee_copper: 1000
  },
  chapter1_breakthroughs: { rare_find_multiplier: 1.15 },
  plus_99_capstone_bonus_damage: 1.20
};

global.FRankDays.VISUAL_TIERS_V8 = [
  { tier: 0, min: 0, max: 9, cmd: 0, suffix: 't0_base', label: '기본 외형' },
  { tier: 1, min: 10, max: 19, cmd: 8010, suffix: 't1_etched', label: '작은 문양·손잡이 장식' },
  { tier: 2, min: 20, max: 39, cmd: 8020, suffix: 't2_tempered', label: '강화 재질·금속 장식' },
  { tier: 3, min: 40, max: 59, cmd: 8040, suffix: 't3_mana_glow', label: '약한 마력 에너지 효과' },
  { tier: 4, min: 60, max: 79, cmd: 8060, suffix: 't4_special', label: '특수 무기 외형' },
  { tier: 5, min: 80, max: 98, cmd: 8080, suffix: 't5_legend', label: '전설급 무기 외형' },
  { tier: 6, min: 99, max: 99, cmd: 8099, suffix: 't6_mythic99', label: '+99 최종 초월 외형' }
];

(function initWeaponClassificationRegistry() {
  var w = {};
  function add(id, family, dmg, spd, rng, dur, mat, mode) {
    w[id] = {
      family: family,
      base_attack_damage: dmg,
      base_attack_speed: spd,
      attack_range: rng,
      max_durability: dur,
      material_group: mat,
      visual_model_mode: mode || 'cmd_2d',
      inheritance_tier: ({ wood: 1, gold: 2, golden: 2, flint: 3, stone: 3, iron: 4, hardened: 5, mana: 5, diamond: 6, netherite: 7, runic: 8 })[mat] || 0,
      is_field_tool: false
    };
  }
  add('minecraft:wooden_sword', 'sword', 4.0, -2.4, 2.6, 59, 'wood', 'cmd_2d');
  add('minecraft:stone_sword', 'sword', 5.0, -2.4, 2.6, 131, 'stone', 'cmd_2d');
  add('minecraft:iron_sword', 'sword', 6.0, -2.4, 2.6, 250, 'iron', 'cmd_2d');
  add('minecraft:golden_sword', 'sword', 4.0, -2.4, 2.6, 32, 'gold', 'cmd_2d');
  add('minecraft:diamond_sword', 'sword', 7.0, -2.4, 2.6, 1561, 'diamond', 'cmd_2d');
  add('minecraft:netherite_sword', 'sword', 8.0, -2.4, 2.6, 2031, 'netherite', 'cmd_2d');
  add('f_rank_days:rusty_companion_sword', 'sword', 4.5, -2.4, 2.6, 120, 'iron', 'base_only');

  add('minecraft:wooden_axe', 'axe', 7.0, -3.2, 2.5, 59, 'wood', 'cmd_2d');
  add('minecraft:stone_axe', 'axe', 9.0, -3.2, 2.5, 131, 'stone', 'cmd_2d');
  add('minecraft:iron_axe', 'axe', 9.0, -3.1, 2.5, 250, 'iron', 'cmd_2d');
  add('minecraft:golden_axe', 'axe', 7.0, -3.0, 2.5, 32, 'gold', 'cmd_2d');
  add('minecraft:diamond_axe', 'axe', 9.0, -3.0, 2.5, 1561, 'diamond', 'cmd_2d');
  add('minecraft:netherite_axe', 'axe', 10.0, -3.0, 2.5, 2031, 'netherite', 'cmd_2d');

  add('minecraft:trident', 'spear', 9.0, -2.9, 3.5, 250, 'diamond', 'vanilla_3d_trident');
  add('minecraft:bow', 'bow', 5.0, -2.0, 4.0, 384, 'wood', 'vanilla_bow');
  add('minecraft:crossbow', 'bow', 6.0, -2.2, 4.0, 465, 'iron', 'vanilla_bow');

  add('f_rank_days:battle_twig', 'blunt', 3.0, -2.2, 2.5, 120, 'wood', 'cmd_2d');
  add('f_rank_days:oak_club', 'blunt', 4.5, -2.6, 2.5, 180, 'wood', 'cmd_2d');
  add('f_rank_days:iron_mace', 'blunt', 6.5, -2.7, 2.6, 320, 'iron', 'cmd_2d');
  add('f_rank_days:hardened_warhammer', 'blunt', 8.0, -2.9, 2.8, 580, 'stone', 'cmd_2d');
  add('f_rank_days:wooden_spear', 'spear', 4.0, -2.5, 3.5, 150, 'wood', 'cmd_2d');
  add('f_rank_days:stone_spear', 'spear', 5.0, -2.5, 3.5, 220, 'stone', 'cmd_2d');
  add('f_rank_days:iron_spear', 'spear', 6.0, -2.4, 3.6, 360, 'iron', 'cmd_2d');
  add('f_rank_days:diamond_spear', 'spear', 7.5, -2.4, 3.7, 1561, 'diamond', 'cmd_2d');
  add('f_rank_days:flint_dagger', 'dagger', 3.5, -1.8, 2.1, 160, 'stone', 'cmd_2d');
  add('f_rank_days:iron_dagger', 'dagger', 4.5, -1.8, 2.1, 280, 'iron', 'cmd_2d');
  add('f_rank_days:mana_dagger', 'dagger', 5.5, -1.7, 2.2, 480, 'mana', 'cmd_2d');
  add('f_rank_days:composite_longbow', 'bow', 6.0, -2.0, 4.0, 460, 'wood', 'cmd_2d');

  var ssMats = [
    ['iron', 6.0, 250],
    ['gold', 5.0, 64],
    ['diamond', 7.0, 1561],
    ['netherite', 8.0, 2031],
    ['runic', 8.5, 2400]
  ];
  var ssTypes = [
    ['longsword', 'sword', 0.5, -2.4, 3.0],
    ['claymore', 'sword', 2.0, -2.8, 3.2],
    ['katana', 'sword', 0.0, -2.2, 2.8],
    ['rapier', 'sword', -0.5, -2.0, 2.9],
    ['cutlass', 'sword', 0.0, -2.3, 2.6],
    ['twinblade', 'sword', -0.5, -2.0, 2.7],
    ['spear', 'spear', 0.5, -2.5, 3.6],
    ['glaive', 'spear', 1.0, -2.6, 3.6],
    ['halberd', 'spear', 2.0, -2.9, 3.7],
    ['warglaive', 'spear', 0.5, -2.3, 3.2],
    ['greataxe', 'axe', 2.5, -3.1, 2.9],
    ['scythe', 'axe', 1.0, -2.7, 3.2],
    ['greathammer', 'blunt', 3.0, -3.2, 2.8],
    ['sai', 'dagger', -1.5, -1.7, 2.1],
    ['chakram', 'dagger', -1.0, -1.9, 2.3]
  ];
  for (var m = 0; m < ssMats.length; m++) {
    for (var t = 0; t < ssTypes.length; t++) {
      add(
        'simplyswords:' + ssMats[m][0] + '_' + ssTypes[t][0],
        ssTypes[t][1],
        ssMats[m][1] + ssTypes[t][2],
        ssTypes[t][3],
        ssTypes[t][4],
        ssMats[m][2],
        ssMats[m][0],
        'mod_native_preserved'
      );
    }
  }

  var fdKnives = [
    ['flint', 3.5, 131],
    ['iron', 4.5, 250],
    ['golden', 3.5, 32],
    ['diamond', 5.5, 1561],
    ['netherite', 6.5, 2031]
  ];
  for (var k = 0; k < fdKnives.length; k++) {
    add('farmersdelight:' + fdKnives[k][0] + '_knife', 'dagger', fdKnives[k][1], -1.8, 2.1, fdKnives[k][2], fdKnives[k][0], 'mod_native_preserved');
  }

  add('mowziesmobs:wrought_axe', 'axe', 10.0, -3.1, 3.0, 9999, 'netherite', 'geckolib_3d_preserved');
  // Explicit material order is a gameplay contract, not inferred from damage/durability.
  // Gold sits between wood and stone; each tool family retains its own lineage.
  var toolMaterials = [
    ['wooden', 'wood', 59, 2, 2.5, -3], ['golden', 'gold', 32, 2, 2.5, -3],
    ['stone', 'stone', 131, 3, 3.5, -2], ['iron', 'iron', 250, 4, 4.5, -1],
    ['diamond', 'diamond', 1561, 5, 5.5, 0], ['netherite', 'netherite', 2031, 6, 6.5, 0]
  ];
  for (var ti = 0; ti < toolMaterials.length; ti++) {
    var tm = toolMaterials[ti];
    add('minecraft:' + tm[0] + '_hoe', 'hoe', 1, tm[5], 2.5, tm[2], tm[1], 'base_only');
    add('minecraft:' + tm[0] + '_pickaxe', 'pickaxe', tm[3], -2.8, 2.5, tm[2], tm[1], 'base_only');
    add('minecraft:' + tm[0] + '_shovel', 'shovel', tm[4], -3, 2.5, tm[2], tm[1], 'base_only');
  }
  add('minecraft:shears', 'shears', 1, 0, 2.5, 238, 'iron', 'base_only');
  add('minecraft:fishing_rod', 'fishing_rod', 1, 0, 2.5, 64, 'wood', 'base_only');
  add('farmersdelight:skillet', 'skillet', 8, -3.1, 2.5, 256, 'iron', 'mod_native_preserved');
  add('minecraft:compass', 'compass', 1, 0, 2.5, 0, 'iron', 'base_only');
  add('f_rank_days:apprentice_mana_wand', 'staff', 1, 0, 3.5, 0, 'wood', 'base_only');
  add('f_rank_days:ancient_rune_staff', 'staff', 1, 0, 3.5, 0, 'mana', 'base_only');
  w['f_rank_days:rusty_companion_sword'].inheritance_tier = 3;
  w['f_rank_days:hardened_warhammer'].inheritance_tier = 5;
  w['f_rank_days:composite_longbow'].inheritance_tier = 3;
  for (var wid in w) if (/^(hoe|pickaxe|shovel|shears|fishing_rod|skillet|compass)$/.test(w[wid].family)) w[wid].is_field_tool = true;
  global.FRankDays.WEAPON_REGISTRY_V8 = w;
})();

global.FRankDays.FAMILY_LABELS_KO = {
  sword: '검·장검 계열',
  spear: '창·삼지창 계열',
  axe: '도끼·전투도끼 계열',
  blunt: '둔기(나뭇가지·몽둥이·철퇴·망치) 계열',
  dagger: '단검 계열',
  bow: '활·장궁 계열',
  staff: '마력 지팡이 계열', hoe: '괭이·대낫 계열', pickaxe: '곡괭이 계열',
  shovel: '발굴 삽 계열', shears: '채집 가위 계열', fishing_rod: '낚싯대 계열',
  skillet: '무쇠 프라이팬 계열', compass: '탐사 나침반 계열'
};

global.FRankDays.NON_ENHANCEABLE_EXPLICIT_IDS = {
  'f_rank_days:enhancement_hammer': true,
  'f_rank_days:copper_coin': true,
  'f_rank_days:silver_coin': true,
  'f_rank_days:gold_coin': true,
  'f_rank_days:guild_citizen_card': true,
  'f_rank_days:f_ability_token': true,
  'f_rank_days:farmer_license_f': true,
  'f_rank_days:guild_job_card_f': true,
  'f_rank_days:exam_slip_farmer_e': true,
  'f_rank_days:farmer_license_e': true,
  'f_rank_days:swordsman_license_e': true,
  'f_rank_days:alchemist_license_e': true,
  'f_rank_days:blacksmith_license_e': true,
  'f_rank_days:healer_license_e': true,
  'f_rank_days:relic_researcher_license_e': true,
  'f_rank_days:brion_daily_newspaper': true,
  'minecraft:potion': true,
  'minecraft:splash_potion': true,
  'minecraft:lingering_potion': true,
  'minecraft:bread': true,
  'minecraft:apple': true,
  'minecraft:golden_apple': true,
  'f_rank_days:brion_barley_bread': true,
  'f_rank_days:hearth_potato_soup': true,
  'f_rank_days:serdin_herb_ration': true,
  'f_rank_days:golden_wheat_stew': true,
  'f_rank_days:harvest_berry_tart': true,
  'f_rank_days:alchemist_clear_tea': true
};

global.FRankDays.getEnhanceConfigV8 = function () {
  if (global.FRankDays._cachedEnhanceCfg) return global.FRankDays._cachedEnhanceCfg;
  if (typeof JsonIO !== 'undefined' && JsonIO && typeof JsonIO.read === 'function') {
    try {
      var loaded = JsonIO.read('config/f_rank_days/weapon_enhancement_config.json');
      if (loaded && loaded.probability_and_cost_brackets) {
        global.FRankDays._cachedEnhanceCfg = loaded;
        return loaded;
      }
    } catch (e) {}
  }
  global.FRankDays._cachedEnhanceCfg = global.FRankDays.DEFAULT_ENHANCE_CONFIG_V8;
  return global.FRankDays._cachedEnhanceCfg;
};

global.FRankDays.normalizeEnhanceMethodV8 = function (methodOpt) {
  var m = String(methodOpt || 'ANVIL').toUpperCase();
  if (m === 'NAU' || m === 'HAMMER' || m === 'ANVIL') return m;
  return 'ANVIL';
};

// 수단별(ANVIL / HAMMER vs NAU +5%p) 확정 성공률 계산기
global.FRankDays.getEffectiveSuccessRateV8 = function (currentLevel, methodOpt) {
  var method = global.FRankDays.normalizeEnhanceMethodV8(methodOpt);
  var cfg = global.FRankDays.getEnhanceConfigV8();
  var br = global.FRankDays.getBracketForCurrentLevelV8(currentLevel);
  var baseRate = Number(br.base_success_rate !== undefined ? br.base_success_rate : br.success_rate);
  var mSpec = (cfg.enhancement_methods && cfg.enhancement_methods[method]) || { bonus_rate_pp: method === 'NAU' ? 0.05 : 0.0 };
  var bonusPp = Number(mSpec.bonus_rate_pp || 0);
  var eff = Math.min(1.0, Math.max(0.0, Math.floor((baseRate + bonusPp) * 10000 + 0.5) / 10000));
  return {
    method: method,
    base_rate: baseRate,
    bonus_pp: bonusPp,
    effective_rate: eff
  };
};

global.FRankDays.getWeaponSpecV8 = function (itemId) {
  if (!itemId) return null;
  var id = String(itemId);
  if (global.FRankDays.NON_ENHANCEABLE_EXPLICIT_IDS[id]) return null;
  if (id === 'minecraft:stick') {
    return {
      family: 'blunt',
      base_attack_damage: 3.0,
      base_attack_speed: -2.2,
      attack_range: 2.5,
      max_durability: 120,
      material_group: 'wood',
      visual_model_mode: 'cmd_2d',
      converts_to_id: 'f_rank_days:battle_twig',
      inheritance_tier: 1, is_field_tool: false
    };
  }
  return global.FRankDays.WEAPON_REGISTRY_V8[id] || null;
};

global.FRankDays.getVisualTierForLevelV8 = function (level) {
  var lv = Math.max(0, Math.min(99, Math.floor(Number(level || 0))));
  var tiers = global.FRankDays.VISUAL_TIERS_V8;
  for (var i = 0; i < tiers.length; i++) {
    if (lv >= tiers[i].min && lv <= tiers[i].max) {
      return tiers[i];
    }
  }
  return tiers[0];
};

global.FRankDays.computeEnhancementBonusStatsV8 = function (level) {
  var lv = Math.max(0, Math.min(99, Math.floor(Number(level || 0))));
  if (lv <= 0) return { bonus_damage: 0, bonus_speed: 0 };
  var cfg = global.FRankDays.getEnhanceConfigV8();
  var brackets = cfg.probability_and_cost_brackets || [];
  var totalDmg = 0;
  var totalSpd = 0;

  for (var cur = 0; cur < lv; cur++) {
    var br = brackets[brackets.length - 1];
    for (var b = 0; b < brackets.length; b++) {
      if (cur >= brackets[b].min_lv && cur <= brackets[b].max_lv) {
        br = brackets[b];
        break;
      }
    }
    totalDmg += Number(br.dmg_per_lv || 0.1);
    totalSpd += Number(br.spd_per_lv || 0.001);
  }
  if (lv === 99) {
    totalDmg += Number(cfg.plus_99_capstone_bonus_damage || 1.2);
  }
  return {
    bonus_damage: Math.floor(totalDmg * 100 + 0.5) / 100,
    bonus_speed: Math.floor(totalSpd * 1000 + 0.5) / 1000
  };
};

global.FRankDays.getBracketForCurrentLevelV8 = function (currentLevel) {
  var lv = Math.max(0, Math.min(98, Math.floor(Number(currentLevel || 0))));
  var cfg = global.FRankDays.getEnhanceConfigV8();
  var brackets = cfg.probability_and_cost_brackets || [];
  for (var i = 0; i < brackets.length; i++) {
    if (lv >= brackets[i].min_lv && lv <= brackets[i].max_lv) {
      return brackets[i];
    }
  }
  return brackets[brackets.length - 1];
};

global.FRankDays.ensureStackNbtObject = function (stack) {
  if (!stack) return null;
  if (!stack.nbt || typeof stack.nbt !== 'object') {
    stack.nbt = {};
  }
  return stack.nbt;
};

global.FRankDays.readWeaponNbtListV91 = function (value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  var size = typeof value.length === 'number' ? Number(value.length) : (typeof value.size === 'function' ? Number(value.size()) : 0);
  var result = [];
  for (var i = 0; i < size; i++) result.push(typeof value.get === 'function' ? value.get(i) : value[i]);
  return result;
};

global.FRankDays.getWeaponEnhanceLevel = function (stack) {
  if (!stack || !stack.id || stack.empty) return 0;
  var nbt = stack.nbt;
  if (!nbt) return 0;
  // A present canonical compound wins even when level=0 or malformed.
  var raw = nbt.f_rank_enhance ? nbt.f_rank_enhance.level : nbt.f_rank_enhance_lv;
  var level = Number(raw || 0);
  return isFinite(level) ? Math.max(0, Math.min(99, Math.floor(level))) : 0;
};

global.FRankDays.applyEnhancementDataToStack = function (stack, newLevel) {
  if (!stack || !stack.id) return false;
  var spec = global.FRankDays.getWeaponSpecV8(stack.id);
  if (!spec) return false;

  // NBT attributes replace the item's native map. Carry non-attack defaults
  // (e.g. the skillet's knockback) forward as real native CompoundTags.
  var nativeExtraModifiersV10 = [];
  if (typeof Java !== 'undefined' && typeof stack.getAttributeModifiers === 'function') {
    var equipmentSlotV10 = Java.loadClass('net.minecraft.world.entity.EquipmentSlot');
    var registriesV10 = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries');
    var attrEntriesV10 = stack.getAttributeModifiers(equipmentSlotV10.MAINHAND).entries().iterator();
    while (attrEntriesV10.hasNext()) {
      var entryV10 = attrEntriesV10.next(), attrIdV10 = String(registriesV10.ATTRIBUTE.getKey(entryV10.getKey()));
      if (attrIdV10 === 'minecraft:generic.attack_damage' || attrIdV10 === 'minecraft:generic.attack_speed') continue;
      var savedModifierV10 = entryV10.getValue().save();
      savedModifierV10.putString('AttributeName', attrIdV10); savedModifierV10.putString('Slot', 'mainhand');
      nativeExtraModifiersV10.push(savedModifierV10);
    }
  }

  var lv = Math.max(0, Math.min(99, Math.floor(Number(newLevel || 0))));
  var nbt = global.FRankDays.ensureStackNbtObject(stack);
  var bonus = global.FRankDays.computeEnhancementBonusStatsV8(lv);
  var vTier = global.FRankDays.getVisualTierForLevelV8(lv);

  var uid = (nbt.f_rank_enhance && nbt.f_rank_enhance.uid)
    ? String(nbt.f_rank_enhance.uid)
    : ('wpn_' + Date.now() + '_' + Math.floor(Math.random() * 1000000));

  var baseName = (nbt.f_rank_enhance && nbt.f_rank_enhance.base_name) ? String(nbt.f_rank_enhance.base_name) : null;
  if (!baseName) {
    if (nbt.display && nbt.display.Name) {
      try {
        var parsedName = JSON.parse(nbt.display.Name);
        baseName = parsedName && parsedName.text ? String(parsedName.text).replace(/^\[\+\d+\]\s*/, '') : String(stack.id).split(':')[1];
      } catch (e) {
        baseName = String(nbt.display.Name).replace(/^\[\+\d+\]\s*/, '');
      }
    } else {
      baseName = String(stack.id).split(':')[1].replace(/_/g, ' ');
    }
  }

  // Preserve unknown canonical fields from earlier versions or companion mods.
  var enhance = nbt.f_rank_enhance || {};
  enhance.uid = uid; enhance.level = lv; enhance.family = spec.family;
  enhance.bonus_damage = bonus.bonus_damage; enhance.bonus_speed = bonus.bonus_speed;
  enhance.visual_tier = vTier.tier; enhance.visual_label = vTier.label; enhance.base_name = baseName;
  nbt.f_rank_enhance = enhance;

  // 전용 2D 7구간 리소스 모델이 있는 무기(cmd_2d)만 CustomModelData 전환 적용, 3D GeckoLib·모드 고유 모델은 원본 렌더러 보호!
  if (spec.visual_model_mode === 'cmd_2d') {
    if (lv >= 10) {
      nbt.CustomModelData = vTier.cmd;
    } else {
      delete nbt.CustomModelData;
    }
  }

  nbt.display = nbt.display || {};
  if (lv > 0) {
    nbt.display.Name = JSON.stringify({
      text: '[+' + lv + '] ' + baseName,
      italic: false,
      color: lv === 99 ? 'light_purple' : (lv >= 80 ? 'gold' : (lv >= 40 ? 'aqua' : (lv >= 20 ? 'yellow' : 'green')))
    });
  } else {
    nbt.display.Name = JSON.stringify({ text: baseName, italic: false });
  }

  if (spec.family !== 'bow') {
    var totalAttackDmg = Math.floor((spec.base_attack_damage - 1.0 + bonus.bonus_damage) * 100 + 0.5) / 100;
    var totalAttackSpd = Math.floor((spec.base_attack_speed + bonus.bonus_speed) * 1000 + 0.5) / 1000;
    var existingMods = global.FRankDays.readWeaponNbtListV91(nbt.AttributeModifiers);
    var keptMods = [];
    for (var m = 0; m < existingMods.length; m++) {
      var nm = existingMods[m] && existingMods[m].Name ? String(existingMods[m].Name) : '';
      if (nm.indexOf('f_rank_enhance_') !== 0) {
        keptMods.push(existingMods[m]);
      }
    }
    keptMods.push({
      AttributeName: 'minecraft:generic.attack_damage',
      Name: 'f_rank_enhance_damage',
      Amount: totalAttackDmg,
      Operation: 0,
      Slot: 'mainhand',
      UUID: [1180801, 8001, 1, 1]
    });
    keptMods.push({
      AttributeName: 'minecraft:generic.attack_speed',
      Name: 'f_rank_enhance_speed',
      Amount: totalAttackSpd,
      Operation: 0,
      Slot: 'mainhand',
      UUID: [1180801, 8001, 1, 2]
    });
    nbt.AttributeModifiers = keptMods;
  } else {
    nbt.f_rank_enhance.ranged_bonus_damage = bonus.bonus_damage;
  }

  // 실제 KubeJS 런타임에서 NBT 변경분을 ItemStackJS 내부 태그에 동기화
  if (typeof stack.setNbt === 'function') {
    try { stack.setNbt(nbt); } catch (e) {}
  }
  // JS number arrays become NBT ListTag, but Minecraft reads modifier UUIDs
  // only from IntArrayTag. Write the same fixed UUIDs through the native API
  // so the existing base+enhancement amounts actually take effect in-game.
  if (typeof stack.getOrCreateTag === 'function' && typeof Java !== 'undefined') {
    var nativeTag = stack.getOrCreateTag();
    var nativeMods = nativeTag.getList('AttributeModifiers', 10);
    var uuidType = Java.loadClass('java.util.UUID');
    for (var eiV10 = 0; eiV10 < nativeExtraModifiersV10.length; eiV10++) {
      var extraV10 = nativeExtraModifiersV10[eiV10], existsV10 = false;
      for (var miV10 = 0; miV10 < nativeMods.size(); miV10++) {
        var existingV10 = nativeMods.getCompound(miV10);
        if (String(existingV10.getString('AttributeName')) === String(extraV10.getString('AttributeName')) && existingV10.contains('UUID', 11) && existingV10.getUUID('UUID').equals(extraV10.getUUID('UUID'))) existsV10 = true;
      }
      if (!existsV10) nativeMods.add(extraV10.copy());
    }
    for (var ni = 0; ni < nativeMods.size(); ni++) {
      var nativeModifier = nativeMods.getCompound(ni);
      var modifierName = String(nativeModifier.getString('Name'));
      if (modifierName === 'f_rank_enhance_damage') {
        nativeModifier.putUUID('UUID', uuidType.fromString('00120481-0000-1f41-0000-000100000001'));
      } else if (modifierName === 'f_rank_enhance_speed') {
        nativeModifier.putUUID('UUID', uuidType.fromString('00120481-0000-1f41-0000-000100000002'));
      }
    }
  }
  if (global.FRankDays.applyChapter1HeirloomLoreV10) global.FRankDays.applyChapter1HeirloomLoreV10(stack);
  return true;
};

global.FRankDays.getPlayerSlotStack = function (player, slotRef) {
  if (!player) return null;
  if (slotRef === undefined || slotRef === null || slotRef === 'mainhand') {
    return player.mainHandItem || null;
  }
  if (slotRef === 'offhand') {
    return player.offHandItem || null;
  }
  if (typeof slotRef === 'number' || /^\d+$/.test(String(slotRef))) {
    var idx = Number(slotRef);
    if (player.inventory && typeof player.inventory.getItem === 'function') {
      return player.inventory.getItem(idx);
    }
    if (player.inventory && Array.isArray(player.inventory.slots)) {
      return player.inventory.slots[idx] || null;
    }
  }
  return null;
};

global.FRankDays.setPlayerSlotStack = function (player, slotRef, newStackObj) {
  if (!player) return false;
  if (slotRef === undefined || slotRef === null || slotRef === 'mainhand') {
    player.mainHandItem = newStackObj;
    return true;
  }
  if (slotRef === 'offhand') {
    player.offHandItem = newStackObj;
    return true;
  }
  if ((typeof slotRef === 'number' || /^\d+$/.test(String(slotRef))) && player.inventory) {
    var idx = Number(slotRef);
    if (typeof player.inventory.setItem === 'function') {
      player.inventory.setItem(idx, newStackObj);
      return true;
    }
    if (Array.isArray(player.inventory.slots)) {
      player.inventory.slots[idx] = newStackObj;
      return true;
    }
  }
  return false;
};

global.FRankDays.consumePlayerItemExact = function (player, itemId, amount) {
  var need = Math.floor(Number(amount || 0));
  if (need <= 0) return true;
  var have = global.FRankDays.countPlayerItem(player, itemId);
  if (have < need) return false;

  if (player.inventory && Array.isArray(player.inventory.slots)) {
    var rem = need;
    for (var i = 0; i < player.inventory.slots.length && rem > 0; i++) {
      var st = player.inventory.slots[i];
      if (st && !st.empty && String(st.id) === itemId && Number(st.count || 0) > 0) {
        var take = Math.min(rem, Number(st.count));
        st.count -= take;
        if (st.count <= 0) {
          st.empty = true;
          player.inventory.slots[i] = null;
        }
        rem -= take;
      }
    }
    if (rem === 0) return true;
  }

  if (player.inventory && typeof player.inventory._consumeMock === 'function') {
    return player.inventory._consumeMock(itemId, need);
  }

  if (player.server && player.server.runCommandSilent && player.username) {
    player.server.runCommandSilent('clear ' + player.username + ' ' + itemId + ' ' + need);
    return true;
  }
  return false;
};

// 인벤토리 또는 보조손에서 사용 가능한 휴대용 강화망치(30회) 슬롯 탐색기
global.FRankDays.findUsableEnhancementHammerV8 = function (player) {
  var candidates = ['offhand', 'mainhand'];
  for (var c = 0; c < candidates.length; c++) {
    var st = global.FRankDays.getPlayerSlotStack(player, candidates[c]);
    if (st && !st.empty && String(st.id) === 'f_rank_days:enhancement_hammer') {
      var dmg = Number((st.nbt && st.nbt.Damage) || 0);
      if (dmg < 30) return { slot: candidates[c], stack: st, used: dmg, remaining: 30 - dmg };
    }
  }
  if (player && player.inventory) {
    var maxS = Array.isArray(player.inventory.slots) ? player.inventory.slots.length : 36;
    for (var i = 0; i < maxS; i++) {
      var ist = global.FRankDays.getPlayerSlotStack(player, i);
      if (ist && !ist.empty && String(ist.id) === 'f_rank_days:enhancement_hammer') {
        var idmg = Number((ist.nbt && ist.nbt.Damage) || 0);
        if (idmg < 30) return { slot: i, stack: ist, used: idmg, remaining: 30 - idmg };
      }
    }
  }
  return null;
};

// 강화망치 1회 사용 내구도 차감 (성공 시·실패 시 모두 동일하게 1 감소, 30회 도달 시 파손!)
global.FRankDays.consumeHammerDurabilityOnceV8 = function (player, hammerInfo) {
  if (!hammerInfo || !hammerInfo.stack) return { ok: false, broken: false, remaining_uses: 0 };
  var hStack = hammerInfo.stack;
  var nbt = global.FRankDays.ensureStackNbtObject(hStack);
  var maxUses = 30;
  var newDamage = Math.min(maxUses, Number(nbt.Damage || 0) + 1);
  nbt.Damage = newDamage;
  var remaining = Math.max(0, maxUses - newDamage);
  var broken = remaining <= 0;

  if (broken) {
    var brokenStack = typeof Item !== 'undefined' && typeof Item.of === 'function' ? Item.of('minecraft:air') : { id: 'minecraft:air', count: 0, empty: true };
    brokenStack.count = 0;
    global.FRankDays.setPlayerSlotStack(player, hammerInfo.slot, brokenStack);
    if (player.server && player.server.runCommandSilent && player.username) {
      var px = Math.floor(Number(player.x || 0));
      var py = Math.floor(Number(player.y || 69));
      var pz = Math.floor(Number(player.z || 0));
      player.server.runCommandSilent('playsound minecraft:entity.item.break master ' + player.username + ' ' + px + ' ' + py + ' ' + pz + ' 1.0 1.0');
    }
  } else if (typeof hStack.setNbt === 'function') {
    try { hStack.setNbt(nbt); } catch (e) {}
  }

  return { ok: true, damage: newDamage, remaining_uses: remaining, broken: broken };
};

global.FRankDays._enhanceLocks = {};
global.FRankDays._inheritanceGuiSessions = {};

// 1) 강화 사전 조회 (수단 ANVIL / NAU / HAMMER 별 확률·화폐 수수료·재료 정확 안내)
global.FRankDays.previewWeaponEnhancement = function (player, slotRef, methodOpt) {
  var method = global.FRankDays.normalizeEnhanceMethodV8(methodOpt);
  var targetSlot = slotRef === undefined || slotRef === null ? 'mainhand' : slotRef;
  var stack = global.FRankDays.getPlayerSlotStack(player, targetSlot);

  // 만약 HAMMER 모드인데 오른손에 강화망치를 들고 왼손에 강화할 무기를 든 경우 자동 보정!
  if (method === 'HAMMER' && stack && String(stack.id) === 'f_rank_days:enhancement_hammer') {
    var offCandidate = global.FRankDays.getPlayerSlotStack(player, 'offhand');
    if (offCandidate && !offCandidate.empty && global.FRankDays.getWeaponSpecV8(offCandidate.id)) {
      targetSlot = 'offhand';
      stack = offCandidate;
    }
  }

  if (!stack || stack.empty || !stack.id || String(stack.id) === 'minecraft:air') {
    return { ok: false, reason: 'empty_slot', method: method, message: '[강화 안내] 강화할 무기를 손에 들어 주세요.' };
  }

  if (String(stack.id) !== 'minecraft:stick' && Number(stack.count || 1) !== 1) return { ok: false, reason: 'single_equipment_required' };
  var spec = global.FRankDays.getWeaponSpecV8(stack.id);
  if (!spec) {
    return {
      ok: false,
      reason: 'not_enhanceable_item',
      method: method,
      item_id: String(stack.id),
      message: '[강화 불가] 음식·물약·등록증·강화망치·화폐 등은 강화할 수 없습니다. 무기나 나뭇가지를 선택하세요.'
    };
  }

  var curLv = global.FRankDays.getWeaponEnhanceLevel(stack);
  if (curLv >= 99) {
    return {
      ok: false,
      reason: 'already_max_level_99',
      method: method,
      current_level: 99,
      message: '[최대 단계] 이 무기는 이미 최고 경지인 [+99]에 도달했습니다.'
    };
  }

  var hammerInfo = null;
  if (method === 'HAMMER') {
    hammerInfo = global.FRankDays.findUsableEnhancementHammerV8(player);
    if (!hammerInfo) {
      return {
        ok: false,
        reason: 'missing_enhancement_hammer',
        method: 'HAMMER',
        message: '[강화망치 없음] 사용 가능한 휴대용 단련 강화망치(f_rank_days:enhancement_hammer)가 인벤토리에 없습니다.'
      };
    }
  }

  if (global.FRankDays.isGuardianGearBrokenV102 && global.FRankDays.isGuardianGearBrokenV102(stack)) return {ok:false,reason:'guardian_gear_broken',message:'먼저 나우에게 수호자 장비를 수리하세요.'};
  var br = global.FRankDays.getBracketForCurrentLevelV8(curLv);
  var rateInfo = global.FRankDays.getEffectiveSuccessRateV8(curLv, method);
  var passiveBonus=global.FRankDays.getBlacksmithEnhancementBonusPhase4?global.FRankDays.getBlacksmithEnhancementBonusPhase4(player):0;
  rateInfo.effective_rate=Math.min(1,Number(rateInfo.effective_rate)+passiveBonus);
  var nextBonus = global.FRankDays.computeEnhancementBonusStatsV8(curLv + 1);
  var failLv = global.FRankDays.hasPassivePhase4&&global.FRankDays.hasPassivePhase4(player,'blacksmith',6)?curLv:Math.max(0, curLv - 1);
  var nextVisual = global.FRankDays.getVisualTierForLevelV8(curLv + 1);
  var feeCopper = Number(br.fee_copper !== undefined ? br.fee_copper : 20);
  if (global.FRankDays.guardianEnhancementFeeV102) feeCopper = global.FRankDays.guardianEnhancementFeeV102(player, feeCopper, method);
  var feeFormatted = global.FRankDays.formatCurrencyV8 ? global.FRankDays.formatCurrencyV8(feeCopper) : (feeCopper + '동화');

  return {
    ok: true,
    method: method,
    target_slot: targetSlot,
    item_id: String(stack.id),
    will_convert_stick: Boolean(spec.converts_to_id),
    family: spec.family,
    family_label: global.FRankDays.FAMILY_LABELS_KO[spec.family],
    current_level: curLv,
    success_target_level: curLv + 1,
    failure_target_level: failLv,
    destroy_risk: false,
    base_success_rate: rateInfo.base_rate,
    nau_bonus_pp: rateInfo.bonus_pp,
    success_rate: rateInfo.effective_rate,
    fee_copper: feeCopper,
    fee_formatted: feeFormatted,
    materials: br.materials,
    hammer_remaining_before: hammerInfo ? hammerInfo.remaining : null,
    next_bonus_damage: nextBonus.bonus_damage,
    next_visual_tier: nextVisual
  };
};

// 2) 무기 강화 실행기 (모루 ANVIL / 나우 NAU +5%p / 강화망치 HAMMER 30회 내구도 차감)
global.FRankDays.executeWeaponEnhancement = function (player, optionsOpt) {
  var opts = optionsOpt || {};
  var method = global.FRankDays.normalizeEnhanceMethodV8(opts.method || 'ANVIL');
  var slotRef = opts.slot !== undefined ? opts.slot : 'mainhand';
  var pKey = String((player && (player.uuid || player.username)) || 'anon');

  if (global.FRankDays._enhanceLocks[pKey]) {
    return { ok: false, reason: 'transaction_in_progress', message: '[시스템] 이전 강화 처리가 진행 중입니다.' };
  }
  global.FRankDays._enhanceLocks[pKey] = true;

  try {
    var preview = global.FRankDays.previewWeaponEnhancement(player, slotRef, method);
    if (!preview.ok) {
      return preview;
    }

    var actualSlot = preview.target_slot;
    var stack = global.FRankDays.getPlayerSlotStack(player, actualSlot);
    if (opts.expected_item_id && String(stack.id) !== String(opts.expected_item_id)) {
      return { ok: false, reason: 'slot_item_changed_abort' };
    }
    var preparedTwig = null;
    if (String(stack.id) === 'minecraft:stick') {
      var twigNbt = stack.nbt ? (typeof stack.nbt.copy === 'function' ? stack.nbt.copy() : JSON.parse(JSON.stringify(stack.nbt))) : {};
      preparedTwig = typeof Item !== 'undefined' && typeof Item.of === 'function'
        ? Item.of('f_rank_days:battle_twig', 1, twigNbt)
        : { id: 'f_rank_days:battle_twig', count: 1, empty: false, nbt: twigNbt };
      if (!preparedTwig || String(preparedTwig.id) !== 'f_rank_days:battle_twig') return { ok: false, reason: 'twig_prepare_failed', message: '[강화 취소] 나뭇가지 무기를 준비하지 못했습니다. 재료와 수수료는 보존되었습니다.' };
    }

    // 1) 재료 사전 검증 (부족 시 화폐·재료·강화망치 내구도 일체 미차감!)
    for (var m = 0; m < preview.materials.length; m++) {
      var reqMat = preview.materials[m];
      var haveMat = global.FRankDays.countPlayerItem(player, reqMat.id);
      if (haveMat < reqMat.count) {
        return {
          ok: false,
          reason: 'insufficient_material',
          missing_item: reqMat.id,
          required: reqMat.count,
          have: haveMat,
          hammer_durability_consumed: false,
          message: '[재료 부족] 강화 재료(' + reqMat.id + ' ' + reqMat.count + '개)가 부족합니다.'
        };
      }
    }

    // 2) 3단 화폐(동화·실버·골드) 수수료 사전 검증 및 차감
    var bal = global.FRankDays.getPlayerBalanceSummaryV8(player);
    if (bal.total_copper < preview.fee_copper) {
      return {
        ok: false,
        reason: 'insufficient_currency',
        required_copper: preview.fee_copper,
        have_copper: bal.total_copper,
        hammer_durability_consumed: false,
        message: '[수수료 부족] 강화 수수료 ' + preview.fee_formatted + '가 필요합니다. (보유: ' + bal.formatted_total + ')'
      };
    }

    var hammerInfo = null;
    if (method === 'HAMMER') {
      hammerInfo = global.FRankDays.findUsableEnhancementHammerV8(player);
      if (!hammerInfo) {
        return { ok: false, reason: 'missing_enhancement_hammer', hammer_durability_consumed: false };
      }
    }

    var payRes = global.FRankDays.chargePlayerCurrencyV8(player, preview.fee_copper);
    if (!payRes.ok) {
      return { ok: false, reason: 'currency_charge_failed', hammer_durability_consumed: false, message: payRes.message };
    }

    for (var c = 0; c < preview.materials.length; c++) {
      if (!global.FRankDays.consumePlayerItemExact(player, preview.materials[c].id, preview.materials[c].count)) {
        return { ok: false, reason: 'material_consume_failed' };
      }
    }

    // 3) 휴대용 강화망치(HAMMER) 사용 시: 성공·실패 결과와 무관하게 내구도 1 감소 (30회 소진 시 파손!)
    var hammerResult = null;
    if (method === 'HAMMER' && hammerInfo) {
      hammerResult = global.FRankDays.consumeHammerDurabilityOnceV8(player, hammerInfo);
    }

    // 4) 일반 막대기(minecraft:stick)는 1자루만 분리하여 단련용 나뭇가지(f_rank_days:battle_twig)로 안전 전환
    if (String(stack.id) === 'minecraft:stick') {
      var curCount = Number(stack.count || 1);
      global.FRankDays.setPlayerSlotStack(player, actualSlot, preparedTwig);
      stack = global.FRankDays.getPlayerSlotStack(player, actualSlot);
      if (curCount > 1 && player.give) {
        player.give((curCount - 1) + 'x minecraft:stick');
      }
    }

    var curLv = preview.current_level;
    var roll = typeof opts.forced_roll === 'number' ? opts.forced_roll : Math.random();
    var isSuccess = roll < preview.success_rate;
    var newLv = isSuccess ? Math.min(99, curLv + 1) : preview.failure_target_level;

    if (!global.FRankDays.applyEnhancementDataToStack(stack, newLv)) return { ok: false, reason: 'enhancement_write_failed' };
    if (global.FRankDays.onWeaponEnhancedHeirloomV10) global.FRankDays.onWeaponEnhancedHeirloomV10(player, stack, curLv, newLv, isSuccess);

    if (player.server && player.server.runCommandSilent && player.username) {
      var px = Math.floor(Number(player.x || 0));
      var py = Math.floor(Number(player.y || 69));
      var pz = Math.floor(Number(player.z || 0));
      if (isSuccess) {
        player.server.runCommandSilent('playsound minecraft:block.anvil.use master ' + player.username + ' ' + px + ' ' + py + ' ' + pz + ' 1.0 1.2');
        player.server.runCommandSilent('particle minecraft:totem_of_undying ' + px + ' ' + (py + 1) + ' ' + pz + ' 0.3 0.4 0.3 0.05 12');
      } else {
        player.server.runCommandSilent('playsound minecraft:block.anvil.place master ' + player.username + ' ' + px + ' ' + py + ' ' + pz + ' 0.9 0.6');
        player.server.runCommandSilent('particle minecraft:smoke ' + px + ' ' + (py + 1) + ' ' + pz + ' 0.3 0.3 0.3 0.02 10');
      }
    }

    var pState = global.FRankDays.loadPlayerState(player);
    pState.v8_weapon_stats = pState.v8_weapon_stats || { attempts: 0, successes: 0, failures: 0, highest_level: 0, inheritances: 0 };
    pState.v8_weapon_stats.attempts += 1;
    if (isSuccess) pState.v8_weapon_stats.successes += 1;
    else pState.v8_weapon_stats.failures += 1;
    if (newLv > pState.v8_weapon_stats.highest_level) {
      pState.v8_weapon_stats.highest_level = newLv;
    }
    global.FRankDays.savePlayerState(player, pState);

    var vTierNow = global.FRankDays.getVisualTierForLevelV8(newLv);
    var prefix = method === 'NAU' ? '[나우 숙련 단조(+5%p)] ' : (method === 'HAMMER' ? '[휴대용 강화망치(' + (hammerResult ? hammerResult.remaining_uses : 0) + '/30 남음)] ' : '[모루 기본 강화] ');
    var msg = isSuccess
      ? prefix + '강화 성공! [+' + curLv + ' → +' + newLv + '] (확률 ' + Math.floor(preview.success_rate * 100 + 0.5) + '% · 수수료 ' + preview.fee_formatted + ' · 외형: ' + vTierNow.label + ')'
      : prefix + '강화 실패... 무기는 파괴되지 않았습니다. [+' + curLv + ' → +' + newLv + '] (확률 ' + Math.floor(preview.success_rate * 100 + 0.5) + '%)';
    if (hammerResult && hammerResult.broken) {
      msg += ' | ⚠ 강화망치 30회 수명이 다해 파손되었습니다.';
    }
    if (player.tell) player.tell(msg);

    return {
      ok: true,
      method: method,
      applied_success_rate: preview.success_rate,
      fee_paid_copper: preview.fee_copper,
      success: isSuccess,
      previous_level: curLv,
      new_level: newLv,
      weapon_destroyed: false,
      hammer_durability_consumed: Boolean(hammerResult),
      hammer_remaining_uses: hammerResult ? hammerResult.remaining_uses : null,
      hammer_broken: hammerResult ? hammerResult.broken : false,
      item_id: String(stack.id),
      family: stack.nbt.f_rank_enhance.family,
      bonus_damage: stack.nbt.f_rank_enhance.bonus_damage,
      visual_tier: vTierNow.tier,
      custom_model_data: stack.nbt.CustomModelData || 0,
      message: msg
    };
  } finally {
    delete global.FRankDays._enhanceLocks[pKey];
  }
};

// =========================================================================
// 3) 안전한 슬롯 분리형 강화 계승 GUI (나우 전용 — 모루·강화망치에서는 계승 불가!)
// - 기존 왼손·오른손 명령어의 F키(손 바꾸기) 오작동·착각 위험을 원천 배제하기 위해
//   인벤토리 내 모든 무기를 스캔하여 [원본 강화 무기(소멸, +3 이상)] 슬롯과
//   [대상 +0 무기(동일 계열, 인챈트 보존)] 슬롯을 시각적으로 분리 선택하고 2단계 동의 후 실행합니다.
// =========================================================================
global.FRankDays.getInheritedLevelV10 = function (sourceLevel) {
  var lv = Math.floor(Number(sourceLevel) || 0);
  return lv < 3 ? 0 : Math.max(1, Math.floor(lv * 0.80));
};
global.FRankDays.validateInheritancePairV10 = function (source, target) {
  var a = global.FRankDays.getWeaponSpecV8(source && source.id), b = global.FRankDays.getWeaponSpecV8(target && target.id);
  if (!a || !b) return { ok: false, reason: 'non_weapon_item_rejected' };
  if (Number(source.count || 1) !== 1 || Number(target.count || 1) !== 1) return { ok: false, reason: 'single_equipment_required' };
  if (a.family !== b.family) return { ok: false, reason: 'family_mismatch' };
  if (global.FRankDays.getWeaponEnhanceLevel(source) < 3) return { ok: false, reason: 'source_level_too_low' };
  if (global.FRankDays.getWeaponEnhanceLevel(target) !== 0) return { ok: false, reason: 'target_not_plus_zero' };
  if (!a.inheritance_tier || !b.inheritance_tier || Number(b.inheritance_tier) <= Number(a.inheritance_tier)) return { ok: false, reason: 'target_not_higher_tier', message: '[나우] 같은 계열의 명시된 상위 재료 +0 장비만 계승받을 수 있습니다.' };
  return { ok: true, inherited_level: global.FRankDays.getInheritedLevelV10(global.FRankDays.getWeaponEnhanceLevel(source)) };
};

global.FRankDays.calculateInheritanceFeeCopperV8 = function (inheritedLevel) {
  var cfg = global.FRankDays.getEnhanceConfigV8();
  var f = cfg.inheritance_fee_formula || { base_fee_copper: 100, per_inherited_level_copper: 15, max_fee_copper: 1000 };
  var raw = Number(f.base_fee_copper || 100) + Math.max(1, Number(inheritedLevel || 1)) * Number(f.per_inherited_level_copper || 15);
  return Math.min(Number(f.max_fee_copper || 1000), raw);
};

global.FRankDays.scanInventoryWeaponsForInheritanceGuiV8 = function (player) {
  var sources = [];
  var targets = [];
  var seenSlotRefs = {};

  function inspectSlot(slotKey, slotLabel, st) {
    if (!st || st.empty || !st.id || String(st.id) === 'minecraft:air') return;
    if (seenSlotRefs[String(slotKey)]) return;
    var spec = global.FRankDays.getWeaponSpecV8(st.id);
    if (!spec) return;

    // 일반 막대기 다발(2개 이상)은 계승 대상 오선택 방지를 위해 1개일 때만 허용
    if (Number(st.count || 1) !== 1) return;

    var lv = global.FRankDays.getWeaponEnhanceLevel(st);
    var uid = (st.nbt && st.nbt.f_rank_enhance && st.nbt.f_rank_enhance.uid) || null;
    var enchCount = st.nbt ? global.FRankDays.readWeaponNbtListV91(st.nbt.Enchantments).length : 0;
    var shortName = String(st.id).split(':')[1];

    seenSlotRefs[String(slotKey)] = true;

    if (lv >= 3) {
      var outLv = global.FRankDays.getInheritedLevelV10(lv);
      sources.push({
        slot_ref: slotKey,
        slot_label: slotLabel,
        item_id: String(st.id),
        short_name: shortName,
        uid: uid,
        family: spec.family,
        inheritance_tier: spec.inheritance_tier, is_field_tool: !!spec.is_field_tool,
        family_label: global.FRankDays.FAMILY_LABELS_KO[spec.family],
        level: lv,
        inherited_level: outLv,
        fee_copper: global.FRankDays.calculateInheritanceFeeCopperV8(outLv),
        fee_formatted: global.FRankDays.formatCurrencyV8(global.FRankDays.calculateInheritanceFeeCopperV8(outLv))
      });
    } else if (lv === 0) {
      targets.push({
        slot_ref: slotKey,
        slot_label: slotLabel,
        item_id: String(st.id),
        short_name: shortName,
        family: spec.family,
        inheritance_tier: spec.inheritance_tier, is_field_tool: !!spec.is_field_tool,
        family_label: global.FRankDays.FAMILY_LABELS_KO[spec.family],
        level: 0,
        enchant_count: enchCount,
        damage: (st.nbt && st.nbt.Damage) || 0
      });
    }
  }

  // 숫자 인벤토리 슬롯(0~35)이 있으면 우선 스캔하여 mainhand 중복 참조를 막고, 없으면 mainhand/offhand 스캔
  var hasNumericSlots = Boolean(player && player.inventory && (Array.isArray(player.inventory.slots) || typeof player.inventory.getItem === 'function'));
  if (hasNumericSlots) {
    var totalSlots = Array.isArray(player.inventory.slots) ? player.inventory.slots.length : 36;
    for (var i = 0; i < totalSlots; i++) {
      inspectSlot(i, '슬롯#' + i, global.FRankDays.getPlayerSlotStack(player, i));
    }
    inspectSlot('offhand', '보조손', global.FRankDays.getPlayerSlotStack(player, 'offhand'));
  } else {
    inspectSlot('offhand', '보조손', global.FRankDays.getPlayerSlotStack(player, 'offhand'));
    inspectSlot('mainhand', '주무기손', global.FRankDays.getPlayerSlotStack(player, 'mainhand'));
  }

  var compatibleSources = [], compatibleTargets = [];
  for (var si = 0; si < sources.length; si++) for (var di = 0; di < targets.length; di++) {
    if (sources[si].family === targets[di].family && Number(targets[di].inheritance_tier) > Number(sources[si].inheritance_tier)) {
      if (compatibleSources.indexOf(sources[si]) < 0) compatibleSources.push(sources[si]);
      if (compatibleTargets.indexOf(targets[di]) < 0) compatibleTargets.push(targets[di]);
    }
  }
  return { sources: compatibleSources, targets: compatibleTargets };
};

// 나우를 통해서만 열리는 안전 강화 계승 GUI 오픈 함수
global.FRankDays.openSafeInheritanceGuiV8 = function (player, callerMethodOpt) {
  var method = global.FRankDays.normalizeEnhanceMethodV8(callerMethodOpt || 'NAU');
  if (method !== 'NAU') {
    return {
      ok: false,
      reason: 'inheritance_only_at_nau',
      message: '[계승 불가] 무기 강화 계승은 모루나 강화망치로 수행할 수 없습니다. 대장장이 [나우]에게 의뢰하세요.'
    };
  }

  var scanned = global.FRankDays.scanInventoryWeaponsForInheritanceGuiV8(player);
  var bal = global.FRankDays.getPlayerBalanceSummaryV8(player);
  var pKey = String((player && (player.uuid || player.username)) || 'anon');
  var sessionToken = 'safe_inh_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);

  global.FRankDays._inheritanceGuiSessions[pKey] = {
    session_token: sessionToken,
    opened_at: Date.now(),
    sources: scanned.sources,
    targets: scanned.targets
  };

  // 만약 NPC 대화창이 열려 있었다면 겹치지 않도록 먼저 조용히 닫고 전용 계승 GUI를 표시
  if (typeof global.FRankDays.closeNpcRpgDialog === 'function') {
    global.FRankDays.closeNpcRpgDialog(player, true);
  }

  var guiPayload = {
    session_token: sessionToken,
    wallet_formatted: bal.formatted_total,
    total_copper: bal.total_copper,
    sources: scanned.sources,
    targets: scanned.targets
  };

  if (typeof player.sendData === 'function') {
    player.sendData('f_rank_days:open_safe_inheritance_ui', guiPayload);
  }

  return {
    ok: true,
    session_token: sessionToken,
    sources: scanned.sources,
    targets: scanned.targets,
    payload: guiPayload
  };
};

// 안전 계승 검증 및 실행 엔진 (GUI 패킷 및 검증 API 공용 — 2단계 동의 플래그 consent_confirmed 필수!)
global.FRankDays.executeSafeInheritanceFromGuiV8 = function (player, reqParams) {
  var req = reqParams || {};
  var method = global.FRankDays.normalizeEnhanceMethodV8(req.method || 'NAU');
  if (method !== 'NAU') {
    return {
      ok: false,
      reason: 'inheritance_only_at_nau',
      consumed_anything: false,
      message: '[계승 거부] 강화 계승은 대장장이 나우에게서만 진행할 수 있습니다.'
    };
  }

  if (!global.FRankDays.isPlayerNearNauSmithyV8(player)) return { ok: false, reason: 'too_far_from_npc', consumed_anything: false };

  if (req.consent_confirmed !== true) {
    return {
      ok: false,
      reason: 'consent_checkbox_not_confirmed',
      consumed_anything: false,
      message: '[안전 잠금] 원본 강화 무기 소멸에 동의하는 [1단계 안전 동의 체크]를 먼저 활성화해야 합니다.'
    };
  }

  var srcSlot = req.source_slot;
  var dstSlot = req.target_slot;
  if (srcSlot === undefined || dstSlot === undefined || String(srcSlot) === String(dstSlot)) {
    return { ok: false, reason: 'same_or_missing_slots', consumed_anything: false };
  }

  var pKey = String((player && (player.uuid || player.username)) || 'anon');
  if (global.FRankDays._enhanceLocks[pKey]) {
    return { ok: false, reason: 'transaction_in_progress', consumed_anything: false };
  }
  global.FRankDays._enhanceLocks[pKey] = true;

  try {
    var srcStack = global.FRankDays.getPlayerSlotStack(player, srcSlot);
    var dstStack = global.FRankDays.getPlayerSlotStack(player, dstSlot);
    if (!srcStack || srcStack.empty || !srcStack.id || !dstStack || dstStack.empty || !dstStack.id) {
      return {
        ok: false,
        reason: 'missing_source_or_target_weapon',
        consumed_anything: false,
        message: '[나우] "선택한 슬롯에 무기가 비어 있다! 계승을 취소했으니 다시 확인해라."'
      };
    }

    // 요청 시점 아이템 ID·고유 UID 대조 (도중 슬롯 바꿔치기나 F키 스왑 오사고 100% 차단!)
    if (req.expected_source_id && String(srcStack.id) !== String(req.expected_source_id)) {
      return { ok: false, reason: 'source_item_mismatch_abort', consumed_anything: false };
    }
    if (req.expected_target_id && String(dstStack.id) !== String(req.expected_target_id)) {
      return { ok: false, reason: 'target_item_mismatch_abort', consumed_anything: false };
    }
    var srcUidNow = (srcStack.nbt && srcStack.nbt.f_rank_enhance && srcStack.nbt.f_rank_enhance.uid) || null;
    if (req.expected_source_uid && String(srcUidNow) !== String(req.expected_source_uid)) {
      return { ok: false, reason: 'source_uid_mismatch_abort', consumed_anything: false };
    }
    if (srcStack === dstStack || (srcUidNow && dstStack.nbt && dstStack.nbt.f_rank_enhance && dstStack.nbt.f_rank_enhance.uid === srcUidNow)) {
      return { ok: false, reason: 'identical_weapon_instance_rejected', consumed_anything: false };
    }

    var srcSpec = global.FRankDays.getWeaponSpecV8(srcStack.id);
    var dstSpec = global.FRankDays.getWeaponSpecV8(dstStack.id);
    if (!srcSpec || !dstSpec) {
      return {
        ok: false,
        reason: 'non_weapon_item_rejected',
        consumed_anything: false,
        message: '[나우] "무기로 등록되지 않은 아이템은 강화 계승을 할 수 없데이."'
      };
    }

    if (srcSpec.family !== dstSpec.family) {
      return {
        ok: false,
        reason: 'family_mismatch',
        source_family: srcSpec.family,
        target_family: dstSpec.family,
        consumed_anything: false,
        message:
          '[나우] "계열이 다른 무기끼리는 절대 계승할 수 없다! (' +
          global.FRankDays.FAMILY_LABELS_KO[srcSpec.family] +
          ' → ' +
          global.FRankDays.FAMILY_LABELS_KO[dstSpec.family] +
          ' 거부)"'
      };
    }

    var dstLv = global.FRankDays.getWeaponEnhanceLevel(dstStack);
    if (dstLv !== 0) {
      return {
        ok: false,
        reason: 'target_not_plus_zero',
        target_level: dstLv,
        consumed_anything: false,
        message: '[나우] "계승받을 대상 무기는 반드시 강화되지 않은 [+0] 상태여야 한다! (현재 +' + dstLv + ')"'
      };
    }

    var srcLv = global.FRankDays.getWeaponEnhanceLevel(srcStack);
    var inheritedLv = global.FRankDays.getInheritedLevelV10(srcLv);
    if (srcLv < 3) {
      return {
        ok: false,
        reason: 'source_level_too_low',
        source_level: srcLv,
        inherited_level: inheritedLv,
        consumed_anything: false,
        message: '[나우] "원본 무기가 최소 +3 이상이어야 80% 보존 계승이 가능하데이. (현재 +' + srcLv + ')"'
      };
    }

    var pair = global.FRankDays.validateInheritancePairV10(srcStack, dstStack);
    if (!pair.ok) return pair;

    // Prepare an independent target first. Native ItemStack.empty is read-only,
    // and a failed target write must never consume the original weapon.
    var copyStack = function (value) {
      return typeof value.copy === 'function' ? value.copy() : JSON.parse(JSON.stringify(value));
    };
    var originalSource = copyStack(srcStack), originalTarget = copyStack(dstStack);
    var preparedTarget = copyStack(dstStack);
    if (String(dstStack.id) === 'minecraft:stick') {
      if (Number(dstStack.count || 1) > 1) {
        return {
          ok: false,
          reason: 'target_stick_stack_exceeds_one',
          consumed_anything: false,
          message: '[나우] "계승받을 나뭇가지는 1자루만 분리해 두어야 한다!"'
        };
      }
      if (typeof Item !== 'undefined' && typeof Item.of === 'function') {
        preparedTarget = Item.of('f_rank_days:battle_twig', 1, preparedTarget.nbt || {});
      } else preparedTarget.id = 'f_rank_days:battle_twig';
    }

    if (!global.FRankDays.applyEnhancementDataToStack(preparedTarget, inheritedLv) || global.FRankDays.getWeaponEnhanceLevel(preparedTarget) !== inheritedLv) {
      return { ok: false, reason: 'target_prepare_failed', consumed_anything: false, message: '[계승 취소] 대상 무기에 강화 정보를 적용하지 못했습니다. 원본과 수수료는 보존되었습니다.' };
    }

    var heirloomPlan = global.FRankDays.prepareHeirloomInheritanceV10 ? global.FRankDays.prepareHeirloomInheritanceV10(player, srcStack, preparedTarget) : null;
    if (heirloomPlan && !heirloomPlan.ok) return heirloomPlan;

    // 계승 수수료 결제 (3단 화폐)
    var feeCopper = global.FRankDays.calculateInheritanceFeeCopperV8(inheritedLv);
    var payRes = global.FRankDays.chargePlayerCurrencyV8(player, feeCopper);
    if (!payRes.ok) {
      return {
        ok: false,
        reason: 'insufficient_inheritance_fee',
        required_copper: feeCopper,
        consumed_anything: false,
        message: '[수수료 부족] 계승 수수료 ' + global.FRankDays.formatCurrencyV8(feeCopper) + '가 부족합니다. (보유: ' + payRes.have_formatted + ')'
      };
    }

    // Commit and verify the destination before removing the source. On a write
    // failure restore both snapshots and return the paid amount to the wallet.
    try {
      if (!global.FRankDays.setPlayerSlotStack(player, dstSlot, preparedTarget)) throw new Error('target_slot_write_failed');
      dstStack = global.FRankDays.getPlayerSlotStack(player, dstSlot);
      if (global.FRankDays.getWeaponEnhanceLevel(dstStack) !== inheritedLv) throw new Error('target_slot_verify_failed');
      var emptySource = typeof Item !== 'undefined' && typeof Item.of === 'function' ? Item.of('minecraft:air') : { id: 'minecraft:air', count: 0, empty: true };
      emptySource.count = 0;
      if (!global.FRankDays.setPlayerSlotStack(player, srcSlot, emptySource)) throw new Error('source_slot_write_failed');
      var remainingSource = global.FRankDays.getPlayerSlotStack(player, srcSlot);
      if (remainingSource && String(remainingSource.id) !== 'minecraft:air' && Number(remainingSource.count) > 0) throw new Error('source_slot_verify_failed');
      if (heirloomPlan && global.FRankDays.commitHeirloomInheritanceV10) global.FRankDays.commitHeirloomInheritanceV10(player, dstStack, heirloomPlan);
    } catch (writeError) {
      global.FRankDays.setPlayerSlotStack(player, dstSlot, originalTarget);
      global.FRankDays.setPlayerSlotStack(player, srcSlot, originalSource);
      global.FRankDays.grantPlayerCurrencyV8(player, feeCopper, false);
      return { ok: false, reason: 'inheritance_write_failed', consumed_anything: false, message: '[계승 취소] 인벤토리 기록에 실패하여 무기와 수수료를 복구했습니다. 나우에게 다시 말을 걸어 주세요.' };
    }
    delete global.FRankDays._inheritanceGuiSessions[pKey];

    var pState = global.FRankDays.loadPlayerState(player);
    pState.v8_weapon_stats = pState.v8_weapon_stats || { attempts: 0, successes: 0, failures: 0, highest_level: 0, inheritances: 0 };
    pState.v8_weapon_stats.inheritances += 1;
    if (inheritedLv > pState.v8_weapon_stats.highest_level) {
      pState.v8_weapon_stats.highest_level = inheritedLv;
    }
    global.FRankDays.savePlayerState(player, pState);

    if (player.server && player.server.runCommandSilent && player.username) {
      var px = Math.floor(Number(player.x || 0));
      var py = Math.floor(Number(player.y || 69));
      var pz = Math.floor(Number(player.z || 0));
      player.server.runCommandSilent('playsound minecraft:block.smithing_table.use master ' + player.username + ' ' + px + ' ' + py + ' ' + pz + ' 1.0 1.1');
    }

    var doneMsg =
      '[나우 · 안전 계승 완료] 원본 [+' + srcLv + '] 무기의 단련혼을 옮겨 [' +
      dstStack.id + '] 무기가 [+' + inheritedLv + '] 상태로 계승되었습니다! (수수료 ' +
      global.FRankDays.formatCurrencyV8(feeCopper) + ' · 마법부여·내구도 보존)';
    if (player.tell) player.tell(doneMsg);

    return {
      ok: true,
      inherited_level: inheritedLv,
      fee_paid_copper: feeCopper,
      source_consumed: true,
      target_item_id: String(dstStack.id),
      family: srcSpec.family,
      target_custom_model_data: dstStack.nbt.CustomModelData || 0,
      preserved_damage: dstStack.nbt.Damage,
      preserved_enchantments: dstStack.nbt.Enchantments,
      message: doneMsg
    };
  } finally {
    delete global.FRankDays._enhanceLocks[pKey];
  }
};

// 하위 호환용 래퍼 (기존 테스트/내부 호출 지원하되 동일하게 슬롯·UID·계열·수수료 검증 수행)
global.FRankDays.previewWeaponInheritance = function (player, sourceSlotRef, targetSlotRef) {
  var srcSlot = sourceSlotRef !== undefined ? sourceSlotRef : 'offhand';
  var dstSlot = targetSlotRef !== undefined ? targetSlotRef : 'mainhand';
  var srcStack = global.FRankDays.getPlayerSlotStack(player, srcSlot);
  var dstStack = global.FRankDays.getPlayerSlotStack(player, dstSlot);
  if (!srcStack || srcStack.empty || !dstStack || dstStack.empty) {
    return { ok: false, reason: 'missing_source_or_target_weapon', consumed_anything: false };
  }
  var srcSpec = global.FRankDays.getWeaponSpecV8(srcStack.id);
  var dstSpec = global.FRankDays.getWeaponSpecV8(dstStack.id);
  if (!srcSpec || !dstSpec) return { ok: false, reason: 'non_weapon_item_rejected', consumed_anything: false };
  if (srcSpec.family !== dstSpec.family) return { ok: false, reason: 'family_mismatch', consumed_anything: false };
  var dstLv = global.FRankDays.getWeaponEnhanceLevel(dstStack);
  if (dstLv !== 0) return { ok: false, reason: 'target_not_plus_zero', consumed_anything: false };
  var srcLv = global.FRankDays.getWeaponEnhanceLevel(srcStack);
  var inheritedLv = global.FRankDays.getInheritedLevelV10(srcLv);
  if (srcLv < 3) return { ok: false, reason: 'source_level_too_low', consumed_anything: false };

  var pair = global.FRankDays.validateInheritancePairV10(srcStack, dstStack);
  if (!pair.ok) return pair;
  var pKey = String((player && (player.uuid || player.username)) || 'anon');
  global.FRankDays._inheritanceGuiSessions[pKey] = {
    explicit_preview: {
      source_slot: srcSlot,
      target_slot: dstSlot,
      expected_source_id: String(srcStack.id),
      expected_target_id: String(dstStack.id),
      expected_source_uid: (srcStack.nbt && srcStack.nbt.f_rank_enhance && srcStack.nbt.f_rank_enhance.uid) || null
    }
  };
  return { ok: true, inherited_level: inheritedLv, fee_copper: global.FRankDays.calculateInheritanceFeeCopperV8(inheritedLv) };
};

global.FRankDays.executeWeaponInheritance = function (player) {
  var pKey = String((player && (player.uuid || player.username)) || 'anon');
  var sess = global.FRankDays._inheritanceGuiSessions[pKey];
  if (!sess || !sess.explicit_preview) {
    return { ok: false, reason: 'no_active_inheritance_preview', consumed_anything: false };
  }
  var ep = sess.explicit_preview;
  return global.FRankDays.executeSafeInheritanceFromGuiV8(player, {
    method: 'NAU',
    source_slot: ep.source_slot,
    target_slot: ep.target_slot,
    expected_source_id: ep.expected_source_id,
    expected_target_id: ep.expected_target_id,
    expected_source_uid: ep.expected_source_uid,
    consent_confirmed: true
  });
};

// =========================================================================
// 4) 모루(웅크리기+우클릭 기본 강화) · 휴대용 강화망치 우클릭 · 안전 계승 GUI 패킷 바인딩
// ※ 중요: KubeJS 6에서 event.cancel()은 EventExit를 던지므로 절대 try/catch 내부에 넣지 않습니다!
// =========================================================================
if (typeof BlockEvents !== 'undefined' && BlockEvents.rightClicked) {
  BlockEvents.rightClicked(function (event) {
    if (!event || !event.block || !event.player) return;
    var bid = String(event.block.id || '');
    var isAnvil = bid === 'minecraft:anvil' || bid === 'minecraft:chipped_anvil' || bid === 'minecraft:damaged_anvil';
    if (!isAnvil) return;

    // 일반 우클릭은 바닐라 모루(마법부여 책 합성/이름 변경)를 그대로 보존하고, 웅크리기(Sneak)+우클릭 시 무기 기본 강화 수행!
    var sneaking = Boolean(event.player.crouching || (typeof event.player.isShiftKeyDown === 'function' && event.player.isShiftKeyDown()));
    if (!sneaking) return;

    var mh = event.player.mainHandItem;
    if (mh && !mh.empty && global.FRankDays.getWeaponSpecV8(mh.id)) {
      global.FRankDays.executeWeaponEnhancement(event.player, { method: 'ANVIL', slot: 'mainhand' });
      if (typeof event.cancel === 'function') {
        event.cancel();
      }
    }
  });
}

if (typeof ItemEvents !== 'undefined' && ItemEvents.rightClicked) {
  ItemEvents.rightClicked(function (event) {
    if (!event || !event.item || !event.player) return;
    if (String(event.item.id) === 'f_rank_days:enhancement_hammer') {
      global.FRankDays.executeWeaponEnhancement(event.player, { method: 'HAMMER', slot: 'mainhand' });
    }
  });
}

if (typeof NetworkEvents !== 'undefined' && NetworkEvents.dataReceived) {
  NetworkEvents.dataReceived('f_rank_days:execute_safe_inheritance_gui', function (event) {
    if (!event || !event.player) return;
    var d = event.data || {};
    // KubeJS decodes a network NBT boolean as numeric 1/0 on Forge.
    var consentValue = String(d.consent_confirmed);
    var consent = d.consent_confirmed === true || consentValue === 'true' || consentValue === '1' || consentValue === '1b';
    var gate = typeof global.FRankDays.validateNauGuiRequestV91 === 'function'
      ? global.FRankDays.validateNauGuiRequestV91(event.player, d, 'INHERIT')
      : { ok: false, reason: 'gui_not_ready', message: '나우에게 다시 말을 걸어 계승창을 열어 주세요.' };
    if (!gate.ok || !consent) {
      if (event.player.sendData) event.player.sendData('f_rank_days:safe_inheritance_result', {
        ok: false, message: !gate.ok ? gate.message : '원본 무기 소멸 동의를 먼저 확인해 주세요.'
      });
      return;
    }
    delete global.FRankDays._inheritanceGuiSessions[String(event.player.uuid || event.player.username || 'anon')];
    var res = global.FRankDays.executeSafeInheritanceFromGuiV8(event.player, {
      method: 'NAU',
      source_slot: d.source_slot,
      target_slot: d.target_slot,
      expected_source_id: d.expected_source_id,
      expected_target_id: d.expected_target_id,
      expected_source_uid: d.expected_source_uid,
      consent_confirmed: consent
    });
    if (typeof event.player.sendData === 'function') {
      event.player.sendData('f_rank_days:safe_inheritance_result', {
        ok: res.ok,
        message: res.message || ('오류: ' + res.reason)
      });
    }
  });
}
