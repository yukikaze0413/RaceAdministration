import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiFailure } from "./api";
afterEach(() => vi.unstubAllGlobals());
describe("API error boundary", () => {
  it("preserves structured 501 details and retry delay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "FEATURE_NOT_IMPLEMENTED",
                message: "报名暂不可用",
                requestId: "req-1",
                capability: "registration",
                retryable: false,
              },
            }),
            {
              status: 501,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "60",
              },
            },
          ),
      ),
    );
    await expect(api("/x")).rejects.toMatchObject({
      status: 501,
      code: "FEATURE_NOT_IMPLEMENTED",
      requestId: "req-1",
      retryAfter: 60,
    });
  });
  it("rejects a successful HTML response instead of treating it as empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>wrong</html>", { status: 200 })),
    );
    await expect(api("/x")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
  it("keeps HTTP200 domain diagnostics available to the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                structureValid: false,
                diagnostics: [{ reason: "容量不足" }],
              },
              requestId: "r",
            }),
          ),
      ),
    );
    const r = await api<any>("/x");
    expect(r.structureValid).toBe(false);
    expect(r.diagnostics).toHaveLength(1);
  });
  it("turns an offline request into a recoverable network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw TypeError("offline");
      }),
    );
    await expect(api("/x")).rejects.toBeInstanceOf(ApiFailure);
    await expect(api("/x")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      retryable: true,
    });
  });
});
it("does not let a late 401 from a previous identity expire the new session", async () => {
  let finish!: (r: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise((r) => (finish = r))),
  );
  const expired = vi.fn();
  window.addEventListener("session-expired", expired);
  const { invalidateIdentityRequests } = await import("./api");
  const pending = api("/private");
  invalidateIdentityRequests();
  finish(
    new Response(
      JSON.stringify({
        error: { code: "AUTH_REQUIRED", message: "expired", requestId: "old" },
      }),
      { status: 401 },
    ),
  );
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(expired).not.toHaveBeenCalled();
  window.removeEventListener("session-expired", expired);
});
it("can keep an unsaved editor mounted on auth failure without accepting the write", async () => {
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:{code:"AUTH_REQUIRED",message:"expired",retryable:false}}),{status:401})));
  const expired=vi.fn();window.addEventListener("session-expired",expired);
  try {
    await expect(api("/draft",{deferSessionExpiry:true})).rejects.toMatchObject({status:401,code:"AUTH_REQUIRED",retryable:false});
    expect(expired).not.toHaveBeenCalled();
  } finally {window.removeEventListener("session-expired",expired);}
});
it("rejects a successful response after the active identity changes", async () => {
  let finish!: (response:Response)=>void;
  vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(done=>finish=done)));
  const pending=api("/draft",{deferSessionExpiry:true});
  const {invalidateIdentityRequests}=await import("./api");invalidateIdentityRequests();
  finish(new Response(JSON.stringify({data:{id:"old-owner-draft"},requestId:"old"}),{status:200}));
  await expect(pending).rejects.toMatchObject({name:"AbortError"});
});
it("timeouts remain distinguishable from offline failures", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, options: any) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        ),
    ),
  );
  await expect(api("/slow", { timeout: 5 })).rejects.toMatchObject({
    code: "TIMEOUT",
    retryable: true,
  });
});
