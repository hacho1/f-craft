// Integration-only: actual raid settlement must already have reserved this actor's first reward.
// Native PlayerList remove/load/join is used. No player-state reset or reward function is called.
global.FCraftPhase6Native=global.FCraftPhase6Native||{};
(function(N){
 var F=global.FRankDays;
 function wallet(p){return Number(F.getPlayerBalanceSummaryV8(p).wallet_copper);}
 function quantity(p,id){return Number(F.countPlayerItem(p,id));}
 function freeSlots(p){var count=0;for(var i=0;i<36;i++)if(p.inventory.getItem(i).empty)count++;return count;}
 function legacy(s){return s.v8_boss&&s.v8_boss.quests&&s.v8_boss.quests.ferrous_wroughtnaut;}
 function heart(p){for(var i=0;i<Number(p.inventory.getContainerSize());i++){var item=p.inventory.getItem(i);if(!item.empty&&String(item.id)==='f_rank_days:wrought_iron_heart')return item;}return null;}
 N.verifyRaidPendingReload=function(server,oldPlayer,row,done){
  var current=oldPlayer,reloaded=null,finished=false,identity=String(oldPlayer.uuid),name=String(oldPlayer.username);
  var evidence={uuid:identity,nativeRemoveLoadJoin:true,playerStateReset:false,manualRewardGrant:false,physicalInputUsed:false};
  if(row)row.pendingGuardianReload=evidence;
  N.report.guardianPendingReloadEvidence=N.report.guardianPendingReloadEvidence||[];
  N.report.guardianPendingReloadEvidence.push(evidence);
  function check(name,value,detail){N.check('raid pending reload '+name,!!value,detail);}
  function finish(){if(finished)return;finished=true;done(reloaded||current);}
  function failed(error){evidence.error=String(error);check('native lifecycle exception',false,String(error)+' '+String(error&&error.stack||''));finish();}
  try{
   var before=F.loadPlayerState(oldPlayer),q=before.guardian_gear_v102,old=legacy(before);
   var campKnown=!!(before.e_rank_camp_unlocked||before.reward_ledger&&before.reward_ledger.e_rank_camp_v96);
   evidence.before={wallet:wallet(oldPlayer),helm:quantity(oldPlayer,'f_rank_days:guardian_wrought_helm'),heart:quantity(oldPlayer,'f_rank_days:wrought_iron_heart'),campScroll:quantity(oldPlayer,'f_rank_days:camp_return_scroll'),campSuppliesAlreadyGranted:campKnown,freeMainSlots:freeSlots(oldPlayer),legacyCashClaimed:!!(old&&old.first_reward_claimed),firstReserved:!!(q&&q.first_cleared),pending:q&&q.pending_rewards?q.pending_rewards.length:0};
   var hasBaseline=!!(row&&row.walletBeforeRaid!==undefined&&row.walletBeforeRaid!==null),baseline=hasBaseline?Number(row.walletBeforeRaid):evidence.before.wallet;
   if(!isFinite(baseline))throw Error('Invalid native pre-raid wallet baseline');
   evidence.walletBaseline=baseline;evidence.baselineSource=hasBaseline?'before_raid':'before_pending_reload';
   check('actual fullinventory first entitlement reserved but cash unpaid',q&&q.first_cleared&&q.pending_rewards&&q.pending_rewards.length>0&&q.pending_rewards[0].first===true&&evidence.before.wallet===baseline&&evidence.before.helm===0&&evidence.before.heart===0&&old&&old.first_reward_claimed===false,evidence.before);
   var position={level:oldPlayer.serverLevel(),x:Number(oldPlayer.x),y:Number(oldPlayer.y),z:Number(oldPlayer.z)};
   // The production login can also award one legitimate first-E camp scroll.
   // Reserve its slot plus the two unique rewards; never suppress that old hook.
   for(var slot=0;slot<3;slot++)oldPlayer.inventory.setItem(slot,Item.of('minecraft:air'));
   evidence.slotsFreedBeforeLogout=freeSlots(oldPlayer);
   check('three free slots accommodate existing camp supply and two unique rewards',evidence.slotsFreedBeforeLogout>=3,{freeMainSlots:evidence.slotsFreedBeforeLogout,campSuppliesAlreadyGranted:campKnown});
   oldPlayer.inventory.setChanged();N.removePlayer(oldPlayer);
   reloaded=N.makePlayer(server,identity,name,position);current=reloaded;N.addOnlinePlayer(reloaded);
   check('same UUID rejoins actual PlayerList without reset',String(reloaded.uuid)===identity&&server.getPlayerList().getPlayers().contains(reloaded),{uuid:String(reloaded.uuid),sameUUID:String(reloaded.uuid)===identity});
   server.scheduleInTicks(6,function(){try{
    var after=F.loadPlayerState(reloaded),record=after.guardian_gear_v102,quest=legacy(after),bound=heart(reloaded);
    evidence.after={wallet:wallet(reloaded),helm:quantity(reloaded,'f_rank_days:guardian_wrought_helm'),heart:quantity(reloaded,'f_rank_days:wrought_iron_heart'),heartOwner:bound?String(bound.nbt.bound_owner_uuid):'',campScroll:quantity(reloaded,'f_rank_days:camp_return_scroll'),campSuppliesGranted:!!(after.e_rank_camp_unlocked||after.reward_ledger&&after.reward_ledger.e_rank_camp_v96),freeMainSlots:freeSlots(reloaded),legacyCashClaimed:!!(quest&&quest.first_reward_claimed),pending:record&&record.pending_rewards?record.pending_rewards.length:-1,firstCashPaid:!!(record&&record.first_cash_paid)};
    evidence.after.walletGain=evidence.after.wallet-baseline;
    check('login delivers one helm one own heart and exactly1500c',evidence.after.walletGain===1500&&evidence.after.helm===1&&evidence.after.heart===1&&evidence.after.heartOwner===identity,evidence.after);
    check('existing first-E camp supply preserved alongside guardian payout',evidence.after.campSuppliesGranted&&evidence.after.campScroll===evidence.before.campScroll+(campKnown?0:1),evidence.after);
    check('only actual cash payout marks old first claim and drains reservation',quest&&quest.first_reward_claimed===true&&record&&record.first_cash_paid===true&&Number(record.first_cash_copper)===1500&&record.pending_rewards.length===0,evidence.after);
    evidence.finished=true;finish();
   }catch(error){failed(error);}});
  }catch(error){failed(error);}
 };
})(global.FCraftPhase6Native);
