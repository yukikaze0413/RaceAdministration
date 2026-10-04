import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccountPage } from "./account";
import { SessionProvider } from "../app/session";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows password failure without a fake signed-in state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/session")
              ? { data: { user: null }, requestId: "s" }
              : {
                  error: {
                    code: "INVALID_CREDENTIALS",
                    message: "用户名或密码错误。",
                    retryable: false,
                    requestId: "l",
                  },
                },
          ),
          { status: url.endsWith("/session") ? 200 : 401 },
        ),
    ),
  );
  render(
    <MemoryRouter>
      <SessionProvider>
        <AccountPage mode="login" />
      </SessionProvider>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("用户名"), {
    target: { value: "alice" },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "wrong-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "登录" }));
  expect(await screen.findByText("用户名或密码错误。")).toBeVisible();
  expect(screen.queryByText("登录成功")).toBeNull();
});
