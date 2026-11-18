// 《F급의 나날》 KubeJS 6 Server Script - v7.3 Native 3D-Box Village Builder, Starter Structure Sentinel Detector & 2-Phase Chunk-Safe New World Engine
// 파일 경로: kubejs/server_scripts/09_brion_v7_village_builder.js
//
// [v7.3 신규 월드 미적용 5대 원인 근본 해결 내역]
// 1. `/place template` 의존성 탈피: KubeJS 가상 데이터팩(`kubejs/data/`)의 바이너리 `.nbt` 미인식 문제를 원천 해결하기 위해,
//    `11_brion_native_block_installer.js`에 컴파일된 3D 그리디 박스 스팬(`placeStructureNatively`)으로 16개 마을 건물 + 세르딘 3종 + 간판 NBT를 100% 네이티브 배치!
// 2. 실제 스폰 좌표 기반 2단계 비동기 `forceload`: `(0,0)` 고정 강제 로딩 버그를 제거하고, 실제 신규 월드 스폰(`player.x, player.z` / `sharedSpawnPos`) 반경
//    `[-144..+144, -208..+144]`를 먼저 강제 로딩(Stage 1)한 뒤 정확히 40틱 대기 후 그 내부(`±32`)에서만 부지를 선정해 건설(Stage 2)!
// 3. `ServerEvents.tick` + Mojmap `tickCount`/`age`/내장 카운터 3중 폴백으로 1.20.1 Forge에서 틱 누락 0%!
// 4. `Starter Structure` 중복 배치 충돌 차단: `bryon_village_v7_2_full.schem` 하부 센티널(`chiseled_deepslate`)을 자동 감지해,
//    `Starter Structure`가 이미 배치한 월드에서는 중복 건설 없이 해당 좌표로 마을 앵커와 9인 NPC를 즉시 동기화!
// 5. 사전 제작된 `1,024x1,024` Anvil 테스트/템플릿 월드(`(0,64,0) == chiseled_deepslate`) 무손실 보존 및 9인 NPC 자동 배치 유지!

global.FRankDays = global.FRankDays || {};

var FRANK_WORLD_AUTOGEN_DONE_KEY = 'f_rank_days_world_autogen_v73';
var FRANK_WORLD_AUTOGEN_STAGE_KEY = 'f_rank_days_world_autogen_stage_v73';
var FRANK_NPCS_INITIALIZED_KEY = 'f_rank_days_npcs_init_v73';

if (!global.FRankDays.BRION_V7_STRUCTURES) {
  global.FRankDays.BRION_V7_STRUCTURES = [
    { short_id: 'brion_v7_central_plaza', id: 'f_rank_days:brion_v7_central_plaza', zone: 'CENTRAL', dx: -16, dy: 0, dz: -16, w: 33, h: 15, l: 33, rotation: 0, entrance: [0, 1, 10], npc_ids: [] },
    { short_id: 'brion_v7_guild_hall', id: 'f_rank_days:brion_v7_guild_hall', zone: 'NORTH', dx: -11, dy: 0, dz: -40, w: 22, h: 30, l: 15, rotation: 0, entrance: [0, 1, -28], npc_ids: ['hess'] },
    { short_id: 'brion_v7_training_grounds', id: 'f_rank_days:brion_v7_training_grounds', zone: 'NORTH', dx: 20, dy: 0, dz: -46, w: 23, h: 14, l: 21, rotation: 0, entrance: [20, 1, -36], npc_ids: ['ski'] },
    { short_id: 'brion_v7_north_forest_gate', id: 'f_rank_days:brion_v7_north_forest_gate', zone: 'NORTH', dx: -8, dy: 0, dz: -80, w: 17, h: 16, l: 13, rotation: 0, entrance: [0, 1, -68], npc_ids: [] },
    { short_id: 'brion_v7_stone_bridge', id: 'f_rank_days:brion_v7_stone_bridge', zone: 'NORTH', dx: -6, dy: -3, dz: -104, w: 13, h: 11, l: 21, rotation: 0, entrance: [0, 2, -84], npc_ids: [] },
    { short_id: 'brion_v7_potion_shop', id: 'f_rank_days:brion_v7_potion_shop', zone: 'EAST', dx: 22, dy: 0, dz: -19, w: 21, h: 24, l: 19, rotation: 0, entrance: [22, 1, -10], npc_ids: ['roman'] },
    { short_id: 'brion_v7_market_general_store', id: 'f_rank_days:brion_v7_market_general_store', zone: 'EAST', dx: 22, dy: 0, dz: 4, w: 23, h: 16, l: 19, rotation: 0, entrance: [22, 1, 13], npc_ids: ['bambam'] },
    { short_id: 'brion_v7_blacksmith', id: 'f_rank_days:brion_v7_blacksmith', zone: 'EAST', dx: 50, dy: 0, dz: -18, w: 21, h: 17, l: 19, rotation: 0, entrance: [50, 1, -9], npc_ids: ['nau'] },
    { short_id: 'brion_v7_warehouse', id: 'f_rank_days:brion_v7_warehouse', zone: 'EAST', dx: 50, dy: 0, dz: 6, w: 19, h: 15, l: 17, rotation: 0, entrance: [50, 1, 14], npc_ids: ['hyeophap'] },
    { short_id: 'brion_v7_inn', id: 'f_rank_days:brion_v7_inn', zone: 'WEST', dx: -46, dy: 0, dz: -20, w: 25, h: 21, l: 21, rotation: 0, entrance: [-22, 1, -10], npc_ids: ['gori'] },
    { short_id: 'brion_v7_player_cottage', id: 'f_rank_days:brion_v7_player_cottage', zone: 'WEST', dx: -40, dy: 0, dz: 6, w: 17, h: 15, l: 17, rotation: 0, entrance: [-24, 1, 14], npc_ids: [] },
    { short_id: 'brion_v7_resident_houses', id: 'f_rank_days:brion_v7_resident_houses', zone: 'WEST', dx: -76, dy: 0, dz: -14, w: 23, h: 16, l: 19, rotation: 0, entrance: [-54, 1, -5], npc_ids: [] },
    { short_id: 'brion_v7_clinic', id: 'f_rank_days:brion_v7_clinic', zone: 'WEST', dx: -42, dy: 0, dz: -44, w: 19, h: 16, l: 17, rotation: 0, entrance: [-33, 1, -28], npc_ids: ['hwiyeon'] },
    { short_id: 'brion_v7_darim_farmhouse', id: 'f_rank_days:brion_v7_darim_farmhouse', zone: 'SOUTH', dx: -33, dy: 0, dz: 26, w: 31, h: 16, l: 27, rotation: 0, entrance: [-25, 1, 26], npc_ids: ['darim'] },
    { short_id: 'brion_v7_windmill_and_stables', id: 'f_rank_days:brion_v7_windmill_and_stables', zone: 'SOUTH', dx: 6, dy: 0, dz: 28, w: 27, h: 26, l: 23, rotation: 0, entrance: [15, 1, 28], npc_ids: [] },
    { short_id: 'brion_v7_south_gate', id: 'f_rank_days:brion_v7_south_gate', zone: 'SOUTH', dx: -8, dy: 0, dz: 74, w: 17, h: 16, l: 13, rotation: 0, entrance: [0, 1, 74], npc_ids: [] }
  ];
}

