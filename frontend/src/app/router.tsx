import { CapabilityContext, CapabilityGate } from "../shared/capabilities";
import { Component, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  createBrowserRouter,
  useLocation,
  useOutletContext,
} from "react-router-dom";
import { useSession, Protected } from "./session";
import { ApiFailure } from "../shared/api";
import { ErrorNotice, Resource, useResource } from "../shared/ui";
import { AccountPage } from "../features/account";
import {
  CatalogPage,
  MyTournaments,
  SeriesPage,
  MetadataPage,
  TournamentLayout,
  TournamentOverview,
  PublicStages,
} from "../features/catalog";
import { OperationsPage } from "../features/operations";
import { SchedulePage } from "../features/tournament/schedule";
import { ReferenceCasesPage } from "../features/reference-cases";
import { workspacePrefix } from "../shared/workspace";
import {
  ConfigurationList,
  ConfigurationPage,
  TemplatesPage,
} from "../features/configuration/pages";
class PageBoundary extends Component<
  { children: ReactNode; path: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous: { path: string }) {
    if (previous.path !== this.props.path && this.state.failed)
      this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? (
      <ErrorNotice
        error={
          new ApiFailure("页面显示发生异常，请重试。", { code: "RENDER_ERROR" })
        }
        onRetry={() => this.setState({ failed: false })}
      />
    ) : (
      this.props.children
    );
  }
}

