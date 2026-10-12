"use strict";
const { randomUUID } = require("node:crypto");
const { reject } = require("../../http/errors");
const {
  seedSlots,
} = require("../../../tournament-configuration/domain/formats/compile");
function placementTable(plan, input) {
  const n = input.capacity;
  if (
    plan.format === "single-elimination" &&
    plan.parameters.bracketMode === "segmented"
  ) {
    const q = plan.outputs.qualification.length,
      size = n / q;
    return Array.from({ length: q }, (_, i) =>
      seedSlots(size).map((x) => x + i * size),
    ).flat();
  }
  if (
    plan.format === "double-elimination" &&
    input.channel === "lower" &&
    plan.parameters.lowerEntryMode === "half"
  )
    return Array.from({ length: n }, (_, i) => i + 1);
  return seedSlots(n);
}
function createStaticUnit(plan, entries) {
  if (
    !["single-elimination", "gsl", "double-elimination"].includes(plan.format)
  )
    reject(501, "RUN_NOT_SUPPORTED", "此版本尚未接入静态运行器。");
  const bindings = [],
    ids = new Set(),
    keys = new Set(),
    kinds = new Map();
  for (const e of entries) {
    const input =
      plan.format === "double-elimination"
        ? plan.inputs.find((x) => x.channel === e.channel)
        : plan.inputs[0];
    if (
      !input ||
      !e.entrantId ||
      ids.has(e.entrantId) ||
      !Number.isSafeInteger(e.position) ||
      e.position < 1 ||
      e.position > input.capacity ||
      !["seed", "slot"].includes(e.positionKind)
    )
      reject(422, "ROSTER_INVALID", "参赛身份或席位无效。");
    const table = placementTable(plan, input),
      formalKind = plan.parameters.seeding.kind;
    const position =
      e.positionKind === formalKind
        ? e.position
        : formalKind === "seed"
          ? table[e.position - 1]
          : table.indexOf(e.position) + 1;
    const key = JSON.stringify([input.channel, position]);
    if (
      keys.has(key) ||
      (kinds.has(input.channel) && kinds.get(input.channel) !== e.positionKind)
    )
      reject(422, "ROSTER_INVALID", "同一入口席位重复或seed/slot混用。");
    keys.add(key);
    ids.add(e.entrantId);
    kinds.set(input.channel, e.positionKind);
    bindings.push({
      channel: input.channel,
      position,
      entrantId: e.entrantId,
      initialSeed: e.initialSeed,
      initialLosses: input.initialLosses,
    });
  }
  for (const input of plan.inputs)
    if (
      bindings.filter((b) => b.channel === input.channel).length !==
      input.capacity
    )
      reject(422, "ROSTER_INVALID", "v2必须齐满每个具名入口。");
  const unit = {
    id: plan.groupId,
    stageId: plan.stageId,
    format: plan.format,
    ruleVersion: plan.ruleVersion,
    rule: {
      bestOf: plan.parameters.defaultBO,
      allowDraw: false,
      allowPlayerDoubleLoss: false,
    },
    plan: structuredClone(plan),
    bindings,
    entrants: bindings.map((b) => b.entrantId),
    rounds: [],
    standings: [],
    qualified: [],
    waveCursor: 0,
    status: "running",
  };
  activateNext(unit);
  return unit;
}
function matches(unit) {
  return unit.rounds.filter((r) => r.confirmed).flatMap((r) => r.matches);
}
function resolve(unit, source) {
  if (source.kind === "entrant")
    return unit.bindings.find(
      (b) => b.channel === source.channel && b.position === source.position,
    )?.entrantId;
  if (source.kind === "conditional")
    return resolve(
      unit,
      conditionTrue(unit, source.condition)
        ? source.whenTrue
        : source.whenFalse,
    );
  const match = matches(unit).find((m) => m.planKey === source.matchKey);
  return source.kind === "winner"
    ? match?.outcome.winner
    : source.kind === "loser"
      ? match?.outcome.loser
      : undefined;
}
function conditionTrue(unit, condition) {
  const match = matches(unit).find((m) => m.planKey === condition.matchKey);
  if (!match) reject(409, "PLAN_SOURCE_UNRESOLVED", "条件所需批次尚未确认。");
  return match.outcome.side === condition.side;
}
function activateNext(unit) {
  while (unit.waveCursor < unit.plan.waves.length) {
    const wave = unit.plan.waves[unit.waveCursor++];
    const planned = wave.matches
      .map((key) => unit.plan.matches.find((m) => m.planKey === key))
      .filter((m) => !m.condition || conditionTrue(unit, m.condition));
    if (!planned.length) continue;
    const ready = planned.map((m) => {
      const entrants = m.sources.map((s) => resolve(unit, s));
      if (entrants.some((x) => !x) || new Set(entrants).size !== 2)
        reject(
          409,
          "PLAN_SOURCE_UNRESOLVED",
          "前置身份尚未齐备或重复，不能创建部分批次。",
        );
      return {
        id: randomUUID(),
        planKey: m.planKey,
        role: m.role,
        round: m.round,
        bestOf: m.bestOf,
        entrants,
        bye: false,
        submissions: [],
        decision: null,
      };
    });
    if (new Set(ready.flatMap((m) => m.entrants)).size !== 2 * ready.length)
      reject(409, "DUPLICATE_ENTRANT", "同一批次不能出现重复身份。");
    unit.rounds.push({
      id: randomUUID(),
      planKey: wave.planKey,
      number: wave.number,
      confirmed: false,
      matches: ready,
    });
    return;
  }
  finalize(unit);
}
function stats(unit) {
  const rows = new Map(
    unit.bindings.map((b) => [
      b.entrantId,
      {
        entrantId: b.entrantId,
        initialSeed: b.initialSeed,
        initialLosses: b.initialLosses,
        wins: 0,
        losses: 0,
        actualLosses: 0,
        draws: 0,
        points: 0,
        netGames: 0,
      },
    ]),
  );
  for (const m of matches(unit)) {
    const a = rows.get(m.outcome.winner),
      b = rows.get(m.outcome.loser);
    a.wins++;
    b.losses++;
    b.actualLosses++;
    const side = m.outcome.side,
      diff = m.decision.scores[side] - m.decision.scores[1 - side];
    a.netGames += diff;
    b.netGames -= diff;
  }
  return rows;
}
function finalize(unit) {
  const rows = stats(unit);
  unit.qualified = unit.plan.outputs.qualification.map((o) => ({
    entrantId: resolve(unit, o.source),
    channel: o.channel,
    index: o.index,
  }));
  if (
    unit.qualified.some((q) => !q.entrantId) ||
    new Set(unit.qualified.map((q) => q.entrantId)).size !==
      unit.qualified.length
  )
    reject(409, "QUALIFICATION_INVALID", "资格前沿身份未完整确定。");
  unit.qualified.forEach(
    (q) =>
      (rows.get(q.entrantId).qualification = {
        channel: q.channel,
        index: q.index,
      }),
  );
  unit.plan.outputs.rank.forEach((source, i) => {
    rows.get(resolve(unit, source)).rank = i + 1;
  });
  if (unit.format === "single-elimination" && unit.qualified.length === 1) {
    for (const r of unit.rounds)
      for (const m of r.matches)
        if (rows.get(m.outcome.loser).rank === undefined)
          rows.get(m.outcome.loser).rank =
            unit.entrants.length / 2 ** m.round + 1;
  } else if (unit.format === "double-elimination") {
    let cursor =
      unit.qualified.length +
      Array.from(rows.values()).filter(
        (r) => r.rank !== undefined && !r.qualification,
      ).length;
    for (const r of [...unit.rounds].reverse()) {
      const eliminated = r.matches
        .map((m) => rows.get(m.outcome.loser))
        .filter((x) => !x.qualification && x.rank === undefined);
      for (const x of eliminated) x.rank = cursor + 1;
      cursor += eliminated.length;
    }
  }
  unit.standings = Array.from(rows.values()).sort(
    (a, b) =>
      Number(!!b.qualification) - Number(!!a.qualification) ||
      (a.rank ?? Number.MAX_SAFE_INTEGER) -
        (b.rank ?? Number.MAX_SAFE_INTEGER) ||
      a.initialSeed - b.initialSeed,
  );
  unit.status = "completed";
}
function advanceStatic(unit) {
  const round = unit.rounds.find((r) => !r.confirmed);
  if (!round) reject(409, "ROUND_LOCKED", "批次已确认。");
  if (round.matches.some((m) => !m.decision))
    reject(409, "RESULTS_INCOMPLETE", "请收齐此确认批次的全部裁定。");
  for (const m of round.matches) {
    const d = m.decision,
      target = (m.bestOf + 1) / 2;
    if (
      d.kind !== "score" ||
      !Array.isArray(d.scores) ||
      d.scores.length !== 2 ||
      d.scores.some((s) => !Number.isSafeInteger(s) || s < 0) ||
      Math.max(...d.scores) !== target ||
      Math.min(...d.scores) >= target
    )
      reject(422, "RESULT_INVALID", "淘汰赛比分必须符合冻结BO。");
    const side = d.scores[0] > d.scores[1] ? 0 : 1;
    m.outcome = { side, winner: m.entrants[side], loser: m.entrants[1 - side] };
  }
  round.confirmed = true;
  unit.standings = Array.from(stats(unit).values());
  activateNext(unit);
}
module.exports = { createStaticUnit, advanceStatic, resolve, placementTable };
