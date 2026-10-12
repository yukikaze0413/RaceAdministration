"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fixture = require("../fixtures/cologne2026-pairing-expectations-v1.json");
const {
  pairMajor,
  validateMajorDecision,
} = require("../../src/platform/operations/format-runners/major-pairing");
const normalize = (pairs) =>
  pairs.map((pair) => [...pair].sort().join(":")).sort();
for (const observation of fixture.cases)
  test(`Major policy independent historical ${observation.stage} round ${observation.round}`, () => {
    const rows = structuredClone(observation.rows),
      before = structuredClone(rows),
      result = pairMajor(rows, { round: observation.round });
    assert.equal(result.status, "ready");
    assert.deepEqual(
      normalize(result.pairs),
      normalize(observation.expectedPairs),
    );
    assert.equal(result.bye, null);
    assert.deepEqual(rows, before);
    assert.deepEqual(
      pairMajor([...rows].reverse(), { round: observation.round }),
      result,
    );
  });
function rowsFromRounds(rounds) {
  const rows = Array.from({ length: 16 }, (_, i) => ({
    entrantId: String(i + 1),
    initialSeed: i + 1,
    wins: 0,
    losses: 0,
    opponents: [],
  }));
  for (const round of rounds)
    for (const [a, b, winnerSide] of round) {
      const first = rows[a - 1],
        second = rows[b - 1];
      first[winnerSide === 0 ? "wins" : "losses"]++;
      second[winnerSide === 1 ? "wins" : "losses"]++;
      first.opponents.push(second.entrantId);
      second.opponents.push(first.entrantId);
    }
  return rows.map((row) => ({
    ...row,
    ds: row.opponents.reduce(
      (n, id) => n + rows[Number(id) - 1].wins - rows[Number(id) - 1].losses,
      0,
    ),
  }));
}
test("Major priority exhaustion is a block and never silently permits a rematch", () => {
  // Consistent aggregate history with two odd available components. This is
  // an artificial policy input, not another historical tournament claim.
  const rows = rowsFromRounds([
    [
      [1, 4, 0],
      [2, 5, 0],
      [3, 6, 0],
      [13, 10, 0],
      [14, 11, 0],
      [7, 15, 0],
      [8, 12, 0],
      [9, 16, 0],
    ],
    [
      [1, 5, 1],
      [2, 6, 1],
      [3, 4, 1],
      [13, 7, 0],
      [14, 8, 0],
      [10, 16, 0],
      [11, 15, 0],
      [9, 12, 0],
    ],
    [
      [1, 6, 0],
      [2, 4, 0],
      [3, 5, 0],
      [13, 9, 0],
      [14, 10, 0],
      [7, 16, 0],
      [8, 15, 0],
      [11, 12, 1],
    ],
    [
      [1, 7, 1],
      [2, 8, 1],
      [3, 9, 1],
      [4, 10, 0],
      [5, 11, 0],
      [6, 12, 0],
    ],
  ]);
  const result = pairMajor(rows, { round: 5 });
  assert.equal(result.status, "unsat");
  assert.equal(result.code, "MAJOR_PRIORITY_EXHAUSTED");
  assert.deepEqual(result.pairs, []);
  const pairs = [
    ["1", "4"],
    ["2", "5"],
    ["3", "6"],
  ];
  assert.equal(
    validateMajorDecision(rows, { round: 5 }, pairs, {
      allowRematch: true,
      reason: "全部无重赛优先方案均不可行，裁定此配对",
    }).rematch,
    true,
  );
  for (const options of [
    { allowRematch: false, reason: "裁定" },
    { allowRematch: true, reason: "" },
  ])
    assert.throws(
      () => validateMajorDecision(rows, { round: 5 }, pairs, options),
      { code: "PAIRING_INVALID" },
    );
});
test("Major manual decision cannot grant a rematch when frozen policy has a complete solution", () => {
  const observation = fixture.cases[1];
  assert.throws(
    () =>
      validateMajorDecision(
        observation.rows,
        { round: observation.round },
        observation.expectedPairs,
        { allowRematch: true, reason: "不能绕过可行解" },
      ),
    { code: "PAIRING_INVALID" },
  );
});
test("Major repeated history requires exact symmetric authorization and counts every opponent occurrence in DS", () => {
  const rows = structuredClone(fixture.cases[2].rows);
  for (const row of rows) row.opponents = [row.opponents[0], row.opponents[0]];
  const byId = new Map(rows.map((r) => [r.entrantId, r]));
  for (const row of rows)
    row.ds = row.opponents.reduce(
      (n, id) => n + byId.get(id).wins - byId.get(id).losses,
      0,
    );
  const authorizedRematches = fixture.cases[0].expectedPairs;
  assert.throws(() => pairMajor(rows, { round: 3 }), {
    code: "ROSTER_INVALID",
  });
  assert.equal(
    pairMajor(rows, { round: 3, authorizedRematches }).status,
    "ready",
  );
  assert.throws(
    () =>
      pairMajor(rows, {
        round: 3,
        authorizedRematches: authorizedRematches.slice(1),
      }),
    { code: "ROSTER_INVALID" },
  );
  rows[0].ds++;
  assert.throws(() => pairMajor(rows, { round: 3, authorizedRematches }), {
    code: "ROSTER_INVALID",
  });
});
test("Major rejects duplicate seeds, partial first-round roster and unsupported rounds", () => {
  const rows = fixture.cases[0].rows;
  assert.throws(
    () =>
      pairMajor(
        rows.map((r) => ({ ...r, initialSeed: 1 })),
        { round: 1 },
      ),
    { code: "ROSTER_INVALID" },
  );
  assert.throws(() => pairMajor(rows.slice(0, 8), { round: 1 }), {
    code: "ROSTER_INVALID",
  });
  assert.throws(() => pairMajor(rows, { round: 6 }), { code: "RULE_INVALID" });
  assert.throws(() => pairMajor([null, ...rows.slice(1)], { round: 1 }), {
    code: "ROSTER_INVALID",
  });
});
test("Major lowest available opponent includes whole-band feasibility", () => {
  const rows = rowsFromRounds([
    [
      [1, 13, 0],
      [2, 14, 0],
      [3, 15, 0],
      [4, 16, 0],
      [8, 9, 1],
      [5, 6, 0],
      [7, 10, 1],
      [11, 12, 1],
    ],
    [
      [1, 14, 0],
      [2, 15, 0],
      [3, 16, 0],
      [4, 13, 0],
      [8, 10, 0],
      [9, 11, 1],
      [5, 7, 1],
      [6, 12, 0],
    ],
  ]);
  const result = pairMajor(rows, { round: 3 });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.pairs.slice(2, 6), [
    ["5", "12"],
    ["6", "11"],
    ["7", "8"],
    ["9", "10"],
  ]);
});
test("Major validates complete opponent histories and independently checks DS", () => {
  const rows = fixture.cases[1].rows;
  for (const opponents of [
    [],
    ["NOT_IN_ROSTER"],
    [rows[0].opponents[0], rows[0].opponents[0]],
  ])
    assert.throws(
      () =>
        pairMajor(
          rows.map((r, i) => (i === 0 ? { ...r, opponents } : r)),
          { round: 2 },
        ),
      { code: "ROSTER_INVALID" },
    );
  assert.throws(
    () =>
      pairMajor(
        rows.map((r, i) => (i === 0 ? { ...r, ds: r.ds + 1 } : r)),
        { round: 2 },
      ),
    { code: "ROSTER_INVALID" },
  );
  assert.throws(
    () =>
      pairMajor(
        fixture.cases[0].rows.map((r, i) =>
          i === 0 ? { ...r, opponents: [rows[1].entrantId] } : r,
        ),
        { round: 1 },
      ),
    { code: "ROSTER_INVALID" },
  );
});
