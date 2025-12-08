# 第 6 课：MongoDB 基础和连接 - 理论知识

## 🎯 学习目标
- 理解 NoSQL 数据库的概念
- 掌握 MongoDB 的基本概念
- 学会使用 Mongoose 连接数据库
- 理解环境变量的使用

---

## 📖 理论知识详解

### 1️⃣ 什么是 MongoDB？

#### 数据库是什么？

**数据库** = 存储数据的仓库

之前我们的数据存在内存数组里：
```javascript
let races = [{ id: 1, name: '第一届盯帧杯' }];
```

问题：
- ❌ 服务器重启，数据就没了
- ❌ 无法存储大量数据
- ❌ 无法多人共享数据

数据库解决这些问题：
- ✅ 数据持久化保存
- ✅ 支持海量数据
- ✅ 支持并发访问

#### MongoDB 简介

**MongoDB** 是一个 **NoSQL 数据库**（非关系型数据库）。

特点：
- 使用 **JSON 格式** 存储数据（实际是 BSON）
- 灵活的数据结构，不需要预先定义表结构
- 适合存储复杂、多变的数据
- 查询语法简单，对 JavaScript 开发者友好

---

### 2️⃣ NoSQL vs SQL

#### 对比表格

| 对比项 | SQL（关系型） | NoSQL（非关系型） |
|-------|-------------|-----------------|
| **代表** | MySQL, PostgreSQL | MongoDB, Redis |
| **数据结构** | 表格（行和列） | 文档（JSON 格式） |
| **模式** | 固定模式，需预定义 | 灵活模式，可随时修改 |
| **关联** | 通过外键关联表 | 嵌入文档或引用 |
| **查询语言** | SQL 语句 | JavaScript 风格 |
| **适用场景** | 结构化数据、复杂关联 | 灵活数据、快速开发 |

#### SQL 数据示例

```sql
-- 表结构固定
CREATE TABLE races (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  date DATE
);

-- 查询
SELECT * FROM races WHERE id = 1;
```

#### MongoDB 数据示例

```javascript
// 文档格式，灵活自由
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "name": "第一届盯帧杯",
  "date": "2025-11-15",
  "location": "线上",  // 可以随时添加新字段
  "tags": ["电竞", "盯帧"]  // 可以存数组
}

// 查询
db.races.findOne({ _id: ObjectId("507f1f77bcf86cd799439011") })
```

---

### 3️⃣ MongoDB 核心概念

#### 概念对照

| SQL 概念 | MongoDB 概念 | 说明 |
|---------|-------------|------|
| Database（数据库） | Database（数据库） | 存储数据的容器 |
| Table（表） | Collection（集合） | 存储文档的容器 |
| Row（行） | Document（文档） | 一条数据记录 |
| Column（列） | Field（字段） | 数据的属性 |
| Primary Key | _id | 唯一标识符 |

#### 形象比喻

把 MongoDB 想象成一个**文件柜**：

```
MongoDB 服务器
└── 数据库（race_admin）      ← 一个抽屉
    ├── 集合（races）         ← 一个文件夹
    │   ├── 文档1 { name: "第一届盯帧杯", ... }  ← 一张纸
    │   ├── 文档2 { name: "第二届盯帧杯", ... }
    │   └── 文档3 { name: "第三届盯帧杯", ... }
    │
    ├── 集合（participants）  ← 另一个文件夹
    │   ├── 文档1 { name: "张三", ... }
    │   └── 文档2 { name: "李四", ... }
    │
    └── 集合（results）       ← 又一个文件夹
        └── ...
```

#### _id 字段

MongoDB 会自动为每个文档生成一个 `_id` 字段：

```javascript
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),  // 自动生成的唯一 ID
  "name": "第一届盯帧杯",
  "date": "2025-11-15"
}
```

- `ObjectId` 是 MongoDB 特有的 ID 类型
- 24 位十六进制字符串
- 包含时间戳、机器标识、进程 ID、计数器
- 全局唯一，不会重复

---

### 4️⃣ Mongoose 是什么？

#### 为什么需要 Mongoose？

MongoDB 原生驱动用起来比较繁琐，Mongoose 是一个 **ODM（对象文档映射）** 库，让操作更简单。

**没有 Mongoose（原生驱动）：**
```javascript
const { MongoClient } = require('mongodb');
const client = new MongoClient(uri);
await client.connect();
const db = client.db('race_admin');
const races = db.collection('races');
const result = await races.find({}).toArray();
```

