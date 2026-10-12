export type PortOption = {
  key: string;
  label: string;
  ref: any;
  capacity: number;
  owner: string;
};
const names: Record<string, string> = {
  qualification: "晋级名额",
  rank: "竞技名次",
  upper: "胜者通道",
  lower: "败者通道",
  seed: "种子",
  slot: "绝对席位",
};
export function portRefKey(ref: any) {
  return JSON.stringify([
    ref?.poolId ?? ref?.groupId ?? ref?.stageId ?? "",
    ref?.poolId ? "pool" : (ref?.port ?? "rank"),
  ]);
}
export function portOptions(
  structure: any,
  side: "source" | "target",
): PortOption[] {
  const out: PortOption[] = [];
  for (const stage of structure.stages)
    for (const [index, group] of stage.groups.entries()) {
      const de = stage.format === "double-elimination",
        truncated =
          ["single-elimination", "double-elimination"].includes(stage.format) &&
          stage.qualifyCount > 1;
      const ports =
        side === "source"
          ? [
              "qualification",
              ...(!truncated ? ["rank"] : []),
              ...(de && stage.qualifyCount > 1 ? ["upper", "lower"] : []),
            ]
          : de
            ? [
                "upper",
                ...(stage.capacity / stage.groupCount > stage.groupSize
                  ? ["lower"]
                  : []),
              ]
            : ["seed", "slot"];
      for (const port of ports) {
        const ref = { stageId: stage.id, groupId: group.id, port };
        const capacity =
          side === "source"
            ? port === "qualification"
              ? stage.qualifyCount
              : port === "upper"
                ? 1
                : port === "lower"
                  ? stage.qualifyCount - 1
                  : (group.capacity ?? stage.groupSize)
            : port === "lower"
              ? stage.capacity / stage.groupCount - stage.groupSize
              : stage.groupSize;
        out.push({
          key: portRefKey(ref),
          ref,
          capacity,
          owner: group.id,
          label: `${stage.name} · 小组${index + 1} · ${names[port]}（${capacity}）`,
        });
      }
    }
  for (const [index, pool] of structure.pools.entries()) {
    const ref =
      side === "source"
        ? { poolId: pool.id, port: "seed" }
        : { poolId: pool.id };
    out.push({
      key: portRefKey(ref),
      ref,
      capacity: pool.capacity,
      owner: pool.id,
      label: `选手池${index + 1} · ${side === "source" ? "池种子出口" : "汇合入口"}（${pool.capacity ?? "待定"}）`,
    });
  }
  return out;
}
export function sourceConsumers(
  routes: any[],
  ref: any,
  from: number,
  to: number,
) {
  return routes.filter(
    (r) =>
      portRefKey(r.source) === portRefKey(ref) &&
      (r.selector?.kind !== "rankRange" ||
        Math.max(from, r.selector.from) <= Math.min(to, r.selector.to)),
  );
}
export function targetConflicts(routes: any[], ref: any, positions: number[]) {
  const owner = ref.poolId ?? ref.groupId ?? ref.stageId;
  return routes.filter(
    (r) =>
      (r.target.poolId ?? r.target.groupId ?? r.target.stageId) === owner &&
      (["upper", "lower"].includes(ref.port)
        ? r.target.port === ref.port
        : !["upper", "lower"].includes(r.target.port)) &&
      r.placement?.positions.some((p: number) => positions.includes(p)),
  );
}
