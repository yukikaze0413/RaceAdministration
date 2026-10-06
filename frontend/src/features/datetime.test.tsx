import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MetadataForm } from "./catalog";
import "../shared/tournament-datetime";
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
  vi.unstubAllGlobals();
});
it("DT1 replaces manual ISO entry with Chinese calendar and explicit fixed offset; name-only save preserves original milliseconds", async () => {
  const payloads: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.body) payloads.push(JSON.parse(String(options.body)));
      return new Response(
        JSON.stringify({
          data: options?.body ? { version: 2 } : { items: [] },
          requestId: "date",
        }),
      );
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm
        kind="tournament"
        initial={{
          id: "t",
          name: "旧赛事",
          description: "",
          game: "card",
          location: "",
          startsAt: "2026-10-05T02:30:47.123Z",
          seriesId: null,
          visibility: "private",
          version: 1,
        }}
      />
    </MemoryRouter>,
  );
  const input = await screen.findByLabelText("开始日期时间");
  expect(input).toHaveValue("2026-10-05 10:30");
  expect(screen.getByLabelText("时区")).toHaveValue("480");
  fireEvent.change(screen.getByLabelText("赛事名称"), {
    target: { value: "改名称" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0].startsAt).toBe("2026-10-05T02:30:47.123Z");
});

it("DT2 switching fixed offsets preserves the instant and missing offset blocks save", async () => {
  const payloads: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.body) payloads.push(JSON.parse(String(options.body)));
      return new Response(
        JSON.stringify({
          data: options?.body ? { version: 2 } : { items: [] },
          requestId: "date",
        }),
      );
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm
        kind="tournament"
        initial={{
          id: "t",
          name: "旧赛事",
          description: "",
          game: "card",
          location: "",
          startsAt: "2026-10-05T02:30:47.123Z",
          seriesId: null,
          visibility: "private",
          version: 1,
        }}
      />
    </MemoryRouter>,
  );
  const input = await screen.findByLabelText("开始日期时间");
  fireEvent.change(screen.getByLabelText("时区"), {
    target: { value: "-240" },
  });
  expect(screen.getByLabelText("开始日期时间")).toHaveValue("2026-10-04 22:30");
  fireEvent.change(screen.getByLabelText("时区"), {
    target: { value: "" },
  });
  expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("时区"), {
    target: { value: "-240" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0].startsAt).toBe("2026-10-05T02:30:47.123Z");
});
it("DT1 clearing submits null instead of silently inventing a time", async () => {
  const payloads: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.body) payloads.push(JSON.parse(String(options.body)));
      return new Response(
        JSON.stringify({
          data: options?.body ? { version: 2 } : { items: [] },
          requestId: "date",
        }),
      );
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm
        kind="tournament"
        initial={{
          id: "t",
          name: "旧赛事",
          description: "",
          game: "card",
          location: "",
          startsAt: "2026-10-05T02:30:47.123Z",
          seriesId: null,
          visibility: "private",
          version: 1,
        }}
      />
    </MemoryRouter>,
  );
  await screen.findByLabelText("开始日期时间");
  fireEvent.click(screen.getByRole("button", { name: "清空开始时间" }));
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0].startsAt).toBeNull();
});
it("DT2 invalid wall input is kept visible and blocks the write", async () => {
  const writes: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.body) writes.push(options.body);
      return new Response(
        JSON.stringify({ data: { items: [] }, requestId: "date" }),
      );
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm
        kind="tournament"
        initial={{
          id: "t",
          name: "旧赛事",
          description: "",
          game: "card",
          location: "",
          startsAt: null,
          seriesId: null,
          visibility: "private",
          version: 1,
        }}
      />
    </MemoryRouter>,
  );
  const input = await screen.findByLabelText("开始日期时间");
  fireEvent.input(input, { target: { value: "2026-02-30 10:30:00.000" } });
  expect(input).toHaveValue("2026-02-30 10:30:00.000");
  expect(screen.getByRole("button", { name: "保存资料" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "请输入有效的日期和时间。",
  );
  expect(writes).toHaveLength(0);
});
it("DT2 version reread keeps local date and offset until explicit server replacement", async () => {
  const old = {
    id: "t",
    name: "旧赛事",
    description: "",
    game: "card",
    location: "",
    startsAt: "2026-10-05T02:30:47.123Z",
    seriesId: null,
    visibility: "private",
    version: 1,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      const failed = options?.method === "PATCH";
      return new Response(
        JSON.stringify(
          failed
            ? {
                error: {
                  code: "VERSION_CONFLICT",
                  message: "资料版本已变化，请重新读取。",
                  retryable: false,
                },
              }
            : {
                data: url.endsWith("/tournaments/t")
                  ? {
                      ...old,
                      name: "服务器",
                      startsAt: "2026-10-05T03:45:00.000Z",
                      version: 2,
                    }
                  : { items: [] },
                requestId: "date",
              },
        ),
        { status: failed ? 409 : 200 },
      );
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm kind="tournament" initial={old} />
    </MemoryRouter>,
  );
  const input = await screen.findByLabelText("开始日期时间");
  fireEvent.change(screen.getByLabelText("时区"), {
    target: { value: "-240" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await screen.findByText("资料版本已变化，请重新读取。");
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText(/本地输入保留/);
  expect(screen.getByLabelText("开始日期时间")).toHaveValue("2026-10-04 22:30");
  expect(screen.getByLabelText("时区")).toHaveValue("-240");
  fireEvent.click(screen.getByRole("button", { name: "确认使用服务器资料" }));
  await waitFor(() =>
    expect(screen.getByLabelText("开始日期时间")).toHaveValue(
      "2026-10-05 11:45",
    ),
  );
  expect(screen.getByLabelText("时区")).toHaveValue("480");
});

it("DT2 current-time shortcut uses selected +08 wall time, including crossing midnight", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-06T16:30:00.000Z"));
  const payloads: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.body) payloads.push(JSON.parse(String(options.body)));
      return new Response(
        JSON.stringify({
          data: options?.body ? { version: 2 } : { items: [] },
          requestId: "now",
        }),
      );
    }),
  );
  render(
    <MemoryRouter>
      <MetadataForm
        kind="tournament"
        initial={{
          id: "t",
          name: "当前时间",
          description: "",
          game: "card",
          location: "",
          startsAt: null,
          seriesId: null,
          visibility: "private",
          version: 1,
        }}
      />
    </MemoryRouter>,
  );
  fireEvent.focus(await screen.findByLabelText("开始日期时间"));
  fireEvent.click(await screen.findByText("此刻"));

  await waitFor(() =>
    expect(screen.getByLabelText("开始日期时间")).toHaveValue(
      "2026-10-07 00:30",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0].startsAt).toBe("2026-10-06T16:30:00.000Z");
  vi.restoreAllMocks();
});
