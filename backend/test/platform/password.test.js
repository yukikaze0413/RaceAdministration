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
  let server;
  // Avoid ephemeral low ports rejected by Fetch on this Windows host.
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
  t.after(async () => {
    await new Promise((r) => server.close(r));
    platform.close();
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api/v1";
  return {
    platform,
    async request(path, body) {
      const response = await fetch(base + path, {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
      const raw = await response.text();
      return {
        status: response.status,
        headers: response.headers,
        raw,
        data: JSON.parse(raw),
      };
    },
  };
}

test("AC1 feedback: one-character password registers and logs in unchanged", async (t) => {
  const { request } = await fixture(t);
  const credentials = { username: "short_password", password: "x" };
  const registration = await request("/auth/register", {
    ...credentials,
    displayName: "short",
  });
  assert.equal(registration.status, 201);
  const login = await request("/auth/login", credentials);
  assert.equal(login.status, 200);
  assert.equal(login.data.data.id, registration.data.data.id);
});
test("AC1 feedback: 1025-character password registers and logs in unchanged", async (t) => {
  const { request } = await fixture(t);
  const credentials = { username: "long_password", password: "p".repeat(1025) };
  const registration = await request("/auth/register", {
    ...credentials,
    displayName: "long",
  });
  assert.equal(registration.status, 201);
  const login = await request("/auth/login", credentials);
  assert.equal(login.status, 200);
  assert.equal(login.data.data.id, registration.data.data.id);
});
for (const [label, password, altered] of [
  ["12 characters", "p".repeat(12), "p".repeat(11)],
  ["129 characters", "p".repeat(129), "p".repeat(128)],
  ["Unicode", "密碼🎮e\u0301", "密碼🎮é"],
  ["surrounding spaces", "  password  ", "password"],
  ["whitespace only", " ", ""],
]) {
  test(
    "AC1 feedback: preserves " + label + " through hashing and login",
    async (t) => {
      const { request, platform } = await fixture(t);
      const credentials = { username: "raw_password", password };
      const registration = await request("/auth/register", {
        ...credentials,
        displayName: "raw",
      });
      assert.equal(registration.status, 201);
      const user = JSON.parse(
        platform.db
          .prepare("SELECT data FROM users WHERE username=?")
          .get(credentials.username).data,
      );
      assert.deepEqual(Object.keys(registration.data.data).sort(), [
        "avatarUrl",
        "displayName",
        "id",
        "username",
      ]);
      const login = await request("/auth/login", credentials);
      assert.equal(login.status, 200);
      assert.deepEqual(Object.keys(login.data.data).sort(), [
        "avatarUrl",
        "displayName",
        "id",
        "username",
      ]);
      assert.equal(registration.raw.includes(user.passwordHash), false);
      assert.equal(login.raw.includes(user.passwordHash), false);
      const wrong = await request("/auth/login", {
        ...credentials,
        password: altered,
      });
      assert.equal(wrong.status, 401);
      assert.equal(wrong.data.error.code, "INVALID_CREDENTIALS");
      assert.equal(wrong.raw.includes(user.passwordHash), false);
    },
  );
}

test("AC1 feedback: empty and non-string passwords never create users or sessions", async (t) => {
  const { request, platform } = await fixture(t);
  for (const password of ["", null, 1, false, [], {}, undefined]) {
    const credentials = { username: "invalid_password", password };
    const registration = await request("/auth/register", {
      ...credentials,
      displayName: "invalid",
    });
    assert.equal(registration.status, 422);
    assert.ok(
      registration.data.error.fieldErrors.some((e) => e.path === "/password"),
    );
    const login = await request("/auth/login", credentials);
    assert.equal(login.status, 401);
    assert.equal(login.data.error.code, "INVALID_CREDENTIALS");
  }
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM users").get().n,
    0,
  );
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM sessions").get().n,
    0,
  );
});

test("AC1 feedback: old persisted scrypt parameters and stable identity survive restart", async (t) => {
  const { mkdtempSync, rmSync } = require("node:fs");
  const { tmpdir } = require("node:os");
  const { join } = require("node:path");
  const { scryptSync } = require("node:crypto");
  const directory = mkdtempSync(join(tmpdir(), "race-password-"));
  const databasePath = join(directory, "old.sqlite");
  const original = await fixture(t, { databasePath });
  const credentials = {
    username: "legacy_user",
    password: "legacy-password-2026",
  };
  const parameters = { N: 4096, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const user = {
    id: "legacy-stable-user-id",
    username: credentials.username,
    displayName: "legacy",
    salt: "legacy-existing-salt",
    passwordParameters: parameters,
    passwordHash: scryptSync(
      credentials.password,
      "legacy-existing-salt",
      64,
      parameters,
    ).toString("hex"),
    createdAt: 1,
  };
  const saved = JSON.stringify(user);
  original.platform.db
    .prepare("INSERT INTO users VALUES(?,?,?)")
    .run(user.id, user.username, saved);
  original.platform.close();
  const restarted = await fixture(t, { databasePath });
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const response = await restarted.request("/auth/login", credentials);
  assert.equal(response.status, 200);
  assert.equal(response.data.data.id, user.id);
  assert.equal(
    restarted.platform.db
      .prepare("SELECT data FROM users WHERE id=?")
      .get(user.id).data,
    saved,
  );
});

test("AC1 feedback: credential request body limit, uniform errors and rate limit remain", async (t) => {
  const { request, platform } = await fixture(t);
  const oversized = await request("/auth/register", {
    username: "oversized",
    displayName: "big",
    password: "sensitive-".repeat(120000),
  });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.data.error.code, "PAYLOAD_TOO_LARGE");
  assert.equal(oversized.raw.includes("sensitive-"), false);
  const loginBig = await request("/auth/login", {
    username: "oversized",
    password: "sensitive-".repeat(120000),
  });
  assert.equal(loginBig.status, 413);
  for (let i = 0; i < 20; i++) {
    const response = await request("/auth/login", {
      username: "missing_user",
      password: "",
    });
    assert.equal(response.status, 401);
    assert.equal(response.data.error.code, "INVALID_CREDENTIALS");
  }
  const limit = await request("/auth/register", {
    username: "rate_limited",
    displayName: "blocked",
    password: "secret-not-in-response",
  });
  assert.equal(limit.status, 429);
  assert.ok(Number(limit.headers.get("retry-after")) > 0);
  assert.equal(limit.raw.includes("secret-not-in-response"), false);
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM users").get().n,
    0,
  );
  assert.equal(
    platform.db.prepare("SELECT count(*) AS n FROM sessions").get().n,
    0,
  );
});

test("AC1 feedback: malformed credential JSON and storage failure logs omit submitted secrets", async (t) => {
  const { request, platform } = await fixture(t);
  const messages = [];
  const original = console.error;
  console.error = (...args) => messages.push(args.join(" "));
  t.after(() => {
    console.error = original;
  });
  const malformed = await request(
    "/auth/register",
    '{"password":"secret-not-in-logs",',
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.raw.includes("secret-not-in-logs"), false);
  platform.close();
  const failure = await request("/auth/login", {
    username: "storage_user",
    password: "secret-not-in-logs",
  });
  assert.equal(failure.status, 503);
  assert.equal(failure.raw.includes("secret-not-in-logs"), false);
  assert.equal(messages.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(messages[0])).sort(), [
    "code",
    "requestId",
    "status",
  ]);
});
