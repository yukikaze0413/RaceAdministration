"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
async function fixture(t, { databasePath = ":memory:" } = {}) {
  const platform = createApp({
    databasePath,
    origins: ["http://localhost:5173"],
  });
  let server;
  for (let i = 0; i < 30; i++) {
    server = platform.app.listen(
      25000 + Math.floor(Math.random() * 30000),
      "127.0.0.1",
    );
    const ready = await new Promise((resolve, reject) => {
      server.once("listening", () => resolve(true));
      server.once("error", (e) =>
        e.code === "EADDRINUSE" ? resolve(false) : reject(e),
      );
    });
    if (ready) break;
    if (i === 29) throw Error("No test port");
  }
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise((r) => server.close(r));
    platform.close();
  }
  t.after(close);
  const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
  async function request(path, method = "GET", body, cookie, key) {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: "http://localhost:5173",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  await request("/auth/register", "POST", {
    username: "upgrade_owner",
    password: "upgrade-test-password",
    displayName: "升级测试",
  });
  const login = await request("/auth/login", "POST", {
    username: "upgrade_owner",
    password: "upgrade-test-password",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const event = await request(
    "/tournaments",
    "POST",
    { name: "Upgrade isolation", game: "card", visibility: "private" },
    cookie,
    "event",
  );
  const tid = event.data.data.id,
    root = "/tournaments/" + tid + "/configurations";
  return { platform, request, cookie, tid, root, close };
}
const legacy = {
  entrantKind: "individual",
  structureVersion: "structure-v1",
  routingVersion: "routing-v1",
  stages: [
    {
      id: "A",
      order: 1,
      capacity: 8,
      formatIntent: "round-robin",
      groups: [
        { id: "a1", stageId: "A", capacity: 4 },
        { id: "a2", stageId: "A", capacity: 4 },
      ],
    },
    {
      id: "B",
      order: 2,
      capacity: 2,
      formatIntent: "single-elimination",
      groups: [],
    },
  ],
  pools: [
    {
      id: "P",
      capacity: 2,
      sort: [
        { field: "sourcePriority", direction: "asc", sources: ["a1", "a2"] },
        { field: "initialSeed", direction: "asc" },
      ],
    },
  ],
  routes: [
    ...["a1", "a2"].map((g, i) => ({
      id: "in" + i,
      source: { stageId: "A", groupId: g },
      target: { poolId: "P" },
      selector: { kind: "rankRange", from: 1, to: 1 },
      quota: 1,
      sort: [{ field: "sourceRank", direction: "asc" }],
    })),
    {
      id: "out",
      source: { poolId: "P" },
      target: { stageId: "B" },
      selector: { kind: "all" },
      quota: 2,
      sort: [{ field: "poolSeed", direction: "asc" }],
      placement: { kind: "slot", positions: [1, 2] },
    },
  ],
};
async function source(f, payload = legacy, key = "source") {
  const r = await f.request(f.root, "POST", { payload }, f.cookie, key);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.data;
}
test("TS7 copy is independent and rewrites every internal reference with durable provenance", async (t) => {
  const f = await fixture(t),
    old = await source(f),
    path = f.root + "/" + old.id;
  const r = await f.request(
    path + "/copy-upgrade",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "upgrade",
  );
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const c = r.data.data,
    m = c.upgradeOrigin;
  assert.notEqual(c.id, old.id);
  assert.equal(c.version, 1);
  assert.equal(c.structureVersion, "structure-v2");
  assert.equal(m.configurationId, old.id);
  assert.equal(m.version, 1);
  assert.equal(c.stages[0].id, m.mapping.stages.A);
  assert.deepEqual(
    c.stages[0].groups.map((g) => g.id),
    [m.mapping.groups.a1, m.mapping.groups.a2],
  );
  assert.equal(c.stages[1].groups.length, 1);
  assert.equal(c.routes[2].target.groupId, c.stages[1].groups[0].id);
  assert.deepEqual(c.pools[0].sort[0].sources, [
    m.mapping.groups.a1,
    m.mapping.groups.a2,
  ]);
  assert.equal(c.routes[0].source.stageId, c.stages[0].id);
  assert.equal(c.routes[0].source.groupId, c.stages[0].groups[0].id);
  assert.equal(c.routes[0].target.poolId, c.pools[0].id);
  assert.equal(c.routes[2].source.poolId, c.pools[0].id);
  assert.deepEqual(c.routes[2].placement, { kind: "slot", positions: [1, 2] });
  assert.deepEqual(
    (await f.request(path, "GET", undefined, f.cookie)).data.data,
    old,
  );
  const replay = await f.request(
    path + "/copy-upgrade",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "upgrade",
  );
  assert.deepEqual(replay.data.data, c);
  assert.equal(
    (await f.request(f.root, "GET", undefined, f.cookie)).data.data.length,
    2,
  );
});

test("TS7 six-person legacy remains runnable v1; copied v2 keeps six and exposes incomplete rules", async (t) => {
  const f = await fixture(t),
    payload = {
      ...legacy,
      stages: [
        {
          id: "six",
          order: 1,
          capacity: 6,
          formatIntent: "single-elimination",
          groups: [],
        },
      ],
      pools: [],
      routes: [],
    },
    old = await source(f, payload);
  const result = await f.request(
    f.root + "/" + old.id + "/copy-upgrade",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "six-copy",
  );
  assert.equal(result.status, 201);
  const copied = result.data.data;
  assert.equal(copied.stages[0].groupSize, 6);
  assert.equal(copied.stages[0].capacity, 6);
  assert.ok(
    copied.upgradeOrigin.warnings.some(
      (w) => w.code === "FORMAT_PARAMETERS_INVALID",
    ),
  );
  const frozen = await f.request(
    f.root + "/" + old.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "freeze-six",
  );
  assert.equal(frozen.status, 200, JSON.stringify(frozen.data));
  const before = await f.request(
    f.root + "/" + old.id,
    "GET",
    undefined,
    f.cookie,
  );
  const denied = await f.request(
    f.root + "/" + old.id + "/copy-upgrade",
    "POST",
    { expectedVersion: 2 },
    f.cookie,
    "frozen-copy",
  );
  assert.equal(denied.status, 409);
  assert.equal(denied.data.error.code, "STRUCTURE_FROZEN");
  const after = await f.request(
    f.root + "/" + old.id,
    "GET",
    undefined,
    f.cookie,
  );
  assert.deepEqual(after.data.data, before.data.data);
  assert.equal(after.data.data.snapshot.digest, frozen.data.data.digest);
  assert.equal(after.data.data.structureVersion, "structure-v1");
  assert.equal(after.data.data.stages[0].capacity, 6);
});
test("TS7 copy rejects stale, unsupported, cross-event, forged provenance and heterogeneous input without partial creation", async (t) => {
  const f = await fixture(t),
    old = await source(f);
  assert.equal(
    (
      await f.request(
        f.root + "/" + old.id + "/copy-upgrade",
        "POST",
        { expectedVersion: 0 },
        f.cookie,
        "stale",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        f.root + "/" + old.id + "/copy-upgrade",
        "POST",
        { expectedVersion: 1, upgradeOrigin: {} },
        f.cookie,
        "forged",
      )
    ).status,
    422,
  );
  const major = await source(
    f,
    {
      ...legacy,
      stages: [
        {
          id: "x",
          order: 1,
          capacity: 4,
          formatIntent: "major-like",
          groups: [],
        },
      ],
      pools: [],
      routes: [],
    },
    "major",
  );
  const heterogeneous = await source(
    f,
    {
      ...legacy,
      stages: [
        {
          id: "h",
          order: 1,
          capacity: 10,
          formatIntent: "round-robin",
          groups: [
            { id: "h1", stageId: "h", capacity: 4 },
            { id: "h2", stageId: "h", capacity: 6 },
          ],
        },
      ],
      pools: [],
      routes: [],
    },
    "hetero",
  );
  for (const c of [major, heterogeneous])
    assert.equal(
      (
        await f.request(
          f.root + "/" + c.id + "/copy-upgrade",
          "POST",
          { expectedVersion: 1 },
          f.cookie,
          c.id,
        )
      ).status,
      422,
    );
  const other = await f.request(
    "/tournaments",
    "POST",
    { name: "Other", game: "card", visibility: "private" },
    f.cookie,
    "other",
  );
  assert.equal(
    (
      await f.request(
        "/tournaments/" +
          other.data.data.id +
          "/configurations/" +
          old.id +
          "/copy-upgrade",
        "POST",
        { expectedVersion: 1 },
        f.cookie,
        "cross",
      )
    ).status,
    404,
  );
  assert.equal(
    (await f.request(f.root, "GET", undefined, f.cookie)).data.data.length,
    3,
  );
});
test("TS7 failed copy rolls back configuration and request; original key works after recovery", async (t) => {
  const f = await fixture(t),
    old = await source(f),
    path = f.root + "/" + old.id + "/copy-upgrade";
  const before = f.platform.db
    .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
    .get(f.tid).data;
  f.platform.db.exec(
    "CREATE TRIGGER fail_upgrade BEFORE UPDATE ON structure_aggregates BEGIN SELECT RAISE(ABORT, 'upgrade fault'); END",
  );
  const failed = await f.request(
    path,
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "recover",
  );
  assert.equal(failed.status, 503);
  assert.equal(
    f.platform.db
      .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
      .get(f.tid).data,
    before,
  );
  f.platform.db.exec("DROP TRIGGER fail_upgrade");
  const recovered = await f.request(
    path,
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "recover",
  );
  assert.equal(recovered.status, 201);
  const replay = await f.request(
    path,
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "recover",
  );
  assert.deepEqual(replay.data.data, recovered.data.data);
});
test("TS7 provenance survives editing and SQLite reopen; retry still returns original independent copy", async (t) => {
  const { mkdtempSync, rmSync } = require("node:fs"),
    { join } = require("node:path"),
    { tmpdir } = require("node:os");
  const directory = mkdtempSync(join(tmpdir(), "race-copy-upgrade-")),
    databasePath = join(directory, "upgrade.sqlite");
  const f = await fixture(t, { databasePath }),
    old = await source(f),
    path = f.root + "/" + old.id + "/copy-upgrade";
  const copied = (
    await f.request(path, "POST", { expectedVersion: 1 }, f.cookie, "durable")
  ).data.data;
  const stage = await f.request(
    f.root + "/" + copied.id + "/stages",
    "POST",
    {
      expectedVersion: 1,
      stage: { ruleVersion: "gsl-classic-v1", name: "追加阶段" },
    },
    f.cookie,
    "addition",
  );
  assert.equal(stage.status, 200, JSON.stringify(stage.data));
  assert.deepEqual(stage.data.data.upgradeOrigin, copied.upgradeOrigin);
  await f.close();
  const reopened = await fixture(t, { databasePath });
  t.after(async () => {
    await reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const replay = await reopened.request(
    path,
    "POST",
    { expectedVersion: 1 },
    reopened.cookie,
    "durable",
  );
  assert.equal(replay.status, 201);
  assert.deepEqual(replay.data.data, copied);
  const latest = await reopened.request(
    f.root + "/" + copied.id,
    "GET",
    undefined,
    reopened.cookie,
  );
  assert.equal(latest.data.data.version, 2);
  assert.deepEqual(latest.data.data.upgradeOrigin, copied.upgradeOrigin);
});
test("TS7 legal prototype-like identifiers are rewritten as own mapping entries", async (t) => {
  const f = await fixture(t),
    old = await source(f, {
      ...legacy,
      stages: [
        {
          id: "__proto__",
          order: 1,
          capacity: 8,
          formatIntent: "single-elimination",
          groups: [],
        },
        {
          id: "constructor",
          order: 2,
          capacity: 2,
          formatIntent: "single-elimination",
          groups: [],
        },
      ],
      pools: [],
      routes: [
        {
          id: "toString",
          source: { stageId: "__proto__" },
          target: { stageId: "constructor" },
          selector: { kind: "rankRange", from: 1, to: 1 },
          quota: 1,
          sort: [
            {
              field: "sourcePriority",
              direction: "asc",
              sources: ["__proto__"],
            },
          ],
          placement: { kind: "slot", positions: [1] },
        },
      ],
    });
  const result = await f.request(
    f.root + "/" + old.id + "/copy-upgrade",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "proto",
  );
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const c = result.data.data;
  assert.ok(Object.hasOwn(c.upgradeOrigin.mapping.stages, "__proto__"));
  assert.equal(c.routes[0].source.stageId, c.stages[0].id);
  assert.equal(c.routes[0].sort[0].sources[0], c.stages[0].groups[0].id);
});
