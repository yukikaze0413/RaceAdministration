import { useEffect, useState } from "react";
import type { CanvasGraph, WavePlan } from "./types";
import { Field } from "../../shared/ui";
type Stage = NonNullable<CanvasGraph["stages"]>[number];
type Action = (a: any) => Promise<void>;

export function Stages({
  graph,
  selected,
  disabled,
  onCreate,
  onSelect,
  selectedStage,
}: {
  graph: CanvasGraph;
  selected: string[];
  disabled: boolean;
  onCreate: () => void;
  onSelect: (id: string) => void;
  selectedStage: string | null;
}) {
  const stages = [...(graph.stages ?? [])].sort((a, b) => a.order - b.order);
  return (
    <section className="canvas-stages" aria-label="阶段管理">
      <button
        disabled={disabled || !selected.length}
        onClick={onCreate}
        aria-label="创建阶段"
        aria-keyshortcuts="Control+Shift+G Meta+Shift+G"
      >
        Stage · 分组所选
      </button>
      <p className="canvas-small">Ctrl/⌘+Shift+G 分组</p>
      <p>后一阶段等待前一阶段全部结束。</p>
      {stages.map((s) => (
        <div key={s.id} className="canvas-stage-row" data-stage-id={s.id}>
          <button
            disabled={disabled}
            aria-label={`选择阶段 ${s.order} · ${s.name}`}
            aria-pressed={selectedStage === s.id}
            onClick={() => onSelect(s.id)}
          >
            Stage {s.order} · {s.name}
          </button>
          <small>{s.nodeIds.length} 个赛程组件</small>
        </div>
      ))}
    </section>
  );
}

export function StageProperties({
  graph,
  stage,
  disabled,
  onAction,
}: {
  graph: CanvasGraph;
  stage: Stage;
  disabled: boolean;
  onAction: Action;
}) {
  const stages = [...(graph.stages ?? [])].sort((a, b) => a.order - b.order);
  const [name, setName] = useState(stage.name);
  const [order, setOrder] = useState(
    stages.findIndex((s) => s.id === stage.id) + 1,
  );
  const [member, setMember] = useState("");
  useEffect(() => {
    setName(stage.name);
    setOrder(stages.findIndex((s) => s.id === stage.id) + 1);
    setMember("");
  }, [stage.id, stage.name, stage.order, stage.nodeIds]);
  const candidates = graph.nodes.filter(
    (n) => ["match", "swiss"].includes(n.kind) && !stage.nodeIds.includes(n.id),
  );
  return (
    <div className="canvas-stage-properties">
      <Field label="阶段名称">
        <input
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="阶段顺序">
        <select
          aria-label="阶段顺序"
          value={order}
          disabled={disabled}
          onChange={(e) => setOrder(Number(e.target.value))}
        >
          {stages.map((s, i) => (
            <option key={s.id} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </Field>
      <button
        disabled={disabled || !name.trim()}
        onClick={() =>
          void onAction({
            type: "updateStage",
            id: stage.id,
            name: name.trim(),
            order,
          })
        }
      >
        应用阶段属性
      </button>
      <h3>包含的元素（{stage.nodeIds.length}）</h3>
      {!stage.nodeIds.length && <p>阶段没有成员</p>}
      <ul className="canvas-stage-members">
        {stage.nodeIds.map((id) => {
          const n = graph.nodes.find((n) => n.id === id);
          return (
            <li key={id}>
              <span>
                {n?.name ?? id} · {n?.kind === "swiss" ? "瑞士轮" : "比赛"}
              </span>
              <button
                disabled={disabled}
                aria-label={"移除 " + id}
                onClick={() =>
                  void onAction({
                    type: "updateStage",
                    id: stage.id,
                    selected: stage.nodeIds.filter((x) => x !== id),
                  })
                }
              >
                移除
              </button>
            </li>
          );
        })}
      </ul>
      <Field label="添加阶段成员">
        <select
          aria-label="添加阶段成员"
          disabled={disabled}
          value={member}
          onChange={(e) => setMember(e.target.value)}
        >
          <option value="">选择赛程组件</option>
          {candidates.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} · {n.kind === "swiss" ? "瑞士轮" : "比赛"}
            </option>
          ))}
        </select>
      </Field>
      <button
        disabled={disabled || !member}
        onClick={() =>
          void onAction({
            type: "updateStage",
            id: stage.id,
            selected: [...stage.nodeIds, member],
          })
        }
      >
        添加成员
      </button>
      <p>移除成员和删除分组均保留组件及连线。</p>
      <button
        disabled={disabled}
        aria-keyshortcuts="Delete"
        onClick={() => void onAction({ type: "deleteStage", id: stage.id })}
      >
        删除阶段 {stage.order}
      </button>
    </div>
  );
}

export function WaveResults({
  graph,
  wavePlan,
}: {
  graph: CanvasGraph;
  wavePlan?: WavePlan;
}) {
  if (!wavePlan) return null;
  const label = (id: string) =>
    id === "root" ? "主图" : (graph.nodes.find((n) => n.id === id)?.name ?? id);
  return (
    <details open className="canvas-stages">
      <summary>验证批次（{wavePlan.waves.length}）</summary>
      {wavePlan.waves.map((w) => (
        <div className="canvas-wave-result" key={w.id}>
          <strong>
            {label(w.graphId)} · wave {w.number}
          </strong>
          <p>
            {graph.stages?.find((s) => s.id === w.stageId)?.name} ·{" "}
            {w.matchIds.length} 场 · {w.roundIds.length} 个瑞士轮
          </p>
          <small>
            前置：
            {w.requiresWaveIds
              .map((id) => {
                const p = wavePlan.waves.find((x) => x.id === id);
                return p ? label(p.graphId) + " wave " + p.number : id;
              })
              .join("、") || "无"}
          </small>
        </div>
      ))}
    </details>
  );
}
