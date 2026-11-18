// SimplySwords ships a first-login reward referencing Patchouli's optional item.
// Forge 47.4.28 parses that item before any pool conditions; without Patchouli
// the upstream table fails to load. Only replace this unavailable book reward.
ServerEvents.highPriorityData(function(event) {
  if (!Platform.isLoaded('simplyswords') || Platform.isLoaded('patchouli')) return;
  event.addJson('simplyswords:loot_tables/grant_book_on_first_join', {
    type: 'minecraft:advancement_reward',
    pools: []
  });
});
