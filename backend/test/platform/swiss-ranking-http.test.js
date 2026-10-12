"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const { input } = require("../tournament-configuration/compile-fixture");
test("ER4 Swiss cutoff tie blocks qualification; reasoned decision can only reorder tied participants", async (t) => {
  const f = await setupV2(
    t,
    input("swiss-fixed-v1", 4, 1, {
      roundCount: 1,
      tiebreakers: ["points", "manual-with-reason"],
    }),
    Array.from({ length: 4 }, () => null),
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
  const view = async () =>
    (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data.data
      .runtime;
  const round = (await view()).units[0].rounds[0];
  for (const m of round.matches) {
    const scored = await f.request(
      f.base + "/matches/" + m.id + "/results",
      "PATCH",
      {
        expectedVersion: f.getVersion(),
        result: { kind: "score", scores: [2, 0] },
        reason: "同分切线算例",
      },
      f.cookie,
      "score-" + m.id,
    );
    assert.equal(scored.status, 200);
    f.setVersion(scored.data.data.version);
  }
  await f.mutate("/rounds/" + round.id + "/confirm", {}, "confirm");
  const u = (await view()).units[0];
  assert.equal(u.status, "ranking-blocked");
  assert.equal(u.qualified.length, 0);
  assert.equal((await view()).status, "running");
  const path = f.base + "/units/" + u.id + "/ranking",
    order = [f.entrants[1], f.entrants[0], f.entrants[2], f.entrants[3]].map(
      (e) => e.entrantId,
    );
  const bad = await f.request(
    path,
    "POST",
    {
      expectedVersion: f.getVersion(),
      order: [order[2], ...order.filter((id) => id !== order[2])],
      reason: "不能颠倒胜败",
    },
    f.cookie,
    "invalid",
  );
  assert.equal(bad.status, 422);
  await f.mutate(
    "/units/" + u.id + "/ranking",
    { order, reason: "公开留因裁定" },
    "ranking",
  );
  const final = (await view()).units[0];
  assert.equal(final.qualified[0].entrantId, f.entrants[1].entrantId);
  assert.equal((await view()).status, "completed");
  const publicView = (await f.request(f.base + "/runtime")).data.data.runtime;
  assert.ok(!JSON.stringify(publicView).includes('"actorId"'));
});
