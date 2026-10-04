'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');const path=require('node:path');
const root=path.resolve(__dirname,'../..'),script=path.join(root,'scripts/tournament-configuration.js');
function run(...args){const p=spawnSync(process.execPath,[script,...args],{cwd:root,encoding:'utf8'});return {status:p.status,json:JSON.parse(p.stdout),stderr:p.stderr};}
test('CLI:validate/preview/demo使用应用JSON契约及exit code',()=>{
 const v=run('validate','examples/tournament-configuration/four-groups.json');
 assert.equal(v.status,0);assert.equal(v.json.structureValid,true);assert.equal(v.json.runtimeReady,false);
 const p=run('preview','examples/tournament-configuration/four-groups.json');
 assert.equal(p.status,0);assert.deepEqual(p.json.allocations,require('../../examples/tournament-configuration/four-groups.expected.json'));
 const dq=run('preview','examples/tournament-configuration/pool.json');
 assert.equal(dq.status,0);assert.deepEqual(dq.json.allocations,require('../../examples/tournament-configuration/pool.expected.json'));
 const invalid=run('validate','examples/tournament-configuration/invalid.json');
 assert.equal(invalid.status,1);assert.equal(invalid.json.structureValid,false);
 const unknown=run('unknown');assert.equal(unknown.status,1);assert.equal(unknown.json.code,'INVALID_INPUT');
 const demo=run('demo');assert.equal(demo.status,0);
 assert.equal(demo.json.snapshot.runtimeReady,false);assert.equal(demo.json.frozenEdit.code,'STRUCTURE_FROZEN');
 assert.equal(demo.json.before.previewReady,true);assert.equal(demo.json.after.previewReady,true);
 assert.deepEqual(demo.json.before.allocations,require('../../examples/tournament-configuration/four-groups.expected.json'));
 assert.deepEqual(demo.json.after.allocations,demo.json.before.allocations);
});
