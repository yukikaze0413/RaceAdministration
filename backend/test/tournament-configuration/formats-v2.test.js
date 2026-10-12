"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseStructure,
} = require("../../src/tournament-configuration/domain/structure");
function draft(
  ruleVersion = "single-cut-v2",
  format = "single-elimination",
  groups = [{ id: "g1", stageId: "s1" }],
) {
  return {
    entrantKind: "individual",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [
      { id: "s1", name: "第一阶段", order: 1, format, ruleVersion, groups },
    ],
    pools: [],
    routes: [],
  };
}
test("FP1 v2 default single stage derives capacity and BO without changing input", () => {
  const input = draft(),
    out = parseStructure(input, "T");
  assert.equal(out.stages[0].groupSize, 8);
  assert.equal(out.stages[0].groupCount, 1);
  assert.equal(out.stages[0].qualifyCount, 1);
  assert.equal(out.stages[0].capacity, 8);
  assert.equal(out.stages[0].groups[0].capacity, 8);
  assert.equal(out.stages[0].parameters.defaultBO, 3);
  assert.equal(out.stages[0].parameters.thirdPlace, false);
  assert.equal(input.stages[0].capacity, undefined);
});
module.exports = { draft };

test("FP1 all versioned defaults derive total entrants independently", () => {
  const cases = [
    ["gsl-classic-v1", "gsl", 4, 4, 2, 16],
    ["de-standard-v1", "double-elimination", 8, 1, 1, 8],
    ["de-lower-entry-v1", "double-elimination", 8, 1, 1, 8],
    ["swiss-fixed-v1", "fixed-swiss", 16, 1, 8, 16],
    ["swiss-threshold-v1", "threshold-swiss", 16, 1, 8, 16],
    ["round-robin-v2", "round-robin", 4, 1, 2, 4],
    ["double-round-robin-v2", "double-round-robin", 4, 1, 2, 4],
  ];
  for (const [version, format, n, count, q, total] of cases) {
    const input = draft(
      version,
      format,
      Array.from({ length: count }, (_, i) => ({ id: "g" + i, stageId: "s1" })),
    );
    const stage = parseStructure(input, "T").stages[0];
    assert.deepEqual(
      [stage.groupSize, stage.groupCount, stage.qualifyCount, stage.capacity],
      [n, count, q, total],
      version,
    );
    assert.equal(stage.parameters.defaultBO, 3);
  }
});

test("FP3 lower half entrants count toward total and capacity limit", () => {
  const input = draft("de-lower-entry-v1", "double-elimination");
  input.stages[0].parameters = { lowerEntryMode: "half" };
  assert.equal(parseStructure(input, "T").stages[0].capacity, 12);
  input.stages[0].groupSize = 32;
  input.stages[0].groupCount = 2;
  input.stages[0].parameters = { lowerEntryMode: "same" };
  assert.throws(
    () => parseStructure(input, "T"),
    (e) =>
      e.code === "INVALID_INPUT" &&
      e.diagnostics[0].path === "/stages/0/groupCount",
  );
});
const {
  validateStructure,
} = require("../../src/tournament-configuration/domain/validation");
test("FP2 business-incomplete draft persists but ratio error blocks validation", () => {
  const input = draft();
  input.stages[0].qualifyCount = 3;
  assert.equal(parseStructure(input, "T").stages[0].qualifyCount, 3);
  const report = validateStructure(input, "T");
  assert.equal(report.structureValid, false);
  assert.ok(
    report.diagnostics.some(
      (d) =>
        d.path === "/stages/0/qualifyCount" &&
        d.code === "FORMAT_PARAMETERS_INVALID",
    ),
  );
});
test("CV5 supported versions are runtime-ready only when the structure is valid", () => {
  const report = validateStructure(draft(), "T");
  assert.equal(report.structureValid, true);
  assert.equal(report.runtimeReady, true);
  const invalid = draft();
  invalid.stages[0].qualifyCount = 3;
  const unavailable = validateStructure(invalid, "T");
  assert.equal(unavailable.runtimeReady, false);
  assert.ok(
    unavailable.diagnostics.some((d) => d.code === "FORMAT_PARAMETERS_INVALID"),
  );
});

