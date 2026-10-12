"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { setupV2 } = require("./runtime-v2-fixture");
const { event } = require("./formats-v2-fixture");
const {
  parseStructure,
} = require("../../src/tournament-configuration/domain/structure");
const { read, save } = require("../../src/platform/operations/state");
const { randomUUID } = require("node:crypto");
const {
  digest,
} = require("../../src/tournament-configuration/domain/canonical");
const {
  pairingInput,
} = require("../../src/platform/operations/format-runners/swiss");
const {
  swissStandings,
} = require("../../src/platform/operations/format-runners/swiss-standings");
const {
  pairMajor,
} = require("../../src/platform/operations/format-runners/major-pairing");
function structure() {
  return parseStructure(
    {
      entrantKind: "individual",
      structureVersion: "structure-v2",
      routingVersion: "routing-v2",
      pools: [],
      routes: [],
      stages: [
        {
          id: "s",
          name: "Major lifecycle",
          order: 1,
          format: "threshold-swiss",
          ruleVersion: "major-cologne-2026-v1",
          parameters: { defaultBO: 1 },
          groups: [{ id: "g", stageId: "s" }],
        },
      ],
    },
    "T",
  );
}
test("Major explicit rematch HTTP verifies exhaustion, persists audit and keeps repeated-opponent DS through completion", async (t) => {
  const f = await setupV2(
    t,
    structure(),
    Array.from({ length: 16 }, () => null),
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
  const actor = f.entrants[0];
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: ["rounds.confirm"] },
    "grant",
  );
  const state = read(f.platform.db, f.tid),
    unit = state.runtime.units[0];
  const entrant = (seed) => f.entrants[seed - 1].entrantId;
  // Artificial consistent aggregate history, not a legal historical Major
  // claim. It exercises the otherwise rare API boundary for priority unsat.
  const history = [
    [
      [1, 4, 0],
      [2, 5, 0],
      [3, 6, 0],
      [13, 10, 0],
      [14, 11, 0],
      [7, 15, 0],
      [8, 12, 0],
      [9, 16, 0],
    ],
    [
      [1, 5, 1],
      [2, 6, 1],
      [3, 4, 1],
      [13, 7, 0],
      [14, 8, 0],
      [10, 16, 0],
      [11, 15, 0],
      [9, 12, 0],
    ],
    [
      [1, 6, 0],
      [2, 4, 0],
      [3, 5, 0],
      [13, 9, 0],
      [14, 10, 0],
      [7, 16, 0],
      [8, 15, 0],
      [11, 12, 1],
    ],
    [
      [1, 7, 1],
      [2, 8, 1],
      [3, 9, 1],
      [4, 10, 0],
      [5, 11, 0],
      [6, 12, 0],
    ],
  ];
  unit.rounds = history.map((pairs, i) => ({
    id: randomUUID(),
    number: i + 1,
    confirmed: true,
    planKey: unit.plan.windows[i].planKey,
    pairing: { version: unit.ruleVersion, rematch: false },
    matches: pairs.map(([a, b, side], j) => ({
      id: randomUUID(),
      planKey: unit.plan.windows[i].planKey + "/match/" + (j + 1),
      bestOf: 1,
      entrants: [entrant(a), entrant(b)],
      bye: false,
      submissions: [],
      decision: { kind: "score", scores: side ? [0, 1] : [1, 0] },
    })),
  }));
  unit.standings = swissStandings(unit);
  unit.status = "pairing-blocked";
  unit.pairingInputVersion = 4;
  const input = pairingInput(unit),
    exhausted = pairMajor(input.rows, input);
  assert.equal(exhausted.status, "unsat");
  unit.pairingInputHash = digest(input);
  unit.pairingBlock = {
    code: exhausted.code,
    round: 5,
    nodes: exhausted.nodes,
  };
  save(f.platform.db, f.tid, state);
  const endpoint = f.base + "/units/" + unit.id + "/pairing";
  const body = {
    expectedVersion: f.getVersion(),
    inputVersion: 4,
    inputHash: unit.pairingInputHash,
    pairs: [
      [1, 4],
      [2, 5],
      [3, 6],
    ].map((p) => p.map(entrant)),
    bye: null,
    reason: "完整核验优先表后明确允许重赛",
    allowRematch: true,
  };
  assert.equal(
    (
      await f.request(
        endpoint,
        "POST",
        { ...body, allowRematch: false },
        actor.cookie,
        "no-consent",
      )
    ).status,
    422,
  );
  const out = await f.request(
    endpoint,
    "POST",
    body,
    actor.cookie,
    "approved-rematch",
  );
  assert.equal(out.status, 200, JSON.stringify(out.data));
  f.setVersion(out.data.data.version);
  const paired = read(f.platform.db, f.tid).runtime.units[0].rounds.at(-1);
  assert.equal(paired.pairing.rematch, true);
  assert.equal(paired.pairing.decision.actorId, actor.userId);
  assert.equal(paired.pairing.decision.reason, body.reason);
  for (const match of paired.matches) {
    assert.equal(match.bestOf, 3);
    const result = await f.request(
      f.base + "/matches/" + match.id + "/results",
      "PATCH",
      {
        expectedVersion: f.getVersion(),
        result: { kind: "score", scores: [2, 0] },
        reason: "人工边界输入的最终系列比分",
      },
      f.cookie,
      "result-" + match.id,
    );
    assert.equal(result.status, 200, JSON.stringify(result.data));
    f.setVersion(result.data.data.version);
  }
  await f.mutate("/rounds/" + paired.id + "/confirm", {}, "finish");
  const complete = read(f.platform.db, f.tid).runtime.units[0];
  assert.equal(complete.status, "completed");
  assert.equal(complete.qualified.length, 8);
  const row = complete.standings.find((r) => r.entrantId === entrant(1));
  assert.equal(row.opponents.filter((id) => id === entrant(4)).length, 2);
  assert.equal(
    row.ds,
    row.opponents.reduce((n, id) => {
      const opponent = complete.standings.find((r) => r.entrantId === id);
      return n + opponent.wins - opponent.losses;
    }, 0),
  );
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: [] },
    "revoke",
  );
  assert.equal(
    (await f.request(endpoint, "POST", body, actor.cookie, "approved-rematch"))
      .status,
    403,
  );
});
test("Major manual HTTP binds input, rolls back failed writes and rechecks current revoked role on cached replay", async (t) => {
  const f = await setupV2(
    t,
    structure(),
    Array.from({ length: 16 }, () => null),
  );
  await f.mutate("/start", { configurationId: f.cid }, "start");
  const actor = f.entrants[0];
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: ["rounds.confirm"] },
    "grant",
  );
  const state = read(f.platform.db, f.tid),
    unit = state.runtime.units[0];
  const pairs = unit.rounds[0].matches.map((m) => m.entrants);
  // Isolated fixture represents a budget-blocked first window, not a claim
  // that the trivial official first table naturally exhausts the solver.
  unit.rounds = [];
  unit.status = "pairing-blocked";
  unit.pairingBlock = { code: "PAIRING_SOLVER_LIMIT", round: 1, nodes: 250001 };
  save(f.platform.db, f.tid, state);
  const endpoint = f.base + "/units/" + unit.id + "/pairing";
  const body = {
    expectedVersion: f.getVersion(),
    inputVersion: unit.pairingInputVersion,
    inputHash: unit.pairingInputHash,
    pairs,
    bye: null,
    allowRematch: false,
    reason: "Major冻结首轮表完整确认",
  };
  assert.equal(
    (
      await f.request(
        endpoint,
        "POST",
        { ...body, inputHash: "stale" },
        actor.cookie,
        "stale",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        endpoint,
        "POST",
        { ...body, allowRematch: true },
        actor.cookie,
        "illegal-exception",
      )
    ).status,
    422,
  );
  f.platform.db.exec(
    "CREATE TRIGGER fail_major BEFORE UPDATE ON operations_aggregates BEGIN SELECT RAISE(ABORT,'injected'); END;",
  );
  assert.equal(
    (await f.request(endpoint, "POST", body, actor.cookie, "major-manual"))
      .status,
    503,
  );
  assert.deepEqual(read(f.platform.db, f.tid), state);
  f.platform.db.exec("DROP TRIGGER fail_major");
  const out = await f.request(
    endpoint,
    "POST",
    body,
    actor.cookie,
    "major-manual",
  );
  assert.equal(out.status, 200, JSON.stringify(out.data));
  f.setVersion(out.data.data.version);
  assert.deepEqual(
    (await f.request(endpoint, "POST", body, actor.cookie, "major-manual")).data
      .data,
    out.data.data,
  );
  const written = read(f.platform.db, f.tid).runtime.units[0].rounds[0].pairing;
  assert.equal(written.version, "major-cologne-2026-v1");
  assert.equal(written.decision.actorId, actor.userId);
  assert.equal(written.rematch, false);
  const publicRuntime = (await f.request(f.base + "/runtime")).data.data
    .runtime;
  assert.ok(!JSON.stringify(publicRuntime).includes('"actorId"'));
  await f.mutate(
    "/collaborators",
    { userId: actor.userId, permissions: [] },
    "revoke",
  );
  const revoked = read(f.platform.db, f.tid);
  assert.equal(
    (await f.request(endpoint, "POST", body, actor.cookie, "major-manual"))
      .status,
    403,
  );
  assert.deepEqual(read(f.platform.db, f.tid), revoked);
});
test("Major frozen plan, input digest, submitted result and idempotency survive a real app restart", async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "race-major-restart-"),
  );
  const databasePath = path.join(directory, "major.sqlite");
  let original, resumed;
  t.after(async () => {
    if (original) await original.close();
    if (resumed) await resumed.close();
    for (const name of fs.readdirSync(directory))
      fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  });
  original = await setupV2(
    t,
    structure(),
    Array.from({ length: 16 }, () => null),
    { databasePath },
  );
  await original.mutate("/start", { configurationId: original.cid }, "start");
  const before = read(original.platform.db, original.tid),
    unit = before.runtime.units[0],
    match = unit.rounds[0].matches[0];
  const endpoint = original.base + "/matches/" + match.id + "/results";
  const body = {
    expectedVersion: original.getVersion(),
    result: { kind: "score", scores: [1, 0] },
    reason: "Major重启前的完整系列比分",
  };
  const scored = await original.request(
    endpoint,
    "PATCH",
    body,
    original.cookie,
    "persistent-score",
  );
  assert.equal(scored.status, 200, JSON.stringify(scored.data));
  const persisted = read(original.platform.db, original.tid);
  await original.close();
  // Keep the synthetic test clock forward so persisted rate limits are not
  // reinterpreted as future login attempts after reopening the fixture.
  resumed = await event(t, {
    databasePath,
    now: () => Date.now() + 60 * 60 * 1000,
  });
  assert.equal(resumed.tid, original.tid);
  assert.deepEqual(read(resumed.platform.db, resumed.tid), persisted);
  const replay = await resumed.request(
    endpoint,
    "PATCH",
    body,
    resumed.cookie,
    "persistent-score",
  );
  assert.equal(replay.status, 200, JSON.stringify(replay.data));
  assert.deepEqual(replay.data.data, scored.data.data);
  assert.equal(
    (
      await resumed.request(
        endpoint,
        "PATCH",
        { ...body, reason: "改变重放内容" },
        resumed.cookie,
        "persistent-score",
      )
    ).status,
    409,
  );
  const current = read(resumed.platform.db, resumed.tid);
  assert.deepEqual(current, persisted);
  assert.equal(
    current.runtime.units[0].pairingInputHash,
    unit.pairingInputHash,
  );
  assert.equal(current.runtime.units[0].ruleVersion, "major-cologne-2026-v1");
  assert.equal(
    current.runtime.units[0].rounds[0].matches[0].decision.scores[0],
    1,
  );
});
