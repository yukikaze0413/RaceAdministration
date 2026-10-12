"use strict";
const {
  previewRouting,
} = require("../../tournament-configuration/domain/routing");
const { createUnit } = require("./runtime");
const { reject } = require("../http/errors");
function progress(runtime, rules) {
  if (runtime.version === "runtime-rules-v2")
    return require("./runtime-v2").progressV2(runtime);
  runtime.blocked = [];
  const sources = {
    roster: runtime.roster.map(({ entrantId, initialSeed, exitState }) => ({
      entrantId,
      initialSeed,
      exitState,
    })),
    sourceSnapshots: runtime.units.map((u) => ({
      sourceId: u.id,
      version: u.rounds.filter((r) => r.confirmed).length || 1,
      completed: u.status === "completed",
      rankingProfileId: u.format + "-v1",
      recordProfileId: "match-record-v1",
      entries: u.standings.map(
        ({ entrantId, rank, wins, losses, draws, points }) => ({
          entrantId,
          rank,
          wins,
          losses,
          draws,
          points,
        }),
      ),
    })),
  };
  for (const stage of [...runtime.structure.stages].sort(
    (a, b) => a.order - b.order,
  )) {
    if (runtime.units.some((u) => u.stageId === stage.id)) continue;
    const report = previewRouting(runtime.structure, sources, "runtime", [
      stage.id,
    ]);
    if (!report.previewReady) {
      runtime.blocked.push({
        stageId: stage.id,
        diagnostics: report.diagnostics.filter((d) => d.severity === "error"),
      });
      continue;
    }
    const pending = [];
    for (const group of stage.groups.length ? stage.groups : [null]) {
      const allocations = report.allocations.filter(
        (a) =>
          a.target.stageId === stage.id &&
          (a.target.groupId ?? null) === (group?.id ?? null),
      );
      if (!allocations.length) {
        runtime.blocked.push({
          stageId: stage.id,
          diagnostics: [{ reason: "目标输入为空，请检查晋级名额。" }],
        });
        break;
      }
      const kinds = new Set(allocations.map((a) => a.positionKind));
      if (kinds.size !== 1)
        reject(422, "PLACEMENT_MIXED", "同一运行单位不能混用种子与绝对席位。");
      const entries = allocations.map((a) => ({
        entrantId: a.entrantId,
        position: a.value,
      }));
      const rule = rules[stage.id] ?? {
        bestOf: 3,
        allowDraw: false,
        allowPlayerDoubleLoss: false,
      };
      pending.push(createUnit(stage, group, entries, rule, [...kinds][0]));
    }
    if (pending.length === (stage.groups.length || 1))
      runtime.units.push(...pending);
  }
  const total = runtime.structure.stages.reduce(
    (n, s) => n + (s.groups.length || 1),
    0,
  );
  runtime.status =
    runtime.units.length === total &&
    runtime.units.every((u) => u.status === "completed")
      ? "completed"
      : "running";
}
module.exports = { progress };
