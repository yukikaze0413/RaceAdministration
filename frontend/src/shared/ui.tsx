import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiFailure, failure, type Diagnostic } from "./api";
export function ErrorNotice({
  error,
  onRetry,
  onLocate,
}: {
  error: ApiFailure;
  onRetry?: () => void;
  onLocate?: (d: Diagnostic) => void;
}) {
  const [wait, setWait] = useState(error.retryAfter);
  useEffect(() => {
    setWait(error.retryAfter);
    if (!error.retryAfter) return;
    const timer = setInterval(() => setWait((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [error]);
  return (
    <section className="error" role="alert">
      <strong>
        {error.status === 501
          ? "功能尚未开放"
          : error.status === 403
            ? "没有操作权限"
            : error.status === 404
              ? "未找到资料"
              : error.status === 409
                ? "请处理版本或请求冲突"
                : "操作未完成"}
      </strong>
      <p>{error.message}</p>
      {error.fieldErrors?.map((f, i) => (
        <p key={i}>
          {f.path}：{f.message}
        </p>
      ))}
      {error.diagnostics?.map((d, i) => (
        <div key={i}>
          <p>
            {d.path}：{d.reason}
          </p>
          {onLocate && (
            <button type="button" onClick={() => onLocate(d)}>
              定位相关字段
            </button>
          )}
        </div>
      ))}
      {error.status === 401 && (
        <Link
          to={
            "/login?returnTo=" +
            encodeURIComponent(location.pathname + location.search)
          }
        >
          重新登录
        </Link>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={wait > 0}>
          {wait > 0
            ? `请等待 ${wait} 秒`
            : error.status === 501
              ? "重新检查服务"
              : "重试"}
        </button>
      )}
      <details>
        <summary>错误详情</summary>
        <dl>
          <dt>错误码</dt>
          <dd>{error.code}</dd>
          <dt>请求号</dt>
          <dd>{error.requestId ?? "请求未获得服务端响应"}</dd>
          {error.capability && (
            <>
              <dt>能力</dt>
              <dd>{error.capability}</dd>
            </>
          )}
        </dl>
      </details>
    </section>
  );
}
export function useResource<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState<ApiFailure | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [currentPath, setCurrentPath] = useState(path);
  const sequence = useRef(0);
  useEffect(() => {
    const seq = ++sequence.current,
      controller = new AbortController();
    setCurrentPath(path);
    setData(null);
    setError(null);
    setLoading(!!path);
    if (path)
      api<T>(path, { signal: controller.signal }).then(
        (value) => {
          if (seq === sequence.current) {
            setData(value);
            setLoading(false);
          }
        },
        (e) => {
          if (seq === sequence.current && !controller.signal.aborted) {
            setError(failure(e));
            setLoading(false);
          }
        },
      );
    return () => {
      sequence.current++;
      controller.abort();
    };
  }, [path, revision]);
  return {
    data: currentPath === path ? data : null,
    error: currentPath === path ? error : null,
    loading: currentPath !== path ? !!path : loading,
    reload: () => setRevision((n) => n + 1),
  };
}
export function Resource({
  state,
  children,
}: {
  state: ReturnType<typeof useResource>;
  children: (data: any) => ReactNode;
}) {
  if (state.loading) return <p role="status">正在读取…</p>;
  if (state.error)
    return <ErrorNotice error={state.error} onRetry={state.reload} />;
  return state.data === null ? null : <>{children(state.data)}</>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
export function safeReturn(value: string | null) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.startsWith("/login") &&
    !value.startsWith("/register")
    ? value
    : "/me/tournaments";
}
