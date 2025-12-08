# 第 1 课：Node.js 基础和 Express 入门 - 理论知识

## 🎯 学习目标
- 理解 Node.js 是什么
- 掌握 npm 包管理
- 创建第一个 Express 服务器
- 理解路由的概念

---

## 📖 理论知识详解

### 1️⃣ Node.js 是什么？为什么用它？

#### Node.js 简介

**Node.js** 是一个 JavaScript 运行环境，让 JavaScript 可以在服务器端运行。

**传统情况：**
- JavaScript 只能在浏览器中运行
- 用于网页交互（点击按钮、表单验证等）

**有了 Node.js：**
- JavaScript 可以在服务器上运行
- 可以创建 Web 服务器、API、命令行工具等

#### 技术特点

- **基于 Chrome V8 引擎**：速度快，性能好
- **事件驱动**：适合处理大量并发请求
- **非阻塞 I/O**：不会因为等待数据而卡住
- **单线程**：但通过异步机制实现高并发

#### 为什么要用 Node.js？

✅ **JavaScript 全栈**
- 前端和后端都用 JavaScript
- 学习成本低，一种语言搞定全栈

✅ **npm 生态丰富**
- 有超过 100 万个第三方包
- 几乎任何功能都能找到现成的库

✅ **异步非阻塞**
- 处理大量并发请求效率高
- 适合 I/O 密集型应用（Web API、实时聊天等）

✅ **开发效率高**
- 代码简洁，开发速度快
- 热重载工具（nodemon）提升开发体验

#### 对比示例

**浏览器中的 JavaScript：**
```javascript
// 操作网页元素
document.getElementById('btn').addEventListener('click', () => {
  alert('Hello!');
});
```

**Node.js 中的 JavaScript：**
```javascript
// 创建 Web 服务器
const http = require('http');
const server = http.createServer((req, res) => {
  res.end('Hello World!');
});
server.listen(3000);
```

---

### 2️⃣ npm 是什么？package.json 的作用

#### npm (Node Package Manager)

**npm** 是 Node.js 的包管理工具，类似于：
- 手机的应用商店
- Python 的 pip
- Java 的 Maven

#### 主要功能

1. **安装第三方包**
   ```bash
   npm install express    # 安装 express 包
   npm install mongoose   # 安装 mongoose 包
   ```

2. **管理项目依赖**
   - 记录项目需要哪些包
   - 自动安装所有依赖

3. **运行脚本命令**
   ```bash
   npm start      # 运行 start 脚本
   npm run dev    # 运行 dev 脚本
   npm test       # 运行测试
   ```

#### 常用命令

| 命令 | 说明 |
|-----|------|
| `npm init` | 初始化项目，创建 package.json |
| `npm install` | 安装 package.json 中的所有依赖 |
| `npm install <包名>` | 安装指定的包 |
| `npm install --save-dev <包名>` | 安装开发依赖 |
| `npm start` | 运行 start 脚本 |
| `npm run <脚本名>` | 运行自定义脚本 |

#### package.json 详解

**package.json** 是项目的配置文件，记录项目信息和依赖。

**示例：**
```json
{
  "name": "race-administration-backend",
  "version": "1.0.0",
  "description": "赛事管理系统后端",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": ["race", "management"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^5.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

**字段说明：**

| 字段 | 说明 |
|-----|------|
| `name` | 项目名称 |
| `version` | 版本号 |
| `description` | 项目描述 |
| `main` | 入口文件 |
| `scripts` | 脚本命令 |
| `dependencies` | 生产环境依赖（运行时需要） |
| `devDependencies` | 开发环境依赖（开发时需要） |

**版本号说明：**
```json
"express": "^5.1.0"
```
- `^5.1.0` - 兼容 5.x.x 版本（小版本更新）
- `~5.1.0` - 兼容 5.1.x 版本（补丁更新）
- `5.1.0` - 精确版本

---

### 3️⃣ Express 框架简介

#### Express 是什么？

**Express** 是 Node.js 最流行的 Web 框架，简化了 Web 服务器和 API 的开发。

**特点：**
- 轻量级、灵活
- 提供路由、中间件等功能
- 社区活跃，资源丰富

#### 为什么用 Express？

**原生 Node.js 创建服务器（复杂）：**
```javascript
const http = require('http');

