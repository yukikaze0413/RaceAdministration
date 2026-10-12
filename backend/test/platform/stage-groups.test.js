"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { listenTestServer } = require("../helpers/http-listener");
async function fixture(t, { databasePath = ":memory:" } = {}) {
  const platform = createApp({
    databasePath,
    origins: ["http://localhost:5173"],
  });
  const server = await listenTestServer(platform.app);
  t.after(async () => {
    await new Promise((r) => server.close(r));
    platform.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
  async function request(path, method = "GET", body, cookie, key) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: "http://localhost:5173",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers,
    };
  }
  await request("/auth/register", "POST", {
    username: "groups_owner",
    displayName: "Groups owner",
    password: "groups-test-password",
  });
  const login = await request("/auth/login", "POST", {
    username: "groups_owner",
    password: "groups-test-password",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const event = await request(
    "/tournaments",
    "POST",
    { name: "Groups isolation", game: "card", visibility: "private" },
    cookie,
    "event",
  );
  const tid = event.data.data.id,
    root = "/tournaments/" + tid + "/configurations";
  const config = await request(
    root,
    "POST",
    {
      payload: {
        entrantKind: "individual",
        structureVersion: "structure-v2",
        routingVersion: "routing-v2",
        stages: [],
        pools: [],
        routes: [],
      },
    },
    cookie,
    "empty",
  );
  assert.equal(config.status, 201);
  return {
    platform,
    request,
    cookie,
    tid,
    root,
    cid: config.data.data.id,
    path: root + "/" + config.data.data.id,
  };
}
test("FP1 server creates four independent GSL groups and retry returns one stage", async (t) => {
  const f = await fixture(t),
    body = {
      expectedVersion: 1,
      stage: { ruleVersion: "gsl-classic-v1", name: "小组赛" },
    };
  const r = await f.request(f.path + "/stages", "POST", body, f.cookie, "gsl");
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const s = r.data.data.stages[0];
  assert.deepEqual(
    [s.groupSize, s.groupCount, s.qualifyCount, s.capacity],
    [4, 4, 2, 16],
  );
  assert.equal(s.groups.length, 4);
  assert.equal(new Set(s.groups.map((g) => g.id)).size, 4);
  assert.ok(s.groups.every((g) => g.stageId === s.id && g.capacity === 4));
  const retry = await f.request(
    f.path + "/stages",
    "POST",
    body,
    f.cookie,
    "gsl",
  );
  assert.deepEqual(retry.data.data, r.data.data);
  const saved = await f.request(f.path, "GET", undefined, f.cookie);
  assert.equal(saved.data.data.version, 2);
  assert.equal(saved.data.data.stages.length, 1);
});

test("TS7 expanding two groups to four preserves existing IDs and references on retry", async (t) => {
  const f = await fixture(t);
  const added = await f.request(
    f.path + "/stages",
    "POST",
    {
      expectedVersion: 1,
      stage: { ruleVersion: "gsl-classic-v1", groupCount: 2 },
    },
    f.cookie,
    "two",
  );
  const old = added.data.data.stages[0];
  const body = { expectedVersion: 2, changes: { groupCount: 4 } };
  const path = f.path + "/stages/" + old.id + "/apply";
  const r = await f.request(path, "POST", body, f.cookie, "expand");
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const s = r.data.data.configuration.stages[0];
  assert.deepEqual(
    s.groups.slice(0, 2).map((g) => g.id),
    old.groups.map((g) => g.id),
  );
  assert.equal(s.groups.length, 4);
  assert.equal(s.capacity, 16);
  const retry = await f.request(path, "POST", body, f.cookie, "expand");
  assert.deepEqual(retry.data.data, r.data.data);
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    3,
  );
});

async function gslWithDependencies(t) {
  const f = await fixture(t);
  let r = await f.request(
    f.path + "/stages",
    "POST",
    { expectedVersion: 1, stage: { ruleVersion: "gsl-classic-v1" } },
    f.cookie,
    "gsl",
  );
  const gsl = r.data.data.stages[0];
  r = await f.request(
    f.path + "/stages",
    "POST",
    {
      expectedVersion: 2,
      stage: { name: "淘汰", ruleVersion: "single-cut-v2" },
    },
    f.cookie,
    "final",
  );
  const config = r.data.data,
    final = config.stages[1];
  const { id, tournamentId, version, state, ...payload } = config;
  payload.routes = [
    {
      id: "routeC",
      source: { stageId: gsl.id, groupId: gsl.groups[2].id },
      target: { stageId: final.id, groupId: final.groups[0].id },
      selector: { kind: "rankRange", from: 1, to: 1 },
      quota: 1,
      sort: [{ field: "sourceRank", direction: "asc" }],
      placement: { kind: "slot", positions: [1] },
    },
  ];
  const saved = await f.request(
    f.path,
    "PUT",
    { expectedVersion: 3, payload },
    f.cookie,
    "route",
  );
  assert.equal(saved.status, 200);
  const operations = require("../../src/platform/operations/state");
  const ops = operations.read(f.platform.db, f.tid);
  ops.version = 7;
  ops.registrations = [
    {
      id: "rC",
      userId: "private-user",
      name: "private-name",
      schemaVersion: 1,
      status: "approved",
      seed: 3,
      sourceId: gsl.groups[2].id,
      answers: { private: "never expose this" },
    },
  ];
  ops.layouts[f.cid] = {
    version: 1,
    positions: { [gsl.groups[2].id]: { x: 10, y: 20 } },
    zoom: 1,
    pan: { x: 0, y: 0 },
  };
  operations.save(f.platform.db, f.tid, ops);
  return { ...f, gsl, configuration: saved.data.data, operations };
}
test("FP1 shrink needs an impact review, cancel leaves routes/roster/layout unchanged", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id;
  const opsBefore = f.operations.read(f.platform.db, f.tid);
  const naked = await f.request(
    path + "/apply",
    "POST",
    { expectedVersion: 4, changes: { groupCount: 2 } },
    f.cookie,
    "naked",
  );
  assert.equal(naked.status, 409);
  assert.equal(naked.data.error.code, "CONFIG_CHANGE_CONFIRMATION_REQUIRED");
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes: { groupCount: 2 } },
    f.cookie,
  );
  assert.equal(plan.status, 200, JSON.stringify(plan.data));
  const impact = plan.data.data;
  assert.deepEqual(
    impact.removedGroupIds,
    f.gsl.groups.slice(2).map((g) => g.id),
  );
  assert.deepEqual(impact.affectedRouteIds, ["routeC"]);
  assert.deepEqual(impact.affectedRegistrationIds, ["rC"]);
  assert.equal(impact.requiresConfirmation, true);
  assert.equal(JSON.stringify(impact).includes("never expose"), false);
  assert.equal(JSON.stringify(impact).includes("private-user"), false);
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    4,
  );
  assert.deepEqual(f.operations.read(f.platform.db, f.tid), opsBefore);
  const applied = await f.request(
    path + "/apply",
    "POST",
    {
      expectedVersion: 4,
      changes: { groupCount: 2 },
      confirmed: true,
      confirmationToken: impact.confirmationToken,
    },
    f.cookie,
    "confirmed",
  );
  assert.equal(applied.status, 200, JSON.stringify(applied.data));
  const c = applied.data.data.configuration;
  assert.deepEqual(
    c.stages[0].groups.map((g) => g.id),
    f.gsl.groups.slice(0, 2).map((g) => g.id),
  );
  assert.deepEqual(c.routes, []);
  const opsAfter = f.operations.read(f.platform.db, f.tid);
  assert.equal(opsAfter.version, 8);
  assert.equal(opsAfter.registrations[0].sourceId, null);
  assert.equal(opsAfter.registrations[0].answers.private, "never expose this");
  assert.deepEqual(opsAfter.layouts[f.cid].positions, {});
  assert.equal(opsAfter.layouts[f.cid].version, 2);
});

