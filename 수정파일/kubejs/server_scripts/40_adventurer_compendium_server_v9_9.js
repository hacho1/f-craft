// Phase5: world-local UUID ledger. No historical inventory/affinity/boss import.
global.FRankDays=global.FRankDays||{};
(function(F){
 var cfg=JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_compendium_v99.json')));
 var ROOT='fcraft_compendium_world_v1',entries=cfg.entries,byId={},items={},mobs={},npcs={},runtime={},session='',UUID=Java.loadClass('java.util.UUID');
 var Compound=Java.loadClass('net.minecraft.nbt.CompoundTag');
 function copy(x){return JSON.parse(JSON.stringify(x));}
 function id(p){return String(p.uuid);}
 function player(p){return !!p&&typeof p.isPlayer==='function'&&p.isPlayer();}
 function fail(reason,message){return{ok:false,reason:reason,message:message||reason};}
 function each(xs,fn){if(!xs)return;var i;if(typeof xs.size==='function'&&typeof xs.get==='function'){for(i=0;i<Number(xs.size());i++)fn(xs.get(i));}else if(typeof xs.iterator==='function'){var it=xs.iterator();while(it.hasNext())fn(it.next());}else for(i=0;i<xs.length;i++)fn(xs[i]);}
 function keys(tag){var out=[];each(tag.getAllKeys(),function(k){out.push(String(k));});return out.sort();}
 function child(parent,key){if(!parent.contains(key,10))parent.put(key,new Compound());return parent.getCompound(key);}
 function root(server){var r=child(server.persistentData,ROOT);if(!r.getString('world_id'))r.putString('world_id',String(UUID.randomUUID()));return r;}
 function ledger(p){return child(child(root(p.server),'players'),id(p));}
 function rt(p){var k=id(p),w=String(root(p.server).getString('world_id'));if(!runtime[k]||runtime[k].world!==w)runtime[k]={world:w,sequence:0,budget:0,inventory:null,debounce:false,networkQueue:[],drainScheduled:false};return runtime[k];}
 function changed(l){l.putInt('revision',Number(l.getInt('revision'))+1);}
 function claimed(l){var c=child(l,'milestones'),out=[];for(var i=0;i<cfg.milestones.length;i++){var t=cfg.milestones[i].threshold;if(c.getBoolean(String(t)))out.push(t);}return out;}
 function bonuses(l){var c=child(l,'milestones');return{mp:(c.getBoolean('8')?5:0)+(c.getBoolean('40')?5:0)+(c.getBoolean('80')?10:0),speed:c.getBoolean('20')?0.03:0,luck:(c.getBoolean('40')?0.5:0)+(c.getBoolean('60')?0.5:0),health:c.getBoolean('60')?2:0};}
 function discovered(l){var d=child(l,'discovered'),out=[];for(var i=0;i<entries.length;i++)if(d.getBoolean(entries[i].id))out.push(entries[i].id);return out;}
 function header(p,l){var s=F.loadPlayerState(p),old=s.compendium_v1||{},b=bonuses(l),w=String(root(p.server).getString('world_id'));if(typeof old!=='object'||Array.isArray(old))old={legacy_payload:old};
  // Merge owned fields; preserve unknown extensions. A different world's pending
  // gift cannot be replayed into this world's ledger.
  s.compendium_v1=old;if(old.world_id!==w)delete old.pending_gift;
  old.version=1;old.storage='world_compound_v1';old.world_id=w;old.revision=Number(l.getInt('revision'));old.collected=discovered(l).length;old.bonus_max_mp=b.mp;old.claimed_milestones=claimed(l);
  F.savePlayerState(p,s);return s.compendium_v1;
 }
 function send(p,key,data){p.sendData('f_rank_days:'+key,data);}
 function next(p){return ++rt(p).sequence;}
 // Java writeUTF uses modified UTF-8, not UTF-8. Budget includes NUL and UTF-16 surrogates.
 // Installed Rhino's charCodeAt returns java.lang.Character (not a numeric code).
 // codePointAt returns Integer; supplementary points occupy two writeUTF units.
 function mutfBytes(s){var bytes=0;for(var i=0;i<s.length;i++){var n=s.codePointAt(i);if(n>65535){bytes+=6;i++;}else bytes+=n>=1&&n<=127?1:n<=2047?2:3;}return bytes;}
 function toast(p,e,l){send(p,'compendium_toast',{session_id:session,sequence:next(p),entry_id:e.id,name:e.name,collected:discovered(l).length,total:80,duration_ticks:56});}
 function scheduleSnapshot(p){var r=rt(p);if(r.pendingSnapshot)return;r.pendingSnapshot=true;p.server.scheduleInTicks(2,function(){r.pendingSnapshot=false;if(runtime[id(p)]!==r||p.isRemoved())return;push(p);});}
 function discover(p,e,l){l=l||ledger(p);var d=child(l,'discovered');if(d.getBoolean(e.id))return false;d.putBoolean(e.id,true);child(l,'unread').putBoolean(e.id,true);changed(l);header(p,l);toast(p,e,l);scheduleSnapshot(p);if(F.onChapter1CompendiumCollectedV10)F.onChapter1CompendiumCollectedV10(p,discovered(l).length);return true;}
 function giftPage(l,npc,offset){var book=child(child(l,'known_gifts'),npc),all=keys(book);offset=Math.max(0,Math.min(all.length,Math.floor(Number(offset)||0)));var rows=[];for(var i=offset;i<all.length&&i<offset+20;i++){var r=book.getCompound(all[i]);rows.push({item_id:all[i],reaction:String(r.getString('reaction')),delta:Number(r.getInt('delta')),recorded_at:Number(r.getLong('recorded_at'))});}return{npc_id:npc,offset:offset,total:all.length,entries:rows};}
 function snapshot(p,opts){opts=opts||{};var l=ledger(p),d=discovered(l),c=claimed(l),kill={},unread=[],u=child(l,'unread'),counts=child(l,'kill_counts'),claimable=[];
  for(var i=0;i<entries.length;i++){var e=entries[i];if(e.kind==='monster')kill[e.id]=Number(counts.getInt(e.id));if(u.getBoolean(e.id))unread.push(e.id);}
  for(var j=0;j<cfg.milestones.length;j++)if(d.length>=cfg.milestones[j].threshold&&c.indexOf(cfg.milestones[j].threshold)<0)claimable.push(cfg.milestones[j].threshold);
  var catalog=copy(entries);for(var mi=0;mi<catalog.length;mi++)if(catalog[mi].kind==='monster'){var row=catalog[mi];row.details_unlocked=Number(kill[row.id]||0)>=Number(row.required_kills);if(!row.details_unlocked){delete row.drops;delete row.native_drops;delete row.server_first_rewards;delete row.drop_note;delete row.weakness;}}
  header(p,l);var out={version:1,session_id:session,sequence:next(p),revision:Number(l.getInt('revision')),entries:catalog,discovered:d,kill_counts:kill,unread_entries:unread,collected:d.length,total:80,claimed_milestones:c,claimable_milestones:claimable,milestones:copy(cfg.milestones),bonus_max_mp:bonuses(l).mp,current_max_mp:F.getManaStateV98(p).max_mp};
  if(npcs[String(opts.npc_id)])out.gift_page=giftPage(l,String(opts.npc_id),opts.offset);
  if(opts.claim_result)out.claim_result=opts.claim_result;
  return out;
 }
 function push(p,opts){var data=snapshot(p,opts),json=JSON.stringify(data);if(mutfBytes(json)>=60000)throw new Error('Compendium snapshot exceeds modified UTF-8 budget: '+mutfBytes(json));send(p,'compendium_snapshot',{version:1,session_id:session,sequence:data.sequence,revision:data.revision,snapshot_json:json});return data;}
 function applyModifiers(p){var l=ledger(p),b=bonuses(l),A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),M=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),Op=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation');
  var attrs=[A.MOVEMENT_SPEED,A.LUCK,A.MAX_HEALTH],values=[b.speed,b.luck,b.health];
  for(var i=0;i<attrs.length;i++){var a=p.getAttribute(attrs[i]);if(!a)throw new Error('Missing compendium attribute '+i);var key=UUID.fromString('4fc5a100-7ec5-4d00-9a85-00000000000'+i);a.removeModifier(key);if(values[i])a.addPermanentModifier(new M(key,'fcraft_compendium_v99_'+i,values[i],i===0?Op.MULTIPLY_BASE:Op.ADDITION));}
  header(p,l);if(Number(p.health)>Number(p.maxHealth))p.health=Number(p.maxHealth);if(F.syncManaV98)F.syncManaV98(p,true);return b;
 }
 function retryNews(p){var l=ledger(p);if(!child(l,'milestones').getBoolean('80')||l.getBoolean('completion_news_recorded'))return;
  if(!l.contains('completion_day'))l.putInt('completion_day',F.getCurrentGameDayV8(p.server));
  var result=F.recordNewspaperEventV8(p.server,{type:'COMPENDIUM_COMPLETE_V99',actor_uuid:id(p),display_name:String(p.username),day:Number(l.getInt('completion_day')),sub_key:'compendium_80',custom_headline:String(p.username)+' · 80종 모험가 도감 완성!',scope:'PUBLIC',region:'브리온'});
  if(result&&(result.ok||result.reason==='duplicate_event_ignored'))l.putBoolean('completion_news_recorded',true);
 }
 function claim(p,threshold){threshold=Number(threshold);var spec=null;for(var i=0;i<cfg.milestones.length;i++)if(cfg.milestones[i].threshold===threshold)spec=cfg.milestones[i];if(!spec)return fail('invalid_threshold');
  var l=ledger(p),backup=l.copy(),result=F.runAtomicPlayerV96(p,function(){
   if(child(l,'milestones').getBoolean(String(threshold)))return fail('already_claimed','이미 받은 포상입니다.');if(discovered(l).length<threshold)return fail('insufficient_entries','아직 도감 기록이 부족합니다.');
   for(var j=0;j<spec.items.length;j++){var row=spec.items[j];if(!Item.exists(row.id))return fail('missing_reward_item');var before=F.countPlayerItem(p,row.id),stack=Item.of(row.id,row.count);p.inventory.add(stack);if(F.countPlayerItem(p,row.id)!==before+row.count)return fail('inventory_full','포상 재료를 받을 인벤토리 공간이 필요합니다.');}
   var money=F.grantPlayerCurrencyV8(p,spec.copper,false);if(!money||!money.ok)return fail('currency_failed');
   child(l,'milestones').putBoolean(String(threshold),true);changed(l);header(p,l);
   var state=F.loadPlayerState(p);state.compendium_titles_v99=state.compendium_titles_v99||[];if(state.compendium_titles_v99.indexOf(spec.title)<0)state.compendium_titles_v99.push(spec.title);
   if(threshold===80){state.legendary_titles_v99=state.legendary_titles_v99||[];if(state.legendary_titles_v99.indexOf('《만물을 기록한 자》')<0)state.legendary_titles_v99.push('《만물을 기록한 자》');l.putInt('completion_day',F.getCurrentGameDayV8(p.server));}
   F.savePlayerState(p,state);return{ok:true,reason:'claimed',threshold:threshold,message:spec.title+' 포상을 받았습니다.'};
  });
  if(!result||!result.ok){child(root(p.server),'players').put(id(p),backup);return result||fail('transaction_failed');}
  // Payout is already committed. Optional presentation retries must never repeat it.
  try{applyModifiers(p);retryNews(p);scheduleSnapshot(p);}catch(error){console.warn('[F-Craft compendium] committed reward effects pending: '+error);}
  return result;
 }
 function read(p,ids){var l=ledger(p),u=child(l,'unread'),dirty=false;if(!ids||typeof ids.forEach!=='function')return fail('invalid_entries');if(Number(ids.length)>80)return fail('too_many_entries');each(ids,function(k){k=String(k);if(byId[k]&&u.getBoolean(k)){u.remove(k);dirty=true;}});if(dirty){changed(l);header(p,l);}return{ok:true};}
 F.getCompendiumSnapshotV99=snapshot;F.claimCompendiumMilestoneV99=claim;F.markCompendiumReadV99=read;F.openCompendiumV99=function(p){return push(p);};F.applyCompendiumModifiersV99=applyModifiers;
 F.getCompendiumBonusManaV99=function(s){var n=Number(s&&s.compendium_v1&&s.compendium_v1.bonus_max_mp||0);return isFinite(n)?Math.max(0,Math.min(20,n)):0;};
 F.getCompendiumGiftReactionV99=function(npc,item){var rules=cfg.gifts[npc];if(!rules)return null;var cats=['hated','disliked','loved','liked'];for(var i=0;i<cats.length;i++)if((rules[cats[i]]||[]).indexOf(item)>=0)return{reaction:cats[i],delta:cfg.reactions[cats[i]]};var preferred=F.NPC_DIALOG_DEFS[npc]&&F.NPC_DIALOG_DEFS[npc].preferred_gifts||[];return preferred.indexOf(item)>=0?{reaction:'liked',delta:3}:{reaction:'neutral',delta:1};};
 F.flushCompendiumGiftV99=function(p){var s=F.loadPlayerState(p),h=s.compendium_v1||{},w=String(root(p.server).getString('world_id')),pending=h.world_id===w&&h.pending_gift;if(!pending)return{ok:true,empty:true};
  if(!npcs[pending.npc_id]||!cfg.reactions.hasOwnProperty(pending.reaction)||cfg.reactions[pending.reaction]!==pending.delta||!Item.exists(pending.item_id))return fail('invalid_pending_gift');
  var l=ledger(p),r=child(child(child(l,'known_gifts'),pending.npc_id),pending.item_id),records=child(r,'reactions'),record=child(records,pending.reaction);
  if(!record.contains('first_at'))record.putLong('first_at',pending.recorded_at);record.putLong('last_at',pending.recorded_at);r.putString('reaction',pending.reaction);r.putInt('delta',pending.delta);r.putLong('recorded_at',pending.recorded_at);
  if(String(r.getString('last_receipt'))!==pending.receipt_id){r.putString('last_receipt',pending.receipt_id);changed(l);}
  delete h.pending_gift;F.savePlayerState(p,s);header(p,l);discover(p,npcs[pending.npc_id],l);scheduleSnapshot(p);return{ok:true};
 };
 // Called only inside the existing inventory/affinity transaction, then flushed after commit.
 F.queueCompendiumGiftV99=function(p,npc,item,reaction){if(!npcs[npc]||!reaction)return{ok:true,ignored:true};var l=ledger(p);header(p,l);var s=F.loadPlayerState(p);if(s.compendium_v1.pending_gift)return fail('gift_memo_pending');s.compendium_v1.pending_gift={npc_id:npc,item_id:item,reaction:reaction.reaction,delta:reaction.delta,recorded_at:Date.now(),receipt_id:String(UUID.randomUUID())};F.savePlayerState(p,s);return{ok:true};};
 F.onCompendiumNpcTalkCommittedV99=function(p,npc){if(!player(p)||!npcs[npc])return{ok:false,reason:'untracked_npc'};var s=F.loadPlayerState(p);if(!s.npc_dialog.open||s.npc_dialog.active_npc_id!==npc)return fail('dialog_not_open');return{ok:true,discovered:discover(p,npcs[npc])};};
 F.onCompendiumSaleCommittedV99=function(p,result){if(!result||!result.ok||!result.item_id)return;F.onCompendiumItemAcquiredV99(p,{id:result.item_id,empty:false,count:result.count},'accepted_sale');};
 F.onCompendiumItemAcquiredV99=function(p,stack,source){if(!player(p)||!stack||stack.empty||Number(stack.count)<1)return false;var e=items[String(stack.id)];return e?discover(p,e):false;};
 function countKill(p,e,uuid){var l=ledger(p),seen=child(l,'death_receipts');if(seen.getBoolean(uuid))return{ok:true,already:true};seen.putBoolean(uuid,true);var c=child(l,'kill_counts'),n=Number(c.getInt(e.id))+1;c.putInt(e.id,n);changed(l);if(!discover(p,e,l))header(p,l);scheduleSnapshot(p);return{ok:true,count:n,details_unlocked:n>=Number(e.required_kills)};}
 F.onCompendiumBossReceiptV99=function(p,c){var e=c&&mobs[String(c.bossId)];if(!e||!e.boss||!F.isActiveBossDeathContextV99(p,c))return fail('verified_personal_receipt_required');
  var receipt=(F.loadPlayerState(p).boss_receipts_v99||{})[c.uuid];if(!receipt||String(receipt.bossId||receipt.boss_id||'')!==String(c.bossId))return fail('personal_receipt_missing');
  var killer=null;each(p.server.players,function(q){if(id(q)===c.killerUUID)killer=q;});if(!killer||String(killer.level.dimension)!==String(c.dimension))return fail('killer_unavailable');
  var dx=Number(killer.x)-c.x,dy=Number(killer.y)-c.y,dz=Number(killer.z)-c.z;if(dx*dx+dy*dy+dz*dz>1296||!(id(p)===c.killerUUID||F.areManaAlliesV98(killer,p)))return fail('not_nearby_killer_or_team');
  return countKill(p,e,c.uuid);
 };
 function inventoryCounts(p){var out={},size=Number(p.inventory.getContainerSize());for(var i=0;i<size;i++){var stack=p.inventory.getItem(i);if(stack&&!stack.empty&&items[String(stack.id)])out[String(stack.id)]=(out[String(stack.id)]||0)+Number(stack.count);}return out;}
 function baseline(p){rt(p).inventory=inventoryCounts(p);}
 function inventoryChanged(p){if(!player(p))return;var r=rt(p);if(r.inventory===null){baseline(p);return;}if(r.debounce)return;r.debounce=true;p.server.scheduleInTicks(1,function(){r.debounce=false;if(p.isRemoved())return;var counts=inventoryCounts(p),previous=r.inventory||{};r.inventory=counts;for(var k in counts)if(counts[k]>Number(previous[k]||0))discover(p,items[k]);});}
 function init(p){header(p,ledger(p));baseline(p);F.flushCompendiumGiftV99(p);applyModifiers(p);retryNews(p);push(p);}
 for(var i=0;i<entries.length;i++){var e=entries[i];if(byId[e.id])throw new Error('Duplicate compendium ID '+e.id);byId[e.id]=e;if(e.kind==='item'){if(!Item.exists(e.item_id)&&e.fallback_item_id&&Item.exists(e.fallback_item_id))e.item_id=e.fallback_item_id;items[e.item_id]=e;}else if(e.kind==='monster')mobs[e.entity_id]=e;else npcs[e.npc_id]=e;}
 if(entries.length!==80)throw new Error('Compendium requires exactly80 entries');
 // The original trade closure and this exported object share the same catalog.
 for(var npc in cfg.sale_additions){var sell=F.NPC_SELL_CATALOG_V96[npc]||(F.NPC_SELL_CATALOG_V96[npc]={});for(var item in cfg.sale_additions[npc])if(sell[item]===undefined)sell[item]=cfg.sale_additions[npc][item];}
 for(var j=0;j<entries.length;j++)if(entries[j].kind==='item'){var sellers=[];for(var n in F.NPC_SELL_CATALOG_V96)if(F.NPC_SELL_CATALOG_V96[n][entries[j].item_id]!==undefined)sellers.push((F.NPC_DIALOG_DEFS[n]&&F.NPC_DIALOG_DEFS[n].name||n)+' · 개당 '+F.NPC_SELL_CATALOG_V96[n][entries[j].item_id]+'동화');entries[j].merchant_text=sellers.length?sellers.join(' / ')+' (직업 매입 보너스 별도)':'직접 매입처 없음';}
 session=String(UUID.randomUUID());ServerEvents.loaded(function(){session=String(UUID.randomUUID());runtime={};});
 // Admission copies only bounded primitives; no event or CompoundTag survives the callback.
 function normalizeNetwork(data){try{data=data||{};var action=typeof data.getString==='function'?String(data.getString('action')):String(data.action||''),out={action:action};
  if(action==='sync')return out;
  if(action==='read'){var tags=typeof data.getList==='function'?data.getList('entry_ids',8):null,source=tags||data.entry_ids||[],n=tags?Number(tags.size()):Array.isArray(source)?source.length:-1,seen={},arr=[];
   if(!isFinite(n)||n<0||n>80||Math.floor(n)!==n)return null;
   for(var i=0;i<n;i++){var value=tags?String(tags.getString(i)):source[i];if(typeof value!=='string')return null;if(byId[value]&&!seen[value]){seen[value]=true;arr.push(value);}}
   out.entry_ids=arr;return out;
  }
  if(action==='claim'){var threshold=typeof data.getDouble==='function'?Number(data.getDouble('threshold')):Number(data.threshold),valid=false;for(var j=0;j<cfg.milestones.length;j++)if(cfg.milestones[j].threshold===threshold)valid=true;if(!valid)return null;out.threshold=threshold;return out;}
  if(action==='gifts'){var npc=typeof data.getString==='function'?String(data.getString('npc_id')):String(data.npc_id||''),offset=typeof data.getDouble==='function'?Number(data.getDouble('offset')):Number(data.offset===undefined?0:data.offset);if(!npcs[npc]||!isFinite(offset))return null;out.npc_id=npc;out.offset=Math.max(0,Math.floor(offset));return out;}
  return null;
 }catch(error){return null;}}
 function networkLive(p,r){return runtime[id(p)]===r&&!p.isRemoved()&&String(root(p.server).getString('world_id'))===r.world;}
 function processNetwork(p,request){var opts={};if(request.action==='read')read(p,request.entry_ids);else if(request.action==='claim')opts.claim_result=claim(p,request.threshold);else if(request.action==='gifts'){opts.npc_id=request.npc_id;opts.offset=request.offset;}push(p,opts);}
 function scheduleNetworkDrain(p,r){if(r.drainScheduled||!r.networkQueue.length)return;if(!networkLive(p,r)){r.networkQueue=[];return;}r.drainScheduled=true;
  p.server.scheduleInTicks(Math.max(1,r.budget-Number(p.server.overworld().getTime())),function(){r.drainScheduled=false;if(!networkLive(p,r)){r.networkQueue=[];return;}var now=Number(p.server.overworld().getTime());if(now<r.budget){scheduleNetworkDrain(p,r);return;}var request=r.networkQueue.shift();if(!request)return;r.budget=now+4;try{processNetwork(p,request);}finally{scheduleNetworkDrain(p,r);}});
 }
 function enqueueNetwork(p,r,request){for(var i=0;i<r.networkQueue.length;i++){var queued=r.networkQueue[i];if(queued.action!==request.action)continue;
   if(request.action==='read'){for(var j=0;j<request.entry_ids.length;j++)if(queued.entry_ids.indexOf(request.entry_ids[j])<0&&queued.entry_ids.length<80)queued.entry_ids.push(request.entry_ids[j]);return true;}
   if(request.action==='sync'||request.action==='claim'&&queued.threshold===request.threshold||request.action==='gifts'&&queued.npc_id===request.npc_id&&queued.offset===request.offset)return true;
  }
  if(r.networkQueue.length>=32)return false; // Explicit overload admission refusal; never evict accepted work.
  r.networkQueue.push(request);scheduleNetworkDrain(p,r);return true;
 }
 NetworkEvents.dataReceived('f_rank_days:compendium_action',function(event){var p=event.player;if(!player(p)||p.isRemoved())return;var request=normalizeNetwork(event.data);if(request)enqueueNetwork(p,rt(p),request);});
 PlayerEvents.loggedIn(function(e){init(e.player);});PlayerEvents.loggedOut(function(e){delete runtime[id(e.player)];});PlayerEvents.respawned(function(e){e.server.scheduleInTicks(1,function(){init(e.player);});});
 PlayerEvents.inventoryChanged(function(e){inventoryChanged(e.player||e.entity);});
 ItemEvents.pickedUp(function(e){F.onCompendiumItemAcquiredV99(e.player||e.entity,e.item,'pickup');});ItemEvents.crafted(function(e){F.onCompendiumItemAcquiredV99(e.player||e.entity,e.item,'craft');});ItemEvents.smelted(function(e){F.onCompendiumItemAcquiredV99(e.player||e.entity,e.item,'smelt');});ItemEvents.foodEaten(function(e){F.onCompendiumItemAcquiredV99(e.player||e.entity,e.item,'eat');});
 EntityEvents.death(function(event){var victim=event.entity,e=mobs[String(victim.type)],p=event.source&&event.source.actual;if(!e||e.boss||!player(p))return;var uuid=String(victim.uuid);p.server.scheduleInTicks(1,function(){if(victim.isAlive())return;countKill(p,e,uuid);});});
 F.onCompendiumDimensionChangedV99=function(p){applyModifiers(p);retryNews(p);};
 var oldTravel=F.afterDimensionTravelV99;F.afterDimensionTravelV99=function(p,from,to){var result=oldTravel&&oldTravel(p,from,to);F.onCompendiumDimensionChangedV99(p);return result;};
 // Read-only policy/test surface; no client input can call a discovery or payout setter.
 F.COMPENDIUM_RULES_V99={total:80,storage:ROOT,config:copy(cfg),modifiedUtf8Bytes:mutfBytes,modifierIds:['4fc5a100-7ec5-4d00-9a85-000000000000','4fc5a100-7ec5-4d00-9a85-000000000001','4fc5a100-7ec5-4d00-9a85-000000000002']};
})(global.FRankDays);
