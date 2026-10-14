"use strict";
const { randomUUID } = require("node:crypto");
function node(
  kind,
  id = randomUUID(),
  params = {},
  position = { x: 40, y: 40 },
) {
  const defaults = {
    source: { seats: [{ ref: "seat:" + id, label: "未来席位" }] },
    match: { bestOf: 3, batch: "", winnerRule: "unique-winner-v1" },
    swiss: {
      ruleVersion: "swiss-fixed-v1",
      parameters: { roundCount: 5 },
      ranking: "complete-v1",
      release: "confirmed",
    },
    pool: { inputs: ["in:1"] },
    expander: { count: null },
    selector: {
      mode: "top",
      count: 8,
      seed: 20261013,
      algorithm: "mulberry32-v1",
    },
    generator: {
      mode: "reverse",
      count: 8,
      seed: 20261013,
      algorithm: "mulberry32-v1",
    },
    subgraph: { boundaries: [], custom: true },
  };
  const labels = {
    source: "参赛来源",
    match: "Match",
    swiss: "瑞士轮",
    pool: "Pool",
    expander: "展开器",
    selector: "选择器",
    generator: "种子生成器",
    subgraph: "子图",
  };
  return {
    id,
    kind,
    name: labels[kind],
    params: { ...defaults[kind], ...params },
    position,
    display: { showLoser: false, showSeeds: false, collapsed: false },
  };
}
function sample(name) {
  const g = { schemaVersion: "canvas-v1", nodes: [], edges: [] };
  const connect = (a, p, b, q) =>
    g.edges.push({
      id: randomUUID(),
      from: { node: a, port: p },
      to: { node: b, port: q },
    });
  if (name === "empty") return g;
  const n = name === "gsl" ? 4 : name === "swiss-eight" ? 16 : 8;
  g.nodes.push(
    node("source", "source", {
      seats: Array.from({ length: n }, (_, i) => ({
        ref: "P" + (i + 1),
        label: "参赛来源 " + (i + 1),
      })),
    }),
  );
  if (name === "swiss-eight") {
    g.nodes.push(
      node("swiss", "swiss", {}, { x: 360, y: 40 }),
      node("selector", "top8", {}, { x: 680, y: 40 }),
      node("expander", "expand", { count: 8 }, { x: 1000, y: 40 }),
    );
    connect("source", "collection", "swiss", "collection");
    connect("swiss", "collection", "top8", "collection");
    connect("top8", "collection", "expand", "collection");
    [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ].forEach((pair, i) => {
      const id = "M" + (i + 1);
      g.nodes.push(
        node(
          "match",
          id,
          { batch: "八强", bestOf: 3 },
          { x: 1320, y: 40 + i * 270 },
        ),
      );
      g.nodes.at(-1).name = id;
      pair.forEach((s, j) =>
        connect("expand", "seat:" + s, id, j === 0 ? "A" : "B"),
      );
    });
    for (let i = 0; i < 3; i++) {
      const id = "M" + (i + 5);
      g.nodes.push(
        node(
          "match",
          id,
          { batch: i < 2 ? "半决赛" : "决赛", bestOf: i === 2 ? 5 : 3 },
          { x: i < 2 ? 1640 : 1960, y: 170 + i * 270 },
        ),
      );
      g.nodes.at(-1).name = id;
    }
    for (const [a, b, t] of [
      ["M1", "M2", "M5"],
      ["M3", "M4", "M6"],
      ["M5", "M6", "M7"],
    ]) {
      connect(a, "W", t, "A");
      connect(b, "W", t, "B");
    }
    return g;
  }
  if (["single", "double", "gsl"].includes(name)) {
    const ruleVersion = {
      single: "single-cut-v2",
      double: "de-standard-v1",
      gsl: "gsl-classic-v1",
    }[name];
    const rule =
      require("../tournament-configuration/domain/formats/registry").definition(
        ruleVersion,
      );
    const input = {
      entrantKind: "individual",
      structureVersion: "structure-v2",
      routingVersion: "routing-v2",
      stages: [
        {
          id: "stage",
          name: rule.label ?? name,
          order: 1,
          format: rule.format,
          ruleVersion,
          groupSize: n,
          groupCount: 1,
          qualifyCount: name === "gsl" ? 2 : 1,
          parameters: {},
          groups: [{ id: "group", stageId: "stage" }],
        },
      ],
      pools: [],
      routes: [],
    };
    const unit =
      require("../tournament-configuration/domain/formats/compile").compile(
        input,
        { configurationId: "canvas-template", tournamentId: "canvas" },
      ).units[0];
    g.nodes.push(node("expander", "expand", { count: n }, { x: 360, y: 40 }));
    connect("source", "collection", "expand", "collection");
    const ids = new Map(unit.matches.map((m, i) => [m.planKey, "M" + (i + 1)]));
    unit.matches.forEach((m, i) => {
      const id = ids.get(m.planKey);
      const match = node(
        "match",
        id,
        {
          bestOf: m.bestOf,
          batch: "wave:" + m.wave,
          condition: m.condition
            ? { ...m.condition, matchKey: ids.get(m.condition.matchKey) }
            : null,
        },
        {
          x: 680 + (m.wave - 1) * 340,
          y: 40 + (m.index - 1 + (m.role === "lower" ? 2 : 0)) * 280,
        },
      );
      match.name = id + " · " + m.role;
      match.display.showLoser = name !== "single";
      g.nodes.push(match);
      m.sources.forEach((s, j) =>
        connect(
          s.kind === "entrant" ? "expand" : ids.get(s.matchKey),
          s.kind === "entrant"
            ? "seat:" + s.position
            : s.kind === "winner"
              ? "W"
              : "L",
          id,
          j === 0 ? "A" : "B",
        ),
      );
    });
    return g;
  }
  if (name === "partial-pool") {
    g.nodes[0].params.seats = "ABCDE"
      .split("")
      .map((ref) => ({ ref, label: ref }));
    g.nodes[0].params.mapping = { B: 2, D: 1 };
    g.nodes.push(
      node("pool", "pool", { inputs: ["in:1", "in:2"] }, { x: 400, y: 40 }),
    );
    connect("source", "collection", "pool", "in:1");
    connect("source", "externalSeeds", "pool", "sort");
    return g;
  }
  if (name === "invalid") {
    g.nodes.push(node("match", "missing", {}, { x: 400, y: 40 }));
    g.nodes.push(node("swiss", "missing-swiss", {}, { x: 720, y: 40 }));
    return g;
  }
  throw Error("未知样例");
}
module.exports = { sample, node };
