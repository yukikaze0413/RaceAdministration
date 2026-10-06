# 日期时间切片验收（2026-10-05）

本轮完成任务3.1–3.4；活动变更由5/21推进至9/21。第4–6组共12项仍待实施，整变更保持实施阶段。当前HEAD e09ed528d925fc3a2f826fa6f770c4096b0f4d3c，成果在未提交工作区。未进行推送、部署、正式规格同步或归档，用户业务接受未确认。

## 需求—规格—任务—证据

| PRD/规格 | 任务 | 实现与验证 |
| --- | --- | --- |
| R15；DT1、浏览器时区不同 | 3.1 | fixed-datetime.ts、wall-date-picker.ts、tournament-datetime.tsx；19项转换测试，固定偏移+08/-04、闰日/月末、105种15分钟偏移、旧毫秒；UTC/上海真实浏览器及纽约夏令时缺口 |
| R15、TC1；DT1/DT2、选择与编辑、非法日期与冲突 | 3.2 | MetadataForm创建/编辑、清空null、字段错误、409保留本地与确认替换；5项真实组件、3项真实HTTP测试及浏览器用例，重启数据库、只改名称保留毫秒、非法时间无写入 |
| R15；DT2、移动端与键盘 | 3.3 | 360/768/1440 × UTC/Asia-Shanghai六组合，中文弹层、Tab确认、Enter打开、Escape取消与焦点归还；真实Edge截图和8项日期浏览器测试 |
| R15、TC1；DT1/DT2 | 3.4 | frontend/README.md与docs/PLATFORM-API.md；2026-10-05 10:30 +08 → 02:30Z，2026-10-05 23:45 -04 → 次日03:45Z，由独立预期与HTTP/浏览器保存重读核实 |

## 最终回归

所有以下日志均为本轮最终代码的重新执行，退出码0：
- backend test：56/56，evidence/datetime-regression-backend.txt。
- frontend test：51/51（9文件），evidence/datetime-regression-frontend.txt。
- frontend build（含tsc --noEmit）：通过，evidence/datetime-regression-build.txt。
- frontend e2e：21/21，evidence/datetime-regression-browser.txt；包含原平台、密码、日历探针与生产日期测试。
- 类型检查、OpenSpec严格校验及diff检查的收尾输出分别保存在evidence/datetime-final-typecheck.txt、datetime-final-openspec.txt、datetime-final-diff.txt。

生产主JS 372.77kB/gzip116.25kB，日期按需chunk 345.85kB/gzip115.05kB，CSS 0.60kB。隔离探针的560.36kB体积警告仍属于探针入口；生产主入口无超500kB警告。

## 缺陷处理与评审

红→绿记录保留于evidence/datetime-red-*、datetime-green-*。已修复多格式导致输入提前归一、捕获输入丢首字符、失焦抹掉非法草稿、取消后焦点触发重开，以及默认dayjs适配器把墙上时间转换成浏览器本地时区的问题。生产适配器保持墙上字段为UTC对象，只在提交时应用用户固定偏移；纽约DST缺口专门回归通过。

只读探子核验发现旧文档仍写5/21及生产ISO输入；本轮更新当前进度，保留历史探针与密码验收。主代理负责代码修改、截图点验与最终命令验证；独立审读不冒充测试执行。核验记录见evidence/datetime-slice-review.md。

截图：仓库output/playwright/datetime-popup-{360,768,1440}-{UTC,Asia-Shanghai}.png及同组合页面截图。360宽弹层使用内部滚动；确认操作可达，页面无水平溢出。

## 边界与下一门槛

固定UTC偏移不是地区时区，不自动处理夏令时规则。任务6.1整链验收依赖未完成的游戏/素材，6.2与6.3也保持未勾选；本轮回归不等于整变更出口。下一步4.1统一shadowverse及九职业/中立清单，再4.2服务端gameId兼容、4.3前端与筛选、4.4旧数据回退；随后第5组素材与第6组完整出口。
