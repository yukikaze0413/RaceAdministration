"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { buildItems } = require("../../src/platform/schedule/items"),
  { input } = require("./compile-fixture"),
  {
    compile,
  } = require("../../src/tournament-configuration/domain/formats/compile");
function frozen(rule, n, q, p = {}) {
  const structure = input(rule, n, q, p);
  return {
    id: "c",
    snapshot: {
      structure,
      plan: compile(structure, { configurationId: "c", tournamentId: "T" }),
    },
  };
}
test("SC2 frozen single future identities inherit all potential feeder seats and actual matches take known identities", () => {
  const c = frozen("single-cut-v2", 8, 1),
    items = buildItems(c),
    final = items.find((m) => m.role === "final");
  assert.equal(items.filter((m) => m.kind === "match").length, 7);
  assert.equal(final.entrants.length, 8);
  assert.equal(final.known, false);
  assert.equal(final.dependencyKeys.length, 2);
  const first = items[0],
    runtime = {
      configurationId: "c",
      units: [
        {
          plan: c.snapshot.plan.units[0],
          bindings: [],
          rounds: [
            {
              confirmed: false,
              matches: [
                {
                  id: "m",
                  planKey: first.planKey,
                  entrants: ["A", "B"],
                  submissions: [],
                  decision: null,
                },
              ],
            },
          ],
        },
      ],
    };
  const actual = buildItems(c, runtime).find(
    (m) => m.planKey === first.planKey,
  );
  assert.deepEqual(actual.entrants, ["A", "B"]);
  assert.equal(actual.known, true);
});
test("SC2 Swiss static plan contains only windows; actual pairing adds stable matches without replacing windows", () => {
  const c = frozen("swiss-fixed-v1", 8, 4, { roundCount: 3 }),
    window = c.snapshot.plan.units[0].windows[0],
    runtime = {
      configurationId: "c",
      units: [
        {
          plan: c.snapshot.plan.units[0],
          bindings: [],
          rounds: [
            {
              planKey: window.planKey,
              confirmed: false,
              matches: [
                {
                  id: "m",
                  planKey: window.planKey + "/match/1",
                  entrants: ["A", "B"],
                  submissions: [],
                  decision: null,
                },
                {
                  id: "bye",
                  planKey: window.planKey + "/bye",
                  entrants: ["C", null],
                  bye: true,
                  submissions: [],
                },
              ],
            },
          ],
        },
      ],
    };
  assert.equal(buildItems(c).filter((m) => m.kind === "match").length, 0);
  const items = buildItems(c, runtime);
  assert.equal(items.filter((m) => m.kind === "window").length, 3);
  assert.equal(items.filter((m) => m.kind === "match").length, 1);
});
test("SC2 routed later-stage matches require completion of the source qualification batch", () => {
  const c = frozen("single-cut-v2", 8, 4),
    structure = c.snapshot.structure,
    target = input().stages[0];
  target.id = "target";
  target.order = 2;
  target.groups = [{ id: "tg", stageId: "target", capacity: 8 }];
  structure.stages.push(target);
  structure.routes = [
    {
      id: "r",
      source: { stageId: "s", groupId: "g", port: "qualification" },
      target: { stageId: "target", groupId: "tg", port: "seed" },
      selector: { kind: "rankRange", from: 1, to: 4 },
      quota: 4,
      sort: [{ field: "initialSeed", direction: "asc" }],
      placement: { kind: "seed", positions: [1, 2, 3, 4] },
    },
  ];
  c.snapshot.plan = compile(structure, {
    configurationId: "c",
    tournamentId: "T",
  });
  const items = buildItems(c),
    first = items.find((m) => m.groupId === "tg" && m.round === 1);
  assert.equal(first.dependencyKeys.length, 4);
  assert.ok(
    first.dependencyKeys.every(
      (k) => items.find((m) => m.planKey === k)?.groupId === "g",
    ),
  );
});
