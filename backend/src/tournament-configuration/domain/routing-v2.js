"use strict";
const { object, fail, diagnostic } = require("./structure");
const sourcePort = (r) => (r.poolId ? "seed" : (r.port ?? "rank"));
function targetPort(ref, stage, placement) {
  return ref.poolId
    ? "pool"
    : (ref.port ??
        (stage?.format === "double-elimination"
          ? "upper"
          : (placement?.kind ?? "seed")));
}
function legacyRoutes(routes) {
  return routes.map((r) => ({
    ...r,
    source: withoutPort(r.source),
    target: withoutPort(r.target),
  }));
}
function withoutPort(ref) {
  const { port, ...rest } = ref;
  return rest;
}
function parsePorts(c) {
  c.routes.forEach((r, i) => {
    for (const side of ["source", "target"]) {
      const p = "/routes/" + i + "/" + side,
        ref = r[side];
      object(ref, ["stageId", "groupId", "poolId", "port"], p);
      if (
        ref.port !== undefined &&
        !(
          side === "source"
            ? ["rank", "qualification", "upper", "lower", "seed"]
            : ["upper", "lower", "seed", "slot"]
        ).includes(ref.port)
      )
        fail(p + "/port", "未知具名端口", r.id);
      if (
        ref.poolId &&
        ref.port !== undefined &&
        (side === "target" || ref.port !== "seed")
      )
        fail(p + "/port", "池输入无端口，池输出仅seed", r.id);
    }
  });
}
function portIssues(c) {
  const ds = [],
    stageById = new Map(c.stages.map((s) => [s.id, s])),
    poolById = new Map(c.pools.map((p) => [p.id, p]));
  const add = (code, path, reason, r, severity = "error", details = {}) =>
    ds.push(diagnostic(code, path, reason, r.id, severity, details, r.id));
  const groups = new Map(),
    sources = new Map();
  for (const [i, r] of c.routes.entries()) {
    const path = "/routes/" + i,
      s = stageById.get(r.source.stageId),
      t = stageById.get(r.target.stageId),
      sp = sourcePort(r.source),
      tp = targetPort(r.target, t, r.placement);
    let outputCapacity;
    if (r.source.poolId)
      outputCapacity = poolById.get(r.source.poolId).capacity;
    else if (sp === "rank") {
      if (
        ["single-elimination", "double-elimination"].includes(s.format) &&
        s.qualifyCount > 1
      )
        add(
          "OUTPUT_PORT_INVALID",
          path + "/source/port",
          "资格集合没有唯一竞技名次，请使用qualification通道",
          r,
        );
      outputCapacity = s.groupSize + (s.capacity / s.groupCount - s.groupSize);
    } else if (sp === "qualification") outputCapacity = s.qualifyCount;
    else if (
      ["upper", "lower"].includes(sp) &&
      s.format === "double-elimination" &&
      s.qualifyCount > 1
    )
      outputCapacity = sp === "upper" ? 1 : s.qualifyCount - 1;
    else
      add(
        "OUTPUT_PORT_INVALID",
        path + "/source/port",
        "此规则没有该输出通道",
        r,
      );
    if (r.selector?.kind === "rankRange" && r.selector.to > outputCapacity)
      add(
        "OUTPUT_RANGE_INVALID",
        path + "/selector/to",
        "范围超出此输出通道",
        r,
      );
    if (
      r.selector?.kind === "rankRange" &&
      r.quota > r.selector.to - r.selector.from + 1
    )
      add(
        "OUTPUT_QUOTA_INVALID",
        path + "/quota",
        "名额不能超过所选通道范围",
        r,
      );
    if (r.selector?.kind === "recordEquals" && sp !== "rank")
      add(
        "SELECTOR_INVALID",
        path + "/selector",
        "战绩筛选只适用于排名出口",
        r,
      );
    let capacity;
    if (r.target.poolId) capacity = poolById.get(r.target.poolId).capacity;
    else if (t.format === "double-elimination") {
      if (!["upper", "lower"].includes(tp))
        add(
          "INPUT_PORT_INVALID",
          path + "/target/port",
          "双败必须选择upper或lower",
          r,
        );
      capacity =
        tp === "lower" ? t.capacity / t.groupCount - t.groupSize : t.groupSize;
      if (capacity === 0)
        add(
          "INPUT_PORT_INVALID",
          path + "/target/port",
          "此规则未启用lower入口",
          r,
        );
    } else {
      if (!["seed", "slot"].includes(tp))
        add(
          "INPUT_PORT_INVALID",
          path + "/target/port",
          "普通输入必须选择seed或slot",
          r,
        );
      if (r.placement && tp !== r.placement.kind)
        add(
          "PLACEMENT_KIND_CONFLICT",
          path + "/placement/kind",
          "具名输入与落位类型不一致",
          r,
        );
      capacity = t.groupSize;
    }
    if (r.placement)
      r.placement.positions.forEach((v, j) => {
        if (v > capacity)
          add(
            "POSITION_INVALID",
            path + "/placement/positions/" + j,
            "位置超出该具名入口容量",
            r,
          );
      });
    const tk = JSON.stringify([
      r.target.poolId ?? r.target.groupId ?? r.target.stageId,
      t && t.format !== "double-elimination" ? "entry" : tp,
    ]);
    if (!groups.has(tk)) groups.set(tk, { routes: [], capacity });
    groups.get(tk).routes.push({ r, i });
    const sk = JSON.stringify([
      r.source.poolId ?? r.source.groupId ?? r.source.stageId,
      sp,
    ]);
    if (!sources.has(sk)) sources.set(sk, []);
    sources.get(sk).push({ r, i });
  }
  for (const { routes, capacity } of groups.values()) {
    const sum = routes.reduce((n, x) => n + (x.r.quota ?? 0), 0),
      positions = new Set(),
      kinds = new Set();
    if (sum > capacity)
      add(
        "CAPACITY_EXCEEDED",
        "/routes/" + routes[0].i + "/target",
        "输入超过具名端口容量",
        routes[0].r,
        "error",
        { total: sum, capacity },
      );
    for (const { r, i } of routes)
      if (r.placement) {
        kinds.add(r.placement.kind);
        r.placement.positions.forEach((v, j) => {
          if (positions.has(v))
            add(
              "POSITION_CONFLICT",
              "/routes/" + i + "/placement/positions/" + j,
              "目标具名入口席位重复",
              r,
            );
          positions.add(v);
        });
      }
    if (kinds.size > 1)
      add(
        "PLACEMENT_KIND_CONFLICT",
        "/routes/" + routes[0].i + "/placement/kind",
        "同一具名入口不能混用seed和slot",
        routes[0].r,
      );
  }
  for (const rs of sources.values())
    for (let a = 0; a < rs.length; a++)
      for (let b = a + 1; b < rs.length; b++) {
        const x = rs[a].r.selector,
          y = rs[b].r.selector,
          { r, i } = rs[b];
        if (!x || !y) continue;
        const overlap =
          x.kind === "all" ||
          y.kind === "all" ||
          (x.kind === y.kind &&
            (x.kind === "rankRange"
              ? Math.max(x.from, y.from) <= Math.min(x.to, y.to)
              : ["wins", "losses", "draws"].every((k) => x[k] === y[k])));
        if (overlap)
          add(
            "SELECTOR_OVERLAP",
            "/routes/" + i + "/selector",
            "来源具名名额范围重复消费",
            r,
          );
        else if (x.kind !== y.kind)
          add(
            "SELECTOR_INTERSECTION_UNKNOWN",
            "/routes/" + i + "/selector",
            "运行时必须复核不同筛选的交集",
            r,
            "conditional",
          );
      }
  // Different output views can refer to the same identity. Only execution can resolve that.
  for (let a = 0; a < c.routes.length; a++)
    for (let b = a + 1; b < c.routes.length; b++) {
      const x = c.routes[a],
        y = c.routes[b];
      if (
        (x.source.groupId ?? x.source.stageId) ===
          (y.source.groupId ?? y.source.stageId) &&
        !x.source.poolId &&
        !y.source.poolId &&
        sourcePort(x.source) !== sourcePort(y.source) &&
        !(
          ["upper", "lower"].includes(sourcePort(x.source)) &&
          ["upper", "lower"].includes(sourcePort(y.source))
        )
      )
        add(
          "OUTPUT_IDENTITY_PENDING",
          "/routes/" + b + "/source",
          "不同出口视图须复核真实身份，不能复制选手",
          y,
          "conditional",
        );
    }
  return ds;
}
module.exports = {
  legacyRoutes,
  parsePorts,
  portIssues,
  sourcePort,
  targetPort,
};
