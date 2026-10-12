"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  definition,
} = require("../../src/tournament-configuration/domain/formats/registry");
const {
  parseStructure,
} = require("../../src/tournament-configuration/domain/structure");
const {
  validateStructure,
} = require("../../src/tournament-configuration/domain/validation");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const { buildItems } = require("../../src/platform/schedule/items");
const rule = "ti2026-observed-candidate-v1";
const draft = () => ({
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
});
test("TI candidate plan remains explicitly unavailable for runtime", () => {
  const def = definition(rule);
  assert.ok(def);
  assert.equal(def.runtimeReady, false);
  assert.equal(def.unavailableReason, "FORMAT_RUNTIME_UNAVAILABLE");
  const s = parseStructure(draft(), "T").stages[0];
  assert.deepEqual(
    [
      s.groupSize,
      s.qualifyCount,
      s.parameters.roundCount,
      s.parameters.defaultBO,
    ],
    [16, 8, 5, 3],
  );
  assert.deepEqual(s.parameters.seeding, {
    kind: "slot",
    seedTableVersion: "ti-organizer-slot-v1",
  });
  const report = validateStructure(draft(), "T");
  assert.equal(report.structureValid, true);
  assert.equal(report.runtimeReady, false);
  assert.ok(
    report.diagnostics.some(
      (d) => d.code === "FORMAT_RUNTIME_UNAVAILABLE" && d.severity === "info",
    ),
  );
});
test("TI has five Swiss windows then an elimination window, with selected qualifications rather than top eight standings", () => {
  const plan = compile(draft(), { configurationId: "c", tournamentId: "T" }),
    u = plan.units[0];
  assert.equal(u.matches.length, 0);
  assert.deepEqual(
    u.windows.map((w) => w.phase),
    ["swiss", "swiss", "swiss", "swiss", "swiss", "elimination"],
  );
  assert.equal(u.windows[5].previousWindowKey, u.windows[4].planKey);
  assert.equal(u.windows[5].source.kind, "pendingEliminationRound");
  assert.equal(new Set(u.windows.map((w) => w.planKey)).size, 6);
  assert.deepEqual(
    u.outputs.qualification.map((q) => q.source),
    Array.from({ length: 8 }, (_, i) => ({
      kind: "selectedStanding",
      unitKey: u.unitKey,
      channel: "qualification",
      index: i + 1,
    })),
  );
  assert.deepEqual(
    compile(draft(), { configurationId: "c", tournamentId: "T" }),
    plan,
  );
  const items = buildItems({ id: "c", snapshot: { plan } }, null);
  assert.equal(items.length, 6);
  assert.equal(items[5].phase, "elimination");
  assert.deepEqual(items[5].dependencyKeys, [u.windows[4].planKey]);
});
test("TI candidate rejects foreign thresholds, BO, seed profile and arbitrary ranking order", () => {
  for (const parameters of [
    { roundCount: 6 },
    { winsToQualify: 3 },
    { defaultBO: 1 },
    { seeding: { kind: "seed", seedTableVersion: "recursive-v1" } },
    { overrides: { rounds: { 6: 5 } } },
  ]) {
    const d = draft();
    d.stages[0].parameters = parameters;
    assert.throws(() => parseStructure(d, "T"), { code: "INVALID_INPUT" });
  }
  for (const patch of [
    { groupSize: 8 },
    { qualifyCount: 7 },
    {
      parameters: {
        tiebreakers: [
          ...definition(rule).defaults.parameters.tiebreakers,
        ].reverse(),
      },
    },
  ]) {
    const d = draft();
    Object.assign(d.stages[0], patch);
    assert.equal(validateStructure(d, "T").structureValid, false);
    assert.throws(
      () => compile(d, { configurationId: "c", tournamentId: "T" }),
      { code: "CONFIG_INVALID" },
    );
  }
});
