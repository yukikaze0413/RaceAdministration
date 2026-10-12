import { Resource, useResource } from "./resource";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../../app/session";
import { requestKey } from "../../shared/api";
import { Field, ErrorNotice } from "../../shared/ui";
import { useWrite } from "./write";
export function AnswerFields({
  fields,
  answers,
  onChange,
  disabled = false,
}: {
  fields: any[];
  answers: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {fields
        .filter((f) => !f.disabled)
        .map((f) => (
          <Field key={f.id} label={f.label + (f.required ? " *" : "")}>
            <small>{f.help}</small>
            {f.type === "textarea" ? (
              <textarea
                value={answers[f.id] ?? ""}
                required={f.required}
                maxLength={f.max ?? 2000}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...answers, [f.id]: e.target.value })
                }
              />
            ) : f.type === "select" ? (
              <select
                required={f.required}
                value={answers[f.id] ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...answers, [f.id]: e.target.value })
                }
              >
                <option value="">请选择</option>
                {f.options.map((o: string) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : f.type === "multiselect" ? (
              <select
                multiple
                value={answers[f.id] ?? []}
                required={f.required}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    [f.id]: [...e.target.selectedOptions].map((o) => o.value),
                  })
                }
              >
                {f.options.map((o: string) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={!!answers[f.id]}
                required={f.required}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...answers, [f.id]: e.target.checked })
                }
              />
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                value={answers[f.id] ?? ""}
                required={f.required}
                min={f.type === "number" ? f.min : undefined}
                max={f.type === "number" ? f.max : undefined}
                minLength={f.type !== "number" ? f.min : undefined}
                maxLength={f.type !== "number" ? (f.max ?? 2000) : undefined}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...answers,
                    [f.id]:
                      f.type === "number" && e.target.value !== ""
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            )}
          </Field>
        ))}
    </>
  );
}
function FormEditor({
  initial,
  url,
  onSaved,
}: {
  initial: any;
  url: string;
  onSaved: (message?: string) => void;
}) {
  const [fields, setFields] = useState<any[]>(initial.form?.fields ?? []),
    [version, setVersion] = useState(initial.version),
    [notice, setNotice] = useState(""),
    write = useWrite();
  useEffect(() => {
    setVersion(initial.version);
  }, [initial.version]);
  const change = (i: number, key: string, value: any) =>
    setFields(fields.map((f, j) => (i === j ? { ...f, [key]: value } : f)));
  async function save() {
    if (
      write.error?.status === 409 &&
      !window.confirm("确认用保留的本地字段保存到当前服务器版本？")
    )
      return;
    const r = await write.run(url, "PUT", { expectedVersion: version, fields });
    if (r) {
      setVersion(r.version);
      setNotice("");
      onSaved("字段已保存");
    }
  }
  async function publish() {
    const r = await write.run(url + "/publish", "POST", {
      expectedVersion: version,
    });
    if (r) {
      setVersion(r.version);
      setNotice("");
      onSaved("报名表已发布");
    }
  }
  const dirty =
    JSON.stringify(fields) !== JSON.stringify(initial.form?.fields ?? []);
  return (
    <section className="panel">
      <h2>报名收集表</h2>
      <p>
        发布后参赛者填写。字段使用稳定标识，旧答案保留提交时版本；改变字段类型请停用旧字段并新建。
      </p>
      <p>
        已发布版本 {initial.publishedVersion} ·{" "}
        {initial.open ? "报名开放" : "报名未开放"}
        {initial.locked ? " · 名单已锁定" : ""}
      </p>
      <fieldset disabled={write.busy || initial.locked}>
        {fields.map((f, i) => (
          <article className="field-editor" key={f.id}>
            <div className="form-grid">
              <Field label="字段名称">
                <input
                  value={f.label}
                  maxLength={100}
                  onChange={(e) => change(i, "label", e.target.value)}
                />
              </Field>
              <Field label="字段类型">
                <select
                  value={f.type}
                  onChange={(e) => change(i, "type", e.target.value)}
                >
                  {[
                    ["text", "短文本"],
                    ["textarea", "长文本"],
                    ["number", "数字"],
                    ["select", "单选"],
                    ["multiselect", "多选"],
                    ["checkbox", "勾选"],
                  ].map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="帮助文字">
                <input
                  value={f.help ?? ""}
                  maxLength={500}
                  onChange={(e) => change(i, "help", e.target.value)}
                />
              </Field>
              <Field label="必填">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => change(i, "required", e.target.checked)}
                />
              </Field>
              {["select", "multiselect"].includes(f.type) ? (
                <Field label="选项（每行一个）">
                  <textarea
                    value={(f.options ?? []).join("\n")}
                    onChange={(e) =>
                      change(i, "options", e.target.value.split("\n"))
                    }
                  />
                </Field>
              ) : ["text", "textarea", "number"].includes(f.type) ? (
                <>
                  <Field label={f.type === "number" ? "最小值" : "最短字符数"}>
                    <input
                      type="number"
                      value={f.min ?? ""}
                      onChange={(e) =>
                        change(
                          i,
                          "min",
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field label={f.type === "number" ? "最大值" : "最长字符数"}>
                    <input
                      type="number"
                      value={f.max ?? ""}
                      onChange={(e) =>
                        change(
                          i,
                          "max",
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                </>
              ) : null}
              <Field label="停用字段">
                <input
                  type="checkbox"
                  checked={!!f.disabled}
                  onChange={(e) => change(i, "disabled", e.target.checked)}
                />
              </Field>
            </div>
            <div className="actions">
              <button
                onClick={() => {
                  const n = [...fields];
                  if (i > 0) {
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    setFields(n);
                  }
                }}
                disabled={i === 0}
              >
                上移字段
              </button>
              <button
                onClick={() => {
                  const n = [...fields];
                  if (i < n.length - 1) {
                    [n[i], n[i + 1]] = [n[i + 1], n[i]];
                    setFields(n);
                  }
                }}
                disabled={i === fields.length - 1}
              >
                下移字段
              </button>
            </div>
          </article>
        ))}
        <div className="actions">
          <button
            onClick={() =>
              setFields([
                ...fields,
                {
                  id: "f" + requestKey().replaceAll("-", ""),
                  label: "新字段",
                  type: "text",
                  help: "",
                  required: false,
                },
              ])
            }
            disabled={fields.length >= 32}
          >
            添加字段
          </button>
          <button onClick={save}>保存字段</button>
          <button className="primary" disabled={dirty} onClick={publish}>
            发布并开放报名
          </button>
        </div>
      </fieldset>
      {dirty && <p>有未保存字段，先保存再发布。</p>}
      {write.error?.status === 409 && (
        <details>
          <summary>比较服务器与本地字段</summary>
          <pre>
            {JSON.stringify(
              { server: initial.form?.fields, local: fields },
              null,
              2,
            )}
          </pre>
          <button
            onClick={() => {
              if (window.confirm("确认用服务器字段替换本地未保存编辑？")) {
                setFields(initial.form?.fields ?? []);
                write.clearError();
              }
            }}
          >
            使用服务器报名字段
          </button>
        </details>
      )}
      {notice && <p role="status">{notice}</p>}
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={write.error.status === 409 ? () => onSaved() : save}
        />
      )}
    </section>
  );
}
function RegistrationRow({
  r,
  index,
  groups,
  schema,
  version,
  url,
  onSaved,
  entryReady,
}: {
  r: any;
  index: number;
  groups: any[];
  schema: any;
  version: number;
  url: string;
  onSaved: () => void;
  entryReady: boolean;
}) {
  const [seed, setSeed] = useState(r.seed ?? index + 1),
    [source, setSource] = useState(
      r.entryRef
        ? JSON.stringify([
            r.entryRef.configurationId,
            r.entryRef.groupId,
            r.entryRef.port,
          ])
        : (r.sourceId ?? ""),
    ),
    [position, setPosition] = useState(r.entryRef?.position ?? index + 1),
    [positionKind, setPositionKind] = useState(r.entryRef?.positionKind ?? ""),
    write = useWrite();
  const rootDefaults = groups.filter((g) => g.ref && g.isRoot && g.default);
  const selected =
    groups.find((g) => (g.key ?? g.id) === source) ??
    groups.find((g) => g.id === source && g.default) ??
    (source === "" && rootDefaults.length === 1 ? rootDefaults[0] : undefined);
  const named = groups.some((g) => g.ref);
  async function decide(approved: boolean) {
    if (approved && !entryReady) return;
    const out = await write.run(url + "/" + r.id + "/approve", "POST", {
      expectedVersion: version,
      approved,
      ...(approved
        ? {
            seed,
            ...(selected?.ref
              ? {
                  entryRef: {
                    ...selected.ref,
                    position,
                    positionKind: selected.de
                      ? positionKind || selected.ref.positionKind
                      : selected.ref.port,
                  },
                }
              : { sourceId: source || null }),
          }
        : {}),
    });
    if (out) onSaved();
  }
  return (
    <article className="panel">
      <h3>{r.name}</h3>
      <p>
        {r.status === "approved"
          ? "已审批"
          : r.status === "rejected"
            ? "已拒绝"
            : "待审批"}{" "}
        · 报名表版本 {r.schemaVersion}
      </p>
      <details>
        <summary>报名答案</summary>
        <dl>
          {Object.entries(r.answers).map(([k, v]) => (
            <div key={k}>
              <dt>{schema?.fields.find((f: any) => f.id === k)?.label ?? k}</dt>
              <dd>{Array.isArray(v) ? v.join("、") : String(v)}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="form-grid">
        <Field label="初始种子">
          <input
            type="number"
            min={1}
            max={64}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </Field>
        <Field label="初始阶段或小组">
          <select
            value={selected?.key ?? source}
            onChange={(e) => {
              setSource(e.target.value);
              setPosition(1);
              setPositionKind(
                groups.find((g) => g.key === e.target.value)?.ref
                  ?.positionKind ?? "seed",
              );
            }}
          >
            <option value="">
              {named ? "选择阶段与入口" : "唯一初始单位自动分配"}
            </option>
            {source && !selected && (
              <option value={source}>已保存的另一配置入口（待重新分配）</option>
            )}
            {groups.map((g) => (
              <option key={g.key ?? g.id} value={g.key ?? g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        {selected?.ref && (
          <>
            <Field label="入口位置">
              <input
                type="number"
                min={1}
                max={selected.capacity}
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
              />
            </Field>
            {selected.de && (
              <Field label="入口位置类型">
                <select
                  value={positionKind || selected.ref.positionKind}
                  onChange={(e) => setPositionKind(e.target.value)}
                >
                  <option value="seed">种子顺序</option>
                  <option value="slot">绝对席位</option>
                </select>
              </Field>
            )}
            <p>
              此入口共 {selected.capacity} 个位置；
              {selected.isRoot
                ? "初始参赛入口"
                : "后阶段直邀入口，上游晋级席位不可占用"}
              。
            </p>
          </>
        )}
      </div>
      {source && !selected && groups.length > 0 && (
        <p role="alert">已保存的入口不属于当前审批配置，请重新选择。</p>
      )}
      <div className="actions">
        <button
          disabled={
            !entryReady ||
            write.busy ||
            (!!source && !selected && groups.length > 0) ||
            (named &&
              (!selected ||
                !Number.isInteger(position) ||
                position < 1 ||
                position > selected.capacity))
          }
          onClick={() => decide(true)}
        >
          审批并分配
        </button>
        <button disabled={write.busy} onClick={() => decide(false)}>
          拒绝报名
        </button>
      </div>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? onSaved
              : async () => {
                  const r = await write.retry();
                  if (r) onSaved();
                }
          }
        />
      )}
    </article>
  );
}
export function RegistrationPage({ manage = false }: { manage?: boolean }) {
  const [configurationId, setConfigurationId] = useState("");
  const { tid } = useParams(),
    base = "/tournaments/" + tid,
    session = useSession(),
    form = useResource(base + "/registration-form"),
    runtime = useResource(base + "/runtime");
  const permissions = runtime.data?.permissions ?? {},
    regs = useResource(
      manage && permissions["registration.review"]
        ? base + "/registrations"
        : null,
    ),
    entryConfigurations = useResource(
      manage && permissions["registration.review"]
        ? base + "/entry-configurations"
        : null,
    ),
    stages = useResource(
      manage
        ? base +
            "/stages" +
            (configurationId
              ? "?configurationId=" + encodeURIComponent(configurationId)
              : "")
        : null,
    ),
    mine = useResource(
      !manage && session.user ? base + "/my-registration" : null,
    );
  const [answers, setAnswers] = useState<any>({}),
    [notice, setNotice] = useState(""),
    write = useWrite();
  const reload = () => {
    form.reload();
    regs.reload();
    runtime.reload();
  };
  async function submit() {
    const out = await write.run(base + "/registrations", "POST", {
      schemaVersion: form.data.form.version,
      answers,
    });
    if (out) mine.reload();
  }
  const groups = (stages.data?.items ?? []).flatMap((s: any) =>
    stages.data?.structureVersion === "structure-v2"
      ? s.groups.flatMap((g: any, i: number) =>
          (s.inputs.find((u: any) => u.groupId === g.id)?.ports ?? []).flatMap(
            (input: any) =>
              (s.format === "double-elimination"
                ? [input.channel]
                : ["seed", "slot"]
              ).map((port: string) => ({
                id: g.id,
                key: JSON.stringify([stages.data.configurationId, g.id, port]),
                capacity: input.capacity,
                isRoot: s.isRoot,
                de: s.format === "double-elimination",
                default: port === input.channel,
                label:
                  (s.name ?? "阶段" + s.order) +
                  " · 小组" +
                  (i + 1) +
                  " · " +
                  (
                    {
                      upper: "胜者入口",
                      lower: "败者入口",
                      seed: "种子入口",
                      slot: "绝对席位入口",
                    } as Record<string, string>
                  )[port],
                ref: {
                  configurationId: stages.data.configurationId,
                  stageId: s.id,
                  groupId: g.id,
                  port,
                  positionKind: input.positionKind,
                },
              })),
          ),
        )
      : s.groups.length
        ? s.groups.map((g: any, i: number) => ({
            id: g.id,
            label:
              "阶段" +
              s.order +
              " · 小组" +
              (i + 1) +
              " (" +
              g.id.slice(0, 6) +
              ")",
          }))
        : [{ id: s.id, label: "阶段" + s.order }],
  );
  const entryReady =
    !!stages.data &&
    (!configurationId || stages.data.configurationId === configurationId);
  return (
    <>
      {manage &&
        permissions["registration.review"] &&
        entryConfigurations.data?.items.length > 0 && (
          <Field label="审批配置">
            <select
              value={configurationId || stages.data?.configurationId || ""}
              onChange={(e) => setConfigurationId(e.target.value)}
            >
              {entryConfigurations.data.items.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {c.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </Field>
        )}
      {manage && entryConfigurations.error && (
        <ErrorNotice
          error={entryConfigurations.error}
          onRetry={entryConfigurations.reload}
        />
      )}
      {manage && stages.error && (
        <ErrorNotice error={stages.error} onRetry={stages.reload} />
      )}
      {notice && <p role="status">{notice}</p>}
      <Resource state={form}>
        {(data) =>
          manage ? (
            <>
              {permissions["registrationSchema.edit"] ? (
                <FormEditor
                  initial={data}
                  url={base + "/registration-form"}
                  onSaved={(message) => {
                    setNotice(message ?? "");
                    reload();
                  }}
                />
              ) : (
                <p>没有收集字段编辑权限。</p>
              )}
              {permissions["registration.review"] && (
                <Resource state={regs}>
                  {(list) => (
                    <section>
                      <h2>报名与名单</h2>
                      <p>
                        已审批{" "}
                        {
                          list.items.filter((r: any) => r.status === "approved")
                            .length
                        }{" "}
                        人 · {list.locked ? "名单已锁定" : "可审批名单"}
                      </p>
                      {list.locked ? (
                        <p>已锁定名单，前往整轮推进选择冻结配置并开赛。</p>
                      ) : (
                        <>
                          {list.items.length ? (
                            list.items.map((r: any, i: number) => (
                              <RegistrationRow
                                key={JSON.stringify([
                                  r.id,
                                  r.entryRef ?? r.sourceId,
                                ])}
                                r={r}
                                index={i}
                                groups={groups}
                                schema={list.schemas.find(
                                  (s: any) => s.version === r.schemaVersion,
                                )}
                                version={list.version}
                                url={base + "/registrations"}
                                onSaved={reload}
                                entryReady={entryReady}
                              />
                            ))
                          ) : (
                            <p className="empty">暂无报名，请先发布收集表。</p>
                          )}
                          <button
                            className="primary"
                            disabled={write.busy || !entryReady}
                            onClick={async () => {
                              if (
                                window.confirm(
                                  "锁定后不能再审批、修改种子或收集表。确认锁定名单？",
                                )
                              ) {
                                const r = await write.run(
                                  base + "/roster/lock",
                                  "POST",
                                  {
                                    expectedVersion: list.version,
                                    ...(stages.data?.structureVersion ===
                                    "structure-v2"
                                      ? {
                                          configurationId:
                                            stages.data.configurationId,
                                        }
                                      : {}),
                                  },
                                );
                                if (r) reload();
                              }
                            }}
                          >
                            锁定参赛名单
                          </button>
                        </>
                      )}
                    </section>
                  )}
                </Resource>
              )}
            </>
          ) : (
            <section className="panel">
              <h2>个人报名</h2>
              {!session.user ? (
                <Link
                  to={
                    "/login?returnTo=" + encodeURIComponent(location.pathname)
                  }
                >
                  登录后报名
                </Link>
              ) : !data.form ? (
                <p>报名表尚未发布。</p>
              ) : (
                <>
                  <p>
                    {data.open ? "报名开放" : "报名关闭"} · 已发布版本{" "}
                    {data.publishedVersion}
                  </p>
                  <Resource state={mine}>
                    {(m) => (
                      <>
                        {m.registration && (
                          <p role="status">
                            报名已提交 ·{" "}
                            {m.registration.status === "approved"
                              ? "已审批"
                              : m.registration.status === "rejected"
                                ? "已拒绝"
                                : "待审批"}
                          </p>
                        )}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void submit();
                          }}
                        >
                          <AnswerFields
                            fields={data.form.fields}
                            answers={answers}
                            onChange={setAnswers}
                            disabled={
                              !data.open ||
                              m.registration?.status === "approved" ||
                              write.busy
                            }
                          />
                          <button
                            className="primary"
                            disabled={
                              !data.open ||
                              m.registration?.status === "approved" ||
                              write.busy
                            }
                          >
                            提交个人报名
                          </button>
                        </form>
                        {m.registration && (
                          <details>
                            <summary>查看已提交资料</summary>
                            <AnswerFields
                              fields={m.schema.fields}
                              answers={m.registration.answers}
                              onChange={() => {}}
                              disabled
                            />
                          </details>
                        )}
                      </>
                    )}
                  </Resource>
                </>
              )}
            </section>
          )
        }
      </Resource>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? reload
              : async () => {
                  const r = await write.retry();
                  if (r) reload();
                }
          }
        />
      )}
    </>
  );
}
