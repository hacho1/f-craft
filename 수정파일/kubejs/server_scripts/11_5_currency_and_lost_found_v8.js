// 《F급의 나날》 KubeJS 6 Server Script - v8.1 3-Tier Currency Economy (1G = 100S = 1,000C), Emerald Migration & Weasel Lost-and-Found Recovery
// 파일 경로: kubejs/server_scripts/11_5_currency_and_lost_found_v8.js
// 핵심 구현:
// 1. 화폐 비율 엄격 적용: 1골드(Gold) = 100실버(Silver) = 1,000동화(Copper)  [즉, 1실버 = 10동화]
// 2. 플레이어 영구 지갑(state.economy.wallet_copper) + 인벤토리 실물 주화(gold_coin / silver_coin / copper_coin) 통합 결제·거스름돈 정산 엔진
// 3. 기존 에메랄드 보상 체계와의 비파괴 마이그레이션:
//    - 기존 플레이어 최초 접속/업그레이드 시 1회 정착 지원금(20실버 = 200동화) 무중복 지급
//    - 길드/상단 공인 환전(1 에메랄드 = 10 실버 = 100 동화) 및 기존 v7.3 에메랄드 상점 호환 래퍼 제공
// 4. 족제비(jokjebi) 유실물 회수 시스템 연결:
//    - npcs.json 미정 NPC 보호 정책 준수(종족·성격·개인사 임의 창작 금지)
//    - 사망·현장 분실 시 등록된 유실물 꾸러미(lost_parcels)를 동화/실버 수수료(기본 5실버 + 묶음당 2실버, 상한 50실버)로 안전 회수!

global.FRankDays = global.FRankDays || {};

global.FRankDays.DEFAULT_ECONOMY_CONFIG_V8 = {
  schema_version: '8.1.0',
  currency_ratios: {
    copper_unit: 1,
    copper_per_silver: 10,
    silver_per_gold: 100,
    copper_per_gold: 1000
  },
  coin_items: {
    copper: 'f_rank_days:copper_coin',
    silver: 'f_rank_days:silver_coin',
    gold: 'f_rank_days:gold_coin'
  },
  emerald_migration: {
    copper_per_emerald: 100,
    one_time_v8_1_starter_grant_copper: 200,
    allow_guild_emerald_to_coin_exchange: true,
    allow_legacy_npc_shop_currency_fallback: true
  },
  boss_rewards: {
    ferrous_wroughtnaut_first_clear_copper: 1500,
    ferrous_wroughtnaut_repeat_bounty_copper: 200,
    max_daily_repeat_bounties: 2
  },
  npc_commissions_and_trades: {
    darim_barley_bread_4_reward_copper: 80,
    gori_berry_tart_2_reward_copper: 120,
    gori_potato_soup_price_copper: 50,
    nau_tempering_stone_price_copper: 60,
    nau_enhancement_hammer_price_copper: 350
  },
  weasel_lost_and_found: {
    service_id: 'jokjebi_lost_item_recovery',
    base_fee_copper: 50,
    per_stack_fee_copper: 20,
    max_fee_cap_copper: 500,
    max_stored_parcels_per_player: 10
  }
};

global.FRankDays.getEconomyConfigV8 = function () {
  if (global.FRankDays._cachedEconomyCfg) return global.FRankDays._cachedEconomyCfg;
  if (typeof JsonIO !== 'undefined' && JsonIO && typeof JsonIO.read === 'function') {
    try {
      var loaded = JsonIO.read('config/f_rank_days/economy_config.json');
      if (loaded && loaded.currency_ratios) {
        global.FRankDays._cachedEconomyCfg = loaded;
        return loaded;
      }
    } catch (e) {}
  }
  global.FRankDays._cachedEconomyCfg = global.FRankDays.DEFAULT_ECONOMY_CONFIG_V8;
  return global.FRankDays._cachedEconomyCfg;
};

// 동화 단위를 'X골드 Y실버 Z동화'로 변환 (1골드=1,000동화, 1실버=10동화)
global.FRankDays.decomposeCopperV8 = function (totalCopper) {
  var c = Math.max(0, Math.floor(Number(totalCopper || 0)));
  var gold = Math.floor(c / 1000);
  var remAfterGold = c % 1000;
  var silver = Math.floor(remAfterGold / 10);
  var copper = remAfterGold % 10;
  return { gold: gold, silver: silver, copper: copper, total_copper: c };
};

