"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
const graph = () => ({
  schemaVersion: "canvas", stages: [{ id: "stage", name: "阶段", order: 1, nodeIds: ["m", "m2"] }],
  nodes: [
    {
      id: "src",
      kind: "source",
      name: "来源",
      params: {
        seats: [
          { ref: "A", label: "A" },
          { ref: "B", label: "B" },
        ],
      },
      position: { x: 0, y: 0 },
    },
    {
      id: "m",
      kind: "match",
      name: "M",
      params: { matchFormat: "bo3" },
      position: { x: 300, y: 0 },
    },
    {
      id: "m2",
      kind: "match",
      name: "M2",
      params: { matchFormat: "bo3" },
      position: { x: 600, y: 0 },
    },
  ],
  edges: [],
});
const edge = (a, p, b, q) => ({
  from: { node: a, port: p },
  to: { node: b, port: q },
});
test("source collection and seed outputs describe initial seats without changing stable port IDs", () => {
  const source = G.analyze(graph()).nodes.find((n) => n.id === "src");
  assert.equal(source.ports.find((p) => p.id === "collection").label, "初始席位集合");
  assert.equal(source.ports.find((p) => p.id === "seeds").label, "初始种子");
});
test("canvas single seat replacement is atomic and invalid candidate preserves original", () => {
  const g = graph();
  const x = G.edit(g, {
    type: "connect",
    ...edge("src", "seat:1", "m", "A"),
  }).graph;
  assert.equal(x.edges.length, 1);
  const y = G.edit(x, {
    type: "connect",
    ...edge("src", "seat:1", "m2", "A"),
  }).graph;
  assert.equal(y.edges.length, 1);
  assert.equal(y.edges[0].to.node, "m2");
  assert.throws(
    () =>
      G.edit(x, { type: "connect", ...edge("src", "collection", "m", "A") }),
    /类型/,
  );
  assert.equal(x.edges[0].to.node, "m");
  assert.equal(g.edges.length, 0);
  assert.deepEqual(
    G.edit(y, { type: "connect", ...edge("src", "seat:1", "m2", "A") }).graph,
    y,
  );
});
test("canvas collection reads branch and cyclic candidate is rejected", () => {
  let g = graph();
  g.nodes.push(
    {
      id: "p",
      kind: "pool",
      name: "P",
      params: { inputs: ["in:1"] },
      position: { x: 0, y: 400 },
    },
    {
      id: "p2",
      kind: "pool",
      name: "P2",
      params: { inputs: ["in:1"] },
      position: { x: 0, y: 700 },
    },
  );
  for (const target of ["p", "p2"])
    g = G.edit(g, {
      type: "connect",
      ...edge("src", "collection", target, "in:1"),
    }).graph;
  assert.equal(g.edges.length, 2);
  assert.equal(g.nodes.find((n) => n.id === "p").params.inputs.length, 2);
  g = G.edit(g, {
    type: "connect",
    ...edge("p", "collection", "p2", "in:2"),
  }).graph;
  assert.throws(
    () =>
      G.edit(g, { type: "connect", ...edge("p2", "collection", "p", "in:2") }),
    /循环/,
  );
});
test("canvas missing Match inputs are byes and runtime fields still reject", () => {
  const g = graph();
  const report = G.analyze(g);
  assert.equal(report.valid, true);
  assert.equal(report.matches.find((m) => m.id === "m").bye, "both");
  assert.equal(report.values.m.W.seat, null);
  assert.equal(report.values.m.L.seat, null);
  const bad = structuredClone(g);
  bad.nodes[1].params.scoreA = 1;
  assert.throws(() => G.parse(bad), /未知/);
});
test("single-sided byes forward the real identity and empty losers through downstream Matches", () => {
  const g = graph();
  g.edges.push({ id: "source", ...edge("src", "seat:1", "m", "B") }, { id: "winner", ...edge("m", "W", "m2", "A") });
  const r = G.analyze(g);
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  assert.equal(r.values.m.W.seat.ref, "A");
  assert.equal(r.values.m.L.seat, null);
  assert.equal(r.values.m2.W.seat.ref, "A");
  assert.equal(r.matches.find((m) => m.id === "m").bye, "A");
  g.edges[1].from.port = "L";
  const empty = G.analyze(g);
  assert.equal(empty.valid, true);
  assert.equal(empty.matches.find((m) => m.id === "m2").bye, "both");
  assert.equal(empty.values.m2.W.seat, null);
});
test("canvas detects same seat in same batch while permitting later round", () => {
  const g = graph();
  g.nodes.push(
    {
      id: "p",
      kind: "pool",
      name: "P",
      params: { inputs: ["in:1"] },
      position: { x: 0, y: 400 },
    },
    {
      id: "x",
      kind: "expander",
      name: "X",
      params: {},
      position: { x: 0, y: 700 },
    },
    {
      id: "y",
      kind: "expander",
      name: "Y",
      params: {},
      position: { x: 0, y: 900 },
    },
  );
  let h = g;
  for (const [i, e] of [
    edge("src", "collection", "p", "in:1"),
    edge("p", "collection", "x", "collection"),
    edge("p", "collection", "y", "collection"),
    edge("x", "seat:1", "m", "A"),
    edge("x", "seat:2", "m", "B"),
    edge("y", "seat:1", "m2", "A"),
    edge("y", "seat:2", "m2", "B"),
  ].entries())
    h.edges.push({ id: "edge" + i, ...e });
  const report = G.analyze(h);
  assert.equal(report.valid, true);
  const m = report.wavePlan.waves.find(w => w.matchIds.includes("m"));
  const m2 = report.wavePlan.waves.find(w => w.matchIds.includes("m2"));
  assert.notEqual(m.id, m2.id);
  assert.ok(m2.requiresWaveIds.includes(m.id));
});
