"use strict";
const { randomUUID } = require("node:crypto");
const { digest } = require("./canonical");
const { parseStructure, object, fail } = require("./structure");
const { definition } = require("./formats/registry");
function addStage(structure, tournamentId, input, namespace) {
  object(
    input,
    [
      "id",
      "name",
      "order",
      "format",
      "ruleVersion",
      "groupSize",
      "groupCount",
      "qualifyCount",
      "parameters",
    ],
    "/stage",
  );
  const rule = definition(
    input.ruleVersion === undefined ? "single-cut-v2" : input.ruleVersion,
  );
  if (!rule) fail("/stage/ruleVersion", "未知规则版本");
  const id = input.id === undefined ? randomUUID() : input.id,
    count =
      input.groupCount === undefined
        ? rule.defaults.groupCount
        : input.groupCount;
  if (!Number.isSafeInteger(count) || count < 1 || count > 64)
    fail("/stage/groupCount", "组数必须为1–64");
  const stage = {
    ...input,
    id,
    name:
      input.name === undefined
        ? "阶段" + (structure.stages.length + 1)
        : input.name,
    order:
      input.order ??
      Math.max(0, ...structure.stages.map((s) => s.order ?? 0)) + 1,
    format: input.format === undefined ? rule.format : input.format,
    ruleVersion: rule.ruleVersion,
    groups: Array.from({ length: count }, (_, i) => ({
      id: "grp-" + digest({ namespace, stageId: id, index: i }).slice(0, 32),
      stageId: id,
    })),
  };
  return parseStructure(
    { ...structure, stages: [...structure.stages, stage] },
    tournamentId,
  );
}

function changeStage(structure, tournamentId, stageId, changes, namespace) {
  const { ConfigurationError } = require("./structure");
  object(
    changes,
    [
      "format",
      "ruleVersion",
      "groupSize",
      "groupCount",
      "qualifyCount",
      "parameters",
    ],
    "/changes",
  );
  const old = structure.stages.find((s) => s.id === stageId);
  if (!old) throw new ConfigurationError("NOT_FOUND", "未找到阶段");
  const rule = definition(
    changes.ruleVersion === undefined ? old.ruleVersion : changes.ruleVersion,
  );
  if (!rule) fail("/changes/ruleVersion", "未知规则版本");
  const changingRule = rule.ruleVersion !== old.ruleVersion;
  const next = {
    ...old,
    ...changes,
    format:
      changes.format === undefined
        ? changingRule
          ? rule.format
          : old.format
        : changes.format,
    ruleVersion: rule.ruleVersion,
  };
  for (const key of ["groupSize", "groupCount", "qualifyCount", "parameters"])
    next[key] = Object.hasOwn(changes, key)
      ? changes[key]
      : changingRule
        ? rule.defaults[key]
        : old[key];
  if (
    !Number.isSafeInteger(next.groupCount) ||
    next.groupCount < 1 ||
    next.groupCount > 64
  )
    fail("/changes/groupCount", "组数必须为1–64");
  object(
    next.parameters,
    Object.keys(rule.parameterSchema.properties),
    "/changes/parameters",
  );
  next.parameters = { ...rule.defaults.parameters, ...next.parameters };
  const rebuild = isRebuild(old, next);
  delete next.capacity;
  next.groups = Array.from({ length: next.groupCount }, (_, i) => {
    const group = old.groups[i] ?? {
      id: "grp-" + digest({ namespace, stageId, index: i }).slice(0, 32),
      stageId,
    };
    const { capacity, ...rest } = group;
    return rest;
  });
  const removed = new Set(old.groups.slice(next.groupCount).map((g) => g.id));
  const routes = structure.routes.filter(
    (r) =>
      !removed.has(r.source.groupId) &&
      !removed.has(r.target.groupId) &&
      !(
        rebuild &&
        (r.source.stageId === stageId || r.target.stageId === stageId)
      ),
  );
  return parseStructure(
    {
      ...structure,
      stages: structure.stages.map((s) => (s.id === stageId ? next : s)),
      routes,
    },
    tournamentId,
  );
}

