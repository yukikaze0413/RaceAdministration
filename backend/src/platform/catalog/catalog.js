"use strict";
const { randomUUID } = require("node:crypto");
const presets = require("../games/presets.json");
const gamePreset = (id) => presets.items.find((item) => item.id === id);
const { transaction } = require("../storage/database");
const { reject, fields } = require("../http/errors");
const { text } = require("../auth/accounts");
const { loginRequired } = require("../auth/sessions");
const { digest } = require("../../tournament-configuration/domain/canonical");
function load(db, table, id) {
  const row = db.prepare("SELECT data FROM " + table + " WHERE id=?").get(id);
  if (!row) reject(404, "NOT_FOUND", "未找到这项资料。");
  return JSON.parse(row.data);
}
function visible(db, req, id, manage = false) {
  if (manage) loginRequired(req);
  const record = load(db, "tournaments", id);
  const owner = record.ownerId === req.user?.id;
  if (!owner && record.visibility !== "public")
    reject(404, "NOT_FOUND", "未找到这场赛事。");
  if (manage && !owner)
    reject(403, "FORBIDDEN", "只有赛事创建者可以管理这场赛事。");
  return record;
}
function pagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page),
    pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 50
  )
    reject(400, "BAD_REQUEST", "分页参数无效。");
  return { page, pageSize };
}
function pageOf(items, query) {
  const { page, pageSize } = pagination(query);
  const sorted = [...items].sort(
    (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  );
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
  };
}
function all(db, table) {
  return db
    .prepare("SELECT data FROM " + table)
    .all()
    .map((x) => JSON.parse(x.data));
}
function safeTournament(t) {
  const { ownerId, ...result } = t;
  return {
    ...result,
    gameId: result.gameId ?? null,
    runtimeStatus: "not-started",
  };
}
function write(db, req, operation, id, fn) {
  const user = loginRequired(req),
    key = req.get("Idempotency-Key");
  if (typeof key !== "string" || !key.trim() || key.length > 200)
    reject(422, "INVALID_INPUT", "需要有效的请求键。");
  const fingerprint = digest({ operation, id: id || null, payload: req.body });
  return transaction(db, () => {
    const prior = db
      .prepare(
        "SELECT fingerprint,result FROM catalog_requests WHERE actorId=? AND requestKey=?",
      )
      .get(user.id, key);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        reject(409, "IDEMPOTENCY_CONFLICT", "请求键已用于其他操作。");
      return JSON.parse(prior.result);
    }
    const result = fn(user),
      serialized = JSON.stringify(result);
    db.prepare("INSERT INTO catalog_requests VALUES(?,?,?,?)").run(
      user.id,
      key,
      fingerprint,
      serialized,
    );
    return JSON.parse(serialized);
  });
}
function validate(body, table, creating) {
  fields(
    body,
    table === "series"
      ? ["name", "description", "expectedVersion"]
      : [
          "name",
          "game",
          "gameId",
          "description",
          "location",
          "startsAt",
          "seriesId",
          "visibility",
          "expectedVersion",
        ],
  );
  if (creating && Object.hasOwn(body, "expectedVersion"))
    reject(422, "INVALID_INPUT", "创建不接受预期版本。");
  for (const [key, max] of [
    ["name", 100],
    ["description", 2000],
    ["location", 200],
  ])
    if (body[key] !== undefined)
      text(body[key], "/" + key, key === "name" ? 1 : 0, max);
  if (body.name !== undefined && !body.name.trim())
    reject(422, "INVALID_INPUT", "名称不能为空。");
  if (creating && body.name === undefined)
    reject(422, "INVALID_INPUT", "请填写名称。", {
      fieldErrors: [{ path: "/name", message: "名称不能为空。" }],
    });
  if (table === "tournaments") {
    if (body.gameId != null && !gamePreset(body.gameId))
      reject(422, "INVALID_INPUT", "游戏预设无效。", {
        fieldErrors: [{ path: "/gameId", message: "请选择有效游戏预设。" }],
      });
    if (
      body.gameId != null &&
      body.game !== undefined &&
      body.game !== gamePreset(body.gameId).category
    )
      reject(422, "INVALID_INPUT", "游戏与分类不一致。", {
        fieldErrors: [{ path: "/game", message: "分类必须与游戏预设一致。" }],
      });
    if (
      ((creating && body.gameId == null) || body.game !== undefined) &&
      !["card", "fighting"].includes(body.game)
    )
      reject(422, "INVALID_INPUT", "请选择卡牌或格斗分类。", {
        fieldErrors: [{ path: "/game", message: "分类无效。" }],
      });
    if (
      body.visibility !== undefined &&
      !["private", "public"].includes(body.visibility)
    )
      reject(422, "INVALID_INPUT", "公开状态无效。");
    if (
      body.seriesId !== undefined &&
      body.seriesId !== null &&
      (typeof body.seriesId !== "string" || !body.seriesId)
    )
      reject(422, "INVALID_INPUT", "系列ID无效。");
    if (body.startsAt != null) {
      if (
        typeof body.startsAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(
          body.startsAt,
        ) ||
        !Number.isFinite(Date.parse(body.startsAt))
      )
        reject(422, "INVALID_INPUT", "时间应为带时区的ISO8601格式。", {
          fieldErrors: [
            { path: "/startsAt", message: "时间应为带时区的ISO8601格式。" },
          ],
        });
      const [year, month, day] = body.startsAt
        .slice(0, 10)
        .split("-")
        .map(Number);
      if (
        day < 1 ||
        day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
        month < 1 ||
        month > 12
      )
        reject(422, "INVALID_INPUT", "日期无效。", {
          fieldErrors: [{ path: "/startsAt", message: "日期无效。" }],
        });
    }
  }
}
function mountCatalog(api, { db, send, now = Date.now }) {
  api.get("/games", (req, res) => send(req, res, presets));
  for (const table of ["series", "tournaments"]) {
    api.post("/" + table, (req, res) => {
      loginRequired(req);
      validate(req.body, table, true);
      const record = write(db, req, "create-" + table, null, (user) => {
        const body = {
          description: "",
          ...(table === "tournaments"
            ? {
                gameId: null,
                location: "",
                seriesId: null,
                startsAt: null,
                visibility: "private",
              }
            : {}),
          ...req.body,
        };
        if (table === "tournaments" && body.gameId != null)
          body.game = gamePreset(body.gameId).category;
        if (body.seriesId) {
          const s = load(db, "series", body.seriesId);
          if (s.ownerId !== user.id)
            reject(403, "FORBIDDEN", "不能关联他人的系列。");
        }
        if (body.startsAt)
          body.startsAt = new Date(body.startsAt).toISOString();
        const result = {
          ...body,
          id: randomUUID(),
          ownerId: user.id,
          version: 1,
          createdAt: now(),
          updatedAt: now(),
        };
        db.prepare("INSERT INTO " + table + " VALUES(?,?,?)").run(
          result.id,
          user.id,
          JSON.stringify(result),
        );
        return result;
      });
      send(
        req,
        res,
        table === "tournaments" ? safeTournament(record) : record,
        201,
      );
    });
    api.patch("/" + table + "/:id", (req, res) => {
      const user = loginRequired(req),
        original =
          table === "tournaments"
            ? visible(db, req, req.params.id, true)
            : load(db, table, req.params.id);
      if (original.ownerId !== user.id)
        reject(403, "FORBIDDEN", "只能修改自己的系列。");
      validate(req.body, table, false);
      const record = write(db, req, "edit-" + table, req.params.id, (actor) => {
        const current = load(db, table, req.params.id);
        if (req.body.expectedVersion !== current.version)
          reject(409, "VERSION_CONFLICT", "资料版本已变化，请重新读取。");
        const { expectedVersion, ...body } = req.body;
        if (table === "tournaments") {
          const effectiveId = Object.hasOwn(body, "gameId")
            ? body.gameId
            : current.gameId;
          const preset = gamePreset(effectiveId);
          if (preset) {
            if (body.game !== undefined && body.game !== preset.category)
              reject(422, "INVALID_INPUT", "游戏与分类不一致。", {
                fieldErrors: [
                  { path: "/game", message: "分类必须与游戏预设一致。" },
                ],
              });
            body.game = preset.category;
          }
        }
        if (
          body.seriesId &&
          load(db, "series", body.seriesId).ownerId !== actor.id
        )
          reject(403, "FORBIDDEN", "不能关联他人的系列。");
        if (body.startsAt)
          body.startsAt = new Date(body.startsAt).toISOString();
        const result = {
          ...current,
          ...body,
          version: current.version + 1,
          updatedAt: now(),
        };
        db.prepare("UPDATE " + table + " SET data=? WHERE id=?").run(
          JSON.stringify(result),
          result.id,
        );
        return result;
      });
      send(req, res, table === "tournaments" ? safeTournament(record) : record);
    });
  }
  api.get("/tournaments", (req, res) => {
    fields(req.query, ["q", "game", "gameId", "page", "pageSize"], 400);
    if (
      req.query.q !== undefined &&
      (typeof req.query.q !== "string" || req.query.q.length > 200)
    )
      reject(400, "BAD_REQUEST", "搜索条件无效。");
    if (req.query.game && !["card", "fighting"].includes(req.query.game))
      reject(400, "BAD_REQUEST", "分类无效。");
    if (
      req.query.gameId !== undefined &&
      req.query.gameId !== "unspecified" &&
      !gamePreset(req.query.gameId)
    )
      reject(400, "BAD_REQUEST", "游戏筛选无效。");
    const items = all(db, "tournaments").filter(
      (x) =>
        x.visibility === "public" &&
        (!req.query.q ||
          x.name.toLowerCase().includes(req.query.q.toLowerCase())) &&
        (!req.query.game || x.game === req.query.game) &&
        (req.query.gameId === undefined ||
          (req.query.gameId === "unspecified"
            ? x.gameId == null
            : x.gameId === req.query.gameId)),
    );
    send(req, res, pageOf(items.map(safeTournament), req.query));
  });
  api.get("/tournaments/:id", (req, res) =>
    send(req, res, {
      ...safeTournament(visible(db, req, req.params.id)),
      isOwner: visible(db, req, req.params.id).ownerId === req.user?.id,
    }),
  );
  api.get("/me/tournaments", (req, res) => {
    const user = loginRequired(req);
    fields(req.query, ["relation", "page", "pageSize"], 400);
    const relation = req.query.relation || "created";
    if (!["created", "managed", "joined"].includes(relation))
      reject(400, "BAD_REQUEST", "赛事关系无效。");
    if (relation === "joined")
      reject(501, "FEATURE_NOT_IMPLEMENTED", "当前尚未提供参赛记录服务。", {
        capability: "participation",
      });
    send(
      req,
      res,
      pageOf(
        all(db, "tournaments")
          .filter((x) => x.ownerId === user.id)
          .map(safeTournament),
        req.query,
      ),
    );
  });
  api.get("/me/series", (req, res) => {
    const user = loginRequired(req);
    fields(req.query, ["page", "pageSize"], 400);
    send(
      req,
      res,
      pageOf(
        all(db, "series").filter((x) => x.ownerId === user.id),
        req.query,
      ),
    );
  });
  api.get("/series/:id", (req, res) => {
    fields(req.query, ["page", "pageSize"], 400);
    const series = load(db, "series", req.params.id),
      owner = series.ownerId === req.user?.id;
    const entries = all(db, "tournaments").filter(
      (x) => x.seriesId === series.id && (owner || x.visibility === "public"),
    );
    if (!owner && !entries.length) reject(404, "NOT_FOUND", "未找到这个系列。");
    const { ownerId, ...publicSeries } = series;
    send(req, res, {
      ...(owner
        ? publicSeries
        : {
            id: series.id,
            name: series.name,
            description: series.description,
          }),
      isOwner: owner,
      ...pageOf(entries.map(safeTournament), req.query),
    });
  });
}
module.exports = { mountCatalog, visible, load, all, safeTournament };
