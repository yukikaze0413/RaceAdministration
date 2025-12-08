# 第 2 课：路由模块化 - 理论知识

## 🎯 学习目标
- 理解为什么要模块化
- 学会使用 Express Router
- 掌握文件导入导出（require/module.exports）

---

## 📖 理论知识详解

### 1️⃣ 为什么要拆分路由？

#### 现在的问题

当你的 `server.js` 只有几个路由时还好，但如果以后有 20 个、50 个路由呢？

```javascript
// server.js 会变成这样... 😱
app.get('/api/hello', ...)
app.get('/api/time', ...)
app.get('/api/races', ...)
app.post('/api/races', ...)
app.get('/api/participants', ...)
app.post('/api/participants', ...)
app.get('/api/results', ...)
app.post('/api/results', ...)
// ... 还有几十个路由
app.listen(5000, ...)
```

**问题：**
- 文件太长，难以阅读
- 不同功能混在一起，难以维护
- 多人协作时容易冲突

#### 模块化的好处

✅ **代码组织清晰**：相关的路由放在一起
✅ **易于维护**：修改某个功能只需要改对应的文件
✅ **团队协作**：不同人可以负责不同的模块
✅ **职责分离**：server.js 只负责启动服务器

#### 类比理解

想象一个公司：
- `server.js` = 公司总部（负责协调）
- `raceRoutes.js` = 赛事部门（处理赛事相关请求）
- `participantRoutes.js` = 参赛者部门（处理参赛者相关请求）
- `resultRoutes.js` = 成绩部门（处理成绩相关请求）

每个部门管理自己的事情，总部只需要把请求分配给对应部门！

---

### 2️⃣ Express Router 是什么？

**Express Router** 是一个迷你的路由系统，可以把路由分组管理。

#### 基本概念

- Router 是一个独立的路由实例
- 可以在 Router 上定义路由
- 然后把整个 Router 挂载到主应用上

#### 工作原理

```
客户端请求: GET /api/races
    ↓
server.js 接收请求
    ↓
app.use('/api/races', raceRoutes) ← 匹配到这里
    ↓
转发给 raceRoutes 处理
    ↓
raceRoutes 中的 router.get('/') 处理
    ↓
返回响应
```

---

### 3️⃣ Node.js 模块系统（CommonJS）

#### 什么是模块？

- **模块** = 一个独立的 JavaScript 文件
- 每个文件有自己的作用域（变量不会污染全局）
- 可以导出功能给其他文件使用
- 可以导入其他文件的功能

#### 导出（module.exports）

**导出单个功能：**
```javascript
// math.js
function add(a, b) {
  return a + b;
}

module.exports = add;
```

**导出多个功能：**
```javascript
// math.js
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

module.exports = {
  add: add,
  subtract: subtract
};

// 简写（ES6）
module.exports = { add, subtract };
```

#### 导入（require）

**导入单个功能：**
```javascript
// app.js
const add = require('./math.js');
console.log(add(1, 2));  // 输出 3
```

**导入多个功能：**
```javascript
// app.js
const math = require('./math.js');
console.log(math.add(1, 2));       // 输出 3
console.log(math.subtract(5, 3));  // 输出 2

// 或者使用解构
const { add, subtract } = require('./math.js');
console.log(add(1, 2));  // 输出 3
```

#### 路径说明

```javascript
require('./math.js')        // 相对路径：当前目录下的 math.js
require('../utils/math.js') // 相对路径：上级目录的 utils 文件夹
require('express')          // 第三方包：从 node_modules 中查找
```

---

### 4️⃣ Express Router 的使用

#### 创建路由模块

```javascript
// routes/raceRoutes.js
const express = require('express');
const router = express.Router();  // 创建路由器实例

// 定义路由（注意：路径是相对的）
router.get('/', (req, res) => {
  res.json({ message: '获取所有赛事' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `获取 ID 为 ${req.params.id} 的赛事` });
});

router.post('/', (req, res) => {
  res.json({ message: '创建赛事' });
});

module.exports = router;  // 导出路由器
```

