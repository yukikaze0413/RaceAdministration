"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const fixtures = require("../fixtures/reference-cases-v1.json");
const { setupV2 } = require("./runtime-v2-fixture");
function structure(example) {
  const shadow = example.id === "shadow-cup-v1";
  const stage = (id, order, format, ruleVersion, n, q, groups, parameters) => ({
    id,
    name: id,
    order,
    format,
    ruleVersion,
    groupSize: n,
    qualifyCount: q,
    groupCount: groups.length,
    parameters,
    groups: groups.map((id2) => ({ id: id2, stageId: id })),
  });
  const sources = shadow ? ["swiss"] : ["g0", "g1", "g2", "g3"];
  return {
    entrantKind: "individual",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [
      stage(
        "source",
        1,
        shadow ? "fixed-swiss" : "gsl",
        shadow ? "swiss-fixed-v1" : "gsl-classic-v1",
        shadow ? 32 : 4,
        shadow ? 8 : 2,
        sources,
        shadow
          ? { roundCount: 5 }
          : { seeding: { kind: "slot", seedTableVersion: "recursive-v1" } },
      ),
      stage(
        "target",
        2,
        shadow ? "single-elimination" : "double-elimination",
        shadow ? "single-cut-v2" : "de-standard-v1",
        8,
        1,
        [shadow ? "single" : "de"],
        shadow ? {} : { finalReset: example.finalReset },
      ),
    ],
    pools: [],
    routes: sources.map((groupId, i) => ({
      id: "route-" + groupId,
      source: { stageId: "source", groupId, port: "qualification" },
      target: {
        stageId: "target",
        groupId: shadow ? "single" : "de",
        port: shadow ? "seed" : "upper",
      },
      selector: { kind: "rankRange", from: 1, to: shadow ? 8 : 2 },
      quota: shadow ? 8 : 2,
      sort: [{ field: "initialSeed", direction: "asc" }],
      placement: {
        kind: "seed",
        positions: Array.from(
          { length: shadow ? 8 : 2 },
          (_, j) => i * 2 + j + 1,
        ),
      },
    })),
  };
}
function oracleGames(c) {
  return c.id === "shadow-cup-v1"
    ? [
        ...c.rounds.flatMap((r) => r.matches),
        ...c.knockout.flatMap((r) => r.matches),
      ]
    : [...c.groups.flatMap((g) => g.matches), ...c.matches];
}
for (const expected of fixtures.cases)
  test("RC2 isolated full HTTP replay twice: " + expected.id, async (t) => {
    const replay = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "race-reference-"),
      );
      const shadow = expected.id === "shadow-cup-v1";
      const f = await setupV2(
        t,
        structure(expected),
        Array.from({ length: expected.entrantCount }, (_, i) => ({
          stageId: "source",
          groupId: shadow ? "swiss" : "g" + Math.floor(i / 4),
          port: shadow ? "seed" : "slot",
          position: shadow ? i + 1 : (i % 4) + 1,
        })),
        { databasePath: path.join(directory, "demo.sqlite") },
      );
      t.after(async () => {
        await f.close();
        for (const name of fs.readdirSync(directory))
          fs.unlinkSync(path.join(directory, name));
        fs.rmdirSync(directory);
      });
      const seed = (id) => f.entrants.find((e) => e.entrantId === id)?.seed;
      const view = async () => {
        const r = await f.request(
          f.base + "/runtime",
          "GET",
          undefined,
          f.cookie,
        );
        assert.equal(r.status, 200);
        return r.data.data.runtime;
      };
      const configPath = f.base + "/configurations/" + f.cid;
      const snapshot = (await f.request(configPath, "GET", undefined, f.cookie))
        .data.data.snapshot;
      await f.mutate("/start", { configurationId: f.cid }, "start");
      const recorded = [],
        matches = oracleGames(expected),
        used = new Set();
      let timeVersion = 0;
      const schedule = {
        configurationId: f.cid,
        resources: Array.from({ length: 16 }, (_, i) => ({
          id: "table-" + i,
          name: "演示台" + (i + 1),
        })),
        windows: [],
        assignments: [],
      };
      while ((await view()).status !== "completed") {
        const rt = await view();
        assert.deepEqual(rt.blocked, [], "完整案例不得隐含结构阻塞");
        const u = rt.units.find((u) => u.status !== "completed");
        assert.ok(u, "存在未启动阶段但无活动组");
        const round = u.rounds.find((r) => !r.confirmed);
        assert.ok(round, "配对或同分阻塞：" + JSON.stringify(u.pairingBlock));
        const batch = round.matches.map((m, i) => {
          assert.equal(m.bye, false);
          const index = Number(m.planKey.split("/").at(-1));
          const id =
            u.id === "swiss"
              ? `swiss/${round.number}/${index}`
              : u.id === "single"
                ? `single/${m.round}/${index}`
                : `${u.id}/${m.role}/${m.round}/${index}`;
          const e = matches.find((x) => x.id === id);
          assert.ok(e, "未预先记录的比赛：" + id);
          assert.ok(!used.has(id));
          assert.deepEqual(m.entrants.map(seed), e.entrants, id);
          assert.equal(m.bestOf, 3);
          const windowId = "window-" + e.wave;
          if (!schedule.windows.some((w) => w.id === windowId))
            schedule.windows.push({
              id: windowId,
              name: "演示批次" + e.wave,
              startsAt: e.startsAt,
              offsetMinutes: 480,
              durationMinutes: e.durationMinutes,
              minRestMinutes: e.minRestMinutes,
              ...(u.id === "swiss" ? { planKey: round.planKey } : {}),
            });
          schedule.assignments.push({
            planKey: m.planKey,
            windowId,
            resourceId:
              "table-" +
              ((u.id.startsWith("g") ? Number(u.id.slice(1)) * 4 : 0) + i),
          });
          return { m, e };
        });
        const beforeOps = f.getVersion(),
          body = { expectedVersion: timeVersion, payload: schedule };
        const saved = await f.request(
          f.base + "/schedule",
          "PUT",
          body,
          f.cookie,
          "schedule-" + u.id + "-" + round.number,
        );
        assert.equal(saved.status, 200, JSON.stringify(saved.data));
        timeVersion = saved.data.data.version;
        assert.equal(
          (await f.request(f.base + "/runtime", "GET", undefined, f.cookie))
            .data.data.version,
          beforeOps,
        );
        for (const { m, e } of batch) {
          const scored = await f.request(
            f.base + "/matches/" + m.id + "/results",
            "PATCH",
            {
              expectedVersion: f.getVersion(),
              result: { kind: "score", scores: e.scores },
              reason: "固定种子独立期望",
            },
            f.cookie,
            "score-" + e.id,
          );
          assert.equal(scored.status, 200, JSON.stringify(scored.data));
          f.setVersion(scored.data.data.version);
          used.add(e.id);
          recorded.push(e);
        }
        await f.mutate(
          "/rounds/" + round.id + "/confirm",
          {},
          "confirm-" + u.id + "-" + round.number,
        );
        const after = (await view()).units.find((x) => x.id === u.id);
        if (u.id === "swiss") {
          const normalized = after.standings.map((r) => ({
            seed: seed(r.entrantId),
            wins: r.wins,
            losses: r.losses,
            points: r.points,
            netGames: r.netGames,
            opponents: r.opponents.map(seed),
            bhPoints: r.bhPoints,
            rank: r.rank,
          }));
          assert.deepEqual(
            normalized,
            expected.rounds[round.number - 1].standings,
            "独立逐轮BH/积分/净胜局/排名",
          );
        }
        if (after.status === "completed" && u.id.startsWith("g")) {
          const group = expected.groups.find((g) => g.id === u.id);
          assert.deepEqual(
            after.standings.map((r) => seed(r.entrantId)),
            group.ranking,
          );
          assert.deepEqual(
            after.qualified.map((r) => seed(r.entrantId)),
            group.qualified,
          );
        }
        if (u.stageId === "source") {
          const latest = await view(),
            sources = latest.units.filter((u) => u.stageId === "source");
          if (sources.some((u) => u.status !== "completed"))
            assert.ok(!latest.units.some((u) => u.stageId === "target"));
        }
      }
      const final = await view(),
        target = final.units.find((u) => u.stageId === "target");
      assert.equal(recorded.length, expected.matchCount);
      assert.equal(used.size, matches.length);
      assert.equal(seed(target.qualified[0].entrantId), expected.champion);
      assert.deepEqual(
        target.standings.map((r) => ({
          seed: seed(r.entrantId),
          rank: r.rank,
          wins: r.wins,
          actualLosses: r.actualLosses,
          netGames: r.netGames,
        })),
        shadow ? expected.knockoutStandings : expected.standings,
        "目标全名单的独立名次/实际败数/净胜局",
      );
      if (shadow)
        assert.deepEqual(
          final.units[0].qualified.map((r) => seed(r.entrantId)),
          expected.qualified,
        );
      else {
        assert.equal(
          seed(target.standings.find((r) => r.rank === 2).entrantId),
          expected.runnerUp,
        );
        assert.deepEqual(
          Object.fromEntries(
            target.standings.map((r) => [seed(r.entrantId), r.actualLosses]),
          ),
          expected.losses,
        );
        assert.equal(
          target.rounds
            .flatMap((r) => r.matches)
            .filter((m) => m.role === "final").length,
          expected.finalReset ? 2 : 1,
        );
      }
      const publicSchedule = (await f.request(f.base + "/schedule")).data.data;
      assert.equal(
        publicSchedule.schedule.assignments.length,
        expected.matchCount,
      );
      assert.equal(
        publicSchedule.validation.status,
        "ready",
        JSON.stringify(publicSchedule.validation),
      );
      assert.ok(!JSON.stringify(publicSchedule).includes('"actorId"'));
      assert.ok(!JSON.stringify(publicSchedule).includes('"userId"'));
      for (const a of publicSchedule.schedule.assignments) {
        const item = publicSchedule.items.find((m) => m.planKey === a.planKey);
        assert.ok(item);
        assert.deepEqual(
          publicSchedule.schedule.windows.find((w) => w.id === a.windowId),
          schedule.windows.find((w) => w.id === a.windowId),
          "计划UTC、offset与休息字段完整保留",
        );
        assert.ok(
          !item.actualStartedAt,
          "人工历史/演示裁定不能伪造实际开赛时间",
        );
      }
      assert.deepEqual(
        (await f.request(configPath, "GET", undefined, f.cookie)).data.data
          .snapshot,
        snapshot,
      );
      replay.push(recorded.sort((a, b) => a.id.localeCompare(b.id)));
      await f.close();
    }
    assert.deepEqual(
      replay[0],
      replay[1],
      "不同临时SQLite、随机实体ID，逐场对阵比分与计划时间应一致",
    );
  });
