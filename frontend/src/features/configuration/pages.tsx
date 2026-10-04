import { useEffect, useReducer, useRef, useState } from "react";
import {
  Link,
  useBlocker,
  useBeforeUnload,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  api,
  failure,
  type ApiFailure,
  type Diagnostic,
} from "../../shared/api";
import { ErrorNotice, Resource, useResource } from "../../shared/ui";
import { useWrite } from "../../shared/write";
import { StageForms, PoolForms, RouteForms } from "./forms";
import { DiagnosticList, PreviewPane, Report } from "./preview";
export const emptyStructure = {
  entrantKind: "individual",
  structureVersion: "structure-v1",
  routingVersion: "routing-v1",
  stages: [],
  pools: [],
  routes: [],
};
function payloadOf(c: any) {
  const { id, tournamentId, version, state, snapshot, ...payload } = c;
  return payload;
}
export function ConfigurationList() {
  const { tid } = useParams(),
    url = "/tournaments/" + tid + "/configurations",
    state = useResource(url),
    write = useWrite(),
    navigate = useNavigate();
  async function create() {
    const result = await write.run(url, "POST", { payload: emptyStructure });
    if (result)
      navigate("/manage/" + tid + "/configurations/" + result.id + "/stages");
  }
  return (
    <>
      <h2>结构配置</h2>
      <p>每份配置拥有独立版本。冻结只锁定结构，运行引擎尚未实现。</p>
      <div className="actions">
        <button className="primary" disabled={write.busy} onClick={create}>
          新建空草稿
        </button>
        <Link to={"/manage/" + tid + "/templates"}>从模板创建</Link>
      </div>
      {write.error && <ErrorNotice error={write.error} onRetry={create} />}
      <Resource state={state}>
        {(items) =>
          items.length ? (
            <ul className="list">
              {items.map((c: any) => (
                <li key={c.id}>
                  <Link
                    to={
                      "/manage/" + tid + "/configurations/" + c.id + "/stages"
                    }
                  >
                    配置 {c.id.slice(0, 8)} · {c.templateOrigin?.id ?? "自定义"}
                  </Link>
                  <span>
                    版本 {c.version} ·{" "}
                    {c.state === "draft" ? "草稿" : "结构已冻结"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">此赛事还没有结构配置。</p>
          )
        }
      </Resource>
    </>
  );
}
export function TemplatesPage() {
  const { tid } = useParams(),
    state = useResource("/templates"),
    write = useWrite(),
    navigate = useNavigate();
  async function create(t: any) {
    const result = await write.run(
      "/tournaments/" + tid + "/configurations/from-template",
      "POST",
      { templateId: t.id, templateVersion: t.version },
    );
    if (result)
      navigate("/manage/" + tid + "/configurations/" + result.id + "/stages");
  }
  return (
    <>
      <h2>赛制结构模板</h2>
      <p>
        创建独立草稿，所有内部 ID
        会重新生成；模板不包含真实名单，也不提供比赛运行。
      </p>
      {write.error && <ErrorNotice error={write.error} />}
      <Resource state={state}>
        {(items) => (
          <div>
            {items.map((t: any) => (
              <article className="panel" key={t.id}>
                <h3>{t.description}</h3>
                <p>
                  {t.id} · 版本 {t.version}
                </p>
                <p>
                  {t.structure.stages.length} 个阶段 ·{" "}
                  {t.structure.pools.length} 个池 · {t.structure.routes.length}{" "}
                  条路由
                </p>
                <button
                  className="primary"
                  disabled={write.busy}
                  onClick={() => create(t)}
                >
                  创建{t.description}草稿
                </button>
              </article>
            ))}
          </div>
        )}
      </Resource>
    </>
  );
}
export function ConfigurationPage() {
  const { tid, cid, tab } = useParams(),
    url = "/tournaments/" + tid + "/configurations/" + cid,
    state = useResource(url);
  if (
    !["stages", "pools", "routes", "validation", "preview"].includes(tab ?? "")
  )
    return <h2>页面不存在</h2>;
  return (
    <Resource state={state}>
      {(c) => <Editor key={c.id} initial={c} url={url} />}
    </Resource>
  );
}
function reducer(state: any, action: any) {
  if (action.type === "edit")
    return { ...state, draft: action.payload, report: null };
  if (action.type === "saved")
    return {
      saved: action.configuration,
      draft: payloadOf(action.configuration),
      report: null,
    };
  return { ...state, report: action.report };
}
export function Editor({ initial, url }: { initial: any; url: string }) {
  const [{ saved, draft, report }, dispatch] = useReducer(reducer, {
      saved: initial,
      draft: payloadOf(initial),
      report: null,
    }),
    write = useWrite(),
    [readError, setReadError] = useState<ApiFailure | null>(null),
    [server, setServer] = useState<any>(null),
    [checking, setChecking] = useState(false),
    [confirm, setConfirm] = useState(false),
    [notice, setNotice] = useState(""),
    [pendingDiagnostic, setPendingDiagnostic] = useState<Diagnostic | null>(
      null,
    );
  const lastWrite = useRef<"save" | "freeze">("save");
  const navigate = useNavigate(),
    location = useLocation(),
    { tid, cid } = useParams(),
    prefix = "/manage/" + tid + "/configurations/" + cid,
    tab = location.pathname.split("/").at(-1),
    dirty = JSON.stringify(draft) !== JSON.stringify(payloadOf(saved)),
    frozen = saved.state === "structure-frozen",
    dialog = useRef<HTMLDialogElement>(null),
    dirtyDialog = useRef<HTMLDialogElement>(null);
  const blocker = useBlocker(
    ({ nextLocation }) => dirty && nextLocation.pathname !== location.pathname,
  );
  useEffect(() => {
    if (blocker.state === "blocked") dirtyDialog.current?.showModal();
    else dirtyDialog.current?.close();
  }, [blocker.state]);
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  function edit(payload: any) {
    lastWrite.current = "save";
    dispatch({ type: "edit", payload });
    setNotice("");
    write.clearError();
    setReadError(null);
  }
  async function save() {
    lastWrite.current = "save";
    const c = await write.run(url, "PUT", {
      expectedVersion: saved.version,
      payload: draft,
    });
    if (c) {
      dispatch({ type: "saved", configuration: c });
      setServer(null);
      setNotice("草稿已保存。");
    }
  }
  async function validate() {
    if (dirty) return;
    setChecking(true);
    setReadError(null);
    dispatch({ type: "report", report: null });
    try {
      dispatch({
        type: "report",
        report: await api(url + "/validate", {
          method: "POST",
          body: { expectedVersion: saved.version },
        }),
      });
    } catch (e) {
      setReadError(failure(e));
    } finally {
      setChecking(false);
    }
  }
  async function reread() {
    try {
      setServer(await api(url));
    } catch (e) {
      setReadError(failure(e));
    }
  }
  async function freeze() {
    lastWrite.current = "freeze";
    setConfirm(false);
    const snapshot = await write.run(url + "/freeze", "POST", {
      expectedVersion: saved.version,
    });
    if (snapshot) {
      dispatch({
        type: "saved",
        configuration: {
          ...saved,
          state: "structure-frozen",
          version: snapshot.version,
          snapshot,
        },
      });
      setNotice("结构已冻结，赛事尚未启动。");
    }
  }
  function locate(d: Diagnostic) {
    setPendingDiagnostic(d);
    const section = d.path.startsWith("/pools")
      ? "pools"
      : d.path.startsWith("/routes")
        ? "routes"
        : "stages";
    navigate(prefix + "/" + section);
  }
  useEffect(() => {
    if (!pendingDiagnostic) return;
    const d = pendingDiagnostic,
      section = d.path.startsWith("/pools")
        ? "pools"
        : d.path.startsWith("/routes")
          ? "routes"
          : "stages";
    if (tab !== section) return;
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-path]")];
    const target =
      nodes.find((n) => n.dataset.path === d.path) ??
      nodes
        .filter((n) => d.path.startsWith(n.dataset.path!))
        .sort((a, b) => b.dataset.path!.length - a.dataset.path!.length)[0] ??
      document.getElementById("object-" + (d.routeId ?? d.objectId));
    target?.scrollIntoView({ block: "center" });
    if (target && !target.matches("input,select,textarea"))
      target.tabIndex = -1;
    target?.focus();
    setPendingDiagnostic(null);
  }, [location.pathname, pendingDiagnostic]);
  return (
    <section>
      <div className="title-row">
        <div>
          <h2>配置 {saved.id.slice(0, 8)}</h2>
          <p>
            版本 {saved.version} · {frozen ? "结构已冻结，只读" : "可编辑草稿"}{" "}
            · {dirty ? "有未保存修改" : "已保存"}
          </p>
        </div>
        <div className="actions">
          {!frozen && (
            <button
              className="primary"
              disabled={write.busy || !dirty}
              onClick={save}
            >
              保存草稿
            </button>
          )}
          <Link to={"/manage/" + tid + "/overview"}>配置列表</Link>
        </div>
      </div>
      {notice && <p role="status">{notice}</p>}
      <nav className="tabs">
        {[
          ["stages", "阶段与小组"],
          ["pools", "选手池"],
          ["routes", "晋级路由"],
          ["validation", "校验与冻结"],
          ["preview", "来源预演"],
        ].map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            key={key}
            to={prefix + "/" + key}
          >
            {label}
          </Link>
        ))}
      </nav>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? reread
              : write.error.retryable
                ? lastWrite.current === "freeze"
                  ? freeze
                  : save
                : undefined
          }
          onLocate={locate}
        />
      )}{" "}
      {readError && (
        <ErrorNotice
          error={readError}
          onRetry={readError.status === 409 ? reread : validate}
        />
      )}{" "}
      {server && (
        <section className="warning">
          <p>
            服务器版本 {server.version} / {server.state}；本地版本{" "}
            {saved.version}。本地草稿保留，请比较后决定。
          </p>
          <details>
            <summary>服务器与本地结构</summary>
            <h4>服务器</h4>
            <pre>{JSON.stringify(payloadOf(server), null, 2)}</pre>
            <h4>本地</h4>
            <pre>{JSON.stringify(draft, null, 2)}</pre>
          </details>
          <button
            onClick={() => {
              if (window.confirm("确认用服务器结构替换本地未保存内容？")) {
                dispatch({ type: "saved", configuration: server });
                setServer(null);
                write.clearError();
              }
            }}
          >
            使用服务器结构
          </button>
        </section>
      )}
      {tab === "stages" && (
        <StageForms
          payload={draft}
          disabled={frozen || write.busy}
          onChange={edit}
        />
      )}
      {tab === "pools" && (
        <PoolForms
          payload={draft}
          disabled={frozen || write.busy}
          onChange={edit}
        />
      )}
      {tab === "routes" && (
        <RouteForms
          payload={draft}
          disabled={frozen || write.busy}
          onChange={edit}
        />
      )}
      {tab === "validation" && (
        <>
          <h3>结构校验</h3>
          <p>
            校验与预演分别报告，运行就绪始终为“尚未实现”。冻结会在事务内重新校验，无法解冻。
          </p>
          <div className="actions">
            <button
              disabled={checking || dirty || write.busy}
              onClick={validate}
            >
              {checking ? "校验中…" : "校验已保存版本"}
            </button>
            {!frozen && (
              <button
                disabled={dirty || write.busy}
                onClick={() => setConfirm(true)}
              >
                冻结结构…
              </button>
            )}
          </div>
          {dirty && <p>请先保存草稿。</p>}
          {report && <Report report={report} onLocate={locate} />}{" "}
          {saved.snapshot && (
            <>
              <p>
                冻结于 {new Date(saved.snapshot.frozenAt).toLocaleString()} ·
                未启动比赛
              </p>
              <DiagnosticList
                diagnostics={saved.snapshot.diagnostics}
                onLocate={locate}
              />
              <details>
                <summary>冻结摘要</summary>
                <pre>
                  {JSON.stringify(
                    {
                      snapshotId: saved.snapshot.snapshotId,
                      digest: saved.snapshot.digest,
                      version: saved.snapshot.version,
                      runtimeReady: false,
                      started: false,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          )}
        </>
      )}
      {tab === "preview" && (
        <PreviewPane
          configuration={{ ...draft, version: saved.version }}
          url={url}
          dirty={dirty}
          onLocate={locate}
          onConflict={reread}
        />
      )}
      <dialog
        ref={dialog}
        onCancel={() => setConfirm(false)}
        aria-labelledby="freeze-title"
      >
        <h2 id="freeze-title">确认冻结结构</h2>
        <p>
          冻结版本 {saved.version}
          ，此操作不可解冻。冻结不启动赛事，也不保存模拟名单。
        </p>
        <div className="actions">
          <button autoFocus onClick={() => setConfirm(false)}>
            取消
          </button>
          <button className="primary" disabled={write.busy} onClick={freeze}>
            确认冻结
          </button>
        </div>
      </dialog>
      <dialog
        ref={dirtyDialog}
        role="alertdialog"
        aria-label="未保存草稿"
        className="warning"
        onCancel={() => blocker.reset?.()}
      >
        <h2>草稿尚未保存</h2>
        <p>切换栏目时保留当前草稿；离开此配置会丢失输入。</p>
        <button autoFocus onClick={() => blocker.reset?.()}>
          继续编辑
        </button>
        <button onClick={() => blocker.proceed?.()}>确认切换或离开</button>
      </dialog>
    </section>
  );
}
