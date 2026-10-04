"use strict";
const express = require("express");
const { randomUUID } = require("node:crypto");
const { reject, errorHandler } = require("./platform/http/errors");
const { openDatabase } = require("./platform/storage/database");
function createApp({
  databasePath = ":memory:",
  origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5000",
  ],
  now = Date.now,
  secureCookies = false,
  frontendPath = null,
} = {}) {
  const db = openDatabase(databasePath),
    app = express(),
    api = express.Router();
  app.use("/api/v1", (req, res, next) => {
    req.requestId = randomUUID();
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api/v1", express.json({ limit: "1mb" }), api);
  api.use(require("./platform/http/protections").protections({ origins, now }));
  const send = (req, res, data, status = 200) =>
    res.status(status).json({ data, requestId: req.requestId });
  api.get("/health", (req, res) => {
    try {
      db.prepare("SELECT 1").get();
      send(req, res, { status: "ok", storage: "sqlite" });
    } catch {
      reject(503, "STORE_UNAVAILABLE", "数据服务暂不可用。");
    }
  });
  require("./platform/auth/sessions").mountSessions(api, {
    db,
    send,
    now,
    secureCookies,
  });
  require("./platform/auth/accounts").mountAccounts(api, { db, send, now });
  require("./platform/catalog/catalog").mountCatalog(api, { db, send, now });
  require("./platform/configuration/http").mountConfiguration(api, {
    db,
    send,
  });
  require("./platform/http/capabilities").mountCapabilities(api, { db, send });
  api.use((req, res) => reject(404, "NOT_FOUND", "未找到这个接口。"));
  app.use("/api/races", express.json(), require("./routes/raceRoutes"));
  app.use("/api/test", require("./routes/testRoutes"));
  app.use("/api", (req, res) =>
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "未找到这个接口。",
        requestId: randomUUID(),
        retryable: false,
      },
    }),
  );
  if (
    frontendPath &&
    require("node:fs").existsSync(
      require("node:path").join(frontendPath, "index.html"),
    )
  ) {
    app.use(express.static(frontendPath, { index: false }));
    const routes =
      /^\/$|^\/(login|register|forgot-password|tournaments|tournaments\/new|me\/profile|me\/tournaments|me\/series|me\/series\/new)$|^\/me\/series\/[^/]+\/edit$|^\/series\/[^/]+$|^\/tournaments\/[^/]+(\/(stages|matches|standings|registration|results))?$|^\/manage\/[^/]+(\/(overview|settings|templates|registration|matches|results|rounds|sanctions|collaborators)|\/configurations\/[^/]+\/(stages|pools|routes|validation|preview))?$/;
    app.get(/.*/, (req, res, next) =>
      routes.test(req.path)
        ? res.sendFile(require("node:path").resolve(frontendPath, "index.html"))
        : next(),
    );
  }
  app.use((req, res, next) => {
    if (frontendPath && req.method === "GET" && req.accepts("html"))
      return res
        .status(404)
        .send(
          '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 页面不存在</title><main style="max-width:600px;margin:64px auto;padding:24px;font-family:system-ui;color:#172b4d"><h1>404 页面不存在</h1><p>请检查地址或返回赛事目录。</p><a href="/tournaments">返回赛事发现</a></main></html>',
        );
    next();
  });
  app.use((err, req, res, next) =>
    req.path.startsWith("/api/v1")
      ? errorHandler(err, req, res, next)
      : require("./middlewares/errorHandler")(err, req, res, next),
  );
  let closed = false;
  return {
    app,
    db,
    close() {
      if (!closed) {
        db.close();
        closed = true;
      }
    },
  };
}
module.exports = { createApp };
