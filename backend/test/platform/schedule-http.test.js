"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture"),
  { input } = require("../tournament-configuration/compile-fixture"),
  { read } = require("../../src/platform/operations/state");
const { setupV2 } = require("./runtime-v2-fixture");
async function frozen(f) {
  const base = "/tournaments/" + f.tid + "/configurations",
    c = (
      await f.request(
        base,
        "POST",
        { payload: input() },
        f.cookie,
        "configuration",
      )
    ).data.data;
  const out = await f.request(
    base + "/" + c.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "freeze",
  );
  assert.equal(out.status, 200);
  return (await f.request(base + "/" + c.id, "GET", undefined, f.cookie)).data
    .data;
}
test("SC3 independent schedule version/idempotency/current access leaves structure and runtime untouched", async (t) => {
  const f = await event(t),
    c = await frozen(f),
    path = "/tournaments/" + f.tid + "/schedule",
    before = read(f.platform.db, f.tid).version;
  const empty = await f.request(path, "GET", undefined, f.cookie);
  assert.equal(empty.status, 200, JSON.stringify(empty.data));
  assert.equal(empty.data.data.schedule.version, 0);
  assert.equal(empty.data.data.items.length, 7);
  const keys = c.snapshot.plan.units[0].matches
      .slice(0, 2)
      .map((m) => m.planKey),
    payload = {
      configurationId: c.id,
      resources: [
        { id: "a", name: "A台" },
        { id: "b", name: "B台" },
      ],
      windows: [
        {
          id: "w",
          startsAt: "2026-10-10T00:00:00Z",
          offsetMinutes: 480,
          durationMinutes: 60,
          minRestMinutes: 0,
        },
      ],
      assignments: keys.map((planKey, i) => ({
        planKey,
        windowId: "w",
        resourceId: i ? "b" : "a",
      })),
    },
    body = { expectedVersion: 0, payload };
  const saved = await f.request(path, "PUT", body, f.cookie, "schedule");
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.data.version, 1);
  assert.equal(saved.data.data.validation.status, "pending");
  assert.deepEqual(
    (await f.request(path, "PUT", body, f.cookie, "schedule")).data.data,
    saved.data.data,
  );
  assert.equal(
    (await f.request(path, "PUT", body, f.cookie, "new-key")).status,
    409,
  );
  const bad = await f.request(
    path,
    "PUT",
    {
      expectedVersion: 1,
      payload: {
        ...payload,
        assignments: payload.assignments.map((a) => ({
          ...a,
          resourceId: "a",
        })),
      },
    },
    f.cookie,
    "conflict",
  );
  assert.equal(bad.status, 422);
  assert.ok(
    bad.data.error.diagnostics.some((d) => d.code === "RESOURCE_OVERLAP"),
  );
  assert.equal(
    (await f.request(path, "GET", undefined, f.cookie)).data.data.schedule
      .version,
    1,
  );
  assert.equal(read(f.platform.db, f.tid).version, before);
  assert.equal(
    (
      await f.request(
        "/tournaments/" + f.tid + "/configurations/" + c.id,
        "GET",
        undefined,
        f.cookie,
      )
    ).data.data.version,
    c.version,
  );
  assert.equal((await f.request(path, "GET")).status, 404);
});
test("SC3 actual start and first player submission lock only started plans; time version remains independent", async (t) => {
  const f = await setupV2(
    t,
    input("single-cut-v2", 4, 1),
    Array.from({ length: 4 }, () => null),
  );
  const c = (
      await f.request(
        f.base + "/configurations/" + f.cid,
        "GET",
        undefined,
        f.cookie,
      )
    ).data.data,
    keys = c.snapshot.plan.units[0].matches
      .filter((m) => m.round === 1)
      .map((m) => m.planKey);
  const payload = {
    configurationId: f.cid,
    resources: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    windows: [
      {
        id: "w",
        startsAt: "2030-01-01T00:00:00Z",
        offsetMinutes: 480,
        durationMinutes: 60,
        minRestMinutes: 0,
      },
    ],
    assignments: keys.map((planKey, i) => ({
      planKey,
      windowId: "w",
      resourceId: i ? "b" : "a",
    })),
  };
  assert.equal(
    (
      await f.request(
        f.base + "/schedule",
        "PUT",
        { expectedVersion: 0, payload },
        f.cookie,
        "schedule",
      )
    ).status,
    200,
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
  let runtime = (
      await f.request(f.base + "/runtime", "GET", undefined, f.cookie)
    ).data.data.runtime,
    round = runtime.units[0].rounds[0],
    match = round.matches[0],
    player = f.entrants.find((e) => e.entrantId === match.entrants[0]);
  const result = await f.request(
    f.base + "/matches/" + match.id + "/results",
    "POST",
    {
      expectedVersion: f.getVersion(),
      result: { kind: "score", scores: [2, 0] },
    },
    player.cookie,
    "player-score",
  );
  assert.equal(result.status, 200, JSON.stringify(result.data));
  f.setVersion(result.data.data.version);
  runtime = (await f.request(f.base + "/runtime", "GET", undefined, f.cookie))
    .data.data.runtime;
  assert.ok(runtime.units[0].rounds[0].matches[0].actualStartedAt);
  const changed = structuredClone(payload);
  changed.windows[0].startsAt = "2030-01-02T00:00:00Z";
  assert.equal(
    (
      await f.request(
        f.base + "/schedule",
        "PUT",
        { expectedVersion: 1, payload: changed },
        f.cookie,
        "started-change",
      )
    ).status,
    409,
  );
  const second = runtime.units[0].rounds[0].matches[1];
  const marked = await f.request(
    f.base + "/matches/" + second.id + "/actual-start",
    "POST",
    {
      expectedVersion: f.getVersion(),
      actualStartedAt: "2000-01-01T00:00:00Z",
    },
    f.cookie,
    "actual-start",
  );
  assert.equal(marked.status, 200, JSON.stringify(marked.data));
  f.setVersion(marked.data.data.version);
  assert.equal(
    (
      await f.request(
        f.base + "/matches/" + second.id + "/actual-start",
        "POST",
        {
          expectedVersion: f.getVersion(),
          actualStartedAt: "2000-01-02T00:00:00Z",
        },
        f.cookie,
        "overwrite-start",
      )
    ).status,
    409,
  );
  const view = (await f.request(f.base + "/schedule", "GET")).data.data;
  assert.equal(view.schedule.version, 1);
  assert.equal(view.validation.status, "ready");
  assert.ok(!JSON.stringify(view).includes('"userId"'));
  assert.ok(!JSON.stringify(view).includes('"actorId"'));
});
test("SC3 cached success still checks revoked permission; SQL failure rolls back version and key", async (t) => {
  const f = await event(t),
    c = await frozen(f),
    path = "/tournaments/" + f.tid + "/schedule";
  await f.request(
    "/tournaments/" + f.tid,
    "PATCH",
    { expectedVersion: 1, visibility: "public" },
    f.cookie,
    "public",
  );
  await f.request("/auth/register", "POST", {
    username: "schedule_actor",
    displayName: "Schedule actor",
    password: "schedule-test-password",
  });
  const login = await f.request("/auth/login", "POST", {
      username: "schedule_actor",
      password: "schedule-test-password",
    }),
    cookie = login.headers.get("set-cookie").split(";")[0],
    uid = login.data.data.id;
  const { save } = require("../../src/platform/operations/state"),
    ops = read(f.platform.db, f.tid);
  ops.collaborators[uid] = { permissions: ["structure.edit"] };
  save(f.platform.db, f.tid, ops);
  const payload = {
      configurationId: c.id,
      resources: [],
      windows: [],
      assignments: [],
    },
    body = { expectedVersion: 0, payload };
  assert.equal(
    (await f.request(path, "PUT", body, cookie, "actor-schedule")).status,
    200,
  );
  delete ops.collaborators[uid];
  save(f.platform.db, f.tid, ops);
  assert.equal(
    (await f.request(path, "PUT", body, cookie, "actor-schedule")).status,
    403,
  );
  f.platform.db.exec(
    "CREATE TRIGGER fail_schedule BEFORE UPDATE ON schedule_aggregates BEGIN SELECT RAISE(ABORT,'schedule test fault'); END",
  );
  const retry = { expectedVersion: 1, payload };
  assert.equal(
    (await f.request(path, "PUT", retry, f.cookie, "sql-retry")).status,
    503,
  );
  assert.equal(
    (await f.request(path, "GET", undefined, f.cookie)).data.data.schedule
      .version,
    1,
  );
  f.platform.db.exec("DROP TRIGGER fail_schedule");
  assert.equal(
    (await f.request(path, "PUT", retry, f.cookie, "sql-retry")).data.data
      .version,
    2,
  );
});
test("SC2 Swiss pairing generation rechecks its existing window atomically without auto-assigning or shifting time", async (t) => {
  const f = await setupV2(
      t,
      input("swiss-fixed-v1", 4, 2, { roundCount: 2 }),
      Array.from({ length: 4 }, () => null),
    ),
    c = (
      await f.request(
        f.base + "/configurations/" + f.cid,
        "GET",
        undefined,
        f.cookie,
      )
    ).data.data,
    windows = c.snapshot.plan.units[0].windows;
  const payload = {
    configurationId: f.cid,
    resources: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    windows: windows.map((w, i) => ({
      id: "w" + i,
      planKey: w.planKey,
      startsAt: `2030-01-01T0${i}:00:00Z`,
      offsetMinutes: 480,
      durationMinutes: 60,
      minRestMinutes: 0,
    })),
    assignments: [],
  };
  assert.equal(
    (
      await f.request(
        f.base + "/schedule",
        "PUT",
        { expectedVersion: 0, payload },
        f.cookie,
        "reserve",
      )
    ).status,
    200,
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
  let view = (await f.request(f.base + "/schedule", "GET", undefined, f.cookie))
    .data.data;
  assert.ok(
    view.validation.diagnostics.some(
      (d) => d.code === "PAIRING_ASSIGNMENT_PENDING",
    ),
  );
  const round = view.runtime.units[0].rounds[0];
  payload.assignments = round.matches.map((m, i) => ({
    planKey: m.planKey,
    windowId: "w0",
    resourceId: i ? "b" : "a",
  }));
  assert.equal(
    (
      await f.request(
        f.base + "/schedule",
        "PUT",
        { expectedVersion: 1, payload },
        f.cookie,
        "assign-first",
      )
    ).status,
    200,
  );
  for (const m of round.matches) {
    const scored = await f.request(
      f.base + "/matches/" + m.id + "/results",
      "PATCH",
      {
        expectedVersion: f.getVersion(),
        result: { kind: "score", scores: [2, 0] },
        reason: "瑞士时间复核算例",
      },
      f.cookie,
      "score-" + m.id,
    );
    assert.equal(scored.status, 200);
    f.setVersion(scored.data.data.version);
  }
  const confirm = { expectedVersion: f.getVersion() };
  f.platform.db.exec(
    "CREATE TRIGGER fail_schedule_recheck BEFORE UPDATE ON schedule_aggregates BEGIN SELECT RAISE(ABORT,'schedule recheck fault'); END",
  );
  assert.equal(
    (
      await f.request(
        f.base + "/rounds/" + round.id + "/confirm",
        "POST",
        confirm,
        f.cookie,
        "confirm",
      )
    ).status,
    503,
  );
  assert.equal(
    (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data.data
      .runtime.units[0].rounds.length,
    1,
  );
  f.platform.db.exec("DROP TRIGGER fail_schedule_recheck");
  const confirmed = await f.request(
    f.base + "/rounds/" + round.id + "/confirm",
    "POST",
    confirm,
    f.cookie,
    "confirm",
  );
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
  view = (await f.request(f.base + "/schedule", "GET", undefined, f.cookie))
    .data.data;
  assert.equal(view.schedule.version, 2);
  assert.equal(view.schedule.windows[1].startsAt, "2030-01-01T01:00:00.000Z");
  assert.equal(view.schedule.assignments.length, 2);
  assert.equal(view.runtime.units[0].rounds.length, 2);
  assert.equal(
    view.validation.diagnostics.filter(
      (d) => d.code === "PAIRING_ASSIGNMENT_PENDING",
    ).length,
    2,
  );
});
test("SC3 schedule changes invalidate deletion preview and owner deletion removes its schedule foreign key", async (t) => {
  const f = await event(t),
    c = await frozen(f),
    path = "/tournaments/" + f.tid + "/schedule",
    payload = {
      configurationId: c.id,
      resources: [],
      windows: [],
      assignments: [],
    };
  assert.equal(
    (
      await f.request(
        path,
        "PUT",
        { expectedVersion: 0, payload },
        f.cookie,
        "initial",
      )
    ).status,
    200,
  );
  const preview = (
    await f.request("/me/deletion-preview", "GET", undefined, f.cookie)
  ).data.data;
  assert.equal(preview.counts.schedules, 1);
  assert.equal(
    (
      await f.request(
        path,
        "PUT",
        { expectedVersion: 1, payload },
        f.cookie,
        "changed",
      )
    ).status,
    200,
  );
  const body = {
    currentPassword: "v2-test-password",
    confirmation: "v2_owner",
    expectedToken: preview.token,
  };
  assert.equal((await f.request("/me", "DELETE", body, f.cookie)).status, 409);
  const fresh = (
    await f.request("/me/deletion-preview", "GET", undefined, f.cookie)
  ).data.data;
  assert.equal(
    (
      await f.request(
        "/me",
        "DELETE",
        { ...body, expectedToken: fresh.token },
        f.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    f.platform.db.prepare("SELECT count(*) AS n FROM schedule_aggregates").get()
      .n,
    0,
  );
});
test("SC3 start cannot bind a different frozen configuration from an existing time plan", async (t) => {
  const f = await setupV2(
      t,
      input("single-cut-v2", 4, 1),
      Array.from({ length: 4 }, () => null),
    ),
    created = (
      await f.request(
        f.base + "/configurations",
        "POST",
        { payload: input("single-cut-v2", 4, 1) },
        f.cookie,
        "other-configuration",
      )
    ).data.data;
  await f.request(
    f.base + "/configurations/" + created.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "other-freeze",
  );
  const payload = {
    configurationId: created.id,
    resources: [],
    windows: [],
    assignments: [],
  };
  assert.equal(
    (
      await f.request(
        f.base + "/schedule",
        "PUT",
        { expectedVersion: 0, payload },
        f.cookie,
        "other-time",
      )
    ).status,
    200,
  );
  const out = await f.request(
    f.base + "/start",
    "POST",
    { expectedVersion: f.getVersion(), configurationId: f.cid },
    f.cookie,
    "start",
  );
  assert.equal(out.status, 409);
  assert.equal(out.data.error.code, "SCHEDULE_CONFIGURATION_MISMATCH");
  assert.equal(read(f.platform.db, f.tid).runtime, null);
  assert.equal(
    (
      await f.request(
        f.base + "/schedule",
        "PUT",
        { expectedVersion: 1, payload: { ...payload, configurationId: f.cid } },
        f.cookie,
        "correct-time",
      )
    ).status,
    200,
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
});

test("SC3 schedule version and success request survive SQLite restart", async (t) => {
  const { mkdtempSync, existsSync, unlinkSync, rmdirSync } = require("node:fs"),
    { join } = require("node:path"),
    { tmpdir } = require("node:os"),
    { createApp } = require("../../src/app");
  const directory = mkdtempSync(join(tmpdir(), "race-time-restart-")),
    databasePath = join(directory, "schedule.sqlite");
  t.after(() => {
    for (const path of [
      databasePath,
      databasePath + "-wal",
      databasePath + "-shm",
    ])
      if (existsSync(path)) unlinkSync(path);
    rmdirSync(directory);
  });
  const f = await event(t, { databasePath }),
    c = await frozen(f),
    path = "/tournaments/" + f.tid + "/schedule",
    body = {
      expectedVersion: 0,
      payload: {
        configurationId: c.id,
        resources: [],
        windows: [],
        assignments: [],
      },
    },
    saved = await f.request(path, "PUT", body, f.cookie, "persist");
  assert.equal(saved.status, 200);
  await f.close();
  const fresh = createApp({ databasePath, origins: ["http://localhost:5173"] });
  let server;
  try {
    server = await require("../helpers/http-listener").listenTestServer(
      fresh.app,
    );
    const response = await fetch(
      "http://127.0.0.1:" + server.address().port + "/api/v1" + path,
      {
        method: "PUT",
        headers: {
          Origin: "http://localhost:5173",
          Cookie: f.cookie,
          "Content-Type": "application/json",
          "Idempotency-Key": "persist",
        },
        body: JSON.stringify(body),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, saved.data.data);
    assert.equal(
      require("../../src/platform/schedule/store").read(fresh.db, f.tid)
        .version,
      1,
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fresh.close();
  }
});
