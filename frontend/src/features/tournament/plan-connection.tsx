import { useState, useRef } from "react";
import { api, failure, requestKey } from "../../shared/api";
import { Field, ErrorNotice } from "../../shared/ui";
import { structurePayload } from "../configuration/session";
import { portOptions, sourceConsumers, targetConflicts } from "./plan-ports";
export function PlanConnection({
  payload,
  disabled,
  onChange,
  url,
  source,
  setSource,
  target,
  setTarget,
}: {
  payload: any;
  disabled: boolean;
  onChange: (p: any) => void;
  url: string;
  source: string;
  setSource: (v: string) => void;
  target: string;
  setTarget: (v: string) => void;
}) {
  const sources = portOptions(payload, "source"),
    targets = portOptions(payload, "target"),
    s = sources.find((p) => p.key === source),
    t = targets.find((p) => p.key === target);
  const current = useRef(payload);
  current.current = payload;
  const [from, setFrom] = useState(1),
    [to, setTo] = useState(1),
    [positions, setPositions] = useState("1"),
    [placement, setPlacement] = useState("seed"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<any>(null),
    [diagnostics, setDiagnostics] = useState<any[]>([]),
    [notice, setNotice] = useState("");
  async function connect() {
    setError(null);
    setDiagnostics([]);
    setNotice("");
    if (!s || !t) return;
    const seats = positions.split(",").map((v) => Number(v.trim())),
      quota = to - from + 1;
    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      from < 1 ||
      to < from ||
      to > s.capacity ||
      seats.length !== quota ||
      seats.some((v) => !Number.isSafeInteger(v) || v < 1 || v > t.capacity) ||
      new Set(seats).size !== seats.length
    ) {
      setNotice("名额范围、目标位置或数量无效；目标位置数必须等于名额数。");
      return;
    }
    const consumers = sourceConsumers(payload.routes, s.ref, from, to);
    if (consumers.length) {
      setDiagnostics(
        consumers.map((r) => ({
          reason: `来源名额已由路由 ${r.id} 分配，不能一对多复制。`,
          path: "/source",
          routeId: r.id,
        })),
      );
      return;
    }
    const conflicts = targetConflicts(payload.routes, t.ref, seats);
    if (
      conflicts.length &&
      !window.confirm(
        `目标席位已被 ${conflicts.map((r) => r.id).join("、")} 占用。确认删除这些整条路由并替换？`,
      )
    )
      return;
    const route = {
      id: requestKey(),
      source: s.ref,
      target: t.ref,
      selector: { kind: "rankRange", from, to },
      quota,
      sort: [
        { field: s.ref.poolId ? "poolSeed" : "initialSeed", direction: "asc" },
      ],
      placement: {
        kind: ["seed", "slot"].includes(t.ref.port) ? t.ref.port : placement,
        positions: seats,
      },
    };
    const candidate = {
        ...payload,
        routes: [
          ...payload.routes.filter(
            (r: any) => !conflicts.some((c) => c.id === r.id),
          ),
          route,
        ],
      },
      signature = JSON.stringify(structurePayload(payload));
    setBusy(true);
    try {
      const report = await api(url + "/graph-plan", {
        method: "POST",
        body: {
          expectedVersion: payload.version,
          payload: structurePayload(candidate),
        },
      });
      const errors = report.diagnostics.filter(
        (d: any) => d.severity === "error",
      );
      if (errors.length) {
        setDiagnostics(errors);
        return;
      }
      if (signature !== JSON.stringify(structurePayload(current.current))) {
        setNotice("草稿已变化，请重新检查连接。");
        return;
      }
      onChange(candidate);
      setNotice("连接已加入草稿，请保存结构。");
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={disabled || busy} className="plan-connection">
      <legend>具名端口连接</legend>
      <p>
        端口按钮和下列选择器执行相同连接。已分配来源不能再次消费；替换目标须明确确认整条路由的删除。
      </p>
      <div className="form-grid">
        <Field label="连接来源出口">
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">请选择来源出口</option>
            {sources.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
                {sourceConsumers(payload.routes, p.ref, 1, p.capacity).length
                  ? " · 已分配部分名额"
                  : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="连接目标入口">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">请选择目标入口</option>
            {targets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="来源名额起点">
          <input
            type="number"
            min={1}
            max={s?.capacity}
            value={from}
            onChange={(e) => setFrom(Number(e.target.value))}
          />
        </Field>
        <Field label="来源名额终点">
          <input
            type="number"
            min={1}
            max={s?.capacity}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
          />
        </Field>
        <Field label="连接目标位置">
          <input
            value={positions}
            onChange={(e) => setPositions(e.target.value)}
          />
        </Field>
        {!["seed", "slot"].includes(t?.ref.port) && (
          <Field label="连接落位方式">
            <select
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
            >
              <option value="seed">种子</option>
              <option value="slot">绝对席位</option>
            </select>
          </Field>
        )}
      </div>
      <button disabled={!s || !t} onClick={connect}>
        {busy ? "正在校验连接…" : "校验并添加连接"}
      </button>
      {notice && <p role="status">{notice}</p>}
      {diagnostics.length > 0 && (
        <ul role="alert">
          {diagnostics.map((d, i) => (
            <li key={i}>
              {d.reason} · {d.routeId ?? ""} · {d.path}
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorNotice error={error} onRetry={connect} />}
    </fieldset>
  );
}
