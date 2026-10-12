import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, failure, ApiFailure } from "../shared/api";
import { ErrorNotice, Field, safeReturn } from "../shared/ui";
import { useSession, type User } from "../app/session";
import { AccountSettings } from "./account-settings";
import { workspacePrefix } from "../shared/workspace";
type Mode = "login" | "register" | "profile" | "recovery";
export function AccountPage({ mode }: { mode: Mode }) {
  if (workspacePrefix())
    return (
      <>
        <h1>演示空间由原空间管理</h1>
        <p>
          请回到赛事示例，重新打开已创建的演示。参考单位没有独立的成员账号。
        </p>
        <a href="/reference-cases">返回赛事示例</a>
      </>
    );
  return mode === "profile" ? <AccountSettings /> : <AccountForm mode={mode} />;
}
function AccountForm({ mode }: { mode: Exclude<Mode, "profile"> }) {
  const session = useSession(),
    navigate = useNavigate(),
    [query] = useSearchParams();
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<ApiFailure | null>(null),
    [busy, setBusy] = useState(false);
  const title = { login: "登录", register: "创建账号", recovery: "找回密码" }[
    mode
  ];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "recovery")
        await api("/auth/password-reset", { method: "POST", body: {} });
      else if (mode === "register") {
        await api("/auth/register", {
          method: "POST",
          body: { username, displayName, password },
        });
        setPassword("");
        navigate("/login?registered=1");
      } else {
        const user = await api<User>("/auth/login", {
          method: "POST",
          body: { username, password },
        });
        setPassword("");
        session.setUser(user);
        navigate(safeReturn(query.get("returnTo")), { replace: true });
      }
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <p className="eyebrow">账户 / 赛事工作台</p>
      <h1>{title}</h1>
      {query.has("registered") && <p role="status">账号已创建，请登录。</p>}
      {query.has("passwordChanged") && (
        <p role="status">
          密码已修改，请使用新密码登录。其他设备的登录也已退出。
        </p>
      )}
      {query.has("accountDeleted") && (
        <p role="status">
          {query.has("demoCleanupPending")
            ? "账号已删除。演示文件清理已排队，服务会继续重试。"
            : "账号及相关数据已永久删除。"}
        </p>
      )}
      {mode === "recovery" ? (
        <p>
          密码恢复服务尚未接入。当前无法发送恢复邮件；请联系本地系统维护者确认处理方式。
        </p>
      ) : (
        <p>使用用户名与密码。第三方登录尚未接入。</p>
      )}
      <form onSubmit={submit}>
        {mode !== "recovery" && (
          <Field label="用户名">
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={mode === "register" ? 3 : undefined}
              maxLength={32}
            />
          </Field>
        )}
        {mode === "register" && (
          <Field label="显示名">
            <input
              required
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
        )}
        {mode !== "recovery" && (
          <Field label="密码">
            <input
              type="password"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {mode === "register" && (
          <p className="muted">
            用户名 3–32 位，仅英文、数字和下划线；密码不能为空，空格会保留。
          </p>
        )}
        <button disabled={busy || !!error?.retryAfter} className="primary">
          {busy ? "处理中…" : mode === "recovery" ? "检查恢复服务" : title}
        </button>
      </form>
      {error && <ErrorNotice error={error} onRetry={() => setError(null)} />}
      <div className="actions">
        {mode === "login" && (
          <>
            <Link to="/register">创建账号</Link>
            <Link to="/forgot-password">找回密码</Link>
          </>
        )}
        {mode === "register" && <Link to="/login">已有账号，登录</Link>}
        {mode === "recovery" && <Link to="/login">返回登录</Link>}
        <Link to="/tournaments">返回赛事</Link>
      </div>
    </div>
  );
}
