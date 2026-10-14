"use strict";
const G = require("./graph");
const invalid = (reason) => G.fail(reason);
function strictInstant(value) {
  if (typeof value !== "string") return false;
  const m =
    /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,3})?)?(Z|[+-](\d\d):(\d\d))$/.exec(
      value,
    );
  if (!m) return false;
  const [y, month, day, hour, minute, second] = m
    .slice(1, 7)
    .map((x) => Number(x ?? 0));
  const date = new Date(0);
  date.setUTCFullYear(y, month - 1, day);
  return (
    y > 0 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    second < 60 &&
    Number(m[8] ?? 0) < 24 &&
    Number(m[9] ?? 0) < 60 &&
    Number.isFinite(Date.parse(value))
  );
}
function check(plan, sessions) {
  if (!Array.isArray(sessions) || sessions.length > 512)
    invalid("时段分组列表非法");
  const waves = new Map(plan.waves.map((w) => [w.id, w])),
    locations = new Map(),
    ids = new Set(),
    diagnostics = [];
  const diag = (code, reason, sessionId, severity = "error") =>
    diagnostics.push({ code, reason, sessionId, severity });
  for (const s of sessions) {
    if (
      !s ||
      typeof s !== "object" ||
      Object.keys(s).some(
        (k) => !["id", "name", "waveIds", "timeRange"].includes(k),
      )
    )
      invalid("时段分组字段非法");
    if (
      typeof s.id !== "string" ||
      !s.id ||
      s.id.length > 200 ||
      ids.has(s.id) ||
      typeof s.name !== "string" ||
      !s.name.trim() ||
      s.name.length > 200 ||
      !Array.isArray(s.waveIds) ||
      s.waveIds.length > plan.waves.length
    )
      invalid("时段分组身份或成员非法");
    ids.add(s.id);
    s.waveIds.forEach((id, index) => {
      if (!waves.has(id))
        diag("WAVE_REFERENCE_STALE", "批次引用已失效，请重新选择", s.id);
      else if (locations.has(id))
        diag("WAVE_DUPLICATE", "同一批次不能重复安排", s.id);
      else locations.set(id, { session: s, index });
    });
    if (s.timeRange !== undefined) {
      const range = s.timeRange;
      if (
        !range ||
        typeof range !== "object" ||
        Object.keys(range).some((k) => !["startAt", "endAt"].includes(k))
      )
        invalid("时间段字段非法");
      if (
        !strictInstant(range.startAt) ||
        !strictInstant(range.endAt) ||
        Date.parse(range.startAt) >= Date.parse(range.endAt)
      )
        diag(
          "TIME_RANGE_INVALID",
          "请输入有效且含 UTC 偏移的时间，结束须晚于开始",
          s.id,
        );
    } else if (s.waveIds.length)
      diag("TIME_PENDING", "时间段待确认", s.id, "warning");
  }
  for (const [id, to] of locations)
    for (const dep of waves.get(id).requiresWaveIds) {
      const from = locations.get(dep);
      if (!from) {
        diag(
          "PREDECESSOR_UNASSIGNED",
          "前置批次尚未安排",
          to.session.id,
          "warning",
        );
        continue;
      }
      if (from.session.id === to.session.id) {
        if (from.index >= to.index)
          diag(
            "SESSION_ORDER_CONFLICT",
            "前置批次必须排在当前批次之前",
            to.session.id,
          );
      } else if (!from.session.timeRange || !to.session.timeRange)
        diag(
          "SESSION_TIME_PENDING",
          "跨时段分组的前置顺序需要时间段",
          to.session.id,
          "warning",
        );
      else if (
        Date.parse(from.session.timeRange.endAt) >
        Date.parse(to.session.timeRange.startAt)
      )
        diag(
          "SESSION_TIME_CONFLICT",
          "前置时段分组尚未结束，当前分组不能开始",
          to.session.id,
        );
    }
  if (locations.size < waves.size)
    diag("WAVES_UNASSIGNED", "仍有批次待排期", null, "warning");
  if (sessions.some((s) => s.waveIds.length))
    diag("DURATION_PENDING", "缺少逐场时长，时间段容量待确认", null, "warning");
  return {
    valid: !diagnostics.some((d) => d.severity === "error"),
    timeReady: !diagnostics.length,
    diagnostics,
  };
}
module.exports = { check };
