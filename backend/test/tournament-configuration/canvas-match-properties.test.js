"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const G = require("../../src/planning-canvas/graph");
test("Match stores only the offered match format and derives bestOf for preview", () => {
  for (const name of ["single", "double", "gsl", "swiss-eight"])
    assert.ok(G.sample(name).nodes.filter(n => n.kind === "match").every(n => ["bo1", "bo3"].includes(n.params.matchFormat)));
  const g = G.sample("single"), id = g.nodes.find(n => n.kind === "match").id;
  const next = G.edit(g, { type: "update", id, params: { matchFormat: "bo1" } }).graph;
  assert.equal(next.nodes.find(n => n.id === id).params.bestOf, undefined);
  assert.equal(G.analyze(next).matches.find(m => m.id === id).bestOf, 1);
  assert.throws(() => G.edit(g, { type: "update", id, params: { matchFormat: "bo5" } }));
  for (const params of [{ bestOf: 3 }, { batch: "x" }, { winnerRule: "none" }, { allowedResults: ["win", "loss"] }, { expectedTime: "2026-10-16T09:00" }, { durationMinutes: 20 }])
    assert.throws(() => G.edit(g, { type: "update", id, params }), /未知/);
});
