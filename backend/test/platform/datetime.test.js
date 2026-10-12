"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { listenTestServer } = require("../helpers/http-listener");
async function fixture(t) {
  const platform = createApp({
    databasePath: ":memory:",
    origins: ["http://localhost:5173"],
  });
  const server = await listenTestServer(platform.app);
  t.after(async () => {
    await new Promise((r) => server.close(r));
    platform.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
  let cookie;
  async function request(path, method = "GET", body) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: "http://localhost:5173",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body
          ? {
              "Content-Type": "application/json",
              "Idempotency-Key": require("node:crypto").randomUUID(),
            }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    return { status: response.status, json: await response.json() };
  }
  await request("/auth/register", "POST", {
    username: "datetime",
    displayName: "日期",
    password: "x",
  });
  await request("/auth/login", "POST", { username: "datetime", password: "x" });
  return { request, platform };
}
test("DT2 invalid date has a field error and does not write a record or successful request", async (t) => {
  const { request, platform } = await fixture(t);
  for (const startsAt of ["2026-02-30T10:00+08:00", "2026-10-05T10:30"]) {
    const r = await request("/tournaments", "POST", {
      name: "无效",
      game: "card",
      startsAt,
    });
    assert.equal(r.status, 422);
    assert.equal(r.json.error.fieldErrors[0].path, "/startsAt");
  }
  assert.equal(
    platform.db.prepare("SELECT count(*) n FROM tournaments").get().n,
    0,
  );
  assert.equal(
    platform.db.prepare("SELECT count(*) n FROM catalog_requests").get().n,
    0,
  );
});
test("DT1 real HTTP creates both hand-calculated instants and preserves milliseconds on name-only edit", async (t) => {
  const { request } = await fixture(t);
  for (const [wall, utc] of [
    ["2026-10-05T10:30:00+08:00", "2026-10-05T02:30:00.000Z"],
    ["2026-10-04T23:45:00-04:00", "2026-10-05T03:45:00.000Z"],
    ["2024-02-29T23:59:47.123+08:00", "2024-02-29T15:59:47.123Z"],
  ]) {
    const r = await request("/tournaments", "POST", {
      name: "日期赛事",
      game: "card",
      startsAt: wall,
    });
    assert.equal(r.status, 201);
    const item = r.json.data;
    assert.equal(item.startsAt, utc);
    const edit = await request("/tournaments/" + item.id, "PATCH", {
      name: "改名",
      expectedVersion: 1,
    });
    assert.equal(edit.json.data.startsAt, utc);
    assert.equal(
      (await request("/tournaments/" + item.id)).json.data.startsAt,
      utc,
    );
    const clear = await request("/tournaments/" + item.id, "PATCH", {
      startsAt: null,
      expectedVersion: 2,
    });
    assert.equal(clear.json.data.startsAt, null);
  }
});
test("DT2 date version conflict leaves the stored instant intact", async (t) => {
  const { request } = await fixture(t);
  const item = (
    await request("/tournaments", "POST", {
      name: "竞争",
      game: "card",
      startsAt: "2026-10-05T02:30:47.123Z",
    })
  ).json.data;
  await request("/tournaments/" + item.id, "PATCH", {
    name: "先保存",
    expectedVersion: 1,
  });
  const conflict = await request("/tournaments/" + item.id, "PATCH", {
    startsAt: "2026-10-05T03:45:00.000Z",
    expectedVersion: 1,
  });
  assert.equal(conflict.status, 409);
  assert.equal(
    (await request("/tournaments/" + item.id)).json.data.startsAt,
    "2026-10-05T02:30:47.123Z",
  );
});
