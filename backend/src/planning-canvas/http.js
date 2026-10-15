"use strict";
const { randomUUID } = require("node:crypto"),
  G = require("./graph");
const { fields, reject } = require("../platform/http/errors");
const { loginRequired } = require("../platform/auth/sessions");
const { transaction } = require("../platform/storage/database");
function mountCanvas(api, { db, send }) {
  const S = require("./schedule");
  api.get("/planning-canvas/catalog", (req, res) => {
    loginRequired(req);
    send(req, res, {
      nodes: G.KINDS.map((k) => require("./samples").node(k, "new-" + k)),
      matchFormats: require("./match-rules").formats,
      propertyDefinitions: require("./property-definitions").definitions,
      formats:
        require("../tournament-configuration/domain/formats/registry").formatCatalog(),
    });
  });
  const pack = (row) => ({
    id: row.id,
    name: row.name,
    version: row.version,
    graph: JSON.parse(row.graph),
    digest: G.digest(JSON.parse(row.graph)),
  });
  const get = (req) => {
    const u = loginRequired(req),
      row = db
        .prepare("SELECT * FROM planning_canvases WHERE id=?")
        .get(req.params.id);
    if (!row) reject(404, "NOT_FOUND", "未找到规划草稿");
    if (row.ownerId !== u.id)
      reject(403, "FORBIDDEN", "此规划草稿属于其他用户");
    return row;
  };
  const current = (row, version) => {
    if (version !== row.version)
      reject(409, "VERSION_CONFLICT", "保存版本已变化，请保留草稿并重新读取");
  };
  function write(req, operation, fn) {
    const user = loginRequired(req),
      key = req.get("Idempotency-Key");
    if (typeof key !== "string" || !key.trim() || key.length > 200)
      reject(422, "INVALID_INPUT", "写入必须使用请求键");
    const fingerprint = G.digest({
      operation,
      id: req.params.id ?? null,
      body: req.body,
    });
    return transaction(db, () => {
      loginRequired(req);
      if (req.params.id && operation !== "delete") get(req);
      if (!db.prepare("SELECT id FROM users WHERE id=?").get(user.id))
        reject(401, "AUTH_REQUIRED", "账号已失效");
      const old = db
        .prepare(
          "SELECT * FROM canvas_requests WHERE actorId=? AND requestKey=?",
        )
        .get(user.id, key);
      if (old) {
        if (old.fingerprint !== fingerprint)
          reject(409, "IDEMPOTENCY_CONFLICT", "原请求键已用于不同内容");
        return JSON.parse(old.result);
      }
      if (req.params.id && operation === "delete") get(req);
      const result = fn(user);
      db.prepare("INSERT INTO canvas_requests VALUES(?,?,?,?)").run(
        user.id,
        key,
        fingerprint,
        JSON.stringify(result),
      );
      return result;
    });
  }
  api.get("/planning-canvas/samples/:name", (req, res) => {
    loginRequired(req);
    const graph = G.sample(req.params.name);
    send(req, res, { graph, analysis: G.analyze(graph) });
  });
  api.post("/planning-canvas/analyze", (req, res) => {
    loginRequired(req);
    fields(req.body, ["graph"]);
    send(req, res, G.analyze(req.body.graph));
  });
  api.post("/planning-canvas/edit", (req, res) => {
    loginRequired(req);
    fields(req.body, ["graph", "action"]);
    const result = G.edit(req.body.graph, req.body.action);
    send(req, res, { ...result, analysis: G.analyze(result.graph) });
  });
  api.get("/planning-canvases", (req, res) => {
    const u = loginRequired(req);
    send(
      req,
      res,
      db
        .prepare(
          "SELECT id,name,version FROM planning_canvases WHERE ownerId=? ORDER BY rowid DESC",
        )
        .all(u.id),
    );
  });
  api.post("/planning-canvases", (req, res) => {
    fields(req.body, ["graph", "name"]);
    send(
      req,
      res,
      write(req, "create", (u) => {
        const graph = G.parse(req.body.graph);
        G.checkEdges(graph);
        if (
          typeof req.body.name !== "string" ||
          !req.body.name.trim() ||
          req.body.name.length > 200
        )
          reject(422, "INVALID_INPUT", "请输入草稿名称");
        const id = randomUUID();
        db.prepare("INSERT INTO planning_canvases VALUES(?,?,?,?,?,NULL)").run(
          id,
          u.id,
          1,
          req.body.name,
          JSON.stringify(graph),
        );
        return pack(
          db.prepare("SELECT * FROM planning_canvases WHERE id=?").get(id),
        );
      }),
      201,
    );
  });
  api.get("/planning-canvases/:id", (req, res) =>
    send(req, res, pack(get(req))),
  );
  api.delete("/planning-canvases/:id", (req, res) => {
    fields(req.body, ["expectedVersion"]);
    send(req, res, write(req, "delete", () => {
      const row = get(req);
      current(row, req.body.expectedVersion);
      db.prepare("DELETE FROM planning_canvases WHERE id=?").run(row.id);
      return { id: row.id, deleted: true };
    }));
  });
  api.put("/planning-canvases/:id", (req, res) => {
    fields(req.body, ["expectedVersion", "graph", "name"]);
    send(
      req,
      res,
      write(req, "replace", () => {
        const row = get(req);
        current(row, req.body.expectedVersion);
        const graph = G.parse(req.body.graph);
        G.checkEdges(graph);
        if (
          typeof req.body.name !== "string" ||
          !req.body.name.trim() ||
          req.body.name.length > 200
        )
          reject(422, "INVALID_INPUT", "请输入草稿名称");
        db.prepare(
          "UPDATE planning_canvases SET name=?,graph=?,version=version+1,validation=NULL WHERE id=?",
        ).run(req.body.name, JSON.stringify(graph), row.id);
        return pack(
          db.prepare("SELECT * FROM planning_canvases WHERE id=?").get(row.id),
        );
      }),
    );
  });
  api.post("/planning-canvases/:id/validate", (req, res) => {
    fields(req.body, ["expectedVersion"]);
    const result = transaction(db, () => {
      const row = get(req);
      current(row, req.body.expectedVersion);
      const graph = JSON.parse(row.graph),
        r = {
          ...G.analyze(graph),
          version: row.version,
          digest: G.digest(graph),
        };
      if (r.wavePlan) {
        r.wavePlan.graphVersion = row.version;
        r.wavePlanDigest = G.digest(r.wavePlan);
      }
      db.prepare("UPDATE planning_canvases SET validation=? WHERE id=?").run(
        JSON.stringify(r),
        row.id,
      );
      return r;
    });
    send(req, res, result);
  });
  api.post("/planning-canvases/:id/preview", (req, res) => {
    fields(req.body, ["expectedVersion"]);
    const row = get(req);
    current(row, req.body.expectedVersion);
    const graph = JSON.parse(row.graph),
      validation = row.validation ? JSON.parse(row.validation) : null;
    if (
      !validation?.valid ||
      validation.version !== row.version ||
      validation.digest !== G.digest(graph) ||
      (graph.schemaVersion === "canvas-v2" &&
        validation.wavePlan?.plannerVersion !==
          require("./waves").PLANNER_VERSION)
    )
      reject(409, "VALIDATION_REQUIRED", "请先验证当前保存版本");
    send(req, res, {
      ...G.preview(graph, row.id, validation.matches ? validation : undefined),
      version: row.version,
      digest: validation.digest,
    });
  });
  function validationFor(row) {
    const validation = row.validation ? JSON.parse(row.validation) : null;
    if (
      !validation?.valid ||
      !validation.wavePlan ||
      validation.version !== row.version ||
      validation.digest !== G.digest(JSON.parse(row.graph)) ||
      validation.wavePlan.plannerVersion !== require("./waves").PLANNER_VERSION
    )
      reject(409, "VALIDATION_REQUIRED", "请先保存并验证当前画布");
    return validation;
  }
  api.get("/planning-canvases/:id/schedule", (req, res) => {
    const row = get(req),
      record = db
        .prepare("SELECT * FROM planning_canvas_schedules WHERE canvasId=?")
        .get(row.id);
    const schedule = record ? JSON.parse(record.data) : null;
    const validation = row.validation ? JSON.parse(row.validation) : null;
    const currentPlan =
      validation?.valid &&
      validation.version === row.version &&
      validation.digest === G.digest(JSON.parse(row.graph)) &&
      validation.wavePlan?.plannerVersion === require("./waves").PLANNER_VERSION
        ? validation.wavePlan
        : null;
    send(req, res, {
      version: record?.version ?? 0,
      schedule,
      stale:
        !!schedule &&
        (!currentPlan || schedule.wavePlanDigest !== validation.wavePlanDigest),
      currentWavePlan: currentPlan,
      currentWavePlanDigest: currentPlan ? validation.wavePlanDigest : null,
      graphVersion: row.version,
    });
  });
  api.put("/planning-canvases/:id/schedule", (req, res) => {
    fields(req.body, [
      "expectedVersion",
      "expectedScheduleVersion",
      "wavePlanDigest",
      "sessions",
    ]);
    send(
      req,
      res,
      write(req, "schedule-replace", () => {
        const row = get(req);
        current(row, req.body.expectedVersion);
        const validation = validationFor(row),
          old = db
            .prepare("SELECT * FROM planning_canvas_schedules WHERE canvasId=?")
            .get(row.id);
        if (
          req.body.expectedScheduleVersion !== (old?.version ?? 0) ||
          req.body.wavePlanDigest !== validation.wavePlanDigest
        )
          reject(
            409,
            "VERSION_CONFLICT",
            "图或排期版本已变化，请保留本地修改并重新读取",
          );
        const report = S.check(validation.wavePlan, req.body.sessions);
        if (!report.valid)
          reject(
            422,
            "INVALID_INPUT",
            report.diagnostics
              .filter((d) => d.severity === "error")
              .map((d) => d.reason)
              .join("；"),
          );
        const version = (old?.version ?? 0) + 1,
          schedule = {
            wavePlanDigest: validation.wavePlanDigest,
            boundWavePlan: validation.wavePlan,
            sessions: req.body.sessions,
          };
        db.prepare(
          "INSERT INTO planning_canvas_schedules(canvasId,version,data) VALUES(?,?,?) ON CONFLICT(canvasId) DO UPDATE SET version=excluded.version,data=excluded.data",
        ).run(row.id, version, JSON.stringify(schedule));
        return { version, schedule, stale: false, ...report };
      }),
    );
  });
}
module.exports = { mountCanvas };