const server = http.createServer((req, res) => {
  // 手动解析 URL
  if (req.url === '/api/races' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello' }));
  } else if (req.url === '/api/races' && req.method === 'POST') {
    // 手动读取请求体
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Created' }));
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(5000);
```

**使用 Express（简单）：**
```javascript
const express = require('express');
const app = express();

app.use(express.json());  // 自动解析 JSON

app.get('/api/races', (req, res) => {
  res.json({ message: 'Hello' });
});

app.post('/api/races', (req, res) => {
  res.status(201).json({ message: 'Created' });
});

app.listen(5000);
```

**对比：**
- ✅ Express 代码更简洁
- ✅ 自动处理 JSON 解析
- ✅ 路由定义更清晰
- ✅ 内置错误处理

---

### 4️⃣ HTTP 请求方法

#### HTTP 协议

**HTTP** (HyperText Transfer Protocol) 是浏览器和服务器通信的协议。

#### 常用请求方法

| 方法 | 用途 | 特点 | 示例 |
|-----|------|-----|------|
| **GET** | 获取数据 | 无请求体，参数在 URL 中 | 获取赛事列表 |
| **POST** | 创建数据 | 有请求体，数据在 body 中 | 创建新赛事 |
| **PUT** | 更新数据（完整） | 替换整个资源 | 更新整个赛事信息 |
| **PATCH** | 更新数据（部分） | 只更新部分字段 | 只更新赛事名称 |
| **DELETE** | 删除数据 | 删除指定资源 | 删除赛事 |

#### RESTful API 设计规范

**REST** (Representational State Transfer) 是一种 API 设计风格。

**规范示例：**
```
GET    /api/races           # 获取所有赛事
GET    /api/races/1         # 获取 ID 为 1 的赛事
POST   /api/races           # 创建新赛事
PUT    /api/races/1         # 完整更新 ID 为 1 的赛事
PATCH  /api/races/1         # 部分更新 ID 为 1 的赛事
DELETE /api/races/1         # 删除 ID 为 1 的赛事
```

**设计原则：**
- 使用名词表示资源（races, participants）
- 使用复数形式（/races 而不是 /race）
- 使用 HTTP 方法表示操作（GET, POST, PUT, DELETE）
- 使用 HTTP 状态码表示结果（200, 201, 404, 500）

#### 在 Express 中使用

```javascript
const express = require('express');
const app = express();

// GET - 查询
app.get('/api/races', (req, res) => {
  res.json([{ id: 1, name: '赛事1' }]);
});

// POST - 创建
app.post('/api/races', (req, res) => {
  res.status(201).json({ message: '创建成功' });
});

// PUT - 更新
app.put('/api/races/:id', (req, res) => {
  res.json({ message: '更新成功' });
});

// DELETE - 删除
app.delete('/api/races/:id', (req, res) => {
  res.json({ message: '删除成功' });
});
```

---

### 5️⃣ 什么是路由？

#### 路由的概念

**路由（Route）** 决定服务器如何响应客户端的请求。

**组成部分：**
1. **HTTP 方法**（GET, POST, PUT, DELETE）
2. **路径**（URL）
3. **处理函数**（回调函数）

#### 路由语法

```javascript
app.METHOD(PATH, HANDLER)
```

- `app` - Express 应用实例
- `METHOD` - HTTP 方法（get, post, put, delete）
- `PATH` - 路径（URL）
- `HANDLER` - 处理函数

#### 完整示例

```javascript
app.get('/api/races', (req, res) => {
  // req - 请求对象（request）
  // res - 响应对象（response）
  res.json({ message: 'Hello' });
});
```

#### 请求对象（req）

**常用属性：**

| 属性 | 说明 | 示例 |
|-----|------|------|
| `req.params` | URL 参数 | `/api/races/:id` → `req.params.id` |
| `req.query` | 查询字符串 | `/api/races?page=1` → `req.query.page` |
| `req.body` | 请求体数据 | POST 请求的 JSON 数据 |
| `req.headers` | 请求头 | `req.headers['content-type']` |

**示例：**
```javascript
// URL: /api/races/123?sort=date
app.get('/api/races/:id', (req, res) => {
  console.log(req.params.id);    // "123"
  console.log(req.query.sort);   // "date"
});

// POST /api/races
// Body: { "name": "赛事1" }
app.post('/api/races', (req, res) => {
  console.log(req.body.name);    // "赛事1"
});
```

#### 响应对象（res）

**常用方法：**

| 方法 | 说明 | 示例 |
|-----|------|------|
| `res.send()` | 发送文本/HTML | `res.send('Hello')` |
| `res.json()` | 发送 JSON | `res.json({ name: '赛事' })` |
| `res.status()` | 设置状态码 | `res.status(404)` |
| `res.sendFile()` | 发送文件 | `res.sendFile('index.html')` |

**示例：**
```javascript
// 发送文本
app.get('/text', (req, res) => {
  res.send('Hello World!');
});

// 发送 JSON（推荐用于 API）
app.get('/json', (req, res) => {
  res.json({ message: 'Hello', status: 'success' });
});

// 设置状态码
app.get('/error', (req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 链式调用
app.post('/api/races', (req, res) => {
  res.status(201).json({ message: '创建成功' });
});
```

#### res.send() vs res.json()

| 方法 | 返回类型 | Content-Type | 使用场景 |
|-----|---------|--------------|---------|
| `res.send()` | 文本/HTML | text/html | 返回网页、文本 |
| `res.json()` | JSON | application/json | 返回 API 数据（推荐） |

**示例：**
```javascript
// res.send() - 返回文本
res.send('Hello');
// 浏览器显示：Hello

// res.json() - 返回 JSON
res.json({ message: 'Hello' });
// 浏览器显示：{"message":"Hello"}
```

**为什么 API 要用 res.json()？**
- ✅ 自动设置正确的 Content-Type
- ✅ 前端更容易解析
- ✅ 可以包含多个字段
- ✅ 符合 RESTful API 规范

---

## 💡 关键概念总结

| 概念 | 说明 |
|-----|------|
| **Node.js** | JavaScript 运行环境，让 JS 在服务器运行 |
| **npm** | 包管理工具，安装和管理第三方库 |
| **package.json** | 项目配置文件，记录依赖和脚本 |
| **Express** | Web 框架，简化服务器开发 |
| **HTTP 方法** | GET（查）、POST（增）、PUT（改）、DELETE（删） |
| **路由** | 请求方法 + 路径 + 处理函数 |
| **req** | 请求对象，包含客户端发来的信息 |
| **res** | 响应对象，用来给客户端返回数据 |

---

## 🎯 学习检查

理解了这些概念后，你应该能回答：

1. **Node.js 和浏览器中的 JavaScript 有什么区别？**
   - Node.js 在服务器运行，可以创建 Web 服务器
   - 浏览器中的 JS 用于网页交互

2. **为什么要用 Express 而不是原生 Node.js？**
   - Express 代码更简洁
   - 提供路由、中间件等功能
   - 开发效率更高

3. **RESTful API 中，获取单个资源用什么方法？路径怎么写？**
   - 方法：GET
   - 路径：`/api/races/:id`（如 `/api/races/1`）

4. **res.send() 和 res.json() 有什么区别？**
   - `res.send()` 发送文本/HTML
   - `res.json()` 发送 JSON（API 推荐）

---

## 📚 相关资源

- [Node.js 官方文档](https://nodejs.org/docs/)
- [Express 官方文档](https://expressjs.com/)
- [npm 官方文档](https://docs.npmjs.com/)
- [HTTP 方法详解](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Methods)

---

**下一步：** 学习第 2 课《路由模块化》，把代码组织得更清晰！
