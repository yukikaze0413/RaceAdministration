"use strict";
const { readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
require("./ensure-canvas-core.cjs")();
(async () => {
  const directory = resolve(__dirname, "../shared/planning-canvas/dist/esm");
  for (const name of readdirSync(directory).filter(name => name.endsWith(".js"))) {
    if (/\brequire\s*\(|\bfetch\s*\(|\blocalStorage\b|(?:from\s+|import\s*)["']node:|["']\.\/(?:waves|evaluate)\.js/.test(readFileSync(resolve(directory,name),"utf8")))
      throw Error("Browser entry contains a platform dependency: " + name);
  }
  const esm = await import(pathToFileURL(resolve(directory,"index.js")).href);
  const cjs = require("../shared/planning-canvas/dist/cjs/index.js");
  if (esm.EDITOR_PROTOCOL !== cjs.EDITOR_PROTOCOL || typeof esm.createEditor !== "function") throw Error("Editor entry points do not match");
  console.log("Canvas core: ESM and CommonJS load; browser platform-dependency check passed");
})().catch(error => { console.error(error.message); process.exitCode=1; });
