import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import weekOfYear from "dayjs/plugin/weekOfYear";
import customParseFormat from "dayjs/plugin/customParseFormat";
import base from "@rc-component/picker/es/generate/dayjs";
import DatePicker from "antd/es/date-picker";
dayjs.extend(utc);
dayjs.extend(weekOfYear);
dayjs.extend(customParseFormat);
// UTC objects here carry wall-clock fields only. The fixed offset is applied by wallToUtc.
const config: typeof base = {
  ...base,
  getNow: () => dayjs.utc(),
  getFixedDate: (s) => dayjs.utc(s, "YYYY-M-DD"),
  getEndDate: (d) => d.endOf("month"),
  getWeekDay: (d) => d.day(),
  getYear: (d) => d.year(),
  getMonth: (d) => d.month(),
  getDate: (d) => d.date(),
  getHour: (d) => d.hour(),
  getMinute: (d) => d.minute(),
  getSecond: (d) => d.second(),
  getMillisecond: (d) => d.millisecond(),
  addYear: (d, n) => d.add(n, "year"),
  addMonth: (d, n) => d.add(n, "month"),
  addDate: (d, n) => d.add(n, "day"),
  setYear: (d, n) => d.year(n),
  setMonth: (d, n) => d.month(n),
  setDate: (d, n) => d.date(n),
  setHour: (d, n) => d.hour(n),
  setMinute: (d, n) => d.minute(n),
  setSecond: (d, n) => d.second(n),
  setMillisecond: (d, n) => d.millisecond(n),
  isAfter: (a, b) => a.isAfter(b),
  isValidate: (d) => d.isValid(),
  locale: {
    ...base.locale,
    getWeekFirstDate: (_locale, d) => d.locale("zh-cn").startOf("week"),
    getWeek: (_locale, d) => d.locale("zh-cn").week(),
    format: (_locale, d, format) => d.locale("zh-cn").format(format),
    parse: (_locale, text, formats) => {
      for (const format of formats) {
        const parsed = dayjs.utc(text, format, true).locale("zh-cn");
        if (parsed.isValid()) return parsed;
      }
      return null;
    },
  },
};
export const WallDatePicker = DatePicker.generatePicker<Dayjs>(config);

export function createWallDatePicker(offset: number) {
  return DatePicker.generatePicker<Dayjs>({
    ...config,
    getNow: () => dayjs.utc().add(offset, "minute"),
  });
}
