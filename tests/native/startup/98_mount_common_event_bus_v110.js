// QA ONLY. Use the installed startup wrapper's public common event-bus record
// accessor. Never reflect MinecraftForge (its declared methods include client types).
(function(){
 var bus=ForgeEvents.eventBus();
 // Independent of the N object: startup/server helper initialization may
 // replace that object in either order. Server98 looks up this export per post.
 global.FCraftNativePostForgeEventV110=function(event){return bus.post(event);};
})();
