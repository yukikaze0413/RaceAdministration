"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { event } = require("./formats-v2-fixture"),
  { openDatabase } = require("../../src/platform/storage/database");
test("RC3 parent session revoked during preparation is rechecked before child commit", async (t) => {
  const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "race-demo-parent-role-"),
    ),
    root = path.join(directory, ".reference-demos"),
    f = await event(t, { demoRoot: root });
  let childDb;
  t.after(async () => {
    childDb?.close();
    await f.close();
    if (fs.existsSync(root)) {
      for (const name of fs.readdirSync(root))
        fs.unlinkSync(path.join(root, name));
      fs.rmdirSync(root);
    }
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
    "demo",
  );
  assert.equal(created.status, 201);
  const d = created.data.data;
  childDb = openDatabase(path.join(root, d.id + ".sqlite"));
  const uid = childDb
    .prepare("SELECT id FROM users WHERE username='demo_admin'")
    .get().id;
  const parentHash = createHash("sha256")
    .update(f.cookie.slice(f.cookie.indexOf("=") + 1))
    .digest("hex");
  const req = {
    user: { id: uid },
    params: { tid: d.tournamentId },
    body: { expectedVersion: 0 },
    method: "POST",
    path: "/tournaments/" + d.tournamentId + "/prepared",
    get: () => "prepared",
    parentAuthorization: () =>
      !!f.platform.db
        .prepare("SELECT userId FROM sessions WHERE tokenHash=?")
        .get(parentHash),
  };
  const {
      read,
      writePrepared,
    } = require("../../src/platform/operations/state"),
    before = read(childDb, d.tournamentId);
  assert.throws(
    () =>
      writePrepared(childDb, req, "rounds.confirm", (state) => {
        f.platform.db
          .prepare("DELETE FROM sessions WHERE tokenHash=?")
          .run(parentHash);
        state.form.version = 99;
        return {};
      }),
    (error) => error.status === 401,
  );
  assert.deepEqual(read(childDb, d.tournamentId), before);
});
