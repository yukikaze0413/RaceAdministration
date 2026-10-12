"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture");
const { writePrepared, read } = require("../../src/platform/operations/state");
test("ER3 runtime preparation occurs outside SQL transaction, stale input cannot apply, rollback does not reserve key", async (t) => {
  const f = await event(t);
  const uid = f.platform.db
    .prepare("SELECT ownerId FROM tournaments WHERE id=?")
    .get(f.tid).ownerId;
  const req = {
    user: { id: uid },
    params: { tid: f.tid },
    path: "/prepared-test",
    method: "POST",
    body: { expectedVersion: 0 },
    get: () => "prepared",
  };
  const out = writePrepared(f.platform.db, req, "rounds.confirm", (s) => {
    assert.equal(f.platform.db.isTransaction, false);
    s.rules = { test: "prepared" };
  });
  assert.equal(out.version, 1);
  assert.equal(read(f.platform.db, f.tid).rules.test, "prepared");
  assert.deepEqual(
    writePrepared(f.platform.db, req, "rounds.confirm", () => {
      throw Error("cached replay must not solve");
    }),
    out,
  );
  const stale = { ...req, body: { expectedVersion: 0 }, get: () => "stale" };
  assert.throws(
    () =>
      writePrepared(f.platform.db, stale, "rounds.confirm", () => {
        throw Error("stale must not solve");
      }),
    { code: "VERSION_CONFLICT" },
  );
  const retry = { ...req, body: { expectedVersion: 1 }, get: () => "rollback" },
    before = read(f.platform.db, f.tid);
  f.platform.db.exec(
    "CREATE TRIGGER prepared_failure BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  assert.throws(() =>
    writePrepared(f.platform.db, retry, "rounds.confirm", (s) => {
      s.rules = { test: "changed" };
    }),
  );
  assert.deepEqual(read(f.platform.db, f.tid), before);
  f.platform.db.exec("DROP TRIGGER prepared_failure");
  assert.equal(
    writePrepared(f.platform.db, retry, "rounds.confirm", (s) => {
      s.rules = { test: "changed" };
    }).version,
    2,
  );
});
