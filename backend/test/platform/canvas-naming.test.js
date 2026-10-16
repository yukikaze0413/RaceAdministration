"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { event } = require("./formats-v2-fixture");
const G = require("../../src/planning-canvas/graph");
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("canvas uses unnumbered graph, editor and preview identifiers", () => {
  const graph = G.sample("single");
  assert.equal(graph.schemaVersion, "canvas");
  assert.equal(
    require("../../src/planning-canvas/editor-catalog").catalog()
      .editorProtocol,
    "canvas-editor",
  );
  assert.ok(
    G.preview(graph, "id").matches.every((match) =>
      match.planKey.startsWith("canvas-plan/"),
    ),
  );
  for (const name of ["canvas-v1", "canvas-v2"])
    assert.throws(() => G.parse({ ...graph, schemaVersion: name }));
});

test("stored graph rename preserves verified schedule, identities and original request replay", async (t) => {
  const f = await event(t),
    db = f.platform.db;
  const graph = G.sample("single"),
    oldGraph = { ...graph, schemaVersion: "canvas-v2" };
  const report = G.analyze(graph);
  report.version = 1;
  report.digest = digest(oldGraph);
  report.wavePlan.graphVersion = 1;
  report.wavePlan.graphDigest = report.digest;
  report.wavePlanDigest = digest(report.wavePlan);
  const id = "rename-canvas",
    owner = db
      .prepare("SELECT id FROM users WHERE username=?")
      .get("v2_owner").id;
  const sessions = [
    {
      id: "kept-session",
      name: "Session",
      waveIds: report.wavePlan.waves.map((w) => w.id),
    },
  ];
  const schedule = {
    wavePlanDigest: report.wavePlanDigest,
    boundWavePlan: report.wavePlan,
    sessions,
  };
  const body = { name: "Kept", graph: oldGraph },
    oldResult = {
      id,
      name: body.name,
      version: 1,
      graph: oldGraph,
      digest: report.digest,
    };
  const fingerprint = digest({ operation: "create", id: null, body });
  const scheduleBody = {
    expectedVersion: 1,
    expectedScheduleVersion: 1,
    wavePlanDigest: report.wavePlanDigest,
    sessions,
  };
  db.prepare("INSERT INTO planning_canvases VALUES(?,?,?,?,?,?)").run(
    id,
    owner,
    1,
    body.name,
    JSON.stringify(oldGraph),
    JSON.stringify(report),
  );
  db.prepare("INSERT INTO planning_canvas_schedules VALUES(?,?,?)").run(
    id,
    2,
    JSON.stringify(schedule),
  );
  db.prepare("INSERT INTO canvas_requests VALUES(?,?,?,?)").run(
    owner,
    "rename-create",
    fingerprint,
    JSON.stringify(oldResult),
  );
  db.prepare("INSERT INTO canvas_requests VALUES(?,?,?,?)").run(
    owner,
    "rename-schedule",
    digest({ operation: "schedule-replace", id, body: scheduleBody }),
    JSON.stringify({ version: 2, schedule, stale: false }),
  );
  db.exec("DELETE FROM schema_migrations WHERE version=5");
  const {
    migrateCanvasNaming,
  } = require("../../src/platform/storage/canvas-naming");
  migrateCanvasNaming(db);
  const read = await f.request(
    "/planning-canvases/" + id,
    "GET",
    undefined,
    f.cookie,
  );
  assert.equal(read.data.data.graph.schemaVersion, "canvas");
  assert.deepEqual(read.data.data.graph.nodes, oldGraph.nodes);
  assert.equal(read.data.data.version, 1);
  const preview = await f.request(
    "/planning-canvases/" + id + "/preview",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
  );
  assert.equal(preview.status, 200);
  const scheduled = (
    await f.request(
      "/planning-canvases/" + id + "/schedule",
      "GET",
      undefined,
      f.cookie,
    )
  ).data.data;
  assert.equal(scheduled.version, 2);
  assert.equal(scheduled.stale, false);
  assert.deepEqual(scheduled.schedule.sessions, sessions);
  assert.equal(
    scheduled.schedule.boundWavePlan.graphDigest,
    read.data.data.digest,
  );
  assert.equal(
    scheduled.schedule.wavePlanDigest,
    preview.data.data.wavePlanDigest,
  );
  const repeated = await f.request(
    "/planning-canvases",
    "POST",
    { ...body, graph: read.data.data.graph },
    f.cookie,
    "rename-create",
  );
  assert.equal(repeated.status, 201);
  assert.deepEqual(repeated.data.data, read.data.data);
  const repeatedSchedule = await f.request(
    "/planning-canvases/" + id + "/schedule",
    "PUT",
    { ...scheduleBody, wavePlanDigest: scheduled.schedule.wavePlanDigest },
    f.cookie,
    "rename-schedule",
  );
  assert.equal(repeatedSchedule.status, 200);
  assert.deepEqual(repeatedSchedule.data.data.schedule, scheduled.schedule);
  assert.equal(
    db
      .prepare("SELECT fingerprint FROM canvas_requests WHERE requestKey=?")
      .get("rename-create").fingerprint,
    fingerprint,
  );
  const before = db
    .prepare("SELECT * FROM planning_canvases WHERE id=?")
    .get(id);
  migrateCanvasNaming(db);
  assert.deepEqual(
    db.prepare("SELECT * FROM planning_canvases WHERE id=?").get(id),
    before,
  );
  for (const schemaVersion of ["canvas-v1", "canvas-v2"])
    assert.equal(
      (
        await f.request(
          "/planning-canvases",
          "POST",
          { name: "Rejected", graph: { ...graph, schemaVersion } },
          f.cookie,
          "reject-" + schemaVersion,
        )
      ).status,
      422,
    );
});

