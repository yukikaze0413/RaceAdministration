import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiFailure } from "./api";
import { ErrorNotice, useResource } from "./ui";
import { useWrite } from "./write";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it.each([401, 403, 404, 409, 422, 429, 500, 501, 503])(
  "retains errors %i and offers recovery without showing success",
  (status) => {
    render(
      <MemoryRouter>
        <ErrorNotice
          error={
            new ApiFailure("可读原因", {
              status,
              code: "CODE",
              requestId: "safe-r",
              retryable: status >= 500,
            })
          }
          onRetry={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("可读原因");
    expect(screen.getByText("safe-r")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeEnabled();
  },
);
it("isolates a late response after route parameters change", async () => {
  let resolveA!: (v: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.endsWith("/a")
        ? new Promise((r) => (resolveA = r))
        : Promise.resolve(
            new Response(JSON.stringify({ data: "B", requestId: "b" })),
          ),
    ),
  );
  function View({ path }: { path: string }) {
    const r = useResource<string>(path);
    return <p>{r.data ?? "loading"}</p>;
  }
  const { rerender } = render(<View path="/a" />);
  rerender(<View path="/b" />);
  expect(await screen.findByText("B")).toBeVisible();
  resolveA(new Response(JSON.stringify({ data: "A", requestId: "a" })));
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByText("A")).toBeNull();
});
it("write retries preserve the request key and payload changes replace it", async () => {
  const requests: any[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: any) => {
      requests.push(options);
      throw TypeError("response lost");
    }),
  );
  function View() {
    const w = useWrite();
    return (
      <>
        <button onClick={() => w.run("/save", "PUT", { version: 1 })}>
          save
        </button>
        <button onClick={() => w.run("/save", "PUT", { version: 2 })}>
          edit
        </button>
        {w.error && <p>unconfirmed</p>}
      </>
    );
  }
  render(<View />);
  fireEvent.click(screen.getByText("save"));
  await screen.findByText("unconfirmed");
  fireEvent.click(screen.getByText("save"));
  await screen.findByText("unconfirmed");
  fireEvent.click(screen.getByText("edit"));
  await screen.findByText("unconfirmed");
  expect(requests[0].headers["Idempotency-Key"]).toBe(
    requests[1].headers["Idempotency-Key"],
  );
  expect(requests[2].headers["Idempotency-Key"]).not.toBe(
    requests[0].headers["Idempotency-Key"],
  );
});