global.FRankDays.formatCurrencyV8 = function (totalCopper) {
  var d = global.FRankDays.decomposeCopperV8(totalCopper);
  var parts = [];
  if (d.gold > 0) parts.push(d.gold + '골드');
  if (d.silver > 0) parts.push(d.silver + '실버');
  if (d.copper > 0 || parts.length === 0) parts.push(d.copper + '동화');
  return parts.join(' ');
};

global.FRankDays.ensurePlayerEconomyStateV8 = function (state) {
  if (!state.economy) {
    state.economy = {
      wallet_copper: 0,
      migrated_v8_1_starter: false,
      total_emeralds_exchanged: 0,
      lost_parcels: []
    };
  } else {
    if (typeof state.economy.wallet_copper !== 'number') state.economy.wallet_copper = Number(state.economy.wallet_copper || 0);
    if (state.economy.migrated_v8_1_starter === undefined) state.economy.migrated_v8_1_starter = false;
    if (typeof state.economy.total_emeralds_exchanged !== 'number') state.economy.total_emeralds_exchanged = 0;
    if (!Array.isArray(state.economy.lost_parcels)) state.economy.lost_parcels = [];
  }
  return state.economy;
};

// 기존 v7.3 / 초기 v8.0 플레이어 무손실 1회 화폐 마이그레이션 정착금 지급
global.FRankDays.migratePlayerEconomyIfNeededV8 = function (player) {
  if (!player || !global.FRankDays.loadPlayerState) return { migrated: false };
  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);
  if (!(state.guild_card && state.guild_card.issued)) return {migrated:false,reason:'registration_required',wallet_copper:eco.wallet_copper};
  if (eco.migrated_v8_1_starter) {
    return { migrated: false, already_done: true, wallet_copper: eco.wallet_copper };
  }
  var cfg = global.FRankDays.getEconomyConfigV8();
  var grant = Number((cfg.emerald_migration && cfg.emerald_migration.one_time_v8_1_starter_grant_copper) || 200);
  eco.migrated_v8_1_starter = true;
  eco.wallet_copper += grant;
  global.FRankDays.savePlayerState(player, state);
  return {
    migrated: true,
    granted_copper: grant,
    granted_formatted: global.FRankDays.formatCurrencyV8(grant),
    wallet_copper: eco.wallet_copper
  };
};

// 플레이어 총 가용 화폐 조회 (지갑 잔액 + 인벤토리 실물 동화·실버·골드 합산)
global.FRankDays.getPlayerBalanceSummaryV8 = function (player) {
  var cfg = global.FRankDays.getEconomyConfigV8();
  var coins = cfg.coin_items;
  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);

  var invCopperCnt = global.FRankDays.countPlayerItem ? global.FRankDays.countPlayerItem(player, coins.copper) : 0;
  var invSilverCnt = global.FRankDays.countPlayerItem ? global.FRankDays.countPlayerItem(player, coins.silver) : 0;
  var invGoldCnt = global.FRankDays.countPlayerItem ? global.FRankDays.countPlayerItem(player, coins.gold) : 0;
  var invTotalCopper = invGoldCnt * 1000 + invSilverCnt * 10 + invCopperCnt;
  var totalCopper = eco.wallet_copper + invTotalCopper;

  return {
    wallet_copper: eco.wallet_copper,
    inventory_coins_copper: invTotalCopper,
    inv_gold: invGoldCnt,
    inv_silver: invSilverCnt,
    inv_copper: invCopperCnt,
    total_copper: totalCopper,
    formatted_total: global.FRankDays.formatCurrencyV8(totalCopper),
    formatted_wallet: global.FRankDays.formatCurrencyV8(eco.wallet_copper)
  };
};