global.FRankDays.BRION_V6_LEGACY_STRUCTURES = [
  { short_id: 'v6_square', id: 'f_rank_days:backup_v6/brion_village_square', dx: -9, dy: 0, dz: -9, w: 19, l: 19 },
  { short_id: 'v6_house', id: 'f_rank_days:backup_v6/brion_starter_house', dx: -4, dy: 0, dz: 18, w: 9, l: 9 },
  { short_id: 'v6_guild', id: 'f_rank_days:backup_v6/brion_guild_hall', dx: -7, dy: 0, dz: -28, w: 15, l: 13 },
  { short_id: 'v6_potion', id: 'f_rank_days:backup_v6/brion_potion_shop', dx: -27, dy: 0, dz: -7, w: 11, l: 11 },
  { short_id: 'v6_inn', id: 'f_rank_days:backup_v6/brion_inn', dx: 15, dy: 0, dz: -8, w: 15, l: 13 },
  { short_id: 'v6_farm', id: 'f_rank_days:backup_v6/brion_farm_and_field', dx: -30, dy: 0, dz: 14, w: 17, l: 17 },
  { short_id: 'v6_smithy', id: 'f_rank_days:backup_v6/brion_smithy', dx: 16, dy: 0, dz: 16, w: 13, l: 11 },
  { short_id: 'v6_clinic', id: 'f_rank_days:backup_v6/brion_clinic', dx: -23, dy: 0, dz: -25, w: 11, l: 11 },
  { short_id: 'v6_gate', id: 'f_rank_days:backup_v6/brion_outskirts_gate', dx: -41, dy: 0, dz: -4, w: 7, l: 9 }
];

// 기존 월드의 NPC 좌표는 저장된 콘텐츠 버전에 맞춰 유지합니다.
global.FRankDays.BRION_V71_NPCS = [
  { id: 'hess', tag: 'npc_hess', zone: 'NORTH', label: '헤스 [통합 길드 접수원]', building_id: 'brion_v7_guild_hall', dx: 0.5, dy: 1, dz: -43.5, yaw: 0, profession: 'minecraft:librarian', skin: 'customnpcs:textures/entity/custom/placeholder_guild_receptionist.png' },
  { id: 'roman', tag: 'npc_roman', zone: 'EAST', label: '로만 [B급 연금술사]', building_id: 'brion_v7_potion_shop', dx: 32.5, dy: 1, dz: -10.5, yaw: 90, profession: 'minecraft:cleric', skin: 'customnpcs:textures/entity/custom/roman_skin_64x64.png' },
  { id: 'darim', tag: 'npc_darim', zone: 'SOUTH', label: '다림 [C급 농부]', building_id: 'brion_v7_darim_farmhouse', dx: -14.5, dy: 1, dz: 33.5, yaw: 180, profession: 'minecraft:farmer', skin: 'customnpcs:textures/entity/custom/placeholder_fox_farmer.png' },
  { id: 'nau', tag: 'npc_nau', zone: 'EAST', label: '나우 [B급 대장장이]', building_id: 'brion_v7_blacksmith', dx: 52.5, dy: 1, dz: -5.5, yaw: 90, profession: 'minecraft:weaponsmith', skin: 'customnpcs:textures/entity/custom/placeholder_blacksmith.png' },
  { id: 'gori', tag: 'npc_gori', zone: 'WEST', label: '고리 [브리온 여관 주인]', building_id: 'brion_v7_inn', dx: -32.5, dy: 1, dz: -8.5, yaw: -90, profession: 'minecraft:butcher', skin: 'customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png' },
  { id: 'hwiyeon', tag: 'npc_hwiyeon', zone: 'WEST', label: '휘연 [A급 힐러]', building_id: 'brion_v7_clinic', dx: -31.5, dy: 1, dz: -35.5, yaw: 0, profession: 'minecraft:cleric', skin: 'customnpcs:textures/entity/custom/placeholder_healer.png' },
  { id: 'ski', tag: 'npc_ski', zone: 'NORTH', label: '스키 [A급 검술 교관]', building_id: 'brion_v7_training_grounds', dx: 22.5, dy: 1, dz: -41.5, yaw: 0, profession: 'minecraft:weaponsmith', skin: 'customnpcs:textures/entity/custom/placeholder_guild_receptionist.png' },
  { id: 'hyeophap', tag: 'npc_hyeophap', zone: 'EAST', label: '협합 [B급 유물 연구자]', building_id: 'brion_v7_warehouse', dx: 54.5, dy: 1, dz: 15.5, yaw: 90, profession: 'minecraft:cartographer', skin: 'customnpcs:textures/entity/custom/roman_temp_skin_64x64.png' },
  { id: 'bambam', tag: 'npc_bambam', zone: 'EAST', label: '밤밤 [C급 떠돌이 상인]', building_id: 'brion_v7_market_general_store', dx: 27.5, dy: 1, dz: 10.5, yaw: 90, profession: 'minecraft:mason', skin: 'customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png' }
];

global.FRankDays.BRION_V72_NPCS = [
  { id: 'hess', tag: 'npc_hess', zone: 'NORTH', label: '헤스 [통합 길드 접수원]', building_id: 'brion_v7_guild_hall', dx: 0.5, dy: 1, dz: -44.5, yaw: 0, profession: 'minecraft:librarian', skin: 'customnpcs:textures/entity/custom/placeholder_guild_receptionist.png' },
  { id: 'roman', tag: 'npc_roman', zone: 'EAST', label: '로만 [B급 연금술사]', building_id: 'brion_v7_potion_shop', dx: 34.5, dy: 1, dz: -9.5, yaw: 90, profession: 'minecraft:cleric', skin: 'customnpcs:textures/entity/custom/roman_skin_64x64.png' },
  { id: 'darim', tag: 'npc_darim', zone: 'SOUTH', label: '다림 [C급 농부]', building_id: 'brion_v7_darim_farmhouse', dx: -24.5, dy: 1, dz: 32.5, yaw: 180, profession: 'minecraft:farmer', skin: 'customnpcs:textures/entity/custom/placeholder_fox_farmer.png' },
  { id: 'nau', tag: 'npc_nau', zone: 'EAST', label: '나우 [B급 대장장이]', building_id: 'brion_v7_blacksmith', dx: 56.5, dy: 1, dz: -7.5, yaw: 90, profession: 'minecraft:weaponsmith', skin: 'customnpcs:textures/entity/custom/placeholder_blacksmith.png' },
  { id: 'gori', tag: 'npc_gori', zone: 'WEST', label: '고리 [브리온 여관 주인]', building_id: 'brion_v7_inn', dx: -39.5, dy: 1, dz: -9.5, yaw: -90, profession: 'minecraft:butcher', skin: 'customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png' },
  { id: 'hwiyeon', tag: 'npc_hwiyeon', zone: 'WEST', label: '휘연 [A급 힐러]', building_id: 'brion_v7_clinic', dx: -32.5, dy: 1, dz: -36.5, yaw: 0, profession: 'minecraft:cleric', skin: 'customnpcs:textures/entity/custom/placeholder_healer.png' },
  { id: 'ski', tag: 'npc_ski', zone: 'NORTH', label: '스키 [A급 검술 교관]', building_id: 'brion_v7_training_grounds', dx: 31.5, dy: 1, dz: -37.5, yaw: 0, profession: 'minecraft:weaponsmith', skin: 'customnpcs:textures/entity/custom/placeholder_guild_receptionist.png' },
  { id: 'hyeophap', tag: 'npc_hyeophap', zone: 'EAST', label: '협합 [B급 유물 연구자]', building_id: 'brion_v7_warehouse', dx: 59.5, dy: 1, dz: 14.5, yaw: 90, profession: 'minecraft:cartographer', skin: 'customnpcs:textures/entity/custom/roman_temp_skin_64x64.png' },
  { id: 'bambam', tag: 'npc_bambam', zone: 'EAST', label: '밤밤 [C급 떠돌이 상인]', building_id: 'brion_v7_market_general_store', dx: 30.5, dy: 1, dz: 13.5, yaw: 90, profession: 'minecraft:mason', skin: 'customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png' }
];

