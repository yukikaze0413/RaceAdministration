'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateStructure}=require('../../src/tournament-configuration/domain/validation');
const four=require('../../examples/tournament-configuration/four-groups.json').configuration;
const copy=()=>structuredClone(four);
test('CV1:静态拒绝循环、容量、位置及筛选冲突且定位稳定',()=>{
 const cases=[
 ['DEPENDENCY_CYCLE',d=>d.routes.push({...d.routes[0],id:'back',source:{stageId:'B',groupId:'X'},target:{stageId:'A',groupId:'a'}})],
 ['CAPACITY_EXCEEDED',d=>{d.stages[1].capacity=1;d.stages[1].groups[0].capacity=1;}],
 ['POSITION_CONFLICT',d=>d.routes[1].placement.positions=[1]],
 ['PLACEMENT_KIND_CONFLICT',d=>d.routes[1].placement.kind='slot'],
 ['SELECTOR_OVERLAP',d=>d.routes[1].source=d.routes[0].source],
 ['POOL_SEED_UNAVAILABLE',d=>d.routes[0].sort=[{field:'poolSeed',direction:'asc'}]],
 ['ORDER_INVALID',d=>d.stages[1].order=1],
 ['CONFIG_REQUIRED',d=>d.routes[0].quota=null],
 ['GROUP_REQUIRED',d=>delete d.routes[0].source.groupId],
 ['POSITION_INVALID',d=>d.routes[2].placement.positions=[9]],
 ['PLACEMENT_COUNT',d=>d.routes[2].placement.positions=[1,2]],
 ];
 for(const [code,mutate] of cases){const d=copy();mutate(d);const before=structuredClone(d);
 const r=validateStructure(d,'T');assert.equal(r.structureValid,false,code);
 assert.ok(r.diagnostics.some(x=>x.code===code&&x.path.startsWith('/')),code);
 assert.deepEqual(validateStructure(d,'T'),r);assert.deepEqual(d,before);}
});

const {FORMATS}=require('../../src/tournament-configuration/domain/structure');
test('CV2/CV3:六类意图仅结构通过并保留未来来源与运行限制',()=>{
 for(const formatIntent of FORMATS){
 const d=copy();d.stages[0].formatIntent=formatIntent;
 const report=validateStructure(d,'T');
 assert.equal(report.structureValid,true);assert.equal(report.previewReady,false);assert.equal(report.runtimeReady,false);
 assert.ok(report.diagnostics.some(d=>d.code==='FORMAT_RUNTIME_UNAVAILABLE'&&d.severity==='info'));
 assert.ok(report.diagnostics.some(d=>d.code==='SOURCE_INPUT_REQUIRED'&&d.severity==='conditional'));
 }
 const d=copy();d.routes[1].source=d.routes[0].source;d.routes[1].selector={kind:'recordEquals',wins:3,losses:0,draws:0};
 const r=validateStructure(d);assert.equal(r.structureValid,true);
 assert.ok(r.diagnostics.some(x=>x.code==='SELECTOR_INTERSECTION_UNKNOWN'));
});

const {setup,command}=require('./helpers');
test('CV3:受授权的报告有配置版本，真实配对明确不可用',async()=>{
 const {service:s,ctx,viewer}=setup();const c=await s.createDraft(command(ctx,copy()));
 const p={trustedContext:viewer,tournamentId:'T',id:c.id,expectedVersion:1};
 const r=await s.validateConfiguration(p);assert.ok(r,'返回版本化报告');assert.equal(r.configurationId,c.id);assert.equal(r.version,1);
 await assert.rejects(s.requestRuntime(p),{code:'RUN_NOT_SUPPORTED'});
 await assert.rejects(s.validateConfiguration({...p,expectedVersion:2}),{code:'VERSION_CONFLICT'});
 await assert.rejects(s.requestRuntime({...p,tournamentId:'OTHER'}),{code:'FORBIDDEN'});
});

test('E7:三条各2人路由到4槽，报告6人超额与明确路径',()=>{
 const d=copy();d.stages[2].capacity=4;d.routes=d.routes.slice(0,3);
 for(const [i,r]of d.routes.entries()){r.quota=2;r.selector={kind:'rankRange',from:1,to:2};r.target={stageId:'C'};r.placement={kind:'slot',positions:[i*2+1,i*2+2]};}
 const r=validateStructure(d);assert.equal(r.structureValid,false);
 assert.ok(r.diagnostics.some(x=>x.code==='CAPACITY_EXCEEDED'&&x.details.total===6&&x.details.capacity===4));
});
