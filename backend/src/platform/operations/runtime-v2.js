"use strict";
const { reject } = require("../http/errors");
const { digest } = require("../../tournament-configuration/domain/canonical");
const {
  validateStructure,
} = require("../../tournament-configuration/domain/validation");
const {
  previewRouting,
} = require("../../tournament-configuration/domain/routing");
const { rosterEntries } = require("./entry-ref");
const { createStaticUnit } = require("./format-runners/static");
const {
  runtimeSupported,
} = require("../../tournament-configuration/domain/formats/support");
function channel(plan, port) {
  return plan.format === "double-elimination" ? port : plan.inputs[0].channel;
}
function directEntries(runtime, unit) {
  return runtime.roster
    .filter((r) => r.entryRef.groupId === unit.groupId)
    .map((r) => ({
      entrantId: r.entrantId,
      initialSeed: r.initialSeed,
      channel: channel(unit, r.entryRef.port),
      position: r.entryRef.position,
      positionKind: r.entryRef.positionKind,
    }));
}
function assertInventory(runtime) {
  for (const unit of runtime.plan.units) {
    const stage = runtime.structure.stages.find((s) => s.id === unit.stageId),
      entries = directEntries(runtime, unit);
    for (const route of runtime.structure.routes.filter(
      (r) => r.target.groupId === unit.groupId,
    )) {
      const port =
        require("../../tournament-configuration/domain/routing-v2").targetPort(
          route.target,
          stage,
          route.placement,
        );
      entries.push(
        ...route.placement.positions.map((position) => ({
          channel: channel(unit, port),
          position,
          positionKind: route.placement.kind,
        })),
      );
    }
    for (const input of unit.inputs) {
      const selected = entries.filter((e) => e.channel === input.channel);
      if (
        selected.length !== input.capacity ||
        new Set(selected.map((e) => e.position)).size !== input.capacity ||
        new Set(selected.map((e) => e.positionKind)).size !== 1 ||
        selected.some((e) => e.position < 1 || e.position > input.capacity)
      )
        reject(
          422,
          "ROSTER_INVALID",
          "每个冻结入口必须由唯一的直邀或晋级预留席位完整填满。",
        );
    }
  }
}
function startV2(configuration, approved) {
  const { snapshot } = configuration;
  if (
    !snapshot?.plan ||
    snapshot.plan.configurationId !== configuration.id ||
    digest(snapshot.structure) !== snapshot.digest ||
    digest(snapshot.plan) !== snapshot.planDigest
  )
    reject(409, "CONFIG_PLAN_INVALID", "冻结计划摘要或绑定无效。");
  const report = validateStructure(
    snapshot.structure,
    configuration.tournamentId,
  );
  if (!report.structureValid)
    reject(422, "CONFIG_INVALID", "冻结结构复验失败。", {
      diagnostics: report.diagnostics,
    });
  if (snapshot.structure.stages.some((s) => !runtimeSupported(s.ruleVersion)))
    reject(501, "RUN_NOT_SUPPORTED", "此配置仍包含未接入并验证的运行规则。");
  const runtime = {
    status: "running",
    version: "runtime-rules-v2",
    tournamentId: configuration.tournamentId,
    configurationId: configuration.id,
    configurationVersion: snapshot.version,
    structureDigest: snapshot.digest,
    planDigest: snapshot.planDigest,
    structure: structuredClone(snapshot.structure),
    plan: structuredClone(snapshot.plan),
    roster: rosterEntries(
      snapshot.structure,
      configuration.id,
      approved,
      configuration.tournamentId,
    ),
    units: [],
    blocked: [],
    waiting: [],
  };
  assertInventory(runtime);
  progressV2(runtime);
  if (!runtime.units.length)
    reject(422, "ROSTER_INVALID", "没有可完整启动的初始阶段。");
  return runtime;
}
function runtimeSources(runtime) {
  return {
    roster: runtime.roster.map(({ entrantId, initialSeed, exitState }) => ({
      entrantId,
      initialSeed,
      exitState,
    })),
    sourceSnapshots: runtime.units.map((u) => ({
      sourceId: u.id,
      version: u.rounds.filter((r) => r.confirmed).length || 1,
      completed: u.status === "completed",
      rankingProfileId: [
        "fixed-swiss",
        "threshold-swiss",
        "round-robin",
        "double-round-robin",
      ].includes(u.format)
        ? u.ruleVersion + "-" + digest(u.plan.parameters)
        : u.ruleVersion,
      recordProfileId:
        u.ruleVersion +
        "-record" +
        ([
          "fixed-swiss",
          "threshold-swiss",
          "round-robin",
          "double-round-robin",
        ].includes(u.format)
          ? "-" + digest(u.plan.parameters)
          : ""),
      entries: u.standings.map((r) => ({
        entrantId: r.entrantId,
        ...(r.rank === undefined ? {} : { rank: r.rank }),
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        points: r.points,
        ...(r.qualification ? { qualification: r.qualification } : {}),
      })),
    })),
  };
}
function progressV2(runtime) {
  runtime.blocked = [];
  runtime.waiting = [];
  const sources = runtimeSources(runtime),
    ready = [];
  for (const stage of [...runtime.structure.stages].sort(
    (a, b) => a.order - b.order,
  )) {
    if (runtime.units.some((u) => u.stageId === stage.id)) continue;
    const report = previewRouting(
      runtime.structure,
      sources,
      runtime.tournamentId,
      [stage.id],
    );
    if (!report.previewReady) {
      const errors = report.diagnostics.filter((d) => d.severity === "error");
      if (errors.length && errors.every((d) => d.code === "SOURCE_NOT_READY"))
        runtime.waiting.push({
          stageId: stage.id,
          reason: "等待全部上游来源完成",
          requiredSourceIds: errors.map((d) => d.details.sourceId),
        });
      else runtime.blocked.push({ stageId: stage.id, diagnostics: errors });
    } else ready.push(stage);
  }
  if (ready.length) {
    const report = previewRouting(
      runtime.structure,
      sources,
      runtime.tournamentId,
      ready.map((s) => s.id),
    );
    if (!report.previewReady)
      runtime.blocked.push(
        ...ready.map((s) => ({
          stageId: s.id,
          diagnostics: report.diagnostics.filter((d) => d.severity === "error"),
        })),
      );
    else {
      const candidate = [],
        ids = new Set(
          runtime.units
            .filter((u) => u.status !== "completed")
            .flatMap((u) => u.entrants),
        );
      let failure;
      for (const stage of ready)
        for (const group of stage.groups) {
          const plan = runtime.plan.units.find((u) => u.groupId === group.id),
            entries = directEntries(runtime, plan);
          const allocated = report.allocations
            .filter((a) => a.target.groupId === group.id)
            .map((a) => ({
              entrantId: a.entrantId,
              initialSeed: a.initialSeed,
              channel: channel(plan, a.target.port ?? a.positionKind),
              position: a.value,
              positionKind: a.positionKind,
            }));
          entries.push(...allocated);
          if (entries.some((e) => ids.has(e.entrantId))) {
            failure = {
              code: "DUPLICATE_ENTRANT",
              reason: "同一身份已在另一个活动目标中",
            };
            break;
          }
          entries.forEach((e) => ids.add(e.entrantId));
          try {
            candidate.push(
              ["fixed-swiss", "threshold-swiss"].includes(plan.format)
                ? require("./format-runners/swiss").createSwissUnit(
                    plan,
                    entries,
                  )
                : ["round-robin", "double-round-robin"].includes(plan.format)
                  ? require("./format-runners/round-robin").createRoundRobin(
                      plan,
                      entries,
                    )
                  : createStaticUnit(plan, entries),
            );
          } catch (e) {
            if (!e.status) throw e;
            failure = { code: e.code, reason: e.message };
            break;
          }
        }
      if (failure)
        runtime.blocked.push(
          ...ready.map((s) => ({ stageId: s.id, diagnostics: [failure] })),
        );
      else runtime.units.push(...candidate);
    }
  }
  runtime.status =
    runtime.units.length === runtime.plan.units.length &&
    runtime.units.every((u) => u.status === "completed")
      ? "completed"
      : "running";
}
module.exports = { startV2, progressV2, runtimeSources, assertInventory };
