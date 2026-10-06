"use strict";
const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const { transaction } = require("../storage/database");
const { hash, publicUser } = require("./accounts");
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
      password.length === 0
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
      const latest = db
        .prepare("SELECT data FROM users WHERE id=?")
        .get(user.id);
      if (!latest || JSON.parse(latest.data).passwordHash !== user.passwordHash || JSON.parse(latest.data).username !== user.username)
        reject(401, "INVALID_CREDENTIALS", "用户名或密码不正确。");

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

  api.post("/me/password", async (req, res) => {
    const user = loginRequired(req);
    fields(req.body, ["currentPassword", "newPassword"]);
    for (const key of ["currentPassword", "newPassword"])
      if (typeof req.body[key] !== "string" || req.body[key].length === 0)
        reject(422, "INVALID_INPUT", "请检查密码输入。", {
          fieldErrors: [
            {
              path: "/" + key,
              message:
                key === "currentPassword"
                  ? "请输入当前密码。"
                  : "新密码不能为空。",
            },
          ],
        });
    const actual = Buffer.from(
      await hash(req.body.currentPassword, user.salt, user.passwordParameters),
      "hex",
    );
    const expected = Buffer.from(user.passwordHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      reject(422, "INVALID_CURRENT_PASSWORD", "当前密码不正确。", {
        fieldErrors: [
          { path: "/currentPassword", message: "当前密码不正确。" },
        ],
      });
    const salt = randomBytes(16).toString("hex");
    const passwordHash = await hash(
      req.body.newPassword,
      salt,
      user.passwordParameters,
    );
    transaction(db, () => {
      const row = db.prepare("SELECT data FROM users WHERE id=?").get(user.id);
      if (!row) reject(409, "CREDENTIAL_CHANGED", "账号凭据已变化，请重新登录。");
      const current = JSON.parse(row.data);
      const session = db
        .prepare(
          "SELECT userId FROM sessions WHERE tokenHash=? AND expiresAt>?",
        )
        .get(req.sessionHash, now());
      if (
        current.passwordHash !== user.passwordHash ||
        !session ||
        session.userId !== user.id
      )
        reject(409, "CREDENTIAL_CHANGED", "账号凭据已变化，请重新登录。");
      db.prepare("UPDATE users SET data=? WHERE id=?").run(
        JSON.stringify({ ...current, salt, passwordHash }),
        user.id,
      );
      db.prepare("DELETE FROM sessions WHERE userId=?").run(user.id);
    });
    res.clearCookie("race_session", cookieOptions);
    send(req, res, { passwordChanged: true, requiresLogin: true });
  });

  require("./profile").mountProfile(api, { db, send, now, cookieOptions });
}
module.exports = { mountSessions, loginRequired };
