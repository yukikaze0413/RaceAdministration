# 第 3 课：中间件和请求处理 - 理论知识

## 🎯 学习目标
- 理解中间件的概念
- 学会处理 POST 请求
- 掌握 JSON 数据解析
- 理解请求和响应对象

---

## 📖 理论知识详解

### 1️⃣ 什么是中间件？

#### 中间件的概念

**中间件（Middleware）** 是一个函数，它可以访问请求对象（req）、响应对象（res）和下一个中间件函数（next）。

**形象比喻：**
想象你去餐厅吃饭：
1. **门卫**检查你的预约（身份验证中间件）
2. **服务员**带你入座（路由中间件）
3. **厨师**做菜（业务逻辑）
4. **服务员**上菜（响应）

每个环节都是一个"中间件"，按顺序执行！

#### 中间件的工作流程

```
客户端请求
    ↓
中间件 1 (日志记录)
    ↓
中间件 2 (JSON 解析)
    ↓
中间件 3 (身份验证)
    ↓
路由处理函数
    ↓
响应返回给客户端
```

#### 中间件的基本结构

```javascript
function myMiddleware(req, res, next) {
  // 1. 做一些处理
  console.log('请求时间:', new Date());

  // 2. 修改 req 或 res 对象
  req.customProperty = 'some value';

  // 3. 调用 next() 传递给下一个中间件
  next();

  // 如果不调用 next()，请求会被挂起！
}
```

**关键点：**
- `req` - 请求对象，可以读取和修改
- `res` - 响应对象，可以发送响应
- `next` - 函数，调用它会执行下一个中间件

---

### 2️⃣ 中间件的类型

#### 应用级中间件

作用于整个应用，所有请求都会经过。

```javascript
const express = require('express');
const app = express();

// 应用级中间件 - 记录所有请求
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// 所有路由都会先经过上面的中间件
app.get('/api/races', (req, res) => {
  res.json({ message: 'Hello' });
});
```

#### 路由级中间件

只作用于特定路由。

```javascript
// 只对 /api/races 路径生效
app.use('/api/races', (req, res, next) => {
  console.log('访问赛事 API');
  next();
});
```

#### 内置中间件

Express 自带的中间件。

```javascript
// 解析 JSON 格式的请求体
app.use(express.json());

// 解析 URL 编码的请求体（表单数据）
app.use(express.urlencoded({ extended: true }));

// 提供静态文件服务
app.use(express.static('public'));
```

#### 第三方中间件

需要安装的中间件包。

```javascript
// CORS 中间件（跨域资源共享）
const cors = require('cors');
app.use(cors());

// 日志中间件
const morgan = require('morgan');
app.use(morgan('dev'));
```

#### 错误处理中间件

专门处理错误的中间件（有 4 个参数）。

```javascript
// 注意：错误处理中间件有 4 个参数！
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器错误' });
});
```

---

### 3️⃣ express.json() 中间件

#### 为什么需要它？

当客户端发送 POST 请求时，数据在请求体（body）中，Express 默认**不会解析**请求体。

**没有 express.json()：**
```javascript
app.post('/api/races', (req, res) => {
  console.log(req.body);  // undefined ❌
});
```

**使用 express.json()：**
```javascript
app.use(express.json());  // 添加这行！

app.post('/api/races', (req, res) => {
  console.log(req.body);  // { name: '赛事1', date: '2025-12-01' } ✓
});
```

#### 工作原理

```
客户端发送 POST 请求
    ↓
Content-Type: application/json
Body: {"name":"赛事1"}
    ↓
express.json() 中间件
    ↓
解析 JSON 字符串 → JavaScript 对象
    ↓
挂载到 req.body
    ↓
路由处理函数可以使用 req.body
```

#### 使用示例

```javascript
const express = require('express');
const app = express();

// 必须在路由之前添加！
app.use(express.json());

app.post('/api/races', (req, res) => {
  const { name, date } = req.body;
  console.log('收到数据:', name, date);
  res.json({ message: '创建成功', data: req.body });
});
```

