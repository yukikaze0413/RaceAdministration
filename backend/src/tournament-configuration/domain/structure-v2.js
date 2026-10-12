"use strict";
const { definition } = require("./formats/registry");
function check(value, schema, path, fail) {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail(path, "必须为对象");
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key))
        fail(path + "/" + key, "未知字段");
      check(value[key], schema.properties[key], path + "/" + key, fail);
    }
  } else if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (schema.minItems ?? 0) ||
      (schema.uniqueItems && new Set(value).size !== value.length)
    )
      fail(path, "数组无效或重复");
    value.forEach((v, i) => check(v, schema.items, path + "/" + i, fail));
  } else if (
    (schema.type === "integer"
      ? !Number.isSafeInteger(value)
      : typeof value !== schema.type) ||
    (schema.enum && !schema.enum.includes(value)) ||
    (schema.minimum !== undefined && value < schema.minimum) ||
    (schema.maximum !== undefined && value > schema.maximum)
  )
    fail(path, "参数类型或允许范围无效");
}
function parseStructureV2(payload, tournamentId) {
  const {
    object,
    integer,
    text,
    fail,
    array,
    parseStructure,
  } = require("./structure");
  if (!["individual", "reference-unit"].includes(payload.entrantKind))
    fail("/entrantKind", "未知参赛单位类型");
  if (payload.routingVersion !== "routing-v2")
    fail("/routingVersion", "结构与路由版本必须匹配");
  array(payload.stages, "/stages");
  const result = structuredClone(payload);
  result.stages = result.stages.map((stage, i) => {
    const path = "/stages/" + i;
    object(
      stage,
      [
        "id",
        "name",
        "tournamentId",
        "order",
        "capacity",
        "format",
        "ruleVersion",
        "groupSize",
        "groupCount",
        "qualifyCount",
        "parameters",
        "groups",
      ],
      path,
    );
    text(stage.name, path + "/name");
    const rule = definition(stage.ruleVersion);
    if (!rule) fail(path + "/ruleVersion", "未知规则版本", stage.id);
    if (stage.format !== rule.format)
      fail(path + "/format", "赛制与规则版本不匹配", stage.id);
    const next = { ...stage };
    for (const key of ["groupSize", "groupCount", "qualifyCount"]) {
      next[key] = stage[key] === undefined ? rule.defaults[key] : stage[key];
      integer(next[key], path + "/" + key, false);
    }
    const parameters = stage.parameters === undefined ? {} : stage.parameters;
    object(
      parameters,
      Object.keys(rule.parameterSchema.properties),
      path + "/parameters",
    );
    next.parameters = { ...rule.defaults.parameters, ...parameters };
    check(next.parameters, rule.parameterSchema, path + "/parameters", fail);
    const lower = next.parameters.lowerEntryMode;
    const proposedCapacity =
      next.groupSize +
      (lower === "same"
        ? next.groupSize
        : lower === "half"
          ? next.groupSize / 2
          : 0);
    const groupCapacity = Number.isSafeInteger(proposedCapacity)
      ? proposedCapacity
      : null;
    next.capacity =
      groupCapacity === null ? null : groupCapacity * next.groupCount;
    if (
      proposedCapacity * next.groupCount > 64 ||
      next.groupSize > 64 ||
      next.groupCount > 64
    )
      fail(path + "/groupCount", "阶段总输入不能超过64人", stage.id);
    if (stage.capacity !== undefined && stage.capacity !== next.capacity)
      fail(path + "/capacity", "容量必须为派生值", stage.id);
    array(stage.groups, path + "/groups");
    next.groups = stage.groups.map((g, j) => {
      object(
        g,
        ["id", "tournamentId", "stageId", "capacity"],
        path + "/groups/" + j,
      );
      if (g.capacity !== undefined && g.capacity !== groupCapacity)
        fail(path + "/groups/" + j + "/capacity", "组容量必须为派生值", g.id);
      return { ...g, capacity: groupCapacity };
    });
    return next;
  });
  // Reuse v1's strict ID/ownership/reference parser without rewriting stored v1 data.
  array(result.routes, "/routes");
  require("./routing-v2").parsePorts(result);
  parseStructure(
    {
      ...result,
      entrantKind: "individual",
      structureVersion: "structure-v1",
      routingVersion: "routing-v1",
      routes: require("./routing-v2").legacyRoutes(result.routes),
      stages: result.stages.map((s) => ({
        id: s.id,
        ...(s.tournamentId !== undefined
          ? { tournamentId: s.tournamentId }
          : {}),
        order: s.order,
        capacity: s.capacity,
        formatIntent: "single-elimination",
        groups: s.groups,
      })),
    },
    tournamentId,
  );
  const roots = result.stages.filter(
    (s) => !result.routes.some((r) => r.target.stageId === s.id),
  );
  if (roots.reduce((total, s) => total + s.capacity, 0) > 64)
    fail("/stages", "所有独立入口总人数不能超过64");
  const routingIssues = require("./routing-v2").portIssues(result);
  if (routingIssues.some((d) => d.severity === "error"))
    throw new (require("./structure").ConfigurationError)(
      "CONFIG_INVALID",
      "具名路由或名额消费无效",
      routingIssues,
    );
  return result;
}
module.exports = { parseStructureV2 };
