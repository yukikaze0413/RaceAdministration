"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setup, command } = require("./helpers");
const { input } = require("./compile-fixture");
const {
  createService,
} = require("../../src/tournament-configuration/application/service");
const {
  createMemoryStore,
} = require("../../src/tournament-configuration/adapters/memory-store");
test("CV5 v2 freeze stores complete plan and keeps unsupported runtime distinct", async () => {
  const { service: s, ctx } = setup(),
    c = await s.createDraft(command(ctx, input()));
  const p = {
    trustedContext: ctx,
    tournamentId: "T",
    id: c.id,
    expectedVersion: 1,
    requestKey: "freeze",
  };
  const report = await s.validateConfiguration(p);
  assert.equal(report.plan.version, "compiled-plan-v2");
  const snap = await s.freezeStructure(p);
  assert.equal(snap.plan.units[0].matches.length, 7);
  assert.equal(snap.runtimeReady, true);
  assert.equal(snap.plan.configurationId, c.id);
  assert.equal(snap.planDigest.length, 64);
  assert.deepEqual(await s.freezeStructure(p), snap);
  assert.equal((await s.getConfiguration(p)).state, "structure-frozen");
});
test("CV5 compiled plan snapshot/configuration/request all roll back", async () => {
  for (const phase of ["snapshot", "configuration", "idempotency"]) {
    let armed = false;
    const store = createMemoryStore({
      beforeCommit: (_, step) => {
        if (armed && step === phase) throw Error("injected");
      },
    });
    const s = createService({ store, authorize: () => true }),
      ctx = { actorId: "admin" };
    const c = await s.createDraft(command(ctx, input())),
      before = await store.read("T");
    const p = {
      trustedContext: ctx,
      tournamentId: "T",
      id: c.id,
      expectedVersion: 1,
      requestKey: "freeze",
    };
    armed = true;
    await assert.rejects(s.freezeStructure(p), { code: "STORE_FAILURE" });
    assert.deepEqual(await store.read("T"), before);
    armed = false;
    assert.equal((await s.freezeStructure(p)).plan.units[0].matches.length, 7);
  }
});

const { openDatabase } = require("../../src/platform/storage/database");
const {
  createSqliteStore,
} = require("../../src/tournament-configuration/adapters/sqlite-store");
const { mkdtempSync, rmSync } = require("node:fs"),
  { tmpdir } = require("node:os"),
  { join } = require("node:path");
test("CV5 SQLite freeze fault, concurrent version, restart replay and current permission", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "race-compile-")),
    path = join(dir, "test.sqlite");
  let db = openDatabase(path),
    allowed = true;
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  db.prepare("INSERT INTO users VALUES(?,?,?)").run("admin", "admin", "{}");
  db.prepare("INSERT INTO tournaments VALUES(?,?,?)").run("T", "admin", "{}");
  const service = () =>
    createService({
      store: createSqliteStore(db, () => allowed),
      authorize: () => allowed,
    });
  let s = service();
  const ctx = { actorId: "admin" },
    c = await s.createDraft(command(ctx, input()));
  const p = {
    trustedContext: ctx,
    tournamentId: "T",
    id: c.id,
    expectedVersion: 1,
    requestKey: "freeze",
  };
  db.exec(
    "CREATE TRIGGER fail_compile BEFORE UPDATE ON structure_aggregates BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  await assert.rejects(s.freezeStructure(p), { code: "STORE_FAILURE" });
  assert.equal((await s.getConfiguration(p)).state, "draft");
  db.exec("DROP TRIGGER fail_compile");
  const result = await Promise.allSettled([
    s.freezeStructure(p),
    s.freezeStructure({ ...p, requestKey: "competing" }),
  ]);
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    result.find((x) => x.status === "rejected").reason.code,
    "VERSION_CONFLICT",
  );
  const frozen = result.find((x) => x.status === "fulfilled").value;
  db.close();
  db = openDatabase(path);
  s = service();
  assert.deepEqual(await s.freezeStructure(p), frozen);
  assert.deepEqual((await s.getConfiguration(p)).snapshot.plan, frozen.plan);
  allowed = false;
  await assert.rejects(s.freezeStructure(p), { code: "FORBIDDEN" });
});

test("TS7 six-person v1 frozen payload hash and fields do not acquire v2 plan", async () => {
  const { service: s, ctx } = setup();
  const legacy = {
    entrantKind: "individual",
    structureVersion: "structure-v1",
    routingVersion: "routing-v1",
    stages: [
      {
        id: "s",
        order: 1,
        capacity: 6,
        formatIntent: "single-elimination",
        groups: [],
      },
    ],
    pools: [],
    routes: [],
  };
  const c = await s.createDraft(command(ctx, legacy));
  const snap = await s.freezeStructure({
    trustedContext: ctx,
    tournamentId: "T",
    id: c.id,
    expectedVersion: 1,
    requestKey: "freeze",
  });
  assert.deepEqual(snap.structure, legacy);
  assert.equal(
    snap.digest,
    "457c3a5107afeba01f636941eb20c077395fc61fc4f132b252dd31d64bb33e44",
  );
  assert.equal(Object.hasOwn(snap, "plan"), false);
  assert.equal(Object.hasOwn(snap, "planDigest"), false);
});
