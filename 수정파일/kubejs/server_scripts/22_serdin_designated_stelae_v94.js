// v9.4 only: exact configured stones, origin-stamped sheets and personal C-exam proof.
global.FRankDays=global.FRankDays||{};
(function(F){
  function layout(server){return typeof F.getSerdinV94Layout==='function'?F.getSerdinV94Layout(server):null;}
  function identity(l){return String(l.id||l.worldValidationId);}
  function match(l,dimension,x,y,z,id){
    var sites=l.stelae||[];
    for(var i=0;i<sites.length;i++){
      var s=sites[i];if(s.dimension!==dimension||['BEGINNER','DEEP'].indexOf(s.tier)<0)continue;
      var blocks=s.blocks||[];for(var b=0;b<blocks.length;b++){var p=blocks[b];if(p.x===x&&p.y===y&&p.z===z&&p.blockId===id)return s;}
    }
    return null;
  }
  F.usesDesignatedStelaeV94=function(server){return Boolean(layout(server));};
  F.isMidTierDeliveryEligibleV94=function(player,spec,stack,delivery){
    if(!player||!spec||spec.job!=='relic_researcher'||spec.grade!=='C'||delivery.id!=='f_rank_days:ancient_rubbing_sheet')return true;
    var l=layout(player.server);if(!l)return true;
    var n=stack.nbt&&stack.nbt.FCraftRubbing;
    return Boolean(n&&String(n.layout)===identity(l)&&String(n.tier)==='DEEP'&&String(n.owner)===String(player.uuid));
  };
  F.getMidTierExtraRequirementsV94=function(player,state,spec){
    if(!player||!spec||spec.job!=='relic_researcher'||spec.grade!=='C')return[];
    var l=layout(player.server);if(!l)return[];
    var e=state.mid_tier_exams_v93&&state.mid_tier_exams_v93.relic_researcher_C,count=e&&e.deepRubbingsV94&&Number(e.deepRubbingsV94[identity(l)]||0)||0;
    return count>=12?[]:['접수 후 심층 지정 비석 직접 채록 '+count+'/12'];
  };
  F.collectDesignatedRubbingV94=function(player,where,held){
    var l=layout(player.server);if(!l)return{matched:false};
    var s=match(l,where.dimension,where.x,where.y,where.z,where.blockId);if(!s)return{matched:false};
    if(!held||String(held.id)!=='minecraft:paper'||Number(held.count)<1)return{matched:true,ok:false,reason:'paper_required'};
    var dx=Number(player.x)-where.x-.5,dy=Number(player.y)-where.y,dz=Number(player.z)-where.z-.5;
    if(String(player.level.dimension)!==where.dimension||dx*dx+dy*dy+dz*dz>42.25)return{matched:true,ok:false,reason:'too_far'};
    var state=F.loadPlayerState(player),now=Date.now(),proof=state.stelae_v94||{lastAt:0,total:0};
    if(now>=proof.lastAt&&now-proof.lastAt<400)return{matched:true,ok:false,reason:'duplicate_hand_or_click'};
    // Operate on the actual held stack, not an inventory-wide clear command.
    held.shrink(1);proof.lastAt=now;proof.total=Number(proof.total||0)+1;state.stelae_v94=proof;
    state.job_licenses.relic_researcher.stats.rubbings_taken++;
    var old=state.active_exams.relic_researcher_f_to_e;
    if(old&&old.status==='IN_PROGRESS'&&old.phase==='PRACTICAL')old.practical.rubbings_taken++;
    var mid=state.mid_tier_exams_v93&&state.mid_tier_exams_v93.relic_researcher_C;
    if(s.tier==='DEEP'&&state.job_licenses.relic_researcher.grade==='D'&&mid&&mid.status==='ACCEPTED'){
      mid.deepRubbingsV94=mid.deepRubbingsV94||{};mid.deepRubbingsV94[identity(l)]=Math.min(12,Number(mid.deepRubbingsV94[identity(l)]||0)+1);
    }
    F.savePlayerState(player,state);
    player.give(Item.of('f_rank_days:ancient_rubbing_sheet',{
      FCraftRubbing:{layout:identity(l),stela:String(s.id),tier:String(s.tier),owner:String(player.uuid)},
      display:{Lore:[JSON.stringify({text:s.tier==='DEEP'?'심층 지정 비석에서 채록한 본인 탁본':'초급 지정 비석에서 채록한 본인 탁본',color:s.tier==='DEEP'?'aqua':'gray',italic:false})]}
    }));
    if(F.notifyFtbQuestsStageCheck)F.notifyFtbQuestsStageCheck(player);
    return{matched:true,ok:true,tier:s.tier,stela:s.id,message:'['+(s.tier==='DEEP'?'심층':'초급')+' 비문 채록] 종이 한 장에 비문을 옮겼습니다.'};
  };
  BlockEvents.rightClicked(function(event){
    var p=event.player,b=event.block;if(!p||!b||!layout(p.server))return;
    var result=F.collectDesignatedRubbingV94(p,{dimension:String(p.level.dimension),x:Number(b.x),y:Number(b.y),z:Number(b.z),blockId:String(b.id)},event.item);
    if(result.matched){if(result.ok&&p.tell)p.tell(result.message);else if(result.reason==='paper_required'&&p.tell)p.tell('[고대 비석] 종이를 들고 비문을 채록하세요.');event.cancel();}
  });
})(global.FRankDays);
