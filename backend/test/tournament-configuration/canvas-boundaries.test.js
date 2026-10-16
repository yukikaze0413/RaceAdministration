"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  G = require("../../src/planning-canvas/graph");
test("subgraph exposes all free input and output ports before any display hiding", () => {
  const match = require("../../src/planning-canvas/samples").node("match", "m");
  const original = { schemaVersion: "canvas", stages: [], nodes: [match], edges: [] };
  const g = G.edit(original, { type: "encapsulate", selected: ["m"], id: "sg" }).graph;
  const group = g.nodes.find((n) => n.id === "sg");
  assert.deepEqual(G.ports(g, group).filter((p) => p.direction === "input").map((p) => p.label).sort(), ["Match A", "Match B"]);
  assert.deepEqual(G.ports(g, group).filter((p) => p.direction === "output").map((p) => p.label).sort(), ["Match L · 败者", "Match W · 胜者"]);
  assert.equal(group.display.hideDanglingInputs ?? false, false);
  assert.deepEqual(original.nodes[0], match);
  assert.deepEqual(G.edit(g, { type: "syncBoundaries" }).graph, g);
});
test("custom subgraphs synchronize every free boundary with stable IDs and reject removed switches", () => {
  const original = G.edit(G.sample("swiss-eight"), { type: "encapsulate", selected: ["M1", "M2", "M3", "M4", "M5", "M6", "M7"], id: "legacy" }).graph;
  original.nodes.find((n) => n.id === "legacy").params.boundaries = original.nodes.find((n) => n.id === "legacy").params.boundaries.filter((b) => b.direction !== "output");
  const unchanged = structuredClone(original);
  const synced = G.edit(original, { type: "syncBoundaries" }).graph;
  assert.deepEqual(original, unchanged);
  const outs = synced.nodes.find((n) => n.id === "legacy").params.boundaries.filter((b) => b.direction === "output");
  assert.equal(outs.length, 8);
  assert.deepEqual(outs.find((b) => b.target.port === "W").target, { node: "M7", port: "W" });
  assert.deepEqual(G.edit(synced, { type: "syncBoundaries" }).graph, synced);
  assert.throws(() => G.edit(original, { type: "update", id: "legacy", params: { autoWinnerOutputs: true } }), /未知/);
});
test("canvas selectors and generators reject modes from the wrong component family", () => {
  const g = G.sample("swiss-eight");
  g.nodes.find((n) => n.kind === "selector-top").params.mode = "reverse";
  assert.throws(() => G.parse(g), /未知/);
  const n = require("../../src/planning-canvas/samples").node("generator");
  n.params.mode = "top";
  assert.throws(
    () => G.parse({ schemaVersion: "canvas", stages: [], nodes: [n], edges: [] }),
    /模式/,
  );
});
test("canvas nested match conditions cannot smuggle scores or statistics into saved planning structure", () => {
  const g = G.sample("single");
  g.nodes.find((n) => n.kind === "match").params.condition = { scoreA: 1 };
  assert.throws(() => G.parse(g), /未知/);
});
test("canvas valid Swiss bracket proves distinct rank lineages instead of emitting spurious overlap", () => {
  assert.ok(!G.analyze(G.sample("swiss-eight")).diagnostics.some(d => d.code === "IDENTITY_PENDING"));
});
test("canvas Swiss nested parameter schema rejects runtime fields before saving", () => {
  const g = G.sample("swiss-eight");
  g.nodes.find((n) => n.kind === "swiss").params.parameters.score = 3;
  assert.throws(() => G.parse(g), /未知/);
});
test("canvas new connection refuses determined duplicate assignment atomically", () => {
  const g = G.sample("swiss-eight");
  g.nodes.push({ ...g.nodes.find((n) => n.id === "expand"), id: "second" });
  g.edges.push({
    id: "branch",
    from: { node: "top8", port: "collection" },
    to: { node: "second", port: "collection" },
  });
  const before = structuredClone(g);
  const candidate = G.edit(g, { type: "connect", from: { node: "second", port: "seat:1" }, to: { node: "M2", port: "A" } }).graph;
  assert.equal(G.analyze(candidate).valid, true);
  assert.deepEqual(g, before);
});
test("canvas template subgraph exposes explicit input and qualification, converts before internal editing", () => {
  const g = G.edit(G.sample("empty"), {
    type: "preset",
    name: "single",
    id: "preset",
  }).graph;
  const p = g.nodes.find((n) => n.id === "preset");
  assert.equal(p.kind, "subgraph");
  assert.equal(
    p.params.boundaries.filter((b) => b.direction === "input").length,
    1,
  );
  assert.equal(
    p.params.boundaries.filter((b) => b.direction === "output").length,
    1,
  );
  const match = g.nodes.find((n) => n.kind === "match");
  assert.throws(
    () => G.edit(g, { type: "update", id: match.id, params: { matchFormat: "bo1" } }),
    /自定义/,
  );
  const custom = G.edit(g, { type: "customize", id: "preset" }).graph;
  assert.equal(
    G.edit(custom, {
      type: "update",
      id: match.id,
      params: { matchFormat: "bo1" },
    }).graph.nodes.find((n) => n.id === match.id).params.matchFormat,
    "bo1",
  );
});
test("canvas disconnected boundary validates its mapping type and target instead of waiting for an external edge", () => {
  const g = G.edit(G.sample("empty"), {
    type: "preset",
    name: "single",
    id: "preset",
  }).graph;
  g.nodes.find((n) => n.id === "preset").params.boundaries[0].type = "seat";
  assert.throws(() => G.checkEdges(g), /类型/);
});
test("canvas subgraph collection boundary derives its paired seed map from the same producer", () => {
  let g = G.edit(G.sample("partial-pool"), {
    type: "encapsulate",
    selected: ["pool"],
    id: "sg",
    name: "汇集",
  }).graph;
  g = G.edit(g, {
    type: "expose",
    id: "sg",
    boundary: {
      id: "out",
      name: "集合",
      direction: "output",
      target: { node: "pool", port: "collection" },
    },
  }).graph;
  const n = g.nodes.find((n) => n.id === "sg");
  assert.ok(
    G.ports(g, n).some((p) => p.id === "out:seeds" && p.type === "seed-map"),
  );
  assert.deepEqual(G.analyze(g).values.sg["out:seeds"].mapping, {
    A: 1,
    D: 2,
    C: 3,
    B: 4,
    E: 5,
  });
});
test("canvas preset internal connection edits require conversion as do parameter edits", () => {
  const g = G.edit(G.sample("empty"), {
    type: "preset",
    name: "single",
    id: "preset",
  }).graph;
  assert.throws(
    () => G.edit(g, { type: "disconnect", edgeId: g.edges[0].id }),
    /自定义/,
  );
});
