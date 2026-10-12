import { it, expect } from "vitest";
import { unitGraph } from "./plan-graph";
import { fixtures } from "./plan-graph.fixture";
function graph(rule = "single-cut-v2", n = 8, q = 1, p = {}) {
  const { structure, plan } = fixtures[JSON.stringify([rule, n, q, p])];
  return unitGraph(plan.units[0], plan, structure);
}
it("TI planning distinguishes elimination choices from a sixth Swiss round and top-eight ranking", () => {
  const f = structuredClone(
      fixtures[JSON.stringify(["swiss-fixed-v1", 8, 4, { roundCount: 3 }])],
    ),
    u = f.plan.units[0];
  u.windows = Array.from({ length: 6 }, (_, i) => ({
    planKey: `ti/window/${i + 1}`,
    round: i + 1,
    phase: i < 5 ? "swiss" : "elimination",
    previousWindowKey: i ? `ti/window/${i}` : null,
  }));
  u.outputs.qualification = Array.from({ length: 8 }, (_, i) => ({
    channel: "qualification",
    index: i + 1,
    source: {
      kind: "selectedStanding",
      channel: "qualification",
      index: i + 1,
    },
  }));
  const out = unitGraph(u, f.plan, f.structure);
  expect(
    out.nodes.filter((n) => n.kind === "window").map((n) => n.title),
  ).toEqual([
    "第1瑞士轮",
    "第2瑞士轮",
    "第3瑞士轮",
    "第4瑞士轮",
    "第5瑞士轮",
    "附加淘汰赛",
  ]);
  expect(
    out.nodes.filter((n) => n.kind === "output").map((n) => n.sources[0]),
  ).toEqual(
    Array.from({ length: 8 }, (_, i) => `附加淘汰赛后资格第${i + 1}位`),
  );
  expect(out.edges.find((e) => e.to === "ti/window/6")?.label).toBe(
    "瑞士赛确认后选择对手",
  );
});
it("future routed ranges preserve sorting uncertainty instead of guessing a specific qualifier identity", () => {
  const { plan, structure } = fixtures.mixed;
  const out = unitGraph(plan.units[1], plan, structure);
  expect(
    out.nodes.some((n) =>
      n.sources.some(
        (s) => s.includes("晋级范围1–4") && s.includes("排序后席位1"),
      ),
    ),
  ).toBe(true);
});
it("shows the whole eight-player bracket with future winner/loser references and conditional GF2 without fake scores", () => {
  const single = graph();
  expect(single.nodes.filter((n) => n.kind === "match")).toHaveLength(7);
  expect(
    single.nodes.some((n) => n.sources.some((s) => s.includes("胜者"))),
  ).toBe(true);
  const de = graph("de-standard-v1", 8, 1, { finalReset: true });
  const reset = de.nodes.find((n) => n.condition);
  expect(reset?.status).toContain("条件");
  expect(reset?.actual).toBeUndefined();
  expect(de.nodes.filter((n) => n.kind === "match")).toHaveLength(15);
});
it("GSL has five real plan nodes and Swiss future contains windows only until actual pairing exists", () => {
  expect(
    graph("gsl-classic-v1", 4, 2).nodes.filter((n) => n.kind === "match"),
  ).toHaveLength(5);
  const swiss = graph("swiss-fixed-v1", 8, 4, { roundCount: 3 });
  expect(swiss.nodes.filter((n) => n.kind === "window")).toHaveLength(3);
  expect(swiss.nodes.filter((n) => n.kind === "match")).toHaveLength(0);
});
it("Swiss known matches retain pairing-time record bands without pretending future pairs are known", () => {
  const { structure, plan } =
      fixtures[JSON.stringify(["swiss-fixed-v1", 8, 4, { roundCount: 3 }])],
    unit = plan.units[0];
  const match = {
    planKey: unit.windows[0].planKey + "/match/1",
    entrants: ["a", "b"],
    pairingRecords: [
      { wins: 1, losses: 0, points: 3 },
      { wins: 0, losses: 1, points: 0 },
    ],
    bestOf: 1,
  };
  const runtime = {
    configurationId: "c",
    roster: [
      { entrantId: "a", name: "甲" },
      { entrantId: "b", name: "乙" },
    ],
    units: [
      {
        plan: unit,
        bindings: [],
        rounds: [
          {
            planKey: unit.windows[0].planKey,
            matches: [match],
            confirmed: false,
          },
        ],
      },
    ],
  };
  const graph = unitGraph(unit, plan, structure, runtime),
    node = graph.nodes.find((n) => n.id === match.planKey);
  expect(node?.sources).toEqual([
    "甲 · 配对前1胜0负 · 3分",
    "乙 · 配对前0胜1负 · 0分",
  ]);
  expect(graph.nodes.filter((n) => n.kind === "match")).toHaveLength(1);
  expect(graph.nodes.filter((n) => n.kind === "window")).toHaveLength(3);
});
it("automatic sixty-four bracket coordinates are deterministic and match cards never overlap", () => {
  const a = graph("single-cut-v2", 64, 1),
    b = graph("single-cut-v2", 64, 1);
  expect(a).toEqual(b);
  for (const [n, x] of a.nodes.entries())
    for (const y of a.nodes.slice(n + 1))
      expect(
        x.x + x.width <= y.x ||
          y.x + y.width <= x.x ||
          x.y + x.height <= y.y ||
          y.y + y.height <= x.y,
      ).toBe(true);
});
it("single/double round-robin graph includes every fixture and symmetric second leg", () => {
  expect(
    graph("round-robin-v2", 4, 2).nodes.filter((n) => n.kind === "match"),
  ).toHaveLength(6);
  expect(
    graph("double-round-robin-v2", 4, 2).nodes.filter(
      (n) => n.kind === "match",
    ),
  ).toHaveLength(12);
});
