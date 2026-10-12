"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { event } = require("./formats-v2-fixture");
const {
  draft,
  sources,
  stage,
  route,
} = require("../tournament-configuration/routing-v2-fixture");
test("PR5 real HTTP rejects duplicate export atomically and preview freezes named lower bindings", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid + "/configurations";
  const c = await f.request(
    base,
    "POST",
    { payload: draft() },
    f.cookie,
    "create",
  );
  assert.equal(c.status, 201);
  const id = c.data.data.id,
    path = base + "/" + id;
  const invalid = draft();
  invalid.stages.push(stage("U", 4, "single-cut-v2", 2, 1));
  invalid.routes.push(
    route(
      "duplicate",
      { stageId: "A", groupId: "Ag", port: "qualification" },
      { stageId: "U", groupId: "Ug" },
    ),
  );
  const rejected = await f.request(
    path,
    "PUT",
    { expectedVersion: 1, payload: invalid },
    f.cookie,
    "invalid",
  );
  assert.equal(rejected.status, 422);
  assert.ok(
    rejected.data.error.diagnostics.some((d) => d.code === "SELECTOR_OVERLAP"),
  );
  assert.equal(
    (await f.request(path, "GET", undefined, f.cookie)).data.data.version,
    1,
  );
  const p = await f.request(
    path + "/preview",
    "POST",
    { expectedVersion: 1, sources: sources(), targetIds: ["T"] },
    f.cookie,
  );
  assert.equal(p.status, 200);
  assert.equal(p.data.data.previewReady, true);
  assert.deepEqual(
    p.data.data.allocations.map((x) => [x.target.port, x.initialLosses]),
    Array.from({ length: 4 }, () => ["lower", 1]),
  );
  const frozen = await f.request(
    path + "/freeze",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "freeze",
  );
  assert.equal(frozen.status, 200);
  assert.equal(frozen.data.data.plan.connections.length, 2);
  assert.ok(
    frozen.data.data.plan.connections.every((x) => x.target.port === "lower"),
  );
  assert.deepEqual(
    (
      await f.request(
        path + "/freeze",
        "POST",
        { expectedVersion: 1 },
        f.cookie,
        "freeze",
      )
    ).data.data,
    frozen.data.data,
  );
});
test("PR5 HTTP pool-chain identity failure returns zero allocations and preserves draft", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid + "/configurations",
    c = draft();
  c.stages.push(stage("U", 4, "single-cut-v2", 2, 1));
  c.pools = [
    {
      id: "P",
      capacity: 2,
      sort: [{ field: "initialSeed", direction: "asc" }],
    },
  ];
  c.routes = [
    route(
      "a",
      { stageId: "A", groupId: "Ag", port: "qualification" },
      { poolId: "P" },
    ),
    route(
      "p",
      { poolId: "P", port: "seed" },
      { stageId: "T", groupId: "Tg", port: "lower" },
    ),
    route(
      "b",
      { stageId: "B", groupId: "Bg", port: "qualification" },
      { stageId: "U", groupId: "Ug" },
    ),
  ];
  const created = await f.request(
    base,
    "POST",
    { payload: c },
    f.cookie,
    "create",
  );
  assert.equal(created.status, 201);
  const s = sources();
  s.sourceSnapshots[1].entries[0].entrantId = "e1";
  const path = base + "/" + created.data.data.id,
    p = await f.request(
      path + "/preview",
      "POST",
      { expectedVersion: 1, sources: s, targetIds: ["T", "U"] },
      f.cookie,
    );
  assert.equal(p.status, 200);
  assert.equal(p.data.data.previewReady, false);
  assert.deepEqual(p.data.data.allocations, []);
  assert.ok(
    p.data.data.diagnostics.some((d) => d.code === "DUPLICATE_ENTRANT"),
  );
  const read = (await f.request(path, "GET", undefined, f.cookie)).data.data;
  assert.equal(read.version, 1);
  assert.equal(read.state, "draft");
});

test("PR5 HTTP independent upper/lower exports freeze distinct bindings and internal win/loss edges", async (t) => {
  const f = await event(t),
    base = "/tournaments/" + f.tid + "/configurations",
    c = draft();
  c.stages[0] = stage("A", 1, "de-lower-entry-v1", 8, 3);
  c.routes = [
    route(
      "a",
      { stageId: "A", groupId: "Ag", port: "upper" },
      { stageId: "T", groupId: "Tg", port: "upper" },
      1,
      1,
      [1],
    ),
    route(
      "b",
      { stageId: "A", groupId: "Ag", port: "lower" },
      { stageId: "T", groupId: "Tg", port: "lower" },
      1,
      2,
      [1, 2],
    ),
  ];
  const created = await f.request(
    base,
    "POST",
    { payload: c },
    f.cookie,
    "create",
  );
  assert.equal(created.status, 201);
  const s = sources();
  s.sourceSnapshots[0].entries = s.sourceSnapshots[0].entries.map((e, i) => ({
    ...e,
    qualification:
      i === 0
        ? { channel: "upper", index: 1 }
        : i < 3
          ? { channel: "lower", index: i }
          : undefined,
  }));
  const path = base + "/" + created.data.data.id,
    p = await f.request(
      path + "/preview",
      "POST",
      { expectedVersion: 1, sources: s, targetIds: ["T"] },
      f.cookie,
    );
  assert.equal(p.data.data.previewReady, true);
  assert.deepEqual(
    p.data.data.allocations.map((x) => [x.target.port, x.value]),
    [
      ["upper", 1],
      ["lower", 1],
      ["lower", 2],
    ],
  );
  const freeze = await f.request(
    path + "/freeze",
    "POST",
    { expectedVersion: 1 },
    f.cookie,
    "freeze",
  );
  assert.equal(freeze.status, 200);
  const u = freeze.data.data.plan.units.find((x) => x.groupId === "Ag"),
    opening = u.matches[0];
  assert.ok(
    u.matches.some((m) =>
      m.sources.some(
        (x) => x.kind === "winner" && x.matchKey === opening.planKey,
      ),
    ),
  );
  assert.ok(
    u.matches.some((m) =>
      m.sources.some(
        (x) => x.kind === "loser" && x.matchKey === opening.planKey,
      ),
    ),
  );
});
