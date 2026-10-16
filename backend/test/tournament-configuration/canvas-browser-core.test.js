"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const path = require("node:path");
const entry = path.resolve(__dirname, "../../../shared/planning-canvas/dist/cjs/index.js");
test("portable editor is built for Node and browser without a server connection", () => {
  assert.ok(existsSync(entry), "共享编辑核心尚未构建");
  const { createEditor } = require(entry);
  assert.equal(typeof createEditor, "function");
  const G = require("../../src/planning-canvas/graph");
  const S = require("../../src/planning-canvas/samples");
  const catalog = require("../../src/planning-canvas/editor-catalog").catalog();
  let id = 0;
  const editor = createEditor({ catalog, createId: () => "local-" + ++id });
  const graph = G.sample("empty");
  const added = editor.edit(graph, { type: "add", node: S.node("match", "m") }).graph;
  assert.equal(graph.nodes.length, 0);
  assert.equal(added.nodes.length, 1);
  assert.deepEqual(editor.ports(added, added.nodes[0]).map(p => p.id), ["A", "B", "W", "L"]);
  assert.deepEqual(G.parse(added), added);
});
function portable() {
  const { createEditor } = require(entry);
  let id = 0;
  return createEditor({catalog: require("../../src/planning-canvas/editor-catalog").catalog(),createId:()=>"test-id-" + ++id});
}
test("local presets preserve supported formats and remap every internal reference", () => {
  const editor = portable(), G = require("../../src/planning-canvas/graph");
  for (const [name,matches] of [["single",7],["gsl",5],["double",14]]) {
    const graph = editor.edit(G.sample("empty"),{type:"preset",name,id:"group"}).graph;
    assert.equal(graph.nodes.filter(n=>n.kind==="match").length,matches);
    assert.equal(graph.nodes.find(n=>n.id==="group").params.custom,false);
    G.checkEdges(G.parse(graph));
    assert.ok(graph.edges.every(e=>graph.nodes.some(n=>n.id===e.from.node)&&graph.nodes.some(n=>n.id===e.to.node)));
  }
});
test("local impact confirmation rejects changed graphs and keeps cancelled original relations", () => {
  const editor = portable(), G = require("../../src/planning-canvas/graph");
  const graph = G.sample("single"), before = structuredClone(graph);
  const action = {type:"delete",id:"expand"};
  const pending = editor.edit(graph,action);
  assert.equal(pending.requiresConfirmation,true);
  assert.deepEqual(graph,before);
  assert.deepEqual(pending.graph,before);
  const changed = {...graph,nodes:graph.nodes.map(n=>n.id==="M1"?{...n,name:"renamed"}:n)};
  assert.throws(()=>editor.edit(changed,{...action,confirmed:true,expectedDigest:pending.digest}),/草稿已变化/);
  const result = editor.edit(graph,{...action,confirmed:true,expectedDigest:pending.digest}).graph;
  assert.ok(!result.nodes.some(n=>n.id==="expand"));
  G.checkEdges(G.parse(result));
});
test("editor model derives expander ports without full values or wave planning", () => {
  const editor = portable(), G = require("../../src/planning-canvas/graph");
  const graph = G.sample("single"), model = editor.deriveEditorModel(graph);
  const expander = model.nodes.find(n=>n.id==="expand");
  assert.equal(expander.capacity,8);
  assert.equal(expander.ports.filter(p=>p.direction==="output").length,8);
  assert.deepEqual(model.values,{});
  assert.equal(model.wavePlan,undefined);
});
test("local rule schema rejects unknown fields and invalid Swiss parameters", () => {
  const editor = portable(), G = require("../../src/planning-canvas/graph");
  const graph = G.sample("swiss-eight");
  for (const params of [{parameters:{roundCount:0}},{parameters:{invented:1}},{ruleVersion:"missing"}])
    assert.throws(()=>editor.edit(graph,{type:"update",id:"swiss",params}));
});
