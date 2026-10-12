"use strict";
// Independent evidence arithmetic only. No production runner imports and no
// generated pairings; matching observed numbers does not establish a rule.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const source = require("../backend/test/fixtures/ti2026-official-observations-v1.json");
const swiss = source.phases.find((p) => p.name === "Swiss"),
  byId = new Map(swiss.standings.map((s) => [s.team_id, s]));
assert.equal(swiss.matches.length, 39);
const games = swiss.matches.flatMap((m) => m.games);
assert.equal(games.length, 97);
assert.equal(new Set(games.map((g) => g.matchId)).size, 97);
const totals = new Map(
  source.teams.map((t) => [
    t.id,
    {
      wins: 0,
      losses: 0,
      gameWins: 0,
      gameCount: 0,
      duration: 0,
      opponents: [],
      nodeIds: [],
    },
  ]),
);
for (const m of swiss.matches) {
  assert.equal(m.games.length, m.scores[0] + m.scores[1]);
  assert.equal(Math.max(...m.scores), 2);
  assert.notEqual(m.entrantIds[0], m.entrantIds[1]);
  for (const g of m.games) {
    assert.ok(m.entrantIds.includes(g.winnerId));
    assert.ok(Number.isInteger(g.durationSeconds) && g.durationSeconds > 0);
  }
  for (let i = 0; i < 2; i++) {
    const id = m.entrantIds[i],
      row = totals.get(id);
    assert.ok(row);
    row.wins += Number(m.scores[i] > m.scores[1 - i]);
    row.losses += Number(m.scores[i] < m.scores[1 - i]);
    row.gameWins += m.scores[i];
    row.gameCount += m.games.length;
    row.duration += m.games.reduce((n, g) => n + g.durationSeconds, 0);
    row.opponents.push(m.entrantIds[1 - i]);
    row.nodeIds.push(m.nodeId);
  }
}
const report = [];
for (const [id, row] of totals) {
  const official = byId.get(id),
    opponents = row.opponents.map((id) => totals.get(id)),
    numerator = opponents.reduce((n, r) => n + r.gameWins, 0),
    denominator = opponents.reduce((n, r) => n + r.gameCount, 0),
    calculated = {
      wins: row.wins,
      losses: row.losses,
      opponentWins: opponents.reduce((n, r) => n + r.wins, 0),
      gameWinPercentage: Math.floor((100 * row.gameWins) / row.gameCount),
      weightedOpponentGameWinPercentage: Math.floor(
        (100 * numerator) / denominator,
      ),
      averageDuration: Math.floor(row.duration / row.gameCount),
    };
  assert.equal(calculated.wins, official.wins);
  assert.equal(calculated.losses, official.losses);
  assert.equal(calculated.opponentWins, official.tiebreak_opponent_match_wins);
  assert.equal(calculated.gameWinPercentage, official.tiebreak_game_win_pct);
  assert.equal(
    calculated.weightedOpponentGameWinPercentage,
    official.tiebreak_opponent_game_win_pct,
  );
  assert.equal(
    calculated.averageDuration,
    official.tiebereak_average_game_length,
  );
  report.push({
    teamId: id,
    name: official.team_name,
    nodeIds: row.nodeIds,
    calculated,
    weightedOpponentRatio: { numerator, denominator },
    arithmeticOpponentPercentage:
      opponents.reduce((n, r) => n + (100 * r.gameWins) / r.gameCount, 0) /
      opponents.length,
  });
}
const result = {
  status: "observed-arithmetic-agrees",
  teamCount: 16,
  seriesCount: 39,
  gameCount: 97,
  limitation:
    "Weighted opponent game percentage and floor precision match all 16 observed values. This is an inference from frozen data, not a published official formula or proof for other inputs. No initial grouping, seed, pairing optimization or coin-toss outcomes are inferred.",
  teams: report,
};
const firstRound = swiss.matches.slice(0, 8),
  initialGroups = Object.fromEntries(
    firstRound.flatMap((m) => {
      const group = m.label.match(/\.([AB])$/)?.[1];
      assert.ok(group);
      return m.entrantIds.map((id) => [id, group]);
    }),
  );
