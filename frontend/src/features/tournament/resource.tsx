import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, failure, type ApiFailure } from "../../shared/api";
import { Resource as BaseResource, ErrorNotice } from "../../shared/ui";
export function useResource<T = any>(path: string | null) {
  const [snapshot, setSnapshot] = useState<{
      path: string | null;
      value: T | null;
    }>({ path: null, value: null }),
    [error, setError] = useState<ApiFailure | null>(null),
    [pending, setPending] = useState(false),
    [revision, setRevision] = useState(0),
    sequence = useRef(0);
  useEffect(() => {
    const seq = ++sequence.current,
      c = new AbortController();
    setError(null);
    setPending(!!path);
    if (path)
      api<T>(path, { signal: c.signal }).then(
        (value) => {
          if (seq === sequence.current) {
            setSnapshot({ path, value });
            setPending(false);
          }
        },
        (e) => {
          if (seq === sequence.current && !c.signal.aborted) {
            const f = failure(e);
            setError(f);
            if ([401, 403, 404].includes(f.status))
              setSnapshot({ path, value: null });
            setPending(false);
          }
        },
      );
    return () => {
      sequence.current++;
      c.abort();
    };
  }, [path, revision]);
  const data = snapshot.path === path ? snapshot.value : null;
  return {
    data,
    error: data === null ? error : null,
    loading: !!path && data === null && (pending || snapshot.path !== path),
    refreshError: data !== null ? error : null,
    refreshing: pending && data !== null,
    reload: () => setRevision((n) => n + 1),
  };
}
export function Resource({
  state,
  children,
}: {
  state: ReturnType<typeof useResource>;
  children: (value: any) => ReactNode;
}) {
  return (
    <>
      {state.refreshError && (
        <ErrorNotice error={state.refreshError} onRetry={state.reload} />
      )}
      <BaseResource state={state}>{children}</BaseResource>
    </>
  );
}
