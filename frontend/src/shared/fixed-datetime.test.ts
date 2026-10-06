import { expect, it } from "vitest";
import {
  wallToUtc,
  utcToWall,
  offsetLabel,
  FIXED_OFFSETS,
} from "./fixed-datetime";
it.each([
  ["2026-10-05 10:30:00.000", 480, "2026-10-05T02:30:00.000Z"],
  ["2026-10-04 23:45", -240, "2026-10-05T03:45:00.000Z"],
  ["2024-02-29 23:59:59.123", 480, "2024-02-29T15:59:59.123Z"],
  ["2026-01-31 23:45", -240, "2026-02-01T03:45:00.000Z"],
  ["2026-10-05 00:15", 345, "2026-10-04T18:30:00.000Z"],
])(
  "DT2 wall %s at %s minutes uses an independent UTC expectation",
  (wall, offset, expected) => {
    expect(wallToUtc(wall, offset)).toBe(expected);
  },
);
it.each([
  "2026-02-29 10:30",
  "2026-02-30 10:30",
  "2026-13-01 10:30",
  "2026-10-05 24:00",
  "2026-10-05 10:60",
  "2026-10-05 10:30:60",
  "invalid",
])("rejects impossible wall time %s", (wall) => {
  expect(wallToUtc(wall, 480)).toBeNull();
});
it.each([null, -735, 855, 481, NaN])(
  "rejects missing or invalid fixed offset %s",
  (offset) => {
    expect(wallToUtc("2026-10-05 10:30", offset)).toBeNull();
  },
);
it("DT1 renders old milliseconds and offset switching without changing the instant", () => {
  const old = "2026-10-05T02:30:47.123Z";
  expect(utcToWall(old, 480)).toBe("2026-10-05 10:30:47.123");
  expect(utcToWall(old, -240)).toBe("2026-10-04 22:30:47.123");
  expect(utcToWall(null, 480)).toBe("");
  expect(wallToUtc(utcToWall(old, -240), -240)).toBe(old);
});
it("offers all 105 quarter-hour offsets and labels them explicitly", () => {
  expect(FIXED_OFFSETS).toHaveLength(105);
  expect(FIXED_OFFSETS[0]).toBe(-720);
  expect(FIXED_OFFSETS.at(-1)).toBe(840);
  expect(offsetLabel(345)).toBe("UTC+05:45");
  expect(offsetLabel(-240)).toBe("UTC-04:00");
});
