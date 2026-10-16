"use strict";
require("../../../scripts/ensure-canvas-core.cjs")();
const S = require("./samples");
const { EDITOR_PROTOCOL } = require("../../../shared/planning-canvas/dist/cjs/index.js");
let cached;
function catalog() {
  if (!cached) {
    const G = require("./graph");
    cached = {
      editorProtocol: EDITOR_PROTOCOL,
      ruleCatalogVersion: "canvas-rules-20261016",
      nodes: G.KINDS.map(k => S.node(k, "new-" + k)),
      matchFormats: require("./match-rules").formats,
      propertyDefinitions: require("./property-definitions").definitions,
      formats: require("../tournament-configuration/domain/formats/registry").formatCatalog(),
      samples: Object.fromEntries(["empty", "swiss-eight", "round-robin", "double-round-robin", "single", "double", "gsl", "partial-pool", "invalid"].map(name => [name, S.sample(name)])),
    };
  }
  return structuredClone(cached);
}
module.exports = { catalog };