// v7.3/v8.2에서는 11번 컴파일 번들이 실제 적용하던 배치를 보존합니다.
global.FRankDays.BRION_V73_NPCS = [
  {
    "id": "hess",
    "tag": "npc_hess",
    "zone": "NORTH",
    "label": "헤스 [통합 길드 접수원]",
    "building_id": "brion_v7_guild_hall",
    "dx": 0.5,
    "dy": 1,
    "dz": -37.5,
    "yaw": 0,
    "profession": "minecraft:librarian",
    "skin": "customnpcs:textures/entity/custom/placeholder_guild_receptionist.png"
  },
  {
    "id": "roman",
    "tag": "npc_roman",
    "zone": "EAST",
    "label": "로만 [연금술사 · 물약가게]",
    "building_id": "brion_v7_potion_shop",
    "dx": 29.5,
    "dy": 1,
    "dz": -10.5,
    "yaw": 90,
    "profession": "minecraft:cleric",
    "skin": "customnpcs:textures/entity/custom/roman_skin_64x64.png"
  },
  {
    "id": "darim",
    "tag": "npc_darim",
    "zone": "SOUTH",
    "label": "다림 [농부 · 농업 실습장]",
    "building_id": "brion_v7_darim_farmhouse",
    "dx": -23.5,
    "dy": 1,
    "dz": 56.5,
    "yaw": 180,
    "profession": "minecraft:farmer",
    "skin": "customnpcs:textures/entity/custom/placeholder_fox_farmer.png"
  },
  {
    "id": "nau",
    "tag": "npc_nau",
    "zone": "EAST",
    "label": "나우 [대장장이 · 대장간]",
    "building_id": "brion_v7_blacksmith",
    "dx": 48.5,
    "dy": 1,
    "dz": -7.5,
    "yaw": 90,
    "profession": "minecraft:weaponsmith",
    "skin": "customnpcs:textures/entity/custom/placeholder_blacksmith.png"
  },
  {
    "id": "gori",
    "tag": "npc_gori",
    "zone": "WEST",
    "label": "고리 [여관 주인]",
    "building_id": "brion_v7_inn",
    "dx": -31.5,
    "dy": 1,
    "dz": -6.5,
    "yaw": -90,
    "profession": "minecraft:butcher",
    "skin": "customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png"
  },
  {
    "id": "hwiyeon",
    "tag": "npc_hwiyeon",
    "zone": "WEST",
    "label": "휘연 [힐러 · 의료소]",
    "building_id": "brion_v7_clinic",
    "dx": -34.5,
    "dy": 1,
    "dz": -30.5,
    "yaw": -90,
    "profession": "minecraft:cleric",
    "skin": "customnpcs:textures/entity/custom/placeholder_healer.png"
  },
  {
    "id": "ski",
    "tag": "npc_ski",
    "zone": "NORTH",
    "label": "스키 [경비 교관]",
    "building_id": "brion_v7_training_grounds",
    "dx": 30.5,
    "dy": 1,
    "dz": -58.5,
    "yaw": 0,
    "profession": "minecraft:weaponsmith",
    "skin": "customnpcs:textures/entity/custom/placeholder_guild_receptionist.png"
  },
  {
    "id": "hyeophap",
    "tag": "npc_hyeophap",
    "zone": "EAST",
    "label": "협합 [창고·유물 관리인]",
    "building_id": "brion_v7_warehouse",
    "dx": 53.5,
    "dy": 2,
    "dz": 14.5,
    "yaw": 90,
    "profession": "minecraft:cartographer",
    "skin": "customnpcs:textures/entity/custom/roman_temp_skin_64x64.png"
  },
  {
    "id": "bambam",
    "tag": "npc_bambam",
    "zone": "EAST",
    "label": "밤밤 [상점 주인]",
    "building_id": "brion_v7_market_general_store",
    "dx": 30.5,
    "dy": 1,
    "dz": 14.5,
    "yaw": 90,
    "profession": "minecraft:mason",
    "skin": "customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png"
  }
];

if (!global.FRankDays.BRION_V7_NPCS) {
  global.FRankDays.BRION_V7_NPCS = [
  {
    "id": "hess",
    "tag": "npc_hess",
    "zone": "NORTH",
    "label": "헤스 [통합 길드 접수원]",
    "building_id": "brion_v7_guild_hall",
    "dx": 1.5,
    "dy": 1,
    "dz": -33.5,
    "world_coords": [
      1.5,
      69,
      -33.5
    ],
    "yaw": 0,
    "profession": "minecraft:librarian",
    "skin": "customnpcs:textures/entity/custom/placeholder_guild_receptionist.png"
  },
  {
    "id": "ski",
    "tag": "npc_ski",
    "zone": "NORTH",
    "label": "스키 [A급 검술 교관]",
    "building_id": "brion_v7_training_grounds",
    "dx": 22.5,
    "dy": 1,
    "dz": -38.5,
    "world_coords": [
      22.5,
      69,
      -38.5
    ],
    "yaw": 0,
    "profession": "minecraft:weaponsmith",
    "skin": "customnpcs:textures/entity/custom/placeholder_guild_receptionist.png"
  },
  {
    "id": "roman",
    "tag": "npc_roman",
    "zone": "EAST",
    "label": "로만 [B급 연금술사 · 물약상]",
    "building_id": "brion_v7_potion_shop",
    "dx": 29.5,
    "dy": 1,
    "dz": -10.5,
    "world_coords": [
      29.5,
      69,
      -10.5
    ],
    "yaw": 90,
    "profession": "minecraft:cleric",
    "skin": "customnpcs:textures/entity/custom/roman_skin_64x64.png"
  },
  {
    "id": "nau",
    "tag": "npc_nau",
    "zone": "EAST",
    "label": "나우 [B급 대장장이]",
    "building_id": "brion_v7_blacksmith",
    "dx": 46.5,
    "dy": 1,
    "dz": -7.5,
    "world_coords": [
      46.5,
      69,
      -7.5
    ],
    "yaw": 90,
    "profession": "minecraft:weaponsmith",
    "skin": "customnpcs:textures/entity/custom/placeholder_blacksmith.png"
  },
  {
    "id": "bambam",
    "tag": "npc_bambam",
    "zone": "EAST",
    "label": "밤밤 [C급 잡화 상인]",
    "building_id": "brion_v7_market_general_store",
    "dx": 30.5,
    "dy": 1,
    "dz": 14.5,
    "world_coords": [
      30.5,
      69,
      14.5
    ],
    "yaw": 90,
    "profession": "minecraft:mason",
    "skin": "customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png"
  },
  {
    "id": "hyeophap",
    "tag": "npc_hyeophap",
    "zone": "EAST",
    "label": "협합 [B급 유물·창고 관리인]",
    "building_id": "brion_v7_warehouse",
    "dx": 51.5,
    "dy": 2,
    "dz": 13.5,
    "world_coords": [
      51.5,
      70,
      13.5
    ],
    "yaw": 90,
    "profession": "minecraft:cartographer",
    "skin": "customnpcs:textures/entity/custom/roman_temp_skin_64x64.png"
  },
  {
    "id": "gori",
    "tag": "npc_gori",
    "zone": "WEST",
    "label": "고리 [브리온 여관 주인]",
    "building_id": "brion_v7_inn",
    "dx": -30.5,
    "dy": 1,
    "dz": -5.5,
    "world_coords": [
      -30.5,
      69,
      -5.5
    ],
    "yaw": -90,
    "profession": "minecraft:butcher",
    "skin": "customnpcs:textures/entity/custom/placeholder_ferret_innkeeper.png"
  },
  {
    "id": "hwiyeon",
    "tag": "npc_hwiyeon",
    "zone": "WEST",
    "label": "휘연 [A급 힐러 · 의료소]",
    "building_id": "brion_v7_clinic",
    "dx": -31.5,
    "dy": 1,
    "dz": -28.5,
    "world_coords": [
      -31.5,
      69,
      -28.5
    ],
    "yaw": -90,
    "profession": "minecraft:cleric",
    "skin": "customnpcs:textures/entity/custom/placeholder_healer.png"
  },
  {
    "id": "darim",
    "tag": "npc_darim",
    "zone": "SOUTH",
    "label": "다림 [C급 농부 · 실습농장]",
    "building_id": "brion_v7_darim_farmhouse",
    "dx": -19.5,
    "dy": 1,
    "dz": 44.5,
    "world_coords": [
      -19.5,
      69,
      44.5
    ],
    "yaw": 180,
    "profession": "minecraft:farmer",
    "skin": "customnpcs:textures/entity/custom/placeholder_fox_farmer.png"
  }
];
}

