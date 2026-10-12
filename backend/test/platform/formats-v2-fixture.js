"use strict";
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
async function event(t, options = {}) {
  const platform = createApp({
    databasePath: ":memory:",
    ...options,
    origins: ["http://localhost:5173"],
  });
  let server;
  for (let attempt = 0; attempt < 30; attempt++) {
    server = platform.app.listen(
      25000 + Math.floor(Math.random() * 30000),
      "127.0.0.1",
    );
    const ready = await new Promise((resolve, reject) => {
      server.once("listening", () => resolve(true));
      server.once("error", (error) =>
        ["EADDRINUSE", "EACCES"].includes(error.code)
          ? resolve(false)
          : reject(error),
      );
    });
    if (ready) break;
    if (attempt === 29) {
      platform.close();
      throw new Error("No available high test port");
    }
  }
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise((r) => server.close(r));
    platform.close();
  }
  t.after(close);
  const url = "http://127.0.0.1:" + server.address().port + "/api/v1";
  async function request(path, method = "GET", body, cookie, key) {
    const r = await fetch(url + path, {
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
    username: "v2_owner",
    displayName: "V2 owner",
    password: "v2-test-password",
  });
  const login = await request("/auth/login", "POST", {
    username: "v2_owner",
    password: "v2-test-password",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const created = await request(
    "/tournaments",
    "POST",
    { name: "V2 isolation", game: "card", visibility: "private" },
    cookie,
    "event",
  );
  assert.equal(created.status, 201);
  return {
    request,
    cookie,
    tid: created.data.data.id,
    platform,
    close,
    origin: new URL(url).origin,
  };
}
function payload() {
  return {
    entrantKind: "individual",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [
      {
        id: "s1",
        name: "阶段一",
        order: 1,
        format: "single-elimination",
        ruleVersion: "single-cut-v2",
        groups: [{ id: "g1", stageId: "s1" }],
      },
    ],
    pools: [],
    routes: [],
  };
}
module.exports = { event, payload };
