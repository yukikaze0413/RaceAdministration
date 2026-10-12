"use strict";
const { reject } = require("../../http/errors");
// Private evidence-calculation profile, not a registered TI runtime adapter.
// Weighted opponent percentages and integer floors agree with all frozen
// official rows; the published prose does not define this exact formula.
function observedTiStandings(entrantIds, series) {
  if (
    !Array.isArray(entrantIds) ||
    entrantIds.length !== 16 ||
    entrantIds.some((id) => typeof id !== "string" || !id) ||
    new Set(entrantIds).size !== 16
  )
    reject(422, "ROSTER_INVALID", "TI排名计算需要16个唯一参赛身份。");
  const rows = new Map(
    entrantIds.map((entrantId) => [
      entrantId,
      {
        entrantId,
        wins: 0,
        losses: 0,
        gameWins: 0,
        gameCount: 0,
        totalDuration: 0n,
        opponents: [],
      },
    ]),
  );
  const seriesIds = new Set(),
    gameIds = new Set();
  const invalid = () =>
    reject(422, "RESULT_INVALID", "TI系列比分、逐局胜者或时长不一致。");
  if (!Array.isArray(series) || series.length > 40) invalid();
  for (const match of series) {
    if (
      !match ||
      typeof match !== "object" ||
      typeof match.seriesId !== "string" ||
      !match.seriesId ||
      seriesIds.has(match.seriesId) ||
      !Array.isArray(match.entrantIds) ||
      match.entrantIds.length !== 2 ||
      match.entrantIds[0] === match.entrantIds[1] ||
      match.entrantIds.some((id) => !rows.has(id)) ||
      !Array.isArray(match.scores) ||
      match.scores.length !== 2 ||
      match.scores.some((s) => !Number.isInteger(s) || s < 0 || s > 2) ||
      Math.max(...match.scores) !== 2 ||
      Math.min(...match.scores) >= 2 ||
      !Array.isArray(match.games) ||
      match.games.length !== match.scores[0] + match.scores[1]
    )
      invalid();
    seriesIds.add(match.seriesId);
    const gameWins = [0, 0];
    let duration = 0n;
    for (const game of match.games) {
      if (
        !game ||
        typeof game !== "object" ||
        typeof game.matchId !== "string" ||
        !game.matchId ||
        gameIds.has(game.matchId) ||
        !match.entrantIds.includes(game.winnerId) ||
        !Number.isSafeInteger(game.durationSeconds) ||
        game.durationSeconds <= 0
      )
        invalid();
      gameIds.add(game.matchId);
      gameWins[match.entrantIds.indexOf(game.winnerId)]++;
      duration += BigInt(game.durationSeconds);
    }
    if (gameWins.some((n, i) => n !== match.scores[i])) invalid();
    match.entrantIds.forEach((id, side) => {
      const row = rows.get(id);
      row[match.scores[side] > match.scores[1 - side] ? "wins" : "losses"]++;
      row.gameWins += match.scores[side];
      row.gameCount += match.games.length;
      row.totalDuration += duration;
      row.opponents.push(match.entrantIds[1 - side]);
    });
  }
  const floorRatio = (n, d, scale = 1n) =>
    d === 0n ? 0 : Number((n * scale) / d);
  const ranked = [...rows.values()].map((row) => {
    if (row.wins > 4 || row.losses > 4 || row.wins + row.losses > 5) invalid();
    const opponents = row.opponents.map((id) => rows.get(id));
    return {
      entrantId: row.entrantId,
      wins: row.wins,
      losses: row.losses,
      opponents: [...row.opponents],
      gameWins: row.gameWins,
      gameCount: row.gameCount,
      opponentWins: opponents.reduce((n, r) => n + r.wins, 0),
      gameWinPercentage: floorRatio(
        BigInt(row.gameWins),
        BigInt(row.gameCount),
        100n,
      ),
      opponentGameWinPercentage: floorRatio(
        opponents.reduce((n, r) => n + BigInt(r.gameWins), 0n),
        opponents.reduce((n, r) => n + BigInt(r.gameCount), 0n),
        100n,
      ),
      averageDuration: floorRatio(row.totalDuration, BigInt(row.gameCount)),
    };
  });
  const compare = (a, b) =>
    b.wins - a.wins ||
    a.losses - b.losses ||
    b.opponentWins - a.opponentWins ||
    b.gameWinPercentage - a.gameWinPercentage ||
    b.opponentGameWinPercentage - a.opponentGameWinPercentage ||
    a.averageDuration - b.averageDuration;
  ranked.sort(compare);
  const groups = [];
  ranked.forEach((row, i) => {
    if (!i || compare(ranked[i - 1], row) !== 0) groups.push([]);
    groups.at(-1).push(row.entrantId);
    row.rank =
      i && compare(ranked[i - 1], row) === 0 ? ranked[i - 1].rank : i + 1;
    // Opponent ordering is presentation only; repeated occurrences remain.
    row.opponents.sort();
  });
  const tiedGroups = groups.filter((g) => g.length > 1);
  return {
    version: "ti2026-weighted-observed-v1",
    formulaStatus: "observed-inference",
    status: tiedGroups.length ? "ranking-blocked" : "ready",
    ...(tiedGroups.length ? { code: "TI_COIN_TOSS_REQUIRED" } : {}),
    rows: ranked,
    tiedGroups,
  };
}
module.exports = { observedTiStandings };