---

### 4️⃣ 请求对象（req）详解

#### 常用属性

| 属性 | 说明 | 示例 |
|-----|------|------|
| `req.params` | URL 路径参数 | `/api/races/:id` → `req.params.id` |
| `req.query` | URL 查询字符串 | `/api/races?page=1` → `req.query.page` |
| `req.body` | 请求体数据 | POST 请求的 JSON 数据 |
| `req.headers` | 请求头 | `req.headers['content-type']` |
| `req.method` | HTTP 方法 | `GET`, `POST`, `PUT`, `DELETE` |
| `req.url` | 请求 URL | `/api/races` |
| `req.path` | 路径部分 | `/api/races` |

#### 详细示例

**1. req.params - 路径参数**

```javascript
// 路由定义
app.get('/api/races/:id', (req, res) => {
  const id = req.params.id;
  res.json({ message: `获取 ID 为 ${id} 的赛事` });
});

// 访问：GET /api/races/123
// req.params.id = "123"
```

**多个参数：**
```javascript
app.get('/api/races/:raceId/participants/:participantId', (req, res) => {
  console.log(req.params.raceId);        // "1"
  console.log(req.params.participantId); // "5"
});

// 访问：GET /api/races/1/participants/5
```

**2. req.query - 查询字符串**

```javascript
app.get('/api/races', (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;
  const sort = req.query.sort || 'date';

  res.json({ page, limit, sort });
});

// 访问：GET /api/races?page=2&limit=20&sort=name
// req.query = { page: '2', limit: '20', sort: 'name' }
```

**3. req.body - 请求体**

```javascript
app.use(express.json());  // 必须先添加这个！

app.post('/api/races', (req, res) => {
  const { name, date, location } = req.body;
  res.json({ message: '创建成功', data: req.body });
});

// 客户端发送：
// POST /api/races
// Content-Type: application/json
// Body: { "name": "赛事1", "date": "2025-12-01", "location": "北京" }
```

**4. req.headers - 请求头**

```javascript
app.get('/api/races', (req, res) => {
  const contentType = req.headers['content-type'];
  const userAgent = req.headers['user-agent'];
  const token = req.headers['authorization'];

  res.json({ contentType, userAgent, token });
});
```

---

### 5️⃣ 响应对象（res）详解

#### 常用方法

| 方法 | 说明 | 示例 |
|-----|------|------|
| `res.json()` | 发送 JSON 响应 | `res.json({ name: '赛事' })` |
| `res.send()` | 发送文本/HTML | `res.send('Hello')` |
| `res.status()` | 设置状态码 | `res.status(404)` |
| `res.sendStatus()` | 发送状态码和消息 | `res.sendStatus(200)` |
| `res.redirect()` | 重定向 | `res.redirect('/login')` |
| `res.sendFile()` | 发送文件 | `res.sendFile('index.html')` |

#### 详细示例

**1. res.json() - 发送 JSON**

```javascript
app.get('/api/races', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '赛事1' },
      { id: 2, name: '赛事2' }
    ]
  });
});
```

**2. res.status() - 设置状态码**

```javascript
// 链式调用
app.post('/api/races', (req, res) => {
  res.status(201).json({ message: '创建成功' });
});

app.get('/api/races/:id', (req, res) => {
  const race = null;  // 假设没找到
  if (!race) {
    return res.status(404).json({ error: '赛事不存在' });
  }
  res.json(race);
});
```

**3. 常用 HTTP 状态码**

| 状态码 | 说明 | 使用场景 |
|-------|------|---------|
| **200** | OK | 请求成功 |
| **201** | Created | 创建成功 |
| **400** | Bad Request | 请求参数错误 |
| **401** | Unauthorized | 未授权（需要登录） |
| **403** | Forbidden | 禁止访问（权限不足） |
| **404** | Not Found | 资源不存在 |
| **500** | Internal Server Error | 服务器错误 |

