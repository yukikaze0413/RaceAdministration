"use strict";
const { visible } = require("../catalog/catalog");
const { fields, reject } = require("../http/errors");
const { loginRequired } = require("../auth/sessions");
const { read, write, requirePermission, can } = require("./state");
const {
  createService,
} = require("../../tournament-configuration/application/service");
const {
  createSqliteStore,
} = require("../../tournament-configuration/adapters/sqlite-store");
function config(db, tid, cid) {
  const row = db
      .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
      .get(tid),
    c = row
      ? JSON.parse(row.data).configurations.find(([id]) => id === cid)?.[1]
      : null;
  if (!c) reject(404, "NOT_FOUND", "未找到本赛事配置。");
  return c;
}
function mountExtras(api, { db, send }) {
  api.get("/runtime-presets", (req, res) => {
    loginRequired(req);
    send(req, res, require("./presets").presets());
  });
  api.post(
    "/tournaments/:tid/configurations/from-runtime-preset",
    async (req, res) => {
      visible(db, req, req.params.tid, "structure.edit");
      fields(req.body, ["presetId"]);
      const key = req.get("Idempotency-Key");
      if (!key || key.length > 200)
        reject(422, "INVALID_INPUT", "请求键无效。");
      const payload = require("./presets").instantiate(
        req.body.presetId,
        JSON.stringify([req.params.tid, req.user.id, key]),
      );
      if (!payload) reject(404, "NOT_FOUND", "未找到赛制预设。");
      const store = createSqliteStore(db, ({ actorId }, tid) =>
        can(db, tid, actorId, "structure.edit"),
      );
      const svc = createService({
        store,
        authorize: ({ actorId }, tid) =>
          can(db, tid, actorId, "structure.edit"),
      });
      const result = await svc.createDraft({
        tournamentId: req.params.tid,
        trustedContext: { actorId: req.user.id },
        requestKey: key,
        payload,
      });
      send(req, res, result, 201);
    },
  );
  const b = "/tournaments/:tid/configurations/:cid/layout";
  api.get(b, (req, res) => {
    visible(db, req, req.params.tid, "structure.edit");
    config(db, req.params.tid, req.params.cid);
    send(
      req,
      res,
      read(db, req.params.tid).layouts[req.params.cid] ?? {
        version: 0,
        positions: {},
        zoom: 1,
        pan: { x: 0, y: 0 },
      },
    );
  });
  api.put(b, (req, res) => {
    visible(db, req, req.params.tid, "structure.edit");
    fields(req.body, ["expectedVersion", "positions", "zoom", "pan"]);
    send(
      req,
      res,
      write(
        db,
        req,
        "structure.edit",
        (s) => {
          const c = config(db, req.params.tid, req.params.cid),
            old = s.layouts[c.id] ?? { version: 0 };
          if (old.version !== req.body.expectedVersion)
            reject(409, "VERSION_CONFLICT", "画布布局已变化，请重读后比较。");
          const ids =
            require("../../tournament-configuration/domain/graph-nodes").graphNodeIds(
              c,
              s.runtime,
            );
          fields(req.body.positions, [...ids]);
          const coordinate = (x) =>
            x &&
            typeof x === "object" &&
            !Array.isArray(x) &&
            Object.keys(x).length === 2 &&
            Number.isFinite(x.x) &&
            Number.isFinite(x.y) &&
            Math.abs(x.x) <=
              (c.structureVersion === "structure-v2" ? 200000 : 10000) &&
            Math.abs(x.y) <=
              (c.structureVersion === "structure-v2" ? 200000 : 10000);
          if (
            Object.values(req.body.positions).some((p) => !coordinate(p)) ||
            !coordinate(req.body.pan) ||
            !Number.isFinite(req.body.zoom) ||
            req.body.zoom < 0.25 ||
            req.body.zoom > 2
          )
            reject(422, "INVALID_INPUT", "画布坐标或缩放无效。");
          s.layouts[c.id] = {
            version: old.version + 1,
            positions: req.body.positions,
            zoom: req.body.zoom,
            pan: req.body.pan,
          };
          return s.layouts[c.id];
        },
        { version: false },
      ),
    );
  });
}
module.exports = { mountExtras };
