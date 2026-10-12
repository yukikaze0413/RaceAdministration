"use strict";
const { reject } = require("../../http/errors");
const { observedTiStandings } = require("./ti-standings");
// Unregistered research candidate. Total absolute ranking distance is an
// engineering interpretation of prose, not a published official algorithm.
// Equally optimal choices are returned for adjudication, never broken by UUID.
function tiPairingCandidate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    reject(422, "RULE_INVALID", "TI候选配对输入无效。");
  const {
    entrantIds,
    initialGroups,
    firstPairing,
    confirmedSeries,
    round,
    nodeBudget = 250000,
  } = input;
  if (
    !Number.isInteger(round) ||
    round < 1 ||
    round > 5 ||
    !Number.isInteger(nodeBudget) ||
    nodeBudget < 1 ||
    nodeBudget > 250000
  )
    reject(422, "RULE_INVALID", "TI候选配对轮次或预算无效。");
  const standings = observedTiStandings(entrantIds, confirmedSeries);
  const byId = new Map(standings.rows.map((r) => [r.entrantId, r]));
  if (
    !Array.isArray(initialGroups) ||
    initialGroups.length !== 16 ||
    initialGroups.some(
      (g) =>
        !g || !byId.has(g.entrantId) || !["A", "B"].includes(g.initialGroup),
    ) ||
    new Set(initialGroups.map((g) => g.entrantId)).size !== 16 ||
    initialGroups.filter((g) => g.initialGroup === "A").length !== 8
  )
    reject(422, "ROSTER_INVALID", "TI候选需要完整、唯一的两个8队初始组。");
  const groupOf = new Map(
    initialGroups.map((g) => [g.entrantId, g.initialGroup]),
  );
  const active = standings.rows.filter((r) => r.wins < 4 && r.losses < 4);
  if (
    active.length !== [16, 16, 16, 16, 14][round - 1] ||
    standings.rows.some((r) => r.wins + r.losses > round - 1) ||
    active.some((r) => r.wins + r.losses !== round - 1)
  )
    reject(422, "ROSTER_INVALID", "TI候选名单与已确认轮次历史不一致。");
  const base = {
    version: "ti2026-distance-candidate-v1",
    formulaStatus: "observed-inference",
    round,
  };
  if (round === 1) {
    if (
      !Array.isArray(firstPairing) ||
      firstPairing.length !== 8 ||
      firstPairing.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((id) => !byId.has(id)) ||
          groupOf.get(p[0]) !== groupOf.get(p[1]),
      ) ||
      new Set(firstPairing.flat()).size !== 16
    )
      reject(422, "PAIRING_INVALID", "TI首轮必须提供完整的同组组织者配对表。");
    return {
      ...base,
      status: "ready",
      pairs: structuredClone(firstPairing),
      minimumRepeats: 0,
      distance: null,
      choiceCount: 1,
      nodes: 0,
      bandChoices: [],
    };
  }
  const tiedGroups = standings.tiedGroups.filter((g) =>
    g.some((id) => active.some((r) => r.entrantId === id)),
  );
  if (tiedGroups.length)
    return {
      ...base,
      status: "ranking-blocked",
      code: "TI_COIN_TOSS_REQUIRED",
      tiedGroups,
    };
  const bands = new Map();
  for (const row of active) {
    const key =
      `${row.wins}:${row.losses}` +
      (round <= 3 ? `:${groupOf.get(row.entrantId)}` : "");
    if (!bands.has(key)) bands.set(key, []);
    bands.get(key).push(row.entrantId);
  }
  let nodes = 0,
    limited = false,
    minimumRepeats = 0,
    distance = 0,
    choiceCount = 1;
  const bandChoices = [];
  for (const [key, names] of bands) {
    const first = byId.get(names[0]);
    const maximize = round === 5 && first.losses === 3;
    let bestRepeats = Infinity,
      bestCost = Infinity,
      optimalCount = 0,
      choices = [];
    function visit(remaining, pairs, repeats, separation) {
      if (++nodes > nodeBudget) {
        limited = true;
        return;
      }
      if (!remaining.length) {
        const cost = maximize ? -separation : separation;
        if (
          repeats < bestRepeats ||
          (repeats === bestRepeats && cost < bestCost)
        ) {
          bestRepeats = repeats;
          bestCost = cost;
          optimalCount = 0;
          choices = [];
        }
        if (repeats === bestRepeats && cost === bestCost) {
          optimalCount++;
          if (choices.length < 256) choices.push(pairs);
        }
        return;
      }
      const a = remaining[0];
      for (let i = 1; i < remaining.length; i++) {
        const b = remaining[i];
        if (round === 4 && groupOf.get(a) === groupOf.get(b)) continue;
        const repeat = Number(byId.get(a).opponents.includes(b));
        if (repeats + repeat > bestRepeats) continue;
        visit(
          remaining.slice(1, i).concat(remaining.slice(i + 1)),
          [...pairs, [a, b]],
          repeats + repeat,
          separation + Math.abs(byId.get(a).rank - byId.get(b).rank),
        );
        if (limited) return;
      }
    }
    visit(names, [], 0, 0);
    if (limited)
      return {
        ...base,
        status: "solver-limit",
        code: "PAIRING_SOLVER_LIMIT",
        nodes,
      };
    if (!optimalCount)
      return {
        ...base,
        status: "unsat",
        code: "TI_GROUP_PAIRING_UNSAT",
        nodes,
      };
    minimumRepeats += bestRepeats;
    distance += Math.abs(bestCost);
    choiceCount *= optimalCount;
    bandChoices.push({
      key,
      record: [first.wins, first.losses],
      entrantIds: names,
      direction: maximize ? "maximize" : "minimize",
      minimumRepeats: bestRepeats,
      optimalDistance: Math.abs(bestCost),
      optimalCount,
      truncated: optimalCount > choices.length,
      pairings: choices,
    });
  }
  const status = minimumRepeats
    ? "rematch-approval-required"
    : choiceCount > 1
      ? "pairing-choice-required"
      : "ready";
  return {
    ...base,
    status,
    minimumRepeats,
    distance,
    choiceCount,
    nodes,
    bandChoices,
    ...(status === "ready"
      ? { pairs: bandChoices.flatMap((band) => band.pairings[0]) }
      : {}),
  };
}
module.exports = { tiPairingCandidate };