// 인벤토리 실물 주화 -> 지갑 일괄 입금
global.FRankDays.depositAllCoinsToWalletV8 = function (player) {
  var cfg = global.FRankDays.getEconomyConfigV8();
  var coins = cfg.coin_items;
  var bal = global.FRankDays.getPlayerBalanceSummaryV8(player);
  if (bal.inventory_coins_copper <= 0) {
    return { ok: false, reason: 'no_physical_coins_in_inventory', message: '[화폐 지갑] 인벤토리에 입금할 실물 동화·실버·골드가 없습니다.' };
  }

  var deposited = 0;
  if (bal.inv_gold > 0 && global.FRankDays.consumePlayerItemExact(player, coins.gold, bal.inv_gold)) {
    deposited += bal.inv_gold * 1000;
  }
  if (bal.inv_silver > 0 && global.FRankDays.consumePlayerItemExact(player, coins.silver, bal.inv_silver)) {
    deposited += bal.inv_silver * 10;
  }
  if (bal.inv_copper > 0 && global.FRankDays.consumePlayerItemExact(player, coins.copper, bal.inv_copper)) {
    deposited += bal.inv_copper;
  }

  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);
  eco.wallet_copper += deposited;
  global.FRankDays.savePlayerState(player, state);

  var msg = '[화폐 지갑] ' + global.FRankDays.formatCurrencyV8(deposited) + ' 입금 완료! (현재 지갑: ' + global.FRankDays.formatCurrencyV8(eco.wallet_copper) + ')';
  if (player.tell) player.tell(msg);
  return { ok: true, deposited_copper: deposited, wallet_copper: eco.wallet_copper, message: msg };
};

// 지갑 -> 실물 주화 인출 (최대 단위부터 자동 환산 지급)
global.FRankDays.withdrawCoinsFromWalletV8 = function (player, amountCopper) {
  var req = Math.floor(Number(amountCopper || 0));
  if (req <= 0) return { ok: false, reason: 'invalid_withdraw_amount' };

  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);
  if (eco.wallet_copper < req) {
    return {
      ok: false,
      reason: 'insufficient_wallet_funds',
      wallet_copper: eco.wallet_copper,
      message: '[화폐 지갑] 지갑 잔액이 부족합니다. (보유: ' + global.FRankDays.formatCurrencyV8(eco.wallet_copper) + ')'
    };
  }

  var cfg = global.FRankDays.getEconomyConfigV8();
  var coins = cfg.coin_items;
  var d = global.FRankDays.decomposeCopperV8(req);
  eco.wallet_copper -= req;
  global.FRankDays.savePlayerState(player, state);

  if (player.give) {
    if (d.gold > 0) player.give(d.gold + 'x ' + coins.gold);
    if (d.silver > 0) player.give(d.silver + 'x ' + coins.silver);
    if (d.copper > 0) player.give(d.copper + 'x ' + coins.copper);
  }
  var msg = '[화폐 지갑] 실물 주화 ' + global.FRankDays.formatCurrencyV8(req) + ' 인출 완료! (남은 지갑: ' + global.FRankDays.formatCurrencyV8(eco.wallet_copper) + ')';
  if (player.tell) player.tell(msg);
  return { ok: true, withdrawn: d, wallet_copper: eco.wallet_copper, message: msg };
};

// 통합 화폐 보상 지급 (기본 지갑 적립 + 선택적 실물 주화 지급 지원)
global.FRankDays.grantPlayerCurrencyV8 = function (player, amountCopper, asPhysicalCoins) {
  var amt = Math.max(0, Math.floor(Number(amountCopper || 0)));
  if (amt <= 0) return { ok: true, granted_copper: 0 };

  if (asPhysicalCoins && player.give) {
    var cfg = global.FRankDays.getEconomyConfigV8();
    var coins = cfg.coin_items;
    var d = global.FRankDays.decomposeCopperV8(amt);
    if (d.gold > 0) player.give(d.gold + 'x ' + coins.gold);
    if (d.silver > 0) player.give(d.silver + 'x ' + coins.silver);
    if (d.copper > 0) player.give(d.copper + 'x ' + coins.copper);
    return { ok: true, granted_copper: amt, formatted: global.FRankDays.formatCurrencyV8(amt), mode: 'physical' };
  }

  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);
  eco.wallet_copper += amt;
  global.FRankDays.savePlayerState(player, state);
  return {
    ok: true,
    granted_copper: amt,
    formatted: global.FRankDays.formatCurrencyV8(amt),
    wallet_copper: eco.wallet_copper,
    mode: 'wallet'
  };
};

