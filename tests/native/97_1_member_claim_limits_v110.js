// STAGED LAB ONLY: native FTB party/claims in an isolated world; no inventory reset.
(function(N){
 var F=global.FRankDays,Chunks=Java.loadClass('dev.ftb.mods.ftbchunks.api.FTBChunksAPI'),Teams=Java.loadClass('dev.ftb.mods.ftbteams.api.FTBTeamsAPI'),CDP=Java.loadClass('dev.ftb.mods.ftblibrary.math.ChunkDimPos'),Pos=Java.loadClass('net.minecraft.core.BlockPos'),CP=Java.loadClass('net.minecraft.world.level.ChunkPos'),UUID=Java.loadClass('java.util.UUID'),Collections=Java.loadClass('java.util.Collections'),KEY='fcraft_claim_limits_native_v110',MAIN='f_rank_days:mainland_wilds';
 function uid(p){return String(p.uuid);}function check(name,ok,detail){N.check('claims110 '+name,!!ok,detail===undefined?null:JSON.parse(JSON.stringify(detail)));}
 function each(xs,fn){if(typeof xs.length==='number'){for(var i=0;i<Number(xs.length);i++)fn(xs[i]);return;}var it=xs.iterator();while(it.hasNext())fn(it.next());}
 function manager(){return Chunks.api().getManager();}function teams(){return Teams.api().getManager();}
 function getTeam(p){var o=teams().getTeamForPlayerID(UUID.fromString(uid(p)));if(!o.isPresent())throw Error('Native actor team unavailable');return o.get();}
 function dataFor(p){return manager().getOrCreateData(N.raw(p));}
 function readLimits(p){var d=dataFor(p);return{team_id:String(d.getTeam().getId()),max_claims:Number(d.getMaxClaimChunks()),claimed_chunks:Number(d.getClaimedChunks().size())};}
 function position(server,r){var w=F.getChapter1RaidLevelV104(server,MAIN);return new CDP(w,new Pos(r.x*16,120,r.z*16));}
 function owned(server,positions,id){var count=0;for(var i=0;i<positions.length;i++){var c=manager().getChunk(position(server,positions[i]));if(c&&String(c.getTeamData().getTeam().getId())===String(id))count++;}return count;}
 function allClaimKeys(){var out=[];each(manager().getAllClaimedChunks(),function(c){out.push(String(c.getPos())+'|'+String(c.getTeamData().getTeam().getId()));});out.sort();return out;}
 function inviteJoin(party,a,b){party.invite(N.raw(a),Collections.singletonList(N.raw(b).getGameProfile()));if(String(party.getRankForPlayer(UUID.fromString(uid(b))).name())!=='INVITED')throw Error('Normal native invitation did not authorize guest; refuse direct join');return Number(party.join(N.raw(b)));}
 function removeActor(p){if(p&&N.managedOnline[uid(p)])N.removePlayer(p);}
 N.runClaimLimitsV110=function(server,done){
  var actors=[],ended=false,report={actualNativeFTB:true,humanPlay:false,inventoryReset:false,manualClaimRecordEdits:0,actualColdRestart:false};N.report.claimLimitsV110=report;
  function finish(){if(ended)return;ended=true;for(var i=0;i<actors.length;i++)removeActor(actors[i]);done();}
  function later(t,fn){server.scheduleInTicks(t,function(){if(ended)return;try{fn();}catch(error){check('native fixture exception',false,String(error)+' '+String(error.stack||''));finish();}});}
  try{
   check('staged public policy API active',typeof F.applyMemberClaimLimitsV110==='function');if(typeof F.applyMemberClaimLimitsV110!=='function'){finish();return;}
   var before=allClaimKeys(),initial=F.getMemberClaimLimitPolicyV110(),automatic=initial.max_claimed_chunks===25&&initial.party_limit_mode==='sum'&&initial.hard_team_claim_limit===0;check('automatic server-loaded policy is default25 SUM and no team hardcap',automatic,initial);if(!automatic){finish();return;}var policy=F.applyMemberClaimLimitsV110(server,'native_idempotent_replay');check('one explicit policy replay is idempotent after automatic policy assertion',policy.ok&&!policy.changed,policy);
   check('policy refresh removes no preexisting claim records',JSON.stringify(before)===JSON.stringify(allClaimKeys()),{before:before.length,after:allClaimKeys().length});
   var a=N.makeOnlinePlayer(server,null,'FC110ClaimA',{x:38200.5,y:210,z:38200.5}),b=N.makeOnlinePlayer(server,null,'FC110ClaimB',{x:38204.5,y:210,z:38200.5});actors=[a,b];for(var actor of actors){var state=F.loadPlayerState(actor);state.mainland_sailing_unlocked=true;F.savePlayerState(actor,state);}report.explicitLabPrerequisites='Only the two disposable actors receive the saved mainland permission; no player-state or inventory reset.';
   later(6,function(){
    var soloA=readLimits(a),soloB=readLimits(b);check('automatic login hooks give two ordinary native solo players25 each',soloA.max_claims===25&&soloB.max_claims===25&&soloA.team_id!==soloB.team_id,{a:soloA,b:soloB,manualRefresh:false});
    if(getTeam(a).isPartyTeam()||getTeam(b).isPartyTeam())throw Error('Only newly created disposable solo actors may join this fixture');
    var party=teams().createParty(N.raw(a),'FC110 claim LAB'),partyId=String(party.getId());report.actorUUIDs=[uid(a),uid(b)];report.partyUUID=partyId;
    var joined=inviteJoin(party,a,b);
    later(26,function(){
     var d=dataFor(a);
     check('normal public invite and join produce one two-member party capacity50',String(getTeam(a).getId())===partyId&&String(getTeam(b).getId())===partyId&&Number(d.getMaxClaimChunks())===50,{joined:joined,partyUUID:partyId,limit:Number(d.getMaxClaimChunks()),members:Number(party.getMembers().size())});
     var positions=[];for(var i=0;i<51;i++)positions.push({x:2800+i,z:2800});for(var i=0;i<positions.length;i++)if(manager().getChunk(position(server,positions[i])))throw Error('LAB claim cell already owned; preserve existing record');
     var results=[],w=F.getChapter1RaidLevelV104(server,MAIN);
     for(var i=0;i<positions.length;i++){var r=positions[i],at=position(server,r),result=Chunks.api().claimAsPlayer(N.raw(a),at.dimension(),new CP(r.x,r.z),false);results.push({index:i+1,success:!!result.isSuccess(),result:String(result.getResultId()),registered:!!manager().getChunk(at)});}
     var fifty=positions.slice(0,50);report.actualClaimResults=results;
     check('real ordinary party claims1to50 succeed and51is rejected',results.slice(0,50).every(function(r){return r.success&&r.registered;})&&!results[50].success&&!results[50].registered&&owned(server,fifty,partyId)===50,results);
     var recordsBefore=allClaimKeys(),left=Number(party.leave(UUID.fromString(uid(b))));
     later(26,function(){
      var single=dataFor(a),guest=dataFor(b);
      check('native member leave recalculates party25 and restored solo25',Number(single.getMaxClaimChunks())===25&&Number(guest.getMaxClaimChunks())===25&&String(getTeam(b).getId())!==partyId,{leaveResult:left,party:Number(single.getMaxClaimChunks()),guest:Number(guest.getMaxClaimChunks())});
      check('capacity reduction retains all50 existing owner claims',owned(server,fifty,partyId)===50&&JSON.stringify(recordsBefore)===JSON.stringify(allClaimKeys()),{existing:owned(server,fifty,partyId),newLimit:Number(single.getMaxClaimChunks())});
      var extra=positions[50],blocked=Chunks.api().claimAsPlayer(N.raw(a),position(server,extra).dimension(),new CP(extra.x,extra.z),false);check('over-cap existing owner cannot add a51st chunk',!blocked.isSuccess()&&!manager().getChunk(position(server,extra)),{result:String(blocked.getResultId())});
      var rejoined=inviteJoin(party,a,b);
      later(26,function(){
       var refreshed=readLimits(a);check('automatic rejoin hooks restore50 without resetting claims',refreshed.max_claims===50&&owned(server,fifty,partyId)===50,{joinResult:rejoined,state:refreshed,manualRefresh:false});
       var checkpoint={ownerUUID:uid(a),guestUUID:uid(b),ownerName:String(a.username),guestName:String(b.username),partyUUID:partyId,positions:fifty,unclaimed51:positions[50],claimCount:50,baselineClaimKeys:before,fullClaimKeys:allClaimKeys(),policy:F.getMemberClaimLimitPolicyV110()};
       teams().saveNow();server.persistentData.putString(KEY,JSON.stringify(checkpoint));report.checkpoint=checkpoint;check('cold checkpoint stores real team and claim identities',checkpoint.ownerUUID!==checkpoint.guestUUID&&checkpoint.partyUUID&&checkpoint.positions.length===50,checkpoint);finish();
      });
     });
    });
   });
  }catch(error){check('native fixture setup exception',false,String(error)+' '+String(error.stack||''));finish();}
 };
 N.runClaimLimitsV110Restart=function(server,done){
  var actors=[],ended=false,report={actualNativeFTB:true,actualColdRestart:true,humanPlay:false,inventoryReset:false,manualClaimRecordEdits:0};N.report.claimLimitsV110Restart=report;
  function finish(){if(ended)return;ended=true;for(var i=0;i<actors.length;i++)removeActor(actors[i]);done();}
  try{
   var text=String(server.persistentData.getString(KEY)||'');if(!text)throw Error('Missing actual first-run claim checkpoint');var saved=JSON.parse(text),o=teams().getTeamByID(UUID.fromString(saved.partyUUID));check('cold restart reloads actual saved party UUID',o.isPresent(),saved);if(!o.isPresent()){finish();return;}
   var party=o.get(),before=allClaimKeys(),cold=manager().getOrCreateData(party);report.coldBeforeAnyActorLogin={partyUUID:String(party.getId()),members:Number(party.getMembers().size()),maxClaims:Number(cold.getMaxClaimChunks()),claimCount:Number(cold.getClaimedChunks().size()),owned:owned(server,saved.positions,saved.partyUUID),onlineMembers:Number(party.getOnlineMembers().size()),policy:F.getMemberClaimLimitPolicyV110(),manualRefresh:false};
   var cp=report.coldBeforeAnyActorLogin;check('automatic cold server-loaded policy has default25 SUM and no hardcap',cp.policy.max_claimed_chunks===25&&cp.policy.party_limit_mode==='sum'&&cp.policy.hard_team_claim_limit===0,cp.policy);check('real offline cache retains two members capacity50 and all50 claims after cold restart',cp.partyUUID===saved.partyUUID&&cp.members===2&&cp.maxClaims===50&&cp.claimCount===50&&cp.owned===50&&cp.onlineMembers===0,cp);check('cold load retains the exact recorded native claim positions and owners',JSON.stringify(saved.fullClaimKeys)===JSON.stringify(before),{saved:saved.fullClaimKeys.length,actual:before.length});
   var a=N.makeOnlinePlayer(server,saved.ownerUUID,saved.ownerName,{x:38200.5,y:210,z:38200.5}),b=N.makeOnlinePlayer(server,saved.guestUUID,saved.guestName,{x:38204.5,y:210,z:38200.5});actors=[a,b];
   server.scheduleInTicks(6,function(){try{
    var ta=teams().getTeamForPlayerID(UUID.fromString(saved.ownerUUID)),tb=teams().getTeamForPlayerID(UUID.fromString(saved.guestUUID));
    check('actual rejoined saved actors resolve the persisted effective party',ta.isPresent()&&tb.isPresent()&&String(ta.get().getId())===saved.partyUUID&&String(tb.get().getId())===saved.partyUUID&&Number(dataFor(a).getMaxClaimChunks())===50,{owner:ta.isPresent()?String(ta.get().getId()):null,guest:tb.isPresent()?String(tb.get().getId()):null});
    var source=N.raw(a).createCommandSourceStack();for(var i=0;i<saved.positions.length;i++){var at=position(server,saved.positions[i]),claim=manager().getChunk(at);if(!claim||String(claim.getTeamData().getTeam().getId())!==saved.partyUUID)throw Error('Refuse cleanup of missing/foreign claim');claim.unclaim(source,false);}
    check('owned native claims cleanup leaves all prior unrelated claims unchanged',owned(server,saved.positions,saved.partyUUID)===0&&JSON.stringify(saved.baselineClaimKeys)===JSON.stringify(allClaimKeys()),{remainingFixture:owned(server,saved.positions,saved.partyUUID),baseline:saved.baselineClaimKeys.length,actual:allClaimKeys().length});
    party.leave(UUID.fromString(saved.guestUUID));party.leave(UUID.fromString(saved.ownerUUID));teams().saveNow();check('normal guest-then-owner leave cleans only the disposable party',!teams().getTeamByID(UUID.fromString(saved.partyUUID)).isPresent());
   }catch(error){check('cold fixture exception',false,String(error)+' '+String(error.stack||''));}finally{finish();}});
  }catch(error){check('cold fixture setup exception',false,String(error)+' '+String(error.stack||''));finish();}
 };
})(global.FCraftPhase6Native);
