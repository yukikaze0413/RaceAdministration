"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const source = require("../fixtures/ti2026-official-observations-v1.json");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const {
  createTiCandidateUnit,
  confirmTiCandidateRound,
  chooseTiCandidateOpponent,
} = require("../../src/platform/operations/format-runners/ti-unit-candidate");
const {
  createSwissUnit,
} = require("../../src/platform/operations/format-runners/swiss");
const structure = () => ({
  entrantKind: "individual",
  structureVersion: "structure-v2",
  routingVersion: "routing-v2",
  stages: [
    {
      id: "s",
      name: "TI候选",
      order: 1,
      format: "threshold-swiss",
      ruleVersion: "ti2026-observed-candidate-v1",
      groups: [{ id: "g", stageId: "s" }],
    },
  ],
  pools: [],
  routes: [],
});
const plan = () =>
  compile(structure(), { configurationId: "candidate", tournamentId: "T" })
    .units[0];
const entries = () =>
  [...source.observedInitialPairing.matches]
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel))
    .flatMap((m) => m.entrantIds.map(String))
    .map((entrantId, i) => ({
      entrantId,
      channel: "slot",
      positionKind: "slot",
      position: i + 1,
      initialSeed: i + 1,
    }));
const audit = (u) => ({
  expectedVersion: u.version,
  inputHash: u.inputHash,
  actorId: "candidate-review",
  reason: "工程回放，不是官方选择审计",
});
const key = (ids) => [...ids].sort().join("|");
function results(u, phase = "Swiss") {
  return u.rounds.at(-1).matches.map((m) => {
    const actual = source.phases
      .find((p) => p.name === phase)
      .matches.find((a) => key(a.entrantIds.map(String)) === key(m.entrants));
    assert.ok(actual);
    return {
      matchId: m.id,
      seriesId: String(actual.seriesId),
      scores: m.entrants.map(
        (id) => actual.scores[actual.entrantIds.indexOf(Number(id))],
      ),
      games: actual.games.map((g) => ({ ...g, winnerId: String(g.winnerId) })),
    };
  });
}
function swissEnd() {
  let u = createTiCandidateUnit(plan(), entries());
  for (let i = 0; i < 5; i++)
    u = confirmTiCandidateRound(u, results(u), audit(u));
  return u;
}
test("TI compiled private unit preserves five-round statistics while elimination qualifies actual Swiss ranks nine and eleven", () => {
  let u = swissEnd();
  assert.equal(u.status, "choosing-elimination");
  assert.equal(u.rounds.length, 5);
  assert.equal(u.confirmedSeries.length, 39);
  const rows = structuredClone(u.standings);
  const before = structuredClone(u);
  for (const chooser of u.elimination.choosers) {
    const actual = source.phases
      .find((p) => p.name === "Elimination Round")
      .matches.find((m) => m.entrantIds.includes(Number(chooser.entrantId)));
    u = chooseTiCandidateOpponent(
      u,
      chooser.entrantId,
      String(actual.entrantIds.find((id) => id !== Number(chooser.entrantId))),
      audit(u),
    );
  }
  assert.deepEqual(before.standings, rows);
  assert.equal(before.rounds.length, 5);
  assert.equal(u.rounds.at(-1).phase, "elimination");
  assert.equal(u.rounds.at(-1).matches.length, 5);
  assert.equal(u.rounds.at(-1).planKey, u.plan.windows[5].planKey);
  const ready = structuredClone(u);
  u = confirmTiCandidateRound(u, results(u, "Elimination Round"), audit(u));
  assert.equal(ready.status, "running");
  assert.equal(u.status, "completed");
  assert.equal(u.confirmedSeries.length, 39);
  assert.equal(u.rounds.flatMap((r) => r.matches).length, 44);
  assert.deepEqual(
    u.qualified.map((q) => q.swissRank),
    [1, 2, 3, 4, 5, 6, 9, 11],
  );
  assert.deepEqual(
    u.standings.map(({ qualification, ...r }) => r),
    rows,
  );
  assert.equal(u.standings.find((r) => r.rank === 9).qualification.index, 7);
  assert.equal(u.standings.find((r) => r.rank === 7).qualification, undefined);
  assert.ok(
    u.rounds.every((r) => r.confirmed && r.confirmationDecision.actorId),
  );
});
test("TI private confirmation is atomic, complete and protected by current version/hash", () => {
  const u = createTiCandidateUnit(plan(), entries()),
    before = structuredClone(u),
    r = results(u);
  assert.throws(() => confirmTiCandidateRound(u, r.slice(1), audit(u)), {
    code: "RESULTS_INCOMPLETE",
  });
  const bad = structuredClone(r);
  bad[0].games[0].winnerId = "unknown";
  assert.throws(() => confirmTiCandidateRound(u, bad, audit(u)), {
    code: "RESULT_INVALID",
  });
  assert.throws(
    () => confirmTiCandidateRound(u, r, { ...audit(u), inputHash: "old" }),
    { code: "INPUT_CHANGED" },
  );
  assert.throws(
    () => confirmTiCandidateRound(u, r, { ...audit(u), reason: "" }),
    { code: "INVALID_INPUT" },
  );
  const tampered = structuredClone(u);
  tampered.bindings[0].position = 16;
  assert.throws(() => confirmTiCandidateRound(tampered, r, audit(u)), {
    code: "INPUT_CHANGED",
  });
  assert.deepEqual(u, before);
  const next = confirmTiCandidateRound(u, r, audit(u));
  const saved = structuredClone(next);
  r[0].scores[0] = 99;
  r[0].games[0].durationSeconds = 1;
  assert.deepEqual(next, saved);
  assert.equal(next.version, 1);
  assert.notEqual(next.inputHash, u.inputHash);
  assert.throws(() => confirmTiCandidateRound(next, results(next), audit(u)), {
    code: "INPUT_CHANGED",
  });
});
test("TI private unit serializes pending choices and preserves the completed qualification port", () => {
  let u = JSON.parse(JSON.stringify(swissEnd()));
  const keys = u.plan.windows.map((w) => w.planKey);
  for (const chooser of u.elimination.choosers) {
    const actual = source.phases
      .find((p) => p.name === "Elimination Round")
      .matches.find((m) => m.entrantIds.includes(Number(chooser.entrantId)));
    u = JSON.parse(
      JSON.stringify(
        chooseTiCandidateOpponent(
          u,
          chooser.entrantId,
          String(
            actual.entrantIds.find((id) => id !== Number(chooser.entrantId)),
          ),
          audit(u),
        ),
      ),
    );
  }
  u = JSON.parse(
    JSON.stringify(
      confirmTiCandidateRound(u, results(u, "Elimination Round"), audit(u)),
    ),
  );
  assert.deepEqual(
    u.rounds.map((r) => r.planKey),
    keys,
  );
  assert.throws(() => confirmTiCandidateRound(u, [], audit(u)), {
    code: "ROUND_LOCKED",
  });
  const {
    runtimeSources,
  } = require("../../src/platform/operations/runtime-v2");
  const snapshot = runtimeSources({
    roster: u.bindings.map((b) => ({
      entrantId: b.entrantId,
      initialSeed: b.initialSeed,
      exitState: "active",
    })),
    units: [u],
  }).sourceSnapshots[0];
  assert.equal(snapshot.completed, true);
  const qualified = snapshot.entries
    .filter((r) => r.qualification)
    .sort((a, b) => a.qualification.index - b.qualification.index);
  assert.deepEqual(
    qualified.map((r) => r.rank),
    [1, 2, 3, 4, 5, 6, 9, 11],
  );
  assert.deepEqual(
    qualified.map((r) => r.qualification.index),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});
test("TI unresolved coin ranking blocks the next pairing without fabricating a UUID order", () => {
  const u = createTiCandidateUnit(plan(), entries());
  const r = u.rounds[0].matches.map((m, i) => ({
    matchId: m.id,
    seriesId: "synthetic-" + i,
    scores: [2, 0],
    games: [0, 1].map((j) => ({
      matchId: `synthetic-game-${i}-${j}`,
      winnerId: m.entrants[0],
      durationSeconds: 100,
    })),
  }));
  const next = confirmTiCandidateRound(u, r, audit(u));
  assert.equal(next.status, "pairing-blocked");
  assert.equal(next.rounds.length, 1);
  assert.equal(next.pairingCandidate.code, "TI_COIN_TOSS_REQUIRED");
  assert.ok(next.pairingCandidate.tiedGroups.length);
  assert.equal(next.pairingCandidate.pairs, undefined);
});
test("TI private factory requires its exact compiled profile and explicit organizer slots; generic Swiss cannot consume it", () => {
  const p = plan(),
    e = entries();
  assert.throws(() => createSwissUnit(p, e), { code: "RUN_NOT_SUPPORTED" });
  for (const change of [
    (p) => p.windows.pop(),
    (p) => (p.windows[5].phase = "swiss"),
    (p) => (p.parameters.defaultBO = 5),
    (p) => (p.outputs.qualification[0].source = { kind: "standing", rank: 1 }),
  ]) {
    const bad = structuredClone(p);
    change(bad);
    assert.throws(() => createTiCandidateUnit(bad, e), {
      code: "RULE_INVALID",
    });
  }
  const duplicate = entries();
  duplicate[1].position = duplicate[0].position;
  assert.throws(() => createTiCandidateUnit(p, duplicate), {
    code: "ROSTER_INVALID",
  });
  const u = createTiCandidateUnit(p, e);
  assert.throws(
    () =>
      chooseTiCandidateOpponent(u, e[0].entrantId, e[1].entrantId, audit(u)),
    { code: "SELECTION_LOCKED" },
  );
});
