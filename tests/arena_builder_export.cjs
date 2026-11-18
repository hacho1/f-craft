'use strict';
const fs=require('node:fs'),path=require('node:path');
const C=require('../수정파일/kubejs/server_scripts/48_serdin_three_boss_arenas_builder_v10_3.js');
if(require.main===module){const at=process.argv.indexOf('--config'),out=process.argv.indexOf('--output');if(at<0)throw Error('--config required');const cfg=JSON.parse(fs.readFileSync(process.argv[at+1],'utf8').replace(/^\uFEFF/,'')),plan=C.plan(cfg);if(out>=0){fs.writeFileSync(process.argv[out+1],JSON.stringify(plan));console.log(JSON.stringify({passed:true,signature:plan.signature,cells:plan.operations.length,output:process.argv[out+1]}));}else process.stdout.write(JSON.stringify(plan));}
module.exports=C;