test("FP1 ordinary PUT cannot bypass destructive stage review", async (t) => {
  const f = await gslWithDependencies(t);
  const { id, tournamentId, version, state, ...payload } = f.configuration;
  payload.stages[0].groupCount = 2;
  payload.stages[0].capacity = 8;
  payload.stages[0].groups = payload.stages[0].groups.slice(0, 2);
  payload.routes = [];
  const r = await f.request(
    f.path,
    "PUT",
    { expectedVersion: 4, payload },
    f.cookie,
    "bypass",
  );
  assert.equal(r.status, 409);
  assert.equal(r.data.error.code, "CONFIG_CHANGE_CONFIRMATION_REQUIRED");
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    4,
  );
  assert.equal(
    f.operations.read(f.platform.db, f.tid).registrations[0].sourceId,
    f.gsl.groups[2].id,
  );
});
async function delegate(f, permissions, version = 7, key = "grant") {
  const registration = await f.request("/auth/register", "POST", {
    username: "groups_delegate",
    displayName: "Groups delegate",
    password: "delegate-test-password",
  });
  const login = await f.request("/auth/login", "POST", {
    username: "groups_delegate",
    password: "delegate-test-password",
  });
  const cookie = login.headers.get("set-cookie").split(";")[0],
    userId = registration.data.data.id;
  const grant = await f.request(
    "/tournaments/" + f.tid + "/collaborators",
    "POST",
    { expectedVersion: version, userId, permissions },
    f.cookie,
    key,
  );
  assert.equal(grant.status, 200, JSON.stringify(grant.data));
  return { cookie, userId };
}
test("TO1 clearing affected registration assignment additionally requires registration.review", async (t) => {
  const f = await gslWithDependencies(t),
    d = await delegate(f, ["structure.edit"]);
  const path = f.path + "/stages/" + f.gsl.id;
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes: { groupCount: 2 } },
    d.cookie,
  );
  assert.equal(plan.status, 200);
  const applied = await f.request(
    path + "/apply",
    "POST",
    {
      expectedVersion: 4,
      changes: { groupCount: 2 },
      confirmed: true,
      confirmationToken: plan.data.data.confirmationToken,
    },
    d.cookie,
    "denied",
  );
  assert.equal(applied.status, 403);
  assert.equal(
    f.operations.read(f.platform.db, f.tid).registrations[0].sourceId,
    f.gsl.groups[2].id,
  );
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    4,
  );
});

