import { useEffect, useMemo, useRef, useState } from "react";
import { useBeforeUnload, useBlocker, useParams } from "react-router-dom";
import { requestKey } from "../../shared/api";
import { ErrorNotice, Field } from "../../shared/ui";
import { useWrite } from "../../shared/write";
import {
  FIXED_OFFSETS,
  offsetLabel,
  utcToWall,
  wallToUtc,
} from "../../shared/fixed-datetime";
import { sameValue } from "../configuration/session";
import { Resource, useResource } from "./resource";
import { unitGraph } from "./plan-graph";
import { PlanView } from "./plan-view";
const clean = (data: any) => ({
  configurationId:
    data.configuration?.id ?? data.schedule.configurationId ?? "",
  windows:
    data.schedule.configurationId &&
    data.configuration?.id &&
    data.schedule.configurationId !== data.configuration.id
      ? []
      : data.schedule.windows,
  resources: data.schedule.resources,
  assignments:
    data.schedule.configurationId &&
    data.configuration?.id &&
    data.schedule.configurationId !== data.configuration.id
      ? []
      : data.schedule.assignments,
});
const savedPayload = (data: any) => ({
  configurationId:
    data.schedule.configurationId ?? data.configuration?.id ?? "",
  windows: data.schedule.windows,
  resources: data.schedule.resources,
  assignments: data.schedule.assignments,
});
export function SchedulePage({ manage = false }: { manage?: boolean }) {
  const { tid } = useParams(),
    [configuration, setConfiguration] = useState("");
  const state = useResource(
    `/tournaments/${tid}/schedule${configuration ? "?configurationId=" + encodeURIComponent(configuration) : ""}`,
  );
  return (
    <Resource state={state}>
      {(data) => (
        <ScheduleWorkbench
          key={tid + "/" + configuration}
          data={data}
          manage={manage}
          reload={state.reload}
          selectConfiguration={setConfiguration}
        />
      )}
    </Resource>
  );
}
function ScheduleWorkbench({
  data,
  manage,
  reload,
  selectConfiguration,
}: {
  data: any;
  manage: boolean;
  reload: () => void;
  selectConfiguration: (id: string) => void;
}) {
  const { tid } = useParams(),
    url = `/tournaments/${tid}/schedule`,
    write = useWrite(),
    actualWrite = useWrite();
  const [draft, setDraft] = useState<any>(() => clean(data)),
    [baseline, setBaseline] = useState<any>(() => savedPayload(data)),
    [version, setVersion] = useState(data.schedule.version),
    [notice, setNotice] = useState(""),
    [view, setView] = useState("time"),
    [group, setGroup] = useState(""),
    [resource, setResource] = useState(""),
    [date, setDate] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [windowId, setWindowId] = useState(""),
    [resourceId, setResourceId] = useState("rotate"),
    [resourceName, setResourceName] = useState(""),
    [windowName, setWindowName] = useState(""),
    [wall, setWall] = useState(""),
    [offset, setOffset] = useState(480),
    [duration, setDuration] = useState(60),
    [rest, setRest] = useState(0),
    [stream, setStream] = useState(""),
    [future, setFuture] = useState(""),
    [reason, setReason] = useState(""),
    [walls, setWalls] = useState<Record<string, string>>({}),
    [graphLayout, setGraphLayout] = useState<any>({
      positions: {},
      zoom: 1,
      pan: { x: 0, y: 0 },
    }),
    [graphList, setGraphList] = useState(() => window.innerWidth <= 600);
  const actualRequest = useRef<any>(null),
    canEdit = manage && data.permissions["structure.edit"],
    dirty = !sameValue(draft, baseline),
    blocker = useBlocker(() => canEdit && dirty),
    dialog = useRef<HTMLDialogElement>(null);
  useBeforeUnload((e) => {
    if (canEdit && dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  useEffect(() => {
    if (!dirty && data.schedule.version !== version) {
      const next = clean(data);
      setDraft(next);
      setBaseline(next);
      setVersion(data.schedule.version);
      setWalls({});
    }
  }, [data]);
  useEffect(() => {
    if (blocker.state === "blocked") dialog.current?.showModal();
    else dialog.current?.close();
  }, [blocker.state]);
  const configuration = data.configuration,
    plan = configuration?.plan,
    items = data.items as any[],
    groups =
      configuration?.structure.stages.flatMap((s: any) =>
        (s.groups.length ? s.groups : [{ id: s.id }]).map(
          (g: any, i: number) => ({
            id: g.id,
            label: `${s.name ?? "阶段"} · 小组${i + 1}`,
            stage: s,
          }),
        ),
      ) ?? [];
  const selectedGroup = group || groups[0]?.id;
  const graphs = useMemo(
    () =>
      new Map<string, ReturnType<typeof unitGraph>>(
        (plan?.units ?? []).map((u: any) => [
          u.groupId,
          unitGraph(
            u,
            plan,
            { ...configuration.structure, id: configuration.id },
            data.runtime,
          ),
        ]),
      ),
    [plan, data.runtime],
  );
  const sourceLabels = useMemo(
    () =>
      new Map(
        [...graphs.values()].flatMap((g) =>
          g.nodes.map((n) => [n.id, n.sources.join(" / ")] as const),
        ),
      ),
    [graphs],
  );
  const model = graphs.get(selectedGroup);
  function title(item: any) {
    const g = groups.find((g: any) => g.id === item.groupId);
    const role = (
      {
        upper: "胜者组",
        lower: "败者组",
        lowerPreliminary: "败者预选",
        final: "总决赛",
        thirdPlace: "季军战",
        opening: "首轮",
        winners: "胜者战",
        elimination: "淘汰战",
        decider: "出线战",
        roundRobin: "循环对局",
      } as Record<string, string>
    )[item.role];
    return `${g?.label ?? "阶段"}${role ? " · " + role : ""} · ${item.phase === "elimination" ? "附加淘汰赛" : `第${item.round ?? 1}轮`}${item.kind === "window" ? "窗口" : `第${item.index ?? 1}场`}${item.condition ? "（条件比赛）" : ""}`;
  }
  function names(item: any) {
    if (item.inactive)
      return item.kind === "window"
        ? "阶段已结束，该窗口未使用"
        : "条件未满足，未产生实际对局";
    if (item.kind === "window")
      return item.known
        ? "配对已生成；具体比赛需明确安排"
        : "待配对，不预定对手";
    if (item.known)
      return item.entrants
        .map(
          (id: string) =>
            data.runtime?.roster.find((r: any) => r.entrantId === id)?.name ??
            "已确定参赛者",
        )
        .join(" vs ");
    return sourceLabels.get(item.planKey) ?? "待前置比赛确认";
  }
  function change(next: any) {
    setDraft(next);
    setNotice("");
    write.clearError();
  }
  function changeWindow(id: string, patch: any) {
    change({
      ...draft,
      windows: draft.windows.map((w: any) =>
        w.id === id ? { ...w, ...patch } : w,
      ),
    });
  }
  function startedWindow(w: any) {
    return items.some(
      (m) =>
        m.started &&
        (m.planKey === w.planKey ||
          draft.assignments.some(
            (a: any) => a.planKey === m.planKey && a.windowId === w.id,
          )),
    );
  }
  function addWindow() {
    const startsAt = wallToUtc(wall.replace("T", " "), offset);
    if (!startsAt || !windowName.trim() || duration < 1 || rest < 0) {
      setNotice("请填写有效窗口名称、时间、时长及休息间隔。");
      return;
    }
    const w = {
      id: requestKey(),
      name: windowName,
      startsAt,
      offsetMinutes: offset,
      durationMinutes: duration,
      minRestMinutes: rest,
      ...(stream ? { streamUrl: stream } : {}),
      ...(future ? { planKey: future } : {}),
    };
    change({ ...draft, windows: [...draft.windows, w] });
    setWindowId(w.id);
    setWindowName("");
    setFuture("");
  }
  function assign() {
    if (!windowId || !selected.length) return;
    if (resourceId === "rotate" && !draft.resources.length) {
      setNotice("请添加比赛台或选择暂不指定比赛台。");
      return;
    }
    const added = selected.map((planKey, i) => ({
      planKey,
      windowId,
      ...(resourceId === "rotate"
        ? { resourceId: draft.resources[i % draft.resources.length].id }
        : resourceId
          ? { resourceId }
          : {}),
    }));
    change({
      ...draft,
      assignments: [
        ...draft.assignments.filter((a: any) => !selected.includes(a.planKey)),
        ...added,
      ],
    });
    setSelected([]);
  }
  async function save() {
    const result = await write.run(url, "PUT", {
      expectedVersion: version,
      payload: draft,
      ...(reason ? { reason } : {}),
    });
    if (!result) return false;
    const next = clean({ schedule: result, configuration });
    setDraft(next);
    setBaseline(next);
    setVersion(result.version);
    setWalls({});
    setNotice("时间计划已保存");
    reload();
    return true;
  }
  async function actualStart(item: any) {
    actualRequest.current = {
      path: `/tournaments/${tid}/matches/${item.matchId}/actual-start`,
      body: { expectedVersion: data.runtimeVersion },
      matchId: item.matchId,
    };
    await retryActual();
  }
  async function retryActual() {
    const r = actualRequest.current;
    if (r && (await actualWrite.run(r.path, "POST", r.body))) {
      actualRequest.current = null;
      reload();
    }
  }
  const assignments = draft.assignments as any[],
    filtered = items.filter((m) => !group || m.groupId === group),
    pending = filtered.filter(
      (m) =>
        m.kind === "match" &&
        !m.inactive &&
        !assignments.some((a) => a.planKey === m.planKey),
    );
  const shownWindows = draft.windows.filter(
      (w: any) =>
        !date || utcToWall(w.startsAt, w.offsetMinutes).slice(0, 10) === date,
    ),
    slots = [
      ...new Set(shownWindows.map((w: any) => w.startsAt)),
    ].sort() as string[];
  function matchCard(item: any, a?: any) {
    const w = draft.windows.find((w: any) => w.id === a?.windowId),
      台 = draft.resources.find((r: any) => r.id === a?.resourceId);
    return (
      <article
        key={item.planKey}
        className="schedule-match"
        data-schedule-kind={item.kind}
      >
        <h4>{title(item)}</h4>
        <p>{names(item)}</p>
        {item.bestOf && <p>BO{item.bestOf}</p>}
        <p>
          {item.inactive
            ? "条件未激活或轮次未使用，没有实际比赛"
            : item.started
              ? "已实际开始或已确认；计划锁定"
              : item.condition
                ? "仅在条件满足后比赛"
                : item.known
                  ? "对手已确定"
                  : "身份待复核"}
        </p>
        {w ? (
          <p>
            {utcToWall(w.startsAt, w.offsetMinutes).slice(0, 16)} ·{" "}
            {offsetLabel(w.offsetMinutes)} · {台?.name ?? "未指定比赛台"}
          </p>
        ) : (
          <p>未安排时间</p>
        )}
        {w && (
          <p>
            预计 {a.durationMinutes ?? w.durationMinutes} 分钟 · 最小休息{" "}
            {a.minRestMinutes ?? w.minRestMinutes} 分钟
          </p>
        )}
        {item.actualStartedAt && (
          <p>
            实际开始：
            {utcToWall(item.actualStartedAt, w?.offsetMinutes ?? 480).slice(
              0,
              19,
            )}{" "}
            · {offsetLabel(w?.offsetMinutes ?? 480)}
          </p>
        )}
        {w?.streamUrl && /^https?:\/\//i.test(w.streamUrl) && (
          <a href={w.streamUrl} target="_blank" rel="noreferrer">
            观看直播
          </a>
        )}
        {canEdit && a && !item.started && (
          <button
            onClick={() =>
              change({
                ...draft,
                assignments: assignments.filter(
                  (x) => x.planKey !== item.planKey,
                ),
              })
            }
          >
            取消安排
          </button>
        )}
        {manage &&
          data.permissions["results.edit"] &&
          item.matchId &&
          item.current &&
          !item.started && (
            <button
              disabled={actualWrite.busy}
              onClick={() => {
                if (
                  window.confirm(
                    "确认这场比赛现在实际开始？开始后其时间计划不可修改。",
                  )
                )
                  void actualStart(item);
              }}
            >
              标记实际开赛
            </button>
          )}
      </article>
    );
  }
  return (
    <section className="schedule-page">
      <h2>{manage ? "时间编排" : "赛事赛程"}</h2>
      <p>
        时间计划与赛果确认分别保存。未来来源及配对保持占位；预计时间不代表已实际开始。
      </p>
      <p>日期与比赛台筛选用于轮次和时间视图；签表保留所选小组的完整依赖。</p>
      <div className="actions">
        <button
          aria-pressed={view === "graph"}
          onClick={() => setView("graph")}
        >
          赛制签表
        </button>
        <button
          aria-pressed={view === "round"}
          onClick={() => setView("round")}
        >
          按轮次
        </button>
        <button aria-pressed={view === "time"} onClick={() => setView("time")}>
          按时间段
        </button>
        <button onClick={reload}>刷新并重检时间计划</button>
      </div>
      <div className="form-grid schedule-filters">
        <Field label="赛程小组筛选">
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">全部小组</option>
            {groups.map((g: any) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="赛程比赛台筛选">
          <select
            value={resource}
            onChange={(e) => setResource(e.target.value)}
          >
            <option value="">全部比赛台</option>
            {draft.resources.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="赛程日期筛选">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      {notice && <p role="status">{notice}</p>}
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={write.error.status === 409 ? reload : () => void save()}
        />
      )}{" "}
      {actualWrite.error && (
        <ErrorNotice
          error={actualWrite.error}
          onRetry={
            [409, 403].includes(actualWrite.error.status) ? reload : retryActual
          }
        />
      )}
      {actualWrite.error?.status === 409 && actualRequest.current && (
        <section className="warning">
          <p>
            请重读实际比赛状态，再确认是否按新运行版本标记；服务器已开始的比赛不覆盖。
          </p>
          <button
            disabled={
              !data.permissions["results.edit"] ||
              data.runtimeVersion ===
                actualRequest.current.body.expectedVersion ||
              !items.some(
                (m) =>
                  m.matchId === actualRequest.current.matchId &&
                  m.current &&
                  !m.started,
              )
            }
            onClick={() => {
              if (
                window.confirm("确认按最新运行状态标记这场比赛现在实际开始？")
              ) {
                actualRequest.current.body = {
                  expectedVersion: data.runtimeVersion,
                };
                void retryActual();
              }
            }}
          >
            按最新状态标记实际开始
          </button>
          <button
            onClick={() => {
              actualRequest.current = null;
              actualWrite.clearError();
            }}
          >
            关闭实际开始冲突
          </button>
        </section>
      )}
      {manage && (
        <p>
          时间计划版本 {version} · {dirty ? "有未保存修改" : "已保存"}
        </p>
      )}
      {manage && dirty && (
        <button
          disabled={write.busy}
          onClick={() => {
            if (
              window.confirm("确认舍弃本地时间修改，并恢复已读取的服务器计划？")
            ) {
              const next = savedPayload(data);
              setDraft(next);
              setBaseline(next);
              setVersion(data.schedule.version);
              setWalls({});
              write.clearError();
              if (next.configurationId !== configuration?.id)
                selectConfiguration(next.configurationId);
            }
          }}
        >
          舍弃本地时间修改
        </button>
      )}
      {dirty &&
        (data.schedule.version !== version || write.error?.status === 409) && (
          <section className="warning">
            <p>
              服务器时间计划版本 {data.schedule.version}，本地基于版本 {version}
              ，输入已保留。
            </p>
            <button
              disabled={["MATCH_STARTED", "CONFIGURATION_MISMATCH"].includes(
                write.error?.code ?? "",
              )}
              onClick={() => {
                if (
                  window.confirm("确认保留本地时间计划，并采用服务器新版本？")
                ) {
                  setVersion(data.schedule.version);
                  setBaseline(savedPayload(data));
                  write.clearError();
                }
              }}
            >
              保留本地时间计划并使用新版本
            </button>
            <button
              onClick={() => {
                if (window.confirm("确认用服务器时间计划替换本地修改？")) {
                  const next = savedPayload(data);
                  setDraft(next);
                  setBaseline(next);
                  setVersion(data.schedule.version);
                  setWalls({});
                  write.clearError();
                  if (next.configurationId !== configuration?.id)
                    selectConfiguration(next.configurationId);
                }
              }}
            >
              使用服务器时间计划
            </button>
          </section>
        )}
      <section
        className={data.validation.status === "blocked" ? "error" : "warning"}
      >
        {manage && (
          <p>
            复核对象：已保存时间计划版本 {data.schedule.version}，当前运行版本{" "}
            {data.runtimeVersion}；本地修改保存时重新校验。
          </p>
        )}
        <p>
          {data.validation.status === "blocked"
            ? "时间计划已发现明确冲突，请修正未来安排。"
            : data.validation.status === "pending"
              ? "时间计划仍有待复核身份、前置时间或待安排配对。"
              : "当前已安排比赛未发现明确冲突；未安排比赛另列。"}
        </p>
        {data.validation.diagnostics.map((d: any, i: number) => (
          <p key={i}>
            {d.reason} ·{" "}
            {d.planKeys
              .map((k: string) => items.find((m) => m.planKey === k))
              .filter(Boolean)
              .map(title)
              .join(" / ")}
          </p>
        ))}
      </section>
      {manage && (
        <fieldset disabled={!canEdit || write.busy} className="schedule-editor">
          <legend>编辑未来时间计划</legend>
          <p>
            窗口内已有比赛开始时保留原窗口；未开始的比赛仍可取消原安排，再移至新窗口或比赛台。
          </p>
          {!canEdit && <p>需要本赛事时间编排权限。</p>}
          <Field label="时间计划配置">
            <select
              value={draft.configurationId}
              disabled={dirty || !!data.runtime}
              onChange={(e) => {
                if (
                  window.confirm(
                    "切换将建立所选配置的空时间计划，并保留比赛台。保存后原安排进入审计历史，确认继续？",
                  )
                )
                  selectConfiguration(e.target.value);
              }}
            >
              <option value="">请选择已冻结配置</option>
              {data.configurations.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {!draft.configurationId && (
            <p>请先冻结赛制配置，再安排完整比赛或未来轮次窗口。</p>
          )}
          <div className="form-grid">
            <Field label="比赛台名称">
              <input
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
              />
            </Field>
            <button
              onClick={() => {
                if (resourceName.trim()) {
                  change({
                    ...draft,
                    resources: [
                      ...draft.resources,
                      { id: requestKey(), name: resourceName.trim() },
                    ],
                  });
                  setResourceName("");
                }
              }}
            >
              添加比赛台
            </button>
          </div>
          <ul>
            {draft.resources.map((r: any) => (
              <li key={r.id}>
                {r.name}
                <button
                  disabled={assignments.some(
                    (a) =>
                      a.resourceId === r.id &&
                      items.find((m) => m.planKey === a.planKey)?.started,
                  )}
                  onClick={() =>
                    change({
                      ...draft,
                      resources: draft.resources.filter(
                        (x: any) => x.id !== r.id,
                      ),
                    })
                  }
                >
                  删除比赛台 {r.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="form-grid">
            <Field label="时间窗口名称">
              <input
                value={windowName}
                onChange={(e) => setWindowName(e.target.value)}
              />
            </Field>
            <Field label="窗口开始时间">
              <input
                type="datetime-local"
                value={wall}
                onChange={(e) => setWall(e.target.value)}
              />
            </Field>
            <Field label="窗口固定时区">
              <select
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value))}
              >
                {FIXED_OFFSETS.map((n) => (
                  <option key={n} value={n}>
                    {offsetLabel(n)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="窗口预计分钟">
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </Field>
            <Field label="窗口最小休息分钟">
              <input
                type="number"
                min={0}
                value={rest}
                onChange={(e) => setRest(Number(e.target.value))}
              />
            </Field>
            <Field label="窗口直播链接">
              <input
                type="url"
                value={stream}
                onChange={(e) => setStream(e.target.value)}
              />
            </Field>
            <Field
              label={
                items.some((m) => m.phase === "elimination")
                  ? "关联未来赛程轮次"
                  : "关联未来瑞士轮次"
              }
            >
              <select
                value={future}
                onChange={(e) => setFuture(e.target.value)}
              >
                <option value="">不关联未来轮次</option>
                {items
                  .filter(
                    (m) =>
                      m.kind === "window" &&
                      !m.started &&
                      !draft.windows.some((w: any) => w.planKey === m.planKey),
                  )
                  .map((m) => (
                    <option key={m.planKey} value={m.planKey}>
                      {title(m)}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <button onClick={addWindow}>添加时间窗口</button>
          {draft.windows.map((w: any) => (
            <fieldset key={w.id} disabled={startedWindow(w)}>
              <legend>
                {w.name}
                {startedWindow(w) ? " · 已开始，窗口锁定" : ""}
              </legend>
              <div className="form-grid">
                <Field label={"窗口时间 " + w.name}>
                  <input
                    type="datetime-local"
                    value={
                      walls[w.id] ??
                      utcToWall(w.startsAt, w.offsetMinutes)
                        .slice(0, 16)
                        .replace(" ", "T")
                    }
                    onChange={(e) => {
                      setWalls({ ...walls, [w.id]: e.target.value });
                      changeWindow(w.id, {
                        startsAt:
                          wallToUtc(
                            e.target.value.replace("T", " "),
                            w.offsetMinutes,
                          ) ?? "",
                      });
                    }}
                  />
                </Field>
                <Field label={"窗口时长 " + w.name}>
                  <input
                    type="number"
                    min={1}
                    value={w.durationMinutes}
                    onChange={(e) =>
                      changeWindow(w.id, {
                        durationMinutes: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label={"窗口休息 " + w.name}>
                  <input
                    type="number"
                    min={0}
                    value={w.minRestMinutes}
                    onChange={(e) =>
                      changeWindow(w.id, {
                        minRestMinutes: Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <p>
                {offsetLabel(w.offsetMinutes)} ·{" "}
                {w.planKey
                  ? items.find((m) => m.planKey === w.planKey)?.phase ===
                    "elimination"
                    ? "附加淘汰赛预约"
                    : "瑞士轮次预约"
                  : "普通时间段"}
              </p>
              <button
                onClick={() => {
                  if (window.confirm("确认删除这个窗口及其未开始的比赛安排？"))
                    change({
                      ...draft,
                      windows: draft.windows.filter((x: any) => x.id !== w.id),
                      assignments: assignments.filter(
                        (a) => a.windowId !== w.id,
                      ),
                    });
                }}
              >
                删除窗口 {w.name}
              </button>
            </fieldset>
          ))}
          <section role="region" aria-label="待安排比赛">
            <h3>待安排比赛</h3>
            {pending.map((m) => (
              <label key={m.planKey} className="schedule-pending">
                <input
                  type="checkbox"
                  disabled={m.started}
                  checked={selected.includes(m.planKey)}
                  onChange={() =>
                    setSelected(
                      selected.includes(m.planKey)
                        ? selected.filter((k) => k !== m.planKey)
                        : [...selected, m.planKey],
                    )
                  }
                />
                <span>
                  {title(m)} · {names(m)}
                  {m.started ? " · 已开始，不可新增计划" : ""}
                </span>
              </label>
            ))}
            {!pending.length && <p>当前已知比赛均已安排。</p>}
          </section>
          <div className="form-grid">
            <Field label="批量安排窗口">
              <select
                value={windowId}
                onChange={(e) => setWindowId(e.target.value)}
              >
                <option value="">请选择时间窗口</option>
                {draft.windows.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="批量安排比赛台">
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              >
                <option value="rotate">轮换各比赛台</option>
                <option value="">暂不指定比赛台</option>
                {draft.resources.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button disabled={!windowId || !selected.length} onClick={assign}>
            安排所选比赛
          </button>
          <Field label="时间计划修改原因">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <button
            className="primary"
            disabled={!draft.configurationId}
            onClick={() => void save()}
          >
            保存时间计划
          </button>
        </fieldset>
      )}
      {view === "time" && (
        <div className="schedule-time">
          {slots.map((time) => (
            <section className="schedule-time-slot" key={time}>
              <h3>
                {shownWindows
                  .filter((w: any) => w.startsAt === time)
                  .map(
                    (w: any) =>
                      `${w.name} · ${utcToWall(w.startsAt, w.offsetMinutes).slice(0, 16)} ${offsetLabel(w.offsetMinutes)}`,
                  )
                  .join(" / ")}
              </h3>
              <div className="schedule-match-grid">
                {assignments
                  .filter(
                    (a) =>
                      shownWindows.some(
                        (w: any) => w.id === a.windowId && w.startsAt === time,
                      ) &&
                      (!resource || a.resourceId === resource),
                  )
                  .map((a) => {
                    const item = filtered.find((m) => m.planKey === a.planKey);
                    return item ? matchCard(item, a) : null;
                  })}
              </div>
              {shownWindows
                .filter((w: any) => w.startsAt === time && w.planKey)
                .map((w: any) => (
                  <p key={w.id}>
                    {title(
                      items.find((m) => m.planKey === w.planKey) ?? {
                        kind: "window",
                      },
                    )}{" "}
                    ·{" "}
                    {items.find((m) => m.planKey === w.planKey)?.inactive
                      ? "未使用的预约窗口"
                      : items.find((m) => m.planKey === w.planKey)?.known
                        ? "已配对；具体比赛须明确分配"
                        : "待配对窗口"}
                  </p>
                ))}
            </section>
          ))}
          {!slots.length && <p>尚未安排时间窗口。</p>}
          <h3>未安排时间的比赛</h3>
          <div className="schedule-match-grid">
            {pending.map((m) => matchCard(m))}
          </div>
        </div>
      )}
      {view === "round" && (
        <div>
          {groups
            .filter((g: any) => !group || g.id === group)
            .map((g: any) => (
              <details
                className="schedule-round"
                key={g.id}
                open={
                  window.innerWidth > 600 || !!group || g.id === groups[0]?.id
                }
              >
                <summary>{g.label}</summary>
                <div className="schedule-match-grid">
                  {filtered
                    .filter((m) => m.groupId === g.id)
                    .sort(
                      (a, b) =>
                        (a.waveNumber ?? a.round ?? 0) -
                          (b.waveNumber ?? b.round ?? 0) ||
                        (a.index ?? 0) - (b.index ?? 0),
                    )
                    .map((m) => {
                      const a = assignments.find(
                          (a) => a.planKey === m.planKey,
                        ),
                        w = draft.windows.find(
                          (w: any) => w.id === a?.windowId,
                        );
                      return (!resource || a?.resourceId === resource) &&
                        (!date ||
                          (w &&
                            utcToWall(w.startsAt, w.offsetMinutes).slice(
                              0,
                              10,
                            ) === date))
                        ? matchCard(m, a)
                        : null;
                    })}
                </div>
              </details>
            ))}
        </div>
      )}
      {view === "graph" &&
        (model ? (
          <section>
            <div className="actions">
              <Field label="签表小组">
                <select
                  value={selectedGroup}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  {groups.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <button onClick={() => setGraphList(!graphList)}>
                {graphList ? "查看签表画布" : "查看签表列表"}
              </button>
            </div>
            <PlanView
              model={model}
              readOnly
              layout={graphLayout}
              list={graphList}
              onLayout={(next) => setGraphLayout(next)}
            />
          </section>
        ) : (
          <p>完整签表需已冻结的v2计划；旧版可按现有轮次查看。</p>
        ))}
      <dialog
        ref={dialog}
        role="alertdialog"
        aria-label="未保存时间计划"
        onCancel={(e) => {
          if (write.busy) e.preventDefault();
          else blocker.reset?.();
        }}
      >
        <h3>时间计划尚未保存</h3>
        <div className="actions">
          <button disabled={write.busy} onClick={() => blocker.reset?.()}>
            继续编辑时间计划
          </button>
          <button disabled={write.busy} onClick={() => blocker.proceed?.()}>
            舍弃时间计划后离开
          </button>
          <button
            disabled={write.busy}
            onClick={async () => {
              if (await save()) blocker.proceed?.();
            }}
          >
            保存时间计划后离开
          </button>
        </div>
      </dialog>
    </section>
  );
}
