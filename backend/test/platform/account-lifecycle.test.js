"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
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
  let sequence = 0;
  async function req(path, body, cookie, method = "POST") {
    const r = await fetch(
      "http://127.0.0.1:" + s.address().port + "/api/v1" + path,
      {
        method,
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
          "Idempotency-Key": "life-" + ++sequence,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  async function account(username) {
    const u = await req("/auth/register", {
      username,
      password: "x",
      displayName: username,
    });
    const a = await req("/auth/login", { username, password: "x" });
    return { id: u.body.data.id, cookie: a.cookie, username };
  }
  return { p, req, account };
}
test("rename preserves stable identity and ownership, requires password and unique username", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("owner_one");
  await account("owner_two");
  await req("/tournaments", { name: "owned", game: "card" }, a.cookie);
  assert.equal(
    (
      await req(
        "/me",
        { username: "renamed", currentPassword: "bad" },
        a.cookie,
        "PATCH",
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        "/me",
        { username: "owner_two", currentPassword: "x" },
        a.cookie,
        "PATCH",
      )
    ).status,
    409,
  );
  const r = await req(
    "/me",
    { username: "Renamed", displayName: "新显示名", currentPassword: "x" },
    a.cookie,
    "PATCH",
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.data.id, a.id);
  assert.equal(r.body.data.username, "renamed");
  assert.equal(
    p.db.prepare("SELECT ownerId FROM tournaments").get().ownerId,
    a.id,
  );
  assert.equal(
    (await req("/auth/login", { username: "owner_one", password: "x" })).status,
    401,
  );
  assert.equal(
    (await req("/auth/login", { username: "renamed", password: "x" })).status,
    200,
  );
  assert.equal(
    (await req("/me", { id: "forged" }, a.cookie, "PATCH")).status,
    422,
  );
});
test("avatar normalizes raster to bounded WebP and rejects SVG/corruption without writes", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("avatar_owner");
  const png = await sharp({
    create: { width: 500, height: 300, channels: 3, background: "#ff8800" },
  })
    .png()
    .toBuffer();
  const r = await req(
    "/me",
    { avatar: "data:image/png;base64," + png.toString("base64") },
    a.cookie,
    "PATCH",
  );
  assert.equal(r.status, 200);
  assert.match(r.body.data.avatarUrl, /^data:image\/webp;base64,/);
  const meta = await sharp(
    Buffer.from(r.body.data.avatarUrl.split(",")[1], "base64"),
  ).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.height, 256);
  assert.equal(meta.exif, undefined);
  const before = p.db.prepare("SELECT data FROM users").get().data;
  for (const avatar of [
    "data:image/svg+xml;base64,PHN2Zy8+",
    "data:image/png;base64,AAAA",
  ])
    assert.equal((await req("/me", { avatar }, a.cookie, "PATCH")).status, 422);
  assert.equal(p.db.prepare("SELECT data FROM users").get().data, before);
  assert.equal(
    (await req("/me", { avatar: null }, a.cookie, "PATCH")).body.data.avatarUrl,
    null,
  );
});
test("permanent deletion removes all owned rows and snapshots, preserves other account, releases username", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("delete_owner"),
    b = await account("keep_owner");
  await req("/auth/login", { username: a.username, password: "x" });
  const e = await req(
    "/tournaments",
    { name: "owned", game: "card" },
    a.cookie,
  );
  await req("/tournaments", { name: "other", game: "card" }, b.cookie);
  p.db.prepare("INSERT INTO structure_aggregates VALUES(?,?)").run(
    e.body.data.id,
    JSON.stringify({
      configurations: [["c", {}]],
      snapshots: [["s", {}]],
      requests: [],
    }),
  );
  const before = p.db
    .prepare("SELECT data FROM users WHERE id=?")
    .get(b.id).data;
  const preview = await req("/me/deletion-preview", null, a.cookie, "GET");
  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.counts.tournaments, 1);
  assert.equal(preview.body.data.counts.snapshots, 1);
  const body = {
    currentPassword: "x",
    confirmation: a.username,
    expectedToken: preview.body.data.token,
  };
  assert.equal(
    (await req("/me", { ...body, currentPassword: "bad" }, a.cookie, "DELETE"))
      .status,
    422,
  );
  assert.equal(
    (await req("/me", { ...body, confirmation: "wrong" }, a.cookie, "DELETE"))
      .status,
    422,
  );
  assert.equal((await req("/me", body, a.cookie, "DELETE")).status, 200);
  for (const [table, column] of [
    ["users", "id"],
    ["sessions", "userId"],
    ["series", "ownerId"],
    ["tournaments", "ownerId"],
    ["catalog_requests", "actorId"],
  ])
    assert.equal(
      p.db
        .prepare("SELECT count(*) n FROM " + table + " WHERE " + column + "=?")
        .get(a.id).n,
      0,
    );
  assert.equal(
    p.db.prepare("SELECT count(*) n FROM structure_aggregates").get().n,
    0,
  );
  assert.equal(
    p.db.prepare("SELECT data FROM users WHERE id=?").get(b.id).data,
    before,
  );
  assert.equal(
    (await req("/auth/session", null, a.cookie, "GET")).body.data.user,
    null,
  );
  assert.equal(
    (
      await req("/auth/register", {
        username: a.username,
        password: "x",
        displayName: "new",
      })
    ).status,
    201,
  );
});
test("changed preview and storage fault never partially delete account", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("delete_atomic");
  const preview = await req("/me/deletion-preview", null, a.cookie, "GET");
  await req("/tournaments", { name: "new event", game: "card" }, a.cookie);
  const body = {
    currentPassword: "x",
    confirmation: a.username,
    expectedToken: preview.body.data.token,
  };
  assert.equal((await req("/me", body, a.cookie, "DELETE")).status, 409);
  body.expectedToken = (
    await req("/me/deletion-preview", null, a.cookie, "GET")
  ).body.data.token;
  p.db.exec(
    "CREATE TRIGGER fail_delete BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT,'test failure'); END;",
  );
  assert.equal((await req("/me", body, a.cookie, "DELETE")).status, 503);
  assert.equal(p.db.prepare("SELECT count(*) n FROM users").get().n, 1);
  assert.equal(p.db.prepare("SELECT count(*) n FROM sessions").get().n, 1);
  assert.equal(p.db.prepare("SELECT count(*) n FROM tournaments").get().n, 1);
  assert.equal(
    p.db.prepare("SELECT count(*) n FROM catalog_requests").get().n,
    1,
  );
});