function bindingParameters(parameters) {
  const { defaultBO, overrides, ...rest } = parameters;
  return rest;
}
function isRebuild(old, next) {
  return (
    ["format", "ruleVersion", "groupSize", "qualifyCount"].some(
      (k) => old[k] !== next[k],
    ) ||
    digest(bindingParameters(old.parameters)) !==
      digest(bindingParameters(next.parameters))
  );
}
function planChange(
  configuration,
  tournamentId,
  stageId,
  changes,
  dependencies,
) {
  const {
    id,
    version,
    state,
    snapshot,
    upgradeOrigin,
    tournamentId: owner,
    ...structure
  } = configuration;
  const next = changeStage(
    structure,
    tournamentId,
    stageId,
    changes,
    id + ":" + version,
  );
  const old = structure.stages.find((s) => s.id === stageId),
    proposed = next.stages.find((s) => s.id === stageId);
  const rebuild = isRebuild(old, proposed);
  const settingsChanged =
    digest(old.parameters) !== digest(proposed.parameters);
  const removedGroupIds = old.groups
    .filter((g) => !proposed.groups.some((n) => n.id === g.id))
    .map((g) => g.id);
  const removed = new Set(removedGroupIds),
    affected = new Set(
      rebuild ? [stageId, ...old.groups.map((g) => g.id)] : removedGroupIds,
    );
  const routeIds = structure.routes
    .filter((r) => !next.routes.some((n) => n.id === r.id))
    .map((r) => r.id);
  const ops = dependencies ?? {
    version: 0,
    registrations: [],
    layouts: {},
    rules: {},
    runtime: null,
  };
  const registrations = (ops.registrations ?? []).filter((r) =>
    r.entryRef
      ? r.entryRef.configurationId === id && affected.has(r.entryRef.groupId)
      : affected.has(r.sourceId),
  );
  const layout = ops.layouts?.[id];
  const stageNodes = new Set([stageId, ...old.groups.map((g) => g.id)]);
  const { belongsToGroup, graphNodeIds } = require("./graph-nodes");
  const inGroups = (key, groups) =>
    groups.some((groupId) => belongsToGroup(key, id, groupId));
  const layoutIds = Object.keys(layout?.positions ?? {}).filter(
    (key) =>
      removed.has(key) ||
      inGroups(key, removedGroupIds) ||
      ((rebuild || settingsChanged) &&
        (stageNodes.has(key) ||
          inGroups(
            key,
            old.groups.map((g) => g.id),
          ))),
  );
  const nextIds = graphNodeIds({ id, tournamentId, ...next });
  const removedLayoutIds = layoutIds.filter((key) => !nextIds.has(key));
  const retainedLayoutIds = layoutIds.filter((key) => nextIds.has(key));
  const units =
    ops.runtime?.configurationId === id
      ? (ops.runtime.units ?? []).filter((u) => u.stageId === stageId)
      : [];
  const matches = units.flatMap((u) =>
    (u.rounds ?? []).flatMap((r) => (r.matches ?? []).map((m) => m.id)),
  );
  const ruleIds =
    (rebuild || settingsChanged) && Object.hasOwn(ops.rules ?? {}, stageId)
      ? [stageId]
      : [];
  const blockers = [];
  if (ops.runtime?.configurationId === id) blockers.push("RUNTIME_LOCKED");
  if (ops.rosterLocked && (registrations.length || ruleIds.length))
    blockers.push("ROSTER_LOCKED");
  const report = {
    configurationId: id,
    version,
    stageId,
    proposedStage: proposed,
    removedGroupIds,
    addedGroupIds: proposed.groups
      .filter((g) => !old.groups.some((n) => n.id === g.id))
      .map((g) => g.id),
    affectedRouteIds: routeIds,
    affectedRegistrationIds: registrations.map((r) => r.id),
    affectedLayoutIds: layoutIds,
    removedLayoutIds,
    retainedLayoutIds,
    affectedRuleStageIds: ruleIds,
    affectedMatchIds: matches,
    requiresConfirmation:
      rebuild || proposed.groupCount < old.groupCount || ruleIds.length > 0,
    blockers,
    operationsVersion: ops.version ?? 0,
    validation: require("./validation").validateStructure(next, tournamentId),
  };
  report.confirmationToken = digest({
    configurationId: id,
    version,
    stageId,
    changes,
    next,
    dependencies: ops,
  });
  return { structure: next, report };
}
function applyEffects(report, dependencies) {
  const before = digest(dependencies);
  for (const r of dependencies.registrations ?? [])
    if (report.affectedRegistrationIds.includes(r.id)) {
      r.sourceId = null;
      delete r.entryRef;
    }
  for (const id of report.affectedRuleStageIds) delete dependencies.rules[id];
  const layout = dependencies.layouts?.[report.configurationId];
  if (layout && report.removedLayoutIds.length) {
    for (const id of report.removedLayoutIds) delete layout.positions[id];
    layout.version++;
  }
  if (digest(dependencies) !== before) dependencies.version++;
}

module.exports = { addStage, changeStage, planChange, applyEffects, isRebuild };
