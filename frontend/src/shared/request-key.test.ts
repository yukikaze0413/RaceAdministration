import { afterEach, expect, it, vi } from "vitest";
import { requestKey } from "./api";
afterEach(() => vi.unstubAllGlobals());
it("HTTP LAN request keys work without secure-context randomUUID and remain unique", () => {
  const native = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: native.getRandomValues.bind(native),
  });
  const a = requestKey(),
    b = requestKey();
  expect(a).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(a).not.toBe(b);
});
