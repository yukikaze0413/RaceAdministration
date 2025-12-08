# Node.js 全栈开发学习路线

> 通过实战项目《赛事管理系统》学习 Node.js + Express + MongoDB + Vue.js

---

## 📋 学习路线总览

### 阶段一：Node.js 和 Express 基础（第 1-5 课）
### 阶段二：MongoDB 数据库（第 6-8 课）
### 阶段三：完整后端开发（第 9-12 课）
### 阶段四：Vue.js 前端开发（第 13-16 课）
### 阶段五：前后端联调和部署（第 17-18 课）

---

## 🎯 阶段一：Node.js 和 Express 基础

### 第 1 课：Node.js 基础和 Express 入门 ✅ 已完成 (2025-11-24)

**学习目标：**
- 理解 Node.js 是什么
- 掌握 npm 包管理
- 创建第一个 Express 服务器
- 理解路由的概念

**理论知识：**
1. Node.js 是什么？为什么用它？
2. npm 是什么？package.json 的作用
3. Express 框架简介
4. HTTP 请求方法（GET, POST, PUT, DELETE）
5. 什么是路由？

**实践作业：**
```
✅ 已完成：你已经有一个基础的 server.js
📝 作业 1.1：在 server.js 中添加一个新路由 GET /api/hello，返回 { message: "你好，世界！" }
📝 作业 1.2：添加一个 GET /api/time 路由，返回当前服务器时间
📝 作业 1.3：运行服务器，用浏览器访问这些路由，观察结果
```

**验收标准：**
- [ ] 能够启动服务器（node server.js）
- [ ] 浏览器访问 http://localhost:5000/api/hello 能看到 JSON 响应
- [ ] 浏览器访问 http://localhost:5000/api/time 能看到当前时间

---

### 第 2 课：路由模块化 ✅ 已完成 (2025-11-27)

**学习目标：**
- 理解为什么要模块化
- 学会使用 Express Router
- 掌握文件导入导出（require/module.exports）

**理论知识：**
1. 为什么要拆分路由？（代码组织、可维护性）
2. Express Router 的使用
3. Node.js 模块系统（CommonJS）
4. require() 和 module.exports 的用法

**实践作业：**
```
📝 作业 2.1：创建 backend/src/routes/raceRoutes.js
📝 作业 2.2：把 server.js 中的 /api/races 路由移到 raceRoutes.js
📝 作业 2.3：在 server.js 中引入并使用 raceRoutes
📝 作业 2.4：创建 backend/src/routes/testRoutes.js，把 /api/hello 和 /api/time 移进去
```

**参考代码结构：**
```javascript
// backend/src/routes/raceRoutes.js
const express = require('express');
const router = express.Router();

// 在这里定义路由
router.get('/', (req, res) => {
  // 你的代码
});

module.exports = router;
```

**验收标准：**
- [ ] server.js 变得更简洁，只负责启动服务器
- [ ] 路由逻辑都在独立的文件中
- [ ] 所有路由仍然正常工作

---

### 第 3 课：中间件和请求处理 ✅ 已完成 (2025-11-27)

**学习目标：**
- 理解中间件的概念
- 学会处理 POST 请求
- 掌握 JSON 数据解析

**理论知识：**
1. 什么是中间件？
2. express.json() 的作用
3. req（请求）和 res（响应）对象
4. 如何获取请求参数（req.params, req.query, req.body）

**实践作业：**
```
📝 作业 3.1：在 server.js 中添加 express.json() 中间件
📝 作业 3.2：创建 POST /api/races 路由，接收 JSON 数据 { name, date }
📝 作业 3.3：在路由中打印接收到的数据（console.log）
📝 作业 3.4：返回接收到的数据加上一个 id（暂时用随机数）
```

**测试方法：**
使用 Postman 或浏览器开发者工具发送 POST 请求：
```json
POST http://localhost:5000/api/races
Content-Type: application/json

{
  "name": "测试赛事",
  "date": "2025-12-01"
}
```

**验收标准：**
- [ ] 能够接收 POST 请求
- [ ] 能够解析 JSON 数据
- [ ] 返回正确的响应

---

### 第 4 课：控制器模式（MVC 架构）

**学习目标：**
- 理解 MVC 架构
- 学会分离业务逻辑
- 掌握控制器的编写

**理论知识：**
1. 什么是 MVC？
2. 为什么要分离业务逻辑？
3. 控制器的职责
4. 路由 vs 控制器的区别

