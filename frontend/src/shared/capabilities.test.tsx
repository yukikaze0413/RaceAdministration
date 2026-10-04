import { afterEach, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CapabilityGate, CapabilityContext } from "./capabilities";
afterEach(cleanup);
it("unknown and unavailable capabilities fail closed before rendering forms", () => {
  const view = render(
    <CapabilityContext.Provider value={{ capabilities: {} }}>
      <CapabilityGate capability="configuration">
        <button>create</button>
      </CapabilityGate>
    </CapabilityContext.Provider>,
  );
  expect(screen.queryByText("create")).toBeNull();
  expect(screen.getByRole("alert")).toBeVisible();
  view.rerender(
    <CapabilityContext.Provider
      value={{
        capabilities: {
          configuration: { status: "unavailable", message: "未开放" },
        },
      }}
    >
      <CapabilityGate capability="configuration">
        <button>create</button>
      </CapabilityGate>
    </CapabilityContext.Provider>,
  );
  expect(screen.queryByText("create")).toBeNull();
});
