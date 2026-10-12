"use strict";
const { randomUUID } = require("node:crypto");
const { reject } = require("../../http/errors");
const {
  digest,
} = require("../../../tournament-configuration/domain/canonical");
const { pairSwiss } = require("./swiss-pairing");
const { pairMajor, validateMajorDecision } = require("./major-pairing");
const { swissStandings } = require("./swiss-standings");
function major(unit) {
  return unit.ruleVersion === "major-cologne-2026-v1";
}
function pair(unit, input) {
  return major(unit)
    ? pairMajor(input.rows, input)
    : pairSwiss(input.rows, input);
}
function threshold(unit) {
  return unit.format === "threshold-swiss";
}
function activeRows(unit) {
  const p = unit.plan.parameters;
  return unit.standings.filter(
    (r) =>
      !threshold(unit) ||
      (r.wins < p.winsToQualify && r.losses < p.lossesToEliminate),
  );
}
function pairingInput(unit) {
  const authorizedRematches = [],
    seen = new Set();
  if (major(unit)) {
    for (const round of unit.rounds.filter((r) => r.confirmed)) {
      for (const match of round.matches) {
        const key = JSON.stringify([...match.entrants].sort());
        if (seen.has(key)) {
          if (
            round.pairing?.rematch !== true ||
            typeof round.pairing.decision?.actorId !== "string" ||
            !round.pairing.decision.actorId ||
            typeof round.pairing.decision?.reason !== "string" ||
            !round.pairing.decision.reason.trim()
          )
            reject(
              422,
              "ROSTER_INVALID",
              "Major历史重赛缺少已确认裁定及审计记录。",
            );
          authorizedRematches.push([...match.entrants]);
        }
        seen.add(key);
      }
    }
  }
  return {
    unitKey: unit.plan.unitKey,
    round: unit.rounds.length + 1,
    rows: major(unit) ? unit.standings : activeRows(unit),
    threshold: threshold(unit),
    first: unit.rounds.length === 0,
    ...(major(unit) ? { authorizedRematches } : {}),
  };
}
function activate(unit) {
  const input = pairingInput(unit),
    p = unit.plan.parameters,
    out = pair(unit, input);
  unit.pairingInputVersion = unit.rounds.filter((r) => r.confirmed).length;
  unit.pairingInputHash = digest(input);
  if (out.status !== "ready") {
    unit.status = "pairing-blocked";
    unit.pairingBlock = {
      code:
        out.code ??
        (out.status === "unsat" ? "PAIRING_UNSAT" : "PAIRING_SOLVER_LIMIT"),
      nodes: out.nodes,
      round: input.round,
    };
    return;
  }
  applyPairing(unit, out, input);
}
function applyPairing(unit, out, input = pairingInput(unit)) {
  const p = unit.plan.parameters,
    window = unit.plan.windows[input.round - 1];
  const baseBO = p.overrides?.rounds?.[String(input.round)] ?? p.defaultBO;
  function bestOf(ids) {
    if (!threshold(unit)) return baseBO;
    const rows = ids.map((id) =>
      unit.standings.find((r) => r.entrantId === id),
    );
    const roles = [];
    if (
      rows.some((r) => r.wins === p.winsToQualify - 1) &&
      p.overrides?.advancement !== undefined
    )
      roles.push(p.overrides.advancement);
    if (
      rows.some((r) => r.losses === p.lossesToEliminate - 1) &&
      p.overrides?.elimination !== undefined
    )
      roles.push(p.overrides.elimination);
    return roles.length ? Math.max(...roles) : baseBO;
  }
  const matches = out.pairs.map((entrants, i) => ({
    id: randomUUID(),
    planKey: window.planKey + "/match/" + (i + 1),
    bestOf: bestOf(entrants),
    entrants,
    pairingRecords: entrants.map((id) => {
      const row = input.rows.find((r) => r.entrantId === id);
      return {
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        points: row.points,
      };
    }),
    bye: false,
    submissions: [],
    decision: null,
  }));
  if (out.bye)
    matches.push({
      id: randomUUID(),
      planKey: window.planKey + "/bye",
      entrants: [out.bye, null],
      bye: true,
      submissions: [],
      decision: { kind: "bye", winnerId: out.bye },
    });
  unit.rounds.push({
    id: randomUUID(),
    planKey: window.planKey,
    number: input.round,
    confirmed: false,
    matches,
    pairing: {
      version: major(unit) ? unit.ruleVersion : "swiss-pairing-v1",
      inputVersion: unit.pairingInputVersion,
      inputHash: unit.pairingInputHash,
      nodes: out.nodes,
      floatCost: out.cost,
      ...(major(unit) ? { rematch: out.rematch === true } : {}),
    },
  });
  delete unit.pairingBlock;
  unit.status = "running";
}
function createSwissUnit(plan, entries) {
  if (plan.ruleVersion === "ti2026-observed-candidate-v1")
    reject(
      501,
      "RUN_NOT_SUPPORTED",
      "TI候选含附加淘汰环节，不能使用通用瑞士运行器。",
    );
  const n = plan.inputs[0].capacity;
  if (plan.ruleVersion === "major-cologne-2026-v1") {
    const p = plan.parameters;
    if (
      plan.format !== "threshold-swiss" ||
      n !== 16 ||
      plan.outputs.qualification.length !== 8 ||
      plan.windows.length !== 5 ||
      p.winsToQualify !== 3 ||
      p.lossesToEliminate !== 3 ||
      p.allowDraw !== false ||
      p.allowPlayerDoubleLoss !== false ||
      ![1, 3].includes(p.defaultBO) ||
      p.seeding.kind !== "seed" ||
      p.overrides?.advancement !== 3 ||
      p.overrides?.elimination !== 3 ||
      Object.keys(p.overrides?.rounds ?? {}).length ||
      JSON.stringify(p.tiebreakers) !==
        JSON.stringify(["record", "DS-wl-v1", "initialSeed"])
    )
      reject(
        422,
        "RULE_INVALID",
        "Major冻结参数必须为16队、3胜3负、8晋级及官方BO/排序配置。",
      );
  }
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
    reject(422, "ROSTER_INVALID", "瑞士入口必须完整且唯一。");
  const unit = {
    id: plan.groupId,
    stageId: plan.stageId,
    format: plan.format,
    ruleVersion: plan.ruleVersion,
    plan: structuredClone(plan),
    bindings: entries.map((e) => ({
      entrantId: e.entrantId,
      initialSeed: e.position,
      position: e.position,
      initialLosses: 0,
    })),
    entrants: entries.map((e) => e.entrantId),
    rule: {
      bestOf: plan.parameters.defaultBO,
      allowDraw: plan.parameters.allowDraw,
      allowPlayerDoubleLoss: plan.parameters.allowPlayerDoubleLoss,
    },
    rounds: [],
    standings: [],
    qualified: [],
    status: "running",
  };
  unit.standings = swissStandings(unit);
  activate(unit);
  return unit;
}
function finalizeSwiss(unit) {
  const expected = unit.plan.outputs.qualification.length,
    rows = threshold(unit)
      ? unit.standings.filter(
          (r) => r.wins >= unit.plan.parameters.winsToQualify,
        )
      : unit.standings.slice(0, expected);
  if (
    !threshold(unit) &&
    expected < unit.standings.length &&
    unit.standings[expected - 1].rank === unit.standings[expected].rank
  ) {
    unit.status = "ranking-blocked";
    return;
  }
  unit.qualified = rows.map((r, i) => ({
    entrantId: r.entrantId,
    channel: "qualification",
    index: i + 1,
  }));
  for (const r of unit.standings) {
    const q = unit.qualified.find((q) => q.entrantId === r.entrantId);
    if (q) r.qualification = { channel: q.channel, index: q.index };
  }
  if (rows.length !== expected)
    unit.qualificationMismatch = { expected, actual: rows.length };
  else delete unit.qualificationMismatch;
  unit.status = "completed";
}
function advanceSwiss(unit) {
  const round = unit.rounds.find((r) => !r.confirmed);
  if (!round) reject(409, "ROUND_LOCKED", "瑞士轮次已锁定或待配对裁定。");
  if (round.matches.some((m) => !m.decision))
    reject(409, "RESULTS_INCOMPLETE", "必须收齐当前瑞士轮全部裁定。");
  for (const m of round.matches.filter((m) => !m.bye)) {
    const d = m.decision,
      target = (m.bestOf + 1) / 2;
    if (d.kind === "double-loss") continue;
    if (
      d.kind !== "score" ||
      !Array.isArray(d.scores) ||
      d.scores.length !== 2 ||
      d.scores.some((s) => !Number.isSafeInteger(s) || s < 0)
    )
      reject(422, "RESULT_INVALID", "瑞士比分无效。");
    const [a, b] = d.scores;
    if (a === b) {
      if (!unit.rule.allowDraw || threshold(unit) || a * 2 > m.bestOf)
        reject(422, "RESULT_INVALID", "此瑞士轮不允许平局。");
    } else if (Math.max(a, b) !== target || Math.min(a, b) >= target)
      reject(422, "RESULT_INVALID", "比分不符合冻结BO。");
  }
  round.confirmed = true;
  unit.standings = swissStandings(unit);
  if (
    (threshold(unit) && activeRows(unit).length === 0) ||
    unit.rounds.length === unit.plan.windows.length
  )
    finalizeSwiss(unit);
  else activate(unit);
}
function validateManualPairing(unit, body) {
  const input = pairingInput(unit);
  if (unit.status !== "pairing-blocked")
    reject(409, "PAIRING_LOCKED", "当前轮无需配对裁定。");
  if (
    body.inputVersion !== unit.pairingInputVersion ||
    body.inputHash !== unit.pairingInputHash ||
    digest(input) !== body.inputHash
  )
    reject(409, "INPUT_CHANGED", "配对输入已变化，请重读后裁定。");
  const rows = activeRows(unit),
    ids = new Set(rows.map((r) => r.entrantId));
  if (input.first) {
    const expected = pair(unit, input);
    if (
      expected.status !== "ready" ||
      JSON.stringify(body.pairs) !== JSON.stringify(expected.pairs) ||
      (body.bye ?? null) !== expected.bye
    )
      reject(422, "PAIRING_INVALID", "人工裁定不能替换冻结的首轮配对表。");
  }
  if (
    !Array.isArray(body.pairs) ||
    body.pairs.length !== Math.floor(rows.length / 2) ||
    body.pairs.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some((id) => typeof id !== "string" || !ids.has(id)),
    )
  )
    reject(422, "PAIRING_INVALID", "需提交完整合法配对。");
  const bye = body.bye ?? null,
    participants = [...body.pairs.flat(), ...(bye === null ? [] : [bye])];
  if (
    participants.length !== rows.length ||
    new Set(participants).size !== rows.length ||
    participants.some((id) => !ids.has(id)) ||
    !!(rows.length % 2) !== (bye !== null) ||
    (bye !== null && rows.find((r) => r.entrantId === bye).byeCount)
  )
    reject(422, "PAIRING_INVALID", "重复或遗漏参赛身份，或轮空不符合资格。");
  const exception = major(unit)
    ? validateMajorDecision(input.rows, input, body.pairs, {
        allowRematch: body.allowRematch,
        reason: body.reason,
      })
    : { rematch: false };
  if (!major(unit) && body.allowRematch !== undefined)
    reject(422, "PAIRING_INVALID", "此配对版本不支持重赛例外。");
  for (const [a, b] of body.pairs)
    if (
      major(unit) &&
      (rows.find((r) => r.entrantId === a).wins !==
        rows.find((r) => r.entrantId === b).wins ||
        rows.find((r) => r.entrantId === a).losses !==
          rows.find((r) => r.entrantId === b).losses)
    )
      reject(422, "PAIRING_INVALID", "Major配对必须保留相同战绩组。");
  for (const [a, b] of body.pairs)
    if (
      !exception.rematch &&
      (rows.find((r) => r.entrantId === a).opponents.includes(b) ||
        rows.find((r) => r.entrantId === b).opponents.includes(a))
    )
      reject(422, "PAIRING_INVALID", "人工裁定不能放松禁止重赛。");
  return {
    status: "ready",
    pairs: structuredClone(body.pairs),
    bye,
    cost: null,
    nodes: 0,
    ...(major(unit) ? exception : {}),
  };
}
module.exports = {
  createSwissUnit,
  advanceSwiss,
  finalizeSwiss,
  pairingInput,
  applyPairing,
  validateManualPairing,
};