---

### 6️⃣ 处理 POST 请求

#### 完整流程

```javascript
const express = require('express');
const app = express();

// 1. 添加 JSON 解析中间件
app.use(express.json());

// 2. 定义 POST 路由
app.post('/api/races', (req, res) => {
  // 3. 获取请求体数据
  const { name, date, location } = req.body;

  // 4. 数据验证
  if (!name || !date) {
    return res.status(400).json({
      error: '缺少必填字段',
      required: ['name', 'date']
    });
  }

  // 5. 处理业务逻辑（暂时用内存数组模拟）
  const newRace = {
    id: Date.now(),
    name,
    date,
    location: location || '未指定'
  };

  // 6. 返回响应
  res.status(201).json({
    message: '创建成功',
    data: newRace
  });
});

app.listen(5000);
```

#### 测试 POST 请求

**使用 Postman：**
1. 选择 POST 方法
2. URL: `http://localhost:5000/api/races`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "name": "第三届盯帧杯",
  "date": "2026-01-15",
  "location": "上海"
}
```

**使用 curl 命令：**
```bash
curl -X POST http://localhost:5000/api/races \
  -H "Content-Type: application/json" \
  -d '{"name":"第三届盯帧杯","date":"2026-01-15"}'
```

---

### 7️⃣ 中间件执行顺序

#### 顺序很重要！

```javascript
const express = require('express');
const app = express();

// ❌ 错误：express.json() 在路由之后
app.post('/api/races', (req, res) => {
  console.log(req.body);  // undefined
});
app.use(express.json());  // 太晚了！

// ✓ 正确：express.json() 在路由之前
app.use(express.json());
app.post('/api/races', (req, res) => {
  console.log(req.body);  // 正常工作
});
```

#### 执行流程示例

```javascript
const express = require('express');
const app = express();

// 中间件 1
app.use((req, res, next) => {
  console.log('1. 记录请求');
  next();
});

// 中间件 2
app.use(express.json());

// 中间件 3
app.use((req, res, next) => {
  console.log('3. 验证通过');
  next();
});

// 路由处理
app.post('/api/races', (req, res) => {
  console.log('4. 处理业务逻辑');
  res.json({ message: 'OK' });
});

// 执行顺序：1 → 2 → 3 → 4
```

---

## 💡 关键概念总结

| 概念 | 说明 |
|-----|------|
| **中间件** | 处理请求和响应的函数，按顺序执行 |
| **express.json()** | 解析 JSON 格式的请求体 |
| **req.params** | URL 路径参数（如 `/api/races/:id`） |
| **req.query** | URL 查询字符串（如 `?page=1`） |
| **req.body** | 请求体数据（POST/PUT 请求） |
| **res.json()** | 发送 JSON 响应 |
| **res.status()** | 设置 HTTP 状态码 |
| **next()** | 调用下一个中间件 |

---

## 🎯 学习检查

理解了这些概念后，你应该能回答：

1. **什么是中间件？它的作用是什么？**
   - 中间件是处理请求和响应的函数
   - 可以修改 req/res 对象，执行代码，调用下一个中间件

2. **为什么需要 express.json()？**
   - 解析 JSON 格式的请求体
   - 让 req.body 可以访问 POST 请求的数据

3. **req.params、req.query、req.body 有什么区别？**
   - params：URL 路径参数（`/api/races/:id`）
   - query：查询字符串（`?page=1`）
   - body：请求体数据（POST/PUT）

4. **中间件的执行顺序重要吗？**
   - 非常重要！必须按正确顺序添加
   - express.json() 必须在路由之前

---

## 📚 相关资源

- [Express 中间件官方文档](https://expressjs.com/en/guide/using-middleware.html)
- [HTTP 状态码详解](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status)

---

**下一步：** 完成第 3 课的实践作业，掌握中间件和 POST 请求处理！
