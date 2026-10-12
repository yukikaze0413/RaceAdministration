"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  startV2,
  progressV2,
} = require("../../src/platform/operations/runtime-v2");
const {
  advanceStatic,
} = require("../../src/platform/operations/format-runners/static");
const {
  compile,
} = require("../../src/tournament-configuration/domain/formats/compile");
const {
  parseStructure,
} = require("../../src/tournament-configuration/domain/structure");
const {
  digest,
} = require("../../src/tournament-configuration/domain/canonical");
const {
  stage,
  route,
} = require("../tournament-configuration/routing-v2-fixture");
function example() {
  const structure = parseStructure(
    {
      entrantKind: "individual",
      structureVersion: "structure-v2",
      routingVersion: "routing-v2",
      stages: [
        stage("S1", 1, "single-cut-v2", 16, 8),
        stage("S2", 2, "single-cut-v2", 16, 8),
        stage("S3", 3, "single-cut-v2", 16, 1),
      ],
      pools: [],
      routes: [
        route(
          "r1",
          { stageId: "S1", groupId: "S1g", port: "qualification" },
          { stageId: "S2", groupId: "S2g", port: "seed" },
          1,
          8,
          Array.from({ length: 8 }, (_, i) => i + 1),
        ),
        route(
          "r2",
          { stageId: "S2", groupId: "S2g", port: "qualification" },
          { stageId: "S3", groupId: "S3g", port: "seed" },
          1,
          8,
          Array.from({ length: 8 }, (_, i) => i + 1),
        ),
      ],
    },
    "T",
  );
  const plan = compile(structure, { configurationId: "c", tournamentId: "T" }),
    c = {
      id: "c",
      tournamentId: "T",
      snapshot: {
        structure,
        plan,
        digest: digest(structure),
        planDigest: digest(plan),
        version: 2,
      },
    };
  const approved = Array.from({ length: 32 }, (_, i) => {
    const stageId = i < 16 ? "S1" : i < 24 ? "S2" : "S3";
    return {
      id: "e" + (i + 1),
      userId: "u" + (i + 1),
      name: "e" + (i + 1),
      seed: i + 1,
      entryRef: {
        configurationId: "c",
        stageId,
        groupId: stageId + "g",
        port: "seed",
        position: i < 16 ? i + 1 : i < 24 ? i - 7 : i - 15,
      },
    };
  });
  return { c, approved };
}
function complete(unit) {
  while (unit.status === "running") {
    const r = unit.rounds.find((x) => !x.confirmed);
    r.matches.forEach((m) => (m.decision = { kind: "score", scores: [2, 0] }));
    advanceStatic(unit);
  }
}
test("PR5 32 identities with 8+8 later invites wait for all sources and start complete stages", () => {
  const { c, approved } = example(),
    runtime = startV2(c, approved);
  assert.deepEqual(
    runtime.units.map((u) => u.id),
    ["S1g"],
  );
  assert.equal(runtime.roster.length, 32);
  assert.equal(runtime.units[0].rounds[0].matches.length, 8);
  assert.ok(runtime.waiting.some((w) => w.stageId === "S2"));
  complete(runtime.units[0]);
  progressV2(runtime);
  assert.deepEqual(
    runtime.units.map((u) => u.id),
    ["S1g", "S2g"],
  );
  assert.equal(runtime.units[1].entrants.length, 16);
  assert.equal(
    runtime.units[1].entrants.filter((id) => Number(id.slice(1)) >= 17).length,
    8,
  );
  assert.equal(
    runtime.units.some((u) => u.stageId === "S3"),
    false,
  );
  complete(runtime.units[1]);
  progressV2(runtime);
  assert.equal(runtime.units[2].entrants.length, 16);
  complete(runtime.units[2]);
  progressV2(runtime);
  assert.equal(runtime.status, "completed");
  assert.equal(
    runtime.units.flatMap((u) => u.rounds.flatMap((r) => r.matches)).length,
    31,
  );
});
test("PR5 startup rejects incomplete late invitations and wrong configuration without partial runtime", () => {
  const { c, approved } = example();
  assert.throws(() => startV2(c, approved.slice(0, 31)), {
    code: "ROSTER_INVALID",
  });
  const foreign = structuredClone(approved);
  foreign[20].entryRef.configurationId = "other";
  assert.throws(() => startV2(c, foreign), { code: "ENTRY_INVALID" });
});
module.exports = { example, complete };
