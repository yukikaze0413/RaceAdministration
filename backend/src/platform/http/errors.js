"use strict";
class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    Object.assign(this, { status, code, ...details });
  }
}
function reject(status, code, message, details) {
  throw new ApiError(status, code, message, details);
}
function fields(value, allowed, unknownStatus = 422) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    reject(400, "BAD_REQUEST", "请求必须为对象。");
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      reject(
        unknownStatus,
        unknownStatus === 400 ? "BAD_REQUEST" : "INVALID_INPUT",
        "请求包含不支持的字段。",
        {
          fieldErrors: [{ path: "/" + key, message: "未知字段" }],
        },
      );
}
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const codes = {
    INVALID_INPUT: 422,
    CONFIG_INVALID: 422,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VERSION_CONFLICT: 409,
    IDEMPOTENCY_CONFLICT: 409,
    STRUCTURE_FROZEN: 409,
    STORE_FAILURE: 503,
    RUN_NOT_SUPPORTED: 501,
  };
  const storageError = ["ERR_SQLITE_ERROR", "ERR_INVALID_STATE"].includes(
    error.code,
  );
  const status =
    error.type === "entity.too.large"
      ? 413
      : error.type === "entity.parse.failed"
        ? 400
        : error.status || codes[error.code] || (storageError ? 503 : 500);
  const code =
    error.type === "entity.too.large"
      ? "PAYLOAD_TOO_LARGE"
      : error.type === "entity.parse.failed"
        ? "BAD_REQUEST"
        : storageError
          ? (Number(error.errcode) & 255) === 5 ||
            error.code === "ERR_INVALID_STATE"
            ? "STORE_UNAVAILABLE"
            : "STORE_FAILURE"
          : status === 500
            ? "INTERNAL_ERROR"
            : error.code || "BAD_REQUEST";
  const message = storageError
    ? "数据存储暂不可用，请稍后重试。"
    : status === 500
      ? "服务发生异常，请稍后重试。"
      : status === 413
        ? "请求内容超过1MiB限制。"
        : error.type === "entity.parse.failed"
          ? "请求JSON格式无效。"
          : error.message;
  const details = {};
  for (const k of ["capability", "fieldErrors", "diagnostics"])
    if (error[k]) details[k] = error[k];
  if ([500, 503].includes(status))
    console.error(JSON.stringify({ requestId: req.requestId, status, code }));
  res.status(status).json({
    error: {
      code,
      message,
      requestId: req.requestId,
      retryable: [429, 500, 503].includes(status),
      ...details,
    },
  });
}
module.exports = { ApiError, reject, fields, errorHandler };
