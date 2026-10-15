"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
const S = require("../../src/planning-canvas/samples");
function selector(kind, count = 2) {
  return {
    schemaVersion: "canvas-v2",
    stages: [],
    nodes: [
      S.node("source", "source", {
        seats: Array.from({ length: 5 }, (_, i) => ({
          ref: "P" + i,
          label: "P" + i,
        })),
      }),
      S.node(kind, "select", { count, showComplement: true }),
      S.node("expander", "out"),
    ],
    edges: [
      {
        id: "a",
        from: { node: "source", port: "collection" },
        to: { node: "select", port: "collection" },
      },
      {
        id: "b",
        from: { node: "select", port: "complement" },
        to: { node: "out", port: "collection" },
      },
    ],
  };
}
test("current canvas rejects previous graph format, removed parameters and old selector", () => {
  const g = G.sample("single");
  assert.equal(g.schemaVersion, "canvas-v2");
  assert.throws(() => G.parse({ ...g, schemaVersion: "canvas-v1" }));
  for (const [kind, params] of [
    ["expander", { count: 4 }],
    ["selector", { mode: "top", count: 2 }],
    ["match", { matchFormat: "bo3", allowedResults: ["win", "loss"] }],
  ]) {
    assert.throws(() =>
      G.parse({
        schemaVersion: "canvas-v2",
        stages: [],
        edges: [],
        nodes: [{ id: "x", name: "X", kind, params, position: { x: 0, y: 0 } }],
      }),
    );
  }
  for (const n of g.nodes.filter((n) => n.kind === "match"))
    assert.deepEqual(
      Object.keys(n.params).filter(
        (k) => !["matchFormat", "condition"].includes(k),
      ),
      [],
    );
});
for (const kind of ["selector-top", "selector-random"]) {
  test(
    kind +
      " partitions one input once, preserves identities and derives complement capacity",
    () => {
      const g = selector(kind);
      const r = G.analyze(g);
      assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
      const chosen = r.values.select.collection.items;
      const complement = r.values.select.complement.items;
      assert.equal(chosen.length, 2);
      assert.equal(complement.length, 3);
      assert.equal(
        new Set([...chosen, ...complement].map((x) => x.ref)).size,
        5,
      );
      assert.ok(!complement.some((s) => chosen.some((c) => c.ref === s.ref)));
      assert.deepEqual(
        complement.map((s) => s.ref),
        ["P0", "P1", "P2", "P3", "P4"].filter(
          (ref) => !chosen.some((c) => c.ref === ref),
        ),
      );
      assert.equal(G.capacity(g, g.nodes[2]), 3);
      assert.equal(
        r.nodes
          .find((n) => n.id === "out")
          .ports.filter((p) => p.direction === "output").length,
        3,
      );
      assert.deepEqual(G.analyze(g).values.select, r.values.select);
      assert.equal(
        Object.keys(r.values.select.complementSeeds.mapping).length,
        3,
      );
    },
  );
}
test("hiding a connected complement requires atomic impact confirmation", () => {
  const g = selector("selector-top");
  const action = {
    type: "update",
    id: "select",
    params: { showComplement: false },
  };
  const pending = G.edit(g, action);
  assert.equal(pending.requiresConfirmation, true);
  assert.deepEqual(pending.graph, g);
  const done = G.edit(g, {
    ...action,
    confirmed: true,
    expectedDigest: pending.digest,
  }).graph;
  assert.equal(done.edges.length, 1);
  assert.ok(!G.ports(done, done.nodes[1]).some((p) => p.id === "complement"));
});
test("expander derives all seats without persisting a quantity", () => {
  const g = selector("selector-top", 5);
  g.edges[1].from.port = "collection";
  assert.equal(G.analyze(g).values.out["seat:5"].seat.ref, "P4");
  assert.throws(() =>
    G.edit(g, { type: "update", id: "out", params: { count: 2 } }),
  );
});
test("disabling complement includes downstream derived seats in the same impact transaction", () => {
  const g = selector("selector-top");
  g.nodes.push(S.node("match", "m"));
  g.stages.push({ id: "stage", name: "比赛", order: 1, nodeIds: ["m"] });
  for (const [i, port] of [
    [1, "A"],
    [2, "B"],
  ])
    g.edges.push({
      id: "seat-" + i,
      from: { node: "out", port: "seat:" + i },
      to: { node: "m", port },
    });
  const action = {
    type: "update",
    id: "select",
    params: { showComplement: false },
  };
  const pending = G.edit(g, action);
  assert.equal(pending.impact.length, 3);
  const next = G.edit(g, {
    ...action,
    confirmed: true,
    expectedDigest: pending.digest,
  }).graph;
  assert.equal(next.edges.length, 1);
  assert.equal(G.analyze(next).values.out["seat:1"], undefined);
});
test("preset readonly capacity is explicitly distinct from an unresolved input collection", () => {
  const g = G.edit(G.sample("empty"), {
    type: "preset",
    id: "p",
    name: "single",
  }).graph;
  const expander = G.analyze(g).nodes.find((n) => n.kind === "expander");
  const props = Object.fromEntries(
    expander.readOnlyProperties.map((p) => [p.key, p]),
  );
  assert.equal(props.count.value, 8);
  assert.equal(props.inputCount.value, null);
  assert.equal(props.status.value, "预设容量，等待集合输入");
});
