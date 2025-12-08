# 学习笔记

## 📚 课程进度追踪

- [x] 第 1 课：Node.js 基础和 Express 入门 ✅ 2025-11-24
- [x] 第 2 课：路由模块化 ✅ 2025-11-27
- [x] 第 3 课：中间件和请求处理 ✅ 2025-11-27
- [x] 第 4 课：控制器模式（MVC 架构） ✅ 2025-12-03
- [x] 第 5 课：错误处理和数据验证 ✅ 2025-12-08
- [ ]  第 6 课：MongoDB 基础和连接
- [ ]  第 7 课：Mongoose 模型和 Schema
- [ ]  第 8 课：数据库 CRUD 操作
- [ ]  第 9 课：参赛者管理模块
- [ ]  第 10 课：成绩管理模块
- [ ]  第 11 课：高级查询和分页
- [ ]  第 12 课：API 文档和测试
- [ ]  第 13 课：Vue.js 基础和项目搭建
- [ ]  第 14 课：API 调用和数据展示
- [ ]  第 15 课：表单和数据提交
- [ ]  第 16 课：路由和多页面
- [ ]  第 17 课：前后端联调和跨域处理
- [ ]  第 18 课：项目总结和优化

---

## 第一天：项目初始化

### 完成内容

- ✅ 创建项目指导文档（product.md, tech.md, structure.md）
- ✅ 初始化项目目录结构
- ✅ 创建基础配置文件
- ✅ 创建学习课程文档（CURRICULUM.md）

### 学到的知识

- 项目规划的重要性
- 目录结构的组织方式
- 环境变量的使用

---

## 第 1 课：Node.js 基础和 Express 入门 ✅

**完成日期：** 2025-11-24

### 学到的知识

- Node.js 是 JavaScript 运行环境，可以在服务器端运行 JS
- npm 是包管理工具，package.json 记录项目依赖
- Express 是 Web 框架，简化服务器开发
- HTTP 请求方法：GET（查）、POST（增）、PUT（改）、DELETE（删）
- 路由 = 请求方法 + 路径 + 处理函数
- `res.json()` 用于返回 JSON 格式数据

### 完成的作业

- ✅ 作业 1.1：创建 `/api/hello` 路由，返回 JSON 格式问候语
- ✅ 作业 1.2：创建 `/api/time` 路由，返回当前服务器时间
- ✅ 作业 1.3：测试所有路由正常工作

### 遇到的问题

- 最初使用了 `res.send()` 返回文本，后来理解了 API 应该统一返回 JSON 格式

### 心得体会

_可以在这里写下你的学习感受_

---

## 第 2 课：路由模块化 ✅

**完成日期：** 2025-11-27

### 学到的知识

- 为什么要模块化：代码组织清晰、易于维护、便于协作
- Express Router 的使用：`express.Router()` 创建路由器
- Node.js 模块系统：`require()` 导入，`module.exports` 导出
- 路径拼接规则：最终路径 = app.use() 的前缀 + router 中的路径

### 完成的作业

- ✅ 作业 2.1：创建 raceRoutes.js 路由模块
- ✅ 作业 2.2：把 /api/races 路由移到 raceRoutes.js
- ✅ 作业 2.3：在 server.js 中引入并使用 raceRoutes
- ✅ 作业 2.4：创建 testRoutes.js，迁移 /api/hello 和 /api/time

### 遇到的问题

- 理解了路径拼接规则：`app.use('/api/test', testroutes)` + `routes.get('/hello')` = `/api/test/hello`

### 心得体会

_可以在这里写下你的学习感受_

---

## 第 3 课：中间件和请求处理 ✅

**完成日期：** 2025-11-27

### 学到的知识
- 中间件的概念：处理请求和响应的函数，按顺序执行
- express.json() 的作用：解析 JSON 格式的请求体
- req.body：获取 POST 请求的数据
- req.params：获取 URL 路径参数
- req.query：获取查询字符串参数
- res.status()：设置 HTTP 状态码
- POST 请求的完整流程

