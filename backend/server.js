"use strict";
const { resolve } = require("node:path");
const { createApp } = require("./src/app");
function start() {
  const host = process.env.HOST || "127.0.0.1",
    port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("PORT must be 1–65535");
  const origins = process.env.APP_ORIGINS
    ? process.env.APP_ORIGINS.split(",").map((s) => s.trim())
    : [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        `http://${host}:${port}`,
      ];
  for (const origin of origins)
    if (new URL(origin).origin !== origin)
      throw Error("APP_ORIGINS must contain exact origins");
  const platform = createApp({
    databasePath:
      process.env.DATABASE_PATH || resolve(__dirname, ".data/platform.sqlite"),
    origins,
    secureCookies: process.env.COOKIE_SECURE === "true",
    frontendPath: resolve(__dirname, "../frontend/dist"),
  });
  const server = platform.app.listen(port, host, () =>
    console.log(`赛事工作台：http://${host}:${port}`),
  );
  function shutdown() {
    server.close(() => {
      platform.close();
      process.exit(0);
    });
    setTimeout(() => {
      platform.close();
      process.exit(1);
    }, 10000).unref();
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.on("error", () => {
    platform.close();
    process.exitCode = 1;
  });
  return { server, platform };
}
if (require.main === module) start();
module.exports = { start };
