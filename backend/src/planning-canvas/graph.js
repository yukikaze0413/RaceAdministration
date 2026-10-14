"use strict";
const { randomUUID, createHash } = require("node:crypto");
const V = require("./values");
const KINDS = [
  "source",
  "match",
  "swiss",
  "pool",
  "expander",
  "selector",
  "generator",
  "subgraph",
];
const PARAMS = {
  source: ["seats", "mapping"],
  match: [
    "bestOf",
    "batch",
    "winnerRule",
    "expectedTime",
    "durationMinutes",
    "condition",
  ],
  swiss: ["ruleVersion", "parameters", "ranking", "release"],
  pool: ["inputs"],
  expander: ["count"],
  selector: ["mode", "count", "seed", "algorithm"],
  generator: ["mode", "count", "seed", "algorithm"],
  subgraph: ["boundaries", "templateOrigin", "custom", "autoWinnerOutputs"],
};
const fail = (message, details = {}) => {
  const e = new Error(message);
  e.code = "INVALID_INPUT";
  Object.assign(e, details);
  throw e;
};
const digest = (g) =>
  createHash("sha256").update(JSON.stringify(g)).digest("hex");
const key = (e) => e.node + "\u0000" + e.port;
function object(v, keys) {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail("必须为对象");
  for (const k of Object.keys(v)) if (!keys.includes(k)) fail("未知字段：" + k);
}
function id(v) {
  if (typeof v !== "string" || !v.length || v.length > 200)
    fail("标识必须为非空字符串");
}
function parse(payload) {
  const g = structuredClone(payload);
  object(
    g,
    g?.schemaVersion === "canvas-v2"
      ? ["schemaVersion", "nodes", "edges", "stages"]
      : ["schemaVersion", "nodes", "edges"],
  );
  if (
    !["canvas-v1", "canvas-v2"].includes(g.schemaVersion) ||
    !Array.isArray(g.nodes) ||
    !Array.isArray(g.edges) ||
    g.nodes.length > 512 ||
    g.edges.length > 2048
  )
    fail("画布类型或规模非法");
  const ids = new Set();
  for (const n of g.nodes) {
    object(n, [
      "id",
      "kind",
      "name",
      "params",
      "position",
      "parentId",
      "display",
    ]);
    id(n.id);
    if (ids.has(n.id) || !KINDS.includes(n.kind))
      fail("节点身份重复或组件类型非法");
    ids.add(n.id);
    id(n.name);
    object(n.params, PARAMS[n.kind]);
    object(n.position, ["x", "y"]);
    if (
      ![n.position.x, n.position.y].every(
        (x) => Number.isFinite(x) && Math.abs(x) <= 200000,
      )
    )
      fail("坐标非法");
    if (n.display) {
      object(n.display, [
        "showLoser",
        "showSeeds",
        "collapsed",
        "hideDanglingInputs",
        "hideDanglingOutputs",
      ]);
      for (const v of Object.values(n.display))
        if (typeof v !== "boolean") fail("展示参数必须为布尔值");
    }
    if (n.kind === "source") {
      if (!Array.isArray(n.params.seats) || n.params.seats.length > 64)
        fail("席位集合非法");
      for (const seat of n.params.seats) {
        object(seat, ["ref", "label"]);
        id(seat.ref);
        id(seat.label);
      }
      if (n.params.mapping) {
        if (
          Array.isArray(n.params.mapping) ||
          typeof n.params.mapping !== "object" ||
          Object.values(n.params.mapping).some((v) => !Number.isFinite(v))
        )
          fail("种子映射数值非法");
      }
    }
    if (n.kind === "swiss" && n.params.ruleVersion) {
      const rule =
        require("../tournament-configuration/domain/formats/registry").definition(
          n.params.ruleVersion,
        );
      if (
        !rule ||
        !["fixed-swiss", "threshold-swiss", "major-like"].includes(rule.format)
      )
        fail("未知瑞士规则版本");
      require("../tournament-configuration/domain/structure").parseStructure(
        {
          entrantKind: "individual",
          structureVersion: "structure-v2",
          routingVersion: "routing-v2",
          stages: [
            {
              id: "s",
              name: "类型核验",
              order: 1,
              format: rule.format,
              ruleVersion: n.params.ruleVersion,
              groupSize: rule.defaults.groupSize,
              groupCount: 1,
              qualifyCount: rule.defaults.qualifyCount,
              parameters: n.params.parameters ?? {},
              groups: [{ id: "g", stageId: "s" }],
            },
          ],
          pools: [],
          routes: [],
        },
        "canvas-types",
      );
    }
    for (const k of ["count", "bestOf", "seed", "durationMinutes"])
      if (
        n.params[k] != null &&
        (!Number.isSafeInteger(n.params[k]) || n.params[k] < 0)
      )
        fail("整数参数非法：" + k);
    if (n.params.seed > 4294967295 || n.params.count > 64)
      fail("随机种子或容量超出范围");
    if (
      n.params.mode != null &&
      !(
        n.kind === "selector" ? ["top", "random"] : ["reverse", "random"]
      ).includes(n.params.mode)
    )
      fail("模式非法");
    if (n.params.algorithm != null && n.params.algorithm !== "mulberry32-v1")
      fail("随机算法版本非法");
    if (n.kind === "match") {
      if (n.params.condition != null) {
        object(n.params.condition, ["kind", "matchKey", "side"]);
        if (
          n.params.condition.kind !== "winner-side" ||
          ![0, 1].includes(n.params.condition.side)
        )
          fail("条件规则非法");
        id(n.params.condition.matchKey);
      }
      if (n.params.batch != null && typeof n.params.batch !== "string")
        fail("批次必须为字符串");
      if (
        n.params.winnerRule != null &&
        !["unique-winner-v1", "none"].includes(n.params.winnerRule)
      )
        fail("胜败规则非法");
      if (
        n.params.expectedTime != null &&
        typeof n.params.expectedTime !== "string"
      )
        fail("预计时间必须为字符串");
    }
    if (n.kind === "subgraph" && n.params.templateOrigin != null) {
      object(n.params.templateOrigin, ["ruleVersion"]);
      id(n.params.templateOrigin.ruleVersion);
    }
    if (
      n.kind === "pool" &&
      (!Array.isArray(n.params.inputs) ||
        n.params.inputs.length > 128 ||
        new Set(n.params.inputs).size !== n.params.inputs.length ||
        n.params.inputs.some(
          (p) => typeof p !== "string" || !p.startsWith("in:"),
        ))
    )
      fail("Pool 输入端口非法");
    if (n.kind === "subgraph") {
      if (
        n.params.autoWinnerOutputs !== undefined &&
        typeof n.params.autoWinnerOutputs !== "boolean"
      )
        fail("自动胜者出口开关非法");
      if (!Array.isArray(n.params.boundaries)) fail("子图边界非法");
      const ports = new Set();
      for (const b of n.params.boundaries) {
        object(b, ["id", "name", "direction", "type", "target"]);
        id(b.id);
        id(b.name);
        if (
          ports.has(b.id) ||
          !["input", "output"].includes(b.direction) ||
          ![
            "seat",
            "collection",
            "seed-map",
            "seed-template",
            "seat-or-collection",
            "seed-sort",
          ].includes(b.type)
        )
          fail("边界类型或身份非法");
        ports.add(b.id);
        object(b.target, ["node", "port"]);
        id(b.target.node);
        id(b.target.port);
      }
    }
  }
  const by = new Map(g.nodes.map((n) => [n.id, n]));
  for (const n of g.nodes) {
    const visited = new Set([n.id]);
    let p = n.parentId;
    while (p) {
      if (visited.has(p) || by.get(p)?.kind !== "subgraph")
        fail("子图层级循环或父级不存在");
      visited.add(p);
      p = by.get(p).parentId;
    }
  }
  const edgeIds = new Set();
  for (const e of g.edges) {
    object(e, ["id", "from", "to"]);
    id(e.id);
    if (edgeIds.has(e.id)) fail("重复连线标识");
    edgeIds.add(e.id);
    for (const end of [e.from, e.to]) {
      object(end, ["node", "port"]);
      id(end.node);
      id(end.port);
      if (!by.has(end.node)) fail("连线节点不存在");
    }
  }
  if (g.schemaVersion === "canvas-v2") {
    if (!Array.isArray(g.stages) || g.stages.length > 512) fail("阶段列表非法");
    const stageIds = new Set(),
      orders = new Set(),
      members = new Set();
    for (const stage of g.stages) {
      object(stage, ["id", "name", "order", "nodeIds"]);
      id(stage.id);
      id(stage.name);
      if (
        stageIds.has(stage.id) ||
        orders.has(stage.order) ||
        !Number.isSafeInteger(stage.order) ||
        stage.order < 1
      )
        fail("阶段身份或顺序非法");
      stageIds.add(stage.id);
      orders.add(stage.order);
      if (!Array.isArray(stage.nodeIds) || stage.nodeIds.length > 512)
        fail("阶段成员非法");
      for (const member of stage.nodeIds) {
        id(member);
        if (
          members.has(member) ||
          !["match", "swiss"].includes(by.get(member)?.kind)
        )
          fail("阶段成员重复或不存在");
        members.add(member);
      }
    }
  }
  return g;
}
function boundaries(g, n) {
  return n.params.boundaries.flatMap((b) => {
    if (b.direction !== "output" || b.type !== "collection") return [b];
    const origin = endpoint(g, b.target, "output");
    return [
      b,
      {
        id: b.id + ":seeds",
        name: b.name + " 种子映射",
        direction: "output",
        type: "seed-map",
        target: { node: origin.node, port: "seeds" },
        derived: true,
      },
    ];
  });
}
function endpoint(g, end, direction, seen = new Set()) {
  object(end, ["node", "port"]);
  id(end.node);
  id(end.port);
  if (seen.has(key(end))) fail("边界映射循环");
  seen.add(key(end));
  const n = g.nodes.find((n) => n.id === end.node);
  if (!n) fail("端口节点不存在");
  if (n.kind !== "subgraph") return end;
  const b = boundaries(g, n).find(
    (b) => b.id === end.port && b.direction === direction,
  );
  if (!b) fail("子图边界不存在");
  let child = g.nodes.find((x) => x.id === b.target.node);
  let p = child?.parentId,
    inside = false;
  while (p) {
    if (p === n.id) {
      inside = true;
      break;
    }
    p = g.nodes.find((x) => x.id === p)?.parentId;
  }
  if (!inside) fail("边界映射必须指向内部组件");
  return endpoint(g, b.target, direction, seen);
}
function incoming(g, n, p) {
  return g.edges.find(
    (e) => key(endpoint(g, e.to, "input")) === key({ node: n.id, port: p }),
  );
}
function capacity(g, n, seen = new Set()) {
  if (!n || seen.has(n.id)) return null;
  seen = new Set(seen).add(n.id);
  if (n.kind === "source") return n.params.seats.length;
  if (n.kind === "selector") return n.params.count;
  const from = (p) => {
    const e = incoming(g, n, p);
    if (!e) return null;
    const x = endpoint(g, e.from, "output"),
      s = g.nodes.find((n) => n.id === x.node);
    return x.port.startsWith("seat:") || s.kind === "match"
      ? 1
      : capacity(g, s, seen);
  };
  if (n.kind === "pool") {
    const sizes = n.params.inputs.filter((p) => incoming(g, n, p)).map(from);
    return sizes.some((x) => x == null)
      ? null
      : sizes.reduce((a, b) => a + b, 0);
  }
  if (["swiss", "expander"].includes(n.kind)) return from("collection");
  return null;
}
function ports(g, n) {
  const p = (id, direction, type, label = id) => ({
    id,
    direction,
    type,
    label,
  });
  const collection = () => [
    p("collection", "output", "collection", "席位集合"),
    p("seeds", "output", "seed-map", "种子映射"),
  ];
  switch (n.kind) {
    case "source":
      return [
        p("collection", "output", "collection", "初始席位集合"),
        p("seeds", "output", "seed-map", "初始种子"),
        ...(n.params.mapping
          ? [p("externalSeeds", "output", "seed-map", "外部种子映射")]
          : []),
        ...n.params.seats.map((_, i) =>
          p("seat:" + (i + 1), "output", "seat", "席位 " + (i + 1)),
        ),
      ];
    case "match":
      return [
        p("A", "input", "seat", "A"),
        p("B", "input", "seat", "B"),
        p("W", "output", "seat", "W · 胜者"),
        p("L", "output", "seat", "L · 败者"),
      ];
    case "swiss":
    case "selector":
      return [
        p("collection", "input", "collection", "席位集合"),
        ...collection(),
      ];
    case "pool":
      return [
        ...n.params.inputs.map((id, i) =>
          p(id, "input", "seat-or-collection", "输入 " + (i + 1)),
        ),
        p("sort", "input", "seed-sort", "排序"),
        ...collection(),
      ];
    case "expander":
      return [
        p("collection", "input", "collection", "席位集合"),
        ...Array.from(
          { length: n.params.count ?? capacity(g, n) ?? 0 },
          (_, i) => p("seat:" + (i + 1), "output", "seat", "Seed " + (i + 1)),
        ),
      ];
    case "generator":
      return [p("sort", "output", "seed-template", "位置排序模板")];
    case "subgraph":
      return boundaries(g, n).map((b) => p(b.id, b.direction, b.type, b.name));
  }
}
function accepts(source, target) {
  return (
    source === target ||
    (target === "seat-or-collection" &&
      ["seat", "collection"].includes(source)) ||
    (target === "seed-sort" && ["seed-map", "seed-template"].includes(source))
  );
}
function checkEdges(g) {
  const targets = new Set(),
    sources = new Set(),
    adj = new Map();
  for (const n of g.nodes.filter((n) => n.kind === "subgraph"))
    for (const boundary of n.params.boundaries) {
      const e = endpoint(
          g,
          { node: n.id, port: boundary.id },
          boundary.direction,
        ),
        child = g.nodes.find((n) => n.id === e.node),
        p = ports(g, child).find(
          (p) => p.id === e.port && p.direction === boundary.direction,
        );
      if (!p || p.type !== boundary.type) fail("子图边界类型或内部端口不匹配");
    }
  for (const e of g.edges) {
    const from = endpoint(g, e.from, "output"),
      to = endpoint(g, e.to, "input");
    const a = g.nodes.find((n) => n.id === from.node),
      b = g.nodes.find((n) => n.id === to.node);
    const ap = ports(g, a).find(
        (p) => p.id === from.port && p.direction === "output",
      ),
      bp = ports(g, b).find((p) => p.id === to.port && p.direction === "input");
    if (!ap || !bp) fail("连线端口不存在");
    if (!accepts(ap.type, bp.type)) fail("端口类型不匹配");
    const physicalA = g.nodes.find((n) => n.id === e.from.node),
      physicalB = g.nodes.find((n) => n.id === e.to.node);
    if ((physicalA.parentId ?? null) !== (physicalB.parentId ?? null))
      fail("跨子图连线必须使用边界");
    if (targets.has(key(to)) || (ap.type === "seat" && sources.has(key(from))))
      fail("端口连接冲突");
    targets.add(key(to));
    if (ap.type === "seat") sources.add(key(from));
    if (!adj.has(a.id)) adj.set(a.id, []);
    adj.get(a.id).push(b.id);
  }
  const done = new Set(),
    active = new Set();
  const visit = (n) => {
    if (active.has(n)) fail("循环依赖");
    if (done.has(n)) return;
    active.add(n);
    for (const d of adj.get(n) ?? []) visit(d);
    active.delete(n);
    done.add(n);
  };
  for (const n of g.nodes) visit(n.id);
}
function analyze(payload, resolutions) {
  const g = parse(payload),
    r = require("./evaluate").analyze(g, resolutions);
  return g.schemaVersion === "canvas-v2" ? require("./waves").plan(g, r) : r;
}
function preview(payload, canvasId, validated) {
  const r = validated ?? analyze(payload);
  if (!r.valid) fail("保存版本尚未验证就绪", { diagnostics: r.diagnostics });
  return {
    matches: r.matches.map((m) => ({
      ...m,
      planKey:
        "canvas-plan-v1/" +
        encodeURIComponent(canvasId) +
        "/" +
        encodeURIComponent(m.id),
    })),
    windows: r.windows.map((w) => ({
      ...w,
      planKey:
        "canvas-plan-v1/" + encodeURIComponent(canvasId) + "/" + w.planKey,
    })),
    conditions: r.diagnostics.filter((d) => d.severity !== "error"),
    ...(r.wavePlan
      ? {
          wavePlan: r.wavePlan,
          wavePlanDigest: r.wavePlanDigest,
          status: r.status,
          stages: payload.stages,
        }
      : {}),
  };
}
function sample(name) {
  if (
    ![
      "empty",
      "swiss-eight",
      "single",
      "double",
      "gsl",
      "partial-pool",
      "invalid",
    ].includes(name)
  ) {
    const error = new Error("未知样例");
    error.code = "NOT_FOUND";
    throw error;
  }
  return require("./samples").sample(name);
}
function syncFreeBoundaries(g) {
  const depth = (n) => {
    let d = 0;
    while (n.parentId) {
      d++;
      n = g.nodes.find((x) => x.id === n.parentId);
    }
    return d;
  };
  const groups = g.nodes
    .filter((n) => n.kind === "subgraph" && n.params.custom)
    .sort((a, b) => depth(b) - depth(a));
  for (const group of groups) {
    const inside = (id) => {
      let n = g.nodes.find((x) => x.id === id);
      while (n?.parentId) {
        if (n.parentId === group.id) return true;
        n = g.nodes.find((x) => x.id === n.parentId);
      }
      return false;
    };
    for (const n of g.nodes.filter((n) => n.parentId === group.id)) {
      for (const p of ports(g, n)) {
        const end = { node: n.id, port: p.id },
          origin = endpoint(g, end, p.direction);
        const internallyConnected = g.edges.some((e) => {
          const side = p.direction === "input" ? "to" : "from",
            other = side === "to" ? "from" : "to";
          return (
            key(endpoint(g, e[side], p.direction)) === key(origin) &&
            inside(e[other].node)
          );
        });
        if (internallyConnected) continue;
        if (
          boundaries(g, group).some(
            (b) =>
              b.direction === p.direction &&
              key(endpoint(g, b.target, p.direction)) === key(origin),
          )
        )
          continue;
        group.params.boundaries.push({
          id: randomUUID(),
          name: n.name + " " + p.label,
          direction: p.direction,
          type: p.type,
          target: end,
        });
      }
    }
  }
  return g;
}
function edit(graph, action) {
  const g = parse(graph);
  object(action, [
    "type",
    "from",
    "to",
    "edgeId",
    "node",
    "id",
    "params",
    "position",
    "display",
    "selected",
    "name",
    "boundary",
    "confirmed",
    "expectedDigest",
    "direction",
    "port",
    "parentId",
    "order",
    "stageIds",
  ]);
  if (typeof action.type !== "string") fail("必须指定编辑操作");
  if (
    action.selected !== undefined &&
    (!Array.isArray(action.selected) ||
      action.selected.length > 512 ||
      action.selected.some((x) => typeof x !== "string"))
  )
    fail("所选组件必须为标识数组");
  if (action.type === "encapsulate" && !Array.isArray(action.selected))
    fail("封装必须指定所选组件");
  if (action.params !== undefined)
    object(
      action.params,
      PARAMS[g.nodes.find((n) => n.id === action.id)?.kind] ?? [],
    );
  if (
    ["removeBoundary", "expose", "customize", "ungroup"].includes(
      action.type,
    ) &&
    g.nodes.find((n) => n.id === action.id)?.kind !== "subgraph"
  )
    fail("请选择子图");
  if (action.type === "expose") {
    object(action.boundary, ["id", "name", "direction", "type", "target"]);
    id(action.boundary.id);
    id(action.boundary.name);
    if (!["input", "output"].includes(action.boundary.direction))
      fail("边界方向非法");
  }
  const edge = g.edges.find((e) => e.id === action.edgeId);
  const touchedIds = [
    action.id,
    action.node?.parentId,
    action.parentId,
    ...(action.selected ?? []),
    action.from?.node,
    action.to?.node,
    edge?.from.node,
    edge?.to.node,
  ].filter(Boolean);
  for (const touched of touchedIds) {
    const n = g.nodes.find((n) => n.id === touched);
    if (
      n?.kind === "subgraph" &&
      !n.params.custom &&
      (["removeBoundary", "expose"].includes(action.type) ||
        action.node?.parentId === n.id ||
        action.parentId === n.id)
    )
      fail("请先转为自定义");
    let p = n?.parentId;
    while (p) {
      const parent = g.nodes.find((n) => n.id === p);
      if (
        parent.params.custom === false &&
        (["delete", "encapsulate", "ungroup", "connect", "disconnect"].includes(
          action.type,
        ) ||
          action.params)
      )
        fail("请先将预设转为自定义");
      p = parent.parentId;
    }
  }
  if (
    ["createStage", "updateStage", "deleteStage", "reorderStages"].includes(
      action.type,
    )
  ) {
    if (g.schemaVersion !== "canvas-v2") fail("请先迁移画布");
    const stage = g.stages.find((s) => s.id === action.id);
    if (
      action.type !== "createStage" &&
      action.type !== "reorderStages" &&
      !stage
    )
      fail("阶段不存在");
    if (action.type === "deleteStage")
      g.stages = g.stages.filter((s) => s.id !== action.id);
    else if (action.type === "reorderStages") {
      if (
        !Array.isArray(action.stageIds) ||
        new Set(action.stageIds).size !== g.stages.length ||
        action.stageIds.length !== g.stages.length ||
        action.stageIds.some((x) => !g.stages.some((s) => s.id === x))
      )
        fail("阶段排序非法");
      g.stages.forEach((s) => (s.order = action.stageIds.indexOf(s.id) + 1));
    } else {
      const selected = action.selected;
      let members = stage?.nodeIds ?? [];
      if (selected) {
        if (selected.some((x) => !g.nodes.some((n) => n.id === x)))
          fail("所选组件不存在");
        const included = new Set(selected);
        for (let changed = true; changed;) {
          changed = false;
          for (const n of g.nodes)
            if (included.has(n.parentId) && !included.has(n.id)) {
              included.add(n.id);
              changed = true;
            }
        }
        members = g.nodes
          .filter(
            (n) => included.has(n.id) && ["match", "swiss"].includes(n.kind),
          )
          .map((n) => n.id)
          .sort();
        if (!members.length && !(action.type === "updateStage" && selected.length === 0))
          fail("请选择比赛或瑞士轮");
        const impact = g.stages
          .filter((s) => s.id !== action.id)
          .flatMap((s) =>
            s.nodeIds
              .filter((x) => members.includes(x))
              .map((x) => ({
                kind: "stage",
                id: x,
                from: s.name,
                to: action.name ?? stage?.name ?? "新阶段",
              })),
          );
        if (impact.length && !action.confirmed)
          return {
            graph: structuredClone(graph),
            requiresConfirmation: true,
            impact,
            digest: digest(graph),
          };
        if (impact.length && action.expectedDigest !== digest(graph))
          fail("草稿已变化，请重新检查影响");
        g.stages
          .filter((s) => s.id !== action.id)
          .forEach(
            (s) => (s.nodeIds = s.nodeIds.filter((x) => !members.includes(x))),
          );
      }
      if (action.type === "createStage") {
        g.stages.push({
          id: action.id ?? randomUUID(),
          name: action.name ?? "新阶段",
          order: Math.max(0, ...g.stages.map((s) => s.order)) + 1,
          nodeIds: members,
        });
      } else {
        if (action.name !== undefined) stage.name = action.name;
        stage.nodeIds = members;
        if (action.order !== undefined) {
          if (!Number.isSafeInteger(action.order) || action.order < 1 || action.order > g.stages.length)
            fail("阶段排序非法");
          const ordered = g.stages.filter((s) => s.id !== stage.id).sort((a, b) => a.order - b.order);
          ordered.splice(action.order - 1, 0, stage);
          ordered.forEach((s, i) => (s.order = i + 1));
        }
      }
    }
  } else if (action.type === "syncBoundaries") {
    // Stateless normalization: saving the returned draft remains explicit.
  } else if (action.type === "connect") {
    const from = endpoint(g, action.from, "output"),
      to = endpoint(g, action.to, "input");
    const n = g.nodes.find((n) => n.id === from.node),
      p = ports(g, n).find(
        (p) => p.id === from.port && p.direction === "output",
      );
    if (!p) fail("来源端口不存在");
    if (
      g.edges.some(
        (e) => key(e.from) === key(action.from) && key(e.to) === key(action.to),
      )
    )
      return { graph: g };
    g.edges = g.edges.filter(
      (e) =>
        key(endpoint(g, e.to, "input")) !== key(to) &&
        !(
          p.type === "seat" && key(endpoint(g, e.from, "output")) === key(from)
        ),
    );
    g.edges.push({ id: randomUUID(), from: action.from, to: action.to });
    const target = g.nodes.find((n) => n.id === to.node);
    if (
      target.kind === "pool" &&
      target.params.inputs.includes(to.port) &&
      !target.params.inputs.some((p) => !incoming(g, target, p))
    ) {
      let index = 1;
      while (target.params.inputs.includes("in:" + index)) index++;
      target.params.inputs.push("in:" + index);
    }
    checkEdges(g);
  } else if (action.type === "preset") {
    if (!["single", "gsl", "double"].includes(action.name)) fail("未知预设");
    const id = action.id ?? randomUUID(),
      fixture = sample(action.name),
      ids = new Map(fixture.nodes.map((n) => [n.id, id + ":" + n.id]));
    fixture.nodes = fixture.nodes
      .filter((n) => n.kind !== "source")
      .map((n) => ({
        ...n,
        id: ids.get(n.id),
        params: {
          ...n.params,
          ...(n.params.condition
            ? {
                condition: {
                  ...n.params.condition,
                  matchKey: ids.get(n.params.condition.matchKey),
                },
              }
            : {}),
        },
      }));
    fixture.edges = fixture.edges
      .filter((e) => e.from.node !== "source")
      .map((e) => ({
        id: randomUUID(),
        from: { node: ids.get(e.from.node), port: e.from.port },
        to: { node: ids.get(e.to.node), port: e.to.port },
      }));
    const wrapped = edit(fixture, {
      type: "encapsulate",
      id,
      name: { single: "八人单败", gsl: "经典 GSL", double: "八人双败" }[
        action.name
      ],
      selected: fixture.nodes.map((n) => n.id),
    }).graph;
    const group = wrapped.nodes.find((n) => n.id === id);
    // Presets keep their versioned, stable qualification ports below.
    group.params.boundaries = [];
    group.params.boundaries.push({
      id: "collection",
      name: "参赛集合",
      direction: "input",
      type: "collection",
      target: { node: ids.get("expand"), port: "collection" },
    });
    const outs =
      action.name === "gsl"
        ? ["M3", "M5"]
        : [fixture.nodes.filter((n) => n.kind === "match").at(-1).id];
    outs.forEach((m, i) =>
      group.params.boundaries.push({
        id: "qualification:" + (i + 1),
        name: "晋级 " + (i + 1),
        direction: "output",
        type: "seat",
        target: { node: ids.get(m) ?? m, port: "W" },
      }),
    );
    group.params.templateOrigin = {
      ruleVersion: {
        single: "single-cut-v2",
        gsl: "gsl-classic-v1",
        double: "de-standard-v1",
      }[action.name],
    };
    group.params.custom = false;
    if (action.parentId) group.parentId = action.parentId;
    g.nodes.push(...wrapped.nodes);
    g.edges.push(...wrapped.edges);
    if (g.schemaVersion === "canvas-v2")
      for (const n of wrapped.nodes)
        if (n.kind === "match") delete n.params.batch;
  } else if (action.type === "add") {
    const n = action.node ?? require("./samples").node(action.id);
    g.nodes.push(n);
  } else if (action.type === "disconnect")
    g.edges = g.edges.filter((e) => e.id !== action.edgeId);
  else if (
    action.type === "update" ||
    action.type === "delete" ||
    action.type === "removeBoundary" ||
    action.type === "expose" ||
    action.type === "customize"
  ) {
    const n = g.nodes.find((n) => n.id === action.id);
    if (!n) fail("节点不存在");
    if (action.type === "update") {
      if (action.params) n.params = { ...n.params, ...action.params };
      if (action.name !== undefined) n.name = action.name;
      if (action.position) n.position = action.position;
      if (action.display) n.display = { ...n.display, ...action.display };
    } else if (action.type === "customize") {
      if (n.kind !== "subgraph") fail("请选择子图");
      n.params.custom = true;
    } else if (action.type === "removeBoundary")
      n.params.boundaries = n.params.boundaries.filter(
        (b) => b.id !== action.port,
      );
    else if (action.type === "expose") {
      if (n.kind !== "subgraph") fail("请选择子图");
      const b = action.boundary;
      const real = endpoint(g, b.target, b.direction),
        target = g.nodes.find((n) => n.id === real.node),
        p = ports(g, target).find(
          (p) => p.id === real.port && p.direction === b.direction,
        );
      if (!p) fail("内部端口不存在");
      n.params.boundaries.push({ ...b, type: p.type });
      endpoint(g, { node: n.id, port: b.id }, b.direction);
    } else {
      const removed = new Set([n.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const x of g.nodes)
          if (removed.has(x.parentId) && !removed.has(x.id)) {
            removed.add(x.id);
            changed = true;
          }
      }
      g.nodes = g.nodes.filter((x) => !removed.has(x.id));
    }
    const impact = [];
    for (const e of g.edges) {
      try {
        for (const [direction, end] of [
          ["output", e.from],
          ["input", e.to],
        ]) {
          const actual = endpoint(g, end, direction),
            node = g.nodes.find((n) => n.id === actual.node);
          if (
            !ports(g, node).some(
              (p) => p.id === actual.port && p.direction === direction,
            )
          )
            throw Error("端口移除");
        }
      } catch {
        impact.push({ kind: "edge", id: e.id, from: e.from, to: e.to });
      }
    }
    for (const group of g.nodes.filter((n) => n.kind === "subgraph"))
      for (const b of group.params.boundaries) {
        try {
          endpoint(g, { node: group.id, port: b.id }, b.direction);
        } catch {
          impact.push({ kind: "boundary", id: b.id, node: group.id });
        }
      }
    if (impact.length) {
      const originalDigest = digest(graph);
      if (!action.confirmed)
        return {
          graph: structuredClone(graph),
          requiresConfirmation: true,
          impact,
          digest: originalDigest,
        };
      if (action.expectedDigest !== originalDigest)
        fail("草稿已变化，请重新检查影响");
      g.edges = g.edges.filter(
        (e) => !impact.some((i) => i.kind === "edge" && i.id === e.id),
      );
      for (const group of g.nodes.filter((n) => n.kind === "subgraph"))
        group.params.boundaries = group.params.boundaries.filter(
          (b) =>
            !impact.some(
              (i) =>
                i.kind === "boundary" && i.node === group.id && i.id === b.id,
            ),
        );
    }
  } else if (action.type === "encapsulate") {
    const selected = new Set(action.selected);
    const children = g.nodes.filter((n) => selected.has(n.id));
    if (
      !children.length ||
      children.length !== selected.size ||
      children.some(
        (n) => (n.parentId ?? null) !== (children[0].parentId ?? null),
      )
    )
      fail("请选择同一层级的组件");
    const group = require("./samples").node(
      "subgraph",
      action.id ?? randomUUID(),
      { boundaries: [], custom: true },
      {
        x: Math.min(...children.map((n) => n.position.x)),
        y: Math.min(...children.map((n) => n.position.y)),
      },
    );
    group.name = action.name || "子图";
    if (children[0].parentId) group.parentId = children[0].parentId;
    const boundary = (end, direction) => {
      let b = group.params.boundaries.find(
        (b) => b.direction === direction && key(b.target) === key(end),
      );
      if (!b) {
        const n = g.nodes.find((n) => n.id === end.node),
          p = ports(g, n).find(
            (p) => p.id === end.port && p.direction === direction,
          );
        b = {
          id: randomUUID(),
          name: n.name + " " + p.label,
          direction,
          type: p.type,
          target: end,
        };
        group.params.boundaries.push(b);
      }
      return { node: group.id, port: b.id };
    };
    const terminalWinners = children.flatMap((n) =>
      ports(g, n)
        .filter((p) => {
          if (p.direction !== "output" || p.type !== "seat") return false;
          const origin = endpoint(g, { node: n.id, port: p.id }, "output");
          return (
            origin.port === "W" &&
            g.nodes.find((x) => x.id === origin.node)?.kind === "match" &&
            !g.edges.some(
              (e) => key(endpoint(g, e.from, "output")) === key(origin),
            )
          );
        })
        .map((p) => ({ node: n.id, port: p.id })),
    );
    for (const e of g.edges) {
      const a = selected.has(e.from.node),
        b = selected.has(e.to.node);
      if (a && !b) e.from = boundary(e.from, "output");
      if (b && !a) e.to = boundary(e.to, "input");
    }
    terminalWinners.forEach((end) => boundary(end, "output"));
    children.forEach((n) => (n.parentId = group.id));
    g.nodes.push(group);
  } else if (action.type === "ungroup") {
    const n = g.nodes.find((n) => n.id === action.id);
    if (n?.kind !== "subgraph") fail("请选择子图");
    for (const e of g.edges)
      for (const [side, direction] of [
        ["from", "output"],
        ["to", "input"],
      ])
        if (e[side].node === n.id)
          e[side] = n.params.boundaries.find(
            (b) => b.id === e[side].port && b.direction === direction,
          ).target;
    for (const other of g.nodes.filter(
      (x) => x.kind === "subgraph" && x.id !== n.id,
    ))
      for (const b of other.params.boundaries)
        if (b.target.node === n.id)
          b.target = n.params.boundaries.find(
            (x) => x.id === b.target.port && x.direction === b.direction,
          ).target;
    for (const child of g.nodes.filter((x) => x.parentId === n.id)) {
      if (n.parentId) child.parentId = n.parentId;
      else delete child.parentId;
    }
    g.nodes = g.nodes.filter((x) => x.id !== n.id);
  } else fail("未知编辑操作");
  syncFreeBoundaries(g);
  if (g.stages)
    for (const stage of g.stages)
      stage.nodeIds = stage.nodeIds.filter((id) =>
        g.nodes.some((n) => n.id === id),
      );
  const result = parse(g);
  checkEdges(result);
  if (action.type === "connect" && g.schemaVersion === "canvas-v1") {
    const before = analyze(graph)
      .diagnostics.filter((d) => d.code === "DUPLICATE_ASSIGNMENT")
      .map((d) => JSON.stringify(d));
    const fresh = analyze(result).diagnostics.filter(
      (d) =>
        d.code === "DUPLICATE_ASSIGNMENT" &&
        !before.includes(JSON.stringify(d)),
    );
    if (fresh.length)
      fail("同批次重复参与，候选连接未应用", { diagnostics: fresh });
  }
  return { graph: result };
}
function migrate(payload) {
  const graph = parse(payload);
  if (graph.schemaVersion === "canvas-v2") return { graph, changes: [] };
  const changes = graph.nodes
    .filter((n) => n.kind === "match" && n.params.batch)
    .map((n) => ({ id: n.id, name: n.name, batch: n.params.batch }));
  graph.schemaVersion = "canvas-v2";
  const nodeIds = graph.nodes
    .filter((n) => ["match", "swiss"].includes(n.kind))
    .map((n) => n.id)
    .sort();
  graph.stages = nodeIds.length
    ? [{ id: "stage-initial", name: "阶段 1", order: 1, nodeIds }]
    : [];
  for (const n of graph.nodes) if (n.kind === "match") delete n.params.batch;
  return { graph: parse(graph), changes };
}
module.exports = {
  migrate,
  boundaries,
  analyze,
  edit,
  parse,
  ports,
  capacity,
  endpoint,
  incoming,
  checkEdges,
  digest,
  KINDS,
  key,
  fail,
  preview,
  sample,
};
