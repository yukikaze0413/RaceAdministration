"use strict";
const G = require("./graph"),
  A = require("./analysis");
const PLANNER_VERSION = "graph-stage-rounds-v3";
function plan(g, r) {
  const diagnostics = [...r.diagnostics];
  const report = (code, id, reason, severity = "error") =>
    diagnostics.push({
      code,
      objectId: id,
      path: "/stages",
      port: null,
      reason,
      severity,
    });
  const built = r.values ? A.units(g, r) : { units: [], rounds: [] };
  const units = built.units,
    by = new Map(units.map((u) => [u.id, u])),
    stages = [...g.stages].sort((a, b) => a.order - b.order);
  if (by.size !== units.length)
    report(
      "SCHEDULE_UNIT_ID_CONFLICT",
      null,
      "比赛标识与轮次调度标识冲突，请调整节点标识",
    );
  if (g.nodes.some((n) => n.kind === "subgraph" && n.id === "root"))
    report("GRAPH_ID_CONFLICT", "root", "子图标识 root 与主图标识冲突");
  const memberships = new Map(
    stages.flatMap((s) => G.stageMembers(g, s.nodeIds).map((id) => [id, s])),
  );
  for (const u of units) {
    u.stageId = memberships.get(u.nodeId)?.id;
    u.order = memberships.get(u.nodeId)?.order ?? Number.MAX_SAFE_INTEGER;
    u.needs = new Map(u.predecessorIds.map((id) => [id, "result"]));
    if (!u.stageId) report("STAGE_REQUIRED", u.nodeId, "请将比赛加入阶段");
    if (!u.roundId && u.seats.length === 2 && u.seats[0].ref === u.seats[1].ref)
      report(
        "DUPLICATE_PARTICIPANT",
        u.nodeId,
        "同一场比赛的 A/B 使用相同选手",
      );
    for (const dep of u.predecessorIds)
      if (
        by.get(dep)?.nodeId &&
        (memberships.get(by.get(dep).nodeId)?.order ?? 0) > u.order
      )
        report("STAGE_ORDER_CONFLICT", u.nodeId, "较早阶段依赖较晚阶段的结果");
    const preceding = stages.filter((s) => s.order < u.order).at(-1);
    if (preceding)
      for (const p of units.filter(
        (x) => memberships.get(x.nodeId)?.order < u.order,
      ))
        u.needs.set(p.id, "stage");
  }
  const compare = (a, b) =>
    a.order - b.order ||
    a.graphId.localeCompare(b.graphId, "en") ||
    a.id.localeCompare(b.id, "en");
  const ordered = [],
    pending = new Map(units.map((u) => [u.id, u]));
  while (pending.size) {
    const ready = [...pending.values()]
      .filter((u) => [...u.needs.keys()].every((id) => !pending.has(id)))
      .sort(compare);
    if (!ready.length) {
      report("WAVE_DEPENDENCY_CYCLE", null, "阶段顺序与比赛依赖形成循环");
      break;
    }
    const u = ready[0];
    pending.delete(u.id);
    for (const p of ordered)
      if (A.conflict(p.seats, u.seats)) u.needs.set(p.id, "participant");
    u.level =
      1 +
      Math.max(0, ...[...u.needs.keys()].map((id) => by.get(id)?.level ?? 0));
    ordered.push(u);
  }
  const groups = new Map();
  for (const u of ordered) {
    const key = JSON.stringify([u.graphId, u.stageId, u.level]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }
  const waves = [...groups.values()].map((list) => {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id, "en")),
      first = sorted[0];
    return {
      id:
        "wave:" +
        G.digest([
          PLANNER_VERSION,
          first.graphId,
          first.stageId,
          sorted.map((u) => u.id),
        ]),
      graphId: first.graphId,
      graphName:
        first.graphId === "root"
          ? "主图"
          : g.nodes.find((n) => n.id === first.graphId)?.name,
      stageId: first.stageId,
      stageName: stages.find((s) => s.id === first.stageId)?.name,
      number: 0,
      matchIds: sorted.filter((u) => !u.roundId).map((u) => u.id),
      roundIds: sorted.filter((u) => u.roundId).map((u) => u.roundId),
      requiresWaveIds: [],
      requirements: [],
      _units: sorted,
      _level: first.level,
      _order: first.order,
    };
  });
  const owner = new Map(
    waves.flatMap((w) => w._units.map((u) => [u.id, w.id])),
  );
  for (const w of waves) {
    const needs = new Map();
    for (const u of w._units)
      for (const [id, reason] of u.needs)
        if (owner.has(id) && owner.get(id) !== w.id)
          needs.set(owner.get(id), reason);
    w.requiresWaveIds = [...needs.keys()].sort();
    w.requirements = [...needs]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([waveId, reason]) => ({ waveId, reason }));
  }
  waves.sort(
    (a, b) =>
      a.graphId.localeCompare(b.graphId, "en") ||
      a._order - b._order ||
      a._level - b._level ||
      a.id.localeCompare(b.id),
  );
  const numbers = new Map();
  for (const w of waves) {
    w.number = (numbers.get(w.graphId) ?? 0) + 1;
    numbers.set(w.graphId, w.number);
    delete w._units;
    delete w._level;
    delete w._order;
  }
  const rounds = built.rounds.map((round) => ({
    ...round,
    waveId: owner.get(round.id),
  }));
  const dynamicRound = rounds.find((round) => round.kind === "swiss");
  if (dynamicRound)
    report(
      "DYNAMIC_PAIRING_PENDING",
      dynamicRound.nodeId,
      "瑞士轮按整轮预留，真实配对待解析",
      "warning",
    );
  const valid = !diagnostics.some((d) => d.severity === "error"),
    status = !valid
      ? "invalid"
      : diagnostics.some((d) => d.severity === "warning")
        ? "conditional"
        : "ready";
  const wavePlan = {
    graphVersion: 0,
    graphDigest: G.digest(g),
    plannerVersion: PLANNER_VERSION,
    waves,
    rounds,
  };
  return {
    ...r,
    valid,
    previewReady: valid,
    status,
    diagnostics,
    wavePlan,
    wavePlanDigest: G.digest(wavePlan),
    matches: r.matches.map((m) => {
      const w = waves.find((w) => w.matchIds.includes(m.id)),
        stage = memberships.get(m.id);
      return {
        ...m,
        batch: w ? "wave " + w.number : "轮空",
        waveId: w?.id ?? null,
        waveNumber: w?.number ?? null,
        graphName: w?.graphName ?? "主图",
        graphId: g.nodes.find((n) => n.id === m.id)?.parentId ?? "root",
        stageId: stage?.id ?? null,
        stageName: stage?.name ?? "未分组",
      };
    }),
    windows: r.windows.map((window) => {
      const round = rounds.find((x) => x.planKey === window.planKey);
      const w = waves.find((x) => x.id === round?.waveId);
      return {
        ...window,
        roundId: round?.id,
        waveId: round?.waveId,
        stageId: w?.stageId,
        graphId: w?.graphId,
        stageName: w?.stageName,
        graphName: w?.graphName,
        waveNumber: w?.number,
        batch: w ? "wave " + w.number : null,
      };
    }),
  };
}
module.exports = { plan, PLANNER_VERSION };
