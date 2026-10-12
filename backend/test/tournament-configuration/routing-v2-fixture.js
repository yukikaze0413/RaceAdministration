"use strict";
function stage(
  id,
  order,
  rule = "gsl-classic-v1",
  n = 4,
  q = 2,
  parameters = {},
) {
  return {
    id,
    name: id,
    order,
    format:
      rule === "gsl-classic-v1"
        ? "gsl"
        : rule === "de-lower-entry-v1"
          ? "double-elimination"
          : "single-elimination",
    ruleVersion: rule,
    groupSize: n,
    groupCount: 1,
    qualifyCount: q,
    parameters,
    groups: [{ id: id + "g", stageId: id }],
  };
}
function route(id, source, target, from = 1, to = 2, positions = [1, 2]) {
  return {
    id,
    source,
    target,
    selector: { kind: "rankRange", from, to },
    quota: to - from + 1,
    sort: [{ field: "initialSeed", direction: "asc" }],
    ...(target.poolId ? {} : { placement: { kind: "seed", positions } }),
  };
}
function draft() {
  return {
    entrantKind: "individual",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [
      stage("A", 1),
      stage("B", 2),
      stage("T", 3, "de-lower-entry-v1", 8, 1, { lowerEntryMode: "half" }),
    ],
    pools: [],
    routes: [
      route(
        "a",
        { stageId: "A", groupId: "Ag", port: "qualification" },
        { stageId: "T", groupId: "Tg", port: "lower" },
      ),
      route(
        "b",
        { stageId: "B", groupId: "Bg", port: "qualification" },
        { stageId: "T", groupId: "Tg", port: "lower" },
        1,
        2,
        [3, 4],
      ),
    ],
  };
}
function sources() {
  return {
    roster: Array.from({ length: 8 }, (_, i) => ({
      entrantId: "e" + (i + 1),
      initialSeed: i + 1,
      exitState: "active",
    })),
    sourceSnapshots: ["A", "B"].map((s, j) => ({
      sourceId: s + "g",
      version: 1,
      completed: true,
      rankingProfileId: "gsl-classic-v1",
      recordProfileId: "gsl-record-v1",
      entries: Array.from({ length: 4 }, (_, i) => ({
        entrantId: "e" + (j * 4 + i + 1),
        rank: i + 1,
        wins: 2,
        losses: 0,
        draws: 0,
        ...(i < 2
          ? { qualification: { channel: "qualification", index: i + 1 } }
          : {}),
      })),
    })),
  };
}
module.exports = { draft, sources, stage, route };
