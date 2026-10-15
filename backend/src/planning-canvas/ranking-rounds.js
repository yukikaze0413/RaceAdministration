"use strict";
const registry = require("../tournament-configuration/domain/formats/registry");
const formats = {
  swiss: ["fixed-swiss", "threshold-swiss", "major-like"],
  "round-robin": ["round-robin", "double-round-robin"],
};
function ruleFor(node) {
  const rule = registry.definition(node.params.ruleVersion);
  if (!rule || !formats[node.kind]?.includes(rule.format))
    throw Error("请选择受支持的赛制规则版本");
  return rule;
}
function structure(node, size) {
  const rule = ruleFor(node);
  return require("../tournament-configuration/domain/structure").parseStructure(
    {
      entrantKind: "individual",
      structureVersion: "structure-v2",
      routingVersion: "routing-v2",
      stages: [
        {
          id: node.id,
          name: node.name,
          order: 1,
          format: rule.format,
          ruleVersion: rule.ruleVersion,
          groupSize: size,
          groupCount: 1,
          qualifyCount: Math.min(size, rule.defaults.qualifyCount),
          parameters: node.params.parameters ?? {},
          groups: [{ id: node.id + ":group", stageId: node.id }],
        },
      ],
      pools: [],
      routes: [],
    },
    "canvas",
  );
}
function windows(node, size, items) {
  const s = structure(node, size);
  const validation =
    require("../tournament-configuration/domain/validation").validateStructure(
      s,
    );
  if (!validation.structureValid)
    throw Error(validation.diagnostics.map((d) => d.reason).join("；"));
  const p = s.stages[0].parameters;
  if (node.kind === "swiss") {
    const count = p.roundCount ?? p.winsToQualify + p.lossesToEliminate - 1;
    return Array.from({ length: count }, (_, i) => ({
      planKey: "canvas-window/" + node.id + "/" + (i + 1),
      nodeId: node.id,
      kind: node.kind,
      number: i + 1,
      name: node.name + " 第 " + (i + 1) + " 轮",
      pairing: "动态配对，待解析",
      count: Math.floor(size / 2),
      restCount: size % 2,
      fixtures: [],
      rest: [],
      capacity: size,
    }));
  }
  const unit =
    require("../tournament-configuration/domain/formats/compile").compile(s, {
      configurationId: "canvas-" + node.id,
      tournamentId: "canvas",
    }).units[0];
  const perCycle = size % 2 ? size : size - 1;
  return unit.waves.map((wave) => {
    const fixtures = unit.matches
      .filter((m) => m.round === wave.number)
      .map((m) => ({
        id: m.planKey,
        planKey: m.planKey,
        bestOf: m.bestOf,
        A: items[m.sources[0].position - 1],
        B: items[m.sources[1].position - 1],
      }));
    const playing = new Set(fixtures.flatMap((m) => [m.A.ref, m.B.ref]));
    return {
      planKey: "canvas-window/" + node.id + "/" + wave.number,
      nodeId: node.id,
      kind: node.kind,
      number: wave.number,
      leg: Math.floor((wave.number - 1) / perCycle) + 1,
      name: node.name + " 第 " + wave.number + " 轮",
      pairing: "循环赛整轮对阵",
      count: fixtures.length,
      restCount: size % 2,
      capacity: size,
      fixtures,
      rest: items.filter((s) => !playing.has(s.ref)),
    };
  });
}
module.exports = { ruleFor, structure, windows };
