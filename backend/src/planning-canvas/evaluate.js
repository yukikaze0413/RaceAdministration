"use strict";
const G = require("./graph"),
  V = require("./values");
const MatchRules = require("./match-rules");
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
        case "selector-top":
        case "selector-random": {
          const x = input("collection");
          if (x?.items) {
            const selected = V.select(
              x.items,
              n.kind === "selector-top" ? "top" : "random",
              n.params.count,
              n.params.seed,
            );
            emit(selected);
            if (n.params.showComplement) {
              const chosen = new Set(selected.map((s) => s.ref));
              const rest = x.items.filter((s) => !chosen.has(s.ref));
              out.complement = collection(rest);
              out.complementSeeds = {
                type: "seed-map",
                mapping: V.seedMap(rest),
                provenance: rest.map((s) => ({
                  ref: s.ref,
                  source: s.provenance ?? null,
                })),
              };
            }
          }
          break;
        }
        case "generator":
          out.sort = V.template(n.params.count, n.params.mode, n.params.seed);
          break;
        case "expander": {
          const x = input("collection");
          if (x?.items)
            x.items.forEach((seat, i) => {
              out["seat:" + (i + 1)] = { type: "seat", seat };
            });
          break;
        }
        case "swiss":
        case "round-robin": {
          const x = input("collection");
          const rankingRounds = require("./ranking-rounds");
          rankingRounds.ruleFor(n);
          const size = x?.items?.length ?? n.params.participantCount;
          if (size == null) break;
          if (
            x &&
            n.params.participantCount != null &&
            n.params.participantCount !== size
          )
            report(
              "CAPACITY_MISMATCH",
              n,
              "collection",
              "计划人数与输入集合人数不一致",
            );
          out.windows = rankingRounds.windows(n, size, x?.items ?? []);
          if (!x) break;
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
              ranking.order.length !== size ||
              new Set(ranking.order).size !== size ||
              ranking.order.some((r) => !x.items.some((s) => s.ref === r))
            )
              throw Error("排名必须全段确认且包含全部原始席位");
            emit(
              ranking.order.map((r, i) => ({
                ...x.items.find((s) => s.ref === r),
                provenance: {
                  [n.kind === "swiss" ? "swiss" : "roundRobin"]: n.id,
                  rank: i + 1,
                },
              })),
            );
          } else {
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
                  [n.kind === "swiss" ? "swiss" : "roundRobin"]: n.id,
                  rank: i + 1,
                  initialOrder: x.items.map((s) => s.ref),
                },
              })),
            );
          }
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
            bestOf: MatchRules.format(n.params).bestOf,
            matchFormat: MatchRules.format(n.params)?.id ?? null,
            A: a?.seat ?? null,
            B: b?.seat ?? null,
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
  const valid = !diagnostics.some((d) => d.severity === "error");
  return {
    valid,
    previewReady: valid,
    diagnostics,
    nodes: g.nodes.map((n) => ({
      ...n,
      ports: G.ports(g, n),
      capacity: G.capacity(g, n),
      readOnlyProperties: require("./property-definitions").readOnlyProperties(
        g,
        n,
        G.capacity(g, n),
      ),
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
