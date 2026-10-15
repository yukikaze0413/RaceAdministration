import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, failure, type ApiFailure } from "../../shared/api";
import { ErrorNotice, Field } from "../../shared/ui";
import { SessionEditor } from "./session-editor";
import "./preview-page.css";

type Project = { id: string; name: string; version: number };
type ScheduleMatch = {
  id: string;
  name: string;
  planKey: string;
  bestOf: number;
  batch: string | null;
  A: { label: string } | null;
  B: { label: string } | null;
  condition: any;
  bye?: "A" | "B" | "both" | null;
  project: Project;
  stageId?: string;
  stageName?: string;
  graphId?: string;
  graphName?: string;
  waveId?: string;
  sessionId?: string;
  sessionName?: string;
  sessionRange?: { startAt: string; endAt: string };
};
export function scheduleGroups(matches: ScheduleMatch[]) {
  const groups = new Map<string, ScheduleMatch[]>();
  const sorted = [...matches].sort((a, b) =>
    (a.sessionRange?.startAt ?? "9999").localeCompare(
      b.sessionRange?.startAt ?? "9999",
    ),
  );
  for (const m of sorted) {
    const time = m.sessionRange?.startAt;
    const key = time
      ? time.slice(0, 10)
      : "时间待定" + (m.batch ? " · " + m.batch : "");
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()];
}