**实践作业：**
```
📝 作业 4.1：创建 backend/src/controllers/raceController.js
📝 作业 4.2：把路由中的逻辑提取到控制器函数中
📝 作业 4.3：实现以下控制器函数：
   - getRaces()      // 获取所有赛事
   - getRaceById()   // 获取单个赛事
   - createRace()    // 创建赛事
   - updateRace()    // 更新赛事
   - deleteRace()    // 删除赛事
📝 作业 4.4：在 raceRoutes.js 中调用这些控制器函数
```

**参考代码结构：**
```javascript
// backend/src/controllers/raceController.js
// 暂时用数组模拟数据库
let races = [
  { id: 1, name: '第一届盯帧杯', date: '2025-11-15' }
];

exports.getRaces = (req, res) => {
  // 你的代码
};

exports.createRace = (req, res) => {
  // 你的代码
};
```

**验收标准：**
- [ ] 控制器文件独立存在
- [ ] 路由文件只负责路由定义
- [ ] 能够完成增删改查操作（数据暂存在内存中）

---

### 第 5 课：错误处理和数据验证

**学习目标：**
- 学会处理错误
- 掌握输入验证
- 理解 HTTP 状态码

**理论知识：**
1. 常见 HTTP 状态码（200, 201, 400, 404, 500）
2. try-catch 错误处理
3. 输入验证的重要性
4. 错误响应的标准格式

**实践作业：**
```
📝 作业 5.1：在控制器中添加输入验证（检查 name 和 date 是否存在）
📝 作业 5.2：如果验证失败，返回 400 状态码和错误信息
📝 作业 5.3：如果找不到资源，返回 404 状态码
📝 作业 5.4：创建 backend/src/middlewares/errorHandler.js 统一处理错误
```

**验收标准：**
- [ ] 发送无效数据时返回 400 错误
- [ ] 访问不存在的资源时返回 404 错误
- [ ] 错误信息清晰易懂

---

## 🎯 阶段二：MongoDB 数据库

### 第 6 课：MongoDB 基础和连接

**学习目标：**
- 理解 NoSQL 数据库
- 安装和启动 MongoDB
- 连接 MongoDB 数据库

**理论知识：**
1. 什么是 MongoDB？
2. NoSQL vs SQL 数据库
3. MongoDB 的基本概念（数据库、集合、文档）
4. Mongoose 是什么？

**环境准备：**
```bash
# 安装 MongoDB（根据你的操作系统）
# Windows: 下载安装包或使用 MongoDB Atlas（云数据库）
# Mac: brew install mongodb-community
# Linux: apt-get install mongodb

# 安装依赖
cd backend
npm install mongoose dotenv
```

**实践作业：**
```
📝 作业 6.1：创建 backend/.env 文件，配置数据库连接字符串
📝 作业 6.2：创建 backend/src/config/database.js，编写数据库连接函数
📝 作业 6.3：在 server.js 中调用连接函数
📝 作业 6.4：启动服务器，确认数据库连接成功
```

**参考代码：**
```javascript
// backend/src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB 连接成功');
  } catch (error) {
    console.error('MongoDB 连接失败:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

**验收标准：**
- [ ] MongoDB 服务正在运行
- [ ] 服务器启动时能成功连接数据库
- [ ] 控制台显示连接成功信息

---

### 第 7 课：Mongoose 模型和 Schema

**学习目标：**
- 理解 Schema 的概念
- 学会定义数据模型
- 掌握数据类型和验证

**理论知识：**
1. 什么是 Schema？
2. Mongoose 数据类型
3. 字段验证（required, unique, default）
4. 时间戳（timestamps）

**实践作业：**
```
📝 作业 7.1：创建 backend/src/models/Race.js
📝 作业 7.2：定义 Race Schema，包含字段：
   - name (String, 必填)
   - date (Date, 必填)
   - location (String, 可选)
   - description (String, 可选)
   - maxParticipants (Number, 默认 100)
   - status (String, 枚举: 'upcoming', 'ongoing', 'completed')
📝 作业 7.3：添加时间戳（createdAt, updatedAt）
📝 作业 7.4：导出模型
```

**参考代码结构：**
```javascript
// backend/src/models/Race.js
const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '赛事名称不能为空'],
    trim: true
  },
  // 其他字段...
}, {
  timestamps: true
});

