"use strict";
const { randomUUID } = require("node:crypto");
const base = () => ({
  entrantKind: "individual",
  structureVersion: "structure-v1",
  routingVersion: "routing-v1",
  stages: [],
  pools: [],
  routes: [],
});
const stage = (id, order, capacity, formatIntent, groups = []) => ({
  id,
  order,
  capacity,
  formatIntent,
  groups,
});
function presets() {
  const single = base();
  single.stages = [stage("elimination", 1, 8, "single-elimination")];
  const loop = base();
  loop.stages = [stage("league", 1, 5, "round-robin")];
  const mix = base();
  mix.stages = [
    stage("groups", 1, 8, "round-robin", [
      { id: "A", stageId: "groups", capacity: 4 },
      { id: "B", stageId: "groups", capacity: 4 },
    ]),
    stage("playoffs", 2, 4, "single-elimination"),
  ];
  mix.routes = [
    ["A", 1, 1],
    ["B", 2, 2],
    ["B", 1, 3],
    ["A", 2, 4],
  ].map(([groupId, rank, slot], i) => ({
    id: "route" + i,
    source: { stageId: "groups", groupId },
    target: { stageId: "playoffs" },
    selector: { kind: "rankRange", from: rank, to: rank },
    quota: 1,
    sort: [{ field: "sourceRank", direction: "asc" }],
    placement: { kind: "slot", positions: [slot] },
  }));
  return [
    { id: "single-elimination", name: "8人单败淘汰", structure: single },
    { id: "round-robin", name: "5人单循环", structure: loop },
    {
      id: "groups-to-playoffs",
      name: "8人两组循环 → 四强淘汰",
      structure: mix,
    },
  ].map((p) => ({
    ...p,
    version: "1",
    ruleVersion: "runtime-rules-v1",
    description: "BO3；个人；草稿可修改，开赛复验人数与规则。",
  }));
}
function instantiate(id, namespace = randomUUID()) {
  const p = presets().find((p) => p.id === id);
  if (!p) return null;
  const ids = new Map(
    [
      ...p.structure.stages,
      ...p.structure.stages.flatMap((s) => s.groups),
      ...p.structure.pools,
      ...p.structure.routes,
    ].map((x) => [
      x.id,
      require("node:crypto")
        .createHash("sha256")
        .update(namespace + ":" + x.id)
        .digest("hex")
        .slice(0, 32),
    ]),
  );
  function map(x) {
    if (typeof x === "string") return ids.get(x) ?? x;
    if (Array.isArray(x)) return x.map(map);
    if (x && typeof x === "object")
      return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, map(v)]));
    return x;
  }
  return {
    ...map(p.structure),
    templateOrigin: { id: p.id, version: p.version },
  };
}
module.exports = { presets, instantiate };
