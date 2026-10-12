"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  parseStructure,
} = require("../../src/tournament-configuration/domain/structure");
const {
  validateStructure,
} = require("../../src/tournament-configuration/domain/validation");
const {
  previewRouting,
} = require("../../src/tournament-configuration/domain/routing");
const { draft, sources, stage, route } = require("./routing-v2-fixture");
test("ER4 v2 numeric points must be exact safe integers; fractional or rounded large numbers reject", () => {
  for (const points of [1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const sample = sources();
    sample.sourceSnapshots[0].entries[0].points = points;
    const out = previewRouting(parseStructure(draft(), "T"), sample, "T");
    assert.equal(out.previewReady, false);
    assert.deepEqual(out.allocations, []);
    assert.ok(
      out.diagnostics.some(
        (d) => d.code === "INVALID_INPUT" && d.path.endsWith("/points"),
      ),
    );
  }
});
test("ER4 v2 routing orders exact large decimal points without rounding or lexical comparison", () => {
  const c = draft(),
    sample = sources();
  c.routes[0].sort = [
    { field: "points", direction: "desc" },
    { field: "initialSeed", direction: "asc" },
  ];
  sample.sourceSnapshots[0].entries.forEach(
    (e, i) =>
      (e.points =
        i === 0 ? "9007199254740992" : i === 1 ? "9007199254740993" : 0),
  );
  const out = previewRouting(parseStructure(c, "T"), sample, "T");
  assert.equal(out.previewReady, true);
  assert.deepEqual(
    out.allocations.slice(0, 2).map((e) => e.entrantId),
    ["e2", "e1"],
  );
});
test("PR5 named lower capacity and provenance preserve four independent seats", () => {
  const c = parseStructure(draft(), "T");
  assert.equal(validateStructure(c, "T").structureValid, true);
  const p = previewRouting(c, sources(), "T");
  assert.equal(p.previewReady, true);
  assert.deepEqual(
    p.allocations.map((x) => [
      x.entrantId,
      x.target.port,
      x.value,
      x.initialLosses,
    ]),
    [
      ["e1", "lower", 1, 1],
      ["e2", "lower", 2, 1],
      ["e5", "lower", 3, 1],
      ["e6", "lower", 4, 1],
    ],
  );
});
test("PR5 source quota is consumed once across targets and lower has own capacity", () => {
  const c = draft();
  c.stages.push(stage("U", 4, "single-cut-v2", 2, 1));
  c.routes.push(
    route(
      "duplicate",
      { stageId: "A", groupId: "Ag", port: "qualification" },
      { stageId: "U", groupId: "Ug" },
      1,
      2,
    ),
  );
  assert.ok(
    validateStructure(c, "T").diagnostics.some(
      (d) => d.code === "SELECTOR_OVERLAP",
    ),
  );
  const bad = draft();
  bad.routes[1].placement.positions = [4, 5];
  assert.ok(
    validateStructure(bad, "T").diagnostics.some(
      (d) => d.code === "POSITION_INVALID",
    ),
  );
});
test("PR5 upper and lower output/target slots are independent; mixed position kinds within one port reject", () => {
  const c = draft();
  c.stages[0] = stage("A", 1, "de-lower-entry-v1", 8, 3);
  c.routes[0] = route(
    "a",
    { stageId: "A", groupId: "Ag", port: "upper" },
    { stageId: "T", groupId: "Tg", port: "upper" },
    1,
    1,
    [1],
  );
  c.routes[1] = route(
    "b",
    { stageId: "A", groupId: "Ag", port: "lower" },
    { stageId: "T", groupId: "Tg", port: "lower" },
    1,
    1,
    [1],
  );

  assert.equal(validateStructure(c, "T").structureValid, true);
  c.routes[1].target.port = "upper";
  assert.ok(
    validateStructure(c, "T").diagnostics.some(
      (d) => d.code === "POSITION_CONFLICT",
    ),
  );
});
test("PR5 qualified set cannot silently become competitive ranks", () => {
  const c = draft();
  c.stages[0] = stage("A", 1, "single-cut-v2", 8, 4);
  c.routes[0].source.port = "rank";
  assert.ok(
    validateStructure(c, "T").diagnostics.some(
      (d) => d.code === "OUTPUT_PORT_INVALID",
    ),
  );
});
test("PR5 direct and pool chain duplication across active target stages is atomic", () => {
  const c = draft();
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
  const s = sources();
  s.sourceSnapshots[1].entries[0].entrantId = "e1";
  const p = previewRouting(c, s, "T", ["T", "U"]);
  assert.equal(p.previewReady, false);
  assert.deepEqual(p.allocations, []);
  assert.ok(p.diagnostics.some((d) => d.code === "DUPLICATE_ENTRANT"));
});
test("PR5 pool seeds support non-overlapping ranges and strict unknown ports reject", () => {
  const c = draft();
  c.pools = [
    {
      id: "P",
      capacity: 4,
      sort: [{ field: "initialSeed", direction: "asc" }],
    },
  ];
  c.routes[0].target = { poolId: "P" };
  delete c.routes[0].placement;
  c.routes[1].target = { poolId: "P" };
  delete c.routes[1].placement;
  c.routes.push(
    route(
      "first",
      { poolId: "P", port: "seed" },
      { stageId: "T", groupId: "Tg", port: "upper" },
      1,
      2,
    ),
  );
  c.routes.push(
    route(
      "last",
      { poolId: "P", port: "seed" },
      { stageId: "T", groupId: "Tg", port: "lower" },
      3,
      4,
    ),
  );
  const p = previewRouting(c, sources(), "T");
  assert.equal(p.previewReady, true);
  assert.equal(p.allocations.length, 4);
  c.routes[0].source.port = "invented";
  assert.throws(() => parseStructure(c, "T"), { code: "INVALID_INPUT" });
});

test("PR5 explicit slot placement remains valid while seed and slot share one ordinary capacity", () => {
  const c = draft();
  c.stages[2] = stage("T", 3, "single-cut-v2", 8, 1);
  c.routes[0].target = { stageId: "T", groupId: "Tg", port: "slot" };
  c.routes[0].placement.kind = "slot";
  c.routes[1].target = { stageId: "T", groupId: "Tg", port: "slot" };
  c.routes[1].placement.kind = "slot";
  assert.equal(validateStructure(c, "T").structureValid, true);
  c.routes[1].target.port = "seed";
  c.routes[1].placement.kind = "seed";
  assert.ok(
    validateStructure(c, "T").diagnostics.some(
      (d) => d.code === "PLACEMENT_KIND_CONFLICT",
    ),
  );
});
test("PR5 qualification-only snapshots never fabricate rank for sort", () => {
  const c = draft(),
    s = sources();
  s.sourceSnapshots.forEach((x) => x.entries.forEach((e) => delete e.rank));
  assert.equal(previewRouting(c, s, "T").previewReady, true);
  c.routes[0].sort = [{ field: "sourceRank", direction: "asc" }];
  const p = previewRouting(c, s, "T");
  assert.equal(p.previewReady, false);
  assert.deepEqual(p.allocations, []);
});

test("PR5 missing placement is a validation error and cannot reach a frozen runtime plan", () => {
  const c = draft();
  delete c.routes[0].placement;
  const report = validateStructure(c, "T");
  assert.equal(report.structureValid, false);
  assert.ok(
    report.diagnostics.some(
      (d) => d.code === "CONFIG_REQUIRED" && d.path === "/routes/0/placement",
    ),
  );
  assert.throws(
    () =>
      require("../../src/tournament-configuration/domain/formats/compile").compile(
        c,
        { configurationId: "c", tournamentId: "T" },
      ),
    { code: "CONFIG_INVALID" },
  );
});
