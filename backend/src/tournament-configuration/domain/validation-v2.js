"use strict";
const { runtimeSupported } = require("./formats/support");
const power = (n) => Number.isSafeInteger(n) && n >= 1 && (n & (n - 1)) === 0;
function parameterIssues(s, path) {
  const issues = [],
    n = s.groupSize,
    q = s.qualifyCount,
    p = s.parameters;
  const bad = (field, reason) =>
    issues.push({ field: path + "/" + field, reason });
  if (n < 2 || n > 64) bad("groupSize", "每组人数必须在2–64");
  if (s.groupCount > 64) bad("groupCount", "组数必须在1–64");
  if (s.groups.length !== s.groupCount)
    bad("groups", "组实体数量必须与groupCount一致");
  if (q > n) bad("qualifyCount", "晋级人数不能超过每组人数");
  if (!p.seeding?.kind || !p.seeding?.seedTableVersion)
    bad("parameters/seeding", "必须完整指定种子类型与表版本");
  if (p.points) {
    if (
      ["win", "draw", "loss", "doubleLoss"].some(
        (k) => p.points[k] === undefined,
      ) ||
      !(p.points.win > p.points.draw && p.points.draw >= p.points.loss)
    )
      bad("parameters/points", "积分必须完整且胜>平≥负");
  }
  if (p.tiebreakers) {
    const primary = s.format === "threshold-swiss" ? "record" : "points";
    if (p.tiebreakers[0] !== primary)
      bad("parameters/tiebreakers", "首排序字段必须为" + primary);
    if (
      s.ruleVersion !== "ti2026-observed-candidate-v1" &&
      !["initialSeed", "manual-with-reason"].includes(p.tiebreakers.at(-1))
    )
      bad("parameters/tiebreakers", "末项必须为初始种子或留因裁定");
  }
  if (s.ruleVersion === "single-cut-v2") {
    if (
      q > n / 2 ||
      !power(n / q) ||
      n / q < 2 ||
      (p.bracketMode === "complete" && (!power(n) || !power(q)))
    )
      bad("qualifyCount", "N/Q必须为至少2的二次幂；完整模式N/Q分别为二次幂");
    if (p.thirdPlace && (q !== 1 || n < 4))
      bad("parameters/thirdPlace", "季军战仅允许N≥4且Q=1");
  }
  if (s.ruleVersion === "gsl-classic-v1" && (n !== 4 || q !== 2))
    bad("groupSize", "GSL固定4人2晋级");
  if (s.format === "double-elimination") {
    if (!power(n)) bad("groupSize", "双败胜者输入必须为二次幂");
    if (![1, 2, 3].includes(q) || (q === 3 && n < 4))
      bad("qualifyCount", "双败仅允许1/2/3晋级，3晋级至少4胜者输入");
    if (p.finalReset && q !== 1)
      bad("parameters/finalReset", "重置决赛仅用于1晋级");
  }
  if (s.ruleVersion === "swiss-fixed-v1" && p.roundCount > (n % 2 ? n : n - 1))
    bad("parameters/roundCount", "轮数超过不重赛允许上限");
  if (s.ruleVersion === "major-cologne-2026-v1") {
    if (n !== 16 || q !== 8) bad("groupSize", "Major每组固定16队、8队晋级");
    if (
      JSON.stringify(p.tiebreakers) !==
      JSON.stringify(["record", "DS-wl-v1", "initialSeed"])
    )
      bad(
        "parameters/tiebreakers",
        "Major排序固定为战绩、DS、当前阶段初始种子",
      );
    if (p.overrides?.advancement !== 3 || p.overrides?.elimination !== 3)
      bad("parameters/overrides", "Major晋级和淘汰比赛固定BO3");
  }
  if (s.ruleVersion === "ti2026-observed-candidate-v1") {
    if (n !== 16 || q !== 8)
      bad("groupSize", "TI候选计划每组固定16队、8队晋级");
    if (
      JSON.stringify(p.tiebreakers) !==
      JSON.stringify(
        require("./formats/registry").definition(s.ruleVersion).defaults
          .parameters.tiebreakers,
      )
    )
      bad(
        "parameters/tiebreakers",
        "TI候选排序字段与顺序固定，统计公式仍待官方验证",
      );
  }
  return issues;
}
function validateStructureV2(c, tournamentId) {
  const { validateStructure, stableDiagnostics } = require("./validation");
  const { diagnostic } = require("./structure");
  const legacy = {
    ...c,
    entrantKind: "individual",
    structureVersion: "structure-v1",
    routingVersion: "routing-v1",
    routes: require("./routing-v2").legacyRoutes(c.routes),
    stages: c.stages.map((s) => ({
      id: s.id,
      ...(s.tournamentId !== undefined ? { tournamentId: s.tournamentId } : {}),
      order: s.order,
      capacity: s.capacity,
      formatIntent: "single-elimination",
      groups: s.groups,
    })),
  };
  const report = validateStructure(legacy, tournamentId);
  report.diagnostics = report.diagnostics.filter(
    (d) =>
      ![
        "FORMAT_RUNTIME_UNAVAILABLE",
        "SELECTOR_OVERLAP",
        "SELECTOR_INTERSECTION_UNKNOWN",
        "POSITION_CONFLICT",
        "POSITION_INVALID",
        "PLACEMENT_KIND_CONFLICT",
        "CAPACITY_EXCEEDED",
      ].includes(d.code) &&
      !(
        d.code === "SELECTOR_INVALID" &&
        c.routes.find((r) => r.id === d.objectId)?.source.poolId
      ),
  );
  report.diagnostics.push(...require("./routing-v2").portIssues(c));
  c.stages.forEach((s, i) => {
    for (const issue of parameterIssues(s, "/stages/" + i))
      report.diagnostics.push(
        diagnostic(
          "FORMAT_PARAMETERS_INVALID",
          issue.field,
          issue.reason,
          s.id,
        ),
      );
    if (!runtimeSupported(s.ruleVersion))
      report.diagnostics.push(
        diagnostic(
          "FORMAT_RUNTIME_UNAVAILABLE",
          "/stages/" + i + "/ruleVersion",
          "此规则运行器尚未实现并验证",
          s.id,
          "info",
          { ruleVersion: s.ruleVersion },
        ),
      );
  });
  report.structureValid = !report.diagnostics.some(
    (d) => d.severity === "error",
  );
  report.runtimeReady =
    report.structureValid &&
    c.stages.length > 0 &&
    c.stages.every((s) => runtimeSupported(s.ruleVersion));
  report.diagnostics = stableDiagnostics(report.diagnostics);
  return report;
}
module.exports = { parameterIssues, validateStructureV2 };
