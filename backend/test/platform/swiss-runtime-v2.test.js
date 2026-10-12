"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const { input } = require("../tournament-configuration/compile-fixture");
const {
  createSwissUnit,
  advanceSwiss,
  validateManualPairing,
} = require("../../src/platform/operations/format-runners/swiss");
test("ER3 manual pairing binds current input hash/version and cannot relax rematch, duplicate or bye eligibility", () => {
  const {
    digest,
  } = require("../../src/tournament-configuration/domain/canonical");
  const {
    pairingInput,
  } = require("../../src/platform/operations/format-runners/swiss");
  const u = unit("swiss-fixed-v1", 8, 4, { roundCount: 3 });
  advance(u);
  u.rounds.pop();
  u.status = "pairing-blocked";
  u.pairingInputVersion = 1;
  u.pairingInputHash = digest(pairingInput(u));
  const body = {
    inputVersion: 1,
    inputHash: u.pairingInputHash,
    pairs: [
      ["e1", "e2"],
      ["e3", "e4"],
      ["e5", "e6"],
      ["e7", "e8"],
    ],
    bye: null,
  };
  assert.equal(validateManualPairing(u, body).status, "ready");
  assert.throws(() => validateManualPairing(u, { ...body, inputHash: "old" }), {
    code: "INPUT_CHANGED",
  });
  assert.throws(
    () =>
      validateManualPairing(u, {
        ...body,
        pairs: [
          ["e1", "e5"],
          ["e2", "e6"],
          ["e3", "e7"],
          ["e4", "e8"],
        ],
      }),
    { code: "PAIRING_INVALID" },
  );
  assert.throws(
    () =>
      validateManualPairing(u, {
        ...body,
        pairs: [
          ["e1", "e2"],
          ["e1", "e4"],
          ["e5", "e6"],
          ["e7", "e8"],
        ],
      }),
    { code: "PAIRING_INVALID" },
  );
});
function unit(rule, n, q, p = {}) {
  const plan = compile(input(rule, n, q, p), {
    configurationId: "c",
    tournamentId: "T",
  }).units[0];
  return createSwissUnit(
    plan,
    Array.from({ length: n }, (_, i) => ({
      entrantId: "e" + (i + 1),
      initialSeed: i + 1,
      position: i + 1,
      positionKind: "seed",
      channel: "seed",
    })),
  );
}
function advance(u) {
  const r = u.rounds.find((r) => !r.confirmed);
  for (const m of r.matches)
    if (!m.bye) m.decision = { kind: "score", scores: [(m.bestOf + 1) / 2, 0] };
  advanceSwiss(u);
}
test("ER3 manual first-round decision cannot replace the frozen top-bottom table", () => {
  const u = unit("swiss-fixed-v1", 8, 4, { roundCount: 3 });
  u.rounds = [];
  u.status = "pairing-blocked";
  const body = {
    inputVersion: u.pairingInputVersion,
    inputHash: u.pairingInputHash,
    pairs: [
      ["e1", "e2"],
      ["e3", "e4"],
      ["e5", "e6"],
      ["e7", "e8"],
    ],
    bye: null,
  };
  assert.throws(() => validateManualPairing(u, body), {
    code: "PAIRING_INVALID",
  });
});
test("ER3 fixed eight players three rounds twelve matches, hard no-rematch, final four qualify", () => {
  const u = unit("swiss-fixed-v1", 8, 4, { roundCount: 3 });
  while (u.status === "running") advance(u);
  assert.equal(u.status, "completed");
  assert.equal(u.rounds.length, 3);
  assert.equal(u.rounds.flatMap((r) => r.matches).length, 12);
  assert.equal(u.qualified.length, 4);
  for (const r of u.standings) {
    assert.equal(r.opponents.length, 3);
    assert.equal(new Set(r.opponents).size, 3);
  }
});
test("ER3 fixed odd players unique full-point bye only once without numeric scores", () => {
  const u = unit("swiss-fixed-v1", 7, 3, { roundCount: 5 });
  while (u.status === "running") advance(u);
  assert.equal(u.status, "completed");
  const byes = u.rounds.flatMap((r) => r.matches).filter((m) => m.bye);
  assert.equal(byes.length, 5);
  assert.equal(new Set(byes.map((m) => m.decision.winnerId)).size, 5);
  assert.ok(byes.every((m) => m.decision.scores === undefined));
});
test("ER3 threshold sixteen W3/L3 ends thirty-three matches with eight actual qualifiers and dynamic BO", () => {
  const u = unit("swiss-threshold-v1", 16, 8, {
    defaultBO: 1,
    overrides: { advancement: 3, elimination: 5 },
  });
  while (u.status === "running") advance(u);
  assert.equal(u.status, "completed");
  assert.equal(u.rounds.length, 5);
  assert.equal(u.rounds.flatMap((r) => r.matches).length, 33);
  assert.equal(u.qualified.length, 8);
  assert.deepEqual(
    [0, 1, 2].map(
      (l) => u.standings.filter((r) => r.wins === 3 && r.losses === l).length,
    ),
    [2, 3, 3],
  );
  assert.ok(u.standings.every((r) => r.wins === 3 || r.losses === 3));
  assert.ok(u.rounds.flatMap((r) => r.matches).some((m) => m.bestOf === 5));
});
test("ER3 threshold double loss preserves fewer qualifiers, never invents winners to fill quota", () => {
  const u = unit("swiss-threshold-v1", 4, 2, {
    winsToQualify: 1,
    lossesToEliminate: 1,
  });
  const r = u.rounds[0];
  r.matches[0].decision = { kind: "double-loss" };
  r.matches[1].decision = { kind: "score", scores: [2, 0] };
  advanceSwiss(u);
  assert.equal(u.status, "completed");
  assert.equal(u.qualified.length, 1);
  assert.equal(u.qualificationMismatch.expected, 2);
  assert.equal(u.qualificationMismatch.actual, 1);
});
