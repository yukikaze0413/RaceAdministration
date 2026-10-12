"use strict";
const { randomUUID } = require("node:crypto");
const { reject } = require("../../http/errors");
const { swissStandings, rankRows } = require("./swiss-standings");
function createRoundRobin(plan, entries) {
  const n = plan.inputs[0].capacity;
  if (
    entries.length !== n ||
    new Set(entries.map((e) => e.entrantId)).size !== n ||
    new Set(entries.map((e) => e.position)).size !== n ||
    new Set(entries.map((e) => e.positionKind)).size !== 1 ||
    entries.some(
      (e) =>
        !e.entrantId ||
        !Number.isInteger(e.position) ||
        e.position < 1 ||
        e.position > n ||
        !["seed", "slot"].includes(e.positionKind),
    )
  )
    reject(422, "ROSTER_INVALID", "循环入口必须完整且唯一。");
  const bindings = entries.map((e) => ({
      entrantId: e.entrantId,
      initialSeed: e.position,
      position: e.position,
      initialLosses: 0,
    })),
    p = plan.parameters;
  const unit = {
    id: plan.groupId,
    stageId: plan.stageId,
    format: plan.format,
    ruleVersion: plan.ruleVersion,
    plan: structuredClone(plan),
    bindings,
    entrants: bindings.map((b) => b.entrantId),
    rule: {
      bestOf: p.defaultBO,
      allowDraw: p.allowDraw,
      allowPlayerDoubleLoss: p.allowPlayerDoubleLoss,
    },
    standings: [],
    qualified: [],
    status: "running",
    rounds: [],
  };
  for (const wave of plan.waves) {
    const matches = wave.matches.map((key) => {
      const m = plan.matches.find((m) => m.planKey === key);
      return {
        id: randomUUID(),
        planKey: key,
        round: m.round,
        bestOf: m.bestOf,
        role: m.role,
        entrants: m.sources.map(
          (s) => bindings.find((b) => b.position === s.position).entrantId,
        ),
        bye: false,
        submissions: [],
        decision: null,
      };
    });
    unit.rounds.push({
      id: randomUUID(),
      planKey: wave.planKey,
      number: wave.number,
      confirmed: false,
      matches,
      rest: unit.entrants.filter(
        (id) => !matches.some((m) => m.entrants.includes(id)),
      ),
    });
  }
  return unit;
}
function standings(unit) {
  const rows = swissStandings(unit),
    byId = new Map(rows.map((r) => [r.entrantId, r])),
    points = unit.plan.parameters.points;
  for (const r of rows) {
    let sum = 0n;
    for (const m of unit.rounds
      .filter((r) => r.confirmed)
      .flatMap((r) => r.matches)) {
      if (
        !m.entrants.includes(r.entrantId) ||
        !m.entrants.every(
          (id) => BigInt(byId.get(id).points) === BigInt(r.points),
        )
      )
        continue;
      const side = m.entrants.indexOf(r.entrantId),
        d = m.decision;
      const key =
        d.kind === "double-loss"
          ? "doubleLoss"
          : d.scores[side] === d.scores[1 - side]
            ? "draw"
            : d.scores[side] > d.scores[1 - side]
              ? "win"
              : "loss";
      sum += BigInt(points[key]);
    }
    r.headToHead =
      sum <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(sum) : sum.toString();
  }
  return rankRows(rows, unit.plan.parameters.tiebreakers);
}
function finalizeRoundRobin(unit) {
  if (
    new Set(unit.standings.map((r) => r.rank)).size !== unit.standings.length
  ) {
    unit.status = "ranking-blocked";
    return;
  }
  const q = unit.plan.outputs.qualification.length;
  unit.qualified = unit.standings
    .slice(0, q)
    .map((r, i) => ({
      entrantId: r.entrantId,
      channel: "qualification",
      index: i + 1,
    }));
  for (const r of unit.standings) {
    const qualification = unit.qualified.find(
      (q) => q.entrantId === r.entrantId,
    );
    if (qualification)
      r.qualification = {
        channel: "qualification",
        index: qualification.index,
      };
  }
  unit.status = "completed";
}
function advanceRoundRobin(unit) {
  const r = unit.rounds.find((r) => !r.confirmed);
  if (!r) reject(409, "ROUND_LOCKED", "循环轮次已确认。");
  if (r.matches.some((m) => !m.decision))
    reject(409, "RESULTS_INCOMPLETE", "需收齐当前循环轮全部裁定。");
  for (const m of r.matches)
    require("../runtime").validateResult(
      unit,
      m.decision.kind === "double-loss"
        ? { kind: "double-loss" }
        : { kind: m.decision.kind, scores: m.decision.scores },
      m,
    );
  r.confirmed = true;
  unit.standings = standings(unit);
  if (unit.rounds.every((r) => r.confirmed)) finalizeRoundRobin(unit);
}
module.exports = {
  createRoundRobin,
  advanceRoundRobin,
  finalizeRoundRobin,
  standings,
};