// 통합 화폐 차감 결제기 (지갑 우선 차감 -> 부족 시 인벤토리 실물 주화 자동 환산 및 거스름돈 지갑 반환!)
global.FRankDays.chargePlayerCurrencyV8 = function (player, costCopper) {
  var cost = Math.max(0, Math.floor(Number(costCopper || 0)));
  if (cost <= 0) return { ok: true, charged_copper: 0 };

  var bal = global.FRankDays.getPlayerBalanceSummaryV8(player);
  if (bal.total_copper < cost) {
    return {
      ok: false,
      reason: 'insufficient_currency',
      required_copper: cost,
      have_copper: bal.total_copper,
      required_formatted: global.FRankDays.formatCurrencyV8(cost),
      have_formatted: bal.formatted_total,
      message: '[화폐 부족] 필요 금액: ' + global.FRankDays.formatCurrencyV8(cost) + ' (보유 총액: ' + bal.formatted_total + ')'
    };
  }

  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);

  // 지갑 잔액만으로 충분한 경우 즉시 차감
  if (eco.wallet_copper >= cost) {
    eco.wallet_copper -= cost;
    global.FRankDays.savePlayerState(player, state);
    return {
      ok: true,
      charged_copper: cost,
      remaining_total_copper: bal.total_copper - cost,
      formatted_charged: global.FRankDays.formatCurrencyV8(cost)
    };
  }

  // 지갑 잔액 + 실물 주화 복합 결제: 부족분만큼 동화->실버->골드 순으로 실물 주화를 수거하고 초과액은 지갑에 거스름돈 입금!
  var deficit = cost - eco.wallet_copper;
  eco.wallet_copper = 0;

  var cfg = global.FRankDays.getEconomyConfigV8();
  var coins = cfg.coin_items;
  var collectedFromCoins = 0;

  if (deficit > 0 && bal.inv_copper > 0) {
    var takeC = Math.min(bal.inv_copper, deficit);
    if (takeC > 0 && global.FRankDays.consumePlayerItemExact(player, coins.copper, takeC)) {
      collectedFromCoins += takeC;
      deficit -= takeC;
    }
  }
  if (deficit > 0 && bal.inv_silver > 0) {
    var needS = Math.min(bal.inv_silver, Math.ceil(deficit / 10));
    if (needS > 0 && global.FRankDays.consumePlayerItemExact(player, coins.silver, needS)) {
      collectedFromCoins += needS * 10;
      deficit -= needS * 10;
    }
  }
  if (deficit > 0 && bal.inv_gold > 0) {
    var needG = Math.min(bal.inv_gold, Math.ceil(deficit / 1000));
    if (needG > 0 && global.FRankDays.consumePlayerItemExact(player, coins.gold, needG)) {
      collectedFromCoins += needG * 1000;
      deficit -= needG * 1000;
    }
  }

  if (deficit > 0) {
    // 비정상 동시 슬롯 변동 방어 롤백
    eco.wallet_copper += collectedFromCoins;
    global.FRankDays.savePlayerState(player, state);
    return { ok: false, reason: 'coin_consume_race_aborted' };
  }

  // 거스름돈(`-deficit`)을 지갑에 무손실 환급
  var changeCopper = Math.max(0, -deficit);
  eco.wallet_copper += changeCopper;
  global.FRankDays.savePlayerState(player, state);

  return {
    ok: true,
    charged_copper: cost,
    change_deposited_copper: changeCopper,
    remaining_total_copper: bal.total_copper - cost,
    formatted_charged: global.FRankDays.formatCurrencyV8(cost)
  };
};

// 기존 에메랄드 -> 3단 화폐 공인 환전 (마이그레이션 지원: 기본 1 에메랄드 = 10 실버 = 100 동화)
global.FRankDays.exchangeEmeraldsToCurrencyV8 = function (player, emeraldCountOpt) {
  var cfg = global.FRankDays.getEconomyConfigV8();
  var mig = cfg.emerald_migration || {};
  if (mig.allow_guild_emerald_to_coin_exchange === false) {
    return { ok: false, reason: 'emerald_exchange_disabled' };
  }

  var haveEm = global.FRankDays.countPlayerItem ? global.FRankDays.countPlayerItem(player, 'minecraft:emerald') : 0;
  var count = emeraldCountOpt !== undefined && emeraldCountOpt !== null
    ? Math.min(haveEm, Math.max(0, Math.floor(Number(emeraldCountOpt))))
    : haveEm;

  if (count <= 0) {
    return {
      ok: false,
      reason: 'no_emeralds_to_exchange',
      message: '[길드 환전소] 환전할 에메랄드가 인벤토리에 없습니다. (환율: 1 에메랄드 = 10실버 [100동화])'
    };
  }

  if (!global.FRankDays.consumePlayerItemExact(player, 'minecraft:emerald', count)) {
    return { ok: false, reason: 'emerald_consume_failed' };
  }

  var rate = Number(mig.copper_per_emerald || 100);
  var gainedCopper = count * rate;

  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);
  eco.wallet_copper += gainedCopper;
  eco.total_emeralds_exchanged = Number(eco.total_emeralds_exchanged || 0) + count;
  global.FRankDays.savePlayerState(player, state);

  var msg =
    '[길드 환전 완료] 에메랄드 ' + count + '개를 ' +
    global.FRankDays.formatCurrencyV8(gainedCopper) +
    '로 환전하여 지갑에 입금했습니다! (현재 지갑: ' +
    global.FRankDays.formatCurrencyV8(eco.wallet_copper) + ')';
  if (player.tell) player.tell(msg);

  return {
    ok: true,
    exchanged_emeralds: count,
    gained_copper: gainedCopper,
    wallet_copper: eco.wallet_copper,
    message: msg
  };
};

