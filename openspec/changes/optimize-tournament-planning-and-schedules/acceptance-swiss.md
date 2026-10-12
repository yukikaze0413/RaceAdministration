# 5.1–5.4 通用瑞士验收

独立领域期望：固定8人R3=12場，7人R5每次唯一bye且无虚假比分；阈值16人W=L3=33场，实际8位晋级，战绩3–0/3–1/3–2分别2/3/3人。缺分不确认，达阈值不继续参加，双方負导致配额不足时保留真实资格数。

solver测试包括首轮top-bottom、最小float、硬禁重赛、无解与预算耗尽区分、64人完整匹配、BigInt准确成本。DS独立2/0例、bye=0小分、双方负实际对手与net0、未确认局不累加、超安全整数BH均通过。不同冻结分制来源profile不可比较，大decimal points路由不舍入或按字典排序。

实际HTTP验证固定/阈值完整运行、缺分、锁轮、原成功键回放；六规则参数化验证裁定/确认权限、撤权后重放403、事务回滚、并发版本竞争及SQLite重启。writePrepared补测事务外计算、缓存不重算、旧版本拒绝、SQL失败不保留成功键、计算期间权限撤销和完整输入摘要竞争。

完整人工配对HTTP模拟solver-budget阻塞fixture，明确不冒称简单8人例自然触达预算；验证旧hash/重复/冻结首轮/回滚/原键恢复/撤权403/匿名脱敏。同分切线真实HTTP阻塞，仅能调整同rank且需理由，裁定后qualification重新生成。

三宽度实际Swiss6条完整运行与刷新、另6条同分裁定/人工配对丢失响应原键恢复均通过。初次轮数定位错误与第三轮数量写错如实纠正（16人3胜3负每轮8/8/8/6/3），不计业务红测。手机截图发现小分列挤压，现采用完整表横向滚动并测试键盘滚动；最终截图以完整回归产出为准。

独立swiss_solver_stats_contract_review完成并执行14/14领域核验；swiss_atomic_ui_contract_review完成，发现v2来源仍允许小数/不安全numeric points，主代理已修复并补预演拒绝与零allocations回归。公开decimal路径准确；v1有限数值兼容保持。

最终全后端、前端、build/typecheck、79真实Edge证据分别见swiss-backend-final.log、swiss-frontend-final.log、swiss-build.log、swiss-browser-final.log。所有实际HTTP/浏览器均隔离临时SQLite；无用户数据库操作、提交、部署或归档。官方精确赛事复刻不是本次通用瑞士验收结论。

最终219/219后端、73/73前端、79/79真实Edge及build/typecheck通过。追加默认250000预算困难例确认节点250001时返回solver-limit（swiss-default-budget.log）；手机局部表截图已主代理查看，清晰显示姓名和战绩，额外2/2手机表/键盘验收通过（swiss-table-browser.log）。首次密码测试随机bad port、组件同步字段读取失败日志分别保留swiss-backend-first-bad-port.log与swiss-frontend-first-async-field.log；参数文件单独11/11通过后补await字段出现，完整73重跑通过。
