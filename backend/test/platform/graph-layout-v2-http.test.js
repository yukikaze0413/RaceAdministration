"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture"),
  { input } = require("../tournament-configuration/compile-fixture");
test("CW7 readonly draft graph preview compiles unsaved parameters, checks version and leaves all persisted state untouched", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid + "/configurations";
  const created = await f.request(
      base,
      "POST",
      { payload: input() },
      f.cookie,
      "create",
    ),
    c = created.data.data;
  const requestBody = {
    expectedVersion: 1,
    payload: input("single-cut-v2", 16, 4),
  };
  const out = await f.request(
    base + "/" + c.id + "/graph-plan",
    "POST",
    requestBody,
    f.cookie,
  );
  assert.equal(out.status, 200, JSON.stringify(out.data));
  assert.equal(out.data.data.plan.units[0].matches.length, 12);
  assert.equal(out.data.data.configurationId, c.id);
  assert.equal(
    (await f.request(base + "/" + c.id, "GET", undefined, f.cookie)).data.data
      .stages[0].groupSize,
    8,
  );
  const { read } = require("../../src/platform/operations/state");
  assert.equal(read(f.platform.db, f.tid).version, 0);
  assert.equal(
    (
      await f.request(
        base + "/" + c.id + "/graph-plan",
        "POST",
        { ...requestBody, expectedVersion: 0 },
        f.cookie,
      )
    ).status,
    409,
  );
  const invalid = await f.request(
    base + "/" + c.id + "/graph-plan",
    "POST",
    { expectedVersion: 1, payload: input("single-cut-v2", 8, 3) },
    f.cookie,
  );
  assert.equal(invalid.status, 200);
  assert.equal(invalid.data.data.structureValid, false);
  assert.equal(invalid.data.data.plan, undefined);
});
test("CW7 complete match/window layout keys save independently, unknown references reject atomically, stale own version conflicts", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid + "/configurations";
  for (const rule of ["single-cut-v2", "swiss-fixed-v1"]) {
    const created = await f.request(
        base,
        "POST",
        { payload: input(rule, 8, rule === "single-cut-v2" ? 1 : 4) },
        f.cookie,
        "create-" + rule,
      ),
      c = created.data.data;
    const plan = (
      await f.request(
        base + "/" + c.id + "/validate",
        "POST",
        { expectedVersion: 1 },
        f.cookie,
      )
    ).data.data.plan;
    const key =
      plan.units[0].matches[0]?.planKey ?? plan.units[0].windows[0].planKey;
    const path = base + "/" + c.id + "/layout",
      body = {
        expectedVersion: 0,
        positions: { [key]: { x: 25000, y: 120 } },
        zoom: 1,
        pan: { x: 0, y: 0 },
      };
    const saved = await f.request(
      path,
      "PUT",
      body,
      f.cookie,
      "layout-" + rule,
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.data.positions[key].x, 25000);
    assert.deepEqual(
      (await f.request(path, "PUT", body, f.cookie, "layout-" + rule)).data
        .data,
      saved.data.data,
    );
    assert.equal(
      (await f.request(path, "PUT", body, f.cookie, "old-" + rule)).status,
      409,
    );
    assert.equal(
      (
        await f.request(
          path,
          "PUT",
          {
            ...body,
            expectedVersion: 1,
            positions: { foreign: { x: 1, y: 1 } },
          },
          f.cookie,
          "foreign-" + rule,
        )
      ).status,
      422,
    );
    assert.equal(
      (await f.request(path, "GET", undefined, f.cookie)).data.data.version,
      1,
    );
    assert.equal(
      (await f.request(base + "/" + c.id, "GET", undefined, f.cookie)).data.data
        .version,
      1,
    );
  }
});
