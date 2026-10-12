"use strict";
const { visible } = require("../catalog/catalog");
const { loginRequired } = require("../auth/sessions");
const { fields, reject } = require("../http/errors");
const {
  createService,
} = require("../../tournament-configuration/application/service");
const {
  createSqliteStore,
} = require("../../tournament-configuration/adapters/sqlite-store");
const {
  listTemplates,
} = require("../../tournament-configuration/domain/templates");
function mountConfiguration(api, { db, send, allowReferenceUnits = false }) {
  const store = createSqliteStore(
      db,
      ({ actorId, parentAuthorization }, tid, action = "structure.edit") =>
        (!parentAuthorization || parentAuthorization() === true) &&
        require("../operations/state").can(db, tid, actorId, action),
    ),
    service = createService({
      store,
      allowReferenceUnits,
      authorize: ({ actorId, parentAuthorization }, tid) => {
        if (parentAuthorization && parentAuthorization() !== true) return false;
        const row = db
          .prepare("SELECT ownerId FROM tournaments WHERE id=?")
          .get(tid);
        return require("../operations/state").can(
          db,
          tid,
          actorId,
          "structure.edit",
        );
      },
    });
  api.get("/templates", (req, res) => {
    loginRequired(req);
    send(req, res, listTemplates());
  });
  api.get("/formats", (req, res) => {
    loginRequired(req);
    send(
      req,
      res,
      require("../../tournament-configuration/domain/formats/registry").formatCatalog(),
    );
  });
  const base = "/tournaments/:tid/configurations";
  function params(req) {
    visible(db, req, req.params.tid, "structure.edit");
    const key = req.get("Idempotency-Key");
    if (key && key.length > 200) reject(422, "INVALID_INPUT", "请求键过长。");
    return {
      tournamentId: req.params.tid,
      id: req.params.cid,
      trustedContext: {
        actorId: req.user.id,
        ...(typeof req.parentAuthorization === "function"
          ? { parentAuthorization: req.parentAuthorization }
          : {}),
      },
      requestKey: key,
    };
  }
  api.get(base, async (req, res) => {
    const p = params(req),
      state = await store.read(p.tournamentId);
    send(
      req,
      res,
      [...state.configurations.values()].map((c) => ({
        id: c.id,
        version: c.version,
        state: c.state,
        templateOrigin: c.templateOrigin,
        frozenAt: c.snapshot?.frozenAt,
      })),
    );
  });
  api.post(base, async (req, res) => {
    const p = params(req);
    fields(req.body, ["payload"]);
    send(
      req,
      res,
      await service.createDraft({ ...p, payload: req.body.payload }),
      201,
    );
  });
  api.post(base + "/:cid/copy-upgrade", async (req, res) => {
    const p = params(req);
    fields(req.body, ["expectedVersion"]);
    send(
      req,
      res,
      await service.copyUpgrade({
        ...p,
        expectedVersion: req.body.expectedVersion,
      }),
      201,
    );
  });
  api.post(base + "/:cid/stages", async (req, res) => {
    const p = params(req);
    fields(req.body, ["expectedVersion", "stage"]);
    send(
      req,
      res,
      await service.addStage({
        ...p,
        expectedVersion: req.body.expectedVersion,
        payload: req.body.stage,
      }),
    );
  });
  api.post(base + "/:cid/stages/:sid/plan", async (req, res) => {
    const p = params(req);
    fields(req.body, ["expectedVersion", "changes"]);
    send(
      req,
      res,
      await service.planStageChange({
        ...p,
        expectedVersion: req.body.expectedVersion,
        payload: { stageId: req.params.sid, changes: req.body.changes },
      }),
    );
  });
  api.post(base + "/:cid/stages/:sid/apply", async (req, res) => {
    const p = params(req);
    fields(req.body, [
      "expectedVersion",
      "changes",
      "confirmed",
      "confirmationToken",
    ]);
    send(
      req,
      res,
      await service.applyStageChange({
        ...p,
        expectedVersion: req.body.expectedVersion,
        payload: {
          stageId: req.params.sid,
          changes: req.body.changes,
          ...(req.body.confirmed !== undefined
            ? { confirmed: req.body.confirmed }
            : {}),
          ...(req.body.confirmationToken !== undefined
            ? { confirmationToken: req.body.confirmationToken }
            : {}),
        },
      }),
    );
  });
  api.post(base + "/from-template", async (req, res) => {
    const p = params(req);
    fields(req.body, ["templateId", "templateVersion"]);
    send(
      req,
      res,
      await service.instantiateTemplate({ ...p, payload: req.body }),
      201,
    );
  });
  api.get(base + "/:cid", async (req, res) =>
    send(req, res, await service.getConfiguration(params(req))),
  );
  api.put(base + "/:cid", async (req, res) => {
    const p = params(req);
    fields(req.body, ["payload", "expectedVersion"]);
    send(req, res, await service.replaceDraft({ ...p, ...req.body }));
  });
  for (const [suffix, method, allowed] of [
    ["graph-plan", "graphPlan", ["expectedVersion", "payload"]],
    [
      "validate",
      "validateConfiguration",
      ["expectedVersion", "sources", "targetIds"],
    ],
    ["preview", "previewRouting", ["expectedVersion", "sources", "targetIds"]],
    ["freeze", "freezeStructure", ["expectedVersion"]],
  ]) {
    api.post(base + "/:cid/" + suffix, async (req, res) => {
      const p = params(req);
      fields(req.body, allowed);
      send(req, res, await service[method]({ ...p, ...req.body }));
    });
  }
  api.get("/tournaments/:tid/stages", async (req, res) => {
    visible(db, req, req.params.tid);
    const state = await store.read(req.params.tid);
    const snapshot = [...state.snapshots.values()]
      .filter(
        (s) =>
          !req.query.configurationId ||
          s.configurationId === req.query.configurationId,
      )
      .sort(
        (a, b) =>
          b.frozenAt.localeCompare(a.frozenAt) ||
          b.snapshotId.localeCompare(a.snapshotId),
      )[0];
    if (req.query.configurationId && !snapshot)
      reject(404, "NOT_FOUND", "未找到此赛事的冻结配置。");
    if (!snapshot)
      return send(req, res, {
        availability: "no-frozen-configuration",
        items: [],
      });
    send(req, res, {
      availability: "available",
      configurationId: snapshot.configurationId,
      version: snapshot.version,
      frozenAt: snapshot.frozenAt,
      runtimeReady: snapshot.runtimeReady,
      ...(snapshot.structure.structureVersion === "structure-v2"
        ? { structureVersion: "structure-v2" }
        : {}),
      items: snapshot.structure.stages.map((s) => ({
        id: s.id,
        order: s.order,
        capacity: s.capacity,
        formatIntent: s.formatIntent,
        ...(snapshot.structure.structureVersion === "structure-v2"
          ? {
              name: s.name,
              format: s.format,
              ruleVersion: s.ruleVersion,
              isRoot: !snapshot.structure.routes.some(
                (r) => r.target.stageId === s.id,
              ),
              inputs: snapshot.plan.units
                .filter((u) => u.stageId === s.id)
                .map((u) => ({ groupId: u.groupId, ports: u.inputs })),
            }
          : {}),
        groups: s.groups.map((g) => ({ id: g.id, capacity: g.capacity })),
      })),
    });
  });
  api.get("/tournaments/:tid/entry-configurations", async (req, res) => {
    visible(db, req, req.params.tid);
    require("../operations/state").requirePermission(
      db,
      req,
      req.params.tid,
      "registration.review",
    );
    const state = await store.read(req.params.tid);
    send(req, res, {
      items: [...state.configurations.values()]
        .filter((c) => c.snapshot)
        .sort(
          (a, b) =>
            b.snapshot.frozenAt.localeCompare(a.snapshot.frozenAt) ||
            b.id.localeCompare(a.id),
        )
        .map((c) => ({
          id: c.id,
          version: c.version,
          structureVersion: c.structureVersion,
          label: c.stages.map((s) => s.name ?? "阶段" + s.order).join(" → "),
          frozenAt: c.snapshot.frozenAt,
        })),
    });
  });
}
module.exports = { mountConfiguration };
