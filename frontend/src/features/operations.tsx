import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, failure, type ApiFailure } from "../shared/api";
import { ErrorNotice } from "../shared/ui";
const modules: Record<
  string,
  {
    title: string;
    purpose: string;
    read?: string;
    actions: [string, string, string][];
  }
> = {
  registration: {
    title: "报名与名单",
    purpose:
      "个人报名、审批、候补、签到与退出服务尚未实现；当前不收集报名资料。",
    read: "registrations",
    actions: [
      ["个人报名", "POST", "registrations"],
      ["组队报名", "POST", "teams"],
      ["审批报名服务", "POST", "registrations/unavailable/approve"],
      ["签到服务", "POST", "registrations/unavailable/check-in"],
      ["退出或移除报名服务", "DELETE", "registrations/unavailable"],
    ],
  },
  matches: {
    title: "比赛对阵与逐局信息",
    purpose: "配对与逐局记录尚未开放，当前没有可用对阵，也无法进行报分。",
    read: "matches",
    actions: [
      ["检查逐局服务", "GET", "matches/unavailable/games"],
      ["检查报分服务", "POST", "matches/unavailable/results"],
    ],
  },
  standings: {
    title: "排名",
    purpose: "积分和排名规则尚未实现；不会把未计算状态显示为零分或名次。",
    read: "standings",
    actions: [],
  },
  results: {
    title: "赛果",
    purpose: "报分、裁定与修改结果服务尚未实现，不收集无法保存的比分。",
    read: "results",
    actions: [["检查修改赛果服务", "PATCH", "matches/unavailable/results"]],
  },
  rounds: {
    title: "整轮推进",
    purpose: "整轮确认和晋级运行尚未实现；双方退出时不擅自指定淘汰赛胜者。",
    read: "rounds",
    actions: [
      ["检查整轮确认服务", "POST", "rounds/unavailable/confirm"],
      ["检查开赛服务", "POST", "start"],
    ],
  },
  sanctions: {
    title: "处罚与撤销",
    purpose:
      "处罚裁定、扣分与撤销服务尚未实现。已确认的结构预演会保留 DQ 标志，不等于执行处罚。",
    read: "sanctions",
    actions: [
      ["检查处罚服务", "POST", "sanctions"],
      ["检查撤销服务", "DELETE", "sanctions/unavailable"],
    ],
  },
  collaborators: {
    title: "协作者",
    purpose:
      "邀请与授权服务尚未实现，目前仅赛事创建者具有管理权限。不收集无法保存的被邀请者资料。",
    read: "collaborators",
    actions: [
      ["检查邀请服务", "POST", "collaborators"],
      ["检查权限变更服务", "PATCH", "collaborators/unavailable"],
      ["检查移除服务", "DELETE", "collaborators/unavailable"],
    ],
  },
};
export function OperationsPage({
  kind,
  publicRegistration = false,
}: {
  kind: string;
  publicRegistration?: boolean;
}) {
  const { tid } = useParams(),
    module = modules[kind],
    [error, setError] = useState<ApiFailure | null>(null),
    [busy, setBusy] = useState(false),
    [last, setLast] = useState<[string, string] | null>(null);
  const base = "/tournaments/" + tid + "/";
  async function check(method: string, path: string) {
    setBusy(true);
    setLast([method, path]);
    setError(null);
    try {
      await api(base + path, {
        method,
        ...(method === "GET" ? {} : { body: {} }),
      });
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (module.read && !publicRegistration) {
      const c = new AbortController();
      setBusy(true);
      setLast(["GET", module.read]);
      api(base + module.read, { signal: c.signal })
        .catch((e) => {
          if (!c.signal.aborted) setError(failure(e));
        })
        .finally(() => {
          if (!c.signal.aborted) setBusy(false);
        });
      return () => c.abort();
    }
  }, [tid, kind, publicRegistration]);
  const actions = publicRegistration
    ? module.actions.slice(0, 2)
    : module.actions;
  return (
    <section>
      <h2>{module.title}</h2>
      <p>{module.purpose}</p>
      <p className="warning">
        能力状态：尚未开放。下面的按钮只检查服务状态，不会提交真实业务操作。子对象标识仅用于能力门控查询。
      </p>
      {busy && <p role="status">正在检查服务…</p>}
      {error && (
        <ErrorNotice
          error={error}
          onRetry={last ? () => void check(...last) : undefined}
        />
      )}
      <div className="actions">
        {actions.map(([label, method, path]) => (
          <button
            key={path + method}
            disabled={busy}
            onClick={() => void check(method, path)}
          >
            {label}
          </button>
        ))}
        <Link to={"/tournaments/" + tid}>返回赛事主页</Link>
      </div>
    </section>
  );
}
