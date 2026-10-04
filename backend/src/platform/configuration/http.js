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
function mountConfiguration(api, { db, send }) {
  const store = createSqliteStore(db),
    service = createService({
      store,
      authorize: ({ actorId }, tid) => {
        const row = db
          .prepare("SELECT ownerId FROM tournaments WHERE id=?")
          .get(tid);
        return row?.ownerId === actorId;
      },
    });
  api.get("/templates", (req, res) => {
    loginRequired(req);
    send(req, res, listTemplates());
  });
  const base = "/tournaments/:tid/configurations";
  function params(req) {
    visible(db, req, req.params.tid, true);
    const key = req.get("Idempotency-Key");
    if (key && key.length > 200) reject(422, "INVALID_INPUT", "请求键过长。");
    return {
      tournamentId: req.params.tid,
      id: req.params.cid,
      trustedContext: { actorId: req.user.id },
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
    const snapshot = [...state.snapshots.values()].sort(
      (a, b) =>
        b.frozenAt.localeCompare(a.frozenAt) ||
        b.snapshotId.localeCompare(a.snapshotId),
    )[0];
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
      runtimeReady: false,
      items: snapshot.structure.stages.map((s) => ({
        id: s.id,
        order: s.order,
        capacity: s.capacity,
        formatIntent: s.formatIntent,
        groups: s.groups.map((g) => ({ id: g.id, capacity: g.capacity })),
      })),
    });
  });
}
module.exports = { mountConfiguration };
