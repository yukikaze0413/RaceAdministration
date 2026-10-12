"use strict";
const { randomUUID } = require("node:crypto");
const { parseStructure, ConfigurationError } = require("../domain/structure");
const { digest } = require("../domain/canonical");
const { instantiate } = require("../domain/templates");
const { validateStructure } = require("../domain/validation");
const { previewRouting } = require("../domain/routing");
const { createMemoryStore } = require("../adapters/memory-store");
function structureOf(c) {
  const {
    id,
    tournamentId,
    version,
    state,
    snapshot,
    upgradeOrigin,
    ...payload
  } = c;
  return payload;
}
function createService({
  authorize,
  store = createMemoryStore(),
  allowReferenceUnits = false,
} = {}) {
  function parse(payload, tournamentId) {
    if (payload?.entrantKind === "reference-unit" && !allowReferenceUnits)
      throw new ConfigurationError(
        "INVALID_INPUT",
        "参考参赛单位只能用于独立演示空间",
      );
    return parseStructure(payload, tournamentId);
  }
  async function permission(p, action) {
    if (
      !p ||
      typeof p.tournamentId !== "string" ||
      !p.tournamentId.trim() ||
      typeof p.trustedContext?.actorId !== "string" ||
      !p.trustedContext.actorId.trim() ||
      !authorize ||
      (await authorize(p.trustedContext, p.tournamentId, action)) !== true
    )
      throw new ConfigurationError("FORBIDDEN", "没有本赛事操作权限");
  }
  function find(state, p) {
    const c = state.configurations.get(p.id);
    if (!c) throw new ConfigurationError("NOT_FOUND", "未找到本赛事配置");
    return c;
  }
  function version(c, p) {
    if (p.expectedVersion !== c.version)
      throw new ConfigurationError("VERSION_CONFLICT", "配置版本已变化");
  }
  async function write(operation, p, build) {
    await permission(p, "configure");
    if (typeof p.requestKey !== "string" || !p.requestKey.trim())
      throw new ConfigurationError("INVALID_INPUT", "需要请求键");
    const fingerprint = digest({
      operation,
      id: p.id ?? null,
      expectedVersion: p.expectedVersion ?? null,
      payload: p.payload ?? null,
    });
    const key = JSON.stringify([p.trustedContext.actorId, p.requestKey]);
    return store.transaction(
      p.tournamentId,
      (state, dependencies, canWrite) => {
        const prior = state.requests.get(key);
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new ConfigurationError(
              "IDEMPOTENCY_CONFLICT",
              "请求键已用于不同请求",
            );
          if (
            operation === "applyStageChange" &&
            prior.result.impact?.affectedRegistrationIds.length &&
            !canWrite?.("registration.review")
          )
            throw new ConfigurationError(
              "FORBIDDEN",
              "清理报名分配还需要当前报名审批权限",
            );
          return prior.result;
        }
        const result = build(state, dependencies, canWrite);
        state.requests.set(key, {
          fingerprint,
          result: structuredClone(result),
        });
        return result;
      },
      p.trustedContext,
    );
  }
  function create(state, p, payload) {
    const c = {
      ...payload,
      id: randomUUID(),
      tournamentId: p.tournamentId,
      version: 1,
      state: "draft",
    };
    state.configurations.set(c.id, c);
    return c;
  }
  return {
    async createDraft(p) {
      return write("createDraft", p, (state) =>
        create(state, p, parse(p.payload, p.tournamentId)),
      );
    },
    async copyUpgrade(p) {
      return write("copyUpgrade", p, (state, dependencies) => {
        const original = find(state, p);
        version(original, p);
        if (original.state !== "draft")
          throw new ConfigurationError(
            "STRUCTURE_FROZEN",
            "只允许复制旧草稿，冻结快照和运行版本不能升级",
          );
        if (original.structureVersion !== "structure-v1")
          throw new ConfigurationError("INVALID_INPUT", "仅v1草稿需要复制升级");
        if (dependencies?.runtime?.configurationId === original.id)
          throw new ConfigurationError(
            "RUNTIME_LOCKED",
            "运行配置不能复制升级",
          );
        const { payload, origin } =
          require("../domain/copy-upgrade").copyUpgrade(
            original,
            p.tournamentId,
          );
        const result = create(state, p, payload);
        result.upgradeOrigin = origin;
        return result;
      });
    },
    async addStage(p) {
      return write("addStage", p, (state) => {
        const c = find(state, p);
        version(c, p);
        if (c.state !== "draft")
          throw new ConfigurationError(
            "STRUCTURE_FROZEN",
            "结构不可修改或解冻",
          );
        if (c.structureVersion !== "structure-v2")
          throw new ConfigurationError(
            "CONFIG_VERSION_UPGRADE_REQUIRED",
            "重复组生成要求v2配置",
          );
        const payload = require("../domain/stage-groups").addStage(
          structureOf(c),
          p.tournamentId,
          p.payload,
          p.requestKey,
        );
        const next = {
          ...payload,
          ...(c.upgradeOrigin ? { upgradeOrigin: c.upgradeOrigin } : {}),
          id: c.id,
          tournamentId: c.tournamentId,
          version: c.version + 1,
          state: "draft",
        };
        state.configurations.set(c.id, next);
        return next;
      });
    },
    async planStageChange(p) {
      await permission(p, "view");
      const c = find(await store.read(p.tournamentId), p);
      version(c, p);
      if (c.state !== "draft")
        throw new ConfigurationError("STRUCTURE_FROZEN", "结构不可修改或解冻");
      if (c.structureVersion !== "structure-v2")
        throw new ConfigurationError(
          "CONFIG_VERSION_UPGRADE_REQUIRED",
          "重复组修改要求v2配置",
        );
      const dependencies = store.readDependencies
        ? await store.readDependencies(p.tournamentId)
        : undefined;
      return require("../domain/stage-groups").planChange(
        c,
        p.tournamentId,
        p.payload.stageId,
        p.payload.changes,
        dependencies,
      ).report;
    },
    async applyStageChange(p) {
      return write("applyStageChange", p, (state, dependencies, canWrite) => {
        const c = find(state, p);
        version(c, p);
        if (c.state !== "draft")
          throw new ConfigurationError(
            "STRUCTURE_FROZEN",
            "结构不可修改或解冻",
          );
        if (c.structureVersion !== "structure-v2")
          throw new ConfigurationError(
            "CONFIG_VERSION_UPGRADE_REQUIRED",
            "重复组修改要求v2配置",
          );
        const { structure: payload, report } =
          require("../domain/stage-groups").planChange(
            c,
            p.tournamentId,
            p.payload.stageId,
            p.payload.changes,
            dependencies,
          );
        if (report.blockers.length)
          throw new ConfigurationError(
            report.blockers[0],
            "已锁名单或运行中的比赛不允许受影响的结构变更",
          );
        if (
          (report.requiresConfirmation ||
            Object.hasOwn(p.payload, "confirmed") ||
            Object.hasOwn(p.payload, "confirmationToken")) &&
          (p.payload.confirmed !== true ||
            p.payload.confirmationToken !== report.confirmationToken)
        )
          throw new ConfigurationError(
            "CONFIG_CHANGE_CONFIRMATION_REQUIRED",
            "请先重新读取影响报告并明确确认",
          );
        if (
          report.affectedRegistrationIds.length &&
          !canWrite?.("registration.review")
        )
          throw new ConfigurationError(
            "FORBIDDEN",
            "清理报名分配还需要报名审批权限",
          );
        if (dependencies)
          require("../domain/stage-groups").applyEffects(report, dependencies);
        const next = {
          ...payload,
          ...(c.upgradeOrigin ? { upgradeOrigin: c.upgradeOrigin } : {}),
          id: c.id,
          tournamentId: c.tournamentId,
          version: c.version + 1,
          state: "draft",
        };
        state.configurations.set(c.id, next);
        return { configuration: next, impact: report };
      });
    },
    async instantiateTemplate(p) {
      return write("instantiateTemplate", p, (state) =>
        create(state, p, instantiate(p.payload, p.tournamentId)),
      );
    },
    async getConfiguration(p) {
      await permission(p, "view");
      return structuredClone(find(await store.read(p.tournamentId), p));
    },
    async replaceDraft(p) {
      return write("replaceDraft", p, (state) => {
        const c = find(state, p);
        version(c, p);
        if (c.state !== "draft")
          throw new ConfigurationError(
            "STRUCTURE_FROZEN",
            "结构不可修改或解冻",
          );
        const payload = parse(p.payload, p.tournamentId);
        if (
          payload.structureVersion !== c.structureVersion ||
          payload.routingVersion !== c.routingVersion
        )
          throw new ConfigurationError(
            "CONFIG_VERSION_UPGRADE_REQUIRED",
            "结构版本变更须显式复制为独立配置。",
          );
        if (
          c.structureVersion === "structure-v2" &&
          c.stages.some((old) => {
            const updated = payload.stages.find((s) => s.id === old.id);
            return (
              !updated ||
              require("../domain/stage-groups").isRebuild(old, updated) ||
              old.groups.some((g, i) => updated.groups[i]?.id !== g.id)
            );
          })
        )
          throw new ConfigurationError(
            "CONFIG_CHANGE_CONFIRMATION_REQUIRED",
            "缩组或重建必须先读取影响报告并确认",
          );
        const next = {
          ...payload,
          ...(c.upgradeOrigin ? { upgradeOrigin: c.upgradeOrigin } : {}),
          id: c.id,
          tournamentId: c.tournamentId,
          version: c.version + 1,
          state: "draft",
        };
        state.configurations.set(c.id, next);
        return next;
      });
    },
    async freezeStructure(p) {
      return write("freezeStructure", p, (state) => {
        const c = find(state, p);
        version(c, p);
        if (c.state !== "draft")
          throw new ConfigurationError(
            "STRUCTURE_FROZEN",
            "结构不可修改或解冻",
          );
        const structure = structureOf(c),
          report = validateStructure(structure, c.tournamentId);
        if (!report.structureValid)
          throw new ConfigurationError(
            "CONFIG_INVALID",
            "结构校验失败",
            report.diagnostics,
          );
        const plan =
          structure.structureVersion === "structure-v2"
            ? require("../domain/formats/compile").compile(structure, {
                configurationId: c.id,
                tournamentId: c.tournamentId,
              })
            : null;
        const snapshot = {
          snapshotId: randomUUID(),
          configurationId: c.id,
          frozenFromVersion: c.version,
          version: c.version + 1,
          structure,
          ...(plan ? { plan, planDigest: digest(plan) } : {}),
          diagnostics: report.diagnostics,
          digest: digest(structure),
          frozenAt: new Date().toISOString(),
          frozenBy: p.trustedContext.actorId,
          runtimeReady:
            structure.structureVersion === "structure-v2"
              ? report.runtimeReady
              : false,
          started: false,
        };
        state.snapshots.set(snapshot.snapshotId, snapshot);
        state.configurations.set(c.id, {
          ...c,
          state: "structure-frozen",
          version: c.version + 1,
          snapshot,
        });
        return snapshot;
      });
    },
    async validateConfiguration(p) {
      await permission(p, "view");
      const c = find(await store.read(p.tournamentId), p);
      version(c, p);
      const structure = structureOf(c);
      const report = p.sources
        ? previewRouting(structure, p.sources, c.tournamentId, p.targetIds)
        : validateStructure(structure, c.tournamentId);
      return {
        configurationId: c.id,
        version: c.version,
        ...report,
        ...(structure.structureVersion === "structure-v2" &&
        report.structureValid
          ? {
              plan: require("../domain/formats/compile").compile(structure, {
                configurationId: c.id,
                tournamentId: c.tournamentId,
              }),
            }
          : {}),
      };
    },
    async graphPlan(p) {
      await permission(p, "view");
      const c = find(await store.read(p.tournamentId), p);
      version(c, p);
      const structure =
        p.payload === undefined
          ? structureOf(c)
          : parse(p.payload, c.tournamentId);
      const report = validateStructure(structure, c.tournamentId);
      return {
        configurationId: c.id,
        version: c.version,
        layoutNodeIds: [
          ...require("../domain/graph-nodes").graphNodeIds({
            ...structure,
            id: c.id,
            tournamentId: c.tournamentId,
          }),
        ],
        ...report,
        ...(report.structureValid &&
        structure.structureVersion === "structure-v2"
          ? {
              plan: require("../domain/formats/compile").compile(structure, {
                configurationId: c.id,
                tournamentId: c.tournamentId,
              }),
            }
          : {}),
      };
    },
    async previewRouting(p) {
      await permission(p, "view");
      const c = find(await store.read(p.tournamentId), p);
      version(c, p);
      return {
        configurationId: c.id,
        version: c.version,
        ...previewRouting(
          structureOf(c),
          p.sources,
          c.tournamentId,
          p.targetIds,
        ),
      };
    },
    async requestRuntime(p) {
      await permission(p, "view");
      find(await store.read(p.tournamentId), p);
      throw new ConfigurationError("RUN_NOT_SUPPORTED", "本模块未实现赛制运行");
    },
  };
}
module.exports = { createService };
