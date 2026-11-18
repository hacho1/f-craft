// F-Craft phase4 extends the original mana_v98 engine and saved cooldown keys.
global.FRankDays=global.FRankDays||{};
(function(F){
 var GLOBAL_COOLDOWN=8,nativeAABB=null,nativeClipContext=null,nativeClipBlock=null,nativeClipFluid=null;
 var runtime={},projectiles={},controls={},inputBudget={},syncBudget={},lastSync={},serverIdentity=null,sequence=0;
 var rows={
 swordsman:[['연속 베기 (섬광 3연참)','combo',.65,3.5,25,120],['일섬 검기파','pierce',2.20,9,40,240,0,2]],
 berserker:[['대지 분쇄 찍기','armor_break',1.70,4,30,140],['회전 도끼 폭풍','whirlwind',.75,3.8,45,280]],
 ranger:[['백스텝 연사','backshot',.85,16,25,120],['관통 화살비','rain',.40,16,40,260,4.5]],
 healer:[['치유의 물결','heal',1,8,30,160,0,0,6],['수호의 성역','sanctuary',0,6,50,360,0,0,1.5]],
 farmer:[['만월 수확 베기','harvest',1.55,4.2,25,120],['가시 덩굴 올가미','root',.25,12,35,260,4]],
 herbalist:[['맹독 포자 안개','poison',0,8,25,140,4],['전장의 영약 분사','tonic',0,8,40,320]],
 angler:[['심해의 작살 끌기','grapple',1.40,12,20,120],['해일 후려치기','wave',1.80,8,35,240,0,4]],
 chef:[['플람베 강타','stun',1.60,3.6,25,140],['야전 만찬 투척','feast',0,7,40,320]],
 blacksmith:[['용암 모루 찍기','anvil',1.75,6,30,160,0,2],['적열 담금질','temper',0,8,45,360]],
 relic_researcher:[['고대 중력 각인','gravity',0,12,30,180,4.5],['고대 마력포','ray',2.40,14,40,260,0,1]],
 prospector:[['마력석 지진파','quake',1.65,5,25,120],['경화광 외피','shell',0,0,35,300]],
 pathfinder:[['그림자 밟기 (순보 기습)','ambush',2,9,25,120],['연막 섬광탄','smoke',0,6,35,280]]
 };
 var descriptions={
 combo:'안전한 전방 대시 후 3틱 간격 65% 검격 3회.',pierce:'직선 관통 220%. 패링 성공 1.5초 안에는 1.5배.',armor_break:'170% 광역 강타·띄우기·6초 물리 피해 취약 18%.',whirlwind:'2.5초 동안 10틱마다 75% 5회전·저항 I·넉백 면역.',backshot:'안전한 후퇴 최대 6m·낙하 보호·85% 화살 3발.',rain:'조준 지점에 3초간 0.5초마다 화살 소나기·발광.',heal:'아군 6HP 회복·해로운 효과 1개 정화·언데드 신성 피해.',sanctuary:'6초간 고정 성역. 아군 피해 -30%·초당 1.5HP 회복.',harvest:'전방 180도 155% 베기. 대상당 1.5HP, 최대 6HP 흡수.',root:'조준 지점에 3.5초 이동 속박과 초당 가시 피해.',poison:'5초 포자 구름. 맹독 II·공격력 -15%.',tonic:'8초 아군 공속 +25%·이속 +20%·마나 재생 가속.',grapple:'140% 작살. 일반 적은 당기고 무거운 보스에게는 직접 접근.',wave:'전방 파도로 밀어내고 6초 젖음·냉기/전격 취약.',stun:'160% 물리·화염. 일반 적 2초 기절, 보스 0.8초 경직.',feast:'아군 흡수 6HP·10초 공격력 +15%·허기 4칸.',anvil:'전방 175% 모루 충격파·5초 화상·넉백.',temper:'10초 아군 평타·스킬 화염 추가 피해 +25%·무기 내구 보호.',gravity:'6초 고정 결계. 적 둔화·받는 모든 피해 +20%.',ray:'전방 240% 방어 무시 비전 광선. 블록·NPC 보호.',quake:'전방 수정 가시 165%·방어구 50% 관통. 지형 손상 없음.',shell:'6초 피해 -45%·근접 적에게 가시 반사.',ambush:'안전한 표적 배후로 이동하여 200% 확정 기습.',smoke:'일반 적 어그로 해제·3초 실명/둔화. 아군 4초 신속 II.'};
 var skills={};for(var job in rows){skills[job]=[];for(var ri=0;ri<2;ri++){var x=rows[job][ri];skills[job].push({slot:ri===0?'X':'C',id:job+'.'+(ri===0?'X':'C'),label:x[0],kind:x[1],coefficient:x[2],range:x[3],mana:x[4],cooldown:x[5],radius:x[6]||0,width:x[7]||0,heal:x[8]||0,description:descriptions[x[1]],penetration:x[1]==='quake'? .50:0,unlock_grade:ri===0?'E':'C'});}}
 function copy(x){return JSON.parse(JSON.stringify(x));}
 function finite(n){return typeof n==='number'&&isFinite(n);}
 function alive(p){return !!p&&p.isAlive()&&!p.isRemoved();}
 function isPlayer(p){return !!p&&typeof p.isPlayer==='function'&&p.isPlayer();}
 function clock(p){return Number(p.server.overworld().getTime());}
 function uid(p){return String(p.uuid);}
 function canonical(j){return F.JOB_ALIASES_V96&&F.JOB_ALIASES_V96[j]||j;}
 function fail(reason,message){return{ok:false,reason:reason,message:message||reason};}
 function owns(s,j){return !!(s.job_licenses&&s.job_licenses[j]&&s.job_licenses[j].grade!=='UNREGISTERED');}
 function grade(s,j){var r=s.job_licenses&&s.job_licenses[j];return r?Math.max(0,F.GRADE_ORDER.indexOf(r.grade)-1):0;}
 function maximum(s){var best=0;for(var j in skills)if(owns(s,j))best=Math.max(best,grade(s,j));var bonus=typeof F.getCompendiumBonusManaV99==='function'?F.getCompendiumBonusManaV99(s):0;return 100+5*Math.min(6,best)+bonus;}
 function rt(p){if(serverIdentity!==p.server&&!(serverIdentity&&serverIdentity.equals&&serverIdentity.equals(p.server))){serverIdentity=p.server;runtime={};projectiles={};controls={};lastSync={};inputBudget={};syncBudget={};}var k=uid(p);return runtime[k]||(runtime[k]={buffs:{}});}
 function passive(p,j){return F.getPassiveProfilePhase4?F.getPassiveProfilePhase4(p,j)||{}:{};}
 function mult(o,key){var n=Number(o[key]);return isFinite(n)?Math.max(0,n):1;}
 function eventCopy(ev){var x={};for(var k in ev)x[k]=ev[k];return x;}
 function notify(p,ev){ev.actorUuid=uid(p);if(F.recordPracticalActionPhase4&&(['kill','skill_kill'].indexOf(ev.type)<0||ev.targetCategory==='monster')){var evidence=eventCopy(ev);evidence.actionId=String(ev.actionId)+':'+ev.type;if(ev.type!=='heal')evidence.amount=1;F.recordPracticalActionPhase4(p,evidence);}if(F.onCombatActionPhase4)F.onCombatActionPhase4(p,ev);}
 function token(p,prefix){return uid(p)+':'+clock(p)+':'+String(++sequence)+':'+prefix;}
 function itemId(item){return item&&!item.empty?String(item.id):'';}
 function candidates(id){
  if(F.getGuardianWeaponJobV102){var guardianJob=F.getGuardianWeaponJobV102(id);if(guardianJob)return[guardianJob];}
  if(/ancient_rune_staff|apprentice_mana_wand|:brush$|ancient.*book/.test(id))return['relic_researcher'];
  if(/:skillet$|farmersdelight:.*_knife$/.test(id))return['chef'];
  if(/scythe|_hoe$/.test(id))return['farmer'];if(/:shears$/.test(id))return['herbalist'];
  if(/fishing_rod|trident/.test(id))return['angler'];if(/_pickaxe$/.test(id))return['prospector','blacksmith'];if(/_shovel$/.test(id))return['relic_researcher','prospector'];
  if(/dagger/.test(id))return['pathfinder','herbalist'];if(/warhammer|hammer/.test(id))return['blacksmith'];
  if(/mace/.test(id))return['healer','blacksmith'];if(/bow/.test(id))return['ranger'];
  if(/_axe$|battleaxe|greataxe/.test(id))return['berserker'];if(/sword|claymore|rapier|katana/.test(id))return['swordsman'];
  if(/herb_bandage|staff|potion/.test(id))return['healer'];if(/compass/.test(id))return['pathfinder'];if(/glass_bottle|clear_tea/.test(id))return['herbalist'];return[];
 }
 function activeJob(s,requested,p,item){var wanted=canonical(String(requested||s.mana_v98&&s.mana_v98.active_job||s.guild_card&&s.guild_card.initial_job_id||'')),matches=candidates(itemId(item||p&&p.mainHandItem)),valid=[];for(var i=0;i<matches.length;i++)if(owns(s,matches[i]))valid.push(matches[i]);if(valid.length)return valid.indexOf(wanted)>=0?wanted:valid[0];if(skills[wanted]&&owns(s,wanted))return wanted;for(var j in skills)if(owns(s,j))return j;return'';}
 F.resolveCombatJobPhase4=function(p,s,item){return activeJob(s||F.loadPlayerState(p),null,p,item);};
 function ensure(s,t){
  if(!s.mana_v98||typeof s.mana_v98!=='object')s.mana_v98={version:4,mp:maximum(s),last_regen:t,cooldowns:{},global_until:0,active_job:'',combat_until:0,tea_until:0};
  var m=s.mana_v98,max=maximum(s);if(!finite(m.mp))m.mp=max;m.mp=Math.max(0,Math.min(max,m.mp));
  if(!finite(m.last_regen)||m.last_regen>t)m.last_regen=t;if(!m.cooldowns||typeof m.cooldowns!=='object'||Array.isArray(m.cooldowns))m.cooldowns={};
  if(!finite(m.global_until)||m.global_until>t+40)m.global_until=0;for(var k in m.cooldowns)if(!finite(m.cooldowns[k])||m.cooldowns[k]>t+2400)delete m.cooldowns[k];
  var points=[m.last_regen,t],combat=Number(m.combat_until||0),tea=Number(m.tea_until||0),tonic=Number(m.tonic_until||0),warmth=Number(s.cottage_v10&&s.cottage_v10.warmth_until_tick||0),warmFrom=Number(s.cottage_v10&&s.cottage_v10.warmth_from_tick||0);
  for(var a=0;a<5;a++){var x=[combat,tea,tonic,warmth,warmFrom][a];if(x>m.last_regen&&x<t)points.push(x);}points.sort(function(a,b){return a-b;});
  for(var b=1;b<points.length;b++){var mid=(points[b]+points[b-1])/2,rate=mid<combat?2:4;if(mid<tea)rate*=2;if(mid<tonic)rate*=1.5;if(mid>=warmFrom&&F.getCottageManaRegenV10)rate+=Number(F.getCottageManaRegenV10(s,mid)||0);m.mp=Math.min(max,m.mp+(points[b]-points[b-1])*rate/20);}
  m.last_regen=t;m.version=4;return m;
 }
 function traitId(s){return String(s.special_ability&&s.special_ability.ability_id||'');}
 function profile(trait,d,pass){var leak=trait==='leaky_mana';return{damage:Number(d.damage||0)*(leak?1.25:1),heal:Number(d.heal||0)*(leak?1.25:1),mana:Number(d.mana||0)*(leak?1.25:1)*mult(pass||{},'manaCostMultiplier'),cooldown:Math.max(1,Math.floor(Number(d.cooldown||1)*(leak? .8:1))),exhaustion:leak?2:0};}
 function gradeBonus(s,j){return[1.5,2.5,3.5,4.5,5.5,7,8.5][Math.min(6,grade(s,j))];}
 function symbolic(s,j,id){if(candidates(id).indexOf(j)<0)return 0;if(['farmer','herbalist','chef','prospector'].indexOf(j)>=0)return gradeBonus(s,j);if(j==='angler')return gradeBonus(s,j)*(id.indexOf('trident')>=0? .8:1);if(j==='blacksmith')return gradeBonus(s,j)*.9;if(j==='pathfinder')return gradeBonus(s,j)*.8;return 0;}
 function attackPower(p,s,j){if(!p)return 1;var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),a=p.getAttribute(A.ATTACK_DAMAGE);return Math.max(1,a?Number(a.getValue()):1)+symbolic(s,j,itemId(p.mainHandItem));}
 function definition(p,s,j,i){var d=copy(skills[j][i]),rank=grade(s,j),evolved=rank>=(i===0?4:5);d.unlocked=rank>=(i===0?1:3);d.evolution=evolved?1.35:1;if(evolved&&i===1){d.range*=1.35;d.radius*=1.35;d.width*=1.35;}d.damage=d.coefficient*attackPower(p,s,j)*d.evolution;d.heal*=d.evolution;d.profile=profile(traitId(s),d,p?passive(p,j):{});if(p){var perks=equipmentPerks(p.mainHandItem);d.profile.cooldown=Math.max(1,Math.floor(d.profile.cooldown*Number(perks.skill_cooldown_multiplier||1)));}if(F.modifyGuardianSkillDefinitionV102)F.modifyGuardianSkillDefinitionV102(p,j,d);d.cost=d.profile.mana;d.cooldown_ticks=d.profile.cooldown;d.icon='f_rank_days:textures/gui/skills/skill_'+j+'_'+(i+1)+'.png';return d;}
 function send(p,c,d){if(p.sendData)p.sendData('f_rank_days:'+c,d);}
 F.MANA_RULES_V98={max:130,baseMax:100,regenPerSecond:4,combatRegenPerSecond:2,globalCooldownTicks:GLOBAL_COOLDOWN};F.JOB_MANA_SKILLS_V98=skills;F.manaSkillProfileV98=profile;
 F.getManaSkillCatalogV98=function(x){var p=x&&x.job_licenses?null:x,s=p?F.loadPlayerState(p):x,j=activeJob(s,null,p);return j?[definition(p,s,j,0),definition(p,s,j,1)]:[];};
 F.getManaStateV98=function(p){var s=F.loadPlayerState(p),t=clock(p),m=ensure(s,t),j=activeJob(s,null,p),cd={},defs=j?[definition(p,s,j,0),definition(p,s,j,1)]:[];for(var k in m.cooldowns)if(m.cooldowns[k]>t)cd[k]=m.cooldowns[k]-t;F.savePlayerState(p,s);return{mp:m.mp,max_mp:maximum(s),regen_per_second:t<Number(m.combat_until||0)?2:4,job_id:j,active_grade:j?s.job_licenses[j].grade:'UNREGISTERED',skills_json:JSON.stringify(defs),cooldowns_json:JSON.stringify(cd),tick:t,version:4};};
 F.syncManaV98=function(p,force){var data=F.getManaStateV98(p),defs=JSON.parse(data.skills_json),cd=JSON.parse(data.cooldowns_json),now=Date.now(),j=data.job_id,hud={mp:data.mp,maxMp:data.max_mp,activeJob:j,activeGrade:data.active_grade,cd1EndMs:now+Number(cd[j+'.X']||0)*50,cd2EndMs:now+Number(cd[j+'.C']||0)*50,cost1:defs[0]?defs[0].cost:0,cost2:defs[1]?defs[1].cost:0,unlocked1:!!(defs[0]&&defs[0].unlocked),unlocked2:!!(defs[1]&&defs[1].unlocked),serverNowMs:now,skill1:defs[0]?defs[0].label:'',skill2:defs[1]?defs[1].label:'',icon1:defs[0]?defs[0].icon:'',icon2:defs[1]?defs[1].icon:''};
  var signature=JSON.stringify([Math.round(data.mp*10),data.max_mp,j,data.active_grade,hud.cost1,hud.cost2,hud.unlocked1,hud.unlocked2,Math.ceil(Number(cd[j+'.X']||0)/2),Math.ceil(Number(cd[j+'.C']||0)/2)]),key=uid(p);if(force||lastSync[key]!==signature){lastSync[key]=signature;send(p,'sync_mana_hud',hud);send(p,'sync_mana_state',data);}return data;};
 F.restoreManaV98=function(p,amount,reason){amount=Number(amount);if(!isFinite(amount)||amount<=0||amount>130)return fail('invalid_mana_amount');var s=F.loadPlayerState(p),m=ensure(s,clock(p)),before=m.mp;m.mp=Math.min(maximum(s),m.mp+amount);F.savePlayerState(p,s);F.syncManaV98(p);return{ok:true,restored:m.mp-before,reason:String(reason||'restore')};};
 function combat(p){if(!isPlayer(p))return;var s=F.loadPlayerState(p),m=ensure(s,clock(p));m.combat_until=clock(p)+120;F.savePlayerState(p,s);}
  function distance(a,b) { var x=Number(a.x)-Number(b.x),y=Number(a.y)-Number(b.y),z=Number(a.z)-Number(b.z);return Math.sqrt(x*x+y*y+z*z); }
  function npc(e) { return F.isNpcProtectedFromMagicV96 ? F.isNpcProtectedFromMagicV96(e) : true; }
  function safe(p) { return !!(F.isMagicSafePositionV96 && F.isMagicSafePositionV96(p)); }
  function training(p,e){return !!(F.isPlayerTrainingAreaV10&&F.isPlayerTrainingAreaV10(p)&&F.isManagedTrainingTargetV10&&F.isManagedTrainingTargetV10(e));}
  function permitted(p,e){return !safe(p)||training(p,e);}
  function equipmentPerks(stack){return F.getChapter1EnhancementPerksV10?F.getChapter1EnhancementPerksV10(stack):{};}
  function currentRangedBonus(stack){if(!F.getWeaponEnhanceLevel||!F.computeEnhancementBonusStatsV8)return Number(stack&&stack.nbt&&stack.nbt.f_rank_enhance&&stack.nbt.f_rank_enhance.ranged_bonus_damage||0);return Number(F.computeEnhancementBonusStatsV8(F.getWeaponEnhanceLevel(stack)).bonus_damage||0);}
  function selectLaunch(q,draw,use,t){var type=String(q.type),options=[],x;for(var i=0;i<2;i++){x=i?use:draw;if(!x||t<x.tick||t-x.tick>(i?10:2))continue;var id=String(x.weaponId);if(type==='minecraft:fishing_bobber'&&!/fishing_rod$/.test(id)||type==='minecraft:trident'&&!/trident$/.test(id)||type!=='minecraft:trident'&&type!=='minecraft:fishing_bobber'&&!/bow/.test(id))continue;options.push(x);}options.sort(function(a,b){return Number(b.order||0)-Number(a.order||0);});return options.length?options[0]:null;}
  function captureEquipment(p,stack,hand,actionId){return F.captureHeirloomSourceV10?F.captureHeirloomSourceV10(p,stack,hand,actionId):null;}
  function rememberWear(p,c,stack){var r=rt(p);r.wearActions=r.wearActions||{};r.wearActions[c.actionId]={stack:stack,tick:clock(p)};}
  function sourceWear(p,c){var found=null,n=0,inv=p.inventory,expected=c.weaponSource&&c.weaponSource.weaponUid,w=rt(p).wearActions&&rt(p).wearActions[c.parentActionId||c.actionId];for(var i=0;i<Number(inv.getContainerSize());i++){var stack=inv.getItem(i);if(!stack||stack.empty)continue;var match=expected?String(stack.nbt&&stack.nbt.f_rank_enhance&&stack.nbt.f_rank_enhance.uid||'')===expected:!!(w&&stack.equals(w.stack));if(match){found=stack;n++;}}return n===1?found:null;}
  function deadHostile(q,p){if(String(q.getEntityType().getCategory()).toLowerCase()==='monster')return true;return !!(typeof q.getTarget==='function'&&q.getTarget()&&q.getTarget().equals(p));}
  function saveProjectile(q,c){var clean={};for(var k in c)if(k!=='entity'&&c[k]!==undefined&&typeof c[k]!=='function')clean[k]=c[k];q.persistentData.putString('fcraft_growth_source_v10',JSON.stringify(clean));}
  function loadProjectile(q){if(!q||!q.persistentData)return null;var raw=String(q.persistentData.getString('fcraft_growth_source_v10'));if(!raw||raw.length>12288)return null;try{var c=JSON.parse(raw);if(!c||typeof c.actionId!=='string'||(c.actorUuid||c.ownerUuid||c.weaponSource&&c.weaponSource.ownerUuid)!==String(q.getOwner()&&q.getOwner().uuid))return null;c.entity=q;return c;}catch(ignored){return null;}}
  function hostile(e,p) {
    if(training(p,e))return alive(e);
    if(safe(p))return false;
    if (!alive(e)||isPlayer(e)||npc(e)||safe(e)||e.equals(p)||!e.getHealth) return false;
    if(String(e.getEntityType().getCategory()).toLowerCase()==='monster')return true;
    return typeof e.getTarget==='function' && e.getTarget() && e.getTarget().equals(p);
  }
  function nearby(p, radius) {
    if(!nativeAABB)nativeAABB=Java.loadClass('net.minecraft.world.phys.AABB');
    return p.level.getEntitiesWithin(new nativeAABB(Number(p.x)-radius,Number(p.y)-radius,Number(p.z)-radius,
      Number(p.x)+radius,Number(p.y)+radius,Number(p.z)+radius));
  }
  function view(p) { var v=p.getViewVector(1);return {x:Number(v.x()),y:Number(v.y()),z:Number(v.z())}; }
  function traceBlocks(p,start,end) {
    if(!nativeClipContext){
      nativeClipContext=Java.loadClass('net.minecraft.world.level.ClipContext');
      nativeClipBlock=Java.loadClass('net.minecraft.world.level.ClipContext$Block');
      nativeClipFluid=Java.loadClass('net.minecraft.world.level.ClipContext$Fluid');
    }
    // Use current server poses for both the block and entity rays. KJS rayTrace
    // picks blocks at partialTick0 (previous pose); AI canEntityBeSeen instead
    // reads brain visibility memory, which players do not maintain.
    return p.level.clip(new nativeClipContext(start,end,nativeClipBlock.COLLIDER,nativeClipFluid.NONE,p));
  }
  function visible(p,target) {
    if(String(p.level.dimension)!==String(target.level.dimension))return false;
    var Vec=Java.loadClass('net.minecraft.world.phys.Vec3'),
      start=new Vec(Number(p.x),Number(p.getEyeY()),Number(p.z)),
      end=new Vec(Number(target.x),Number(target.getEyeY()),Number(target.z));
    return String(traceBlocks(p,start,end).getType())==='MISS';
  }
  function rayTargets(p,range,limit) {
    var v=view(p),Vec=Java.loadClass('net.minecraft.world.phys.Vec3'),start=new Vec(Number(p.x),Number(p.getEyeY()),Number(p.z)),
      end=new Vec(Number(p.x)+v.x*range,Number(p.getEyeY())+v.y*range,Number(p.z)+v.z*range),
      blockHit=traceBlocks(p,start,end),reach=range,list=nearby(p,range+1),hits=[];
    if(String(blockHit.getType())!=='MISS'){
      var loc=blockHit.getLocation(),bx=Number(loc.x())-Number(p.x),by=Number(loc.y())-Number(p.getEyeY()),bz=Number(loc.z())-Number(p.z);
      reach=Math.min(range,Math.sqrt(bx*bx+by*by+bz*bz));
      end=new Vec(Number(p.x)+v.x*reach,Number(p.getEyeY())+v.y*reach,Number(p.z)+v.z*reach);
    }
    for(var i=0;i<list.size();i++){
      var e=list.get(i);if(!hostile(e,p))continue;
      var hit=e.getBoundingBox().inflate(.18).clip(start,end);if(!hit.isPresent())continue;
      var q=hit.get(),dx=Number(q.x())-Number(p.x),dy=Number(q.y())-Number(p.getEyeY()),dz=Number(q.z())-Number(p.z),d=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(d<=reach)hits.push({entity:e,distance:d});
    }
    hits.sort(function(a,b){return a.distance-b.distance;});return hits.slice(0,limit);
  }
  function areaTargets(p,range,front) {
    var list=nearby(p,range),v=view(p),out=[];
    for(var i=0;i<list.size()&&out.length<12;i++){
      var e=list.get(i);if(!hostile(e,p)||distance(p,e)>range||!visible(p,e))continue;
      if(front&&((Number(e.x)-Number(p.x))*v.x+(Number(e.z)-Number(p.z))*v.z)<0)continue;
      out.push({entity:e,distance:distance(p,e)});
    }
    return out;
  }
  function playersNear(p,range) {
    var list=nearby(p,Math.max(1,range)),out=[p];
    for(var i=0;i<list.size();i++){var q=list.get(i);if(!q.equals(p)&&isPlayer(q)&&allied(p,q)&&alive(q)&&!q.isSpectator()&&distance(p,q)<=range&&visible(p,q))out.push(q);}
    return out.slice(0,12);
  }
  function effect(e,key,ticks,amplifier) { if(F.isManagedTrainingTargetV10&&F.isManagedTrainingTargetV10(e))return;e.potionEffects.add(key,ticks,amplifier||0,false,false); }
  function move(e,x,y,z) { if(F.isManagedTrainingTargetV10&&F.isManagedTrainingTargetV10(e))return;e.setMotionX(x);e.setMotionY(y);e.setMotionZ(z); }


 // Entity.isAlliedTo has Entity/Team overloads; installed Rhino resolves its
 // name to the Team signature. Compare the actual native teams explicitly.
 function allied(p,q){if(!isPlayer(p)||!isPlayer(q))return false;if(p.equals(q))return true;var nativeA=p.getTeam(),nativeB=q.getTeam();if(nativeA&&nativeB&&nativeA.equals(nativeB))return true;if(Platform.isLoaded('ftbteams')){var API=Java.loadClass('dev.ftb.mods.ftbteams.api.FTBTeamsAPI'),manager=API.api().getManager(),a=manager.getTeamForPlayer(p.minecraftPlayer||p),b=manager.getTeamForPlayer(q.minecraftPlayer||q);return a.isPresent()&&b.isPresent()&&a.get().getId().equals(b.get().getId());}return false;}
 F.areManaAlliesV98=allied;
 F.getManaAlliesV98=function(p,radius){return playersNear(p,Math.max(0,Number(radius)||0));};
 function around(p,center,r){var list=nearby(p,Math.max(r,distance(p,center)+r)),out=[];for(var i=0;i<list.size()&&out.length<48;i++){var q=list.get(i);if(hostile(q,p)&&distance(q,center)<=r&&visible(p,q))out.push({entity:q,distance:distance(p,q)});}return out;}
 function lineTargets(p,range,width){var list=nearby(p,range+width),v=view(p),out=[];for(var i=0;i<list.size()&&out.length<48;i++){var q=list.get(i),dx=Number(q.x)-Number(p.x),dz=Number(q.z)-Number(p.z),dot=dx*v.x+dz*v.z,side=Math.abs(dx*v.z-dz*v.x);if(hostile(q,p)&&dot>=0&&dot<=range&&side<=width/2+Number(q.getBbWidth())/2&&visible(p,q))out.push({entity:q,distance:distance(p,q)});}return out;}
 function aim(p,range){var V=Java.loadClass('net.minecraft.world.phys.Vec3'),v=view(p),a=new V(Number(p.x),Number(p.getEyeY()),Number(p.z)),b=new V(Number(p.x)+v.x*range,Number(p.getEyeY())+v.y*range,Number(p.z)+v.z*range),hit=traceBlocks(p,a,b),q=String(hit.getType())==='MISS'?b:hit.getLocation();return{x:Number(q.x()),y:Number(q.y()),z:Number(q.z())};}
 function boss(q){return /mowziesmobs:|bosses_of_mass_destruction:|cataclysm:|ender_dragon|wither/.test(String(q.type))||Number(q.maxHealth)>=100;}
 function protectItem(p,item){if(!item||item.empty||!item.isDamageableItem())return;var tag=item.getOrCreateTag(),own=tag.getBoolean('fcraft_p4_temper_owned');if(hasBuff(p,'temper')){if(!tag.getBoolean('Unbreakable')){tag.putBoolean('Unbreakable',true);tag.putBoolean('fcraft_p4_temper_owned',true);}}else if(own){tag.remove('Unbreakable');tag.remove('fcraft_p4_temper_owned');}}
 function protectInventory(p){var inv=p.inventory;for(var i=0;i<inv.getContainerSize();i++)protectItem(p,inv.getItem(i));}
 function hasBuff(p,key){var b=rt(p).buffs[key];return b&&b.until>clock(p)?b:null;}
 function buff(p,key,ticks,value){rt(p).buffs[key]={until:clock(p)+ticks,value:value};}
 function particle(p,kind,point){point=point||p;p.server.runCommandSilent('execute in '+String(p.level.dimension)+' run particle '+kind+' '+Number(point.x).toFixed(3)+' '+(Number(point.y)+1).toFixed(3)+' '+Number(point.z).toFixed(3)+' .6 .4 .6 .02 12 force');}
 function sound(p,id,pitch){p.server.runCommandSilent('execute in '+String(p.level.dimension)+' positioned '+Number(p.x).toFixed(2)+' '+Number(p.y).toFixed(2)+' '+Number(p.z).toFixed(2)+' run playsound '+id+' player @a[distance=..24] ~ ~ ~ .7 '+(pitch||1));}
 function attribute(p,key,id,value,ticks){var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),M=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier'),O=Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation'),U=Java.loadClass('java.util.UUID'),a=p.getAttribute(A[key]),u=U.fromString(id);if(!a)return;a.removeModifier(u);a.addTransientModifier(new M(u,'fcraft_phase4_'+key,value,O.MULTIPLY_TOTAL));var end=clock(p)+ticks;p.persistentData.putLong('fcraft_p4_'+key,end);p.server.scheduleInTicks(ticks,function(){if(alive(p)&&p.persistentData.getLong('fcraft_p4_'+key)<=clock(p))a.removeModifier(u);});}
 function cleanOne(p){var it=p.getActiveEffects().iterator(),remove=null;while(it.hasNext()){var e=it.next();if(!e.getEffect().isBeneficial()){remove=e.getEffect();break;}}if(remove)p.removeEffect(remove);}
 function heal(p,q,amount,ctx){if(!alive(q)||amount<=0)return 0;var pp=passive(p,ctx.job),before=Number(q.health);q.heal(amount*(q.equals(p)?mult(pp,'selfHealMultiplier'):1));var actual=Math.max(0,Number(q.health)-before);if(actual>0)notify(p,{type:'heal',amount:actual,targetUuid:uid(q),target:q,actionId:ctx.actionId+':heal:'+uid(q)+':'+clock(p),job:ctx.job,skillId:ctx.skillId});return actual;}
 function safeMove(p,dx,dz,limit){var len=Math.sqrt(dx*dx+dz*dz);if(len<.001)return 0;dx/=len;dz/=len;var best=0;for(var d=.25;d<=limit;d+=.25){var box=p.getBoundingBox().move(dx*d,.05,dz*d);if(!p.level.noCollision(p,box))break;var ground=p.level.getBlock(Math.floor(Number(p.x)+dx*d),Math.floor(Number(p.y)-.3),Math.floor(Number(p.z)+dz*d));if(ground.id==='minecraft:air'||ground.id==='minecraft:lava')break;best=d;}if(best>0)p.teleportTo(Number(p.x)+dx*best,Number(p.y),Number(p.z)+dz*best);return best;}
 function control(p,q,mode,ticks){if(!hostile(q,p)||training(p,q))return;var key=uid(q),old=controls[key],until=clock(p)+ticks;if(old&&old.until>until)return;var hadNoAI=old?old.hadNoAI:!!(q.isNoAi&&q.isNoAi());controls[key]={entity:q,mode:mode,until:until,x:Number(q.x),z:Number(q.z),hadNoAI:hadNoAI,ownsNoAI:mode==='stun'&&!boss(q)&&!hadNoAI};if(controls[key].ownsNoAI&&q.setNoAi){q.setNoAi(true);q.persistentData.putBoolean('fcraft_p4_owns_noai',true);q.persistentData.putLong('fcraft_p4_stun_until',until);}effect(q,'minecraft:slowness',ticks,4);}
 function source(p,magic){var R=Java.loadClass('net.minecraft.core.registries.Registries'),K=Java.loadClass('net.minecraft.resources.ResourceKey'),L=Java.loadClass('net.minecraft.resources.ResourceLocation'),D=Java.loadClass('net.minecraft.world.damagesource.DamageSource'),registry=p.level.registryAccess().registryOrThrow(R.DAMAGE_TYPE),key=K.create(R.DAMAGE_TYPE,new L('f_rank_days:phase4_'+(magic?'magic':'physical')));return new D(registry.getHolderOrThrow(key),p,p);}
 F.dealManaDamageV98=function(p,target,damage,ranged,context){if(!alive(p)||!hostile(target,p)||!permitted(p,target)||!visible(p,target)||!isFinite(damage)||damage<=0)return false;var state=F.getTraitRuntimeV96(p),previous=state.activeManaDamage,c=context||{job:F.resolveCombatJobPhase4(p),skillId:'relic_researcher.STAFF',actionId:token(p,'staff'),origin:'staff',magic:true};c.ranged=!!ranged;c.noToolWear=!!ranged||!!hasBuff(p,'temper');c.weaponId=c.weaponId||itemId(p.mainHandItem);c.itemId=c.weaponId;c.actorUuid=uid(p);state.activeManaDamage=c;var accepted;try{accepted=target.attack(source(p,!!c.magic),damage);}finally{state.activeManaDamage=previous;}if(accepted!==false&&(c.origin==='skill'||c.origin==='staff')&&typeof p.crit==='function')p.crit(target);if(accepted!==false&&!ranged&&!hasBuff(p,'temper')){var item=sourceWear(p,c);if(item&&!item.empty&&item.isDamageableItem())item.hurtAndBreak(1,p,function(entity){});}return accepted!==false;};
 // Invert the actual vanilla armor/toughness formula instead of globally changing target armor.
 function armorResult(d,a,t){var protection=Math.max(a*.2,Math.min(20,a-d/(2+t/4)));return d*(1-protection/25);}
 function penetrate(d,armor,toughness,fraction){fraction=Math.max(0,Math.min(1,fraction));if(!fraction||armor<=0)return d;var wanted=armorResult(d,armor*(1-fraction),toughness),lo=d,hi=Math.max(d,wanted*5+1);for(var i=0;i<30;i++){var mid=(lo+hi)/2;if(armorResult(mid,armor,toughness)<wanted)lo=mid;else hi=mid;}return(lo+hi)/2;}
 function backAttack(p,q){var v=q.getViewVector(1),dx=Number(p.x)-Number(q.x),dz=Number(p.z)-Number(q.z),len=Math.sqrt(dx*dx+dz*dz);return len>.001&&(Number(v.x())*dx+Number(v.z())*dz)/len<=-.5;}
 F.damageTypeIdPhase4=function(src){if(!src)return '';return String(typeof src.getType==='function'?src.getType():src.type||'');};
 function attacker(src){return src.actual||src.getEntity&&src.getEntity();}
 function direct(src){return src.immediate||src.getDirectEntity&&src.getDirectEntity();}
 function attackMeta(p,src){var c=F.getTraitRuntimeV96(p).activeManaDamage;if(c)return c;var d=direct(src),pr=d&&(projectiles[uid(d)]||loadProjectile(d));if(pr)return pr;var m=rt(p).melee;if(m&&clock(p)-m.tick<=2&&direct(src)&&direct(src).equals(p)&&F.damageTypeIdPhase4(src)==='player')return m;return{origin:'unverified',charged:false,actionId:token(p,'ordinary'),job:F.resolveCombatJobPhase4(p),weaponId:itemId(p.mainHandItem),ranged:false};}
 F.getCombatAttackContextV102=attackMeta;
 F.captureCombatAttackPhase4=function(e){var p=e.getEntity();if(!isPlayer(p)||p.level.isClientSide())return;var r=rt(p),item=p.mainHandItem,hand='main',combo=0;try{var bc=p.getCurrentAttack();if(bc){item=bc.itemStack();hand=bc.isOffHand()?'off':'main';}if(p.getComboCount)combo=Number(p.getComboCount());}catch(ignored){}protectItem(p,item);var t=clock(p),id=uid(p)+':melee:'+t+':'+combo+':'+hand,s=F.loadPlayerState(p);r.melee={origin:'melee',charged:Number(p.getAttackStrengthScale(.5))>=.85,tick:t,actionId:id,job:activeJob(s,null,p,item),weaponId:itemId(item),ranged:false,hand:hand,weaponSource:captureEquipment(p,item,hand,id)};rememberWear(p,r.melee,item);};
 F.captureArrowLoosePhase4=function(e){var p=e.getEntity();if(isPlayer(p)&&!(e.isCanceled&&e.isCanceled())){var bow=e.getBow(),id=token(p,'bow'),hand=bow.equals(p.offHandItem)?'off':'main';rt(p).draw={tick:clock(p),charged:Number(e.getCharge())>=18,weaponId:itemId(bow),actionId:id,order:sequence,rangedBonusDamage:currentRangedBonus(bow),weaponSource:captureEquipment(p,bow,hand,id)};}if(F.onPassiveArrowLoosePhase4)F.onPassiveArrowLoosePhase4(e);};
 F.captureEquipmentUseV10=function(e){var p=e.getEntity(),stack=e.getItemStack();if(!isPlayer(p)||p.level.isClientSide()||e.isCanceled&&e.isCanceled())return;var id=token(p,'use'),hand=String(e.getHand())==='OFF_HAND'?'off':'main';rt(p).equipmentUse={tick:clock(p),actionId:id,weaponId:itemId(stack),hand:hand,order:sequence,rangedBonusDamage:currentRangedBonus(stack),weaponSource:captureEquipment(p,stack,hand,id)};};
 F.captureProjectilePhase4=function(e){var q=e.getEntity();if(!q||q.level.isClientSide())return;if(F.onPassiveEntityJoinPhase4)F.onPassiveEntityJoinPhase4(e);if(q.persistentData.getBoolean('fcraft_p4_owns_noai')){if(q.setNoAi)q.setNoAi(false);q.persistentData.remove('fcraft_p4_owns_noai');q.persistentData.remove('fcraft_p4_stun_until');}if(!q.getOwner)return;var p=q.getOwner();if(!isPlayer(p))return;var stored=loadProjectile(q);if(stored){projectiles[uid(q)]=stored;return;}var r=rt(p),draw=r.draw,use=r.equipmentUse,t=clock(p),launch=selectLaunch(q,draw,use,t);
  if(String(q.type)==='minecraft:fishing_bobber'){if(F.captureFishingHookSourceV10)F.captureFishingHookSourceV10(q,p,launch);return;}if(!launch)return;
  if(!/bow|trident/.test(launch.weaponId))return;var descriptor=launch.weaponSource,charged=/crossbow|trident/.test(launch.weaponId)||!!launch.charged;
  var c={origin:'projectile',charged:charged,actionId:launch.actionId,job:F.resolveCombatJobPhase4(p,F.loadPlayerState(p),Item.of(launch.weaponId)),weaponId:launch.weaponId,weaponSource:descriptor,ownerUuid:uid(p),rangedBonusDamage:Number(launch.rangedBonusDamage||0),ranged:true,x:Number(p.x),y:Number(p.y),z:Number(p.z),tick:t,entity:q};projectiles[uid(q)]=c;saveProjectile(q,c);if(F.onPassiveProjectilePhase4)F.onPassiveProjectilePhase4(p,q);
 };
 F.composeCombatDamagePhase4=function(e){if(e.isCanceled&&e.isCanceled())return;var q=e.getEntity(),src=e.getSource(),p=attacker(src),amount=Number(e.getAmount());if(!(amount>0))return;
  if(isPlayer(p)&&hostile(q,p)&&permitted(p,q)){var c=attackMeta(p,src),s=F.loadPlayerState(p),j=c.job||activeJob(s,null,p),pp=passive(p,j),physical=!c.magic,ordinary=c.origin==='melee'||c.origin==='projectile';
   if(ordinary&&c.charged)amount+=symbolic(s,j,c.weaponId);if(c.critical&&c.weaponSource&&c.weaponSource.perks)amount*=Number(c.weaponSource.perks.critical_damage_multiplier||1);
   if(ordinary&&F.computeOutgoingPlayerAttackDamageV8){var out=F.computeOutgoingPlayerAttackDamageV8(p,amount,!!c.ranged,c);amount=out.final_damage;}
   if(physical)amount*=c.ranged?mult(pp,'rangedMultiplier'):mult(pp,'meleeMultiplier');if(physical&&j==='berserker')amount*=mult(pp,'axeMultiplier');if(boss(q))amount*=mult(pp,'bossMultiplier');if(c.ranged){if(q.isCurrentlyGlowing&&q.isCurrentlyGlowing())amount*=mult(pp,'markedTargetMultiplier');if((c.x===undefined?distance(p,q):distance(c,q))>=15)amount*=mult(pp,'longRangeMultiplier');}
   if(ordinary&&c.origin==='melee'&&mult(pp,'rollFirstHitMultiplier')!==1){amount*=mult(pp,'rollFirstHitMultiplier');rt(p).lastRollTick=0;}
   var qr=rt(q),t=clock(p);if(qr.physicalVulnerableUntil>t&&physical)amount*=1.18;if(qr.gravityUntil>t)amount*=1.20;if(hasBuff(p,'feast'))amount*=1.15;if(hasBuff(p,'temper')){amount*=1.25;if(!training(p,q))q.setSecondsOnFire(2);}if(qr.wetUntil>t&&c.element&&/cold|lightning/.test(c.element))amount*=1.20;
   if(ordinary&&j==='pathfinder'&&c.charged&&backAttack(p,q))amount*=F.guardianBackstabMultiplierV102?F.guardianBackstabMultiplierV102(p,c):1.30;
   if(F.modifyGuardianOutgoingV102)amount=F.modifyGuardianOutgoingV102(p,q,c,amount);
   if(physical){var pen=Math.max(Number(c.penetration||0),Number(pp.armorPenetration||0));if(ordinary&&j==='prospector'&&c.charged&&/_pickaxe$/.test(c.weaponId))pen=Math.max(pen,.35);if(pen>0){var A=Java.loadClass('net.minecraft.world.entity.ai.attributes.Attributes'),at=q.getAttribute(A.ARMOR_TOUGHNESS);amount=penetrate(amount,Number(q.getArmorValue()),at?Number(at.getValue()):0,pen);}}
  }
  if(p&&rt(p).weakenedUntil>clock(q))amount*=.85;
  // F-rank/incoming passive multipliers remain in the one existing22_5 hook.
  // Exact incoming reductions run after vanilla armor in LivingDamageEvent.
  e.setAmount(Math.max(0,amount));
 };
 F.onCombatDamageAppliedPhase4=function(e){if(e.isCanceled&&e.isCanceled()||!(Number(e.getAmount())>0))return;var q=e.getEntity(),src=e.getSource(),p=attacker(src),amount=Number(e.getAmount());if(isPlayer(q)){if(hasBuff(q,'sanctuary'))amount*=.70;if(hasBuff(q,'shell'))amount*=.55;if(F.applyPassiveIncomingPhase4)amount=F.applyPassiveIncomingPhase4(q,src,amount);e.setAmount(Math.max(0,amount));if(!(amount>0))return;combat(q);if(hasBuff(q,'shell')&&p&&!isPlayer(p)&&hostile(p,q)&&direct(src)&&direct(src).equals(p))F.dealManaDamageV98(q,p,Math.max(1,amount*.2),false,{origin:'reflect',job:'prospector',actionId:token(q,'reflect'),magic:false});}if(isPlayer(p)&&F.recordPromotionAppliedHitV110)F.recordPromotionAppliedHitV110(p,q,amount,attackMeta(p,src));if(!isPlayer(p)||!hostile(q,p)||!permitted(p,q))return;var tc=attackMeta(p,src);if(training(p,q)){if(F.recordTrainingHitV10)F.recordTrainingHitV10(p,q,Number(e.getAmount()),{action_id:tc.actionId,skill_id:tc.skillId||'',source:'native_applied'});return;}combat(p);var c=attackMeta(p,src),r=rt(p),t=clock(p),ordinary=c.origin==='melee'||c.origin==='projectile',key=c.actionId;
  r.mpActions=r.mpActions||{};if((ordinary&&c.charged||c.origin==='staff')&&r.mpActions[key]===undefined){r.mpActions[key]=t;var extra=ordinary&&c.charged&&c.weaponSource&&c.weaponSource.perks?Number(c.weaponSource.perks.charged_hit_mana_bonus||0):0;F.restoreManaV98(p,3+extra,'charged_hit');}
  var eventId=key+':'+uid(q)+':'+t,ev={type:c.skillId&&c.origin!=='staff'?'skill_hit':'hit',actionId:eventId,job:c.job,skillId:c.skillId||'',slot:c.slot||'',targetUuid:uid(q),targetId:String(q.type),weaponId:c.weaponId,itemId:c.weaponId,amount:Number(e.getAmount()),target:q,ranged:!!c.ranged,charged:!!c.charged,origin:c.origin,passiveEcho:String(c.origin).indexOf('passive_')===0,critical:!!c.critical,targetDistance:c.x===undefined?distance(p,q):distance(c,q)};notify(p,ev);
  if(c.ranged&&ordinary){rt(p).markedTarget=uid(q);ev=eventCopy(ev);ev.type='ranged_hit';ev.distance=c.x===undefined?distance(p,q):distance(c,q);notify(p,ev);}
  if(ordinary&&c.charged){if(c.job==='herbalist'&&Math.random()<.30)effect(q,'minecraft:poison',60,0);if(c.job==='chef'&&/:skillet$/.test(c.weaponId)){sound(p,'minecraft:block.anvil.place',1.8);push(p,q,.55);}
   if(c.job==='blacksmith')buff(p,'hammer_resist',10,true);
   if(c.job==='farmer'&&r.lastSweepAction!==key){r.lastSweepAction=key;var extra=areaTargets(p,2.5+(F.guardianSweepRangeBonusV102?F.guardianSweepRangeBonusV102(p,c):0),true);for(var i=0;i<extra.length;i++)if(!extra[i].entity.equals(q))F.dealManaDamageV98(p,extra[i].entity,symbolic(F.loadPlayerState(p),'farmer',c.weaponId)*.5,false,{origin:'symbol_sweep',job:'farmer',actionId:key+':sweep',parentActionId:c.actionId,weaponId:c.weaponId,weaponSource:c.weaponSource,magic:false});}
  }
 };
 F.onCombatDeathPhase4=function(e){var q=e.getEntity(),p=attacker(e.getSource()),promoContext=null;if(isPlayer(p)&&F.recordPromotionHuntKillV110){promoContext=attackMeta(p,e.getSource());F.recordPromotionHuntKillV110(p,q,promoContext);}if(!isPlayer(p)||isPlayer(q)||npc(q)||safe(q)||F.isManagedTrainingTargetV10&&F.isManagedTrainingTargetV10(q))return;var c=promoContext||attackMeta(p,e.getSource()),ev={type:'kill',actionId:c.actionId+':kill:'+uid(q),job:c.job,targetUuid:uid(q),targetId:String(q.type),targetCategory:String(q.getEntityType().getCategory()).toLowerCase(),weaponId:c.weaponId,itemId:c.weaponId,skillId:c.skillId||'',slot:c.slot||'',target:q,ranged:!!c.ranged,charged:!!c.charged,origin:c.origin,passiveEcho:String(c.origin).indexOf('passive_')===0,critical:!!c.critical,targetDistance:c.x===undefined?distance(p,q):distance(c,q)};if(c.weaponSource&&deadHostile(q,p)&&F.recordHeirloomKillV10)F.recordHeirloomKillV10(p,c.weaponSource,uid(q),q);notify(p,ev);if(c.skillId&&c.origin!=='staff'){ev=eventCopy(ev);ev.type='skill_kill';notify(p,ev);}};
 F.onCombatParryPhase4=function(p,q){rt(p).lastParryTick=clock(p);F.restoreManaV98(p,15,'parry');notify(p,{type:'parry',actionId:token(p,'parry'),job:F.resolveCombatJobPhase4(p),targetUuid:q?uid(q):''});};
 F.onCombatRollPhase4=function(p){if(isPlayer(p)){rt(p).lastRollTick=clock(p);notify(p,{type:'roll',actionId:token(p,'roll'),job:F.resolveCombatJobPhase4(p)});}};
 F.guardControlledAttackPhase4=function(e){var p=attacker(e.getSource()),c=p&&controls[uid(p)];if(c&&c.mode==='stun'&&c.until>clock(p))e.setCanceled(true);};
 F.guardCombatKnockbackPhase4=function(e){var p=e.getEntity();if(!isPlayer(p))return;if(hasBuff(p,'whirlwind')){e.setCanceled(true);return;}var s=F.loadPlayerState(p);if(activeJob(s,null,p)==='blacksmith'&&/hammer|mace/.test(itemId(p.mainHandItem)))e.setStrength(Number(e.getStrength())*.5);};
 F.guardCombatFallPhase4=function(e){var p=e.getEntity();if(isPlayer(p)&&hasBuff(p,'fall_guard')){p.fallDistance=0;e.setCanceled(true);}};
 F.guardSkilletPlacePhase4=function(e){var p=e.getEntity();if(!isPlayer(p)||!p.isShiftKeyDown()||itemId(e.getItemStack())!=='farmersdelight:skillet')return;var s=F.loadPlayerState(p);if(owns(s,'chef')&&areaTargets(p,12,false).length)e.setCanceled(true);};
 F.captureFishingPullPhase4=function(e){var p=e.getEntity();if(!isPlayer(p)||itemId(p.mainHandItem).indexOf('fishing_rod')<0)return;var hook=p.fishing;if(!hook||!hook.getHookedIn)return;var q=hook.getHookedIn();if(!q||!hostile(q,p))return;var id=uid(hook),r=rt(p),s=F.loadPlayerState(p);if(!owns(s,'angler')||r.lastHook===id)return;r.lastHook=id;var c={origin:'fishing_pull',job:'angler',weaponId:itemId(p.mainHandItem),actionId:token(p,'fishing'),magic:false};p.server.scheduleInTicks(1,function(){if(alive(p)&&alive(q)&&(!p.fishing||uid(p.fishing)!==id))F.dealManaDamageV98(p,q,gradeBonus(s,'angler'),true,c);});};
 function push(p,q,power){var dx=Number(q.x)-Number(p.x),dz=Number(q.z)-Number(p.z),l=Math.max(.01,Math.sqrt(dx*dx+dz*dz));move(q,dx/l*power,.15,dz/l*power);}
 function hit(p,q,stats,ctx,multiplier){return F.dealManaDamageV98(p,q,stats.damage*(multiplier||1),!!ctx.ranged,ctx);}
 function repeat(p,count,interval,fn){var dimension=String(p.level.dimension);for(var i=0;i<count;i++)(function(n){if(n===0)fn(n);else p.server.scheduleInTicks(n*interval,function(){if(alive(p)&&String(p.level.dimension)===dimension)fn(n);});})(i);}

 function skillArrow(p,ctx,stats,vx,vy,vz,x,y,z){var A=Java.loadClass('net.minecraft.world.entity.projectile.Arrow'),arrow=new A(p.level,p);arrow.setPos(x===undefined?Number(p.x):x,y===undefined?Number(p.getEyeY())-.1:y,z===undefined?Number(p.z):z);arrow.setBaseDamage(0);arrow.shoot(vx,vy,vz,2.8,0);var Pickup=Java.loadClass('net.minecraft.world.entity.projectile.AbstractArrow$Pickup');arrow.pickup=Pickup.DISALLOWED;p.level.addFreshEntity(arrow);var meta=copy(ctx);meta.entity=arrow;meta.fixedDamage=stats.damage;meta.skillArrow=true;meta.tick=clock(p);meta.ranged=true;projectiles[uid(arrow)]=meta;saveProjectile(arrow,meta);}
 F.onSkillArrowImpactPhase4=function(e){var arrow=e.getEntity(),c=arrow&&(projectiles[uid(arrow)]||loadProjectile(arrow));if(!c||!c.skillArrow)return;var hitResult=e.getRayTraceResult(),p=arrow.getOwner();if(String(hitResult.getType())==='ENTITY'){var q=hitResult.getEntity();if(alive(p)&&hostile(q,p)&&visible(p,q)){if(F.dealManaDamageV98(p,q,c.fixedDamage,true,c))effect(q,'minecraft:slowness',60,1);}arrow.discard();delete projectiles[uid(arrow)];e.setCanceled(true);}else if(String(hitResult.getType())==='BLOCK'){arrow.discard();delete projectiles[uid(arrow)];e.setCanceled(true);}};
 function perform(p,def,stats,ctx){var hits=0,healed=0,targets=[],kind=def.kind,v=view(p),center,r=rt(p);ctx.magic=kind==='ray'||kind==='staff'||kind==='heal';ctx.ranged=['pierce','ray','backshot','rain','grapple','gravity','staff'].indexOf(kind)>=0;ctx.penetration=Number(def.penetration||0);
  function strike(list,each){for(var i=0;i<list.length;i++){var q=list[i].entity;if(hit(p,q,stats,ctx)){hits++;if(each)each(q);}}}
  if(kind==='combo'){safeMove(p,v.x,v.z,3.5);repeat(p,3,3,function(){strike(areaTargets(p,def.range,true));particle(p,'minecraft:sweep_attack');sound(p,'minecraft:entity.player.attack.sweep',1.1);});}
  else if(kind==='whirlwind'){var duration=50+Number(passive(p,ctx.job).whirlwindBonusTicks||0);buff(p,'whirlwind',duration,true);effect(p,'minecraft:resistance',duration,0);repeat(p,Math.floor(duration/10),10,function(){strike(areaTargets(p,def.range,false));particle(p,'minecraft:sweep_attack');});}
  else if(kind==='backshot'){safeMove(p,-v.x,-v.z,6);buff(p,'fall_guard',60,true);for(var fan=-1;fan<=1;fan++){var angle=fan*.18,vx=v.x*Math.cos(angle)-v.z*Math.sin(angle),vz=v.x*Math.sin(angle)+v.z*Math.cos(angle);skillArrow(p,ctx,stats,vx,v.y,vz);}sound(p,'minecraft:entity.arrow.shoot',1.2);}
  else if(kind==='rain'){center=aim(p,def.range);repeat(p,6,10,function(){var list=around(p,center,def.radius);for(var a=0;a<list.length;a++){var q=list[a].entity;effect(q,'minecraft:glowing',40,0);skillArrow(p,ctx,stats,0,-1,0,Number(q.x),Number(q.y)+4,Number(q.z));}particle(p,'minecraft:crit',{x:center.x,y:center.y+4,z:center.z});});}
   else if(kind==='heal'){var party=playersNear(p,def.range);for(var a=0;a<party.length;a++){healed+=heal(p,party[a],stats.heal,ctx);cleanOne(party[a]);}targets=areaTargets(p,def.range,false);for(var u=0;u<targets.length;u++){var q=targets[u].entity,undead=q.getMobType&&q.getMobType().equals(Java.loadClass('net.minecraft.world.entity.MobType').UNDEAD);if(undead&&hit(p,q,stats,ctx))hits++;}particle(p,'minecraft:happy_villager');}
  else if(kind==='sanctuary'){center={x:Number(p.x),y:Number(p.y),z:Number(p.z)};repeat(p,6,20,function(){var party=playersNear(p,def.range+distance(p,center));for(var a=0;a<party.length;a++)if(distance(party[a],center)<=def.range){buff(party[a],'sanctuary',21,true);healed+=heal(p,party[a],stats.heal,ctx);}particle(p,'minecraft:enchanted_hit',center);});}
  else if(kind==='harvest'){strike(areaTargets(p,def.range,true));healed+=heal(p,p,Math.min(6,hits*1.5),ctx);particle(p,'minecraft:sweep_attack');}
  else if(kind==='root'){center=aim(p,def.range);targets=around(p,center,def.radius);for(var a=0;a<targets.length;a++)control(p,targets[a].entity,'root',70);repeat(p,4,20,function(){strike(around(p,center,def.radius));particle(p,'minecraft:composter',center);});}
  else if(kind==='poison'){center=aim(p,def.range);repeat(p,10,10,function(){var list=around(p,center,def.radius);for(var a=0;a<list.length;a++){var q=list[a].entity;effect(q,'minecraft:poison',30,1);rt(q).weakenedUntil=clock(p)+30;}particle(p,'minecraft:spore_blossom_air',center);});}
  else if(kind==='tonic'){var party=playersNear(p,def.range);for(var a=0;a<party.length;a++){var q=party[a],s=F.loadPlayerState(q),m=ensure(s,clock(q));m.tonic_until=clock(q)+160;F.savePlayerState(q,s);attribute(q,'ATTACK_SPEED','fca40000-0000-4000-8000-000000000001',.25,160);attribute(q,'MOVEMENT_SPEED','fca40000-0000-4000-8000-000000000002',.20,160);}}
  else if(kind==='grapple'){targets=rayTargets(p,def.range,1);strike(targets,function(q){if(boss(q)){safeMove(p,Number(q.x)-Number(p.x),Number(q.z)-Number(p.z),Math.max(0,distance(p,q)-2));}else{var dx=Number(p.x)-Number(q.x),dz=Number(p.z)-Number(q.z),l=Math.max(.1,Math.sqrt(dx*dx+dz*dz));move(q,dx/l*1.1,.25,dz/l*1.1);}});}
  else if(kind==='wave')strike(lineTargets(p,def.range,def.width),function(q){push(p,q,1);rt(q).wetUntil=clock(p)+120;effect(q,'minecraft:slowness',120,0);});
  else if(kind==='stun')strike(areaTargets(p,def.range,true),function(q){if(!training(p,q))q.setSecondsOnFire(2);control(p,q,'stun',boss(q)?16:40);sound(p,'minecraft:block.anvil.place',1.8);});
  else if(kind==='feast'){var party=playersNear(p,def.range);for(var a=0;a<party.length;a++){var q=party[a];q.setAbsorptionAmount(Math.max(Number(q.getAbsorptionAmount()),6));buff(q,'feast',200,true);q.foodLevel=Math.min(20,Number(q.foodLevel)+8);}}
  else if(kind==='anvil')strike(lineTargets(p,def.range,def.width),function(q){if(!training(p,q))q.setSecondsOnFire(5);push(p,q,.7);});
  else if(kind==='temper'){var party=playersNear(p,def.range);for(var a=0;a<party.length;a++){buff(party[a],'temper',200,true);protectInventory(party[a]);}}
  else if(kind==='gravity'){center=aim(p,def.range);repeat(p,12,10,function(){var list=around(p,center,def.radius);for(var a=0;a<list.length;a++){effect(list[a].entity,'minecraft:slowness',20,2);rt(list[a].entity).gravityUntil=clock(p)+20;}particle(p,'minecraft:enchant',center);});}
  else if(kind==='shell'){buff(p,'shell',120,true);particle(p,'minecraft:enchanted_hit');}
  else if(kind==='ambush'){targets=rayTargets(p,def.range,1);if(targets.length){var q=targets[0].entity,behind=q.getViewVector(1),x=Number(q.x)-Number(behind.x())*1.7,z=Number(q.z)-Number(behind.z())*1.7,dx=x-Number(p.x),dz=z-Number(p.z);safeMove(p,dx,dz,Math.sqrt(dx*dx+dz*dz));if(distance(p,q)<=3.5&&backAttack(p,q))strike(targets);else return{hits:0,healed:0,affected:0};}}
  else if(kind==='smoke'){var list=areaTargets(p,def.range,false);for(var a=0;a<list.length;a++){var q=list[a].entity;if(!boss(q)&&q.setTarget)q.setTarget(null);effect(q,'minecraft:blindness',60,0);effect(q,'minecraft:slowness',60,1);}var party=playersNear(p,def.range);for(var b=0;b<party.length;b++)effect(party[b],'minecraft:speed',80,1);particle(p,'minecraft:large_smoke');}
  else if(kind==='armor_break'){move(p,0,.15,0);strike(areaTargets(p,def.range,false),function(q){if(!training(p,q))q.setMotionY(Number(q.getDeltaMovement().y())+.45);rt(q).physicalVulnerableUntil=clock(p)+120;});}
  else if(kind==='quake'){strike(areaTargets(p,def.range,true));particle(p,'minecraft:enchanted_hit');}
  else {var amp=kind==='pierce'&&clock(p)-Number(r.lastParryTick||-99999)<=30?1.5:1;targets=kind==='staff'?rayTargets(p,def.range,1):lineTargets(p,def.range,def.width||1);for(var a=0;a<targets.length;a++)if(hit(p,targets[a].entity,stats,ctx,amp)){hits++;if(kind==='staff'&&F.guardianRuneImpactV102)F.guardianRuneImpactV102(p,targets[a].entity,stats.damage,ctx);}particle(p,kind==='ray'?'minecraft:sonic_boom':'minecraft:enchanted_hit');}
  return{hits:hits,healed:healed,affected:targets.length};
 }
 function castDefinition(p,job,slot,def,requireRegistration){if(F.isGuardianGearBrokenV102&&F.isGuardianGearBrokenV102(p.mainHandItem))return fail('guardian_gear_broken','먼저 나우에게 수호자 장비를 수리하세요.');if(!alive(p)||p.isSpectator())return fail('unavailable','지금은 스킬을 사용할 수 없습니다.');if(F.isPlayerInProtectedGuiOrWork&&F.isPlayerInProtectedGuiOrWork(p,false))return fail('blocked_by_gui_or_work_action');var s=F.loadPlayerState(p),t=clock(p),m=ensure(s,t);if(requireRegistration&&(!(s.guild_card&&s.guild_card.issued)||!owns(s,job)))return fail('unregistered_job','먼저 헤스에게 직업을 등록하세요.');if(requireRegistration&&grade(s,job)<(slot==='X'?1:3))return fail('grade_locked',slot==='X'?'E급에서 주력 스킬이 해금됩니다.':'C급에서 전술 스킬이 해금됩니다.');if(safe(p)&&!(F.isPlayerTrainingAreaV10&&F.isPlayerTrainingAreaV10(p))&&['heal','sanctuary','tonic','feast','temper','shell','smoke'].indexOf(def.kind)<0)return fail('safe_region','마을·시작 안전구역에서는 공격 스킬을 사용할 수 없습니다.');var key=job+'.'+slot;if(t<m.global_until||t<Number(m.cooldowns[key]||0))return fail('cooldown','스킬이 아직 준비되지 않았습니다.');var d=requireRegistration?definition(p,s,job,slot==='X'?0:1):copy(def),stats=d.profile||profile(traitId(s),d,passive(p,job));if(m.mp+1e-7<stats.mana)return fail('insufficient_mana','마나가 부족합니다. 약초차나 휴식으로 보충하세요.');m.mp=Math.max(0,m.mp-stats.mana);m.cooldowns[key]=t+stats.cooldown;m.global_until=t+GLOBAL_COOLDOWN;if(requireRegistration)m.active_job=job;F.savePlayerState(p,s);if(stats.exhaustion)p.addExhaustion(stats.exhaustion);var ctx={origin:slot==='STAFF'?'staff':'skill',job:job,skillId:key,slot:slot,actionId:token(p,key),weaponId:itemId(p.mainHandItem),actorUuid:uid(p),magic:false};ctx.weaponSource=captureEquipment(p,p.mainHandItem,'main',ctx.actionId);rememberWear(p,ctx,p.mainHandItem);var result=perform(p,d,stats,ctx);F.syncManaV98(p,true);return{ok:true,job_id:job,slot:slot,label:d.label,mana_cost:stats.mana,cooldown_ticks:stats.cooldown,damage:stats.damage,heal:stats.heal,hits:result.hits,healed:result.healed,affected:result.affected,actionId:ctx.actionId};}
 F.castJobManaSkillV98=function(p,slot,requested){if(!p)return fail('unavailable');slot=String(slot||'').toUpperCase();if(slot!=='X'&&slot!=='C')return fail('invalid_slot');var s=F.loadPlayerState(p),j=activeJob(s,null,p);if(requested&&String(requested)!==j)return fail('job_weapon_mismatch');if(!j)return fail('unregistered_job','먼저 헤스에게 직업을 등록하세요.');return castDefinition(p,j,slot,skills[j][slot==='X'?0:1],true);};
 F.castRuneStaffV98=function(p){if(!p||!p.mainHandItem)return fail('unavailable');var id=itemId(p.mainHandItem);if(id!=='f_rank_days:ancient_rune_staff'&&id!=='f_rank_days:apprentice_mana_wand'&&id!=='f_rank_days:wrought_relic_staff')return fail('wrong_held_item');var s=F.loadPlayerState(p),damage=(id==='f_rank_days:wrought_relic_staff'?6:3.5)+(owns(s,'relic_researcher')?gradeBonus(s,'relic_researcher'):0);if((id==='f_rank_days:ancient_rune_staff'||id==='f_rank_days:wrought_relic_staff')&&F.computeEnhancementBonusStatsV8){var spec=F.getWeaponSpecV8(id);if(spec)damage+=Number(F.computeEnhancementBonusStatsV8(F.getWeaponEnhanceLevel(p.mainHandItem)).bonus_damage||0);}return castDefinition(p,'relic_researcher','STAFF',{slot:'STAFF',label:'고대 룬 탄환',kind:'staff',damage:damage,range:14,mana:8,cooldown:44},false);};
 F.consumeManaStonePhase4=function(p){if(itemId(p.mainHandItem)!=='f_rank_days:refined_mana_stone')return fail('wrong_held_item');var s=F.loadPlayerState(p),t=clock(p),m=ensure(s,t);if(t<Number(m.stone_until||0))return fail('cooldown','마력석은 15초 뒤 다시 사용할 수 있습니다.');if(m.mp>=maximum(s))return fail('already_full_mana');if(!F.consumePlayerItemExact(p,'f_rank_days:refined_mana_stone',1))return fail('missing_item');m.stone_until=t+300;F.savePlayerState(p,s);return F.restoreManaV98(p,35,'refined_mana_stone');};
 NetworkEvents.dataReceived('f_rank_days:cast_mana_skill',function(e){var p=e.player;if(!p)return;rt(p);var t=clock(p),k=uid(p);if(t<Number(inputBudget[k]||0))return;inputBudget[k]=t+2;var d=e.data||{},r=F.castJobManaSkillV98(p,d.slot,d.job_id);if(!r.ok&&r.message)p.tell(r.message);send(p,'mana_skill_result',{ok:r.ok,reason:r.reason||'',message:r.message||'',slot:String(d.slot||'')});if(!r.ok)F.syncManaV98(p,true);});
 NetworkEvents.dataReceived('f_rank_days:request_mana_state',function(e){var p=e.player;if(!p)return;rt(p);var t=clock(p),k=uid(p);if(t<Number(syncBudget[k]||0))return;syncBudget[k]=t+10;F.syncManaV98(p,true);});
 ItemEvents.foodEaten(function(e){var p=e.entity;if(p&&isPlayer(p)&&String(e.item.id)==='f_rank_days:alchemist_clear_tea'){var s=F.loadPlayerState(p),m=ensure(s,clock(p));m.tea_until=clock(p)+400;F.savePlayerState(p,s);F.restoreManaV98(p,45,'clear_herb_tea');}});
 ItemEvents.rightClicked(function(e){if(e.player&&String(e.item.id)==='f_rank_days:refined_mana_stone'){var r=F.consumeManaStonePhase4(e.player);if(!r.ok&&r.message)e.player.tell(r.message);}});
 ServerEvents.tick(function(e){var t=Number(e.server.overworld().getTime());for(var k in controls){var c=controls[k],q=c.entity;if(!alive(q)||c.until<=t){if(alive(q)&&c.ownsNoAI&&q.persistentData.getBoolean('fcraft_p4_owns_noai')){if(q.isNoAi&&q.isNoAi())q.setNoAi(false);q.persistentData.remove('fcraft_p4_owns_noai');q.persistentData.remove('fcraft_p4_stun_until');}delete controls[k];continue;}q.setMotionX(0);q.setMotionZ(0);if(q.getNavigation)q.getNavigation().stop();q.setPos(c.x,Number(q.y),c.z);}if(t%10===0){var ps=e.server.players;for(var i=0;i<ps.size();i++){protectInventory(ps.get(i));F.syncManaV98(ps.get(i));}}if(t%200===0){for(var playerId in runtime){var wears=runtime[playerId].wearActions||{};for(var wearId in wears)if(t-wears[wearId].tick>1200)delete wears[wearId];var seen=runtime[playerId].mpActions||{};for(var actionId in seen)if(t-seen[actionId]>1200)delete seen[actionId];}}if(t%200===0)for(var id in projectiles)if(!alive(projectiles[id].entity)||t-projectiles[id].tick>1200)delete projectiles[id];});
 PlayerEvents.loggedIn(function(e){rt(e.player);delete lastSync[uid(e.player)];F.syncManaV98(e.player,true);});PlayerEvents.respawned(function(e){e.server.scheduleInTicks(1,function(){F.syncManaV98(e.player,true);});});PlayerEvents.loggedOut(function(e){var k=uid(e.player);delete runtime[k];delete inputBudget[k];delete syncBudget[k];delete lastSync[k];});
 for(var ci=0;ci<F.JOB_CATALOG_V96.length;ci++){var entry=F.JOB_CATALOG_V96[ci],defs=skills[entry.id];if(defs){entry.mana_skills=copy(defs);for(var si=0;si<2;si++){entry.mana_skills[si].cost=defs[si].mana;entry.mana_skills[si].cooldown_ticks=defs[si].cooldown;}entry.skills_preview='X '+defs[0].label+' / C '+defs[1].label;entry.skill_preview=entry.skills_preview;}}

 F.passiveParryWavePhase4=function(p){var s=F.loadPlayerState(p),ctx={origin:'passive_wave',job:'swordsman',actionId:token(p,'parry_wave'),weaponId:itemId(p.mainHandItem),magic:false},list=areaTargets(p,3.5,true),damage=attackPower(p,s,'swordsman')*.5;for(var i=0;i<list.length;i++)F.dealManaDamageV98(p,list[i].entity,damage,false,ctx);particle(p,'minecraft:sweep_attack');};
 F.passiveRangerWindPhase4=function(p,target){if(rt(p).windBusy)return;rt(p).windBusy=true;try{var ctx={origin:'passive_wind',job:'ranger',actionId:token(p,'ranger_wind'),weaponId:itemId(p.mainHandItem),magic:false,ranged:true},list=around(p,target,2.5),damage=attackPower(p,F.loadPlayerState(p),'ranger')*.3;for(var i=0;i<list.length;i++)if(!list[i].entity.equals(target))F.dealManaDamageV98(p,list[i].entity,damage,true,ctx);particle(p,'minecraft:cloud',target);}finally{rt(p).windBusy=false;}};

 F.captureCombatCriticalPhase4=function(e){var p=e.getEntity();if(isPlayer(p)&&rt(p).melee)rt(p).melee.critical=!!e.isVanillaCritical()||String(e.getResult())==='ALLOW';};
 F.applyManaControlPhase4=function(p,q,mode,ticks){if(mode!=='fear'){control(p,q,mode,ticks);return;}var list=around(p,q,4);for(var i=0;i<list.length;i++){var target=list[i].entity;if(training(p,target))continue;effect(target,'minecraft:weakness',ticks,0);if(!boss(target)){if(target.setTarget)target.setTarget(null);var dx=Number(target.x)-Number(p.x),dz=Number(target.z)-Number(p.z),len=Math.max(.1,Math.sqrt(dx*dx+dz*dz));if(target.getNavigation)target.getNavigation().moveTo(Number(target.x)+dx/len*6,Number(target.y),Number(target.z)+dz/len*6,1.15);}}};

 F.maintainManaControlPhase4=function(e){var q=e.getEntity();if(!q||q.level.isClientSide()||!q.persistentData.getBoolean('fcraft_p4_owns_noai'))return;var until=Number(q.persistentData.getLong('fcraft_p4_stun_until'));if(until<=clock(q)){if(q.isNoAi&&q.isNoAi())q.setNoAi(false);q.persistentData.remove('fcraft_p4_owns_noai');q.persistentData.remove('fcraft_p4_stun_until');delete controls[uid(q)];}else if(!controls[uid(q)])controls[uid(q)]={entity:q,mode:'stun',until:until,x:Number(q.x),z:Number(q.z),hadNoAI:false,ownsNoAI:true};};
 F.COMBAT_PHASE4_TEST={maximum:maximum,ensure:ensure,candidates:candidates,activeJob:activeJob,gradeBonus:gradeBonus,symbolic:symbolic,armorResult:armorResult,penetrate:penetrate,profile:profile,skills:skills};
})(global.FRankDays);
