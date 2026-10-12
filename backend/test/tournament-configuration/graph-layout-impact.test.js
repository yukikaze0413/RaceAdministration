"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { input } = require("./compile-fixture"),
  {
    compile,
  } = require("../../src/tournament-configuration/domain/formats/compile"),
  {
    planChange,
  } = require("../../src/tournament-configuration/domain/stage-groups");
function setup() {
  const structure = input();
  structure.stages[0].groupCount = 2;
  structure.stages[0].capacity = 16;
  structure.stages[0].groups = [
    { id: "g0", stageId: "s", capacity: 8 },
    { id: "g1", stageId: "s", capacity: 8 },
  ];
  const configuration = {
    id: "c",
    tournamentId: "T",
    version: 1,
    state: "draft",
    ...structure,
  };
  const plan = compile(structure, { configurationId: "c", tournamentId: "T" });
  return { configuration, plan };
}
test("CW7 shrinking groups removes complete deleted-group match positions while retaining all surviving group keys", () => {
  const { configuration, plan } = setup(),
    keys = plan.units.map((u) => u.matches[0].planKey),
    dependencies = {
      version: 1,
      registrations: [],
      layouts: {
        c: {
          version: 1,
          positions: {
            [keys[0]]: { x: 10, y: 20 },
            [keys[1]]: { x: 10, y: 40 },
          },
        },
      },
      rules: {},
      runtime: null,
    };
  const result = planChange(
    configuration,
    "T",
    "s",
    { groupCount: 1 },
    dependencies,
  );
  assert.ok(result.report.removedLayoutIds.includes(keys[1]));
  assert.ok(!result.report.removedLayoutIds.includes(keys[0]));
});
test("CW7 changing cut removes now-nonexistent finals, BO-only retains match layout; copied provenance does not enter structure parser", () => {
  const { configuration, plan } = setup(),
    key = plan.units[0].matches.find((m) => m.role === "final").planKey,
    dependencies = {
      version: 1,
      registrations: [],
      layouts: { c: { version: 1, positions: { [key]: { x: 10, y: 20 } } } },
      rules: {},
      runtime: null,
    };
  assert.ok(
    planChange(
      configuration,
      "T",
      "s",
      { qualifyCount: 2 },
      dependencies,
    ).report.removedLayoutIds.includes(key),
  );
  const bo = planChange(
    configuration,
    "T",
    "s",
    { parameters: { ...configuration.stages[0].parameters, defaultBO: 5 } },
    dependencies,
  );
  assert.deepEqual(bo.report.removedLayoutIds, []);
  assert.ok(bo.report.retainedLayoutIds.includes(key));
  configuration.upgradeOrigin = { configurationId: "old", version: 1 };
  assert.doesNotThrow(() =>
    planChange(
      configuration,
      "T",
      "s",
      { parameters: { ...configuration.stages[0].parameters, defaultBO: 5 } },
      dependencies,
    ),
  );
});
test("CW7 unrelated incomplete routing does not delete stable matches during a BO-only change", () => {
  const { configuration, plan } = setup(),
    key = plan.units[0].matches[0].planKey;
  configuration.routes = [
    {
      id: "incomplete",
      source: { stageId: "s", groupId: "g0", port: "qualification" },
      target: { stageId: "s", groupId: "g1", port: "seed" },
      selector: null,
      quota: null,
      sort: [],
      placement: null,
    },
  ];
  const dependencies = {
    version: 1,
    registrations: [],
    layouts: { c: { version: 1, positions: { [key]: { x: 20, y: 30 } } } },
    rules: {},
    runtime: null,
  };
  const result = planChange(
    configuration,
    "T",
    "s",
    { parameters: { ...configuration.stages[0].parameters, defaultBO: 5 } },
    dependencies,
  );
  assert.deepEqual(result.report.removedLayoutIds, []);
  assert.ok(result.report.retainedLayoutIds.includes(key));
});