**有 Mongoose：**
```javascript
const mongoose = require('mongoose');
await mongoose.connect(uri);
const races = await Race.find();  // 简洁！
```

#### Mongoose 的优势

1. **Schema 定义** - 可以定义数据结构和验证规则
2. **模型方法** - 提供简洁的 CRUD 方法
3. **中间件** - 可以在保存前/后执行操作
4. **类型转换** - 自动转换数据类型
5. **验证** - 内置数据验证功能

---

### 5️⃣ 数据库连接

#### 连接字符串格式

```
mongodb://[用户名:密码@]主机:端口/数据库名
```

**本地连接：**
```
mongodb://localhost:27017/race_admin
```

**云数据库（MongoDB Atlas）：**
```
mongodb+srv://用户名:密码@cluster0.xxxxx.mongodb.net/race_admin
```

#### 连接代码

```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB 连接成功');
  } catch (error) {
    console.error('MongoDB 连接失败:', error.message);
    process.exit(1);  // 连接失败就退出程序
  }
};

module.exports = connectDB;
```

#### 连接事件监听

```javascript
mongoose.connection.on('connected', () => {
  console.log('Mongoose 已连接');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose 连接错误:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose 已断开连接');
});
```

---

### 6️⃣ 环境变量

#### 为什么用环境变量？

数据库连接字符串包含敏感信息（用户名、密码），不应该直接写在代码里：

```javascript
// ❌ 不好的做法 - 密码暴露在代码中
mongoose.connect('mongodb+srv://admin:123456@cluster.mongodb.net/db');

// ✅ 好的做法 - 使用环境变量
mongoose.connect(process.env.MONGODB_URI);
```

#### .env 文件

创建 `.env` 文件存储环境变量：

```env
# backend/.env
MONGODB_URI=mongodb://localhost:27017/race_admin
PORT=5000
NODE_ENV=development
```

#### 使用 dotenv

```javascript
// 在 server.js 最开头加载
require('dotenv').config();

// 然后就可以使用 process.env.XXX
console.log(process.env.MONGODB_URI);
console.log(process.env.PORT);
```

#### .gitignore

**重要：** `.env` 文件不能提交到 Git！

```gitignore
# .gitignore
.env
node_modules/
```

可以创建 `.env.example` 作为模板：

```env
# backend/.env.example（可以提交到 Git）
MONGODB_URI=mongodb://localhost:27017/your_database
PORT=5000
NODE_ENV=development
```

---

### 7️⃣ MongoDB 安装选项

#### 选项一：本地安装

**Windows：**
1. 下载 MongoDB Community Server
2. 安装时勾选 "Install MongoDB as a Service"
3. 默认端口 27017

**Mac：**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### 选项二：MongoDB Atlas（推荐新手）

MongoDB Atlas 是官方云数据库服务，**免费套餐**足够学习使用。

**步骤：**
1. 访问 https://www.mongodb.com/atlas
2. 注册账号
3. 创建免费集群（选择 M0 Free Tier）
4. 设置数据库用户和密码
5. 设置 IP 白名单（允许 0.0.0.0/0 表示所有 IP）
6. 获取连接字符串

**连接字符串示例：**
```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/race_admin?retryWrites=true&w=majority
```

---

### 8️⃣ 完整连接流程

#### 项目结构

```
backend/
├── .env                    # 环境变量（不提交到 Git）
├── .env.example            # 环境变量模板
├── server.js               # 入口文件
└── src/
    └── config/
        └── database.js     # 数据库连接配置
```

#### 代码示例

**1. .env 文件：**
```env
MONGODB_URI=mongodb://localhost:27017/race_admin
PORT=5000
```

**2. database.js：**
```javascript
// backend/src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB 连接失败:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

**3. server.js：**
```javascript
// backend/server.js
require('dotenv').config();  // 最开头加载环境变量

const express = require('express');
const connectDB = require('./src/config/database');

const app = express();

// 连接数据库
connectDB();

// 中间件
app.use(express.json());

