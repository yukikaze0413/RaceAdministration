"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const source = require("../fixtures/ti2026-official-observations-v1.json");
const {
  tiPairingCandidate,
} = require("../../src/platform/operations/format-runners/ti-pairing-candidate");
const swiss = source.phases.find((p) => p.name === "Swiss");
const entrants = source.teams.map((t) => String(t.id));
const firstPairing = source.observedInitialPairing.matches.map((m) =>
  m.entrantIds.map(String),
);
const initialGroups = source.observedInitialPairing.matches.flatMap((m) =>
  m.entrantIds.map((id) => ({
    entrantId: String(id),
    initialGroup: m.groupLabel,
  })),
);
const rounds = [
  swiss.matches.slice(0, 8),
  swiss.matches.slice(8, 16),
  swiss.matches.slice(16, 24),
  swiss.matches.slice(24, 32),
  swiss.matches.slice(32),
];
const confirmedSeries = (matches) =>
  matches.map((m) => ({
    seriesId: String(m.seriesId),
    entrantIds: m.entrantIds.map(String),
    scores: m.scores,
    games: m.games.map((g) => ({ ...g, winnerId: String(g.winnerId) })),
  }));
const normalize = (pairs) => pairs.map((p) => [...p].sort().join("|")).sort();
function input(round) {
  return {
    entrantIds: entrants,
    initialGroups,
    firstPairing,
    round,
    confirmedSeries: confirmedSeries(rounds.slice(0, round - 1).flat()),
  };
}
for (let round = 1; round <= 5; round++)
  test(`TI distance hypothesis round ${round} includes the observed official pairs among optimal choices`, () => {
    const state = input(round),
      before = structuredClone(state),
      out = tiPairingCandidate(state);
    assert.equal(out.version, "ti2026-distance-candidate-v1");
    assert.equal(out.formulaStatus, "observed-inference");
    assert.equal(out.minimumRepeats, 0);
    assert.deepEqual(state, before);
    if (round === 1) {
      assert.equal(out.status, "ready");
      assert.deepEqual(out.pairs, firstPairing);
    } else {
      assert.ok(["ready", "pairing-choice-required"].includes(out.status));
      assert.equal(out.distance, [0, 12, 14, 8, 13][round - 1]);
      for (const band of out.bandChoices) {
        const observed = rounds[round - 1]
          .filter((m) => band.entrantIds.includes(String(m.entrantIds[0])))
          .map((m) => m.entrantIds.map(String));
        assert.ok(
          band.pairings.some(
            (pairs) =>
              JSON.stringify(normalize(pairs)) ===
              JSON.stringify(normalize(observed)),
          ),
          JSON.stringify(band),
        );
        if (round === 5)
          assert.equal(
            band.direction,
            band.record[1] === 3 ? "maximize" : "minimize",
          );
      }
      if (out.choiceCount > 1) {
        assert.equal(out.status, "pairing-choice-required");
        assert.equal(out.pairs, undefined);
      }
    }
  });
test("TI first-round organizer table, complete initial grouping and current round history are required", () => {
  const state = input(1);
  assert.throws(
    () => tiPairingCandidate({ ...state, firstPairing: undefined }),
    { code: "PAIRING_INVALID" },
  );
  assert.throws(
    () =>
      tiPairingCandidate({ ...state, initialGroups: initialGroups.slice(1) }),
    { code: "ROSTER_INVALID" },
  );
  assert.throws(() => tiPairingCandidate({ ...state, round: 6 }), {
    code: "RULE_INVALID",
  });
  assert.throws(() => tiPairingCandidate({ ...input(2), round: 3 }), {
    code: "ROSTER_INVALID",
  });
});
test("TI candidate search budget exhaustion does not invent an optimal pairing or claim no solution", () => {
  const out = tiPairingCandidate({ ...input(2), nodeBudget: 1 });
  assert.equal(out.status, "solver-limit");
  assert.equal(out.code, "PAIRING_SOLVER_LIMIT");
  assert.equal(out.pairs, undefined);
});
test("TI equally optimal pairings require a choice rather than an identity tie-break", () => {
  // Artificial initial-group constraints test solver ambiguity only. These
  // are not claimed to be the historical grouping of the confirmed matches.
  const state = input(3);
  const a = new Set([
    "9247354",
    "10150538",
    "10136357",
    "9964962",
    "2163",
    "7119388",
    "5017210",
    "8261500",
  ]);
  state.initialGroups = entrants.map((entrantId) => ({
    entrantId,
    initialGroup: a.has(entrantId) ? "A" : "B",
  }));
  const out = tiPairingCandidate(state);
  assert.equal(out.minimumRepeats, 0);
  assert.equal(out.choiceCount, 2);
  assert.equal(out.status, "pairing-choice-required");
  assert.equal(out.pairs, undefined);
  assert.ok(out.bandChoices.some((b) => b.pairings.length === 2));
});
test("TI unavoidable repeated opponent remains an explicit approval block", () => {
  // Artificial current constraints force a previously observed opponent pair.
  const state = input(3);
  const a = new Set([
    "10150413",
    "10136357",
    "2163",
    "7119388",
    "5017210",
    "8261500",
    "2586976",
    "10149530",
  ]);
  state.initialGroups = entrants.map((entrantId) => ({
    entrantId,
    initialGroup: a.has(entrantId) ? "A" : "B",
  }));
  const out = tiPairingCandidate(state);
  assert.equal(out.minimumRepeats, 1);
  assert.equal(out.status, "rematch-approval-required");
  assert.equal(out.pairs, undefined);
});
