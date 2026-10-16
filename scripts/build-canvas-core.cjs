"use strict";
const { spawnSync } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "..");
for (const [module, resolution, directory] of [["node16", "node16", "cjs"], ["es2022", "bundler", "esm"]]) {
  const result = spawnSync(process.execPath, [resolve(root, "frontend/node_modules/typescript/bin/tsc"), "-p", resolve(root, "shared/planning-canvas/tsconfig.json"), "--module", module, "--moduleResolution", resolution, "--outDir", resolve(root, "shared/planning-canvas/dist", directory)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
  mkdirSync(resolve(root, "shared/planning-canvas/dist", directory), { recursive: true });
  writeFileSync(resolve(root, "shared/planning-canvas/dist", directory, "package.json"), JSON.stringify({ type: directory === "esm" ? "module" : "commonjs" }));
}
writeFileSync(resolve(root,"shared/planning-canvas/dist/.build-signature"), require("./ensure-canvas-core.cjs").signature());
