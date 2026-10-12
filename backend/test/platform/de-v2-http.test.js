"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const { input } = require("../tournament-configuration/compile-fixture");
test("ER2 FP3 HTTP N4/N8 all direct-lower capacities and Q frontiers, reset paths, actual losses and locked wave", async (t) => {
  for (const n of [4, 8])
    for (const [mode, extra] of [
      ["disabled", 0],
      ["half", n / 2],
      ["same", n],
    ])
      for (const q of [1, 2, 3]) {
        const rule =
          mode === "disabled" ? "de-standard-v1" : "de-lower-entry-v1";
        const f = await setupV2(
          t,
          input(rule, n, q, {
            lowerEntryMode: mode,
            finalReset: q === 1,
            overrides: { final: 5 },
          }),
          Array.from({ length: n + extra }, (_, i) => ({
            stageId: "s",
            groupId: "g",
            port: i < n ? "upper" : "lower",
            position: i < n ? i + 1 : i - n + 1,
            positionKind: "seed",
          })),
        );
        await f.mutate("/start", { configurationId: f.cid }, "start");
        const view = async () =>
          (await f.request(f.base + "/runtime", "GET", undefined, f.cookie))
            .data.data.runtime;
        let games = 0;
        while ((await view()).status !== "completed") {
          const u = (await view()).units[0],
            r = u.rounds.find((r) => !r.confirmed);
          const incomplete = await f.request(
            f.base + "/rounds/" + r.id + "/confirm",
            "POST",
            { expectedVersion: f.getVersion() },
            f.cookie,
            "missing-" + r.id,
          );
          assert.equal(incomplete.status, 409);
          for (const m of r.matches) {
            games++;
            const target = (m.bestOf + 1) / 2;
            const lowerWins = m.role === "final" && m.round === 1;
            const scored = await f.request(
              f.base + "/matches/" + m.id + "/results",
              "PATCH",
              {
                expectedVersion: f.getVersion(),
                result: {
                  kind: "score",
                  scores: lowerWins ? [0, target] : [target, 0],
                },
                reason: "独立双败算例",
              },
              f.cookie,
              "score-" + m.id,
            );
            assert.equal(scored.status, 200, JSON.stringify(scored.data));
            f.setVersion(scored.data.data.version);
          }
          await f.mutate("/rounds/" + r.id + "/confirm", {}, "confirm-" + r.id);
        }
        const u = (await view()).units[0];
        assert.equal(u.qualified.length, q);
        const baseline =
          2 * n - 2 + (mode === "half" ? n / 2 : mode === "same" ? n : 0);
        assert.equal(games, baseline - (q - 1) + (q === 1 ? 1 : 0));
        for (const row of u.standings.filter((x) =>
          f.entrants.slice(n).some((e) => e.entrantId === x.entrantId),
        )) {
          assert.equal(row.initialLosses, 1);
          assert.equal(row.actualLosses, 1);
        }
        if (q === 1)
          assert.equal(
            u.rounds.flatMap((r) => r.matches).filter((m) => m.role === "final")
              .length,
            2,
          );
        else
          assert.ok(
            u.standings
              .filter((x) => x.qualification)
              .every((x) => x.rank === undefined),
          );
        await f.close();
      }
});
