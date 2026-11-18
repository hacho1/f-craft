// User-provided portrait pixels and backgrounds are kept in separate assets.
// This late presentation wrapper does not create NPCs or alter their actions.
(function (F) {
  if (!F || typeof F.buildNpcDialogPayload !== 'function') return;
  var config = JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_npc_portraits.json')));
  if (!config || config.schemaVersion !== 1 || !config.portraits) throw new Error('Invalid NPC portrait registry');
  var portraits = config.portraits, aliases = config.aliases || {};
  var owns = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  for (var id in portraits) if (owns(portraits, id)) {
    var entry = portraits[id], ratio = Number(entry.portrait_aspect_ratio);
    if (typeof entry.portrait !== 'string' || !(ratio > 0) || !isFinite(ratio) || entry.portrait_is_placeholder !== false) throw new Error('Invalid NPC portrait: ' + id);
  }
  for (var alias in aliases) if (owns(aliases, alias) && !owns(portraits, String(aliases[alias]))) throw new Error('Unknown NPC portrait alias: ' + alias);
  var original = F.buildNpcDialogPayload;
  F.buildNpcDialogPayload = function () {
    var payload = original.apply(this, arguments);
    if (!payload || typeof payload !== 'object') return payload;
    var npcId = String(payload.npc_id || '');
    if (owns(aliases, npcId)) npcId = String(aliases[npcId]);
    if (!owns(portraits, npcId)) return payload;
    var portrait = portraits[npcId];
    payload.portrait = portrait.portrait;
    payload.portrait_aspect_ratio = Number(portrait.portrait_aspect_ratio);
    payload.portrait_is_placeholder = portrait.portrait_is_placeholder;
    return payload;
  };
})(global.FRankDays);
