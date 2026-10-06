import { useEffect, useId, useMemo, useRef, useState } from "react";
import ConfigProvider from "antd/es/config-provider";
import { createWallDatePicker } from "./wall-date-picker";
import zhCN from "antd/locale/zh_CN";
import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/zh-cn";
import {
  FIXED_OFFSETS,
  offsetLabel,
  utcToWall,
  wallToUtc,
} from "./fixed-datetime";
import "./tournament-datetime.css";
dayjs.extend(utc);
dayjs.extend(customParseFormat);
const FORMAT = "YYYY-MM-DD HH:mm:ss.SSS";
export default function TournamentDateTime({
  value,
  onChange,
  onValidityChange,
  serverError,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  onValidityChange: (valid: boolean) => void;
  serverError?: string;
}) {
  const id = useId();
  const picker = useRef<any>(null);
  const [offset, setOffset] = useState<number | null>(480);
  const [open, setOpen] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [inputError, setInputError] = useState("");
  const confirmed = useRef(false);
  const restoringFocus = useRef(false);
  const DatePicker = useMemo(
    () => createWallDatePicker(offset ?? 480),
    [offset],
  );
  const wall = utcToWall(value, offset ?? 480);
  const selected = wall ? dayjs.utc(wall, FORMAT, true).locale("zh-cn") : null;
  function validity(message: string) {
    setInputError(message);
    onValidityChange(!message);
  }
  useEffect(() => {
    setInputError("");
    onValidityChange(offset !== null);
  }, [value]); // Server replacement resets a stale draft; offset remains an explicit user selection.
  function close(cancel: boolean) {
    setOpen(false);
    if (cancel) {
      setEpoch((n) => n + 1);
      validity(offset === null ? "请选择时区。" : "");
    }
    requestAnimationFrame(() => {
      restoringFocus.current = true;
      picker.current?.focus();
      restoringFocus.current = false;
    });
  }
  function commit(next: Dayjs | null) {
    if (offset === null) {
      validity("请选择时区。");
      return;
    }
    const iso = next ? wallToUtc(next.format(FORMAT), offset) : null;
    if (next && !iso) {
      validity("请输入有效的日期和时间。");
      return;
    }
    confirmed.current = true;
    validity("");
    onChange(iso);
    setEpoch((n) => n + 1);
    close(false);
  }
  return (
    <ConfigProvider locale={zhCN}>
      <div className="tournament-datetime">
        <label htmlFor={id} className="datetime-label">
          开始日期时间
        </label>
        <div
          onKeyDownCapture={(e) => {
            if ((e.target as HTMLInputElement).id !== id) return;
            if (!open && (e.key === "Enter" || e.key === "ArrowDown")) {
              e.preventDefault();
              e.stopPropagation();
              confirmed.current = false;
              setOpen(true);
            } else if (open && e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close(true);
            }
          }}
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            if (target.id !== id) return;
            const text = target.value;
            if (text === wall || text === wall.slice(0, 16))
              validity(offset === null ? "请选择时区。" : "");
            else
              validity(
                text && !wallToUtc(text, offset)
                  ? "请输入有效的日期和时间。"
                  : "请确认日期选择，或取消恢复原时间。",
              );
          }}
        >
          <DatePicker
            key={epoch}
            id={id}
            ref={picker}
            defaultValue={selected}
            open={open}
            onFocus={() => {
              if (!restoringFocus.current) {
                confirmed.current = false;
                setOpen(true);
              }
            }}
            onOpenChange={(next) => {
              if (next) {
                confirmed.current = false;
                setOpen(true);
              } else {
                setOpen(false);
                confirmed.current = false;
              }
            }}
            onCalendarChange={(next) => {
              if (next && !Array.isArray(next) && next.format(FORMAT) !== wall)
                validity("请确认日期选择，或取消恢复原时间。");
            }}
            onChange={commit}
            onOk={() => close(false)}
            showTime={{ format: "HH:mm" }}
            needConfirm
            allowClear
            preserveInvalidOnBlur
            format={["YYYY-MM-DD HH:mm", FORMAT]}
            placeholder="选择日期和时间"
            status={inputError || serverError ? "error" : undefined}
            aria-invalid={!!(inputError || serverError)}
            aria-describedby={id + "-help"}
            classNames={{ popup: { root: "tournament-calendar" } }}
            renderExtraFooter={() => (
              <button type="button" onClick={() => close(true)}>
                取消选择
              </button>
            )}
          />
        </div>
        <label className="field">
          <span>时区</span>
          <select
            value={offset ?? ""}
            onChange={(e) => {
              const next =
                e.target.value === "" ? null : Number(e.target.value);
              setOffset(next);
              setEpoch((n) => n + 1);
              setOpen(false);
              validity(next === null ? "请选择时区。" : "");
            }}
          >
            <option value="">请选择偏移</option>
            {FIXED_OFFSETS.map((n) => (
              <option value={n} key={n}>
                {n === 480
                  ? "北京时间（UTC+08:00）"
                  : n === 0
                    ? "协调世界时（UTC+00:00）"
                    : offsetLabel(n)}
              </option>
            ))}
          </select>
        </label>
        <p className="muted" id={id + "-help"}>
          可留空，稍后确定。按所选时区保存；切换时区只改变显示时间。固定偏移不自动调整夏令时。
        </p>
        {(inputError || serverError) && (
          <p className="error" role="alert">
            {inputError || serverError}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            validity(offset === null ? "请选择时区。" : "");
            onChange(null);
            setEpoch((n) => n + 1);
            close(false);
          }}
        >
          清空开始时间
        </button>
      </div>
    </ConfigProvider>
  );
}
