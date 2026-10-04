"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdtempSync, readdirSync, unlinkSync, rmdirSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const net = require("node:net");
test("documented npm-start entry serves an empty durable platform and same-origin build", async () => {
  const directory = mkdtempSync(join(tmpdir(), "race-server-")),
    portServer = net.createServer();
  await new Promise((r) => portServer.listen(0, "127.0.0.1", r));
  const port = portServer.address().port;
  await new Promise((r) => portServer.close(r));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: resolve(__dirname, "../.."),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: join(directory, "start.sqlite"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", () => {});
  const exited = new Promise((r) => child.once("exit", r));
  try {
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(
        () => reject(Error("Startup did not become ready")),
        10000,
      );
      child.stdout.on("data", () => {
        if (output.includes("赛事工作台")) {
          clearTimeout(timer);
          resolveReady();
        }
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Startup failed"));
      });
    });
    const base = "http://127.0.0.1:" + port;
    const health = await fetch(base + "/api/v1/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).data.storage, "sqlite");
    assert.equal(
      (await (await fetch(base + "/api/v1/tournaments")).json()).data.total,
      0,
    );
    const page = await fetch(base + "/login");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="root"/);
    const unknown = await fetch(base + "/api/v1/typo");
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get("content-type"), /json/);
  } finally {
    child.kill();
    await exited;
    for (const name of readdirSync(directory))
      unlinkSync(join(directory, name));
    rmdirSync(directory);
  }
});
