// World-local, on-demand private interiors. Never rebuild an occupied READY slot.
global.FRankDays=global.FRankDays||{};
(function(F){
 var DIM='f_rank_days:cottage_interiors_v10',SAVE='fcraft_cottages_v10',HP='4fc6a100-7ec6-4d00-9a86-000000000001';
 var Compound=Java.loadClass('net.minecraft.nbt.CompoundTag'),UUID=Java.loadClass('java.util.UUID'),Pos=Java.loadClass('net.minecraft.core.BlockPos');
 var SOURCE={minX:-32,minY:106,minZ:-889,w:20,h:27,d:23,door:{x:-20,y:107,z:-875},seed:{x:-21,y:107,z:-877}},building={},rests={},sleepBefore={},snapshotStates={};
 function fail(reason){return{ok:false,reason:reason};}
 function uid(p){return String(p.uuid);}
 function time(server){return Number(server.overworld().getTime());}
 function child(t,k){if(!t.contains(k,10))t.put(k,new Compound());return t.getCompound(k);}
 function root(server){var r=child(server.persistentData,SAVE);if(!r.getString('world_id'))r.putString('world_id',String(UUID.randomUUID()));return r;}
 function worldId(server){return String(root(server).getString('world_id'));}
 function state(p){var s=F.loadPlayerState(p);if(!s.cottage_v10||typeof s.cottage_v10!=='object'||Array.isArray(s.cottage_v10))s.cottage_v10={};return s;}
 function owner(server,uuid){return child(child(root(server),'owners'),uuid);}
 function idx(x,y,z){return (y*SOURCE.d+z)*SOURCE.w+x;}
 function xyz(i){return{x:i%SOURCE.w,z:Math.floor(i/SOURCE.w)%SOURCE.d,y:Math.floor(i/(SOURCE.w*SOURCE.d))};}
 function canonical(s){return String(s).replace(/^Block\{([^}]+)\}/,'$1');}
 function capturedState(expected){
  if(snapshotStates[expected])return snapshotStates[expected];
  var Registry=Java.loadClass('net.minecraft.core.registries.BuiltInRegistries').BLOCK,Location=Java.loadClass('net.minecraft.resources.ResourceLocation'),List=Java.loadClass('java.util.ArrayList'),id=new Location(expected.split('[')[0]);
  if(!Registry.containsKey(id))throw new Error('captured_block_unregistered '+expected);
  var states=new List(Registry.get(id).getStateDefinition().getPossibleStates());for(var i=0;i<Number(states.size());i++){var native=states.get(i);if(canonical(native)===expected){snapshotStates[expected]=native;return native;}}
  throw new Error('captured_state_unresolvable '+expected);
 }
 function air(s){return ['minecraft:air','minecraft:cave_air','minecraft:void_air'].indexOf(s)>=0;}
 function decor(s){return /^minecraft:(?:chest|trapped_chest|barrel|crafting_table|furnace|smoker|blast_furnace|loom|cartography_table|stonecutter|grindstone|flower_pot|potted_[a-z_]+|[a-z_]+_bed|lantern|soul_lantern|torch|wall_torch|[a-z_]*candle)(?:\[|$)/.test(s);}
 function position(level,x,y,z){return level.getBlockState(new Pos(x,y,z));}
 function loadChunks(level,x0,z0,x1,z1){for(var x=x0>>4;x<=x1>>4;x++)for(var z=z0>>4;z<=z1>>4;z++)level.getChunk(x,z);}
 function eligible(s){if(!s.guild_card||!s.guild_card.issued)return false;if(s.e_rank_camp_unlocked)return true;var jobs=s.job_licenses||{};for(var j in jobs)if(['E','D','C','B','A','S'].indexOf(String(jobs[j].grade))>=0)return true;return false;}
 function serialCount(p,item,serial){var n=0,size=Number(p.inventory.getContainerSize());for(var i=0;i<size;i++){var a=p.inventory.getItem(i),b=a&&a.nbt&&a.nbt.FCraftOwnedV10;if(a&&!a.empty&&String(a.id)===item&&b&&String(b.serial)===serial)n+=Number(a.count);}return n;}
 function boundItem(p,item,serial){return Item.of(item,1,{FCraftOwnedV10:{owner:uid(p),world:worldId(p.server),serial:serial}});}
 F.makeOwnedCottageItemV10=boundItem;
 F.getCottageWorldIdV10=worldId;
 F.ensureCottageEntitlementV10=function(p){var s=state(p);if(!eligible(s))return fail('requires_first_e_grade');var h=s.cottage_v10,w=worldId(p.server);s.cottage_unlocked=true;
  if(h.world_id!==w){h.world_id=w;h.warmth_until_tick=0;h.key={status:'PENDING',serial:String(UUID.randomUUID())};}
  if(!h.key)h.key={status:'PENDING',serial:String(UUID.randomUUID())};F.savePlayerState(p,s);
  if(h.key.status==='GRANTED')return{ok:true,already:true};
  return F.runAtomicPlayerV96(p,function(){var q=state(p),key=q.cottage_v10.key;if(!eligible(q)||q.cottage_v10.world_id!==w||!key)return fail('entitlement_changed');if(key.status==='GRANTED')return{ok:true,already:true};
   var id='f_rank_days:brion_cottage_key',before=serialCount(p,id,key.serial);p.inventory.add(boundItem(p,id,key.serial));if(serialCount(p,id,key.serial)!==before+1)return fail('inventory_space_required');key.status='GRANTED';key.granted_tick=time(p.server);F.savePlayerState(p,q);return{ok:true,granted:true};
  });
 };
 function capture(server){if(typeof F.isFcraftV9World!=='function'||!F.isFcraftV9World(server))return fail('not_fcraft_world');var r=root(server),t=child(r,'template');if(t.getBoolean('ready')&&Number(t.getInt('foundation_count'))===SOURCE.w*SOURCE.d)return{ok:true,template:t};var level=server.getLevel('minecraft:overworld');if(!level)return fail('source_world_unavailable');
  loadChunks(level,SOURCE.minX,SOURCE.minZ,SOURCE.minX+SOURCE.w-1,SOURCE.minZ+SOURCE.d-1);
  if(canonical(position(level,SOURCE.door.x,SOURCE.door.y,SOURCE.door.z)).indexOf('minecraft:oak_door')!==0||!air(canonical(position(level,SOURCE.seed.x,SOURCE.seed.y,SOURCE.seed.z))))return fail('original_cottage_source_missing');
  // The source's grass at y106 rests on original y105 soil. Preserve that layer
  // before copying the volume, rather than placing unsupported plants in void.
  var foundation=child(t,'foundation');for(var fz=0;fz<SOURCE.d;fz++)for(var fx=0;fx<SOURCE.w;fx++)foundation.putString(String(fz*SOURCE.w+fx),canonical(position(level,SOURCE.minX+fx,SOURCE.minY-1,SOURCE.minZ+fz)));t.putInt('foundation_count',SOURCE.w*SOURCE.d);
  if(t.getBoolean('ready'))return{ok:true,template:t};
  var blocks=child(t,'blocks'),editable=child(t,'editable'),states=[],seen={},queue=[],start=idx(SOURCE.seed.x-SOURCE.minX,SOURCE.seed.y-SOURCE.minY,SOURCE.seed.z-SOURCE.minZ),count=SOURCE.w*SOURCE.h*SOURCE.d;
  for(var i=0;i<count;i++){var a=xyz(i),s=canonical(position(level,SOURCE.minX+a.x,SOURCE.minY+a.y,SOURCE.minZ+a.z));states[i]=s;blocks.putString(String(i),s);}
  queue.push(start);seen[start]=true;var cursor=0,leaks=false;
  while(cursor<queue.length){var k=queue[cursor++],v=xyz(k);if(v.x===0||v.z===0||v.y===0||v.x===SOURCE.w-1||v.z===SOURCE.d-1||v.y===SOURCE.h-1)leaks=true;
   var offsets=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
   for(var n=0;n<offsets.length;n++){var x=v.x+offsets[n][0],y=v.y+offsets[n][1],z=v.z+offsets[n][2];if(x<0||y<0||z<0||x>=SOURCE.w||y>=SOURCE.h||z>=SOURCE.d)continue;var next=idx(x,y,z);if(!seen[next]&&(air(states[next])||decor(states[next]))){seen[next]=true;queue.push(next);}}
  }
  if(leaks)return fail('source_interior_not_enclosed');
  var available=0;for(var key in seen){var q=xyz(Number(key));if(q.x>=2&&q.x<SOURCE.w-2&&q.z>=2&&q.z<SOURCE.d-2&&q.y>0&&q.y<SOURCE.h-1){editable.putBoolean(key,true);available++;}}
  if(!available)return fail('source_interior_mask_empty');t.putInt('count',count);t.putInt('editable_count',available);t.putInt('version',1);t.putBoolean('ready',true);return{ok:true,template:t};
 }
 function slot(server,uuid){var o=owner(server,uuid);if(!o.getBoolean('reserved')){var r=root(server),n=Number(r.getLong('next_index')),x=(n%1024)*128,z=Math.floor(n/1024)*128;if(x+SOURCE.w>=29999000||z+SOURCE.d>=29999000)return null;
   o.putBoolean('reserved',true);o.putLong('index',n);o.putString('owner',uuid);o.putInt('x',x);o.putInt('y',80);o.putInt('z',z);o.putInt('cursor',0);o.putString('phase','RESERVED');r.putLong('next_index',n+1);
  }return o;}
 function inSlot(o,x,y,z){return o.getBoolean('reserved')&&x>=o.getInt('x')&&x<o.getInt('x')+SOURCE.w&&y>=o.getInt('y')&&y<o.getInt('y')+SOURCE.h&&z>=o.getInt('z')&&z<o.getInt('z')+SOURCE.d;}
 function localIndex(o,x,y,z){return idx(Math.floor(x)-o.getInt('x'),Math.floor(y)-o.getInt('y'),Math.floor(z)-o.getInt('z'));}
 F.shouldProtectCottageBlockV10=function(server,dimension,x,y,z){return String(dimension)===DIM;};
 F.canInteractCottageBlockV10=function(p,dimension,x,y,z){if(String(dimension)!==DIM)return false;var o=owner(p.server,uid(p));return eligible(state(p))&&String(o.getString('phase'))==='READY'&&inSlot(o,x,y,z);};
 F.canEditCottageBlockV10=function(p,dimension,x,y,z){if(!F.canInteractCottageBlockV10(p,dimension,x,y,z))return false;var o=owner(p.server,uid(p)),t=child(root(p.server),'template');return child(t,'editable').getBoolean(String(localIndex(o,x,y,z)));};
 F.shouldProtectCottageEntityV10=function(p,e){return !!e&&String(e.level.dimension)===DIM&&(!p||!F.canInteractCottageBlockV10(p,DIM,Number(e.x),Number(e.y),Number(e.z)));};
 F.guardCottageInteractV10=function(e){var p=e.getEntity(),pos=e.getPos();if(!p||String(p.level.dimension)!==DIM)return;if(!F.canInteractCottageBlockV10(p,DIM,Number(pos.getX()),Number(pos.getY()),Number(pos.getZ())))e.setCanceled(true);};
 F.guardCottageEntityV10=function(e){if(F.shouldProtectCottageEntityV10(e.getEntity(),e.getTarget()))e.setCanceled(true);};
 F.guardCottageProjectileV10=function(e){var trace=e.getRayTraceResult();if(!trace||typeof trace.getEntity!=='function')return;var target=trace.getEntity();if(!target||String(target.level.dimension)!==DIM)return;var projectile=e.getProjectile(),shooter=projectile&&projectile.getOwner();if(shooter&&(!shooter.isPlayer||!shooter.isPlayer()))shooter=null;if(F.shouldProtectCottageEntityV10(shooter,target)&&e.isCancelable())e.setCanceled(true);};
 function teleport(p,target){p.teleportTo(target.dimension,target.x,target.y,target.z,0,0);p.fallDistance=0;p.setMotionX(0);p.setMotionY(0);p.setMotionZ(0);}
 function enterReady(p,o){var s=state(p);if(!eligible(s)||String(o.getString('phase'))!=='READY')return fail('interior_not_ready');s.cottage_v10.return_position={dimension:String(p.level.dimension),x:Number(p.x),y:Number(p.y),z:Number(p.z)};F.savePlayerState(p,s);
  teleport(p,{dimension:DIM,x:o.getInt('x')+SOURCE.seed.x-SOURCE.minX+.5,y:o.getInt('y')+SOURCE.seed.y-SOURCE.minY,z:o.getInt('z')+SOURCE.seed.z-SOURCE.minZ+.5});return{ok:true};}
 function build(server,uuid){var key=worldId(server)+'|'+uuid;if(building[key])return;building[key]=true;
  function writeCell(dest,sx,sy,sz,dx,dy,dz,expected,index,phase){var native=capturedState(expected);dest.getChunk(dx>>4,dz>>4);var result=dest.setBlock(new Pos(dx,dy,dz),native,18),actual=canonical(position(dest,dx,dy,dz));if(actual!==expected)throw new Error('interior_block_write_failed '+JSON.stringify({phase:phase,index:index,source:[sx,sy,sz],destination:[dx,dy,dz],expected:expected,actual:actual,setBlockReturned:!!result,flags:18}));}
  function batch(){var o=owner(server,uuid),t=child(root(server),'template'),dest=server.getLevel(DIM);if(!dest||!t.getBoolean('ready')){delete building[key];return;}o.putString('phase','BUILDING');
   var cursor=Number(o.getInt('cursor')),end=Math.min(Number(t.getInt('count')),cursor+256),blocks=child(t,'blocks');
   try{var base=Number(o.getInt('foundation_cursor')),baseEnd=Math.min(Number(t.getInt('foundation_count')),base+256),baseStates=child(t,'foundation');if(base<Number(t.getInt('foundation_count'))){for(;base<baseEnd;base++){var fx=base%SOURCE.w,fz=Math.floor(base/SOURCE.w);writeCell(dest,SOURCE.minX+fx,SOURCE.minY-1,SOURCE.minZ+fz,o.getInt('x')+fx,o.getInt('y')-1,o.getInt('z')+fz,String(baseStates.getString(String(base))),base,'foundation');}o.putInt('foundation_cursor',base);server.scheduleInTicks(1,batch);return;}
    for(;cursor<end;cursor++){var v=xyz(cursor);
     writeCell(dest,SOURCE.minX+v.x,SOURCE.minY+v.y,SOURCE.minZ+v.z,o.getInt('x')+v.x,o.getInt('y')+v.y,o.getInt('z')+v.z,String(blocks.getString(String(cursor))),cursor,'volume');
    }o.putInt('cursor',cursor);if(cursor<Number(t.getInt('count'))){server.scheduleInTicks(1,batch);return;}o.putString('phase','READY');delete building[key];
   }catch(error){o.putString('phase','BUILDING');o.putString('last_error',String(error));delete building[key];console.warn('[F-Craft cottage] preserved partial slot: '+error);}
  }server.scheduleInTicks(1,batch);
 }
 F.enterOwnedCottageV10=function(p){var s=state(p);if(!eligible(s))return fail('requires_first_e_grade');var dest=p.server.getLevel(DIM);if(!dest)return fail('cottage_dimension_unavailable');var prepared=capture(p.server);if(!prepared.ok)return prepared;var o=slot(p.server,uid(p));if(!o)return fail('world_coordinate_limit');if(String(o.getString('phase'))!=='READY'){build(p.server,uid(p));return{ok:true,pending:true};}return enterReady(p,o);};
 F.exitOwnedCottageV10=function(p){if(String(p.level.dimension)!==DIM)return fail('not_in_cottage');var s=state(p),back=s.cottage_v10.return_position;if(!back||!p.server.getLevel(String(back.dimension)))return fail('return_world_unavailable');teleport(p,back);delete s.cottage_v10.return_position;F.savePlayerState(p,s);return{ok:true};};
 function placement(p,x,y,z){return child(owner(p.server,uid(p)),'placed').getCompound(String(x)+','+String(y)+','+String(z));}
 function ownedPlacedTrophy(p,x,y,z){
  if(String(p.level.dimension)!==DIM||!F.canInteractCottageBlockV10(p,DIM,x,y,z))return null;
  var pos=new Pos(x,y,z),level=p.server.getLevel(DIM);if(!level||!level.hasChunkAt(pos))return null;
  var rec=placement(p,x,y,z),id=String(rec.getString('item')),s=state(p),receipt=s.chapter1_trophies&&s.chapter1_trophies[id];
  if(!receipt||receipt.world!==worldId(p.server)||receipt.status!=='GRANTED'||rec.getString('status')!=='READY'||String(rec.getString('serial'))!==receipt.serial||canonical(position(level,x,y,z)).split('[')[0]!==id)return null;
  return{id:id,receipt:receipt,x:x,y:y,z:z};
 }
 F.describeCottageTrophyV10=function(p,block){
  if(!p||!block)return fail('placed_owned_trophy_required');var v=ownedPlacedTrophy(p,Number(block.x),Number(block.y),Number(block.z));
  return v&&F.getChapter1TrophyDescriptionV10?F.getChapter1TrophyDescriptionV10(p,v.id,v.receipt):fail('placed_owned_trophy_required');
 };
 F.emitOwnedCottageTrophyParticlesV10=function(p){
  if(!p||String(p.level.dimension)!==DIM||!p.isAlive()||!F.canInteractCottageBlockV10(p,DIM,Number(p.x),Number(p.y),Number(p.z)))return{ok:false,reason:'owner_not_present',positions:0,sent:0};
  var placed=child(owner(p.server,uid(p)),'placed'),it=placed.getAllKeys().iterator(),seen={},visited=0,positions=0,sent=0,Types=null;
  while(it.hasNext()&&visited++<16&&positions<4){var key=String(it.next()),a=key.split(',');if(a.length!==3)continue;var x=Number(a[0]),y=Number(a[1]),z=Number(a[2]);if(!isFinite(x)||!isFinite(y)||!isFinite(z))continue;
   var v=ownedPlacedTrophy(p,x,y,z);if(!v||seen[v.id]||Math.pow(Number(p.x)-x-.5,2)+Math.pow(Number(p.y)-y,2)+Math.pow(Number(p.z)-z-.5,2)>256)continue;seen[v.id]=true;positions++;
   if(v.id!=='f_rank_days:trophy_elven_tablet'&&v.id!=='f_rank_days:trophy_wrought_helm')continue;
   if(!Types)Types=Java.loadClass('net.minecraft.core.particles.ParticleTypes');var type=v.id==='f_rank_days:trophy_elven_tablet'?Types.SOUL_FIRE_FLAME:Types.WAX_ON;
   sent+=Number(p.server.getLevel(DIM).sendParticles(type,x+.5,y+.85,z+.5,2,.15,.12,.15,.005));
  }return{ok:true,positions:positions,sent:sent};
 };
 F.getPlacedCottageTrophiesV10=function(p){var o=owner(p.server,uid(p)),placed=child(o,'placed'),level=p.server.getLevel(DIM),found={};if(!level)return[];var it=placed.getAllKeys().iterator();while(it.hasNext()){var key=String(it.next()),record=placed.getCompound(key),a=key.split(','),id=String(record.getString('item')),s=state(p),receipt=s.chapter1_trophies&&s.chapter1_trophies[id];if(record.getString('status')==='READY'&&receipt&&receipt.status==='GRANTED'&&receipt.serial===String(record.getString('serial'))&&canonical(position(level,Number(a[0]),Number(a[1]),Number(a[2]))).split('[')[0]===id)found[id]=true;}return Object.keys(found);};
 // Decoration receipts are world-local and verify a real owner-placed block on every read.
 F.getPlacedCottageDecorV106=function(p){var o=owner(p.server,uid(p)),placed=child(o,'decor_placed_v106'),level=p.server.getLevel(DIM),found=[];if(!level||String(o.getString('phase'))!=='READY')return found;var it=placed.getAllKeys().iterator();while(it.hasNext()){var key=String(it.next()),a=key.split(','),record=placed.getCompound(key);if(a.length!==3)continue;var x=Number(a[0]),y=Number(a[1]),z=Number(a[2]),id=String(record.getString('item'));if(!isFinite(x)||!isFinite(y)||!isFinite(z)||record.getString('status')!=='READY'||!decor(id)||!F.canInteractCottageBlockV10(p,DIM,x,y,z))continue;if(canonical(position(level,x,y,z)).split('[')[0]===id)found.push({item:id,x:x,y:y,z:z});}return found;};
 F.getCottageManaRegenV10=function(s,t){var h=s&&s.cottage_v10;return h&&Number(t)>=Number(h.warmth_from_tick||0)&&Number(h.warmth_until_tick)>Number(t)?1:0;};
 F.refreshCottageWarmthV10=function(p){var s=state(p),active=F.getCottageManaRegenV10(s,time(p.server))>0&&s.cottage_v10.world_id===worldId(p.server),A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),M=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),Op=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation'),a=p.getAttribute(A.MAX_HEALTH),id=UUID.fromString(HP);if(a){a.removeModifier(id);if(active)a.addPermanentModifier(new M(id,'fcraft_cottage_warmth_v10',2,Op.ADDITION));}if(Number(p.health)>Number(p.maxHealth))p.health=Number(p.maxHealth);return{active:!!active,until:Number(s.cottage_v10.warmth_until_tick||0)};};
 function warmth(p){if(!F.getPlacedCottageTrophiesV10(p).length)return fail('place_owned_trophy_first');var s=state(p);s.cottage_v10.world_id=worldId(p.server);s.cottage_v10.warmth_from_tick=time(p.server);s.cottage_v10.warmth_until_tick=time(p.server)+18000;F.savePlayerState(p,s);F.refreshCottageWarmthV10(p);if(F.syncManaV98)F.syncManaV98(p,true);return{ok:true};}
 F.completeCottageBedRestV10=function(p){var raw=p.minecraftPlayer||p;if(String(p.level.dimension)!==DIM||!F.canInteractCottageBlockV10(p,DIM,Number(p.x),Number(p.y),Number(p.z))||!raw.isSleeping())return fail('actual_owned_bed_sleep_required');return warmth(p);};
 BlockEvents.rightClicked(function(e){var p=e.player,b=e.block;if(!p||!b)return;var dim=String(p.level.dimension),x=Number(b.x),y=Number(b.y),z=Number(b.z);
  if(dim==='minecraft:overworld'&&x===SOURCE.door.x&&z===SOURCE.door.z&&(y===107||y===108)){var r=F.enterOwnedCottageV10(p);if(p.tell)p.tell(r.ok?(r.pending?'집 실내를 준비하고 있습니다. 잠시 뒤 문을 다시 눌러 주세요.':'아늑한 내 집에 들어왔습니다.'):'거처: '+r.reason);e.cancel();return;}
  if(dim!==DIM)return;if(!F.canInteractCottageBlockV10(p,dim,x,y,z)){e.cancel();return;}var o=owner(p.server,uid(p));
  if(x===o.getInt('x')+SOURCE.door.x-SOURCE.minX&&z===o.getInt('z')+SOURCE.door.z-SOURCE.minZ){F.exitOwnedCottageV10(p);e.cancel();return;}
  if(String(b.id).indexOf('f_rank_days:trophy_')===0){var description=F.describeCottageTrophyV10(p,b);if(description.ok&&p.tell)for(var line=0;line<description.lines.length;line++)p.tell(description.lines[line]);e.cancel();return;}
  if(String(b.id).indexOf('_bed')>=0){var raw=p.minecraftPlayer||p;try{sleepBefore[uid(p)]={dimension:raw.getRespawnDimension(),position:raw.getRespawnPosition(),angle:raw.getRespawnAngle(),forced:raw.isRespawnForced()};p.server.scheduleInTicks(1,function(){var old=sleepBefore[uid(p)];delete sleepBefore[uid(p)];if(!old||p.isRemoved())return;try{if(raw.isSleeping())F.completeCottageBedRestV10(p);}finally{raw.setRespawnPosition(old.dimension,old.position,old.angle,old.forced,false);}});}catch(error){console.warn('[F-Craft cottage] bed rest unavailable: '+error);}}
 });
 BlockEvents.placed(function(e){var p=e.player,b=e.block;if(!p||String(p.level.dimension)!==DIM)return;if(!F.canEditCottageBlockV10(p,DIM,Number(b.x),Number(b.y),Number(b.z))){e.cancel();return;}var id=String(b.id);if(decor(id)){var dx=Number(b.x),dy=Number(b.y),dz=Number(b.z),world=p.server.getLevel(DIM);p.server.scheduleInTicks(1,function(){if(!F.canEditCottageBlockV10(p,DIM,dx,dy,dz)||canonical(position(world,dx,dy,dz)).split('[')[0]!==id)return;var record=new Compound();record.putString('item',id);record.putString('status','READY');record.putLong('placed_tick',time(p.server));child(owner(p.server,uid(p)),'decor_placed_v106').put(String(dx)+','+String(dy)+','+String(dz),record);});}if(id.indexOf('f_rank_days:trophy_')!==0)return;var stack=e.item;if(!stack||stack.empty||String(stack.id)!==id)stack=p.mainHandItem;var n=stack&&stack.nbt&&stack.nbt.FCraftOwnedV10,s=state(p),receipt=s.chapter1_trophies&&s.chapter1_trophies[id];
  if((!stack||stack.empty||String(stack.id)!==id)&&p.offHandItem&&String(p.offHandItem.id)===id){stack=p.offHandItem;n=stack.nbt&&stack.nbt.FCraftOwnedV10;}
  if(!n||String(n.owner)!==uid(p)||String(n.world)!==worldId(p.server)||!receipt||receipt.status!=='GRANTED'||String(n.serial)!==receipt.serial){e.cancel();return;}
  var placed=child(owner(p.server,uid(p)),'placed'),it=placed.getAllKeys().iterator();while(it.hasNext()){if(String(placed.getCompound(String(it.next())).getString('serial'))===String(n.serial)){e.cancel();return;}}
  var key=String(b.x)+','+String(b.y)+','+String(b.z),rec=new Compound();rec.putString('item',id);rec.putString('serial',String(n.serial));rec.putString('status','PENDING');placed.put(key,rec);
  p.server.scheduleInTicks(1,function(){if(canonical(position(p.server.getLevel(DIM),Number(b.x),Number(b.y),Number(b.z))).split('[')[0]===id)rec.putString('status','READY');else placed.remove(key);});
 });
 BlockEvents.broken(function(e){var p=e.player,b=e.block;if(!p||String(p.level.dimension)!==DIM)return;if(!F.canEditCottageBlockV10(p,DIM,Number(b.x),Number(b.y),Number(b.z))){e.cancel();return;}if(String(b.id).indexOf('f_rank_days:trophy_')!==0)return;
  var placed=child(owner(p.server,uid(p)),'placed'),key=String(b.x)+','+String(b.y)+','+String(b.z),rec=placed.getCompound(key),id=String(b.id),serial=String(rec.getString('serial')),level=p.server.getLevel(DIM),pos=new Pos(Number(b.x),Number(b.y),Number(b.z)),original=level.getBlockState(pos),item=Item.of('minecraft:air');
  if(rec.getString('status')!=='READY'||rec.getString('item')!==id){e.cancel();return;}
  var result=F.runAtomicPlayerV96(p,function(){var before=serialCount(p,id,serial);p.inventory.add(boundItem(p,id,serial));if(serialCount(p,id,serial)!==before+1)return fail('inventory_space_required');b.set('minecraft:air');if(!air(canonical(position(level,Number(b.x),Number(b.y),Number(b.z)))))return fail('block_recovery_failed');return{ok:true};});
  if(result&&result.ok)placed.remove(key);else{level.setBlock(pos,original,2);if(p.tell)p.tell('트로피 회수: '+(result&&result.reason||'failed'));}e.cancel();
 });
 ItemEvents.rightClicked('f_rank_days:brion_cottage_key',function(e){var p=e.player,n=e.item&&e.item.nbt&&e.item.nbt.FCraftOwnedV10;if(!n||String(n.owner)!==uid(p)||String(n.world)!==worldId(p.server)){p.tell('본인에게 발급된 이 세계의 거처 열쇠가 아닙니다.');e.cancel();return;}p.tell('브리온 내 집 입구: -20, 107, -875 · 마을의 공유 문에서 본인 실내로 들어갑니다.');e.cancel();});
 PlayerEvents.tick(function(e){var p=e.player,key=uid(p);if(String(p.level.dimension)!==DIM||!p.isAlive()||!inSlot(owner(p.server,key),Number(p.x),Number(p.y),Number(p.z)))delete rests[key];if(time(p.server)%20!==0)return;var s=state(p);if(eligible(s)&&(!s.cottage_v10.key||s.cottage_v10.key.status==='PENDING'||s.cottage_v10.world_id!==worldId(p.server)))F.ensureCottageEntitlementV10(p);var inside=p.isAlive()&&String(p.level.dimension)===DIM&&F.canInteractCottageBlockV10(p,DIM,Number(p.x),Number(p.y),Number(p.z));if(inside&&F.getPlacedCottageTrophiesV10(p).length){var r=rests[key];if(!r||r.world!==worldId(p.server))r=rests[key]={world:worldId(p.server),since:time(p.server),granted:false};if(!r.granted&&time(p.server)-r.since>=6000){var v=warmth(p);r.granted=!!v.ok;}}else delete rests[key];F.refreshCottageWarmthV10(p);if(inside&&time(p.server)%40===0)F.emitOwnedCottageTrophyParticlesV10(p);});
 PlayerEvents.loggedIn(function(e){e.server.scheduleInTicks(1,function(){F.ensureCottageEntitlementV10(e.player);F.refreshCottageWarmthV10(e.player);});});
 PlayerEvents.loggedOut(function(e){delete rests[uid(e.player)];delete sleepBefore[uid(e.player)];});
 ServerEvents.loaded(function(){building={};rests={};sleepBefore={};snapshotStates={};});
 PlayerEvents.respawned(function(e){delete rests[uid(e.player)];e.server.scheduleInTicks(1,function(){F.refreshCottageWarmthV10(e.player);});});
 var firstE=F.onFirstEGradeV96;F.onFirstEGradeV96=function(p){var result=firstE?firstE(p):fail('e_grade_service_unavailable');if(result&&result.ok)p.server.scheduleInTicks(1,function(){if(!p.isRemoved())F.ensureCottageEntitlementV10(p);});return result;};
 var protectedWorld=F.shouldProtectWorldBlockV96;F.shouldProtectWorldBlockV96=function(level,x,y,z,padding){var dimension=String(level.dimension);return F.shouldProtectCottageBlockV10(level.server,dimension,x,y,z)||!!(F.shouldProtectTrainingBlockV10&&F.shouldProtectTrainingBlockV10(level.server,dimension,x,y,z))||!!(protectedWorld&&protectedWorld(level,x,y,z,padding));};
 F.shouldDenyCottageClaimV10=function(server,dimension,chunkX,chunkZ){return String(dimension)===DIM;};
 if(Platform.isLoaded('ftbchunks')&&!global.fcraftCottageClaimHookV10){
  var Claim=Java.loadClass('dev.ftb.mods.ftbchunks.api.event.ClaimedChunkEvent'),Before=Java.loadClass('dev.ftb.mods.ftbchunks.api.event.ClaimedChunkEvent$Before'),Result=Java.loadClass('dev.architectury.event.CompoundEventResult'),Problem=Java.loadClass('dev.ftb.mods.ftbchunks.api.ClaimResult');
  Claim.BEFORE_CLAIM.register(new Before({before:function(source,chunk){var f=global.FRankDays,pos=chunk.getPos(),dimension=String(pos.dimension().location());return f&&f.shouldDenyCottageClaimV10&&f.shouldDenyCottageClaimV10(source.server,dimension,pos.x(),pos.z())?Result.interruptFalse(Problem.customProblem('개인 거처 전용 차원은 영지로 선점할 수 없습니다.')):Result.pass();}}));global.fcraftCottageClaimHookV10=true;
 }
 F.COTTAGE_RULES_V10={dimension:DIM,source:SOURCE,spacing:128,templateCapture:'original world block states only; block-entity inventories and entities are never copied',warmthTicks:18000,restTicks:6000,healthModifierUUID:HP};
})(global.FRankDays);
