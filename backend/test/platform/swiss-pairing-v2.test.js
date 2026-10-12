"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  pairSwiss,
} = require("../../src/platform/operations/format-runners/swiss-pairing");
const rows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    entrantId: "e" + (i + 1),
    initialSeed: i + 1,
    points: "0",
    wins: 0,
    losses: 0,
    byeCount: 0,
    opponents: [],
  }));
test("RC2 thirty-two fixed Swiss entrants find the independent zero-float round-two table within budget", () => {
  const example = require("../fixtures/reference-cases-v1.json").cases[0];
  const input = example.rounds[0].standings.map((r) => ({
    ...r,
    entrantId: "e" + r.seed,
    initialSeed: r.seed,
    opponents: r.opponents.map((id) => "e" + id),
    byeCount: 0,
  }));
  const result = pairSwiss(input);
  assert.equal(result.status, "ready");
  assert.equal(result.cost, "0");
  assert.deepEqual(
    result.pairs,
    example.rounds[1].matches.map((m) => m.entrants.map((id) => "e" + id)),
  );
});
test("ER3 stable first top-bottom and odd lowest eligible bye without fictional opponent", () => {
  const even = pairSwiss(rows(8), { first: true });
  assert.equal(even.status, "ready");
  assert.deepEqual(even.pairs, [
    ["e1", "e5"],
    ["e2", "e6"],
    ["e3", "e7"],
    ["e4", "e8"],
  ]);
  const odd = rows(5);
  odd[4].byeCount = 1;
  const out = pairSwiss(odd, { first: true });
  assert.equal(out.bye, "e4");
  assert.deepEqual(out.pairs, [
    ["e1", "e3"],
    ["e2", "e5"],
  ]);
});
test("ER3 hard no-rematch and globally minimum float cost, stable seed order", () => {
  const entries = rows(4);
  entries[0].points = "10";
  entries[1].points = "10";
  entries[2].points = "5";
  entries[0].opponents = ["e2"];
  const out = pairSwiss(entries);
  assert.equal(out.status, "ready");
  assert.equal(out.cost, "15");
  assert.deepEqual(out.pairs, [
    ["e1", "e3"],
    ["e2", "e4"],
  ]);
});
test("ER3 proven unsat is different from solver budget exhaustion and neither returns partial matches", () => {
  const entries = rows(4);
  for (const e of entries)
    e.opponents = entries.filter((x) => x !== e).map((x) => x.entrantId);
  const unsat = pairSwiss(entries);
  assert.equal(unsat.status, "unsat");
  assert.deepEqual(unsat.pairs, []);
  const limited = pairSwiss(rows(8), { nodeBudget: 1 });
  assert.equal(limited.status, "solver-limit");
  assert.deepEqual(limited.pairs, []);
});
test("ER3 exact float arithmetic beyond aggregate safe integer and full sixty-four matchings", () => {
  const entries = rows(4);
  entries[0].points = "18014398509481982";
  entries[1].points = "18014398509481981";
  assert.equal(pairSwiss(entries).cost, "1");
  const out = pairSwiss(rows(64));
  assert.equal(out.status, "ready");
  assert.equal(out.pairs.length, 32);
  assert.equal(new Set(out.pairs.flat()).size, 64);
});
test("ER3 default 250000 node budget stops a hard disconnected odd-component matching without claiming proof", () => {
  const entries = rows(30);
  for (const [i, e] of entries.entries())
    e.opponents = entries
      .filter((_, j) => i < 15 !== j < 15)
      .map((r) => r.entrantId);
  const out = pairSwiss(entries);
  assert.equal(out.status, "solver-limit");
  assert.equal(out.nodes, 250001);
  assert.deepEqual(out.pairs, []);
});
