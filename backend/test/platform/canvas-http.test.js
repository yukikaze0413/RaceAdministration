"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture"),
  G = require("../../src/planning-canvas/graph");
test("canvas invalid edit payload and unknown sample produce client errors rather than server exceptions", async (t) => {
  const f = await event(t);
  for (const action of [
    { type: "connect" },
    { type: "encapsulate", selected: 1 },
    { type: "expose", id: "missing" },
  ]) {
    const r = await f.request(
      "/planning-canvas/edit",
      "POST",
      { graph: G.sample("empty"), action },
      f.cookie,
    );
    assert.equal(r.status, 422, JSON.stringify(r.data));
    assert.equal(r.data.error.code, "INVALID_INPUT");
  }
  assert.equal(
    (
      await f.request(
        "/planning-canvas/samples/no-such-sample",
        "GET",
        undefined,
        f.cookie,
      )
    ).status,
    404,
  );
});
test("canvas saved version gates preview, retains incomplete draft, rejects stale writes and runtime fields", async (t) => {
  const f = await event(t);
  const before = f.platform.db
    .prepare("SELECT count(*) n FROM tournaments")
    .get().n;
  const create = await f.request(
    "/planning-canvases",
    "POST",
    { name: "独立测试", graph: G.sample("invalid") },
    f.cookie,
    "canvas-create",
  );
  assert.equal(create.status, 201, JSON.stringify(create.data));
  const c = create.data.data,
    path = "/planning-canvases/" + c.id;
  assert.equal(
    (
      await f.request(
        path + "/preview",
        "POST",
        { expectedVersion: 1 },
        f.cookie,
      )
    ).status,
    409,
  );
  const report = await f.request(
    path + "/validate",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
  );
  assert.equal(report.data.data.valid, false);
  const body = {
    expectedVersion: 1,
    name: "八强",
    graph: G.sample("swiss-eight"),
  };
  const saved = await f.request(path, "PUT", body, f.cookie, "canvas-put");
  assert.equal(saved.status, 200);
  assert.deepEqual(
    (await f.request(path, "PUT", body, f.cookie, "canvas-put")).data.data,
    saved.data.data,
  );
  assert.equal(
    (await f.request(path, "PUT", body, f.cookie, "canvas-stale")).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        path + "/validate",
        "POST",
        { expectedVersion: 1 },
        f.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        path + "/preview",
        "POST",
        { expectedVersion: 2 },
        f.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        path + "/validate",
        "POST",
        { expectedVersion: 2 },
        f.cookie,
      )
    ).data.data.valid,
    true,
  );
  const preview = await f.request(
    path + "/preview",
    "POST",
    { expectedVersion: 2 },
    f.cookie,
  );
  assert.equal(preview.data.data.matches.length, 7);
  assert.equal(preview.data.data.version, 2);
  const bad = structuredClone(body);
  bad.expectedVersion = 2;
  bad.graph.nodes.find((n) => n.kind === "match").params.scoreA = 1;
  assert.equal(
    (await f.request(path, "PUT", bad, f.cookie, "bad")).status,
    422,
  );
  assert.equal(
    (await f.request(path, "GET", undefined, f.cookie)).data.data.version,
    2,
  );
  assert.equal(
    f.platform.db.prepare("SELECT count(*) n FROM tournaments").get().n,
    before,
  );
  assert.equal(
    f.platform.db.prepare("SELECT count(*) n FROM structure_aggregates").get()
      .n,
    0,
  );
});
test("canvas owner permission precedes cache and fingerprint conflict, transaction failure permits original key recovery", async (t) => {
  const f = await event(t);
  const graph = G.sample("single");
  const c = (
    await f.request(
      "/planning-canvases",
      "POST",
      { name: "P", graph },
      f.cookie,
      "create",
    )
  ).data.data;
  const path = "/planning-canvases/" + c.id,
    body = { expectedVersion: 1, name: "P2", graph };
  f.platform.db.exec(
    "CREATE TRIGGER canvas_fail BEFORE UPDATE ON planning_canvases BEGIN SELECT RAISE(ABORT,'injected'); END",
  );
  assert.equal(
    (await f.request(path, "PUT", body, f.cookie, "update")).status,
    503,
  );
  f.platform.db.exec("DROP TRIGGER canvas_fail");
  assert.equal(
    (await f.request(path, "PUT", body, f.cookie, "update")).status,
    200,
  );
  assert.equal(
    (
      await f.request(
        path,
        "PUT",
        { ...body, name: "different" },
        f.cookie,
        "update",
      )
    ).status,
    409,
  );
  await f.request("/auth/register", "POST", {
    username: "canvas_other",
    displayName: "other",
    password: "test",
  });
  const login = await f.request("/auth/login", "POST", {
    username: "canvas_other",
    password: "test",
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await f.request(path, "GET", undefined, cookie)).status, 403);
  assert.equal(
    (await f.request("/planning-canvases", "GET", undefined, cookie)).data.data
      .length,
    0,
  );
  f.platform.db.exec("DELETE FROM sessions");
  assert.equal(
    (await f.request(path, "PUT", body, f.cookie, "update")).status,
    401,
  );
});
