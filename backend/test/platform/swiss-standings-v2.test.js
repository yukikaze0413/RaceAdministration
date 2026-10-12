"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  swissStandings,
  rankRows,
} = require("../../src/platform/operations/format-runners/swiss-standings");
test("ER4 completed Swiss source profiles do not allow pools to compare different frozen points systems",()=>{
 const {runtimeSources}=require("../../src/platform/operations/runtime-v2");
 const runtime={roster:[],units:[3,5].map((win,i)=>({id:"g"+i,ruleVersion:"swiss-fixed-v1",format:"fixed-swiss",plan:{parameters:{points:{win,draw:1,loss:0,doubleLoss:0},roundCount:3}},rounds:[],status:"completed",standings:[]}))};
 const sources=runtimeSources(runtime).sourceSnapshots;
 assert.notEqual(sources[0].rankingProfileId,sources[1].rankingProfileId);
});
test("ER4 independent DS opponent records two/zero, ordered rules and no account-ID tie key", () => {
  const rows = [
    {
      entrantId: "A",
      initialSeed: 2,
      wins: 1,
      losses: 1,
      points: 3,
      opponents: ["X", "Y"],
      netGames: 0,
    },
    {
      entrantId: "B",
      initialSeed: 1,
      wins: 1,
      losses: 1,
      points: 3,
      opponents: ["Y", "Z"],
      netGames: 0,
    },
    ...[
      ["X", 2, 0],
      ["Y", 1, 1],
      ["Z", 1, 1],
    ].map(([entrantId, wins, losses], i) => ({
      entrantId,
      initialSeed: i + 3,
      wins,
      losses,
      points: 3 * wins,
      opponents: [],
      netGames: 0,
    })),
  ];
  const ranked = rankRows(rows, ["record", "DS-wl-v1", "initialSeed"]);
  assert.equal(ranked.find((r) => r.entrantId === "A").ds, 2);
  assert.equal(ranked.find((r) => r.entrantId === "B").ds, 0);
  assert.ok(
    ranked.findIndex((r) => r.entrantId === "A") <
      ranked.findIndex((r) => r.entrantId === "B"),
  );
  const tied = rankRows(
    rows.slice(0, 2).map((r) => ({ ...r, opponents: [] })),
    ["points", "manual-with-reason"],
  );
  assert.equal(tied[0].rank, tied[1].rank);
});
test("ER4 bye contributes zero BH/DS, double loss counts real opponents without net games, unconfirmed excluded", () => {
  const unit = {
    bindings: ["A", "B", "C", "D", "E"].map((entrantId, i) => ({
      entrantId,
      initialSeed: i + 1,
    })),
    plan: {
      parameters: {
        points: { win: 3, draw: 1, loss: 0, doubleLoss: 0 },
        tiebreakers: ["points", "BH-points-v1", "netGames", "initialSeed"],
      },
    },
    rounds: [
      {
        confirmed: true,
        matches: [
          { entrants: ["A", "B"], decision: { kind: "score", scores: [2, 1] } },
          {
            entrants: ["C", null],
            bye: true,
            decision: { kind: "bye", winnerId: "C" },
          },
          { entrants: ["D", "E"], decision: { kind: "double-loss" } },
        ],
      },
      {
        confirmed: false,
        matches: [
          { entrants: ["A", "C"], decision: { kind: "score", scores: [2, 0] } },
        ],
      },
    ],
  };
  const rows = swissStandings(unit),
    a = rows.find((r) => r.entrantId === "A"),
    b = rows.find((r) => r.entrantId === "B"),
    c = rows.find((r) => r.entrantId === "C"),
    d = rows.find((r) => r.entrantId === "D");
  assert.equal(a.wins, 1);
  assert.equal(a.points, 3);
  assert.equal(a.netGames, 1);
  assert.equal(b.bhPoints, 3);
  assert.equal(c.byeCount, 1);
  assert.equal(c.wins, 1);
  assert.equal(c.bhPoints, 0);
  assert.equal(c.ds, 0);
  assert.deepEqual(c.opponents, []);
  assert.equal(d.losses, 1);
  assert.equal(d.netGames, 0);
  assert.deepEqual(d.opponents, ["E"]);
});
test("ER4 exact BH sum survives JSON when larger than safe integer", () => {
  const n = Number.MAX_SAFE_INTEGER;
  const ranked = rankRows(
    [
      {
        entrantId: "A",
        initialSeed: 1,
        wins: 1,
        losses: 1,
        points: n,
        opponents: ["X", "Y"],
        netGames: 0,
      },
      {
        entrantId: "X",
        initialSeed: 2,
        wins: 1,
        losses: 0,
        points: n,
        opponents: [],
        netGames: 0,
      },
      {
        entrantId: "Y",
        initialSeed: 3,
        wins: 1,
        losses: 0,
        points: n,
        opponents: [],
        netGames: 0,
      },
    ],
    ["points", "BH-points-v1", "initialSeed"],
  );
  assert.equal(
    ranked.find((r) => r.entrantId === "A").bhPoints,
    "18014398509481982",
  );
  assert.doesNotThrow(() => JSON.stringify(ranked));
});
