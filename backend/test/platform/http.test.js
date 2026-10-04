"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
async function fixture(t, options = {}) {
  const platform = createApp({
    databasePath: ":memory:",
    origins: ["http://localhost:5173"],
    ...options,
  });
  const server = platform.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    platform.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
  return {
    platform,
    async request(path, method = "GET", body, extra = {}) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: "http://localhost:5173",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...extra,
        },
        ...(body !== undefined
          ? { body: typeof body === "string" ? body : JSON.stringify(body) }
          : {}),
      });
      const raw = await response.text();
      return {
        status: response.status,
        headers: response.headers,
        raw,
        data: response.headers.get("content-type")?.includes("application/json")
          ? JSON.parse(raw)
          : null,
      };
    },
  };
}
test("CE3: unknown new API is safe JSON 404 with a server request identifier", async (t) => {
  const { request } = await fixture(t);
  const r = await request("/does-not-exist");
  assert.equal(r.status, 404);
  assert.equal(r.data?.error.code, "NOT_FOUND");
  assert.equal(typeof r.data?.error.requestId, "string");
  assert.equal(r.headers.get("cache-control"), "no-store");
});
module.exports = { fixture };

test("foundation: health reports durable storage without exposing paths", async (t) => {
  const { request } = await fixture(t);
  const r = await request("/health");
  assert.equal(r.status, 200);
  assert.equal(r.data.data.storage, "sqlite");
  assert.equal(r.data.data.status, "ok");
});

test("AC1: register persists a unique account and never returns credential material", async (t) => {
  const { request, platform } = await fixture(t);
  const body = {
    username: "Alice_1",
    displayName: "小艾",
    password: "tournament-pass-2026",
  };
  const r = await request("/auth/register", "POST", body);
  assert.equal(r.status, 201);
  assert.equal(r.data.data.username, "alice_1");
  assert.equal(r.raw.includes(body.password), false);
  const user = JSON.parse(
    platform.db
      .prepare("SELECT data FROM users WHERE username=?")
      .get("alice_1").data,
  );
  assert.notEqual(user.passwordHash, body.password);
  assert.equal(typeof user.salt, "string");
  const duplicate = await request("/auth/register", "POST", body);
  assert.equal(duplicate.status, 409);
  const bad = await request("/auth/register", "POST", {
    ...body,
    username: "b",
    role: "admin",
  });
  assert.equal(bad.status, 422);
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM users").get().n,
    1,
  );
});

test("AC2: session restores, rotates, expires, and logout revokes the old cookie", async (t) => {
  let clock = Date.now();
  const { request } = await fixture(t, { now: () => clock });
  await request("/auth/register", "POST", {
    username: "session_user",
    displayName: "选手",
    password: "correct-password-2026",
  });
  const login = await request("/auth/login", "POST", {
    username: "session_user",
    password: "correct-password-2026",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.ok(login.headers.get("set-cookie").includes("HttpOnly"));
  assert.equal(
    (await request("/auth/session", "GET", undefined, { Cookie: cookie })).data
      .data.user.username,
    "session_user",
  );
  const next = await request(
    "/auth/login",
    "POST",
    { username: "session_user", password: "correct-password-2026" },
    { Cookie: cookie },
  );
  const newer = next.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await request(
        "/me",
        "PATCH",
        { displayName: "新名字" },
        { Cookie: cookie },
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/me",
        "PATCH",
        { displayName: "新名字" },
        { Cookie: newer },
      )
    ).status,
    200,
  );
  await request("/auth/logout", "POST", {}, { Cookie: newer });
  assert.equal(
    (
      await request(
        "/me",
        "PATCH",
        { displayName: "不应保存" },
        { Cookie: newer },
      )
    ).status,
    401,
  );
  const expired = await request("/auth/login", "POST", {
    username: "session_user",
    password: "correct-password-2026",
  });
  clock += 8 * 24 * 3600 * 1000;
  assert.equal(
    (
      await request("/auth/session", "GET", undefined, {
        Cookie: expired.headers.get("set-cookie").split(";")[0],
      })
    ).data.data.user,
    null,
  );
  const wrong = await request("/auth/login", "POST", {
    username: "not_a_user",
    password: "correct-password-2026",
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.data.error.code, "INVALID_CREDENTIALS");
});

test("AC3: foreign origins and credential floods are rejected without writing users", async (t) => {
  const { request, platform } = await fixture(t);
  const bad = await request(
    "/auth/register",
    "POST",
    {
      username: "bad_origin",
      displayName: "不保存",
      password: "password-long-enough",
    },
    { Origin: "https://untrusted.example" },
  );
  assert.equal(bad.status, 403);
  assert.equal(bad.data.error.code, "ORIGIN_FORBIDDEN");
  for (let i = 0; i < 20; i++)
    assert.equal((await request("/auth/register", "POST", {})).status, 422);
  const limit = await request("/auth/register", "POST", {});
  assert.equal(limit.status, 429);
  assert.ok(Number(limit.headers.get("retry-after")) > 0);
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM users").get().n,
    0,
  );
});
test("CE3: malformed JSON and oversized input retain the error envelope", async (t) => {
  const { request } = await fixture(t);
  const malformed = await request("/auth/register", "POST", "{");
  assert.equal(malformed.status, 400);
  assert.equal(malformed.data.error.code, "BAD_REQUEST");
  const big = await request("/auth/register", "POST", {
    value: "a".repeat(1024 * 1024),
  });
  assert.equal(big.status, 413);
  assert.equal(big.data.error.code, "PAYLOAD_TOO_LARGE");
  assert.ok(big.data.error.requestId);
});

