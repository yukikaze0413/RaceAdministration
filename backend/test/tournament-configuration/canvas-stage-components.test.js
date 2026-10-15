"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
test("stages retain processing components and grouping merges into the lowest order", () => {
  const g = G.sample("single");
  const selected = g.nodes.filter((n) => n.kind !== "match").map((n) => n.id);
  const r = G.edit(g, { type: "createStage", id: "processing", selected, name: "输入处理" });
  assert.deepEqual(r.graph.stages.find((s) => s.id === "processing").nodeIds, selected.sort());
  const moved = G.edit(r.graph, { type: "createStage", id: "latest", selected: [...selected, "M1"] });
  assert.equal(moved.requiresConfirmation, undefined);
  assert.equal(moved.graph.stages.find((s) => s.id === "processing"), undefined);
  assert.equal(moved.graph.stages.length, 1);
  assert.ok(moved.graph.stages[0].nodeIds.includes("M1"));
  assert.ok(selected.every((id) => moved.graph.stages[0].nodeIds.includes(id)));
  assert.deepEqual(moved.graph.nodes, g.nodes);
});
test("subgraph stage expands for scheduling and individual reassignment preserves its siblings", () => {
  let g = G.sample("single");
  g = G.edit(g, { type: "encapsulate", selected: ["M1", "M2"], id: "group" }).graph;
  g = G.edit(g, { type: "createStage", id: "group-stage", name: "子图阶段", selected: ["group"] }).graph;
  g = G.edit(g, { type: "updateStage", id: "group-stage", order: 1 }).graph;
  assert.ok(g.stages.find((s) => s.id === "group-stage").nodeIds.includes("group"));
  assert.equal(G.analyze(g).wavePlan.waves.find((w) => w.matchIds.includes("M1")).stageId, "group-stage");
  g = G.edit(g, { type: "createStage", id: "individual", selected: ["M1"] }).graph;
  g = G.edit(g, { type: "updateStage", id: "individual", order: 1 }).graph;
  assert.ok(!g.stages.find((s) => s.id === "group-stage").nodeIds.includes("group"));
  assert.deepEqual(g.stages.find((s) => s.id === "group-stage").nodeIds, ["M2"]);
  assert.equal(G.analyze(g).wavePlan.waves.find((w) => w.matchIds.includes("M1")).stageId, "individual");
});
test("ungroup preserves all inherited stage members, and grouped references reject effective overlap", () => {
  let g = G.sample("single");
  g = G.edit(g, { type: "encapsulate", selected: ["M1", "M2"], id: "group" }).graph;
  g.stages = [{ id: "only", name: "阶段", order: 1, nodeIds: ["group"] }];
  const expanded = G.edit(g, { type: "ungroup", id: "group" }).graph;
  assert.deepEqual(expanded.stages[0].nodeIds, ["M1", "M2"]);
  const conflict = structuredClone(g);
  conflict.stages.push({ id: "other", name: "重复", order: 2, nodeIds: ["M1"] });
  assert.throws(() => G.parse(conflict));
});
