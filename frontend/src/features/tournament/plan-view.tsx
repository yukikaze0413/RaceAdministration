import { useId, useRef, type ReactNode } from "react";
import type { PlanNode, PlanEdge } from "./plan-graph";
export function PlanView({
  model,
  layout,
  editable = false,
  list = false,
  compact = false,
  onLayout,
  onOpenGroup,
  renderPorts,
  onSelect,
  selected = [],
  readOnly = false,
}: {
  model: { nodes: PlanNode[]; edges: PlanEdge[] };
  layout: any;
  editable?: boolean;
  list?: boolean;
  compact?: boolean;
  onLayout?: (layout: any, editing: boolean) => void;
  onOpenGroup?: (id: string) => void;
  renderPorts?: (node: PlanNode) => ReactNode;
  onSelect?: (id: string) => void;
  selected?: string[];
  readOnly?: boolean;
}) {
  const drag = useRef<any>(null),
    marker = "plan-arrow-" + useId().replace(/[^a-zA-Z0-9-]/g, "");
  const position = (node: PlanNode) =>
    Object.hasOwn(layout.positions, node.id)
      ? layout.positions[node.id]
      : { x: node.x, y: node.y };
  const move = (node: PlanNode, x: number, y: number) =>
    onLayout?.(
      {
        ...layout,
        positions: {
          ...layout.positions,
          [node.id]: {
            x: Math.max(0, Math.min(200000, x)),
            y: Math.max(0, Math.min(200000, y)),
          },
        },
      },
      true,
    );
  const card = (node: PlanNode) => {
    const p = position(node);
    return (
      <article
        key={node.id}
        className={
          "plan-node " +
          (node.condition ? "plan-condition " : "") +
          (list ? "plan-list-node" : "")
        }
        data-kind={node.kind}
        data-plan-key={node.id}
        style={
          list
            ? undefined
            : { left: p.x, top: p.y, width: node.width, height: node.height }
        }
      >
        <div className="plan-node-title">
          {onSelect && (
            <input
              type="checkbox"
              aria-label={"选择" + node.title}
              checked={selected.includes(node.id)}
              onChange={() => onSelect(node.id)}
            />
          )}
          {readOnly ? (
            <strong className="plan-read-title">{node.title}</strong>
          ) : (
            <button
              className="graph-drag"
              aria-label={"移动" + node.title}
              disabled={!editable}
              onPointerDown={(e) => {
                if (list) return;
                e.stopPropagation();
                drag.current = {
                  id: node.id,
                  x: e.clientX,
                  y: e.clientY,
                  original: p,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                const deltas: Record<string, number[]> = {
                  ArrowLeft: [-20, 0],
                  ArrowRight: [20, 0],
                  ArrowUp: [0, -20],
                  ArrowDown: [0, 20],
                };
                if (editable && deltas[e.key]) {
                  e.preventDefault();
                  const [x, y] = deltas[e.key];
                  move(node, p.x + x, p.y + y);
                }
              }}
            >
              {node.title}
            </button>
          )}
        </div>
        <p className="plan-node-status">
          {node.status}
          {node.bestOf !== undefined ? ` · BO${node.bestOf}` : ""}
        </p>
        {!compact &&
          node.sources.map((s, i) => (
            <p className="plan-source" key={i} title={s}>
              {s}
              {node.actual?.decision?.kind === "score"
                ? ` · ${node.actual.decision.scores[i] ?? ""}`
                : ""}
            </p>
          ))}
        {node.actual?.decision?.kind === "double-loss" && <p>双方判负</p>}
        {node.condition && (
          <p className="plan-condition-hint">败者组冠军赢首次总决赛后才激活</p>
        )}
        {node.kind === "group" && onOpenGroup && (
          <button className="plan-open" onClick={() => onOpenGroup(node.id)}>
            查看完整比赛子图
          </button>
        )}
        {renderPorts?.(node)}
      </article>
    );
  };
  if (list)
    return (
      <div className="plan-list" aria-label="完整比赛列表">
        {[...model.nodes].sort((a, b) => a.x - b.x || a.y - b.y).map(card)}
      </div>
    );
  const width = Math.max(
      1000,
      ...model.nodes.map((n) => position(n).x + n.width + 30),
    ),
    height = Math.max(
      600,
      ...model.nodes.map((n) => position(n).y + n.height + 30),
    );
  return (
    <div
      className="graph-viewport plan-viewport"
      aria-label="完整比赛画布"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(".plan-node")) return;
        drag.current = { x: e.clientX, y: e.clientY, original: layout.pan };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const d = drag.current,
          dx = (e.clientX - d.x) / layout.zoom,
          dy = (e.clientY - d.y) / layout.zoom;
        if (d.id) {
          const node = model.nodes.find((n) => n.id === d.id);
          if (node) move(node, d.original.x + dx, d.original.y + dy);
        } else
          onLayout?.(
            { ...layout, pan: { x: d.original.x + dx, y: d.original.y + dy } },
            false,
          );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div
        className="graph-world"
        style={{
          width,
          height,
          transform: `scale(${layout.zoom}) translate(${layout.pan.x}px,${layout.pan.y}px)`,
        }}
      >
        <svg width={width} height={height} aria-label="胜败与前置来源连线">
          <defs>
            {["winner", "loser"].map((kind) => (
              <marker
                key={kind}
                id={marker + kind}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path
                  d="M0,0 L0,6 L6,3 z"
                  fill={kind === "loser" ? "#b45309" : "#2458b8"}
                />
              </marker>
            ))}
          </defs>
          {model.edges.map((edge) => {
            const a = model.nodes.find((n) => n.id === edge.from),
              b = model.nodes.find((n) => n.id === edge.to);
            if (!a || !b) return null;
            const p = position(a),
              q = position(b),
              x = p.x + a.width,
              y = p.y + a.height / 2,
              tx = q.x,
              ty = q.y + b.height / 2;
            return (
              <path
                key={edge.id}
                className={"graph-edge plan-edge-" + edge.kind}
                d={`M${x},${y} C${x + 40},${y} ${tx - 40},${ty} ${tx},${ty}`}
                markerEnd={`url(#${marker + (edge.kind === "loser" ? "loser" : "winner")})`}
              >
                <title>{a.title + " · " + edge.label + " → " + b.title}</title>
              </path>
            );
          })}
        </svg>
        {model.nodes.map(card)}
      </div>
    </div>
  );
}
