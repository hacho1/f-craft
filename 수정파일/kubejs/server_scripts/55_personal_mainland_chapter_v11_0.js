// Personal world-scoped records drive the fifth tab; shared FTB progress is display only.
(function(F){
 var MAIN='f_rank_days:mainland_wilds',QUEST='5A110000000000',TASK='5A111000000000';
 var REGIONS=[
  {station:'mainland_port',legacy:'arvern_port_keep'},
  {station:'mainland_north',legacy:'caleon_citadel'},
  {station:'mainland_east',legacy:'goldenvale_outpost'},
  {station:'mainland_west',legacy:'ashen_mage_spire'},
  {station:'mainland_south',legacy:'sunken_ancient_keep'}
 ];
 var BOSSES=['mowziesmobs:frostmaw','mowziesmobs:umvuthi','bosses_of_mass_destruction:lich','mowziesmobs:sculptor','bosses_of_mass_destruction:gauntlet','bosses_of_mass_destruction:obsidilith'];
 function code(prefix,n){return prefix+('0'+Number(n).toString(16).toUpperCase()).slice(-2);}
 function unlocked(s){return s.mainland_sailing_unlocked===true;}
 function flags(p){
  var s=F.loadPlayerState(p),out=[unlocked(s)],v=s.mainland_landmarks_visited_v96||{},q=s.mainland_chapter_v110||{},seen=q.visited||{},b=s.v96_boss_clears||{};
  for(var i=0;i<REGIONS.length;i++)out.push(out[0]&&!!(v[REGIONS[i].legacy]||seen[REGIONS[i].station]||(i===0&&s.mainland_first_landing_v96)));
  for(var j=0;j<BOSSES.length;j++)out.push(out[0]&&Number(b[BOSSES[j]]||0)>0&&(j!==5||Number(b['minecraft:ender_dragon']||0)>0));
  return out;
 }
 F.getPersonalMainlandChapterV110=function(p){
  var fs=flags(p),out={visible:fs[0],completedQuestIds:[],readyTaskIds:[],flags:fs};
  for(var i=0;i<fs.length;i++)if(fs[i]){out.completedQuestIds.push(code(QUEST,i+1));out.readyTaskIds.push(code(TASK,i+1));}
  return out;
 };
 var oldProjection=F.getPersonalPromotionProjectionV106;
 F.getPersonalPromotionProjectionV106=function(p){
  var out=oldProjection(p),extra=F.getPersonalMainlandChapterV110(p);
  out.mainland=extra.visible;out.completedQuestIds=out.completedQuestIds.concat(extra.completedQuestIds);out.readyTaskIds=out.readyTaskIds.concat(extra.readyTaskIds);return out;
 };
 // Reuse the existing authoritative eight-way compass and command; no second actionbar loop.
 var oldTarget=F.getQuestNpcTargetV106;
 F.getQuestNpcTargetV106=function(p,n){
  n=String(n||'');var region=null;
  for(var i=0;i<REGIONS.length;i++)if(REGIONS[i].station===n)region=REGIONS[i];
  if(!region)return oldTarget(p,n);
  if(!unlocked(F.loadPlayerState(p)))return null;
  if(String(p.level.dimension)!==MAIN){
   if(String(p.level.dimension)!=='minecraft:overworld')return null;
   var c=F.getExpectedNpcCoords(p.server,'marco');if(!c)return null;
   return{npcId:'marco',name:'남항 선장 마르코',building:'본토 정기선 · 도착 후 지역 길 안내를 다시 선택하세요',dimension:'minecraft:overworld',x:Number(c[0]),y:Number(c[1]),z:Number(c[2])};
  }
  var t=F.getOfficialWaystoneV110&&F.getOfficialWaystoneV110(p.server,n);
  if(!t||!t.built)return null;
  return{npcId:n,name:t.name,building:'본토 공용 Waystone',dimension:t.dimension,x:Number(t.x),y:Number(t.y),z:Number(t.z)};
 };
 var LAST={};
 F.syncPersonalMainlandChapterV110=function(p){
  var s=F.loadPlayerState(p),dirty=false;
  if(unlocked(s)&&String(p.level.dimension)===MAIN&&F.getOfficialWaystoneV110){
   for(var i=0;i<REGIONS.length;i++){
    var t=F.getOfficialWaystoneV110(p.server,REGIONS[i].station);
    if(!t||!t.built||String(t.dimension)!==String(p.level.dimension))continue;
    var dx=Number(p.x)-Number(t.x),dy=Number(p.y)-Number(t.y),dz=Number(p.z)-Number(t.z);
    if(dx*dx+dy*dy+dz*dz>64)continue;
    s.mainland_chapter_v110=s.mainland_chapter_v110||{version:110,visited:{}};
    s.mainland_chapter_v110.visited=s.mainland_chapter_v110.visited||{};
    if(!s.mainland_chapter_v110.visited[t.id]){s.mainland_chapter_v110.visited[t.id]=true;dirty=true;}
   }
  }
  if(dirty)F.savePlayerState(p,s);
  var projection=F.getPersonalMainlandChapterV110(p),json=JSON.stringify(projection),id=String(p.uuid);
  if(LAST[id]===json)return projection;
  for(var j=0;j<projection.readyTaskIds.length;j++)F.completePromotionTaskHexV106(p,projection.readyTaskIds[j]);
  LAST[id]=json;if(F.sendPromotionFilterV106)F.sendPromotionFilterV106(p,true);return projection;
 };
 PlayerEvents.loggedIn(function(e){e.server.scheduleInTicks(2,function(){if(e.player&&e.player.isAlive())F.syncPersonalMainlandChapterV110(e.player);});});
 PlayerEvents.loggedOut(function(e){delete LAST[String(e.player.uuid)];});
 PlayerEvents.tick(function(e){if(Number(e.player.age||0)%20===0)F.syncPersonalMainlandChapterV110(e.player);});
})(global.FRankDays);