// =========================================================================
// 족제비(jokjebi) 유실물 회수 시스템 (Weasel Lost-and-Found Recovery)
// - npcs.json 미정 캐릭터 정책을 엄수하여 임의의 종족/말투/서사를 꾸며내지 않고
//   표준 유실물 회수 보관 대장과 3단 화폐 수수료 정산 구조만 연결합니다.
// =========================================================================
global.FRankDays.calculateLostRecoveryFeeCopperV8 = function (itemsArray) {
  var cfg = global.FRankDays.getEconomyConfigV8();
  var wf = cfg.weasel_lost_and_found || {};
  var base = Number(wf.base_fee_copper || 50);       // 5 실버
  var perStack = Number(wf.per_stack_fee_copper || 20); // 묶음당 2 실버
  var cap = Number(wf.max_fee_cap_copper || 500);     // 상한 50 실버
  var countStacks = Array.isArray(itemsArray) ? Math.max(1, itemsArray.length) : 1;
  return Math.min(cap, base + countStacks * perStack);
};

// 유실물 꾸러미 등록 (사망 현장 수습품 또는 분실 등록품 보관)
global.FRankDays.registerLostParcelForRecoveryV8 = function (player, itemsList, regionNameOpt, reasonOpt) {
  if (!player || !Array.isArray(itemsList) || itemsList.length === 0) {
    return { ok: false, reason: 'empty_lost_items' };
  }
  var cfg = global.FRankDays.getEconomyConfigV8();
  var maxParcels = Number((cfg.weasel_lost_and_found && cfg.weasel_lost_and_found.max_stored_parcels_per_player) || 10);

  var cleanItems = [];
  for (var i = 0; i < itemsList.length; i++) {
    var it = itemsList[i];
    if (it && it.id && String(it.id) !== 'minecraft:air' && Number(it.count || 0) > 0) {
      cleanItems.push({
        id: String(it.id),
        count: Math.floor(Number(it.count || 1)),
        nbt: it.nbt ? JSON.parse(JSON.stringify(it.nbt)) : null
      });
    }
  }
  if (cleanItems.length === 0) return { ok: false, reason: 'no_valid_items' };

  var feeCopper = global.FRankDays.calculateLostRecoveryFeeCopperV8(cleanItems);
  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);

  var parcelId = 'LP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  var parcel = {
    parcel_id: parcelId,
    created_at: Date.now(),
    region: String(regionNameOpt || '브리온 외곽'),
    reason: String(reasonOpt || '현장 유실물 수거'),
    fee_copper: feeCopper,
    items: cleanItems,
    recovered: false
  };

  eco.lost_parcels.push(parcel);
  if (eco.lost_parcels.length > maxParcels) {
    eco.lost_parcels = eco.lost_parcels.slice(eco.lost_parcels.length - maxParcels);
  }
  global.FRankDays.savePlayerState(player, state);

  return {
    ok: true,
    parcel_id: parcelId,
    fee_copper: feeCopper,
    fee_formatted: global.FRankDays.formatCurrencyV8(feeCopper),
    stack_count: cleanItems.length
  };
};

global.FRankDays.listPendingLostParcelsV8 = function (player) {
  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);
  var pending = [];
  for (var i = 0; i < eco.lost_parcels.length; i++) {
    if (!eco.lost_parcels[i].recovered) {
      pending.push(eco.lost_parcels[i]);
    }
  }
  return pending;
};