#### 在主应用中使用

```javascript
// server.js
const express = require('express');
const app = express();

// 导入路由模块
const raceRoutes = require('./routes/raceRoutes');

// 使用路由（挂载到 /api/races 路径）
app.use('/api/races', raceRoutes);

app.listen(5000, () => {
  console.log('服务器启动在 5000 端口');
});
```

#### 路径拼接规则

| server.js 中的挂载路径 | raceRoutes.js 中的路由 | 实际访问路径 |
|----------------------|---------------------|------------|
| `/api/races` | `router.get('/')` | `GET /api/races` |
| `/api/races` | `router.get('/:id')` | `GET /api/races/123` |
| `/api/races` | `router.post('/')` | `POST /api/races` |

**关键点：**
- `app.use('/api/races', ...)` 是**前缀**
- `router.get('/')` 中的路径是**相对于前缀**的
- 最终路径 = 前缀 + 相对路径

---

### 5️⃣ 完整示例对比

#### 重构前（所有路由在 server.js）

```javascript
// server.js
const express = require('express');
const app = express();

app.get('/api/races', (req, res) => {
  const races = [
    { id: 1, name: '第一届盯帧杯', date: '2025-11-15' }
  ];
  res.json(races);
});

app.post('/api/races', (req, res) => {
  res.json({ message: '创建赛事' });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: '你好，世界！' });
});

app.listen(5000);
```

#### 重构后（路由模块化）

```javascript
// routes/raceRoutes.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const races = [
    { id: 1, name: '第一届盯帧杯', date: '2025-11-15' }
  ];
  res.json(races);
});

router.post('/', (req, res) => {
  res.json({ message: '创建赛事' });
});

module.exports = router;
```

```javascript
// routes/testRoutes.js
const express = require('express');
const router = express.Router();

router.get('/hello', (req, res) => {
  res.json({ message: '你好，世界！' });
});

module.exports = router;
```

```javascript
// server.js
const express = require('express');
const app = express();

const raceRoutes = require('./routes/raceRoutes');
const testRoutes = require('./routes/testRoutes');

app.use('/api/races', raceRoutes);
app.use('/api', testRoutes);

app.listen(5000, () => {
  console.log('服务器启动在 5000 端口');
});
```

**对比：**
- ✅ server.js 变得简洁，只负责启动和路由挂载
- ✅ 赛事相关路由集中在 raceRoutes.js
- ✅ 测试路由集中在 testRoutes.js
- ✅ 以后添加新功能，只需创建新的路由文件

---

## 💡 关键概念总结

| 概念 | 说明 | 示例 |
|-----|------|-----|
| **模块化** | 把代码拆分成多个文件 | 一个文件一个功能模块 |
| **Express Router** | 路由分组工具 | `express.Router()` |
| **module.exports** | 导出功能 | `module.exports = router` |
| **require()** | 导入功能 | `require('./routes/raceRoutes')` |
| **app.use()** | 挂载路由到指定路径 | `app.use('/api/races', raceRoutes)` |

---

## 🎯 学习检查

理解了这些概念后，你应该能回答：

1. **为什么要模块化？**
   - 代码组织清晰、易于维护、便于协作

2. **Router 和 app 有什么区别？**
   - app 是主应用，Router 是迷你路由系统
   - Router 需要挂载到 app 上才能工作

3. **路径是如何拼接的？**
   - 最终路径 = app.use() 的前缀 + router 中的路径

4. **module.exports 和 require 的关系？**
   - module.exports 导出，require 导入
   - 一个文件导出，另一个文件导入使用

---

## 📚 相关资源

- [Express Router 官方文档](https://expressjs.com/en/guide/routing.html)
- [Node.js 模块系统](https://nodejs.org/api/modules.html)

---

**下一步：** 完成第 2 课的实践作业，把理论应用到实际代码中！
