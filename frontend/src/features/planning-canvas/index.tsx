import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { api, failure, requestKey, type ApiFailure } from "../../shared/api";
import { ErrorNotice, Field } from "../../shared/ui";
import { CanvasView } from "./view";
import { Properties } from "./properties";
import { Stages, StageProperties, WaveResults } from "./stages";
import {
  labels,
  typeLabels,
  type CanvasGraph,
  type CanvasNode,
  type Endpoint,
  type Port,
} from "./types";
import "./style.css";
export function CanvasLab() {
  const [query, setQuery] = useSearchParams(),
    [graph, setGraph] = useState<CanvasGraph | null>(null),
    [analysis, setAnalysis] = useState<any>(null),
    [catalog, setCatalog] = useState<any>(null),
    [saved, setSaved] = useState<any>(null),
    [remote, setRemote] = useState<any>(null),
    [drafts, setDrafts] = useState<any[]>([]),
    [openId, setOpenId] = useState(""),
    [switchTarget, setSwitchTarget] = useState<string | null>(null),
    [name, setName] = useState("瑞士前八进入八强单败"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiFailure | null>(null),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [selectedStage, setSelectedStage] = useState<string | null>(null),
    [deleteRequest, setDeleteRequest] = useState<any>(null),
    [scope, setScope] = useState<string | null>(null),
    [history, setHistory] = useState<CanvasGraph[]>([]),
    [future, setFuture] = useState<CanvasGraph[]>([]),
    [impact, setImpact] = useState<any>(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [sample, setSample] = useState("swiss-eight"),
    [validation, setValidation] = useState<any>(null),
    [preview, setPreview] = useState<any>(null),
    [pendingSave, setPendingSave] = useState<any>(null),
    [migration, setMigration] = useState<any>(null);
  const actionBusy = useRef(false),
    inspector = useRef<HTMLElement>(null),
    writeRef = useRef<any>(null),
    loadedCanvas = useRef<string | null | undefined>(undefined);
  const canvasId = query.get("canvas");
  const dirty =
    graph !== null &&
    (!saved ||
      JSON.stringify(graph) !== JSON.stringify(saved.graph) ||
      name !== saved.name);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        (currentLocation.search !== nextLocation.search &&
          new URLSearchParams(nextLocation.search).get("canvas") !==
            loadedCanvas.current)),
  );
  const locked = busy || pendingSave !== null || deleteRequest !== null;
  useEffect(() => {
    setSelectedStage((id) =>
      graph?.stages?.some((s) => s.id === id) ? id : null,
    );
  }, [graph]);
  useEffect(() => {
    if (loadedCanvas.current === canvasId) return;
    loadedCanvas.current = canvasId;
    setGraph(null);
    setSaved(null);
    setError(null);
    setValidation(null);
    setPreview(null);
    setSelected([]);
    setSelectedStage(null);
    setScope(null);
    setHistory([]);
    setFuture([]);
    setImpact(null);
    setFrom("");
    setTo("");
    setPendingSave(null);
    setMigration(null);
    writeRef.current = null;
    let active = true;
    const controller = new AbortController();
    (async () => {
      try {
        const [cat, list] = await Promise.all([
          api("/planning-canvas/catalog", { signal: controller.signal }),
          api<any[]>("/planning-canvases", { signal: controller.signal }),
        ]);
        if (!active) return;
        setCatalog(cat);
        setDrafts(list);
        const id = canvasId;
        if (id) {
          const record = await api(
            "/planning-canvases/" + encodeURIComponent(id),
            { signal: controller.signal },
          );
          const r = await api("/planning-canvas/edit", {
            method: "POST",
            body: { graph: record.graph, action: { type: "syncBoundaries" } },
            signal: controller.signal,
          });
          if (active) {
            setGraph(r.graph);
            if (JSON.stringify(r.graph) !== JSON.stringify(record.graph))
              setStatus("已自动补齐子图悬空接口，请保存当前草稿");
            setName(record.name);
            setSaved(record);
            setOpenId(record.id);
            setAnalysis(r.analysis);
          }
        } else {
          const x = await api("/planning-canvas/samples/swiss-eight", {
            signal: controller.signal,
          });
          if (active) {
            setGraph(x.graph);
            setAnalysis(x.analysis);
          }
        }
      } catch (e) {
        if (active) setError(failure(e));
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [canvasId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const install = (g: CanvasGraph, r: any, undo = true) => {
    if (undo && graph) {
      setHistory((h) => [...h.slice(-49), graph]);
      setFuture([]);
    }
    setGraph(g);
    setAnalysis(r);
    setValidation(null);
    setPreview(null);
    setImpact(null);
    setError(null);
    setSelected((s) => s.filter((id) => g.nodes.some((n) => n.id === id)));
  };
  async function act(action: any) {
    if (!graph || actionBusy.current || pendingSave) return;
    actionBusy.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api("/planning-canvas/edit", {
        method: "POST",
        body: { graph, action },
      });
      if (result.requiresConfirmation) {
        setImpact({ ...result, action });
        setStatus("请检查连接影响；取消会保留原草稿");
      } else {
        install(result.graph, result.analysis);
        setStatus("画布已更新，尚未保存");
      }
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
      actionBusy.current = false;
    }
  }
  async function migrate() {
    if (!graph || locked) return;
    setBusy(true);
    try {
      const r = await api("/planning-canvas/migrate", {
        method: "POST",
        body: { graph },
      });
      setMigration({ ...r, baseGraph: JSON.stringify(graph) });
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (
      locked ||
      (dirty && !window.confirm("将用样例替换当前草稿，是否继续？"))
    )
      return;
    setBusy(true);
    try {
      const x = await api("/planning-canvas/samples/" + sample);
      install(x.graph, x.analysis);
      setSelectedStage(null);
      setSaved(null);
      setName(
        sample === "swiss-eight"
          ? "瑞士前八进入八强单败"
          : sample === "partial-pool"
            ? "Pool 部分映射算例"
            : "画布测试草稿",
      );
      loadedCanvas.current = null;
      setQuery({}, { replace: true });
      setScope(null);
      setSelected([]);
      setStatus("样例已重置为新草稿");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function undo(redo = false) {
    if (!graph || locked) return;
    const list = redo ? future : history;
    if (!list.length) return;
    const next = list.at(-1)!;
    setBusy(true);
    try {
      const r = await api("/planning-canvas/analyze", {
        method: "POST",
        body: { graph: next },
      });
      if (redo) {
        setFuture((f) => f.slice(0, -1));
        setHistory((h) => [...h, graph]);
      } else {
        setHistory((h) => h.slice(0, -1));
        setFuture((f) => [...f, graph]);
      }
      install(next, r, false);
      setScope((s) => (next.nodes.some((n) => n.id === s) ? s : null));
      setStatus(redo ? "已重做" : "已撤销");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(retry = false): Promise<boolean> {
    if (!graph || actionBusy.current) return false;
    actionBusy.current = true;
    setBusy(true);
    setError(null);
    const request = retry
      ? writeRef.current
      : {
          path: saved ? "/planning-canvases/" + saved.id : "/planning-canvases",
          method: saved ? "PUT" : "POST",
          body: {
            graph,
            name,
            ...(saved ? { expectedVersion: saved.version } : {}),
          },
          key: requestKey(),
        };
    writeRef.current = request;
    setPendingSave(request);
    try {
      const r = await api(request.path, request);
      setSaved(r);
      setOpenId(r.id);
      loadedCanvas.current = r.id;
      setQuery({ canvas: r.id }, { replace: true });
      setValidation(null);
      setPreview(null);
      setPendingSave(null);
      writeRef.current = null;
      setDrafts(await api("/planning-canvases"));
      setStatus("草稿已保存 · 版本 " + r.version);
      return true;
    } catch (e) {
      const er = failure(e);
      setError(er);
      if (!er.retryable) {
        setPendingSave(null);
        writeRef.current = null;
      }
      return false;
    } finally {
      setBusy(false);
      actionBusy.current = false;
    }
  }
  async function readRemote(id = saved?.id, adopt = false) {
    if (!id || busy) return;
    setBusy(true);
    try {
      const r = await api("/planning-canvases/" + encodeURIComponent(id));
      if (adopt) {
        setSelectedStage(null);
        const info = await api("/planning-canvas/edit", {
          method: "POST",
          body: { graph: r.graph, action: { type: "syncBoundaries" } },
        });
        install(info.graph, info.analysis);
        setName(r.name);
        setSaved(r);
        setOpenId(r.id);
        loadedCanvas.current = r.id;
        setQuery({ canvas: r.id }, { replace: true });
        setScope(null);
        setSelected([]);
        setHistory([]);
        setFuture([]);
        setFrom("");
        setTo("");
        setPendingSave(null);
        writeRef.current = null;
        setRemote(null);
        setStatus(
          JSON.stringify(info.graph) !== JSON.stringify(r.graph)
            ? "已自动补齐子图悬空接口，请保存当前草稿"
            : "已采用保存版本",
        );
      } else {
        setRemote(r);
        setStatus("已读取保存版本，本地草稿保留");
      }
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(isPreview = false) {
    if (!saved || dirty || locked) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api(
        "/planning-canvases/" +
          saved.id +
          (isPreview ? "/preview" : "/validate"),
        { method: "POST", body: { expectedVersion: saved.version } },
      );
      if (isPreview) {
        setPreview(r);
        setStatus("已生成保存版本 " + r.version + " 的赛程预览");
      } else {
        setValidation(r);
        setAnalysis(r);
        setStatus(
          r.valid
            ? "规划验证通过 · 人员与未来结果待解析"
            : "规划验证未通过，请定位诊断",
        );
      }
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  const encapsulate = () => {
    if (locked || !selected.length) return;
    void act({ type: "encapsulate", selected, id: requestKey(), name: "子图" });
  };
  const createStage = () => {
    if (locked || !selected.length || graph?.schemaVersion !== "canvas-v2")
      return;
    void act({
      type: "createStage",
      selected,
      id: requestKey(),
      name:
        "阶段 " +
        (Math.max(0, ...(graph.stages ?? []).map((s) => s.order)) + 1),
    });
  };
  const inspectStage = (id: string) => {
    setSelectedStage(id);
    setSelected([]);
    inspector.current
      ?.querySelector("#canvas-parameters")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  async function deleteProject() {
    if (!deleteRequest || busy || actionBusy.current) return;
    actionBusy.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await api(
        "/planning-canvases/" + encodeURIComponent(deleteRequest.id),
        {
          method: "DELETE",
          body: { expectedVersion: deleteRequest.version },
          key: deleteRequest.key,
        },
      );
      setDrafts((ds) => ds.filter((d) => d.id !== r.id));
      if (saved?.id === r.id) {
        const empty: CanvasGraph = {
          schemaVersion: "canvas-v2",
          nodes: [],
          edges: [],
          stages: [],
        };
        install(
          empty,
          { nodes: [], values: {}, diagnostics: [], valid: true },
          false,
        );
        setSaved(null);
        setRemote(null);
        setName("未命名项目");
        setOpenId("");
        setScope(null);
        setSelectedStage(null);
        setHistory([]);
        setFuture([]);
        setFrom("");
        setTo("");
        setMigration(null);
        loadedCanvas.current = null;
        setQuery({}, { replace: true });
      } else setOpenId(saved?.id ?? "");
      setDeleteRequest(null);
      setStatus("项目已删除");
    } catch (e) {
      const er = failure(e);
      setError(er);
      setDeleteRequest((r: any) => ({ ...r, uncertain: er.retryable }));
    } finally {
      setBusy(false);
      actionBusy.current = false;
    }
  }
  async function emptyCanvas(asNew: boolean) {
    if (locked) return;
    setBusy(true);
    try {
      const x = await api("/planning-canvas/samples/empty");
      install(x.graph, x.analysis, !asNew);
      setScope(null);
      setSelected([]);
      setSelectedStage(null);
      setFrom("");
      setTo("");
      if (asNew) {
        setSaved(null);
        setRemote(null);
        setName("未命名项目");
        setOpenId("");
        setHistory([]);
        setFuture([]);
        loadedCanvas.current = null;
        setQuery({}, { replace: true });
      }
      setStatus(
        asNew ? "已新建空白项目" : "画布已清空，可撤销；保存后更新当前草稿",
      );
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  async function switchProject(id: string) {
    if (id) await readRemote(id, true);
    else await emptyCanvas(true);
  }
  const requestSwitch = (id: string) => {
    if (locked) return;
    if (dirty) setSwitchTarget(id);
    else void switchProject(id);
  };
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true]",
        )
      )
        return;
      if (locked || impact || migration) return;
      if (
        e.key === "Delete" &&
        selectedStage &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        if (!e.repeat) void act({ type: "deleteStage", id: selectedStage });
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "g")
        return;
      e.preventDefault();
      if (!e.repeat) {
        if (e.shiftKey) createStage();
        else encapsulate();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [graph, selected, selectedStage, locked, impact, migration]);
  if (!graph || !catalog)
    return (
      <section>
        <h1>赛程规划画布</h1>
        {error ? (
          <ErrorNotice error={error} />
        ) : (
          <p role="status">正在读取规划模型…</p>
        )}
      </section>
    );
  const inScope = graph.nodes.filter((n) => (n.parentId ?? null) === scope),
    node = graph.nodes.find((n) => n.id === selected.at(-1)),
    stage = graph.stages?.find((s) => s.id === selectedStage);
  const endpoints = (direction: string) =>
    inScope.flatMap((n) =>
      (analysis?.nodes.find((x: CanvasNode) => x.id === n.id)?.ports ?? [])
        .filter((p: Port) => p.direction === direction)
        .map((p: Port) => ({
          value: JSON.stringify({ node: n.id, port: p.id }),
          label: n.name + " · " + p.label + " · " + typeLabels[p.type],
        })),
    );
  const enter = (id: string) => {
    setSelectedStage(null);
    setScope(id);
    setSelected([]);
    setFrom("");
    setTo("");
  };
  const visibleReport = validation ?? analysis;
  const inspect = (id: string) => {
    setSelectedStage(null);
    setSelected([id]);
    inspector.current
      ?.querySelector("#canvas-parameters")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const addComponent = (kind: string) => {
    const prototype = catalog.nodes.find((n: CanvasNode) => n.kind === kind);
    const id = requestKey(),
      n = structuredClone(prototype);
    n.id = id;
    n.name = kind === "generator" ? "随机排序" : labels[kind];
    n.position = {
      x: 40 + (inScope.length % 3) * 330,
      y: 40 + Math.floor(inScope.length / 3) * 280,
    };
    if (scope) n.parentId = scope;
    if (kind === "source")
      n.params.seats = [{ ref: "seat:" + id, label: "未来席位" }];
    if (kind === "generator") n.params.mode = "random";
    void act({ type: "add", node: n });
  };
  return (
    <div className="canvas-lab">
      <header className="canvas-heading">
        <div>
          <h1>赛程规划画布</h1>
          <p>节点规划工作区</p>
        </div>
        <span>
          {saved ? "保存版本 " + saved.version : "未保存"}
          {dirty ? " · 有修改" : ""}
        </span>
      </header>
      <div className="canvas-save-tools">
        <Field label="项目草稿">
          <select
            disabled={locked}
            value={openId}
            onChange={(e) => setOpenId(e.target.value)}
          >
            <option value="">选择已保存项目</option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · v{d.version}
              </option>
            ))}
          </select>
        </Field>
        <button
          disabled={locked || !openId || openId === saved?.id}
          onClick={() => requestSwitch(openId)}
        >
          切换项目
        </button>
        <button disabled={locked} onClick={() => requestSwitch("")}>
          新建项目
        </button>
        <button
          disabled={locked || !openId}
          className="canvas-delete-project"
          onClick={() => {
            const target = drafts.find((d) => d.id === openId);
            if (target)
              setDeleteRequest({
                ...target,
                key: requestKey(),
                uncertain: false,
              });
          }}
        >
          删除项目
        </button>
        <Field label="草稿名称">
          <input
            disabled={locked}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setValidation(null);
              setPreview(null);
            }}
          />
        </Field>
        <button disabled={locked || !dirty} onClick={() => void save()}>
          保存草稿
        </button>
        <button
          disabled={locked || dirty || !saved}
          onClick={() => void verify()}
        >
          验证保存版本
        </button>
        <button
          disabled={locked || dirty || !validation?.valid}
          onClick={() => void verify(true)}
        >
          生成赛程预览
        </button>
        <button
          disabled={locked || !history.length}
          onClick={() => void undo()}
        >
          撤销
        </button>
        <button
          disabled={locked || !future.length}
          onClick={() => void undo(true)}
        >
          重做
        </button>
        <button
          className="canvas-clear"
          disabled={locked || !graph.nodes.length}
          onClick={() => {
            if (
              window.confirm(
                "清空当前画布的全部节点与连线？可通过撤销恢复，保存前不影响已保存草稿。",
              )
            )
              void emptyCanvas(false);
          }}
        >
          清空画布
        </button>
        {saved && !dirty ? (
          <Link
            className="canvas-preview-link"
            to={"/canvas-lab/preview?canvas=" + encodeURIComponent(saved.id)}
          >
            打开赛程预览
          </Link>
        ) : (
          <button
            className="canvas-preview-link"
            disabled
            title="请先保存当前草稿"
          >
            打开赛程预览
          </button>
        )}
      </div>
      <p className="canvas-status" role="status" aria-live="polite">
        {busy ? "正在处理…" : status || "编辑画布后保存，再验证保存版本。"}
      </p>
      {error && <ErrorNotice error={error} />}{" "}
      {deleteRequest && (
        <aside
          className="notice canvas-switch-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="删除项目确认"
        >
          <h2>删除项目“{deleteRequest.name}”？</h2>
          <p>警告：删除后，保存草稿和排期无法恢复。</p>
          {saved?.id === deleteRequest.id && dirty && (
            <p>当前项目的未保存修改也会舍弃。</p>
          )}
          {deleteRequest.uncertain && (
            <p>删除结果尚未确认，请使用原请求重试。</p>
          )}
          <button disabled={busy} onClick={() => void deleteProject()}>
            {deleteRequest.uncertain ? "重试删除项目" : "确认删除项目"}
          </button>
          <button
            disabled={busy || deleteRequest.uncertain}
            onClick={() => setDeleteRequest(null)}
          >
            取消删除
          </button>
        </aside>
      )}
      {switchTarget !== null && (
        <aside
          className="notice canvas-switch-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="切换项目确认"
        >
          <h2>当前项目有未保存修改</h2>
          <p>保存当前草稿后切换，或舍弃修改。</p>
          <button
            disabled={locked}
            onClick={() => {
              void save().then(async (ok) => {
                if (ok) {
                  const target = switchTarget;
                  setSwitchTarget(null);
                  await switchProject(target);
                }
              });
            }}
          >
            保存后切换
          </button>
          <button
            disabled={locked}
            onClick={() => {
              const target = switchTarget;
              setSwitchTarget(null);
              void switchProject(target);
            }}
          >
            舍弃修改并切换
          </button>
          <button disabled={locked} onClick={() => setSwitchTarget(null)}>
            取消切换
          </button>
        </aside>
      )}
      {pendingSave && !busy && (
        <aside className="notice">
          <p>保存结果尚未确认，已保留原请求和草稿。</p>
          <button onClick={() => void save(true)}>使用原请求重试保存</button>
          {saved && (
            <button onClick={() => void readRemote()}>读取保存版本</button>
          )}
        </aside>
      )}
      {remote && (
        <aside className="notice">
          <p>
            远端版本 {remote.version} · {remote.name}；本地草稿未被替换。
          </p>
          <button
            disabled={busy}
            onClick={() => void readRemote(remote.id, true)}
          >
            采用远端版本
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setSaved(remote);
              setRemote(null);
              setPendingSave(null);
              writeRef.current = null;
              setValidation(null);
              setPreview(null);
              setError(null);
              setStatus("本地草稿保留，可基于最新版本重新保存");
            }}
          >
            保留本地并采用最新版本号
          </button>
          <button onClick={() => setRemote(null)}>继续保留本地草稿</button>
        </aside>
      )}
      {impact && (
        <aside className="notice" aria-label="连接影响确认">
          <h2>
            {impact.impact.some((i: any) => i.kind === "stage")
              ? "阶段转移影响"
              : "连接影响"}
          </h2>
          <ul>
            {impact.impact.map((i: any) => (
              <li key={i.kind + i.id}>
                {i.kind === "edge"
                  ? `${i.from.node}/${i.from.port} → ${i.to.node}/${i.to.port}`
                  : i.kind === "stage"
                    ? `${i.id}：${i.from} → ${i.to}`
                    : "边界 " + i.id}
              </li>
            ))}
          </ul>
          <button
            disabled={busy}
            onClick={() =>
              void act({
                ...impact.action,
                confirmed: true,
                expectedDigest: impact.digest,
              })
            }
          >
            {impact.impact.some((i: any) => i.kind === "stage")
              ? "确认转移阶段成员"
              : "确认处理受影响连接"}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setImpact(null);
              setStatus("已取消，原关系保留");
            }}
          >
            取消变更
          </button>
        </aside>
      )}
      {blocker.state === "blocked" && (
        <aside className="notice">
          <p>草稿尚未保存。</p>
          <button
            onClick={() => {
              void save().then((ok) => {
                if (ok) blocker.proceed();
              });
            }}
          >
            保存后离开
          </button>
          <button onClick={() => blocker.proceed()}>舍弃并离开</button>
          <button onClick={() => blocker.reset()}>留在画布</button>
        </aside>
      )}
      <details className="canvas-library">
        <summary>样例与已保存草稿</summary>
        <div>
          <Field label="样例">
            <select
              disabled={locked}
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            >
              <option value="swiss-eight">瑞士前八 → 八强单败</option>
              <option value="partial-pool">Pool 部分映射</option>
              <option value="single">八人单败</option>
              <option value="gsl">经典 GSL</option>
              <option value="double">八人双败</option>
              <option value="invalid">缺输入异常</option>
              <option value="empty">空画布</option>
            </select>
          </Field>
          <button disabled={locked} onClick={() => void reset()}>
            重置样例
          </button>
          <Field label="已保存草稿">
            <select value={openId} onChange={(e) => setOpenId(e.target.value)}>
              <option value="">选择草稿</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · v{d.version}
                </option>
              ))}
            </select>
          </Field>
          <button
            disabled={!openId || busy}
            onClick={() => void readRemote(openId)}
          >
            读取草稿
          </button>
          {saved && (
            <button disabled={busy} onClick={() => void readRemote()}>
              读取保存版本
            </button>
          )}
        </div>
      </details>
      <div className="canvas-layout">
        <aside className="canvas-palette">
          <h2>组件</h2>
          {graph.schemaVersion === "canvas-v1" && (
            <button disabled={locked} onClick={() => void migrate()}>
              迁移新机制
            </button>
          )}
          {migration && (
            <aside className="notice">
              <p>迁移后所有赛程加入阶段 1，旧批次改由验证自动分配。</p>
              <ul>
                {migration.changes.map((x: any) => (
                  <li key={x.id}>
                    {x.name}：{x.batch}
                  </li>
                ))}
              </ul>
              {migration.baseGraph !== JSON.stringify(graph) && (
                <p>草稿已变化，请取消并重新生成迁移预览。</p>
              )}
              <button
                disabled={
                  locked || migration.baseGraph !== JSON.stringify(graph)
                }
                onClick={() => {
                  install(migration.graph, migration.analysis);
                  setMigration(null);
                  setStatus("已应用迁移，请保存草稿");
                }}
              >
                应用迁移
              </button>
              <button onClick={() => setMigration(null)}>取消迁移</button>
            </aside>
          )}
          {[
            { name: "基础", kinds: ["source", "match", "pool"] },
            { name: "转换", kinds: ["expander", "selector"] },
            { name: "淘汰赛", kinds: ["single", "double"] },
            { name: "瑞士轮", kinds: ["swiss"] },
            { name: "排序", kinds: ["generator"] },
          ].map((category) => (
            <details
              className="canvas-component-category"
              key={category.name}
              open
            >
              <summary>{category.name}</summary>
              <div>
                {category.kinds.map((kind) => (
                  <button
                    key={kind}
                    disabled={locked}
                    aria-label={
                      kind === "single" || kind === "double"
                        ? "添加" +
                          (kind === "single" ? "单败" : "双败") +
                          "子图"
                        : undefined
                    }
                    onClick={() =>
                      kind === "single" || kind === "double"
                        ? void act({
                            type: "preset",
                            name: kind,
                            id: requestKey(),
                            ...(scope ? { parentId: scope } : {}),
                          })
                        : addComponent(kind)
                    }
                  >
                    {kind === "single"
                      ? "单败"
                      : kind === "double"
                        ? "双败"
                        : kind === "generator"
                          ? "随机排序"
                          : labels[kind]}
                  </button>
                ))}
              </div>
            </details>
          ))}
          <button
            disabled={locked || !selected.length}
            onClick={encapsulate}
            aria-keyshortcuts="Control+G Meta+G"
            aria-label="封装所选组件"
          >
            Subgraph · 封装所选
          </button>
          <p className="canvas-small">Ctrl/⌘ 点击多选 · Ctrl/⌘+G 封装</p>
          {graph.schemaVersion === "canvas-v2" && (
            <Stages
              graph={graph}
              selected={selected}
              disabled={locked}
              onCreate={createStage}
              onSelect={inspectStage}
              selectedStage={selectedStage}
            />
          )}
          {node?.kind === "subgraph" && (
            <>
              <button disabled={locked} onClick={() => enter(node.id)}>
                进入所选子图
              </button>
              <button
                disabled={locked}
                onClick={() => void act({ type: "ungroup", id: node.id })}
              >
                展开所选子图
              </button>
            </>
          )}
        </aside>
        <div className="canvas-center">
          <nav aria-label="子图导航">
            <button
              disabled={!scope}
              onClick={() => {
                const group = graph.nodes.find((n) => n.id === scope);
                setScope(group?.parentId ?? null);
                setSelected([]);
                setSelectedStage(null);
              }}
            >
              返回上层
            </button>
            <span>
              {scope ? graph.nodes.find((n) => n.id === scope)?.name : "根画布"}
            </span>
          </nav>
          <CanvasView
            graph={graph}
            analysis={analysis}
            scope={scope}
            selected={selected}
            selectedStage={selectedStage}
            onStageSelect={inspectStage}
            disabled={locked}
            onInspect={inspect}
            onBoxSelect={(ids) => {
              setSelectedStage(null);
              setSelected(ids);
            }}
            onSelect={(id) => {
              setSelectedStage(null);
              setSelected((s) =>
                s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
              );
            }}
            onEnter={enter}
            onPort={(end, p) => {
              if (p.direction === "output") {
                setFrom(JSON.stringify(end));
                setStatus("来源已选择，请点击目标输入");
              } else if (from) {
                void act({ type: "connect", from: JSON.parse(from), to: end });
              } else {
                setTo(JSON.stringify(end));
                setStatus("目标已选择，请在表单选择来源");
              }
            }}
            onMove={(id, x, y, begin) => {
              if (locked) return;
              if (begin) {
                setHistory((h) => [...h.slice(-49), graph]);
                setFuture([]);
              }
              setGraph((g) =>
                g
                  ? {
                      ...g,
                      nodes: g.nodes.map((n) =>
                        n.id === id
                          ? {
                              ...n,
                              position: {
                                x: Math.max(-200000, Math.min(200000, x)),
                                y: Math.max(-200000, Math.min(200000, y)),
                              },
                            }
                          : n,
                      ),
                    }
                  : g,
              );
              setValidation(null);
              setPreview(null);
            }}
          />
        </div>
        <aside
          className="canvas-inspector"
          ref={inspector}
          aria-label="卡片参数面板"
        >
          <WaveResults graph={graph} wavePlan={validation?.wavePlan} />
          <nav className="canvas-dock-nav" aria-label="工具面板导航">
            {[
              ["canvas-parameters", "参数"],
              ["canvas-connections", "连接"],
              ["canvas-diagnostics", "诊断"],
              ["canvas-results", "结果"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  inspector.current
                    ?.querySelector("#" + id)
                    ?.scrollIntoView({ block: "start", behavior: "smooth" })
                }
              >
                {label}
              </button>
            ))}
          </nav>
          <section id="canvas-parameters">
            <h2>
              {stage
                ? "Stage 属性 · " + stage.name
                : "卡片参数" + (node ? " · " + node.name : "")}
            </h2>
            {stage ? (
              <StageProperties
                key={stage.id}
                graph={graph}
                stage={stage}
                disabled={locked}
                onAction={act}
              />
            ) : node ? (
              <Properties
                node={node}
                formats={catalog.formats.formats}
                analysis={analysis}
                graph={graph}
                onAction={act}
                disabled={locked}
              />
            ) : (
              <>
                <p>点击卡片或“参数”按钮，在这里修改参数，再点击“应用属性”。</p>
              </>
            )}
          </section>
          <section className="canvas-connection-form" id="canvas-connections">
            <h2>连接表单</h2>
            <Field label="来源端口">
              <select
                disabled={locked}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                <option value="">选择来源输出</option>
                {endpoints("output").map((p: any) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="目标端口">
              <select
                disabled={locked}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                <option value="">选择目标输入</option>
                {endpoints("input").map((p: any) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <button
              disabled={locked || !from || !to}
              onClick={() =>
                void act({
                  type: "connect",
                  from: JSON.parse(from),
                  to: JSON.parse(to),
                })
              }
            >
              建立连接
            </button>
            <details>
              <summary>
                当前层连接（
                {
                  graph.edges.filter((e) =>
                    inScope.some((n) => n.id === e.from.node),
                  ).length
                }
                ）
              </summary>
              <ul>
                {graph.edges
                  .filter((e) => inScope.some((n) => n.id === e.from.node))
                  .map((e) => (
                    <li key={e.id}>
                      {e.from.node}/{e.from.port} → {e.to.node}/{e.to.port}
                      <button
                        disabled={locked}
                        onClick={() =>
                          void act({ type: "disconnect", edgeId: e.id })
                        }
                      >
                        删除连接
                      </button>
                    </li>
                  ))}
              </ul>
            </details>
          </section>
          <section id="canvas-diagnostics">
            <h3>诊断</h3>
            <p>
              {visibleReport.valid
                ? "规划结构就绪；未来身份待解析"
                : "存在未完成或冲突项，可保存类型合法草稿。"}
            </p>
            <ul className="canvas-diagnostics">
              {visibleReport.diagnostics.map((d: any, i: number) => (
                <li key={i}>
                  {d.severity === "warning" ? "条件校验" : "错误"}：{d.reason}
                  {d.objectId && (
                    <button
                      onClick={() => {
                        const n = graph.nodes.find((n) => n.id === d.objectId);
                        setScope(n?.parentId ?? null);
                        setSelectedStage(null);
                        setSelected([d.objectId]);
                      }}
                    >
                      定位 {d.objectId}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <details id="canvas-results">
            <summary>集合与种子结果</summary>
            {Object.entries<any>(analysis.values ?? {}).map(
              ([id, v]) =>
                v.collection && (
                  <div key={id}>
                    <strong>
                      {graph.nodes.find((n) => n.id === id)?.name}
                    </strong>
                    <ol>
                      {v.collection.items.map((x: any) => (
                        <li key={x.ref}>
                          {x.label} · 当前种子 {v.seeds.mapping[x.ref]}
                        </li>
                      ))}
                    </ol>
                  </div>
                ),
            )}
          </details>
        </aside>
      </div>
      {preview && (
        <section className="canvas-preview">
          <h2>赛程预览</h2>
          <p>
            保存版本 {preview.version} · 未知姓名使用来源占位，未写入实际赛果。
          </p>
          {preview.windows.map((w: any) => (
            <p key={w.planKey}>
              {w.name}：{w.pairing}
            </p>
          ))}
          <div className="canvas-preview-list">
            {preview.matches.map((m: any) => (
              <article data-preview-match={m.id} key={m.planKey}>
                <h3>
                  {m.name} · BO{m.bestOf}
                </h3>
                <p>A：{m.A?.label ?? (m.bye ? "轮空" : "来源待定")}</p>
                <p>B：{m.B?.label ?? (m.bye ? "轮空" : "来源待定")}</p>
                {m.bye && <p>{m.bye === "both" ? "双方轮空" : "轮空晋级"}</p>}
                <p>批次：{m.batch}</p>
                <small>{m.planKey}</small>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
