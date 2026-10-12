"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { event, payload } = require("./formats-v2-fixture");
test("FP1 authenticated format catalog exposes server defaults without runtime claims", async (t) => {
  const f = await event(t);
  assert.equal((await f.request("/formats")).status, 401);
  const r = await f.request("/formats", "GET", undefined, f.cookie);
  assert.equal(r.status, 200);
  assert.equal(r.data.data.version, "format-catalog-v1");
  assert.equal(r.data.data.formats.length, 10);
  const ti = r.data.data.formats.find(
    (x) => x.ruleVersion === "ti2026-observed-candidate-v1",
  );
  assert.equal(ti.runtimeReady, false);
  assert.equal(ti.unavailableReason, "FORMAT_RUNTIME_UNAVAILABLE");
  const gsl = r.data.data.formats.find(
    (x) => x.ruleVersion === "gsl-classic-v1",
  );
  assert.deepEqual(
    [
      gsl.defaults.groupSize,
      gsl.defaults.groupCount,
      gsl.defaults.qualifyCount,
    ],
    [4, 4, 2],
  );
  assert.equal(gsl.parameterSchema.additionalProperties, false);
  assert.equal(gsl.runtimeReady, true);
});
module.exports = { event, payload };

test("TS7 valid v2 save retries once, strict invalid writes remain atomic and complete plan freezes", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid + "/configurations";
  const headersCookie = f.cookie;
  const create = () =>
    f.request(base, "POST", { payload: payload() }, headersCookie, "create-v2");
  const first = await create(),
    again = await create();
  assert.equal(first.status, 201);
  assert.equal(again.data.data.id, first.data.data.id);
  const saved = first.data.data;
  assert.equal(saved.stages[0].capacity, 8);
  const read = await f.request(
    base + "/" + saved.id,
    "GET",
    undefined,
    f.cookie,
  );
  assert.equal(read.data.data.stages[0].parameters.defaultBO, 3);
  for (const [key, mutate] of [
    ["unknown", (p) => (p.stages[0].parameters = { unknown: true })],
    ["cross", (p) => (p.stages[0].tournamentId = "another")],
    [
      "excess",
      (p) => {
        p.stages[0].groupSize = 64;
        p.stages[0].groupCount = 2;
      },
    ],
    ["null", (p) => (p.stages[0].parameters = null)],
    [
      "nested",
      (p) =>
        (p.stages[0].parameters = {
          seeding: {
            kind: "seed",
            seedTableVersion: "recursive-v1",
            unknown: true,
          },
        }),
    ],
    ["type", (p) => (p.stages[0].parameters = { thirdPlace: "false" })],
    ["version", (p) => (p.routingVersion = "routing-v1")],
    ["foreign-format", (p) => (p.stages[0].format = "gsl")],
  ]) {
    const bad = payload();
    mutate(bad);
    const r = await f.request(
      base + "/" + saved.id,
      "PUT",
      { expectedVersion: 1, payload: bad },
      f.cookie,
      key,
    );
    assert.equal(r.status, 422, key);
    assert.equal(
      (await f.request(base + "/" + saved.id, "GET", undefined, f.cookie)).data
        .data.version,
      1,
    );
  }
  const freeze = await f.request(
    base + "/" + saved.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "freeze",
  );
  assert.equal(freeze.status, 200);
  assert.equal(freeze.data.data.plan.version, "compiled-plan-v2");
  assert.equal(freeze.data.data.plan.units[0].matches.length, 7);
  assert.equal(freeze.data.data.runtimeReady, true);
  assert.equal(
    (await f.request(base + "/" + saved.id, "GET", undefined, f.cookie)).data
      .data.state,
    "structure-frozen",
  );
});
test("TS7 v1 cannot be replaced in place by a v2 payload", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid + "/configurations";
  const old = {
    entrantKind: "individual",
    structureVersion: "structure-v1",
    routingVersion: "routing-v1",
    stages: [
      {
        id: "s1",
        order: 1,
        capacity: 6,
        formatIntent: "single-elimination",
        groups: [],
      },
    ],
    pools: [],
    routes: [],
  };
  const created = await f.request(
    base,
    "POST",
    { payload: old },
    f.cookie,
    "old",
  );
  assert.equal(created.status, 201);
  const r = await f.request(
    base + "/" + created.data.data.id,
    "PUT",
    { expectedVersion: 1, payload: payload() },
    f.cookie,
    "upgrade",
  );
  assert.equal(r.status, 409);
  assert.equal(r.data.error.code, "CONFIG_VERSION_UPGRADE_REQUIRED");
  const current = await f.request(
    base + "/" + created.data.data.id,
    "GET",
    undefined,
    f.cookie,
  );
  assert.equal(current.data.data.structureVersion, "structure-v1");
  assert.equal(current.data.data.version, 1);
});
