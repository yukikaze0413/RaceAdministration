# 画布重建工程验收

日期：2026-10-13。change：rebuild-tournament-planning-canvas。基线 HEAD：5e55bc7893aeee2472c40be51e3b9921910a4623，工作区代码指纹见 evidence/source-hashes.json。新增代码未提交，原有临时成果保留。

## 实际执行结果

| 检查 | 结果 | 证据 |
|---|---|---|
| backend npm test | 347/347，0失败，退出0 | evidence/backend-final.log |
| frontend npm test | 94/94，19文件，退出0 | evidence/frontend-final.log |
| npm run build（含 tsc --noEmit） | 退出0 | evidence/build-final.log |
| 真实 Edge canvas-lab.spec.ts | 10/10，退出0 | evidence/browser-final.log |
| OpenSpec 严格结构检查 | valid，退出0 | 最终命令检查；不替代行为验收 |
| git diff --check | 退出0 | 最终命令检查 |
| 独立只读评审 | 两份 complete，五项问题已复现修复 | review.md |

构建有现有主 bundle >500KB 提示，Node SQLite 为实验性 API；均非测试失败。早期后端沙箱 spawn EPERM 属环境失败，改用非隔离模式完成红绿，最终全量通过授权的进程运行。早期组件测试类型参数错误导致一次构建失败，已修正；该次使用旧 dist 的浏览器批次已中止，不计最终证据。

## 需求场景与证据

| 需求/场景 | 预期与实际 | 状态 | 验证 |
|---|---|---|---|
| 组件与实际数据分离 | source/Match/Swiss/Pool/selector/expander/generator/subgraph；未知人员为来源表达式，比分及 nested condition 运行字段拒绝 | 通过 | canvas-graph/boundaries/http |
| 不完整合法草稿 | 缺输入可保存，验证错误且预览按钮禁用 | 通过 | HTTP saved version、Edge 缩容 |
| Pool 多来源/部分重排 | 按输入端口顺序拼接；ABC+DE 与 B2/D1 得 AD C B E，不静默去重；当前种子重建 | 通过 | canvas-values、Edge Pool |
| 随机/倒序及 random1 | 位置模板绑定不改变成员；seed重放、top4、超限错误、random1数量和随机模板不同seed | 通过 | canvas-values、values-independent.log、Edge generator |
| 连接与分支 | 单席位双端替换、重复无新边、非法类型/循环保持旧图；集合多读合法，同批确定重复拒绝 | 通过 | canvas-graph/boundaries |
| Swiss→top8→八强 | 1v8、4v5、2v7、3v6；M1/M2、M3/M4 半决赛；7场计划，规则缺口不伪造排名 | 通过 | canvas-planning、三宽度 Edge |
| 未知/已确认全排名 | 初始顺序作来源，最终 rank占位；独立解析夹具要求全段确认和全员排列 | 通过 | canvas-planning |
| 子图与预设 | 嵌套封装/展开保持 key 和来源；单败7/GSL5/双败14，显式输入/晋级边界，先转自定义 | 通过 | canvas-planning/boundaries、Edge preset |
| 缩容/边界删除 | 影响可取消，摘要变化拒绝确认；确认仅处理明确列出的关系 | 通过 | canvas-planning、Edge shrink |
| UI/键盘/真实尺寸 | 节点自适应尺寸、Match Y/X、隐藏L保留关系、平移缩放/适应/定位/重置；真实端口端点误差<1px | 通过 | view.test、三宽度 Edge真实几何及截图 |
| 保存重载和并发 | 保存版本/摘要门槛，347回归、SQLite真实重启、PUT幂等/事务失败原键恢复、撤权和他人403 | 通过 | canvas-http/restart |
| 网络/409恢复 | 丢失响应保持原键及草稿；读取远端后显式采用或保留本地版本恢复 | 通过 | Edge lost response /409 |
| 锁定与URL | 保存进行中属性不可编辑，同路径canvas切换重载正确草稿 | 通过 | 两项评审回归 Edge |
| 隔离 | 浏览器临时库 tournaments=0；独立规划表不写正式结构；本地5010专属预览库 | 通过 | Edge断言、HTTP表断言及启动检查 |

截图：output/playwright/canvas-lab-360.png、768.png、1440.png，主代理已查看360与1440。截图支持视觉检查，不作为关系验收替代。

## 本地运行与未验证范围

5010 独立预览已启动（scripts/canvas-lab-preview.js），未登录访问新接口返回401，HTML测试入口可加载。专属库 output/local-preview/canvas-lab.sqlite；用户需在此空间注册测试账号。现有5000旧后端新接口404，原进程未重启，避免误把5173旧代理目标当作新服务已加载。

本范围工程验收完成。用户本人业务接受尚未确认；实际比分/开赛、正式工作台集成、旧冻赛事迁移、生产部署不在范围。未声称穷尽任意512节点组合或全部运行身份解析，未来运行数据接入需独立变更。

Notion 本轮仅工作台入口 fetch，scope.complete=false，无完整四库及正文T0/T2，没有远端写入；不声明两端一致。已验收规格同步至 main specs 后仍保留完成的活动change供审阅；归档、提交、推送、发布单独处理，不冒称已发生。
