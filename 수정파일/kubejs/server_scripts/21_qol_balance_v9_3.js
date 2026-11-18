// The early-game food loop must remain useful after backpack installation.
// These are new recipes only; no existing item or player inventory is removed.
ServerEvents.recipes(function (event) {
  event.remove({ output: 'sophisticatedbackpacks:feeding_upgrade' });
  event.remove({ output: 'sophisticatedbackpacks:advanced_feeding_upgrade' });
});
