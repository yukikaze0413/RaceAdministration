import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useBeforeUnload, useBlocker, useLocation } from "react-router-dom";
import { api } from "../../shared/api";
import { knownPlanIds } from "../tournament/plan-graph";
class SessionStore extends Map<string, any> {
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  override set(key: string, value: any) {
    if (this.has(key) && Object.is(this.get(key), value)) return this;
    super.set(key, value);
    this.listeners?.forEach((listener) => listener());
    return this;
  }
}
const Session = createContext<SessionStore | null>(null);
export function ConfigurationSession({ children }: { children: ReactNode }) {
  const slots = useRef(new SessionStore());
  return <Session.Provider value={slots.current}>{children}</Session.Provider>;
}
export function useSessionState<T>(
  key: string,
  initial: T | (() => T),
): [T, (next: SetStateAction<T>) => void] {
  const shared = useContext(Session),
    local = useRef(new SessionStore()),
    cache = shared ?? local.current;
  const [initialValue] = useState<T>(() =>
    typeof initial === "function" ? (initial as () => T)() : initial,
  );
  const snapshot = useCallback(
    () => (cache.has(key) ? cache.get(key) : initialValue),
    [cache, key, initialValue],
  );
  const value = useSyncExternalStore(cache.subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!cache.has(key)) cache.set(key, initialValue);
  }, [cache, key, initialValue]);
  const set = useCallback(
    (next: SetStateAction<T>) => {
      const old = cache.has(key) ? cache.get(key) : initialValue;
      cache.set(
        key,
        typeof next === "function" ? (next as (old: T) => T)(old) : next,
      );
    },
    [cache, key, initialValue],
  );
  return [value, set];
}
function normalized(value: any): any {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, normalized(value[key])]),
    );
  return value;
}
export function sameValue(a: any, b: any) {
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
}
export function sameConfiguration(a: string, b: string) {
  const pattern =
      /^\/manage\/([^/]+)\/configurations\/([^/]+)\/(?:stages|pools|routes|validation|preview|graph)\/?$/,
    left = a.match(pattern),
    right = b.match(pattern);
  return !!left && !!right && left[1] === right[1] && left[2] === right[2];
}
export function useSessionAccess() {
  const cache = useContext(Session);
  if (!cache) throw new Error("Configuration session is unavailable");
  return cache;
}
export function structurePayload(c: any) {
  const {
    id,
    tournamentId,
    version,
    state,
    snapshot,
    upgradeOrigin,
    ...payload
  } = c;
  return payload;
}
export async function saveSessionLayout(
  cache: Map<string, any>,
  write: any,
  url: string,
  configuration: any,
) {
  const layout = cache.get("graph-layout");
  if (!layout) return false;
  let childIds: string[] = [];
  if (configuration.structureVersion === "structure-v2") {
    const signature = JSON.stringify(structurePayload(configuration));
    if (signature === cache.get("graph-node-structure"))
      childIds = cache.get("graph-node-ids") ?? [];
    else {
      const report = await api(url + "/graph-plan", {
        method: "POST",
        body: {
          expectedVersion: configuration.version,
          payload: structurePayload(configuration),
        },
      });
      childIds =
        report.layoutNodeIds ?? (report.plan ? knownPlanIds(report.plan) : []);
    }
  }
  const ids = new Set([
    ...configuration.stages.map((s: any) => s.id),
    ...configuration.stages.flatMap((s: any) => s.groups.map((g: any) => g.id)),
    ...configuration.pools.map((p: any) => p.id),
    ...childIds,
  ]);
  const result = await write.run(url + "/layout", "PUT", {
    expectedVersion: layout.version,
    positions: Object.fromEntries(
      Object.entries(layout.positions).filter(([id]) => ids.has(id)),
    ),
    zoom: layout.zoom,
    pan: layout.pan,
  });
  if (!result) return false;
  cache.set("graph-layout", result);
  cache.set("graph-baseline", result);
  cache.set("graph-dirty", false);
  cache.set("graph-view-changed", false);
  return true;
}
export function ParameterLeaveGuard({
  dirty,
  onSave,
}: {
  dirty: boolean;
  onSave: () => Promise<boolean>;
}) {
  const location = useLocation(),
    blocker = useBlocker(
      ({ nextLocation }) =>
        dirty && !sameConfiguration(location.pathname, nextLocation.pathname),
    ),
    dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false);
  const [saving, setSaving] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (blocker.state === "blocked") dialog.current?.showModal();
    else {
      dialog.current?.close();
      setFailed(false);
    }
  }, [blocker.state]);
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  async function saveLeave() {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setFailed(false);
    try {
      if (await onSave()) blocker.proceed?.();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-label="未保存草稿"
      onCancel={(e) => {
        if (lock.current) e.preventDefault();
        else blocker.reset?.();
      }}
    >
      <h2>草稿尚未保存</h2>
      <p>同一配置内切页保留输入；离开将舍弃未保存的参数、结构和布局。</p>
      {failed && (
        <p role="alert">保存未完成，输入保留，请处理页面错误或继续编辑。</p>
      )}
      <div className="actions">
        <button disabled={saving} autoFocus onClick={() => blocker.reset?.()}>
          继续编辑
        </button>
        <button disabled={saving} onClick={() => blocker.proceed?.()}>
          舍弃后离开
        </button>
        <button className="primary" disabled={saving} onClick={saveLeave}>
          {saving ? "保存中…" : "保存后离开"}
        </button>
      </div>
    </dialog>
  );
}
