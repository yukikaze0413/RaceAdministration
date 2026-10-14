"use strict";
const G = require("./graph"),
  V = require("./values");
function analyze(g, resolutions = {}) {
  const diagnostics = [],
    memo = new Map(),
    active = new Set(),
    by = new Map(g.nodes.map((n) => [n.id, n]));
  const report = (code, n, port, reason, severity = "error") =>
    diagnostics.push({
      code,
      objectId: n.id,
      port,
      path: "/nodes/" + n.id + (port ? "/ports/" + port : ""),
      reason,
      severity,
    });
  try {
    G.checkEdges(g);
  } catch (e) {
    diagnostics.push({
      code: "GRAPH_INVALID",
      objectId: null,
      path: "/edges",
      reason: e.message,
      severity: "error",
    });
    return {
      valid: false,
      previewReady: false,
      diagnostics,
      nodes: g.nodes.map((n) => ({ ...n, ports: [] })),
      values: {},
      matches: [],
      windows: [],
    };
  }
  const collection = (items) => ({
    type: "collection",
    items,
    capacity: items.length,
  });
  const candidates = (x) => x.candidates ?? [x.ref];
  const alternatives = (x) =>
    x.alternatives ??
    candidates(x).map((ref) => ({ ref, choices: x.choices ?? {} }));
  function value(end) {
    const physical = end;
    end = G.endpoint(g, end, "output");
    const n = by.get(end.node),
      out = calculate(n);
    return (
      out[end.port] ?? { type: "pending", capacity: null, source: physical }
    );
  }
  function calculate(n) {
    if (memo.has(n.id)) return memo.get(n.id);
    if (active.has(n.id)) return {};
    active.add(n.id);
    const out = {};
    const input = (port, required = true) => {
      const e = G.incoming(g, n, port);
      if (!e) {
        if (required) report("INPUT_REQUIRED", n, port, "请连接输入 " + port);
        return null;
      }
      return value(e.from);
    };
    const emit = (items) => {
      out.collection = collection(items);
      out.seeds = {
        type: "seed-map",
        mapping: V.seedMap(items),
        provenance: items.map((x) => ({
          ref: x.ref,
          source: x.provenance ?? null,
        })),
      };
    };
    try {
      switch (n.kind) {
        case "source": {
          if (!n.params.seats.length)
            report(
              "CAPACITY_REQUIRED",
              n,
              "collection",
              "请配置至少一个未来席位",
            );
          if (
            new Set(n.params.seats.map((x) => x.ref)).size !==
            n.params.seats.length
          )
            throw Error("重复席位");
          emit(n.params.seats.map((x) => ({ ...x, candidates: [x.ref] })));
          if (n.params.mapping)
            out.externalSeeds = { type: "seed-map", mapping: n.params.mapping };
          n.params.seats.forEach(
            (s, i) =>
              (out["seat:" + (i + 1)] = {
                type: "seat",
                seat: out.collection.items[i],
              }),
          );
          break;
        }
        case "pool": {
          const inputs = n.params.inputs
            .map((p) => input(p, false))
            .filter(Boolean);
          if (!inputs.length)
            report("INPUT_REQUIRED", n, "in:1", "请连接至少一个席位或集合来源");
          const sort = input("sort", false);
          emit(
            V.pool(
              inputs.map((x) =>
                x.type === "seat" ? (x.seat ? [x.seat] : []) : (x.items ?? []),
              ),
              sort?.type === "seed-template" ? sort : sort?.mapping,
            ),
          );
          break;
        }
        case "selector": {
          const x = input("collection");
          if (x)
            emit(
              V.select(x.items, n.params.mode, n.params.count, n.params.seed),
            );
          break;
        }
        case "generator":
          out.sort = V.template(n.params.count, n.params.mode, n.params.seed);
          break;
        case "expander": {
          const x = input("collection");
          if (x) {
            if (n.params.count != null && n.params.count !== x.items.length)
              report(
                "CAPACITY_MISMATCH",
                n,
                "collection",
                "展开容量与集合数量不一致",
              );
            const limit = n.params.count ?? x.items.length;
            for (let i = 0; i < Math.min(limit, x.items.length); i++)
              out["seat:" + (i + 1)] = { type: "seat", seat: x.items[i] };
          }
          break;
        }
        case "swiss": {
          const x = input("collection");
          if (!x) break;
          const registry = require("../tournament-configuration/domain/formats/registry");
          const rule = registry.definition(n.params.ruleVersion);
          if (
            !rule ||
            !["fixed-swiss", "threshold-swiss", "major-like"].includes(
              rule.format,
            )
          )
            throw Error("请选择受支持的瑞士规则版本");
          // Validate the same supported format constraints without creating a runtime.
          const parse =
            require("../tournament-configuration/domain/structure").parseStructure;
          const s = parse(
            {
              entrantKind: "individual",
              structureVersion: "structure-v2",
              routingVersion: "routing-v2",
              stages: [
                {
                  id: n.id,
                  name: n.name,
                  order: 1,
                  format: rule.format,
                  ruleVersion: n.params.ruleVersion,
                  groupSize: x.items.length,
                  groupCount: 1,
                  qualifyCount: Math.min(
                    x.items.length,
                    rule.defaults.qualifyCount,
                  ),
                  parameters: n.params.parameters ?? {},
                  groups: [{ id: n.id + ":group", stageId: n.id }],
                },
              ],
              pools: [],
              routes: [],
            },
            "canvas",
          );
          const formatParams = s.stages[0].parameters;
          const validation =
            require("../tournament-configuration/domain/validation").validateStructure(
              s,
            );
          if (!validation.structureValid)
            throw Error(validation.diagnostics.map((d) => d.reason).join("；"));
          if (n.params.ranking !== "complete-v1")
            report(
              "RANKING_REQUIRED",
              n,
              "collection",
              "需要全体排名规则与并列裁定；不能用初始顺序冒充最终名次",
            );
          const ranking = resolutions[n.id];
          if (ranking) {
            if (
              ranking.confirmed !== true ||
              !Array.isArray(ranking.order) ||
              ranking.order.length !== x.items.length ||
              new Set(ranking.order).size !== x.items.length ||
              ranking.order.some((r) => !x.items.some((s) => s.ref === r))
            )
              throw Error("排名必须全段确认且包含全部原始席位");
            emit(
              ranking.order.map((r, i) => ({
                ...x.items.find((s) => s.ref === r),
                provenance: { swiss: n.id, rank: i + 1 },
              })),
            );
          } else
            emit(
              x.items.map((_, i) => ({
                ref: "rank:" + n.id + ":" + (i + 1),
                label: n.name + " 最终第 " + (i + 1) + " 名（待解析）",
                candidates: x.items.flatMap(candidates),
                choices: { [n.id]: i + 1 },
                alternatives: x.items.flatMap(alternatives).map((a) => ({
                  ...a,
                  choices: { ...a.choices, [n.id]: i + 1 },
                })),
                provenance: {
                  swiss: n.id,
                  rank: i + 1,
                  initialOrder: x.items.map((x) => x.ref),
                },
              })),
            );
          out.windows = Array.from(
            {
              length:
                formatParams.roundCount ??
                formatParams.winsToQualify + formatParams.lossesToEliminate - 1,
            },
            (_, i) => ({
              planKey: "canvas-window/" + n.id + "/" + (i + 1),
              name: n.name + " 第 " + (i + 1) + " 轮",
              pairing: "按 " + n.params.ruleVersion + " 动态配对，待解析",
              count: x.items.length / 2,
            }),
          );
          break;
        }
        case "match": {
          const a = input("A", false),
            b = input("B", false),
            seatA = a?.seat ?? null,
            seatB = b?.seat ?? null,
            pending = [a, b].some((x) => x && x.type !== "seat"),
            bye =
              pending || (seatA && seatB)
                ? null
                : seatA
                  ? "B"
                  : seatB
                    ? "A"
                    : "both";
          if (pending)
            report(
              "INPUT_PENDING",
              n,
              null,
              "上游席位尚未形成，不能视为正常轮空",
            );
          if (
            !Number.isInteger(n.params.bestOf) ||
            n.params.bestOf < 1 ||
            n.params.bestOf % 2 !== 1
          )
            report("BO_INVALID", n, null, "BO 必须为正奇数");
          if (!bye && n.params.winnerRule === "none")
            report(
              "WINNER_RULE_REQUIRED",
              n,
              "W",
              "没有唯一胜败者时需要下游处理规则",
            );
          if (bye) {
            out.W = { type: "seat", seat: seatA ?? seatB, bye: true };
            out.L = { type: "seat", seat: null, bye: true };
          } else
            for (const p of ["W", "L"])
              out[p] = {
                type: "seat",
                seat: {
                  ref: p + ":" + n.id,
                  label:
                    n.name + (p === "W" ? " 胜者" : " 败者") + "（待解析）",
                  candidates: [
                    ...new Set([
                      ...(seatA ? candidates(seatA) : []),
                      ...(seatB ? candidates(seatB) : []),
                    ]),
                  ],
                  alternatives: [
                    ...(seatA ? alternatives(seatA) : []),
                    ...(seatB ? alternatives(seatB) : []),
                  ].map((a) => ({
                    ...a,
                    choices: { ...a.choices, [n.id]: p },
                  })),
                  choices: { [n.id]: p },
                  provenance: { match: n.id, outcome: p },
                },
              };
          out.match = {
            id: n.id,
            name: n.name,
            bestOf: n.params.bestOf,
            batch: n.params.batch || null,
            A: a?.seat ?? null,
            B: b?.seat ?? null,
            expectedTime: n.params.expectedTime ?? null,
            durationMinutes: n.params.durationMinutes ?? null,
            condition: n.params.condition ?? null,
            bye,
          };
          break;
        }
        case "subgraph":
          for (const b of G.boundaries(g, n).filter(
            (b) => b.direction === "output",
          ))
            out[b.id] = value(b.target);
          break;
      }
    } catch (e) {
      report("COMPONENT_INVALID", n, null, e.message);
    }
    memo.set(n.id, out);
    active.delete(n.id);
    return out;
  }
  for (const n of g.nodes) calculate(n);
  const depthMemo = new Map();
  const depth = (n) => {
    if (depthMemo.has(n.id)) return depthMemo.get(n.id);
    const ds = g.edges
      .filter((e) => G.endpoint(g, e.to, "input").node === n.id)
      .map((e) => by.get(G.endpoint(g, e.from, "output").node));
    const d = 1 + Math.max(0, ...ds.map((x) => depth(x)));
    depthMemo.set(n.id, d);
    return d;
  };
  const assignments = new Map();
  const mutuallyExclusive = (a, b) =>
    Object.keys(a.choices ?? {}).some(
      (k) => Object.hasOwn(b.choices ?? {}, k) && a.choices[k] !== b.choices[k],
    );
  for (const n of g.nodes.filter(
    (n) => n.kind === "match" && g.schemaVersion === "canvas-v1",
  )) {
    const m = memo.get(n.id).match;
    if (!m) continue;
    const batch = m.batch ?? "dependency:" + depth(n);
    m.batch = batch;
    for (const port of ["A", "B"]) {
      const seat = m[port];
      if (!seat) continue;
      const list = assignments.get(batch) ?? [];
      for (const old of list)
        if (!mutuallyExclusive(old.seat, seat)) {
          if (old.seat.ref === seat.ref)
            report(
              "DUPLICATE_ASSIGNMENT",
              n,
              port,
              "同批次重复席位 " +
                seat.ref +
                "；已分配到 " +
                old.node +
                "/" +
                old.port,
            );
          else if (
            alternatives(seat).some((a) =>
              alternatives(old.seat).some(
                (b) => a.ref === b.ref && !mutuallyExclusive(a, b),
              ),
            )
          )
            report(
              "IDENTITY_PENDING",
              n,
              port,
              "未来来源可能重叠，解析时必须复验身份",
              "warning",
            );
        }
      list.push({ seat, node: n.id, port });
      assignments.set(batch, list);
    }
  }
  const valid = !diagnostics.some((d) => d.severity === "error");
  return {
    valid,
    previewReady: valid,
    diagnostics,
    nodes: g.nodes.map((n) => ({
      ...n,
      ports: G.ports(g, n),
      capacity: G.capacity(g, n),
      hiddenConnectedLoser:
        n.kind === "match" &&
        !n.display?.showLoser &&
        g.edges.some(
          (e) =>
            G.key(G.endpoint(g, e.from, "output")) ===
            G.key({ node: n.id, port: "L" }),
        ),
    })),
    values: Object.fromEntries(memo),
    matches: [...memo.values()].map((x) => x.match).filter(Boolean),
    windows: [...memo.values()].flatMap((x) => x.windows ?? []),
  };
}
module.exports = { analyze };
