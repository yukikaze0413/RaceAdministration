"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const values = require("../../src/planning-canvas/values");
const seats = (s) => s.split("").map((ref) => ({ ref, label: ref }));
test("canvas Pool partial mapping sorts only intersecting positions", () => {
  assert.deepEqual(
    values.pool([seats("ABC"), seats("DE")], { B: 2, D: 1 }).map((x) => x.ref),
    ["A", "D", "C", "B", "E"],
  );
});
test("canvas Pool stable ties, foreign keys and duplicate conflict", () => {
  assert.deepEqual(
    values
      .pool([seats("AB"), seats("CD")], { B: 1, D: 1, X: 0 })
      .map((x) => x.ref),
    ["A", "B", "C", "D"],
  );
  assert.throws(() => values.pool([seats("AB"), seats("B")]), /重复/);
});
test("canvas positional generator reverse binding preserves members and reissues current seeds", () => {
  const template = values.template(3, "reverse", 42);
  const result = values.pool([seats("ABC")], template);
  assert.deepEqual(
    result.map((x) => x.ref),
    ["C", "B", "A"],
  );
  assert.deepEqual(values.seedMap(result), { C: 1, B: 2, A: 3 });
  assert.throws(() => values.pool([seats("AB")], template), /数量/);
});
test("canvas selectors deterministic without replacement and strict capacity", () => {
  const input = seats("ABCDEFGH");
  const a = values.select(input, "random", 4, 20261013);
  assert.deepEqual(a, values.select(input, "random", 4, 20261013));
  assert.equal(new Set(a.map((x) => x.ref)).size, 4);
  assert.deepEqual(
    values.select(input, "top", 4).map((x) => x.ref),
    ["A", "B", "C", "D"],
  );
  assert.throws(() => values.select(input, "top", 9), /数量/);
  assert.deepEqual(
    input.map((x) => x.ref),
    ["A", "B", "C", "D", "E", "F", "G", "H"],
  );
});