assert.equal(source.observedInitialPairing.sourceId, "ti2026-valve-league");
assert.equal(source.observedInitialPairing.matches.length, 8);
assert.deepEqual(
  source.observedInitialPairing.matches.map((m) => [
    m.nodeId,
    m.label,
    m.entrantIds,
  ]),
  firstRound.map((m) => [m.nodeId, m.label, m.entrantIds]),
);
assert.equal(Object.keys(initialGroups).length, 16);
const rounds = [
    swiss.matches.slice(0, 8),
    swiss.matches.slice(8, 16),
    swiss.matches.slice(16, 24),
    swiss.matches.slice(24, 32),
    swiss.matches.slice(32),
  ],
  records = new Map(source.teams.map((t) => [t.id, [0, 0]])),
  encountered = new Set();
for (let r = 0; r < rounds.length; r++) {
  const appeared = new Set();
  for (const m of rounds[r]) {
    const [a, b] = m.entrantIds,
      pair = [a, b].sort((x, y) => x - y).join(":");
    assert.ok(!encountered.has(pair));
    encountered.add(pair);
    for (const id of [a, b]) {
      assert.ok(!appeared.has(id));
      appeared.add(id);
      assert.ok(records.get(id).every((n) => n < 4));
    }
    assert.deepEqual(records.get(a), records.get(b));
    if (r < 3) assert.equal(initialGroups[a], initialGroups[b]);
    if (r === 3) assert.notEqual(initialGroups[a], initialGroups[b]);
  }
  for (const m of rounds[r])
    m.entrantIds.forEach((id, i) => {
      records.get(id)[m.scores[i] > m.scores[1 - i] ? 0 : 1]++;
    });
}
const elimination = source.phases.find((p) => p.name === "Elimination Round"),
  winners = elimination.matches.map(
    (m) => m.entrantIds[m.scores[0] > m.scores[1] ? 0 : 1],
  ),
  qualified = new Set([
    ...swiss.standings.filter((s) => s.wins === 4).map((s) => s.team_id),
    ...winners,
  ]);
assert.equal(qualified.size, 8);
// All qualifying teams are separated before later percentage/coin-toss fields.
const seeded = swiss.standings
  .filter((s) => qualified.has(s.team_id))
  .sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.tiebreak_opponent_match_wins - a.tiebreak_opponent_match_wins,
  );
for (let i = 1; i < seeded.length; i++)
  assert.ok(
    seeded[i].wins !== seeded[i - 1].wins ||
      seeded[i].losses !== seeded[i - 1].losses ||
      seeded[i].tiebreak_opponent_match_wins !==
        seeded[i - 1].tiebreak_opponent_match_wins,
  );
const seedById = new Map(seeded.map((s, i) => [s.team_id, i + 1]));
result.groupAndSeedingObservations = {
  initialGroups,
  groupingMeaning:
    "A/B interpreted from official first-round match labels; not a separately published numeric initial seed table.",
  roundNodeIds: rounds.map((ms) => ms.map((m) => m.nodeId)),
  allSameRecord: true,
  roundTwoThreeSameGroup: true,
  roundFourOppositeGroup: true,
  repeatOpponentCount: 0,
  qualifiedSwissOrder: seeded.map((s) => ({
    id: s.team_id,
    name: s.team_name,
    seed: seedById.get(s.team_id),
  })),
  observedPlayoffSeedPairs: source.phases
    .find((p) => p.name === "Playoff")
    .matches.filter((m) => m.incomingNodeIds.every((n) => n === 0))
    .map((m) => ({
      nodeId: m.nodeId,
      seedPair: m.entrantIds.map((id) => seedById.get(id)),
    })),
  limitation:
    "Observed playoff pairings are preserved literally. Do not assume 1-vs-8/2-vs-7. Elimination match order does not prove opponent-selection action order; no choice audit was published in these records.",
};
fs.writeFileSync(
  path.resolve(
    __dirname,
    "../openspec/changes/optimize-tournament-planning-and-schedules/evidence/ti2026-arithmetic-check.json",
  ),
  JSON.stringify(result, null, 2) + "\n",
  "utf8",
);
process.stdout.write(
  "TI2026 observed arithmetic: 16 teams, 39 series, 97 unique games agree; official formula remains unverified.\n",
);
