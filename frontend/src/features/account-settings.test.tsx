import { afterEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccountPage } from "./account";
import { SessionProvider, Protected } from "../app/session";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("shows current account first and opens only the chosen edit, cancel does not save", async () => {
  const user = {
      id: "fixed-user-id",
      username: "current_user",
      displayName: "当前名称",
      avatarUrl: null,
    },
    calls: any[] = [];
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.body) {
        const body = JSON.parse(String(options.body));
        calls.push(body);
        Object.assign(user, body);
      }
      return new Response(
        JSON.stringify({
          data: url.endsWith("/session") ? { user } : { ...user },
          requestId: "account",
        }),
      );
    }),
  );
  render(
    <MemoryRouter>
      <SessionProvider>
        <Protected>
          <AccountPage mode="profile" />
        </Protected>
      </SessionProvider>
    </MemoryRouter>,
  );
  await screen.findByText("fixed-user-id");
  expect(screen.getByText("当前名称", { exact: true })).toBeVisible();
  expect(screen.getByText("current_user", { exact: true })).toBeVisible();
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "修改名称" }));
  const dialog = await screen.findByRole("dialog", { name: "修改名称" });
  fireEvent.change(within(dialog).getByLabelText("显示名"), {
    target: { value: "未保存草稿" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
  expect(calls).toHaveLength(0);
  expect(screen.getByText("当前名称", { exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "修改名称" }));
  expect(await screen.findByLabelText("显示名")).toHaveValue("当前名称");
  fireEvent.change(screen.getByLabelText("显示名"), {
    target: { value: "新的名称" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存个人资料" }));
  await screen.findByText("个人资料已保存。");
  expect(calls).toEqual([{ displayName: "新的名称" }]);
  expect(screen.getByText("新的名称", { exact: true })).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("can cancel a pending deletion preview and ignores its late response in the next edit", async () => {
  const user = {
    id: "preview-user",
    username: "preview_user",
    displayName: "当前名称",
    avatarUrl: null,
  };
  let finishPreview!: (response: Response) => void;
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/deletion-preview"))
        return new Promise<Response>((resolve) => {
          finishPreview = resolve;
        });
      return new Response(
        JSON.stringify({ data: { user }, requestId: "session" }),
      );
    }),
  );
  render(
    <MemoryRouter>
      <SessionProvider>
        <Protected>
          <AccountPage mode="profile" />
        </Protected>
      </SessionProvider>
    </MemoryRouter>,
  );
  await screen.findByText("preview-user");
  fireEvent.click(screen.getByRole("button", { name: "删除账号" }));
  const deletion = await screen.findByRole("dialog", { name: "删除账号" });
  const cancel = within(deletion).getByRole("button", { name: "取消" });
  expect(cancel).not.toBeDisabled();
  fireEvent.click(cancel);
  fireEvent.click(screen.getByRole("button", { name: "修改名称" }));
  await screen.findByRole("dialog", { name: "修改名称" });
  finishPreview(
    new Response(
      JSON.stringify({
        data: { token: "old-token", counts: { tournaments: 99 } },
        requestId: "old",
      }),
    ),
  );
  await vi.waitFor(() =>
    expect(
      screen.getByRole("button", { name: "保存个人资料" }),
    ).not.toBeDisabled(),
  );
  expect(screen.getByLabelText("显示名")).toHaveValue("当前名称");
  expect(screen.queryByText("99")).toBeNull();
});
