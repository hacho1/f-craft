// Native disposable actors. Managed online actors have no network client;
// only explicitly requested fixture actors enter the real server/level lists.
global.FCraftPhase6Native = global.FCraftPhase6Native || {};
(function (N) {
  N.actors = [];
  N.connections = {};
  N.channels = {};
  N.ownedNativeConnections = {};
  N.describeRotation=function(player){
    var result={};
    for(var name of ['yaw','pitch','yRot','xRot','getYaw','getPitch','getYRot','getXRot']){
      try{var v=player[name],type=typeof v,row={type:type};
        if(type==='number'||type==='string'||type==='boolean')row.value=v;
        else if(type==='undefined')row.value=null;
        else row.value='<'+type+'>';
        if(type==='function'&&name.indexOf('get')===0){var read=player[name]();row.returnType=typeof read;if(typeof read==='number'||typeof read==='string')row.returnValue=read;}
        result[name]=row;
      }catch(error){result[name]={error:String(error)};}
    }
    return result;
  };
  N.makePlayer = function (server, id, name, pos) {
    var Player = Java.loadClass('net.minecraft.server.level.ServerPlayer');
    var Profile = Java.loadClass('com.mojang.authlib.GameProfile');
    var UUID = Java.loadClass('java.util.UUID');
    var Connection = Java.loadClass('net.minecraft.network.Connection');
    var Flow = Java.loadClass('net.minecraft.network.protocol.PacketFlow');
    var Listener = Java.loadClass('net.minecraft.server.network.ServerGamePacketListenerImpl');
    pos = pos || {}; var level = pos.level || server.overworld();
    var player = new Player(server, level, new Profile(UUID.fromString(String(id || UUID.randomUUID())), String(name || 'FC4Fixture')));
    if(!N.rotationBindingsCaptured){N.rotationBindingsCaptured=true;var bindings=N.describeRotation(player);if(N.report)N.report.rotationBindings=bindings;console.info('FCRAFT_PHASE6_ROTATION_BINDINGS '+JSON.stringify(bindings));}
    var connection = new Connection(Flow.SERVERBOUND);
    player.connection = new Listener(server, connection, player);
    N.connections[String(player.uuid)] = connection;
    server.getPlayerList().load(player);
    global.FRankDays.prepareFcraftV9Player(player, server);
    if (pos.x !== undefined) { level.getChunk(Math.floor(pos.x / 16), Math.floor(pos.z / 16)); player.setPosition(pos.x, pos.y, pos.z); }
    player.setYaw(0); player.setPitch(0);
    // Explicit LAB actors have no client movement stream. Keep them stationary
    // while the native connection/player tick path handles equipment and item use.
    player.setNoGravity(true);
    if(N.report)N.report.ownedActorNoGravity=true;
    N.actors.push(player);
    Java.loadClass('dev.ftb.mods.ftbteams.data.TeamManagerImpl').INSTANCE.playerLoggedIn(null, UUID.fromString(String(player.uuid)), String(player.username));
    return player;
  };
  N.raw = function (player) { return player.minecraftPlayer || player; };
  N.managedOnline = {};
  N.attachActorChannel = function(player) {
    var id=String(player.uuid),connection=N.connections[id],existing=N.channels[id];
    if(existing)return existing;
    // Peerless, in-process transport. The normal Connection handler must see
    // channelActive before Forge's real login code can inspect its pipeline.
    // No socket, client process, fake player, or production collection override.
    var Embedded=Java.loadClass('io.netty.channel.embedded.EmbeddedChannel');
    var Protocol=Java.loadClass('net.minecraft.network.ConnectionProtocol');
    var AttributeKey=Java.loadClass('io.netty.util.AttributeKey');
    var Constants=Java.loadClass('net.minecraftforge.network.NetworkConstants');
    var channel=new Embedded();N.channels[id]=channel;
    channel.pipeline().addLast('packet_handler',connection);
    channel.pipeline().fireChannelActive();channel.runPendingTasks();
    connection.setProtocol(Protocol.PLAY);
    // NetworkHooks.ConnectionType.forVersionFlag dereferences this exact
    // attribute (NetworkConstants bytecode: "fml:netversion"). This is a QA
    // modded protocol fixture; there is no remote negotiation or connected peer.
    channel.attr(AttributeKey.valueOf('fml:netversion')).set(Constants.NETVERSION);
    if(connection.channel()===null||!channel.isActive())throw new Error('Embedded native actor channel did not activate');
    if(N.report)N.report.serverPlayerTransport='Peerless Netty EmbeddedChannel; vanilla PlayerList login and Forge/FTB events; no remote client';
    return channel;
  };
  N.registerNativeConnection = function(player) {
    var id=String(player.uuid),connection=N.connections[id];
    if(!N.managedOnline[id]||!connection)throw new Error('Only an explicitly owned online actor may enter native connection dispatcher');
    var connections=player.server.getConnection().getConnections();
    if(!connections.contains(connection))connections.add(connection);
    if(!connections.contains(connection))throw new Error('Native ServerConnectionListener did not retain owned connection');
    N.ownedNativeConnections[id]=connection;
    if(N.report){N.report.nativeConnectionDispatcher={mode:'Actual public ServerConnectionListener.getConnections backing list; normal Minecraft network tick only',manualConnectionTicks:0,registeredActors:N.report.nativeConnectionDispatcher?N.report.nativeConnectionDispatcher.registeredActors+1:1};}
    return connection;
  };
  N.unregisterNativeConnection = function(player) {
    var id=String(player.uuid),connection=N.ownedNativeConnections[id];if(!connection)return;
    var connections=player.server.getConnection().getConnections();
    connections.remove(connection);delete N.ownedNativeConnections[id];
    if(connections.contains(connection))throw new Error('Owned connection was not removed from native dispatcher');
  };
  N.addOnlinePlayer = function(player) {
    var list=player.server.getPlayerList(),id=String(player.uuid);
    var level=player.serverLevel(),x=Number(player.x),y=Number(player.y),z=Number(player.z);
    // getPlayers() is an unmodifiable view. Use the real vanilla join lifecycle
    // so UUID lookup, level membership and FTB login hooks all see this actor.
    N.managedOnline[id]=true;
    N.attachActorChannel(player);
    if(!list.getPlayers().contains(player))list.placeNewPlayer(N.connections[id],player);
    if(String(player.serverLevel().dimension)!==String(level.dimension))player.teleportTo(new (Java.loadClass('net.minecraft.resources.ResourceLocation'))(String(level.dimension)),x,y,z,0,0);
    else player.setPosition(x,y,z);
    var registered=list.getPlayer(Java.loadClass('java.util.UUID').fromString(id));
    if(!list.getPlayers().contains(player)||registered===null||String(registered.uuid)!==id)throw new Error('Native fixture join did not register actual server identity');
    N.managedOnline[id]=true;
    N.registerNativeConnection(player);
    return player;
  };
  N.makeOnlinePlayer = function(server,id,name,pos){return N.addOnlinePlayer(N.makePlayer(server,id,name,pos));};
  N.resetPlayerState = function (player) {
    player.getInventory().clearContent();
    var state = global.FRankDays.createDefaultState(String(player.uuid), String(player.username));
    global.FRankDays.savePlayerState(player, state); return state;
  };
  N.removePlayer = function (player) {
    var server = player.server;
    if (server.getPlayerList().getPlayers().contains(player) && !N.managedOnline[String(player.uuid)]) throw new Error('QA fixture unexpectedly entered online PlayerList');
    var id=String(player.uuid),channel=N.channels[id];
    try{N.unregisterNativeConnection(player);server.getPlayerList().remove(player);}
    finally{
      try{if(channel){channel.runPendingTasks();channel.finishAndReleaseAll();}}
      finally{delete N.channels[id];delete N.ownedNativeConnections[id];delete N.managedOnline[id];delete N.connections[id];var index=N.actors.indexOf(player);if(index>=0)N.actors.splice(index,1);}
    }
  };
  N.runTransport = function(server,done) {
    var p=null,finished=false,start=0;
    function check(n,v,d){N.check('transport '+n,!!v,d);}
    function finish(){if(finished)return;finished=true;try{if(p)N.removePlayer(p);}finally{done();}}
    function schedule(t,fn,label){if(typeof fn!=='function')throw new Error('transport schedule expected function at '+String(label||'anonymous')+' delayTicks='+t+'; got '+typeof fn);server.scheduleInTicks(t,function(){if(finished)return;try{fn();}catch(e){check('native probe exception',false,String(e)+' '+String(e.stack||''));finish();}});}
    var poll=function(){var elapsed=Date.now()-start,id=String(p.uuid),ka=(N.report.keepAliveAcknowledgements||[]).filter(function(x){return x.playerUUID===id;}),tp=(N.report.teleportAcknowledgements||[]).filter(function(x){return x.playerUUID===id;});if(!(elapsed>=32500&&ka.length>=2)&&elapsed<45000){schedule(Math.min(10,Math.max(1,Math.ceil((45000-elapsed)/50))),poll,'repeat_keepalive_poll');return;}check('normal owned transport survives32seconds with2actualKeepAlive ACKs',elapsed>=32500&&!p.isRemoved()&&server.getPlayerList().getPlayers().contains(p)&&server.getConnection().getConnections().contains(N.connections[id])&&ka.length>=2&&!N.transportFailures[id],{elapsedMs:elapsed,maximumWaitMs:45000,clockOrigin:'after addOnlinePlayer completion',actualKeepAliveReplies:ka,actualTeleportReplies:tp,pipeline:N.report.ownedPipelineSample,packetClasses:N.report.outboundPacketClasses});finish();};
    try{
      p=N.makePlayer(server,null,'FC4Transport',{x:38100.5,y:210,z:38100.5});N.resetPlayerState(p);var F=global.FRankDays,s=F.loadPlayerState(p);s.guild_card.issued=true;s.guild_card.ui_open=false;s.npc_dialog.open=false;s.starter_onboarding.first_registration_completed=true;F.savePlayerState(p,s);N.addOnlinePlayer(p);start=Date.now();p.inventory.selected=0;p.inventory.setItem(0,Item.of('minecraft:iron_sword',1));
      schedule(2,function(){var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes');check('owned connection is in native dispatcher and real iron sword attribute updates',server.getConnection().getConnections().contains(N.connections[String(p.uuid)])&&Number(p.getAttribute(A.ATTACK_DAMAGE).getValue())>=6,{attack:Number(p.getAttribute(A.ATTACK_DAMAGE).getValue()),manualConnectionTicks:0});p.inventory.setItem(0,Item.of('minecraft:potion',1,{Potion:'minecraft:water'}));p.startUsingItem(Java.loadClass('net.minecraft.world.InteractionHand').MAIN_HAND);var first=Number(p.getUseItemRemainingTicks());schedule(4,function(){check('native item use decreases after4ticks',p.isUsingItem()&&Number(p.getUseItemRemainingTicks())<first&&Number(p.getUseItemRemainingTicks())>0,{before:first,after:Number(p.getUseItemRemainingTicks())});});schedule(34,function(){check('native water potion finishes within34ticks',!p.isUsingItem()&&Number(F.countPlayerItem(p,'minecraft:potion'))===0&&Number(F.countPlayerItem(p,'minecraft:glass_bottle'))===1);});});

      schedule(10,poll,'initial_keepalive_poll');
    }catch(e){check('setup exception',false,String(e)+' '+String(e.stack||''));finish();}
  };
  N.cleanupActors = function () { var all = N.actors.slice(); for (var i = 0; i < all.length; i++) try { N.removePlayer(all[i]); } catch (e) { N.check('native fixture cleanup', false, String(e)); } };
})(global.FCraftPhase6Native);
