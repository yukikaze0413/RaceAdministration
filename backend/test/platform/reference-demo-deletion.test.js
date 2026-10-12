"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { event } = require("./formats-v2-fixture");
test("RC3 interrupted deletion intent write cannot publish a malformed journal", async (t) => {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "race-demo-journal-"),
    ),
    root = path.join(directory, ".reference-demos"),
    f = await event(t, { demoRoot: root });
  t.after(async () => {
    t.mock.restoreAll();
    await f.close();
    for (const name of fs.readdirSync(root))
      fs.unlinkSync(path.join(root, name));
    fs.rmdirSync(root);
    fs.rmdirSync(directory);
  });
  const created = await f.request(
    "/reference-demos",
    "POST",
    {
      caseId: "gsl-reset-v1",
      caseVersion: 1,
      expectedVersion: 0,
      confirmed: true,
    },
    f.cookie,
    "journal",
  );
  assert.equal(created.status, 201);
  const demo = created.data.data,
    preview = (
      await f.request("/me/deletion-preview", "GET", undefined, f.cookie)
    ).data.data,
    original = fs.writeFileSync;
  t.mock.method(fs, "writeFileSync", (file, data, ...options) => {
    if (/\.delete\.(json|tmp)$/.test(String(file))) {
      original(file, '{"id":', ...options);
      throw Object.assign(new Error("interrupted journal write"), {
        code: "ENOSPC",
      });
    }
    return original(file, data, ...options);
  });
  assert.equal(
    (
      await f.request(
        "/me",
        "DELETE",
        {
          currentPassword: "v2-test-password",
          confirmation: "v2_owner",
          expectedToken: preview.token,
        },
        f.cookie,
      )
    ).status,
    503,
  );
  t.mock.restoreAll();
  assert.ok(fs.existsSync(path.join(root, demo.id + ".sqlite")));
  assert.ok(
    !fs.existsSync(path.join(root, demo.id + ".delete.json")),
    "only a complete intent may be published",
  );
  assert.equal(
    (await f.request("/reference-demos", "GET", undefined, f.cookie)).status,
    200,
  );
});
test("RC3 last instance close completes deletion after another instance released its retry", async (t) => {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "race-demo-two-apps-"),
    ),
    root = path.join(directory, ".reference-demos"),
    database = path.join(directory, "parent.sqlite"),
    a = await event(t, { demoRoot: root, databasePath: database }),
    b = await event(t, { demoRoot: root, databasePath: database });
  t.after(async () => {
    t.mock.restoreAll();
    await a.close();
    await b.close();
    for (const name of fs.readdirSync(root))
      fs.unlinkSync(path.join(root, name));
    fs.rmdirSync(root);
    for (const file of [database, database + "-wal", database + "-shm"])
      if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  });
  const created = await a.request(
    "/reference-demos",
    "POST",
    {
      caseId: "gsl-reset-v1",
      caseVersion: 1,
      expectedVersion: 0,
      confirmed: true,
    },
    a.cookie,
    "two-apps",
  );
  assert.equal(created.status, 201);
  const demo = created.data.data,
    target = path.join(root, demo.id + ".sqlite"),
    journal = path.join(root, demo.id + ".delete.json");
  assert.equal(
    (await fetch(b.origin + demo.prefix + "/api/v1/reference-cases")).status,
    200,
  );
  // Deterministically reproduce Windows' busy-file behavior while B retains its handle.
  let bRetainsHandle = true;
  const original = fs.unlinkSync;
  t.mock.method(fs, "unlinkSync", (file) => {
    if (path.resolve(file) === path.resolve(target) && bRetainsHandle)
      throw Object.assign(new Error("second instance holds demo"), {
        code: "EBUSY",
      });
    return original(file);
  });
  const preview = (
    await a.request("/me/deletion-preview", "GET", undefined, a.cookie)
  ).data.data;
  const deleted = await a.request(
    "/me",
    "DELETE",
    {
      currentPassword: "v2-test-password",
      confirmation: "v2_owner",
      expectedToken: preview.token,
    },
    a.cookie,
  );
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.data.demoCleanupPending, 1);
  await a.close();
  assert.ok(fs.existsSync(target));
  assert.ok(fs.existsSync(journal));
  bRetainsHandle = false;
  await b.close();
  assert.ok(
    !fs.existsSync(target),
    "last instance must sweep after closing its child handle",
  );
  assert.ok(!fs.existsSync(journal));
});
test("RC3 busy demo file keeps a durable deletion journal and resumes cleanup after restart", async (t) => {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "race-demo-delete-retry-"),
    ),
    root = path.join(directory, ".reference-demos"),
    database = path.join(directory, "parent.sqlite"),
    f = await event(t, { demoRoot: root, databasePath: database });
  let reopened;
  t.after(async () => {
    t.mock.restoreAll();
    reopened?.close();
    await f.close();
    if (fs.existsSync(root)) {
      for (const name of fs.readdirSync(root))
        fs.unlinkSync(path.join(root, name));
      fs.rmdirSync(root);
    }
    for (const file of [database, database + "-wal", database + "-shm"])
      if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  });
  const r = await f.request(
    "/reference-demos",
    "POST",
    {
      caseId: "gsl-reset-v1",
      caseVersion: 1,
      expectedVersion: 0,
      confirmed: true,
    },
    f.cookie,
    "demo",
  );
  assert.equal(r.status, 201);
  const id = r.data.data.id,
    target = path.join(root, id + ".sqlite");
  const preview = (
    await f.request("/me/deletion-preview", "GET", undefined, f.cookie)
  ).data.data;
  const original = fs.unlinkSync;
  t.mock.method(fs, "unlinkSync", (file) => {
    if (path.resolve(file) === path.resolve(target))
      throw Object.assign(new Error("busy demo file"), { code: "EBUSY" });
    return original(file);
  });
  const deleted = await f.request(
    "/me",
    "DELETE",
    {
      currentPassword: "v2-test-password",
      confirmation: "v2_owner",
      expectedToken: preview.token,
    },
    f.cookie,
  );
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.data.demoCleanupPending, 1);
  assert.ok(fs.existsSync(path.join(root, id + ".delete.json")));
  assert.ok(fs.existsSync(target));
  await f.close();
  t.mock.restoreAll();
  reopened = require("../../src/app").createApp({
    databasePath: database,
    demoRoot: root,
  });
  assert.ok(!fs.existsSync(target));
  assert.ok(!fs.existsSync(path.join(root, id + ".delete.json")));
});
test("RC3 account deletion previews isolated demos and cannot remove files before parent SQL commit", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "race-demo-delete-")),
    root = path.join(directory, ".reference-demos"),
    f = await event(t, { demoRoot: root });
  t.after(async () => {
    await f.close();
    if (fs.existsSync(root)) {
      for (const name of fs.readdirSync(root)) {
        const file = path.resolve(root, name);
        assert.equal(path.dirname(file), path.resolve(root));
        fs.unlinkSync(file);
      }
      fs.rmdirSync(root);
    }
    fs.rmdirSync(directory);
  });
  const before = (
    await f.request("/me/deletion-preview", "GET", undefined, f.cookie)
  ).data.data;
  const create = await f.request(
    "/reference-demos",
    "POST",
    {
      caseId: "gsl-no-reset-v1",
      caseVersion: 1,
      expectedVersion: 0,
      confirmed: true,
    },
    f.cookie,
    "demo",
  );
  assert.equal(create.status, 201);
  const d = create.data.data;
  const preview = (
    await f.request("/me/deletion-preview", "GET", undefined, f.cookie)
  ).data.data;
  assert.equal(preview.counts.referenceDemos, 1);
  assert.notEqual(preview.token, before.token);
  const list = await f.request("/reference-demos", "GET", undefined, f.cookie);
  assert.equal(list.status, 200);
  assert.equal(list.data.data.items[0].id, d.id);
  const body = {
    currentPassword: "v2-test-password",
    confirmation: "v2_owner",
    expectedToken: preview.token,
  };
  f.platform.db.exec(
    "CREATE TRIGGER fail_demo_parent BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT,'parent failure'); END;",
  );
  assert.equal((await f.request("/me", "DELETE", body, f.cookie)).status, 503);
  assert.ok(
    fs.existsSync(path.join(root, d.id + ".sqlite")),
    "父SQL回滚之前演示文件不可删除",
  );
  assert.equal(
    (await f.request("/reference-demos", "GET", undefined, f.cookie)).data.data
      .items.length,
    1,
  );
  f.platform.db.exec("DROP TRIGGER fail_demo_parent");
  assert.equal((await f.request("/me", "DELETE", body, f.cookie)).status, 200);
  assert.ok(!fs.existsSync(path.join(root, d.id + ".sqlite")));
  assert.ok(!fs.existsSync(path.join(root, d.id + ".sqlite-wal")));
  assert.ok(!fs.existsSync(path.join(root, d.id + ".sqlite-shm")));
  const response = await fetch(f.origin + d.prefix + "/api/v1/auth/session");
  assert.equal(response.status, 404);
});
