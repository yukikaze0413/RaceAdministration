"use strict";
const cases = [
  {
    id: "shadow-cup-v1",
    name: "暗影杯",
    version: 1,
    status: "ready",
    seed: 2026100801,
    entrantCount: 32,
    matchCount: 87,
  },
  {
    id: "gsl-no-reset-v1",
    name: "GSL接双败（不重置）",
    version: 1,
    status: "ready",
    seed: 2026100802,
    entrantCount: 16,
    matchCount: 34,
  },
  {
    id: "gsl-reset-v1",
    name: "GSL接双败（重置）",
    version: 1,
    status: "ready",
    seed: 2026100802,
    entrantCount: 16,
    matchCount: 35,
  },
  {
    id: "cologne2026",
    name: "科隆Major2026",
    version: 1,
    status: "pending",
    reason:
      "106场历史比分已通过工程回放；官方种子快照采用及调整记录、实际开赛时间和完整示例导入仍待核验",
  },
  {
    id: "ti2026",
    name: "TI15 / TI2026",
    version: 1,
    status: "pending",
    reason:
      "58系列已通过私有候选回放；正式统计公式、种子映射及官方裁定记录仍待核验，完整应用运行尚未开放",
  },
];
function configuration(c) {
  const shadow = c.id === "shadow-cup-v1",
    groups = shadow ? ["swiss"] : ["g0", "g1", "g2", "g3"];
  const stage = (id, order, format, ruleVersion, n, q, ids, parameters) => ({
    id,
    name:
      id === "source"
        ? shadow
          ? "五轮瑞士"
          : "四组GSL"
        : shadow
          ? "八强单败"
          : "八人双败",
    order,
    format,
    ruleVersion,
    groupSize: n,
    groupCount: ids.length,
    qualifyCount: q,
    parameters,
    groups: ids.map((groupId) => ({ id: groupId, stageId: id })),
  });
  return {
    entrantKind: "reference-unit",
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [
      stage(
        "source",
        1,
        shadow ? "fixed-swiss" : "gsl",
        shadow ? "swiss-fixed-v1" : "gsl-classic-v1",
        shadow ? 32 : 4,
        shadow ? 8 : 2,
        groups,
        shadow
          ? { roundCount: 5 }
          : { seeding: { kind: "slot", seedTableVersion: "recursive-v1" } },
      ),
      stage(
        "target",
        2,
        shadow ? "single-elimination" : "double-elimination",
        shadow ? "single-cut-v2" : "de-standard-v1",
        8,
        1,
        [shadow ? "single" : "de"],
        shadow ? {} : { finalReset: c.id === "gsl-reset-v1" },
      ),
    ],
    pools: [],
    routes: groups.map((groupId, i) => ({
      id: "route-" + groupId,
      source: { stageId: "source", groupId, port: "qualification" },
      target: {
        stageId: "target",
        groupId: shadow ? "single" : "de",
        port: shadow ? "seed" : "upper",
      },
      selector: { kind: "rankRange", from: 1, to: shadow ? 8 : 2 },
      quota: shadow ? 8 : 2,
      sort: [{ field: "initialSeed", direction: "asc" }],
      placement: {
        kind: "seed",
        positions: Array.from(
          { length: shadow ? 8 : 2 },
          (_, j) => i * 2 + j + 1,
        ),
      },
    })),
  };
}
module.exports = { cases, configuration };
