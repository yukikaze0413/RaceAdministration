"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { input } = require("../tournament-configuration/compile-fixture");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const {
  createStaticUnit,
  advanceStatic,
} = require("../../src/platform/operations/format-runners/static");
function create(parameters = {}, kind = "seed") {
  const plan = compile(input("gsl-classic-v1", 4, 2, parameters), {
    configurationId: "c",
    tournamentId: "T",
  }).units[0];
  return createStaticUnit(
    plan,
    ["A", "B", "C", "D"].map((entrantId, i) => ({
      entrantId,
      initialSeed: i + 1,
      channel: kind,
      position: i + 1,
      positionKind: kind,
    })),
  );
}
test("ER1 GSL independent A/B/C/D five games three waves ordered qualifiers and BO", () => {
  const u = create({
    overrides: { opening: 1, winners: 5, elimination: 3, decider: 7 },
  });
  assert.deepEqual(
    u.rounds[0].matches.map((m) => m.entrants),
    [
      ["A", "D"],
      ["B", "C"],
    ],
  );
  assert.deepEqual(
    u.rounds[0].matches.map((m) => m.bestOf),
    [1, 1],
  );
  u.rounds[0].matches.forEach(
    (m) => (m.decision = { kind: "score", scores: [1, 0] }),
  );
  advanceStatic(u);
  const second = u.rounds[1];
  assert.deepEqual(
    second.matches.map((m) => m.entrants),
    [
      ["A", "B"],
      ["D", "C"],
    ],
  );
  assert.deepEqual(
    second.matches.map((m) => m.bestOf),
    [5, 3],
  );
  second.matches[0].decision = { kind: "score", scores: [3, 0] };
  assert.throws(() => advanceStatic(u), { code: "RESULTS_INCOMPLETE" });
  second.matches[1].decision = { kind: "score", scores: [0, 2] };
  advanceStatic(u);
  assert.deepEqual(u.rounds[2].matches[0].entrants, ["B", "C"]);
  assert.equal(u.rounds[2].matches[0].bestOf, 7);
  u.rounds[2].matches[0].decision = { kind: "score", scores: [4, 0] };
  advanceStatic(u);
  assert.equal(u.status, "completed");
  assert.deepEqual(
    u.qualified.map((x) => x.entrantId),
    ["A", "B"],
  );
  assert.deepEqual(
    u.standings.map((x) => [x.entrantId, x.rank, x.wins, x.actualLosses]),
    [
      ["A", 1, 2, 0],
      ["B", 2, 2, 1],
      ["C", 3, 1, 2],
      ["D", 4, 0, 2],
    ],
  );
  assert.equal(u.rounds.flatMap((r) => r.matches).length, 5);
});
test("PR5 GSL seed and absolute physical slots are equivalent across frozen input kinds", () => {
  const slot = create(
    { seeding: { kind: "slot", seedTableVersion: "recursive-v1" } },
    "slot",
  );
  assert.deepEqual(
    slot.rounds[0].matches.map((m) => m.entrants),
    [
      ["A", "B"],
      ["C", "D"],
    ],
  );
  const seed = create({
    seeding: { kind: "slot", seedTableVersion: "recursive-v1" },
  });
  assert.deepEqual(
    seed.rounds[0].matches.map((m) => m.entrants),
    [
      ["A", "D"],
      ["B", "C"],
    ],
  );
});
