import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogPage } from "./catalog";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("renders actual empty catalog without invented statistics", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { items: [], page: 1, pageSize: 20, total: 0 },
            requestId: "c",
          }),
        ),
    ),
  );
  render(
    <MemoryRouter>
      <CatalogPage />
    </MemoryRouter>,
  );
  expect(await screen.findByText("没有符合条件的公开赛事。")).toBeVisible();
  expect(screen.queryByText("参赛人数")).toBeNull();
});
