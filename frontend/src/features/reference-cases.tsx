import { useState } from "react";
import { useResource, Resource, Field, ErrorNotice } from "../shared/ui";
import { useWrite } from "../shared/write";
import { workspacePrefix } from "../shared/workspace";
export function ReferenceCasesPage() {
  const resource = useResource("/reference-cases"),
    write = useWrite(),
    demos = useResource(workspacePrefix() ? null : "/reference-demos");
  const [selected, setSelected] = useState("shadow-cup-v1"),
    [confirmed, setConfirmed] = useState(false),
    [created, setCreated] = useState<any>(null);
  return (
    <>
      <h1>赛事示例</h1>
      <p>
        创建独立演示空间，参考参赛单位仅为标签。可以编辑、审批、冻结和推进，不写入原空间赛事。
      </p>
      <Resource state={resource}>
        {(data) => {
          const sample = data.items.find((c: any) => c.id === selected);
          if (data.workspace === "reference-demo")
            return (
              <p>
                当前已在独立演示空间。
                <a href="/reference-cases">返回原空间示例入口</a>
              </p>
            );
          async function create() {
            const next = await write.run("/reference-demos", "POST", {
              caseId: sample.id,
              caseVersion: sample.version,
              expectedVersion: 0,
              confirmed,
            });
            if (next) {
              setCreated(next);
              demos.reload();
            }
          }
          return (
            <section className="panel">
              <Field label="示例">
                <select
                  value={selected}
                  disabled={write.busy}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setConfirmed(false);
                    setCreated(null);
                    write.clearError();
                  }}
                >
                  {data.items.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.status === "pending" ? " · 待核验" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {sample.status === "pending" ? (
                <p role="status">{sample.reason}</p>
              ) : (
                <>
                  <p>
                    验收比分种子{sample.seed} · {sample.entrantCount}个参赛单位
                    ·{" "}
                    {sample.id === "gsl-reset-v1"
                      ? "34场，触发决赛重置时35场"
                      : `${sample.matchCount}场`}
                  </p>
                  <p>
                    创建后手工审批、安排时间和录入比分；验收种子用于核对固定测试比分。
                  </p>
                  <label
                    style={{ display: "flex", gap: 8, alignItems: "start" }}
                  >
                    <input
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                      type="checkbox"
                      checked={confirmed}
                      disabled={write.busy}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    确认创建独立演示空间
                  </label>
                  <button disabled={!confirmed || write.busy} onClick={create}>
                    {write.busy ? "正在创建…" : "创建独立演示"}
                  </button>
                </>
              )}
              {write.error && (
                <ErrorNotice
                  error={write.error}
                  onRetry={
                    write.error.status === 409
                      ? () => {
                          setConfirmed(false);
                          resource.reload();
                        }
                      : create
                  }
                />
              )}
              {created && (
                <p role="status">
                  独立演示已创建。<a href={created.url}>进入演示</a>
                </p>
              )}
              <h2>已创建的独立演示</h2>
              <Resource state={demos}>
                {(list) =>
                  list.items.length ? (
                    <ul>
                      {list.items.map((item: any) => (
                        <li key={item.id}>
                          {item.name} · {item.id.slice(0, 8)}{" "}
                          <button
                            disabled={write.busy}
                            onClick={async () => {
                              const next = await write.run(
                                "/reference-demos/" + item.id + "/enter",
                                "POST",
                                { expectedVersion: item.version },
                              );
                              if (next) window.location.assign(next.url);
                            }}
                          >
                            打开演示
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>尚未创建演示。</p>
                  )
                }
              </Resource>
            </section>
          );
        }}
      </Resource>
    </>
  );
}
