"use strict";
const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { createHash } = require("node:crypto");
function signature() {
  const root = resolve(__dirname, "../shared/planning-canvas");
  const hash = createHash("sha256");
  for (const path of [resolve(__dirname,"build-canvas-core.cjs"), resolve(root,"tsconfig.json"), ...readdirSync(resolve(root,"src")).sort().map(name=>resolve(root,"src",name))])
    hash.update(readFileSync(path));
  return hash.digest("hex");
}
module.exports = function ensureCanvasCore() {
  const dist = resolve(__dirname, "../shared/planning-canvas/dist");
  const outputs = ["cjs", "esm"].flatMap(kind => ["index.js","index.d.ts","core.js","stage-numbers.js","rules.js","package.json"].map(name=>resolve(dist,kind,name)));
  const stamp = resolve(dist,".build-signature");
  if (outputs.some(path => !existsSync(path)) || !existsSync(stamp) || readFileSync(stamp,"utf8") !== signature()) {
    delete require.cache[require.resolve("./build-canvas-core.cjs")];
    require("./build-canvas-core.cjs");
  }
};
module.exports.signature = signature;
if (require.main === module) module.exports();
