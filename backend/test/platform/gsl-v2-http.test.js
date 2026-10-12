"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const { input } = require("../tournament-configuration/compile-fixture");
test("ER1 ER5 four independent GSL groups yield twenty matches, ordered qualifiers and locked batches", async (t) => {
  const structure = input("gsl-classic-v1", 4, 2);
  structure.stages[0].groupCount = 4;
  structure.stages[0].capacity = 16;
  structure.stages[0].groups = Array.from({ length: 4 }, (_, i) => ({
    id: "g" + i,
    stageId: "s",
  }));
  const f = await setupV2(
    t,
    structure,
    Array.from({ length: 16 }, (_, i) => ({
      stageId: "s",
      groupId: "g" + Math.floor(i / 4),
      port: "seed",
      position: (i % 4) + 1,
    })),
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
  const view = async () =>
    (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data.data
      .runtime;
  assert.equal((await view()).units.length, 4);
  for (let group = 0; group < 4; group++) {
    for (let wave = 0; wave < 3; wave++) {
      const u = (await view()).units[group],
        r = u.rounds[wave];
      assert.equal(r.matches.length, wave === 2 ? 1 : 2);
      const incomplete = await f.request(
        f.base + "/rounds/" + r.id + "/confirm",
        "POST",
        { expectedVersion: f.getVersion() },
        f.cookie,
        "incomplete-" + r.id,
      );
      assert.equal(incomplete.status, 409);
      assert.equal(incomplete.data.error.code, "RESULTS_INCOMPLETE");
      for (const m of r.matches) {
        const scores = wave === 1 && m.role === "elimination" ? [0, 2] : [2, 0];
        const scored = await f.request(
          f.base + "/matches/" + m.id + "/results",
          "PATCH",
          {
            expectedVersion: f.getVersion(),
            result: { kind: "score", scores },
            reason: "人工A/B/C/D期望",
          },
          f.cookie,
          "score-" + m.id,
        );
        assert.equal(scored.status, 200, JSON.stringify(scored.data));
        f.setVersion(scored.data.data.version);
      }
      const body = { expectedVersion: f.getVersion() },
        path = f.base + "/rounds/" + r.id + "/confirm";
      const outcomes = await Promise.all([
        f.request(path, "POST", body, f.cookie, "confirm-" + r.id),
        f.request(path, "POST", body, f.cookie, "race-" + r.id),
      ]);
      assert.deepEqual(outcomes.map((x) => x.status).sort(), [200, 409]);
      const success = outcomes.find((x) => x.status === 200);
      f.setVersion(success.data.data.version);
      const locked = await f.request(
        f.base + "/matches/" + r.matches[0].id + "/results",
        "PATCH",
        {
          expectedVersion: f.getVersion(),
          result: { kind: "score", scores: [0, 2] },
          reason: "锁轮不得修改",
        },
        f.cookie,
        "locked-" + r.id,
      );
      assert.equal(locked.status, 409);
      if (group === 0) assert.equal((await view()).units[1].rounds.length, 1);
    }
    const u = (await view()).units[group];
    assert.equal(u.status, "completed");
    assert.deepEqual(
      u.qualified.map((x) => x.entrantId),
      f.entrants.slice(group * 4, group * 4 + 2).map((x) => x.entrantId),
    );
    assert.deepEqual(
      u.standings.map((x) => x.actualLosses),
      [0, 1, 2, 2],
    );
  }
  const finished = await view();
  assert.equal(finished.status, "completed");
  assert.equal(
    finished.units.flatMap((u) => u.rounds.flatMap((r) => r.matches)).length,
    20,
  );
  const publicView = (await f.request(f.base + "/runtime")).data;
  assert.ok(!JSON.stringify(publicView).includes('"userId"'));
  assert.ok(!JSON.stringify(publicView).includes('"answers"'));
});
