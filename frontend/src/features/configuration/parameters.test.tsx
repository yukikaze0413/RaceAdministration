import { afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ConfigurationList } from "./pages";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("creates an independent parameter configuration while retaining the legacy entry", async () => {
  const bodies: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: any, options: any = {}) => {
      if (options.method === "POST") {
        bodies.push(JSON.parse(options.body));
        return new Response(
          JSON.stringify({ data: { id: "new-config" }, requestId: "test" }),
        );
      }
      return new Response(JSON.stringify({ data: [], requestId: "test" }));
    }),
  );
  const router = createMemoryRouter(
    [
      { path: "/manage/:tid/overview", element: <ConfigurationList /> },
      {
        path: "/manage/:tid/configurations/:cid/stages",
        element: <p>参数草稿</p>,
      },
    ],
    { initialEntries: ["/manage/t1/overview"] },
  );
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole("button", { name: "新建赛制配置" }));
  await screen.findByText("参数草稿");
  expect(bodies[0].payload).toMatchObject({
    structureVersion: "structure-v2",
    routingVersion: "routing-v2",
    stages: [],
  });
});

import { ConfigurationPage } from "./pages";
import { catalog as catalogFixture } from "./format-catalog.fixture";
const catalog: any = catalogFixture;
it("TI candidate permits planning with fixed five rounds and explicitly pending runtime", async () => {
  renderConfiguration();
  fireEvent.change(await screen.findByLabelText("赛制"), {
    target: { value: "ti2026-observed-candidate-v1" },
  });
  expect(
    screen.getByText(
      "可保存参数、核验并冻结完整比赛计划；此规则的实际运行仍在接入。",
    ),
  ).toBeInTheDocument();
  expect(
    Array.from(
      (screen.getByLabelText("轮数") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["5"]);
  expect(
    Array.from(
      (screen.getByLabelText("每组人数") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["16"]);
  expect(
    Array.from(
      (screen.getByLabelText("每组晋级人数") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["8"]);
  expect(screen.queryByLabelText("添加轮次BO")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "添加排序字段" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "创建阶段" })).toBeEnabled();
});
it("Major offers only sixteen entrants/eight qualifiers, official sorting and BO1/3 profiles", async () => {
  renderConfiguration();
  fireEvent.change(await screen.findByLabelText("赛制"), {
    target: { value: "major-cologne-2026-v1" },
  });
  expect(
    Array.from(
      (screen.getByLabelText("每组人数") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["16"]);
  expect(
    Array.from(
      (screen.getByLabelText("每组晋级人数") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["8"]);
  expect(
    Array.from(
      (screen.getByLabelText("默认BO") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["1", "3"]);
  expect(
    screen.getByText("排名：胜负战绩 → 对手胜负差 → 初始种子"),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("添加轮次BO")).not.toBeInTheDocument();
  expect(screen.getByLabelText("淘汰战BO")).toHaveValue("3");
});
const emptyConfig = {
  id: "c1",
  tournamentId: "t1",
  version: 1,
  state: "draft",
  entrantKind: "individual",
  structureVersion: "structure-v2",
  routingVersion: "routing-v2",
  stages: [],
  pools: [],
  routes: [],
};
function renderConfiguration(
  configuration: any = emptyConfig,
  handler?: (url: string, options: any) => Response | Promise<Response>,
  readConfiguration?: () => any,
) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, options: any = {}) => {
      if (handler && options.method === "POST")
        return handler(String(url), options);
      const data = String(url).endsWith("/formats")
        ? catalog
        : readConfiguration
          ? readConfiguration()
          : configuration;
      return new Response(JSON.stringify({ data, requestId: "test" }));
    }),
  );
  const router = createMemoryRouter(
    [
      {
        path: "/manage/:tid/configurations/:cid/:tab",
        element: <ConfigurationPage />,
      },
    ],
    { initialEntries: ["/manage/t1/configurations/c1/stages"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
it("uses the server GSL defaults and displays total input/qualification before saving", async () => {
  let sent: any;
  renderConfiguration(emptyConfig, (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        data: {
          ...emptyConfig,
          version: 2,
          stages: [{ id: "s1", ...sent.stage, capacity: 16, groups: [] }],
        },
        requestId: "saved",
      }),
    );
  });
  const format = await screen.findByLabelText("赛制");
  fireEvent.change(format, { target: { value: "gsl-classic-v1" } });
  expect(screen.getByLabelText("每组人数")).toHaveValue("4");
  expect(screen.getByLabelText("小组数量")).toHaveValue("4");
  expect(screen.getByLabelText("每组晋级人数")).toHaveValue("2");
  expect(screen.getByText("总输入 16 人 · 总晋级 8 人")).toBeInTheDocument();
  expect(screen.queryByLabelText("决赛重置")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "创建阶段" }));
  await waitFor(() =>
    expect(sent.stage).toMatchObject({
      ruleVersion: "gsl-classic-v1",
      groupSize: 4,
      groupCount: 4,
      qualifyCount: 2,
    }),
  );
});

const gsl = catalog.formats.find(
  (d: any) => d.ruleVersion === "gsl-classic-v1",
);
const savedGsl = {
  ...emptyConfig,
  version: 4,
  stages: [
    {
      id: "s1",
      name: "小组赛",
      order: 1,
      format: "gsl",
      ruleVersion: "gsl-classic-v1",
      ...structuredClone(gsl.defaults),
      capacity: 16,
      groups: ["A", "B", "C", "D"].map((name) => ({
        id: "g" + name,
        stageId: "s1",
        capacity: 4,
      })),
    },
  ],
};
it("restores saved parameters and requires explicit shrinking approval while keeping cancelled edits", async () => {
  const writes: string[] = [];
  const proposed = {
    ...savedGsl.stages[0],
    groupCount: 2,
    capacity: 8,
    groups: savedGsl.stages[0].groups.slice(0, 2),
  };
  const report = {
    requiresConfirmation: true,
    confirmationToken: "review-token",
    proposedStage: proposed,
    removedGroupIds: ["gC", "gD"],
    affectedRouteIds: ["routeC"],
    affectedRegistrationIds: [],
    removedLayoutIds: [],
    retainedLayoutIds: [],
    affectedRuleStageIds: [],
    affectedMatchIds: [],
    blockers: [],
    validation: { diagnostics: [] },
  };
  renderConfiguration(savedGsl, (url, options) => {
    writes.push(url);
    return new Response(
      JSON.stringify({
        data: url.endsWith("/plan")
          ? report
          : { configuration: { ...savedGsl, version: 5, stages: [proposed] } },
        requestId: "saved",
      }),
    );
  });
  expect(await screen.findByLabelText("小组数量")).toHaveValue("4");
  fireEvent.change(screen.getByLabelText("小组数量"), {
    target: { value: "2" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "保存阶段" }));
  const dialog = await screen.findByRole("dialog", { name: "确认阶段修改" });
  expect(dialog).toHaveTextContent("C组");
  expect(dialog).toHaveTextContent("D组");
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(writes.filter((p) => p.endsWith("/apply"))).toHaveLength(0);
  expect(screen.getByLabelText("小组数量")).toHaveValue("2");
  fireEvent.click(await screen.findByRole("button", { name: "保存阶段" }));
  await screen.findByRole("dialog", { name: "确认阶段修改" });
  fireEvent.click(screen.getByRole("button", { name: "确认并保存" }));
  await screen.findByText("阶段已保存。");
  expect(writes.filter((p) => p.endsWith("/apply"))).toHaveLength(1);
});

it("offers legal single-elimination counts and format-specific advanced controls", async () => {
  renderConfiguration();
  const size = await screen.findByLabelText("每组人数");
  expect(
    Array.from((size as HTMLSelectElement).options).map((o) => o.value),
  ).toEqual(["2", "4", "8", "16", "32", "64"]);
  expect(
    Array.from(
      (screen.getByLabelText("每组晋级人数") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["1", "2", "4"]);
  fireEvent.change(screen.getByLabelText("赛制"), {
    target: { value: "de-lower-entry-v1" },
  });
  fireEvent.click(screen.getByText("高级赛制参数"));
  fireEvent.change(screen.getByLabelText("败者直接输入"), {
    target: { value: "half" },
  });
  expect(screen.getByText("总输入 12 人 · 总晋级 1 人")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("每组晋级人数"), {
    target: { value: "2" },
  });
  expect(screen.queryByLabelText("决赛重置")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("赛制"), {
    target: { value: "swiss-fixed-v1" },
  });
  expect(screen.getByLabelText("轮数")).toHaveValue("4");
  expect(screen.getByLabelText("胜局积分")).toHaveValue(3);
  expect(screen.queryByLabelText("败者直接输入")).not.toBeInTheDocument();
});

it("retains local values on 409 and compares the server before an explicit version recovery", async () => {
  let conflict = false,
    attempts = 0,
    applied: any;
  const latest = {
    ...savedGsl,
    version: 5,
    stages: [
      {
        ...savedGsl.stages[0],
        groupCount: 3,
        capacity: 12,
        groups: savedGsl.stages[0].groups.slice(0, 3),
      },
    ],
  };
  const report = {
    requiresConfirmation: true,
    confirmationToken: "new-review",
    proposedStage: { ...latest.stages[0], groupCount: 2, capacity: 8 },
    removedGroupIds: ["gC"],
    affectedRouteIds: [],
    affectedRegistrationIds: [],
    affectedRuleStageIds: [],
    affectedMatchIds: [],
    blockers: [],
  };
  renderConfiguration(
    savedGsl,
    (url, options) => {
      const body = JSON.parse(options.body);
      if (url.endsWith("/plan") && attempts++ === 0) {
        conflict = true;
        return new Response(
          JSON.stringify({
            error: {
              code: "VERSION_CONFLICT",
              message: "配置版本已变化",
              requestId: "conflict",
              retryable: false,
            },
          }),
          { status: 409 },
        );
      }
      if (url.endsWith("/apply")) applied = body;
      return new Response(
        JSON.stringify({
          data: url.endsWith("/plan")
            ? report
            : {
                configuration: {
                  ...latest,
                  version: 6,
                  stages: [report.proposedStage],
                },
              },
          requestId: "ok",
        }),
      );
    },
    () => (conflict ? latest : savedGsl),
  );
  await screen.findByLabelText("小组数量");
  fireEvent.change(screen.getByLabelText("小组数量"), {
    target: { value: "2" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "保存阶段" }));
  await screen.findByText("请处理版本或请求冲突");
  expect(screen.getByLabelText("小组数量")).toHaveValue("2");
  fireEvent.click(screen.getByRole("button", { name: "读取最新版本" }));
  await screen.findByText(/服务器版本 5/);
  expect(screen.getByLabelText("小组数量")).toHaveValue("2");
  fireEvent.click(
    screen.getByRole("button", { name: "保留我的输入，采用最新版本" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "保存阶段" }));
  await screen.findByRole("dialog", { name: "确认阶段修改" });
  fireEvent.click(screen.getByRole("button", { name: "确认并保存" }));
  await screen.findByText("阶段已保存。");
  expect(applied.expectedVersion).toBe(5);
});

it("retries the original mutation after a lost response instead of planning against a stale version", async () => {
  let first = true,
    plans = 0,
    firstKey = "";
  const proposed = {
    ...savedGsl.stages[0],
    parameters: { ...savedGsl.stages[0].parameters, defaultBO: 5 },
  };
  const report = {
    requiresConfirmation: false,
    proposedStage: proposed,
    removedGroupIds: [],
    affectedRouteIds: [],
    affectedRegistrationIds: [],
    affectedMatchIds: [],
    blockers: [],
  };
  renderConfiguration(savedGsl, (url, options) => {
    if (url.endsWith("/plan")) {
      plans++;
      if (plans > 1)
        return new Response(
          JSON.stringify({
            error: {
              code: "VERSION_CONFLICT",
              message: "已提交的版本改变",
              requestId: "changed",
              retryable: false,
            },
          }),
          { status: 409 },
        );
      return new Response(JSON.stringify({ data: report, requestId: "plan" }));
    }
    if (first) {
      first = false;
      firstKey = options.headers["Idempotency-Key"];
      throw new TypeError("lost response");
    }
    expect(options.headers["Idempotency-Key"]).toBe(firstKey);
    return new Response(
      JSON.stringify({
        data: {
          configuration: { ...savedGsl, version: 5, stages: [proposed] },
        },
        requestId: "cached",
      }),
    );
  });
  await screen.findByLabelText("默认BO");
  fireEvent.change(screen.getByLabelText("默认BO"), { target: { value: "5" } });
  fireEvent.click(await screen.findByRole("button", { name: "保存阶段" }));
  await screen.findByText("网络连接失败，请检查网络后重试。");
  expect(screen.getByLabelText("默认BO")).toHaveValue("5");
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText("阶段已保存。");
  expect(plans).toBe(1);
});

it("shows incomplete stored values honestly instead of replacing an invalid size or inventing fractional entrants", async () => {
  const definition = catalog.formats.find(
    (d: any) => d.ruleVersion === "de-lower-entry-v1",
  );
  const stage = {
    id: "s1",
    name: "待调整",
    order: 1,
    format: definition.format,
    ruleVersion: definition.ruleVersion,
    ...structuredClone(definition.defaults),
    groupSize: 3,
    capacity: null,
    groups: [{ id: "g1", stageId: "s1", capacity: null }],
  };
  stage.parameters.lowerEntryMode = "half";
  renderConfiguration({ ...emptyConfig, stages: [stage] });
  expect(await screen.findByLabelText("每组人数")).toHaveValue("3");
  expect(screen.getByText("人数待调整")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "保存阶段" })).toBeDisabled();
});
it("clears a now impossible third-place match and its BO when reducing to two entrants", async () => {
  let sent: any;
  renderConfiguration(emptyConfig, (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        data: {
          ...emptyConfig,
          stages: [{ id: "s1", ...sent.stage, groups: [] }],
        },
      }),
    );
  });
  await screen.findByLabelText("每组人数");
  fireEvent.click(screen.getByText("高级赛制参数"));
  fireEvent.click(screen.getByLabelText("季军战"));
  fireEvent.change(screen.getByLabelText("季军战BO"), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByLabelText("每组人数"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "创建阶段" }));
  await waitFor(() => expect(sent).toBeDefined());
  expect(sent.stage.parameters.thirdPlace).toBe(false);
  expect(sent.stage.parameters.overrides.thirdPlace).toBeUndefined();
});
it("blocks incomplete scoring parameters instead of offering an invalid save", async () => {
  renderConfiguration();
  await screen.findByLabelText("赛制");
  fireEvent.change(screen.getByLabelText("赛制"), {
    target: { value: "swiss-fixed-v1" },
  });
  fireEvent.click(screen.getByText("高级赛制参数"));
  fireEvent.change(await screen.findByLabelText("胜局积分"), {
    target: { value: "1" },
  });
  expect(screen.getByRole("button", { name: "创建阶段" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("高级参数");
});

it("lets a typed incomplete saved seed table be repaired explicitly", async () => {
  const incomplete = {
    ...savedGsl,
    stages: [
      {
        ...savedGsl.stages[0],
        parameters: {
          ...savedGsl.stages[0].parameters,
          seeding: { kind: "seed" },
        },
      },
    ],
  };
  renderConfiguration(incomplete);
  await screen.findByLabelText("小组数量");
  fireEvent.click(screen.getByText("高级赛制参数"));
  fireEvent.change(screen.getByLabelText("种子表"), {
    target: { value: "recursive-v1" },
  });
  expect(screen.getByRole("button", { name: "保存阶段" })).toBeEnabled();
});
it("repairs an incomplete ranking list without resetting unrelated parameters", async () => {
  const def = catalog.formats.find(
    (d: any) => d.ruleVersion === "swiss-fixed-v1",
  );
  const stage = {
    id: "s1",
    name: "瑞士",
    order: 1,
    format: def.format,
    ruleVersion: def.ruleVersion,
    ...structuredClone(def.defaults),
    capacity: 16,
    groups: [{ id: "g1", stageId: "s1", capacity: 16 }],
  };
  stage.parameters.defaultBO = 5;
  stage.parameters.tiebreakers = ["points"];
  renderConfiguration({ ...emptyConfig, stages: [stage] });
  await screen.findByLabelText("默认BO");
  fireEvent.click(screen.getByText("高级赛制参数"));
  fireEvent.click(screen.getByRole("button", { name: "恢复默认排序" }));
  expect(screen.getByRole("button", { name: "保存阶段" })).toBeEnabled();
  expect(screen.getByLabelText("默认BO")).toHaveValue("5");
});
