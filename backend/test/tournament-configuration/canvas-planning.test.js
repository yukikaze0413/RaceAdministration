"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
test("canvas Swiss top8 expansion yields exact seven match bracket with future ranked sources", () => {
  const g = G.sample("swiss-eight");
  const r = G.analyze(g);
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  assert.equal(r.matches.length, 7);
  assert.deepEqual(
    r.matches
      .slice(0, 4)
      .map((m) => [m.A.provenance.rank, m.B.provenance.rank]),
    [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ],
  );
  assert.deepEqual(
    r.matches
      .slice(4, 6)
      .map((m) => [m.A.provenance.match, m.B.provenance.match]),
    [
      ["M1", "M2"],
      ["M3", "M4"],
    ],
  );
  assert.equal(r.windows.length, 5);
  assert.ok(r.matches[0].A.label.includes("待解析"));
  const resolved = G.analyze(g, {
    swiss: {
      confirmed: true,
      order: Array.from({ length: 16 }, (_, i) => "P" + (16 - i)),
    },
  });
  assert.equal(resolved.matches[0].A.ref, "P16");
  assert.equal(resolved.matches[0].B.ref, "P9");
  assert.equal(
    G.analyze(g, { swiss: { confirmed: false, order: [] } }).valid,
    false,
  );
});
test("canvas preset static structures reuse exact format topology and stable plan identities", () => {
  for (const [kind, count] of [
    ["single", 7],
    ["gsl", 5],
    ["double", 14],
  ]) {
    const g = G.sample(kind),
      r = G.analyze(g);
    assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
    assert.equal(r.matches.length, count);
    const keys = G.preview(g, "C").matches.map((m) => m.planKey);
    const m = g.nodes.find((n) => n.kind === "match");
    m.name = "改名";
    m.position.x += 500;
    assert.deepEqual(
      G.preview(g, "C").matches.map((m) => m.planKey),
      keys,
    );
  }
});
test("canvas encapsulate exposes terminal winner through nested groups while preserving plans", () => {
  const g = G.sample("swiss-eight");
  const before = G.preview(g, "C");
  const ids = g.nodes.filter((n) => n.kind === "match").map((n) => n.id);
  const a = G.edit(g, {
    type: "encapsulate",
    selected: ids,
    id: "sg",
    name: "八强",
  }).graph;
  assert.deepEqual(G.preview(a, "C"), before);
  assert.equal(
    a.nodes
      .find((n) => n.id === "sg")
      .params.boundaries.filter((b) => b.direction === "output").length,
    8,
  );
  const winner = a.nodes.find((n) => n.id === "sg").params.boundaries.find((b) => b.direction === "output");
  assert.deepEqual(winner.target, { node: "M7", port: "W" });
  assert.equal(winner.type, "seat");
  const b = G.edit(a, {
    type: "encapsulate",
    selected: ["sg", "expand"],
    id: "outer",
    name: "嵌套",
  }).graph;
  const outerWinner = b.nodes.find((n) => n.id === "outer").params.boundaries.find((b) => b.direction === "output");
  assert.deepEqual(outerWinner.target, { node: "sg", port: winner.id });
  assert.equal(G.analyze(b).values.outer[outerWinner.id].seat.provenance.match, "M7");
  assert.deepEqual(G.preview(b, "C"), before);
  assert.deepEqual(
    G.preview(G.edit(b, { type: "ungroup", id: "outer" }).graph, "C"),
    before,
  );
});
test("canvas expander shrink and boundary removal require impact confirmation with stale digest guard", () => {
  const g = G.sample("swiss-eight");
  const action = { type: "update", id: "expand", params: { count: 4 } };
  const pending = G.edit(g, action);
  assert.equal(pending.requiresConfirmation, true);
  assert.deepEqual(pending.graph, g);
  assert.equal(pending.impact.length, 4);
  assert.throws(
    () => G.edit(g, { ...action, confirmed: true, expectedDigest: "old" }),
    /变化/,
  );
  const a = G.edit(g, {
    ...action,
    confirmed: true,
    expectedDigest: pending.digest,
  });
  assert.equal(a.graph.edges.length, g.edges.length - 4);
  const nested = G.edit(g, {
    type: "encapsulate",
    selected: ["M1"],
    id: "sg",
    name: "M1",
  }).graph;
  const boundary = nested.nodes.find((n) => n.id === "sg").params.boundaries[0];
  const deletion = G.edit(nested, {
    type: "removeBoundary",
    id: "sg",
    port: boundary.id,
  });
  assert.ok(deletion.requiresConfirmation);
  assert.deepEqual(deletion.graph, nested);
});
