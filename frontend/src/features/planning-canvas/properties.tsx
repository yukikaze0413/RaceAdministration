import { useEffect, useState } from "react";
import type { CanvasGraph, CanvasNode, Endpoint, Port } from "./types";
import { Field } from "../../shared/ui";
import { requestKey } from "../../shared/api";
const parameterLabels: Record<string, string> = {
  defaultBO: "默认 BO",
  roundCount: "轮数",
  winsToQualify: "晋级胜场阈值",
  lossesToEliminate: "淘汰负场阈值",
  allowDraw: "允许平局",
  allowPlayerDoubleLoss: "允许选手提交双方负",
  firstPairing: "首轮配对",
  tiebreakers: "同分顺序",
  points: "计分",
  win: "胜",
  draw: "平",
  loss: "负",
  doubleLoss: "双方负",
  seeding: "种子落位",
  kind: "方式",
  seedTableVersion: "种子表版本",
  overrides: "规则覆盖",
  advance: "晋级战 BO",
  elimination: "淘汰战 BO",
  rounds: "逐轮覆盖",
};
function RuleFields({
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
  if (schema.type === "object")
    return (
      <fieldset>
        <legend>{(parameterLabels[prefix] ?? prefix) || "规则参数"}</legend>
        {Object.entries<any>(schema.properties).map(([k, s]) => (
          <RuleFields
            key={k}
            schema={s}
            value={value?.[k]}
            prefix={k}
            onChange={(v) => onChange({ ...value, [k]: v })}
          />
        ))}
      </fieldset>
    );
  const label = parameterLabels[prefix] ?? prefix;
  if (schema.type === "boolean")
    return (
      <label className="canvas-check">
        <input
          type="checkbox"
          checked={value ?? false}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  if (schema.type === "array")
    return (
      <Field label={label}>
        <input
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
          value={value ?? schema.enum[0]}
          onChange={(e) =>
            onChange(
              schema.type === "integer"
                ? Number(e.target.value)
                : e.target.value,
            )
          }
        >
          {schema.enum.map((x: any) => (
            <option key={String(x)} value={x}>
              {String(x)}
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
export function Properties({
  node,
  formats,
  analysis,
  graph,
  onAction,
  disabled,
}: {
  node: CanvasNode;
  formats: any[];
  analysis: any;
  graph: CanvasGraph;
  onAction: (action: any) => Promise<void>;
  disabled: boolean;
}) {
  const [name, setName] = useState(node.name),
    [display, setDisplay] = useState(node.display ?? {}),
    [displayNode, setDisplayNode] = useState(node.id),
    [params, setParams] = useState<any>(structuredClone(node.params)),
    [source, setSource] = useState(""),
    [mapping, setMapping] = useState(""),
    [boundaryTarget, setBoundaryTarget] = useState(""),
    [boundaryName, setBoundaryName] = useState("");
  useEffect(() => {
    if (!disabled) {
      setDisplay(node.display ?? {});
      setDisplayNode(node.id);
    }
  }, [node.id, JSON.stringify(node.display), disabled]);
  useEffect(() => {
    setName(node.name);
    setParams(structuredClone(node.params));
    setSource(
      (node.params.seats ?? [])
        .map((x: any) => x.ref + " | " + x.label)
        .join("\n"),
    );
    setMapping(
      Object.entries(node.params.mapping ?? {})
        .map(([k, v]) => k + ":" + v)
        .join("\n"),
    );
  }, [node.id, JSON.stringify(node.params), node.name]);
  const change = (key: string, v: any) =>
    setParams((p: any) => ({ ...p, [key]: v }));
  const rule = formats.find((x) => x.ruleVersion === params.ruleVersion);
  const within = (id: string) => {
    let n = analysis?.nodes.find((n: CanvasNode) => n.id === id);
    while (n?.parentId) {
      if (n.parentId === node.id) return true;
      n = analysis.nodes.find((x: CanvasNode) => x.id === n.parentId);
    }
    return false;
  };
  const choices = (analysis?.nodes ?? [])
    .filter((n: CanvasNode) => within(n.id))
    .flatMap((n: CanvasNode) =>
      (n.ports ?? []).map((p) => ({ node: n, port: p })),
    );
  const outputOrigin = (end: Endpoint, seen = new Set<string>()): Endpoint => {
    const key = end.node + "/" + end.port;
    if (seen.has(key)) return end;
    seen.add(key);
    const n = graph.nodes.find((n) => n.id === end.node);
    const b =
      n?.kind === "subgraph" &&
      n.params.boundaries.find(
        (b: any) => b.direction === "output" && b.id === end.port,
      );
    return b ? outputOrigin(b.target, seen) : end;
  };
  return (
    <form
      className="canvas-properties"
      onSubmit={(e) => {
        e.preventDefault();
        let p = params;
        if (node.kind === "source") {
          const seats = source
            .split("\n")
            .filter((x) => x.trim())
            .map((x) => {
              const [ref, ...rest] = x.split("|");
              return {
                ref: ref.trim(),
                label: rest.join("|").trim() || ref.trim(),
              };
            });
          p = { ...p, seats };
          if (mapping.trim())
            p.mapping = Object.fromEntries(
              mapping
                .split("\n")
                .filter((x) => x.trim())
                .map((x) => {
                  const [ref, ...v] = x.split(":");
                  return [ref.trim(), Number(v.join(":"))];
                }),
            );
          else p.mapping = null;
        }
        void onAction({ type: "update", id: node.id, name, params: p });
      }}
    >
      <fieldset disabled={disabled} className="canvas-property-lock">
        <h3>组件属性</h3>
        <Field label="名称">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <p className="canvas-small">稳定标识：{node.id}</p>
        {node.kind === "source" && (
          <>
            <Field label="未来席位（每行 引用 | 名称）">
              <textarea
                rows={7}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
            <Field label="外部种子映射（可选，每行 引用:数值）">
              <textarea
                rows={3}
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
              />
            </Field>
          </>
        )}
        {node.kind === "match" && (
          <>
            <Field label="BO">
              <input
                type="number"
                min={1}
                step={2}
                value={params.bestOf}
                onChange={(e) => change("bestOf", Number(e.target.value))}
              />
            </Field>
            {graph.schemaVersion === "canvas-v1" && (
              <Field label="比赛批次（空值按依赖推导）">
                <input
                  value={params.batch ?? ""}
                  onChange={(e) => change("batch", e.target.value)}
                />
              </Field>
            )}
            <Field label="胜败来源规则">
              <select
                value={params.winnerRule ?? "unique-winner-v1"}
                onChange={(e) => change("winnerRule", e.target.value)}
              >
                <option value="unique-winner-v1">必须有唯一胜败者</option>
                <option value="none">未定义（验证阻塞）</option>
              </select>
            </Field>
            <Field label="预计开始时间">
              <input
                type="datetime-local"
                value={params.expectedTime ?? ""}
                onChange={(e) => change("expectedTime", e.target.value || null)}
              />
            </Field>
            <Field label="预计时长（分钟）">
              <input
                type="number"
                min={1}
                value={params.durationMinutes ?? ""}
                onChange={(e) =>
                  change(
                    "durationMinutes",
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              />
            </Field>
          </>
        )}
        {node.kind === "swiss" && (
          <>
            <Field label="瑞士规则版本">
              <select
                value={params.ruleVersion}
                onChange={(e) => {
                  change("ruleVersion", e.target.value);
                  change("parameters", {});
                }}
              >
                {formats
                  .filter((x) =>
                    ["fixed-swiss", "threshold-swiss", "major-like"].includes(
                      x.format,
                    ),
                  )
                  .map((x) => (
                    <option key={x.ruleVersion} value={x.ruleVersion}>
                      {x.name ?? x.label ?? x.ruleVersion}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="最终全排名">
              <select
                value={params.ranking ?? ""}
                onChange={(e) => change("ranking", e.target.value)}
              >
                <option value="complete-v1">
                  按冻结规则排序，并列需明确裁定
                </option>
                <option value="">未配置</option>
              </select>
            </Field>
            {rule?.parameterSchema && (
              <RuleFields
                schema={rule.parameterSchema}
                value={{ ...rule.defaults.parameters, ...params.parameters }}
                onChange={(v) => change("parameters", v)}
              />
            )}
            <p>
              全段完成并确认后释放全部席位。规划预览只显示排名来源，配对、轮空、跨分组与禁重赛规则由规则版本定义。
            </p>
          </>
        )}
        {["selector", "generator", "expander"].includes(node.kind) && (
          <Field
            label={
              node.kind === "expander" ? "展开数量（留空由集合推导）" : "数量 N"
            }
          >
            <input
              type="number"
              min={1}
              max={64}
              value={params.count ?? ""}
              onChange={(e) =>
                change("count", e.target.value ? Number(e.target.value) : null)
              }
            />
          </Field>
        )}
        {["selector", "generator"].includes(node.kind) && (
          <>
            <Field label="模式">
              <select
                value={params.mode}
                onChange={(e) => change("mode", e.target.value)}
              >
                <option value={node.kind === "selector" ? "top" : "reverse"}>
                  {node.kind === "selector" ? "取前 N 项" : "倒序"}
                </option>
                <option value="random">随机不放回</option>
              </select>
            </Field>
            <Field label="随机数种子">
              <input
                type="number"
                min={0}
                max={4294967295}
                value={params.seed}
                onChange={(e) => change("seed", Number(e.target.value))}
              />
            </Field>
            <button
              type="button"
              onClick={() =>
                change("seed", crypto.getRandomValues(new Uint32Array(1))[0])
              }
            >
              显式重新随机
            </button>
            <p>使用 mulberry32-v1；保存和预览不会自动更换随机数种子。</p>
          </>
        )}
        {node.kind === "pool" && (
          <div>
            <p>输入端口按以下顺序拼接；保留稳定端口身份。</p>
            {params.inputs.map((p: string, i: number) => (
              <div className="canvas-input-order" key={p}>
                <span>{p}</span>
                <button
                  type="button"
                  disabled={i === 0 || disabled}
                  aria-label={"上移输入 " + p}
                  onClick={() => {
                    const inputs = params.inputs.slice();
                    [inputs[i - 1], inputs[i]] = [inputs[i], inputs[i - 1]];
                    change("inputs", inputs);
                  }}
                >
                  上移
                </button>
                <button
                  type="button"
                  disabled={i === params.inputs.length - 1 || disabled}
                  aria-label={"下移输入 " + p}
                  onClick={() => {
                    const inputs = params.inputs.slice();
                    [inputs[i + 1], inputs[i]] = [inputs[i], inputs[i + 1]];
                    change("inputs", inputs);
                  }}
                >
                  下移
                </button>
              </div>
            ))}
          </div>
        )}
        {node.kind === "subgraph" && (
          <>
            <p>
              {node.params.templateOrigin
                ? "预设：" + node.params.templateOrigin.ruleVersion
                : "自定义子图"}
              {node.params.custom ? " · 可编辑" : " · 先转为自定义"}
            </p>
            {!node.params.custom && (
              <button
                type="button"
                onClick={() =>
                  void onAction({ type: "customize", id: node.id })
                }
              >
                转为自定义
              </button>
            )}
            <p className="canvas-small">
              悬空接口可保留，隐藏只影响显示；Match 缺少席位按轮空处理。
            </p>
            <details className="canvas-boundary-advanced">
              <summary>高级边界设置</summary>
              <ul>
                {node.params.boundaries.map((b: any) => (
                  <li key={b.id}>
                    {b.name}（{b.type}）
                    <button
                      type="button"
                      disabled={
                        disabled ||
                        (node.params.custom &&
                          node.params.autoWinnerOutputs !== false &&
                          b.direction === "output" &&
                          outputOrigin(b.target).port === "W")
                      }
                      title="末端胜者接口自动保持，可通过隐藏悬空输出接口隐藏；其他接口有连接时先确认移除影响"
                      onClick={() =>
                        void onAction({
                          type: "removeBoundary",
                          id: node.id,
                          port: b.id,
                        })
                      }
                    >
                      删除边界 {b.name}
                    </button>
                  </li>
                ))}
              </ul>
              <Field label="内部端口">
                <select
                  value={boundaryTarget}
                  onChange={(e) => setBoundaryTarget(e.target.value)}
                >
                  <option value="">选择要暴露的端口</option>
                  {choices.map((x: { node: CanvasNode; port: Port }) => (
                    <option
                      key={x.node.id + x.port.id + x.port.direction}
                      value={JSON.stringify({
                        target: { node: x.node.id, port: x.port.id },
                        direction: x.port.direction,
                        type: x.port.type,
                      })}
                    >
                      {x.node.name} {x.port.label}{" "}
                      {x.port.direction === "input" ? "输入" : "输出"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="边界名称">
                <input
                  value={boundaryName}
                  onChange={(e) => setBoundaryName(e.target.value)}
                />
              </Field>
              <button
                type="button"
                disabled={!boundaryTarget || !boundaryName || disabled}
                onClick={() =>
                  void onAction({
                    type: "expose",
                    id: node.id,
                    boundary: {
                      ...JSON.parse(boundaryTarget),
                      id: crypto
                        .getRandomValues(new Uint32Array(1))[0]
                        .toString(16),
                      name: boundaryName,
                    },
                  })
                }
              >
                添加边界映射
              </button>
            </details>
          </>
        )}
        <button disabled={disabled} type="submit">
          应用属性
        </button>
        <div className="canvas-display-options">
          {[
            ["hideDanglingInputs", "隐藏悬空输入接口"],
            ["hideDanglingOutputs", "隐藏悬空输出接口"],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={
                  (displayNode === node.id ? display : node.display)?.[
                    key as "hideDanglingInputs" | "hideDanglingOutputs"
                  ] ?? false
                }
                disabled={disabled}
                onChange={(e) => {
                  setDisplayNode(node.id);
                  setDisplay({ ...node.display, [key]: e.target.checked });
                  void onAction({
                    type: "update",
                    id: node.id,
                    display: { [key]: e.target.checked },
                  });
                }}
              />
              {label}
            </label>
          ))}
          {node.kind === "match" && (
            <label>
              <input
                type="checkbox"
                checked={node.display?.showLoser ?? false}
                disabled={disabled}
                onChange={(e) =>
                  void onAction({
                    type: "update",
                    id: node.id,
                    display: { showLoser: e.target.checked },
                  })
                }
              />
              展示败者端口
            </label>
          )}
          {["swiss", "pool", "selector", "subgraph"].includes(node.kind) && (
            <label>
              <input
                type="checkbox"
                checked={node.display?.showSeeds ?? false}
                disabled={disabled}
                onChange={(e) =>
                  void onAction({
                    type: "update",
                    id: node.id,
                    display: { showSeeds: e.target.checked },
                  })
                }
              />
              展示种子映射
            </label>
          )}
          <label>
            <input
              type="checkbox"
              disabled={disabled}
              checked={node.display?.collapsed ?? false}
              onChange={(e) =>
                void onAction({
                  type: "update",
                  id: node.id,
                  display: { collapsed: e.target.checked },
                })
              }
            />
            折叠详情
          </label>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onAction({ type: "delete", id: node.id })}
        >
          删除组件
        </button>
      </fieldset>
    </form>
  );
}
