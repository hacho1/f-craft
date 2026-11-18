// F-Craft v9.6: shared absolute-coordinate Painter layout and native font metrics.
// Text is measured by the installed Painter TextObject / Minecraft Font pipeline.
var F96UI = (function () {
  var event = null, cache = {}, cacheSize = 0, groups = {}, renderers = [], lastViewport = '', nativeReads = 0, measurementError = '', nativeMeter = null;
  var FONT = 'f_rank_days:print';
  function viewport() { return {w:Number(Client.window.guiScaledWidth),h:Number(Client.window.guiScaledHeight)}; }
  function glyphs(value) {
    var s=String(value==null?'':value), out=[];
    for(var i=0;i<s.length;i++){var c=s.charAt(i),n=s.charCodeAt(i);if(n>=55296&&n<=56319&&i+1<s.length)c+=s.charAt(++i);out.push(c);}
    return out;
  }
  function estimate(s,bold) {var a=glyphs(s),w=0;for(var i=0;i<a.length;i++)w+=a[i]===' '?4:a[i].charCodeAt(0)>255?16:8;return w+(bold?a.length:0);}
  function measure(value,font,bold) {
    var s=String(value==null?'':value),f=font||FONT,key=f+'|'+Boolean(bold)+'|'+s;
    if(cache[key]!==undefined)return cache[key];
    if(event&&typeof Client!=='undefined'&&Client.player){
      try {
        var painter=Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE;
        // Player.paint is queued. Reading a just-painted probe can return the
        // previous string. A private native TextObject has no queued mutation.
        if(!nativeMeter)nativeMeter=new (Java.loadClass('dev.latvian.mods.kubejs.client.painter.screen.TextObject'))(painter);
        // update() synchronously invokes TextObject.load(), including its
        // private per-line width array. Assigning text[] alone omits that state.
        nativeMeter.update({text:JSON.stringify({text:s,font:f,bold:!!bold}),scale:1});
        var obj=nativeMeter;obj.preDraw(event);
        var width=Number(obj.w.getFloat(event));
        if(isFinite(width)&&width>=0){if(cacheSize>5000){cache={};cacheSize=0;}cache[key]=width;cacheSize++;nativeReads++;measurementError='';return width;}
      }catch(e){measurementError=String(e);}
    }
    return estimate(s,bold);
  }
  function fit(value,width,scale,min,font,bold) {return Math.min(scale||1,Math.max(1,width)/Math.max(1,measure(value,font,bold)));}
  function wrap(value,width,scale,font,bold) {
    var paragraphs=String(value==null?'':value).replace(/\r\n?/g,'\n').split('\n'),out=[],limit=Math.max(1,width)/(scale||1);
    for(var p=0;p<paragraphs.length;p++){
      var chars=glyphs(paragraphs[p]),line='';
      for(var i=0;i<chars.length;i++){
        var next=line+chars[i];
        if(line&&measure(next,font,bold)>limit){out.push(line.replace(/\s+$/,''));line=chars[i]===' '?'':chars[i];}else line=next;
      }
      out.push(line.replace(/\s+$/,''));
    }
    return out.length?out:[''];
  }
  function pages(lines,count){var out=[];count=Math.max(1,Math.floor(count));for(var i=0;i<lines.length;i+=count)out.push(lines.slice(i,i+count));return out.length?out:[[]];}
  function rectangle(x,y,w,h,color,texture){var o={type:'rectangle',x:x,y:y,w:Math.max(0,w),h:Math.max(0,h),alignX:'left',alignY:'top',draw:'always',visible:true};if(texture)o.texture=texture;else o.color=color||'#D1BF91';return o;}
  function text(value,x,y,scale,color,bold,font){return {type:'text',x:x,y:y,scale:scale||1,alignX:'left',alignY:'top',draw:'always',visible:true,text:JSON.stringify({text:String(value),font:font||FONT,color:color||'#302014',bold:!!bold})};}
  function line(o,id,value,x,y,width,scale,color,bold,font){o[id]=text(value,x,y,fit(value,width,scale,0.5,font,bold),color,bold,font);}
  function centered(o,id,value,x,y,w,scale,color,bold){var z=fit(value,w,scale,0.5,FONT,bold);o[id]=text(value,x+(w-measure(value,FONT,bold)*z)/2,y,z,color,bold);}
  function paragraph(o,id,value,x,y,w,scale,color,maxLines){var ls=wrap(value,w,scale);if(maxLines)ls=ls.slice(0,maxLines);for(var i=0;i<ls.length;i++)o[id+'_'+i]=text(ls[i],x,y+i*(10*scale+3),scale,color);return ls.length*(10*scale+3);}
  function clear(group){if(!Client.player)return;var ids=groups[group]||[],o={},painter=Java.loadClass('dev.latvian.mods.kubejs.client.painter.Painter').INSTANCE;for(var i=0;i<ids.length;i++)if(painter.getObject(ids[i])!=null)o[ids[i]]={remove:true};if(ids.length)Client.player.paint(o);groups[group]=[];}
  function paint(group,objects){if(!Client.player)return;clear(group);var p={},ids=[],id;for(id in objects)if(objects[id].type!=='text'){p[id]=objects[id];ids.push(id);}for(id in objects)if(objects[id].type==='text'){p[id]=objects[id];ids.push(id);}Client.player.paint(p);groups[group]=ids;}
  function button(o,id,label,x,y,w,h,enabled,selected,hover){o[id+'_bg']=rectangle(x,y,w,h,null,'f_rank_days:textures/gui/v8_2/'+(!enabled?'btn_gold_disabled.png':selected?'btn_confirm_green.png':hover?'btn_gold_hover.png':'btn_gold_normal.png'));centered(o,id+'_label',label,x+4,y+(h-8)/2,w-8,0.8,enabled?'#FFF0CF':'#B9AC91',false);return{id:id,x:x,y:y,w:w,h:h,enabled:enabled};}
  function contains(b,x,y){return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;}
  function pointer(){return {x:Number(Client.mouseHandler.xpos())*Number(Client.window.guiScaledWidth)/Number(Client.window.width),y:Number(Client.mouseHandler.ypos())*Number(Client.window.guiScaledHeight)/Number(Client.window.height)};}
  function parse(value,fallback){try{return value?JSON.parse(String(value)):fallback;}catch(e){return fallback;}}
  function isOpen(){return typeof FRankModalHostV82!=='undefined'&&!!FRankModalHostV82.activeModalId;}
  function repaint(){for(var i=0;i<renderers.length;i++)renderers[i]();}
  if(typeof ClientEvents!=='undefined'&&ClientEvents.paintScreen)ClientEvents.paintScreen(function(e){event=e;var v=viewport(),key=v.w+'x'+v.h;if(lastViewport!==key){cache={};cacheSize=0;lastViewport=key;repaint();}});
  return {FONT:FONT,viewport:viewport,glyphs:glyphs,measure:measure,fit:fit,wrap:wrap,pages:pages,rect:rectangle,text:text,line:line,centered:centered,paragraph:paragraph,clear:clear,paint:paint,button:button,contains:contains,pointer:pointer,pointerBlocked:function(){var h=global.FCraftFoldoutV98;return !!(h&&h.pointerBlocked());},parse:parse,isOpen:isOpen,onResize:function(fn){renderers.push(fn);},repaint:repaint,diagnostics:function(){return {nativeReads:nativeReads,measurementError:measurementError,groups:groups};}};
})();
global.FCraftUIV96=F96UI;
