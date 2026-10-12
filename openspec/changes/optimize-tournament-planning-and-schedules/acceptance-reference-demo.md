# 示例入口专项验收（10.4 的通用模拟部分）

10.4 仍未勾选，因为四案例要求包含科隆与 TI2026 专用运行和历史复现；当前仅完成三个通用模拟路径。

`reference-demo-full-browser-final.log`：真实 Edge 10/10 通过，三个示例各在 360/768/1440 完整创建、配置保存、冻结、全部参考单位审批、锁定、逐场比分裁定、确认、时间资源与窗口安排、刷新、完成后图与公众三视图核对。分别覆盖 87、34、35 场全部时间安排，不仅首轮。响应提交后丢失再用原请求键恢复同一实例；原入口刷新后可从列表重入。主代理已查看暗影杯三个宽度的完成截图，手机采用完整比赛列表，平板和桌面使用可滚动画布。

后端专项 `reference-demo-journal-green.log`：7/7 通过，覆盖显式确认/版本/幂等、父库不写入、独立路径 cookie、原账号当前权限与提交前再检查、事务失败回滚与原键恢复、重启保留编辑、注销预览/token/父 SQL 回滚不删文件、占用文件保留清理记录并重启恢复、多实例最后关闭清理，以及中断日志写入不发布损坏记录。

失败证据保留于 `reference-demo-multi-close-red.log` 和 `reference-demo-journal-red.log`。多实例缺陷的回归测试使用两个真实应用及共享临时父库，并确定性模拟 Windows 文件占用；中断写入注入 ENOSPC。测试从未打开用户 `.data/platform.sqlite`。

本轮最终后端 `reference-demo-backend-final.log` 255/255、前端 `reference-demo-frontend-final.log` 82/82、build/typecheck 和 strict 通过。浏览器全批次 `reference-demo-all-browser-final.log` 中既有114场景及丢失响应场景通过，九项示例因断言仍匹配旧TI待核验文案失败；保持不能创建断言，更新文案期望后 `reference-demo-browser-copy-recheck.log` 10/10 全流程通过。因此同版业务代码覆盖124个不同浏览器场景通过，不能把第一次批次写成124/124。最终规格验收10.5仍等待真实案例及独立差异评审。

后端首次最终批次随机低端口触发两次 fetch bad port，保留 `reference-demo-backend-bad-port.log`；仅将旧HTTP测试夹具改为高端口有界选择，原凭据和权限断言保持，随后255/255通过。

目录升级后的原键重试另有 `reference-demo-catalog-retry-red.log` → `reference-demo-catalog-retry-green.log`。原成功结果先按当前授权和fingerprint核验再返回，新请求仍验证当前目录版本；不清空原实例。修复后 `reference-demo-catalog-backend-final.log`255/255及 `reference-demo-catalog-browser-final.log`真实Edge响应丢失/原键重试/列表重入1/1再次通过，build/typecheck与strict通过。其余场景未受该缓存查找次序影响，不重复计数。
