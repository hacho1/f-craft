// Executes the production compass and exact ROOT native fixture check in the
// installed gamepack's Rhino engine. No Minecraft server or client is launched.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),build=JSON.parse(fs.readFileSync(path.join(root,'검증/promotion_bridge_build.json'),'utf8')),jdk='C:/Users/wooheewon/AppData/Local/Programs/Eclipse Adoptium/jdk-17.0.20.101-hotspot/bin',probe=path.join(root,'개별작업/promotion_bridge/build/compass_probe');fs.mkdirSync(probe,{recursive:true});
const productionPath=path.join(root,'수정파일/kubejs/server_scripts/52_quest_filter_and_compass_v10_6.js'),fixturePath=path.join(__dirname,'native/82_promotions_v106.js'),source=fs.readFileSync(productionPath,'utf8'),fixture=fs.readFileSync(fixturePath,'utf8'),method=source.split('\n').find(x=>x.includes('F.computeQuestNpcCompassV106=function')),nativeCheck=fixture.split('\n').find(x=>x.includes("check('actual loaded compass all8directions'"));
assert(method&&nativeCheck);assert(!method.includes('Math.PI'));assert(!nativeCheck.includes('Math.PI'));
const rhino=Object.keys(build.classpath).find(x=>x.endsWith('rhino-forge-2001.2.3-build.10.jar')),deps=Object.keys(build.classpath).filter(x=>/gson-[^\\/]+\.jar$|commons-lang3-[^\\/]+\.jar$/.test(x));assert(rhino&&deps.length>=2);
const java=path.join(probe,'InstalledRhinoCompassRegression.java'),js=path.join(probe,'production_compass_regression.js');
fs.writeFileSync(java,String.raw`import dev.latvian.mods.rhino.Context;
import dev.latvian.mods.rhino.ScriptableObject;
import java.nio.file.*;
public final class InstalledRhinoCompassRegression {public static void main(String[] args)throws Exception{Context c=Context.enter();ScriptableObject scope=c.initStandardObjects();System.out.println(String.valueOf(c.evaluateString(scope,Files.readString(Path.of(args[0])),"production_compass_regression",1,null)));}}
`);
fs.writeFileSync(js,"var F={},checks=[];function check(name,yes,detail){checks.push({name:name,passed:!!yes,detail:detail||null});}\n"+method+'\n'+nativeCheck+String.raw`
var sectorRows=[],angles=[0,45,90,135,180,225,270,315];
for(var i=0;i<angles.length;i++){var a=angles[i]*3.141592653589793/180,c=F.computeQuestNpcCompassV106(0,0,0,-Math.sin(a)*20,Math.cos(a)*20);check('sector '+angles[i]+' finite and has arrow',isFinite(c.relative)&&isFinite(c.distance)&&typeof c.arrow==='string'&&c.arrow.length>0,c);sectorRows.push(c);}
check('east target from south-facing player is right',F.computeQuestNpcCompassV106(0,0,0,20,0).arrow==='→');
check('same east target after -90 degree yaw is ahead',F.computeQuestNpcCompassV106(0,0,-90,20,0).arrow==='↑');
check('west target from south-facing player is left',F.computeQuestNpcCompassV106(0,0,0,-20,0).arrow==='←');
check('north target from south-facing player is behind',F.computeQuestNpcCompassV106(0,0,0,0,-20).arrow==='↓');
JSON.stringify({mathPiType:typeof Math.PI,passed:checks.every(function(c){return c.passed;}),checks:checks,sectors:sectorRows});
`);
function run(exe,args){const p=cp.spawnSync(path.join(jdk,exe+'.exe'),args,{encoding:'utf8',windowsHide:true});assert.equal(p.status,0,String(p.stdout)+String(p.stderr));return p.stdout;}
run('javac',['--release','17','-encoding','UTF-8','-classpath',rhino,'-d',probe,java]);const output=run('java',['-Dfile.encoding=UTF-8','-cp',[probe,rhino,...deps].join(path.delimiter),'InstalledRhinoCompassRegression',js]),result=JSON.parse(output);assert.equal(result.mathPiType,'undefined','Guard must continue exercising actual engine without injecting PI');assert(result.passed,output);const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),report={passed:true,actualMinecraft:false,actualRhino:true,rhinoJar:rhino,rhinoSha256:sha(rhino),productionSha256:sha(productionPath),fixtureSha256:sha(fixturePath),...result};fs.writeFileSync(path.join(root,'검증/v10_6_compass_rhino_regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,actualRhino:true,actualMinecraft:false,mathPiType:result.mathPiType,checks:result.checks.length,arrows:result.sectors.map(x=>x.arrow),productionSha256:report.productionSha256,fixtureSha256:report.fixtureSha256},null,2));
