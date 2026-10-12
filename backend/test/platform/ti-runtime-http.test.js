"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const source = require("../fixtures/ti2026-official-observations-v1.json");
const { setupV2 } = require("./runtime-v2-fixture");
const { read, save } = require("../../src/platform/operations/state");
const {
  createTiCandidateUnit,
} = require("../../src/platform/operations/format-runners/ti-unit-candidate");
const rule = "ti2026-observed-candidate-v1";
async function fixture(t, options = {}, playoffs = false) {
  const structure = {
    entrantKind: "individual",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [
      {
        id: "s",
        name: "TI候选",
        order: 1,
        format: "threshold-swiss",
        ruleVersion: rule,
        groups: [{ id: "g", stageId: "s" }],
      },
    ],
    pools: [],
    routes: [],
  };
  if (playoffs) {
    structure.stages.push({
      id: "po",
      name: "TI观察槽位双败",
      order: 2,
      format: "double-elimination",
      ruleVersion: "de-standard-v1",
      groupSize: 8,
      groupCount: 1,
      qualifyCount: 1,
      parameters: {
        seeding: { kind: "slot", seedTableVersion: "recursive-v1" },
        overrides: { final: 5 },
      },
      groups: [{ id: "de", stageId: "po" }],
    });
    structure.routes = [3, 5, 7, 2, 1, 8, 4, 6].map((slot, i) => ({
      id: "q-" + i,
      source: { stageId: "s", groupId: "g", port: "qualification" },
      target: { stageId: "po", groupId: "de", port: "upper" },
      selector: { kind: "rankRange", from: i + 1, to: i + 1 },
      quota: 1,
      sort: [{ field: "sourceRank", direction: "asc" }],
      placement: { kind: "slot", positions: [slot] },
    }));
  }
  const f = await setupV2(t, structure, Array(16).fill(null), options);
  const unavailable = await f.request(
    f.base + "/start",
    "POST",
    { expectedVersion: f.getVersion(), configurationId: f.cid },
    f.cookie,
    "candidate-start-unavailable",
  );
  assert.equal(unavailable.status, 501, JSON.stringify(unavailable.data));
  assert.equal(unavailable.data.error.code, "RUN_NOT_SUPPORTED");
  const configuration = (
    await f.request(
      f.base + "/configurations/" + f.cid,
      "GET",
      undefined,
      f.cookie,
    )
  ).data.data;
  const originalIds = [...source.observedInitialPairing.matches]
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel))
    .flatMap((m) => m.entrantIds.map(String));
  const ids = new Map(
    originalIds.map((id, i) => [id, f.entrants[i].entrantId]),
  );
  const entries = originalIds.map((id, i) => ({
    entrantId: ids.get(id),
    position: i + 1,
    positionKind: "slot",
    channel: "slot",
    initialSeed: i + 1,
  }));
  const unit = createTiCandidateUnit(
    configuration.snapshot.plan.units[0],
    entries,
  );
  const state = read(f.platform.db, f.tid);
  // Isolated injected candidate, not a claim that public /start supports TI.
  state.runtime = {
    version: "runtime-rules-v2",
    status: "running",
    tournamentId: f.tid,
    configurationId: f.cid,
    plan: configuration.snapshot.plan,
    structure: configuration.snapshot.structure,
    roster: f.entrants.map((e, i) => ({
      entrantId: e.entrantId,
      userId: e.userId,
      name: originalIds[i],
      exitState: "active",
      initialSeed: i + 1,
      entryRef: {
        configurationId: f.cid,
        stageId: "s",
        groupId: "g",
        port: "slot",
        positionKind: "slot",
        position: i + 1,
      },
    })),
    units: [unit],
    blocked: [],
    waiting: [],
  };
  save(f.platform.db, f.tid, state);
  const current = () => read(f.platform.db, f.tid).runtime.units[0];
  const result = (m, phase = "Swiss") => {
    const actual = source.phases
      .find((p) => p.name === phase)
      .matches.find((a) =>
        a.entrantIds.every((id) => m.entrants.includes(ids.get(String(id)))),
      );
    assert.ok(actual);
    return {
      kind: "score",
      scores: m.entrants.map(
        (id) =>
          actual.scores[
            actual.entrantIds.findIndex(
              (original) => ids.get(String(original)) === id,
            )
          ],
      ),
      ...(phase === "Swiss"
        ? {
            seriesId: String(actual.seriesId),
            games: actual.games.map((g) => ({
              matchId: g.matchId,
              winnerId: ids.get(String(g.winnerId)),
              durationSeconds: g.durationSeconds,
            })),
          }
        : {}),
    };
  };
  const confirm = async (key) => {
    const u = current();
    return f.mutate(
      "/rounds/" + u.rounds.at(-1).id + "/confirm",
      {
        inputVersion: u.version,
        inputHash: u.inputHash,
        reason: "候选工程确认，非历史时间",
      },
      key,
    );
  };
  return { ...f, ids, current, result, confirm };
}
test("TI injected candidate HTTP runs 58 observed series through Swiss, elimination qualification routing and playoffs", async (t) => {
  const f = await fixture(t, {}, true);
  for (let round = 1; round <= 5; round++) {
    for (const m of f.current().rounds.at(-1).matches)
      await f.mutate(
        "/matches/" + m.id + "/results",
        { result: f.result(m), reason: "核对逐局数据" },
        m.id,
      );
    // Owner submissions are not an implicit adjudication.
    for (const m of f.current().rounds.at(-1).matches) {
      const r = await f.request(
        f.base + "/matches/" + m.id + "/results",
        "PATCH",
        {
          expectedVersion: f.getVersion(),
          result: f.result(m),
          reason: "核对逐局裁定",
        },
        f.cookie,
        "judge-" + m.id,
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
      f.setVersion(r.data.data.version);
    }
    const r = await f.confirm("confirm-" + round);
    assert.equal(
      (
        await f.request(
          f.base + "/rounds/" + f.current().rounds[round - 1].id + "/confirm",
          "POST",
          {
            expectedVersion: r.version - 1,
            inputVersion: f.current().version - 1,
            inputHash: "unused",
            reason: "different",
          },
          f.cookie,
          "locked-other-" + round,
        )
      ).status,
      409,
    );
  }
  assert.equal(f.current().status, "choosing-elimination");
  assert.equal(f.current().confirmedSeries.length, 39);
  for (const chooser of f.current().elimination.choosers) {
    const actual = source.phases
      .find((p) => p.name === "Elimination Round")
      .matches.find((m) =>
        m.entrantIds.includes(
          Number([...f.ids].find(([, id]) => id === chooser.entrantId)[0]),
        ),
      );
    const u = f.current();
    await f.mutate(
      "/units/g/ti-opponent",
      {
        inputVersion: u.version,
        inputHash: u.inputHash,
        chooserId: chooser.entrantId,
        opponentId: actual.entrantIds
          .map((id) => f.ids.get(String(id)))
          .find((id) => id !== chooser.entrantId),
        reason: "与观察结果兼容的工程选择",
      },
      "choose-" + chooser.entrantId,
    );
  }
  for (const m of f.current().rounds.at(-1).matches) {
    const r = await f.request(
      f.base + "/matches/" + m.id + "/results",
      "PATCH",
      {
        expectedVersion: f.getVersion(),
        result: f.result(m, "Elimination Round"),
        reason: "附加赛裁定",
      },
      f.cookie,
      m.id,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    f.setVersion(r.data.data.version);
  }
  await f.confirm("finish");
  assert.equal(f.current().status, "completed");
  assert.deepEqual(
    f.current().qualified.map((q) => q.swissRank),
    [1, 2, 3, 4, 5, 6, 9, 11],
  );
  assert.equal(f.current().rounds.flatMap((r) => r.matches).length, 44);
  const remaining = structuredClone(
    source.phases.find((p) => p.name === "Playoff").matches,
  );
  while (read(f.platform.db, f.tid).runtime.units[1]?.status === "running") {
    const po = read(f.platform.db, f.tid).runtime.units[1],
      round = po.rounds.find((r) => !r.confirmed);
    for (const m of round.matches) {
      const index = remaining.findIndex(
        (a) =>
          a.entrantIds.every((id) =>
            m.entrants.includes(f.ids.get(String(id))),
          ) && (a.nodeType === 3 ? 5 : 3) === m.bestOf,
      );
      assert.notEqual(index, -1);
      const actual = remaining.splice(index, 1)[0],
        scores = m.entrants.map(
          (id) =>
            actual.scores[
              actual.entrantIds.findIndex(
                (original) => f.ids.get(String(original)) === id,
              )
            ],
        );
      const r = await f.request(
        f.base + "/matches/" + m.id + "/results",
        "PATCH",
        {
          expectedVersion: f.getVersion(),
          result: { kind: "score", scores },
          reason: "主赛观察回放",
        },
        f.cookie,
        "po-" + m.id,
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
      f.setVersion(r.data.data.version);
    }
    await f.mutate(
      "/rounds/" + round.id + "/confirm",
      {},
      "po-confirm-" + round.id,
    );
  }
  const final = read(f.platform.db, f.tid).runtime;
  assert.equal(final.units.length, 2, JSON.stringify(final.blocked));
  assert.equal(remaining.length, 0);
  assert.equal(final.status, "completed");
  assert.equal(final.units[1].rounds.flatMap((r) => r.matches).length, 14);
  assert.equal(
    final.units[1].standings.find((r) => r.rank === 1).entrantId,
    f.ids.get("7119388"),
  );
  const publicData = (await f.request(f.base + "/runtime")).data.data.runtime;
  assert.equal(JSON.stringify(publicData).includes('"actorId"'), false);
  assert.equal(JSON.stringify(publicData).includes('"userId"'), false);
});
test("TI cached delegated submission and confirmation recheck current authorization", async (t) => {
  const f = await fixture(t),
    actor = f.entrants[15],
    first = f.current().rounds[0].matches[0];
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: ["results.edit", "rounds.confirm"] },
    "grant-ti",
  );
  const path = f.base + "/matches/" + first.id + "/results",
    body = { expectedVersion: f.getVersion(), result: f.result(first) };
  const accepted = await f.request(
    path,
    "POST",
    body,
    actor.cookie,
    "delegated-submit",
  );
  assert.equal(accepted.status, 200);
  f.setVersion(accepted.data.data.version);
  const removed = await f.request(
    f.base + "/collaborators/" + actor.userId,
    "DELETE",
    { expectedVersion: f.getVersion() },
    f.cookie,
    "revoke-ti",
  );
  assert.equal(removed.status, 200);
  f.setVersion(removed.data.data.version);
  assert.equal(
    (await f.request(path, "POST", body, actor.cookie, "delegated-submit"))
      .status,
    403,
  );
  assert.equal(
    (
      await f.request(
        path,
        "PATCH",
        {
          expectedVersion: f.getVersion(),
          result: f.result(first),
          reason: "无权",
        },
        actor.cookie,
        "no-judge",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(
        f.base + "/units/g/ti-opponent",
        "POST",
        {
          expectedVersion: f.getVersion(),
          inputVersion: f.current().version,
          inputHash: f.current().inputHash,
          chooserId: "x",
          opponentId: "y",
          reason: "无权",
        },
        actor.cookie,
        "no-choice",
      )
    ).status,
    403,
  );
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: ["rounds.confirm"] },
    "grant-confirm",
  );
  for (const m of f.current().rounds[0].matches) {
    const r = await f.request(
      f.base + "/matches/" + m.id + "/results",
      "PATCH",
      { expectedVersion: f.getVersion(), result: f.result(m), reason: "齐备" },
      f.cookie,
      "judge-" + m.id,
    );
    assert.equal(r.status, 200);
    f.setVersion(r.data.data.version);
  }
  const u = f.current(),
    confirmPath = f.base + "/rounds/" + u.rounds[0].id + "/confirm",
    confirmBody = {
      expectedVersion: f.getVersion(),
      inputVersion: u.version,
      inputHash: u.inputHash,
      reason: "确认",
    };
  const ok = await f.request(
    confirmPath,
    "POST",
    confirmBody,
    actor.cookie,
    "delegated-confirm",
  );
  assert.equal(ok.status, 200);
  f.setVersion(ok.data.data.version);
  const revoked = await f.request(
    f.base + "/collaborators/" + actor.userId,
    "DELETE",
    { expectedVersion: f.getVersion() },
    f.cookie,
    "revoke-confirm",
  );
  assert.equal(revoked.status, 200);
  assert.equal(
    (
      await f.request(
        confirmPath,
        "POST",
        confirmBody,
        actor.cookie,
        "delegated-confirm",
      )
    ).status,
    403,
  );
  const publicRuntime = (await f.request(f.base + "/runtime")).data.data
    .runtime;
  assert.equal(JSON.stringify(publicRuntime).includes(actor.userId), false);
});
test("TI game metadata, input digest and cached result survive a real temporary SQLite restart", async (t) => {
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path"),
    { event } = require("./formats-v2-fixture");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "race-ti-restart-")),
    databasePath = path.join(directory, "ti.sqlite");
  let original, resumed;
  t.after(async () => {
    if (original) await original.close();
    if (resumed) await resumed.close();
    for (const name of fs.readdirSync(directory))
      fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  });
  original = await fixture(t, { databasePath });
  const m = original.current().rounds[0].matches[0],
    endpoint = original.base + "/matches/" + m.id + "/results",
    body = {
      expectedVersion: original.getVersion(),
      result: original.result(m),
      reason: "重启前逐局裁定",
    };
  const first = await original.request(
    endpoint,
    "PATCH",
    body,
    original.cookie,
    "persist-ti-result",
  );
  assert.equal(first.status, 200);
  const stored = read(original.platform.db, original.tid),
    snapshot = stored.runtime.units[0];
  await original.close();
  resumed = await event(t, {
    databasePath,
    now: () => Date.now() + 4 * 60 * 60 * 1000,
  });
  assert.deepEqual(
    read(resumed.platform.db, original.tid).runtime.units[0],
    snapshot,
  );
  const replay = await resumed.request(
    endpoint,
    "PATCH",
    body,
    resumed.cookie,
    "persist-ti-result",
  );
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.data.data, first.data.data);
  assert.equal(
    (
      await resumed.request(
        endpoint,
        "PATCH",
        { ...body, reason: "改动" },
        resumed.cookie,
        "persist-ti-result",
      )
    ).status,
    409,
  );
  const runtime = (
    await resumed.request(
      original.base + "/runtime",
      "GET",
      undefined,
      resumed.cookie,
    )
  ).data.data.runtime;
  assert.deepEqual(
    runtime.units[0].rounds[0].matches[0].decision.games,
    body.result.games,
  );
  assert.equal(runtime.units[0].inputHash, snapshot.inputHash);
});
test("TI actual-start seals the current input and generic Swiss adjudication remains unavailable", async (t) => {
  const f = await fixture(t),
    u = f.current(),
    m = u.rounds[0].matches[0];
  for (const operation of ["pairing", "ranking"]) {
    const body =
      operation === "pairing"
        ? {
            inputVersion: 0,
            inputHash: u.inputHash,
            pairs: [],
            bye: null,
            reason: "不能代替",
          }
        : { order: [], reason: "不能代替" };
    assert.equal(
      (
        await f.request(
          f.base + "/units/g/" + operation,
          "POST",
          { expectedVersion: f.getVersion(), ...body },
          f.cookie,
          "generic-" + operation,
        )
      ).status,
      501,
    );
  }
  const path = f.base + "/matches/" + m.id + "/actual-start",
    startedAt = new Date().toISOString();
  await f.mutate(
    "/matches/" + m.id + "/actual-start",
    { actualStartedAt: startedAt },
    "ti-started",
  );
  assert.equal(f.current().rounds[0].matches[0].actualStartedAt, startedAt);
  assert.equal(f.current().version, u.version + 1);
  assert.notEqual(f.current().inputHash, u.inputHash);
  const before = read(f.platform.db, f.tid);
  assert.equal(
    (
      await f.request(
        path,
        "POST",
        {
          expectedVersion: f.getVersion(),
          actualStartedAt: "2100-01-01T00:00:00.000Z",
        },
        f.cookie,
        "future-start",
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await f.request(
        path,
        "POST",
        {
          expectedVersion: f.getVersion(),
          actualStartedAt: "2000-01-01T00:00:00.000Z",
        },
        f.cookie,
        "replace-start",
      )
    ).status,
    409,
  );
  assert.deepEqual(read(f.platform.db, f.tid), before);
});
test("TI HTTP invalid metadata, incomplete confirmation, stale hash and SQL rollback remain atomic", async (t) => {
  const f = await fixture(t),
    u = f.current(),
    m = u.rounds[0].matches[0],
    before = read(f.platform.db, f.tid);
  const patch = (result) =>
    f.request(
      f.base + "/matches/" + m.id + "/results",
      "PATCH",
      { expectedVersion: f.getVersion(), result, reason: "验证" },
      f.cookie,
      "invalid",
    );
  assert.equal((await patch({ kind: "score", scores: [2, 0] })).status, 422);
  assert.deepEqual(read(f.platform.db, f.tid), before);
  assert.equal(
    (
      await f.request(
        f.base + "/rounds/" + u.rounds[0].id + "/confirm",
        "POST",
        {
          expectedVersion: f.getVersion(),
          inputVersion: u.version,
          inputHash: u.inputHash,
          reason: "不齐",
        },
        f.cookie,
        "incomplete",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        f.base + "/rounds/" + u.rounds[0].id + "/confirm",
        "POST",
        {
          expectedVersion: f.getVersion(),
          inputVersion: u.version,
          inputHash: "old",
          reason: "旧摘要",
        },
        f.cookie,
        "stale",
      )
    ).status,
    409,
  );
  f.platform.db.exec(
    "CREATE TRIGGER fail_ti BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  const good = {
    expectedVersion: f.getVersion(),
    result: f.result(m),
    reason: "逐局裁定",
  };
  assert.equal(
    (
      await f.request(
        f.base + "/matches/" + m.id + "/results",
        "PATCH",
        good,
        f.cookie,
        "retry-result",
      )
    ).status,
    503,
  );
  assert.deepEqual(read(f.platform.db, f.tid), before);
  f.platform.db.exec("DROP TRIGGER fail_ti");
  const r = await f.request(
    f.base + "/matches/" + m.id + "/results",
    "PATCH",
    good,
    f.cookie,
    "retry-result",
  );
  assert.equal(r.status, 200);
  assert.deepEqual(
    (
      await f.request(
        f.base + "/matches/" + m.id + "/results",
        "PATCH",
        good,
        f.cookie,
        "retry-result",
      )
    ).data.data,
    r.data.data,
  );
  assert.notEqual(f.current().inputHash, u.inputHash);
});
