"use strict";
const { parseStructure, ConfigurationError } = require("../structure");
const { validateStructure } = require("../validation");
const { definition } = require("./registry");
const outcome = (kind, m) => ({ kind, matchKey: m.planKey });
const winner = (m) => outcome("winner", m),
  loser = (m) => outcome("loser", m);
const encodePart = (value) =>
  encodeURIComponent(JSON.stringify(String(value))).slice(3, -3);
function seedSlots(n) {
  let a = [1, 2];
  while (a.length < n) a = a.flatMap((x) => [x, a.length * 2 + 1 - x]);
  return a;
}
function compileUnit(stage, group, configurationId) {
  const key = (role, round, index) =>
    "plan-v2/" +
    [configurationId, group.id, role, round, index].map(encodePart).join("/");
  const unitKey = key("unit", 0, 0),
    n = stage.groupSize,
    q = stage.qualifyCount,
    p = stage.parameters;
  const unit = {
    unitKey,
    stageId: stage.id,
    groupId: group.id,
    format: stage.format,
    ruleVersion: stage.ruleVersion,
    parameters: structuredClone(p),
    inputs: [],
    outputs: { qualification: [], rank: [] },
    matches: [],
    windows: [],
    waves: [],
    confirmationProfile: definition(stage.ruleVersion).confirmationProfile,
  };
  const byKey = new Map(),
    counts = new Map();
  const entrant = (position, channel = p.seeding.kind) => ({
    kind: "entrant",
    unitKey,
    channel,
    position,
    initialLosses: channel === "lower" ? 1 : 0,
  });
  function add(role, round, sources, options = {}) {
    const countKey = role + "/" + round,
      index = (counts.get(countKey) || 0) + 1;
    counts.set(countKey, index);
    const dependencyKeys = [
      ...new Set([
        ...sources.filter((s) => s.matchKey).map((s) => s.matchKey),
        ...(options.condition ? [options.condition.matchKey] : []),
      ]),
    ];
    const wave =
      options.wave ??
      1 + Math.max(0, ...dependencyKeys.map((k) => byKey.get(k).wave));
    const m = {
      planKey: key(role, round, index),
      role,
      round,
      index,
      sources,
      dependencyKeys,
      wave,
      bestOf:
        p.overrides?.[role === "lowerPreliminary" ? "lower" : role] ??
        p.overrides?.rounds?.[String(round)] ??
        p.defaultBO,
      condition: options.condition ?? null,
    };
    unit.matches.push(m);
    byKey.set(m.planKey, m);
    return m;
  }
  function pairs(sources, role, round) {
    return Array.from({ length: sources.length / 2 }, (_, i) =>
      add(role, round, sources.slice(i * 2, i * 2 + 2)),
    );
  }
  function seeds(size, channel = p.seeding.kind, offset = 0) {
    return (
      p.seeding.kind === "slot"
        ? Array.from({ length: size }, (_, i) => i + 1)
        : seedSlots(size)
    ).map((i) => entrant(i + offset, channel));
  }
  function qualify(sources, channels) {
    const indices = new Map();
    unit.outputs.qualification = sources.map((source, i) => {
      const channel = channels?.[i] ?? "qualification",
        index = (indices.get(channel) || 0) + 1;
      indices.set(channel, index);
      return { kind: "qualification", unitKey, channel, index, source };
    });
  }
  if (stage.format === "double-elimination") {
    unit.inputs = [
      {
        channel: "upper",
        capacity: n,
        positionKind: p.seeding.kind,
        initialLosses: 0,
      },
    ];
    const lowerSize =
      p.lowerEntryMode === "same" ? n : p.lowerEntryMode === "half" ? n / 2 : 0;
    if (lowerSize)
      unit.inputs.push({
        channel: "lower",
        capacity: lowerSize,
        positionKind: p.seeding.kind,
        initialLosses: 1,
      });
  } else
    unit.inputs = [
      {
        channel: p.seeding.kind,
        capacity: n,
        positionKind: p.seeding.kind,
        initialLosses: 0,
      },
    ];
  if (stage.ruleVersion === "single-cut-v2") {
    const treeSize = n / q,
      trees =
        p.bracketMode === "complete"
          ? [seeds(n)]
          : Array.from({ length: q }, (_, i) =>
              seeds(treeSize, p.seeding.kind, i * treeSize),
            );
    let finalRound = [];
    for (let r = 1; r <= Math.log2(treeSize); r++) {
      finalRound = trees.flatMap((sources, i) => {
        const m = pairs(
          sources,
          r === Math.log2(treeSize) && q === 1 ? "final" : "elimination",
          r,
        );
        trees[i] = m.map(winner);
        return m;
      });
    }
    qualify(trees.flat());
    if (q === 1) {
      unit.outputs.rank = [winner(finalRound[0]), loser(finalRound[0])];
      const semis = unit.matches.filter(
        (m) => m.round === Math.log2(treeSize) - 1,
      );
      if (p.thirdPlace) {
        const third = add("thirdPlace", Math.log2(treeSize), semis.map(loser));
        unit.outputs.rank.push(winner(third), loser(third));
      } else if (n >= 4)
        unit.outputs.tiedRanks = [{ rank: 3, sources: semis.map(loser) }];
    }
  } else if (stage.ruleVersion === "gsl-classic-v1") {
    const opening = seeds(4);
    const a = add("opening", 1, opening.slice(0, 2)),
      b = add("opening", 1, opening.slice(2, 4));
    const c = add("winners", 2, [winner(a), winner(b)]),
      d = add("elimination", 2, [loser(a), loser(b)]);
    const e = add("decider", 3, [loser(c), winner(d)]);
    unit.outputs.rank = [winner(c), winner(e), loser(e), loser(d)];
    qualify(unit.outputs.rank.slice(0, 2));
  } else if (stage.format === "double-elimination") {
    const upperRounds = [];
    let u = seeds(n, "upper");
    for (let r = 1; u.length > 1; r++) {
      const m = pairs(u, "upper", r);
      upperRounds.push(m);
      u = m.map(winner);
    }
    const drops = upperRounds.map((ms) => ms.map(loser));
    let lbRound = 1,
      live;
    const l = unit.inputs.find((i) => i.channel === "lower")?.capacity ?? 0;
    if (l) {
      let direct =
        l === n
          ? pairs(seeds(l, "lower"), "lowerPreliminary", 1).map(winner)
          : Array.from({ length: l }, (_, i) => entrant(i + 1, "lower"));
      live = drops[0].map((d, i) =>
        winner(add("lower", lbRound, [d, direct[i]])),
      );
      lbRound++;
      if (live.length > 1) {
        live = pairs(live, "lower", lbRound).map(winner);
        lbRound++;
      }
    } else if (n === 2) live = drops[0];
    else {
      live = pairs(drops[0], "lower", lbRound).map(winner);
      lbRound++;
    }
    for (let r = 1; r < upperRounds.length; r++) {
      const d = drops[r];
      if (r === upperRounds.length - 1 && q === 3) {
        live = [...live, ...d];
        break;
      }
      live = live.map((s, i) =>
        winner(add("lower", lbRound, [s, d[d.length > 1 ? i ^ 1 : i]])),
      );
      lbRound++;
      if (r < upperRounds.length - 1) {
        live = pairs(live, "lower", lbRound).map(winner);
        lbRound++;
      }
    }
    if (q > 1) qualify([...u, ...live], ["upper", ...live.map(() => "lower")]);
    else {
      const gf = add("final", 1, [u[0], live[0]]);
      if (p.finalReset) {
        const reset = add("final", 2, [...gf.sources], {
          condition: { kind: "winner-side", matchKey: gf.planKey, side: 1 },
        });
        qualify([
          {
            kind: "conditional",
            condition: reset.condition,
            whenTrue: winner(reset),
            whenFalse: winner(gf),
          },
        ]);
        unit.outputs.rank = [
          unit.outputs.qualification[0].source,
          {
            kind: "conditional",
            condition: reset.condition,
            whenTrue: loser(reset),
            whenFalse: loser(gf),
          },
        ];
      } else {
        qualify([winner(gf)]);
        unit.outputs.rank = [winner(gf), loser(gf)];
      }
    }
  } else if (
    stage.format === "fixed-swiss" ||
    stage.format === "threshold-swiss"
  ) {
    const ti = stage.ruleVersion === "ti2026-observed-candidate-v1";
    const count = ti
      ? p.roundCount + 1
      : stage.format === "fixed-swiss"
        ? p.roundCount
        : p.winsToQualify + p.lossesToEliminate - 1;
    unit.windows = Array.from({ length: count }, (_, i) => ({
      planKey: key("window", i + 1, 0),
      round: i + 1,
      ...(ti ? { phase: i < p.roundCount ? "swiss" : "elimination" } : {}),
      source: {
        kind:
          ti && i === p.roundCount
            ? "pendingEliminationRound"
            : "pendingSwissRound",
        unitKey,
        round: i + 1,
      },
      previousWindowKey: i ? key("window", i, 0) : null,
    }));
    qualify(
      Array.from({ length: q }, (_, i) =>
        ti
          ? {
              kind: "selectedStanding",
              unitKey,
              channel: "qualification",
              index: i + 1,
            }
          : {
              kind: "standing",
              unitKey,
              rank: i + 1,
            },
      ),
    );
  } else if (
    stage.format === "round-robin" ||
    stage.format === "double-round-robin"
  ) {
    const ring = Array.from({ length: n }, (_, i) => i + 1);
    if (n % 2) ring.push(null);
    const first = [];
    for (let r = 1; r < ring.length; r++) {
      const ms = [];
      for (let i = 0; i < ring.length / 2; i++) {
        const a = ring[i],
          b = ring[ring.length - 1 - i];
        if (a && b)
          ms.push(add("roundRobin", r, [entrant(a), entrant(b)], { wave: r }));
      }
      first.push(ms);
      ring.splice(1, 0, ring.pop());
    }
    if (p.cycleCount === 2)
      first.forEach((ms, i) =>
        ms.forEach((m) =>
          add("roundRobin", first.length + i + 1, [...m.sources].reverse(), {
            wave: first.length + i + 1,
          }),
        ),
      );
    qualify(
      Array.from({ length: q }, (_, i) => ({
        kind: "standing",
        unitKey,
        rank: i + 1,
      })),
    );
  } else
    throw new ConfigurationError(
      "CONFIG_COMPILATION_UNAVAILABLE",
      "此规则没有完整比赛图编译器",
    );
  unit.waves = Array.from(
    { length: Math.max(0, ...unit.matches.map((m) => m.wave)) },
    (_, i) => ({
      planKey: key("wave", i + 1, 0),
      number: i + 1,
      previousWaveKey: i ? key("wave", i, 0) : null,
      requiresAllDecisions: true,
      conditionalPolicy: "active-matches-only",
      matches: unit.matches
        .filter((m) => m.wave === i + 1)
        .map((m) => m.planKey),
    }),
  );
  unit.inputs.forEach((input) => {
    input.placementPorts = ["seed", "slot"];
  });
  return unit;
}
function compile(input, { configurationId, tournamentId } = {}) {
  if (typeof configurationId !== "string" || !configurationId.trim())
    throw new ConfigurationError("INVALID_INPUT", "编译必须绑定配置ID");
  const structure = parseStructure(input, tournamentId);
  if (structure.structureVersion !== "structure-v2")
    throw new ConfigurationError("INVALID_INPUT", "编译契约只用于v2");
  const report = validateStructure(structure, tournamentId);
  if (!report.structureValid)
    throw new ConfigurationError(
      "CONFIG_INVALID",
      "结构校验失败",
      report.diagnostics,
    );
  const units = structure.stages.flatMap((stage) =>
    stage.groups.map((group) => compileUnit(stage, group, configurationId)),
  );
  const { sourcePort, targetPort } = require("../routing-v2");
  const reference = (ref, side, placement) =>
    ref.poolId
      ? {
          kind: "pool",
          poolId: ref.poolId,
          port: side === "source" ? "seed" : "pool",
        }
      : {
          kind: "unit",
          unitKey: units.find((u) => u.groupId === ref.groupId).unitKey,
          port:
            side === "source"
              ? sourcePort(ref)
              : targetPort(
                  ref,
                  structure.stages.find((s) => s.id === ref.stageId),
                  placement,
                ),
        };
  return {
    version: "compiled-plan-v2",
    configurationId,
    units,
    connections: structure.routes.map((r) => ({
      planKey:
        "plan-v2/" + encodePart(configurationId) + "/route/" + encodePart(r.id),
      routeId: r.id,
      source: reference(r.source, "source"),
      target: reference(r.target, "target", r.placement),
      selector: structuredClone(r.selector),
      quota: r.quota,
      sort: structuredClone(r.sort),
      ...(r.placement ? { placement: structuredClone(r.placement) } : {}),
    })),
  };
}
module.exports = { compile, seedSlots };
