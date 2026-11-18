// Author-built procedural landmarks; no external schematic provenance is claimed.
var FCraftMainlandV96=(function(){
 var DIM='f_rank_days:mainland_wilds', CAMP='f_rank_days:camp_rooms';
 var defs=[
  {id:'arvern_port_keep',name:'아르베른 전초 항구령',x:0,z:0,radius:120,kind:'port',subtitle:'제2장 개척 대륙의 관문 · 안전 보호 구역'},
  {id:'caleon_citadel',name:'칼레온 만년설 성채령',x:0,z:-1200,radius:140,kind:'citadel',subtitle:'아르베른 왕국 북방 수호성 · 성채 보호 구역'},
  {id:'ashen_mage_spire',name:'잿빛 성좌의 고원 마탑령',x:-1100,z:-300,radius:96,kind:'tower',subtitle:'고대 비전 관측탑 · 결계 보호 구역'},
  {id:'goldenvale_outpost',name:'황금들판 대교역 초소령',x:1100,z:250,radius:96,kind:'market',subtitle:'동부 개척 평원 상단 거점 · 안전 보호 구역'},
  {id:'sunken_ancient_keep',name:'가라앉은 고대 아성 심연령',x:0,z:1350,radius:110,kind:'ruin',subtitle:'위험도 ★★★★☆ · 고대 왕국의 몰락한 요새'}
 ];
 function protectedAt(sites,p,padding){if(p.dimension!==DIM)return false;for(var i=0;i<sites.length;i++){var a=sites[i],dx=p.x-a.x,dz=p.z-a.z,r=a.radius+(padding||0);if(dx*dx+dz*dz<=r*r)return true;}return false;}
 function claimedChunkBlocked(sites,dimension,cx,cz){if(dimension==='minecraft:the_nether'||dimension==='minecraft:the_end')return false;if(dimension!==DIM)return true;for(var i=0;i<sites.length;i++){var s=sites[i],nearX=Math.max(cx*16,Math.min(cx*16+15,s.x)),nearZ=Math.max(cz*16,Math.min(cz*16+15,s.z)),dx=nearX-s.x,dz=nearZ-s.z,r=s.radius+32;if(dx*dx+dz*dz<=r*r)return true;}return false;}
 function dryLand(sample,x,z){var trig=typeof JavaMath!=='undefined'?JavaMath:Math;for(var r=0;r<=160;r+=16){var n=r?Math.max(8,Math.ceil(6.283185307179586*r/16)):1;for(var i=0;i<n;i++){var a=i*6.283185307179586/n,cx=Math.round(x+trig.cos(a)*r),cz=Math.round(z+trig.sin(a)*r),p=sample(cx,cz);if(p&&p.dry&&p.slope<=16&&p.y>=63&&p.y<=230)return {x:cx,y:p.y+1,z:cz,offset:r};}}return null;}
 function extendedCoast(sample,x,z){var trig=typeof JavaMath!=='undefined'?JavaMath:Math,attempts=0;for(var r of [224,288,352,416,480,512]){var n=r>=480?16:8;for(var i=0;i<n;i++){attempts++;var a=i*6.283185307179586/n,cx=Math.round(x+trig.cos(a)*r),cz=Math.round(z+trig.sin(a)*r),p=sample(cx,cz);if(p&&p.dry&&p.slope<=16&&p.y>=63&&p.y<=230)return {x:cx,y:p.y+1,z:cz,offset:r,extendedSamples:attempts};}}return null;}
 function plan(site){
  var out=[],x=site.x,y=site.y,z=site.z,r=site.kind==='citadel'?23:site.kind==='tower'?12:18;
  var themedStone=site.kind==='citadel'?'minecraft:deepslate_bricks':site.kind==='market'?'minecraft:acacia_planks':site.kind==='tower'?'minecraft:polished_blackstone_bricks':site.kind==='ruin'?'minecraft:mossy_stone_bricks':'minecraft:stone_bricks';
  function fill(a,b,c,d,e,f,block){var step=Math.max(1,Math.floor(32768/((d-a+1)*(f-c+1))));for(var low=b;low<=e;low+=step)out.push({a:[x+a,y+low,z+c],b:[x+d,y+Math.min(e,low+step-1),z+f],block:block});}
  function tower(tx,tz,h){fill(tx-3,-2,tz-3,tx+3,h,tz+3,themedStone);fill(tx-2,1,tz-2,tx+2,h-1,tz+2,'minecraft:air');fill(tx-4,h,tz-4,tx+4,h,tz+4,themedStone);for(var a=-4;a<=4;a+=2){fill(tx+a,h+1,tz-4,tx+a,h+2,tz-4,'minecraft:stone_brick_wall');fill(tx+a,h+1,tz+4,tx+a,h+2,tz+4,'minecraft:stone_brick_wall');fill(tx-4,h+1,tz+a,tx-4,h+2,tz+a,'minecraft:stone_brick_wall');fill(tx+4,h+1,tz+a,tx+4,h+2,tz+a,'minecraft:stone_brick_wall');}fill(tx-1,h+1,tz-1,tx+1,h+1,tz+1,'minecraft:campfire[lit=true]');}
  // Foundation follows a chosen real dry surface; a bounded shoulder is built
  // below the footprint. Existing mainland wilderness beyond it is untouched.
  fill(-r-1,-32,-r-1,r+1,-1,r+1,'minecraft:cobblestone');fill(-r,0,-r,r,0,r,themedStone);fill(-r,1,-r,r,40,r,'minecraft:air');
  if(site.kind==='tower'){
   tower(0,0,26);fill(-3,1,-4,3,4,-3,'minecraft:air');for(var h=5;h<25;h+=6){fill(-2,h,-2,2,h,2,'minecraft:dark_oak_planks');fill(0,h,0,0,h+1,0,'minecraft:lantern');}fill(0,27,0,0,29,0,'minecraft:amethyst_block');
  }else{
   fill(-r,1,-r,r,5,-r,themedStone);fill(-r,1,r,r,5,r,themedStone);fill(-r,1,-r,-r,5,r,themedStone);fill(r,1,-r,r,5,r,themedStone);
   for(var p=-r;p<=r;p+=3){fill(p,6,-r,p,6,-r,'minecraft:stone_brick_wall');fill(p,6,r,p,6,r,'minecraft:stone_brick_wall');}
   tower(-r+3,-r+3,11);tower(r-3,-r+3,11);tower(-r+3,r-3,10);tower(r-3,r-3,10);
   fill(-3,1,r-1,3,5,r+1,'minecraft:air');fill(-3,0,r,3,0,r+8,themedStone);
   fill(-7,1,-7,7,7,4,site.kind==='ruin'?'minecraft:mossy_stone_bricks':themedStone);fill(-6,1,-6,6,6,3,'minecraft:air');fill(-2,1,3,2,4,4,'minecraft:air');fill(-8,8,-8,8,8,5,'minecraft:dark_oak_planks');
   for(var wx=-5;wx<=5;wx+=5){fill(wx,3,-7,wx,4,-7,'minecraft:iron_bars');}
   fill(-1,1,-5,1,1,-5,'minecraft:bookshelf');fill(5,1,1,5,1,1,'minecraft:crafting_table');fill(-5,1,1,-5,1,1,'minecraft:smoker');
   if(site.kind==='ruin'){fill(-7,5,-7,-3,8,-3,'minecraft:air');fill(2,1,-2,3,2,-1,'minecraft:cracked_stone_bricks');}
   if(site.kind==='market'){fill(-10,1,8,10,1,9,'minecraft:spruce_planks');fill(-10,4,8,10,4,10,'minecraft:yellow_wool');}
   if(site.kind==='port'){fill(-3,0,r+1,3,0,r+22,'minecraft:spruce_planks');for(var q=r+2;q<=r+22;q+=5){fill(-4,-4,q,-4,2,q,'minecraft:stripped_spruce_log');fill(4,-4,q,4,2,q,'minecraft:stripped_spruce_log');}fill(10,1,9,10,6,9,'minecraft:spruce_fence');fill(10,5,10,10,6,12,'minecraft:blue_banner');}
  }
  // Colour, path, lights and a visible return platform make each role readable.
  fill(-1,1,7,1,1,9,'minecraft:polished_andesite');fill(0,2,8,0,2,8,'minecraft:lantern');
  return out;
 }
 function discover(state,id){state.serdin_cache_ids_v96=state.serdin_cache_ids_v96||{};if(state.serdin_cache_ids_v96[id])return false;state.serdin_cache_ids_v96[id]=true;state.serdin_caches_found=Object.keys(state.serdin_cache_ids_v96).length;return true;}
 function displayRegions(rows,config){var names=config&&config.regions||[];for(var i=0;i<rows.length;i++)for(var j=0;j<names.length;j++)if(rows[i].id===names[j].id){if(typeof names[j].name==='string'&&names[j].name.length)rows[i].name=names[j].name;if(typeof names[j].theme==='string'&&names[j].theme.length)rows[i].subtitle=names[j].theme+' · 공식 거점 보호 구역';}return rows;}
 return {DIM:DIM,CAMP:CAMP,definitions:defs,protectedAt:protectedAt,claimedChunkBlocked:claimedChunkBlocked,dryLand:dryLand,extendedCoast:extendedCoast,buildProceduralLandmarkFallback:plan,discover:discover,displayRegions:displayRegions};
})();
if(typeof module!=='undefined')module.exports=FCraftMainlandV96;
if(typeof global!=='undefined'&&global.FRankDays&&typeof ServerEvents!=='undefined')(function(){
 var FM96=global.FRankDays, cfgM96=JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_mainland_v96.json'))),regionNamesV110=JSON.parse(String(JsonIO.readString('kubejs/config/fcraft_mainland_regions_v110.json'))),failedBootstrapM96={};
 function layoutM96(server){var l=FM96.getSerdinV94Layout(server);return l&&l.expansionVersion==='9.6'?l:null;}
 function readM96(server,key,fallback){var s=server.persistentData.getString(key);return s?JSON.parse(String(s)):fallback;}
 function writeM96(server,key,data){server.persistentData.putString(key,JSON.stringify(data));}
 function sitesM96(server){var saved=readM96(server,'f_rank_mainland_landmarks_v96',null),layout=layoutM96(server),rows=saved||(layout&&layout.mainlandLandmarksV96?JSON.parse(JSON.stringify(layout.mainlandLandmarksV96)):[]),defs=FCraftMainlandV96.definitions;for(var i=0;i<rows.length;i++)for(var j=0;j<defs.length;j++)if(rows[i].id===defs[j].id){rows[i].name=defs[j].name;rows[i].subtitle=defs[j].subtitle;}return FCraftMainlandV96.displayRegions(rows,regionNamesV110);}
 function posM96(e){return {dimension:String(e.level.dimension),x:e.block.x,y:e.block.y,z:e.block.z};}
 function adminM96(p){return p.isCreative()||(p.hasPermissions(2)&&p.persistentData.getBoolean('f_rank_admin_build'));}
 function stateM96(p){return FM96.loadPlayerState(p);}
 function rewardPilgrimageM96(p){var s=stateM96(p),v=s.mainland_landmarks_visited_v96||{};if(s.mainland_pilgrimage_rewarded_v96||!v.caleon_citadel||!v.ashen_mage_spire||!v.goldenvale_outpost||!v.sunken_ancient_keep)return {ok:false,reason:'not_eligible'};return FM96.runAtomicPlayerV96(p,function(){var fresh=stateM96(p);if(fresh.mainland_pilgrimage_rewarded_v96)return {ok:true,already:true};if(!FM96.grantPilgrimageSkillPointsV96(p))return {ok:false,reason:'skill_points_not_ready'};var surveyReward=200*(FM96.getSurveySilverMultiplierPhase4?FM96.getSurveySilverMultiplierPhase4(p):1);var reward=FM96.grantPlayerCurrencyV8(p,surveyReward,false);if(!reward.ok)throw new Error('Pilgrimage wallet credit failed');fresh=stateM96(p);FM96.appendWalletHistoryV96(p,fresh,surveyReward,'4방위 대륙 성채 순례','reward');fresh.mainland_pilgrimage_rewarded_v96=true;FM96.savePlayerState(p,fresh);p.tell('4방위 성채 순례 완료 · '+(surveyReward/10)+'실버와 스킬 포인트2점을 받았습니다.');return {ok:true,rewarded:true};});}
 function syncStagesM96(p){var s=stateM96(p),flags={frank_v96_camp_unlocked:!!s.e_rank_camp_unlocked,frank_v96_mainland_permit:!!s.mainland_sailing_unlocked,frank_v96_mainland_arrived:!!s.mainland_first_landing_v96,frank_v96_mainland_first_build:!!s.mainland_first_settlement_v96};var v=s.mainland_landmarks_visited_v96||{};flags.frank_v96_mainland_four_visits=!!(v.caleon_citadel&&v.ashen_mage_spire&&v.goldenvale_outpost&&v.sunken_ancient_keep);for(var n of [5,12,24])flags['frank_v96_caches_'+n]=Number(s.serdin_caches_found||0)>=n;for(var k in flags)if(flags[k]){if(FM96.grantPlayerStageOnce)FM96.grantPlayerStageOnce(p,k);else p.stages.add(k);}}
 function commandM96(server,dim,cmd){return server.runCommandSilent('execute in '+dim+' run '+cmd);}
 function sampleM96(world,x,z){
  world.getChunk(x>>4,z>>4);
  var Type=Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types'),y=Number(world.getHeight(Type.MOTION_BLOCKING_NO_LEAVES,x,z))-1;
  function ground(gx,gz,from){for(var h=from;h>=-64;h--){var id=String(world.getBlock(gx,h,gz).id);if(/(_leaves|_log|_wood)$/.test(id)||/minecraft:(air|cave_air|void_air|grass|tall_grass|fern|large_fern|snow|dandelion|poppy|vine|moss_carpet)$/.test(id))continue;return {y:h,dry:id!=='minecraft:water'&&id!=='minecraft:lava'};}return {y:-64,dry:false};}
  var center=ground(x,z,y);if(!center.dry)return center;y=center.y;
  var min=y,max=y;for(var a=-8;a<=8;a+=8)for(var c=-8;c<=8;c+=8){world.getChunk((x+a)>>4,(z+c)>>4);var h=ground(x+a,z+c,Number(world.getHeight(Type.MOTION_BLOCKING_NO_LEAVES,x+a,z+c))-1).y;min=Math.min(min,h);max=Math.max(max,h);}
  return {dry:true,y:y,slope:max-min};
 }
 function noiseCoastM96(server,world,definition,sites){
  var source=world.getChunkSource(),generator=source.getGenerator(),random;
  if(typeof source.randomState==='function')random=source.randomState();
  else{var methods=source.getClass().getMethods();for(var mi=0;mi<methods.length;mi++)if(methods[mi].getParameterCount()===0&&String(methods[mi].getReturnType().getName())==='net.minecraft.world.level.levelgen.RandomState'){random=methods[mi].invoke(source);break;}}
  if(!random)throw new Error('Actual noise RandomState unavailable; no unbounded chunk search allowed');
  var Type=Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types'),record=readM96(server,'f_rank_mainland_noise_survey_v96',null);
  if(!record||record.id!==definition.id)record={id:definition.id,maxRadius:1024,maxSamples:96,chunkGenerationDuringNoiseSurvey:false,samples:[],actualFootprintAttempts:[]};
  record.actualFootprintAttempts=record.actualFootprintAttempts||[];
  var cache={};for(var a=0;a<record.samples.length;a++)cache[record.samples[a].x+','+record.samples[a].z]=Number(record.samples[a].noiseSurfaceY);
  function height(x,z){var distance=Math.sqrt((x-definition.x)*(x-definition.x)+(z-definition.z)*(z-definition.z));if(distance>1024)return null;var key=x+','+z;if(cache[key]!==undefined)return cache[key];if(record.samples.length>=96)return null;var y=Number(generator.getBaseHeight(x,z,Type.WORLD_SURFACE_WG,world,random))-1;cache[key]=y;record.samples.push({x:x,z:z,noiseSurfaceY:y,distance:distance});return y;}
  var candidates=[[-960,-960],[-960,-900],[-900,-800],[-900,-850],[-850,-800],[-900,-1000],[-840,-850],[-800,-780],[-920,-870],[-880,-880]],ranked=[];
  for(var i=0;i<candidates.length;i++){
   var x=candidates[i][0],z=candidates[i][1],dx=x-definition.x,dz=z-definition.z,distance=Math.sqrt(dx*dx+dz*dz);
   if(distance>1024||z>-750)continue;
   var overlap=false;for(var j=0;j<sites.length;j++){var sx=x-sites[j].x,sz=z-sites[j].z,limit=definition.radius+sites[j].radius+32;if(sx*sx+sz*sz<=limit*limit)overlap=true;}if(overlap)continue;
   var points=[[0,0],[-25,-25],[25,-25],[-25,25],[25,25]],min=999,max=-999,complete=true;
   for(var q=0;q<points.length;q++){var h=height(x+points[q][0],z+points[q][1]);if(h===null){complete=false;break;}min=Math.min(min,h);max=Math.max(max,h);}
   if(complete&&min>=63&&max<=230&&max-min<=32)ranked.push({x:x,z:z,offset:distance,noiseMin:min,noiseMax:max,noiseSlope:max-min});
  }
  ranked.sort(function(a,b){return a.noiseSlope-b.noiseSlope||a.offset-b.offset;});record.rankedDryFootprints=ranked;
  var chosen=ranked.length?ranked[0]:null;
  if(chosen){var actual=sampleM96(world,chosen.x,chosen.z);record.actualSelectedFootprint={x:chosen.x,z:chosen.z,y:actual.y,slope:actual.slope,dry:actual.dry};record.actualFootprintAttempts.push(record.actualSelectedFootprint);if(actual.dry&&actual.slope<=16)chosen.y=actual.y+1;else chosen=null;}
  writeM96(server,'f_rank_mainland_noise_survey_v96',record);return chosen;
 }
 function buildM96(server,site){
  var nativeWorld=server.getLevel(FCraftMainlandV96.DIM);for(var cx=(site.x-29)>>4;cx<=((site.x+29)>>4);cx++)for(var cz=(site.z-29)>>4;cz<=((site.z+41)>>4);cz++)nativeWorld.getChunk(cx,cz);
  var plan=FCraftMainlandV96.buildProceduralLandmarkFallback(site);
  for(var i=0;i<plan.length;i++){var a=plan[i];commandM96(server,FCraftMainlandV96.DIM,'fill '+a.a.join(' ')+' '+a.b.join(' ')+' '+a.block);}
  if(site.kind==='ruin')for(var c=0;c<8;c++){
   var x=site.x-9+(c%4)*6,z=site.z-10+Math.floor(c/4)*8,y=site.y+1;
   commandM96(server,FCraftMainlandV96.DIM,'setblock '+x+' '+y+' '+z+' lootr:lootr_chest[facing=south,type=single,waterlogged=false]{LootTable:"f_rank_days:chests/mainland_ancient_keep",LootTableSeed:0L}');
  }
  site.built=true;site.foundationDepth=32;site.provenance='F-Craft author-built procedural fallback v96; external reference not imported';return site;
 }
 function finishAncientKeepM96(server,site){
  if(site.kind!=='ruin')return false;var changed=false,world=server.getLevel(FCraftMainlandV96.DIM);
  if(!site.supportPilingsV96){var piles=[],bottom=site.y-(site.foundationDepth||6)-1;
   for(var p of [[-19,-19],[19,-19],[-19,19],[19,19]]){var x=site.x+p[0],z=site.z+p[1],y=bottom;world.getChunk(x>>4,z>>4);while(y>-64){var id=String(world.getBlock(x,y,z).id);if(!/minecraft:(air|cave_air|void_air|water|lava|ice|packed_ice|blue_ice|frosted_ice)$/.test(id))break;y--;}if(y<=-64)throw new Error('Sunken keep seabed not verified');if(y<bottom)commandM96(server,FCraftMainlandV96.DIM,'fill '+x+' '+(y+1)+' '+z+' '+x+' '+bottom+' '+z+' minecraft:stone_bricks');piles.push({x:x,z:z,groundY:y,fromY:y+1,toY:bottom});}
   site.supportPilingsV96={revision:1,provenance:'New F-Craft four stone supports to measured natural seabed; not original terrain',piles:piles};changed=true;
  }
  if(!site.guardsInitializedV96){for(var i=0;i<6;i++){var spots=[[-10,10],[10,10],[-10,-10],[10,-10],[-4,-2],[4,-2]],p=spots[i],tag='fcraft_v96_ancient_guard_'+i;commandM96(server,FCraftMainlandV96.DIM,'execute unless entity @e[tag='+tag+',limit=1] run summon minecraft:zombie '+(site.x+p[0]+.5)+' '+(site.y+1)+' '+(site.z+p[1]+.5)+' {Tags:["'+tag+'","fcraft_v96_ancient_guard"],PersistenceRequired:1b,CanPickUpLoot:0b,CustomName:\'{"text":"고대 아성 수호병"}\',Health:32.0f,Attributes:[{Name:"minecraft:generic.max_health",Base:32.0d},{Name:"minecraft:generic.attack_damage",Base:5.0d}],HandItems:[{id:"minecraft:iron_sword",Count:1b},{}],HandDropChances:[0.0f,0.0f],ArmorItems:[{},{},{},{id:"minecraft:iron_helmet",Count:1b,tag:{Unbreakable:1b}}],ArmorDropChances:[0.0f,0.0f,0.0f,0.0f]}');}site.guardsInitializedV96=true;changed=true;}
  return changed;
 }
 function ensureM96(server){
  if(!layoutM96(server))return;
  var world=server.getLevel(FCraftMainlandV96.DIM);if(!world)return;
  var sites=sitesM96(server),defs=FCraftMainlandV96.definitions;
  for(var i=0;i<defs.length;i++){
   var def=defs[i],site=null;for(var j=0;j<sites.length;j++)if(sites[j].id===def.id)site=sites[j];
   if(!site){
    if(failedBootstrapM96[def.id])continue;
    var survey={id:def.id,samples:0,dryCount:0,minSlope:999,minHeight:999,maxHeight:-999};
    var ground=FCraftMainlandV96.dryLand(function(x,z){var sample=sampleM96(world,x,z);survey.samples++;if(sample.dry){survey.dryCount++;survey.minSlope=Math.min(survey.minSlope,sample.slope);}if(sample.y!==undefined){survey.minHeight=Math.min(survey.minHeight,sample.y);survey.maxHeight=Math.max(survey.maxHeight,sample.y);}return sample;},def.x,def.z);
    var surveys=readM96(server,'f_rank_mainland_survey_v96',{});surveys[def.id]=survey;writeM96(server,'f_rank_mainland_survey_v96',surveys);
    var extended=false,extendedSurvey={samples:0,waterSamples:0,minHeight:999,maxHeight:-999};
    if(!ground&&(def.id==='caleon_citadel'||def.id==='goldenvale_outpost')){ground=FCraftMainlandV96.extendedCoast(function(x,z){var sample=sampleM96(world,x,z);extendedSurvey.samples++;if(!sample.dry)extendedSurvey.waterSamples++;extendedSurvey.minHeight=Math.min(extendedSurvey.minHeight,sample.y);extendedSurvey.maxHeight=Math.max(extendedSurvey.maxHeight,sample.y);return sample;},def.x,def.z);extended=!!ground;}
    var noiseExtended=false;if(!ground&&def.id==='caleon_citadel'){ground=noiseCoastM96(server,world,def,sites);noiseExtended=!!ground;}
    if(!ground){failedBootstrapM96[def.id]=true;console.error('[F-Craft v96] No dry site within approved bounded survey: '+def.id);continue;}
    site={id:def.id,name:def.name,x:ground.x,y:ground.y,z:ground.z,radius:def.radius,kind:def.kind,subtitle:def.subtitle,built:false,originalTarget:{x:def.x,z:def.z},actualOffset:{x:ground.x-def.x,z:ground.z-def.z,distance:ground.offset},attempted160survey:survey,attempted512Survey:extendedSurvey,adjustmentReason:noiseExtended?'Approved noise-only analysis to1024 after160 and512 measured water; selected single real northern dry footprint loaded; no artificial island':extended?'Approved sparse coast search to512 after no suitable dry site within160; no artificial island':'Nearest measured dry land within160'};
    sites.push(site);writeM96(server,'f_rank_mainland_landmarks_v96',sites);
   }
   // Persist fixed coordinates before building. On interruption, an unbuilt
   // footprint is completed at the same owned site; a built site is never reset.
   if(!site.built){buildM96(server,site);writeM96(server,'f_rank_mainland_landmarks_v96',sites);}
   if(finishAncientKeepM96(server,site))writeM96(server,'f_rank_mainland_landmarks_v96',sites);
  }
  ensureCaptainsM96(server);
  var v=cfgM96.innVault,b=server.overworld().getBlock(v.x,v.y,v.z);if(String(b.id)==='minecraft:air')b.set('minecraft:ender_chest');
 }
 function npcM96(server,id){
  if(id==='marco')return {id:id,dimension:'minecraft:overworld',x:cfgM96.southPort.x,y:cfgM96.southPort.y,z:cfgM96.southPort.z,label:'마르코 [본토 정기선 선장]'};
  var sites=sitesM96(server);for(var i=0;i<sites.length;i++)if(sites[i].id==='arvern_port_keep'&&sites[i].built)return {id:'marco_mainland',dimension:FCraftMainlandV96.DIM,x:sites[i].x+2.5,y:sites[i].y+1,z:sites[i].z+27.5,label:'마르코 부관 [브리온 귀환 정기선]'};
  return null;
 }
 var captainsPendingM96=false;
 function ensureCaptainsM96(server){
  if(captainsPendingM96)return;captainsPendingM96=true;
  var definitions=[],owned=[],attempts=0,ChunkPos=Java.loadClass('net.minecraft.world.level.ChunkPos');
  for(var i=0;i<2;i++){var n=npcM96(server,i?'marco_mainland':'marco');if(!n)continue;definitions.push(n);if(Number(commandM96(server,n.dimension,'forceload query '+Math.floor(n.x)+' '+Math.floor(n.z)))<=0){commandM96(server,n.dimension,'forceload add '+Math.floor(n.x)+' '+Math.floor(n.z));owned.push(n);}}
  function release(){captainsPendingM96=false;server.scheduleInTicks(120,function(){for(var i=0;i<owned.length;i++)commandM96(server,owned[i].dimension,'forceload remove '+Math.floor(owned[i].x)+' '+Math.floor(owned[i].z));});}
  function advance(){try{
   if(!layoutM96(server)){release();return;}
   for(var i=0;i<definitions.length;i++){var n=definitions[i],world=server.getLevel(n.dimension),cx=Math.floor(n.x/16),cz=Math.floor(n.z/16),packed=typeof ChunkPos.asLong==='function'?ChunkPos.asLong(cx,cz):ChunkPos.m_45589_(cx,cz),source=world.getChunkSource(),entitiesReady=typeof world.areEntitiesLoaded==='function'?world.areEntitiesLoaded(packed):world.m_143319_(packed),blockReady=typeof source.hasChunk==='function'?source.hasChunk(cx,cz):source.m_5563_(cx,cz);if(!entitiesReady||!blockReady){if(++attempts<=120){server.scheduleInTicks(10,advance);return;}throw new Error('Captain entity NBT not ready: '+n.id);}}
   for(var j=0;j<definitions.length;j++){var n=definitions[j],keeper='fcraft_v96_keeper_'+n.id,ownedSelector='@e[type=minecraft:villager,tag=fcraft_v96_captain,tag=npc_'+n.id,base='execute positioned '+n.x+' '+n.y+' '+n.z+' run ';
    // Only this feature's own double-tagged captains are eligible. Entity NBT
    // is fully loaded above; original NPCs and player-authored entities stay.
    commandM96(server,n.dimension,'tag @e[tag='+keeper+'] remove '+keeper);
    commandM96(server,n.dimension,base+'tag '+ownedSelector+',distance=..8,sort=nearest,limit=1] add '+keeper);
    var removed=commandM96(server,n.dimension,base+'kill '+ownedSelector+',distance=..8,tag=!'+keeper+']');if(removed>0)console.info('[F-Craft v96] Removed '+removed+' duplicate owned captain entities: '+n.id);
    commandM96(server,n.dimension,'tag @e[tag='+keeper+'] remove '+keeper);
    commandM96(server,n.dimension,'execute unless entity @e[tag=npc_'+n.id+',limit=1] run summon minecraft:villager '+n.x+' '+n.y+' '+n.z+' {Tags:["npc_'+n.id+'","f_rank_npc","fcraft_v96_captain"],CustomName:\'{"text":"'+n.label+'"}\',CustomNameVisible:1b,Invulnerable:1b,PersistenceRequired:1b,NoAI:1b,VillagerData:{profession:"minecraft:fisherman",type:"minecraft:plains",level:5}}');}
   release();
  }catch(error){console.warn('[F-Craft v96] Captain sync stopped without blind duplicate summon: '+error);release();}}
  server.scheduleInTicks(10,advance);
 }
 function teleportM96(p,target){p.teleportTo(target.dimension,target.x,target.y,target.z,0,0);p.fallDistance=0;p.setMotionX(0);p.setMotionY(0);p.setMotionZ(0);}
 function sailM96(player,npcId){
  var n=npcM96(player.server,npcId);if(!n||String(player.level.dimension)!==n.dimension)return {ok:false,reason:'wrong_dimension'};
  var dx=player.x-n.x,dy=player.y-n.y,dz=player.z-n.z;if(dx*dx+dy*dy+dz*dz>72.25)return {ok:false,reason:'too_far'};
  var state=stateM96(player);if(!state.mainland_sailing_unlocked){player.tell('세르딘의 강철 수호자를 꺾거나 길드에서 본토 도항 허가증을 받아 와야 출항할 수 있네!');return {ok:false,reason:'locked'};}
  ensureM96(player.server);var target=npcM96(player.server,npcId==='marco'?'marco_mainland':'marco');if(!target)return {ok:false,reason:'mainland_not_ready'};
  player.playSound('minecraft:item.goat_horn.sound.0');teleportM96(player,target);
  if(target.dimension===FCraftMainlandV96.DIM){state.mainland_first_landing_v96=true;FM96.savePlayerState(player,state);waypointsM96(player);}syncStagesM96(player);
  return {ok:true,dimension:target.dimension};
 }
 function waypointsM96(p){var sites=sitesM96(p.server);for(var i=0;i<sites.length;i++){var s=sites[i];p.tell(Text.of(s.name+' ['+s.x+', '+s.y+', '+s.z+']').clickSuggestCommand('/waypoint '+s.x+' '+s.y+' '+s.z+' '+s.name).hover('본토 지도에 이 좌표를 등록하세요. 이동 명령이 아닙니다.'));}}
 function campM96(p){
  if(!layoutM96(p.server))return {ok:false,reason:'use_progress_upgraded_world'};
  var state=stateM96(p);if(!state.e_rank_camp_unlocked)return {ok:false,reason:'E_grade_required'};
  var now=FM96.getPersistentWorldTickV96(p.server);if(now<Number(state.camp_cooldown_until_v96||0)&&String(p.level.dimension)!==FCraftMainlandV96.CAMP)return {ok:false,reason:'cooldown'};
  if(String(p.level.dimension)===FCraftMainlandV96.CAMP){if(!state.camp_return_position_v96)return {ok:false,reason:'no_return_saved'};teleportM96(p,state.camp_return_position_v96);return {ok:true,returning:true};}
  var world=p.server.getLevel(FCraftMainlandV96.CAMP);if(!world)return {ok:false,reason:'camp_dimension_unavailable'};
  var rooms=readM96(p.server,'f_rank_camp_rooms_v96',{}),uuid=String(p.uuid),room=rooms[uuid];
  if(!room){var index=Object.keys(rooms).length;room={x:(index%64)*32,y:80,z:Math.floor(index/64)*32,built:false};rooms[uuid]=room;writeM96(p.server,'f_rank_camp_rooms_v96',rooms);}
  if(!room.built){
   var x=room.x,y=room.y,z=room.z;for(var cx=(x-5)>>4;cx<=((x+5)>>4);cx++)for(var cz=(z-5)>>4;cz<=((z+5)>>4);cz++)world.getChunk(cx,cz);commandM96(p.server,FCraftMainlandV96.CAMP,'fill '+[x-5,y-1,z-5,x+5,y+5,z+5].join(' ')+' minecraft:spruce_planks');commandM96(p.server,FCraftMainlandV96.CAMP,'fill '+[x-4,y,z-4,x+4,y+3,z+4].join(' ')+' minecraft:air');
   for(var b of [[0,4,0,'minecraft:sea_lantern'],[-3,0,-3,'minecraft:crafting_table'],[3,0,-3,'minecraft:ender_chest'],[-3,0,3,'minecraft:barrel'],[0,1,4,'minecraft:stone_button[face=wall,facing=north]'],[3,0,3,'minecraft:red_bed[part=foot,facing=north]'],[3,0,2,'minecraft:red_bed[part=head,facing=north]']])commandM96(p.server,FCraftMainlandV96.CAMP,'setblock '+(x+b[0])+' '+(y+b[1])+' '+(z+b[2])+' '+b[3]);
   room.built=true;rooms[uuid]=room;writeM96(p.server,'f_rank_camp_rooms_v96',rooms);
  }
  state.camp_return_position_v96={dimension:String(p.level.dimension),x:p.x,y:p.y,z:p.z};state.camp_cooldown_until_v96=now+1200;FM96.savePlayerState(p,state);teleportM96(p,{dimension:FCraftMainlandV96.CAMP,x:room.x+.5,y:room.y,z:room.z+.5});return {ok:true};
 }
 function privateCampM96(p,pos){if(pos.dimension!==FCraftMainlandV96.CAMP)return false;var room=readM96(p.server,'f_rank_camp_rooms_v96',{})[String(p.uuid)];return !room||Math.abs(pos.x-room.x)>4||Math.abs(pos.z-room.z)>4||pos.y<room.y||pos.y>room.y+3;}
 BlockEvents.broken(function(e){if(!e.player||!layoutM96(e.server))return;var pos=posM96(e);if(!adminM96(e.player)&&(FCraftMainlandV96.protectedAt(sitesM96(e.server),pos,0)||privateCampM96(e.player,pos))){e.cancel();}});
 BlockEvents.placed(function(e){if(!e.player||!layoutM96(e.server))return;var pos=posM96(e);if(!adminM96(e.player)&&(FCraftMainlandV96.protectedAt(sitesM96(e.server),pos,0)||privateCampM96(e.player,pos))){e.cancel();return;}if(pos.dimension===FCraftMainlandV96.DIM&&(String(e.block.id)==='minecraft:crafting_table'||String(e.block.id)==='minecraft:chest')){var s=stateM96(e.player);if(!s.mainland_first_settlement_v96){s.mainland_first_settlement_v96=true;FM96.savePlayerState(e.player,s);}}});
 BlockEvents.rightClicked(function(e){
  if(!e.player||!layoutM96(e.server))return;var pos=posM96(e),id=String(e.block.id),vault=cfgM96.innVault;
  if(pos.dimension===FCraftMainlandV96.CAMP){var room=readM96(e.server,'f_rank_camp_rooms_v96',{})[String(e.player.uuid)];if(privateCampM96(e.player,pos)){e.cancel();return;}if(room&&pos.x===room.x&&pos.z===room.z+4){campM96(e.player);e.cancel();return;}}
  if(pos.dimension==='minecraft:overworld'&&pos.x===vault.x&&pos.y===vault.y&&pos.z===vault.z&&!stateM96(e.player).e_rank_camp_unlocked&&!adminM96(e.player)){e.player.tell('E급 정식 모험가부터 여관 개인 금고를 배정받을 수 있습니다.');e.cancel();return;}
  if(pos.dimension!=='minecraft:overworld'||id!=='lootr:lootr_chest')return;
  if(FM96.isSerdinTreasureV97World&&FM96.isSerdinTreasureV97World(e.server))return;
  for(var i=0;i<cfgM96.caches.length;i++){var c=cfgM96.caches[i];if(c.x!==pos.x||c.y!==pos.y||c.z!==pos.z)continue;var s=stateM96(e.player);if(FCraftMainlandV96.discover(s,c.id)){FM96.savePlayerState(e.player,s);if(FM96.onTraitDiscoveryV96)FM96.onTraitDiscoveryV96(e.player,c.id);syncStagesM96(e.player);e.player.tell('세르딘 은닉처 발견 '+s.serdin_caches_found+'/24');}break;}
 });
 ItemEvents.rightClicked('f_rank_days:camp_return_scroll',function(e){var result=campM96(e.player);if(!result.ok)e.player.tell('야영지 이동: '+result.reason);e.cancel();});
 function recoverCampM96(p){var pending=readM96(p.server,'f_rank_camp_death_returns_v96',{}),key=String(p.uuid),target=pending[key];if(!target)return false;teleportM96(p,target);delete pending[key];writeM96(p.server,'f_rank_camp_death_returns_v96',pending);return true;}
 EntityEvents.death(function(e){var p=e.entity;if(!layoutM96(e.server)||!p.isPlayer()||String(p.level.dimension)!==FCraftMainlandV96.CAMP)return;var target=stateM96(p).camp_return_position_v96;if(target){var pending=readM96(e.server,'f_rank_camp_death_returns_v96',{});pending[String(p.uuid)]=target;writeM96(e.server,'f_rank_camp_death_returns_v96',pending);}});
 PlayerEvents.respawned(function(e){var p=e.player;if(layoutM96(p.server))p.server.scheduleInTicks(1,function(){recoverCampM96(p);});});
 PlayerEvents.loggedIn(function(e){var p=e.player;if(layoutM96(p.server))recoverCampM96(p);syncStagesM96(p);});
 PlayerEvents.tick(function(e){var p=e.player;if(Number(p.age)%20!==0)return;syncStagesM96(p);if(String(p.level.dimension)!==FCraftMainlandV96.DIM)return;var sites=sitesM96(p.server),state=stateM96(p),changed=false;state.mainland_landmarks_visited_v96=state.mainland_landmarks_visited_v96||{};for(var i=0;i<sites.length;i++){var s=sites[i],dx=p.x-s.x,dz=p.z-s.z;if(s.built&&dx*dx+dz*dz<s.radius*s.radius&&!state.mainland_landmarks_visited_v96[s.id]){state.mainland_landmarks_visited_v96[s.id]=true;changed=true;p.server.runCommandSilent('title '+p.username+' times 10 60 10');p.server.runCommandSilent('title '+p.username+' subtitle '+JSON.stringify({text:s.subtitle}));p.server.runCommandSilent('title '+p.username+' title '+JSON.stringify({text:'〈 '+s.name+' 〉',color:'gold'}));}}if(changed)FM96.savePlayerState(p,state);rewardPilgrimageM96(p);});
 ServerEvents.loaded(function(e){ensureM96(e.server);});
 ServerEvents.commandRegistry(function(e){var C=e.commands,A=e.arguments;e.register(C.literal('frank').then(C.literal('landmark').requires(function(s){return s.hasPermission(2);}).then(C.literal('paste').then(C.argument('id',A.STRING.create(e)).executes(function(c){var id=A.STRING.getResult(c,'id'),sites=sitesM96(c.source.server),manifest=JsonIO.read('kubejs/config/fcraft_landmark_dropin_v96.json')||{},site=null;for(var i=0;i<sites.length;i++)if(sites[i].id===id)site=sites[i];if(!site||!manifest[id]){c.source.sendFailure(Text.of('검사·변환된 drop-in이 없습니다. 관리 도구로 먼저 승인하세요.'));return 0;}return commandM96(c.source.server,FCraftMainlandV96.DIM,'place template f_rank_days:landmark_override/'+id+' '+(site.x+manifest[id].offset[0])+' '+site.y+' '+(site.z+manifest[id].offset[2]));})))));});
 if(Platform.isLoaded('ftbchunks')){
  var Claim96=Java.loadClass('dev.ftb.mods.ftbchunks.api.event.ClaimedChunkEvent'),BeforeClaim96=Java.loadClass('dev.ftb.mods.ftbchunks.api.event.ClaimedChunkEvent$Before'),Result96=Java.loadClass('dev.architectury.event.CompoundEventResult'),ClaimResult96=Java.loadClass('dev.ftb.mods.ftbchunks.api.ClaimResult');
  if(!global.fcraftClaimHookV96){Claim96.BEFORE_CLAIM.register(new BeforeClaim96({before:function(source,chunk){if(!layoutM96(source.server))return Result96.pass();var p=chunk.getPos(),dim=String(p.dimension().location());return FCraftMainlandV96.claimedChunkBlocked(sitesM96(source.server),dim,p.x(),p.z())?Result96.interruptFalse(ClaimResult96.customProblem('공식 성채와32블록 완충 구역은 영지로 선점할 수 없습니다.')):Result96.pass();}}));global.fcraftClaimHookV96=true;}
 }
 FM96.getMainlandSailingNpcV96=npcM96;FM96.handleMainlandSailingV96=sailM96;FM96.useCampReturnScrollV96=campM96;FM96.ensureMainlandLandmarksV96=ensureM96;FM96.getMainlandLandmarksV96=sitesM96;FM96.syncMainlandStagesV96=syncStagesM96;FM96.grantMainlandPilgrimageRewardV96=rewardPilgrimageM96;
 FM96.shouldProtectWorldBlockV96=function(level,x,y,z,padding){var dim=String(level.dimension),server=level.server,p={dimension:dim,x:x,y:y,z:z},pad=padding||0;if(!layoutM96(server))return false;if(dim===FCraftMainlandV96.CAMP)return true;if(FCraftMainlandV96.protectedAt(sitesM96(server),p,pad))return true;var c=FM96.ISLAND_CONFIG_V96;if(dim!=='minecraft:overworld'||!c)return false;var b=c.protection;return x>=b.minX-pad&&x<=b.maxX+pad&&z>=b.minZ-pad&&z<=b.maxZ+pad;};
})();
