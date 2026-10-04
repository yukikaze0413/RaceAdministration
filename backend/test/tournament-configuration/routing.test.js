'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {previewRouting}=require('../../src/tournament-configuration/domain/routing');
const four=require('../../examples/tournament-configuration/four-groups.json');
test('CV4/PR3:非法或未完成来源阻断预演且输入不变',()=>{
 const cases=[
 ['INVALID_INPUT',s=>s.roster[1].initialSeed=1],
 ['INVALID_INPUT',s=>s.roster[0].exitState='removed'],
 ['INVALID_INPUT',s=>s.sourceSnapshots[0].entries[0].wins=-1],
 ['INVALID_INPUT',s=>s.sourceSnapshots[0].entries[0].points=Infinity],
 ['INVALID_INPUT',s=>s.sourceSnapshots[0].entries[0].typo=1],
 ['INVALID_INPUT',s=>s.sourceSnapshots.push(structuredClone(s.sourceSnapshots[0]))],
 ['SOURCE_NOT_READY',s=>s.sourceSnapshots[0].completed=false],
 ['SOURCE_NOT_READY',s=>s.sourceSnapshots.shift()],
 ['INVALID_INPUT',s=>s.sourceSnapshots[0].entries[0].entrantId='unknown'],
 ];
 for(const [code,change] of cases){const s=structuredClone(four.sources);change(s);const before=structuredClone(s);
 const r=previewRouting(four.configuration,s,'T');assert.equal(r.previewReady,false,code);
 assert.deepEqual(r.allocations,[]);assert.ok(r.diagnostics.some(d=>d.code===code&&d.path.startsWith('/')),code);assert.deepEqual(s,before);}
});

const record=require('../../examples/tournament-configuration/record.json');
const recordExpected=require('../../examples/tournament-configuration/record.expected.json');
test('PR1:3–0筛选后全序取p/q，r未入选且数组置换不改变输出',()=>{
 const result=previewRouting(record.configuration,record.sources,'T');
 assert.deepEqual(result.allocations,recordExpected);
 assert.equal(result.previewReady,true);assert.deepEqual(result.inputVersions,[{sourceId:'S',version:5}]);
 assert.ok(result.excluded.some(x=>x.entrantId==='r'));
 const sources=structuredClone(record.sources);sources.roster.reverse();sources.sourceSnapshots[0].entries.reverse();
 assert.deepEqual(previewRouting(record.configuration,sources,'T'),result);
});

test('PR1/PR3:名额不足、缺排序值和未破同分整体失败',()=>{
 for(const change of [
  (c,s)=>c.routes[0].sort=[{field:'sourceRank',direction:'asc'}],
  (c,s)=>{c.routes[0].sort=[{field:'points',direction:'desc'}];delete s.sourceSnapshots[0].entries[0].points;},
  (c,s)=>s.sourceSnapshots[0].entries.splice(0,2)
 ]){
 const c=structuredClone(record.configuration),s=structuredClone(record.sources);change(c,s);
 const r=previewRouting(c,s,'T');assert.equal(r.previewReady,false);assert.deepEqual(r.allocations,[]);
 assert.ok(r.diagnostics.some(d=>d.code==='ROUTING_UNRESOLVED'));
 }
});

test('E6/PR2:四组分流与跳阶段符合独立expected',()=>{
 const r=previewRouting(four.configuration,four.sources,'T');assert.equal(r.previewReady,true);
 assert.deepEqual(r.allocations,require('../../examples/tournament-configuration/four-groups.expected.json'));
});
test('PR2:同一目标阶段两组重复身份整体拒绝',()=>{
 const c=structuredClone(four.configuration),s=structuredClone(four.sources);
 c.stages[1].groups=[{id:'X',stageId:'B',capacity:1},{id:'Y',stageId:'B',capacity:1}];
 c.routes[1].target.groupId='Y';c.routes[1].placement.positions=[1];
 s.sourceSnapshots[1].entries[0].entrantId='a';
 const r=previewRouting(c,s,'T');assert.equal(r.previewReady,false);assert.deepEqual(r.allocations,[]);
 assert.ok(r.diagnostics.some(d=>d.code==='DUPLICATE_ENTRANT'));
});

test('CV1/CV4:条件性交集在样例中命中则拒绝，不能复制到不同后续阶段',()=>{
 const c=structuredClone(record.configuration);
 c.stages.push({id:'U',order:3,capacity:1,formatIntent:'single-elimination',groups:[]});
 c.routes.push({id:'other',source:{stageId:'S'},selector:{kind:'rankRange',from:1,to:1},quota:1,sort:[{field:'initialSeed',direction:'asc'}],target:{stageId:'U'},placement:{kind:'seed',positions:[1]}});
 const r=previewRouting(c,record.sources,'T');assert.equal(r.previewReady,false);assert.deepEqual(r.allocations,[]);
 assert.ok(r.diagnostics.some(d=>d.code==='SELECTOR_OVERLAP'));
});
