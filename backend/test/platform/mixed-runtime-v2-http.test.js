"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const {
  stage,
  route,
} = require("../tournament-configuration/routing-v2-fixture");
test("PR5 HTTP late direct invitations wait for both root groups and full confirmed sources", async (t) => {
  const a = stage("A", 1, "single-cut-v2", 4, 2);
  a.groupCount = 2;
  a.groups = [
    { id: "g0", stageId: "A" },
    { id: "g1", stageId: "A" },
  ];
  const structure = {
    entrantKind: "individual",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [a, stage("T", 2, "single-cut-v2", 8, 1)],
    pools: [],
    routes: [
      route(
        "r0",
        { stageId: "A", groupId: "g0", port: "qualification" },
        { stageId: "T", groupId: "Tg", port: "seed" },
        1,
        2,
        [1, 2],
      ),
      route(
        "r1",
        { stageId: "A", groupId: "g1", port: "qualification" },
        { stageId: "T", groupId: "Tg", port: "seed" },
        1,
        2,
        [3, 4],
      ),
    ],
  };
  const entries = Array.from({ length: 12 }, (_, i) => ({
    stageId: i < 8 ? "A" : "T",
    groupId: i < 4 ? "g0" : i < 8 ? "g1" : "Tg",
    port: "seed",
    position: i < 8 ? (i % 4) + 1 : i - 3,
  }));
  const f = await setupV2(t, structure, entries);
  await f.mutate("/start", { configurationId: f.cid }, "start");
  const view = async () =>
    (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data
      .data;
  assert.equal((await view()).runtime.units.length, 2);
  async function finish(unitId) {
    const u = (await view()).runtime.units.find((u) => u.id === unitId),
      r = u.rounds.find((r) => !r.confirmed);
    for (const m of r.matches) {
      const out = await f.request(
        f.base + "/matches/" + m.id + "/results",
        "PATCH",
        {
          expectedVersion: f.getVersion(),
          result: { kind: "score", scores: [2, 0] },
          reason: "左方赢的独立算例",
        },
        f.cookie,
        "result-" + m.id,
      );
      assert.equal(out.status, 200);
      f.setVersion(out.data.data.version);
    }
    await f.mutate("/rounds/" + r.id + "/confirm", {}, "confirm-" + r.id);
  }
  await finish("g0");
  let r = (await view()).runtime;
  assert.equal(
    r.units.some((u) => u.stageId === "T"),
    false,
  );
  assert.ok(r.waiting.some((x) => x.stageId === "T"));
  await finish("g1");
  r = (await view()).runtime;
  const target = r.units.find((u) => u.id === "Tg");
  assert.equal(target.entrants.length, 8);
  assert.equal(target.rounds[0].matches.length, 4);
  assert.equal(
    target.entrants.filter((id) =>
      f.entrants.slice(8).some((e) => e.entrantId === id),
    ).length,
    4,
  );
  while ((await view()).runtime.status !== "completed") await finish("Tg");
  assert.equal(
    (await view()).runtime.units.flatMap((u) =>
      u.rounds.flatMap((r) => r.matches),
    ).length,
    11,
  );
});
for (const rule of [
  "single-cut-v2",
  "gsl-classic-v1",
  "de-standard-v1",
  "de-lower-entry-v1",
  "swiss-fixed-v1",
  "swiss-threshold-v1",
])
  test(
    "ER5 compiled runtime confirmation rollback, version race and SQLite restart replay " +
      rule,
    async (t) => {
      const { mkdtempSync, rmSync } = require("node:fs"),
        { tmpdir } = require("node:os"),
        { join } = require("node:path");
      const { input } = require("../tournament-configuration/compile-fixture"),
        { event } = require("./formats-v2-fixture");
      const dir = mkdtempSync(join(tmpdir(), "race-mixed-runtime-")),
        databasePath = join(dir, "runtime.sqlite");
      let f = await setupV2(
          t,
          input(
            rule,
            4,
            rule === "gsl-classic-v1" ? 2 : 1,
            rule === "swiss-fixed-v1" ? { roundCount: 2 } : {},
          ),
          Array.from({ length: 4 }, () => null),
          { databasePath },
        ),
        reopened;
      t.after(async () => {
        await f.close();
        await reopened?.close();
        rmSync(dir, { recursive: true, force: true });
      });
      await f.mutate("/start", { configurationId: f.cid }, "start");
      let current = (
          await f.request(f.base + "/runtime", "GET", undefined, f.cookie)
        ).data.data,
        r = current.runtime.units[0].rounds[0];
      for (const m of r.matches) {
        const out = await f.request(
          f.base + "/matches/" + m.id + "/results",
          "PATCH",
          {
            expectedVersion: f.getVersion(),
            result: { kind: "score", scores: [2, 0] },
            reason: "持久化算例",
          },
          f.cookie,
          "score-" + m.id,
        );
        assert.equal(out.status, 200);
        f.setVersion(out.data.data.version);
      }
      const before = (
          await f.request(f.base + "/runtime", "GET", undefined, f.cookie)
        ).data.data,
        body = { expectedVersion: f.getVersion() },
        path = f.base + "/rounds/" + r.id + "/confirm";
      f.platform.db.exec(
        "CREATE TRIGGER fail_round BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT,'injected'); END;",
      );
      assert.equal(
        (await f.request(path, "POST", body, f.cookie, "confirm")).status,
        503,
      );
      assert.deepEqual(
        (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data
          .data,
        before,
      );
      f.platform.db.exec("DROP TRIGGER fail_round");
      const settled = await Promise.all([
        f.request(path, "POST", body, f.cookie, "confirm"),
        f.request(path, "POST", body, f.cookie, "competing"),
      ]);
      assert.deepEqual(settled.map((x) => x.status).sort(), [200, 409]);
      const success = settled.find((x) => x.status === 200).data.data;
      const successfulKey = settled[0].status === 200 ? "confirm" : "competing";
      await f.close();
      reopened = await event(t, { databasePath });
      assert.deepEqual(
        (
          await reopened.request(
            path,
            "POST",
            body,
            reopened.cookie,
            successfulKey,
          )
        ).data.data,
        success,
      );
      const restored = (
        await reopened.request(
          f.base + "/runtime",
          "GET",
          undefined,
          reopened.cookie,
        )
      ).data.data;
      assert.equal(restored.runtime.units[0].rounds.length, 2);
      assert.equal(restored.runtime.units[0].rounds[0].confirmed, true);
      assert.equal(restored.runtime.planDigest, before.runtime.planDigest);
    },
  );
