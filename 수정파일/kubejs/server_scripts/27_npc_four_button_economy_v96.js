// All mutations require a currently offered server button and NPC distance validation.
global.FRankDays=global.FRankDays||{};
(function(F){
 var oldOpen=F.openNpcRpgDialog,oldAction=F.handleNpcDialogAction,oldPayload=F.buildNpcDialogPayload;
 var N='f_rank_days:',MAIN=[['talk','대화(선물)','talk','ACTION_MENU_TALK'],['buy','구매','shop','ACTION_OPEN_BUY_SHOP'],['sell','판매','shop','ACTION_OPEN_SELL_SHOP'],['quest','일일 의뢰','quest','ACTION_CHECK_QUESTS'],['promotion_exam','승급 시험','special','OPEN_PROMOTION_EXAM']];
 function button(id,label,action,sub,enabled,hint){return{id:id,label:label,action:action,sub_id:sub||'',enabled:enabled!==false,error_hint:hint||'',disabled_reason:hint||'',icon:action.indexOf('BUY')>=0||action.indexOf('SELL')>=0?'shop':'talk'};}
 function back(){return button('v96_back','◀ 뒤로','V96_BACK');}
 function nauTabsV98(){return[button('v98_nau_items','단조 물품 · 연장 수리','V98_NAU_ITEMS'),button('v98_nau_forge','무기 강화 · 안전 계승','V96_NAU_FORGE'),button('v10_nau_heirloom','가보 이름 각인','V10_NAU_HEIRLOOM')];}
 function captain(npc){return npc==='marco'||npc==='marco_mainland';}
 function main(npc){if(captain(npc))return[button('talk','대화','ACTION_MENU_TALK'),button('sail','출항 · 귀환','V96_SAIL'),button('route','항로 안내','V99_MARCO_ROUTE'),button('quest','의뢰','ACTION_CHECK_QUESTS')];var bs=[];for(var i=0;i<MAIN.length;i++){var m=MAIN[i];bs.push(button(m[0],m[1],m[3]));bs[i].icon=m[2];}if(npc==='marco'||npc==='marco_mainland')bs[1]=button('sail','출항 · 귀환','V96_SAIL');return bs;}
 function day(p){return Math.floor(Number(p.server.overworld().getDayTime())/24000);}
 function fail(s,message){return{ok:false,reason:s,message:message||s};}
 function itemLabelV98(id){return String(Item.of(id).displayName.getString());}
 function say(p,npc,text,buttons,view,initialOpen){var s=F.loadPlayerState(p),payload=F.buildNpcDialogPayload(p,s,npc,text,buttons||main(npc),0);payload.view=view||'MAIN';payload.buttons_json=JSON.stringify(payload.buttons);var tabs=npc==='nau'&&view==='BUY'?nauTabsV98():[];payload.shop_tabs_json=JSON.stringify(tabs);F.pushNpcDialogToClient(p,payload,initialOpen!==true);if(tabs.length){s=F.loadPlayerState(p);s.npc_dialog.active_buttons=(payload.buttons||[]).concat(tabs);F.savePlayerState(p,s);}return{ok:true,message:text,payload:payload};}
 var EMPTY={hess:'현재 추가로 배정된 길드 특별 공문은 없습니다. 언제나 노고에 감사드립니다.',darim:'지금은 농장 일손이 충분해서 따로 필요한 건 없어. 물어봐 줘서 고마워!',roman:'당장 필요한 약재는 다 채워 뒀어. 일감 생기면 그때 부를게.',gori:'주방 식재료가 아직 넉넉하네! 신경 써 줘서 정말 고마워, 식사는 챙겼어?',nau:'오늘은 급한 단조 주문이 없구먼. 연장 날이나 잘 갈아 두라고.',hwiyeon:'다행히 오늘은 위급한 환자가 없네요. 몸 조심하시고 무리하지 마세요.',ski:'오늘 내줄 특별 수련 과제는 없다! 자세 흐트러지지 않게 기본기나 닦아 둬!',harin:'숲 외곽 경계는 아직 조용하다. 당장 맡길 임무는 없어.',hyeophap:'지금 감정 중인 유물만 해도 책상이 꽉 찼거든! 새 조사 건이 생기면 알려 줄게.',bambam:'지금은 짐꾸러미 정리가 끝났어! 재미있는 거래 거리가 생기면 또 보자고.'};
 // [item,count,copper,optional NBT]. No client-provided price or item identifier is trusted.
 var BUY={
 hess:[['minecraft:paper',4,8],['minecraft:written_book',1,10,{title:'브리온 생활 안내',author:'아르베른 통합 길드',pages:[JSON.stringify({text:'헤스에게 직업과 F급 특성을 등록하고 등록증에 서명하면 기본 도구와 150동화를 받습니다. 생활·전투·탐험의 길은 함께 배울 수 있습니다.'}),JSON.stringify({text:'주민에게 대화·구매·판매·의뢰를 이용할 수 있습니다. 물품은 생업에 맞는 주민에게 판매하세요. 우측 상단 동전과 신문 아이콘은 클릭하거나 G·N 키로 펼칩니다.'})]}]],darim:[['minecraft:wheat_seeds',8,8],['minecraft:carrot',4,12],['minecraft:potato',4,12],['minecraft:bone_meal',4,16],['farmersdelight:cabbage_seeds',4,16],['farmersdelight:tomato_seeds',4,16]],
 roman:[['minecraft:potion',1,35,{Potion:'minecraft:healing'}],['minecraft:potion',1,35,{Potion:'minecraft:swiftness'}],[N+'alchemist_clear_tea',1,35],['minecraft:glass_bottle',4,8]],
 gori:[[N+'hearth_potato_soup',1,50],[N+'brion_barley_bread',2,25],[N+'golden_wheat_stew',1,80],[N+'serdin_herb_ration',2,45]],
 nau:[[N+'tempering_stone',1,60],[N+'enhancement_hammer',1,350],['minecraft:coal',8,24],['minecraft:stone_axe',1,25],[N+'hardened_battleaxe',1,220]],hwiyeon:[[N+'herb_bandage',1,25],['minecraft:potion',1,35,{Potion:'minecraft:healing'}],['minecraft:honey_bottle',1,30]],
 ski:[['minecraft:wooden_sword',1,10],['minecraft:stone_axe',1,25],['minecraft:shield',1,60]],harin:[['minecraft:arrow',16,25],['minecraft:leather_helmet',1,50],['minecraft:leather_boots',1,45]],
 hyeophap:[['minecraft:paper',8,16],['minecraft:brush',1,50],['minecraft:lantern',1,40]],bambam:[['minecraft:compass',1,70],['minecraft:blue_dye',4,15],['minecraft:flower_pot',1,15],['comforts:sleeping_bag_white',1,80]]};
 var SELL={
 hess:{'minecraft:emerald':100},darim:{'minecraft:wheat':2,'minecraft:potato':2,'minecraft:carrot':2,'minecraft:beetroot':2,'farmersdelight:cabbage':3,'farmersdelight:tomato':3,'minecraft:hay_block':18,'minecraft:sweet_berries':1},
 roman:{'minecraft:dandelion':2,'minecraft:allium':3,'minecraft:glow_berries':2,'minecraft:red_mushroom':3,'minecraft:brown_mushroom':3,'minecraft:amethyst_shard':5,'minecraft:spider_eye':3},
 gori:{'minecraft:cod':4,'minecraft:salmon':4,'minecraft:tropical_fish':5,'minecraft:beef':3,'minecraft:porkchop':3,'minecraft:chicken':3,'f_rank_days:brion_barley_bread':6,'f_rank_days:harvest_berry_tart':10,'f_rank_days:hearth_potato_soup':12,'f_rank_days:golden_wheat_stew':20,'f_rank_days:alchemist_clear_tea':9,'f_rank_days:serdin_herb_ration':10,'minecraft:cooked_cod':6,'minecraft:cooked_salmon':6,'farmersdelight:vegetable_soup':10,'farmersdelight:fish_stew':12,'farmersdelight:beef_stew':12,'farmersdelight:chicken_soup':12,'farmersdelight:cooked_rice':5,'farmersdelight:stuffed_potato':8,'farmersdelight:pasta_with_meatballs':14,'farmersdelight:pasta_with_mutton_chop':14,'farmersdelight:noodle_soup':12,'farmersdelight:rice_roll_medley_block':14},
 nau:{'minecraft:coal':2,'minecraft:raw_iron':5,'minecraft:raw_copper':3,'minecraft:raw_gold':6,'minecraft:iron_ore':5,'minecraft:deepslate_iron_ore':5,'minecraft:copper_ore':3,'minecraft:deepslate_copper_ore':3,'minecraft:gold_ore':6,'minecraft:deepslate_gold_ore':6,'minecraft:iron_ingot':6,'minecraft:copper_ingot':4,'minecraft:gold_ingot':8,'f_rank_days:raw_mana_crystal':7,'f_rank_days:raw_hardened_ore':7},
 hwiyeon:{'minecraft:white_wool':4,'minecraft:glistering_melon_slice':7,'minecraft:honey_bottle':6,'minecraft:dandelion':2},ski:{'minecraft:rotten_flesh':1,'minecraft:bone':2,'minecraft:arrow':1},
 harin:{'minecraft:leather':4,'minecraft:feather':2,'minecraft:cobweb':5,'minecraft:string':2,'minecraft:spider_eye':3},hyeophap:{'f_rank_days:ancient_rubbing_sheet':8,'minecraft:pottery_sherd':8,'minecraft:angler_pottery_sherd':8,'minecraft:archer_pottery_sherd':8,'minecraft:moss_block':2,'minecraft:iron_nugget':1},bambam:{'minecraft:lapis_lazuli':3,'minecraft:quartz':3,'minecraft:nautilus_shell':12}};
 BUY.bambam[0]=[F.getExplorationCompassItemV99(),1,250];
 F.NPC_SELL_CATALOG_V96=SELL;F.NPC_BUY_CATALOG_V96=BUY;
 for(var npc in EMPTY)if(F.NPC_DIALOG_DEFS[npc])F.NPC_DIALOG_DEFS[npc].buttons=main();
 var oldNear=F.verifyPlayerNearNpc;
 F.verifyPlayerNearNpc=function(p,n,entity,max){
   if(!captain(n))return oldNear(p,n,entity,max);
   var c=F.getMainlandSailingNpcV96&&F.getMainlandSailingNpcV96(p.server,n);
   if(!c||String(p.level.dimension)!==c.dimension)return{ok:false,reason:'wrong_sailing_dimension'};
   if(entity){
     if(!F.hasEntityTag(entity,'npc_'+n)||String(entity.level.dimension)!==c.dimension)return{ok:false,reason:'wrong_captain_entity'};
     var ex=Number(entity.x)-c.x,ey=Number(entity.y)-c.y,ez=Number(entity.z)-c.z;
     if(ex*ex+ey*ey+ez*ez>16)return{ok:false,reason:'captain_out_of_position'};
   }
   var dx=Number(p.x)-c.x,dy=Number(p.y)-c.y,dz=Number(p.z)-c.z;
   return dx*dx+dy*dy+dz*dz<=Math.pow(max||8.5,2)?{ok:true}:{ok:false,reason:'too_far_from_captain'};
 };
 ['marco','marco_mainland'].forEach(function(id){var d=JSON.parse(JSON.stringify(F.NPC_DIALOG_DEFS.hess));d.npc_id=id;d.name='마르코';d.job_grade_badge='본토 정기선 선장';d.affiliation='아르베른 정기선';d.subtitle='남항과 본토를 잇는 항해';d.portrait_is_placeholder=true;d.greetings={default:'출항 자격과 목적지를 확인해 보겠나?'};d.talk_pages=['허가증을 분실해도 길드 원부에 도항 자격이 남아 있으면 승선할 수 있네.'];d.preferred_gifts=[];d.shop_items=[];d.buttons=main(id);F.NPC_DIALOG_DEFS[id]=d;});
 F.buildNpcDialogPayload=function(p,s,n,text,buttons,page){var out=oldPayload(p,s,n,text,buttons,page);for(var i=0;i<out.buttons.length;i++)if(out.buttons[i].action==='OPEN_PROMOTION_EXAM'&&F.getPromotionDialogButtonV106){var exam=F.getPromotionDialogButtonV106(p,n);exam.index=i+1;out.buttons[i]=exam;}out.role_menu=out.buttons.length===5&&out.buttons[0].action==='ACTION_MENU_TALK'&&out.buttons[4].action==='OPEN_PROMOTION_EXAM';out.buttons_json=JSON.stringify(out.buttons);out.view='MAIN';return out;};
 function captainText(p,n){var s=F.loadPlayerState(p),destination=n==='marco'?'본토 아르베른 전초 항구성':'브리온 남항';return destination+'행 정기선입니다.\n'+(s.mainland_sailing_unlocked?'길드 도항 자격이 확인되었습니다. 준비되면 승선해 주세요.':'헤스에게 수호자 토벌 기록을 인정받거나 생활·탐험 D급 공납을 완료하면 도항할 수 있습니다.');}
 F.openNpcRpgDialog=function(p,n,opts){
   if(captain(n)){
     var nearCaptain=F.verifyPlayerNearNpc(p,n,opts&&opts.targetEntity,8.5);if(!nearCaptain.ok)return nearCaptain;
     var ns=F.loadPlayerState(p);if(ns.guild_card.awaiting_name_input&&!ns.guild_card.issued)return fail('guild_card_input_active','등록증 서명을 먼저 마쳐 주세요.');
     if(!ns.relationships[n])ns.relationships[n]={affinity:0,stage:1,stage_id:'acquaintance',relation_type:'none',flags:{first_met:false}};
     ns.relationships[n].flags=ns.relationships[n].flags||{};ns.relationships[n].flags.first_met=true;
     ns.npc_dialog.open=true;ns.npc_dialog.active_npc_id=n;ns.npc_dialog.opened_at=Date.now();ns.npc_dialog.page=0;F.savePlayerState(p,ns);
     return say(p,n,captainText(p,n),main(n),'MAIN',true);
   }
   if(n==='hess'){
     var near=F.verifyPlayerNearNpc(p,n,opts&&opts.targetEntity,8.5);if(!near.ok)return near;var s=F.loadPlayerState(p);
     if(!s.guild_card.issued||!s.starter_onboarding.first_registration_completed){
       s.npc_dialog.open=true;s.npc_dialog.active_npc_id='hess';s.npc_dialog.opened_at=Date.now();s.relationships.hess.flags.first_met=true;s.starter_onboarding.quests.q01_first_day.talked_hess=true;s.starter_onboarding.guild_registration_unlocked=true;F.savePlayerState(p,s);F.syncFtbQuestStagesForPlayer(p);
       var text='어라, 처음 뵙는 얼굴이네요. 이곳 브리온 마을에는 오늘 처음 오신 건가요?\n아직 길드 신분 등록이 안 되어 계신데, 지금 바로 첫 직업과 F급 체질 등록을 도와드릴까요?';
       var opened=say(p,n,text,[button('first','네, 브리온에 처음 왔습니다 (등록 시작·이어하기)','V96_FIRST_START'),button('later','잠시 마을부터 둘러보고 올게요','CLOSE')],'HESS_INTRO',true);if(opened.ok&&F.onCompendiumNpcTalkCommittedV99)F.onCompendiumNpcTalkCommittedV99(p,n);return opened;
     }
   }return oldOpen(p,n,opts);
 };
 F.processNpcGiftAction=function(p,n){if(F.flushCompendiumGiftV99){var flushed=F.flushCompendiumGiftV99(p);if(!flushed.ok)return flushed;}var s=F.loadPlayerState(p),r=s.relationships[n],today=day(p);if(!r)return fail('unknown_npc');if(r.last_gift_game_day===today)return{ok:false,text:'오늘 선물은 이미 받았습니다.',reason:'daily_gift_done'};var held=p.mainHandItem,id=String(held.id),def=F.NPC_DIALOG_DEFS[n];if(held.empty||id.indexOf('_license_')>=0||id===N+'guild_citizen_card'||id===N+'mainland_sailing_permit'||F.getWeaponEnhanceLevel&&F.getWeaponEnhanceLevel(held)>0)return{ok:false,text:'선물할 일반 물품을 오른손에 들어 주세요.',reason:'invalid_gift'};
   var reaction=F.getCompendiumGiftReactionV99&&F.getCompendiumGiftReactionV99(n,id);
   var result=F.runAtomicPlayerV96(p,function(){
     var selected=Number(p.inventory.selected);if(selected%1||selected<0||selected>8||!held.equals(p.inventory.getItem(selected)))return fail('gift_hand_changed');
     var before=Number(held.count),tag=String(held.nbt||'');held.shrink(1);var actual=p.inventory.getItem(selected);
     if(Number(actual.count)!==before-1||before>1&&(String(actual.id)!==id||String(actual.nbt||'')!==tag))return fail('gift_consumption_failed');
     s=F.loadPlayerState(p);s.relationships[n].last_gift_game_day=today;var oldAffinity=Number(s.relationships[n].affinity||0);F.savePlayerState(p,s);var gain=reaction?reaction.delta:(def.preferred_gifts||[]).indexOf(id)>=0?8:3,affinity=F.addNpcAffinity(p,n,gain);if(!affinity||!affinity.ok)return fail('gift_affinity_failed');if(F.queueCompendiumGiftV99){var queued=F.queueCompendiumGiftV99(p,n,id,reaction);if(!queued.ok)return queued;}return{ok:true,item_id:id,npc_id:n,reaction:reaction&&reaction.reaction,delta:gain,actual_affinity_delta:Number(affinity.affinity)-oldAffinity,text:'선물을 받았습니다. (호감도 '+(gain>0?'+':'')+gain+')'};
   });
   if(result&&result.ok&&F.flushCompendiumGiftV99)try{F.flushCompendiumGiftV99(p);}catch(error){console.warn('[F-Craft compendium] committed gift memo pending: '+error);}return result;
 };
 function saleTotalPhase4(p,n,id,price,count){var m=typeof F.getProfessionSaleMultiplierPhase4==='function'?Number(F.getProfessionSaleMultiplierPhase4(p,id,n)):1;if(!isFinite(m)||m<1||m>1.25)m=1;return Math.floor(price*count*m+0.000001);}
 function listShop(p,n,sell,page){var bs=[],entries=[],text=sell?'직종에 맞는 물품만 매입합니다.':n==='nau'?'단조 물품과 수리 지원입니다. 강화·계승은 위 탭에서 이용하세요.':'물품과 가격을 확인하세요.',map=SELL[n]||{},all=BUY[n]||[];
   if(sell){for(var key in map){if(!Item.exists(key))continue;var count=F.countPlayerItem(p,key);if(count>0)entries.push({id:key,count:Math.min(64,count),price:map[key]});}}
   else for(var i=0;i<all.length;i++)if(Item.exists(all[i][0]))entries.push({index:i,id:all[i][0],count:all[i][1],price:all[i][2]});
   // Two lines leave a dependable back button even when both bundles offer a
   // single-unit purchase. Nau reserves one further slot for repair.
   var size=n==='nau'&&!sell?1:2;page=Math.max(0,Math.floor(Number(page)||0));var pages=Math.max(1,Math.ceil(entries.length/size));page=page%pages;var start=page*size;
   for(var j=start;j<entries.length&&j<start+size;j++){var e=entries[j],label=itemLabelV98(e.id)+' ×'+e.count+' · '+F.formatCurrencyV8(sell?saleTotalPhase4(p,n,e.id,e.price,e.count):e.price);bs.push(button('trade_'+j,label,sell?'V96_SELL':'V96_BUY',sell?e.id+'|'+e.count:String(e.index)));if(!sell&&e.count>1)bs.push(button('unit_'+j,itemLabelV98(e.id)+' 1개 · '+F.formatCurrencyV8(Math.ceil(e.price/e.count)),'V96_BUY',String(e.index)+'|unit'));}
   if(pages>1)bs.push(button('next','다음 품목 '+(page+1)+'/'+pages,sell?'V96_SELL_PAGE':'V96_BUY_PAGE',String(page+1)));
   if(!sell&&n==='nau'){bs.push(button('repair','오른손 연장 수리','V96_NAU_REPAIR'));if(typeof F.hasPassivePhase4==='function'&&F.hasPassivePhase4(p,'blacksmith',7)&&typeof F.craftEfficientNectarPhase4==='function')bs.push(button('nectar_master','대가의 유황 넥타르 단조','V4_NAU_NECTAR'));}
   bs.push(back());return say(p,n,text+'\n보유: '+F.getPlayerBalanceSummaryV8(p).formatted_total,bs,sell?'SELL':'BUY');
 }
 function trade(p,n,sell,sub){var result=F.runAtomicPlayerV96(p,function(){
   if(sell){var a=String(sub).split('|'),id=a[0],count=Number(a[1]),price=(SELL[n]||{})[id];if(!price||count%1||count<1||count>64||F.countPlayerItem(p,id)<count)return fail('invalid_sale');if(!F.consumePlayerItemExact(p,id,count))return fail('sale_consumption_failed');var total=saleTotalPhase4(p,n,id,price,count),payment=F.grantPlayerCurrencyV8(p,total,false);if(!payment||!payment.ok)return fail('sale_currency_failed');var state=F.loadPlayerState(p);state.first_profession_sale_v96=true;F.savePlayerState(p,state);F.grantPlayerStageOnce(p,'frank_v96_first_sale');return{ok:true,item_id:id,count:count,copper:total,message:'판매 대금 '+F.formatCurrencyV8(total)+'를 지갑에 넣었습니다.'};}
   var choice=String(sub).split('|'),index=Number(choice[0]),unit=choice[1]==='unit',catalog=BUY[n]||[],b=catalog[index];if(!b||index%1||index<0||choice.length>1&&!unit||!Item.exists(b[0]))return fail('invalid_purchase');var pay=F.chargePlayerCurrencyV8(p,unit?Math.ceil(b[2]/b[1]):b[2]);if(!pay.ok)return pay;p.give(Item.of(b[0],unit?1:b[1],b[3]||{}));if(F.loadPlayerState(p).special_ability.ability_id==='hoarder_greed')F.applyTraitModifiersV96(p);return{ok:true,message:'구매했습니다.'};
 });if(sell&&result&&result.ok&&F.onCompendiumSaleCommittedV99)F.onCompendiumSaleCommittedV99(p,result);return result;}
 F.canSubmitMainlandContributionV110=function(s){var primary=F.resolvePrimaryRegisteredJob(s);return !!primary&&F.GRADE_ORDER.indexOf(String(primary.grade))>=F.GRADE_ORDER.indexOf('D');};
 function hasD(s){return F.canSubmitMainlandContributionV110(s);}
 var contributionFoodsV99={soup:N+'hearth_potato_soup',bread:N+'brion_barley_bread'},contributionMetalsV99={iron:'minecraft:iron_ingot',hardened:N+'hardened_ingot'};
 function contributionMenuV99(p){var bs=[];for(var food in contributionFoodsV99)for(var metal in contributionMetalsV99)bs.push(button('contribute_'+food+'_'+metal,(food==='soup'?'수프':'보리빵')+'16 + '+(metal==='iron'?'철':'경화광')+'8 + 30실버','V96_CONTRIBUTE','supply:'+food+':'+metal));bs.push(back());return say(p,'hess','식량과 금속을 한 종류씩 골라 납품해 주세요.\n식량16개 + 주괴8개 + 지갑30실버가 필요합니다.',bs,'QUESTS');}
 F.submitMainlandContributionV96=function(p,route){
   var result=F.runAtomicPlayerV96(p,function(){
     var q=F.loadPlayerState(p),items=[],choice=String(route||'').split(':'),kind=choice[0];
     // These checks belong inside the same lock as payment and permit issuance.
     if(q.mainland_sailing_unlocked)return fail('already_unlocked','이미 본토 도항 자격을 보유하고 있습니다.');
     if(!hasD(q))return fail('requires_primary_d_grade','주직종 D급 이상이 필요합니다.');
     if(kind==='supply'){
       var food,metal;
       if(choice.length===1){food=F.countPlayerItem(p,contributionFoodsV99.soup)>=16?'soup':'bread';metal=F.countPlayerItem(p,contributionMetalsV99.iron)>=8?'iron':'hardened';}
       else if(choice.length===3){food=choice[1];metal=choice[2];}
       if(!contributionFoodsV99[food]||!contributionMetalsV99[metal])return fail('invalid_route','납품할 식량과 주괴 종류를 다시 선택해 주세요.');
       items=[{id:contributionFoodsV99[food],count:16},{id:contributionMetalsV99[metal],count:8}];
     }else if(kind==='records'&&choice.length===1){
       if(Number(q.serdin_caches_found||0)<10)return fail('requires_ten_caches','은닉처 10곳 발견 기록이 필요합니다.');
       items=[{id:N+'refined_mana_stone',count:12}];
     }else return fail('invalid_route');
     if(Number(F.ensurePlayerEconomyStateV8(q).wallet_copper)<300)return fail('insufficient_wallet','지갑 공탁금 30실버(300동화)가 필요합니다.');
     for(var i=0;i<items.length;i++)if(F.countPlayerItem(p,items[i].id)<items[i].count)return fail('insufficient_contribution_items','선택한 공납 물자가 부족합니다.');
     for(var k=0;k<items.length;k++)if(!F.consumePlayerItemExact(p,items[k].id,items[k].count))return fail('contribution_consumption_failed','공납 물자를 차감하지 못했습니다.');
     q=F.loadPlayerState(p);q.economy.wallet_copper-=300;q.mainland_contribution_route_v96=kind;q.mainland_contribution_items_v99=items;
     F.appendWalletHistoryV96(p,q,-300,'본토 개척단 공탁금','payment');F.savePlayerState(p,q);
     return F.unlockMainlandSailingV96(p,'contribution');
   });
   if(result&&result.ok&&F.onChapter1ContributionCommittedV10)F.onChapter1ContributionCommittedV10(p,result);
   return result;
 };
 function legacyArchive(p){return typeof F.getLegacyExamArchiveV98==='function'?F.getLegacyExamArchiveV98(p):[];}
 function legacyRecordLine(record){var r=record||{},labels={WRITTEN:'필기',PRACTICAL:'실기',PASSED:'통과',IN_PROGRESS:'진행 중',COMPLETED:'완료',FAILED:'불합격'},parts=[],status=labels[String(r.status||'')],phase=labels[String(r.phase||'')],grade=String(r.grade||'');if(/^[FEDCBAS]$/.test(grade))parts.push(grade+'급');if(status)parts.push(status);if(phase&&phase!==status)parts.push(phase);if(typeof r.progress==='number'&&isFinite(r.progress)&&r.progress>=0)parts.push('기록 '+Math.floor(r.progress)+'회');return parts.length?parts.join(' · '):'상태 기록 보존';}
 function showLegacyArchive(p,n){var records=legacyArchive(p),s=F.loadPlayerState(p),lines=['기존 기록을 보존했습니다. 새 직업의 실기 내용은 별도 심사입니다.'];
   for(var i=0;i<records.length;i++){var e=records[i],r=e.record||{},source=(F.JOB_LABELS||{})[e.legacy_job]||'이전 직업',target=(F.JOB_LABELS||{})[e.target_job]||'변경 직업',license=s.job_licenses[e.target_job],grade=license&&String(license.grade||'');lines.push(source+' → '+target+(grade&&grade!=='UNREGISTERED'?' · 현재 '+grade+'급':''));if(r.job_exam)lines.push('기존 승급 심사: '+legacyRecordLine(r.job_exam));var count=0;for(var key in (r.active_exams||{})){count++;if(count<=3)lines.push('기존 실기 '+count+': '+legacyRecordLine(r.active_exams[key]));}if(count>3)lines.push('그 외 실기 기록 '+(count-3)+'건 보존');if(r.written_session)lines.push('기존 필기 접수: '+legacyRecordLine(r.written_session));}
   return say(p,n,lines.join('\n'),[button('archive_back','◀ 의뢰 목록','ACTION_CHECK_QUESTS')],'LEGACY_EXAM_RECORD');
 }
 function guildWorkMenuV106(p){var s=F.loadPlayerState(p),bs=[];if(legacyArchive(p).length)bs.push(button('legacy_records','기존 심사 기록 열람','V98_LEGACY_EXAM_RECORD'));bs.push(button('extra','부직업 추가 F급 등록','V96_ADDITIONAL'));if(s.legacy_trait_reselect_available)bs.push(button('legacy_trait','구버전 특성 1회 재선택','V96_RESELECT'));if(s.mainland_sailing_unlocked&&F.countPlayerItem(p,N+'mainland_sailing_permit')===0)bs.push(button('permit','도항 허가증 무료 재발급','V96_PERMIT'));if(F.getPersonalMountProfileV110&&F.getPersonalMountProfileV110(p).registered)bs.push(button('mount_whistle','개인 군마 호각 무료 재발급','V110_MOUNT_RECLAIM'));bs.push(back());return say(p,'hess','길드 등록과 보존 문서를 확인하세요. 승급 심사는 각 직종의 담당 스승에게 받습니다.',bs,'GUILD_WORK');}
 function questMenu(p,n){var s=F.loadPlayerState(p),bs=[];
   if(n==='hess'){
     if(!s.mainland_sailing_unlocked&&hasD(s)){bs.push(button('supply','생활 보급 공납: 식량·주괴 선택','V99_CONTRIBUTION_MENU'));bs.push(button('records','탐사 공납: 은닉처10·정제마력석12·30실버','V96_CONTRIBUTE','records'));}
     var b=F.ensurePlayerBossStateV8?F.ensurePlayerBossStateV8(s):null;if(b&&b.quests.ferrous_wroughtnaut.first_cleared&&!b.quests.ferrous_wroughtnaut.first_reward_claimed)bs.push(button('boss','강철 수호자 첫 토벌 보고','V8_HESS_BOSS_REWARD'));
   }
   // Existing personal story handlers stay reachable when their real affinity gate is met.
   var pq=s.personal_quests&&s.personal_quests[n];if(pq&&s.relationships[n]&&s.relationships[n].affinity>=60)bs.push(button('story','개인 사건 의뢰','QUEST_ACTION'));
   if(!bs.length)return say(p,n,EMPTY[n]||'지금 맡길 의뢰는 없습니다.',[back()],'QUESTS');bs.push(back());return say(p,n,'진행할 의뢰를 선택하세요.',bs,'QUESTS');
 }
 F.handleNpcDialogAction=function(p,data,opts){data=data||{};var s=F.loadPlayerState(p),npc=String(data.npc_id||s.npc_dialog.active_npc_id||''),action=String(data.action||''),sub=String(data.sub_id||'');
   if(action==='CLOSE')return F.closeNpcRpgDialog(p,false);
   if(!s.npc_dialog.open||s.npc_dialog.active_npc_id!==npc)return fail('dialog_not_active');var offered=null,buttons=s.npc_dialog.active_buttons||[];
   for(var i=0;i<buttons.length;i++){var b=buttons[i];if(data.button_id?String(b.id)===String(data.button_id):b.action===action&&String(b.sub_id||'')===sub){offered=b;break;}}
   if(!offered)return fail('button_not_offered');if(offered.enabled===false)return fail('오늘 이미 완료한 활동입니다.');action=offered.action;sub=String(offered.sub_id||'');var near=F.verifyPlayerNearNpc(p,npc,null,9);if(!near.ok)return near;
   if(action==='OPEN_PROMOTION_EXAM'||action==='V96_JOB_EXAM'||action==='OPEN_EXAM_MENU')return F.openPromotionExamScreenV106?F.openPromotionExamScreenV106(p,npc,sub):fail('exam_not_loaded');
   if(captain(npc)){
     if(action==='V96_SAIL'){var sailing=typeof F.handleMainlandSailingV96==='function'?F.handleMainlandSailingV96(p,npc):fail('mainland_not_installed','본토 항로를 준비하고 있습니다. 1장 완결 증서와 브리온의 자유 성장은 계속 보존됩니다.');if(sailing&&sailing.ok){F.closeNpcRpgDialog(p,true);return sailing;}return say(p,npc,sailing&&sailing.message||captainText(p,npc),main(npc),'MAIN');}
     if(action==='V96_BACK'||action==='BACK_MAIN')return say(p,npc,captainText(p,npc),main(npc),'MAIN');
     if(action==='ACTION_MENU_TALK')return say(p,npc,'허가증을 잃어도 길드 원부에 도항 자격이 남아 있으면 승선할 수 있습니다.',[back()],'TALK');
     if(action==='V99_MARCO_ROUTE')return say(p,npc,npc==='marco'?'브리온 남항에서 본토 아르베른 전초 항구성으로 향합니다. 귀환 정기선도 같은 항구에서 이용할 수 있습니다.':'이 정기선은 브리온 남항으로 돌아갑니다. 본토 항구에서 대륙의 성채와 야생 지역으로 출발할 수 있습니다.',[back()],'TALK');
     if(action==='ACTION_CHECK_QUESTS')return say(p,npc,captainText(p,npc)+'\n도항 자격 신청과 허가증 재발급은 브리온 길드의 헤스에게 문의해 주세요.',[back()],'QUESTS');
     return fail('captain_action_not_supported');
   }
   if(action==='V99_CONTRIBUTION_MENU'&&npc==='hess')return contributionMenuV99(p);
   if(action==='V96_FIRST_START')return F.beginRegistrationV96(p,'FIRST');
   if(action==='V96_ADDITIONAL')return F.beginRegistrationV96(p,'ADDITIONAL');
   if(action==='V96_RESELECT')return F.beginRegistrationV96(p,'LEGACY_RESELECT');
   if(action==='V96_BACK'||action==='BACK_MAIN')return say(p,npc,F.selectNpcGreetingText(F.NPC_DIALOG_DEFS[npc],s,npc),main(npc),'MAIN');
   if(action==='V96_SAIL'&&(npc==='marco'||npc==='marco_mainland'))return typeof F.handleMainlandSailingV96==='function'?F.handleMainlandSailingV96(p,npc):fail('mainland_not_installed','본토 항로를 준비하고 있습니다. 1장 완결 증서를 보관해 주세요.');
   if(action==='ACTION_MENU_TALK'){var r=s.relationships[npc],today=day(p),talkButtons=[button('daily_talk',r.last_talk_game_day===today?'대화하기 (오늘 완료)':'대화하기','V96_TALK','',r.last_talk_game_day!==today,'오늘 완료'),button('daily_gift',r.last_gift_game_day===today?'선물하기 (오늘 완료)':'선물하기 (오른손 아이템)','V96_GIFT','',r.last_gift_game_day!==today,'오늘 완료')];if(npc==='hess')talkButtons.push(button('guild_work','길드 업무 · 부직업 등록','V106_HESS_GUILD_WORK'));talkButtons.push(back());return say(p,npc,'오늘의 이야기를 나누거나 오른손의 선물을 건네세요.',talkButtons,'TALK');}
   if(action==='V106_HESS_GUILD_WORK'&&npc==='hess')return guildWorkMenuV106(p);
   if(action==='V110_MOUNT_RECLAIM'&&npc==='hess'&&F.reclaimPersonalMountWhistleV110){var mountReclaim=F.reclaimPersonalMountWhistleV110(p,'hess');return say(p,npc,mountReclaim.message||(mountReclaim.ok?'개인 호각을 확인했습니다. 인벤토리에 넣고 [F8] 키로 군마를 불러 보세요.':mountReclaim.reason),[button('mount_back','길드 업무로','V106_HESS_GUILD_WORK'),back()],'GUILD_WORK');}
   if(action==='V96_TALK'){var rel=s.relationships[npc];if(rel.last_talk_game_day===day(p))return fail('daily_talk_done');rel.last_talk_game_day=day(p);F.savePlayerState(p,s);F.addNpcAffinity(p,npc,2);var def=F.NPC_DIALOG_DEFS[npc],pages=def.talk_pages||[];return say(p,npc,pages.length?pages[day(p)%pages.length]:F.selectNpcGreetingText(def,F.loadPlayerState(p),npc),[back()],'TALK');}
   if(action==='V96_GIFT'){var gift=F.processNpcGiftAction(p,npc);return say(p,npc,gift.text||gift.message,[back()],'TALK');}
   if(action==='ACTION_OPEN_BUY_SHOP'||action==='V96_BUY_PAGE'||action==='V98_NAU_ITEMS'&&npc==='nau')return listShop(p,npc,false,sub);
   if(action==='ACTION_OPEN_SELL_SHOP'||action==='V96_SELL_PAGE')return listShop(p,npc,true,sub);
   if(action==='V96_BUY'||action==='V96_SELL'){var res=trade(p,npc,action==='V96_SELL',sub);return say(p,npc,res.message||res.reason,[button('shop_again','계속 거래',action==='V96_SELL'?'ACTION_OPEN_SELL_SHOP':'ACTION_OPEN_BUY_SHOP'),back()],'TRADE_RESULT');}
   if(action==='ACTION_CHECK_QUESTS')return questMenu(p,npc);
   if(action==='V98_LEGACY_EXAM_RECORD'&&npc==='hess'&&legacyArchive(p).length)return showLegacyArchive(p,npc);
   if(action==='V96_NAU_FORGE'&&npc==='nau')return F.openNauForgeAndInheritGuiV82(p,'ENHANCE','NAU');
   if(action==='V10_NAU_HEIRLOOM'&&npc==='nau'&&F.openHeirloomNameGuiV10)return F.openHeirloomNameGuiV10(p);
   if(action==='V4_NAU_NECTAR'&&npc==='nau'){if(typeof F.hasPassivePhase4!=='function'||!F.hasPassivePhase4(p,'blacksmith',7)||typeof F.craftEfficientNectarPhase4!=='function')return fail('blacksmith_master_required');var nectar=F.craftEfficientNectarPhase4(p);return say(p,npc,nectar.message||(nectar.ok?'대가의 단조로 유황 넥타르를 완성했습니다.':nectar.reason),[button('nectar_back','단조 물품으로','V98_NAU_ITEMS'),back()],'BUY');}
   if(action==='V96_NAU_REPAIR'&&npc==='nau'){var repair=F.interactWithBrionNpc(p,'nau','repair');return say(p,npc,repair.message,[back()],'BUY');}
   if(action==='V96_PERMIT'&&npc==='hess'&&s.mainland_sailing_unlocked){if(!F.countPlayerItem(p,N+'mainland_sailing_permit'))p.give(N+'mainland_sailing_permit');return questMenu(p,npc);}
   if(action==='V96_CONTRIBUTE'&&npc==='hess'){var contribution=F.submitMainlandContributionV96(p,sub);return say(p,npc,contribution.message||(contribution.ok?'도항 자격을 승인했습니다. 남항의 마르코를 찾아가세요.':contribution.reason),[back()],'QUESTS');}
   if(action==='V96_JOB_EXAM'&&F.openJobExamMenuV96)return F.openJobExamMenuV96(p,npc,sub);
   if(action.indexOf('V96_EXAM_')===0&&F.handleJobExamActionV96)return F.handleJobExamActionV96(p,npc,action,sub);
   // Legacy implemented story/boss/FTB exam actions are still protected by the same offered-menu gate.
   return oldAction(p,{npc_id:npc,button_id:offered.id,action:action,sub_id:sub},opts);
 };
 // The old village dispatcher lists only the ten residents; captains have
 // their own bounded normal-interaction adapter and still use the offered gate.
 ItemEvents.entityInteracted(function(e){
   if(!e.player||!e.target)return;
   var ids=['marco','marco_mainland'];for(var i=0;i<ids.length;i++)if(F.hasEntityTag(e.target,'npc_'+ids[i])){
     F.openNpcRpgDialog(e.player,ids[i],{targetEntity:e.target});e.cancel();return;
   }
 });
 F.sayNpcV96=say;F.npcBackButtonV96=back;F.npcButtonV96=button;
})(global.FRankDays);