global.FRankDays.rotationDegToMcKeyword = function (deg) {
  var norm = ((Number(deg || 0) % 360) + 360) % 360;
  if (norm === 90) return 'clockwise_90';
  if (norm === 180) return 'clockwise_180';
  if (norm === 270) return 'counterclockwise_90';
  return 'none';
};

global.FRankDays.validateVillageLayoutCollisions = function (structuresOpt) {
  var list = structuresOpt || global.FRankDays.BRION_V7_STRUCTURES;
  var conflicts = [];
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    var aw = a.rotation === 90 || a.rotation === 270 ? a.l : a.w;
    var al = a.rotation === 90 || a.rotation === 270 ? a.w : a.l;
    var ax1 = a.dx;
    var az1 = a.dz;
    var ax2 = a.dx + aw - 1;
    var az2 = a.dz + al - 1;

    for (var j = i + 1; j < list.length; j++) {
      var b = list[j];
      var bw = b.rotation === 90 || b.rotation === 270 ? b.l : b.w;
      var bl = b.rotation === 90 || b.rotation === 270 ? b.w : b.l;
      var bx1 = b.dx;
      var bz1 = b.dz;
      var bx2 = b.dx + bw - 1;
      var bz2 = b.dz + bl - 1;

      var sepX = ax2 + 1 < bx1 || ax1 - 1 > bx2;
      var sepZ = az2 + 1 < bz1 || az1 - 1 > bz2;
      if (!sepX && !sepZ) {
        conflicts.push(a.short_id + ' <-> ' + b.short_id);
      }
    }
  }
  return {
    valid: conflicts.length === 0,
    checked_count: list.length,
    conflicts: conflicts
  };
};

// 1) 사전 제작된 1,024x1,024 브리온 Anvil 월드인지 마커 블록(0, 64, 0 == chiseled_deepslate)으로 판별
global.FRankDays.isPrebuiltBrionWorldV73 = function (overworld) {
  if (!overworld) return false;
  try {
    if (typeof overworld.isPrebuiltTemplate === 'function') {
      return Boolean(overworld.isPrebuiltTemplate());
    }
    if (typeof overworld.getBlock === 'function') {
      // v8.3 완성 월드: 원본 Anvil에서 확인한 분수·광장·길드 다섯 지점을 함께 검사합니다.
      var v83Points = [
        [0, 63, 0, 'minecraft:cobblestone'],
        [0, 68, 0, 'minecraft:water'],
        [0, 68, 9, 'minecraft:polished_andesite'],
        [1, 68, -34, 'minecraft:spruce_planks'],
        [-7, 71, -36, 'minecraft:stripped_spruce_wood']
      ];
      var matchesV83 = true;
      for (var vi = 0; vi < v83Points.length; vi++) {
        var vp = v83Points[vi];
        var vb = overworld.getBlock(vp[0], vp[1], vp[2]);
        if (!vb || String(vb.id) !== vp[3]) {
          matchesV83 = false;
          break;
        }
      }
      if (matchesV83) return true;
      var marker73 = overworld.getBlock(0, 63, 0);
      if (marker73 && String(marker73.id) === 'minecraft:lodestone') {
        return true;
      }
    }
  } catch (e) {}
  return false;
};
global.FRankDays.isPrebuiltBrionWorldV72 = global.FRankDays.isPrebuiltBrionWorldV73;

// 1-B) 별도의 단독 길드 검증 테스트 월드(`saves/Guild_Hall_Verification_Test_World/`, 마커 (0,64,0) == lodestone) 판별!
global.FRankDays.isGuildOnlyVerificationWorld = function (overworld) {
  if (!overworld || typeof overworld.getBlock !== 'function') return false;
  try {
    var m = overworld.getBlock(0, 64, 0);
    if (m && String(m.id) === 'minecraft:lodestone') {
      return true;
    }
  } catch (e) {}
  return false;
};

// 2) Starter Structure 모드가 이미 스폰 지점에 `bryon_village_v7_2_full.schem`을 배치했는지 센티널(plaza 0,-2,0 == chiseled_deepslate)로 감지!
global.FRankDays.detectStarterStructureSentinel = function (overworld, centerX, centerZ) {
  if (!overworld || typeof overworld.getBlock !== 'function') return null;
  var cx = Math.floor(Number(centerX || 0));
  var cz = Math.floor(Number(centerZ || 0));
  try {
    // WEOffset 기준 스폰(0,1,10) 대비 플라자 중심은 (cx, y-1, cz-10), 센티널은 (cx, y-3, cz-10) 부근
    var probeOffsets = [[0, -10], [0, 0], [0, 10]];
    for (var p = 0; p < probeOffsets.length; p++) {
      var px = cx + probeOffsets[p][0];
      var pz = cz + probeOffsets[p][1];
      if (px === 0 && pz === 0) continue; // (0,64,0)은 사전 제작 Anvil 월드에서 이미 처리됨
      for (var py = 54; py <= 112; py++) {
        var blk = overworld.getBlock(px, py, pz);
        if (blk && String(blk.id) === 'minecraft:chiseled_deepslate') {
          return { x: px, y: py + 2, z: pz };
        }
      }
    }
  } catch (e) {}
  return null;
};

global.FRankDays.resolveWorldInitialSpawnXZ = function (overworld, playerOpt) {
  if (playerOpt && (Number(playerOpt.x || 0) !== 0 || Number(playerOpt.z || 0) !== 0)) {
    return { x: Math.floor(Number(playerOpt.x)), z: Math.floor(Number(playerOpt.z)) };
  }
  try {
    if (overworld) {
      if (typeof overworld.getSharedSpawnPos === 'function') {
        var sp = overworld.getSharedSpawnPos();
        if (sp) return { x: Math.floor(Number(sp.x || 0)), z: Math.floor(Number(sp.z || 0)) };
      }
      if (overworld.sharedSpawnPos) {
        return {
          x: Math.floor(Number(overworld.sharedSpawnPos.x || 0)),
          z: Math.floor(Number(overworld.sharedSpawnPos.z || 0))
        };
      }
    }
  } catch (e) {}
  if (playerOpt) {
    return { x: Math.floor(Number(playerOpt.x || 0)), z: Math.floor(Number(playerOpt.z || 0)) };
  }
  return { x: 0, z: 0 };
};