module.exports = mongoose.model('Race', raceSchema);
```

**验收标准：**
- [ ] Race 模型定义完整
- [ ] 包含必要的验证规则
- [ ] 能够成功导入模型

---

### 第 8 课：数据库 CRUD 操作

**学习目标：**
- 掌握 Mongoose 的增删改查
- 学会使用 async/await
- 理解 Promise

**理论知识：**
1. 异步编程（回调、Promise、async/await）
2. Mongoose 查询方法
3. 错误处理最佳实践

**实践作业：**
```
📝 作业 8.1：修改 raceController.js，使用真实的数据库操作
📝 作业 8.2：实现 getRaces - 使用 Race.find()
📝 作业 8.3：实现 getRaceById - 使用 Race.findById()
📝 作业 8.4：实现 createRace - 使用 Race.create()
📝 作业 8.5：实现 updateRace - 使用 Race.findByIdAndUpdate()
📝 作业 8.6：实现 deleteRace - 使用 Race.findByIdAndDelete()
📝 作业 8.7：添加 try-catch 错误处理
```

**参考代码：**
```javascript
// backend/src/controllers/raceController.js
const Race = require('../models/Race');

exports.getRaces = async (req, res) => {
  try {
    const races = await Race.find();
    res.json(races);
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

// 其他方法...
```

**验收标准：**
- [ ] 所有 CRUD 操作都使用数据库
- [ ] 数据能够持久化保存
- [ ] 错误处理完善

---

## 🎯 阶段三：完整后端开发

### 第 9 课：参赛者管理模块

**学习目标：**
- 应用前面学到的知识
- 独立开发一个完整模块
- 理解模块间的关联

**实践作业：**
```
📝 作业 9.1：创建 Participant 模型（参赛者）
   字段：name, email, phone, raceId（关联赛事）, registrationDate, status
📝 作业 9.2：创建 participantController.js
📝 作业 9.3：创建 participantRoutes.js
📝 作业 9.4：实现完整的 CRUD API
📝 作业 9.5：实现查询某个赛事的所有参赛者
```

**验收标准：**
- [ ] Participant 模块功能完整
- [ ] 能够关联到具体赛事
- [ ] API 测试通过

---

### 第 10 课：成绩管理模块

**学习目标：**
- 处理更复杂的数据关系
- 学会数据关联查询

**实践作业：**
```
📝 作业 10.1：创建 Result 模型（成绩）
   字段：raceId, participantId, score, time, rank, notes
📝 作业 10.2：创建 resultController.js 和 resultRoutes.js
📝 作业 10.3：实现成绩录入功能
📝 作业 10.4：实现根据赛事查询成绩
📝 作业 10.5：实现自动排名功能（根据 score 或 time 排序）
```

**验收标准：**
- [ ] 成绩能够正确录入
- [ ] 能够查询特定赛事的成绩
- [ ] 排名计算正确

---

### 第 11 课：高级查询和分页

**学习目标：**
- 学会复杂查询
- 实现分页功能
- 掌握排序和筛选

**理论知识：**
1. MongoDB 查询操作符
2. 分页原理（limit, skip）
3. 排序（sort）
4. 筛选（filter）

**实践作业：**
```
📝 作业 11.1：为 getRaces 添加分页功能（page, limit）
📝 作业 11.2：添加排序功能（按日期、名称）
📝 作业 11.3：添加搜索功能（按名称模糊搜索）
📝 作业 11.4：添加状态筛选（upcoming, ongoing, completed）
```

**验收标准：**
- [ ] 分页功能正常
- [ ] 排序和筛选工作正常
- [ ] 返回总数和当前页信息

---

### 第 12 课：API 文档和测试

**学习目标：**
- 学会编写 API 文档
- 掌握 API 测试方法

**实践作业：**
```
📝 作业 12.1：完善 docs/API.md，记录所有 API 接口
📝 作业 12.2：为每个接口写明：
   - 请求方法和路径
   - 请求参数
   - 响应格式
   - 示例
📝 作业 12.3：使用 Postman 测试所有接口
📝 作业 12.4：创建 Postman Collection 导出保存
```

**验收标准：**
- [ ] API 文档完整清晰
- [ ] 所有接口测试通过
- [ ] 有完整的测试用例

---

## 🎯 阶段四：Vue.js 前端开发

### 第 13 课：Vue.js 基础和项目搭建

**学习目标：**
- 理解 Vue.js 框架
- 创建 Vue 项目
- 掌握组件基础

**环境准备：**
```bash
# 安装 Vue CLI
npm install -g @vue/cli

# 创建项目
cd RaceAdministration
vue create frontend
# 选择 Vue 3 + 默认配置
```

**理论知识：**
1. Vue.js 是什么？
2. 组件化开发
3. 响应式数据
4. 模板语法

**实践作业：**
```
📝 作业 13.1：创建 Vue 项目
📝 作业 13.2：启动开发服务器，查看默认页面
📝 作业 13.3：修改 App.vue，创建一个简单的页面
📝 作业 13.4：创建第一个组件 HelloWorld.vue
```

**验收标准：**
- [ ] Vue 项目成功创建
- [ ] 开发服务器正常运行
- [ ] 能够看到页面

---

### 第 14 课：API 调用和数据展示

**学习目标：**
- 学会使用 Axios
- 掌握数据获取和展示
- 理解生命周期

**环境准备：**
```bash
cd frontend
npm install axios
```

**实践作业：**
```
📝 作业 14.1：安装 axios
📝 作业 14.2：创建 src/api/race.js 封装 API 调用
📝 作业 14.3：创建 RaceList.vue 组件
📝 作业 14.4：在组件中调用 API 获取赛事列表
📝 作业 14.5：使用 v-for 渲染赛事列表
📝 作业 14.6：处理加载状态和错误
```

**验收标准：**
- [ ] 能够成功调用后端 API
- [ ] 数据正确显示在页面上
- [ ] 有加载提示

---

### 第 15 课：表单和数据提交

**学习目标：**
- 掌握表单处理
- 学会双向绑定
- 实现数据提交

**实践作业：**
```
📝 作业 15.1：创建 RaceForm.vue 组件
📝 作业 15.2：使用 v-model 绑定表单数据
📝 作业 15.3：实现表单验证
📝 作业 15.4：提交表单数据到后端
📝 作业 15.5：提交成功后刷新列表
```

**验收标准：**
- [ ] 表单能够正确提交
- [ ] 验证功能正常
- [ ] 提交后数据更新

---

### 第 16 课：路由和多页面

**学习目标：**
- 学会使用 Vue Router
- 实现多页面应用
- 掌握路由导航

**环境准备：**
```bash
cd frontend
npm install vue-router
```

**实践作业：**
```
📝 作业 16.1：安装 vue-router
📝 作业 16.2：创建路由配置文件
📝 作业 16.3：创建多个页面组件：
   - HomePage.vue（首页）
   - RaceManagement.vue（赛事管理）
   - ParticipantManagement.vue（参赛者管理）
   - ResultManagement.vue（成绩管理）
📝 作业 16.4：添加导航菜单
```

**验收标准：**
- [ ] 路由配置正确
- [ ] 页面切换正常
- [ ] 导航菜单工作正常

---

## 🎯 阶段五：前后端联调和部署

### 第 17 课：前后端联调和跨域处理

**学习目标：**
- 解决跨域问题
- 完成前后端联调
- 优化用户体验

**理论知识：**
1. 什么是跨域？
2. CORS 解决方案
3. 代理配置

**实践作业：**
```
📝 作业 17.1：在后端安装 cors 中间件
📝 作业 17.2：配置 CORS 允许前端访问
📝 作业 17.3：测试所有功能的前后端交互
📝 作业 17.4：优化加载状态和错误提示
📝 作业 17.5：添加成功提示（Toast）
```

**验收标准：**
- [ ] 跨域问题解决
- [ ] 所有功能正常工作
- [ ] 用户体验良好

---

### 第 18 课：项目总结和优化

**学习目标：**
- 代码重构和优化
- 完善文档
- 总结学习成果

**实践作业：**
```
📝 作业 18.1：代码审查和重构
📝 作业 18.2：完善所有文档
📝 作业 18.3：添加 README 使用说明
📝 作业 18.4：整理学习笔记
📝 作业 18.5：规划下一步学习方向
```

**下一步学习方向：**
- 用户认证和授权（JWT）
- 文件上传功能
- 数据导出（Excel, PDF）
- 单元测试
- 部署到云服务器
- Docker 容器化
- CI/CD 自动化部署

---

## 📝 学习建议

1. **每天学习 1-2 课**，不要贪多
2. **一定要动手写代码**，不要只看不练
3. **遇到问题先自己思考**，再查资料或提问
4. **完成作业后再进入下一课**
5. **在 docs/LEARNING.md 中记录学习心得**
6. **代码要提交到 Git**（虽然现在还没初始化 Git）

## 🎯 学习进度追踪

在 `docs/LEARNING.md` 中记录你的进度：

```markdown
## 学习进度

- [x] 第 1 课：Node.js 基础和 Express 入门
- [ ] 第 2 课：路由模块化
- [ ] 第 3 课：中间件和请求处理
...
```

---

加油！笨蛋！本小姐相信你一定能学会的！(≧▽≦)／
有问题随时来问本小姐哦～ (*￣︶￣)
