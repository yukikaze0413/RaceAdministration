# 新机制验收

验收日期：2026-10-14。
工程任务完成 9/9。

## 命令结果

| 范围 | 命令 | 结果 |
|---|---|---|
| 后端 | backend 下 npm test | 358/358 通过 |
| 前端 | frontend 下 npm test | 95/95 通过 |
| 构建 | frontend 下 npm run build | 类型检查和构建通过 |
| 浏览器 | canvas-lab.spec.ts 与 canvas-mechanism.spec.ts | 22/22 通过 |
| 规格 | 新变更及 planning-canvas 主规格严格校验 | 通过 |

## 行为证据

- canvas-waves.test.js 验证图内编号和跨图隔离。
- 同文件验证阶段全量等待及反向依赖错误。
- 同文件验证候选人员顺序和 Swiss 整轮映射。
- canvas-schedule.test.js 验证版本、权限及幂等。
- 同文件注入数据库失败，原请求键可以重试。
- 同文件拒绝不存在的日期和重叠依赖时段。
- canvas-restart.test.js 验证产物及 session 重启恢复。
- 浏览器覆盖 360、768、1440 像素宽度。
- 浏览器覆盖真实框选、迁移取消和保存重载。
- 浏览器覆盖失效引用修复和浏览器历史保护。

全部测试使用临时 SQLite。
旧 batch 兼容仍有独立回归场景。
新图使用 stage、wave 和 session。

## 本地预览

5010 服务已加载新构建 index-Bf0a0e8T.js。
回环和校园 IP 的画布页面均返回 200。
校园 IP 核验绕过系统代理。
既有 WLAN 2 临时规则已恢复。
规则仅开放本机 5010，来源为 LocalSubnet。
新版迁移接口在合法 Origin 下返回登录要求。
该探针不修改草稿。

## 使用限制

Swiss round 仍是动态配对占位。
时段容量仍需逐场时长确认。
手机外部访问未代替用户核验。
变更未归档，代码未提交或发布生产环境。