test("cross-account historical references block deletion without changing either owner", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("reference_owner"),
    b = await account("reference_other");
  p.db
    .prepare("INSERT INTO series VALUES(?,?,?)")
    .run("series-a", a.id, JSON.stringify({ id: "series-a", ownerId: a.id }));
  p.db.prepare("INSERT INTO tournaments VALUES(?,?,?)").run(
    "foreign-event",
    b.id,
    JSON.stringify({
      id: "foreign-event",
      ownerId: b.id,
      seriesId: "series-a",
    }),
  );
  assert.equal(
    (await req("/me/deletion-preview", null, a.cookie, "GET")).status,
    409,
  );
  assert.equal(p.db.prepare("SELECT count(*) n FROM users").get().n, 2);
  p.db.prepare("DELETE FROM tournaments WHERE id=?").run("foreign-event");
  const preview = await req("/me/deletion-preview", null, a.cookie, "GET");
  assert.equal(preview.body.data.counts.series, 1);
  assert.equal(
    (
      await req(
        "/me",
        {
          currentPassword: "x",
          confirmation: a.username,
          expectedToken: preview.body.data.token,
        },
        a.cookie,
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal(p.db.prepare("SELECT count(*) n FROM series").get().n, 0);
  assert.equal(
    p.db.prepare("SELECT count(*) n FROM users WHERE id=?").get(b.id).n,
    1,
  );
});
test("deleted account cannot be resurrected by a password change already in flight", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("delete_inflight");
  const prepare = p.db.prepare.bind(p.db);
  let intercepted = false;
  p.db.prepare = (sql) => {
    const statement = prepare(sql);
    if (sql === "SELECT data FROM users WHERE id=?")
      return {
        get: (id) => {
          const row = statement.get(id);
          if (!intercepted && id === a.id) {
            intercepted = true;
            prepare("DELETE FROM sessions WHERE userId=?").run(id);
            prepare("DELETE FROM users WHERE id=?").run(id);
          }
          return row;
        },
      };
    return statement;
  };
  const response = await req(
    "/me/password",
    { currentPassword: "x", newPassword: "new" },
    a.cookie,
  );
  assert.equal(response.status, 409);
  assert.equal(prepare("SELECT count(*) n FROM users").get().n, 0);
});

test("profile and deletion require session and trusted Origin, and share the credential rate limit", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("protected_delete");
  assert.equal(
    (await req("/me/deletion-preview", null, null, "GET")).status,
    401,
  );
  assert.equal(
    (
      await req(
        "/me",
        {
          currentPassword: "x",
          confirmation: a.username,
          expectedToken: "bad",
        },
        null,
        "DELETE",
      )
    ).status,
    401,
  );
  const preview = await req("/me/deletion-preview", null, a.cookie, "GET");
  // Exercise the existing fixture's real HTTP Origin path directly through a fresh local listener.
  const extra = await listenTestServer(p.app);
  const foreign = await fetch(
    "http://127.0.0.1:" + extra.address().port + "/api/v1/me",
    {
      method: "DELETE",
      headers: {
        Origin: "http://foreign.example",
        "Content-Type": "application/json",
        Cookie: a.cookie,
      },
      body: JSON.stringify({
        currentPassword: "x",
        confirmation: a.username,
        expectedToken: preview.body.data.token,
      }),
    },
  );
  assert.equal(foreign.status, 403);
  await new Promise((resolve) => {
    extra.close(resolve);
    extra.closeAllConnections();
  });
  for (let i = 0; i < 17; i++)
    assert.equal(
      (await req("/me", { displayName: "safe" }, a.cookie, "PATCH")).status,
      200,
    );
  assert.equal(
    (
      await req(
        "/me",
        {
          currentPassword: "x",
          confirmation: a.username,
          expectedToken: preview.body.data.token,
        },
        a.cookie,
        "DELETE",
      )
    ).status,
    429,
  );
  assert.equal(p.db.prepare("SELECT count(*) n FROM users").get().n, 1);
});

