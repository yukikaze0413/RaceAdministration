"use strict";
const { fields, reject } = require("../http/errors");
function invalid(message) {
  reject(422, "SCHEDULE_INVALID", message);
}
function text(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    invalid(label + "无效。");
  return value;
}
function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    invalid(label + "超出范围。");
  return value;
}
function list(value, label, max) {
  if (!Array.isArray(value) || value.length > max)
    invalid(label + "列表无效。");
  return value;
}
function unique(values, label) {
  if (new Set(values).size !== values.length) invalid(label + "引用重复。");
}
function instant(value) {
  text(value, "开始时间", 50);
  const match = value.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/,
    ),
    ms = Date.parse(value);
  if (!match || !Number.isFinite(ms))
    invalid("开始时间必须为带时区的合法ISO时间。");
  const zone = match[6],
    offset =
      zone === "Z"
        ? 0
        : (zone[0] === "-" ? -1 : 1) *
          (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  if (
    Math.abs(offset) > 840 ||
    (zone !== "Z" && Number(zone.slice(4, 6)) >= 60) ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    Number(match[4] ?? 0) > 59
  )
    invalid("开始时间的时区或时刻无效。");
  const local = new Date(ms + offset * 60000).toISOString();
  if (
    local.slice(0, 10) !== match[1] ||
    local.slice(11, 16) !== match[2] + ":" + match[3]
  )
    invalid("开始日期无效。");
  return new Date(ms).toISOString();
}
function parseSchedule(value) {
  fields(value, ["configurationId", "windows", "resources", "assignments"]);
  const configurationId = text(value.configurationId, "配置ID");
  const resources = list(value.resources, "资源", 256).map((r) => {
    fields(r, ["id", "name"]);
    return { id: text(r.id, "资源ID"), name: text(r.name, "资源名称") };
  });
  unique(
    resources.map((r) => r.id),
    "资源",
  );
  const windows = list(value.windows, "窗口", 4096).map((w) => {
    fields(w, [
      "id",
      "planKey",
      "name",
      "startsAt",
      "offsetMinutes",
      "durationMinutes",
      "minRestMinutes",
      "streamUrl",
    ]);
    const out = {
      id: text(w.id, "窗口ID"),
      name: w.name === undefined ? "时间窗口" : text(w.name, "窗口名称"),
      startsAt: instant(w.startsAt),
      offsetMinutes: integer(w.offsetMinutes, "固定偏移", -840, 840),
      durationMinutes: integer(w.durationMinutes ?? 60, "预计时长", 1, 10080),
      minRestMinutes: integer(w.minRestMinutes ?? 0, "休息间隔", 0, 10080),
    };
    if (w.planKey !== undefined)
      out.planKey = text(w.planKey, "轮次引用", 2000);
    if (w.streamUrl !== undefined && w.streamUrl !== "") {
      text(w.streamUrl,"直播链接",2000);
      let url;
      try {
        url = new URL(w.streamUrl);
      } catch {
        invalid("直播链接无效。");
      }
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        invalid("直播链接只允许不含账号信息的HTTP(S)地址。");
      out.streamUrl = url.href;
    }
    return out;
  });
  unique(
    windows.map((w) => w.id),
    "窗口",
  );
  unique(
    windows.filter((w) => w.planKey).map((w) => w.planKey),
    "轮次窗口",
  );
  const assignments = list(value.assignments, "比赛安排", 20000).map((a) => {
    fields(a, [
      "planKey",
      "windowId",
      "resourceId",
      "durationMinutes",
      "minRestMinutes",
    ]);
    const out = {
      planKey: text(a.planKey, "比赛引用", 2000),
      windowId: text(a.windowId, "窗口引用"),
    };
    if (
      a.resourceId !== undefined &&
      a.resourceId !== null &&
      a.resourceId !== ""
    )
      out.resourceId = text(a.resourceId, "资源引用");
    for (const key of ["durationMinutes", "minRestMinutes"])
      if (a[key] !== undefined)
        out[key] = integer(
          a[key],
          key,
          key === "durationMinutes" ? 1 : 0,
          10080,
        );
    return out;
  });
  unique(
    assignments.map((a) => a.planKey),
    "比赛",
  );
  return { configurationId, resources, windows, assignments };
}
function execution(schedule, assignment) {
  const w = schedule.windows.find((w) => w.id === assignment.windowId);
  if (!w) return null;
  return {
    ...assignment,
    startsAt: w.startsAt,
    offsetMinutes: w.offsetMinutes,
    durationMinutes: assignment.durationMinutes ?? w.durationMinutes,
    minRestMinutes: assignment.minRestMinutes ?? w.minRestMinutes,
    streamUrl: w.streamUrl ?? null,
    resource:
      schedule.resources.find((r) => r.id === assignment.resourceId) ?? null,
  };
}
function validateSchedule(schedule, items) {
  const diagnostics = [],
    byKey = new Map(items.map((m) => [m.planKey, m])),
    times = new Map(),
    windows = new Map(schedule.windows.map((w) => [w.id, w]));
  function add(code, reason, keys, severity = "error") {
    diagnostics.push({
      code,
      severity,
      reason,
      planKeys: keys,
      path: "/assignments",
    });
  }
  for (const w of schedule.windows)
    if (w.planKey) {
      const item = byKey.get(w.planKey);
      if (!item || item.kind !== "window")
        add("REFERENCE_INVALID", "轮次窗口引用不属于当前冻结计划。", [
          w.planKey,
        ]);
      else if (item.inactive)
        add(
          "CONDITION_INACTIVE",
          "该轮次已未使用，预约保留但没有实际比赛。",
          [w.planKey],
          "info",
        );
      else {
        times.set(w.planKey, {
          start: Date.parse(w.startsAt),
          end: Date.parse(w.startsAt) + w.durationMinutes * 60000,
          rest: w.minRestMinutes,
        });
        if (!item.known)
          add(
            "ROSTER_PENDING",
            "未来瑞士轮待配对；时间保持，生成后还需明确分配具体比赛。",
            [w.planKey],
            "pending",
          );
      }
    }
  for (const a of schedule.assignments) {
    const m = byKey.get(a.planKey),
      w = windows.get(a.windowId);
    if (!m || m.kind !== "match" || !w) {
      add("REFERENCE_INVALID", "比赛或窗口引用不属于当前计划。", [a.planKey]);
      continue;
    }
    if (a.resourceId && !schedule.resources.some((r) => r.id === a.resourceId))
      add("RESOURCE_INVALID", "比赛台引用不存在。", [a.planKey]);
    if (m.inactive) {
      add(
        "CONDITION_INACTIVE",
        "条件未满足，此预约没有实际比赛，不占用比赛台。",
        [a.planKey],
        "info",
      );
      continue;
    }
    const time = {
      start: Date.parse(w.startsAt),
      end:
        Date.parse(w.startsAt) +
        (a.durationMinutes ?? w.durationMinutes) * 60000,
      rest: a.minRestMinutes ?? w.minRestMinutes,
    };
    times.set(a.planKey, time);
    if (!m.known)
      add(
        "ROSTER_PENDING",
        "具体参赛身份尚未齐备，需要名单复核。",
        [a.planKey],
        "pending",
      );
  }
  for (const m of items) {
    const current = times.get(m.planKey);
    if (!current) continue;
    for (const key of m.dependencyKeys ?? []) {
      const before = times.get(key);
      if (!before)
        add(
          "PREDECESSOR_UNSCHEDULED",
          "前置比赛尚未安排，无法证明休息间隔。",
          [key, m.planKey],
          "pending",
        );
      else if (current.start < before.end + current.rest * 60000)
        add(
          "DEPENDENCY_TIME_CONFLICT",
          "开始早于前置预计结束及最小休息间隔。",
          [key, m.planKey],
        );
    }
  }
  const assigned = schedule.assignments.filter(
    (a) => times.has(a.planKey) && byKey.has(a.planKey),
  );
  for (let i = 0; i < assigned.length; i++)
    for (let j = i + 1; j < assigned.length; j++) {
      const a = assigned[i],
        b = assigned[j],
        at = times.get(a.planKey),
        bt = times.get(b.planKey),
        overlap = at.start < bt.end && bt.start < at.end,
        ma = byKey.get(a.planKey),
        mb = byKey.get(b.planKey),
        keys = [a.planKey, b.planKey];
      if (overlap && a.resourceId && a.resourceId === b.resourceId)
        add("RESOURCE_OVERLAP", "同一比赛台的预计时间重叠。", keys);
      if ((ma.entrants ?? []).some((id) => (mb.entrants ?? []).includes(id))) {
        const gap =
            at.start >= bt.end
              ? at.start - bt.end
              : bt.start >= at.end
                ? bt.start - at.end
                : -1,
          rest = at.start >= bt.end ? at.rest : bt.rest;
        if (gap < rest * 60000) {
          const known = ma.known && mb.known;
          add(
            known ? "PARTICIPANT_OVERLAP" : "POTENTIAL_PARTICIPANT_OVERLAP",
            known
              ? "同一参赛者时间重叠或休息不足。"
              : "潜在参赛集合相交，身份未定，必须复核。",
            keys,
            known ? "error" : "pending",
          );
        }
      }
    }
  return {
    status: diagnostics.some((d) => d.severity === "error")
      ? "blocked"
      : diagnostics.some((d) => d.severity === "pending")
        ? "pending"
        : "ready",
    diagnostics,
  };
}
module.exports = { parseSchedule, validateSchedule, execution, instant };
