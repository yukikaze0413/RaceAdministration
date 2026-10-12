"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const { input } = require("../tournament-configuration/compile-fixture");
test("SC1 HTTP frozen single/double round-robin N4/N5 complete keys, rests, configurable points and tie decision", async (t) => {
  for (const n of [4, 5])
    for (const cycle of [1, 2]) {
      const rule = cycle === 1 ? "round-robin-v2" : "double-round-robin-v2";
      const f = await setupV2(
        t,
        input(rule, n, 2, {
          points: { win: 5, draw: 2, loss: 0, doubleLoss: 0 },
        }),
        Array.from({ length: n }, () => null),
      );
      await f.mutate("/start", { configurationId: f.cid }, "start");
      const view = async () =>
        (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data
          .data.runtime;
      let current = await view(),
        u = current.units[0];
      assert.equal(
        u.rounds.flatMap((r) => r.matches).length,
        ((n * (n - 1)) / 2) * cycle,
      );
      while (u.status === "running") {
        const r = u.rounds.find((r) => !r.confirmed);
        for (const m of r.matches) {
          const out = await f.request(
            f.base + "/matches/" + m.id + "/results",
            "PATCH",
            {
              expectedVersion: f.getVersion(),
              result: { kind: "score", scores: [2, 0] },
              reason: "循环独立左胜",
            },
            f.cookie,
            "score-" + m.id,
          );
          assert.equal(out.status, 200);
          f.setVersion(out.data.data.version);
        }
        await f.mutate("/rounds/" + r.id + "/confirm", {}, "confirm-" + r.id);
        current = await view();
        u = current.units[0];
      }
      if (u.status === "ranking-blocked")
        await f.mutate(
          "/units/" + u.id + "/ranking",
          {
            order: u.standings.map((r) => r.entrantId),
            reason: "并列按人工核验顺序",
          },
          "ranking",
        );
      u = (await view()).units[0];
      assert.equal(u.status, "completed");
      assert.equal(u.qualified.length, 2);
      assert.equal((await view()).status, "completed");
      assert.equal(
        u.standings.reduce((sum, r) => sum + r.points, 0),
        ((5 * n * (n - 1)) / 2) * cycle,
      );
      assert.ok(
        u.standings.every((r) => r.wins + r.losses === (n - 1) * cycle),
      );
      if (n % 2) assert.ok(u.rounds.every((r) => r.rest.length === 1));
      await f.close();
    }
});
