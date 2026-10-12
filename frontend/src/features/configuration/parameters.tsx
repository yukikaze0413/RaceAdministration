import { Report } from "./preview";
import {
  useSessionState,
  sameValue,
  ParameterLeaveGuard,
  useSessionAccess,
  saveSessionLayout,
  structurePayload,
} from "./session";
import { GraphEditor } from "../tournament/graph";
import { PoolForms, RouteForms } from "./forms";
import { UpgradeOrigin } from "./upgrade";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, failure, type ApiFailure } from "../../shared/api";
import { Field, Resource, useResource, ErrorNotice } from "../../shared/ui";
import { useWrite } from "../../shared/write";
import {
  sizes,
  qualifiers,
  counts,
  groupInputs,
  inputBudget,
  repair,
  parametersValid,
  fromDefinition,
  fromStage,
  type Definition,
} from "./format-options";
import { AdvancedParameters, parameterComparison } from "./parameter-fields";
export function ParameterWorkbench({
  initial,
  url,
}: {
  initial: any;
  url: string;
}) {
  const resource = useResource("/formats");
  return (
    <Resource state={resource}>
      {(catalog) => (
        <ParameterEditor
          initial={initial}
          url={url}
          definitions={catalog.formats}
        />
      )}
    </Resource>
  );
}
function ParameterEditor({
  initial,
  url,
  definitions,
}: {
  initial: any;
  url: string;
  definitions: Definition[];
}) {
  const [saved, setSaved] = useSessionState<any>("v2-saved", initial),
    [stageId, setStageId] = useSessionState<string | null>(
      "v2-stage-id",
      initial.stages[0]?.id ?? null,
    );
  const [draft, setDraft] = useSessionState<any>("v2-parameters", () =>
    initial.stages[0]
      ? fromStage(initial.stages[0])
      : fromDefinition(definitions[0]),
  );
  const navigate = useNavigate();
  const { tab } = useParams(),
    prefix =
      "/manage/" + initial.tournamentId + "/configurations/" + initial.id;
  const [structureDraft, setStructureDraft] = useSessionState<any>(
      "v2-structure",
      initial,
    ),
    [layoutDirty, setLayoutDirty] = useSessionState("layout-dirty", false),
    [freshBase, setFreshBase] = useSessionState<any>("v2-new-base", () =>
      fromDefinition(definitions[0]),
    );
  const structureDirty = !sameValue(structureDraft, saved);
  const write = useWrite(),
    [notice, setNotice] = useState(""),
    [adjustment, setAdjustment] = useState(""),
    [checking, setChecking] = useState(false);
  const [readError, setReadError] = useState<ApiFailure | null>(null),
    [pending, setPending] = useState<any>(null);
  const sessionCache = useSessionAccess(),
    confirmation = useRef<((ok: boolean) => void) | null>(null);
  const latestConfiguration = useRef(saved);
  const [report, setReport] = useSessionState<any>("v2-report", null),
    [freezeOpen, setFreezeOpen] = useState(false),
    freezeDialog = useRef<HTMLDialogElement>(null),
    lastAction = useRef<"stage" | "structure" | "freeze" | "layout">("stage");
  useEffect(() => {
    if (freezeOpen) freezeDialog.current?.showModal();
    else freezeDialog.current?.close();
  }, [freezeOpen]);
  const reading = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastMutation = useRef<{
    kind: "create" | "apply";
    path: string;
    body: any;
  } | null>(null);
  const [server, setServer] = useState<any>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      confirmation.current?.(false);
      confirmation.current = null;
    };
  }, []);
  useEffect(() => {
    if (pending) dialog.current?.showModal();
    else dialog.current?.close();
  }, [pending]);
  const definition = definitions.find(
    (d) => d.ruleVersion === draft.ruleVersion,
  );
  const oldStage = saved.stages.find((s: any) => s.id === stageId);
  const dirty = oldStage
    ? !sameValue(draft, fromStage(oldStage))
    : !sameValue(draft, freshBase);
  const disabled =
    write.busy ||
    checking ||
    !!pending ||
    saved.state !== "draft" ||
    structureDirty;
  function edit(next: any, geometry = true) {
    lastMutation.current = null;
    const fixed = geometry ? repair(next, inputBudget(saved, stageId)) : next;
    setAdjustment(
      ["groupSize", "groupCount", "qualifyCount"].some(
        (k) => fixed[k] !== next[k],
      )
        ? "已调整相关数量，请确认人数摘要。"
        : "",
    );
    setDraft(fixed);
    setNotice("");
    write.clearError();
    setReadError(null);
  }
  function accept(result: any) {
    lastMutation.current = null;
    const selected =
      result.stages.find((s: any) => s.id === stageId) ?? result.stages.at(-1);
    setServer(null);
    setSaved(result);
    setStructureDraft(result);
    latestConfiguration.current = result;
    setStageId(selected?.id ?? null);
    setDraft(selected ? fromStage(selected) : freshBase);
    setPending(null);
    setNotice("阶段已保存。");
  }
  async function mutate(kind: "create" | "apply", path: string, body: any) {
    lastAction.current = "stage";
    lastMutation.current = { kind, path, body };
    const result = await write.run(path, "POST", body);
    if (result) accept(kind === "create" ? result : result.configuration);
    return !!result;
  }
  async function apply(changes: any, report?: any) {
    return await mutate("apply", url + "/stages/" + stageId + "/apply", {
      expectedVersion: saved.version,
      changes,
      ...(report
        ? { confirmed: true, confirmationToken: report.confirmationToken }
        : {}),
    });
  }
  async function retry() {
    if (lastAction.current === "layout") {
      await saveAll();
      return;
    }
    if (lastAction.current === "freeze") {
      await freezeSaved();
      return;
    }
    if (lastAction.current === "structure") {
      await saveStructure();
      return;
    }
    const request = lastMutation.current;
    if (request) await mutate(request.kind, request.path, request.body);
    else await save();
  }
  async function save() {
    setReadError(null);
    write.clearError();
    lastMutation.current = null;
    if (!stageId) {
      return await mutate("create", url + "/stages", {
        expectedVersion: saved.version,
        stage: draft,
      });
    }
    setChecking(true);
    try {
      const { name, ...changes } = draft;
      const report = await api(url + "/stages/" + stageId + "/plan", {
        method: "POST",
        body: { expectedVersion: saved.version, changes },
      });
      if (!alive.current) return;
      if (report.requiresConfirmation || report.blockers?.length) {
        setPending({ report, changes });
        return await new Promise<boolean>((resolve) => {
          confirmation.current = resolve;
        });
      } else return await apply(changes);
    } catch (e) {
      setReadError(failure(e));
    } finally {
      setChecking(false);
    }
  }
  function cancelImpact() {
    setPending(null);
    confirmation.current?.(false);
    confirmation.current = null;
  }
  async function confirmImpact() {
    const current = pending;
    setPending(null);
    const ok = await apply(current.changes, current.report);
    confirmation.current?.(ok);
    confirmation.current = null;
  }
  function editStructure(next: any) {
    setStructureDraft(next);
    setNotice("");
    setReport(null);
    write.clearError();
    setReadError(null);
    lastMutation.current = null;
    lastAction.current = "structure";
  }
  async function saveStructure() {
    setNotice("");
    lastAction.current = "structure";
    const result = await write.run(url, "PUT", {
      expectedVersion: saved.version,
      payload: structurePayload(structureDraft),
    });
    if (result) accept(result);
    return !!result;
  }
  async function saveAll() {
    if (dirty && !valid) {
      setNotice("请先修正当前阶段参数，再保存。");
      return false;
    }
    if (dirty && structureDirty) return false;
    if (structureDirty) {
      if (!(await saveStructure())) return false;
    } else if (dirty) {
      if (!(await save())) return false;
    }
    if (layoutDirty) {
      lastAction.current = "layout";
      if (
        !(await saveSessionLayout(
          sessionCache,
          write,
          url,
          latestConfiguration.current,
        ))
      )
        return false;
      setLayoutDirty(false);
    }
    return true;
  }
  async function validateSaved() {
    setChecking(true);
    setReport(null);
    try {
      const result = await api(url + "/validate", {
        method: "POST",
        body: { expectedVersion: latestConfiguration.current.version },
      });
      if (alive.current) setReport(result);
    } catch (e) {
      if (alive.current) setReadError(failure(e));
    } finally {
      if (alive.current) setChecking(false);
    }
  }
  async function freezeSaved() {
    setFreezeOpen(false);
    lastAction.current = "freeze";
    lastMutation.current = null;
    const current = latestConfiguration.current;
    const snapshot = await write.run(url + "/freeze", "POST", {
      expectedVersion: current.version,
    });
    if (snapshot)
      accept({
        ...current,
        state: "structure-frozen",
        version: snapshot.version,
        snapshot,
      });
  }
  async function saveAndFreeze() {
    if (await saveAll()) await freezeSaved();
  }
  function discardAndFreeze() {
    setDraft(
      stageId
        ? fromStage(saved.stages.find((s: any) => s.id === stageId))
        : freshBase,
    );
    setStructureDraft(saved);
    setLayoutDirty(false);
    sessionCache.set("graph-dirty", false);
    if (sessionCache.get("graph-baseline"))
      sessionCache.set("graph-layout", sessionCache.get("graph-baseline"));
    void freezeSaved();
  }
  function locate(d: any) {
    navigate(
      prefix +
        (d.path.startsWith("/pools")
          ? "/pools"
          : d.path.startsWith("/routes")
            ? "/routes"
            : "/stages"),
    );
  }
  async function readLatest() {
    if (lastAction.current === "layout") {
      navigate(prefix + "/graph");
      sessionCache.get("graph-reload")?.();
      write.clearError();
      return;
    }
    if (reading.current || write.busy || checking || pending) return;
    reading.current = true;
    setChecking(true);
    try {
      const latest = await api(url);
      if (alive.current) setServer(latest);
    } catch (e) {
      if (alive.current) setReadError(failure(e));
    } finally {
      reading.current = false;
      if (alive.current) setChecking(false);
    }
  }
  function recover(keep: boolean) {
    if (write.busy || checking || pending) return;
    lastMutation.current = null;
    const latestStage = server.stages.find((s: any) => s.id === stageId);
    setSaved(server);
    latestConfiguration.current = server;
    setStructureDraft(
      keep && structureDirty
        ? {
            ...server,
            pools: structureDraft.pools,
            routes: structureDraft.routes,
          }
        : server,
    );
    if (keep) {
      if (!dirty && latestStage) setDraft(fromStage(latestStage));
      if (!latestStage) setStageId(null);
    } else {
      setStageId(latestStage?.id ?? null);
      setDraft(
        latestStage ? fromStage(latestStage) : fromDefinition(definitions[0]),
      );
    }
    setServer(null);
    setPending(null);
    write.clearError();
    setReadError(null);
    setNotice(keep ? "已采用最新版本，保留我的输入。" : "已采用服务器参数。");
  }
  function selectStage(id: string | null) {
    if (disabled) return;
    if (dirty && !window.confirm("放弃本阶段尚未保存的输入？")) return;
    lastMutation.current = null;
    setServer(null);
    setAdjustment("");
    setStageId(id);
    if (!id)
      setFreshBase(
        fromDefinition(definitions[0], "阶段" + (saved.stages.length + 1)),
      );
    setDraft(
      id
        ? fromStage(saved.stages.find((s: any) => s.id === id))
        : fromDefinition(definitions[0], "阶段" + (saved.stages.length + 1)),
    );
    setNotice("");
    write.clearError();
    setReadError(null);
  }
  if (!definition)
    return <p>此规则暂不在可编辑目录中，请保留原配置并重新读取赛制目录。</p>;
  const inputs = groupInputs(draft),
    budget = inputBudget(saved, stageId);
  const advancedValid = parametersValid(draft, definition);
  const valid =
    advancedValid &&
    sizes(draft, budget).includes(draft.groupSize) &&
    counts(draft, budget).includes(draft.groupCount) &&
    qualifiers(draft).includes(draft.qualifyCount);
  const groupName = (id: string) => {
    const index = oldStage?.groups.findIndex((g: any) => g.id === id) ?? -1;
    return index >= 0 && index < 26
      ? String.fromCharCode(65 + index) + "组"
      : id.slice(0, 8);
  };
  return (
    <section className="parameter-workbench">
      <UpgradeOrigin origin={saved.upgradeOrigin} />
      <ParameterLeaveGuard
        dirty={dirty || structureDirty || layoutDirty}
        onSave={saveAll}
      />
      <nav className="tabs">
        {[
          ["stages", "赛制参数"],
          ["graph", "赛制画布"],
          ["pools", "选手池"],
          ["routes", "晋级路由"],
          ["validation", "校验与冻结"],
          ["preview", "来源预演"],
        ].map(([key, label]) => (
          <Link
            key={key}
            aria-current={tab === key ? "page" : undefined}
            to={prefix + "/" + key}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="title-row">
        <div>
          <h2>赛制参数</h2>
          <p>
            版本 {saved.version} · {dirty ? "有未保存输入" : "已保存"}
          </p>
        </div>
        <Link to={"/manage/" + initial.tournamentId + "/overview"}>
          配置列表
        </Link>
      </div>
      <nav className="actions" aria-label="选择阶段">
        {saved.stages.map((s: any, i: number) => (
          <button
            key={s.id}
            disabled={disabled}
            aria-pressed={stageId === s.id}
            onClick={() => selectStage(s.id)}
          >
            {i + 1}. {s.name}
          </button>
        ))}
        {saved.stages.length > 0 && (
          <button disabled={disabled} onClick={() => selectStage(null)}>
            添加新阶段
          </button>
        )}
      </nav>
      {notice && <p role="status">{notice}</p>}
      {(write.error || readError) && (
        <>
          <ErrorNotice
            error={(write.error || readError)!}
            onRetry={
              (write.error || readError)?.status === 409
                ? undefined
                : () => void retry()
            }
          />
          {(write.error || readError)?.status === 409 && (
            <button
              disabled={write.busy || checking || !!pending}
              onClick={readLatest}
            >
              读取最新版本
            </button>
          )}
        </>
      )}
      {server && (
        <section className="warning" aria-label="版本冲突比较">
          <h3>版本冲突比较</h3>
          <p>
            服务器版本 {server.version}；我的版本 {saved.version}
            。本地输入保留。
          </p>
          <p>
            服务器：
            {(() => {
              const s = server.stages.find((s: any) => s.id === stageId);
              return s
                ? `${s.groupSize}人 × ${s.groupCount}组，每组晋级${s.qualifyCount}人`
                : "阶段已不存在";
            })()}
          </p>
          <p>
            我的输入：{draft.groupSize}人 × {draft.groupCount}组，每组晋级
            {draft.qualifyCount}人
          </p>
          <details>
            <summary>比较高级参数</summary>
            <dl className="parameter-compare">
              {(() => {
                const remote = Object.fromEntries(
                    parameterComparison(
                      server.stages.find((s: any) => s.id === stageId)
                        ?.parameters,
                    ),
                  ),
                  local = Object.fromEntries(
                    parameterComparison(draft.parameters),
                  );
                return [
                  ...new Set([...Object.keys(remote), ...Object.keys(local)]),
                ].map((label) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      服务器：{remote[label] ?? "未设置"} / 我的输入：
                      {local[label] ?? "未设置"}
                    </dd>
                  </div>
                ));
              })()}
            </dl>
          </details>
          <div className="actions">
            <button
              disabled={write.busy || checking || !!pending}
              onClick={() => recover(true)}
            >
              保留我的输入，采用最新版本
            </button>
            <button
              disabled={write.busy || checking || !!pending}
              onClick={() => recover(false)}
            >
              使用服务器参数
            </button>
          </div>
        </section>
      )}
      <div hidden={tab !== "stages"}>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={disabled}>
            <legend>{stageId ? "编辑阶段" : "添加阶段"}</legend>
            <Field label="阶段名称">
              <input
                required
                readOnly={!!stageId}
                value={draft.name}
                onChange={(e) =>
                  edit({ ...draft, name: e.target.value }, false)
                }
              />
            </Field>
            <Field label="赛制">
              <select
                value={draft.ruleVersion}
                onChange={(e) =>
                  edit(
                    fromDefinition(
                      definitions.find(
                        (d) => d.ruleVersion === e.target.value,
                      )!,
                      draft.name,
                    ),
                  )
                }
              >
                {definitions.map((d) => (
                  <option key={d.ruleVersion} value={d.ruleVersion}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="每组人数">
                <select
                  value={draft.groupSize}
                  onChange={(e) =>
                    edit({ ...draft, groupSize: Number(e.target.value) })
                  }
                >
                  {!sizes(draft, budget).includes(draft.groupSize) && (
                    <option disabled value={draft.groupSize}>
                      {draft.groupSize}（需调整）
                    </option>
                  )}
                  {sizes(draft, budget).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="小组数量">
                <select
                  value={draft.groupCount}
                  onChange={(e) =>
                    edit({ ...draft, groupCount: Number(e.target.value) })
                  }
                >
                  {!counts(draft, budget).includes(draft.groupCount) && (
                    <option disabled value={draft.groupCount}>
                      {draft.groupCount}（需调整）
                    </option>
                  )}
                  {counts(draft, budget).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="每组晋级人数">
                <select
                  value={draft.qualifyCount}
                  onChange={(e) =>
                    edit({ ...draft, qualifyCount: Number(e.target.value) })
                  }
                >
                  {!qualifiers(draft).includes(draft.qualifyCount) && (
                    <option disabled value={draft.qualifyCount}>
                      {draft.qualifyCount}（需调整）
                    </option>
                  )}
                  {qualifiers(draft).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="parameter-summary">
              {Number.isSafeInteger(inputs)
                ? `总输入 ${inputs * draft.groupCount} 人 · 总晋级 ${draft.qualifyCount * draft.groupCount} 人`
                : "人数待调整"}
            </p>
            {adjustment && <p>{adjustment}</p>}
            <Field label="默认BO">
              <select
                value={draft.parameters.defaultBO}
                onChange={(e) =>
                  edit(
                    {
                      ...draft,
                      parameters: {
                        ...draft.parameters,
                        defaultBO: Number(e.target.value),
                      },
                    },
                    false,
                  )
                }
              >
                {definition.parameterSchema.properties.defaultBO.enum.map(
                  (n: number) => (
                    <option key={n} value={n}>
                      BO{n}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <AdvancedParameters
              definition={definition}
              draft={draft}
              onChange={(parameters) =>
                edit(
                  { ...draft, parameters },
                  parameters.lowerEntryMode !==
                    draft.parameters.lowerEntryMode ||
                    parameters.bracketMode !== draft.parameters.bracketMode,
                )
              }
            />
            {!valid && (
              <p role="alert">
                {advancedValid
                  ? "当前人数或晋级组合不合法，请选择允许的值。"
                  : "高级参数不完整或不合法，请检查积分、轮数和赛制选项。"}
              </p>
            )}
            <button
              className="primary"
              disabled={disabled || !valid || (!dirty && !!stageId)}
              type="submit"
            >
              {checking ? "检查修改…" : stageId ? "保存阶段" : "创建阶段"}
            </button>
          </fieldset>
        </form>
      </div>
      {structureDirty && (
        <div className="actions">
          <p>结构有未保存修改，保存后可继续编辑参数。</p>
          <button disabled={write.busy} onClick={saveStructure}>
            保存结构草稿
          </button>
        </div>
      )}
      {tab === "graph" && (
        <GraphEditor
          payload={{
            ...structureDraft,
            id: saved.id,
            tournamentId: saved.tournamentId,
            version: saved.version,
          }}
          disabled={write.busy || checking || saved.state !== "draft" || dirty}
          onChange={(next) => editStructure(structurePayload(next))}
          url={url}
          onLayoutDirty={setLayoutDirty}
        />
      )}
      {tab === "pools" && (
        <PoolForms
          payload={structureDraft}
          disabled={write.busy || checking || saved.state !== "draft" || dirty}
          onChange={editStructure}
        />
      )}
      {tab === "routes" && (
        <RouteForms
          payload={structureDraft}
          disabled={write.busy || checking || saved.state !== "draft" || dirty}
          onChange={editStructure}
        />
      )}
      {tab === "validation" && (
        <section>
          <h3>结构校验</h3>
          <div className="actions">
            <button
              disabled={write.busy || checking || dirty || structureDirty}
              onClick={validateSaved}
            >
              校验已保存版本
            </button>
            {saved.state === "draft" && (
              <button
                disabled={write.busy || checking}
                onClick={() => setFreezeOpen(true)}
              >
                冻结结构…
              </button>
            )}
          </div>
          {report && <Report report={report} onLocate={locate} />}{" "}
          {saved.snapshot && <p>结构已冻结，赛事尚未启动。</p>}
        </section>
      )}
      {tab === "preview" && (
        <p>新版来源预演随路由任务接入；参数和布局草稿保留。</p>
      )}
      <dialog
        ref={freezeDialog}
        aria-label="确认冻结结构"
        onCancel={() => setFreezeOpen(false)}
      >
        <h2>确认冻结结构</h2>
        <p>
          结构冻结后不可编辑或解冻；冻结不会启动比赛。服务端重新核验保存后的版本。
        </p>
        <div className="actions">
          <button
            disabled={write.busy || checking}
            autoFocus
            onClick={() => setFreezeOpen(false)}
          >
            取消
          </button>
          {dirty || structureDirty || layoutDirty ? (
            <>
              <button
                className="primary"
                disabled={write.busy || checking}
                onClick={saveAndFreeze}
              >
                保存并冻结
              </button>
              <button
                disabled={write.busy || checking}
                onClick={discardAndFreeze}
              >
                舍弃并冻结已保存版本
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={write.busy || checking}
              onClick={freezeSaved}
            >
              确认冻结
            </button>
          )}
        </div>
      </dialog>
      <p>
        {definition.runtimeReady
          ? "此规则可在审批并锁定名单后运行；冻结不会启动比赛。"
          : "可保存参数、核验并冻结完整比赛计划；此规则的实际运行仍在接入。"}
      </p>
      <dialog ref={dialog} aria-label="确认阶段修改" onCancel={cancelImpact}>
        <h2>确认阶段修改</h2>
        {pending && (
          <>
            <p>
              移除小组：
              {pending.report.removedGroupIds.map(groupName).join("、") || "无"}
            </p>
            <p>
              移除晋级连线：{pending.report.affectedRouteIds.join("、") || "无"}
            </p>
            <p>
              需重新分配的报名：{pending.report.affectedRegistrationIds.length}{" "}
              条；历史比赛：{pending.report.affectedMatchIds.length} 场。
            </p>
            {pending.report.blockers?.length > 0 && (
              <p role="alert">名单或比赛已锁定，不能修改。</p>
            )}
            <div className="actions">
              <button autoFocus onClick={cancelImpact}>
                取消
              </button>
              <button
                className="primary"
                disabled={write.busy || pending.report.blockers?.length > 0}
                onClick={confirmImpact}
              >
                确认并保存
              </button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
