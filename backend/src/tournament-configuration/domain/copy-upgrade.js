"use strict";
const { randomUUID } = require("node:crypto");
const { parseStructure, fail } = require("./structure");
const { formatCatalog } = require("./formats/registry");
function copyUpgrade(source, tournamentId) {
  const mapping = Object.fromEntries(
      ["stages", "groups", "pools", "routes"].map((key) => [
        key,
        Object.create(null),
      ]),
    ),
    entryGroups = Object.create(null),
    warnings = [];
  for (const s of source.stages) {
    mapping.stages[s.id] = randomUUID();
    for (const g of s.groups) mapping.groups[g.id] = randomUUID();
    if (!s.groups.length) entryGroups[s.id] = randomUUID();
  }
  for (const p of source.pools) mapping.pools[p.id] = randomUUID();
  for (const r of source.routes) mapping.routes[r.id] = randomUUID();
  function identity(id) {
    return (
      mapping.groups[id] ??
      entryGroups[id] ??
      mapping.stages[id] ??
      mapping.pools[id] ??
      mapping.routes[id]
    );
  }
  function sort(value) {
    return value?.map((s) => ({
      ...s,
      ...(s.sources
        ? {
            sources: s.sources.map((id) => {
              const mapped = identity(id);
              if (!mapped) fail("/sort/sources", "无法映射旧来源标识", id);
              return mapped;
            }),
          }
        : {}),
    }));
  }
  function reference(ref) {
    return ref.poolId
      ? { poolId: mapping.pools[ref.poolId] }
      : {
          stageId: mapping.stages[ref.stageId],
          ...(ref.groupId
            ? { groupId: mapping.groups[ref.groupId] }
            : entryGroups[ref.stageId]
              ? { groupId: entryGroups[ref.stageId] }
              : {}),
        };
  }
  const stages = source.stages.map((s, i) => {
    const path = "/stages/" + i,
      definition = formatCatalog().formats.find(
        (d) => d.format === s.formatIntent,
      );
    if (!definition)
      fail(
        path + "/formatIntent",
        "旧阶段没有可明确对应的v2规则，请在独立配置中选择规则",
        s.id,
      );
    const groupSize = s.groups.length ? s.groups[0].capacity : s.capacity;
    if (!Number.isSafeInteger(groupSize) || groupSize < 1)
      fail(path + "/capacity", "复制前须保存明确的组人数", s.id);
    if (s.groups.some((g) => g.capacity !== groupSize))
      fail(
        path + "/groups",
        "旧阶段含不同人数的小组，不能自动复制为同构重复组",
        s.id,
      );
    if (s.groups.length && s.capacity !== groupSize * s.groups.length)
      fail(path + "/capacity", "旧阶段容量与组容量不一致", s.id);
    warnings.push({
      code: "RULE_DEFAULTS_ADOPTED",
      stageId: mapping.stages[s.id],
      reason: "新增规则参数使用v2默认集，旧运行规则不追溯修改。",
    });
    return {
      id: mapping.stages[s.id],
      name: "阶段" + (s.order ?? i + 1),
      ...(s.order !== undefined ? { order: s.order } : {}),
      format: definition.format,
      ruleVersion: definition.ruleVersion,
      ...structuredClone(definition.defaults),
      groupSize,
      groupCount: Math.max(1, s.groups.length),
      groups: s.groups.length
        ? s.groups.map((g) => ({
            id: mapping.groups[g.id],
            stageId: mapping.stages[s.id],
          }))
        : [{ id: entryGroups[s.id], stageId: mapping.stages[s.id] }],
    };
  });
  const payload = parseStructure(
    {
      entrantKind: source.entrantKind,
      structureVersion: "structure-v2",
      routingVersion: "routing-v2",
      ...(source.templateOrigin
        ? { templateOrigin: source.templateOrigin }
        : {}),
      stages,
      pools: source.pools.map((p) => ({
        ...p,
        id: mapping.pools[p.id],
        ...(p.sort ? { sort: sort(p.sort) } : {}),
      })),
      routes: source.routes.map((r) => ({
        ...r,
        id: mapping.routes[r.id],
        source: reference(r.source),
        target: reference(r.target),
        ...(r.sort ? { sort: sort(r.sort) } : {}),
      })),
    },
    tournamentId,
  );
  const report = require("./validation").validateStructure(
    payload,
    tournamentId,
  );
  warnings.push(
    ...report.diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => ({
        code: d.code,
        stageId: d.objectId,
        path: d.path,
        reason: d.reason,
      })),
  );
  return {
    payload,
    origin: {
      configurationId: source.id,
      version: source.version,
      mapping,
      syntheticGroups: entryGroups,
      warnings,
    },
  };
}
module.exports = { copyUpgrade };
