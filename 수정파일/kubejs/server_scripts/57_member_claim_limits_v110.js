// F-Craft v11.0: memory-only member claim-capacity policy.
// Native config/cache APIs only. Existing claim ownership and records stay with FTB.
(function(){
 if(!Platform.isLoaded('ftbchunks')||!Platform.isLoaded('ftbteams'))return;
 var F=global.FRankDays,C=Java.loadClass('dev.ftb.mods.ftbchunks.FTBChunksWorldConfig'),Modes=Java.loadClass('dev.ftb.mods.ftbchunks.data.PartyLimitMode'),Chunks=Java.loadClass('dev.ftb.mods.ftbchunks.api.FTBChunksAPI'),Teams=Java.loadClass('dev.ftb.mods.ftbteams.api.FTBTeamsAPI'),Integer=Java.loadClass('java.lang.Integer'),UUID=Java.loadClass('java.util.UUID');
 var playerTeams={},teamSignatures={},pendingSweep=false;
 function raw(p){return p&&(p.minecraftPlayer||p);}
 function each(xs,fn){if(!xs)return;if(typeof xs.length==='number'){for(var i=0;i<Number(xs.length);i++)fn(xs[i]);return;}if(typeof xs.iterator==='function'){var it=xs.iterator();while(it.hasNext())fn(it.next());return;}if(typeof xs.size==='function'&&typeof xs.get==='function'){for(var j=0;j<Number(xs.size());j++)fn(xs.get(j));return;}throw Error('Unsupported native claim collection');}
 function policy(){return{max_claimed_chunks:Number(C.MAX_CLAIMED_CHUNKS.get()),party_limit_mode:String(C.PARTY_LIMIT_MODE.get().name()).toLowerCase(),hard_team_claim_limit:Number(C.HARD_TEAM_CLAIM_LIMIT.get()),max_force_loaded_chunks:Number(C.MAX_FORCE_LOADED_CHUNKS.get()),hard_team_force_limit:Number(C.HARD_TEAM_FORCE_LIMIT.get())};}
 function integer(value,n){value['set(java.lang.Integer)'](new Integer(String(n)));}
 function configure(){var before=policy(),changed=false;if(before.max_claimed_chunks!==25){integer(C.MAX_CLAIMED_CHUNKS,25);changed=true;}if(before.party_limit_mode!=='sum'){C.PARTY_LIMIT_MODE.set(Modes.SUM);changed=true;}if(before.hard_team_claim_limit!==0){integer(C.HARD_TEAM_CLAIM_LIMIT,0);changed=true;}var after=policy();if(after.max_claimed_chunks!==25||after.party_limit_mode!=='sum'||after.hard_team_claim_limit!==0)throw Error('Native member claim policy readback failed');if(changed)pendingSweep=true;return{changed:changed,before:before,after:after};}
 function summary(data){var members=[];each(data.getTeam().getMembers(),function(id){members.push(String(id));});members.sort();return{team_id:String(data.getTeam().getId()),member_ids:members,max_claims:Number(data.getMaxClaimChunks()),claimed_chunks:Number(data.getClaimedChunks().size())};}
 function refreshTeam(id){var optional=Teams.api().getManager().getTeamByID(UUID.fromString(String(id)));if(!optional.isPresent())return null;var data=Chunks.api().getManager().getOrCreateData(optional.get());data.updateLimits();var out=summary(data);teamSignatures[out.team_id]=out.member_ids.join('|');return out;}
 function refreshPlayer(player,force){var result=configure(),data=Chunks.api().getManager().getOrCreateData(raw(player)),before=summary(data),id=String(player.uuid),old=playerTeams[id],signature=before.member_ids.join('|'),changed=!!force||result.changed||old!==before.team_id||teamSignatures[before.team_id]!==signature;if(changed){data.updateLimits();if(old&&old!==before.team_id)refreshTeam(old);}playerTeams[id]=before.team_id;teamSignatures[before.team_id]=signature;var out=summary(data);out.ok=true;out.refreshed=changed;out.policy=result.after;return out;}
 function apply(server,reason){var result=configure(),manager=Chunks.api().getManager(),seen={},all=[];function add(data){var id=String(data.getTeam().getId());if(!seen[id]){seen[id]=true;all.push(data);}}each(manager.getAllClaimedChunks(),function(c){add(c.getTeamData());});each(server.players,function(p){add(manager.getOrCreateData(raw(p)));});var rows=[];for(var i=0;i<all.length;i++){all[i].updateLimits();var row=summary(all[i]);rows.push(row);teamSignatures[row.team_id]=row.member_ids.join('|');}pendingSweep=false;return{ok:true,reason:String(reason||'refresh'),changed:result.changed,before:result.before,after:result.after,teams:rows};}
 F.getMemberClaimLimitPolicyV110=policy;
 F.applyMemberClaimLimitsV110=apply;
 F.refreshMemberClaimLimitPlayerV110=function(p){return refreshPlayer(p,true);};
 F.refreshMemberClaimLimitTeamV110=function(server,id){configure();return refreshTeam(id);};
 ServerEvents.loaded(function(e){playerTeams={};teamSignatures={};pendingSweep=false;e.server.scheduleInTicks(1,function(){apply(e.server,'server_loaded');});});
 PlayerEvents.loggedIn(function(e){configure();e.player.server.scheduleInTicks(2,function(){if(e.player&&e.player.isAlive())refreshPlayer(e.player,true);});});
 PlayerEvents.tick(function(e){if(Number(e.player.age)%20===0)refreshPlayer(e.player,false);});
 ServerEvents.tick(function(e){if(Number(e.server.overworld().getTime())%40===0){configure();if(pendingSweep)apply(e.server,'native_config_changed');}});
})();
