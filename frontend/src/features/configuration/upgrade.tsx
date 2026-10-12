import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWrite } from "../../shared/write";
import { ErrorNotice } from "../../shared/ui";
export function UpgradeDraft({
  configuration,
  url,
  unavailable = false,
}: {
  configuration: any;
  url: string;
  unavailable?: boolean;
}) {
  const write = useWrite(),
    navigate = useNavigate(),
    [open, setOpen] = useState(false),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  if (
    configuration.state !== "draft" ||
    configuration.structureVersion !== "structure-v1"
  )
    return null;
  async function copy() {
    const result = await write.run(url + "/copy-upgrade", "POST", {
      expectedVersion: configuration.version,
    });
    if (result) {
      setOpen(false);
      navigate(
        "/manage/" +
          configuration.tournamentId +
          "/configurations/" +
          result.id +
          "/stages",
      );
    }
  }
  return (
    <section className="panel">
      <h3>使用新版赛制参数</h3>
      <p>
        复制已保存的旧草稿为独立配置，原数据保留。先保存需要带入的修改；新增参数采用新版默认集，六人单败等旧规则可能需要手动调整。
      </p>
      <button
        disabled={write.busy || unavailable}
        onClick={() => setOpen(true)}
      >
        复制升级为新版配置
      </button>
      <dialog
        ref={dialog}
        aria-label="复制升级旧草稿"
        onCancel={(e) => {
          if (write.busy) e.preventDefault();
          else setOpen(false);
        }}
      >
        <h2>复制升级旧草稿</h2>
        <p>
          将版本 {configuration.version}{" "}
          复制为独立新版配置，重建阶段、小组、池及连线引用。原配置和报名分配保留；冻结或已运行配置不能升级。
        </p>
        {write.error && <ErrorNotice error={write.error} onRetry={copy} />}
        <div className="actions">
          <button disabled={write.busy} onClick={() => setOpen(false)}>
            取消
          </button>
          <button className="primary" disabled={write.busy} onClick={copy}>
            确认复制升级
          </button>
        </div>
      </dialog>
    </section>
  );
}
export function UpgradeOrigin({ origin }: { origin: any }) {
  if (!origin) return null;
  return (
    <section className="warning">
      <p>
        由旧配置复制升级：{origin.configurationId.slice(0, 8)} · 来源版本{" "}
        {origin.version}。原配置保留。
      </p>
      <details>
        <summary>查看升级映射与待核验事项</summary>
        <p>
          已重建 {Object.keys(origin.mapping.stages).length} 个阶段、
          {Object.keys(origin.mapping.groups).length} 个旧组、
          {Object.keys(origin.mapping.pools).length} 个池、
          {Object.keys(origin.mapping.routes).length} 条连线；无组阶段新增{" "}
          {Object.keys(origin.syntheticGroups).length} 个单组。
        </p>
        <ul>
          {origin.warnings.map((w: any, i: number) => (
            <li key={i}>{w.reason}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
