import { afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MatchCard, StartPanel } from "./competition";
import { TiOpponentChoice, TiRoundConfirmation } from "./ti-runtime";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("TI result editor blocks inconsistent winners before sending", () => {
  writes();
  const m = {
      id: "m",
      entrants: ["a", "b"],
      bestOf: 3,
      submissions: [],
      decision: {
        kind: "score",
        scores: [2, 0],
        games: [
          { winnerId: "a", durationSeconds: 100 },
          { winnerId: "b", durationSeconds: 100 },
        ],
      },
    },
    round = { id: "r", phase: "swiss", matches: [m] },
    u = {
      ruleVersion: "ti2026-observed-candidate-v1",
      format: "threshold-swiss",
      rounds: [round],
      rule: { bestOf: 3 },
    };
  render(
    <MatchCard
      m={m}
      round={round}
      u={u}
      data={data}
      base="/tournaments/t"
      onSaved={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "裁定赛果" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "逐局胜数与系列比分不一致",
  );
});
it("TI conflict retains the whole local draft and explicitly adopts server metadata", async () => {
  const sent: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: any, options: any) => {
      sent.push(JSON.parse(options.body));
      return sent.length === 1
        ? new Response(
            JSON.stringify({
              error: {
                code: "VERSION_CONFLICT",
                message: "版本变化",
                requestId: "conflict",
              },
            }),
            { status: 409 },
          )
        : new Response(
            JSON.stringify({ data: { version: 9 }, requestId: "saved" }),
          );
    }),
  );
  const m: any = {
      id: "m",
      entrants: ["a", "b"],
      bestOf: 3,
      submissions: [],
      decision: {
        kind: "score",
        scores: [2, 0],
        seriesId: "local-series",
        games: [
          { matchId: "old1", winnerId: "a", durationSeconds: 100 },
          { matchId: "old2", winnerId: "a", durationSeconds: 100 },
        ],
      },
    },
    round: any = { id: "r", phase: "swiss", matches: [m] },
    u: any = {
      ruleVersion: "ti2026-observed-candidate-v1",
      format: "threshold-swiss",
      rounds: [round],
      rule: { bestOf: 3 },
    };
  const show = (match: any, d: any) => (
    <MatchCard
      m={match}
      round={round}
      u={u}
      data={d}
      base="/tournaments/t"
      onSaved={() => {}}
    />
  );
  const view = render(show(m, data));
  fireEvent.change(screen.getByLabelText("裁定原因"), {
    target: { value: "本地确认" },
  });
  fireEvent.click(screen.getByRole("button", { name: "裁定赛果" }));
  await screen.findByText("请处理版本或请求冲突");
  const server = {
    ...m,
    decision: {
      kind: "score",
      scores: [0, 2],
      seriesId: "server-series",
      reason: "服务器确认",
      games: [
        { matchId: "new1", winnerId: "b", durationSeconds: 200 },
        { matchId: "new2", winnerId: "b", durationSeconds: 300 },
      ],
    },
  };
  view.rerender(show(server, { ...data, version: 8 }));
  expect(screen.getByLabelText("左方比分")).toHaveValue(2);
  expect(screen.getByLabelText("第1局胜者")).toHaveValue("a");
  expect(screen.getByText("服务器当前赛果：0 : 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "采用服务器赛果" }));
  expect(screen.getByLabelText("左方比分")).toHaveValue(0);
  expect(screen.getByLabelText("第1局胜者")).toHaveValue("b");
  fireEvent.click(screen.getByRole("button", { name: "裁定赛果" }));
  await waitFor(() => expect(sent).toHaveLength(2));
  expect(sent[1]).toMatchObject({
    expectedVersion: 8,
    result: server.decision.kind && {
      kind: "score",
      scores: [0, 2],
      seriesId: "server-series",
      games: server.decision.games,
    },
  });
});
it("unavailable frozen v2 configuration cannot be started from the preparation panel", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: any) =>
        new Response(
          JSON.stringify({
            data: String(url).endsWith("/configurations")
              ? [
                  {
                    id: "c",
                    state: "structure-frozen",
                    structureVersion: "structure-v2",
                    snapshot: { runtimeReady: false },
                  },
                ]
              : { structureVersion: "structure-v2", items: [] },
            requestId: "test",
          }),
        ),
    ),
  );
  render(
    <StartPanel
      data={{
        version: 1,
        locked: true,
        rules: {},
        permissions: { "structure.edit": true },
      }}
      base="/tournaments/t"
      onSaved={() => {}}
    />,
  );
  await screen.findByText("自定义 · c");
  fireEvent.change(screen.getByLabelText("开赛配置"), {
    target: { value: "c" },
  });
  expect(screen.getByRole("button", { name: "开始赛事" })).toBeDisabled();
  expect(
    screen.getByText(
      "该配置包含尚未开放运行的规则，当前可验收计划与时间编排。",
    ),
  ).toBeInTheDocument();
});
const data: any = {
  version: 7,
  permissions: { "results.edit": true },
  runtime: {
    roster: [
      { entrantId: "a", name: "甲" },
      { entrantId: "b", name: "乙" },
      { entrantId: "c", name: "丙" },
    ],
  },
};
function writes() {
  const bodies: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: any, options: any) => {
      bodies.push(JSON.parse(options.body));
      return new Response(
        JSON.stringify({ data: { version: 8 }, requestId: "test" }),
      );
    }),
  );
  return bodies;
}
it("TI Swiss result editor writes actual game winners and duration with stable hidden identifiers", async () => {
  const sent = writes();
  const m = {
      id: "series-1",
      entrants: ["a", "b"],
      submissions: [],
      decision: null,
      bestOf: 3,
    },
    round = { id: "r", phase: "swiss", confirmed: false, matches: [m] },
    u = {
      ruleVersion: "ti2026-observed-candidate-v1",
      format: "threshold-swiss",
      rounds: [round],
      rule: { bestOf: 3 },
    };
  render(
    <MatchCard
      m={m}
      round={round}
      u={u}
      data={data}
      base="/tournaments/t"
      onSaved={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("左方比分"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("右方比分"), {
    target: { value: "1" },
  });
  for (let i = 1; i <= 3; i++) {
    fireEvent.change(screen.getByLabelText(`第${i}局胜者`), {
      target: { value: i === 2 ? "b" : "a" },
    });
    fireEvent.change(screen.getByLabelText(`第${i}局时长（秒）`), {
      target: { value: String(100 * i) },
    });
  }
  fireEvent.change(screen.getByLabelText("裁定原因"), {
    target: { value: "核验逐局记录" },
  });
  expect(screen.queryByLabelText("双方判负")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "裁定赛果" }));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0].result).toEqual({
    kind: "score",
    scores: [2, 1],
    seriesId: "series-1",
    games: [
      { matchId: "series-1/game/1", winnerId: "a", durationSeconds: 100 },
      { matchId: "series-1/game/2", winnerId: "b", durationSeconds: 200 },
      { matchId: "series-1/game/3", winnerId: "a", durationSeconds: 300 },
    ],
  });
});
it("TI opponent choice excludes assigned opponents and submits current version/hash with explicit reason", async () => {
  const sent = writes();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const u: any = {
    id: "g",
    version: 3,
    inputHash: "current",
    elimination: {
      choosers: [{ entrantId: "a" }, { entrantId: "c" }],
      opponents: [{ entrantId: "b" }, { entrantId: "a" }],
      selections: [{ entrantIds: ["a", "b"] }],
    },
  };
  render(
    <TiOpponentChoice
      u={u}
      data={data}
      base="/tournaments/t"
      onSaved={() => {}}
    />,
  );
  expect(screen.getByText("当前选择队伍：丙")).toBeInTheDocument();
  expect(
    Array.from(
      (screen.getByLabelText("附加赛对手") as HTMLSelectElement).options,
    ).map((o) => o.value),
  ).toEqual(["", "a"]);
  fireEvent.change(screen.getByLabelText("附加赛对手"), {
    target: { value: "a" },
  });
  fireEvent.change(screen.getByLabelText("选择原因"), {
    target: { value: "明确选择" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认附加赛对手" }));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toMatchObject({
    expectedVersion: 7,
    inputVersion: 3,
    inputHash: "current",
    chooserId: "c",
    opponentId: "a",
    reason: "明确选择",
  });
});
it("TI confirmation requires audited reason and all current decisions", async () => {
  const sent = writes();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(
    <TiRoundConfirmation
      u={{ version: 4, inputHash: "current" }}
      round={{
        id: "r",
        matches: [{ decision: { kind: "score", scores: [2, 0] } }],
      }}
      data={data}
      base="/tournaments/t"
      onSaved={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "确认整轮并推进" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("TI整轮确认原因"), {
    target: { value: "逐局完整" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认整轮并推进" }));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toMatchObject({
    expectedVersion: 7,
    inputVersion: 4,
    inputHash: "current",
    reason: "逐局完整",
  });
});
