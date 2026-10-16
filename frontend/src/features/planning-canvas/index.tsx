import { useEffect, useMemo, useRef, useState } from "react";
import { localEditor } from "./local-editor";
import { EditorState } from "./editor-state";
import { beginAnalysis, acceptAnalysis, invalidateAnalysis, type AnalysisState } from "./analysis-state";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { api as platformApi, failure, requestKey, ApiFailure } from "../../shared/api";
import { useSession } from "../../app/session";
import { ErrorNotice, Field } from "../../shared/ui";
import { CanvasView } from "./view";
import { Properties } from "./properties";
import { Stages, StageProperties, WaveResults } from "./stages";
import { expandStageMembers, visibleNode } from "./stage-members";
import {
  labels,
  type CanvasGraph,
  type CanvasNode,
  type Endpoint,
  type Port,
} from "./types";
import "./style.css";
export function CanvasLab() {
  const ownerId = useSession().user?.id;
  const authRequired = useRef(false);
  const api: typeof platformApi = async (path, options = {}) => {
    try {
      if (authRequired.current && options.method && options.method !== "GET") {
        const session = await platformApi<{user:{id:string}|null}>("/auth/session",{deferSessionExpiry:true});
        if (!ownerId || session.user?.id !== ownerId)
          throw new ApiFailure("请使用原账号重新登录，再保存当前草稿。",{status:401,code:"AUTH_REQUIRED",retryable:false});
        authRequired.current = false;
      }
      return await platformApi(path,{...options,deferSessionExpiry:true});
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 401) authRequired.current = true;
      throw error;
    }
  };
  const [query, setQuery] = useSearchParams(),
    [graph, setGraphState] = useState<CanvasGraph | null>(null),
    [analysisState, setAnalysisState] = useState<AnalysisState>({status:"unanalysed"}),
    [fieldDraftPending, setFieldDraftPending] = useState(false),
    [editorRevision, setEditorRevision] = useState(0),
    [analysis, setAnalysis] = useState<any>(null),
    [catalog, setCatalog] = useState<any>(null),
    [saved, setSavedState] = useState<any>(null),
    [remote, setRemote] = useState<any>(null),
    [drafts, setDrafts] = useState<any[]>([]),
    [openId, setOpenId] = useState(""),
    [switchTarget, setSwitchTarget] = useState<string | null>(null),
    [name, setName] = useState("瑞士前八进入八强单败"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiFailure | null>(null),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [selectedStages, setSelectedStages] = useState<string[]>([]),
    [selectedEdge, setSelectedEdge] = useState<string | null>(null),
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
    [pendingSave, setPendingSave] = useState<any>(null);
  const actionBusy = useRef(false),
    editorState = useRef(new EditorState()),
    analysisRequest = useRef(0),
    analysisAbort = useRef<AbortController | null>(null),
    propertyGroup = useRef<{element: Element | null; id: string} | null>(null),
    propertyInput = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null),
    graphRef = useRef<CanvasGraph | null>(null),
    switchRequest = useRef(0),
    inspector = useRef<HTMLElement>(null),
    writeRef = useRef<any>(null),
    loadedCanvas = useRef<string | null | undefined>(undefined);
  const setGraph: typeof setGraphState = (value) => {
    const next = typeof value === "function" ? value(graphRef.current) : value;
    graphRef.current = next;
    editorState.current.commit(next);
    setAnalysisState(invalidateAnalysis);
    setGraphState(next);
  };
  const setSaved = (record: any) => {
    if (record) {
      editorState.current.markSaved(record.graph, record.name);
      editorState.current.projectId = record.id;
    } else editorState.current.forgetSaved();
    setSavedState(record);
  };
  const editor = useMemo(() => catalog ? localEditor(catalog) : null, [catalog]);
  const editorModel = useMemo(() => graph && editor ? editor.deriveEditorModel(graph) : null, [graph, editor]);
  const analysisView = useMemo(() => ({...editorModel, values: analysisState.status === "current" ? analysis?.values ?? {} : {}}), [editorModel, analysis, analysisState.status]);
  const canvasId = query.get("canvas");
  const selectedStage = selectedStages.at(-1) ?? null;
  const setSelectedStage = (id: string | null) =>
    setSelectedStages(id ? [id] : []);
  const dirty =
    graph !== null &&
    (fieldDraftPending || editorState.current.dirty(name));
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        (currentLocation.search !== nextLocation.search &&
          new URLSearchParams(nextLocation.search).get("canvas") !==
            loadedCanvas.current)),
  );
  const propertyLocked = busy || pendingSave !== null || deleteRequest !== null;
  const locked = propertyLocked;
  useEffect(() => {
    setSelectedStages((ids) =>
      ids.filter((id) => graph?.stages?.some((s) => s.id === id)),
    );
    setSelectedEdge((id) =>
      graph?.edges.some((e) => e.id === id) ? id : null,
    );
    setFrom((end) =>
      end && graph?.nodes.some((n) => n.id === JSON.parse(end).node) ? end : "",
    );
    setTo((end) =>
      end && graph?.nodes.some((n) => n.id === JSON.parse(end).node) ? end : "",
    );
  }, [graph]);
  useEffect(() => {
    setFrom("");
    setTo("");
    setSelectedEdge(null);
  }, [scope]);
  useEffect(() => {
    if (loadedCanvas.current === canvasId) return;
    loadedCanvas.current = canvasId;
    editorState.current.replace(null, canvasId);
    analysisAbort.current?.abort();
    setAnalysisState({status:"unanalysed"});
    setFieldDraftPending(false);
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
        localEditor(cat);
        setCatalog(cat);
        setDrafts(list);
        const id = canvasId;
        if (id) {
          const record = await api(
            "/planning-canvases/" + encodeURIComponent(id),
            { signal: controller.signal },
          );
          const r = localEditor(cat).edit(record.graph, { type: "syncBoundaries" });
          if (active) {
            setGraph(r.graph);
            if (JSON.stringify(r.graph) !== JSON.stringify(record.graph))
              setStatus("已自动补齐子图悬空接口，请保存当前草稿");
            setName(record.name);
            setSaved(record);
            setOpenId(record.id);
          }
        } else {
          const x = {graph: structuredClone(cat.samples["swiss-eight"])};
          if (active) {
            setGraph(x.graph);
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
  const install = (
    g: CanvasGraph,
    r: any,
    undo = true,
    preserveEditor = false,
  ) => {
    const previous = graphRef.current;
    if (undo && previous) {
      setHistory((h) => [...h.slice(-49), previous]);
      setFuture([]);
    }
    setGraph(g);
    if (!preserveEditor) setEditorRevision((value) => value + 1);
    setAnalysis(r);
    setValidation(null);
    setPreview(null);
    setImpact(null);
    setError(null);
    setSelected((s) => s.filter((id) => g.nodes.some((n) => n.id === id)));
  };
  async function act(
    action: any,
    silentInvalid = false,
    onResult?: (result: "applied" | "invalid" | "failed") => void,
  ) {
    const property =
      !action.confirmed &&
      ((action.type === "update" && !action.position) ||
        (action.type === "updateStage" && !action.selected));
    if (!property && !action.confirmed && !flushEditor()) return;
    await performAction(action, silentInvalid, onResult, property);
  }
  async function performAction(
    action: any,
    silentInvalid = false,
    onResult?: (result: "applied" | "invalid" | "failed") => void,
    property = false,
  ) {
    const currentGraph = graphRef.current;
    if (!currentGraph || actionBusy.current || pendingSave) return;
    setError(null);
    try {
      if (!editor) return;
      if (action.confirmed && impact?.token && !editorState.current.matches(impact.token)) {
        action = {...action, confirmed: false, expectedDigest: undefined};
      }
      const result = editor.edit(currentGraph, action);
      if (result.requiresConfirmation) {
        setImpact({ ...result, action, token: editorState.current.capture() });
        setStatus("请检查连接影响；取消会保留原草稿");
      } else {
        if (JSON.stringify(result.graph) !== JSON.stringify(currentGraph)) {
          const active = document.activeElement;
          const grouped = property && propertyGroup.current?.element === active && propertyGroup.current.id === action.id;
          install(result.graph, null, !grouped, property);
          propertyGroup.current = property ? {element:active,id:action.id} : null;
          setStatus("画布已更新，尚未保存");
        }
        if (action.type === "add" || action.type === "preset") {
          const addedId = action.node?.id ?? action.id;
          setSelectedStage(null);
          setSelectedEdge(null);
          setSelected(addedId ? [addedId] : []);
        }
        if (action.type === "createStage" && result.stageId) {
          setSelectedStage(result.stageId);
          const target = result.graph.stages.find(
            (s: any) => s.id === result.stageId,
          );
          setStatus(`所选组件已加入 Stage ${target.order} · ${target.name}`);
        }
        onResult?.("applied");
      }
    } catch (e) {
      const er = failure(e);
      if ((e as any)?.code === "INVALID_INPUT") {
        er.status = 422;
        er.code = "INVALID_INPUT";
        er.retryable = false;
      }
      if (property && er.code === "INVALID_INPUT") propertyInput.current?.setCustomValidity(er.message);
      if (silentInvalid && er.status === 422 && er.code === "INVALID_INPUT")
        onResult?.("invalid");
      else {
        setError(er);
        onResult?.("failed");
      }
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
      editorState.current.replace(null, null);
      install(structuredClone(catalog.samples[sample]), null);
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
    try {
      if (redo) {
        setFuture((f) => f.slice(0, -1));
        setHistory((h) => [...h, graph]);
      } else {
        setHistory((h) => h.slice(0, -1));
        setFuture((f) => [...f, graph]);
      }
      propertyGroup.current = null;
      install(next, null, false);
      setScope((s) => (next.nodes.some((n) => n.id === s) ? s : null));
      setStatus(redo ? "已重做" : "已撤销");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  function flushEditor() {
    if (document.activeElement instanceof HTMLElement && inspector.current?.contains(document.activeElement)) document.activeElement.blur();
    const inputs = inspector.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select") ?? [];
    for (const input of inputs) if (!input.checkValidity()) { input.reportValidity(); input.focus(); return false; }
    setFieldDraftPending(false);
    return true;
  }
  async function analyzeDraft() {
    const currentGraph = graphRef.current;
    if (!currentGraph || !flushEditor()) return;
    analysisAbort.current?.abort();
    const controller = new AbortController();
    analysisAbort.current = controller;
    const token = editorState.current.capture(), requestId = ++analysisRequest.current;
    setAnalysisState(previous => beginAnalysis(previous, token, requestId));
    try {
      const result = await api("/planning-canvas/analyze", {method:"POST",body:{graph:graphRef.current},signal:controller.signal});
      if (!editorState.current.matches(token) || requestId !== analysisRequest.current) return;
      setAnalysis(result);
      setAnalysisState(previous => acceptAnalysis(previous, token, requestId, result));
    } catch (e) {
      if (!editorState.current.matches(token) || requestId !== analysisRequest.current || controller.signal.aborted) return;
      setAnalysisState(previous => ({...previous,status:"failed",error:e}));
      setError(failure(e));
    }
  }
  async function save(retry = false): Promise<boolean> {
    if (!flushEditor()) return false;
    const currentGraph = graphRef.current;
    if (!currentGraph || actionBusy.current) return false;
    actionBusy.current = true;
    setBusy(true);
    setError(null);
    const request = retry
      ? writeRef.current
      : {
          path: saved ? "/planning-canvases/" + saved.id : "/planning-canvases",
          method: saved ? "PUT" : "POST",
          body: {
            graph: currentGraph,
            name,
            ...(saved ? { expectedVersion: saved.version } : {}),
          },
          key: requestKey(),
        };
    writeRef.current = request;
    setPendingSave(request);
    const token = editorState.current.capture();
    try {
      const r = await api(request.path, request);
      if (!editorState.current.matches(token)) return false;
      setSaved(r);
      setOpenId(r.id);
      loadedCanvas.current = r.id;
      setQuery({ canvas: r.id }, { replace: true });
      setValidation(null);
      setPreview(null);
      setPendingSave(null);
      writeRef.current = null;
      setDrafts(items => [{id:r.id,name:r.name,version:r.version},...items.filter(item => item.id !== r.id)]);
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
    const token = editorState.current.capture();
    setBusy(true);
    try {
      const r = await api("/planning-canvases/" + encodeURIComponent(id));
      if (!editorState.current.matches(token)) return;
      if (adopt) {
        setSelectedStage(null);
        const info = editor!.edit(r.graph, {type:"syncBoundaries"});
        editorState.current.replace(null, r.id);
        install(info.graph, null);
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
    const token = editorState.current.capture();
    try {
      const r = await api(
        "/planning-canvases/" +
          saved.id +
          (isPreview ? "/preview" : "/validate"),
        { method: "POST", body: { expectedVersion: saved.version } },
      );
      if (!editorState.current.matches(token)) return;
      if (isPreview) {
        setPreview(r);
        setStatus("已生成保存版本 " + r.version + " 的赛程预览");
      } else {
        setValidation(r);
        setAnalysis(r);
        setAnalysisState({status:"current",token,result:r});
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
    if (
      !graph ||
      locked ||
      (!selected.length && !selectedStages.length)
    )
      return;
    const members = [
      ...new Set([
        ...selected,
        ...(graph.stages ?? [])
          .filter((s) => selectedStages.includes(s.id))
          .flatMap((s) => expandStageMembers(graph, s.nodeIds)),
      ]),
    ];
    void act({
      type: "createStage",
      selected: members,
      stageIds: selectedStages,
      id: requestKey(),
    });
  };
  const inspectStage = (id: string, additive = false) => {
    if (!flushEditor()) return;
    if (additive)
      setSelectedStages((ids) =>
        ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
      );
    else {
      setSelectedStage(id);
      setSelected([]);
    }
    setSelectedEdge(null);
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
          schemaVersion: "canvas",
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
      if (asNew) editorState.current.replace(null, null);
      install(structuredClone(catalog.samples.empty), null, !asNew);
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
  const requestSwitch = async (id: string) => {
    if (propertyLocked || (id && id === saved?.id)) return;
    const sequence = ++switchRequest.current;
    if (!flushEditor()) return;
    if (sequence !== switchRequest.current) return;
    const changed =
      graphRef.current &&
      (!saved ||
        JSON.stringify(graphRef.current) !== JSON.stringify(saved.graph) ||
        name !== saved.name);
    if (changed) setSwitchTarget(id);
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
      if (locked || impact) return;
      if (
        e.key === "Delete" &&
        selectedEdge &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        if (!e.repeat) void act({ type: "disconnect", edgeId: selectedEdge });
        return;
      }
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
  }, [graph, selected, selectedStages, selectedEdge, locked, impact]);
  if (!graph || !catalog)
    return (
      <section>
        <h1>赛程规划画布</h1>
        {error ? (
          <><ErrorNotice error={error} /><button onClick={() => window.location.reload()}>刷新目录</button></>
        ) : (
          <p role="status">正在读取规划模型…</p>
        )}
      </section>
    );
  const inScope = graph.nodes.filter((n) => (n.parentId ?? null) === scope),
    node = graph.nodes.find((n) => n.id === selected.at(-1)),
    stage = graph.stages?.find((s) => s.id === selectedStage);
  const enter = (id: string) => {
    setSelectedStage(null);
    setScope(id);
    setSelected([]);
    setFrom("");
    setTo("");
  };
  const visibleReport = validation ?? (analysisState.status === "current" ? analysis : editorModel);
  const diagnosticGroups = new Map<
    string,
    { node?: CanvasNode; items: any[] }
  >();
  visibleReport.diagnostics.forEach((d: any, i: number) => {
    const n = visibleNode(graph, d.objectId, scope);
    const key = n && n.id !== d.objectId ? "group:" + n.id : "item:" + i;
    const entry = diagnosticGroups.get(key) ?? {
      node: n && n.id !== d.objectId ? n : undefined,
      items: [],
    };
    entry.items.push(d);
    diagnosticGroups.set(key, entry);
  });
  const diagnosticItem = (d: any, i: number) => (
    <li key={i}>
      {d.severity === "warning" ? "条件校验" : "错误"}：{d.reason}
      {d.objectId && (
        <button
          onClick={() => {
            const n = graph.nodes.find((n) => n.id === d.objectId);
            setScope(n?.parentId ?? null);
            inspect(d.objectId);
          }}
        >
          定位{" "}
          {graph.nodes.find((n) => n.id === d.objectId)?.name ?? d.objectId}
        </button>
      )}
    </li>
  );
  const inspect = (id: string) => {
    if (!flushEditor()) return;
    setSelectedStage(null);
    setSelectedEdge(null);
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
    <div className="canvas-lab" aria-busy={busy}>
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
            disabled={propertyLocked}
            value={saved?.id ?? ""}
            onChange={(e) => void requestSwitch(e.target.value)}
          >
            <option value="">选择已保存项目</option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · v{d.version}
              </option>
            ))}
          </select>
        </Field>
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
        <button disabled={propertyLocked || !dirty} onClick={() => void save()}>
          保存草稿
        </button>
        <button disabled={propertyLocked || analysisState.status === "pending"} onClick={() => void analyzeDraft()}>
          分析草稿
        </button>
        <span aria-live="polite" aria-label="草稿分析状态">
          {{unanalysed:"尚未分析",pending:"正在分析草稿",current:"分析结果已更新",stale:"分析结果已过期",failed:"草稿分析失败"}[analysisState.status]}
        </span>
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
      {error?.status === 401 && <p>草稿仍保留。<a href="/login" target="_blank" rel="noopener noreferrer">使用原账号重新登录</a>后重试。</p>}
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
              setEditorRevision((value) => value + 1);
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
              <option value="round-robin">四人单循环</option>
              <option value="double-round-robin">四人双循环</option>
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
          {[
            { name: "基础", kinds: ["source", "pool"] },
            {
              name: "转换",
              kinds: ["expander", "selector-top", "selector-random"],
            },
            { name: "淘汰赛", kinds: ["match", "single", "double"] },
            { name: "瑞士轮", kinds: ["swiss"] },
            { name: "小组赛", kinds: ["round-robin"] },
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
          <Stages
              graph={graph}
              selected={selected}
              disabled={locked}
              onCreate={() => createStage()}
              onSelect={inspectStage}
              selectedStage={selectedStage}
              selectedStages={selectedStages}
          />
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
            analysis={editorModel}
            scope={scope}
            selected={selected}
            selectedStage={selectedStage}
            selectedStages={selectedStages}
            selectedFrom={from ? JSON.parse(from) : null}
            selectedTo={to ? JSON.parse(to) : null}
            selectedEdge={selectedEdge}
            onEdgeSelect={(id) => {
              setSelectedEdge(id);
              setSelected([]);
              setSelectedStage(null);
            }}
            onDisconnect={(id) => void act({ type: "disconnect", edgeId: id })}
            onStageSelect={inspectStage}
            disabled={locked}
            onInspect={inspect}
            onBoxSelect={(ids) => {
              setSelectedStage(null);
              setSelected(ids);
            }}
            onSelect={(id) => {
              setSelectedEdge(null);
              setSelected((s) =>
                s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
              );
            }}
            onEnter={enter}
            onPort={(end, p) => {
              setSelectedEdge(null);
              const active = from
                ? { end: JSON.parse(from), direction: "output" }
                : to
                  ? { end: JSON.parse(to), direction: "input" }
                  : null;
              const clear = () => {
                setFrom("");
                setTo("");
              };
              if (
                active?.direction === p.direction &&
                active.end.node === end.node &&
                active.end.port === end.port
              ) {
                clear();
                void act({
                  type: "disconnectPort",
                  from: end,
                  direction: p.direction,
                });
                return;
              }
              setFrom(p.direction === "output" ? JSON.stringify(end) : "");
              setTo(p.direction === "input" ? JSON.stringify(end) : "");
              if (!active || active.direction === p.direction) return;
              void act(
                {
                  type: "connect",
                  from: p.direction === "output" ? end : active.end,
                  to: p.direction === "input" ? end : active.end,
                },
                true,
                (result) => {
                  if (result === "applied") clear();
                },
              );
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
          onFocusCapture={event => {
            const field = event.target;
            if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) propertyInput.current = field;
          }}
          onChangeCapture={event => {
            const field = event.target;
            if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) { propertyInput.current = field; field.setCustomValidity(""); setFieldDraftPending(true); }
          }}
        >
          <WaveResults graph={graph} wavePlan={validation?.wavePlan} />
          <nav className="canvas-dock-nav" aria-label="工具面板导航">
            {[
              ["canvas-parameters", "参数"],
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
                key={stage.id + ":" + editorRevision}
                graph={graph}
                stage={stage}
                disabled={propertyLocked}
                onAction={act}
              />
            ) : node ? (
              <Properties
                key={node.id + ":" + editorRevision}
                node={node}
                formats={catalog.formats.formats}
                matchFormats={catalog.matchFormats}
                analysis={analysisView}
                graph={graph}
                onAction={act}
                disabled={propertyLocked}
              />
            ) : (
              <>
                <p>点击卡片或“参数”按钮，修改属性后自动生效。</p>
              </>
            )}
          </section>
          <section id="canvas-diagnostics">
            <h3>诊断</h3>
            <p>
              {analysisState.status !== "current" && !validation ? "尚未分析当前草稿，可先检查本地结构。" : visibleReport.valid
                ? "规划结构就绪；未来身份待解析"
                : "存在未完成或冲突项，可保存类型合法草稿。"}
            </p>
            <ul className="canvas-diagnostics">
              {[...diagnosticGroups].map(([key, entry]) =>
                entry.node ? (
                  <li key={key}>
                    <details>
                      <summary>
                        {entry.node.name} · {entry.items.length} 项诊断
                      </summary>
                      <ul>{entry.items.map(diagnosticItem)}</ul>
                    </details>
                  </li>
                ) : (
                  diagnosticItem(entry.items[0], Number(key.slice(5)))
                ),
              )}
            </ul>
          </section>
          <details id="canvas-results">
            <summary>集合与种子结果</summary>
            {Object.entries<any>(analysisView.values ?? {}).map(
              ([id, v]) =>
                v.collection &&
                inScope.some((n) => n.id === id) && (
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
                    {v.complement && (
                      <details>
                        <summary>补集（{v.complement.items.length}）</summary>
                        <ol>
                          {v.complement.items.map((x: any) => (
                            <li key={x.ref}>
                              {x.label} · 当前种子{" "}
                              {v.complementSeeds.mapping[x.ref]}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                ),
            )}
            {inScope
              .filter((n) => n.kind === "subgraph")
              .map((n) => (
                <div key={n.id}>
                  <strong>{n.name}</strong>
                  {Object.entries<any>(analysisView.values?.[n.id] ?? {})
                    .filter(([, value]) => value?.kind === "collection")
                    .map(([port, value]) => (
                      <ol key={port}>
                        {value.items.map((x: any) => (
                          <li key={x.ref}>{x.label}</li>
                        ))}
                      </ol>
                    ))}
                </div>
              ))}
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
