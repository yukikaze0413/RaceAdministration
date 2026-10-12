"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { event } = require("./formats-v2-fixture"),
  { createApp } = require("../../src/app"),
  { openDatabase } = require("../../src/platform/storage/database");
test("RC3 isolated import rollback retains original key; restart keeps edited instance and scoped authorization", async (t) => {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "race-demo-restart-"),
    ),
    database = path.join(directory, "parent.sqlite"),
    root = path.join(directory, ".reference-demos");
  const f = await event(t, { databasePath: database, demoRoot: root });
  let reopened, server;
  t.after(async () => {
    if (server?.listening) await new Promise((r) => server.close(r));
    reopened?.close();
    await f.close();
    if (fs.existsSync(root)) {
      for (const name of fs.readdirSync(root)) {
        const file = path.resolve(root, name);
        assert.equal(path.dirname(file), path.resolve(root));
        fs.unlinkSync(file);
      }
      fs.rmdirSync(root);
    }
    for (const file of [database, database + "-wal", database + "-shm"])
      if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  });
  const uid = (await f.request("/auth/session", "GET", undefined, f.cookie))
      .data.data.user.id,
    key = "rollback-import";
  const id = createHash("sha256")
      .update(JSON.stringify([uid, key]))
      .digest("hex"),
    filename = path.join(root, id + ".sqlite");
  let child = openDatabase(filename);
  child.exec(
    "CREATE TRIGGER fail_reference BEFORE INSERT ON structure_aggregates BEGIN SELECT RAISE(ABORT,'injected demo failure'); END;",
  );
  child.close();
  const body = {
    caseId: "shadow-cup-v1",
    caseVersion: 1,
    expectedVersion: 0,
    confirmed: true,
  };
  assert.equal(
    (await f.request("/reference-demos", "POST", body, f.cookie, key)).status,
    503,
  );
  child = openDatabase(filename);
  assert.equal(child.prepare("SELECT count(*) AS n FROM users").get().n, 0);
  assert.equal(
    child.prepare("SELECT count(*) AS n FROM tournaments").get().n,
    0,
  );
  child.exec("DROP TRIGGER fail_reference");
  child.close();
  const created = await f.request(
    "/reference-demos",
    "POST",
    body,
    f.cookie,
    key,
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const d = created.data.data,
    cookie = created.headers.get("set-cookie").split(";")[0];
  const endpoint =
    d.prefix +
    "/api/v1/tournaments/" +
    d.tournamentId +
    "/configurations/" +
    d.configurationId;
  async function request(
    origin,
    url,
    method = "GET",
    payload,
    session = cookie,
    key2,
  ) {
    const r = await fetch(origin + url, {
      method,
      headers: {
        Origin: "http://localhost:5173",
        Cookie: session + "; " + f.cookie,
        ...(payload ? { "Content-Type": "application/json" } : {}),
        ...(key2 ? { "Idempotency-Key": key2 } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    return { status: r.status, data: await r.json() };
  }
  const config = (await request(f.origin, endpoint)).data.data;
  const payload = { ...config };
  for (const k of ["id", "tournamentId", "version", "state"]) delete payload[k];
  payload.stages[0].parameters.defaultBO = 5;
  const saved = await request(
    f.origin,
    endpoint,
    "PUT",
    { expectedVersion: 1, payload },
    cookie,
    "edit",
  );
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  await f.close();
  reopened = createApp({
    databasePath: database,
    demoRoot: root,
    origins: ["http://localhost:5173"],
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    server = reopened.app.listen(
      25000 + Math.floor(Math.random() * 30000),
      "127.0.0.1",
    );
    const ready = await new Promise((resolve, reject) => {
      server.once("listening", () => resolve(true));
      server.once("error", (e) =>
        ["EADDRINUSE", "EACCES"].includes(e.code) ? resolve(false) : reject(e),
      );
    });
    if (ready) break;
    if (attempt === 29) throw Error("No high restart port");
  }
  const restartedOrigin = "http://127.0.0.1:" + server.address().port;
  assert.equal(
    (await request(restartedOrigin, endpoint)).data.data.stages[0].parameters
      .defaultBO,
    5,
  );
  const again = await request(
    restartedOrigin,
    "/api/v1/reference-demos",
    "POST",
    body,
    f.cookie,
    key,
  );
  assert.equal(again.status, 201);
  assert.deepEqual(again.data.data, d);
  assert.equal((await request(restartedOrigin, endpoint)).data.data.version, 2);
  assert.equal(
    reopened.db.prepare("SELECT count(*) AS n FROM tournaments").get().n,
    1,
    "父库只有原测试赛事",
  );
  assert.equal(
    fs.readdirSync(root).filter((name) => name.endsWith(".sqlite")).length,
    1,
  );
  reopened.db.prepare("DELETE FROM sessions WHERE userId=?").run(uid);
  assert.equal(
    (
      await request(
        restartedOrigin,
        "/api/v1/reference-demos",
        "POST",
        body,
        f.cookie,
        key,
      )
    ).status,
    401,
    "当前会话撤销不能重放导入缓存",
  );
});
