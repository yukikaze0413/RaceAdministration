export type PlanNode = {
  id: string;
  kind: "match" | "window" | "input" | "output" | "group" | "pool";
  title: string;
  sources: string[];
  status: string;
  x: number;
  y: number;
  width: number;
  height: number;
  actual?: any;
  condition?: any;
  unit?: any;
  bestOf?: number;
};
export type PlanEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: string;
};
export const inputKey = (u: any, channel: string) =>
  u.unitKey + "/input/" + channel;
export const outputKey = (u: any, q: any) =>
  u.unitKey + "/output/" + q.channel + "/" + q.index;
export function knownPlanIds(plan: any, runtime?: any) {
  const ids = new Set<string>();
  for (const u of plan.units) {
    ids.add(u.groupId);
    ids.add(u.unitKey);
    [...u.matches, ...u.windows, ...u.waves].forEach((n) => ids.add(n.planKey));
    u.inputs.forEach((p: any) => ids.add(inputKey(u, p.channel)));
    u.outputs.qualification.forEach((q: any) => ids.add(outputKey(u, q)));
  }
  if (runtime?.configurationId === plan.configurationId)
    runtime.units.forEach((u: any) =>
      u.rounds.forEach((r: any) =>
        r.matches.forEach((m: any) => {
          if (m.planKey) ids.add(m.planKey);
        }),
      ),
    );
  return [...ids];
}
const roleNames: Record<string, string> = {
  upper: "胜者组",
  lower: "败者组",
  lowerPreliminary: "败者预选",
  final: "决赛",
  thirdPlace: "季军战",
  opening: "首轮",
  winners: "胜者战",
  elimination: "淘汰战",
  decider: "出线战",
  roundRobin: "循环对局",
};
const title = (m: any) =>
  `${roleNames[m.role] ?? "比赛"} · 第${m.round}轮第${m.index}场`;
