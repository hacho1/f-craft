// v9.8 uses the existing player root/mirror and keeps legacy item/job records.
global.FRankDays = global.FRankDays || {};
(function (F) {
  var baseLoad = F.loadPlayerState, baseSync = F.syncFtbQuestStagesForPlayer;
  var copying = false;
  var aliases = { alchemist: 'herbalist', mage: 'relic_researcher' };
  // Preserve existing enhancement/inheritance rules while admitting the new AxeItem.
  F.WEAPON_REGISTRY_V8['f_rank_days:hardened_battleaxe'] = {
    family: 'axe', inheritance_tier: 5, is_field_tool: false, base_attack_damage: 9.5, base_attack_speed: -3.2,
    attack_range: 2.9, max_durability: 960, material_group: 'hardened', visual_model_mode: 'base_only'
  };
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function safe(key) { return key !== '__proto__' && key !== 'constructor' && key !== 'prototype'; }
  function rank(value) { return F.GRADE_ORDER.indexOf(String(value || 'UNREGISTERED')); }
  function retainLegacyExams(state, receipt, legacy, target) {
    receipt.legacy_exams = receipt.legacy_exams || {};
    if (receipt.legacy_exams[legacy]) return;
    var archive = { target: target, source_records_retained: true, curricula_changed: true, active_exams: {} }, found = false;
    if (state.job_exams_v96 && state.job_exams_v96[legacy]) { archive.job_exam = clone(state.job_exams_v96[legacy]); found = true; }
    for (var key in (state.active_exams || {})) if (key.indexOf(legacy + '_') === 0) { archive.active_exams[key] = clone(state.active_exams[key]); found = true; }
    if (state.npc_exam_written_v96 && state.npc_exam_written_v96.job === legacy) { archive.written_session = clone(state.npc_exam_written_v96); found = true; }
    if (found) receipt.legacy_exams[legacy] = archive;
  }
  function mergeProgress(target, source, key) {
    if (source === null || source === undefined) return target;
    if (target === null || target === undefined) return clone(source);
    if (key === 'grade') return rank(source) > rank(target) ? source : target;
    if (Array.isArray(source)) {
      if (!Array.isArray(target)) return target;
      var list = clone(target), seen = {};
      for (var i = 0; i < list.length; i++) seen[JSON.stringify(list[i])] = true;
      for (var j = 0; j < source.length; j++) {
        var identity = JSON.stringify(source[j]);
        if (!seen[identity]) { list.push(clone(source[j])); seen[identity] = true; }
      }
      return list;
    }
    if (typeof source === 'object' && typeof target === 'object' && !Array.isArray(target)) {
      var out = clone(target);
      for (var field in source) if (safe(field)) out[field] = mergeProgress(out[field], source[field], field);
      return out;
    }
    if (typeof source === 'number' && typeof target === 'number' && isFinite(source) && isFinite(target)) {
      if (key === 'registered_at' && source > 0 && target > 0) return Math.min(source, target);
      return Math.max(source, target);
    }
    if (typeof source === 'boolean' && typeof target === 'boolean') return target || source;
    return target === '' ? source : target;
  }
  F.mergeLegacyJobRecordV98 = function (target, source) { return mergeProgress(target || {}, source || {}, 'job'); };
  F.migrateCompatibilityStateV98 = function (state) {
    var before = JSON.stringify(state);
    var receipt = state.compatibility_v98 || (state.compatibility_v98 = { version: 1, jobs: {}, original_licenses: {} });
    receipt.jobs = receipt.jobs || {}; receipt.original_licenses = receipt.original_licenses || {};
    var licenses = state.job_licenses || (state.job_licenses = {});
    for (var legacy in aliases) {
      var next = aliases[legacy], old = licenses[legacy];
      if (!old || rank(old.grade) <= 0) continue;
      if (!receipt.original_licenses[legacy]) receipt.original_licenses[legacy] = clone(old);
      retainLegacyExams(state, receipt, legacy, next);
      if (!receipt.jobs[legacy] || rank(old.grade) > rank(licenses[next] && licenses[next].grade)) {
        licenses[next] = F.mergeLegacyJobRecordV98(licenses[next], old);
        var ledger = state.reward_ledger || (state.reward_ledger = {}), ledgerKeys = Object.keys(ledger);
        var pattern = new RegExp('(^|_)' + legacy + '(?=_|$)', 'g');
        for (var k = 0; k < ledgerKeys.length; k++) {
          var oldKey = ledgerKeys[k], mapped = oldKey.replace(pattern, '$1' + next);
          if (mapped !== oldKey && safe(mapped)) ledger[mapped] = mergeProgress(ledger[mapped], ledger[oldKey], 'receipt');
        }
        receipt.jobs[legacy] = { target: next, grade: licenses[next].grade, original_retained: true };
        state.legacy_import_log = state.legacy_import_log || [];
        var log = 'v98:' + legacy + ' mapped to ' + next + '; original job, exam and reward records retained';
        if (state.legacy_import_log.indexOf(log) < 0) state.legacy_import_log.push(log);
      }
      if (state.guild_card && state.guild_card.initial_job_id === legacy) {
        if (!receipt.primary_job_before) receipt.primary_job_before = legacy;
        state.guild_card.initial_job_id = next;
      }
      var onboarding = state.starter_onboarding;
      if (onboarding && onboarding.quests && onboarding.quests.q03_first_job && onboarding.quests.q03_first_job.first_job_id === legacy) {
        onboarding.quests.q03_first_job.first_job_id = next;
      }
      if (state.mana_v98 && state.mana_v98.active_job === legacy) state.mana_v98.active_job = next;
    }
    // The v9.6 reader may already have mapped these four IDs. Preserve its receipt.
    if (state.special_ability && state.special_ability.legacy_ability_id && !state.special_ability.reselected_at && !receipt.trait_reselect_preserved) {
      state.legacy_trait_reselect_available = true;
      receipt.trait_reselect_preserved = true;
    }
    if (state.guild_card && state.guild_card.issued && state.starter_onboarding) {
      state.starter_onboarding.first_registration_completed = true;
      // Issued legacy cards must never become an unpaid FIRST registration draft.
      var draft = state.starter_onboarding.registration_draft_v96;
      if (draft && draft.mode === 'FIRST') {
        receipt.obsolete_first_draft = clone(draft);
        delete state.starter_onboarding.registration_draft_v96;
        state.starter_onboarding.pending_step = null;
        state.guild_card.ui_open = false;
        state.guild_card.awaiting_name_input = false;
      }
    }
    return { changed: before !== JSON.stringify(state), state: state };
  };
  F.loadPlayerState = function (player, server) {
    var state = baseLoad(player, server);
    if (copying) return state;
    var result = F.migrateCompatibilityStateV98(state);
    if (result.changed) { copying = true; try { F.savePlayerState(player, state, server); } finally { copying = false; } }
    return state;
  };
  F.syncFtbQuestStagesForPlayer = function (player) {
    var result = baseSync(player), state = F.loadPlayerState(player);
    if (state.job_licenses.berserker && rank(state.job_licenses.berserker.grade) > 0) F.grantPlayerStageOnce(player, 'frank_v98_berserker_registered');
    return result;
  };
  F.getLegacyExamArchiveV98 = function (player) {
    var state = F.loadPlayerState(player), records = state.compatibility_v98.legacy_exams || {}, result = [];
    for (var key in records) result.push({ legacy_job: key, target_job: aliases[key], record: clone(records[key]) });
    return result;
  };
  F.migrateLegacyMageSkillsV98 = function (player) {
    // Copy only the available max-difference first.37 imports the historical grade
    // receipts afterwards, so a renamed Mage never mints the same grades again.
    if (!Platform.isLoaded('puffish_skills')) return false;
    var state = F.loadPlayerState(player), rec = state.compatibility_v98;
    if (!rec.jobs.mage || rec.mage_skill_points_copied) return false;
    var API = Java.loadClass('net.puffish.skillsmod.api.SkillsAPI');
    var RL = Java.loadClass('net.minecraft.resources.ResourceLocation');
    var old = API.getCategory(new RL('f_rank_days:mage')), next = API.getCategory(new RL('f_rank_days:relic_researcher'));
    if (!old.isPresent() || !next.isPresent()) return false;
    var a = old.get(), b = next.get(), raw = player.minecraftPlayer || player;
    if (a.isUnlocked(raw)) b.unlock(raw);
    // Transfer the available balance, not points already spent on retained nodes.
    var oldLeft = Math.max(0, Number(a.getPointsLeft(raw))), nextLeft = Math.max(0, Number(b.getPointsLeft(raw)));
    var source = new RL('f_rank_days:legacy_mage_unspent_v98'), transferred = Math.max(0, oldLeft - nextLeft);
    if (transferred > 0) b.setPoints(raw, source, Number(b.getPoints(raw, source)) + transferred);
    var skills = a.streamUnlockedSkills(raw).iterator(), originalSkills = [];
    while (skills.hasNext()) originalSkills.push(String(skills.next().getId()));
    state = F.loadPlayerState(player); state.compatibility_v98.mage_skill_points_copied = true;
    state.compatibility_v98.mage_original_unlocked_skills = originalSkills;
    state.compatibility_v98.mage_point_transfer = { original_available: oldLeft, original_spent: Number(a.getSpentPoints(raw)), target_available_before: nextLeft, transferred: transferred };
    // Distinct job passives are not blindly unlocked under different names.
    F.savePlayerState(player, state); return true;
  };
  PlayerEvents.loggedIn(function (event) { F.migrateLegacyMageSkillsV98(event.player); });
})(global.FRankDays);