global.FRankDays.sampleTerrainPoint = function (overworld, x, z, fallbackY) {
  var defY = fallbackY !== undefined ? fallbackY : 68;
  if (!overworld) return { y: defY, isWater: false };

  if (typeof overworld.sampleSurface === 'function') {
    return overworld.sampleSurface(Math.floor(x), Math.floor(z));
  }

  var ix = Math.floor(x);
  var iz = Math.floor(z);
  try {
    if (typeof overworld.getBlock === 'function') {
      for (var checkY = 136; checkY >= 50; checkY--) {
        var blk = overworld.getBlock(ix, checkY, iz);
        var bid = blk && blk.id ? String(blk.id) : 'minecraft:air';
        if (
          bid === 'minecraft:air' ||
          bid === 'minecraft:cave_air' ||
          bid.indexOf('_leaves') !== -1 ||
          bid.indexOf('_log') !== -1 ||
          bid === 'minecraft:grass' ||
          bid === 'minecraft:tall_grass' ||
          bid === 'minecraft:fern' ||
          bid === 'minecraft:snow'
        ) {
          continue;
        }
        var isWater =
          bid === 'minecraft:water' ||
          bid === 'minecraft:kelp' ||
          bid === 'minecraft:seagrass' ||
          bid === 'minecraft:ice' ||
          bid === 'minecraft:lava';
        return { y: checkY, isWater: isWater };
      }
    }
  } catch (e) {}

  return { y: defY, isWater: false };
};

// 강제 로딩된 안전 영역(±32 블록) 내부에서 가장 완만한 육지 평원을 선택 -> 외곽 청크 이탈 원천 차단!
global.FRankDays.scanBestContinentalVillageSite = function (overworld, startX, startZ, fallbackY) {
  var sx = Math.floor(Number(startX || 0));
  var sz = Math.floor(Number(startZ || 0));
  if (global.FRankDays.isPrebuiltBrionWorldV72(overworld)) {
    return { x: 0, y: 68, z: 0, water_hits: 0, slope_span: 0, score: 0, prebuilt: true };
  }

  var candidates = [
    [0, 0],
    [24, 0], [-24, 0], [0, 24], [0, -24],
    [32, 32], [-32, 32], [32, -32], [-32, -32]
  ];

  var best = null;
  for (var i = 0; i < candidates.length; i++) {
    var cx = sx + candidates[i][0];
    var cz = sz + candidates[i][1];
    var probeOffsets = [[0, 0], [0, -38], [34, -4], [-36, -6], [-6, 38]];
    var waterHits = 0;
    var minY = 999;
    var maxY = -999;
    var centerY = fallbackY !== undefined ? fallbackY : 68;

    for (var p = 0; p < probeOffsets.length; p++) {
      var sample = global.FRankDays.sampleTerrainPoint(overworld, cx + probeOffsets[p][0], cz + probeOffsets[p][1], centerY);
      if (p === 0) centerY = sample.y;
      if (sample.isWater || sample.y < 61) waterHits += 1;
      if (sample.y < minY) minY = sample.y;
      if (sample.y > maxY) maxY = sample.y;
    }

    var slopeSpan = maxY - minY;
    var altitudePenalty = centerY > 108 ? (centerY - 108) * 3 : 0;
    var distPenalty = Math.floor(Math.sqrt(candidates[i][0] * candidates[i][0] + candidates[i][1] * candidates[i][1]) / 16);
    var score = waterHits * 100 + slopeSpan * 4 + altitudePenalty + distPenalty;

    if (!best || score < best.score) {
      best = {
        x: cx,
        y: Math.max(63, Math.min(106, centerY)),
        z: cz,
        water_hits: waterHits,
        slope_span: slopeSpan,
        score: score
      };
      if (waterHits === 0 && slopeSpan <= 4) break;
    }
  }

  return best || { x: sx, y: fallbackY || 68, z: sz, water_hits: 0, slope_span: 0, score: 0 };
};

global.FRankDays.sanitizeClonedTemplateWorldOnFirstBoot = function (server) {
  if (!server || !server.persistentData) return { sanitized: false };
  // 이미 초기화된 실제 플레이 세이브 월드는 절대 건드리지 않고 100% 보존!
  if (server.persistentData.getString('f_rank_days_world_instance_initialized') === 'true') {
    return { sanitized: false, reason: 'existing_active_save_preserved' };
  }
  var wipedKeys = [];
  if (typeof server.persistentData.keys === 'function') {
    var ks = server.persistentData.keys();
    for (var i = 0; i < ks.length; i++) {
      var k = String(ks[i]);
      if (
        k.indexOf('f_rank_days_mirror_v1_') === 0 ||
        k === 'f_rank_days_newspaper_v8' ||
        k === 'f_rank_days_boss_altar_v8'
      ) {
        server.persistentData.putString(k, '');
        wipedKeys.append ? wipedKeys.append(k) : wipedKeys.push(k);
      }
    }
  }
  server.persistentData.putString('f_rank_days_world_instance_initialized', 'true');
  return { sanitized: true, wiped_keys: wipedKeys };
};

global.FRankDays.computeDistrictElevations = function (overworld, ax, baseAy, az) {
  if (global.FRankDays.isPrebuiltBrionWorldV72(overworld)) {
    return { CENTRAL: 68, NORTH: 68, NORTH_GATE: 70, EAST: 68, WEST: 68, SOUTH: 68, SOUTH_LOWER: 65 };
  }
  var cSample = global.FRankDays.sampleTerrainPoint(overworld, ax, az, baseAy);
  var centerY = overworld ? Math.max(63, Math.min(106, cSample.y)) : baseAy;

  function clampZoneY(zx, zz) {
    if (!overworld) return baseAy;
    var s = global.FRankDays.sampleTerrainPoint(overworld, zx, zz, centerY);
    if (s.isWater) return centerY;
    var diff = s.y - centerY;
    if (diff > 2) diff = 2;
    if (diff < -2) diff = -2;
    return centerY + diff;
  }

  return {
    CENTRAL: overworld ? centerY : baseAy,
    NORTH: clampZoneY(ax, az - 34),
    NORTH_GATE: clampZoneY(ax, az - 68),
    EAST: clampZoneY(ax + 34, az - 4),
    WEST: clampZoneY(ax - 36, az - 6),
    SOUTH: clampZoneY(ax - 12, az + 40),
    SOUTH_LOWER: clampZoneY(ax + 24, az + 44)
  };
};

// 대용량 `/fill` 시 32,768 블록 한도 초과를 방지하는 안전 분할 채우기 헬퍼
global.FRankDays.safeFillVolume = function (server, x1, y1, z1, x2, y2, z2, blockSpecWithFilter) {
  if (!server || !server.runCommandSilent) return;
  var minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  var minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  var minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
  var areaXZ = (maxX - minX + 1) * (maxZ - minZ + 1);
  var maxStepY = Math.max(1, Math.floor(30000 / Math.max(1, areaXZ)));
  for (var cy = minY; cy <= maxY; cy += maxStepY) {
    var ey = Math.min(maxY, cy + maxStepY - 1);
    server.runCommandSilent('fill ' + minX + ' ' + cy + ' ' + minZ + ' ' + maxX + ' ' + ey + ' ' + maxZ + ' ' + blockSpecWithFilter);
  }
};

