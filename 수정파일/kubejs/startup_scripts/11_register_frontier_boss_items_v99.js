// Original F-Craft pixel assets; registry IDs of all previous items stay intact.
StartupEvents.registry('item',function(e){
  e.create('f_rank_days:ancient_reawakening_incense').displayName('[재소환 공물] 고대 각성의 공명향').texture('f_rank_days:item/ancient_reawakening_incense').rarity('rare').tooltip('본토에서 발견한 서리송곳니·움부티·통비 성소 중심28블록 안에서 사용합니다.').tooltip('같은 수호수 생존48블록·성소 재사용3분 · 공명40틱 후 재강림');
  e.create('f_rank_days:solar_blessing_token').displayName('태양의 축복 증표').texture('f_rank_days:item/solar_blessing_token').rarity('rare').tooltip('태양조 움부티의 개인 최초 토벌 증표');
  e.create('f_rank_days:earth_trial_token').displayName('대지 시련 증표').texture('f_rank_days:item/earth_trial_token').rarity('rare').tooltip('조각가 통비의 개인 최초 토벌 증표 · 별도 보너스 스킬포인트1');
});
