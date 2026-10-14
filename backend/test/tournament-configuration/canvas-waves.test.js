"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
test("v2 migration preserves original, stage members survive encapsulation and transfer is atomic", () => {
  const old = G.sample("single"),
    original = structuredClone(old);
  const g = G.migrate(old).graph;
  assert.deepEqual(old, original);
  assert.equal(g.schemaVersion, "canvas-v2");
  assert.equal(g.stages[0].nodeIds.length, 7);
  assert.ok(
    g.nodes
      .filter((n) => n.kind === "match")
      .every((n) => n.params.batch === undefined),
  );
  const group = G.edit(g, {
    type: "encapsulate",
    selected: ["M1", "M2"],
    id: "group",
  }).graph;
  assert.deepEqual(group.stages, g.stages);
  const pending = G.edit(group, {
    type: "createStage",
    id: "s2",
    name: "第二阶段",
    selected: ["group"],
  });
  assert.equal(pending.requiresConfirmation, true);
  assert.deepEqual(pending.graph, group);
  const moved = G.edit(group, {
    type: "createStage",
    id: "s2",
    name: "第二阶段",
    selected: ["group"],
    confirmed: true,
    expectedDigest: pending.digest,
  }).graph;
  assert.deepEqual(moved.stages[1].nodeIds, ["M1", "M2"]);
});
test("waves are deterministic, stage-local and graph-local, depend on real matches rather than processing depth", () => {
  const g = G.migrate(G.sample("single")).graph;
  const r = G.analyze(g);
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  assert.deepEqual(
    r.wavePlan.waves.map((w) => w.matchIds.length),
    [4, 2, 1],
  );
  const reordered = structuredClone(g);
  reordered.nodes.reverse();
  reordered.edges.reverse();
  assert.deepEqual(G.analyze(reordered).wavePlan.waves, r.wavePlan.waves);
  const grouped = G.edit(g, {
    type: "encapsulate",
    selected: ["M1", "M2"],
    id: "group",
  }).graph;
  const plan = G.analyze(grouped).wavePlan;
  assert.ok(
    plan.waves.every((w) =>
      w.matchIds.every(
        (id) =>
          (grouped.nodes.find((n) => n.id === id).parentId ?? "root") ===
          w.graphId,
      ),
    ),
  );
  assert.equal(new Set(plan.waves.map((w) => w.id)).size, plan.waves.length);
});
test("strict stages await all preceding matches, reverse result routing is invalid", () => {
  const g = G.migrate(G.sample("single")).graph;
  g.stages = [
    { id: "a", name: "A", order: 1, nodeIds: ["M1", "M2", "M3", "M4"] },
    { id: "b", name: "B", order: 2, nodeIds: ["M5", "M6", "M7"] },
  ];
  const r = G.analyze(g);
  assert.equal(r.valid, true);
  const first = r.wavePlan.waves.find((w) => w.stageId === "a");
  assert.ok(
    r.wavePlan.waves
      .filter((w) => w.stageId === "b")
      .every((w) => w.requiresWaveIds.includes(first.id)),
  );
  g.stages[0].order = 2;
  g.stages[1].order = 1;
  assert.ok(
    G.analyze(g).diagnostics.some((d) => d.code === "STAGE_ORDER_CONFLICT"),
  );
});
test("shared collections across subgraphs split waves with occupation dependencies and Swiss rounds remain atomic", () => {
  let g = G.migrate(G.sample("empty")).graph;
  const S = require("../../src/planning-canvas/samples");
  g.nodes.push(
    S.node("source", "source", {
      seats: Array.from({ length: 8 }, (_, i) => ({
        ref: "P" + i,
        label: "P" + i,
      })),
    }),
  );
  for (const id of ["a", "b"]) {
    g = G.edit(g, { type: "preset", name: "single", id }).graph;
    g = G.edit(g, {
      type: "connect",
      from: { node: "source", port: "collection" },
      to: { node: id, port: "collection" },
    }).graph;
  }
  g = G.edit(g, {
    type: "createStage",
    id: "s",
    name: "淘汰赛",
    selected: ["a", "b"],
  }).graph;
  const r = G.analyze(g);
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  assert.ok(
    r.wavePlan.waves.some(
      (w) =>
        w.graphId === "b" &&
        w.requiresWaveIds.some(
          (id) => r.wavePlan.waves.find((x) => x.id === id).graphId === "a",
        ),
    ),
  );
  const swiss = G.analyze(G.migrate(G.sample("swiss-eight")).graph);
  assert.equal(swiss.wavePlan.rounds.length, 5);
  assert.ok(
    swiss.wavePlan.rounds.every(
      (round) =>
        swiss.wavePlan.waves.filter((w) => w.roundIds.includes(round.id))
          .length === 1,
    ),
  );
});