export function CanvasSchedulePage() {
  const [query, setQuery] = useSearchParams();
  const chosen = query.get("canvas") || "all";
  const [projects, setProjects] = useState<Project[]>([]),
    [matches, setMatches] = useState<ScheduleMatch[]>([]),
    [windows, setWindows] = useState<any[]>([]),
    [excluded, setExcluded] = useState<{ project: Project; reason: string }[]>(
      [],
    ),
    [busy, setBusy] = useState(true),
    [error, setError] = useState<ApiFailure | null>(null),
    [search, setSearch] = useState(""),
    [batch, setBatch] = useState(""),
    [graphFilter, setGraphFilter] = useState(""),
    [waveFilter, setWaveFilter] = useState(""),
    [sessionFilter, setSessionFilter] = useState(""),
    [schedules, setSchedules] = useState<Record<string, any>>({}),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setBusy(true);
    setError(null);
    setMatches([]);
    setWindows([]);
    setExcluded([]);
    setBatch("");
    setGraphFilter("");
    setWaveFilter("");
    setSessionFilter("");
    setSchedules({});
    (async () => {
      try {
        const list = await api<Project[]>("/planning-canvases", {
          signal: controller.signal,
        });
        if (!active) return;
        setProjects(list);
        const requested =
          chosen === "all"
            ? list
            : [{ id: chosen, name: "所选项目", version: 0 }];
        const results = await Promise.all(
          requested.map(async (project) => {
            const record = await api<any>(
              "/planning-canvases/" + encodeURIComponent(project.id),
              { signal: controller.signal },
            );
            const current = {
              id: record.id,
              name: record.name,
              version: record.version,
            };
            try {
              const preview = await api<any>(
                "/planning-canvases/" +
                  encodeURIComponent(record.id) +
                  "/preview",
                {
                  method: "POST",
                  body: { expectedVersion: record.version },
                  signal: controller.signal,
                },
              );
              const schedule = await api<any>(
                "/planning-canvases/" +
                  encodeURIComponent(record.id) +
                  "/schedule",
                { signal: controller.signal },
              );
              return { project: current, preview, schedule };
            } catch (e) {
              const er = failure(e);
              if (
                !["VALIDATION_REQUIRED", "VERSION_CONFLICT"].includes(
                  er.code ?? "",
                )
              )
                throw e;
              return { project: current, reason: er.message };
            }
          }),
        );
        if (!active) return;
        setMatches(
          results.flatMap(
            (r) =>
              r.preview?.matches.map((m: any) => ({
                ...m,
                project: r.project,
              })) ?? [],
          ),
        );
        setWindows(
          results.flatMap(
            (r) =>
              r.preview?.windows.map((w: any) => ({
                ...w,
                project: r.project,
              })) ?? [],
          ),
        );
        setExcluded(
          results
            .filter((r) => r.reason)
            .map((r) => ({ project: r.project, reason: r.reason! })),
        );
        setSchedules(
          Object.fromEntries(
            results
              .filter((r) => r.schedule)
              .map((r) => [r.project.id, r.schedule]),
          ),
        );
      } catch (e) {
        if (active) setError(failure(e));
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [chosen, reload]);
  const withSession = (m: any) => {
    const data = schedules[m.project.id],
      session =
        !data?.stale &&
        data?.schedule?.sessions.find((s: any) => s.waveIds.includes(m.waveId));
    return {
      ...m,
      sessionId: session?.id,
      sessionName: session?.name,
      sessionRange: session?.timeRange,
    };
  };
  const displayed = matches.map(withSession);
  const displayedWindows = windows.map(withSession);
  const allItems = [...displayed, ...displayedWindows];
  const stageKey = (m: ScheduleMatch) =>
    m.stageId
      ? m.project.id + "/" + m.stageId
      : "";
  const matchesFilter = (m: any) => {
    const text = [
      m.name,
      m.A?.label,
      m.B?.label,
      m.project.name,
      m.batch,
      ...(m.fixtures ?? []).flatMap((f: any) => [f.A?.label, f.B?.label]),
      ...(m.rest ?? []).map((s: any) => s.label),
    ]
      .join(" ")
      .toLowerCase();
    const date = m.sessionRange?.startAt?.slice(0, 10);
    return (
      (!search || text.includes(search.toLowerCase())) &&
      (!batch || stageKey(m) === batch) &&
      (!graphFilter || m.project.id + "/" + m.graphId === graphFilter) &&
      (!waveFilter || m.project.id + "/" + m.waveId === waveFilter) &&
      (!sessionFilter || m.project.id + "/" + m.sessionId === sessionFilter) &&
      (!start || (!!date && date >= start)) &&
      (!end || (!!date && date <= end))
    );
  };
  const filtered = displayed.filter(matchesFilter);
  const filteredWindows = displayedWindows.filter(matchesFilter);
  const groups = scheduleGroups(filtered);
  const back =
    chosen !== "all"
      ? "/canvas-lab?canvas=" + encodeURIComponent(chosen)
      : "/canvas-lab";
  return (
    <div className="canvas-schedule-page">
      <header className="schedule-page-heading">
        <div>
          <Link to={back}>返回画布</Link>
          <h1>赛程预览</h1>
          <p>已保存并通过验证的规划版本，显示预计时间和未来参赛来源。</p>
        </div>
        <button onClick={() => setReload((n) => n + 1)} disabled={busy}>
          刷新赛程
        </button>
      </header>
      <div className="schedule-page-layout">
        <aside className="schedule-filters" aria-label="赛程筛选">
          <h2>筛选赛程</h2>
          <Field label="赛事项目">
            <select
              value={chosen}
              onChange={(e) => setQuery({ canvas: e.target.value })}
            >
              <option value="all">所有已验证项目</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="阶段筛选">
            <select
              aria-label="阶段筛选"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            >
              <option value="">全部阶段</option>
              {[...new Map(allItems.map((m) => [stageKey(m), m])).entries()]
                .filter(([key]) => key)
                .map(([key, m]) => (
                  <option key={key} value={key}>
                    {chosen === "all" ? m.project.name + " · " : ""}
                    {m.stageName ?? m.batch}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Graph 筛选">
            <select
              value={graphFilter}
              aria-label="Graph 筛选"
              onChange={(e) => setGraphFilter(e.target.value)}
            >
              <option value="">全部图</option>
              {[
                ...new Map(
                  allItems
                    .filter((m) => m.graphId)
                    .map((m) => [m.project.id + "/" + m.graphId, m]),
                ).entries(),
              ].map(([key, m]) => (
                <option key={key} value={key}>
                  {m.project.name} ·{" "}
                  {m.graphName ?? (m.graphId === "root" ? "主图" : m.graphId)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Wave 筛选">
            <select
              value={waveFilter}
              aria-label="Wave 筛选"
              onChange={(e) => setWaveFilter(e.target.value)}
            >
              <option value="">全部批次</option>
              {[
                ...new Map(
                  allItems
                    .filter((m) => m.waveId)
                    .map((m) => [m.project.id + "/" + m.waveId, m]),
                ).entries(),
              ].map(([key, m]) => (
                <option key={key} value={key}>
                  {m.project.name} ·{" "}
                  {m.graphName ?? (m.graphId === "root" ? "主图" : m.graphId)} ·{" "}
                  {m.batch}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Session 筛选">
            <select
              value={sessionFilter}
              aria-label="Session 筛选"
              onChange={(e) => setSessionFilter(e.target.value)}
            >
              <option value="">全部时段分组</option>
              {[
                ...new Map(
                  allItems
                    .filter((m) => m.sessionId)
                    .map((m) => [m.project.id + "/" + m.sessionId, m]),
                ).entries(),
              ].map(([key, m]) => (
                <option key={key} value={key}>
                  {m.sessionName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="比赛搜索">
            <input
              type="search"
              placeholder="选手、来源、比赛名称"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="开始日期">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="结束日期">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <button
            onClick={() => {
              setSearch("");
              setBatch("");
              setStart("");
              setEnd("");
              setGraphFilter("");
              setWaveFilter("");
              setSessionFilter("");
            }}
          >
            重置筛选
          </button>
          <p>Session 显示整个时段。未排期的比赛单列“时间待定”。</p>
        </aside>
        <section className="schedule-results" aria-label="比赛列表">
          {chosen !== "all" && (
            <SessionEditor
              key={chosen}
              canvasId={chosen}
              refresh={reload}
              onSaved={() => setReload((n) => n + 1)}
            />
          )}
          {chosen === "all" && <p>选择一个赛事项目，编辑 session 排期。</p>}
          <p className="schedule-summary" role="status">
            {busy
              ? "正在读取赛程…"
              : `显示 ${filtered.length} / ${matches.length} 场比赛${windows.length ? ` · ${filteredWindows.length} / ${windows.length} 轮` : ""}`}
          </p>
          {error && (
            <ErrorNotice
              error={error}
              onRetry={() => setReload((n) => n + 1)}
            />
          )}
          {excluded.map(({ project, reason }) => (
            <aside className="schedule-excluded" key={project.id}>
              <strong>{project.name}</strong>：{reason}。{" "}
              <Link to={"/canvas-lab?canvas=" + encodeURIComponent(project.id)}>
                返回项目保存并验证
              </Link>
            </aside>
          ))}
          {!busy && !error && !groups.length && !filteredWindows.length && (
            <p className="schedule-empty">
              没有符合条件的比赛。可调整筛选，或回到画布完成保存和验证。
            </p>
          )}
          {groups.map(([date, list]) => (
            <section className="schedule-day" key={date} aria-label={date}>
              <h2>
                {date}
                <span>{list.length} 场</span>
              </h2>
              {list.map((m) => (
                <article
                  className="schedule-match-row"
                  data-preview-match={m.id}
                  key={m.planKey}
                >
                  <div className="schedule-match-time">
                    <strong>
                      {m.sessionRange
                        ? m.sessionRange.startAt.slice(11, 16) +
                          "–" +
                          m.sessionRange.endAt.slice(11, 16)
                        : "待定"}
                    </strong>
                    <small>
                      {m.sessionRange ? "Session 时段" : "未安排 session"}
                    </small>
                  </div>
                  <div className="schedule-pairing">
                    <span>{m.A?.label || (m.bye ? "轮空" : "来源待定")}</span>
                    <b>vs</b>
                    <span>{m.B?.label || (m.bye ? "轮空" : "来源待定")}</span>
                  </div>
                  <div className="schedule-match-format">
                    BO{m.bestOf}
                    {m.bye && (
                      <small>
                        {m.bye === "both" ? "双方轮空" : "轮空晋级"}
                      </small>
                    )}
                    {m.condition && <small>条件比赛</small>}
                  </div>
                  <div className="schedule-match-event">
                    <strong>{m.project.name}</strong>
                    <small>
                      {m.stageName} · {m.batch || "依赖批次"} · {m.sessionName}{" "}
                      · {m.name} · v{m.project.version}
                    </small>
                  </div>
                </article>
              ))}
            </section>
          ))}
          {filteredWindows.length > 0 && (
            <details className="schedule-windows">
              <summary>赛制轮次（{filteredWindows.length}）</summary>
              {filteredWindows.map((w) => (
                <article key={w.planKey} className="schedule-round">
                  <strong>
                    {w.project.name} · {w.name}
                  </strong>
                  <p>
                    {w.pairing} · {w.count} 场
                    {w.restCount ? ` · ${w.restCount} 人休息` : ""}
                  </p>
                  {w.leg && <p>第 {w.leg} 回合</p>}
                  {w.waveId && (
                    <p>
                      {w.stageName} · wave {w.waveNumber} ·{" "}
                      {w.sessionName ?? "尚未排期"}
                      {w.sessionRange
                        ? " · " +
                          w.sessionRange.startAt +
                          " — " +
                          w.sessionRange.endAt
                        : ""}
                    </p>
                  )}
                  {w.fixtures?.length > 0 && (
                    <ul>
                      {w.fixtures.map((fixture: any) => (
                        <li key={fixture.id}>
                          {fixture.A.label} vs {fixture.B.label} · BO
                          {fixture.bestOf}
                        </li>
                      ))}
                    </ul>
                  )}
                  {w.rest?.length > 0 && (
                    <p>
                      本轮休息：{w.rest.map((s: any) => s.label).join("、")}
                    </p>
                  )}
                </article>
              ))}
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
