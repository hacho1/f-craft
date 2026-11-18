// 로만 시범 NPC. 게임 내 관리자 명령어: /roman_preview
// 기존 NPC와 월드 데이터를 보존하고, 32블록 안의 같은 시범 NPC는 갱신합니다.
ServerEvents.commandRegistry(function (event) {
  var Commands = event.commands;
  event.register(
    Commands.literal('roman_preview')
      .requires(function (source) { return source.hasPermission(2); })
      .executes(function (ctx) {
        var player = ctx.source.player;
        if (!player) return 0;
        try {
        var api = Java.loadClass('noppes.npcs.api.NpcAPI').Instance();
        var wrappedPlayer = api.getIEntity(player);
        var world = wrappedPlayer.getWorld();
        var nearby = world.getNearbyEntities(wrappedPlayer.getPos(), 32, 2);
        var npc = null;
        for (var i = 0; i < nearby.length; i++) {
          if (nearby[i].hasTag('roman_preview')) { npc = nearby[i]; break; }
        }
        var fresh = npc === null;
        if (fresh) {
          npc = api.createNPC(world.getMCLevel());
          npc.setPosition(wrappedPlayer.getX() + 2, wrappedPlayer.getY(), wrappedPlayer.getZ());
          npc.setHome(Math.floor(wrappedPlayer.getX() + 2), Math.floor(wrappedPlayer.getY()), Math.floor(wrappedPlayer.getZ()));
        }
        npc.addTag('roman_preview');
        npc.getDisplay().setName('로만');
        npc.getDisplay().setTitle('B급 연금술사 · 시범 NPC');
        npc.getDisplay().setSkinTexture('customnpcs:textures/entity/custom/roman_skin_64x64.png');
        npc.getDisplay().setShowingLayers(true);
        npc.getDisplay().setSize(5);
        npc.getAi().setMovingType(0);
        npc.getAi().setRetaliateType(3);
        npc.getAi().setStandingType(1);
        npc.getAi().setStopOnInteract(true);
        npc.setRotation(90);
        var interaction = [
          'function interact(e) {',
          'e.setCanceled(true);',
          'var gui = e.API.createCustomGui(171101,340,220,false,e.player);',
          'gui.setClosesOnEsc(true);',
          'gui.addTexturedRect(1,"customnpcs:textures/gui/roman_illustration.png",4,4,156,200).setTextureMaxSize(156,200);',
          'gui.addLabel(2,"로만",174,18,156,20,0xFFFFFF);',
          'gui.addLabel(3,"B급 연금술사",174,42,156,20,0xCCCCCC);',
          'gui.addLabel(4,"용건만 간단히 말해.",174,76,156,30,0xFFFFFF);',
          'gui.addLabel(5,"상태가 나쁜 약초는 매입하지 않아.",174,108,156,54,0xFFFFFF);',
          'gui.addLabel(6,"ESC로 닫기",174,190,156,20,0xBBBBBB);',
          'e.player.showCustomGui(gui);',
          '}'
        ].join(' ');
        // 전체 기본 NBT를 갱신해 CustomNPCs의 체력·속성 기본값을 유지합니다.
        var nbt = npc.getEntityNbt();
        nbt.setBoolean('NoAI', true);
        nbt.setBoolean('Invulnerable', true);
        nbt.setBoolean('PersistenceRequired', true);
        nbt.setBoolean('ScriptEnabled', true);
        nbt.putString('ScriptLanguage', 'ECMAScript');
        var scriptNbt = api.stringToNbt('{}');
        scriptNbt.putString('Script', interaction);
        scriptNbt.setList('ScriptList', []);
        scriptNbt.setList('Console', []);
        nbt.setList('Scripts', [scriptNbt]);
        npc.setEntityNbt(nbt);
        npc.setHealth(npc.getMaxHealth());
        if (fresh) npc.spawn();
        npc.getMCEntity().setYHeadRot(90);
        npc.getMCEntity().setYBodyRot(90);
        npc.updateClient();
        player.tell(fresh ? '로만 시범 NPC를 배치했습니다. 우클릭하면 일러스트가 표시됩니다.' : '근처 로만 시범 NPC의 스킨과 일러스트를 갱신했습니다.');
        return 1;
        } catch (error) {
          console.error('Roman preview failed: ' + error);
          if (error.stack) console.error(error.stack);
          player.tell('로만 배치 오류: ' + String(error).slice(0, 160));
          return 0;
        }
      })
  );
});
