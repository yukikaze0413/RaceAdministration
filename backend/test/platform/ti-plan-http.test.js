"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
test("TI candidate frozen plan persists but cannot start an unverified generic Swiss runtime", async (t) => {
  const structure = {
    entrantKind: "individual",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [
      {
        id: "s",
        name: "TI候选计划",
        order: 1,
        format: "threshold-swiss",
        ruleVersion: "ti2026-observed-candidate-v1",
        groups: [{ id: "g", stageId: "s" }],
      },
    ],
    pools: [],
    routes: [],
  };
  const f = await setupV2(t, structure, Array(16).fill(null));
  const before = f.getVersion();
  const response = await f.request(
    f.base + "/start",
    "POST",
    { expectedVersion: before, configurationId: f.cid },
    f.cookie,
    "ti-candidate-start",
  );
  assert.equal(response.status, 501, JSON.stringify(response.data));
  assert.equal(response.data.error.code, "RUN_NOT_SUPPORTED");
  const configuration = await f.request(
    f.base + "/configurations/" + f.cid,
    "GET",
    undefined,
    f.cookie,
  );
  assert.equal(configuration.data.data.state, "structure-frozen");
  assert.equal(
    configuration.data.data.snapshot.plan.units[0].windows.length,
    6,
  );
});
