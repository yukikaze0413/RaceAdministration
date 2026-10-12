import {
  useSessionState,
  sameValue,
  useSessionAccess,
} from "../configuration/session";
import { useEffect, useRef, useState } from "react";
import { requestKey } from "../../shared/api";
import { ErrorNotice, Field, useResource } from "../../shared/ui";
import { useWrite } from "../../shared/write";
import { PlanGraphEditor } from "./plan-editor";
export type GraphEditorProps = {
  payload: any;
  disabled: boolean;
  onChange: (p: any) => void;
  url: string;
  onLayoutDirty: (dirty: boolean) => void;
};
export function GraphEditor(props: GraphEditorProps) {
  return props.payload.structureVersion === "structure-v2" ? (
    <PlanGraphEditor {...props} />
  ) : (
    <LegacyGraphEditor {...props} />
  );
}
function LegacyGraphEditor({
  payload,
  disabled,
  onChange,
  url,
  onLayoutDirty,
}: {
  payload: any;
  disabled: boolean;
  onChange: (p: any) => void;
  url: string;
  onLayoutDirty: (dirty: boolean) => void;
}) {
  const state = useResource(url + "/layout"),
    write = useWrite();
  const [layout, setLayout] = useSessionState<any>("graph-layout", {
      version: 0,
      positions: {},
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [from, setFrom] = useState(""),
    [rank, setRank] = useState(1),
    [target, setTarget] = useState(""),
    [slot, setSlot] = useState(1),
    [dirty, setDirty] = useSessionState("graph-dirty", false);
  const [baseline, setBaseline] = useSessionState<any>("graph-baseline", {
      version: 0,
      positions: {},
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
    [initialized, setInitialized] = useSessionState("graph-initialized", false),
    [viewChanged, setViewChanged] = useSessionState(
      "graph-view-changed",
      false,
    );
  const sessionCache = useSessionAccess();
  useEffect(() => {
    sessionCache.set("graph-reload", state.reload);
    return () => {
      sessionCache.delete("graph-reload");
    };
  }, []);
  const drag = useRef<any>(null);
  useEffect(() => {
    onLayoutDirty(dirty);
  }, [dirty, onLayoutDirty]);
  useEffect(() => {
    if (
      state.data &&
      (!initialized || (!dirty && state.data.version !== baseline.version))
    ) {
      setBaseline(state.data);
      setInitialized(true);
      setLayout({
        ...state.data,
        ...(viewChanged ? { zoom: layout.zoom, pan: layout.pan } : {}),
      });
      setDirty(false);
    }
  }, [state.data]);
  const nodes: any[] = payload.stages
    .flatMap((s: any, index: number) =>
      s.groups.length
        ? s.groups.map((g: any, i: number) => ({
            id: g.id,
            ref: { stageId: s.id, groupId: g.id },
            capacity: g.capacity,
            order: s.order,
            title: "阶段" + s.order + " · 小组" + (i + 1),
            format: s.format ?? s.formatIntent,
            x: index * 400 + 30,
            y: i * 390 + 30,
          }))
        : [
            {
              ...s,
              format: s.format ?? s.formatIntent,
              ref: { stageId: s.id },
              title: "阶段" + s.order,
              x: index * 400 + 30,
              y: 30,
            },
          ],
    )
    .concat(
      payload.pools.map((p: any, i: number) => ({
        ...p,
        ref: { poolId: p.id },
        title: "选手池" + (i + 1),
        format: "pool",
        x: i * 400 + 30,
        y: 460,
      })),
    );
  const position = (n: any) =>
    Object.hasOwn(layout.positions, n.id)
      ? layout.positions[n.id]
      : { x: n.x, y: n.y };
  const refId = (ref: any) => ref.groupId ?? ref.stageId ?? ref.poolId;
  function change(next: any, editing = true) {
    if (editing && !initialized) return;
    setLayout(next);
    setNotice("");
    if (editing) {
      const positions = (l: any) =>
        Object.fromEntries(
          nodes.map((n) => [
            n.id,
            Object.hasOwn(l.positions, n.id)
              ? l.positions[n.id]
              : { x: n.x, y: n.y },
          ]),
        );
      setDirty(!sameValue(positions(next), positions(baseline)));
    } else setViewChanged(true);
  }
  function connect(source: any, to: any, where: number) {
    if (!source?.node || !to) return;
    const quota = source.node.format === "pool" ? source.node.capacity : 1;
    if (
      !Number.isInteger(where) ||
      where < 1 ||
      !Number.isInteger(source.rank) ||
      source.rank < 1 ||
      source.rank > source.node.capacity ||
      !Number.isInteger(quota) ||
      quota < 1 ||
      !Number.isInteger(to.capacity) ||
      where + quota - 1 > to.capacity
    ) {
      setNotice("来源名次或目标席位超出容量，请调整参数。");
      return;
    }
    const sig = (ref: any) =>
      ref.poolId ? "pool:" + ref.poolId : "stage:" + ref.stageId;
    const edges = new Map<string, string[]>();
    for (const r of payload.routes) {
      const a = sig(r.source),
        b = sig(r.target);
      edges.set(a, [...(edges.get(a) ?? []), b]);
    }
    const visited = new Set<string>();
    function reaches(id: string): boolean {
      if (id === sig(source.node.ref)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      return (edges.get(id) ?? []).some(reaches);
    }
    if (reaches(sig(to.ref))) {
      setNotice("连接会形成循环依赖，不能添加。");
      return;
    }

    if (
      source.node.id === to.id ||
      (source.node.order != null &&
        to.order != null &&
        source.node.order >= to.order)
    ) {
      setNotice("只能连接后续阶段，不能形成回路。");
      return;
    }
    const conflicts = payload.routes.filter(
      (r: any) =>
        refId(r.target) === to.id &&
        r.placement?.kind === "slot" &&
        r.placement.positions.includes(where),
    );
    if (conflicts.length && !window.confirm("此席位已有晋级连接，确认替换？"))
      return;
    const pool = source.node.format === "pool",
      positions = Array.from({ length: quota }, (_, i) => where + i);
    const route = {
      id: "r" + requestKey().replaceAll("-", ""),
      source: source.node.ref,
      target: to.ref,
      selector: pool
        ? { kind: "all" }
        : { kind: "rankRange", from: source.rank, to: source.rank },
      quota,
      sort: [{ field: pool ? "poolSeed" : "sourceRank", direction: "asc" }],
      placement: { kind: "slot", positions },
    };
    onChange({
      ...payload,
      routes: [
        ...payload.routes.filter((r: any) => !conflicts.includes(r)),
        route,
      ],
    });
    setSelected(null);
    setNotice("晋级连接已编辑，请保存草稿并校验。");
  }
  async function save() {
    setDirty(true);
    const live = Object.fromEntries(
      Object.entries(layout.positions).filter(([id]) =>
        nodes.some((n) => n.id === id),
      ),
    );
    const out = await write.run(url + "/layout", "PUT", {
      expectedVersion: layout.version,
      positions: live,
      zoom: layout.zoom,
      pan: layout.pan,
    });
    if (out) {
      setLayout(out);
      setBaseline(out);
      setViewChanged(false);
      setDirty(false);
      setNotice("布局已保存");
    }
  }
  const width = Math.max(1000, ...nodes.map((n) => position(n).x + 320)),
    height = Math.max(
      650,
      ...nodes.map(
        (n) => position(n).y + 150 + Math.min(n.capacity ?? 1, 16) * 36,
      ),
    );
  return (
    <section>
      <h2>赛制画布</h2>
      <p>
        选择小组名次，再选择目标席位即可连线。拖动卡片标题调整布局，拖动画布空白处平移；结构参数仍可在其他栏目编辑。
      </p>
      <div className="actions">
        <Field label="画布缩放">
          <input
            type="number"
            min={0.25}
            max={2}
            step={0.25}
            value={layout.zoom}
            onChange={(e) => {
              const z = Number(e.target.value);
              if (z >= 0.25 && z <= 2) change({ ...layout, zoom: z }, false);
            }}
          />
        </Field>
        <button
          onClick={() =>
            change({ ...layout, positions: {}, zoom: 1, pan: { x: 0, y: 0 } })
          }
        >
          自动排列
        </button>
        <button disabled={write.busy || state.loading} onClick={save}>
          保存画布布局
        </button>
      </div>
      {dirty && <p>布局有未保存修改。</p>}
      {state.data && state.data.version !== layout.version && dirty && (
        <section className="warning">
          <p>
            服务器布局版本 {state.data.version}，本地基于版本 {layout.version}
            ；本地位置和缩放已保留。
          </p>
          <details>
            <summary>比较布局</summary>
            <pre>
              {JSON.stringify({ server: state.data, local: layout }, null, 2)}
            </pre>
          </details>
          <button
            onClick={() => {
              if (window.confirm("确认使用本地布局作为新版本编辑？")) {
                setLayout({ ...layout, version: state.data.version });
                setBaseline(state.data);
                write.clearError();
              }
            }}
          >
            保留本地布局并使用新版本
          </button>
          <button
            onClick={() => {
              if (window.confirm("确认用服务器布局替换本地布局？")) {
                setLayout(state.data);
                setBaseline(state.data);
                setViewChanged(false);
                setDirty(false);
                write.clearError();
              }
            }}
          >
            使用服务器布局
          </button>
        </section>
      )}
      {state.error && (
        <ErrorNotice error={state.error} onRetry={state.reload} />
      )}
      {notice && <p role="status">{notice}</p>}
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={write.error.status === 409 ? state.reload : save}
        />
      )}
      <div
        className="graph-viewport"
        aria-label="赛事节点画布"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest(".graph-node")) return;
          drag.current = {
            mode: "pan",
            x: e.clientX,
            y: e.clientY,
            original: layout.pan,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const d = drag.current,
            dx = (e.clientX - d.x) / layout.zoom,
            dy = (e.clientY - d.y) / layout.zoom;
          if (d.mode === "pan")
            change(
              {
                ...layout,
                pan: { x: d.original.x + dx, y: d.original.y + dy },
              },
              false,
            );
          else
            change({
              ...layout,
              positions: {
                ...layout.positions,
                [d.id]: {
                  x: Math.max(0, d.original.x + dx),
                  y: Math.max(0, d.original.y + dy),
                },
              },
            });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div
          className="graph-world"
          style={{
            width,
            height,
            transform:
              "scale(" +
              layout.zoom +
              ") translate(" +
              layout.pan.x +
              "px," +
              layout.pan.y +
              "px)",
          }}
        >
          <svg width={width} height={height} aria-label="晋级连线">
            <defs>
              <marker
                id="route-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L6,3 z" fill="#2458b8" />
              </marker>
            </defs>
            {payload.routes.map((r: any) => {
              const a = nodes.find((n) => n.id === refId(r.source)),
                b = nodes.find((n) => n.id === refId(r.target));
              if (!a || !b) return null;
              const p = position(a),
                q = position(b),
                x = p.x + 280,
                y = p.y + 98 + 30 * ((r.selector?.from ?? 1) - 1),
                tx = q.x,
                ty = q.y + 98 + 30 * ((r.placement?.positions[0] ?? 1) - 1);
              return (
                <path
                  key={r.id}
                  className="graph-edge"
                  d={
                    "M" +
                    x +
                    "," +
                    y +
                    " C" +
                    (x + 65) +
                    "," +
                    y +
                    " " +
                    (tx - 65) +
                    "," +
                    ty +
                    " " +
                    tx +
                    "," +
                    ty
                  }
                  markerEnd="url(#route-arrow)"
                >
                  <title>
                    {a.title +
                      " 第" +
                      (r.selector?.from ?? 1) +
                      "名 → " +
                      b.title +
                      " 席位" +
                      r.placement?.positions.join(",")}
                  </title>
                </path>
              );
            })}
          </svg>
          {nodes.map((n) => {
            const p = position(n);
            return (
              <article
                className="graph-node"
                key={n.id}
                style={{ left: p.x, top: p.y }}
              >
                <button
                  className="graph-drag"
                  disabled={!initialized}
                  aria-label={"移动" + n.title}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    drag.current = {
                      mode: "node",
                      id: n.id,
                      x: e.clientX,
                      y: e.clientY,
                      original: p,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onKeyDown={(e) => {
                    const moves: Record<string, number[]> = {
                      ArrowLeft: [-20, 0],
                      ArrowRight: [20, 0],
                      ArrowUp: [0, -20],
                      ArrowDown: [0, 20],
                    };
                    if (moves[e.key]) {
                      e.preventDefault();
                      const [x, y] = moves[e.key];
                      change({
                        ...layout,
                        positions: {
                          ...layout.positions,
                          [n.id]: {
                            x: Math.max(0, p.x + x),
                            y: Math.max(0, p.y + y),
                          },
                        },
                      });
                    }
                  }}
                >
                  {n.title}
                </button>
                <p>
                  {n.format === "round-robin"
                    ? "单循环"
                    : n.format === "single-elimination"
                      ? "单败淘汰"
                      : n.format === "pool"
                        ? "合并重排"
                        : n.format}{" "}
                  · 容量 {n.capacity}
                </p>
                <div className="graph-ports">
                  <div>
                    {Array.from(
                      { length: Math.min(n.capacity ?? 1, 16) },
                      (_, i) => (
                        <button
                          key={i}
                          disabled={disabled || !selected}
                          onClick={() => connect(selected, n, i + 1)}
                          aria-label={n.title + "输入席位" + (i + 1)}
                        >
                          席位 {i + 1}
                        </button>
                      ),
                    )}
                  </div>
                  <div>
                    {Array.from(
                      {
                        length: Math.min(
                          n.format === "pool" ? 1 : (n.capacity ?? 1),
                          16,
                        ),
                      },
                      (_, i) => (
                        <button
                          key={i}
                          disabled={disabled}
                          aria-pressed={
                            selected?.node.id === n.id &&
                            selected?.rank === i + 1
                          }
                          onClick={() => setSelected({ node: n, rank: i + 1 })}
                          aria-label={n.title + "输出名次" + (i + 1)}
                        >
                          {n.format === "pool"
                            ? "池全量"
                            : "第" + (i + 1) + "名"}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <fieldset disabled={disabled}>
        <legend>键盘与移动端连接编辑</legend>
        <div className="form-grid">
          <Field label="连接来源">
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">请选择</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="来源名次">
            <input
              type="number"
              min={1}
              max={64}
              value={rank}
              onChange={(e) => setRank(Number(e.target.value))}
            />
          </Field>
          <Field label="连接目标">
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">请选择</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="目标席位">
            <input
              type="number"
              min={1}
              max={64}
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
            />
          </Field>
        </div>
        <button
          onClick={() =>
            connect(
              { node: nodes.find((n) => n.id === from), rank },
              nodes.find((n) => n.id === target),
              slot,
            )
          }
          disabled={!from || !target}
        >
          添加晋级连接
        </button>
        <ul className="list">
          {payload.routes.map((r: any) => (
            <li key={r.id}>
              <span>
                {nodes.find((n) => n.id === refId(r.source))?.title ??
                  refId(r.source)}{" "}
                ·{" "}
                {r.selector?.kind === "rankRange"
                  ? "第" + r.selector.from + "名"
                  : r.selector?.kind}{" "}
                →{" "}
                {nodes.find((n) => n.id === refId(r.target))?.title ??
                  refId(r.target)}{" "}
                · {r.placement?.kind} {r.placement?.positions?.join(",")}
              </span>
              <button
                onClick={() => {
                  if (window.confirm("确认删除此晋级连接？"))
                    onChange({
                      ...payload,
                      routes: payload.routes.filter((x: any) => x.id !== r.id),
                    });
                }}
              >
                删除连接
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    </section>
  );
}