// 브리온 마을 v7.3 네이티브 3D-Box 배치 엔진 (`/place template` 미작동 원천 해결!)
global.FRankDays.buildBrionVillageV7 = function (server, anchorX, anchorY, anchorZ, forceRebuild, overworldOpt) {
  if (typeof global.FRankDays.isFcraftSourceProtected === 'function' && global.FRankDays.isFcraftSourceProtected(server)) return { ok: false, reason: 'fcraft_v9_original_terrain_protected' };
  var check = global.FRankDays.validateVillageLayoutCollisions();
  if (!check.valid) {
    return { ok: false, reason: 'layout_collision', conflicts: check.conflicts };
  }

  var overworld = overworldOpt || (server && server.overworld ? server.overworld() : null);
  var ax = Math.floor(anchorX);
  var baseAy = Math.floor(anchorY);
  var az = Math.floor(anchorZ);

  var zoneYs = global.FRankDays.computeDistrictElevations(overworld, ax, baseAy, az);
  var plazaY = zoneYs.CENTRAL;
  var anchor = global.FRankDays.setVillageAnchor(server, ax, plazaY, az, true, 7);
  anchor.content_version = 8.3;
  anchor.zone_elevations = zoneYs;
  if (server && server.persistentData) {
    server.persistentData.putString('f_rank_days_brion_anchor_v1', JSON.stringify(anchor));
  }

  var placedRegistry = forceRebuild ? {} : global.FRankDays.getPlacedVillageStructures(server);
  var placedNow = [];
  var skippedExisting = [];
  var nativeSpansTotal = 0;

  if (server && server.runCommandSilent) {
    server.runCommandSilent('gamerule commandModificationBlockLimit 131072');
    server.runCommandSilent(
      'forceload add ' + (ax - 112) + ' ' + (az - 176) + ' ' + (ax + 104) + ' ' + (az + 104)
    );

    if (forceRebuild) {
      server.runCommandSilent('kill @e[tag=f_rank_npc]');
    }

    // [순서 1] 도로망·가로등·동쪽 세르딘 나무다리 및 약초 군락지를 건물보다 먼저 배치하여 건물 현관·정원 침범을 원천 방지!
    var roadsKey = 'brion_v73_roads_and_serdin@' + ax + ',' + plazaY + ',' + az;
    if (!placedRegistry[roadsKey]) {
      server.runCommandSilent('fill ' + (ax - 3) + ' ' + zoneYs.NORTH + ' ' + (az - 24) + ' ' + (ax + 3) + ' ' + zoneYs.NORTH + ' ' + (az - 16) + ' minecraft:stone_bricks');
      server.runCommandSilent('fill ' + (ax - 20) + ' ' + zoneYs.NORTH + ' ' + (az - 24) + ' ' + (ax + 23) + ' ' + zoneYs.NORTH + ' ' + (az - 21) + ' minecraft:cobblestone');
      server.runCommandSilent('fill ' + (ax + 16) + ' ' + zoneYs.EAST + ' ' + (az - 3) + ' ' + (ax + 76) + ' ' + zoneYs.EAST + ' ' + (az + 2) + ' minecraft:stone_bricks');
      server.runCommandSilent('fill ' + (ax + 38) + ' ' + zoneYs.EAST + ' ' + (az - 22) + ' ' + (ax + 42) + ' ' + zoneYs.EAST + ' ' + (az + 26) + ' minecraft:cobblestone');
      server.runCommandSilent('fill ' + (ax - 68) + ' ' + zoneYs.WEST + ' ' + (az - 23) + ' ' + (ax - 16) + ' ' + zoneYs.WEST + ' ' + (az - 20) + ' minecraft:dirt_path');
      server.runCommandSilent('fill ' + (ax - 46) + ' ' + zoneYs.WEST + ' ' + (az - 45) + ' ' + (ax - 44) + ' ' + zoneYs.WEST + ' ' + (az + 4) + ' minecraft:cobblestone');
      server.runCommandSilent('fill ' + (ax - 4) + ' ' + zoneYs.SOUTH + ' ' + (az + 16) + ' ' + (ax + 3) + ' ' + zoneYs.SOUTH + ' ' + (az + 70) + ' minecraft:cobblestone');
      server.runCommandSilent('fill ' + (ax - 20) + ' ' + zoneYs.SOUTH + ' ' + (az + 17) + ' ' + (ax - 4) + ' ' + zoneYs.SOUTH + ' ' + (az + 20) + ' minecraft:dirt_path');
      server.runCommandSilent('fill ' + (ax - 16) + ' ' + zoneYs.SOUTH + ' ' + (az + 41) + ' ' + (ax + 30) + ' ' + zoneYs.SOUTH + ' ' + (az + 44) + ' minecraft:cobblestone');
      // 동쪽 세르딘 숲 개울 나무다리 & 약초 군락 연결로
      placedRegistry[roadsKey] = { placed_at: Date.now() };
    }

    // [순서 2] 확보된 건축 팩에서 추출·변환된 16개 전문 중세 건축물 네이티브 블록 배치!
    var hasNativeInstaller = typeof global.FRankDays.placeStructureNatively === 'function' &&
      global.FRankDays.COMPILED_VILLAGE_BUNDLE &&
      global.FRankDays.COMPILED_VILLAGE_BUNDLE.structures;

    for (var i = 0; i < global.FRankDays.BRION_V7_STRUCTURES.length; i++) {
      var st = global.FRankDays.BRION_V7_STRUCTURES[i];
      var regKey = st.short_id + '@' + ax + ',' + plazaY + ',' + az;
      if (placedRegistry[regKey]) {
        skippedExisting.push(st.short_id);
        continue;
      }

      var zoneBaseY = zoneYs[st.zone] !== undefined ? zoneYs[st.zone] : plazaY;
      var sx = ax + st.dx;
      var sy = zoneBaseY + st.dy;
      var sz = az + st.dz;

      global.FRankDays.safeFillVolume(server, sx, sy + 1, sz, sx + st.w - 1, sy + st.h, sz + st.l - 1, 'minecraft:air');
      global.FRankDays.safeFillVolume(
        server,
        sx, sy - 6, sz,
        sx + st.w - 1, sy - 1, sz + st.l - 1,
        'minecraft:cobblestone replace #minecraft:replaceable'
      );

      var placedMode = 'native_rle';
      if (hasNativeInstaller && global.FRankDays.COMPILED_VILLAGE_BUNDLE.structures[st.short_id]) {
        var natRes = global.FRankDays.placeStructureNatively(server, st.short_id, sx, sy, sz);
        nativeSpansTotal += Number(natRes.spans_executed || 0);
      } else {
        placedMode = 'place_template_fallback';
        server.runCommandSilent('place template ' + st.id + ' ' + sx + ' ' + sy + ' ' + sz);
      }

      placedRegistry[regKey] = {
        placed_at: Date.now(),
        mode: placedMode,
        coords: [sx, sy, sz],
        zone_y: zoneBaseY,
        rotation: st.rotation
      };
      placedNow.push(st.short_id);
    }

    // [순서 3] 플레이어 최초 월드 스폰을 브리온 마을 중앙 광장(0.5, +1, 9.5, 북향 180도)으로 안전하게 지정!
    var pzOff = global.FRankDays.BRION_PLAZA_SPAWN_OFFSET || { dx: 0.5, dy: 1, dz: 9.5, yaw: 180 };
    var wsX = Math.floor(ax + pzOff.dx);
    var wsY = Math.floor(plazaY + pzOff.dy);
    var wsZ = Math.floor(az + pzOff.dz);
    server.runCommandSilent('setworldspawn ' + wsX + ' ' + wsY + ' ' + wsZ + ' ' + (pzOff.yaw || 180));
    server.runCommandSilent('gamerule spawnRadius 0');
  }

  global.FRankDays.setPlacedVillageStructures(server, placedRegistry);
  var spawnedNpcs = global.FRankDays.ensureBrionNpcs(server);
  if (server && server.persistentData) {
    server.persistentData.putString(FRANK_NPCS_INITIALIZED_KEY, 'true');
  }

  return {
    ok: true,
    layout_version: 8.3,
    anchor: anchor,
    zone_elevations: zoneYs,
    spawn_coords: [ax + 0.5, plazaY + 1, az + 9.5],
    placed_structures: placedNow,
    native_spans_executed: nativeSpansTotal,
    skipped_existing_structures: skippedExisting,
    spawned_npcs: spawnedNpcs
  };
};

