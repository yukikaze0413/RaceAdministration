# 第 4 课：控制器模式（MVC 架构）- 理论知识

## 🎯 学习目标
- 理解 MVC 架构
- 学会分离业务逻辑
- 掌握控制器的编写
- 理解路由和控制器的区别

---

## 📖 理论知识详解

### 1️⃣ 什么是 MVC？

#### MVC 架构简介

**MVC** = Model（模型）+ View（视图）+ Controller（控制器）

这是一种经典的软件架构模式，用于分离应用程序的不同职责。

#### 形象比喻：餐厅运作

想象你去餐厅吃饭：

- **View（视图）** = 菜单
  - 展示给客户看的界面
  - 前端页面、API 响应格式

- **Controller（控制器）** = 服务员
  - 接收客户的点单（请求）
  - 把订单传给厨房（调用 Model）
  - 把菜端给客户（返回响应）

- **Model（模型）** = 厨房
  - 处理业务逻辑
  - 操作数据库
  - 准备数据

#### 在 Web API 中的 MVC

```
客户端请求
    ↓
路由（Route）- 决定由哪个控制器处理
    ↓
控制器（Controller）- 处理业务逻辑
    ↓
模型（Model）- 操作数据库
    ↓
控制器（Controller）- 组织响应数据
    ↓
返回给客户端
```

---

### 2️⃣ 为什么要分离业务逻辑？

#### 问题：所有代码都在路由里

**现在的代码（不好的做法）：**
```javascript
// raceRoutes.js
router.post('/', (req, res) => {
  // 1. 数据验证
  const { name, date } = req.body;
  if (!name || !date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  // 2. 业务逻辑
  const newRace = {
    id: Date.now(),
    name,
    date,
    status: 'upcoming'
  };

  // 3. 数据库操作（暂时用数组模拟）
  races.push(newRace);

  // 4. 返回响应
  res.status(201).json({
    message: '创建成功',
    data: newRace
  });
});
```

**问题：**
- ❌ 路由文件太长，难以阅读
- ❌ 业务逻辑和路由混在一起
- ❌ 代码难以测试
- ❌ 代码难以复用

#### 解决方案：控制器模式

**重构后（好的做法）：**

```javascript
// routes/raceRoutes.js - 只负责路由定义
router.post('/', raceController.createRace);

// controllers/raceController.js - 负责业务逻辑
exports.createRace = (req, res) => {
  // 所有业务逻辑都在这里
};
```

**好处：**
- ✅ 职责清晰：路由只管路由，控制器只管逻辑
- ✅ 代码复用：控制器函数可以在多个地方使用
- ✅ 易于测试：可以单独测试控制器函数
- ✅ 易于维护：修改逻辑只需改控制器

---

### 3️⃣ 控制器的职责

#### 控制器应该做什么？

1. **接收请求参数**
   - 从 req.params、req.query、req.body 获取数据

2. **数据验证**
   - 检查必填字段
   - 验证数据格式

3. **调用业务逻辑**
   - 处理数据
   - 调用 Model 操作数据库

4. **组织响应**
   - 设置状态码
   - 返回 JSON 数据

5. **错误处理**
   - 捕获异常
   - 返回错误信息

#### 控制器不应该做什么？

- ❌ 不应该定义路由（这是路由文件的事）
- ❌ 不应该直接操作数据库（这是 Model 的事）
- ❌ 不应该包含 HTML/CSS（这是 View 的事）

---

### 4️⃣ 路由 vs 控制器

#### 对比表格

| 对比项 | 路由（Route） | 控制器（Controller） |
|-------|-------------|-------------------|
| **职责** | 定义 URL 和 HTTP 方法 | 处理业务逻辑 |
| **位置** | routes/ 文件夹 | controllers/ 文件夹 |
| **内容** | 路径映射 | 具体实现 |
| **示例** | `router.get('/', ...)` | `exports.getRaces = ...` |

