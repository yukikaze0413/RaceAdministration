"use strict";
const { randomUUID } = require("node:crypto");
const {
  digest,
} = require("../../../tournament-configuration/domain/canonical");
const { reject } = require("../../http/errors");
const { observedTiStandings } = require("./ti-standings");
// Private candidate state machine. A future HTTP adapter must authorize the
// current actor inside its transaction; audit strings here do not grant roles.
function hash(state) {
  const { inputHash, ...content } = state;
  return digest(content);
}
function seal(state) {
  state.inputHash = hash(state);
  return state;
}
function createTiElimination(entrantIds, confirmedSeries) {
  const ranking = observedTiStandings(entrantIds, confirmedSeries);
  const directQualifiers = ranking.rows.filter((r) => r.wins === 4);
  const choosers = ranking.rows.filter((r) => r.wins === 3 && r.losses === 2);
  const opponents = ranking.rows.filter((r) => r.wins === 2 && r.losses === 3);
  if (
    confirmedSeries.length !== 39 ||
    directQualifiers.length !== 3 ||
    choosers.length !== 5 ||
    opponents.length !== 5 ||
    ranking.rows.some(
      (r) => r.wins !== 4 && r.losses !== 4 && r.wins + r.losses !== 5,
    )
  )
    reject(
      422,
      "ROSTER_INVALID",
      "TI附加淘汰赛需要完整五轮的3直通、5个3–2和5个2–3队伍。",
    );
  return seal({
    version: 0,
    profile: "ti2026-elimination-candidate-v1",
    formulaStatus: "observed-inference",
    status: ranking.status === "ready" ? "choosing" : "ranking-blocked",
    ...(ranking.status !== "ready"
      ? { code: ranking.code, tiedGroups: ranking.tiedGroups }
      : {}),
    rows: ranking.rows,
    directQualifiers,
    choosers,
    opponents,
    selections: [],
    qualified: [],
  });
}
function guard(state, audit) {
  if (
    !audit ||
    typeof audit !== "object" ||
    typeof audit.actorId !== "string" ||
    !audit.actorId.trim() ||
    audit.actorId.length > 120 ||
    typeof audit.reason !== "string" ||
    !audit.reason.trim() ||
    audit.reason.length > 500
  )
    reject(422, "INVALID_INPUT", "TI选择或确认必须记录裁定人和原因。");
  if (
    audit.expectedVersion !== state.version ||
    audit.inputHash !== state.inputHash ||
    hash(state) !== state.inputHash
  )
    reject(409, "INPUT_CHANGED", "TI选择输入已改变，请重新读取。");
}
function chooseTiOpponent(state, chooserId, opponentId, audit) {
  guard(state, audit);
  if (state.status !== "choosing")
    reject(409, "SELECTION_LOCKED", "TI当前不接受对手选择。");
  const chooser = state.choosers[state.selections.length];
  if (
    chooser?.entrantId !== chooserId ||
    !state.opponents.some((r) => r.entrantId === opponentId) ||
    state.selections.some((s) => s.entrantIds.includes(opponentId))
  )
    reject(
      422,
      "OPPONENT_CHOICE_INVALID",
      "必须由下一支3–2队伍选择尚未分配的2–3对手。",
    );
  const next = structuredClone(state);
  next.selections.push({
    id: randomUUID(),
    chooserSwissRank: chooser.rank,
    entrantIds: [chooserId, opponentId],
    bestOf: 3,
    repeatedSwissOpponent: chooser.opponents.includes(opponentId),
    actorId: audit.actorId,
    reason: audit.reason.trim(),
    decision: null,
  });
  next.version++;
  if (next.selections.length === 5) next.status = "ready";
  return seal(next);
}
function finishTiElimination(state, results, audit) {
  guard(state, audit);
  if (state.status !== "ready" || state.selections.length !== 5)
    reject(
      409,
      "OPPONENT_SELECTION_PENDING",
      "必须完成五个顺序选择后才可确认附加淘汰赛。",
    );
  const ids = new Set(state.selections.map((s) => s.id));
  if (
    !Array.isArray(results) ||
    results.length !== 5 ||
    results.some((r) => !r || !ids.has(r.matchId)) ||
    new Set(results.map((r) => r.matchId)).size !== 5
  )
    reject(409, "RESULTS_INCOMPLETE", "必须收齐五场附加淘汰赛结果。");
  for (const result of results) {
    if (
      !Array.isArray(result.scores) ||
      result.scores.length !== 2 ||
      result.scores.some((n) => !Number.isInteger(n) || n < 0 || n > 2) ||
      Math.max(...result.scores) !== 2 ||
      Math.min(...result.scores) >= 2
    )
      reject(422, "RESULT_INVALID", "TI附加淘汰赛必须提供有效BO3决胜比分。");
  }
  const next = structuredClone(state),
    qualified = new Set(state.directQualifiers.map((r) => r.entrantId));
  for (const selection of next.selections) {
    const result = results.find((r) => r.matchId === selection.id);
    selection.decision = { kind: "score", scores: [...result.scores] };
    qualified.add(
      selection.entrantIds[result.scores[0] > result.scores[1] ? 0 : 1],
    );
  }
  if (qualified.size !== 8)
    reject(422, "ROSTER_INVALID", "TI最终晋级身份必须为八个唯一队伍。");
  // Elimination results never change final Swiss metrics or Swiss ranking.
  next.qualified = state.rows
    .filter((r) => qualified.has(r.entrantId))
    .map((r, i) => ({
      entrantId: r.entrantId,
      channel: "qualification",
      index: i + 1,
      swissRank: r.rank,
    }));
  next.completionDecision = {
    actorId: audit.actorId,
    reason: audit.reason.trim(),
  };
  next.status = "completed";
  next.version++;
  return seal(next);
}
module.exports = { createTiElimination, chooseTiOpponent, finishTiElimination };
