"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { listenTestServer } = require("../helpers/http-listener");
async function fixture(t) {
  const p = createApp({ origins: ["http://localhost:5173"] }),
    s = await listenTestServer(p.app);
  t.after(
    () =>
      new Promise((r) => {
        s.close(() => {
          p.close();
          r();
        });
        s.closeAllConnections();
      }),
  );
  return {
    p,
    async req(
      path,
      body,
      cookie,
      method = "POST",
      origin = "http://localhost:5173",
    ) {
      const r = await fetch(
        "http://127.0.0.1:" + s.address().port + "/api/v1" + path,
        {
          method,
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
            "Idempotency-Key": "owned",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return {
        status: r.status,
        body: await r.json(),
        cookie: r.headers.get("set-cookie")?.split(";")[0],
      };
    },
  };
}
test("account password change preserves identity and owned event, revokes every session and accepts raw new password", async (t) => {
  const { p, req } = await fixture(t);
  const cred = { username: "password_edit", password: "x" };
  const u = await req("/auth/register", { ...cred, displayName: "owner" });
  const a = await req("/auth/login", cred),
    b = await req("/auth/login", cred);
  const event = await req(
    "/tournaments",
    { name: "owned", game: "card" },
    a.cookie,
  );
  const changed = await req(
    "/me/password",
    { currentPassword: "x", newPassword: " 新密码 " },
    a.cookie,
  );
  assert.equal(changed.status, 200);
  assert.equal(changed.body.data.requiresLogin, true);
  assert.equal(p.db.prepare("SELECT count(*) n FROM sessions").get().n, 0);
  assert.equal((await req("/auth/login", cred)).status, 401);
  const fresh = await req("/auth/login", { ...cred, password: " 新密码 " });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.body.data.id, u.body.data.id);
  assert.equal(
    (await req("/tournaments/" + event.body.data.id, null, fresh.cookie, "GET"))
      .status,
    200,
  );
  assert.equal(
    (await req("/me", { displayName: "other" }, b.cookie, "PATCH")).status,
    401,
  );
  assert.ok(!JSON.stringify(changed.body).includes("passwordHash"));
});
test("password update rejects anonymous, wrong current password, empty new password and foreign Origin without writes", async (t) => {
  const { p, req } = await fixture(t),
    cred = { username: "password_errors", password: "x" };
  await req("/auth/register", { ...cred, displayName: "owner" });
  const a = await req("/auth/login", cred);
  const before = p.db.prepare("SELECT data FROM users").get().data;
  assert.equal(
    (await req("/me/password", { currentPassword: "x", newPassword: "y" }))
      .status,
    401,
  );
  assert.equal(
    (
      await req(
        "/me/password",
        { currentPassword: "wrong", newPassword: "y" },
        a.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        "/me/password",
        { currentPassword: "x", newPassword: "" },
        a.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        "/me/password",
        { currentPassword: "x", newPassword: "y" },
        a.cookie,
        "POST",
        "http://foreign.example",
      )
    ).status,
    403,
  );
  assert.equal(p.db.prepare("SELECT data FROM users").get().data, before);
  assert.equal(p.db.prepare("SELECT count(*) n FROM sessions").get().n, 1);
});
test("concurrent password changes apply once, without a stale credential overwrite", async (t) => {
  const { req } = await fixture(t),
    cred = { username: "password_race", password: "x" };
  await req("/auth/register", { ...cred, displayName: "owner" });
  const a = await req("/auth/login", cred);
  const r = await Promise.all(
    ["a", "b"].map((newPassword) =>
      req("/me/password", { currentPassword: "x", newPassword }, a.cookie),
    ),
  );
  assert.deepEqual(r.map((x) => x.status).sort(), [200, 409]);
  assert.equal(
    (
      await req("/auth/login", {
        ...cred,
        password: r[0].status === 200 ? "a" : "b",
      })
    ).status,
    200,
  );
});

test("login already in flight cannot create a session from a password replaced during hashing", async (t) => {
  const { p, req } = await fixture(t),
    cred = { username: "inflight_password", password: "x" };
  await req("/auth/register", { ...cred, displayName: "owner" });
  const { hash } = require("../../src/platform/auth/accounts");
  const before = JSON.parse(p.db.prepare("SELECT data FROM users").get().data);
  const nextHash = await hash("new", before.salt, before.passwordParameters);
  const prepare = p.db.prepare.bind(p.db);
  let changed = false;
  p.db.prepare = (sql) => {
    const stmt = prepare(sql);
    if (sql === "SELECT data FROM users WHERE username=?")
      return {
        get: (username) => {
          const row = stmt.get(username);
          if (!changed) {
            changed = true;
            prepare("UPDATE users SET data=? WHERE id=?").run(
              JSON.stringify({ ...before, passwordHash: nextHash }),
              before.id,
            );
          }
          return row;
        },
      };
    return stmt;
  };
  assert.equal((await req("/auth/login", cred)).status, 401);
  assert.equal(prepare("SELECT count(*) n FROM sessions").get().n, 0);
  assert.equal(
    (await req("/auth/login", { ...cred, password: "new" })).status,
    200,
  );
});