// 유실물 회수 실행 (수수료 결제 -> NBT 포함 원본 아이템 전량 반환)
global.FRankDays.recoverLostParcelV8 = function (player, parcelIdOpt) {
  var state = global.FRankDays.loadPlayerState(player);
  var eco = global.FRankDays.ensurePlayerEconomyStateV8(state);

  var targetIdx = -1;
  for (var i = 0; i < eco.lost_parcels.length; i++) {
    var p = eco.lost_parcels[i];
    if (!p.recovered && (!parcelIdOpt || p.parcel_id === parcelIdOpt)) {
      targetIdx = i;
      break;
    }
  }

  if (targetIdx === -1) {
    return {
      ok: false,
      reason: 'no_pending_lost_parcel',
      message: '[족제비 유실물 회수 대장] 현재 보관 중인 미회수 유실물이 없습니다.'
    };
  }

  var parcel = eco.lost_parcels[targetIdx];
  var payRes = global.FRankDays.chargePlayerCurrencyV8(player, parcel.fee_copper);
  if (!payRes.ok) {
    return {
      ok: false,
      reason: 'insufficient_recovery_fee',
      required_copper: parcel.fee_copper,
      message:
        '[족제비 유실물 회수 대장] 유실물 회수 수수료(' +
        global.FRankDays.formatCurrencyV8(parcel.fee_copper) +
        ')가 부족합니다. (보유: ' +
        payRes.have_formatted + ')'
    };
  }

  // chargePlayerCurrencyV8가 저장한 최신 state를 다시 불러와 recovered 마킹(지갑 차감 덮어쓰기 방지!)
  var freshState = global.FRankDays.loadPlayerState(player);
  var freshEco = global.FRankDays.ensurePlayerEconomyStateV8(freshState);
  for (var j = 0; j < freshEco.lost_parcels.length; j++) {
    if (freshEco.lost_parcels[j].parcel_id === parcel.parcel_id) {
      freshEco.lost_parcels[j].recovered = true;
      freshEco.lost_parcels[j].recovered_at = Date.now();
      break;
    }
  }
  global.FRankDays.savePlayerState(player, freshState);

  // 보관된 아이템 반환 (NBT 보존 지원)
  var restoredCount = 0;
  for (var k = 0; k < parcel.items.length; k++) {
    var entry = parcel.items[k];
    restoredCount += entry.count;
    if (typeof Item !== 'undefined' && Item && typeof Item.of === 'function' && entry.nbt && player.give) {
      player.give(Item.of(entry.id, entry.count, entry.nbt));
    } else if (player.give) {
      player.give(entry.count + 'x ' + entry.id);
    }
  }

  var msg =
    '[족제비 유실물 회수 완료] 수수료 ' +
    global.FRankDays.formatCurrencyV8(parcel.fee_copper) +
    '를 정산하고 보관 꾸러미(' +
    parcel.parcel_id +
    ', 총 ' +
    parcel.items.length +
    '묶음)를 안전하게 회수했습니다.';
  if (player.tell) player.tell(msg);

  return {
    ok: true,
    parcel_id: parcel.parcel_id,
    fee_paid_copper: parcel.fee_copper,
    restored_stacks: parcel.items.length,
    restored_total_count: restoredCount,
    items: parcel.items,
    message: msg
  };
};

// 실물 화폐 우클릭 시 지갑 즉시 입금 & 로그인 시 1회 마이그레이션 자동 점검
if (typeof PlayerEvents !== 'undefined' && PlayerEvents.loggedIn) {
  PlayerEvents.loggedIn(function (event) {
    if (event && event.player) {
      var mig = global.FRankDays.migratePlayerEconomyIfNeededV8(event.player);
      if (mig.migrated && event.player.tell) {
        event.player.tell('[아르베른 통화 개편 안내] 신규 3단 화폐(1골드=100실버=1,000동화) 정착 지원금 ' + mig.granted_formatted + '가 지갑에 지급되었습니다! 기존 에메랄드는 길드에서 환전하실 수 있습니다.');
      }
    }
  });
}

if (typeof ItemEvents !== 'undefined' && ItemEvents.rightClicked) {
  ItemEvents.rightClicked(function (event) {
    if (!event || !event.item || !event.player) return;
    var iid = String(event.item.id);
    if (
      iid === 'f_rank_days:copper_coin' ||
      iid === 'f_rank_days:silver_coin' ||
      iid === 'f_rank_days:gold_coin'
    ) {
      global.FRankDays.depositAllCoinsToWalletV8(event.player);
    }
  });
}
