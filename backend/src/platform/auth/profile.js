"use strict";
const { createHash, timingSafeEqual } = require("node:crypto");
const sharp = require("sharp");
const { transaction } = require("../storage/database");
const { hash, publicUser, text } = require("./accounts");
const { reject, fields } = require("../http/errors");
function invalid(path, message) {
  reject(422, "INVALID_INPUT", message, { fieldErrors: [{ path, message }] });
}
async function verifyPassword(user, password) {
  if (typeof password !== "string" || !password.length)
    invalid("/currentPassword", "请输入当前密码。");
  const actual = Buffer.from(
      await hash(password, user.salt, user.passwordParameters),
      "hex",
    ),
    expected = Buffer.from(user.passwordHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    invalid("/currentPassword", "当前密码不正确。");
}
function currentUser(db, req, now) {
  if (!req.user) reject(401, "AUTH_REQUIRED", "请先登录，再继续操作。");
  const row = db.prepare("SELECT data FROM users WHERE id=?").get(req.user.id);
  const session = db
    .prepare("SELECT userId FROM sessions WHERE tokenHash=? AND expiresAt>?")
    .get(req.sessionHash, now());
  if (!row || !session || session.userId !== req.user.id)
    reject(409, "CREDENTIAL_CHANGED", "账号凭据已变化，请重新登录。");
  const user = JSON.parse(row.data);
  if (
    user.passwordHash !== req.user.passwordHash ||
    user.username !== req.user.username
  )
    reject(409, "CREDENTIAL_CHANGED", "账号凭据已变化，请重新登录。");
  return user;
}
async function avatar(value) {
  if (value === null) return null;
  if (typeof value !== "string")
    invalid("/avatar", "请选择 PNG、JPEG 或 WebP 图片。");
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length > 350000)
    invalid("/avatar", "头像格式无效或超过 256 KiB，请重新选择图片。");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 256 * 1024 || bytes.toString("base64") !== match[2])
    invalid("/avatar", "头像数据无效。");
  try {
    const image = sharp(bytes, {
      failOn: "warning",
      limitInputPixels: 4194304,
    });
    const meta = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format) || (meta.pages || 1) > 1)
      throw Error("unsupported image");
    const output = await image
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
    return "data:image/webp;base64," + output.toString("base64");
  } catch {
    invalid("/avatar", "图片无法读取，请选择静态 PNG、JPEG 或 WebP 图片。");
  }
}
function deletionPreview(db, user) {
  const series = db
    .prepare("SELECT * FROM series WHERE ownerId=? ORDER BY id")
    .all(user.id);
  const events = db
    .prepare("SELECT * FROM tournaments WHERE ownerId=? ORDER BY id")
    .all(user.id);
  const ownSeries = new Set(series.map((s) => s.id));
  const aggregates = [];
  for (const row of db.prepare("SELECT * FROM tournaments ORDER BY id").all()) {
    if (row.ownerId !== user.id && ownSeries.has(JSON.parse(row.data).seriesId))
      reject(
        409,
        "RELATED_DATA_CONFLICT",
        "存在其他账号的历史关联数据，请联系维护者修复后再注销。",
      );
  }
  for (const row of db
    .prepare(
      "SELECT a.*,t.ownerId FROM structure_aggregates a JOIN tournaments t ON t.id=a.tournamentId ORDER BY tournamentId",
    )
    .all()) {
    const data = JSON.parse(row.data);
    if (row.ownerId === user.id) aggregates.push(row);
    else if (
      (data.snapshots || []).some(([, s]) => s.frozenBy === user.id) ||
      (data.requests || []).some(([k]) => {
        try {
          return JSON.parse(k)[0] === user.id;
        } catch {
          return false;
        }
      })
    )
      reject(
        409,
        "RELATED_DATA_CONFLICT",
        "存在其他账号的历史关联数据，请联系维护者修复后再注销。",
      );
  }
  const sessions = db
    .prepare("SELECT * FROM sessions WHERE userId=? ORDER BY tokenHash")
    .all(user.id);
  const requests = db
    .prepare(
      "SELECT * FROM catalog_requests WHERE actorId=? ORDER BY requestKey",
    )
    .all(user.id);
  const counts = {
    sessions: sessions.length,
    series: series.length,
    tournaments: events.length,
    configurations: 0,
    snapshots: 0,
    catalogRequests: requests.length,
  };
  for (const row of aggregates) {
    const d = JSON.parse(row.data);
    counts.configurations += (d.configurations || []).length;
    counts.snapshots += (d.snapshots || []).length;
  }
  const token = createHash("sha256")
    .update(
      JSON.stringify([user, series, events, aggregates, sessions, requests]),
    )
    .digest("hex");
  return { counts, token };
}
function mountProfile(api, { db, send, now, cookieOptions }) {
  api.patch("/me", async (req, res) => {
    if (!req.user) reject(401, "AUTH_REQUIRED", "请先登录，再继续操作。");
    fields(req.body, ["displayName", "username", "currentPassword", "avatar"]);
    if (
      !Object.keys(req.body).some((k) =>
        ["displayName", "username", "avatar"].includes(k),
      )
    )
      invalid("/displayName", "请选择要修改的资料。");
    const changes = {};
    if ("displayName" in req.body) {
      changes.displayName = text(req.body.displayName, "/displayName", 1, 40);
      if (!changes.displayName.trim())
        invalid("/displayName", "显示名不能为空。");
    }
    if ("username" in req.body) {
      changes.username = text(
        req.body.username,
        "/username",
        3,
        32,
      ).toLowerCase();
      if (!/^[a-z0-9_]+$/.test(changes.username))
        invalid("/username", "用户名只接受英文、数字和下划线。");
      if (changes.username !== req.user.username)
        await verifyPassword(req.user, req.body.currentPassword);
    }
    if ("avatar" in req.body) changes.avatarUrl = await avatar(req.body.avatar);
    const next = transaction(db, () => {
      const current = currentUser(db, req, now);
      const next = { ...current, ...changes };
      if (
        db
          .prepare("SELECT id FROM users WHERE username=? AND id<>?")
          .get(next.username, next.id)
      )
        reject(409, "USERNAME_TAKEN", "用户名已被使用。", {
          fieldErrors: [{ path: "/username", message: "请选择其他用户名。" }],
        });
      db.prepare("UPDATE users SET username=?,data=? WHERE id=?").run(
        next.username,
        JSON.stringify(next),
        next.id,
      );
      return next;
    });
    send(req, res, publicUser(next));
  });
  api.get("/me/deletion-preview", (req, res) =>
    send(req, res, deletionPreview(db, currentUser(db, req, now))),
  );
  api.delete("/me", async (req, res) => {
    if (!req.user) reject(401, "AUTH_REQUIRED", "请先登录，再继续操作。");
    fields(req.body, ["currentPassword", "confirmation", "expectedToken"]);
    if (req.body.confirmation !== req.user.username)
      invalid("/confirmation", "请输入当前用户名以确认注销。");
    await verifyPassword(req.user, req.body.currentPassword);
    transaction(db, () => {
      const user = currentUser(db, req, now),
        preview = deletionPreview(db, user);
      if (
        typeof req.body.expectedToken !== "string" ||
        preview.token !== req.body.expectedToken
      )
        reject(
          409,
          "DELETION_CHANGED",
          "待删除的数据已变化，请取消并重新查看注销范围。",
        );
      db.prepare("DELETE FROM catalog_requests WHERE actorId=?").run(user.id);
      db.prepare("DELETE FROM sessions WHERE userId=?").run(user.id);
      db.prepare(
        "DELETE FROM structure_aggregates WHERE tournamentId IN (SELECT id FROM tournaments WHERE ownerId=?)",
      ).run(user.id);
      db.prepare("DELETE FROM tournaments WHERE ownerId=?").run(user.id);
      db.prepare("DELETE FROM series WHERE ownerId=?").run(user.id);
      db.prepare("DELETE FROM users WHERE id=?").run(user.id);
    });
    res.clearCookie("race_session", cookieOptions);
    send(req, res, { deleted: true });
  });
}
module.exports = { mountProfile };
