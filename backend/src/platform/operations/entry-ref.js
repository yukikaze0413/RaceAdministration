"use strict";
const { fields, reject } = require("../http/errors");
const {
  parseStructure,
} = require("../../tournament-configuration/domain/structure");
const {
  targetPort,
} = require("../../tournament-configuration/domain/routing-v2");
function entryChannel(ref) {
  return ["upper", "lower"].includes(ref.port) ? ref.port : "entry";
}
function entryKey(ref) {
  return JSON.stringify([
    ref.configurationId,
    ref.stageId,
    ref.groupId,
    entryChannel(ref),
    ref.position,
  ]);
}
function validateEntryRef(input, configurationId, ref, tournamentId) {
  fields(ref, [
    "configurationId",
    "stageId",
    "groupId",
    "port",
    "position",
    "positionKind",
  ]);
  const bad = (message) => reject(422, "ENTRY_INVALID", message);
  if (ref.configurationId !== configurationId) bad("入口必须绑定所选配置。");
  const structure = parseStructure(input, tournamentId),
    stage = structure.stages.find((s) => s.id === ref.stageId),
    group = stage?.groups.find((g) => g.id === ref.groupId);
  if (structure.structureVersion !== "structure-v2" || !stage || !group)
    bad("入口阶段或小组不属于此v2配置。");
  const de = stage.format === "double-elimination";
  if (!(de ? ["upper", "lower"] : ["seed", "slot"]).includes(ref.port))
    bad("具名入口不适用于该阶段。");
  const positionKind =
    ref.positionKind ?? (de ? stage.parameters.seeding.kind : ref.port);
  if (
    !["seed", "slot"].includes(positionKind) ||
    (!de && positionKind !== ref.port)
  )
    bad("入口seed/slot解释不一致。");
  const capacity =
    de && ref.port === "lower"
      ? group.capacity - stage.groupSize
      : stage.groupSize;
  if (
    !Number.isSafeInteger(ref.position) ||
    ref.position < 1 ||
    ref.position > capacity
  )
    bad("入口席位超出此端口容量。");
  const normalized = { ...ref, positionKind };
  for (const route of structure.routes.filter(
    (r) => r.target.groupId === ref.groupId,
  )) {
    const port = targetPort(route.target, stage, route.placement);
    if ((de ? port : "entry") !== entryChannel(normalized)) continue;
    if (route.placement?.kind !== positionKind)
      reject(
        422,
        "ENTRY_KIND_CONFLICT",
        "直邀与晋级不能在同一入口混用seed/slot。",
      );
    if (route.placement?.positions.includes(ref.position))
      reject(422, "ENTRY_POSITION_RESERVED", "此席位已保留给上游晋级来源。");
  }
  return normalized;
}
function rosterEntries(input, configurationId, approved, tournamentId) {
  const structure = parseStructure(input, tournamentId);
  if (
    approved.length < 2 ||
    approved.length > 64 ||
    approved.some(
      (r) =>
        typeof r.id !== "string" ||
        !r.id ||
        typeof r.userId !== "string" ||
        !r.userId ||
        !Number.isSafeInteger(r.seed) ||
        r.seed < 1 ||
        r.seed > 64,
    ) ||
    new Set(approved.map((r) => r.id)).size !== approved.length ||
    new Set(approved.map((r) => r.userId)).size !== approved.length ||
    new Set(approved.map((r) => r.seed)).size !== approved.length
  )
    reject(422, "ROSTER_INVALID", "需要2–64个唯一参赛身份与初始种子。");
  const roots = structure.stages.filter(
    (s) => !structure.routes.some((r) => r.target.stageId === s.id),
  );
  const rootGroups = roots.flatMap((s) =>
    s.groups.map((g) => ({ stage: s, group: g })),
  );
  const groups = structure.stages.flatMap((s) =>
    s.groups.map((g) => ({ stage: s, group: g })),
  );
  const pending = approved.map((r) => {
    if (r.entryRef)
      return {
        ...r,
        entryRef: validateEntryRef(
          structure,
          configurationId,
          r.entryRef,
          tournamentId,
        ),
      };
    const matches = groups.filter(
      (x) =>
        x.group.id === r.sourceId ||
        (x.stage.id === r.sourceId && x.stage.groups.length === 1),
    );
    const found = r.sourceId
      ? matches.length === 1
        ? matches[0]
        : null
      : rootGroups.length === 1
        ? rootGroups[0]
        : null;
    if (!found) reject(422, "ENTRY_INVALID", "请明确分配每位参赛者的入口。");
    return {
      ...r,
      entryRef: {
        configurationId,
        stageId: found.stage.id,
        groupId: found.group.id,
        port:
          found.stage.format === "double-elimination"
            ? "upper"
            : found.stage.parameters.seeding.kind,
      },
    };
  });
  const keys = new Set(),
    kinds = new Map();
  for (const r of [...pending].sort((a, b) => a.seed - b.seed)) {
    if (!r.entryRef.position) {
      const unit = JSON.stringify([
        r.entryRef.stageId,
        r.entryRef.groupId,
        entryChannel(r.entryRef),
      ]);
      const position =
        pending
          .filter(
            (x) =>
              JSON.stringify([
                x.entryRef.stageId,
                x.entryRef.groupId,
                entryChannel(x.entryRef),
              ]) === unit,
          )
          .sort((a, b) => a.seed - b.seed)
          .findIndex((x) => x.id === r.id) + 1;
      r.entryRef = validateEntryRef(
        structure,
        configurationId,
        { ...r.entryRef, position },
        tournamentId,
      );
    }
    const k = entryKey(r.entryRef),
      unit = JSON.stringify([
        r.entryRef.stageId,
        r.entryRef.groupId,
        entryChannel(r.entryRef),
      ]);
    if (keys.has(k)) reject(422, "ENTRY_POSITION_CONFLICT", "入口席位重复。");
    keys.add(k);
    if (kinds.has(unit) && kinds.get(unit) !== r.entryRef.positionKind)
      reject(422, "ENTRY_KIND_CONFLICT", "同一入口不能混用seed/slot。");
    kinds.set(unit, r.entryRef.positionKind);
  }
  return pending.map((r) => ({
    entrantId: r.id,
    userId: r.userId,
    name: r.name,
    initialSeed: r.seed,
    exitState: "active",
    sourceId: r.entryRef.groupId,
    entryRef: r.entryRef,
  }));
}
function configurationStructure(db, tournamentId, configurationId) {
  const row = db
    .prepare("SELECT data FROM structure_aggregates WHERE tournamentId=?")
    .get(tournamentId);
  const c = (row ? JSON.parse(row.data).configurations : []).find(
    ([id]) => id === configurationId,
  )?.[1];
  if (!c) reject(422, "ENTRY_INVALID", "入口配置不属于此赛事。");
  if (c.snapshot) return c.snapshot.structure;
  const {
    id,
    tournamentId: owner,
    version,
    state,
    snapshot,
    upgradeOrigin,
    ...structure
  } = c;
  return structure;
}
module.exports = {
  validateEntryRef,
  rosterEntries,
  entryKey,
  entryChannel,
  configurationStructure,
};
