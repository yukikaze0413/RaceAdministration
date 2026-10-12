"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  validateEntryRef,
  rosterEntries,
} = require("../../src/platform/operations/entry-ref");
const { input } = require("../tournament-configuration/compile-fixture");
const { draft } = require("../tournament-configuration/routing-v2-fixture");
test("PR5 explicit later invitations preserve configuration/unit/port/local position", () => {
  const c = draft(),
    ref = {
      configurationId: "c",
      stageId: "T",
      groupId: "Tg",
      port: "upper",
      position: 8,
    };
  assert.deepEqual(validateEntryRef(c, "c", ref), {
    ...ref,
    positionKind: "seed",
  });
  assert.throws(() => validateEntryRef(c, "wrong", ref), {
    code: "ENTRY_INVALID",
  });
  assert.throws(
    () => validateEntryRef(c, "c", { ...ref, port: "lower", position: 5 }),
    { code: "ENTRY_INVALID" },
  );
  assert.throws(
    () => validateEntryRef(c, "c", { ...ref, port: "lower", position: 1 }),
    { code: "ENTRY_POSITION_RESERVED" },
  );
});
test("PR5 named upper/lower are distinct but ordinary seed/slot cannot share seats", () => {
  const c = input("de-lower-entry-v1", 4, 1, { lowerEntryMode: "half" });
  const regs = ["upper", "lower"].map((port, i) => ({
    id: "e" + i,
    userId: "u" + i,
    name: port,
    seed: i + 1,
    entryRef: {
      configurationId: "c",
      stageId: "s",
      groupId: "g",
      port,
      position: 1,
    },
  }));
  const out = rosterEntries(c, "c", regs);
  assert.deepEqual(
    out.map((r) => r.entryRef.port),
    ["upper", "lower"],
  );
  const ordinary = input("single-cut-v2", 4, 1);
  const duplicate = regs.map((r, i) => ({
    ...r,
    entryRef: { ...r.entryRef, port: i ? "slot" : "seed" },
  }));
  assert.throws(() => rosterEntries(ordinary, "c", duplicate), {
    code: "ENTRY_POSITION_CONFLICT",
  });
});
test("PR5 legacy sourceId mapping only assigns one roster identity and full local positions", () => {
  const c = input("single-cut-v2", 4, 1);
  const out = rosterEntries(
    c,
    "c",
    Array.from({ length: 4 }, (_, i) => ({
      id: "e" + i,
      userId: "u" + i,
      name: "e" + i,
      seed: i + 1,
      sourceId: "g",
    })),
  );
  assert.deepEqual(
    out.map((r) => r.entryRef.position),
    [1, 2, 3, 4],
  );
  assert.throws(
    () =>
      rosterEntries(c, "c", [
        { id: "same", userId: "same", seed: 1, sourceId: "g" },
        { id: "same", userId: "same", seed: 2, sourceId: "g" },
      ]),
    { code: "ROSTER_INVALID" },
  );
});
