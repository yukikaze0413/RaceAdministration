"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const source = require("../fixtures/ti2026-official-observations-v1.json");
const {
  createTiElimination,
  chooseTiOpponent,
  finishTiElimination,
} = require("../../src/platform/operations/format-runners/ti-elimination-candidate");
const swiss = source.phases.find((p) => p.name === "Swiss"),
  elimination = source.phases.find((p) => p.name === "Elimination Round");
function create() {
  return createTiElimination(
    source.teams.map((t) => String(t.id)),
    swiss.matches.map((m) => ({
      seriesId: String(m.seriesId),
      entrantIds: m.entrantIds.map(String),
      scores: m.scores,
      games: m.games.map((g) => ({ ...g, winnerId: String(g.winnerId) })),
    })),
  );
}
const authorize = (state) => ({
  expectedVersion: state.version,
  inputHash: state.inputHash,
  actorId: "test-adjudicator",
  reason: "工程回放的兼容选择，不是官方选择动作记录",
});
function choices() {
  let state = create();
  for (const row of state.choosers) {
    const observation = elimination.matches.find((m) =>
      m.entrantIds.includes(Number(row.entrantId)),
    );
    state = chooseTiOpponent(
      state,
      row.entrantId,
      String(observation.entrantIds.find((id) => id !== Number(row.entrantId))),
      authorize(state),
    );
  }
  return state;
}
function results(state) {
  return state.selections.map((s) => {
    const m = elimination.matches.find((m) =>
      s.entrantIds.every((id) => m.entrantIds.includes(Number(id))),
    );
    return {
      matchId: s.id,
      scores: s.entrantIds.map(
        (id) => m.scores[m.entrantIds.indexOf(Number(id))],
      ),
    };
  });
}
test("TI five ranked opponent choices replay all observed elimination outcomes and eight final Swiss seeds", () => {
  const initial = create();
  assert.equal(initial.status, "choosing");
  assert.deepEqual(
    initial.choosers.map((r) => r.entrantId),
    ["7119388", "10150413", "9247354", "9467224", "10150538"],
  );
  assert.equal(initial.directQualifiers.length, 3);
  const selected = choices(),
    snapshot = structuredClone(selected);
  assert.equal(selected.status, "ready");
  assert.equal(selected.selections.length, 5);
  assert.ok(
    selected.selections.every(
      (s) => s.bestOf === 3 && s.actorId === "test-adjudicator",
    ),
  );
  const complete = finishTiElimination(
    selected,
    results(selected),
    authorize(selected),
  );
  assert.deepEqual(selected, snapshot);
  assert.equal(complete.status, "completed");
  assert.deepEqual(
    complete.qualified.map((q) => q.entrantId),
    [
      "9572001",
      "2163",
      "10136357",
      "7119388",
      "10150413",
      "9247354",
      "8255888",
      "9823272",
    ],
  );
  assert.deepEqual(
    complete.rows.map((r) => [r.entrantId, r.wins, r.losses]),
    initial.rows.map((r) => [r.entrantId, r.wins, r.losses]),
  );
});
test("TI choice rejects stale input, wrong chooser, empty audit and a reused opponent without changing state", () => {
  const state = create(),
    before = structuredClone(state),
    chooser = state.choosers[0].entrantId,
    opponent = state.opponents[0].entrantId;
  for (const audit of [
    { ...authorize(state), expectedVersion: -1 },
    { ...authorize(state), inputHash: "stale" },
  ])
    assert.throws(() => chooseTiOpponent(state, chooser, opponent, audit), {
      code: "INPUT_CHANGED",
    });
  assert.throws(
    () =>
      chooseTiOpponent(
        state,
        state.choosers[1].entrantId,
        opponent,
        authorize(state),
      ),
    { code: "OPPONENT_CHOICE_INVALID" },
  );
  assert.throws(
    () =>
      chooseTiOpponent(state, chooser, opponent, {
        ...authorize(state),
        reason: "",
      }),
    { code: "INVALID_INPUT" },
  );
  const tampered = structuredClone(state);
  tampered.rows[0].opponentWins++;
  assert.throws(
    () => chooseTiOpponent(tampered, chooser, opponent, authorize(tampered)),
    { code: "INPUT_CHANGED" },
  );
  const next = chooseTiOpponent(state, chooser, opponent, authorize(state));
  assert.throws(
    () =>
      chooseTiOpponent(
        next,
        next.choosers[1].entrantId,
        opponent,
        authorize(next),
      ),
    { code: "OPPONENT_CHOICE_INVALID" },
  );
  assert.deepEqual(state, before);
});
test("TI requires all five choices and complete decisive elimination results before qualification", () => {
  const initial = create();
  assert.throws(() => finishTiElimination(initial, [], authorize(initial)), {
    code: "OPPONENT_SELECTION_PENDING",
  });
  const state = choices(),
    before = structuredClone(state),
    valid = results(state);
  assert.throws(
    () => finishTiElimination(state, valid.slice(1), authorize(state)),
    { code: "RESULTS_INCOMPLETE" },
  );
  const draw = structuredClone(valid);
  draw[0].scores = [2, 2];
  assert.throws(() => finishTiElimination(state, draw, authorize(state)), {
    code: "RESULT_INVALID",
  });
  assert.deepEqual(state, before);
});