test("TO1 replay of a confirmed roster-affecting change still checks current secondary permission", async (t) => {
  const f = await gslWithDependencies(t),
    d = await delegate(f, ["structure.edit", "registration.review"]);
  const path = f.path + "/stages/" + f.gsl.id;
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes: { groupCount: 2 } },
    d.cookie,
  );
  const body = {
    expectedVersion: 4,
    changes: { groupCount: 2 },
    confirmed: true,
    confirmationToken: plan.data.data.confirmationToken,
  };
  const applied = await f.request(
    path + "/apply",
    "POST",
    body,
    d.cookie,
    "review-apply",
  );
  assert.equal(applied.status, 200);
  const ops = f.operations.read(f.platform.db, f.tid);
  const revoke = await f.request(
    "/tournaments/" + f.tid + "/collaborators",
    "POST",
    {
      expectedVersion: ops.version,
      userId: d.userId,
      permissions: ["structure.edit"],
    },
    f.cookie,
    "revoke-review",
  );
  assert.equal(revoke.status, 200);
  const replay = await f.request(
    path + "/apply",
    "POST",
    body,
    d.cookie,
    "review-apply",
  );
  assert.equal(replay.status, 403);
});
test("FP2 explicit null descriptor values do not silently select defaults", async (t) => {
  const f = await fixture(t);
  for (const stage of [
    { ruleVersion: null },
    { format: null },
    { name: null },
    { id: null },
  ]) {
    const r = await f.request(
      f.path + "/stages",
      "POST",
      { expectedVersion: 1, stage },
      f.cookie,
      "null-" + Object.keys(stage)[0],
    );
    assert.equal(r.status, 422, JSON.stringify(stage));
  }
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    1,
  );
});

