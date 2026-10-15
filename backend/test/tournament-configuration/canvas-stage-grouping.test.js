"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
test("grouping allocates new numbers and retains the latest after delete and reorder", () => {
  let graph = G.sample("single");
  assert.throws(() => G.edit(graph, { type: "createStage", selected: [], stageIds: [] }));
  graph = G.edit(graph, { type: "createStage", id: "second", selected: ["source"], stageIds: [] }).graph;
  assert.deepEqual(graph.stages[1], { id: "second", name: "阶段 2", order: 2, nodeIds: ["source"] });
  graph = G.edit(graph, { type: "deleteStage", id: "second" }).graph;
  graph = G.parse(JSON.parse(JSON.stringify(graph)));
  graph = G.edit(graph, { type: "createStage", id: "next", selected: ["source"] }).graph;
  assert.equal(graph.stages[1].order, 2);
  graph = G.edit(graph, { type: "reorderStages", stageIds: ["next", "stage-initial"] }).graph;
  graph = G.edit(graph, { type: "createStage", id: "fourth", selected: ["expand"] }).graph;
  assert.equal(graph.stages[2].order, 3);
  assert.equal(graph.stageNumbering.latest, 3);
});
test("create stage joins the lowest existing order and retains its name and unselected members", () => {
  const graph = G.sample("single");
  graph.stages[0].order = 7;
  graph.stages.push({ id: "earliest", name: "保留名称", order: 2, nodeIds: ["source"] });
  const original = structuredClone(graph);
  const response = G.edit(graph, { type: "createStage", id: "unused", name: "不应新建", selected: ["M1", "source", "expand"] });
  const result = response.graph;
  assert.equal(response.stageId, "earliest");
  assert.equal(result.stages.length, 2);
  assert.deepEqual(result.stages.find((s) => s.id === "earliest"), { id: "earliest", name: "保留名称", order: 2, nodeIds: ["M1", "expand", "source"] });
  assert.ok(result.stages[0].nodeIds.includes("M2"));
  assert.ok(!result.stages[0].nodeIds.includes("M1"));
  assert.deepEqual(result.nodes, graph.nodes);
  assert.deepEqual(result.edges, graph.edges);
  assert.deepEqual(graph, original);
  assert.deepEqual(G.edit(result, { type: "createStage", id: "another", selected: result.stages.find((s) => s.id === "earliest").nodeIds }).graph, result);
});
test("create stage creates only when all selected components are unassigned", () => {
  const graph = G.sample("single");
  const result = G.edit(graph, { type: "createStage", id: "new", name: "输入", selected: ["source", "expand"] }).graph;
  assert.equal(result.stages.length, 2);
  assert.deepEqual(result.stages[1], { id: "new", name: "输入", order: 2, nodeIds: ["expand", "source"] });
  assert.deepEqual(result.stages[0], graph.stages[0]);
});
test("subgraph subset splits into a new stage while preserving its original siblings", () => {
  let graph = G.sample("single");
  graph = G.edit(graph, { type: "encapsulate", id: "package", selected: ["M1", "M2"] }).graph;
  const result = G.edit(graph, { type: "createStage", id: "unused", selected: ["package"] }).graph;
  assert.equal(result.stages.length, 2);
  assert.deepEqual(result.stages[1].nodeIds, ["M1", "M2", "package"]);
  assert.ok(result.stages[0].nodeIds.includes("M7"));
});
test("selecting a proper subset from one stage creates a new stage", () => {
  const graph = G.sample("single");
  const response = G.edit(graph, { type: "createStage", id: "split", selected: ["M1", "M2"], stageIds: [] });
  assert.equal(response.stageId, "split");
  assert.equal(response.graph.stages.length, 2);
  assert.deepEqual(response.graph.stages[1].nodeIds, ["M1", "M2"]);
  assert.ok(response.graph.stages[0].nodeIds.includes("M7"));
  assert.ok(!response.graph.stages[0].nodeIds.includes("M1"));
  assert.deepEqual(graph.stages[0].nodeIds, G.sample("single").stages[0].nodeIds);
});
test("selecting the original stage or all its members reuses it", () => {
  const graph = G.sample("single");
  for (const action of [
    { selected: ["M1"], stageIds: ["stage-initial"] },
    { selected: graph.stages[0].nodeIds, stageIds: [] },
  ]) {
    const result = G.edit(graph, { type: "createStage", id: "unused", ...action });
    assert.equal(result.stageId, "stage-initial");
    assert.deepEqual(result.graph, graph);
  }
});
test("mixing an unassigned component with one stage joins that stage", () => {
  const graph = G.sample("single");
  const result = G.edit(graph, { type: "createStage", id: "unused", selected: ["M1", "source"] }).graph;
  assert.equal(result.stages.length, 1);
  assert.ok(result.stages[0].nodeIds.includes("source"));
  assert.ok(result.stages[0].nodeIds.includes("M7"));
});
test("explicitly selected empty stage participates in lowest order selection", () => {
  const graph = G.sample("single");
  graph.stages[0].order = 3;
  graph.stages.push({ id: "empty", name: "空阶段", order: 1, nodeIds: [] });
  const result = G.edit(graph, { type: "createStage", id: "unused", selected: ["M1"], stageIds: ["empty"] }).graph;
  assert.deepEqual(result.stages[1], { id: "empty", name: "空阶段", order: 1, nodeIds: ["M1"] });
  assert.throws(() => G.edit(graph, { type: "createStage", selected: ["M1"], stageIds: ["missing"] }));
});
test("explicitly selected stages merge into the earliest stage regardless of selection order", () => {
  const graph = G.sample("single");
  graph.stages[0].order = 5;
  graph.stages.push({ id: "early", name: "输入", order: 2, nodeIds: ["source"] });
  const result = G.edit(graph, { type: "createStage", id: "unused", selected: ["expand"], stageIds: ["stage-initial", "early"] }).graph;
  assert.equal(result.stages.length, 1);
  assert.equal(result.stages[0].id, "early");
  assert.deepEqual(result.stages[0].nodeIds, graph.nodes.map((n) => n.id).sort());
  assert.equal(result.stageNumbering.latest, 5);
  assert.deepEqual(result.nodes, graph.nodes);
  assert.deepEqual(result.edges, graph.edges);
});

