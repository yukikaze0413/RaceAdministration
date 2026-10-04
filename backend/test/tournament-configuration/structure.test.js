'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure } = require('../../src/tournament-configuration/domain/structure');
const draft = { entrantKind:'individual', structureVersion:'structure-v1', routingVersion:'routing-v1',
 stages:[{id:'A',order:1,capacity:4,formatIntent:'fixed-swiss',groups:[]}], pools:[],routes:[] };
test('TS1:个人草稿保存独立阶段与稳定引用',()=>{
 const result = parseStructure(draft, 'T');
 assert.deepEqual(result, draft);
 result.stages[0].id='changed'; assert.equal(draft.stages[0].id,'A');
});

test('TS1:拒绝非法类型、未知字段、重复ID及跨赛事引用',()=>{
 for(const change of [
  d=>d.role='organizer', d=>d.entrantKind='team', d=>d.stages[0].capacity='4',
  d=>d.stages.push({...d.stages[0]}), d=>d.stages[0].tournamentId='OTHER',
  d=>d.stages[0].groups=[{id:'g',stageId:'OTHER',capacity:2}],
  d=>d.routes=[{id:'r',source:{stageId:'OTHER'},target:{stageId:'A'}}]
 ]) { const d=structuredClone(draft); change(d);
 assert.throws(()=>parseStructure(d,'T'),e=>e.code==='INVALID_INPUT' && e.diagnostics[0].path.startsWith('/'));
 }
 assert.equal(parseStructure({...draft,stages:[{id:'A',groups:[]}]},'T').stages[0].id,'A');
});

const {setup,command,draft:makeDraft}=require('./helpers');
test('TS2:可信授权隔离并提供独立版本草稿',async()=>{
 const {service:s,ctx,viewer}=setup();
 const c=await s.createDraft(command(ctx,makeDraft()));
 assert.ok(c, '必须返回个人草稿'); assert.equal(c.state,'draft'); assert.equal(c.version,1);
 const read={trustedContext:ctx,tournamentId:'T',id:c.id};
 const copy=await s.getConfiguration(read);copy.stages[0].capacity=99;
 assert.equal((await s.getConfiguration(read)).stages[0].capacity,4);
 await assert.rejects(s.createDraft(command(viewer,makeDraft())),{code:'FORBIDDEN'});
 await assert.rejects(s.getConfiguration({...read,tournamentId:'OTHER'}),{code:'FORBIDDEN'});
 await assert.rejects(s.createDraft(command({actorId:'fake',role:'organizer'},makeDraft())),{code:'FORBIDDEN'});
 const changed=await s.replaceDraft({...read,expectedVersion:1,requestKey:'edit',payload:makeDraft()});
 assert.equal(changed.version,2);
 const bad=makeDraft();bad.stages[0].capacity='invalid';
 await assert.rejects(s.replaceDraft({...read,expectedVersion:2,requestKey:'bad',payload:bad}),{code:'INVALID_INPUT'});
 assert.deepEqual(await s.getConfiguration(read),changed);
});
