export function wallToUtc(wall: string, offset: number | null): string | null {
  const parts =
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
      wall,
    );
  if (
    !parts ||
    offset === null ||
    !Number.isInteger(offset) ||
    offset < -720 ||
    offset > 840 ||
    offset % 15 !== 0
  )
    return null;
  const [, y, m, d, h, min, sec = "0", ms = "0"] = parts;
  const date = new Date(0);
  date.setUTCFullYear(Number(y), Number(m) - 1, Number(d));
  date.setUTCHours(
    Number(h),
    Number(min),
    Number(sec),
    Number(ms.padEnd(3, "0")),
  );
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d) ||
    date.getUTCHours() !== Number(h) ||
    date.getUTCMinutes() !== Number(min) ||
    date.getUTCSeconds() !== Number(sec)
  )
    return null;
  return new Date(date.getTime() - offset * 60000).toISOString();
}
export function utcToWall(iso: string | null, offset: number): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Date(time + offset * 60000)
    .toISOString()
    .slice(0, 23)
    .replace("T", " ");
}
export function offsetLabel(offset: number): string {
  const absolute = Math.abs(offset);
  return (
    "UTC" +
    (offset < 0 ? "-" : "+") +
    String(Math.floor(absolute / 60)).padStart(2, "0") +
    ":" +
    String(absolute % 60).padStart(2, "0")
  );
}
export const FIXED_OFFSETS = Array.from(
  { length: 105 },
  (_, i) => -720 + i * 15,
);
