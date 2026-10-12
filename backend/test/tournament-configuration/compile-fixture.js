"use strict";
const {
  parseStructure,
} = require("../../src/tournament-configuration/domain/structure");
function input(rule = "single-cut-v2", n = 8, q = 1, p = {}) {
  const formats = {
    "single-cut-v2": "single-elimination",
    "gsl-classic-v1": "gsl",
    "de-standard-v1": "double-elimination",
    "de-lower-entry-v1": "double-elimination",
    "swiss-fixed-v1": "fixed-swiss",
    "swiss-threshold-v1": "threshold-swiss",
    "round-robin-v2": "round-robin",
    "double-round-robin-v2": "double-round-robin",
  };
  return parseStructure(
    {
      entrantKind: "individual",
      structureVersion: "structure-v2",
      routingVersion: "routing-v2",
      stages: [
        {
          id: "s",
          name: "阶段",
          order: 1,
          format: formats[rule],
          ruleVersion: rule,
          groupSize: n,
          groupCount: 1,
          qualifyCount: q,
          parameters: p,
          groups: [{ id: "g", stageId: "s" }],
        },
      ],
      pools: [],
      routes: [],
    },
    "T",
  );
}
module.exports = { input };
