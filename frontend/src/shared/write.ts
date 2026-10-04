import { useEffect, useRef, useState } from "react";
import { api, failure, requestKey, type ApiFailure } from "./api";
export function useWrite() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiFailure | null>(null);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null),
    lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run<T = any>(
    path: string,
    method: string,
    body: unknown,
  ): Promise<T | undefined> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const fingerprint = JSON.stringify({ path, method, body });
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, key: requestKey() };
    try {
      const result = await api<T>(path, {
        method,
        body,
        key: pending.current.key,
      });
      pending.current = null;
      return mounted.current ? result : undefined;
    } catch (e) {
      if (mounted.current) setError(failure(e));
      return undefined;
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError(null) };
}
