"use strict";
const { randomUUID } = require("node:crypto");
const { reject } = require("../http/errors");
function seedSlots(size) {
  let list = [1, 2];
  for (let n = 4; n <= size; n *= 2) list = list.flatMap((x) => [x, n + 1 - x]);
  return size === 1 ? [1] : list;
}
function match(a, b) {
  const entrants = [a ?? null, b ?? null],
    bye = !a || !b;
  return {
    id: randomUUID(),
    entrants,
    bye,
    submissions: [],
    decision: bye ? { kind: "bye", winnerId: a ?? b ?? null } : null,
  };
}
function singleRound(slots, number) {
  return {
    id: randomUUID(),
    number,
    confirmed: false,
    matches: Array.from({ length: slots.length / 2 }, (_, i) =>
      match(slots[2 * i], slots[2 * i + 1]),
    ),
  };
}
function createUnit(stage, group, entries, rule, placement = "seed") {
  const id = group?.id ?? stage.id,
    capacity = group?.capacity ?? stage.capacity;
  if (entries.length > capacity || entries.length < 1)
    reject(422, "ROSTER_INVALID", "参赛人数不满足阶段容量。");
  const unit = {
    id,
    stageId: stage.id,
    format: stage.formatIntent,
    rule,
    status: "running",
    entrants: [...entries]
      .sort((a, b) => a.position - b.position)
      .map((e) => e.entrantId),
    rounds: [],
    standings: [],
  };
  if (stage.formatIntent === "round-robin") {
    unit.rounds = require("./round-robin").schedule(unit.entrants);
    return unit;
  }
  if (stage.formatIntent !== "single-elimination")
    reject(501, "RUN_NOT_SUPPORTED", "该赛制运行尚未实现。");
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, entries.length)));
  if (placement === "slot") {
    const max = Math.max(...entries.map((e) => e.position));
    const cap = 2 ** Math.ceil(Math.log2(Math.max(size, max)));
    unit.slots = Array(cap).fill(null);
    for (const e of entries) {
      if (e.position < 1 || e.position > cap || unit.slots[e.position - 1])
        reject(422, "ROSTER_INVALID", "席位冲突。");
      unit.slots[e.position - 1] = e.entrantId;
    }
  } else {
    const max = Math.max(...entries.map((e) => e.position));
    if (
      max > capacity ||
      entries.some((e) => !Number.isInteger(e.position) || e.position < 1) ||
      new Set(entries.map((e) => e.position)).size !== entries.length
    )
      reject(422, "ROSTER_INVALID", "目标种子位置无效。");
    const cap = 2 ** Math.ceil(Math.log2(Math.max(size, max))),
      table = seedSlots(cap);
    unit.slots = table.map(
      (seed) => entries.find((e) => e.position === seed)?.entrantId ?? null,
    );
  }
  unit.rounds.push(singleRound(unit.slots, 1));
  return unit;
}
function validateResult(unit, result, match) {
  if (unit.ruleVersion === "ti2026-observed-candidate-v1")
    return require("./format-runners/ti-unit-candidate").validateTiCandidateResult(
      unit,
      result,
      match,
    );
  require("../http/errors").fields(
    result,
    result?.kind === "double-loss" ? ["kind"] : ["kind", "scores"],
  );
  if (
    result?.kind === "double-loss" &&
    [
      "round-robin",
      "double-round-robin",
      "fixed-swiss",
      "threshold-swiss",
    ].includes(unit.format)
  )
    return { kind: "double-loss" };
  if (
    !result ||
    result.kind !== "score" ||
    !Array.isArray(result.scores) ||
    result.scores.length !== 2 ||
    result.scores.some((x) => !Number.isInteger(x) || x < 0)
  )
    reject(422, "RESULT_INVALID", "请输入合法整场比分。");
  const [a, b] = result.scores,
    target = ((match?.bestOf ?? unit.rule.bestOf) + 1) / 2;
  if (
    ["round-robin", "double-round-robin", "fixed-swiss"].includes(
      unit.format,
    ) &&
    a === b &&
    unit.rule.allowDraw &&
    a * 2 <= (match?.bestOf ?? unit.rule.bestOf)
  )
    return { kind: "score", scores: [a, b] };
  if (a === b || Math.max(a, b) !== target || Math.min(a, b) >= target)
    reject(422, "RESULT_INVALID", "比分必须符合BO规则，淘汰赛不能平局。");
  return { kind: "score", scores: [a, b] };
}
function advanceUnit(unit) {
  if (unit.ruleVersion === "ti2026-observed-candidate-v1")
    reject(501, "RUN_NOT_SUPPORTED", "TI候选必须通过专用确认协议推进。");
  if (unit.plan && ["round-robin", "double-round-robin"].includes(unit.format))
    return require("./format-runners/round-robin").advanceRoundRobin(unit);
  if (["fixed-swiss", "threshold-swiss"].includes(unit.format))
    return require("./format-runners/swiss").advanceSwiss(unit);
  if (unit.plan) return require("./format-runners/static").advanceStatic(unit);
  const round = unit.rounds.find((r) => !r.confirmed);
  if (!round || round.confirmed) reject(409, "ROUND_LOCKED", "轮次已经确认。");
  if (round.matches.some((m) => !m.decision))
    reject(409, "RESULTS_INCOMPLETE", "请收齐并裁定本轮全部赛果。");
  round.confirmed = true;
  if (unit.format === "round-robin") {
    unit.standings = require("./round-robin").standings(unit);
    if (unit.rounds.every((r) => r.confirmed))
      unit.status =
        new Set(unit.standings.map((e) => e.rank)).size ===
        unit.standings.length
          ? "completed"
          : "ranking-blocked";
    return;
  }
  const winners = round.matches.map((m) =>
    m.bye
      ? m.decision.winnerId
      : m.entrants[m.decision.scores[0] > m.decision.scores[1] ? 0 : 1],
  );
  if (winners.length > 1) {
    unit.rounds.push(singleRound(winners, round.number + 1));
    return;
  }
  unit.status = "completed";
  unit.standings = [];
  if (winners[0])
    unit.standings.push({
      entrantId: winners[0],
      rank: 1,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
    });
  for (let i = unit.rounds.length - 1; i >= 0; i--) {
    const r = unit.rounds[i],
      rank =
        r.matches
          .map((m) =>
            m.bye
              ? m.decision.winnerId
              : m.entrants[m.decision.scores[0] > m.decision.scores[1] ? 0 : 1],
          )
          .filter(Boolean).length + 1;
    for (const m of r.matches.filter((m) => !m.bye)) {
      const loser =
        m.entrants[m.decision.scores[0] > m.decision.scores[1] ? 1 : 0];
      unit.standings.push({
        entrantId: loser,
        rank,
        wins: 0,
        losses: 1,
        draws: 0,
        points: 0,
      });
    }
  }
  for (const row of unit.standings) {
    row.wins = unit.rounds
      .flatMap((r) => r.matches)
      .filter(
        (m) =>
          !m.bye &&
          m.entrants[m.decision.scores[0] > m.decision.scores[1] ? 0 : 1] ===
            row.entrantId,
      ).length;
    row.losses = row.rank === 1 ? 0 : 1;
  }
}
function runtimeView(s, uid, privileged) {
  if (!s.runtime) return null;
  const r = structuredClone(s.runtime);
  r.roster = r.roster.map(({ userId, ...e }) => e);
  for (const u of r.units) {
    if (!privileged) {
      for (const selection of u.elimination?.selections ?? [])
        delete selection.actorId;
      if (u.elimination?.completionDecision)
        delete u.elimination.completionDecision.actorId;
    }
    if (!privileged && u.rankingDecision) delete u.rankingDecision.actorId;
    for (const round of u.rounds) {
      if (!privileged && round.confirmationDecision)
        delete round.confirmationDecision.actorId;
      if (!privileged && round.pairing?.decision)
        delete round.pairing.decision.actorId;
      for (const m of round.matches) {
        m.submissions = m.submissions.filter(
          (x) => privileged || x.actorId === uid,
        );
        if (!privileged) for (const x of m.submissions) delete x.actorId;
        if (m.decision && !privileged) delete m.decision.actorId;
      }
    }
  }
  return r;
}
module.exports = {
  seedSlots,
  createUnit,
  validateResult,
  advanceUnit,
  runtimeView,
};
