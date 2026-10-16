"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
const S = require("../../src/planning-canvas/samples");
function graph(kind, size, parameters = {}, extra = {}) {
  return {
    schemaVersion: "canvas",
    nodes: [
      S.node("source", "src", {
        seats: Array.from({ length: size }, (_, i) => ({
          ref: "P" + i,
          label: "P" + i,
        })),
      }),
      {
        id: "competition",
        kind,
        name: "分组",
        position: { x: 300, y: 40 },
        params: {
          ruleVersion: kind === "swiss" ? "swiss-fixed-v1" : "round-robin-v2",
          parameters,
          ranking: "complete-v1",
          ...extra,
        },
      },
    ],
    edges: [
      {
        id: "input",
        from: { node: "src", port: "collection" },
        to: { node: "competition", port: "collection" },
      },
    ],
    stages: [
      { id: "stage", name: "分组赛", order: 1, nodeIds: ["competition"] },
    ],
  };
}
for (const [size, cycles, roundCount, matchCount] of [
  [4, 1, 3, 6],
  [4, 2, 6, 12],
  [5, 1, 5, 10],
  [5, 2, 10, 20],
]) {
  test(`round robin ${size} entrants ${cycles} cycles uses atomic rounds with compiler fixtures`, () => {
    const g = G.parse(
      graph(
        "round-robin",
        size,
        {},
        {
          ruleVersion:
            cycles === 1 ? "round-robin-v2" : "double-round-robin-v2",
        },
      ),
    );
    const r = G.analyze(g);
    assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
    assert.equal(
      r.matches.length,
      0,
      "fixtures must not become elimination matches",
    );
    assert.equal(r.wavePlan.rounds.length, roundCount);
    assert.equal(r.wavePlan.waves.length, roundCount);
    assert.equal(r.windows.flatMap((w) => w.fixtures).length, matchCount);
    assert.ok(!r.diagnostics.some((d) => d.code === "DYNAMIC_PAIRING_PENDING"));
    const pairs = new Map();
    for (const [i, round] of r.windows.entries()) {
      assert.equal(round.count, Math.floor(size / 2));
      assert.equal(round.rest.length, size % 2);
      const participants = round.fixtures.flatMap((f) => [f.A.ref, f.B.ref]);
      assert.equal(new Set(participants).size, participants.length);
      assert.equal(
        new Set([...participants, ...round.rest.map((s) => s.ref)]).size,
        size,
      );
      const wave = r.wavePlan.waves.find((w) =>
        w.roundIds.includes(round.roundId),
      );
      assert.equal(wave.matchIds.length, 0);
      assert.equal(wave.roundIds.length, 1);
      if (i) assert.ok(wave.requiresWaveIds.includes(r.windows[i - 1].waveId));
      for (const f of round.fixtures) {
        const key = [f.A.ref, f.B.ref].sort().join("/");
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
    assert.ok([...pairs.values()].every((n) => n === cycles));
    assert.deepEqual(G.analyze(g).windows, r.windows);
    assert.equal(r.values.competition.collection.items.length, size);
    assert.ok(
      r.values.competition.collection.items.every((s) =>
        s.ref.startsWith("rank:"),
      ),
    );
    if (cycles === 2) {
      const half = roundCount / 2;
      for (let i = 0; i < half; i++)
        assert.deepEqual(
          r.windows[i].fixtures.map((f) => [f.A.ref, f.B.ref]),
          r.windows[i + half].fixtures.map((f) => [f.B.ref, f.A.ref]),
        );
    }
  });
}
test("Swiss planned capacity checks connected collection and odd rounds have integer match counts", () => {
  const g = graph("swiss", 5, { roundCount: 3 }, { participantCount: 5 });
  const r = G.analyze(G.parse(g));
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  assert.equal(r.wavePlan.rounds.length, 3);
  assert.ok(r.windows.every((w) => w.count === 2 && w.restCount === 1));
  assert.ok(
    r.wavePlan.rounds.every(
      (w) =>
        w.nodeId === "competition" &&
        w.kind === "swiss" &&
        w.nodeId === "competition",
    ),
  );
  g.nodes[1].params.participantCount = 6;
  assert.ok(
    G.analyze(G.parse(g)).diagnostics.some(
      (d) => d.code === "CAPACITY_MISMATCH",
    ),
  );
});
test("unconnected Swiss reserves whole rounds from planned capacity without invented opponents", () => {
  const g = graph("swiss", 8, { roundCount: 3 }, { participantCount: 8 });
  g.edges = [];
  const r = G.analyze(G.parse(g));
  assert.equal(r.wavePlan.rounds.length, 3);
  assert.ok(r.windows.every((w) => w.count === 4 && w.fixtures.length === 0));
  assert.ok(r.diagnostics.some((d) => d.code === "INPUT_REQUIRED"));
});
test("round-robin rejects Swiss rules and unknown capacity never invents fixtures", () => {
  assert.throws(() =>
    G.parse(graph("round-robin", 4, {}, { ruleVersion: "swiss-fixed-v1" })),
  );
  const g = graph("round-robin", 4);
  g.edges = [];
  const r = G.analyze(G.parse(g));
  assert.equal(r.windows.length, 0);
  assert.equal(r.valid, false);
});
test("round-robin sample migrates with stage membership and complete ranking resolution", () => {
  const g = G.sample("round-robin");
  const n = g.nodes.find((n) => n.kind === "round-robin");
  assert.ok(n);
  assert.ok(g.stages[0].nodeIds.includes(n.id));
  const r = G.analyze(g, {
    [n.id]: { confirmed: true, order: ["P4", "P3", "P2", "P1"] },
  });
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  assert.equal(r.values[n.id].collection.items[0].ref, "P4");
});
test("Swiss and round-robin reserve shared participants through the same round scheduler", () => {
  const g = graph("swiss", 4, { roundCount: 3 });
  g.nodes.push(S.node("round-robin", "group"));
  g.edges.push({
    id: "second-input",
    from: { node: "src", port: "collection" },
    to: { node: "group", port: "collection" },
  });
  g.stages[0].nodeIds.push("group");
  const r = G.analyze(G.parse(g));
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  assert.equal(r.wavePlan.rounds.length, 6);
  assert.equal(r.wavePlan.waves.length, 6);
  assert.ok(r.wavePlan.waves.every((w) => w.roundIds.length === 1));
});
test("round-robin ranking downstream waits for its final round", () => {
  const g = graph("round-robin", 4);
  g.nodes.push(
    S.node("expander", "expand"),
    S.node("match", "playoff"),
  );
  g.edges.push(
    {
      id: "ranks",
      from: { node: "competition", port: "collection" },
      to: { node: "expand", port: "collection" },
    },
    {
      id: "A",
      from: { node: "expand", port: "seat:1" },
      to: { node: "playoff", port: "A" },
    },
    {
      id: "B",
      from: { node: "expand", port: "seat:2" },
      to: { node: "playoff", port: "B" },
    },
  );
  g.stages.push({ id: "cut", name: "淘汰赛", order: 2, nodeIds: ["playoff"] });
  const r = G.analyze(G.parse(g));
  assert.equal(r.valid, true, JSON.stringify(r.diagnostics));
  const last = r.wavePlan.rounds.at(-1).waveId;
  const final = r.wavePlan.waves.find((w) => w.matchIds.includes("playoff"));
  assert.ok(final.requiresWaveIds.includes(last));
  assert.equal(r.matches[0].A.ref, "rank:competition:1");
});
test("ranking rules reject invalid order and fixed draw bypasses", () => {
  const g = graph("round-robin", 4, {
    tiebreakers: ["netGames", "points", "manual-with-reason"],
  });
  assert.equal(G.analyze(G.parse(g)).valid, false);
  assert.throws(() =>
    G.parse(
      graph(
        "swiss",
        16,
        { allowDraw: true },
        { ruleVersion: "major-cologne-2026-v1" },
      ),
    ),
  );
  assert.throws(() => G.parse(graph("swiss", 4, {}, { participantCount: 65 })));
});
