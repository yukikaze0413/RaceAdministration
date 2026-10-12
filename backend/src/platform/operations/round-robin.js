"use strict";
const { randomUUID } = require("node:crypto");
function schedule(ids) {
  const ring = [...ids];
  if (ring.length % 2) ring.push(null);
  const rounds = [];
  for (let n = 1; n < ring.length; n++) {
    const matches = [],
      rest = [];
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i],
        b = ring[ring.length - 1 - i];
      if (a && b)
        matches.push({
          id: randomUUID(),
          entrants: [a, b],
          bye: false,
          submissions: [],
          decision: null,
        });
      else if (a || b) rest.push(a || b);
    }
    rounds.push({
      id: randomUUID(),
      number: n,
      confirmed: false,
      matches,
      rest,
    });
    ring.splice(1, 0, ring.pop());
  }
  return rounds;
}
function scores(m) {
  const [a, b] = m.entrants;
  if (m.decision.kind === "double-loss")
    return [
      [a, 0, 0, 1, 0, 0],
      [b, 0, 0, 1, 0, 0],
    ];
  const [x, y] = m.decision.scores;
  return [
    [
      a,
      x > y ? 3 : x === y ? 1 : 0,
      x > y ? 1 : 0,
      x < y ? 1 : 0,
      x === y ? 1 : 0,
      x - y,
    ],
    [
      b,
      y > x ? 3 : x === y ? 1 : 0,
      y > x ? 1 : 0,
      y < x ? 1 : 0,
      x === y ? 1 : 0,
      y - x,
    ],
  ];
}
function standings(unit) {
  const table = new Map(
    unit.entrants.map((id) => [
      id,
      {
        entrantId: id,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        net: 0,
        headToHead: 0,
      },
    ]),
  );
  const matches = unit.rounds
    .filter((r) => r.confirmed)
    .flatMap((r) => r.matches);
  for (const m of matches)
    for (const [id, p, w, l, d, net] of scores(m)) {
      const x = table.get(id);
      x.points += p;
      x.wins += w;
      x.losses += l;
      x.draws += d;
      x.net += net;
    }
  for (const x of table.values())
    for (const m of matches.filter(
      (m) =>
        m.entrants.includes(x.entrantId) &&
        m.entrants.every((id) => table.get(id).points === x.points),
    ))
      x.headToHead += scores(m).find((r) => r[0] === x.entrantId)[1];
  const compare = (a, b) =>
    b.points - a.points || b.headToHead - a.headToHead || b.net - a.net;
  const ordered = [...table.values()].sort(compare);
  ordered.forEach(
    (x, i) =>
      (x.rank =
        i && compare(ordered[i - 1], x) === 0 ? ordered[i - 1].rank : i + 1),
  );
  return ordered;
}
module.exports = { schedule, standings };
