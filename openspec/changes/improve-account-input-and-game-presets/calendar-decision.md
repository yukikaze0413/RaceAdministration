# 历史前置门槛说明

下文是任务1.2隔离探针的历史决策，描述的是生产接入前状态。当前任务3.1–3.4已完成生产接入及验收，见acceptance-datetime.md；不能把历史探针当作生产验证。

# 日历组件集成门槛（任务1.2）

2026-10-05。决定：采用Ant Design 6.6.5 DatePicker与dayjs 1.11.23，已锁定package.json/package-lock.json；目前只完成隔离兼容验证，尚未替换赛事MetadataForm。第3组任务保持未完成。

## 证据

- npm registry实际返回antd 6.6.5，peer react/react-dom >=18.0.0；安装准确版本成功，ignore-scripts禁用包脚本。
- React19.3.0 / Vite8.3.2 / TypeScript7.0.2下，隔离页面的tsc和vite build退出0；中文ConfigProvider与dayjs locale同时配置。
- 三个真实Edge测试通过：360/768/1440，键盘输入→Tab到中文确认→Enter提交→焦点返回→重新打开→Escape取消→值保持→清空。截图output/playwright/calendar-gate-{width}.png；页面无横向溢出，pageerror为空。主代理检查360截图。
- 初次探针typecheck因node:url类型未配置失败，已将配置改为相对于frontend工作目录的固定实验目录；最终calendar:build同时检查配置与TSX；补充独立tsc成功与退出0记录calendar-gate-typecheck.txt，初次失败另存calendar-gate-typecheck-initial.txt。没有隐藏类型错误。
- 初次浏览器断言将中文按钮自动插空格误判为错误，依据实际DOM将文本匹配改为确\\s*定；确认操作、值和焦点断言均保留。原失败日志单独保存。

| 实测构建 | JS | gzip JS | CSS |
|---|---:|---:|---:|
| 当前密码切片主应用 | 372.25 kB | 115.98 kB | 7.27 kB |
| 独立DatePicker探针 | 560.36 kB | 181.77 kB | 0.54 kB |

两者入口不同，不能直接相减或相加当作实际集成增量。探针按组件命名导入、Vite生产tree-shaking，不导入完整antd全局样式；生成chunk超过500kB的提示如实保留，未调高阈值隐藏。实际赛事接入时再按设计做按需加载并测主应用增量和移动端行为。

## 复现

仓库根执行：

```powershell
npm --prefix frontend run calendar:build
npm --prefix frontend run e2e -- e2e/calendar-gate.spec.ts
```

探针源文件位于frontend/experiments/calendar，配置为frontend/calendar-gate.config.ts，独立输出为output/calendar-gate-dist；与业务前端dist和数据库隔离。e2e入口先构建探针，避免全新checkout缺少产物而失败。

## 使用边界

已证明组件在当前准确依赖下可集成并具有中文、可清空与键盘弹层能力。尚未证明UTC往返、偏移切换、非法日期保留、旧毫秒精度或409冲突；这些须第3组以独立手算例与实际MetadataForm实施验证，不能用此探针勾选3.1–3.4。

依据[官方DatePicker](https://ant.design/components/date-picker/)，本地真实构建和浏览器结果为兼容证据；文档API或peer范围不单独作为成功证明。