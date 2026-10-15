"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const StageNumbers = require("../../src/planning-canvas/stage-numbers");
const G = require("../../src/planning-canvas/graph");

test("number registry tracks occupied numbers and preserves the latest across removals", () => {
  const numbers = new StageNumbers([2, 7], 9);
  assert.equal(numbers.next(), 1);
  numbers.remove(1);
  assert.deepEqual([...numbers.numbers], [2, 7]);
  assert.equal(numbers.latest, 9);
  assert.equal(numbers.next(), 1);
  assert.equal(numbers.next(), 3);
  assert.throws(() => numbers.add(7));
  assert.throws(() => numbers.add(0));
  assert.throws(() => new StageNumbers([], -1));
  assert.equal(new StageNumbers([], Number.MAX_SAFE_INTEGER).next(), 1);
});

test("stage numbering metadata rejects invalid or stale counters", () => {
  const graph = G.sample("single");
  for (const latest of [-1, 0, 1.5, "2", Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => G.parse({ ...graph, stageNumbering: { latest } }));
  assert.throws(() => G.parse({ ...graph, stageNumbering: { latest: 2, other: 1 } }));
  assert.equal(G.parse({ ...graph, stageNumbering: { latest: 9 } }).stageNumbering.latest, 9);
});
