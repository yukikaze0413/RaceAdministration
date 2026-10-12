"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture");
const {
  read,
  save,
  writePrepared,
} = require("../../src/platform/operations/state");
test("ER3 prepared input hash is checked again inside transaction even if version counter is unchanged", async (t) => {
  const f = await event(t),
    owner = f.platform.db
      .prepare("SELECT ownerId FROM tournaments WHERE id=?")
      .get(f.tid).ownerId;
  const req = {
    user: { id: owner },
    params: { tid: f.tid },
    path: "/prepared-hash",
    method: "POST",
    body: { expectedVersion: 0 },
    get: () => "hash",
  };
  assert.throws(
    () =>
      writePrepared(f.platform.db, req, "rounds.confirm", (s) => {
        s.rules = { prepared: true };
        const concurrent = read(f.platform.db, f.tid);
        concurrent.rules = { concurrent: true };
        save(f.platform.db, f.tid, concurrent);
      }),
    { code: "INPUT_CHANGED" },
  );
  assert.deepEqual(read(f.platform.db, f.tid).rules, { concurrent: true });
  assert.equal(Object.keys(read(f.platform.db, f.tid).requests).length, 0);
});
test("ER3 preparation cannot apply after current confirmation permission is revoked", async (t) => {
  const f = await event(t);
  const registered = await f.request("/auth/register", "POST", {
    username: "prepared_actor",
    password: "prepared-test-password",
    displayName: "Prepared actor",
  });
  assert.equal(registered.status, 201);
  const login = await f.request("/auth/login", "POST", {
    username: "prepared_actor",
    password: "prepared-test-password",
  });
  const uid = login.data.data.id;
  const current = read(f.platform.db, f.tid);
  current.collaborators[uid] = { permissions: ["rounds.confirm"] };
  save(f.platform.db, f.tid, current);
  const req = {
    user: { id: uid },
    params: { tid: f.tid },
    path: "/prepared-revoke",
    method: "POST",
    body: { expectedVersion: 0 },
    get: () => "revoke",
  };
  assert.throws(
    () =>
      writePrepared(f.platform.db, req, "rounds.confirm", (s) => {
        s.rules = { prepared: true };
        const concurrent = read(f.platform.db, f.tid);
        delete concurrent.collaborators[uid];
        save(f.platform.db, f.tid, concurrent);
      }),
    { code: "FORBIDDEN" },
  );
  assert.deepEqual(read(f.platform.db, f.tid).rules, {});
});
