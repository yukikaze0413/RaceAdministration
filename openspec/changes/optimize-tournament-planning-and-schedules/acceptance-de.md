# 6.1 / 6.2 / 6.3 双败验收记录

N4/N8独立手算表已在0.4完成。实际运行测试逐项核对disabled/half/same、Q1/2/3真实场数、N8具体cross feeder、初始败数与实际负数，以及GF重置两条路径与BO7。N16/32/64合法总人数、批次不重复、资格前沿和实际历史计数覆盖确定性左右胜及多种固定随机结果路径。

实际HTTP覆盖18种N4/N8×三入口×Q组合，Q1下方赢GF1真实激活GF2，Q2/Q3无GF且资格无虚假名次。de-http-red.log记录未开放时501；开放后de-runtime-green.log通过。权限撤销/结果编辑与确认隔离、事务回滚、并发和SQLite重启成功键回放均按四规则参数化实际执行。

三宽度15条页面验收全部通过，覆盖标准无reset、reset上方赢而GF2未激活、下方赢激活GF2，以及half/same直接入口。真实创建/冻结/审批/锁定/开赛/全部比分确认/刷新见de-browser.log。三宽度代表截图主代理已查看。首次浏览器等待旧批次导致测试定位超时，改为明确新批次标题，未将定位问题记为业务缺陷。

de_actual_runtime_contract_check返回partial：编译数量、字段和界面核验完成，无可复现缺陷；独立执行受spawn EPERM限制。主代理实际完整回归与浏览器执行补足测试证据，不将partial冒称独立完整执行。

最终完整领域/API、前端单元、构建/typecheck、真实Edge证据分别见de-backend-final.log、de-frontend-final.log、de-build.log、de-browser-final.log。隔离临时SQLite，不修改用户数据库，无提交、部署或归档。
