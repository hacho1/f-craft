(function(){
 var N=global.FCraftPhase6Native,server,ticks=0,started=false,index=0,waiting=false,deadline=0,token=0;
 var report={actualMinecraft:true,humanPlay:false,connectedClient:false,physicalInputUsed:false,checks:[],errors:[],completedSuites:[]};
 var suites=['passives'];
 var handlers={claims110:'runClaimLimitsV110',claims110_restart:'runClaimLimitsV110Restart',mainland110:'runMainlandWaystonesV110',mainland110_restart:'runMainlandWaystonesRestartV110',mount110:'runMountV110',mount110_restart:'runMountV110Restart',active:'runActiveBossV105',control:'runEarthworksControl',sanctum:'runSanctumConstruction',portal:'runGuardianPortal',construction:'runArenaConstruction',boot:'runRaidBoot',raid:'runRaidEngine',gear:'runGuardianGear',hotfix:'runHotfix',transport:'runTransport',passives:'runPassives',passives_restart:'runPassivesRestart',combat:'runCombat',combat_restart:'runCombatRestart',life:'runLife',life_restart:'runLifeRestart',compendium:'runCompendium',compendium_restart:'runCompendiumRestart',promotions:'runPromotions',promotions_restart:'runPromotionsRestart',equipment:'runEquipment',equipment_restart:'runEquipmentRestart',cottage:'runCottageTraining',cottage_restart:'runCottageTrainingRestart',standalone:'runChapter1Standalone',growth:'runGrowth'};
 N.report=report;
 function checkpoint(){JsonIO.write('kubejs/phase6_native_partial.json',report);}
 N.check=function(name,value,detail){report.checks.push({suite:N.currentSuite||'startup',name:String(name),passed:!!value,detail:detail===undefined?null:detail});console.info('FCRAFT_PHASE6_CHECK '+String(name)+' '+!!value);if(!value){checkpoint();if(detail!==undefined){try{console.info('FCRAFT_PHASE6_FAILED_DETAIL '+JSON.stringify(detail));}catch(e){console.info('FCRAFT_PHASE6_FAILED_DETAIL '+String(detail));}}}};
 function finish(){N.cleanupActors();report.passed=report.errors.length===0&&report.checks.length>0&&report.checks.every(function(c){return c.passed;});JsonIO.write('kubejs/phase6_native_result.json',report);console.info('FCRAFT_PHASE6_COMPLETE '+report.passed+' '+report.checks.length);server.runCommandSilent('stop');}
 function next(){
  if(index>=suites.length){finish();return;}
  var suite=suites[index++],fn=N[handlers[suite]];N.currentSuite=suite;
  if(typeof fn!=='function'){report.errors.push({suite:suite,error:'Missing native fixture'});next();return;}
  waiting=true;deadline=ticks+18000;var id=++token,ended=false;
  function done(){if(ended||id!==token)return;ended=true;waiting=false;report.completedSuites.push(suite);checkpoint();server.scheduleInTicks(5,function(){next();});}
  console.info('FCRAFT_PHASE6_SUITE '+suite);
  try{fn(server,done);}catch(e){report.errors.push({suite:suite,error:String(e),stack:String(e.stack||'')});console.error('FCRAFT_PHASE6_ERROR '+suite+' '+e);done();}
 }
 ServerEvents.loaded(function(e){server=e.server;var input=JSON.parse(String(JsonIO.readString('kubejs/phase6_native_input.json')));if(input.restart)suites=['passives_restart'];if(Array.isArray(input.suites)&&input.suites.length)suites=input.suites;});
 ServerEvents.tick(function(e){server=e.server;ticks++;
  if(ticks%20===0){var request=JSON.parse(String(JsonIO.readString('kubejs/phase7_qa_stop.json')));if(request&&request.requested===true){report.cancelledByUser=true;report.errors.push({suite:N.currentSuite||'startup',error:'Owned QA cancelled on user request'});finish();return;}}
  if(waiting&&ticks>deadline){report.errors.push({suite:N.currentSuite,error:'Native suite timed out'});waiting=false;token++;next();}
  if(!started&&ticks>=100){started=true;var F=global.FRankDays;F.loadFcraftRegionConfig(server);F.initializeFcraftV9World(server,server.overworld());N.check('existing firstisland geometry metadata retained',!!F.getSerdinV97Layout(server));server.runCommandSilent('gamerule doMobSpawning false');if(suites.indexOf('mount110')>=0){N.currentSuite='mount_stack_prelude';try{if(typeof N.runMountStackBindingSmokeV110!=='function'||N.runMountStackBindingSmokeV110(server)!==true){N.check('actual mount stack binding prelude succeeded',false);finish();return;}}catch(error){N.check('actual mount stack binding prelude exception',false,{error:String(error),stack:String(error.stack||'')});finish();return;}N.currentSuite=null;}next();}
 });
})();