test("grouping clears every empty stage atomically and preserves the selected target", () => {
  const graph = G.sample("single");
  graph.stages.push({ id: "old-empty", name: "空阶段", order: 4, nodeIds: [] });
  const original = structuredClone(graph);
  const result = G.edit(graph, { type: "createStage", selected: graph.stages[0].nodeIds, stageIds: [] });
  assert.equal(result.stageId, "stage-initial");
  assert.deepEqual(result.graph.stages, [graph.stages[0]]);
  assert.deepEqual(graph, original);
  assert.deepEqual(result.graph.nodes, graph.nodes);
  assert.deepEqual(result.graph.edges, graph.edges);
  assert.deepEqual(G.edit(result.graph, { type: "createStage", stageIds: ["stage-initial"] }).graph, result.graph);
  assert.throws(() => G.edit(graph, { type: "createStage", selected: ["missing"] }));
  assert.deepEqual(graph, original);
});

test("grouping reuses the number released by an emptied stage after reload", () => {
  let graph = G.sample("single");
  graph = G.edit(graph, { type: "createStage", id: "processing", selected: ["source"] }).graph;
  graph = G.edit(graph, { type: "createStage", selected: ["source", "M1"], stageIds: ["stage-initial"] }).graph;
  assert.equal(graph.stages.length, 1);
  graph = G.parse(JSON.parse(JSON.stringify(graph)));
  const result = G.edit(graph, { type: "createStage", id: "reused", selected: ["source"] });
  assert.equal(result.stageId, "reused");
  assert.equal(result.graph.stages.find((s) => s.id === "reused").order, 2);
  assert.equal(result.graph.stageNumbering.latest, 2);
});
