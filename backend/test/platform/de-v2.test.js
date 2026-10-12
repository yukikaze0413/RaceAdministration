"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { input } = require("../tournament-configuration/compile-fixture");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const {
  createStaticUnit,
  advanceStatic,
} = require("../../src/platform/operations/format-runners/static");
function unit(n, q = 1, mode = "disabled", reset = false) {
  const plan = compile(
    input(mode === "disabled" ? "de-standard-v1" : "de-lower-entry-v1", n, q, {
      lowerEntryMode: mode,
      finalReset: reset,
      overrides: { final: 7 },
    }),
    { configurationId: "c", tournamentId: "T" },
  ).units[0];
  const entries = plan.inputs.flatMap((p) =>
    Array.from({ length: p.capacity }, (_, i) => ({
      entrantId: (p.channel === "upper" ? "U" : "L") + (i + 1),
      initialSeed: i + 1 + (p.channel === "lower" ? n : 0),
      channel: p.channel,
      position: i + 1,
      positionKind: "seed",
    })),
  );
  return createStaticUnit(plan, entries);
}
function finish(u, lowerWinsGF = false) {
  while (u.status === "running") {
    const r = u.rounds.find((r) => !r.confirmed);
    assert.equal(
      new Set(r.matches.flatMap((m) => m.entrants)).size,
      r.matches.length * 2,
    );
    for (const m of r.matches) {
      const target = (m.bestOf + 1) / 2;
      const side = lowerWinsGF && m.role === "final" && m.round === 1 ? 1 : 0;
      m.decision = { kind: "score", scores: side ? [0, target] : [target, 0] };
    }
    advanceStatic(u);
  }
  return u;
}
test("ER2 independent N4/N8 three lower modes Q1/Q2/Q3 match counts and qualified frontiers", () => {
  for (const [n, counts] of [
    [
      4,
      [
        [6, 5, 4],
        [8, 7, 6],
        [10, 9, 8],
      ],
    ],
    [
      8,
      [
        [14, 13, 12],
        [18, 17, 16],
        [22, 21, 20],
      ],
    ],
  ])
    for (const [index, mode] of ["disabled", "half", "same"].entries())
      for (const q of [1, 2, 3]) {
        const u = finish(unit(n, q, mode));
        assert.equal(
          u.rounds.flatMap((r) => r.matches).length,
          counts[index][q - 1],
        );
        assert.equal(u.qualified.length, q);
        assert.equal(u.qualified[0].entrantId, "U1");
        if (q > 1) {
          assert.equal(u.qualified[0].channel, "upper");
          assert.ok(u.qualified.slice(1).every((x) => x.channel === "lower"));
          assert.ok(
            u.standings
              .filter((x) => x.qualification)
              .every((x) => x.rank === undefined),
          );
        }
        for (const r of u.standings.filter((x) =>
          x.entrantId.startsWith("L"),
        )) {
          assert.equal(r.initialLosses, 1);
          assert.equal(r.actualLosses, 1);
        }
      }
});
test("ER2 N8 independently hand-derived cross feeders and wave identities", () => {
  const u = finish(unit(8));
  assert.deepEqual(
    u.rounds.map((r) => r.matches.map((m) => m.entrants)),
    [
      [
        ["U1", "U8"],
        ["U4", "U5"],
        ["U2", "U7"],
        ["U3", "U6"],
      ],
      [
        ["U1", "U4"],
        ["U2", "U3"],
        ["U8", "U5"],
        ["U7", "U6"],
      ],
      [
        ["U1", "U2"],
        ["U8", "U3"],
        ["U7", "U4"],
      ],
      [["U8", "U7"]],
      [["U8", "U2"]],
      [["U1", "U8"]],
    ],
  );
});
test("ER2 GF reset conditional paths N4 six/seven and N8 fourteen/fifteen frozen BO7", () => {
  for (const n of [4, 8])
    for (const reset of [false, true])
      for (const lowerWins of [false, true]) {
        const u = finish(unit(n, 1, "disabled", reset), lowerWins);
        assert.equal(
          u.rounds.flatMap((r) => r.matches).length,
          2 * n - 2 + (reset && lowerWins ? 1 : 0),
        );
        const finals = u.rounds
          .flatMap((r) => r.matches)
          .filter((m) => m.role === "final");
        assert.ok(finals.every((m) => m.bestOf === 7));
        assert.equal(finals.length, reset && lowerWins ? 2 : 1);
        assert.equal(new Set(u.qualified.map((x) => x.entrantId)).size, 1);
        if (reset && lowerWins)
          assert.deepEqual(finals[0].entrants, finals[1].entrants);
      }
});
test("ER2 N16/32/64 full identity paths, no simultaneous duplicates, and initial loss separate from real history", () => {
  for (const n of [16, 32, 64])
    for (const mode of ["disabled", "half", "same"]) {
      const total = n + (mode === "same" ? n : mode === "half" ? n / 2 : 0);
      if (total > 64) continue;
      for (const q of [1, 2, 3]) {
        const u = unit(n, q, mode);
        assert.equal(u.rounds[0].confirmed, false);
        assert.ok(u.rounds[0].matches.every((m) => m.decision === null));
        finish(u);
        assert.equal(new Set(u.standings.map((x) => x.entrantId)).size, total);
        assert.equal(u.qualified.length, q);
        assert.equal(
          u.standings.reduce((sum, r) => sum + r.actualLosses, 0),
          u.rounds.flatMap((r) => r.matches).length,
        );
        assert.ok(
          u.standings
            .filter((x) => !x.qualification)
            .every((x) => x.actualLosses + x.initialLosses === 2),
        );
      }
    }
});

test("ER2 varied deterministic outcome paths preserve each DE qualification frontier and actual history", () => {
  for (const n of [4, 8, 16, 32, 64])
    for (const mode of ["disabled", "half", "same"]) {
      const total = n + (mode === "same" ? n : mode === "half" ? n / 2 : 0);
      if (total > 64) continue;
      for (const q of [1, 2, 3])
        for (let seed = 1; seed <= 4; seed++) {
          const u = unit(n, q, mode, q === 1);
          let state = seed;
          while (u.status === "running") {
            const round = u.rounds.find((r) => !r.confirmed);
            assert.equal(
              new Set(round.matches.flatMap((m) => m.entrants)).size,
              round.matches.length * 2,
            );
            for (const m of round.matches) {
              state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
              const target = (m.bestOf + 1) / 2;
              m.decision = {
                kind: "score",
                scores: state >>> 31 ? [0, target] : [target, 0],
              };
            }
            advanceStatic(u);
          }
          assert.equal(new Set(u.qualified.map((x) => x.entrantId)).size, q);
          assert.equal(
            u.standings.reduce((sum, r) => sum + r.actualLosses, 0),
            u.rounds.flatMap((r) => r.matches).length,
          );
          assert.ok(
            u.standings
              .filter((x) => !x.qualification)
              .every((x) => x.initialLosses + x.actualLosses === 2),
          );
        }
    }
});
