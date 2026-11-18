// Server-authoritative v9.6 registration, compatibility and wallet transactions.
global.FRankDays=global.FRankDays||{};
(function(F){
 var baseLoad=F.loadPlayerState,baseIssue=F.issueOrUpdateGuildCard,baseOpenCard=F.openGuildRegistrationUi;
 var locks={},migrating=false;
 function copy(x){return JSON.parse(JSON.stringify(x));}
 function uid(p){return String(p.uuid);}
 function day(p){return Math.floor(Number(p.server.overworld().getDayTime())/24000);}
 function fail(reason,message){return{ok:false,reason:reason,message:message||reason};}
 function send(p,id,data){if(p.sendData)p.sendData('f_rank_days:'+id,data);}
 function sync(p){if(F.syncFtbQuestStagesForPlayer)F.syncFtbQuestStagesForPlayer(p);if(F.syncHudV96)F.syncHudV96(p);}
 function near(p){return F.verifyPlayerNearNpc(p,'hess',null,9).ok;}
 function inventory(p){var a=[],inv=p.inventory;for(var i=0;i<inv.getContainerSize();i++)a.push(inv.getItem(i).copy());return a;}
 function restoreInv(p,a){for(var i=0;i<a.length;i++)p.inventory.setItem(i,a[i]);if(p.inventory.setChanged)p.inventory.setChanged();}
 var oldConsume=F.consumePlayerItemExact;
 F.consumePlayerItemExact=function(p,itemId,amount){
   var need=Number(amount);if(!isFinite(need)||need<0||need%1)return false;if(need===0)return true;
   var inv=p&&p.inventory;if(!inv||!inv.getContainerSize||!inv.getItem)return oldConsume(p,itemId,need);
   var before=F.countPlayerItem(p,String(itemId));if(before<need)return false;var snapshot=inventory(p),remaining=need;
   for(var i=0;i<inv.getContainerSize()&&remaining>0;i++){var stack=inv.getItem(i);if(!stack.empty&&String(stack.id)===String(itemId)){var count=Math.min(Number(stack.count),remaining);stack.shrink(count);remaining-=count;}}
   if(remaining!==0||F.countPlayerItem(p,String(itemId))!==before-need){restoreInv(p,snapshot);return false;}if(inv.setChanged)inv.setChanged();return true;
 };
 F.runAtomicPlayerV96=function(p,fn){
   var key=uid(p);if(locks[key])return fail('transaction_busy');
   locks[key]=true;var previous=copy(F.loadPlayerState(p)),items;
   try{items=inventory(p);var result=fn();if(!result||!result.ok){restoreInv(p,items);F.savePlayerState(p,previous);}return result;}
   catch(e){if(items)restoreInv(p,items);F.savePlayerState(p,previous);console.warn('[F-Craft v96] rolled back player transaction: '+String(e));return fail('transaction_rolled_back','처리가 취소되어 아이템과 지갑을 복구했습니다. 다시 시도하세요.');}
   finally{delete locks[key];}
 };
 F.loadPlayerState=function(p,srv){
   var s=baseLoad(p,srv);if(migrating)return s;var changed=false;
   s.migrations_v96=s.migrations_v96||{};
   if(!s.migrations_v96.job_alias){
     var old=s.job_licenses.alchemist,cur=s.job_licenses.herbalist;
     if(old&&old.grade!=='UNREGISTERED'){
       if(!cur||F.GRADE_ORDER.indexOf(old.grade)>F.GRADE_ORDER.indexOf(cur.grade))s.job_licenses.herbalist=F.mergeLegacyJobRecordV98?F.mergeLegacyJobRecordV98(cur,old):copy(old);
       s.legacy_import_log.push('v96:alchemist mirrored to herbalist; original retained');
     }s.migrations_v96.job_alias=true;changed=true;
   }
   var al=s.job_licenses.alchemist,herb=s.job_licenses.herbalist;
   if(al&&herb&&F.GRADE_ORDER.indexOf(al.grade)>F.GRADE_ORDER.indexOf(herb.grade)){herb.grade=al.grade;herb.promoted_at=al.promoted_at;changed=true;}
   if(al&&herb&&al.grade!=='UNREGISTERED'&&F.GRADE_ORDER.indexOf(herb.grade)>F.GRADE_ORDER.indexOf(al.grade)){al.grade=herb.grade;al.promoted_at=herb.promoted_at;changed=true;}
   var ab=s.special_ability.ability_id;
   if(F.LEGACY_TRAITS_V96[ab]){s.special_ability.legacy_ability_id=ab;s.special_ability.ability_id=F.LEGACY_TRAITS_V96[ab];s.legacy_trait_reselect_available=true;changed=true;}
   var ob=s.starter_onboarding;
   if(ob.first_registration_completed===undefined){ob.first_registration_completed=Boolean(s.guild_card.issued);changed=true;}
   if(s.guild_card.issued&&!s.registration_v96){s.registration_v96={status:'LEGACY_COMPLETE',job:s.guild_card.initial_job_id};changed=true;}
   if(s.economy&&!Array.isArray(s.economy.history_v96)){s.economy.history_v96=[];changed=true;}
   if(changed){migrating=true;try{F.savePlayerState(p,s,srv);}finally{migrating=false;}}
   return s;
 };
 F.giveFcraftV9StarterKit=F.giveStarterKitOnce=function(){return fail('registration_only_supplies','첫 등록 서명 후 직업별 보급품을 지급합니다.');};
 F.appendWalletHistoryV96=function(p,s,delta,description,kind){var eco=F.ensurePlayerEconomyStateV8(s);eco.history_v96=eco.history_v96||[];eco.history_v96.unshift({at:Date.now(),day:day(p),description:String(description),delta:Number(delta),balance:Number(eco.wallet_copper),kind:kind||'reward'});eco.history_v96=eco.history_v96.slice(0,40);};
 F.syncHudV96=function(p){var s=F.loadPlayerState(p),b=F.getPlayerBalanceSummaryV8(p),tr=F.getTraitRuntimeV96?F.getTraitRuntimeV96(p):{},arch=F.loadNewspaperArchiveV8(p.server),days=arch.edition_days_order||[],latest=days.length?Number(days[days.length-1]):-1,last=s.newspaper_last_read_day_v96===undefined?-1:Number(s.newspaper_last_read_day_v96);send(p,'sync_player_hud',{wallet_copper:b.wallet_copper,formatted_wallet:b.formatted_wallet,overloaded:!!tr.overloaded,unread_newspaper:latest>last});};
 F.openWalletV96=function(p){var s=F.loadPlayerState(p),b=F.getPlayerBalanceSummaryV8(p),d=F.decomposeCopperV8(b.wallet_copper);b.gold=d.gold;b.silver=d.silver;b.copper=d.copper;send(p,'open_wallet_ui',{schema:96,balance_json:JSON.stringify(b),history_json:JSON.stringify((s.economy.history_v96||[]).slice(0,5))});return{ok:true};};
 var grant=F.grantPlayerCurrencyV8,charge=F.chargePlayerCurrencyV8,deposit=F.depositAllCoinsToWalletV8,withdraw=F.withdrawCoinsFromWalletV8;
 function logAfter(p,result,delta,text,kind){if(result&&result.ok){var s=F.loadPlayerState(p);F.appendWalletHistoryV96(p,s,delta,text,kind);F.savePlayerState(p,s);if(s.special_ability.ability_id==='hoarder_greed'&&F.applyTraitModifiersV96)F.applyTraitModifiersV96(p);F.syncHudV96(p);}return result;}
 F.grantPlayerCurrencyV8=function(p,n,physical){var r=grant(p,n,physical);return physical?r:logAfter(p,r,Number(r.granted_copper||0),'보상 지급','reward');};
 F.chargePlayerCurrencyV8=function(p,n){return logAfter(p,charge(p,n),-Number(n),'상점·서비스 결제','payment');};
 F.depositAllCoinsToWalletV8=function(p){return F.runAtomicPlayerV96(p,function(){var r=deposit(p);return logAfter(p,r,Number(r.deposited_copper||0),'실물 주화 입금','deposit');});};
 F.withdrawCoinsFromWalletV8=function(p,n){if(!isFinite(n)||Number(n)%1||n<=0||n>100000)return fail('invalid_amount');var d=F.decomposeCopperV8(n),needed=Math.ceil(d.gold/64)+Math.ceil(d.silver/64)+Math.ceil(d.copper/64),free=0;for(var i=0;i<36;i++)if(p.inventory.getItem(i).empty)free++;if(free<needed)return fail('inventory_space_required','주화를 받을 빈칸을 확보하세요.');return F.runAtomicPlayerV96(p,function(){return logAfter(p,withdraw(p,n),-Number(n),'실물 주화 인출','withdraw');});};
 function freshSession(s,mode){var ob=s.starter_onboarding;ob.registration_draft_v96=ob.registration_draft_v96||{};var d=ob.registration_draft_v96;d.session=String(Java.loadClass('java.util.UUID').randomUUID());d.mode=mode;ob.pending_step=mode==='LEGACY_RESELECT'?'TRAIT':(d.trait&&d.job?'SIGN':d.job?'TRAIT':'JOB');return d;}
 F.beginRegistrationV96=function(p,mode){if(!near(p))return fail('too_far_from_hess');var s=F.loadPlayerState(p);if(mode==='LEGACY_RESELECT'&&!s.legacy_trait_reselect_available)return fail('reselect_unavailable');if(!mode)mode=s.guild_card.issued?'ADDITIONAL':'FIRST';if(mode==='FIRST'&&s.guild_card.issued)return fail('already_registered');if(F.closeNpcRpgDialog)F.closeNpcRpgDialog(p,true);s=F.loadPlayerState(p);var d=freshSession(s,mode);s.relationships.hess.flags.first_met=true;s.starter_onboarding.quests.q01_first_day.talked_hess=true;s.starter_onboarding.guild_registration_unlocked=true;F.savePlayerState(p,s);return mode==='LEGACY_RESELECT'?F.showTraitSelectV96(p):s.starter_onboarding.pending_step==='SIGN'?F.openOnboardingSignatureV96(p):s.starter_onboarding.pending_step==='TRAIT'?F.showTraitSelectV96(p):F.showJobSelectV96(p);};
 F.showJobSelectV96=function(p){var s=F.loadPlayerState(p),d=s.starter_onboarding.registration_draft_v96;if(!d)return fail('no_session');s.starter_onboarding.pending_step='JOB';F.savePlayerState(p,s);send(p,'open_fullscreen_job_select',{schema:96,mode:d.mode,session:d.session,selected_job:d.job||'',jobs_json:JSON.stringify(F.JOB_CATALOG_V96),support_copper:d.mode==='FIRST'?150:0});return{ok:true};};
 F.showTraitSelectV96=function(p){var s=F.loadPlayerState(p),d=s.starter_onboarding.registration_draft_v96;if(!d)return fail('no_session');s.starter_onboarding.pending_step='TRAIT';F.savePlayerState(p,s);send(p,'open_fullscreen_ability_select',{schema:96,mode:d.mode,session:d.session,selected_job:d.job||'',selected_trait:d.trait||s.special_ability.ability_id||'',traits_json:JSON.stringify(F.TRAIT_CATALOG_V96)});return{ok:true};};
 function checkSession(p,data,steps){var s=F.loadPlayerState(p),d=s.starter_onboarding.registration_draft_v96;if(!d||String(data.session)!==d.session||steps.indexOf(s.starter_onboarding.pending_step)<0)return null;return near(p)?s:null;}
 F.selectJobDraftV96=function(p,data){var s=checkSession(p,data,['JOB']);if(!s)return fail('invalid_registration_session');var job=String(data.job_id),def=F.JOB_BY_ID_V96[job];if(!def)return fail('unknown_job');var d=s.starter_onboarding.registration_draft_v96;
   if(s.job_licenses[job].grade!=='UNREGISTERED')return fail('already_registered');d.job=job;
   if(d.mode==='ADDITIONAL'){s.job_licenses[job].grade='F';s.job_licenses[job].registered_at=Date.now();s.starter_onboarding.pending_step=null;delete s.starter_onboarding.registration_draft_v96;F.savePlayerState(p,s);F.giveJobCertificateV96(p,job,'F');send(p,'close_fullscreen_onboarding',{});sync(p);return{ok:true,additional:true};}
   F.savePlayerState(p,s);return F.showTraitSelectV96(p);
 };
 F.selectTraitDraftV96=function(p,data){var s=checkSession(p,data,['TRAIT']);if(!s)return fail('invalid_registration_session');var id=String(data.ability_id);if(!F.F_RANK_TRAITS_V95[id])return fail('unknown_trait');var d=s.starter_onboarding.registration_draft_v96;
   if(d.mode==='LEGACY_RESELECT'){if(!s.legacy_trait_reselect_available)return fail('reselect_unavailable');s.special_ability.ability_id=id;s.legacy_trait_reselect_available=false;s.special_ability.reselected_at=Date.now();delete s.starter_onboarding.registration_draft_v96;s.starter_onboarding.pending_step=null;F.savePlayerState(p,s);if(F.applyTraitModifiersV96)F.applyTraitModifiersV96(p);send(p,'close_fullscreen_onboarding',{});sync(p);return{ok:true};}
   if(!d.job||d.mode!=='FIRST')return fail('missing_job');d.trait=id;s.starter_onboarding.pending_step='SIGN';F.savePlayerState(p,s);return F.openOnboardingSignatureV96(p);
 };
 F.openOnboardingSignatureV96=function(p){var s=F.loadPlayerState(p),d=s.starter_onboarding.registration_draft_v96;if(!d||!d.job||!d.trait||s.guild_card.issued||!near(p))return fail('missing_registration_draft');s.starter_onboarding.pending_step='SIGN';s.guild_card.ui_open=true;s.guild_card.awaiting_name_input=true;s.guild_card.pending_serial=F.getOrGenerateCardSerial(s);F.savePlayerState(p,s);send(p,'open_guild_card_ui',{mode:'INPUT',step:3,session:d.session,empire_header:F.GUILD_EMPIRE_HEADER,serial:s.guild_card.pending_serial,grade:'F',ability:F.F_RANK_TRAITS_V95[d.trait].label,job:F.JOB_LABELS[d.job],issuer:F.GUILD_ISSUER_NAME,default_nickname:String(p.username).slice(0,16),name:String(p.username).slice(0,16)});return{ok:true};};
 F.openGuildRegistrationUi=function(p,mode,now){var s=F.loadPlayerState(p);if((!mode||mode==='INPUT')&&!s.guild_card.issued)return F.openOnboardingSignatureV96(p);return baseOpenCard(p,mode,now);};
 F.unlockJobSkillCategoryV96=function(p,job){if(!Platform.isLoaded('puffish_skills'))return false;var API=Java.loadClass('net.puffish.skillsmod.api.SkillsAPI'),RL=Java.loadClass('net.minecraft.resources.ResourceLocation'),cat=API.getCategory(new RL('f_rank_days:'+job));if(!cat.isPresent())return false;cat.get().unlock(p.minecraftPlayer||p);return cat.get().isUnlocked(p.minecraftPlayer||p);};
 F.giveJobCertificateV96 = function(p,job,grade){p.give(Item.of('f_rank_days:'+job+'_license_'+grade.toLowerCase(),{JobId:job,Grade:grade,HolderUUID:uid(p),HolderName:String(p.username)}));F.unlockJobSkillCategoryV96(p,job);if(grade==='F'){if(typeof F.reconcileJobPointsPhase4==='function')F.reconcileJobPointsPhase4(p,job);else{var s=F.loadPlayerState(p);s.phase4_points_pending=s.phase4_points_pending||{};s.phase4_points_pending[job]=true;F.savePlayerState(p,s);}}};
 F.migrateLegacySkillTreeV96=function(p){
   var s=F.loadPlayerState(p);if(s.migrations_v96.alchemist_skills||!s.job_licenses.alchemist||s.job_licenses.alchemist.grade==='UNREGISTERED'||!Platform.isLoaded('puffish_skills'))return false;
   var API=Java.loadClass('net.puffish.skillsmod.api.SkillsAPI'),RL=Java.loadClass('net.minecraft.resources.ResourceLocation'),old=API.getCategory(new RL('f_rank_days:alchemist')),next=API.getCategory(new RL('f_rank_days:herbalist'));if(!old.isPresent()||!next.isPresent())return false;var a=old.get(),b=next.get(),raw=p.minecraftPlayer||p;
   if(a.isUnlocked(raw))b.unlock(raw);var sources=a.streamPointsSources(raw).iterator();while(sources.hasNext()){var src=sources.next();b.setPoints(raw,src,Math.max(Number(a.getPoints(raw,src)),Number(b.getPoints(raw,src))));}
   b.setExtraPoints(raw,Math.max(Number(a.getExtraPoints(raw)),Number(b.getExtraPoints(raw))));var skills=a.streamUnlockedSkills(raw).iterator(),complete=true;
   while(skills.hasNext()){var skill=skills.next(),skillId=String(skill.getId()),target=b.getSkill(skillId);if(!target.isPresent()&&skillId.indexOf('alchemist_')===0)target=b.getSkill('herbalist_'+skillId.slice(10));if(target.isPresent())target.get().unlock(raw);else complete=false;}
   if(complete){s=F.loadPlayerState(p);s.migrations_v96.alchemist_skills=true;F.savePlayerState(p,s);}return complete;
 };
 var deliverPoints=F.deliverMidTierSkillPointsV93;
 F.deliverMidTierSkillPointsV93 = function(p,spec){var job=spec.job==='alchemist'?'herbalist':spec.job;if(typeof F.reconcileJobPointsPhase4==='function')return F.reconcileJobPointsPhase4(p,job);var s=F.loadPlayerState(p);s.phase4_points_pending=s.phase4_points_pending||{};s.phase4_points_pending[job]=true;F.savePlayerState(p,s);return false;};
 F.issueOrUpdateGuildCard=function(p,name,date,now){
   var s=F.loadPlayerState(p);if(s.guild_card.issued)return baseIssue(p,name,date,now);
   var d=s.starter_onboarding.registration_draft_v96,v=F.validateGuildCardDisplayNameV82(name);
   if(!v.valid){send(p,'guild_card_validation_error',{reason:v.reason,message:v.message});return fail(v.reason,v.message);}
   if(!d||d.mode!=='FIRST'||!F.JOB_BY_ID_V96[d.job]||!F.F_RANK_TRAITS_V95[d.trait]||s.starter_onboarding.pending_step!=='SIGN'||!s.guild_card.ui_open||!s.guild_card.awaiting_name_input||!near(p))return fail('registration_not_ready');
   var selectedKit=F.JOB_BY_ID_V96[d.job].kit;
   for(var ki=0;ki<selectedKit.length;ki++){var kitId=selectedKit[ki].id;if(kitId==='comforts:sleeping_bag_white'&&!Item.exists(kitId))kitId='minecraft:white_wool';if(!Item.exists(kitId))return fail('missing_kit_item','보급품 등록을 확인한 뒤 다시 신청해 주세요.');}
   var free=0;for(var si=0;si<36;si++)if(p.inventory.getItem(si).empty)free++;if(free<F.JOB_BY_ID_V96[d.job].kit.length+3)return fail('inventory_space_required','등록증과 보급품을 받을 인벤토리 빈칸을 확보하세요.');
   return F.runAtomicPlayerV96(p,function(){
     var q=F.loadPlayerState(p),draft=q.starter_onboarding.registration_draft_v96;
     q.job_licenses[draft.job].grade='F';q.job_licenses[draft.job].registered_at=Date.now();q.special_ability.ability_id=draft.trait;q.special_ability.selected_at=Date.now();q.registration_v96={status:'ISSUING',job:draft.job,trait:draft.trait};q.economy=F.ensurePlayerEconomyStateV8(q);q.economy.migrated_v8_1_starter=true;
     q.starter_onboarding.quests.q03_first_job.first_job_id=draft.job;q.starter_onboarding.quests.q03_first_job.registered_any_job=true;F.savePlayerState(p,q);
     var issued=baseIssue(p,v.cleaned,date,now);if(!issued.ok)return issued;
     F.giveJobCertificateV96(p,draft.job,'F');var kits=F.JOB_BY_ID_V96[draft.job].kit;
     for(var i=0;i<kits.length;i++){var k=kits[i],id=k.id;if(id==='comforts:sleeping_bag_white'&&!Item.exists(id))id='minecraft:white_wool';if(!Item.exists(id))throw new Error('Missing job-kit item '+id);p.give(Item.of(id,k.count,k.nbt||{}));}
     F.grantPlayerCurrencyV8(p,150,false);
     q=F.loadPlayerState(p);q.registration_v96.status='DONE';q.registration_v96.completed_at=Date.now();q.starter_onboarding.first_registration_completed=true;q.starter_onboarding.starter_kit_given=true;q.starter_onboarding.pending_step=null;delete q.starter_onboarding.registration_draft_v96;q.starter_onboarding.quests.q02_first_registration.status='COMPLETED';q.starter_onboarding.quests.q02_first_registration.selected_ability=true;q.starter_onboarding.quests.q03_first_job.status='COMPLETED';F.savePlayerState(p,q);
     F.grantPlayerStageOnce(p,'frank_v96_registered');if(F.applyTraitModifiersV96)F.applyTraitModifiersV96(p);sync(p);return issued;
   });
 };
 // Legacy chat/commands cannot issue a partial registration or bypass the dedicated signature GUI.
 F.selectStarterAbility=function(p,id){var s=F.loadPlayerState(p),d=s.starter_onboarding.registration_draft_v96;return d?F.selectTraitDraftV96(p,{session:d.session,ability_id:id}):fail('use_hess_registration','헤스에게 첫 등록을 신청하세요.');};
 F.registerJobF=function(p,id){var s=F.loadPlayerState(p),d=s.starter_onboarding.registration_draft_v96;return d?F.selectJobDraftV96(p,{session:d.session,job_id:id}):fail('use_hess_registration','헤스에게 직업 등록을 신청하세요.');};
 // Reuse an existing trusted player transaction (promotion claims call this
 // hook inside one), otherwise own the inventory/state rollback boundary here.
 function progressionTransactionV99(p,fn){return locks[uid(p)]?fn():F.runAtomicPlayerV96(p,fn);}
 function gradeAtLeastV99(s,job,grade){var record=s.job_licenses&&s.job_licenses[job];return !!record&&F.GRADE_ORDER.indexOf(record.grade)>=F.GRADE_ORDER.indexOf(grade);}
 function giveProgressionItemV99(p,itemId,count){
   if(!Item.exists(itemId))return false;
   var before=F.countPlayerItem(p,itemId);p.inventory.add(Item.of(itemId,count));
   return F.countPlayerItem(p,itemId)===before+count;
 }
 F.getExplorationCompassItemV99=function(){return Item.exists('naturescompass:naturescompass')?'naturescompass:naturescompass':'minecraft:compass';};
 F.grantPathfinderCompassV99=function(p){return progressionTransactionV99(p,function(){
   var s=F.loadPlayerState(p);s.reward_ledger=s.reward_ledger||{};
   if(!gradeAtLeastV99(s,'pathfinder','E'))return{ok:true,eligible:false};
   if(s.reward_ledger.v99_pathfinder_e_compass)return{ok:true,already:true};
   var item=F.getExplorationCompassItemV99();
   if(!giveProgressionItemV99(p,item,1))return fail('inventory_space_required','탐사 나침반을 받을 인벤토리 빈칸을 확보해 주세요.');
   s=F.loadPlayerState(p);s.reward_ledger=s.reward_ledger||{};s.reward_ledger.v99_pathfinder_e_compass={item:item,granted_at:Date.now()};F.savePlayerState(p,s);
   F.grantPlayerStageOnce(p,'frank_v99_pathfinder_e_compass');p.tell('[통합 길드] 정찰가 E급 보상으로 탐사 나침반을 지급했습니다.');return{ok:true,granted:true,item:item};
 });};
 F.onFirstEGradeV96=function(p){return progressionTransactionV99(p,function(){
   var s=F.loadPlayerState(p),any=false;s.reward_ledger=s.reward_ledger||{};
   var known=!!(s.e_rank_camp_unlocked||s.reward_ledger.e_rank_camp_v96);
   for(var j=0;j<F.ALL_JOBS.length;j++)if(gradeAtLeastV99(s,F.ALL_JOBS[j],'E'))any=true;
   if(!known&&!any)return fail('requires_e_grade');
   var first=!known,items=[];
   if(first){
     if(Platform.isLoaded('nomadictents')&&Item.exists('nomadictents:tiny_yurt')&&Item.exists('nomadictents:tent_mallet'))items=['nomadictents:tiny_yurt','nomadictents:tent_mallet'];
     else items=['f_rank_days:camp_return_scroll'];
     for(var i=0;i<items.length;i++)if(!giveProgressionItemV99(p,items[i],1))return fail('inventory_space_required','야영 보급품을 받을 인벤토리 빈칸을 확보해 주세요.');
   }
   s=F.loadPlayerState(p);s.reward_ledger=s.reward_ledger||{};s.e_rank_camp_unlocked=true;s.reward_ledger.e_rank_camp_v96=true;F.savePlayerState(p,s);
   var compass=F.grantPathfinderCompassV99(p);if(!compass.ok)return compass;
   F.grantPlayerStageOnce(p,'frank_v96_camp_unlocked');
   if(first)p.tell('[통합 길드] 첫 E급 승급을 축하합니다. 여관 개인 금고와 야영 거점을 배정받았습니다.');
   return{ok:true,already:!first,camp_granted:first,camp_items:items,compass_granted:!!compass.granted};
 });};
 F.unlockMainlandSailingV96=function(p,reason){var s=F.loadPlayerState(p);if(s.mainland_sailing_unlocked)return{ok:true,already:true};s.mainland_sailing_unlocked=true;s.mainland_sailing_reason_v96=String(reason);s.reward_ledger.mainland_permit_v96=true;F.savePlayerState(p,s);p.give('f_rank_days:mainland_sailing_permit');F.grantPlayerStageOnce(p,'frank_v96_sailing_unlocked');if(reason==='boss')F.grantPlayerStageOnce(p,'frank_v96_mainland_boss_route');if(reason==='contribution')F.grantPlayerStageOnce(p,'frank_v96_mainland_civil_route');p.tell('[통합 길드] 본토 도항 자격이 승인되었습니다. 남항의 마르코를 찾아가세요.');return{ok:true};};
 F.grantPilgrimageSkillPointsV96=function(p){if(!Platform.isLoaded('puffish_skills'))return false;var API=Java.loadClass('net.puffish.skillsmod.api.SkillsAPI'),RL=Java.loadClass('net.minecraft.resources.ResourceLocation'),cat=API.getCategory(new RL('f_rank_days:relic_researcher'));if(!cat.isPresent())return false;var raw=p.minecraftPlayer||p,source=new RL('f_rank_days:mainland_pilgrimage_v96');if(Number(cat.get().getPoints(raw,source))<2)cat.get().setPoints(raw,source,2);return Number(cat.get().getPoints(raw,source))>=2;};
 function packet(id,fn){NetworkEvents.dataReceived('f_rank_days:'+id,function(e){if(!e.player)return;var r=fn(e.player,e.data||{});if(r&&!r.ok)send(e.player,'onboarding_ui_error',{session:String(e.data&&e.data.session||''),message:r.message||r.reason});});}
 packet('onboarding_select_job',F.selectJobDraftV96);packet('onboarding_select_ability',F.selectTraitDraftV96);
 packet('onboarding_back_to_job',function(p,d){var s=checkSession(p,d,['TRAIT','SIGN']);if(!s||s.starter_onboarding.registration_draft_v96.mode!=='FIRST')return fail('invalid_session');s.guild_card.ui_open=false;s.guild_card.awaiting_name_input=false;F.savePlayerState(p,s);return F.showJobSelectV96(p);});
 packet('onboarding_cancel',function(p,d){var s=F.loadPlayerState(p),q=s.starter_onboarding.registration_draft_v96;if(!q||q.session!==String(d.session))return fail('invalid_session');s.guild_card.ui_open=false;s.guild_card.awaiting_name_input=false;F.savePlayerState(p,s);return{ok:true};});
 packet('request_open_wallet',function(p){return F.openWalletV96(p);});
 packet('wallet_action',function(p,d){var r=d.action==='deposit_all'?F.depositAllCoinsToWalletV8(p):d.action==='withdraw'&&(Number(d.amount)===100||Number(d.amount)===1000)?F.withdrawCoinsFromWalletV8(p,Number(d.amount)):fail('invalid_wallet_action');F.openWalletV96(p);return r;});
 var oldReadNewspaper=F.readBrionNewspaperV8;
 F.readBrionNewspaperV8=function(p,requested){var arch=F.loadNewspaperArchiveV8(p.server),days=arch.edition_days_order||[];if(!days.length){send(p,'open_newspaper_ui',{empty:true,title:'브리온 일보 · 발행 준비 중',public_articles:[],personal_notices:['아직 발행된 조간 신문이 없습니다. 첫날의 사건들은 다음 날 아침 조간에 실립니다.']});return{ok:true,empty:true,reward_granted_on_read:false};}var r=oldReadNewspaper(p,requested);if(r&&r.ok){var s=F.loadPlayerState(p);s.newspaper_last_read_day_v96=Number(r.day);F.savePlayerState(p,s);F.syncHudV96(p);}return r;};
 packet('request_open_newspaper',function(p){return F.readBrionNewspaperV8(p,null);});
 ServerEvents.tick(function(e){if(Number(e.server.overworld().getTime())%100!==0)return;var ps=e.server.players;for(var i=0;i<ps.size();i++)F.syncHudV96(ps.get(i));});
 PlayerEvents.loggedIn(function(e){var s=F.loadPlayerState(e.player);if(s.guild_card.issued)F.onFirstEGradeV96(e.player);F.migrateLegacySkillTreeV96(e.player);F.syncHudV96(e.player);});
})(global.FRankDays);
