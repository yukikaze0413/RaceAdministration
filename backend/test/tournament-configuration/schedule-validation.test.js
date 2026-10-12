"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  parseSchedule,
  validateSchedule,
} = require("../../src/platform/schedule/validation");
const match = (key, entrants = [], dependencyKeys = [], known = true) => ({
  planKey: key,
  entrants,
  dependencyKeys,
  known,
  kind: "match",
  groupId: "g",
});
function plan(
  assignments,
  windows = [
    {
      id: "w",
      startsAt: "2026-10-10T00:00:00.000Z",
      offsetMinutes: 480,
      durationMinutes: 60,
      minRestMinutes: 0,
    },
  ],
) {
  return {
    configurationId: "c",
    windows,
    resources: [
      { id: "a", name: "A台" },
      { id: "b", name: "B台" },
    ],
    assignments,
  };
}
test("SC2 independent parallel matches use different resources and keep UTC plus fixed offset", () => {
  const p = parseSchedule(
    plan([
      { planKey: "m1", windowId: "w", resourceId: "a" },
      { planKey: "m2", windowId: "w", resourceId: "b" },
    ]),
  );
  assert.equal(
    validateSchedule(p, [match("m1", ["1", "2"]), match("m2", ["3", "4"])])
      .status,
    "ready",
  );
  assert.equal(p.windows[0].offsetMinutes, 480);
  assert.equal(p.windows[0].startsAt, "2026-10-10T00:00:00.000Z");
});
test("SC2 resource and actual participant overlap identify both matches", () => {
  const p = parseSchedule(
    plan([
      { planKey: "m1", windowId: "w", resourceId: "a" },
      { planKey: "m2", windowId: "w", resourceId: "a" },
    ]),
  );
  const out = validateSchedule(p, [
    match("m1", ["1", "2"]),
    match("m2", ["1", "3"]),
  ]);
  assert.equal(out.status, "blocked");
  assert.ok(
    out.diagnostics.some(
      (d) =>
        d.code === "RESOURCE_OVERLAP" &&
        d.planKeys.includes("m1") &&
        d.planKeys.includes("m2"),
    ),
  );
  assert.ok(out.diagnostics.some((d) => d.code === "PARTICIPANT_OVERLAP"));
});
test("SC2 final starts after predecessor expected end plus own minimum rest", () => {
  const windows = [
    {
      id: "w",
      startsAt: "2026-10-10T00:00:00Z",
      offsetMinutes: 0,
      durationMinutes: 60,
      minRestMinutes: 0,
    },
    {
      id: "f",
      startsAt: "2026-10-10T01:10:00Z",
      offsetMinutes: 0,
      durationMinutes: 60,
      minRestMinutes: 15,
    },
  ];
  const p = parseSchedule(
    plan(
      [
        { planKey: "m1", windowId: "w", resourceId: "a" },
        { planKey: "final", windowId: "f", resourceId: "a" },
      ],
      windows,
    ),
  );
  assert.equal(
    validateSchedule(p, [
      match("m1", ["1", "2"]),
      match("final", ["1", "3"], ["m1"]),
    ]).status,
    "blocked",
  );
  p.windows[1].startsAt = "2026-10-10T01:15:00.000Z";
  assert.equal(
    validateSchedule(p, [
      match("m1", ["1", "2"]),
      match("final", ["1", "3"], ["m1"]),
    ]).status,
    "ready",
  );
});
test("SC2 potential identities are pending, never a false clean bill; future Swiss window remains pending", () => {
  const p = parseSchedule(
    plan([
      { planKey: "future1", windowId: "w", resourceId: "a" },
      { planKey: "future2", windowId: "w", resourceId: "b" },
    ]),
  );
  const out = validateSchedule(p, [
    match("future1", ["x", "y"], [], false),
    match("future2", ["y", "z"], [], false),
  ]);
  assert.equal(out.status, "pending");
  assert.ok(
    out.diagnostics.some((d) => d.code === "POTENTIAL_PARTICIPANT_OVERLAP"),
  );
  p.windows[0].planKey = "swiss-window";
  assert.equal(
    validateSchedule(p, [
      { planKey: "swiss-window", kind: "window", known: false },
      match("future1", [], [], false),
      match("future2", [], [], false),
    ]).status,
    "pending",
  );
});
test("SC2 input rejects missing zone, unsafe links, duplicate seats and unknown references", () => {
  assert.throws(() =>
    parseSchedule(
      plan(
        [],
        [
          {
            id: "w",
            startsAt: "2026-10-10T08:00:00",
            offsetMinutes: 480,
            durationMinutes: 60,
            minRestMinutes: 0,
          },
        ],
      ),
    ),
  );
  const p = plan([]);
  p.windows[0].streamUrl = "javascript:alert(1)";
  assert.throws(() => parseSchedule(p));
  const duplicate = plan([
    { planKey: "m1", windowId: "w" },
    { planKey: "m1", windowId: "w" },
  ]);
  assert.throws(() => parseSchedule(duplicate));
  assert.equal(
    validateSchedule(
      parseSchedule(plan([{ planKey: "foreign", windowId: "w" }])),
      [],
    ).status,
    "blocked",
  );
});

test("SC2 inactive conditional matches keep a labelled reservation without inventing an active resource conflict", () => {
  const p = parseSchedule(
      plan([
        { planKey: "real", windowId: "w", resourceId: "a" },
        { planKey: "gf2", windowId: "w", resourceId: "a" },
      ]),
    ),
    out = validateSchedule(p, [
      match("real", ["1", "2"]),
      { ...match("gf2", ["1", "2"], [], false), inactive: true },
    ]);
  assert.equal(out.status, "ready");
  assert.ok(
    out.diagnostics.some(
      (d) => d.code === "CONDITION_INACTIVE" && d.severity === "info",
    ),
  );
});

test("SC2 stream URL is a bounded string rather than a coerced object or array", () => {
  const p = plan([]);
  p.windows[0].streamUrl = ["https://example.test/live"];
  assert.throws(() => parseSchedule(p));
});
