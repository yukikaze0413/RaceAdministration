"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const { input } = require("../tournament-configuration/compile-fixture");
test("ER3 manual Swiss pairing HTTP old input/hard constraints/rollback/current revoked authorization", async (t) => {
  const { read, save } = require("../../src/platform/operations/state");
  const f = await setupV2(
    t,
    input("swiss-fixed-v1", 8, 4, { roundCount: 3 }),
    Array.from({ length: 8 }, () => null),
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
  const actor = f.entrants[0];
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: ["rounds.confirm"] },
    "grant-manual",
  );
  const state = read(f.platform.db, f.tid),
    u = state.runtime.units[0];
  // Isolated fixture represents a solver-budget blocked window. It does not
  // claim the trivial eight-player input would naturally exhaust the solver.
  u.rounds = [];
  u.status = "pairing-blocked";
  u.pairingBlock = { code: "PAIRING_SOLVER_LIMIT", round: 1, nodes: 250001 };
  save(f.platform.db, f.tid, state);
  const path = f.base + "/units/" + u.id + "/pairing",
    body = {
      expectedVersion: f.getVersion(),
      inputVersion: u.pairingInputVersion,
      inputHash: u.pairingInputHash,
      pairs: [
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ].map((p) => p.map((i) => f.entrants[i].entrantId)),
      bye: null,
      reason: "人工完整配对",
    };
  assert.equal(
    (
      await f.request(
        path,
        "POST",
        { ...body, inputHash: "old" },
        f.cookie,
        "old",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        path,
        "POST",
        {
          ...body,
          pairs: [body.pairs[0], body.pairs[0], body.pairs[2], body.pairs[3]],
        },
        f.cookie,
        "duplicate",
      )
    ).status,
    422,
  );
  f.platform.db.exec(
    "CREATE TRIGGER fail_pairing BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  assert.equal(
    (await f.request(path, "POST", body, actor.cookie, "manual")).status,
    503,
  );
  assert.deepEqual(read(f.platform.db, f.tid), state);
  f.platform.db.exec("DROP TRIGGER fail_pairing");
  const success = await f.request(path, "POST", body, actor.cookie, "manual");
  assert.equal(success.status, 200, JSON.stringify(success.data));
  f.setVersion(success.data.data.version);
  assert.deepEqual(
    (await f.request(path, "POST", body, actor.cookie, "manual")).data.data,
    success.data.data,
  );
  const current = read(f.platform.db, f.tid);
  assert.equal(
    current.runtime.units[0].rounds[0].pairing.decision.reason,
    body.reason,
  );
  const publicView = (await f.request(f.base + "/runtime")).data.data.runtime;
  assert.ok(!JSON.stringify(publicView).includes('"actorId"'));
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: [] },
    "revoke-manual",
  );
  assert.equal(
    (await f.request(path, "POST", body, actor.cookie, "manual")).status,
    403,
  );
});
test("ER3 Swiss actual HTTP fixed 8/3 twelve games and threshold16/3/3 thirty-three, incomplete/locked/idem", async (t) => {
  for (const [rule, n, q, p, count] of [
    ["swiss-fixed-v1", 8, 4, { roundCount: 3 }, 12],
    ["swiss-threshold-v1", 16, 8, {}, 33],
  ]) {
    const f = await setupV2(
      t,
      input(rule, n, q, p),
      Array.from({ length: n }, () => null),
    );
    await f.mutate("/start", { configurationId: f.cid }, "start");
    const view = async () =>
      (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data
        .data.runtime;
    while ((await view()).status !== "completed") {
      const u = (await view()).units[0],
        r = u.rounds.find((r) => !r.confirmed);
      assert.ok(
        r,
        "unexpected pairing/ranking blockage " + JSON.stringify(u.pairingBlock),
      );
      const missing = await f.request(
        f.base + "/rounds/" + r.id + "/confirm",
        "POST",
        { expectedVersion: f.getVersion() },
        f.cookie,
        "missing-" + r.id,
      );
      assert.equal(missing.status, 409);
      for (const m of r.matches.filter((m) => !m.bye)) {
        const scored = await f.request(
          f.base + "/matches/" + m.id + "/results",
          "PATCH",
          {
            expectedVersion: f.getVersion(),
            result: { kind: "score", scores: [(m.bestOf + 1) / 2, 0] },
            reason: "独立瑞士运行",
          },
          f.cookie,
          "score-" + m.id,
        );
        assert.equal(scored.status, 200, JSON.stringify(scored.data));
        f.setVersion(scored.data.data.version);
      }
      const body = { expectedVersion: f.getVersion() },
        path = f.base + "/rounds/" + r.id + "/confirm";
      const confirmed = await f.request(
        path,
        "POST",
        body,
        f.cookie,
        "confirm-" + r.id,
      );
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
      f.setVersion(confirmed.data.data.version);
      assert.deepEqual(
        (await f.request(path, "POST", body, f.cookie, "confirm-" + r.id)).data
          .data,
        confirmed.data.data,
      );
      assert.equal(
        (
          await f.request(
            path,
            "POST",
            { expectedVersion: f.getVersion() },
            f.cookie,
            "locked-" + r.id,
          )
        ).status,
        409,
      );
    }
    const u = (await view()).units[0];
    assert.equal(u.rounds.flatMap((r) => r.matches).length, count);
    assert.equal(u.qualified.length, q);
    for (const r of u.standings)
      assert.equal(new Set(r.opponents).size, r.opponents.length);
    await f.close();
  }
});
