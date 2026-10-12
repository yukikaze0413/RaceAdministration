import { requestKey } from "../../shared/api";
import { Field, Empty } from "../../shared/ui";
export type Structure = any;
export const formats = [
  "single-elimination",
  "double-elimination",
  "round-robin",
  "double-round-robin",
  "fixed-swiss",
  "major-like",
];
export const formatNames = [
  "单败淘汰",
  "双败淘汰",
  "单循环",
  "双循环",
  "固定轮瑞士",
  "Major 风格",
];
const sortFields = [
  "sourcePriority",
  "sourceRank",
  "initialSeed",
  "poolSeed",
  "wins",
  "losses",
  "points",
];
const sortNames = [
  "来源优先级",
  "来源名次",
  "初始种子",
  "池种子",
  "胜场",
  "负场",
  "积分",
];
export function references(payload: Structure) {
  return [
    ...payload.stages.flatMap((s: any, i: number) => [
      {
        key: s.id,
        label: `阶段 ${s.order ?? i + 1} · ${s.id.slice(0, 8)}`,
        ref: { stageId: s.id },
      },
      ...s.groups.map((g: any, j: number) => ({
        key: g.id,
        label: `阶段 ${s.order ?? i + 1} / 小组 ${j + 1} · ${g.id.slice(0, 8)}`,
        ref: { stageId: s.id, groupId: g.id },
      })),
    ]),
    ...payload.pools.map((p: any, i: number) => ({
      key: p.id,
      label: `池 ${i + 1} · ${p.id.slice(0, 8)}`,
      ref: { poolId: p.id },
    })),
  ];
}
function refKey(ref: any) {
  return ref?.poolId ?? ref?.groupId ?? ref?.stageId ?? "";
}
function NumberField({
  label,
  value,
  onChange,
  path,
  min = 1,
}: {
  label: string;
  value: any;
  onChange: (v: number | null) => void;
  path: string;
  min?: number;
}) {
  return (
    <Field label={label}>
      <input
        data-path={path}
        type="number"
        step="1"
        min={min}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </Field>
  );
}
export function SortForm({
  value = [],
  onChange,
  payload,
  path,
}: {
  value?: any[];
  onChange: (v: any[]) => void;
  payload: Structure;
  path: string;
}) {
  const refs = references(payload);
  const change = (index: number, key: string, val: any) =>
    onChange(value.map((s, i) => (i === index ? { ...s, [key]: val } : s)));
  const move = (i: number, step: number) => {
    const next = [...value];
    [next[i], next[i + step]] = [next[i + step], next[i]];
    onChange(next);
  };
  return (
    <section className="sort">
      <h4>有序排序规则</h4>
      {value.map((s, i) => (
        <div className="sort-row" key={i}>
          <Field label={`排序字段 ${i + 1}`}>
            <select
              data-path={path + "/" + i + "/field"}
              value={s.field}
              onChange={(e) =>
                onChange(
                  value.map((x, j) =>
                    j === i
                      ? {
                          field: e.target.value,
                          direction: x.direction,
                          ...(e.target.value === "sourcePriority"
                            ? { sources: [] }
                            : {}),
                        }
                      : x,
                  ),
                )
              }
            >
              {sortFields.map((f, j) => (
                <option key={f} value={f}>
                  {sortNames[j]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`方向 ${i + 1}`}>
            <select
              value={s.direction}
              onChange={(e) => change(i, "direction", e.target.value)}
            >
              <option value="asc">升序</option>
              <option value="desc">降序</option>
            </select>
          </Field>
          <div className="actions">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              上移排序
            </button>
            <button
              type="button"
              disabled={i === value.length - 1}
              onClick={() => move(i, 1)}
            >
              下移排序
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              移除排序
            </button>
          </div>
          {s.field === "sourcePriority" && (
            <div className="source-priority">
              <p>完整来源优先级：按从先到后逐项选择，ID 不自动猜测。</p>
              {(s.sources ?? []).map((id: string, j: number) => (
                <div key={j} className="actions">
                  <Field label={`优先来源 ${j + 1}`}>
                    <select
                      value={id}
                      onChange={(e) =>
                        change(
                          i,
                          "sources",
                          s.sources.map((x: string, k: number) =>
                            k === j ? e.target.value : x,
                          ),
                        )
                      }
                    >
                      <option value="">请选择来源</option>
                      {refs.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    type="button"
                    onClick={() =>
                      change(
                        i,
                        "sources",
                        s.sources.filter((_: string, k: number) => k !== j),
                      )
                    }
                  >
                    移除来源
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => change(i, "sources", [...(s.sources ?? []), ""])}
              >
                添加优先来源
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([...value, { field: "initialSeed", direction: "asc" }])
        }
      >
        添加排序规则
      </button>
    </section>
  );
}
export function StageForms({
  payload,
  onChange,
  disabled,
}: {
  payload: Structure;
  onChange: (v: Structure) => void;
  disabled: boolean;
}) {
  const edit = (i: number, key: string, val: any) =>
    onChange({
      ...payload,
      stages: payload.stages.map((s: any, j: number) =>
        j === i ? { ...s, [key]: val } : s,
      ),
    });
  return (
    <fieldset disabled={disabled}>
      <legend>阶段与小组</legend>
      <p>
        六类赛制标签保存结构意图；单败和单循环可绑定真实运行，其余赛制尚未实现。空字段可作为未完整草稿保存。
      </p>
      {!payload.stages.length && <Empty>尚未添加阶段。</Empty>}
      {payload.stages.map((s: any, i: number) => (
        <article className="panel" key={s.id} id={"object-" + s.id}>
          <h3>
            阶段 {s.order ?? i + 1} · {s.id.slice(0, 8)}
          </h3>
          <div className="form-grid">
            <NumberField
              label="阶段顺序"
              value={s.order}
              path={"/stages/" + i + "/order"}
              onChange={(v) => edit(i, "order", v)}
            />
            <NumberField
              label="阶段容量"
              value={s.capacity}
              path={"/stages/" + i + "/capacity"}
              onChange={(v) => edit(i, "capacity", v)}
            />
            <Field label="赛制意图">
              <select
                data-path={"/stages/" + i + "/formatIntent"}
                value={s.formatIntent ?? ""}
                onChange={(e) =>
                  edit(i, "formatIntent", e.target.value || null)
                }
              >
                <option value="">待定</option>
                {formats.map((f, j) => (
                  <option key={f} value={f}>
                    {formatNames[j]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <h4>小组</h4>
          {s.groups.map((g: any, j: number) => (
            <div className="group" key={g.id} id={"object-" + g.id}>
              <span>
                小组 {j + 1} · {g.id.slice(0, 8)}
              </span>
              <NumberField
                label={`小组 ${j + 1} 容量`}
                value={g.capacity}
                path={"/stages/" + i + "/groups/" + j + "/capacity"}
                onChange={(v) =>
                  edit(
                    i,
                    "groups",
                    s.groups.map((x: any, k: number) =>
                      k === j ? { ...x, capacity: v } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  edit(
                    i,
                    "groups",
                    s.groups.filter((_: any, k: number) => k !== j),
                  )
                }
              >
                删除小组
              </button>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                edit(i, "groups", [
                  ...s.groups,
                  { id: requestKey(), stageId: s.id, capacity: null },
                ])
              }
            >
              添加小组
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...payload,
                  stages: payload.stages.filter((_: any, j: number) => j !== i),
                })
              }
            >
              删除阶段
            </button>
          </div>
          <p className="muted">
            引用对象删除后需手动修改关联路由；服务器不会自动级联删除。
          </p>
        </article>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...payload,
            stages: [
              ...payload.stages,
              {
                id: requestKey(),
                order: payload.stages.length + 1,
                capacity: null,
                formatIntent: null,
                groups: [],
              },
            ],
          })
        }
      >
        添加阶段
      </button>
    </fieldset>
  );
}
export function PoolForms({
  payload,
  onChange,
  disabled,
}: {
  payload: Structure;
  onChange: (v: Structure) => void;
  disabled: boolean;
}) {
  const edit = (i: number, key: string, val: any) =>
    onChange({
      ...payload,
      pools: payload.pools.map((s: any, j: number) =>
        j === i ? { ...s, [key]: val } : s,
      ),
    });
  return (
    <fieldset disabled={disabled}>
      <legend>选手池</legend>
      <p>池是跨来源汇合及重排容器，独立于比赛阶段和小组。</p>
      {payload.pools.map((p: any, i: number) => (
        <article className="panel" key={p.id} id={"object-" + p.id}>
          <h3>
            池 {i + 1} · {p.id.slice(0, 8)}
          </h3>
          <NumberField
            label="池容量"
            value={p.capacity}
            path={"/pools/" + i + "/capacity"}
            onChange={(v) => edit(i, "capacity", v)}
          />
          <SortForm
            value={p.sort ?? []}
            payload={payload}
            path={"/pools/" + i + "/sort"}
            onChange={(v) => edit(i, "sort", v)}
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                ...payload,
                pools: payload.pools.filter((_: any, j: number) => j !== i),
              })
            }
          >
            删除池
          </button>
        </article>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...payload,
            pools: [
              ...payload.pools,
              { id: requestKey(), capacity: null, sort: [] },
            ],
          })
        }
      >
        添加池
      </button>
    </fieldset>
  );
}
export function RouteForms({
  payload,
  onChange,
  disabled,
}: {
  payload: Structure;
  onChange: (v: Structure) => void;
  disabled: boolean;
}) {
  const refs = references(payload);
  const versionTwo = payload.structureVersion === "structure-v2";
  const edit = (i: number, key: string, val: any) =>
    onChange({
      ...payload,
      routes: payload.routes.map((s: any, j: number) =>
        j === i ? { ...s, [key]: val } : s,
      ),
    });
  return (
    <fieldset disabled={disabled}>
      <legend>晋级路由</legend>
      {payload.routes.map((r: any, i: number) => (
        <article className="panel" key={r.id} id={"object-" + r.id}>
          <h3>
            路由 {i + 1} · {r.id.slice(0, 8)}
          </h3>
          <div className="form-grid">
            {[
              ["source", "来源"],
              ["target", "目标"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <select
                  data-path={"/routes/" + i + "/" + key}
                  value={refKey(r[key])}
                  onChange={(e) =>
                    edit(
                      i,
                      key,
                      (() => {
                        const ref =
                          refs.find((x) => x.key === e.target.value)?.ref ?? {};
                        return versionTwo && !("poolId" in ref) && r[key]?.port
                          ? { ...ref, port: r[key].port }
                          : ref;
                      })(),
                    )
                  }
                >
                  <option value="">请选择{label}</option>
                  {!refs.some((x) => x.key === refKey(r[key])) &&
                    refKey(r[key]) && (
                      <option value={refKey(r[key])}>
                        已删除引用 {refKey(r[key])}
                      </option>
                    )}
                  {refs.map((x) => (
                    <option value={x.key} key={x.key}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            {versionTwo &&
              (["source", "target"] as const).map((side) => {
                const ref = r[side],
                  stage = payload.stages.find((s: any) => s.id === ref.stageId),
                  de = stage?.format === "double-elimination",
                  truncated =
                    ["single-elimination", "double-elimination"].includes(
                      stage?.format,
                    ) && stage?.qualifyCount > 1;
                const ports = ref.poolId
                  ? side === "source"
                    ? ["seed"]
                    : []
                  : side === "source"
                    ? [
                        "qualification",
                        ...(!truncated ? ["rank"] : []),
                        ...(de && stage?.qualifyCount > 1
                          ? ["upper", "lower"]
                          : []),
                      ]
                    : de
                      ? [
                          "upper",
                          ...(stage.capacity / stage.groupCount >
                          stage.groupSize
                            ? ["lower"]
                            : []),
                        ]
                      : ["seed", "slot"];
                return (
                  <Field
                    key={side}
                    label={side === "source" ? "来源具名端口" : "目标具名端口"}
                  >
                    <select
                      disabled={!!ref.poolId && side === "target"}
                      value={ref.port ?? ""}
                      onChange={(e) => {
                        const { port, ...rest } = ref;
                        edit(i, side, {
                          ...rest,
                          ...(e.target.value ? { port: e.target.value } : {}),
                        });
                      }}
                    >
                      <option value="">
                        {ref.poolId && side === "target"
                          ? "池汇合入口"
                          : "默认通道"}
                      </option>
                      {ref.port && !ports.includes(ref.port) && (
                        <option value={ref.port}>不适用：{ref.port}</option>
                      )}
                      {ports.map((port) => (
                        <option key={port} value={port}>
                          {
                            (
                              {
                                rank: "竞技名次",
                                qualification: "晋级名额",
                                upper: "胜者通道",
                                lower: "败者通道",
                                seed: "种子",
                                slot: "绝对席位",
                              } as Record<string, string>
                            )[port]
                          }
                        </option>
                      ))}
                    </select>
                  </Field>
                );
              })}
            <NumberField
              label="晋级名额"
              path={"/routes/" + i + "/quota"}
              value={r.quota}
              onChange={(v) => edit(i, "quota", v)}
            />
            <Field label="筛选方式">
              <select
                value={r.selector?.kind ?? ""}
                data-path={"/routes/" + i + "/selector"}
                onChange={(e) =>
                  edit(
                    i,
                    "selector",
                    e.target.value === "rankRange"
                      ? { kind: "rankRange", from: null, to: null }
                      : e.target.value === "recordEquals"
                        ? {
                            kind: "recordEquals",
                            wins: null,
                            losses: null,
                            draws: null,
                          }
                        : e.target.value === "all"
                          ? { kind: "all" }
                          : null,
                  )
                }
              >
                <option value="">待定</option>
                <option value="rankRange">名次范围</option>
                <option value="recordEquals">战绩相等</option>
                <option value="all">全部</option>
              </select>
            </Field>
          </div>
          {r.selector?.kind === "rankRange" && (
            <div className="form-grid">
              {[
                ["from", "起始名次"],
                ["to", "结束名次"],
              ].map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  value={r.selector[key]}
                  path={"/routes/" + i + "/selector/" + key}
                  onChange={(v) =>
                    edit(i, "selector", { ...r.selector, [key]: v })
                  }
                />
              ))}
            </div>
          )}
          {r.selector?.kind === "recordEquals" && (
            <div className="form-grid">
              {[
                ["wins", "胜"],
                ["losses", "负"],
                ["draws", "平"],
              ].map(([key, label]) => (
                <NumberField
                  min={0}
                  key={key}
                  label={label}
                  value={r.selector[key]}
                  path={"/routes/" + i + "/selector/" + key}
                  onChange={(v) =>
                    edit(i, "selector", { ...r.selector, [key]: v })
                  }
                />
              ))}
            </div>
          )}
          <SortForm
            value={r.sort ?? []}
            payload={payload}
            path={"/routes/" + i + "/sort"}
            onChange={(v) => edit(i, "sort", v)}
          />
          <div className="form-grid">
            <Field label="位置类型">
              <select
                value={r.placement?.kind ?? ""}
                onChange={(e) =>
                  edit(
                    i,
                    "placement",
                    e.target.value
                      ? {
                          kind: e.target.value,
                          positions: r.placement?.positions ?? [],
                        }
                      : null,
                  )
                }
              >
                <option value="">待定</option>
                <option value="seed">seed 种子</option>
                <option value="slot">slot 槽位</option>
              </select>
            </Field>
            <Field label="位置序列（逗号分隔正整数）">
              <input
                data-path={"/routes/" + i + "/placement/positions"}
                value={(r.placement?.positions ?? []).join(",")}
                disabled={!r.placement}
                onChange={(e) =>
                  edit(i, "placement", {
                    ...r.placement,
                    positions:
                      e.target.value === ""
                        ? []
                        : e.target.value
                            .split(",")
                            .map((x) => Number(x.trim())),
                  })
                }
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...payload,
                routes: payload.routes.filter((_: any, j: number) => j !== i),
              })
            }
          >
            删除路由
          </button>
        </article>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...payload,
            routes: [
              ...payload.routes,
              {
                id: requestKey(),
                source: refs[0]?.ref ?? {},
                target: refs[1]?.ref ?? refs[0]?.ref ?? {},
                selector: null,
                quota: null,
                sort: [],
                placement: null,
              },
            ],
          })
        }
      >
        添加路由
      </button>
    </fieldset>
  );
}
