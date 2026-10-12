import { useEffect, useMemo, useState } from "react";
import { api, failure, type ApiFailure } from "../../shared/api";
import { ErrorNotice, Field, useResource } from "../../shared/ui";
import { useWrite } from "../../shared/write";
import {
  useSessionState,
  useSessionAccess,
  sameValue,
  structurePayload,
} from "../configuration/session";
import {
  unitGraph,
  overviewGraph,
  knownPlanIds,
  type PlanNode,
} from "./plan-graph";
import { PlanView } from "./plan-view";
import { PlanConnection } from "./plan-connection";
import { portOptions, sourceConsumers } from "./plan-ports";
import type { GraphEditorProps } from "./graph";
export function PlanGraphEditor({
  payload,
  disabled,
  onChange,
  url,
  onLayoutDirty,
}: GraphEditorProps) {
  const state = useResource(url + "/layout"),
    runtimeState = useResource(url.split("/configurations/")[0] + "/runtime"),
    write = useWrite(),
    cache = useSessionAccess();
  const [layout, setLayout] = useSessionState<any>("graph-layout", {
      version: 0,
      positions: {},
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
    [baseline, setBaseline] = useSessionState<any>("graph-baseline", {
      version: 0,
      positions: {},
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
    [initialized, setInitialized] = useSessionState("graph-initialized", false),
    [dirty, setDirty] = useSessionState("graph-dirty", false),
    [viewChanged, setViewChanged] = useSessionState(
      "graph-view-changed",
      false,
    ),
    [scope, setScope] = useSessionState("plan-scope", ""),
    [list, setList] = useSessionState(
      "plan-list",
      () => window.innerWidth <= 600,
    ),
    [compact, setCompact] = useSessionState("plan-compact", false);
  const [report, setReport] = useState<any>(null),
    [error, setError] = useState<ApiFailure | null>(null),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  const [source, setSource] = useState(""),
    [target, setTarget] = useState("");
  const signature = JSON.stringify(structurePayload(payload));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setReport(null);
    api(url + "/graph-plan", {
      method: "POST",
      body: {
        expectedVersion: payload.version,
        payload: JSON.parse(signature),
      },
      signal: controller.signal,
    }).then(
      (value) => {
        if (!controller.signal.aborted) {
          setReport(value);
          setLoading(false);
        }
      },
      (e) => {
        if (!controller.signal.aborted) {
          setError(failure(e));
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [signature, payload.version, url, revision]);
  useEffect(() => {
    cache.set("graph-reload", state.reload);
    return () => {
      cache.delete("graph-reload");
    };
  }, []);
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
  const plan = report?.plan,
    runtime =
      runtimeState.data?.runtime?.configurationId === payload.id
        ? runtimeState.data.runtime
        : undefined;
  const unit = plan?.units.find((u: any) => u.groupId === scope);
  const model = useMemo(
    () =>
      unit
        ? unitGraph(unit, plan, payload, runtime)
        : overviewGraph(payload, plan),
    [unit, plan, signature, runtime],
  );
  useEffect(() => {
    if (report) {
      cache.set("graph-node-ids", [
        ...new Set([
          ...(report.layoutNodeIds ?? []),
          ...(plan ? knownPlanIds(plan, runtime) : []),
        ]),
      ]);
      cache.set("graph-node-structure", signature);
    }
    const defaults = { ...(cache.get("graph-defaults") ?? {}) };
    model.nodes.forEach((n) => (defaults[n.id] = { x: n.x, y: n.y }));
    cache.set("graph-defaults", defaults);
  }, [model, plan, runtime, report]);
  function change(next: any, editing = true) {
    if (editing && !initialized) return;
    setLayout(next);
    setNotice("");
    if (!editing) {
      setViewChanged(true);
      return;
    }
    const defaults = cache.get("graph-defaults") ?? {},
      keys = new Set([
        ...Object.keys(next.positions),
        ...Object.keys(baseline.positions),
      ]);
    setDirty(
      [...keys].some(
        (id) =>
          !sameValue(
            Object.hasOwn(next.positions, id)
              ? next.positions[id]
              : defaults[id],
            Object.hasOwn(baseline.positions, id)
              ? baseline.positions[id]
              : defaults[id],
          ),
      ),
    );
  }
  async function save() {
    if (!initialized) return;
    setDirty(true);
    const validIds = new Set([
      ...payload.stages.map((s: any) => s.id),
      ...payload.stages.flatMap((s: any) => s.groups.map((g: any) => g.id)),
      ...payload.pools.map((p: any) => p.id),
      ...(plan ? knownPlanIds(plan, runtime) : []),
      ...(report?.layoutNodeIds ?? []),
    ]);
    const out = await write.run(url + "/layout", "PUT", {
      expectedVersion: layout.version,
      positions: Object.fromEntries(
        Object.entries(layout.positions).filter(([id]) => validIds.has(id)),
      ),
      zoom: layout.zoom,
      pan: layout.pan,
    });
    if (out) {
      setLayout(out);
      setBaseline(out);
      setDirty(false);
      setViewChanged(false);
      setNotice("布局已保存");
    }
  }
  function align(axis: "x" | "y") {
    const selectedNodes = model.nodes.filter((n) => selected.includes(n.id));
    if (selectedNodes.length < 2) return;
    const coordinate = Math.min(
        ...selectedNodes.map((n) => (layout.positions[n.id] ?? n)[axis]),
      ),
      positions = { ...layout.positions };
    selectedNodes.forEach(
      (n) =>
        (positions[n.id] = {
          x: (layout.positions[n.id] ?? n).x,
          y: (layout.positions[n.id] ?? n).y,
          [axis]: coordinate,
        }),
    );
    change({ ...layout, positions });
  }
  return (
    <section className="plan-editor">
      <h2>完整赛制画布</h2>
      <p>
        阶段总览查看晋级关系；选择小组可查看完整比赛、胜败来源及条件节点。列表适合手机阅读；方向键移动标题可保存位置。
      </p>
      <div className="actions">
        {!unit && (
          <button
            disabled={!initialized}
            onClick={() => {
              const positions = { ...layout.positions };
              for (const stage of payload.stages)
                for (const [index, g] of stage.groups.entries()) {
                  const node = model.nodes.find((n) => n.id === g.id);
                  if (node)
                    positions[g.id] = {
                      x: node.x,
                      y: 40 + (stage.groups.length - index - 1) * 260,
                    };
                }
              change({ ...layout, positions });
            }}
          >
            小组反向排序
          </button>
        )}
        <Field label="查看比赛子图">
          <select
            value={unit ? scope : ""}
            onChange={(e) => {
              setScope(e.target.value);
              setSelected([]);
            }}
          >
            <option value="">阶段总览</option>
            {payload.stages.flatMap((s: any) =>
              s.groups.map((g: any, i: number) => (
                <option key={g.id} value={g.id}>
                  {s.name} · 小组{i + 1}
                </option>
              )),
            )}
          </select>
        </Field>
        <button onClick={() => setList(!list)}>
          {list ? "查看画布" : "查看列表"}
        </button>
        <button onClick={() => setCompact(!compact)}>
          {compact ? "展开来源" : "折叠来源"}
        </button>
        <Field label="画布缩放">
          <input
            type="number"
            min={0.25}
            max={2}
            step={0.25}
            value={layout.zoom}
            onChange={(e) => {
              const zoom = Number(e.target.value);
              if (zoom >= 0.25 && zoom <= 2) change({ ...layout, zoom }, false);
            }}
          />
        </Field>
      </div>
      <div className="actions">
        <button
          disabled={!initialized}
          onClick={() => {
            const ids = new Set(model.nodes.map((n) => n.id));
            change({
              ...layout,
              positions: Object.fromEntries(
                Object.entries(layout.positions).filter(([id]) => !ids.has(id)),
              ),
              zoom: 1,
              pan: { x: 0, y: 0 },
            });
          }}
        >
          恢复当前图自动布局
        </button>
        <button
          disabled={!initialized || selected.length < 2}
          onClick={() => align("x")}
        >
          选中节点左对齐
        </button>
        <button
          disabled={!initialized || selected.length < 2}
          onClick={() => align("y")}
        >
          选中节点上对齐
        </button>
        <button disabled={write.busy || !initialized || loading} onClick={save}>
          保存画布布局
        </button>
        <button onClick={runtimeState.reload}>刷新比赛状态</button>
      </div>
      {loading && <p role="status">正在生成完整比赛图…</p>}
      {notice && <p role="status">{notice}</p>}
      {dirty && <p>布局有未保存修改。</p>}
      {error && (
        <ErrorNotice error={error} onRetry={() => setRevision((n) => n + 1)} />
      )}
      {state.error && (
        <ErrorNotice error={state.error} onRetry={state.reload} />
      )}
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={write.error.status === 409 ? state.reload : save}
        />
      )}
      {state.data && state.data.version !== layout.version && dirty && (
        <section className="warning">
          <p>
            服务器布局版本{state.data.version}，本地基于版本{layout.version}
            ，位置已保留。
          </p>
          <button
            onClick={() => {
              if (window.confirm("确认保留本地位置并基于新版本保存？")) {
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
                setDirty(false);
                setViewChanged(false);
                write.clearError();
              }
            }}
          >
            使用服务器布局
          </button>
        </section>
      )}
      {report && !report.structureValid && (
        <section className="warning">
          <p>当前结构尚不能生成完整比赛图，请先修正：</p>
          <ul>
            {report.diagnostics
              .filter((d: any) => d.severity === "error")
              .map((d: any, i: number) => (
                <li key={i}>{d.reason}</li>
              ))}
          </ul>
        </section>
      )}
      <PlanConnection
        payload={payload}
        disabled={disabled}
        onChange={onChange}
        url={url}
        source={source}
        setSource={setSource}
        target={target}
        setTarget={setTarget}
      />
      <PlanView
        model={model}
        layout={layout}
        editable={initialized && !write.busy}
        list={list}
        compact={compact}
        onLayout={change}
        selected={selected}
        onSelect={(id) =>
          setSelected(
            selected.includes(id)
              ? selected.filter((x) => x !== id)
              : [...selected, id],
          )
        }
        onOpenGroup={(id) => setScope(id)}
        renderPorts={(node) => {
          const owner =
            node.kind === "group" || node.kind === "pool"
              ? node.id
              : ["input", "output"].includes(node.kind)
                ? unit?.groupId
                : undefined;
          if (!owner) return null;
          return (
            <div className="plan-port-buttons">
              {(["source", "target"] as const).flatMap((side) =>
                portOptions(payload, side)
                  .filter(
                    (p) =>
                      p.owner === owner &&
                      (node.kind !== "input" || side === "target") &&
                      (node.kind !== "output" || side === "source"),
                  )
                  .map((p) => (
                    <button
                      key={side + p.key}
                      disabled={disabled}
                      aria-pressed={
                        (side === "source" ? source : target) === p.key
                      }
                      onClick={() =>
                        side === "source" ? setSource(p.key) : setTarget(p.key)
                      }
                      title={p.label}
                    >
                      {side === "source" ? "出口" : "入口"} ·{" "}
                      {p.ref.port ?? "汇合"}
                      {side === "source" &&
                      sourceConsumers(payload.routes, p.ref, 1, p.capacity)
                        .length
                        ? " · 已分配"
                        : ""}
                    </button>
                  )),
              )}
            </div>
          );
        }}
      />
      {disabled && <p>比赛关系当前只读，仍可查看或保存独立布局。</p>}
    </section>
  );
}
