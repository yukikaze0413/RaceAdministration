"use strict";
const { randomUUID } = require("node:crypto");
const {
  digest,
} = require("../../../tournament-configuration/domain/canonical");
const {
  definition,
} = require("../../../tournament-configuration/domain/formats/registry");
const { reject, fields } = require("../../http/errors");
const { observedTiStandings } = require("./ti-standings");
const { tiPairingCandidate } = require("./ti-pairing-candidate");
const {
  createTiElimination,
  chooseTiOpponent,
  finishTiElimination,
} = require("./ti-elimination-candidate");
// Serializable integration candidate; public start remains unsupported.
// HTTP authorization belongs to the current transaction, never audit strings.
const rule = "ti2026-observed-candidate-v1";
function hash(unit) {
  const { inputHash, ...content } = unit;
  return digest(content);
}
function seal(unit) {
  unit.inputHash = hash(unit);
  return unit;
}
function guard(unit, audit) {
  if (
    !audit ||
    typeof audit.actorId !== "string" ||
    !audit.actorId.trim() ||
    audit.actorId.length > 120 ||
    typeof audit.reason !== "string" ||
    !audit.reason.trim() ||
    audit.reason.length > 500
  )
    reject(422, "INVALID_INPUT", "TI候选操作必须记录裁定人和原因。");
  if (
    unit.version !== audit.expectedVersion ||
    unit.inputHash !== audit.inputHash ||
    unit.inputHash !== hash(unit)
  )
    reject(409, "INPUT_CHANGED", "TI候选输入已变化，请重新读取。");
}
function generateSwiss(unit) {
  const number = unit.rounds.length + 1;
  const candidate = tiPairingCandidate({
    entrantIds: unit.bindings.map((b) => b.entrantId),
    initialGroups: unit.initialGroups,
    firstPairing: unit.firstPairing,
    confirmedSeries: unit.confirmedSeries,
    round: number,
  });
  unit.pairingCandidate = candidate;
  if (candidate.status !== "ready") {
    unit.status = "pairing-blocked";
    return;
  }
  const window = unit.plan.windows[number - 1];
  unit.rounds.push({
    id: randomUUID(),
    planKey: window.planKey,
    number,
    phase: "swiss",
    confirmed: false,
    matches: candidate.pairs.map((entrants, i) => ({
      id: randomUUID(),
      planKey: window.planKey + "/match/" + (i + 1),
      bestOf: 3,
      entrants: [...entrants],
      submissions: [],
      decision: null,
      bye: false,
    })),
  });
  unit.status = "running";
}
function createTiCandidateUnit(plan, entries) {
  const defaults = definition(rule).defaults.parameters;
  if (
    !plan ||
    plan.ruleVersion !== rule ||
    plan.format !== "threshold-swiss" ||
    typeof plan.unitKey !== "string" ||
    !plan.unitKey ||
    plan.inputs?.length !== 1 ||
    plan.inputs[0]?.channel !== "slot" ||
    plan.inputs[0].capacity !== 16 ||
    plan.inputs[0].positionKind !== "slot" ||
    !plan.parameters ||
    digest(plan.parameters) !== digest(defaults) ||
    plan.matches?.length !== 0 ||
    plan.waves?.length !== 0 ||
    !Array.isArray(plan.windows) ||
    plan.windows.length !== 6 ||
    new Set(plan.windows.map((w) => w?.planKey)).size !== 6 ||
    plan.windows.some(
      (w, i) =>
        !w ||
        w.round !== i + 1 ||
        typeof w.planKey !== "string" ||
        !w.planKey ||
        w.phase !== (i < 5 ? "swiss" : "elimination") ||
        w.previousWindowKey !== (i ? plan.windows[i - 1].planKey : null) ||
        w.source?.kind !==
          (i < 5 ? "pendingSwissRound" : "pendingEliminationRound") ||
        w.source.unitKey !== plan.unitKey ||
        w.source.round !== i + 1,
    ) ||
    plan.outputs?.qualification?.length !== 8 ||
    plan.outputs.qualification.some(
      (q, i) =>
        !q ||
        q.kind !== "qualification" ||
        q.unitKey !== plan.unitKey ||
        q.channel !== "qualification" ||
        q.index !== i + 1 ||
        q.source?.kind !== "selectedStanding" ||
        digest(q.source) !==
          digest({
            kind: "selectedStanding",
            unitKey: plan.unitKey,
            channel: "qualification",
            index: i + 1,
          }),
    )
  )
    reject(
      422,
      "RULE_INVALID",
      "TI候选需要完整且固定的五轮瑞士加附加淘汰编译计划。",
    );
  if (
    !Array.isArray(entries) ||
    entries.length !== 16 ||
    new Set(entries.map((e) => e?.entrantId)).size !== 16 ||
    new Set(entries.map((e) => e?.position)).size !== 16 ||
    entries.some(
      (e) =>
        !e ||
        typeof e.entrantId !== "string" ||
        !e.entrantId ||
        e.channel !== "slot" ||
        e.positionKind !== "slot" ||
        !Number.isInteger(e.position) ||
        e.position < 1 ||
        e.position > 16,
    )
  )
    reject(
      422,
      "ROSTER_INVALID",
      "TI候选需要16个唯一身份及组织者指定的绝对席位。",
    );
  const bindings = structuredClone(entries).sort(
    (a, b) => a.position - b.position,
  );
  const unit = {
    id: plan.groupId,
    stageId: plan.stageId,
    format: plan.format,
    ruleVersion: rule,
    formulaStatus: "observed-inference",
    plan: structuredClone(plan),
    bindings,
    entrants: bindings.map((b) => b.entrantId),
    rule: { bestOf: 3, allowDraw: false, allowPlayerDoubleLoss: false },
    version: 0,
    rounds: [],
    confirmedSeries: [],
    qualified: [],
    standings: observedTiStandings(
      bindings.map((b) => b.entrantId),
      [],
    ).rows,
    initialGroups: bindings.map((b) => ({
      entrantId: b.entrantId,
      initialGroup: b.position <= 8 ? "A" : "B",
    })),
    firstPairing: Array.from({ length: 8 }, (_, i) =>
      bindings.slice(i * 2, i * 2 + 2).map((b) => b.entrantId),
    ),
  };
  generateSwiss(unit);
  return seal(unit);
}
function completeResults(round, results) {
  if (
    !Array.isArray(results) ||
    results.length !== round.matches.length ||
    new Set(results.map((r) => r?.matchId)).size !== round.matches.length ||
    results.some((r) => !r || !round.matches.some((m) => m.id === r.matchId))
  )
    reject(409, "RESULTS_INCOMPLETE", "必须收齐当前轮所有比赛结果。");
}
function confirmTiCandidateRound(unit, results, audit) {
  guard(unit, audit);
  const round = unit.rounds.at(-1);
  if (unit.status !== "running" || !round || round.confirmed)
    reject(409, "ROUND_LOCKED", "TI候选当前没有可确认轮次。");
  completeResults(round, results);
  const next = structuredClone(unit),
    current = next.rounds.at(-1);
  if (current.phase === "swiss") {
    next.confirmedSeries.push(
      ...current.matches.map((m) => {
        const r = results.find((r) => r.matchId === m.id);
        return {
          seriesId: r.seriesId,
          entrantIds: [...m.entrants],
          scores: r.scores,
          games: r.games,
        };
      }),
    );
    next.standings = observedTiStandings(
      next.bindings.map((b) => b.entrantId),
      next.confirmedSeries,
    ).rows.map((r) => ({ ...r, draws: 0, points: r.wins }));
  } else {
    const e = next.elimination;
    next.elimination = finishTiElimination(e, results, {
      ...audit,
      expectedVersion: e.version,
      inputHash: e.inputHash,
    });
    next.qualified = structuredClone(next.elimination.qualified);
    next.standings = next.standings.map((row) => {
      const q = next.qualified.find((q) => q.entrantId === row.entrantId);
      return q
        ? { ...row, qualification: { channel: q.channel, index: q.index } }
        : row;
    });
    next.status = "completed";
  }
  for (const m of current.matches) {
    const r = results.find((r) => r.matchId === m.id);
    m.decision = { ...m.decision, kind: "score", scores: [...r.scores] };
    const side = r.scores[0] > r.scores[1] ? 0 : 1;
    m.outcome = { winner: m.entrants[side], loser: m.entrants[1 - side] };
  }
  current.confirmed = true;
  current.confirmationDecision = {
    actorId: audit.actorId,
    reason: audit.reason.trim(),
  };
  next.version++;
  if (current.phase === "swiss") {
    if (current.number < 5) generateSwiss(next);
    else {
      next.elimination = createTiElimination(
        next.bindings.map((b) => b.entrantId),
        next.confirmedSeries,
      );
      next.status =
        next.elimination.status === "choosing"
          ? "choosing-elimination"
          : "ranking-blocked";
    }
  }
  // Results are caller-owned input; never retain shared scores/game objects.
  return seal(structuredClone(next));
}
function chooseTiCandidateOpponent(unit, chooserId, opponentId, audit) {
  guard(unit, audit);
  if (unit.status !== "choosing-elimination")
    reject(409, "SELECTION_LOCKED", "TI候选当前不接受附加淘汰赛对手选择。");
  const next = structuredClone(unit),
    e = next.elimination;
  next.elimination = chooseTiOpponent(e, chooserId, opponentId, {
    ...audit,
    expectedVersion: e.version,
    inputHash: e.inputHash,
  });
  next.version++;
  if (next.elimination.status === "ready") {
    const window = next.plan.windows[5];
    next.rounds.push({
      id: randomUUID(),
      planKey: window.planKey,
      number: 6,
      phase: "elimination",
      confirmed: false,
      matches: next.elimination.selections.map((s, i) => ({
        id: s.id,
        planKey: window.planKey + "/match/" + (i + 1),
        bestOf: 3,
        entrants: [...s.entrantIds],
        submissions: [],
        decision: null,
        bye: false,
      })),
    });
    next.status = "running";
  }
  return seal(next);
}
module.exports = {
  createTiCandidateUnit,
  confirmTiCandidateRound,
  chooseTiCandidateOpponent,
  validateTiCandidateResult,
  recordTiCandidateMatch,
};
function validateTiCandidateResult(unit, result, match) {
  const swiss =
    unit.rounds.find((r) => r.matches.some((m) => m.id === match.id))?.phase ===
    "swiss";
  fields(
    result,
    swiss ? ["kind", "scores", "seriesId", "games"] : ["kind", "scores"],
  );
  if (
    result.kind !== "score" ||
    !Array.isArray(result.scores) ||
    result.scores.length !== 2 ||
    result.scores.some((n) => !Number.isInteger(n) || n < 0 || n > 2) ||
    Math.max(...result.scores) !== 2 ||
    Math.min(...result.scores) >= 2
  )
    reject(422, "RESULT_INVALID", "TI比赛必须提供BO3决胜比分。");
  if (swiss) {
    if (
      typeof result.seriesId !== "string" ||
      !result.seriesId ||
      result.seriesId.length > 120 ||
      !Array.isArray(result.games) ||
      result.games.length > 3
    )
      reject(
        422,
        "RESULT_INVALID",
        "TI瑞士结果必须提供系列ID和完整逐局胜者、时长。",
      );
    for (const game of result.games) {
      fields(game, ["matchId", "winnerId", "durationSeconds"]);
      if (typeof game.matchId !== "string" || game.matchId.length > 120)
        reject(422, "RESULT_INVALID", "逐局ID无效。");
    }
    observedTiStandings(unit.entrants, [
      ...unit.confirmedSeries,
      {
        seriesId: result.seriesId,
        entrantIds: match.entrants,
        scores: result.scores,
        games: result.games,
      },
    ]);
  }
  return structuredClone(result);
}
function recordTiCandidateMatch(
  unit,
  matchId,
  result,
  audit,
  mode,
  actualStartedAt,
) {
  guard(unit, audit);
  const round = unit.rounds.at(-1),
    match = round?.matches.find((m) => m.id === matchId);
  if (unit.status !== "running" || !match || round.confirmed)
    reject(409, "ROUND_LOCKED", "只能修改当前未确认比赛。");
  if (!["decision", "submission", "start"].includes(mode))
    reject(422, "INVALID_INPUT", "未知TI比赛写入操作。");
  const validated =
    mode === "start" ? null : validateTiCandidateResult(unit, result, match);
  const next = structuredClone(unit),
    target = next.rounds.at(-1).matches.find((m) => m.id === matchId);
  if (mode === "decision")
    target.decision = {
      ...validated,
      actorId: audit.actorId,
      reason: audit.reason.trim(),
    };
  if (mode === "submission") {
    target.submissions = target.submissions.filter(
      (s) => s.actorId !== audit.actorId,
    );
    target.submissions.push({ ...validated, actorId: audit.actorId });
    target.decision = null;
  }
  if (actualStartedAt) target.actualStartedAt = actualStartedAt;
  next.version++;
  return seal(next);
}
