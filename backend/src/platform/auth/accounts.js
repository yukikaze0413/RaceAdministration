"use strict";
const { randomUUID, randomBytes, scrypt: derive } = require("node:crypto");
const { promisify } = require("node:util");
const { reject, fields } = require("../http/errors");
const scrypt = promisify(derive);
function text(value, path, min, max) {
  if (
    typeof value !== "string" ||
    [...value].length < min ||
    [...value].length > max
  )
    reject(422, "INVALID_INPUT", "请检查输入字段。", {
      fieldErrors: [
        { path, message: "长度应为" + min + "到" + max + "个字符。" },
      ],
    });
  return value;
}
function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl ?? null };
}
const passwordParameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
async function hash(password, salt, parameters = passwordParameters) {
  return (await scrypt(password, salt, 64, parameters)).toString("hex");
}
function mountAccounts(api, { db, send, now = Date.now }) {
  api.post("/auth/register", async (req, res) => {
    const p = req.body;
    fields(p, ["username", "displayName", "password"]);
    const username = text(p.username, "/username", 3, 32).toLowerCase();
    if (!/^[a-z0-9_]+$/.test(username))
      reject(422, "INVALID_INPUT", "用户名只接受字母、数字和下划线。", {
        fieldErrors: [{ path: "/username", message: "用户名格式无效。" }],
      });
    const displayName = text(p.displayName, "/displayName", 1, 40);
    if (!displayName.trim()) reject(422, "INVALID_INPUT", "显示名不能为空。");
    if (typeof p.password !== "string" || p.password.length === 0)
      reject(422, "INVALID_INPUT", "请检查输入字段。", {
        fieldErrors: [{ path: "/password", message: "密码不能为空。" }],
      });
    const salt = randomBytes(16).toString("hex");
    const u = {
      id: randomUUID(),
      username,
      displayName,
      salt,
      passwordParameters,
      passwordHash: await hash(p.password, salt),
      createdAt: now(),
    };
    try {
      db.prepare("INSERT INTO users VALUES(?,?,?)").run(
        u.id,
        username,
        JSON.stringify(u),
      );
    } catch (e) {
      if (e.code?.includes("CONSTRAINT") || (Number(e.errcode) & 255) === 19)
        reject(409, "USERNAME_TAKEN", "用户名已被使用。", {
          fieldErrors: [{ path: "/username", message: "请选择其他用户名。" }],
        });
      throw e;
    }
    send(req, res, publicUser(u), 201);
  });
}
module.exports = { mountAccounts, publicUser, hash, text };
