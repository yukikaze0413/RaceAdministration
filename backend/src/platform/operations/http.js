"use strict";
const { randomUUID } = require("node:crypto");
const { visible } = require("../catalog/catalog");
const { fields, reject } = require("../http/errors");
const {
  read,
  write,
  effective,
  requirePermission,
  permissions,
} = require("./state");
function mountOperations(api, { db, send, now = Date.now }) {
  require("./registration").mountRegistration(api, { db, send });
  require("./runtime-http").mountRuntime(api, { db, send, now });
  require("./extras").mountExtras(api, { db, send });
  const base = "/tournaments/:tid";
  const access = (req) => visible(db, req, req.params.tid);
  api.get(base + "/collaborators", (req, res) => {
    access(req);
    requirePermission(db, req, req.params.tid, "collaborators.manage");
    const s = read(db, req.params.tid);
    send(req, res, {
      version: s.version,
      items: Object.entries(s.collaborators).map(([userId, c]) => ({
        userId,
        ...c,
      })),
      permissions,
    });
  });
  function grant(req, res) {
    access(req);
    fields(req.body, ["expectedVersion", "userId", "username", "permissions"]);
    send(
      req,
      res,
      write(db, req, "collaborators.manage", (s) => {
        const row = req.params.uid
          ? db
              .prepare("SELECT id,data FROM users WHERE id=?")
              .get(req.params.uid)
          : req.body.userId
            ? db
                .prepare("SELECT id,data FROM users WHERE id=?")
                .get(req.body.userId)
            : db
                .prepare("SELECT id,data FROM users WHERE username=?")
                .get(req.body.username);
        if (!row) reject(404, "NOT_FOUND", "未找到注册用户。");
        if (
          !Array.isArray(req.body.permissions) ||
          req.body.permissions.some((p) => !permissions.includes(p)) ||
          new Set(req.body.permissions).size !== req.body.permissions.length
        )
          reject(422, "INVALID_INPUT", "授权能力无效。");
        s.collaborators[row.id] = {
          name: JSON.parse(row.data).displayName,
          permissions: req.body.permissions,
        };
      }),
    );
  }
  api.post(base + "/collaborators", grant);
  api.patch(base + "/collaborators/:uid", grant);
  api.delete(base + "/collaborators/:uid", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion"]);
    send(
      req,
      res,
      write(db, req, "collaborators.manage", (s) => {
        if (!s.collaborators[req.params.uid])
          reject(404, "NOT_FOUND", "未找到协作者。");
        delete s.collaborators[req.params.uid];
      }),
    );
  });
  api.post(base + "/rounds/:rid/confirm", (req, res) => {
    access(req);
    requirePermission(db, req, req.params.tid, "rounds.confirm");
    reject(409, "NOT_READY", "尚未开赛。");
  });
}
module.exports = { mountOperations };