test("FP1 changing format reports invalidated references and clears stale runtime settings on explicit approval", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id;
  const ops = f.operations.read(f.platform.db, f.tid);
  ops.rules[f.gsl.id] = {
    stageId: f.gsl.id,
    bestOf: 3,
    allowDraw: false,
    allowPlayerDoubleLoss: false,
  };
  f.operations.save(f.platform.db, f.tid, ops);
  const changes = { ruleVersion: "single-cut-v2" };
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes },
    f.cookie,
  );
  assert.equal(plan.status, 200);
  assert.equal(plan.data.data.proposedStage.format, "single-elimination");
  assert.equal(plan.data.data.proposedStage.groupSize, 8);
  assert.deepEqual(plan.data.data.affectedRuleStageIds, [f.gsl.id]);
  assert.deepEqual(plan.data.data.affectedRouteIds, ["routeC"]);
  const applied = await f.request(
    path + "/apply",
    "POST",
    {
      expectedVersion: 4,
      changes,
      confirmed: true,
      confirmationToken: plan.data.data.confirmationToken,
    },
    f.cookie,
    "format",
  );
  assert.equal(applied.status, 200);
  assert.equal(
    applied.data.data.configuration.stages[0].groups[0].id,
    f.gsl.groups[0].id,
  );
  assert.equal(
    Object.hasOwn(f.operations.read(f.platform.db, f.tid).rules, f.gsl.id),
    false,
  );
});
test("FP1 dependency changes invalidate prior review without any structural application", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id,
    changes = { groupCount: 2 };
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes },
    f.cookie,
  );
  const ops = f.operations.read(f.platform.db, f.tid);
  ops.version++;
  ops.registrations[0].sourceId = f.gsl.groups[0].id;
  f.operations.save(f.platform.db, f.tid, ops);
  const r = await f.request(
    path + "/apply",
    "POST",
    {
      expectedVersion: 4,
      changes,
      confirmed: true,
      confirmationToken: plan.data.data.confirmationToken,
    },
    f.cookie,
    "stale",
  );
  assert.equal(r.status, 409);
  assert.equal(r.data.error.code, "CONFIG_CHANGE_CONFIRMATION_REQUIRED");
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    4,
  );
  assert.deepEqual(f.operations.read(f.platform.db, f.tid), ops);
});
test("FP1 locked roster and existing runtime are reported and never modified", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id,
    changes = { groupCount: 2 };
  const ops = f.operations.read(f.platform.db, f.tid);
  ops.rosterLocked = true;
  // Persisted synthetic dependency fixture: v2 runner is still unavailable.
  ops.runtime = {
    configurationId: f.cid,
    units: [
      {
        stageId: f.gsl.id,
        rounds: [
          {
            confirmed: true,
            matches: [{ id: "historical-match", result: { score: [2, 0] } }],
          },
        ],
      },
    ],
  };
  f.operations.save(f.platform.db, f.tid, ops);
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes },
    f.cookie,
  );
  assert.deepEqual(plan.data.data.affectedMatchIds, ["historical-match"]);
  assert.ok(plan.data.data.blockers.includes("RUNTIME_LOCKED"));
  assert.ok(plan.data.data.blockers.includes("ROSTER_LOCKED"));
  const r = await f.request(
    path + "/apply",
    "POST",
    {
      expectedVersion: 4,
      changes,
      confirmed: true,
      confirmationToken: plan.data.data.confirmationToken,
    },
    f.cookie,
    "locked",
  );
  assert.equal(r.status, 409);
  assert.deepEqual(f.operations.read(f.platform.db, f.tid), ops);
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    4,
  );
});
test("TS7 structure, registrations, layout and success key all roll back on dependent-store failure", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id,
    changes = { groupCount: 2 };
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes },
    f.cookie,
  );
  const body = {
    expectedVersion: 4,
    changes,
    confirmed: true,
    confirmationToken: plan.data.data.confirmationToken,
  };
  const before = f.operations.read(f.platform.db, f.tid);
  f.platform.db.exec(
    "CREATE TRIGGER fail_group_effect BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT, 'injected dependency failure'); END;",
  );
  const failed = await f.request(
    path + "/apply",
    "POST",
    body,
    f.cookie,
    "fault-retry",
  );
  assert.equal(failed.status, 503);
  assert.deepEqual(f.operations.read(f.platform.db, f.tid), before);
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    4,
  );
  f.platform.db.exec("DROP TRIGGER fail_group_effect");
  const retry = await f.request(
    path + "/apply",
    "POST",
    body,
    f.cookie,
    "fault-retry",
  );
  assert.equal(retry.status, 200);
  assert.equal(retry.data.data.configuration.version, 5);
  const replay = await f.request(
    path + "/apply",
    "POST",
    body,
    f.cookie,
    "fault-retry",
  );
  assert.deepEqual(replay.data.data, retry.data.data);
  assert.equal(f.operations.read(f.platform.db, f.tid).version, 8);
});
test("TS7 concurrent expansions produce one version and preserve referenced original groups", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id + "/apply";
  const results = await Promise.all(
    [5, 6].map((n) =>
      f.request(
        path,
        "POST",
        { expectedVersion: 4, changes: { groupCount: n } },
        f.cookie,
        "expand-" + n,
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const current = (await f.request(f.path, "GET", undefined, f.cookie)).data
    .data;
  assert.equal(current.version, 5);
  assert.deepEqual(
    current.stages[0].groups.slice(0, 4).map((g) => g.id),
    f.gsl.groups.map((g) => g.id),
  );
  assert.deepEqual(current.routes, f.configuration.routes);
  assert.equal(f.operations.read(f.platform.db, f.tid).version, 7);
});

test("TS7 added group identities and original response survive SQLite reconnection", async (t) => {
  const { mkdtempSync, existsSync, unlinkSync, rmdirSync } = require("node:fs");
  const { tmpdir } = require("node:os"),
    { join } = require("node:path");
  const directory = mkdtempSync(join(tmpdir(), "race-groups-")),
    databasePath = join(directory, "groups.sqlite");
  let f2;
  const f = await fixture(t, { databasePath });
  t.after(() => {
    f.platform.close();
    f2?.platform.close();
    for (const file of [
      databasePath,
      databasePath + "-wal",
      databasePath + "-shm",
    ])
      if (existsSync(file)) unlinkSync(file);
    rmdirSync(directory);
  });
  const added = await f.request(
    f.path + "/stages",
    "POST",
    {
      expectedVersion: 1,
      stage: { ruleVersion: "gsl-classic-v1", groupCount: 2 },
    },
    f.cookie,
    "two",
  );
  const sid = added.data.data.stages[0].id,
    body = { expectedVersion: 2, changes: { groupCount: 4 } };
  const first = await f.request(
    f.path + "/stages/" + sid + "/apply",
    "POST",
    body,
    f.cookie,
    "durable-expansion",
  );
  assert.equal(first.status, 200);
  f.platform.close();
  f2 = await fixture(t, { databasePath });
  const retry = await f2.request(
    f2.path + "/stages/" + sid + "/apply",
    "POST",
    body,
    f2.cookie,
    "durable-expansion",
  );
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.data.data, first.data.data);
  const current = (await f2.request(f2.path, "GET", undefined, f2.cookie)).data
    .data;
  assert.equal(current.version, 3);
  assert.equal(current.stages[0].groups.length, 4);
});

test("FP1 BO-only change preserves routing and roster and explicitly reports retained layout", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id;
  const changes = {
    parameters: { ...f.configuration.stages[0].parameters, defaultBO: 5 },
  };
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes },
    f.cookie,
  );
  assert.equal(plan.status, 200);
  assert.deepEqual(plan.data.data.affectedRouteIds, []);
  assert.deepEqual(plan.data.data.affectedRegistrationIds, []);
  assert.deepEqual(plan.data.data.retainedLayoutIds, [f.gsl.groups[2].id]);
  assert.deepEqual(plan.data.data.removedLayoutIds, []);
  const before = f.operations.read(f.platform.db, f.tid);
  const applied = await f.request(
    path + "/apply",
    "POST",
    { expectedVersion: 4, changes },
    f.cookie,
    "bo-only",
  );
  assert.equal(applied.status, 200);
  assert.deepEqual(
    applied.data.data.configuration.routes,
    f.configuration.routes,
  );
  assert.equal(
    applied.data.data.configuration.stages[0].parameters.defaultBO,
    5,
  );
  assert.deepEqual(f.operations.read(f.platform.db, f.tid), before);
});

test("FP1 explicit cancel and a stale optional review never apply even non-destructive expansion", async (t) => {
  const f = await gslWithDependencies(t),
    path = f.path + "/stages/" + f.gsl.id,
    changes = { groupCount: 5 };
  const plan = await f.request(
    path + "/plan",
    "POST",
    { expectedVersion: 4, changes },
    f.cookie,
  );
  const cancelled = await f.request(
    path + "/apply",
    "POST",
    { expectedVersion: 4, changes, confirmed: false },
    f.cookie,
    "cancel-expand",
  );
  assert.equal(cancelled.status, 409);
  const ops = f.operations.read(f.platform.db, f.tid);
  ops.version++;
  f.operations.save(f.platform.db, f.tid, ops);
  const stale = await f.request(
    path + "/apply",
    "POST",
    {
      expectedVersion: 4,
      changes,
      confirmed: true,
      confirmationToken: plan.data.data.confirmationToken,
    },
    f.cookie,
    "stale-expand",
  );
  assert.equal(stale.status, 409);
  assert.equal(
    (await f.request(f.path, "GET", undefined, f.cookie)).data.data.version,
    4,
  );
});
