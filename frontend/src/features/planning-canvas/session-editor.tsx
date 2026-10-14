import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { api, failure, requestKey, type ApiFailure } from "../../shared/api";
import { ErrorNotice, Field } from "../../shared/ui";
import type { PlanningSession, WavePlan, Wave } from "./types";
export function SessionEditor({
  canvasId,
  onSaved,
  refresh = 0,
}: {
  canvasId: string;
  onSaved: () => void;
  refresh?: number;
}) {
  const [record, setRecord] = useState<any>(null),
    [sessions, setSessions] = useState<PlanningSession[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiFailure | null>(null),
    [status, setStatus] = useState(""),
    [pending, setPending] = useState<any>(null),
    [orderPreview, setOrderPreview] = useState<PlanningSession[] | null>(null);
  const active = useRef(true),
    request = useRef<any>(null);
  const dirty =
    !!record &&
    JSON.stringify(sessions) !==
      JSON.stringify(record.schedule?.sessions ?? []);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  async function load() {
    setBusy(true);
    setError(null);
    try {
      const r = await api(
        "/planning-canvases/" + encodeURIComponent(canvasId) + "/schedule",
      );
      if (active.current) {
        setRecord(r);
        setSessions(r.schedule?.sessions ?? []);
        setPending(null);
        request.current = null;
        setOrderPreview(null);
      }
    } catch (e) {
      if (active.current) setError(failure(e));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  useEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
    };
  }, [canvasId]);
  useEffect(() => {
    if (!refresh) return;
    if (dirty || pending)
      setStatus("赛程已刷新，本地排期保留；读取排期版本后检查变化");
    else void load();
  }, [refresh]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const plan: WavePlan | null = record?.currentWavePlan ?? null,
    waves = plan?.waves ?? [],
    locked = busy || !!pending;
  const used = new Set(sessions.flatMap((s) => s.waveIds)),
    available = waves.filter((w) => !used.has(w.id));
  const label = (w: Wave) =>
    (w.graphName ?? (w.graphId === "root" ? "主图" : "子图 " + w.graphId)) +
    " · " +
    (w.stageName ?? "") +
    " · wave " +
    w.number +
    " · " +
    (w.matchIds.length
      ? w.matchIds.length + " 场"
      : w.roundIds.length + " 个瑞士轮");
  const update = (id: string, fn: (s: PlanningSession) => PlanningSession) => {
    setSessions((old) => old.map((s) => (s.id === id ? fn(s) : s)));
    setStatus("");
    setOrderPreview(null);
  };
  function diagnostics() {
    const list: string[] = [],
      locations = new Map<
        string,
        { session: PlanningSession; index: number }
      >();
    for (const s of sessions)
      s.waveIds.forEach((id, index) => {
        if (locations.has(id)) list.push("批次重复安排");
        locations.set(id, { session: s, index });
        if (!waves.some((w) => w.id === id))
          list.push(s.name + "：批次引用失效");
      });
    for (const w of waves) {
      const to = locations.get(w.id);
      if (!to) continue;
      for (const id of w.requiresWaveIds) {
        const from = locations.get(id),
          p = waves.find((x) => x.id === id);
        if (!from)
          list.push(
            to.session.name + "：前置 " + (p ? label(p) : id) + " 尚未安排",
          );
        else if (from.session.id === to.session.id && from.index >= to.index)
          list.push(
            to.session.name + "：前置 " + (p ? label(p) : id) + " 必须提前",
          );
        else if (from.session.id !== to.session.id) {
          const a = from.session.timeRange,
            b = to.session.timeRange;
          if (!a || !b)
            list.push(to.session.name + "：跨 session 顺序需要时间段");
          else if (Date.parse(a.endAt) > Date.parse(b.startAt))
            list.push(
              to.session.name +
                "：前置 session " +
                from.session.name +
                " 尚未结束",
            );
        }
      }
    }
    return [...new Set(list)];
  }
  async function save(retry = false) {
    if (!record || !plan || busy || (!retry && pending)) return;
    setBusy(true);
    setError(null);
    const req = retry
      ? request.current
      : {
          method: "PUT",
          key: requestKey(),
          body: {
            expectedVersion: record.graphVersion,
            expectedScheduleVersion: record.version,
            wavePlanDigest: record.currentWavePlanDigest,
            sessions: structuredClone(sessions),
          },
        };
    request.current = req;
    setPending(req);
    try {
      const r = await api(
        "/planning-canvases/" + encodeURIComponent(canvasId) + "/schedule",
        req,
      );
      if (active.current) {
        setRecord({
          ...record,
          version: r.version,
          schedule: r.schedule,
          stale: false,
        });
        setPending(null);
        request.current = null;
        setStatus("排期已保存 · 版本 " + r.version);
        onSaved();
      }
    } catch (e) {
      if (active.current) {
        const er = failure(e);
        setError(er);
        if (!er.retryable) {
          setPending(null);
          request.current = null;
        }
      }
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function previewOrder() {
    if (
      sessions.some((s) =>
        s.waveIds.some((id) => !waves.some((w) => w.id === id)),
      )
    ) {
      setStatus("存在失效批次，请先替换或移除引用");
      return;
    }
    const next = structuredClone(sessions);
    for (const s of next) {
      const pendingIds = new Set(s.waveIds),
        ordered: string[] = [];
      while (pendingIds.size) {
        const ready = [...pendingIds]
          .filter((id) =>
            (waves.find((w) => w.id === id)?.requiresWaveIds ?? []).every(
              (p) => !pendingIds.has(p),
            ),
          )
          .sort((a, b) => {
            const x = waves.find((w) => w.id === a),
              y = waves.find((w) => w.id === b);
            return (x?.number ?? 0) - (y?.number ?? 0) || a.localeCompare(b);
          });
        if (!ready.length) {
          setStatus("无法重排：存在循环或失效引用");
          return;
        }
        for (const id of ready) {
          pendingIds.delete(id);
          ordered.push(id);
        }
      }
      s.waveIds = ordered;
    }
    setOrderPreview(next);
  }
  if (!record)
    return (
      <section className="session-editor">
        <h2>Session · 时段分组</h2>
        {error ? (
          <ErrorNotice error={error} onRetry={() => void load()} />
        ) : (
          <p>正在读取排期…</p>
        )}
      </section>
    );
  const warnings = diagnostics();
  return (
    <section className="session-editor" aria-label="Session 排期编辑">
      <h2>Session · 时段分组</h2>
      {!plan && <p>请回画布迁移、保存并验证，再安排批次。</p>}
      {record.stale && (
        <aside className="notice">
          验证产物已变化。修复旧批次引用后，再保存并绑定当前产物。
        </aside>
      )}
      {error && <ErrorNotice error={error} />}
      <p role="status">
        {busy
          ? "正在处理排期…"
          : status ||
            `排期版本 ${record.version} · 待安排 ${available.length} 个 wave`}
      </p>
      <div className="session-tools">
        <button
          disabled={locked || !plan}
          onClick={() =>
            setSessions((s) => [
              ...s,
              {
                id: requestKey(),
                name: "Session " + (s.length + 1),
                waveIds: [],
              },
            ])
          }
        >
          新建 session
        </button>
        <button disabled={locked || !plan} onClick={previewOrder}>
          预览依赖排序
        </button>
        <button disabled={locked || !plan} onClick={() => void save()}>
          保存排期
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (
              !dirty ||
              window.confirm("重新读取会舍弃本地排期修改，是否继续？")
            )
              void load();
          }}
        >
          读取排期版本
        </button>
      </div>
      {pending && (
        <aside className="notice">
          <p>保存结果未确认，使用原请求重试。</p>
          <button disabled={busy} onClick={() => void save(true)}>
            重试原排期请求
          </button>
        </aside>
      )}
      {orderPreview && (
        <aside className="notice">
          <p>
            排序预览：
            {orderPreview
              .map(
                (s) =>
                  s.name +
                  "：" +
                  s.waveIds
                    .map((id) => {
                      const w = waves.find((w) => w.id === id);
                      return w ? label(w) : "失效批次";
                    })
                    .join(" → "),
              )
              .join("；")}
          </p>
          <button
            onClick={() => {
              setSessions(orderPreview);
              setOrderPreview(null);
            }}
          >
            应用依赖排序
          </button>
          <button onClick={() => setOrderPreview(null)}>取消排序</button>
        </aside>
      )}
      <ul className="session-diagnostics">
        {warnings.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {sessions.map((s) => (
        <fieldset key={s.id} disabled={locked} className="session-card">
          <legend>{s.name}</legend>
          <Field label="Session 名称">
            <input
              value={s.name}
              onChange={(e) =>
                update(s.id, (x) => ({ ...x, name: e.target.value }))
              }
            />
          </Field>
          <div className="session-time-fields">
            <Field label="时段开始（含 UTC 偏移）">
              <input
                placeholder="2026-10-14T09:00:00+08:00"
                value={s.timeRange?.startAt ?? ""}
                onChange={(e) =>
                  update(s.id, (x) => ({
                    ...x,
                    timeRange: {
                      startAt: e.target.value,
                      endAt: x.timeRange?.endAt ?? "",
                    },
                  }))
                }
              />
            </Field>
            <Field label="时段结束（含 UTC 偏移）">
              <input
                placeholder="2026-10-14T12:00:00+08:00"
                value={s.timeRange?.endAt ?? ""}
                onChange={(e) =>
                  update(s.id, (x) => ({
                    ...x,
                    timeRange: {
                      endAt: e.target.value,
                      startAt: x.timeRange?.startAt ?? "",
                    },
                  }))
                }
              />
            </Field>
            <button
              onClick={() =>
                update(s.id, (x) => {
                  const y = { ...x };
                  delete y.timeRange;
                  return y;
                })
              }
            >
              清除时间段
            </button>
          </div>
          <Field label={s.name + " 添加 wave"}>
            <select
              value=""
              disabled={!plan}
              onChange={(e) => {
                if (e.target.value)
                  update(s.id, (x) => ({
                    ...x,
                    waveIds: [...x.waveIds, e.target.value],
                  }));
              }}
            >
              <option value="">选择待安排批次</option>
              {available.map((w) => (
                <option value={w.id} key={w.id}>
                  {label(w)}
                </option>
              ))}
            </select>
          </Field>
          <ol>
            {s.waveIds.map((id, i) => {
              const w = waves.find((w) => w.id === id),
                old = record.schedule?.boundWavePlan?.waves?.find(
                  (w: Wave) => w.id === id,
                );
              const needs =
                w?.requiresWaveIds
                  .map((p) => {
                    const found = waves.find((w) => w.id === p);
                    return found ? label(found) : p;
                  })
                  .join("、") || "无";
              const changed =
                old &&
                w &&
                JSON.stringify(old.requiresWaveIds) !==
                  JSON.stringify(w.requiresWaveIds);
              return (
                <li key={id} className={!w ? "session-stale-wave" : ""}>
                  <strong>{w ? label(w) : "失效批次"}</strong>
                  <small>前置：{needs}</small>
                  {record.stale && (
                    <p>
                      旧成员：
                      {[
                        ...(old?.matchIds ?? []),
                        ...(old?.roundIds ?? []),
                      ].join("、") || "无"}{" "}
                      · 旧前置 {old?.requiresWaveIds.length ?? 0} 个
                      {changed && " · 前置需求已变化"}
                    </p>
                  )}
                  {!w && (
                    <Field label="替换失效 wave">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value)
                            update(s.id, (x) => ({
                              ...x,
                              waveIds: x.waveIds.map((v) =>
                                v === id ? e.target.value : v,
                              ),
                            }));
                        }}
                      >
                        <option value="">选择当前批次</option>
                        {available.map((x) => (
                          <option key={x.id} value={x.id}>
                            {label(x)}
                            {old &&
                            [...x.matchIds, ...x.roundIds].some((m) =>
                              [...old.matchIds, ...old.roundIds].includes(m),
                            )
                              ? " · 成员匹配"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <div className="session-wave-tools">
                    <button
                      disabled={i === 0}
                      onClick={() =>
                        update(s.id, (x) => {
                          const a = [...x.waveIds];
                          [a[i - 1], a[i]] = [a[i], a[i - 1]];
                          return { ...x, waveIds: a };
                        })
                      }
                    >
                      上移 wave
                    </button>
                    <button
                      disabled={i === s.waveIds.length - 1}
                      onClick={() =>
                        update(s.id, (x) => {
                          const a = [...x.waveIds];
                          [a[i + 1], a[i]] = [a[i], a[i + 1]];
                          return { ...x, waveIds: a };
                        })
                      }
                    >
                      下移 wave
                    </button>
                    <button
                      onClick={() =>
                        update(s.id, (x) => ({
                          ...x,
                          waveIds: x.waveIds.filter((v) => v !== id),
                        }))
                      }
                    >
                      移除 wave
                    </button>
                    <select
                      aria-label="移动 wave 到 session"
                      value=""
                      onChange={(e) => {
                        const target = e.target.value;
                        if (target)
                          setSessions((all) =>
                            all.map((x) =>
                              x.id === s.id
                                ? {
                                    ...x,
                                    waveIds: x.waveIds.filter((v) => v !== id),
                                  }
                                : x.id === target
                                  ? { ...x, waveIds: [...x.waveIds, id] }
                                  : x,
                            ),
                          );
                      }}
                    >
                      <option value="">移动到其他 session</option>
                      {sessions
                        .filter((x) => x.id !== s.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            onClick={() =>
              setSessions((all) => all.filter((x) => x.id !== s.id))
            }
          >
            删除 session
          </button>
        </fieldset>
      ))}
      {available.length > 0 && (
        <details>
          <summary>待排期批次（{available.length}）</summary>
          {available.map((w) => (
            <p key={w.id}>{label(w)}</p>
          ))}
        </details>
      )}
      <p>时间段容量待确认。瑞士轮只预留整轮，真实配对待解析。</p>
      {blocker.state === "blocked" && (
        <aside className="notice">
          <p>排期尚未保存。</p>
          <button onClick={() => blocker.proceed()}>舍弃排期并离开</button>
          <button onClick={() => blocker.reset()}>继续编辑排期</button>
        </aside>
      )}
    </section>
  );
}
