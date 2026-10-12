"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const { input } = require("../tournament-configuration/compile-fixture");
const {
  createSwissUnit,
  advanceSwiss,
  validateManualPairing,
  pairingInput,
} = require("../../src/platform/operations/format-runners/swiss");
const expectations = require("../fixtures/cologne2026-pairing-expectations-v1.json");
const observations = require("../fixtures/cologne2026-historical-observations-v1.json");
const canonical = (pairs) => pairs.map((p) => [...p].sort().join("|")).sort();
test("Major next-round input derives repeated-history authorization from confirmed actor/reason audit", () => {
  // Artificial aggregate history verifies audit integrity, not round-two policy.
  const {
    swissStandings,
  } = require("../../src/platform/operations/format-runners/swiss-standings");
  const {
    pairMajor,
  } = require("../../src/platform/operations/format-runners/major-pairing");
  const plan = compile(
    input("swiss-threshold-v1", 16, 8, {
      defaultBO: 1,
      overrides: { advancement: 3, elimination: 3 },
    }),
    { configurationId: "c", tournamentId: "T" },
  ).units[0];
  plan.ruleVersion = "major-cologne-2026-v1";
  const unit = createSwissUnit(
    plan,
    expectations.cases[0].rows.map((r) => ({
      entrantId: r.entrantId,
      position: r.initialSeed,
      positionKind: "seed",
    })),
  );
  const first = unit.rounds[0];
  first.confirmed = true;
  for (const match of first.matches)
    match.decision = { kind: "score", scores: [1, 0] };
  const second = structuredClone(first);
  second.number = 2;
  second.pairing = {
    rematch: true,
    decision: { actorId: "authorized-actor", reason: "测试历史审计边界" },
  };
  second.matches.forEach((match, i) => {
    match.decision.scores = i % 2 ? [0, 1] : [1, 0];
  });
  unit.rounds.push(second);
  unit.standings = swissStandings(unit);
  const current = pairingInput(unit);
  assert.equal(current.rows.length, 16);
  assert.equal(current.authorizedRematches.length, 8);
  assert.equal(pairMajor(current.rows, current).status, "ready");
  delete second.pairing.decision.actorId;
  assert.throws(() => pairingInput(unit), { code: "ROSTER_INVALID" });
});
test("Major private runtime rejects incompatible frozen parameters", () => {
  const plan = compile(
    input("swiss-threshold-v1", 16, 8, { winsToQualify: 4 }),
    { configurationId: "c", tournamentId: "T" },
  ).units[0];
  plan.ruleVersion = "major-cologne-2026-v1";
  const entries = expectations.cases[0].rows.map((r) => ({
    entrantId: r.entrantId,
    position: r.initialSeed,
    positionKind: "seed",
  }));
  assert.throws(() => createSwissUnit(plan, entries), { code: "RULE_INVALID" });
});
for (const stage of observations.stages.filter((s) =>
  /^stage[123]$/.test(s.id),
)) {
  test(`Major private runtime reproduces all 33 observed ${stage.id} series and final records`, () => {
    const plan = compile(
      input("swiss-threshold-v1", 16, 8, {
        defaultBO: stage.id === "stage3" ? 3 : 1,
        overrides: { advancement: 3, elimination: 3 },
      }),
      { configurationId: "c", tournamentId: "T" },
    ).units[0];
    plan.ruleVersion = "major-cologne-2026-v1";
    const first = expectations.cases.find(
      (c) => c.stage === stage.id && c.round === 1,
    );
    const unit = createSwissUnit(
      plan,
      first.rows.map((r) => ({
        entrantId: r.entrantId,
        position: r.initialSeed,
        positionKind: "seed",
      })),
    );
    const remaining = structuredClone(stage.matches);
    for (let number = 1; number <= 5; number++) {
      assert.equal(unit.status, "running");
      const round = unit.rounds.at(-1);
      const expected = expectations.cases.find(
        (c) => c.stage === stage.id && c.round === number,
      );
      assert.deepEqual(
        canonical(round.matches.map((m) => m.entrants)),
        canonical(expected.expectedPairs),
      );
      assert.equal(round.pairing.version, "major-cologne-2026-v1");
      if (stage.id === "stage1" && number === 2) {
        const pairs = structuredClone(expected.expectedPairs);
        let candidate;
        for (let i = 0; i < pairs.length && !candidate; i++) {
          for (let j = i + 1; j < pairs.length && !candidate; j++) {
            const row = (id) => unit.standings.find((r) => r.entrantId === id);
            if (row(pairs[i][0]).wins === row(pairs[j][0]).wins) continue;
            const trial = structuredClone(pairs);
            [trial[i][1], trial[j][1]] = [trial[j][1], trial[i][1]];
            if (trial.every(([a, b]) => !row(a).opponents.includes(b)))
              candidate = trial;
          }
        }
        assert.ok(
          candidate,
          "fixture must offer a non-rematch cross-record invalid decision",
        );
        unit.rounds.pop();
        unit.status = "pairing-blocked";
        assert.throws(
          () =>
            validateManualPairing(unit, {
              inputVersion: unit.pairingInputVersion,
              inputHash: unit.pairingInputHash,
              pairs: candidate,
              bye: null,
            }),
          { code: "PAIRING_INVALID" },
        );
        unit.rounds.push(round);
        unit.status = "running";
      }
      for (const match of round.matches) {
        const index = remaining.findIndex(
          (o) =>
            canonical([o.entrantNames])[0] === canonical([match.entrants])[0],
        );
        assert.notEqual(index, -1);
        const observation = remaining.splice(index, 1)[0];
        assert.equal(match.bestOf, observation.bestOf);
        match.decision = {
          kind: "score",
          scores: match.entrants.map(
            (id) => observation.scores[observation.entrantNames.indexOf(id)],
          ),
        };
      }
      advanceSwiss(unit);
    }
    assert.equal(unit.status, "completed");
    assert.equal(remaining.length, 0);
    assert.equal(unit.qualified.length, 8);
    for (const expected of stage.standings) {
      const row = unit.standings.find((r) => r.entrantId === expected.name);
      assert.deepEqual(
        [row.wins, row.losses],
        [expected.wins, expected.losses],
      );
    }
  });
}
