import { Resource, useResource } from "./resource";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Field, ErrorNotice } from "../../shared/ui";
import { useWrite } from "./write";
const labels: Record<string, string> = {
  "metadata.edit": "编辑赛事资料",
  "structure.edit": "编辑赛制与规则",
  "registrationSchema.edit": "编辑报名字段",
  "registration.review": "查看报名、审批与锁定名单",
  "results.edit": "裁定赛果",
  "rounds.confirm": "开赛、确认整轮与同分裁定",
};
export function CollaboratorsPage() {
  const { tid } = useParams(),
    base = "/tournaments/" + tid + "/collaborators",
    state = useResource(base),
    [username, setUsername] = useState(""),
    [editing, setEditing] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    write = useWrite();
  const toggle = (p: string) =>
    setSelected(
      selected.includes(p) ? selected.filter((x) => x !== p) : [...selected, p],
    );
  return (
    <section>
      <h2>协作者与操作权限</h2>
      <p>
        创建者按赛事授予权限。报分与推进分别授权；管理员不能给自己增加权限。
      </p>
      <Resource state={state}>
        {(data) => (
          <>
            <form
              className="panel"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await write.run(
                  editing ? base + "/" + editing : base,
                  editing ? "PATCH" : "POST",
                  {
                    expectedVersion: data.version,
                    ...(editing ? {} : { username }),
                    permissions: selected,
                  },
                );
                if (r) {
                  setUsername("");
                  setEditing("");
                  setSelected([]);
                  state.reload();
                }
              }}
            >
              <Field label="注册用户名">
                <input
                  required
                  disabled={!!editing}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <fieldset>
                <legend>授予能力</legend>
                {data.permissions.map((p: string) => (
                  <Field key={p} label={labels[p]}>
                    <input
                      type="checkbox"
                      checked={selected.includes(p)}
                      onChange={() => toggle(p)}
                    />
                  </Field>
                ))}
              </fieldset>
              <button className="primary" disabled={write.busy}>
                保存管理员权限
              </button>
            </form>
            {data.items.length ? (
              data.items.map((c: any) => (
                <article key={c.userId} className="panel">
                  <h3>{c.name}</h3>
                  <p>
                    {c.permissions.map((p: string) => labels[p]).join("、") ||
                      "无操作权限"}
                  </p>
                  <button
                    onClick={() => {
                      setEditing(c.userId);
                      setUsername(c.name);
                      setSelected(c.permissions);
                    }}
                  >
                    编辑权限
                  </button>
                  <button
                    disabled={write.busy}
                    onClick={async () => {
                      if (window.confirm("确认撤销此协作者的全部权限？")) {
                        const r = await write.run(
                          base + "/" + c.userId,
                          "DELETE",
                          { expectedVersion: data.version },
                        );
                        if (r) state.reload();
                      }
                    }}
                  >
                    撤销授权
                  </button>
                </article>
              ))
            ) : (
              <p className="empty">尚无协作者。</p>
            )}
          </>
        )}
      </Resource>
      {write.error && (
        <ErrorNotice
          error={write.error}
          onRetry={
            write.error.status === 409
              ? state.reload
              : async () => {
                  const r = await write.retry();
                  if (r) state.reload();
                }
          }
        />
      )}
    </section>
  );
}
