"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const { input } = require("../tournament-configuration/compile-fixture");
const {
  createStaticUnit,
  advanceStatic,
} = require("../../src/platform/operations/format-runners/static");
function unit(n = 8, q = 1, parameters = {}, kind = "seed") {
  const s = input("single-cut-v2", n, q, parameters),
    plan = compile(s, { configurationId: "c", tournamentId: "T" }).units[0];
  const entries = Array.from({ length: n }, (_, i) => ({
    entrantId: "e" + (i + 1),
    initialSeed: i + 1,
    channel: kind,
    position: i + 1,
    positionKind: kind,
  }));
  return createStaticUnit(plan, entries);
}
function decide(u) {
  const r = u.rounds.find((x) => !x.confirmed);
  r.matches.forEach(
    (m) => (m.decision = { kind: "score", scores: [(m.bestOf + 1) / 2, 0] }),
  );
  advanceStatic(u);
  return r;
}
test("ER1 actual 8 to 4 ends after four real matches and has qualification set not champion", () => {
  const u = unit(8, 4);
  assert.equal(u.rounds[0].matches.length, 4);
  decide(u);
  assert.equal(u.status, "completed");
  assert.equal(u.rounds.length, 1);
  assert.equal(u.qualified.length, 4);
  assert.ok(
    u.standings
      .filter((x) => x.qualification)
      .every((x) => x.rank === undefined),
  );
});
test("ER1 actual 8 to 1 locks three rounds seven matches and actual win/loss totals", () => {
  const u = unit();
  while (u.status === "running") decide(u);
  assert.equal(u.rounds.length, 3);
  assert.equal(u.rounds.flatMap((r) => r.matches).length, 7);
  assert.equal(u.standings.find((r) => r.rank === 1).entrantId, "e1");
  assert.equal(u.standings.find((r) => r.entrantId === "e1").wins, 3);
  assert.equal(u.standings.find((r) => r.entrantId === "e2").losses, 1);
});
test("ER1 segmented 12 to 3 completes nine actual matches with unique qualifiers", () => {
  const u = unit(12, 3, { bracketMode: "segmented" });
  while (u.status === "running") decide(u);
  assert.equal(u.rounds.flatMap((r) => r.matches).length, 9);
  assert.deepEqual(
    u.qualified.map((x) => x.entrantId),
    ["e1", "e5", "e9"],
  );
});
test("ER1 third-place finalists wait for both independent decisions", () => {
  const u = unit(8, 1, { thirdPlace: true });
  decide(u);
  decide(u);
  const final = u.rounds.at(-1);
  assert.equal(final.matches.length, 2);
  final.matches[0].decision = { kind: "score", scores: [2, 0] };
  assert.throws(() => advanceStatic(u), { code: "RESULTS_INCOMPLETE" });
  assert.equal(final.confirmed, false);
  final.matches[1].decision = { kind: "score", scores: [2, 0] };
  advanceStatic(u);
  assert.deepEqual(
    u.standings
      .filter((x) => x.rank <= 4)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.entrantId),
    ["e1", "e2", "e4", "e3"],
  );
});
test("PR5 incoming absolute slots map to frozen seed input without changing actual identity", () => {
  const u = unit(8, 1, {}, "slot");
  assert.deepEqual(
    u.rounds[0].matches.map((m) => m.entrants),
    [
      ["e1", "e2"],
      ["e3", "e4"],
      ["e5", "e6"],
      ["e7", "e8"],
    ],
  );
  assert.equal(new Set(u.rounds[0].matches.flatMap((m) => m.entrants)).size, 8);
});
test("ER1 missing or repeated seats do not create partial waves", () => {
  const plan = compile(input(), { configurationId: "c", tournamentId: "T" })
    .units[0];
  assert.throws(
    () =>
      createStaticUnit(plan, [
        {
          entrantId: "e1",
          initialSeed: 1,
          channel: "seed",
          position: 1,
          positionKind: "seed",
        },
      ]),
    { code: "ROSTER_INVALID" },
  );
});

test("ER1 final standings list real places in order and preserve tied ranks",()=>{
 const u=unit(8,1,{thirdPlace:true});while(u.status==="running")decide(u);
 assert.deepEqual(u.standings.map(r=>r.rank),[1,2,3,4,5,5,5,5]);
});