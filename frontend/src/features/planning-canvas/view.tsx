import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasGraph, CanvasNode, Endpoint, Port } from "./types";
import { labels, typeLabels } from "./types";
import { expandStageMembers } from "./stage-members";
type View = { x: number; y: number; zoom: number };
export function CanvasView({
  graph,
  analysis,
  scope,
  selected,
  onSelect,
  onEnter,
  onPort,
  onMove,
  onInspect,
  onBoxSelect,
  selectedStage,
  selectedStages = [],
  selectedFrom,
  selectedTo,
  selectedEdge,
  onEdgeSelect,
  onDisconnect,
  onStageSelect,
  disabled = false,
}: {
  graph: CanvasGraph;
  analysis: any;
  scope: string | null;
  selected: string[];
  onSelect: (id: string) => void;
  onEnter: (id: string) => void;
  onPort: (end: Endpoint, p: Port) => void;
  onMove: (id: string, x: number, y: number, begin: boolean) => void;
  onInspect?: (id: string) => void;
  onBoxSelect?: (ids: string[]) => void;
  selectedStage?: string | null;
  selectedStages?: string[];
  selectedFrom?: Endpoint | null;
  selectedTo?: Endpoint | null;
  selectedEdge?: string | null;
  onEdgeSelect?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  onStageSelect?: (id: string, additive?: boolean) => void;
  disabled?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    world = useRef<HTMLDivElement>(null),
    drag = useRef<any>(null);
  const [view, setView] = useState<View>({ x: 20, y: 20, zoom: 0.6 }),
    [multiSelect, setMultiSelect] = useState(false),
    [boxMode, setBoxMode] = useState(false),
    [box, setBox] = useState<{
      x: number;
      y: number;
      w: number;
      h: number;
    } | null>(null),
    [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>(
      {},
    ),
    [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const nodes = graph.nodes.filter((n) => (n.parentId ?? null) === scope);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        drag.current = null;
        setBox(null);
        setBoxMode(false);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const worldPoint = (x: number, y: number) => {
    const rect = viewport.current!.getBoundingClientRect();
    return {
      x: (x - rect.left - view.x) / view.zoom,
      y: (y - rect.top - view.y) / view.zoom,
    };
  };
  const connected = (n: CanvasNode, p: Port) =>
    graph.edges.some((e) => {
      let end = p.direction === "input" ? e.to : e.from;
      if (end.node === n.id && end.port === p.id) return true;
      if (n.kind === "subgraph") return false;
      const seen = new Set<string>();
      let derivedSeeds = false;
      while (!seen.has(end.node)) {
        seen.add(end.node);
        const group = graph.nodes.find((x) => x.id === end.node);
        if (group?.kind !== "subgraph") break;
        let boundary = group.params.boundaries.find(
          (b: any) => b.id === end.port && b.direction === p.direction,
        );
        if (!boundary && p.direction === "output") {
          boundary = group.params.boundaries.find(
            (b: any) =>
              b.direction === "output" &&
              b.type === "collection" &&
              b.id + ":seeds" === end.port,
          );
          if (boundary) derivedSeeds = true;
        }
        if (!boundary) break;
        end = boundary.target;
      }
      if (derivedSeeds) end = { ...end, port: "seeds" };
      return end.node === n.id && end.port === p.id;
    });
  useLayoutEffect(() => {
    const measure = () => {
      if (!world.current) return;
      const wr = world.current.getBoundingClientRect(),
        a: typeof anchors = {},
        s: typeof sizes = {};
      world.current
        .querySelectorAll<HTMLElement>("[data-canvas-node]")
        .forEach((el) => {
          s[el.dataset.canvasNode!] = { w: el.offsetWidth, h: el.offsetHeight };
        });
      world.current
        .querySelectorAll<HTMLElement>("[data-anchor]")
        .forEach((el) => {
          const r = (
            el.querySelector(".port-dot") ?? el
          ).getBoundingClientRect();
          a[el.dataset.anchor!] = {
            x: (r.left + r.width / 2 - wr.left) / view.zoom,
            y: (r.top + r.height / 2 - wr.top) / view.zoom,
          };
        });
      setAnchors((old) =>
        JSON.stringify(old) === JSON.stringify(a) ? old : a,
      );
      setSizes((old) => (JSON.stringify(old) === JSON.stringify(s) ? old : s));
    };
    measure();
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (world.current)
      for (const el of world.current.querySelectorAll("[data-canvas-node]"))
        ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [graph, analysis, scope, view]);
  const fit = () => {
    if (!viewport.current || !nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.position.x)),
      minY = Math.min(...nodes.map((n) => n.position.y)),
      maxX = Math.max(
        ...nodes.map((n) => n.position.x + (sizes[n.id]?.w ?? 280)),
      ),
      maxY = Math.max(
        ...nodes.map((n) => n.position.y + (sizes[n.id]?.h ?? 200)),
      );
    const box = viewport.current.getBoundingClientRect(),
      zoom = Math.min(
        1.4,
        Math.max(
          0.08,
          Math.min(
            (box.width - 48) / (maxX - minX),
            (box.height - 48) / (maxY - minY),
          ),
        ),
      );
    setView({ zoom, x: 24 - minX * zoom, y: 24 - minY * zoom });
  };
  const zoom = (factor: number) =>
    setView((v) => ({
      ...v,
      zoom: Math.max(0.08, Math.min(2, v.zoom * factor)),
    }));
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      setView((v) => {
        const z = Math.max(
          0.08,
          Math.min(2, v.zoom * Math.exp(-e.deltaY * 0.001)),
        );
        return {
          zoom: z,
          x: x - ((x - v.x) * z) / v.zoom,
          y: y - ((y - v.y) * z) / v.zoom,
        };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const portButton = (n: CanvasNode, p: Port) => (
    <button
      key={p.id}
      type="button"
      className={
        "canvas-port port-" +
        p.type +
        " port-" +
        p.direction +
        ((p.direction === "output" ? selectedFrom : selectedTo)?.node ===
          n.id &&
        (p.direction === "output" ? selectedFrom : selectedTo)?.port === p.id
          ? " canvas-port-selected"
          : "")
      }
      aria-pressed={
        (p.direction === "output" ? selectedFrom : selectedTo)?.node === n.id &&
        (p.direction === "output" ? selectedFrom : selectedTo)?.port === p.id
      }
      data-anchor={JSON.stringify({
        node: n.id,
        port: p.id,
        direction: p.direction,
      })}
      disabled={disabled}
      aria-label={
        n.name +
        " " +
        p.label +
        " " +
        (p.direction === "input" ? "输入" : "输出")
      }
      title={typeLabels[p.type]}
      onClick={() => onPort({ node: n.id, port: p.id }, p)}
    >
      <span className="port-dot" />
      {p.label}
      <small>{typeLabels[p.type]}</small>
    </button>
  );
  return (
    <section className="canvas-scene">
      <div className="canvas-view-tools">
        <button onClick={fit}>适应全图</button>
        <button
          disabled={disabled || !selectedEdge}
          onClick={() => selectedEdge && onDisconnect?.(selectedEdge)}
        >
          删除所选连接
        </button>
        <button onClick={() => zoom(1.25)}>放大</button>
        <button onClick={() => zoom(0.8)}>缩小</button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <span className="canvas-selection-count">
          已选 {selected.length} 张
          {selectedStages.length > 0 && ` · ${selectedStages.length} 个 Stage`}
        </span>
        <button
          aria-pressed={multiSelect}
          onClick={() => setMultiSelect((v) => !v)}
        >
          多选模式
        </button>
        <button
          disabled={disabled}
          aria-pressed={boxMode}
          onClick={() => {
            setBoxMode((v) => !v);
            setBox(null);
          }}
        >
          框选模式
        </button>
        <button onClick={() => setView({ x: 20, y: 20, zoom: 1 })}>
          重置视图
        </button>
        <button
          disabled={!selected[0]}
          onClick={() => {
            const n = nodes.find((n) => n.id === selected[0]);
            if (n && viewport.current)
              setView((v) => ({
                ...v,
                x:
                  viewport.current!.clientWidth / 2 -
                  (n.position.x + 140) * v.zoom,
                y: 80 - n.position.y * v.zoom,
              }));
          }}
        >
          定位所选节点
        </button>
      </div>
      <div
        ref={viewport}
        className="canvas-viewport"
        aria-label="赛程规划画布区域"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-canvas-node]")) return;
          if (disabled) return;
          if (boxMode) {
            const p = worldPoint(e.clientX, e.clientY);
            drag.current = { kind: "select", original: p };
            setBox({ ...p, w: 0, h: 0 });
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
          drag.current = {
            kind: "pan",
            x: e.clientX,
            y: e.clientY,
            original: view,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (d.kind === "select") {
            const p = worldPoint(e.clientX, e.clientY);
            setBox({
              x: Math.min(d.original.x, p.x),
              y: Math.min(d.original.y, p.y),
              w: Math.abs(p.x - d.original.x),
              h: Math.abs(p.y - d.original.y),
            });
          } else if (d.kind === "pan")
            setView({
              ...d.original,
              x: d.original.x + e.clientX - d.x,
              y: d.original.y + e.clientY - d.y,
            });
          else
            onMove(
              d.id,
              Math.round(d.original.x + (e.clientX - d.x) / view.zoom),
              Math.round(d.original.y + (e.clientY - d.y) / view.zoom),
              false,
            );
        }}
        onPointerUp={() => {
          if (drag.current?.kind === "select" && box) {
            onBoxSelect?.(
              nodes
                .filter(
                  (n) =>
                    n.position.x < box.x + box.w &&
                    n.position.x + (sizes[n.id]?.w ?? 280) > box.x &&
                    n.position.y < box.y + box.h &&
                    n.position.y + (sizes[n.id]?.h ?? 200) > box.y,
                )
                .map((n) => n.id),
            );
            setBox(null);
          }
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
          setBox(null);
        }}
      >
        <div
          ref={world}
          className="canvas-world"
          style={{
            transform: `translate(${view.x}px,${view.y}px) scale(${view.zoom})`,
          }}
        >
          {(graph.stages ?? []).map((stage) => {
            const stageIds = expandStageMembers(graph, stage.nodeIds);
            const covered = nodes.filter((n) => {
              if (stageIds.includes(n.id)) return true;
              if (n.kind !== "subgraph") return false;
              return stageIds.some((id) => {
                let child = graph.nodes.find((x) => x.id === id);
                while (child?.parentId) {
                  if (child.parentId === n.id) return true;
                  child = graph.nodes.find((x) => x.id === child!.parentId);
                }
                return false;
              });
            });
            if (!covered.length) return null;
            const x = Math.min(...covered.map((n) => n.position.x)) - 20,
              y = Math.min(...covered.map((n) => n.position.y)) - 38;
            const right =
                Math.max(
                  ...covered.map((n) => n.position.x + (sizes[n.id]?.w ?? 280)),
                ) + 20,
              bottom =
                Math.max(
                  ...covered.map((n) => n.position.y + (sizes[n.id]?.h ?? 200)),
                ) + 20;
            return (
              <div
                key={stage.id}
                data-stage-frame={stage.id}
                className={
                  "canvas-stage-frame" +
                  (selectedStages.includes(stage.id) ||
                  selectedStage === stage.id
                    ? " canvas-stage-selected"
                    : "")
                }
                style={{
                  left: x,
                  top: y,
                  width: right - x,
                  height: bottom - y,
                }}
              >
                <button
                  className="canvas-stage-title"
                  aria-label={`选择阶段 ${stage.order} · ${stage.name}`}
                  aria-pressed={
                    selectedStages.includes(stage.id) ||
                    selectedStage === stage.id
                  }
                  disabled={disabled}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) =>
                    onStageSelect?.(
                      stage.id,
                      multiSelect || e.ctrlKey || e.metaKey,
                    )
                  }
                >
                  Stage {stage.order} · {stage.name}
                </button>
              </div>
            );
          })}
          {box && (
            <div
              className="canvas-selection-box"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            />
          )}
          <svg
            className="canvas-edges"
            width="20000"
            height="20000"
            aria-label="端口关系连线"
          >
            {graph.edges.map((e) => {
              const a =
                  anchors[JSON.stringify({ ...e.from, direction: "output" })],
                b = anchors[JSON.stringify({ ...e.to, direction: "input" })];
              if (!a || !b) return null;
              return (
                <g key={e.id}>
                  <path
                    data-canvas-edge={e.id}
                    className={
                      selectedEdge === e.id ? "canvas-edge-selected" : undefined
                    }
                    d={`M${a.x},${a.y} C${a.x + 90},${a.y} ${b.x - 90},${b.y} ${b.x},${b.y}`}
                    fill="none"
                    stroke="#425f83"
                    strokeWidth="2"
                  >
                    <title>
                      {e.from.node +
                        " " +
                        e.from.port +
                        " → " +
                        e.to.node +
                        " " +
                        e.to.port}
                    </title>
                  </path>
                  <path
                    data-canvas-edge-hit={e.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-label={
                      "选择连接 " +
                      (graph.nodes.find((n) => n.id === e.from.node)?.name ??
                        e.from.node) +
                      " → " +
                      (graph.nodes.find((n) => n.id === e.to.node)?.name ??
                        e.to.node)
                    }
                    d={`M${a.x},${a.y} C${a.x + 90},${a.y} ${b.x - 90},${b.y} ${b.x},${b.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="14"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => !disabled && onEdgeSelect?.(e.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (!disabled) onEdgeSelect?.(e.id);
                      }
                    }}
                  />
                </g>
              );
            })}
          </svg>
          {nodes.map((n) => {
            const info = analysis?.nodes?.find(
                (x: CanvasNode) => x.id === n.id,
              ),
              all: Port[] = info?.ports ?? [],
              ports = all.filter(
                (p) =>
                  !(
                    p.direction === "input" &&
                    n.display?.hideDanglingInputs &&
                    !connected(n, p)
                  ) &&
                  !(
                    p.direction === "output" &&
                    n.display?.hideDanglingOutputs &&
                    !connected(n, p)
                  ) &&
                  !(
                    p.type === "seed-map" &&
                    n.kind !== "source" &&
                    !n.display?.showSeeds
                  ) &&
                  !(
                    n.kind === "source" &&
                    p.type === "seat" &&
                    !connected(n, p)
                  ) &&
                  !(
                    n.kind === "match" &&
                    p.id === "L" &&
                    !n.display?.showLoser
                  ),
              );
            return (
              <article
                key={n.id}
                data-canvas-node={n.id}
                data-node-kind={n.kind}
                className={
                  "canvas-node " +
                  (selected.includes(n.id) ? "canvas-selected" : "")
                }
                style={{ left: n.position.x, top: n.position.y }}
                tabIndex={0}
                aria-label={"卡片 " + n.name}
                data-selected={selected.includes(n.id)}
                onClickCapture={(e) => {
                  if ((e.target as HTMLElement).closest(".canvas-port")) return;
                  if (e.ctrlKey || e.metaKey || multiSelect) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(n.id);
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    e.target !== e.currentTarget ||
                    ![" ", "Enter"].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  if (e.ctrlKey || e.metaKey) onSelect(n.id);
                  else onInspect?.(n.id);
                }}
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest("button, input"))
                    onInspect?.(n.id);
                }}
              >
                <header>
                  <button
                    className="canvas-drag"
                    disabled={disabled}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.ctrlKey || e.metaKey || multiSelect) return;
                      onMove(n.id, n.position.x, n.position.y, true);
                      drag.current = {
                        kind: "node",
                        id: n.id,
                        x: e.clientX,
                        y: e.clientY,
                        original: n.position,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onClick={() => onInspect?.(n.id)}
                    onKeyDown={(e) => {
                      const d: Record<string, number[]> = {
                        ArrowLeft: [-20, 0],
                        ArrowRight: [20, 0],
                        ArrowUp: [0, -20],
                        ArrowDown: [0, 20],
                      };
                      if (d[e.key]) {
                        e.preventDefault();
                        onMove(
                          n.id,
                          n.position.x + d[e.key][0],
                          n.position.y + d[e.key][1],
                          true,
                        );
                      }
                    }}
                  >
                    {n.name}
                  </button>
                  <span>{labels[n.kind]}</span>
                </header>
                <button
                  className="canvas-edit-parameters"
                  disabled={disabled}
                  onClick={() => onInspect?.(n.id)}
                  aria-label={"编辑 " + n.name + " 参数"}
                >
                  参数
                </button>
                {!n.display?.collapsed && (
                  <p className="canvas-node-summary">
                    {n.kind === "match"
                      ? (n.params.matchFormat === "bo1" ? "BO1" : "BO3") +
                        " · 验证自动分配 wave"
                      : ["selector-top", "selector-random"].includes(n.kind)
                        ? labels[n.kind] +
                          " · K=" +
                          n.params.count +
                          (n.params.showComplement ? " · 展示补集" : "")
                        : n.kind === "generator"
                          ? `${n.params.mode === "reverse" ? "倒序" : "随机"} · ${n.params.count} 位 · seed ${n.params.seed}`
                          : n.kind === "swiss"
                            ? `${n.params.participantCount ?? info?.capacity ?? "人数待定"} 人 · ${n.params.parameters?.roundCount ?? "规则限定"} 轮 · 完赛后全排名`
                            : n.kind === "round-robin"
                              ? `${n.params.ruleVersion === "double-round-robin-v2" ? "双循环" : "单循环"} · ${info?.capacity ?? "人数待定"} 人 · 整轮规划`
                              : info?.capacity != null
                                ? info.capacity + " 个席位"
                                : "容量待定"}
                  </p>
                )}
                <div
                  className={
                    "canvas-port-columns " +
                    (n.kind === "match" ? "match-ports" : "")
                  }
                >
                  <div>
                    {ports
                      .filter((p) => p.direction === "input")
                      .map((p) => portButton(n, p))}
                  </div>
                  <div>
                    {ports
                      .filter((p) => p.direction === "output")
                      .map((p) => portButton(n, p))}
                  </div>
                </div>
                {info?.hiddenConnectedLoser && (
                  <p className="canvas-port-hint">
                    L 已连接 · 展示败者后查看连线
                  </p>
                )}
                {n.kind === "subgraph" && (
                  <button onClick={() => onEnter(n.id)}>进入子图</button>
                )}
              </article>
            );
          })}
        </div>
      </div>
      <p className="canvas-hint">
        点击卡片查看参数；Ctrl/⌘ 点击增减多选，Ctrl/⌘+G
        封装。拖动标题移动，空白处平移，滚轮缩放。卡片聚焦后 Ctrl/⌘+空格可多选。
      </p>
    </section>
  );
}