test("rename leaves stale validation stale and rolls back malformed stored graphs", async (t) => {
  const f = await event(t),
    db = f.platform.db,
    owner = db
      .prepare("SELECT id FROM users WHERE username=?")
      .get("v2_owner").id;
  const graph = { ...G.sample("single"), schemaVersion: "canvas-v2" },
    validation = G.analyze(G.sample("single"));
  validation.version = 1;
  validation.digest = "already-stale";
  db.prepare("INSERT INTO planning_canvases VALUES(?,?,?,?,?,?)").run(
    "stale",
    owner,
    1,
    "stale",
    JSON.stringify(graph),
    JSON.stringify(validation),
  );
  db.prepare("INSERT INTO planning_canvas_schedules VALUES(?,?,?)").run(
    "stale",
    1,
    JSON.stringify({
      wavePlanDigest: "already-stale",
      boundWavePlan: validation.wavePlan,
      sessions: [],
    }),
  );
  db.prepare("INSERT INTO planning_canvases VALUES(?,?,?,?,?,NULL)").run(
    "broken",
    owner,
    1,
    "broken",
    "{",
  );
  db.exec("DELETE FROM schema_migrations WHERE version=5");
  const {
    migrateCanvasNaming,
  } = require("../../src/platform/storage/canvas-naming");
  assert.throws(() => migrateCanvasNaming(db));
  assert.equal(
    JSON.parse(
      db.prepare("SELECT graph FROM planning_canvases WHERE id='stale'").get()
        .graph,
    ).schemaVersion,
    "canvas-v2",
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM schema_migrations WHERE version=5").get()
      .n,
    0,
  );
  db.prepare("DELETE FROM planning_canvases WHERE id='broken'").run();
  migrateCanvasNaming(db);
  assert.equal(
    (
      await f.request(
        "/planning-canvases/stale/preview",
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
        "/planning-canvases/stale/schedule",
        "GET",
        undefined,
        f.cookie,
      )
    ).data.data.stale,
    true,
  );
});

test("opening an existing SQLite database applies the rename exactly once", () => {
  const { mkdtempSync, rmSync } = require("node:fs"),
    { join } = require("node:path"),
    { tmpdir } = require("node:os");
  const { openDatabase } = require("../../src/platform/storage/database");
  const directory = mkdtempSync(join(tmpdir(), "canvas-naming-")),
    file = join(directory, "canvas.sqlite");
  let db;
  try {
    db = openDatabase(file);
    db.prepare("INSERT INTO users VALUES(?,?,?)").run("owner", "owner", "{}");
    db.prepare("INSERT INTO planning_canvases VALUES(?,?,?,?,?,NULL)").run(
      "kept",
      "owner",
      4,
      "Kept",
      JSON.stringify({ ...G.sample("single"), schemaVersion: "canvas-v2" }),
    );
    db.exec("DELETE FROM schema_migrations WHERE version=5");
    db.close();
    db = openDatabase(file);
    const first = db.prepare("SELECT * FROM planning_canvases").get();
    assert.equal(JSON.parse(first.graph).schemaVersion, "canvas");
    assert.equal(first.version, 4);
    db.close();
    db = openDatabase(file);
    assert.deepEqual(
      db.prepare("SELECT * FROM planning_canvases").get(),
      first,
    );
  } finally {
    db?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