test("account deletion uses current ownership, preserving an event given away and deleting an event now received", async (t) => {
  const { p, req, account } = await fixture(t),
    a = await account("ownership_a"),
    b = await account("ownership_b");
  const sent = (
    await req("/tournaments", { name: "given away", game: "card" }, a.cookie)
  ).body.data;
  const kept = (
    await req("/tournaments", { name: "still owned", game: "card" }, a.cookie)
  ).body.data;
  const received = (
    await req("/tournaments", { name: "received", game: "card" }, b.cookie)
  ).body.data;
  assert.equal(
    p.db.prepare("SELECT ownerId FROM tournaments WHERE id=?").get(sent.id)
      .ownerId,
    a.id,
  );
  function setOwner(id, ownerId, createdBy) {
    const data = JSON.parse(
      p.db.prepare("SELECT data FROM tournaments WHERE id=?").get(id).data,
    );
    p.db
      .prepare("UPDATE tournaments SET ownerId=?,data=? WHERE id=?")
      .run(ownerId, JSON.stringify({ ...data, ownerId, createdBy }), id);
  }
  // Simulate stored ownership change; no transfer API is added by this account-page change.
  setOwner(sent.id, b.id, a.id);
  setOwner(received.id, a.id, b.id);
  for (const [id, owner] of [
    [sent.id, b.id],
    [received.id, a.id],
  ])
    p.db.prepare("INSERT INTO structure_aggregates VALUES(?,?)").run(
      id,
      JSON.stringify({
        configurations: [["c", {}]],
        snapshots: [["s", { frozenBy: owner }]],
        requests: [],
      }),
    );
  const sentBefore = p.db
    .prepare("SELECT data FROM tournaments WHERE id=?")
    .get(sent.id).data;
  const snapshotBefore = p.db
    .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
    .get(sent.id).data;
  const preview = await req("/me/deletion-preview", null, a.cookie, "GET");
  assert.equal(preview.status, 200);
  assert.equal(preview.body.data.counts.tournaments, 2);
  const result = await req(
    "/me",
    {
      currentPassword: "x",
      confirmation: a.username,
      expectedToken: preview.body.data.token,
    },
    a.cookie,
    "DELETE",
  );
  assert.equal(result.status, 200);
  for (const id of [kept.id, received.id])
    assert.equal(
      p.db.prepare("SELECT count(*) n FROM tournaments WHERE id=?").get(id).n,
      0,
    );
  assert.equal(
    p.db.prepare("SELECT data FROM tournaments WHERE id=?").get(sent.id).data,
    sentBefore,
  );
  assert.equal(
    p.db
      .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
      .get(sent.id).data,
    snapshotBefore,
  );
  assert.equal(
    p.db.prepare("SELECT count(*) n FROM users WHERE id=?").get(b.id).n,
    1,
  );
});