export function AppShell() {
  const session = useSession(),
    location = useLocation(),
    caps = useResource("/capabilities");
  return (
    <>
      <a className="skip" href="#main-content">
        跳到主要内容
      </a>
      <header className="topbar">
        <Link className="brand" to="/tournaments">
          <span className="brand-mark">赛</span>赛事工作台
        </Link>
        <nav aria-label="平台导航">
          <NavLink to="/tournaments">赛事发现</NavLink>
          <NavLink to="/me/tournaments">我的赛事</NavLink>
          {!workspacePrefix() && session.user && (
            <NavLink to="/reference-cases">赛事示例</NavLink>
          )}
          {session.user ? (
            workspacePrefix() ? (
              <span>{session.user.displayName}</span>
            ) : (
              <Link to="/me/profile">{session.user.displayName}</Link>
            )
          ) : workspacePrefix() ? (
            <a href="/reference-cases">重新进入演示</a>
          ) : (
            <Link to="/login">登录 / 注册</Link>
          )}
        </nav>
      </header>
      {workspacePrefix() && (
        <aside className="notice">
          隔离演示空间 · 参考单位仅为标签。
          <a href="/reference-cases">返回原空间</a>
        </aside>
      )}
      <main id="main-content">
        <Resource state={caps}>
          {(data) => (
            <>
              {data.version !== 1 ||
              !data.capabilities ||
              typeof data.capabilities !== "object" ||
              Array.isArray(data.capabilities) ||
              Object.values<any>(data.capabilities).some(
                (value) =>
                  !value ||
                  !["implemented", "unavailable"].includes(value.status) ||
                  typeof value.message !== "string",
              ) ? (
                <ErrorNotice
                  error={
                    new ApiFailure("能力契约版本不受支持，请更新客户端。", {
                      code: "BAD_RESPONSE",
                      retryable: true,
                    })
                  }
                  onRetry={caps.reload}
                />
              ) : (
                <>
                  <details className="capability-strip">
                    <summary>平台能力 · 账号、赛事资料、结构配置</summary>
                    <ul>
                      {Object.entries<any>(data.capabilities).map(
                        ([key, value]) => (
                          <li key={key}>{value.message}</li>
                        ),
                      )}
                    </ul>
                    <p>未列出的能力默认不可用。</p>
                  </details>
                  <CapabilityContext.Provider value={data}>
                    <PageBoundary
                      path={location.pathname}
                      key={session.user?.id ?? "visitor"}
                    >
                      <Outlet />
                    </PageBoundary>
                  </CapabilityContext.Provider>
                </>
              )}
            </>
          )}
        </Resource>
      </main>
      <footer>赛事工作台 · 结构配置与运行能力分开验证</footer>
    </>
  );
}
function ManageLanding() {
  const event = useOutletContext<any>(),
    p = event.effectivePermissions ?? {};
  const target =
    event.isOwner || p["structure.edit"]
      ? "overview"
      : p["registration.review"] || p["registrationSchema.edit"]
        ? "registration"
        : p["results.edit"]
          ? "results"
          : p["rounds.confirm"]
            ? "rounds"
            : "settings";
  return <Navigate to={target} replace />;
}
const gate = (key: string, node: ReactNode) => (
  <CapabilityGate capability={key}>{node}</CapabilityGate>
);
const protect = (node: ReactNode) => <Protected>{node}</Protected>;
export const routeDefinitions = [
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Navigate to="/tournaments" replace /> },
      { path: "/tournaments", element: gate("catalog", <CatalogPage />) },
      { path: "/reference-cases", element: protect(<ReferenceCasesPage />) },
      {
        path: "/login",
        element: gate("accounts", <AccountPage mode="login" />),
      },
      {
        path: "/register",
        element: gate("accounts", <AccountPage mode="register" />),
      },
      { path: "/forgot-password", element: <AccountPage mode="recovery" /> },
      {
        path: "/me/profile",
        element: protect(gate("accounts", <AccountPage mode="profile" />)),
      },
      {
        path: "/me/tournaments",
        element: protect(gate("catalog", <MyTournaments />)),
      },
      {
        path: "/me/series",
        element: protect(gate("catalog", <SeriesPage mine />)),
      },
      {
        path: "/me/series/new",
        element: protect(gate("catalog", <MetadataPage kind="series" />)),
      },
      {
        path: "/me/series/:sid/edit",
        element: protect(gate("catalog", <MetadataPage kind="series" edit />)),
      },
      { path: "/series/:sid", element: gate("catalog", <SeriesPage />) },
      {
        path: "/tournaments/new",
        element: protect(gate("catalog", <MetadataPage kind="tournament" />)),
      },
      {
        path: "/tournaments/:tid",
        element: <TournamentLayout />,
        children: [
          { index: true, element: <TournamentOverview /> },
          { path: "stages", element: <PublicStages /> },
          { path: "schedule", element: <SchedulePage /> },
          {
            path: "registration",
            element: <OperationsPage kind="registration" publicRegistration />,
          },
          ...["matches", "standings", "results"].map((kind) => ({
            path: kind,
            element: <OperationsPage kind={kind} />,
          })),
        ],
      },
      {
        path: "/manage/:tid",
        element: protect(<TournamentLayout manage />),
        children: [
          { index: true, element: <ManageLanding /> },
          { path: "schedule", element: <SchedulePage manage /> },
          {
            path: "overview",
            element: gate("configuration", <ConfigurationList />),
          },
          {
            path: "settings",
            element: gate("catalog", <MetadataPage kind="tournament" edit />),
          },
          {
            path: "templates",
            element: gate("configuration", <TemplatesPage />),
          },
          {
            path: "configurations/:cid/:tab",
            element: gate("configuration", <ConfigurationPage />),
          },
          ...[
            "registration",
            "matches",
            "results",
            "rounds",
            "sanctions",
            "collaborators",
          ].map((kind) => ({
            path: kind,
            element: <OperationsPage kind={kind} />,
          })),
        ],
      },
      {
        path: "*",
        element: (
          <>
            <h1>页面不存在</h1>
            <p>请检查地址或返回赛事目录。</p>
            <Link to="/tournaments">返回赛事发现</Link>
          </>
        ),
      },
    ],
  },
];
export function createRouter() {
  return createBrowserRouter(routeDefinitions, {
    basename: workspacePrefix() || "/",
  });
}