### 完成的作业
- ✅ 作业 3.1：在 server.js 中添加 express.json() 中间件
- ✅ 作业 3.2：创建 POST /api/races 路由
- ✅ 作业 3.3：打印 req.body 数据
- ✅ 作业 3.4：返回包含随机 ID 的数据

### 遇到的问题
- 最初返回字段写成了 `date` 而不是 `data`，已修正

### 心得体会
_可以在这里写下你的学习感受_

---

## 第 4 课：控制器模式（MVC 架构） ✅

**完成日期：** 2025-12-03

### 学到的知识

- MVC 架构：Model（模型）+ View（视图）+ Controller（控制器）
- 控制器的职责：接收请求、验证数据、处理业务逻辑、返回响应
- 路由 vs 控制器：路由只负责 URL 映射，控制器负责具体逻辑
- CRUD 操作对应的 HTTP 方法：
  - Create → POST（201 状态码）
  - Read → GET（200 状态码）
  - Update → PUT（200 状态码）
  - Delete → DELETE（200/204 状态码）
- 数据验证的重要性：先验证再处理
- 错误状态码：400（参数错误）、404（资源不存在）

### 完成的作业

- ✅ 作业 4.1：创建 controllers 文件夹和 raceController.js
- ✅ 作业 4.2：实现 getRaces() 获取所有赛事
- ✅ 作业 4.3：实现 getRaceById() 获取单个赛事
- ✅ 作业 4.4：实现 createRace() 创建赛事
- ✅ 作业 4.5：实现 updateRace() 更新赛事
- ✅ 作业 4.6：实现 deleteRace() 删除赛事
- ✅ 作业 4.7：重构 raceRoutes.js 使用控制器

### 遇到的问题

- 字段名拼写错误：`names` 写成复数导致解构失败
- `parseInt` 拼写错误写成 `pareseInt`
- DELETE 请求不需要请求体，ID 放在 URL 路径中

### 心得体会

_可以在这里写下你的学习感受_

---

## 第 5 课：错误处理和数据验证 ✅

**完成日期：** 2025-12-08

### 学到的知识

- HTTP 状态码分类：
  - 2xx 成功（200 OK、201 Created、204 No Content）
  - 4xx 客户端错误（400 Bad Request、404 Not Found）
  - 5xx 服务器错误（500 Internal Server Error）
- 数据验证类型：存在性验证、类型验证、格式验证（正则表达式）、范围验证
- 正则表达式基础：`^`（开头）、`$`（结尾）、`\d`（数字）、`{n}`（重复n次）
- try-catch 错误处理：捕获异常，防止服务器崩溃
- 错误处理中间件：4 个参数 `(err, req, res, next)`，放在所有路由之后
- 自定义错误类 AppError：把错误信息和状态码绑定在一起
- `next(error)` 的作用：把错误传递给错误处理中间件

### 完成的作业

- ✅ 作业 5.1：添加输入验证（name 长度、date 正则验证）
- ✅ 作业 5.2：完善 404 错误处理（getRaceById、updateRace、deleteRace）
- ✅ 作业 5.3：创建错误处理中间件 errorHandler.js
- ✅ 作业 5.4：在 server.js 中使用错误中间件
- ✅ 作业 5.5：创建自定义错误类 AppError.js
- ✅ 作业 5.6：控制器使用 AppError 和 next(error)

### 遇到的问题

- 使用 `next(error)` 时忘记在函数参数中添加 `next`，导致 `next is not defined` 错误
- 误以为 HTTP 状态码会显示在 JSON 响应体中，实际上状态码在响应头里（用 `curl -i` 可以查看）

### 心得体会

_可以在这里写下你的学习感受_

---

## 下一步计划

1. 连接 MongoDB 数据库（第 6 课）
2. 学习 Mongoose 模型和 Schema（第 7 课）
3. 实现数据库 CRUD 操作（第 8 课）
