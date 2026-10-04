'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {setup}=require('./helpers');const four=require('../../examples/tournament-configuration/four-groups.json');
test('R05/R07:模板→校验→预演→冻结→拒改与手写E6一致',async()=>{
 const {service:s,ctx}=setup();
 const c=await s.instantiateTemplate({trustedContext:ctx,tournamentId:'T',requestKey:'template',payload:{templateId:'four-groups',templateVersion:'1'}});
 const idMap=new Map();
 four.configuration.stages.forEach((stage,i)=>{
  idMap.set(stage.id,c.stages[i].id);stage.groups.forEach((g,j)=>idMap.set(g.id,c.stages[i].groups[j].id));
 });
 const input=structuredClone(four.sources);input.sourceSnapshots.forEach(snapshot=>snapshot.sourceId=idMap.get(snapshot.sourceId));
 const expected=structuredClone(require('../../examples/tournament-configuration/four-groups.expected.json'));
 expected.forEach(e=>{e.source=idMap.get(e.source);e.target.stageId=idMap.get(e.target.stageId);if(e.target.groupId)e.target.groupId=idMap.get(e.target.groupId);});
 const p={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:1,sources:input};
 const report=await s.validateConfiguration(p);assert.equal(report.structureValid,true);assert.equal(report.previewReady,true);assert.equal(report.runtimeReady,false);
 const before=await s.previewRouting(p);assert.deepEqual(before.allocations,expected);
 const snapshot=await s.freezeStructure({...p,requestKey:'freeze'});assert.equal(snapshot.runtimeReady,false);
 const frozen=await s.getConfiguration(p);assert.equal(frozen.state,'structure-frozen');
 const {id,tournamentId,version,state,snapshot:meta,...payload}=frozen;
 await assert.rejects(s.replaceDraft({...p,expectedVersion:2,requestKey:'edit',payload}),{code:'STRUCTURE_FROZEN'});
 assert.deepEqual((await s.previewRouting({...p,expectedVersion:2})).allocations,expected);
 assert.deepEqual(await s.getConfiguration(p),frozen);
});
