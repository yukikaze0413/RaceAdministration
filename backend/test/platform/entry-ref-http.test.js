"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture");
const { input } = require("../tournament-configuration/compile-fixture");
test("PR5 approval binds exact entryRef and duplicate seat rejects without partial approval", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid;
  assert.equal(
    (
      await f.request(
        base,
        "PATCH",
        { expectedVersion: 1, visibility: "public" },
        f.cookie,
        "public",
      )
    ).status,
    200,
  );
  const created = await f.request(
    base + "/configurations",
    "POST",
    { payload: input("single-cut-v2", 4, 1) },
    f.cookie,
    "create",
  );
  assert.equal(created.status, 201);
  const cid = created.data.data.id;
  assert.equal(
    (
      await f.request(
        base + "/configurations/" + cid + "/freeze",
        "POST",
        { expectedVersion: 1 },
        f.cookie,
        "freeze",
      )
    ).status,
    200,
  );
  await f.request(
    base + "/registration-form/publish",
    "POST",
    { expectedVersion: 0 },
    f.cookie,
    "publish",
  );
  async function entrant(name) {
    await f.request("/auth/register", "POST", {
      username: name,
      displayName: name,
      password: "entry-test-password",
    });
    const login = await f.request("/auth/login", "POST", {
        username: name,
        password: "entry-test-password",
      }),
      cookie = login.headers.get("set-cookie").split(";")[0];
    const r = await f.request(
      base + "/registrations",
      "POST",
      { schemaVersion: 1, answers: {} },
      cookie,
      "register-" + name,
    );
    assert.equal(r.status, 201);
    return r.data.data.id;
  }
  const a = await entrant("entry_a"),
    ref = {
      configurationId: cid,
      stageId: "s",
      groupId: "g",
      port: "seed",
      position: 1,
    };
  const first = await f.request(
    base + "/registrations/" + a + "/approve",
    "POST",
    { expectedVersion: 2, approved: true, seed: 1, entryRef: ref },
    f.cookie,
    "approve-a",
  );
  assert.equal(first.status, 200);
  const b = await entrant("entry_b"),
    bad = await f.request(
      base + "/registrations/" + b + "/approve",
      "POST",
      { expectedVersion: 4, approved: true, seed: 2, entryRef: ref },
      f.cookie,
      "approve-bad",
    );
  assert.equal(bad.status, 422);
  assert.equal(bad.data.error.code, "ENTRY_POSITION_CONFLICT");
  const list = await f.request(
    base + "/registrations",
    "GET",
    undefined,
    f.cookie,
  );
  assert.equal(list.data.data.version, 4);
  assert.equal(
    list.data.data.items.find((r) => r.id === b).status,
    "submitted",
  );
  assert.deepEqual(list.data.data.items.find((r) => r.id === a).entryRef, {
    ...ref,
    positionKind: "seed",
  });
  const path = base + "/registrations/" + b + "/approve",
    body = {
      expectedVersion: 4,
      approved: true,
      seed: 2,
      entryRef: { ...ref, position: 2 },
    };
  f.platform.db.exec(
    "CREATE TRIGGER fail_entry BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  assert.equal(
    (await f.request(path, "POST", body, f.cookie, "approve-retry")).status,
    503,
  );
  assert.equal(
    (await f.request(base + "/registrations", "GET", undefined, f.cookie)).data
      .data.version,
    4,
  );
  f.platform.db.exec("DROP TRIGGER fail_entry");
  const good = await f.request(path, "POST", body, f.cookie, "approve-retry");
  assert.equal(good.status, 200);
  assert.deepEqual(
    (await f.request(path, "POST", body, f.cookie, "approve-retry")).data.data,
    good.data.data,
  );
  const incomplete = await f.request(
    base + "/roster/lock",
    "POST",
    { expectedVersion: 5, configurationId: cid },
    f.cookie,
    "lock-incomplete",
  );
  assert.equal(incomplete.status, 422);
  assert.equal(incomplete.data.error.code, "ROSTER_INVALID");
  assert.equal(
    (await f.request(base + "/registrations", "GET", undefined, f.cookie)).data
      .data.locked,
    false,
  );
});
