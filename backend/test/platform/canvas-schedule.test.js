"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture"),
  G = require("../../src/planning-canvas/graph");
test("validated waves persist, sessions have independent versions and stale snapshots survive revalidation", async (t) => {
  const f = await event(t),
    graph = G.migrate(G.sample("single")).graph;
  const c = (
    await f.request(
      "/planning-canvases",
      "POST",
      { name: "wave-test", graph },
      f.cookie,
      "wave-create",
    )
  ).data.data;
  const path = "/planning-canvases/" + c.id;
  const v = (
    await f.request(
      path + "/validate",
      "POST",
      { expectedVersion: 1 },
      f.cookie,
    )
  ).data.data;
  assert.equal(v.wavePlan.waves.length, 3);
  const preview = (
    await f.request(path + "/preview", "POST", { expectedVersion: 1 }, f.cookie)
  ).data.data;
  assert.equal(preview.wavePlanDigest, v.wavePlanDigest);
  const cached = JSON.parse(f.platform.db.prepare("SELECT validation FROM planning_canvases WHERE id=?").get(c.id).validation);
  cached.wavePlan.plannerVersion = "retired-planner";
  f.platform.db.prepare("UPDATE planning_canvases SET validation=? WHERE id=?").run(JSON.stringify(cached),c.id);
  assert.equal((await f.request(path+"/preview","POST",{expectedVersion:1},f.cookie)).status,409);
  await f.request(path+"/validate","POST",{expectedVersion:1},f.cookie);
  const body = {
    expectedVersion: 1,
    expectedScheduleVersion: 0,
    wavePlanDigest: v.wavePlanDigest,
    sessions: [
      { id: "s", name: "上午", waveIds: v.wavePlan.waves.map((w) => w.id) },
    ],
  };
  f.platform.db.exec("CREATE TRIGGER schedule_fail BEFORE INSERT ON planning_canvas_schedules BEGIN SELECT RAISE(ABORT,'injected'); END");
  assert.equal((await f.request(path+"/schedule","PUT",body,f.cookie,"schedule-save")).status,503);
  f.platform.db.exec("DROP TRIGGER schedule_fail");
  const saved = await f.request(
    path + "/schedule",
    "PUT",
    body,
    f.cookie,
    "schedule-save",
  );
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(saved.data.data.version, 1);
  assert.deepEqual(
    (
      await f.request(
        path + "/schedule",
        "PUT",
        body,
        f.cookie,
        "schedule-save",
      )
    ).data.data,
    saved.data.data,
  );
  assert.equal(
    (await f.request(path, "GET", undefined, f.cookie)).data.data.version,
    1,
  );
  assert.equal(
    (
      await f.request(
        path + "/schedule",
        "PUT",
        body,
        f.cookie,
        "schedule-stale",
      )
    ).status,
    409,
  );
  graph.nodes[0].position.x += 1;
  await f.request(
    path,
    "PUT",
    { name: "wave-test", graph, expectedVersion: 1 },
    f.cookie,
    "graph-change",
  );
  assert.equal(
    (await f.request(path + "/schedule", "GET", undefined, f.cookie)).data.data
      .stale,
    true,
  );
  await f.request(path + "/validate", "POST", { expectedVersion: 2 }, f.cookie);
  const stale = (
    await f.request(path + "/schedule", "GET", undefined, f.cookie)
  ).data.data;
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.schedule.boundWavePlan, v.wavePlan);
});
test("session order, duplicate wave, time dependency and owner checks reject invalid writes", async (t) => {
  const f = await event(t),
    graph = G.migrate(G.sample("single")).graph;
  const c = (
      await f.request(
        "/planning-canvases",
        "POST",
        { name: "wave-test", graph },
        f.cookie,
        "c",
      )
    ).data.data,
    path = "/planning-canvases/" + c.id;
  const v = (
    await f.request(
      path + "/validate",
      "POST",
      { expectedVersion: 1 },
      f.cookie,
    )
  ).data.data;
  const ids = v.wavePlan.waves.map((w) => w.id),
    body = {
      expectedVersion: 1,
      expectedScheduleVersion: 0,
      wavePlanDigest: v.wavePlanDigest,
    };
  assert.equal(
    (
      await f.request(
        path + "/schedule",
        "PUT",
        {
          ...body,
          sessions: [{ id: "s", name: "s", waveIds: [...ids].reverse() }],
        },
        f.cookie,
        "bad-order",
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await f.request(
        path + "/schedule",
        "PUT",
        {
          ...body,
          sessions: [{ id: "s", name: "s", waveIds: [ids[0], ids[0]] }],
        },
        f.cookie,
        "duplicate",
      )
    ).status,
    422,
  );
  const sessions = [
    {
      id: "a",
      name: "a",
      waveIds: [ids[0]],
      timeRange: {
        startAt: "2026-10-14T10:00:00+08:00",
        endAt: "2026-10-14T11:00:00+08:00",
      },
    },
    {
      id: "b",
      name: "b",
      waveIds: ids.slice(1),
      timeRange: {
        startAt: "2026-10-14T10:30:00+08:00",
        endAt: "2026-10-14T12:00:00+08:00",
      },
    },
  ];
  assert.equal(
    (
      await f.request(
        path + "/schedule",
        "PUT",
        { ...body, sessions },
        f.cookie,
        "overlap",
      )
    ).status,
    422,
  );
  for (const startAt of [
    "2026-02-31T10:00:00+08:00",
    "2026-02-29T10:00:00+08:00",
    "2026-10-14T24:00:00+08:00",
  ])
    assert.equal(
      (
        await f.request(
          path + "/schedule",
          "PUT",
          {
            ...body,
            sessions: [
              {
                id: "bad-date",
                name: "bad",
                waveIds: ids,
                timeRange: { startAt, endAt: "2026-12-31T10:00:00+08:00" },
              },
            ],
          },
          f.cookie,
          "date-" + startAt,
        )
      ).status,
      422,
    );
  await f.request("/auth/register", "POST", {
    username: "wave_other",
    displayName: "other",
    password: "x",
  });
  const login = await f.request("/auth/login", "POST", {
      username: "wave_other",
      password: "x",
    }),
    cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await f.request(path + "/schedule", "GET", undefined, cookie)).status,
    403,
  );
});