// [Stage 1] 플레이어 접속 시 실제 스폰 위치 주변 청크를 먼저 강제 로딩 예약!
global.FRankDays.requestNewWorldChunkPreload = function (server, overworldOpt, playerOpt) {
  if (!server || !server.persistentData) return { ok: false, reason: 'no_server_data' };
  var anchor = global.FRankDays.getVillageAnchor(server);
  if (anchor.built || server.persistentData.contains(FRANK_WORLD_AUTOGEN_DONE_KEY)) {
    return { ok: true, already_done: true };
  }
  var freshness = server.persistentData.getString('f_rank_days_world_freshness_checked');
  if (freshness === 'legacy_save') {
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_DONE_KEY, 'skipped_existing_save');
    return { ok: false, reason: 'existing_save_world_protected' };
  }

  var overworld = overworldOpt || (typeof server.overworld === 'function' ? server.overworld() : null);
  var initXZ = global.FRankDays.resolveWorldInitialSpawnXZ(overworld, playerOpt);
  var cx = initXZ.x;
  var cz = initXZ.z;

  if (server.runCommandSilent) {
    server.runCommandSilent('gamerule commandModificationBlockLimit 131072');
    // (0,0) 사전 제작 월드 마커 확인용 + 실제 스폰(cx, cz) 반경 전체 강제 로딩 동시 요청!
    server.runCommandSilent('forceload add -16 -16 16 16');
    server.runCommandSilent(
      'forceload add ' + (cx - 144) + ' ' + (cz - 208) + ' ' + (cx + 144) + ' ' + (cz + 144)
    );
  }

  var stageObj = {
    stage: 'WAIT_CHUNKS',
    cx: cx,
    cz: cz,
    waited_ticks: 0
  };
  server.persistentData.putString(FRANK_WORLD_AUTOGEN_STAGE_KEY, JSON.stringify(stageObj));
  return { ok: true, stage: 'WAIT_CHUNKS', cx: cx, cz: cz };
};

// [Stage 2] 강제 로딩 완료 후 실행되는 신규 월드 자동 초기화 본체
global.FRankDays.autoInitializeBrionOnNewWorld = function (server, overworldOpt, playerOpt) {
  if (!server || !server.persistentData) {
    return { ok: false, reason: 'no_server_data' };
  }
  if (typeof global.FRankDays.initializeFcraftV9World === 'function' && global.FRankDays.initializeFcraftV9World(server, overworldOpt || server.overworld())) {
    return { ok: true, auto_generated: false, fcraft_v9_verified_source: true };
  }
  if (typeof global.FRankDays.isFcraftV9CandidateWorld === 'function' && global.FRankDays.isFcraftV9CandidateWorld(server)) {
    return { ok: false, reason: 'fcraft_v9_source_not_ready_no_legacy_rebuild' };
  }

  var anchor = global.FRankDays.getVillageAnchor(server);
  if (anchor.built || server.persistentData.contains(FRANK_WORLD_AUTOGEN_DONE_KEY)) {
    var recovered = global.FRankDays.ensureBrionNpcs(server);
    return { ok: true, already_initialized: true, anchor: anchor, ensured_npcs: recovered.length };
  }

  var overworld = overworldOpt || (typeof server.overworld === 'function' ? server.overworld() : null);

  var freshness = server.persistentData.getString('f_rank_days_world_freshness_checked');
  if (!global.FRankDays.isPrebuiltBrionWorldV72(overworld) && !global.FRankDays.isGuildOnlyVerificationWorld(overworld)) {
    if (freshness === 'legacy_save') {
      server.persistentData.putString(FRANK_WORLD_AUTOGEN_DONE_KEY, 'skipped_existing_save');
      return { ok: false, reason: 'existing_save_world_protected' };
    }
    if (!freshness && typeof server.persistentData.keys === 'function') {
      var existingKeys = server.persistentData.keys();
      for (var i = 0; i < existingKeys.length; i++) {
        if (String(existingKeys[i]).indexOf('f_rank_days_mirror_v1_') === 0 && server.persistentData.getString(existingKeys[i])) {
          server.persistentData.putString(FRANK_WORLD_AUTOGEN_DONE_KEY, 'skipped_existing_save');
          return { ok: false, reason: 'existing_save_world_protected' };
        }
      }
    }
  }

  // 케이스 0: 별도의 단독 길드 건축물 검증 테스트 월드(`saves/Guild_Hall_Verification_Test_World/`) -> 타 건물 생성 절대 금지, 길드 1동 보존 & 헤스만(1.5, 69, -7.5) 소환!
  if (global.FRankDays.isGuildOnlyVerificationWorld(overworld)) {
    var gwAnchor = global.FRankDays.setVillageAnchor(server, 0, 68, 28, true, 7);
    gwAnchor.content_version = 8.3;
    gwAnchor.guild_only_test_world = true;
    gwAnchor.zone_elevations = { CENTRAL: 68, NORTH: 68, EAST: 68, WEST: 68, SOUTH: 68 };
    server.persistentData.putString('f_rank_days_brion_anchor_v1', JSON.stringify(gwAnchor));
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_DONE_KEY, 'guild_only_test_world_v73');
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_STAGE_KEY, 'DONE');
    var gwNpcs = global.FRankDays.ensureBrionNpcs(server);
    return {
      ok: true,
      auto_generated: false,
      guild_only_test_world_detected: true,
      anchor: gwAnchor,
      spawned_npcs: gwNpcs
    };
  }

  // 케이스 1: 다운로드 원본 지형·외부 건축물 사전 제작/템플릿 복제 월드(.mca) -> 템플릿 잔여 개인상태 클린 초기화 후 앵커·9인 NPC 동기화!
  if (global.FRankDays.isPrebuiltBrionWorldV72(overworld)) {
    var cleanRes = global.FRankDays.sanitizeClonedTemplateWorldOnFirstBoot(server);
    var pbAnchor = global.FRankDays.setVillageAnchor(server, 0, 68, 0, true, 8);
    pbAnchor.content_version = 8.3;
    pbAnchor.zone_elevations = global.FRankDays.BRION_PREBUILT_ZONE_ELEVATIONS || {
      CENTRAL: 68, NORTH: 68, NORTH_GATE: 70, EAST: 68, WEST: 68, SOUTH: 68, SOUTH_LOWER: 65
    };
    server.persistentData.putString('f_rank_days_brion_anchor_v1', JSON.stringify(pbAnchor));
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_DONE_KEY, 'prebuilt_downloaded_map_v83');
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_STAGE_KEY, 'DONE');
    if (server.runCommandSilent) {
      server.runCommandSilent('setworldspawn 0 69 9 180');
      server.runCommandSilent('gamerule spawnRadius 0');
    }
    global.FRankDays.setSerdinForestBuilt(server, true);
    var pbNpcs = global.FRankDays.ensureBrionNpcs(server);
    return {
      ok: true,
      auto_generated: false,
      prebuilt_world_detected: true,
      template_sanitized: cleanRes.sanitized,
      anchor: pbAnchor,
      spawned_npcs: pbNpcs
    };
  }

  var initXZ = global.FRankDays.resolveWorldInitialSpawnXZ(overworld, playerOpt);
  if (server.persistentData.contains(FRANK_WORLD_AUTOGEN_STAGE_KEY)) {
    try {
      var stSaved = JSON.parse(server.persistentData.getString(FRANK_WORLD_AUTOGEN_STAGE_KEY));
      if (stSaved && typeof stSaved.cx === 'number' && typeof stSaved.cz === 'number') {
        initXZ = { x: stSaved.cx, z: stSaved.cz };
      }
    } catch (e) {}
  }

  // 케이스 2: Starter Structure 모드가 이미 스폰 지점에 통합 스키매틱(`bryon_village_v7_2_full.schem`)을 안착시킨 경우 -> 중복 건설 없이 동기화!
  var ssDetected = global.FRankDays.detectStarterStructureSentinel(overworld, initXZ.x, initXZ.z);
  if (ssDetected) {
    var ssAnchor = global.FRankDays.setVillageAnchor(server, ssDetected.x, ssDetected.y, ssDetected.z, true, 7);
    ssAnchor.content_version = 8.3;
    ssAnchor.zone_elevations = {
      CENTRAL: ssDetected.y,
      NORTH: ssDetected.y,
      EAST: ssDetected.y,
      WEST: ssDetected.y,
      SOUTH: ssDetected.y
    };
    server.persistentData.putString('f_rank_days_brion_anchor_v1', JSON.stringify(ssAnchor));
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_DONE_KEY, 'starter_structure_synced_v73');
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_STAGE_KEY, 'DONE');
    global.FRankDays.buildSerdinForest(server);
    var ssNpcs = global.FRankDays.ensureBrionNpcs(server);
    return {
      ok: true,
      auto_generated: false,
      starter_structure_detected: true,
      anchor: ssAnchor,
      spawned_npcs: ssNpcs
    };
  }

  // 케이스 3: 순수 일반 랜덤 시드 신규 월드 -> 이미 강제 로딩된 영역(±32) 내 평탄 부지 선정 후 네이티브 3D-Box 건설!
  var site = global.FRankDays.scanBestContinentalVillageSite(overworld, initXZ.x, initXZ.z, 68);
  var buildRes = global.FRankDays.buildBrionVillageV7(server, site.x, site.y, site.z, false, overworld);
  global.FRankDays.buildSerdinForest(server);

  if (buildRes && buildRes.ok) {
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_DONE_KEY, 'native_rle_v73');
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_STAGE_KEY, 'DONE');
    if (server.runCommandSilent) {
      server.runCommandSilent('forceload remove all');
    }
  }

  return {
    ok: Boolean(buildRes && buildRes.ok),
    auto_generated: true,
    selected_continent_site: site,
    build_result: buildRes
  };
};