// 路由
// ...

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});
```

---

## 💡 关键概念总结

| 概念 | 说明 |
|-----|------|
| **MongoDB** | NoSQL 数据库，使用 JSON 格式存储数据 |
| **Collection** | 集合，相当于 SQL 的表 |
| **Document** | 文档，相当于 SQL 的行，是一个 JSON 对象 |
| **_id** | 文档的唯一标识符，自动生成 |
| **Mongoose** | MongoDB 的 ODM 库，简化数据库操作 |
| **环境变量** | 存储敏感配置，通过 .env 文件管理 |
| **dotenv** | 加载 .env 文件的 npm 包 |

---

## 🎯 学习检查

理解了这些概念后，你应该能回答：

1. **MongoDB 和 MySQL 有什么区别？**
   - MongoDB 是 NoSQL，存储 JSON 文档，结构灵活
   - MySQL 是 SQL，存储表格数据，结构固定

2. **Collection 和 Document 是什么关系？**
   - Collection 是文档的容器，一个集合包含多个文档

3. **为什么要用环境变量？**
   - 保护敏感信息（密码等）不暴露在代码中

4. **Mongoose 有什么作用？**
   - 简化 MongoDB 操作，提供 Schema 定义和数据验证

---

## 📝 实践作业

### 作业 6.1：安装依赖

**任务：** 安装 mongoose 和 dotenv

```bash
cd backend
npm install mongoose dotenv
```

**验收：**
- [ ] package.json 中出现 mongoose 和 dotenv

---

### 作业 6.2：创建 .env 文件

**任务：** 创建 `backend/.env` 文件

**内容：**
```env
MONGODB_URI=mongodb://localhost:27017/race_admin
PORT=5000
NODE_ENV=development
```

**💡 提示：**
- 如果使用 MongoDB Atlas，把连接字符串替换成 Atlas 提供的
- 记得把 `<password>` 替换成你的真实密码

**验收：**
- [ ] .env 文件已创建
- [ ] 包含 MONGODB_URI 配置

---

### 作业 6.3：创建数据库连接文件

**任务：** 创建 `backend/src/config/database.js`

**代码：**
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB 连接成功: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB 连接失败:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

**验收：**
- [ ] 创建了 config 文件夹
- [ ] 创建了 database.js 文件

---

### 作业 6.4：修改 server.js

**任务：** 在 server.js 中加载环境变量并连接数据库

**修改内容：**
```javascript
// 在文件最开头添加
require('dotenv').config();

// 引入数据库连接
const connectDB = require('./src/config/database');

// 在 app.use(express.json()) 之前调用
connectDB();
```

**验收：**
- [ ] 添加了 dotenv 配置
- [ ] 引入了 connectDB
- [ ] 调用了 connectDB()

---

### 作业 6.5：测试连接

**任务：** 启动服务器，确认数据库连接成功

```bash
cd backend
node server.js
```

**预期输出：**
```
MongoDB 连接成功: localhost
服务器运行在端口 5000
```

**验收：**
- [ ] 控制台显示连接成功
- [ ] 没有报错

---

### 作业 6.6：创建 .env.example（可选）

**任务：** 创建环境变量模板文件

**内容：**
```env
# 数据库连接字符串
MONGODB_URI=mongodb://localhost:27017/race_admin

# 服务器端口
PORT=5000

# 运行环境
NODE_ENV=development
```

**验收：**
- [ ] 创建了 .env.example 文件

---

## 🧪 常见问题排查

### 问题 1：MongoServerError: connect ECONNREFUSED

**原因：** MongoDB 服务没有启动

**解决：**
- Windows：在服务中启动 MongoDB
- Mac：`brew services start mongodb-community`
- 或者使用 MongoDB Atlas 云数据库

### 问题 2：MongoServerError: bad auth

**原因：** 用户名或密码错误

**解决：** 检查 .env 中的连接字符串，确认用户名密码正确

### 问题 3：Error: Cannot find module 'dotenv'

**原因：** 没有安装 dotenv

**解决：** `npm install dotenv`

### 问题 4：process.env.MONGODB_URI 是 undefined

**原因：** dotenv 没有正确加载

**解决：** 确保 `require('dotenv').config()` 在文件最开头

---

## ✅ 完整验收清单

- [ ] 安装了 mongoose 和 dotenv
- [ ] 创建了 .env 文件
- [ ] 创建了 database.js 连接文件
- [ ] 修改了 server.js 加载环境变量
- [ ] 服务器启动时显示连接成功
- [ ] （可选）创建了 .env.example

---

完成后记得在 `docs/LEARNING.md` 中记录你的学习心得！
