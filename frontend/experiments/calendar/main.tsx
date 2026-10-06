import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, DatePicker } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import "./style.css";
dayjs.locale("zh-cn");
function CalendarGate() {
  const picker = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Dayjs | null>(null);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => picker.current?.focus());
  }
  return (
    <ConfigProvider locale={zhCN}>
      <main className="probe">
        <h1>日期组件兼容验证</h1>
        <p>这是任务1.2的隔离验证页面，尚未替换赛事表单。</p>
        <label htmlFor="gate-date">开始日期时间</label>
        <DatePicker
          ref={picker}
          id="gate-date"
          value={value}
          open={open}
          onOpenChange={(next) => (next ? setOpen(true) : close())}
          onChange={setValue}
          onOk={close}
          showTime
          needConfirm
          allowClear
          format="YYYY-MM-DD HH:mm:ss"
          classNames={{ popup: { root: "calendar-gate" } }}
          renderExtraFooter={() => (
            <button type="button" onClick={close}>
              取消选择
            </button>
          )}
        />
        <p>固定偏移输入和UTC转换属于第3组任务，本页仅核验组件集成。</p>
        <output aria-label="选择结果">
          {value ? value.format("YYYY-MM-DD HH:mm:ss") : "未选择日期"}
        </output>
        <button type="button">下一字段</button>
      </main>
    </ConfigProvider>
  );
}
createRoot(document.getElementById("root")!).render(<CalendarGate />);
