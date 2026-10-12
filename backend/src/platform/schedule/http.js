"use strict";
const { transaction } = require("../storage/database"),
  { fields, reject } = require("../http/errors"),
  { visible } = require("../catalog/catalog"),
  {
    requirePermission,
    effective,
    read: operations,
  } = require("../operations/state"),
  { runtimeView } = require("../operations/runtime"),
  { loginRequired } = require("../auth/sessions"),
  { digest } = require("../../tournament-configuration/domain/canonical");
const store = require("./store"),
  { parseSchedule, validateSchedule, execution } = require("./validation"),
  { buildItems } = require("./items");
function projection(schedule) {
  const { requests, audit, ...out } = schedule;
  return structuredClone(out);
}
function report(schedule, configuration, runtime) {
  const items = buildItems(configuration, runtime),
    out = validateSchedule(schedule, items);
  for (const w of schedule.windows.filter((w) => w.planKey))
    for (const m of items.filter((m) => m.windowKey === w.planKey))
      if (!schedule.assignments.some((a) => a.planKey === m.planKey))
        out.diagnostics.push({
          code: "PAIRING_ASSIGNMENT_PENDING",
          severity: "pending",
          reason: "配对已生成，具体比赛尚未明确分配到时间窗口。",
          planKeys: [m.planKey],
          path: "/assignments",
        });
  if (
    out.status !== "blocked" &&
    out.diagnostics.some((d) => d.severity === "pending")
  )
    out.status = "pending";
  return out;
}
function revalidate(db, tid, operationState) {
  const schedule = store.read(db, tid);
  if (!schedule.configurationId) return;
  const c = store
    .configurations(db, tid)
    .find((c) => c.id === schedule.configurationId);
  if (!c?.snapshot) return;
  schedule.validation = {
    ...report(schedule, c, operationState.runtime),
    runtimeVersion: operationState.version,
  };
  store.save(db, tid, schedule);
}
function mountSchedule(api, { db, send, now = Date.now }) {
  const path = "/tournaments/:tid/schedule";
  api.get(path, (req, res) => {
    visible(db, req, req.params.tid);
    const tid = req.params.tid,
      s = store.read(db, tid),
      ops = operations(db, tid),
      configs = store.configurations(db, tid).filter((c) => c.snapshot),
      c =
        configs.find(
          (c) =>
            c.id ===
            (req.query.configurationId ??
              s.configurationId ??
              ops.runtime?.configurationId),
        ) ?? (configs.length === 1 ? configs[0] : null);
    if (
      req.query.configurationId &&
      !configs.some((c) => c.id === req.query.configurationId)
    )
      reject(404, "NOT_FOUND", "未找到本赛事已冻结配置。");
    const runtime = runtimeView(ops, req.user?.id, false);
    send(req, res, {
      schedule: projection(s),
      permissions: effective(db, tid, req.user?.id),
      configurations: configs.map((c) => ({
        id: c.id,
        version: c.version,
        name: c.snapshot.structure.stages
          .map((s) => s.name ?? "阶段")
          .join(" / "),
      })),
      configuration: c
        ? {
            id: c.id,
            structure: c.snapshot.structure,
            plan: c.snapshot.plan,
            structureDigest: c.snapshot.digest,
            planDigest: c.snapshot.planDigest,
          }
        : null,
      runtime,
      runtimeVersion: ops.version,
      items: c ? buildItems(c, ops.runtime) : [],
      validation: c ? report(s, c, ops.runtime) : s.validation,
    });
  });
  api.put(path, (req, res) => {
    visible(db, req, req.params.tid);
    fields(req.body, ["expectedVersion", "payload", "reason"]);
    const uid = loginRequired(req).id,
      tid = req.params.tid,
      key = req.get("Idempotency-Key");
    if (!key || key.length > 200)
      reject(422, "INVALID_INPUT", "需要有效请求键。");
    send(
      req,
      res,
      transaction(db, () => {
        requirePermission(db, req, tid, "structure.edit");
        const current = store.read(db, tid),
          fingerprint = digest({
            path: req.path,
            method: req.method,
            body: req.body,
          }),
          requestId = JSON.stringify([uid, key]);
        if (current.requests[requestId]) {
          const old = current.requests[requestId];
          if (old.fingerprint !== fingerprint)
            reject(409, "IDEMPOTENCY_CONFLICT", "请求键已用于其他输入。");
          return old.result;
        }
        if (current.version !== req.body.expectedVersion)
          reject(409, "VERSION_CONFLICT", "时间计划版本已变化，请读取后比较。");
        const payload = parseSchedule(req.body.payload),
          c = store
            .configurations(db, tid)
            .find((c) => c.id === payload.configurationId),
          ops = operations(db, tid);
        if (!c?.snapshot)
          reject(
            409,
            "CONFIG_NOT_FROZEN",
            "时间计划必须绑定本赛事已冻结配置。",
          );
        if (ops.runtime && ops.runtime.configurationId !== c.id)
          reject(409, "CONFIGURATION_MISMATCH", "赛事运行已绑定另一配置。");
        if (!c.snapshot.plan && !ops.runtime)
          reject(
            409,
            "PLAN_UNAVAILABLE",
            "旧版结构需要实际开赛后才能按已有比赛安排时间。",
          );
        const items = buildItems(c, ops.runtime);
        for (const m of items.filter((m) => m.started)) {
          const old = current.assignments.find((a) => a.planKey === m.planKey),
            next = payload.assignments.find((a) => a.planKey === m.planKey);
          if (
            JSON.stringify(old ? execution(current, old) : null) !==
            JSON.stringify(next ? execution(payload, next) : null)
          )
            reject(
              409,
              "MATCH_STARTED",
              "已实际开始或结束比赛的计划不可修改。",
              {
                diagnostics: [
                  {
                    code: "MATCH_STARTED",
                    severity: "error",
                    planKeys: [m.planKey],
                    path: "/assignments",
                    reason: "请保留已开始比赛的原计划。",
                  },
                ],
              },
            );
          if (m.kind === "window") {
            const oldWindow = current.windows.find(
                (w) => w.planKey === m.planKey,
              ),
              nextWindow = payload.windows.find((w) => w.planKey === m.planKey);
            if (
              JSON.stringify(oldWindow ?? null) !==
              JSON.stringify(nextWindow ?? null)
            )
              reject(409, "MATCH_STARTED", "已开始轮次窗口不可修改。");
          }
        }
        const validation = report(payload, c, ops.runtime);
        if (validation.status === "blocked")
          reject(
            422,
            "SCHEDULE_CONFLICT",
            "时间计划有明确冲突，原计划保持不变。",
            { diagnostics: validation.diagnostics },
          );
        if (
          req.body.reason !== undefined &&
          (typeof req.body.reason !== "string" ||
            !req.body.reason.trim() ||
            req.body.reason.length > 500)
        )
          reject(422, "INVALID_INPUT", "时间计划修改原因无效。");
        const next = {
          ...current,
          ...payload,
          version: current.version + 1,
          structureDigest: c.snapshot.digest,
          planDigest: c.snapshot.planDigest ?? null,
          validation: { ...validation, runtimeVersion: ops.version },
        };
        next.audit = [
          ...current.audit,
          {
            version: next.version,
            at: new Date(now()).toISOString(),
            actorId: uid,
            reason: req.body.reason ?? "手动时间编排",
            previous: projection(current),
          },
        ];
        const result = projection(next);
        next.requests[requestId] = { fingerprint, result };
        store.save(db, tid, next);
        return result;
      }),
    );
  });
}
module.exports = { mountSchedule, revalidate, report, projection };
