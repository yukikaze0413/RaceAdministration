"use strict";
const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const { transaction } = require("../storage/database");
const { hash, publicUser, text } = require("./accounts");
const { reject, fields } = require("../http/errors");
const digest = (t) => createHash("sha256").update(t).digest("hex");
function loginRequired(req) {
  if (!req.user) reject(401, "AUTH_REQUIRED", "请先登录，再继续操作。");
  return req.user;
}
function mountSessions(
  api,
  { db, send, now = Date.now, secureCookies = false },
) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
  };
  api.use((req, res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("race_session="))
      ?.slice(13);
    req.sessionHash = token ? digest(token) : null;
    req.user = null;
    if (req.sessionHash) {
      const s = db
        .prepare(
          "SELECT userId FROM sessions WHERE tokenHash=? AND expiresAt>?",
        )
        .get(req.sessionHash, now());
      if (s) {
        const row = db
          .prepare("SELECT data FROM users WHERE id=?")
          .get(s.userId);
        if (row) req.user = JSON.parse(row.data);
      }
    }
    next();
  });
  api.post("/auth/login", async (req, res) => {
    fields(req.body, ["username", "password"]);
    const { username, password } = req.body;
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      password.length > 1024
    )
      reject(401, "INVALID_CREDENTIALS", "用户名或密码不正确。");
    const row = db
        .prepare("SELECT data FROM users WHERE username=?")
        .get(username.toLowerCase()),
      user = row ? JSON.parse(row.data) : null;
    const actual = Buffer.from(
        await hash(
          password,
          user?.salt || "missing-user-equal-cost-salt",
          user?.passwordParameters,
        ),
        "hex",
      ),
      expected = Buffer.from(user?.passwordHash || "00".repeat(64), "hex");
    if (
      !user ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      reject(401, "INVALID_CREDENTIALS", "用户名或密码不正确。");
    const token = randomBytes(32).toString("hex");
    transaction(db, () => {
      if (req.sessionHash)
        db.prepare("DELETE FROM sessions WHERE tokenHash=?").run(
          req.sessionHash,
        );
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        digest(token),
        user.id,
        now() + 7 * 24 * 3600 * 1000,
      );
    });
    res.cookie("race_session", token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 3600 * 1000,
    });
    send(req, res, publicUser(user));
  });
  api.get("/auth/session", (req, res) =>
    send(req, res, { user: req.user ? publicUser(req.user) : null }),
  );
  api.post("/auth/logout", (req, res) => {
    if (req.sessionHash)
      db.prepare("DELETE FROM sessions WHERE tokenHash=?").run(req.sessionHash);
    res.clearCookie("race_session", cookieOptions);
    send(req, res, { loggedOut: true });
  });
  api.patch("/me", (req, res) => {
    const user = loginRequired(req);
    fields(req.body, ["displayName"]);
    const displayName = text(req.body.displayName, "/displayName", 1, 40);
    if (!displayName.trim()) reject(422, "INVALID_INPUT", "显示名不能为空。");
    const next = { ...user, displayName };
    db.prepare("UPDATE users SET data=? WHERE id=?").run(
      JSON.stringify(next),
      user.id,
    );
    send(req, res, publicUser(next));
  });
}
module.exports = { mountSessions, loginRequired };
