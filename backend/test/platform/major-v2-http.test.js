"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setupV2 } = require("./runtime-v2-fixture");
const {
  parseStructure,
} = require("../../src/tournament-configuration/domain/structure");
const observations = require("../fixtures/cologne2026-historical-observations-v1.json");
const expectations = require("../fixtures/cologne2026-pairing-expectations-v1.json");
const canonical = (pairs) => pairs.map((p) => [...p].sort().join("|")).sort();
test("Major single-event HTTP all 106 series preserves late invites, inherited stage seeds and final BO5", async (t) => {
  const stageIds = ["stage1", "stage2", "stage3", "playoffs"];
  const stage = (id, i) => ({
    id,
    name: id,
    order: i + 1,
    format: i < 3 ? "threshold-swiss" : "single-elimination",
    ruleVersion: i < 3 ? "major-cologne-2026-v1" : "single-cut-v2",
    groupSize: i < 3 ? 16 : 8,
    groupCount: 1,
    qualifyCount: i < 3 ? 8 : 1,
    parameters:
      i < 3
        ? { defaultBO: i < 2 ? 1 : 3 }
        : { defaultBO: 3, overrides: { final: 5 } },
    groups: [{ id: id + "g", stageId: id }],
  });
  const structure = parseStructure(
    {
      entrantKind: "individual",
      structureVersion: "structure-v2",
      routingVersion: "routing-v2",
      stages: stageIds.map(stage),
      pools: [],
      routes: stageIds
        .slice(0, 3)
        .map((id, i) => ({
          id: "route" + i,
          source: { stageId: id, groupId: id + "g", port: "rank" },
          target: {
            stageId: stageIds[i + 1],
            groupId: stageIds[i + 1] + "g",
            port: "seed",
          },
          selector: { kind: "rankRange", from: 1, to: 8 },
          quota: 8,
          sort: [{ field: "sourceRank", direction: "asc" }],
          placement: {
            kind: "seed",
            positions: Array.from({ length: 8 }, (_, j) =>
              i === 2 ? j + 1 : j + 9,
            ),
          },
        })),
    },
    "T",
  );
  const invited = stageIds.slice(0, 3).flatMap((id, i) =>
    expectations.cases
      .find((c) => c.stage === id && c.round === 1)
      .rows.filter((r) => i === 0 || r.initialSeed <= 8)
      .sort((a, b) => a.initialSeed - b.initialSeed)
      .map((r) => ({
        name: r.entrantId,
        stageId: id,
        groupId: id + "g",
        port: "seed",
        position: r.initialSeed,
      })),
  );
  assert.equal(invited.length, 32);
  assert.equal(new Set(invited.map((r) => r.name)).size, 32);
  const f = await setupV2(
    t,
    structure,
    invited.map(({ name, ...ref }) => ref),
  );
  const names = new Map(
    f.entrants.map((e, i) => [e.entrantId, invited[i].name]),
  );
  const view = async () =>
    (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data.data
      .runtime;
  await f.mutate("/start", { configurationId: f.cid }, "start");
  assert.deepEqual(
    (await view()).units.map((u) => u.stageId),
    ["stage1"],
  );
  for (const [index, id] of stageIds.entries()) {
    const expectedStage = observations.stages.find((s) => s.id === id);
    const remaining = structuredClone(expectedStage.matches);
    let runtime = await view();
    let unit = runtime.units.find((u) => u.stageId === id);
    assert.ok(unit, JSON.stringify(runtime.blocked));
    if (index < 3) {
      const first = expectations.cases.find(
        (c) => c.stage === id && c.round === 1,
      );
      assert.deepEqual(
        unit.bindings
          .map((b) => [names.get(b.entrantId), b.initialSeed])
          .sort(),
        first.rows.map((r) => [r.entrantId, r.initialSeed]).sort(),
      );
    }
    while (unit.status !== "completed") {
      const round = unit.rounds.find((r) => !r.confirmed);
      assert.ok(round, JSON.stringify(unit.pairingBlock));
      if (index < 3)
        assert.deepEqual(
          canonical(
            round.matches.map((m) =>
              m.entrants.map((entrant) => names.get(entrant)),
            ),
          ),
          canonical(
            expectations.cases.find(
              (c) => c.stage === id && c.round === round.number,
            ).expectedPairs,
          ),
        );
      for (const match of round.matches) {
        const sides = match.entrants.map((entrant) => names.get(entrant));
        const at = remaining.findIndex(
          (o) => canonical([o.entrantNames])[0] === canonical([sides])[0],
        );
        assert.notEqual(at, -1, `${id}: ${sides.join(" vs ")}`);
        const observation = remaining.splice(at, 1)[0];
        assert.equal(match.bestOf, observation.bestOf);
        const out = await f.request(
          f.base + "/matches/" + match.id + "/results",
          "PATCH",
          {
            expectedVersion: f.getVersion(),
            result: {
              kind: "score",
              scores: sides.map(
                (name) =>
                  observation.scores[observation.entrantNames.indexOf(name)],
              ),
            },
            reason: "同一赛事历史比分回放",
          },
          f.cookie,
          "score-" + match.id,
        );
        assert.equal(out.status, 200, JSON.stringify(out.data));
        f.setVersion(out.data.data.version);
      }
      await f.mutate(
        "/rounds/" + round.id + "/confirm",
        {},
        "confirm-" + round.id,
      );
      runtime = await view();
      unit = runtime.units.find((u) => u.stageId === id);
      assert.ok(
        runtime.units.every((u) => stageIds.indexOf(u.stageId) <= index + 1),
      );
    }
    assert.equal(remaining.length, 0);
    if (index < 3) assert.equal(unit.qualified.length, 8);
  }
  const runtime = await view();
  assert.equal(runtime.status, "completed");
  assert.equal(
    runtime.units.flatMap((u) => u.rounds.flatMap((r) => r.matches)).length,
    106,
  );
  const final = runtime.units.find((u) => u.stageId === "playoffs").standings;
  assert.equal(names.get(final.find((r) => r.rank === 1).entrantId), "Falcons");
  assert.equal(names.get(final.find((r) => r.rank === 2).entrantId), "FURIA");
  await f.close();
});
for (const stage of observations.stages.filter((s) =>
  /^stage[123]$/.test(s.id),
)) {
  test(`Major version actual HTTP ${stage.id} configuration freeze and all 33 historical series`, async (t) => {
    const structure = parseStructure(
      {
        entrantKind: "individual",
        structureVersion: "structure-v2",
        routingVersion: "routing-v2",
        pools: [],
        routes: [],
        stages: [
          {
            id: "s",
            name: stage.id,
            order: 1,
            format: "threshold-swiss",
            ruleVersion: "major-cologne-2026-v1",
            parameters: { defaultBO: stage.id === "stage3" ? 3 : 1 },
            groups: [{ id: "g", stageId: "s" }],
          },
        ],
      },
      "T",
    );
    const f = await setupV2(
      t,
      structure,
      Array.from({ length: 16 }, () => null),
    );
    await f.mutate("/start", { configurationId: f.cid }, "start");
    const first = expectations.cases.find(
      (c) => c.stage === stage.id && c.round === 1,
    );
    const names = new Map(
      first.rows.map((r) => [
        f.entrants[r.initialSeed - 1].entrantId,
        r.entrantId,
      ]),
    );
    const remaining = structuredClone(stage.matches);
    const view = async () =>
      (await f.request(f.base + "/runtime", "GET", undefined, f.cookie)).data
        .data.runtime;
    for (let number = 1; number <= 5; number++) {
      const unit = (await view()).units[0],
        round = unit.rounds.find((r) => !r.confirmed);
      assert.ok(round, JSON.stringify(unit.pairingBlock));
      const expected = expectations.cases.find(
        (c) => c.stage === stage.id && c.round === number,
      );
      assert.deepEqual(
        canonical(
          round.matches.map((m) => m.entrants.map((id) => names.get(id))),
        ),
        canonical(expected.expectedPairs),
      );
      for (const match of round.matches) {
        const sides = match.entrants.map((id) => names.get(id));
        const index = remaining.findIndex(
          (o) => canonical([o.entrantNames])[0] === canonical([sides])[0],
        );
        assert.notEqual(index, -1);
        const observation = remaining.splice(index, 1)[0];
        assert.equal(match.bestOf, observation.bestOf);
        const result = await f.request(
          f.base + "/matches/" + match.id + "/results",
          "PATCH",
          {
            expectedVersion: f.getVersion(),
            result: {
              kind: "score",
              scores: sides.map(
                (name) =>
                  observation.scores[observation.entrantNames.indexOf(name)],
              ),
            },
            reason: "独立历史系列比分",
          },
          f.cookie,
          "score-" + match.id,
        );
        assert.equal(result.status, 200, JSON.stringify(result.data));
        f.setVersion(result.data.data.version);
      }
      const path = f.base + "/rounds/" + round.id + "/confirm",
        body = { expectedVersion: f.getVersion() },
        key = "confirm-" + round.id;
      const confirmed = await f.request(path, "POST", body, f.cookie, key);
      assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
      f.setVersion(confirmed.data.data.version);
      assert.deepEqual(
        (await f.request(path, "POST", body, f.cookie, key)).data.data,
        confirmed.data.data,
      );
    }
    const runtime = await view(),
      unit = runtime.units[0];
    assert.equal(runtime.status, "completed");
    assert.equal(unit.ruleVersion, "major-cologne-2026-v1");
    assert.equal(unit.qualified.length, 8);
    assert.equal(remaining.length, 0);
    for (const expected of stage.standings) {
      const row = unit.standings.find(
        (r) => names.get(r.entrantId) === expected.name,
      );
      assert.deepEqual(
        [row.wins, row.losses],
        [expected.wins, expected.losses],
      );
    }
    await f.close();
  });
}
