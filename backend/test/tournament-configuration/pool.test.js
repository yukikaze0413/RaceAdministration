'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {previewRouting}=require('../../src/tournament-configuration/domain/routing');
const pool=require('../../examples/tournament-configuration/pool.json');
test('PR2/PR4:池等待全部上游并按来源优先级重排，保留原种子和DQ',()=>{
 const before=structuredClone(pool);
 const r=previewRouting(pool.configuration,pool.sources,'T');
 assert.deepEqual(r.allocations,require('../../examples/tournament-configuration/pool.expected.json'));
 assert.equal(r.previewReady,true);assert.deepEqual(previewRouting(pool.configuration,pool.sources,'T'),r);
 assert.deepEqual(pool,before);
 const s=structuredClone(pool.sources);s.sourceSnapshots.pop();
 const missing=previewRouting(pool.configuration,s,'T');assert.equal(missing.previewReady,false);assert.deepEqual(missing.allocations,[]);
});

test('PR1/PR2:池不去重且跨规则成绩不可比',()=>{
 for(const change of [
  (c,s)=>s.sourceSnapshots[1].entries[0].entrantId='a',
  (c,s)=>{c.pools[0].sort=[{field:'points',direction:'desc'},{field:'initialSeed',direction:'asc'}];s.sourceSnapshots[1].rankingProfileId='different';},
  (c,s)=>{c.pools[0].sort=[{field:'wins',direction:'desc'},{field:'initialSeed',direction:'asc'}];s.sourceSnapshots[1].recordProfileId='different';},
  (c,s)=>{c.pools[0].sort=[{field:'points',direction:'desc'},{field:'initialSeed',direction:'asc'}];delete s.sourceSnapshots[0].rankingProfileId;}
 ]){
 const c=structuredClone(pool.configuration),s=structuredClone(pool.sources);change(c,s);
 const r=previewRouting(c,s,'T');assert.equal(r.previewReady,false);assert.deepEqual(r.allocations,[]);
 assert.ok(r.diagnostics.some(d=>['DUPLICATE_ENTRANT','ROUTING_UNRESOLVED'].includes(d.code)));
 }
 const c=structuredClone(pool.configuration);c.pools[0].capacity=1;
 const r=previewRouting(c,pool.sources,'T');assert.equal(r.structureValid,false);assert.deepEqual(r.allocations,[]);
});

test('PR3:指定目标只读取完整上游闭包，池链保留全部输入',()=>{
 const four=require('../../examples/tournament-configuration/four-groups.json');
 const s=structuredClone(four.sources);s.sourceSnapshots=s.sourceSnapshots.filter(x=>['c','d'].includes(x.sourceId));
 const r=previewRouting(four.configuration,s,'T',['C']);
 assert.equal(r.previewReady,true);assert.equal(r.allocations.length,2);
 const c=structuredClone(pool.configuration);
 c.pools.push({id:'Q',capacity:2,sort:[{field:'initialSeed',direction:'asc'}]});
 c.routes.find(r=>r.id==='out').target={poolId:'Q'};delete c.routes.find(r=>r.id==='out').placement;
 c.routes.push({id:'Qout',source:{poolId:'Q'},selector:{kind:'all'},quota:2,sort:[{field:'poolSeed',direction:'asc'}],target:{stageId:'C'},placement:{kind:'seed',positions:[1,2]}});
 const chain=previewRouting(c,pool.sources,'T',['C']);assert.equal(chain.previewReady,true);
 assert.deepEqual(chain.allocations.map(e=>[e.entrantId,e.poolSeed,e.initialSeed]),[['b',1,2],['a',2,8]]);
});

const {setup,command}=require('./helpers');
test('PR4/CV2:应用预演深拷贝不写配置，成功样例仅令previewReady为true',async()=>{
 const {service:s,ctx}=setup();const c=await s.createDraft(command(ctx,pool.configuration));
 const p={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:1,sources:pool.sources};
 const r=await s.previewRouting(p);assert.ok(r,'必须返回只读预演报告');
 assert.equal(r.version,1);assert.deepEqual(r.allocations,require('../../examples/tournament-configuration/pool.expected.json'));
 assert.equal((await s.validateConfiguration(p)).previewReady,true);
 assert.deepEqual(await s.getConfiguration(p),c);
 const invalid=structuredClone(pool.sources);invalid.sourceSnapshots[0].completed=false;
 assert.equal((await s.previewRouting({...p,sources:invalid})).previewReady,false);
 assert.deepEqual(await s.getConfiguration(p),c);
 for(const state of ['active','withdrawn','disqualified']){
 const sources=structuredClone(pool.sources);sources.roster[0].exitState=state;
 assert.equal((await s.previewRouting({...p,sources})).allocations[0].exitState,state);
 }
});
