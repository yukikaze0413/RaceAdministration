"use strict";
const { reject } = require("./errors");
function protections({ origins, now = Date.now }) {
  const windows = new Map();
  return (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (!origins.includes(req.get("Origin")))
        reject(403, "ORIGIN_FORBIDDEN", "请求来源未获允许，请从本站操作。");
      if (req.path !== "/auth/logout" && !req.is("application/json"))
        reject(400, "BAD_REQUEST", "写入请求必须使用JSON格式。");
    }
    if (
      req.method === "POST" &&
      ["/auth/login", "/auth/register"].includes(req.path)
    ) {
      const current = now(),
        key = req.ip;
      for (const [k, v] of windows) if (current >= v.until) windows.delete(k);
      const entry = windows.get(key) || {
        count: 0,
        until: current + 15 * 60 * 1000,
      };
      windows.set(key, entry);
      entry.count++;
      if (entry.count > 20) {
        res.set(
          "Retry-After",
          String(Math.ceil((entry.until - current) / 1000)),
        );
        reject(429, "RATE_LIMITED", "请求过于频繁，请等待后再试。");
      }
    }
    next();
  };
}
module.exports = { protections };