async function account(request, username) {
  await request("/auth/register", "POST", {
    username,
    displayName: username,
    password: "tournament-pass-2026",
  });
  const r = await request("/auth/login", "POST", {
    username,
    password: "tournament-pass-2026",
  });
  return { Cookie: r.headers.get("set-cookie").split(";")[0] };
}
test("TC1-4: independent tournaments persist, protect private data, and reject stale edits", async (t) => {
  const { request, platform } = await fixture(t);
  const owner = await account(request, "owner"),
    other = await account(request, "other");
  const series = await request(
    "/series",
    "POST",
    { name: "高校杯", description: "系列介绍" },
    { ...owner, "Idempotency-Key": "series" },
  );
  assert.equal(series.status, 201);
  const payload = {
    name: "第一届",
    game: "fighting",
    location: "线上",
    seriesId: series.data.data.id,
  };
  const a = await request("/tournaments", "POST", payload, {
    ...owner,
    "Idempotency-Key": "create",
  });
  assert.equal(a.status, 201);
  const id = a.data.data.id;
  assert.equal(a.data.data.visibility, "private");
  const again = await request("/tournaments", "POST", payload, {
    ...owner,
    "Idempotency-Key": "create",
  });
  assert.equal(again.data.data.id, id);
  assert.equal(
    (
      await request(
        "/tournaments",
        "POST",
        { ...payload, name: "异载荷" },
        { ...owner, "Idempotency-Key": "create" },
      )
    ).status,
    409,
  );
  assert.equal((await request("/tournaments/" + id)).status, 404);
  assert.equal(
    (await request("/tournaments/" + id, "GET", undefined, other)).status,
    404,
  );
  const published = await request(
    "/tournaments/" + id,
    "PATCH",
    { name: "公开高校杯", visibility: "public", expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "publish" },
  );
  assert.equal(published.status, 200);
  assert.equal(
    (await request("/tournaments/" + id)).data.data.name,
    "公开高校杯",
  );
  assert.equal(
    (
      await request(
        "/tournaments/" + id,
        "PATCH",
        { name: "越权", expectedVersion: 2 },
        { ...other, "Idempotency-Key": "other" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/tournaments/" + id,
        "PATCH",
        { name: "旧版", expectedVersion: 1 },
        { ...owner, "Idempotency-Key": "stale" },
      )
    ).status,
    409,
  );
  const catalog = await request("/tournaments?q=高校&game=fighting");
  assert.equal(catalog.data.data.total, 1);
  assert.equal(
    (await request("/series/" + series.data.data.id)).data.data.items.length,
    1,
  );
  const second = await request(
    "/tournaments",
    "POST",
    { ...payload, name: "第二届" },
    { ...owner, "Idempotency-Key": "second" },
  );
  assert.notEqual(second.data.data.id, id);
  assert.equal(
    (await request("/me/tournaments?relation=created", "GET", undefined, owner))
      .data.data.total,
    2,
  );
  assert.equal(
    (
      await request(
        "/tournaments/" + id,
        "PATCH",
        { runtimeStatus: "completed", expectedVersion: 2 },
        { ...owner, "Idempotency-Key": "illegal" },
      )
    ).status,
    422,
  );
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM tournaments").get().n,
    2,
  );
});

