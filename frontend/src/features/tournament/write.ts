import { useRef } from "react";
import { useWrite as useBaseWrite } from "../../shared/write";
export function useWrite() {
  const base = useBaseWrite(),
    last = useRef<{ path: string; method: string; body: unknown } | null>(null);
  async function run<T = any>(path: string, method: string, body: unknown) {
    last.current = { path, method, body };
    return base.run<T>(path, method, body);
  }
  async function retry() {
    const p = last.current;
    if (p) return base.run(p.path, p.method, p.body);
  }
  return { ...base, run, retry };
}
