// QA-only: use explicit Java Iterator, not Rhino for-of raw Java values.
// Automatic acknowledgements of actual emitted packets on OWNED channels.
(function(N){
 var Position=Java.loadClass('net.minecraft.network.protocol.game.ClientboundPlayerPositionPacket'),Accept=Java.loadClass('net.minecraft.network.protocol.game.ServerboundAcceptTeleportationPacket');
 var KeepAlive=Java.loadClass('net.minecraft.network.protocol.game.ClientboundKeepAlivePacket'),KeepAliveReply=Java.loadClass('net.minecraft.network.protocol.game.ServerboundKeepAlivePacket');
 var Chat=Java.loadClass('net.minecraft.network.protocol.game.ClientboundSystemChatPacket'),Release=Java.loadClass('io.netty.util.ReferenceCountUtil');
 N.teleportAcks={};N.keepAliveAcks={};N.transportFailures={};
 function captureTeleport(p,packet){
  var id=String(p.uuid),listener=String(p.connection),key=String(packet.getId()),prior=N.teleportAcks[id];
  if(!prior||prior.listener!==listener)prior=N.teleportAcks[id]={listener:listener,seen:{}};
  if(prior.seen[key])return false;
  var before=typeof p.isChangingDimension==='function'?p.isChangingDimension():null;
  // This exact identifier was emitted by the owned native listener; no invented ID.
  p.connection.handleAcceptTeleportPacket(new Accept(packet.getId()));prior.seen[key]=true;prior.id=key;
  var after=typeof p.isChangingDimension==='function'?p.isChangingDimension():null;
  if(N.report){N.report.teleportAcknowledgements=N.report.teleportAcknowledgements||[];N.report.teleportAcknowledgements.push({playerUUID:id,id:key,changingBefore:before,changingAfter:after,source:'Actual captured ClientboundPlayerPositionPacket -> native ServerboundAcceptTeleportationPacket handler'});}
  return true;
 }
 function captureKeepAlive(p,packet){
  var id=String(p.uuid),listener=String(p.connection),key=String(packet.getId()),prior=N.keepAliveAcks[id];
  if(!prior||prior.listener!==listener)prior=N.keepAliveAcks[id]={listener:listener,seen:{}};
  if(prior.seen[key])return false;
  p.connection.handleKeepAlive(new KeepAliveReply(packet.getId()));prior.seen[key]=true;
  if(N.report){N.report.keepAliveAcknowledgements=N.report.keepAliveAcknowledgements||[];N.report.keepAliveAcknowledgements.push({playerUUID:id,id:key,source:'Actual captured ClientboundKeepAlivePacket -> native ServerboundKeepAlivePacket handler'});}
  return true;
 }
 N.ackTeleport=function(p){
  var channel=N.channels[String(p.uuid)],seen=0,acked=0;if(!channel)return{acknowledged:false,reason:'no_owned_channel'};channel.runPendingTasks();
  // Preserve packet order, including any packets buffered before native login.
  var iterator=channel.outboundMessages().iterator();while(iterator.hasNext()){var packet=iterator.next();if(packet instanceof Position){seen++;if(captureTeleport(p,packet))acked++;}}
  return{acknowledged:acked>0,positionPacketsSeen:seen,count:acked};
 };
 N.pumpOwnedAcknowledgements=function(p){
  var id=String(p.uuid),channel=N.channels[id];if(!channel||!N.ownedNativeConnections[id])return;channel.runPendingTasks();if(N.report&&!N.report.ownedPipelineSample){N.report.ownedPipelineSample=[];var entries=channel.pipeline().toMap().entrySet().iterator();while(entries.hasNext()){var entry=entries.next();N.report.ownedPipelineSample.push({name:String(entry.getKey()),className:String(entry.getValue().getClass().getName())});}}
  var scan=channel.outboundMessages().iterator();while(scan.hasNext()){var packet=scan.next(),className=String(packet.getClass().getName());if(N.report){N.report.outboundPacketClasses=N.report.outboundPacketClasses||{};N.report.outboundPacketClasses[className]=Number(N.report.outboundPacketClasses[className]||0)+1;}if(packet instanceof Position)captureTeleport(p,packet);else if(packet instanceof KeepAlive)captureKeepAlive(p,packet);}
  // Keep actual chat packets for84's native message evidence. Unobserved world/
  // chunk/equipment packets need no peer and are released after the native send.
  var it=channel.outboundMessages().iterator(),released=0;
  while(it.hasNext()){var message=it.next();if(message instanceof Chat)continue;it.remove();Release.release(message);released++;}
  if(N.report)N.report.ownedTransportDiscardedPackets=Number(N.report.ownedTransportDiscardedPackets||0)+released;
 };
 ServerEvents.tick(function(){
  var actors=N.actors.slice();for(var i=0;i<actors.length;i++){
   var p=actors[i],id=String(p.uuid);if(!N.managedOnline[id]||!N.ownedNativeConnections[id]||N.transportFailures[id])continue;
   try{N.pumpOwnedAcknowledgements(p);}catch(e){N.transportFailures[id]=String(e);if(N.check)N.check('native owned transport acknowledgement failure',false,{actor:id,error:String(e)});else console.error('NATIVE_OWNED_TRANSPORT_ACK '+String(e));}
  }
 });
})(global.FCraftPhase6Native);
