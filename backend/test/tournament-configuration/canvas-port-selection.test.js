"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
test("disconnect selected input removes only that port connection and retains the original graph", () => {
  const graph = G.sample("single");
  const original = structuredClone(graph);
  const result = G.edit(graph, { type: "disconnectPort", from: { node: "M1", port: "A" }, direction: "input" }).graph;
  assert.equal(result.edges.length, graph.edges.length - 1);
  assert.ok(!result.edges.some((e) => e.to.node === "M1" && e.to.port === "A"));
  assert.deepEqual(result.nodes, graph.nodes);
  assert.deepEqual(graph, original);
  assert.deepEqual(G.edit(result, { type: "disconnectPort", from: { node: "M1", port: "A" }, direction: "input" }).graph, result);
  assert.throws(() => G.edit(graph, { type: "disconnectPort", from: { node: "M1", port: "missing" }, direction: "input" }));
});
test("disconnect shared output removes all its reads and resolves subgraph boundary aliases", () => {
  let graph = G.sample("single");
  for (const id of ["p1", "p2"]) {
    graph = G.edit(graph, { type: "add", node: { id, kind: "pool", name: id, params: { inputs: ["in:1"] }, position: { x: 0, y: 0 } } }).graph;
    graph = G.edit(graph, { type: "connect", from: { node: "source", port: "collection" }, to: { node: id, port: "in:1" } }).graph;
  }
  graph = G.edit(graph, { type: "encapsulate", selected: ["source"], id: "group" }).graph;
  const boundary = graph.nodes.find((n) => n.id === "group").params.boundaries.find((b) => b.target.port === "collection");
  const action = { type: "disconnectPort", from: { node: "group", port: boundary.id }, direction: "output" };
  const pending = G.edit(graph, action);
  assert.equal(pending.requiresConfirmation, true);
  const result = G.edit(graph, { ...action, confirmed: true, expectedDigest: pending.digest }).graph;
  assert.equal(result.edges.length, graph.edges.length - 11);
  assert.ok(!result.edges.some((e) => e.from.node === "group" && e.from.port === boundary.id));
  assert.throws(() => G.edit(graph, { type: "disconnectPort", from: { node: "group", port: boundary.id }, direction: "sideways" }));
});
test("disconnecting a subgraph output preserves its internal reads of the same collection", () => {
  let graph = G.sample("single");
  for (const id of ["inside", "outside"]) graph = G.edit(graph, { type: "add", node: {
    id, kind: "pool", name: id, params: { inputs: ["in:1"] }, position: { x: 0, y: 0 },
  } }).graph;
  graph = G.edit(graph, { type: "connect", from: { node: "source", port: "collection" }, to: { node: "inside", port: "in:1" } }).graph;
  graph = G.edit(graph, { type: "encapsulate", id: "group", selected: ["source", "inside"] }).graph;
  graph = G.edit(graph, { type: "expose", id: "group", boundary: {
    id: "shared", name: "共享集合", direction: "output", type: "collection", target: { node: "source", port: "collection" },
  } }).graph;
  graph = G.edit(graph, { type: "connect", from: { node: "group", port: "shared" }, to: { node: "outside", port: "in:1" } }).graph;
  const result = G.edit(graph, { type: "disconnectPort", from: { node: "group", port: "shared" }, direction: "output" }).graph;
  assert.equal(result.edges.length, graph.edges.length - 1);
  assert.ok(result.edges.some((e) => e.from.node === "source" && e.to.node === "inside"));
});
