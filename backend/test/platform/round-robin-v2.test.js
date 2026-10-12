"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const { input } = require("../tournament-configuration/compile-fixture");
const {
  createRoundRobin,
  advanceRoundRobin,
} = require("../../src/platform/operations/format-runners/round-robin");
function unit(n = 4, cycle = 1, p = {}) {
  const plan = compile(
    input(cycle === 1 ? "round-robin-v2" : "double-round-robin-v2", n, 2, p),
    { configurationId: "c", tournamentId: "T" },
  ).units[0];
  return createRoundRobin(
    plan,
    Array.from({ length: n }, (_, i) => ({
      entrantId: "e" + (i + 1),
      position: i + 1,
      positionKind: "seed",
    })),
  );
}
test("SC1 round-robin frozen compiled keys cover all pairs, double cycle swaps sides, odd rest is not a bye win", () => {
  for (const n of [4, 5])
    for (const cycle of [1, 2]) {
      const u = unit(n, cycle),
        matches = u.rounds.flatMap((r) => r.matches);
      assert.equal(matches.length, ((n * (n - 1)) / 2) * cycle);
      assert.equal(new Set(matches.map((m) => m.planKey)).size, matches.length);
      const pairs = new Map();
      for (const m of matches) {
        const key = [...m.entrants].sort().join("/");
        pairs.set(key, (pairs.get(key) || 0) + 1);
        assert.equal(m.bye, false);
      }
      assert.ok([...pairs.values()].every((count) => count === cycle));
      if (cycle === 2) {
        const first = u.rounds
            .slice(0, u.rounds.length / 2)
            .flatMap((r) => r.matches),
          second = u.rounds
            .slice(u.rounds.length / 2)
            .flatMap((r) => r.matches);
        first.forEach((m, i) =>
          assert.deepEqual(second[i].entrants, [...m.entrants].reverse()),
        );
      }
      while (u.status === "running") {
        const r = u.rounds.find((r) => !r.confirmed);
        r.matches.forEach(
          (m) => (m.decision = { kind: "score", scores: [2, 0] }),
        );
        advanceRoundRobin(u);
      }
      assert.equal(
        u.standings.reduce((sum, r) => sum + r.wins, 0),
        matches.length,
      );
      assert.ok(u.standings.every((r) => r.byeCount === 0));
    }
});
test("SC1 round-robin uses frozen configurable points and exact fixed tied-set head-to-head, draws and double loss", () => {
  const u = unit(4, 1, {
      allowDraw: true,
      points: { win: 5, draw: 2, loss: 0, doubleLoss: 0 },
    }),
    r = u.rounds[0];
  r.matches[0].decision = { kind: "score", scores: [1, 1] };
  r.matches[1].decision = { kind: "double-loss" };
  advanceRoundRobin(u);
  assert.equal(u.standings.find((r) => r.entrantId === "e1").points, 2);
  assert.equal(u.standings.find((r) => r.entrantId === "e4").draws, 1);
  assert.equal(u.standings.find((r) => r.entrantId === "e2").losses, 1);
  assert.ok(u.standings.every((r) => r.netGames === 0));
});
