"use strict";
require("../../../scripts/ensure-canvas-core.cjs")();
const {randomUUID,createHash} = require("node:crypto");
const {createEditor} = require("../../../shared/planning-canvas/dist/cjs/index.js");
const core = createEditor({
createId: randomUUID,
digest: g => createHash("sha256").update(JSON.stringify(g)).digest("hex"),
matchRules: require("./match-rules"),
definition: id => require("../tournament-configuration/domain/formats/registry").definition(id),
node: (...args) => require("./samples").node(...args),
sample: name => sample(name),
validateRule: (n, rule) => {
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
});
const {parse,fail} = core;
function analyze(payload, resolutions) {
  const g = parse(payload),
    r = require("./evaluate").analyze(g, resolutions);
  return require("./waves").plan(g, r);
}
function preview(payload, canvasId, validated) {
  const r = validated ?? analyze(payload);
  if (!r.valid) fail("保存版本尚未验证就绪", { diagnostics: r.diagnostics });
  return {
    matches: r.matches.map((m) => ({
      ...m,
      planKey:
        "canvas-plan/" +
        encodeURIComponent(canvasId) +
        "/" +
        encodeURIComponent(m.id),
    })),
    windows: r.windows.map((w) => ({
      ...w,
      planKey:
        "canvas-plan/" + encodeURIComponent(canvasId) + "/" + w.planKey,
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
      "round-robin",
      "double-round-robin",
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

module.exports = {...core,analyze,preview,sample};
