"use strict";
const { reject } = require("../../http/errors");
// Valve Major supplemental rulebook a22f91da503d3afc00045fdad339bc6a3cd19c98.
// This policy is not yet registered as a runnable Cologne event adapter.
const priority = [
  [
    [1, 6],
    [2, 5],
    [3, 4],
  ],
  [
    [1, 6],
    [2, 4],
    [3, 5],
  ],
  [
    [1, 5],
    [2, 6],
    [3, 4],
  ],
  [
    [1, 5],
    [2, 4],
    [3, 6],
  ],
  [
    [1, 4],
    [2, 6],
    [3, 5],
  ],
  [
    [1, 4],
    [2, 5],
    [3, 6],
  ],
  [
    [1, 6],
    [2, 3],
    [4, 5],
  ],
  [
    [1, 5],
    [2, 3],
    [4, 6],
  ],
  [
    [1, 3],
    [2, 6],
    [4, 5],
  ],
  [
    [1, 3],
    [2, 5],
    [4, 6],
  ],
  [
    [1, 4],
    [2, 3],
    [5, 6],
  ],
  [
    [1, 3],
    [2, 4],
    [5, 6],
  ],
  [
    [1, 2],
    [3, 6],
    [4, 5],
  ],
  [
    [1, 2],
    [3, 5],
    [4, 6],
  ],
  [
    [1, 2],
    [3, 4],
    [5, 6],
  ],
];
function pairMajor(rows, { round, authorizedRematches = [] } = {}) {
  if (!Number.isInteger(round) || round < 1 || round > 5)
    reject(422, "RULE_INVALID", "Major配对轮次必须为1至5。");
  if (
    !Array.isArray(rows) ||
    rows.length !== 16 ||
    rows.some((r) => !r || typeof r !== "object" || Array.isArray(r)) ||
    new Set(rows.map((r) => r.entrantId)).size !== rows.length ||
    new Set(rows.map((r) => r.initialSeed)).size !== rows.length ||
    rows.some(
      (r) =>
        typeof r.entrantId !== "string" ||
        !r.entrantId ||
        !Number.isInteger(r.initialSeed) ||
        r.initialSeed < 1 ||
        r.initialSeed > 16 ||
        !Number.isInteger(r.wins) ||
        !Number.isInteger(r.losses) ||
        r.wins < 0 ||
        r.losses < 0 ||
        r.wins > 3 ||
        r.losses > 3 ||
        r.wins + r.losses > round - 1 ||
        (r.wins < 3 && r.losses < 3 && r.wins + r.losses !== round - 1) ||
        !Number.isSafeInteger(r.ds) ||
        !Array.isArray(r.opponents) ||
        r.opponents.length !== r.wins + r.losses ||
        r.opponents.some((id) => typeof id !== "string" || id === r.entrantId),
    )
  )
    reject(
      422,
      "ROSTER_INVALID",
      "Major配对需要完整、唯一且符合当前轮战绩的入口。",
    );
  const byId = new Map(rows.map((r) => [r.entrantId, r]));
  const pairKey = (a, b) => JSON.stringify([a, b].sort());
  const approved = new Map();
  if (
    !Array.isArray(authorizedRematches) ||
    authorizedRematches.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        p[0] === p[1] ||
        p.some((id) => !byId.has(id)),
    )
  )
    reject(422, "ROSTER_INVALID", "Major历史重赛授权记录无效。");
  for (const [a, b] of authorizedRematches) {
    const key = pairKey(a, b);
    approved.set(key, (approved.get(key) ?? 0) + 1);
  }
  const count = (a, b) => byId.get(a).opponents.filter((id) => id === b).length;
  for (const [a, b] of authorizedRematches)
    if (
      count(a, b) !== 1 + approved.get(pairKey(a, b)) ||
      count(a, b) !== count(b, a)
    )
      reject(422, "ROSTER_INVALID", "Major历史重赛授权与双方对手次数不一致。");
  if (
    rows.reduce((n, r) => n + r.wins, 0) !==
      rows.reduce((n, r) => n + r.losses, 0) ||
    rows.some(
      (row) =>
        row.opponents.some(
          (id) =>
            !byId.has(id) ||
            count(row.entrantId, id) !== count(id, row.entrantId) ||
            count(row.entrantId, id) !==
              1 + (approved.get(pairKey(row.entrantId, id)) ?? 0),
        ) ||
        row.ds !==
          row.opponents.reduce(
            (sum, id) => sum + byId.get(id).wins - byId.get(id).losses,
            0,
          ),
    )
  )
    reject(422, "ROSTER_INVALID", "Major对手历史或DS与完整名单不一致。");
  const active = rows.filter((r) => r.wins < 3 && r.losses < 3);
  if (active.length !== [16, 16, 16, 12, 6][round - 1])
    reject(422, "ROSTER_INVALID", "Major当前轮的活动名单数量不一致。");
  const sorted = [...active].sort(
      (a, b) =>
        b.wins - a.wins ||
        a.losses - b.losses ||
        b.ds - a.ds ||
        a.initialSeed - b.initialSeed,
    ),
    rematch = (a, b) =>
      byId.get(a).opponents.includes(b) || byId.get(b).opponents.includes(a);
  let nodes = 0,
    limited = false;
  const pairs = [],
    groups = new Map(),
    budget = 250000;
  const blocked = () => ({
    status: limited ? "solver-limit" : "unsat",
    code: limited ? "PAIRING_SOLVER_LIMIT" : "MAJOR_PRIORITY_EXHAUSTED",
    pairs: [],
    bye: null,
    cost: null,
    nodes,
  });
  if (round === 1) {
    const initial = [...rows].sort((a, b) => a.initialSeed - b.initialSeed);
    return {
      status: "ready",
      pairs: initial
        .slice(0, 8)
        .map((r, i) => [r.entrantId, initial[i + 8].entrantId]),
      bye: null,
      cost: null,
      nodes: 0,
    };
  }
  for (const row of sorted) {
    const key = row.wins + ":" + row.losses;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.entrantId);
  }
  // Candidates descend from the lowest available seed. Backtracking checks
  // availability for the whole band; it never crosses a record band.
  function complete(names) {
    if (++nodes > budget) {
      limited = true;
      return null;
    }
    if (!names.length) return [];
    const a = names[0];
    for (let i = names.length - 1; i > 0; i--) {
      const b = names[i];
      if (rematch(a, b)) continue;
      const rest = complete(names.slice(1, i).concat(names.slice(i + 1)));
      if (rest) return [[a, b], ...rest];
      if (limited) return null;
    }
    return null;
  }
  for (const names of groups.values()) {
    if (names.length % 2) return blocked();
    if (round <= 3) {
      const chosen = complete(names);
      if (!chosen) return blocked();
      pairs.push(...chosen);
    } else {
      if (names.length !== 6) return blocked();
      let chosen;
      for (const row of priority) {
        nodes++;
        const candidate = row.map(([a, b]) => [names[a - 1], names[b - 1]]);
        if (!candidate.some(([a, b]) => rematch(a, b))) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) return blocked();
      pairs.push(...chosen);
    }
  }
  return { status: "ready", pairs, bye: null, cost: null, nodes };
}
function validateMajorDecision(
  rows,
  input,
  pairs,
  { allowRematch = false, reason } = {},
) {
  const expected = pairMajor(rows, input);
  const active = rows.filter((r) => r.wins < 3 && r.losses < 3);
  const byId = new Map(active.map((r) => [r.entrantId, r]));
  if (
    typeof allowRematch !== "boolean" ||
    !Array.isArray(pairs) ||
    pairs.length !== active.length / 2 ||
    pairs.some(
      (p) =>
        !Array.isArray(p) || p.length !== 2 || p.some((id) => !byId.has(id)),
    ) ||
    new Set(pairs.flat()).size !== active.length ||
    pairs.some(
      ([a, b]) =>
        byId.get(a).wins !== byId.get(b).wins ||
        byId.get(a).losses !== byId.get(b).losses,
    )
  )
    reject(422, "PAIRING_INVALID", "Major裁定必须完整覆盖同战绩活动名单。");
  const normalize = (list) =>
    list.map((p) => JSON.stringify([...p].sort())).sort();
  if (expected.status === "ready") {
    if (
      allowRematch ||
      JSON.stringify(normalize(pairs)) !==
        JSON.stringify(normalize(expected.pairs))
    )
      reject(
        422,
        "PAIRING_INVALID",
        "存在完整无重赛方案，不能替换冻结Major配对政策。",
      );
    return { rematch: false };
  }
  if (
    expected.status !== "unsat" ||
    !allowRematch ||
    typeof reason !== "string" ||
    !reason.trim() ||
    reason.length > 500
  )
    reject(
      422,
      "PAIRING_INVALID",
      "仅在完整搜索证明无重赛方案不可行后，才能明确确认并留因裁定重赛。",
    );
  const rematch = pairs.some(([a, b]) => byId.get(a).opponents.includes(b));
  if (!rematch)
    reject(422, "PAIRING_INVALID", "此裁定未对应已核验的无重赛阻塞。");
  return { rematch: true };
}
module.exports = { pairMajor, validateMajorDecision };
