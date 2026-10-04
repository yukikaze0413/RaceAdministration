'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {setup,command}=require('./helpers');const four=require('../../examples/tournament-configuration/four-groups.json');
test('TS4:复验后冻结快照，保留限制、未开赛且拒绝再编辑',async()=>{
 const {service:s,ctx}=setup();const c=await s.createDraft(command(ctx,four.configuration));
 const p={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:1,requestKey:'freeze'};
 const snapshot=await s.freezeStructure(p);assert.ok(snapshot,'必须生成结构快照');
 assert.equal(snapshot.frozenFromVersion,1);assert.equal(snapshot.version,2);assert.equal(snapshot.runtimeReady,false);assert.equal(snapshot.started,false);
 assert.ok(snapshot.diagnostics.some(d=>d.code==='FORMAT_RUNTIME_UNAVAILABLE'));
 assert.ok(snapshot.diagnostics.some(d=>d.severity==='conditional'));assert.equal(typeof snapshot.digest,'string');
 const frozen=await s.getConfiguration(p);assert.equal(frozen.state,'structure-frozen');
 await assert.rejects(s.replaceDraft({...p,expectedVersion:2,requestKey:'edit',payload:four.configuration}),{code:'STRUCTURE_FROZEN'});
 snapshot.structure.routes[0].placement.positions=[99];
 assert.notDeepEqual((await s.getConfiguration(p)).snapshot.structure,snapshot.structure);
 const bad=structuredClone(four.configuration);bad.routes[1].placement.positions=[1];
 const invalid=await s.createDraft(command(ctx,bad,'invalid'));
 await assert.rejects(s.freezeStructure({...p,id:invalid.id,requestKey:'invalid-freeze'}),{code:'CONFIG_INVALID'});
 assert.equal((await s.getConfiguration({...p,id:invalid.id})).state,'draft');
});

test('TS5:全部写操作规范化幂等，响应丢失重试先于版本检查',async()=>{
 const {service:s,ctx,grants}=setup();const create=command(ctx,four.configuration);
 const c=await s.createDraft(create);
 assert.deepEqual(await s.createDraft(create),c);
 const reordered={};for(const key of Object.keys(four.configuration).reverse())reordered[key]=four.configuration[key];
 assert.deepEqual(await s.createDraft({...create,payload:reordered}),c);
 await assert.rejects(s.createDraft({...create,payload:{...four.configuration,routes:[]}}),{code:'IDEMPOTENCY_CONFLICT'});
 const p={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:1,requestKey:'edit',payload:four.configuration};
 const edited=await s.replaceDraft(p);assert.deepEqual(await s.replaceDraft(p),edited);
 await assert.rejects(s.replaceDraft({...p,requestKey:'stale'}),{code:'VERSION_CONFLICT'});
 const freeze={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:2,requestKey:'freeze'};
 const snapshot=await s.freezeStructure(freeze);assert.deepEqual(await s.freezeStructure(freeze),snapshot);
 await assert.rejects(s.freezeStructure({...freeze,expectedVersion:3}),{code:'IDEMPOTENCY_CONFLICT'});
 await assert.rejects(s.freezeStructure({...freeze,requestKey:'other',expectedVersion:3}),{code:'STRUCTURE_FROZEN'});
 grants.get('admin:T').delete('configure');
 await assert.rejects(s.freezeStructure(freeze),{code:'FORBIDDEN'});
});
test('TS5:同版本并发编辑/冻结与双冻结仅有一次状态转换',async()=>{
 for(const mode of ['edit-freeze','double-freeze']){
 const {service:s,ctx}=setup();const c=await s.createDraft(command(ctx,four.configuration));
 const p={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:1,requestKey:'freeze'};
 const a=s.freezeStructure(p),b=mode==='edit-freeze'?
 s.replaceDraft({...p,requestKey:'edit',payload:four.configuration}):s.freezeStructure({...p,requestKey:'other'});
 const settled=await Promise.allSettled([a,b]);assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 assert.ok(['VERSION_CONFLICT','STRUCTURE_FROZEN'].includes(settled.find(x=>x.status==='rejected').reason.code));
 assert.equal((await s.getConfiguration(p)).version,2);
 }
});

const {createService}=require('../../src/tournament-configuration/application/service');
const {createMemoryStore}=require('../../src/tournament-configuration/adapters/memory-store');
test('TS5:快照/配置/幂等任一步故障均回滚，失败重试可成功',async()=>{
 for(const phase of ['snapshot','configuration','idempotency']){
 let armed=false;const store=createMemoryStore({beforeCommit:(candidate,step)=>{if(armed&&step===phase)throw Error('injected');}});
 const s=createService({store,authorize:()=>true}),ctx={actorId:'admin'};
 const c=await s.createDraft(command(ctx,four.configuration));const before=await store.read('T');
 const p={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:1,requestKey:'freeze'};
 armed=true;await assert.rejects(s.freezeStructure(p),{code:'STORE_FAILURE'});
 assert.deepEqual(await store.read('T'),before);
 armed=false;const snap=await s.freezeStructure(p);
 assert.equal((await store.read('T')).snapshots.size,1);
 assert.deepEqual(await s.freezeStructure(p),snap);
 }
});
test('TS5:历史只读报告不能替代冻结内部复验',async()=>{
 const {service:s,ctx}=setup();const c=await s.createDraft(command(ctx,four.configuration));
 const p={trustedContext:ctx,tournamentId:'T',id:c.id,expectedVersion:1};
 assert.equal((await s.validateConfiguration(p)).structureValid,true);
 const payload=structuredClone(four.configuration);payload.routes[1].placement.positions=[1];
 await s.replaceDraft({...p,requestKey:'edit',payload});
 await assert.rejects(s.freezeStructure({...p,requestKey:'stale-freeze'}),{code:'VERSION_CONFLICT'});
 await assert.rejects(s.freezeStructure({...p,expectedVersion:2,requestKey:'freeze-invalid'}),{code:'CONFIG_INVALID'});
});

test('TS5:仓库无法复制事务响应时也不提交候选状态',async()=>{
 const store=createMemoryStore();const before=await store.read('T');
 await assert.rejects(store.transaction('T',candidate=>{candidate.configurations.set('bad',{state:'draft'});return ()=>{};}),{code:'STORE_FAILURE'});
 assert.deepEqual(await store.read('T'),before);
});