#### 代码对比

**路由文件（routes/raceRoutes.js）：**
```javascript
const express = require('express');
const router = express.Router();
const raceController = require('../controllers/raceController');

// 只定义路由映射，不写业务逻辑
router.get('/', raceController.getRaces);
router.get('/:id', raceController.getRaceById);
router.post('/', raceController.createRace);
router.put('/:id', raceController.updateRace);
router.delete('/:id', raceController.deleteRace);

module.exports = router;
```

**控制器文件（controllers/raceController.js）：**
```javascript
// 暂时用数组模拟数据库
let races = [
  { id: 1, name: '第一届盯帧杯', date: '2025-11-15' }
];

// 获取所有赛事
exports.getRaces = (req, res) => {
  res.json(races);
};

// 获取单个赛事
exports.getRaceById = (req, res) => {
  const id = parseInt(req.params.id);
  const race = races.find(r => r.id === id);

  if (!race) {
    return res.status(404).json({ error: '赛事不存在' });
  }

  res.json(race);
};

// 创建赛事
exports.createRace = (req, res) => {
  const { name, date } = req.body;

  // 数据验证
  if (!name || !date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  // 创建新赛事
  const newRace = {
    id: Date.now(),
    name,
    date
  };

  races.push(newRace);

  res.status(201).json({
    message: '创建成功',
    data: newRace
  });
};

// 更新赛事
exports.updateRace = (req, res) => {
  const id = parseInt(req.params.id);
  const { name, date } = req.body;

  const index = races.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: '赛事不存在' });
  }

  races[index] = { id, name, date };

  res.json({
    message: '更新成功',
    data: races[index]
  });
};

// 删除赛事
exports.deleteRace = (req, res) => {
  const id = parseInt(req.params.id);
  const index = races.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: '赛事不存在' });
  }

  races.splice(index, 1);

  res.json({ message: '删除成功' });
};
```

---

### 5️⃣ 控制器函数的标准结构

#### 基本模板

```javascript
exports.functionName = (req, res) => {
  // 1. 获取参数
  const { param1, param2 } = req.body;
  const id = req.params.id;

  // 2. 数据验证
  if (!param1) {
    return res.status(400).json({ error: '参数错误' });
  }

  // 3. 业务逻辑处理
  // ... 处理数据

  // 4. 返回响应
  res.json({ message: '成功', data: result });
};
```

#### 完整示例：创建赛事

```javascript
exports.createRace = (req, res) => {
  // 1. 获取请求数据
  const { name, date, location } = req.body;

  // 2. 数据验证
  if (!name || !date) {
    return res.status(400).json({
      error: '缺少必填字段',
      required: ['name', 'date']
    });
  }

  // 3. 业务逻辑
  const newRace = {
    id: Date.now(),
    name,
    date,
    location: location || '未指定',
    status: 'upcoming',
    createdAt: new Date()
  };

  // 4. 保存数据（暂时用数组）
  races.push(newRace);

  // 5. 返回响应
  res.status(201).json({
    message: '创建成功',
    data: newRace
  });
};
```

---

### 6️⃣ 数据验证

#### 为什么需要验证？

- 防止无效数据进入系统
- 提供清晰的错误提示
- 保证数据完整性

#### 常见验证场景

**1. 必填字段验证**
```javascript
if (!name || !date) {
  return res.status(400).json({ error: '缺少必填字段' });
}
```

**2. 数据类型验证**
```javascript
const id = parseInt(req.params.id);
if (isNaN(id)) {
  return res.status(400).json({ error: 'ID 必须是数字' });
}
```

**3. 数据格式验证**
```javascript
// 简单的日期格式验证
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(date)) {
  return res.status(400).json({ error: '日期格式错误，应为 YYYY-MM-DD' });
}
```

**4. 数据范围验证**
```javascript
if (name.length < 2 || name.length > 50) {
  return res.status(400).json({ error: '名称长度应在 2-50 个字符之间' });
}
```

