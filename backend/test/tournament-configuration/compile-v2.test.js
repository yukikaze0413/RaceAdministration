"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const { input } = require("./compile-fixture");
const run = (s) => compile(s, { configurationId: "c", tournamentId: "T" });
test("CV5 stable keys ignore names and view state, include configuration and group identity", () => {
  const s = input(),
    a = run(s);
  s.stages[0].name = "改名";
  assert.deepEqual(run(s), a);
  const b = compile(s, { configurationId: "other", tournamentId: "T" });
  assert.notEqual(a.units[0].matches[0].planKey, b.units[0].matches[0].planKey);
  assert.equal(new Set(a.units[0].matches.map((m) => m.planKey)).size, 7);
});
test("ER1 compile complete and segmented N to Q and third-place same final wave", () => {
  for (const [n, q, count] of [
    [8, 4, 4],
    [8, 1, 7],
    [12, 3, 9],
  ]) {
    const u = run(
      input("single-cut-v2", n, q, {
        bracketMode: q === 3 ? "segmented" : "complete",
      }),
    ).units[0];
    assert.equal(u.matches.length, count);
    assert.equal(u.outputs.qualification.length, q);
    assert.equal(u.waves.length, Math.log2(n / q));
    assert.equal(u.matches[0].sources[0].position, 1);
  }
  const u = run(input("single-cut-v2", 8, 1, { thirdPlace: true })).units[0];
  assert.equal(u.matches.length, 8);
  const final = u.matches.find((m) => m.role === "final"),
    third = u.matches.find((m) => m.role === "thirdPlace");
  assert.equal(third.wave, final.wave);
  assert.deepEqual(
    third.sources.map((s) => s.kind),
    ["loser", "loser"],
  );
});
test("ER1 GSL full independent five-game feeder and outputs", () => {
  const u = run(input("gsl-classic-v1", 4, 2)).units[0],
    m = u.matches;
  assert.deepEqual(
    u.waves.map((w) => w.matches.length),
    [2, 2, 1],
  );
  assert.deepEqual(
    m.slice(0, 2).map((x) => x.sources.map((y) => y.position)),
    [
      [1, 4],
      [2, 3],
    ],
  );
  assert.deepEqual(
    m[4].sources.map((x) => [
      x.kind,
      m.findIndex((y) => y.planKey === x.matchKey),
    ]),
    [
      ["loser", 2],
      ["winner", 3],
    ],
  );
  assert.deepEqual(
    u.outputs.rank.map((x) => [
      x.kind,
      m.findIndex((y) => y.planKey === x.matchKey),
    ]),
    [
      ["winner", 2],
      ["winner", 4],
      ["loser", 4],
      ["loser", 3],
    ],
  );
});
test("ER2 independent hand-counted lower modes and qualification frontiers", () => {
  const expected = {
    4: { disabled: [6, 5, 4], half: [8, 7, 6], same: [10, 9, 8] },
    8: { disabled: [14, 13, 12], half: [18, 17, 16], same: [22, 21, 20] },
  };
  for (const n of [4, 8])
    for (const mode of ["disabled", "half", "same"])
      for (const q of [1, 2, 3]) {
        const u = run(
          input("de-lower-entry-v1", n, q, { lowerEntryMode: mode }),
        ).units[0];
        assert.equal(
          u.matches.length,
          expected[n][mode][q - 1],
          n + "/" + mode + "/" + q,
        );
        assert.equal(u.outputs.qualification.length, q);
        assert.equal(
          u.matches.some((m) => m.role === "final"),
          q === 1,
        );
      }
  const u = run(input("de-standard-v1", 8, 1)).units[0];
  assert.deepEqual(
    u.waves.map((w) => w.matches.length),
    [4, 4, 3, 1, 1, 1],
  );
  const lower = u.matches.filter((m) => m.role === "lower"),
    upper = u.matches.filter((m) => m.role === "upper");
  assert.deepEqual(
    lower.slice(2, 4).map((m) => m.sources[1].matchKey),
    [upper[5].planKey, upper[4].planKey],
  );
});
test("ER2 reset is conditional, preserves both finalists, final BO precedence", () => {
  const u = run(
    input("de-standard-v1", 4, 1, {
      finalReset: true,
      overrides: { final: 7, rounds: { 1: 1 } },
    }),
  ).units[0];
  const [a, b] = u.matches.filter((m) => m.role === "final");
  assert.equal(a.bestOf, 7);
  assert.equal(b.bestOf, 7);
  assert.deepEqual(a.sources, b.sources);
  assert.deepEqual(b.condition, {
    kind: "winner-side",
    matchKey: a.planKey,
    side: 1,
  });
  assert.equal(u.matches[0].bestOf, 1);
});
test("SC1 Swiss only future windows, no invented match identity or opponents", () => {
  for (const [rule, rounds] of [
    ["swiss-fixed-v1", 4],
    ["swiss-threshold-v1", 5],
  ]) {
    const u = run(input(rule, 16, 8)).units[0];
    assert.equal(u.matches.length, 0);
    assert.equal(u.windows.length, rounds);
    assert.ok(
      u.windows.every(
        (w) =>
          w.source.kind === "pendingSwissRound" && !Object.hasOwn(w, "matchId"),
      ),
    );
  }
});
test("ER1 circle pair coverage and double-leg side swap without odd bye match", () => {
  for (const n of [4, 5]) {
    const a = run(input("round-robin-v2", n, 2)).units[0];
    assert.equal(a.matches.length, (n * (n - 1)) / 2);
    assert.equal(
      new Set(
        a.matches.map((m) =>
          m.sources
            .map((s) => s.position)
            .sort((x, y) => x - y)
            .join("-"),
        ),
      ).size,
      a.matches.length,
    );
    const b = run(input("double-round-robin-v2", n, 2)).units[0];
    assert.equal(b.matches.length, 2 * a.matches.length);
    assert.deepEqual(
      b.matches
        .slice(a.matches.length)
        .map((m) => m.sources.map((s) => s.position)),
      a.matches.map((m) => m.sources.map((s) => s.position).reverse()),
    );
  }
});
test("CV5 every static DAG dependency is earlier and every entrant slot is complete up to 64", () => {
  for (const n of [4, 8, 16, 32, 64]) {
    const u = run(input("de-standard-v1", n, 1)).units[0],
      seen = new Map();
    assert.equal(u.matches.length, 2 * n - 2);
    for (const m of u.matches) {
      assert.equal(m.sources.length, 2);
      for (const key of m.dependencyKeys)
        assert.ok(seen.get(key).wave < m.wave);
      seen.set(m.planKey, m);
    }
    const positions = u.matches
      .flatMap((m) => m.sources)
      .filter((s) => s.kind === "entrant")
      .map((s) => s.position)
      .sort((a, b) => a - b);
    assert.deepEqual(
      positions,
      Array.from({ length: n }, (_, i) => i + 1),
    );
  }
});
test("CV5 illegal parameters cannot produce partial plan", () => {
  assert.throws(() => run(input("single-cut-v2", 8, 3)), {
    code: "CONFIG_INVALID",
  });
});

