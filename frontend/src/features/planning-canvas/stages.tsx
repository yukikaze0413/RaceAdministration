import type { CanvasGraph, WavePlan } from "./types";
import { requestKey } from "../../shared/api";
export function Stages({
  graph,
  selected,
  disabled,
  onAction,
  wavePlan,
}: {
  graph: CanvasGraph;
  selected: string[];
  disabled: boolean;
  onAction: (a: any) => Promise<void>;
  wavePlan?: WavePlan;
}) {
  const stages = [...(graph.stages ?? [])].sort((a, b) => a.order - b.order);
  const move = (index: number, delta: number) => {
    const ids = stages.map((s) => s.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    void onAction({ type: "reorderStages", stageIds: ids });
  };
  const label = (id: string) =>
    id === "root" ? "主图" : (graph.nodes.find((n) => n.id === id)?.name ?? id);
  return (
    <section className="canvas-stages" aria-label="阶段管理">
      <h3>Stage · 阶段</h3>
      <button
        disabled={
          disabled || !selected.length || graph.schemaVersion !== "canvas-v2"
        }
        onClick={() =>
          void onAction({
            type: "createStage",
            id: requestKey(),
            name: "阶段 " + (stages.length + 1),
            selected,
          })
        }
      >
        创建阶段
      </button>
      <p>框选或多选比赛后创建阶段。后一阶段等待前一阶段全部结束。</p>
      {stages.map((s, i) => (
        <div key={s.id} className="canvas-stage-row" data-stage-id={s.id}>
          <label>
            阶段 {s.order} 名称
            <input
              aria-label={"阶段 " + s.order + " 名称"}
              defaultValue={s.name}
              key={s.id + s.name}
              disabled={disabled}
              onBlur={(e) => {
                if (e.target.value !== s.name)
                  void onAction({
                    type: "updateStage",
                    id: s.id,
                    name: e.target.value,
                  });
              }}
            />
          </label>
          <small>{s.nodeIds.length} 个赛程组件</small>
          <div className="canvas-stage-buttons">
            <button
              disabled={disabled || !selected.length}
              onClick={() =>
                void onAction({
                  type: "updateStage",
                  id: s.id,
                  selected: [...new Set([...s.nodeIds, ...selected])],
                })
              }
            >
              加入阶段 {s.order}
            </button>
            <button
              aria-label={"上移阶段 " + s.order}
              disabled={disabled || i === 0}
              onClick={() => move(i, -1)}
            >
              上移
            </button>
            <button
              aria-label={"下移阶段 " + s.order}
              disabled={disabled || i === stages.length - 1}
              onClick={() => move(i, 1)}
            >
              下移
            </button>
            <button
              disabled={disabled}
              onClick={() => void onAction({ type: "deleteStage", id: s.id })}
            >
              删除阶段 {s.order}
            </button>
          </div>
        </div>
      ))}
      {wavePlan && (
        <details open>
          <summary>验证批次（{wavePlan.waves.length}）</summary>
          {wavePlan.waves.map((w) => (
            <div className="canvas-wave-result" key={w.id}>
              <strong>
                {label(w.graphId)} · wave {w.number}
              </strong>
              <p>
                {stages.find((s) => s.id === w.stageId)?.name} ·{" "}
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
      )}
    </section>
  );
}