---

### 7️⃣ 错误处理

#### HTTP 状态码使用

| 状态码 | 说明 | 使用场景 |
|-------|------|---------|
| **200** | OK | 请求成功（GET、PUT、DELETE） |
| **201** | Created | 创建成功（POST） |
| **400** | Bad Request | 请求参数错误 |
| **404** | Not Found | 资源不存在 |
| **500** | Internal Server Error | 服务器错误 |

#### 错误响应格式

**统一的错误格式：**
```javascript
{
  "error": "错误描述",
  "details": "详细信息（可选）"
}
```

**示例：**
```javascript
// 参数错误
res.status(400).json({
  error: '缺少必填字段',
  required: ['name', 'date']
});

// 资源不存在
res.status(404).json({
  error: '赛事不存在'
});

// 服务器错误
res.status(500).json({
  error: '服务器错误',
  details: error.message
});
```

---

### 8️⃣ 完整的 CRUD 操作

#### CRUD 是什么？

- **C**reate - 创建（POST）
- **R**ead - 读取（GET）
- **U**pdate - 更新（PUT）
- **D**elete - 删除（DELETE）

#### 完整示例

```javascript
// controllers/raceController.js
let races = [
  { id: 1, name: '第一届盯帧杯', date: '2025-11-15' }
];

// C - Create（创建）
exports.createRace = (req, res) => {
  const { name, date } = req.body;

  if (!name || !date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const newRace = {
    id: Date.now(),
    name,
    date
  };

  races.push(newRace);
  res.status(201).json({ message: '创建成功', data: newRace });
};

// R - Read（读取所有）
exports.getRaces = (req, res) => {
  res.json(races);
};

// R - Read（读取单个）
exports.getRaceById = (req, res) => {
  const id = parseInt(req.params.id);
  const race = races.find(r => r.id === id);

  if (!race) {
    return res.status(404).json({ error: '赛事不存在' });
  }

  res.json(race);
};

// U - Update（更新）
exports.updateRace = (req, res) => {
  const id = parseInt(req.params.id);
  const { name, date } = req.body;

  const index = races.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: '赛事不存在' });
  }

  races[index] = { id, name, date };
  res.json({ message: '更新成功', data: races[index] });
};

// D - Delete（删除）
exports.deleteRace = (req, res) => {
  const id = parseInt(req.params.id);
  const index = races.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: '赛事不存在' });
  }

  races.splice(index, 1);
  res.json({ message: '删除成功' });
};
```

---

## 💡 关键概念总结

| 概念 | 说明 |
|-----|------|
| **MVC** | Model（模型）+ View（视图）+ Controller（控制器） |
| **控制器** | 处理业务逻辑，连接路由和模型 |
| **职责分离** | 路由定义路径，控制器处理逻辑 |
| **CRUD** | Create、Read、Update、Delete |
| **数据验证** | 检查必填字段、数据类型、格式等 |
| **错误处理** | 使用正确的状态码和统一的错误格式 |

---

## 🎯 学习检查

理解了这些概念后，你应该能回答：

1. **MVC 中的 C（Controller）是什么？**
   - 控制器，负责处理业务逻辑

2. **为什么要把业务逻辑从路由中分离出来？**
   - 职责清晰、易于维护、易于测试、代码复用

3. **控制器和路由有什么区别？**
   - 路由：定义 URL 映射
   - 控制器：处理具体逻辑

4. **CRUD 分别对应哪些 HTTP 方法？**
   - Create → POST
   - Read → GET
   - Update → PUT
   - Delete → DELETE

---

## 📚 相关资源

- [MVC 架构详解](https://developer.mozilla.org/zh-CN/docs/Glossary/MVC)
- [RESTful API 设计指南](https://restfulapi.net/)

---

**下一步：** 完成第 4 课的实践作业，重构代码使用控制器模式！
