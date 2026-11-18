// 《F급의 나날》 KubeJS 6 Startup Script (Minecraft 1.20.1 Forge)
// 파일 경로: kubejs/startup_scripts/00_register_items.js
// 주의: 모든 커스텀 아이템은 kubejs/assets/f_rank_days/textures/item/*.png 16x16 텍스처와 1:1 매칭됩니다.

StartupEvents.registry('item', function (event) {
  // 1. 시작 F급 특수 능력 증표
  event
    .create('f_rank_days:f_ability_token')
    .texture('f_rank_days:item/f_ability_token')
    .displayName('F급 평민 특성 기록표')
    .tooltip('아르베른 제국 변방 평민 등록 시 확인된 작은 F급 능력 기록표입니다.')
    .maxStackSize(1)
    .rarity('common');

  // 2. 농부 F급 기초 등록증
  event
    .create('f_rank_days:farmer_license_f')
    .texture('f_rank_days:item/farmer_license_f')
    .displayName('아르베른 길드 농부 등록증 [F급·초보]')
    .tooltip('통합 길드에서 발급한 초보 농부 기초 등록증입니다.')
    .maxStackSize(1)
    .rarity('common');

  // 3. 기타 5대 직업 공용 F급 기초 등록증 (NBT로 직업 구분)
  event
    .create('f_rank_days:guild_job_card_f')
    .texture('f_rank_days:item/guild_job_card_f')
    .displayName('아르베른 길드 기초 직업 등록증 [F급]')
    .tooltip('통합 길드에서 발급한 F급 초보 직업 등록 증서입니다.')
    .maxStackSize(1)
    .rarity('common');

  // 4. 농부 E급 승급 응시표
  event
    .create('f_rank_days:exam_slip_farmer_e')
    .texture('f_rank_days:item/exam_slip_farmer_e')
    .displayName('농부 E급 자격시험 응시표')
    .tooltip('필기(3문항) 및 다림 실습장 실기(경작 6·파종 6·완숙 밀 수확 6·납품 6) 진행용 응시표입니다.')
    .maxStackSize(1)
    .rarity('common');

  // 5. 농부 E급 공인 자격증
  event
    .create('f_rank_days:farmer_license_e')
    .texture('f_rank_days:item/farmer_license_e')
    .displayName('아르베른 길드 공인 농부 자격증 [E급·견습]')
    .tooltip('필기 및 현장 재배 실기시험을 통과한 견습 농부에게 수여되는 공인 자격증입니다.')
    .maxStackSize(1)
    .rarity('uncommon')
    .glow(true);

  // 6. 검사 E급 공인 자격증
  event
    .create('f_rank_days:swordsman_license_e')
    .texture('f_rank_days:item/swordsman_license_e')
    .displayName('아르베른 길드 공인 검사 자격증 [E급·견습]')
    .tooltip('기초 안전·전술 필기 및 마물 토벌 실기를 통과한 견습 검사 공인 자격증입니다.')
    .maxStackSize(1)
    .rarity('uncommon')
    .glow(true);

  // 7. 연금술사 E급 공인 자격증
  event
    .create('f_rank_days:alchemist_license_e')
    .texture('f_rank_days:item/alchemist_license_e')
    .displayName('아르베른 길드 공인 연금술사 자격증 [E급·견습]')
    .tooltip('약재 학술 필기 및 야생 약초 채집·기초 물약 조제 실기를 통과한 견습 연금술사 공인 자격증입니다.')
    .maxStackSize(1)
    .rarity('uncommon')
    .glow(true);

  // 8. 대장장이 E급 공인 자격증
  event
    .create('f_rank_days:blacksmith_license_e')
    .texture('f_rank_days:item/blacksmith_license_e')
    .displayName('아르베른 길드 공인 대장장이 자격증 [E급·견습]')
    .tooltip('광물 열처리 필기 및 원석 채광·철제 도구 단조 실기를 통과한 견습 대장장이 공인 자격증입니다.')
    .maxStackSize(1)
    .rarity('uncommon')
    .glow(true);

  // 9. 힐러 E급 공인 자격증
  event
    .create('f_rank_days:healer_license_e')
    .texture('f_rank_days:item/healer_license_e')
    .displayName('아르베른 길드 공인 힐러 자격증 [E급·견습]')
    .tooltip('트리아지·마력 과부하 예방 필기 및 응급 처치 실기를 통과한 견습 힐러 공인 자격증입니다.')
    .maxStackSize(1)
    .rarity('uncommon')
    .glow(true);

  // 10. 유물 연구자 E급 공인 자격증
  event
    .create('f_rank_days:relic_researcher_license_e')
    .texture('f_rank_days:item/relic_researcher_license_e')
    .displayName('아르베른 길드 공인 유물 연구자 자격증 [E급·견습]')
    .tooltip('비파괴 채록 윤리 필기 및 세르딘 고대 비석 탁본 실기를 통과한 견습 유물 연구자 공인 자격증입니다.')
    .maxStackSize(1)
    .rarity('uncommon')
    .glow(true);

  // 11. 다림 개인 퀘스트 유품 아이템
  event
    .create('f_rank_days:rusty_companion_sword')
    .texture('f_rank_days:item/rusty_companion_sword')
    .displayName('기름종이에 싸인 낡은 한손검')
    .tooltip('다림의 헛간 짚더미 아래에서 발견된 녹슨 검과 낡은 인식표입니다. 소중한 기억이 깃들어 있습니다.')
    .maxStackSize(1)
    .rarity('common');

  // 12. 헤스 개인 퀘스트 증거 아이템
  event
    .create('f_rank_days:field_hazard_report')
    .texture('f_rank_days:item/field_hazard_report')
    .displayName('세르딘 숲 위험도 실측 기록지')
    .tooltip('세르딘 숲 폐야영지 독서대와 훼손된 경고판에서 채집한 실제 마물 출몰 구역 객관 실사 기록입니다.')
    .maxStackSize(1)
    .rarity('common');

  // 13. 유물 연구자 실기 아이템
  event
    .create('f_rank_days:ancient_rubbing_sheet')
    .texture('f_rank_days:item/ancient_rubbing_sheet')
    .displayName('세르딘 고대 비석 탁본지')
    .tooltip('세르딘 숲 고대 비석의 비문을 원형 훼손 없이 종이에 떠낸 학술 탁본 자료입니다.')
    .maxStackSize(16)
    .rarity('common');

  // 14. 아르베른 통합 길드 공인 등록증 (양피지 인장 카드 — 우클릭 시 서버 원본 대조 열람)
  event
    .create('f_rank_days:guild_citizen_card')
    .texture('f_rank_days:item/guild_citizen_card')
    .displayName('아르베른 통합 길드 공인 등록증 [양피지 증서]')
    .tooltip('서명 이름·고유 등록번호·F급 능력·등록 직업·발급 기관이 기록된 공식 등록증입니다. 손에 들고 우클릭해 진위 및 원부를 열람합니다.')
    .maxStackSize(1)
    .rarity('uncommon')
    .glow(true);
});
