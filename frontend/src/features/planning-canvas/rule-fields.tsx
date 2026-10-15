import { useState } from "react";
import { Field } from "../../shared/ui";

const parameterLabels: Record<string, string> = {
  defaultBO: "单场赛制",
  roundCount: "轮数",
  winsToQualify: "晋级胜场阈值",
  lossesToEliminate: "淘汰负场阈值",
  allowDraw: "允许平局",
  allowPlayerDoubleLoss: "允许选手提交双方判负",
  firstPairing: "首轮配对",
  tiebreakers: "同分顺序",
  points: "计分",
  win: "胜",
  draw: "平",
  loss: "负",
  doubleLoss: "双方判负",
  seeding: "种子落位",
  kind: "方式",
  seedTableVersion: "种子表版本",
  overrides: "规则覆盖",
  advance: "晋级战 BO",
  advancement: "晋级战 BO",
  elimination: "淘汰战 BO",
  rounds: "逐轮覆盖",
};

const ruleNames: Record<string, string> = {
  points: "积分",
  record: "战绩",
  "BH-points-v1": "对手积分",
  "DS-wl-v1": "对手胜负差",
  netGames: "净胜局",
  initialSeed: "初始种子",
  "head-to-head-v1": "相互战绩",
  "manual-with-reason": "人工裁定（记录原因）",
  "coin-toss-with-reason": "抽签（记录原因）",
  "TI-opponent-wins-v1": "对手胜场",
  "TI-game-pct-observed-v1": "获胜局比例（候选）",
  "TI-opponent-game-pct-observed-v1": "对手获胜局比例（候选）",
  "TI-duration-observed-v1": "比赛时长（候选）",
  seed: "种子顺序",
  slot: "指定位置",
  "recursive-v1": "递归种子表",
  "ti-organizer-slot-v1": "主办方位置表",
  "top-bottom": "前后半区配对",
  "organizer-slot-pairs-v1": "主办方位置配对",
};
const ruleName = (id: string) => ruleNames[id] ?? id;
export function Tiebreakers({
  schema,
  value = [],
  fixed = false,
  onChange,
}: {
  schema: any;
  value: string[];
  fixed?: boolean;
  onChange: (next: string[]) => void;
}) {
  const valid = (next: string[]) =>
    next.length >= (schema.minItems ?? 1) &&
    next[0] === value[0] &&
    ["initialSeed", "manual-with-reason"].includes(next.at(-1) ?? "");
  const move = (i: number, offset: number) => {
    const next = [...value];
    [next[i], next[i + offset]] = [next[i + offset], next[i]];
    return next;
  };
  const available = (schema.items?.enum ?? []).filter(
    (id: string) => !value.includes(id),
  );
  return (
    <fieldset>
      <legend>同分顺序</legend>
      <ol aria-label="同分顺序" className="canvas-tiebreakers">
        {value.map((id, i) => (
          <li key={id}>
            <span>{ruleName(id)}</span>
            {!fixed && (
              <div>
                <button
                  type="button"
                  aria-label={"上移" + ruleName(id)}
                  disabled={i === 0 || !valid(move(i, -1))}
                  onClick={() => onChange(move(i, -1))}
                >
                  上移
                </button>
                <button
                  type="button"
                  aria-label={"下移" + ruleName(id)}
                  disabled={i === value.length - 1 || !valid(move(i, 1))}
                  onClick={() => onChange(move(i, 1))}
                >
                  下移
                </button>
                <button
                  type="button"
                  aria-label={"移除" + ruleName(id)}
                  disabled={!valid(value.filter((_, index) => index !== i))}
                  onClick={() =>
                    onChange(value.filter((_, index) => index !== i))
                  }
                >
                  移除
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {fixed ? (
        <small>排序由规则固定。</small>
      ) : (
        available.length > 0 && (
          <Field label="添加同分规则">
            <select
              value=""
              onChange={(e) => {
                const next = [
                  ...value.slice(0, -1),
                  e.target.value,
                  ...value.slice(-1),
                ];
                if (valid(next)) onChange(next);
              }}
            >
              <option value="">选择规则</option>
              {available.map((id: string) => (
                <option key={id} value={id}>
                  {ruleName(id)}
                </option>
              ))}
            </select>
          </Field>
        )
      )}
    </fieldset>
  );
}

export function mergeRuleParameters(defaults: any, value: any): any {
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults))
    return value === undefined ? defaults : value;
  const merged = { ...defaults, ...value };
  for (const key of Object.keys(defaults))
    merged[key] = mergeRuleParameters(defaults[key], value?.[key]);
  return merged;
}

function RoundOverrides({
  schema,
  value = {},
  onChange,
}: {
  schema: any;
  value: Record<string, number>;
  onChange: (value: any) => void;
}) {
  const [round, setRound] = useState("");
  const properties = schema.properties ?? {};
  const available = Object.keys(properties).filter(
    (key) => value[key] === undefined,
  );
  const selected = available.includes(round) ? round : (available[0] ?? "");
  return (
    <details className="canvas-property-section">
      <summary>逐轮覆盖</summary>
      <p className="canvas-small">未添加的轮次使用默认 BO。</p>
      {Object.keys(value)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => (
          <div className="canvas-round-override" key={key}>
            <Field label={`第 ${key} 轮 BO`}>
              <select
                aria-label={`第 ${key} 轮 BO`}
                value={value[key]}
                onChange={(e) =>
                  onChange({ ...value, [key]: Number(e.target.value) })
                }
              >
                {(properties[key]?.enum ?? [value[key]]).map((bo: number) => (
                  <option key={bo} value={bo}>
                    {bo}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              aria-label={`移除第 ${key} 轮覆盖`}
              onClick={() => {
                const next = { ...value };
                delete next[key];
                onChange(next);
              }}
            >
              移除
            </button>
          </div>
        ))}
      {available.length > 0 && (
        <div className="canvas-round-override">
          <Field label="覆盖轮次">
            <select
              aria-label="覆盖轮次"
              value={selected}
              onChange={(e) => setRound(e.target.value)}
            >
              {available.map((key) => (
                <option key={key} value={key}>
                  第 {key} 轮
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...value,
                [selected]: properties[selected].enum[0],
              })
            }
          >
            添加轮次覆盖
          </button>
        </div>
      )}
    </details>
  );
}

export function RuleFields({
  schema,
  value,
  onChange,
  prefix = "",
}: {
  schema: any;
  value: any;
  onChange: (value: any) => void;
  prefix?: string;
}) {
  if (prefix === "rounds" && schema.type === "object")
    return <RoundOverrides schema={schema} value={value} onChange={onChange} />;
  if (schema.type === "object")
    return (
      <fieldset>
        <legend>{(parameterLabels[prefix] ?? prefix) || "规则参数"}</legend>
        {Object.entries<any>(schema.properties ?? {}).map(([key, child]) => (
          <RuleFields
            key={key}
            schema={child}
            value={value?.[key]}
            prefix={key}
            onChange={(next) => onChange({ ...value, [key]: next })}
          />
        ))}
      </fieldset>
    );
  const label = parameterLabels[prefix] ?? prefix;
  const fixed = schema.enum?.length === 1;
  if (fixed)
    return (
      <p>
        {label}：
        {schema.type === "boolean"
          ? value
            ? "允许"
            : "不允许"
          : ruleName(String(value ?? schema.enum[0]))}
        （规则固定）
      </p>
    );
  if (schema.type === "boolean")
    return (
      <label className="canvas-check">
        <input
          type="checkbox"
          disabled={fixed}
          checked={value ?? schema.enum?.[0] ?? false}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  if (schema.type === "array")
    return (
      <Field label={label}>
        <input
          aria-label={label}
          value={(value ?? []).join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            )
          }
        />
        <small>按逗号分隔：{schema.items.enum?.join("、")}</small>
      </Field>
    );
  return (
    <Field label={label}>
      {schema.enum ? (
        <select
          aria-label={label}
          disabled={fixed}
          value={value ?? (fixed ? schema.enum[0] : "")}
          onChange={(e) =>
            onChange(
              schema.type === "integer"
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        >
          {!fixed && (
            <option value="" disabled>
              使用规则默认值
            </option>
          )}
          {schema.enum
            .filter(
              (option: any) =>
                prefix !== "defaultBO" || [1, 3, value].includes(option),
            )
            .map((option: any) => (
              <option key={String(option)} value={option}>
                {prefix === "defaultBO"
                  ? "BO" + option
                  : ruleName(String(option))}
              </option>
            ))}
        </select>
      ) : (
        <input
          type={schema.type === "integer" ? "number" : "text"}
          min={schema.minimum}
          max={schema.maximum}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              schema.type === "integer"
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </Field>
  );
}