test("FP2 all rules diagnose independent illegal combinations and permit segmented 12-to-3", () => {
  const cases = [
    [
      "single-cut-v2",
      "single-elimination",
      8,
      2,
      { thirdPlace: true },
      "parameters/thirdPlace",
    ],
    ["gsl-classic-v1", "gsl", 6, 2, {}, "groupSize"],
    ["de-standard-v1", "double-elimination", 2, 3, {}, "qualifyCount"],
    [
      "de-lower-entry-v1",
      "double-elimination",
      8,
      2,
      { finalReset: true },
      "parameters/finalReset",
    ],
    [
      "swiss-fixed-v1",
      "fixed-swiss",
      8,
      4,
      { roundCount: 8 },
      "parameters/roundCount",
    ],
    [
      "round-robin-v2",
      "round-robin",
      4,
      2,
      { points: { win: 1, draw: 1, loss: 0, doubleLoss: 0 } },
      "parameters/points",
    ],
  ];
  for (const [version, format, n, q, parameters, field] of cases) {
    const input = draft(version, format);
    Object.assign(input.stages[0], {
      groupSize: n,
      groupCount: 1,
      qualifyCount: q,
      parameters,
    });
    const r = validateStructure(input, "T");
    assert.equal(r.structureValid, false, version);
    assert.ok(
      r.diagnostics.some((d) => d.path === "/stages/0/" + field),
      version,
    );
  }
  const segmented = draft();
  Object.assign(segmented.stages[0], {
    groupSize: 12,
    qualifyCount: 3,
    parameters: { bracketMode: "segmented" },
  });
  assert.equal(validateStructure(segmented, "T").structureValid, true);
});
test("FP1 multiple independent roots cannot silently exceed 64 unique entrants", () => {
  const input = draft();
  input.stages[0].groupSize = 64;
  input.stages.push({
    id: "s2",
    name: "另一个入口",
    order: 2,
    format: "single-elimination",
    ruleVersion: "single-cut-v2",
    groups: [{ id: "g2", stageId: "s2" }],
  });
  assert.throws(
    () => parseStructure(input, "T"),
    (e) => e.code === "INVALID_INPUT" && e.diagnostics[0].path === "/stages",
  );
});

test("FP2 invalid half-size can be saved as incomplete draft without fictional fractional entrants", () => {
  const input = draft("de-lower-entry-v1", "double-elimination");
  Object.assign(input.stages[0], {
    groupSize: 3,
    parameters: { lowerEntryMode: "half" },
  });
  const parsed = parseStructure(input, "T");
  assert.equal(parsed.stages[0].capacity, null);
  assert.equal(parsed.stages[0].groups[0].capacity, null);
  const report = validateStructure(parsed, "T");
  assert.equal(report.structureValid, false);
  assert.ok(
    report.diagnostics.some(
      (d) =>
        d.code === "FORMAT_PARAMETERS_INVALID" &&
        d.path === "/stages/0/groupSize",
    ),
  );
});
test("TS7 absent or null routing collections are typed configuration errors", () => {
  for (const value of [null, undefined]) {
    const input = draft();
    input.routes = value;
    assert.throws(
      () => parseStructure(input, "T"),
      (e) => e.code === "INVALID_INPUT" && e.diagnostics[0].path === "/routes",
    );
  }
});

test("FP2 round and role BO overrides are preserved without sharing mutable defaults", () => {
  const input = draft();
  input.stages[0].parameters = {
    overrides: { rounds: { 1: 1, 2: 5 }, final: 7 },
  };
  const s = parseStructure(input, "T").stages[0];
  assert.deepEqual(s.parameters.overrides, {
    rounds: { 1: 1, 2: 5 },
    final: 7,
  });
  const fresh = parseStructure(draft(), "T");
  assert.deepEqual(fresh.stages[0].parameters.overrides, {});
  input.stages[0].parameters.overrides.rounds["2"] = 4;
  assert.throws(
    () => parseStructure(input, "T"),
    (e) => e.diagnostics[0].path === "/stages/0/parameters/overrides/rounds/2",
  );
});

test("FP1 catalog callers cannot mutate the validation schema used by later drafts", () => {
  const {
    formatCatalog,
  } = require("../../src/tournament-configuration/domain/formats/registry");
  const view = formatCatalog();
  view.formats[0].parameterSchema.properties.defaultBO.enum[0] = 2;
  const input = draft();
  input.stages[0].parameters = { defaultBO: 1 };
  assert.equal(parseStructure(input, "T").stages[0].parameters.defaultBO, 1);
});

test("CV5 all eight generic format versions report their actual runtime capability", () => {
  const {
    formatCatalog,
  } = require("../../src/tournament-configuration/domain/formats/registry");
  const flags = formatCatalog().formats.map((f) => [
    f.ruleVersion,
    f.runtimeReady,
  ]);
  assert.deepEqual(
    flags.filter((x) => x[1]).map((x) => x[0]),
    [
      "single-cut-v2",
      "gsl-classic-v1",
      "de-standard-v1",
      "de-lower-entry-v1",
      "swiss-fixed-v1",
      "swiss-threshold-v1",
      "major-cologne-2026-v1",
      "round-robin-v2",
      "double-round-robin-v2",
    ],
  );
});
