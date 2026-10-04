'use strict';
const fs=require('node:fs');
const {createService}=require('../src/tournament-configuration/application/service');
const {object,ConfigurationError}=require('../src/tournament-configuration/domain/structure');
function localSession(){
 const ctx=Object.freeze({actorId:'local-demo'});
 const service=createService({authorize:(context,tournamentId,action)=>context===ctx&&tournamentId==='local-demo'&&['view','configure'].includes(action)});
 return {ctx,service,tournamentId:'local-demo'};
}
async function main(args){
 const [command,file]=args;
 if(!['validate','preview','demo'].includes(command)||args.length>(command==='demo'?1:2))throw new ConfigurationError('INVALID_INPUT','用法: validate <JSON> | preview <JSON> | demo');
 const {ctx,service:s,tournamentId}=localSession();
 let input;
 if(command==='demo')input=require('../examples/tournament-configuration/four-groups.json');
 else {
  if(!file)throw new ConfigurationError('INVALID_INPUT','缺少JSON文件');
  try{input=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new ConfigurationError('INVALID_INPUT','无法读取有效JSON文件');}
 }
 object(input,['configuration','sources','targetIds'],'');
 const c=await s.createDraft({trustedContext:ctx,tournamentId,requestKey:'create',payload:input.configuration});
 const p={trustedContext:ctx,tournamentId,id:c.id,expectedVersion:c.version,sources:input.sources,targetIds:input.targetIds};
 if(command==='validate')return s.validateConfiguration(p);
 if(command==='preview')return s.previewRouting(p);
 const report=await s.validateConfiguration(p),before=await s.previewRouting(p);
 const edited=await s.replaceDraft({...p,requestKey:'edit',payload:input.configuration});
 const snapshot=await s.freezeStructure({...p,expectedVersion:edited.version,requestKey:'freeze'});
 let frozenEdit;
 try{await s.replaceDraft({...p,expectedVersion:snapshot.version,requestKey:'edit-frozen',payload:input.configuration});}
 catch(e){frozenEdit={code:e.code,reason:e.message};}
 const after=await s.previewRouting({...p,expectedVersion:snapshot.version});
 return {report,before,snapshot,frozenEdit,after,runtimeReady:false};
}
if(require.main===module)main(process.argv.slice(2)).then(result=>{
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(result.structureValid===false||result.previewReady===false&&process.argv[2]==='preview')process.exitCode=1;
}).catch(e=>{
 process.stdout.write(JSON.stringify({code:e.code||'INVALID_INPUT',reason:e.message,diagnostics:e.diagnostics||[]},null,2)+'\n');process.exitCode=1;
});
module.exports={main};
