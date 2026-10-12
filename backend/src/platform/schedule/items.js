"use strict";
const {
  seedSlots,
} = require("../../tournament-configuration/domain/formats/compile");
function positionTable(unit, channel) {
  const n = unit.inputs.find((p) => p.channel === channel)?.capacity ?? 0;
  if (
    [
      "fixed-swiss",
      "threshold-swiss",
      "round-robin",
      "double-round-robin",
    ].includes(unit.format) ||
    (unit.format === "double-elimination" &&
      channel === "lower" &&
      unit.parameters.lowerEntryMode === "half")
  )
    return Array.from({ length: n }, (_, i) => i + 1);
  if (
    unit.format === "single-elimination" &&
    unit.parameters.bracketMode === "segmented"
  ) {
    const q = unit.outputs.qualification.length,
      size = n / q;
    return Array.from({ length: q }, (_, i) =>
      seedSlots(size).map((p) => p + i * size),
    ).flat();
  }
  return seedSlots(n);
}
function buildItems(configuration, runtime) {
  if (runtime?.configurationId !== configuration.id) runtime = null;
  const plan = configuration.snapshot?.plan ?? runtime?.plan,
    actual = new Map(),
    actualUnits = new Map();
  for (const u of runtime?.units ?? []) {
    actualUnits.set(u.plan?.unitKey, u);
    for (const r of u.rounds)
      for (const m of r.matches)
        if (!m.bye)
          actual.set(m.planKey ?? m.id, {
            ...m,
            confirmed: r.confirmed,
            current: u.rounds.find((round) => !round.confirmed)?.id === r.id,
            unit: u,
            round: r,
          });
  }
  if (!plan)
    return [...actual].map(([key, m]) => ({
      planKey: key,
      matchId: m.id,
      current: !!m.current,
      actualStartedAt: m.actualStartedAt ?? null,
      kind: "match",
      known: true,
      entrants: m.entrants.filter(Boolean),
      dependencyKeys: [],
      stageId: m.unit.stageId,
      groupId: m.unit.id,
      round: m.round.number,
      waveNumber: m.round.number,
      started: !!(
        m.actualStartedAt ||
        m.confirmed ||
        m.decision ||
        m.submissions?.length
      ),
    }));
  const byKey = new Map(
      plan.units.flatMap((u) => u.matches.map((m) => [m.planKey, { m, u }])),
    ),
    memo = new Map();
  function unitSeats(u, visited) {
    return u.inputs.flatMap((p) =>
      Array.from({ length: p.capacity }, (_, i) =>
        source(
          { kind: "entrant", channel: p.channel, position: i + 1 },
          u,
          visited,
        ),
      ),
    );
  }
  function source(s, u, visited) {
    if (s.kind === "entrant") {
      const binding = actualUnits
        .get(u.unitKey)
        ?.bindings.find(
          (b) =>
            b.position === s.position &&
            (b.channel === s.channel || b.channel === undefined),
        );
      if (binding) return [binding.entrantId];
      const route = plan.connections.find((c) => {
        if (c.target.unitKey !== u.unitKey) return false;
        const channel =
          u.format === "double-elimination"
            ? c.target.port
            : u.inputs[0].channel;
        if (channel !== s.channel) return false;
        const table = positionTable(u, channel),
          formal = u.parameters.seeding.kind,
          position =
            c.placement?.kind === formal
              ? s.position
              : formal === "seed"
                ? table.indexOf(s.position) + 1
                : table[s.position - 1];
        return c.placement?.positions.includes(position);
      });
      if (route) return origin(route.source, visited);
      return ["entry:" + u.unitKey + ":" + s.channel + ":" + s.position];
    }
    if (s.matchKey) {
      const real = actual.get(s.matchKey),
        id =
          s.kind === "winner"
            ? real?.outcome?.winner
            : s.kind === "loser"
              ? real?.outcome?.loser
              : null;
      if (id && real.confirmed) return [id];
      return possible(s.matchKey, visited);
    }
    return unitSeats(u, visited);
  }
  function origin(ref, visited) {
    const key = ref.unitKey ?? "pool:" + ref.poolId;
    if (visited.has(key)) return [];
    const next = new Set([...visited, key]);
    if (ref.poolId)
      return plan.connections
        .filter((c) => c.target.poolId === ref.poolId)
        .flatMap((c) => origin(c.source, next));
    const u = plan.units.find((u) => u.unitKey === ref.unitKey);
    return u ? unitSeats(u, next) : [];
  }
  function possible(key, visited = new Set()) {
    const real = actual.get(key);
    if (real) return real.entrants.filter(Boolean);
    if (memo.has(key)) return memo.get(key);
    if (visited.has(key)) return [];
    const entry = byKey.get(key);
    if (!entry) return [];
    const next = new Set([...visited, key]),
      ids = [
        ...new Set(entry.m.sources.flatMap((s) => source(s, entry.u, next))),
      ];
    memo.set(key, ids);
    return ids;
  }
  function completion(ref, visited = new Set()) {
    const key = ref.unitKey ?? "pool:" + ref.poolId;
    if (visited.has(key)) return [];
    const next = new Set([...visited, key]);
    if (ref.poolId)
      return plan.connections
        .filter((c) => c.target.poolId === ref.poolId)
        .flatMap((c) => completion(c.source, next));
    const u = plan.units.find((u) => u.unitKey === ref.unitKey);
    if (!u) return [];
    const active = actualUnits.get(u.unitKey);
    if (u.windows.length)
      return active?.status === "completed"
        ? active.rounds
            .filter((r) => r.confirmed)
            .slice(-1)
            .map((r) => r.planKey)
        : u.windows.slice(-1).map((w) => w.planKey);
    return u.matches
      .filter(
        (m) =>
          !(
            m.condition &&
            active?.status === "completed" &&
            !actual.has(m.planKey)
          ),
      )
      .map((m) => m.planKey);
  }
  function stageDependencies(u) {
    // All source groups for the target stage must be ready before the joint
    // allocation starts any of its groups, including later direct invites.
    const targetKeys = new Set(
      plan.units.filter((v) => v.stageId === u.stageId).map((v) => v.unitKey),
    );
    return [
      ...new Set(
        plan.connections
          .filter((c) => targetKeys.has(c.target.unitKey))
          .flatMap((c) => completion(c.source)),
      ),
    ];
  }
  const items = [];
  for (const u of plan.units) {
    for (const m of u.matches) {
      const real = actual.get(m.planKey);
      items.push({
        ...m,
        dependencyKeys: [
          ...new Set([
            ...m.dependencyKeys,
            ...(m.sources.some((s) => s.kind === "entrant")
              ? stageDependencies(u)
              : []),
          ]),
        ],
        kind: "match",
        waveNumber:
          u.waves.find((w) => w.matches.includes(m.planKey))?.number ?? m.round,
        groupId: u.groupId,
        stageId: u.stageId,
        format: u.format,
        known: !!real,
        entrants: possible(m.planKey),
        matchId: real?.id,
        current: !!real?.current,
        actualStartedAt: real?.actualStartedAt ?? null,
        inactive:
          !!m.condition &&
          actualUnits.get(u.unitKey)?.status === "completed" &&
          !real,
        started: !!(
          real?.actualStartedAt ||
          real?.confirmed ||
          real?.decision ||
          real?.submissions?.length
        ),
      });
    }
    for (const w of u.windows) {
      const round = actualUnits
        .get(u.unitKey)
        ?.rounds.find((r) => r.planKey === w.planKey);
      items.push({
        ...w,
        kind: "window",
        waveNumber: w.round,
        groupId: u.groupId,
        stageId: u.stageId,
        format: u.format,
        known: !!round,
        inactive: actualUnits.get(u.unitKey)?.status === "completed" && !round,
        entrants: [],
        dependencyKeys: w.previousWindowKey
          ? [w.previousWindowKey]
          : stageDependencies(u),
        started:
          !!round &&
          (round.confirmed ||
            round.matches.some(
              (m) =>
                !m.bye &&
                (m.actualStartedAt || m.decision || m.submissions?.length),
            )),
      });
    }
  }
  for (const [key, m] of actual)
    if (!byKey.has(key))
      items.push({
        planKey: key,
        kind: "match",
        matchId: m.id,
        current: !!m.current,
        actualStartedAt: m.actualStartedAt ?? null,
        groupId: m.unit.id,
        stageId: m.unit.stageId,
        format: m.unit.format,
        round: m.round.number,
        waveNumber: m.round.number,
        index: m.round.matches.findIndex((a) => a.id === m.id) + 1,
        known: true,
        entrants: m.entrants.filter(Boolean),
        windowKey: m.round.planKey,
        dependencyKeys: m.unit.plan?.windows.find(
          (w) => w.planKey === m.round.planKey,
        )?.previousWindowKey
          ? [
              m.unit.plan.windows.find((w) => w.planKey === m.round.planKey)
                .previousWindowKey,
            ]
          : [],
        started: !!(
          m.actualStartedAt ||
          m.confirmed ||
          m.decision ||
          m.submissions?.length
        ),
      });
  return items;
}
module.exports = { buildItems };
