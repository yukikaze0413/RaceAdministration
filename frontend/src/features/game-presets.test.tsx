import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MetadataForm } from "./catalog";
import "../shared/tournament-datetime";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const games = {
  items: [
    { id: "street-fighter-6", displayName: "街霸六", category: "fighting" },
    { id: "shadowverse", displayName: "影之诗", category: "card" },
  ],
};
const old = {
  id: "t",
  name: "旧赛事",
  description: "",
  game: "card",
  location: "",
  startsAt: null,
  seriesId: null,
  visibility: "private",
  version: 1,
};
function respond(data: any, status = 200) {
  return new Response(JSON.stringify({ data, requestId: "game" }), { status });
}
it("TC1 preset selection submits gameId with derived category and preserves old null selection", async () => {
  const payloads: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.body) {
        const body = JSON.parse(String(options.body));
        payloads.push(body);
        return respond({ ...old, ...body, version: 2 });
      }
      return respond(url.endsWith("/games") ? games : { items: [] });
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm kind="tournament" initial={old} />
    </MemoryRouter>,
  );
  const select = await screen.findByLabelText("游戏预设");
  expect(select).toHaveValue("");
  fireEvent.change(screen.getByLabelText("分类"), {
    target: { value: "fighting" },
  });
  fireEvent.change(select, { target: { value: "street-fighter-6" } });
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0].gameId).toBe("street-fighter-6");
  expect(payloads[0].game).toBe("fighting");
  expect(screen.getByLabelText("分类")).toHaveValue("fighting");
});

import { CatalogPage } from "./catalog";
it("TC2 game filter preserves classification intersection and renders game names", async () => {
  const reads: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      reads.push(url);
      return respond(
        url.endsWith("/games")
          ? games
          : {
              items: [{ ...old, gameId: "shadowverse", visibility: "public" }],
              total: 1,
              page: 1,
              pageSize: 20,
            },
      );
    }),
  );
  render(
    <MemoryRouter initialEntries={["/tournaments?game=card"]}>
      <CatalogPage />
    </MemoryRouter>,
  );
  const select = await screen.findByLabelText("筛选游戏");
  await screen.findByRole("option", { name: "影之诗" });
  fireEvent.change(select, { target: { value: "shadowverse" } });
  await waitFor(() =>
    expect(
      reads.some(
        (url) =>
          url.includes("gameId=shadowverse") && url.includes("game=card"),
      ),
    ).toBe(true),
  );
  expect(screen.getByText("影之诗 · 卡牌")).toBeInTheDocument();
});
it("GP3 failed game directory preserves current game and form during retry and save", async () => {
  const payloads: any[] = [];
  let failed = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.body) {
        const b = JSON.parse(String(options.body));
        payloads.push(b);
        return respond({ ...old, ...b, version: 2 });
      }
      if (url.endsWith("/games") && failed)
        return new Response(
          JSON.stringify({
            error: {
              code: "CATALOG_UNAVAILABLE",
              message: "游戏目录暂不可用",
              retryable: true,
            },
          }),
          { status: 503 },
        );
      return respond(url.endsWith("/games") ? games : { items: [] });
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm
        kind="tournament"
        initial={{ ...old, gameId: "shadowverse" }}
      />
    </MemoryRouter>,
  );
  await screen.findByText("游戏目录暂不可用");
  fireEvent.change(screen.getByLabelText("赛事名称"), {
    target: { value: "本地草稿" },
  });
  expect(screen.getByLabelText("游戏预设")).toHaveValue("shadowverse");
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0].gameId).toBe("shadowverse");
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() =>
    expect(screen.getByLabelText("游戏预设")).not.toBeDisabled(),
  );
  expect(screen.getByLabelText("赛事名称")).toHaveValue("本地草稿");
  expect(screen.getByLabelText("游戏预设")).toHaveValue("shadowverse");
});
it("TC1 unknown historical game stays visible and is omitted on unchanged edit", async () => {
  const payloads: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.body) {
        payloads.push(JSON.parse(String(options.body)));
        return respond({ ...old, gameId: "future-game", version: 2 });
      }
      return respond(url.endsWith("/games") ? games : { items: [] });
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm
        kind="tournament"
        initial={{ ...old, gameId: "future-game" }}
      />
    </MemoryRouter>,
  );
  await screen.findByRole("option", { name: /未知游戏（future-game）/ });
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0]).not.toHaveProperty("gameId");
});

it("mobile acceptance: classification precedes and narrows final game preset; switching classification clears stale selection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      respond(url.endsWith("/games") ? games : { items: [] }),
    ),
  );
  render(
    <MemoryRouter>
      <MetadataForm kind="tournament" initial={old} />
    </MemoryRouter>,
  );
  const category = await screen.findByLabelText("分类");
  await screen.findByRole("option", { name: "影之诗" });
  expect(
    screen.queryByRole("option", { name: "街霸六" }),
  ).not.toBeInTheDocument();
  const game = screen.getByLabelText("游戏预设");
  expect(
    category.compareDocumentPosition(game) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.change(category, { target: { value: "fighting" } });
  await screen.findByRole("option", { name: "街霸六" });
  expect(
    screen.queryByRole("option", { name: "影之诗" }),
  ).not.toBeInTheDocument();
  fireEvent.change(game, { target: { value: "street-fighter-6" } });
  fireEvent.change(category, { target: { value: "card" } });
  expect(game).toHaveValue("");
  expect(screen.getByRole("group", { name: "基本信息" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "比赛项目" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "时间与地点" })).toBeInTheDocument();
});