test("CW/TS: templates, validation and frozen snapshots use trusted HTTP identity", async (t) => {
  const { request } = await fixture(t),
    owner = await account(request, "config_owner");
  const tournament = await request(
    "/tournaments",
    "POST",
    { name: "配置杯", game: "card", visibility: "public" },
    { ...owner, "Idempotency-Key": "t" },
  );
  const id = tournament.data.data.id;
  const url = "/tournaments/" + id + "/configurations";
  const created = await request(
    url + "/from-template",
    "POST",
    { templateId: "four-groups", templateVersion: "1" },
    { ...owner, "Idempotency-Key": "template" },
  );
  assert.equal(created.status, 201);
  const c = created.data.data;
  assert.equal(c.version, 1);
  const valid = await request(
    url + "/" + c.id + "/validate",
    "POST",
    { expectedVersion: 1 },
    owner,
  );
  assert.equal(valid.status, 200);
  assert.equal(valid.data.data.structureValid, true);
  assert.equal(valid.data.data.runtimeReady, false);
  const frozen = await request(
    url + "/" + c.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "freeze" },
  );
  assert.equal(frozen.status, 200);
  assert.equal(frozen.data.data.started, false);
  const again = await request(
    url + "/" + c.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "freeze" },
  );
  assert.equal(again.data.data.snapshotId, frozen.data.data.snapshotId);
  const stages = await request("/tournaments/" + id + "/stages");
  assert.equal(stages.data.data.availability, "available");
  assert.equal(stages.data.data.items.length, 3);
  assert.equal(stages.raw.includes("frozenBy"), false);
  assert.equal(
    (await request(url + "/" + c.id, "GET", undefined, owner)).data.data.state,
    "structure-frozen",
  );
  const payload = {
    entrantKind: "individual",
    structureVersion: "structure-v1",
    routingVersion: "routing-v1",
    stages: [],
    pools: [],
    routes: [],
  };
  const edit = await request(
    url + "/" + c.id,
    "PUT",
    { expectedVersion: 2, payload },
    { ...owner, "Idempotency-Key": "edit" },
  );
  assert.equal(edit.status, 409);
  assert.equal(edit.data.error.code, "STRUCTURE_FROZEN");
  assert.equal((await request(url + "/" + c.id)).status, 401);
  assert.equal(
    (await request("/templates", "GET", undefined, owner)).data.data.length,
    2,
  );
});

