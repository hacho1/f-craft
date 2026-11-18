// Chapter 1 equipment history. The world ledger follows weapon UIDs, including
// delayed projectiles, dropped/traded stacks, and retired inheritance ancestors.
global.FRankDays = global.FRankDays || {};
(function (F) {
  var KEY = 'f_rank_heirloom_ledger_v10', sessions = {}, atomicDepth = {}, heldSignatures = {};
  function playerId(p) { return String(p && (p.uuid || p.username) || ''); }
  function fail(reason, message) { return { ok: false, reason: reason, message: message || reason }; }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function stable(x) {
    if (!x || typeof x !== 'object') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
    var keys = Object.keys(x).sort(), a = [];
    for (var i = 0; i < keys.length; i++) a.push(JSON.stringify(keys[i]) + ':' + stable(x[keys[i]]));
    return '{' + a.join(',') + '}';
  }
  function safe(k) { return k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
  function count(x) { x = Number(x); return isFinite(x) ? Math.max(0, Math.floor(x)) : 0; }
  function plain(x) {
    if (x === null || x === undefined) return null;
    // Nested KubeJS tags are raw native values: Rhino typeof rejects them.
    // Use the installed Rhino public conversion before any JS type operation.
    if (typeof Java !== 'undefined') return JSON.parse(String(Java.loadClass('dev.latvian.mods.rhino.mod.util.NBTUtils').toJson(x)));
    if (typeof x !== 'object') return x;
    if (typeof x.getId === 'function') {
      var type = Number(x.getId());
      if (type >= 1 && type <= 6) return Number(x.getAsNumber());
      if (type === 8) return String(x.getAsString());
      if (type === 7 || type === 11 || type === 12) { var nativeArray = type === 7 ? x.getAsByteArray() : (type === 11 ? x.getAsIntArray() : x.getAsLongArray()), arr = []; for (var na = 0; na < nativeArray.length; na++) arr.push(Number(nativeArray[na])); return arr; }
      if (type === 9) { var a = []; for (var ai = 0; ai < x.size(); ai++) a.push(plain(x.get(ai))); return a; }
    }
    if (typeof x.getAllKeys === 'function' && typeof x.get === 'function') {
      var obj = {}, it = x.getAllKeys().iterator();
      while (it.hasNext()) { var key = String(it.next()); if (safe(key)) obj[key] = plain(x.get(key)); }
      return obj;
    }
    if (Array.isArray(x)) { var list = []; for (var li = 0; li < x.length; li++) list.push(plain(x[li])); return list; }
    var out = {}; for (var k in x) if (safe(k) && typeof x[k] !== 'function') out[k] = plain(x[k]); return out;
  }
  function uid(stack) { return String(stack && stack.nbt && stack.nbt.f_rank_enhance && stack.nbt.f_rank_enhance.uid || ''); }
  function validUid(id) { return !!id && id.length <= 180 && safe(id); }
  function raw(server) {
    if (!server || !server.persistentData) return '';
    var pd = server.persistentData;
    if (pd.contains && pd.contains(KEY, 10)) {
      var compound = pd.getCompound(KEY), n = Number(compound.getInt('chunk_count')), value = '';
      if (n < 0 || n > 100000) throw new Error('heirloom_chunk_count_invalid');
      for (var i = 0; i < n; i++) value += String(compound.getString('chunk_' + i));
      return value;
    }
    return String(pd.getString(KEY) || ''); // non-destructive legacy JSON reader
  }
  function storeRaw(server, text) {
    var pd = server.persistentData;
    if (pd.put && pd.getCompound && pd.contains) {
      var compound = pd.getCompound(KEY).copy(), oldCount = Number(compound.getInt('chunk_count')), n = Math.ceil(text.length / 8192);
      // Each StringTag stays under24576 modified-UTF bytes, safely below65535.
      for (var i = 0; i < n; i++) compound.putString('chunk_' + i, text.substring(i * 8192, (i + 1) * 8192));
      for (var j = n; j < oldCount; j++) compound.remove('chunk_' + j);
      compound.putInt('chunk_count', n); compound.putInt('schema', 1); pd.put(KEY, compound);
    } else pd.putString(KEY, text); // explicit Node mock fallback only
  }
  function snapshotWorld(server) {
    var pd = server.persistentData;
    if (pd.contains && pd.put && pd.get) return { native: true, exists: pd.contains(KEY), tag: pd.contains(KEY) ? pd.get(KEY).copy() : null };
    return { native: false, text: raw(server) };
  }
  function restoreWorld(server, snapshot) {
    var pd = server.persistentData;
    if (snapshot.native) { if (snapshot.exists) pd.put(KEY, snapshot.tag.copy()); else pd.remove(KEY); }
    else pd.putString(KEY, snapshot.text);
  }
  function load(server) {
    var text = raw(server), ledger;
    try { ledger = text ? JSON.parse(text) : { schema: 1, records: {}, aliases: {} }; }
    catch (e) { throw new Error('heirloom_ledger_unreadable'); }
    if (!ledger || !ledger.records || !ledger.aliases) throw new Error('heirloom_ledger_invalid');
    return ledger;
  }
  function save(server, ledger) {
    if (!server || !server.persistentData) throw new Error('heirloom_world_storage_missing');
    var encoded = JSON.stringify(ledger); storeRaw(server, encoded);
    if (raw(server) !== encoded) throw new Error('heirloom_ledger_write_failed');
  }
  function resolve(ledger, id) {
    var visited = {}; while (validUid(id) && ledger.aliases[id]) {
      if (visited[id]) throw new Error('heirloom_alias_cycle'); visited[id] = true; id = String(ledger.aliases[id]);
    }
    return id;
  }
  function normalize(h) {
    h = h || {}; h.slain_count = count(h.slain_count); h.harvest_count = count(h.harvest_count);
    h.lineage_gen = Math.max(1, count(h.lineage_gen)); h.rename_count = count(h.rename_count);
    if (h.forged_day !== undefined && (!isFinite(Number(h.forged_day)) || Number(h.forged_day) < 0)) h.forged_day = -1;
    h.custom_epithet = String(h.custom_epithet || ''); return h;
  }
  function mergedHistory(record, stack) {
    var incoming = normalize(plain(stack && stack.nbt && stack.nbt.f_rank_heirloom) || {});
    if (!record) return incoming;
    var history = normalize(clone(record.history));
    // Import unknown extension fields without allowing stale stacks to undo the ledger.
    for (var k in incoming) if (safe(k) && history[k] === undefined) history[k] = incoming[k];
    history.slain_count = Math.max(history.slain_count, incoming.slain_count);
    history.harvest_count = Math.max(history.harvest_count, incoming.harvest_count);
    history.rename_count = Math.max(history.rename_count, incoming.rename_count);
    history.lineage_gen = Math.max(history.lineage_gen, incoming.lineage_gen);
    return history;
  }
  function ensureUid(stack) {
    if (!uid(stack)) {
      if (!F.applyEnhancementDataToStack(stack, F.getWeaponEnhanceLevel(stack))) throw new Error('heirloom_uid_prepare_failed');
    }
    if (!validUid(uid(stack))) throw new Error('heirloom_uid_invalid');
    return uid(stack);
  }
  function writeHistory(stack, h) {
    var nbt = F.ensureStackNbtObject(stack); nbt.f_rank_heirloom = clone(h);
    if (typeof stack.setNbt === 'function') stack.setNbt(nbt);
    F.applyChapter1HeirloomLoreV10(stack);
    var read = normalize(plain(stack.nbt && stack.nbt.f_rank_heirloom));
    if (stable(read) !== stable(normalize(clone(h)))) throw new Error('heirloom_stack_write_failed');
  }
  function slots(p) {
    var result = [], inv = p && p.inventory;
    if (inv && typeof inv.getItem === 'function') {
      var n = typeof inv.getContainerSize === 'function' ? Number(inv.getContainerSize()) : 36;
      for (var i = 0; i < n; i++) result.push({ slot: i, stack: inv.getItem(i) });
    } else if (inv && Array.isArray(inv.slots)) {
      for (var j = 0; j < inv.slots.length; j++) result.push({ slot: j, stack: inv.slots[j] });
    } else result.push({ slot: 'mainhand', stack: p && p.mainHandItem });
    // Native inventory slot40 is offhand. Avoid counting the same real stack twice.
    if (!inv || typeof inv.getContainerSize !== 'function' || Number(inv.getContainerSize()) <= 40) result.push({ slot: 'offhand', stack: p && p.offHandItem });
    return result;
  }
  function find(p, id) {
    var list = slots(p), matches = [];
    for (var i = 0; i < list.length; i++) if (uid(list[i].stack) === id && !list[i].stack.empty && Number(list[i].stack.count || 1) > 0) matches.push(list[i]);
    return matches;
  }
  function recordFor(ledger, stack) {
    var id = ensureUid(stack), canonical = resolve(ledger, id);
    if (canonical !== id) return null; // A copied retired source is never resurrected.
    var r = ledger.records[id];
    if (r && r.item_id !== String(stack.id)) throw new Error('heirloom_uid_item_conflict');
    if (!r) r = { weapon_uid: id, item_id: String(stack.id), history: {}, kills: {}, harvests: {}, pending: false };
    r.history = mergedHistory(ledger.records[id], stack); r.kills = r.kills || {}; r.harvests = r.harvests || {};
    ledger.records[id] = r; return r;
  }
  function atomic(p, fn) {
    var key = playerId(p);
    if (atomicDepth[key]) return fail('transaction_busy');
    var before = snapshotWorld(p.server); atomicDepth[key] = true;
    try {
      if (typeof F.runAtomicPlayerV96 !== 'function') return fail('atomic_service_unavailable');
      var result = F.runAtomicPlayerV96(p, fn);
      if (!result || !result.ok) restoreWorld(p.server, before);
      return result;
    } catch (e) { restoreWorld(p.server, before); throw e; }
    finally { delete atomicDepth[key]; }
  }

  F.getHeirloomLedgerV10 = function (server) { return clone(load(server)); };
  F.getChapter1EnhancementPerksV10 = function (stack) {
    var spec = F.getWeaponSpecV8(stack && stack.id), level = spec ? F.getWeaponEnhanceLevel(stack) : 0;
    var field = !!(spec && spec.is_field_tool), cfg = F.getEnhanceConfigV8().chapter1_breakthroughs || {};
    return { level: level, family: spec ? spec.family : '', is_field_tool: field,
      attack_speed_multiplier: level >= 5 ? 1.08 : 1,
      break_speed_multiplier: field && level >= 5 ? 1.15 : 1,
      fishing_wait_multiplier: field && level >= 5 ? 0.90 : 1,
      charged_hit_mana_bonus: level >= 10 ? 2 : 0,
      skill_cooldown_multiplier: level >= 15 ? 0.90 : 1,
      critical_damage_multiplier: level >= 15 ? 1.12 : 1,
      extra_yield_chance: field && level >= 10 ? 0.15 : 0,
      durability_protection_chance: field && level >= 15 ? 0.30 : 0,
      rare_find_multiplier: field && level >= 15 ? Math.max(1, Math.min(2, Number(cfg.rare_find_multiplier || 1.15))) : 1 };
  };
  F.applyChapter1HeirloomLoreV10 = function (stack) {
    if (!stack || !F.getWeaponSpecV8(stack.id)) return;
    var nbt = F.ensureStackNbtObject(stack), p = F.getChapter1EnhancementPerksV10(stack), lore = [], old = F.readWeaponNbtListV91(nbt.display && nbt.display.Lore);
    for (var i = 0; i < old.length; i++) {
      var entry = String(old[i]), parsed;
      try { parsed = JSON.parse(entry); } catch (e) { parsed = null; }
      if (!parsed || parsed.fcraft_chapter1_v10 !== true) lore.push(old[i]);
    }
    function line(text, color) { lore.push(JSON.stringify({ text: text, color: color || 'gold', italic: false, fcraft_chapter1_v10: true })); }
    if (p.level >= 5) line('★ +5 돌파 · 공속 +8%' + (p.is_field_tool ? ' · 채굴 +15% · 입질 대기 -10%' : ''));
    if (p.level >= 10) line('★★ +10 돌파 · 풀차징 마나 +2' + (p.is_field_tool ? ' · 부산물 15%' : ''));
    if (p.level >= 15) line('★★★ +15 돌파 · X/C 쿨타임 -10% · 치명 피해 +12%' + (p.is_field_tool ? ' · 내구 보호 30% · 희귀 확률 ×1.15' : ''));
    var h = nbt.f_rank_heirloom && normalize(plain(nbt.f_rank_heirloom));
    if (h) {
      line('✦ 제' + h.lineage_gen + '대 가보' + (h.custom_epithet ? ' 「' + h.custom_epithet + '」' : '') + ' — 누적 토벌 ' + h.slain_count + '기');
      line('누적 수확: ' + h.harvest_count + '회 · ' + (h.forged_day === undefined || Number(h.forged_day) < 0 ? '단조일 기록 없음' : '아르베른력 제' + h.forged_day + '일 단조'), 'yellow');
    }
    nbt.display = nbt.display || {}; nbt.display.Lore = lore;
    if (typeof stack.setNbt === 'function') stack.setNbt(nbt);
  };
  F.refreshHeirloomStackV10 = function (p, stack) {
    if (!stack || stack.empty || !F.getWeaponSpecV8(stack.id) || F.getWeaponEnhanceLevel(stack) < 1 && !(stack.nbt && stack.nbt.f_rank_heirloom) && !(F.getGuardianGearSpecV102 && F.getGuardianGearSpecV102(String(stack.id)))) return fail('not_heirloom');
    var id = ensureUid(stack), matches = find(p, id);
    if (matches.length > 1) return fail('duplicate_weapon_uid');
    // Migrate pre-patch stored attribute/ranged amounts at their current level.
    if (!F.applyEnhancementDataToStack(stack, F.getWeaponEnhanceLevel(stack))) return fail('enhancement_refresh_failed');
    var ledger = load(p.server), record = recordFor(ledger, stack);
    if (!record) return fail('retired_weapon_uid');
    writeHistory(stack, record.history); record.pending = false;
    save(p.server, ledger); return { ok: true, weapon_uid: id, history: clone(record.history) };
  };
  F.onWeaponEnhancedHeirloomV10 = function (p, stack, previous, next, success) {
    if (Number(next) < 1 && !(stack.nbt && stack.nbt.f_rank_heirloom)) return;
    var ledger = load(p.server), id = ensureUid(stack), existed = ledger.records[id] || stack.nbt && stack.nbt.f_rank_heirloom, r = recordFor(ledger, stack);
    if (!r) throw new Error('retired_weapon_uid');
    if (!existed && success && Number(previous) === 0) {
      var day = typeof F.getCurrentGameDayV8 === 'function' ? Number(F.getCurrentGameDayV8(p.server)) : Math.floor(Number(p.server.overworld().getDayTime()) / 24000);
      if (isFinite(day) && day >= 0) r.history.forged_day = Math.floor(day);
    }
    if (success && (Number(next) === 5 || Number(next) === 10 || Number(next) === 15)) {
      r.history.breakthroughs_v10 = r.history.breakthroughs_v10 || {};
      if (!r.history.breakthroughs_v10[String(next)]) r.history.breakthroughs_v10[String(next)] = Date.now();
    }
    writeHistory(stack, r.history); save(p.server, ledger);
  };
  F.captureHeirloomSourceV10 = function (p, stack, hand, actionId) {
    if (!p || !stack || F.getWeaponEnhanceLevel(stack) < 1 && !(F.getGuardianGearSpecV102 && F.getGuardianGearSpecV102(String(stack.id))) || !F.getWeaponSpecV8(stack.id)) return null;
    var refresh = F.refreshHeirloomStackV10(p, stack); if (!refresh.ok) return null;
    var matches = find(p, uid(stack)), slot = matches.length === 1 ? matches[0].slot : (String(hand).toLowerCase().indexOf('off') >= 0 ? 'offhand' : 'mainhand');
    var descriptor = { ownerUuid: playerId(p), weaponUid: uid(stack), itemId: String(stack.id), hand: String(hand || 'mainhand'), slotAtUse: slot,
      levelAtUse: F.getWeaponEnhanceLevel(stack), actionId: String(actionId || ''), perks: clone(F.getChapter1EnhancementPerksV10(stack)) };
    return descriptor;
  };
  function recordAction(p, descriptor, eventId, kind, victim) {
    if (!p || !descriptor || descriptor.ownerUuid !== playerId(p) || Number(descriptor.levelAtUse) < 1 && !(F.getGuardianGearSpecV102 && F.getGuardianGearSpecV102(String(descriptor.itemId))) || !validUid(String(descriptor.weaponUid || '')) || !String(eventId || '')) return fail('invalid_heirloom_source');
    if (kind === 'kill' && victim && F.isManagedTrainingTargetV10 && F.isManagedTrainingTargetV10(victim)) return fail('training_target_excluded');
    var ledger = load(p.server), original = String(descriptor.weaponUid), id = resolve(ledger, original), r = ledger.records[id];
    if (!r || !ledger.records[original] || ledger.records[original].item_id !== String(descriptor.itemId)) return fail('unknown_heirloom_source');
    var dedup = kind === 'kill' ? r.kills : r.harvests, key = String(eventId);
    if (!safe(key)) return fail('invalid_action_id');
    if (dedup[key]) return { ok: true, duplicate: true, weapon_uid: id };
    dedup[key] = { source_uid: original, action_id: String(descriptor.actionId || ''), owner_uuid: playerId(p) };
    if (kind === 'kill') r.history.slain_count = count(r.history.slain_count) + 1;
    else r.history.harvest_count = count(r.history.harvest_count) + 1;
    r.pending = true;
    // Persist first. A dropped/traded/broken weapon's history must survive without a stack.
    save(p.server, ledger);
    var matches = find(p, id);
    if (matches.length === 1) {
      try { writeHistory(matches[0].stack, r.history); r.pending = false; save(p.server, ledger); }
      catch (e) { console.warn('[F-Craft heirloom] persisted update pending: ' + String(e)); }
    }
    return { ok: true, weapon_uid: id, pending: !!r.pending, count: kind === 'kill' ? r.history.slain_count : r.history.harvest_count };
  }
  F.recordHeirloomKillV10 = function (p, d, victimUuid, victimOpt) { return recordAction(p, d, victimUuid, 'kill', victimOpt); };
  F.recordHeirloomHarvestV10 = function (p, d, actionId) { return recordAction(p, d, actionId, 'harvest', null); };
  F.prepareHeirloomInheritanceV10 = function (p, source, target) {
    var ledger = load(p.server), sourceUid = ensureUid(source), targetUid = ensureUid(target);
    if (sourceUid === targetUid || resolve(ledger, sourceUid) !== sourceUid || resolve(ledger, targetUid) !== targetUid) return fail('retired_or_duplicate_weapon_uid');
    if (find(p, sourceUid).length > 1 || find(p, targetUid).length > 1) return fail('duplicate_weapon_uid');
    var targetHadHistory = !!(target.nbt && target.nbt.f_rank_heirloom || ledger.records[targetUid]);
    var sourceRecord = recordFor(ledger, source), targetRecord = recordFor(ledger, target);
    var history = clone(sourceRecord.history); history.lineage_gen = Math.max(1, count(history.lineage_gen)) + 1;
    var targetHistory = targetRecord.history;
    // Never silently erase a target's earlier history or the source's extensions.
    if (targetHadHistory) {
      history.previous_target_histories_v10 = history.previous_target_histories_v10 || [];
      history.previous_target_histories_v10.push({ weapon_uid: targetUid, history: clone(targetHistory) });
    }
    writeHistory(target, history);
    return { ok: true, source_uid: sourceUid, target_uid: targetUid, source_record: sourceRecord, target_record: targetRecord, history: history };
  };
  F.commitHeirloomInheritanceV10 = function (p, target, plan) {
    if (!plan || uid(target) !== plan.target_uid) throw new Error('heirloom_inheritance_target_changed');
    var actual = normalize(plain(target.nbt && target.nbt.f_rank_heirloom));
    if (stable(actual) !== stable(plan.history)) throw new Error('heirloom_inheritance_verify_failed');
    var ledger = load(p.server), sr = clone(plan.source_record), tr = clone(plan.target_record);
    sr.retired_to = plan.target_uid; sr.history = clone(plan.source_record.history);
    tr.history = clone(plan.history); tr.pending = false;
    tr.kills = tr.kills || {}; tr.harvests = tr.harvests || {};
    for (var k in sr.kills) if (safe(k)) tr.kills[k] = sr.kills[k];
    for (var a in sr.harvests) if (safe(a)) tr.harvests[a] = sr.harvests[a];
    ledger.records[plan.source_uid] = sr; ledger.records[plan.target_uid] = tr;
    ledger.aliases[plan.source_uid] = plan.target_uid; save(p.server, ledger);
  };

  F.normalizeHeirloomNameV10 = function (value) {
    var name = String(value === undefined || value === null ? '' : value).trim();
    if (typeof Java !== 'undefined') {
      var Normalizer = Java.loadClass('java.text.Normalizer'), Form = Java.loadClass('java.text.Normalizer$Form');
      name = String(Normalizer.normalize(name, Form.NFC));
    } else if (typeof name.normalize === 'function') name = name.normalize('NFC');
    if (!name || /[\u0000-\u001f\u007f-\u009f\u00a7\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/.test(name)) return fail('invalid_heirloom_name', '제어 문자·줄바꿈·서식 기호 없이 이름을 입력해 주세요.');
    var length = 0;
    for (var i = 0; i < name.length; length++) {
      // Rhino charCodeAt returns java.lang.Character; codePointAt+Number is numeric.
      var cp = Number(name.codePointAt(i));
      if (cp >= 0xd800 && cp <= 0xdfff) return fail('invalid_unicode');
      i += cp > 0xffff ? 2 : 1;
    }
    return length > 14 ? fail('heirloom_name_too_long', '이름은 유니코드 14자까지 각인할 수 있습니다.') : { ok: true, name: name, codepoints: length };
  };
  F.openHeirloomNameGuiV10 = function (p, slotOpt) {
    if (!F.isPlayerNearNauSmithyV8(p)) return fail('too_far_from_npc', '나우 가까이에서 가보 이름을 각인해 주세요.');
    var slot = slotOpt === undefined ? 'mainhand' : slotOpt, stack = F.getPlayerSlotStack(p, slot);
    if (!stack || F.getWeaponEnhanceLevel(stack) < 1 || !F.getWeaponSpecV8(stack.id)) return fail('enhanced_equipment_required', '+1 이상 강화한 장비를 선택해 주세요.');
    var refresh = F.refreshHeirloomStackV10(p, stack); if (!refresh.ok) return refresh;
    var h = refresh.history, nonce = 'heirloom_' + Date.now() + '_' + Math.floor(Math.random() * 1000000000), cost = h.rename_count > 0 ? 50 : 0;
    sessions[playerId(p)] = { nonce: nonce, slot: String(slot), weapon_uid: uid(stack), item_id: String(stack.id), opened_at: Date.now(), snapshot: F.forgeStackSnapshotV91(stack) };
    var payload = { nonce: nonce, slot: sessions[playerId(p)].slot, weapon_uid: uid(stack), item_id: String(stack.id), current_name: h.custom_epithet, max_codepoints: 14, cost_copper: cost, free_available: cost === 0 };
    if (F.closeNpcRpgDialog) F.closeNpcRpgDialog(p, true);
    if (p.sendData) p.sendData('f_rank_days:heirloom_name_open_v10', payload);
    return { ok: true, payload: payload };
  };
  F.submitHeirloomNameV10 = function (p, req) {
    req = req || {}; var session = sessions[playerId(p)], normalized = F.normalizeHeirloomNameV10(req.name);
    if (!session || String(req.nonce || '') !== session.nonce || String(req.slot) !== session.slot || String(req.weapon_uid || '') !== session.weapon_uid) return fail('invalid_heirloom_session');
    if (Date.now() - session.opened_at > 180000) return fail('expired_heirloom_session');
    if (!normalized.ok) return normalized;
    if (!F.isPlayerNearNauSmithyV8(p)) return fail('too_far_from_npc');
    var result = atomic(p, function () {
      var stack = F.getPlayerSlotStack(p, session.slot);
      if (!stack || uid(stack) !== session.weapon_uid || String(stack.id) !== session.item_id || F.forgeStackSnapshotV91(stack) !== session.snapshot) return fail('heirloom_slot_changed');
      if (find(p, session.weapon_uid).length !== 1) return fail('duplicate_weapon_uid');
      var ledger = load(p.server), r = recordFor(ledger, stack), h = r && r.history;
      if (!h) return fail('retired_weapon_uid');
      if (h.custom_epithet === normalized.name) return { ok: true, unchanged: true, name: normalized.name, cost_copper: 0 };
      var cost = h.rename_count > 0 ? 50 : 0;
      if (cost) { var payment = F.chargePlayerCurrencyV8(p, cost); if (!payment || !payment.ok) return fail('insufficient_currency', '가보 이름을 바꾸려면 5실버(50동화)가 필요합니다.'); }
      h.custom_epithet = normalized.name; h.rename_count += 1;
      writeHistory(stack, h); save(p.server, ledger);
      return { ok: true, name: normalized.name, cost_copper: cost, message: '가보에 「' + normalized.name + '」 이름을 각인했습니다.' };
    });
    if (result && result.ok) delete sessions[playerId(p)];
    return result;
  };
  // The existing inventory+wallet transaction also encloses the world UID ledger.
  var enhance = F.executeWeaponEnhancement, inherit = F.executeSafeInheritanceFromGuiV8;
  F.executeWeaponEnhancement = function (p, options) { return atomic(p, function () { return enhance(p, options); }); };
  F.executeSafeInheritanceFromGuiV8 = function (p, request) { return atomic(p, function () { return inherit(p, request); }); };
  if (typeof NetworkEvents !== 'undefined' && NetworkEvents.dataReceived) {
    NetworkEvents.dataReceived('f_rank_days:heirloom_name_submit_v10', function (event) {
      var result = F.submitHeirloomNameV10(event.player, event.data || {}); result = result || fail('heirloom_submit_failed');
      result.nonce = String((event.data || {}).nonce || '');
      if (event.player.sendData) event.player.sendData('f_rank_days:heirloom_name_result_v10', result);
    });
    NetworkEvents.dataReceived('f_rank_days:heirloom_name_open_request_v10', function (event) {
      var d = event.data || {}, gate = F.validateNauGuiRequestV91(event.player, { slot: d.slot, session_token: d.session_token, method: 'NAU' }, 'ENHANCE');
      if (gate.ok) F.openHeirloomNameGuiV10(event.player, d.slot);
    });
  }
  F.refreshHeirloomInventoryV10 = function (p) {
    var list = slots(p); for (var i = 0; i < list.length; i++) {
      var stack = list[i].stack; if (!stack || stack.empty) continue;
      if (F.getWeaponEnhanceLevel(stack) >= 1 || stack.nbt && stack.nbt.f_rank_heirloom) F.refreshHeirloomStackV10(p, stack);
    }
  };
  if (typeof PlayerEvents !== 'undefined') {
    if (PlayerEvents.loggedIn) PlayerEvents.loggedIn(function (e) { F.refreshHeirloomInventoryV10(e.player); });
    if (PlayerEvents.loggedOut) PlayerEvents.loggedOut(function (e) { delete heldSignatures[playerId(e.player)]; delete sessions[playerId(e.player)]; });
    if (PlayerEvents.tick) PlayerEvents.tick(function (e) {
      var p = e.player, hands = [p.mainHandItem, p.offHandItem], signature = '';
      for (var i = 0; i < hands.length; i++) signature += String(hands[i] && hands[i].id || '') + ':' + uid(hands[i]) + ':' + F.getWeaponEnhanceLevel(hands[i]) + '|';
      if (heldSignatures[playerId(p)] !== signature) {
        heldSignatures[playerId(p)] = signature;
        for (var h = 0; h < hands.length; h++) if (F.getWeaponEnhanceLevel(hands[h]) >= 1) F.refreshHeirloomStackV10(p, hands[h]);
      }
      if (Number(p.age || p.tickCount || 0) % 100 === 0) F.refreshHeirloomInventoryV10(p);
    });
  }
})(global.FRankDays);
