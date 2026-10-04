import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, failure, ApiFailure } from "../shared/api";
import { Empty, ErrorNotice, Field, Resource, useResource } from "../shared/ui";
import { useWrite } from "../shared/write";
export type Tournament = {
  id: string;
  name: string;
  game: "card" | "fighting";
  description: string;
  location: string;
  startsAt: string | null;
  seriesId: string | null;
  visibility: "private" | "public";
  version: number;
  isOwner?: boolean;
  onSaved?: (t: any) => void;
};
function EventList({ items }: { items: Tournament[] }) {
  return (
    <div className="event-list">
      {items.map((t) => (
        <article key={t.id}>
          <div>
            <span className="tag">{t.game === "card" ? "卡牌" : "格斗"}</span>
            <span className="muted">基础资料 · 尚未开赛</span>
          </div>
          <h2>
            <Link to={"/tournaments/" + t.id}>{t.name}</Link>
          </h2>
          <p>{t.description || "暂无赛事说明"}</p>
          <p className="muted">
            {t.location || "地点待定"} ·{" "}
            {t.startsAt
              ? new Date(t.startsAt).toLocaleString() + "（本地时区）"
              : "时间待定"}
          </p>
          {t.visibility === "private" && (
            <span className="tag">仅创建者可见</span>
          )}
        </article>
      ))}
    </div>
  );
}
export function Pager({
  data,
  onPage,
}: {
  data: any;
  onPage: (n: number) => void;
}) {
  return (
    <div className="actions">
      <button disabled={data.page === 1} onClick={() => onPage(data.page - 1)}>
        上一页
      </button>
      <span>
        第 {data.page} 页 · 共 {data.total} 项
      </span>
      <button
        disabled={data.page * data.pageSize >= data.total}
        onClick={() => onPage(data.page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
export function CatalogPage() {
  const [query, setQuery] = useSearchParams(),
    [search, setSearch] = useState(query.get("q") ?? ""),
    game = query.get("game") ?? "",
    page = query.get("page") ?? "1";
  const state = useResource(
    "/tournaments?" +
      new URLSearchParams({
        q: query.get("q") ?? "",
        ...(game ? { game } : {}),
        page,
      }),
  );
  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">发现赛事</p>
          <h1>下一场，从这里开始</h1>
          <p>浏览公开赛事资料。报名与赛制运行的开放状态以各赛事页面为准。</p>
        </div>
        <Link className="button primary" to="/tournaments/new">
          创建赛事
        </Link>
      </div>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ q: search, ...(game ? { game } : {}), page: "1" });
        }}
      >
        <Field label="关键词">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={200}
            placeholder="搜索赛事名称"
          />
        </Field>
        <Field label="赛事分类">
          <select
            value={game}
            onChange={(e) =>
              setQuery({
                q: search,
                ...(e.target.value ? { game: e.target.value } : {}),
                page: "1",
              })
            }
          >
            <option value="">全部分类</option>
            <option value="card">卡牌</option>
            <option value="fighting">格斗</option>
          </select>
        </Field>
        <button className="primary">搜索</button>
      </form>
      <Resource state={state}>
        {(data) => (
          <>
            {data.items.length ? (
              <EventList items={data.items} />
            ) : (
              <Empty>没有符合条件的公开赛事。</Empty>
            )}
            <Pager
              data={data}
              onPage={(n) =>
                setQuery({
                  q: search,
                  ...(game ? { game } : {}),
                  page: String(n),
                })
              }
            />
          </>
        )}
      </Resource>
    </>
  );
}
export function MyTournaments() {
  const [query, setQuery] = useSearchParams(),
    tab = query.get("tab") ?? "created",
    page = query.get("page") ?? "1";
  const state = useResource(
    "/me/tournaments?" + new URLSearchParams({ relation: tab, page }),
  );
  return (
    <>
      <p className="eyebrow">个人空间</p>
      <h1>我的赛事</h1>
      <nav className="tabs">
        {[
          ["created", "我创建的"],
          ["managed", "我管理的"],
          ["joined", "我参加的"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setQuery({ tab: key })}
          >
            {label}
          </button>
        ))}
        <Link to="/me/series">我的系列</Link>
        <Link to="/tournaments/new">创建赛事</Link>
      </nav>
      <Resource state={state}>
        {(data) => (
          <>
            {data.items.length ? (
              <>
                <EventList items={data.items} />
                <ul>
                  {data.items.map((t: Tournament) => (
                    <li key={t.id}>
                      <Link to={"/manage/" + t.id + "/overview"}>
                        管理 {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Empty>此入口暂无已创建的赛事。</Empty>
            )}
            <Pager
              data={data}
              onPage={(n) => setQuery({ tab, page: String(n) })}
            />
          </>
        )}
      </Resource>
    </>
  );
}
export function SeriesPage({ mine = false }: { mine?: boolean }) {
  const { sid } = useParams(),
    [query, setQuery] = useSearchParams();
  const state = useResource(
    (mine ? "/me/series" : "/series/" + sid) +
      "?page=" +
      (query.get("page") ?? "1"),
  );
  return (
    <>
      <h1>{mine ? "我的系列" : "赛事系列"}</h1>
      {mine && (
        <Link className="button primary" to="/me/series/new">
          创建系列
        </Link>
      )}
      <Resource state={state}>
        {(data) => (
          <>
            {!mine && (
              <>
                <h2>{data.name}</h2>
                <p>{data.description}</p>
                {data.isOwner && (
                  <Link to={"/me/series/" + sid + "/edit"}>编辑系列</Link>
                )}
              </>
            )}
            {data.items.length ? (
              mine ? (
                <ul className="list">
                  {data.items.map((s: any) => (
                    <li key={s.id}>
                      <Link to={"/series/" + s.id}>{s.name}</Link>
                      <Link to={"/me/series/" + s.id + "/edit"}>编辑</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EventList items={data.items} />
              )
            ) : (
              <Empty>{mine ? "尚未创建系列。" : "没有可见的系列赛事。"}</Empty>
            )}
            <Pager data={data} onPage={(n) => setQuery({ page: String(n) })} />
          </>
        )}
      </Resource>
    </>
  );
}
export function MetadataForm({
  kind,
  initial,
  onSaved,
}: {
  kind: "series" | "tournament";
  initial?: any;
  onSaved?: (t: any) => void;
}) {
  const navigate = useNavigate(),
    write = useWrite(),
    series = useResource(
      kind === "tournament" ? "/me/series?pageSize=50" : null,
    );
  const [body, setBody] = useState<any>(
      initial
        ? {
            name: initial.name,
            description: initial.description,
            ...(kind === "tournament"
              ? {
                  game: initial.game,
                  location: initial.location,
                  startsAt: initial.startsAt ?? "",
                  seriesId: initial.seriesId ?? "",
                  visibility: initial.visibility,
                }
              : {}),
          }
        : {
            name: "",
            description: "",
            ...(kind === "tournament"
              ? {
                  game: "card",
                  location: "",
                  startsAt: "",
                  seriesId: "",
                  visibility: "private",
                }
              : {}),
          },
    ),
    [saved, setSaved] = useState(""),
    [server, setServer] = useState<any>(null),
    [version, setVersion] = useState(initial?.version),
    [readError, setReadError] = useState<ApiFailure | null>(null);
  const change = (key: string, value: string) =>
    setBody((b: any) => ({ ...b, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved("");
    const payload = {
      ...body,
      ...(initial ? { expectedVersion: version } : {}),
      ...(kind === "tournament"
        ? { seriesId: body.seriesId || null, startsAt: body.startsAt || null }
        : {}),
    };
    const result = await write.run(
      "/" +
        (kind === "series" ? "series" : "tournaments") +
        (initial ? "/" + initial.id : ""),
      initial ? "PATCH" : "POST",
      payload,
    );
    if (result) {
      setVersion(result.version);
      setServer(null);
      if (initial) {
        setSaved("资料已保存。");
        onSaved?.(result);
      } else
        navigate(
          kind === "series"
            ? "/me/series"
            : "/manage/" + result.id + "/overview",
        );
    }
  }
  async function reread() {
    try {
      setServer(
        await api(
          "/" +
            (kind === "series" ? "series" : "tournaments") +
            "/" +
            initial.id,
        ),
      );
    } catch (e) {
      setReadError(failure(e));
    }
  }
  return (
    <form onSubmit={submit} className="panel">
      <Field label={kind === "series" ? "系列名称" : "赛事名称"}>
        <input
          required
          maxLength={100}
          value={body.name}
          onChange={(e) => change("name", e.target.value)}
        />
      </Field>
      <Field label="说明">
        <textarea
          maxLength={2000}
          value={body.description}
          onChange={(e) => change("description", e.target.value)}
        />
      </Field>
      {kind === "tournament" && (
        <>
          <Field label="分类">
            <select
              value={body.game}
              onChange={(e) => change("game", e.target.value)}
            >
              <option value="card">卡牌</option>
              <option value="fighting">格斗</option>
            </select>
          </Field>
          <Field label="地点">
            <input
              maxLength={200}
              value={body.location}
              onChange={(e) => change("location", e.target.value)}
            />
          </Field>
          <Field label="开始时间（ISO8601，需含时区，如 2026-10-04T10:00+08:00）">
            <input
              value={body.startsAt}
              onChange={(e) => change("startsAt", e.target.value)}
            />
          </Field>
          <Field label="所属系列">
            <select
              value={body.seriesId}
              disabled={series.loading || !!series.error}
              onChange={(e) => change("seriesId", e.target.value)}
            >
              <option value="">独立赛事</option>
              {series.data?.items.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {series.error && (
            <ErrorNotice error={series.error} onRetry={series.reload} />
          )}
          <Field label="资料可见性">
            <select
              value={body.visibility}
              onChange={(e) => change("visibility", e.target.value)}
            >
              <option value="private">私有，仅创建者可见</option>
              <option value="public">公开基础资料</option>
            </select>
          </Field>
          <p className="warning">
            公开会同时显示所属系列的标题和说明；不会开启报名或启动赛事。
          </p>
        </>
      )}
      <button className="primary" disabled={write.busy}>
        {write.busy ? "保存中…" : initial ? "保存资料" : "创建"}
      </button>
      {saved && <p role="status">{saved}</p>}
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={() =>
            write.error?.status === 409 ? void reread() : write.clearError()
          }
        />
      )}{" "}
      {readError && <ErrorNotice error={readError} onRetry={reread} />}{" "}
      {server && (
        <section className="warning">
          <p>
            服务器版本 {server.version}，名称：{server.name}。本地输入保留。
          </p>
          <button
            type="button"
            onClick={() => {
              setBody({
                name: server.name,
                description: server.description,
                ...(kind === "tournament"
                  ? {
                      game: server.game,
                      location: server.location,
                      startsAt: server.startsAt ?? "",
                      seriesId: server.seriesId ?? "",
                      visibility: server.visibility,
                    }
                  : {}),
              });
              setVersion(server.version);
              setServer(null);
              write.clearError();
            }}
          >
            确认使用服务器资料
          </button>
        </section>
      )}
    </form>
  );
}
export function MetadataPage({
  kind,
  edit = false,
}: {
  kind: "series" | "tournament";
  edit?: boolean;
}) {
  const { sid } = useParams(),
    event = useOutletContext<Tournament | undefined>();
  const state = useResource(
    edit && kind === "series" ? "/series/" + sid : null,
  );
  return (
    <>
      <h1>
        {edit ? "编辑" : "创建"}
        {kind === "series" ? "系列" : "赛事"}
      </h1>
      {edit ? (
        kind === "series" ? (
          <Resource state={state}>
            {(data) => <MetadataForm kind={kind} initial={data} />}
          </Resource>
        ) : (
          <MetadataForm
            key={event?.id}
            kind={kind}
            initial={event}
            onSaved={event?.onSaved}
          />
        )
      ) : (
        <MetadataForm kind={kind} />
      )}
    </>
  );
}
export function TournamentLayout({ manage = false }: { manage?: boolean }) {
  const { tid } = useParams();
  const state = useResource("/tournaments/" + tid),
    [updated, setUpdated] = useState<any>(null);
  return (
    <Resource state={state}>
      {(original: Tournament) => {
        const event = {
          ...original,
          ...(updated?.id === original.id ? updated : {}),
          onSaved: setUpdated,
        };
        return manage && !event.isOwner ? (
          <ErrorNotice
            error={
              new ApiFailure("只有赛事创建者可以管理。", {
                status: 403,
                code: "FORBIDDEN",
                retryable: false,
              })
            }
          />
        ) : (
          <div className={manage ? "manage-layout" : ""}>
            {manage && (
              <aside>
                <p className="eyebrow">管理赛事</p>
                <nav>
                  {[
                    ["overview", "概览与配置"],
                    ["settings", "基础资料"],
                    ["templates", "赛制模板"],
                    ["registration", "报名与名单"],
                    ["matches", "对阵与逐局"],
                    ["results", "赛果"],
                    ["rounds", "整轮推进"],
                    ["sanctions", "处罚"],
                    ["collaborators", "协作者"],
                  ].map(([path, label]) => (
                    <NavLink key={path} to={"/manage/" + tid + "/" + path}>
                      {label}
                    </NavLink>
                  ))}
                </nav>
              </aside>
            )}
            <div>
              <header className="context">
                <span className="tag">
                  {event.game === "card" ? "卡牌" : "格斗"} ·{" "}
                  {event.visibility === "public" ? "公开" : "私有"}
                </span>
                <h1>{event.name}</h1>
                <p>尚未开赛 · 结构配置不代表赛制运行</p>
                <Link
                  to={
                    manage
                      ? "/tournaments/" + tid
                      : "/manage/" + tid + "/overview"
                  }
                >
                  {manage ? "查看赛事主页" : event.isOwner ? "管理赛事" : ""}
                </Link>
              </header>
              {!manage && (
                <nav className="tabs">
                  {[
                    ["", "概览"],
                    ["stages", "阶段"],
                    ["matches", "对阵"],
                    ["standings", "排名"],
                  ].map(([path, label]) => (
                    <NavLink
                      end
                      key={path}
                      to={"/tournaments/" + tid + (path ? "/" + path : "")}
                    >
                      {label}
                    </NavLink>
                  ))}
                </nav>
              )}
              <Outlet context={event} />
            </div>
          </div>
        );
      }}
    </Resource>
  );
}
export function TournamentOverview() {
  const event = useOutletContext<Tournament>();
  return (
    <>
      <h2>赛事说明</h2>
      <p>{event.description || "暂无说明。"}</p>
      <p>地点：{event.location || "待定"}</p>
      <p>
        时间：
        {event.startsAt
          ? new Date(event.startsAt).toLocaleString() + "（本地时区）"
          : "待定"}
      </p>
      {event.seriesId && <Link to={"/series/" + event.seriesId}>所属系列</Link>}
      <div className="actions">
        <Link
          className="button"
          to={"/tournaments/" + event.id + "/registration"}
        >
          报名与组队
        </Link>
        <Link to={"/tournaments/" + event.id + "/results"}>查看赛果</Link>
      </div>
    </>
  );
}
export function PublicStages() {
  const { tid } = useParams(),
    state = useResource("/tournaments/" + tid + "/stages");
  return (
    <>
      <h2>公开阶段</h2>
      <Resource state={state}>
        {(data) =>
          data.availability === "no-frozen-configuration" ? (
            <Empty>尚未公布冻结结构。</Empty>
          ) : (
            <>
              <p>
                配置 {data.configurationId.slice(0, 8)} · 版本 {data.version} ·{" "}
                {new Date(data.frozenAt).toLocaleString()}
              </p>
              <p className="warning">以下为冻结结构摘要，赛制运行尚未实现。</p>
              {data.items.map((s: any) => (
                <article className="panel" key={s.id}>
                  <h3>
                    阶段 {s.order} · {s.id.slice(0, 8)}
                  </h3>
                  <p>
                    容量 {s.capacity ?? "待定"} · 意图{" "}
                    {s.formatIntent ?? "待定"}
                  </p>
                  <p>{s.groups.length} 个小组</p>
                </article>
              ))}
            </>
          )
        }
      </Resource>
    </>
  );
}
