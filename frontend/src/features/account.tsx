import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, failure, type ApiFailure } from "../shared/api";
import { ErrorNotice, Field, safeReturn } from "../shared/ui";
import { useSession, type User } from "../app/session";
export function AccountPage({
  mode,
}: {
  mode: "login" | "register" | "profile" | "recovery";
}) {
  const session = useSession(),
    navigate = useNavigate(),
    [query] = useSearchParams();
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [displayName, setDisplayName] = useState(session.user?.displayName ?? ""),
    [error, setError] = useState<ApiFailure | null>(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  useEffect(() => {
    setDisplayName(session.user?.displayName ?? "");
  }, [session.user?.id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess("");
    try {
      if (mode === "recovery")
        await api("/auth/password-reset", { method: "POST", body: {} });
      else if (mode === "profile") {
        const user = await api<User>("/me", {
          method: "PATCH",
          body: { displayName },
        });
        session.setUser(user);
        setSuccess("显示名已保存。");
      } else if (mode === "register") {
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
  async function logout() {
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
      session.setUser(null);
      navigate("/tournaments", { replace: true });
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: "登录",
    register: "创建账号",
    profile: "个人资料",
    recovery: "找回密码",
  }[mode];
  return (
    <div className="narrow">
      <p className="eyebrow">账户 / 赛事工作台</p>
      <h1>{title}</h1>
      {query.has("registered") && <p role="status">账号已创建，请登录。</p>}
      {mode === "recovery" ? (
        <p>
          密码恢复服务尚未接入。当前无法发送恢复邮件；请联系本地系统维护者确认处理方式。
        </p>
      ) : mode === "profile" ? (
        <p>用户名：{session.user?.username}</p>
      ) : (
        <p>使用用户名与密码。第三方登录尚未接入。</p>
      )}
      <form onSubmit={submit}>
        {(mode === "login" || mode === "register") && (
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
        {(mode === "register" || mode === "profile") && (
          <Field label="显示名">
            <input
              required
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
        )}
        {(mode === "login" || mode === "register") && (
          <Field label="密码">
            <input
              type="password"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "register" ? 12 : undefined}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {mode === "register" && (
          <p className="muted">
            用户名 3–32 位，仅英文、数字和下划线；密码 12–128 位。
          </p>
        )}
        <button disabled={busy || !!error?.retryAfter} className="primary">
          {busy
            ? "处理中…"
            : mode === "profile"
              ? "保存显示名"
              : mode === "recovery"
                ? "检查恢复服务"
                : title}
        </button>
      </form>
      {success && <p role="status">{success}</p>}
      {error && (
        <ErrorNotice
          error={error}
          onRetry={() => {
            setError(null);
          }}
        />
      )}
      <div className="actions">
        {mode === "login" && (
          <>
            <Link to="/register">创建账号</Link>
            <Link to="/forgot-password">找回密码</Link>
          </>
        )}
        {mode === "register" && <Link to="/login">已有账号，登录</Link>}
        {mode === "recovery" && <Link to="/login">返回登录</Link>}
        {mode === "profile" && (
          <button disabled={busy} onClick={logout}>
            退出登录
          </button>
        )}
        <Link to="/tournaments">返回赛事</Link>
      </div>
    </div>
  );
}
