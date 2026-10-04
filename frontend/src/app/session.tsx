import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  api,
  failure,
  invalidateIdentityRequests,
  type ApiFailure,
} from "../shared/api";
import { ErrorNotice } from "../shared/ui";
export type User = { id: string; username: string; displayName: string };
const Context = createContext<{
  user: User | null;
  ready: boolean;
  error: ApiFailure | null;
  epoch: number;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
}>({
  user: null,
  ready: false,
  error: null,
  epoch: 0,
  refresh: async () => {},
  setUser: () => {},
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, putUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState<ApiFailure | null>(null),
    [epoch, setEpoch] = useState(0);
  const seq = useRef(0),
    identity = useRef<string | null>(null);
  function setUser(u: User | null) {
    seq.current++;
    if (identity.current !== (u?.id ?? null)) {
      invalidateIdentityRequests();
      setEpoch((n) => n + 1);
    }
    identity.current = u?.id ?? null;
    putUser(u);
    setReady(true);
    setError(null);
  }
  async function refresh() {
    const current = ++seq.current;
    setError(null);
    try {
      const result = await api<{ user: User | null }>("/auth/session");
      if (current === seq.current) {
        identity.current = result.user?.id ?? null;
        putUser(result.user);
        setReady(true);
        setEpoch((n) => n + 1);
      }
    } catch (e) {
      if (current === seq.current) {
        setError(failure(e));
        setReady(true);
      }
    }
  }
  useEffect(() => {
    void refresh();
    const expire = () => setUser(null);
    window.addEventListener("session-expired", expire);
    return () => {
      seq.current++;
      window.removeEventListener("session-expired", expire);
    };
  }, []);
  return (
    <Context.Provider value={{ user, ready, error, epoch, refresh, setUser }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
export function Protected({ children }: { children: ReactNode }) {
  const s = useSession(),
    location = useLocation();
  if (!s.ready) return <p role="status">正在恢复会话…</p>;
  if (s.error)
    return <ErrorNotice error={s.error} onRetry={() => void s.refresh()} />;
  if (!s.user)
    return (
      <Navigate
        to={
          "/login?returnTo=" +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    );
  return <section key={s.user.id + ":" + s.epoch}>{children}</section>;
}
