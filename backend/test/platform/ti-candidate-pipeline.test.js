"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const source = require("../fixtures/ti2026-official-observations-v1.json");
const {
  tiPairingCandidate,
} = require("../../src/platform/operations/format-runners/ti-pairing-candidate");
const {
  createTiElimination,
  chooseTiOpponent,
  finishTiElimination,
} = require("../../src/platform/operations/format-runners/ti-elimination-candidate");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const {
  createStaticUnit,
  advanceStatic,
} = require("../../src/platform/operations/format-runners/static");
const { input } = require("../tournament-configuration/compile-fixture");
const key = (ids) => [...ids].sort().join("|");
test("TI candidate private pipeline replays 39 Swiss, five selected elimination and fourteen observed playoff nodes", () => {
  const swiss = source.phases.find((p) => p.name === "Swiss"),
    elimination = source.phases.find((p) => p.name === "Elimination Round"),
    playoffs = source.phases.find((p) => p.name === "Playoff");
  const entrants = source.teams.map((t) => String(t.id));
  const first = source.observedInitialPairing.matches;
  const initialGroups = first.flatMap((m) =>
    m.entrantIds.map((id) => ({
      entrantId: String(id),
      initialGroup: m.groupLabel,
    })),
  );
  const firstPairing = first.map((m) => m.entrantIds.map(String));
  const confirmedSeries = [],
    remainingSwiss = structuredClone(swiss.matches);
  for (let round = 1; round <= 5; round++) {
    const out = tiPairingCandidate({
      round,
      entrantIds: entrants,
      initialGroups,
      firstPairing,
      confirmedSeries,
    });
    assert.equal(out.status, "ready");
    for (const pair of out.pairs) {
      const at = remainingSwiss.findIndex(
        (m) => key(m.entrantIds.map(String)) === key(pair),
      );
      assert.notEqual(at, -1);
      const match = remainingSwiss.splice(at, 1)[0];
      confirmedSeries.push({
        seriesId: String(match.seriesId),
        entrantIds: pair,
        scores: pair.map(
          (id) => match.scores[match.entrantIds.indexOf(Number(id))],
        ),
        games: match.games.map((g) => ({ ...g, winnerId: String(g.winnerId) })),
      });
    }
  }
  assert.equal(confirmedSeries.length, 39);
  assert.equal(remainingSwiss.length, 0);
  let selected = createTiElimination(entrants, confirmedSeries);
  const audit = () => ({
    expectedVersion: selected.version,
    inputHash: selected.inputHash,
    actorId: "candidate-test",
    reason: "兼容历史结果的工程回放；没有官方选择动作日志",
  });
  for (const chooser of selected.choosers) {
    const match = elimination.matches.find((m) =>
      m.entrantIds.includes(Number(chooser.entrantId)),
    );
    selected = chooseTiOpponent(
      selected,
      chooser.entrantId,
      String(match.entrantIds.find((id) => id !== Number(chooser.entrantId))),
      audit(),
    );
  }
  const results = selected.selections.map((s) => {
    const match = elimination.matches.find(
      (m) => key(m.entrantIds.map(String)) === key(s.entrantIds),
    );
    return {
      matchId: s.id,
      scores: s.entrantIds.map(
        (id) => match.scores[match.entrantIds.indexOf(Number(id))],
      ),
    };
  });
  selected = finishTiElimination(selected, results, audit());
  assert.equal(selected.qualified.length, 8);
  // Literal observed slot mapping: it is supplied evidence, not an inferred
  // universal TI seed table or a claim of official seed-to-slot action logs.
  const slotsByQualifiedIndex = [3, 5, 7, 2, 1, 8, 4, 6];
  const plan = compile(
    input("de-standard-v1", 8, 1, {
      seeding: { kind: "slot", seedTableVersion: "recursive-v1" },
      overrides: { final: 5 },
      finalReset: false,
    }),
    { configurationId: "candidate", tournamentId: "T" },
  ).units[0];
  const unit = createStaticUnit(
    plan,
    selected.qualified.map((q, i) => ({
      entrantId: q.entrantId,
      initialSeed: q.index,
      channel: "upper",
      positionKind: "slot",
      position: slotsByQualifiedIndex[i],
    })),
  );
  const remaining = structuredClone(playoffs.matches),
    observedIds = new Map();
  while (unit.status === "running") {
    const round = unit.rounds.find((r) => !r.confirmed);
    for (const match of round.matches) {
      const at = remaining.findIndex(
        (m) => key(m.entrantIds.map(String)) === key(match.entrants),
      );
      assert.notEqual(at, -1, JSON.stringify(match.entrants));
      const observation = remaining.splice(at, 1)[0];
      assert.equal(match.bestOf, observation.nodeType === 3 ? 5 : 3);
      const planned = plan.matches.find((m) => m.planKey === match.planKey);
      assert.deepEqual(
        planned.sources
          .map((s) => (s.matchKey ? observedIds.get(s.matchKey) : 0))
          .sort((a, b) => a - b),
        [...observation.incomingNodeIds].sort((a, b) => a - b),
      );
      observedIds.set(match.planKey, observation.nodeId);
      match.decision = {
        kind: "score",
        scores: match.entrants.map(
          (id) =>
            observation.scores[observation.entrantIds.indexOf(Number(id))],
        ),
      };
    }
    advanceStatic(unit);
  }
  assert.equal(remaining.length, 0);
  assert.equal(unit.rounds.flatMap((r) => r.matches).length, 14);
  for (const planned of plan.matches) {
    const targetId = observedIds.get(planned.planKey);
    for (const edge of planned.sources.filter((s) => s.matchKey)) {
      const original = playoffs.matches.find(
        (m) => m.nodeId === observedIds.get(edge.matchKey),
      );
      assert.equal(
        edge.kind === "winner" ? original.winningNodeId : original.losingNodeId,
        targetId,
      );
    }
  }
  for (const official of playoffs.standings)
    assert.equal(
      unit.standings.find((r) => r.entrantId === String(official.team_id)).rank,
      official.standing,
    );
  assert.equal(unit.standings.find((r) => r.rank === 1).entrantId, "7119388");
  assert.equal(
    confirmedSeries.length + selected.selections.length + observedIds.size,
    58,
  );
});
