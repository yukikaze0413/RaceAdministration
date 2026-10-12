import { workspacePrefix } from "./workspace";
let identityGeneration = 0;
export function invalidateIdentityRequests() {
  identityGeneration++;
}
export type Diagnostic = {
  code: string;
  severity: string;
  objectId?: string;
  routeId?: string;
  path: string;
  reason: string;
  details?: unknown;
};
export class ApiFailure extends Error {
  status = 0;
  code = "NETWORK_ERROR";
  requestId?: string;
  retryable = true;
  retryAfter = 0;
  capability?: string;
  fieldErrors?: { path: string; message: string }[];
  diagnostics?: Diagnostic[];
  constructor(message: string, details: Partial<ApiFailure> = {}) {
    super(message);
    Object.assign(this, details);
  }
}
export async function api<T = any>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    signal?: AbortSignal;
    timeout?: number;
  } = {},
): Promise<T> {
  const generation = identityGeneration,
    controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeout ?? 10000);
  try {
    const response = await fetch(workspacePrefix() + "/api/v1" + path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    let value: any;
    try {
      value = await response.json();
    } catch {
      throw new ApiFailure("服务返回了无法识别的响应，请重新检查。", {
        code: "BAD_RESPONSE",
        status: response.status,
      });
    }
    if (!response.ok) {
      if (!value?.error?.code || typeof value.error.message !== "string")
        throw new ApiFailure("服务错误响应格式无效。", {
          code: "BAD_RESPONSE",
          status: response.status,
        });
      const error = new ApiFailure(value.error.message, {
        ...value.error,
        status: response.status,
        retryAfter: Number(response.headers.get("Retry-After")) || 0,
      });
      if (response.status === 401 && error.code === "AUTH_REQUIRED") {
        if (generation !== identityGeneration || options.signal?.aborted)
          throw new DOMException("旧会话请求已失效", "AbortError");
        window.dispatchEvent(new Event("session-expired"));
      }
      throw error;
    }
    if (
      !value ||
      !Object.hasOwn(value, "data") ||
      typeof value.requestId !== "string"
    )
      throw new ApiFailure("服务响应缺少必要信息。", {
        code: "BAD_RESPONSE",
        status: response.status,
      });
    return value.data as T;
  } catch (e) {
    if (e instanceof ApiFailure) throw e;
    if (e instanceof DOMException && e.name === "AbortError" && !timedOut)
      throw e;
    if (options.signal?.aborted)
      throw new DOMException("请求已取消", "AbortError");
    throw new ApiFailure(
      timedOut
        ? "请求超时，结果尚未确认。请重新读取或使用原请求重试。"
        : "网络连接失败，请检查网络后重试。",
      { code: timedOut ? "TIMEOUT" : "NETWORK_ERROR" },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
export function failure(e: unknown) {
  return e instanceof ApiFailure
    ? e
    : new ApiFailure("发生未预期的错误，请重新加载。", {
        code: "CLIENT_ERROR",
      });
}
export function requestKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
