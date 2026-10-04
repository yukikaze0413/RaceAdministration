import { useEffect, useState } from "react";
import { api, ApiFailure, failure, type Diagnostic } from "../../shared/api";
import { Field, ErrorNotice } from "../../shared/ui";
import { references } from "./forms";
import fourGroups from "../../../../backend/examples/tournament-configuration/four-groups.json";
import pool from "../../../../backend/examples/tournament-configuration/pool.json";
export function mapSampleSources(sample: any, mapping: Record<string, string>) {
  const ids = sample.sourceSnapshots.map((s: any) => s.sourceId),
    mapped = ids.map((id: string) => mapping[id]);
  if (mapped.some((id: string) => !id) || new Set(mapped).size !== ids.length)
    throw new ApiFailure("请完成全部样例来源的一对一映射，不能重复选择。", {
      code: "SOURCE_MAPPING_REQUIRED",
      retryable: false,
    });
  return {
    ...structuredClone(sample),
    sourceSnapshots: sample.sourceSnapshots.map((s: any) => ({
      ...structuredClone(s),
      sourceId: mapping[s.sourceId],
    })),
  };
}
export function Report({
  report,
  onLocate,
}: {
  report: any;
  onLocate: (d: Diagnostic) => void;
}) {
  return (
    <section className="report">
      <h3>计算报告</h3>
      <dl className="readiness">
        <div>
          <dt>结构有效</dt>
          <dd>{report.structureValid ? "通过" : "未通过"}</dd>
        </div>
        <div>
          <dt>预演就绪</dt>
          <dd>{report.previewReady ? "当前输入通过" : "未验证或未通过"}</dd>
        </div>
        <div>
          <dt>运行就绪</dt>
          <dd>尚未实现</dd>
        </div>
      </dl>
      <p>版本 {report.version} · 本报告不启动比赛。</p>
      <DiagnosticList
        diagnostics={report.diagnostics ?? []}
        onLocate={onLocate}
      />
      {report.allocations && (
        <>
          <h4>模拟分配（非真实晋级）</h4>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>样例身份</th>
                  <th>来源</th>
                  <th>初始种子</th>
                  <th>池种子</th>
                  <th>目标</th>
                  <th>位置</th>
                  <th>退出标记</th>
                </tr>
              </thead>
              <tbody>
                {report.allocations.map((a: any, i: number) => (
                  <tr key={i}>
                    <td>{a.entrantId}</td>
                    <td>{a.source}</td>
                    <td>{a.initialSeed}</td>
                    <td>{a.poolSeed ?? "—"}</td>
                    <td>
                      {a.target.groupId ?? a.target.stageId ?? a.target.poolId}
                    </td>
                    <td>
                      {a.positionKind} {a.value}
                    </td>
                    <td>{a.exitState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4>未入选者</h4>
          {report.excluded?.length ? (
            <ul>
              {report.excluded.map((e: any, i: number) => (
                <li key={i}>
                  {e.entrantId} · {e.reason} · 路由 {e.routeId}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {report.previewReady
                ? "当前计算没有名额排除记录。"
                : "预演未通过，不提供分配结果。"}
            </p>
          )}
          <details>
            <summary>输入版本与完整报告</summary>
            <pre>{JSON.stringify(report, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
}
export function DiagnosticList({
  diagnostics,
  onLocate,
}: {
  diagnostics: Diagnostic[];
  onLocate: (d: Diagnostic) => void;
}) {
  return (
    <details open className="diagnostics">
      <summary>诊断与限制（{diagnostics.length}）</summary>
      {diagnostics.length ? (
        <ul>
          {diagnostics.map((d, i) => (
            <li
              key={i}
              className={d.severity === "error" ? "diagnostic-error" : ""}
            >
              <strong>
                {d.severity === "error"
                  ? "错误"
                  : d.severity === "warning"
                    ? "警告"
                    : "说明"}
              </strong>
              ：{d.reason}
              <p className="muted">
                {d.code} · {d.path}
              </p>
              <button type="button" onClick={() => onLocate(d)}>
                定位相关字段
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>没有诊断。</p>
      )}
    </details>
  );
}
export function PreviewPane({
  configuration,
  url,
  dirty,
  onLocate,
  onConflict,
}: {
  configuration: any;
  url: string;
  dirty: boolean;
  onLocate: (d: Diagnostic) => void;
  onConflict: () => void;
}) {
  const [mode, setMode] = useState("four-groups"),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [custom, setCustom] = useState(""),
    [report, setReport] = useState<any>(null),
    [error, setError] = useState<ApiFailure | null>(null),
    [busy, setBusy] = useState(false);
  const sample = mode === "pool" ? pool.sources : fourGroups.sources,
    refs = references(configuration).filter((r) => !r.ref.poolId);
  useEffect(() => {
    setReport(null);
    setError(null);
  }, [configuration.version, dirty]);
  function reset() {
    setReport(null);
    setError(null);
  }
  async function preview() {
    if (busy) return;
    reset();
    setBusy(true);
    try {
      if (dirty)
        throw new ApiFailure("先保存当前草稿，再预演该版本。", {
          code: "UNSAVED_DRAFT",
          retryable: false,
        });
      let sources;
      if (mode === "custom") {
        try {
          sources = JSON.parse(custom);
        } catch {
          throw new ApiFailure("自定义来源 JSON 格式无效。", {
            code: "INVALID_SOURCE_JSON",
            retryable: false,
          });
        }
      } else {
        const legal = new Set(refs.map((r) => r.key));
        if (Object.values(mapping).some((id) => id && !legal.has(id)))
          throw new ApiFailure("映射引用已失效，请重新选择当前来源。", {
            code: "SOURCE_MAPPING_REQUIRED",
            retryable: false,
          });
        sources = mapSampleSources(sample, mapping);
      }
      setReport(
        await api(url + "/preview", {
          method: "POST",
          body: { expectedVersion: configuration.version, sources },
        }),
      );
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>来源预演</h2>
      <p className="warning">
        以下数据为明确标记的模拟样例。输出只证明所选来源映射与输入，不代表真实名单、成绩或晋级。
      </p>
      <Field label="预演输入">
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setMapping({});
            reset();
          }}
        >
          <option value="four-groups">模拟样例 · 四组分流 A/B/C/D</option>
          <option value="pool">模拟样例 · 选手池（含 DQ）</option>
          <option value="custom">自定义来源 JSON</option>
        </select>
      </Field>
      {mode === "custom" ? (
        <Field label="来源 JSON（roster 与 sourceSnapshots）">
          <textarea
            className="json-input"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              reset();
            }}
            spellCheck={false}
          />
        </Field>
      ) : (
        <>
          <p>
            每个样例来源需显式选择当前阶段或小组。不会按 ID 或数组位置自动匹配。
          </p>
          {sample.sourceSnapshots.map((s) => (
            <Field
              key={s.sourceId}
              label={"样例来源 " + s.sourceId.toUpperCase() + " 映射"}
            >
              <select
                value={mapping[s.sourceId] ?? ""}
                onChange={(e) => {
                  setMapping((m) => ({ ...m, [s.sourceId]: e.target.value }));
                  reset();
                }}
              >
                <option value="">请选择当前来源</option>
                {refs.map((r) => (
                  <option value={r.key} key={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </>
      )}
      <button className="primary" disabled={busy || dirty} onClick={preview}>
        {busy ? "计算中…" : "运行预演"}
      </button>
      {dirty && <p>草稿尚未保存。</p>}
      {error && (
        <ErrorNotice
          error={error}
          onRetry={error.status === 409 ? onConflict : preview}
        />
      )}{" "}
      {report && <Report report={report} onLocate={onLocate} />}
    </section>
  );
}
