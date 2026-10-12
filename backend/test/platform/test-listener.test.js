"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { EventEmitter } = require("node:events");
const { listenTestServer } = require("../helpers/http-listener");
test("test listener avoids Fetch-restricted ports and retries a busy binding without leaking listeners", async () => {
  const calls = [],
    servers = [];
  const app = {
    listen(port, host) {
      calls.push([port, host]);
      const server = new EventEmitter();
      servers.push(server);
      queueMicrotask(() =>
        server.emit(
          servers.length === 1 ? "error" : "listening",
          Object.assign(new Error("busy"), { code: "EADDRINUSE" }),
        ),
      );
      return server;
    },
  };
  const result = await listenTestServer(app);
  assert.equal(result, servers[1]);
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(([p, h]) => p >= 25000 && p < 55000 && h === "127.0.0.1"),
  );
  assert.ok(
    servers.every(
      (s) =>
        s.listenerCount("error") === 0 && s.listenerCount("listening") === 0,
    ),
  );
});
test("test listener retries restricted bindings with a bounded budget", async () => {
  let calls = 0;
  const app = {
    listen() {
      calls++;
      const s = new EventEmitter();
      queueMicrotask(() =>
        s.emit("error", Object.assign(new Error("denied"), { code: "EACCES" })),
      );
      return s;
    },
  };
  await assert.rejects(
    () => listenTestServer(app),
    /No available high test port/,
  );
  assert.equal(calls, 30);
});
test("test listener propagates unrelated startup errors", async () => {
  const error = Object.assign(new Error("startup"), { code: "EINVAL" });
  const app = {
    listen() {
      const s = new EventEmitter();
      queueMicrotask(() => s.emit("error", error));
      return s;
    },
  };
  await assert.rejects(
    () => listenTestServer(app),
    (e) => e === error,
  );
});
