import { useParams, useNavigate } from "react-router-dom";
import { Resource, useResource, ErrorNotice } from "../../shared/ui";
import { useWrite } from "../../shared/write";
export function RuntimePresets() {
  const { tid } = useParams(),
    navigate = useNavigate(),
    state = useResource("/runtime-presets"),
    write = useWrite();
  return (
    <section>
      <h2>可运行赛制预设</h2>
      <p>
        创建独立草稿后可修改阶段、小组、名次和晋级席位。开赛前需发布报名表、审批并锁定名单、冻结结构。
      </p>
      <Resource state={state}>
        {(items) => (
          <div className="preset-list">
            {items.map((p: any) => (
              <article className="panel" key={p.id}>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <button
                  className="primary"
                  disabled={write.busy}
                  onClick={async () => {
                    const c = await write.run(
                      "/tournaments/" +
                        tid +
                        "/configurations/from-runtime-preset",
                      "POST",
                      { presetId: p.id },
                    );
                    if (c)
                      navigate(
                        "/manage/" + tid + "/configurations/" + c.id + "/graph",
                      );
                  }}
                >
                  使用{p.name}预设
                </button>
              </article>
            ))}
          </div>
        )}
      </Resource>
      {write.error && <ErrorNotice error={write.error} />}
    </section>
  );
}