function slots(n: number) {
  let a = [1, 2];
  while (a.length < n) a = a.flatMap((x) => [x, a.length * 2 + 1 - x]);
  return a;
}
function table(u: any, channel: string) {
  const n = u.inputs.find((i: any) => i.channel === channel)?.capacity ?? 0;
  if (
    [
      "fixed-swiss",
      "threshold-swiss",
      "round-robin",
      "double-round-robin",
    ].includes(u.format) ||
    (u.format === "double-elimination" &&
      channel === "lower" &&
      u.parameters.lowerEntryMode === "half")
  )
    return Array.from({ length: n }, (_, i) => i + 1);
  if (
    u.format === "single-elimination" &&
    u.parameters.bracketMode === "segmented"
  ) {
    const q = u.outputs.qualification.length,
      size = n / q;
    return Array.from({ length: q }, (_, i) =>
      slots(size).map((x) => x + i * size),
    ).flat();
  }
  return slots(n);
}
function unitName(u: any, structure: any) {
  const stage = structure.stages.find((s: any) => s.id === u.stageId),
    index = stage?.groups.findIndex((g: any) => g.id === u.groupId) ?? 0;
  return `${stage?.name ?? "阶段"} · 小组${index + 1}`;
}
export function unitGraph(unit: any, plan: any, structure: any, runtime?: any) {
  const nodes: PlanNode[] = [],
    edges: PlanEdge[] = [],
    byKey = new Map<string, PlanNode>();
  const actualUnit = runtime?.units?.find(
      (u: any) => u.plan?.unitKey === unit.unitKey,
    ),
    actualMatches = actualUnit?.rounds.flatMap((r: any) => r.matches) ?? [];
  const name = (id: string) =>
    runtime?.roster.find((r: any) => r.entrantId === id)?.name ?? "未知参赛者";
  const add = (node: PlanNode) => {
    nodes.push(node);
    byKey.set(node.id, node);
  };
  function sourceLabel(s: any): string {
    if (s.kind === "entrant") {
      const binding = actualUnit?.bindings.find(
        (b: any) =>
          b.position === s.position &&
          (b.channel === s.channel || b.channel === undefined),
      );
      if (binding) return name(binding.entrantId);
      const connection = plan.connections.find((c: any) => {
        if (c.target.unitKey !== unit.unitKey) return false;
        const channel =
          unit.format === "double-elimination"
            ? c.target.port
            : unit.inputs[0].channel;
        if (channel !== s.channel) return false;
        const kind = c.placement?.kind,
          formal = unit.parameters.seeding.kind,
          t = table(unit, channel);
        const position =
          kind === formal
            ? s.position
            : formal === "seed"
              ? t.indexOf(s.position) + 1
              : t[s.position - 1];
        return c.placement?.positions.includes(position);
      });
      if (connection) {
        const origin = plan.units.find(
            (u: any) => u.unitKey === connection.source.unitKey,
          ),
          channel =
            unit.format === "double-elimination"
              ? connection.target.port
              : unit.inputs[0].channel,
          t = table(unit, channel),
          kind = connection.placement.kind,
          formal = unit.parameters.seeding.kind,
          position =
            kind === formal
              ? s.position
              : formal === "seed"
                ? t.indexOf(s.position) + 1
                : t[s.position - 1],
          index =
            connection.placement.positions.indexOf(position) +
            (connection.selector.from ?? 1);
        const originLabel = origin
          ? unitName(origin, structure)
          : `选手池${structure.pools.findIndex((p: any) => p.id === connection.source.poolId) + 1}`;
        if (connection.quota === 1 && connection.selector.kind === "rankRange")
          return `${originLabel} · ${connection.source.port === "rank" ? "名次" : "晋级名额"}${index}`;
        const selector = connection.selector,
          range =
            selector.kind === "rankRange"
              ? `${connection.source.port === "rank" ? "名次" : "晋级"}范围${selector.from}–${selector.to}`
              : selector.kind === "recordEquals"
                ? `${selector.wins}胜${selector.losses}负条件名额`
                : "全量名额";
        return `${originLabel} · ${range} · 排序后席位${connection.placement.positions.indexOf(position) + 1}`;
      }
      return `${({ upper: "胜者入口", lower: "败者直接入口", seed: "本组种子", slot: "本组席位" } as Record<string, string>)[s.channel] ?? "入口"}${s.position}`;
    }
    if (s.kind === "standing") return `最终排名第${s.rank}名`;
    if (s.kind === "selectedStanding") return `附加淘汰赛后资格第${s.index}位`;
    if (s.kind === "conditional") return "条件决赛胜者（按激活结果）";
    const match = unit.matches.find((m: any) => m.planKey === s.matchKey),
      actual = actualMatches.find((m: any) => m.planKey === s.matchKey);
    const id =
      s.kind === "winner" ? actual?.outcome?.winner : actual?.outcome?.loser;
    return id
      ? name(id)
      : `${match ? title(match) : "前置比赛"}${s.kind === "loser" ? "败者" : "胜者"}`;
  }
  const de = unit.format === "double-elimination",
    upperRows = Math.max(
      1,
      ...unit.waves.map(
        (w: any) =>
          w.matches.filter(
            (key: string) =>
              unit.matches.find((m: any) => m.planKey === key)?.role ===
              "upper",
          ).length,
      ),
    ),
    lowerRows = Math.max(
      1,
      ...unit.waves.map(
        (w: any) =>
          w.matches.filter((key: string) =>
            ["lower", "lowerPreliminary"].includes(
              unit.matches.find((m: any) => m.planKey === key)?.role,
            ),
          ).length,
      ),
    );
  unit.inputs.forEach((input: any, i: number) =>
    add({
      id: inputKey(unit, input.channel),
      kind: "input",
      title: `${({ upper: "胜者入口", lower: "败者直接入口", seed: "种子入口", slot: "绝对席位入口" } as Record<string, string>)[input.channel]}（${input.capacity}人）`,
      sources: input.initialLosses ? ["初始已有一败；实际比分从0场开始"] : [],
      status: "入口",
      x: 20,
      y:
        de && input.channel === "lower"
          ? 40 + upperRows * 200 + 180
          : 40 + i * 200,
      width: 250,
      height: 160,
    }),
  );
  for (const wave of unit.waves) {
    const occupied: Record<string, number[]> = {};
    for (const key of wave.matches) {
      const m = unit.matches.find((m: any) => m.planKey === key),
        zone = de
          ? m.role === "upper"
            ? "upper"
            : m.role === "final"
              ? "final"
              : "lower"
          : "main",
        ys = occupied[zone] ?? (occupied[zone] = []);
      const parents = m.dependencyKeys
        .map((id: string) => byKey.get(id))
        .filter(Boolean) as PlanNode[];
      let y = de
        ? (zone === "upper"
            ? 40
            : zone === "lower"
              ? 40 + upperRows * 200 + 180
              : 40 + (upperRows + lowerRows) * 200 + 360) +
          ys.length * 200
        : parents.length
          ? parents.reduce((sum: number, n: PlanNode) => sum + n.y, 0) /
            parents.length
          : 40 + ys.length * 200;
      while (ys.some((old) => Math.abs(old - y) < 200)) y += 200;
      ys.push(y);
      const actual = actualMatches.find((a: any) => a.planKey === m.planKey),
        confirmed = actualUnit?.rounds.find((r: any) =>
          r.matches.some((a: any) => a.planKey === m.planKey),
        )?.confirmed;
      const status = actual
        ? confirmed
          ? "已确认"
          : actual.decision
            ? "已裁定"
            : "待比赛"
        : m.condition
          ? actualUnit?.status === "completed"
            ? "条件未满足，未激活"
            : "条件决赛，尚未激活"
          : "未来比赛";
      add({
        id: m.planKey,
        kind: "match",
        title: title(m),
        sources: actual
          ? actual.entrants.map(name)
          : m.sources.map(sourceLabel),
        status,
        x: wave.number * 300 + 20,
        y,
        width: 250,
        height: 160,
        actual,
        condition: m.condition,
        bestOf: m.bestOf,
      });
      m.sources.forEach((s: any, i: number) =>
        edges.push({
          id: m.planKey + "/source/" + i,
          from: s.matchKey ?? inputKey(unit, s.channel),
          to: m.planKey,
          label:
            s.kind === "winner" ? "胜者" : s.kind === "loser" ? "败者" : "入口",
          kind: s.kind,
        }),
      );
      if (m.condition)
        edges.push({
          id: m.planKey + "/condition",
          from: m.condition.matchKey,
          to: m.planKey,
          label: "败者冠军胜时激活",
          kind: "condition",
        });
    }
  }
  unit.windows.forEach((window: any, i: number) => {
    const round = actualUnit?.rounds.find(
        (r: any) => r.planKey === window.planKey,
      ),
      ended = actualUnit?.status === "completed" && !round;
    add({
      id: window.planKey,
      kind: "window",
      title:
        window.phase === "elimination"
          ? "附加淘汰赛"
          : `第${window.round}瑞士轮`,
      sources: [],
      status: round
        ? round.confirmed
          ? "已确认配对"
          : "已生成配对"
        : ended
          ? "阶段已结束，窗口未使用"
          : "待配对窗口",
      x: (i + 1) * 300 + 20,
      y: 40,
      width: 250,
      height: 160,
    });
    if (window.previousWindowKey)
      edges.push({
        id: window.planKey + "/previous",
        from: window.previousWindowKey,
        to: window.planKey,
        label:
          window.phase === "elimination"
            ? "瑞士赛确认后选择对手"
            : "确认前轮后配对",
        kind: "window",
      });
    round?.matches.forEach((m: any, index: number) =>
      add({
        id: m.planKey,
        kind: "match",
        title:
          window.phase === "elimination"
            ? `附加淘汰赛第${index + 1}场`
            : `第${window.round}轮第${index + 1}场`,
        sources: m.entrants.map((id: string, side: number) => {
          if (!id) return "轮空（无虚假比分）";
          const record = m.pairingRecords?.[side];
          return (
            name(id) +
            (record
              ? ` · 配对前${record.wins}胜${record.losses}负 · ${record.points}分`
              : "")
          );
        }),
        status: round.confirmed ? "已确认" : m.decision ? "已裁定" : "待比赛",
        x: (i + 1) * 300 + 20,
        y: 240 + index * 200,
        width: 250,
        height: 160,
        actual: m,
        bestOf: m.bestOf,
      }),
    );
  });
  const last = Math.max(
    0,
    ...unit.waves.map((w: any) => w.number),
    unit.windows.length,
  );
  unit.outputs.qualification.forEach((q: any, i: number) => {
    const actual = actualUnit?.qualified?.find(
        (a: any) => a.channel === q.channel && a.index === q.index,
      ),
      id = outputKey(unit, q);
    add({
      id,
      kind: "output",
      title: `${q.channel === "upper" ? "胜者" : q.channel === "lower" ? "败者" : "资格"}出口${q.index}`,
      sources: [actual ? name(actual.entrantId) : sourceLabel(q.source)],
      status: actual ? "晋级已确定" : "等待前置结果",
      x: (last + 1) * 300 + 20,
      y: 40 + i * 200,
      width: 250,
      height: 160,
    });
    if (q.source.matchKey)
      edges.push({
        id: id + "/source",
        from: q.source.matchKey,
        to: id,
        label: q.source.kind === "loser" ? "败者" : "胜者",
        kind: q.source.kind,
      });
  });
  return {
    nodes,
    edges: edges.filter((e) => byKey.has(e.from) && byKey.has(e.to)),
    title: unitName(unit, structure),
    format: unit.format,
  };
}
export function overviewGraph(structure: any, plan: any) {
  const nodes: PlanNode[] = [],
    edges: PlanEdge[] = [];
  const stages = [...structure.stages].sort(
    (a: any, b: any) => a.order - b.order,
  );
  for (const [i, stage] of stages.entries())
    stage.groups.forEach((g: any, j: number) => {
      const unit = plan?.units.find((u: any) => u.groupId === g.id);
      nodes.push({
        id: g.id,
        kind: "group",
        title: `${stage.name} · 小组${j + 1}`,
        sources: [`${stage.groupSize}人 → ${stage.qualifyCount}人`],
        status: "阶段小组",
        x: 20 + i * 360,
        y: 40 + j * 260,
        width: 300,
        height: 220,
        unit,
      });
    });
  structure.pools.forEach((p: any, i: number) =>
    nodes.push({
      id: p.id,
      kind: "pool",
      title: `选手池${i + 1}`,
      sources: [`容量${p.capacity ?? "待定"}`],
      status: "合并重排",
      x: 200 + i * 360,
      y: 40 + Math.max(1, ...stages.map((s: any) => s.groups.length)) * 260,
      width: 300,
      height: 220,
    }),
  );
  for (const r of structure.routes) {
    const from = r.source.groupId ?? r.source.poolId,
      to = r.target.groupId ?? r.target.poolId;
    if (from && to)
      edges.push({
        id: r.id,
        from,
        to,
        label: `${r.source.port ?? "rank"} → ${r.target.port ?? r.placement?.kind ?? "pool"}`,
        kind: "route",
      });
  }
  return { nodes, edges, title: "阶段总览", format: "overview" };
}
