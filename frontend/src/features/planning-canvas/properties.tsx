import { useEffect, useState } from "react";
import type { CanvasGraph, CanvasNode, Endpoint, Port } from "./types";
import { Field } from "../../shared/ui";
import { RankingProperties } from "./ranking-properties";
import { ReadOnlyProperties } from "./readonly-properties";
export function Properties({
  node,
  formats,
  matchFormats,
  analysis,
  graph,
  onAction,
  disabled,
}: {
  node: CanvasNode;
  formats: any[];
  matchFormats: { id: string; label: string; bestOf: number }[];
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
  }, [node.id]);
  const changeMany = (values: Record<string, any>) => {
    setParams((previous: any) => ({ ...previous, ...values }));
    void onAction({ type: "update", id: node.id, params: values });
  };
  const change = (key: string, value: any) => changeMany({ [key]: value });
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
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset disabled={disabled} className="canvas-property-lock">
        <div className="canvas-property-actions">
          <h3>组件属性</h3>
        </div>
        <Field label="名称">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim())
                void onAction({
                  type: "update",
                  id: node.id,
                  name: e.target.value,
                });
            }}
            required
          />
        </Field>
        {node.kind === "source" && (
          <fieldset>
            <legend>参赛席位</legend>
            <Field label="未来席位（每行 引用 | 名称）">
              <textarea
                rows={5}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                onBlur={() =>
                  change(
                    "seats",
                    source
                      .split("\n")
                      .filter((line) => line.trim())
                      .map((line) => {
                        const [ref, ...rest] = line.split("|");
                        return {
                          ref: ref.trim(),
                          label: rest.join("|").trim() || ref.trim(),
                        };
                      }),
                  )
                }
              />
            </Field>
            <Field label="外部种子映射（可选，每行 引用:数值）">
              <textarea
                rows={3}
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
                onBlur={() =>
                  change(
                    "mapping",
                    mapping.trim()
                      ? Object.fromEntries(
                          mapping
                            .split("\n")
                            .filter((line) => line.trim())
                            .map((line) => {
                              const [ref, ...rest] = line.split(":");
                              return [ref.trim(), Number(rest.join(":"))];
                            }),
                        )
                      : null,
                  )
                }
              />
            </Field>
          </fieldset>
        )}
        {node.kind === "match" && (
          <>
            <Field label="单场赛制">
              <select
                aria-label="单场赛制"
                value={params.matchFormat}
                onChange={(event) => change("matchFormat", event.target.value)}
              >
                {matchFormats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </Field>{" "}
          </>
        )}
        {["swiss", "round-robin"].includes(node.kind) && (
          <RankingProperties
            node={node}
            params={params}
            formats={formats}
            capacity={
              analysis?.nodes?.find((n: CanvasNode) => n.id === node.id)
                ?.capacity
            }
            windows={analysis?.values?.[node.id]?.windows}
            change={changeMany}
          />
        )}
        {node.kind === "expander" && (
          <ReadOnlyProperties
            fields={
              analysis?.nodes?.find((n: CanvasNode) => n.id === node.id)
                ?.readOnlyProperties ?? [
                {
                  key: "count",
                  label: "展开数量",
                  value: null,
                  source: "由输入集合推导",
                },
                { key: "inputCount", label: "来源集合数量", value: null },
                { key: "outputCount", label: "输出席位数", value: null },
                { key: "status", label: "状态", value: "等待集合输入" },
              ]
            }
          />
        )}
        {["selector-top", "selector-random", "generator"].includes(
          node.kind,
        ) && (
          <Field label={node.kind === "generator" ? "数量 N" : "数量 K"}>
            <input
              type="number"
              min={1}
              max={64}
              value={params.count}
              onChange={(e) => change("count", Number(e.target.value))}
            />
          </Field>
        )}
        {["selector-top", "selector-random"].includes(node.kind) && (
          <label className="canvas-check">
            <input
              type="checkbox"
              checked={params.showComplement}
              onChange={(e) => change("showComplement", e.target.checked)}
            />
            展示补集
          </label>
        )}
        {node.kind === "generator" && (
          <Field label="模式">
            <select
              aria-label="模式"
              value={params.mode}
              onChange={(e) => change("mode", e.target.value)}
            >
              <option value="reverse">倒序</option>
              <option value="random">随机不放回</option>
            </select>
          </Field>
        )}
        {(node.kind === "selector-random" ||
          (node.kind === "generator" && params.mode === "random")) && (
          <fieldset>
            <legend>随机设置</legend>
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
              重新随机
            </button>
            <p className="canvas-small">保存和预览沿用当前随机数种子。</p>
          </fieldset>
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
            <details className="canvas-boundary-advanced canvas-property-section">
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
        <fieldset className="canvas-display-options">
          <legend>显示设置</legend>
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
          {[
            "swiss",
            "round-robin",
            "pool",
            "selector-top",
            "selector-random",
            "subgraph",
          ].includes(node.kind) && (
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
        </fieldset>
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
