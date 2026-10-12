"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const source = require("../fixtures/ti2026-official-observations-v1.json");
const {
  observedTiStandings,
} = require("../../src/platform/operations/format-runners/ti-standings");
const phase = source.phases.find((p) => p.name === "Swiss");
const ids = source.teams.map((t) => String(t.id));
const matches = phase.matches.map((m) => ({
  seriesId: String(m.seriesId),
  entrantIds: m.entrantIds.map(String),
  scores: m.scores,
  games: m.games.map((g) => ({
    matchId: g.matchId,
    winnerId: String(g.winnerId),
    durationSeconds: g.durationSeconds,
  })),
}));
test("TI observed-weighted private standings reproduces all sixteen official Swiss statistic rows", () => {
  const before = structuredClone(matches),
    out = observedTiStandings(ids, matches);
  assert.equal(out.version, "ti2026-weighted-observed-v1");
  assert.equal(out.status, "ready");
  for (const official of phase.standings) {
    const row = out.rows.find((r) => r.entrantId === String(official.team_id));
    assert.deepEqual(
      [
        row.wins,
        row.losses,
        row.opponentWins,
        row.gameWinPercentage,
        row.opponentGameWinPercentage,
        row.averageDuration,
      ],
      [
        official.wins,
        official.losses,
        official.tiebreak_opponent_match_wins,
        official.tiebreak_game_win_pct,
        official.tiebreak_opponent_game_win_pct,
        official.tiebereak_average_game_length,
      ],
    );
  }
  assert.deepEqual(
    out.rows.filter((r) => r.wins === 4).map((r) => r.entrantId),
    ["9572001", "2163", "10136357"],
  );
  assert.deepEqual(matches, before);
  assert.deepEqual(
    observedTiStandings([...ids].reverse(), [...matches].reverse()),
    out,
  );
});
test("TI unresolved coin-toss ranking never falls back to entrant identity or an invented seed", () => {
  const out = observedTiStandings(ids, []);
  assert.equal(out.status, "ranking-blocked");
  assert.equal(out.code, "TI_COIN_TOSS_REQUIRED");
  assert.equal(out.tiedGroups.length, 1);
  assert.equal(out.tiedGroups[0].length, 16);
  assert.ok(out.rows.every((r) => r.rank === 1));
});
test("TI duration totals remain exact even when summation exceeds safe Number range", () => {
  const huge = structuredClone(matches);
  for (const match of huge)
    for (const game of match.games)
      game.durationSeconds = Number.MAX_SAFE_INTEGER;
  const out = observedTiStandings(ids, huge);
  assert.ok(
    out.rows.every((row) => row.averageDuration === Number.MAX_SAFE_INTEGER),
  );
});
test("TI standings rejects unknown winners, conflicting game counts, duplicate games and incomplete roster", () => {
  assert.throws(() => observedTiStandings(ids.slice(1), matches), {
    code: "ROSTER_INVALID",
  });
  for (const change of [
    (m) => {
      m[0].games[0].winnerId = "missing";
    },
    (m) => {
      m[0].games[0].winnerId = m[0].entrantIds[0];
    },
    (m) => {
      m[0].games.pop();
    },
    (m) => {
      m[0].games[1].matchId = m[0].games[0].matchId;
    },
    (m) => {
      m[0].games[0].durationSeconds = 0;
    },
    (m) => {
      m[0].scores = [2, 2];
    },
  ]) {
    const changed = structuredClone(matches);
    change(changed);
    assert.throws(() => observedTiStandings(ids, changed), {
      code: "RESULT_INVALID",
    });
  }
});