test("ER1 complete cut retains full N recursive bracket; segmented trees partition contiguous seeds", () => {
  const cut = run(input("single-cut-v2", 8, 4)).units[0];
  assert.deepEqual(
    cut.matches.map((m) => m.sources.map((s) => s.position)),
    [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ],
  );
  const segmented = run(
    input("single-cut-v2", 12, 3, { bracketMode: "segmented" }),
  ).units[0];
  assert.deepEqual(
    segmented.matches.slice(0, 6).map((m) => m.sources.map((s) => s.position)),
    [
      [1, 4],
      [2, 3],
      [5, 8],
      [6, 7],
      [9, 12],
      [10, 11],
    ],
  );
});
test("ER2 qualification indices are local to named upper/lower channel", () => {
  const u = run(input("de-standard-v1", 8, 3)).units[0];
  assert.deepEqual(
    u.outputs.qualification.map((s) => [s.channel, s.index]),
    [
      ["upper", 1],
      ["lower", 1],
      ["lower", 2],
    ],
  );
});
test("ER2 seeded outcome walks never duplicate a wave identity or qualify twice-lost entrants", () => {
  let random = 20261009;
  for (const n of [2, 4, 8, 16, 32, 64])
    for (const mode of ["disabled", "half", "same"]) {
      if (n + (mode === "same" ? n : mode === "half" ? n / 2 : 0) > 64)
        continue;
      for (const q of n === 2 ? [1, 2] : [1, 2, 3])
        for (const reset of q === 1 ? [false, true] : [false])
          for (let sample = 0; sample < 8; sample++) {
            const u = run(
              input("de-lower-entry-v1", n, q, {
                lowerEntryMode: mode,
                finalReset: reset,
              }),
            ).units[0];
            const decisions = new Map(),
              losses = new Map(),
              actual = new Map();
            const resolve = (s) => {
              if (s.kind === "entrant") {
                const id = s.channel + ":" + s.position;
                if (!losses.has(id)) {
                  losses.set(id, s.initialLosses);
                  actual.set(id, 0);
                }
                return id;
              }
              if (s.kind === "conditional")
                return resolve(
                  decisions.get(s.condition.matchKey).side === s.condition.side
                    ? s.whenTrue
                    : s.whenFalse,
                );
              return decisions.get(s.matchKey)[s.kind];
            };
            for (const w of u.waves) {
              const ids = [];
              for (const key of w.matches) {
                const m = u.matches.find((x) => x.planKey === key);
                if (
                  m.condition &&
                  decisions.get(m.condition.matchKey).side !== m.condition.side
                )
                  continue;
                const pair = m.sources.map(resolve);
                assert.notEqual(pair[0], pair[1]);
                ids.push(...pair);
                random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
                const side = (random >>> 24) & 1;
                decisions.set(key, {
                  winner: pair[side],
                  loser: pair[1 - side],
                  side,
                });
                losses.set(pair[1 - side], losses.get(pair[1 - side]) + 1);
                actual.set(pair[1 - side], actual.get(pair[1 - side]) + 1);
              }
              assert.equal(
                new Set(ids).size,
                ids.length,
                n + "/" + mode + "/" + q + "/" + w.number,
              );
            }
            const qualified = u.outputs.qualification.map((x) =>
              resolve(x.source),
            );
            assert.equal(new Set(qualified).size, q);
            assert.ok(qualified.every((id) => losses.get(id) < 2));
            for (const [id, loss] of losses)
              assert.equal(
                loss,
                actual.get(id) + (id.startsWith("lower:") ? 1 : 0),
              );
          }
    }
});

test("CV5 keys preserve any legal JSON ID including isolated Unicode code units", () => {
  const a = input(),
    b = input();
  a.stages[0].groups[0].id = "g\ud800";
  b.stages[0].groups[0].id = "g\\ud800";
  const x = run(a),
    y = run(b);
  assert.notEqual(x.units[0].unitKey, y.units[0].unitKey);
});
