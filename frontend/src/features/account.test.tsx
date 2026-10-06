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

it.each(["register", "login"] as const)(
  "accepts an unchanged nonempty password in the %s form without length gates",
  async (mode) => {
    const calls: Array<{ url: string; body: any }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options?: RequestInit) => {
        if (options?.body)
          calls.push({ url, body: JSON.parse(String(options.body)) });
        return new Response(
          JSON.stringify(
            url.endsWith("/session")
              ? { data: { user: null }, requestId: "s" }
              : {
                  error: {
                    code: "TEST_REJECTION",
                    message: "保留输入供测试核验。",
                    retryable: false,
                    requestId: "p",
                  },
                },
          ),
          { status: url.endsWith("/session") ? 200 : 422 },
        );
      }),
    );
    render(
      <MemoryRouter>
        <SessionProvider>
          <AccountPage mode={mode} />
        </SessionProvider>
      </MemoryRouter>,
    );
    const input = screen.getByLabelText("密码");
    expect(input).not.toHaveAttribute("minlength");
    expect(input).not.toHaveAttribute("maxlength");
    expect(input).toBeRequired();
    fireEvent.change(screen.getByLabelText("用户名"), {
      target: { value: "password_user" },
    });
    if (mode === "register")
      fireEvent.change(screen.getByLabelText("显示名"), {
        target: { value: "密码测试" },
      });
    for (const password of [
      "x",
      "p".repeat(12),
      "p".repeat(129),
      "p".repeat(1025),
      "密碼🎮é",
      "  password  ",
      " ",
    ]) {
      fireEvent.change(input, { target: { value: password } });
      fireEvent.click(
        screen.getByRole("button", {
          name: mode === "login" ? "登录" : "创建账号",
        }),
      );
      await screen.findByText("保留输入供测试核验。");
      await vi.waitFor(() =>
        expect(
          screen.getByRole("button", {
            name: mode === "login" ? "登录" : "创建账号",
          }),
        ).not.toBeDisabled(),
      );
      expect(calls.at(-1)?.body.password).toBe(password);
      expect(input).toHaveValue(password);
    }
    expect(calls).toHaveLength(7);
    fireEvent.change(input, { target: { value: "" } });
    expect((input as HTMLInputElement).validity.valueMissing).toBe(true);
    fireEvent.click(
      screen.getByRole("button", {
        name: mode === "login" ? "登录" : "创建账号",
      }),
    );
    expect(calls).toHaveLength(7);
  },
);
