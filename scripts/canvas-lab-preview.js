"use strict";
// Dedicated local preview: its accounts and canvas drafts stay outside the business database.
const { resolve } = require("node:path");
const { isIP } = require("node:net");
const { createApp } = require("../backend/src/app");
const port = Number(process.env.CANVAS_LAB_PORT || 5010);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("CANVAS_LAB_PORT must be between 1024 and 65535");
const root = resolve(__dirname, "..");
const host = process.env.CANVAS_LAB_HOST || "127.0.0.1";
if (isIP(host) !== 4 || host === "0.0.0.0")
  throw Error("CANVAS_LAB_HOST must be a specific IPv4 address");
const hosts = [...new Set(["127.0.0.1", host])];
const platform = createApp({
  databasePath: resolve(root, "output/local-preview/canvas-lab.sqlite"),
  frontendPath: resolve(root, "frontend/dist"),
  origins: [...hosts.map((address) => "http://" + address + ":" + port), "http://localhost:" + port],
});
const servers = hosts.map((address) => {
  const server = platform.app.listen(port, address, () => {
    console.log("Canvas lab: http://" + address + ":" + port + "/canvas-lab");
  });
  server.on("error", (error) => {
    console.error(error.message);
    for (const listener of servers) listener.close();
    platform.close();
    process.exitCode = 1;
  });
  return server;
});
console.log("Uses isolated preview accounts and drafts. Register a test account in this space.");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    Promise.all(servers.map((server) => new Promise((done) => server.close(done))))
      .then(() => { platform.close(); process.exit(0); });
  });
