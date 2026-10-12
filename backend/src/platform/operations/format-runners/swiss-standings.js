"use strict";
const { reject } = require("../../http/errors");
const exact = (n) => BigInt(n ?? 0);
const jsonNumber = (n) =>
  n <= BigInt(Number.MAX_SAFE_INTEGER) && n >= BigInt(Number.MIN_SAFE_INTEGER)
    ? Number(n)
    : n.toString();
function rankRows(input, fields) {
  const rows = structuredClone(input),
    byId = new Map(rows.map((r) => [r.entrantId, r]));
  for (const r of rows) {
    r.bhPoints = jsonNumber(
      (r.opponents ?? []).reduce(
        (sum, id) => sum + exact(byId.get(id).points),
        0n,
      ),
    );
    r.ds = (r.opponents ?? []).reduce(
      (sum, id) => sum + byId.get(id).wins - byId.get(id).losses,
      0,
    );
  }
  function compare(a, b) {
    for (const field of fields) {
      if (field === "manual-with-reason") continue;
      const av =
        field === "record"
          ? BigInt(a.wins) * 100n - BigInt(a.losses)
          : exact(
              field === "BH-points-v1"
                ? a.bhPoints
                : field === "DS-wl-v1"
                  ? a.ds
                  : field === "head-to-head-v1"
                    ? a.headToHead
                    : a[field],
            );
      const bv =
        field === "record"
          ? BigInt(b.wins) * 100n - BigInt(b.losses)
          : exact(
              field === "BH-points-v1"
                ? b.bhPoints
                : field === "DS-wl-v1"
                  ? b.ds
                  : field === "head-to-head-v1"
                    ? b.headToHead
                    : b[field],
            );
      if (av !== bv)
        return (av < bv ? -1 : 1) * (field === "initialSeed" ? 1 : -1);
    }
    return 0;
  }
  rows.sort(compare);
  let rank = 1;
  rows.forEach((r, i) => {
    if (i && compare(rows[i - 1], r) !== 0) rank = i + 1;
    r.rank = rank;
  });
  return rows;
}
function swissStandings(unit) {
  const p = unit.plan.parameters,
    points = p.points ?? { win: 1, draw: 0, loss: 0, doubleLoss: 0 };
  const rows = new Map(
    unit.bindings.map((b) => [
      b.entrantId,
      {
        entrantId: b.entrantId,
        initialSeed: b.initialSeed,
        wins: 0,
        losses: 0,
        actualLosses: 0,
        draws: 0,
        points: 0,
        netGames: 0,
        byeCount: 0,
        opponents: [],
      },
    ]),
  );
  const totals = new Map(unit.bindings.map((b) => [b.entrantId, 0n]));
  const add = (r, key) =>
    totals.set(r.entrantId, totals.get(r.entrantId) + exact(points[key]));
  for (const round of unit.rounds.filter((r) => r.confirmed))
    for (const m of round.matches) {
      if (m.bye) {
        const r = rows.get(m.decision.winnerId);
        r.wins++;
        r.byeCount++;
        add(r, "win");
        continue;
      }
      const [a, b] = m.entrants.map((id) => rows.get(id)),
        d = m.decision;
      if (!a || !b || !d)
        reject(409, "RESULTS_INCOMPLETE", "确认轮存在不完整赛果。");
      a.opponents.push(b.entrantId);
      b.opponents.push(a.entrantId);
      if (d.kind === "double-loss") {
        for (const r of [a, b]) {
          r.losses++;
          r.actualLosses++;
          add(r, "doubleLoss");
        }
        continue;
      }
      const diff = d.scores[0] - d.scores[1];
      a.netGames += diff;
      b.netGames -= diff;
      if (diff === 0) {
        for (const r of [a, b]) {
          r.draws++;
          add(r, "draw");
        }
      } else {
        const winner = diff > 0 ? a : b,
          loser = diff > 0 ? b : a;
        winner.wins++;
        loser.losses++;
        loser.actualLosses++;
        add(winner, "win");
        add(loser, "loss");
      }
    }
  for (const r of rows.values()) r.points = jsonNumber(totals.get(r.entrantId));
  return rankRows([...rows.values()], p.tiebreakers);
}
module.exports = { swissStandings, rankRows };
