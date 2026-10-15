import { Field } from "../../shared/ui";
import { mergeRuleParameters, RuleFields, Tiebreakers } from "./rule-fields";
import type { CanvasNode } from "./types";

export function RankingProperties({
  node,
  params,
  formats,
  capacity,
  change,
  windows,
}: {
  node: CanvasNode;
  params: any;
  formats: any[];
  capacity?: number | null;
  windows?: any[];
  change: (values: Record<string, any>) => void;
}) {
  const swiss = node.kind === "swiss";
  const rule = formats.find((r) => r.ruleVersion === params.ruleVersion);
  if (!rule) return <p>规则目录尚未加载。</p>;
  const value = mergeRuleParameters(
    rule.defaults.parameters,
    params.parameters,
  );
  const schema = rule.parameterSchema.properties;
  const special = [
    "major-cologne-2026-v1",
    "ti2026-observed-candidate-v1",
  ].includes(rule.ruleVersion);
  const fixedCapacity =
    rule.canvasProperties?.fixedCapacity ??
    (special ? rule.defaults.groupSize : null);
  const count = params.participantCount ?? capacity;
  const rounds =
    value.roundCount ?? value.winsToQualify + value.lossesToEliminate - 1;
  const rrRounds =
    capacity == null
      ? null
      : (capacity % 2 ? capacity : capacity - 1) * value.cycleCount;
  const update = (key: string, next: any) =>
    change({ parameters: { ...value, [key]: next } });
  const switchRule = (id: string) => {
    const next = formats.find((r) => r.ruleVersion === id);
    // Retain legal common choices; specialized Swiss presets keep their frozen defaults.
    const parameters: Record<string, any> = {};
    if (
      !special &&
      !["major-cologne-2026-v1", "ti2026-observed-candidate-v1"].includes(id)
    ) {
      for (const key of ["defaultBO", "allowDraw", "allowPlayerDoubleLoss"])
        if (
          next.parameterSchema.properties[key]?.enum?.includes(value[key]) ||
          (next.parameterSchema.properties[key] &&
            !next.parameterSchema.properties[key].enum)
        )
          parameters[key] = value[key];
      if (!swiss) {
        parameters.points = value.points;
        parameters.tiebreakers = value.tiebreakers;
      }
    }
    const nextCapacity =
      next.canvasProperties?.fixedCapacity ??
      (["major-cologne-2026-v1", "ti2026-observed-candidate-v1"].includes(id)
        ? next.defaults.groupSize
        : null);
    change({
      ruleVersion: id,
      parameters,
      ranking: "complete-v1",
      ...(swiss && nextCapacity ? { participantCount: nextCapacity } : {}),
    });
  };
  const selector = (
    <Field label={swiss ? "瑞士规则版本" : "循环方式"}>
      <select
        aria-label={swiss ? "瑞士规则版本" : "循环方式"}
        value={params.ruleVersion}
        onChange={(e) => switchRule(e.target.value)}
      >
        {formats
          .filter((r) =>
            (swiss
              ? ["fixed-swiss", "threshold-swiss", "major-like"]
              : ["round-robin", "double-round-robin"]
            ).includes(r.format),
          )
          .map((r) => (
            <option key={r.ruleVersion} value={r.ruleVersion}>
              {r.name ?? r.label}
            </option>
          ))}
      </select>
    </Field>
  );
  const fields = Object.entries<any>(schema).filter(
    ([key]) =>
      !["roundCount", "winsToQualify", "cycleCount", "tiebreakers"].includes(
        key,
      ),
  );
  return (
    <>
      <fieldset>
        <legend>赛制参数</legend>
        {swiss ? (
          <>
            {fixedCapacity ? (
              <p>人数：{fixedCapacity}（规则固定）</p>
            ) : (
              <Field label="人数">
                <input
                  type="number"
                  min={2}
                  max={64}
                  value={count ?? ""}
                  placeholder="连接后由输入集合推导"
                  onChange={(e) =>
                    change({
                      participantCount: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </Field>
            )}
            {schema.roundCount && !schema.roundCount.enum ? (
              <RuleFields
                schema={schema.roundCount}
                prefix="roundCount"
                value={value.roundCount}
                onChange={(next) => update("roundCount", next)}
              />
            ) : (
              <p>
                轮数：{rounds}（
                {rule.format === "threshold-swiss" && !schema.roundCount
                  ? "最大规划轮窗口"
                  : "规则固定"}
                ）
              </p>
            )}
            <p className="canvas-small">
              人数与输入集合核对；轮数以 round 为单位。
            </p>
          </>
        ) : (
          <>
            {selector}
            <p>参赛人数：{capacity ?? "待解析"}</p>
            <p>循环轮数：{rrRounds ?? "待解析"}</p>
            <p className="canvas-small">
              预计场数：
              {capacity == null
                ? "待解析"
                : ((capacity * (capacity - 1)) / 2) * value.cycleCount}
              （统计）
            </p>
          </>
        )}
      </fieldset>
      <details className="canvas-property-section">
        <summary>高级规则</summary>
        {swiss && selector}
        {rule.runtimeReady === false && <p>候选规则尚不可运行。</p>}
        {fields.map(([key, child]) => {
          if (key === "points") {
            const properties = { ...child.properties };
            if (!value.allowDraw) delete properties.draw;
            return (
              <RuleFields
                key={key}
                schema={{ ...child, properties }}
                prefix={key}
                value={value[key]}
                onChange={(next) => update(key, next)}
              />
            );
          }
          return (
            <RuleFields
              key={key}
              schema={child}
              prefix={key}
              value={value[key]}
              onChange={(next) => update(key, next)}
            />
          );
        })}
        {schema.tiebreakers && (
          <Tiebreakers
            schema={schema.tiebreakers}
            value={value.tiebreakers}
            fixed={rule.canvasProperties?.fixedTiebreakers ?? special}
            onChange={(next) => update("tiebreakers", next)}
          />
        )}
      </details>
      <p className="canvas-small">完整排名输出，并列时待裁定。</p>
      {params.ranking !== "complete-v1" && (
        <button
          type="button"
          onClick={() => change({ ranking: "complete-v1" })}
        >
          采用完整排名
        </button>
      )}
      {swiss ? (
        <p className="canvas-small">瑞士轮只预留整轮，真实配对待解析。</p>
      ) : (
        <p className="canvas-small">每个 round 包含整轮对阵及休息名单。</p>
      )}
      {!!windows?.length && (
        <p className="canvas-small">已规划 {windows.length} 轮。</p>
      )}
    </>
  );
}
