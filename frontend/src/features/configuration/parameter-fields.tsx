import { Field } from "../../shared/ui";
import { numberChoices, type Definition } from "./format-options";
const names: Record<string, string> = {
  defaultBO: "默认赛制",
  bracketMode: "淘汰结构",
  thirdPlace: "季军战",
  lowerEntryMode: "败者直接输入",
  finalReset: "决赛重置",
  roundCount: "轮数",
  winsToQualify: "晋级所需胜场",
  lossesToEliminate: "淘汰所需败场",
  allowDraw: "允许平局",
  allowPlayerDoubleLoss: "允许选手提交双方判负",
  firstPairing: "首轮配对",
  cycleCount: "循环次数",
  seeding: "种子与落位",
  kind: "位置类型",
  seedTableVersion: "种子表",
  points: "积分",
  win: "胜局积分",
  draw: "平局积分",
  loss: "负局积分",
  doubleLoss: "双方判负积分",
};
const values: Record<string, string> = {
  complete: "完整席位",
  segmented: "分段淘汰",
  disabled: "无",
  same: "与胜者输入相同",
  half: "胜者输入的一半",
  seed: "种子",
  slot: "绝对席位",
  "recursive-v1": "固定种子表",
  "top-bottom": "上半区对下半区",
  points: "积分",
  "BH-points-v1": "对手积分和",
  netGames: "净胜局",
  initialSeed: "初始种子",
  "manual-with-reason": "留因裁定",
  record: "胜负战绩",
  "DS-wl-v1": "对手胜负差",
  "head-to-head-v1": "同分集合交手积分",
  "ti-organizer-slot-v1": "组织者首轮席位表",
  "organizer-slot-pairs-v1": "按组织者同组席位成对",
  "TI-opponent-wins-v1": "对手系列赛胜场和",
  "TI-game-pct-observed-v1": "小局胜率（候选公式）",
  "TI-opponent-game-pct-observed-v1": "对手小局胜率（候选公式）",
  "TI-duration-observed-v1": "平均小局时长（候选公式）",
  "coin-toss-with-reason": "抛硬币留因裁定",
};
function SchemaField({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: any;
  value: any;
  onChange: (value: any) => void;
}) {
  const label = names[name] ?? name;
  if (schema.type === "object")
    return (
      <fieldset className="parameter-nested">
        <legend>{label}</legend>
        {Object.entries(schema.properties).map(([key, s]: any) => (
          <SchemaField
            key={key}
            name={key}
            schema={s}
            value={value?.[key]}
            onChange={(v) => onChange({ ...value, [key]: v })}
          />
        ))}
      </fieldset>
    );
  if (schema.type === "boolean")
    return schema.enum?.length === 1 ? (
      <p>
        {label}：{value ? "是" : "否"}
      </p>
    ) : (
      <Field label={label}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
      </Field>
    );
  if (schema.enum) {
    return (
      <Field label={label}>
        <select
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              schema.type === "integer"
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        >
          {!schema.enum.includes(value) && (
            <option disabled value={value ?? ""}>
              {value == null ? "请选择" : String(value) + "（需调整）"}
            </option>
          )}
          {schema.enum.map((v: any) => (
            <option key={String(v)} value={String(v)}>
              {values[String(v)] ?? String(v)}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <input
        type="number"
        required
        min={schema.minimum}
        max={schema.maximum}
        step={1}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    </Field>
  );
}
function Tiebreakers({
  schema,
  value,
  onChange,
  defaults,
}: {
  schema: any;
  value: string[];
  defaults: string[];
  onChange: (v: string[]) => void;
}) {
  const allowed: string[] = schema.items.enum,
    terminal = ["initialSeed", "manual-with-reason"].filter((k) =>
      allowed.includes(k),
    );
  const optional = allowed.filter(
    (k) => k !== value[0] && !terminal.includes(k),
  );
  const add = optional.find((k) => !value.includes(k));
  return (
    <fieldset className="parameter-nested">
      <legend>排名与同分排序</legend>
      <button type="button" onClick={() => onChange([...defaults])}>
        恢复默认排序
      </button>
      <ol>
        {value.map((v, i) => (
          <li key={i}>
            {i === 0 ? (
              <span>首先比较：{values[v]}</span>
            ) : (
              <>
                <Field label={"第" + (i + 1) + "排序字段"}>
                  <select
                    value={v}
                    onChange={(e) =>
                      onChange(
                        value.map((old, j) => (j === i ? e.target.value : old)),
                      )
                    }
                  >
                    {(i === value.length - 1
                      ? terminal
                      : optional.filter((k) => k === v || !value.includes(k))
                    ).map((k) => (
                      <option value={k} key={k}>
                        {values[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                {i < value.length - 1 && (
                  <div className="actions">
                    <button
                      type="button"
                      disabled={i === 1}
                      onClick={() => {
                        const n = [...value];
                        [n[i - 1], n[i]] = [n[i], n[i - 1]];
                        onChange(n);
                      }}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      disabled={i === value.length - 2}
                      onClick={() => {
                        const n = [...value];
                        [n[i], n[i + 1]] = [n[i + 1], n[i]];
                        onChange(n);
                      }}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(value.filter((_, j) => j !== i))}
                    >
                      移除排序字段
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={!add}
        onClick={() =>
          add && onChange([...value.slice(0, -1), add, value.at(-1)!])
        }
      >
        添加排序字段
      </button>
    </fieldset>
  );
}
const roleNames: Record<string, string> = {
  final: "决赛BO",
  thirdPlace: "季军战BO",
  opening: "首轮BO",
  winners: "胜者战BO",
  elimination: "败者战BO",
  decider: "出线战BO",
  upper: "胜者组BO",
  lower: "败者组BO",
  advancement: "晋级战BO",
};
function Overrides({
  schema,
  value,
  onChange,
  draft,
}: {
  schema: any;
  value: any;
  onChange: (v: any) => void;
  draft: any;
}) {
  const roundSchema = schema.properties.rounds?.properties ?? {},
    rounds = value.rounds ?? {};
  const available = Object.keys(roundSchema).filter(
    (k) => !Object.hasOwn(rounds, k),
  );
  function set(key: string, v: string) {
    const n = { ...value };
    if (v === "") delete n[key];
    else n[key] = Number(v);
    onChange(n);
  }
  return (
    <fieldset className="parameter-nested">
      <legend>按比赛角色或轮次设置BO</legend>
      {Object.entries(schema.properties)
        .filter(
          ([key]) =>
            key !== "rounds" &&
            (key !== "final" || draft.qualifyCount === 1) &&
            (key !== "thirdPlace" || draft.parameters.thirdPlace),
        )
        .map(([key, s]: any) => (
          <Field
            key={key}
            label={
              key === "elimination" && draft.format === "threshold-swiss"
                ? "淘汰战BO"
                : (roleNames[key] ?? key)
            }
          >
            <select
              value={value[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
            >
              {draft.ruleVersion !== "major-cologne-2026-v1" && (
                <option value="">继承默认BO</option>
              )}
              {s.enum.map((n: number) => (
                <option key={n} value={n}>
                  BO{n}
                </option>
              ))}
            </select>
          </Field>
        ))}
      {Object.keys(rounds)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (
          <div className="parameter-round" key={k}>
            <Field label={"第" + k + "轮BO"}>
              <select
                value={rounds[k]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    rounds: { ...rounds, [k]: Number(e.target.value) },
                  })
                }
              >
                {roundSchema[k]?.enum.map((n: number) => (
                  <option key={n} value={n}>
                    BO{n}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={() => {
                const n = { ...rounds };
                delete n[k];
                const next = { ...value };
                if (Object.keys(n).length) next.rounds = n;
                else delete next.rounds;
                onChange(next);
              }}
            >
              移除轮次覆写
            </button>
          </div>
        ))}
      {available.length > 0 && (
        <Field label="添加轮次BO">
          <select
            value=""
            onChange={(e) =>
              e.target.value &&
              onChange({
                ...value,
                rounds: {
                  ...rounds,
                  [e.target.value]: draft.parameters.defaultBO,
                },
              })
            }
          >
            <option value="">选择轮次</option>
            {available.map((k) => (
              <option key={k} value={k}>
                第{k}轮
              </option>
            ))}
          </select>
        </Field>
      )}
    </fieldset>
  );
}
export function AdvancedParameters({
  definition,
  draft,
  onChange,
}: {
  definition: Definition;
  draft: any;
  onChange: (v: any) => void;
}) {
  const properties = definition.parameterSchema.properties;
  const fixedRanking = [
    "major-cologne-2026-v1",
    "ti2026-observed-candidate-v1",
  ].includes(draft.ruleVersion);
  return (
    <details className="parameter-advanced">
      <summary>高级赛制参数</summary>
      {Object.entries(properties)
        .filter(
          ([key]) =>
            key !== "defaultBO" &&
            key !== "overrides" &&
            key !== "tiebreakers" &&
            (key !== "thirdPlace" ||
              (draft.qualifyCount === 1 && draft.groupSize >= 4)) &&
            (key !== "finalReset" || draft.qualifyCount === 1),
        )
        .map(([key, schema]: any) => (
          <SchemaField
            key={key}
            name={key}
            schema={
              key === "roundCount" && draft.ruleVersion === "swiss-fixed-v1"
                ? {
                    type: "integer",
                    enum: numberChoices(
                      draft.groupSize % 2
                        ? draft.groupSize
                        : draft.groupSize - 1,
                    ),
                  }
                : schema
            }
            value={draft.parameters[key]}
            onChange={(value) =>
              onChange({
                ...draft.parameters,
                [key]: key === "roundCount" ? Number(value) : value,
              })
            }
          />
        ))}
      {properties.tiebreakers && fixedRanking && (
        <p>
          排名：
          {draft.parameters.tiebreakers
            .map((v: string) => values[v])
            .join(" → ")}
        </p>
      )}
      {properties.tiebreakers && !fixedRanking && (
        <Tiebreakers
          schema={properties.tiebreakers}
          defaults={definition.defaults.parameters.tiebreakers}
          value={draft.parameters.tiebreakers}
          onChange={(value) =>
            onChange({ ...draft.parameters, tiebreakers: value })
          }
        />
      )}
      {Object.keys(properties.overrides.properties).length > 0 && (
        <Overrides
          schema={properties.overrides}
          value={draft.parameters.overrides ?? {}}
          draft={draft}
          onChange={(value) =>
            onChange({ ...draft.parameters, overrides: value })
          }
        />
      )}
    </details>
  );
}

export function parameterComparison(
  parameters: any,
  prefix = "",
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(parameters ?? {})) {
    const label =
      prefix +
      (names[key] ??
        roleNames[key] ??
        (key === "overrides"
          ? "BO覆写"
          : key === "rounds"
            ? "轮次"
            : key === "tiebreakers"
              ? "同分排序"
              : key));
    if (value && typeof value === "object" && !Array.isArray(value))
      rows.push(...parameterComparison(value, label + " / "));
    else
      rows.push([
        label,
        Array.isArray(value)
          ? value.map((v) => values[String(v)] ?? String(v)).join(" → ")
          : typeof value === "boolean"
            ? value
              ? "是"
              : "否"
            : (values[String(value)] ?? String(value)),
      ]);
  }
  return rows;
}