// 서버 틱 / 플레이어 틱 공용 진행기 (중복 실행 방지 포함)
global.FRankDays.advanceNewWorldAutoBuilder = function (server, overworldOpt, playerOpt, tickIncrement) {
  if (!server || !server.persistentData) return null;
  var anchorNow = global.FRankDays.getVillageAnchor(server);
  if (anchorNow.built || server.persistentData.contains(FRANK_WORLD_AUTOGEN_DONE_KEY)) {
    if (anchorNow.built && !server.persistentData.contains('f_rank_days_npcs_tick_verified')) {
      server.persistentData.putString('f_rank_days_npcs_tick_verified', 'true');
      global.FRankDays.ensureBrionNpcs(server);
    }
    return null;
  }

  var step = Number(tickIncrement || 1);
  if (!server.persistentData.contains(FRANK_WORLD_AUTOGEN_STAGE_KEY)) {
    global.FRankDays.requestNewWorldChunkPreload(server, overworldOpt, playerOpt);
  }

  var rawStage = server.persistentData.getString(FRANK_WORLD_AUTOGEN_STAGE_KEY);
  if (!rawStage || rawStage === 'DONE') return null;

  var stObj = null;
  try {
    stObj = JSON.parse(rawStage);
  } catch (e) {
    stObj = { stage: 'WAIT_CHUNKS', cx: 0, cz: 0, waited_ticks: 40 };
  }

  stObj.waited_ticks = Number(stObj.waited_ticks || 0) + step;
  if (stObj.waited_ticks < 40) {
    server.persistentData.putString(FRANK_WORLD_AUTOGEN_STAGE_KEY, JSON.stringify(stObj));
    return { waiting: true, waited_ticks: stObj.waited_ticks };
  }

  var initRes = global.FRankDays.autoInitializeBrionOnNewWorld(server, overworldOpt, playerOpt);
  if (initRes && initRes.ok) {
    if (playerOpt && typeof global.FRankDays.ensureNewPlayerInitialPlazaSpawn === 'function') {
      global.FRankDays.ensureNewPlayerInitialPlazaSpawn(playerOpt, server);
    } else if (server.players && server.players.length > 0 && typeof global.FRankDays.ensureNewPlayerInitialPlazaSpawn === 'function') {
      for (var pi = 0; pi < server.players.length; pi++) {
        global.FRankDays.ensureNewPlayerInitialPlazaSpawn(server.players[pi], server);
      }
    }
  }
  return initRes;
};

global.FRankDays.rollbackBrionVillageToV6 = function (server) {
  if (typeof global.FRankDays.isFcraftSourceProtected === 'function' && global.FRankDays.isFcraftSourceProtected(server)) return { ok: false, reason: 'fcraft_v9_original_terrain_protected' };
  var anchor = global.FRankDays.getVillageAnchor(server);
  var ax = anchor.x;
  var ay = anchor.y;
  var az = anchor.z;
  global.FRankDays.setVillageAnchor(server, ax, ay, az, true, 6);

  if (server && server.runCommandSilent) {
    server.runCommandSilent('kill @e[tag=f_rank_npc]');
    for (var i = 0; i < global.FRankDays.BRION_V6_LEGACY_STRUCTURES.length; i++) {
      var st = global.FRankDays.BRION_V6_LEGACY_STRUCTURES[i];
      server.runCommandSilent('place template ' + st.id + ' ' + (ax + st.dx) + ' ' + (ay + st.dy) + ' ' + (az + st.dz));
    }
    server.runCommandSilent('setworldspawn ' + ax + ' ' + (ay + 1) + ' ' + (az + 23) + ' 180');
  }
  var npcs = global.FRankDays.ensureBrionNpcs(server);
  return { ok: true, rolled_back_to: 6, anchor: global.FRankDays.getVillageAnchor(server), npcs: npcs };
};
