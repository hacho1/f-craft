// F-Craft v9.3. Add missing job certificates; all existing registry IDs remain intact.
StartupEvents.registry('item', function (event) {
  var jobs = ["farmer", "swordsman", "alchemist", "blacksmith", "healer", "relic_researcher"], labels = ["농부", "검사", "연금술사", "대장장이", "힐러", "유물 연구자"], grades = ['f', 'e', 'd', 'c', 'b', 'a', 's'];
  for (var j = 0; j < jobs.length; j++) for (var g = 0; g < grades.length; g++) {
    // Existing startup 00 owns farmer F and all six E certificates.
    if (grades[g] === 'e' || (jobs[j] === 'farmer' && grades[g] === 'f')) continue;
    var path = jobs[j] + '_license_' + grades[g];
    event.create('f_rank_days:' + path).texture('f_rank_days:item/' + path)
      .displayName('아르베른 길드 공인 ' + labels[j] + ' 자격증 [' + grades[g].toUpperCase() + '급]')
      .tooltip('자격증 소지만으로 승급하지 않습니다. 길드 서버 원부와 발급 이력이 기준입니다.')
      .maxStackSize(1).rarity(g >= 4 ? 'epic' : g >= 2 ? 'rare' : 'common');
  }
});

// v9.6 adds seven job registry families; the six legacy families above stay intact.
StartupEvents.registry('item', function(event){
  var jobs=['ranger','mage','herbalist','angler','chef','prospector','pathfinder'];
  var labels=['레인저','마법사','약초채집가','낚시꾼','요리사','광부','정찰가'];
  var grades=['f','e','d','c','b','a','s'];
  for(var j=0;j<jobs.length;j++)for(var g=0;g<grades.length;g++){
    var path=jobs[j]+'_license_'+grades[g];
    event.create('f_rank_days:'+path).texture('f_rank_days:item/'+path).displayName('아르베른 길드 공인 '+labels[j]+' 자격증 ['+grades[g].toUpperCase()+'급]').maxStackSize(1).rarity(g>=4?'epic':g>=2?'rare':'common');
  }
  event.create('f_rank_days:apprentice_mana_wand').displayName('수습 마력 지팡이').texture('f_rank_days:item/apprentice_mana_wand').maxStackSize(1).rarity('uncommon');
  event.create('f_rank_days:herb_bandage').displayName('약초 붕대').texture('f_rank_days:item/herb_bandage').maxStackSize(16);
  event.create('f_rank_days:camp_return_scroll').displayName('길드 배정 야영지 귀환서').texture('f_rank_days:item/camp_return_scroll').maxStackSize(1);
  event.create('f_rank_days:mainland_sailing_permit').displayName('[특수 인장] 아르베른 본토 도항 허가증').texture('f_rank_days:item/mainland_sailing_permit').maxStackSize(1).rarity('rare');
});

// v9.8: add the canonical axe-warrior family; legacy mage IDs remain loadable.
StartupEvents.registry('item', function(event){
  var grades=['f','e','d','c','b','a','s'];
  for(var g=0;g<grades.length;g++){
    var id='berserker_license_'+grades[g];
    event.create('f_rank_days:'+id).texture('f_rank_days:item/'+id).displayName('아르베른 길드 공인 도끼전사 자격증 ['+grades[g].toUpperCase()+'급]').maxStackSize(1).rarity(g>=4?'epic':g>=2?'rare':'common');
  }
  event.create('f_rank_days:hardened_battleaxe','axe').tier('diamond').attackDamageBaseline(5.5).speedBaseline(-3.2).maxDamage(960).texture('f_rank_days:item/hardened_battleaxe').displayName('경화광 전투도끼').tooltip('도끼전사용 양손 전투도끼 · 강화와 안전 계승을 지원합니다.');
  event.create('f_rank_days:ancient_rune_staff').texture('f_rank_days:item/ancient_rune_staff').displayName('고대 룬 지팡이').maxStackSize(1).rarity('uncommon').tooltip('유적연구원의 고대 룬 탄환 병기 · 기존 수습 마력 지팡이와 호환됩니다.');
});

// v11.0: personal guild mount whistle; server-owned F8 call/recall.
StartupEvents.registry('item',function(event){
 event.create('f_rank_days:mount_whistle').displayName('§b[개인 탈것] §f길드 마구간 호출 호각').texture('f_rank_days:item/mount_whistle').maxStackSize(1).rarity('uncommon')
  .tooltip('§7우클릭 또는 [F8] 키로 내 전용 군마를 호출하거나 회수합니다.')
  .tooltip('§e최고 승급 등급에 따라 이동속도·도약력·마갑이 자동 진화합니다.');
});