test("CE1/2: every unavailable endpoint authorizes before returning 501 and writes nothing", async (t) => {
  const { request, platform } = await fixture(t),
    owner = await account(request, "cap_owner"),
    other = await account(request, "cap_other");
  const event = await request(
      "/tournaments",
      "POST",
      { name: "能力杯", game: "card" },
      { ...owner, "Idempotency-Key": "cap" },
    ),
    id = event.data.data.id;
  const endpoints = [
    ["POST", "registrations", "member"],
    ["GET", "registrations", "owner"],
    ["POST", "registrations/r/approve", "owner"],
    ["POST", "registrations/r/check-in", "owner"],
    ["DELETE", "registrations/r", "owner"],
    ["POST", "teams", "member"],
    ["GET", "matches", "public"],
    ["GET", "standings", "public"],
    ["POST", "start", "owner"],
    ["POST", "matches/m/results", "member"],
    ["GET", "results", "public"],
    ["PATCH", "matches/m/results", "owner"],
    ["GET", "matches/m/games", "public"],
    ["GET", "rounds", "owner"],
    ["POST", "rounds/r/confirm", "owner"],
    ["GET", "sanctions", "owner"],
    ["POST", "sanctions", "owner"],
    ["DELETE", "sanctions/s", "owner"],
    ["GET", "collaborators", "owner"],
    ["POST", "collaborators", "owner"],
    ["PATCH", "collaborators/u", "owner"],
    ["DELETE", "collaborators/u", "owner"],
  ];
  const state = () =>
    [
      "users",
      "tournaments",
      "series",
      "structure_aggregates",
      "catalog_requests",
    ].map((table) => platform.db.prepare("SELECT * FROM " + table).all());
  const before = state();
  for (const [method, path, access] of endpoints) {
    const url = "/tournaments/" + id + "/" + path,
      body = method === "GET" ? undefined : {};
    assert.equal(
      (await request(url, method, body, other)).status,
      404,
      method + " " + path + " private",
    );
    assert.equal(
      (await request(url, method, body)).status,
      access === "public" ? 404 : 401,
      method + " " + path + " guest",
    );
    const result = await request(url, method, body, owner);
    assert.equal(result.status, 501, method + " " + path);
    assert.ok(result.data.error.capability);
    assert.equal(result.data.error.retryable, false);
  }
  assert.deepEqual(state(), before);
  await request(
    "/tournaments/" + id,
    "PATCH",
    { visibility: "public", expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "public" },
  );
  const published = state();
  for (const [method, path, access] of endpoints) {
    const url = "/tournaments/" + id + "/" + path,
      body = method === "GET" ? undefined : {};
    assert.equal(
      (await request(url, method, body, other)).status,
      access === "owner" ? 403 : 501,
      method + " " + path + " non-owner",
    );
    assert.equal(
      (await request(url, method, body)).status,
      access === "public" ? 501 : 401,
      method + " " + path + " guest public",
    );
  }
  assert.deepEqual(state(), published);
  assert.equal((await request("/auth/password-reset", "POST", {})).status, 501);
  assert.equal(
    (await request("/tournaments/" + id + "/not-implemented-typo")).status,
    404,
  );
  const caps = await request("/capabilities");
  assert.equal(caps.status, 200);
  assert.equal(caps.data.data.capabilities.configuration.status, "implemented");
  assert.equal(caps.data.data.capabilities.registration.status, "unavailable");
  const effective = await request(
    "/tournaments/" + id + "/capabilities",
    "GET",
    undefined,
    other,
  );
  assert.equal(effective.data.data.effectivePermissions.configure, false);
});
test("persistence: account, metadata, frozen snapshot and request replay survive reopening SQLite", async (t) => {
  const { mkdtempSync, unlinkSync, rmdirSync, existsSync } = require("node:fs"),
    { tmpdir } = require("node:os"),
    { join } = require("node:path");
  const directory = mkdtempSync(join(tmpdir(), "race-platform-")),
    databasePath = join(directory, "test.sqlite");
  const cleanup = () => {
    for (const name of ["test.sqlite", "test.sqlite-wal", "test.sqlite-shm"]) {
      const path = join(directory, name);
      if (existsSync(path)) unlinkSync(path);
    }
    rmdirSync(directory);
  };
  const first = await fixture(t, { databasePath }),
    owner = await account(first.request, "durable");
  const event = await first.request(
      "/tournaments",
      "POST",
      { name: "持久杯", game: "card" },
      { ...owner, "Idempotency-Key": "event" },
    ),
    id = event.data.data.id,
    url = "/tournaments/" + id + "/configurations";
  const created = await first.request(
      url + "/from-template",
      "POST",
      { templateId: "pool", templateVersion: "1" },
      { ...owner, "Idempotency-Key": "template" },
    ),
    c = created.data.data;
  const freeze = await first.request(
    url + "/" + c.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "freeze" },
  );
  assert.equal(freeze.status, 200);
  first.platform.close();
  const second = await fixture(t, { databasePath });
  assert.equal(
    (await second.request("/auth/session", "GET", undefined, owner)).data.data
      .user.username,
    "durable",
  );
  const login = await second.request("/auth/login", "POST", {
    username: "durable",
    password: "tournament-pass-2026",
  });
  assert.equal(login.status, 200);
  assert.equal(
    (await second.request("/tournaments/" + id, "GET", undefined, owner)).data
      .data.name,
    "持久杯",
  );
  const replay = await second.request(
    url + "/" + c.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "freeze" },
  );
  assert.equal(replay.data.data.snapshotId, freeze.data.data.snapshotId);
  t.after(cleanup);
});
test("SQLite structure transaction rolls back a real commit failure and resolves same-version competition", async (t) => {
  const { request, platform } = await fixture(t),
    owner = await account(request, "rollback");
  const event = await request(
      "/tournaments",
      "POST",
      { name: "回滚杯", game: "card" },
      { ...owner, "Idempotency-Key": "event" },
    ),
    url = "/tournaments/" + event.data.data.id + "/configurations";
  const created = await request(
      url + "/from-template",
      "POST",
      { templateId: "pool", templateVersion: "1" },
      { ...owner, "Idempotency-Key": "template" },
    ),
    c = created.data.data;
  const before = platform.db
    .prepare("SELECT data FROM structure_aggregates")
    .get().data;
  platform.db.exec(
    "CREATE TRIGGER reject_update BEFORE UPDATE ON structure_aggregates BEGIN SELECT RAISE(ABORT,'test storage failure'); END;",
  );
  const failed = await request(
    url + "/" + c.id + "/freeze",
    "POST",
    { expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "freeze" },
  );
  assert.equal(failed.status, 503);
  assert.equal(failed.raw.includes("test storage failure"), false);
  assert.equal(
    platform.db.prepare("SELECT data FROM structure_aggregates").get().data,
    before,
  );
  platform.db.exec("DROP TRIGGER reject_update");
  const competing = await Promise.all(
    ["freeze", "competing"].map((key) =>
      request(
        url + "/" + c.id + "/freeze",
        "POST",
        { expectedVersion: 1 },
        { ...owner, "Idempotency-Key": key },
      ),
    ),
  );
  assert.deepEqual(competing.map((x) => x.status).sort(), [200, 409]);
  const state = JSON.parse(
    platform.db.prepare("SELECT data FROM structure_aggregates").get().data,
  );
  assert.equal(state.snapshots.length, 1);
});
test("error isolation: unexpected exceptions are sanitized, unavailable storage is 503", async (t) => {
  const { request, platform } = await fixture(t);
  const prepare = platform.db.prepare;
  platform.db.prepare = function (sql) {
    if (sql.includes("FROM users")) throw Error("secret SQL password stack");
    return prepare.call(this, sql);
  };
  const unexpected = await request("/auth/login", "POST", {
    username: "alice",
    password: "invalid",
  });
  assert.equal(unexpected.status, 500);
  assert.equal(unexpected.data.error.code, "INTERNAL_ERROR");
  assert.equal(unexpected.raw.includes("secret"), false);
  platform.db.prepare = prepare;
  platform.close();
  const health = await request("/health");
  assert.equal(health.status, 503);
  assert.equal(health.data.error.code, "STORE_UNAVAILABLE");
});
test("input, visibility, page limits and metadata commit failures retain durable invariants", async (t) => {
  const { request, platform } = await fixture(t),
    owner = await account(request, "bounds_owner"),
    other = await account(request, "bounds_other");
  const series = await request(
    "/series",
    "POST",
    { name: "自有系列" },
    { ...owner, "Idempotency-Key": "series" },
  );
  for (const body of [
    { name: "日期杯", game: "card", startsAt: "2026-02-30T10:00Z" },
    { name: "日期杯", game: "card", startsAt: "2026-10-04T10:00" },
    { name: "a".repeat(101), game: "card" },
  ])
    assert.equal(
      (
        await request("/tournaments", "POST", body, {
          ...owner,
          "Idempotency-Key": "bad",
        })
      ).status,
      422,
    );
  assert.equal(
    (
      await request(
        "/tournaments",
        "POST",
        { name: "越权", game: "card", seriesId: series.data.data.id },
        { ...other, "Idempotency-Key": "foreign" },
      )
    ).status,
    403,
  );
  assert.equal((await request("/tournaments?pageSize=51")).status, 400);
  assert.equal((await request("/tournaments?unsupported=1")).status, 400);
  platform.db.exec(
    "CREATE TRIGGER reject_catalog BEFORE INSERT ON catalog_requests BEGIN SELECT RAISE(ABORT,'transaction test'); END;",
  );
  const before = platform.db
    .prepare("SELECT count(*) AS n FROM tournaments")
    .get().n;
  const failed = await request(
    "/tournaments",
    "POST",
    { name: "原子杯", game: "card" },
    { ...owner, "Idempotency-Key": "rollback" },
  );
  assert.equal(failed.status, 503);
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM tournaments").get().n,
    before,
  );
  platform.db.exec("DROP TRIGGER reject_catalog");
  const event = await request(
      "/tournaments",
      "POST",
      { name: "原子杯", game: "card", visibility: "public" },
      { ...owner, "Idempotency-Key": "rollback" },
    ),
    id = event.data.data.id;
  const hidden = await request(
    "/tournaments/" + id,
    "PATCH",
    { visibility: "private", expectedVersion: 1 },
    { ...owner, "Idempotency-Key": "hide" },
  );
  assert.equal(hidden.status, 200);
  assert.equal(
    (await request("/tournaments/" + id, "GET", undefined, other)).status,
    404,
  );
  assert.equal((await request("/series/" + series.data.data.id)).status, 404);
});
test("structure HTTP rejects forged identity, foreign configuration IDs and chooses the latest safe snapshot", async (t) => {
  const { request } = await fixture(t),
    owner = await account(request, "projection_owner");
  const events = [];
  for (const key of ["first", "second"])
    events.push(
      (
        await request(
          "/tournaments",
          "POST",
          { name: key, game: "card", visibility: "public" },
          { ...owner, "Idempotency-Key": key },
        )
      ).data.data,
    );
  const root = "/tournaments/" + events[0].id + "/configurations";
  assert.equal(
    (await request("/tournaments/" + events[0].id + "/stages")).data.data
      .availability,
    "no-frozen-configuration",
  );
  assert.equal(
    (
      await request(
        root,
        "POST",
        { payload: {}, actorId: "forged" },
        { ...owner, "Idempotency-Key": "forged" },
      )
    ).status,
    422,
  );
  const snapshots = [];
  for (const templateId of ["four-groups", "pool"]) {
    const c = (
      await request(
        root + "/from-template",
        "POST",
        { templateId, templateVersion: "1" },
        { ...owner, "Idempotency-Key": templateId },
      )
    ).data.data;
    assert.equal(
      (
        await request(
          "/tournaments/" + events[1].id + "/configurations/" + c.id,
          "GET",
          undefined,
          owner,
        )
      ).status,
      404,
    );
    snapshots.push(
      (
        await request(
          root + "/" + c.id + "/freeze",
          "POST",
          { expectedVersion: 1 },
          { ...owner, "Idempotency-Key": "freeze-" + templateId },
        )
      ).data.data,
    );
  }
  const expected = snapshots.sort(
      (a, b) =>
        b.frozenAt.localeCompare(a.frozenAt) ||
        b.snapshotId.localeCompare(a.snapshotId),
    )[0],
    projection = await request("/tournaments/" + events[0].id + "/stages");
  assert.equal(projection.data.data.configurationId, expected.configurationId);
  for (const secret of [
    "frozenBy",
    "diagnostics",
    "sourceSnapshots",
    "roster",
    "requests",
  ])
    assert.equal(projection.raw.includes(secret), false);
});
test("migration errors preserve the original file and refuse to open an invalid database", () => {
  const {
      mkdtempSync,
      writeFileSync,
      readFileSync,
      unlinkSync,
      rmdirSync,
    } = require("node:fs"),
    { tmpdir } = require("node:os"),
    { join } = require("node:path");
  const directory = mkdtempSync(join(tmpdir(), "race-invalid-")),
    path = join(directory, "invalid.sqlite");
  writeFileSync(path, "original invalid data");
  try {
    assert.throws(() => createApp({ databasePath: path }));
    assert.equal(readFileSync(path, "utf8"), "original invalid data");
  } finally {
    unlinkSync(path);
    rmdirSync(directory);
  }
});
