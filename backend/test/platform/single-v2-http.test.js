"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const { input } = require("../tournament-configuration/compile-fixture");
test("ER1 v2 HTTP 8-to-4 cuts, 8-to-1 champion, 12-to-3 separate trees and third-place", async (t) => {
  for (const [n, q, parameters, count] of [
    [8, 4, {}, 4],
    [8, 1, {}, 7],
    [12, 3, { bracketMode: "segmented" }, 9],
    [8, 1, { thirdPlace: true }, 8],
  ]) {
    const f = await setupV2(
      t,
      input("single-cut-v2", n, q, parameters),
      Array.from({ length: n }, () => null),
    );
    const started = await f.request(
      f.base + "/start",
      "POST",
      { expectedVersion: f.getVersion(), configurationId: f.cid },
      f.cookie,
      "start",
    );
    assert.equal(started.status, 200, JSON.stringify(started.data));
    f.setVersion(started.data.data.version);
    let matchCount = 0;
    while (true) {
      const view = (
        await f.request(f.base + "/runtime", "GET", undefined, f.cookie)
      ).data.data;
      if (view.runtime.status === "completed") {
        const u = view.runtime.units[0];
        assert.equal(u.qualified.length, q);
        assert.equal(matchCount, count);
        if (q === 1)
          assert.equal(
            u.standings.find((x) => x.rank === 1).entrantId,
            f.entrants[0].entrantId,
          );
        else
          assert.ok(
            u.standings
              .filter((x) => x.qualification)
              .every((x) => x.rank === undefined),
          );
        assert.equal(view.runtime.planDigest.length, 64);
        break;
      }
      const u = view.runtime.units[0],
        r = u.rounds.find((x) => !x.confirmed);
      matchCount += r.matches.length;
      if (r.matches.length > 1) {
        const incomplete = await f.request(
          f.base + "/rounds/" + r.id + "/confirm",
          "POST",
          { expectedVersion: f.getVersion() },
          f.cookie,
          "incomplete-" + r.id,
        );
        assert.equal(incomplete.status, 409);
        assert.equal(incomplete.data.error.code, "RESULTS_INCOMPLETE");
        assert.equal(
          (await f.request(f.base + "/runtime", "GET", undefined, f.cookie))
            .data.data.version,
          f.getVersion(),
        );
      }
      for (const m of r.matches) {
        const score = (m.bestOf + 1) / 2;
        const result = await f.request(
          f.base + "/matches/" + m.id + "/results",
          "PATCH",
          {
            expectedVersion: f.getVersion(),
            result: { kind: "score", scores: [score, 0] },
            reason: "独立固定左胜算例",
          },
          f.cookie,
          "score-" + m.id,
        );
        assert.equal(result.status, 200, JSON.stringify(result.data));
        f.setVersion(result.data.data.version);
      }
      const body = { expectedVersion: f.getVersion() };
      const confirmed = await f.request(
        f.base + "/rounds/" + r.id + "/confirm",
        "POST",
        body,
        f.cookie,
        "confirm-" + r.id,
      );
      assert.equal(confirmed.status, 200);
      f.setVersion(confirmed.data.data.version);
      assert.deepEqual(
        (
          await f.request(
            f.base + "/rounds/" + r.id + "/confirm",
            "POST",
            body,
            f.cookie,
            "confirm-" + r.id,
          )
        ).data.data,
        confirmed.data.data,
      );
      const locked = await f.request(
        f.base + "/matches/" + r.matches[0].id + "/results",
        "PATCH",
        {
          expectedVersion: f.getVersion(),
          result: { kind: "score", scores: [0, 2] },
          reason: "确认后禁止修改",
        },
        f.cookie,
        "locked-" + r.id,
      );
      assert.equal(locked.status, 409);
      assert.equal(locked.data.error.code, "ROUND_LOCKED");
    }
  }
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
    "ER5 v2 results.edit cannot confirm and original successful key respects revoked confirm permission " +
      rule,
    async (t) => {
      const f = await setupV2(
        t,
        input(
          rule,
          4,
          rule === "gsl-classic-v1" ? 2 : 1,
          rule === "swiss-fixed-v1" ? { roundCount: 2 } : {},
        ),
        Array.from({ length: 4 }, () => null),
      );
      await f.mutate("/start", { configurationId: f.cid }, "start");
      const actor = f.entrants[0];
      await f.mutate(
        "/collaborators",
        { userId: actor.userId, permissions: ["results.edit"] },
        "grant-result",
      );
      const view = (
          await f.request(f.base + "/runtime", "GET", undefined, f.cookie)
        ).data.data,
        r = view.runtime.units[0].rounds[0];
      for (const m of r.matches) {
        const out = await f.request(
          f.base + "/matches/" + m.id + "/results",
          "PATCH",
          {
            expectedVersion: f.getVersion(),
            result: { kind: "score", scores: [2, 0] },
            reason: "权限算例",
          },
          f.cookie,
          "score-" + m.id,
        );
        assert.equal(out.status, 200);
        f.setVersion(out.data.data.version);
      }
      const path = f.base + "/rounds/" + r.id + "/confirm";
      assert.equal(
        (
          await f.request(
            path,
            "POST",
            { expectedVersion: f.getVersion() },
            actor.cookie,
            "not-authorized",
          )
        ).status,
        403,
      );
      await f.mutate(
        "/collaborators",
        {
          userId: actor.userId,
          permissions: ["results.edit", "rounds.confirm"],
        },
        "grant-confirm",
      );
      const body = { expectedVersion: f.getVersion() },
        confirmed = await f.request(
          path,
          "POST",
          body,
          actor.cookie,
          "actor-confirm",
        );
      assert.equal(confirmed.status, 200);
      f.setVersion(confirmed.data.data.version);
      await f.mutate(
        "/collaborators",
        { userId: actor.userId, permissions: ["results.edit"] },
        "revoke-confirm",
      );
      assert.equal(
        (await f.request(path, "POST", body, actor.cookie, "actor-confirm"))
          .status,
        403,
      );
      assert.equal(
        (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data
          .data.runtime.units[0].rounds.length,
        2,
      );
    },
  );
